# Incident explanation

This was a first-depositor donation/inflation attack against the vault's share
math.

USDC has 6 decimals, so the first `deposit(1)` was 1 base unit: 0.000001 USDC.
Because the vault was empty, 0xA1 received 1 share. At that moment:

- vault assets: 1 USDC base unit
- total shares: 1
- price per share: 1 base unit

0xA1 then transferred 20,000 USDC directly to the vault address. That plain
ERC-20 transfer did not mint any shares, but the vault's accounting used the
token balance as `totalAssets`, so it still made the one existing share much
more valuable. After the donation:

- vault assets: 20,000.000001 USDC
- total shares: 1
- price per share: 20,000.000001 USDC

When 0xB2 deposited 15,000 USDC, the vault calculated shares with integer
division:

```text
shares = assets * totalShares / vaultUSDCBalance
```

Using base units, before counting B2's deposit in the balance:

```text
shares = 15,000,000,000 * 1 / 20,000,000,001
       = 0.7499999999625...
       = 0 after rounding down
```

If the implementation transferred B2's USDC first and then used the new vault
balance, the result was also zero:

```text
shares = 15,000,000,000 * 1 / 35,000,000,001
       = 0.42857142855...
       = 0 after rounding down
```

The contract did not require `shares > 0`, so the transaction succeeded: USDC
was transferred from 0xB2 into the vault, and zero shares were minted. 0xB2
therefore had no claim on the vault.

0xA1 still owned 100% of the share supply: 1 share out of 1. When 0xA1 redeemed
that share, the pro-rata redemption paid 100% of the vault balance:

```text
20,000.000001 USDC donation-inflated balance
+15,000.000000 USDC from 0xB2
=35,000.000001 USDC
```

# Fault

This is a contract bug, not a depositor mistake. 0xB2 called the public deposit
entry point and the transaction succeeded. A depositor should not be able to
lose assets while receiving zero shares unless they explicitly opted into that
outcome through a separate slippage/min-output check. The direct transfer by
0xA1 was the attacker's donation used to manipulate the exchange rate.

The vulnerable design is the combination of:

- a special empty-vault path that lets the first depositor cheaply own the full
  initial share supply;
- using the vault's raw token balance as assets, so unsolicited ERC-20
  transfers increase assets per share without minting shares;
- rounding share mints down; and
- allowing a deposit that mints zero shares to complete.

# Fix

Ship an ERC-4626-compatible implementation with virtual assets and virtual
shares, preferably by inheriting a current OpenZeppelin `ERC4626` and setting a
share decimals offset. The conversion should look like OpenZeppelin's protected
math:

```solidity
shares = assets.mulDiv(
    totalSupply() + 10 ** decimalsOffset,
    totalAssets() + 1,
    Math.Rounding.Floor
);

assets = shares.mulDiv(
    totalAssets() + 1,
    totalSupply() + 10 ** decimalsOffset,
    Math.Rounding.Floor
);
```

The virtual share supply prevents the first real depositor from cheaply owning
100% of the exchange rate, and the virtual asset makes direct donations partly
captured by the virtual shares instead of fully accruing to the attacker. A
positive decimals offset gives the vault enough share precision that normal
deposits do not round to zero.

Also make the deposit path revert when the computed share amount is zero:

```solidity
uint256 shares = previewDeposit(assets);
if (shares == 0) revert ZeroShares();
```

That revert is still compatible with ERC-4626: `convertToShares` and
`previewDeposit` can round down as required, while `deposit` does not have to
accept an operation that would mint no shares and effectively confiscate the
depositor's assets.

Operationally, integrations should also use `previewDeposit`/`previewMint` or an
ERC-4626 router with a minimum-share check for user slippage protection, but the
vault itself must be hardened because this attack can be set up before the
victim's transaction arrives.

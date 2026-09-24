# Incident explanation

This was a vault inflation / donation attack.

USDC has 6 decimals, so the first call was:

- `deposit(1)` = `0.000001 USDC`
- the vault had zero shares, so `0xA1` received `1` share
- vault state after that deposit: `totalShares = 1`, `totalAssets = 1`

Then `0xA1` sent `20,000 USDC` directly to the vault address. That was not a
deposit, so no shares were minted, but it did increase the vault's USDC balance:

- donated assets = `20,000 * 1e6 = 20,000,000,000`
- vault assets = `20,000,000,001`
- vault shares = `1`

At that point the single existing share represented the entire vault balance.
When `0xB2` deposited `15,000 USDC`, the vault used:

```text
shares = assets * totalShares / currentVaultUSDC
```

In base units:

```text
shares = 15,000,000,000 * 1 / 20,000,000,001
       = 0.7499999999625...
```

Solidity integer division rounds down, so the minted share amount was `0`.
The contract still transferred `0xB2`'s USDC in and did not revert on
`shares == 0`, so the deposit succeeded while minting no claim on the vault.

After `0xB2`'s deposit, the vault held:

```text
20,000,000,001 + 15,000,000,000 = 35,000,000,001 units
```

That is `35,000.000001 USDC`. Since `0xA1` still owned the only share,
redeeming `1` out of `1` shares paid out the whole vault balance.

# Fault

This is a contract bug, not a depositor mistake.

A plain ERC-20 transfer to a vault address is always possible. If the vault's
share pricing uses the raw token balance as `totalAssets`, then unsolicited
donations can change the share price without minting shares. That condition is
normal for ERC-4626-style vaults and the implementation must be robust to it.

The depositor's transaction was harmful only because the vault accepted a
positive asset deposit that minted zero shares. A user should not be able to
pay assets into the vault and receive no vault claim.

# Fix

Ship the ERC-4626 inflation-attack mitigation used by modern OpenZeppelin
ERC4626 implementations:

```solidity
shares = assets.mulDiv(
    totalSupply() + 10 ** _decimalsOffset(),
    totalAssets() + 1,
    Math.Rounding.Floor
);
```

and use the matching inverse formula for `convertToAssets`:

```solidity
assets = shares.mulDiv(
    totalAssets() + 1,
    totalSupply() + 10 ** _decimalsOffset(),
    Math.Rounding.Floor
);
```

The virtual asset (`+ 1`) and virtual shares (`+ 10 ** offset`) keep the initial
exchange rate from being manipulable by a one-unit first deposit plus a direct
donation. Use a nonzero decimals offset so the share token has more precision
than USDC; that makes rounding-to-zero deposits much harder and makes donation
attacks economically losing for the attacker instead of profitable.

Also make the deposit path revert if a positive asset deposit would mint zero
shares:

```solidity
uint256 shares = previewDeposit(assets);
require(shares != 0, "ZERO_SHARES");
```

That is compatible with ERC-4626: `previewDeposit` still rounds down as required,
but `deposit` refuses a deposit that cannot mint any shares. The outcome for a
future `0xB2` must be either a nonzero share balance or a reverted transaction,
never a successful transfer of assets for zero shares.

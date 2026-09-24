# USDC vault incident

0xB2's deposit succeeded because the vault accepted the USDC transfer and then minted the result of an integer division that rounded down to zero.

USDC has 6 decimals, so the amounts in base units were:

- 0xA1 initial deposit: `1` unit = `0.000001 USDC`
- 0xA1 shares after that deposit: `1`
- 0xA1 direct donation: `20,000 USDC` = `20,000,000,000` units
- Vault assets before 0xB2: `20,000,000,001` units
- 0xB2 deposit: `15,000 USDC` = `15,000,000,000` units

The share mint formula was:

```text
shares = assets * totalShares / totalAssets
```

At the time 0xB2 deposited, `totalShares` was still only `1`, while the vault already held `20,000,000,001` USDC units because 0xA1 had donated USDC directly to the vault. So, even if the vault computed shares before pulling in 0xB2's tokens:

```text
shares = 15,000,000,000 * 1 / 20,000,000,001
       = 0.7499999999625...
       = 0 after integer truncation
```

If the implementation computed against the vault's balance after pulling in 0xB2's deposit, the denominator was even larger:

```text
shares = 15,000,000,000 * 1 / 35,000,000,001
       = 0.428571...
       = 0 after integer truncation
```

Either way, the transaction did not revert because the contract allowed a deposit whose calculated shares were zero. 0xB2's USDC was transferred into the vault, but `_mint(receiver, 0)` or equivalent accounting left them with no claim.

Then 0xA1 redeemed the only real share in existence. Since 0xA1 owned `1 / 1` shares, the pro-rata redeem path paid out the entire vault balance:

```text
20,000.000001 USDC already in the vault
+ 15,000.000000 USDC from 0xB2
= 35,000.000001 USDC
```

This is a vault inflation attack. It is a contract bug, not a depositor mistake. A plain ERC-20 transfer to the vault address is allowed, and an ERC-4626 vault's `totalAssets()` normally includes donated assets. The vault must be designed so direct donations cannot make the share price so large that later deposits round to zero, or at least so such deposits revert instead of silently becoming donations. 0xB2 could only have protected themselves if they previewed the deposit and refused to submit a zero-share result, but the standard `deposit(uint256 assets, address receiver)` entrypoint has no `minShares` parameter, so the protocol cannot put that burden on depositors.

The fix we should ship is ERC-4626-compatible virtual offset accounting, matching the OpenZeppelin ERC4626 v5 mitigation:

```solidity
function _convertToShares(
    uint256 assets,
    Math.Rounding rounding
) internal view override returns (uint256) {
    return assets.mulDiv(
        totalSupply() + 10 ** _decimalsOffset(),
        totalAssets() + 1,
        rounding
    );
}
```

Use a nonzero `_decimalsOffset()` for this USDC vault so the initial virtual share supply is large relative to USDC's 6-decimal asset units. With virtual assets and virtual shares in the conversion rate, an attacker who donates directly to the vault gives most of that donation value to the virtual-liquidity accounting and later depositors, making the attack uneconomic and preventing the one-real-share supply from dominating the exchange rate.

We should also make the deposit path reject zero-share mints:

```solidity
uint256 shares = previewDeposit(assets);
if (shares == 0) revert ZeroShares();
```

The virtual offset is the primary ERC-4626-compatible inflation-attack defense. The zero-share check is the safety rail: a deposit that would mint no claim must revert, never succeed as a pure donation. The public ERC-4626 methods should continue to use the same conversion math as `previewDeposit`, `convertToShares`, `deposit`, `mint`, `withdraw`, and `redeem`, with the required rounding directions preserved.

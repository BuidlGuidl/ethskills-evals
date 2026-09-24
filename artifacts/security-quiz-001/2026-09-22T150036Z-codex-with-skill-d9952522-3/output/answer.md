# Incident explanation

0xB2 did not make an ordinary user mistake. The vault has an empty-vault donation, or inflation, bug.

The important detail is that the vault prices new shares from the USDC balance it currently holds:

```text
sharesToMint = assets * totalShares / currentUsdcBalance
```

and Solidity integer division rounds down.

USDC has 6 decimals, so the amounts in atomic USDC units were:

```text
0xA1 deposit:      1
0xA1 donation:     20,000,000,000
0xB2 deposit:      15,000,000,000
```

The sequence was:

1. The vault was empty, so 0xA1 deposited `1` atomic unit and received `1` share by the special first-depositor path.

   ```text
   assets = 1
   totalShares = 0 -> mint 1 share
   vault balance = 1
   totalShares = 1
   ```

2. 0xA1 then transferred `20,000 USDC` directly to the vault. This was not a vault deposit, so no new shares were minted. It only increased the asset balance backing the single existing share.

   ```text
   vault balance = 20,000,000,001
   totalShares = 1
   ```

3. 0xB2 deposited `15,000 USDC`. The vault computed the shares against the inflated balance and the tiny share supply:

   ```text
   shares = floor(15,000,000,000 * 1 / 20,000,000,001)
          = floor(0.7499999999625...)
          = 0
   ```

   If the implementation transfers the USDC in before calculating shares, the denominator is even larger:

   ```text
   shares = floor(15,000,000,000 * 1 / 35,000,000,001)
          = 0
   ```

   Either way, the result is zero shares. Because the contract did not reject a zero-share mint, the transaction succeeded, USDC moved from 0xB2 to the vault, and 0xB2 received no claim on the assets.

4. 0xA1 still owned the entire share supply: `1` out of `1` share. When 0xA1 redeemed, the pro-rata calculation paid the whole vault balance:

   ```text
   payout = 1 * 35,000,000,001 / 1
          = 35,000,000,001 atomic USDC
          = 35,000.000001 USDC
   ```

# Responsibility

This is a contract bug, not a depositor mistake. A user should not be able to lose an entire deposit because a prior holder manipulated the share price with a plain ERC-20 transfer. Direct token transfers to a vault are always possible for normal ERC-20s, so the vault's accounting has to be robust to donated assets.

This is the known ERC-4626 inflation attack against an unprotected empty vault: seed the vault with a tiny share supply, donate assets to make each share extremely expensive, then let a victim's deposit round down to zero shares.

# Fix

Ship an ERC-4626-compatible conversion that protects the empty and near-empty state with virtual assets and virtual shares, and make state-changing deposits revert when they would mint zero shares.

The standard OpenZeppelin-style mitigation is:

```solidity
function _convertToShares(uint256 assets, Math.Rounding rounding)
    internal
    view
    returns (uint256)
{
    return assets.mulDiv(
        totalSupply() + 10 ** _decimalsOffset(),
        totalAssets() + 1,
        rounding
    );
}

function _convertToAssets(uint256 shares, Math.Rounding rounding)
    internal
    view
    returns (uint256)
{
    return shares.mulDiv(
        totalAssets() + 1,
        totalSupply() + 10 ** _decimalsOffset(),
        rounding
    );
}
```

Use a positive decimals offset so the virtual share supply is large enough that donation attacks become uneconomical. Also require `shares != 0` in `deposit`/`mint` paths, or use an ERC-4626 implementation that already enforces that behavior, so a deposit cannot silently become a pure donation.

This remains ERC-4626 compatible: ERC-4626 allows the share/asset conversion to include virtual liquidity, and `deposit` may revert when the requested deposit cannot be completed safely at the resulting share amount.

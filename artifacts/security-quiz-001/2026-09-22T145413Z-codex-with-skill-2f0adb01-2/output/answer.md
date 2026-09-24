# Incident explanation

This was an ERC-4626 inflation/donation attack, not an ordinary user mistake by
0xB2.

USDC has 6 decimals, so the numbers below are in base units:

- 0xA1 deposited `1`, which is `0.000001 USDC`.
- Because the vault had zero supply, 0xA1 received `1` share.
- 0xA1 then transferred `20,000 USDC` directly to the vault:
  `20,000 * 1e6 = 20,000,000,000` base units.
- The vault now held `20,000,000,001` USDC base units, but still had only
  `1` share outstanding.

That direct transfer was the whole trick. It increased the vault's asset
balance without increasing the share supply. So the price of the single share
became the entire donated balance.

When 0xB2 deposited `15,000 USDC`, the mint formula rounded down:

```text
shares = assets * totalShares / vaultUsdcBalance
```

Using the balance after 0xA1's donation but before 0xB2's deposit:

```text
shares = 15,000,000,000 * 1 / 20,000,000,001
       = 0.7499999999625...
       = 0 shares after integer truncation
```

If the implementation transferred 0xB2's USDC in before computing shares, the
result is still zero:

```text
shares = 15,000,000,000 * 1 / 35,000,000,001
       = 0.428571428...
       = 0 shares after integer truncation
```

So the transaction could succeed while minting no shares. The vault accepted
0xB2's USDC, but 0xB2 received no ownership claim. After that, the vault held:

```text
1 + 20,000,000,000 + 15,000,000,000
= 35,000,000,001 base units
= 35,000.000001 USDC
```

The only share in existence still belonged to 0xA1. When 0xA1 redeemed that
one share, it represented 100% of the share supply, so the redeem paid out the
entire vault balance: `35,000.000001 USDC`.

# Whose fault

This is a contract bug/design flaw. 0xB2 used the public deposit path and the
contract accepted their assets while minting zero shares. A depositor should
not have to know that a previous account donated assets directly to manipulate
the empty-vault exchange rate.

The bug is relying on the raw token balance as `totalAssets()` with no
protection against first-deposit donation inflation and no guard against
zero-share deposits. Plain ERC-20 transfers to a vault address cannot be
prevented, so the vault has to be designed to remain safe when they happen.

# Fix to ship

Keep ERC-4626 compatibility, but change the conversion math to use the standard
virtual asset/share offset mitigation, preferably by using OpenZeppelin ERC4626
v5 and overriding the decimals offset for a USDC vault.

The conversion should have the shape:

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

function _convertToAssets(
    uint256 shares,
    Math.Rounding rounding
) internal view override returns (uint256) {
    return shares.mulDiv(
        totalAssets() + 1,
        totalSupply() + 10 ** _decimalsOffset(),
        rounding
    );
}
```

For USDC, use a nonzero offset such as `12`, making the vault share token use
18 decimals while the asset has 6. The virtual `1` asset plus virtual shares
means the first real depositor does not get sole control over all future direct
donations, and the extra share precision makes rounding-to-zero deposits far
harder to force.

Also add a defensive check that `deposit`/`mint` paths never accept nonzero
assets in exchange for zero shares, or expose a slippage-protected deposit
function with `minSharesOut`. That guard prevents silent loss, but by itself it
only turns this incident into a revert. The virtual offset is the actual
ERC-4626-compatible mitigation that makes the donation attack uneconomical.

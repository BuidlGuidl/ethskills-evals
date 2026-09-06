`0xB2` got zero shares because the vault priced its deposit against the vault's **current USDC balance**, including the 20,000 USDC that `0xA1` had donated directly to the vault address.

Step by step:

1. `0xA1` deposited `1` base unit of USDC (`0.000001 USDC`) into an empty vault.
   Because `totalShares == 0`, the vault used the bootstrap rule and minted `1` share.
   After that:
   - assets held = `1`
   - total shares = `1`

2. `0xA1` then sent `20,000 USDC` straight to the vault with a plain ERC-20 transfer.
   That increased the vault's token balance without minting any new shares.
   After that:
   - assets held = `20,000.000001 USDC`
   - total shares = `1`
   - all shares are still owned by `0xA1`

3. When `0xB2` later called `deposit(15,000 USDC)`, the mint formula was:

   ```text
   shares = assets * totalShares / vaultAssets
          = 15,000 * 1 / 20,000.000001
          = 0.7499999999... shares
   ```

   Share minting is integer math, so the result rounded down to `0`.

   In base units:

   ```text
   shares = 15,000,000,000 * 1 / 20,000,000,001 = 0
   ```

   because `15,000,000,000 < 20,000,000,001`.

4. Since the contract did not reject `shares == 0`, the transaction succeeded:
   `0xB2` transferred in `15,000 USDC`, received `0` shares, and effectively donated the assets to existing shareholders.

5. `0xA1` still owned the only share, so redeeming `1 / 1` of the shares withdrew `100%` of the vault's assets:
   - original dust deposit: `0.000001`
   - direct donation: `20,000`
   - `0xB2` deposit: `15,000`
   - total redeemed: `35,000.000001 USDC`

This is **not just a depositor mistake**. The direct transfer by `0xA1` is allowed by ERC-20 and must be treated as part of the threat model for an ERC-4626 vault. The contract bug is that the vault:

- used raw on-chain token balance as the pricing denominator, so unsolicited donations could manipulate the exchange rate, and
- allowed a `deposit` to succeed even when the computed share amount rounded down to zero.

That combination is the standard ERC-4626 **inflation/donation attack** on an empty or nearly empty vault.

The fix to ship is:

1. Keep ERC-4626 behavior, but harden the conversion math with **virtual shares and virtual assets** so the initial exchange rate cannot be skewed catastrophically by a dust first deposit plus donation.
2. Reject any deposit/mint that would produce `0` shares. A deposit that rounds to zero must revert, not silently transfer assets.

Conceptually, use conversions like:

```text
shares = assets * (totalSupply + virtualShares) / (totalAssets + virtualAssets)
assets = shares * (totalAssets + virtualAssets) / (totalSupply + virtualShares)
```

with non-zero virtual offsets, commonly paired with a higher share precision than the asset precision. This is the OpenZeppelin-style ERC-4626 defense: it preserves ERC-4626 compatibility while making donation-based inflation unprofitable or prohibitively expensive.

At minimum, the vault must also enforce:

```text
require(convertToShares(assets) != 0, "ZERO_SHARES");
```

on `deposit`, and the analogous non-zero assets check on redeem paths if needed.

So the exact conclusion is:

- `0xB2` received zero shares because integer rounding truncated `15,000 * 1 / 20,000.000001` to zero after `0xA1` had inflated the asset balance with a direct donation.
- `0xB2`'s transaction succeeding was a **contract bug**, not merely user error.
- The correct remediation is an ERC-4626-compatible anti-inflation design: virtual assets/shares in the conversion formulas, plus reverting whenever a deposit would mint zero shares.

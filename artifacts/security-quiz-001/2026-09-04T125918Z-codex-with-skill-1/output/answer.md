This is a **vault accounting bug**, not a user mistake.

The vault is vulnerable to the standard **empty-vault donation / inflation attack**:

1. `0xA1` deposits `1` USDC base unit.
   - USDC has 6 decimals, so this is `0.000001 USDC`.
   - Because `totalShares == 0`, the vault uses its special case and mints `1` share.
   - State after this step:
     - `totalAssets = 1`
     - `totalShares = 1`

2. `0xA1` then sends `20,000 USDC` directly to the vault with a plain ERC-20 transfer.
   - That is `20,000,000,000` base units.
   - The vault share supply does **not** change, because this was not a vault deposit.
   - But the vault's USDC balance does change, and your mint formula uses the vault's **current token balance** as `totalAssets`.
   - State now:
     - `totalAssets = 20,000,000,001`
     - `totalShares = 1`

3. `0xB2` deposits `15,000 USDC`.
   - That is `15,000,000,000` base units.
   - Your mint formula is:
     - `shares = assets * totalShares / totalAssets`
   - So the vault computes:
     - `shares = 15,000,000,000 * 1 / 20,000,000,001`
     - `shares = 0` after integer truncation.
   - This is the critical point: since the vault uses integer math, anything below `1` share rounds down to `0`.
   - The transaction still succeeds because the contract accepted the USDC transfer and did not revert when `shares == 0`.
   - State after `0xB2`'s deposit:
     - `totalAssets = 35,000,000,001`
     - `totalShares = 1`
     - `0xB2` owns `0` shares

4. `0xA1` redeems its `1` share.
   - Redeem pays the full pro-rata claim:
     - `assetsOut = shares * totalAssets / totalShares`
     - `assetsOut = 1 * 35,000,000,001 / 1`
     - `assetsOut = 35,000,000,001`
   - So `0xA1` withdraws the entire vault balance: `35,000.000001 USDC`.

Why `0xB2` got zero shares while the deposit succeeded:

- The donated USDC increased `totalAssets` without increasing `totalShares`.
- That made each existing share extremely expensive.
- Because only **1 raw share unit** existed, `0xB2`'s deposit bought less than `1` share.
- Integer division rounded that down to `0`.
- The contract failed to reject a deposit that previewed to zero shares.

This is **not** a depositor mistake in the security sense. A direct ERC-20 transfer to a vault address is always possible and must be treated as adversarial. In an ERC-4626-style vault, unsolicited donations are supposed to benefit existing shareholders, so the vault must be designed to resist a first-depositor setting up a near-zero share supply and then using a donation to force later deposits to round to zero.

The bug is the vault design:

- it uses the raw token balance as `totalAssets`;
- it has an unprotected `assets * totalShares / totalAssets` conversion;
- it has a special empty-vault `1:1` branch;
- and it allows `deposit` to succeed when `shares == 0`.

The change to ship:

1. **Replace the hand-rolled share math with an ERC-4626 implementation that uses virtual assets and virtual shares**.
   - This is the standard mitigation used by OpenZeppelin ERC-4626.
   - Conceptually, do not price deposits against `(totalAssets, totalShares)`.
   - Price them against `(totalAssets + virtualAssets, totalShares + virtualShares)`.
   - With a decimals offset / virtual-share supply, a first depositor cannot create the `1 share total supply` state that makes later deposits round to zero after a donation.

2. **Revert deposits that would mint zero shares**.
   - If `previewDeposit(assets) == 0`, `deposit` should revert instead of taking the user's USDC.
   - This preserves ERC-4626 compatibility: the vault can still expose `previewDeposit`, and a deposit that would produce zero shares can validly fail.

In practice, the safest fix is to migrate to OpenZeppelin's `ERC4626` implementation and use its virtual-share / virtual-asset defense rather than maintaining custom conversion logic.

Bottom line:

- `0xB2` lost funds because the vault let a direct donation distort the asset/share ratio while supply was only `1` raw share.
- Their `15,000 USDC` deposit computed to `0` shares by truncation.
- The transaction succeeded because the contract did not revert on a zero-share mint.
- That is a contract bug and a known vault inflation attack, not operator error by `0xB2`.

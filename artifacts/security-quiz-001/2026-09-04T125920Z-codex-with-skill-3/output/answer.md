This is a contract bug, not a depositor mistake.

The vault is vulnerable to the ERC-4626 donation/inflation attack that occurs when share minting uses the vault's current token balance directly:

`sharesOut = assets * totalShares / totalAssets`

with a special case that gives the first depositor `1:1` shares when `totalShares == 0`.

Here is the sequence with the actual numbers in USDC base units (`1 USDC = 1_000_000`):

1. `0xA1` deposits `1` base unit (`0.000001 USDC`).
   - The vault was empty, so the special case applies.
   - `0xA1` receives `1` share.
   - State after deposit:
     - `totalShares = 1`
     - `totalAssets = 1`

2. `0xA1` transfers `20,000 USDC` directly to the vault address.
   - This is `20,000 * 1_000_000 = 20,000,000,000` base units.
   - Because the contract computes price from `USDC.balanceOf(vault)`, this donation changes the share price even though no shares were minted.
   - State after donation:
     - `totalShares = 1`
     - `totalAssets = 20,000,000,001`
   - So the single outstanding share is now implicitly worth `20,000.000001 USDC`.

3. `0xB2` deposits `15,000 USDC`.
   - This is `15,000 * 1_000_000 = 15,000,000,000` base units.
   - The vault mints:

`sharesOut = 15,000,000,000 * 1 / 20,000,000,001`

   - Since Solidity integer division rounds down, that evaluates to `0`.
   - The transaction still succeeds because the contract apparently does not require `sharesOut > 0`.
   - `0xB2` transfers in assets and receives `0` shares.
   - State after deposit:
     - `totalShares = 1`
     - `totalAssets = 35,000,000,001`
     - `0xB2` owns no claim on the vault.

4. `0xA1` redeems its `1` share.
   - With 1 share out of 1 total share, `0xA1` owns 100% of the vault.
   - Redemption returns all `35,000,000,001` base units = `35,000.000001 USDC`.

Why `0xB2` got zero shares while the deposit succeeded:

- The direct donation made `totalAssets` very large while `totalShares` stayed at `1`.
- That made the exchange rate so expensive that `15,000 USDC` bought less than one whole share.
- Because share minting rounded down, the result became `0`.
- Because the contract accepted a zero-share mint, it took `0xB2`'s USDC without giving any ownership back.

This is not user error. A depositor is allowed to transfer ERC-20 tokens directly to a vault address, and ERC-4626 vaults must be robust to unsolicited asset donations. The bug is that the vault:

- derives conversion directly from the live token balance;
- has an empty-vault `1:1` bootstrap path with no inflation protection; and
- allows deposits that mint zero shares.

What to ship:

Use the standard ERC-4626 mitigation: virtual shares and virtual assets in the conversion functions, and revert if a deposit would mint zero shares. In OpenZeppelin-style terms, conversions should be based on:

`shares = assets.mulDiv(totalSupply + VIRTUAL_SHARES, totalAssets + VIRTUAL_ASSETS, rounding)`

and the inverse for asset conversion.

With nonzero virtual values, a direct donation cannot move the price from the empty state to an arbitrarily large value against later depositors. The attacker can still donate assets, but they no longer get almost all of that donation back through a tiny initial share position; part of the donation is absorbed by the virtual offset, making the attack unprofitable or infeasible.

To stay ERC-4626 compatible, the right change is:

1. Implement the vault on top of a well-reviewed ERC-4626 implementation, such as OpenZeppelin's `ERC4626`.
2. Override the conversion math to include virtual shares/assets or use the library's decimals-offset based protection if that is the chosen implementation.
3. Make `deposit`/`mint` revert when the previewed shares are zero.

The key point is that "plain ERC-20 transfer to the vault" must not let an attacker reprice the first real share so aggressively that later deposits round down to zero. The current contract allows exactly that, so this incident is a vault accounting flaw.

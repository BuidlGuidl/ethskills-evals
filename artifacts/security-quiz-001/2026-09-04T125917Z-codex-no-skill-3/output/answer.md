This is a contract bug, not a depositor mistake.

The sequence is the classic ERC-4626 inflation/donation attack:

1. `0xA1` deposits `1` base unit of USDC (`0.000001 USDC`).
   - Since `totalShares == 0`, the vault mints `1` share.
   - State after this step:
     - `totalAssets = 1`
     - `totalShares = 1`
     - price per share = `1 asset / 1 share`

2. `0xA1` then sends `20,000 USDC` directly to the vault with a plain ERC-20 transfer.
   - That is `20,000,000,000` base units.
   - No shares are minted, but the vault balance increases anyway.
   - State now:
     - `totalAssets = 20,000,000,001`
     - `totalShares = 1`
     - price per share = `20,000,000,001 assets / 1 share`

3. `0xB2` deposits `15,000 USDC` = `15,000,000,000` base units.
   - Your mint formula is:

   ```text
   shares = assets * totalShares / totalAssets
   ```

   - Plugging in the numbers:

   ```text
   shares = 15,000,000,000 * 1 / 20,000,000,001
          = 0.7499999999625...
   ```

   - Because Solidity integer division rounds down, that becomes:

   ```text
   shares = 0
   ```

4. The deposit succeeds because the contract apparently does not check that the computed share amount is nonzero.
   - So USDC is transferred in.
   - `0xB2` gets `0` shares.
   - State becomes:
     - `totalAssets = 35,000,000,001`
     - `totalShares = 1`

5. `0xA1` redeems its `1` share.
   - With all shares owned by `0xA1`, redeeming `1 / 1` of the supply returns `100%` of vault assets:

   ```text
   assetsOut = 1 * 35,000,000,001 / 1
             = 35,000,000,001
   ```

   - That is `35,000.000001 USDC`, exactly what happened on-chain.

Why `0xB2` ended up with zero shares

- `0xB2` was not credited because their deposit was smaller than the new value of a single share after the attacker donation.
- One share had been made artificially expensive by donating assets without minting shares.
- Integer truncation then rounded the share mint down from `0.7499...` to `0`.

Was this a user mistake?

- No.
- Sending tokens directly to an ERC-4626 vault address is allowed at the ERC-20 level and must be treated as part of the vault's asset balance.
- The user mistake would have been `0xA1`'s direct transfer if the system were designed to ignore it, but your contract explicitly uses the vault's live token balance in the mint formula, so that transfer directly changes pricing.
- The actual bug is that the vault accepts a deposit even when it mints `0` shares.

What bug class is this?

- This is the ERC-4626 donation/inflation attack.
- The vulnerable conditions are:
  - the first depositor can cheaply obtain the entire share supply,
  - unsolicited asset transfers increase `totalAssets` without increasing `totalShares`,
  - deposit rounding is downward,
  - `deposit` does not revert when `shares == 0`.

What should be changed

Ship both of these changes:

1. Revert zero-share deposits.
   - Before accepting assets, compute `shares = previewDeposit(assets)`.
   - If `shares == 0`, revert.
   - This is ERC-4626 compatible and ensures a depositor can never lose assets while receiving no shares.

2. Add ERC-4626 inflation-attack protection with virtual shares/assets.
   - Use the standard mitigation of virtual assets and virtual shares, typically together with a decimal offset for shares.
   - Conceptually, price conversions become:

   ```text
   shares = assets * (totalShares + virtualShares) / (totalAssets + virtualAssets)
   assets = shares * (totalAssets + virtualAssets) / (totalShares + virtualShares)
   ```

   - This prevents the first share from being made arbitrarily expensive by a tiny seed deposit plus a donation.
   - It makes donation attacks unprofitable or prohibitively expensive instead of letting an attacker steal later deposits almost for free.

Why both changes matter

- The immediate loss happened because `deposit` allowed `0` minted shares, so that check is mandatory.
- Virtual share/asset offsets address the deeper economic flaw at vault initialization and after donations.
- If you only add the zero-share revert, users stop losing funds this way, but an attacker can still grief the vault by forcing deposits to revert until the share price changes.
- If you only add virtual offsets but still allow `shares == 0`, you are still relying on parameter choices rather than an explicit safety invariant.

Bottom line

- `0xB2` got `0` shares because the attacker's donation raised the asset value of the only existing share above `15,000 USDC`, and integer division rounded the mint result down to zero.
- The transaction succeeded because the contract failed to reject zero-share mints.
- That is a vault design bug, not a user error.
- The correct ERC-4626-compatible fix is to revert any deposit that would mint zero shares and to implement the standard virtual-shares/virtual-assets inflation-attack defense.

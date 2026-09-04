# What happened

`0xB2` got zero shares because the vault priced shares from its **current token balance**, and that balance had already been skewed by `0xA1`'s direct USDC donation.

Step by step:

1. `0xA1` calls `deposit(1)`.
   - Supply was `0`, so your special case gives the first depositor `1` share for `1` unit of USDC.
   - State after this:
     - `totalShares = 1`
     - `vaultAssets = 1`
     - `0xA1` owns `100%` of the shares

2. `0xA1` then transfers `20,000 USDC` directly to the vault address.
   - This is not a vault deposit, so **no new shares are minted**.
   - State after this:
     - `totalShares = 1`
     - `vaultAssets = 20,000.000001 USDC`
     - `0xA1` still owns `100%` of the shares

3. `0xB2` calls `deposit(15,000 USDC)`.
   - Your mint formula is:
     - `shares = assets * totalShares / vaultAssets`
   - Plugging in the numbers at the moment shares are computed:
     - `assets = 15,000 USDC = 15,000,000,000` USDC base units
     - `totalShares = 1`
     - `vaultAssets = 20,000.000001 USDC = 20,000,000,001` base units
   - So:
     - `shares = floor(15,000,000,000 * 1 / 20,000,000,001) = floor(0.74999999996...) = 0`
   - Integer division rounds down, so the transaction mints `0` shares.
   - If the contract does not explicitly reject `shares == 0`, the deposit still succeeds:
     - USDC is transferred in
     - no shares are minted

4. After `0xB2`'s deposit:
   - `totalShares = 1`
   - `vaultAssets = 35,000.000001 USDC`
   - `0xA1` still owns the only share, therefore still owns `100%` of the vault

5. `0xA1` redeems its `1` share.
   - Redemption is pro rata.
   - Since `0xA1` owns `1 / 1` shares, it receives the entire vault balance:
     - `35,000.000001 USDC`

# Why this is possible

This is the classic ERC-4626 **inflation / donation attack**:

- the attacker becomes the initial shareholder with a tiny deposit
- the attacker donates assets directly to the vault
- the donation increases `totalAssets()` / vault balance without increasing `totalSupply()`
- later depositors get rounded down to very few shares, or to zero

In your case the attack was strong enough to force `0xB2` all the way to zero shares.

# Bug or user mistake?

This is a **contract bug / design flaw**, not merely user error.

`0xB2` did send assets at a time when `previewDeposit` would have been `0`, so a careful integrator could have noticed the bad rate. But that does not make the outcome acceptable. A vault must not silently accept a positive asset deposit and mint zero shares. The exploitable part is:

- pricing deposits off the raw token balance, which can be manipulated by unsolicited transfers
- allowing a deposit to succeed when the computed share amount rounds down to zero

So the depositor was harmed by a known ERC-4626 edge case; the vault implementation is what allowed it.

# What to ship

Ship both of these changes:

1. **Revert on zero-share deposits / zero-asset mints**
   - On `deposit(assets, receiver)`, compute `shares = previewDeposit(assets)` and revert if `shares == 0`.
   - On `mint(shares, receiver)`, compute required assets and keep the analogous sanity checks.
   - This prevents the exact "`assets` transferred, `0` shares minted" failure mode.

2. **Add virtual shares and virtual assets to conversions**
   - Keep ERC-4626 compatibility, but change the conversion math so it is not fully determined by `balanceOf(vault)` and `totalSupply()` alone.
   - Use the standard defense:
     - `convertToShares(assets) = assets * (totalSupply + VIRTUAL_SHARES) / (totalAssets + VIRTUAL_ASSETS)`
     - `convertToAssets(shares) = shares * (totalAssets + VIRTUAL_ASSETS) / (totalSupply + VIRTUAL_SHARES)`
   - Choose nonzero virtual values, typically with a decimals offset so shares have higher precision than the underlying asset.

This is the widely used ERC-4626 mitigation because direct donations still change the price, but they no longer let the first depositor capture essentially all later deposits with negligible capital. Part of any donation is absorbed by the virtual liquidity, making the attack unprofitable or extremely expensive.

# Bottom line

`0xB2` received zero shares because:

- `0xA1` owned the entire share supply after depositing `1` unit
- `0xA1` then raised the vault's asset balance by donating `20,000 USDC`
- your deposit formula used that inflated balance
- integer rounding turned `15,000 * 1 / 20,000.000001` into `0`
- the contract accepted the transfer anyway

So this is a vault implementation bug. The minimum safe patch is to revert zero-share deposits. The correct ERC-4626-compatible fix is to also adopt virtual shares/assets, as in the standard anti-inflation ERC-4626 design.

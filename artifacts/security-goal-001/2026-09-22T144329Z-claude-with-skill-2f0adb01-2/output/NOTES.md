# Save Any Token — operator notes

Two contracts:

- `src/SavingsVaultFactory.sol` — permissionless registry. One canonical vault per ERC-20,
  deployed at a CREATE2 address derived from the token. Holds no funds, has no owner.
- `src/SavingsVault.sol` — the vault. ERC-4626 over a single underlying token. The share
  token is the transferable receipt (also ERC-2612 `permit`-enabled). No owner, no pause,
  no fee, no upgrade path.

```
forge build
forge test
forge script script/Deploy.s.sol --rpc-url $RPC --broadcast   # deploys the factory only
```

---

## How a depositor's claim is computed

A depositor holds **shares**. The claim is the share's pro-rata slice of `totalAssets()`:

```
assets_out = shares * (totalAssets() + 1) / (totalSupply() + 1000)      # round down
shares_out = assets  * (totalSupply() + 1000) / (totalAssets() + 1)     # round down
```

The `+1` / `+1000` are the ERC-4626 virtual-offset mitigation (`_decimalsOffset() == 3`).
They mean the vault behaves as if it always holds 1000 virtual shares backed by 1 virtual
wei, which is what makes share-price manipulation unprofitable (see below). Consequence
worth knowing: **the share token has `underlying.decimals() + 3` decimals** — an svUSDC
share is 9 decimals, not 6 and not 18. Nothing in the system hardcodes `1e18`; decimals are
read from the underlying at construction.

Rounding is always in the vault's favour: deposits round shares down, withdrawals round
shares burned up. A deposit-then-withdraw round trip returns at most what went in.

### `totalAssets()` is not the raw balance

Yield arrives as a plain transfer, so the vault has to derive its assets from its balance.
But crediting a donation instantly would let anyone deposit immediately before the keeper's
transfer and withdraw immediately after, capturing yield they never earned. So:

```
totalAssets() = underlying.balanceOf(vault) - lockedProfit()
```

Incoming underlying is recognised as **profit that vests linearly over 24 hours**
(`VESTING_PERIOD`). At the moment it lands it is fully locked and lifts nobody's claim; 12
hours later half of it has lifted every holder's claim; after 24 hours all of it has.

Two details that follow from this:

- **The vesting clock starts at the first `sync()`**, not at the transfer. Every
  deposit/withdraw/redeem syncs first, and `sync()` is public and permissionless, so in
  practice this is the same block. Until then the donation is held fully locked — it is
  never claimable early, so a late sync only delays yield, it never leaks it.
- **Topping up blends schedules rather than restarting them.** New profit is merged with
  whatever is still vesting using a value-weighted period, so sending 1 wei cannot stretch
  the unlock of a large pending distribution. (Tested:
  `test_dustCannotGriefTheUnlockSchedule`.)

`totalAssets()` is a pure projection of what `sync()` would write, so previews and
execution never disagree — quoting and settling in the same block give the same number.

### Losses

If underlying leaves the vault without a withdrawal — negative rebase, a token admin
burning from the vault, a blocklist seizure — `sync()` absorbs it: first out of
still-vesting profit, then out of the share price. Everyone remaining takes it pro-rata
and withdrawals keep working. The vault never books assets it does not hold, so it cannot
become insolvent in the "last person out gets nothing" sense.

### Why this is safe against the first-depositor inflation attack

The classic attack is: seed 1 wei, donate a large amount, and the next depositor's shares
round to zero. Here it fails twice over:

1. The virtual offset makes the attacker's donation dilute *themselves* far more than it
   dilutes the victim.
2. The first deposit permanently burns `DEAD_SHARES = 1000` shares to `0x…dEaD`, so the
   supply floor is never attacker-controlled. A first deposit too small to cover that
   tranche reverts (`InsufficientSeedDeposit`) instead of quietly minting zero.

Plus, the donation the attack depends on is itself locked for 24 hours by the vesting.
`test_inflationAttackIsUnprofitable` runs the full attack — including warping past the
vest so the attacker gets the best possible case — and asserts the attacker ends poorer
and the victim ends whole.

---

## What an operator has to get right

### Listing a token

Listing is permissionless and irreversible: `createVault(token)` can be called by anyone,
once per token, and nobody can delist or disable the result. The factory only checks that
the address is a contract and answers `balanceOf`. So the judgement lives in your UI, not
in the contract.

- **Listing is not endorsement, and the registry is not a safety signal.** Being in
  `vaultFor` means someone paid gas. Keep your own allowlist for anything you surface
  prominently.
- **The vault's name/symbol come from the token and are attacker-controlled.** A token can
  return `symbol() = "USDC"`. The factory caps the string at 12 chars so it cannot be used
  for gas grief, but it cannot make it honest. **Key off the underlying address, never the
  symbol**, and render the underlying address in the UI.
- **Verify you listed the right address.** `predictVault(token)` gives the address before
  deployment — check it against what you broadcast. There is exactly one canonical vault
  per token; anything else claiming to be "the" vault for that token is not in the registry
  (`isVault` is the cheap onchain check for integrators).
- **Token types that behave, with caveats:**
  - *Fee-on-transfer* — supported. Deposits credit the measured balance delta, so a 1% fee
    means a 1000-token deposit credits 990. `mint()` cannot express this and reverts with
    `FeeOnTransferNotSupportedByMint`; route these tokens through `deposit()`. Tell users
    the fee is theirs to eat, on the way in *and* the way out.
  - *Pausable / blocklisting* (USDC, USDT) — if the token pauses, withdrawals revert. If the
    vault address is blocklisted, the vault is bricked. This is a property of the token, not
    something the vault can defend against; say so in the UI for those assets.
  - *Rebasing* (stETH, AMPL) — accounting is balance-derived, so positive rebases are
    treated as yield and vest over 24h, and negative rebases are absorbed as a loss.
    It works, but **prefer the wrapped version** (wstETH) — it's what users expect.
  - *Transfer-hook / ERC-777-style tokens* — every entrypoint is `nonReentrant` and follows
    checks-effects-interactions, so callbacks cannot re-enter. Tested with a hostile token.
  - *Tokens with >18 decimals or no `decimals()`* — handled (OZ falls back to 18), but sanity
    check the resulting share decimals before listing.
- **Containment is the core assumption.** Each vault is a separate contract holding exactly
  one token, with no shared balance sheet and no shared approvals. A malicious token can
  only harm the depositors of its own vault. Do not break this by adding a shared router
  that users grant blanket approvals to.

### Running the keeper

The keeper's whole job onchain is `underlying.transfer(vault, amount)`. It needs **no
permissions and no role** — the vault has no privileged functions at all. What matters:

- **Call `vault.sync()` in the same transaction as the transfer.** Not required for safety,
  but it starts the 24-hour vest immediately and emits the `Sync` event your accounting
  should key off. Batch them.
- **Send at a cadence at or under the vesting period.** `VESTING_PERIOD` is 24h. Distributing
  daily or more often keeps yield flowing smoothly; distributing every 3 days means holders
  see a day of accrual then two days flat. Under-cadence is safe, just lumpy.
- **Send the exact underlying, to the vault address, and nothing else.** Any other ERC-20
  sent to a vault is permanently stuck — there is no rescue function, deliberately, because
  a rescue function is a key that can take user funds. Double-check the destination against
  `factory.vaultFor(token)`.
- **Never send a distribution large relative to TVL into a thin vault.** It is not a loss,
  but it makes a 24-hour window where the vault's APY reads absurd, which is what farmers
  and integrator oracles react to.
- **Expect transfers to be able to revert** on pausable/blocklisting underlyings. The keeper
  should alert rather than silently retry forever.
- **The keeper cannot take anything.** Worth stating plainly to users: it has no withdrawal
  path, no admin key, and losing the keeper key stops yield but cannot lose principal.

### Deposits from contracts and bots

`deposit`, `mint`, `withdraw` and `redeem` each have an overload with an explicit slippage
bound (`minSharesOut` / `maxAssetsIn` / `maxSharesIn` / `minAssetsOut`). The share price moves
with every keeper transfer and fee-on-transfer tokens credit less than requested, so anything
automated should use those overloads rather than the bare ERC-4626 signatures.

### Deliberate non-features

No owner, no pause, no fee switch, no upgradeability. For a permissionless "save any token"
product these would each be a key that can freeze or take user funds across every listed
asset, which is a worse risk than the bugs they would let you fix. The cost of that choice:
a bug ships forever. **Audit before mainnet** — Slither is clean of high/medium findings and
the test suite covers the attack classes above, but neither is an audit.

### Before deploying

- [ ] `forge test` green, `slither .` reviewed
- [ ] Factory address verified on Etherscan (`forge verify-contract`), and each vault verified
      after listing — an unverified vault is indistinguishable from a scam
- [ ] UI keys off underlying address, shows share decimals correctly, warns on FoT/rebasing
- [ ] Keeper destination pinned to `factory.vaultFor(token)`, with alerting on revert

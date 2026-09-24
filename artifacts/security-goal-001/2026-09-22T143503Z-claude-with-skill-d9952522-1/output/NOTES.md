# SaveVault — operator notes

Two contracts:

- **`SaveVaultFactory`** — permissionless registry. Anyone lists any ERC-20, one canonical vault per
  token, deployed with CREATE2. Holds no funds, has no owner, has no privileged functions.
- **`SaveVault`** — one vault per token. ERC-4626, so the receipt token is a normal transferable
  ERC-20 that other protocols can already handle. No admin, no pause, no upgrade, no rescue.

```
forge build && forge test
```

---

## How a depositor's claim is computed

A depositor holds **shares** (the receipt token). Their claim is their pro-rata slice of
`totalAssets()`:

```
claim = shares * (totalAssets() + 1) / (totalSupply() + 10**6)
```

That's OpenZeppelin's ERC-4626 `_convertToAssets`, with a decimals offset of 6. The `+1` and the
`10**6` are virtual assets/shares: they make the conversion well-defined when the vault is empty and
make rounding-based griefing expensive. Shares therefore carry 6 more decimals than the underlying
(an 18-decimal token gets a 24-decimal receipt; USDC gets 12). Rounding is always against the user —
down when minting shares, up when burning them — so the vault never rounds itself short.

### The important part: `totalAssets()` is not the token balance

```solidity
totalAssets() = storedTotalAssets + vestedPortionOf(lastRewardAmount)
```

It is **deliberately not** `asset.balanceOf(address(this))`. Two consequences, both load-bearing:

**1. Transferring tokens in does not, by itself, move the share price.** `storedTotalAssets` is
incremented only by deposits and by rewards that have been explicitly synced and vested. Tokens that
arrive by a bare `transfer` sit in the contract uncounted until someone calls `syncRewards()`.

This is what makes permissionless listing safe. With balance-based accounting, the share price is a
function of anything anyone sends to the contract, which is the classic ERC-4626 donation/inflation
attack: deposit 1 wei, donate a large amount, and the next depositor's shares round to zero and their
deposit is absorbed. Here the donation is simply not counted, so there is nothing to inflate. The
factory's forced seed deposit and the 10**6 decimals offset are two further independent layers.

**2. Yield vests linearly instead of landing in one block.** `syncRewards()` takes everything that
arrived since the last cycle and streams it over `rewardsCycleLength`. Without this, the keeper's
transfer would be a step function in the share price, and since there is no lockup, an MEV bot could
deposit in the block before the keeper, redeem in the block after, and take a pro-rata cut of yield
it was never exposed to. Streaming means you have to actually hold through the cycle to earn.

`syncRewards()` is permissionless but gated on the previous cycle having ended. Calling it late only
delays yield; it cannot redirect yield.

### Invariants worth knowing

- `totalAssets() <= asset.balanceOf(vault)` — always. Unsynced and unvested assets are held but not
  claimed, so every outstanding share is always redeemable. Tested in
  `test_totalAssetsNeverExceedsBalance` and both fuzz tests.
- Vesting is **lazy**. Every deposit/mint/withdraw/redeem first calls `_checkpointRewards()`, which
  folds the vested-so-far amount into `storedTotalAssets`. It is value-preserving — `totalAssets()`
  is identical either side of it — and it exists so that `storedTotalAssets >= totalAssets()` at the
  moment a withdrawal decrements it. Without the checkpoint a large mid-cycle redemption underflows
  that subtraction and reverts, which would brick withdrawals for everyone until the next sync. The
  fuzzer caught exactly this; `testFuzz_exitMidVestingCycle` is the regression.

---

## What the operator has to get right

### Listing a token

`createVault(token, rewardsCycleLength, seedAssets)`. Nothing here is reversible — the vault is
immutable and there is no admin — so the checks are all pre-listing.

1. **Listing is not endorsement, and the contracts do not vet the token.** Each vault is fully
   isolated, so a malicious token can only harm people who deposited into its own vault. Your
   frontend is the only place that filtering can happen. Do not surface a vault as legitimate just
   because it exists onchain; anyone can create one for any address, including a token that
   impersonates a real one. Index by token address, never by symbol — `_symbolOf` reads whatever the
   token reports, and two tokens can report `USDC`.

2. **Fee-on-transfer tokens are rejected, by design.** `_deposit` measures the balance delta and
   reverts unless the vault received exactly what was requested. Crediting the requested amount when
   less arrived would mint more claim than the vault holds and make the last withdrawer eat the
   shortfall. Listing such a token fails at the seed deposit, so you find out immediately rather
   than after users have funds in.

3. **Rebasing and balance-mutating tokens will break the vault. Do not list them.** stETH, aTokens,
   anything with an admin that can burn, claw back, or blocklist a holder. The vault tracks assets
   internally, so a supply decrease makes the real balance fall below what is owed;
   `syncRewards()` then reverts with `VaultInsolvent` and yield stops permanently. A rebase upward is
   merely picked up as yield. There is no rescue function, so this is unrecoverable — check before
   listing, not after. Tokens with a transfer hook are safe against reentrancy (every entry point is
   `nonReentrant` and follows checks-effects-interactions) but are still worth avoiding.

4. **Seed meaningfully.** The seed is deposited by the factory and the shares go to `0x…dEaD`, so it
   is gone for good — treat it as the cost of listing. Its job is to ensure the vault is never empty.
   Seeding dust technically works but leaves the vault in its worst-conditioned range for rounding;
   seed something economically non-trivial (order of one whole token, scaled to the token's
   decimals). Remember decimals vary — 1e6 for USDC, 1e18 for most others.

5. **Pick `rewardsCycleLength` to match keeper cadence, and never change it — it is immutable.** The
   rule is *cycle length ≈ keeper interval*. Too short and yield lands almost instantly, which brings
   back the sandwich the streaming exists to prevent. Too long and yield from one top-up is still
   vesting when the next arrives, which delays the sync (`syncRewards` reverts as `CycleStillActive`
   until the cycle ends) and drags realised APY below actual. Bounded to [1 hour, 30 days]. For a
   daily keeper, use 1 day.

6. **Verify the deployed address** against `predictVaultAddress` before pointing a frontend at it.

### Running the keeper

1. **Transferring tokens in is only half the job — you must call `syncRewards()`.** Until you do,
   the tokens are in the contract but credited to nobody. This is intentional, but it means a keeper
   that only transfers silently accrues idle tokens and depositors earn nothing. Transfer, then sync,
   ideally in the same transaction.

2. **`syncRewards()` reverts with `CycleStillActive` before the previous cycle ends.** Expected, not
   an error — the keeper should tolerate it and retry rather than alerting. If cycle length matches
   the keeper interval this is rare. Anyone can call it, so a stalled keeper is self-healing as long
   as someone notices.

3. **Sync on the same cadence you committed to.** Skipping syncs doesn't lose funds — the tokens
   accumulate and roll into the next batch — but realised APY lags and the eventual catch-up batch
   vests as one large cycle.

4. **Keep each batch under `type(uint192).max`** (`RewardAmountTooLarge`). Only reachable with an
   absurd-supply token; if you hit it, split the top-up.

5. **Monitor `VaultInsolvent` on `syncRewards`.** It means the vault's balance dropped below what it
   owes — the token did something to the balance out of band. Nothing onchain can fix it. Stop the
   keeper and delist from the frontend.

### Deliberately absent

No pause, no upgrade, no admin, no asset rescue, on either contract. With permissionless listing,
any privileged role would be held by whoever happened to list the token, which makes it a rug and
censorship vector against that vault's depositors — a pause on withdrawals is worth more to an
attacker than to us. The trade-off is real and one-directional: a vault listed for a broken token
cannot be repaired, only abandoned, and points 2–3 above are the only defence. That trade is the
right one here, but it puts the weight on pre-listing diligence.

### Before mainnet

Not done here, and needed before deploying: static analysis (Slither), an invariant/stateful fuzzing
suite beyond the two property tests, pinned-fork tests against the real tokens you intend to list
first, and an external review. Consider deploying the factory from a multisig for provenance even
though it holds no privileges.

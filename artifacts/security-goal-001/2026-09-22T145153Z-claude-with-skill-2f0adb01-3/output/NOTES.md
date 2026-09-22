# Savings vaults — how the claim works and what the operator owns

Two contracts:

| Contract | Role |
| --- | --- |
| `src/SavingsVaultFactory.sol` | Permissionless registry. Anyone lists any ERC-20; one canonical vault per token, deployed with CREATE2. |
| `src/SavingsVault.sol` | The vault itself. ERC-4626 + ERC-2612 permit. The share **is** the transferable receipt token. |

There is **no owner, no pause, no fee switch and no proxy.** Once a vault exists, nobody —
including us — can move a depositor's tokens, change the accounting, or stop a withdrawal.
That is deliberate: with permissionless listing there is no one to trust with such a key,
and a pausable vault would be a censorship vector over other people's savings.

---

## 1. How a depositor's claim is computed

A depositor holds `shares` of a vault. Their claim is

```
assets = shares * (totalAssets() + 1) / (totalSupply() + 1e6)      // rounded down
shares = assets * (totalSupply() + 1e6) / (totalAssets() + 1)      // rounded down on deposit
```

Three things in that formula deserve explanation.

### `+1 / +1e6` — the virtual offset

These are the OpenZeppelin v5 virtual assets/shares (`_decimalsOffset() = 6`). They exist
to kill the **first-depositor inflation attack**: seed the vault with 1 wei, donate a large
amount directly, and the next depositor's share count rounds to zero and their money is
captured. With a 1e6 offset the attacker has to burn roughly 10^6× what they could steal,
so the attack is never profitable. As a second line of defence the first deposit into a
vault must mint at least `1e9` shares (= 1,000 wei of the underlying — negligible for any
real token) and permanently burns `1e3` shares to `0x…dEaD`, so the share supply can never
be drained back to dust. Rounding is always in the vault's favour (deposits round shares
down, withdrawals round shares up), so the residual never lands on the other depositors.

Share decimals are `underlying decimals + 6`. A 6-decimal token like USDC gives a
12-decimal receipt. Never assume 18 anywhere in the frontend or the keeper — read
`decimals()`.

### `totalAssets()` is *booked* assets, not `balanceOf`

```solidity
totalAssets() = storedTotalAssets + (vested portion of lastRewardAmount)
```

`storedTotalAssets` moves only when someone deposits (by the **measured balance delta**) or
withdraws. Tokens that simply appear in the contract are invisible to the share price until
a cycle is opened for them.

### Yield vests linearly over a cycle

This is the part that is easy to get wrong in a "keeper just transfers tokens in" design.
If yield were recognised the instant it lands, the transfer is a public mempool event and
anyone can **sandwich the keeper**: deposit a huge amount in the block before it, withdraw
in the block after, and take a slice of a week of everyone else's yield at zero risk and
zero duration. Same trick works at the ERC-4626 level with any large direct donation.

So a keeper transfer is not yield yet. Someone (anyone) calls `syncRewards()`, which takes
whatever unaccounted balance is sitting in the contract and streams it into `totalAssets()`
linearly over `rewardsCycleLength` (fixed per vault at listing, 1 hour – 30 days). To
capture yield you now have to actually hold shares across the window, which is exactly the
behaviour the product wants to pay for. `test_jitDepositCannotStealYield` pins this down.

`syncRewards()` is permissionless on purpose — the vault must never depend on a privileged
caller to keep paying — and a new cycle can only start once the previous one has finished
(or was empty), so nobody can reset the stream repeatedly to stall other people's yield.

**Worked example.** Alice deposits 1,000 USDC, Bob 3,000. Keeper sends 400 USDC and calls
`syncRewards()` on a 1-day cycle. Immediately after: `totalAssets() == 4,000` — the 400 is
in the contract but unbooked. Twelve hours later: 4,200. After the cycle: 4,400, of which
Alice's 25% of the supply is worth 1,100 and Bob's 75% is worth 3,300.

---

## 2. What the operator has to get right

### Listing a token

* **`rewardsCycleLength` is immutable.** Pick it at roughly the keeper's cadence, or a bit
  longer. Shorter than the cadence means dead time where yield sits unbooked; much longer
  means holders are paid out late. Daily keeper → 1 day cycle is a sane default. It cannot
  be changed afterwards; the only fix is a new token listing on a new deployment.
* **Listing is permissionless, so the frontend is the curation layer.** The factory will
  happily list a honeypot, a rebasing token, a token with a blocklist, or a token whose
  `transfer` is a no-op. Each vault is isolated — a hostile token can only hurt the people
  who deposited into *its* vault, never another vault or the factory — but the UI must not
  present an unvetted vault as if it were safe. Show the underlying token address, not the
  name: `name()`/`symbol()` come from the untrusted token (read defensively, with fallbacks
  and a gas cap, in `TokenMetadata.sol`) and are trivially spoofable.
* **Token classes that do not belong in a vault:**
  * *Rebasing / negative-rebasing* (stETH, AMPL): the vault's balance moves without a
    transfer. Positive rebases are silently treated as yield on the next sync (acceptable);
    negative rebases make the book exceed the real balance and the last withdrawers eat the
    loss. List the wrapped version (wstETH) instead.
  * *Fee-on-transfer*: supported, but read the semantics. `deposit()` credits only what
    actually arrived, so nobody mints shares against assets that were never received.
    `mint()` (exact-shares) reverts with `AssetNotReceived` for these tokens — use
    `deposit()`. Withdrawers receive the amount net of the token's fee.
  * *Pausable / blocklisting* (USDC, USDT): a pause or a blocked vault address freezes
    withdrawals for everyone in that vault. Nothing in the vault can fix that.
  * *Callback tokens* (ERC-777 and friends): every entry point is `nonReentrant` and
    follows checks-effects-interactions (burn before pay out), so re-entry cannot double
    spend. Still worth flagging in the UI.
* **Deploy with `forge script script/Deploy.s.sol` and verify the source** on the explorer
  for the factory. Vault addresses are CREATE2 and recomputable, so the frontend can show
  a vault's address before it is listed.

### Running the keeper

* **Transfer, then `syncRewards()`.** A transfer alone pays nobody — the tokens sit
  unbooked (visible via `pendingRewards()`) until a cycle opens. The two steps do not have
  to be atomic, but if they are not, monitor `pendingRewards() > 0` with no cycle running.
* **Don't call `syncRewards()` mid-cycle** expecting it to work — it reverts with
  `CycleNotEnded`. Schedule the keeper on the cycle boundary (`rewardsCycleEnd()`), or just
  run it every cycle length; tokens sent early are simply picked up by the next sync.
* **Send only the vault's own underlying.** Any other token sent to a vault is stuck
  forever — there is no sweep function, because a sweep is exactly the privileged escape
  hatch that would let an operator take the underlying too.
* **Don't top up a vault with zero (or near-zero) supply.** Rewards synced while the
  supply is only the burned bootstrap shares are effectively donated to whoever deposits
  next. Check `totalSupply()` before sending.
* **Monitor:** `RewardsSynced` events per vault, actual token balance vs
  `storedTotalAssets() + lastRewardAmount()` (drift means an unsupported/rebasing token),
  and the gap between keeper transfer and sync.
* **Keeper key hygiene.** The keeper has no authority over any vault — it can only give
  tokens away — so a compromised keeper key cannot drain deposits. It can still burn the
  yield budget; keep the hot wallet funded per-cycle rather than with a large float.

---

## 3. Known limitations (accepted, not overlooked)

* Yield arriving while a cycle is already running waits for the next cycle. Bounded by
  `rewardsCycleLength`, and the tokens are never at risk.
* Anyone may open an *empty* cycle at a boundary, delaying recognition of yield that lands
  a moment later by up to one cycle. No loss, no theft; the next sync picks it up.
* `deposit()` can return fewer shares than `previewDeposit()` quoted for fee-on-transfer
  tokens (the ERC-4626 preview functions cannot express a transfer fee). Frontends should
  treat the return value, not the preview, as truth.
* If a token's balance shrinks underneath the vault (negative rebase, transfer-tax on the
  *sender*), late withdrawals revert rather than paying out someone else's principal.

## Running it

```bash
forge build
forge test          # 11 tests: vesting, JIT-sandwich, inflation attack, fee-on-transfer,
                    # hostile metadata, registry rules, solvency fuzz
```

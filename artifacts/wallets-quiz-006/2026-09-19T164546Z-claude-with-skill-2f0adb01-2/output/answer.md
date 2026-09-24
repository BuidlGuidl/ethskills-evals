# Custody review: agent-operated Safe holding ~$400k

## Verdict: reject threshold 1

A 1-of-2 Safe where one owner is a hot key gives you **the same security as that
hot key alone**. The hardware wallet adds nothing against theft. It only helps if
the agent's key is *lost*, and a lost key is the less dangerous of the two failures.

### Why the "backup owner" argument fails

Under a threshold of 1, **any single owner can execute any Safe transaction**,
including the Safe's own admin calls:

- `removeOwner(prevOwner, yourHardwareWallet, 1)`: removes you
- `swapOwner(...)` / `addOwnerWithThreshold(...)`: adds the attacker's keys
- `enableModule(...)` / `setGuard(...)`: installs a permanent backdoor
- or just `transfer` / `execTransaction` everything to an attacker address in a
  single `MultiSend` batch

So if someone steals the agent's key (leaked `.env`, a compromised host, a
dependency supply-chain attack, prompt injection that gets the agent to sign
something), they don't have to race you. They drain the full $400k in **one
transaction in one block**, before any human sees an alert. Your hardware wallet
can't block, veto, or delay anything, because it isn't needed for approval.
It's a co-owner of an empty Safe.

The design mixes up two different properties:

| Property | Question | 1-of-2 design |
|---|---|---|
| **Liveness / recovery** | If a key is *lost*, can we still move funds? | ✅ Yes |
| **Security** | If a key is *stolen*, can the thief move funds? | ❌ Yes, all of them |

For a treasury, security is the property that matters. The main rule for agent
wallets is: **assume the agent key will be compromised, and design so that
doesn't mean total loss.** A hot key that runs 24/7 on a networked machine and
signs whatever an LLM-driven process decides is the key most likely to be
compromised. Giving it sole, unlimited authority over $400k is the worst setup
available.

## The real requirement, restated

The PR's actual constraint is valid: *the agent must be able to trade without
waiting for a human.* But "trade autonomously" doesn't require "have unlimited
authority over the treasury." Split the two:

1. **Ownership / admin authority** (move funds anywhere, change owners, enable
   modules): this needs a quorum that the agent **cannot** reach alone.
2. **Trading authority** (swap token A for token B on approved venues, with
   proceeds going back to the Safe, within limits): the agent gets this alone,
   through a narrowly scoped Safe module.

## Recommended design

### Owner set: 2-of-3 Safe (threshold = 2)

| Owner | Who / what | Where it lives | Hot / cold | Role |
|---|---|---|---|---|
| **A: Agent key** | The trading agent | Non-exportable key in a cloud KMS/HSM or TEE (e.g. AWS KMS secp256k1, GCP KMS). Never in a `.env`, repo, log, or plaintext file. | **Hot** | Signs module trades; can *propose* (but never alone execute) owner-level transactions |
| **B: Your hardware wallet** | You | Ledger/Trezor/Keystone/GridPlus that you keep with you | **Warm** (connected only when signing) | Day-to-day human co-signer: approves anything outside the agent's mandate |
| **C: Recovery hardware wallet** | You (or a trusted co-signer) | A *second* hardware wallet, with its seed on steel backup, stored in a **different physical location** from B | **Cold** (never used day to day) | Recovery and emergencies |

Threshold **2**. Properties:

- **Agent key stolen:** the thief holds 1 of 3 signatures and can't execute
  any owner-level transaction.
- **Agent key lost/destroyed:** B + C = 2 of 3, so you can still move funds and
  rotate in a new agent key. (This is the liveness the PR wanted from the
  "backup owner," now without giving up security.)
- **Your hardware wallet B lost or stolen:** a thief who gets B still needs a
  second signature. You bring C out of cold storage and co-sign with A a
  `swapOwner(B → B')` to a new hardware wallet.
- **The humans never depend on the agent:** B + C can always remove A, disable
  modules, and sweep funds, even if the agent is compromised or offline.

> **Optional hardening.** Do you want the agent to be an owner at all? As an
> owner, A + B is a quorum, so "agent key stolen **and** you are tricked into
> blind-signing one malicious Safe tx the attacker queued" is a total-loss path.
> The stricter variant makes the owners **B, C, and a third human key/trusted
> party (2-of-3)** and gives the agent *only* the module role below, so it can't
> even propose owner transactions. I'd take the stricter variant if the agent
> never needs to propose non-trading actions. Either way, **always verify the
> Safe transaction hash and decoded calldata on the hardware device's screen**.
> No blind signing.

### Agent autonomy: a scoped Roles module, not ownership

Enable a permissions module on the Safe (Zodiac **Roles Modifier v2** is the
standard choice; Safe's **Allowance Module** covers simple spend caps). Assign the
agent's key a role that allows **only** these actions:

- **Targets allowlist:** only specific DEX routers/pools you've reviewed (e.g.
  Uniswap Universal Router, a specific aggregator), and only specific functions.
- **Token allowlist:** only the assets the strategy trades (e.g. USDC, WETH, …).
- **Recipient pinned to the Safe:** every swap's `recipient`/`to` parameter is
  constrained to the Safe's own address, so proceeds can only come back to the
  treasury.
- **Approvals constrained:** `approve` only to the allowlisted router(s), and
  preferably only for bounded amounts. No approvals to arbitrary spenders.
- **Rate limits / allowances:** e.g. max notional per trade and per 24h (say
  $25–50k/day to start, sized to the strategy), plus a slippage/min-out bound
  where the Roles conditions can express one.
- **`Call` only, no `DelegateCall`**, and **no calls whose target is the Safe
  itself** or the module itself. This blocks `addOwner`, `changeThreshold`,
  `enableModule`, `setGuard`, and reconfiguring its own role.

Enabling or changing this module and its permissions is itself an owner action
(2-of-3), so the agent can't widen its own mandate. Treat the permission config
like contract code: review it, test it on a mainnet fork (Anvil), and re-review
on every change. A sloppy Roles config (e.g. an unconstrained `recipient`) is
equivalent to threshold 1.

Optionally, add a **Zodiac Delay modifier** (e.g. a 24–48h timelock) as the path
for any agent-initiated action outside the Roles mandate. It auto-executes after
the cooldown unless B/C veto, which gives you "agent acts without waiting for a
human, but a human can stop it" for rarer, larger moves.

### Operational controls

- **Monitoring:** alerts (Tenderly, OpenZeppelin Defender/Monitor, Forta, or a
  simple indexer) on every Safe/module execution, on any owner/module/guard
  change, and on the daily allowance nearing its cap.
- **Kill switch:** a pre-built, pre-reviewed B+C transaction that revokes the
  agent's role / disables the module and removes owner A. Practice running it.
- **Agent-side limits too:** the agent's own code should enforce position limits
  and log every transaction (never keys), but **don't rely on it**. The on-chain
  module limits are the ones that hold against a thief.
- **Key hygiene:** the agent key never leaves KMS. `.env*`, `*.key`, and
  `broadcast/` are in `.gitignore`. No hardcoded keys or keyed RPC URLs in the repo.
- **Start small:** run on a fork, then with a small fraction of the treasury,
  before routing the full $400k through the module.

## What the agent can and cannot do on its own

| On its own (agent key only), the agent **CAN** | On its own, the agent **CANNOT** |
|---|---|
| Swap allowlisted tokens on allowlisted venues via the Roles module | Transfer any asset to an arbitrary address (EOA or contract) |
| Approve allowlisted routers for allowlisted tokens (bounded) | Set a swap recipient other than the Safe |
| Trade up to the per-trade and per-day caps, 24/7, with no human in the loop | Exceed the per-trade/daily limits |
| Propose owner-level Safe txs to the Safe Transaction Service for you to review (only if it's an owner) | Execute any owner-level Safe tx (it has 1 of the 2 required signatures) |
| Queue actions into the Delay modifier (if you install one), which you can veto | Add/remove/swap owners, change the threshold, enable/disable modules, set a guard, or edit its own role permissions |
| | Use `delegatecall`, or call the Safe/module contracts directly |
| | Stop you (B + C) from removing it and sweeping the funds |

## What this buys you if the agent's key is stolen

| | Current PR (1-of-2) | Recommended (2-of-3 + scoped Roles) |
|---|---|---|
| Can the thief withdraw funds to their own address? | **Yes, everything, in one tx** | **No.** Recipient is pinned to the Safe, and no owner quorum |
| Can the thief lock you out? | **Yes.** `removeOwner` on your hardware wallet | **No.** Owner changes need 2 of 3 |
| Can the thief install a backdoor module? | **Yes** | **No** |
| Worst-case loss | **$400k (100%)** | Bounded by value extractable through *allowed* trades before you react: mainly deliberately bad-slippage trades into a pool the attacker sandwiches or manipulates, capped by the daily allowance and min-out constraints. With a ~$25–50k/day cap and alerts, that's a fraction of one day's cap, not the treasury. |
| Recovery | None. The funds are gone | B + C revoke the role, remove A, add a fresh agent key. The treasury stays intact |
| Time pressure | Zero seconds. Loss happens in the same block | Hours: the cap limits the rate of loss while you respond |

### Bottom line

Threshold 1 isn't acceptable for $400k controlled by a hot key: under it, the
hardware wallet is decorative. Use a **2-of-3 Safe** (agent KMS key, your hardware
wallet, a separately stored cold recovery hardware wallet) and give the agent
its speed through a **narrowly scoped, rate-limited Roles module** whose outputs
can only return to the Safe. The agent keeps full autonomy for the job it
exists to do (trading) and has no authority over custody. A stolen agent key
becomes a bounded, recoverable incident instead of a total loss.

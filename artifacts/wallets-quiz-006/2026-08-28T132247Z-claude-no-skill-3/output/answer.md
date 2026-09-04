# Custody Review: Agent-Operated Safe for ~$400k Treasury

**Verdict: threshold 1 is not acceptable. Do not ship this PR as drafted.**

Not because "1 is a low number," but because at threshold 1 the Safe provides
*no* security over a bare EOA, and the specific thing the PR offers as
reassurance — the hardware wallet as a second owner — is removable by the
attacker in a single transaction. The design defends against key **loss** and
does nothing about key **compromise**, while the PR's framing treats the two as
the same risk.

The PR's operational argument is, however, correct: an agent that waits on a
human co-signer for every trade is not an agent. The fix is therefore **not** to
raise the threshold. It's to stop expressing the agent's authority as a
signing threshold at all.

---

## 1. Why threshold 1 fails

### 1.1 At threshold 1, N owners means the union of N attack surfaces

A Safe's security at threshold `t` is the security of the *weakest `t`-sized
subset of owners*. At `t = 1`, that's the weakest single owner. The agent's hot
key is, by construction, the weakest key in the system: it lives on an
internet-connected host, it signs unattended, and it is driven by an LLM.

So adding your hardware wallet as a second owner at threshold 1 doesn't raise
the security floor — it just adds a second key that can also lose everything.
This design is strictly *worse* than holding the $400k in a plain EOA on your
Ledger. You have added a hot key to the set of things that can drain the
treasury and gotten nothing back.

### 1.2 The "backup owner" is not a backup — the thief evicts it

This is the sharpest problem and I want to be concrete about it.

A Safe manages its own owner set. `addOwner`, `removeOwner`, `swapOwner`,
`changeThreshold`, `enableModule`, `setFallbackHandler` are all functions on the
Safe that must be called *by the Safe itself* — i.e. via `execTransaction`
targeting its own address. At threshold 1, the agent's key alone satisfies
`execTransaction`.

So an attacker holding the agent key can, before touching a single dollar:

```
execTransaction(to: safe, data: removeOwner(prevOwner, yourHardwareWallet, 1))
```

Your hardware wallet is now not an owner. The attacker is the sole owner of a
threshold-1 Safe holding $400k. Variations that are worse:

- `swapOwner(...)` — replaces you with a second attacker key, so revoking the
  compromised agent key doesn't help.
- `enableModule(attackerModule)` — installs a persistent backdoor that survives
  you rotating owners, because most people never audit the module list.
- `delegatecall` to an attacker contract — the Safe's storage slot 0 is the
  singleton/mastercopy pointer. A delegatecall that overwrites it hijacks or
  bricks the Safe permanently, regardless of who the owners are.

The PR says the hardware wallet is "there as a backup in case the agent's key is
ever lost." That is true only in the loss case. In the theft case, the backup
owner is the first thing the attacker deletes, and you find out you were locked
out at the same moment you find out you were robbed.

### 1.3 Loss and compromise are different threats and need different controls

- **Loss** (host dies, key material unrecoverable): you need a *second path* to
  authorize.
- **Compromise** (key exfiltrated, or the agent is induced to sign): you need a
  *limit* on what any single path can authorize.

A second owner at threshold 1 addresses the first and actively worsens the
second. The design below addresses loss without using a threshold at all, which
frees the threshold to do its actual job.

### 1.4 Key theft is not even the most likely failure mode here

This is an LLM-driven agent. It can be *talked into* signing a malicious
transaction with no key compromise whatsoever: a poisoned token name or symbol
rendered into its context, a malicious "docs" page it fetches to figure out a
router ABI, an adversarial entry in a market-data feed, a crafted on-chain memo.
Prompt injection against a trading agent is a live, demonstrated threat class.

Under threshold 1 with unrestricted execution, one successful injection is a
$400k transfer to an arbitrary address, and the agent's own logs will show it
"intended" to do it. Any design that only hardens key storage does not touch
this. The design below does, because it constrains what a validly-signed
transaction is *allowed to be*.

### 1.5 There is no time to notice

At threshold 1 nothing queues, nothing waits, nothing shows up in the Safe UI as
pending. Detection and response are strictly post-hoc, against an adversary who
needs one block.

---

## 2. Why "just raise the threshold to 2" is also wrong

The obvious counter-proposal — 2-of-2, agent + your hardware wallet — should be
rejected too, for the reasons the PR gives and one it doesn't:

- It destroys the agent's autonomy, which is the point of the project.
- **2-of-2 is a permanent-freeze risk.** Lose or brick either key and the $400k
  is unrecoverable. Never run an M-of-M multisig on funds you care about.

Any design that puts the agent in the *signing set* forces a choice between
"agent is autonomous" and "agent can't drain everything." Take the agent out of
the signing set and the tradeoff dissolves.

---

## 3. Recommended design

Two Safes, and the agent is an **owner of neither**. Its authority comes from a
constrained **Safe module**, which bypasses the threshold (so: full speed, no
human in the loop) while being restricted in *what calls it may make*.

```
┌──────────────────────────────────────────────────────────────┐
│ TREASURY SAFE            ~90-95% of funds  (~$360-380k)      │
│ Owners:    HW-A, HW-B, HW-C   (all cold, all human)          │
│ Threshold: 2 of 3                                            │
│ Modules:   none (or Zodiac Delay for recovery only)          │
│ Agent access: NONE                                           │
└────────────────────────┬─────────────────────────────────────┘
                         │  manual 2-of-3 refill (deliberate friction)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ TRADING SAFE             float only        (~$20-40k)        │
│ Owners:    HW-A, HW-B, HW-C   (same 3 keys)                  │
│ Threshold: 2 of 3                                            │
│ Modules:   Zodiac Roles Modifier v2                          │
│              └─ role "trader"  → agent hot key (KMS/HSM)     │
│              └─ role "pauser"  → guardian key (kill switch)  │
└──────────────────────────────────────────────────────────────┘
```

**Owner set and threshold, stated plainly: 3 owners, threshold 2, on both
Safes. The agent's key is not one of them.**

### 3.1 Where each key lives and how

| Key | Type | Where it lives | Used for |
|---|---|---|---|
| **HW-A** | Cold, hardware | Your primary Ledger, on your person / home safe | Signing on either Safe |
| **HW-B** | Cold, hardware | **Different vendor** (e.g. Trezor), **different seed**, offsite — safe-deposit box or second residence | Signing on either Safe |
| **HW-C** | Cold, hardware | Third independent holder: co-founder, or a third device in a third location, or a co-signing service | Signing on either Safe |
| **Agent key** | Hot, non-exportable | AWS/GCP KMS, or Turnkey / Fireblocks / Privy. Raw private key **never** in the agent process, never in `.env`. Agent calls a remote `sign` API under a scoped IAM role | `execTransactionWithRole` on the Trading Safe only |
| **Guardian key** | Warm | Your phone wallet, or a second small KMS key on separate infra from the agent | Pausing the role / disabling the module. Cannot move funds |

Notes that matter:

- **Different vendors and different seeds for HW-A/B/C.** Three Ledgers from one
  seed is a 1-of-1 wearing a costume. Different vendors also hedges a firmware
  or supply-chain bug in one product line.
- **Geographic separation, and no two of the three reachable by one burglary,
  one fire, or one coercive visit.** 2-of-3 means an attacker needs two; make
  "two" genuinely hard.
- **Metal seed backups**, each stored separately from its device.
- **Test the 2-of-3 recovery path with $10 before funding it with $400k.**
  Specifically test: signing with the B+C pair, i.e. the pair that does *not*
  include your daily-driver key. That's the path you'll need in a real
  emergency and the one nobody ever rehearses.
- The agent key being in a KMS matters beyond "it's encrypted": host compromise
  then gives the attacker *signing access while they hold the host*, not a
  portable key they keep forever. You get an audit log of every signature, and
  revocation is one IAM change rather than a race to move funds.

### 3.2 Why a module rather than an owner

`execTransactionFromModule` skips the signature-threshold check entirely. That
is what preserves the agent's autonomy: it submits and executes on its own, at
block speed, with no human awake.

But a module only has the powers its own logic grants. Use **Zodiac Roles
Modifier v2** (audited, and running nine figures of DAO treasury in production)
rather than writing your own module — this is not code you want to be the first
user of. Roles gives you per-target, per-function, per-parameter scoping plus
refilling spending allowances.

Critically: **the module is not granted permission to call the Safe itself.** So
the whole class of attacks in §1.2 — owner eviction, threshold changes, module
installation, fallback-handler swaps — is unreachable from the agent's key by
construction, not by policy.

### 3.3 Recovery, without a backup owner

The PR wanted a second owner so a lost agent key wouldn't be fatal. Under this
design, agent key loss is a non-event: the 2-of-3 humans assign the "trader"
role to a fresh agent key. No funds are at risk, no backup owner needed, and the
recovery action is one that *can't* be abused because it doesn't move money.

Optionally add a **Zodiac Delay module** on the Treasury Safe as a
last-resort human recovery path: a designated recovery address can queue an
owner change that executes after, say, 30 days, cancellable by the 2-of-3.
This covers "two of my three hardware wallets are gone" without weakening the
day-to-day threshold.

---

## 4. What the agent can and cannot do, explicitly

### Can do, alone, with no human involvement

- Swap between an **allowlisted token set** (e.g. WETH, USDC, USDT, WBTC) on
  **allowlisted venues at specific pinned router addresses** (e.g. the Uniswap
  v3 SwapRouter, the CoW Protocol settlement contract, a specific aggregator
  router) — with the **recipient parameter constrained to the Trading Safe's own
  address**.
- Set ERC-20 approvals **only** for those exact spender addresses, and
  preferably bounded rather than infinite.
- Enter and exit allowlisted yield/vault positions, if that's part of strategy.
- **Sweep funds back to the Treasury Safe** at any time, unrestricted. Money
  moving toward cold storage is always safe, so this is a free capability and a
  useful de-risking lever.
- Do all of the above at full speed, unattended, 24/7, up to the allowance.

### Cannot do, ever, on its own

- Transfer ETH or any token to **any address other than the Trading Safe or the
  Treasury Safe**. Arbitrary-recipient `transfer` / `transferFrom` is not in the
  role. This is the single most important line in the design.
- Approve an arbitrary spender.
- Call any contract not on the allowlist — so a freshly-deployed drainer is
  simply unreachable.
- `delegatecall` to anything. (Blocked by default in Roles; keep it that way.
  Delegatecall is the standard total-compromise path.)
- Add/remove owners, change the threshold, enable or disable modules, set a
  guard or fallback handler, or upgrade the Safe — on **either** Safe. The
  module has no permission to call the Safe.
- Touch the Treasury Safe in any way.
- Exceed the **rolling allowance** (see below) within its refill window.
- Move the float back up: increasing the float requires a 2-of-3 human
  transaction from the Treasury Safe. That friction is deliberate — every refill
  is a natural review checkpoint where a human looks at P&L and at the module
  config before topping up.

### Requires 2-of-3 hardware wallets

- Refilling the trading float from the Treasury.
- Any withdrawal to an external address.
- Adding a token, venue, or function to the agent's allowlist.
- Raising the allowance.
- Rotating the agent key or changing the owner set.

### Requires only the guardian key (single signature, by design)

- Pause the trader role / disable the Roles module.

This is safe to leave at one signature because it can only ever *reduce* the
agent's authority — it cannot move a dollar. Making the kill switch require
2-of-3 would mean the emergency response depends on assembling two hardware
wallets at 3am, which in practice means it doesn't happen. Fast revocation must
be cheap.

---

## 5. What this buys you if the agent's key is stolen

Walk the attacker through it. They have full control of the agent host and can
sign anything with the agent key.

1. **They cannot touch the Treasury Safe.** ~$360-380k, 90-95% of the treasury,
   is behind 2-of-3 cold keys the attacker does not have. *This is the main
   thing the design buys.* Under the PR's design this number is $0.

2. **They cannot lock you out.** No owner eviction, no threshold change, no
   backdoor module, no fallback-handler swap, no storage-slot-0 delegatecall.
   You retain full 2-of-3 control of both Safes throughout. Under the PR's
   design you lose the vault along with the money.

3. **They cannot simply transfer the float out.** Arbitrary-recipient transfers
   aren't in the role. Their only channel to extract value is to *trade badly on
   purpose* through the allowlisted venues — see §6, this is real and I don't
   want to undersell it.

4. **The allowance caps the bleed.** Size the rolling allowance to roughly 1-2x
   the float per 24h. Whatever the attacker can extract is bounded by that
   window, not by the treasury balance.

5. **You find out fast.** Every module execution emits an event. Alerting is
   §7. Realistic detection is minutes, and the attacker cannot suppress it
   because the alerting doesn't run on the agent's infrastructure.

6. **Response is one transaction from one warm key.** Guardian pauses the role.
   The attacker's key is now inert. Then, unhurried: rotate the agent key,
   audit, refill.

**Bottom line: worst realistic loss goes from $400k plus permanent loss of the
Safe, to a bounded fraction of a $20-40k float, with full control retained and
the incident over in minutes.**

---

## 6. Honest limits — what this does *not* protect against

I'd rather state these than have you discover them during an incident.

- **Adversarial trading within the allowlist.** An attacker holding the agent
  key can call the allowlisted router with `amountOutMinimum = 0` and sandwich
  the trade with their own capital, extracting most of the notional. Roles can
  pin the target and the recipient; it cannot evaluate price. So assume an
  attacker can burn roughly *one allowance window's notional × achievable
  slippage*. Mitigations: keep the allowance tight, prefer venues where
  execution is price-bounded and solver-mediated (CoW) over "call this router
  with whatever calldata," and treat the allowance as your real per-incident
  loss budget rather than a formality.

- **The float is genuinely at risk.** The float size *is* the risk budget —
  that's the whole trade. If the strategy truly needs all $400k deployed
  simultaneously, this design's headline benefit shrinks accordingly, and you're
  leaning entirely on the allowlist and allowance. That is a strategy decision,
  not a security one; make it consciously and write down the number you're
  willing to lose.

- **A bug in Roles or in the Safe.** Reduced, not eliminated. Use canonical
  audited deployments, pin versions, verify addresses against the official
  Safe/Zodiac deployment registries rather than a blog post.

- **Compromise of two of the three hardware wallets** — coercion, a burglary
  that finds two, a supply-chain attack on one vendor plus one other failure.
  Hence: separate vendors, separate locations, separate custodians.

- **The Treasury Safe's own transactions.** When you *do* sign a 2-of-3, verify
  the calldata on the hardware wallet screen, not in the browser. Blind-signing
  a malicious Safe transaction bypasses everything above.

---

## 7. Implementation checklist

1. Provision HW-A, HW-B, HW-C. Different vendors, different seeds, metal
   backups, separate locations.
2. Deploy the **Treasury Safe**: owners A/B/C, threshold 2. No modules.
3. Deploy the **Trading Safe**: owners A/B/C, threshold 2.
4. Enable **Zodiac Roles Modifier v2** on the Trading Safe only.
5. Define role `trader`: allowlisted targets, functions, parameter scopes
   (recipient pinned to the Trading Safe or Treasury Safe), delegatecall
   disabled, rolling allowance set. Start *narrower* than you think you need and
   widen on demand — every widening is a 2-of-3 you'll actually think about.
6. Define role `pauser` (or keep module-disable as a guardian capability).
7. Generate the agent key **inside** a KMS/HSM as non-exportable. Scope the IAM
   principal to `sign` on that one key. Assign it the `trader` role.
8. **Rehearse before funding**: with $50 in the Trading Safe, verify (a) the
   agent can execute an allowlisted swap, (b) the agent **cannot** transfer to
   an external address, (c) the agent **cannot** call `removeOwner` on the Safe,
   (d) the guardian key can pause it, (e) B+C can sign without A.
9. Wire alerting off the agent's infrastructure — Tenderly / Safe transaction
   service webhooks / OpenZeppelin Monitor → a channel the agent can't reach.
   Alert on: every module execution, any owner or threshold change on either
   Safe, any `enableModule`/`setGuard`/`setFallbackHandler`, any allowance
   approaching exhaustion, any Treasury Safe outflow.
10. Fund: ~95% to Treasury, float to Trading. Document the refill runbook and
    the incident runbook (who pauses, who rotates, in what order).
11. If you deploy the same Safe address on other chains via CREATE2, confirm the
    owner set and module config there too — an unconfigured counterfactual
    deployment at the same address is a real footgun.

---

## 8. Requested changes to the PR

1. **Change threshold from 1 to 2, and the owner set from 2 to 3** (HW-A, HW-B,
   HW-C). Reject 2-of-2 as a freeze risk.
2. **Remove the agent's key from the owner set entirely.** It is not an owner
   under any threshold.
3. **Split into Treasury (2-of-3, cold, ~95%) and Trading (2-of-3 + Roles
   module, float).**
4. **Grant the agent authority via Zodiac Roles v2**, scoped as in §4, with a
   rolling allowance.
5. **Move the agent key into a KMS/HSM** as non-exportable; no raw key in the
   process or in env.
6. **Add a single-signature guardian kill switch** and off-host alerting.
7. **Correct the PR's rationale in writing**: a backup owner protects against
   key loss, not key theft, and at threshold 1 it is removable by the thief. The
   agent's autonomy is preserved by module execution, not by a low threshold.

The agent still executes trades on its own, in one transaction, with no human in
the loop. It just can no longer send $400k to an address of its choosing — nor
can anyone who steals its key or talks it into a bad idea.

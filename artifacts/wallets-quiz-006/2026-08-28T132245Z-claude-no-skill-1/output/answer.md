# Custody review: agent-operated Safe for ~$400k on Ethereum mainnet

**Verdict: threshold 1 is not acceptable. Do not ship this design.**

Not because it's "risky for $400k" in a hand-wavy sense, but because it has a
specific, unrecoverable failure mode: at threshold 1, the agent's hot key is not
merely able to spend the treasury — it is able to *take permanent ownership of
the Safe itself*. Anyone holding that key can call `addOwner`, `removeOwner`,
`swapOwner`, `changeThreshold`, `enableModule`, and `setFallbackHandler`. The
first thing a competent attacker does is not withdraw; it's remove your hardware
wallet as an owner and add their own. At that point your "backup owner" is gone
and there is no recovery path at any price.

The good news is that the PR's core objection is correct *and* fully satisfiable.
The agent genuinely should not wait on a human co-signer to trade. The design
below gives it exactly that — unattended, 24/7, no human in the loop for trading
— without making it an owner.

---

## 1. Why the draft design is wrong

### 1.1 The second owner adds attack surface, not security

A 2-owner / threshold-1 Safe is a 1-of-2. The set of keys that can drain it is
the *union* of the two, not the intersection. So adding your hardware wallet as
a second owner strictly **increases** the number of ways the treasury can be
lost: now a phish of you, or a compromise of the machine you sign from, is also
a total-loss event. You have paid a real security cost and bought nothing.

The PR frames the hardware wallet as "a backup in case the agent's key is lost."
Note what that framing concedes: the hardware wallet is there for *availability*,
not *security*. But at threshold 1 it doesn't even reliably buy availability,
because the agent's key can swap you out before you ever use it. It's a backup
that the primary can delete.

### 1.2 It conflates ownership with permission to trade

This is the load-bearing mistake. The PR reasons: *the agent must act
autonomously → the agent must be able to execute alone → therefore threshold 1.*

The last step doesn't follow. In a Safe, "who owns this account" and "who may
perform this specific action" are separate, independently configurable things.
Safe **modules** execute via `execTransactionFromModule`, which bypasses the
owner threshold entirely. A module can therefore be given narrow, policy-bounded
execution rights while the owner set — the root authority over the account —
stays behind a real multisig.

That is precisely the tool for this problem, and it is what the design below
uses. Autonomy and threshold 1 are not the same requirement.

### 1.3 The agent's key is more exposed than a normal hot key

Two properties make it worse than a typical server key:

- **It's online continuously, by design.** It signs unattended at machine
  frequency. There is no human looking at each transaction, so a malicious one
  looks exactly like a legitimate one until you reconcile balances.
- **It's driven by an LLM consuming untrusted input.** Prompt injection through
  market data, token names/metadata, a scraped page, or an API response can make
  the agent *choose* to sign a hostile transaction with no host compromise at
  all. Your key hygiene can be perfect and you still lose. This is the strongest
  single argument for enforcing policy *on-chain*, below the agent: an injected
  agent controls calldata, but it does not control the module's scope config.

### 1.4 A single Safe holding the full $400k is the wrong blast radius

Even with a perfect policy layer, policy engines have bugs and allowlists have
mistakes in them. Whatever the agent can reach should be sized to what the
strategy actually needs this week, not to the whole treasury.

---

## 2. Recommended design

### 2.1 Two Safes, tiered by function

| | **Treasury Safe (cold)** | **Trading Safe (hot)** |
|---|---|---|
| Holds | ~90% (~$360k) | working float only (~$40k, or 1–2 weeks of strategy needs) |
| Owners | 2-of-3 hardware | 2-of-3 hardware (**same three keys**) |
| Modules enabled | **none** | Roles Modifier (agent-scoped) |
| Agent access | **none whatsoever** | scoped trading only |
| Human involvement | every transaction | top-ups, policy changes, withdrawals |

Cold → hot top-ups require 2-of-3. This is the highest-leverage control in the
whole design and it costs you one signing session every week or two. It converts
"catastrophic key compromise" from a $400k event into a bounded-float event.

If you only take two things from this review, take: **agent key is not an owner**,
and **the agent can only reach the float**. Those two alone do most of the work.

### 2.2 Owner set and threshold: 2-of-3, all hardware, all cold

**Threshold 2 of 3 owners.** None of the three is the agent.

| Key | Custody | Location | Purpose |
|---|---|---|---|
| **A — Primary** | Hardware wallet (e.g. Ledger), own seed | With you; used for routine approvals | Day-to-day co-signature |
| **B — Secondary** | Hardware wallet, **independent seed**, ideally a **different vendor** (e.g. Trezor / Keystone) | Different physical location from A — office safe, second residence | Second co-signature; vendor diversity |
| **C — Recovery** | Hardware wallet, **independent seed** | Third location — bank safe deposit box, or a trusted second person | Only used to recover from loss/compromise of A or B |

Hard requirements on this set:

- **Three genuinely independent seeds.** Three accounts derived from one seed
  phrase is one key wearing three hats — it looks like 2-of-3 on-chain and is
  1-of-1 in reality. This is a common and fatal error.
- **Three separate physical locations.** A fire, a burglary, or a single search
  warrant should not reach two keys. Correlated storage silently collapses your
  threshold.
- **Different vendor for at least one key.** Guards against a firmware bug or
  supply-chain compromise class that would otherwise take two keys at once.
- **Metal seed backups**, stored separately from the devices themselves.

**Why 2-of-3 and not 2-of-2:** 2-of-2 has no recovery. One bricked device, one
lost seed, one accident and $400k is permanently frozen. 2-of-3 tolerates the
loss of any one key *and* the compromise of any one key. That is the property
you're paying for.

**Why not 3-of-5 or higher:** at this size, the added operational drag isn't
justified and each extra key is another thing to store correctly. Revisit above
roughly seven figures, or when more than one person needs signing authority.

**If you're genuinely solo:** key C still needs to exist, and you should decide
now who can reach it if you can't — a lawyer, a co-founder, a family member with
sealed instructions. An unrecoverable-on-your-death treasury is a real failure
mode, not a hypothetical.

### 2.3 The agent's key: a scoped module, and non-exportable

The agent's hot key is **enabled on the Trading Safe as a member of a Zodiac
Roles Modifier v2 role** — not as an owner. The Roles Modifier is the module;
the agent may only make calls the role permits.

**Scope the role to:**

- **Targets:** only the specific DEX router contracts you actually trade through
  (e.g. the Uniswap v3 `SwapRouter`, the 1inch aggregation router). Nothing else.
- **Selectors:** only the swap functions on those targets. Not arbitrary calldata.
- **Parameters:** constrain the token in/out sets to your allowlist (USDC, WETH,
  whatever the strategy trades), and — critically — **constrain the `recipient`
  parameter to the Trading Safe's own address.** Swap output must land back in
  the Safe. Without this, a "swap" is an exfiltration primitive.
- **Approvals:** `approve` is permitted only with the *spender* constrained to
  the allowlisted routers. An unbounded approve to an attacker-controlled spender
  is a drain that looks exactly like normal trade setup — this is the subtle one
  people miss. Prefer bounded approve amounts over `type(uint256).max`.
- **Quotas:** use Roles v2 consumption allowances to cap value moved per rolling
  period. This bounds the bleed rate under a compromise (see §3.3).
- **No `delegatecall`**, ever, on the agent's role.

**The role explicitly cannot:** transfer tokens or ETH to any external address,
touch owners or threshold, enable/disable modules, set a guard or fallback
handler, change the Safe implementation, or interact with any contract not on the
allowlist.

**Where the key lives:** in a KMS/HSM with a **non-exportable** secp256k1 key —
AWS KMS, GCP Cloud HSM, or a signing service like Turnkey/Fireblocks. The agent
process calls a sign API; it never holds key material. This matters concretely:
a host compromise then gives the attacker *use of the key while they hold the
box*, not the key itself. They cannot sign offline, cannot sign after you evict
them, and you can revoke IAM access in seconds. A raw private key in an env var
or a `.env` file is exfiltrated once and used forever.

**Split the signer from the strategy.** The LLM/strategy process proposes a
trade; a separate signing service independently validates it against policy
(allowlisted pair, size limits, slippage bounds, sane price vs. an oracle) before
signing. Defense in depth: the signer policy is the first line, the on-chain
Roles scope is the last. A prompt-injected strategy process should have to defeat
both, and it cannot defeat the second one at all.

**Treat the agent key as disposable.** Rotating it is a role-membership change
signed 2-of-3 — a two-minute operation, not a treasury migration. Rotate on any
suspicion, on staff changes, and on a routine schedule.

---

## 3. What this buys you if the agent's key is stolen

Compare directly against the draft design.

### 3.1 Under the draft (2 owners, threshold 1)

The attacker signs one transaction and takes everything — $400k, immediately,
irreversibly. Or, worse and more likely from a sophisticated attacker: they
first `swapOwner` your hardware wallet out and add their own key, then drain at
leisure. You have no recovery, no veto, and no lever to pull. Your hardware
wallet is decoration.

### 3.2 Under the recommended design

The attacker holds a key that:

- **Cannot transfer funds to any address they control.** No such path exists in
  the role's scope. This is the whole point.
- **Cannot touch the Safe's ownership.** No `addOwner`, no `changeThreshold`, no
  `enableModule`, no implementation change. Your control over the account is
  untouched by the compromise.
- **Cannot reach the Treasury Safe at all.** ~$360k is not exposed by this event
  in any way. The agent's key has no relationship to that account.
- **Cannot exceed the float.** Maximum exposure is what's in the Trading Safe.

**Your response** is a single 2-of-3 transaction that revokes the role
membership or disables the module. The agent is locked out; the funds never
moved. Then rotate the key and resume. Downtime is minutes-to-hours, loss is
bounded by §3.3.

### 3.3 The residual risk — name it honestly

The attacker is not powerless. They can still **trade adversarially within the
allowlist**: repeatedly swap the float back and forth through an allowlisted
pool while running the other side themselves, bleeding value out through
slippage, fees, and sandwiching. Value leaves the Safe legitimately, one basis
point at a time.

This is real, and it's the honest limit of the design. What contains it:

- **Roles v2 period quotas** cap how much value can move per hour/day. Pick a
  number a little above your real strategy's turnover.
- **Slippage bounds** enforced in the signer service, plus an oracle sanity
  check on execution price.
- **Monitoring with alerting** on every module transaction, on anomalous trade
  frequency or size, and a daily automated balance/PnL reconciliation. Without
  monitoring the bleed runs unobserved for days and the quota stops being a cap
  and starts being a drip rate.
- **The float itself** is the ultimate bound.

The shape of the worst case changes from *instant, total, irreversible* to
*slow, partial, bounded, and detectable*. That's the trade you're making, and
it's a very good one.

---

## 4. Explicitly: what the agent can and cannot do alone

**The agent CAN, unattended, with no human involvement:**

- Execute swaps on the allowlisted DEX routers, in the allowlisted assets, with
  output routed back to the Trading Safe
- Set token approvals to the allowlisted routers
- Do all of the above 24/7, at machine speed, within its per-period quota
- In other words: **run the strategy.** The PR's requirement is met in full.

**The agent CANNOT, alone, under any circumstances:**

- Send ETH or tokens to any external address — including yours
- Interact with any contract not on the allowlist (no new protocols, no bridges,
  no lending markets, no newly-deployed tokens)
- Approve any spender other than the allowlisted routers
- Add or remove owners, or change the threshold
- Enable or disable modules, set a guard, change the fallback handler, or change
  the Safe implementation
- Exceed its per-period value quota
- Touch the Treasury Safe in any way
- `delegatecall` anything

**Requires 2-of-3 hardware signatures:**

- Any withdrawal to an external address
- Cold → hot float top-ups
- Any change to the allowlist, quotas, or role scope
- Rotating the agent's key
- Any change to owners or threshold
- Adding a new protocol or venue to the strategy

Every item on that last list is low-frequency and high-consequence. That is
exactly the right set of things to put a human hardware wallet in front of, and
notably none of them is "make a trade."

---

## 5. Implementation notes and traps

1. **Guards do not automatically cover modules.** A Safe transaction guard hooks
   the *owner* path (`execTransaction`). Module transactions go through a
   separate module-guard hook, and only on newer Safe versions. Don't assume a
   guard you set constrains the agent — verify against your specific Safe
   version. In this design the Roles Modifier is the scope enforcer; treat any
   guard as secondary.
2. **A module is a full-power backdoor unless it constrains itself.** An enabled
   module bypasses the threshold entirely. This is why `enableModule` is a root
   action, and why the module you enable must be an audited scoping module
   (Roles), never a bespoke one you wrote this week.
3. **Use a current Safe version** (1.4.1+) from the canonical deployment, and
   verify the singleton and factory addresses against Safe's published
   deployments rather than a link someone sent you.
4. **Verify the owner set on-chain after setup**, from a block explorer — not
   from the Safe UI you just used. Confirm three distinct addresses and
   threshold 2.
5. **Rehearse the kill switch before going live.** Practice the 2-of-3 revoke
   transaction end to end, and write the runbook down somewhere reachable at 3am
   without the production machine. An untested recovery path is not a recovery
   path.
6. **Stage the rollout.** Testnet first, then mainnet with ~$1k for a week, then
   the float. Confirm from the logs that the Roles scope actually rejects the
   things you think it rejects — deliberately try to send yourself funds through
   the agent path and watch it revert.
7. **Never pre-sign anything.** No queued owner-path transactions sitting around
   waiting for a second signature.

---

## Summary

The PR's premise — the agent must act without waiting for a human — is right.
Its conclusion — therefore threshold 1 — does not follow, and buys a failure mode
where the agent's key can seize the Safe permanently. Ownership and trading
permission are separable in Safe, and separating them costs the agent nothing.

**Recommended:** 2-of-3 hardware owners across three independent seeds and three
locations, on both a cold Treasury Safe (~$360k, no modules, no agent) and a hot
Trading Safe (float only). The agent's key is not an owner; it is a member of a
Zodiac Roles Modifier role scoped to swaps on allowlisted routers with output
pinned to the Safe, held non-exportably in a KMS. The agent trades freely and
unattended. A stolen agent key cannot exfiltrate funds, cannot alter the Safe,
cannot reach the treasury, and is revoked with one 2-of-3 transaction — leaving
only a bounded, detectable slippage bleed against the float as residual risk.

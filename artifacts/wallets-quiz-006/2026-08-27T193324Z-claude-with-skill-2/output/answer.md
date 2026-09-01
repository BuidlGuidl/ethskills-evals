# Custody review: trading agent, ~$400k on Ethereum mainnet

**Verdict: threshold 1 is not acceptable. Reject the design as drafted.**

Not because the agent shouldn't act unattended — it should — but because the PR
conflates two different questions: *how fast can the agent act* and *how much can
the agent move*. Threshold 1 answers the first by giving away the second. You can
have unattended execution without unattended control of the principal.

---

## 1. What's actually wrong with 1-of-2

### It is strictly worse than the hardware wallet alone

With threshold 1, the Safe's security is the security of the **weakest** owner, not
the strongest. Two owners at threshold 1 means an attacker needs to compromise
*either* key — the risks union rather than intersect. The agent's hot key is, by
construction, the weak one: it's online, it signs on its own, it lives next to
process memory, a config loader, an RPC client, and whatever the model was talked
into doing. Adding a hardware wallet next to it at threshold 1 adds an attack
surface and subtracts nothing. You would be safer holding the $400k in the hardware
wallet with no Safe at all.

### The "backup owner" is not a backup

This is the part the PR gets exactly backwards. A threshold-1 owner has **full
administrative control of the Safe**, not just spending power. The agent's key can
call `removeOwner`, `swapOwner`, `changeThreshold`, `enableModule`, or
`setGuard` — all of them are just Safe transactions, and one signature is all any
of them needs.

So an attacker holding the agent's key doesn't have to hurry to drain the funds.
The first thing they do is remove your hardware wallet from the owner set and add
their own. Now the "backup" is gone, the Safe is theirs, and you have no
authority left to intervene with. Your recovery story depends on the very key
you're trying to recover from.

Even absent an attacker: a buggy agent, a bad prompt, a compromised dependency in
the trading stack, or a malicious tool result all have the same reach. There is no
blast radius here — the blast radius is the treasury plus the ability to lock you
out of it.

### The stated requirement doesn't need threshold 1

"If it has to wait on a human co-signer it can't do its job" is a real constraint,
and it's satisfiable. The mistake is assuming the agent must be a *Safe owner* to
act. It doesn't need to be — and under the design below it isn't one at all.

Likewise, "backup in case the agent's key is lost" stops being a requirement once
the agent's key isn't an owner. Losing it becomes a 10-minute rotation, not a
recovery event.

---

## 2. The design I'd ship

**Separate the authority from the actor.** The Safe holds the principal and is
controlled only by keys you hold offline. The agent gets a narrow, revocable,
rate-limited lane into that Safe — enough to trade, not enough to withdraw.

### Owner set and threshold

**Safe: 2-of-3. The agent's key is not an owner.**

| # | Owner | Where it lives | How |
|---|-------|----------------|-----|
| 1 | Hardware wallet A (Ledger/Trezor) | Your daily-carry device | **Cold** — seed generated on-device, never typed into anything, PIN + passphrase |
| 2 | Hardware wallet B | Second physical device, **different seed**, stored offsite (safe deposit box / different building) | **Cold** — offline except when signing |
| 3 | Recovery/co-signer key | Either (a) a second trusted person's hardware wallet, or (b) a secure-enclave mobile signer / passkey signer in a different trust domain from 1 and 2 | **Cold-ish** — never on the trading host |

Two devices you personally hold means **you can meet the threshold alone** — no
waiting on a counterparty for routine principal moves. A multisig doesn't require
multiple people; it requires multiple *devices*, which is precisely why a lone
hardware wallet isn't the strongest way to hold a treasury. The third owner is
survivability: lose or brick one device and you still have two. Prefer option (a)
for the third if a trustworthy second person exists — it also gives you a check
against your own device being coerced or your own mistake.

Rules for the owner set:
- Three distinct seeds. Do not derive owners 1 and 2 from the same seed phrase —
  that's a 1-of-N wearing a 2-of-3 costume.
- No owner key ever touches the machine running the agent.
- No owner key is ever generated, transported, or backed up through anything the
  agent, the repo, or a chat window can see.

### The agent's lane: a scoped module, not an owner slot

Enable a **Zodiac Roles Modifier** (or an equivalent purpose-built Safe module) on
the Safe, with the agent's hot key assigned to a single tightly-scoped role:

- **Allowed targets/selectors only.** The specific DEX routers you trade through,
  the specific functions (`exactInputSingle`, etc.). Nothing else is callable.
- **Allowed token set only.** The assets in your strategy — not "any ERC-20."
- **Approvals scoped.** `approve` permitted only to the whitelisted routers, and
  only for whitelisted tokens. Never `approve` to an arbitrary spender; that's a
  withdrawal wearing a swap's clothes.
- **No transfer-out to arbitrary addresses.** If the agent needs to move funds out
  at all, the destination must be a pre-registered address in the role (your Safe,
  your CEX deposit address) — the role encodes the address book, not the agent.
- **Rolling value cap.** Per-transaction and per-period (e.g. per-day) notional
  limits sized to your actual strategy, not to the treasury. This is the number
  that bounds your worst case.
- **No admin reach.** The role cannot call `enableModule`, `disableModule`,
  `addOwner`, `removeOwner`, `changeThreshold`, `setGuard`, or the Roles Modifier
  itself. Verify this explicitly — a module that can edit its own permissions is
  threshold 1 again with extra steps.

Sanity check on the module: *a permissive role is exactly as bad as threshold 1.*
The security lives in the scoping, not in the fact that a module exists. Have the
role config reviewed as carefully as you'd review a contract, and test the whole
thing on a fork with the agent's key deliberately handed to an adversarial script
before you fund it.

**If the Roles Modifier is more machinery than you want to own:** use the simpler
**bounded float** pattern instead. The agent's hot key controls its own plain EOA
holding a working float you'd accept losing outright — say $15–20k, ~4–5% of the
treasury. The Safe tops it up on a human-signed cadence; profits sweep back to the
Safe. Blast radius = the float, and it needs no custom permissioning to reason
about. This is the right default if the strategy tolerates trading a slice at a
time. Do not let "top-ups" become automatic and unbounded — that's a module with
worse ergonomics.

### Third piece: a pauser key

Give a separate, low-privilege hot key exactly one power: **disable the agent's
module** (or, in the float model, nothing — you just stop funding it). It cannot
move a cent. Keep it somewhere you can reach from your phone at 3am. This lets you
kill the agent in one transaction without unlocking a hardware wallet or
assembling two signatures under pressure. Losing this key costs you nothing; using
it costs you a paused strategy.

### Storage notes for the agent's hot key

Non-exportable in a KMS/HSM (AWS KMS, GCP KMS, Turnkey) so it signs but never
serializes — worth doing, and it defeats key *exfiltration*. But be honest about
the limit: **it does not defeat key *use*.** Anything that can reach the signing
API can sign, so storage never substitutes for the scope above. Sign a payload,
not a blank check: the module is what makes a stolen signing capability survivable.

And the non-negotiables: the key is generated on the host, never in a prompt, a
chat, or a ticket. `.gitignore` before the first push, not after. No hardcoded
value, default, fallback, or filled-in example in the repo. **A key that ever
appeared in a prompt or a chat log is burned** — rotate it and replace the
account rather than funding it on mainnet.

---

## 3. What this buys you when the agent's key is stolen

Assume full compromise: the attacker has the signing capability and can call it at
will. Compare:

| | Draft (1-of-2) | Recommended (2-of-3 + scoped module) |
|---|---|---|
| Immediate loss | **Up to $400k** | Capped at the role's per-period limit (or the float) |
| Can withdraw to attacker's address | Yes | No — destinations are whitelisted |
| Can drain via `approve` to attacker | Yes | No — approvals scoped to whitelisted routers |
| Can evict you from the Safe | **Yes** | No — no admin reach |
| Can raise its own limits | Yes | No — needs 2 of 3 cold keys |
| Your ability to revoke | None once evicted | Full, unilateral, doesn't need the agent's cooperation |
| Detection window matters? | No — one tx and it's over | Yes — the cap buys you hours |

Concretely, the attacker's best move under the recommended design is to burn value
*through* the whitelisted venues: swap at terrible prices, sandwich themselves,
churn fees. That is a real loss and I won't pretend it's zero — **the per-period
cap is your actual maximum loss**, so size it as "what am I willing to lose in a
day," not "what's convenient for the strategy." What they cannot do is take
custody: the principal never leaves the Safe, and they never gain the authority to
change the rules.

Meanwhile you retain the ability to stop it. Two cold keys — both of which you may
hold — disable the module and rotate the role member. The agent has no vote. That
is the property threshold 1 destroys and the reason it's the line I won't cross at
this size.

**And the PR's actual stated worry — losing the agent's key — becomes a non-event.**
The agent isn't an owner, so a lost key means you assign a fresh key to the role
and restart. No recovery ceremony, no backup owner needed.

---

## 4. Explicitly: what the agent can and cannot do alone

**Can, unattended, no human in the loop:**
- Swap between whitelisted tokens on whitelisted venues, within per-tx and
  per-period notional caps
- Set/adjust approvals to whitelisted routers for whitelisted tokens
- Enter, adjust, and exit positions in the configured strategy
- Pay its own gas from a small ETH balance in its EOA
- Read anything; simulate anything; propose a Safe transaction for you to review

**Cannot, ever, without 2-of-3 cold signatures:**
- Move principal out of the Safe, to any address, including yours
- Send to an address not already in the role's whitelist
- Approve any spender outside the whitelist, or touch a non-whitelisted token
- Exceed its per-transaction or per-period cap
- **Raise its own cap, widen its own whitelist, or alter its own role**
- Add/remove Safe owners, change the threshold, set or remove a guard
- Enable or disable modules (including itself — it can't un-pause itself either)
- Upgrade the Safe implementation or change the fallback handler
- Interact with a protocol you haven't reviewed and whitelisted

**Human gate, stated plainly for the PR description:** *moving principal, changing
the address whitelist, raising the agent's limits, and changing who may sign all
require two hardware-wallet signatures. Every one of them is a "print the amount,
the checksummed destination, and the live-estimated gas cost, then stop until a
human says yes" moment.* Never price gas from a remembered ETH price — quote it
live at signing time.

**Revocation path, stated plainly:** the pauser key disables the agent's module in
one transaction. 2-of-3 rotates the role to a fresh key. Neither requires the
agent's cooperation, its consent, or its key to still exist.

---

## 5. If you push back

The strongest argument for the draft is latency: a scoped role adds a config you
must maintain, and any whitelist will occasionally block a trade you wanted. That
cost is real and it's the price of the bound. If the strategy genuinely cannot
express itself inside a whitelist, that's a signal to start with the **bounded
float** version — trade a slice you can afford to lose, prove the agent out over a
few months, then widen the lane deliberately.

What isn't negotiable at $400k: the agent does not hold admin authority over the
account that holds the principal. Whatever shape the lane takes, the key that
signs unattended must not be able to change the rules that constrain it.

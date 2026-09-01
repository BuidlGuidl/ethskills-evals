# Custody review: agent-controlled Safe for ~$400k on Ethereum mainnet

## Verdict

**No. Threshold 1 is not acceptable here, and the specific failure it creates is worse
than "the agent can spend the money."**

A 2-owner Safe with threshold 1 is not a multisig. It is a single-key wallet with a
proxy contract in front of it, and it has *two* independent single points of total
failure instead of one. The hardware wallet in the owner set does not reduce risk at
all in the compromise direction — it only adds a second key that can also unilaterally
drain the Safe.

The PR's reasoning contains one correct requirement and one false binary. The correct
requirement: the agent must be able to trade without waiting for a human. The false
binary: that this forces the agent to hold unconstrained authority. In the Safe
architecture, *how many signers* and *what actions are permitted* are separate,
independently configurable dimensions. Threshold 1 collapses them. The design below
keeps them separate, which is what lets the agent trade unilaterally while never being
able to steal.

---

## Why threshold 1 fails, concretely

### 1. The attacker does not just drain the Safe — they keep it

This is the part the PR misses, and it is the important part. At threshold 1, the
agent's hot key can make the Safe execute a call *to itself*. Safe owner management
functions are `authorized` — meaning callable only by the Safe — so "the agent can
execute one transaction alone" is identical to "the agent can execute any of these
alone":

- `removeOwner(...)` — evict your hardware wallet
- `addOwner(...)` / `swapOwner(...)` — install the attacker's key
- `changeThreshold(...)` — cement it
- `enableModule(...)` — attach a backdoor contract with permanent withdrawal rights
- `setFallbackHandler(...)` — change what the Safe does on unknown calldata
- `setGuard(...)` — install or remove transaction checks

So the loss is not bounded by the balance at the moment of compromise. The attacker
takes **ownership of the address**. Everything that later routes to it — future
deposits, LP positions, vesting, airdrops, counterparty settlements, refunds from
protocols you have open positions in — is theirs too. Recovery is impossible because
recovery would require an owner action and you are no longer an owner.

### 2. "Backup owner in case the key is lost" defends the wrong failure

Key *loss* and key *compromise* are different events with different frequencies and
wildly different costs. The draft design defends against loss (the cheap, recoverable
event) and is fully open to compromise (the expensive, unrecoverable one). It also
solves loss inefficiently: 2-of-3 human hardware signers solve key loss strictly
better, and don't require the agent to be an owner at all.

### 3. A hot key on a trading server is a realistic compromise target

Assume the agent's key will eventually be exposed. The plausible paths are mundane:
a dependency in the trading stack is backdoored; the RPC/strategy config gets a prompt
injection or a malicious token's metadata steers the agent; a container image or CI
secret leaks; the box is misconfigured; the agent itself is manipulated into signing
something. An agent that reads untrusted on-chain data and external feeds has a large,
constantly-changing attack surface. Designing on the assumption that it stays clean for
the lifetime of a $400k treasury is not a design, it's a bet.

Note that at threshold 1 you don't even need the key — a single *signature* is enough.
Safe transactions can be executed by anyone once the required signatures exist, so a
leaked signed payload sitting in a log or a queue is a completed theft.

### 4. There is no second pair of eyes on calldata

At threshold 1, nothing ever reviews what the agent is signing. No human, no policy
contract, nothing. A single bad decision by the agent — not even an attacker, just a
bug or a hallucinated address — is final and immediate.

---

## Recommended design

The core move: **ownership and operating authority are separated.** Owners hold
unconstrained authority and are all cold, plural, and human. The agent gets constrained
authority through a **Safe Module**, never through ownership. The agent's speed comes
from the module; your safety comes from the owner set.

Second move: **two Safes, so the treasury and the working capital have different risk
profiles.**

### Safe A — Treasury Safe (cold, ~$360k / 90%)

| | |
|---|---|
| Owners | 3 human hardware keys |
| Threshold | **2 of 3** |
| Modules | **none** |
| Guard | none needed |
| Agent access | **zero** — not an owner, no module, no allowance |

Signers:

1. **HW-1** — your primary hardware wallet (Ledger or Trezor), PIN + passphrase, kept
   with you. Seed on steel, never photographed, never typed into anything.
2. **HW-2** — a *different vendor*, *independent seed*, stored offsite (bank box or a
   second physical location). Different vendor matters: it removes a single firmware or
   supply-chain bug as a correlated failure.
3. **HW-3** — a third independent hardware key held by a trusted second party (co-founder,
   counsel, family member) or an institutional co-signer service. If a third person isn't
   viable, a third hardware wallet in a third location is acceptable but weaker, since it
   doesn't defend against coercion of you specifically.

Rules: never derive two owner keys from the same seed (that is a 1-of-1 wearing a 2-of-3
costume). No two keys in the same physical location. No seed material in any digital form.

This Safe is where the money lives. It moves a few times a month, by humans, deliberately.

### Safe B — Trading Safe (hot working capital, ~$40k / 10%)

| | |
|---|---|
| Owners | **the same 3 hardware keys** |
| Threshold | **2 of 3** |
| Modules | one: a **Zodiac Roles Modifier v2**, owned by Safe B itself |
| Agent | holds a role on the Roles Modifier — **not an owner** |

The agent's key is assigned a role with a tightly scoped permission set. It calls
`execTransactionFromModule` through the Roles Modifier, which enforces the scope
on-chain and reverts anything outside it. **No human signature is involved in a trade.**

**Critical wiring detail:** the Roles Modifier's `owner` must be **Safe B**, not a hot
key. If the modifier's owner is anything the agent can reach, the agent can rewrite its
own permissions and the whole scheme is decorative.

**Second critical detail:** a Safe transaction Guard (`setGuard`) hooks `execTransaction`
only. In Safe contracts 1.3.0 and 1.4.x, module transactions do **not** pass through it
(a separate module guard hook was only added in later contract versions). So do not put
your policy in a Guard and assume it covers the agent — **all agent constraints must live
inside the Roles Modifier itself.** Verify this against the exact Safe contract version
you deploy before you fund anything.

#### Scope granted to the agent

Allowed, unilaterally, 24/7, no human:

- `exactInputSingle` / `exactInput` (or your chosen router's swap selectors) on an
  **allowlisted router set** — e.g. one Uniswap v3 router, one CowSwap relayer. Nothing else.
- With the `recipient` / `receiver` parameter **hard-scoped to Safe B's own address**.
  This is the single highest-value constraint in the design: swap output can only ever
  land back in the Safe.
- **Token allowlist**: only the assets you actually trade (e.g. WETH, USDC, wstETH).
  Enforced on both the input and output side.
- `approve` only with `spender` in the allowlisted router set. Use bounded approvals if
  your tooling supports it; never unlimited to a non-allowlisted address.
- **Spend caps** via the Roles Modifier's allowance feature: a per-day notional ceiling
  (e.g. $10k/day) that refills on a schedule. Size it to your actual strategy throughput
  plus modest headroom, not to "whatever might be convenient."

Explicitly **not** in scope — these must revert:

- `transfer` / `transferFrom` to any address (the agent has no withdrawal primitive at all)
- raw ETH sends to EOAs
- any `delegatecall`
- any token outside the allowlist, any contract outside the allowlist
- bridges, lending markets, LP deposits, staking, new protocol integrations
- `addOwner`, `removeOwner`, `swapOwner`, `changeThreshold`
- `enableModule`, `disableModule`, `setGuard`, `setFallbackHandler`, singleton upgrade
- any call to the Roles Modifier itself (no self-granting)

Treat `enableModule` as exactly as dangerous as `addOwner` — it is an unlimited
withdrawal grant. It belongs to the 2-of-3 humans permanently.

#### Keys and where they live

| Key | Type | Storage | Authority |
|---|---|---|---|
| HW-1 | Hardware (vendor A) | With you, PIN + passphrase, steel seed | Owner, both Safes |
| HW-2 | Hardware (vendor B) | Offsite, independent seed | Owner, both Safes |
| HW-3 | Hardware (vendor B or C) | Trusted third party / third location | Owner, both Safes |
| Agent key | Hot | **Non-exportable key in AWS/GCP KMS or an HSM/TEE** — sign-only | Roles member on Safe B |
| Pauser key | Hot | Your phone / separate device, not the trading box | Can only *pause* the module |
| Gas EOA | Hot | Trading box, holds ~0.1 ETH | Nothing but gas |

Put the agent key in a KMS/HSM rather than a file on disk. It doesn't make compromise
impossible, but it changes the attack from "exfiltrate a file once and drain at leisure
from anywhere" to "maintain live access to a box that is being monitored." That
difference buys you detection time, which is the thing you actually need.

The gas EOA is separate and expendable. Do not let the agent pull gas from the Safe on
demand — that's an unmetered ETH withdrawal path wearing a reasonable-sounding name.

#### The pause path

Give a separate, low-privilege **pauser key** the ability to do exactly one thing:
pause the Roles Modifier / revoke the agent's role. Pausing is safe to make unilateral
(worst case: you halt your own trading). **Unpausing must be 2-of-3.** Asymmetric
authority like this is cheap and is what makes fast incident response possible without
creating a new hot privilege worth stealing.

Pre-draft and pre-simulate the "disable module" transaction in the Safe UI so that under
pressure it's a signature, not an engineering task.

---

## What this buys you when the agent's key is stolen

Walk the attacker through it. They have full control of the agent's signing capability.

1. **They cannot withdraw.** There is no code path from the agent's role to an arbitrary
   recipient. `transfer` isn't in scope, and swap `recipient` is pinned to the Safe.
   The normal outcome of a hot key compromise — instant total drain — is simply not
   reachable.

2. **They cannot make the compromise permanent.** No `addOwner`, no `changeThreshold`,
   no `enableModule`, no fallback handler swap. Your 2-of-3 recovery path is intact the
   entire time. Under threshold 1 this is the difference between an incident and a total
   permanent loss.

3. **The treasury is untouched.** Safe A has no relationship with the agent whatsoever —
   not a restricted one, *none*. ~$360k is not in play under any sequence of actions the
   attacker can take.

4. **What they *can* do — and be clear-eyed about this.** The attacker's best remaining
   move is **value destruction through adversarial trading**: swap the hot tranche back
   and forth through the allowlisted venue at deliberately bad prices, or sandwich their
   own forced trades with a second address to extract the slippage. Funds stay in the
   Safe; value leaks out through the market. So "cannot withdraw" is not "cannot lose
   money."

   Bound it: with a $40k hot tranche and a $10k/day allowance, realistic extraction is
   the slippage-extractable fraction of $10k per day — low thousands, not $400k — and it
   is loud on-chain. Tighten it further by allowlisting only deep-liquidity pools/pairs
   and by using a settlement venue with price protection.

5. **Response is minutes, not a rebuild.** Pauser key halts the module immediately, or
   2-of-3 humans call `disableModule`. Then rotate: mint a new agent key, assign the
   role, resume. The Safe address, the treasury, and every integration pointing at it
   are unchanged.

**Net:** worst case moves from "lose $400k and the address, permanently, with no
recovery" to "lose low thousands to slippage over one allowance window, detect it,
pause it, rotate the key."

### And if the agent's key is *lost* (the PR's actual concern)

It is a non-event. The agent key holds no funds and no withdrawal authority. Generate a
new one, 2-of-3 assigns it the role, done. Making the agent a Safe owner "as a backup"
solves this problem in the most expensive way available — the 2-of-3 human owner set
already solves key loss, for all keys, better.

---

## Answering the PR's objection directly

> "if it has to wait on a human co-signer it can't do its job"

This is true only if trading and administration are the same authority. They aren't
here. Split the two planes:

- **Trading plane** (swaps within allowlist and caps): agent alone, no human, no
  latency, any hour. Same speed as threshold 1. Gas cost is comparable — one signature,
  one transaction.
- **Control plane** (refilling the hot Safe from treasury, changing the allowlist,
  raising caps, adding tokens/venues, changing owners or modules): 2-of-3 humans, minutes
  to hours.

The agent never waits to trade. It waits only to *change what trading means* — which is
exactly the decision that should have a human in it.

The refill requirement is a feature, not friction. If the strategy wants more capital,
that is a capital allocation decision, and it should cost you a hardware wallet tap. It's
also your throttle: the maximum you can lose in any window is bounded by how much you
chose to put on the hot side.

---

## Explicit capability summary

**The agent CAN do on its own, with no human:**
- Swap allowlisted tokens on allowlisted venues, with output returning to Safe B
- Set and manage approvals to allowlisted routers only
- Spend up to the per-day allowance
- Read, quote, simulate, and plan freely
- Pay its own gas from the small gas EOA

**The agent CANNOT do on its own, under any circumstances:**
- Send funds to any address other than Safe B
- Trade non-allowlisted tokens, or use non-allowlisted venues
- Exceed the daily allowance
- Bridge, lend, stake, LP, or integrate any new protocol
- Add/remove owners, change the threshold, or enable/disable modules
- Change the Guard, fallback handler, or upgrade the Safe
- Modify its own permissions on the Roles Modifier
- Touch the treasury Safe at all
- Refill its own working capital

---

## If Zodiac Roles is too much lift right now

A materially simpler design that is still far better than the draft — ship this if you
need to move this week:

- **Treasury Safe: 2-of-3 hardware. No agent, no modules.** (Non-negotiable, and this
  alone eliminates the catastrophic case.)
- **Agent gets a plain EOA** (KMS-backed) funded with only the working tranche, topped up
  manually by 2-of-3 on a schedule.
- Loss cap = whatever is in that EOA when it's compromised.

This is cruder — a thief takes the whole tranche outright rather than being reduced to
slippage extraction — but it caps loss at your chosen tranche size and leaves the
treasury and your recovery path untouched. Add the Roles Modifier afterwards to convert
"lose the tranche" into "lose some slippage." **Do not ship the threshold-1 design in the
interim.**

---

## Deployment and operational checklist

1. Deploy on a mainnet fork first. Write adversarial tests that assert the agent's key
   **reverts** on: `transfer` to an arbitrary EOA, a swap with a foreign `recipient`, a
   non-allowlisted token, `addOwner`, `enableModule`, exceeding the allowance. A
   permission scheme you haven't tried to break is a guess.
2. Verify the Roles Modifier's `owner` is Safe B, and confirm the guard/module-hook
   behaviour for your exact Safe contract version before funding.
3. Test the full recovery drill with real hardware, including HW-3's holder, *before*
   funding. Confirm you can move funds with each 2-of-3 combination. Untested recovery is
   not recovery.
4. Fund in stages: small, then the tranche, then the treasury. Watch a full week of live
   agent behaviour at small size.
5. Monitoring, off the agent's own machine: alerts on `ExecutionFromModuleSuccess`,
   `AddedOwner`, `RemovedOwner`, `ChangedThreshold`, `EnabledModule`, `ChangedGuard`, plus
   balance deltas and allowance consumption rate. Route to a channel the trading box
   can't reach.
6. Don't reuse the Safe deployment salt casually across chains — a same-address Safe left
   counterfactual elsewhere can be deployed by someone else with their own owners.
7. Optional for this size, worth it if the treasury grows: a Zodiac **Delay** modifier
   putting a 24–48h timelock on control-plane actions (owner changes, module enablement),
   so even a 2-of-3 compromise or coercion is visible and cancelable before it settles.
8. Write down the incident runbook — who pauses, who holds HW-3, how you reach them at
   3am — and rehearse it once.

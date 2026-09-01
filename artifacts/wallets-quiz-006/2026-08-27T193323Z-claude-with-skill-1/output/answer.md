# Custody review: trading agent, ~$400k on Ethereum mainnet

## Verdict

**Threshold 1 is not acceptable.** Reject the PR as drafted.

A 1-of-2 Safe is not a multisig. It is two independent single points of failure
wired to the same $400k, and one of them is a hot key that signs unattended in a
process that talks to the internet. Whoever gets that key gets the treasury —
the hardware wallet sitting alongside it as an owner does not make the agent's
key harder to steal or the theft smaller.

The design has a second failure that is easy to miss and is worse than the
first: **at threshold 1, the agent's key controls the Safe's own configuration.**
A Safe owner acting alone at threshold 1 can call `removeOwner`, `swapOwner`,
`changeThreshold`, `enableModule`, and `setGuard` on the Safe itself. An attacker
holding the agent's key doesn't have to race you — their first transaction can
remove your hardware wallet and add their own address. The "backup owner in case
the agent's key is lost" is not a durable backup; it is an owner slot the agent's
key can delete. You would find out you'd been locked out of your own treasury at
the same moment you found out you'd been robbed.

So the draft is strictly worse than the mental model behind it. The PR believes
it has "agent convenience plus a human safety net." What it actually has is
"agent convenience," where the agent's key is the root of the whole structure.

### The PR's operational argument is right, and it does not imply threshold 1

"If the agent has to wait on a human co-signer it can't do its job" is true and
worth designing around. But it only argues that *trading* must be unattended. It
says nothing about *principal* being unattended. The draft conflates the two: it
grants the key that must act alone the authority to move everything, because
that was the shortest path to letting it act at all.

Separate the two authorities and both requirements are satisfiable at once. That
is the design below.

## Recommended design

**Authority first, storage second.** Decide what each key may *do*, then decide
where it lives. Wrapping the agent's key in a KMS is worth doing, but a KMS
around a key that can spend the whole treasury is still a design where one stolen
key takes everything.

### Owner set and threshold

**Safe, 2-of-3. The agent's key is not an owner.**

| Owner | Where it lives | How it's used |
|---|---|---|
| **HW-1** — hardware wallet (e.g. Ledger) | Cold. Your daily-carry device, PIN + passphrase. | Your routine signing key for principal moves and config changes. |
| **HW-2** — hardware wallet, **different seed, different vendor** (e.g. Trezor) | Cold, stored separately from HW-1 — different physical location (home safe vs. office vs. bank box). | Second signature for principal moves. Co-signs with HW-1. |
| **HW-3** — recovery signer | Cold, offsite. A third device in a safe deposit box, or a trusted second person / your co-founder / a recovery service. | Only touched when HW-1 or HW-2 is lost or compromised. |

You can operate this alone. A multisig does not require multiple people — one
person holding keys on separate devices meets a threshold of two by themselves,
and an attacker then has to compromise two devices in two locations instead of
one. This is exactly why a single hardware wallet is not the strongest way to
hold a treasury either.

**Non-negotiable detail:** HW-1, HW-2 and HW-3 must be **three independent
seeds**. Three accounts derived from one seed phrase is one secret in three
costumes — it looks like 2-of-3 on-chain and is 1-of-1 in reality. Do not
generate them from the same recovery phrase, and do not store two of the three
phrases in the same place.

**Why 2-of-3 and not 2-of-2:** 2-of-2 gives you the security but no recovery —
lose one device and $400k is bricked forever. The third owner is what actually
answers the PR's stated concern about key loss. It just answers it for *your*
keys, which are the ones whose loss is unrecoverable, rather than for the agent's
key, whose loss is a five-minute rotation.

### How the agent trades without being an owner

The agent's key gets **bounded, scoped, revocable authority** — never ownership.
Pick the tier that matches how the agent actually trades:

**Tier 1 — bounded float (start here).** The Safe holds the $400k. The agent's
hot key is a plain EOA holding a working float you would accept losing outright:
**$10–20k**, i.e. ~3–5% of treasury. The agent trades from the float freely and
at full speed. You top it up from the Safe with a 2-of-3 signature on a cadence
(weekly, or when it drops below a floor), and it sweeps profits back to the Safe.
The blast radius of a stolen agent key is the float balance. Nothing else.

This is simple, has no extra contract surface, and is the right v1 unless the
strategy genuinely needs to size positions above the float.

**Tier 2 — scoped module on the Safe (when the float is too small to trade).**
Keep the Safe 2-of-3 for ownership, and attach one of:

- **Safe Allowance Module** — grants the agent's key a delegate allowance of
  specific tokens with a **per-period cap that auto-resets** (e.g. $25k/day of
  USDC). Well-audited, minimal, easy to reason about. Caps value, not
  destination.
- **Zodiac Roles Modifier** — grants the agent's key a role that can only call
  *specific functions on specific contracts with specific parameters*: e.g. only
  `exactInputSingle` on the Uniswap v3 router, only for the WETH/USDC/your-set
  token list, with recipient forced to the Safe, plus spend caps. More setup,
  much tighter. This is the right tool if the agent needs to touch six figures.

With Roles, the agent can rotate a large notional through whitelisted venues
while being unable to send a single token to an address you didn't authorise.

**Optional, and worth it: an asymmetric kill switch.** Pausing should be far
easier than spending. Give a separate low-value hot key you carry (phone signer,
or your ops laptop) the unilateral ability to pause the module — a Zodiac Guard
or a role that can only call `disableModule`/set a paused flag. **1 signature to
stop, 2-of-3 to resume.** When something looks wrong at 3am you do not want to be
assembling a quorum from two safes in two buildings.

**If the agent must occasionally move principal** on its own initiative, use a
**Zodiac Delay Modifier** rather than raising its authority: the agent queues the
transaction, a cooldown runs (24–48h), and any owner can veto during the window.
Latency is fatal for a trade and irrelevant for a treasury rebalance, so apply it
only to the principal path.

## What this buys you if the agent's key is stolen

Assume the worst realistic case: the trading process is compromised, the attacker
has the agent's signing key and full knowledge of your setup.

**Under the PR's design (1-of-2):** they take $400k in one transaction, and can
remove your hardware wallet as owner in the same block. Total loss, no recovery,
no ability to intervene.

**Under this design:**

- **Loss is capped in advance** at the float ($10–20k) or the current period's
  remaining allowance — not at the treasury.
- **The attacker cannot exfiltrate to an arbitrary address** under Tier 2 with
  Roles: funds can only route through whitelisted calls that return proceeds to
  the Safe. Their realistic attack degrades from "withdraw" to "make bad trades
  inside your whitelist," which is bounded, slow, and noisy.
- **The Safe's owner set and threshold are untouchable.** The agent's key isn't
  an owner, so `removeOwner` / `changeThreshold` / `enableModule` are all closed
  to it. You cannot be locked out of your own treasury.
- **The attacker cannot raise its own limit.** Allowances and role scopes are
  owner-controlled, behind 2-of-3.
- **You revoke without the agent's cooperation.** One signature pauses; 2-of-3
  disables the module or removes the delegate, and the compromised key is inert.
  Recovery is: pause, rotate the key, redeploy the agent, re-grant the role.
  Elapsed time, minutes. Cost, the float.
- **Your own key loss is survivable too** — lose HW-1 and HW-2 + HW-3 still
  reach threshold and can rotate the lost owner out.

Residual risk you should accept knowingly: an attacker with the agent's key can
still burn the float or the current allowance period through deliberately bad
whitelisted trades (e.g. routing into a pool they've positioned in). Size the
per-period cap to the number you're willing to lose in a day, and alert on every
module execution.

## What the agent can and cannot do on its own

**Can, unattended, with no human in the loop:**
- Trade the float / its allowance at full speed, 24/7, no co-signer, no latency.
- Under Roles: swap whitelisted tokens on whitelisted venues, with proceeds
  returning to the Safe.
- Return funds *to* the Safe at any time (deposits are always permitted).
- Pay its own gas from the float.

**Cannot, ever, without 2-of-3 human signatures:**
- Move treasury principal, or send funds to any address outside the whitelist.
- Top up its own float or raise its own allowance / spending cap.
- Add, remove, or swap Safe owners, or change the threshold.
- Enable or disable modules, set or remove the guard, or upgrade the Safe.
- Add a new token, venue, or destination to its own whitelist.
- Approve token allowances to arbitrary spenders.

That list is the design. Write it into the PR description verbatim so the
boundary is documented rather than inferred from code.

## Operational hygiene (do these before mainnet funding)

1. **Any key that has ever appeared in a prompt, a chat, a ticket, or a commit is
   burned.** Rotate it and generate a fresh account — do not fund it on mainnet,
   however briefly. A committed secret is scraped in seconds and stays
   compromised; deleting the commit does not undo it.
2. **`.gitignore` before the first push, not after.** Nothing the agent signs
   with may be baked into the repo — no hardcoded value, no default, no fallback,
   no filled-in `.env.example`. Ship an example with placeholders only.
3. **Agent key storage:** KMS/HSM with non-exportable key material, or at minimum
   an encrypted keystore with the passphrase injected at runtime and never
   written to disk. This narrows *who* can use the key; the scoping above is what
   bounds *what* it can do. You need both, in that order.
4. **Gate every fund-moving action.** Before anything the agent initiates that
   leaves its whitelist — and before every human-signed principal move — print
   the amount, the **checksummed** destination, and the gas cost, then stop until
   a human says yes. Estimate gas and price it live; never from a remembered ETH
   price.
5. **Test the recovery path before funding.** On a fresh Safe with $50, actually
   perform: pause the module with the kill-switch key; rotate a compromised owner
   using 2-of-3; recover from a simulated lost HW-1. An untested recovery
   procedure is not a recovery procedure.
6. **Alert on everything the Safe and the module emit** — `ExecutionSuccess`,
   `ExecutionFromModuleSuccess`, `AddedOwner`, `ChangedThreshold`,
   `EnabledModule`. Any owner or threshold event you didn't personally initiate
   is a five-alarm fire.

### One aside on your hardware wallet

If your intent behind "the agent is the whole point" includes wanting your own
EOA to do multi-step operations atomically (approve + deposit in one shot), you
don't need a new smart-contract wallet for that — an existing EOA can delegate to
contract code and batch in a single transaction via EIP-7702, same address, same
history (live on mainnet since Pectra, May 2025). Note that the delegation
**persists** until explicitly replaced or cleared — it is not scoped to the
transaction that set it, and clearing it requires a new signed authorization.
Irrelevant to the treasury Safe itself, but worth knowing before anyone proposes
migrating addresses to get batching.

## Summary of changes to request on the PR

| | Draft PR | Recommended |
|---|---|---|
| Safe owners | agent hot key + 1 HW | HW-1, HW-2, HW-3 — three independent seeds, three locations |
| Threshold | 1 | 2 |
| Agent's authority | full owner | non-owner: bounded float, or scoped module with per-period cap |
| Loss if agent key stolen | $400k, plus lockout | float / period cap — $10–25k, no lockout |
| Agent trading latency | none | none |
| Revocation | impossible (attacker can evict you) | 1 sig to pause, 2-of-3 to disable |
| Recovery from *your* key loss | none (agent key is root) | 2-of-3 rotates the lost owner out |

The trading speed the PR is protecting costs you nothing here. What changes is
that the key which signs unattended can only ever spend what you've decided to
put at risk.

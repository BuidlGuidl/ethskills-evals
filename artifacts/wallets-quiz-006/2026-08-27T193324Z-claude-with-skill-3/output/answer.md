# Custody review: 1-of-2 Safe for a $400k trading agent

**Verdict: threshold 1 is not acceptable. Do not ship this.** The design as drafted
does not give you a multisig — it gives you a single hot key that owns $400k, with a
Safe wrapped around it for decoration.

---

## 1. What the draft design actually is

Decide authority first, storage second. Where a key lives bounds *who* can use it; it
does not bound *what* it can do. At threshold 1, the agent's hot key can do
**everything the Safe can do**. So the security of the treasury is exactly the security
of one always-online key sitting next to an agent that talks to the internet, parses
untrusted data (price feeds, RPC responses, prompts, tool output), and signs without a
human in the loop. The hardware wallet in the owner set changes none of that.

Two specific consequences the PR does not account for:

**a) A stolen agent key takes the whole $400k in one transaction.** There is nothing to
race, no window, no cap. First transfer, done.

**b) A stolen agent key takes the Safe itself, permanently.** This is the part that
usually gets missed. A Safe's owner-management functions — `addOwnerWithThreshold`,
`removeOwner`, `swapOwner`, `changeThreshold` — are calls the Safe makes to itself, so
they are authorized by the same threshold as any other transaction. At threshold 1, the
attacker signs one call and removes your hardware wallet from the owner set. Your
"backup owner" is evictable by the very key it is supposed to back up. It is not a
safety net; it is a peer with equal power and worse availability.

**c) The stated benefit doesn't require threshold 1.** The PR keeps the hardware wallet
as recovery "in case the agent's key is lost." Key loss is handled fine at threshold 2
— the humans rotate the agent's signer or re-point its module and carry on. Threshold 1
buys recovery you can have anyway, and pays for it with total loss on compromise. That
is a bad trade at any size, and at $400k it is not close.

**d) The latency argument is real but proves a smaller point.** "The agent can't wait
on a human co-signer" is true *for trading*. It is not true for moving principal,
changing who may sign, or raising the agent's own limit — those happen rarely and can
absolutely wait for a human. The correct response to the latency requirement is to give
the agent unattended authority over a **bounded float**, not over the treasury.

---

## 2. The design I would ship

Split the treasury into a **principal vault** the agent cannot touch and a **bounded
operating float** it can spend unattended.

### 2.1 Principal Safe — 2-of-3, all cold, all human

| Owner | Device | Storage | Location |
|---|---|---|---|
| Owner A | Hardware wallet (your existing one) | Cold, own seed | With you, daily-reachable |
| Owner B | Second hardware wallet, **different vendor, independent seed** | Cold | Different physical site (safe / deposit box) |
| Owner C | Third hardware wallet | Cold | Third party you trust (co-founder, counsel) **or** a third site of your own |

Holds ~95% of the treasury (~$380k). The agent's key is **not an owner**.

A multisig does not require multiple people — you can hold A and B yourself on separate
devices and meet the threshold of 2 alone. What it buys is that an attacker now needs
two devices in two places instead of one, which is exactly why a lone hardware wallet is
not the safest way to hold a treasury either.

Non-negotiable: **three independent seeds**. Two devices restored from the same seed
phrase are one key wearing two hats, and reduce this to 1-of-1 without telling you.

2-of-3 rather than 2-of-2 so that a lost, bricked, or destroyed device does not brick
$400k.

### 2.2 Agent authority — a scoped module, not an owner seat

Give the agent one of these two, in order of preference:

**Preferred — Zodiac Roles Modifier on the principal Safe.** The agent's hot key gets a
role scoped to: specific target contracts (your DEX router / vault), specific function
selectors, specific token allowlist, and a rolling spend allowance (e.g. **$20k per 24h**,
~5% of treasury). Funds never leave the Safe except through that narrow path, so you get
capital efficiency without granting transfer rights. Safe's Allowance Module is the
simpler cousin if you only need "spend up to X per period to a whitelisted address."

**Simpler — a separate float account.** The agent trades from its own EOA (or its own
1-of-1 Safe) funded with ~$20k. The 2-of-3 tops it up on a schedule. Dumbest possible
failure mode, easiest to reason about: the blast radius is literally the balance of that
address. Take this one if the Roles config would be rushed — a misconfigured role is
worse than a clean float.

Either way, size the float as *what you would accept losing*, not as *what's
convenient*. 5% is a starting point; tune to your strategy's actual working capital.

### 2.3 Where the agent's hot key lives

Cloud KMS / HSM with a **non-exportable** key, signing exposed as an API the agent
calls; no raw private key on disk, in env vars, in the repo, or in a prompt. Separate
key per environment; testnet key never touches mainnet. Log every signing request with
the payload.

Understand what this does and doesn't buy: KMS stops key *exfiltration*. It does not
stop a compromised agent process from *asking KMS to sign* whatever the attacker wants.
That is precisely why the limit has to be enforced on-chain by the module/float, not in
the agent's own code — the agent's code is the thing you are assuming is compromised.

### 2.4 Hygiene that applies regardless

- A key that ever arrived in a prompt, chat, ticket, or commit is burned: rotate it,
  replace the account, do not fund it on mainnet.
- `.gitignore` before the first push, not after. Nothing the agent signs with is baked
  into the repo — no hardcoded value, default, fallback, or filled-in example.
- Every fund-moving path prints amount, checksummed destination, and live-estimated gas.
  Human-gated actions stop there until a human says yes. Agent-autonomous actions log
  the same line and alert.
- Monitoring on the Safe and the float address: alert on any owner/threshold/module
  change, any transfer over a threshold, and any allowance consumed faster than
  baseline. Detection is what turns "we lost the float" into "we lost part of the float."
- If you want to batch operations from your *existing* personal EOA (top-ups, approvals
  + transfer atomically), you don't need to migrate to a new address — EIP-7702 lets that
  EOA delegate to contract code and batch in one transaction, same address. Note the
  delegation **persists** until explicitly replaced or cleared — it is not scoped to one
  transaction, and an inner call reverting still leaves it standing. Clear it with a new
  signed authorization when you're done; retiring the delegate contract does nothing.

---

## 3. What this buys you when the agent's key is stolen

Assume full compromise: attacker has signing access, the agent process is theirs.

| | Draft (1-of-2) | Recommended (2-of-3 + scoped module) |
|---|---|---|
| Immediate loss | **$400k, one tx** | ≤ float / remaining allowance in the current window (~$20k) |
| Can drain principal? | Yes | No — no authority over it |
| Can raise its own limit? | Yes | No — needs 2 cold signatures |
| Can change owners / threshold? | **Yes — evicts your HW wallet** | No |
| Can move funds off the allowlist? | Yes, anywhere | No — targets and assets are pinned |
| Can you revoke without the agent? | Only by winning a race | Yes — 2 cold sigs disable the module / defund the float |
| Recovery if key is *lost* | Works | Works — rotate signer with 2 sigs |

The headline: **the loss becomes bounded, recoverable, and survivable**, and — because
the attacker never gains owner rights — the humans keep unilateral power to shut the
agent down without its cooperation. Under threshold 1 you have neither. You lose
everything and you lose the ability to stop it.

Worth saying plainly: 95% of the treasury being untouchable is not a partial win. It is
the difference between an incident report and the end of the fund.

---

## 4. What the agent can and cannot do on its own

**Can, unattended, no human:**
- Execute trades against the allowlisted contracts/functions, in allowlisted assets, up
  to the rolling per-window allowance
- Approve allowlisted tokens to allowlisted spenders
- Read state, simulate, price, rebalance *within* the float
- Retry, cancel, and re-submit its own transactions

**Cannot, without 2-of-3 cold signatures:**
- Move any principal out of the Safe
- Send funds to any address not on the allowlist — including its own
- Exceed the per-window allowance, or raise it
- Add, remove, or swap Safe owners; change the threshold
- Enable, disable, or reconfigure modules/guards (including its own role)
- Interact with a contract not on the target allowlist — a new venue is a human decision
- Upgrade the Safe implementation, or set a fallback handler
- Withdraw to fiat / off-ramp

**Humans can, without the agent's cooperation:** revoke the role, disable the module,
defund the float, rotate the agent signer, or pause everything — 2 signatures, agent not
consulted.

---

## 5. Migration order

1. Deploy the 2-of-3 Safe; verify all three devices sign a $1 test tx **before** funding.
2. Confirm the three seeds are genuinely independent and stored in separate locations.
3. Move the treasury in.
4. Stand up the agent's KMS key and its float / Roles config; test on a fork, then with
   a $500 float on mainnet.
5. Run the agent against the small float for a week. Watch the alerts fire.
6. Raise the float to target.
7. Write down the incident runbook: who signs, from where, in what order, to kill the
   agent at 3am. Rehearse it once.

Do not fund the full amount before step 5.

---

## 6. If you disagree

The one line I'd defend hardest: **the entity that signs unattended should never be able
to meet the threshold that guards the principal.** Everything else here — 2-of-3 vs
2-of-4, Roles vs float, 5% vs 8% — is tunable to your latency and capital needs. That
one isn't, and threshold 1 violates it directly.

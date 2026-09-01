# DEPLOY.md — running the rebalancer against a real $400k

This covers what has to exist before you start, and what you own once it's
running. It is written for the actual situation: one person, no second
approver, no one to wake up.

---

## 0. Three things to settle before anything else

**1. A key on a cloud VM that can move $400k *is* $400k of bearer asset.**
There is no other framing. Anyone with root on that VM, anyone who can read
that process's memory, anyone who compromises a dependency in your `npm`
tree, has the treasury. Not "can place bad trades" — has it. §2 is about
shrinking that number from $400k to something you can survive.

**2. Your friction budget is larger than you think.** Rough numbers for
4 trades/day at $30k, in the 0.05% WETH/USDC pool:

| Cost | Per day | Per year |
|---|---|---|
| Pool fee (5 bps on $120k) | $60 | $22k |
| Price impact + slippage (~5 bps) | $60 | $22k |
| Gas (2 tx/trade, ~250k gas, 15 gwei, ETH $4k) | $60 | $22k |
| **Total** | **~$180** | **~$66k** |

That is **~16% of the treasury per year**, before the strategy makes a single
dollar. At 30 gwei and wider spreads it approaches 25%. Re-run this with your
own trade count and gas assumptions before you deploy. If the signal's
expected edge is not comfortably above this line, the correct deployment is
no deployment. Nothing else in this document matters as much as this table.

**3. "Unattended" means unattended until something is already wrong.** The
code is built so that routine problems resolve themselves silently and only
genuinely ambiguous states stop the line. But you are the entire operations
team. §8 defines what is worth a phone call.

---

## 1. What runs, and what it touches

The process is a one-shot: it takes one decision, executes it, exits. Run it
from your signal loop, systemd timer, or cron. It is not a daemon and holds
no state in memory between trades.

```
signal engine → Decision → executeRebalance() → preflight → quote → sign → private relay → confirm → journal
```

### Accounts

| Account | Role | Holds |
|---|---|---|
| **Hot key** (`HOT_KEY_PRIVATE_KEY` / KMS) | Signs every transaction. Recipient of all swap output. | WETH + USDC treasury, plus native ETH for gas |
| **Treasury Safe** (recommended, §2) | Cold custody of the portion not being actively traded | The rest |

The hot key needs **native ETH separately from the treasury**. WETH is not gas.
Keep ~0.5 ETH; the code halts below `MIN_ETH_BALANCE` (0.15) rather than
discovering it's broke halfway through a de-risking trade.

### Contracts

Every address the process can reach. It calls nothing else.

| Contract | Address | How it's used |
|---|---|---|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `balanceOf`, `allowance`, `approve`, `decimals` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | same |
| Uniswap V3 **SwapRouter02** | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | `multicall(deadline, [exactInputSingle])`. **The only address ever granted an allowance.** |
| Uniswap V3 **QuoterV2** | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | Simulated only — never appears in a signed transaction |
| Chainlink **ETH/USD** | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | `latestRoundData` — independent price reference |
| WETH/USDC 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | Routed through, not called directly |
| WETH/USDC 0.30% pool | `0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8` | Fallback tier; the better quote wins |

**Verify all seven on Etherscan yourself before first run.** A substituted
address in a config file is the cheapest attack on this entire system, and
it looks exactly like the real thing in a diff.

### Approval policy

Approvals are **exact-amount, per-trade**. `approve(router, amountIn)`, then a
swap that consumes exactly `amountIn`, leaving the allowance at zero. There is
never a standing allowance against the treasury.

This costs an extra transaction (~46k gas, ~$4) per trade. The alternative,
infinite approval, means any future SwapRouter02 compromise drains everything
the hot key holds, forever, with no further action from you. For $4 a trade
that is not a close call.

*Optimization worth taking later:* Uniswap's **Permit2** (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) with the Universal Router
gets you an off-chain-signed, time-boxed, amount-bounded allowance and drops
back to one on-chain transaction — both the safety and the gas. It's a larger
change (different router, different calldata) so it is not what ships in
week one.

---

## 2. Custody: the decision that actually matters

Pick one before funding. This is the highest-leverage choice you will make.

### Option A — Hot EOA holds everything *(what the code does by default)*
Simplest. Blast radius on VM compromise: **$400k**.
Acceptable only as a temporary state during canary testing with small size.

### Option B — Working float + Safe reserve ⭐ **recommended for this week**
Treasury Safe (hardware-wallet signer) holds ~$320k. Hot key holds an ~$80k
working float. The agent rebalances the float; you top up or sweep manually
on a schedule that suits you.

Blast radius: **$80k.** You accept that the *overall* treasury ratio tracks
your target approximately rather than exactly, and that you do a manual
rebalance occasionally. That is a real cost. It is much smaller than the one
it removes, and it is deployable today with no new code.

### Option C — Safe + constrained trading module *(correct end state)*
Treasury stays in the Safe. A Safe Module exposes exactly one entry point —
`swapExactInput(tokenIn, tokenOut, amountIn, minOut)` — with allowlists
(WETH/USDC only, SwapRouter02 only) and per-trade / per-day caps enforced
**on-chain**. The agent key is the module's authorized caller.

Blast radius: a stolen key **cannot transfer funds out at all.** The worst it
can do is churn the treasury through Uniswap, bleeding fees and slippage per
round trip — expensive, bounded, loud, and something your monitoring will
catch within a trade or two.

**This module is not in this repo.** It is ~150 lines of Solidity and it needs
review before it holds $400k. Plan it for week two or three, not week one.

*(EIP-7702 makes a comparable policy layer possible directly on the EOA without
a Safe. As of today the tooling around it is still thin for this use case;
worth revisiting, not worth betting the treasury on right now.)*

### Key material

Do not ship a raw private key in `.env` on a long-lived VM. Use **AWS KMS** or
**GCP KMS** with a secp256k1 signing key and a viem custom account that calls
`Sign` instead of holding the secret. The key never exists on the box.

**Understand precisely what this buys you.** KMS prevents key *exfiltration* —
an attacker cannot steal the key and use it later, from anywhere, forever.
It does **not** prevent key *use*: while they have the VM, they can ask KMS to
sign whatever they want. KMS turns a permanent, portable compromise into one
scoped to the duration of their access. That is a large improvement and it is
not the same as safety.

Only on-chain constraints (Option C) bound what a signature can *do*. KMS and
Option C solve different halves of the problem; ship both eventually.

---

## 3. Pre-deploy checklist

- [ ] All seven contract addresses verified on Etherscan against §1
- [ ] `npm ci` from a committed lockfile — never `npm install` on the VM
- [ ] `npx tsc --noEmit` clean
- [ ] Dedicated RPC endpoint with a real SLA (not a free public one — it will
      rate-limit you mid-trade and misreport `pending` nonces)
- [ ] Private submission endpoint reachable from the VM (§5)
- [ ] `state/` on a **persistent volume**. The journal is the only record of
      in-flight transactions; losing it on an ephemeral disk is how you
      double-trade after a reboot.
- [ ] Journal directory backed up off-box (you also need it for taxes — §9)
- [ ] Hot key funded with ~0.5 ETH for gas, separate from treasury
- [ ] Fork test passes (below)
- [ ] Canary: **three real trades at `MAX_TRADE_NOTIONAL_USD=2000`**, inspected
      by hand on Etherscan, before raising any limit
- [ ] Limits in §4 reviewed against your own numbers, not the defaults
- [ ] You have personally executed the §7 halt and drain procedures once, on
      the fork, before you need them at 3am

### Fork test

```bash
anvil --fork-url $RPC_URL --fork-block-number <recent> &

# fund and seed the test key with WETH/USDC via anvil_setBalance / setStorageAt,
# then point the bot at the fork:
RPC_URL=http://127.0.0.1:8545 \
SUBMIT_RPC_URL=http://127.0.0.1:8545 \
npx tsx rebalance.ts WETH_TO_USDC 5
```

Specifically confirm on the fork, because these are the paths that only
execute when something has already gone wrong:

1. A normal swap fills and the journal shows `intent → broadcast → mined`
2. `touch state/HALT` blocks the next run
3. Deleting `state/journal.jsonl` mid-flight does **not** silently re-trade
4. An oversized decision is rejected by the notional cap, exit code 0
5. A manipulated pool (swap hard against the pool first) trips the
   pool/oracle deviation halt rather than executing

---

## 4. Limits

Defaults live in `CONFIG` and are all overridable by env var (`.env.example`).
The ones worth thinking about rather than accepting:

| Setting | Default | What it's for |
|---|---|---|
| `MAX_TRADE_NOTIONAL_USD` | 60000 | Ceiling on a single mistake |
| `MAX_DAILY_NOTIONAL_USD` | 250000 | Ceiling on a bad *day* — a signal bug that flips sign every cycle bleeds you through fees, and this is what stops it |
| `MAX_TRADES_PER_DAY` | 12 | Same, by count |
| `MAX_POOL_ORACLE_DEVIATION_BPS` | 100 | Refuse to trade at all when pool and Chainlink disagree >1%. Catches manipulation, depegs, and your own unit bugs |
| `MAX_SLIPPAGE_BPS` | 30 | Tolerance on the live quote |
| `ORACLE_FLOOR_BAND_BPS` | 90 | Independent floor from Chainlink. Calibrated to converge with the quote floor at the edge of tolerable drift — loosen it and it stops binding at all |
| `MAX_PLAN_AGE_SEC` / `MAX_PLAN_DRIFT_BPS` | 45 / 25 | Abandon a quote that went stale between planning and signing |
| `MAX_BASE_FEE_GWEI` | 80 | Routine rebalancing isn't worth any price. **Raise deliberately if you need a de-risking trade through a gas spike** — this limit does not know the difference between "rebalance" and "get me out" |
| `MAX_AVG_SLIPPAGE_BPS` | 60 | Rolling execution-quality breaker over the last 10 fills |

Two behaviors to know about:

- **Daily caps count broadcasts, including ones that later reverted or were
  cancelled.** Deliberately conservative: it errs toward under-trading. On a
  day with several failures you may hit the cap earlier than expected.
- **The rolling slippage breaker measures fills against Chainlink, not against
  our own quote.** A quote from a manipulated pool would validate itself; the
  oracle won't. It needs 10 fills before it can fire.

---

## 5. Submission path

Transactions go out over **Flashbots Protect** (`SUBMIT_RPC_URL`), not the
public mempool. A $30k WETH/USDC swap with a visible `amountOutMinimum` is a
standing invitation to a sandwich; private submission removes the frontrunning
surface entirely. Reads still go through your own node — two transports, on
purpose.

The tradeoff is inclusion latency. A private transaction can take several
blocks, or not land at all in a quiet period. The code handles this: if it is
not included within `INCLUSION_TIMEOUT_SEC` (300s), it replaces its own nonce
with a 0-value self-send over the **public** RPC at a fee that will definitely
get mined, so the next cycle starts from a known-clean nonce.

The cancel and the original race for the same nonce. Exactly one lands, and
`cancelNonce()` checks which before reporting back — getting that backwards
means trading the same $50k twice.

---

## 6. Exit codes

The whole operational contract is in these three:

| Code | Meaning | Do |
|---|---|---|
| `0` | Executed, or rejected for a normal reason (cap hit, quote stale, gas too high) | Nothing. Not an incident. |
| `1` | **HALT** — halt file written, trading stops until you clear it | **Page.** |
| `75` | Lock held, another run in flight | Nothing, unless it persists |

A `HALT` is deliberately sticky: it writes `state/HALT`, and every subsequent
run refuses to start until a human deletes it. The conditions that trigger it
are ones where continuing to trade could compound the problem — stale oracle,
pool/oracle divergence, decimals mismatch, gas exhaustion, systematically bad
fills, or an in-flight transaction whose fate is unknown.

---

## 7. Runbook

**Stop trading now**
```bash
echo "manual stop $(date -Is)" >> state/HALT
```
Takes effect at the next cycle. It does not touch anything already in flight.

**Resume**
```bash
rm state/HALT   # only after you have read the last journal entries
```

**A transaction is stuck**

Normally handled automatically. To do it by hand, send a 0-value self-transfer
at the **same nonce** with a priority fee at least 10% above the original, over
a public RPC. `cancelNonce()` in `rebalance.ts` is the reference.

**Journal says `orphaned transaction ... neither mined nor superseded`**

The process found a broadcast it cannot resolve and halted rather than guess.
Do not clear the halt until you have resolved it:

1. Look up the hash on Etherscan.
2. Mined → append a matching `mined` entry to the journal, clear the halt.
3. Genuinely gone (nonce moved past it) → append a `cancelled` entry.
4. Still pending → cancel the nonce by hand, then append `cancelled`.

**Get the money out**

Have this rehearsed and ready to paste *before* you need it — you will want it
during a market event, not during a calm afternoon:

```
1. echo "drain" >> state/HALT
2. Confirm no pending nonce on the hot key
3. Transfer WETH + USDC from the hot key to the Safe (hardware wallet, manual)
```

---

## 8. Monitoring

**Page on:**
- Exit code `1` / `state/HALT` appearing
- Native ETH on the hot key below 0.25 (halt floor is 0.15 — you want warning,
  not a stop)
- Hot key balance changing when the bot did not trade *(this is the theft
  alarm; it should be the loudest thing you have)*
- No successful cycle in N hours, where N is your own tolerance

**Log, review weekly, do not page:**
- Rejections from caps or gas ceilings
- Per-trade realized slippage in bps
- Cumulative gas spend against the §0 budget

The theft alarm deserves setting up properly: watch the hot key's ERC20
Transfer events from an **independent** service (an Etherscan/Alchemy webhook,
not this process — a compromised box will not report its own compromise) and
alert on any outbound transfer the journal does not explain.

---

## 9. What you are on the hook for, ongoing

Once this is live and you are asleep:

**Everything is final.** No chargebacks, no counterparty, no support line. A
bad trade, a wrong config value, a fat-fingered decimal — settled in twelve
seconds and permanent.

**The agent trading badly is not an error it will report.** Every guard here
catches *mechanical* failure: stale prices, manipulated pools, stuck nonces,
sizing bugs. None of them know whether the signal is any good. A strategy that
quietly loses 2%/month executes perfectly and exits 0 every time. That is your
job to watch, and it is the failure mode most likely to actually cost you.

**Dependency supply chain.** `viem` and its tree can sign transactions. A
malicious release is a direct path to the treasury. Commit the lockfile,
`npm ci` only, review every dependency bump, and consider vendoring.

**Infrastructure you don't control.** RPC provider outages, Flashbots
downtime, VM host failure. Decide in advance whether "cannot trade for six
hours" is acceptable to you, and if it isn't, build the fallback before you
need it.

**Chainlink feed lifecycle.** Feeds do get migrated and deprecated. The code
halts on a stale answer, which is the right failure — but you need to notice
and update the address rather than sit halted for a week.

**Uniswap liquidity migration.** V3 WETH/USDC is deep today. As liquidity moves
to newer venues, your fills degrade gradually and silently. The rolling
slippage breaker will eventually fire; watching the per-trade bps trend tells
you months earlier.

**Key rotation.** Have a written procedure for rotating the hot key, and run
it on a schedule rather than for the first time during an incident.

**Taxes.** In most jurisdictions **every swap is a taxable disposal**. At a
handful of trades a day that's ~1,500 taxable events a year, each needing cost
basis. `state/journal.jsonl` is your primary record — back it up off-box, and
talk to an accountant *before* the tax year ends, not after.

**Regulatory.** Trading your own treasury with your own capital is generally
the simplest case. It stops being simple the moment anyone else's money is in
it. If you ever take outside capital into this strategy, get advice first —
the rules change completely and they change retroactively for what you already
did.

---

## 10. Failure modes

| Failure | Handling | Your exposure |
|---|---|---|
| Sandwich attack | Private submission + dual price floors | Bounded by `amountOutMinimum` |
| Manipulated pool | Pool/oracle deviation gate → HALT | None; refuses to trade |
| Stale Chainlink | Age check → HALT | None |
| Quote stale by signing time | Plan freshness re-check → reject, requote | None |
| Transaction stuck | Nonce replacement after 300s | One cycle skipped |
| Crash mid-broadcast | fsync'd journal + `reconcile()` on restart | None if `state/` persisted |
| Two concurrent runs | Lock file, exit 75 | None |
| Out of gas ETH | Balance floor → HALT | Cannot trade until topped up |
| Signal bug flipping every cycle | Daily notional + count caps | Capped at ~$250k of churn ≈ $250 of fees |
| Chain reorg | 3 confirmations before settled | Low; deep reorgs are not realistically survivable in-process |
| **Hot key compromise** | **Nothing in this code** | **§2 — this is the whole reason §2 exists** |
| **Strategy is simply wrong** | **Nothing in this code** | **Unbounded. Yours to watch.** |

The last two rows are the honest ones. Every other line is a problem this
code solves. Those two are problems only your architecture (§2) and your
judgment can solve, and between them they account for essentially all of the
realistic ways you lose the $400k.

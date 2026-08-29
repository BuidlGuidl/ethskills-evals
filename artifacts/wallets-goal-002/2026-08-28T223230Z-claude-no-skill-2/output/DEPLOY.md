# DEPLOY.md — running `rebalance.ts` against a real $400k on Ethereum mainnet

Two parts:

- **Part 1 — What must exist before you turn this on.** A checklist. Every item is
  load-bearing; the ones marked **BLOCKING** will lose you money if skipped.
- **Part 2 — What you are on the hook for once it is running.** The residual risk
  that no amount of code removes, and the operational duties that come with it.

---

# The one design decision everything else follows from

You asked for an unattended agent with nobody approving individual trades. That is a
reasonable thing to want, and it is achievable. But it forces a choice about what the
machine is *able* to do, because you will not be there to stop it.

The wrong shape — and the default shape almost everyone builds — is an EOA on the VM
holding $400k, with the code deciding what's allowed. Then the private key file *is*
the treasury. Every bug, every dependency, every sshd CVE, every leaked `.env` in a
backup is a total loss. No amount of care in `rebalance.ts` changes that, because an
attacker with the key does not run `rebalance.ts`.

The right shape, and what this deploy assumes:

> **The money lives in a Safe. The VM holds a key that can only ask the Safe to make a
> WETH↔USDC swap that pays back into the Safe, up to a spending allowance, and can do
> nothing else. The limits are enforced on-chain, by the Zodiac Roles modifier, not by
> the code you are about to run.**

The practical difference: with the wrong shape, a compromised VM costs you $400,000.
With this shape, it costs you at most one allowance period of slippage — call it a few
thousand dollars — because the attacker's best available move is to repeatedly swap
your WETH for your USDC at bad prices, and even that is metered and capped by contracts
you cannot be argued out of.

`rebalance.ts` has plenty of its own checks — oracle deviation, slippage bounds, daily
notional, rate limits. **Treat all of them as convenience, not protection.** They live
on the machine you are defending against. The Roles allowance is the only limit that
holds when everything else has failed.

If you skip the Safe and run `EXECUTION_MODE=eoa` with real size, understand you have
opted out of the entire safety argument. That mode exists for forks and testnets.

---

# Part 1 — Before you turn it on

## 1.1 Address verification — **BLOCKING**

A wrong address is unrecoverable and a config typo is far likelier than a contract bug.
The addresses hardcoded in `rebalance.ts` were verified against mainnet on 2026-08-28:

| What | Address | How it was checked |
|---|---|---|
| WETH9 | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `symbol()=="WETH"`, `decimals()==18` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `symbol()=="USDC"`, `decimals()==6` |
| SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | `WETH9()` and `factory()` match |
| QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | `WETH9()` and `factory()` match |
| Chainlink ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | `description()=="ETH / USD"`, `decimals()==8` |
| Uniswap V3 factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | referenced by both periphery contracts |
| WETH/USDC 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | `token0`/`token1`/`fee()==500` |
| WETH/USDC 0.30% pool | `0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8` | `token0`/`token1`/`fee()==3000` |

Do not take that table on faith, including from me. Re-derive them yourself from
Uniswap's and Chainlink's own documentation, and confirm on Etherscan that each is
verified and is the contract you think. Then:

```bash
npm run preflight    # re-runs every one of those assertions against your RPC
```

`assertWiring()` runs on **every cycle**, not just preflight. It costs a few reads and
it is the difference between a typo being caught immediately and being discovered by
your accountant.

## 1.2 The Treasury Safe — **BLOCKING**

Deploy a Safe at <https://app.safe.global> on Ethereum mainnet.

- **Owners: 3. Threshold: 2.** Three separate hardware wallets (e.g. two Ledgers +
  one Trezor — different vendors, so one vendor's firmware bug is not fatal).
- **None of the owner keys ever touch the VM, a password manager, or a cloud drive.**
  Seed phrases on paper or steel, in two physically separate locations.
- You are a solo builder, so all three owners are you. That is fine for security and
  **catastrophic for availability**: if you are hit by a bus, or hospitalised for a
  week during a drawdown, the treasury is frozen. Decide now, deliberately, whether
  the third owner is a lawyer, a co-signer you trust, or a documented recovery
  procedure in a sealed envelope. Write down what you chose and why.
- Test recovery *before* funding: move the Safe's ownership around using only your
  backup seeds, from a machine that has never seen the primaries.

Fund it with WETH and USDC. **Not ETH-the-native-asset** — this strategy trades WETH.
Any native ETH sent to the Safe will sit there uncounted by `readPosition()`.

## 1.3 The Zodiac Roles modifier — **BLOCKING**

This is the piece that makes an unattended hot key acceptable. Deploy Roles v2 as a
module on the Safe via the Zodiac app (<https://app.safe.global> → Apps → Zodiac) or
`zodiac-roles-sdk`. Verify after deployment:

```
Roles.avatar()  == your Safe
Roles.target()  == your Safe
Roles.owner()   == your Safe        # so changing permissions needs 2-of-3 owner sigs
```

`rebalance.ts` asserts the first two on every cycle and refuses to run otherwise.
Set `owner()` to the Safe itself. If you point it at a hot key "for convenience", you
have handed that key the ability to rewrite its own permissions, and the whole scheme
collapses back to a single point of failure.

### The permission to grant

Create one role (e.g. `roleKey = keccak/bytes32 of "REBALANCER"`) with exactly one
member: the agent EOA. Scope it to **one target, one function, with every parameter
pinned**:

| | |
|---|---|
| Target | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` (SwapRouter02) |
| Function | `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))`, selector `0x04e45aaf` |
| `tokenIn` | one of {WETH, USDC} |
| `tokenOut` | one of {WETH, USDC} |
| `fee` | one of {500, 3000} |
| `recipient` | **equal to the Safe address** |
| `amountIn` | metered by an allowance (below) |
| `value` | 0 |
| `operation` | `Call` only — **never** `DelegateCall` |

Everything else on that target: denied. Every other target: denied.

The `recipient` pin is the single most important constraint in this document. Without
it, a compromised agent key swaps your treasury into its own address, and the fact that
"it can only trade" protects nothing.

**Do not grant the role `approve()` on WETH or USDC.** Approvals are a one-time owner
action (§1.4). A role that can approve can approve an attacker.

**Do not grant `DelegateCall`.** A delegatecall from the Safe is arbitrary control of
the Safe. It is not a swap permission, it is a master key.

### The allowance — this is your real risk limit

Roles v2 lets you attach a consumable, time-refilling allowance to the `amountIn`
parameter. This is the number that determines your worst possible day. Pick it as
"what am I willing to lose to a fully compromised VM", not as "what does my strategy
need".

Two gotchas that are easy to get wrong and expensive to discover later:

1. **You need two separate allowances, one per direction.** The allowance meters the
   raw `amountIn`, and WETH has 18 decimals while USDC has 6. One shared counter is
   meaningless. Scope `tokenIn == WETH` and `tokenIn == USDC` to different allowance
   keys.
2. **Size the refill period against a griefing loop, not against a single trade.** An
   attacker with the key will swap back and forth, burning the 0.05% pool fee plus
   slippage each round trip. At $50k per swap and ~5–10bps of round-trip cost, a daily
   allowance of $200k funds roughly $100–200/day of bleed. That is a tolerable, alerting,
   survivable loss. A daily allowance of $2M is not.

A concrete starting point, matching the code's defaults:

```
tokenIn = WETH : allowance 82 WETH   ( ~$200k ),  refill 82 WETH  every 86400s
tokenIn = USDC : allowance 200000e6  ( $200k ),   refill 200000e6 every 86400s
```

Keep these in sync with `MAX_DAILY_NOTIONAL_USD` in the config, and understand the
asymmetry: the env var is a suggestion to a program, the allowance is a fact about the
chain.

## 1.4 Token approvals — **BLOCKING**

SwapRouter02 must be allowed to pull the input token from the Safe. Do this **once,
from the Safe owners** (Safe UI → new transaction → contract interaction), not from the
agent:

```
WETH.approve(0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45, <amount>)
USDC.approve(0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45, <amount>)
```

On `<amount>`, pick your poison honestly:

- **Unlimited** (`type(uint256).max`): never breaks, and you have accepted that a bug
  in SwapRouter02 drains the Safe. That contract has held large approvals for years
  without incident, and this is what essentially everyone does.
- **Bounded** (say 2× your daily allowance): caps that tail risk, and creates a new
  operational duty — when it runs down, the agent stops trading and you must sign a
  top-up from cold storage. `runGuards()` fails closed with the exact shortfall in the
  log, so it will not trade badly, it will just stop.

I would take **bounded, refreshed monthly**, because you already have a hardware-wallet
ritual for this Safe and a predictable monthly signing is cheaper than an unbounded
counterparty exposure. But unlimited is a defensible choice; pick one on purpose.

## 1.5 The agent key

```bash
# On the VM, offline, once. Never on your laptop, never in a shell with history on.
node -e "const{generatePrivateKey,privateKeyToAccount}=require('viem/accounts');const k=generatePrivateKey();console.error(privateKeyToAccount(k).address);console.log(k)"
```

- Fund it with **~0.3 ETH and nothing else**. It is a gas wallet. Do the arithmetic
  rather than trusting a round number: a rebalance through Safe + Roles costs roughly
  250k gas, so at 5 gwei that is ~0.00125 ETH per trade and 0.3 ETH lasts ~240 trades
  (about two months at 4 trades/day) — but at 30 gwei the same 0.3 ETH is barely two
  weeks. Base fee was ~0.05 gwei when this was written, which tells you nothing about
  what it will be in a busy month. Watch the runway in the digest and top up on a
  schedule rather than on an alert.
- Never send treasury funds to it. Nothing in `rebalance.ts` ever does.
- Store it as a systemd credential or in the cloud provider's secret manager — not in
  a `.env` that lands in a snapshot, a backup, or `git status`.
- Write down its address. You will need it for the role membership and for monitoring.

Rotation: this key is designed to be disposable. Rotating it is `add new member to
role` + `remove old member`, two owner signatures, no fund movement. Do it if you ever
have reason to doubt the VM, and do it on a schedule (say quarterly) so the procedure
is one you have actually practised rather than one you read about here.

## 1.6 RPC providers

- `RPC_URL` — a paid, authenticated endpoint (Alchemy, QuickNode, or your own node).
  Not a public endpoint. Public RPCs rate-limit, serve stale state, and can be
  observed. Everything depends on this: prices, balances, gas estimation, receipts.
- `RPC_URL_BACKUP` — a **different provider**, not a second key from the same one.
  `assertWiring()` cross-checks head block numbers and refuses to run on >5 blocks of
  disagreement. A provider silently serving stale state is a real and quiet failure
  mode; you want to fail closed on it, not trade on it.
- `RELAY_URL` — `https://rpc.flashbots.net/fast` (default) or
  `https://rpc.mevblocker.io/fast`. Both were live and answering `eth_chainId` on
  2026-08-28.

**Why private submission is not optional here.** A $10–50k WETH/USDC swap broadcast to
the public mempool is a textbook sandwich target. `amountOutMinimum` caps that loss at
your 50bps tolerance, so it is bounded — but bounded at 50bps *per trade*, several
trades a day, forever. That is a standing tax of a few thousand dollars a year paid to
searchers for no reason. Private submission avoids it outright.

**The operational consequence you must internalise:** transactions sent to a private
relay **never enter your node's mempool**. `eth_getTransactionCount(..., 'pending')`
will not count them. Anything that derives a nonce that way will hand you a nonce you
have already used, and you will double-trade. This is why `nextNonce()` takes the max
of the on-chain `latest` count and the journal's own high-water mark, and why the
journal is fsync'd before signing. If you refactor the submission path, this is the
invariant to preserve.

## 1.7 Configuration

Copy to `/etc/rebalancer.env`, mode `0600`, owned by the service user.

```bash
EXECUTION_MODE=roles
RPC_URL=https://...            # paid provider
RPC_URL_BACKUP=https://...     # a DIFFERENT paid provider
RELAY_URL=https://rpc.flashbots.net/fast

SAFE_ADDRESS=0x...
ROLES_MODIFIER_ADDRESS=0x...
ROLE_KEY=0x...                 # bytes32
AGENT_PRIVATE_KEY=0x...        # inject as a systemd credential, not literally here

STATE_DIR=/var/lib/rebalancer
ALERT_WEBHOOK_URL=https://...

TARGET_WETH_BPS=5000           # 50/50
REBALANCE_BAND_BPS=300         # act past 3% drift
MIN_TRADE_USD=10000
MAX_TRADE_USD=50000
MAX_DAILY_NOTIONAL_USD=200000  # keep in sync with the on-chain allowance
MAX_TRADES_PER_DAY=8
MIN_SECONDS_BETWEEN_TRADES=900

MAX_SLIPPAGE_BPS=50
MAX_ORACLE_DEVIATION_BPS=200
MAX_BASE_FEE_GWEI=80
MAX_GAS_COST_BPS=30
MIN_AGENT_ETH=0.05
```

Notes on the ones that are actually judgement calls:

- **`REBALANCE_BAND_BPS`** is your churn/tracking tradeoff. At 300bps on $400k you act
  on ~$12k of drift and trade a handful of times on a volatile day, which matches what
  you described. Tighten it and you pay fees to track a target more closely; widen it
  and you drift. There is no correct answer, only a cost you have chosen.
- **`MAX_SLIPPAGE_BPS=50`** is the ceiling on what one trade can lose to execution. On
  the 0.05% pool a $50k clip should fill within a few bps, so 50 is loose enough never
  to bind in normal conditions and tight enough to matter in bad ones. It is derived
  from the QuoterV2 result, which prices real depth — **not** from the pool's spot
  price, which would make it a no-op against a manipulated pool.
- **`MAX_ORACLE_DEVIATION_BPS=200`** is the manipulation trip-wire: the trade aborts if
  the pool quote and Chainlink disagree by more than 2%. On a live check today, a
  19.7 WETH sell quoted 4bps from the oracle, so the normal reading is two orders of
  magnitude inside the limit. If this ever fires, something is genuinely wrong — the
  pool has been pushed, or the oracle has frozen. Both mean *do not trade*.
- **`MAX_BASE_FEE_GWEI=80`** — the trade waits out fee spikes. Rebalancing is never
  urgent; there is no drift worth paying a congested block for.

## 1.8 The VM

- Dedicated host. Nothing else on it. No web server, no other project, no Docker socket
  exposed. This box's entire job is to hold a key and sign swaps.
- SSH: keys only, `PasswordAuthentication no`, `PermitRootLogin no`, fail2ban,
  firewall default-deny inbound. Unattended security upgrades on.
- Run as a non-root service user. `STATE_DIR` owned by it, mode `0700`.
- **Supply chain — take this seriously.** Compromised npm packages stealing keys from
  crypto projects is not hypothetical, it is the most common way small teams get
  drained. Commit `package-lock.json`. Install with
  `npm ci --ignore-scripts` (`--ignore-scripts` blocks the postinstall hook, which is
  the usual delivery mechanism). Pin exact versions. **Never `npm update` on the
  production box.** Build elsewhere, review the lockfile diff line by line, ship an
  artifact.
- Egress firewall: allow only your RPC providers, the relay, and your alert webhook.
  A key exfiltration needs somewhere to go; do not provide one.

Run it on a timer, not a `while(true)` — every cycle then starts from clean on-chain
state and the process cannot rot:

```ini
# /etc/systemd/system/rebalancer.service
[Unit]
Description=WETH/USDC treasury rebalancer
After=network-online.target

[Service]
Type=oneshot
User=rebalancer
WorkingDirectory=/opt/rebalancer
EnvironmentFile=/etc/rebalancer.env
ExecStart=/usr/bin/npx tsx rebalance.ts
TimeoutStartSec=600
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/rebalancer
```

```ini
# /etc/systemd/system/rebalancer.timer
[Unit]
Description=Run the rebalancer every 5 minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=30s
[Install]
WantedBy=timers.target
```

`Type=oneshot` with `OnUnitActiveSec` means a slow cycle delays the next one rather
than racing it. The lockfile in `acquireLock()` is the backstop for when that
assumption breaks (a manual run, a botched restart) — verified: a second concurrent
process refuses to start rather than sharing a nonce.

## 1.9 Monitoring — the part that makes "unattended" honest

Unattended does not mean unobserved. You said you will not be woken for routine
rebalancing, and you should not be. But something has to be watching, because the
failure you care about is *silence*, and silence does not send alerts.

**Page me (phone, 3am):**
- `HALT` file created — the agent stopped itself and will not restart on its own.
- Nonce consumed by a transaction the agent did not sign. This is the
  key-compromise signal. Code halts automatically; you must respond.
- A transaction reverted on-chain.
- Roles simulation failed — permissions changed underneath you.
- RPC providers disagree on the head block.
- **No successful cycle in 60 minutes.** Dead-man's switch. Set this up in your
  monitoring system, not in this repo — a process cannot alert you about its own
  absence. This is the single most valuable alert you will configure.

**Digest (daily email, look at it with coffee):**
- Every executed trade: size, price, slippage vs quote, gas.
- Portfolio drift from target.
- Agent ETH balance and projected runway.
- Guard rejections, grouped by reason. A guard firing repeatedly is a config problem,
  not a market condition.

**Never page:** a routine rebalance, a hold, a single skipped cycle.

The webhook in `alert()` posts a `{text}` JSON body — compatible with Slack and
PagerDuty inbound webhooks as-is. Route `critical` to something that rings.

## 1.10 Test plan — do all of it, in order

1. **Fork.** `anvil --fork-url $RPC_URL`. Fund a test Safe. Deploy Roles. Run real
   cycles against forked mainnet state. Deliberately break things: revoke the
   allowance mid-run, exhaust the role allowance, `kill -9` the process between the
   journal write and the signature, start two copies at once. Confirm each one fails
   closed and that the next run reconciles instead of re-trading.
2. **Verify your Roles scoping is actually tight** by trying to abuse it. From the
   agent key on the fork, attempt: a swap with `recipient` set to the agent; a
   `transfer` of WETH out of the Safe; a swap of a token that is not WETH or USDC; a
   `DelegateCall`. Every one must revert. If any succeeds, your role is misconfigured,
   and you have learned it for free instead of for $400k.
3. **Mainnet, dry run.** Point at the real Safe with real balances,
   `npx tsx rebalance.ts --dry-run` for 48 hours. It reads, decides, prices, simulates,
   and signs nothing. Read the logs and ask whether you agree with every decision it
   wanted to make.
4. **Mainnet, small.** Fund the Safe with **$5,000**. Set `MIN_TRADE_USD=100`,
   `MAX_TRADE_USD=500`, and set the on-chain allowance to match. Run for a week.
   Reconcile the journal against Etherscan by hand, every trade.
5. **Ramp.** $50k for a week. Then $400k. Raise the on-chain allowance at each step,
   deliberately, as a 2-of-3 signature — which is exactly the friction you want on the
   number that caps your worst day.

Do not compress this because it is "this week". The ramp is the only part of this
process that tests the thing you cannot test any other way: your own operational
response, on a real system, with real money, at a size where being wrong is survivable.

---

# Part 2 — What you are on the hook for

## 2.1 The uncomfortable summary

You are the counterparty, the exchange, the risk desk, the SRE, and the incident
response team. There is no support line. There are no chargebacks, no reversals, no
insurance, and no regulator who will make you whole. A transaction that executes is
final in twelve seconds and final forever.

Below is what actually remains after everything in Part 1 is in place. I have tried to
be honest about which of these you can do something about.

## 2.2 Residual risk, by what it costs you

**Total loss of the treasury ($400k)** — after Part 1, this requires compromising
2-of-3 hardware wallets, or a critical bug in the Safe or Roles contracts, or a bug in
SwapRouter02 if you granted unlimited approval. The first is on you and your physical
security. The others are code you did not write, that secures billions of dollars, and
that you are trusting because the alternative is not building this at all. That is a
legitimate trade, but it is a *trade*, and you are the one making it. **You cannot
engineer this to zero. You can only decide it is acceptable.**

**One allowance period of griefing (~$100–200/day at the suggested settings)** — the
realistic worst case from a compromised VM. An attacker with the agent key swaps back
and forth, burning fees. Bounded by the Roles allowance, visible in your daily digest
within hours, stopped by revoking the role. **This is what the Safe architecture buys
you: it converts your worst day from "total loss" into "an annoying week".**

**Slippage and MEV (a few bps per trade)** — bounded by `amountOutMinimum` and largely
avoided by private submission. This is a cost of doing business, not a risk. Track it
in the digest; if realised slippage drifts consistently toward your 50bps limit,
something has changed and you should look.

**Strategy loss (unbounded, and the one people forget)** — nothing in this document
protects you from a 50/50 rebalancer being the wrong thing to do. Systematically
rebalancing into a downtrend sells winners and buys losers. Every safety mechanism here
concerns *execution*: it ensures you get the trade you asked for. Whether you should
have asked for it is entirely on you, and it is by far the largest number in this
section. The code has no opinion.

**Counterparty risk you cannot mitigate at all:**
- **USDC is centrally controlled.** Circle can freeze or blacklist any address,
  including your Safe, and the token contract is upgradeable. If it happens you hold an
  unspendable balance and there is no technical recourse. This is the price of the
  stable leg.
- **Chainlink is a hard dependency.** If the ETH/USD feed stalls past its 3600s
  heartbeat, `readOracle()` throws and the agent stops trading. That is deliberate —
  fail closed — but it means a third party's outage can halt your strategy. Know that
  it is a design choice and that it is the right one.
- **Uniswap V3 pool liquidity** can thin out. The guards check for zero in-range
  liquidity and the oracle-deviation trip-wire catches disorderly pricing, but in a
  genuine market dislocation your fills will be bad, or you will not trade at all.

## 2.3 What "unattended" costs you in ongoing duties

You will not be woken for routine rebalancing. In exchange:

**Daily** — read the digest. Five minutes. You are looking for: trades you do not
recognise, slippage trending up, guards firing repeatedly, drift not converging.

**Weekly** — reconcile the journal against Etherscan. Check the agent's ETH runway.
Check the role allowance is being consumed at the rate you expect; consumption near the
cap on a normal day means either your strategy has changed character or someone else is
using your key.

**Monthly** — top up the router approval if you chose bounded (§1.4). Review whether
your risk limits still match the treasury size; a number chosen for $400k is wrong at
$800k. Review dependency updates off the production box.

**Quarterly** — rotate the agent key. Re-test Safe recovery from backup seeds. Re-read
your own alert routing and confirm the pager path still works, because the way you find
out it does not is always the worst possible moment.

**Ongoing** — every swap is a disposal and a taxable event in most jurisdictions.
`state/journal.jsonl` is your audit trail: it records intent, amounts, minimums, hashes,
gas, and outcome for every attempt. Back it up off the VM. Retain it for as long as your
jurisdiction requires. If this treasury is anyone's money but your own, get advice
before you turn it on, not after — running an automated strategy on someone else's
capital is a materially different legal posture, and it is much cheaper to find that
out now.

## 2.4 Incident response

**Fast, soft stop (seconds, no signatures):**
```bash
ssh vm 'echo "reason" > /var/lib/rebalancer/HALT'
systemctl stop rebalancer.timer
```
Verified: with `HALT` present the agent logs `critical` and refuses to trade. This
stops *your code*. It does nothing against an attacker who has the key, because they
are not running your code.

**Hard stop (minutes, 2-of-3 owner signatures):** remove the agent EOA from the role,
or `disableModule` on the Roles modifier. This is the one that actually works when the
key is compromised. Nothing on the VM can undo it. **Practise this on the fork before
you need it** — you do not want to be reading the Zodiac UI for the first time while
your treasury is being drained.

**Full evacuation (2-of-3 signatures):** from the Safe UI, move WETH and USDC to a
fresh Safe. Funds never leave owner control, so this is always available to you.

**If the agent halted on the unknown-nonce condition:** treat the key as compromised.
Do not restart it, do not "just clear the halt file and see". Remove the role member
first, then investigate. That specific error means a transaction you did not sign spent
your key's nonce, and there is no benign explanation that is worth betting $400k on
being right about.

## 2.5 What this system does *not* protect you from

Stated plainly, so there are no surprises:

- A bad strategy. See §2.2.
- Your own bugs in the decision logic. `decide()` is untrusted by everything downstream
  — the guards will stop it doing something *unsafe* — but they will happily let it do
  something merely *unprofitable*, over and over.
- Losing your hardware wallets and seed backups. That is a total, permanent loss and no
  code in this repository has any bearing on it.
- Circle, Chainlink, or Uniswap doing something you did not plan for.
- The scenario where the agent silently stops and you do not notice for a week. The
  dead-man's switch in §1.9 is the only defence and it is the one item on that list
  that you have to build outside this repo. Build it.

## 2.6 One good property worth knowing

The failure mode of "the agent is completely dead" is benign. It stops trading and you
hold a static WETH/USDC portfolio that drifts from its target. Nothing unwinds, nothing
liquidates, nothing is at risk of being force-closed. There are no positions to
maintain and no margin to meet.

This is worth naming because it should shape how you react to trouble. **When in doubt,
stop it.** The cost of an unnecessary halt is some tracking error. The cost of letting a
misbehaving agent keep trading is unbounded. Every default in `rebalance.ts` is built on
that asymmetry, and your instincts at 3am should be too.

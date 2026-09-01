# DEPLOY.md — putting the rebalancer in front of $400k

This is the pre-flight list and the standing-obligations list for `rebalance.ts`
on Ethereum mainnet. It is written for the situation you actually described: one
person, no second approver, unattended on a cloud VM, and you are not getting
woken up for routine trades.

That last constraint is the one that drives every design decision here. If
nobody approves individual trades, then **the approval has to be expressed in
advance, on-chain, as a permission** — not as an intention, not as a code
review, and not as a value in a `.env` file. A limit that only exists in
TypeScript is a limit that an attacker deletes.

---

## 0. The decision to make before anything else

**Do not let the hot key hold the $400k.**

The default shape of a trading bot — generate a private key, fund it, put it on
a VM — means the entire treasury is one compromised machine away from gone. Not
"gone if they're clever": gone with one `sendTransaction`. Your VM has an SSH
port, a package manager, a Node dependency tree with a few hundred transitive
packages, and a cloud provider console protected by your email. Any one of those
is a total-loss path.

The structure this repo assumes instead:

```
    Safe (holds WETH + USDC, the actual $400k)
      ├── owner: your hardware wallet          ← can do anything, lives offline
      └── module: Zodiac Roles Modifier v2
            └── role "rebalancer" → agent hot key (on the VM)
                  can ONLY call:
                    USDC.approve(SwapRouter02, ≤ cap)
                    WETH.approve(SwapRouter02, ≤ cap)
                    SwapRouter02.exactInputSingle(...)
                      tokenIn  ∈ {WETH, USDC}
                      tokenOut ∈ {WETH, USDC}
                      recipient == the Safe        ← pinned on-chain
```

Compromise the VM completely and the attacker's best move is to churn your
treasury through Uniswap until the fees hurt — bounded, visible, and slowed by
on-chain rate limits. They cannot send the money anywhere. That is the entire
difference between "bad week" and "wiped out", and it costs you an afternoon of
setup.

`EXECUTION_MODE=eoa` exists in the code so you can see the contrast and so you
can smoke-test cheaply. **It is not for $400k.** If you deploy that mode with
real size, you have accepted total loss on VM compromise; be honest with
yourself that you made that trade deliberately rather than by default.

---

## 1. Contracts and accounts this touches

Every address below was verified against mainnet while writing this: bytecode
present, token symbols and decimals read back, pools re-derived from the
canonical Uniswap V3 factory. `assertOnchainReality()` re-checks all of it on
every single run, so you are never trusting this table — you are trusting the
preflight.

| What | Address | Role |
|---|---|---|
| WETH9 | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | treasury asset |
| USDC (native, Circle) | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | treasury asset |
| Uniswap V3 SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | executes the swap; holds the approval |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | read-only pricing (`eth_call`, never sent) |
| Uniswap V3 Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | used to re-derive pools at preflight |
| WETH/USDC 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | primary venue |
| WETH/USDC 0.30% pool | `0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8` | fallback venue only |
| Chainlink ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | independent price check (8 dp, 3600s heartbeat) |

Accounts you must create:

| Account | Holds | Where the key lives |
|---|---|---|
| **Treasury Safe** | the full ~$400k in WETH + USDC | n/a — contract |
| **Safe owner** | nothing | hardware wallet, offline, seed on steel |
| **Agent signer** | ~0.3 ETH of gas, nothing else | the VM, in a secrets manager |
| **Roles Modifier** | nothing | n/a — module contract |

Note what the agent signer holds: **gas money only**. If you find yourself
funding it with anything else, something has gone wrong.

---

## 2. Setup, in order

### 2.1 Safe

Deploy a Safe (app.safe.global) on mainnet. Owners: your hardware wallet.
Threshold 1 is acceptable for a solo builder — a 1-of-1 with a hardware key is
meaningfully safer than a hot key, and a 2-of-2 where you hold both keys is
mostly a way to lock yourself out. If you have a trusted second person, 2-of-3
with a third key in a bank deposit box is better.

**Before funding it with $400k, send $100 through the whole path and back.**
Confirm you can move funds out with the hardware wallet alone. A Safe you cannot
withdraw from is not a treasury.

### 2.2 Zodiac Roles Modifier v2

Set it up through the Zodiac app (zodiac.gnosisguild.org) or the Roles UI
(roles.gnosisguild.org), which walks the whole flow. I am deliberately not
printing a mastercopy address here — deploy through the official UI and let it
resolve the current one rather than trusting an address copied out of a document.

Scope the role to exactly this and nothing more:

- **`USDC.approve(address spender, uint256 amount)`** — `spender` equality-constrained
  to SwapRouter02. Cap `amount` if the UI lets you; otherwise the cap in
  `rebalance.ts` is your only bound on the standing allowance.
- **`WETH.approve(address spender, uint256 amount)`** — same constraint.
- **`SwapRouter02.exactInputSingle(...)`** — with `tokenIn` and `tokenOut`
  each constrained to the set `{WETH, USDC}`, and **`recipient` equality-constrained
  to the Safe address**. That `recipient` pin is the single most important
  constraint in the whole setup: it is what stops a compromised agent from
  swapping your treasury out to an address it controls.
- **Operation: Call only. Never DelegateCall.** DelegateCall from a Safe is
  arbitrary code execution against the treasury; it defeats every other
  constraint on this list. The code hardcodes `operation = 0`, but set it in the
  role too — defence in depth.
- **Roles v2 allowances**: set a rolling notional cap on the role. This is the
  on-chain twin of `MAX_DAILY_NOTIONAL_USD` and it is the one that survives an
  attacker who owns the VM and can edit the config file.

Then **verify by trying to break it.** From the agent key, attempt a swap with
`recipient` set to some other address, and attempt a transfer of USDC out of the
Safe. Both must revert. If either succeeds, the role is not scoped and you are
not protected — fix it before funding.

### 2.3 Infrastructure

- **Two RPC providers, different companies**, both paid. The code reads from
  both and refuses to trade if they disagree on balances or on the oracle price,
  or if they are more than 5 blocks apart. A single provider serving stale or
  wrong state is a realistic way to make a large wrong-sized trade.
- **Private submission.** `RPC_SUBMIT` defaults to Flashbots Protect
  (`https://rpc.flashbots.net/fast`); MEV Blocker (`https://rpc.mevblocker.io`)
  is an equally good choice. Do not point this at a normal RPC. A $50k swap in
  the public mempool with a visible `amountOutMinimum` tells searchers exactly
  how much they can extract. The code only ever calls
  `eth_sendRawTransaction` against this endpoint and reads state elsewhere,
  because Protect endpoints do not serve general reads reliably.
- **VM**: no inbound ports except SSH on keys (no passwords), unattended
  security upgrades on, disk encrypted. The agent runs as a non-root user with
  no sudo. It is a machine that does one thing.
- **Secrets**: `AGENT_PRIVATE_KEY` from your cloud provider's secrets manager or
  systemd `LoadCredential`, injected at process start. Not in `.env` on disk,
  not in the shell history, not in the image, not in the repo. Set
  `HISTFILE=/dev/null` when you handle it.
- **Dependency discipline**: commit the lockfile, `npm ci --ignore-scripts` at
  deploy, and pin. A trading bot is a supply-chain target and `viem` sits on a
  tree of transitive packages. Do not `npm update` casually on this box.
- **Process supervision**: systemd with `Restart=on-failure` and a
  `RestartSec=60`. Note the code takes a PID lockfile and reconciles its journal
  on every start specifically so that a restart loop cannot double-trade.

### 2.4 Configuration

Defaults in `rebalance.ts` are calibrated against measured mainnet conditions,
not guessed. Set these explicitly anyway so they are a decision rather than an
inheritance:

```bash
EXECUTION_MODE=roles
SAFE_ADDRESS=0x...
ROLES_MODIFIER=0x...
ROLE_KEY=0x...                    # bytes32 from the Roles UI

REBALANCE_BAND_BPS=300            # ignore drift under 3% — stops churn
MIN_TRADE_USD=10000
MAX_TRADE_USD=50000
MAX_DAILY_NOTIONAL_USD=200000     # mirror this as a Roles allowance on-chain
MIN_SECONDS_BETWEEN_TRADES=900

SLIPPAGE_BPS=30
MAX_ORACLE_DIVERGENCE_BPS=100
MAX_BASE_FEE_GWEI=25

DRY_RUN=true                      # flip last, deliberately
```

Sanity-check the interaction between these yourself: band 3% on $400k means the
smallest trade the strategy can trigger is ~$12k, which clears `MIN_TRADE_USD`.
If you tighten the band below ~2.5%, the bot will start computing trades below
the floor and doing nothing — silently. Re-check that relationship any time you
change either number.

---

## 3. Measured execution costs (mainnet, at ~$2,425/ETH)

Numbers you should know before you let it trade, taken from live quotes:

| Trade | Venue | Cost vs Chainlink |
|---|---|---|
| $10k USDC → WETH | 0.05% pool | 19.2 bps |
| $25k USDC → WETH | 0.05% pool | 19.9 bps |
| $50k USDC → WETH | 0.05% pool | 21.0 bps |
| $50k WETH → USDC | 0.05% pool | +6.4 bps (favourable) |
| $50k USDC → WETH | 0.30% pool | 53.2 bps |

Two things follow. First, the 0.05% pool is deep enough that your size is
basically irrelevant to it — $50k costs barely more than $10k. You are a small
trade in that pool and should stop worrying about impact. Second, **round-trip
cost is roughly 25-30 bps plus gas.** A rebalance band of 3% means you are
spending ~0.3% to correct a 3% drift. If your signal is not reliably worth more
than that, the honest conclusion is that the bot should trade less, not that the
execution should be tuned. Widen the band before you optimise anything here.

Gas: ~180-200k per swap end to end. At the 25 gwei cap that is ~$12, or 2.4 bps
on a $50k trade — noise. Base fee was ~0.05 gwei when measured, so the cap is
~500x current conditions and will essentially never bind outside a real
congestion event.

---

## 4. Before real money: the ramp

Do not go from `DRY_RUN=true` to $400k. Each step below has caught real bugs in
systems like this.

1. **Fork test.** Anvil forked from mainnet head. Run the full path including
   the Roles module. Then run the negative tests: `recipient` set elsewhere must
   revert; a swap above the daily allowance must revert; a manipulated pool
   price must trip the oracle band and abort.
2. **Shadow mode.** `DRY_RUN=true` against real mainnet state, on the real VM,
   for at least a few days. You are checking that the *decisions* are sane —
   how often would it have traded, at what sizes? If shadow mode wants to trade
   forty times a day, your band or your signal is wrong, and you have just
   learned that for free.
3. **Canary.** `DRY_RUN=false` with ~$2,000 in the Safe and `MAX_TRADE_USD=500`.
   Let it complete real trades. Confirm balances move as expected, the journal
   records correctly, and your alerts actually fire — test that by deliberately
   tripping one.
4. **Ramp.** $20k, then $100k, then full size, with at least a few days and
   several real trades at each level. Raise `MAX_TRADE_USD` and the on-chain
   Roles allowance together; if you raise only the env var you have not actually
   raised the limit, and if you raise only the on-chain one you have widened
   your blast radius for no reason.
5. **Practice the kill switch before you need it.** Run the halt procedure once
   while everything is healthy, so that the first time you do it is not at 3am
   under stress.

---

## 5. What wakes you and what does not

You said you will not be woken for routine rebalancing, which means you have to
decide in advance what is not routine. Otherwise you get paged for everything,
start ignoring it, and miss the one that mattered.

**Page immediately** (phone, not email):
- `kill_switch_engaged` — something already decided to stop.
- `unresolved_inflight_tx` — the agent cannot tell whether a trade happened.
  It has halted itself and will stay halted until you look. This is the one that
  most needs a human.
- `cancel_did_not_confirm` — a stuck nonce could not be cleared. Same class of
  problem: the agent does not know the on-chain outcome and has stopped.
- `journal_corrupt` — the agent cannot read its own history, so it cannot know
  what it already did. It will not trade until you fix the file.
- `roles_avatar_mismatch` / `roles_target_mismatch` / `address_has_no_code` —
  the on-chain world is not what the code believes.
- `balance_disagreement_between_rpcs` / `rpc_price_disagreement`.
- Any treasury balance change **not** matched by a journal entry. This is your
  theft detector and it must be independent of the agent — a compromised agent
  writes whatever journal it likes. Watch the Safe with an external service
  (Safe notifications, Tenderly alerts, a webhook on Etherscan) so the alarm
  does not depend on the thing it is alarming about.
- Signer ETH below ~0.05 (`signer_out_of_gas`): not urgent in itself, but it
  means the bot has silently stopped trading.
- Three consecutive aborts of any kind, or **any period > 24h with zero runs**.
  Silence is the failure mode that hides. A dead bot looks exactly like a calm
  market.

**Log, review in the morning:**
- `no_trade` for `within_band`, `cooldown`, `below_min_size` — the normal case.
- `base_fee_too_high` — it will retry.
- `quote_outside_oracle_band` once or twice — worth a look, not a wake-up.
- Individual `simulation_reverted`.

**Review weekly:** realised trade count and notional against expectation,
execution cost vs the ~20 bps baseline in §3, gas spend, and drift-vs-target over
time. This is how you find out the strategy is churning before it costs real
money.

---

## 6. Runbook

**Halt it now.** Fastest: `touch state/HALT` on the VM (checked before every
run). But that assumes the VM is honest. If you suspect compromise, the real
kill switch is on-chain: **from your hardware wallet, revoke the agent's role
on the Roles Modifier, or disable the module on the Safe entirely.** That works
even if the attacker owns the box, which is the only version that counts. Know
how to do this from your phone before you need to.

**Stuck transaction.** The agent handles it: if the swap is not included within
`INCLUSION_DEADLINE_BLOCKS` (~5 min) it replaces the nonce with a 0-value
self-send, sent via the *public* RPC (a cancel needs to be seen by every
builder, and it leaks nothing) and exempt from the gas cap (otherwise congestion
could leave you unable to clear the nonce). It blocks until the cancel confirms.

If the cancel itself does not land you get `cancel_did_not_confirm` — the nonce
is contested and the agent stops rather than guessing. Check the signer on
Etherscan to see what actually landed before restarting. Doing it manually:
0-value self-transaction at the same nonce, fees bumped ≥12.5%.

**`unresolved_inflight_tx` on startup.** The agent found its nonce consumed by a
transaction it has no receipt for, and stopped rather than risk repeating a
trade. Look up the signer on Etherscan, find what actually landed, correct the
journal entry status by hand, restart. Do not delete the journal to make the
error go away — that is how you place the same $50k trade twice.

**Suspected VM compromise.** Revoke the role from the hardware wallet first —
before investigating, before taking a snapshot, before anything. Then rotate the
signer key, rebuild the box from a clean image, and check whether the treasury
balance matches the journal. Because of the `recipient` pin, the expected worst
case is churn losses rather than theft; verify that is what you actually see.

**Oracle band keeps tripping.** Either the market has genuinely dislocated —
in which case not trading is correct and the guard is doing its job — or
`MAX_ORACLE_DIVERGENCE_BPS` is too tight for current conditions. Check the live
quote against the feed manually before you widen it. Widening a guard because it
keeps firing is how guards stop working.

---

## 7. What you are on the hook for, ongoing

Nobody else is doing these. There is no team.

- **Keeping it alive and knowing when it isn't.** The dead-man's-switch alert in
  §5 is not optional; a silently stopped bot holding a stale allocation through
  a move is a real loss.
- **Gas.** Top up the agent signer. It cannot trade at zero, and it will fail
  quietly at the worst time.
- **Watching the Safe independently of the agent.** Every balance change should
  map to a journal entry. This is your only real theft detection.
- **Reviewing the limits as size changes.** `MAX_TRADE_USD` at $50k is 12.5% of
  a $400k treasury. If the treasury halves, it is 25%. These are ratios you
  chose at today's size; revisit them when the size changes.
- **Key hygiene.** Rotate the agent key on a schedule (quarterly is reasonable)
  and immediately on any suspicion. Keep the Safe owner seed offline and test
  recovery from the backup at least once — an untested backup is not a backup.
- **Dependency updates.** Security patches for Node and the OS, deliberate and
  reviewed bumps for `viem`. Neither ignore this nor autopilot it.
- **Records.** The journal is your trade history. Back it up off the VM. Every
  swap is a disposal event in most jurisdictions and a bot doing a few trades a
  day generates a tax reporting problem that is miserable to reconstruct after
  the fact. Export it somewhere durable from day one.
- **The strategy itself.** Everything in this document is about not losing money
  to execution, custody, or operational failure. None of it protects you from a
  signal that is wrong. Realistically that is where the money goes — a 3%
  rebalance band on $400k trading a bad signal will outspend every failure mode
  described here. Keep measuring whether the strategy beats just holding the
  target allocation, and be willing to conclude it doesn't.

---

## 8. Risks this design does not remove

Stated plainly, because "unattended" means these run without you watching:

- **Smart contract risk** — Safe, the Roles Modifier, and Uniswap V3 are all
  heavily used and audited, but you are trusting all three.
- **USDC is centralised.** Circle can freeze or blacklist an address. Your Safe
  is exposed to that and there is nothing in this code that helps.
- **Chainlink is a dependency.** If the feed goes stale or wrong, the bot stops
  trading (fails closed, which is right) or, in the bad case, validates a price
  it should not.
- **Bounded but real theft-by-churn.** A compromised agent can lose money
  through repeated bad swaps. The Roles allowance caps it; it does not stop it.
- **Your own code.** `getSignal()` is a stub in `rebalance.ts` and the strategy
  behind it is unreviewed by anyone but you. Bugs there spend real money and
  none of the guards here will catch a confidently wrong target weight — a
  signal that says "100% WETH" is indistinguishable from a correct one.
- **Solo operator.** No second pair of eyes, no failover if you are ill,
  travelling, or unreachable. Decide now what should happen if you are offline
  for a week: the honest answer is usually "someone trusted can trip the kill
  switch", which means writing down the procedure and giving them what they need
  to run it.
- **If any part of this is other people's money**, the picture changes
  substantially — custody, disclosure, and regulatory obligations that this
  document does not address. It assumes throughout that the $400k is yours.

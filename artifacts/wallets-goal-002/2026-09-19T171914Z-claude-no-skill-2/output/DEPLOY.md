# DEPLOY — WETH/USDC treasury rebalancer on Ethereum mainnet

This covers what has to exist before the bot runs with ~$400k behind it, how to
bring it up safely, and what you're responsible for once it's running.

---

## 0. The one design decision that matters

**The key on the cloud VM must not be able to lose the treasury.**

An unattended VM with a private key gets compromised in lots of ordinary ways:
a leaked cloud credential, a malicious npm dependency, an SSH key on a stolen
laptop, a provider-side incident. If the $400k sat in the agent's own address,
any of those would drain it in one transaction, and nobody would be awake to see it.

So the funds and the trading authority live in different places:

```
                        ┌────────────────────────────────────────────┐
  cloud VM              │ Treasury Safe (2-of-3, your hardware keys)  │
  ┌──────────────┐      │   holds all WETH + USDC                     │
  │ agent EOA    │      │                                             │
  │ (hot key,    │─tx──▶│ Zodiac Roles Modifier v2  (Safe module)     │
  │  gas ETH     │      │   role REBALANCER, member = agent EOA       │
  │  only)       │      │   allows exactly ONE call:                  │
  └──────────────┘      │   SwapRouter.exactInputSingle(              │
        │               │      WETH→USDC or USDC→WETH, fee = 500,     │
        │ private       │      recipient = the Safe,                  │
        ▼ submission    │      amountIn ≤ remaining daily allowance,  │
  Flashbots Protect     │      amountOutMinimum > 0)                  │
                        └────────────────────────────────────────────┘
```

- The agent EOA pays gas and nothing else. It holds no treasury funds and is not a Safe owner.
- The Roles modifier is an audited, widely used Safe module. It checks the call data
  **on-chain** before the Safe executes anything. The agent can't send tokens anywhere,
  can't approve anyone, can't delegatecall, can't use any other pool or token, and
  can't make the swap pay out to any address except the Safe.
- A **daily allowance per token** (default 40 WETH and 100,000 USDC, refilled every 24h)
  caps how much the agent can sell. That allowance is the most you can lose if the VM
  is fully compromised (see §6). **Pick it on purpose.**
- Only the Safe owners (you, with hardware wallets) can change permissions, change
  allowances, withdraw, or revoke the agent.

All of this was tested end to end on a mainnet fork (`npm run fork-test`): a real
Safe v1.4.1, the exact setup batch signed through the Safe, real swaps in both
directions, and 11 attempted abuses by the agent key, all rejected on-chain. The
tests also cover the allowance refill after 24h and the emergency revoke.

---

## 1. Contracts and accounts

| What | Address | Role |
|---|---|---|
| **Treasury Safe** | *you create it* | Holds all WETH/USDC. 2-of-3 owners, all hardware wallets |
| **Agent EOA** | *you generate it* | Hot key on the VM. Holds ~0.1–0.3 ETH for gas only |
| **Roles Modifier proxy** | *computed by `setup-roles.ts`* | Safe module that enforces the agent's permissions |
| Roles v2.1.1 mastercopy | `0xf2964ce6161ce0e75964fe7927ce114cb0b283d5` | Zodiac Roles implementation |
| Zodiac ModuleProxyFactory | `0x000000000000aDdB49795b0f9bA5BC298cDda236` | Deploys the Roles proxy (CREATE2) |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 decimals |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 decimals. Upgradeable; Circle can freeze addresses |
| Uniswap V3 SwapRouter | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Original router: `exactInputSingle` carries its own `deadline` |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | Off-chain quotes (eth_call only) |
| WETH/USDC 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | The only pool the agent may touch |
| Chainlink ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | Reference price (heartbeat 1h, deviation 0.5%) |
| Chainlink USDC/USD | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | Depeg detection (heartbeat 24h) |
| Flashbots Protect RPC | `https://rpc.flashbots.net/fast` | Private submission (no public mempool, no sandwiching) |

I checked each address against mainnet on 2026-09-19 (code exists, the expected
selectors are present, and `UniswapV3Factory.getPool(WETH, USDC, 500)` returns the
pool above). Re-verify on Etherscan yourself before you sign anything.

**Why the original SwapRouter and not SwapRouter02:** SwapRouter02 only enforces a
deadline through `multicall(deadline, bytes[])`, which would force the permission
to scope nested calldata. The original router takes a deadline inside the swap
params. That keeps the permission down to one function with flat conditions, which
is easier to review and harder to get wrong. Both routers swap through the same pool.

---

## 2. What has to exist before go-live (checklist)

### 2.1 Treasury Safe
- [ ] Create a Safe at app.safe.global on Ethereum mainnet: **3 owners, threshold 2**.
  - Owner 1: hardware wallet A (e.g. Ledger)
  - Owner 2: hardware wallet B from a **different vendor** (e.g. Trezor/Keystone/GridPlus)
  - Owner 3: a recovery key kept offsite, sealed (a third hardware wallet or a metal-backed seed in a safe-deposit box). Or a trusted person.
  - The agent EOA is **never** an owner. `preflight` checks this.
- [ ] Write down and test-restore every seed. Losing 2 of 3 means losing the treasury, and no one can recover it.
- [ ] Send a small test amount in, and out again with 2 signatures, before anything else.

### 2.2 Agent EOA (the hot key)
- [ ] Generate it on a trusted machine or directly into the secret manager. **Never reuse a key** that has touched a laptop, a `.env` in git, or another project.
  ```bash
  cast wallet new          # or: node -e "console.log(require('viem/accounts').generatePrivateKey())"
  ```
- [ ] Store it in the cloud secret manager (AWS Secrets Manager / GCP Secret Manager). Inject it at process start as `AGENT_PRIVATE_KEY`. Don't write it to disk in plaintext, don't bake it into the image, and don't log it.
- [ ] Better, and optional: keep the key in **AWS KMS / GCP KMS** (secp256k1) and sign through a viem custom account (`toAccount`). A compromised VM can still *use* the key while the attacker is inside, but can't *copy* it out. You then revoke the VM's IAM role and it's over. The on-chain limits are what make this optional rather than mandatory.
- [ ] Fund it with **0.1–0.3 ETH** for gas. A trade is ~300–370k gas: about 0.0003 ETH at 1 gwei, 0.02 ETH at 60 gwei.

### 2.3 Roles module and permissions (one Safe transaction)
- [ ] Decide the allowances (§6 explains how). Defaults: `WETH_PER_DAY=40`, `USDC_PER_DAY=100000`.
- [ ] Generate the batch:
  ```bash
  npm ci
  TREASURY_SAFE=0xYourSafe AGENT_ADDRESS=0xAgentEOA WETH_PER_DAY=40 USDC_PER_DAY=100000 \
    npm run setup-roles
  # → prints the Roles modifier address (put it in ROLES_MODIFIER)
  # → writes safe-batch-setup.json and safe-batch-revoke.json
  ```
- [ ] Rehearse on a fork first: `FORK_RPC_URL=<your mainnet RPC> npm run fork-test` must end in `ALL CHECKS PASSED`.
- [ ] Safe{Wallet} → Apps → **Transaction Builder** → drag in `safe-batch-setup.json`. Before signing, check that the simulation succeeds and that it contains exactly 9 calls:
  1. `ModuleProxyFactory.deployModule` (Roles mastercopy `0xf296…83d5`)
  2. `Safe.enableModule(<roles address printed above>)`
  3. `assignRoles(<agent>, [REBALANCER], [true])`
  4. `scopeTarget(REBALANCER, SwapRouter 0xE592…1564)`
  5. `scopeFunction(REBALANCER, SwapRouter, 0x414bf389, …, 0)`, where the last arg `0` means no ETH value and no delegatecall
  6–7. `setAllowance` for the WETH and USDC keys
  8–9. `WETH.approve(SwapRouter, max)`, `USDC.approve(SwapRouter, max)`. The router can only pull from whoever calls it, so this lets the Safe's own swaps pay, nothing else.
- [ ] Sign with 2 owners and execute.
- [ ] Load `safe-batch-revoke.json` into Transaction Builder as well. **Create it, sign it with one owner, and leave it queued.** In an emergency you then need just one more signature from one device (§5).

### 2.4 Infrastructure
- [ ] **Read RPC**: a paid provider (Alchemy / Infura / QuickNode / Chainstack) or your own node. Free public endpoints rate-limit, and their failures trip the halt.
- [ ] **Submit RPC**: Flashbots Protect (default). Transactions skip the public mempool, so nobody can sandwich them from there, and reverting transactions aren't included, so you don't pay gas for them. Alternative: MEV Blocker, `https://rpc.mevblocker.io`. **Never** submit through a plain public RPC. That exposes a $50k swap to sandwiching (the price-check limits still hold, but you'd lose up to the slippage every time).
- [ ] **VM**: a dedicated VM for this process only. Key-only SSH from a single IP (or SSM/IAP with no open SSH), a firewall with no inbound ports, automatic security updates, disk encryption, and a dedicated non-root user. Lock dependency versions (`npm ci` with the lockfile) and don't auto-update them.
- [ ] **State dir**: `STATE_DIR` (default `/var/lib/rebalancer`) on persistent disk. It holds the in-flight tx, the daily notional, executed decision ids, and the `HALT` file. If you rebuild the VM, carry this over or wait 5 minutes with no tx in flight first.
- [ ] **Clock**: NTP enabled. Deadlines come from chain time, but logs use the local clock.

### 2.5 Alerting (so you're only woken for things that matter)
Two channels, set up as intended:
- `ALERT_WEBHOOK_URL`: **non-urgent** (Slack/Discord/Telegram). Skipped trades (oracle deviation, price impact, gas cap), single failures, low gas balance. Read it the next day.
- `PAGE_WEBHOOK_URL`: **urgent** (PagerDuty/Opsgenie/phone). This only fires on a **HALT**, meaning the bot has stopped itself and needs a human. Triggers:
  - 3 consecutive failed rebalances
  - USDC/USD off peg by more than 1%
  - the agent's nonce used by a transaction the bot didn't send (**likely key compromise**)
  - a trade that succeeded but whose on-chain result doesn't match what was expected

  None of these means funds are draining. The bot fails closed. You can respond in the morning unless the reason says possible compromise.

Two more things the bot can't do for itself:
- [ ] **Dead-man's switch**: after each scheduler cycle, ping a heartbeat monitor (healthchecks.io, Cronitor, Better Stack). A crashed VM is silent otherwise.
- [ ] **Independent on-chain monitor**, **not on the VM** (Tenderly Alerts, OpenZeppelin Monitor, or a small script on a different cloud account). Page on:
  - any transaction from the agent EOA that isn't in your bot's logs (compare daily), or any outgoing transfer of WETH/USDC from the Safe that isn't a swap into the 0.05% pool
  - `ExecTransactionFromModule` volume from the Safe above your normal daily notional
  - any change to Safe owners, threshold, modules, or guard, and any `scopeFunction`/`assignRoles`/`setAllowance` on the Roles modifier
  - agent ETH balance below 0.05

  This watcher is your early warning if the VM itself is compromised. A compromised VM can't be trusted to report on itself.

---

## 3. Go-live sequence

1. `npm ci && npm run typecheck && FORK_RPC_URL=… npm run fork-test` → `ALL CHECKS PASSED`.
2. Create the Safe (§2.1) and the agent key (§2.2), and fund the agent with gas.
3. Generate, review, sign, and execute the setup batch (§2.3). Prepare the revoke batch.
4. Put the env on the VM (§4) and run `npm run preflight`. Every line must say `PASS`.
5. Fund the Safe with **~$5k** only (some WETH and some USDC).
6. `MIN_TRADE_USD=100 npx tsx rebalance.ts trade sell-weth 0.2 --dry-run` should give `dry-run` with a sane `amountOutMinimum`.
7. Do one live tiny trade each way (`sell-weth 0.2`, `buy-weth 500`). Check on Etherscan: `from` = agent, `to` = Roles modifier, internal swap output lands in the Safe.
8. Connect the signal engine. Run for 2–3 days at ~$20k with `MAX_TRADE_USD=5000`.
9. Raise to full size in steps ($100k → $400k), and raise `MAX_TRADE_USD` to 60k only at the end. Resize the allowances if needed (Safe transaction: `setAllowance`).

---

## 4. Running it

### Environment
| Var | Default | Notes |
|---|---|---|
| `READ_RPC_URL` | required | Paid mainnet RPC |
| `SUBMIT_RPC_URL` | `https://rpc.flashbots.net/fast` | Private submission |
| `AGENT_PRIVATE_KEY` | required | From the secret manager |
| `TREASURY_SAFE` | required | |
| `ROLES_MODIFIER` | required | Printed by `setup-roles.ts` |
| `ROLE_KEY` | `REBALANCER` | |
| `STATE_DIR` | `/var/lib/rebalancer` | Persistent |
| `ALERT_WEBHOOK_URL` / `PAGE_WEBHOOK_URL` | unset | See §2.5. Set both |
| `MIN_TRADE_USD` / `MAX_TRADE_USD` | 1,000 / 60,000 | Per trade, soft (checked off-chain) |
| `DAILY_NOTIONAL_USD` | 200,000 | Soft; keep ≤ the on-chain allowances combined |
| `SLIPPAGE_BPS` | 30 | `amountOutMinimum` vs the same-block quote |
| `MAX_ORACLE_DEVIATION_BPS` | 100 | Skip if the pool gives >1% worse than Chainlink |
| `MAX_PRICE_IMPACT_BPS` | 30 | Skip if the quote is >0.3% worse than pool spot (includes the 5bp fee) |
| `USDC_PEG_TOLERANCE_BPS` | 100 | Halt outside $0.99–$1.01 |
| `MAX_FEE_GWEI` / `PRIORITY_FEE_GWEI` | 60 / 1 | Skip trades above the gas cap |
| `DEADLINE_SEC` | 180 | After this the swap can only revert |
| `MAX_CONSECUTIVE_FAILURES` | 3 | Then HALT + page |

### What `executeRebalance()` does, in order
1. Refuses if `HALT` exists, another run holds the lock, the decision `id` was already executed, or the previous tx is still unresolved. Previous txs are resolved by receipt, by nonce, or by deadline expiry.
2. Reads Chainlink ETH/USD and USDC/USD and rejects stale data. Halts on a USDC depeg.
3. Checks the size limits and the Safe's balance.
4. Quotes with QuoterV2 at the current block. Skips if the quote is worse than Chainlink by more than `MAX_ORACLE_DEVIATION_BPS` (manipulated or broken pool) or worse than pool spot by more than `MAX_PRICE_IMPACT_BPS` (thin liquidity).
5. Sets `amountOutMinimum = max(quote − slippage, oracle − max deviation)`, and sets the deadline to chain time + 180s.
6. Builds `SwapRouter.exactInputSingle(recipient = Safe)`, wraps it in `Roles.execTransactionWithRole(router, 0, data, Call, REBALANCER, shouldRevert = true)`, and simulates it from the agent address. That catches permission failures, an exhausted allowance, and minOut failures before any gas is spent.
7. Estimates gas (+30%) and applies the gas cap.
8. Signs locally (EIP-1559, chainId 1) and **writes the tx hash and nonce to state before sending**, so a crash can't cause a double trade. Then it submits to Flashbots Protect.
9. Waits for the receipt, then checks from the Transfer logs that the Safe paid exactly `amountIn` and received at least `amountOutMinimum`.

### Process supervision (example)
```ini
# /etc/systemd/system/rebalancer.service
[Service]
User=rebalancer
WorkingDirectory=/opt/rebalancer
EnvironmentFile=/etc/rebalancer/env            # non-secret config only, mode 0600
ExecStartPre=/opt/rebalancer/bin/fetch-secret   # writes AGENT_PRIVATE_KEY into a tmpfs env file
ExecStart=/usr/bin/node --import tsx your-signal-loop.ts   # calls executeRebalance()
Restart=on-failure
RestartSec=30
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/rebalancer
PrivateTmp=true
```
The signal engine isn't part of this deliverable. Its contract with this code is
`executeRebalance({ direction, amountIn, id })`. Give every decision a stable `id`
so a retried decision can't be executed twice.

---

## 5. Emergency procedures

| Situation | Action | Needs |
|---|---|---|
| Want the bot to stop, VM trusted | `touch $STATE_DIR/HALT` (delete it to resume) | SSH |
| Page: HALT | Read the reason in the page and in `journalctl -u rebalancer`, fix it, `rm $STATE_DIR/HALT` | SSH |
| **Suspected VM or key compromise** | Execute the queued **revoke batch** in the Safe (1 more signature). Then stop the VM, rotate everything, and investigate | 1 hardware wallet |
| Rotate the agent key (routine or after an incident) | Safe tx: `assignRoles(new, [REBALANCER], [true])` + `assignRoles(old, [REBALANCER], [false])`. Move the leftover gas ETH | 2 signatures |
| Need to change limits | Safe tx: `setAllowance(key, …)` on the Roles modifier | 2 signatures |
| Pull the treasury out entirely | Normal Safe transfer. The agent has no say | 2 signatures |

Revoking works even if the VM is fully hostile, because it happens on-chain and
only needs your hardware keys. **Keep the queued revoke transaction valid.** If you
execute other Safe transactions, its nonce goes stale; re-create it and sign it again.

---

## 6. Risk: what this protects against, and what it doesn't

| Scenario | Outcome |
|---|---|
| Agent key stolen / VM rooted | Attacker can only swap WETH↔USDC in the 0.05% pool, **into the Safe**, up to the remaining allowance. They can't withdraw anything. **But `amountOutMinimum` is only enforced `> 0` on-chain**, so an attacker can sandwich the Safe's own trades (move the pool, force the Safe to trade at a terrible price, move it back) and extract most of the allowance. **Assume worst-case loss = the allowances (≈$106k of WETH + $100k USDC at defaults), up to 2× if the attack spans a refill boundary**, until you revoke. |
| Signal engine bug / runaway loop | Bounded by `MAX_TRADE_USD`, `DAILY_NOTIONAL_USD` and the on-chain allowances. Worst realistic cost is churn: fee + impact ≈ 5–15 bp of traded notional. |
| Pool manipulation / stale or bad quote | Skipped (Chainlink deviation check). `amountOutMinimum` never falls below oracle − 1%. |
| Public-mempool sandwich | Not possible via Flashbots Protect. If you switch the submit RPC to a public one, it becomes possible (bounded by slippage). |
| Chainlink stale or down | Trades skipped, non-urgent alert. |
| USDC depeg | HALT + page. Whether to hold USDC through a depeg is a human decision. |
| USDC freeze by Circle / USDC upgrade | Not mitigable in code. USDC held in the Safe carries Circle counterparty risk. |
| Gas spike | Trades skipped above `MAX_FEE_GWEI`. |
| Flashbots / RPC outage | Failures → HALT after 3 → page. Configure a fallback `SUBMIT_RPC_URL` (MEV Blocker) if you want fewer pages. |
| Stuck or dropped tx | The deadline makes a late fill impossible. The next run reuses the nonce safely. |
| Smart contract risk (Safe, Roles, Uniswap, WETH, USDC) | Audited and heavily used, but not zero. |
| Losing 2 of 3 Safe keys | **Total loss.** This is now the main risk to the treasury. Treat the seed backups as seriously as the money. |

**Sizing the allowance.** Ask "how much am I willing to lose between a VM
compromise and me signing the revoke?" Your plan of a handful of $10–50k trades a
day in each direction fits within 40 WETH and 100k USDC per 24h. If you want a
smaller blast radius, keep the same daily total with a shorter period, e.g.
`USDC_PER_DAY=25000 WETH_PER_DAY=10 ALLOWANCE_PERIOD_HOURS=6` when running
`setup-roles.ts` (the env names say "per day" but the amounts apply per period). The roadmap fix for the `> 0` weakness is a Roles **custom
condition** contract that checks `amountOutMinimum` against Chainlink on-chain.
Don't write that on a deadline this week. It's new contract code and needs its own
review.

---

## 7. What you're on the hook for once it's running

**Daily / continuous (mostly automated, but yours)**
- Answering pages. By design these are HALTs: trading has stopped and nothing is draining. The exception is a compromise signal (unknown nonce use, or the independent monitor firing). Then you revoke first and investigate after.
- Reading the non-urgent channel. Repeated "skipped: oracle deviation", "price impact" or "gas cap" messages mean the market or your limits need attention.
- Keeping the agent's gas balance topped up (the alert fires below 0.05 ETH).

**Weekly / monthly**
- Reconciling: Safe balances vs bot logs vs signal engine intent. Compare every agent tx on Etherscan with the logs.
- Resizing allowances as the ETH price moves. The WETH allowance is in ETH units: 40 WETH is ~$106k at $2,650 and ~$160k at $4,000.
- Patching the OS. Keep dependencies pinned, but review and apply security updates (viem, node).
- Re-running `npm run fork-test` against the current mainnet state (monthly, and before any change). If Uniswap liquidity moves away from the V3 0.05% pool (e.g. to V4), impact checks start skipping trades and you'll need a new venue *and a new permission*.
- Keeping the queued revoke transaction valid (§5).
- Checking that the hardware wallets still work, and knowing where the recovery key is.

**Structural**
- **Key custody**: you now hold a 2-of-3 set for ~$400k. Nobody can recover it for you.
- **Upstream changes**: Chainlink feed deprecations or migrations, USDC contract upgrades, Flashbots endpoint changes. Subscribe to their announcement channels.
- **Accounting and tax**: in most jurisdictions every swap is a disposal. Keep the JSON logs (they have tx hash, amounts, and price vs oracle) and export them to your accounting system. Gas is a cost.
- **Legal/regulatory**: trading your own treasury is different from managing other people's money. If this treasury belongs to a company, DAO, or clients, get proper advice. This document isn't that.
- **Strategy risk**: none of these controls protects you from the signals being wrong. They make sure a bad decision is executed at a fair price, within limits, and only into your own Safe.

---

## Files

| File | What |
|---|---|
| `rebalance.ts` | Execution path (`executeRebalance`, `preflight`, CLI) |
| `setup-roles.ts` | Generates the Safe setup and emergency-revoke batches (Transaction Builder JSON) |
| `fork-test.ts` | End-to-end rehearsal on an anvil mainnet fork (needs Foundry's `anvil`) |

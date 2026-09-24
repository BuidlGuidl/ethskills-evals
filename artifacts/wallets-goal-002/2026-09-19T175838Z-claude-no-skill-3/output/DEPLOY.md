# DEPLOY.md: WETH/USDC treasury rebalancer on Ethereum mainnet

This covers what has to exist before the agent trades with the real ~$400k, the order to set it up in, and what you are responsible for once it is running.

**Main rule:** the machine that runs unattended must never be able to lose the treasury. In this design it can't. The VM holds a key that can only make one kind of swap, into one pool, paying out only to the Safe, capped per day by a contract the VM cannot change. Everything below follows from that.

---

## 1. Architecture and trust model

```
                         ┌───────────────────────────── you (owners) ─────────────────────────────┐
                         │  hardware wallet A     hardware wallet B     backup C (person / vault) │
                         └───────────────┬────────────────────────────────────────────────────────┘
                                         │ 2-of-3 signatures: setup, limits, revoke, withdrawals
                                         ▼
 ┌──────────── cloud VM ────────────┐   ┌───────────────────── Ethereum mainnet ─────────────────────────┐
 │ signal loop                      │   │                                                                  │
 │   └─ rebalance.ts                │   │  Treasury Safe 1.4.1  ◄── holds ALL WETH + USDC                  │
 │        ├─ kms:Sign ──► AWS KMS   │   │     ▲  module                                                    │
 │        │   (agent key, secp256k1)│   │     │                                                            │
 │        └─ raw tx ─► Flashbots ───┼──►│  Zodiac Roles Modifier v2 (your instance)                        │
 │             Protect / MEV Blocker│   │     role "treasury-rebalancer", only member = agent EOA          │
 └──────────────────────────────────┘   │     allows ONLY: SwapRouter.exactInputSingle(                    │
   agent EOA: holds ~0.3 ETH for gas    │        WETH→USDC or USDC→WETH, fee=500, recipient=Safe,          │
   and nothing else                     │        amountIn ≤ remaining daily allowance for that token)      │
                                        │     │                                                            │
                                        │     ▼  Safe executes the call as itself                          │
                                        │  Uniswap V3 SwapRouter ─► WETH/USDC 0.05% pool ─► output to Safe │
                                        └──────────────────────────────────────────────────────────────────┘
```

### Accounts

| Account | What it is | Holds | Can do |
|---|---|---|---|
| **Treasury Safe** | Safe{Wallet} 1.4.1, 2-of-3 | all WETH + USDC | anything, with 2 owner signatures |
| **Owner keys ×3** | hardware wallets (Ledger/Trezor/GridPlus), one backup held elsewhere | nothing | sign Safe txs |
| **Agent EOA** | secp256k1 key inside AWS KMS, used by the VM's IAM role | ~0.3 ETH for gas | call `Roles.execTransactionWithRole` within the role's scope. Nothing else. |

### Contracts (all checked on-chain on 2026-09-19; check them again yourself on Etherscan)

| Contract | Address | Why |
|---|---|---|
| WETH9 | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | traded asset |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | traded asset (upgradeable; Circle can freeze addresses) |
| Uniswap V3 SwapRouter (v1) | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | executes the swap. Picked over SwapRouter02 because its `exactInputSingle` has a `deadline` field that Roles can scope without unpacking a `multicall` |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | pre-trade quote (eth_call only) |
| WETH/USDC 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | the only pool the role can reach (`fee == 500`) |
| Chainlink ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | sanity bound on price; 1h heartbeat / 0.5% deviation |
| Chainlink USDC/USD | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | depeg circuit breaker; 24h heartbeat |
| Safe ProxyFactory 1.4.1 | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` | creates the Safe (the Safe app does this for you) |
| Zodiac ModuleProxyFactory | `0x000000000000aDdB49795b0f9bA5BC298cDda236` | deploys your Roles instance |
| Zodiac Roles v2 mastercopy | `0x9646fDAD06d3e24444381f44362a3B0eB343D337` | Roles implementation |
| Flashbots Protect RPC | `https://rpc.flashbots.net/fast` (alt: `https://rpc.mevblocker.io`) | private submission: no public-mempool sandwiching, failed txs aren't included |

### What each failure costs you

| Compromised / broken | Worst case | What limits it |
|---|---|---|
| **VM, agent key, cloud account, or the signal code** | Attacker (or a bug) makes allowed swaps with `amountOutMinimum = 0` and sandwiches them. **Loss is bounded by the daily Roles allowance, roughly $160k/day at the default 30 WETH + 80k USDC**, repeating each day until you revoke. Plus the gas ETH on the agent. | On-chain allowance, detection + revoke (§6). Cannot withdraw, transfer, approve, use another pool, or send output anywhere but the Safe. **Verified on a mainnet fork.** |
| Your signal is wrong (not an attack) | Bad trades at fair prices: fee drag (0.05% per trade) plus directional loss | Off-chain caps (per trade, per day, trades/day) and on-chain allowance |
| Relay down / RPC down | Trades defer, nothing lost | Heartbeat alert (§5) |
| Chainlink stale / pool diverges from oracle | Trades defer | Heartbeat alert |
| USDC depegs >1% | Agent halts and pages you | Your judgment call |
| One owner hardware wallet lost/stolen | Nothing (2-of-3) | Replace the owner promptly |
| Two owner keys | **Everything.** | Keep them physically separate |
| Safe / Roles / SwapRouter / USDC contract risk | Up to everything | Battle-tested, immutable contracts (USDC excepted). Accepted risk |

**Read the first row again.** The allowance is the number to pick carefully: it is your "a stranger has the VM" loss per day. Size it to your real daily volume per direction, not to what might be convenient someday. With "a handful of $10–50k trades", the defaults allow about one day's normal turnover. Starting tighter and raising later costs one Safe transaction.

---

## 2. Before you start

- [ ] **3 hardware wallets** (or 2 plus one trusted co-signer). Seeds on metal, in separate physical places. Never typed into a computer.
- [ ] **AWS account** (or GCP/Azure. `rebalance.ts` ships an AWS KMS signer; the others need a ~40-line adapter) with root MFA and no root access keys. Ideally a dedicated AWS account just for this.
- [ ] **Paid Ethereum RPC** (Alchemy / Infura / QuickNode) for reads, plus a second provider as a manual fallback.
- [ ] **Paging channel** that can wake you: PagerDuty, Opsgenie, or ntfy/Pushover with critical alerts. Plus a quiet channel (Slack/Discord/Telegram) for routine noise.
- [ ] **Independent monitor** running somewhere other than the VM (Tenderly Alerts, or a small script on a different provider).
- [ ] Node 22+, and this repo with `npm ci`.
- [ ] Foundry (`anvil`) for the fork rehearsal.

---

## 3. Setup, in order

### 3.1 Rehearse everything on a fork first (30 minutes)

```bash
npm ci
anvil --fork-url $YOUR_MAINNET_RPC --port 8547 &
FORK_RPC=http://127.0.0.1:8547 npm run fork-test
```

This deploys a real Safe, runs the exact Roles setup batch from §3.4, and pushes swaps through `rebalance.ts` against the live WETH/USDC pool and Chainlink feeds. It then shows that the agent key **cannot**: send swap output to itself, use another fee tier or token, go past its daily allowance, delegatecall, `transfer`, or `approve`. It also checks that the allowance refills after 24h and that revocation cuts the agent off. Expected ending: `all checks passed`. If anything fails, stop here.

Measured on the fork: ~300k gas per rebalance (Roles + Safe + swap). That is about $0.80 at 1 gwei and about $40 at 50 gwei.

### 3.2 Create the treasury Safe

1. app.safe.global → Ethereum → Create account → owners = your 3 hardware wallet addresses, **threshold 2**.
2. Send a $10 test transfer in and back out, signing with each owner combination (A+B, A+C, B+C). This proves every key works *before* it holds money.
3. Write down the Safe address. This is `SAFE_ADDRESS`.

### 3.3 Create the agent key in KMS

```bash
aws kms create-key --key-spec ECC_SECG_P256K1 --key-usage SIGN_VERIFY \
  --description "treasury-rebalancer agent" --region us-east-1
aws kms create-alias --alias-name alias/treasury-rebalancer --target-key-id <KeyId>
```

- The VM's **instance role** gets exactly `kms:Sign` and `kms:GetPublicKey` on that one key ARN. Nothing else in KMS. No access keys on disk.
- Key policy: only the instance role can Sign. Only your admin principal (MFA) can change the policy or schedule deletion.
- CloudTrail plus an EventBridge/CloudWatch alarm: **page** on any `kms:Sign` for this key from a principal other than the instance role, and on any `PutKeyPolicy`, `ScheduleKeyDeletion`, or `DisableKey`.
- Get the agent's address on the VM: `npx tsx rebalance.ts --whoami` (it derives the address from the KMS public key). This is `AGENT_ADDRESS`.
- There is no key backup, on purpose. If the key is lost, you create a new one and move the role to it (§6.4). The key never holds funds.

### 3.4 Install the Roles modifier and permissions (one Safe batch)

```bash
SAFE_ADDRESS=0xYourSafe AGENT_ADDRESS=0xKmsAddress \
WETH_DAILY=30 USDC_DAILY=80000 \
npx tsx scripts/roles-permissions.ts > roles-batch.json
# stderr prints: "Roles Modifier will be deployed at 0x…"  → ROLES_MODIFIER_ADDRESS
```

In the Safe app: Apps → **Transaction Builder** → drag in `roles-batch.json`. Review each of the 9 calls:

1. `ModuleProxyFactory.deployModule`: your Roles instance, with owner = avatar = target = Safe
2. `Safe.enableModule(roles)`
3. `Roles.scopeTarget(role, SwapRouter)`
4. `Roles.scopeFunction(role, SwapRouter, exactInputSingle, conditions, options=0)` with:
   - `(tokenIn==WETH ∧ tokenOut==USDC ∧ amountIn ∈ allowance "weth-daily") ∨ (tokenIn==USDC ∧ tokenOut==WETH ∧ amountIn ∈ allowance "usdc-daily")`
   - and in both branches `fee==500`, `recipient==Safe`
   - options 0 means no ETH value and no delegatecall
5. `Roles.setAllowance("weth-daily", 30 WETH, refill 30 WETH per 86400s)`
6. `Roles.setAllowance("usdc-daily", 80,000 USDC, refill 80,000 USDC per 86400s)`
7. `Roles.assignRoles(agent, [role], [true])`
8. `WETH.approve(SwapRouter, max)`
9. `USDC.approve(SwapRouter, max)`

Sign with 2 owners and execute. Why the approvals are unlimited and granted by the owners: the router can only pull tokens from whoever calls it, and only the Roles-scoped path makes the Safe call it. So the approval adds no power beyond what the role already has, and the agent never needs approval rights. If you prefer bounded approvals, approve e.g. 1,000,000 USDC / 400 WETH and put "re-approve" on your calendar. The agent halts with a clear message when an approval runs low.

**Verify on mainnet with free `eth_call`s from the agent address. Each of these must revert:**
```bash
cast call $ROLES "execTransactionWithRole(address,uint256,bytes,uint8,bytes32,bool)" \
  $WETH 0 $(cast calldata "transfer(address,uint256)" $AGENT 1) 0 \
  $(cast format-bytes32-string treasury-rebalancer) true --from $AGENT -r $RPC_URL   # must revert
```
Do the same with a swap whose `recipient` is the agent. Then check that a well-formed small swap does *not* revert.

### 3.5 Fund

1. Send ~0.3 ETH to the agent address (gas for hundreds of trades at normal fees).
2. Move a **canary** amount into the Safe first: ~$2k of WETH and ~$2k of USDC.

### 3.6 VM

- Small instance, patched OS with unattended security upgrades. SSH only via SSM / your IP / keys (no passwords). No other services on the box.
- Node 22 LTS, `npm ci` from the lockfile. Pin versions and don't auto-update dependencies on the production box.
- `/etc/rebalancer.env` (mode 600, from `.env.example`). It contains **no private keys**: KMS credentials come from the instance role.
- `STATE_DIR=/var/lib/rebalancer` on the persistent disk. It holds the in-flight tx, idempotency records and daily ledger. Losing it isn't catastrophic (the on-chain allowance still holds, and the nonce check catches unknown txs) but it weakens duplicate protection.
- Clock synced via chrony (ages of Chainlink data are compared with local time).
- systemd unit for your signal loop, which imports `executeRebalance`:

```ini
[Unit]
Description=treasury rebalancer
After=network-online.target
[Service]
EnvironmentFile=/etc/rebalancer.env
WorkingDirectory=/opt/rebalancer
ExecStart=/usr/bin/node --import tsx signal-loop.ts
Restart=always
RestartSec=30
User=rebalancer
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/rebalancer
[Install]
WantedBy=multi-user.target
```

What the signal loop must do with each result from `executeRebalance`:

| status | meaning | loop should |
|---|---|---|
| `filled` | done | continue |
| `deferred` | gas spike, stale oracle, pool≠oracle, RPC hiccup | retry later with a **new** decision id |
| `rejected` | breaks a policy limit (sent to the quiet channel) | shrink or skip |
| `busy` | previous tx still in flight | wait, then retry the **same** id |
| `duplicate` | this id was already handled | continue |
| `halted` | HALT file exists; you were paged | stop issuing decisions |
| `reverted` / `dropped` | no funds moved | new decision if still wanted |

### 3.7 Canary on mainnet (with the real KMS key and relay)

```bash
npx tsx rebalance.ts --side SELL_WETH --amount 0.2 --id canary-1 --dry-run
npx tsx rebalance.ts --side SELL_WETH --amount 0.2 --id canary-1
npx tsx rebalance.ts --side BUY_WETH  --amount 500 --id canary-2
```

On Etherscan, confirm: tx `from` = agent, `to` = Roles; internal call Safe → SwapRouter; tokenOut lands in the **Safe**; the Roles `allowances(...)` balance went down.

### 3.8 Ramp

Run the signal loop for 2–3 days with the canary funds and `MAX_TRADE_USD=2000`. Watch fills vs oracle (`realizedDevBps` in the logs; expect roughly 5–15 bps). Then move the rest of the treasury into the Safe and raise the limits to your real sizes.

---

## 4. Guards built into `rebalance.ts`

- **Off-chain limits:** per-trade USD, per-day USD, trades/day, max base fee. These are stricter than the on-chain allowance, which is the backstop.
- **Price protection:** QuoterV2 quote must be within `MAX_ORACLE_DEVIATION_BPS` (default 1%) of Chainlink, otherwise defer. `amountOutMinimum = max(quote − 0.30%, oracle − 1%)`. A sandwich or a manipulated pool can cost at most that much, and with private submission it normally costs nothing.
- **Deadline** of 180s inside the swap struct: a delayed tx reverts instead of filling at a stale price. The relays don't include reverting txs.
- **Private submission only.** No fallback to the public mempool.
- **Crash safety:** the signed tx and its hash are written to disk *before* broadcasting. The next run reconciles (mined, dropped after deadline, or halt if the nonce was used by an unknown tx). Decision ids make retries idempotent. A lock file prevents concurrent runs.
- **Fail closed:** anything unexpected (Roles rejecting a call the code thinks is valid, a fill below the minimum, a wrong chain id, a USDC depeg) writes `STATE_DIR/HALT`, pages you, and stops all trading until you delete the file.
- **The paging split:** routine events (fills, deferrals, policy rejections, allowance used up for the day) never page. Pages fire only on HALT, low gas ETH, or monitor anomalies.

---

## 5. Monitoring (runs **off** the VM)

The agent can't be trusted to report its own compromise, so these checks live elsewhere (Tenderly Alerts, or a cron script on a different provider):

| Check | Why | Severity |
|---|---|---|
| Any outgoing WETH/USDC `Transfer` from the Safe whose recipient isn't the 0.05% pool | Should be impossible via the role; means owner-level activity or a bug | **page** |
| Any tx by the agent EOA whose `to` isn't the Roles modifier | Key used outside the code path | **page** |
| Safe swaps with realized price >1% worse than Chainlink | Self-sandwich by a compromised key, or a bug | **page** |
| Roles/Safe config events (`AssignRoles`, `ScopeFunction`, `SetAllowance`, `EnabledModule`, `ChangedThreshold`, `AddedOwner`) | Nobody but you should cause these | **page** |
| KMS `Sign` from an unexpected principal; key policy changes (CloudTrail) | Cloud account compromise | **page** |
| Heartbeat: signal loop pings healthchecks.io (or similar) every cycle; alert if silent 2h | VM dead, stuck, or deferring forever (stale oracle, relay down) | warn → page after 6h |
| Agent ETH < 0.1 | Gas top-up needed | warn |
| Treasury value / allocation drifts outside expected band | Signal misbehaving | warn |

### Recommended: pre-signed kill switch

Any address can submit a Safe transaction once it carries enough owner signatures. So you can prepare the emergency revoke in advance:

1. In the Safe app, create a transaction to `ROLES_MODIFIER_ADDRESS` with data `assignRoles(agent, [roleKey], [false])` (the `revokeAgentCalldata` helper in `scripts/roles-permissions.ts` gives you the calldata) at the **next Safe nonce**. Sign it with 2 owners. **Don't execute it.**
2. Give the off-VM monitor the fully signed `execTransaction` payload, plus a separate funded EOA to submit it. On any **page**-level on-chain anomaly, the monitor submits it and the agent is cut off within a block, without waiting for you to wake up.
3. If this payload leaks, the worst anyone can do with it is revoke the agent (a pause). It moves no funds.
4. Catch: it's tied to the Safe nonce. Every time the owners run any other Safe tx, re-sign a new one at the new nonce. Put that in your runbook.

---

## 6. Runbooks

**6.1 Paged: "HALTED: …"**. Read `STATE_DIR/HALT` and the journal (`journalctl -u rebalancer`). Resolve the cause, then `rm STATE_DIR/HALT`. The HALT file stops the *honest* agent only. If you suspect compromise, go to 6.2.

**6.2 Suspected compromise (VM, AWS, or the key)**
1. Revoke: submit the pre-signed kill tx, or sign one in the Safe app: to = Roles, data = `assignRoles(agent,[role],[false])`. For a harder stop, `Safe.disableModule(prevModule, roles)`.
2. Disable the KMS key, stop the VM, snapshot the disk for forensics.
3. Check the Safe's history back to the last known-good point. Losses can't exceed the allowance for each day the attacker had.
4. Rebuild the VM from scratch, create a new KMS key, and assign the role to the new address (6.4).

**6.3 Tx stuck / "busy" for a long time.** `rebalance.ts` handles it: once the deadline plus 60s has passed, the tx is marked dropped and the nonce is reused. If you see `nonce consumed by unknown tx` → treat as 6.2.

**6.4 Rotate the agent key** (do it every 6–12 months, or right away if in doubt). Create the new KMS key → Safe batch: `assignRoles(new,[role],[true])` + `assignRoles(old,[role],[false])` → update `KMS_KEY_ID` → move leftover gas ETH → schedule deletion of the old key.

**6.5 Change limits.** Off-chain limits are env vars plus a restart. On-chain: Safe tx `Roles.setAllowance(key, balance, maxRefill, refill, 86400, now)`.

**6.6 USDC depeg halt.** The agent won't act for you. Decide by hand whether to hold USDC or exit to WETH (sign it through the Safe), then clear HALT once the peg is back.

**6.7 Withdrawing / moving the treasury.** Always a normal 2-of-3 Safe transaction. The agent has no part in it.

---

## 7. What you are on the hook for once it's running

**Weekly or ongoing**
- **Responding to pages.** Routine rebalancing never pages you. Security anomalies *must* reach someone who can act within hours. The pre-signed kill switch covers the first minutes, but a human still has to investigate. If you'll be unreachable (travel, holidays), lower the allowance or pause the role first.
- **Gas ETH** on the agent. Top up when warned.
- **Re-signing the kill switch** after every owner Safe transaction.
- **Reviewing** a weekly summary: fills vs oracle, fees paid, gas spent, allocation vs target, days the allowance ran out.
- **Security patches** for the OS and Node. Dependency updates (`viem`, AWS SDK) go through the fork test before they reach production.

**Periodic**
- **Key rotation** (6.4) and a yearly test that each owner hardware wallet still signs.
- **Allowance sizing** kept in line with real volume. The allowance is your compromise blast radius, so don't let it drift up out of convenience.
- **Dependencies on third parties:** Chainlink feed changes (the agent defers if a feed goes stale, and the heartbeat alert fires); Flashbots/MEV Blocker availability; Uniswap pool liquidity (the 0.05% pool is deep, but the oracle-deviation check stops trading if it thins); USDC contract changes (upgradeable, and Circle can freeze the Safe's USDC).
- **Records, tax, legal.** In most jurisdictions every swap is a taxable disposal. The JSON logs have a tx hash, amounts and oracle price for each trade, so ship them somewhere durable. If the treasury belongs to an entity or to other people, check whether automated trading of it needs anything formal. Not legal advice. Ask a professional.

**Accepted residual risks**
- A stolen agent key can burn up to the daily allowance per day until it's revoked (§1). The next step to shrink this is a Roles v2 *custom condition* contract that enforces `amountOutMinimum ≥ Chainlink price × (1 − x%)` on-chain. That would cap the loss from a stolen key at x% of the allowance. It is new Solidity and needs an audit before it guards $400k, so it isn't part of this week's launch.
- Smart-contract risk in Safe, Zodiac Roles v2, Uniswap V3 SwapRouter and USDC.
- Model risk: a bad signal trades badly at fair prices, within the limits you set.

---

## 8. Files

| File | Purpose |
|---|---|
| `rebalance.ts` | execution path: decision → checks → quote → Roles-wrapped swap → KMS signature → private relay → receipt. Library (`executeRebalance`) + CLI |
| `scripts/roles-permissions.ts` | generates the one-time Safe Transaction Builder batch (§3.4) and the revoke calldata |
| `scripts/fork-test.ts` | end-to-end rehearsal on a mainnet fork, including the negative permission tests |
| `.env.example` | config template for `/etc/rebalancer.env` |

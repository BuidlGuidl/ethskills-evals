# DEPLOY.md — putting the rebalancer in front of $400k

This file covers everything that has to exist before `rebalance.ts` trades the real
treasury, and what you're responsible for once it's running. Read §1 before anything
else. It explains why the setup isn't just "a private key on a VM".

Files in this directory:

| File | What it is |
|---|---|
| `rebalance.ts` | The execution path: decision → checks → KMS-signed tx → private submission → verified fill |
| `roles-setup.ts` | Builds the on-chain permission the agent key gets, as a Safe Transaction Builder batch |
| `fork-test.ts` | End-to-end test on a mainnet fork: real Safe, real Roles v2, real Uniswap pool, plus attack cases |

---

## 1. The architecture and the one number that matters

```
 you (2-of-3 hardware wallets)
        │ owns
        ▼
 ┌──────────────┐  module   ┌─────────────────────┐
 │ Treasury Safe│◄──────────│ Zodiac Roles v2 mod │◄── execTransactionWithRole ── agent EOA (AWS KMS key, gas ETH only)
 │ WETH + USDC  │           │ role "rebalancer"   │                                   ▲
 └──────┬───────┘           └─────────────────────┘                                   │ signs
        │ exactInputSingle (recipient = Safe)                                   rebalance.ts on cloud VM
        ▼                                                                             │ submits via
 Uniswap V3 SwapRouter ──► WETH/USDC 0.05% pool                          Flashbots Protect / MEV Blocker
```

**Why not just a hot wallet holding $400k:** a bot that runs unattended needs a key on
an internet-connected machine. If that key holds the funds, then one leaked `.env`, one
compromised npm dependency, or one cloud-console breach loses all $400k in a single
transaction, and nobody is awake to see it. In this design the key that sits on the VM
can only make one kind of call, and the chain enforces that limit, not the bot:

- it can only call `SwapRouter.exactInputSingle`, WETH↔USDC, 0.05% fee tier
- proceeds always go back to the Safe (`recipient == avatar`)
- each trade must be below a per-trade cap, and the total must fit a daily allowance (per direction)
- it cannot transfer, approve, send ETH, delegatecall, touch modules or owners, or call any other contract

`fork-test.ts` checks each of these limits against the real deployed contracts.

**The residual risk you are accepting.** `amountOutMinimum` is **not** constrained
on-chain. Roles v2 can't compare it against a market price. So someone who steals the
agent key (by compromising the VM or its cloud IAM role) can't take funds out of the
Safe, but they can make the Safe swap at a terrible price and sandwich it themselves.
That means:

> **Worst-case loss from a compromised agent key ≈ one day's WETH allowance + one day's
> USDC allowance, per day, until an owner revokes the role.**
> With the defaults in `roles-setup.ts` (≈$100k/day each direction), that's up to
> **≈$200k in the first 24 hours**.

The daily allowance is both the most the bot can trade in a day and the most a thief can
burn in a day. Pick the number with that in mind:

- If a normal day for you is 3–5 trades of $10–50k, you probably net far less than $100k
  in each direction. Set the allowances to your real 95th-percentile daily volume, not a
  generous round number.
- The watchdog auto-pause (§7) cuts the realistic loss to roughly the first bundle of
  attacker transactions. An attacker who bundles several swaps into one block can still
  drain a full day's allowance before the pause lands.
- **Hardening step (recommended before this runs unattended at full size for long):**
  add a Roles *custom condition* contract that checks
  `amountOutMinimum ≥ Chainlink price × (1 − 1.5%)` on-chain. That turns key compromise
  from "lose up to the daily allowance" into "lose up to ~1.5% of it". It's a small
  contract, but it's custom Solidity guarding real money. Get it reviewed, fork-test it,
  and don't write it in a hurry this week.

---

## 2. Accounts and keys to create

| Thing | How | Holds |
|---|---|---|
| **Owner key A** | Hardware wallet #1 (e.g. Ledger), fresh seed | nothing, signs Safe txs |
| **Owner key B** | Hardware wallet #2, *different vendor* (e.g. Trezor/GridPlus), fresh seed | nothing |
| **Owner key C (recovery)** | Third hardware wallet or metal-backed seed, stored off-site | nothing |
| **Treasury Safe** | app.safe.global, mainnet, owners A/B/C, **threshold 2** | the $400k in WETH + USDC |
| **Agent key** | AWS KMS asymmetric key, spec `ECC_SECG_P256K1`, usage `SIGN_VERIFY` | ~0.05–0.1 ETH for gas |
| **Watchdog key** | Separate plain EOA used only to execute the pre-signed kill switch (§7) | ~0.02 ETH for gas |

Rules:
- The agent key is **never** a Safe owner.
- Owner seeds never touch the VM, a password manager, or a cloud drive. Write them on metal and store them in two places.
- 2-of-3 means you can lose one device without losing the treasury, and one stolen device isn't enough to move funds.
- `rebalance.ts` also accepts `SIGNER=local-fork` with a raw key, but it refuses unless `RPC_URL` is localhost. There is no supported way to run a raw private key against mainnet, on purpose.

### AWS KMS setup (agent key)

1. Create the key: `aws kms create-key --key-spec ECC_SECG_P256K1 --key-usage SIGN_VERIFY --description rebalancer-agent`
2. **Key policy.** The only admin is your human IAM identity (MFA required). The VM's instance role gets only:
   ```json
   { "Effect": "Allow", "Action": ["kms:Sign", "kms:GetPublicKey"], "Resource": "<key-arn>" }
   ```
   The instance role must not have `kms:*`, key admin rights, or `ScheduleKeyDeletion`.
3. Get the agent address with `npx tsx rebalance.ts --check`. It prints `agent:`. Put that address into `roles-setup.ts`.
4. Turn on CloudTrail for KMS and alert on `Sign` calls from any principal other than the instance role, and on unusual `Sign` volume.
5. **Second kill switch:** `aws kms disable-key --key-id …`, run from your laptop or phone, stops a VM-level attacker from signing at all. Test it once.

(GCP Cloud KMS supports `EC_SIGN_SECP256K1_SHA256` too. `createKmsAccount` is the only function you'd rewrite to use it.)

---

## 3. Deploy the Safe and fund it in stages

1. Create the Safe (v1.4.1) at app.safe.global with owners A/B/C, threshold 2.
2. Send a $50 test deposit, then run one owner transaction end to end (e.g. a WETH transfer back out) so you know both hardware wallets can sign.
3. The treasury must be held as **WETH and USDC**, not native ETH. The role can't wrap ETH. If you have ETH, wrap it from the Safe (`WETH.deposit`).
4. **Don't move $400k in on day one.** Run the whole pipeline with $20–50k for a week (§8), then move in the rest.

---

## 4. Deploy the Roles modifier and grant the agent its permission

Use the audited, already-deployed contracts. Don't deploy your own copies.

| Contract | Mainnet address |
|---|---|
| Zodiac Roles v2 mastercopy | `0x9646fDAD06d3e24444381f44362a3B0eB343D337` |
| Zodiac ModuleProxyFactory | `0x000000000000aDdB49795b0f9bA5BC298cDda236` |

1. **Deploy a Roles proxy.** Use the Zodiac app inside Safe{Wallet} (Apps → Zodiac → Roles), or call `ModuleProxyFactory.deployModule(mastercopy, setUp(abi.encode(owner, avatar, target)), salt)` yourself with **owner = avatar = target = the Safe**. `fork-test.ts` does exactly this.
2. **Enable it as a module** on the Safe (owner transaction: `Safe.enableModule(roles)`).
3. **Grant the permission:**
   ```bash
   SAFE_ADDRESS=0x… ROLES_MODIFIER_ADDRESS=0x… AGENT_ADDRESS=0x… \
   ROLE_KEY=$(cast keccak rebalancer) \
   USDC_DAILY=100000 WETH_DAILY=40 USDC_PER_TRADE=55000 WETH_PER_TRADE=22 \
   npx tsx roles-setup.ts > roles-batch.json
   ```
   (`ROLE_KEY` can be any 32-byte value. This uses `keccak256("rebalancer")`, the same as the fork test. Put the same value in the bot's env.)
   Load `roles-batch.json` in Safe{Wallet} → Transaction Builder and check every call. The batch contains:
   - `assignRoles(agent, [ROLE_KEY], [true])`
   - `scopeTarget(ROLE_KEY, SwapRouter)`
   - `scopeFunction(ROLE_KEY, SwapRouter, exactInputSingle, <conditions>, None)`
   - `setAllowance` ×2: USDC-in and WETH-in, refilling every 24h
   - `WETH.approve(SwapRouter, max)` and `USDC.approve(SwapRouter, max)`, both from the Safe

   About the unlimited approvals: SwapRouter v1 is immutable and non-upgradeable, and it only pulls tokens from `msg.sender` during a swap that the Safe itself initiated. That's the standard way to integrate it. The bot re-checks the allowance before every trade and pages you if it's short.
4. **Before signing**, run the same batch against a fork (`fork-test.ts` uses the same `buildSetupCalls`) and confirm the attack cases fail.

**Allowances are in token units.** The WETH-side caps (`WETH_DAILY`, `WETH_PER_TRADE`) are in WETH, so their dollar value moves with ETH. If ETH doubles, your WETH-in dollar exposure doubles too. Re-size them when ETH moves more than ~25% (§9).

**Why SwapRouter v1 (`0xE592…1564`) and not SwapRouter02:** v1's `exactInputSingle`
carries `deadline` inside the struct, so the whole call can be scoped by Roles without
going through `multicall`. Both routers use the same pools.

---

## 5. Contracts the bot touches (all checked at startup by `verifyDeployment`)

| | Address | Checked |
|---|---|---|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | pool token1 |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | pool token0 |
| Uniswap V3 SwapRouter | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | `factory()` == V3 factory |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | |
| WETH/USDC 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | token0/token1/fee |
| Chainlink ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | staleness per call |
| Chainlink USDC/USD | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | staleness + peg per call |
| Your Roles proxy / Safe | env | `avatar()==target()==Safe`, module enabled |

If any of these checks fail, the bot doesn't trade.

---

## 6. The VM, RPCs and runtime

**RPC endpoints**
- `RPC_URL`: a paid provider (Alchemy/Infura/QuickNode) for reads, simulation and receipts. Public free endpoints rate-limit at the wrong moments.
- `PRIVATE_RPC_URLS`: defaults to `https://rpc.flashbots.net/fast,https://rpc.mevblocker.io`. The signed tx goes to every URL in the list and **never** to the public mempool, so trades of this size don't get sandwiched. Flashbots Protect won't include a tx that would revert, so failed trades don't cost gas. If none of the private endpoints accept the tx, the trade is skipped. The code never falls back to public broadcast.

**Environment** (`/etc/rebalancer.env`, mode 600, owned by the service user):
```
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/…
SAFE_ADDRESS=0x…
ROLES_MODIFIER_ADDRESS=0x…
ROLE_KEY=0x…
SIGNER=kms
KMS_KEY_ID=arn:aws:kms:…
AWS_REGION=…
STATE_DIR=/var/lib/rebalancer
ALERT_WEBHOOK_URL=…        # non-paging: Slack/Discord/Telegram, fills and skips
PAGE_WEBHOOK_URL=…         # paging: PagerDuty/Pushover/Opsgenie — wakes you (§7)
HEARTBEAT_URL=https://hc-ping.com/…
```
There's no private key in this file. AWS credentials come from the instance role, not from env.

**Process**
- Your signal engine calls `executeRebalance({ id, side, usdNotional })`. The `id` must be unique per decision and stable across retries, because that's what makes a retry safe (a repeated id is a no-op).
- A systemd timer runs `npx tsx rebalance.ts --check` every 10 minutes. It reconciles in-flight txs, verifies all the wiring, and pings the heartbeat. A lock file keeps it from overlapping a live trade.
- Use `npm ci` with the committed lockfile and pin Node 22 LTS. Don't auto-update dependencies on the box. Supply-chain compromise is one of the realistic ways this key gets stolen.
- VM hardening: SSH by key only (or SSM, with no open port 22), unattended security upgrades, the service runs as a non-root user, and the only outbound traffic allowed is to the RPCs, KMS and webhooks if you can manage that.
- `STATE_DIR` holds `ledger.json` (idempotency + nonce tracking) and `HALT`. Back it up. If it's lost, the bot re-syncs its nonce from the chain, but it forgets which decision ids it has already executed. Make sure the signal engine can't replay old decisions after a restore.

**Policy knobs** (`POLICY` in `rebalance.ts`): $1k–$50k per trade, $90k per direction per rolling 24h (kept below the on-chain allowance so the bot trips before the chain does), 0.30% slippage from the live quote, refuse if the quote is >1% worse than Chainlink, HALT if a fill is >1.5% worse than Chainlink, 40 gwei max fee, 5-minute deadline.

---

## 7. Monitoring and alerting — independent of the VM

The bot's own alerts go dark if the VM is compromised or down, so the important
watchers must run elsewhere.

**Heartbeat / dead-man's switch** (healthchecks.io or similar). This pages if no ping
arrives for 30 minutes. A missing heartbeat means the bot isn't running, which is safe
but not fine.

**On-chain watchers** (Tenderly Alerts, OpenZeppelin Monitor, or a small script on a
*different* host). Watch for:

| Event | Severity |
|---|---|
| Any Safe `ExecutionSuccess` (owner tx) you didn't initiate | **page** |
| Safe `AddedOwner` / `RemovedOwner` / `ChangedThreshold` / `EnabledModule` / `DisabledModule` / `ChangedGuard` | **page** |
| Roles modifier config changes (`AssignRoles`, `ScopeFunction`, `SetAllowance`, ownership) | **page** |
| Outgoing WETH/USDC transfer from the Safe to anything other than the 0.05% pool | **page** |
| Agent-key swap whose realized price is >1.5% worse than Chainlink | **page + auto-pause** |
| Agent ETH balance < 0.02 ETH | notify |
| Safe balances drift from expected by >2% in a day | notify |

**Pre-signed kill switch (auto-pause).** Get two owners to sign
`Safe.disableModule(prevModule, roles)` at the Safe's next nonce and leave it queued
and unexecuted in the Safe Transaction Service. (`prevModule` is `0x…0001` if Roles is
the only module.) The watchdog can then execute that fully-signed tx from its own
cheap key the moment it sees a bad fill. You don't need to be awake, and your hardware
wallets aren't involved. The worst someone could do with this signed tx is pause the
bot. One catch: every time you execute another owner tx, the Safe nonce moves and the
kill switch goes stale. **Re-sign it after every owner transaction.** Make that part of
your owner-tx checklist.

**What pages you vs. what doesn't.** Routine fills, skips (gas too high, quote off,
24h cap reached) and transient RPC errors go to the non-paging channel and a daily
digest. The bot pages only for these:

- `HALT`: the agent nonce was used by something other than the bot (possible key compromise), a fill was far off the oracle, a successful tx contained no Swap to the Safe, or USDC depegged by more than 1%
- the Safe's router allowance is short (an owner action is needed)

If you won't answer pages at night, the kill switch and the daily allowances are what
limit your loss until morning. Size the allowances for that (§1).

---

## 8. Rehearsal, in order

1. `npm ci && npx tsc -p .`
2. Fork test. Anvil must use chain id 1, because the bot refuses anything else:
   ```bash
   anvil --fork-url $RPC_URL --chain-id 1 --port 8545 &
   npx tsx fork-test.ts
   ```
   All checks must pass: both swap directions through the real pool, idempotency, per-trade cap, daily allowance, proceeds-elsewhere / approve / transfer / other-pool attempts all rejected, and HALT on foreign nonce use.
3. Mainnet, small: deploy the Safe + Roles, fund with $20–50k, set allowances to about 1/10 of the final values, and run `--check`, then `--dry-run`, then one real $1k trade by hand.
4. Test every kill switch for real, once: the `HALT` file, the pre-signed `disableModule`, `aws kms disable-key`, and revoking the role (`assignRoles(agent, [key], [false])`). Then restore.
5. Test alerting: trigger a page on purpose. For example, have the Safe approve the SwapRouter for 0 USDC, run a `BUY_WETH` decision, and confirm the page arrives. Then re-approve.
6. Run unattended at small size for a week. Read every fill in the digest.
7. Raise the allowances and move in the rest of the treasury.

---

## 9. What you're responsible for once it's running

**Daily (5 minutes, not at 3am):** read the digest of fills, skips and the realized
price vs Chainlink for each trade. Look at the agent's gas balance.

**When paged:**
- *HALT, possible key compromise:* execute the pre-signed `disableModule` (the watchdog may already have). Run `aws kms disable-key`. Then find out how the key was used before you rotate anything.
- *HALT, bad fill:* check whether it was a real market move or manipulation. Remove `STATE_DIR/HALT` only once you understand what happened.
- *HALT, USDC depeg:* decide the treasury policy yourself. The bot won't trade a depegged USDC in either direction.
- *Allowance short:* re-approve from the Safe.

**Recurring:**
- **Gas:** top up the agent EOA. At today's ~1 gwei base fee, a trade (~300–350k gas) costs well under 0.001 ETH, but the 40 gwei cap exists for spikes.
- **Re-size WETH allowances** when ETH moves more than ~25% (they're denominated in WETH).
- **Re-sign the kill switch** after every owner transaction.
- **Rotate the agent key** (new KMS key → `assignRoles(new,true)`, `assignRoles(old,false)`) on any suspicion and at least yearly.
- **Dependencies:** review before upgrading `viem`/`@aws-sdk`. Never upgrade on the box itself.
- **External changes:** watch for Chainlink feed deprecation notices, Uniswap router changes, and the USDC issuer's announcements. Circle can freeze USDC at any address, including your Safe. That's a counterparty risk this design doesn't remove.
- **Owner key hygiene:** confirm once a quarter that you still have access to 2 of the 3 owner keys.

**What the bot does *not* protect you from:**
- **Bad signals.** It guards *execution* (price, size, destination, MEV), not whether the trade was a good idea. A buggy signal that flips the treasury back and forth all day loses fees and slippage, up to the daily caps. Consider a turnover or drawdown circuit breaker in the signal engine.
- **Oracle and pool risk.** If Chainlink and the pool are both wrong in the same direction, the checks pass.
- **Everything outside the chain:** taxes and accounting (every swap is usually a taxable disposal; `ledger.json` plus an on-chain export is your record), and, if this treasury isn't solely your own money, whatever legal obligations come with managing it.

---

## 10. Pre-flight checklist

- [ ] Owners A/B/C on hardware wallets, seeds on metal in two places, threshold 2
- [ ] Safe deployed, test deposit + test owner tx done
- [ ] Treasury held as WETH + USDC
- [ ] KMS key `ECC_SECG_P256K1`, instance role has only `Sign` + `GetPublicKey`, CloudTrail alerting on
- [ ] Roles proxy deployed (owner/avatar/target = Safe), enabled as module
- [ ] `roles-batch.json` generated with allowances sized to *your* real volume, reviewed, fork-tested, executed
- [ ] `fork-test.ts` passes against the current mainnet state
- [ ] Agent funded with 0.05–0.1 ETH, watchdog key with 0.02 ETH
- [ ] Paid `RPC_URL`, private submission RPCs reachable
- [ ] Heartbeat, non-paging channel and paging channel wired, and a page tested end to end
- [ ] On-chain watchers running on a host other than the bot VM
- [ ] Pre-signed `disableModule` kill switch queued; watchdog can execute it
- [ ] `aws kms disable-key` and role revocation tested once
- [ ] One week at $20–50k with 1/10 allowances, fills reviewed
- [ ] Rest of treasury moved in, allowances raised to final values

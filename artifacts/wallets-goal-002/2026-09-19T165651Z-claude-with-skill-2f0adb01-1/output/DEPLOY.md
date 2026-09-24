# Deploying the treasury rebalancer (Ethereum mainnet)

The bot trades on its own. **The key it holds cannot move the treasury.** It can only
ask your Safe to do one narrowly scoped Uniswap swap. The Safe and the chain enforce
the limits, not the bot's own code. That is what makes it reasonable to run
unattended with $400k behind it.

```
 YOU (2-of-3 hardware wallets) ──own──▶ Treasury Safe v1.4.1  (holds all WETH + USDC)
                                              │ module
                                              ▼
 Agent EOA (key in AWS KMS) ──member──▶ Zodiac Roles v2 modifier (owner = the Safe)
   holds gas ETH only                         │ allows ONLY:
                                              ▼
            SwapRouter.exactInputSingle  WETH⇄USDC, fee 500, recipient == Safe,
            amountIn ≤ daily on-chain allowance, amountOutMinimum ≥ Chainlink − 1%
            (checked by PriceFloorCondition), no ETH value, no delegatecall
```

## What each compromise costs you

| Compromised | Attacker can | Worst case |
|---|---|---|
| VM / agent KMS key / bot code | Make swaps within the role: right pair, right pool, proceeds only to the Safe, at most 1% below Chainlink, capped by daily allowances | ≈ 1.05% (tolerance + pool fee) × daily allowance volume. With the defaults (60 WETH + 160k USDC per day) that is **~$3–4k/day**, plus the agent's gas ETH. Up to 2× in the day a refill period rolls over. |
| One owner hardware wallet | Nothing on its own (threshold 2) | Replace it using the other two. |
| Two owner wallets | Everything | Everything. Guard these as you would the $400k itself. |
| Chainlink ETH/USD stale or down | Nothing: the condition fails closed | The bot stops trading until the feed updates. |
| Your signal logic is wrong | Legitimate but bad trades | Fees + slippage on up to MAX_DAILY_USD/day. **Nothing on-chain protects you from your own strategy.** |

You can't get below that first row without either putting a human on each trade
(you've ruled that out) or tightening the caps. The caps are your main knob.

---

## Part 1: Set this up before real money goes in

Do these in order. Budget about two days, not two hours.

### 1. Owner keys (the root of everything)
- [ ] 3 hardware wallets, ideally two different vendors (e.g. Ledger + Trezor + Ledger/Keystone).
- [ ] Each seed phrase on metal or paper, in **3 separate physical locations**. Never photographed, never typed into a computer.
- [ ] Owner #3 can be a trusted person's hardware wallet instead of a third device of yours. That gives you recovery if you're unavailable.
- [ ] None of these keys ever go on the VM, and none of them are the agent key.

### 2. Treasury Safe
- [ ] Create a Safe on Ethereum mainnet at app.safe.global: the 3 owners, **threshold 2**.
- [ ] Do a test transaction that needs both signatures. Rehearse this, because it's also your emergency stop (Part 3).
- [ ] Don't fund it yet.

### 3. Agent key (AWS KMS)
- [ ] Create a KMS key: `KeySpec=ECC_SECG_P256K1`, `KeyUsage=SIGN_VERIFY`, single-region.
- [ ] Key policy: the VM's **instance role** may call only `kms:Sign` and `kms:GetPublicKey` on this key. Admin actions (`PutKeyPolicy`, `ScheduleKeyDeletion`, `DisableKey`) are restricted to your admin identity, which requires MFA. No IAM user access keys.
- [ ] CloudTrail on, so every `Sign` call is logged.
- [ ] AWS root account: hardware MFA, no access keys. An AWS account takeover means an agent-key takeover. That exposure is bounded by the role, but it's still yours.
- [ ] Get the address:
  ```bash
  KMS_KEY_ID=... AWS_REGION=... npx tsx -e "import('./rebalance.ts').then(async m => console.log((await m.kmsAccount(process.env.KMS_KEY_ID, process.env.AWS_REGION)).address))"
  ```
- [ ] Fund it with gas only (e.g. 0.2–0.5 ETH). Top it up from your personal wallet. It never needs more.

(GCP Cloud KMS / Azure Key Vault / a Turnkey-style signer work too; `kmsAccount()` is the only thing to swap. **Don't** use a raw private key in an env var or a `.env` file on a cloud VM.)

### 4. PriceFloorCondition contract
`contracts/src/PriceFloorCondition.sol` (~80 lines, stateless, no owner, no upgrade path).
This is **new, unaudited code that holds security weight**: it's what stops a stolen key
from dumping the treasury at a bad price. Have someone competent read it before
mainnet. It's short enough to review in an hour.
- [ ] `cd contracts && forge build`
- [ ] Deploy from an owner hardware wallet (it has no constructor args, so anyone could deploy it):
  `forge create src/PriceFloorCondition.sol:PriceFloorCondition --rpc-url $RPC --ledger --verify --etherscan-api-key $KEY`
- [ ] Confirm it's verified on Etherscan. Record the address as `PRICE_FLOOR_CONDITION`.

### 5. Prove it all on a mainnet fork
```bash
npm ci
anvil --fork-url $MAINNET_RPC --chain-id 1 --port 8547 &
npm run build:contracts
FORK_RPC=http://127.0.0.1:8547 npx tsx fork-test.ts
```
This creates a 2-of-3 Safe, applies **the same batch** your owners will sign, trades
through the real `executeRebalance()` path, then tries the attacks a stolen key would:
zero minOut, 3%-below-oracle minOut, recipient = attacker, other fee tier, other token,
over-allowance, direct `transfer`, delegatecall, self-granting roles, non-member caller,
and trading after the module is disabled. All must print `PASS`. Re-run this before
**any** change to caps, tolerance, or code.

### 6. Wire the permissions (one Safe batch)
```bash
SAFE_ADDRESS=0x... AGENT_ADDRESS=0x... PRICE_FLOOR_CONDITION=0x... \
WETH_DAILY_CAP=60 USDC_DAILY_CAP=160000 PRICE_FLOOR_BPS=100 \
npx tsx setup.ts batch > safe-batch.json
```
The batch deploys your Roles modifier through the Zodiac ModuleProxyFactory
(`0x000000000000aDdB49795b0f9bA5BC298cDda236`, mastercopy
`0x9646fDAD06d3e24444381f44362a3B0eB343D337`). Check both against the
gnosisguild/zodiac deployment list. The batch then enables the modifier on the Safe,
grants the role to the agent, scopes it to `exactInputSingle` with the conditions above,
sets the two daily allowances, and approves the SwapRouter for WETH and USDC.
- [ ] Safe{Wallet} → Apps → Transaction Builder → drag in `safe-batch.json`. Review each call, **simulate** it (built-in Tenderly simulation), then sign with 2 owners and execute.
  *(I didn't test importing raw-calldata JSON into the live UI. If it's rejected, paste the 9 `to`/`data` pairs as custom transactions in the same batch.)*
- [ ] Set `ROLES_MODIFIER` to the address printed by `setup.ts batch`.
- [ ] `READ_RPC_URL=... <same env> npx tsx setup.ts verify` → every line `OK`. This checks threshold ≥ 2, that the agent isn't an owner, that Roles is the **only** module, owner/avatar/target, allowances, and approvals.

**Sizing the on-chain caps.** They're the backstop, so keep them above your normal
day but well below "the whole treasury". The off-chain limits in `rebalance.ts`
(`MAX_TRADE_USD=50k`, `MAX_DAILY_USD=150k`) should always trip first. The WETH cap is
in ETH, so revisit it if ETH's price moves a lot.

### 7. The VM
- [ ] Dedicated instance, nothing else running on it. SSH by key only, or better SSM Session Manager with no open inbound ports. Automatic security updates.
- [ ] Instance role = the KMS permissions from step 3, plus read access to the Secrets Manager entries below. Nothing else.
- [ ] `STATE_DIR` on a **persistent** disk. The journal there is how the bot knows about in-flight transactions and the daily cap. Back it up.
- [ ] Run under systemd with `Restart=on-failure`. Your signal loop imports `executeRebalance()` and passes a unique `id` per decision (retries with the same id are no-ops).
- [ ] NTP on (deadlines and the journal use wall-clock time).
- [ ] `npm ci` from the committed lockfile. Don't let `^` ranges float in prod.

| Env | Value / note |
|---|---|
| `SAFE_ADDRESS`, `ROLES_MODIFIER`, `AGENT_ADDRESS` | From steps 2, 6, 3 |
| `SIGNER` | `kms` |
| `KMS_KEY_ID`, `AWS_REGION` | Step 3 |
| `READ_RPC_URL` | Paid provider or your own node. **Secret** (the URL embeds a key): keep it in Secrets Manager, not in git |
| `SUBMIT_RPC_URL` | Default `https://rpc.flashbots.net/fast`: private orderflow, never in the public mempool, so it can't be sandwiched |
| `ALERT_WEBHOOK_URL` | PagerDuty/Opsgenie/Telegram webhook. Secret |
| `MAX_TRADE_USD` / `MAX_DAILY_USD` / `MIN_TRADE_USD` | 50000 / 150000 / 1000 |
| `SLIPPAGE_BPS` | 40. **`SLIPPAGE_BPS + MAX_POOL_ORACLE_DEVIATION_BPS` must be < `PRICE_FLOOR_BPS` (100)**, or trades fail the on-chain floor in simulation |
| `MAX_POOL_ORACLE_DEVIATION_BPS` | 40. Refuses to trade when the pool and Chainlink disagree (Chainlink can lag up to 0.5% in fast markets; those trades are skipped, not forced) |
| `MAX_BASE_FEE_GWEI` | 40. Above this the bot waits instead of overpaying |
| `STATE_DIR`, `KILL_SWITCH_FILE` | `/var/lib/rebalancer`, `/var/lib/rebalancer/PAUSE` |

`.gitignore` already excludes `.env*`, keys, and state. Before every commit run
`git diff --cached | grep -iE 'private|secret|alchemy.com/v2/|infura.io/v3/'`.

### 8. Monitoring that does NOT run on the VM
The bot alerts on its own failures. It can't alert on its own compromise or its own
death. Run a watcher elsewhere (Tenderly Alerts, or a small script on another cloud
account or at home):
- **Page:** any Safe `ExecutionSuccess` (an owner tx) you didn't initiate · `EnabledModule`, `DisabledModule`, `AddedOwner`, `RemovedOwner`, `ChangedThreshold`, `ChangedGuard` · any Roles `AssignRoles`, `ScopeFunction`, `ScopeTarget`, `SetAllowance` · Safe USD value down more than X% in 24h beyond ETH's own move · agent nonce advancing without a matching journal entry.
- **Page:** heartbeat missing. Have the bot ping a dead-man's switch (healthchecks.io or similar) every loop, and get paged if it goes quiet for more than N hours.
- **Notify, don't page:** agent ETH low, base fee too high, oracle stale, a trade skipped because of a limit.

### 9. Ramp up
- [ ] Week 1: put **$5–10k** in the Safe, with `MAX_TRADE_USD`/`MAX_DAILY_USD` and the on-chain allowances scaled down to match. Let it trade for real.
- [ ] Check every trade on Etherscan against the journal: amounts, minOut, gas, and that proceeds landed in the Safe.
- [ ] Deliberately trip each alert once (touch PAUSE, drain agent gas on the fork, etc.).
- [ ] Then raise caps (a Safe tx: `setAllowance`) and move the rest of the treasury in.

"This week" works for the small-balance phase. Moving the full $400k in before a few
days of clean live trades is the step to skip.

---

## Part 2: What you're on the hook for once it's running

**You won't be woken up for routine rebalancing.** Nothing routine pages you. You
**will** be paged when something is wrong, and that is the price of running
unattended. If nobody responds, the exposure is the first table above, per day, until
someone does.

Ongoing duties:
1. **Gas.** Top up the agent EOA. Each trade is a Roles check plus a Uniswap swap, roughly a couple hundred thousand gas; measure yours with `--dry-run` (it prints `gas`).
2. **Owner keys.** Keep the 3 hardware wallets and seeds safe and reachable. Do a signing drill every quarter. If one is lost or suspect, `swapOwner` it using the other two **immediately**. You're one more loss away from losing access, or from an attacker having control.
3. **Caps.** Re-size the WETH allowance when ETH's price moves a lot. Re-size everything when the treasury grows. Every change is a 2-of-3 Safe tx; re-run `fork-test.ts` and `setup.ts verify` after each one.
4. **Your strategy.** The rails bound *how badly* a trade can execute, not *whether* it should happen. A signal bug that flip-flops will bleed fees and slippage every day, right up to `MAX_DAILY_USD`. Review the journal (`state/journal.jsonl`) weekly.
5. **External dependencies**, all fail-closed but yours to watch:
   - Chainlink ETH/USD (`0x5f4e…8419`). If Chainlink deprecates or migrates the feed, trades stop. Redeploy the condition and re-scope.
   - USDC. The price floor assumes 1 USDC = $1. In a depeg, USDC→WETH sells fail closed (they revert), but WETH→USDC sells would accept depegged dollars. **Pause the bot during a USDC depeg.** Circle can also freeze USDC held by any address, including your Safe. That's counterparty risk you accept by holding USDC.
   - Uniswap V3 0.05% pool liquidity. If it thins, the bot's deviation check blocks big trades. Trade smaller.
   - Flashbots Protect. If it's unavailable, trades fail and alert. You can point `SUBMIT_RPC_URL` at another private RPC. Don't fall back to the public mempool for $10–50k swaps.
   - Read-RPC provider outages mean no trades. That's fine.
6. **Software.** Patch the VM. Update `viem` and the AWS SDK deliberately, then re-run the fork test. Never auto-update.
7. **Records and tax.** Every swap is typically a disposal event. The journal plus on-chain history is your record, so keep it. Get an accountant's view on your jurisdiction. If the treasury isn't solely your money, check what licensing applies to trading it.

## Part 3: Emergency runbook

| Situation | Action | Speed |
|---|---|---|
| Something looks off, unsure | `touch $KILL_SWITCH_FILE` on the VM | Seconds, **if** the VM is trustworthy |
| Agent key / VM possibly compromised | Safe tx: `disableModule(0x…01, ROLES_MODIFIER)`, 2 owner signatures. Kills all agent access at once (fork-tested) | Minutes: as fast as you can gather 2 signatures. Keep 2 devices reachable. |
| After containment | New KMS key → Safe batch: `assignRoles(newAgent,[role],[true])`, `assignRoles(oldAgent,[role],[false])`, `enableModule(ROLES_MODIFIER)`. Rebuild the VM from scratch | Hours |
| Owner key lost/compromised | `swapOwner` via the other two owners | Minutes |
| Stuck/pending tx | Nothing. The router `deadline` (3 min) makes late inclusion revert. The journal blocks new trades until it resolves or ages out (30 min). Alerts tell you | Automatic |
| USDC depeg / market chaos | Pause (touch file). Resume manually | Seconds |

---

## Files

| File | What it is |
|---|---|
| `rebalance.ts` | Execution path: decision → checks → Roles-wrapped swap → KMS signature → Flashbots Protect → receipt verification → journal/alerts |
| `setup.ts` | Builds the owners' Safe batch (`batch`), audits live config (`verify`) |
| `contracts/src/PriceFloorCondition.sol` | On-chain Chainlink price floor for the role |
| `fork-test.ts` | End-to-end + adversarial test on a mainnet fork |

### Contracts touched (Ethereum mainnet)
| | Address |
|---|---|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Uniswap V3 SwapRouter (v1; has `deadline` in params) | `0xE592427A0AEce92De3Edee1F18E0157C05861564` |
| Uniswap V3 QuoterV2 (eth_call only) | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| Uniswap V3 USDC/WETH 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` |
| Chainlink ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` |
| Safe v1.4.1 singleton / proxy factory | `0x41675C099F32341bf84BFc5382aF534df5C7461a` / `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| Zodiac ModuleProxyFactory / Roles v2 mastercopy | `0x000000000000aDdB49795b0f9bA5BC298cDda236` / `0x9646fDAD06d3e24444381f44362a3B0eB343D337` |
| Your Safe, your Roles modifier, PriceFloorCondition, agent EOA | Created in steps 2, 6, 4, 3 |

### What has and hasn't been verified
- **Verified (2026-09-19):** every address above has code on mainnet. The whole flow passes on a mainnet fork: setup batch, two real trades through `executeRebalance()`, 11 attack attempts all blocked, allowance accounting, and module revocation. The KMS signer was tested against a mocked KMS (DER parsing, low-s normalization, recovery; 40/40 transactions recovered to the right address).
- **Not verified:** a real AWS KMS key, the live Flashbots Protect endpoint (the fork submits through anvil impersonation), and importing the batch JSON into the Safe UI. Step 9's small-balance phase covers all three. And, again, `PriceFloorCondition.sol` has not had an independent review.

# DEPLOY.md: unattended WETH/USDC rebalancer, Ethereum mainnet

## The one design decision

**The key on the VM never controls the $400k.** You said nobody approves trades one by one. So instead of a human approving each trade, you approve a **policy**, once, with your hardware keys. The chain enforces that policy on every trade the agent makes:

```
You (2-of-3 hardware keys)
   │ own
   ▼
Treasury Safe v1.4.1  ── holds all WETH + USDC ───────────────────────────┐
   │ module                                                              │ is msg.sender,
   ▼                                                                     │ pays tokenIn,
Zodiac Roles Modifier v2 ── role "rebalancer" ──► SwapRouter02.exactInputSingle
   ▲                        (the ONLY call allowed)          │           │ receives tokenOut
   │ execTransactionWithRole                                  ▼           │
Agent EOA (key in AWS KMS, holds ~0.1 ETH gas only)  USDC/WETH 0.05% pool ◄┘
                                                              ▲
                     OracleMinOutCondition ── checks minOut vs Chainlink ETH/USD
```

What the role allows, enforced onchain and verified in `fork-test.ts`:

| Field | Constraint |
|---|---|
| target / function | `SwapRouter02.exactInputSingle` only. No `transfer`, no `approve`, no other contract, no `multicall` |
| tokenIn → tokenOut | WETH→USDC or USDC→WETH |
| fee | 500 (the 0.05% pool, the deepest WETH/USDC pool) |
| recipient | must equal the Safe (`EqualToAvatar`) |
| amountIn | ≤ 20 WETH / 55,000 USDC per swap, and within a **daily allowance** of 60 WETH / 160,000 USDC (refills at 00:00 UTC) |
| amountOutMinimum | ≥ Chainlink-implied output − 1.5%; stale oracle (>65 min) ⇒ rejected |
| sqrtPriceLimitX96 | 0 |
| ETH value / delegatecall | forbidden |

**If the VM, the KMS key, or this code is fully compromised**, an attacker can only churn WETH↔USDC inside your Safe. Each swap is at most ~1.5% worse than Chainlink plus the 0.05% pool fee, and volume is capped by the daily allowances. The worst case works out to **≈ $5k/day** at today's prices, until you revoke the role. They cannot withdraw a single token. A compromise then becomes a problem you handle during the day, not a drained treasury. That is why you don't need to be woken up.

What still needs you urgently is **your owner keys** (see "What you're on the hook for").

## Files

| File | What it is |
|---|---|
| `rebalance.ts` | Execution path: decision → checks → KMS-signed tx → Flashbots Protect → verified receipt. `executeRebalance()` for your signal engine; CLI for manual/dry runs. |
| `roles-policy.ts` | The permission above, as code. Prints the exact calldata your Safe executes to install it, plus the kill-switch calldata. |
| `contracts/OracleMinOutCondition.sol` | ~40-line stateless Roles v2 custom condition (the Chainlink floor on `amountOutMinimum`). |
| `fork-test.ts` | End-to-end rehearsal on a mainnet fork: builds Safe + Roles + policy, runs real swaps both ways, proves 16 forbidden things revert. |
| `contracts/MockAggregator.sol` | Fork-test only. Never deploy. |

## Mainnet contracts touched

All were checked to have code on mainnet on 2026-09-19. The Roles mastercopy was also checked for the v2 function selectors.

| Contract | Address |
|---|---|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC (Circle, freezable) | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Uniswap V3 SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| Uniswap V3 QuoterV2 (reads only) | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| USDC/WETH 0.05% pool (traded against) | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` |
| Chainlink ETH/USD (1h heartbeat, 0.5% deviation) | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` |
| Chainlink USDC/USD (24h heartbeat) | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` |
| Safe v1.4.1 singleton / proxy factory | `0x41675C099F32341bf84BFc5382aF534df5C7461a` / `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| Zodiac ModuleProxyFactory | `0x000000000000aDdB49795b0f9bA5BC298cDda236` |
| Zodiac Roles Modifier v2 mastercopy | `0x9646fDAD06d3e24444381f44362a3B0eB343D337` |
| Flashbots Protect RPC (submission) | `https://rpc.flashbots.net/fast` |

---

## Part 1: What must exist before the $400k moves

Work through these in order. Steps 1–7 involve no treasury money.

### 1. Owner keys: 3 signers, threshold 2

- **Signer A:** hardware wallet (e.g. Ledger), kept with you.
- **Signer B:** hardware wallet from a *different vendor* (e.g. Trezor/Keystone), stored somewhere else (home safe vs. office).
- **Signer C (recovery):** a third hardware wallet in a bank box, or a person you trust who only ever signs recovery.
- Seed phrases go on paper or metal, offline, in separate places. **Never** on the VM, in a password manager synced to the VM, or in this repo.
- None of these is the agent key. The agent is never a Safe owner (`rebalance.ts` refuses to run if it is).

Why 2-of-3 for a solo builder: one lost or stolen device is survivable. If you lose 2 of 3, **the treasury is gone permanently.** Nobody can recover it.

### 2. Create the Safe

At app.safe.global, on Ethereum mainnet: create a Safe v1.4.1 with owners A, B, C and threshold 2. Send a $10 test transfer in and out to confirm that both hardware wallets can sign.

### 3. Create the agent key in AWS KMS

```bash
aws kms create-key --key-spec ECC_SECG_P256K1 --key-usage SIGN_VERIFY \
  --description "treasury rebalancer agent"
aws kms create-alias --alias-name alias/rebalancer-agent --target-key-id <KeyId>

# Derive the Ethereum address (last 64 bytes of the SPKI = X||Y)
aws kms get-public-key --key-id alias/rebalancer-agent --query PublicKey --output text \
  | base64 -d | tail -c 64 | xxd -p -c 64 \
  | xargs -I{} cast keccak 0x{} | cut -c 27- | xargs -I{} cast to-check-sum-address 0x{}
```

- The IAM role of the **VM instance** gets only this permission. Don't create access keys, and don't use `kms:*`:
  ```json
  { "Effect": "Allow", "Action": ["kms:Sign", "kms:GetPublicKey"],
    "Resource": "arn:aws:kms:<region>:<acct>:key/<KeyId>" }
  ```
- Enable CloudTrail for KMS so every signature is logged outside the VM.
- The private key can't be exported, so it never exists on the VM. It holds only gas money. Rotating or losing it is cheap: assign the role to a new key (`assignRoles(new,[ROLE],[true])`, `assignRoles(old,[ROLE],[false])`).
- Not on AWS? Any HSM or KMS that does secp256k1 works (GCP KMS `EC_SIGN_SECP256K1_SHA256`, Turnkey, etc.); swap out `createKmsAccount`. The minimum acceptable fallback is an encrypted keystore. **Not** a raw private key in `.env`.

### 4. Deploy the oracle condition

It is stateless and has no owner, so any account can deploy it:

```bash
forge build
forge create contracts/OracleMinOutCondition.sol:OracleMinOutCondition \
  --constructor-args 3900 --rpc-url $READ_RPC_URL --ledger --verify --etherscan-api-key $ETHERSCAN_KEY
```

Then check on Etherscan that the source is verified, and that `maxOracleAge()` returns 3900. `OracleMinOutCondition` is **not audited**. It's small and can only *reject* swaps: the Roles condition tree is a conjunction, so a bug can make trading halt, but can't grant anything. Still, have a second person read it.

### 5. Deploy the Roles modifier and install the policy (Safe transactions)

1. **Deploy Roles v2** with owner = avatar = target = **your Safe**. Easiest is the Zodiac app inside Safe{Wallet} (Apps → Zodiac → Roles v2). Or call `ModuleProxyFactory.deployModule(mastercopy, setUp(abi.encode(safe,safe,safe)), salt)` from any account, as `fork-test.ts` does. Afterwards, read `owner()`, `avatar()`, and `target()` on Etherscan: all three must be the Safe.
2. **Print the policy batch:**
   ```bash
   npx tsx roles-policy.ts <agentAddress> <oracleMinOutConditionAddress>
   ```
   Before printing, recompute `LIMITS` in `roles-policy.ts` from the ETH price that day. The WETH limits are in WETH, not USD.
3. **Queue one Safe batch** (Transaction Builder), then sign it with A and B:
   - `Safe.enableModule(<roles>)`
   - the 5 calls from step 2, each with `to = <roles>`, `value = 0`: `scopeTarget`, `scopeFunction`, `setAllowance` ×2, `assignRoles`
   - `WETH.approve(SwapRouter02, 200e18)` and `USDC.approve(SwapRouter02, 500_000e6)`. Standing approvals; the agent cannot approve. SwapRouter02 only pulls from `msg.sender`, so this is exposed only to a router bug. Top the approvals up when `rebalance.ts` pages about it.
   - Use the Safe UI's simulation, and read the decoded calls before signing.

### 6. Rehearse on a fork (required)

```bash
npm ci && forge build
anvil --fork-url $READ_RPC_URL &
npx tsx fork-test.ts      # must print ALL CHECKS PASSED
```

This builds the whole topology and executes real swaps through `rebalance.ts`. It then shows that each of these reverts: `amountOutMinimum=0` (self-sandwich), minOut 1.6% below the oracle, wrong recipient, wrong token, wrong fee tier, over the per-trade cap, over the daily allowance, a stale oracle, `transfer`, `approve`, delegatecall, ETH value, a non-member caller, and anything after the kill switch. It passed 25/25 against mainnet state on 2026-09-19.

### 7. Set up the VM

- A dedicated instance running only this process. No inbound SSH (use SSM/IAP). Unattended security updates. NTP on: the daily cap and oracle age checks depend on the clock.
- Run it as a non-root `rebalancer` user under systemd with `Restart=on-failure`. **Run exactly one instance.** Nonce handling and the daily-cap file assume a single executor.
- Put config in `/etc/rebalancer/env`, owned by root, mode `0600`, loaded via `EnvironmentFile=`. It holds no private key. The secrets in it are the RPC URL (with its API key) and the webhook URLs.
- Commit `package-lock.json` and install with `npm ci`. viem is pinned to an exact version. Review dependency bumps; supply-chain attacks target exactly this kind of box.
- `.gitignore` already excludes `.env*`, keys, and state/log files. Before any push, run: `git diff --cached --name-only | grep -iE '\.env|key|secret'`.

| Env var | Required | Meaning |
|---|---|---|
| `READ_RPC_URL` | yes | Paid mainnet RPC (Alchemy/Infura/QuickNode) for reads, simulation, receipts |
| `SUBMIT_RPC_URL` | no | Default `https://rpc.flashbots.net/fast`. Never point this at a public mempool RPC |
| `AWS_REGION`, `KMS_KEY_ID` | yes | KMS agent key (alias ok) |
| `AGENT_ADDRESS` | yes | Address derived in step 3. The process refuses to run if KMS resolves to anything else |
| `SAFE_ADDRESS`, `ROLES_MODIFIER_ADDRESS` | yes | From steps 2 and 5 |
| `ROLE_KEY` | yes | `0x726562616c616e636572` padded to 32 bytes (printed by `roles-policy.ts`) |
| `MAX_TRADE_USD` / `MIN_TRADE_USD` / `DAILY_CAP_USD` | no | Off-chain limits: 50,000 / 1,000 / 200,000. Keep them *tighter* than the onchain ones |
| `SLIPPAGE_BPS`, `MAX_ORACLE_DEVIATION_BPS` | no | 30 / 100. Their sum must stay below the onchain floor of 150 |
| `MAX_FEE_GWEI` | no | 40. Above this the agent skips the trade instead of overpaying |
| `INFO_WEBHOOK_URL` | no | Routine channel (Slack/Telegram). Read it when you like |
| `PAGE_WEBHOOK_URL` | **yes in practice** | Needs-a-human channel (PagerDuty/Opsgenie/phone) |
| `STATE_PATH`, `LOG_PATH`, `HALT_FILE` | no | Local state, JSONL audit log, kill-file path |

### 8. Monitoring that does not run on the VM

If the VM is compromised, its own alerts can't be trusted. Set up an external watcher (Tenderly Alerts, OpenZeppelin Monitor, or Safe's notifications) on:

- **Wake me:**
  - any token leaving the Safe to an address other than the USDC/WETH pool `0x88e6…5640`
  - any Safe owner, threshold, module, or guard change
  - any owner transaction you didn't initiate (`ExecutionSuccess`)
  - any Roles config change (`ScopeFunction`, `AssignRoles`, `SetAllowance`, …)

  None of these can come from the agent. They mean an owner key is compromised.
- **Morning:** the agent EOA's ETH balance < 0.03, and no `rebalance.executed` or aborted log line in 24h (a dead process).

### 9. Pre-sign the kill switch (break-glass)

Create a Safe transaction `to = <roles>`, `data = killSwitch` (printed by `roles-policy.ts`; `revokeTarget(ROLE, SwapRouter02)`). Sign it with A and B, but **don't execute it**. Export the signatures.

Once it has 2 signatures, anyone can submit it with `execTransaction` from any funded address, e.g. a small "panic" EOA on your phone, or with `cast send`. You can then stop the agent in one transaction without finding two hardware wallets.

The signed transaction is tied to the Safe nonce. Agent swaps go through the module and **don't** consume Safe nonces, but every owner transaction does. After each owner transaction, re-sign a fresh kill transaction at the new nonce. Leaking it is harmless: all it can do is stop trading.

The full stop is `Safe.disableModule(0x…0001, <roles>)`. With Roles as the only module, `prevModule` is the sentinel `0x0000000000000000000000000000000000000001`.

### 10. Fund the agent and canary

1. Send **0.1 ETH** to the agent EOA for gas. Measured on the fork, a swap uses ~310k gas: ≈ 0.0006 ETH at 2 gwei, ≈ 0.012 ETH at the 40 gwei cap.
2. Move **~$5k** into the Safe. Run `npx tsx rebalance.ts WETH_TO_USDC 0.5 --dry-run`, then without `--dry-run`. Check the transaction on Etherscan: the Safe sent WETH and received USDC, and nothing else moved.
3. Run the signal engine for 2–3 days with `MAX_TRADE_USD=2000`. Watch both webhook channels and compare the realized prices in the JSONL log with what you expected.
4. Scale up in steps: ~$50k for a few days, then the full treasury. Keep any funds outside the policy's needs (e.g. reserve ETH) out of this Safe.

---

## Part 2: What you're on the hook for once it's running

### Responding to alerts

`rebalance.ts` sends `info` for every executed trade and routine skip (high gas, an earlier transaction still pending, below min size). It sends `page` when something needs a human **within hours, not minutes**. The policy bounds the damage, so none of these justify a 3am wake-up:

| Page | Likely cause | What you do |
|---|---|---|
| `Chainlink … stale`, `USDC off peg`, `pool quote deviates` | Oracle outage, USDC depeg, a manipulated or broken pool | Nothing: it failed closed and won't trade. Decide whether the strategy still makes sense (e.g. in a USDC depeg). |
| `executed at a bad price` | Price moved during inclusion, or a bug | Check the transaction. Repeated occurrences mean `HALT` it and investigate. |
| `simulation reverted` | Daily allowance used up (the signal engine is over-trading), or the policy changed | If the engine is doing this, it's a strategy bug. Don't raise the allowance to "fix" it. |
| `allowance too low` | The standing Safe→router approval is used up | Owner transaction: re-approve (then re-sign the kill switch). |
| `agent gas balance low` | Normal consumption | Send ETH to the agent EOA. |
| `KMS key resolves to …`, `agent is a Safe owner`, `module not enabled` | Misconfiguration or tampering | Stop and investigate before re-enabling. |
| unexpected error / RPC down | Provider outage | It retries on the next signal. Nothing falls back to the public mempool. |

**Suspected compromise of the VM or KMS:** submit the pre-signed kill switch. Then rotate: new VM, new KMS key, `assignRoles` for the new key, re-sign the kill switch. Treasury funds never left the Safe.

**Suspected compromise of an owner key:** this is the real emergency. With the other two keys, `swapOwner` the compromised key out immediately. The external watcher from step 8 is what tells you about this.

### Routine obligations

- **Gas:** top up the agent EOA roughly monthly.
- **Limits:** the WETH limits in the policy are in WETH. If ETH moves ±30%, recompute them in `roles-policy.ts` and re-apply `setAllowance` / `scopeFunction` with an owner transaction.
- **Approvals:** top up the Safe→SwapRouter02 approvals when paged.
- **Kill switch:** re-sign after *every* owner transaction.
- **Owner keys:** do a test signature with each device every quarter, keep firmware updated, and confirm the recovery signer still exists and is reachable.
- **Dependencies:** security updates for Node/OS/viem/AWS SDK, applied deliberately, with the fork test re-run after each one.
- **External dependencies you are trusting:**
  - Chainlink ETH/USD is the price reference both onchain and off-chain.
  - Circle can freeze USDC held by any address, including your Safe.
  - Uniswap pool liquidity: the 0.05% pool is deep, but check it before raising per-trade limits.
  - Flashbots Protect can delay or drop transactions. `rebalance.ts` then reuses the same nonce, so it never double-trades.
  - Your RPC provider.
- **Records:** every swap is likely a taxable disposal where you live. `rebalance-log.jsonl` plus the Safe's onchain history is your ledger. Back up the log off the VM.

### What the policy does *not* protect you from

- **Your strategy being wrong.** The policy stops theft and bad fills. It can't tell whether selling ETH today is smart. A buggy signal can churn up to the daily allowances, losing ~0.05% fee plus slippage per swap, and it can hold the wrong asset through a move.
- **Oracle-lagged fills.** Chainlink ETH/USD updates on 0.5% moves, so "1.5% below Chainlink" can be ~2% below the true price during fast markets. The off-chain check (fresh quote − 0.3%, and the quote must be within 1% of Chainlink) is tighter for honest trades. The 1.5% onchain floor is the bound for a compromised signer.
- **Owner-key compromise**, covered above.
- **Unaudited code.** `rebalance.ts` is not a security boundary; the role is. `OracleMinOutCondition.sol` is part of the boundary but is unaudited. The Safe, Zodiac Roles v2, and Uniswap V3 are audited and have been used heavily in production.

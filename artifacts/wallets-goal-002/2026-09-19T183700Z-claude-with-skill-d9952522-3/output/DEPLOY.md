# DEPLOY.md: WETH/USDC treasury rebalancer

This runbook covers what has to exist before `rebalance.ts` signs anything with ~$400k behind it, and what you are responsible for once it runs.

## 0. The one design decision that matters

The agent runs unattended on a cloud VM, so **assume its key will leak at some point.** Possible causes include a VM compromise, a leaked cloud credential, a malicious npm dependency, or a log line you didn't mean to write. So what matters is what that key is allowed to do, not how well it's hidden.

This design does **not** give the agent a key that holds or controls the treasury. Encrypting that key, putting it in a KMS, or keeping it in a secret manager would limit *who* can use it. It would not limit *what* it can do. If one key can move $400k, one stolen key takes $400k.

Instead:

```
                 ┌───────────────────────────────────────────┐
  you, 2 of 3    │ Treasury Safe (Safe 1.4.1)                │   holds all WETH + USDC
  hardware  ───► │   owners: 3 hardware wallets, threshold 2 │   (the ~$400k)
  devices        │   module: Roles Modifier v2 ──────────────┼──┐
                 └───────────────────────────────────────────┘  │ execTransactionFromModule
                                                                 │ (only if the policy passes)
                 ┌───────────────────────────────────────────┐  │
                 │ Zodiac Roles Modifier v2 (your proxy)      │◄─┘
                 │   owner = avatar = target = the Safe       │
                 │   role "rebalancer" → agent EOA            │
                 └───────────────────────────────────────────┘
                                   ▲ execTransactionWithRole(...)
                 ┌───────────────────────────────────────────┐
  cloud VM  ───► │ Agent EOA — holds ~0.05–0.1 ETH for gas    │
                 │ NOT a Safe owner. Holds no WETH/USDC.      │
                 └───────────────────────────────────────────┘
```

### What the agent key can do (enforced on-chain by Roles, not by our code)

The agent can make the Safe call exactly one function: `SwapRouter02.exactInputSingle`. Each of these conditions must hold, or Roles reverts:

| field | constraint |
|---|---|
| target | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` (Uniswap V3 SwapRouter02) only |
| function | `exactInputSingle` only (selector `0x04e45aaf`) |
| tokenIn → tokenOut | WETH → USDC **or** USDC → WETH, nothing else |
| fee | `500` (the 0.05% pool `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640`) |
| recipient | the Safe itself (`EqualToAvatar`) |
| amountIn | within a per-token **daily allowance** (WETH key and USDC key, refilling every 24h, no carry-over) |
| operation | `Call` only. No delegatecall, no ETH value |

### What the agent key cannot do

The agent key cannot:

- transfer or approve tokens
- swap into any other token or pool
- send proceeds anywhere but the Safe
- call the Safe (owners, threshold, modules, guard)
- call the Roles modifier's admin functions (its owner is the Safe)
- raise its own allowance

`npx tsx rebalance.ts verify-policy` checks each of these against the live contracts.

### Operations that need a human, meaning 2 of your 3 hardware signatures on the Safe

- Moving principal in or out of the Safe.
- Raising, lowering, or refilling the agent's allowances.
- Changing the policy in any way, such as a new pool, token, router, or fee tier.
- Granting the role to a key, or revoking it.
- Adding or removing Safe owners, or changing the threshold, modules, or guard.
- Token approvals.

### How you evict the agent without its cooperation

Revocation is one Safe batch signed by 2 owner devices: `npx tsx roles-policy.ts revoke`. It revokes the role and zeroes both allowances. The agent does not need to be reachable, honest, or running. **Shutting down the VM does not stop a stolen key.** Only this revocation does. See §6.

### Honest statement of the remaining risk

Roles bounds *which* trades and *how much volume*. It cannot compare `amountOutMinimum` to a live price. Someone holding the agent key could submit in-policy swaps with `amountOutMinimum = 0` and sandwich them. That turns up to the **currently available allowance** into loss, plus more as the allowance refills until you revoke.

**Worst case per day while the key is compromised ≈ WETH allowance (in USD) + USDC allowance, plus the gas float.**

So size the allowances to what you would accept losing in one day, and not to the most you might want to trade:

| WETH/day | USDC/day | worst-case loss/day (ETH ≈ $2,640) | trades it supports |
|---|---|---|---|
| 10 WETH | 30,000 | ≈ $56k | 1–2 mid-size trades per direction |
| 20 WETH | 60,000 | ≈ $113k | about "a handful" at $10–50k |
| 40 WETH | 120,000 | ≈ $226k | more than you described needing |

**Recommended hardening before you raise allowances past what you're comfortable losing in one day:** add a Roles `Custom` condition on `amountOutMinimum`. This is a small adapter contract implementing Roles' `ICustomCondition`. It reads `amountIn` from the calldata and requires `amountOutMinimum ≥ Chainlink price × (1 − ~1%)`. That caps even a compromised key at about 1% loss per trade. It is new Solidity guarding real money, so get it reviewed, fork-test it with `fork-test.ts`, and add it through the same Safe batch. Until then, the allowance is your bound.

The execution code also checks price (Chainlink cross-check, slippage cap, per-trade USD cap, private submission). That protects **honest** operation from MEV and bad quotes. It does nothing against someone who holds the key and doesn't run our code.

---

## 1. Accounts and contracts

| what | address | who controls it |
|---|---|---|
| Treasury Safe | yours (create in §3.2) | 2-of-3 hardware wallets |
| Roles Modifier v2 proxy | yours (create in §3.4) | the Safe |
| Agent EOA | yours (create in §3.3) | the VM (unattended) |
| Owner keys ×3 | hardware wallets | you |
| WETH9 | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | immutable |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | Circle (upgradeable; can blacklist) |
| Uniswap V3 SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | immutable |
| Uniswap V3 QuoterV2 (read) | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | immutable |
| USDC/WETH 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | immutable |
| Chainlink ETH/USD (read) | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | Chainlink |
| Chainlink USDC/USD (read) | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | Chainlink |
| Roles v2 mastercopy | `0x9646fDAD06d3e24444381f44362a3B0eB343D337` | Gnosis Guild |
| Zodiac ModuleProxyFactory | `0x000000000000aDdB49795b0f9bA5BC298cDda236` | immutable |

I checked every address above for deployed code on mainnet, and `fork-test.ts` uses each of them against a mainnet fork.

## 2. Files

| file | purpose | signs? |
|---|---|---|
| `rebalance.ts` | the execution path: decision → checks → Roles call → signed tx → private submission → verified receipt. Also has `preflight` and `verify-policy`. | agent key only |
| `roles-policy.ts` | builds the Safe transactions for setup and revocation, as Transaction Builder JSON | nothing; owners sign in Safe{Wallet} |
| `fork-test.ts` | end-to-end rehearsal on an anvil mainnet fork | fork-only throwaway keys |

---

## 3. Setup, in order

### 3.1 Owner keys: three hardware wallets

- Use three hardware wallets, ideally from two different vendors. Each generates its own seed **on the device**.
- One person holding all three is fine. Two-of-three means a thief needs two devices, and you can lose one without losing the treasury. A single hardware wallet is *less* safe than this, because there is one device to lose, break, or be coerced out of.
- Keep one device and its seed backup off-site, away from the other two. Never photograph a seed, type it into a computer, or store it in a password manager.

### 3.2 Treasury Safe

- Create a Safe (v1.4.1) on Ethereum mainnet at app.safe.global. Owners are the 3 hardware addresses, **threshold 2**.
- **Do not** add the agent as an owner. `rebalance.ts` refuses to run if you do.
- Test it with a small deposit and a 2-of-3 withdrawal before moving real money.

**If the $400k currently sits in a plain EOA:** it has to move to the Safe, which is a new address. EIP-7702 lets an EOA keep its address and batch transactions. But delegating the EOA does not take authority away from its original key, and that key can still move everything alone. A treasury behind a threshold needs a threshold account, so a new address is necessary here.

### 3.3 Agent key

- Generate it **on the VM, directly into your secret manager** (GCP Secret Manager, AWS Secrets Manager, or `systemd-creds`). It must never appear on a terminal, in shell history, in a chat, a ticket, a CI log, or an AI prompt. **If it ever does, treat it as burned:** revoke the role (§6), generate a new key, and never reuse the old one.
- Nothing that signs is in this repo. `.gitignore` already excludes `.env*`, `*.key`, and `keystore/`. Keep it that way before the first push, because deleting a committed secret afterwards does not un-leak it.
- Inject it at process start as `AGENT_PRIVATE_KEY`, from a root-owned 0600 credential file or a secret-manager fetch in the unit's `ExecStartPre`.
- Fund it with **0.05–0.1 ETH** only. On the fork, a swap used about 275–280k gas. At a few gwei that is under $2 per trade, so 0.05 ETH lasts weeks. This ETH is the only asset the key holds directly.
- Optional upgrade: a cloud KMS secp256k1 key means the key can't be copied off the VM, only used while the VM is compromised. That helps, but it does not replace §0. The on-chain allowance is still the bound.

### 3.4 Roles Modifier

- Deploy a Roles v2 proxy with **owner = avatar = target = your Safe**. Either use the Zodiac app in Safe{Wallet} (Apps → Zodiac → Roles) or call `ModuleProxyFactory.deployModule(mastercopy, setUp(abi.encode(safe, safe, safe)), salt)`. `fork-test.ts` shows the exact call.
- `rebalance.ts preflight` checks that the Roles owner, avatar, and target are all your Safe and that the module is enabled.

### 3.5 Apply the policy (one Safe batch, 2 signatures)

```bash
SAFE_ADDRESS=0x… ROLES_MODIFIER_ADDRESS=0x… AGENT_ADDRESS=0x… \
WETH_ALLOWANCE_PER_DAY=… USDC_ALLOWANCE_PER_DAY=… \
  npx tsx roles-policy.ts > rebalancer-setup.json
```

Import `rebalancer-setup.json` into Safe{Wallet} → Transaction Builder. The batch contains:

1. `enableModule(roles)`
2. WETH.approve(SwapRouter02, max)
3. USDC.approve(SwapRouter02, max)
4. `scopeTarget`
5. `scopeFunction(exactInputSingle, <condition tree>)`
6. WETH allowance
7. USDC allowance
8. `assignRoles(agent)`

**Read each decoded transaction on the hardware device before signing.** In particular, `enableModule` should name your Roles proxy and nothing else.

Generate the **revocation batch now**, while you're calm, and keep it next to your hardware wallets:

```bash
SAFE_ADDRESS=0x… ROLES_MODIFIER_ADDRESS=0x… AGENT_ADDRESS=0x… npx tsx roles-policy.ts revoke > rebalancer-REVOKE.json
```

### 3.6 Verify the policy on-chain

```bash
npx tsx rebalance.ts preflight
npx tsx rebalance.ts verify-policy     # must print "Policy OK." — 13/13
```

`verify-policy` simulates, as the agent, calls that must be rejected (theft, wrong recipient, wrong pool, over-allowance, delegatecall, adding itself as an owner) and calls that must pass. It signs nothing. Re-run it after **every** policy change.

### 3.7 Fork rehearsal (do this first, before 3.2)

```bash
anvil --fork-url $RPC_URL --chain-id 1 --port 18545
ANVIL_URL=http://127.0.0.1:18545 npx tsx fork-test.ts
```

The rehearsal deploys a real Safe and Roles proxy on the fork, applies the exact policy, and runs these checks:

- a WETH→USDC trade and a USDC→WETH trade
- an over-allowance trade, blocked by Roles before signing
- an over-cap trade, blocked off-chain
- the 24h refill
- revocation
- the owner-key guard

I ran it green against mainnet state on 2026-09-19.

### 3.8 VM and runtime

- Use a dedicated VM for this one job. Allow SSH by key only, from your IP, or use your cloud's IAP/SSM instead of open SSH. Run the process as a non-root service user.
- Pin dependencies (`package-lock.json` committed; `npm ci`) and don't auto-update. A malicious dependency is the most likely way this key leaks.
- `RPC_URL` is a paid provider (Alchemy, Infura, QuickNode, or your own node) used for reads. `PRIVATE_TX_RPC_URL` defaults to Flashbots Protect (`https://rpc.flashbots.net/fast`), so swaps never sit in the public mempool.
- Configuration (names only; values come from your secret manager or unit file, never from the repo):
  - **Required:** `RPC_URL`, `SAFE_ADDRESS`, `ROLES_MODIFIER_ADDRESS`, `ROLE_KEY`, `AGENT_PRIVATE_KEY`, `AUTONOMOUS`
  - **Tunable:** `PRIVATE_TX_RPC_URL`, `MAX_TRADE_USD`, `MAX_SLIPPAGE_BPS`, `MAX_ORACLE_DEVIATION_BPS`, `MAX_FEE_GWEI`, `MIN_GAS_FLOAT_ETH`, `LOCK_FILE`, `STATE_FILE`
- `ROLE_KEY` is `0x726562616c616e63657200000000000000000000000000000000000000000000` (`"rebalancer"`).
- Put `LOCK_FILE` on tmpfs (`/run/...`) so a reboot clears it. After a crash, the lock stays and further trades are refused. That fails closed, and it should alert you.
- The signal engine calls `executeRebalance({ direction, amountIn, signalId })` from `rebalance.ts`. Only one process may sign with the agent key.

### 3.9 Staged go-live (fits in a week)

| day | Safe holds | allowances | mode |
|---|---|---|---|
| 1 | ~$5k | tiny (1 WETH / 3k USDC) | interactive: every trade stops at a y/N prompt showing amount, checksummed addresses, and live gas cost |
| 2–3 | ~$5k | tiny | `AUTONOMOUS=1`; confirm the monitoring from §4 fires on real events |
| 4+ | full treasury | your chosen size from §0 | `AUTONOMOUS=1` |

Moving the principal in and raising the allowances are both 2-signature Safe transactions. That is deliberate.

---

## 4. Monitoring: what wakes you and what doesn't

Run the monitor **somewhere other than the agent VM**, for example Tenderly alerts, OpenZeppelin Monitor on another cloud, or a small cron on a different provider. Otherwise the same compromise that steals the key also silences the alarm.

**Page immediately (wake you up). Each of these means possible compromise or broken assumptions:**

- Any transaction from the agent EOA that doesn't match a `rebalance.submitted` line in the agent's own logs. Compare nonces: an unexplained nonce is the key being used by someone else.
- Any Safe event: `AddedOwner`, `RemovedOwner`, `ChangedThreshold`, `EnabledModule`, `DisabledModule`, `ChangedGuard`, `ChangedModuleGuard`, or any `ExecutionSuccess` you didn't sign.
- Any Roles modifier configuration event (role, scope, or allowance changes) you didn't sign.
- A swap from the Safe whose realized price is more than ~1% worse than Chainlink at that block. That is the signature of the sandwich attack described in §0.
- Allowance consumed faster than the strategy's normal pace, for example over 80% before noon UTC.
- Safe total value (at oracle prices) dropping more than X% in a day. Pick X to sit above normal ETH volatility times your WETH weight.

**Daily digest (don't wake you):**

- trades executed, fills against the oracle, gas spent
- aborted decisions (oracle stale, deviation, gas cap, USDC depeg, `lock held`)
- agent gas float below `MIN_GAS_FLOAT_ETH`; the agent refuses to trade below it

## 5. How a trade executes (`rebalance.ts`)

1. **Lock:** single writer, so no nonce races.
2. **Preflight (on-chain):** chainId 1; the agent is not a Safe owner; threshold ≥ 2; the Roles module is enabled; the Roles owner, avatar, and target are all the Safe; the gas float is sufficient.
3. **In-flight check:** if the previous private tx is unmined and under 6 minutes old, don't stack another trade. After that, the next trade reuses the same nonce, so at most one can execute.
4. **Oracle:** Chainlink ETH/USD must be under about 65 minutes old and USDC/USD under 25 hours old, measured against chain time. Refuse if USDC is more than 1% off peg.
5. **Per-trade USD cap:** `MAX_TRADE_USD`, default $50k.
6. **Safe checks:** the Safe's balance and its router approval.
7. **Quote and minimum output:** QuoterV2 quote. Abort if the quote is more than 75 bps below the oracle. `amountOutMinimum` = min(quote, oracle) × (1 − 30 bps).
8. **Encode:** the inner call is `exactInputSingle(recipient = Safe)`. The outer call is `Roles.execTransactionWithRole(router, 0, inner, Call, ROLE_KEY, shouldRevert = true)`.
9. **Simulate as the agent:** this is where the on-chain policy rejects anything out of bounds, before signing.
10. **Gas:** estimate, add a 30% buffer, price live with EIP-1559, abort above `MAX_FEE_GWEI`, and convert the cost to USD at the live oracle price.
11. **Gate:** log amount, checksummed signer / Roles / router / Safe, min-out, and max gas cost. Prompt y/N unless `AUTONOMOUS=1`.
12. **Sign and submit:** sign locally and send the raw tx only through Flashbots Protect.
13. **Confirm:** wait for the receipt, then check the Safe's tokenOut balance at that block against `amountOutMinimum`.

## 6. Incident runbook

**If you suspect the agent key is compromised** (unexplained nonce, weird fills, VM breach, or the key showed up anywhere it shouldn't have):

1. Open Safe{Wallet} → Transaction Builder → load `rebalancer-REVOKE.json` → sign with 2 devices → execute. This revokes the role and sets both allowances to 0. From then on, the key can only burn its own gas float.
2. Only after that, stop the VM and preserve its disk for forensics.
3. Generate a new agent key on a fresh VM, re-run `roles-policy.ts` for the new address (you only need the `assignRoles` and `setAllowance` parts), run `verify-policy`, and fund a new gas float. Never reuse the old key.

**If one owner device is lost:** replace that owner right away with the other two (Safe → Settings → Owners). Until you do, you are one more loss away from being locked out.

**Rehearse step 1 once on day 1,** with real devices, and time it. That time is your real exposure window.

## 7. What you're on the hook for once it runs

- **Responding to pages.** Routine trades never wake you, but the §4 page list must. The worst-case loss in §0 is per *day of compromise*, so your response time is the multiplier.
- **Holding and protecting two of three devices,** including the off-site backup, and replacing any lost one promptly.
- **Allowance sizing.** Revisit when ETH moves a lot: the WETH allowance is in WETH, so its USD value changes with the price. Revisit when the strategy's volume changes. Every change is a 2-signature Safe tx followed by `verify-policy`.
- **Gas float top-ups** (small, about monthly), and the daily digest.
- **Strategy losses.** The policy stops theft and bounds abuse. It does not stop your own signals from trading badly within policy. Consider an off-chain circuit breaker in the signal engine, for example halting after N% drawdown.
- **Dependencies and infrastructure:** viem and Node updates (review them, don't auto-merge), your RPC provider, and Flashbots Protect availability. If Protect is down, trades fail closed, which is fine. Don't switch to public mempool submission to "fix" that.
- **Third-party contract risk you accept:**
  - Safe, Zodiac Roles, and Uniswap V3 are widely used and audited, but that doesn't make them risk-free.
  - Circle can freeze USDC at any address, including your Safe.
  - A Chainlink outage makes the agent stop trading (fail closed).
- **Key rotation:** rotate the agent key when the VM is rebuilt, when anyone else ever had access, and at least periodically. Rotation is revoke plus grant, both via the Safe.
- **Record keeping and tax.** Every swap is likely a taxable disposal in your jurisdiction. The JSON logs (`signalId`, tx hash, amounts, gas) are your trade ledger, so ship them somewhere durable.
- **Policy changes need a new review.** Adding a pool, token, or router means updating `roles-policy.ts`, re-running `fork-test.ts`, and extending `verify-policy`. Never grant the agent a broader scope "temporarily".

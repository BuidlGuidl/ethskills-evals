# DEPLOY.md — WETH/USDC treasury rebalancer, Ethereum mainnet

This is what has to exist before `rebalance.ts` runs with $400k behind it, and what you are responsible for once it's running.

## 0. The one design decision that matters

**The agent does not hold the treasury, and it doesn't own the account that does.**

Your requirements are "unattended", "nobody approves trades", and "$400k". The way to meet all three is to limit what the agent's key can do on-chain. You can't meet them by adding checks to the bot's own code. A hot key on a cloud VM will eventually get compromised: through the VM, the cloud account, a dependency, or you. If that key controls the $400k directly, one compromise loses the whole treasury.

```
 Owner A (hardware)   Owner B (hardware)   Owner C (hardware, off-site)
          \                  |                    /
           └──────── 2-of-3 ─┴────────────────────┘
                             │  owns
                 ┌───────────▼────────────┐
                 │  TREASURY SAFE (v1.4.1) │  holds all WETH + USDC
                 └───────────▲────────────┘
                             │  module: execTransactionFromModule (Call only)
                 ┌───────────┴────────────┐
                 │ ZODIAC ROLES MODIFIER v2│  owner = avatar = target = the Safe
                 │  role "rebalancer":     │
                 │   SwapRouter02          │
                 │   .exactInputSingle     │
                 │   WETH<->USDC, fee 500, │
                 │   recipient == Safe,    │
                 │   amountIn ≤ allowance  │
                 └───────────▲────────────┘
                             │  execTransactionWithRole
                 ┌───────────┴────────────┐
                 │ AGENT EOA (AWS KMS key) │  holds ~0.1 ETH for gas, nothing else
                 │ rebalance.ts on the VM  │
                 └─────────────────────────┘
```

The agent can trade without anyone approving each swap. The owners have to act on-chain for anything else: withdrawals, new tokens, changing limits, turning it back on after a halt.

## 1. Accounts and contracts

| Thing | What it is | Holds | Who controls it |
|---|---|---|---|
| Owner A, B, C | 3 hardware wallets, each with its own seed. Seed backups kept in different physical places. C stays off-site. | nothing | you (plus optionally one trusted person as C for recovery) |
| Treasury Safe | Safe v1.4.1, **2-of-3**, created at app.safe.global | ~$400k WETH + USDC | owners |
| Roles Modifier | Zodiac Roles v2 proxy. Mastercopy `0x9646fDAD06d3e24444381f44362a3B0eB343D337`, ModuleProxyFactory `0x000000000000aDdB49795b0f9bA5BC298cDda236` (both verified to have code on mainnet) | nothing | the Safe |
| Agent EOA | secp256k1 key created **inside AWS KMS** (`ECC_SECG_P256K1`). It can't be exported, so no one ever sees the private key. | 0.05–0.2 ETH gas | the VM's IAM role (`kms:Sign` only) |
| Guardian EOA *(strongly recommended)* | Key for a separate watchdog process running on separate infrastructure. Its only power is to disable the Roles module. | small gas balance | watchdog |

External contracts it touches (all hardcoded in `rebalance.ts` and checksum-validated when it starts):

| Contract | Address | Use |
|---|---|---|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | treasury asset |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | treasury asset |
| Uniswap SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | the swap (`exactInputSingle`) |
| Uniswap QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | quote via `eth_call` only |
| USDC/WETH 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | the only pool the role can trade through |
| Chainlink ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | price band check (1h heartbeat, 0.5% deviation) |
| Chainlink USDC/USD | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | depeg halt (24h heartbeat) |
| Flashbots Protect RPC | `https://rpc.flashbots.net/fast` | private submission, so there's no public-mempool sandwich |

## 2. Setup, in order

Before step 9, don't put more than test money into the Safe.

### 1. Owner keys
- Three hardware wallets, each with its own seed. Record every address.
- Turn off blind signing. When you sign a Safe transaction, check the Safe tx hash shown on the device against the one in the Safe UI.
- None of these keys ever go on the VM, or on any machine the VM can reach.

### 2. Create the Safe
- app.safe.global → Ethereum → owners A, B, C → threshold **2**. Use Safe v1.4.1.
- Send $50 of USDC in and back out with two owner signatures, so you know the whole signing flow works before it matters.

### 3. Agent key in KMS (use a dedicated AWS account for this bot)
- KMS → Create key → Asymmetric → **Sign and verify** → **ECC_SECG_P256K1**. Single region.
- **Key policy:** only the VM's instance role gets `kms:Sign` and `kms:GetPublicKey`. `kms:ScheduleKeyDeletion` and `kms:PutKeyPolicy` require your MFA-protected admin principal. Turn on CloudTrail for KMS.
- **VM:** require IMDSv2 with hop limit 1, so containers can't take the role's credentials. No long-lived access keys anywhere. Use SSM instead of open SSH if you can.
- **AWS account:** hardware MFA on root, root credentials never used. Whoever controls this AWS account can sign as the agent.
- Get the agent address: set `SIGNER=kms KMS_KEY_ID=… AWS_REGION=…` and run `npx tsx rebalance.ts --check`. The `agent` field is the address, and it becomes `AGENT_ADDRESS`. (Until the Safe and Roles addresses exist, `--check` will report wiring problems. That's expected at this point.)

### 4. Deploy the Roles Modifier and enable it
Use the Zodiac app in Safe → Apps, or the Roles app at roles.gnosisguild.org. Deploy a Roles v2 instance with **owner = avatar = target = the Safe**. Then run a Safe transaction (2 signatures) calling `enableModule(<roles>)`.
`rebalance.ts` checks all four of those relationships on every run. If they're wrong, it halts.

### 5. Configure the `rebalancer` role
Do this in the Roles app, which builds the condition tree and the Safe transaction for the owners to sign. The permission is exactly:

```
role "rebalancer"   members: [AGENT_ADDRESS]
  target SwapRouter02 0x68b3…Fc45   scoped; ExecutionOptions = None  (no ETH value, no delegatecall)
    function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))
      condition on the params tuple:
        OR(
          { tokenIn == WETH, tokenOut == USDC, fee == 500, recipient == AVATAR,
            amountIn <= PER_CALL_WETH  AND  WithinAllowance(WETH_DAILY) },
          { tokenIn == USDC, tokenOut == WETH, fee == 500, recipient == AVATAR,
            amountIn <= PER_CALL_USDC  AND  WithinAllowance(USDC_DAILY) }
        )
      CallWithinAllowance(CALLS_DAILY)
  (no other targets. In particular: not WETH, not USDC, not the Safe, not the Roles modifier.)
```

Allowances, via `setAllowance(key, balance, maxRefill, refill, period=86400, timestamp)`. Size them to your *actual* flow, not the most you can imagine needing:

| Key | Suggested | Why |
|---|---|---|
| `PER_CALL_WETH` / `PER_CALL_USDC` | 20 WETH / 50,000 USDC | your biggest trade is $50k |
| `WETH_DAILY` | ~40 WETH (≈$100k at today's ~$2,640) | about 3 max-size trades |
| `USDC_DAILY` | 100,000 USDC | same |
| `CALLS_DAILY` | 10 | "a handful" of trades |

Then set the off-chain limits in `rebalance.ts` (`MAX_TRADE_USD`, `MAX_DAILY_USD`, `MAX_TRADES_PER_DAY`) **at or below** the on-chain ones. That way the bot skips a trade before the chain would revert it.

### 6. Approvals from the Safe (owner transaction)
Use a MultiSend batch from the Safe: `WETH.approve(SwapRouter02, max)` and `USDC.approve(SwapRouter02, max)`. The agent can't approve anything itself. The router only pulls tokens from `msg.sender`, which here is the Safe, and only the Safe can call it.

### 7. Guardian / watchdog *(recommended; not included in this repo)*
This is how you avoid being woken up for problems that fix themselves, and how you still stop a real incident quickly.
- Add a second role, `guardian`, with a single permission: target = **the Safe**, function `disableModule(address prevModule, address module)`, condition `module == <Roles address>`. `prevModule` is `0x0000000000000000000000000000000000000001` if Roles is the only module.
- Run a small watchdog on *different* infrastructure (different cloud account or provider), with its own key. It watches Safe `Transfer` events and the agent's nonce. It calls `disableModule` when:
  - the agent nonce moves and there's no matching line in the bot's audit log, or
  - a swap's realized price is more than ~1.5% worse than Chainlink, or
  - any token leaves the Safe other than into the 0.05% pool, or
  - the Safe's USD value falls much further than the ETH price move explains.
- Disabling the module stops all agent activity in one transaction. Only the owners (2-of-3) can turn it back on.

### 8. Host
- Dedicated VM running only this service. Use a systemd unit like this:
  ```ini
  [Service]
  User=rebalancer
  EnvironmentFile=/etc/rebalancer/env        # mode 0600; contains NO private keys
  ExecStart=/usr/bin/npx tsx /opt/rebalancer/your-signal-loop.ts
  Restart=on-failure
  StateDirectory=rebalancer                  # -> /var/lib/rebalancer (state.json, audit.jsonl, PAUSED)
  NoNewPrivileges=yes
  ProtectSystem=strict
  ReadWritePaths=/var/lib/rebalancer
  ```
- Your signal loop calls `executeRebalance(cfg, ctx, { id, sell, amountIn })`. Give every decision a unique `id`. Re-sending the same `id` does nothing, so retries are safe.
- Pin dependency versions with a lockfile and install with `npm ci`. Anything in `node_modules` runs with the power to sign as the agent.
- Use a paid mainnet RPC (Alchemy, Infura, QuickNode, etc.) for `ETH_RPC_URL`. Its URL contains an API key, so it goes in the env file only and never in git. (`.gitignore` already excludes `.env*`.)
- Enable NTP. The rate limits use the local clock; the oracle staleness check uses block time.
- Set `ALERT_WEBHOOK_URL` to something that can actually page you (PagerDuty, Opsgenie, or a Telegram bot for "page" severity).

### 9. Rehearse, then fund
1. `npx tsx rebalance.ts --check` must return `"problems": []`.
2. `npx tsx rebalance.ts --selftest` must show **PASS (reverted)** for every forbidden call: recipient = agent, the 0.3% pool, transfer, approve, delegatecall, and an over-limit amount. It must also show PASS for the small legitimate swap, which needs the Safe to hold a little WETH. Run it again after *any* change to the Roles config.
   - The over-limit case in the selftest also exceeds the Safe's balance, so it doesn't prove the allowance works by itself. Check allowance enforcement separately: use the Roles app's simulation, or temporarily set a tiny allowance and try a legitimate swap just above it.
3. Put about $2k in the Safe. Run `--sell WETH --amount 0.2 --id test-1 --dry-run`, then run it for real. Then do the same in the USDC direction. Check `audit.jsonl`, the Etherscan transaction, and that the output landed in the Safe.
4. Leave it running on small money for at least a day of real signals. Test the kill switches: `touch /var/lib/rebalancer/PAUSED`, and the guardian's `disableModule`. Then re-enable with owner signatures, so you've practiced it.
5. Only then send the rest of the treasury in. From an owner wallet, send a small test transfer first, then the rest.

## 3. What `rebalance.ts` does on every trade

1. Refuses to run if `PAUSED` exists or another run holds the lock. Ignores decision ids it has already seen.
2. **Wiring check:** chainId is 1; the KMS address matches `AGENT_ADDRESS`; the Roles module is enabled; Roles owner, avatar and target are all the Safe; the agent is *not* a Safe owner; the threshold is at least 2; the pool's tokens and fee are what it expects. Any failure → **halt**.
3. **Nonce accounting:** if the agent's nonce moved by a transaction the bot didn't send → **halt** (the key is being used somewhere else). It also resolves the previous transaction: mined, still pending (skip this run), or dropped by the private RPC (reuse its nonce, which cancels the old signed transaction).
4. **Off-chain limits:** minimum time between trades, maximum trades per day, maximum per-trade and rolling 24h USD.
5. **Safe balance and allowance, plus Chainlink** freshness. If USDC is off its peg by more than 1% → **halt**.
6. **Quote vs oracle:** gets a QuoterV2 quote and skips if it's more than `MAX_ORACLE_DEVIATION_BPS` (default 1%) away from the Chainlink-implied amount in either direction. `minOut = quote × (1 − SLIPPAGE_BPS)`.
7. **Simulates the exact Roles call from the agent address.** Checks the gas price and gas cost caps.
8. Signs through KMS. **Saves the pending transaction to disk before broadcasting**, then submits it through Flashbots Protect.
9. Waits for the receipt, then checks the actual `Transfer` logs: exactly `amountIn` left the Safe, and at least `minOut` arrived. Anything else → **halt**.

"Skip" means it logs the reason and waits for the next signal. "Halt" means it writes `PAUSED`, sends a page, and does nothing more until a human removes the file.

A transaction submitted through Protect that becomes unexecutable (for example, the price moved past `minOut`) isn't included; it's dropped. Nothing is lost except the trade. The next run notices the drop after `STUCK_AFTER_SEC`.

### Environment variables

| Var | Required | Default / example |
|---|---|---|
| `ETH_RPC_URL` | yes | paid provider URL (secret) |
| `PRIVATE_TX_RPC_URL` | | `https://rpc.flashbots.net/fast` |
| `SAFE_ADDRESS`, `ROLES_MODIFIER_ADDRESS`, `AGENT_ADDRESS` | yes | checksummed |
| `ROLE_KEY` | | `rebalancer` (must match the Roles config) |
| `SIGNER` | | `kms` (`dev` works only against a localhost anvil fork) |
| `KMS_KEY_ID`, `AWS_REGION` | yes (kms) | key ARN, region |
| `MAX_TRADE_USD` / `MAX_DAILY_USD` / `MAX_TRADES_PER_DAY` | | 50000 / 100000 / 10. Keep these at or below your Roles allowances. |
| `MIN_SECONDS_BETWEEN_TRADES` | | 300 |
| `SLIPPAGE_BPS` / `MAX_ORACLE_DEVIATION_BPS` / `MAX_USDC_DEPEG_BPS` | | 30 / 100 / 100 |
| `MAX_FEE_GWEI` / `MAX_GAS_COST_USD` / `MIN_AGENT_GAS_ETH` | | 40 / 40 / 0.03 |
| `STATE_DIR` | | `/var/lib/rebalancer` |
| `ALERT_WEBHOOK_URL` | should be set | receives `{severity, message, data}` |

## 4. Residual risk: what this setup does *not* protect you from

**The agent key can still lose money through bad prices, up to the daily allowance.** Roles v2 enforces *which* pool, *which* direction, *where the output goes* and *how much goes in*. With the conditions above, it does **not** enforce `amountOutMinimum`. Suppose an attacker controls the KMS key (a compromised VM or AWS account). They can send swaps with `amountOutMinimum = 0` and sandwich those swaps themselves. In the worst case they take most of the value of each swap. **Worst case with the allowances above: about $100k per direction per day.** The watchdog limits how many days that can go on, but not what happens inside a single block.
- **Closing this gap** means an on-chain price floor: a Roles v2 `Custom` condition, which is a small contract that checks `amountOutMinimum` against Chainlink ± a band. That contract needs careful review before you rely on it. Once it's in place, the worst case drops to about band × allowance (≈1% of $100k). Treat it as the first follow-up after launch. Until then, keep the allowances as tight as your real trading allows.

Other risks:

| Risk | Status |
|---|---|
| One owner key lost or stolen | Safe: no loss (2-of-3). Replace that owner using the other two. |
| Two owner keys compromised | **Total loss.** Keep them physically separate and never on internet-facing machines. |
| VM disk or image stolen | No key on it. The RPC API key leaks; rotate it. |
| AWS account compromised | Same as agent key compromise (above). Protect this account like it holds $100k, because it effectively does. |
| Strategy is wrong | No code protects against this. The caps only limit how fast a bad strategy can churn. |
| Fee drag | 0.05% pool fee + gas on every trade. At $100k/day that's ~$50/day, **~$18k/year (~4.5% of the treasury)** before gas. Make sure your signals are worth more than that. |
| USDC freeze or depeg | Circle can freeze the Safe's USDC. On a depeg the bot halts, but halting doesn't get you out of USDC. Deciding what to do is up to you. |
| Contract risk | Safe, Zodiac Roles v2, Uniswap v3, WETH, USDC, Chainlink: all long-running and audited, but not risk-free. |
| Liquidity leaves the v3 0.05% pool (e.g. to v4) | The quote-vs-oracle band makes the bot skip trades instead of taking bad fills. If that starts happening regularly, the execution venue has to change, and so do the Roles permissions. |
| RPC or Flashbots outage | Trades get skipped (or stay pending and get resolved on the next run). No funds at risk. |

## 5. What you're on the hook for once it's running

**Routine (no pages):**
- **Gas:** keep the agent EOA above `MIN_AGENT_GAS_ETH`. You'll get a warn alert when it's low; it halts when it can't pay. A rebalance costs roughly 200–250k gas.
- **Allowance drift:** `WETH_DAILY` is set in ETH, so its dollar value moves with the price. Review it monthly, or whenever ETH moves ±30%. Changing it takes an owner transaction.
- **Updates:** keep the OS patched. Update dependencies deliberately, with a lockfile and diffs reviewed; don't auto-update, because a malicious dependency can sign as the agent.
- **Records:** `audit.jsonl` plus Etherscan are your trade record. In many jurisdictions every swap is a taxable disposal, so export them regularly. Get proper tax/legal advice for running a treasury. This document isn't that.
- **Owner key hygiene:** check once a quarter that all three hardware wallets still work and their backups are where you think they are.

**You will be paged when** (these are not routine):
- `REBALANCER HALTED: …`: the bot stopped itself. Read `audit.jsonl`, fix the cause, then `rm /var/lib/rebalancer/PAUSED`.
  - *nonce moved unexpectedly*: treat it as key compromise (see below).
  - *wiring check failed*: someone changed the Safe or Roles configuration. Find out who.
  - *USDC off peg*: you decide whether to exit, as an owner, manually.
  - *post-trade check failed* / *reverted after simulation*: don't unpause until you understand it.
- The watchdog disabled the module.
- An `unexpected error` alert.

**Incident runbook: suspected agent key or VM compromise**
1. Two owners sign `Safe.disableModule(prev, roles)`, or the guardian does it automatically. Once that's mined the agent is powerless. **Prepare and simulate this transaction in advance**, so that at 3am it's just two signatures.
2. Disable the KMS key (`kms:DisableKey`) and revoke the instance role's sessions.
3. Figure out how it happened. Create a new KMS key and a new VM. In Roles, remove the old member and assign the new one (`assignRoles`). Run `--check` and `--selftest`, then re-enable the module.

**Things only you can do, because the design deliberately keeps them away from the agent:** moving money in or out of the Safe, changing limits, adding tokens or venues, unpausing after a halt, and re-enabling the module. Each of these needs two hardware-wallet signatures, which means you need two of your three devices on hand.

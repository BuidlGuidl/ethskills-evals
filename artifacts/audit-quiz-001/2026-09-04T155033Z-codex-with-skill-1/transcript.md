# Executor transcript — 2026-09-04T155033Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-with-skill-1/audit-quiz-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-with-skill-1/audit-quiz-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06d22-a7af-7723-b84a-34cf2f871701
--------
user
Post-mortem, and I am stuck on it.

We run a lending market on Arbitrum One. Collateral is wstETH, debt is USDC,
positions are liquidatable below 125% collateralisation.

Last Tuesday, from 09:14 to 12:40 UTC, our users could not reach the chain.
Transactions submitted from the app sat unconfirmed and the explorer showed
no new blocks for three and a half hours. Everywhere else trading carried on:
ETH fell 11% over that window on Binance and on mainnet DEXes.

At 12:41, in the first blocks after service came back, keeper bots liquidated
38 positions in one sweep. Every one of those borrowers had been trying to
add collateral since mid-morning and could not get a transaction through.

Here is the part I cannot explain. Before any price is used we already do
this:

  (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
  require(answer > 0, "bad price");
  require(block.timestamp - updatedAt <= 3600, "stale price");

Our collateral feed's heartbeat is 86400 seconds, so our one-hour bound is far
tighter than the feed itself promises. I pulled the round data for all 38
liquidations: the check passed every time, and the answer we read had been
published seconds earlier and matched the real market price. The price was
not stale. The math was not wrong. Our liquidation logic did exactly what it
was written to do.

Explain how 38 users lost their positions to a price they had no way to react
to, when our freshness check was working correctly the whole time. Then tell
me precisely what we change, and where in the flow it goes.

Write your answer to answer.md in this directory.

codex
I’ll treat this as a smart-contract incident analysis and use the audit skill. I’ll inspect its required workflow and the repository context, then write the post-mortem and concrete flow change to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/audit/SKILL.md && rg --files -g '"'!*node_modules*'"' | sed -n '1,160p'" in /tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-with-skill-1/audit-quiz-001
 succeeded in 12ms:
---
name: audit
description: Use when asked to audit or security-review EVM smart contracts, find vulnerabilities, assess exploit impact, or produce a ranked audit report. For defensive implementation guidance while writing contracts, use the security skill instead.
---

# EVM Smart Contract Audit

Audit unfamiliar contracts systematically, rank findings by real impact, and leave one concise report. Do not mutate the code or publish findings unless the user asks.

## The Checklists

The checklist repository is pinned so two audits do not silently use different guidance:

```
CHECKLIST_REV=ffe4b670e78e1945bcf275f79d4b7b0481bcff35
```

Load a selected checklist from:
```
https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/ffe4b670e78e1945bcf275f79d4b7b0481bcff35/<skill-name>/references/checklist.md
```

For a narrow question, load only the one or two relevant checklists. For a full codebase audit, always load `general` and `precision-math`, then add only the domains the code actually uses (normally 5–8 total). This keeps the review focused and avoids spending context on unrelated vulnerability classes.

## Skills Available

| Skill | When to Load |
|-------|-------------|
| `evm-audit-general` | Always |
| `evm-audit-precision-math` | Always |
| `evm-audit-erc20` | Contract interacts with ERC20 tokens |
| `evm-audit-defi-amm` | AMM, DEX, Uniswap V3/V4, liquidity pools |
| `evm-audit-defi-lending` | Lending, borrowing, CDP, liquidations |
| `evm-audit-defi-staking` | Staking, liquid staking, restaking, EigenLayer |
| `evm-audit-erc4626` | Vaults, share/asset conversion |
| `evm-audit-erc4337` | Account abstraction, paymasters, session keys |
| `evm-audit-bridges` | Cross-chain, LayerZero, CCIP, Wormhole |
| `evm-audit-proxies` | Upgradeable contracts, UUPS, Transparent, Diamond |
| `evm-audit-signatures` | Off-chain signatures, EIP-712, permits |
| `evm-audit-governance` | DAO voting, timelocks, multi-sig |
| `evm-audit-oracles` | Chainlink, TWAP, Pyth, price feeds |
| `evm-audit-assembly` | Inline assembly, Yul, CREATE2 |
| `evm-audit-chain-specific` | Non-mainnet: Arbitrum, OP, zkSync, Blast, BSC |
| `evm-audit-flashloans` | Flash loan attack vectors |
| `evm-audit-erc721` | NFTs, ERC721, ERC1155 |
| `evm-audit-dos` | DoS, unbounded loops, gas griefing |
| `evm-audit-access-control` | Ownership, roles, centralization risks |

## How To Run An Audit

1. Read the README, deployment assumptions, tests, and every in-scope contract before routing.
2. Map assets, trust boundaries, privileged paths, external calls, accounting invariants, signatures, oracle dependencies, and chain-specific assumptions.
3. Select checklists from the table above. Use one or two for a narrow question and normally 5–8 for a full audit.
4. For a full audit, run one specialist per selected domain in parallel when sub-agents are available. Do not require a particular model.
5. Give every specialist the same scope and ask it to return complete findings to the orchestrator: severity, location, preconditions, exploit/failure path, impact, and remediation. Treat files such as `findings-<skill>.md` as optional scratch space, not as the transport between agents.
6. Deduplicate and verify findings against the code. Separate currently exploitable issues from risks that depend on future assets, configuration, or integrations.
7. Write the requested report, ranking by demonstrated impact and exploitability. Clean up scratch files when the user requested a single deliverable.
8. Never file GitHub issues or otherwise publish findings unless the user explicitly asks, identifies the target repository, and confirms the outbound action.

## Sources

Built from research by Dacian, beirao.xyz, Sigma Prime, RareSkills, Decurity, weird-erc20, Spearbit, Hacken, OpenZeppelin, Cyfrin, and more.
Full attribution: https://github.com/austintgriffith/evm-audit-skills#attribution--thanks
TASK.md
package.json

codex
The key distinction I’m validating is oracle freshness versus user opportunity to act: the former can remain perfect while sequencer downtime removes the latter. I’m checking the Arbitrum-specific oracle safety mechanism and the correct ordering around liquidation.
web search: 
exec
/bin/bash -lc "sed -n '1,240p' TASK.md && sed -n '1,200p' package.json" in /tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-with-skill-1/audit-quiz-001
 succeeded in 3ms:
{
  "name": "eval-workspace",
  "private": true
}

web search: https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/ffe4b670e78e1945bcf275f79d4b7b0481bcff35/evm-audit-oracles/references/checklist.md
exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/ffe4b670e78e1945bcf275f79d4b7b0481bcff35/evm-audit-oracles/references/checklist.md && curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/ffe4b670e78e1945bcf275f79d4b7b0481bcff35/evm-audit-chain-specific/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-with-skill-1/audit-quiz-001
 succeeded in 479ms:
# Oracle & Pricing Security Checklist

## Chainlink Price Feeds

### Staleness & Liveness
- [ ] **Check `updatedAt` for staleness**: Chainlink returns `(roundId, answer, startedAt, updatedAt, answeredInRound)`. If `block.timestamp - updatedAt > heartbeat`, the price is stale. Different feeds have different heartbeats (ETH/USD: 1h on mainnet, 24h on some L2s). Look for: `latestRoundData()` without staleness check or with wrong heartbeat value. [SigmaPrime oracle, beirao O-01]

- [ ] **Hardcoded staleness threshold across chains**: ETH/USD heartbeat is 3600s on Ethereum, 86400s on Arbitrum. Deploying with a hardcoded 3600s threshold on Arbitrum causes constant "stale price" rejections. Look for: single staleness constant used across multi-chain deployments. [multichain-auditor, beirao O-03]

- [ ] **`answeredInRound < roundId` = stale answer from old round**: The answer wasn't updated in the current round. This is a secondary staleness signal beyond timestamp. Look for: missing `answeredInRound >= roundId` check. [beirao O-02]

- [ ] **`startedAt == 0` means round hasn't started**: A round with `startedAt == 0` is invalid — no price update has occurred for this round. Look for: missing `startedAt > 0` check. [SigmaPrime oracle]

### Answer Bounds
- [ ] **`minAnswer` / `maxAnswer` circuit breakers**: Chainlink feeds have hard-coded min/max bounds (e.g., LUNA/USD had `minAnswer = $0.10`). When the real price drops below min, the feed reports `minAnswer` instead of the real price, enabling massive over-borrowing. Look for: protocols that don't check if `answer == aggregator.minAnswer()` or `answer == aggregator.maxAnswer()`. [SigmaPrime oracle, beirao O-04]

- [ ] **Negative prices**: Some feeds CAN return negative prices (oil futures in 2020). `int256 answer` cast to `uint256` becomes a massive number. Look for: `uint256(answer)` without `answer > 0` check. [beirao O-05]

- [ ] **Price = 0 not handled**: If Chainlink returns 0, any multiplication-based valuation stays 0 (allowing free borrows) or any division by price reverts. Look for: missing `answer != 0` check. [SigmaPrime oracle]

### L2 Sequencer
- [ ] **L2 sequencer uptime feed**: On Arbitrum/Optimism, when the sequencer goes down and comes back up, stale prices from before the outage are used. Must check the L2 sequencer uptime feed and apply a grace period after restart. Look for: Chainlink usage on L2s without sequencer uptime feed check. [beirao O-06, multichain-auditor]

- [ ] **Grace period too short after sequencer restart**: After the sequencer comes back, oracles need time to update. A grace period of < 1 hour can still use stale prices. Look for: sequencer grace period < 3600 seconds. [SigmaPrime oracle]

### Feed Configuration
- [ ] **Chainlink feed decimals vary**: ETH/USD = 8 decimals, ETH/BTC = 8 decimals, but some feeds use 18 decimals. Using `feed.decimals()` is mandatory. Look for: hardcoded `10**8` or `10**18` adjustments on oracle prices. [beirao O-07, SigmaPrime oracle]

- [ ] **Deprecated feeds**: Chainlink can deprecate feeds. Using deprecated feeds may return stale data. Check: https://docs.chain.link/data-feeds/deprecating-feeds. Look for: hardcoded feed addresses without admin-changeable configuration. [SigmaPrime oracle]

- [ ] **Oracle assumes base=USD when it's actually ETH**: If a protocol needs USD price but uses a `/ETH` denominated feed (or vice versa), all valuations are wrong by the ETH/USD ratio. Look for: feed denomination assumptions without validation. [SigmaPrime oracle]

## TWAP Oracles

- [ ] **TWAP manipulation via low liquidity**: A TWAP oracle averages price over a window, but in low-liquidity pools, even the TWAP can be cheaply manipulated by holding a price position across multiple blocks. Cost: `(manipulation_amount × blocks × block_time) / pool_depth`. Look for: TWAP windows < 30 minutes on pools with < $10M TVL. [SigmaPrime oracle, beirao O-08]

- [ ] **Uniswap V3 TWAP uses geometric mean**: Unlike V2's arithmetic mean, V3 TWAP is geometric. The geometric mean is ALWAYS ≤ arithmetic mean for non-constant prices. This systematically underprices volatile assets. Look for: protocols using V3 TWAP without understanding it returns geometric mean. [SigmaPrime oracle]

- [ ] **TWAP window too long hides current conditions**: A 24-hour TWAP during a flash crash still shows a near-normal price. This delays liquidations. Look for: TWAP windows > 4 hours used for liquidation triggers. [SigmaPrime oracle]

- [ ] **TWAP on rebasing token**: If a rebasing token's supply doubles, its price halves. TWAP doesn't capture this instantly, creating arbitrage. Look for: TWAP oracles for rebasing token pairs. [SigmaPrime oracle]

- [ ] **Uniswap V3 `observe()` reverts if oracle not initialized**: The oracle must have at least `cardinality` observations. If `cardinality == 1` (default), only the current block is available and any historical query reverts. Look for: `pool.observe()` calls without prior `increaseObservationCardinalityNext()`. [SigmaPrime oracle]

## Spot Price Manipulation

- [ ] **NEVER use spot reserves as a price oracle**: `pool.getReserves()` can be manipulated within a single transaction via flash loans. Any pricing based on instantaneous reserves is attackable. Look for: `IUniswapV2Pair.getReserves()`, `pool.slot0()`, or `balanceOf()` used for pricing. [beirao O-09, SigmaPrime oracle]

- [ ] **Read-only reentrancy on Balancer/Curve**: During a Balancer/Curve callback (before state update), calling a view function (like `getRate()`) returns a manipulated rate because the pool state is mid-update. Classic exploit: Sentiment ($1M). Look for: any price query to Balancer/Curve pools within a callback or the same transaction as a pool interaction. [beirao O-10]

## Price Peg Assumptions

- [ ] **Assuming 1 WBTC = 1 BTC**: WBTC consistently trades at a slight discount to BTC. Using 1:1 creates systematic mispricing. Look for: WBTC valued using BTC/USD feed without WBTC/BTC adjustment. [SigmaPrime oracle, beirao O-11]

- [ ] **Assuming 1 stETH = 1 ETH**: stETH depegged to 0.93 ETH in June 2022. Any protocol assuming 1:1 was exploitable during the depeg. Must use actual stETH/ETH price feed. Look for: stETH, wstETH, cbETH, rETH valued 1:1 with ETH. [SigmaPrime oracle, beirao O-12]

- [ ] **Assuming 1 USDC = 1 USD**: USDC depegged to $0.87 in March 2023 (SVB). Protocols hardcoding $1 USDC were exposed. Look for: stablecoin valuations without actual price feed (hardcoded to 1). [SigmaPrime oracle]

- [ ] **LP token valuation via reserves**: `LP_value = 2 * sqrt(reserve0 * reserve1) * price` (Alpha Homora formula) is manipulation-resistant. Using `(reserve0 * price0 + reserve1 * price1) / totalSupply` is manipulable. Look for: LP token pricing formulas that use raw reserves. [SigmaPrime oracle]

## Pyth Network

- [ ] **Pyth prices are pull-based**: Unlike Chainlink (push), Pyth prices must be pushed on-chain by the caller. If nobody pushes, the price is stale. Look for: Pyth integration that assumes prices update automatically. [SigmaPrime oracle]

- [ ] **Pyth confidence interval**: Pyth returns `(price, conf, expo, publishTime)`. During high volatility, `conf` (confidence interval) can be very wide, meaning the price is uncertain. Protocols should check that `conf / price < threshold` (e.g., 5%). Look for: Pyth price usage without confidence interval check. [SigmaPrime oracle]

- [ ] **Pyth `publishTime` staleness**: Must check `publishTime` is recent, similar to Chainlink `updatedAt`. Look for: Pyth prices without publishTime freshness check. [SigmaPrime oracle]

## General Oracle Security

- [ ] **Single oracle dependency**: If the protocol relies on one oracle and it fails/is manipulated, everything breaks. Use multiple oracles with fallback logic (Chainlink primary, TWAP fallback, manual override emergency). Look for: single `priceFeed.latestRoundData()` without fallback. [SigmaPrime oracle]

- [ ] **Oracle update frequency vs protocol tick frequency**: If the oracle updates every hour but the protocol checks prices every minute, 59 out of 60 checks use a "stale" price. This is expected behavior for Chainlink, but the protocol must design around it. Look for: high-frequency price checks on low-frequency oracle feeds. [SigmaPrime oracle]

- [ ] **Multi-hop price derivation accumulates error**: ETH/USD = ETH/BTC × BTC/USD — each feed has its own error range. Multi-hop prices compound errors. Look for: price derivation using 3+ oracle hops. [SigmaPrime oracle]

## Chainlink Deep Dive (Expanded from Beirao/Arbitrum Checklist)

- [ ] **ETH pricefeeds used for stETH, BTC pricefeeds used for WBTC**: Using ETH/USD feed for stETH ignores the stETH/ETH discount during depegs. Using BTC/USD for WBTC ignores WBTC's depeg risk. Must use the specific derivative price feed or account for the exchange rate. Look for: oracle price feeds used for derivative tokens without accounting for the peg. [beirao CL-13]

- [ ] **Oracle price update front-running**: When an oracle submits a price update tx, it's visible in the mempool. Attackers can front-run the update to profit from the price change (e.g., borrow before a collateral price increase is recorded). Look for: protocols where user actions and oracle updates interact in time-sensitive ways. [beirao CL-11]

- [ ] **Flash crash: minAnswer/maxAnswer circuit breakers**: Some Chainlink feeds have min/max answer bounds. During flash crashes, the feed returns `minAnswer` instead of the actual (lower) price. Protocol still prices collateral at `minAnswer`, which may be much higher than reality. Look for: Chainlink integrations without `require(answer > minAnswer && answer < maxAnswer)` style checks. [beirao CL-14, Arbitrum Checklist]

- [ ] **Pricefeed heartbeat too slow for use case**: A 24-hour heartbeat feed is fine for weekly settlements but dangerous for real-time liquidations. If the actual price drops 50% between heartbeats, the protocol uses a 50% stale price. Look for: protocols using feeds with heartbeats longer than their position health check frequency. [beirao CL-08]

- [ ] **Hardcoded pricefeed addresses can become deprecated**: Chainlink deprecates feeds over time (especially for uncommon pairs). A hardcoded address will return stale data indefinitely if deprecated. Look for: hardcoded Chainlink feed addresses without a governance mechanism to update them. [beirao CL-10]

- [ ] **Different decimal precision across feeds**: Feed decimals aren't always 8 or 18 — they vary by feed. LINK/ETH uses 18 decimals, LINK/USD uses 8. Incorrect decimal handling causes 10^10x price errors. Look for: hardcoded `10**8` or `10**18` divisors in oracle price normalization. [beirao CL-09, Arbitrum Checklist]

- [ ] **L2 sequencer down = stale prices**: On Arbitrum/Optimism, if the sequencer goes down, oracle prices don't update. When the sequencer comes back, the first reported price may jump significantly from the last pre-downtime price. Look for: oracle integrations on L2 without sequencer uptime feed checks. [beirao CL-06, Arbitrum Checklist]

## Oracle Price Zero Edge Case

- [ ] **Oracle returns price of zero**: Some feeds may return 0 during initialization or error conditions. A zero price means infinite collateral value or zero debt value, depending on usage. Look for: oracle integrations that don't check `price > 0`. [Decurity CDP]

---

## Cyfrin — Chainlink Oracle Security Considerations (Phase 3)

- [ ] **Same heartbeat used for multiple feeds with different update frequencies**: If both BTC/USD (1hr heartbeat) and USDC/USD (24hr heartbeat) use the same staleness threshold, one will be too strict (false stale) or too lenient (actually stale). Each feed needs its own heartbeat constant. [Source: Cyfrin — Chainlink Oracle Security, Sherlock JOJO]

- [ ] **Oracle price feed not updated frequently — high deviation threshold**: Similar feeds can have different heartbeat & deviation thresholds. A feed with 1% deviation and 1hr heartbeat will be more accurate than one with 5% deviation and 24hr heartbeat. Use the most responsive feed available. [Source: Cyfrin — Chainlink Oracle Security]

- [ ] **Wrong price feed address in constructor vs comments**: Developers copy the correct address in comments but hardcode the wrong address in the constructor (e.g., ETH/USD instead of BTC/USD). Verify all hardcoded addresses against Chainlink's official feed list. [Source: Cyfrin — Chainlink Oracle Security, Sherlock USSD]

- [ ] **Oracle price update front-running for stablecoin protocols**: Stablecoin mint/burn operations can be sandwich-attacked around oracle price updates. The attacker sees the oracle update in the mempool and trades before/after. Fix: add mint/burn fees, enforce deposit-to-withdraw delay. [Source: Cyfrin — Chainlink Oracle Security, Angle Research]

- [ ] **Unhandled oracle revert causes complete DoS**: Chainlink multisigs can block price feed access at will. If calls aren't wrapped in try/catch, a disabled feed bricks the entire protocol. Provide functionality to update oracle addresses post-deployment. [Source: Cyfrin — Chainlink Oracle Security, Code4rena Inverse]

- [ ] **WBTC depeg not detected when using BTC/USD feed**: If WBTC bridge is compromised, WBTC depegs from BTC but the protocol still prices WBTC at BTC/USD. Attacker buys cheap WBTC, deposits at BTC price. Use WBTC/BTC feed to monitor depeg. [Source: Cyfrin — Chainlink Oracle Security]

- [ ] **Oracle minAnswer/maxAnswer masks flash crash prices**: During flash crashes, the oracle returns its floor price (minAnswer) instead of actual price. Attacker buys asset cheaply on DEX, deposits at oracle's minAnswer price. Check: `minAnswer < answer < maxAnswer`. Read these from the aggregator contract. [Source: Cyfrin — Chainlink Oracle Security, Venus/Blizz exploit]

- [ ] **AMPL/USD uses 18 decimals, breaking the "USD feeds = 8 decimals" assumption**: Not all USD-denominated feeds use 8 decimals. Always call `AggregatorV3Interface.decimals()` to get the actual precision. [Source: Cyfrin — Chainlink Oracle Security]

- [ ] **VRF REQUEST_CONFIRMATIONS too low for target chain reorg depth**: Default value of 3 from Chainlink tutorial is insufficient for Polygon (frequent 30+ block reorgs). Chain-specific values needed per deployment. [Source: Cyfrin — Chainlink Oracle Security]

- [ ] **Bets/inputs accepted after randomness request**: If users can place bets or modify inputs after the VRF randomness request but before fulfillment, they can front-run the oracle response to game the outcome. [Source: Cyfrin — Chainlink Oracle Security]

- [ ] **Randomness callback selects against MUTABLE shared state (word-informed steering)**: The VRF word is *unbiasable* but *public in the mempool* for `requestConfirmations` blocks before the callback mines. If `fulfillRandomWords` computes the outcome from live state that anyone can change in that gap — `word % totalWeight`, an array length/order, a live balance/supply, a cumulative-weight tree/index — then whoever reads the pending word can move the result onto a chosen target. The mutating actor need NOT be the purchaser and need NOT touch "their own" input: a *third party's* deposit/mint/list that changes the *shared selection pool* every pending request resolves against is enough. Fix: snapshot all outcome-inputs at request time, or reject any callback that could have observed a post-request mutation (e.g. stage deposits so they can't enter the pool until after the last honorable callback block: `requestConfirmations + activationDelay > maxCallbackDelay`). Note: even when the Chainlink VRF wrapper itself is trusted/out-of-scope, the contract's *use* of the word (selection against mutable state) is in scope. Look for: `fulfillRandomWords`/reveal callbacks that read storage which any external function mutates; deposit/mint/list/withdraw/reprice functions with no lock while a request is pending. [Source: FWA / TokenWorks CryptoPunk #5450 incident, 2026]

- [ ] **One-directional lock on the selection window**: A window-lock that blocks *withdrawals* (pool shrink) but not *deposits* (pool growth) — or the reverse — still lets an attacker steer a pending randomness callback from the unguarded direction. Additive steering is as strong as subtractive. Look for: a `block.number < lastRequestBlock + lock` (or `withdrawLockBlocks`) guard on the withdraw path but no equivalent on deposit/mint/list, often with a comment like "pool growth never invalidates a pending request." [Source: FWA / TokenWorks CryptoPunk #5450 incident, 2026]

- [ ] **Fee/price slippage guard mistaken for a selection guard**: A callback that re-checks `fee`/`price` drift within a tolerance does NOT protect *which* item is selected. Selection via `word % N` is discontinuous in `N`, so a mutation far too small to push a smooth fee past its slippage tolerance can still relocate the selection target arbitrarily — the guard and the exploit have different sensitivities. Also: "selection always lands on a valid active item" is an invariant that stays true *during* the exploit; it is not proof that the item cannot be chosen by an adversary. Look for: a slippage/tolerance check inside the fulfillment that guards an amount/price, while the winning item is chosen from mutable weight/index/length. [Source: FWA / TokenWorks CryptoPunk #5450 incident, 2026]

## Sigma Prime — Oracles & Pricing (Phase 3)

- [ ] **Spot price manipulation via flash loans even with slippage checks**: Harvest Finance had 3% slippage checks but attacker profited $24M through repeated small cycles, each within the slippage tolerance. Avoid raw spot prices entirely; use TWAPs or off-chain oracles. [Source: Sigma Prime — Oracles & Pricing]

- [ ] **Homegrown oracle — multiple feeds dominated by single source**: Synthetix's multiple price feeds were all heavily influenced by the UniswapV1 MKR/ETH pool. Verify feed independence; median of correlated feeds provides false security. [Source: Sigma Prime — Oracles & Pricing]

- [ ] **Oracle front-running/backrunning via timing delays**: Users can observe pending oracle updates and trade just before/after to profit from the price delta. Use pull-style oracles, faster L2s, or settlement periods. [Source: Sigma Prime — Oracles & Pricing, Synthetix]

- [ ] **Gas congestion delays oracle updates — cascading liquidations**: On Black Thursday 2020, high gas caused Maker oracle lag, then a sudden 20% price drop caused mass liquidations. Bidding software couldn't handle gas spikes, allowing $0 bids to win $8.3M of ETH. Audit off-chain software too. [Source: Sigma Prime — Oracles & Pricing, MakerDAO]

- [ ] **Hardcoded price peg assumptions**: USDC/DAI can depeg (USDC hit $0.88 during SVB collapse). Never hardcode token==$1. Even tokens pegged to ETH (stETH, rETH) should use their own price feeds, not ETH's. [Source: Sigma Prime — Oracles & Pricing]

- [ ] **Manual multi-sig oracle update acts as hardcoded during delays**: If token price bounds require multi-sig to update, delayed signatures effectively hardcode the stale price, enabling exploitation. USDR/TNGBL was exploited this way. [Source: Sigma Prime — Oracles & Pricing, Tangible USDR]

- [ ] **TWAP mean can be skewed by single extreme reading**: With readings [10, 9999, 12, 11], mean TWAP = 2508 despite 75% of prices being ~10-12. Especially dangerous for illiquid pools. Consider median or trimmed mean. [Source: Sigma Prime — Oracles & Pricing]

- [ ] **Wrong decimal conversion factor in lending pool setup**: Morpho user deployed PAXG lending pool with incorrect decimal conversion between collateral and loan tokens. $230K drained. Test deployments with small amounts first. [Source: Sigma Prime — Oracles & Pricing]
# Chain-Specific EVM Security Checklist

## Arbitrum

### Block Number & Timing
- [ ] **`block.number` returns L1 block number**: On Arbitrum, `block.number` returns the approximate L1 block number, NOT the L2 block number. Use `ArbSys(0x64).arbBlockNumber()` for L2 block number. Time-based logic using `block.number` will have ~1000x lower resolution than expected. Look for: `block.number` used for timing, deadlines, or block-frequency calculations on Arbitrum. [multichain-auditor, beirao ARB-01]

- [ ] **Multiple L2 transactions per L1 block**: Unlike mainnet (1 tx can change `block.number`), many Arbitrum transactions share the same `block.number`. This breaks assumptions like "different block = different transaction". Look for: `require(block.number > lastBlock)` for uniqueness checks. [multichain-auditor]

- [ ] **`block.basefee` returns L1 basefee on Arbitrum**: Use `ArbGasInfo.getL1BaseFeeEstimate()` for L1 fees, and `ArbGasInfo` precompile methods for L2 gas prices. Look for: `block.basefee` used for gas calculations on Arbitrum. [multichain-auditor]

### Sequencer & Retryable Tickets
- [ ] **Sequencer downtime = stale oracle prices + delayed liquidations**: When the sequencer is down, no new transactions execute. When it resumes, oracle prices are stale and positions may have gone deeply underwater. Check the Chainlink sequencer uptime feed and apply grace periods. Look for: Chainlink usage on Arbitrum without sequencer uptime check. [multichain-auditor, beirao ARB-02]

- [ ] **Retryable ticket auto-redeem failure**: If a retryable ticket's auto-redeem fails (insufficient gas), it must be manually redeemed within 7 days or funds are permanently lost. Look for: L1→L2 message passing that assumes auto-redemption always succeeds. [Arbitrum docs]

- [ ] **L2→L1 message delay is 7+ days**: Withdrawals and messages from Arbitrum to L1 are subject to the challenge period (~7 days). Protocols that need faster finality should use a bridge/liquidity network. Look for: UX flows that assume fast L2→L1 message delivery. [Arbitrum docs]

### Address Aliasing
- [ ] **L1→L2 msg.sender is aliased**: When an L1 contract sends a message to L2, the `msg.sender` on L2 is `L1_address + 0x1111000000000000000000000000000000001111`. If access control on L2 checks the raw L1 address, it will ALWAYS fail. Must un-alias the sender. Look for: L1→L2 access control that compares `msg.sender` directly with an L1 contract address. [multichain-auditor, beirao ARB-03]

## Optimism / Base / OP Stack

- [ ] **`block.number` is L2 block number**: Unlike Arbitrum, Optimism returns the L2 block number from `block.number`. But L2 blocks on OP stack are produced every 2 seconds, not 12. Code calibrated for mainnet block times will run 6x faster. Look for: block-number-based timing with mainnet assumptions on OP Stack chains. [multichain-auditor]

- [ ] **L1 data fees**: Transactions on OP Stack pay both L2 execution gas AND L1 data posting gas. The L1 portion can be 90%+ of total cost. Protocols must account for this in gas estimation. Look for: gas estimation using only `gasleft()` without L1 data fee component. [multichain-auditor]

- [ ] **No `prevrandao` / `difficulty`**: On OP Stack L2s, `block.prevrandao` (formerly `block.difficulty`) returns a fixed value. It's NOT random. Look for: `block.prevrandao` or `block.difficulty` used as randomness source. [multichain-auditor]

## zkSync Era

- [ ] **`msg.sender == tx.origin` is true for smart contracts**: In zkSync Era, account abstraction is native — ALL accounts (including smart contracts) have `tx.origin == msg.sender` when they initiate transactions. This breaks the common "is EOA" check. Look for: `require(msg.sender == tx.origin)` as a contract-blocking mechanism. [multichain-auditor]

- [ ] **`EXTCODESIZE` returns 0 for non-EVM contracts**: zkSync has system contracts and native AA accounts that are contracts but return 0 for `extcodesize`. Look for: `extcodesize`-based contract detection. [multichain-auditor]

- [ ] **Different CREATE/CREATE2 address derivation**: zkSync uses a different formula for CREATE/CREATE2 addresses than EVM. Counterfactual addresses computed using the EVM formula will be wrong. Look for: off-chain address pre-computation using standard EVM CREATE2 formula. [multichain-auditor]

- [ ] **Missing opcodes**: `SELFDESTRUCT` is a no-op. `CALLCODE` is not supported. `EXTCODECOPY` may behave differently. Look for: usage of these opcodes on zkSync. [multichain-auditor]

- [ ] **No `receive()` / `fallback()` for ETH transfers**: On zkSync, receiving ETH may require explicit function handling. The default receive/fallback may not work as expected for system-level transfers. Look for: contracts expecting ETH via `receive()` on zkSync. [multichain-auditor]

## Blast

- [ ] **Native yield accrual on ETH balances**: On Blast, ETH held by contracts automatically earns yield. If a contract's logic depends on `address(this).balance` being stable, the balance will drift upward. Look for: precise balance checks like `require(address(this).balance == expectedAmount)`. [Blast docs]

- [ ] **USDB/WETH rebasing**: Blast-native tokens (USDB, WETH) are rebasing by default. Protocols that assume stable balances will have accounting errors. Opt for non-rebasing mode via `IERC20Rebasing(token).configure(YieldMode.CLAIMABLE)` or `YieldMode.VOID`. Look for: Blast deployments using USDB/WETH without configuring yield mode. [Blast docs]

- [ ] **Gas refund claim**: Blast refunds gas fees to contracts. If the contract doesn't implement yield/gas claiming, the refund is stuck. Look for: Blast contracts without `IBlast.claimAllGas()` functionality. [Blast docs]

## BNB Chain (BSC)

- [ ] **BNB token quirks**: BNB reverts on `approve(addr, 0)` but requires approval reset for USDT pattern. There's no universal approve pattern that works for both BNB and USDT. Look for: generic approve-to-zero patterns on BSC. [weird-erc20]

- [ ] **3-second block times**: BSC produces blocks every 3 seconds. Block-number-based timing runs 4x faster than Ethereum mainnet. Look for: block-count timing calibrated for 12-second blocks. [multichain-auditor]

- [ ] **Different precompiles**: BSC has custom precompiles for BLS signature verification and other functions at non-standard addresses. Look for: precompile address assumptions. [multichain-auditor]

## Polygon

- [ ] **MATIC → POL migration**: MATIC is being replaced by POL as the native gas token. Protocols hardcoding WMATIC addresses or assuming MATIC will need updates. Look for: hardcoded MATIC/WMATIC addresses. [multichain-auditor]

- [ ] **Reorgs are more common**: Polygon has more frequent chain reorganizations than Ethereum mainnet. Protocols that rely on block finality with fewer confirmations are at risk. Look for: single-block confirmation assumptions. [multichain-auditor]

- [ ] **USDT on Polygon returns bool (unlike Ethereum)**: Ethereum USDT has no return value; Polygon USDT returns bool. SafeERC20 handles both, but custom transfer wrappers may not. Look for: custom token interaction code that assumes no return value. [multichain-auditor]

## General L2 Considerations

- [ ] **PUSH0 support**: Solidity ≥0.8.20 defaults to Shanghai EVM which uses `PUSH0`. Chains that haven't adopted Shanghai (older L2s, app-chains) reject this opcode. Must compile with `--evm-version paris` or earlier. Look for: Solidity ≥0.8.20 deployed to chains without PUSH0 support. [multichain-auditor]

- [ ] **EIP-1559 parameters differ**: Each chain has its own base fee calculation, fee markets, and priority fee handling. Hardcoded gas parameters from mainnet will be wrong. Look for: hardcoded gas prices, base fee assumptions, or priority fee calculations. [multichain-auditor]

- [ ] **Bridged token addresses differ**: USDC on Ethereum ≠ USDC on Arbitrum ≠ USDC on Optimism. Each is a different contract address. Native USDC vs bridged USDC.e are completely different contracts. Look for: hardcoded token addresses in multi-chain config. [multichain-auditor]

- [ ] **Pre-deployed contract addresses may differ**: OpenZeppelin's `Create2` library, Gnosis Safe singleton, Uniswap factories — their addresses may vary across chains. Look for: hardcoded infrastructure contract addresses. [multichain-auditor]

- [ ] **`block.chainid` must be checked dynamically**: After hard forks, `block.chainid` changes. If cached at deploy time and used for signatures, the cached value is wrong on one fork. Look for: `immutable CHAIN_ID` set in constructor vs runtime `block.chainid` check. [multichain-auditor]

## Arbitrum Deep Dive (Expanded from Arbitrum Checklist)

- [ ] **`block.number` on Arbitrum returns L1 block number, not L2**: The L1 block number updates approximately every minute (~5 block jumps). Short-term timing based on `block.number` is unreliable. For L2 block numbers, use `ArbSys(100).arbBlockNumber()`. Look for: `block.number` used for short-term timing on Arbitrum. [Arbitrum Checklist]

- [ ] **Chainlink price feed staleness thresholds differ on Arbitrum**: LINK/ETH feed has 24h heartbeat with 18 decimals, while LINK/USD has 1h heartbeat with 8 decimals. Wrong threshold = stale prices accepted. Look for: hardcoded staleness thresholds or decimal values that don't match the specific Arbitrum feed. [Arbitrum Checklist]

- [ ] **Chainlink minAnswer/maxAnswer on Arbitrum feeds**: ETH/USD limited to [$10, $1M], USDC/USD limited to [$0.01, $1000], USDT/USD limited to [$0.01, $1000]. During flash crashes or extreme events, the feed returns min/max instead of real price. Look for: Chainlink integrations without checking `answer > minAnswer && answer < maxAnswer`. [Arbitrum Checklist]

- [ ] **Orbit chains with custom fee tokens**: Orbit chains (L3s built on Arbitrum) can use any ERC20 as the fee token instead of ETH. If the fee token has non-18 decimals (e.g., USDC = 6), amounts are scaled between L1 decimals and L2 native currency (18 decimals). Rounding losses occur during conversion. Look for: Orbit chain integrations assuming ETH-denominated fees. [Arbitrum Checklist]

- [ ] **Retryable ticket parameters use mixed denominations on Orbit**: `tokenTotalFeeAmount` uses the fee token's decimals (e.g., 6 for USDC), but `l2CallValue`, `maxSubmissionCost`, and `maxFeePerGas` use 18-decimal native currency denomination. Mixing these causes incorrect fee calculations. Look for: retryable ticket creation on Orbit chains where parameters aren't properly denominated. [Arbitrum Checklist]

## Multichain Deployment Gotchas (Expanded from Multichain-Auditor)

- [ ] **PUSH0 opcode not supported on all chains**: Solidity >=0.8.20 generates PUSH0. Arbitrum added support in ArbOS 11, Optimism in Canyon upgrade, but many chains still don't support it. Deploying 0.8.20+ compiled code to unsupported chains causes deployment failure. Look for: Solidity version >=0.8.20 in multichain deployments. [multichain-auditor, beirao MC-03]

- [ ] **`tx.origin == msg.sender` is not always true for EOAs on L2**: On Optimism, L1→L2 messages can have `tx.origin == msg.sender` even when the sender is a smart contract on L1. EOA-only checks using `tx.origin == msg.sender` are bypassable. Look for: `require(tx.origin == msg.sender)` as an EOA check on L2s. [multichain-auditor]

- [ ] **`transfer()` and `send()` fail on chains with different gas costs**: These forward 2300 gas, which may not be enough on chains with different gas pricing (zkSync Era). Use `.call{value: amount}("")` instead. Look for: `.transfer()` or `.send()` in multichain contracts. [multichain-auditor, beirao MC-04]

- [ ] **Frontrunning impossible on some L2s but trivial on others**: Optimism has a private mempool making frontrunning very difficult. Polygon has a public mempool making it cheap. Threat models must be chain-specific. Look for: frontrunning protections assumed unnecessary based on single-chain behavior. [multichain-auditor]

- [ ] **Hardcoded WETH/token addresses invalid across chains**: WETH is 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 on Ethereum but 0x7ceb23fd6bc0add59e62ac25578270cff1b9f619 on Polygon. Look for: any hardcoded contract address that's assumed same across chains. [multichain-auditor]

- [ ] **zkSync ERA has fundamentally different opcode behavior**: CREATE, CREATE2, CALL, STATICCALL, DELEGATECALL, MSTORE, MLOAD, CALLDATALOAD, CALLDATACOPY all behave differently on zkSync. Direct EVM contract deployment often fails. Look for: contracts deployed to zkSync without ERA-specific adaptation. [multichain-auditor, beirao MC-11]

- [ ] **Precompile addresses differ across chains**: Precompiled contracts exist at different addresses on Arbitrum, Optimism, and other L2s. Using a precompile address from one chain on another may call empty addresses or different contracts. Look for: hardcoded precompile addresses in multichain deployments. [multichain-auditor]

- [ ] **XDai/Gnosis chain token contracts have callbacks**: On Gnosis chain, USDC/WBTC/WETH had post-transfer callbacks unlike their Ethereum counterparts. This enabled reentrancy attacks and led to a chain hard fork. Look for: same-name tokens assumed to behave identically across chains. [multichain-auditor]

web search: 
web search: site:docs.chain.link data feeds l2 sequencer feeds grace period Arbitrum latestRoundData startedAt ...
web search: 
web search: https://docs.chain.link/data-feeds/l2-sequencer-feeds
codex
The root cause is confirmed: this was a missing L2-liveness guard, not an oracle-staleness failure. I’m writing the remediation so the recovery grace period blocks liquidations and other risk-increasing actions while keeping collateral deposits and repayments open.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-with-skill-1/audit-quiz-001/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8edb4b82a8f1bc57fe15f18f576c066990cbb056
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,88 @@
+# Post-mortem: fresh price, unavailable market
+
+## What happened
+
+The freshness check answered the question it was designed to answer: **how recently was this price published?** It did not answer the different question that matters here: **have borrowers had a fair opportunity to transact since the chain became usable again?**
+
+While the Arbitrum sequencer was unavailable, ordinary users could not execute their collateral deposits, but ETH price discovery continued elsewhere. No Solidity check could help users during that interval because their transactions were not being executed. When sequencing resumed, the oracle promptly published the current, 11%-lower price. Its `updatedAt` was therefore only seconds old, so the one-hour check correctly passed. The new price immediately made the positions liquidatable.
+
+The outage erased the borrowers' reaction window. In the first recovery blocks, a keeper only had to win transaction ordering against deposits that had been stuck or had to be resubmitted. A tighter price timeout would not prevent this: once a post-recovery oracle update arrives, its age resets to zero. The feed's 86,400-second heartbeat is also immaterial to this incident; deviation-triggered updates can arrive earlier, and the observed round was genuinely current.
+
+This is a missing **sequencer-liveness and post-recovery grace-period check**. Price validity and chain availability are independent safety conditions. Chainlink documents this precise L2 failure mode and provides an Arbitrum Sequencer Uptime Feed for it: `answer == 0` means up, `answer == 1` means down, and `startedAt` records the latest status transition. Its current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. See [Chainlink's L2 Sequencer Uptime Feed documentation](https://docs.chain.link/data-feeds/l2-sequencer-feeds).
+
+## Required contract change
+
+Integrate the Arbitrum Sequencer Uptime Feed and require both:
+
+1. the sequencer is currently up; and
+2. a configured grace period has elapsed since it came back up.
+
+For example:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriodNotOver();
+
+function _requireSequencerHealthy() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Arbitrum's feed can return startedAt == 0 before initialization.
+    if (startedAt == 0) revert SequencerFeedUninitialized();
+    if (status != 0) revert SequencerDown();
+
+    // `startedAt` is when the current "up" status began.
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodNotOver();
+    }
+}
+
+function _readRiskPrice() internal view returns (uint256) {
+    // This must be before reading or acting on the asset price.
+    _requireSequencerHealthy();
+
+    (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt,
+        uint80 answeredInRound) = feed.latestRoundData();
+
+    require(answer > 0, "bad price");
+    require(startedAt != 0 && updatedAt != 0, "invalid round");
+    require(answeredInRound >= roundId, "incomplete round");
+    require(updatedAt <= block.timestamp, "future price");
+    require(block.timestamp - updatedAt <= PRICE_MAX_AGE, "stale price");
+
+    return uint256(answer);
+}
+```
+
+Use the verified uptime-feed proxy for the deployment network rather than blindly copying an address, and make the grace period an explicit risk parameter. One hour is the standard example and would have prevented this incident; the protocol should choose a period long enough for RPCs, the oracle, keepers, and users to recover and for defensive transactions to be included. Alerting and an emergency pause are useful additional controls, but neither substitutes for the on-chain guard.
+
+## Where the guard belongs
+
+Apply `_requireSequencerHealthy()` at the beginning of every state-changing path that consumes a price to worsen a user's risk or seize collateral, before the price read and before any effects or external calls. At minimum this includes:
+
+- `liquidate` and batch-liquidation entry points;
+- borrowing or minting more debt; and
+- withdrawing collateral or any equivalent risk-increasing operation.
+
+The liquidation path should therefore be ordered as:
+
+```text
+check sequencer is up
+-> check post-recovery grace period has elapsed
+-> read and validate the price round
+-> calculate position health
+-> perform liquidation
+```
+
+Do **not** put the recovery guard on risk-reducing operations. Adding collateral and repaying debt must remain callable as soon as transactions can execute, including during the grace period. If those functions currently call a shared health-checking price function, split the flow so they do not need an oracle read. Otherwise the proposed protection would also prevent borrowers from curing their positions during the window created for them.
+
+Views may expose both the raw validated price and the sequencer status for monitoring, but no liquidation route may bypass the guarded risk-price path. Batch liquidations must perform the guard before processing the batch (or inherit it from a non-bypassable internal liquidation function).
+
+## Why this fixes the incident
+
+On recovery, the fresh market price may still show that the 38 accounts are below 125%. That fact is not ignored; its enforcement is delayed. During the grace period, keepers cannot liquidate, while borrowers can add wstETH or repay USDC. After the grace period, normal price validation and liquidation resume. The system then preserves both requirements: economically current pricing and a real opportunity for users to react after an L2 availability failure.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8edb4b82a8f1bc57fe15f18f576c066990cbb056
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,88 @@
+# Post-mortem: fresh price, unavailable market
+
+## What happened
+
+The freshness check answered the question it was designed to answer: **how recently was this price published?** It did not answer the different question that matters here: **have borrowers had a fair opportunity to transact since the chain became usable again?**
+
+While the Arbitrum sequencer was unavailable, ordinary users could not execute their collateral deposits, but ETH price discovery continued elsewhere. No Solidity check could help users during that interval because their transactions were not being executed. When sequencing resumed, the oracle promptly published the current, 11%-lower price. Its `updatedAt` was therefore only seconds old, so the one-hour check correctly passed. The new price immediately made the positions liquidatable.
+
+The outage erased the borrowers' reaction window. In the first recovery blocks, a keeper only had to win transaction ordering against deposits that had been stuck or had to be resubmitted. A tighter price timeout would not prevent this: once a post-recovery oracle update arrives, its age resets to zero. The feed's 86,400-second heartbeat is also immaterial to this incident; deviation-triggered updates can arrive earlier, and the observed round was genuinely current.
+
+This is a missing **sequencer-liveness and post-recovery grace-period check**. Price validity and chain availability are independent safety conditions. Chainlink documents this precise L2 failure mode and provides an Arbitrum Sequencer Uptime Feed for it: `answer == 0` means up, `answer == 1` means down, and `startedAt` records the latest status transition. Its current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. See [Chainlink's L2 Sequencer Uptime Feed documentation](https://docs.chain.link/data-feeds/l2-sequencer-feeds).
+
+## Required contract change
+
+Integrate the Arbitrum Sequencer Uptime Feed and require both:
+
+1. the sequencer is currently up; and
+2. a configured grace period has elapsed since it came back up.
+
+For example:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriodNotOver();
+
+function _requireSequencerHealthy() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Arbitrum's feed can return startedAt == 0 before initialization.
+    if (startedAt == 0) revert SequencerFeedUninitialized();
+    if (status != 0) revert SequencerDown();
+
+    // `startedAt` is when the current "up" status began.
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodNotOver();
+    }
+}
+
+function _readRiskPrice() internal view returns (uint256) {
+    // This must be before reading or acting on the asset price.
+    _requireSequencerHealthy();
+
+    (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt,
+        uint80 answeredInRound) = feed.latestRoundData();
+
+    require(answer > 0, "bad price");
+    require(startedAt != 0 && updatedAt != 0, "invalid round");
+    require(answeredInRound >= roundId, "incomplete round");
+    require(updatedAt <= block.timestamp, "future price");
+    require(block.timestamp - updatedAt <= PRICE_MAX_AGE, "stale price");
+
+    return uint256(answer);
+}
+```
+
+Use the verified uptime-feed proxy for the deployment network rather than blindly copying an address, and make the grace period an explicit risk parameter. One hour is the standard example and would have prevented this incident; the protocol should choose a period long enough for RPCs, the oracle, keepers, and users to recover and for defensive transactions to be included. Alerting and an emergency pause are useful additional controls, but neither substitutes for the on-chain guard.
+
+## Where the guard belongs
+
+Apply `_requireSequencerHealthy()` at the beginning of every state-changing path that consumes a price to worsen a user's risk or seize collateral, before the price read and before any effects or external calls. At minimum this includes:
+
+- `liquidate` and batch-liquidation entry points;
+- borrowing or minting more debt; and
+- withdrawing collateral or any equivalent risk-increasing operation.
+
+The liquidation path should therefore be ordered as:
+
+```text
+check sequencer is up
+-> check post-recovery grace period has elapsed
+-> read and validate the price round
+-> calculate position health
+-> perform liquidation
+```
+
+Do **not** put the recovery guard on risk-reducing operations. Adding collateral and repaying debt must remain callable as soon as transactions can execute, including during the grace period. If those functions currently call a shared health-checking price function, split the flow so they do not need an oracle read. Otherwise the proposed protection would also prevent borrowers from curing their positions during the window created for them.
+
+Views may expose both the raw validated price and the sequencer status for monitoring, but no liquidation route may bypass the guarded risk-price path. Batch liquidations must perform the guard before processing the batch (or inherit it from a non-bypassable internal liquidation function).
+
+## Why this fixes the incident
+
+On recovery, the fresh market price may still show that the 38 accounts are below 125%. That fact is not ignored; its enforcement is delayed. During the grace period, keepers cannot liquidate, while borrowers can add wstETH or repay USDC. After the grace period, normal price validation and liquidation resume. The system then preserves both requirements: economically current pricing and a real opportunity for users to react after an L2 availability failure.

exec
/bin/bash -lc "test -s answer.md && sed -n '1,260p' answer.md && git status --short" in /tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-with-skill-1/audit-quiz-001
 succeeded in 8ms:
# Post-mortem: fresh price, unavailable market

## What happened

The freshness check answered the question it was designed to answer: **how recently was this price published?** It did not answer the different question that matters here: **have borrowers had a fair opportunity to transact since the chain became usable again?**

While the Arbitrum sequencer was unavailable, ordinary users could not execute their collateral deposits, but ETH price discovery continued elsewhere. No Solidity check could help users during that interval because their transactions were not being executed. When sequencing resumed, the oracle promptly published the current, 11%-lower price. Its `updatedAt` was therefore only seconds old, so the one-hour check correctly passed. The new price immediately made the positions liquidatable.

The outage erased the borrowers' reaction window. In the first recovery blocks, a keeper only had to win transaction ordering against deposits that had been stuck or had to be resubmitted. A tighter price timeout would not prevent this: once a post-recovery oracle update arrives, its age resets to zero. The feed's 86,400-second heartbeat is also immaterial to this incident; deviation-triggered updates can arrive earlier, and the observed round was genuinely current.

This is a missing **sequencer-liveness and post-recovery grace-period check**. Price validity and chain availability are independent safety conditions. Chainlink documents this precise L2 failure mode and provides an Arbitrum Sequencer Uptime Feed for it: `answer == 0` means up, `answer == 1` means down, and `startedAt` records the latest status transition. Its current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. See [Chainlink's L2 Sequencer Uptime Feed documentation](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

## Required contract change

Integrate the Arbitrum Sequencer Uptime Feed and require both:

1. the sequencer is currently up; and
2. a configured grace period has elapsed since it came back up.

For example:

```solidity
AggregatorV3Interface public immutable sequencerUptimeFeed;

uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;

error SequencerDown();
error SequencerFeedUninitialized();
error SequencerGracePeriodNotOver();

function _requireSequencerHealthy() internal view {
    (, int256 status, uint256 startedAt,,) =
        sequencerUptimeFeed.latestRoundData();

    // Arbitrum's feed can return startedAt == 0 before initialization.
    if (startedAt == 0) revert SequencerFeedUninitialized();
    if (status != 0) revert SequencerDown();

    // `startedAt` is when the current "up" status began.
    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerGracePeriodNotOver();
    }
}

function _readRiskPrice() internal view returns (uint256) {
    // This must be before reading or acting on the asset price.
    _requireSequencerHealthy();

    (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt,
        uint80 answeredInRound) = feed.latestRoundData();

    require(answer > 0, "bad price");
    require(startedAt != 0 && updatedAt != 0, "invalid round");
    require(answeredInRound >= roundId, "incomplete round");
    require(updatedAt <= block.timestamp, "future price");
    require(block.timestamp - updatedAt <= PRICE_MAX_AGE, "stale price");

    return uint256(answer);
}
```

Use the verified uptime-feed proxy for the deployment network rather than blindly copying an address, and make the grace period an explicit risk parameter. One hour is the standard example and would have prevented this incident; the protocol should choose a period long enough for RPCs, the oracle, keepers, and users to recover and for defensive transactions to be included. Alerting and an emergency pause are useful additional controls, but neither substitutes for the on-chain guard.

## Where the guard belongs

Apply `_requireSequencerHealthy()` at the beginning of every state-changing path that consumes a price to worsen a user's risk or seize collateral, before the price read and before any effects or external calls. At minimum this includes:

- `liquidate` and batch-liquidation entry points;
- borrowing or minting more debt; and
- withdrawing collateral or any equivalent risk-increasing operation.

The liquidation path should therefore be ordered as:

```text
check sequencer is up
-> check post-recovery grace period has elapsed
-> read and validate the price round
-> calculate position health
-> perform liquidation
```

Do **not** put the recovery guard on risk-reducing operations. Adding collateral and repaying debt must remain callable as soon as transactions can execute, including during the grace period. If those functions currently call a shared health-checking price function, split the flow so they do not need an oracle read. Otherwise the proposed protection would also prevent borrowers from curing their positions during the window created for them.

Views may expose both the raw validated price and the sequencer status for monitoring, but no liquidation route may bypass the guarded risk-price path. Batch liquidations must perform the guard before processing the batch (or inherit it from a non-bypassable internal liquidation function).

## Why this fixes the incident

On recovery, the fresh market price may still show that the 38 accounts are below 125%. That fact is not ignored; its enforcement is delayed. During the grace period, keepers cannot liquidate, while borrowers can add wstETH or repay USDC. After the grace period, normal price validation and liquidation resume. The system then preserves both requirements: economically current pricing and a real opportunity for users to react after an L2 availability failure.
?? answer.md

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8edb4b82a8f1bc57fe15f18f576c066990cbb056
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,88 @@
+# Post-mortem: fresh price, unavailable market
+
+## What happened
+
+The freshness check answered the question it was designed to answer: **how recently was this price published?** It did not answer the different question that matters here: **have borrowers had a fair opportunity to transact since the chain became usable again?**
+
+While the Arbitrum sequencer was unavailable, ordinary users could not execute their collateral deposits, but ETH price discovery continued elsewhere. No Solidity check could help users during that interval because their transactions were not being executed. When sequencing resumed, the oracle promptly published the current, 11%-lower price. Its `updatedAt` was therefore only seconds old, so the one-hour check correctly passed. The new price immediately made the positions liquidatable.
+
+The outage erased the borrowers' reaction window. In the first recovery blocks, a keeper only had to win transaction ordering against deposits that had been stuck or had to be resubmitted. A tighter price timeout would not prevent this: once a post-recovery oracle update arrives, its age resets to zero. The feed's 86,400-second heartbeat is also immaterial to this incident; deviation-triggered updates can arrive earlier, and the observed round was genuinely current.
+
+This is a missing **sequencer-liveness and post-recovery grace-period check**. Price validity and chain availability are independent safety conditions. Chainlink documents this precise L2 failure mode and provides an Arbitrum Sequencer Uptime Feed for it: `answer == 0` means up, `answer == 1` means down, and `startedAt` records the latest status transition. Its current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. See [Chainlink's L2 Sequencer Uptime Feed documentation](https://docs.chain.link/data-feeds/l2-sequencer-feeds).
+
+## Required contract change
+
+Integrate the Arbitrum Sequencer Uptime Feed and require both:
+
+1. the sequencer is currently up; and
+2. a configured grace period has elapsed since it came back up.
+
+For example:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriodNotOver();
+
+function _requireSequencerHealthy() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Arbitrum's feed can return startedAt == 0 before initialization.
+    if (startedAt == 0) revert SequencerFeedUninitialized();
+    if (status != 0) revert SequencerDown();
+
+    // `startedAt` is when the current "up" status began.
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodNotOver();
+    }
+}
+
+function _readRiskPrice() internal view returns (uint256) {
+    // This must be before reading or acting on the asset price.
+    _requireSequencerHealthy();
+
+    (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt,
+        uint80 answeredInRound) = feed.latestRoundData();
+
+    require(answer > 0, "bad price");
+    require(startedAt != 0 && updatedAt != 0, "invalid round");
+    require(answeredInRound >= roundId, "incomplete round");
+    require(updatedAt <= block.timestamp, "future price");
+    require(block.timestamp - updatedAt <= PRICE_MAX_AGE, "stale price");
+
+    return uint256(answer);
+}
+```
+
+Use the verified uptime-feed proxy for the deployment network rather than blindly copying an address, and make the grace period an explicit risk parameter. One hour is the standard example and would have prevented this incident; the protocol should choose a period long enough for RPCs, the oracle, keepers, and users to recover and for defensive transactions to be included. Alerting and an emergency pause are useful additional controls, but neither substitutes for the on-chain guard.
+
+## Where the guard belongs
+
+Apply `_requireSequencerHealthy()` at the beginning of every state-changing path that consumes a price to worsen a user's risk or seize collateral, before the price read and before any effects or external calls. At minimum this includes:
+
+- `liquidate` and batch-liquidation entry points;
+- borrowing or minting more debt; and
+- withdrawing collateral or any equivalent risk-increasing operation.
+
+The liquidation path should therefore be ordered as:
+
+```text
+check sequencer is up
+-> check post-recovery grace period has elapsed
+-> read and validate the price round
+-> calculate position health
+-> perform liquidation
+```
+
+Do **not** put the recovery guard on risk-reducing operations. Adding collateral and repaying debt must remain callable as soon as transactions can execute, including during the grace period. If those functions currently call a shared health-checking price function, split the flow so they do not need an oracle read. Otherwise the proposed protection would also prevent borrowers from curing their positions during the window created for them.
+
+Views may expose both the raw validated price and the sequencer status for monitoring, but no liquidation route may bypass the guarded risk-price path. Batch liquidations must perform the guard before processing the batch (or inherit it from a non-bypassable internal liquidation function).
+
+## Why this fixes the incident
+
+On recovery, the fresh market price may still show that the 38 accounts are below 125%. That fact is not ignored; its enforcement is delayed. During the grace period, keepers cannot liquidate, while borrowers can add wstETH or repay USDC. After the grace period, normal price validation and liquidation resume. The system then preserves both requirements: economically current pricing and a real opportunity for users to react after an L2 availability failure.

codex
Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-with-skill-1/audit-quiz-001/answer.md).

It identifies the missing sequencer-liveness check, adds a post-recovery grace period before liquidation, and keeps collateral deposits and debt repayments available during that period.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8edb4b82a8f1bc57fe15f18f576c066990cbb056
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,88 @@
+# Post-mortem: fresh price, unavailable market
+
+## What happened
+
+The freshness check answered the question it was designed to answer: **how recently was this price published?** It did not answer the different question that matters here: **have borrowers had a fair opportunity to transact since the chain became usable again?**
+
+While the Arbitrum sequencer was unavailable, ordinary users could not execute their collateral deposits, but ETH price discovery continued elsewhere. No Solidity check could help users during that interval because their transactions were not being executed. When sequencing resumed, the oracle promptly published the current, 11%-lower price. Its `updatedAt` was therefore only seconds old, so the one-hour check correctly passed. The new price immediately made the positions liquidatable.
+
+The outage erased the borrowers' reaction window. In the first recovery blocks, a keeper only had to win transaction ordering against deposits that had been stuck or had to be resubmitted. A tighter price timeout would not prevent this: once a post-recovery oracle update arrives, its age resets to zero. The feed's 86,400-second heartbeat is also immaterial to this incident; deviation-triggered updates can arrive earlier, and the observed round was genuinely current.
+
+This is a missing **sequencer-liveness and post-recovery grace-period check**. Price validity and chain availability are independent safety conditions. Chainlink documents this precise L2 failure mode and provides an Arbitrum Sequencer Uptime Feed for it: `answer == 0` means up, `answer == 1` means down, and `startedAt` records the latest status transition. Its current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. See [Chainlink's L2 Sequencer Uptime Feed documentation](https://docs.chain.link/data-feeds/l2-sequencer-feeds).
+
+## Required contract change
+
+Integrate the Arbitrum Sequencer Uptime Feed and require both:
+
+1. the sequencer is currently up; and
+2. a configured grace period has elapsed since it came back up.
+
+For example:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriodNotOver();
+
+function _requireSequencerHealthy() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Arbitrum's feed can return startedAt == 0 before initialization.
+    if (startedAt == 0) revert SequencerFeedUninitialized();
+    if (status != 0) revert SequencerDown();
+
+    // `startedAt` is when the current "up" status began.
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodNotOver();
+    }
+}
+
+function _readRiskPrice() internal view returns (uint256) {
+    // This must be before reading or acting on the asset price.
+    _requireSequencerHealthy();
+
+    (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt,
+        uint80 answeredInRound) = feed.latestRoundData();
+
+    require(answer > 0, "bad price");
+    require(startedAt != 0 && updatedAt != 0, "invalid round");
+    require(answeredInRound >= roundId, "incomplete round");
+    require(updatedAt <= block.timestamp, "future price");
+    require(block.timestamp - updatedAt <= PRICE_MAX_AGE, "stale price");
+
+    return uint256(answer);
+}
+```
+
+Use the verified uptime-feed proxy for the deployment network rather than blindly copying an address, and make the grace period an explicit risk parameter. One hour is the standard example and would have prevented this incident; the protocol should choose a period long enough for RPCs, the oracle, keepers, and users to recover and for defensive transactions to be included. Alerting and an emergency pause are useful additional controls, but neither substitutes for the on-chain guard.
+
+## Where the guard belongs
+
+Apply `_requireSequencerHealthy()` at the beginning of every state-changing path that consumes a price to worsen a user's risk or seize collateral, before the price read and before any effects or external calls. At minimum this includes:
+
+- `liquidate` and batch-liquidation entry points;
+- borrowing or minting more debt; and
+- withdrawing collateral or any equivalent risk-increasing operation.
+
+The liquidation path should therefore be ordered as:
+
+```text
+check sequencer is up
+-> check post-recovery grace period has elapsed
+-> read and validate the price round
+-> calculate position health
+-> perform liquidation
+```
+
+Do **not** put the recovery guard on risk-reducing operations. Adding collateral and repaying debt must remain callable as soon as transactions can execute, including during the grace period. If those functions currently call a shared health-checking price function, split the flow so they do not need an oracle read. Otherwise the proposed protection would also prevent borrowers from curing their positions during the window created for them.
+
+Views may expose both the raw validated price and the sequencer status for monitoring, but no liquidation route may bypass the guarded risk-price path. Batch liquidations must perform the guard before processing the batch (or inherit it from a non-bypassable internal liquidation function).
+
+## Why this fixes the incident
+
+On recovery, the fresh market price may still show that the 38 accounts are below 125%. That fact is not ignored; its enforcement is delayed. During the grace period, keepers cannot liquidate, while borrowers can add wstETH or repay USDC. After the grace period, normal price validation and liquidation resume. The system then preserves both requirements: economically current pricing and a real opportunity for users to react after an L2 availability failure.

tokens used
42,573
````

## final message

Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-with-skill-1/audit-quiz-001/answer.md).

It identifies the missing sequencer-liveness check, adds a post-recovery grace period before liquidation, and keeps collateral deposits and debt repayments available during that period.

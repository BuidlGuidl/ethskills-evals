# Base Gas Plan

## Baseline as of 2026-09-23

Base/OP Stack fees have two relevant components: L2 execution fee plus an L1 data/security fee. The OP Stack spec says the L1 fee is charged to the L2 sender and is based on the encoded transaction data posted back to Ethereum; BaseHub describes the same L2 execution plus L1 security fee split.

I sampled recent Base USDC `transfer(address,uint256)` receipts from `https://mainnet.base.org` at block `51686174`, using ETH/USD `2746.43` from Investing.com's 2026-09-23 ETH/USD quote.

| Metric | Sample result |
| --- | ---: |
| Recent L2 base fee | `0.005 gwei` |
| Recent median priority fee | `0.001 gwei` |
| Median ERC-20 transfer gas used | `45,071` gas |
| Median effective execution gas price | `0.006000 gwei` |
| Median total per transfer | `275,764,142,144 wei` = `0.000000275764 ETH` |
| Median total per transfer in USD | `$0.000757` |
| 40,000 transfers/day at median | `$30.29/day`, `$11,057.56/year` |
| Public-sample average including high-tip outliers | `$181.32/day`, `$66,182.20/year` |

Important caveat: this is a market snapshot and USDC-like transfer sample, not yet your actual relayer spend. The shipped `npm run gas:report` script below computes actuals from your relayer's receipts, including receipt `l1Fee`.

## Ranked Changes

### 1. Measure and budget actual relayer spend from receipts

Expected savings: not a direct gas reduction, but it prevents finance and engineering from optimizing the wrong thing. At the current median sampled price, every 1,000 daily transfers is about `$276/year`; a 10% error in volume or gas assumptions is about `$1,106/year`.

Shipped code:

```bash
RELAYER_ADDRESS=0xYourRelayer \
ETH_USD=2746.43 \
npm run gas:report
```

Optional filters:

```bash
START_BLOCK=51642845 END_BLOCK=51686045 \
TOKEN_ADDRESSES=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 \
MAX_BLOCK_SPAN=2000 \
npm run gas:report
```

This scans ERC-20 `Transfer` logs where `from == relayer`, fetches each receipt, keeps only transactions whose sender is the relayer, and sums `gasUsed * effectiveGasPrice + l1Fee`.

### 2. Send fewer transfers by netting and aggregation

Expected savings: linear with eliminated transfers. At the sampled baseline:

| Transfer reduction | Saved transfers/day | Savings/day | Savings/year |
| ---: | ---: | ---: | ---: |
| 5% | 2,000 | `$1.51` | `$553` |
| 10% | 4,000 | `$3.03` | `$1,106` |
| 25% | 10,000 | `$7.57` | `$2,764` |
| 50% | 20,000 | `$15.15` | `$5,529` |

This is the biggest guaranteed lever because one avoided ERC-20 transfer avoids essentially the whole fee. Product examples: net multiple same-recipient obligations before settlement, hold a short payout queue for users who accept delayed settlement, or aggregate internal ledger movements before touching chain.

### 3. Batch payouts on-chain where immediate settlement still matters

Expected savings: about `20-35%` for transfers that can move through a funded batcher contract. For the full 40,000/day flow, that is roughly `$6.06-$10.60/day` or `$2,212-$3,870/year` at today's sampled median fees.

Why the range: the ERC-20 storage/event work still happens once per recipient, but batching amortizes the 21,000-gas transaction base cost and some transaction envelope overhead across many recipients. Savings depend on token behavior, average batch size, recipient storage state, and whether you can prefund the batcher without adding extra top-up transactions.

Shipped code: `contracts/PaymentBatcher.sol`. It is owner-controlled, token-funded, checks zero addresses, handles ERC-20s that return no data or `bool`, and includes an owner rescue path.

Recommended rollout:

1. Deploy per asset or as a shared batcher.
2. Fund the batcher from treasury/relayer.
3. Use batch sizes that fit operational risk; 50-200 recipients is a practical starting point.
4. Compare sampled `gasUsed / payment` against the current direct-send baseline before moving all flow.

Do not use this for tokens with transfer hooks, rebasing surprises, blacklists, or other nonstandard behavior until they are explicitly tested.

### 4. Cap Base priority fees at current market levels

Expected savings: only material if the relayer currently over-tips. The current sampled median priority fee is `0.001 gwei`. Every extra `0.001 gwei` paid on a `51,843`-gas transfer costs:

```text
51,843 gas * 0.001 gwei = 51,843,000 wei = $0.000000142/tx
40,000/day = $2.08/year
```

So cutting a very high `0.1 gwei` excess tip saves only about `$179/year`; cutting a `1 gwei` excess tip saves about `$1,805/year`. Use EIP-1559 transactions with a low priority fee unless your own reporting shows stuck transactions.

Shipped code:

```bash
npm run gas:fees
```

The helper currently suggests a `0.001 gwei` priority fee floor and `2x latest base fee + priority` max fee cap. Wire those `maxFeePerGas` and `maxPriorityFeePerGas` values into the relayer if it is not already using comparable caps.

### 5. Calldata minimization is not worth a standalone project

Expected savings: small for ordinary ERC-20 transfers. In the current sample, receipt `l1Fee` was generally around `3e9 wei`, about `$0.000008/tx` or roughly `$120/year` for 40,000/day. Batching already captures most practical transaction-envelope savings. Custom calldata compression would add contract complexity for less savings than netting, batching, or correcting an excessive priority fee.

## Sources

- OP Stack execution fee and L1 cost specification: https://specs.optimism.io/protocol/exec-engine.html
- Base fee overview: https://basehub.org/network/network-fees/
- ETH/USD quote used for the USD conversion: https://www.investing.com/crypto/ethereum/eth-usd-historical-data

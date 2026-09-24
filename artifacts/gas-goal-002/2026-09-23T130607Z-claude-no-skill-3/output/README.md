# Batched ERC-20 payouts on Base

Findings and recommendations: **[PLAN.md](PLAN.md)**.

Headline: batching payouts and tuning the priority fee cuts gas cost per payout
by ~73% (measured, real USDC on a Base mainnet fork). At 40,000 payouts/day
that is ~$11,700/yr down to ~$3,200/yr at current Base conditions — and far more
if Base gets congested.

## Layout

    contracts/BatchTransfer.sol   batch payout contract (pull or float custody)
    src/batcher.mjs               queueing relayer with preflight + retry ladder
    src/feeStrategy.mjs           priority-fee ladder (opens at 1,000 wei)
    src/encode.mjs                packed address||uint96 payout encoding
    src/gasReport.mjs             spend accounting from receipts, for finance
    src/adapters/viem.mjs         viem wiring
    scripts/                      the measurements behind every number in PLAN.md
    data/                         measurement output (regenerate: npm run measure)

## Use

```js
import { BatchRelayer } from './src/batcher.mjs';
import { viemClient } from './src/adapters/viem.mjs';

const relayer = new BatchRelayer({
  client: viemClient(publicClient, walletClient),
  batchTransfer: '0x...',      // deployed via script/Deploy.s.sol
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  mode: 'pull',                 // funds stay in your wallet
  fundingAccount: '0x...',      // must approve batchTransfer
  maxBatchSize: 200,
  maxWaitMs: 15_000,
  onEvent: (e) => log.info(e),  // batch_sent | batch_retry | payout_dropped
});

await relayer.enqueue('0xrecipient', 1_000_000n); // resolves when the batch lands
```

## Tests

```bash
forge test                      # contract
npm test                        # unit
npm run test:integration        # end-to-end against real USDC on a fork
```

Requires Foundry for the contract and fork tests.

# Recommendation: deploy the first version on Ethereum mainnet

For an escrow service holding $2,000 to $50,000 per job, I would deploy the core escrow contract on Ethereum mainnet first. The reason is not that L2s are expensive--they are cheaper--but that the measured mainnet cost is already tiny relative to the value in escrow, while mainnet gives the simplest security, liquidity, custody, and settlement story.

If the product later needs frequent small actions, in-app wallet UX, or users who already keep funds on an L2, I would add a Base deployment as the first L2 expansion. I would not start there for the high-value custody path unless those UX requirements are more important than minimizing bridge/sequencer assumptions.

## Live numbers used

Measured on 2026-09-23:

- ETH/USD: $2,734.065 from Coinbase spot API.
- Ethereum mainnet gas price: 292,488,532 wei = 0.292488532 gwei.
- Base gas price: 6,000,000 wei = 0.006 gwei.
- Arbitrum gas price: 20,022,000 wei = 0.020022 gwei.
- Optimism gas price: 1,000,623 wei = 0.001000623 gwei.
- Base L1 data fee for a representative 200-byte call, read from `GasPriceOracle.getL1Fee(bytes)`: 3,030,513,017 wei = about $0.0000083.
- Optimism L1 data fee for the same 200-byte call: 4,238,116,190 wei = about $0.0000116.

Formula used for Ethereum mainnet execution cost:

```text
cost_usd = gas_used * gas_price_gwei * 1e-9 * eth_usd
```

Formula used for Base:

```text
cost_usd = (gas_used * gas_price_gwei * 1e-9 + l1_fee_eth) * eth_usd
```

## Escrow workload assumptions

Without the final contract bytecode, I used conservative planning estimates:

- `fundEscrow`: about 150,000 gas for ERC-20 transfer plus storage updates.
- `releaseEscrow`: about 100,000 gas for state update plus ERC-20 transfer.
- Normal completed job: about 250,000 total gas.
- Heavier disputed job: about 500,000 total gas.
- Initial deployment: about 1,500,000 gas.

These are estimates, so final numbers should be re-run from traces once the contract exists.

## Cost estimates

At the measured mainnet price:

- Normal completed job, 250,000 gas: about $0.20.
- Heavier disputed job, 500,000 gas: about $0.40.
- 1.5M gas deployment: about $1.20.

At the measured Base price:

- Normal completed job, 250,000 gas execution: about $0.0041.
- Add two representative 200-byte Base L1 data fees: about $0.000017.
- Normal completed job total on Base: about $0.0041.
- 1.5M gas deployment execution: about $0.025, plus deployment L1 data fees.

So Base is roughly 50x cheaper for the normal job path in this snapshot, but the absolute savings are only about $0.20 per job.

For a $2,000 escrow, a $0.20 mainnet cost is about 0.010% of the job value. For a $50,000 escrow, it is about 0.0004%. Even a heavier $0.40 disputed path is only about 0.020% of a $2,000 job.

## Why mainnet wins for this product

The core product is custody of meaningful funds, not high-frequency interaction. Each job probably needs only a few state transitions: fund, release, refund, or resolve dispute. With measured mainnet gas this low, transaction fees are not a deciding cost for $2,000 to $50,000 escrows.

Mainnet gives the cleanest version of the trust promise:

- No canonical bridge risk for deposited funds.
- No L2 sequencer availability or censorship assumptions in the core custody path.
- Deep stablecoin liquidity and the broadest wallet/exchange support.
- Stronger neutrality for disputes between clients and freelancers.
- Easier explanation to users: funds settle directly on Ethereum, not through a rollup bridge.

L2s still make sense if user experience dominates. I would choose Base for a second deployment because it is cheap in the measured data, has strong wallet/on-ramp support, and is practical for consumer-style payment flows. But for the initial high-value escrow contract, I would optimize for settlement confidence over saving a few cents.

## Final recommendation

Deploy the primary escrow service on Ethereum mainnet, charge or abstract the gas fee, and denominate escrows in a major stablecoin such as USDC. Add Base later as an optional low-fee venue if customers need cheaper or faster interactions, but do not make the L2 the sole custody path for $2,000 to $50,000 jobs.

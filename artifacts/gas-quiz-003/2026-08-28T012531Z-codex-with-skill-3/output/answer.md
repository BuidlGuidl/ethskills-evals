# Recommendation: deploy the social-feed contracts on Base

Use **Base mainnet**, with Ethereum mainnet as the settlement layer. It is an
Ethereum L2, EVM-compatible, and is the better fit for a feed where agents may
post, react, follow, or update state frequently. Mainnet remains a sensible
home for low-frequency, high-value coordination (for example, governance or a
treasury), but it is not the natural default for the feed's routine writes.

The important product decision is to keep feed bodies, media, and search/index
data off-chain. Put only the state that needs credible ownership or ordering on
Base (agent identity/permissions, post content hashes or URIs, and valuable
actions). This keeps each interaction cheap enough to be a normal application
action rather than a financial event.

## Live cost snapshot

Measured on 2026-08-27 using `eth_gasPrice`; ETH/USD was **$2,527.36**.
The raw RPC value is in wei, so `gwei = wei / 1,000,000,000`.

| Chain | RPC endpoint | Gas price (wei) | Gas price (gwei) | 200,000 gas execution estimate | 1,000,000 gas execution estimate |
| --- | --- | ---: | ---: | ---: | ---: |
| Ethereum mainnet | `https://ethereum-rpc.publicnode.com` | 59,106,245 | 0.059106245 | $0.029877 | $0.149383 |
| Base | `https://mainnet.base.org` | 6,000,000 | 0.006000000 | $0.003033 | $0.015164 |
| Arbitrum One | `https://arb1.arbitrum.io/rpc` | 20,026,000 | 0.020026000 | $0.010123 | $0.050613 |
| Optimism | `https://mainnet.optimism.io` | 1,001,284 | 0.001001284 | $0.000506 | $0.002531 |

I used:

```
cost_usd = gas_used × gas_price_gwei × 10^-9 × 2,527.36
```

For example, a 1,000,000-gas Base deployment at 0.006 gwei is:

```
1,000,000 × 0.006 × 10^-9 × 2,527.36 = $0.015164
```

The 1,000,000-gas figure is an illustrative medium-sized deployment, not an
estimate for a particular unprovided contract. Estimate the compiled bytecode
and constructor with the production deployer before funding the deployment.

## Why Base over the alternatives

At this measurement, Base execution gas is about **9.9× cheaper** than
mainnet for the same gas use ($0.00303 versus $0.02988 for 200,000 gas). That
matters more when a social product accumulates many small writes. Base also
keeps the development model and assets within the Ethereum ecosystem, without
requiring the product to ask every agent to operate directly on L1.

Optimism's sampled *execution* price is lower, so this is not a claim that
Base always has the lowest headline gas price. Both Base and Optimism are
OP-stack L2s, where total transaction cost also includes an Ethereum data fee.
That fee depends on the submitted calldata and changes over time; it is not
included in the table. Before launch, send representative `create post`,
`react`, and `follow` transactions to Base testnet/mainnet and compare the
receipt's `gasUsed × effectiveGasPrice` with `l1Fee`. That will give the real
all-in fee for this protocol's data shape.

In short: choose Base for the high-frequency feed, batch or minimize on-chain
data, and reserve Ethereum L1 for infrequent, high-value trust anchors.

# Recommendation: deploy the escrow contracts on Ethereum mainnet

For a service that locks $2,000–$50,000 per job, Ethereum mainnet is the
best default.  This is a low-frequency, high-value workflow: normally there
is one funding transaction and one release transaction, with a dispute path
only occasionally.  At the fees measured below, mainnet costs are pennies,
so saving the small additional amount on an L2 is not a good reason to give
up mainnet's deepest stablecoin liquidity, broadest wallet/support tooling,
and strongest economic security for funds held in escrow.

Use a well-audited stablecoin (for example, USDC) so that the dollar value of
the escrow itself is not exposed to ETH price movement.  The network gas fee
is paid separately in ETH.

## Live fee snapshot and assumptions

Read on 2026-08-27:

| Item | Ethereum mainnet | Base (comparison) |
|---|---:|---:|
| `eth_gasPrice` | 63,215,225 wei = 0.063215225 gwei | 6,000,000 wei = 0.006 gwei |
| ETH/USD spot | $2,512.895 | $2,512.895 |
| L1 data fee for a 200-byte Base payload | n/a | 618,973,724 wei = $0.00000156 |

Mainnet values came from `https://ethereum-rpc.publicnode.com`; Base values
and its OP Stack `GasPriceOracle.getL1Fee` result came from
`https://mainnet.base.org`.  ETH/USD came from Coinbase's spot-price endpoint.
These are a point-in-time quote, not a promise of future fees.

There is no deployed escrow contract yet, so the following are conservative
planning assumptions rather than a fabricated gas estimate: 120,000 gas for
funding or releasing a job, 180,000 gas for a dispute-resolution transaction,
and 1,500,000 gas to deploy the contract.  Before launch, estimate the actual
ABI calls and rerun these calculations with the fee immediately before
submission.

Formula used:

```
cost in USD = gas used × gas price in gwei × 1e-9 × ETH/USD
```

## What that costs

| Action | Mainnet gas assumption | Mainnet cost now | Base cost now (execution + measured L1 data fee) |
|---|---:|---:|---:|
| Fund escrow | 120,000 | $0.01906 | about $0.00181 + $0.00000156 |
| Release escrow | 120,000 | $0.01906 | about $0.00181 + $0.00000156 |
| Resolve dispute | 180,000 | $0.02859 | about $0.00271 + $0.00000156 |
| Deploy once | 1,500,000 | $0.23828 | not material to the per-job decision |

Thus a normal mainnet job lifecycle (fund + release) is about **$0.03812**.
Even including one 180,000-gas dispute action, it is about **$0.06672**.
That is approximately:

| Escrow amount | Normal lifecycle | Lifecycle including dispute |
|---|---:|---:|
| $2,000 | 0.00191% | 0.00334% |
| $50,000 | 0.000076% | 0.000133% |

Base is roughly an order of magnitude cheaper in this snapshot, but the
absolute saving is only about 3.5 cents per ordinary job.  That saving is not
meaningful against a $2,000–$50,000 payment, while mainnet reduces the
operational and liquidity fragmentation of asking parties to bridge to a
separate network.

## Operational guardrail

Do not hard-code the quoted fee.  At transaction time, derive EIP-1559 fee
fields from current mainnet conditions and set a user-visible maximum fee.
If your product evolves into many small payments, needs sub-dollar predictable
fees during mainnet congestion, or is already Base-native, deploy the same
audited design on Base as a second venue.  For the stated escrow size and
low transaction count, start on Ethereum mainnet.

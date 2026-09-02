# Recommendation: deploy the application contracts on Base

An AI-agent social feed is a high-frequency, low-value workload: agents may
publish, react, follow, and attest often.  Put the user-facing contracts on
**Base (chain ID 8453)**.  It preserves EVM compatibility while making those
writes substantially cheaper than Ethereum mainnet.  Use Ethereum mainnet
(chain ID 1) only for a treasury, governance, or other infrequent
high-value settlement if the project needs mainnet's liquidity/security.

## Numbers checked on 2026-08-27

I queried the live public RPCs immediately before making the estimate and
queried the ETH spot price from Coinbase:

| input | Ethereum mainnet | Base |
|---|---:|---:|
| `baseFeePerGas` | 70,042,276 wei = 0.070042276 gwei | 5,000,000 wei = 0.005 gwei |
| `eth_gasPrice` | 44,721,044 wei = 0.044721044 gwei | 6,000,000 wei = 0.006 gwei |
| ETH/USD spot | $2,513.165 | $2,513.165 |

The base-fee values are the conservative lower-bound inputs below; a real
EIP-1559 transaction also needs a priority fee and therefore costs a little
more.  The `eth_gasPrice` RPC quote is shown for reproducibility, but it was
slightly below the next mainnet block's base fee when read, so it is not a
valid fee cap for that block.

## Cost model

For a deliberately small on-chain post, assume **65,000 gas**: one new
storage write plus contract logic and an event containing a content hash/CID.
For an initial modest Solidity deployment, assume **1,000,000 gas**.  These
are planning assumptions, not a replacement for `forge test --gas-report` on
the actual contract.

`USD cost = gas used × gas price (gwei) × 10^-9 × ETH/USD`

| operation (assumption) | Ethereum, base-fee floor | Base execution, base-fee floor |
|---|---:|---:|
| publish post (65,000 gas) | 0.00000455275 ETH = **$0.01144** | 0.000000325 ETH = **$0.000817** |
| deploy (1,000,000 gas) | 0.000070042276 ETH = **$0.17603** | 0.000005 ETH = **$0.01257** |

That is about **14x lower execution cost on Base** at the measured base fees.
For scale, 1 million such post writes would have a base-fee-floor execution
cost of about **$11,442 on mainnet** versus **$817 on Base**, before priority
fees.

Base also charges an L1 data fee, so it should not be omitted.  I inspected a
recent normal Base transaction receipt: it used 56,340 gas, had an L1 fee of
385,344,679 wei (0.000000000385 ETH, about **$0.00000097** at the same ETH
price), and an effective execution gas price of 0.12 gwei chosen by that
sender.  Its total fee therefore is not a universal quote: the L1 component
varies with calldata/blob conditions, and the execution component varies with
the submitted fee cap.  Measure `gasUsed * effectiveGasPrice + l1Fee` from
your own receipts before setting production budgets.

## Design implication

Do not put post bodies, embeddings, or feed ranking state on-chain.  Store
that mutable/large data in a database or content-addressed store, and publish
only the signed post identifier/content hash and essential events on Base.
Index those events into the feed.  This makes the chain provide identity,
provenance, payments, and composability without turning every agent message
into permanent, costly blockspace.

In short: Base is the right default for the interactive social layer; reserve
mainnet for the small set of actions where its settlement properties are worth
the extra cost.  Re-check both fees right before deployment or changing fee
parameters, since they are live market values.

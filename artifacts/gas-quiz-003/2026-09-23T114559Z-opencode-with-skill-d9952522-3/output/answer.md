# Recommendation: Deploy on Base (an OP-stack Ethereum L2)

A social feed for AI agents is a high-frequency, low-value, latency-sensitive
workload — agents posting, replying, and reacting many times per day. That
profile belongs on an L2, and the live measurements below confirm the cost gap
is large today, not just in memory.

## Measured inputs (queried 2026-09-23)

| Input | Value | Source |
|---|---|---|
| Mainnet gas price | 0.2968 gwei (296,778,401 wei) | `cast gas-price --rpc-url https://ethereum-rpc.publicnode.com` |
| Base gas price | 0.006 gwei (6,000,000 wei) | `cast gas-price --rpc-url https://mainnet.base.org` |
| Base L1 data fee, 356-byte post tx | 3,075,430,846 wei (~3.1e-9 ETH) | `GasPriceOracle.getL1Fee` at `0x4200...000F` with `post(string)` calldata for a 280-char text |
| ETH/USD | $2,720.61 | Coinbase spot API |

## Workload assumption

A "post" transaction: `post(string)` with a ~280-character text (356 bytes of
calldata), as either an event-only design (~30k gas) or a storage-writing
design (~50k gas). Both bounds are shown so the conclusion doesn't hinge on
one estimate.

## Cost math

```text
mainnet: cost = gas_used × 0.2968 gwei × 1e-9 × $2720.61
base:    cost = (gas_used × 0.006 gwei × 1e-9 + 3.08e-9 ETH) × $2720.61
```

| Gas used | Mainnet | Base (exec + L1 data fee) | Ratio |
|---|---|---|---|
| 30,000 (event-only post) | $0.0242 | $0.000490 + $0.000008 = $0.000498 | ~49x |
| 50,000 (storage post) | $0.0404 | $0.000816 + $0.000008 = $0.000825 | ~49x |

Notes on the components:

- The Base L1 data fee was measured directly from the oracle, not estimated;
  at ~$0.000008 per post it is negligible, so the execution fee dominates on
  Base. Any fee optimization effort should target L2 execution gas, not
  calldata.
- Mainnet at ~0.3 gwei is cheap by historical standards, but even so a single
  post costs 2–4 cents. For agents posting hundreds of times a day that is
  real money; on Base the same activity costs well under a cent per day.

## Why not mainnet

- ~49x higher cost per post at current prices, and mainnet fees are the ones
  that spike under congestion — exactly when a social app wants reliability.
- 12-second slots vs ~2-second blocks on Base: worse latency for a feed.
- Mainnet's value is security for high-value, low-frequency settlement. A
  social post is neither.

## Why Base specifically

- Measured cheap: sub-tenth-of-a-cent posts including the L1 data fee.
- OP-stack, Ethereum-secured, within the committed ecosystem, with mature
  tooling and a large existing user/agent-adjacent community.
- Other major L2s (Arbitrum, OP Mainnet) are in the same cost ballpark; the
  recommendation is "an Ethereum L2," with Base as the measured default.
  Re-measure on your shortlist before deploying — fee conditions change.

## Practical guidance

- Set EIP-1559 fee fields from Base's current `base-fee`/`gas-price` at
  submission time; do not port a mainnet priority-fee constant.
- Prefer an event-based post design (logs are cheap and indexable) or keep
  on-chain storage minimal; execution gas is the dominant cost on Base.
- Keep mainnet in the architecture only for high-value actions (e.g.,
  identity/ownership anchors, payouts), where its per-tx cost is justified.

# Which chain for an AI-agent social feed?

**Recommendation: deploy the feed on Base (OP Stack L2), and anchor agent identity on Ethereum mainnet.**

This is the one workload class where an L2 is clearly correct rather than a reflex: consumer-shaped, extremely high transaction frequency, near-zero value per action, and latency-sensitive. Agents post far more often than humans do, so per-action cost and block time dominate everything else.

---

## Live numbers used (measured 2026-09-23, not from memory)

| Input | Value | Source |
|---|---|---|
| L1 base fee | **0.3334 gwei** | `cast base-fee` via publicnode / drpc / 1rpc (three agreed) |
| L1 gas price (base + tip) | 0.3291 gwei | `cast gas-price` |
| L1 gas limit / used | 60,000,000 / 26.9M (~45% full) | `cast block latest` (post-Fusaka) |
| Base L2 base fee | **0.006 gwei** | `cast gas-price` on mainnet.base.org |
| OP Mainnet gas price | 0.00100 gwei | `cast gas-price` on mainnet.optimism.io |
| Arbitrum One gas price | 0.0200 gwei | `cast gas-price` on arb1.arbitrum.io |
| ETH/USD | **$2,734.80** | Coinbase spot API |

Anyone quoting 10–30 gwei for mainnet is working from 2021–2023 data. Base fee has been under 1 gwei since EIP-4844 → Pectra → Fusaka (PeerDAS + 30M→60M gas limit).

### L2 data-availability cost, computed rather than guessed

Base's `GasPriceOracle` (`0x420…000F`) live values: `l1BaseFee = 287,985,778`, `blobBaseFee = 15,351,118`, `baseFeeScalar = 2269`, `blobBaseFeeScalar = 1,055,762`.

```
wei/compressed byte = (baseFeeScalar·16·l1BaseFee + blobBaseFeeScalar·blobBaseFee) / 16e6
                    = (2269·16·287,985,778 + 1,055,762·15,351,118) / 16e6
                    = 1,666,385 wei/byte
```

A ~150-byte compressed post transaction therefore costs **$0.00000068** in L1 blob DA. Post-Fusaka, blob DA is effectively free — **L2 cost is now almost entirely L2 execution gas**, which is the opposite of the 2023 mental model where DA was 90% of the bill.

---

## Per-action cost

Gas assumptions for a feed contract (events for content, storage only for graph state):

| Action | Gas | Mainnet L1 | Base | OP Mainnet | Arbitrum One |
|---|---|---|---|---|---|
| Register agent identity | 90,000 | $0.0845 | $0.0015 | $0.0003 | $0.0049 |
| Post (event only) | 50,000 | $0.0470 | $0.0008 | $0.0001 | $0.0027 |
| Post + onchain content hash | 70,000 | $0.0657 | $0.0012 | $0.0002 | $0.0038 |
| Follow | 46,000 | $0.0432 | $0.0008 | $0.0001 | $0.0025 |
| Like / reaction | 30,000 | $0.0282 | $0.0005 | $0.0001 | $0.0016 |
| Deploy feed contract | 1,500,000 | $1.41 | $0.0246 | $0.0041 | $0.0821 |

## At agent scale (monthly)

Blended mix per 1,000 actions: 600 posts, 250 likes, 100 follows, 50 posts-with-hash → **45,600 gas/action average**.

| Volume | Mainnet | Base | OP Mainnet | Arbitrum |
|---|---|---|---|---|
| 200k actions/day (10k agents × 20/day) | $256,950 | **$4,490** | $750 | $14,970 |
| 1.44M actions/day (1k agents posting 1/min) | $1,850,060 | **$32,350** | $5,420 | $107,810 |
| 2M actions/day (100k agents × 20/day) | $2,569,520 | **$44,940** | $7,530 | $149,730 |

That first row is the decision. $257k/month vs $4.5k/month is a 57x gap, and it is the difference between a business model and no business model. Agents don't have wallets with human-scale gas budgets, and if you're sponsoring gas via a paymaster (you will be), this line item is your burn.

---

## Why Base specifically

1. **Cost is a non-issue there.** Sub-tenth-of-a-cent per post, so you can put the whole social graph onchain instead of inventing an off-chain compromise.
2. **Latency.** Base runs 2s blocks with ~200ms preconfirmations; mainnet is 12s. Agents in a conversational loop need a feed that settles faster than they think.
3. **Distribution.** Base has the deepest consumer/social ecosystem on Ethereum today — Farcaster clients, the Base App, wallet and paymaster tooling (Coinbase Paymaster, ERC-4337 infra, Smart Wallet) that let you sponsor agent transactions without each agent holding ETH. For a social product, distribution beats a marginal fee difference.
4. **Ethereum-aligned.** OP Stack, Ethereum for settlement and DA, same EVM and tooling, bridges to mainnet. This keeps your ecosystem commitment intact.

**The honest caveat on OP Mainnet:** it's ~6x cheaper than Base right now ($750 vs $4,490/month at 200k/day), because its L2 fee market is currently near-idle. That's a snapshot, not a structural moat — both are OP Stack, so the code is portable and you can move or add a chain later. I'd pay the ~$3.7k/month premium for Base's social distribution and paymaster ecosystem. If your feed is Farcaster-native, note Farcaster's own registry contracts live on OP Mainnet, which would flip the answer.

**Why not Arbitrum:** 3.3x Base's cost and no social/consumer advantage for this use case. It's the right chain for perps and DeFi, not for an agent feed.

**Why not mainnet:** mainnet is genuinely cheap now — a contract deploy is $1.41, an identity registration is 8 cents — and the default advice "don't reach for an L2 without a concrete reason" is sound. But high-frequency social *is* the concrete reason. 12s blocks and $0.047/post don't survive contact with agents that post every minute.

---

## The architecture that follows from these numbers

- **Mainnet:** the agent identity registry and any staking/reputation bonds. At $0.0845 per registration, 100,000 agents cost $8,450 one-time to register on Ethereum L1 — worth it for a canonical, L2-independent identity root that every future chain you deploy on can read from.
- **Base:** posts, follows, likes, replies — everything high-frequency. Content bodies go to IPFS/blobs with the hash onchain (the $0.0012 "post + hash" row); don't store post text in contract storage at any volume.
- **Gas sponsorship:** an ERC-4337 paymaster on Base, budgeted from the tables above. Rate-limit per agent — sponsored gas plus autonomous agents is a spam surface.
- **Don't** put every like onchain if your volume goes past a few million/day; batch reactions into periodic aggregate commitments. The economics above hold to ~2M actions/day without that complexity, so build it when you need it, not before.

## Verify before you commit

These are a single snapshot. Re-check with:

```bash
cast base-fee --rpc-url https://ethereum-rpc.publicnode.com
cast gas-price --rpc-url https://mainnet.base.org
cast call 0x420000000000000000000000000000000000000F "l1BaseFee()(uint256)" --rpc-url https://mainnet.base.org
```

Base's L2 base fee is the number to watch — it rises under L2 congestion, and it's now the dominant term in your cost, not blob DA.

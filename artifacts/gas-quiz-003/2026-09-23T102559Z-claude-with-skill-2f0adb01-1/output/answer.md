# Which chain for an AI-agent social feed?

**Recommendation: Base (an Ethereum L2), with identity/value anchored on mainnet.**

The deciding factor is not "L2s are cheaper" — mainnet is genuinely cheap now. It's that an
agent social feed is a *high-frequency write* workload, and at agent-scale write volume the
mainnet bill and the mainnet blockspace footprint both stop being reasonable.

---

## 1. Live numbers used (measured 2026-09-23)

| Input | Value | Source |
|---|---|---|
| ETH price | **$2,726.69** | CoinGecko |
| Mainnet base fee | **0.4437 gwei** | `cast base-fee` via publicnode + flashbots (443,679,069 wei, agreed) |
| Mainnet gas price (base + tip) | **0.4586 gwei** | `cast gas-price` |
| Mainnet blob base fee | **0.0256 gwei** | `eth_blobBaseFee` (0x1886cec) |
| Mainnet gas limit / used | **60M / 28.5M** (~48% full) | block 26,039,574 |
| Mainnet block time | **12s** | measured over 100 blocks |
| Base gas price | **0.006 gwei** | `cast gas-price` |
| Base block time | **2.00s** | measured over 500 blocks |
| Arbitrum gas price | **0.0203 gwei** | `cast gas-price` |
| Optimism gas price | **0.0010 gwei** | `cast gas-price` |
| Scroll gas price | **0.00012 gwei** | `cast gas-price` |

Note: mainnet gas is ~0.44 gwei, not the 20–50 gwei figure that's still the common assumption.
Post-Dencun/Pectra/Fusaka, blobs are nearly free (0.026 gwei), which means an L2's L1
data-availability cost is now *negligible* — L2 cost is dominated by L2 execution gas.

## 2. Gas assumptions for the app's operations

Reasonable estimates for a feed contract that emits content as events and keeps only graph
state in storage:

| Operation | Gas | Why |
|---|---|---|
| `post()` — emit ~200-byte event | ~35,000 | 21k base + ~3.2k calldata + LOG topics/data |
| `like()` / react | ~30,000 | event + small storage touch |
| `follow()` — new storage slot | ~48,000 | 21k + 20k cold SSTORE + overhead |
| `registerAgent()` — 2 slots | ~70,000 | 21k + 2× cold SSTORE |
| Deploy feed contract | ~1,500,000 | mid-size contract |

## 3. Per-action cost

`cost = gas × gasPrice × ETH_price`

| Operation | Mainnet (0.4586 gwei) | Base (0.006 gwei) | Arbitrum (0.0203 gwei) | Optimism (0.001 gwei) |
|---|---|---|---|---|
| post (35k) | **$0.0438** | **$0.00057** | $0.00194 | $0.000095 |
| like (30k) | $0.0375 | $0.00049 | $0.00166 | $0.000082 |
| follow (48k) | $0.0600 | $0.00079 | $0.00266 | $0.000131 |
| register (70k) | $0.0875 | $0.00115 | $0.00388 | $0.000191 |
| deploy (1.5M) | $1.88 | $0.025 | $0.083 | $0.0041 |

Worked example (mainnet post): `35,000 × 0.4586e-9 ETH = 1.605e-5 ETH × $2,726.69 = $0.0438`
Worked example (Base post): `35,000 × 0.006e-9 ETH = 2.10e-7 ETH × $2,726.69 = $0.00057`

Base is **~76x cheaper per action** than mainnet at current prices.

## 4. Cost at volume — this is where the decision is made

Assume avg 35,000 gas/action.

| Scenario | Actions/day | Mainnet /month | Base /month |
|---|---|---|---|
| Pilot: 100 agents × 10 actions | 1,000 | **$1,313** | **$17** |
| Early: 1,000 agents × 20 actions | 20,000 | **$26,270** | **$344** |
| Scale: 10,000 agents × 50 actions | 500,000 | **$656,550** | **$8,590** |

Agents are not humans. A human posts a handful of times a day; an agent loop can post,
react and follow on a timer. The 50 actions/agent/day column is the realistic planning case,
and $657k/month of gas is not a business.

## 5. The blockspace argument (the one that actually kills mainnet)

At 500,000 actions/day × 35,000 gas = **17.5B gas/day**.

Mainnet total capacity = 60M gas × 7,200 blocks/day = **432B gas/day**, currently ~48% used,
so ~225B gas/day is spare.

Your app alone would be **4.1% of all Ethereum blockspace** and ~7.8% of the unused headroom.
That's enough to move the base fee against yourself — the $657k/month figure is a floor, not a
ceiling, because your own demand raises the price you pay. On Base (35.6M gas in a 2s block,
~1.5T gas/day of capacity) the same load is ~1.2% and the fee market doesn't notice.

## 6. Why Base specifically, over the cheaper L2s

Optimism (0.001 gwei) and Scroll (0.00012 gwei) quote lower gas prices right now, and on a
pure cost basis they win. I'm still recommending Base because at these magnitudes the
difference is $8,590/month vs ~$1,400/month at the scale tier — real, but not decision-driving
against distribution:

- **Agent/social distribution already lives there.** Farcaster and the consumer-social + agent
  crowd are concentrated on Base; a social feed is a network-effects product, and being where
  the accounts, clients and wallets already are is worth more than a 6x gas delta.
- **2s blocks.** A feed needs writes to feel instant. 2s vs mainnet's 12s is the difference
  between "posted" and "pending".
- **Same OP Stack, same EVM.** Nothing to rewrite if you later move or add a chain.
- **Still Ethereum.** Base settles to mainnet; you keep the ecosystem commitment you asked
  about. Choosing an L2 is not leaving Ethereum.

Arbitrum is a defensible second choice on ecosystem-size grounds (~3.4x Base's gas cost here,
still trivial). Optimism is the choice if you weight raw cost hardest and are comfortable with
thinner consumer-social distribution.

## 7. Recommended hybrid split

| On mainnet (rare, high-value) | On Base (frequent, cheap) |
|---|---|
| Agent identity registry / ENS names | posts, likes, replies, follows |
| Token or treasury contracts | feed indexing state |
| Governance | reputation counters |
| Cross-chain settlement | ephemeral/agent-loop writes |

Mainnet registration at $0.0875 per agent is affordable even for 100,000 agents (~$8,750
one-time) and gives you credibly-neutral identity; the firehose stays on L2.

## 8. Caveats

- Gas prices are live values and move. Re-check before you budget:
  `cast base-fee --rpc-url https://ethereum-rpc.publicnode.com` and
  `cast gas-price --rpc-url https://mainnet.base.org`.
- L2 gas prices in particular are volatile at these tiny magnitudes — Base at 0.006 gwei can
  be several times higher during a busy hour. Budget with 5–10x headroom; it's still cheap.
- Arbitrum's gas accounting folds L1 data cost into its L2 gas differently from OP Stack
  chains, so its per-op number above is approximate rather than directly comparable.
- Gas-per-operation figures are engineering estimates, not measured from a deployed contract.
  Benchmark your real contract before committing to the volume projections.

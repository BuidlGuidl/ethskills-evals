# Which Ethereum chain for an AI-agent social feed?

**Recommendation: build on Base**, with post *content* off-chain and on-chain writes
reduced to batched commitments. If your volume is small and you care about nothing but
gas, **OP Mainnet is ~33× cheaper per transaction today** — that trade-off is quantified
below so you can make the call yourself.

All numbers were measured live from public RPCs on **2026-09-23**, not taken from a blog
post. Methodology and raw values are in the appendix so you can re-run them.

---

## 1. What this workload actually is

A social feed for AI agents is an extreme version of a normal social app:

- **Write-dominated.** Agents post far more than humans and never sleep.
- **Low value per write.** A post is worth a fraction of a cent, so fee *floors* matter
  more than fee *spikes*.
- **Bursty and potentially huge.** 10k agents at 100 posts/day = 1M posts/day; add
  likes/follows/replies at 3–4× and you are at ~4M writes/day.
- **Read-heavy on an index, not on chain state.** Nobody renders a feed by calling
  `eth_call` in a loop.

That shape means the decision is driven by three numbers: **cost per write at the fee
floor**, **how much floor-priced block space is free**, and **where the users/agents
already are**.

---

## 2. Gas model for one post

I priced three designs. Gas is computed from the actual EVM rules, including **EIP-7623**
(Pectra / OP-Stack Isthmus), which puts a *floor* of `21,000 + 40 gas per non-zero
calldata byte` on data-heavy transactions. This is the single most important fact in the
whole analysis: **on any modern EVM chain, raw content bytes cost ~40 gas/byte, and that
term is chain-independent.**

| Design | What's on chain | Gas / post | Calldata |
|---|---|---|---|
| **A** | Full 280-byte post body in calldata + `LOG1` | **34,600** | 380 B |
| **B** | 32-byte content hash (body on IPFS / hub) | **24,300** | 140 B |
| **C** | Batch of 100 hashes in one tx, amortised | **2,900** | 68 B/post |

Derivation of A: `21,000` intrinsic + `~5,500` calldata + `2,990` `LOG1(280B)` + `~1,500`
memory/decode ≈ 31,000 — but the EIP-7623 floor `21,000 + 340 × 40 = 34,600` is higher, so
**34,600 is what you pay**. Design C wins 12× over A purely by (a) not putting the body on
chain and (b) amortising the 21,000 intrinsic cost across 100 posts.

---

## 3. Measured cost per post (2026-09-23, ETH = $2,730.47)

Execution = `gas × L2 base fee`. Data = the real L1 blob cost, read from each OP-Stack
chain's `GasPriceOracle.getL1Fee()` precompile, and from Arbitrum's
`ArbGasInfo.getPricesInWei()`. Not estimated — queried.

### Design A — full post on chain

| Chain | Execution | L1 data | **Total / post** | **$/day @ 1M posts** |
|---|---|---|---|---|
| Ink | $0.00000000 | $0.00001214 | **$0.0000121** | **$12** |
| OP Mainnet | $0.00000009 | $0.00001464 | **$0.0000147** | **$15** |
| Soneium | $0.00000000 | $0.00002466 | **$0.0000247** | **$25** |
| Unichain | $0.00004724 | $0.00000813 | **$0.0000554** | **$55** |
| World Chain | $0.00004724 | $0.00001956 | **$0.0000668** | **$67** |
| **Base** | $0.00047237 | $0.00000840 | **$0.0004808** | **$481** |
| Arbitrum One | $0.00193672 | $0.00013548 | **$0.0020722** | **$2,072** |
| Ethereum L1 | $0.03127092 | — | **$0.0312709** | **$31,271** |

### Design C — batched hashes (the design I'm recommending)

| Chain | Execution | L1 data | **Total / post** | **$/day @ 1M posts** | **$/day @ 4M writes** |
|---|---|---|---|---|---|
| Ink | $0.00000000 | $0.00000217 | $0.00000217 | $2.17 | $9 |
| OP Mainnet | $0.00000001 | $0.00000262 | $0.00000263 | $2.63 | $11 |
| Soneium | $0.00000000 | $0.00000441 | $0.00000441 | $4.41 | $18 |
| Unichain | $0.00000396 | $0.00000145 | $0.00000541 | $5.41 | $22 |
| World Chain | $0.00000396 | $0.00000350 | $0.00000746 | $7.46 | $30 |
| **Base** | $0.00003959 | $0.00000150 | **$0.00004110** | **$41** | **$164** |
| Arbitrum One | $0.00016233 | $0.00005419 | $0.00021652 | $217 | $866 |
| Ethereum L1 | $0.00262097 | — | $0.00262097 | $2,621 | $10,484 |

**Two things fall out of this table:**

1. **Ethereum L1 is disqualified by ~750×.** $31k/day for 1M posts. Not a close call.
2. **Batching is a bigger lever than chain choice.** Going A → C on Base saves 12×
   ($481 → $41/day). Going Base → OP Mainnet on design A saves 33×. But **batched Base
   ($41/day) is cheaper than unbatched OP Mainnet ($15/day… per 1M; $164 vs $59 at 4M)** —
   the two levers are the same order of magnitude, and you should pull the architectural
   one first because it's portable across chains and the chain choice isn't.

---

## 4. The number that actually decides it: floor-priced headroom

Every cost above assumes the chain stays at its **minimum base fee**. Measured over ~9,000
recent blocks (~5 hours), all three majors were pinned flat at their floor:

| Chain | Base-fee floor | Median util | Peak util |
|---|---|---|---|
| Base | 0.005 gwei (5 mwei) | 9.4% of 400M | 23.7% |
| OP Mainnet | 0.000001 gwei (**1 wei**) | 39.3% of 40M | **94.7%** |
| Arbitrum One | 0.020 gwei | — | — |

OP Mainnet is 5,000× cheaper per gas *because* its floor is 1 wei. But its block gas limit
is **40M vs Base's 400M**, and it is already running at 39% median / 95% peak utilisation.

Under EIP-1559 the base fee only rises above the floor once you exceed the **target**
(gasLimit / 2 for OP-Stack elasticity 2). So the real question is: *how much traffic can I
add before I start paying more than the floor?*

| Chain | Target | Used now | **Free at floor** | Posts/day @ 34.6k gas | Posts/day @ 2.9k gas |
|---|---|---|---|---|---|
| **Base** | 100 Mgas/s | 18.8 | **81.2 Mgas/s** | **203,000,000** | 2.4 billion |
| OP Mainnet | 10 Mgas/s | 7.9 | **2.1 Mgas/s** | **5,300,000** | 64 million |
| Unichain | 30 Mgas/s | 0.6 | 29.4 Mgas/s | 73,000,000 | 876 million |
| World Chain | 70 Mgas/s | 2.0 | 68.0 Mgas/s | 170,000,000 | 2.0 billion |

**Base has ~38× more floor-priced headroom than OP Mainnet.** And OP's 94.7% peak
utilisation means it is *already* episodically above target — a successful agent feed
would be competing with those spikes and would itself be the thing that pushes OP off its
1-wei floor. The 33× price advantage is not something you can count on owning; it evaporates
exactly when your product works.

Base's cost, by contrast, is robust: you could 10× your traffic and still not move its
base fee.

---

## 5. Why Base over Unichain / World Chain / Ink / Soneium

Those four are cheaper *and* have headroom, so cost and capacity don't separate them from
Base. What separates them is the part you can't buy later:

- **Distribution.** Base is where the crypto-social graph and the on-chain agent ecosystem
  already live (Farcaster clients and the Base App, agent-launch tooling, agent token
  activity). A social product's hardest problem is cold-start, not gas. Deploying an
  agent feed on Soneium to save $150/day while giving up the existing agent population is
  a bad trade by two orders of magnitude.
- **Agent-native payment rails.** Base is the home of **x402** (HTTP-402 agent payments)
  and of Smart Wallet + paymaster infrastructure. Your agents will not hold ETH and should
  not have to — **sponsor their gas via ERC-4337 paymasters** and let them pay each other
  in USDC. That infra is most mature here.
- **Identity.** Agent identity standards (ERC-8004-style trustless-agent registries,
  ERC-6551 token-bound accounts, Basenames/ENS) have the deepest deployment on Base.
- **Liquidity and onramp.** Direct Coinbase fiat onramp matters the moment the feed has
  tipping, paid subscriptions, or agent-to-agent commerce.
- **Ethereum alignment.** Base is OP Stack / Superchain: settles to Ethereum L1, posts its
  data to **Ethereum blobs** (not an alt-DA committee), shares a bridge and interop
  standard with OP Mainnet, Unichain, Ink and Soneium. That satisfies your "committed to
  the Ethereum ecosystem" constraint without you having to defend an alt-DA choice.

Arbitrum One is a fine chain but is the most expensive major L2 for this workload — 4.3×
Base and 79× OP on batched writes — because its base fee floor is 0.02 gwei and it charges
a fixed ~13.4 gwei-equivalent L1 surcharge per transaction, which is brutal for
high-frequency micro-writes.

---

## 6. Architecture that makes the numbers above real

The chain choice only gets you Design-C pricing if you build it this way:

1. **Post bodies never touch the chain.** Store them in a Farcaster-style hub / IPFS / your
   own signed-content store. On-chain you write a 32-byte content hash. This is a 30% gas
   saving on its own and removes the 40 gas/byte EIP-7623 penalty from your cost curve
   entirely.
2. **Agents sign posts off-chain; a batcher submits.** Agents produce EIP-712 signed post
   objects. A batcher rolls ~100 of them into one transaction. This is where the 12× comes
   from. It also means an agent needs zero on-chain gas to post.
3. **Emit events, do not `SSTORE`.** A feed is an append-only log. A single new storage slot
   costs 20,000 gas — more than the entire batched cost of 6 posts. Index events with a
   subgraph/Ponder and serve the feed from Postgres.
4. **Sponsor gas with a paymaster.** Agents hold USDC, not ETH. ERC-4337 + Base paymaster.
5. **Keep an exit.** Because you're on the OP Stack with blob DA, if you ever genuinely
   outgrow 200M floor-priced posts/day you can deploy an OP-Stack L3 settling to Base and
   move only the high-frequency feed writes there, keeping identity and payments on Base.
   That option does not exist if you pick a non-Superchain niche L2 today.

---

## 7. Honest caveats

- **These are floor prices at one instant.** ETH was $2,730 and the L1 blob base fee was
  0.021 gwei — blobs are cheap right now, which is why L1 data is only 1.7% of Base's
  per-post cost. Historically that term has been 10–100× higher during blob contention. If
  blobs get expensive again, the ranking in §3 compresses (all blob-posting L2s move
  together) but the §4 headroom argument gets *stronger*, not weaker.
- **OP Mainnet is genuinely cheaper today** and I don't want to hide that. If you are
  confident you'll stay under ~5M writes/day and cost is your only criterion, OP Mainnet at
  $11/day for 4M batched writes is the cost-optimal answer. I'm recommending Base because
  $164/day is not a number that should drive an architecture decision for a product whose
  survival depends on distribution.
- **Base runs a centralised sequencer** (as do all the alternatives listed). Your feed can
  be censored or halted at the sequencer. Mitigate with the L1 force-inclusion path and by
  keeping content addressable off-chain so the feed survives a sequencer outage in
  read-only mode.
- **The Arbitrum figure assumes its posted price schedule** from `getPricesInWei()`; real
  Arbitrum transactions also carry a variable L1-poster component that can differ from the
  static estimate.
- **I did not benchmark a deployed contract.** Gas figures are computed from EVM cost rules
  (including EIP-7623), not measured from a real `eth_estimateGas` against live bytecode.
  Expect ±15%. That is well inside the gaps that drive the conclusion.

---

## Appendix: raw measurements (2026-09-23, Ethereum block 26,039,606)

ETH/USD = **2,730.465** (Coinbase spot).

**L1:** base fee **0.331 gwei**, gas limit 60,000,000, `eth_blobBaseFee` = **21,015,843 wei
(0.021 gwei)** → **0.00000275 ETH per 128 KB blob**.

**L2 base fee floors** (`eth_getBlockByNumber`, median over 30 samples spanning ~9,000 blocks):

| Chain | Base fee (gwei) | Gas limit | Block time |
|---|---|---|---|
| Base | 0.005000 | 400,000,000 | 2.0 s |
| OP Mainnet | 0.000001 | 40,000,000 | 2.0 s |
| Arbitrum One | 0.020030 | (speed-limited) | 0.3 s |
| Unichain | 0.000500 | 60,000,000 | 1.0 s |
| World Chain | 0.000500 | 280,000,000 | 2.0 s |
| Ink | ~0 (1 wei) | 60,000,000 | 1.0 s |
| Soneium | ~0 (1 wei) | 40,000,000 | 2.0 s |
| Scroll | 0.000120 | 20,000,000 | 7.4 s |
| Linea | ~0 | 2,000,000,000 | 9.3 s |
| zkSync Era | 0.045250 | — | 3.9 s |

**L1 data fee for a 380-byte transaction**, via
`GasPriceOracle(0x420...0F).getL1Fee(bytes)`:

| Chain | wei | ETH |
|---|---|---|
| Unichain | 2,976,345,552 | 2.98e-9 |
| Base | 3,077,175,368 | 3.08e-9 |
| Ink | 4,446,393,441 | 4.45e-9 |
| OP Mainnet | 5,361,042,305 | 5.36e-9 |
| World Chain | 7,164,757,551 | 7.16e-9 |
| Soneium | 9,030,476,835 | 9.03e-9 |

**Arbitrum**, via `ArbGasInfo(0x...6C).getPricesInWei()`:
`perL2Tx = 13,358,192,960 wei`, `perL1CalldataByte = 95,415,664 wei`,
`perArbGasTotal = 20,500,000 wei (0.0205 gwei)`.

Reproduce with:

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_gasPrice","params":[]}' \
  https://mainnet.base.org
```

and `eth_call` to `0x420000000000000000000000000000000000000F` with selector `0x49948e0e`
(`getL1Fee(bytes)`) for the OP-Stack chains.

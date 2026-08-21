# USDC → WETH on Base — approach, venue choice, and pre-flight

`swap.ts` is a runnable viem script that converts USDC into WETH on Base mainnet
(chainId 8453) for a desk that trades $100k–$1M clips. It was written and
tested against live Base state around block **50,153,400** (ETH/USD ≈ $1,916).

```bash
npm install                                    # viem + tsx
ACCOUNT=0xYourDesk AMOUNT_USDC=250000 npm run swap          # dry run, no key needed
PRIVATE_KEY=0x... AMOUNT_USDC=250000 SLICES=4 BROADCAST=1 npm run swap
```

Nothing is ever broadcast without `BROADCAST=1`.

---

## 1. The venue decision

**The script does not pick a venue up front — it re-runs a small auction for
every child order and executes the winner.** For each slice it collects:

| Venue | How it is quoted | How it is executed |
| --- | --- | --- |
| Uniswap v3 | `QuoterV2.quoteExactInputSingle` on-chain, all four USDC/WETH fee tiers | `SwapRouter02.exactInputSingle`, `amountOutMinimum` set by us |
| OpenOcean | `GET open-api.openocean.finance/v4/base/swap` | its returned calldata, sent to the pinned router |
| LI.FI | `GET li.quest/v1/quote` | its returned calldata, sent to the pinned LI.FI Diamond |

The best quote *net of gas* that also clears the Chainlink sanity band is
simulated (`eth_call`) and only then sent. If that simulation reverts, the
script falls back to the next venue instead of failing the parent order.

### Why not just hardcode a pool

Measured on Base at the time of writing, quoting **250,000 USDC → WETH** through
each Uniswap v3 tier directly:

| Route | WETH out | vs Chainlink mid |
| --- | --- | --- |
| Chainlink mid (impact-free reference) | 130.489 | — |
| Uniswap v3 **0.01%** (`0xb4CB…00e5`) | 81.72 | route runs out of liquidity |
| Uniswap v3 **0.05%** (`0xd0b5…F224`) | 129.681 | −61.9 bps |
| Uniswap v3 **0.3%** (`0x6c56…1372`) | **130.113** | −28.8 bps |
| Uniswap v3 **1%** (`0x0b1C…2d69`) | 112.365 | −1,389 bps |
| Aggregated route (OpenOcean/Kyber-class split) | **130.35** | ≈ −11 bps |

Three things fall out of that table, and they are the whole design rationale:

1. **The "obvious" pool is the wrong pool.** The 0.05% tier is the canonical
   USDC/WETH pool on Base and is what most example code hardcodes, yet at this
   size the 0.3% tier fills ~33 bps better (~$840 per $250k clip). Which tier
   wins is size-dependent — at 50k USDC the 0.05% tier wins instead — so the
   script quotes all of them, every slice, rather than baking one in.
2. **Naive splitting is worse than not splitting.** Splitting 125k/125k across
   the 0.05% and 0.3% tiers returns 130.055 WETH — *worse* than sending the
   whole clip to the best single tier. Optimal split ratios are a solver
   problem; hand-rolling one loses money, so the script delegates splitting to
   aggregators that actually solve it and keeps a single-pool Uniswap route as
   the always-available fallback.
3. **Aggregation is worth roughly 18 bps at this size** (~$450 per $250k), by
   splitting across Aerodrome Slipstream, Uniswap v3/v4 and RFQ/PMM makers.
   That is why the aggregators are quoted first and Uniswap is the floor, not
   the plan.

### Venues considered and rejected (for now)

- **CoW Protocol** — live on Base (`GPv2Settlement 0x9008D19f58AAbD9eD0D60971565AA8510560ab41`,
  vault relayer `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110`, both verified
  on-chain). For a desk this is genuinely the strongest option for the largest
  clips: solver competition, surplus goes to the trader, and the order is a
  signed intent rather than a transaction, so it cannot be sandwiched. It is
  not what this script does because it is *asynchronous* — you sign an order,
  wait for a batch, and may not fill. The task asked for a swap script; if the
  desk wants passive/large execution, adding a CoW order-posting mode is the
  first thing I would build next.
- **0x Swap API / 1inch** — usually the best aggregators on Base, both now
  require an API key (1inch returned `Unauthorized` unauthenticated). Wiring one
  in is a ~20-line adapter next to `quoteOpenOcean`; add the router to
  `ALLOWED_TARGETS` after verifying it on-chain.
- **KyberSwap directly** — its `/routes` endpoint quotes fine (it is what LI.FI
  routes through here), but `POST /route/build` rejected our request body with
  `field: "wallets"`, i.e. the live API is ahead of its published schema. Rather
  than guess, Kyber is reached through LI.FI.
- **Uniswap v4 / Universal Router + Permit2** — the v4 singleton
  (`PoolManager 0x498581fF718922c3f8e6A244956aF099B2652b2b`) is where new Base
  liquidity is going, and the aggregators already route into it. Calling it
  directly means Permit2 plumbing and hook-aware quoting for no benefit over
  letting a solver find it.

---

## 2. Addresses, and how each was verified

Every address below was checked against Base mainnet by calling the contract,
not by memory. The same assertions run in `preflight()` before any funds move,
so a wrong address fails loudly instead of silently approving something.

| Contract | Address | Verification performed |
| --- | --- | --- |
| USDC (native Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `symbol() == "USDC"`, `name() == "USD Coin"`, `decimals() == 6` |
| WETH9 (OP-stack predeploy) | `0x4200000000000000000000000000000000000006` | `symbol() == "WETH"`, `decimals() == 18` |
| Uniswap v3 SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` | `factory()` → v3 factory, `WETH9()` → WETH |
| Uniswap v3 QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | `factory()` → v3 factory, `WETH9()` → WETH |
| Uniswap v3 Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | `getPool(USDC, WETH, fee)` returns the four live pools |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | `description() == "ETH / USD"`, `decimals() == 8` |
| Chainlink USDC/USD | `0x7e860098F58bBFC8648a4311b374B1D669a2bc6B` | `description() == "USDC / USD"`, `decimals() == 8` |
| OpenOcean router | `0x6352a56caadC4F1E25CD6c75970Fa768A3304e64` | deployed code present; is the `to` OpenOcean returns for Base |
| LI.FI Diamond | `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE` | deployed code present; equals LI.FI's `approvalAddress` and `to` |

**USDC vs USDbC**: `0x8335…2913` is Circle's native USDC. The bridged
`USDbC` (`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`) is a different, thinner token — approving or swapping
the wrong one is the single most common Base mistake, which is why the script
asserts `symbol()`/`decimals()` at startup.

`ALLOWED_TARGETS` is the pinned set of contracts the script will ever approve or
call. An aggregator response naming anything else is refused: that is the line
between "the API chooses our route" and "the API can point the desk's allowance
at an arbitrary contract".

---

## 3. Guards, and what they actually protect against

| Guard | Failure it prevents |
| --- | --- |
| `chainId == 8453` + on-chain identity assertions | wrong network / wrong token / typo'd router |
| Chainlink ETH/USD ⨉ USDC/USD fair value, `MAX_ORACLE_DEVIATION_BPS` (default 100) | trading into a manipulated pool or a broken route; an AMM quote cannot forge the oracle |
| Feed staleness (`3600s` ETH/USD, `90000s` USDC/USD) + `MAX_USDC_DEPEG_BPS` | a frozen feed silently becoming the benchmark; a depeg invalidating the maths |
| `MAX_SLIPPAGE_BPS` (default 30) → `amountOutMinimum` | fills far from the quote |
| `eth_call` simulation before every send (dry runs use a verified allowance state-override) | burning gas on calldata that would revert; catches stale RFQ legs |
| Exact-size approvals + post-run revocation | leaving an unlimited allowance on a third-party router |
| Post-trade WETH **balance delta** check | a router that "succeeds" but under-delivers, or delivers to the wrong address |
| Abort remaining slices if a fill lands below tolerance | feeding the rest of a large order into a book that moved against us |

Two honest caveats about the floor:

- For an **aggregator** route, the on-chain minimum is whatever *its* calldata
  encodes; the script cannot rewrite it. So it reads that floor back, refuses
  the route if it is looser than the oracle band, and warns when it is looser
  than `MAX_SLIPPAGE_BPS` (OpenOcean, for example, encodes ~40 bps when asked
  for 30). Uniswap is the one venue where we set the floor ourselves.
- The Chainlink band is a **sanity** band, not a benchmark. The feed only
  updates on deviation/heartbeat, so a good fill can print ±10 bps against it.
  Do not tighten `MAX_ORACLE_DEVIATION_BPS` toward your slippage tolerance —
  you will just reject valid trades.

---

## 4. Before you run this with real money

1. **Dry-run first, from the real trading address.** `ACCOUNT=0x… npm run swap`
   needs no private key: it quotes, prices, and simulates the winning route
   against live state (via an allowance state-override) without sending anything.
2. **Then fork-test the broadcast path.** What I used:
   ```bash
   anvil --fork-url <base-rpc> --fork-block-number $(cast block-number --rpc-url <base-rpc>) --port 8547
   RPC_URL=http://127.0.0.1:8547 PRIVATE_KEY=<anvil key> AMOUNT_USDC=50000 BROADCAST=1 npm run swap
   ```
   Expect aggregator routes containing **RFQ/PMM legs to revert on a fork** —
   those quotes are signed against live chain state and do not replay. That is
   exactly what the venue fallback is for; the Uniswap route always works on a
   fork. Do not "fix" it by widening slippage.
3. **Send one small clip on mainnet before the real one.** 1–5k USDC end-to-end
   proves RPC, key, gas and allowance handling for a few cents of gas.
4. **Key handling.** `PRIVATE_KEY` is read from the environment — use a
   dedicated hot wallet holding only the working balance, never the treasury's
   main key, and prefer piping from a secret manager over a `.env` file. For a
   desk this should eventually be a Safe with a proposer, not a raw EOA;
   `sendSlice()` is the one function that would need to change.
5. **Fund ETH for gas.** Base gas is cents, but the account still needs ETH; the
   script refuses to broadcast below 0.0005 ETH.
6. **Use a real RPC.** `https://mainnet.base.org` rate-limits under the call
   volume this script makes (four quoter calls + oracle reads per slice). Use a
   paid endpoint; set `RPC_URL`. JSON-RPC batching is deliberately off — not
   every provider implements it correctly, and a mangled batch is a bad failure
   mode here.
7. **Size and cadence.** `SLICES=n` splits the parent order and re-quotes each
   child. Slicing only helps if arbitrage can refill the books between children,
   so keep `SLICE_DELAY_MS` at 60s or more — slices in the same block just pay
   fixed costs twice. As a rule of thumb from the numbers above, ≥250k USDC on
   Base is worth splitting; 50k is not.
8. **MEV on Base.** Base's sequencer runs a private, first-come-first-served
   mempool, so classic public-mempool sandwiching is not the threat it is on
   Ethereum L1 — but that is a property of the sequencer, not a guarantee, and
   it says nothing about the RFQ makers inside an aggregated route. Keep the
   slippage floor tight; do not treat "it's an L2" as protection.
9. **Third-party risk is real and it is yours.** Two of the three venues return
   opaque calldata from an API. Mitigations in place: pinned target allowlist,
   pre-send simulation, oracle band, balance-delta verification. Mitigation not
   in place: the API being down or degraded — then `VENUES=univ3` still works,
   which is the reason the on-chain route exists at all.
10. **Check the allowance ledger afterwards.** The script approves exactly the
    slice size and revokes leftovers at the end unless `KEEP_ALLOWANCE=1`. If a
    run dies mid-flight, re-check `USDC.allowance(desk, router)` for each
    allowlisted target before walking away.

### Configuration

| Env var | Default | Meaning |
| --- | --- | --- |
| `RPC_URL` | `https://mainnet.base.org` | Base RPC (use your own) |
| `PRIVATE_KEY` / `ACCOUNT` | — | signer, or read-only address for dry runs |
| `RECIPIENT` | trader | WETH destination (disables OpenOcean, which settles to the sender) |
| `AMOUNT_USDC` | `250000` | parent order size, human units |
| `SLICES` / `SLICE_DELAY_MS` | `1` / `60000` | child orders and spacing |
| `MAX_SLIPPAGE_BPS` | `30` | tolerated drop from quote to fill |
| `MAX_ORACLE_DEVIATION_BPS` | `100` | hard rejection band vs Chainlink |
| `MAX_ORACLE_AGE_SEC` / `MAX_STABLE_ORACLE_AGE_SEC` | `3600` / `90000` | feed staleness limits |
| `MAX_USDC_DEPEG_BPS` | `200` | refuse to trade a depegged USDC |
| `VENUES` | `univ3,openocean,lifi` | venues to auction |
| `BROADCAST` | unset | `1` to actually send |
| `KEEP_ALLOWANCE` | unset | `1` to skip end-of-run revocation |

---

## 5. What was actually tested

- **Live Base mainnet, dry run, 250k USDC**: all three venues quoted, OpenOcean
  won at −11 bps vs the best Uniswap tier's −27 bps, and its calldata simulated
  clean against live state.
- **Anvil fork of Base at head, real broadcasts**: Uniswap route filled
  50k USDC → 26.035 WETH (gas 197k); a 2-slice 100k run filled both children
  after falling back from an OpenOcean route whose RFQ leg reverted on the fork;
  the LI.FI route filled 25k USDC → 12.96 WETH through its own calldata
  (gas 827k); a run with `RECIPIENT` set delivered to the third-party address
  and correctly excluded OpenOcean.
- Not tested: an OpenOcean *broadcast* (its routes carry RFQ legs that cannot
  execute on a fork; it was only verified by simulation against live state).

## 6. What I would add next, in order

1. A CoW Protocol mode for anything above ~$500k: signed intents, solver
   competition, no sandwich surface, surplus to the desk.
2. 0x and 1inch adapters (API keys) — more competition per auction.
3. Execution reporting: write each slice's quote, fill, venue and bps-vs-mid to
   a CSV/DB so the desk can measure slippage against arrival price over time.
4. Safe/multisig execution instead of a hot EOA.

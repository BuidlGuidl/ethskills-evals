# Runbook: Monthly CELO sweep, Celo to Ethereum mainnet treasury

## TL;DR

- Celo has been an **OP Stack Ethereum L2** since March 2025. Its canonical bridge to Ethereum works like an optimistic-rollup withdrawal. There are **three transactions**: *initiate* on Celo, *prove* on Ethereum, *finalize* on Ethereum. With the settings live today, the money is in flight for **about 7 days plus 1–2 hours**.
- A human (or a bot you run) has to act **twice more after kickoff**: prove about 1 hour after the start, and finalize about 7 days later. If you forget a step, the funds are not lost, but they also don't arrive.
- **Before you adopt this as-is, raise a bigger problem with finance.** On Ethereum, CELO is an ERC-20 (`0x057898f3C43F129a17517B9056D23851F124b19f`) with almost no float. Only about **150k CELO** exists on L1 outside the bridge contract. Your 180k sweep would more than double it. The custodian may not support that token, and there is no real L1 market to sell it into. If finance actually wants **dollars** in the mainnet treasury, don't bridge CELO. Convert to USDC on Celo and move the USDC. That same change is also the answer to "same-week" (see §5).

---

## 1. Parameters (checked on-chain 2026-09-21; re-check before each run)

| Item | Value | Source |
|---|---|---|
| L1 OptimismPortal (Celo) | `0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC` | Celo deployment |
| DisputeGameFactory | `0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683` | `portal.disputeGameFactory()` |
| Respected game type | `42` (OP Succinct Lite: an optimistic game with ZK proofs if challenged) | `portal.respectedGameType()` |
| Game challenge window | 302,400 s = **3.5 days** | `game.maxChallengeDuration()` |
| ZK prove window if challenged | 86,400 s = **1 day** | `game.maxProveDuration()` |
| Proof maturity delay | 604,800 s = **7 days**, counted from *your prove tx* | `portal.proofMaturityDelaySeconds()` |
| Dispute game finality delay | 302,400 s = **3.5 days**, counted from *game resolution* | `portal.disputeGameFinalityDelaySeconds()` |
| State-root proposal cadence | about every 25–40 min (observed) | `factory.gameAtIndex(...)` timestamps |
| L1 CELO token | `0x057898f3C43F129a17517B9056D23851F124b19f` (18 dp, 1B supply, ~999.85M held by the portal) | `systemConfig.gasPayingToken()` |

Pre-flight check commands (Foundry `cast`, `R=<mainnet RPC>`):

```sh
P=0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC
cast call $P "paused()(bool)" --rpc-url $R                         # must be false
cast call $P "proofMaturityDelaySeconds()(uint256)" --rpc-url $R
cast call $P "disputeGameFinalityDelaySeconds()(uint256)" --rpc-url $R
cast call $P "respectedGameType()(uint32)" --rpc-url $R
```

If any value differs from the table, **stop and recompute the timeline**. The Celo Security Council can upgrade these contracts instantly, with no exit window (see L2BEAT).

## 2. How the transfer actually works

1. **Initiate (Celo L2).** The ops wallet sends native CELO into the `L2ToL1MessagePasser` (`0x4200…0016`) through `initiateWithdrawal(target, gasLimit, data)`, with `target` = the mainnet treasury address. The CELO is burned/locked on L2 immediately, and the withdrawal gets a unique hash. **It can't be cancelled from this point on.**
2. **Wait for a state root that covers it.** Whitelisted proposers post Celo state roots to L1 as dispute games (type 42) about every 30 minutes. Your withdrawal becomes provable once a game's L2 block number is at or above the block your initiate tx landed in.
3. **Prove (Ethereum L1).** Submit `proveWithdrawalTransaction` with a Merkle proof against that game. This **starts the 7-day proof-maturity clock**.
4. **Game settles.** The game's 3.5-day challenge window runs, starting from game creation (about when you proved). If nobody challenges it, anyone can call `resolve()` after that. The game then has to sit another **3.5 days** (the finality "airgap") before the portal will accept it. That puts the game side at about 7 days too.
5. **Finalize (Ethereum L1).** Once *both* of these hold, call `finalizeWithdrawalTransaction`:
   - 7 days have passed since your prove tx
   - 3.5 days have passed since the game resolved

   The portal releases L1 CELO ERC-20 to the treasury address.

The two 7-day tracks run **in parallel**, not back to back. The end-to-end time is about **7 days + (time from initiate to prove)**.

## 3. Timeline and operator actions

Say T0 = last business day at 10:00 local time. Example: Wednesday 30 Sep 2026.

| When | Stage | Operator action | Done when |
|---|---|---|---|
| T0 − 1 day | Pre-flight | Run the §1 checks. Confirm the treasury address with the custodian by a second channel (don't copy it from last month's email). Confirm the ops wallet has CELO for L2 gas and the prove/finalize signer has **ETH on L1** (~0.01–0.05 ETH covers both txs at normal gas). Get the amount approved. | Checklist signed |
| T0 | **Initiate** on Celo | Send the withdrawal: amount = balance minus the gas reserve you keep for operations. Use a tool that speaks OP Stack withdrawals (Superbridge / the Celo bridge UI, or viem `op-stack` actions `initiateWithdrawal` → `proveWithdrawal` → `finalizeWithdrawal`). Record the **L2 tx hash and withdrawal hash** in the close ticket. | L2 tx confirmed (seconds) |
| T0 + ~1 h | **Prove** on L1 | Poll until a type-42 game covers the L2 block (usually under 1 h), then submit the prove tx. **Do this the same day.** Any delay here pushes finalization back by the same amount, so a Friday kickoff proved on Monday lands 3 days late. Record the L1 tx hash and the game address. | Prove tx confirmed; the 7-day clock is running |
| T0 + ~3.5 d | Game resolves | No action needed in the normal case. Check that the game's `status()` = `DEFENDER_WINS` (2). If it's still unresolved after the deadline, anyone (you included) can call `resolve()`. **If the game was challenged**, see §4. | Game resolved |
| T0 + ~7 d + 1 h | **Finalize** on L1 | Submit `finalizeWithdrawalTransaction`. In the example: **Wednesday 7 Oct**. Since the delay is exactly 7 days, finalize always lands on the same weekday as kickoff. | Treasury holds the L1 CELO |
| Finalize + custodian SLA | Custodian credit | The custodian confirms the deposit. Reconcile the L2 amount against the L1 amount (they should match exactly; no bridge fee). | Finance signs off |

**Normal in-flight time: about 7 days.** Kicking off on the last business day and finalizing a week later leaves plenty of room before the next month-end close. Plan for **up to about 15 days** in the bad cases below. Set up calendar alerts or a bot for the prove and finalize steps rather than relying on memory.

## 4. Things that go wrong, and what the operator does

- **Game challenged.** Someone disputes the state root, and a ZK proof has up to 1 extra day to defend it. If the game is defended, you lose about 1 day. If the game *loses* (CHALLENGER_WINS) or gets blacklisted, your proof is dead. **Re-prove against a newer valid game, which restarts the 7-day clock.** Escalate to Celo, and expect about 7 more days.
- **`respectedGameType` changed or a portal upgrade mid-flight.** Proofs against games created before the update can be invalidated, so you have to re-prove (7-day restart). Watch Celo governance/forum announcements before and during each close.
- **Proposer stops posting.** Withdrawals freeze until it resumes. Only whitelisted proposers can post. You can do nothing except wait and escalate.
- **Portal paused.** Wait. Funds are not lost.
- **Wrong target address.** It can't be fixed after initiation. That's why the second-channel address confirmation and the test transfer (below) matter.
- **First run:** do a **small test withdrawal** (e.g. 10 CELO) a full cycle ahead. It proves out that the custodian actually credits L1 CELO at `0x0578…b19f` to your treasury, and that your tooling handles prove and finalize.

## 5. The real issue: CELO on Ethereum and a $2M sweep

The mechanics above work. At $2M, though, the plan carries three risks finance should approve explicitly:

1. **Price exposure.** Once the sweep is initiated, you hold volatile CELO for at least 7 days with no way to sell it. On L2 it's locked in the bridge. On L1 it's a thin token (about 150k units in circulation).
2. **Custodian support.** Many custodians and exchanges list CELO *on the Celo network*, not the L1 ERC-20. Get written confirmation that the custodian supports `0x057898f3C43F129a17517B9056D23851F124b19f`. Otherwise it "arrives" somewhere they can't see or value it, which defeats the purpose.
3. **No L1 exit liquidity.** Turning L1 CELO into dollars probably means bridging it *back* to Celo (deposits take minutes) or sending it to a venue that accepts the ERC-20.

**Recommendation:** make the monthly sweep a **USDC sweep**, not a CELO sweep.

- **Convert on Celo.** Sell CELO for native USDC on Celo (Circle has issued natively there since April 2026). At $2M, don't market-dump once a month. Either convert **continuously** (daily or weekly TWAP through a DEX aggregator or Mento), or use an OTC desk or exchange for block size. This also spreads out the price risk you currently build up over the whole month.
- **Move USDC to Ethereum** by one of these routes:
  - **Circle Mint account** (best if you have one or can get one): redeem USDC on Celo, then mint or withdraw on Ethereum to the treasury. Same day.
  - **CCTP**, *if* Circle's current supported-domain list includes Celo. Check Circle's developer docs; I could not confirm it. Transfers settle in minutes.
  - **Exchange route:** deposit CELO or USDC on the Celo network to a venue the company already has an institutional account with (e.g. Coinbase Prime or Kraken), convert, and withdraw USDC on Ethereum to the treasury. This takes hours, depending on the venue's withdrawal limits and whitelisting.
- Avoid moving $2M through third-party liquidity bridges (Stargate, Squid, Relay, etc.). They're fast, but per-transfer liquidity and trust assumptions at that size are a separate risk review, and you'd likely have to split the transfer.

## 6. If finance says "same-week"

- **If they must hold CELO on L1:** the canonical bridge can't beat about 7 days. The floor is set by the 7-day proof-maturity delay, and no operator action shortens it. Your only lever is to prove within the hour. Same-week means kicking off **at least 7 days before** the deadline, i.e. moving the kickoff earlier (e.g. the 3rd-to-last Wednesday), not speeding up the bridge. Fast third-party bridges for CELO→L1 CELO won't have $2M of depth.
- **If they need the value (dollars) in the treasury:** switch to the §5 USDC route. Kickoff to funds in the mainnet treasury drops from about 7 days to **same day** (hours), you remove the week of CELO price exposure, and the custodian gets an asset it certainly supports. This is what I'd do regardless of the deadline once the sweep reaches $2M.

Sources:
- [Celo Docs – Native Bridge](https://docs.celo.org/specs/native-bridge)
- [Celo Specification – Native Bridge](https://specs.celo.org/bridge.html)
- [L2BEAT – Celo](https://l2beat.com/scaling/projects/celo)
- [Circle – USDC on Celo](https://www.circle.com/multi-chain-usdc/celo)
- [Circle – CCTP](https://www.circle.com/cross-chain-transfer-protocol)
- On-chain reads via `cast` against the contracts in §1 (2026-09-21)

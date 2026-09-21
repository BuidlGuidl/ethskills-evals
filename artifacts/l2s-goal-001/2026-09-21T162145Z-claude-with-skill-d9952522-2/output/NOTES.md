# Remittance ops tooling — Celo payouts and CELO sweep to Ethereum

Two scripts, both written in viem (pinned to exactly `2.56.8`). Both are **dry-run by default**. Nothing is signed or broadcast without `--execute`.

| Script | What it does | Chains |
| --- | --- | --- |
| `payout.ts` | Pays USDC to each row of a CSV from the ops wallet | Celo (42220) |
| `sweep.ts` | Moves the cycle's CELO from the ops wallet to the Ethereum treasury through Celo's canonical L2→L1 withdrawal | Celo → Ethereum (1) |

## The one thing finance needs to know first

**Celo is an Ethereum L2 (OP Stack, since 2025-03-26).** Getting CELO to Ethereum through the canonical route takes three transactions and **about 7 days**. It is not a transfer. The CELO leaves the ops wallet at T0 but reaches the treasury only after `finalize`, roughly a week later. For that week the funds sit in the bridge and appear in neither wallet. The details are in [Cash-flow timing](#cash-flow-timing).

---

## Setup

```sh
npm ci                      # installs the pinned viem 2.56.8
cp .env.example .env        # fill in, then: set -a; . ./.env; set +a
npm run typecheck
```

| Variable | Used by | Notes |
| --- | --- | --- |
| `CELO_RPC_URL` | both | Use a dedicated provider in production. The scripts check that chain id = 42220 |
| `ETH_RPC_URL` | sweep | Ethereum mainnet. The scripts check that chain id = 1 |
| `OPS_PRIVATE_KEY` | both | The ops wallet on Celo. It holds all the money, so see [Keys](#keys) |
| `L1_RELAYER_PRIVATE_KEY` | sweep (prove/finalize) | An Ethereum key that only holds ETH for gas |
| `TREASURY_ADDRESS` | sweep | The script **refuses to run** while this is the `0x1111…1111` placeholder |

## Running payouts

The CSV header must be exactly `payout_id,address,amount_usdc` (see `payouts.example.csv`).

```sh
# 1. Dry run: validates the CSV, checks balances, and simulates every transfer on-chain
npx tsx payout.ts --csv payouts/2026-09.csv

# 2. Execute: the count and total must match the approved payout sheet, or nothing moves
npx tsx payout.ts --csv payouts/2026-09.csv --expect-count 412 --expect-total 18250.75 --execute
```

Options:
- `--fee-currency usdc`: pays gas in USDC through Celo's native fee-currency field (CIP-64). This leaves the CELO revenue untouched. The default is `celo`.
- `--max-per-recipient 10000`: caps any single row. The run aborts if a row is over the cap.
- `--allow-duplicate-addresses`: allows one address to appear on several rows. Rejected by default.
- `--journal state/payouts.journal.jsonl`: the idempotency journal. See below.

What happens:
1. **The whole file is validated before anything is signed.** Checks: exact header, unique `payout_id`s, EIP-55 checksum on mixed-case addresses, and ≤6 decimals. Rows are rejected if they pay the zero address, the USDC contract, or the ops wallet itself, or if they exceed the cap. One bad row rejects the whole file.
2. On-chain preflight checks the chain id and that USDC is `USDC`/6 decimals. With USDC gas, it also checks that the adapter is still in Celo's `FeeCurrencyDirectory`.
3. **Every outstanding transfer is simulated before the first one is sent.** This catches Circle-blocklisted recipients, a paused token, or a short balance while the batch can still be stopped cleanly.
4. Transfers go out one at a time with explicit nonces. Each one is **signed, written to the journal (fsync'd), then broadcast**, then its receipt is recorded.
5. **Re-running is safe.** Already-confirmed IDs are skipped. An ID left in flight by a crash is settled by its hash: if the network never saw it, the same signed bytes are rebroadcast. A `payout_id` cannot be paid twice. If the CSV changes the amount or address for an ID that is already in the journal, the run aborts.

Throughput: Celo produces a block every second, so expect roughly one payout every 1–3 s. For example, 1,000 rows take about 20–50 minutes.

## Running the sweep

```sh
# Preview (read-only): amount, current bridge delays read from the chain, and expected arrival date
npx tsx sweep.ts plan     --cycle 2026-09 --reserve 25

# Step 1, on Celo: burns the CELO into the bridge, recorded to state/sweeps/2026-09.json
npx tsx sweep.ts initiate --cycle 2026-09 --reserve 25 --execute

# Steps 2 and 3, on Ethereum: prove, then (7 days later) finalize. Run it hourly from cron.
npx tsx sweep.ts advance  --cycle 2026-09 --execute
npx tsx sweep.ts status   --cycle 2026-09       # read-only
```

- The amount is `--amount <CELO>` for an exact figure, or `--reserve <CELO>` to sweep everything above that balance (a 0.1 CELO gas cushion is kept as well). You must pass exactly one.
- `advance` is idempotent. It reads the withdrawal's status from the portal and takes whichever step is due:
  - `waiting-to-prove`: prints the estimated time until a dispute game covers the block.
  - `ready-to-prove`: sends the prove transaction.
  - `waiting-to-finalize`: prints the time until the proof matures.
  - `ready-to-finalize`: sends finalize, then **checks from the receipt that exactly the right amount of CELO was transferred to the treasury**.
  - `finalized`: done.
- `--cycle` is the idempotency key. `initiate` refuses to start if the cycle already has a state file, so a second sweep cannot happen by accident.
- The treasury is fixed at initiate time. Changing `TREASURY_ADDRESS` later has no effect on a sweep already in flight (the script warns you if they differ).

---

## Before this touches real money: the operator checklist

**Addresses and destination**
- [ ] **Replace the treasury placeholder** and confirm the real address with finance over a second channel (call or signed message), not by copying it from chat. A wrong address cannot be recovered: once initiated, the withdrawal pays whatever target it recorded.
- [ ] **Run one small sweep end to end to the real treasury** (for example `--amount 1`) and wait the full ~7 days until it is `finalized` before the first real sweep. It is the only real test of that route.
- [ ] Confirm the treasury can hold an ERC-20. It receives **CELO as the Ethereum ERC-20 `0x057898f3C43F129a17517B9056D23851F124b19f`**, not ETH and not a wrapped asset. The Celo portal `safeTransfer`s it with no contract call, so an EOA or a Safe both work. `plan` prints whether the treasury is an EOA, a contract, or a 7702-delegated EOA.
- [ ] Pinned contract addresses come from the superchain-registry (`superchain/configs/mainnet/celo.toml`). They are cross-checked on-chain every run: portal → DisputeGameFactory, portal → SystemConfig, and SystemConfig's gas-paying token = L1 CELO. If Celo upgrades and any check fails, the script aborts. Update the constants from the registry; do not patch around the check.

**Keys**
- [ ] `OPS_PRIVATE_KEY` controls every dollar and every CELO on the ops wallet. In production, swap `privateKeyToAccount` for a KMS/HSM-backed viem account (for example the AWS KMS or GCP KMS signers). Only the `account` object changes; the rest of the code stays the same.
- [ ] Keep `L1_RELAYER_PRIVATE_KEY` separate and fund it with ETH only. Prove costs about **376k gas** (measured against the live portal) and finalize about 150–200k gas. At 1.6 gwei that is about 0.001 ETH per sweep, but top it up for gas spikes. Any funded key can finalize, because the script passes the recorded proof submitter.
- [ ] **Nothing else may use the ops key while payouts run.** The script aborts if it sees pending transactions it did not create, and it takes a lock file so two runs cannot race.

**State files are the safety mechanism, so treat them as records**
- [ ] `state/payouts.journal.jsonl` and `state/sweeps/*.json` must live on durable, backed-up storage. **Never delete or hand-edit them.** Without the journal, a re-run cannot tell which payouts already went out.
- [ ] Always run from the same host and working directory, or from shared durable storage. A second machine with an empty `state/` directory will pay the whole CSV again.
- [ ] `payout_id`s must be globally unique across all cycles. Prefix them with the cycle (for example `2026-09-000123`).

**Run order and balances**
- [ ] **Run payouts before the sweep.** By default payout gas is paid in CELO from the revenue balance. Either sweep afterwards with a `--reserve` that covers the next cycle's gas, or run payouts with `--fee-currency usdc` so the CELO stays untouched.
- [ ] Payouts need USDC ≥ the CSV total (plus fees when paying gas in USDC). The script checks this before sending.
- [ ] Get `--expect-count` and `--expect-total` from the approved payout sheet, not from the CSV itself. That cross-check is what catches the wrong file.
- [ ] Prefer checksummed addresses in the export. All-lowercase addresses are accepted, but they have no typo protection.
- [ ] If a transfer reverts on-chain, the run stops and the ID is marked `reverted`. Investigate, then re-issue it under a **new** `payout_id`.

**Operating the sweep**
- [ ] Cron `advance --execute` hourly and **alert on it**. Nothing happens automatically. A withdrawal left in `ready-to-prove` or `ready-to-finalize` adds exactly as much delay as it waits.
- [ ] If `advance` reports that the portal is paused, stop. Celo's guardian has halted withdrawals, the CELO is safe in the bridge, and it resumes when unpaused.
- [ ] If a withdrawal goes back to `ready-to-prove` after being proven, the dispute game was invalidated or retired. `advance` re-proves automatically, and **the 7-day clock restarts**. Tell finance.
- [ ] Upgrading viem is a code change. Its op-stack status logic tracks portal versions (Celo's portal is v5.1.1 today). Re-test `status` on a live withdrawal before bumping.

---

## Cash-flow timing

### Payouts (USDC on Celo)
Each transfer settles in about 1–2 s; the whole batch takes minutes (see throughput above). Recipients have funds as soon as their row confirms. The ops wallet's USDC drops row by row, not all at once at the end.

### Sweep (CELO → Ethereum treasury)
Values were read from the chain on 2026-09-21. `sweep.ts plan` and `status` re-read them every run, so rely on those rather than this table:

| Parameter (on-chain) | Value | Meaning |
| --- | --- | --- |
| `proofMaturityDelaySeconds` (portal) | 604,800 = **7 days** | The minimum time from **our prove transaction** to finalize. The check is strict (`>`) |
| `disputeGameFinalityDelaySeconds` (portal) | 302,400 = 3.5 days | Wait after the dispute game resolves |
| `maxChallengeDuration` (OP Succinct game, type 42) | 302,400 = 3.5 days | Unchallenged game resolves this long after it is created |
| Dispute-game cadence | about every 31 min | How long until the withdrawal's block can be proven |

Whichever gate falls later decides the date. The game becomes valid about 7 days after it is created, and the proof matures 7 days after our prove, which comes *after* the game is created. So proof maturity is the binding gate. **"Celo exits in 3.5 days" is wrong; that figure is the challenge window on its own.**

| When | Event | Treasury sees |
| --- | --- | --- |
| **T0** (cycle close) | `initiate` on Celo. The CELO leaves the ops wallet immediately | nothing |
| T0 + ~30–60 min | `advance` proves on Ethereum (~376k gas) | nothing |
| prove + 7 days | `advance` finalizes on Ethereum | **CELO arrives** |
| **≈ T0 + 7 days + ~1 h** | earliest arrival, assuming cron runs promptly | |

For planning:
- **Book the swept CELO as "in transit" for 7–8 days after cycle close.** It has left the Celo wallet and has not yet arrived in the treasury. The reference for reconciliation is the state file (`amountWei`, the L2 transaction, `withdrawalHash`). The finalize receipt is the proof of arrival, and the script checks the exact amount against it.
- **Price exposure:** the CELO is unhedged for that week. Finance should decide whether revenue is valued at initiate or at arrival.
- **Schedule the close around arrival, not initiation.** A month-end sweep lands around the 7th–8th of the next month. With weekly cycles, each week's sweep is still in flight when the next one starts. That is fine because each `--cycle` is its own withdrawal, but at any moment about one week of revenue is in transit.
- **Ways the date can slip. Plan for them, even though none is routine:**
  - Operator or cron lag adds 1:1.
  - The portal is paused by the Celo guardian (open-ended).
  - A successful challenge, or Celo governance retiring the respected game type, forces a re-prove and adds 7 more days.
  - A proposer outage means no new games, so nothing can be proven until they resume.
- **Costs per sweep:** the L2 initiate is negligible. L1 prove plus finalize cost about 550k gas in ETH (≈0.001 ETH at 1.6 gwei; `plan` prints the live figure). This is flat per sweep, so very small sweeps are not worth making.

**If 7 days is unacceptable:** a fast or intent bridge, or an exchange route, can land funds in minutes. That means a fee plus trusting a relayer, solver, or exchange beyond Ethereum and Celo's own bridge. It also needs a check that the route has enough CELO liquidity at our sweep size, which is often the limit for a gas token. That is a treasury policy decision, so it is deliberately not built here. Another option is to convert CELO → USDC on Celo before sweeping, which removes the price exposure but not the bridge delay.

---

## What was verified while building this (2026-09-21)

- Celo's L1 contract addresses came from the superchain-registry. The live portal agrees with them (`disputeGameFactory()`, `systemConfig()`), and `SystemConfig.gasPayingToken()` = L1 CELO `0x0578…b19f`, 18 decimals. The portal is version `5.1.1`.
- Celo's portal source (celo-org/optimism, `celo-contracts/v5.0.0--2`, v5.1.1) was checked. On finalize it `safeTransfer`s the L1 CELO ERC-20 to the target and calls the target only when there is calldata. The token and the portal itself are rejected as targets, which is why `sweep.ts` refuses them up front.
- The USDC token (`USDC`/6 decimals), the USDC fee adapter, and the adapter's listing in `FeeCurrencyDirectory` were all checked on Celo mainnet.
- `payout.ts` ran end to end on an anvil fork of Celo mainnet: validation errors, dry run, the approval gate, execution, a no-op re-run, crash recovery (a signed-but-unbroadcast transfer was rebroadcast and paid exactly once), and rejection of a CSV that changed an already-paid ID. USDC-gas mode was checked read-only only, because anvil cannot sign CIP-64 transactions. **Do one small live USDC-gas payout before relying on it.**
- `sweep.ts plan/initiate/status` ran with Celo forked locally and real Ethereum mainnet. viem's status logic returned correct results for real Celo withdrawals (`waiting-to-finalize`, `finalized`). A prove built by viem for a real withdrawal **simulated successfully against the live portal** (game type 42, 376k gas). The finalize step has not been exercised with a live send; the first small test sweep is what proves it.

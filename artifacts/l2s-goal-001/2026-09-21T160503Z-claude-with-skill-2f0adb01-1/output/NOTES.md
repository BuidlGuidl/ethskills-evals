# Remittance ops: payouts and the CELO revenue sweep

Two scripts. Both spend from the same ops wallet on Celo.

| Script | What it does | Chain(s) | Takes |
|---|---|---|---|
| `payout.ts` | Pays USDC to each row of a CSV | Celo | Minutes |
| `sweep.ts` | Moves CELO revenue to the treasury on Ethereum mainnet | Celo, then Ethereum | **About 7 days, 3 separate transactions** |

> **The one thing finance must know:** the sweep is not a transfer. It uses
> Celo's canonical bridge (Celo is an OP Stack L2 on Ethereum). Revenue leaves
> the ops wallet on day 0 and reaches the treasury at the earliest about
> **7 days + 1 hour later**, and only if someone runs `prove` and then
> `finalize`. The treasury receives **ERC-20 CELO**, not ETH and not USD.

---

## 1. Setup

```bash
npm ci            # viem is pinned to 2.56.8 on purpose; review changes before bumping
npm run typecheck
```

Environment variables (keep them in a secrets manager, not in shell history):

| Var | Used by | Notes |
|---|---|---|
| `OPS_PRIVATE_KEY` | both | The Celo ops wallet. Holds USDC for payouts and CELO revenue. |
| `CELO_RPC_URL` | both | **Use a paid provider.** See "RPC requirements". |
| `ETH_RPC_URL` | sweep | Ethereum mainnet RPC. |
| `L1_PRIVATE_KEY` | sweep prove/finalize | A **separate** Ethereum key that holds only a little ETH for gas. Anyone can prove or finalize, so this key never touches the funds. |
| `TREASURY_ADDRESS` | sweep | The mainnet treasury. The script refuses the `0x1111…` placeholder. |
| `SWEEP_CELO_RESERVE` | sweep | CELO left behind for payout gas. See sizing below. |
| `SWEEP_MIN_CELO` | sweep | Optional, default `1`. Don't bridge dust. |
| `PAYOUT_MAX_PER_RECIPIENT_USDC` | payout | Optional per-row cap. Recommended. |
| `JOURNAL_DIR` | both | Optional, default `./journal`. **Must be persistent and backed up.** |

### RPC requirements (tested, not theoretical)

`sweep.ts prove` calls `eth_getProof` on Celo at the L2 block of the newest
dispute game, which is up to about an hour old. It also reads receipts for
withdrawal transactions that are about 7 days old. In testing on 2026-09-21:

- `celo-rpc.publicnode.com` (free) and `rpc.ankr.com/celo` (free): **refused** `eth_getProof` for that block.
- `forno.celo.org`: built the proof, but intermittently returned "receipt not found" for month-old transactions.

Use a provider with archive/proof support for Celo (Alchemy, QuickNode, Infura,
etc.). Run `sweep.ts status` and a `prove` dry run against it before go-live.

---

## 2. Payouts: `payout.ts`

CSV, header required, no quoting:

```csv
id,address,amount
2026-09-C3-000001,0x9ae1c1a0b1f5be0d4b7f2c5de5e6b0f1c2a3b4c5,25.50
2026-09-C3-000002,0x0f1e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6,120
```

- `id`: **globally unique forever**, not just within the file. It is the idempotency key.
- `address`: mixed-case addresses must have a valid checksum. All-lowercase is accepted.
- `amount`: USDC as a decimal, at most 6 places, no `$` or commas.

```bash
# 1. Dry run (default). Validates, reconciles with the journal, checks balances, simulates every transfer.
npx tsx payout.ts cycle-2026-09-C3.csv

# 2. Execute. --expect-total is the finance-approved total; it must equal the CSV total exactly.
npx tsx payout.ts cycle-2026-09-C3.csv --execute --expect-total 145.50
```

What it protects against:

- **Double payment.** Each tx is signed, then its hash is written to
  `journal/payouts.jsonl` (fsync'd), then broadcast. Re-running skips confirmed
  ids, reconciles half-finished ones on-chain, and refuses a CSV that reuses an
  id with a different address or amount.
- **Wrong token.** Pays only native Circle USDC `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`.
  The Wormhole-bridged `0x37f750B7…5cAd` also calls itself "USDC". Recipient
  wallets such as MiniPay expect the native one.
- **Frozen or blacklisted addresses.** Every transfer is simulated first.
- **Fat-finger recipients.** Rejects the zero address, the ops wallet, and the
  USDC contract. Contract recipients are blocked unless you pass
  `--allow-contract-recipients` (use it for Safes and smart wallets).
- **Nonce races.** Transfers are sent one at a time, each receipt is waited for
  and its `Transfer` log verified. A lock file stops payout and sweep from
  running at the same time.

If it stops with "signed … but has no receipt", follow the message. **Never
delete journal lines.**

Costs: about 0.01 CELO of gas per transfer at today's 200 gwei Celo base fee,
paid from the ops wallet's CELO.

---

## 3. Sweep: `sweep.ts`

Route: `L2ToL1MessagePasser.initiateWithdrawal` on Celo → dispute game on
Ethereum → `OptimismPortal.proveWithdrawalTransaction` → 7-day wait →
`finalizeWithdrawalTransaction`. The portal then transfers **ERC-20 CELO
(`0x057898f3C43F129a17517B9056D23851F124b19f`)** to the treasury.

```bash
# Day 0, at cycle close
npx tsx sweep.ts initiate                     # dry run: shows balance, reserve, amount, destination
npx tsx sweep.ts initiate --execute --confirm-treasury 0x<treasury>
#   optional: --amount 1234.5  to sweep a figure from finance's ledger instead of "balance − reserve"

# Day 0, about 1h later
npx tsx sweep.ts status                       # "ready-to-prove"?
npx tsx sweep.ts prove --tx <celo tx hash> --execute

# Day 7, 1h+ after proving
npx tsx sweep.ts status                       # "ready-to-finalize"?
npx tsx sweep.ts finalize --tx <celo tx hash> --execute
```

`finalize` checks that the portal emitted `WithdrawalFinalized(success=true)`
and that the exact CELO amount was transferred to the treasury. It prints the
treasury balance before and after.

**Default amount** = ops wallet CELO balance − `SWEEP_CELO_RESERVE` − fee
headroom. That sweeps everything above the reserve, including any CELO someone
sent in for gas. If finance wants exactly the cycle's booked revenue, pass
`--amount`.

**Reserve sizing:** at least 3 × (payouts per cycle × 0.015 CELO). For example,
1,000 payouts per cycle needs a reserve of 50 CELO or more. If the reserve runs
out, the next payout run fails pre-flight.

**One sweep at a time:** `initiate` refuses while an earlier sweep in the
journal isn't finalized. If cycles are weekly, finalize last week's sweep
first, then initiate this week's. The timing works out almost exactly (see
below). `--allow-concurrent` overrides this.

**Ethereum gas:** prove used about 293k gas and finalize about 162k gas on
recent Celo withdrawals. That is under 0.001 ETH at today's 1.5 gwei. Keep
0.02–0.05 ETH on the `L1_PRIVATE_KEY` address for gas spikes.

### A real-world warning

I checked the four most recent native-CELO withdrawals on Celo. Three of them
(2026-05-13, 2026-06-03, 2026-08-22, for 150, 36 and 100 CELO) had been
initiated and **never proven**. Weeks to months later, that money had left the
L2 and had not arrived anywhere. The fourth was proven about an hour after
initiation and finalized. This is the failure mode to design the process
around. Put `sweep.ts status` in a daily check, and give the prove and finalize
steps an owner and a calendar entry.

---

## 4. Cash-flow timing for the close

Measured against live chain parameters on 2026-09-21 (`proofMaturityDelaySeconds = 604800`,
`disputeGameFinalityDelaySeconds = 302400`, dispute game `maxChallengeDuration = 3.5 d`,
`maxProveDuration = 1 d`, new dispute games about every 30 min):

| When | Event | Ops wallet (Celo) | Treasury (Ethereum) | Books |
|---|---|---|---|---|
| T0 | Cycle close. `initiate`. | CELO − swept amount | unchanged | Move to **"CELO in transit"** |
| T0 + ~30–60 min | Dispute game covers the tx. `prove`. | – | unchanged | – |
| T0 + ~7 d 1 h | Earliest `finalize` | – | **+ ERC-20 CELO** | Clear in-transit |

Guidance for finance:

- **Plan the treasury receipt for T0 + 8 calendar days.** Escalate at T0 + 10.
- **Normal delays** come from operator latency: finalize isn't automatic.
- **Abnormal delays:**
  - A challenged dispute game can add up to about 1 day.
  - A dispute game ruled invalid means re-proving, which restarts the **7-day** clock.
  - A Superchain guardian pause of the portal delays everything until it is lifted. The scripts detect the pause and refuse to run.

  None of these lose the funds, but finance can't count on the dates.
- **Price exposure:** the value in transit is CELO for about 7 days. The USD
  value booked at T0 will not equal the value received. If that matters, decide
  a conversion policy. The scripts don't swap anything.
- **What arrives:** ERC-20 CELO at `0x057898f3…b19f`, the token that backs the
  bridge. There is a different Ethereum token also called "Celo native asset"
  at `0x3294395e…ef69`. **Make sure your custodian/exchange supports
  `0x057898f3…`** before relying on the treasury balance for anything.
- **Faster alternatives** exist: third-party fast bridges, or depositing CELO
  at an exchange on Celo and withdrawing on Ethereum. They settle in minutes to
  hours but add counterparty risk and fees. I did not build them. Choosing one
  is a treasury-policy decision.

---

## 5. Go-live checklist (before this touches real money)

1. **Treasury address.** Put the real address in `TREASURY_ADDRESS` and
   confirm it through a second channel. It must be an address you control
   **on Ethereum mainnet**. If it's a Safe, confirm the Safe exists on
   mainnet. Withdrawals are irreversible, and a finalized withdrawal to the
   wrong address cannot be recovered.
2. **End-to-end test sweep.** Before the first real cycle close, sweep a small
   amount (for example `--amount 2`) to the real treasury and run all three
   steps. Confirm the ERC-20 CELO lands and that your custodian shows it.
   **This takes a week, so start it now.**
3. **Test payout.** Run a one-row CSV of 0.01 USDC to an internal wallet, then
   rerun the same CSV to confirm it is skipped.
4. **Keys.** `OPS_PRIVATE_KEY` controls all payout float and revenue. Prefer a
   KMS/HSM-backed signer: viem accepts any `LocalAccount`, so swap it in
   `loadAccount()` in `common.ts`. Use a separate low-balance `L1_PRIVATE_KEY`.
   Keep only one cycle's payout float in the ops wallet.
5. **Journal.** `JOURNAL_DIR` is what prevents double payments. Keep it on
   persistent, backed-up storage and run the scripts from one place, or from a
   shared volume. Never edit it except as the error messages instruct.
6. **RPC.** Use a paid Celo endpoint with `eth_getProof` and archive receipts
   (section 1). Test `status` and a `prove` dry run against it.
7. **Recipients.** Payouts go to Celo addresses. An exchange deposit address
   that doesn't support USDC on Celo won't credit the user. Validate the address
   book before it becomes a CSV.
8. **Balances before each run.** Top up the ops wallet with enough USDC for the
   CSV total and enough CELO for gas. The dry run tells you if either is short.
9. **Monitoring.** Run `sweep.ts status` daily. Alert if a sweep is still
   unproven 2 h after `initiate`, or unfinalized 8 days after.
10. **Address re-verification.** The addresses in `common.ts` were checked
    on-chain on 2026-09-21. The Celo portal reports `systemConfig` and
    `disputeGameFactory` matching the values in `common.ts`, the
    `SystemConfig.gasPayingToken()` is `0x0578…b19f`, and one historical
    withdrawal (Celo tx `0x4bae06b9…`, finalized on Ethereum in
    `0x0ac472f9…`) delivered that token to its target. On every run,
    `sweep.ts` re-checks the gas token and the paused flag. If Celo announces
    an L1 contract upgrade, re-verify against https://docs.celo.org before the
    next sweep.

## 6. What was tested

- `tsc --noEmit` passes (strict).
- **Live chains (read-only):** payout and sweep dry runs; `sweep.ts status` on
  real Celo withdrawals (reported "ready-to-prove" and "finalized" correctly);
  `prove` dry run built a real withdrawal proof against dispute game #39777;
  the placeholder treasury is rejected.
- **Local anvil fork of Celo, with `--execute`:** payout paid 3 rows and
  verified each `Transfer`. Rerunning paid nothing. A tampered CSV was
  refused. A wrong `--expect-total` was refused. `sweep initiate` withdrew
  balance − reserve and journaled it. A second `initiate` was blocked.
- **Not tested:** `prove --execute` and `finalize --execute` on Ethereum.
  These can't be exercised without a real 7-day withdrawal. That is what the
  small test sweep in checklist item 2 is for.

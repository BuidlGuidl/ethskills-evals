# Remittance ops: payouts and the CELO treasury sweep

Two tools for the ops wallet on Celo mainnet (chain 42220):

| Tool | What it does | Chains touched |
|---|---|---|
| `payout.ts` | Pays USDC on Celo to every row of a CSV | Celo |
| `sweep.ts` | Moves the cycle's CELO revenue to the Ethereum mainnet treasury through Celo's canonical bridge | Celo, then Ethereum |

**Read "The sweep is not a transfer" before anything else.** The treasury wallet is on
Ethereum and the CELO is on Celo. Since March 2025 Celo has been an OP Stack L2 on
Ethereum. Getting CELO from Celo to Ethereum means a bridge withdrawal. It takes
**about 7 days**, needs **three transactions on two chains**, and lands in the
treasury as the **CELO ERC-20 on Ethereum** (`0x057898f3C43F129a17517B9056D23851F124b19f`),
not as ETH.

---

## Setup

```sh
npm ci                      # Node >= 20.12; installs viem pinned at 2.56.8
cp .env.example .env        # fill in; never commit .env
npm run typecheck
```

All configuration comes from environment variables. Every variable is described in `.env.example`.

---

## Running payouts

CSV format: a header row with the columns `id,address,amount`. The columns can be in any order, and extra columns are ignored.
See `payouts.example.csv`.

- `id`: a **unique, permanent payment reference** from your system, such as the remittance
  order ID. It is the idempotency key. Once an ID is paid it is never paid again, even if
  it shows up in a later CSV. Reusing an ID for a different payment is rejected. Allowed characters are
  `A-Z a-z 0-9 . _ -`, and IDs are case-insensitive.
- `address`: the recipient's address on Celo. It can be all-lowercase or correctly EIP-55 checksummed.
  A mixed-case address with a bad checksum is rejected.
- `amount`: USDC as a plain decimal with at most 6 decimal places, such as `125.5`. The script
  never rounds. More than 6 decimals is an error.

Quoted fields aren't supported. Export a plain CSV.

```sh
# 1. Dry run. Nothing is signed or sent. This step validates every row, checks the
#    ledger for already-paid IDs, checks USDC and CELO balances, and simulates every
#    transfer from the ops wallet. The simulation catches Circle-blocklisted addresses,
#    a paused USDC contract, and similar problems.
npx tsx payout.ts payouts-2026-09-30.csv

# 2. Execute. It prints the same plan, then requires the confirmation code shown by
#    the dry run. The code is derived from the exact set of payments, so if the CSV
#    or ledger changes, the code changes.
npx tsx payout.ts payouts-2026-09-30.csv --execute
npx tsx payout.ts payouts-2026-09-30.csv --execute --confirm 62684A83   # unattended
```

Payments go out one at a time in CSV order. Each one waits for `CELO_CONFIRMATIONS`
(default 5) blocks and a matching USDC `Transfer` event before the next is signed. A
report CSV (`id,address,amount,status,tx_hash,block`) is written to `ledger/reports/` for
reconciliation. The run stops at the first revert or error. **Re-running the same command
is always safe.** Paid rows are skipped, and an in-flight row is resumed on its original
nonce.

Flags:
- `--allow-duplicate-recipients`: by default, the same address on two rows is rejected
  as a likely copy/paste error.
- `--retry-reverted`: re-attempt rows whose tx reverted. No money moved on those rows.
- `--replace-stuck`: fee-bump a tx that isn't getting mined. It reuses the same nonce, so
  the original and the replacement can't both land.

## Running the sweep

```sh
npx tsx sweep.ts plan     --cycle 2026-09 --amount 18250.5   # read-only; prints the confirmation code
npx tsx sweep.ts initiate --cycle 2026-09 --amount 18250.5 --execute   # Celo tx (day 0)
npx tsx sweep.ts status   --cycle 2026-09                    # any time; shows the next step and ETA
npx tsx sweep.ts prove    --cycle 2026-09 --execute          # Ethereum tx (~30-60 min after initiate)
npx tsx sweep.ts finalize --cycle 2026-09 --execute          # Ethereum tx (~7 days after prove); pays the treasury
```

- `--cycle` is your label for the accounting period. You get one sweep per label. The state lives in
  `ledger/sweeps/<cycle>.json`, and a second `initiate` for the same label is refused.
- **Use `--amount` with finance's revenue figure for the cycle.** Without it, the sweep sends
  everything above `CELO_GAS_RESERVE`. That includes any CELO that isn't revenue, such as
  a gas top-up. The amount is fixed at `initiate`. It can't be changed afterwards.
- `prove` and `finalize` without `--execute` are dry runs. They send Ethereum transactions from
  `L1_PRIVATE_KEY`, which pays ETH gas only. That key never holds or controls the CELO. The withdrawal's
  destination was fixed on Celo at `initiate`, so these steps can't redirect funds.
  Anyone can prove or finalize a withdrawal, and doing it twice is harmless.
- Every step is safe to re-run and checks the on-chain state first.

---

## Before this touches real money: the operator checklist

**Addresses and destinations**
1. **Set `TREASURY_L1_ADDRESS` to the real Ethereum mainnet treasury.** The placeholder
   `0x1111…1111` is refused. Have a second person verify the address out of band.
   The confirmation code covers the treasury and the amount, but it can't tell you whether an address is *yours*.
2. **Confirm the treasury can receive and see the CELO ERC-20 on Ethereum**
   (`0x057898f3C43F129a17517B9056D23851F124b19f`). A Safe or a self-custody EOA is fine.
   **Don't use an exchange deposit address.** The funds arrive as a token transfer made
   by the bridge contract, and exchanges often don't credit those. Check that finance's
   custodian or accounting view tracks this token.
3. **Never "sweep" by sending CELO to the treasury address on Celo.** An Ethereum Safe
   doesn't exist at the same address on Celo. Funds sent there can be unrecoverable.
   Only `sweep.ts` moves CELO to Ethereum.
4. **Recipient addresses must be Celo addresses that the recipient controls.** An
   exchange deposit address that isn't enabled for *USDC on Celo* can lose the funds. That's the
   single biggest recipient-side risk. Collect the network explicitly at onboarding. The dry
   run warns when a recipient is a contract.
5. The contract addresses in `lib.ts` were verified on 2026-09-21 against the OP
   superchain-registry and on-chain reads. At runtime the sweep re-checks that the bridge
   portal points at the expected SystemConfig and dispute-game factory, that the gas token
   is the expected CELO ERC-20, and that the portal isn't paused. If any check fails,
   the sweep refuses to run. Re-verify after any Celo network upgrade.

**Keys**
6. `OPS_PRIVATE_KEY` is a hot key that holds the float. Load it from a secret manager, not
   a file on a laptop. If your policy requires a KMS or HSM, replace `loadAccount()` in `lib.ts` with a
   viem account backed by your signer. Nothing else in the code depends on how the key is held.
   Every run checks that the key matches `OPS_ADDRESS`.
7. `L1_PRIVATE_KEY` needs ETH. The prove tx is about 376k gas (measured), and finalize is
   typically less (budget 400k). At 30 gwei that's about 0.02 ETH per cycle. Keep 0.05 ETH on it.
   `L1_MAX_FEE_GWEI` (default 30) makes it wait out gas spikes rather than overpay.

**Operational state (this is what prevents double payments)**
8. **`LEDGER_DIR` (default `./ledger`) is the payment ledger.** The double-payment
   protection depends on it. Put it on persistent, backed-up storage. Run all payouts and
   sweeps from one place against one ledger, and never delete or hand-edit it. Losing it means
   a re-run CSV pays everyone again. Each payment file records the signed tx and its nonce
   **before** broadcast, so a crash at any point is recoverable by re-running.
9. **Nothing else may send from the ops wallet** while these tools are in use: no manual
   wallet sends and no other service using the same key. The tools reserve nonces, and an
   outside tx breaks that. A lock file stops a payout and a sweep from running
   at the same time, but only within the same `LEDGER_DIR`.
10. Set `PAYOUT_MAX_ROW_USDC` and `PAYOUT_MAX_TOTAL_USDC` to real limits. Both are required.
11. Use dedicated RPC providers. Testing against the public endpoints showed flaky
    receipts, limits on log queries, and **missing historical state for `eth_getProof`**. The
    `prove` step needs Celo state about an hour old, so set `CELO_ARCHIVE_RPC_URL` to an archive-capable Celo node.

**Gas on Celo**
12. Celo gas is paid in CELO from the ops wallet, so it comes out of the revenue balance. At
    the current ~200 gwei base fee, a USDC transfer costs about 0.01 CELO. Keep `CELO_GAS_RESERVE`
    at or above your expected per-cycle gas (roughly 0.015 CELO × payments, plus margin). Book the gas as
    an expense against the CELO revenue. The payout dry run checks the CELO balance too.

**First run**
13. **Run a canary of each flow on mainnet with small amounts first.** For payouts, send one row of
    1 USDC to an internal address. For the sweep, run `--amount 1` all the way through `finalize`,
    which takes about 7 days. Then confirm the treasury received 1 CELO on Ethereum.
    Every step up to `prove` was validated before handoff:
    - Validation, idempotency, crash recovery, and fee bumps were exercised on a local fork of Celo mainnet.
    - A native-CELO withdrawal and an Ethereum `proveWithdrawalTransaction` were simulated against the live
      contracts.
    - Status tracking was checked on real Celo withdrawals.

    **`finalize` couldn't be exercised end-to-end.** A finalizable withdrawal takes 7 days to mature
    on mainnet. The canary is how you close that gap.

## Manual reconciliation

If a tool stops with "nonce … was consumed but none of our txs has a receipt", something
outside the tools sent from the ops wallet, or the RPC is lagging. **Don't re-run with changes and don't edit
the ledger.**
1. Look up every hash listed in the error, and the wallet's recent history, on https://celoscan.io.
2. If one of the hashes succeeded, the payment happened. Switch to a healthy RPC and re-run. The tool
   will pick up the receipt.
3. If none of them exists on-chain, the payment didn't happen. Before anyone changes a ledger file, escalate so that two people
   agree on the finding and record it.

---

## Cash-flow timing (for planning the close)

These are measured on-chain on 2026-09-21. Celo can change them through its governance. The
script prints the live values in `plan` and `status`.

| Step | When | What finance sees |
|---|---|---|
| Payouts | Minutes. Celo has 1 s blocks, and the tool runs sequentially with 5 confirmations, so allow about 5-10 s per payment (~15 min per 100). | USDC leaves the ops wallet and is final for the recipient within seconds |
| Sweep `initiate` (T0) | 1 Celo tx | **CELO leaves the ops wallet immediately.** From T0 until finalize it is *in transit*: on neither wallet's balance |
| `prove` | T0 + ~30-60 min. Celo state is posted to Ethereum about every 30 min (one per ~1,800 Celo blocks) | Nothing yet |
| Proof maturity | prove + **7 days** (`proofMaturityDelaySeconds` = 604,800) | Nothing yet |
| Dispute-game finality | The game's 3.5-day challenge window, then a 3.5-day finality delay (7 days from game creation) | Runs alongside maturity. Normally not the bottleneck |
| `finalize` | ≥ T0 + ~7 days 1 hour, plus however long until someone runs it | **Treasury receives exactly the swept CELO** (no bridge fee), as the CELO ERC-20 on Ethereum |

**Planning rule: treasury receipt ≈ initiate date + 8 calendar days.** That's 7 days of protocol
delay plus a margin for operator scheduling.

- For the CELO to be in the treasury **by** a close date, run `initiate` at least 8 days
  before it. For example, sweep revenue through day 22 on day 22 and have it for a day-30 close. Alternatively, accept that each
  cycle's sweep lands in the following period and book it as in transit.
- **Price exposure:** the value moves as CELO for about a week, with no hedge in transit. The treasury
  receives a fixed CELO *quantity*. Its USD value at receipt will differ from its value at initiate.
- **Things that stretch the timeline:**
  - If the dispute game backing the proof is challenged, the proposer has up to 1 day to answer
    with a validity proof, which can add about a day.
  - If a game is invalidated, you must re-prove, and **the 7-day clock restarts**. `status` flags this.
  - Celo's guardian can pause the bridge. The sweep refuses to initiate while it's paused, and
    in-flight withdrawals wait until it's unpaused.
  - If Celo stops posting state for hours, proving is delayed. `plan` warns when the latest state post is more than 6 hours old.
- **Costs per cycle:**
  - Celo gas: about 0.015 CELO for the initiate tx and about 0.01 CELO per payout, at current fees.
  - Ethereum gas: prove (~376k gas) plus finalize (≤400k gas), paid in ETH by the L1 key. About 0.001 ETH at today's
    ~1.4 gwei, and about 0.02 ETH at 30 gwei.
- **Trust model:** this is Celo's canonical bridge. Its contracts are upgradeable by Celo's
  governance (`ProxyAdminOwner` 0x4092…E112) and **not** governed by Optimism. Faster routes
  exist, such as third-party bridges or exchanges, which take minutes to hours. They add
  counterparty or bridge-contract risk and are not implemented here. If finance needs the funds faster
  than 7 days, that's a policy decision to make explicitly.

## Files

- `payout.ts`, `sweep.ts`: the entry points
- `lib.ts`: shared config, verified addresses, clients, ledger I/O, and the
  crash-safe Celo sender (one nonce per payment, persisted before broadcast)
- `.env.example`: every setting
- `payouts.example.csv`: CSV format
- `ledger/` (created at runtime): `payouts/<id>.json`, `sweeps/<cycle>.json`, `reports/*.csv`

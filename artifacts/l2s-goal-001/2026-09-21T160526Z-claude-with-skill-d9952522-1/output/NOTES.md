# Remittance ops tooling: payouts and the CELO sweep

Two scripts, one ops wallet on Celo:

| Script | What it does | Chain(s) | How long it takes |
| --- | --- | --- | --- |
| `payout.ts` | Pays USDC to every row of a CSV | Celo | Seconds per payment (1 s blocks) |
| `sweep.ts` | Moves the cycle's CELO revenue to the treasury on Ethereum mainnet | Celo → Ethereum | **About 7 days**, over 3 transactions on 2 chains |

**The one thing finance must plan around:** Celo is an Ethereum L2 (OP Stack, since
March 2025). The sweep uses Celo's canonical L2→L1 withdrawal. It has to be proven on
Ethereum and then wait out a 7-day proof window before it can be finalized. CELO that
leaves the ops wallet at the cycle close reaches the treasury **about 7 days and a few
hours later**, not the same day. See [Cash-flow timing](#cash-flow-timing).

**The treasury receives CELO as an ERC-20 on Ethereum**
(`0x057898f3C43F129a17517B9056D23851F124b19f`). It does not receive ETH, and it is not a
wrapped bridge token. It is the canonical L1 CELO token, and the Celo portal holds the
backing supply.

---

## Setup

```sh
npm ci                  # Node ≥ 21.7
cp .env.example .env    # fill in; see comments in the file
npm run typecheck
```

| Env var | Used by | Notes |
| --- | --- | --- |
| `CELO_RPC_URL` | both | Celo mainnet (chain 42220). Use a paid provider in production (see [RPCs](#rpcs)). |
| `ETH_RPC_URL` | sweep | Ethereum mainnet. |
| `OPS_ADDRESS` / `OPS_PRIVATE_KEY` | both | The ops wallet on Celo. The key is only read with `--execute`, and it must derive `OPS_ADDRESS`. |
| `RELAYER_ADDRESS` / `RELAYER_PRIVATE_KEY` | sweep | An Ethereum account that sends prove and finalize. It holds only ETH for gas. It **cannot** redirect funds, because the recipient is fixed when the sweep is initiated on Celo. |
| `TREASURY_ADDRESS` | sweep | The mainnet treasury. The scripts refuse the `0x1111…` placeholder. |
| `GAS_CURRENCY` | both | `USDC` (default) or `CELO`. See below. |
| `PAYOUT_MAX_ROW_USDC` | payout | Optional per-row cap. |
| `STATE_DIR` | both | Journals and reports. Default `./state`. |

`GAS_CURRENCY=USDC` pays Celo gas in USDC through Celo's native fee-currency field
(CIP-64). The fee currency is the USDC adapter `0x2F25…602B`, which is registered in
Celo's FeeCurrencyDirectory. The upshot:

- No paymaster or bundler is involved.
- The ops wallet never needs CELO for gas.
- The CELO balance is purely revenue, so `sweep.ts initiate --all` moves exactly that balance.

Measured cost on 2026-09-21: about 0.004 USDC per payout.

Everything is **dry-run by default**. Nothing is broadcast without `--execute`. A dry run
only needs `*_ADDRESS`, not keys, so a reviewer can run it.

---

## Running payouts

CSV, header exactly `payout_id,address,amount_usdc` (see `payouts.example.csv`):

```
payout_id,address,amount_usdc
2026-10-cycle-000001,0x000000000000000000000000000000000000dEaD,125.00
```

```sh
npx tsx payout.ts payouts.csv                                   # dry run
npx tsx payout.ts payouts.csv --execute --confirm-total 165.50  # pay
```

**The dry run:**

- Validates every row. If any row has a bad checksum, a duplicate id, a malformed amount, more than 6 decimal places, a zero address, or is addressed to the USDC contract or the ops wallet, the whole file is rejected.
- Simulates every transfer against the live chain, which catches USDC-blocklisted recipients and paused-token states.
- Checks the balance, including gas.
- Prints the total.

**`--execute`:**

- Requires `--confirm-total`, which must match the file total to the cent. The operator types the total finance approved.
- Pays rows in order, one confirmed transfer at a time.
- Checks each receipt for the exact USDC `Transfer` event.
- Writes `state/payout-report-<batch>.csv` (`payout_id, address, amount, status, tx_hash, block`) for reconciliation.

**Re-running is safe, and it is the recovery procedure.** `payout_id` is the idempotency
key, recorded in `state/payouts.json` across all files and runs:

- Every tx is signed locally and **journaled before it is broadcast**. If the process dies, the next run finds the journaled tx:
  - If it was mined, it is recorded.
  - If it is still unmined, the *same signed bytes* are rebroadcast. Same nonce means it can land at most once.
  - This was tested on a Celo fork: kill mid-flight, drop the mempool, re-run. The recipient was paid once.
- A `payout_id` that has already been paid is skipped.
- If a `payout_id` reappears with a different address or amount, the run stops.
- A reverted transfer (for example, the recipient was blocklisted after the dry run) stops the batch. No funds moved for that row. To retry, fix the problem and re-issue the payment under a **new** `payout_id`.
- `--allow-repeat-recipients` permits the same address on two rows of one file. Without it, the file is rejected.

---

## Running the sweep

```sh
npx tsx sweep.ts plan                     # read-only: balances, treasury check, live delays, relayer ETH
npx tsx sweep.ts initiate --amount 1234.5 # dry run  (or --all: the whole CELO balance, needs GAS_CURRENCY=USDC)
npx tsx sweep.ts initiate --amount 1234.5 --execute --confirm-treasury 0xTREASURY
npx tsx sweep.ts status                   # read-only: where each open sweep is, and exact ETAs
npx tsx sweep.ts advance --execute        # does whatever is due: prove, resolve, or finalize
```

**Run `advance --execute` from cron every hour.** It is idempotent. It proves once a
dispute game covers the withdrawal and finalizes once both finality gates have passed. If
a dispute game sits unresolved after its deadline, it also calls the permissionless
`resolve()`. Otherwise it does nothing.

Nothing on Ethereum happens by itself. A live example on Celo: a 100 CELO withdrawal
initiated on 2026-08-22 (tx `0x91d4dcde…`) was still sitting at "ready-to-prove" on
2026-09-21. Someone initiated it and nobody ran the prove step, so the 7-day clock never
started.

**What `initiate` checks before it signs:**

- The treasury isn't the placeholder.
- The RPCs are on the right chains.
- Celo's L1 `SystemConfig.gasPayingToken()` is still the pinned CELO token.
- The portal isn't paused.
- If the treasury is a contract (e.g. a Safe), an empty call to it from the portal doesn't revert.

`--confirm-treasury` must repeat the address. After mining, the script decodes the
`MessagePassed` event and checks that target, amount and sender match. It stores the full
withdrawal in `state/sweeps.json`, because Forno stops serving old receipts (see
[RPCs](#rpcs)) and prove may happen much later.

At finalize, the script checks the receipt for an L1 CELO `Transfer` from the portal to the
treasury for exactly the swept amount.

---

## Before this touches real money

1. **Set the real treasury.** Then confirm three things with whoever controls it:
   - It is on **Ethereum mainnet** at that exact address. A Safe on Celo does not imply a Safe at the same address on mainnet.
   - It can hold and move the ERC-20 `0x057898f3C43F129a17517B9056D23851F124b19f`.
   - Finance's books track that token, not "CELO on Celo".
2. **Do one small end-to-end sweep first** (e.g. `--amount 1`) and let it run the full ~7 days to finalization before the first real close. This is the only real test of the prove and finalize path with your keys, RPCs and treasury. The tooling was verified against live Celo withdrawals and a fork, but nothing here was broadcast to mainnet.
3. **Keys.**
   - The ops key controls all payout float and revenue.
   - The relayer key needs only ETH on mainnet (about 600k gas per sweep, ≈0.0012 ETH at 2026-09-21 fees; `plan` prints the live figure). Keep it topped up, or proving stalls.
   - `loadSigner` in `shared/ops.ts` reads raw private keys. For production, swap in a KMS/HSM-backed viem `Account`; nothing else changes.
4. **Only one writer per wallet.** The scripts refuse to start if the wallet already has pending txs. They take a lock in `STATE_DIR`, so don't run two copies. Nothing else (a person with MetaMask, another bot) may send from the ops wallet while a payout run is in progress.
5. **`STATE_DIR` is the source of truth for "already paid".** Keep it on durable, backed-up storage. Never run from two machines with separate state. Never delete it. If a run crashes and leaves `state/*.lock` behind, confirm nothing is running, delete the lock and re-run.
6. <a id="rpcs"></a>**RPCs.** Use paid, reliable providers for both chains.
   - Forno (Celo's public RPC) **returned no receipt for a Celo tx that was 30 days old** (tested 2026-09-21).
   - Some public endpoints reject `eth_getProof`, which the prove step needs, or require a token for it.
   - Transient RPC errors are harmless: re-run the command.
7. **Payout float.** Fund USDC to at least the batch total plus a small gas margin. The dry run tells you the exact figure.
8. **Pinned contract addresses** (in `shared/ops.ts`) were read from the superchain-registry entry for Celo and verified on-chain on 2026-09-21:
   - Portal `0xc5c5…AEDC`: v5.1.1, `proofMaturityDelaySeconds` = 604800, `disputeGameFinalityDelaySeconds` = 302400, respected game type 42 (OP Succinct), game `maxChallengeDuration` = 302400.
   - USDC `0xcebA…118C` and its fee adapter.

   The scripts read the delays live and never hard-code them. Re-verify the addresses if Celo announces an L1 contract migration.
9. **Failure modes the scripts surface but can't fix:**
   - Celo's guardian can **pause** the portal, and `advance` will refuse while it is paused.
   - A dispute game can be invalidated. `status` will then show `ready-to-prove` again, and `advance` re-proves against a new game. **That restarts the 7-day clock.**
   - Both are rare, but finance should know the 7 days is a floor, not a guarantee.

---

## Cash-flow timing

The times below come from the live Celo contracts and recent activity on 2026-09-21.
`sweep.ts status` prints the exact timestamps for each sweep.

| Step | When | What happens to the money |
| --- | --- | --- |
| **Payouts** | During the cycle | USDC reaches recipients within seconds. A 1,000-row batch runs sequentially, roughly 20–40 min. |
| **T0: `initiate`** (Celo) | At cycle close | CELO **leaves the ops wallet immediately**. It is now in transit and belongs to no wallet you can spend from. |
| **Provable** | T0 + ~30–60 min | Celo posts a dispute game about every 1,800 L2 blocks (≈30 min), usually within minutes of the block. `advance` proves on its next run, which with hourly cron is ≈ T0 + 1–2 h. |
| **7-day proof window** | Prove + 7 d | `proofMaturityDelaySeconds` = 604800, counted **from the prove tx, not from initiate**. |
| (in parallel) **Dispute game** | Game creation + 3.5 d + 3.5 d | Challenge window (302400 s), then resolve, then `disputeGameFinalityDelaySeconds` (302400 s). This finishes shortly before the proof window when proving is prompt. Whichever gate is later decides. |
| **Finalize** (Ethereum) | ≈ T0 + 7 d + 1–3 h | The portal transfers L1 CELO to the treasury. It arrives when `advance` runs next after the window opens. |

**Planning rule for finance: book CELO revenue as "in transit" at the cycle close and
expect it in the treasury on T+8 calendar days.** Do not use "3.5 days". That number is
only the dispute-game challenge window. Celo's real exit is gated by the 7-day proof
window. Every hour prove is late pushes the arrival back by an hour.

Worked example:

- Cycle closes and `initiate` runs Thu 2026-10-01 00:00 UTC.
- Proven about 01:00.
- Finalizable about Thu 2026-10-08 01:00.
- In the treasury by about 02:00 after the next hourly `advance`.

With weekly cycles, each sweep finalizes roughly when the next one is initiated. The
tooling tracks any number of open sweeps.

**Things finance should decide. These are not code:**

- **Price exposure.** CELO is volatile, and each sweep's CELO sits in transit for about 7 days before anyone can sell it. If the goal is dollar value in the treasury, consider swapping CELO for a stablecoin on Celo at the close and moving the stablecoin instead. On-chain CELO liquidity is concentrated on Celo, not on Ethereum mainnet, so check depth before planning to sell size on L1.
- **Speed vs. trust.** A third-party fast bridge or a CEX deposit/withdraw can land in minutes to hours for a fee. The trade is an added trust assumption: the relayer's liquidity, the exchange's custody. Check route depth for CELO at your actual size, because long-tail gas tokens are where relayer inventory runs out. Not implemented here. The canonical route only trusts Ethereum and Celo's own proof system.
- **L1 costs.** Per sweep: prove ≈360k gas + finalize ≈150–250k gas, paid in ETH by the relayer. Celo-side gas is negligible.

---

## What was verified, and what wasn't

Verified on 2026-09-21. Everything was read-only against mainnet, or run on a local anvil
fork of Celo:

- Payout dry-run against mainnet state, including simulation, fee estimation in USDC and every CSV rejection path.
- Payout `--execute` on a Celo fork: payment, re-run skipping, reuse-of-id guard, wrong-key guard, and crash recovery with rebroadcast.
- Signing output: the USDC-gas payout is a CIP-64 tx with the adapter as `feeCurrency`, and the CELO-gas one is EIP-1559, both chain 42220. The L1 tx is EIP-1559, chain 1.
- `sweep initiate --execute` on a fork: the withdrawal is decoded and journaled, and status is read from the real L1 portal.
- Sweep `status` / `advance` dry-run against **real in-flight Celo withdrawals**:
  - One `ready-to-prove`, for which the proof was built and L1 gas estimation (i.e. simulation) of `proveWithdrawalTransaction` succeeded from the original sender.
  - One `waiting-to-finalize`, with correct ETAs for both gates.
- Finalize delivers L1 CELO: the portal's `finalizeWithdrawalTransactionExternalProof` calls on mainnet emit CELO `Transfer`s from the portal to the withdrawal target.

**Not verified:**

- Any mainnet broadcast (by design).
- CIP-64 execution on a fork, because anvil doesn't support the tx type. It is covered by live `eth_estimateGas` with `feeCurrency` and by the signed-tx checks.
- A real prove and finalize with *our* keys. Hence step 2 of the checklist.

# Remittance ops: Celo payouts and CELO sweep to mainnet

Two scripts, both viem, both **dry-run by default**. Nothing is signed or sent without `--execute`.

| Script | Chain(s) | What it does |
| --- | --- | --- |
| `payout.ts` | Celo | Pays USDC to each row of a CSV from the ops wallet |
| `sweep.ts` | Celo → Ethereum | Moves CELO revenue from the ops wallet to the mainnet treasury over Celo's canonical L2→L1 withdrawal |

Setup (Node ≥ 20):

```sh
npm ci
npm run typecheck
```

`viem` is pinned to an exact version (2.56.8). Upgrade it deliberately and re-run the dry runs afterwards. The OP-stack withdrawal actions are what this depends on.

---

## 1. Payouts: `payout.ts`

### CSV

```csv
id,address,amount
PAY-2026-09-000123,0x2222222222222222222222222222222222222222,125.50
PAY-2026-09-000124,0x3333333333333333333333333333333333333333,40
```

- **`id`**: the remittance system's unique payout reference. This is the idempotency key, so it must be unique and stable. The same payout always gets the same id.
- **`address`**: recipient on Celo. All-lowercase is accepted. Mixed case must be a valid EIP-55 checksum, which catches most typos.
- **`amount`**: USDC as a plain decimal with at most 6 places. No `$`, no thousands separators, no scientific notation.

The whole file is rejected if it has a bad header, a duplicate id, a malformed address or amount, a zero or negative amount, or a row above `MAX_PAYOUT_USDC` when that's set. A duplicate *address* only produces a warning.

### Run

```sh
export CELO_RPC_URL=https://<dedicated Celo provider>
export OPS_ADDRESS=0x<ops wallet>          # enough for a dry run, no key needed
npx tsx payout.ts batch.csv --expect-total 12345.67 --expect-count 212             # dry run
OPS_PRIVATE_KEY=... npx tsx payout.ts batch.csv --expect-total 12345.67 --expect-count 212 --execute
```

`--expect-total` and `--expect-count` are mandatory. They should come from the approval step, not be read off the file. They catch "wrong file" and "file changed after approval".

The dry run checks:
- the RPC really is Celo mainnet
- the ops wallet's USDC covers the payouts plus gas
- the USDC fee adapter is still allowlisted
- every transfer simulates successfully against current state (this catches USDC-blocklisted addresses and a paused token before anything is paid)

### Idempotency and crash recovery

Each transfer is **signed, appended to `batch.csv.journal.jsonl`, and only then broadcast**, one at a time, waiting for each receipt. If the run dies for any reason, **re-run the exact same command**:
- rows already confirmed are skipped
- a row that was signed but whose fate is unknown is rebroadcast byte-for-byte, never re-signed, so it can't be paid twice
- if a row's journal entry no longer matches the CSV (the file was edited after paying), or its nonce was consumed by some other transaction, the run stops for a human

Keep the journal as the payment record, next to the CSV, and back it up. Never delete it to "retry".

### Gas

By default gas is paid **in USDC** through Celo's fee-currency mechanism (CIP-64), using the USDC **adapter** `0x2F25…602B`, not the token. No paymaster is involved. Set `PAYOUT_GAS_TOKEN=celo` to pay in CELO instead, but then payout gas eats into the CELO revenue the sweep moves. With USDC gas, the ops wallet's CELO balance is revenue plus a small reserve and nothing else, which keeps the sweep figure clean.

---

## 2. Sweep: `sweep.ts`

### What actually happens

Celo is an OP Stack **L2** of Ethereum. CELO is the gas token on Celo and a plain **ERC-20 on Ethereum** (`0x0578…b19f`), held in Celo's `OptimismPortal`. The canonical route out is three transactions on two chains, days apart:

| Step | Chain | Who pays gas | When it's possible |
| --- | --- | --- | --- |
| `initiate` | Celo | ops wallet (CELO) | any time |
| `prove` | Ethereum | L1 gas key (ETH) | once a dispute game covering the initiate block is posted (games observed ~every 30 min) |
| `finalize` | Ethereum | L1 gas key (ETH) | 7 days after **prove**, and after that game is resolved plus a 3.5-day finality delay |

**None of these steps happens by itself.** If nobody runs `prove`, the money sits in limbo indefinitely. The 7-day clock only starts at prove.

On finalize, the portal transfers CELO ERC-20 directly to the treasury. The treasury needs no code and no approvals, and a Safe works.

`initiate` calls `L2ToL1MessagePasser.initiateWithdrawal(treasury, …)` with the CELO as value. Do **not** substitute `L2StandardBridge` "ETH" functions or a third-party bridge UI; on Celo those are the wrong route for native CELO.

### Commands

```sh
export ETH_RPC_URL=https://<dedicated mainnet provider>
export CELO_RPC_URL=https://<dedicated Celo provider>
export TREASURY_ADDRESS=0x<real mainnet treasury>
export OPS_ADDRESS=0x<ops wallet>

npx tsx sweep.ts preflight                                    # verify contracts, balances, keys
npx tsx sweep.ts initiate --cycle 2026-09 --amount 18250.5     # dry run
OPS_PRIVATE_KEY=... npx tsx sweep.ts initiate --cycle 2026-09 --amount 18250.5 --execute

npx tsx sweep.ts status                                       # all sweeps: which step is due, and when
L1_PRIVATE_KEY=... npx tsx sweep.ts prove    <l2TxHash> --execute   # ~1h after initiate
L1_PRIVATE_KEY=... npx tsx sweep.ts finalize <l2TxHash> --execute   # ~7 days after prove
```

- **`--cycle`** is required and must be unique. The script refuses a second sweep for the same cycle label. Several cycles' sweeps can be in flight at once, because a sweep lasts longer than a weekly cycle.
- **`--amount`** should be the figure finance signed off on. `--all-above-reserve` sweeps the balance minus `CELO_RESERVE` (default 1 CELO, left for future sweep gas). `MAX_SWEEP_CELO` sets a hard ceiling.
- State lives in `sweeps/<l2TxHash>.json`. It's written *before* the initiate broadcast, so a crash can't lose track of CELO that has already been burned. Re-running `initiate --execute` rebroadcasts an unmined sweep instead of signing a new one. Back up `sweeps/`.
- `prove` refuses unless status is `ready-to-prove`, because proving again from the same key would **restart the 7-day clock**. `finalize` refuses unless status is `ready-to-finalize`. Afterwards it checks the portal's `WithdrawalFinalized.success` flag and the treasury's CELO balance.
- Every run re-derives Celo's L1 contracts from the chain (L2 messenger → L1 messenger → portal → dispute game factory, system config → gas token) and aborts if they no longer match the hard-coded addresses. It also warns if the portal is paused.

`status` prints both finalize gates:
- **proof maturity**
- **dispute game**: resolved, not yet resolvable, OVERDUE, or CHALLENGER WON (the proof is void; re-prove, and the clock restarts)

It prints the later of the two as the ETA. viem's own `getTimeToFinalize` only reports the first gate.

---

## 3. What the operator must get right before this touches real money

1. **Treasury address.** Replace the `0x1111…` placeholder. The script refuses to execute with it. It must be an address you control **on Ethereum mainnet**. If it's a Safe, confirm the Safe exists on mainnet, not only on some other chain. Never "sweep" by sending CELO to the treasury's address *on Celo*. That is just a Celo transfer to an address you may not control there.
2. **Run one canary sweep end to end first.** Sweep a small amount (e.g. 1 CELO) with `--cycle canary-1` to the real treasury. Prove it, wait out the week, finalize it, and check it arrived. That costs **8+ days of lead time**, so start it well before the first real close. What I couldn't test from here is a *real* Celo-initiated withdrawal being proven on mainnet (see §5).
3. **Keys.**
   - `OPS_PRIVATE_KEY` controls the USDC float and all revenue. Put it in a KMS/HSM. The scripts only touch it through `privateKeyToAccount`, so swap that single line for a viem custom/KMS account.
   - `L1_PRIVATE_KEY` should be a **separate** mainnet key holding only ETH for gas. Prove and finalize are permissionless and can only ever pay the withdrawal's fixed target, so this key can't redirect funds.
   - Don't put keys in shell history. Use a secrets manager or `.env`, which is git-ignored.
4. **Funding.**
   - Ops wallet: USDC for payouts plus gas (gas is cents per payout), and a small CELO reserve.
   - L1 gas key: ETH for about **600k gas per sweep**. Measured on a mainnet fork: prove ≈ 370k gas, finalize ≈ 220k gas. Multiply by the mainnet gas price at the time; `prove`/`finalize` dry runs print the live cost.
5. **RPCs.** Use dedicated providers for both chains. The public Celo endpoint (forno) was observed intermittently answering "not found" for receipts of mined transactions. The scripts retry before acting on "not found", but don't run production over it.
6. **USDC is Circle-native USDC on Celo** (`0xcebA…118C`), not a bridged variant. Recipients, especially exchange deposit addresses, must accept USDC **on the Celo network**. The simulation can't tell you that an exchange won't credit a deposit.
7. **Schedule the follow-ups.** Run `sweep.ts status` on a timer, e.g. hourly cron with an alert when anything is `ready-to-prove` or `ready-to-finalize`, or shows OVERDUE / CHALLENGER WON. A sweep nobody proves or finalizes never arrives.
8. **Keep the records.** Keep `*.journal.jsonl` and `sweeps/*.json`; they are the audit trail tying payouts and sweeps to on-chain transactions.

---

## 4. Cash-flow timing (for the close)

**Payouts** settle in seconds. Celo produces 1-second blocks, and the script confirms each transfer before sending the next, so allow about 2–3 s per payout (roughly 10 min for 200). USDC leaves the ops wallet as each row confirms.

**Sweep**: CELO leaves the ops wallet at *initiate* but reaches the treasury only at *finalize*:

```
T0            initiate on Celo; ops-wallet CELO drops immediately
T0 + ≤~1h     prove on Ethereum (as soon as a game covers T0's block)
prove + 7d    proof matures (proofMaturityDelaySeconds = 604,800)
              game gate normally already met: 3.5d challenge + resolve + 3.5d finality
              ≈ 7d from game creation
≈ T0 + 7d 1h  finalize; CELO (ERC-20) lands in the mainnet treasury
```

Values were read off the Celo portal on 2026-09-21. `sweep.ts preflight` prints the live ones, and `status` prints per-sweep ETAs.

- **Plan on T0 + 8 calendar days** from initiate to funds in treasury. That covers the 7-day protocol wait plus operator latency on prove and finalize. If finalize falls on a weekend, someone has to be on call to run it, or it waits until Monday.
- **For about a week the CELO is on neither books' chain.** It's out of the ops wallet but not yet in the treasury. Book it as *in transit to treasury* at initiate, and match it by the `sweeps/<hash>.json` record.
- **Price exposure.** The treasury receives the same number of **CELO**, not a USD value. CELO moves over the 8 days. If finance needs a fixed USD figure, that means swapping on Celo *before* the sweep, which is a separate decision and not implemented here.
- **Cycles overlap.** With weekly cycles, cycle N's CELO arrives around when cycle N+1 closes. Steady state works because the scripts allow one open sweep per cycle.
- **What can push the date out:**
  - the dispute game proving withdrawals is lost to a challenger: re-prove against a newer game, **+7 days**
  - Celo's guardian pauses the portal: nothing finalizes until it's unpaused
  - Celo's proposer is late resolving games: `status` shows OVERDUE
  - nobody runs prove or finalize
- **If a week is unacceptable:** the alternative is a fast bridge or an exchange hop. It returns funds the same day, but for a fee *and* a trust assumption on the bridge or exchange beyond Ethereum's. Check that route's liquidity for CELO at your actual size first. It isn't implemented here because it changes who holds the money in between.

---

## 5. What was verified, and what wasn't

Verified on 2026-09-21 against live chains, read-only, plus local anvil forks. Nothing was broadcast to a real network.

- **Addresses.** All hard-coded addresses were read off chain:
  - USDC symbol and decimals, and the adapter's `adaptedToken()`
  - the adapter's presence in `FeeCurrencyDirectory`
  - L2 messenger → L1 messenger → portal → dispute game factory and system config
  - `gasPayingToken()` = CELO `0x0578…b19f`
  - the portal holds about 1B CELO as the lockbox
- **Payouts, dry run on mainnet state.** Balance and simulation checks, and the rejection paths: wrong total, bad checksum.
- **Payouts, `--execute` on a Celo fork.** Paying in CELO gas, because anvil can't execute CIP-64 transactions:
  - a full batch was paid
  - re-running paid nothing twice
  - an edited CSV was refused
  - a crash between signing and broadcast was recovered by rebroadcast
- **Sweep, `initiate --execute` on a Celo fork.** The withdrawal was extracted from the receipt, and the same-cycle duplicate was refused. `status` and the time-to-prove reading came from real mainnet.
- **Sweep prove/finalize, against Celo's real contracts on a mainnet fork.**
  - A real Celo withdrawal was proven with a test key through viem's `proveWithdrawal`.
  - Time was advanced, the parent games were resolved, and it was finalized through `sweep.ts finalize`.
  - A synthetic 10-CELO, empty-calldata withdrawal (exactly what `initiate` builds) was finalized through the real portal code: `success=true`, the treasury's CELO ERC-20 balance went up by 10, and the portal's lockbox went down by 10.
- **Not executed anywhere:**
  - a CIP-64 (USDC-gas) payout broadcast. The dry run exercised fee estimation and the adapter; the canary covers the rest.
  - a real Celo initiate proven on mainnet. The canary sweep in §3.2 is how you close that gap before real money moves.

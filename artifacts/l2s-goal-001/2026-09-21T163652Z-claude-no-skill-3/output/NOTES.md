# Remittance ops tooling: payouts (USDC on Celo) and revenue sweep (CELO → Ethereum treasury)

## Read this first: what "sweep to the mainnet treasury" really means

The ops wallet lives on **Celo**, and the treasury lives on **Ethereum mainnet**. They are
different chains. **If you send CELO to the treasury address on Celo, it stays on Celo.** It does
not arrive on Ethereum. If the treasury is a Safe (or any contract) deployed only on Ethereum,
that address has no owner on Celo, and the funds are effectively lost.

So `sweep.ts` uses **Celo's canonical bridge** (Celo is an OP Stack L2 that settles to
Ethereum). A withdrawal takes three transactions and **about 7 days**:

| Step | Chain | When | Who pays gas |
|---|---|---|---|
| 1. `initiate` | Celo | any time | ops wallet (CELO, ~0.02) |
| 2. `prove` | Ethereum | once a dispute game covers the L2 block: typically 30–60 min, Celo docs say up to 2 h | L1 key (ETH) |
| 3. `finalize` | Ethereum | 7 days (604,800 s, read from the portal) after `prove` | L1 key (ETH) |

**What the treasury receives:** CELO as an ERC-20 on Ethereum,
`0x057898f3C43F129a17517B9056D23851F124b19f` ("Celo native asset"). It does *not* receive ETH
or USDC. Finance needs to decide whether that's what they want (see "Open decisions").

## Setup

```bash
npm ci                 # viem 2.x, tsx, typescript
npm run typecheck
```

Environment variables (inject from your secret manager; never commit them):

| Var | Used by | Notes |
|---|---|---|
| `CELO_RPC_URL` | both | A dedicated Celo mainnet RPC. Public forno is rate-limited. The chain ID is checked (42220). |
| `ETH_RPC_URL` | sweep | A dedicated Ethereum mainnet RPC. The chain ID is checked (1). |
| `OPS_PRIVATE_KEY` | both | Ops wallet key. Only required with `--execute`. |
| `OPS_ADDRESS` | both | Lets you dry-run without the key. |
| `L1_PRIVATE_KEY` | sweep | Optional. Signs `prove`/`finalize` on Ethereum and needs ETH. Defaults to `OPS_PRIVATE_KEY`, which is the same address on Ethereum. |
| `TREASURY_ADDRESS` | sweep | The real Ethereum treasury. The script refuses the `0x1111…` placeholder. |
| `SWEEP_GAS_RESERVE_CELO` | sweep | Required. CELO kept in the ops wallet to pay payout gas. |
| `MAX_PAYOUT_USDC` | payout | Optional per-row cap. Recommended. |
| `MAX_SWEEP_CELO` | sweep | Optional cap against fat-finger amounts. Recommended. |
| `MAX_FEE_GWEI` | payout | Optional. Refuses to sign above this maxFeePerGas (default 1000). |

To use a KMS/HSM instead of a raw key, change `loadAccount()` in `common.ts` to return any
viem `LocalAccount`. Nothing else needs to change.

## Payouts: `payout.ts`

CSV (header required, `reference` optional but strongly recommended):

```csv
recipient,amount_usdc,reference
0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed,10.50,"INV-1001, Maria"
0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359,250,INV-1002
```

```bash
# 1. Dry run (read-only). Validates the CSV, checks the chain, token, blacklist and balances.
npx tsx payout.ts batches/2026-09-30.csv

# 2. Execute. The total and count are the figures finance approved, typed by the operator.
#    If they don't match the CSV exactly, nothing is sent.
npx tsx payout.ts batches/2026-09-30.csv --execute --expect-total 12500.00 --expect-count 42
```

What it checks before sending anything:
- The RPC is Celo mainnet. The token is **Circle-native USDC `0xcebA…118C`** (6 decimals, not paused).
- Every address is valid, and **mixed-case addresses must have a correct EIP-55 checksum**, which
  catches typos. Zero address, the ops wallet itself and the USDC contract are rejected.
- Amounts are plain decimals with ≤ 6 places. It **rejects rather than rounds**, and rejects ≤ 0.
- Duplicate recipients are rejected unless you pass `--allow-duplicate-recipients`. Duplicate references are rejected.
- Neither sender nor recipients are on the USDC blacklist; a blacklisted address would make the transfer revert.
- The USDC balance covers the batch and the CELO balance covers gas. Recipients that are contracts are listed for review.

How it executes: one transfer at a time. Each transaction is **signed, written to
`<csv>.journal.json` (fsynced), then broadcast**. Its receipt is checked for `status=success`
*and* a matching `Transfer` event. If a transaction isn't mined within 90 s, it's replaced at
the same nonce with a higher fee (up to 3 times). A final `<csv>.report.csv` lists every row
with its tx hash and block, for reconciliation.

**Crash/resume:** re-run the exact same command. Confirmed rows are skipped, and an in-flight
row is rebroadcast from its *saved signed bytes*, so it can't be paid twice. This was tested on
a Celo mainnet fork by killing the process mid-transaction and dropping the transaction from
the mempool.

**Halting states:**
- `failed`: the transaction reverted. Investigate, then re-run with `--retry-failed`.
- `conflict`: something else used the ops wallet's nonce, so this row's transaction can never
  mine. **Check the explorer that the recipient was not paid by that other transaction**, then
  re-run with `--retry-failed`.
- The CSV changed after execution started: refused. Never edit a batch file once executed; put
  corrections in a new CSV.

## Sweep: `sweep.ts`

```bash
# Day 0: initiate (dry run first, always)
npx tsx sweep.ts initiate --cycle 2026-09 --amount 15000
npx tsx sweep.ts initiate --cycle 2026-09 --amount 15000 --execute

# Day 0, +1–2 h
npx tsx sweep.ts status --cycle 2026-09          # wait for: ready-to-prove
npx tsx sweep.ts prove  --cycle 2026-09 --execute

# Day 7, after the maturity delay
npx tsx sweep.ts status   --cycle 2026-09        # wait for: ready-to-finalize
npx tsx sweep.ts finalize --cycle 2026-09 --execute
```

- `--amount` should be **the cycle's revenue figure from finance**, not "the wallet balance". The
  balance also holds the gas float that payouts depend on. `--all-above-reserve` exists, but it
  sweeps everything except `SWEEP_GAS_RESERVE_CELO`, whatever the source.
- The script refuses to leave the wallet below the reserve, refuses when the L1 portal is paused,
  and refuses to initiate the same `--cycle` twice. The state lives in `sweeps/<cycle>.json`.
- On every run it checks the pinned bridge addresses against Ethereum
  (portal → SystemConfig → chain ID 42220 → gas-paying token = L1 CELO). If anything differs,
  it stops.
- `finalize` only reports success after checking three things: the tx succeeded, the portal's
  `WithdrawalFinalized.success` is true, and **the treasury's L1 CELO balance rose by at least
  the amount**.
- The withdrawal target is fixed at `initiate`. Anyone can prove or finalize it, but the CELO can
  only go to `TREASURY_ADDRESS`. If a prove/finalize tx gets stuck, re-running is safe.
- If Celo's security council invalidates the dispute game you proved against, `status` goes back
  to `ready-to-prove`. Prove again. The 7-day clock restarts from the new proof.
- The ops wallet shares one nonce across both scripts. **Don't run `payout.ts` and
  `sweep.ts initiate` at the same time.** Both refuse to start if the wallet has pending transactions.

## Operator checklist: get these right before real money moves

1. **Treasury address.** Set the real Ethereum mainnet address and have a second person check
   it character by character. Confirm the treasury can hold and move an ERC-20: an EOA, or a
   Safe whose signers know they'll receive CELO (ERC-20 `0x0578…b19f`).
2. **Never "sweep" with a plain transfer** from a wallet UI or `cast send` on Celo. That is the
   mistake this whole design exists to avoid.
3. **End-to-end test with small amounts first**, before the first real cycle: one payout row of
   about $1, and a sweep of about 1 CELO all the way to `finalize`. Then confirm the treasury
   saw the CELO ERC-20 arrive on Etherscan. The 1-CELO test takes 7 days, so start it early.
4. **ETH on Ethereum** for the L1 key. `prove` plus `finalize` are roughly 400–700k gas together,
   so keep ≥ 0.05 ETH there.
5. **CELO gas reserve.** A payout row costs about 0.015–0.02 CELO at today's fees (the dry run
   prints the exact budget). Set `SWEEP_GAS_RESERVE_CELO` to at least 2× your largest batch's budget.
6. **USDC float.** Fund the ops wallet with native USDC (`0xcebA…118C`). **Wormhole-bridged
   "USDC" (`0x37f7…5cAd`) also reports `symbol() == "USDC"`**, but it is a different token. The
   scripts pin the address; treasury top-ups must use the native one too.
7. **Recipient addresses must be able to receive USDC on Celo.** Some exchange deposit addresses
   only credit certain networks. The CSV's source system must know each recipient's Celo address.
8. **Keys** come from a secret manager at run time. Nothing touches `.env` files in the repo
   (`.gitignore` covers `.env*`).
9. **Journals are the audit trail.** Back up `*.journal.json`, `*.report.csv` and `sweeps/`.
   **Never delete a journal to "retry"**: that's exactly how a batch gets paid twice.
10. **Re-verify the pinned addresses** in `common.ts` if Celo announces a bridge upgrade
    (docs.celo.org → L1 contracts). The runtime check stops on a mismatch, but a human should
    know why.

## Cash-flow timing (for finance)

| Event | Elapsed | Where the money is |
|---|---|---|
| Payout batch run | ~2–3 s per row (Celo has 1 s blocks and rows go sequentially), so ~20–25 min per 500 rows | Recipients have USDC as soon as each tx confirms |
| Sweep `initiate` | T+0 | CELO leaves the ops wallet (burned on Celo) |
| `prove` possible | T+~0.5–2 h | In transit, visible nowhere as a balance |
| Proof maturity | T+7 d + (prove delay) | In transit |
| `finalize` | ≈ **T+7 d 2 h** | CELO ERC-20 lands in the Ethereum treasury |

Planning implications:
- **About 7–8 days pass between the cycle's sweep and funds landing on mainnet.** To hold
  revenue on mainnet by close date D, you must initiate by about **D − 8 days**. Revenue that
  arrives after the initiate rolls into the next cycle's sweep. The alternative is to accept that
  cycle N's revenue lands around 8 days after cycle N closes.
- During those ~7 days the funds are **neither on Celo nor on Ethereum**. Book them as "in
  transit" (the journal has amount, tx hashes and timestamps), and reconcile at `finalize`
  against the treasury balance delta the script prints.
- **Price exposure:** CELO is volatile, and the treasury holds CELO throughout the ~7-day window.
  The USD value on landing will differ from the value at cycle close.
- The schedule can slip if the L1 portal is paused or a game is invalidated, which forces a
  re-prove and restarts the 7 days. Rare, but finance should know it's possible.
- Costs per sweep: a few cents of CELO on Celo, plus the Ethereum gas for `prove` and `finalize`.
  Payout gas is about 0.015–0.02 CELO per row.

## Open decisions (flag to finance / eng leads)

1. **Do they want CELO on Ethereum, or dollars?** If the goal is USD (or USDC) in the treasury,
   it's usually better to swap CELO→USDC *on Celo*, where the liquidity is, and move USDC. That
   is a different route, with its own bridge and timing, and it isn't implemented here. CELO on
   Ethereum is thinly traded compared with CELO on Celo.
2. **Is 7 days acceptable?** Third-party bridges (liquidity networks and messaging bridges) do
   CELO/USDC Celo→Ethereum in minutes, but they add counterparty/bridge risk and fees. The
   canonical bridge was chosen here because its only trust assumption is Celo's own security model.
3. **Gas in USDC:** Celo can charge gas in USDC (CIP-64 fee currencies), which would remove the
   CELO gas float and simplify the sweep math. Not enabled; it's a deliberate simplification.

## Pinned addresses (verified on-chain 2026-09-21)

| What | Chain | Address | Check performed |
|---|---|---|---|
| USDC (Circle native) | Celo | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | name/symbol `USDC`, decimals 6, FiatToken `paused()`/`isBlacklisted()` present |
| OptimismPortal (proxy) | Ethereum | `0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC` | `version()` 5.1.1, `proofMaturityDelaySeconds()` 604800, `systemConfig()` and `disputeGameFactory()` match below |
| DisputeGameFactory | Ethereum | `0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683` | new games ~every 30 min / 1,800 L2 blocks |
| SystemConfig | Ethereum | `0x89E31965D844a309231B1f17759Ccaf1b7c09861` | `l2ChainId()` 42220, `gasPayingToken()` = L1 CELO |
| CELO (L1 ERC-20) | Ethereum | `0x057898f3C43F129a17517B9056D23851F124b19f` | symbol CELO, 18 decimals, ~1.0B locked in portal |
| L2ToL1MessagePasser | Celo | `0x4200000000000000000000000000000000000016` | OP Stack predeploy |

Source: docs.celo.org → Tooling → Contracts → L1 contracts.

## What was tested (and what wasn't)

- Type-check (`tsc --strict`).
- Dry runs against live Celo and Ethereum mainnet: CSV validation errors, balance/blacklist
  checks, placeholder treasury rejected, gas-reserve guard.
- `--execute` on a **local anvil fork of Celo mainnet**: payout batch, totals mismatch refused,
  re-run pays nothing twice, edited CSV refused, crash + dropped tx resumed without a double
  payment, nonce conflict halts. `sweep initiate` works on the fork and is idempotent on re-run.
- `status` against a real in-flight Celo→Ethereum withdrawal. The **proof-building path
  simulated successfully** (`eth_call` of `proveWithdrawalTransaction`) against the live L1
  portal, using a real withdrawal.
- **Not exercised:** a real `prove` / `finalize` broadcast. That's what the 1-CELO end-to-end
  test in the checklist is for.

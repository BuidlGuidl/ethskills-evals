# Remittance ops: payouts and the CELO treasury sweep

Two tools:

| Script      | What it does                                                  | Chain(s)            | Time to settle    |
|-------------|---------------------------------------------------------------|---------------------|-------------------|
| `payout.ts` | Pays a CSV of recipients in **native USDC on Celo**           | Celo                | seconds per row   |
| `sweep.ts`  | Moves CELO revenue from the ops wallet to the **Ethereum** treasury | Celo → Ethereum | **~7 days** |

**Read this first.** The sweep can't be done as a single transfer. Celo is an
Ethereum L2 (OP Stack). If you send CELO to the treasury address *on Celo*, it
stays on Celo. If the treasury is a Safe that only exists on Ethereum, those
funds could be unrecoverable. Moving CELO to Ethereum means a canonical-bridge
withdrawal: **initiate → prove → wait 7 days → finalize**. The last step has to
be run by hand; nothing arrives automatically.

---

## 1. Setup

```bash
npm install
cp .env.example .env      # fill in; never commit .env
npm run typecheck
```

| Variable              | Used by            | Notes |
|-----------------------|--------------------|-------|
| `CELO_RPC_URL`        | both               | Dedicated Celo mainnet RPC. The public `forno.celo.org` fallback is rate-limited, and in testing its load-balanced nodes sometimes returned "no receipt" for mined txs. Don't use it in production. |
| `OPS_ADDRESS`         | both               | Ops wallet address. Dry runs only need this, not the key. |
| `OPS_PRIVATE_KEY`     | both, `--execute`  | Must control `OPS_ADDRESS`. If it doesn't, the script refuses to run. |
| `PAYOUT_MAX_ROW_USDC` | payout (optional)  | Rejects the batch if any single row is above this. |
| `ETH_RPC_URL`         | sweep              | Dedicated Ethereum mainnet RPC. |
| `TREASURY_ADDRESS`    | sweep              | The real Ethereum treasury. The `0x1111…` placeholder is rejected. |
| `GAS_RESERVE_CELO`    | sweep              | CELO left behind for payout gas (see §4). |
| `L1_PRIVATE_KEY`      | sweep prove/finalize | Any Ethereum key with some ETH for gas. It never holds or receives the swept funds. |

Every command is a **dry run unless you pass `--execute`**. A dry run makes no
changes. It checks the chain ID, token contract, balances and bridge contracts,
and simulates each transaction against live state. `--execute` asks for a typed
confirmation phrase that includes the count and amount. For unattended runs,
pass the same phrase with `--confirm "<phrase>"`. A wrong phrase aborts the run.

---

## 2. Payouts (`payout.ts`)

CSV, header required, exactly three columns:

```csv
id,address,amount_usdc
2026-09-C1-000001,0x7B8B698c2c62640a43DD187777DAf8C82F03a424,125.50
2026-09-C1-000002,0x28A78E082510B2Bd4Eb92170Ea3D01156202AeF8,40
```

```bash
# 1. dry run: validates every row, simulates every transfer, prints the command for step 2
npm run payout -- payouts.csv

# 2. broadcast: count and total must come from finance's control sheet, not copied from step 1
npm run payout -- payouts.csv --execute --expect-count 2 --expect-total 165.50
```

What the script enforces:

- **Amounts:** exact decimal parsing with no floats. Max 6 decimals, because USDC
  has 6, not 18. Zero, negative, commas, `$` and `1e3` are all rejected.
- **Addresses:** must be valid and EIP-55-checksummed if mixed-case. Zero address,
  the ops wallet and the USDC contract are rejected. A repeated recipient needs
  `--allow-duplicate-addresses`.
- **`id` is the idempotency key.** Duplicate ids in a file are rejected.
- **Control totals:** `--execute` requires `--expect-count` and `--expect-total`
  that match the CSV.
- **Token:** checks the token on-chain before sending (`symbol == USDC`, `decimals == 6`).
- **Pre-flight simulation:** every transfer is simulated first. This catches
  Circle-blacklisted addresses, a paused token and insufficient balance before
  anything is sent. The script also checks the ops wallet has enough CELO for gas.
- **One at a time:** transfers are sent sequentially, each waits for its receipt,
  and the run **stops on the first failure**.
- **Crash-safe journal (`<csv>.journal.jsonl`):** each tx is signed and its
  hash and raw bytes are written to disk *before* broadcast. After a crash,
  Ctrl-C or RPC outage, run the **same command** again:
  - rows already mined are recognised as paid;
  - a tx still in flight is rebroadcast with the identical signed bytes (same
    hash and nonce, so it can't double-pay);
  - if the nonce was used by something else, the script stops and asks a human
    to check.

  Tested on a fork of Celo mainnet: killed mid-batch, restarted, every recipient
  paid exactly once.
- If someone edits the CSV mid-batch, the journal no longer matches it
  (sha256 check) and the script refuses to continue. Don't delete the journal.
  Put the unpaid rows in a new CSV.

Throughput: about 1–3 s per row (Celo has 1 s blocks), so 1,000 rows take
roughly 20–50 minutes.

---

## 3. Sweep (`sweep.ts`)

```bash
# Day 0, cycle close: initiate on Celo (ops key). Choose ONE amount mode:
npm run sweep -- initiate --amount 12345.67            # finance's revenue figure (preferred)
npm run sweep -- initiate --max                        # everything above GAS_RESERVE_CELO
# ...then re-run the chosen command with --execute
# → prints the Celo tx hash and writes sweeps/<hash>.json

# Day 0, ~1 hour later: prove on Ethereum (L1 key)
npm run sweep -- status <celoTxHash>                   # shows "ready-to-prove" and timing
npm run sweep -- prove  <celoTxHash> --execute

# Day 7+: finalize on Ethereum (L1 key). Treasury is credited here.
npm run sweep -- status   <celoTxHash>                 # "ready-to-finalize" + exact timestamp
npm run sweep -- finalize <celoTxHash> --execute       # prints treasury balance before → after
```

How it works: `initiate` calls `L2ToL1MessagePasser.initiateWithdrawal` on Celo
with the CELO as `value`, the treasury as target, and empty calldata. When the
withdrawal is finalized, Celo's L1 `OptimismPortal` (a custom-gas-token portal)
transfers **the CELO ERC-20 on Ethereum (`0x0578…b19f`)** to the treasury. I
checked this against the verified portal source.

- `initiate` checks before sending:
  - the bridge contracts point at each other as expected;
  - L1 gas-paying token == `0x0578…b19f`;
  - the portal is not paused;
  - the ops wallet has no pending txs;
  - enough CELO remains to cover the reserve and gas.

  It saves the signed tx before broadcasting.
- `prove` and `finalize` simulate against the live portal before spending L1 gas.
  Anyone can run them. `finalize` uses the proof already on-chain, so a
  different L1 key can finalize.
- Keep `sweeps/*.json`. Those files are the audit trail, and they're how you
  resume a sweep. Losing one is recoverable, because the Celo tx hash is on the
  explorer, but it's annoying.

---

## 4. What the operator must get right before real money

1. **Treasury address and token support.** Set `TREASURY_ADDRESS` to the real
   **Ethereum mainnet** address.
   - The treasury receives **CELO as an ERC-20 on Ethereum** (`0x057898f3C43F129a17517B9056D23851F124b19f`),
     not ETH and not native CELO.
   - A Safe or EOA can hold it.
   - **If the treasury is a custodian or exchange deposit address, confirm in
     writing that it supports CELO on Ethereum** at that contract, and credits
     deposits that come from the bridge contract. If not, funds may not be credited.
2. **Never "just send" CELO to the treasury address on Celo.** Only `sweep.ts` moves CELO to Ethereum.
3. **Run a small end-to-end test sweep first** (e.g. 1 CELO), including finalize,
   and confirm finance sees it in the treasury. It takes **about 7 days**, so start
   it at least one cycle before the first real close.
4. **Run a small test payout first:** one row, a few cents, to an address you control.
5. **Recipient addresses must be able to receive USDC on Celo.** Remittance
   recipients who give an exchange deposit address for "USDC" may have given
   an address on a different network. If the exchange doesn't support Celo
   USDC, the funds can be lost. This is a product/KYC control, not something the
   script can detect.
6. **Keep two balances funded in the ops wallet:**
   - USDC for payouts. The sweep never touches USDC.
   - CELO for gas. `GAS_RESERVE_CELO` must cover the next cycle's payout gas plus
     margin. The payout dry run prints the gas budget for a batch. Size the
     reserve at 3× your largest cycle.
   - A sweep with `--max` takes everything above the reserve. If the reserve is
     0, payouts stop.
7. **Revenue ≠ balance.** The ops wallet's CELO includes the gas float and any
   top-ups. Prefer `--amount <finance's revenue figure>` over `--max`.
8. **Don't run payout and sweep at the same time** from the same wallet. Both
   refuse to start with pending txs, but that check isn't a lock.
9. **Keys.**
   - `OPS_PRIVATE_KEY` is a hot key controlling all payout float. Move it to a
     KMS or HSM signer as soon as practical. The scripts only need a viem
     `Account`, so swapping in a custom account is a small change in `common.ts`.
   - `L1_PRIVATE_KEY` should be a separate low-value key holding only ETH for gas.
     For prove and finalize, budget roughly 400k + 300k gas at current Ethereum
     gas prices. Prove measured ≈367k gas.
10. **RPCs:** use paid, dedicated endpoints on both chains (see §1).
11. **Circle can freeze USDC** at any address, including ours. The dry run will
    surface it as a revert. There's no workaround in code.
12. **Bridge upgrades.** The bridge addresses are pinned in `common.ts`. If Celo
    upgrades the portal or dispute games, `sweep.ts` will refuse to run.
    Re-verify the addresses against the superchain-registry
    (`superchain/configs/mainnet/celo.toml`) and on-chain before updating.

---

## 5. Cash-flow timing (for the finance close)

**Payouts:** USDC reaches recipients within seconds of each tx (Celo has 1 s
blocks). A batch completes in minutes. The ops wallet must be pre-funded with
the full batch in USDC before the run; the script refuses otherwise.

**CELO sweep to treasury:** these figures are read from the live contracts
(2026-09-21), and the script re-reads them on every run.

| Step | When | Who | Treasury impact |
|------|------|-----|-----------------|
| Initiate on Celo | Close day, T+0 | Ops | CELO leaves the ops wallet. **In transit**, not in the treasury. |
| Provable | T+~30–60 min. A new dispute game is posted about every 30 min (1,800 Celo blocks). | – | – |
| Prove on Ethereum | As soon as provable. **Every hour of delay pushes the credit date back an hour.** | Ops (L1 key) | – |
| Challenge window | 7 days from prove (`proofMaturityDelaySeconds = 604800`). The game also needs 3.5 d to resolve plus a 3.5 d finality delay, which completes around the same time. | – | – |
| Finalize on Ethereum | T+7 days +~1 h, at the earliest | Ops (L1 key) | **Treasury credited** with L1 CELO. |

Planning rules of thumb:

- **CELO revenue for a cycle closed on day D is in the treasury on D+7 at the
  earliest**, and only if someone runs `prove` on day D and `finalize` on D+7.
  Put both on the close calendar. `status` prints the exact finalize timestamp.
- **Between initiate and finalize the funds are in neither wallet.** Book them as
  "CELO in transit (canonical bridge)", and reconcile against `sweeps/*.json`.
- **Price exposure.** The *amount* of CELO is fixed at initiate. Its USD value moves
  for about 7 days. If finance needs the USD value locked at close, that's a
  treasury-policy decision (e.g. convert on Celo at close and move a stablecoin
  instead). The canonical CELO bridge can't make it faster.
- **Possible delays:**
  - if a dispute game is challenged, its proving window can add up to a day
    (`maxProveDuration = 86400`);
  - if the portal is paused, everything waits.

  Treat D+7 as a floor, not a promise, and don't schedule treasury outflows
  against in-transit CELO.
- Fast third-party bridges exist. They trade the 7-day wait for counterparty
  risk, and often deliver a *different* wrapped CELO token. They're deliberately
  not used here.

---

## 6. Pinned addresses (verified on-chain 2026-09-21)

| What | Chain | Address |
|------|-------|---------|
| USDC (native, Circle), 6 decimals | Celo 42220 | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| L2ToL1MessagePasser (predeploy) | Celo | `0x4200000000000000000000000000000000000016` |
| OptimismPortal (proxy) | Ethereum | `0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC` |
| DisputeGameFactory | Ethereum | `0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683` |
| SystemConfig | Ethereum | `0x89E31965D844a309231B1f17759Ccaf1b7c09861` |
| CELO ERC-20 (gas-paying token, what the treasury receives) | Ethereum | `0x057898f3C43F129a17517B9056D23851F124b19f` |

## 7. How this was tested (nothing broadcast to a live network)

- Typecheck: `npm run typecheck`.
- Dry runs against live Celo and Ethereum: payout validation and simulation,
  sweep pre-flight, placeholder and reserve rejections.
- `payout.ts --execute` on an **anvil fork of Celo mainnet**: normal run, re-run
  (no-op), edited-CSV refusal, and three crash/restart scenarios. Every recipient
  was paid exactly once.
- `sweep.ts initiate --execute` on the fork: withdrawal event targets the
  treasury, state file written, `status` reports the prove ETA.
- Prove path against the **real** L1 portal: built a proof for an existing,
  unproven Celo withdrawal. The portal's gas estimate accepted it, which
  exercises the game lookup and proof code for Celo's current dispute game type.
- **Not testable without a real 7-day withdrawal:** the finalize tx itself. That's
  why the small end-to-end test sweep in §4.3 is mandatory.

# Remittance ops: payouts and the end-of-cycle CELO sweep

Two tools:

| Script | Chain(s) | What it does |
|---|---|---|
| `payout.ts` | Celo | Pays USDC from the ops wallet to every row of a CSV |
| `sweep.ts` | Celo → Ethereum | Moves the cycle's CELO from the ops wallet to the mainnet treasury through Celo's official bridge |

Both scripts only simulate unless you pass `--execute`. Both keep a journal file, so running them again after a crash never pays twice.

---

## TL;DR for finance

- **Payouts settle in seconds.** Once `payout.ts` prints a row, the recipient has the USDC.
- **The sweep takes about 7 days and 1 hour in the best case, not minutes.** Celo is an OP Stack L2 on Ethereum; it stopped being its own L1 in March 2025. Moving funds from Celo to Ethereum through the official bridge means proving the withdrawal on Ethereum and then waiting out a **7-day** proof-maturity window. The contract enforces this; nobody can speed it up. Plan the close on the basis that **CELO swept at cycle end is in the treasury about 8 days later.**
- **The treasury receives CELO as an ERC-20 token on Ethereum** (`0x057898f3C43F129a17517B9056D23851F124b19f`), not ETH and not USD. If finance wants ETH or dollars in the treasury, that is a separate swap after the funds arrive.
- **The CELO price moves while funds are in transit.** The USD value booked at cycle close will not equal the USD value that lands. For those ~8 days the funds sit in Celo's bridge contracts. The withdrawal hash in `sweep.journal.json` is the audit record.
- **The swept amount is net of gas.** The ops wallet pays gas for payouts in CELO out of the same CELO balance that revenue lands in, and the sweep leaves a fixed reserve behind for the next cycle's gas. What lands in the treasury = CELO revenue − CELO spent on gas − change in the reserve.

### Timeline for one cycle

| When | Step | Who / what | Result |
|---|---|---|---|
| Before cycle close | `payout.ts` for the cycle's CSV(s) | Ops, Celo | Recipients paid, final within seconds |
| T0 = cycle close | `sweep.ts initiate` | Ops key, Celo | CELO leaves the ops wallet and is in transit |
| T0 + ~30–60 min | `sweep.ts prove` | L1 key, Ethereum | Proof submitted. **The 7-day clock starts now**, not at T0 |
| prove + 7 days | `sweep.ts finalize` | L1 key, Ethereum | CELO ERC-20 lands in the treasury |

Running `sweep.ts status --cycle <id>` at any time prints the current stage and the exact time the next step becomes possible.

**Things that can make it later:**
- The operator runs `prove` late. The 7-day window only starts once `prove` is run, so a late `prove` pushes the arrival date back by the same amount. **Put `prove` on the calendar for about an hour after `initiate`.**
- The operator runs `finalize` late. Nothing happens on its own; the funds wait until someone runs it.
- Celo's security council pauses the bridge, or the dispute game used for the proof is invalidated. In the second case you run `prove` again, which **restarts the 7-day clock**. `status` shows both.

L2Beat lists Celo's withdrawal delay as 3.5 days. That is out of date. On-chain on 2026-09-21, `OptimismPortal.proofMaturityDelaySeconds()` returned `604800` (7 days), and the portal enforces that value. The scripts read it live rather than hard-coding it.

---

## Setup

```bash
npm ci                     # uses the committed package-lock.json (viem 2.56.8 pinned)
npm run typecheck
```

Node 20+. Configure these environment variables through your secrets manager, not a checked-in `.env`:

| Var | Used by | Notes |
|---|---|---|
| `CELO_RPC_URL` | both | Use a **paid/dedicated** Celo mainnet RPC. The public `https://forno.celo.org` rate-limits and occasionally drops receipt lookups (we hit both while testing). |
| `ETH_RPC_URL` | sweep | Ethereum mainnet RPC |
| `OPS_PRIVATE_KEY` | payout, sweep initiate | The ops wallet. Controls all USDC and CELO on Celo. |
| `L1_PRIVATE_KEY` | sweep prove/finalize | Any Ethereum account holding a little ETH for gas. See "Keys" below. |
| `MAX_PAYOUT_USDC` | payout | Largest amount any single row may pay. Catches unit mistakes such as cents exported as dollars. |
| `TREASURY_ADDRESS` | sweep initiate | The **Ethereum mainnet** treasury. The script refuses to run while this is still the `0x1111…` placeholder. |
| `SWEEP_RESERVE_CELO` | sweep initiate | CELO left in the ops wallet to pay the next cycle's payout gas |
| `PAYOUT_JOURNAL` / `SWEEP_JOURNAL` | optional | Journal paths. Defaults: `payouts.journal.json`, `sweep.journal.json` |

---

## Running payouts

CSV format (a header row is required; columns can be in any order; plain comma-separated with no quoted fields):

```csv
payout_id,address,amount_usdc
RMT-2026-09-0001,0x70997970C51812dc3A010C7d01b50e0d17dc79C8,125.50
```

- `payout_id`: your internal ID for the remittance. **It must be globally unique, forever.** It is the key that prevents double payment across runs and across CSV files.
- `address`: the recipient's address on Celo. Mixed-case addresses must have a valid EIP-55 checksum.
- `amount_usdc`: a plain decimal in dollars, e.g. `125.50`. At most 6 decimal places, no thousands separators.

```bash
# 1. Dry run: validates every row, checks balances, simulates every transfer
npx tsx payout.ts sept-batch-1.csv

# 2. Send. --expect-total must equal the USDC total the dry run reported under "To pay now".
npx tsx payout.ts sept-batch-1.csv --execute --expect-total 1165.500001
```

How it runs:
- Transfers go out one at a time, and each is confirmed before the next is sent.
- It stops at the first failure.
- Rows already confirmed in the journal are skipped, so running the same CSV again after an interruption is the correct way to resume.

It refuses to start if any of these are true:
- A row fails validation: bad checksum, zero address, the USDC contract as recipient, the ops wallet as recipient, zero amount, amount over `MAX_PAYOUT_USDC`, or a duplicate `payout_id`.
- A `payout_id` already in the journal appears with a different address or amount.
- The ops wallet doesn't hold enough USDC or CELO.
- Any transfer fails simulation, for example because Circle has blocklisted the recipient.
- The ops wallet has pending transactions that the journal doesn't know about.

It warns but continues when one address appears on more than one row.

---

## Running the sweep

```bash
CYCLE=2026-09

# Right after the cycle's payouts are done:
npx tsx sweep.ts initiate --cycle $CYCLE                                   # dry run: shows amount, destination, ETA
npx tsx sweep.ts initiate --cycle $CYCLE --execute --confirm-to 0xTREASURY # --confirm-to must repeat TREASURY_ADDRESS

npx tsx sweep.ts status --cycle $CYCLE      # at any time

# ~30-60 min later, when status says ready-to-prove:
npx tsx sweep.ts prove --cycle $CYCLE --execute

# 7 days after proving, when status says ready-to-finalize:
npx tsx sweep.ts finalize --cycle $CYCLE --execute
```

- **Amount.** By default it sweeps the ops wallet's CELO balance, minus `SWEEP_RESERVE_CELO`, minus gas. Use `--amount <CELO>` to sweep a specific figure instead, such as the revenue number from your books. It can never go below the reserve.
- **One sweep per cycle.** A second `initiate` for the same `--cycle` is refused.
- **Order matters.** Run payouts **before** the sweep. The sweep leaves only the reserve behind, and payouts need CELO for gas.
- **Destination checks.** Before initiating, the script confirms on-chain that Celo's `SystemConfig` still points at the portal, dispute-game factory and CELO token hard-coded below. It refuses if the destination is the placeholder, the zero address, or one of the bridge contracts; the bridge would reject those at the Ethereum end, which would leave the funds stuck. It also prints whether the treasury address is a contract (e.g. a Safe) or a plain EOA on Ethereum.

---

## What the operator must get right before this touches real money

**Irreversible, so read these twice:**

1. **The treasury address.** A withdrawal can't be cancelled or redirected once `initiate` is sent. `TREASURY_ADDRESS` must be an address **you control on Ethereum mainnet** that can hold and move ERC-20 tokens:
   - an EOA whose key you hold, or
   - a Safe (or other contract wallet) **deployed on Ethereum mainnet**.

   Do **not** use an exchange deposit address unless that exchange credits the Ethereum CELO ERC-20 (`0x0578…b19f`) sent in a contract-internal transfer. Many exchanges don't, and the funds would be lost.
2. **Recipient addresses are addresses on Celo.** If a customer gives an exchange deposit address, that exchange must support **USDC on the Celo network**. Otherwise the USDC arrives on a chain the exchange doesn't watch, and recovering it depends on the exchange's goodwill. On-chain the transfer looks successful, so no script can detect this.
3. **Use native USDC only.** The ops wallet must be funded with Circle's native USDC on Celo, `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` (6 decimals). Bridged variants such as USDC.e and Wormhole USDC are different tokens, and the script neither sees nor spends them.
4. **Do a small end-to-end rehearsal first.** Pay a 1-USDC row to an address you control. Then sweep a small `--amount` (e.g. 1 CELO) all the way to the real treasury. The sweep rehearsal takes a full 7 days; start it before the first real cycle close.

**Keys:**

5. `OPS_PRIVATE_KEY` is a hot key that controls all payout float and revenue on Celo. Keep it in a secrets manager or HSM, give it to as few people as possible, and hold only one cycle's float in it. To move to KMS or HSM signing, swap `privateKeyAccount()` in `common.ts` for a viem custom account; nothing else changes.
6. `L1_PRIVATE_KEY` only pays Ethereum gas for `prove` (~380k gas) and `finalize`. **It cannot redirect funds**, because the destination was fixed at `initiate`. Give it a small amount of ETH and nothing else. Use the same L1 key for both steps.

**Operational:**

7. **The journals are the double-payment protection.** Keep `payouts.journal.json` and `sweep.journal.json`, back them up, and never edit or delete entries casually.
   - Run the scripts from **one machine and one working directory**.
   - The `.lock` file stops two runs happening at once. If a run crashes, it leaves the lock behind. Delete it only after confirming nothing else is running.
   - Before sending, each transaction is signed and saved to the journal. If a run dies at any point, running the same command again reconciles that exact signed transaction instead of creating a new one.
8. **Nothing else may send from the ops wallet while a script runs.** The scripts refuse to start if the wallet has pending transactions they don't know about.
9. **Pin dependencies.** Install with `npm ci` from the committed lockfile. Review viem upgrades before taking them, since the sweep relies on viem's OP Stack actions.
10. **Sizing `SWEEP_RESERVE_CELO`.** A USDC transfer on Celo costs a fraction of a cent. The payout dry run prints `Est. max gas cost` for the batch; set the reserve comfortably above the largest cycle you expect.

### Failed or conflicting payouts

If a payout row ends up `reverted` or `nonce-conflict`, the script refuses to run until a person resolves it:

- **`reverted`**: the transaction was mined but failed, so no USDC moved. Find the cause on Celoscan (for example, a recipient blocklisted between simulation and sending). Then **delete that payout's `tx` field** from the journal to allow a retry, or move the row to an exceptions process.
- **`nonce-conflict`**: some other transaction used the nonce our signed transaction was waiting for. Usually someone sent from the ops wallet by hand. Check on Celoscan whether that other transaction paid this recipient. Only if it did **not** should you delete the `tx` field and rerun.

### Stuck transactions

If a transaction isn't mined within 3 minutes, the script stops, and the transaction stays in the journal as `signed`. Running the same command again re-broadcasts the **same** signed bytes, which is safe. Don't send a replacement transaction by hand with the same nonce: the journal would mark that row `nonce-conflict`, and you'd have to reconcile it manually.

---

## Verified constants (checked on-chain 2026-09-21)

| What | Address | How verified |
|---|---|---|
| USDC on Celo (native) | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | `symbol()`=USDC, `decimals()`=6 |
| L2ToL1MessagePasser (Celo) | `0x4200000000000000000000000000000000000016` | OP Stack predeploy |
| OptimismPortal (Ethereum) | `0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC` | `SystemConfig.optimismPortal()`; `version()`=5.1.1 |
| DisputeGameFactory (Ethereum) | `0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683` | `SystemConfig.disputeGameFactory()` |
| SystemConfig (Ethereum) | `0x89E31965D844a309231B1f17759Ccaf1b7c09861` | `isCustomGasToken()`=true |
| CELO ERC-20 (Ethereum) | `0x057898f3C43F129a17517B9056D23851F124b19f` | `SystemConfig.gasPayingToken()` |

How native CELO leaves Celo: `sweep.ts` calls `L2ToL1MessagePasser.initiateWithdrawal(treasury, 100000, 0x)` and sends the CELO as the call's value. Celo's docs specify this route. On finalize, Celo's portal (`celo-org/optimism`, branch `celo-contracts/v5.0.0`, `finalizeWithdrawalTransactionExternalProof`) does `IERC20(celoToken).safeTransfer(target, value)`. It reverts if the target is the token or the portal itself.

`sweep.ts` re-checks the portal, dispute-game factory and token against `SystemConfig` every time it runs, and stops if any has changed. Re-verify this table whenever Celo announces a hard fork.

---

## What was tested and what wasn't

Nothing here was broadcast to a real network. The testing covered:

- **`payout.ts`**, end to end on an anvil fork of Celo mainnet. Checked:
  - dry run
  - a wrong `--expect-total` is rejected, including one that is off by only 0.000001
  - the batch executes and recipient balances come out exactly right
  - running it again is a no-op
  - crash recovery: a transaction signed and journaled but never broadcast is re-broadcast on the next run and pays exactly once
  - `payout_id` reuse with a different amount is rejected
  - bad checksum, comma-formatted amount, more than 6 decimals, amount over the cap, duplicate ID, zero amount and USDC-contract recipient are all rejected
- **`sweep.ts initiate` and `status`**, with the L2 transaction on the anvil fork and read-only checks against real Ethereum mainnet:
  - the placeholder treasury and the token address as target are both rejected
  - `--confirm-to` is required
  - amount and reserve arithmetic
  - a repeat `initiate` for the same cycle is refused
  - `status` correctly reports `waiting-to-prove` with an ETA
  - `prove` and `finalize` refuse to run early
- **Proof building for `prove`**, against a real Celo withdrawal: `eth_estimateGas` on the live Ethereum portal succeeded (~376k gas). This confirms viem's proof building works with Celo's dispute game type 42.
- **Not exercised end to end: `finalize`.** It needs a withdrawal that has passed its 7-day maturity. It uses viem's standard `finalizeWithdrawal` with the proof submitter read from the portal, and it simulates (estimates gas) before sending. The small-amount rehearsal in item 4 above is where it gets its first real run. Do that before the first real cycle.

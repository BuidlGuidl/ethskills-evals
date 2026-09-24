# Remittance ops tooling: payouts on Celo, CELO sweep to the mainnet treasury

## Read this first: the sweep is a 7-day bridge withdrawal

Celo has been an Ethereum L2 (OP Stack) since March 2025. To get CELO from the ops
wallet on Celo into the treasury on Ethereum mainnet, it has to go through Celo's
canonical bridge:

| Step | Chain | Signed by | When |
|---|---|---|---|
| 1. `initiate` | Celo | ops wallet | at cycle close |
| 2. `prove` | Ethereum | any L1 key with ETH | ~30–60 min later, once a dispute game covers the block |
| 3. `finalize` | Ethereum | **the same L1 key that proved** | 7 days after `prove` |

A few things follow from that:

- **Do not "just send" the CELO to the treasury address on Celo.** That leaves it on
  Celo. If the treasury is a Safe or other contract that exists only on mainnet, no one
  controls that address on Celo and the funds are lost. `sweep.ts` never does this.
- **The treasury receives CELO as an ERC-20 on Ethereum**
  (`0x057898f3C43F129a17517B9056D23851F124b19f`, "Celo native asset", 18 decimals). It
  does **not** receive ETH or USDC. Finance should add that token to the treasury's
  tracking and custody setup. EOAs and Safes can both receive it: the portal does a
  plain `transfer()` and makes no call to the treasury.
- **Two steps are on Ethereum mainnet**, so someone needs an Ethereum key with ETH for
  gas (see "Keys").

If finance actually wants USD or ETH value in the treasury rather than CELO tokens, the
bridge is the wrong tool. The better route is to sell CELO for USDC on Celo and move
USDC through Circle CCTP, or to use a centralized exchange. That's a separate decision
and isn't implemented here.

---

## Setup

```bash
npm install
npm run typecheck
```

Use Node 22.6 or newer. The scripts run through `tsx`.

### Environment

| Var | Used by | Notes |
|---|---|---|
| `CELO_RPC_URL` | both | Celo mainnet (42220). Use a paid or dedicated provider in production. `https://forno.celo.org` works but is rate-limited. |
| `ETH_RPC_URL` | sweep | Ethereum mainnet (1). |
| `OPS_PRIVATE_KEY` | payout, sweep initiate | Needed only with `--send`. |
| `OPS_ADDRESS` | payout, sweep initiate | Used in dry runs when no key is set. |
| `PAYOUT_MAX_PER_RECIPIENT_USDC` | payout | Hard cap per row, e.g. `5000`. |
| `PAYOUT_MAX_TOTAL_USDC` | payout | Hard cap per CSV, e.g. `250000`. |
| `TREASURY_ADDRESS` | sweep | Checksummed mainnet treasury. The script refuses the `0x1111…` placeholder. |
| `SWEEP_CELO_GAS_RESERVE` | sweep initiate | CELO left in the ops wallet for next cycle's gas, e.g. `20`. |
| `L1_PRIVATE_KEY` | sweep prove/finalize | Ethereum key used only to pay gas. It never holds the swept funds. |
| `L1_ADDRESS` | sweep prove/finalize | Used in dry runs when no key is set. |

**Every command is a dry run unless you pass `--send`.** Dry runs read chain state and
simulate every transaction, so run one first, every time.

---

## payout.ts: USDC payouts on Celo

```bash
npx tsx payout.ts --csv cycle-2026-09.csv          # validate and simulate every transfer
npx tsx payout.ts --csv cycle-2026-09.csv --send   # broadcast
```

The CSV needs the header `address,amount`, one recipient per line, and amounts in whole
USDC with at most 6 decimals (`125.50`). Quoting isn't supported. Lines starting with
`#` are ignored. See `recipients.example.csv`.

The script **rejects the whole file**, sending nothing, if any row has:

- a malformed address, or a mixed-case address with a bad checksum
- the zero address, the USDC contract, or the ops wallet as recipient
- an amount that is non-numeric, zero, has more than 6 decimals, or exceeds the per-row cap
- a duplicate recipient (override with `--allow-duplicate-recipients`)

It also rejects the file if the total exceeds `PAYOUT_MAX_TOTAL_USDC`.

Before sending it also checks:

- The RPC really is chain 42220.
- The token is `USDC` with 6 decimals.
- The wallet has enough USDC and enough CELO for gas.
- The ops wallet has no pending transactions.
- Every transfer succeeds in simulation. This catches recipients blacklisted by Circle,
  a paused token, and similar problems.

**Crash safety.** Each transfer is signed and its hash is written to
`payout-journal/<sha256-of-csv>.jsonl` before it's broadcast. Transfers go out one at a
time, and each waits for its receipt. If the run dies partway through, re-run the same
command: rows that were already paid are skipped. If a row was signed but has no receipt
yet, the script stops and asks a human rather than signing it again.

- **Never edit a CSV after a partial run.** The journal is keyed by the file's hash, so
  an edited file looks like a new payout, and every row that was already paid would be
  paid again. To pay the remainder, build a new CSV with only the unpaid rows. The
  journal and the explorer tell you which rows those are.
- Keep `payout-journal/` for the audit trail. It is git-ignored.

### What the operator must get right for payouts

1. **The token is native USDC**, `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`. It's not
   USDC.e or other bridged USDC. Fund the ops wallet with this token, and make sure
   recipient wallets and exchanges credit native USDC on Celo.
2. **Recipient addresses must be Celo addresses the recipient controls.** A deposit
   address from an exchange that doesn't support Celo USDC means lost or stuck funds.
   Check new recipients with a small test payout first.
3. **The ops wallet pays gas in CELO.** One transfer costs a tiny fraction of a CELO,
   but the wallet has to hold some CELO. This is why the sweep keeps a reserve.
4. **Don't run payouts and the sweep at the same time.** They share the wallet and its
   nonce. Run the payouts first, then the sweep.

---

## sweep.ts: CELO revenue to the mainnet treasury

```bash
# At cycle close (Celo):
npx tsx sweep.ts initiate --cycle 2026-09                 # dry run: shows amount and ETA
npx tsx sweep.ts initiate --cycle 2026-09 --send

# About an hour later (Ethereum):
npx tsx sweep.ts status   --cycle 2026-09
npx tsx sweep.ts prove    --cycle 2026-09 --send

# 7 days after prove (Ethereum, SAME L1 key):
npx tsx sweep.ts status   --cycle 2026-09
npx tsx sweep.ts finalize --cycle 2026-09 --send
```

`--tx <celo tx hash>` works instead of `--cycle` if the state file is lost.

- **Amount.** By default the script sweeps the CELO balance minus
  `SWEEP_CELO_GAS_RESERVE`. If finance has a specific revenue figure, pass
  `--amount <CELO>`. The script refuses any amount that would take the balance below the
  reserve.
- **One sweep per cycle.** `initiate` writes `sweep-state/<cycle>.json` before it
  broadcasts and refuses to run again for the same cycle. Keep this directory. It's
  git-ignored, so archive it along with the cycle records.
- **Checks on every run.** The script re-checks the bridge wiring on-chain: the portal's
  SystemConfig, its dispute game factory, that the L1 gas-paying token is still L1 CELO,
  and that the portal isn't paused. If Celo upgrades the bridge in a way that changes
  what arrives on L1, the script stops instead of guessing.
- **Treasury checks.** The script refuses the placeholder, the zero address, the L1 CELO
  token, and the portal as treasury. The portal rejects those last two as targets, which
  would strand the withdrawal permanently. It also prints whether the treasury on L1 is
  an EOA or a contract, so you can confirm it's the address you expect.
- **Same key for prove and finalize.** The portal records who proved the withdrawal.
  `finalize` has to come from that key, or be given `--proof-submitter <prover>`. The
  state file records the prover, and `status` reads it from the chain.
- **Anyone can prove or finalize.** Neither step can redirect the funds, because the
  target is fixed at `initiate`. If the L1 key is unavailable, a different key can
  re-prove, but that restarts the 7-day clock.

### What the operator must get right before the sweep touches real money

1. **Replace the placeholder with the real `TREASURY_ADDRESS`, and verify it
   independently.** Check it against the treasury's Safe UI or custody records, not a
   chat message. The target is fixed permanently at `initiate`. A wrong address can't be
   corrected afterwards.
2. **Make sure the treasury can hold an ERC-20 on Ethereum**, and that the custodian or
   Safe will show L1 CELO (`0x0578…b19f`).
3. **Fund an L1 key with ETH.** Measured on 2026-09-21 at about 1.2 gwei: `prove` costs
   about 376k gas (about 0.0005 ETH), and `finalize` should cost roughly 150–250k gas. That figure is an estimate; I didn't measure it. Keep
   **0.01 ETH** on that key to cover gas spikes.
4. **Set a sensible `SWEEP_CELO_GAS_RESERVE`**, enough CELO for a full payout cycle plus
   margin. A few CELO covers thousands of transfers at current fees. `payout.ts` prints
   its worst-case gas figure, which you can use to size the reserve.
5. **Put someone on the calendar for day 7.** Nothing finalizes automatically.
   Withdrawals don't expire, but the money isn't in the treasury until someone runs
   `finalize`.
6. **Do one small end-to-end sweep first** (for example `--amount 1`) through all three
   steps before sweeping real revenue.

---

## Cash-flow timing (for finance)

Timings below were measured from Celo's live L1 contracts on 2026-09-21:
`proofMaturityDelaySeconds` = 604800 (7 days), `disputeGameFinalityDelaySeconds` =
302400 (3.5 days), game `maxChallengeDuration` = 3.5 days, and a new dispute game about
every 30–40 minutes.

| T + | Event | Where the value sits |
|---|---|---|
| 0 | Cycle closes. Run payouts, then `sweep initiate`. | CELO leaves the ops wallet and is locked in the bridge. |
| ~0.5–1 h | Dispute game covers the block. Run `prove`. | In transit. |
| ~3.5 d | Dispute game resolves, if unchallenged. | In transit. |
| ~7 d + 1 h | Proof matures and the game's 3.5-day air-gap has passed. Run `finalize`. | **L1 CELO lands in the treasury.** |

**Plan the close on T+7 days, plus however long it takes someone to run `finalize`.**

- **The funds are at risk while in transit, and the amount is fixed in CELO.** The
  treasury receives exactly the number of CELO that left the ops wallet. Bridge gas is
  paid separately, in CELO on Celo and in ETH on L1. The USD value will move with the CELO price
  over those 7 days. Finance should book the transfer at the CELO quantity and mark it
  to market on arrival, or hedge.
- **Possible delays:**
  - If the dispute game the withdrawal was proven against is successfully challenged,
    the proof becomes invalid. `status` flags this. Re-prove against a newer game, which
    restarts the 7 days.
  - If the portal is paused for Celo or Superchain incident response, nothing can be
    initiated, proven, or finalized until it's unpaused.
  - Nothing happens until an operator runs each step.
- **The revenue figure is the CELO that left the ops wallet**, as shown in the
  `initiate` output and the state file. It is not the ops wallet's full balance: the
  reserve stays behind as working capital for gas.
- **Payouts are immediate.** USDC payouts settle on Celo within seconds of each
  transaction, so there's no float on the payout side.

---

## Verifying the hard-coded addresses

All addresses are in `common.ts`. They were checked on 2026-09-21 as follows:

- **Bridge addresses (portal, SystemConfig, DisputeGameFactory, L1 CELO token).** Listed
  in `ethereum-optimism/superchain-registry`, file
  `superchain/configs/mainnet/celo.toml`, then confirmed on-chain:
  `portal.systemConfig()`, `systemConfig.gasPayingToken()`, and
  `portal.disputeGameFactory()`. `sweep.ts` re-checks all three on every run.
- **Portal behavior.** The portal is implementation v5.1.1, source
  `celo-org/optimism@celo-contracts/v5.0.0`. On finalize it transfers the L1 CELO ERC-20
  to the target. It rejects the token and portal as targets.
- **Native USDC.** `symbol()` = `USDC` and `decimals()` = 6 on Celo. `payout.ts`
  re-checks this on every run.
- **viem OP Stack withdrawal helpers against Celo's dispute game type (42).** Tested
  read-only against a real in-flight Celo withdrawal: the proof was built and
  `proveWithdrawalTransaction` gas-estimated successfully against the live portal.

After any Celo network upgrade, re-run a dry run of each `sweep.ts` command before
sweeping.

## Keys

The scripts read raw private keys from env vars because that's the simplest thing that
works. For production:

- Hold the ops key in a KMS or HSM, or use a signer service. viem accepts custom
  `Account` implementations, so only `opsAccountOrAddress()` / `l1Account()` need to
  change.
- Keep a USDC float in the ops wallet and top it up per cycle, rather than parking the
  treasury there.
- The L1 key only ever holds a little ETH for gas.

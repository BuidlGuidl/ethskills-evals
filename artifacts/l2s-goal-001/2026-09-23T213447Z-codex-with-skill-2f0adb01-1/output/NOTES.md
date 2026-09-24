# Ops Tooling Notes

## Install

```bash
npm install
```

Both scripts are dry-run by default. They only broadcast when `BROADCAST=true` is set.

## `payout.ts`

CSV columns:

```csv
recipient,amount,reference
0xabc...,12.34,invoice-123
```

Run a dry run:

```bash
CELO_RPC_URL=https://forno.celo.org \
PRIVATE_KEY=0x... \
PAYOUT_CSV=./payouts.csv \
npm run payout
```

Broadcast after reconciling the dry-run total against finance:

```bash
CELO_RPC_URL=https://forno.celo.org \
PRIVATE_KEY=0x... \
PAYOUT_CSV=./payouts.csv \
BROADCAST=true \
npm run payout
```

The script uses native Circle USDC on Celo at `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`, verifies `symbol=USDC` and `decimals=6`, checks total balance before sending, rejects duplicate recipients unless `ALLOW_DUPLICATES=true`, and sends transfers sequentially.

## `sweep.ts`

Celo is an OP Stack L2 using CELO as the custom gas token. Moving CELO from Celo to Ethereum mainnet is an optimistic withdrawal with three stages:

1. `initiate` on Celo: burns/locks the L2 CELO withdrawal and emits the withdrawal proof data.
2. `prove` on Ethereum mainnet: proves the L2 withdrawal once the output/game is available.
3. `finalize` on Ethereum mainnet: after the challenge period, releases ERC-20 CELO on mainnet to the treasury.

Dry-run the initiation:

```bash
CELO_RPC_URL=https://forno.celo.org \
ETHEREUM_RPC_URL=https://... \
PRIVATE_KEY=0x... \
TREASURY_ADDRESS=0x1111111111111111111111111111111111111111 \
npm run sweep
```

Broadcast initiation after replacing the placeholder treasury:

```bash
CELO_RPC_URL=https://forno.celo.org \
ETHEREUM_RPC_URL=https://... \
PRIVATE_KEY=0x... \
TREASURY_ADDRESS=0xREAL_TREASURY \
SWEEP_RESERVE_CELO=1 \
BROADCAST=true \
npm run sweep
```

The default sweep amount is `Celo balance - SWEEP_RESERVE_CELO`; override with `SWEEP_AMOUNT_CELO=123.45` for an exact amount. Keep enough CELO on Celo for future gas and operational recovery.

Check status:

```bash
CELO_RPC_URL=https://forno.celo.org \
ETHEREUM_RPC_URL=https://... \
SWEEP_STAGE=status \
WITHDRAWAL_TX_HASH=0x... \
npm run sweep
```

Prove and finalize. The L1 signer only pays Ethereum gas; it does not need to be the ops wallet.

```bash
CELO_RPC_URL=https://forno.celo.org \
ETHEREUM_RPC_URL=https://... \
L1_PRIVATE_KEY=0x... \
SWEEP_STAGE=prove \
WITHDRAWAL_TX_HASH=0x... \
BROADCAST=true \
npm run sweep

CELO_RPC_URL=https://forno.celo.org \
ETHEREUM_RPC_URL=https://... \
L1_PRIVATE_KEY=0x... \
SWEEP_STAGE=finalize \
WITHDRAWAL_TX_HASH=0x... \
BROADCAST=true \
npm run sweep
```

Add `WAIT=true` to `prove` or `finalize` if you want the command to wait until the stage becomes ready.

## Operator Checklist

- Replace `0x1111111111111111111111111111111111111111` with the real Ethereum mainnet treasury before `BROADCAST=true`; the script refuses to broadcast to the placeholder.
- Confirm `CELO_RPC_URL` returns chain ID `42220` and `ETHEREUM_RPC_URL` returns chain ID `1`.
- Confirm the ops wallet address printed by the scripts matches the approved wallet.
- For payouts, reconcile CSV row count, total USDC, and duplicate handling before broadcast.
- For payouts, keep CELO in the ops wallet for Celo gas.
- For sweeps, keep a CELO reserve on Celo; do not sweep the native balance to zero.
- For prove/finalize, fund the L1 signer with ETH for mainnet gas.
- Save transaction hashes and receipts in the close package.

## Close Timing

Payouts are ordinary Celo USDC transfers and should settle operationally as soon as Celo includes the transactions, subject to your internal confirmation policy.

The CELO sweep is not same-day final on Ethereum. Initiation happens on Celo first, then the withdrawal must become provable on Ethereum, then it must pass the OP Stack challenge period before finalization. Plan cash close around roughly a 7-day withdrawal window after proving, plus a short readiness delay before proving. Finance should treat the cycle revenue as "in transit" after initiation and as Ethereum-mainnet treasury cash only after `SWEEP_STAGE=finalize` succeeds.

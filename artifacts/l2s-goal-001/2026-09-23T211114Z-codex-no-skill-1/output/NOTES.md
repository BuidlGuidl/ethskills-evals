# Ops Remittance Tooling

These scripts are production-mainnet tools. They dry-run by default; `--execute` is the only mode that broadcasts transactions.

## Install

```bash
npm install
```

Set secrets in the operator shell, not in files:

```bash
export OPERATOR_PRIVATE_KEY=0x...
export CELO_RPC_URL=https://...
export ETH_RPC_URL=https://...
export TREASURY_ADDRESS=0x... # replace 0x1111111111111111111111111111111111111111
```

## Payout USDC On Celo

CSV format:

```csv
recipient,amount
0xRecipient...,12.34
```

Dry-run validation:

```bash
npm run payout -- --csv payouts.csv
```

Broadcast:

```bash
npm run payout -- --csv payouts.csv --execute
```

The script checks it is connected to Celo mainnet, reads native USDC at `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`, validates 6-decimal amounts, checks aggregate balance, simulates each `transfer`, and then submits transfers sequentially.

## Sweep CELO To Ethereum Mainnet

Celo is now an OP Stack L2. Moving CELO to Ethereum mainnet is a bridge withdrawal with three transactions over time:

```bash
npm run sweep -- initiate --amount 123.45
npm run sweep -- initiate --amount 123.45 --execute

npm run sweep -- status --initiate-tx 0x...

npm run sweep -- prove --initiate-tx 0x...
npm run sweep -- prove --initiate-tx 0x... --execute

npm run sweep -- finalize --initiate-tx 0x...
npm run sweep -- finalize --initiate-tx 0x... --execute
```

To sweep most of the wallet while leaving CELO behind for Celo gas:

```bash
npm run sweep -- initiate --max --reserve 1 --execute
```

The script refuses to execute while `TREASURY_ADDRESS` is the placeholder. The same ops key is expected to prove and finalize on Ethereum; it must have ETH for those L1 gas transactions. If a different address submitted the proof, pass it to finalize with `--proof-submitter 0x...`.

## Operator Checklist

- Confirm the payout CSV is final: no duplicate accidental recipients, no scientific notation, no exchange deposit addresses without memos handled out of band.
- Confirm the ops wallet address printed by the script is the intended production wallet.
- Confirm `CELO_RPC_URL` returns chain id `42220` and `ETH_RPC_URL` returns chain id `1`.
- Confirm native Celo USDC is intended, not bridged or legacy USDC.
- Confirm the ops wallet has enough USDC for payouts and enough CELO for Celo gas.
- Confirm the treasury address is the real Ethereum mainnet CELO treasury before any sweep.
- Confirm the ops wallet has ETH on Ethereum mainnet before `prove` and `finalize`.
- Keep transaction hashes in the close packet.

## Cash-Flow Timing

Payouts settle on Celo after each transfer confirms.

CELO sweeping is not same-block cash movement to Ethereum. First, `initiate` locks or burns the CELO on Celo and creates the withdrawal. Then the withdrawal must become ready to prove on Ethereum. After `prove`, the bridge finalization window must elapse before `finalize` releases CELO to the Ethereum treasury.

Use `status` after the initiate transaction to get the current phase and estimated readiness timestamps. Finance should plan close around finalization, not initiation: the CELO is only in the Ethereum treasury after the `finalize` transaction confirms on Ethereum.

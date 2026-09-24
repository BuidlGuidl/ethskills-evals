# Remittance Ops Tooling

## Install

```bash
npm install
```

Create an env file or export variables in the shell that runs the scripts:

```bash
OPS_PRIVATE_KEY=0x...
CELO_RPC_URL=https://forno.celo.org
ETH_RPC_URL=https://your-mainnet-rpc.example
MAINNET_TREASURY=0x1111111111111111111111111111111111111111
```

`OPS_PRIVATE_KEY` must be the Celo ops wallet key. The same key is used for the Ethereum proof/finalize transactions, so that address also needs enough ETH on mainnet to pay L1 gas.

## Payouts

CSV format:

```csv
recipient,amount
0xabc...,12.34
0xdef...,100
```

Run a dry run first. It validates the CSV, checks the Celo RPC chain ID, reads native USDC metadata, checks the ops wallet USDC balance, and simulates every ERC-20 transfer.

```bash
npm run payout -- --csv recipients.csv
```

Broadcast only after reconciling the dry-run total against the approved payout batch:

```bash
npm run payout -- --csv recipients.csv --execute
```

The default token is Circle's native USDC on Celo:

```text
0xcebA9300f2b948710d2653dD7B07f33A8B32118C
```

Override with `USDC_ADDRESS` only if finance and engineering intentionally choose a different asset. Do not mix native USDC with bridged USDC variants.

## CELO Sweep

Celo is an OP Stack L2. Sweeping native CELO from Celo to Ethereum mainnet is a withdrawal lifecycle, not a single same-chain transfer.

Start with a dry run:

```bash
npm run sweep -- initiate --all --reserve 0.1
```

Execute the Celo withdrawal:

```bash
npm run sweep -- initiate --all --reserve 0.1 --execute
```

Track the withdrawal:

```bash
npm run sweep -- status --tx 0xL2_WITHDRAWAL_TX
```

When status is `ready-to-prove`, prove it on Ethereum:

```bash
npm run sweep -- prove --tx 0xL2_WITHDRAWAL_TX --execute
```

When status is `ready-to-finalize`, finalize it on Ethereum:

```bash
npm run sweep -- finalize --tx 0xL2_WITHDRAWAL_TX --execute
```

`sweep.ts` refuses to execute with the placeholder treasury. Set `MAINNET_TREASURY` to the real Ethereum mainnet treasury address before production use.

## Operator Checklist

- Confirm `CELO_RPC_URL` is Celo mainnet chain `42220` and `ETH_RPC_URL` is Ethereum mainnet chain `1`.
- Confirm the ops wallet address derived from `OPS_PRIVATE_KEY` is the funded production ops wallet.
- Confirm the payout CSV came from the approved finance batch and uses decimal USDC amounts, not raw integer units.
- Dry-run payouts and compare the printed total to the payout approval.
- Keep enough CELO in the ops wallet for Celo gas. For `--all`, choose a reserve that leaves operational gas after initiating the withdrawal.
- Keep enough ETH in the same signer address on Ethereum mainnet for the prove and finalize transactions.
- Confirm `MAINNET_TREASURY` before every sweep. The placeholder is blocked for execution.
- Record all payout transaction hashes, the Celo withdrawal transaction hash, the Ethereum prove hash, and the Ethereum finalize hash in the close package.
- Do a small production smoke transaction before the first full-value run or after any dependency/RPC/bridge change.

## Cash-Flow Timing

USDC payouts settle on Celo once each transfer transaction confirms.

CELO revenue sweeps are slower:

1. At cycle close, run `sweep initiate` on Celo. CELO leaves the ops wallet immediately on Celo, but it is not yet usable by the Ethereum treasury.
2. Wait until an L2 output/dispute game for the withdrawal is available, then run `sweep prove` on Ethereum. This is usually the next operational checkpoint, not instant treasury cash.
3. Wait through the OP Stack withdrawal finalization window. Finance should plan for roughly seven days before CELO is available in the Ethereum treasury.
4. Run `sweep finalize` on Ethereum. After this transaction confirms, the CELO has arrived at the mainnet treasury and can be included in the treasury close.

For finance reporting, treat the Celo initiation as "in transit" and the Ethereum finalize transaction as the cash receipt event.

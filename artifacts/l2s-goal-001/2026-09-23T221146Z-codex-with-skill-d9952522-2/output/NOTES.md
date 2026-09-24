# Remittance Ops Tooling

These scripts are production-mainnet tools. They default to dry runs and only
broadcast when `--execute` is present.

## Install

```sh
npm install
```

Required environment:

```sh
export OPS_PRIVATE_KEY=0x...
export CELO_RPC_URL=https://...
export ETHEREUM_RPC_URL=https://...
```

`ETHEREUM_RPC_URL` is only required for `sweep.ts`. `TREASURY_ADDRESS` can be
set in the environment or passed as `--treasury`; the code currently defaults to
the placeholder `0x1111111111111111111111111111111111111111`.

## Payout USDC on Celo

CSV format:

```csv
address,amount
0xabc...,12.34
0xdef...,50
```

Dry run:

```sh
npm run payout -- --csv recipients.csv
```

Broadcast:

```sh
npm run payout -- --csv recipients.csv --execute
```

The script pays Circle USDC on Celo at
`0xcebA9300f2b948710d2653dD7B07f33A8B32118C`. By default gas is paid in CELO.
To pay gas through the allowlisted USDC fee-currency adapter:

```sh
npm run payout -- --csv recipients.csv --fee-currency usdc --execute
```

## Sweep CELO Revenue to Ethereum

The sweep uses Celo's native OP Stack withdrawal path. This is not a single
instant transfer; it has three transactions across two chains.

1. Initiate on Celo:

```sh
npm run sweep -- initiate --amount 123.45 --treasury 0x1111111111111111111111111111111111111111 --execute
```

2. Check readiness:

```sh
npm run sweep -- status --initiate-tx 0x...
```

3. Prove on Ethereum when ready:

```sh
npm run sweep -- prove --initiate-tx 0x... --execute
```

4. Finalize on Ethereum when ready:

```sh
npm run sweep -- finalize --initiate-tx 0x... --execute
```

## Operator Checklist

- Confirm the RPCs are mainnet Celo chain `42220` and Ethereum chain `1`.
- Replace the placeholder treasury with the real Ethereum mainnet treasury.
- Confirm the ops wallet address printed by the script is the intended signer.
- For payouts, reconcile the CSV total against the approved payout batch and
  confirm USDC balance before broadcasting.
- For sweeps, leave enough CELO in the ops wallet for future Celo gas. The script
  requires an explicit `--amount` so operators do not accidentally drain the
  wallet.
- Keep the ops key off shared machines and prefer a production signer flow or
  hardware-backed operational wallet before this touches real money.
- Make sure the same initiate transaction hash is used for `status`, `prove`,
  and `finalize`.
- The ops wallet also needs ETH on Ethereum mainnet to pay the prove/finalize
  gas.

## Close Timing

Celo blocks are fast, so payouts generally settle as soon as the transfer
transactions confirm on Celo.

Revenue sweeps have bridge latency. The close starts with `initiate` on Celo,
then the withdrawal must become provable on Ethereum. After the prove
transaction, Celo's current native withdrawal path has a 7-day maturity gate
before finalization. Finance should plan for CELO to arrive in the Ethereum
treasury roughly one week after the prove transaction, plus operator time and
Ethereum gas conditions. Use `sweep.ts status` during close to read the current
prove/finalize readiness from the live bridge contracts.


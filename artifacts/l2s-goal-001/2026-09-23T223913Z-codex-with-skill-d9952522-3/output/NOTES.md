# Remittance Ops Tooling

These scripts are production-mainnet tooling. They default to dry-run mode and only broadcast when `--execute` or `EXECUTE=true` is supplied.

## Install

```bash
npm install
```

Required environment:

```bash
OPS_PRIVATE_KEY=0x...
CELO_RPC_URL=https://...
ETHEREUM_RPC_URL=https://...
TREASURY_ADDRESS=0x1111111111111111111111111111111111111111
```

Replace the placeholder treasury before any real sweep. The scripts refuse to execute with the placeholder unless `ALLOW_PLACEHOLDER_TREASURY=true` is set.

## Payout USDC on Celo

CSV format:

```csv
recipient,amount
0x2222222222222222222222222222222222222222,125.50
0x3333333333333333333333333333333333333333,19.000001
```

Run a dry-run:

```bash
npm run payout -- --csv payouts.csv
```

Broadcast after review:

```bash
npm run payout -- --csv payouts.csv --execute
```

The script sends native Circle USDC on Celo at `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`. Override with `CELO_USDC_ADDRESS` only if finance and custody have explicitly approved a different token.

## Sweep CELO Revenue to Mainnet

Celo is an Ethereum L2, so moving CELO to an Ethereum mainnet treasury is not a single send. It is an OP-stack withdrawal:

1. `start` on Celo initiates the withdrawal.
2. `prove` on Ethereum mainnet proves the withdrawal once Celo output data is available.
3. `finalize` on Ethereum mainnet releases CELO to the treasury after the finalization window.

Start a fixed amount:

```bash
npm run sweep -- start --amount 123.45 --execute
```

Or sweep the Celo wallet balance minus a reserve:

```bash
CELO_SWEEP_RESERVE=0.1 npm run sweep -- start --max --execute
```

Check readiness:

```bash
npm run sweep -- status --l2-tx 0x...
```

Prove when status is `ready-to-prove`:

```bash
npm run sweep -- prove --l2-tx 0x... --execute
```

Finalize when status is `ready-to-finalize`:

```bash
npm run sweep -- finalize --l2-tx 0x... --execute
```

## Operator Checklist

- RPC URLs must be Celo mainnet chain `42220` and Ethereum mainnet chain `1`.
- The ops private key must be the wallet that owns the Celo USDC and CELO revenue.
- The same ops address needs ETH on Ethereum mainnet for the prove and finalize transactions.
- The payout CSV must be reconciled against the approved payment batch before `--execute`.
- Confirm the token is native Celo USDC, not bridged USDC or USDC.e.
- Keep enough CELO on Celo for payout gas and the withdrawal initiation.
- Record every transaction hash in the close package.

## Close Timing

Payouts settle on Celo as normal Celo transactions. The CELO sweep does not land in the mainnet treasury at initiation time. Finance should plan for the withdrawal to become provable after Celo posts the needed output data, then for the optimistic-rollup finalization delay before `finalize` can be submitted. The current Celo path is roughly a week from proof to finalization; use `npm run sweep -- status --l2-tx 0x...` for the live chain-derived readiness estimate during close.

## References to Re-check Before Production Runs

- Celo L2 deployment and migration docs: https://docs.celo.org/operate/specification/deployments
- Celo L1 bridge contract addresses: https://docs.celo.org/tooling/contracts/l1-contracts#celo-mainnet
- Circle native USDC on Celo: https://www.circle.com/multi-chain-usdc/celo

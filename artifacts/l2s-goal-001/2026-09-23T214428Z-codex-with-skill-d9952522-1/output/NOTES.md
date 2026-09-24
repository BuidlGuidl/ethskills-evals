# Celo Ops Runbook

## Install

```bash
npm install
```

The scripts use `viem` against Celo mainnet (`42220`) and Ethereum mainnet (`1`). They dry-run unless `BROADCAST=true` or `--broadcast` is present, and they still refuse to send unless `CONFIRM_PRODUCTION=celo-mainnet`.

## Payouts

CSV headers can be `address,amount`, `recipient,amount`, or `to,amount`. Amounts are human USDC units.

```csv
address,amount
0x2222222222222222222222222222222222222222,12.34
```

Dry-run:

```bash
PRIVATE_KEY=0x... \
CELO_RPC_URL=https://forno.celo.org \
npm run payout -- --csv=recipients.csv
```

Broadcast:

```bash
PRIVATE_KEY=0x... \
CELO_RPC_URL=https://forno.celo.org \
BROADCAST=true \
CONFIRM_PRODUCTION=celo-mainnet \
npm run payout -- --csv=recipients.csv
```

Defaults: native Circle USDC on Celo is `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`. Override with `USDC_ADDRESS` only after finance/ops verifies the token contract. The script checks token symbol, decimals, duplicate recipients, total balance, and Celo chain id before sending.

## Revenue Sweep

This is a canonical Celo L2 to Ethereum L1 withdrawal. It is not a one-transaction transfer. The lifecycle is:

1. `initiate` on Celo: CELO leaves the ops wallet on Celo.
2. `prove` on Ethereum mainnet after the relevant Celo output/dispute game exists.
3. `finalize` on Ethereum mainnet after the portal finalization window has elapsed.

Set the real treasury before production:

```bash
export TREASURY_ADDRESS=0x1111111111111111111111111111111111111111
export PRIVATE_KEY=0x...          # Celo ops wallet
export L1_PRIVATE_KEY=0x...       # optional; defaults to PRIVATE_KEY
export CELO_RPC_URL=https://forno.celo.org
export ETHEREUM_RPC_URL=https://...
```

Dry-run initiate:

```bash
npm run sweep -- initiate
```

Broadcast initiate:

```bash
BROADCAST=true CONFIRM_PRODUCTION=celo-mainnet npm run sweep -- initiate
```

Track and complete:

```bash
npm run sweep -- status --tx=0xINITIATE_TX
BROADCAST=true CONFIRM_PRODUCTION=celo-mainnet npm run sweep -- prove --tx=0xINITIATE_TX
npm run sweep -- status --tx=0xINITIATE_TX
BROADCAST=true CONFIRM_PRODUCTION=celo-mainnet npm run sweep -- finalize --tx=0xINITIATE_TX
```

By default, `initiate` sweeps the Celo balance minus `SWEEP_RESERVE_CELO=1`. Set `SWEEP_AMOUNT_CELO` for an exact amount. The script still enforces the reserve unless `ALLOW_LOW_CELO_RESERVE=true` is set after ops approval. Keep enough CELO on Celo for future ops gas and enough ETH on Ethereum mainnet for the `prove` and `finalize` transactions.

## Operator Checklist

- Replace the placeholder treasury and remove `ALLOW_PLACEHOLDER_TREASURY` if it was used for rehearsal.
- Confirm the CSV came from the approved payout batch, has no duplicate or sanctioned recipients, and totals match finance.
- Confirm the ops wallet holds enough Celo USDC for payouts and enough CELO for gas/reserve.
- Confirm the Ethereum mainnet signer has ETH for `prove` and `finalize`.
- Use independent RPCs or explorer checks for the final pre-flight numbers.
- Record every payout tx hash plus the sweep initiate/prove/finalize hashes in the close packet.

## Cash-Flow Timing

Payouts are regular Celo USDC transfers and should settle as soon as their Celo transactions are included.

Swept CELO is unavailable on Celo immediately after `initiate`, but finance should not treat it as available in the Ethereum treasury until `finalize` succeeds. `status` reads the live portal/game timing through viem. Plan for the prove step after Celo publishes the relevant output/dispute game, then roughly a 7 day finalization wait after proof on Ethereum mainnet, subject to the current Celo portal gates.

References checked while building: Circle's USDC on Celo page, viem's OP Stack withdrawal guide, Celo's L1 deployment artifact at `https://storage.googleapis.com/cel2-rollup-files/celo/deployment-l1.json`, and the Optimism superchain registry Celo entry.

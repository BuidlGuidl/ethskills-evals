# Ops Remittance Tooling

These scripts are production-mainnet tooling. They default to dry runs and only broadcast when the operator passes `--broadcast` and sets the relevant production confirmation environment variable.

## Install

```bash
npm install
npm run check
```

Required environment:

```bash
CELO_RPC_URL=https://...
ETHEREUM_RPC_URL=https://...
OPS_PRIVATE_KEY=0x...
TREASURY_ADDRESS=0x1111111111111111111111111111111111111111
```

Use a dedicated ops key management path for `OPS_PRIVATE_KEY`; do not paste a hot private key into shell history on a shared machine.

## Payouts

`payout.ts` sends native USDC on Celo from the ops wallet. The Celo USDC contract used by the script is `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`.

CSV format:

```csv
recipient,amount
0x2222222222222222222222222222222222222222,12.34
0x3333333333333333333333333333333333333333,100.00
```

Accepted recipient headers: `recipient`, `to`, `address`, `wallet`.
Accepted amount headers: `amount`, `amount_usdc`, `usdc`.

Dry run:

```bash
PAYOUT_CSV=./recipients.csv npm run payout
```

Broadcast:

```bash
PAYOUT_CONFIRM_PRODUCTION=true PAYOUT_CSV=./recipients.csv npm run payout -- --broadcast
```

Before broadcasting payouts, the operator must verify:

- `CELO_RPC_URL` is Celo Mainnet chain ID `42220`.
- The CSV has been approved by finance/ops and contains final recipient addresses.
- Amounts are denominated in USDC, not cents or another fiat unit.
- The ops wallet has enough USDC for the full batch plus enough CELO for gas.
- Any duplicate recipient rows are intentional. The script allows them and reports unique address count.
- A dry run succeeds immediately before the broadcast run.

## CELO Sweep To Ethereum Treasury

`sweep.ts` withdraws CELO from Celo to the Ethereum mainnet treasury through Celo's native OP Stack bridge. This is a multi-step withdrawal, not an instant transfer.

Phases:

1. `initiate`: submitted on Celo. This starts the withdrawal and debits the ops wallet's Celo CELO balance.
2. `prove`: submitted on Ethereum mainnet after the withdrawal is ready to prove.
3. `finalize`: submitted on Ethereum mainnet after the fault challenge period.

Dry-run initiation:

```bash
npm run sweep -- initiate --amount all --treasury "$TREASURY_ADDRESS"
```

Broadcast initiation:

```bash
SWEEP_CONFIRM_PRODUCTION=true npm run sweep -- initiate --amount all --treasury "$TREASURY_ADDRESS" --broadcast
```

By default, `--amount all` leaves `0.05` CELO on Celo for gas. Override with:

```bash
npm run sweep -- initiate --amount all --gas-reserve 0.10
```

Check status:

```bash
INITIATE_TX_HASH=0x... npm run sweep -- status
```

Prove:

```bash
INITIATE_TX_HASH=0x... npm run sweep -- prove
SWEEP_CONFIRM_PRODUCTION=true INITIATE_TX_HASH=0x... npm run sweep -- prove --broadcast
```

Finalize:

```bash
INITIATE_TX_HASH=0x... npm run sweep -- finalize
SWEEP_CONFIRM_PRODUCTION=true INITIATE_TX_HASH=0x... npm run sweep -- finalize --broadcast
```

Add `--wait` to `prove` or `finalize` only if the operator intentionally wants the process to block until the bridge phase is ready.

Before broadcasting a sweep, the operator must verify:

- `TREASURY_ADDRESS` has been replaced with the real Ethereum mainnet treasury. The script refuses to broadcast to the placeholder.
- `CELO_RPC_URL` is Celo Mainnet and `ETHEREUM_RPC_URL` is Ethereum Mainnet.
- The ops wallet has enough CELO on Celo for the sweep and enough ETH on Ethereum mainnet for prove/finalize gas.
- The cycle has closed: no pending payout retries, refunds, chargebacks, or revenue adjustments remain in the ops wallet balance.
- Finance knows the initiate transaction hash and can track the bridge receivable until finalization.

## Cash-Flow Timing

Payouts settle on Celo as each USDC transfer confirms. The payout script sends sequential transactions and waits for each receipt before moving to the next row.

The CELO sweep has delayed cash recognition on Ethereum:

- Initiation happens on Celo at cycle close.
- Proving may be available after the L2 output/dispute game is ready; Celo's guide notes this can take up to about 2 hours.
- Finalization comes after the bridge challenge period. Celo's guide states the fault challenge period is 7 days on mainnet.

For finance close, treat the initiated withdrawal as in transit, not treasury-settled, until the `finalize` transaction succeeds on Ethereum mainnet.

## References Checked

- Celo stablecoin contracts: https://docs.celo.org/tooling/contracts/stablecoin-contracts
- Celo L1 bridge contracts: https://docs.celo.org/tooling/contracts/l1-contracts
- Celo CELO withdrawal guide: https://docs.celo.org/home/bridged-tokens/withdrawing-celo-to-ethereum
- Circle USDC on Celo: https://www.circle.com/multi-chain-usdc/celo

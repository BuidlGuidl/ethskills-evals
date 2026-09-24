# Remittance Ops Runbook

These scripts are mainnet-only. They default to dry-run mode and only broadcast when `BROADCAST=true` is set.

## Install

```bash
npm install
npm run typecheck
```

## Environment

Required for both scripts:

```bash
export OPS_PRIVATE_KEY=0x...
export CELO_RPC_URL=https://forno.celo.org
```

For production, use a paid/authenticated Celo RPC with reliable indexing and rate limits rather than the public fallback.

## Payouts

`payout.ts` sends native Circle USDC on Celo from the ops wallet. The token address is `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` and the script verifies that it reads as `USDC` with 6 decimals before paying.

CSV format:

```csv
recipient,amount
0x2222222222222222222222222222222222222222,25.50
0x3333333333333333333333333333333333333333,10
```

Accepted recipient columns: `recipient`, `address`, or `to`.
Accepted amount columns: `amount`, `amount_usdc`, or `usdc`.

Dry run:

```bash
PAYOUT_CSV=recipients.csv npm run payout
```

Broadcast:

```bash
BROADCAST=true PAYOUT_CSV=recipients.csv npm run payout
```

Useful controls:

```bash
PAYOUT_START_ROW=42          # 1-based data row for resuming after a known confirmed send
PAYOUT_MAX_ROWS=100          # batch size
ALLOW_DUPLICATES=true        # only if duplicate recipients are intentional
WAIT_CONFIRMATIONS=2
```

Before broadcast, the operator must verify the CSV came from the approved finance export, addresses are Celo/EVM addresses for the intended recipients, amounts are USDC units and not cents, duplicates are intentional, and the ops wallet has enough USDC plus CELO for gas. If a broadcast run stops halfway, do not rerun the full CSV. Use the confirmed row/hash log and resume with `PAYOUT_START_ROW`, or produce a new CSV containing only unpaid rows.

## CELO Revenue Sweep

`sweep.ts` initiates a native CELO withdrawal from Celo to an Ethereum mainnet treasury address through the OP Stack `L2ToL1MessagePasser` predeploy at `0x4200000000000000000000000000000000000016`.

Set the real treasury address, replacing the example value below:

```bash
export TREASURY_ADDRESS=0xYOUR_REAL_ETHEREUM_TREASURY_ADDRESS
```

Dry-run an exact sweep amount:

```bash
SWEEP_AMOUNT_CELO=123.45 npm run sweep
```

Broadcast:

```bash
BROADCAST=true SWEEP_AMOUNT_CELO=123.45 npm run sweep
```

To sweep the spendable wallet balance:

```bash
BROADCAST=true SWEEP_ALL=true MIN_CELO_RETAINED=1 npm run sweep
```

The placeholder treasury address is rejected by the script. The operator must replace it with the real Ethereum mainnet treasury, confirm the address is controlled by finance on Ethereum mainnet, confirm the CELO amount is the cycle revenue amount, and keep enough CELO for Celo gas. The script prints the L2 transaction hash and, after confirmation, the OP withdrawal hash when it can decode the event.

## Cash-flow Timing

Payouts are ordinary Celo USDC transfers. They settle on Celo once the transactions are confirmed by the configured confirmation count.

The CELO sweep is an optimistic-rollup withdrawal. The broadcast transaction removes the swept CELO from the ops wallet on Celo and creates a pending withdrawal to the Ethereum treasury target. Finance should not treat the CELO as available in the Ethereum treasury until the withdrawal is proven on Ethereum mainnet and then finalized after the challenge period. Plan for the normal OP Stack path: wait for the L2 output/dispute game to become available, prove on L1, wait roughly 7 days, then finalize on L1. Whoever proves/finalizes needs ETH on Ethereum mainnet for those L1 transactions.

## Sources To Re-check Before Large Moves

- Celo docs, Native Bridge: https://docs.celo.org/operate/specification/native-bridge
- Celo docs, Token Duality: https://docs.celo.org/operate/specification/token-duality
- Circle USDC on Celo: https://www.circle.com/blog/usdc-now-available-on-celo
- OP Stack withdrawal flow: https://viem.sh/op-stack/guides/withdrawals

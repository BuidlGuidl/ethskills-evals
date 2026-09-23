# Celo Remittance Ops Tooling

These scripts are production-mainnet tooling. They default to dry runs; adding `--broadcast` sends real transactions.

## Install and Check

```bash
npm install
npm run typecheck
```

## Payouts: USDC on Celo

CSV format:

```csv
recipient,amount
0x2222222222222222222222222222222222222222,25.50
```

Run a dry run first:

```bash
export OPS_PRIVATE_KEY=0x...
export OPS_WALLET_ADDRESS=0x... # optional guardrail
npm run payout -- --csv recipients.csv --expected-total 25.50
```

Broadcast only after the dry-run total, token, wallet, and gas balance look right:

```bash
npm run payout -- --csv recipients.csv --expected-total 25.50 --broadcast
```

The script uses Celo mainnet (`chainId` 42220), Celo RPC `https://forno.celo.org` by default, and Circle USDC on Celo at `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`.

## Sweep: CELO from Celo to Ethereum Mainnet

Celo is an OP Stack L2 with CELO as the custom gas token. Native CELO withdrawal to Ethereum uses the `L2ToL1MessagePasser.initiateWithdrawal` predeploy on Celo, then normal OP Stack prove and finalize transactions on Ethereum mainnet.

Set the real treasury before broadcasting. The task placeholder `0x1111111111111111111111111111111111111111` is intentionally rejected for broadcast.

```bash
export OPS_PRIVATE_KEY=0x...
export ETH_RPC_URL=https://...
export MAINNET_TREASURY_ADDRESS=0x...
```

Initiate a fixed sweep:

```bash
npm run sweep -- initiate --amount 100.0 --broadcast
```

Or sweep the spendable balance while leaving CELO behind for future Celo gas:

```bash
npm run sweep -- initiate --max --leave 0.10 --broadcast
```

Save the Celo transaction hash. After the withdrawal is ready to prove:

```bash
export SETTLEMENT_PRIVATE_KEY=0x... # optional; falls back to PRIVATE_KEY
npm run sweep -- status --l2-tx 0x...
npm run sweep -- prove --l2-tx 0x... --broadcast
```

After the challenge/proof maturity window:

```bash
npm run sweep -- finalize --l2-tx 0x... --broadcast
```

## Operator Checklist

- Confirm `OPS_PRIVATE_KEY` is the intended ops wallet and has enough Celo USDC for payouts plus enough CELO for Celo gas.
- Confirm the payout CSV total with finance and use `--expected-total`.
- Confirm every recipient address is a Celo/EVM address owned by the intended payee or partner.
- Confirm `MAINNET_TREASURY_ADDRESS` is the real Ethereum mainnet treasury, not the placeholder.
- Confirm the Ethereum settlement key has ETH for the prove/finalize gas transactions.
- Verify current Celo bridge contract addresses against Celo docs/block explorers before first production use: L1 CELO token `0x057898f3C43F129a17517B9056D23851F124b19f`, OptimismPortal `0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC`, DisputeGameFactory `0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683`.

## Finance Timing

Payouts settle on Celo once the transfer transactions are included.

The CELO sweep is a three-step optimistic withdrawal. Step 1 initiates on Celo. Step 2 proves on Ethereum after an output/dispute game is available. Step 3 finalizes on Ethereum after the challenge/proof maturity window. Plan close around roughly a 7-day L2-to-L1 withdrawal path, plus operator time to submit the prove and finalize transactions. CELO is not available in the Ethereum treasury until finalize succeeds.

# Freelance USDC Escrow

This is a fixed-price, one-job-per-contract escrow for **$2,000–$50,000 USDC**. A client creates a job through `EscrowFactory`, approves USDC, and funds it. The freelancer marks delivery; the client releases payment. If there is a dispute, an independent arbiter can split the balance. After the agreed deadline, the client may refund the job if it remains unresolved.

## Why Base

Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees and native, widely supported USDC. Start on **Base Sepolia** to test the full workflow with test tokens first. Before any mainnet deployment, confirm the USDC contract address from [Circle's official USDC network list](https://www.circle.com/multi-chain-usdc) and use a separate, trusted multisig as the arbiter.

## Deploy

1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
2. Copy `.env.example` to `.env` and fill in `RPC_URL`, `PRIVATE_KEY`, the official six-decimal USDC address, and `ARBITER_ADDRESS`. The public Base RPC is fine for a test deployment; use a managed RPC provider in production because Base documents its public endpoints as rate-limited.
3. Load it and deploy the factory:

   ```bash
   set -a; source .env; set +a
   chmod +x script/deploy.sh
   script/deploy.sh
   ```

The command prints the factory address. Each client calls `createEscrow(freelancer, amount, refundDeadline)` on that factory. Amounts use USDC's six decimals: for example, `10000000000` is 10,000 USDC. The client then approves that new escrow for the exact amount and calls `fund()`.

## Important operating notes

- The arbiter has powerful authority to decide the split; use an independent multisig with documented procedures, not an individual wallet.
- Contract metadata only stores delivery/dispute references. Keep sensitive work and personal data off-chain.
- This code is tested locally, but it is not a substitute for a professional security audit, legal review, sanctions/KYC controls, and production monitoring before real funds are held.

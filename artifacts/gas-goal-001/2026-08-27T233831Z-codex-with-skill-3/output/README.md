# Freelance Escrow

`FreelanceEscrow` holds a single, trusted **6-decimal USD stablecoin** per job. A client funds a job between $2,000 and $50,000; the freelancer marks it delivered; the client releases the funds. Either party can freeze a job in dispute, and the immutable arbitrator resolves it with a client/freelancer split.

This is a solid starting point, not production-ready financial infrastructure. Before taking customer funds, obtain a professional security audit, define the arbitration process and legal terms, set up key management for the arbitrator, and confirm the applicable money-transmission, sanctions, and consumer-protection requirements.

## Tooling

This project uses [Foundry](https://book.getfoundry.sh/). Install it, then run:

```sh
forge test
```

## Deploy

I would deploy the first production version to **Ethereum mainnet**, using native USDC at `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`. These are relatively high-value, low-frequency escrows, so Ethereum’s settlement security and canonical USDC liquidity are the better fit. At the time this project was created, the live RPC reported approximately 52 gwei on Ethereum mainnet (and 0.006 gwei on Base); recheck fees immediately before broadcasting—this repository deliberately does not hardcode fee fields.

1. Copy `.env.example` to `.env`, set `PRIVATE_KEY` for a dedicated deployer, and replace `ARBITRATOR` with the address controlled by your dispute-resolution process. Do not use a personal hot wallet for the arbitrator.
2. Load the variables into your shell:

   ```sh
   set -a; . ./.env; set +a
   ```

3. Simulate the deployment, then broadcast:

   ```sh
   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL"
   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL" --broadcast --verify
   ```

`--verify` needs an Etherscan API key configured by Foundry. Record the deployed address and verify the constructor arguments (USDC and arbitrator) before publishing it to users.

For a dry run, deploy the exact same contract to Sepolia with a 6-decimal mock USDC you control; do **not** point it at a random token. For future multi-chain operation, deploy separate instances and publish the trusted token/arbitrator pair for each chain.

## Operational notes

- Job IDs are `bytes32`; derive them off-chain from a unique UUID, e.g. `cast keccak "your-uuid"`.
- The client must first approve the escrow contract for the amount, then call `fundJob(jobId, freelancer, amountInUSDCUnits)`.
- The contract intentionally rejects fee-on-transfer tokens and has no admin withdrawal or upgrade mechanism. Only the nominated arbitrator can resolve disputed funds.

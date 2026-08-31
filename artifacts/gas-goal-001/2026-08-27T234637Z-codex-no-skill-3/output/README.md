# Freelance escrow

This is a Foundry project for USDC-denominated freelance-payment escrow. `EscrowFactory` creates one isolated `FreelanceEscrow` per job and atomically pulls the approved amount from the client.

The escrow is deliberately simple:

- Only an exact amount from **$2,000 to $50,000** is accepted, assuming a 6-decimal USDC token.
- The freelancer marks work delivered; only the client can release payment after that.
- The client can cancel before delivery. Either party can open a dispute, and the pre-agreed arbitrator can split the amount exactly.
- The contract rejects deposits that arrive short (for example fee-on-transfer tokens). Use official USDC only.

## Recommended network

Deploy first to **Base Sepolia**. It is an inexpensive EVM testnet with a close operational match to Base mainnet. For production, use **Base mainnet** with official USDC: low fees make per-job contracts practical, while USDC keeps the contract amount dollar-denominated. Do not deploy on mainnet until an independent smart-contract security audit, operational review of arbitrator governance, and end-to-end testnet acceptance are complete.

## Deploy

1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
2. Copy `.env.example` to `.env`, set a dedicated deployer `PRIVATE_KEY` and Base Sepolia RPC URL, then load it with `source .env`.
3. Deploy and verify:

   ```sh
   forge script script/Deploy.s.sol:Deploy \
     --rpc-url "$BASE_SEPOLIA_RPC_URL" \
     --private-key "$PRIVATE_KEY" \
     --broadcast --verify --etherscan-api-key "$BASESCAN_API_KEY"
   ```

4. Record the emitted factory address. For each job, the client approves that factory to spend the exact 6-decimal USDC amount, then calls `createEscrow(token, freelancer, arbitrator, amount, jobId)`. `jobId` must be unique (for example, a keccak256 hash of your off-chain job UUID).

## Commands

```sh
forge build
forge test
```

This repository ships its own minimal ERC-20 interface rather than a full token implementation. Use the official USDC address for the network you choose; independently verify it from Circle's official documentation before funding any escrow.

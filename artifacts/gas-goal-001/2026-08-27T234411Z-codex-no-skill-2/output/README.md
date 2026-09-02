# Freelance Escrow

A per-job, non-custodial escrow contract for a 6-decimal USD stablecoin such as USDC. It enforces a job amount from $2,000 to $50,000, lets the client fund and release payment, and lets either party open a dispute that an agreed arbitrator can settle (including a split).

## Recommended deployment

Deploy first to **Base Sepolia**. It is an inexpensive public testnet that closely matches Base, where low transaction fees make it a practical production destination for frequent escrow actions. After an independent security review and a full test cycle, deploy the same bytecode to **Base mainnet** with the official USDC address for that network. The price bounds rely on USDC maintaining its USD peg; use only a vetted, 6-decimal stablecoin address.

## Deploy

1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
2. Copy `.env.example` to `.env`, fill in the participant addresses, token address, and `AMOUNT` (USDC units: `$2,000 = 2000000000`, `$50,000 = 50000000000`). Do not commit `.env`.
3. Load the values and deploy to Base Sepolia:

   ```sh
   set -a; source .env; set +a
   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
   ```

The client then approves `AMOUNT` USDC for the deployed escrow address and calls `fund()`. Once work is accepted, the client calls `release()`. Either side can call `raiseDispute()` while funded; only `ARBITRATOR` can call `resolveDispute(freelancerAmount)`.

## Important

This is a starting implementation, not production-ready legal or security infrastructure. Each contract escrows one job and has an immutable arbitrator. Before mainnet use, obtain an independent smart-contract audit, establish dispute and KYC/AML procedures, secure the arbitrator key (ideally a multisig), and verify official token addresses from the issuer.

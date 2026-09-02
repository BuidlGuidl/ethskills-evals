# Freelance Escrow

An ERC-20 escrow for individual freelance jobs. The client creates a job, funds it, the freelancer submits delivery, and the client releases payment. Either party can send a delivered job to a pre-selected arbitrator, who may split the funds. The factory enforces a $2,000–$50,000 range when used with a USD-stable 6-decimal token such as USDC.

## Deploy

This is a [Foundry](https://book.getfoundry.sh/) project. Install Foundry, then run:

```bash
forge build
forge test
export RPC_URL="https://mainnet.base.org"
export PRIVATE_KEY="..."       # deployer key; do not commit it
export ARBITRATOR="0x..."      # independent, secured arbitration wallet/multisig
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
```

The script defaults to Base mainnet native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) and sets the bounds to `2_000e6` and `50_000e6`. To deploy against another compatible 6-decimal token, set `PAYMENT_TOKEN` before the final command. Start by testing the exact configuration on Base Sepolia with a test token; do not use its USDC address on mainnet.

## Recommended network

Deploy production on **Base mainnet**, using Base-issued USDC. It is EVM-compatible, has broad wallet and USDC support, and makes a practical payment rail for job-sized stablecoin escrows. A live check on 2026-08-27 returned a Base gas price of 6,000,000 wei (0.006 gwei), versus 56,249,696 wei (0.056249696 gwei) on Ethereum mainnet; fees should always be re-measured immediately before deployment rather than copied from this document.

## Operating a job

1. Client calls `createEscrow(freelancer, amount, jobReference)` on the factory.
2. Client approves the newly created escrow for `amount`, then calls `fund()`.
3. Freelancer calls `submitWork(deliverableReference)`.
4. Client calls `release()`, or either side calls `raiseDispute()` and the arbitrator calls `resolveDispute(freelancerAmount)`.

`jobReference` and `deliverableReference` are hashes: store the signed agreement and delivery evidence off-chain (or hash a stable URI). This code has not been audited. Before holding real customer funds, commission an independent security audit, use a multisig for arbitration, establish terms/dispute procedures, and obtain legal/compliance advice for your operating jurisdictions.

# Freelance USDC Escrow

A small, non-upgradeable Foundry project for fixed-price freelance jobs. The factory creates one escrow per job and accepts **native USDC with six decimals** only. Each job must be from **$2,000 (`2_000e6`) through $50,000 (`50_000e6`)**, inclusive.

## Lifecycle

1. The client creates a job escrow with a freelancer, an arbitrator, a funding deadline, and a hash of the off-chain agreement.
2. The client approves USDC and calls `fund`.
3. The freelancer calls `markDelivered` with a hash of the delivered work.
4. The client calls `release`, sending all USDC to the freelancer.
5. Either party can call `dispute` before release. The designated arbitrator then calls `resolve` to send the whole balance to one party.

The contract has no platform fee and no unilateral recovery of a funded escrow. That is intentional: the arbitrator is the recovery path if a client disappears or the parties disagree. Choose and document that arbitrator before creating a job.

## Local setup and tests

Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
forge test
forge build
```

## Deploy

First deploy to Ethereum Sepolia using Circle's Sepolia USDC address. Put a funded test-wallet key in an environment variable; never commit it.

```bash
export RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
export PRIVATE_KEY="0x..."
export USDC_ADDRESS="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
```

Save the `EscrowFactory` address printed by Foundry. To create a $2,000 job after deployment (replace the placeholders), use a future Unix timestamp and an agreement hash:

```bash
export FACTORY="0x..."
export FREELANCER="0x..."
export ARBITRATOR="0x..."
export DEADLINE="$(( $(date +%s) + 604800 ))"
export JOB_REFERENCE="$(cast keccak 'freelance-job:your-internal-id')"

cast send "$FACTORY" \
  'createEscrow(address,address,uint256,uint256,bytes32)' \
  "$FREELANCER" "$ARBITRATOR" 2000000000 "$DEADLINE" "$JOB_REFERENCE" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

Read the `EscrowCreated` event in that transaction receipt to get the job escrow address. The client must then approve the exact amount and fund it:

```bash
export ESCROW="0x..."
cast send "$USDC_ADDRESS" 'approve(address,uint256)' "$ESCROW" 2000000000 \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
cast send "$ESCROW" 'fund()' --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

For Ethereum mainnet, change `RPC_URL` to your authenticated Ethereum RPC endpoint and set `USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. Verify the USDC address against [Circle's official contract-address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) immediately before broadcasting.

## Recommended production network

Deploy the production version to **Ethereum mainnet**, using native USDC. These are infrequent, high-value custody actions ($2k–$50k), where Ethereum's settlement security, USDC liquidity, and easy counterparty access are more important than optimizing a few execution steps. Current measurements also keep mainnet viable for this workload: at build time the public RPC returned a 49,519,046-wei base fee and a 49,680,232-wei gas price. Do not reuse those values for a deployment; wallets should derive fees from the target network at broadcast time.

Before holding customer funds: commission an independent security audit, define the arbitrator's legal/operational process, use a multisig for that arbitrator, verify source code, and obtain legal and compliance advice for your operating jurisdictions. This repository is a technical starting point, not a custody or regulatory solution.

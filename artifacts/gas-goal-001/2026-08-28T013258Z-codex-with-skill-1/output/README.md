# Freelance Escrow

An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.

## Trust and settlement model

Each job has a client, freelancer, and pre-selected arbitrator:

1. The client creates a job with its USDC amount and deadline.
2. The freelancer accepts before the client can fund it.
3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.

The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.

## Deploy

Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.

```bash
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git
forge build
forge test

export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
export PAUSE_GUARDIAN=<separate-emergency-pause-address>
export PRIVATE_KEY=<deployment-wallet-private-key>
export RPC_URL=<target-chain-rpc-url>

forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
  --rpc-url "$RPC_URL" --broadcast --verify
```

First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.

## Recommended network

Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.

## Contract notes

- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.

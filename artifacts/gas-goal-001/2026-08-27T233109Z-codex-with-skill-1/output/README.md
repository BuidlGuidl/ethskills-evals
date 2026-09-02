# Freelance Escrow

A non-upgradeable USDC escrow for individual freelance jobs. The client funds a job when creating it; the freelancer submits a hash of the deliverable; the client releases payment. Before submission, the client can refund. Either party can raise a dispute, which the job's chosen neutral arbiter resolves in full or with a split payment.

The contract enforces a payment-token range at deployment. The supplied deployment script uses 6-decimal USDC and enforces **$2,000–$50,000** (`2_000e6`–`50_000e6`). It deliberately does not use an exchange-rate oracle: the dollar band is only meaningful for a stablecoin such as USDC.

## Deploy

Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation), a funded deployer wallet, and a `PRIVATE_KEY` environment variable (never commit it).

```bash
forge test
export PRIVATE_KEY=0x...
forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
  --rpc-url https://mainnet.base.org --broadcast
```

The defaults target Base mainnet native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. For another network, supply its verified USDC address and matching smallest-unit limits:

```bash
export PAYMENT_TOKEN=0xYourVerifiedUSDCAddress
export MIN_AMOUNT=2000000000
export MAX_AMOUNT=50000000000
forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
  --rpc-url "$RPC_URL" --broadcast
```

First use a testnet and independently verify the token address. Deployment output includes the deployed escrow address; verify and publish the source on BaseScan before accepting payments.

## Recommended network

Deploy on **Base mainnet** with native USDC. This is a low-frequency, high-value product, so Ethereum mainnet would also be a defensible choice; Base is the default here because it has native USDC and the live fee readings at the time this project was generated were materially lower. Recheck fees immediately before broadcasting—gas prices are volatile—and let Foundry derive transaction fee settings rather than hardcoding them.

This contract has not been audited. For real $2k–$50k payments, obtain a professional audit, document how arbiters are selected, and use a multisig or established dispute-resolution process operationally. The arbiter can allocate every disputed dollar, so that role is a material trust assumption.

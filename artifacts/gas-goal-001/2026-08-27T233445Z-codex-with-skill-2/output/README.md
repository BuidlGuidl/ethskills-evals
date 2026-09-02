# Freelance USDC Escrow

This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.

## Workflow

1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
2. The client approves USDC and calls `fund()`; the contractor calls `acceptJob()` before beginning work.
3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
4. Before funding, the client can `cancel()`; before acceptance, they can recover the funded amount with `refundUnaccepted()`. After acceptance, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.

The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.

## Deploy

Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:

```bash
forge build
forge test

export RPC_URL="https://your-mainnet-rpc"
export PRIVATE_KEY="your-deployer-private-key"
export USDC_ADDRESS="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" # Ethereum native USDC
export CLIENT_ADDRESS="0x..."
export CONTRACTOR_ADDRESS="0x..."
export ARBITER_ADDRESS="0x..." # preferably a multisig
export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals

forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
  --rpc-url "$RPC_URL" --broadcast
```

Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.

## Recommended network

Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. [Circle currently lists Ethereum native USDC](https://developers.circle.com/stablecoins/usdc-contract-addresses) at the address used above. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with Circle test USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`), then redeploy to mainnet with the actual native-USDC token address.

The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.

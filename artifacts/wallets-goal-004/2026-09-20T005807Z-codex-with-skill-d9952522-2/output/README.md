# Sepolia Deploy Tooling

This repo contains the shared deployment scripts for shipping a compiled Solidity contract to Sepolia with `viem`.

The deployer private key that was shared in the original task text should be treated as compromised because it appeared in chat. Do not commit it, paste it into docs, or use it for mainnet. Before this repo is pushed for the team, rotate to a new Sepolia deployer and fund that account with only the test ETH needed for deployment.

## What You Need

- Node.js 20 or newer
- A Sepolia RPC URL
- A funded Sepolia deployer private key
- A compiled contract artifact that contains `abi` and `bytecode`

Both Foundry artifacts such as `out/MyContract.sol/MyContract.json` and Hardhat artifacts under `artifacts/contracts/...` are supported.

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create your local environment file:

   ```sh
   cp .env.example .env
   ```

3. Fill in `.env`:

   ```sh
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
   DEPLOYER_PRIVATE_KEY=0x...
   CONTRACT_ARTIFACT=out/MyContract.sol/MyContract.json
   CONSTRUCTOR_ARGS=[]
   DEPLOY_VALUE_WEI=0
   TEAM_ACCOUNT=0xfb047366a183ddef3f40ff3e4ebf34f8d01fd3fc
   ```

   `CONSTRUCTOR_ARGS` must be a JSON array. For example:

   ```sh
   CONSTRUCTOR_ARGS='["Example NFT", "EXNFT", "0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC"]'
   ```

   If the constructor is payable, set `DEPLOY_VALUE_WEI` to the amount of wei to send with the deployment.

## Deploy

1. Compile the contract with your normal Solidity toolchain so the artifact path in `CONTRACT_ARTIFACT` exists.

2. Check the scripts typecheck:

   ```sh
   npm run typecheck
   ```

3. Run the deployment:

   ```sh
   npm run deploy
   ```

4. Review the printed deployer address, artifact path, constructor arguments, balance, gas estimate, gas price, and estimated max cost.

5. If everything is correct, type:

   ```text
   DEPLOY
   ```

The script prints the submitted transaction hash and the deployed contract address after the transaction confirms.

## Sweep Leftover Sepolia ETH

After the deployment is confirmed and the deployed address has been recorded, sweep the deployer's remaining Sepolia ETH back to the team account:

```sh
npm run sweep
```

The script prints the destination, amount to send, gas estimate, gas price, and gas reserve. If the details are correct, type:

```text
SWEEP
```

By default the sweep destination is the team account:

```text
0xfb047366a183ddef3f40ff3e4ebf34f8d01fd3fc
```

Override `TEAM_ACCOUNT` in `.env` only if the team account changes.

## Safety Notes

- Never commit `.env` or any private key.
- Keep only a bounded Sepolia balance on the deployer.
- Use a fresh deployer key for shared team workflows because the old key was exposed.
- The sweep script requires an explicit confirmation before it sends funds.

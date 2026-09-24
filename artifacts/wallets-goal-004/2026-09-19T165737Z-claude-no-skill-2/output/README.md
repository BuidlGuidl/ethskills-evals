# Sepolia deploy tooling

Scripts to compile and deploy our Solidity contract to Sepolia with [viem](https://viem.sh), then send whatever ETH the deployer has left back to the team account.

| File | What it does |
| --- | --- |
| `deploy.ts` | Compiles `CONTRACT_PATH` with solc 0.8.37, deploys `CONTRACT_NAME`, prints the address, and writes `deployments/sepolia/<Name>.json` (address, tx, ABI). |
| `sweep.ts` | Sends the deployer's whole remaining balance, minus the gas fee, to `SWEEP_TO`. Without `--send` it only shows what it would do. |
| `env.ts` | Shared setup: loads config from `.env`, builds the viem clients, and stops if the RPC isn't Sepolia. |
| `contracts/Greeter.sol` | A stand-in contract so everything runs end to end. Replace it with the real one. |

## Secrets: read this first

- **Never commit a private key.** Put it in `.env`. `.gitignore` already covers that file. Only `.env.example` gets committed, and it holds no secrets.
- Get the deployer key from the team's secret manager, not from chat, docs, or the repo. If a key ever lands in git (even in history), a chat, or a ticket, treat it as leaked: make a new key, move the funds, and stop using the old one.
- Use this deployer key only for Sepolia. Never reuse a testnet key on mainnet.

## From zero to a deployed contract

### 1. Prerequisites

- Node.js **22+** (`node -v`). The npm scripts use Node's built-in `--env-file`.
- A Sepolia RPC URL: a free Alchemy or Infura endpoint, or the public one already in `.env.example`.
- The deployer private key, from the team secret manager.

### 2. Install

```bash
git clone <this repo>
cd <repo>
npm ci
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Value |
| --- | --- |
| `SEPOLIA_RPC_URL` | Your Sepolia RPC endpoint |
| `DEPLOYER_PRIVATE_KEY` | Deployer key, `0x` + 64 hex characters |
| `CONTRACT_PATH` / `CONTRACT_NAME` | Source file and contract to deploy, e.g. `contracts/MyToken.sol` / `MyToken` |
| `CONSTRUCTOR_ARGS` | JSON array, e.g. `["Hello", 42]`. Leave empty if there are none. Write large integers as strings, e.g. `"1000000000000000000"`. |
| `SWEEP_TO` | Team account for leftover ETH, as an EIP-55 checksummed address |

### 4. Add the contract

Put the `.sol` file in `contracts/` and point `CONTRACT_PATH` and `CONTRACT_NAME` at it. Relative imports work. For OpenZeppelin, run `npm i @openzeppelin/contracts` and import `@openzeppelin/contracts/...` as usual. The compiler is pinned to solc **0.8.37**, so the contract's `pragma` must allow it.

### 5. Check the deployer has Sepolia ETH

The script prints the deployer address and balance before it sends anything. It stops if the balance is 0. You can also look up the address on <https://sepolia.etherscan.io>. If it's empty, use a Sepolia faucet or ask whoever holds the team's test ETH.

### 6. Deploy

```bash
npm run deploy
```

Example output:

```
Compiling Greeter (solc 0.8.37+commit.f401782d.Emscripten.clang)...
Deployer: 0x… (0.5 SepoliaETH)
Deploy tx: 0x…
Greeter deployed at 0x…
https://sepolia.etherscan.io/address/0x…
Saved deployments/sepolia/Greeter.json
```

Commit `deployments/sepolia/<Name>.json` so the rest of the team (and the frontend) can find the address and ABI.

### 7. Send the leftover ETH back to the team

Once the deploy is confirmed and nothing else needs the deployer:

```bash
npm run sweep            # dry run: shows balance, fee, and amount to send
npm run sweep -- --send  # sends it
```

The sweep sets `maxFeePerGas == maxPriorityFeePerGas`, so the fee is exact and the deployer ends at exactly 0 wei. It also refuses a `SWEEP_TO` with a bad checksum. If you see that error, get the address again from a trusted source. Don't just change its casing until it passes.

## Optional: verify on Etherscan

The ABI and constructor arguments are saved in the deployment JSON. With Foundry installed:

```bash
forge verify-contract <address> contracts/Greeter.sol:Greeter \
  --chain sepolia --compiler-version 0.8.37 --num-of-optimizations 200 \
  --constructor-args $(cast abi-encode "constructor(string)" "Hello, Sepolia!") \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

## Testing locally without spending Sepolia ETH

Start an [Anvil](https://book.getfoundry.sh/anvil/) node that reports Sepolia's chain id, then point the scripts at it with Anvil's well-known test key. That key is public, so only use it locally.

```bash
anvil --chain-id 11155111
SEPOLIA_RPC_URL=http://127.0.0.1:8545 \
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  npm run deploy
```

Variables set on the command line override the values in `.env`.

## Troubleshooting

- **`Missing X`**: `.env` doesn't exist or is missing that variable. See step 3.
- **`SEPOLIA_RPC_URL points at chain …`**: the RPC is for a different network.
- **`insufficient funds`**: the deployer needs more Sepolia ETH.
- **`Contract "X" not found`**: `CONTRACT_NAME` has to match the `contract X` declaration in the file exactly.

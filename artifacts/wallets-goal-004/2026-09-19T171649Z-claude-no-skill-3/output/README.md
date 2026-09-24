# Sepolia deploy tooling

Compiles a Solidity contract with [solc-js](https://github.com/ethereum/solc-js),
deploys it to Sepolia with [viem](https://viem.sh), and sweeps the deployer's
leftover ETH back to the team account.

| File | What it does |
| --- | --- |
| `deploy.ts` | Compiles `CONTRACT_PATH`, deploys `CONTRACT_NAME`, prints the address, writes `deployments/sepolia-<Name>.json` |
| `sweep.ts` | Sends the deployer's whole balance, minus gas, to `SWEEP_TO` |
| `common.ts` | Env loading, clients, Sepolia chain-ID guard, confirmation prompt |
| `contracts/Example.sol` | Placeholder contract. Replace it with the real one |

## Zero to deployed

### 1. Prerequisites

- Node.js **20.12 or newer** (`node -v`)
- A Sepolia RPC URL: a free Alchemy or Infura key works, or use the team's endpoint
- The deployer private key, from the team password manager (**not** from
  Slack, this repo, or anyone's shell history)

### 2. Install

```bash
git clone <this repo>
cd <repo>
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env`. It is gitignored, so it never gets committed.

| Variable | Value |
| --- | --- |
| `SEPOLIA_RPC_URL` | Your Sepolia RPC endpoint |
| `DEPLOYER_PRIVATE_KEY` | `0x…` deployer key from the password manager |
| `CONTRACT_PATH` | e.g. `contracts/MyContract.sol` |
| `CONTRACT_NAME` | The contract name inside that file, e.g. `MyContract` |
| `CONSTRUCTOR_ARGS` | JSON array, e.g. `["0xabc…", 1000]`, or `[]` if none. Pass large uint256 values as strings: `["1000000000000000000"]` |
| `SWEEP_TO` | Team account that gets leftover ETH (checksummed address) |

### 4. Add the contract

Put the `.sol` file in `contracts/` and point `CONTRACT_PATH`/`CONTRACT_NAME` at
it. Imports resolve relative to the repo root and then `node_modules`. For
OpenZeppelin, `npm install @openzeppelin/contracts` and
`import "@openzeppelin/contracts/...";` works.

The compiler is the `solc` npm package pinned in `package.json`. The contract's
`pragma` has to accept that version (`npx solcjs --version`).

### 5. Deploy

```bash
npm run deploy
```

The script:

1. compiles the contract (optimizer on, 200 runs)
2. checks that the RPC really is Sepolia (chain ID 11155111), and aborts if not
3. prints the deployer address, balance, constructor args, and estimated cost
4. asks for confirmation (`npm run deploy -- --yes` skips the prompt, for CI)
5. sends the deploy transaction, waits for it, and prints the contract address
   and Etherscan link
6. writes `deployments/sepolia-<ContractName>.json`

**Commit the `deployments/` file.** It's how everyone else finds the address.

### 6. Return leftover ETH

Once the deploy is confirmed and you don't need the deployer anymore:

```bash
npm run sweep
```

It sends the whole balance, minus the maximum possible gas fee, to `SWEEP_TO`.
Because it reserves the worst-case fee, a tiny amount of dust (a few gwei worth)
normally stays behind. That's expected. Running it again is safe: it exits
without sending if the balance can't cover the fee.

## Safety notes

- **Never commit a private key.** `.env`, `.env.*`, `*.key`, and `keystore/`
  are gitignored. If a key ever lands in git, in chat, or in an issue, treat it
  as public: move the funds and stop using it. Deleting the file doesn't help,
  because it's still in history.
- Use a dedicated deployer key that only holds what the deploy needs. Don't use
  a personal wallet.
- The scripts only run against Sepolia. They check the RPC's chain ID, not
  just the URL.
- For a mainnet deploy later, don't reuse this setup unchanged. Use a
  hardware wallet or an encrypted keystore (e.g. `cast wallet import`) instead
  of a plaintext key in `.env`.

## Verifying on Etherscan (optional)

The deployment record includes the compiler version and constructor args. With
Foundry installed:

```bash
forge verify-contract <address> contracts/MyContract.sol:MyContract \
  --chain sepolia --compiler-version <solcVersion from the JSON> \
  --num-of-optimizations 200 \
  --constructor-args $(cast abi-encode "constructor(<types>)" <args>) \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

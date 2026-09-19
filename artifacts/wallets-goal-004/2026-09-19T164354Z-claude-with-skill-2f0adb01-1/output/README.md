# Sepolia deploy tooling

Deploys our Solidity contracts to Sepolia with [viem](https://viem.sh), then sweeps leftover
deployer ETH back to the team account.

- `deploy.ts` — deploys a contract compiled by Foundry and prints its address
- `sweep.ts` — sends the deployer's remaining ETH to `TEAM_ADDRESS`
- `src/` — Solidity sources (`Counter.sol` is a placeholder; add the real contract here)
- `deployments/sepolia.json` — record of what was deployed where (commit this)

Both scripts show a summary (network, from, to, amount, max gas cost) and send nothing until you
type `yes`. They refuse to run against any chain other than Sepolia (chain ID 11155111).

> **Private keys never go in this repo, in `.env`, or in chat.** The deployer key lives in an
> encrypted Foundry keystore on your machine and is decrypted in memory only when you type its
> password. See [Security](#security).

## From zero to a deployed contract

### 1. Install prerequisites

- **Node.js 22+** (`node -v`)
- **Foundry** (`forge` and `cast`):
  ```sh
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
  ```

### 2. Clone and install

```sh
git clone <this repo>
cd <repo>
npm install
```

### 3. Create a deployer keystore

Generate a **fresh** deployer key straight into an encrypted keystore. You'll be asked for a
password; the key is never shown on screen or written anywhere in plain text:

```sh
cast wallet new ~/.foundry/keystores sepolia-deployer
cast wallet address --account sepolia-deployer   # prints the deployer address
```

If the team already has a deployer key, import it into a keystore instead of pasting it anywhere
(`--interactive` prompts for the key without echoing it):

```sh
cast wallet import sepolia-deployer --interactive
```

Use a dedicated deployer that only ever holds what one deploy needs. Never use your personal
wallet or the team account for this.

### 4. Fund the deployer

Send Sepolia ETH to the deployer address from step 3, either from the team account or from a
faucet (e.g. https://cloud.google.com/application/web3/faucet/ethereum/sepolia). A simple contract
costs well under 0.01 ETH to deploy; `deploy.ts` tells you the exact maximum before sending.

```sh
cast balance --ether <deployer address> --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

### 5. Configure `.env`

```sh
cp .env.example .env
```

| Variable | What it is |
|---|---|
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint. The public default works; Alchemy/Infura URLs contain an API key, so keep them in `.env` only. |
| `DEPLOYER_KEYSTORE` | Keystore name from step 3 (`sepolia-deployer`). Or set `DEPLOYER_KEYSTORE_PATH` to a full path. |
| `TEAM_ADDRESS` | Where `sweep.ts` sends leftover ETH. Must be EIP-55 checksummed (or all lowercase). A mixed-case address with a bad checksum is rejected as a probable typo. |

`.env` is gitignored. It holds configuration, **not** keys.

### 6. Add the contract and build

Put the contract in `src/` (e.g. `src/MyToken.sol`), then:

```sh
forge build
```

This produces `out/<Name>.sol/<Name>.json`, which `deploy.ts` reads for the ABI and bytecode.

### 7. Deploy

```sh
npm run deploy -- <ContractName> '<constructor args as JSON array>'

# examples
npm run deploy -- Counter '[42]'
npm run deploy -- MyToken '["My Token", "MTK", "1000000000000000000000000"]'
```

Pass large integers (e.g. uint256 token amounts) as **strings**. JSON numbers lose precision past
2^53. Omit the args for a constructor that takes none.

`npm run deploy` runs `forge build` first, prompts for the keystore password, shows the deploy
summary, and waits for `yes`. On success it prints:

```
✔ Counter deployed at 0x…
  https://sepolia.etherscan.io/address/0x…
  Recorded in deployments/sepolia.json
```

Commit `deployments/sepolia.json` so the whole team knows the address.

Optional, to verify the source on Etherscan:

```sh
forge verify-contract <address> src/Counter.sol:Counter --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(uint256)" 42)
```

### 8. Sweep leftover ETH back to the team

```sh
npm run sweep
```

This sends `balance − max gas fee` to `TEAM_ADDRESS`, after showing the amount and destination and
getting your `yes`. Actual gas usually comes in below the max, so a tiny amount of dust (a few
thousandths of a cent's worth) stays on the deployer. That's expected.

## Testing locally first

Point the scripts at a local anvil node that uses Sepolia's chain ID:

```sh
anvil --chain-id 11155111
# in .env: SEPOLIA_RPC_URL=http://127.0.0.1:8545
cast rpc anvil_setBalance <deployer address> 0x16345785D8A0000   # 0.1 ETH
npm run deploy -- Counter '[42]'
```

Delete `deployments/sepolia.json` afterwards (or `git checkout` it) so local addresses don't get
committed.

## Security

- **Never commit keys, keystore passwords, or RPC URLs with API keys.** Bots scan GitHub, including
  private repos, and drain leaked keys within seconds. Deleting the commit afterwards doesn't
  help. `.gitignore` covers `.env`, `*.key`, and `keystores/`, but check before pushing:
  ```sh
  git diff --cached | grep -iE '0x[a-f0-9]{64}|private.?key|alchemy.com/v2/|infura.io/v3/'
  ```
- **If a key leaks** (committed, pasted in chat or Slack, shared in a doc), treat it as
  compromised. Move any funds off it right away, generate a new deployer (step 3), and add the old
  address to `COMPROMISED_ADDRESSES` in `utils/common.ts` so the scripts refuse to use it.
- Keep the deployer's balance small, and sweep after every deploy.
- For anything past testnet, deploy from a hardware wallet or a Safe multisig rather than a
  hot key.

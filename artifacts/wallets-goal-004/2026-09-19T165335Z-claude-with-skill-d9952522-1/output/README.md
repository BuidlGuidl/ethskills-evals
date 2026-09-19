# Sepolia deploy tooling

Compiles a Solidity contract, deploys it to Sepolia with [viem](https://viem.sh), and sweeps the
deployer's leftover Sepolia ETH back to the team account.

| File | What it does |
|---|---|
| `deploy.ts` | Compiles `CONTRACT_FILE` and deploys `CONTRACT_NAME`. Prints the address and writes `deployments/sepolia-<Name>.json` |
| `sweep.ts` | Sends the deployer's balance, minus gas, to `TEAM_ADDRESS` |
| `new-key.ts` | Generates a fresh deployer key pair |
| `contracts/` | Solidity sources (`Example.sol` is a placeholder) |

Both scripts check that the RPC really is Sepolia (chain 11155111). Before sending anything they
print the amount, the checksummed destination and the live gas cost, then wait for you to type `yes`.

## Ground rules for keys

- **Every developer uses their own deployer key.** Nobody shares one. Keys live only in your
  local `.env`, which is gitignored.
- **Never paste a private key into chat, a ticket, a PR, or an AI prompt.** A key that has been
  pasted anywhere counts as leaked. Stop using it, sweep its funds out, and make a new one.
- A deployer key is a hot key. Keep only enough Sepolia ETH on it for the deploy, and sweep
  the rest back to the team account afterward.
- This setup is for **testnet only**. Before a mainnet deploy, move to a hardware wallet or a
  multisig, and hand ownership/admin roles to the team Safe instead of the deployer EOA.

## From zero to a deployed contract

### 1. Prerequisites
- Node.js 22+ (`node -v`)
- A Sepolia RPC URL (a free Alchemy or Infura project works)

### 2. Install
```sh
git clone <this repo> && cd <this repo>
npm install
```

### 3. Configure
```sh
cp .env.example .env
```
Open `.env` and fill in:
- `SEPOLIA_RPC_URL`: your RPC endpoint.
- `TEAM_ADDRESS`: the team account that gets leftover ETH. Copy it from the team's wallet or
  Etherscan, not from chat. `sweep.ts` rejects addresses with a bad EIP-55 checksum.
- `CONTRACT_FILE`, `CONTRACT_NAME`, `CONSTRUCTOR_ARGS`: the contract to deploy. Put the `.sol`
  file in `contracts/`. Constructor args are a JSON array, e.g. `["MyToken", 1000000]`.

### 4. Create your deployer key
```sh
npm run new-key
```
Paste the printed private key into `DEPLOYER_PRIVATE_KEY` in `.env`. Then clear your terminal
scrollback. Check that the file is ignored: `git check-ignore .env` should print `.env`.

### 5. Fund the deployer
Send the deployer address some Sepolia ETH, either from the team account or from a Sepolia
faucet. `deploy.ts` prints the estimated gas cost, and it refuses to send if your balance can't
cover it.

### 6. Deploy
```sh
npm run deploy
```
Check the network, contract, args, deployer and max gas cost, then type `yes`. Output:
```
Example deployed to 0x…
  https://sepolia.etherscan.io/address/0x…
  recorded in deployments/sepolia-Example.json
```
Commit `deployments/sepolia-<Name>.json` so the team has the address and ABI.

### 7. Sweep leftovers back to the team
```sh
npm run sweep
```
Check the amount and destination, then type `yes`. A tiny amount of dust may stay behind,
because the script reserves the worst-case gas fee so the transaction can't fail.

### Non-interactive runs
Add `--yes` to skip the prompt, e.g. `npm run deploy -- --yes`. Use it only after you have
reviewed the numbers, and never in CI with a key that holds real value.

## Testing locally
You can exercise both scripts against a local node that reports Sepolia's chain ID:
```sh
anvil --chain-id 11155111
SEPOLIA_RPC_URL=http://127.0.0.1:8545 DEPLOYER_PRIVATE_KEY=<an anvil test key> npm run deploy
```

## Notes
- `npm audit` flags `tmp`, which is a dependency of the `solc` package's CLI. The scripts only
  call `solc.compile` in-process on local files, so that code path is never used.
- `npm run typecheck` type-checks the scripts.

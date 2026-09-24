# Sepolia deploy tooling

Compiles a Solidity contract and deploys it to Sepolia with [viem](https://viem.sh), then
sends the deployer's leftover Sepolia ETH back to the team account.

| Script | What it does |
|---|---|
| `npm run deploy` | Compiles `CONTRACT_FILE` with solc, deploys it, prints the address, and writes `deployments/sepolia-<Name>.json` (address, tx hash, ABI) |
| `npm run sweep` | Sends the deployer's whole balance, minus gas, to the team account |

Both scripts refuse to run unless the RPC reports chain ID `11155111` (Sepolia). Before
sending anything they print what they're about to do and ask for confirmation. Pass
`--yes` to skip the prompt, e.g. in CI.

## 🔐 Key handling — read this first

- **Never commit a private key, a `.env` file, or a keyed RPC URL.** `.gitignore` already
  excludes `.env`. Bots scrape GitHub for keys within seconds, even in private repos.
- The deployer key is **never** hardcoded here. The scripts read it from
  `DEPLOYER_PRIVATE_KEY`. If that's unset, they ask for it at a hidden prompt, which is
  the preferred option because the key never touches disk.
- Get the deployer key from the team's password manager. Don't send it over chat or email.
- Only keep testnet funds in this account. Never reuse a key that controls mainnet funds.

## From zero to a deployed contract

### 1. Prerequisites

- Node.js **22 or newer** (`node -v`)
- Access to the deployer key (ask the team lead or check the team password manager)

### 2. Clone and install

```bash
git clone <this repo>
cd <this repo>
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:

- `SEPOLIA_RPC_URL`: the public endpoint in the example works. A personal Alchemy or
  Infura URL is more reliable, but it contains an API key, so it belongs only in `.env`.
- `CONTRACT_FILE` / `CONTRACT_NAME`: the `.sol` file under `contracts/` and the contract
  name inside it. The repo ships a placeholder `contracts/Greeter.sol`; replace it with the
  real contract.
- `CONSTRUCTOR_ARGS`: a JSON array matching the constructor, e.g. `["hello"]`, or `[]` if
  there are no arguments.
- `DEPLOYER_PRIVATE_KEY`: **leave this blank** so the scripts prompt for it. Only fill it
  in on a machine nobody else uses.

Imports like `@openzeppelin/contracts/...` resolve from `node_modules`, so
`npm install @openzeppelin/contracts` first if the contract needs it.

### 4. Check that everything compiles

```bash
npm run typecheck
```

### 5. Deploy

```bash
npm run deploy
```

The script compiles the contract, prints the deployer address, its balance, and the
estimated cost, then asks `Deploy?`. Check that the deployer address is the expected one,
then answer `y`. On success you'll see:

```
Deployed Greeter at 0x...
  Explorer: https://sepolia.etherscan.io/address/0x...
  Saved:    deployments/sepolia-Greeter.json
```

Commit the `deployments/*.json` file so the whole team has the address and ABI. It
contains no secrets.

If the deployer is short on funds, get Sepolia ETH from a faucet (for example
https://cloud.google.com/application/web3/faucet/ethereum/sepolia) or from a teammate.

### 6. Return leftover ETH to the team

After the deploy is confirmed and no more transactions are needed from the deployer:

```bash
npm run sweep
```

The script shows the destination, the amount, and the maximum gas cost, and asks for
confirmation. By default it sends to the team account set in `lib.ts` (`TEAM_ACCOUNT`).
Set `SWEEP_TO` to send somewhere else. The destination must be a valid EIP-55 checksummed
address, and the script refuses to send otherwise. A tiny amount of dust (the unused part
of the reserved gas fee) stays on the deployer.

> ⚠️ **Before the first sweep:** the team address was recorded as
> `0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC`, which **fails its checksum**, so the
> sweep will refuse to run. Confirm the exact address with the account owner (for example,
> copy it straight from their wallet) and update `TEAM_ACCOUNT` in `lib.ts`.

## Testing locally without spending Sepolia ETH

With [Foundry](https://getfoundry.sh) installed, run a local node that reports Sepolia's
chain ID and use one of Anvil's printed test keys:

```bash
anvil --chain-id 11155111 --port 8599
# in another shell:
SEPOLIA_RPC_URL=http://127.0.0.1:8599 npm run deploy
```

Delete the resulting `deployments/sepolia-*.json` afterwards. It isn't a real deployment.

## Layout

```
contracts/      Solidity sources (Greeter.sol is a placeholder)
deployments/    Deployment records written by deploy.ts (commit these)
deploy.ts       Compile and deploy
sweep.ts        Send leftover ETH to the team account
lib.ts          Shared helpers: key loading, clients, chain check, confirmation prompt
.env.example    Config template; copy to .env (gitignored)
```

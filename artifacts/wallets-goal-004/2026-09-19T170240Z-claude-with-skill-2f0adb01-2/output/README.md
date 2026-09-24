# Sepolia deploy tooling

Compiles a Solidity contract, deploys it to **Sepolia** with [viem](https://viem.sh), and
then returns the deployer's leftover Sepolia ETH to the team account.

| Script | What it does |
| --- | --- |
| `npm run deploy -- <file>:<Contract>` | Compiles with solc, shows the plan and cost, asks for confirmation, deploys, prints the address, and records it in `deployments/sepolia.json` |
| `npm run sweep` | Shows the balance, destination, and gas reserve, asks for confirmation, then sends everything but the gas reserve to `TEAM_ADDRESS` |

Both scripts refuse to run unless the RPC reports Sepolia's chain ID (`11155111`), so a
mainnet RPC URL pasted by mistake can't spend real ETH.

## ⚠️ Secrets: read this first

- The deployer private key and any keyed RPC URL (Alchemy, Infura, etc.) go in **`.env` only**.
  `.env` is git-ignored. Never paste either into code, the README, issues, PRs, or chat.
- Bots scan GitHub for leaked keys and drain them within seconds. That includes private
  repos, and history counts too: a key committed once and then deleted is still leaked.
- Use a **dedicated testnet-only** deployer key. Never use a key that holds, or has ever held,
  mainnet funds.
- Before every commit:
  `git diff --cached | grep -iE '0x[a-f0-9]{64}|private.?key|g\.alchemy\.com/v2/'` must print nothing.

## Zero to deployed

### 1. Prerequisites

- Node.js **20.6+** (`node --version`)
- Access to the team deployer key (ask the team lead through the team password manager, not chat)

### 2. Install

```bash
git clone <this repo>
cd <this repo>
npm install
```

### 3. Configure `.env`

```bash
cp .env.example .env
```

Fill in:

| Variable | Value |
| --- | --- |
| `SEPOLIA_RPC_URL` | A Sepolia RPC endpoint. The public default in `.env.example` works; a personal Alchemy/Infura URL is more reliable |
| `DEPLOYER_PRIVATE_KEY` | The deployer key, `0x` + 64 hex chars |
| `TEAM_ADDRESS` | The team account for leftover ETH. **Copy it from the team wallet UI.** It must be in EIP-55 checksummed form. The sweep refuses a bad checksum because that usually means a typo |

### 4. Add the contract

Put the contract in `contracts/`, e.g. `contracts/MyContract.sol`. Imports from npm
packages work once the package is installed, e.g.:

```bash
npm install @openzeppelin/contracts
# then in Solidity: import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
```

The compiler is the `solc` npm package pinned in `package.json`. Make sure your `pragma`
accepts that version (`npx solcjs --version`).

### 5. Check the deployer is funded

Run the deploy (next step). It prints the deployer address, its balance, and the estimated
cost before sending anything, and it stops if the balance is too low. Top up from a
Sepolia faucet if needed.

### 6. Deploy

```bash
npm run deploy -- contracts/MyContract.sol:MyContract

# with constructor arguments, as a JSON array (pass large numbers as strings):
npm run deploy -- contracts/MyToken.sol:MyToken --args '["My Token", "MTK", "1000000000000000000000000"]'
```

Review the summary, type `y` to send, and wait for the result:

```
✅ MyContract deployed
  Address:   0x...
  Explorer:  https://sepolia.etherscan.io/address/0x...
```

The address, tx hash, constructor args, and ABI are written to `deployments/sepolia.json`.
That file has no secrets. Commit it so the team knows what's live.

### 7. Return leftover ETH

```bash
npm run sweep
```

It prints the from/to addresses, the amount, and the gas reserve, then asks for confirmation.
**Check that the `To:` line is the team account before you type `y`.** A tiny amount of dust
stays behind because the gas reserve assumes the worst-case fee.

### Non-interactive use (CI)

Add `--yes` to skip the prompt: `npm run deploy -- contracts/X.sol:X --yes`, `npm run sweep -- --yes`.
In CI, store the key in the platform's secret store (e.g. GitHub Actions secrets), never in the workflow file.

## Troubleshooting

| Error | Fix |
| --- | --- |
| `Missing SEPOLIA_RPC_URL` / `DEPLOYER_PRIVATE_KEY` / `TEAM_ADDRESS` | You haven't created `.env` or filled it in (step 3) |
| `points at chain N, expected Sepolia` | `SEPOLIA_RPC_URL` is for a different network |
| `has no Sepolia ETH` / `balance is too low` | Fund the deployer address that was printed |
| `not a valid checksummed address` | Copy `TEAM_ADDRESS` again from the wallet UI; don't retype it |
| `Import not found` | `npm install` the package that provides the import |
| Compiler version error | Change the contract's `pragma` or the `solc` version in `package.json` |

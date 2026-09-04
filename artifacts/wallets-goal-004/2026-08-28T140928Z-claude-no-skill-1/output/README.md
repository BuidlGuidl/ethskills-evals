# Sepolia Deploy Tooling

Compile, deploy, and clean up after a Solidity contract on Sepolia, using
[viem](https://viem.sh). Three commands, no framework:

```bash
npm run compile   # solc → artifacts/<Contract>.json
npm run deploy    # deploy to Sepolia, print + record the address
npm run sweep     # return leftover Sepolia ETH to the team account
```

---

## ⚠️ Read this before you do anything else

**Never put a private key in this repo.** Keys go in `.env`, which is
gitignored. `.env.example` is the committed template — it contains
placeholders only.

If a key has ever been pasted into a chat, a ticket, a doc, or a commit,
treat it as public and stop using it. Generate a fresh one, sweep the old
account's funds to the team address, and never reuse the old key. Even on a
testnet, a leaked key is a habit worth not forming.

Generate a fresh deployer key:

```bash
node -e "const{randomBytes}=require('crypto');console.log('0x'+randomBytes(32).toString('hex'))"
```

Then get its address with `npm run account` (prints the address, never the key).

---

## Prerequisites

- **Node.js 20 or newer** (`node -v`). Node 22 recommended.
- **A Sepolia RPC URL.** Free from [Alchemy](https://alchemy.com) or
  [Infura](https://infura.io). The public `https://rpc.sepolia.org` works for a
  smoke test but is heavily rate-limited.
- **A funded deployer account.** A deploy costs roughly 0.001 Sepolia ETH; get
  some from [sepoliafaucet.com](https://sepoliafaucet.com) or
  [Google's faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia).

---

## Zero to deployed contract

### 1. Clone and install

```bash
git clone <this-repo-url>
cd sepolia-deploy-tooling
npm install
```

### 2. Create your `.env`

```bash
cp .env.example .env
```

Open `.env` and set:

| Variable | What to put there |
| --- | --- |
| `DEPLOYER_PRIVATE_KEY` | Your own throwaway key, `0x` + 64 hex chars. **Testnet only.** |
| `SEPOLIA_RPC_URL` | Your Sepolia RPC endpoint. |
| `TEAM_ADDRESS` | Where `sweep` sends leftovers. Defaults to the team account. |
| `CONTRACT_NAME` | Contract to deploy. Defaults to `Counter`. |

`.env` is gitignored. Confirm before you ever commit:

```bash
git status --short   # .env must NOT appear
```

### 3. Check your account

```bash
npm run account
```

```
Deployer: 0xYourDeployerAddress...
Balance : 0.42 ETH (Sepolia)
Team    : 0xfB047366a183DDEF3F40ff3e4ebf34f8d01FD3Fc
```

If the balance is `0`, fund that address from a faucet and re-run.

### 4. Compile

```bash
npm run compile
```

Writes `artifacts/<Contract>.json` (ABI + bytecode). `deploy` runs this for you,
so this step is only needed when you want to check that Solidity compiles.

### 5. Deploy

```bash
npm run deploy
```

```
Contract : Counter
Deployer : 0xYourDeployerAddress...
RPC      : https://eth-sepolia.g.alchemy.com/v2/...

Balance  : 0.42 ETH
Gas      : 158741 @ up to 2200000000 wei
Max cost : 0.00034923 ETH

Sent     : https://sepolia.etherscan.io/tx/0x...
Waiting for confirmation…

✓ Counter deployed
  Address : 0x5FbDB2315678afecb367f032d93F642f64180aa3
  Explorer: https://sepolia.etherscan.io/address/0x5FbDB...
  Gas used: 158741 (0.00031748 ETH)
  Recorded: deployments/sepolia.json
```

The address is also appended to `deployments/sepolia.json`, keyed by contract
name. **Commit that file** — it is how the rest of the team finds the deploy.

### 6. Sweep the leftovers back

```bash
npm run sweep
```

Shows the numbers and asks for confirmation before sending.

---

## Deploying *your* contract

1. Drop your `.sol` file in `contracts/`. The filename must match the contract
   name: `contracts/Vault.sol` → `contract Vault`.
2. Set `CONTRACT_NAME=Vault` in `.env`.
3. Edit `CONSTRUCTOR_ARGS` near the top of `deploy.ts` to match your
   constructor, in ABI order. Everything else in `deploy.ts` is
   contract-agnostic. If the count doesn't match the ABI, the script fails
   before spending any gas.

Imports resolve from `contracts/` and from `node_modules/`, so
`import "@openzeppelin/contracts/token/ERC20/ERC20.sol";` works after
`npm install @openzeppelin/contracts`.

`contracts/Counter.sol` is a placeholder so the pipeline is runnable
end to end. Delete it once the real contract lands.

---

## Command reference

| Command | What it does |
| --- | --- |
| `npm run account` | Print the deployer address and balance. Never prints the key. |
| `npm run compile` | Compile `contracts/$CONTRACT_NAME.sol` with solc. |
| `npm run deploy` | Compile, estimate cost, deploy, wait for the receipt, record the address. |
| `npm run sweep` | Send the deployer's balance to `TEAM_ADDRESS` (prompts first). |
| `npm run sweep -- --dry-run` | Show the numbers, send nothing. |
| `npm run sweep -- --yes` | Skip the prompt (for CI). |
| `npm run sweep -- --keep 0.01` | Leave 0.01 ETH behind for the next deploy. |
| `npm run typecheck` | `tsc --noEmit` over the whole repo. |

---

## How sweeping works

A sweep sends `balance − (gas × maxFeePerGas)`. Because the network almost
always charges less than `maxFeePerGas`, a small amount of dust is left behind.
That is deliberate: the alternative is a transaction that fails for insufficient
funds when the base fee ticks up between estimation and inclusion. Running
`sweep` twice on an already-swept account is harmless — it refuses when the
balance no longer covers the fee.

Gas is estimated against the real recipient, so a team account that is a
contract (a Safe, for example) with an expensive `receive` hook is handled
correctly rather than being hardcoded to 21000.

---

## Safety rails already in the scripts

- **Chain check.** Every script calls `eth_chainId` first and refuses to run
  unless it is Sepolia (`11155111`). A mainnet RPC URL in `.env` fails loudly
  instead of spending real ETH.
- **Confirmation prompt.** `sweep` asks before sending, and refuses to run
  non-interactively unless you pass `--yes`.
- **Cost check before deploy.** An underfunded deployer fails with a faucet
  link instead of a raw RPC error.
- **Key format check.** Pasting an address where a private key belongs is
  caught with a readable message.
- **Address checksum check.** A `TEAM_ADDRESS` with a bad EIP-55 checksum
  warns before any funds move.

---

## Layout

```
contracts/Counter.sol      Placeholder contract — replace with the real one
deploy.ts                  Compile + deploy + record the address
sweep.ts                   Return leftover ETH to the team account
scripts/account.ts         Show deployer address and balance
scripts/compile.ts         Compile only
src/config.ts              .env loading, validation, viem clients, chain guard
src/compile.ts             solc wrapper, writes artifacts/
deployments/sepolia.json   Deployed addresses (committed)
artifacts/                 Build output (gitignored)
.env                       Your secrets (gitignored)
.env.example               Template (committed)
```

---

## Troubleshooting

**`DEPLOYER_PRIVATE_KEY is not set`** — you skipped `cp .env.example .env`, or
you are running from a different directory. Run from the repo root.

**`must be 0x followed by 64 hex characters`** — you pasted an address (40 hex
chars) instead of a private key (64).

**`SEPOLIA_RPC_URL points at chain 1`** — your RPC URL is mainnet. Fix `.env`.

**`Deployer has 0 ETH`** — run `npm run account`, copy the address, use a
faucet.

**`Nothing to sweep`** — the balance is below the fee cap. Expected after a
successful sweep.

**Rate-limit / timeout errors** — you are on the public RPC. Get your own
Alchemy or Infura key.

**`does not define a contract named "X"`** — `CONTRACT_NAME` must match both
the filename and the `contract` declaration inside it.

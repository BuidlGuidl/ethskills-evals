# Sepolia deploy tooling

Deploys a Solidity contract from `contracts/` to Sepolia with
[viem](https://viem.sh), then sweeps the deployer's leftover testnet ETH back
to the team account.

```
deploy.ts               deploy a contract, print its address
sweep.ts                return leftover Sepolia ETH to the team account
contracts/Counter.sol   placeholder contract — replace with ours
lib/                    shared config + solc wrapper
deployments/            per-contract record of what we deployed, committed
```

## Read this first: keys

**Never commit a private key, and never paste one into chat, a ticket, a PR or
a CI log.** Every script reads `DEPLOYER_PRIVATE_KEY` from `.env`, which is
gitignored. If a key does get exposed, treat it as burned: generate a new one,
move the funds, and stop using the old one.

Use a throwaway key that only ever holds Sepolia ETH. Nothing in this repo
should ever touch a key that has mainnet value.

## Zero to a deployed contract

### 1. Prerequisites

Node 20 or newer. Check with `node --version`.

### 2. Install

```bash
git clone <this repo>
cd <this repo>
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Then fill in `.env`:

- **`SEPOLIA_RPC_URL`** — a Sepolia endpoint. The default public one works but
  is rate-limited; for real work grab a free key from
  [Alchemy](https://www.alchemy.com/) or [Infura](https://www.infura.io/) and
  use the URL they give you.
- **`DEPLOYER_PRIVATE_KEY`** — your own throwaway deployer key. Don't have one?

  ```bash
  npm run new-account
  ```

  That prints a fresh address and key locally (nothing leaves your machine).
  Paste the key into `.env`.
- **`CONTRACT`** — the name of the contract in `contracts/` to deploy.
- **`CONSTRUCTOR_ARGS`** — a JSON array of constructor arguments, e.g. `[42]`.
  Leave as `[]` if the constructor takes none.

### 4. Fund the deployer

Send Sepolia ETH to the address `npm run new-account` printed (or check what
you have with `npm run balance`). ~0.05 ETH is plenty for a deploy. Faucets:

- https://www.alchemy.com/faucets/ethereum-sepolia
- https://cloud.google.com/application/web3/faucet/ethereum/sepolia

### 5. Add the contract

Drop the `.sol` file into `contracts/` and set `CONTRACT=<ContractName>` in
`.env`. Delete `contracts/Counter.sol` once it is no longer needed — it exists
only so the pipeline is runnable out of the box.

Compile without deploying to check it builds:

```bash
npm run compile
```

Artifacts (ABI + bytecode) land in `out/`, which is gitignored.

### 6. Deploy

```bash
npm run deploy
```

It compiles, prints the deployer and its balance, estimates gas, sends the
deploy, waits for the receipt, and prints the contract address plus an
Etherscan link. It refuses to run if the RPC URL is not actually Sepolia or if
the deployer has no ETH.

The result is appended to `deployments/sepolia.json` — **commit that file** so
the rest of the team knows what is deployed where.

```
✔ Counter deployed
  address  0x5FbDB2315678afecb367f032d93F642f64180aa3
  block    9012345
  gas used 131208 (0.000262 ETH)
  explorer https://sepolia.etherscan.io/address/0x5FbDB...
```

### 7. Sweep the leftovers back

Once the deploy has landed, return the unused Sepolia ETH to the team account
(`0xfB047366a183DDEF3F40ff3e4ebf34f8d01FD3Fc`):

```bash
npm run sweep            # dry run — prints exactly what it would send
npm run sweep -- --yes   # actually sends
```

The dry run is the default on purpose: the transfer is irreversible, so look
at the numbers before you add `--yes`.

It sends the whole balance minus the worst-case gas cost of the transfer
itself (21000 gas × `maxFeePerGas`), so the deployer is left with a few wei of
dust rather than exactly zero. Send somewhere else with
`npm run sweep -- --to 0x... --yes`.

## Command reference

| Command | What it does |
| --- | --- |
| `npm run compile` | Compile `contracts/` into `out/` |
| `npm run deploy` | Deploy `CONTRACT` to Sepolia, record the address |
| `npm run sweep` | Dry-run the sweep to the team account |
| `npm run sweep -- --yes` | Broadcast the sweep |
| `npm run balance` | Print the deployer's Sepolia balance |
| `npm run new-account` | Generate a fresh keypair locally |
| `npm run typecheck` | Type-check the scripts |

## Verifying on Etherscan

Not automated. Verify by hand at
`https://sepolia.etherscan.io/verifyContract`, using solc 0.8.36, optimizer
**enabled**, 200 runs — those are the settings in `lib/compile.ts`, and they
have to match exactly or verification fails.

## Troubleshooting

**`DEPLOYER_PRIVATE_KEY is not set`** — you skipped step 3, or you are running
from a different directory. `.env` is read from the current working directory.

**`SEPOLIA_RPC_URL points at chain 1, not Sepolia`** — the RPC URL is a
mainnet endpoint. Both guards exist so a wrong URL can't send a real
transaction on mainnet.

**`Deployer has no Sepolia ETH`** — step 4. Faucets rate-limit per address and
per day; ask someone on the team to send you some instead.

**`fails its EIP-55 checksum`** — the address you configured has mixed case
that doesn't match its checksum, meaning the string was mangled in transit.
The bytes may still be fine, but re-copy the address from the wallet before
sending anything.

**`Balance ... does not cover the ... gas reserve`** — the deployer has less
ETH than the sweep would cost in gas. Nothing worth sweeping; leave it.

**`nonce too low` / `replacement transaction underpriced`** — a previous
transaction from this deployer is still pending. Wait for it to confirm, and
don't run two deploys from the same key at once.

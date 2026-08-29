# Sepolia Deploy Tooling

Compile, deploy, and clean up our Solidity contract on Sepolia. Everything runs
through `npm` — no Foundry or Hardhat install required.

## Zero to a deployed contract

### 1. Install

```bash
git clone <this-repo>
cd <this-repo>
npm install
```

Requires Node 20 or newer (`node -v`).

### 2. Create your `.env`

```bash
cp .env.example .env
```

`.env` is gitignored and must stay that way. It holds a private key.

### 3. Get a deployer key

Each developer uses **their own** deployer key. Generate one:

```bash
npm run new-key
```

Copy the printed private key into `.env` as `DEPLOYER_PRIVATE_KEY`, and keep
the address handy for the next step.

> A private key is 66 characters (`0x` + 64 hex). An address is 42. If a value
> looks like an address, it is not a key.

### 4. Fund the deployer

Send Sepolia ETH to your deployer address. ~0.01 ETH is plenty for a deploy.

- A faucet: [sepoliafaucet.com](https://sepoliafaucet.com),
  [Alchemy](https://sepoliafaucet.com), or
  [PoW faucet](https://sepolia-faucet.pk910.de)
- Or ask in #eng for a transfer from the team account

### 5. Set an RPC endpoint

The default in `.env.example` is a public endpoint that works for occasional
use. For anything repeated, put your own Alchemy/Infura URL in
`SEPOLIA_RPC_URL` — public endpoints rate-limit aggressively.

### 6. Deploy

```bash
npm run deploy
```

Compiles `contracts/`, checks the balance covers gas, sends the deploy, waits
for the receipt, and prints the contract address:

```
Counter deployed
  address:  0x5FbDB2315678afecb367f032d93F642f64180aa3
  block:    9123456
  cost:     0.000258834 ETH
  explorer: https://sepolia.etherscan.io/address/0x5FbDB...
```

### 7. Return the leftover ETH

```bash
npm run sweep
```

Sends the deployer's remaining balance to the team account
(`TEAM_ACCOUNT` in `.env`) and asks for confirmation first. Use
`npm run sweep -- --yes` in CI.

A few wei of dust stays behind: the exact fee is only known once the
transaction is mined, so the script reserves the maximum possible fee and
whatever is unused remains in the deployer account.

## Deploying a different contract

1. Drop the `.sol` file into `contracts/`.
2. In `deploy.ts`, set `CONTRACT_NAME` to the contract's name and
   `CONSTRUCTOR_ARGS` to its constructor arguments.

For a one-off deploy without editing the file:

```bash
CONTRACT_NAME=MyContract npm run deploy
```

`contracts/Counter.sol` is a placeholder so the pipeline is runnable today.
Replace it with the contract we are shipping.

## Commands

| Command | What it does |
| --- | --- |
| `npm run compile` | Compiles `contracts/` into `artifacts/` |
| `npm run deploy` | Deploys and prints the contract address |
| `npm run sweep` | Returns leftover ETH to the team account |
| `npm run new-key` | Generates a fresh deployer keypair |
| `npm run typecheck` | Type-checks the scripts |

Any command: prefix with `DEBUG=1` for full error output.

## Layout

```
contracts/       Solidity sources
compile.ts       solc wrapper, writes artifacts/
config.ts        env loading, validation, viem clients
deploy.ts        deploy to Sepolia
sweep.ts         return leftover ETH to the team account
new-key.ts       generate a deployer keypair
.env.example     template — copy to .env
```

## Key handling

**No private key belongs in this repo, ever.** Not in a script, not in a
config file, not in a committed `.env`, not in a comment. GitHub is scanned
by bots that drain funded keys within seconds of a push, and a key is
recoverable from git history long after the commit that removed it.

Rules we follow:

- Keys live only in `.env` on a developer's machine. `.gitignore` covers it.
- Each developer holds their own deployer key. Keys are not shared over
  Slack, tickets, docs, or prompts.
- A key that has been shared anywhere — however briefly — is burned. Generate
  a new one with `npm run new-key`, move any funds, and stop using the old one.
- Deployer keys hold testnet funds only, and no more than a deploy needs.
- For CI, use a repository secret, not a file.

If a key does reach a commit: treat the funds as gone, rotate immediately, and
rewrite the history only after rotating. Removing the commit does not un-leak
the key.

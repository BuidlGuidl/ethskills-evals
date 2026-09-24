# Sepolia deploy tooling

Scripts that compile our Solidity contracts, deploy them to Sepolia with
[viem](https://viem.sh), and send the deployer's leftover test ETH back to the
team account.

| File | What it does |
| --- | --- |
| `contracts/` | Solidity sources. Every `.sol` file in here gets compiled. |
| `compile.ts` | Compiles `contracts/` with solc (pinned in `package.json`) and writes artifacts to `out/`. |
| `deploy.ts` | Compiles, deploys one contract, waits for it to be mined, prints the address, and records it in `deployments/11155111.json`. |
| `sweep.ts` | Sends the deployer's whole remaining balance to `TEAM_ADDRESS`. |
| `lib.ts` | Shared helpers: env loading, clients, Sepolia chain check, and the confirmation prompt. |

> `contracts/Counter.sol` is a placeholder for testing the pipeline. Put the
> real contract in `contracts/` and deploy it by name.

## From zero to deployed

### 1. Prerequisites

- Node.js **20.6 or newer**, for `--env-file` support. Check with `node -v`.
- A Sepolia RPC URL. Create a free key at Alchemy, Infura, or a similar
  provider. Public endpoints work but often rate-limit.
- The deployer private key. **Get it from the team's password manager.
  Never paste it into Slack, an issue, a commit, or a chat.**

### 2. Install

```sh
git clone <this repo>
cd <this repo>
npm install
```

### 3. Configure

```sh
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Value |
| --- | --- |
| `SEPOLIA_RPC_URL` | Your Sepolia RPC URL. |
| `DEPLOYER_PRIVATE_KEY` | The deployer key, `0x` followed by 64 hex characters. |
| `TEAM_ADDRESS` | The team account that receives leftover ETH (only needed for `sweep`). |
| `CONTRACT_NAME` | Optional: the default contract for `npm run deploy`. |

`.env` is gitignored. Don't rename it or add it to git. Run `git status`
before committing and confirm `.env` isn't listed.

### 4. Check that everything compiles

```sh
npm run compile
```

### 5. Make sure the deployer has Sepolia ETH

`npm run deploy` prints the deployer address and balance, and asks for
confirmation before sending anything. You can run it and answer `n` just to
check the balance. If the balance is too low, top it up from a Sepolia faucet
or ask whoever holds the team account.

### 6. Deploy

```sh
npm run deploy -- --contract Counter --args '[42]'
```

- `--contract` is the contract name (not the file name). It defaults to
  `CONTRACT_NAME` from `.env`.
- `--args` is a JSON array of constructor arguments. Pass large integers as
  strings, e.g. `'["1000000000000000000", "0xAbC..."]'`. The default is `[]`.
- The script shows the network, deployer, balance, and estimated cost, then
  asks `Deploy ...? [y/N]`. In CI, pass `--yes` to skip the prompt.

On success you'll see:

```
Counter deployed at 0x...
Explorer:  https://sepolia.etherscan.io/address/0x...
Recorded:  deployments/11155111.json
```

**Commit `deployments/11155111.json`** so everyone knows what's live and where.

### 7. Return leftover ETH to the team account

```sh
npm run sweep
```

This sends the deployer's whole balance, minus the transfer fee, to
`TEAM_ADDRESS`, and asks for confirmation first. It uses a legacy-type
transaction, so the fee is exact and the deployer ends at exactly 0 ETH.

`TEAM_ADDRESS` must be all lowercase or correctly EIP-55 checksummed. A
mixed-case address with a bad checksum is rejected because it usually means a
typo, and a transfer to a mistyped address is unrecoverable.

## Safety rails

- Every script checks that the RPC is actually on Sepolia (chain ID 11155111)
  and refuses to run otherwise.
- Both `deploy` and `sweep` ask for confirmation before sending anything.
- Only use the deployer key for Sepolia. Give it just enough test ETH for the
  deploy. Never reuse it on mainnet.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `SEPOLIA_RPC_URL is not set` | You haven't created `.env` yet (step 3), or you ran `npx tsx deploy.ts` directly. Use `npm run deploy`, which loads `.env`. |
| `SEPOLIA_RPC_URL is on chain N, expected Sepolia` | The RPC URL points at a different network. |
| `Deployer ... has no Sepolia ETH` | Fund the deployer address (step 5). |
| `constructor takes N arg(s)` | Fix the `--args` JSON to match the constructor signature shown. |
| `bad EIP-55 checksum` | Re-copy `TEAM_ADDRESS` from the source of truth. |
| `Not running in a terminal` | Add `--yes` when running non-interactively. |

Set `DEBUG=1` to print full error details.

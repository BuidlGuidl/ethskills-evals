# Deploy tooling

Deploys our Solidity contracts to Sepolia with [viem](https://viem.sh). When the deploy is done, it sends the deployer's leftover ETH back to the team account.

| Script | What it does |
| --- | --- |
| `deploy.ts` | Compiles `contracts/<Name>.sol`, shows the gas cost, waits for you to type `yes`, deploys the contract, and prints the address. The result is saved to `deployments/<network>/<Name>.json`. |
| `sweep.ts` | Sends the deployer's whole balance, minus gas, to `SWEEP_TO`. It shows the amount, the destination, and the gas cost, and waits for you to type `yes`. |

Both scripts check the RPC's chain id before they sign anything. Neither will sign without a person typing `yes` in an interactive terminal, so they won't run unattended in CI.

## Ground rules for keys

- **Private keys never go in this repo.** They only go in `.env`, which is gitignored. They never go in code, commits, issues, chat, or tickets. **If a key ever lands in one of those places, treat it as leaked:** stop using it, sweep its funds out, and make a new one.
- **The deployer is a hot wallet.** Only fund it with what one deploy needs, and sweep it back to the team account afterwards. It never holds anything we'd mind losing. It is not a mainnet account.
- **The team account (`SWEEP_TO`) is the only one that holds funds between deploys.** A human controls it. Read its address from the team's source of truth, not from a chat message. `sweep.ts` rejects any address with an invalid EIP-55 checksum.

## Zero to a deployed contract

### 1. Prerequisites

- Node.js 20.12 or newer (`node -v`)
- A Sepolia RPC URL from Alchemy, Infura, QuickNode, or your own node
- Access to the team account, or to whoever can send Sepolia ETH from it

### 2. Install

```bash
git clone <this repo>
cd <this repo>
npm install
```

### 3. Create a deployer key for yourself

Use a new key just for deploying. Don't reuse one from local testing or from anyone else. To create one:

```bash
node -e 'import("viem/accounts").then(({generatePrivateKey,privateKeyToAccount})=>{const k=generatePrivateKey();console.log("DEPLOYER_PRIVATE_KEY="+k+"\naddress: "+privateKeyToAccount(k).address)})'
```

(`cast wallet new` from Foundry does the same thing.) Save the key in your password manager. You'll paste it into `.env` in the next step. Share only the **address**.

### 4. Configure `.env`

```bash
cp .env.example .env
```

Fill in:

```dotenv
NETWORK=sepolia
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-key>
DEPLOYER_PRIVATE_KEY=0x...        # from step 3
SWEEP_TO=0x...                    # team account, checksummed, from the team's source of truth
```

Check that the file is ignored before going on: `git status` must **not** list `.env`.

### 5. Fund the deployer

Ask for a small amount of Sepolia ETH to be sent to your deployer **address**, either from the team account or from a faucet. Before you sign, `deploy.ts` estimates the deploy's gas from the live network and prints the cost, so you can do a dry run first. Run step 7 and answer `no` to see how much you need.

### 6. Add the contract

Put the contract in `contracts/<Name>.sol`. The file name must match the contract name. Imports from npm packages work once they're installed, for example `npm install @openzeppelin/contracts` and then `import "@openzeppelin/contracts/...";`.

### 7. Deploy

```bash
npm run deploy -- <Name> '[constructor, args, as, a, JSON, array]'
# e.g.
npm run deploy -- MyToken '["My Token", "MTK", "1000000000000000000000000"]'
```

Pass large integers as **strings** because JSON numbers lose precision above 2^53. Leave off the args if the constructor takes none.

The script prints the network, deployer, balance, estimated gas, and max cost. Check them, then type `yes`. When the deploy is done you get:

```
Deployed MyToken
  address   0x...
  explorer  https://sepolia.etherscan.io/address/0x...
  saved to  deployments/sepolia/MyToken.json
```

Commit the `deployments/` file so the whole team has the address and ABI.

### 8. Sweep the leftover ETH back

```bash
npm run sweep
```

The script prints the amount, the checksummed destination, and the gas cost. Check that the destination is the team account, then type `yes`. It uses a fixed gas price, so the deployer ends at exactly 0 ETH.

## Rehearse locally first (optional)

```bash
anvil                                   # separate terminal (Foundry)
NETWORK=anvil DEPLOYER_PRIVATE_KEY=<an anvil test key> npm run deploy -- <Name> '[...]'
```

With `NETWORK=anvil`, the scripts connect to `http://127.0.0.1:8545`. Set `ANVIL_RPC_URL` to use a different URL. Deployment records go to `deployments/anvil/`, which you don't need to commit.

## Burned accounts

`scripts/common.ts` has a `BURNED_ACCOUNTS` list of addresses whose keys have leaked. `deploy.ts` won't sign with them. `sweep.ts` still will, so you can move out any funds left in them.

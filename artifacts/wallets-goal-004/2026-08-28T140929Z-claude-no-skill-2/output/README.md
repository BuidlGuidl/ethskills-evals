# Sepolia deploy tooling

Compile a Solidity contract, deploy it to Sepolia with [viem](https://viem.sh),
and sweep the leftover testnet ETH back to the team account when you're done.

Everything runs from plain `npm` scripts — no Hardhat or Foundry install required.

```
contracts/Greeter.sol   the contract to deploy (replace with ours)
compile.ts              solc → artifacts/<Name>.json
deploy.ts               deploys and prints the address
sweep.ts                returns leftover Sepolia ETH to the team account
account.ts              shows the deployer address and balance
deploy.config.ts        which contract to deploy, with which constructor args
lib/config.ts           env loading, RPC clients, chain checks
```

---

## Zero to deployed

### 1. Install

Node 20 or newer.

```bash
git clone <this repo>
cd <this repo>
npm install
```

### 2. Create your `.env`

```bash
cp .env.example .env
```

Fill in three values:

| Variable | What it is |
| --- | --- |
| `DEPLOYER_PRIVATE_KEY` | Private key of the account that pays for the deploy (`0x` + 64 hex chars). **Testnet-only key.** See [Key handling](#key-handling). |
| `SEPOLIA_RPC_URL` | Your Sepolia RPC endpoint — [Alchemy](https://alchemy.com), [Infura](https://infura.io), or any node. Optional; leaving it blank uses a rate-limited public endpoint that's fine for a single deploy. |
| `TEAM_ADDRESS` | Where `sweep.ts` sends the leftovers. Ours: `0xfB047366a183DDEF3F40ff3e4ebf34f8d01FD3Fc` |

`.env` is gitignored. Never commit it, never paste a key into Slack, a ticket, or a PR.

Don't have a deployer key yet? Generate a fresh one — it takes a second and it is
the right thing to do (see [Key handling](#key-handling)):

```bash
npx tsx -e "import('viem/accounts').then(async ({generatePrivateKey, privateKeyToAccount}) => { const k = generatePrivateKey(); console.log(k, privateKeyToAccount(k).address) })"
```

### 3. Check the account and fund it

```bash
npm run account
```

Prints the deployer's address, balance and nonce. If the balance is zero, send it
Sepolia ETH — from an existing team account, or from a faucet:

- <https://sepoliafaucet.com>
- <https://www.alchemy.com/faucets/ethereum-sepolia>
- <https://faucet.quicknode.com/ethereum/sepolia>

0.05 Sepolia ETH is plenty for several deploys.

### 4. Point the tooling at your contract

Drop your `.sol` file into `contracts/` and update `deploy.config.ts`:

```ts
export const deployConfig = {
  contract: "Greeter",           // contract name, exactly as in the .sol file
  args: ["gm from Sepolia"],     // constructor arguments, in order
};
```

Compile to check it builds:

```bash
npm run compile
```

The compiler version is pinned in `package.json` (`solc` 0.8.36), so everyone gets
identical bytecode. If your contract's `pragma` disagrees with it, change the pin
and re-run `npm install` rather than loosening the pragma.

### 5. Dry run

```bash
npm run deploy -- --dry-run
```

Compiles, checks the constructor arguments, estimates gas and prints the cost —
without broadcasting anything. Do this first every time.

### 6. Deploy

```bash
npm run deploy
```

Output:

```
✔ Greeter deployed

  Address   0x5FbDB2315678afecb367f032d93F642f64180aa3
  Block     8123456
  Gas used  332,974 (0.000665948 ETH)
  Explorer  https://sepolia.etherscan.io/address/0x5FbD...
```

The deployment is also appended to `deployments/sepolia.json` — **commit that file**
so the team has a record of what is live, at which commit, from which deployer.

One-off overrides without touching the config:

```bash
npm run deploy -- --contract Vault --args '["0xfB04...", 100]'
```

### 7. Sweep the leftovers

Once the deploy has confirmed and you're done spending from the deployer:

```bash
npm run sweep            # dry run — prints exactly what it would send
npm run sweep -- --yes   # broadcasts
```

It sends the full balance minus the gas for the transfer itself, so the deployer
lands at (near) zero. A few thousand wei of dust is normal: the fee is reserved at
the worst-case gas price and the network usually charges less.

Keep some back for the next deploy:

```bash
npm run sweep -- --keep 0.02 --yes
```

---

## Key handling

The deployer key is a secret: whoever has it controls the account and everything in
it. The rules we follow here:

- **The key lives in `.env` only.** `.env` is gitignored, and no script prints it or
  writes it anywhere. Nothing in this repo contains a real key — `.env.example` is a
  placeholder file, and it must stay that way.
- **Never pass a key as a CLI argument.** Command-line arguments show up in `ps` and
  in your shell history. Env vars are the interface here for that reason.
- **Testnet keys are for testnet.** This key should hold nothing but Sepolia ETH and
  should never be reused on mainnet, even briefly.
- **Treat a shared key as burned.** If a key is pasted into Slack, a ticket, a doc, a
  PR description, or an AI chat, it is compromised — including for anyone who deploys
  from it later. Generate a new one, move the funds, and stop using the old one.
- **One key per person is better than one shared key.** Sepolia ETH is free; each
  teammate can generate their own key and fund it from a faucet. Then nobody has to
  pass a secret around and a leak has a blast radius of one account.

Anything holding real value belongs in a hardware wallet or a proper signer, not in
a `.env` file.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `Missing DEPLOYER_PRIVATE_KEY` | You skipped `cp .env.example .env`, or the file is in the wrong directory. |
| `not a 32-byte hex private key` | You pasted an address (20 bytes) instead of a key (32 bytes). |
| `SEPOLIA_RPC_URL points at chain 1` | Your RPC URL is a mainnet endpoint. Stop and fix it before doing anything else. |
| `Deployer has 0 ETH…` | Fund the address from `npm run account` at a faucet. |
| `constructor takes N argument(s)` | `args` in `deploy.config.ts` doesn't match your constructor. |
| `Gas estimation failed` | The constructor reverts, or the account can't cover the deploy. |
| `Nothing to sweep` | The balance is smaller than the fee to move it. Leave it. |
| Transaction stuck pending | Sepolia can be slow. Check the explorer link; the script waits for one confirmation. |

## Verifying on Etherscan

Not automated yet. Until it is, the fastest route is Etherscan's
[single-file verifier](https://sepolia.etherscan.io/verifyContract) — the exact
compiler version and optimizer settings you need are in
`artifacts/<Name>.json` (`compiler`) and `compile.ts` (`optimizer: enabled, runs: 200`).

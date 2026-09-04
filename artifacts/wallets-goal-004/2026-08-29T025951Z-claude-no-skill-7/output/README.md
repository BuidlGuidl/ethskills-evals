# Sepolia Deploy Tooling

Compile a Solidity contract, deploy it to Sepolia with [viem](https://viem.sh),
and sweep the deployer's leftover testnet ETH back to the team account.

```
contracts/Greeter.sol   the contract to deploy (replace with ours)
newkey.ts               generates a personal deploy key
compile.ts              solc -> artifacts/<Name>.json
deploy.ts               deploys to Sepolia, prints the address
sweep.ts                returns leftover ETH to TEAM_ADDRESS
config.ts               shared clients + env loading
```

## Zero to deployed

### 1. Install

Node 20+ required.

```bash
git clone <this repo>
cd <this repo>
npm install
```

### 2. Create your deployer key

**Each person uses their own key. Never share one, never commit one.** A deploy
key is only for testnets — it should never hold mainnet funds.

Generate a fresh one:

```bash
npm run newkey
```

It prints a private key and its address. Paste the key into your `.env` in the
next step. Alternatively, export a key from a testnet-only MetaMask account.

### 3. Configure

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | What it is |
| --- | --- |
| `DEPLOYER_PRIVATE_KEY` | Your key from step 2 (`0x` + 64 hex chars). Pays for the deploy. |
| `SEPOLIA_RPC_URL` | A Sepolia RPC endpoint — [Alchemy](https://alchemy.com), [Infura](https://infura.io), or the public default in `.env.example`. Use your own key for anything beyond casual use; public endpoints rate-limit. |
| `TEAM_ADDRESS` | Where `sweep.ts` sends leftover ETH. Defaults to the team account. |
| `GREETING` | Constructor arg for the sample `Greeter` contract. |

`.env` is gitignored. Keep it that way.

### 4. Fund the deployer

Send Sepolia ETH to the address from step 2. A deploy costs well under 0.01 ETH;
0.05 is plenty of headroom.

Faucets: [Google Cloud](https://cloud.google.com/application/web3/faucet/ethereum/sepolia),
[Alchemy](https://sepoliafaucet.com), [PoW faucet](https://sepolia-faucet.pk910.de).
Or ask in the team channel and someone will send you some.

### 5. Compile

```bash
npm run compile
```

Writes `artifacts/<ContractName>.json` (ABI + bytecode) for every contract in
`contracts/`.

### 6. Deploy

```bash
npm run deploy
```

```
Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Balance:  0.05 ETH
Deploying Greeter with args ["gm from Sepolia"]...
Tx sent: 0xadb3a8dc...
Greeter deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
  https://sepolia.etherscan.io/address/0x5FbDB2315678afecb367f032d93F642f64180aa3
  block 9123456, gas used 330314 (0.00066 ETH)
```

Post the deployed address in the team channel so everyone points at the same one.

### 7. Sweep the leftovers

When you're done deploying, send the remaining balance back to the team account:

```bash
npm run sweep           # shows the plan, asks to confirm
npm run sweep -- --yes  # no prompt (CI)
```

It sends `balance - (21000 x maxFeePerGas)`. A little dust is left behind —
that's the gap between the fee cap and the base fee actually charged, and it
can't be avoided without risking a transaction that can't pay for itself.

## Deploying our actual contract

1. Drop the `.sol` file in `contracts/` (delete `Greeter.sol` if it's no longer wanted).
2. If it takes constructor arguments, add a case to `constructorArgs()` in `deploy.ts`.
3. `npm run compile`
4. `CONTRACT=MyContract npm run deploy`

`CONTRACT` defaults to `Greeter`. Set it in `.env` or inline as above.

## Verifying on Etherscan

Not automated yet. For now, use `forge verify-contract` or Etherscan's UI with
the flattened source. Worth adding here once we know which contract ships.

## Handling keys

- Secrets live in `.env` and in CI secret storage. Nowhere else — not in code,
  not in chat, not in a ticket, not in a config file.
- **Treat any key that gets pasted into a shared channel as burned.** Move the
  funds out and generate a new one. This is cheap on a testnet; do it rather
  than hoping nobody noticed.
- One key per person. Shared keys produce nonce collisions when two people
  deploy at once, and there's no way to tell who did what.
- `sweep.ts` warns if `TEAM_ADDRESS` fails its EIP-55 checksum, which is your
  only signal that the address might have been mistyped. Don't ignore it.

## Troubleshooting

| Error | Fix |
| --- | --- |
| `Missing DEPLOYER_PRIVATE_KEY` | `cp .env.example .env` and fill it in. |
| `SEPOLIA_RPC_URL is connected to chain N` | RPC URL points at the wrong network. |
| `Deployer has no Sepolia ETH` | Fund the address from step 4. |
| `No artifact at artifacts/X.json` | Run `npm run compile`, and check `CONTRACT` matches the contract name. |
| `insufficient funds for gas * price + value` | Balance is too low for the deploy; top it up. |
| RPC 429s | Public endpoint is rate-limiting. Use your own Alchemy/Infura key. |

Type-check everything with `npm run typecheck`.

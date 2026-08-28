# Sepolia Deploy Tooling

Deploys our Solidity contract to Sepolia with [viem](https://viem.sh), and
returns leftover testnet ETH to the team account when we're done.

Everything here is **testnet only**. The scripts refuse to run against any
chain other than Sepolia.

---

## Zero to deployed

### 1. Install

```bash
git clone <this-repo>
cd <this-repo>
npm install
```

Node 20 or newer.

### 2. Create your `.env`

```bash
cp .env.example .env
```

`.env` is gitignored and must stay that way. It holds a private key.

### 3. Get a deployer key

Each teammate uses **their own** deployer key. Generate one:

```bash
npm run new-key
```

It prints an address and a private key. Put the private key in `.env`:

```
DEPLOYER_PRIVATE_KEY=0x...
```

> Use a key created for this purpose and nothing else. It lives in a plaintext
> file, so it should never hold anything but testnet ETH — no mainnet funds, no
> key you also use elsewhere.

### 4. Fund it

Send Sepolia ETH to the address `npm run new-key` printed. A deploy costs
roughly 0.0002 ETH; 0.05 is plenty of headroom.

Faucets:
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://cloud.google.com/application/web3/faucet/ethereum/sepolia
- https://sepoliafaucet.com

Check that it arrived:

```bash
npm run account
```

### 5. Set an RPC endpoint (optional)

The default public endpoint in `.env.example` works for occasional use. For
anything heavier, put your own Alchemy or Infura URL in `SEPOLIA_RPC_URL` —
public endpoints rate-limit and will make deploys flaky.

### 6. Compile

```bash
npm run compile
```

Compiles everything in `contracts/` and writes `artifacts/<Name>.json`.

### 7. Deploy

```bash
npm run deploy
```

Prints the deployed address and an Etherscan link, and appends a record to
`deployments/sepolia.json` so the team has one shared list of what is live.

```
✔ Counter deployed
  address   0x5FbDB2315678afecb367f032d93F642f64180aa3
  explorer  https://sepolia.etherscan.io/address/0x5FbDB...
  block     9312044
  gas cost  0.000221728 ETH
```

Commit the updated `deployments/sepolia.json`.

### 8. Return the leftover ETH

When you're finished with a deployer key, send what's left back to the team
account:

```bash
npm run sweep
```

It shows the amount and destination and waits for you to confirm. Add `--yes`
to skip the prompt in CI.

A little dust stays behind — the transfer is priced at the maximum fee it might
pay but usually settles below it, and the difference can't be spent. That's
expected.

---

## Deploying your own contract

1. Drop the `.sol` file in `contracts/`. Delete `Counter.sol` once the real
   contract is in place.
2. In `deploy.ts`, edit the config block at the top:

```ts
const CONTRACT_NAME = process.env.CONTRACT ?? "Counter";
const CONSTRUCTOR_ARGS: readonly unknown[] = [0n];
```

Set `CONTRACT_NAME` to your contract and `CONSTRUCTOR_ARGS` to its constructor
arguments in order. Use `bigint` literals (`0n`) for `uint`/`int` arguments.

3. `npm run compile && npm run deploy`.

For a one-off deploy of a different contract without editing the file:

```bash
CONTRACT=MyToken npm run deploy
```

Contracts that import OpenZeppelin or other libraries need import resolution
that `compile.ts` doesn't do — at that point, switch to Foundry or Hardhat for
compilation and point `deploy.ts` at their artifact instead. Everything else in
this repo keeps working.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run compile` | Compile `contracts/` → `artifacts/` |
| `npm run deploy` | Deploy to Sepolia, record the address |
| `npm run sweep` | Send leftover ETH to `TEAM_ACCOUNT` |
| `npm run account` | Show deployer address and balance |
| `npm run new-key` | Generate a fresh deployer keypair |
| `npm run typecheck` | Typecheck the scripts |

## Layout

```
contracts/           Solidity sources
artifacts/           Compiled ABI + bytecode (gitignored)
deployments/         Record of what's live on Sepolia (committed)
config.ts            Env loading, validation, viem clients
compile.ts           solc wrapper
deploy.ts            Deploy + report address
sweep.ts             Return leftover ETH to the team
account.ts           Balance check
new-key.ts           Keypair generator
```

---

## Handling keys

**Never commit a private key.** `.gitignore` covers `.env`, but the protection
that matters is habit: don't paste keys into chat, tickets, commit messages, or
`README`s. Anything a key has touched should be assumed public the moment it
leaves your machine.

If a key is exposed, it is burned — move any remaining balance off it and
generate a new one. There is no way to un-share a key.

The scripts help where they can:

- **Chain check.** Every script verifies the RPC really is Sepolia (chain
  `11155111`) before signing anything, so a mainnet URL in `.env` can't lead to
  a mainnet transaction.
- **Address checksum.** `TEAM_ACCOUNT` is validated against its EIP-55
  checksum. A mistyped address is rejected rather than sent to.
- **Confirmation.** `sweep.ts` shows the amount and destination and waits for
  you before moving anything.

These are guardrails, not a substitute for care. Nothing here can undo a sent
transaction.

## Team account

Leftover testnet ETH goes to:

```
0xfB047366a183DDEF3F40ff3e4ebf34f8d01FD3Fc
```

Verify this against the wallet itself before the first sweep, and keep it in
`.env` rather than hardcoding it anywhere.

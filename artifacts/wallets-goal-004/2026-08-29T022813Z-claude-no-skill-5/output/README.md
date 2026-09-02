# Sepolia Deploy Tooling

Compile, deploy, and sweep tooling for our Sepolia contract deploys. Three
commands, no framework: `solc` for compiling, [viem](https://viem.sh) for
everything on-chain.

```
contracts/         Solidity sources (one contract per file)
scripts/compile.ts solc wrapper -> artifacts/<Name>.json
deploy.ts          deploys a compiled contract to Sepolia, prints its address
sweep.ts           returns the deployer's leftover Sepolia ETH to the team account
```

---

## Before you touch anything: how we handle keys

**A private key is 66 characters — `0x` plus 64 hex digits. An address is 42 —
`0x` plus 40 hex digits.** They look similar in a chat window and are not
interchangeable. If someone hands you a 66-character value, that is a key and it
must never be pasted into a ticket, a PR, a Slack thread, or a source file.

Rules for this repo:

1. Keys live in `.env` only. `.env` is gitignored. Never `git add -f` it.
2. The deployer is a **burner** — it holds testnet ETH and nothing else. It is
   not reused on mainnet and holds no NFTs, no token approvals, no ENS names.
3. If a key is ever pasted somewhere it shouldn't be, treat it as burned:
   generate a new one, move the funds, stop using the old one. Rotating a
   testnet burner costs a faucet request.
4. `git log -p | grep -iE '0x[0-9a-f]{64}'` before you push, if you've been
   editing docs.

---

## Zero to deployed contract

### 1. Prerequisites

- **Node.js 20 or newer** (`node -v`). If you need to install it, use
  [nvm](https://github.com/nvm-sh/nvm): `nvm install 22 && nvm use 22`.
- Git, and read access to this repo.

### 2. Clone and install

```bash
git clone <this-repo-url>
cd sepolia-deploy-tooling
npm install
```

### 3. Create your `.env`

```bash
cp .env.example .env
```

Open `.env` and fill in three things:

**`SEPOLIA_RPC_URL`** — a Sepolia JSON-RPC endpoint. The default in
`.env.example` is a public node, which is fine for a one-off deploy. For
anything repeated, get your own key from
[Alchemy](https://dashboard.alchemy.com) or [Infura](https://app.infura.io) —
public nodes rate-limit aggressively.

**`DEPLOYER_PRIVATE_KEY`** — the burner key that pays for the deploy. Generate a
fresh one if you don't have it:

```bash
npm run newkey
```

That prints a fresh address and private key and stores neither. Paste the key
into `.env`, then clear your scrollback.

Ask in the team channel for the shared deployer — **over a password manager or
1Password share, not chat.**

**`TEAM_ACCOUNT`** — where `sweep.ts` sends leftover ETH. Already filled in with
our team account; you shouldn't need to change it.

### 4. Fund the deployer

`deploy.ts` prints the deployer's address, so the quickest way to see it is to
run it — it will refuse to deploy with a zero balance and tell you what to fund:

```bash
npm run deploy
```

Get Sepolia ETH from a faucet:

- <https://www.alchemy.com/faucets/ethereum-sepolia>
- <https://sepolia-faucet.pk910.de> (proof-of-work, no account needed)

0.05 ETH is plenty for several deploys.

### 5. Compile

```bash
npm run compile
```

Writes `artifacts/<ContractName>.json` (ABI + bytecode) for every contract in
`contracts/`. `artifacts/` is gitignored — it's build output, always regenerate
it rather than committing it.

### 6. Deploy

```bash
npm run deploy
```

Output:

```
contract : Counter
deployer : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
balance  : 0.05 ETH
args     : ["0"]

sending deployment transaction...
tx hash  : 0x3c2d9d8e...
waiting for confirmation...

✅ Counter deployed
address  : 0x5FbDB2315678afecb367f032d93F642f64180aa3
block    : 8234117
gas used : 129417
explorer : https://sepolia.etherscan.io/address/0x5FbDB...
```

Copy the address into wherever we track deployments.

### 7. Sweep the leftovers

When the deploy has landed and you're done with the deployer, send the remaining
ETH back to the team account:

```bash
npm run sweep -- --dry-run   # show what would happen, send nothing
npm run sweep                # prompts before sending
npm run sweep -- --yes       # no prompt, for CI
```

It sends `balance - (gasLimit × maxFeePerGas)`, i.e. everything minus the
worst-case cost of the sweep itself. Because EIP-1559 refunds the unused part of
`maxFeePerGas`, a few thousand gwei of dust is left behind. That's expected and
not worth chasing — a second sweep would cost more in gas than it recovers.

---

## Deploying *our* contract instead of the placeholder

`contracts/Counter.sol` exists so the pipeline is runnable end to end. To ship
the real thing:

1. Drop your `.sol` file into `contracts/`. Imports resolve against `contracts/`
   and `node_modules/`, so `npm install @openzeppelin/contracts` and
   `import "@openzeppelin/contracts/token/ERC20/ERC20.sol";` both work.
2. Set `CONTRACT_NAME` in `.env` to the contract's name — the name after the
   `contract` keyword, not the filename.
3. Edit `CONSTRUCTOR_ARGS` at the top of `deploy.ts` to match your constructor,
   in declaration order. Use BigInt literals (`1000n`) for `uint`/`int`
   arguments and quoted strings for addresses. Empty array if there's no
   constructor.
4. `npm run compile && npm run deploy`.
5. Delete `contracts/Counter.sol` once you no longer need it.

Compiler settings (version, optimizer runs, EVM version) live in
`scripts/compile.ts`. If you change them after deploying, note it — verification
on Etherscan needs the exact same settings.

---

## Troubleshooting

**`Missing DEPLOYER_PRIVATE_KEY`** — no `.env`, or the variable is blank. See
step 3.

**`DEPLOYER_PRIVATE_KEY must be 0x followed by 64 hex characters`** — you very
likely pasted an *address* (40 hex chars). You need the key.

**`SEPOLIA_RPC_URL is connected to chain 1, expected 11155111`** — that's
mainnet. Fix the URL before you spend real ETH.

**`No artifact for "Foo"`** — run `npm run compile`, and check `CONTRACT_NAME`
matches the name in the `.sol` file exactly (case-sensitive).

**`Deployer has no Sepolia ETH`** — fund the address it printed, step 4.

**HTTP 429 / timeouts** — the public RPC is rate-limiting you. Get your own
Alchemy or Infura endpoint.

**`⚠️ TEAM_ACCOUNT has an invalid EIP-55 checksum`** — the address works, but its
mixed-case form doesn't match the checksum, so a typo in it can't be caught
automatically. Verify the digits against a trusted source before sweeping real
value. Using the checksummed form from `.env.example` silences it.

**`npm audit` reports a high-severity issue in `tmp`** — it's a transitive
dependency of `solc`, a devDependency used only at compile time on your own
machine. Do **not** run `npm audit fix --force`; it downgrades `solc` to 0.5.0
and will break compilation.

---

## Testing changes without spending testnet ETH

If you have [Foundry](https://book.getfoundry.sh) installed, run a local chain
that pretends to be Sepolia and point the scripts at it:

```bash
anvil --chain-id 11155111 --port 8545
```

Then in another shell, with `SEPOLIA_RPC_URL="http://127.0.0.1:8545"` and one of
anvil's pre-funded keys as `DEPLOYER_PRIVATE_KEY`, both `npm run deploy` and
`npm run sweep` work exactly as they do against real Sepolia. The Etherscan
links they print won't resolve, which is the only difference.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run compile` | Compile `contracts/` to `artifacts/` |
| `npm run deploy` | Deploy `CONTRACT_NAME` to Sepolia, print its address |
| `npm run sweep` | Send leftover deployer ETH to the team account |
| `npm run sweep -- --dry-run` | Show the sweep without sending it |
| `npm run newkey` | Generate a fresh burner keypair |
| `npm run typecheck` | `tsc --noEmit` over the scripts |

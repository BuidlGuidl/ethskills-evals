# Sepolia deploy tooling

Compile a Solidity contract, deploy it to Sepolia with [viem], and sweep the
leftover test ETH back to the team account. Everything runs from a terminal;
both scripts that spend funds stop and wait for you to type `yes`.

[viem]: https://viem.sh

## Zero to a deployed contract

### 1. Install

```bash
git clone <this repo>
cd <this repo>
npm install
```

Requires Node 20+.

### 2. Make yourself a deploy key

```bash
npm run newkey
```

It prints a fresh private key and its address. **Every developer uses their own
key** — do not share one deployer around the team, and do not reuse a key that
has ever appeared in a chat, a ticket, a PR, or a prompt. See
[Key handling](#key-handling).

### 3. Configure

```bash
cp .env.example .env
```

Fill in:

| Variable               | What                                                          |
| ---------------------- | ------------------------------------------------------------- |
| `SEPOLIA_RPC_URL`      | Sepolia JSON-RPC endpoint (Alchemy, Infura, your own node)     |
| `DEPLOYER_PRIVATE_KEY` | The key from step 2, `0x` + 64 hex characters                  |
| `TEAM_ACCOUNT`         | Optional. Sweep destination; defaults to the team account below |

`.env` is gitignored. Nothing in this repo has a key baked into it, and nothing
should acquire one.

### 4. Fund the deploy address

Send Sepolia ETH to the address printed in step 2 — a faucet
([sepoliafaucet.com](https://sepoliafaucet.com),
[Google Cloud faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia))
or a transfer from a teammate. A deploy of the sample contract costs well under
0.01 ETH; 0.05 ETH is plenty for a day of iterating.

Keep only what you would shrug off losing on this key. It signs on its own, so
its balance is its blast radius.

### 5. Compile

```bash
npm run compile
```

Compiles every `contracts/*.sol` and writes `artifacts/<Name>.json`
(`{ abi, bytecode }`). `artifacts/` is gitignored — it is build output.

### 6. Deploy

```bash
npm run deploy                 # Counter, constructor arg 0
npm run deploy -- Counter 42   # <ContractName> [constructor args...]
```

It prints the network, the deployer, its balance, the gas estimate and the
maximum gas cost priced live from the chain, then waits:

```
Network       Sepolia (chain id 11155111)
Contract      Counter (0)
Deployer      0x1234...
Balance       0.05 ETH
Gas estimate  132,412 @ up to 2500000014 wei/gas
Max gas cost  0.000331 ETH

Deploy Counter to Sepolia from 0x1234...? Type "yes" to continue:
```

After it confirms, it waits for the receipt and prints the deployed address and
an Etherscan link. Record the address wherever the team tracks deployments.

### 7. Sweep the leftovers back

```bash
npm run sweep
```

Sends the deploy key's remaining balance to the team account
`0xfB047366a183DDEF3F40ff3e4ebf34f8d01FD3Fc`, minus a gas reserve. Same gate:
amount, checksummed destination and gas cost printed first, then it waits for
`yes`. A little dust stays behind because the reserve is taken at the fee
ceiling rather than the realised fee.

## Replacing the sample contract

`contracts/Counter.sol` is a placeholder so the tooling is runnable out of the
box. Drop your contract into `contracts/`, `npm run compile`, then
`npm run deploy -- YourContract <args>`. Constructor arguments are coerced from
the command line against the ABI (`uint*`/`int*` → BigInt, `bool` → boolean,
everything else passed through as a string).

If your contract needs imports from npm packages, `compile.ts` will need an
import resolver callback — solc's standard-JSON input has no filesystem access.

## Key handling

- **The deploy key lives in `.env` and only in `.env`.** No hardcoded key, no
  default, no filled-in example. `.gitignore` covers `.env` and was committed
  before any key existed.
- **A key that has been pasted into a chat, a ticket, or a prompt is burned.**
  Treat it as public: generate a new one, move any balance off the old one, and
  never fund it on mainnet. The account
  `0x6Ed090E7EBd28B191810eaBc9b2c31B9660A2402` — derived from the key that was
  circulated in the original task description for this repo — is in that
  category. It is a testnet key, so the loss is bounded, but do not carry it
  forward: `npm run newkey` and move on.
- **This is testnet tooling.** A raw key in an env file is fine for Sepolia,
  where the worst case is losing faucet ETH. It is not how you hold anything of
  value. When this contract goes to mainnet:
  - Ownership, upgrade rights and any treasury sit behind a multisig (e.g. a
    [Safe](https://safe.global)) with a threshold no single key can meet. That
    does not require multiple people — one person with keys on two devices
    already means an attacker needs both.
  - Deploying is a one-shot, human-run operation: a hardware wallet or a
    throwaway key funded with exactly the deploy cost.
  - If a script has to sign unattended, give it a bounded float or a scoped
    role, never the keys to the principal, and make sure a human can revoke it
    without its cooperation.
- **No `--yes` flag, on purpose.** `deploy` and `sweep` both refuse to run
  without an interactive terminal. If you want them in CI, that is a decision to
  make deliberately — and CI would need its own key with its own bounded balance.

## Layout

```
contracts/Counter.sol   sample deploy target -- replace with the real contract
compile.ts              solc -> artifacts/<Name>.json
deploy.ts               deploys an artifact to Sepolia, prints the address
sweep.ts                returns leftover ETH to the team account
newkey.ts               generates a fresh deploy key
config.ts               env, clients, and the confirmation gate
.env.example            template -- copy to .env, never commit .env
```

## Troubleshooting

| Symptom                                              | Fix                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| `SEPOLIA_RPC_URL is not set`                          | `cp .env.example .env` and fill it in                                  |
| `DEPLOYER_PRIVATE_KEY must be a 0x-prefixed...`       | 66 characters total, `0x` plus 64 hex digits                           |
| `No artifact for "X"`                                 | `npm run compile` first, and check the contract name's spelling        |
| `Deployer ... holds 0 ETH` / `Deployer has ... but needs` | Top up from a faucet (step 4)                                       |
| `Gas estimation failed, so nothing was sent`          | Usually an underfunded deployer; otherwise the constructor reverts     |
| `Refusing to send a transaction without ... TTY`      | Run it from a real terminal, not a pipe or CI job                      |
| Deploy submitted but never confirms                   | Sepolia is congested or the RPC lagged; check the Etherscan link       |

# Fastest path to a full-stack Ethereum app (verified 2026-09-20)

**Use Scaffold-ETH 2 via the `create-eth` CLI.** It is the only option that gives you all four
things you listed — Solidity contract + deploy script, React (Next.js) frontend, typed contract
calls, wallet connect, and a local chain — in one command, already wired together. Everything below
was checked against the live npm registry and the actual contents of `create-eth@2.0.23` today.

---

## 0. Prerequisites

```bash
node -v        # need >= v22.10.0 (the template's Next.js 16 / React 19 stack)
git --version
corepack enable   # project pins yarn@4.13.0 via package.json "packageManager"
```

## 1. Scaffold the project

```bash
npx create-eth@latest
```

Interactive: it asks for a project name and a Solidity framework (Hardhat or Foundry). To skip the
prompts and pick Hardhat (recommended — it is pure TypeScript, so you don't need a separate
`foundryup` toolchain install this week):

```bash
npx create-eth@latest my-dapp -s hardhat
```

Real, supported flags (from the CLI's own help output):

```
npx create-eth<@version> [--skip | --skip-install] [-s <solidity-framework> | --solidity-framework <solidity-framework>] [-e <extension> | --extension <extension>] [-h | --help]
```

The install pulls a large dependency tree — expect a few minutes.

## 2. Run it — three terminals

```bash
cd my-dapp

# terminal 1 — local chain (Hardhat node, chainId 31337, pre-funded accounts)
yarn chain

# terminal 2 — compile + deploy to the local chain
yarn deploy

# terminal 3 — Next.js frontend
yarn start
```

Open <http://localhost:3000>. `/debug` gives you an auto-generated read/write UI for every function
on your deployed contract, so you can exercise the contract before writing any frontend code.

---

## What you got, and where to edit it

| You need | Where it lives | Notes |
|---|---|---|
| Solidity contract | `packages/hardhat/contracts/YourContract.sol` | Rename/replace with yours |
| Deploy script | `packages/hardhat/deploy/00_deploy_your_contract.ts` | Hardhat 3 + `hardhat-deploy` v2 (rocketh) |
| Local chain | `yarn chain` → `hardhat node` | |
| React frontend | `packages/nextjs/app/` | Next.js 16, React 19, Tailwind + daisyUI |
| Wallet connect | Pre-wired RainbowKit 2.2.11 | Plus a burner wallet + local faucet for dev |
| Typed contract calls | `packages/nextjs/hooks/scaffold-eth/` | See below |
| Frontend config | `packages/nextjs/scaffold.config.ts` | `targetNetworks`, polling, etc. |

**Typed calls.** After `yarn deploy`, ABIs+addresses are written to
`packages/nextjs/contracts/deployedContracts.ts`, and these wagmi-wrapper hooks give you full
TypeScript autocomplete on contract names, function names, and argument types:

```tsx
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const { data: greeting } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "greeting",
});

const { writeContractAsync } = useScaffoldWriteContract({ contractName: "YourContract" });
await writeContractAsync({ functionName: "setGreeting", args: ["gm"] });
```

Note: pass `contractName` as an **object** property. The bare-string form
(`useScaffoldWriteContract("YourContract")`) still works but is marked deprecated in the current
template and logs a warning.

Contract hot reload is on: edit the `.sol`, re-run `yarn deploy`, and the frontend types update.

---

## Shipping to users by end of week

```bash
# 1. Create a deployer account (encrypted keystore; prints the address to fund)
yarn generate            # or: yarn account:import  to bring your own key
yarn account             # show deployer address + balances

# 2. Fund that address on your target testnet/mainnet, then:
yarn deploy --network sepolia
yarn verify --network sepolia

# 3. Point the frontend at that network
#    packages/nextjs/scaffold.config.ts -> targetNetworks: [chains.sepolia]

# 4. Deploy the frontend
yarn vercel:login
yarn vercel
```

Before going live, set these in `packages/nextjs/.env.local` (see `.env.example`):

- `NEXT_PUBLIC_ALCHEMY_API_KEY` — the template ships a shared public key; rate-limited, replace it.
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` — get your own at <https://dashboard.reown.com> (formerly
  WalletConnect Cloud). Required for WalletConnect-based wallets to work reliably in production.

Also run `yarn test` (Hardhat + Mocha) in `packages/hardhat` before a mainnet deploy.

Docs: <https://docs.scaffoldeth.io>

---

## Why not the alternatives

- **Hardhat/Foundry + Vite + wagmi CLI hand-rolled** — all real and current (`hardhat@3.17.0`,
  `wagmi@3.7.7`, `viem@2.56.8`, `@wagmi/cli@2.10.0`), but you'd spend a day wiring codegen,
  RainbowKit, providers, and a deploy pipeline that Scaffold-ETH already ships working.
- **TypeChain** (`typechain@8.3.2`) — last published Oct 2023. For a React frontend, viem/wagmi's
  `abi`-inferred types are the current approach; don't add TypeChain for this.
- Note the Scaffold-ETH template pins `wagmi@2.19.5` / `viem@2.53.1`, not the newest wagmi 3.x.
  That's deliberate and consistent across the template — don't force-upgrade wagmi this week.

---

## Verification notes (what I actually checked today, 2026-09-20)

- `create-eth` latest on npm = **2.0.23**; downloaded the tarball and read its `README.md`,
  `package.json`, CLI arg parser (`src/utils/parse-arguments-into-options.ts`), help text, and
  templates — so the flags, scripts, file paths, and dependency versions above are copied from the
  package, not from memory.
- Root scripts confirmed present: `start`, `vercel`, `vercel:login`, `next:build`.
  Hardhat-package scripts confirmed: `chain`, `deploy`, `compile`, `test`, `account`,
  `account:generate` (aliased as `generate`), `account:import`, `verify`, `fork`, `flatten`.
- `yarn deploy --network <name>` confirmed: the deploy runner parses `--network` explicitly.
- Template deps confirmed: next `~16.2.4`, react `~19.2.5`, wagmi `2.19.5`, viem `2.53.1`,
  `@rainbow-me/rainbowkit` `2.2.11`, hardhat `^3.4.5`, packageManager `yarn@4.13.0`,
  engines.node `>=20.18.3` (README asks for >= v22.10.0 — use 22).
- `docs.scaffoldeth.io` and `dashboard.reown.com` both return HTTP 200.
- Not verified (can't be, without running it): actual install success on your machine and the
  end-to-end testnet deploy, since those need network installs and a funded key.

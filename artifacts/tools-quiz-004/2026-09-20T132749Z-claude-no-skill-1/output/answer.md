# Fastest path to a full-stack Ethereum app (one week)

**Use Scaffold-ETH 2 via `create-eth`.** It is the only generator that ships all four of
your requirements out of the box — Solidity contract + Hardhat local chain, a React
(Next.js App Router) frontend, typed contract calls generated from your own ABIs, and
wallet connect (RainbowKit + burner wallet) — in a single yarn workspace. Anything
assembled by hand (`create-next-app` + wagmi + Hardhat + a codegen step) costs you a day
or two of wiring for the same result.

The one thing to know up front: the frontend is **Next.js**, not a bare Vite React SPA.
If a plain SPA is a hard requirement, this is the wrong tool; otherwise it's strictly
less work.

## 0. Prerequisites

Required by the generated project: **Node >= 22.10.0**, **Git**, and **Yarn**. The
generated root `package.json` pins `packageManager: yarn@4.13.0`, so let Corepack
provide Yarn 4 rather than relying on a global Yarn 1:

```bash
node -v          # must be >= 22.10.0
corepack enable  # ships with Node 22; provides yarn 4 per-project
git --version
```

## 1. Scaffold

```bash
npx create-eth@latest
```

Interactive prompts: project name, then Solidity framework (**hardhat** / foundry /
none). Pick **hardhat** — it needs no extra system toolchain. (Foundry works but the CLI
validates `forge --version >= 1.4.0`, so it's an extra install.)

Non-interactive equivalent, if you want to skip the prompts:

```bash
npx create-eth@latest my-app --solidity-framework hardhat
```

Real flags, from the CLI's own help output:

| Flag | Meaning |
| --- | --- |
| `--skip`, `--skip-install` | skip package installation |
| `-s`, `--solidity-framework` | `hardhat` \| `foundry` \| `none` |
| `-e`, `--extension` | add a curated or third-party extension |
| `-h`, `--help` | help |

Install takes a while — it's a full Hardhat 3 + Next.js + wagmi/viem monorepo.

## 2. Run it — three terminals

```bash
cd my-app

# terminal 1 — local chain (Hardhat node, chainId 31337)
yarn chain

# terminal 2 — compile + deploy + regenerate typed ABIs for the frontend
yarn deploy

# terminal 3 — frontend on http://localhost:3000
yarn start
```

`yarn deploy` compiles, deploys via rocketh, and writes
`packages/nextjs/contracts/deployedContracts.ts`. That generated file is what makes the
frontend calls typed — **re-run `yarn deploy` after every contract change**, or the
frontend types go stale.

Visit `http://localhost:3000/debug` for an auto-generated read/write UI for every
function on your contract. That page alone covers most of your manual testing.

## 3. Where your code goes

| What | Path |
| --- | --- |
| Your contract | `packages/hardhat/contracts/YourContract.sol` |
| Deploy script | `packages/hardhat/deploy/00_deploy_your_contract.ts` |
| Contract tests | `packages/hardhat/test/YourContract.ts` |
| Frontend pages | `packages/nextjs/app/` |
| Network + wallet config | `packages/nextjs/scaffold.config.ts` |
| Generated typed ABIs | `packages/nextjs/contracts/deployedContracts.ts` (do not edit) |

Edit `YourContract.sol` in place and keep the name, or rename it and update the
`env.deploy("YourContract", ...)` call plus the `artifacts.YourContract` reference in the
deploy script.

## 4. The typed calls

Read (auto-refreshes on each new block — `watch` defaults to true):

```tsx
const { data: greeting } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "greeting",
});
```

Write:

```tsx
const { writeContractAsync, isMining } = useScaffoldWriteContract({
  contractName: "YourContract",
});

await writeContractAsync({
  functionName: "setGreeting",
  args: ["gm"],
  value: parseEther("0.01"), // only for payable functions
});
```

`contractName`, `functionName`, and `args` are all type-checked against your compiled
ABI, so a typo'd function name or a wrong arg type is a build error, not a runtime
revert. Note `useScaffoldWriteContract("YourContract")` — the bare-string form — is
deprecated in favour of the object form shown above; use the object form.

Wallet connect is already mounted in the header. On the local chain you also get a
burner wallet (`burnerWalletMode: "localNetworksOnly"` by default), so you can click
through writes without MetaMask during development.

Other hooks available: `useScaffoldContract`, `useScaffoldEventHistory`,
`useScaffoldWatchContractEvent`, `useDeployedContractInfo`, `useTransactor`.

## 5. Useful project scripts

```bash
yarn compile            # compile contracts
yarn test               # Hardhat contract tests
yarn account            # show deployer balances across networks
yarn account:generate   # create an encrypted deployer key (for live networks)
yarn account:import     # import an existing private key, encrypted
yarn fork               # local node forking mainnet
yarn verify             # verify on a block explorer
yarn next:build         # production build of the frontend
```

## 6. Getting it in front of users this week

1. **Deployer key** — `yarn account:generate`, set a password. This writes
   `DEPLOYER_PRIVATE_KEY_ENCRYPTED` into `packages/hardhat/.env`; the plaintext key is
   never stored. Fund the address (`yarn account` shows balances).
2. **Deploy to a public network:**
   ```bash
   yarn deploy --network sepolia
   ```
   It prompts for the decryption password. Any non-`hardhat` network requires the
   encrypted key to exist first.
3. **Point the frontend at it** — in `packages/nextjs/scaffold.config.ts` set
   `targetNetworks: [chains.sepolia]`.
4. **Own API keys** — the template ships with shared default Alchemy and WalletConnect
   keys. Before real traffic, get your own and set
   `NEXT_PUBLIC_ALCHEMY_API_KEY` and `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
   (`.env.local` locally, and in your host's env config in production). The shared
   defaults will rate-limit you.
5. **Ship the frontend** — `yarn vercel` (or `yarn next:build` + any Node host).

## Verification notes

Everything above was checked against the live sources on 2026-09-20, not recalled:

- `create-eth` latest on the npm registry is **2.0.23** (`npm view create-eth version`);
  bin is `create-eth`.
- Flags and their exact spellings come from `src/utils/show-help-message.ts` and
  `src/utils/parse-arguments-into-options.ts` in `scaffold-eth/create-eth@main`;
  `hardhat`/`foundry` from `src/utils/consts.ts`; the `forge >= 1.4.0` check from
  `src/utils/system-validation.ts`.
- `chain` / `deploy` / `compile` / `test` / `account*` / `verify` / `fork` and
  `engines.node >= 22.10.0` come from the generated root `package.json`
  (`templates/solidity-frameworks/hardhat/package.json`); `start` and
  `packageManager: yarn@4.13.0` from `templates/base/package.json`.
- Hook signatures were read from
  `templates/base/packages/nextjs/hooks/scaffold-eth/useScaffoldReadContract.ts` and
  `useScaffoldWriteContract.ts` (including the deprecation of the string form).
- File paths from `templates/example-contracts/hardhat/...`; the `--network` handling and
  the encrypted-key requirement from `scripts/runHardhatDeployWithPK.ts`; config keys
  from `templates/base/packages/nextjs/scaffold.config.ts.template.mjs`.

One caveat: I could **not** execute `npx create-eth@latest` here to see it run
end-to-end. This machine's root filesystem is 100% full (~416 MB free of 225 GB), so npm
could not even write to its temp dir. Free up a few GB before you run step 1 — the
monorepo install needs well over 1 GB.

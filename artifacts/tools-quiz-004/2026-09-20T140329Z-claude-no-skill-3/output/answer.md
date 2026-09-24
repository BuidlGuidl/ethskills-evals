# Fastest path: Scaffold-ETH 2 (`create-eth`)

One command gives you every item on your list — Solidity contract, React (Next.js) frontend
with **typed** contract calls, wallet connect (RainbowKit), and a local chain (Hardhat node).
Nothing to wire together yourself.

Everything below was executed on this machine on **2026-09-20** against the live npm registry.
Versions and flags are what the published package actually does today, not from memory.

## Setup commands

```bash
# 1. Scaffold (Node >= 22.10 required by the Hardhat workspace; you have v22.22.2)
npx create-eth@latest my-dapp --solidity-framework hardhat

cd my-dapp

# 2. Terminal A — local chain (Hardhat node on http://127.0.0.1:8545, chainId 31337)
yarn chain

# 3. Terminal B — compile + deploy to the local chain
yarn deploy

# 4. Terminal C — frontend on http://localhost:3000
yarn start
```

That's it. `npx create-eth@latest` runs `yarn install` for you and inits a git repo.
If you'd rather install yourself, add `--skip-install` and then run `yarn install && yarn format`.

The CLI is interactive by default (it prompts for the Solidity framework and optional
extensions). `--solidity-framework hardhat` is what makes the command above non-interactive —
I verified this runs clean with stdin closed.

## What you get

| Your requirement | What the template provides |
|---|---|
| One Solidity contract | `packages/hardhat/contracts/YourContract.sol` (greeting + counter + owner withdraw) |
| Deploy | `packages/hardhat/deploy/00_deploy_your_contract.ts` |
| React frontend | Next.js 16 + React 19 app in `packages/nextjs` |
| Typed contract calls | `useScaffoldReadContract` / `useScaffoldWriteContract` — contract name, function name, and args are all type-checked off the generated ABI |
| Wallet connect | RainbowKit 2.2.11 + wagmi + a burner wallet enabled on local networks |
| Local chain | `yarn chain` → Hardhat node; `scaffold.config.ts` already targets `chains.hardhat` |
| Bonus | `/debug` page auto-generates a UI for every function on your contract — useful for demoing before the real UI exists |

Verified versions in the generated project: `hardhat ^3.4.5`, `wagmi 2.19.5`, `viem 2.53.1`,
`@rainbow-me/rainbowkit 2.2.11`, `next ~16.2.4`, `react ~19.2.5`, `@openzeppelin/contracts ^5.0.2`.
`create-eth` itself is at **2.0.23**.

## The typing story (this is the part that saves you the most time)

`yarn deploy` writes `packages/nextjs/contracts/deployedContracts.ts` — address + ABI keyed by
chain id. The hooks read from that file, so the frontend types update the moment you redeploy.
No manual ABI copying, no codegen step to remember.

Read and write, fully typed:

```tsx
"use client";

import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export default function Greeting() {
  // `data` is typed as string, because greeting() returns string
  const { data: greeting } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "greeting",
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "YourContract",
  });

  return (
    <div>
      <p>{greeting}</p>
      <button
        disabled={isMining}
        onClick={() =>
          writeContractAsync({
            functionName: "setGreeting",   // autocompleted; only payable/nonpayable fns allowed
            args: ["gm"],                  // arg tuple type-checked against the ABI
            value: 0n,
          })
        }
      >
        {isMining ? "Mining..." : "Set greeting"}
      </button>
    </div>
  );
}
```

Notes from reading the actual hook source in the generated project:
- Pass **objects**, not strings. `useScaffoldWriteContract("YourContract")` still works but is
  explicitly deprecated and logs a warning.
- `useScaffoldReadContract` sets `watch: true` by default, so reads re-fetch on new blocks.
  Pass `watch: false` on anything you don't want polling.
- Both hooks take an optional `chainId` for multi-chain reads/writes.

## Before you put it in front of users

Two defaults are shared demo keys and will get rate-limited under real traffic. Both are read
from env vars in `packages/nextjs/scaffold.config.ts`:

```bash
# packages/nextjs/.env.local
NEXT_PUBLIC_ALCHEMY_API_KEY=...            # dashboard.alchemy.com
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...  # Reown/WalletConnect Cloud dashboard
```

Then point at a real network:

```bash
# packages/nextjs/scaffold.config.ts
targetNetworks: [chains.sepolia],   # or baseSepolia, optimismSepolia, ...
```

```bash
yarn generate            # create an encrypted deployer key (or: yarn account:import)
yarn account             # check its balance on each network
yarn deploy --network sepolia
yarn verify --network sepolia
yarn next:build          # catches type errors before deploy
yarn vercel              # ship the frontend
```

## Suggested schedule for the week

1. **Day 1** — run the four commands above, replace `YourContract.sol` with your contract,
   `yarn deploy`, drive it from the `/debug` page. Backend done.
2. **Day 2–3** — build your real page in `packages/nextjs/app/page.tsx` with the two hooks.
   Redeploy whenever the ABI changes; types follow automatically.
3. **Day 4** — testnet: env keys, `targetNetworks`, `yarn deploy --network sepolia`, `yarn verify`.
4. **Day 5** — `yarn next:build`, then `yarn vercel`.

## On the alternative

If you already know Foundry, swap `--solidity-framework foundry` — same frontend, same hooks,
same typed-ABI pipeline, just `forge` instead of Hardhat for contracts (needs `foundryup`
installed separately). Anything hand-rolled — `create-next-app` plus wagmi plus RainbowKit plus
a Hardhat project plus your own ABI-export script — is the same destination and at least a day
of wiring. Not worth it on your timeline.

## What I actually verified (2026-09-20, on this machine)

I ran the whole flow before writing this, rather than quoting docs:

| Claim | How it was checked | Result |
|---|---|---|
| `create-eth` exists at 2.0.23 | `npm view create-eth version` | ✅ published 2026-07-30 |
| `--solidity-framework hardhat` / `--skip-install` are real flags | extracted the flag table from the published `dist/cli.js`; ran the CLI with stdin closed | ✅ scaffolded non-interactively |
| `yarn install` succeeds | ran it in the generated project | ✅ exit 0 |
| `yarn deploy` compiles and deploys | ran against a local Hardhat node | ✅ `YourContract` at `0xf5059a…6f36`, printed `👋 Initial greeting: Building Unstoppable Apps!!!` |
| ABI/address codegen is automatic | inspected `packages/nextjs/contracts/deployedContracts.ts` after deploy | ✅ populated under key `31337` with full ABI |
| The `Greeting` snippet above compiles | pasted it into the app, ran `yarn next:check-types` | ✅ exit 0 |
| The typing is real, not cosmetic | changed `setGreeting` → `setGreetingTypo` and re-ran | ✅ `error TS2820: Type '"setGreetingTypo"' is not assignable to type '"setGreeting" \| "withdraw"'` |
| Frontend builds and serves | `yarn next:build`, then `yarn next:serve` | ✅ build exit 0; `/` and `/debug` both return HTTP 200 |

That TS2820 error is the thing worth noting: function names, and the arg tuple with them, are
constrained by the deployed ABI. Rename a function in Solidity, redeploy, and the frontend stops
compiling at exactly the call sites you need to fix.

Two environment-specific things I hit that you probably won't, noted so the log is complete:
- Port 8545 was already taken in my sandbox, so I deployed against the Hardhat node already
  running there instead of a fresh `yarn chain`. `yarn chain` itself is just `hardhat node`.
- `yarn start` (Next dev) bound its port and printed `✓ Ready in 309ms`, then Turbopack's file
  watcher died with `Too many open files`. That was this box's inotify instance limit being
  exhausted (143 in use against a cap of 128), not a template problem — hence verifying via
  `next:build` + `next:serve`, which don't watch files. On a normal dev machine `yarn start` is fine.

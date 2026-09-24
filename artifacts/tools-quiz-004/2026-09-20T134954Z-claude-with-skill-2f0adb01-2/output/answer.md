# Fastest path: Scaffold-ETH 2 (`create-eth`)

You need one Solidity contract + React frontend with typed reads/writes + wallet
connect + a local chain. Wiring that by hand (Next.js + wagmi + viem +
RainbowKit + ABI typegen + anvil) is a day or two of plumbing. Scaffold-ETH 2
ships all of it pre-wired, including automatic TypeScript type generation from
your compiled contract, so you only write the contract and the UI.

Stack you get: Solidity + Foundry (forge/cast/anvil) + Next.js (React) +
wagmi + viem + RainbowKit, in a yarn workspaces monorepo.

## 0. Prerequisites

```bash
node -v            # need >= 20.18.3 (package.json "engines")
yarn -v            # yarn 1.x is fine; the repo uses yarn workspaces
git --version
```

Foundry is required (`anvil`, `forge`, `cast` are called by the yarn scripts):

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
anvil --version
```

## 1. Scaffold the project

```bash
npx create-eth@latest my-dapp -s foundry
cd my-dapp
```

`-s foundry` picks the Solidity framework non-interactively (drop the flag and
it prompts; `-s hardhat` is the other option). Omit nothing else — the CLI
initializes git and installs dependencies for you.

If you skipped install (`--skip`), run:

```bash
yarn install && yarn format
```

## 2. Three terminals, three commands

```bash
# terminal 1 — local chain (anvil, chain id 31337)
yarn chain

# terminal 2 — compile + deploy + regenerate TS types/ABIs
yarn deploy

# terminal 3 — React frontend on http://localhost:3000
yarn start
```

`yarn deploy` writes `packages/nextjs/contracts/deployedContracts.ts`, which is
where the typed contract calls come from. Re-run it after every contract change.

Visit `http://localhost:3000/debug` for an auto-generated UI over every function
on your contract — useful before you build any real UI.

## 3. Where things live

| What | Path |
|---|---|
| Your contract | `packages/foundry/contracts/YourContract.sol` |
| Deploy script (per contract) | `packages/foundry/script/DeployYourContract.s.sol` |
| Deploy entrypoint (add new contracts here) | `packages/foundry/script/Deploy.s.sol` |
| Generated typed ABIs | `packages/nextjs/contracts/deployedContracts.ts` |
| Frontend pages | `packages/nextjs/app/` |
| Chain / WalletConnect config | `packages/nextjs/scaffold.config.ts` |
| Solidity tests | `packages/foundry/test/` → `yarn foundry:test` |

Rename `YourContract.sol` to your own contract, update
`DeployYourContract.s.sol`, and add any additional contracts to `Deploy.s.sol`.

## 4. Typed reads and writes in React

```tsx
"use client";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export default function Page() {
  const { data: greeting } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "greeting",
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "YourContract",
  });

  return (
    <button
      disabled={isMining}
      onClick={() =>
        writeContractAsync({ functionName: "setGreeting", args: ["gm"] })
      }
    >
      {greeting}
    </button>
  );
}
```

`contractName`, `functionName`, and `args` are all type-checked against the
generated ABI — a typo or a wrong argument type is a compile error. Note the
object form `useScaffoldWriteContract({ contractName })`; the old
`useScaffoldWriteContract("YourContract")` string form still works but is
deprecated in the current release.

Wallet connect is already mounted in the header (RainbowKit). On local chains
you also get a burner wallet, so you can click through the whole flow without
MetaMask.

## 5. Ship it this week

Testnet deploy (Sepolia — Goerli/Rinkeby are dead):

```bash
yarn account:generate                 # or: yarn account:import
yarn account                          # shows the address — fund it
yarn deploy --network sepolia
yarn verify --network sepolia
```

Fund the deployer from https://sepolia-faucet.pk910.de/ or
https://www.alchemy.com/faucets.

Then in `packages/nextjs/scaffold.config.ts` set
`targetNetworks: [chains.sepolia]` and ship the frontend:

```bash
yarn vercel        # or: yarn ipfs
```

Before real users hit it, replace the two shared defaults in
`packages/nextjs/scaffold.config.ts` with your own keys (they are rate-limited
demo keys shared by every SE-2 project): `NEXT_PUBLIC_ALCHEMY_API_KEY` and
`NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` (https://cloud.reown.com). Same for
`ALCHEMY_API_KEY` / `ETHERSCAN_API_KEY` in `packages/foundry/.env`.

## Handy while building

- `yarn foundry:test` — Solidity tests.
- `yarn fork` — anvil forked off mainnet at chain id 31337, if you need to test
  against real deployed contracts.
- https://abi.ninja — paste any verified contract address, get a UI for every
  function, zero setup. Good for poking at contracts you didn't write.
- `cast call <addr> "balanceOf(address)(uint256)" <wallet> --rpc-url <url>` —
  quick reads from the CLI.

## Verification notes

Everything above was checked on this machine on 2026-09-20, not recalled:

- `create-eth` latest on npm is **2.0.23**; `npx create-eth@latest --help`
  confirms the `-s/--solidity-framework`, `-e/--extension`, `--skip` flags.
- Actually ran `npx create-eth@latest se2test -s foundry` and inspected the
  output: the scripts `chain`, `deploy`, `start`, `verify`, `vercel`, `ipfs`,
  `account:generate`, `account:import`, `foundry:test`, `fork` all exist in the
  generated root `package.json`; `engines.node` is `>=20.18.3`.
- `yarn deploy --network sepolia` / `--file` flags confirmed in
  `packages/foundry/scripts-js/parseArgs.js`.
- Object-parameter `useScaffoldWriteContract({ contractName })` and the
  deprecation of the string form confirmed in the generated hook source.
- `https://foundry.paradigm.xyz` responds (the `curl | bash` installer URL is
  live).
- Pinned lib versions currently resolved by npm: wagmi 3.7.7, viem 2.56.8,
  RainbowKit 2.2.11.

One thing I did not verify end-to-end: I ran the scaffold with `--skip` (no
dependency install), so `yarn chain` / `yarn deploy` / `yarn start` were not
executed here. They are the documented and generated scripts, but budget a few
minutes for the first `yarn install` + `foundryup` on your machine.

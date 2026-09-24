# Executor transcript — 2026-09-23T011711Z-claude-no-skill-3

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T011711Z-claude-no-skill-3/qa-quiz-001

## assistant
- **Bash** `ls -a && find . -path ./node_modules -prune -o -type f -print | head -50`

  > .
  > ..
  > .git
  > package.json
  > TASK.md
  > ./package.json
  > ./TASK.md
  > ./.git/config
  > ./.git/HEAD
  > ./.git/description
  > ./.git/index
  > ./.git/COMMIT_EDITMSG
  > ./.git/info/exclude
  > ./.git/logs/HEAD
  > ./.git/hooks/commit-msg.sample
  > ./.git/hooks/pre-rebase.sample
  > ./.git/hooks/sendemail-validate.sample
  > ./.git/hooks/pre-commit.sample
  > ./.git/hooks/applypatch-msg.sample
  > ./.git/hooks/fsmonitor-watchman.sample
  > ./.git/hooks/pre-rece … [525 more chars]

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why `useScaffoldReadContract({ contractName: "USDC" })` silently returned `undefined`

## 1. The silence: the hook never made a request

`useScaffoldReadContract` is not a th … [6907 more chars]`

  > done

## assistant
Written to `answer.md`. The short version:

**Why it was silent.** `useScaffoldReadContract` is name-based. It calls `useDeployedContractInfo("USDC")`, which looks the name up in the merged `deployedContracts.ts` + `externalContracts.ts` registry, keyed by the target chain id. No entry → `address` and `abi` are `undefined` → wagmi leaves the query disabled and never issues an `eth_call`. Hence no error, no network request, `data` permanently `undefined`, and `undefined` renders as nothing. The only trace is a console warning from `useDeployedContractInfo` (the write hook raises a toast; the read hook doesn't). Rule of thumb: silent `undefined` + zero network traffic = registration/chain-id problem, not RPC or ABI.

**Why the fix self-destructed.** `deployedContracts.ts` is generated output — `yarn deploy` runs `generateTsAbis`, which rewrites the whole file from `packages/hardhat/deployments/`. It doesn't merge. USDC has no deployment artifact in the repo, so it was overwritten away. It "worked all week" only because nobody deployed.

**Correct registration** — `packages/nextjs/contracts/externalContracts.ts` (hand-maintained, deep-merged into the same registry, never regenerated):

```ts
import { erc20Abi } from "viem";

const externalContracts = {
  8453: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      abi: erc20Abi,
    },
  },
} as const;
```

Two gotchas flagged in the file: the `8453` key must match `targetNetworks` in `scaffold.config.ts` (still on 31337 in dev gives the identical silent failure), and `connectedAddress` being `undefined` pre-connect disables the query the same way — so render an explicit connect state, and format with 6 decimals. If you need `permit`/`transferWithAuthorization`, swap in the full FiatTokenV2_2 ABI from the implementation address, not the proxy.

## run stats
- turns: 3
- duration: 66s
- cost: $0.2455695
- tokens in/out: 56746/4419
- of which cache write/read: 11231/45509

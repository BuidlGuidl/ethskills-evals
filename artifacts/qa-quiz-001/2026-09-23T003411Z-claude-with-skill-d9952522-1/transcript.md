# Executor transcript — 2026-09-23T003411Z-claude-with-skill-d9952522-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T003411Z-claude-with-skill-d9952522-1/qa-quiz-001

## assistant
- **Bash** `ls -a && find . -name "*.ts" -path "*contracts*" -not -path "*/node_modules/*" | head -50`

  > .
  > ..
  > .agents
  > .claude
  > .git
  > package.json
  > TASK.md

## assistant
- **Skill** `{"skill":"qa"}`

  > Launching skill: qa

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why `useScaffoldReadContract("USDC")` returned `undefined`, why the fix vanished, and the right registration

## TL;DR

USDC was never registered with Scaffold-ETH's contract … [8414 more chars]`

  > done

## assistant
Wrote `answer.md`. The arc:

**Silent `undefined`** — `useScaffoldReadContract` takes a *name*, not an address, and resolves it via `useDeployedContractInfo` against the merged contract registry. An unregistered name isn't an error in SE-2, it's a normal "not on this chain" state: the lookup returns empty, the hook passes `enabled: !!deployedContractData && ...` to TanStack Query, and a disabled query never runs its queryFn. Hence no RPC request (clean network tab), `error: null`, and `data: undefined` — indistinguishable from "still loading." The `contractName` union type *should* have rejected `"USDC"`, but Next.js dev mode doesn't type-check; `yarn next:check-types` would have failed immediately.

**Why the fix vanished** — `deployedContracts.ts` is a build artifact. The `generateTsAbis` post-deploy script rewrites the entire file from `packages/hardhat/deployments/`, with no merge. USDC on Base has no deployment JSON there, so the hand-pasted entry was overwritten. It "worked all week" only because nobody deployed that week.

**Correct registration** — `packages/nextjs/contracts/externalContracts.ts`, keyed by chain ID `8453`, with native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (not the bridged USDbC), `as const` for ABI type inference, and a partial ABI is fine. Then `git checkout` the generated file and verify with `yarn next:check-types`.

Two follow-ons flagged in the file: USDC is 6 decimals, so `formatEther` produces its own version of "renders as nothing"; and the disconnected case (`connectedAddress === undefined`) disables the query through the same path, so `/payouts` needs a `RainbowKitCustomConnectButton` there rather than a blank.

## run stats
- turns: 5
- duration: 62s
- cost: $0.29998199999999997
- tokens in/out: 78821/5136
- of which cache write/read: 13909/64904

# Executor transcript — 2026-09-23T010202Z-claude-with-skill-d9952522-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T010202Z-claude-with-skill-d9952522-2/qa-quiz-001

## assistant
I'll pull up the QA skill since this is a Scaffold-ETH contract registration question.

## assistant
- **Skill** `{"skill":"qa"}`

  > Launching skill: qa

## assistant
- **Bash** `ls -a && ls packages/nextjs/contracts 2>/dev/null`

  > Exit code 1
  > .
  > ..
  > .agents
  > .claude
  > .git
  > package.json
  > TASK.md

## assistant
No SE-2 source in this directory — it's a question to answer, so I'll write the explanation.

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why `useScaffoldReadContract` for USDC returned `undefined`, then broke on deploy

## 1. Why the hook failed silently

`useScaffoldReadContract` doesn't take an address and A … [6720 more chars]`

  > done

## assistant
Written to `answer.md`. The short version of the arc:

**Why it was silent:** `useScaffoldReadContract` resolves `contractName` through scaffold's registry (`deployedContracts.ts` + `externalContracts.ts`, keyed by chain id). With no `USDC` entry, `useDeployedContractInfo` returns undefined, and scaffold passes `enabled: !!deployedContract` to wagmi — so the query is *disabled*, not failed. No throw, no request, `data` just stays `undefined`, and `{usdcBalance?.toString()}` renders empty. The only trace is a dev-console warning.

**Why the fix self-destructed:** `deployedContracts.ts` is a build artifact. `yarn deploy` runs `generateTsAbis`, which rewrites the entire file from `packages/hardhat/deployments/`. It's a full overwrite, not a merge, and USDC isn't deployed by this repo — so the pasted entry had nothing to survive on. It "worked all week" only because nobody deployed all week.

**The correct home:** `packages/nextjs/contracts/externalContracts.ts` — hand-maintained source the generator never touches, merged into the same registry. Entry under chain `8453`, address `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (native Circle USDC, 6 decimals — not bridged USDbC). The file has a full `as const` ERC-20 ABI stub, plus the cleanup steps: revert `deployedContracts.ts` to generated state and run `yarn next:check-types`, which turns this class of bug into a compile error instead of a blank page.

One detail worth flagging: USDC on Base is a proxy, so if anyone pastes a full ABI from the explorer it needs to come from the "Read as Proxy" tab.

## run stats
- turns: 5
- duration: 50s
- cost: $0.2498985
- tokens in/out: 79148/3668
- of which cache write/read: 12483/66657

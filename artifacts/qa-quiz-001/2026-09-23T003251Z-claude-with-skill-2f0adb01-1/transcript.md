# Executor transcript — 2026-09-23T003251Z-claude-with-skill-2f0adb01-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T003251Z-claude-with-skill-2f0adb01-1/qa-quiz-001

## assistant
- **Bash** `ls -la && find . -name "*.ts" -path "*contracts*" 2>/dev/null | head -20`

  > total 16
  > drwxr-xr-x@  7 spencerfaber  staff   224 Sep 22 18:32 .
  > drwxr-xr-x@  3 spencerfaber  staff    96 Sep 22 18:32 ..
  > drwxr-xr-x@  3 spencerfaber  staff    96 Sep 22 18:32 .agents
  > drwxr-xr-x@  3 spencerfaber  staff    96 Sep 22 18:32 .claude
  > drwxr-xr-x@ 12 spencerfaber  staff   384 Sep 22 18:32 .git
  > -rw-r--r--@  1 spencerfaber  staff    50 Sep 22 18:32 package.json
  > -rw-r--r--@  1 spencerfaber  … [33 more chars]

## assistant
No repo here — just the quiz prompt. Writing the answer.

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why `useScaffoldReadContract({ contractName: "USDC" })` silently returned `undefined`

## Short version

`useScaffoldReadContract` doesn't know any addresses. It looks the co … [8575 more chars]`

  > done

## assistant
Written to `answer.md`. The arc:

**Why it was silent.** `useScaffoldReadContract` resolves the contract *by name* through `useDeployedContractInfo`, against the merged `deployedContracts.ts` + `externalContracts.ts` map scoped to the current target chain. A miss returns `undefined` rather than throwing, so wagmi's `useReadContract` receives `address: undefined, abi: undefined` and leaves the query disabled — never fetching, never erroring. Blank render, no error, no network request, all three at once. The only real signal was a TypeScript error (`"USDC"` isn't in the generated `ContractName` union), and the Next dev server compiles with SWC without blocking on type errors, so it never reached the browser.

**Why the patch self-destructed.** `deployedContracts.ts` is a generated artifact. `yarn deploy` runs `hardhat deploy` then Scaffold-ETH's `generateTsAbis` step, which rewrites the file wholesale from `packages/hardhat/deployments/**`. USDC has no deployment artifact in the repo, so it simply wasn't re-emitted. It worked all week only because nobody deployed.

**The fix.** `packages/nextjs/contracts/externalContracts.ts` — checked-in source, never regenerated, deep-merged into the same lookup. Keyed by chain id `8453`, address `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (native USDC, not bridged USDbC), with a hand-written ERC-20 ABI subset and `as const satisfies GenericContractsDeclaration`.

Three follow-ups the file flags, since each independently reproduces the blank page: `scaffold.config.ts` must actually target Base or the `8453` entry stays invisible; USDC is 6 decimals, so `formatUnits(v, 6)` not `formatEther`; and the hook still yields `undefined` pre-connect, which is the state the original UI swallowed.

## run stats
- turns: 3
- duration: 71s
- cost: $0.2885935
- tokens in/out: 57407/5681
- of which cache write/read: 12404/44997

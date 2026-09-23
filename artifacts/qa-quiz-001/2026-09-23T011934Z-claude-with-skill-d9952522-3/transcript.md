# Executor transcript — 2026-09-23T011934Z-claude-with-skill-d9952522-3

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T011934Z-claude-with-skill-d9952522-3/qa-quiz-001

## assistant
- **Bash** `ls -la && git log --oneline -3`

## assistant
- **Skill** `{"skill":"qa"}`

  > total 16
  > drwxr-xr-x@  7 spencerfaber  staff   224 Sep 22 19:19 .
  > drwxr-xr-x@  3 spencerfaber  staff    96 Sep 22 19:19 ..
  > drwxr-xr-x@  3 spencerfaber  staff    96 Sep 22 19:19 .agents
  > drwxr-xr-x@  3 spencerfaber  staff    96 Sep 22 19:19 .claude
  > drwxr-xr-x@ 12 spencerfaber  staff   384 Sep 22 19:19 .git
  > -rw-r--r--@  1 spencerfaber  staff    50 Sep 22 19:19 package.json
  > -rw-r--r--@  1 spencerfaber  … [55 more chars]

  > Launching skill: qa

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why `useScaffoldReadContract({ contractName: "USDC" })` rendered nothing

## 1. Why the hook returned `undefined` and never threw

`useScaffoldReadContract` is not a thin wra … [7246 more chars]`

  > written
  >      170 answer.md

## assistant
Written to `answer.md`. The arc:

**1. Silent `undefined`** — `useScaffoldReadContract` resolves `contractName` against the registry built from `deployedContracts.ts` + `externalContracts.ts` for the target chain *before* calling wagmi. No entry → no address/abi → the hook passes `enabled: false` to `useReadContract`. A disabled query is idle, not errored: `data` undefined, `error` null, and **zero** eth_calls issued — which is why the network tab was clean rather than showing a failure.

**2. The fix self-destructed** — `deployedContracts.ts` is a generated artifact. The post-deploy `generateTsAbis` step rewrites the whole file from `packages/hardhat/deployments/**`; it doesn't merge. Since you don't deploy USDC, there's no deployment JSON for it, so the hand-pasted entry was dropped the first time anyone ran `yarn deploy`. It only "worked all week" because nobody deployed.

**3. Correct registration** — `packages/nextjs/contracts/externalContracts.ts`, hand-authored, never regenerated, merged into the same registry:

```typescript
const externalContracts = {
  8453: {
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", abi: [...] },
  },
} as const;
export default externalContracts satisfies GenericContractsDeclaration;
```

Three gotchas the answer covers: the chain-id key must match `targetNetworks` in `scaffold.config.ts` (Base Sepolia is `84532` with a different USDC address); native USDC is *not* bridged USDbC; and a block-explorer ABI fetch may return the proxy's ABI, so use the ERC-20 surface. Then revert `deployedContracts.ts` to generated state and run `yarn next:check-types` — with the contract registered, a bad `contractName` or `functionName` becomes a build error instead of a blank page.

## run stats
- turns: 5
- duration: 59s
- cost: $0.2568725
- tokens in/out: 60599/4077
- of which cache write/read: 13118/47475

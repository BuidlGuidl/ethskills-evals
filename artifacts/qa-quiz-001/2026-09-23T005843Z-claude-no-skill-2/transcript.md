# Executor transcript — 2026-09-23T005843Z-claude-no-skill-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T005843Z-claude-no-skill-2/qa-quiz-001

## assistant
- **Bash** `ls -a && ls packages/nextjs/contracts 2>/dev/null && ls packages/nextjs/hooks/scaffold-eth 2>/dev/null`

  > Exit code 1
  > .
  > ..
  > .git
  > package.json
  > TASK.md

## assistant
No repo files here (just `TASK.md`), so this is a written answer. Writing it now.

## assistant
- **Bash** `cat > answer.md <<'MD'
# Why `usdcBalance` was `undefined`, why the teammate's fix evaporated, and where USDC actually belongs

## TL;DR

USDC on Base is an **external** contract — you didn't deploy i … [9537 more chars]`

  >      238 answer.md

## assistant
Written to `answer.md`. The arc in short:

**1. Silent `undefined`** — `useScaffoldReadContract` first resolves the *name* via `useDeployedContractInfo`, which looks in the merged `deployedContracts` + `externalContracts` registry for the current `targetNetwork`. `"USDC"` wasn't there, so `address` and `abi` were passed to wagmi as `undefined`. wagmi v2 gates the query on those being present, so the query was **disabled, not failed**: no queryFn run → no RPC request in the network tab, `data: undefined` with `error: null` → nothing rendered, no error boundary. Two aggravating factors: the *write* hook fires a "target contract is not deployed" notification for this case but the read hook has no equivalent; and `"USDC"` was a genuine TS error against the `ContractName` union, but `next dev` doesn't block on type errors.

**2. Why the fix self-destructed** — `packages/nextjs/contracts/deployedContracts.ts` is generated. `packages/hardhat/deploy/99_generateTsAbis.ts` runs as part of `yarn deploy` and rewrites the file wholesale from `packages/hardhat/deployments/`. There's no `deployments/base/USDC.json` (Circle deployed it, not you), so the regenerated file simply omitted the key. Worked all week only because nobody deployed all week.

**3. Correct registration** — `packages/nextjs/contracts/externalContracts.ts`, which the deploy pipeline never touches, keyed by `8453` with `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. The call site needs no change, and `"USDC"` becomes valid in the type union. Three gotchas I flagged in the file: `as const` is load-bearing for abitype inference; Base USDC is a proxy so you need the implementation (`FiatTokenV2_2`) ABI or a hand-written ERC-20 subset, not the proxy ABI; and decimals is 6.

## run stats
- turns: 3
- duration: 87s
- cost: $0.316392
- tokens in/out: 57701/6583
- of which cache write/read: 12941/44754

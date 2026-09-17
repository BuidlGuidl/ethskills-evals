# Executor transcript — 2026-09-17T143412Z-claude-with-skill-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/2026-09-17T143412Z-claude-with-skill-2/qa-quiz-001

## assistant
- **Skill** `{"skill":"qa"}`

  > Launching skill: qa

## assistant
- **Write** `/Users/liana/.cache/ethskills-evals/2026-09-17T143412Z-claude-with-skill-2/qa-quiz-001/answer.md`

  > File created successfully at: /Users/liana/.cache/ethskills-evals/2026-09-17T143412Z-claude-with-skill-2/qa-quiz-001/answer.md (file state is current in your context — no need to Read it back)

## assistant
I wrote the explanation to `answer.md`. It's based on how Scaffold-ETH 2 (SE-2) works; I didn't run the app or the type check.

1. **Why it returned `undefined` silently:** `useScaffoldReadContract` looks up `"USDC"` in a list SE-2 builds from `deployedContracts.ts` and `externalContracts.ts`, by chain id (Base is `8453`). USDC wasn't in either file, so the address and ABI came back `undefined`. wagmi then switched the query off: no request went out and nothing failed, so the hook just returned `undefined`. The only warning would have been a type error (`"USDC"` isn't a valid contract name). `next dev` doesn't stop on type errors, so the app ran anyway.
2. **Why the fix disappeared on deploy:** `deployedContracts.ts` is generated. `yarn deploy` runs `generateTsAbis`, which rewrites the whole file from `packages/hardhat/deployments/`. The team never deployed USDC, so the pasted entry was dropped. It only lasted the week because nobody deployed in that time.
3. **The correct fix:** put USDC in `packages/nextjs/contracts/externalContracts.ts`, which deploys never touch:
   - **Chain id:** list it under `8453`.
   - **Address:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Circle's native USDC on Base, not the bridged USDbC).
   - **ABI:** at least `balanceOf`.
   - **Typing:** keep `as const` and `satisfies GenericContractsDeclaration`, so TypeScript knows the contract and function names.

   Also:
   - Base must be listed in `targetNetworks` in `scaffold.config.ts`, or the lookup still finds nothing.
   - USDC has 6 decimals, so show the balance with `formatUnits(balance, 6)`, not `formatEther`.
   - Remove the hand-added block from `deployedContracts.ts`, then check that `yarn next:check-types` passes.

## run stats
- turns: 4
- duration: 31s
- cost: $0.20840950000000003
- tokens in/out: 57392/2834
- of which cache write/read: 11323/46063

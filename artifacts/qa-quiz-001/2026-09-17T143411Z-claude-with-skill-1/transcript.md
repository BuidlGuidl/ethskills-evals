# Executor transcript — 2026-09-17T143411Z-claude-with-skill-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/2026-09-17T143411Z-claude-with-skill-1/qa-quiz-001

## assistant
- **Skill** `{"skill":"qa"}`

  > Launching skill: qa

## assistant
- **Write** `/Users/liana/.cache/ethskills-evals/2026-09-17T143411Z-claude-with-skill-1/qa-quiz-001/answer.md`

  > File created successfully at: /Users/liana/.cache/ethskills-evals/2026-09-17T143411Z-claude-with-skill-1/qa-quiz-001/answer.md (file state is current in your context — no need to Read it back)

## assistant
I wrote the full explanation to `answer.md`. I wrote it from how Scaffold-ETH 2 works, not from this project's code, and I didn't run the app or check the types.

1. **Why it failed silently:** `useScaffoldReadContract` finds a contract by its name (`USDC`) for the current chain. The list it searches is built from `deployedContracts.ts` and `externalContracts.ts`, and USDC was in neither. So the hook handed wagmi (the library underneath) no address and no ABI. Wagmi just switches the read off in that case: no request is sent, no error is raised, and the balance stays `undefined`. The one warning is a type error on `"USDC"`, and `next dev` doesn't show it.
2. **Why the fix vanished:** `deployedContracts.ts` is generated. Every `yarn deploy` rewrites the whole file from the project's own deployed contracts. USDC isn't one of them, so the hand-added entry was dropped and the page went blank again.
3. **The correct fix:** register USDC in `packages/nextjs/contracts/externalContracts.ts`, which deploys never touch.
   - It goes under chain ID `8453` (Base) as `USDC`, at address `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
   - The ABI needs at least `balanceOf`; I also listed `decimals`, `allowance`, `approve` and `transfer`.
   - The object must end with `as const` and `satisfies GenericContractsDeclaration`.

**Checks for the team:**
- `scaffold.config.ts` must target Base, or the `8453` entry is never read.
- USDC has 6 decimals, so show the balance with `formatUnits(x, 6)`.
- Remove the hand-added entry from `deployedContracts.ts` (or just redeploy).
- Run `yarn next:check-types` in CI so an unregistered contract fails the build instead of rendering blank.

## run stats
- turns: 4
- duration: 36s
- cost: $0.22875999999999996
- tokens in/out: 58005/3403
- of which cache write/read: 11935/46064

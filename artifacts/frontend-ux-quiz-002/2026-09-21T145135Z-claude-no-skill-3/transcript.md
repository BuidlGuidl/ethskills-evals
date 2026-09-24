# Executor transcript — 2026-09-21T145135Z-claude-no-skill-3

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/2026-09-21T145135Z-claude-no-skill-3/frontend-ux-quiz-002

## assistant
- **Bash** `ls -la && git ls-files | head -50`

  > total 16
  > drwxr-xr-x@  5 liana  staff  160 Sep 21 18:51 .
  > drwxr-xr-x@  3 liana  staff   96 Sep 21 18:51 ..
  > drwxr-xr-x@ 12 liana  staff  384 Sep 21 18:51 .git
  > -rw-r--r--@  1 liana  staff   50 Sep 21 18:51 package.json
  > -rw-r--r--@  1 liana  staff  898 Sep 21 18:51 TASK.md
  > TASK.md
  > package.json

## assistant
- **Bash** `cat TASK.md package.json`

  > An Ethereum React dApp with wagmi v2 and viem configured. A support
  > ticket just came in: a user holding 400 USDC typed "250" into the deposit
  > form and the transaction reverted with "transfer amount exceeds balance".
  > The deposit handler reads:
  > 
  >     import { parseEther } from "viem";
  >     ...
  >     const amount = parseEther(depositInput); // depositInput = "250"
  >     writeContract({ ...vaultConfig, func … [545 more chars]

## assistant
- **Write** `/Users/liana/.cache/ethskills-evals/2026-09-21T145135Z-claude-no-skill-3/frontend-ux-quiz-002/answer.md`

  > File created successfully at: /Users/liana/.cache/ethskills-evals/2026-09-21T145135Z-claude-no-skill-3/frontend-ux-quiz-002/answer.md (file state is current in your context — no need to Read it back)

## assistant
I wrote the answer to `answer.md`. **The teammate is wrong.** `parseEther` always uses 18 decimals and knows nothing about the token. USDC uses 6.

**The numbers:**
- **What the contract was asked to move:** `parseEther("250")` = 250 × 10¹⁸ = `250000000000000000000`. In USDC terms that's 250 trillion USDC.
- **What the user meant:** `parseUnits("250", 6)` = 250 × 10⁶ = `250000000`.
- **Factor:** 10¹² (one trillion times too much). The user's balance on-chain is 400 × 10⁶ = `400000000`, so the transfer reverts with "transfer amount exceeds balance".

**Correct conversion for the form:** use `parseUnits(depositInput, decimals)`, with `decimals` read from the token's `decimals()` function. Don't hardcode 6: "USDC" on BNB Chain uses 18. The same amount should go into the `approve` call. Reject inputs with more fractional digits than `decimals` rather than letting `parseUnits` round them.

**Balance display:** use `formatUnits(balance, decimals)` with the same decimals, never `formatEther`. Keep amounts as `bigint` until you turn them into text for display.
- `formatUnits(250000000n, 6)` gives `"250"`, which is correct.
- `formatEther(250000000n)` gives `"0.00000000025"`, which is 10¹² too small.

## run stats
- turns: 4
- duration: 42s
- cost: $0.196089
- tokens in/out: 71311/2823
- of which cache write/read: 9455/61848

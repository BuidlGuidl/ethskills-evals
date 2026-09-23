# Executor transcript — 2026-09-23T003123Z-claude-no-skill-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T003123Z-claude-no-skill-1/qa-quiz-001

## assistant
- **Bash** `ls -a && git log --oneline -3`

  > .
  > ..
  > .git
  > package.json
  > TASK.md
  > 5a1f47a eval baseline

## assistant
- **Bash** `find . -path ./node_modules -prune -o -type f -print | head -50`

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
  > ./.git/hooks/pre-receive.sample
  > ./.git/hooks/prepare … [494 more chars]

## assistant
No Scaffold-ETH source in this directory (it's just `package.json` + `TASK.md`), so I'll answer from the framework's behavior. Writing `answer.md`:

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why the USDC balance was blank, why the "fix" self-destructed, and how to register it properly

## TL;DR

USDC is not a contract *you* deploy, so it never belongs in
`package … [8835 more chars]`

  > wrote
  >      220 answer.md

## assistant
Written to `answer.md`. The arc in short:

**Silent `undefined`** — `useScaffoldReadContract` resolves `contractName` through `useDeployedContractInfo`, which is just an object lookup into the merged `deployedContracts` + `externalContracts` map, indexed by `targetNetwork.id`. A miss yields `undefined`, and the wrapper then passes `enabled: !!deployedContractData` to wagmi, so the query never runs — disabled queries have `data: undefined, error: null`. No request, so nothing in the network tab. The one guardrail (`contractName` is a typed union over registered names) doesn't fire because `next dev` doesn't fail on type errors; only `next:check-types`/`build` would have caught it.

**Why the fix self-destructed** — `deployedContracts.ts` is emitted by `packages/hardhat/deploy/99_generateTsAbis.ts`, which rebuilds the file wholesale from `packages/hardhat/deployments/`. USDC has no deployment artifact there, so the next `yarn deploy` regenerated the file without it. It survived a week only because nobody deployed.

**Correct registration** — `packages/nextjs/contracts/externalContracts.ts`, hand-maintained and merged into the same registry, under chain key `8453` with native USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (not bridged USDbC), ABI `as const` (or `erc20Abi` from viem). The file includes the full entry plus notes on chain-id matching `scaffold.config.ts`, the proxy-ABI trap on Basescan, and adding `84532` for Base Sepolia.

## run stats
- turns: 4
- duration: 76s
- cost: $0.28838549999999996
- tokens in/out: 58058/5581
- of which cache write/read: 12611/45441

# Executor transcript — 2026-09-21T124157Z-claude-with-skill-2f0adb01-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-21T124157Z-claude-with-skill-2f0adb01-1/testing-quiz-004

## assistant
- **Skill** `{"skill":"testing","args":"fork test determinism: pinning block numbers, RPC caching, free-tier archive limits"}`

  > Launching skill: testing

## assistant
- **Bash** `ls -la && cat foundry.toml 2>/dev/null; ls test src 2>/dev/null`

  > Exit code 2
  > total 28
  > drwxrwxr-x 5 damu damu 4096 sep 21 09:41 .
  > drwxrwxr-x 3 damu damu 4096 sep 21 09:41 ..
  > drwxrwxr-x 3 damu damu 4096 sep 21 09:41 .agents
  > drwxrwxr-x 3 damu damu 4096 sep 21 09:41 .claude
  > drwxrwxr-x 8 damu damu 4096 sep 21 09:41 .git
  > -rw-rw-r-- 1 damu damu   50 sep 21 09:41 package.json
  > -rw-rw-r-- 1 damu damu 1070 sep 21 09:41 TASK.md

## assistant
- **Bash** `cat TASK.md && cat package.json`

  > Our fork tests have been green in CI on every PR for four months. This morning three
  > of them went red — the ones that assert on a Chainlink price and on a Uniswap pool's
  > reserves. Nobody touched the code, the dependencies, or the CI config. Re-running the
  > job turns them green again sometimes; the same commit passes and fails.
  > 
  > Two other things we had been ignoring, in case they are related: the fo … [713 more chars]

## assistant
- **Bash** `cat > answer.md <<'MDEOF'
# Why all four symptoms are the same bug

## The one line that causes it

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

`createSelectFork` with no bl … [12441 more chars]`

  > 276 answer.md

## assistant
Written to `answer.md`. The short version:

**One root cause.** `vm.createSelectFork(url)` with no block argument forks at `latest`. The suite's input isn't the commit — it's "mainnet, right now."

- **Sudden reds:** the assertions read Chainlink's answer and a Uniswap pool's reserves, both of which mainnet is designed to change. Four months of drift finally walked the live value out of whatever tolerance band the tests use. The bug has been there since day one; today is just when the market crossed the line.
- **Flaky re-runs:** a re-run is a *new* `latest` — a different block, plus provider head-skew across load-balanced nodes. You're not retrying the test, you're running a different one.
- **Slowdown:** Foundry's RPC cache key includes the block number. `latest` ⇒ a fresh key every run ⇒ 100% miss rate forever, so every run cold-fetches every slot. As the suite grew, so did the round trips.
- **429s:** same thing, one step further — per-run request volume grew monotonically until it crossed the free tier's limit.

**Fix:** pin `FORK_BLOCK` in `setUp` (the CLI `--fork-block-number` flag does *not* constrain an in-test `createSelectFork`); stop asserting on market values — fork tests prove the wiring, mocked feeds prove the math; cache `~/.foundry/cache/rpc` in CI, which only works once the key is stable; run an unpinned `latest` job on a schedule, non-blocking, so drift is a signal rather than a random red.

**On the free tier — plainly:** pinning needs **archive state access** (`eth_getStorageAt`/`eth_call` at a historical block). A default full node keeps ~128 blocks of state. The trap is that block *headers* are never pruned, so `eth_getBlockByNumber` succeeding proves nothing — the answer includes a two-call curl probe (historical vs. `latest` on a state method) and how to read each outcome. Free tiers genuinely differ here; don't guess from the brand. If the probe fails, a pruned endpoint can't do reproducible fork testing at all, and the honest route is moving those three tests to mocks — which is worth doing either way.

## run stats
- turns: 6
- duration: 126s
- cost: $0.48824249999999997
- tokens in/out: 96616/9421
- of which cache write/read: 21513/75095

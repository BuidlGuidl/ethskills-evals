# Executor transcript — 2026-09-22T143409Z-claude-no-skill-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143409Z-claude-no-skill-1/security-quiz-004

## assistant
- **Bash** `ls -la && find . -name '*.sol' -not -path './.git/*' | head -50`

  > total 20
  > drwxrwxr-x 3 damu damu 4096 sep 22 11:34 .
  > drwxrwxr-x 3 damu damu 4096 sep 22 11:34 ..
  > drwxrwxr-x 8 damu damu 4096 sep 22 11:34 .git
  > -rw-rw-r-- 1 damu damu   50 sep 22 11:34 package.json
  > -rw-rw-r-- 1 damu damu 1248 sep 22 11:34 TASK.md

## assistant
- **Bash** `cat TASK.md && cat package.json`

  > Our treasury router on Ethereum mainnet pulls stablecoins in and forwards
  > them to a strategy contract, which it has to approve before each run. The
  > repo is on @openzeppelin/contracts v5 and Solidity 0.8.26.
  > 
  > The approval step is a low-level call, because an earlier version reverted
  > while decoding the return value of some tokens:
  > 
  >   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strate … [897 more chars]

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why the USDT approval reverts (and only after the first run)

## Short version

USDT's `approve` refuses to overwrite a **non-zero** allowance with another
**non-zero** value … [8853 more chars]`

  > done

## assistant
Written to `answer.md`.

**Cause:** Mainnet USDT is a pre-final-ERC20 `TetherToken`. Its `approve` contains

```solidity
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

— you cannot overwrite a non-zero allowance with another non-zero value; you must zero it first. Since your strategy frequently spends less than approved, every run after the first starts with leftover allowance and trips that guard. It's self-sustaining: the revert rolls back, so the leftover is still there next run. USDC is spec-compliant and has no such guard. The messageless `require` in 0.4.x-era code reverts with empty returndata, which your low-level call flattens into `ok == false` and your own `"approve failed"` — hence the identical, opaque failure every time.

Also note the *other* reason you ended up on `.call`: USDT's `approve` has no `returns (bool)`, so `IERC20.approve` reverts in the ABI decoder. Both symptoms have one fix.

**Minimal change** (OZ v5 — `safeApprove` was removed in 5.0; `forceApprove` does try → zero → retry, and tolerates missing return data):

```solidity
using SafeERC20 for IERC20;
...
IERC20(token).forceApprove(strategy, amount);
```

This also restores a real success check — `require(ok)` alone returns true for an address with no code and ignores tokens that return `false` instead of reverting.

**Leftover allowance:** best is to not have one — `safeTransfer` to the strategy plus a `notifyDeposit`, so no allowance ever exists. If it must pull, approve exactly and zero it in the same transaction (`forceApprove(strategy, 0)` after the call, on both full- and partial-spend paths), with an owner/timelock-only revoke as a backstop for runs that revert mid-way. Explicitly do **not** resolve this with `type(uint256).max` — it silences the USDT revert but leaves a third-party contract with an unbounded standing claim on treasury funds.

## run stats
- turns: 4
- duration: 70s
- cost: $0.2822955
- tokens in/out: 76170/5123
- of which cache write/read: 12221/63941

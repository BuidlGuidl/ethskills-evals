# Executor transcript — 2026-09-14T192830Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192830Z-codex-no-skill-2/testing-quiz-003

## session

````text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192830Z-codex-no-skill-2/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a166-cb36-7f22-b9ed-f7e7c1880891
--------
user
Our vault routes deposits into Aave V3. The suite runs against a MockERC20 for the
underlying and a MockAavePool for the pool — 39 tests, all green, and they have been
green since the first commit.

We deployed to mainnet with USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) as the
underlying. Every deposit reverts on-chain. The revert carries no reason string. The
relevant lines are:

    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.approve(address(aavePool), amount);
    aavePool.supply(address(usdt), amount, address(this), 0);

where `usdt` is declared as an OpenZeppelin `IERC20` and the contract does
`using SafeERC20 for IERC20`. Our MockERC20 is a stock OpenZeppelin ERC20 with
6 decimals.

Note the first line uses the token and succeeds; the failure is further down.

Explain why this reverts against the real deployed USDT but never against the mock,
why the SafeERC20 usage did not protect the failing line, and why no amount of extra
mock-based tests would have surfaced it. Then give both fixes: the code change, and
the change in testing practice that would have caught this before mainnet.

Write your answer to answer.md in this directory.

codex
I’ll inspect the workspace guidance, then write the diagnosis and both fixes directly to `answer.md`.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!lib'"' | head -20" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192830Z-codex-no-skill-2/testing-quiz-003
 succeeded in 2ms:
codex
The key boundary is clear: `using SafeERC20` only enables wrapper methods; it does not alter a direct `IERC20.approve` call. I’m capturing the USDT return-data incompatibility, allowance-reset nuance, and a mainnet-fork testing fix.
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192830Z-codex-no-skill-2/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5dd741545941110f1986269aab1525870e9891f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Ethereum mainnet USDT predates the ERC-20 conventions implemented by OpenZeppelin's `ERC20`. In particular, its `approve` does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore performs a normal high-level call and then tries to decode a `bool` from empty return data. That ABI decoding fails, producing a revert with no token reason string. Execution never reaches `aavePool.supply`.
+
+The mock never exposes this because stock OpenZeppelin `ERC20.approve` is fully conforming and returns `true`. Giving it six decimals reproduces USDT's denomination, but not USDT's non-standard call/return behavior. More tests against the same conforming mock only exercise the same false assumption; test count and coverage cannot compensate for an inaccurate test double.
+
+The first line succeeds for exactly this reason:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is an actual `SafeERC20` wrapper. It makes a low-level call and treats either no return data or an ABI-encoded `true` as success, while still reverting for `false` or a failed call. By contrast, `using SafeERC20 for IERC20` merely adds the library's functions to values of that type. It does not intercept or rewrite the native `approve` method, so `usdt.approve(...)` receives no protection from `SafeERC20`.
+
+## Code fix
+
+Use the SafeERC20 allowance wrapper too. With a current OpenZeppelin release, the robust form is:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and also handles USDT-like tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. This is preferable to a direct `approve`. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with SafeERC20 low-level optional-return calls: try approving the requested amount and, if that fails, safely approve zero and then safely approve the requested amount. A version's deprecated `safeApprove` can handle missing return data, but its allowance-transition restrictions make `forceApprove` the clearer general fix.
+
+## Testing-practice fix
+
+Add an integration test on a mainnet fork, pinned to a known block, using the real USDT contract and the real Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, deposit, and assert the resulting Aave position. That test exercises the actual bytecode, return-data shape, allowance rules, and pool interaction and would have failed at the direct `approve` before deployment.
+
+Keep fast mock-based unit tests, but supplement them with fork tests for every production token/protocol combination whose deployed behavior matters. It is also useful to add adversarial token doubles—such as a no-return ERC-20 and a zero-first-approval ERC-20—but those only catch quirks already anticipated. A pinned-fork integration test is what validates compatibility with the concrete deployed USDT and Aave contracts rather than with an idealized ERC-20 model.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5dd741545941110f1986269aab1525870e9891f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Ethereum mainnet USDT predates the ERC-20 conventions implemented by OpenZeppelin's `ERC20`. In particular, its `approve` does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore performs a normal high-level call and then tries to decode a `bool` from empty return data. That ABI decoding fails, producing a revert with no token reason string. Execution never reaches `aavePool.supply`.
+
+The mock never exposes this because stock OpenZeppelin `ERC20.approve` is fully conforming and returns `true`. Giving it six decimals reproduces USDT's denomination, but not USDT's non-standard call/return behavior. More tests against the same conforming mock only exercise the same false assumption; test count and coverage cannot compensate for an inaccurate test double.
+
+The first line succeeds for exactly this reason:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is an actual `SafeERC20` wrapper. It makes a low-level call and treats either no return data or an ABI-encoded `true` as success, while still reverting for `false` or a failed call. By contrast, `using SafeERC20 for IERC20` merely adds the library's functions to values of that type. It does not intercept or rewrite the native `approve` method, so `usdt.approve(...)` receives no protection from `SafeERC20`.
+
+## Code fix
+
+Use the SafeERC20 allowance wrapper too. With a current OpenZeppelin release, the robust form is:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and also handles USDT-like tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. This is preferable to a direct `approve`. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with SafeERC20 low-level optional-return calls: try approving the requested amount and, if that fails, safely approve zero and then safely approve the requested amount. A version's deprecated `safeApprove` can handle missing return data, but its allowance-transition restrictions make `forceApprove` the clearer general fix.
+
+## Testing-practice fix
+
+Add an integration test on a mainnet fork, pinned to a known block, using the real USDT contract and the real Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, deposit, and assert the resulting Aave position. That test exercises the actual bytecode, return-data shape, allowance rules, and pool interaction and would have failed at the direct `approve` before deployment.
+
+Keep fast mock-based unit tests, but supplement them with fork tests for every production token/protocol combination whose deployed behavior matters. It is also useful to add adversarial token doubles—such as a no-return ERC-20 and a zero-first-approval ERC-20—but those only catch quirks already anticipated. A pinned-fork integration test is what validates compatibility with the concrete deployed USDT and Aave contracts rather than with an idealized ERC-20 model.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192830Z-codex-no-skill-2/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Why the USDT deposit reverts

The failing call is the direct `approve`:

```solidity
usdt.approve(address(aavePool), amount);
```

Ethereum mainnet USDT predates the ERC-20 conventions implemented by OpenZeppelin's `ERC20`. In particular, its `approve` does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore performs a normal high-level call and then tries to decode a `bool` from empty return data. That ABI decoding fails, producing a revert with no token reason string. Execution never reaches `aavePool.supply`.

The mock never exposes this because stock OpenZeppelin `ERC20.approve` is fully conforming and returns `true`. Giving it six decimals reproduces USDT's denomination, but not USDT's non-standard call/return behavior. More tests against the same conforming mock only exercise the same false assumption; test count and coverage cannot compensate for an inaccurate test double.

The first line succeeds for exactly this reason:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`safeTransferFrom` is an actual `SafeERC20` wrapper. It makes a low-level call and treats either no return data or an ABI-encoded `true` as success, while still reverting for `false` or a failed call. By contrast, `using SafeERC20 for IERC20` merely adds the library's functions to values of that type. It does not intercept or rewrite the native `approve` method, so `usdt.approve(...)` receives no protection from `SafeERC20`.

## Code fix

Use the SafeERC20 allowance wrapper too. With a current OpenZeppelin release, the robust form is:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` accepts tokens that return no value and also handles USDT-like tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. This is preferable to a direct `approve`. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with SafeERC20 low-level optional-return calls: try approving the requested amount and, if that fails, safely approve zero and then safely approve the requested amount. A version's deprecated `safeApprove` can handle missing return data, but its allowance-transition restrictions make `forceApprove` the clearer general fix.

## Testing-practice fix

Add an integration test on a mainnet fork, pinned to a known block, using the real USDT contract and the real Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, deposit, and assert the resulting Aave position. That test exercises the actual bytecode, return-data shape, allowance rules, and pool interaction and would have failed at the direct `approve` before deployment.

Keep fast mock-based unit tests, but supplement them with fork tests for every production token/protocol combination whose deployed behavior matters. It is also useful to add adversarial token doubles—such as a no-return ERC-20 and a zero-first-approval ERC-20—but those only catch quirks already anticipated. A pinned-fork integration test is what validates compatibility with the concrete deployed USDT and Aave contracts rather than with an idealized ERC-20 model.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5dd741545941110f1986269aab1525870e9891f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Ethereum mainnet USDT predates the ERC-20 conventions implemented by OpenZeppelin's `ERC20`. In particular, its `approve` does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore performs a normal high-level call and then tries to decode a `bool` from empty return data. That ABI decoding fails, producing a revert with no token reason string. Execution never reaches `aavePool.supply`.
+
+The mock never exposes this because stock OpenZeppelin `ERC20.approve` is fully conforming and returns `true`. Giving it six decimals reproduces USDT's denomination, but not USDT's non-standard call/return behavior. More tests against the same conforming mock only exercise the same false assumption; test count and coverage cannot compensate for an inaccurate test double.
+
+The first line succeeds for exactly this reason:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is an actual `SafeERC20` wrapper. It makes a low-level call and treats either no return data or an ABI-encoded `true` as success, while still reverting for `false` or a failed call. By contrast, `using SafeERC20 for IERC20` merely adds the library's functions to values of that type. It does not intercept or rewrite the native `approve` method, so `usdt.approve(...)` receives no protection from `SafeERC20`.
+
+## Code fix
+
+Use the SafeERC20 allowance wrapper too. With a current OpenZeppelin release, the robust form is:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and also handles USDT-like tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. This is preferable to a direct `approve`. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with SafeERC20 low-level optional-return calls: try approving the requested amount and, if that fails, safely approve zero and then safely approve the requested amount. A version's deprecated `safeApprove` can handle missing return data, but its allowance-transition restrictions make `forceApprove` the clearer general fix.
+
+## Testing-practice fix
+
+Add an integration test on a mainnet fork, pinned to a known block, using the real USDT contract and the real Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, deposit, and assert the resulting Aave position. That test exercises the actual bytecode, return-data shape, allowance rules, and pool interaction and would have failed at the direct `approve` before deployment.
+
+Keep fast mock-based unit tests, but supplement them with fork tests for every production token/protocol combination whose deployed behavior matters. It is also useful to add adversarial token doubles—such as a no-return ERC-20 and a zero-first-approval ERC-20—but those only catch quirks already anticipated. A pinned-fork integration test is what validates compatibility with the concrete deployed USDT and Aave contracts rather than with an idealized ERC-20 model.

codex
Created [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192830Z-codex-no-skill-2/testing-quiz-003/answer.md) with the diagnosis, `forceApprove` code fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5dd741545941110f1986269aab1525870e9891f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Ethereum mainnet USDT predates the ERC-20 conventions implemented by OpenZeppelin's `ERC20`. In particular, its `approve` does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore performs a normal high-level call and then tries to decode a `bool` from empty return data. That ABI decoding fails, producing a revert with no token reason string. Execution never reaches `aavePool.supply`.
+
+The mock never exposes this because stock OpenZeppelin `ERC20.approve` is fully conforming and returns `true`. Giving it six decimals reproduces USDT's denomination, but not USDT's non-standard call/return behavior. More tests against the same conforming mock only exercise the same false assumption; test count and coverage cannot compensate for an inaccurate test double.
+
+The first line succeeds for exactly this reason:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is an actual `SafeERC20` wrapper. It makes a low-level call and treats either no return data or an ABI-encoded `true` as success, while still reverting for `false` or a failed call. By contrast, `using SafeERC20 for IERC20` merely adds the library's functions to values of that type. It does not intercept or rewrite the native `approve` method, so `usdt.approve(...)` receives no protection from `SafeERC20`.
+
+## Code fix
+
+Use the SafeERC20 allowance wrapper too. With a current OpenZeppelin release, the robust form is:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and also handles USDT-like tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. This is preferable to a direct `approve`. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with SafeERC20 low-level optional-return calls: try approving the requested amount and, if that fails, safely approve zero and then safely approve the requested amount. A version's deprecated `safeApprove` can handle missing return data, but its allowance-transition restrictions make `forceApprove` the clearer general fix.
+
+## Testing-practice fix
+
+Add an integration test on a mainnet fork, pinned to a known block, using the real USDT contract and the real Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, deposit, and assert the resulting Aave position. That test exercises the actual bytecode, return-data shape, allowance rules, and pool interaction and would have failed at the direct `approve` before deployment.
+
+Keep fast mock-based unit tests, but supplement them with fork tests for every production token/protocol combination whose deployed behavior matters. It is also useful to add adversarial token doubles—such as a no-return ERC-20 and a zero-first-approval ERC-20—but those only catch quirks already anticipated. A pinned-fork integration test is what validates compatibility with the concrete deployed USDT and Aave contracts rather than with an idealized ERC-20 model.

tokens used
8,362
````

## final message

Created [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192830Z-codex-no-skill-2/testing-quiz-003/answer.md) with the diagnosis, `forceApprove` code fix, and mainnet-fork testing recommendation.

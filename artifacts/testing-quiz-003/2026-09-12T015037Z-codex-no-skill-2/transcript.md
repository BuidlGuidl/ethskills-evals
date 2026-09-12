# Executor transcript — 2026-09-12T015037Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-2/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-2/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a095c7-75d5-7cd0-bbe6-4843cd1841c2
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
I’ll inspect the repository context, then write a concise root-cause and both fixes into `answer.md`.
exec
/bin/bash -lc "ls -la && rg -n \"safeTransferFrom|aavePool\\.supply|MockAavePool|MockERC20\" . --glob '"'!node_modules'"'" in /tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-2/testing-quiz-003
 succeeded in 5ms:
apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-2/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..ca724a34e61569e172c89d88a428d841e1e3b8bf
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Root cause
+
+The failing call is the raw `approve`, not `supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20. In particular, its `approve` does not return the `bool` declared by OpenZeppelin's `IERC20`. A Solidity high-level call through `IERC20.approve` therefore tries to ABI-decode a Boolean from empty return data and reverts. That revert has no token-provided reason string, which explains the empty revert data. The approval and the earlier transfer are then rolled back with the whole transaction.
+
+USDT also has the well-known approval rule that an existing nonzero allowance must be set to zero before it can be changed to another nonzero value. Approval code should account for both quirks.
+
+The first line works because it actually invokes the SafeERC20 wrapper:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+SafeERC20 treats empty return data as success and only rejects a returned value when it explicitly decodes to `false`. By contrast, `using SafeERC20 for IERC20` merely makes library functions available as methods; it does not intercept or rewrite ordinary IERC20 calls. `usdt.approve(...)` still calls the interface method directly, so SafeERC20 never protects it.
+
+The stock OpenZeppelin MockERC20 is standards-conforming: `approve` returns `true` and does not reproduce USDT's zero-first allowance behavior. MockAavePool likewise cannot add the behavior missing from the token mock. Running more tests against those same implementations only explores their semantics, so no number of such tests can reveal an incompatibility they do not model.
+
+# Code fix
+
+Use SafeERC20 for the approval too. With an OpenZeppelin version that provides `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and, when necessary, performs the USDT-compatible sequence of approving zero before approving the requested amount. A common alternative is to establish an unlimited allowance once with `forceApprove`; that also avoids resetting approval on every deposit, provided the vault's allowance policy accepts that tradeoff.
+
+On an older OpenZeppelin release without `forceApprove`, use SafeERC20 low-level calls and explicitly perform the zero-then-amount sequence (for example, `safeApprove(pool, 0)` followed by `safeApprove(pool, amount)`, where that release still exposes `safeApprove`). Do not replace the line with another raw `IERC20.approve` call.
+
+# Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a known block, using the real USDT contract and the real Aave V3 Pool. Fund or impersonate an account holding USDT, deposit through the vault, and assert that Aave receives the supply and the vault gets the expected position. Include repeated deposits so allowance-update behavior is exercised.
+
+Fast unit tests should remain, but add adversarial token mocks for known ERC-20 deviations as well: no return data, `false` return values, and zero-first approvals. The fork test is the decisive pre-deployment check here because it validates the exact deployed token and protocol behavior rather than assuming that `IERC20` conformance makes all ERC-20 deployments interchangeable.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..ca724a34e61569e172c89d88a428d841e1e3b8bf
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Root cause
+
+The failing call is the raw `approve`, not `supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20. In particular, its `approve` does not return the `bool` declared by OpenZeppelin's `IERC20`. A Solidity high-level call through `IERC20.approve` therefore tries to ABI-decode a Boolean from empty return data and reverts. That revert has no token-provided reason string, which explains the empty revert data. The approval and the earlier transfer are then rolled back with the whole transaction.
+
+USDT also has the well-known approval rule that an existing nonzero allowance must be set to zero before it can be changed to another nonzero value. Approval code should account for both quirks.
+
+The first line works because it actually invokes the SafeERC20 wrapper:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+SafeERC20 treats empty return data as success and only rejects a returned value when it explicitly decodes to `false`. By contrast, `using SafeERC20 for IERC20` merely makes library functions available as methods; it does not intercept or rewrite ordinary IERC20 calls. `usdt.approve(...)` still calls the interface method directly, so SafeERC20 never protects it.
+
+The stock OpenZeppelin MockERC20 is standards-conforming: `approve` returns `true` and does not reproduce USDT's zero-first allowance behavior. MockAavePool likewise cannot add the behavior missing from the token mock. Running more tests against those same implementations only explores their semantics, so no number of such tests can reveal an incompatibility they do not model.
+
+# Code fix
+
+Use SafeERC20 for the approval too. With an OpenZeppelin version that provides `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and, when necessary, performs the USDT-compatible sequence of approving zero before approving the requested amount. A common alternative is to establish an unlimited allowance once with `forceApprove`; that also avoids resetting approval on every deposit, provided the vault's allowance policy accepts that tradeoff.
+
+On an older OpenZeppelin release without `forceApprove`, use SafeERC20 low-level calls and explicitly perform the zero-then-amount sequence (for example, `safeApprove(pool, 0)` followed by `safeApprove(pool, amount)`, where that release still exposes `safeApprove`). Do not replace the line with another raw `IERC20.approve` call.
+
+# Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a known block, using the real USDT contract and the real Aave V3 Pool. Fund or impersonate an account holding USDT, deposit through the vault, and assert that Aave receives the supply and the vault gets the expected position. Include repeated deposits so allowance-update behavior is exercised.
+
+Fast unit tests should remain, but add adversarial token mocks for known ERC-20 deviations as well: no return data, `false` return values, and zero-first approvals. The fork test is the decisive pre-deployment check here because it validates the exact deployed token and protocol behavior rather than assuming that `IERC20` conformance makes all ERC-20 deployments interchangeable.

exec
/bin/bash -lc "sed -n '1,240p' answer.md && git status --short" in /tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-2/testing-quiz-003
 succeeded in 7ms:
# Root cause

The failing call is the raw `approve`, not `supply`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is an old, non-standard ERC-20. In particular, its `approve` does not return the `bool` declared by OpenZeppelin's `IERC20`. A Solidity high-level call through `IERC20.approve` therefore tries to ABI-decode a Boolean from empty return data and reverts. That revert has no token-provided reason string, which explains the empty revert data. The approval and the earlier transfer are then rolled back with the whole transaction.

USDT also has the well-known approval rule that an existing nonzero allowance must be set to zero before it can be changed to another nonzero value. Approval code should account for both quirks.

The first line works because it actually invokes the SafeERC20 wrapper:

```solidity
usdt.safeTransferFrom(...);
```

SafeERC20 treats empty return data as success and only rejects a returned value when it explicitly decodes to `false`. By contrast, `using SafeERC20 for IERC20` merely makes library functions available as methods; it does not intercept or rewrite ordinary IERC20 calls. `usdt.approve(...)` still calls the interface method directly, so SafeERC20 never protects it.

The stock OpenZeppelin MockERC20 is standards-conforming: `approve` returns `true` and does not reproduce USDT's zero-first allowance behavior. MockAavePool likewise cannot add the behavior missing from the token mock. Running more tests against those same implementations only explores their semantics, so no number of such tests can reveal an incompatibility they do not model.

# Code fix

Use SafeERC20 for the approval too. With an OpenZeppelin version that provides `forceApprove`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` accepts tokens that return no value and, when necessary, performs the USDT-compatible sequence of approving zero before approving the requested amount. A common alternative is to establish an unlimited allowance once with `forceApprove`; that also avoids resetting approval on every deposit, provided the vault's allowance policy accepts that tradeoff.

On an older OpenZeppelin release without `forceApprove`, use SafeERC20 low-level calls and explicitly perform the zero-then-amount sequence (for example, `safeApprove(pool, 0)` followed by `safeApprove(pool, amount)`, where that release still exposes `safeApprove`). Do not replace the line with another raw `IERC20.approve` call.

# Testing-practice fix

Add a mainnet-fork integration test pinned to a known block, using the real USDT contract and the real Aave V3 Pool. Fund or impersonate an account holding USDT, deposit through the vault, and assert that Aave receives the supply and the vault gets the expected position. Include repeated deposits so allowance-update behavior is exercised.

Fast unit tests should remain, but add adversarial token mocks for known ERC-20 deviations as well: no return data, `false` return values, and zero-first approvals. The fork test is the decisive pre-deployment check here because it validates the exact deployed token and protocol behavior rather than assuming that `IERC20` conformance makes all ERC-20 deployments interchangeable.
?? answer.md

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..ca724a34e61569e172c89d88a428d841e1e3b8bf
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Root cause
+
+The failing call is the raw `approve`, not `supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20. In particular, its `approve` does not return the `bool` declared by OpenZeppelin's `IERC20`. A Solidity high-level call through `IERC20.approve` therefore tries to ABI-decode a Boolean from empty return data and reverts. That revert has no token-provided reason string, which explains the empty revert data. The approval and the earlier transfer are then rolled back with the whole transaction.
+
+USDT also has the well-known approval rule that an existing nonzero allowance must be set to zero before it can be changed to another nonzero value. Approval code should account for both quirks.
+
+The first line works because it actually invokes the SafeERC20 wrapper:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+SafeERC20 treats empty return data as success and only rejects a returned value when it explicitly decodes to `false`. By contrast, `using SafeERC20 for IERC20` merely makes library functions available as methods; it does not intercept or rewrite ordinary IERC20 calls. `usdt.approve(...)` still calls the interface method directly, so SafeERC20 never protects it.
+
+The stock OpenZeppelin MockERC20 is standards-conforming: `approve` returns `true` and does not reproduce USDT's zero-first allowance behavior. MockAavePool likewise cannot add the behavior missing from the token mock. Running more tests against those same implementations only explores their semantics, so no number of such tests can reveal an incompatibility they do not model.
+
+# Code fix
+
+Use SafeERC20 for the approval too. With an OpenZeppelin version that provides `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and, when necessary, performs the USDT-compatible sequence of approving zero before approving the requested amount. A common alternative is to establish an unlimited allowance once with `forceApprove`; that also avoids resetting approval on every deposit, provided the vault's allowance policy accepts that tradeoff.
+
+On an older OpenZeppelin release without `forceApprove`, use SafeERC20 low-level calls and explicitly perform the zero-then-amount sequence (for example, `safeApprove(pool, 0)` followed by `safeApprove(pool, amount)`, where that release still exposes `safeApprove`). Do not replace the line with another raw `IERC20.approve` call.
+
+# Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a known block, using the real USDT contract and the real Aave V3 Pool. Fund or impersonate an account holding USDT, deposit through the vault, and assert that Aave receives the supply and the vault gets the expected position. Include repeated deposits so allowance-update behavior is exercised.
+
+Fast unit tests should remain, but add adversarial token mocks for known ERC-20 deviations as well: no return data, `false` return values, and zero-first approvals. The fork test is the decisive pre-deployment check here because it validates the exact deployed token and protocol behavior rather than assuming that `IERC20` conformance makes all ERC-20 deployments interchangeable.

codex
Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-2/testing-quiz-003/answer.md) with the root cause, `forceApprove` fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..ca724a34e61569e172c89d88a428d841e1e3b8bf
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Root cause
+
+The failing call is the raw `approve`, not `supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20. In particular, its `approve` does not return the `bool` declared by OpenZeppelin's `IERC20`. A Solidity high-level call through `IERC20.approve` therefore tries to ABI-decode a Boolean from empty return data and reverts. That revert has no token-provided reason string, which explains the empty revert data. The approval and the earlier transfer are then rolled back with the whole transaction.
+
+USDT also has the well-known approval rule that an existing nonzero allowance must be set to zero before it can be changed to another nonzero value. Approval code should account for both quirks.
+
+The first line works because it actually invokes the SafeERC20 wrapper:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+SafeERC20 treats empty return data as success and only rejects a returned value when it explicitly decodes to `false`. By contrast, `using SafeERC20 for IERC20` merely makes library functions available as methods; it does not intercept or rewrite ordinary IERC20 calls. `usdt.approve(...)` still calls the interface method directly, so SafeERC20 never protects it.
+
+The stock OpenZeppelin MockERC20 is standards-conforming: `approve` returns `true` and does not reproduce USDT's zero-first allowance behavior. MockAavePool likewise cannot add the behavior missing from the token mock. Running more tests against those same implementations only explores their semantics, so no number of such tests can reveal an incompatibility they do not model.
+
+# Code fix
+
+Use SafeERC20 for the approval too. With an OpenZeppelin version that provides `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and, when necessary, performs the USDT-compatible sequence of approving zero before approving the requested amount. A common alternative is to establish an unlimited allowance once with `forceApprove`; that also avoids resetting approval on every deposit, provided the vault's allowance policy accepts that tradeoff.
+
+On an older OpenZeppelin release without `forceApprove`, use SafeERC20 low-level calls and explicitly perform the zero-then-amount sequence (for example, `safeApprove(pool, 0)` followed by `safeApprove(pool, amount)`, where that release still exposes `safeApprove`). Do not replace the line with another raw `IERC20.approve` call.
+
+# Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a known block, using the real USDT contract and the real Aave V3 Pool. Fund or impersonate an account holding USDT, deposit through the vault, and assert that Aave receives the supply and the vault gets the expected position. Include repeated deposits so allowance-update behavior is exercised.
+
+Fast unit tests should remain, but add adversarial token mocks for known ERC-20 deviations as well: no return data, `false` return values, and zero-first approvals. The fork test is the decisive pre-deployment check here because it validates the exact deployed token and protocol behavior rather than assuming that `IERC20` conformance makes all ERC-20 deployments interchangeable.

tokens used
8,564
````

## final message

Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-2/testing-quiz-003/answer.md) with the root cause, `forceApprove` fix, and mainnet-fork testing recommendation.

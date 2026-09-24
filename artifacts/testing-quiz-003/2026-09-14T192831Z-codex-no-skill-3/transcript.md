# Executor transcript — 2026-09-14T192831Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192831Z-codex-no-skill-3/testing-quiz-003

## session

````text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192831Z-codex-no-skill-3/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a166-cb6b-7da3-99a8-58aa6f062a0a
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
I’ll trace the token-call semantics against the shown code, then write a concise root-cause and remediation note to `answer.md`.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!lib'"' | head -20" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192831Z-codex-no-skill-3/testing-quiz-003
 succeeded in 6ms:
codex
The failure boundary is decisive: `safeTransferFrom` uses SafeERC20’s optional-return handling, while `.approve(...)` is a direct interface call. I’m documenting that distinction and the robust allowance fix (`forceApprove`) along with fork-based integration testing.
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192831Z-codex-no-skill-3/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4bbad7245cc48603e05609bb9f3a416f70c2c622
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,45 @@
+# Why the USDT deposit reverts
+
+The failing call is:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` required by the modern `IERC20` interface. Calling it through `IERC20.approve` makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so that decoding fails and the transaction reverts without a token-provided reason string.
+
+The preceding transfer succeeds because it is invoked differently:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is a SafeERC20 wrapper. It treats empty return data as success and, when return data is present, requires it to decode to `true`. This exists specifically to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` does not automatically wrap every `IERC20` call. It only adds the library's explicitly named extension methods. The code calls the token's raw `approve`, not a SafeERC20 allowance method, so SafeERC20 never participates in the failing call.
+
+## Code fix
+
+Use SafeERC20 for the approval as well:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's optional-return handling and also supports tokens such as USDT that may require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. It is therefore preferable to a raw `approve` (and more robust than merely replacing it with an allowance helper that does not handle the zero-reset rule). The exact method name depends on the installed OpenZeppelin version; upgrade to a version providing `forceApprove`, or implement the same safe zero-then-set behavior with optional-return calls.
+
+An alternative architecture is to establish the pool's maximum allowance once, using `forceApprove`, and then call `supply` for subsequent deposits. That choice should be made with the corresponding allowance-risk tradeoff in mind.
+
+## Why the mock suite could not catch it
+
+OpenZeppelin's stock `ERC20` is standards-compliant: its `approve` returns `true` and it permits ordinary allowance replacement. It therefore does not reproduce either of USDT's relevant behaviors. Token decimals are unrelated to this failure.
+
+Adding more tests against the same mock only explores more scenarios under the same incorrect behavioral assumption. Even exhaustive tests cannot reveal an integration incompatibility that the mock does not model.
+
+The testing-practice fix is to include a mainnet-fork integration test using the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 pool, with a funded/impersonated holder (or otherwise provisioned USDT). The test should execute the complete deposit path and verify the resulting Aave position. Pinning the fork to a known block makes it reproducible.
+
+Purpose-built adversarial token mocks are also useful unit-test coverage: include a no-return ERC-20 and a zero-reset-approval token. But those complement rather than replace fork tests. A fork test exercises the actual deployed token ABI/bytecode and protocol interaction and would have failed at the raw `approve` before deployment.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4bbad7245cc48603e05609bb9f3a416f70c2c622
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,45 @@
+# Why the USDT deposit reverts
+
+The failing call is:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` required by the modern `IERC20` interface. Calling it through `IERC20.approve` makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so that decoding fails and the transaction reverts without a token-provided reason string.
+
+The preceding transfer succeeds because it is invoked differently:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is a SafeERC20 wrapper. It treats empty return data as success and, when return data is present, requires it to decode to `true`. This exists specifically to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` does not automatically wrap every `IERC20` call. It only adds the library's explicitly named extension methods. The code calls the token's raw `approve`, not a SafeERC20 allowance method, so SafeERC20 never participates in the failing call.
+
+## Code fix
+
+Use SafeERC20 for the approval as well:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's optional-return handling and also supports tokens such as USDT that may require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. It is therefore preferable to a raw `approve` (and more robust than merely replacing it with an allowance helper that does not handle the zero-reset rule). The exact method name depends on the installed OpenZeppelin version; upgrade to a version providing `forceApprove`, or implement the same safe zero-then-set behavior with optional-return calls.
+
+An alternative architecture is to establish the pool's maximum allowance once, using `forceApprove`, and then call `supply` for subsequent deposits. That choice should be made with the corresponding allowance-risk tradeoff in mind.
+
+## Why the mock suite could not catch it
+
+OpenZeppelin's stock `ERC20` is standards-compliant: its `approve` returns `true` and it permits ordinary allowance replacement. It therefore does not reproduce either of USDT's relevant behaviors. Token decimals are unrelated to this failure.
+
+Adding more tests against the same mock only explores more scenarios under the same incorrect behavioral assumption. Even exhaustive tests cannot reveal an integration incompatibility that the mock does not model.
+
+The testing-practice fix is to include a mainnet-fork integration test using the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 pool, with a funded/impersonated holder (or otherwise provisioned USDT). The test should execute the complete deposit path and verify the resulting Aave position. Pinning the fork to a known block makes it reproducible.
+
+Purpose-built adversarial token mocks are also useful unit-test coverage: include a no-return ERC-20 and a zero-reset-approval token. But those complement rather than replace fork tests. A fork test exercises the actual deployed token ABI/bytecode and protocol interaction and would have failed at the raw `approve` before deployment.

exec
/bin/bash -lc "sed -n '1,240p' answer.md && git status --short" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192831Z-codex-no-skill-3/testing-quiz-003
 succeeded in 1ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4bbad7245cc48603e05609bb9f3a416f70c2c622
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,45 @@
+# Why the USDT deposit reverts
+
+The failing call is:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` required by the modern `IERC20` interface. Calling it through `IERC20.approve` makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so that decoding fails and the transaction reverts without a token-provided reason string.
+
+The preceding transfer succeeds because it is invoked differently:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is a SafeERC20 wrapper. It treats empty return data as success and, when return data is present, requires it to decode to `true`. This exists specifically to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` does not automatically wrap every `IERC20` call. It only adds the library's explicitly named extension methods. The code calls the token's raw `approve`, not a SafeERC20 allowance method, so SafeERC20 never participates in the failing call.
+
+## Code fix
+
+Use SafeERC20 for the approval as well:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's optional-return handling and also supports tokens such as USDT that may require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. It is therefore preferable to a raw `approve` (and more robust than merely replacing it with an allowance helper that does not handle the zero-reset rule). The exact method name depends on the installed OpenZeppelin version; upgrade to a version providing `forceApprove`, or implement the same safe zero-then-set behavior with optional-return calls.
+
+An alternative architecture is to establish the pool's maximum allowance once, using `forceApprove`, and then call `supply` for subsequent deposits. That choice should be made with the corresponding allowance-risk tradeoff in mind.
+
+## Why the mock suite could not catch it
+
+OpenZeppelin's stock `ERC20` is standards-compliant: its `approve` returns `true` and it permits ordinary allowance replacement. It therefore does not reproduce either of USDT's relevant behaviors. Token decimals are unrelated to this failure.
+
+Adding more tests against the same mock only explores more scenarios under the same incorrect behavioral assumption. Even exhaustive tests cannot reveal an integration incompatibility that the mock does not model.
+
+The testing-practice fix is to include a mainnet-fork integration test using the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 pool, with a funded/impersonated holder (or otherwise provisioned USDT). The test should execute the complete deposit path and verify the resulting Aave position. Pinning the fork to a known block makes it reproducible.
+
+Purpose-built adversarial token mocks are also useful unit-test coverage: include a no-return ERC-20 and a zero-reset-approval token. But those complement rather than replace fork tests. A fork test exercises the actual deployed token ABI/bytecode and protocol interaction and would have failed at the raw `approve` before deployment.

codex
Created [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192831Z-codex-no-skill-3/testing-quiz-003/answer.md) with the root cause, `forceApprove` fix, and recommended mainnet-fork testing practice.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4bbad7245cc48603e05609bb9f3a416f70c2c622
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,45 @@
+# Why the USDT deposit reverts
+
+The failing call is:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` required by the modern `IERC20` interface. Calling it through `IERC20.approve` makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so that decoding fails and the transaction reverts without a token-provided reason string.
+
+The preceding transfer succeeds because it is invoked differently:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is a SafeERC20 wrapper. It treats empty return data as success and, when return data is present, requires it to decode to `true`. This exists specifically to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` does not automatically wrap every `IERC20` call. It only adds the library's explicitly named extension methods. The code calls the token's raw `approve`, not a SafeERC20 allowance method, so SafeERC20 never participates in the failing call.
+
+## Code fix
+
+Use SafeERC20 for the approval as well:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's optional-return handling and also supports tokens such as USDT that may require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. It is therefore preferable to a raw `approve` (and more robust than merely replacing it with an allowance helper that does not handle the zero-reset rule). The exact method name depends on the installed OpenZeppelin version; upgrade to a version providing `forceApprove`, or implement the same safe zero-then-set behavior with optional-return calls.
+
+An alternative architecture is to establish the pool's maximum allowance once, using `forceApprove`, and then call `supply` for subsequent deposits. That choice should be made with the corresponding allowance-risk tradeoff in mind.
+
+## Why the mock suite could not catch it
+
+OpenZeppelin's stock `ERC20` is standards-compliant: its `approve` returns `true` and it permits ordinary allowance replacement. It therefore does not reproduce either of USDT's relevant behaviors. Token decimals are unrelated to this failure.
+
+Adding more tests against the same mock only explores more scenarios under the same incorrect behavioral assumption. Even exhaustive tests cannot reveal an integration incompatibility that the mock does not model.
+
+The testing-practice fix is to include a mainnet-fork integration test using the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 pool, with a funded/impersonated holder (or otherwise provisioned USDT). The test should execute the complete deposit path and verify the resulting Aave position. Pinning the fork to a known block makes it reproducible.
+
+Purpose-built adversarial token mocks are also useful unit-test coverage: include a no-return ERC-20 and a zero-reset-approval token. But those complement rather than replace fork tests. A fork test exercises the actual deployed token ABI/bytecode and protocol interaction and would have failed at the raw `approve` before deployment.

tokens used
8,034
````

## final message

Created [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192831Z-codex-no-skill-3/testing-quiz-003/answer.md) with the root cause, `forceApprove` fix, and recommended mainnet-fork testing practice.

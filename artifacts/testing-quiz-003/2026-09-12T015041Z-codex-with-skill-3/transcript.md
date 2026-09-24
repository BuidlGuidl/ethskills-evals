# Executor transcript — 2026-09-12T015041Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-pr101-workspaces/2026-09-12T015041Z-codex-with-skill-3/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-pr101-workspaces/2026-09-12T015041Z-codex-with-skill-3/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a095c8-a448-7490-83c7-00cfdbc5ca33
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
I’m using the testing skill because this is specifically about why a green Foundry mock suite failed to establish mainnet safety. I’ll inspect its guidance, then write the diagnosis and both fixes to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md && printf '\\nFILES\\n' && rg --files -g 'AGENTS.md' -g '"'!lib'"' -g '"'!node_modules'"'" in /tmp/ethskills-pr101-workspaces/2026-09-12T015041Z-codex-with-skill-3/testing-quiz-003
 exited 1 in 6ms:
codex
The key mismatch is confirmed: mainnet USDT returns no ABI-encoded `bool` from `approve`, while the OpenZeppelin mock does. The successful `safeTransferFrom` is consistent with that same quirk because `SafeERC20` deliberately accepts empty return data; the direct `approve` call does not.
apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015041Z-codex-with-skill-3/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1989c5f24ec3daeeb59bf077a0ff3ba78141de73
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,43 @@
+# Why the mainnet deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the ERC-20 convention used by modern OpenZeppelin tokens. Its `approve` implementation does not return an ABI-encoded `bool`. But `usdt` is statically typed as `IERC20`, whose `approve` signature promises a `bool` return value. Solidity therefore makes the call and then tries to decode 32 bytes of return data. USDT returns no data, so that ABI decoding fails and the caller reverts, commonly with empty revert data. The pool call is never reached.
+
+The preceding transfer succeeds for exactly the reason the approval does not:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`using SafeERC20 for IERC20` only affects calls made through the library's extension methods. It does not rewrite or intercept ordinary interface calls such as `usdt.approve(...)`. `safeTransferFrom` uses a low-level call and treats either empty return data or an encoded `true` as success, so it supports USDT. The direct `approve` uses Solidity's normal high-level ABI decoding and receives no such protection.
+
+There is a second USDT approval behavior worth handling: changing an existing nonzero allowance directly to another nonzero value is rejected. Even if Aave normally consumes the entire allowance, robust integration code should not rely on that incidental state.
+
+## Code fix
+
+With an OpenZeppelin version that provides it, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's optional-return handling and, for tokens such as USDT, falls back to approving zero before approving the requested nonzero amount. Upgrading to a current compatible OpenZeppelin release is preferable to hand-rolling this logic. If the installed SafeERC20 predates `forceApprove`, the equivalent is to perform the zero approval and then the desired approval through SafeERC20's optional-return low-level-call machinery—not through direct `IERC20.approve` calls.
+
+## Why the mock suite could not catch it
+
+The stock OpenZeppelin `MockERC20` is a standards-conforming token: its `approve` returns an encoded `true` and it permits the ordinary allowance transitions expected by the tests. `MockAavePool` likewise contains only the behavior the test author chose to model. Thus the mocks encode the very assumptions that are wrong on mainnet.
+
+Adding more cases, fuzz inputs, or assertions against those same conforming mocks cannot discover a return-data shape or allowance rule the mocks do not implement. Thirty-nine green tests only show compatibility with those mocks; they do not establish compatibility with the deployed contracts. A deliberately USDT-like adversarial mock could reproduce this particular defect, but only after the quirk was already known and modeled.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that exercises the full deposit path against the real deployed USDT and the real Aave V3 pool (or its canonical address-provider-resolved pool). Fund a test actor with real forked USDT state, approve the vault, call `deposit`, and assert that the deposit succeeds and that the expected Aave position/accounting changes occur. Pin the block and verify that the RPC endpoint serves historical state so the test is reproducible.
+
+That fork test would execute the real USDT bytecode and observe its empty `approve` return data, causing the original implementation to fail before deployment. Keep fast mock unit tests for vault logic, but require pinned-fork tests for external protocol integrations and non-standard tokens; mocks are not substitutes for compatibility tests against deployed dependencies.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1989c5f24ec3daeeb59bf077a0ff3ba78141de73
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,43 @@
+# Why the mainnet deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the ERC-20 convention used by modern OpenZeppelin tokens. Its `approve` implementation does not return an ABI-encoded `bool`. But `usdt` is statically typed as `IERC20`, whose `approve` signature promises a `bool` return value. Solidity therefore makes the call and then tries to decode 32 bytes of return data. USDT returns no data, so that ABI decoding fails and the caller reverts, commonly with empty revert data. The pool call is never reached.
+
+The preceding transfer succeeds for exactly the reason the approval does not:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`using SafeERC20 for IERC20` only affects calls made through the library's extension methods. It does not rewrite or intercept ordinary interface calls such as `usdt.approve(...)`. `safeTransferFrom` uses a low-level call and treats either empty return data or an encoded `true` as success, so it supports USDT. The direct `approve` uses Solidity's normal high-level ABI decoding and receives no such protection.
+
+There is a second USDT approval behavior worth handling: changing an existing nonzero allowance directly to another nonzero value is rejected. Even if Aave normally consumes the entire allowance, robust integration code should not rely on that incidental state.
+
+## Code fix
+
+With an OpenZeppelin version that provides it, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's optional-return handling and, for tokens such as USDT, falls back to approving zero before approving the requested nonzero amount. Upgrading to a current compatible OpenZeppelin release is preferable to hand-rolling this logic. If the installed SafeERC20 predates `forceApprove`, the equivalent is to perform the zero approval and then the desired approval through SafeERC20's optional-return low-level-call machinery—not through direct `IERC20.approve` calls.
+
+## Why the mock suite could not catch it
+
+The stock OpenZeppelin `MockERC20` is a standards-conforming token: its `approve` returns an encoded `true` and it permits the ordinary allowance transitions expected by the tests. `MockAavePool` likewise contains only the behavior the test author chose to model. Thus the mocks encode the very assumptions that are wrong on mainnet.
+
+Adding more cases, fuzz inputs, or assertions against those same conforming mocks cannot discover a return-data shape or allowance rule the mocks do not implement. Thirty-nine green tests only show compatibility with those mocks; they do not establish compatibility with the deployed contracts. A deliberately USDT-like adversarial mock could reproduce this particular defect, but only after the quirk was already known and modeled.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that exercises the full deposit path against the real deployed USDT and the real Aave V3 pool (or its canonical address-provider-resolved pool). Fund a test actor with real forked USDT state, approve the vault, call `deposit`, and assert that the deposit succeeds and that the expected Aave position/accounting changes occur. Pin the block and verify that the RPC endpoint serves historical state so the test is reproducible.
+
+That fork test would execute the real USDT bytecode and observe its empty `approve` return data, causing the original implementation to fail before deployment. Keep fast mock unit tests for vault logic, but require pinned-fork tests for external protocol integrations and non-standard tokens; mocks are not substitutes for compatibility tests against deployed dependencies.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git diff --check -- answer.md" in /tmp/ethskills-pr101-workspaces/2026-09-12T015041Z-codex-with-skill-3/testing-quiz-003
 succeeded in 5ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1989c5f24ec3daeeb59bf077a0ff3ba78141de73
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,43 @@
+# Why the mainnet deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the ERC-20 convention used by modern OpenZeppelin tokens. Its `approve` implementation does not return an ABI-encoded `bool`. But `usdt` is statically typed as `IERC20`, whose `approve` signature promises a `bool` return value. Solidity therefore makes the call and then tries to decode 32 bytes of return data. USDT returns no data, so that ABI decoding fails and the caller reverts, commonly with empty revert data. The pool call is never reached.
+
+The preceding transfer succeeds for exactly the reason the approval does not:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`using SafeERC20 for IERC20` only affects calls made through the library's extension methods. It does not rewrite or intercept ordinary interface calls such as `usdt.approve(...)`. `safeTransferFrom` uses a low-level call and treats either empty return data or an encoded `true` as success, so it supports USDT. The direct `approve` uses Solidity's normal high-level ABI decoding and receives no such protection.
+
+There is a second USDT approval behavior worth handling: changing an existing nonzero allowance directly to another nonzero value is rejected. Even if Aave normally consumes the entire allowance, robust integration code should not rely on that incidental state.
+
+## Code fix
+
+With an OpenZeppelin version that provides it, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's optional-return handling and, for tokens such as USDT, falls back to approving zero before approving the requested nonzero amount. Upgrading to a current compatible OpenZeppelin release is preferable to hand-rolling this logic. If the installed SafeERC20 predates `forceApprove`, the equivalent is to perform the zero approval and then the desired approval through SafeERC20's optional-return low-level-call machinery—not through direct `IERC20.approve` calls.
+
+## Why the mock suite could not catch it
+
+The stock OpenZeppelin `MockERC20` is a standards-conforming token: its `approve` returns an encoded `true` and it permits the ordinary allowance transitions expected by the tests. `MockAavePool` likewise contains only the behavior the test author chose to model. Thus the mocks encode the very assumptions that are wrong on mainnet.
+
+Adding more cases, fuzz inputs, or assertions against those same conforming mocks cannot discover a return-data shape or allowance rule the mocks do not implement. Thirty-nine green tests only show compatibility with those mocks; they do not establish compatibility with the deployed contracts. A deliberately USDT-like adversarial mock could reproduce this particular defect, but only after the quirk was already known and modeled.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that exercises the full deposit path against the real deployed USDT and the real Aave V3 pool (or its canonical address-provider-resolved pool). Fund a test actor with real forked USDT state, approve the vault, call `deposit`, and assert that the deposit succeeds and that the expected Aave position/accounting changes occur. Pin the block and verify that the RPC endpoint serves historical state so the test is reproducible.
+
+That fork test would execute the real USDT bytecode and observe its empty `approve` return data, causing the original implementation to fail before deployment. Keep fast mock unit tests for vault logic, but require pinned-fork tests for external protocol integrations and non-standard tokens; mocks are not substitutes for compatibility tests against deployed dependencies.

codex
Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015041Z-codex-with-skill-3/testing-quiz-003/answer.md) with the diagnosis, `forceApprove` fix, and pinned mainnet-fork testing recommendation. `git diff --check` passes.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1989c5f24ec3daeeb59bf077a0ff3ba78141de73
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,43 @@
+# Why the mainnet deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the ERC-20 convention used by modern OpenZeppelin tokens. Its `approve` implementation does not return an ABI-encoded `bool`. But `usdt` is statically typed as `IERC20`, whose `approve` signature promises a `bool` return value. Solidity therefore makes the call and then tries to decode 32 bytes of return data. USDT returns no data, so that ABI decoding fails and the caller reverts, commonly with empty revert data. The pool call is never reached.
+
+The preceding transfer succeeds for exactly the reason the approval does not:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`using SafeERC20 for IERC20` only affects calls made through the library's extension methods. It does not rewrite or intercept ordinary interface calls such as `usdt.approve(...)`. `safeTransferFrom` uses a low-level call and treats either empty return data or an encoded `true` as success, so it supports USDT. The direct `approve` uses Solidity's normal high-level ABI decoding and receives no such protection.
+
+There is a second USDT approval behavior worth handling: changing an existing nonzero allowance directly to another nonzero value is rejected. Even if Aave normally consumes the entire allowance, robust integration code should not rely on that incidental state.
+
+## Code fix
+
+With an OpenZeppelin version that provides it, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's optional-return handling and, for tokens such as USDT, falls back to approving zero before approving the requested nonzero amount. Upgrading to a current compatible OpenZeppelin release is preferable to hand-rolling this logic. If the installed SafeERC20 predates `forceApprove`, the equivalent is to perform the zero approval and then the desired approval through SafeERC20's optional-return low-level-call machinery—not through direct `IERC20.approve` calls.
+
+## Why the mock suite could not catch it
+
+The stock OpenZeppelin `MockERC20` is a standards-conforming token: its `approve` returns an encoded `true` and it permits the ordinary allowance transitions expected by the tests. `MockAavePool` likewise contains only the behavior the test author chose to model. Thus the mocks encode the very assumptions that are wrong on mainnet.
+
+Adding more cases, fuzz inputs, or assertions against those same conforming mocks cannot discover a return-data shape or allowance rule the mocks do not implement. Thirty-nine green tests only show compatibility with those mocks; they do not establish compatibility with the deployed contracts. A deliberately USDT-like adversarial mock could reproduce this particular defect, but only after the quirk was already known and modeled.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that exercises the full deposit path against the real deployed USDT and the real Aave V3 pool (or its canonical address-provider-resolved pool). Fund a test actor with real forked USDT state, approve the vault, call `deposit`, and assert that the deposit succeeds and that the expected Aave position/accounting changes occur. Pin the block and verify that the RPC endpoint serves historical state so the test is reproducible.
+
+That fork test would execute the real USDT bytecode and observe its empty `approve` return data, causing the original implementation to fail before deployment. Keep fast mock unit tests for vault logic, but require pinned-fork tests for external protocol integrations and non-standard tokens; mocks are not substitutes for compatibility tests against deployed dependencies.

tokens used
9,943
````

## final message

Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015041Z-codex-with-skill-3/testing-quiz-003/answer.md) with the diagnosis, `forceApprove` fix, and pinned mainnet-fork testing recommendation. `git diff --check` passes.

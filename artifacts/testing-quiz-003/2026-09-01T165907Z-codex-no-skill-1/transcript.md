# Executor transcript — 2026-09-01T165907Z-codex-no-skill-1

**executor**: codex  |  **model**: cli default  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-01T165907Z-codex-no-skill-1/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-01T165907Z-codex-no-skill-1/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a05df8-ce25-7863-868d-8cfb6bef259a
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

2026-09-01T17:16:22.154191Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a05df8-ce25-7863-868d-8cfb6bef259a.tmp-1788282981933112317: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the workspace instructions and then write the diagnosis and both fixes into `answer.md`.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!lib'"' | head -20" in /home/damu/.cache/ethskills-evals/2026-09-01T165907Z-codex-no-skill-1/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/home/damu/.cache/ethskills-evals/2026-09-01T165907Z-codex-no-skill-1/testing-quiz-003

apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-01T165907Z-codex-no-skill-1/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4ced3c4b630cc38324b972fa2dc6cdc2fe057f62
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`, not the preceding transfer:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve(address,uint256)` implementation does not return a `bool`, even though `IERC20.approve` declares one. Solidity therefore makes the external call and then tries to ABI-decode a Boolean from the return data. USDT returns no data, so that decode reverts. ABI-decoding failures commonly surface as empty revert data, which explains the missing reason string.
+
+The mock cannot reproduce this behavior. OpenZeppelin's stock `ERC20` is standards-compliant and returns `true` from `approve`, so the decode succeeds. Matching USDT's six decimals matches only its unit scale; it does not reproduce USDT's call/return behavior or its allowance quirks. Running any number of tests against that same mock only explores the mock's implementation, so those tests cannot reveal an incompatibility that the mock does not model.
+
+`using SafeERC20 for IERC20` merely adds the library's extension methods to the type. It does not intercept or rewrite ordinary interface calls. Thus `safeTransferFrom` used SafeERC20's low-level optional-return handling and worked with USDT, while `approve` was still a direct `IERC20.approve` call and retained the strict Boolean ABI decode.
+
+## Code fix
+
+Use SafeERC20 for the allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the robust OpenZeppelin helper for tokens such as USDT: it accepts an empty successful return value and, when necessary, resets an existing nonzero allowance to zero before setting the requested allowance. With an older OpenZeppelin release that lacks `forceApprove`, perform the equivalent operation with SafeERC20-compatible calls: set the allowance to zero and then set it to `amount` (or upgrade OpenZeppelin). A raw `approve` should not be used.
+
+## Testing-practice fix
+
+Add mainnet-fork integration tests, pinned to a known block, using the actual deployed USDT and Aave V3 pool contracts. Fund or impersonate a real USDT holder, execute the complete deposit path, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but do not treat a generic OpenZeppelin ERC-20 mock as a compatibility test for production tokens.
+
+Where fork testing is impractical, add token-faithful adversarial mocks that reproduce non-standard behaviors—especially successful `transfer`/`approve` calls with empty return data and the zero-first allowance rule. The fork test is the decisive pre-deployment check because it exercises the exact token and protocol implementations and their real integration semantics.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4ced3c4b630cc38324b972fa2dc6cdc2fe057f62
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`, not the preceding transfer:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve(address,uint256)` implementation does not return a `bool`, even though `IERC20.approve` declares one. Solidity therefore makes the external call and then tries to ABI-decode a Boolean from the return data. USDT returns no data, so that decode reverts. ABI-decoding failures commonly surface as empty revert data, which explains the missing reason string.
+
+The mock cannot reproduce this behavior. OpenZeppelin's stock `ERC20` is standards-compliant and returns `true` from `approve`, so the decode succeeds. Matching USDT's six decimals matches only its unit scale; it does not reproduce USDT's call/return behavior or its allowance quirks. Running any number of tests against that same mock only explores the mock's implementation, so those tests cannot reveal an incompatibility that the mock does not model.
+
+`using SafeERC20 for IERC20` merely adds the library's extension methods to the type. It does not intercept or rewrite ordinary interface calls. Thus `safeTransferFrom` used SafeERC20's low-level optional-return handling and worked with USDT, while `approve` was still a direct `IERC20.approve` call and retained the strict Boolean ABI decode.
+
+## Code fix
+
+Use SafeERC20 for the allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the robust OpenZeppelin helper for tokens such as USDT: it accepts an empty successful return value and, when necessary, resets an existing nonzero allowance to zero before setting the requested allowance. With an older OpenZeppelin release that lacks `forceApprove`, perform the equivalent operation with SafeERC20-compatible calls: set the allowance to zero and then set it to `amount` (or upgrade OpenZeppelin). A raw `approve` should not be used.
+
+## Testing-practice fix
+
+Add mainnet-fork integration tests, pinned to a known block, using the actual deployed USDT and Aave V3 pool contracts. Fund or impersonate a real USDT holder, execute the complete deposit path, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but do not treat a generic OpenZeppelin ERC-20 mock as a compatibility test for production tokens.
+
+Where fork testing is impractical, add token-faithful adversarial mocks that reproduce non-standard behaviors—especially successful `transfer`/`approve` calls with empty return data and the zero-first allowance rule. The fork test is the decisive pre-deployment check because it exercises the exact token and protocol implementations and their real integration semantics.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /home/damu/.cache/ethskills-evals/2026-09-01T165907Z-codex-no-skill-1/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Why the USDT deposit reverts

The failing call is the direct `approve`, not the preceding transfer:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve(address,uint256)` implementation does not return a `bool`, even though `IERC20.approve` declares one. Solidity therefore makes the external call and then tries to ABI-decode a Boolean from the return data. USDT returns no data, so that decode reverts. ABI-decoding failures commonly surface as empty revert data, which explains the missing reason string.

The mock cannot reproduce this behavior. OpenZeppelin's stock `ERC20` is standards-compliant and returns `true` from `approve`, so the decode succeeds. Matching USDT's six decimals matches only its unit scale; it does not reproduce USDT's call/return behavior or its allowance quirks. Running any number of tests against that same mock only explores the mock's implementation, so those tests cannot reveal an incompatibility that the mock does not model.

`using SafeERC20 for IERC20` merely adds the library's extension methods to the type. It does not intercept or rewrite ordinary interface calls. Thus `safeTransferFrom` used SafeERC20's low-level optional-return handling and worked with USDT, while `approve` was still a direct `IERC20.approve` call and retained the strict Boolean ABI decode.

## Code fix

Use SafeERC20 for the allowance operation as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the robust OpenZeppelin helper for tokens such as USDT: it accepts an empty successful return value and, when necessary, resets an existing nonzero allowance to zero before setting the requested allowance. With an older OpenZeppelin release that lacks `forceApprove`, perform the equivalent operation with SafeERC20-compatible calls: set the allowance to zero and then set it to `amount` (or upgrade OpenZeppelin). A raw `approve` should not be used.

## Testing-practice fix

Add mainnet-fork integration tests, pinned to a known block, using the actual deployed USDT and Aave V3 pool contracts. Fund or impersonate a real USDT holder, execute the complete deposit path, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but do not treat a generic OpenZeppelin ERC-20 mock as a compatibility test for production tokens.

Where fork testing is impractical, add token-faithful adversarial mocks that reproduce non-standard behaviors—especially successful `transfer`/`approve` calls with empty return data and the zero-first allowance rule. The fork test is the decisive pre-deployment check because it exercises the exact token and protocol implementations and their real integration semantics.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4ced3c4b630cc38324b972fa2dc6cdc2fe057f62
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`, not the preceding transfer:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve(address,uint256)` implementation does not return a `bool`, even though `IERC20.approve` declares one. Solidity therefore makes the external call and then tries to ABI-decode a Boolean from the return data. USDT returns no data, so that decode reverts. ABI-decoding failures commonly surface as empty revert data, which explains the missing reason string.
+
+The mock cannot reproduce this behavior. OpenZeppelin's stock `ERC20` is standards-compliant and returns `true` from `approve`, so the decode succeeds. Matching USDT's six decimals matches only its unit scale; it does not reproduce USDT's call/return behavior or its allowance quirks. Running any number of tests against that same mock only explores the mock's implementation, so those tests cannot reveal an incompatibility that the mock does not model.
+
+`using SafeERC20 for IERC20` merely adds the library's extension methods to the type. It does not intercept or rewrite ordinary interface calls. Thus `safeTransferFrom` used SafeERC20's low-level optional-return handling and worked with USDT, while `approve` was still a direct `IERC20.approve` call and retained the strict Boolean ABI decode.
+
+## Code fix
+
+Use SafeERC20 for the allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the robust OpenZeppelin helper for tokens such as USDT: it accepts an empty successful return value and, when necessary, resets an existing nonzero allowance to zero before setting the requested allowance. With an older OpenZeppelin release that lacks `forceApprove`, perform the equivalent operation with SafeERC20-compatible calls: set the allowance to zero and then set it to `amount` (or upgrade OpenZeppelin). A raw `approve` should not be used.
+
+## Testing-practice fix
+
+Add mainnet-fork integration tests, pinned to a known block, using the actual deployed USDT and Aave V3 pool contracts. Fund or impersonate a real USDT holder, execute the complete deposit path, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but do not treat a generic OpenZeppelin ERC-20 mock as a compatibility test for production tokens.
+
+Where fork testing is impractical, add token-faithful adversarial mocks that reproduce non-standard behaviors—especially successful `transfer`/`approve` calls with empty return data and the zero-first allowance rule. The fork test is the decisive pre-deployment check because it exercises the exact token and protocol implementations and their real integration semantics.

codex
Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165907Z-codex-no-skill-1/testing-quiz-003/answer.md) with the USDT incompatibility diagnosis, `forceApprove` fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4ced3c4b630cc38324b972fa2dc6cdc2fe057f62
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`, not the preceding transfer:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve(address,uint256)` implementation does not return a `bool`, even though `IERC20.approve` declares one. Solidity therefore makes the external call and then tries to ABI-decode a Boolean from the return data. USDT returns no data, so that decode reverts. ABI-decoding failures commonly surface as empty revert data, which explains the missing reason string.
+
+The mock cannot reproduce this behavior. OpenZeppelin's stock `ERC20` is standards-compliant and returns `true` from `approve`, so the decode succeeds. Matching USDT's six decimals matches only its unit scale; it does not reproduce USDT's call/return behavior or its allowance quirks. Running any number of tests against that same mock only explores the mock's implementation, so those tests cannot reveal an incompatibility that the mock does not model.
+
+`using SafeERC20 for IERC20` merely adds the library's extension methods to the type. It does not intercept or rewrite ordinary interface calls. Thus `safeTransferFrom` used SafeERC20's low-level optional-return handling and worked with USDT, while `approve` was still a direct `IERC20.approve` call and retained the strict Boolean ABI decode.
+
+## Code fix
+
+Use SafeERC20 for the allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the robust OpenZeppelin helper for tokens such as USDT: it accepts an empty successful return value and, when necessary, resets an existing nonzero allowance to zero before setting the requested allowance. With an older OpenZeppelin release that lacks `forceApprove`, perform the equivalent operation with SafeERC20-compatible calls: set the allowance to zero and then set it to `amount` (or upgrade OpenZeppelin). A raw `approve` should not be used.
+
+## Testing-practice fix
+
+Add mainnet-fork integration tests, pinned to a known block, using the actual deployed USDT and Aave V3 pool contracts. Fund or impersonate a real USDT holder, execute the complete deposit path, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but do not treat a generic OpenZeppelin ERC-20 mock as a compatibility test for production tokens.
+
+Where fork testing is impractical, add token-faithful adversarial mocks that reproduce non-standard behaviors—especially successful `transfer`/`approve` calls with empty return data and the zero-first allowance rule. The fork test is the decisive pre-deployment check because it exercises the exact token and protocol implementations and their real integration semantics.

tokens used
17,835
````

## final message

Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165907Z-codex-no-skill-1/testing-quiz-003/answer.md) with the USDT incompatibility diagnosis, `forceApprove` fix, and mainnet-fork testing recommendation.

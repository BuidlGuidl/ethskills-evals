# Executor transcript — 2026-09-12T015039Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-pr101-workspaces/2026-09-12T015039Z-codex-with-skill-1/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-pr101-workspaces/2026-09-12T015039Z-codex-with-skill-1/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a095c7-7922-7f31-a693-2f05a77774a3
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
I’m using the Foundry testing skill because this is specifically about why a green mock-based suite failed to predict mainnet behavior and what test would have caught it.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-pr101-workspaces/2026-09-12T015039Z-codex-with-skill-1/testing-quiz-003
 succeeded in 1ms:
codex
The key mismatch is confirmed: this is not a decimals or `transferFrom` issue. It is the ABI behavior of USDT’s `approve`, combined with calling that method directly instead of through `SafeERC20`. I’ll capture the robust allowance fix and the pinned-fork testing requirement.
apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015039Z-codex-with-skill-1/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..fa564a4a36ff0516847deec074a2e1802b12ba1c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20 implementation. Its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore makes the external call, receives empty return data, and then fails while decoding that data as a `bool`. This ABI-decoding failure commonly surfaces with no reason string.
+
+The OpenZeppelin mock cannot reproduce this behavior. A stock `ERC20` implements the modern interface and returns `true` from `approve`, so the same high-level call decodes successfully. Six decimals are irrelevant to this failure.
+
+The preceding transfer works precisely because it is written as:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success, while still requiring a decoded `bool` to be true when return data is present. That accommodates tokens such as USDT.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or rewrite ordinary `IERC20` calls. Thus `safeTransferFrom` uses the compatibility wrapper, but `approve` remains a direct high-level interface call and receives no protection from `SafeERC20`.
+
+## Code fix
+
+With a current OpenZeppelin version, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles optional/non-standard return data and also supports tokens such as USDT that may require an existing nonzero allowance to be set to zero before another nonzero allowance is assigned. It is more robust than merely replacing the call with a raw low-level call. On an older OpenZeppelin release without `forceApprove`, upgrade OpenZeppelin or implement the equivalent SafeERC20-style operation: try the requested approval, and if it fails, safely approve zero and then safely approve the requested amount.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a specific block. The test must exercise the deployed USDT contract and the real Aave V3 pool through the vault's actual deposit path, using an account funded with USDT and with the required approval to the vault. It should assert that the deposit succeeds and that the expected Aave position/accounting is created.
+
+The mock suite should remain for fast unit tests, but it cannot validate integration compatibility. A mock is an executable version of the assumptions used to write it. Here it assumes standards-compliant ERC-20 return data, while the real token violates that assumption. Adding more cases, fuzzing more amounts, or reaching 100% coverage against the same mock only repeats the same incorrect dependency model; none changes the mock's `approve` return-data shape. A pinned fork would execute the real bytecode and would have reproduced the empty-return decoding revert before deployment.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..fa564a4a36ff0516847deec074a2e1802b12ba1c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20 implementation. Its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore makes the external call, receives empty return data, and then fails while decoding that data as a `bool`. This ABI-decoding failure commonly surfaces with no reason string.
+
+The OpenZeppelin mock cannot reproduce this behavior. A stock `ERC20` implements the modern interface and returns `true` from `approve`, so the same high-level call decodes successfully. Six decimals are irrelevant to this failure.
+
+The preceding transfer works precisely because it is written as:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success, while still requiring a decoded `bool` to be true when return data is present. That accommodates tokens such as USDT.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or rewrite ordinary `IERC20` calls. Thus `safeTransferFrom` uses the compatibility wrapper, but `approve` remains a direct high-level interface call and receives no protection from `SafeERC20`.
+
+## Code fix
+
+With a current OpenZeppelin version, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles optional/non-standard return data and also supports tokens such as USDT that may require an existing nonzero allowance to be set to zero before another nonzero allowance is assigned. It is more robust than merely replacing the call with a raw low-level call. On an older OpenZeppelin release without `forceApprove`, upgrade OpenZeppelin or implement the equivalent SafeERC20-style operation: try the requested approval, and if it fails, safely approve zero and then safely approve the requested amount.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a specific block. The test must exercise the deployed USDT contract and the real Aave V3 pool through the vault's actual deposit path, using an account funded with USDT and with the required approval to the vault. It should assert that the deposit succeeds and that the expected Aave position/accounting is created.
+
+The mock suite should remain for fast unit tests, but it cannot validate integration compatibility. A mock is an executable version of the assumptions used to write it. Here it assumes standards-compliant ERC-20 return data, while the real token violates that assumption. Adding more cases, fuzzing more amounts, or reaching 100% coverage against the same mock only repeats the same incorrect dependency model; none changes the mock's `approve` return-data shape. A pinned fork would execute the real bytecode and would have reproduced the empty-return decoding revert before deployment.

exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /tmp/ethskills-pr101-workspaces/2026-09-12T015039Z-codex-with-skill-1/testing-quiz-003
 succeeded in 0ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..fa564a4a36ff0516847deec074a2e1802b12ba1c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20 implementation. Its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore makes the external call, receives empty return data, and then fails while decoding that data as a `bool`. This ABI-decoding failure commonly surfaces with no reason string.
+
+The OpenZeppelin mock cannot reproduce this behavior. A stock `ERC20` implements the modern interface and returns `true` from `approve`, so the same high-level call decodes successfully. Six decimals are irrelevant to this failure.
+
+The preceding transfer works precisely because it is written as:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success, while still requiring a decoded `bool` to be true when return data is present. That accommodates tokens such as USDT.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or rewrite ordinary `IERC20` calls. Thus `safeTransferFrom` uses the compatibility wrapper, but `approve` remains a direct high-level interface call and receives no protection from `SafeERC20`.
+
+## Code fix
+
+With a current OpenZeppelin version, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles optional/non-standard return data and also supports tokens such as USDT that may require an existing nonzero allowance to be set to zero before another nonzero allowance is assigned. It is more robust than merely replacing the call with a raw low-level call. On an older OpenZeppelin release without `forceApprove`, upgrade OpenZeppelin or implement the equivalent SafeERC20-style operation: try the requested approval, and if it fails, safely approve zero and then safely approve the requested amount.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a specific block. The test must exercise the deployed USDT contract and the real Aave V3 pool through the vault's actual deposit path, using an account funded with USDT and with the required approval to the vault. It should assert that the deposit succeeds and that the expected Aave position/accounting is created.
+
+The mock suite should remain for fast unit tests, but it cannot validate integration compatibility. A mock is an executable version of the assumptions used to write it. Here it assumes standards-compliant ERC-20 return data, while the real token violates that assumption. Adding more cases, fuzzing more amounts, or reaching 100% coverage against the same mock only repeats the same incorrect dependency model; none changes the mock's `approve` return-data shape. A pinned fork would execute the real bytecode and would have reproduced the empty-return decoding revert before deployment.

codex
Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015039Z-codex-with-skill-1/testing-quiz-003/answer.md) with the cause, `forceApprove` fix, and pinned mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..fa564a4a36ff0516847deec074a2e1802b12ba1c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20 implementation. Its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore makes the external call, receives empty return data, and then fails while decoding that data as a `bool`. This ABI-decoding failure commonly surfaces with no reason string.
+
+The OpenZeppelin mock cannot reproduce this behavior. A stock `ERC20` implements the modern interface and returns `true` from `approve`, so the same high-level call decodes successfully. Six decimals are irrelevant to this failure.
+
+The preceding transfer works precisely because it is written as:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success, while still requiring a decoded `bool` to be true when return data is present. That accommodates tokens such as USDT.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or rewrite ordinary `IERC20` calls. Thus `safeTransferFrom` uses the compatibility wrapper, but `approve` remains a direct high-level interface call and receives no protection from `SafeERC20`.
+
+## Code fix
+
+With a current OpenZeppelin version, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles optional/non-standard return data and also supports tokens such as USDT that may require an existing nonzero allowance to be set to zero before another nonzero allowance is assigned. It is more robust than merely replacing the call with a raw low-level call. On an older OpenZeppelin release without `forceApprove`, upgrade OpenZeppelin or implement the equivalent SafeERC20-style operation: try the requested approval, and if it fails, safely approve zero and then safely approve the requested amount.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a specific block. The test must exercise the deployed USDT contract and the real Aave V3 pool through the vault's actual deposit path, using an account funded with USDT and with the required approval to the vault. It should assert that the deposit succeeds and that the expected Aave position/accounting is created.
+
+The mock suite should remain for fast unit tests, but it cannot validate integration compatibility. A mock is an executable version of the assumptions used to write it. Here it assumes standards-compliant ERC-20 return data, while the real token violates that assumption. Adding more cases, fuzzing more amounts, or reaching 100% coverage against the same mock only repeats the same incorrect dependency model; none changes the mock's `approve` return-data shape. A pinned fork would execute the real bytecode and would have reproduced the empty-return decoding revert before deployment.

tokens used
9,368
````

## final message

Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015039Z-codex-with-skill-1/testing-quiz-003/answer.md) with the cause, `forceApprove` fix, and pinned mainnet-fork testing recommendation.

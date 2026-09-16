# Executor transcript — 2026-09-13T152607Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-testing-patched-20260913/2026-09-13T152607Z-codex-no-skill-3/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-testing-patched-20260913/2026-09-13T152607Z-codex-no-skill-3/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a09b73-a7a8-73c0-8ee2-57cc4bf1a124
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
I’ll trace the exact ABI mismatch and write the explanation and both fixes into `answer.md`, including the test setup needed to exercise USDT’s real behavior.
web search: 
web search: site:github.com/tethercoin/USDT TetherToken approve returns source code ...
codex
The failure is at the direct `approve`, not at Aave: mainnet USDT returns no ABI value, while `IERC20.approve` expects a `bool`. The safe wrapper handled that quirk for `safeTransferFrom`, but `using SafeERC20` does not automatically rewrite ordinary ERC-20 calls. I’m also accounting for USDT’s separate zero-first allowance rule in the recommended fix.
apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152607Z-codex-no-skill-3/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..80070bd746288956eccbdf3ef13346f96ba5fffe
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,45 @@
+# Root cause
+
+The call that fails is:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20 implementation. Its `approve` function does not return a value. OpenZeppelin's `IERC20.approve`, however, declares `returns (bool)`. A normal high-level call through that interface therefore expects ABI-encoded return data. USDT successfully executes its approval logic but returns zero bytes; Solidity cannot decode those zero bytes as a `bool`, so the caller reverts. This ABI-decoding failure commonly appears as an empty revert, which explains the missing reason string. Because the transaction reverts, the approval state change is rolled back as well.
+
+The first line works precisely because it is different:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+That invokes `SafeERC20.safeTransferFrom`. `SafeERC20` makes a low-level call and treats empty return data as success, while still requiring a decoded `bool` to be `true` when return data is present. It exists partly to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or alter calls to `transfer`, `transferFrom`, or `approve`. Thus `safeTransferFrom` is protected, but the plain `.approve(...)` call bypasses `SafeERC20` completely.
+
+There is a second USDT allowance quirk worth handling even though the empty-return ABI mismatch is what makes the shown first deposit fail: USDT rejects changing an existing nonzero allowance directly to another nonzero value. It requires setting the allowance to zero first.
+
+# Code fix
+
+With a current OpenZeppelin release, use `forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` both accepts tokens that return no value and performs the zero-then-set fallback required by USDT when necessary. It is preferable here to a plain `approve` (and to the deprecated `safeApprove`). If the project's pinned OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with OpenZeppelin's optional-return safe-call machinery: safely try the target allowance and, if needed, safely approve zero before safely approving the target value. Merely writing `approve(0); approve(amount);` as ordinary `IERC20` calls is not sufficient, because both calls still have the same empty-return ABI problem.
+
+# Why the tests stayed green
+
+The stock OpenZeppelin `MockERC20` is standard-compliant: its `approve` returns `true`, and its allowance behavior does not reproduce USDT's zero-first restriction. The mock therefore satisfies the exact assumption that is false in production. Running more cases, fuzzing more amounts, or increasing coverage against that same implementation cannot exercise behavior the mock does not implement. Six decimals are irrelevant to this failure; matching metadata is not the same as matching contract semantics.
+
+# Testing-practice fix
+
+Add integration tests on a pinned Ethereum mainnet fork using the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool/address-provider configuration. Fund or impersonate a USDT holder, approve the vault, execute the complete deposit path, and assert the resulting Aave position. Pinning the block makes the test reproducible. Include consecutive deposits or a deliberately pre-existing nonzero allowance so the test also covers USDT's zero-first rule.
+
+Fast unit tests can continue using `MockERC20`, but they should be supplemented with adversarial token doubles for known ERC-20 deviations (no return data, `false` return values, and zero-first approvals). The fork test is the decisive regression test here because it validates the production token and protocol behavior rather than a locally assumed substitute.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..80070bd746288956eccbdf3ef13346f96ba5fffe
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,45 @@
+# Root cause
+
+The call that fails is:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20 implementation. Its `approve` function does not return a value. OpenZeppelin's `IERC20.approve`, however, declares `returns (bool)`. A normal high-level call through that interface therefore expects ABI-encoded return data. USDT successfully executes its approval logic but returns zero bytes; Solidity cannot decode those zero bytes as a `bool`, so the caller reverts. This ABI-decoding failure commonly appears as an empty revert, which explains the missing reason string. Because the transaction reverts, the approval state change is rolled back as well.
+
+The first line works precisely because it is different:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+That invokes `SafeERC20.safeTransferFrom`. `SafeERC20` makes a low-level call and treats empty return data as success, while still requiring a decoded `bool` to be `true` when return data is present. It exists partly to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or alter calls to `transfer`, `transferFrom`, or `approve`. Thus `safeTransferFrom` is protected, but the plain `.approve(...)` call bypasses `SafeERC20` completely.
+
+There is a second USDT allowance quirk worth handling even though the empty-return ABI mismatch is what makes the shown first deposit fail: USDT rejects changing an existing nonzero allowance directly to another nonzero value. It requires setting the allowance to zero first.
+
+# Code fix
+
+With a current OpenZeppelin release, use `forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` both accepts tokens that return no value and performs the zero-then-set fallback required by USDT when necessary. It is preferable here to a plain `approve` (and to the deprecated `safeApprove`). If the project's pinned OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with OpenZeppelin's optional-return safe-call machinery: safely try the target allowance and, if needed, safely approve zero before safely approving the target value. Merely writing `approve(0); approve(amount);` as ordinary `IERC20` calls is not sufficient, because both calls still have the same empty-return ABI problem.
+
+# Why the tests stayed green
+
+The stock OpenZeppelin `MockERC20` is standard-compliant: its `approve` returns `true`, and its allowance behavior does not reproduce USDT's zero-first restriction. The mock therefore satisfies the exact assumption that is false in production. Running more cases, fuzzing more amounts, or increasing coverage against that same implementation cannot exercise behavior the mock does not implement. Six decimals are irrelevant to this failure; matching metadata is not the same as matching contract semantics.
+
+# Testing-practice fix
+
+Add integration tests on a pinned Ethereum mainnet fork using the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool/address-provider configuration. Fund or impersonate a USDT holder, approve the vault, execute the complete deposit path, and assert the resulting Aave position. Pinning the block makes the test reproducible. Include consecutive deposits or a deliberately pre-existing nonzero allowance so the test also covers USDT's zero-first rule.
+
+Fast unit tests can continue using `MockERC20`, but they should be supplemented with adversarial token doubles for known ERC-20 deviations (no return data, `false` return values, and zero-first approvals). The fork test is the decisive regression test here because it validates the production token and protocol behavior rather than a locally assumed substitute.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152607Z-codex-no-skill-3/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Root cause

The call that fails is:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is an old, non-standard ERC-20 implementation. Its `approve` function does not return a value. OpenZeppelin's `IERC20.approve`, however, declares `returns (bool)`. A normal high-level call through that interface therefore expects ABI-encoded return data. USDT successfully executes its approval logic but returns zero bytes; Solidity cannot decode those zero bytes as a `bool`, so the caller reverts. This ABI-decoding failure commonly appears as an empty revert, which explains the missing reason string. Because the transaction reverts, the approval state change is rolled back as well.

The first line works precisely because it is different:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

That invokes `SafeERC20.safeTransferFrom`. `SafeERC20` makes a low-level call and treats empty return data as success, while still requiring a decoded `bool` to be `true` when return data is present. It exists partly to support tokens such as USDT.

`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or alter calls to `transfer`, `transferFrom`, or `approve`. Thus `safeTransferFrom` is protected, but the plain `.approve(...)` call bypasses `SafeERC20` completely.

There is a second USDT allowance quirk worth handling even though the empty-return ABI mismatch is what makes the shown first deposit fail: USDT rejects changing an existing nonzero allowance directly to another nonzero value. It requires setting the allowance to zero first.

# Code fix

With a current OpenZeppelin release, use `forceApprove`:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` both accepts tokens that return no value and performs the zero-then-set fallback required by USDT when necessary. It is preferable here to a plain `approve` (and to the deprecated `safeApprove`). If the project's pinned OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with OpenZeppelin's optional-return safe-call machinery: safely try the target allowance and, if needed, safely approve zero before safely approving the target value. Merely writing `approve(0); approve(amount);` as ordinary `IERC20` calls is not sufficient, because both calls still have the same empty-return ABI problem.

# Why the tests stayed green

The stock OpenZeppelin `MockERC20` is standard-compliant: its `approve` returns `true`, and its allowance behavior does not reproduce USDT's zero-first restriction. The mock therefore satisfies the exact assumption that is false in production. Running more cases, fuzzing more amounts, or increasing coverage against that same implementation cannot exercise behavior the mock does not implement. Six decimals are irrelevant to this failure; matching metadata is not the same as matching contract semantics.

# Testing-practice fix

Add integration tests on a pinned Ethereum mainnet fork using the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool/address-provider configuration. Fund or impersonate a USDT holder, approve the vault, execute the complete deposit path, and assert the resulting Aave position. Pinning the block makes the test reproducible. Include consecutive deposits or a deliberately pre-existing nonzero allowance so the test also covers USDT's zero-first rule.

Fast unit tests can continue using `MockERC20`, but they should be supplemented with adversarial token doubles for known ERC-20 deviations (no return data, `false` return values, and zero-first approvals). The fork test is the decisive regression test here because it validates the production token and protocol behavior rather than a locally assumed substitute.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..80070bd746288956eccbdf3ef13346f96ba5fffe
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,45 @@
+# Root cause
+
+The call that fails is:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20 implementation. Its `approve` function does not return a value. OpenZeppelin's `IERC20.approve`, however, declares `returns (bool)`. A normal high-level call through that interface therefore expects ABI-encoded return data. USDT successfully executes its approval logic but returns zero bytes; Solidity cannot decode those zero bytes as a `bool`, so the caller reverts. This ABI-decoding failure commonly appears as an empty revert, which explains the missing reason string. Because the transaction reverts, the approval state change is rolled back as well.
+
+The first line works precisely because it is different:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+That invokes `SafeERC20.safeTransferFrom`. `SafeERC20` makes a low-level call and treats empty return data as success, while still requiring a decoded `bool` to be `true` when return data is present. It exists partly to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or alter calls to `transfer`, `transferFrom`, or `approve`. Thus `safeTransferFrom` is protected, but the plain `.approve(...)` call bypasses `SafeERC20` completely.
+
+There is a second USDT allowance quirk worth handling even though the empty-return ABI mismatch is what makes the shown first deposit fail: USDT rejects changing an existing nonzero allowance directly to another nonzero value. It requires setting the allowance to zero first.
+
+# Code fix
+
+With a current OpenZeppelin release, use `forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` both accepts tokens that return no value and performs the zero-then-set fallback required by USDT when necessary. It is preferable here to a plain `approve` (and to the deprecated `safeApprove`). If the project's pinned OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with OpenZeppelin's optional-return safe-call machinery: safely try the target allowance and, if needed, safely approve zero before safely approving the target value. Merely writing `approve(0); approve(amount);` as ordinary `IERC20` calls is not sufficient, because both calls still have the same empty-return ABI problem.
+
+# Why the tests stayed green
+
+The stock OpenZeppelin `MockERC20` is standard-compliant: its `approve` returns `true`, and its allowance behavior does not reproduce USDT's zero-first restriction. The mock therefore satisfies the exact assumption that is false in production. Running more cases, fuzzing more amounts, or increasing coverage against that same implementation cannot exercise behavior the mock does not implement. Six decimals are irrelevant to this failure; matching metadata is not the same as matching contract semantics.
+
+# Testing-practice fix
+
+Add integration tests on a pinned Ethereum mainnet fork using the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool/address-provider configuration. Fund or impersonate a USDT holder, approve the vault, execute the complete deposit path, and assert the resulting Aave position. Pinning the block makes the test reproducible. Include consecutive deposits or a deliberately pre-existing nonzero allowance so the test also covers USDT's zero-first rule.
+
+Fast unit tests can continue using `MockERC20`, but they should be supplemented with adversarial token doubles for known ERC-20 deviations (no return data, `false` return values, and zero-first approvals). The fork test is the decisive regression test here because it validates the production token and protocol behavior rather than a locally assumed substitute.

codex
Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152607Z-codex-no-skill-3/testing-quiz-003/answer.md) with the root cause, `forceApprove` fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..80070bd746288956eccbdf3ef13346f96ba5fffe
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,45 @@
+# Root cause
+
+The call that fails is:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is an old, non-standard ERC-20 implementation. Its `approve` function does not return a value. OpenZeppelin's `IERC20.approve`, however, declares `returns (bool)`. A normal high-level call through that interface therefore expects ABI-encoded return data. USDT successfully executes its approval logic but returns zero bytes; Solidity cannot decode those zero bytes as a `bool`, so the caller reverts. This ABI-decoding failure commonly appears as an empty revert, which explains the missing reason string. Because the transaction reverts, the approval state change is rolled back as well.
+
+The first line works precisely because it is different:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+That invokes `SafeERC20.safeTransferFrom`. `SafeERC20` makes a low-level call and treats empty return data as success, while still requiring a decoded `bool` to be `true` when return data is present. It exists partly to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or alter calls to `transfer`, `transferFrom`, or `approve`. Thus `safeTransferFrom` is protected, but the plain `.approve(...)` call bypasses `SafeERC20` completely.
+
+There is a second USDT allowance quirk worth handling even though the empty-return ABI mismatch is what makes the shown first deposit fail: USDT rejects changing an existing nonzero allowance directly to another nonzero value. It requires setting the allowance to zero first.
+
+# Code fix
+
+With a current OpenZeppelin release, use `forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` both accepts tokens that return no value and performs the zero-then-set fallback required by USDT when necessary. It is preferable here to a plain `approve` (and to the deprecated `safeApprove`). If the project's pinned OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with OpenZeppelin's optional-return safe-call machinery: safely try the target allowance and, if needed, safely approve zero before safely approving the target value. Merely writing `approve(0); approve(amount);` as ordinary `IERC20` calls is not sufficient, because both calls still have the same empty-return ABI problem.
+
+# Why the tests stayed green
+
+The stock OpenZeppelin `MockERC20` is standard-compliant: its `approve` returns `true`, and its allowance behavior does not reproduce USDT's zero-first restriction. The mock therefore satisfies the exact assumption that is false in production. Running more cases, fuzzing more amounts, or increasing coverage against that same implementation cannot exercise behavior the mock does not implement. Six decimals are irrelevant to this failure; matching metadata is not the same as matching contract semantics.
+
+# Testing-practice fix
+
+Add integration tests on a pinned Ethereum mainnet fork using the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool/address-provider configuration. Fund or impersonate a USDT holder, approve the vault, execute the complete deposit path, and assert the resulting Aave position. Pinning the block makes the test reproducible. Include consecutive deposits or a deliberately pre-existing nonzero allowance so the test also covers USDT's zero-first rule.
+
+Fast unit tests can continue using `MockERC20`, but they should be supplemented with adversarial token doubles for known ERC-20 deviations (no return data, `false` return values, and zero-first approvals). The fork test is the decisive regression test here because it validates the production token and protocol behavior rather than a locally assumed substitute.

tokens used
14,963
````

## final message

Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152607Z-codex-no-skill-3/testing-quiz-003/answer.md) with the root cause, `forceApprove` fix, and mainnet-fork testing recommendation.

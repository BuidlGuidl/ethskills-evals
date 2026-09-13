# Executor transcript — 2026-09-13T152608Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-testing-patched-20260913/2026-09-13T152608Z-codex-with-skill-2/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-testing-patched-20260913/2026-09-13T152608Z-codex-with-skill-2/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a09b73-a751-7f92-a56a-17febafed76c
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
I’ll inspect the repository and the testing guidance, then write the diagnosis and both fixes directly to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md && rg -n \"safeTransferFrom|approve\\(|aavePool|MockAave|USDT\" . --glob '"'!answer.md'"'" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152608Z-codex-with-skill-2/testing-quiz-003
 succeeded in 6ms:
./TASK.md:2:underlying and a MockAavePool for the pool — 39 tests, all green, and they have been
./TASK.md:5:We deployed to mainnet with USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) as the
./TASK.md:9:    usdt.safeTransferFrom(msg.sender, address(this), amount);
./TASK.md:10:    usdt.approve(address(aavePool), amount);
./TASK.md:11:    aavePool.supply(address(usdt), amount, address(this), 0);
./TASK.md:19:Explain why this reverts against the real deployed USDT but never against the mock,

codex
The key distinction is call-site syntax: attaching `SafeERC20` to the type does not rewrite ordinary ERC-20 calls. I’m verifying the exact USDT behavior so the answer separates its missing-return quirk from its allowance-reset rule correctly.
web search: 
web search: https://etherscan.io/address/0xdAC17F958D2ee523a2206206994597C13D831ec7#code
web search: 
web search: USDT mainnet TetherToken Solidity source approve returns bool transferFrom no return
apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152608Z-codex-with-skill-2/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1ff6578f4c2b9589d97e8d1c86b0dd77c5d9119e
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,33 @@
+# Why the USDT deposit reverts
+
+The failing call is the raw `approve`, not `safeTransferFrom`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Ethereum mainnet USDT predates the ERC-20 behavior assumed by OpenZeppelin's `IERC20`. Its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. The token can execute the approval, but the caller then tries to decode empty return data as a `bool`. That ABI decode fails and reverts without a token-provided reason string. The revert rolls back the whole transaction, including the approval and the preceding transfer, so `aavePool.supply` is never reached.
+
+The mock cannot reproduce this. A stock OpenZeppelin `ERC20` implements `approve` with the standard `returns (bool)` ABI and returns `true`, so the same high-level call decodes successfully. Matching USDT's six decimals only matches denomination; it says nothing about call/return behavior. The real token also has the well-known rule that a nonzero allowance must generally be reset to zero before it is changed to another nonzero value, another behavior a stock OpenZeppelin mock does not model.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or replace every method on `IERC20`. Thus `safeTransferFrom(...)` uses `SafeERC20`'s low-level-call logic, which accepts either `true` or no return data, and succeeds with USDT. `approve(...)` is still the ordinary interface call and receives none of that protection.
+
+## Code fix
+
+Use the SafeERC20 allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the appropriate OpenZeppelin helper for USDT-like tokens: it tolerates optional return data and, when necessary, performs the zero-then-value allowance update. With an older OpenZeppelin release that lacks `forceApprove`, upgrade it or implement the equivalent through SafeERC20-style optional-return calls; merely changing the line to another raw `approve` is not sufficient.
+
+An alternative design is to establish a maximum allowance once (also via `forceApprove`) and let Aave consume from it, subject to the protocol's allowance-risk policy. Per-deposit `forceApprove` is the direct correction to the shown code.
+
+## Testing-practice fix
+
+Add a pinned Ethereum-mainnet fork integration test using the actual USDT address and the actual Aave V3 pool, fund a test actor with USDT on the fork, approve the vault, and execute a real deposit. Assert the resulting Aave position/vault accounting, not merely that the call did not revert. Pinning the block makes the dependency state reproducible, and the RPC endpoint must support historical state at that block.
+
+No number of tests against these two mocks could discover this mismatch: a mock is executable documentation of the assumptions encoded by its author. Here both mocks implement the standard behavior the production dependencies were assumed to have, while the defect exists specifically in behavior omitted from the mocks. A purpose-built non-returning/zero-first token mock would be a useful regression test after discovery, but it still would not replace the pre-deployment pinned-fork test for an external protocol and a quirky deployed token.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1ff6578f4c2b9589d97e8d1c86b0dd77c5d9119e
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,33 @@
+# Why the USDT deposit reverts
+
+The failing call is the raw `approve`, not `safeTransferFrom`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Ethereum mainnet USDT predates the ERC-20 behavior assumed by OpenZeppelin's `IERC20`. Its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. The token can execute the approval, but the caller then tries to decode empty return data as a `bool`. That ABI decode fails and reverts without a token-provided reason string. The revert rolls back the whole transaction, including the approval and the preceding transfer, so `aavePool.supply` is never reached.
+
+The mock cannot reproduce this. A stock OpenZeppelin `ERC20` implements `approve` with the standard `returns (bool)` ABI and returns `true`, so the same high-level call decodes successfully. Matching USDT's six decimals only matches denomination; it says nothing about call/return behavior. The real token also has the well-known rule that a nonzero allowance must generally be reset to zero before it is changed to another nonzero value, another behavior a stock OpenZeppelin mock does not model.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or replace every method on `IERC20`. Thus `safeTransferFrom(...)` uses `SafeERC20`'s low-level-call logic, which accepts either `true` or no return data, and succeeds with USDT. `approve(...)` is still the ordinary interface call and receives none of that protection.
+
+## Code fix
+
+Use the SafeERC20 allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the appropriate OpenZeppelin helper for USDT-like tokens: it tolerates optional return data and, when necessary, performs the zero-then-value allowance update. With an older OpenZeppelin release that lacks `forceApprove`, upgrade it or implement the equivalent through SafeERC20-style optional-return calls; merely changing the line to another raw `approve` is not sufficient.
+
+An alternative design is to establish a maximum allowance once (also via `forceApprove`) and let Aave consume from it, subject to the protocol's allowance-risk policy. Per-deposit `forceApprove` is the direct correction to the shown code.
+
+## Testing-practice fix
+
+Add a pinned Ethereum-mainnet fork integration test using the actual USDT address and the actual Aave V3 pool, fund a test actor with USDT on the fork, approve the vault, and execute a real deposit. Assert the resulting Aave position/vault accounting, not merely that the call did not revert. Pinning the block makes the dependency state reproducible, and the RPC endpoint must support historical state at that block.
+
+No number of tests against these two mocks could discover this mismatch: a mock is executable documentation of the assumptions encoded by its author. Here both mocks implement the standard behavior the production dependencies were assumed to have, while the defect exists specifically in behavior omitted from the mocks. A purpose-built non-returning/zero-first token mock would be a useful regression test after discovery, but it still would not replace the pre-deployment pinned-fork test for an external protocol and a quirky deployed token.

exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152608Z-codex-with-skill-2/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Why the USDT deposit reverts

The failing call is the raw `approve`, not `safeTransferFrom`:

```solidity
usdt.approve(address(aavePool), amount);
```

Ethereum mainnet USDT predates the ERC-20 behavior assumed by OpenZeppelin's `IERC20`. Its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. The token can execute the approval, but the caller then tries to decode empty return data as a `bool`. That ABI decode fails and reverts without a token-provided reason string. The revert rolls back the whole transaction, including the approval and the preceding transfer, so `aavePool.supply` is never reached.

The mock cannot reproduce this. A stock OpenZeppelin `ERC20` implements `approve` with the standard `returns (bool)` ABI and returns `true`, so the same high-level call decodes successfully. Matching USDT's six decimals only matches denomination; it says nothing about call/return behavior. The real token also has the well-known rule that a nonzero allowance must generally be reset to zero before it is changed to another nonzero value, another behavior a stock OpenZeppelin mock does not model.

`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or replace every method on `IERC20`. Thus `safeTransferFrom(...)` uses `SafeERC20`'s low-level-call logic, which accepts either `true` or no return data, and succeeds with USDT. `approve(...)` is still the ordinary interface call and receives none of that protection.

## Code fix

Use the SafeERC20 allowance operation as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the appropriate OpenZeppelin helper for USDT-like tokens: it tolerates optional return data and, when necessary, performs the zero-then-value allowance update. With an older OpenZeppelin release that lacks `forceApprove`, upgrade it or implement the equivalent through SafeERC20-style optional-return calls; merely changing the line to another raw `approve` is not sufficient.

An alternative design is to establish a maximum allowance once (also via `forceApprove`) and let Aave consume from it, subject to the protocol's allowance-risk policy. Per-deposit `forceApprove` is the direct correction to the shown code.

## Testing-practice fix

Add a pinned Ethereum-mainnet fork integration test using the actual USDT address and the actual Aave V3 pool, fund a test actor with USDT on the fork, approve the vault, and execute a real deposit. Assert the resulting Aave position/vault accounting, not merely that the call did not revert. Pinning the block makes the dependency state reproducible, and the RPC endpoint must support historical state at that block.

No number of tests against these two mocks could discover this mismatch: a mock is executable documentation of the assumptions encoded by its author. Here both mocks implement the standard behavior the production dependencies were assumed to have, while the defect exists specifically in behavior omitted from the mocks. A purpose-built non-returning/zero-first token mock would be a useful regression test after discovery, but it still would not replace the pre-deployment pinned-fork test for an external protocol and a quirky deployed token.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1ff6578f4c2b9589d97e8d1c86b0dd77c5d9119e
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,33 @@
+# Why the USDT deposit reverts
+
+The failing call is the raw `approve`, not `safeTransferFrom`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Ethereum mainnet USDT predates the ERC-20 behavior assumed by OpenZeppelin's `IERC20`. Its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. The token can execute the approval, but the caller then tries to decode empty return data as a `bool`. That ABI decode fails and reverts without a token-provided reason string. The revert rolls back the whole transaction, including the approval and the preceding transfer, so `aavePool.supply` is never reached.
+
+The mock cannot reproduce this. A stock OpenZeppelin `ERC20` implements `approve` with the standard `returns (bool)` ABI and returns `true`, so the same high-level call decodes successfully. Matching USDT's six decimals only matches denomination; it says nothing about call/return behavior. The real token also has the well-known rule that a nonzero allowance must generally be reset to zero before it is changed to another nonzero value, another behavior a stock OpenZeppelin mock does not model.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or replace every method on `IERC20`. Thus `safeTransferFrom(...)` uses `SafeERC20`'s low-level-call logic, which accepts either `true` or no return data, and succeeds with USDT. `approve(...)` is still the ordinary interface call and receives none of that protection.
+
+## Code fix
+
+Use the SafeERC20 allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the appropriate OpenZeppelin helper for USDT-like tokens: it tolerates optional return data and, when necessary, performs the zero-then-value allowance update. With an older OpenZeppelin release that lacks `forceApprove`, upgrade it or implement the equivalent through SafeERC20-style optional-return calls; merely changing the line to another raw `approve` is not sufficient.
+
+An alternative design is to establish a maximum allowance once (also via `forceApprove`) and let Aave consume from it, subject to the protocol's allowance-risk policy. Per-deposit `forceApprove` is the direct correction to the shown code.
+
+## Testing-practice fix
+
+Add a pinned Ethereum-mainnet fork integration test using the actual USDT address and the actual Aave V3 pool, fund a test actor with USDT on the fork, approve the vault, and execute a real deposit. Assert the resulting Aave position/vault accounting, not merely that the call did not revert. Pinning the block makes the dependency state reproducible, and the RPC endpoint must support historical state at that block.
+
+No number of tests against these two mocks could discover this mismatch: a mock is executable documentation of the assumptions encoded by its author. Here both mocks implement the standard behavior the production dependencies were assumed to have, while the defect exists specifically in behavior omitted from the mocks. A purpose-built non-returning/zero-first token mock would be a useful regression test after discovery, but it still would not replace the pre-deployment pinned-fork test for an external protocol and a quirky deployed token.

codex
Wrote the complete explanation and fixes to [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152608Z-codex-with-skill-2/testing-quiz-003/answer.md).
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1ff6578f4c2b9589d97e8d1c86b0dd77c5d9119e
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,33 @@
+# Why the USDT deposit reverts
+
+The failing call is the raw `approve`, not `safeTransferFrom`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Ethereum mainnet USDT predates the ERC-20 behavior assumed by OpenZeppelin's `IERC20`. Its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. The token can execute the approval, but the caller then tries to decode empty return data as a `bool`. That ABI decode fails and reverts without a token-provided reason string. The revert rolls back the whole transaction, including the approval and the preceding transfer, so `aavePool.supply` is never reached.
+
+The mock cannot reproduce this. A stock OpenZeppelin `ERC20` implements `approve` with the standard `returns (bool)` ABI and returns `true`, so the same high-level call decodes successfully. Matching USDT's six decimals only matches denomination; it says nothing about call/return behavior. The real token also has the well-known rule that a nonzero allowance must generally be reset to zero before it is changed to another nonzero value, another behavior a stock OpenZeppelin mock does not model.
+
+`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or replace every method on `IERC20`. Thus `safeTransferFrom(...)` uses `SafeERC20`'s low-level-call logic, which accepts either `true` or no return data, and succeeds with USDT. `approve(...)` is still the ordinary interface call and receives none of that protection.
+
+## Code fix
+
+Use the SafeERC20 allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the appropriate OpenZeppelin helper for USDT-like tokens: it tolerates optional return data and, when necessary, performs the zero-then-value allowance update. With an older OpenZeppelin release that lacks `forceApprove`, upgrade it or implement the equivalent through SafeERC20-style optional-return calls; merely changing the line to another raw `approve` is not sufficient.
+
+An alternative design is to establish a maximum allowance once (also via `forceApprove`) and let Aave consume from it, subject to the protocol's allowance-risk policy. Per-deposit `forceApprove` is the direct correction to the shown code.
+
+## Testing-practice fix
+
+Add a pinned Ethereum-mainnet fork integration test using the actual USDT address and the actual Aave V3 pool, fund a test actor with USDT on the fork, approve the vault, and execute a real deposit. Assert the resulting Aave position/vault accounting, not merely that the call did not revert. Pinning the block makes the dependency state reproducible, and the RPC endpoint must support historical state at that block.
+
+No number of tests against these two mocks could discover this mismatch: a mock is executable documentation of the assumptions encoded by its author. Here both mocks implement the standard behavior the production dependencies were assumed to have, while the defect exists specifically in behavior omitted from the mocks. A purpose-built non-returning/zero-first token mock would be a useful regression test after discovery, but it still would not replace the pre-deployment pinned-fork test for an external protocol and a quirky deployed token.

tokens used
16,970
````

## final message

Wrote the complete explanation and fixes to [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152608Z-codex-with-skill-2/testing-quiz-003/answer.md).

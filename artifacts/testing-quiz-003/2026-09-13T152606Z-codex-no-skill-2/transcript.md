# Executor transcript — 2026-09-13T152606Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-testing-patched-20260913/2026-09-13T152606Z-codex-no-skill-2/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-testing-patched-20260913/2026-09-13T152606Z-codex-no-skill-2/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a09b73-a73e-74a1-b40f-f8ef4e9cd4b7
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
I’ll write the diagnosis and both fixes directly into `answer.md`, including the distinct return-data behavior of `safeTransferFrom` versus a raw `approve` call.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!lib'"' -g '"'!out'"' . .. 2>/dev/null | head -50" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152606Z-codex-no-skill-2/testing-quiz-003
 succeeded in 6ms:
apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152606Z-codex-no-skill-2/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4e19dcffd53ef81b5be8496a6f10bf384e9c8258
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The failing operation is the raw `approve`, not Aave's `supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 convention and its `approve` function does not return a `bool`. Because `usdt` is statically typed as OpenZeppelin's `IERC20`, Solidity generates a normal high-level call that expects and ABI-decodes a `bool`. USDT successfully executes the approval but returns empty data; the caller then fails while decoding that empty return data. This ABI-decoding failure commonly arrives as an empty revert, which explains the absence of a reason string. `supply` is never reached.
+
+The preceding transfer works because it is actually routed through `SafeERC20`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` makes a low-level call and treats either empty return data or an encoded `true` as success. That behavior exists specifically for non-standard tokens such as USDT. Merely declaring `using SafeERC20 for IERC20` does not wrap ordinary interface calls automatically. The expression `usdt.approve(...)` selects `IERC20.approve`, so none of `SafeERC20`'s optional-return handling protects it.
+
+The OpenZeppelin mock cannot expose this incompatibility. A stock `ERC20` implements the interface conventionally and returns `true` from `approve`, so every test—regardless of how many cases are added—continues exercising the same ABI behavior. Matching decimals is irrelevant; the incompatibility is in return data and, for allowance updates, USDT's approval rules. More coverage over an inaccurate substitute does not create fidelity to the deployed dependency.
+
+## Code fix
+
+Use `SafeERC20` for the approval too. With a current OpenZeppelin release, `forceApprove` is the robust choice:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return-safe calls and also handles tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This requires an OpenZeppelin version that provides `forceApprove`; otherwise implement the same safe zero-then-set sequence using low-level optional-return handling, or upgrade OpenZeppelin. A direct `approve`, even if its returned value is ignored in source code, is not a fix because Solidity still decodes the declared return value.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test using the real USDT address and the real Aave V3 pool, at a pinned block. Fund or impersonate an account with USDT, approve the vault, deposit, and assert that Aave received the supply/aToken position. That test exercises the deployed token bytecode, its empty return data, its allowance behavior, and the actual pool interaction.
+
+Keep fast unit tests, but supplement them with compatibility/adversarial token doubles that model known ERC-20 deviations—for example, a token whose `approve` and transfers return no data and a token requiring zero-before-nonzero approval. The fork test is the decisive regression test here; a stock OpenZeppelin `MockERC20` alone is not an adequate stand-in for USDT.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4e19dcffd53ef81b5be8496a6f10bf384e9c8258
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The failing operation is the raw `approve`, not Aave's `supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 convention and its `approve` function does not return a `bool`. Because `usdt` is statically typed as OpenZeppelin's `IERC20`, Solidity generates a normal high-level call that expects and ABI-decodes a `bool`. USDT successfully executes the approval but returns empty data; the caller then fails while decoding that empty return data. This ABI-decoding failure commonly arrives as an empty revert, which explains the absence of a reason string. `supply` is never reached.
+
+The preceding transfer works because it is actually routed through `SafeERC20`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` makes a low-level call and treats either empty return data or an encoded `true` as success. That behavior exists specifically for non-standard tokens such as USDT. Merely declaring `using SafeERC20 for IERC20` does not wrap ordinary interface calls automatically. The expression `usdt.approve(...)` selects `IERC20.approve`, so none of `SafeERC20`'s optional-return handling protects it.
+
+The OpenZeppelin mock cannot expose this incompatibility. A stock `ERC20` implements the interface conventionally and returns `true` from `approve`, so every test—regardless of how many cases are added—continues exercising the same ABI behavior. Matching decimals is irrelevant; the incompatibility is in return data and, for allowance updates, USDT's approval rules. More coverage over an inaccurate substitute does not create fidelity to the deployed dependency.
+
+## Code fix
+
+Use `SafeERC20` for the approval too. With a current OpenZeppelin release, `forceApprove` is the robust choice:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return-safe calls and also handles tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This requires an OpenZeppelin version that provides `forceApprove`; otherwise implement the same safe zero-then-set sequence using low-level optional-return handling, or upgrade OpenZeppelin. A direct `approve`, even if its returned value is ignored in source code, is not a fix because Solidity still decodes the declared return value.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test using the real USDT address and the real Aave V3 pool, at a pinned block. Fund or impersonate an account with USDT, approve the vault, deposit, and assert that Aave received the supply/aToken position. That test exercises the deployed token bytecode, its empty return data, its allowance behavior, and the actual pool interaction.
+
+Keep fast unit tests, but supplement them with compatibility/adversarial token doubles that model known ERC-20 deviations—for example, a token whose `approve` and transfers return no data and a token requiring zero-before-nonzero approval. The fork test is the decisive regression test here; a stock OpenZeppelin `MockERC20` alone is not an adequate stand-in for USDT.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152606Z-codex-no-skill-2/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Why the USDT deposit reverts

The failing operation is the raw `approve`, not Aave's `supply`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT predates the modern ERC-20 convention and its `approve` function does not return a `bool`. Because `usdt` is statically typed as OpenZeppelin's `IERC20`, Solidity generates a normal high-level call that expects and ABI-decodes a `bool`. USDT successfully executes the approval but returns empty data; the caller then fails while decoding that empty return data. This ABI-decoding failure commonly arrives as an empty revert, which explains the absence of a reason string. `supply` is never reached.

The preceding transfer works because it is actually routed through `SafeERC20`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` makes a low-level call and treats either empty return data or an encoded `true` as success. That behavior exists specifically for non-standard tokens such as USDT. Merely declaring `using SafeERC20 for IERC20` does not wrap ordinary interface calls automatically. The expression `usdt.approve(...)` selects `IERC20.approve`, so none of `SafeERC20`'s optional-return handling protects it.

The OpenZeppelin mock cannot expose this incompatibility. A stock `ERC20` implements the interface conventionally and returns `true` from `approve`, so every test—regardless of how many cases are added—continues exercising the same ABI behavior. Matching decimals is irrelevant; the incompatibility is in return data and, for allowance updates, USDT's approval rules. More coverage over an inaccurate substitute does not create fidelity to the deployed dependency.

## Code fix

Use `SafeERC20` for the approval too. With a current OpenZeppelin release, `forceApprove` is the robust choice:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` uses optional-return-safe calls and also handles tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This requires an OpenZeppelin version that provides `forceApprove`; otherwise implement the same safe zero-then-set sequence using low-level optional-return handling, or upgrade OpenZeppelin. A direct `approve`, even if its returned value is ignored in source code, is not a fix because Solidity still decodes the declared return value.

## Testing-practice fix

Add a mainnet-fork integration test using the real USDT address and the real Aave V3 pool, at a pinned block. Fund or impersonate an account with USDT, approve the vault, deposit, and assert that Aave received the supply/aToken position. That test exercises the deployed token bytecode, its empty return data, its allowance behavior, and the actual pool interaction.

Keep fast unit tests, but supplement them with compatibility/adversarial token doubles that model known ERC-20 deviations—for example, a token whose `approve` and transfers return no data and a token requiring zero-before-nonzero approval. The fork test is the decisive regression test here; a stock OpenZeppelin `MockERC20` alone is not an adequate stand-in for USDT.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4e19dcffd53ef81b5be8496a6f10bf384e9c8258
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The failing operation is the raw `approve`, not Aave's `supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 convention and its `approve` function does not return a `bool`. Because `usdt` is statically typed as OpenZeppelin's `IERC20`, Solidity generates a normal high-level call that expects and ABI-decodes a `bool`. USDT successfully executes the approval but returns empty data; the caller then fails while decoding that empty return data. This ABI-decoding failure commonly arrives as an empty revert, which explains the absence of a reason string. `supply` is never reached.
+
+The preceding transfer works because it is actually routed through `SafeERC20`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` makes a low-level call and treats either empty return data or an encoded `true` as success. That behavior exists specifically for non-standard tokens such as USDT. Merely declaring `using SafeERC20 for IERC20` does not wrap ordinary interface calls automatically. The expression `usdt.approve(...)` selects `IERC20.approve`, so none of `SafeERC20`'s optional-return handling protects it.
+
+The OpenZeppelin mock cannot expose this incompatibility. A stock `ERC20` implements the interface conventionally and returns `true` from `approve`, so every test—regardless of how many cases are added—continues exercising the same ABI behavior. Matching decimals is irrelevant; the incompatibility is in return data and, for allowance updates, USDT's approval rules. More coverage over an inaccurate substitute does not create fidelity to the deployed dependency.
+
+## Code fix
+
+Use `SafeERC20` for the approval too. With a current OpenZeppelin release, `forceApprove` is the robust choice:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return-safe calls and also handles tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This requires an OpenZeppelin version that provides `forceApprove`; otherwise implement the same safe zero-then-set sequence using low-level optional-return handling, or upgrade OpenZeppelin. A direct `approve`, even if its returned value is ignored in source code, is not a fix because Solidity still decodes the declared return value.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test using the real USDT address and the real Aave V3 pool, at a pinned block. Fund or impersonate an account with USDT, approve the vault, deposit, and assert that Aave received the supply/aToken position. That test exercises the deployed token bytecode, its empty return data, its allowance behavior, and the actual pool interaction.
+
+Keep fast unit tests, but supplement them with compatibility/adversarial token doubles that model known ERC-20 deviations—for example, a token whose `approve` and transfers return no data and a token requiring zero-before-nonzero approval. The fork test is the decisive regression test here; a stock OpenZeppelin `MockERC20` alone is not an adequate stand-in for USDT.

codex
Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152606Z-codex-no-skill-2/testing-quiz-003/answer.md) with the diagnosis, `forceApprove` code fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4e19dcffd53ef81b5be8496a6f10bf384e9c8258
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The failing operation is the raw `approve`, not Aave's `supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 convention and its `approve` function does not return a `bool`. Because `usdt` is statically typed as OpenZeppelin's `IERC20`, Solidity generates a normal high-level call that expects and ABI-decodes a `bool`. USDT successfully executes the approval but returns empty data; the caller then fails while decoding that empty return data. This ABI-decoding failure commonly arrives as an empty revert, which explains the absence of a reason string. `supply` is never reached.
+
+The preceding transfer works because it is actually routed through `SafeERC20`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` makes a low-level call and treats either empty return data or an encoded `true` as success. That behavior exists specifically for non-standard tokens such as USDT. Merely declaring `using SafeERC20 for IERC20` does not wrap ordinary interface calls automatically. The expression `usdt.approve(...)` selects `IERC20.approve`, so none of `SafeERC20`'s optional-return handling protects it.
+
+The OpenZeppelin mock cannot expose this incompatibility. A stock `ERC20` implements the interface conventionally and returns `true` from `approve`, so every test—regardless of how many cases are added—continues exercising the same ABI behavior. Matching decimals is irrelevant; the incompatibility is in return data and, for allowance updates, USDT's approval rules. More coverage over an inaccurate substitute does not create fidelity to the deployed dependency.
+
+## Code fix
+
+Use `SafeERC20` for the approval too. With a current OpenZeppelin release, `forceApprove` is the robust choice:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return-safe calls and also handles tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This requires an OpenZeppelin version that provides `forceApprove`; otherwise implement the same safe zero-then-set sequence using low-level optional-return handling, or upgrade OpenZeppelin. A direct `approve`, even if its returned value is ignored in source code, is not a fix because Solidity still decodes the declared return value.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test using the real USDT address and the real Aave V3 pool, at a pinned block. Fund or impersonate an account with USDT, approve the vault, deposit, and assert that Aave received the supply/aToken position. That test exercises the deployed token bytecode, its empty return data, its allowance behavior, and the actual pool interaction.
+
+Keep fast unit tests, but supplement them with compatibility/adversarial token doubles that model known ERC-20 deviations—for example, a token whose `approve` and transfers return no data and a token requiring zero-before-nonzero approval. The fork test is the decisive regression test here; a stock OpenZeppelin `MockERC20` alone is not an adequate stand-in for USDT.

tokens used
8,542
````

## final message

Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152606Z-codex-no-skill-2/testing-quiz-003/answer.md) with the diagnosis, `forceApprove` code fix, and mainnet-fork testing recommendation.

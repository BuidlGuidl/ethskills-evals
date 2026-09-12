# Executor transcript — 2026-09-12T015037Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-1/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-1/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a095c7-794e-7142-aecf-a4661cc9968c
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
I’ll inspect the workspace instructions, then write the diagnosis and both fixes directly to `answer.md`.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!lib'"' | head -20" in /tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-1/testing-quiz-003
 succeeded in 2ms:
apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-1/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..b95d7b6192fe25c61f8e490e3ae268fabf609132
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a non-standard ERC-20. Its `approve` function does not return the `bool` value required by the `IERC20` interface. Because the call is compiled through `IERC20.approve`, Solidity expects and ABI-decodes a 32-byte Boolean return value. USDT returns no data, so the token call itself can succeed but the caller then reverts while decoding the empty return data. That ABI-decoding failure commonly has no reason string. Execution therefore never reaches `aavePool.supply`.
+
+The mock never exposes this because OpenZeppelin's stock `ERC20` is standards-compliant: its `approve` returns `true`. Matching USDT's decimals does not reproduce USDT's unusual call/return behavior. Running more tests against the same mock only exercises the same compliant implementation, so no number of those tests can reveal an incompatibility absent from the model.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available; it does not rewrite ordinary ERC-20 method calls. The first line is protected because it explicitly calls `safeTransferFrom`. The second line calls raw `approve`, so none of `SafeERC20`'s optional-return handling is used.
+
+## Code fix
+
+Use `SafeERC20` for the allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's low-level optional-return handling, so an empty return value is accepted when the call succeeds. It also supports tokens such as USDT that may require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. If the project's OpenZeppelin version predates `forceApprove`, perform the equivalent safe zero-then-set sequence with that version's SafeERC20 facilities, or upgrade OpenZeppelin; do not replace this with another raw `approve`.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test using the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 Pool (with a pinned block for reproducibility). Fund or impersonate an account holding USDT, call the vault's deposit path, and verify that Aave receives the supply and the vault receives the corresponding position/aToken balance.
+
+Unit tests should also include adversarial ERC-20 test doubles—especially a no-return token and a zero-first-approval token—but such mocks are only approximations. A fork test against the exact production token and protocol is what would have caught this deployment-specific incompatibility before mainnet.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..b95d7b6192fe25c61f8e490e3ae268fabf609132
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a non-standard ERC-20. Its `approve` function does not return the `bool` value required by the `IERC20` interface. Because the call is compiled through `IERC20.approve`, Solidity expects and ABI-decodes a 32-byte Boolean return value. USDT returns no data, so the token call itself can succeed but the caller then reverts while decoding the empty return data. That ABI-decoding failure commonly has no reason string. Execution therefore never reaches `aavePool.supply`.
+
+The mock never exposes this because OpenZeppelin's stock `ERC20` is standards-compliant: its `approve` returns `true`. Matching USDT's decimals does not reproduce USDT's unusual call/return behavior. Running more tests against the same mock only exercises the same compliant implementation, so no number of those tests can reveal an incompatibility absent from the model.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available; it does not rewrite ordinary ERC-20 method calls. The first line is protected because it explicitly calls `safeTransferFrom`. The second line calls raw `approve`, so none of `SafeERC20`'s optional-return handling is used.
+
+## Code fix
+
+Use `SafeERC20` for the allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's low-level optional-return handling, so an empty return value is accepted when the call succeeds. It also supports tokens such as USDT that may require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. If the project's OpenZeppelin version predates `forceApprove`, perform the equivalent safe zero-then-set sequence with that version's SafeERC20 facilities, or upgrade OpenZeppelin; do not replace this with another raw `approve`.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test using the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 Pool (with a pinned block for reproducibility). Fund or impersonate an account holding USDT, call the vault's deposit path, and verify that Aave receives the supply and the vault receives the corresponding position/aToken balance.
+
+Unit tests should also include adversarial ERC-20 test doubles—especially a no-return token and a zero-first-approval token—but such mocks are only approximations. A fork test against the exact production token and protocol is what would have caught this deployment-specific incompatibility before mainnet.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-1/testing-quiz-003
 succeeded in 14ms:
# Why the USDT deposit reverts

The failing call is the direct `approve`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a non-standard ERC-20. Its `approve` function does not return the `bool` value required by the `IERC20` interface. Because the call is compiled through `IERC20.approve`, Solidity expects and ABI-decodes a 32-byte Boolean return value. USDT returns no data, so the token call itself can succeed but the caller then reverts while decoding the empty return data. That ABI-decoding failure commonly has no reason string. Execution therefore never reaches `aavePool.supply`.

The mock never exposes this because OpenZeppelin's stock `ERC20` is standards-compliant: its `approve` returns `true`. Matching USDT's decimals does not reproduce USDT's unusual call/return behavior. Running more tests against the same mock only exercises the same compliant implementation, so no number of those tests can reveal an incompatibility absent from the model.

`using SafeERC20 for IERC20` only makes the library's extension methods available; it does not rewrite ordinary ERC-20 method calls. The first line is protected because it explicitly calls `safeTransferFrom`. The second line calls raw `approve`, so none of `SafeERC20`'s optional-return handling is used.

## Code fix

Use `SafeERC20` for the allowance operation as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` uses SafeERC20's low-level optional-return handling, so an empty return value is accepted when the call succeeds. It also supports tokens such as USDT that may require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. If the project's OpenZeppelin version predates `forceApprove`, perform the equivalent safe zero-then-set sequence with that version's SafeERC20 facilities, or upgrade OpenZeppelin; do not replace this with another raw `approve`.

## Testing-practice fix

Add a mainnet-fork integration test using the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 Pool (with a pinned block for reproducibility). Fund or impersonate an account holding USDT, call the vault's deposit path, and verify that Aave receives the supply and the vault receives the corresponding position/aToken balance.

Unit tests should also include adversarial ERC-20 test doubles—especially a no-return token and a zero-first-approval token—but such mocks are only approximations. A fork test against the exact production token and protocol is what would have caught this deployment-specific incompatibility before mainnet.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..b95d7b6192fe25c61f8e490e3ae268fabf609132
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a non-standard ERC-20. Its `approve` function does not return the `bool` value required by the `IERC20` interface. Because the call is compiled through `IERC20.approve`, Solidity expects and ABI-decodes a 32-byte Boolean return value. USDT returns no data, so the token call itself can succeed but the caller then reverts while decoding the empty return data. That ABI-decoding failure commonly has no reason string. Execution therefore never reaches `aavePool.supply`.
+
+The mock never exposes this because OpenZeppelin's stock `ERC20` is standards-compliant: its `approve` returns `true`. Matching USDT's decimals does not reproduce USDT's unusual call/return behavior. Running more tests against the same mock only exercises the same compliant implementation, so no number of those tests can reveal an incompatibility absent from the model.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available; it does not rewrite ordinary ERC-20 method calls. The first line is protected because it explicitly calls `safeTransferFrom`. The second line calls raw `approve`, so none of `SafeERC20`'s optional-return handling is used.
+
+## Code fix
+
+Use `SafeERC20` for the allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's low-level optional-return handling, so an empty return value is accepted when the call succeeds. It also supports tokens such as USDT that may require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. If the project's OpenZeppelin version predates `forceApprove`, perform the equivalent safe zero-then-set sequence with that version's SafeERC20 facilities, or upgrade OpenZeppelin; do not replace this with another raw `approve`.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test using the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 Pool (with a pinned block for reproducibility). Fund or impersonate an account holding USDT, call the vault's deposit path, and verify that Aave receives the supply and the vault receives the corresponding position/aToken balance.
+
+Unit tests should also include adversarial ERC-20 test doubles—especially a no-return token and a zero-first-approval token—but such mocks are only approximations. A fork test against the exact production token and protocol is what would have caught this deployment-specific incompatibility before mainnet.

codex
Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-1/testing-quiz-003/answer.md) with the USDT ABI-return diagnosis, `forceApprove` fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..b95d7b6192fe25c61f8e490e3ae268fabf609132
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct `approve`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a non-standard ERC-20. Its `approve` function does not return the `bool` value required by the `IERC20` interface. Because the call is compiled through `IERC20.approve`, Solidity expects and ABI-decodes a 32-byte Boolean return value. USDT returns no data, so the token call itself can succeed but the caller then reverts while decoding the empty return data. That ABI-decoding failure commonly has no reason string. Execution therefore never reaches `aavePool.supply`.
+
+The mock never exposes this because OpenZeppelin's stock `ERC20` is standards-compliant: its `approve` returns `true`. Matching USDT's decimals does not reproduce USDT's unusual call/return behavior. Running more tests against the same mock only exercises the same compliant implementation, so no number of those tests can reveal an incompatibility absent from the model.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available; it does not rewrite ordinary ERC-20 method calls. The first line is protected because it explicitly calls `safeTransferFrom`. The second line calls raw `approve`, so none of `SafeERC20`'s optional-return handling is used.
+
+## Code fix
+
+Use `SafeERC20` for the allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses SafeERC20's low-level optional-return handling, so an empty return value is accepted when the call succeeds. It also supports tokens such as USDT that may require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. If the project's OpenZeppelin version predates `forceApprove`, perform the equivalent safe zero-then-set sequence with that version's SafeERC20 facilities, or upgrade OpenZeppelin; do not replace this with another raw `approve`.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test using the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 Pool (with a pinned block for reproducibility). Fund or impersonate an account holding USDT, call the vault's deposit path, and verify that Aave receives the supply and the vault receives the corresponding position/aToken balance.
+
+Unit tests should also include adversarial ERC-20 test doubles—especially a no-return token and a zero-first-approval token—but such mocks are only approximations. A fork test against the exact production token and protocol is what would have caught this deployment-specific incompatibility before mainnet.

tokens used
7,589
````

## final message

Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015037Z-codex-no-skill-1/testing-quiz-003/answer.md) with the USDT ABI-return diagnosis, `forceApprove` fix, and mainnet-fork testing recommendation.

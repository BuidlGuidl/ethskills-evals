# Executor transcript — 2026-09-12T015040Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-pr101-workspaces/2026-09-12T015040Z-codex-with-skill-2/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-pr101-workspaces/2026-09-12T015040Z-codex-with-skill-2/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a095c7-79b1-7b93-8e27-b50bf1dedba7
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
I’ll inspect the repository context and the testing guidance, then write the diagnosis and both fixes into `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md && rg --files -g 'AGENTS.md' -g '"'!lib'"' -g '"'!node_modules'"' | head -20" in /tmp/ethskills-pr101-workspaces/2026-09-12T015040Z-codex-with-skill-2/testing-quiz-003
 succeeded in 19ms:
---
name: testing
description: Use when writing or reviewing Foundry tests, when deciding whether a suite is enough to deploy, or when a green run or a coverage percentage is offered as evidence that a contract is safe. Covers fuzz, fork and invariant testing with `forge`. Finding and evidencing defects by running tests is in scope; auditing source by reading it belongs to `security` and `audit`.
---

# Smart Contract Testing

A green suite and 100% coverage are not evidence of safety. Coverage records which lines ran, never whether an assertion could have failed. Before signing off, name which of the three searches below the suite actually performed. If the answer is none, it has only confirmed the cases someone already thought of.

## Make tests capable of failing

Rewrite any test that mirrors the implementation: stored state asserted against the value just written to it, a getter against the variable it returns, a constant against itself, constructor state against the constructor argument. These execute every line and constrain nothing.

Assert properties instead — round-trips, conservation between accounting and custody, monotonicity, access boundaries. Skip anything whose failure would be a bug in the compiler or in a dependency you did not write.

A bug that accumulates across a sequence cannot be seen by any test that exercises one operation in isolation, however many such tests exist. "Every operation is correct on its own" is the symptom, not the defence.

## Fuzz the domain instead of picking from it

Before deploy, every owner-settable number that feeds value math — fee basis points, ratios, caps, exchange rates — needs a fuzz test over its whole accepted domain, using `bound()` rather than `vm.assume()`. Hand-picked values walk one branch; the fuzzer finds the value nobody proposed.

Reaching a suspected bug by reading the code and then writing one test for it confirms what you already believed. It is not a substitute for the search, and it stops at the first defect you happened to imagine.

Include both sides of every bound, not just the far side. The value at the limit and the value past it usually break through different code paths and surface as different failures, so evidence for one is not evidence for the other.

## Fork against the real deployment

Always fork for a contract that calls an external protocol (Uniswap, Aave, Chainlink; verified addresses in `addresses/SKILL.md`), handles a quirky token (USDT, fee-on-transfer, rebasing), or reads an oracle. Never for pure logic.

A mock encodes your assumption about the dependency, so more mock-based tests only re-test the assumption. Deployed tokens deviate from the interface they are called through — in what a call returns, in how much of a transfer arrives, in whether a balance stays put — and a mock written to the standard answers in the standard shape every time, so it can never surface the mismatch.

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
```

Pin the block. An unpinned fork follows the chain head, so live prices and reserves move between runs: assertions drift red, flake green on re-run, and the local RPC cache never hits, which grows into slow runs and provider 429s.

Pinning an old block is an archive request. A full node keeps only recent state — geth's default window is roughly the last 128 blocks — and answers anything older with an error rather than a wrong number. Whether an endpoint serves archive depth is a property of the node and the plan behind it, not something a URL tells you: confirm it answers a historical `eth_call` at your block before pinning that block, or the tests fail for a reason that has nothing to do with the contract.

## Invariant-test anything stateful

A vault, AMM, lending market or escrow does not ship on unit tests. State properties as equalities that must hold after any sequence: recorded assets equal assets actually held, total supply equals the sum of balances, `x * y >= k`.

Match the shape of the assertion to the failures it has to catch. A one-sided bound constrains one direction only — `claims <= holdings` fires on a shortfall and stays green through anything that leaves a surplus — so where value can be stranded as well as lost, the property has to be an equality or an explicit no-drift check.

Point `targetContract` at a handler, never at the contract under test. Called directly, the fuzzer supplies random senders that hold no tokens and granted no approvals, so nearly every call reverts. Reverts are discarded rather than failing the run, and the invariant is then asserted against a contract that never left its initial state — green because nothing happened.

The handler owns setup: funded and approved actors, inputs bounded to valid ranges, multiple actors where the property is about interaction between them.

Read the calls/reverts statistics in the run output every time. A revert rate near 100% means the run proved nothing; set `fail_on_revert = true` to surface it while building the handler.

## Before deploy

- [ ] No test asserts the implementation back to itself.
- [ ] Every owner-settable number feeding value math is fuzzed across its domain, both sides of each bound included.
- [ ] Every external integration and quirky token is exercised on a pinned fork against the real deployment, on an endpoint confirmed to serve that block.
- [ ] Stateful contracts have a handler-driven invariant tying accounting to custody, with a revert rate low enough that the sequences reached real states.
- [ ] Access control, zero, and max-value cases revert as intended.
- [ ] `slither .` run, with no high or medium finding left unaddressed.

codex
The key mismatch is USDT’s non-standard return behavior: the transfer is wrapped, but the approval is a direct `IERC20` call that attempts to ABI-decode a missing Boolean return value. I’m capturing that distinction, including allowance-reset compatibility and a pinned mainnet-fork test.
apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015040Z-codex-with-skill-2/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2d863b7ca88a8b323610aeb93e8e73dda6932fd0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,33 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 convention and its `approve` implementation does not return a Boolean value. By contrast, OpenZeppelin's `IERC20.approve` declares `returns (bool)`. A normal high-level Solidity call through that interface therefore expects and ABI-decodes a Boolean return value. USDT returns no data, so the decode fails and Solidity reverts without a reason string. The transaction rollback also undoes the approval.
+
+The mock never reveals this because stock OpenZeppelin `ERC20.approve` is fully standards-conforming and returns `true`. Its ABI behavior is therefore materially different from the deployed token even though both contracts can be addressed through `IERC20` and both use six decimals. The interface describes how the caller expects the contract to behave; it does not make a non-conforming deployed contract conform.
+
+`using SafeERC20 for IERC20` does not automatically wrap every call made on an `IERC20`. It only adds methods such as `safeTransferFrom` and `forceApprove`; the code must actually call those methods. The first line calls `safeTransferFrom`, whose low-level optional-return handling accepts either no return data or a decoded `true`, so it works with USDT. The second line calls the original `IERC20.approve` directly, bypassing `SafeERC20`, and therefore reverts while decoding USDT's empty return data.
+
+## Code fix
+
+With a current OpenZeppelin release, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return-safe low-level calls and, when necessary, retries by setting the allowance to zero before setting the requested nonzero allowance. That second property also handles USDT's restriction on changing an existing nonzero allowance directly to another nonzero value. It is preferable here to a raw `approve`, and more robust than relying on the pool always consuming the allowance exactly.
+
+If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent optional-return-safe zero-then-set sequence using `SafeERC20` facilities appropriate to that version. Do not merely ignore the Boolean returned by `IERC20.approve`: Solidity still decodes it before control returns to the caller.
+
+## Testing-practice fix
+
+Add a Foundry integration test on a **pinned mainnet fork** that uses the actual deployed USDT and Aave V3 pool, rather than substitutes for either integration boundary. Fund a test depositor with real fork-state USDT (for example using `deal` if it correctly supports that token, or by impersonating a funded holder), approve the vault, execute a deposit, and assert that the deposit succeeds and the expected Aave position/accounting changes occur. Pin a block supported by the RPC provider so the test is reproducible.
+
+Keep the mock tests for fast unit testing, but do not treat them as integration evidence. No number of tests against this `MockERC20` could discover the defect: every such test executes the mock's conforming `approve` implementation and receives the Boolean return that the production USDT call omits. Adding more cases only explores inputs against the same incorrect environmental assumption. A deliberately non-standard mock could reproduce a known quirk, but the pre-deployment practice that catches unknown deployed-contract differences is a fork test against the real token and protocol.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2d863b7ca88a8b323610aeb93e8e73dda6932fd0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,33 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 convention and its `approve` implementation does not return a Boolean value. By contrast, OpenZeppelin's `IERC20.approve` declares `returns (bool)`. A normal high-level Solidity call through that interface therefore expects and ABI-decodes a Boolean return value. USDT returns no data, so the decode fails and Solidity reverts without a reason string. The transaction rollback also undoes the approval.
+
+The mock never reveals this because stock OpenZeppelin `ERC20.approve` is fully standards-conforming and returns `true`. Its ABI behavior is therefore materially different from the deployed token even though both contracts can be addressed through `IERC20` and both use six decimals. The interface describes how the caller expects the contract to behave; it does not make a non-conforming deployed contract conform.
+
+`using SafeERC20 for IERC20` does not automatically wrap every call made on an `IERC20`. It only adds methods such as `safeTransferFrom` and `forceApprove`; the code must actually call those methods. The first line calls `safeTransferFrom`, whose low-level optional-return handling accepts either no return data or a decoded `true`, so it works with USDT. The second line calls the original `IERC20.approve` directly, bypassing `SafeERC20`, and therefore reverts while decoding USDT's empty return data.
+
+## Code fix
+
+With a current OpenZeppelin release, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return-safe low-level calls and, when necessary, retries by setting the allowance to zero before setting the requested nonzero allowance. That second property also handles USDT's restriction on changing an existing nonzero allowance directly to another nonzero value. It is preferable here to a raw `approve`, and more robust than relying on the pool always consuming the allowance exactly.
+
+If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent optional-return-safe zero-then-set sequence using `SafeERC20` facilities appropriate to that version. Do not merely ignore the Boolean returned by `IERC20.approve`: Solidity still decodes it before control returns to the caller.
+
+## Testing-practice fix
+
+Add a Foundry integration test on a **pinned mainnet fork** that uses the actual deployed USDT and Aave V3 pool, rather than substitutes for either integration boundary. Fund a test depositor with real fork-state USDT (for example using `deal` if it correctly supports that token, or by impersonating a funded holder), approve the vault, execute a deposit, and assert that the deposit succeeds and the expected Aave position/accounting changes occur. Pin a block supported by the RPC provider so the test is reproducible.
+
+Keep the mock tests for fast unit testing, but do not treat them as integration evidence. No number of tests against this `MockERC20` could discover the defect: every such test executes the mock's conforming `approve` implementation and receives the Boolean return that the production USDT call omits. Adding more cases only explores inputs against the same incorrect environmental assumption. A deliberately non-standard mock could reproduce a known quirk, but the pre-deployment practice that catches unknown deployed-contract differences is a fork test against the real token and protocol.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git status --short" in /tmp/ethskills-pr101-workspaces/2026-09-12T015040Z-codex-with-skill-2/testing-quiz-003
 succeeded in 0ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2d863b7ca88a8b323610aeb93e8e73dda6932fd0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,33 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 convention and its `approve` implementation does not return a Boolean value. By contrast, OpenZeppelin's `IERC20.approve` declares `returns (bool)`. A normal high-level Solidity call through that interface therefore expects and ABI-decodes a Boolean return value. USDT returns no data, so the decode fails and Solidity reverts without a reason string. The transaction rollback also undoes the approval.
+
+The mock never reveals this because stock OpenZeppelin `ERC20.approve` is fully standards-conforming and returns `true`. Its ABI behavior is therefore materially different from the deployed token even though both contracts can be addressed through `IERC20` and both use six decimals. The interface describes how the caller expects the contract to behave; it does not make a non-conforming deployed contract conform.
+
+`using SafeERC20 for IERC20` does not automatically wrap every call made on an `IERC20`. It only adds methods such as `safeTransferFrom` and `forceApprove`; the code must actually call those methods. The first line calls `safeTransferFrom`, whose low-level optional-return handling accepts either no return data or a decoded `true`, so it works with USDT. The second line calls the original `IERC20.approve` directly, bypassing `SafeERC20`, and therefore reverts while decoding USDT's empty return data.
+
+## Code fix
+
+With a current OpenZeppelin release, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return-safe low-level calls and, when necessary, retries by setting the allowance to zero before setting the requested nonzero allowance. That second property also handles USDT's restriction on changing an existing nonzero allowance directly to another nonzero value. It is preferable here to a raw `approve`, and more robust than relying on the pool always consuming the allowance exactly.
+
+If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent optional-return-safe zero-then-set sequence using `SafeERC20` facilities appropriate to that version. Do not merely ignore the Boolean returned by `IERC20.approve`: Solidity still decodes it before control returns to the caller.
+
+## Testing-practice fix
+
+Add a Foundry integration test on a **pinned mainnet fork** that uses the actual deployed USDT and Aave V3 pool, rather than substitutes for either integration boundary. Fund a test depositor with real fork-state USDT (for example using `deal` if it correctly supports that token, or by impersonating a funded holder), approve the vault, execute a deposit, and assert that the deposit succeeds and the expected Aave position/accounting changes occur. Pin a block supported by the RPC provider so the test is reproducible.
+
+Keep the mock tests for fast unit testing, but do not treat them as integration evidence. No number of tests against this `MockERC20` could discover the defect: every such test executes the mock's conforming `approve` implementation and receives the Boolean return that the production USDT call omits. Adding more cases only explores inputs against the same incorrect environmental assumption. A deliberately non-standard mock could reproduce a known quirk, but the pre-deployment practice that catches unknown deployed-contract differences is a fork test against the real token and protocol.

codex
Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015040Z-codex-with-skill-2/testing-quiz-003/answer.md) with the USDT ABI-return diagnosis, `forceApprove` fix, and pinned mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2d863b7ca88a8b323610aeb93e8e73dda6932fd0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,33 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 convention and its `approve` implementation does not return a Boolean value. By contrast, OpenZeppelin's `IERC20.approve` declares `returns (bool)`. A normal high-level Solidity call through that interface therefore expects and ABI-decodes a Boolean return value. USDT returns no data, so the decode fails and Solidity reverts without a reason string. The transaction rollback also undoes the approval.
+
+The mock never reveals this because stock OpenZeppelin `ERC20.approve` is fully standards-conforming and returns `true`. Its ABI behavior is therefore materially different from the deployed token even though both contracts can be addressed through `IERC20` and both use six decimals. The interface describes how the caller expects the contract to behave; it does not make a non-conforming deployed contract conform.
+
+`using SafeERC20 for IERC20` does not automatically wrap every call made on an `IERC20`. It only adds methods such as `safeTransferFrom` and `forceApprove`; the code must actually call those methods. The first line calls `safeTransferFrom`, whose low-level optional-return handling accepts either no return data or a decoded `true`, so it works with USDT. The second line calls the original `IERC20.approve` directly, bypassing `SafeERC20`, and therefore reverts while decoding USDT's empty return data.
+
+## Code fix
+
+With a current OpenZeppelin release, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return-safe low-level calls and, when necessary, retries by setting the allowance to zero before setting the requested nonzero allowance. That second property also handles USDT's restriction on changing an existing nonzero allowance directly to another nonzero value. It is preferable here to a raw `approve`, and more robust than relying on the pool always consuming the allowance exactly.
+
+If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent optional-return-safe zero-then-set sequence using `SafeERC20` facilities appropriate to that version. Do not merely ignore the Boolean returned by `IERC20.approve`: Solidity still decodes it before control returns to the caller.
+
+## Testing-practice fix
+
+Add a Foundry integration test on a **pinned mainnet fork** that uses the actual deployed USDT and Aave V3 pool, rather than substitutes for either integration boundary. Fund a test depositor with real fork-state USDT (for example using `deal` if it correctly supports that token, or by impersonating a funded holder), approve the vault, execute a deposit, and assert that the deposit succeeds and the expected Aave position/accounting changes occur. Pin a block supported by the RPC provider so the test is reproducible.
+
+Keep the mock tests for fast unit testing, but do not treat them as integration evidence. No number of tests against this `MockERC20` could discover the defect: every such test executes the mock's conforming `approve` implementation and receives the Boolean return that the production USDT call omits. Adding more cases only explores inputs against the same incorrect environmental assumption. A deliberately non-standard mock could reproduce a known quirk, but the pre-deployment practice that catches unknown deployed-contract differences is a fork test against the real token and protocol.

tokens used
9,575
````

## final message

Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015040Z-codex-with-skill-2/testing-quiz-003/answer.md) with the USDT ABI-return diagnosis, `forceApprove` fix, and pinned mainnet-fork testing recommendation.

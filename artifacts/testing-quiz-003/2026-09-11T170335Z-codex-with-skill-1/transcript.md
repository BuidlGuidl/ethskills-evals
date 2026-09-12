# Executor transcript — 2026-09-11T170335Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-evals-issue112/2026-09-11T170335Z-codex-with-skill-1/testing-quiz-003

## session

````text
2026-09-11T17:17:07.310380Z  WARN codex_app_server::skills_watcher: failed to initialize skills file watcher: No file descriptors available (os error 24)
2026-09-11T17:17:07.311025Z  WARN codex_app_server::fs_watch: filesystem watch manager falling back to noop core watcher: No file descriptors available (os error 24)
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-evals-issue112/2026-09-11T170335Z-codex-with-skill-1/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 01a09179-17f1-7ae1-b687-7ae618549656
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
I’ll apply the Foundry testing guidance here, inspect the workspace instructions, then write the diagnosis and both fixes into `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md && find .. -name AGENTS.md -print" in /tmp/ethskills-evals-issue112/2026-09-11T170335Z-codex-with-skill-1/testing-quiz-003
 succeeded in 15ms:
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

apply patch
patch: completed
/tmp/ethskills-evals-issue112/2026-09-11T170335Z-codex-with-skill-1/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..680a36bb6a1ebcdf00f1ecf68cfb6364190b1ae0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,23 @@
+# Why the USDT deposit reverts
+
+The failing call is `usdt.approve(...)`, not the preceding transfer. Mainnet USDT is a legacy, non-standard ERC-20: its `approve` implementation does not return the `bool` that `IERC20.approve` declares. Calling it through the typed `IERC20` interface therefore makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the decode fails and the transaction reverts without a reason string. The revert rolls back the allowance update and the earlier transfer as well.
+
+The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`, so the typed call always receives correctly shaped return data. Its six decimals are irrelevant: decimals affect display and amount conventions, not the ABI behavior of `approve`.
+
+`using SafeERC20 for IERC20` only adds wrapper functions; it does not transparently replace every ERC-20 method call. The first line explicitly invokes `safeTransferFrom`, whose optional-return handling accepts either `true` or no return data, so it works with USDT. The second line explicitly invokes the raw `approve` method, bypassing `SafeERC20`, and therefore retains Solidity's strict return-data decoding.
+
+USDT also has the well-known zero-first allowance rule: changing an existing nonzero allowance directly to another nonzero value reverts. The robust code fix is therefore OpenZeppelin's `forceApprove`, which handles both optional return data and tokens that require resetting the allowance to zero:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+This requires an OpenZeppelin version that provides `forceApprove`. With an older version, upgrade it or implement the equivalent using SafeERC20 optional-return calls: try the desired allowance, and on failure safely approve zero before safely approving the desired value. A raw `approve(0)` followed by raw `approve(amount)` is not sufficient because both raw calls still have the missing-return-value problem.
+
+No number of additional tests against the same stock `MockERC20` could reveal this integration mismatch. A mock encodes the standard behavior the test author assumed; repeatedly exercising it cannot discover that the deployed contract has different return-data and allowance semantics. Coverage and a green unit suite only show behavior under those mocked assumptions.
+
+The testing-practice fix is to add a pinned mainnet-fork integration test that uses the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual configured Aave V3 pool. Fund a depositor with real USDT state (for example, by impersonating a holder or using a Foundry balance helper appropriate for that token), approve the vault, execute a deposit, and assert both the vault/Aave accounting and the resulting aToken position. Pin the block number and first confirm the RPC endpoint serves historical state at that block. Keep fast mock unit tests for local logic, but require fork tests for external protocols and known non-standard tokens before deployment.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..680a36bb6a1ebcdf00f1ecf68cfb6364190b1ae0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,23 @@
+# Why the USDT deposit reverts
+
+The failing call is `usdt.approve(...)`, not the preceding transfer. Mainnet USDT is a legacy, non-standard ERC-20: its `approve` implementation does not return the `bool` that `IERC20.approve` declares. Calling it through the typed `IERC20` interface therefore makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the decode fails and the transaction reverts without a reason string. The revert rolls back the allowance update and the earlier transfer as well.
+
+The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`, so the typed call always receives correctly shaped return data. Its six decimals are irrelevant: decimals affect display and amount conventions, not the ABI behavior of `approve`.
+
+`using SafeERC20 for IERC20` only adds wrapper functions; it does not transparently replace every ERC-20 method call. The first line explicitly invokes `safeTransferFrom`, whose optional-return handling accepts either `true` or no return data, so it works with USDT. The second line explicitly invokes the raw `approve` method, bypassing `SafeERC20`, and therefore retains Solidity's strict return-data decoding.
+
+USDT also has the well-known zero-first allowance rule: changing an existing nonzero allowance directly to another nonzero value reverts. The robust code fix is therefore OpenZeppelin's `forceApprove`, which handles both optional return data and tokens that require resetting the allowance to zero:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+This requires an OpenZeppelin version that provides `forceApprove`. With an older version, upgrade it or implement the equivalent using SafeERC20 optional-return calls: try the desired allowance, and on failure safely approve zero before safely approving the desired value. A raw `approve(0)` followed by raw `approve(amount)` is not sufficient because both raw calls still have the missing-return-value problem.
+
+No number of additional tests against the same stock `MockERC20` could reveal this integration mismatch. A mock encodes the standard behavior the test author assumed; repeatedly exercising it cannot discover that the deployed contract has different return-data and allowance semantics. Coverage and a green unit suite only show behavior under those mocked assumptions.
+
+The testing-practice fix is to add a pinned mainnet-fork integration test that uses the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual configured Aave V3 pool. Fund a depositor with real USDT state (for example, by impersonating a holder or using a Foundry balance helper appropriate for that token), approve the vault, execute a deposit, and assert both the vault/Aave accounting and the resulting aToken position. Pin the block number and first confirm the RPC endpoint serves historical state at that block. Keep fast mock unit tests for local logic, but require fork tests for external protocols and known non-standard tokens before deployment.

exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /tmp/ethskills-evals-issue112/2026-09-11T170335Z-codex-with-skill-1/testing-quiz-003
 succeeded in 6ms:
# Why the USDT deposit reverts

The failing call is `usdt.approve(...)`, not the preceding transfer. Mainnet USDT is a legacy, non-standard ERC-20: its `approve` implementation does not return the `bool` that `IERC20.approve` declares. Calling it through the typed `IERC20` interface therefore makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the decode fails and the transaction reverts without a reason string. The revert rolls back the allowance update and the earlier transfer as well.

The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`, so the typed call always receives correctly shaped return data. Its six decimals are irrelevant: decimals affect display and amount conventions, not the ABI behavior of `approve`.

`using SafeERC20 for IERC20` only adds wrapper functions; it does not transparently replace every ERC-20 method call. The first line explicitly invokes `safeTransferFrom`, whose optional-return handling accepts either `true` or no return data, so it works with USDT. The second line explicitly invokes the raw `approve` method, bypassing `SafeERC20`, and therefore retains Solidity's strict return-data decoding.

USDT also has the well-known zero-first allowance rule: changing an existing nonzero allowance directly to another nonzero value reverts. The robust code fix is therefore OpenZeppelin's `forceApprove`, which handles both optional return data and tokens that require resetting the allowance to zero:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

This requires an OpenZeppelin version that provides `forceApprove`. With an older version, upgrade it or implement the equivalent using SafeERC20 optional-return calls: try the desired allowance, and on failure safely approve zero before safely approving the desired value. A raw `approve(0)` followed by raw `approve(amount)` is not sufficient because both raw calls still have the missing-return-value problem.

No number of additional tests against the same stock `MockERC20` could reveal this integration mismatch. A mock encodes the standard behavior the test author assumed; repeatedly exercising it cannot discover that the deployed contract has different return-data and allowance semantics. Coverage and a green unit suite only show behavior under those mocked assumptions.

The testing-practice fix is to add a pinned mainnet-fork integration test that uses the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual configured Aave V3 pool. Fund a depositor with real USDT state (for example, by impersonating a holder or using a Foundry balance helper appropriate for that token), approve the vault, execute a deposit, and assert both the vault/Aave accounting and the resulting aToken position. Pin the block number and first confirm the RPC endpoint serves historical state at that block. Keep fast mock unit tests for local logic, but require fork tests for external protocols and known non-standard tokens before deployment.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..680a36bb6a1ebcdf00f1ecf68cfb6364190b1ae0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,23 @@
+# Why the USDT deposit reverts
+
+The failing call is `usdt.approve(...)`, not the preceding transfer. Mainnet USDT is a legacy, non-standard ERC-20: its `approve` implementation does not return the `bool` that `IERC20.approve` declares. Calling it through the typed `IERC20` interface therefore makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the decode fails and the transaction reverts without a reason string. The revert rolls back the allowance update and the earlier transfer as well.
+
+The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`, so the typed call always receives correctly shaped return data. Its six decimals are irrelevant: decimals affect display and amount conventions, not the ABI behavior of `approve`.
+
+`using SafeERC20 for IERC20` only adds wrapper functions; it does not transparently replace every ERC-20 method call. The first line explicitly invokes `safeTransferFrom`, whose optional-return handling accepts either `true` or no return data, so it works with USDT. The second line explicitly invokes the raw `approve` method, bypassing `SafeERC20`, and therefore retains Solidity's strict return-data decoding.
+
+USDT also has the well-known zero-first allowance rule: changing an existing nonzero allowance directly to another nonzero value reverts. The robust code fix is therefore OpenZeppelin's `forceApprove`, which handles both optional return data and tokens that require resetting the allowance to zero:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+This requires an OpenZeppelin version that provides `forceApprove`. With an older version, upgrade it or implement the equivalent using SafeERC20 optional-return calls: try the desired allowance, and on failure safely approve zero before safely approving the desired value. A raw `approve(0)` followed by raw `approve(amount)` is not sufficient because both raw calls still have the missing-return-value problem.
+
+No number of additional tests against the same stock `MockERC20` could reveal this integration mismatch. A mock encodes the standard behavior the test author assumed; repeatedly exercising it cannot discover that the deployed contract has different return-data and allowance semantics. Coverage and a green unit suite only show behavior under those mocked assumptions.
+
+The testing-practice fix is to add a pinned mainnet-fork integration test that uses the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual configured Aave V3 pool. Fund a depositor with real USDT state (for example, by impersonating a holder or using a Foundry balance helper appropriate for that token), approve the vault, execute a deposit, and assert both the vault/Aave accounting and the resulting aToken position. Pin the block number and first confirm the RPC endpoint serves historical state at that block. Keep fast mock unit tests for local logic, but require fork tests for external protocols and known non-standard tokens before deployment.

codex
Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-11T170335Z-codex-with-skill-1/testing-quiz-003/answer.md) with the USDT revert diagnosis, `forceApprove` code fix, and pinned mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..680a36bb6a1ebcdf00f1ecf68cfb6364190b1ae0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,23 @@
+# Why the USDT deposit reverts
+
+The failing call is `usdt.approve(...)`, not the preceding transfer. Mainnet USDT is a legacy, non-standard ERC-20: its `approve` implementation does not return the `bool` that `IERC20.approve` declares. Calling it through the typed `IERC20` interface therefore makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the decode fails and the transaction reverts without a reason string. The revert rolls back the allowance update and the earlier transfer as well.
+
+The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`, so the typed call always receives correctly shaped return data. Its six decimals are irrelevant: decimals affect display and amount conventions, not the ABI behavior of `approve`.
+
+`using SafeERC20 for IERC20` only adds wrapper functions; it does not transparently replace every ERC-20 method call. The first line explicitly invokes `safeTransferFrom`, whose optional-return handling accepts either `true` or no return data, so it works with USDT. The second line explicitly invokes the raw `approve` method, bypassing `SafeERC20`, and therefore retains Solidity's strict return-data decoding.
+
+USDT also has the well-known zero-first allowance rule: changing an existing nonzero allowance directly to another nonzero value reverts. The robust code fix is therefore OpenZeppelin's `forceApprove`, which handles both optional return data and tokens that require resetting the allowance to zero:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+This requires an OpenZeppelin version that provides `forceApprove`. With an older version, upgrade it or implement the equivalent using SafeERC20 optional-return calls: try the desired allowance, and on failure safely approve zero before safely approving the desired value. A raw `approve(0)` followed by raw `approve(amount)` is not sufficient because both raw calls still have the missing-return-value problem.
+
+No number of additional tests against the same stock `MockERC20` could reveal this integration mismatch. A mock encodes the standard behavior the test author assumed; repeatedly exercising it cannot discover that the deployed contract has different return-data and allowance semantics. Coverage and a green unit suite only show behavior under those mocked assumptions.
+
+The testing-practice fix is to add a pinned mainnet-fork integration test that uses the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual configured Aave V3 pool. Fund a depositor with real USDT state (for example, by impersonating a holder or using a Foundry balance helper appropriate for that token), approve the vault, execute a deposit, and assert both the vault/Aave accounting and the resulting aToken position. Pin the block number and first confirm the RPC endpoint serves historical state at that block. Keep fast mock unit tests for local logic, but require fork tests for external protocols and known non-standard tokens before deployment.

tokens used
9,561
````

## final message

Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-11T170335Z-codex-with-skill-1/testing-quiz-003/answer.md) with the USDT revert diagnosis, `forceApprove` code fix, and pinned mainnet-fork testing recommendation.

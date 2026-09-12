# Executor transcript — 2026-09-12T011120Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-1/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-1/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 01a0932b-8caa-7f50-8660-cc47860a17c5
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
I’m using the Foundry testing skill because the question is specifically about what the green mock suite proves—and what test strategy would have exposed the mainnet incompatibility.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-1/testing-quiz-003
 succeeded in 12ms:
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

Treat every bound as three separate cases: the nearest value below it, the value exactly at it, and the nearest value above it. Trace each through the downstream checks before deciding which region is valid. The exact limit and the value past it often break through different code paths and surface as different failures, so evidence for one is not evidence for the other.

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
- [ ] Every owner-settable number feeding value math is fuzzed across its domain, with below, exact-limit, and above-limit behavior checked separately.
- [ ] Every external integration and quirky token is exercised on a pinned fork against the real deployment, on an endpoint confirmed to serve that block.
- [ ] Stateful contracts have a handler-driven invariant tying accounting to custody, with a revert rate low enough that the sequences reached real states.
- [ ] Access control, zero, and max-value cases revert as intended.
- [ ] `slither .` run, with no high or medium finding left unaddressed.

codex
The key distinction is now clear: `using SafeERC20` does not rewrite ordinary interface calls. The transfer uses the wrapper explicitly; the approval does not, so Solidity applies strict ABI return decoding to USDT’s non-standard `approve`. I’ll capture that along with the robust zero-first approval fix and a pinned mainnet-fork test.
apply patch
patch: completed
/tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-1/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8b4f8c281639762fef1e2b47f15a5d6883bc9f43
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is not a fully standard ERC-20 implementation. In particular, its `approve` function does not return the `bool` declared by OpenZeppelin's `IERC20`. A normal high-level call through `IERC20.approve` therefore expects and ABI-decodes a Boolean return value. USDT returns no data, so that decoding fails and Solidity reverts without a useful reason string. Because the transaction reverts, any approval state change made inside USDT is rolled back as well.
+
+The mock never exposes this incompatibility. OpenZeppelin's stock `ERC20.approve` returns a proper `bool`, exactly as `IERC20` says it should, so the high-level call always decodes successfully. Its six decimals are irrelevant to this failure; matching decimals does not reproduce USDT's call and return behavior.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not automatically wrap every ERC-20 call. The first line explicitly calls `safeTransferFrom`, whose low-level optional-return handling accepts both a returned `true` and empty return data, so it works with USDT. The second line explicitly calls the token's ordinary `approve`, bypassing `SafeERC20`, so it receives no such protection.
+
+## Code fix
+
+Use SafeERC20 for the approval too, preferably its USDT-compatible force-approval helper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens with no Boolean return and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. This is more robust than merely replacing the call with a direct approval or assuming Aave will always consume the allowance completely. With an older OpenZeppelin version that lacks `forceApprove`, perform the same operation with SafeERC20-compatible optional-return calls: try the desired approval and, if necessary, approve zero before approving the desired amount. Upgrading to a version providing `forceApprove` is preferable.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that uses the deployed USDT and Aave V3 Pool addresses and executes the complete deposit path with an actually funded and approved depositor. Assert that the deposit succeeds and that the expected Aave position/accounting change occurs. Pinning the block makes the dependency state reproducible, and the RPC endpoint must support historical state at that block.
+
+No number of tests using only the stock `MockERC20` and `MockAavePool` can discover this defect. A mock implements the behavior its author assumed—in this case, standards-compliant Boolean returns—so additional cases merely exercise that same assumption. Fuzzing amounts would not change the return-data shape either. Testing an external protocol and a known quirky token requires at least one fork test against their real deployed bytecode; unit mocks can remain for fast testing of the vault's own logic.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8b4f8c281639762fef1e2b47f15a5d6883bc9f43
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is not a fully standard ERC-20 implementation. In particular, its `approve` function does not return the `bool` declared by OpenZeppelin's `IERC20`. A normal high-level call through `IERC20.approve` therefore expects and ABI-decodes a Boolean return value. USDT returns no data, so that decoding fails and Solidity reverts without a useful reason string. Because the transaction reverts, any approval state change made inside USDT is rolled back as well.
+
+The mock never exposes this incompatibility. OpenZeppelin's stock `ERC20.approve` returns a proper `bool`, exactly as `IERC20` says it should, so the high-level call always decodes successfully. Its six decimals are irrelevant to this failure; matching decimals does not reproduce USDT's call and return behavior.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not automatically wrap every ERC-20 call. The first line explicitly calls `safeTransferFrom`, whose low-level optional-return handling accepts both a returned `true` and empty return data, so it works with USDT. The second line explicitly calls the token's ordinary `approve`, bypassing `SafeERC20`, so it receives no such protection.
+
+## Code fix
+
+Use SafeERC20 for the approval too, preferably its USDT-compatible force-approval helper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens with no Boolean return and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. This is more robust than merely replacing the call with a direct approval or assuming Aave will always consume the allowance completely. With an older OpenZeppelin version that lacks `forceApprove`, perform the same operation with SafeERC20-compatible optional-return calls: try the desired approval and, if necessary, approve zero before approving the desired amount. Upgrading to a version providing `forceApprove` is preferable.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that uses the deployed USDT and Aave V3 Pool addresses and executes the complete deposit path with an actually funded and approved depositor. Assert that the deposit succeeds and that the expected Aave position/accounting change occurs. Pinning the block makes the dependency state reproducible, and the RPC endpoint must support historical state at that block.
+
+No number of tests using only the stock `MockERC20` and `MockAavePool` can discover this defect. A mock implements the behavior its author assumed—in this case, standards-compliant Boolean returns—so additional cases merely exercise that same assumption. Fuzzing amounts would not change the return-data shape either. Testing an external protocol and a known quirky token requires at least one fork test against their real deployed bytecode; unit mocks can remain for fast testing of the vault's own logic.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git diff --check -- answer.md" in /tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-1/testing-quiz-003
 succeeded in 5ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8b4f8c281639762fef1e2b47f15a5d6883bc9f43
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is not a fully standard ERC-20 implementation. In particular, its `approve` function does not return the `bool` declared by OpenZeppelin's `IERC20`. A normal high-level call through `IERC20.approve` therefore expects and ABI-decodes a Boolean return value. USDT returns no data, so that decoding fails and Solidity reverts without a useful reason string. Because the transaction reverts, any approval state change made inside USDT is rolled back as well.
+
+The mock never exposes this incompatibility. OpenZeppelin's stock `ERC20.approve` returns a proper `bool`, exactly as `IERC20` says it should, so the high-level call always decodes successfully. Its six decimals are irrelevant to this failure; matching decimals does not reproduce USDT's call and return behavior.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not automatically wrap every ERC-20 call. The first line explicitly calls `safeTransferFrom`, whose low-level optional-return handling accepts both a returned `true` and empty return data, so it works with USDT. The second line explicitly calls the token's ordinary `approve`, bypassing `SafeERC20`, so it receives no such protection.
+
+## Code fix
+
+Use SafeERC20 for the approval too, preferably its USDT-compatible force-approval helper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens with no Boolean return and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. This is more robust than merely replacing the call with a direct approval or assuming Aave will always consume the allowance completely. With an older OpenZeppelin version that lacks `forceApprove`, perform the same operation with SafeERC20-compatible optional-return calls: try the desired approval and, if necessary, approve zero before approving the desired amount. Upgrading to a version providing `forceApprove` is preferable.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that uses the deployed USDT and Aave V3 Pool addresses and executes the complete deposit path with an actually funded and approved depositor. Assert that the deposit succeeds and that the expected Aave position/accounting change occurs. Pinning the block makes the dependency state reproducible, and the RPC endpoint must support historical state at that block.
+
+No number of tests using only the stock `MockERC20` and `MockAavePool` can discover this defect. A mock implements the behavior its author assumed—in this case, standards-compliant Boolean returns—so additional cases merely exercise that same assumption. Fuzzing amounts would not change the return-data shape either. Testing an external protocol and a known quirky token requires at least one fork test against their real deployed bytecode; unit mocks can remain for fast testing of the vault's own logic.

codex
Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-1/testing-quiz-003/answer.md) explaining:

- USDT’s non-standard empty return data from `approve`
- Why direct `IERC20.approve` reverts
- Why `SafeERC20` protected only `safeTransferFrom`
- The `forceApprove` code fix
- Why mock-only tests cannot expose dependency mismatches
- The need for a pinned mainnet-fork integration test using real USDT and Aave deployments
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8b4f8c281639762fef1e2b47f15a5d6883bc9f43
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,31 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is not a fully standard ERC-20 implementation. In particular, its `approve` function does not return the `bool` declared by OpenZeppelin's `IERC20`. A normal high-level call through `IERC20.approve` therefore expects and ABI-decodes a Boolean return value. USDT returns no data, so that decoding fails and Solidity reverts without a useful reason string. Because the transaction reverts, any approval state change made inside USDT is rolled back as well.
+
+The mock never exposes this incompatibility. OpenZeppelin's stock `ERC20.approve` returns a proper `bool`, exactly as `IERC20` says it should, so the high-level call always decodes successfully. Its six decimals are irrelevant to this failure; matching decimals does not reproduce USDT's call and return behavior.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not automatically wrap every ERC-20 call. The first line explicitly calls `safeTransferFrom`, whose low-level optional-return handling accepts both a returned `true` and empty return data, so it works with USDT. The second line explicitly calls the token's ordinary `approve`, bypassing `SafeERC20`, so it receives no such protection.
+
+## Code fix
+
+Use SafeERC20 for the approval too, preferably its USDT-compatible force-approval helper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens with no Boolean return and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. This is more robust than merely replacing the call with a direct approval or assuming Aave will always consume the allowance completely. With an older OpenZeppelin version that lacks `forceApprove`, perform the same operation with SafeERC20-compatible optional-return calls: try the desired approval and, if necessary, approve zero before approving the desired amount. Upgrading to a version providing `forceApprove` is preferable.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that uses the deployed USDT and Aave V3 Pool addresses and executes the complete deposit path with an actually funded and approved depositor. Assert that the deposit succeeds and that the expected Aave position/accounting change occurs. Pinning the block makes the dependency state reproducible, and the RPC endpoint must support historical state at that block.
+
+No number of tests using only the stock `MockERC20` and `MockAavePool` can discover this defect. A mock implements the behavior its author assumed—in this case, standards-compliant Boolean returns—so additional cases merely exercise that same assumption. Fuzzing amounts would not change the return-data shape either. Testing an external protocol and a known quirky token requires at least one fork test against their real deployed bytecode; unit mocks can remain for fast testing of the vault's own logic.

tokens used
9,535
````

## final message

Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-1/testing-quiz-003/answer.md) explaining:

- USDT’s non-standard empty return data from `approve`
- Why direct `IERC20.approve` reverts
- Why `SafeERC20` protected only `safeTransferFrom`
- The `forceApprove` code fix
- Why mock-only tests cannot expose dependency mismatches
- The need for a pinned mainnet-fork integration test using real USDT and Aave deployments

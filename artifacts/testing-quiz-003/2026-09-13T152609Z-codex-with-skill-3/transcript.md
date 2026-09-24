# Executor transcript — 2026-09-13T152609Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-testing-patched-20260913/2026-09-13T152609Z-codex-with-skill-3/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-testing-patched-20260913/2026-09-13T152609Z-codex-with-skill-3/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a09b73-a7a1-7480-ab10-572c5ef4c786
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
I’ll apply the Foundry testing guidance here, then write the diagnosis and both fixes into `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md && if [ -f answer.md ]; then sed -n '1,200p' answer.md; fi" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152609Z-codex-with-skill-3/testing-quiz-003
 succeeded in 18ms:
---
name: testing
description: Use when writing or reviewing Foundry tests, when deciding whether a suite is enough to deploy, or when a green run or a coverage percentage is offered as evidence that a contract is safe. Covers fuzz, fork and invariant testing with `forge`. Finding and evidencing defects by running tests is in scope; auditing source by reading it belongs to `security` and `audit`.
---

# Smart Contract Testing

A green suite and 100% coverage are not evidence of safety. Coverage records which lines ran, never whether an assertion could have failed. Before signing off, name which of the three searches below the suite actually performed. If the answer is none, it has only confirmed the cases someone already thought of.

For deployment sign-off, map each applicable risk to a search before concluding: configurable value math to fuzzing, stateful accounting to a handler invariant, and external integrations to a pinned fork. Run each applicable search. Inspection and targeted regression tests can confirm a suspected defect, but do not replace the search.

## Make tests capable of failing

Rewrite any test that mirrors the implementation: stored state asserted against the value just written to it, a getter against the variable it returns, a constant against itself, constructor state against the constructor argument. These execute every line and constrain nothing.

Assert properties instead — round-trips, conservation between accounting and custody, monotonicity, access boundaries. Skip anything whose failure would be a bug in the compiler or in a dependency you did not write.

A bug that accumulates across a sequence cannot be seen by any test that exercises one operation in isolation, however many such tests exist. "Every operation is correct on its own" is the symptom, not the defence.

## Fuzz the domain instead of picking from it

Before deploy, every owner-settable number that feeds value math — fee basis points, ratios, caps, exchange rates — needs a fuzz test over its whole accepted domain, using `bound()` rather than `vm.assume()`. Hand-picked values walk one branch; the fuzzer finds the value nobody proposed.

Reaching a suspected bug by reading the code and then writing one test for it confirms what you already believed. It is not a substitute for the search, and it stops at the first defect you happened to imagine.

For an integer boundary `b`, exercise `b - 1`, `b`, and `b + 1` where representable. Treat the exact boundary and the first value beyond it as separate cases and preserve evidence for each distinct failure.

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

One post-operation mismatch proves divergence, not accumulation. When claiming cumulative drift, show the gap after at least two state transitions, or provide a stateful-invariant counterexample whose call sequence demonstrates the growth.

Point `targetContract` at a handler, never at the contract under test. Called directly, the fuzzer supplies random senders that hold no tokens and granted no approvals, so nearly every call reverts. Reverts are discarded rather than failing the run, and the invariant is then asserted against a contract that never left its initial state — green because nothing happened.

The handler owns setup: funded and approved actors, inputs bounded to valid ranges, multiple actors where the property is about interaction between them.

Read the calls/reverts statistics in the run output every time. A revert rate near 100% means the run proved nothing; set `fail_on_revert = true` to surface it while building the handler.

## Before deploy

- [ ] No test asserts the implementation back to itself.
- [ ] Every owner-settable number feeding value math is fuzzed across its domain, both sides of each bound included.
- [ ] Every external integration and quirky token is exercised on a pinned fork against the real deployment, on an endpoint confirmed to serve that block.
- [ ] Stateful contracts have a handler-driven invariant tying accounting to custody, with a revert rate low enough that the sequences reached real states.
- [ ] Access control, zero, and max-value cases revert as intended.

codex
The key mismatch is USDT’s empty return data: `safeTransferFrom` tolerates it, while the direct `IERC20.approve` call ABI-decodes it as a `bool` and reverts before Aave is reached. I’m capturing the robust allowance fix (`forceApprove`) and a pinned-mainnet-fork regression test.
apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152609Z-codex-with-skill-3/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..5eff45485bf9f1ef46c78abfd06566ec44a46fee
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The revert is caused by the direct `approve` call, not by Aave:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` that `IERC20.approve` declares. Solidity therefore makes the call and then tries to ABI-decode an empty return value as a Boolean. That decoding fails, producing a revert with no useful reason string. Execution never reaches `aavePool.supply`.
+
+The OpenZeppelin mock cannot reproduce this because a stock `ERC20` implements the modern interface and returns `true` from `approve`. Its behavior agrees with the assumption encoded by `IERC20`, whereas deployed USDT's behavior does not. The fact that both tokens use six decimals is irrelevant to this failure.
+
+`using SafeERC20 for IERC20` does not automatically intercept every ERC-20 method. It only makes SafeERC20's explicitly named extension functions available on an `IERC20`. Thus:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+uses SafeERC20's low-level optional-return handling and accepts USDT's empty return data, which is why the first line succeeds. By contrast, `usdt.approve(...)` still calls the `IERC20` method directly and receives none of SafeERC20's protection.
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
+`forceApprove` is the robust choice in OpenZeppelin versions that provide it. It handles tokens with no return value and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. With an older OpenZeppelin release, the equivalent compatibility sequence is to use SafeERC20 operations to set the allowance to zero and then to `amount`; a raw `approve` should not be used. Upgrading to a version with `forceApprove` is preferable.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that deploys the vault locally but configures it with the real mainnet USDT and Aave V3 Pool addresses. Give an actor real USDT state on the fork, approve the vault, execute a deposit, and assert the resulting vault/Aave position. Pin the fork to an explicit block and ensure the RPC endpoint serves historical state for that block.
+
+Keep mocks for fast unit tests, but do not use them as evidence that an external integration is compatible. A mock is an executable version of the team's assumptions: this mock always returns a standards-compliant Boolean, so a thousand additional tests against it would exercise the same incorrect assumption a thousand times. Only a fork test against the deployed bytecode would expose USDT's actual return-data behavior (and would also exercise Aave's real integration behavior).

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..5eff45485bf9f1ef46c78abfd06566ec44a46fee
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The revert is caused by the direct `approve` call, not by Aave:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` that `IERC20.approve` declares. Solidity therefore makes the call and then tries to ABI-decode an empty return value as a Boolean. That decoding fails, producing a revert with no useful reason string. Execution never reaches `aavePool.supply`.
+
+The OpenZeppelin mock cannot reproduce this because a stock `ERC20` implements the modern interface and returns `true` from `approve`. Its behavior agrees with the assumption encoded by `IERC20`, whereas deployed USDT's behavior does not. The fact that both tokens use six decimals is irrelevant to this failure.
+
+`using SafeERC20 for IERC20` does not automatically intercept every ERC-20 method. It only makes SafeERC20's explicitly named extension functions available on an `IERC20`. Thus:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+uses SafeERC20's low-level optional-return handling and accepts USDT's empty return data, which is why the first line succeeds. By contrast, `usdt.approve(...)` still calls the `IERC20` method directly and receives none of SafeERC20's protection.
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
+`forceApprove` is the robust choice in OpenZeppelin versions that provide it. It handles tokens with no return value and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. With an older OpenZeppelin release, the equivalent compatibility sequence is to use SafeERC20 operations to set the allowance to zero and then to `amount`; a raw `approve` should not be used. Upgrading to a version with `forceApprove` is preferable.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that deploys the vault locally but configures it with the real mainnet USDT and Aave V3 Pool addresses. Give an actor real USDT state on the fork, approve the vault, execute a deposit, and assert the resulting vault/Aave position. Pin the fork to an explicit block and ensure the RPC endpoint serves historical state for that block.
+
+Keep mocks for fast unit tests, but do not use them as evidence that an external integration is compatible. A mock is an executable version of the team's assumptions: this mock always returns a standards-compliant Boolean, so a thousand additional tests against it would exercise the same incorrect assumption a thousand times. Only a fork test against the deployed bytecode would expose USDT's actual return-data behavior (and would also exercise Aave's real integration behavior).

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152609Z-codex-with-skill-3/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Why the USDT deposit reverts

The revert is caused by the direct `approve` call, not by Aave:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` that `IERC20.approve` declares. Solidity therefore makes the call and then tries to ABI-decode an empty return value as a Boolean. That decoding fails, producing a revert with no useful reason string. Execution never reaches `aavePool.supply`.

The OpenZeppelin mock cannot reproduce this because a stock `ERC20` implements the modern interface and returns `true` from `approve`. Its behavior agrees with the assumption encoded by `IERC20`, whereas deployed USDT's behavior does not. The fact that both tokens use six decimals is irrelevant to this failure.

`using SafeERC20 for IERC20` does not automatically intercept every ERC-20 method. It only makes SafeERC20's explicitly named extension functions available on an `IERC20`. Thus:

```solidity
usdt.safeTransferFrom(...);
```

uses SafeERC20's low-level optional-return handling and accepts USDT's empty return data, which is why the first line succeeds. By contrast, `usdt.approve(...)` still calls the `IERC20` method directly and receives none of SafeERC20's protection.

## Code fix

Use SafeERC20 for the allowance operation as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the robust choice in OpenZeppelin versions that provide it. It handles tokens with no return value and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. With an older OpenZeppelin release, the equivalent compatibility sequence is to use SafeERC20 operations to set the allowance to zero and then to `amount`; a raw `approve` should not be used. Upgrading to a version with `forceApprove` is preferable.

## Testing-practice fix

Add a pinned mainnet-fork integration test that deploys the vault locally but configures it with the real mainnet USDT and Aave V3 Pool addresses. Give an actor real USDT state on the fork, approve the vault, execute a deposit, and assert the resulting vault/Aave position. Pin the fork to an explicit block and ensure the RPC endpoint serves historical state for that block.

Keep mocks for fast unit tests, but do not use them as evidence that an external integration is compatible. A mock is an executable version of the team's assumptions: this mock always returns a standards-compliant Boolean, so a thousand additional tests against it would exercise the same incorrect assumption a thousand times. Only a fork test against the deployed bytecode would expose USDT's actual return-data behavior (and would also exercise Aave's real integration behavior).

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..5eff45485bf9f1ef46c78abfd06566ec44a46fee
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The revert is caused by the direct `approve` call, not by Aave:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` that `IERC20.approve` declares. Solidity therefore makes the call and then tries to ABI-decode an empty return value as a Boolean. That decoding fails, producing a revert with no useful reason string. Execution never reaches `aavePool.supply`.
+
+The OpenZeppelin mock cannot reproduce this because a stock `ERC20` implements the modern interface and returns `true` from `approve`. Its behavior agrees with the assumption encoded by `IERC20`, whereas deployed USDT's behavior does not. The fact that both tokens use six decimals is irrelevant to this failure.
+
+`using SafeERC20 for IERC20` does not automatically intercept every ERC-20 method. It only makes SafeERC20's explicitly named extension functions available on an `IERC20`. Thus:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+uses SafeERC20's low-level optional-return handling and accepts USDT's empty return data, which is why the first line succeeds. By contrast, `usdt.approve(...)` still calls the `IERC20` method directly and receives none of SafeERC20's protection.
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
+`forceApprove` is the robust choice in OpenZeppelin versions that provide it. It handles tokens with no return value and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. With an older OpenZeppelin release, the equivalent compatibility sequence is to use SafeERC20 operations to set the allowance to zero and then to `amount`; a raw `approve` should not be used. Upgrading to a version with `forceApprove` is preferable.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that deploys the vault locally but configures it with the real mainnet USDT and Aave V3 Pool addresses. Give an actor real USDT state on the fork, approve the vault, execute a deposit, and assert the resulting vault/Aave position. Pin the fork to an explicit block and ensure the RPC endpoint serves historical state for that block.
+
+Keep mocks for fast unit tests, but do not use them as evidence that an external integration is compatible. A mock is an executable version of the team's assumptions: this mock always returns a standards-compliant Boolean, so a thousand additional tests against it would exercise the same incorrect assumption a thousand times. Only a fork test against the deployed bytecode would expose USDT's actual return-data behavior (and would also exercise Aave's real integration behavior).

codex
Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152609Z-codex-with-skill-3/testing-quiz-003/answer.md) with the USDT return-data diagnosis, `forceApprove` code fix, and pinned mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..5eff45485bf9f1ef46c78abfd06566ec44a46fee
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+The revert is caused by the direct `approve` call, not by Aave:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` that `IERC20.approve` declares. Solidity therefore makes the call and then tries to ABI-decode an empty return value as a Boolean. That decoding fails, producing a revert with no useful reason string. Execution never reaches `aavePool.supply`.
+
+The OpenZeppelin mock cannot reproduce this because a stock `ERC20` implements the modern interface and returns `true` from `approve`. Its behavior agrees with the assumption encoded by `IERC20`, whereas deployed USDT's behavior does not. The fact that both tokens use six decimals is irrelevant to this failure.
+
+`using SafeERC20 for IERC20` does not automatically intercept every ERC-20 method. It only makes SafeERC20's explicitly named extension functions available on an `IERC20`. Thus:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+uses SafeERC20's low-level optional-return handling and accepts USDT's empty return data, which is why the first line succeeds. By contrast, `usdt.approve(...)` still calls the `IERC20` method directly and receives none of SafeERC20's protection.
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
+`forceApprove` is the robust choice in OpenZeppelin versions that provide it. It handles tokens with no return value and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. With an older OpenZeppelin release, the equivalent compatibility sequence is to use SafeERC20 operations to set the allowance to zero and then to `amount`; a raw `approve` should not be used. Upgrading to a version with `forceApprove` is preferable.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that deploys the vault locally but configures it with the real mainnet USDT and Aave V3 Pool addresses. Give an actor real USDT state on the fork, approve the vault, execute a deposit, and assert the resulting vault/Aave position. Pin the fork to an explicit block and ensure the RPC endpoint serves historical state for that block.
+
+Keep mocks for fast unit tests, but do not use them as evidence that an external integration is compatible. A mock is an executable version of the team's assumptions: this mock always returns a standards-compliant Boolean, so a thousand additional tests against it would exercise the same incorrect assumption a thousand times. Only a fork test against the deployed bytecode would expose USDT's actual return-data behavior (and would also exercise Aave's real integration behavior).

tokens used
13,292
````

## final message

Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152609Z-codex-with-skill-3/testing-quiz-003/answer.md) with the USDT return-data diagnosis, `forceApprove` code fix, and pinned mainnet-fork testing recommendation.

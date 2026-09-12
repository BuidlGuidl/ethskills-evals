# Executor transcript — 2026-09-12T011120Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-2/testing-quiz-003

## session

````text
2026-09-12T01:11:39.246557Z  WARN codex_app_server::skills_watcher: failed to initialize skills file watcher: No file descriptors available (os error 24)
2026-09-12T01:11:39.246947Z  WARN codex_app_server::fs_watch: filesystem watch manager falling back to noop core watcher: No file descriptors available (os error 24)
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-2/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 01a0932b-9202-7830-bd5b-5606acb046f4
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
I’m using the Foundry testing skill because this is specifically about what green mock tests establish—and what fork testing would have caught. I’ll inspect its guidance, then write the diagnosis and fixes to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-2/testing-quiz-003
 succeeded in 21ms:
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
The key mismatch is confirmed: the mock returns a standards-shaped `bool` from `approve`, while mainnet USDT’s legacy implementation returns no data. The `using` directive does not intercept a direct `.approve(...)` call; only the explicitly selected SafeERC20 wrapper gets optional-return handling.
apply patch
patch: completed
/tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-2/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2672ed31186ea2182ae325a395b744066c1cad1f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+Mainnet USDT is not a fully conforming `IERC20`. In particular, its legacy `approve` implementation succeeds without returning the `bool` value required by the ERC-20 interface.
+
+The direct call
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+is compiled from the declared type, `IERC20`, so Solidity expects and ABI-decodes a 32-byte Boolean return value. Real USDT returns zero bytes. The token call itself may have completed, but the caller then fails while decoding the empty return data, producing the observed revert without a reason string.
+
+The preceding `safeTransferFrom` succeeds for exactly the same non-standard behavior because that call actually goes through `SafeERC20`. `SafeERC20` makes a low-level call and treats empty return data as success; if return data is present, it requires it to decode to `true`.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available on an `IERC20` value. It does not replace or intercept the interface's own methods. Thus `usdt.safeTransferFrom(...)` is protected, while `usdt.approve(...)` is still a raw high-level `IERC20` call.
+
+The OpenZeppelin `MockERC20` follows the standard interface and returns `true` from `approve`, so it cannot reproduce this failure. A mock is an executable version of the assumptions made about the dependency. Adding more tests against the same standards-compliant mock merely exercises more inputs against the same incorrect assumption; it cannot discover behavior the mock does not implement.
+
+## Code fix
+
+With a current OpenZeppelin SafeERC20 version, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` both tolerates tokens that return no value and supports USDT-style approval semantics that may require resetting a nonzero allowance to zero before assigning another nonzero value. This is safer than merely replacing the line with a raw zero-then-nonzero pair, because raw `approve` calls would still have the empty-return decoding problem.
+
+For an older OpenZeppelin release that predates `forceApprove`, use that release's SafeERC20 approval helper (or perform the zero-then-value approvals through SafeERC20's optional-return low-level-call logic), and account for USDT's zero-reset rule. Upgrading to a compatible release and using `forceApprove` is the clearest fix.
+
+## Testing-practice fix
+
+Keep the mock unit tests for fast testing of vault logic, but add a pinned Ethereum-mainnet fork integration test that uses the real USDT contract and the real Aave V3 pool. Fund a test actor with USDT on the fork, approve the vault, execute a deposit, and assert the resulting Aave position/vault accounting.
+
+That test crosses the actual ABI boundary and therefore reproduces USDT's empty return data and approval behavior. Pinning the fork block makes the test deterministic; the RPC endpoint must support historical state at that block. External protocol integrations and known non-standard tokens require this kind of fork test before deployment—green mock tests alone are not deployment evidence for compatibility with the deployed contracts.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2672ed31186ea2182ae325a395b744066c1cad1f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+Mainnet USDT is not a fully conforming `IERC20`. In particular, its legacy `approve` implementation succeeds without returning the `bool` value required by the ERC-20 interface.
+
+The direct call
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+is compiled from the declared type, `IERC20`, so Solidity expects and ABI-decodes a 32-byte Boolean return value. Real USDT returns zero bytes. The token call itself may have completed, but the caller then fails while decoding the empty return data, producing the observed revert without a reason string.
+
+The preceding `safeTransferFrom` succeeds for exactly the same non-standard behavior because that call actually goes through `SafeERC20`. `SafeERC20` makes a low-level call and treats empty return data as success; if return data is present, it requires it to decode to `true`.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available on an `IERC20` value. It does not replace or intercept the interface's own methods. Thus `usdt.safeTransferFrom(...)` is protected, while `usdt.approve(...)` is still a raw high-level `IERC20` call.
+
+The OpenZeppelin `MockERC20` follows the standard interface and returns `true` from `approve`, so it cannot reproduce this failure. A mock is an executable version of the assumptions made about the dependency. Adding more tests against the same standards-compliant mock merely exercises more inputs against the same incorrect assumption; it cannot discover behavior the mock does not implement.
+
+## Code fix
+
+With a current OpenZeppelin SafeERC20 version, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` both tolerates tokens that return no value and supports USDT-style approval semantics that may require resetting a nonzero allowance to zero before assigning another nonzero value. This is safer than merely replacing the line with a raw zero-then-nonzero pair, because raw `approve` calls would still have the empty-return decoding problem.
+
+For an older OpenZeppelin release that predates `forceApprove`, use that release's SafeERC20 approval helper (or perform the zero-then-value approvals through SafeERC20's optional-return low-level-call logic), and account for USDT's zero-reset rule. Upgrading to a compatible release and using `forceApprove` is the clearest fix.
+
+## Testing-practice fix
+
+Keep the mock unit tests for fast testing of vault logic, but add a pinned Ethereum-mainnet fork integration test that uses the real USDT contract and the real Aave V3 pool. Fund a test actor with USDT on the fork, approve the vault, execute a deposit, and assert the resulting Aave position/vault accounting.
+
+That test crosses the actual ABI boundary and therefore reproduces USDT's empty return data and approval behavior. Pinning the fork block makes the test deterministic; the RPC endpoint must support historical state at that block. External protocol integrations and known non-standard tokens require this kind of fork test before deployment—green mock tests alone are not deployment evidence for compatibility with the deployed contracts.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git diff --check -- answer.md" in /tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-2/testing-quiz-003
 succeeded in 9ms:
# Why the USDT deposit reverts

Mainnet USDT is not a fully conforming `IERC20`. In particular, its legacy `approve` implementation succeeds without returning the `bool` value required by the ERC-20 interface.

The direct call

```solidity
usdt.approve(address(aavePool), amount);
```

is compiled from the declared type, `IERC20`, so Solidity expects and ABI-decodes a 32-byte Boolean return value. Real USDT returns zero bytes. The token call itself may have completed, but the caller then fails while decoding the empty return data, producing the observed revert without a reason string.

The preceding `safeTransferFrom` succeeds for exactly the same non-standard behavior because that call actually goes through `SafeERC20`. `SafeERC20` makes a low-level call and treats empty return data as success; if return data is present, it requires it to decode to `true`.

`using SafeERC20 for IERC20` only makes the library's extension methods available on an `IERC20` value. It does not replace or intercept the interface's own methods. Thus `usdt.safeTransferFrom(...)` is protected, while `usdt.approve(...)` is still a raw high-level `IERC20` call.

The OpenZeppelin `MockERC20` follows the standard interface and returns `true` from `approve`, so it cannot reproduce this failure. A mock is an executable version of the assumptions made about the dependency. Adding more tests against the same standards-compliant mock merely exercises more inputs against the same incorrect assumption; it cannot discover behavior the mock does not implement.

## Code fix

With a current OpenZeppelin SafeERC20 version, use `forceApprove`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` both tolerates tokens that return no value and supports USDT-style approval semantics that may require resetting a nonzero allowance to zero before assigning another nonzero value. This is safer than merely replacing the line with a raw zero-then-nonzero pair, because raw `approve` calls would still have the empty-return decoding problem.

For an older OpenZeppelin release that predates `forceApprove`, use that release's SafeERC20 approval helper (or perform the zero-then-value approvals through SafeERC20's optional-return low-level-call logic), and account for USDT's zero-reset rule. Upgrading to a compatible release and using `forceApprove` is the clearest fix.

## Testing-practice fix

Keep the mock unit tests for fast testing of vault logic, but add a pinned Ethereum-mainnet fork integration test that uses the real USDT contract and the real Aave V3 pool. Fund a test actor with USDT on the fork, approve the vault, execute a deposit, and assert the resulting Aave position/vault accounting.

That test crosses the actual ABI boundary and therefore reproduces USDT's empty return data and approval behavior. Pinning the fork block makes the test deterministic; the RPC endpoint must support historical state at that block. External protocol integrations and known non-standard tokens require this kind of fork test before deployment—green mock tests alone are not deployment evidence for compatibility with the deployed contracts.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2672ed31186ea2182ae325a395b744066c1cad1f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+Mainnet USDT is not a fully conforming `IERC20`. In particular, its legacy `approve` implementation succeeds without returning the `bool` value required by the ERC-20 interface.
+
+The direct call
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+is compiled from the declared type, `IERC20`, so Solidity expects and ABI-decodes a 32-byte Boolean return value. Real USDT returns zero bytes. The token call itself may have completed, but the caller then fails while decoding the empty return data, producing the observed revert without a reason string.
+
+The preceding `safeTransferFrom` succeeds for exactly the same non-standard behavior because that call actually goes through `SafeERC20`. `SafeERC20` makes a low-level call and treats empty return data as success; if return data is present, it requires it to decode to `true`.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available on an `IERC20` value. It does not replace or intercept the interface's own methods. Thus `usdt.safeTransferFrom(...)` is protected, while `usdt.approve(...)` is still a raw high-level `IERC20` call.
+
+The OpenZeppelin `MockERC20` follows the standard interface and returns `true` from `approve`, so it cannot reproduce this failure. A mock is an executable version of the assumptions made about the dependency. Adding more tests against the same standards-compliant mock merely exercises more inputs against the same incorrect assumption; it cannot discover behavior the mock does not implement.
+
+## Code fix
+
+With a current OpenZeppelin SafeERC20 version, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` both tolerates tokens that return no value and supports USDT-style approval semantics that may require resetting a nonzero allowance to zero before assigning another nonzero value. This is safer than merely replacing the line with a raw zero-then-nonzero pair, because raw `approve` calls would still have the empty-return decoding problem.
+
+For an older OpenZeppelin release that predates `forceApprove`, use that release's SafeERC20 approval helper (or perform the zero-then-value approvals through SafeERC20's optional-return low-level-call logic), and account for USDT's zero-reset rule. Upgrading to a compatible release and using `forceApprove` is the clearest fix.
+
+## Testing-practice fix
+
+Keep the mock unit tests for fast testing of vault logic, but add a pinned Ethereum-mainnet fork integration test that uses the real USDT contract and the real Aave V3 pool. Fund a test actor with USDT on the fork, approve the vault, execute a deposit, and assert the resulting Aave position/vault accounting.
+
+That test crosses the actual ABI boundary and therefore reproduces USDT's empty return data and approval behavior. Pinning the fork block makes the test deterministic; the RPC endpoint must support historical state at that block. External protocol integrations and known non-standard tokens require this kind of fork test before deployment—green mock tests alone are not deployment evidence for compatibility with the deployed contracts.

codex
Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-2/testing-quiz-003/answer.md) with the diagnosis, `forceApprove` code fix, and pinned mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2672ed31186ea2182ae325a395b744066c1cad1f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Why the USDT deposit reverts
+
+Mainnet USDT is not a fully conforming `IERC20`. In particular, its legacy `approve` implementation succeeds without returning the `bool` value required by the ERC-20 interface.
+
+The direct call
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+is compiled from the declared type, `IERC20`, so Solidity expects and ABI-decodes a 32-byte Boolean return value. Real USDT returns zero bytes. The token call itself may have completed, but the caller then fails while decoding the empty return data, producing the observed revert without a reason string.
+
+The preceding `safeTransferFrom` succeeds for exactly the same non-standard behavior because that call actually goes through `SafeERC20`. `SafeERC20` makes a low-level call and treats empty return data as success; if return data is present, it requires it to decode to `true`.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available on an `IERC20` value. It does not replace or intercept the interface's own methods. Thus `usdt.safeTransferFrom(...)` is protected, while `usdt.approve(...)` is still a raw high-level `IERC20` call.
+
+The OpenZeppelin `MockERC20` follows the standard interface and returns `true` from `approve`, so it cannot reproduce this failure. A mock is an executable version of the assumptions made about the dependency. Adding more tests against the same standards-compliant mock merely exercises more inputs against the same incorrect assumption; it cannot discover behavior the mock does not implement.
+
+## Code fix
+
+With a current OpenZeppelin SafeERC20 version, use `forceApprove`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` both tolerates tokens that return no value and supports USDT-style approval semantics that may require resetting a nonzero allowance to zero before assigning another nonzero value. This is safer than merely replacing the line with a raw zero-then-nonzero pair, because raw `approve` calls would still have the empty-return decoding problem.
+
+For an older OpenZeppelin release that predates `forceApprove`, use that release's SafeERC20 approval helper (or perform the zero-then-value approvals through SafeERC20's optional-return low-level-call logic), and account for USDT's zero-reset rule. Upgrading to a compatible release and using `forceApprove` is the clearest fix.
+
+## Testing-practice fix
+
+Keep the mock unit tests for fast testing of vault logic, but add a pinned Ethereum-mainnet fork integration test that uses the real USDT contract and the real Aave V3 pool. Fund a test actor with USDT on the fork, approve the vault, execute a deposit, and assert the resulting Aave position/vault accounting.
+
+That test crosses the actual ABI boundary and therefore reproduces USDT's empty return data and approval behavior. Pinning the fork block makes the test deterministic; the RPC endpoint must support historical state at that block. External protocol integrations and known non-standard tokens require this kind of fork test before deployment—green mock tests alone are not deployment evidence for compatibility with the deployed contracts.

tokens used
9,751
````

## final message

Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-12T011120Z-codex-with-skill-2/testing-quiz-003/answer.md) with the diagnosis, `forceApprove` code fix, and pinned mainnet-fork testing recommendation.

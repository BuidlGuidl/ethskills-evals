# Executor transcript — 2026-09-14T192833Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192833Z-codex-with-skill-2/testing-quiz-003

## session

````text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192833Z-codex-with-skill-2/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a166-cb00-7252-8236-da04a3e1431d
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
I’m using the Foundry testing skill because this is specifically about why a green mock-based suite failed to establish mainnet compatibility and what testing practice closes that gap.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192833Z-codex-with-skill-2/testing-quiz-003
 succeeded in 4ms:
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

First decide which values at a boundary are semantically usable; do not assume the exact limit is valid merely because only values beyond it violate a numeric inequality. Exercise the nearest valid value, the exact limit, and the first value beyond it where representable. Preserve separate evidence when the exact limit and the value beyond it fail through different paths.

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

One post-operation mismatch proves divergence, not accumulation. When claiming cumulative drift, show the gap after at least two operations capable of creating that drift — for example, two fee-bearing withdrawals, not setup followed by one withdrawal — or provide a stateful-invariant counterexample whose call sequence demonstrates the growth.

Point `targetContract` at a handler, never at the contract under test. Called directly, the fuzzer supplies random senders that hold no tokens and granted no approvals, so nearly every call reverts. Reverts are discarded rather than failing the run, and the invariant is then asserted against a contract that never left its initial state — green because nothing happened.

The handler owns setup: funded and approved actors, inputs bounded to valid ranges, multiple actors where the property is about interaction between them.

Read the calls/reverts statistics in the run output every time. A revert rate near 100% means the run proved nothing; set `fail_on_revert = true` to surface it while building the handler.

## Before deploy

- [ ] No test asserts the implementation back to itself.
- [ ] Every owner-settable number feeding value math is fuzzed across its domain; each boundary's nearest valid value, exact limit, and first value beyond it are classified and exercised separately where representable.
- [ ] Every external integration and quirky token is exercised on a pinned fork against the real deployment, on an endpoint confirmed to serve that block.
- [ ] Stateful contracts have a handler-driven invariant tying accounting to custody, with a revert rate low enough that the sequences reached real states.
- [ ] Access control, zero, and max-value cases revert as intended.
- [ ] `slither .` run, with no high or medium finding left unaddressed.

codex
The key distinction is confirmed: `using SafeERC20` does not rewrite ordinary interface calls. The transfer is wrapped, but `approve` is a direct ABI-decoded call to a token that does not return the standard Boolean value. I’m writing the answer with the robust allowance fix and the pre-deployment fork-test requirement.
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192833Z-codex-with-skill-2/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..63901b1e3173558e33692dfe7ac366e59890d63a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,72 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is not a fully standard ERC-20 implementation. In particular, its
+`approve` function does not return the `bool` that `IERC20.approve` declares.
+Solidity therefore makes the external call, receives empty return data, and then
+tries to ABI-decode that data as a Boolean. The decode fails and the caller
+reverts, commonly with no useful reason string.
+
+The OpenZeppelin mock cannot reproduce this behavior. A stock OpenZeppelin
+`ERC20` implements the standard ABI and returns `true` from `approve`, so the
+same direct call always has return data that can be decoded successfully. The
+fact that both tokens use six decimals is irrelevant to this failure.
+
+`SafeERC20` protects only calls made through its wrapper functions. This line is
+wrapped:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success,
+which accommodates USDT. Merely declaring `using SafeERC20 for IERC20` does not
+change or intercept `usdt.approve(...)`; that expression still calls the
+`IERC20` function directly and Solidity still attempts to decode a `bool`.
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
+`forceApprove` is the robust choice for USDT. It accepts tokens that return no
+value and, when necessary, retries by first setting the allowance to zero. That
+also handles USDT's other well-known constraint: changing a nonzero allowance
+directly to another nonzero allowance can fail. It is preferable to ignoring the
+return value from a raw `approve`, because the revert here occurs while decoding
+the return data, before Solidity can discard the returned expression.
+
+If the installed OpenZeppelin version predates `forceApprove`, upgrade it. An
+equivalent compatibility helper must use low-level optional-return calls and
+perform the zero-then-set fallback; a plain `approve` is not equivalent.
+
+## Testing-practice fix
+
+Add a pinned-mainnet-fork integration test that uses the actual deployed USDT
+and Aave V3 contracts and executes the complete deposit path. For example, fork
+a fixed block with `vm.createSelectFork`, give a test actor real USDT state (for
+example by impersonating a funded holder and transferring tokens), approve the
+vault, deposit, and assert that the Aave supply succeeds and the vault receives
+the expected aToken/accounting result. The RPC endpoint must support historical
+state at the pinned block.
+
+Keep the mock unit tests for local logic, but do not use them as evidence of
+external-integration compatibility. A mock is an executable version of the
+assumptions made by its author. Here it assumes standards-compliant Boolean
+returns, while deployed USDT violates that assumption. Adding 39, 390, or any
+number of tests against the same stock mock only exercises more inputs through
+the same incorrect ABI behavior; it cannot discover behavior that the mock does
+not implement. A test using a specially written non-returning token could serve
+as a regression test after this defect is known, but the pre-deployment search
+that would have exposed the unknown mismatch is a pinned fork against the real
+token and protocol.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..63901b1e3173558e33692dfe7ac366e59890d63a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,72 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is not a fully standard ERC-20 implementation. In particular, its
+`approve` function does not return the `bool` that `IERC20.approve` declares.
+Solidity therefore makes the external call, receives empty return data, and then
+tries to ABI-decode that data as a Boolean. The decode fails and the caller
+reverts, commonly with no useful reason string.
+
+The OpenZeppelin mock cannot reproduce this behavior. A stock OpenZeppelin
+`ERC20` implements the standard ABI and returns `true` from `approve`, so the
+same direct call always has return data that can be decoded successfully. The
+fact that both tokens use six decimals is irrelevant to this failure.
+
+`SafeERC20` protects only calls made through its wrapper functions. This line is
+wrapped:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success,
+which accommodates USDT. Merely declaring `using SafeERC20 for IERC20` does not
+change or intercept `usdt.approve(...)`; that expression still calls the
+`IERC20` function directly and Solidity still attempts to decode a `bool`.
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
+`forceApprove` is the robust choice for USDT. It accepts tokens that return no
+value and, when necessary, retries by first setting the allowance to zero. That
+also handles USDT's other well-known constraint: changing a nonzero allowance
+directly to another nonzero allowance can fail. It is preferable to ignoring the
+return value from a raw `approve`, because the revert here occurs while decoding
+the return data, before Solidity can discard the returned expression.
+
+If the installed OpenZeppelin version predates `forceApprove`, upgrade it. An
+equivalent compatibility helper must use low-level optional-return calls and
+perform the zero-then-set fallback; a plain `approve` is not equivalent.
+
+## Testing-practice fix
+
+Add a pinned-mainnet-fork integration test that uses the actual deployed USDT
+and Aave V3 contracts and executes the complete deposit path. For example, fork
+a fixed block with `vm.createSelectFork`, give a test actor real USDT state (for
+example by impersonating a funded holder and transferring tokens), approve the
+vault, deposit, and assert that the Aave supply succeeds and the vault receives
+the expected aToken/accounting result. The RPC endpoint must support historical
+state at the pinned block.
+
+Keep the mock unit tests for local logic, but do not use them as evidence of
+external-integration compatibility. A mock is an executable version of the
+assumptions made by its author. Here it assumes standards-compliant Boolean
+returns, while deployed USDT violates that assumption. Adding 39, 390, or any
+number of tests against the same stock mock only exercises more inputs through
+the same incorrect ABI behavior; it cannot discover behavior that the mock does
+not implement. A test using a specially written non-returning token could serve
+as a regression test after this defect is known, but the pre-deployment search
+that would have exposed the unknown mismatch is a pinned fork against the real
+token and protocol.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git diff --check -- answer.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192833Z-codex-with-skill-2/testing-quiz-003
 succeeded in 2ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..63901b1e3173558e33692dfe7ac366e59890d63a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,72 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is not a fully standard ERC-20 implementation. In particular, its
+`approve` function does not return the `bool` that `IERC20.approve` declares.
+Solidity therefore makes the external call, receives empty return data, and then
+tries to ABI-decode that data as a Boolean. The decode fails and the caller
+reverts, commonly with no useful reason string.
+
+The OpenZeppelin mock cannot reproduce this behavior. A stock OpenZeppelin
+`ERC20` implements the standard ABI and returns `true` from `approve`, so the
+same direct call always has return data that can be decoded successfully. The
+fact that both tokens use six decimals is irrelevant to this failure.
+
+`SafeERC20` protects only calls made through its wrapper functions. This line is
+wrapped:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success,
+which accommodates USDT. Merely declaring `using SafeERC20 for IERC20` does not
+change or intercept `usdt.approve(...)`; that expression still calls the
+`IERC20` function directly and Solidity still attempts to decode a `bool`.
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
+`forceApprove` is the robust choice for USDT. It accepts tokens that return no
+value and, when necessary, retries by first setting the allowance to zero. That
+also handles USDT's other well-known constraint: changing a nonzero allowance
+directly to another nonzero allowance can fail. It is preferable to ignoring the
+return value from a raw `approve`, because the revert here occurs while decoding
+the return data, before Solidity can discard the returned expression.
+
+If the installed OpenZeppelin version predates `forceApprove`, upgrade it. An
+equivalent compatibility helper must use low-level optional-return calls and
+perform the zero-then-set fallback; a plain `approve` is not equivalent.
+
+## Testing-practice fix
+
+Add a pinned-mainnet-fork integration test that uses the actual deployed USDT
+and Aave V3 contracts and executes the complete deposit path. For example, fork
+a fixed block with `vm.createSelectFork`, give a test actor real USDT state (for
+example by impersonating a funded holder and transferring tokens), approve the
+vault, deposit, and assert that the Aave supply succeeds and the vault receives
+the expected aToken/accounting result. The RPC endpoint must support historical
+state at the pinned block.
+
+Keep the mock unit tests for local logic, but do not use them as evidence of
+external-integration compatibility. A mock is an executable version of the
+assumptions made by its author. Here it assumes standards-compliant Boolean
+returns, while deployed USDT violates that assumption. Adding 39, 390, or any
+number of tests against the same stock mock only exercises more inputs through
+the same incorrect ABI behavior; it cannot discover behavior that the mock does
+not implement. A test using a specially written non-returning token could serve
+as a regression test after this defect is known, but the pre-deployment search
+that would have exposed the unknown mismatch is a pinned fork against the real
+token and protocol.

codex
Created [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192833Z-codex-with-skill-2/testing-quiz-003/answer.md) explaining:

- USDT’s non-standard missing Boolean return from `approve`
- Why `SafeERC20` protected `safeTransferFrom` but not direct `approve`
- Why standards-compliant mocks cannot expose the mismatch
- The `forceApprove` code fix
- The pinned-mainnet-fork testing practice needed before deployment
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..63901b1e3173558e33692dfe7ac366e59890d63a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,72 @@
+# Why the USDT deposit reverts
+
+The failing call is the direct approval:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is not a fully standard ERC-20 implementation. In particular, its
+`approve` function does not return the `bool` that `IERC20.approve` declares.
+Solidity therefore makes the external call, receives empty return data, and then
+tries to ABI-decode that data as a Boolean. The decode fails and the caller
+reverts, commonly with no useful reason string.
+
+The OpenZeppelin mock cannot reproduce this behavior. A stock OpenZeppelin
+`ERC20` implements the standard ABI and returns `true` from `approve`, so the
+same direct call always has return data that can be decoded successfully. The
+fact that both tokens use six decimals is irrelevant to this failure.
+
+`SafeERC20` protects only calls made through its wrapper functions. This line is
+wrapped:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success,
+which accommodates USDT. Merely declaring `using SafeERC20 for IERC20` does not
+change or intercept `usdt.approve(...)`; that expression still calls the
+`IERC20` function directly and Solidity still attempts to decode a `bool`.
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
+`forceApprove` is the robust choice for USDT. It accepts tokens that return no
+value and, when necessary, retries by first setting the allowance to zero. That
+also handles USDT's other well-known constraint: changing a nonzero allowance
+directly to another nonzero allowance can fail. It is preferable to ignoring the
+return value from a raw `approve`, because the revert here occurs while decoding
+the return data, before Solidity can discard the returned expression.
+
+If the installed OpenZeppelin version predates `forceApprove`, upgrade it. An
+equivalent compatibility helper must use low-level optional-return calls and
+perform the zero-then-set fallback; a plain `approve` is not equivalent.
+
+## Testing-practice fix
+
+Add a pinned-mainnet-fork integration test that uses the actual deployed USDT
+and Aave V3 contracts and executes the complete deposit path. For example, fork
+a fixed block with `vm.createSelectFork`, give a test actor real USDT state (for
+example by impersonating a funded holder and transferring tokens), approve the
+vault, deposit, and assert that the Aave supply succeeds and the vault receives
+the expected aToken/accounting result. The RPC endpoint must support historical
+state at the pinned block.
+
+Keep the mock unit tests for local logic, but do not use them as evidence of
+external-integration compatibility. A mock is an executable version of the
+assumptions made by its author. Here it assumes standards-compliant Boolean
+returns, while deployed USDT violates that assumption. Adding 39, 390, or any
+number of tests against the same stock mock only exercises more inputs through
+the same incorrect ABI behavior; it cannot discover behavior that the mock does
+not implement. A test using a specially written non-returning token could serve
+as a regression test after this defect is known, but the pre-deployment search
+that would have exposed the unknown mismatch is a pinned fork against the real
+token and protocol.

tokens used
9,887
````

## final message

Created [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192833Z-codex-with-skill-2/testing-quiz-003/answer.md) explaining:

- USDT’s non-standard missing Boolean return from `approve`
- Why `SafeERC20` protected `safeTransferFrom` but not direct `approve`
- Why standards-compliant mocks cannot expose the mismatch
- The `forceApprove` code fix
- The pinned-mainnet-fork testing practice needed before deployment

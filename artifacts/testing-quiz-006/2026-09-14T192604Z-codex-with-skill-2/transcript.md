# Executor transcript — 2026-09-14T192604Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192604Z-codex-with-skill-2/testing-quiz-006

## session

```text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192604Z-codex-with-skill-2/testing-quiz-006
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a162-98fd-7d13-b96d-15781b50a2df
--------
user
Write your answer to answer.md.

I am reviewing the test plan for a new onchain credit pool before deployment. The
current unit suite is green and covers every line, but it only uses local mocks and
one-operation examples. The implementation has these three independent surfaces:

1. Governance can set `reserveFactorWad`. A redemption computes
   `net = assets * (1e18 - reserveFactorWad) / 1e18` and then reverts when `net == 0`.
   The setter currently accepts any uint256. Existing tests cover 0 and 0.2e18.
2. Each repayment retains a protocol cut in the pool while the internal
   `accountedAssets` value is reduced by the gross repayment. The test plan shows one
   deposit followed by one repayment, observes a mismatch, and calls that proof that
   the mismatch accumulates.
3. Liquidation reads a Chainlink feed and transfers the deployed collateral token.
   Both are represented by standard-behaviour mocks. The production addresses are
   known, but no test has called them.

Tell me whether this is enough to sign off. For each surface, specify the search or
experiment you would require and the evidence that would make it meaningful. Be
precise about the limit cases for the governance value, what would actually
demonstrate accumulation, and how the production integrations should be exercised
reproducibly.

codex
I’m using the testing skill because this is a Foundry test-plan sufficiency review; I’ll follow its evidence standards and write the result directly to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192604Z-codex-with-skill-2/testing-quiz-006
 succeeded in 0ms:
codex
The decisive gaps are now clear: the suite has exercised examples, but none of the required searches—domain fuzzing, multi-step invariant exploration, or a pinned production fork. I’m capturing concrete pass/fail evidence for each rather than treating coverage as assurance.
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192604Z-codex-with-skill-2/testing-quiz-006/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..c38cf367b12000673090bcbf2b58fbc5f30adffa
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+# Sign-off decision
+
+No. A green, line-complete unit suite made only from standard-behaviour mocks and one-operation examples is not enough to sign off this pool. Coverage says that the selected examples executed the code; it does not show that the assertions searched the relevant input domain, that accounting survives operation sequences, or that the deployed dependencies behave like the mocks.
+
+## 1. `reserveFactorWad`: fuzz the accepted domain and classify the boundary
+
+The economic ratio must first have an explicit valid domain. For the formula shown, a redeemable reserve factor must be strictly less than `1e18`: at exactly `1e18`, every nonzero redemption computes `net == 0` and reverts; above `1e18`, `1e18 - reserveFactorWad` underflows under Solidity 0.8 checked arithmetic. Thus a setter that accepts every `uint256` admits unusable configurations. If governance intentionally permits a 100% reserve as an emergency mode, that needs a separately specified redemption behaviour; it is not a usable value under the current implementation.
+
+Require a property-based fuzz test that uses `bound()` to explore the whole intended setter domain, rather than filtering inconvenient values with `vm.assume()`. Exercise and classify these values explicitly:
+
+- `0`;
+- the nearest value below the ratio boundary, `1e18 - 1`;
+- the exact boundary, `1e18`;
+- the first value above it, `1e18 + 1`;
+- `type(uint256).max`;
+- redemption asset amounts at `0`, `1`, values around `1e18`, the protocol's real minimum/maximum, and arithmetic limits.
+
+`1e18 - 1` is mathematically inside the ratio domain but can still round `net` to zero for `assets < 1e18`; the test must decide whether such redemptions are meant to revert or whether a minimum amount/rounding rule is required. Large `assets` must also expose whether the multiplication overflows; if those values are reachable, use full-precision `mulDiv` or impose and test a justified cap.
+
+Meaningful evidence is:
+
+- unauthorized callers cannot set the value;
+- every value in the documented valid range can be set and preserves the specified redemption property;
+- monotonicity holds for a fixed redeemable amount: increasing the reserve factor never increases `net`;
+- results match an independent full-precision reference calculation, not a copy of the implementation expression;
+- the setter rejects `1e18` and all larger values if the valid domain is `< 1e18`, with separate regression cases for the exact limit and the first value beyond it because their current failures occur by different paths;
+- zero-output rounding and maximum-amount behaviour are explicitly specified and asserted.
+
+The two existing examples, `0` and `0.2e18`, establish none of those boundary guarantees.
+
+## 2. Repayment accounting: run a handler-driven stateful invariant
+
+One deposit followed by one repayment can prove a divergence at that point. It cannot prove that the divergence accumulates. Let the conservation relation be stated from the design—for example, if no separately tracked reserve exists, `accountedAssets == token.balanceOf(pool)`; if the protocol cut is a real reserve, include an independently tracked `protocolReserves` term in the equality. A one-sided assertion such as `accountedAssets <= balance` is insufficient because it stays green while assets become increasingly stranded.
+
+Require a Foundry invariant test whose `targetContract` is a handler. The handler should create funded, approved actors and make bounded, valid deposits, borrows, repayments (including fee-bearing repayments), and redemptions in varied orders. During development use `fail_on_revert = true`; in the final run inspect call and revert statistics to show that repayment and the other transitions were actually reached. Targeting the pool directly with unfunded random senders would mostly generate discarded reverts and a vacuous green result.
+
+Meaningful evidence of accumulation is either the invariant fuzzer's minimized counterexample or a deterministic regression with at least two drift-producing repayments. Record the gap from the correct conservation equation at baseline and after each repayment: `g0`, `g1`, and `g2`. It must show two nonzero increments—e.g. `g1 - g0 == cut1` and `g2 - g1 == cut2`, hence `g2 > g1 > g0` for positive cuts—not merely setup followed by one repayment. Repeat across repayment sizes, partial/full repayments, multiple borrowers, and rounding cases. The proper deployment criterion is then that the corrected accounting invariant holds after arbitrary successful sequences, or that any intended reserve is explicitly tracked and withdrawable under a tested rule.
+
+## 3. Chainlink and collateral token: execute liquidation on a pinned fork
+
+Standard mocks only confirm the assumptions encoded into those mocks. Require a fork test on the production chain at a fixed block number, after confirming that the chosen RPC endpoint can answer historical `eth_call` requests at that block. Record chain ID, block number, real feed address, real collateral-token address, and preferably their code hashes. An unpinned head is not reproducible; a pinned block on a non-archive endpoint is not runnable.
+
+On that fork, deploy the candidate pool implementation/configuration wired to the known production addresses (or exercise the exact deployment artifact), then drive a real liquidation path:
+
+- call the actual feed and validate the fields the pool relies on, including feed decimals, answer sign/range, timestamps/staleness policy, and round completeness;
+- obtain collateral reproducibly at the pinned state, such as by impersonating a documented funded holder, then make the real token transfers/approvals needed to create a liquidatable position;
+- move only local pool/user state as necessary to make the position liquidatable; do not replace either integration with a mock;
+- execute liquidation and assert actual token balance deltas for the pool, borrower, and liquidator, plus the accounting conservation relation—not just an emitted event or a successful return;
+- assert the liquidation calculation against an independent expected value derived from the real feed answer and decimals at that pinned block.
+
+If the pinned oracle state cannot naturally exercise a required branch, use additional pinned blocks with documented feed states, or separate logic tests for synthetic price branches; the compatibility claim still requires at least one end-to-end call against both real deployed contracts. The fork command, RPC environment-variable name, funded address/setup, and block number should live in the test or repository instructions so CI and reviewers can replay the same state.
+
+Until the domain fuzz test, handler invariant, and pinned-fork liquidation all produce this evidence—and their failures are resolved—the pool should not be approved for deployment.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..c38cf367b12000673090bcbf2b58fbc5f30adffa
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+# Sign-off decision
+
+No. A green, line-complete unit suite made only from standard-behaviour mocks and one-operation examples is not enough to sign off this pool. Coverage says that the selected examples executed the code; it does not show that the assertions searched the relevant input domain, that accounting survives operation sequences, or that the deployed dependencies behave like the mocks.
+
+## 1. `reserveFactorWad`: fuzz the accepted domain and classify the boundary
+
+The economic ratio must first have an explicit valid domain. For the formula shown, a redeemable reserve factor must be strictly less than `1e18`: at exactly `1e18`, every nonzero redemption computes `net == 0` and reverts; above `1e18`, `1e18 - reserveFactorWad` underflows under Solidity 0.8 checked arithmetic. Thus a setter that accepts every `uint256` admits unusable configurations. If governance intentionally permits a 100% reserve as an emergency mode, that needs a separately specified redemption behaviour; it is not a usable value under the current implementation.
+
+Require a property-based fuzz test that uses `bound()` to explore the whole intended setter domain, rather than filtering inconvenient values with `vm.assume()`. Exercise and classify these values explicitly:
+
+- `0`;
+- the nearest value below the ratio boundary, `1e18 - 1`;
+- the exact boundary, `1e18`;
+- the first value above it, `1e18 + 1`;
+- `type(uint256).max`;
+- redemption asset amounts at `0`, `1`, values around `1e18`, the protocol's real minimum/maximum, and arithmetic limits.
+
+`1e18 - 1` is mathematically inside the ratio domain but can still round `net` to zero for `assets < 1e18`; the test must decide whether such redemptions are meant to revert or whether a minimum amount/rounding rule is required. Large `assets` must also expose whether the multiplication overflows; if those values are reachable, use full-precision `mulDiv` or impose and test a justified cap.
+
+Meaningful evidence is:
+
+- unauthorized callers cannot set the value;
+- every value in the documented valid range can be set and preserves the specified redemption property;
+- monotonicity holds for a fixed redeemable amount: increasing the reserve factor never increases `net`;
+- results match an independent full-precision reference calculation, not a copy of the implementation expression;
+- the setter rejects `1e18` and all larger values if the valid domain is `< 1e18`, with separate regression cases for the exact limit and the first value beyond it because their current failures occur by different paths;
+- zero-output rounding and maximum-amount behaviour are explicitly specified and asserted.
+
+The two existing examples, `0` and `0.2e18`, establish none of those boundary guarantees.
+
+## 2. Repayment accounting: run a handler-driven stateful invariant
+
+One deposit followed by one repayment can prove a divergence at that point. It cannot prove that the divergence accumulates. Let the conservation relation be stated from the design—for example, if no separately tracked reserve exists, `accountedAssets == token.balanceOf(pool)`; if the protocol cut is a real reserve, include an independently tracked `protocolReserves` term in the equality. A one-sided assertion such as `accountedAssets <= balance` is insufficient because it stays green while assets become increasingly stranded.
+
+Require a Foundry invariant test whose `targetContract` is a handler. The handler should create funded, approved actors and make bounded, valid deposits, borrows, repayments (including fee-bearing repayments), and redemptions in varied orders. During development use `fail_on_revert = true`; in the final run inspect call and revert statistics to show that repayment and the other transitions were actually reached. Targeting the pool directly with unfunded random senders would mostly generate discarded reverts and a vacuous green result.
+
+Meaningful evidence of accumulation is either the invariant fuzzer's minimized counterexample or a deterministic regression with at least two drift-producing repayments. Record the gap from the correct conservation equation at baseline and after each repayment: `g0`, `g1`, and `g2`. It must show two nonzero increments—e.g. `g1 - g0 == cut1` and `g2 - g1 == cut2`, hence `g2 > g1 > g0` for positive cuts—not merely setup followed by one repayment. Repeat across repayment sizes, partial/full repayments, multiple borrowers, and rounding cases. The proper deployment criterion is then that the corrected accounting invariant holds after arbitrary successful sequences, or that any intended reserve is explicitly tracked and withdrawable under a tested rule.
+
+## 3. Chainlink and collateral token: execute liquidation on a pinned fork
+
+Standard mocks only confirm the assumptions encoded into those mocks. Require a fork test on the production chain at a fixed block number, after confirming that the chosen RPC endpoint can answer historical `eth_call` requests at that block. Record chain ID, block number, real feed address, real collateral-token address, and preferably their code hashes. An unpinned head is not reproducible; a pinned block on a non-archive endpoint is not runnable.
+
+On that fork, deploy the candidate pool implementation/configuration wired to the known production addresses (or exercise the exact deployment artifact), then drive a real liquidation path:
+
+- call the actual feed and validate the fields the pool relies on, including feed decimals, answer sign/range, timestamps/staleness policy, and round completeness;
+- obtain collateral reproducibly at the pinned state, such as by impersonating a documented funded holder, then make the real token transfers/approvals needed to create a liquidatable position;
+- move only local pool/user state as necessary to make the position liquidatable; do not replace either integration with a mock;
+- execute liquidation and assert actual token balance deltas for the pool, borrower, and liquidator, plus the accounting conservation relation—not just an emitted event or a successful return;
+- assert the liquidation calculation against an independent expected value derived from the real feed answer and decimals at that pinned block.
+
+If the pinned oracle state cannot naturally exercise a required branch, use additional pinned blocks with documented feed states, or separate logic tests for synthetic price branches; the compatibility claim still requires at least one end-to-end call against both real deployed contracts. The fork command, RPC environment-variable name, funded address/setup, and block number should live in the test or repository instructions so CI and reviewers can replay the same state.
+
+Until the domain fuzz test, handler invariant, and pinned-fork liquidation all produce this evidence—and their failures are resolved—the pool should not be approved for deployment.

exec
/bin/bash -lc "wc -l answer.md && sed -n '1,260p' answer.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192604Z-codex-with-skill-2/testing-quiz-006
 succeeded in 0ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..c38cf367b12000673090bcbf2b58fbc5f30adffa
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+# Sign-off decision
+
+No. A green, line-complete unit suite made only from standard-behaviour mocks and one-operation examples is not enough to sign off this pool. Coverage says that the selected examples executed the code; it does not show that the assertions searched the relevant input domain, that accounting survives operation sequences, or that the deployed dependencies behave like the mocks.
+
+## 1. `reserveFactorWad`: fuzz the accepted domain and classify the boundary
+
+The economic ratio must first have an explicit valid domain. For the formula shown, a redeemable reserve factor must be strictly less than `1e18`: at exactly `1e18`, every nonzero redemption computes `net == 0` and reverts; above `1e18`, `1e18 - reserveFactorWad` underflows under Solidity 0.8 checked arithmetic. Thus a setter that accepts every `uint256` admits unusable configurations. If governance intentionally permits a 100% reserve as an emergency mode, that needs a separately specified redemption behaviour; it is not a usable value under the current implementation.
+
+Require a property-based fuzz test that uses `bound()` to explore the whole intended setter domain, rather than filtering inconvenient values with `vm.assume()`. Exercise and classify these values explicitly:
+
+- `0`;
+- the nearest value below the ratio boundary, `1e18 - 1`;
+- the exact boundary, `1e18`;
+- the first value above it, `1e18 + 1`;
+- `type(uint256).max`;
+- redemption asset amounts at `0`, `1`, values around `1e18`, the protocol's real minimum/maximum, and arithmetic limits.
+
+`1e18 - 1` is mathematically inside the ratio domain but can still round `net` to zero for `assets < 1e18`; the test must decide whether such redemptions are meant to revert or whether a minimum amount/rounding rule is required. Large `assets` must also expose whether the multiplication overflows; if those values are reachable, use full-precision `mulDiv` or impose and test a justified cap.
+
+Meaningful evidence is:
+
+- unauthorized callers cannot set the value;
+- every value in the documented valid range can be set and preserves the specified redemption property;
+- monotonicity holds for a fixed redeemable amount: increasing the reserve factor never increases `net`;
+- results match an independent full-precision reference calculation, not a copy of the implementation expression;
+- the setter rejects `1e18` and all larger values if the valid domain is `< 1e18`, with separate regression cases for the exact limit and the first value beyond it because their current failures occur by different paths;
+- zero-output rounding and maximum-amount behaviour are explicitly specified and asserted.
+
+The two existing examples, `0` and `0.2e18`, establish none of those boundary guarantees.
+
+## 2. Repayment accounting: run a handler-driven stateful invariant
+
+One deposit followed by one repayment can prove a divergence at that point. It cannot prove that the divergence accumulates. Let the conservation relation be stated from the design—for example, if no separately tracked reserve exists, `accountedAssets == token.balanceOf(pool)`; if the protocol cut is a real reserve, include an independently tracked `protocolReserves` term in the equality. A one-sided assertion such as `accountedAssets <= balance` is insufficient because it stays green while assets become increasingly stranded.
+
+Require a Foundry invariant test whose `targetContract` is a handler. The handler should create funded, approved actors and make bounded, valid deposits, borrows, repayments (including fee-bearing repayments), and redemptions in varied orders. During development use `fail_on_revert = true`; in the final run inspect call and revert statistics to show that repayment and the other transitions were actually reached. Targeting the pool directly with unfunded random senders would mostly generate discarded reverts and a vacuous green result.
+
+Meaningful evidence of accumulation is either the invariant fuzzer's minimized counterexample or a deterministic regression with at least two drift-producing repayments. Record the gap from the correct conservation equation at baseline and after each repayment: `g0`, `g1`, and `g2`. It must show two nonzero increments—e.g. `g1 - g0 == cut1` and `g2 - g1 == cut2`, hence `g2 > g1 > g0` for positive cuts—not merely setup followed by one repayment. Repeat across repayment sizes, partial/full repayments, multiple borrowers, and rounding cases. The proper deployment criterion is then that the corrected accounting invariant holds after arbitrary successful sequences, or that any intended reserve is explicitly tracked and withdrawable under a tested rule.
+
+## 3. Chainlink and collateral token: execute liquidation on a pinned fork
+
+Standard mocks only confirm the assumptions encoded into those mocks. Require a fork test on the production chain at a fixed block number, after confirming that the chosen RPC endpoint can answer historical `eth_call` requests at that block. Record chain ID, block number, real feed address, real collateral-token address, and preferably their code hashes. An unpinned head is not reproducible; a pinned block on a non-archive endpoint is not runnable.
+
+On that fork, deploy the candidate pool implementation/configuration wired to the known production addresses (or exercise the exact deployment artifact), then drive a real liquidation path:
+
+- call the actual feed and validate the fields the pool relies on, including feed decimals, answer sign/range, timestamps/staleness policy, and round completeness;
+- obtain collateral reproducibly at the pinned state, such as by impersonating a documented funded holder, then make the real token transfers/approvals needed to create a liquidatable position;
+- move only local pool/user state as necessary to make the position liquidatable; do not replace either integration with a mock;
+- execute liquidation and assert actual token balance deltas for the pool, borrower, and liquidator, plus the accounting conservation relation—not just an emitted event or a successful return;
+- assert the liquidation calculation against an independent expected value derived from the real feed answer and decimals at that pinned block.
+
+If the pinned oracle state cannot naturally exercise a required branch, use additional pinned blocks with documented feed states, or separate logic tests for synthetic price branches; the compatibility claim still requires at least one end-to-end call against both real deployed contracts. The fork command, RPC environment-variable name, funded address/setup, and block number should live in the test or repository instructions so CI and reviewers can replay the same state.
+
+Until the domain fuzz test, handler invariant, and pinned-fork liquidation all produce this evidence—and their failures are resolved—the pool should not be approved for deployment.

codex
Completed the test-plan review in [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192604Z-codex-with-skill-2/testing-quiz-006/answer.md). It concludes the pool is not ready for sign-off and specifies the required fuzz, invariant, and pinned-fork evidence.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..c38cf367b12000673090bcbf2b58fbc5f30adffa
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+# Sign-off decision
+
+No. A green, line-complete unit suite made only from standard-behaviour mocks and one-operation examples is not enough to sign off this pool. Coverage says that the selected examples executed the code; it does not show that the assertions searched the relevant input domain, that accounting survives operation sequences, or that the deployed dependencies behave like the mocks.
+
+## 1. `reserveFactorWad`: fuzz the accepted domain and classify the boundary
+
+The economic ratio must first have an explicit valid domain. For the formula shown, a redeemable reserve factor must be strictly less than `1e18`: at exactly `1e18`, every nonzero redemption computes `net == 0` and reverts; above `1e18`, `1e18 - reserveFactorWad` underflows under Solidity 0.8 checked arithmetic. Thus a setter that accepts every `uint256` admits unusable configurations. If governance intentionally permits a 100% reserve as an emergency mode, that needs a separately specified redemption behaviour; it is not a usable value under the current implementation.
+
+Require a property-based fuzz test that uses `bound()` to explore the whole intended setter domain, rather than filtering inconvenient values with `vm.assume()`. Exercise and classify these values explicitly:
+
+- `0`;
+- the nearest value below the ratio boundary, `1e18 - 1`;
+- the exact boundary, `1e18`;
+- the first value above it, `1e18 + 1`;
+- `type(uint256).max`;
+- redemption asset amounts at `0`, `1`, values around `1e18`, the protocol's real minimum/maximum, and arithmetic limits.
+
+`1e18 - 1` is mathematically inside the ratio domain but can still round `net` to zero for `assets < 1e18`; the test must decide whether such redemptions are meant to revert or whether a minimum amount/rounding rule is required. Large `assets` must also expose whether the multiplication overflows; if those values are reachable, use full-precision `mulDiv` or impose and test a justified cap.
+
+Meaningful evidence is:
+
+- unauthorized callers cannot set the value;
+- every value in the documented valid range can be set and preserves the specified redemption property;
+- monotonicity holds for a fixed redeemable amount: increasing the reserve factor never increases `net`;
+- results match an independent full-precision reference calculation, not a copy of the implementation expression;
+- the setter rejects `1e18` and all larger values if the valid domain is `< 1e18`, with separate regression cases for the exact limit and the first value beyond it because their current failures occur by different paths;
+- zero-output rounding and maximum-amount behaviour are explicitly specified and asserted.
+
+The two existing examples, `0` and `0.2e18`, establish none of those boundary guarantees.
+
+## 2. Repayment accounting: run a handler-driven stateful invariant
+
+One deposit followed by one repayment can prove a divergence at that point. It cannot prove that the divergence accumulates. Let the conservation relation be stated from the design—for example, if no separately tracked reserve exists, `accountedAssets == token.balanceOf(pool)`; if the protocol cut is a real reserve, include an independently tracked `protocolReserves` term in the equality. A one-sided assertion such as `accountedAssets <= balance` is insufficient because it stays green while assets become increasingly stranded.
+
+Require a Foundry invariant test whose `targetContract` is a handler. The handler should create funded, approved actors and make bounded, valid deposits, borrows, repayments (including fee-bearing repayments), and redemptions in varied orders. During development use `fail_on_revert = true`; in the final run inspect call and revert statistics to show that repayment and the other transitions were actually reached. Targeting the pool directly with unfunded random senders would mostly generate discarded reverts and a vacuous green result.
+
+Meaningful evidence of accumulation is either the invariant fuzzer's minimized counterexample or a deterministic regression with at least two drift-producing repayments. Record the gap from the correct conservation equation at baseline and after each repayment: `g0`, `g1`, and `g2`. It must show two nonzero increments—e.g. `g1 - g0 == cut1` and `g2 - g1 == cut2`, hence `g2 > g1 > g0` for positive cuts—not merely setup followed by one repayment. Repeat across repayment sizes, partial/full repayments, multiple borrowers, and rounding cases. The proper deployment criterion is then that the corrected accounting invariant holds after arbitrary successful sequences, or that any intended reserve is explicitly tracked and withdrawable under a tested rule.
+
+## 3. Chainlink and collateral token: execute liquidation on a pinned fork
+
+Standard mocks only confirm the assumptions encoded into those mocks. Require a fork test on the production chain at a fixed block number, after confirming that the chosen RPC endpoint can answer historical `eth_call` requests at that block. Record chain ID, block number, real feed address, real collateral-token address, and preferably their code hashes. An unpinned head is not reproducible; a pinned block on a non-archive endpoint is not runnable.
+
+On that fork, deploy the candidate pool implementation/configuration wired to the known production addresses (or exercise the exact deployment artifact), then drive a real liquidation path:
+
+- call the actual feed and validate the fields the pool relies on, including feed decimals, answer sign/range, timestamps/staleness policy, and round completeness;
+- obtain collateral reproducibly at the pinned state, such as by impersonating a documented funded holder, then make the real token transfers/approvals needed to create a liquidatable position;
+- move only local pool/user state as necessary to make the position liquidatable; do not replace either integration with a mock;
+- execute liquidation and assert actual token balance deltas for the pool, borrower, and liquidator, plus the accounting conservation relation—not just an emitted event or a successful return;
+- assert the liquidation calculation against an independent expected value derived from the real feed answer and decimals at that pinned block.
+
+If the pinned oracle state cannot naturally exercise a required branch, use additional pinned blocks with documented feed states, or separate logic tests for synthetic price branches; the compatibility claim still requires at least one end-to-end call against both real deployed contracts. The fork command, RPC environment-variable name, funded address/setup, and block number should live in the test or repository instructions so CI and reviewers can replay the same state.
+
+Until the domain fuzz test, handler invariant, and pinned-fork liquidation all produce this evidence—and their failures are resolved—the pool should not be approved for deployment.

tokens used
11,990
```

## final message

Completed the test-plan review in [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192604Z-codex-with-skill-2/testing-quiz-006/answer.md). It concludes the pool is not ready for sign-off and specifies the required fuzz, invariant, and pinned-fork evidence.

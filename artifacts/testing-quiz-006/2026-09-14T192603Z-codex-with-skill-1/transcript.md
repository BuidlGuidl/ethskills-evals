# Executor transcript — 2026-09-14T192603Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192603Z-codex-with-skill-1/testing-quiz-006

## session

```text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
2026-09-14T19:26:22.985757Z ERROR codex_skills_extension::host_service: failed to install system skills: io error while remove existing system skills dir: Directory not empty (os error 39)
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192603Z-codex-with-skill-1/testing-quiz-006
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a162-85be-7873-9a0a-c5e260c5ae76
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
I’m using the testing skill because this is a Foundry test-plan and deployment-evidence review. I’ll inspect its guidance, then write the sign-off assessment directly to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192603Z-codex-with-skill-1/testing-quiz-006
 succeeded in 1ms:
codex
The decisive gap is that each risk needs a different kind of search: domain fuzzing for the governance math, a handler-driven invariant for cumulative accounting drift, and a pinned fork for the real oracle/token behavior. I’m capturing the required boundaries and concrete evidence now.
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192603Z-codex-with-skill-1/testing-quiz-006/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a7907d838543cb1b8da2fc31e2b8d4d96d791270
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,44 @@
+# Deployment sign-off
+
+No. A green, line-covered suite of local mocks and single-operation examples is not enough to sign off this pool. Coverage shows that statements executed; it does not show that the relevant input domain, state sequences, or deployed integrations were searched.
+
+## 1. `reserveFactorWad`: fuzz the accepted domain and classify the boundary
+
+The setter feeds value math, so require a fuzz test over its entire accepted `uint256` domain, not just examples at `0` and `0.2e18`. Use `bound()` to generate values and exercise both the setter and a redemption with independently fuzzed, realistic `assets` values. The property should be stated independently of the implementation: an accepted reserve factor must produce a usable, non-increasing redemption amount, must not exceed `assets`, and must not fail because the configured factor is outside its intended ratio domain. Also test governance access control.
+
+The intended limit must be decided explicitly. For a redeemable pool, the natural usable domain is:
+
+- nearest valid value: `1e18 - 1`;
+- exact limit: `1e18`;
+- first value beyond it: `1e18 + 1`;
+- numeric extreme: `type(uint256).max`.
+
+`1e18` is not semantically usable here: `1e18 - reserveFactorWad` is zero, so every positive redemption computes `net == 0` and reverts. Values above `1e18` fail differently, by underflow in the subtraction under Solidity 0.8 checked arithmetic. Therefore, unless permanently disabling all redemption is an expressly designed and separately controlled feature, the setter should reject `reserveFactorWad >= 1e18`; testing only `<= 1e18` would admit a configuration that bricks redemption. The tests must preserve separate assertions for the exact limit and the first value beyond it because their current failure paths differ.
+
+Meaningful evidence is a fuzz run showing that every value in the specified valid range can be set and respects the redemption properties, while `1e18`, `1e18 + 1`, and `type(uint256).max` are rejected by the setter with the intended error. Include targeted regressions for those boundaries. The fuzzing must also expose rounding: even at `1e18 - 1`, sufficiently small `assets` rounds `net` to zero. The protocol must specify whether such dust redemption should revert, be prevented by a minimum amount, or be handled another way, and the property must encode that decision. A test which merely recomputes the same formula and compares it to the result is not meaningful evidence.
+
+## 2. Repayment accounting: search operation sequences with an invariant
+
+One deposit followed by one repayment proves only that divergence occurs after that repayment. It does not prove that the divergence accumulates.
+
+Define the accounting/custody relationship first. If `accountedAssets` is intended to represent all assets held by the pool, the invariant should be an equality such as `accountedAssets == collateralOrAssetToken.balanceOf(pool)`, adjusted only for explicitly modelled obligations or reserves. A one-sided inequality is insufficient because it can miss stranded surplus. If the retained protocol cut is intentionally excluded from `accountedAssets`, track it in a separate reserve variable and assert a conservation equality that includes it; unexplained balance is not acceptable accounting.
+
+Exercise this with a Foundry handler invariant, with the handler as `targetContract`. The handler should create funded, approved actors and make valid deposits, borrows, partial repayments, full repayments, and relevant interleavings, with amounts bounded to reachable ranges. While developing it, use `fail_on_revert = true`; in the final run, inspect call and revert statistics to show that the fuzzer executed substantial successful state transitions rather than discarding nearly every call.
+
+To substantiate the narrower claim of accumulation, produce either a deterministic regression or a minimized invariant counterexample containing at least two fee-bearing repayments. Record the gap `g = actual pool balance - accountedAssets` before and after each repayment. With nonzero cuts `c1` and `c2`, meaningful evidence would show the specified recurrence (subject to the protocol's accounting definition), for example `g1 - g0 == c1` and `g2 - g1 == c2`, hence `g2 > g1 > g0`. Setup plus one repayment cannot establish that trend. If the intended invariant is equality, the first mismatch is already a defect; the two-step trace is evidence only for the additional assertion that the defect compounds.
+
+## 3. Chainlink and collateral token: run a pinned production-address fork
+
+Standard-behaviour mocks only retest assumptions about the interfaces. Require a fork test on the production chain that deploys the new pool locally on the fork but configures it with the actual Chainlink feed and collateral-token addresses. Pin the chain ID and an explicit block number; do not fork latest. Confirm in advance that the configured RPC endpoint can answer a historical `eth_call` at that block (and therefore has the required archive depth), then make the block number and expected chain explicit in test configuration or fixtures.
+
+The fork scenario should obtain or fund real collateral-token balances, approve the newly deployed pool using the real token contract, establish a liquidatable position, and execute liquidation through the pool. Where possible, source tokens through a real holder or protocol route on the fork; if `deal` or storage manipulation is unavoidable, document it because it bypasses some token behaviour. Do not mock either `latestRoundData` or `transfer`/`transferFrom` in this test.
+
+Meaningful evidence includes all of the following at the pinned block:
+
+- the real feed call succeeds and its `decimals`, round data, sign, timestamp/staleness, and scaling are handled as the pool expects;
+- the chosen position is demonstrably on the intended side of the liquidation threshold using that pinned round;
+- liquidation completes against the actual token implementation, including its real return-data and allowance behaviour;
+- pre/post token balance deltas for the pool, borrower, and liquidator match the protocol's economic assertions, together with the corresponding internal accounting and liquidation event;
+- the test reruns from a clean fork at the same block with the same outcome, and the RPC/archive prerequisite is documented for CI.
+
+The mock tests should remain for fast fault injection (stale/negative oracle answers, failed transfers, unusual return values), but they cannot replace this fork evidence. Sign-off should wait for all three searches to pass and for the governance and accounting semantics exposed above to be resolved.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a7907d838543cb1b8da2fc31e2b8d4d96d791270
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,44 @@
+# Deployment sign-off
+
+No. A green, line-covered suite of local mocks and single-operation examples is not enough to sign off this pool. Coverage shows that statements executed; it does not show that the relevant input domain, state sequences, or deployed integrations were searched.
+
+## 1. `reserveFactorWad`: fuzz the accepted domain and classify the boundary
+
+The setter feeds value math, so require a fuzz test over its entire accepted `uint256` domain, not just examples at `0` and `0.2e18`. Use `bound()` to generate values and exercise both the setter and a redemption with independently fuzzed, realistic `assets` values. The property should be stated independently of the implementation: an accepted reserve factor must produce a usable, non-increasing redemption amount, must not exceed `assets`, and must not fail because the configured factor is outside its intended ratio domain. Also test governance access control.
+
+The intended limit must be decided explicitly. For a redeemable pool, the natural usable domain is:
+
+- nearest valid value: `1e18 - 1`;
+- exact limit: `1e18`;
+- first value beyond it: `1e18 + 1`;
+- numeric extreme: `type(uint256).max`.
+
+`1e18` is not semantically usable here: `1e18 - reserveFactorWad` is zero, so every positive redemption computes `net == 0` and reverts. Values above `1e18` fail differently, by underflow in the subtraction under Solidity 0.8 checked arithmetic. Therefore, unless permanently disabling all redemption is an expressly designed and separately controlled feature, the setter should reject `reserveFactorWad >= 1e18`; testing only `<= 1e18` would admit a configuration that bricks redemption. The tests must preserve separate assertions for the exact limit and the first value beyond it because their current failure paths differ.
+
+Meaningful evidence is a fuzz run showing that every value in the specified valid range can be set and respects the redemption properties, while `1e18`, `1e18 + 1`, and `type(uint256).max` are rejected by the setter with the intended error. Include targeted regressions for those boundaries. The fuzzing must also expose rounding: even at `1e18 - 1`, sufficiently small `assets` rounds `net` to zero. The protocol must specify whether such dust redemption should revert, be prevented by a minimum amount, or be handled another way, and the property must encode that decision. A test which merely recomputes the same formula and compares it to the result is not meaningful evidence.
+
+## 2. Repayment accounting: search operation sequences with an invariant
+
+One deposit followed by one repayment proves only that divergence occurs after that repayment. It does not prove that the divergence accumulates.
+
+Define the accounting/custody relationship first. If `accountedAssets` is intended to represent all assets held by the pool, the invariant should be an equality such as `accountedAssets == collateralOrAssetToken.balanceOf(pool)`, adjusted only for explicitly modelled obligations or reserves. A one-sided inequality is insufficient because it can miss stranded surplus. If the retained protocol cut is intentionally excluded from `accountedAssets`, track it in a separate reserve variable and assert a conservation equality that includes it; unexplained balance is not acceptable accounting.
+
+Exercise this with a Foundry handler invariant, with the handler as `targetContract`. The handler should create funded, approved actors and make valid deposits, borrows, partial repayments, full repayments, and relevant interleavings, with amounts bounded to reachable ranges. While developing it, use `fail_on_revert = true`; in the final run, inspect call and revert statistics to show that the fuzzer executed substantial successful state transitions rather than discarding nearly every call.
+
+To substantiate the narrower claim of accumulation, produce either a deterministic regression or a minimized invariant counterexample containing at least two fee-bearing repayments. Record the gap `g = actual pool balance - accountedAssets` before and after each repayment. With nonzero cuts `c1` and `c2`, meaningful evidence would show the specified recurrence (subject to the protocol's accounting definition), for example `g1 - g0 == c1` and `g2 - g1 == c2`, hence `g2 > g1 > g0`. Setup plus one repayment cannot establish that trend. If the intended invariant is equality, the first mismatch is already a defect; the two-step trace is evidence only for the additional assertion that the defect compounds.
+
+## 3. Chainlink and collateral token: run a pinned production-address fork
+
+Standard-behaviour mocks only retest assumptions about the interfaces. Require a fork test on the production chain that deploys the new pool locally on the fork but configures it with the actual Chainlink feed and collateral-token addresses. Pin the chain ID and an explicit block number; do not fork latest. Confirm in advance that the configured RPC endpoint can answer a historical `eth_call` at that block (and therefore has the required archive depth), then make the block number and expected chain explicit in test configuration or fixtures.
+
+The fork scenario should obtain or fund real collateral-token balances, approve the newly deployed pool using the real token contract, establish a liquidatable position, and execute liquidation through the pool. Where possible, source tokens through a real holder or protocol route on the fork; if `deal` or storage manipulation is unavoidable, document it because it bypasses some token behaviour. Do not mock either `latestRoundData` or `transfer`/`transferFrom` in this test.
+
+Meaningful evidence includes all of the following at the pinned block:
+
+- the real feed call succeeds and its `decimals`, round data, sign, timestamp/staleness, and scaling are handled as the pool expects;
+- the chosen position is demonstrably on the intended side of the liquidation threshold using that pinned round;
+- liquidation completes against the actual token implementation, including its real return-data and allowance behaviour;
+- pre/post token balance deltas for the pool, borrower, and liquidator match the protocol's economic assertions, together with the corresponding internal accounting and liquidation event;
+- the test reruns from a clean fork at the same block with the same outcome, and the RPC/archive prerequisite is documented for CI.
+
+The mock tests should remain for fast fault injection (stale/negative oracle answers, failed transfers, unusual return values), but they cannot replace this fork evidence. Sign-off should wait for all three searches to pass and for the governance and accounting semantics exposed above to be resolved.

exec
/bin/bash -lc "wc -l answer.md && sed -n '1,260p' answer.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192603Z-codex-with-skill-1/testing-quiz-006
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
44 answer.md
# Deployment sign-off

No. A green, line-covered suite of local mocks and single-operation examples is not enough to sign off this pool. Coverage shows that statements executed; it does not show that the relevant input domain, state sequences, or deployed integrations were searched.

## 1. `reserveFactorWad`: fuzz the accepted domain and classify the boundary

The setter feeds value math, so require a fuzz test over its entire accepted `uint256` domain, not just examples at `0` and `0.2e18`. Use `bound()` to generate values and exercise both the setter and a redemption with independently fuzzed, realistic `assets` values. The property should be stated independently of the implementation: an accepted reserve factor must produce a usable, non-increasing redemption amount, must not exceed `assets`, and must not fail because the configured factor is outside its intended ratio domain. Also test governance access control.

The intended limit must be decided explicitly. For a redeemable pool, the natural usable domain is:

- nearest valid value: `1e18 - 1`;
- exact limit: `1e18`;
- first value beyond it: `1e18 + 1`;
- numeric extreme: `type(uint256).max`.

`1e18` is not semantically usable here: `1e18 - reserveFactorWad` is zero, so every positive redemption computes `net == 0` and reverts. Values above `1e18` fail differently, by underflow in the subtraction under Solidity 0.8 checked arithmetic. Therefore, unless permanently disabling all redemption is an expressly designed and separately controlled feature, the setter should reject `reserveFactorWad >= 1e18`; testing only `<= 1e18` would admit a configuration that bricks redemption. The tests must preserve separate assertions for the exact limit and the first value beyond it because their current failure paths differ.

Meaningful evidence is a fuzz run showing that every value in the specified valid range can be set and respects the redemption properties, while `1e18`, `1e18 + 1`, and `type(uint256).max` are rejected by the setter with the intended error. Include targeted regressions for those boundaries. The fuzzing must also expose rounding: even at `1e18 - 1`, sufficiently small `assets` rounds `net` to zero. The protocol must specify whether such dust redemption should revert, be prevented by a minimum amount, or be handled another way, and the property must encode that decision. A test which merely recomputes the same formula and compares it to the result is not meaningful evidence.

## 2. Repayment accounting: search operation sequences with an invariant

One deposit followed by one repayment proves only that divergence occurs after that repayment. It does not prove that the divergence accumulates.

Define the accounting/custody relationship first. If `accountedAssets` is intended to represent all assets held by the pool, the invariant should be an equality such as `accountedAssets == collateralOrAssetToken.balanceOf(pool)`, adjusted only for explicitly modelled obligations or reserves. A one-sided inequality is insufficient because it can miss stranded surplus. If the retained protocol cut is intentionally excluded from `accountedAssets`, track it in a separate reserve variable and assert a conservation equality that includes it; unexplained balance is not acceptable accounting.

Exercise this with a Foundry handler invariant, with the handler as `targetContract`. The handler should create funded, approved actors and make valid deposits, borrows, partial repayments, full repayments, and relevant interleavings, with amounts bounded to reachable ranges. While developing it, use `fail_on_revert = true`; in the final run, inspect call and revert statistics to show that the fuzzer executed substantial successful state transitions rather than discarding nearly every call.

To substantiate the narrower claim of accumulation, produce either a deterministic regression or a minimized invariant counterexample containing at least two fee-bearing repayments. Record the gap `g = actual pool balance - accountedAssets` before and after each repayment. With nonzero cuts `c1` and `c2`, meaningful evidence would show the specified recurrence (subject to the protocol's accounting definition), for example `g1 - g0 == c1` and `g2 - g1 == c2`, hence `g2 > g1 > g0`. Setup plus one repayment cannot establish that trend. If the intended invariant is equality, the first mismatch is already a defect; the two-step trace is evidence only for the additional assertion that the defect compounds.

## 3. Chainlink and collateral token: run a pinned production-address fork

Standard-behaviour mocks only retest assumptions about the interfaces. Require a fork test on the production chain that deploys the new pool locally on the fork but configures it with the actual Chainlink feed and collateral-token addresses. Pin the chain ID and an explicit block number; do not fork latest. Confirm in advance that the configured RPC endpoint can answer a historical `eth_call` at that block (and therefore has the required archive depth), then make the block number and expected chain explicit in test configuration or fixtures.

The fork scenario should obtain or fund real collateral-token balances, approve the newly deployed pool using the real token contract, establish a liquidatable position, and execute liquidation through the pool. Where possible, source tokens through a real holder or protocol route on the fork; if `deal` or storage manipulation is unavoidable, document it because it bypasses some token behaviour. Do not mock either `latestRoundData` or `transfer`/`transferFrom` in this test.

Meaningful evidence includes all of the following at the pinned block:

- the real feed call succeeds and its `decimals`, round data, sign, timestamp/staleness, and scaling are handled as the pool expects;
- the chosen position is demonstrably on the intended side of the liquidation threshold using that pinned round;
- liquidation completes against the actual token implementation, including its real return-data and allowance behaviour;
- pre/post token balance deltas for the pool, borrower, and liquidator match the protocol's economic assertions, together with the corresponding internal accounting and liquidation event;
- the test reruns from a clean fork at the same block with the same outcome, and the RPC/archive prerequisite is documented for CI.

The mock tests should remain for fast fault injection (stale/negative oracle answers, failed transfers, unusual return values), but they cannot replace this fork evidence. Sign-off should wait for all three searches to pass and for the governance and accounting semantics exposed above to be resolved.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a7907d838543cb1b8da2fc31e2b8d4d96d791270
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,44 @@
+# Deployment sign-off
+
+No. A green, line-covered suite of local mocks and single-operation examples is not enough to sign off this pool. Coverage shows that statements executed; it does not show that the relevant input domain, state sequences, or deployed integrations were searched.
+
+## 1. `reserveFactorWad`: fuzz the accepted domain and classify the boundary
+
+The setter feeds value math, so require a fuzz test over its entire accepted `uint256` domain, not just examples at `0` and `0.2e18`. Use `bound()` to generate values and exercise both the setter and a redemption with independently fuzzed, realistic `assets` values. The property should be stated independently of the implementation: an accepted reserve factor must produce a usable, non-increasing redemption amount, must not exceed `assets`, and must not fail because the configured factor is outside its intended ratio domain. Also test governance access control.
+
+The intended limit must be decided explicitly. For a redeemable pool, the natural usable domain is:
+
+- nearest valid value: `1e18 - 1`;
+- exact limit: `1e18`;
+- first value beyond it: `1e18 + 1`;
+- numeric extreme: `type(uint256).max`.
+
+`1e18` is not semantically usable here: `1e18 - reserveFactorWad` is zero, so every positive redemption computes `net == 0` and reverts. Values above `1e18` fail differently, by underflow in the subtraction under Solidity 0.8 checked arithmetic. Therefore, unless permanently disabling all redemption is an expressly designed and separately controlled feature, the setter should reject `reserveFactorWad >= 1e18`; testing only `<= 1e18` would admit a configuration that bricks redemption. The tests must preserve separate assertions for the exact limit and the first value beyond it because their current failure paths differ.
+
+Meaningful evidence is a fuzz run showing that every value in the specified valid range can be set and respects the redemption properties, while `1e18`, `1e18 + 1`, and `type(uint256).max` are rejected by the setter with the intended error. Include targeted regressions for those boundaries. The fuzzing must also expose rounding: even at `1e18 - 1`, sufficiently small `assets` rounds `net` to zero. The protocol must specify whether such dust redemption should revert, be prevented by a minimum amount, or be handled another way, and the property must encode that decision. A test which merely recomputes the same formula and compares it to the result is not meaningful evidence.
+
+## 2. Repayment accounting: search operation sequences with an invariant
+
+One deposit followed by one repayment proves only that divergence occurs after that repayment. It does not prove that the divergence accumulates.
+
+Define the accounting/custody relationship first. If `accountedAssets` is intended to represent all assets held by the pool, the invariant should be an equality such as `accountedAssets == collateralOrAssetToken.balanceOf(pool)`, adjusted only for explicitly modelled obligations or reserves. A one-sided inequality is insufficient because it can miss stranded surplus. If the retained protocol cut is intentionally excluded from `accountedAssets`, track it in a separate reserve variable and assert a conservation equality that includes it; unexplained balance is not acceptable accounting.
+
+Exercise this with a Foundry handler invariant, with the handler as `targetContract`. The handler should create funded, approved actors and make valid deposits, borrows, partial repayments, full repayments, and relevant interleavings, with amounts bounded to reachable ranges. While developing it, use `fail_on_revert = true`; in the final run, inspect call and revert statistics to show that the fuzzer executed substantial successful state transitions rather than discarding nearly every call.
+
+To substantiate the narrower claim of accumulation, produce either a deterministic regression or a minimized invariant counterexample containing at least two fee-bearing repayments. Record the gap `g = actual pool balance - accountedAssets` before and after each repayment. With nonzero cuts `c1` and `c2`, meaningful evidence would show the specified recurrence (subject to the protocol's accounting definition), for example `g1 - g0 == c1` and `g2 - g1 == c2`, hence `g2 > g1 > g0`. Setup plus one repayment cannot establish that trend. If the intended invariant is equality, the first mismatch is already a defect; the two-step trace is evidence only for the additional assertion that the defect compounds.
+
+## 3. Chainlink and collateral token: run a pinned production-address fork
+
+Standard-behaviour mocks only retest assumptions about the interfaces. Require a fork test on the production chain that deploys the new pool locally on the fork but configures it with the actual Chainlink feed and collateral-token addresses. Pin the chain ID and an explicit block number; do not fork latest. Confirm in advance that the configured RPC endpoint can answer a historical `eth_call` at that block (and therefore has the required archive depth), then make the block number and expected chain explicit in test configuration or fixtures.
+
+The fork scenario should obtain or fund real collateral-token balances, approve the newly deployed pool using the real token contract, establish a liquidatable position, and execute liquidation through the pool. Where possible, source tokens through a real holder or protocol route on the fork; if `deal` or storage manipulation is unavoidable, document it because it bypasses some token behaviour. Do not mock either `latestRoundData` or `transfer`/`transferFrom` in this test.
+
+Meaningful evidence includes all of the following at the pinned block:
+
+- the real feed call succeeds and its `decimals`, round data, sign, timestamp/staleness, and scaling are handled as the pool expects;
+- the chosen position is demonstrably on the intended side of the liquidation threshold using that pinned round;
+- liquidation completes against the actual token implementation, including its real return-data and allowance behaviour;
+- pre/post token balance deltas for the pool, borrower, and liquidator match the protocol's economic assertions, together with the corresponding internal accounting and liquidation event;
+- the test reruns from a clean fork at the same block with the same outcome, and the RPC/archive prerequisite is documented for CI.
+
+The mock tests should remain for fast fault injection (stale/negative oracle answers, failed transfers, unusual return values), but they cannot replace this fork evidence. Sign-off should wait for all three searches to pass and for the governance and accounting semantics exposed above to be resolved.

codex
Completed the test-plan assessment in [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192603Z-codex-with-skill-1/testing-quiz-006/answer.md).
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a7907d838543cb1b8da2fc31e2b8d4d96d791270
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,44 @@
+# Deployment sign-off
+
+No. A green, line-covered suite of local mocks and single-operation examples is not enough to sign off this pool. Coverage shows that statements executed; it does not show that the relevant input domain, state sequences, or deployed integrations were searched.
+
+## 1. `reserveFactorWad`: fuzz the accepted domain and classify the boundary
+
+The setter feeds value math, so require a fuzz test over its entire accepted `uint256` domain, not just examples at `0` and `0.2e18`. Use `bound()` to generate values and exercise both the setter and a redemption with independently fuzzed, realistic `assets` values. The property should be stated independently of the implementation: an accepted reserve factor must produce a usable, non-increasing redemption amount, must not exceed `assets`, and must not fail because the configured factor is outside its intended ratio domain. Also test governance access control.
+
+The intended limit must be decided explicitly. For a redeemable pool, the natural usable domain is:
+
+- nearest valid value: `1e18 - 1`;
+- exact limit: `1e18`;
+- first value beyond it: `1e18 + 1`;
+- numeric extreme: `type(uint256).max`.
+
+`1e18` is not semantically usable here: `1e18 - reserveFactorWad` is zero, so every positive redemption computes `net == 0` and reverts. Values above `1e18` fail differently, by underflow in the subtraction under Solidity 0.8 checked arithmetic. Therefore, unless permanently disabling all redemption is an expressly designed and separately controlled feature, the setter should reject `reserveFactorWad >= 1e18`; testing only `<= 1e18` would admit a configuration that bricks redemption. The tests must preserve separate assertions for the exact limit and the first value beyond it because their current failure paths differ.
+
+Meaningful evidence is a fuzz run showing that every value in the specified valid range can be set and respects the redemption properties, while `1e18`, `1e18 + 1`, and `type(uint256).max` are rejected by the setter with the intended error. Include targeted regressions for those boundaries. The fuzzing must also expose rounding: even at `1e18 - 1`, sufficiently small `assets` rounds `net` to zero. The protocol must specify whether such dust redemption should revert, be prevented by a minimum amount, or be handled another way, and the property must encode that decision. A test which merely recomputes the same formula and compares it to the result is not meaningful evidence.
+
+## 2. Repayment accounting: search operation sequences with an invariant
+
+One deposit followed by one repayment proves only that divergence occurs after that repayment. It does not prove that the divergence accumulates.
+
+Define the accounting/custody relationship first. If `accountedAssets` is intended to represent all assets held by the pool, the invariant should be an equality such as `accountedAssets == collateralOrAssetToken.balanceOf(pool)`, adjusted only for explicitly modelled obligations or reserves. A one-sided inequality is insufficient because it can miss stranded surplus. If the retained protocol cut is intentionally excluded from `accountedAssets`, track it in a separate reserve variable and assert a conservation equality that includes it; unexplained balance is not acceptable accounting.
+
+Exercise this with a Foundry handler invariant, with the handler as `targetContract`. The handler should create funded, approved actors and make valid deposits, borrows, partial repayments, full repayments, and relevant interleavings, with amounts bounded to reachable ranges. While developing it, use `fail_on_revert = true`; in the final run, inspect call and revert statistics to show that the fuzzer executed substantial successful state transitions rather than discarding nearly every call.
+
+To substantiate the narrower claim of accumulation, produce either a deterministic regression or a minimized invariant counterexample containing at least two fee-bearing repayments. Record the gap `g = actual pool balance - accountedAssets` before and after each repayment. With nonzero cuts `c1` and `c2`, meaningful evidence would show the specified recurrence (subject to the protocol's accounting definition), for example `g1 - g0 == c1` and `g2 - g1 == c2`, hence `g2 > g1 > g0`. Setup plus one repayment cannot establish that trend. If the intended invariant is equality, the first mismatch is already a defect; the two-step trace is evidence only for the additional assertion that the defect compounds.
+
+## 3. Chainlink and collateral token: run a pinned production-address fork
+
+Standard-behaviour mocks only retest assumptions about the interfaces. Require a fork test on the production chain that deploys the new pool locally on the fork but configures it with the actual Chainlink feed and collateral-token addresses. Pin the chain ID and an explicit block number; do not fork latest. Confirm in advance that the configured RPC endpoint can answer a historical `eth_call` at that block (and therefore has the required archive depth), then make the block number and expected chain explicit in test configuration or fixtures.
+
+The fork scenario should obtain or fund real collateral-token balances, approve the newly deployed pool using the real token contract, establish a liquidatable position, and execute liquidation through the pool. Where possible, source tokens through a real holder or protocol route on the fork; if `deal` or storage manipulation is unavoidable, document it because it bypasses some token behaviour. Do not mock either `latestRoundData` or `transfer`/`transferFrom` in this test.
+
+Meaningful evidence includes all of the following at the pinned block:
+
+- the real feed call succeeds and its `decimals`, round data, sign, timestamp/staleness, and scaling are handled as the pool expects;
+- the chosen position is demonstrably on the intended side of the liquidation threshold using that pinned round;
+- liquidation completes against the actual token implementation, including its real return-data and allowance behaviour;
+- pre/post token balance deltas for the pool, borrower, and liquidator match the protocol's economic assertions, together with the corresponding internal accounting and liquidation event;
+- the test reruns from a clean fork at the same block with the same outcome, and the RPC/archive prerequisite is documented for CI.
+
+The mock tests should remain for fast fault injection (stale/negative oracle answers, failed transfers, unusual return values), but they cannot replace this fork evidence. Sign-off should wait for all three searches to pass and for the governance and accounting semantics exposed above to be resolved.

tokens used
11,874
```

## final message

Completed the test-plan assessment in [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192603Z-codex-with-skill-1/testing-quiz-006/answer.md).

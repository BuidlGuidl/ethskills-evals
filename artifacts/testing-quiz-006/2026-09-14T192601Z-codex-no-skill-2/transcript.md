# Executor transcript — 2026-09-14T192601Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-2/testing-quiz-006

## session

```text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-2/testing-quiz-006
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a162-86c9-7271-828a-05b1fd445487
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
I’ll turn this into a sign-off assessment with concrete boundary/property tests and a pinned-fork integration procedure, then save it in `answer.md`.
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-2/testing-quiz-006/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a4a7246b154af75059ba5381a4e63aefb9dc9aa4
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,52 @@
+# Sign-off assessment
+
+No. Green unit tests and 100% line coverage do not establish safety here. The suite misses an unsafe governance domain, does not prove the claimed state divergence grows over time, and has not tested the contracts that liquidation will actually call.
+
+## 1. `reserveFactorWad`
+
+First, search every write path for `reserveFactorWad`: the setter, initializer, upgrade/migration hooks, storage writes, governance batching, and any alternate admin entry point. Confirm that the same range check applies everywhere and that the deployed governance route can only set values in the intended domain. For the stated formula, the natural domain is `0 <= reserveFactorWad < 1e18` if every positive redemption is meant to have a chance of succeeding. Merely checking `<= 1e18` still permits `1e18`, for which `net` is zero for every redemption and all redemptions revert. A value above `1e18` makes `1e18 - reserveFactorWad` underflow and panic in Solidity 0.8+, rather than producing the contract's intended error.
+
+Require boundary and property tests, not just the two ordinary examples:
+
+- Setter inputs: `0`, `1`, `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`.
+- Redemption assets around rounding thresholds: `0`, `1`, and values immediately below, at, and above the smallest amount for which `assets * (1e18 - reserveFactorWad) / 1e18` is nonzero.
+- Fuzz the accepted reserve domain and realistic asset domain. Assert that invalid reserve values are rejected by the setter with the expected custom error, accepted values cannot make subtraction underflow, and the computed result agrees with a higher-precision reference model. Also test multiplication overflow, or use/verify a full-precision `mulDiv` implementation if the asset range can make `assets * (...)` overflow.
+
+Meaningful evidence is a clearly documented economic invariant and tests enforcing it. If governance must not be able to disable all redemption, the setter must reject `reserveFactorWad >= 1e18`. If `1e18` is intentionally an emergency freeze, that exceptional behavior must be explicit, separately authorized and tested; it should not arise accidentally from an unrestricted numeric setter. The `net == 0` revert should also be shown to handle only the intended zero/dust cases.
+
+## 2. Repayment/accounting divergence
+
+One repayment proves only that a mismatch can exist. It does not prove accumulation.
+
+Build a stateful or sequence test containing multiple repayments, with the protocol cut nonzero on each one. Record after every step both the pool's relevant real asset balance and `accountedAssets`, starting from a known baseline. Define the discrepancy using the implementation's sign convention, for example:
+
+`gap_i = actualAssets_i - accountedAssets_i`
+
+Then derive a reference-model recurrence from the intended cash flows. If the described bug is isolated and the retained cut is omitted from accounting, the test should demonstrate, after each repayment,
+
+`gap_i - gap_(i-1) = retainedCut_i`
+
+and therefore
+
+`gap_n = gap_0 + sum(retainedCut_1 ... retainedCut_n)`.
+
+Use at least two nonzero-cut repayments; preferably fuzz the repayment count, amounts, fee rates, partial/full repayments, multiple borrowers, and rounding-producing amounts. Assert the recurrence after every operation, not merely that the final values differ. Control or model all other balance-changing events (deposits, withdrawals, donations, interest, liquidations, and token transfer fees) so they cannot explain the gap. Include zero-cut and rounded-to-zero-cut controls, which should not increase it.
+
+Meaningful evidence is a failing regression/property test on the current implementation whose observed gap equals the cumulative retained cuts, followed by the same test passing under the specified accounting invariant after the fix. A chart or two snapshots without the per-step reference model is not proof of accumulation.
+
+## 3. Chainlink feed and collateral token
+
+Mocks establish local control flow, not compatibility with the deployed contracts. Require a mainnet-fork integration test pinned to an immutable chain identity and block: chain ID, block number, and preferably block hash, using an archive-capable RPC endpoint. Do not fork `latest`, because its state changes and failures will not be reproducible. Record the production feed, collateral token, and any proxy/implementation addresses in the test configuration and assert that code exists at each expected address.
+
+On that pinned fork, deploy the pool or a minimal liquidation harness with its normal production configuration, but point it to the real production feed and collateral token. Create a liquidatable position deterministically by impersonating a known funded holder or by transferring fork-held collateral into the harness; fund test actors deterministically and avoid depending on a mutable live account at `latest`. If the full pool cannot be initialized at that historical block, document and version the fixture used to seed its local position state while keeping both external calls real.
+
+The test must execute the complete liquidation transaction and establish at least:
+
+- The feed call succeeds through the actual proxy/interface, and the test handles its real `decimals`, answer scaling, round ID, `updatedAt`, `answeredInRound`, and the protocol's stale/nonpositive-price checks.
+- The exact deployed collateral token accepts the pool's transfer method and return-data behavior. Assert pre/post balances of pool, liquidator/recipient, and any fee recipient, rather than relying only on an emitted event.
+- Liquidation eligibility, debt/collateral accounting, transferred collateral, protocol fee, and emitted events agree with an independent reference calculation using the returned production-feed value.
+- Revert paths remain correct for an invalid/stale price. Because historical Chainlink state cannot be edited directly, cover this with a separate controllable-feed test while retaining the fork test as the compatibility test.
+
+Make the fork fixture runnable in CI with a documented command, RPC environment variable, pinned tool/compiler versions, block number/hash, addresses, and expected assertions. Cache or otherwise provision a reliable archive RPC according to the project's CI policy. The evidence is a passing transaction trace and balance/state assertions against the real contracts at that pinned block—not simply successful `eth_call`s, ABI-compatible mocks, or an unpinned manual test.
+
+Sign-off should wait until the setter's intended domain is enforced, the repayment discrepancy is proven or disproven by a multi-step invariant, and the pinned-fork liquidation test passes against both production integrations.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a4a7246b154af75059ba5381a4e63aefb9dc9aa4
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,52 @@
+# Sign-off assessment
+
+No. Green unit tests and 100% line coverage do not establish safety here. The suite misses an unsafe governance domain, does not prove the claimed state divergence grows over time, and has not tested the contracts that liquidation will actually call.
+
+## 1. `reserveFactorWad`
+
+First, search every write path for `reserveFactorWad`: the setter, initializer, upgrade/migration hooks, storage writes, governance batching, and any alternate admin entry point. Confirm that the same range check applies everywhere and that the deployed governance route can only set values in the intended domain. For the stated formula, the natural domain is `0 <= reserveFactorWad < 1e18` if every positive redemption is meant to have a chance of succeeding. Merely checking `<= 1e18` still permits `1e18`, for which `net` is zero for every redemption and all redemptions revert. A value above `1e18` makes `1e18 - reserveFactorWad` underflow and panic in Solidity 0.8+, rather than producing the contract's intended error.
+
+Require boundary and property tests, not just the two ordinary examples:
+
+- Setter inputs: `0`, `1`, `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`.
+- Redemption assets around rounding thresholds: `0`, `1`, and values immediately below, at, and above the smallest amount for which `assets * (1e18 - reserveFactorWad) / 1e18` is nonzero.
+- Fuzz the accepted reserve domain and realistic asset domain. Assert that invalid reserve values are rejected by the setter with the expected custom error, accepted values cannot make subtraction underflow, and the computed result agrees with a higher-precision reference model. Also test multiplication overflow, or use/verify a full-precision `mulDiv` implementation if the asset range can make `assets * (...)` overflow.
+
+Meaningful evidence is a clearly documented economic invariant and tests enforcing it. If governance must not be able to disable all redemption, the setter must reject `reserveFactorWad >= 1e18`. If `1e18` is intentionally an emergency freeze, that exceptional behavior must be explicit, separately authorized and tested; it should not arise accidentally from an unrestricted numeric setter. The `net == 0` revert should also be shown to handle only the intended zero/dust cases.
+
+## 2. Repayment/accounting divergence
+
+One repayment proves only that a mismatch can exist. It does not prove accumulation.
+
+Build a stateful or sequence test containing multiple repayments, with the protocol cut nonzero on each one. Record after every step both the pool's relevant real asset balance and `accountedAssets`, starting from a known baseline. Define the discrepancy using the implementation's sign convention, for example:
+
+`gap_i = actualAssets_i - accountedAssets_i`
+
+Then derive a reference-model recurrence from the intended cash flows. If the described bug is isolated and the retained cut is omitted from accounting, the test should demonstrate, after each repayment,
+
+`gap_i - gap_(i-1) = retainedCut_i`
+
+and therefore
+
+`gap_n = gap_0 + sum(retainedCut_1 ... retainedCut_n)`.
+
+Use at least two nonzero-cut repayments; preferably fuzz the repayment count, amounts, fee rates, partial/full repayments, multiple borrowers, and rounding-producing amounts. Assert the recurrence after every operation, not merely that the final values differ. Control or model all other balance-changing events (deposits, withdrawals, donations, interest, liquidations, and token transfer fees) so they cannot explain the gap. Include zero-cut and rounded-to-zero-cut controls, which should not increase it.
+
+Meaningful evidence is a failing regression/property test on the current implementation whose observed gap equals the cumulative retained cuts, followed by the same test passing under the specified accounting invariant after the fix. A chart or two snapshots without the per-step reference model is not proof of accumulation.
+
+## 3. Chainlink feed and collateral token
+
+Mocks establish local control flow, not compatibility with the deployed contracts. Require a mainnet-fork integration test pinned to an immutable chain identity and block: chain ID, block number, and preferably block hash, using an archive-capable RPC endpoint. Do not fork `latest`, because its state changes and failures will not be reproducible. Record the production feed, collateral token, and any proxy/implementation addresses in the test configuration and assert that code exists at each expected address.
+
+On that pinned fork, deploy the pool or a minimal liquidation harness with its normal production configuration, but point it to the real production feed and collateral token. Create a liquidatable position deterministically by impersonating a known funded holder or by transferring fork-held collateral into the harness; fund test actors deterministically and avoid depending on a mutable live account at `latest`. If the full pool cannot be initialized at that historical block, document and version the fixture used to seed its local position state while keeping both external calls real.
+
+The test must execute the complete liquidation transaction and establish at least:
+
+- The feed call succeeds through the actual proxy/interface, and the test handles its real `decimals`, answer scaling, round ID, `updatedAt`, `answeredInRound`, and the protocol's stale/nonpositive-price checks.
+- The exact deployed collateral token accepts the pool's transfer method and return-data behavior. Assert pre/post balances of pool, liquidator/recipient, and any fee recipient, rather than relying only on an emitted event.
+- Liquidation eligibility, debt/collateral accounting, transferred collateral, protocol fee, and emitted events agree with an independent reference calculation using the returned production-feed value.
+- Revert paths remain correct for an invalid/stale price. Because historical Chainlink state cannot be edited directly, cover this with a separate controllable-feed test while retaining the fork test as the compatibility test.
+
+Make the fork fixture runnable in CI with a documented command, RPC environment variable, pinned tool/compiler versions, block number/hash, addresses, and expected assertions. Cache or otherwise provision a reliable archive RPC according to the project's CI policy. The evidence is a passing transaction trace and balance/state assertions against the real contracts at that pinned block—not simply successful `eth_call`s, ABI-compatible mocks, or an unpinned manual test.
+
+Sign-off should wait until the setter's intended domain is enforced, the repayment discrepancy is proven or disproven by a multi-step invariant, and the pinned-fork liquidation test passes against both production integrations.

exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-2/testing-quiz-006
 succeeded in 11ms:
# Sign-off assessment

No. Green unit tests and 100% line coverage do not establish safety here. The suite misses an unsafe governance domain, does not prove the claimed state divergence grows over time, and has not tested the contracts that liquidation will actually call.

## 1. `reserveFactorWad`

First, search every write path for `reserveFactorWad`: the setter, initializer, upgrade/migration hooks, storage writes, governance batching, and any alternate admin entry point. Confirm that the same range check applies everywhere and that the deployed governance route can only set values in the intended domain. For the stated formula, the natural domain is `0 <= reserveFactorWad < 1e18` if every positive redemption is meant to have a chance of succeeding. Merely checking `<= 1e18` still permits `1e18`, for which `net` is zero for every redemption and all redemptions revert. A value above `1e18` makes `1e18 - reserveFactorWad` underflow and panic in Solidity 0.8+, rather than producing the contract's intended error.

Require boundary and property tests, not just the two ordinary examples:

- Setter inputs: `0`, `1`, `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`.
- Redemption assets around rounding thresholds: `0`, `1`, and values immediately below, at, and above the smallest amount for which `assets * (1e18 - reserveFactorWad) / 1e18` is nonzero.
- Fuzz the accepted reserve domain and realistic asset domain. Assert that invalid reserve values are rejected by the setter with the expected custom error, accepted values cannot make subtraction underflow, and the computed result agrees with a higher-precision reference model. Also test multiplication overflow, or use/verify a full-precision `mulDiv` implementation if the asset range can make `assets * (...)` overflow.

Meaningful evidence is a clearly documented economic invariant and tests enforcing it. If governance must not be able to disable all redemption, the setter must reject `reserveFactorWad >= 1e18`. If `1e18` is intentionally an emergency freeze, that exceptional behavior must be explicit, separately authorized and tested; it should not arise accidentally from an unrestricted numeric setter. The `net == 0` revert should also be shown to handle only the intended zero/dust cases.

## 2. Repayment/accounting divergence

One repayment proves only that a mismatch can exist. It does not prove accumulation.

Build a stateful or sequence test containing multiple repayments, with the protocol cut nonzero on each one. Record after every step both the pool's relevant real asset balance and `accountedAssets`, starting from a known baseline. Define the discrepancy using the implementation's sign convention, for example:

`gap_i = actualAssets_i - accountedAssets_i`

Then derive a reference-model recurrence from the intended cash flows. If the described bug is isolated and the retained cut is omitted from accounting, the test should demonstrate, after each repayment,

`gap_i - gap_(i-1) = retainedCut_i`

and therefore

`gap_n = gap_0 + sum(retainedCut_1 ... retainedCut_n)`.

Use at least two nonzero-cut repayments; preferably fuzz the repayment count, amounts, fee rates, partial/full repayments, multiple borrowers, and rounding-producing amounts. Assert the recurrence after every operation, not merely that the final values differ. Control or model all other balance-changing events (deposits, withdrawals, donations, interest, liquidations, and token transfer fees) so they cannot explain the gap. Include zero-cut and rounded-to-zero-cut controls, which should not increase it.

Meaningful evidence is a failing regression/property test on the current implementation whose observed gap equals the cumulative retained cuts, followed by the same test passing under the specified accounting invariant after the fix. A chart or two snapshots without the per-step reference model is not proof of accumulation.

## 3. Chainlink feed and collateral token

Mocks establish local control flow, not compatibility with the deployed contracts. Require a mainnet-fork integration test pinned to an immutable chain identity and block: chain ID, block number, and preferably block hash, using an archive-capable RPC endpoint. Do not fork `latest`, because its state changes and failures will not be reproducible. Record the production feed, collateral token, and any proxy/implementation addresses in the test configuration and assert that code exists at each expected address.

On that pinned fork, deploy the pool or a minimal liquidation harness with its normal production configuration, but point it to the real production feed and collateral token. Create a liquidatable position deterministically by impersonating a known funded holder or by transferring fork-held collateral into the harness; fund test actors deterministically and avoid depending on a mutable live account at `latest`. If the full pool cannot be initialized at that historical block, document and version the fixture used to seed its local position state while keeping both external calls real.

The test must execute the complete liquidation transaction and establish at least:

- The feed call succeeds through the actual proxy/interface, and the test handles its real `decimals`, answer scaling, round ID, `updatedAt`, `answeredInRound`, and the protocol's stale/nonpositive-price checks.
- The exact deployed collateral token accepts the pool's transfer method and return-data behavior. Assert pre/post balances of pool, liquidator/recipient, and any fee recipient, rather than relying only on an emitted event.
- Liquidation eligibility, debt/collateral accounting, transferred collateral, protocol fee, and emitted events agree with an independent reference calculation using the returned production-feed value.
- Revert paths remain correct for an invalid/stale price. Because historical Chainlink state cannot be edited directly, cover this with a separate controllable-feed test while retaining the fork test as the compatibility test.

Make the fork fixture runnable in CI with a documented command, RPC environment variable, pinned tool/compiler versions, block number/hash, addresses, and expected assertions. Cache or otherwise provision a reliable archive RPC according to the project's CI policy. The evidence is a passing transaction trace and balance/state assertions against the real contracts at that pinned block—not simply successful `eth_call`s, ABI-compatible mocks, or an unpinned manual test.

Sign-off should wait until the setter's intended domain is enforced, the repayment discrepancy is proven or disproven by a multi-step invariant, and the pinned-fork liquidation test passes against both production integrations.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a4a7246b154af75059ba5381a4e63aefb9dc9aa4
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,52 @@
+# Sign-off assessment
+
+No. Green unit tests and 100% line coverage do not establish safety here. The suite misses an unsafe governance domain, does not prove the claimed state divergence grows over time, and has not tested the contracts that liquidation will actually call.
+
+## 1. `reserveFactorWad`
+
+First, search every write path for `reserveFactorWad`: the setter, initializer, upgrade/migration hooks, storage writes, governance batching, and any alternate admin entry point. Confirm that the same range check applies everywhere and that the deployed governance route can only set values in the intended domain. For the stated formula, the natural domain is `0 <= reserveFactorWad < 1e18` if every positive redemption is meant to have a chance of succeeding. Merely checking `<= 1e18` still permits `1e18`, for which `net` is zero for every redemption and all redemptions revert. A value above `1e18` makes `1e18 - reserveFactorWad` underflow and panic in Solidity 0.8+, rather than producing the contract's intended error.
+
+Require boundary and property tests, not just the two ordinary examples:
+
+- Setter inputs: `0`, `1`, `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`.
+- Redemption assets around rounding thresholds: `0`, `1`, and values immediately below, at, and above the smallest amount for which `assets * (1e18 - reserveFactorWad) / 1e18` is nonzero.
+- Fuzz the accepted reserve domain and realistic asset domain. Assert that invalid reserve values are rejected by the setter with the expected custom error, accepted values cannot make subtraction underflow, and the computed result agrees with a higher-precision reference model. Also test multiplication overflow, or use/verify a full-precision `mulDiv` implementation if the asset range can make `assets * (...)` overflow.
+
+Meaningful evidence is a clearly documented economic invariant and tests enforcing it. If governance must not be able to disable all redemption, the setter must reject `reserveFactorWad >= 1e18`. If `1e18` is intentionally an emergency freeze, that exceptional behavior must be explicit, separately authorized and tested; it should not arise accidentally from an unrestricted numeric setter. The `net == 0` revert should also be shown to handle only the intended zero/dust cases.
+
+## 2. Repayment/accounting divergence
+
+One repayment proves only that a mismatch can exist. It does not prove accumulation.
+
+Build a stateful or sequence test containing multiple repayments, with the protocol cut nonzero on each one. Record after every step both the pool's relevant real asset balance and `accountedAssets`, starting from a known baseline. Define the discrepancy using the implementation's sign convention, for example:
+
+`gap_i = actualAssets_i - accountedAssets_i`
+
+Then derive a reference-model recurrence from the intended cash flows. If the described bug is isolated and the retained cut is omitted from accounting, the test should demonstrate, after each repayment,
+
+`gap_i - gap_(i-1) = retainedCut_i`
+
+and therefore
+
+`gap_n = gap_0 + sum(retainedCut_1 ... retainedCut_n)`.
+
+Use at least two nonzero-cut repayments; preferably fuzz the repayment count, amounts, fee rates, partial/full repayments, multiple borrowers, and rounding-producing amounts. Assert the recurrence after every operation, not merely that the final values differ. Control or model all other balance-changing events (deposits, withdrawals, donations, interest, liquidations, and token transfer fees) so they cannot explain the gap. Include zero-cut and rounded-to-zero-cut controls, which should not increase it.
+
+Meaningful evidence is a failing regression/property test on the current implementation whose observed gap equals the cumulative retained cuts, followed by the same test passing under the specified accounting invariant after the fix. A chart or two snapshots without the per-step reference model is not proof of accumulation.
+
+## 3. Chainlink feed and collateral token
+
+Mocks establish local control flow, not compatibility with the deployed contracts. Require a mainnet-fork integration test pinned to an immutable chain identity and block: chain ID, block number, and preferably block hash, using an archive-capable RPC endpoint. Do not fork `latest`, because its state changes and failures will not be reproducible. Record the production feed, collateral token, and any proxy/implementation addresses in the test configuration and assert that code exists at each expected address.
+
+On that pinned fork, deploy the pool or a minimal liquidation harness with its normal production configuration, but point it to the real production feed and collateral token. Create a liquidatable position deterministically by impersonating a known funded holder or by transferring fork-held collateral into the harness; fund test actors deterministically and avoid depending on a mutable live account at `latest`. If the full pool cannot be initialized at that historical block, document and version the fixture used to seed its local position state while keeping both external calls real.
+
+The test must execute the complete liquidation transaction and establish at least:
+
+- The feed call succeeds through the actual proxy/interface, and the test handles its real `decimals`, answer scaling, round ID, `updatedAt`, `answeredInRound`, and the protocol's stale/nonpositive-price checks.
+- The exact deployed collateral token accepts the pool's transfer method and return-data behavior. Assert pre/post balances of pool, liquidator/recipient, and any fee recipient, rather than relying only on an emitted event.
+- Liquidation eligibility, debt/collateral accounting, transferred collateral, protocol fee, and emitted events agree with an independent reference calculation using the returned production-feed value.
+- Revert paths remain correct for an invalid/stale price. Because historical Chainlink state cannot be edited directly, cover this with a separate controllable-feed test while retaining the fork test as the compatibility test.
+
+Make the fork fixture runnable in CI with a documented command, RPC environment variable, pinned tool/compiler versions, block number/hash, addresses, and expected assertions. Cache or otherwise provision a reliable archive RPC according to the project's CI policy. The evidence is a passing transaction trace and balance/state assertions against the real contracts at that pinned block—not simply successful `eth_call`s, ABI-compatible mocks, or an unpinned manual test.
+
+Sign-off should wait until the setter's intended domain is enforced, the repayment discrepancy is proven or disproven by a multi-step invariant, and the pinned-fork liquidation test passes against both production integrations.

codex
Completed the review and saved it to [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-2/testing-quiz-006/answer.md).
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a4a7246b154af75059ba5381a4e63aefb9dc9aa4
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,52 @@
+# Sign-off assessment
+
+No. Green unit tests and 100% line coverage do not establish safety here. The suite misses an unsafe governance domain, does not prove the claimed state divergence grows over time, and has not tested the contracts that liquidation will actually call.
+
+## 1. `reserveFactorWad`
+
+First, search every write path for `reserveFactorWad`: the setter, initializer, upgrade/migration hooks, storage writes, governance batching, and any alternate admin entry point. Confirm that the same range check applies everywhere and that the deployed governance route can only set values in the intended domain. For the stated formula, the natural domain is `0 <= reserveFactorWad < 1e18` if every positive redemption is meant to have a chance of succeeding. Merely checking `<= 1e18` still permits `1e18`, for which `net` is zero for every redemption and all redemptions revert. A value above `1e18` makes `1e18 - reserveFactorWad` underflow and panic in Solidity 0.8+, rather than producing the contract's intended error.
+
+Require boundary and property tests, not just the two ordinary examples:
+
+- Setter inputs: `0`, `1`, `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`.
+- Redemption assets around rounding thresholds: `0`, `1`, and values immediately below, at, and above the smallest amount for which `assets * (1e18 - reserveFactorWad) / 1e18` is nonzero.
+- Fuzz the accepted reserve domain and realistic asset domain. Assert that invalid reserve values are rejected by the setter with the expected custom error, accepted values cannot make subtraction underflow, and the computed result agrees with a higher-precision reference model. Also test multiplication overflow, or use/verify a full-precision `mulDiv` implementation if the asset range can make `assets * (...)` overflow.
+
+Meaningful evidence is a clearly documented economic invariant and tests enforcing it. If governance must not be able to disable all redemption, the setter must reject `reserveFactorWad >= 1e18`. If `1e18` is intentionally an emergency freeze, that exceptional behavior must be explicit, separately authorized and tested; it should not arise accidentally from an unrestricted numeric setter. The `net == 0` revert should also be shown to handle only the intended zero/dust cases.
+
+## 2. Repayment/accounting divergence
+
+One repayment proves only that a mismatch can exist. It does not prove accumulation.
+
+Build a stateful or sequence test containing multiple repayments, with the protocol cut nonzero on each one. Record after every step both the pool's relevant real asset balance and `accountedAssets`, starting from a known baseline. Define the discrepancy using the implementation's sign convention, for example:
+
+`gap_i = actualAssets_i - accountedAssets_i`
+
+Then derive a reference-model recurrence from the intended cash flows. If the described bug is isolated and the retained cut is omitted from accounting, the test should demonstrate, after each repayment,
+
+`gap_i - gap_(i-1) = retainedCut_i`
+
+and therefore
+
+`gap_n = gap_0 + sum(retainedCut_1 ... retainedCut_n)`.
+
+Use at least two nonzero-cut repayments; preferably fuzz the repayment count, amounts, fee rates, partial/full repayments, multiple borrowers, and rounding-producing amounts. Assert the recurrence after every operation, not merely that the final values differ. Control or model all other balance-changing events (deposits, withdrawals, donations, interest, liquidations, and token transfer fees) so they cannot explain the gap. Include zero-cut and rounded-to-zero-cut controls, which should not increase it.
+
+Meaningful evidence is a failing regression/property test on the current implementation whose observed gap equals the cumulative retained cuts, followed by the same test passing under the specified accounting invariant after the fix. A chart or two snapshots without the per-step reference model is not proof of accumulation.
+
+## 3. Chainlink feed and collateral token
+
+Mocks establish local control flow, not compatibility with the deployed contracts. Require a mainnet-fork integration test pinned to an immutable chain identity and block: chain ID, block number, and preferably block hash, using an archive-capable RPC endpoint. Do not fork `latest`, because its state changes and failures will not be reproducible. Record the production feed, collateral token, and any proxy/implementation addresses in the test configuration and assert that code exists at each expected address.
+
+On that pinned fork, deploy the pool or a minimal liquidation harness with its normal production configuration, but point it to the real production feed and collateral token. Create a liquidatable position deterministically by impersonating a known funded holder or by transferring fork-held collateral into the harness; fund test actors deterministically and avoid depending on a mutable live account at `latest`. If the full pool cannot be initialized at that historical block, document and version the fixture used to seed its local position state while keeping both external calls real.
+
+The test must execute the complete liquidation transaction and establish at least:
+
+- The feed call succeeds through the actual proxy/interface, and the test handles its real `decimals`, answer scaling, round ID, `updatedAt`, `answeredInRound`, and the protocol's stale/nonpositive-price checks.
+- The exact deployed collateral token accepts the pool's transfer method and return-data behavior. Assert pre/post balances of pool, liquidator/recipient, and any fee recipient, rather than relying only on an emitted event.
+- Liquidation eligibility, debt/collateral accounting, transferred collateral, protocol fee, and emitted events agree with an independent reference calculation using the returned production-feed value.
+- Revert paths remain correct for an invalid/stale price. Because historical Chainlink state cannot be edited directly, cover this with a separate controllable-feed test while retaining the fork test as the compatibility test.
+
+Make the fork fixture runnable in CI with a documented command, RPC environment variable, pinned tool/compiler versions, block number/hash, addresses, and expected assertions. Cache or otherwise provision a reliable archive RPC according to the project's CI policy. The evidence is a passing transaction trace and balance/state assertions against the real contracts at that pinned block—not simply successful `eth_call`s, ABI-compatible mocks, or an unpinned manual test.
+
+Sign-off should wait until the setter's intended domain is enforced, the repayment discrepancy is proven or disproven by a multi-step invariant, and the pinned-fork liquidation test passes against both production integrations.

tokens used
13,092
```

## final message

Completed the review and saved it to [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-2/testing-quiz-006/answer.md).

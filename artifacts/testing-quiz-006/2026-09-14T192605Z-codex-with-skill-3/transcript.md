# Executor transcript — 2026-09-14T192605Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192605Z-codex-with-skill-3/testing-quiz-006

## session

```text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192605Z-codex-with-skill-3/testing-quiz-006
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a162-877a-75e1-9bb1-76f3e4359748
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
I’m using the testing skill because this is a Foundry test-plan sufficiency review, especially where green coverage is being offered as deployment evidence. I’ll inspect its guidance, then write the assessment to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192605Z-codex-with-skill-3/testing-quiz-006
 succeeded in 0ms:
codex
The key boundary is subtler than just “reject values above 1e18”: at exactly `1e18` every positive redemption has zero net, and even `1e18 - 1` rounds ordinary small redemptions to zero. I’m making the required tests classify semantic usability as well as arithmetic behavior.
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192605Z-codex-with-skill-3/testing-quiz-006/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2ee96c561d587c793b3a4d11252211e397689ee8
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,54 @@
+# Test-plan sign-off
+
+No. A green, line-covered unit suite using standard mocks and single-operation examples is not enough to sign off an onchain credit pool. Coverage shows that statements executed; it does not show that the relevant input domain, state sequences, or deployed integrations were searched. Before deployment I would require the following evidence.
+
+## 1. `reserveFactorWad`: domain fuzzing and explicit boundary policy
+
+First specify the intended valid domain. For a factor used as `1e18 - reserveFactorWad`, values above `1e18` are arithmetically invalid, but that does not automatically make `1e18` semantically valid. At `1e18`, every positive redemption computes `net == 0` and reverts, so it disables redemption. If that is not an explicitly designed and access-controlled pause mechanism, the setter should reject it and the usable factor domain must be below `1e18`.
+
+Even `1e18 - 1` is not universally usable. Integer division gives nonzero net only when
+
+`assets * (1e18 - reserveFactorWad) >= 1e18`.
+
+Thus, at `reserveFactorWad == 1e18 - 1`, any `assets < 1e18` token units produces zero. The protocol must define the smallest supported redemption and choose its maximum reserve factor accordingly, rather than infer validity only from the subtraction. If `minAssets` must redeem successfully, the accepted cap must satisfy the formula for that value (and any intended rounding policy).
+
+Require a Foundry fuzz test over the setter's whole `uint256` input domain, using `bound()` to generate useful valid regions rather than discarding most cases with `vm.assume()`. Fuzz redemption amounts as a second dimension. At minimum, classify and test separately:
+
+- factor `0` and a nominal interior value;
+- the nearest value below the chosen cap, the exact cap, and the first representable value above it;
+- specifically `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`;
+- asset amounts `0`, `1`, the protocol's minimum supported redemption and its neighbours, representative values for the collateral's real decimals, and large values near multiplication-overflow boundaries.
+
+Meaningful evidence is a property-based result showing that every accepted configuration preserves the stated redemption property for all supported asset amounts, while every rejected boundary fails in the setter with the intended custom error. Preserve distinct regression tests for `1e18` producing zero net and values above `1e18` causing subtraction failure today: those are different failure modes. Also test unauthorized setters. A hand-picked test proving only the already-suspected bad value is useful regression evidence, but it is not the domain search.
+
+## 2. Repayment accounting: handler-driven invariant and a growing gap
+
+One deposit followed by one fee-bearing repayment proves only that accounting and custody diverge once. It does not prove that the divergence accumulates.
+
+Define the intended conservation equation. If retained protocol cuts are intentionally excluded from `accountedAssets`, track them explicitly as a claimable fee balance and require, subject to any documented components:
+
+`actual pool token balance == accountedAssets + retainedProtocolFees`.
+
+If there is no separate fee ledger and all pool-held assets are meant to be accounted, require the stronger equality:
+
+`actual pool token balance == accountedAssets`.
+
+Build a stateful Foundry invariant around a handler, not the pool directly. The handler should create funded, approved actors and perform bounded valid sequences of deposits, borrows, repayments (partial and full), redemptions, fee changes if allowed, and any fee collection path. Maintain ghost values for gross repayments and the cuts actually implied by the specified rounding. Use multiple actors where their interactions matter. Configure `fail_on_revert = true` while developing it and report call/revert statistics; a run in which random calls nearly all revert has searched no meaningful state.
+
+For a direct accumulation regression, execute at least two repayments that each produce a strictly positive cut. Let `gapN = actualBalance - accountedAssets`. Show after the first repayment that `gap1 == cut1`, and after the second that `gap2 == cut1 + cut2` and `gap2 > gap1` (adjusting the equation for any other documented balance component). The initial deposit is setup, not a second drift-producing event. Include rounding cases where a computed cut is zero so the test does not falsely demand strict growth on every repayment.
+
+Meaningful evidence is either a minimized invariant counterexample whose successful call trace contains multiple drift-producing repayments and shows the gap growing, or a passing invariant for the corrected, explicitly documented conservation equation across substantial successful sequence depth and runs. A snapshot after one repayment cannot support the word “accumulates.”
+
+## 3. Chainlink and collateral token: reproducible pinned-fork liquidation
+
+Mocks only test the team's assumptions about Chainlink and ERC-20 behavior. Add a Foundry fork test on the actual deployment network using the known production feed and collateral-token addresses.
+
+Pin an explicit block number in code or checked-in test configuration; do not fork latest. Record the chain ID, block number, RPC requirements, feed address, token address, and exact command/environment variable needed to rerun the test. Before relying on that block, confirm the chosen RPC endpoint supports historical state there with a historical `eth_call`; otherwise an archive-node failure can be mistaken for a protocol failure. Assert that both addresses have code and that the expected feed/token metadata and decimals match the configuration, so a wrong-network or wrong-address run fails clearly.
+
+On that fork, exercise the complete real liquidation path: read the real feed response at the pinned block, construct a borrower position that is liquidatable under that observed price, approve/use the deployed collateral token, call liquidation, and verify the actual pre/post token balances, ownership/collateral bookkeeping, debt reduction, emitted effects, and any return-data handling. Check all oracle fields the implementation relies on, including decimals, sign, round/timestamp freshness, and round consistency. The setup should derive thresholds from the pinned answer rather than hard-code a price from a different block.
+
+Prefer obtaining collateral from an account that holds it at the pinned block and impersonating that account to make a real transfer and approval. A storage-writing helper such as `deal` can be acceptable setup only if its limitations are documented; it must not replace exercising the deployed token's real `transfer`/`transferFrom`, balance changes, return behavior, and decimals. Do not mock the feed inside this integration test. If production liquidation depends on other deployed contracts, use their real pinned addresses too unless the test explicitly states and justifies the remaining boundary.
+
+Meaningful evidence is a deterministic passing fork test, rerunnable by another reviewer at the same block, plus recorded successful-call assertions against the real contracts. Add targeted negative fork cases where feasible (for example, a non-liquidatable position and the contract's actual handling of feed validity), but do not mutate the real feed and call that production integration evidence.
+
+Until the full-domain fuzz search, successful stateful invariant search, and pinned production-address fork test exist and their results are reviewed, deployment sign-off should be withheld.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2ee96c561d587c793b3a4d11252211e397689ee8
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,54 @@
+# Test-plan sign-off
+
+No. A green, line-covered unit suite using standard mocks and single-operation examples is not enough to sign off an onchain credit pool. Coverage shows that statements executed; it does not show that the relevant input domain, state sequences, or deployed integrations were searched. Before deployment I would require the following evidence.
+
+## 1. `reserveFactorWad`: domain fuzzing and explicit boundary policy
+
+First specify the intended valid domain. For a factor used as `1e18 - reserveFactorWad`, values above `1e18` are arithmetically invalid, but that does not automatically make `1e18` semantically valid. At `1e18`, every positive redemption computes `net == 0` and reverts, so it disables redemption. If that is not an explicitly designed and access-controlled pause mechanism, the setter should reject it and the usable factor domain must be below `1e18`.
+
+Even `1e18 - 1` is not universally usable. Integer division gives nonzero net only when
+
+`assets * (1e18 - reserveFactorWad) >= 1e18`.
+
+Thus, at `reserveFactorWad == 1e18 - 1`, any `assets < 1e18` token units produces zero. The protocol must define the smallest supported redemption and choose its maximum reserve factor accordingly, rather than infer validity only from the subtraction. If `minAssets` must redeem successfully, the accepted cap must satisfy the formula for that value (and any intended rounding policy).
+
+Require a Foundry fuzz test over the setter's whole `uint256` input domain, using `bound()` to generate useful valid regions rather than discarding most cases with `vm.assume()`. Fuzz redemption amounts as a second dimension. At minimum, classify and test separately:
+
+- factor `0` and a nominal interior value;
+- the nearest value below the chosen cap, the exact cap, and the first representable value above it;
+- specifically `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`;
+- asset amounts `0`, `1`, the protocol's minimum supported redemption and its neighbours, representative values for the collateral's real decimals, and large values near multiplication-overflow boundaries.
+
+Meaningful evidence is a property-based result showing that every accepted configuration preserves the stated redemption property for all supported asset amounts, while every rejected boundary fails in the setter with the intended custom error. Preserve distinct regression tests for `1e18` producing zero net and values above `1e18` causing subtraction failure today: those are different failure modes. Also test unauthorized setters. A hand-picked test proving only the already-suspected bad value is useful regression evidence, but it is not the domain search.
+
+## 2. Repayment accounting: handler-driven invariant and a growing gap
+
+One deposit followed by one fee-bearing repayment proves only that accounting and custody diverge once. It does not prove that the divergence accumulates.
+
+Define the intended conservation equation. If retained protocol cuts are intentionally excluded from `accountedAssets`, track them explicitly as a claimable fee balance and require, subject to any documented components:
+
+`actual pool token balance == accountedAssets + retainedProtocolFees`.
+
+If there is no separate fee ledger and all pool-held assets are meant to be accounted, require the stronger equality:
+
+`actual pool token balance == accountedAssets`.
+
+Build a stateful Foundry invariant around a handler, not the pool directly. The handler should create funded, approved actors and perform bounded valid sequences of deposits, borrows, repayments (partial and full), redemptions, fee changes if allowed, and any fee collection path. Maintain ghost values for gross repayments and the cuts actually implied by the specified rounding. Use multiple actors where their interactions matter. Configure `fail_on_revert = true` while developing it and report call/revert statistics; a run in which random calls nearly all revert has searched no meaningful state.
+
+For a direct accumulation regression, execute at least two repayments that each produce a strictly positive cut. Let `gapN = actualBalance - accountedAssets`. Show after the first repayment that `gap1 == cut1`, and after the second that `gap2 == cut1 + cut2` and `gap2 > gap1` (adjusting the equation for any other documented balance component). The initial deposit is setup, not a second drift-producing event. Include rounding cases where a computed cut is zero so the test does not falsely demand strict growth on every repayment.
+
+Meaningful evidence is either a minimized invariant counterexample whose successful call trace contains multiple drift-producing repayments and shows the gap growing, or a passing invariant for the corrected, explicitly documented conservation equation across substantial successful sequence depth and runs. A snapshot after one repayment cannot support the word “accumulates.”
+
+## 3. Chainlink and collateral token: reproducible pinned-fork liquidation
+
+Mocks only test the team's assumptions about Chainlink and ERC-20 behavior. Add a Foundry fork test on the actual deployment network using the known production feed and collateral-token addresses.
+
+Pin an explicit block number in code or checked-in test configuration; do not fork latest. Record the chain ID, block number, RPC requirements, feed address, token address, and exact command/environment variable needed to rerun the test. Before relying on that block, confirm the chosen RPC endpoint supports historical state there with a historical `eth_call`; otherwise an archive-node failure can be mistaken for a protocol failure. Assert that both addresses have code and that the expected feed/token metadata and decimals match the configuration, so a wrong-network or wrong-address run fails clearly.
+
+On that fork, exercise the complete real liquidation path: read the real feed response at the pinned block, construct a borrower position that is liquidatable under that observed price, approve/use the deployed collateral token, call liquidation, and verify the actual pre/post token balances, ownership/collateral bookkeeping, debt reduction, emitted effects, and any return-data handling. Check all oracle fields the implementation relies on, including decimals, sign, round/timestamp freshness, and round consistency. The setup should derive thresholds from the pinned answer rather than hard-code a price from a different block.
+
+Prefer obtaining collateral from an account that holds it at the pinned block and impersonating that account to make a real transfer and approval. A storage-writing helper such as `deal` can be acceptable setup only if its limitations are documented; it must not replace exercising the deployed token's real `transfer`/`transferFrom`, balance changes, return behavior, and decimals. Do not mock the feed inside this integration test. If production liquidation depends on other deployed contracts, use their real pinned addresses too unless the test explicitly states and justifies the remaining boundary.
+
+Meaningful evidence is a deterministic passing fork test, rerunnable by another reviewer at the same block, plus recorded successful-call assertions against the real contracts. Add targeted negative fork cases where feasible (for example, a non-liquidatable position and the contract's actual handling of feed validity), but do not mutate the real feed and call that production integration evidence.
+
+Until the full-domain fuzz search, successful stateful invariant search, and pinned production-address fork test exist and their results are reviewed, deployment sign-off should be withheld.

exec
/bin/bash -lc "wc -l answer.md && sed -n '1,40p' answer.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192605Z-codex-with-skill-3/testing-quiz-006
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
54 answer.md
# Test-plan sign-off

No. A green, line-covered unit suite using standard mocks and single-operation examples is not enough to sign off an onchain credit pool. Coverage shows that statements executed; it does not show that the relevant input domain, state sequences, or deployed integrations were searched. Before deployment I would require the following evidence.

## 1. `reserveFactorWad`: domain fuzzing and explicit boundary policy

First specify the intended valid domain. For a factor used as `1e18 - reserveFactorWad`, values above `1e18` are arithmetically invalid, but that does not automatically make `1e18` semantically valid. At `1e18`, every positive redemption computes `net == 0` and reverts, so it disables redemption. If that is not an explicitly designed and access-controlled pause mechanism, the setter should reject it and the usable factor domain must be below `1e18`.

Even `1e18 - 1` is not universally usable. Integer division gives nonzero net only when

`assets * (1e18 - reserveFactorWad) >= 1e18`.

Thus, at `reserveFactorWad == 1e18 - 1`, any `assets < 1e18` token units produces zero. The protocol must define the smallest supported redemption and choose its maximum reserve factor accordingly, rather than infer validity only from the subtraction. If `minAssets` must redeem successfully, the accepted cap must satisfy the formula for that value (and any intended rounding policy).

Require a Foundry fuzz test over the setter's whole `uint256` input domain, using `bound()` to generate useful valid regions rather than discarding most cases with `vm.assume()`. Fuzz redemption amounts as a second dimension. At minimum, classify and test separately:

- factor `0` and a nominal interior value;
- the nearest value below the chosen cap, the exact cap, and the first representable value above it;
- specifically `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`;
- asset amounts `0`, `1`, the protocol's minimum supported redemption and its neighbours, representative values for the collateral's real decimals, and large values near multiplication-overflow boundaries.

Meaningful evidence is a property-based result showing that every accepted configuration preserves the stated redemption property for all supported asset amounts, while every rejected boundary fails in the setter with the intended custom error. Preserve distinct regression tests for `1e18` producing zero net and values above `1e18` causing subtraction failure today: those are different failure modes. Also test unauthorized setters. A hand-picked test proving only the already-suspected bad value is useful regression evidence, but it is not the domain search.

## 2. Repayment accounting: handler-driven invariant and a growing gap

One deposit followed by one fee-bearing repayment proves only that accounting and custody diverge once. It does not prove that the divergence accumulates.

Define the intended conservation equation. If retained protocol cuts are intentionally excluded from `accountedAssets`, track them explicitly as a claimable fee balance and require, subject to any documented components:

`actual pool token balance == accountedAssets + retainedProtocolFees`.

If there is no separate fee ledger and all pool-held assets are meant to be accounted, require the stronger equality:

`actual pool token balance == accountedAssets`.

Build a stateful Foundry invariant around a handler, not the pool directly. The handler should create funded, approved actors and perform bounded valid sequences of deposits, borrows, repayments (partial and full), redemptions, fee changes if allowed, and any fee collection path. Maintain ghost values for gross repayments and the cuts actually implied by the specified rounding. Use multiple actors where their interactions matter. Configure `fail_on_revert = true` while developing it and report call/revert statistics; a run in which random calls nearly all revert has searched no meaningful state.

For a direct accumulation regression, execute at least two repayments that each produce a strictly positive cut. Let `gapN = actualBalance - accountedAssets`. Show after the first repayment that `gap1 == cut1`, and after the second that `gap2 == cut1 + cut2` and `gap2 > gap1` (adjusting the equation for any other documented balance component). The initial deposit is setup, not a second drift-producing event. Include rounding cases where a computed cut is zero so the test does not falsely demand strict growth on every repayment.

Meaningful evidence is either a minimized invariant counterexample whose successful call trace contains multiple drift-producing repayments and shows the gap growing, or a passing invariant for the corrected, explicitly documented conservation equation across substantial successful sequence depth and runs. A snapshot after one repayment cannot support the word “accumulates.”

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2ee96c561d587c793b3a4d11252211e397689ee8
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,54 @@
+# Test-plan sign-off
+
+No. A green, line-covered unit suite using standard mocks and single-operation examples is not enough to sign off an onchain credit pool. Coverage shows that statements executed; it does not show that the relevant input domain, state sequences, or deployed integrations were searched. Before deployment I would require the following evidence.
+
+## 1. `reserveFactorWad`: domain fuzzing and explicit boundary policy
+
+First specify the intended valid domain. For a factor used as `1e18 - reserveFactorWad`, values above `1e18` are arithmetically invalid, but that does not automatically make `1e18` semantically valid. At `1e18`, every positive redemption computes `net == 0` and reverts, so it disables redemption. If that is not an explicitly designed and access-controlled pause mechanism, the setter should reject it and the usable factor domain must be below `1e18`.
+
+Even `1e18 - 1` is not universally usable. Integer division gives nonzero net only when
+
+`assets * (1e18 - reserveFactorWad) >= 1e18`.
+
+Thus, at `reserveFactorWad == 1e18 - 1`, any `assets < 1e18` token units produces zero. The protocol must define the smallest supported redemption and choose its maximum reserve factor accordingly, rather than infer validity only from the subtraction. If `minAssets` must redeem successfully, the accepted cap must satisfy the formula for that value (and any intended rounding policy).
+
+Require a Foundry fuzz test over the setter's whole `uint256` input domain, using `bound()` to generate useful valid regions rather than discarding most cases with `vm.assume()`. Fuzz redemption amounts as a second dimension. At minimum, classify and test separately:
+
+- factor `0` and a nominal interior value;
+- the nearest value below the chosen cap, the exact cap, and the first representable value above it;
+- specifically `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`;
+- asset amounts `0`, `1`, the protocol's minimum supported redemption and its neighbours, representative values for the collateral's real decimals, and large values near multiplication-overflow boundaries.
+
+Meaningful evidence is a property-based result showing that every accepted configuration preserves the stated redemption property for all supported asset amounts, while every rejected boundary fails in the setter with the intended custom error. Preserve distinct regression tests for `1e18` producing zero net and values above `1e18` causing subtraction failure today: those are different failure modes. Also test unauthorized setters. A hand-picked test proving only the already-suspected bad value is useful regression evidence, but it is not the domain search.
+
+## 2. Repayment accounting: handler-driven invariant and a growing gap
+
+One deposit followed by one fee-bearing repayment proves only that accounting and custody diverge once. It does not prove that the divergence accumulates.
+
+Define the intended conservation equation. If retained protocol cuts are intentionally excluded from `accountedAssets`, track them explicitly as a claimable fee balance and require, subject to any documented components:
+
+`actual pool token balance == accountedAssets + retainedProtocolFees`.
+
+If there is no separate fee ledger and all pool-held assets are meant to be accounted, require the stronger equality:
+
+`actual pool token balance == accountedAssets`.
+
+Build a stateful Foundry invariant around a handler, not the pool directly. The handler should create funded, approved actors and perform bounded valid sequences of deposits, borrows, repayments (partial and full), redemptions, fee changes if allowed, and any fee collection path. Maintain ghost values for gross repayments and the cuts actually implied by the specified rounding. Use multiple actors where their interactions matter. Configure `fail_on_revert = true` while developing it and report call/revert statistics; a run in which random calls nearly all revert has searched no meaningful state.
+
+For a direct accumulation regression, execute at least two repayments that each produce a strictly positive cut. Let `gapN = actualBalance - accountedAssets`. Show after the first repayment that `gap1 == cut1`, and after the second that `gap2 == cut1 + cut2` and `gap2 > gap1` (adjusting the equation for any other documented balance component). The initial deposit is setup, not a second drift-producing event. Include rounding cases where a computed cut is zero so the test does not falsely demand strict growth on every repayment.
+
+Meaningful evidence is either a minimized invariant counterexample whose successful call trace contains multiple drift-producing repayments and shows the gap growing, or a passing invariant for the corrected, explicitly documented conservation equation across substantial successful sequence depth and runs. A snapshot after one repayment cannot support the word “accumulates.”
+
+## 3. Chainlink and collateral token: reproducible pinned-fork liquidation
+
+Mocks only test the team's assumptions about Chainlink and ERC-20 behavior. Add a Foundry fork test on the actual deployment network using the known production feed and collateral-token addresses.
+
+Pin an explicit block number in code or checked-in test configuration; do not fork latest. Record the chain ID, block number, RPC requirements, feed address, token address, and exact command/environment variable needed to rerun the test. Before relying on that block, confirm the chosen RPC endpoint supports historical state there with a historical `eth_call`; otherwise an archive-node failure can be mistaken for a protocol failure. Assert that both addresses have code and that the expected feed/token metadata and decimals match the configuration, so a wrong-network or wrong-address run fails clearly.
+
+On that fork, exercise the complete real liquidation path: read the real feed response at the pinned block, construct a borrower position that is liquidatable under that observed price, approve/use the deployed collateral token, call liquidation, and verify the actual pre/post token balances, ownership/collateral bookkeeping, debt reduction, emitted effects, and any return-data handling. Check all oracle fields the implementation relies on, including decimals, sign, round/timestamp freshness, and round consistency. The setup should derive thresholds from the pinned answer rather than hard-code a price from a different block.
+
+Prefer obtaining collateral from an account that holds it at the pinned block and impersonating that account to make a real transfer and approval. A storage-writing helper such as `deal` can be acceptable setup only if its limitations are documented; it must not replace exercising the deployed token's real `transfer`/`transferFrom`, balance changes, return behavior, and decimals. Do not mock the feed inside this integration test. If production liquidation depends on other deployed contracts, use their real pinned addresses too unless the test explicitly states and justifies the remaining boundary.
+
+Meaningful evidence is a deterministic passing fork test, rerunnable by another reviewer at the same block, plus recorded successful-call assertions against the real contracts. Add targeted negative fork cases where feasible (for example, a non-liquidatable position and the contract's actual handling of feed validity), but do not mutate the real feed and call that production integration evidence.
+
+Until the full-domain fuzz search, successful stateful invariant search, and pinned production-address fork test exist and their results are reviewed, deployment sign-off should be withheld.

codex
Completed the test-plan assessment in [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192605Z-codex-with-skill-3/testing-quiz-006/answer.md).
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2ee96c561d587c793b3a4d11252211e397689ee8
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,54 @@
+# Test-plan sign-off
+
+No. A green, line-covered unit suite using standard mocks and single-operation examples is not enough to sign off an onchain credit pool. Coverage shows that statements executed; it does not show that the relevant input domain, state sequences, or deployed integrations were searched. Before deployment I would require the following evidence.
+
+## 1. `reserveFactorWad`: domain fuzzing and explicit boundary policy
+
+First specify the intended valid domain. For a factor used as `1e18 - reserveFactorWad`, values above `1e18` are arithmetically invalid, but that does not automatically make `1e18` semantically valid. At `1e18`, every positive redemption computes `net == 0` and reverts, so it disables redemption. If that is not an explicitly designed and access-controlled pause mechanism, the setter should reject it and the usable factor domain must be below `1e18`.
+
+Even `1e18 - 1` is not universally usable. Integer division gives nonzero net only when
+
+`assets * (1e18 - reserveFactorWad) >= 1e18`.
+
+Thus, at `reserveFactorWad == 1e18 - 1`, any `assets < 1e18` token units produces zero. The protocol must define the smallest supported redemption and choose its maximum reserve factor accordingly, rather than infer validity only from the subtraction. If `minAssets` must redeem successfully, the accepted cap must satisfy the formula for that value (and any intended rounding policy).
+
+Require a Foundry fuzz test over the setter's whole `uint256` input domain, using `bound()` to generate useful valid regions rather than discarding most cases with `vm.assume()`. Fuzz redemption amounts as a second dimension. At minimum, classify and test separately:
+
+- factor `0` and a nominal interior value;
+- the nearest value below the chosen cap, the exact cap, and the first representable value above it;
+- specifically `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`;
+- asset amounts `0`, `1`, the protocol's minimum supported redemption and its neighbours, representative values for the collateral's real decimals, and large values near multiplication-overflow boundaries.
+
+Meaningful evidence is a property-based result showing that every accepted configuration preserves the stated redemption property for all supported asset amounts, while every rejected boundary fails in the setter with the intended custom error. Preserve distinct regression tests for `1e18` producing zero net and values above `1e18` causing subtraction failure today: those are different failure modes. Also test unauthorized setters. A hand-picked test proving only the already-suspected bad value is useful regression evidence, but it is not the domain search.
+
+## 2. Repayment accounting: handler-driven invariant and a growing gap
+
+One deposit followed by one fee-bearing repayment proves only that accounting and custody diverge once. It does not prove that the divergence accumulates.
+
+Define the intended conservation equation. If retained protocol cuts are intentionally excluded from `accountedAssets`, track them explicitly as a claimable fee balance and require, subject to any documented components:
+
+`actual pool token balance == accountedAssets + retainedProtocolFees`.
+
+If there is no separate fee ledger and all pool-held assets are meant to be accounted, require the stronger equality:
+
+`actual pool token balance == accountedAssets`.
+
+Build a stateful Foundry invariant around a handler, not the pool directly. The handler should create funded, approved actors and perform bounded valid sequences of deposits, borrows, repayments (partial and full), redemptions, fee changes if allowed, and any fee collection path. Maintain ghost values for gross repayments and the cuts actually implied by the specified rounding. Use multiple actors where their interactions matter. Configure `fail_on_revert = true` while developing it and report call/revert statistics; a run in which random calls nearly all revert has searched no meaningful state.
+
+For a direct accumulation regression, execute at least two repayments that each produce a strictly positive cut. Let `gapN = actualBalance - accountedAssets`. Show after the first repayment that `gap1 == cut1`, and after the second that `gap2 == cut1 + cut2` and `gap2 > gap1` (adjusting the equation for any other documented balance component). The initial deposit is setup, not a second drift-producing event. Include rounding cases where a computed cut is zero so the test does not falsely demand strict growth on every repayment.
+
+Meaningful evidence is either a minimized invariant counterexample whose successful call trace contains multiple drift-producing repayments and shows the gap growing, or a passing invariant for the corrected, explicitly documented conservation equation across substantial successful sequence depth and runs. A snapshot after one repayment cannot support the word “accumulates.”
+
+## 3. Chainlink and collateral token: reproducible pinned-fork liquidation
+
+Mocks only test the team's assumptions about Chainlink and ERC-20 behavior. Add a Foundry fork test on the actual deployment network using the known production feed and collateral-token addresses.
+
+Pin an explicit block number in code or checked-in test configuration; do not fork latest. Record the chain ID, block number, RPC requirements, feed address, token address, and exact command/environment variable needed to rerun the test. Before relying on that block, confirm the chosen RPC endpoint supports historical state there with a historical `eth_call`; otherwise an archive-node failure can be mistaken for a protocol failure. Assert that both addresses have code and that the expected feed/token metadata and decimals match the configuration, so a wrong-network or wrong-address run fails clearly.
+
+On that fork, exercise the complete real liquidation path: read the real feed response at the pinned block, construct a borrower position that is liquidatable under that observed price, approve/use the deployed collateral token, call liquidation, and verify the actual pre/post token balances, ownership/collateral bookkeeping, debt reduction, emitted effects, and any return-data handling. Check all oracle fields the implementation relies on, including decimals, sign, round/timestamp freshness, and round consistency. The setup should derive thresholds from the pinned answer rather than hard-code a price from a different block.
+
+Prefer obtaining collateral from an account that holds it at the pinned block and impersonating that account to make a real transfer and approval. A storage-writing helper such as `deal` can be acceptable setup only if its limitations are documented; it must not replace exercising the deployed token's real `transfer`/`transferFrom`, balance changes, return behavior, and decimals. Do not mock the feed inside this integration test. If production liquidation depends on other deployed contracts, use their real pinned addresses too unless the test explicitly states and justifies the remaining boundary.
+
+Meaningful evidence is a deterministic passing fork test, rerunnable by another reviewer at the same block, plus recorded successful-call assertions against the real contracts. Add targeted negative fork cases where feasible (for example, a non-liquidatable position and the contract's actual handling of feed validity), but do not mutate the real feed and call that production integration evidence.
+
+Until the full-domain fuzz search, successful stateful invariant search, and pinned production-address fork test exist and their results are reviewed, deployment sign-off should be withheld.

tokens used
11,928
```

## final message

Completed the test-plan assessment in [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192605Z-codex-with-skill-3/testing-quiz-006/answer.md).

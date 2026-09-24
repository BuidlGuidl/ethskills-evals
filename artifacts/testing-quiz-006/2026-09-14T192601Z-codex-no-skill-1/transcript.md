# Executor transcript — 2026-09-14T192601Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-1/testing-quiz-006

## session

```text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-1/testing-quiz-006
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a162-8bbb-7771-b18e-c7e5cdb6b06b
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
I’ll turn this into a concrete sign-off assessment, separating boundary/property testing, stateful accumulation evidence, and pinned-fork integration testing.
exec
/bin/bash -lc 'ls -la && find .. -name AGENTS.md -print' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-1/testing-quiz-006
 succeeded in 2ms:
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-1/testing-quiz-006/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..aa9ab963d49fb985a5f1dc61af15013c2f3a1e1b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,36 @@
+# Sign-off assessment
+
+No. Green line coverage over mocks and single-operation examples is not enough to sign off. It establishes that the exercised statements ran, but not that the input domain, repeated-state behavior, or deployed integrations are correct.
+
+## 1. `reserveFactorWad`
+
+Require a review of every write path and a property/fuzz test over both `reserveFactorWad` and `assets`, not just two examples. At minimum, test the governance values `0`, `1`, `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`, plus values around any intended bound. For each positive denominator `d = 1e18 - reserveFactorWad`, test assets immediately below, at, and above the first value that produces nonzero net (`ceil(1e18 / d)`), as well as representative large values.
+
+The intended policy must first be explicit. If a 100% reserve factor is not valid, the setter should reject `reserveFactorWad >= 1e18`; if 100% is deliberately configurable, the system must define the consequence that every positive redemption has `net == 0` and reverts. Values above `1e18` must be rejected at the setter: under Solidity 0.8 checked arithmetic, redemption otherwise underflows at `1e18 - reserveFactorWad`. Merely proving that a later redemption reverts is not acceptable validation because it permits governance to place the pool in a broken state.
+
+The property for every accepted value should be that redemption neither unexpectedly reverts nor pays more than `assets`, and that its result equals the specified rounding rule. Include `assets == 0` according to the documented API behavior. Also search for overflow in `assets * (1e18 - reserveFactorWad)`: large valid `assets` can overflow the intermediate product even when the mathematical quotient fits. Evidence is meaningful only if the fuzz domain is not artificially capped below that region; either prove a protocol-level asset bound makes it unreachable or use/test a full-precision `mulDiv` implementation. Preserve failing seeds and add the discovered boundary cases as regression tests.
+
+## 2. Repayment/accounting drift
+
+One repayment demonstrates a discrepancy exists; it does not demonstrate accumulation. Require a stateful sequence test or invariant campaign that performs at least two nonzero-cut repayments against the same pool. Use varied repayment sizes and borrowers, and include realistic interleavings such as deposits, draws, partial repayments, redemptions, and full repayment. Record after every step:
+
+- the collateral/asset token balance actually held by the pool;
+- `accountedAssets` and any debt totals;
+- the protocol cut for that step; and
+- the discrepancy before and after the step.
+
+If `D_i = actualAssets_i - accountedAssets_i`, accumulation is demonstrated when, after controlling for all other specified cash flows, `D_i - D_(i-1)` equals the retained cut for repayment `i`, and after `n` repayments `D_n = D_0 + sum(cut_i)` (subject only to explicitly documented rounding). Show this for multiple sequence lengths, including zero-cut/dust boundaries and partial repayments. A stronger invariant test should compare the implementation after every action with a small reference accounting model and shrink any failure to a reproducible action sequence.
+
+Meaningful evidence is the per-step trace and the final equality to the sum of cuts across multiple repayments—not simply a nonzero final mismatch. The team must then classify the result against the intended accounting model: if retained cuts are owned assets, either `accountedAssets` must include them or a separate protocol-reserve liability/asset field must reconcile the balance. A reproducible growing mismatch is evidence of a bug, not evidence that the implementation is safe.
+
+## 3. Chainlink and collateral-token integrations
+
+Require integration tests on a fork of the actual target chain, pinned to an explicit block number and chain ID and backed by an archive-capable RPC endpoint. Deploy the candidate pool/configuration on that fork using the exact production feed and collateral-token addresses (or exercise the deployed contracts if they already exist). Do not replace either address with a mock. Assert the addresses, that code exists at them, and the expected token decimals/symbol and feed decimals/description/version so a configuration error fails loudly.
+
+The liquidation test must make a genuinely liquidatable position using deterministic fork setup, call the real Chainlink proxy's `latestRoundData`, pass that value through the production normalization and health calculation, execute liquidation, and prove via pre/post balances and emitted events that the real collateral token moved between the intended parties by the expected amount. It should also assert the round fields the implementation relies on: positive answer, nonzero `updatedAt`, acceptable freshness, and `answeredInRound >= roundId`. If the token has nonstandard transfer behavior, fees, rebasing, pausing, or unusual decimals, the assertions must reflect the actual contract rather than ERC-20 assumptions.
+
+Reproducibility requires committing the fork test, chain ID, fixed block, contract addresses, configuration values, setup accounts/amounts, and commands needed to run it. Token balances may be prepared deterministically with the test framework on the fork, but the liquidation itself must call the production token contract; if impersonating a funded holder is necessary, pin and document that holder and verify its balance at the chosen block. Never depend on “latest” state or an unrecorded public-RPC response.
+
+Keep separate local tests for adverse oracle states—zero/negative answers, stale rounds, incomplete rounds, extreme decimals—and token failures, because a pinned live feed normally cannot be forced into those conditions. The fork test answers “are the chosen production contracts and assumptions compatible?”; the mock edge tests answer “does the pool fail safely when an integration misbehaves?” Both are required.
+
+Sign-off should remain blocked until the governance domain is enforced and proven, the accounting behavior is validated over sequences against an explicit invariant, and the real production-address liquidation path passes on a reproducible pinned fork.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..aa9ab963d49fb985a5f1dc61af15013c2f3a1e1b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,36 @@
+# Sign-off assessment
+
+No. Green line coverage over mocks and single-operation examples is not enough to sign off. It establishes that the exercised statements ran, but not that the input domain, repeated-state behavior, or deployed integrations are correct.
+
+## 1. `reserveFactorWad`
+
+Require a review of every write path and a property/fuzz test over both `reserveFactorWad` and `assets`, not just two examples. At minimum, test the governance values `0`, `1`, `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`, plus values around any intended bound. For each positive denominator `d = 1e18 - reserveFactorWad`, test assets immediately below, at, and above the first value that produces nonzero net (`ceil(1e18 / d)`), as well as representative large values.
+
+The intended policy must first be explicit. If a 100% reserve factor is not valid, the setter should reject `reserveFactorWad >= 1e18`; if 100% is deliberately configurable, the system must define the consequence that every positive redemption has `net == 0` and reverts. Values above `1e18` must be rejected at the setter: under Solidity 0.8 checked arithmetic, redemption otherwise underflows at `1e18 - reserveFactorWad`. Merely proving that a later redemption reverts is not acceptable validation because it permits governance to place the pool in a broken state.
+
+The property for every accepted value should be that redemption neither unexpectedly reverts nor pays more than `assets`, and that its result equals the specified rounding rule. Include `assets == 0` according to the documented API behavior. Also search for overflow in `assets * (1e18 - reserveFactorWad)`: large valid `assets` can overflow the intermediate product even when the mathematical quotient fits. Evidence is meaningful only if the fuzz domain is not artificially capped below that region; either prove a protocol-level asset bound makes it unreachable or use/test a full-precision `mulDiv` implementation. Preserve failing seeds and add the discovered boundary cases as regression tests.
+
+## 2. Repayment/accounting drift
+
+One repayment demonstrates a discrepancy exists; it does not demonstrate accumulation. Require a stateful sequence test or invariant campaign that performs at least two nonzero-cut repayments against the same pool. Use varied repayment sizes and borrowers, and include realistic interleavings such as deposits, draws, partial repayments, redemptions, and full repayment. Record after every step:
+
+- the collateral/asset token balance actually held by the pool;
+- `accountedAssets` and any debt totals;
+- the protocol cut for that step; and
+- the discrepancy before and after the step.
+
+If `D_i = actualAssets_i - accountedAssets_i`, accumulation is demonstrated when, after controlling for all other specified cash flows, `D_i - D_(i-1)` equals the retained cut for repayment `i`, and after `n` repayments `D_n = D_0 + sum(cut_i)` (subject only to explicitly documented rounding). Show this for multiple sequence lengths, including zero-cut/dust boundaries and partial repayments. A stronger invariant test should compare the implementation after every action with a small reference accounting model and shrink any failure to a reproducible action sequence.
+
+Meaningful evidence is the per-step trace and the final equality to the sum of cuts across multiple repayments—not simply a nonzero final mismatch. The team must then classify the result against the intended accounting model: if retained cuts are owned assets, either `accountedAssets` must include them or a separate protocol-reserve liability/asset field must reconcile the balance. A reproducible growing mismatch is evidence of a bug, not evidence that the implementation is safe.
+
+## 3. Chainlink and collateral-token integrations
+
+Require integration tests on a fork of the actual target chain, pinned to an explicit block number and chain ID and backed by an archive-capable RPC endpoint. Deploy the candidate pool/configuration on that fork using the exact production feed and collateral-token addresses (or exercise the deployed contracts if they already exist). Do not replace either address with a mock. Assert the addresses, that code exists at them, and the expected token decimals/symbol and feed decimals/description/version so a configuration error fails loudly.
+
+The liquidation test must make a genuinely liquidatable position using deterministic fork setup, call the real Chainlink proxy's `latestRoundData`, pass that value through the production normalization and health calculation, execute liquidation, and prove via pre/post balances and emitted events that the real collateral token moved between the intended parties by the expected amount. It should also assert the round fields the implementation relies on: positive answer, nonzero `updatedAt`, acceptable freshness, and `answeredInRound >= roundId`. If the token has nonstandard transfer behavior, fees, rebasing, pausing, or unusual decimals, the assertions must reflect the actual contract rather than ERC-20 assumptions.
+
+Reproducibility requires committing the fork test, chain ID, fixed block, contract addresses, configuration values, setup accounts/amounts, and commands needed to run it. Token balances may be prepared deterministically with the test framework on the fork, but the liquidation itself must call the production token contract; if impersonating a funded holder is necessary, pin and document that holder and verify its balance at the chosen block. Never depend on “latest” state or an unrecorded public-RPC response.
+
+Keep separate local tests for adverse oracle states—zero/negative answers, stale rounds, incomplete rounds, extreme decimals—and token failures, because a pinned live feed normally cannot be forced into those conditions. The fork test answers “are the chosen production contracts and assumptions compatible?”; the mock edge tests answer “does the pool fail safely when an integration misbehaves?” Both are required.
+
+Sign-off should remain blocked until the governance domain is enforced and proven, the accounting behavior is validated over sequences against an explicit invariant, and the real production-address liquidation path passes on a reproducible pinned fork.

exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-1/testing-quiz-006
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Sign-off assessment

No. Green line coverage over mocks and single-operation examples is not enough to sign off. It establishes that the exercised statements ran, but not that the input domain, repeated-state behavior, or deployed integrations are correct.

## 1. `reserveFactorWad`

Require a review of every write path and a property/fuzz test over both `reserveFactorWad` and `assets`, not just two examples. At minimum, test the governance values `0`, `1`, `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`, plus values around any intended bound. For each positive denominator `d = 1e18 - reserveFactorWad`, test assets immediately below, at, and above the first value that produces nonzero net (`ceil(1e18 / d)`), as well as representative large values.

The intended policy must first be explicit. If a 100% reserve factor is not valid, the setter should reject `reserveFactorWad >= 1e18`; if 100% is deliberately configurable, the system must define the consequence that every positive redemption has `net == 0` and reverts. Values above `1e18` must be rejected at the setter: under Solidity 0.8 checked arithmetic, redemption otherwise underflows at `1e18 - reserveFactorWad`. Merely proving that a later redemption reverts is not acceptable validation because it permits governance to place the pool in a broken state.

The property for every accepted value should be that redemption neither unexpectedly reverts nor pays more than `assets`, and that its result equals the specified rounding rule. Include `assets == 0` according to the documented API behavior. Also search for overflow in `assets * (1e18 - reserveFactorWad)`: large valid `assets` can overflow the intermediate product even when the mathematical quotient fits. Evidence is meaningful only if the fuzz domain is not artificially capped below that region; either prove a protocol-level asset bound makes it unreachable or use/test a full-precision `mulDiv` implementation. Preserve failing seeds and add the discovered boundary cases as regression tests.

## 2. Repayment/accounting drift

One repayment demonstrates a discrepancy exists; it does not demonstrate accumulation. Require a stateful sequence test or invariant campaign that performs at least two nonzero-cut repayments against the same pool. Use varied repayment sizes and borrowers, and include realistic interleavings such as deposits, draws, partial repayments, redemptions, and full repayment. Record after every step:

- the collateral/asset token balance actually held by the pool;
- `accountedAssets` and any debt totals;
- the protocol cut for that step; and
- the discrepancy before and after the step.

If `D_i = actualAssets_i - accountedAssets_i`, accumulation is demonstrated when, after controlling for all other specified cash flows, `D_i - D_(i-1)` equals the retained cut for repayment `i`, and after `n` repayments `D_n = D_0 + sum(cut_i)` (subject only to explicitly documented rounding). Show this for multiple sequence lengths, including zero-cut/dust boundaries and partial repayments. A stronger invariant test should compare the implementation after every action with a small reference accounting model and shrink any failure to a reproducible action sequence.

Meaningful evidence is the per-step trace and the final equality to the sum of cuts across multiple repayments—not simply a nonzero final mismatch. The team must then classify the result against the intended accounting model: if retained cuts are owned assets, either `accountedAssets` must include them or a separate protocol-reserve liability/asset field must reconcile the balance. A reproducible growing mismatch is evidence of a bug, not evidence that the implementation is safe.

## 3. Chainlink and collateral-token integrations

Require integration tests on a fork of the actual target chain, pinned to an explicit block number and chain ID and backed by an archive-capable RPC endpoint. Deploy the candidate pool/configuration on that fork using the exact production feed and collateral-token addresses (or exercise the deployed contracts if they already exist). Do not replace either address with a mock. Assert the addresses, that code exists at them, and the expected token decimals/symbol and feed decimals/description/version so a configuration error fails loudly.

The liquidation test must make a genuinely liquidatable position using deterministic fork setup, call the real Chainlink proxy's `latestRoundData`, pass that value through the production normalization and health calculation, execute liquidation, and prove via pre/post balances and emitted events that the real collateral token moved between the intended parties by the expected amount. It should also assert the round fields the implementation relies on: positive answer, nonzero `updatedAt`, acceptable freshness, and `answeredInRound >= roundId`. If the token has nonstandard transfer behavior, fees, rebasing, pausing, or unusual decimals, the assertions must reflect the actual contract rather than ERC-20 assumptions.

Reproducibility requires committing the fork test, chain ID, fixed block, contract addresses, configuration values, setup accounts/amounts, and commands needed to run it. Token balances may be prepared deterministically with the test framework on the fork, but the liquidation itself must call the production token contract; if impersonating a funded holder is necessary, pin and document that holder and verify its balance at the chosen block. Never depend on “latest” state or an unrecorded public-RPC response.

Keep separate local tests for adverse oracle states—zero/negative answers, stale rounds, incomplete rounds, extreme decimals—and token failures, because a pinned live feed normally cannot be forced into those conditions. The fork test answers “are the chosen production contracts and assumptions compatible?”; the mock edge tests answer “does the pool fail safely when an integration misbehaves?” Both are required.

Sign-off should remain blocked until the governance domain is enforced and proven, the accounting behavior is validated over sequences against an explicit invariant, and the real production-address liquidation path passes on a reproducible pinned fork.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..aa9ab963d49fb985a5f1dc61af15013c2f3a1e1b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,36 @@
+# Sign-off assessment
+
+No. Green line coverage over mocks and single-operation examples is not enough to sign off. It establishes that the exercised statements ran, but not that the input domain, repeated-state behavior, or deployed integrations are correct.
+
+## 1. `reserveFactorWad`
+
+Require a review of every write path and a property/fuzz test over both `reserveFactorWad` and `assets`, not just two examples. At minimum, test the governance values `0`, `1`, `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`, plus values around any intended bound. For each positive denominator `d = 1e18 - reserveFactorWad`, test assets immediately below, at, and above the first value that produces nonzero net (`ceil(1e18 / d)`), as well as representative large values.
+
+The intended policy must first be explicit. If a 100% reserve factor is not valid, the setter should reject `reserveFactorWad >= 1e18`; if 100% is deliberately configurable, the system must define the consequence that every positive redemption has `net == 0` and reverts. Values above `1e18` must be rejected at the setter: under Solidity 0.8 checked arithmetic, redemption otherwise underflows at `1e18 - reserveFactorWad`. Merely proving that a later redemption reverts is not acceptable validation because it permits governance to place the pool in a broken state.
+
+The property for every accepted value should be that redemption neither unexpectedly reverts nor pays more than `assets`, and that its result equals the specified rounding rule. Include `assets == 0` according to the documented API behavior. Also search for overflow in `assets * (1e18 - reserveFactorWad)`: large valid `assets` can overflow the intermediate product even when the mathematical quotient fits. Evidence is meaningful only if the fuzz domain is not artificially capped below that region; either prove a protocol-level asset bound makes it unreachable or use/test a full-precision `mulDiv` implementation. Preserve failing seeds and add the discovered boundary cases as regression tests.
+
+## 2. Repayment/accounting drift
+
+One repayment demonstrates a discrepancy exists; it does not demonstrate accumulation. Require a stateful sequence test or invariant campaign that performs at least two nonzero-cut repayments against the same pool. Use varied repayment sizes and borrowers, and include realistic interleavings such as deposits, draws, partial repayments, redemptions, and full repayment. Record after every step:
+
+- the collateral/asset token balance actually held by the pool;
+- `accountedAssets` and any debt totals;
+- the protocol cut for that step; and
+- the discrepancy before and after the step.
+
+If `D_i = actualAssets_i - accountedAssets_i`, accumulation is demonstrated when, after controlling for all other specified cash flows, `D_i - D_(i-1)` equals the retained cut for repayment `i`, and after `n` repayments `D_n = D_0 + sum(cut_i)` (subject only to explicitly documented rounding). Show this for multiple sequence lengths, including zero-cut/dust boundaries and partial repayments. A stronger invariant test should compare the implementation after every action with a small reference accounting model and shrink any failure to a reproducible action sequence.
+
+Meaningful evidence is the per-step trace and the final equality to the sum of cuts across multiple repayments—not simply a nonzero final mismatch. The team must then classify the result against the intended accounting model: if retained cuts are owned assets, either `accountedAssets` must include them or a separate protocol-reserve liability/asset field must reconcile the balance. A reproducible growing mismatch is evidence of a bug, not evidence that the implementation is safe.
+
+## 3. Chainlink and collateral-token integrations
+
+Require integration tests on a fork of the actual target chain, pinned to an explicit block number and chain ID and backed by an archive-capable RPC endpoint. Deploy the candidate pool/configuration on that fork using the exact production feed and collateral-token addresses (or exercise the deployed contracts if they already exist). Do not replace either address with a mock. Assert the addresses, that code exists at them, and the expected token decimals/symbol and feed decimals/description/version so a configuration error fails loudly.
+
+The liquidation test must make a genuinely liquidatable position using deterministic fork setup, call the real Chainlink proxy's `latestRoundData`, pass that value through the production normalization and health calculation, execute liquidation, and prove via pre/post balances and emitted events that the real collateral token moved between the intended parties by the expected amount. It should also assert the round fields the implementation relies on: positive answer, nonzero `updatedAt`, acceptable freshness, and `answeredInRound >= roundId`. If the token has nonstandard transfer behavior, fees, rebasing, pausing, or unusual decimals, the assertions must reflect the actual contract rather than ERC-20 assumptions.
+
+Reproducibility requires committing the fork test, chain ID, fixed block, contract addresses, configuration values, setup accounts/amounts, and commands needed to run it. Token balances may be prepared deterministically with the test framework on the fork, but the liquidation itself must call the production token contract; if impersonating a funded holder is necessary, pin and document that holder and verify its balance at the chosen block. Never depend on “latest” state or an unrecorded public-RPC response.
+
+Keep separate local tests for adverse oracle states—zero/negative answers, stale rounds, incomplete rounds, extreme decimals—and token failures, because a pinned live feed normally cannot be forced into those conditions. The fork test answers “are the chosen production contracts and assumptions compatible?”; the mock edge tests answer “does the pool fail safely when an integration misbehaves?” Both are required.
+
+Sign-off should remain blocked until the governance domain is enforced and proven, the accounting behavior is validated over sequences against an explicit invariant, and the real production-address liquidation path passes on a reproducible pinned fork.

codex
Completed the review and wrote it to [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-1/testing-quiz-006/answer.md).
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..aa9ab963d49fb985a5f1dc61af15013c2f3a1e1b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,36 @@
+# Sign-off assessment
+
+No. Green line coverage over mocks and single-operation examples is not enough to sign off. It establishes that the exercised statements ran, but not that the input domain, repeated-state behavior, or deployed integrations are correct.
+
+## 1. `reserveFactorWad`
+
+Require a review of every write path and a property/fuzz test over both `reserveFactorWad` and `assets`, not just two examples. At minimum, test the governance values `0`, `1`, `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max`, plus values around any intended bound. For each positive denominator `d = 1e18 - reserveFactorWad`, test assets immediately below, at, and above the first value that produces nonzero net (`ceil(1e18 / d)`), as well as representative large values.
+
+The intended policy must first be explicit. If a 100% reserve factor is not valid, the setter should reject `reserveFactorWad >= 1e18`; if 100% is deliberately configurable, the system must define the consequence that every positive redemption has `net == 0` and reverts. Values above `1e18` must be rejected at the setter: under Solidity 0.8 checked arithmetic, redemption otherwise underflows at `1e18 - reserveFactorWad`. Merely proving that a later redemption reverts is not acceptable validation because it permits governance to place the pool in a broken state.
+
+The property for every accepted value should be that redemption neither unexpectedly reverts nor pays more than `assets`, and that its result equals the specified rounding rule. Include `assets == 0` according to the documented API behavior. Also search for overflow in `assets * (1e18 - reserveFactorWad)`: large valid `assets` can overflow the intermediate product even when the mathematical quotient fits. Evidence is meaningful only if the fuzz domain is not artificially capped below that region; either prove a protocol-level asset bound makes it unreachable or use/test a full-precision `mulDiv` implementation. Preserve failing seeds and add the discovered boundary cases as regression tests.
+
+## 2. Repayment/accounting drift
+
+One repayment demonstrates a discrepancy exists; it does not demonstrate accumulation. Require a stateful sequence test or invariant campaign that performs at least two nonzero-cut repayments against the same pool. Use varied repayment sizes and borrowers, and include realistic interleavings such as deposits, draws, partial repayments, redemptions, and full repayment. Record after every step:
+
+- the collateral/asset token balance actually held by the pool;
+- `accountedAssets` and any debt totals;
+- the protocol cut for that step; and
+- the discrepancy before and after the step.
+
+If `D_i = actualAssets_i - accountedAssets_i`, accumulation is demonstrated when, after controlling for all other specified cash flows, `D_i - D_(i-1)` equals the retained cut for repayment `i`, and after `n` repayments `D_n = D_0 + sum(cut_i)` (subject only to explicitly documented rounding). Show this for multiple sequence lengths, including zero-cut/dust boundaries and partial repayments. A stronger invariant test should compare the implementation after every action with a small reference accounting model and shrink any failure to a reproducible action sequence.
+
+Meaningful evidence is the per-step trace and the final equality to the sum of cuts across multiple repayments—not simply a nonzero final mismatch. The team must then classify the result against the intended accounting model: if retained cuts are owned assets, either `accountedAssets` must include them or a separate protocol-reserve liability/asset field must reconcile the balance. A reproducible growing mismatch is evidence of a bug, not evidence that the implementation is safe.
+
+## 3. Chainlink and collateral-token integrations
+
+Require integration tests on a fork of the actual target chain, pinned to an explicit block number and chain ID and backed by an archive-capable RPC endpoint. Deploy the candidate pool/configuration on that fork using the exact production feed and collateral-token addresses (or exercise the deployed contracts if they already exist). Do not replace either address with a mock. Assert the addresses, that code exists at them, and the expected token decimals/symbol and feed decimals/description/version so a configuration error fails loudly.
+
+The liquidation test must make a genuinely liquidatable position using deterministic fork setup, call the real Chainlink proxy's `latestRoundData`, pass that value through the production normalization and health calculation, execute liquidation, and prove via pre/post balances and emitted events that the real collateral token moved between the intended parties by the expected amount. It should also assert the round fields the implementation relies on: positive answer, nonzero `updatedAt`, acceptable freshness, and `answeredInRound >= roundId`. If the token has nonstandard transfer behavior, fees, rebasing, pausing, or unusual decimals, the assertions must reflect the actual contract rather than ERC-20 assumptions.
+
+Reproducibility requires committing the fork test, chain ID, fixed block, contract addresses, configuration values, setup accounts/amounts, and commands needed to run it. Token balances may be prepared deterministically with the test framework on the fork, but the liquidation itself must call the production token contract; if impersonating a funded holder is necessary, pin and document that holder and verify its balance at the chosen block. Never depend on “latest” state or an unrecorded public-RPC response.
+
+Keep separate local tests for adverse oracle states—zero/negative answers, stale rounds, incomplete rounds, extreme decimals—and token failures, because a pinned live feed normally cannot be forced into those conditions. The fork test answers “are the chosen production contracts and assumptions compatible?”; the mock edge tests answer “does the pool fail safely when an integration misbehaves?” Both are required.
+
+Sign-off should remain blocked until the governance domain is enforced and proven, the accounting behavior is validated over sequences against an explicit invariant, and the real production-address liquidation path passes on a reproducible pinned fork.

tokens used
14,091
```

## final message

Completed the review and wrote it to [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192601Z-codex-no-skill-1/testing-quiz-006/answer.md).

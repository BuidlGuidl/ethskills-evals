# Sign-off assessment

No. Green tests and 100% line coverage show that the executed examples did not fail; they do not establish that the input domain is safe, that a state discrepancy grows over a sequence, or that the deployed integrations have the behavior assumed by the mocks. These are three separate release blockers.

## 1. `reserveFactorWad`

I would first search for the intended invariant at every write site, including initialization, upgrades, governance execution, and any alternate setter. A WAD fraction normally needs a bound. For this implementation, `reserveFactorWad < 1e18` is the minimally useful domain: at exactly `1e18`, every positive redemption computes zero and reverts, while above `1e18` the checked subtraction `1e18 - reserveFactorWad` reverts before a net amount can be computed. If a 100% reserve is intentionally supported, redemption semantics must be changed; the current setter and redemption logic are not compatible with it.

I would require boundary and property tests covering at least:

- `0`, `1`, `0.2e18`, `1e18 - 1`, `1e18`, `1e18 + 1`, and `type(uint256).max` at every write path;
- acceptance below the chosen maximum and rejection at and above it, with the precise expected custom error and no state change on rejection;
- governance proposal/execution through the real authorization path, rather than a direct test-only storage write;
- fuzzing over `(assets, reserveFactorWad)`, with an overflow-safe reference calculation (for example `mulDiv`), checking the exact rounded-down result and the intended revert domain.

The rounding boundary matters even for a valid factor below `1e18`. Let `d = 1e18 - reserveFactorWad`. Assuming the product itself does not overflow, `net == 0` exactly when `assets * d < 1e18`; equivalently, the first nonzero redemption is `ceil(1e18 / d)`. Tests should exercise one asset unit below that threshold, the threshold, and one above it. They should also exercise the largest supported asset amount, because the direct multiplication can overflow even though the final quotient would fit. Meaningful evidence is an enforced setter invariant plus passing exhaustive boundary tests and fuzz/property tests against the independent reference formula—not merely examples at 0 and 20%.

## 2. Repayment/accounting accumulation

One repayment proves only that a mismatch can occur. It cannot prove accumulation, which is a claim about transitions over multiple operations.

I would define an independent accounting oracle before running the experiment. For example, if `gap = actual pool assets - accountedAssets` and the specified effect of repayment `i` is that its retained protocol cut `cut_i` remains outside `accountedAssets`, then the expected recurrence is:

`gap_i = gap_(i-1) + cut_i`

subject only to explicitly identified transfers, fees, donations, or rounding terms. The exact balance components used in `actual pool assets` must be listed so the assertion cannot accidentally omit debt or double-count cash.

The required experiment is a sequence with at least two—and preferably many—repayments having nonzero cuts. Snapshot balances, debt, `accountedAssets`, calculated cut, and `gap` before and after every repayment. Demonstrate both that each increment equals that operation's cut and that after `n` repayments the final gap equals the initial gap plus `sum(cut_i)`. Use amounts selected so cuts are nonzero and include values immediately around fee-rounding boundaries. Also include controls with a zero cut, a single repayment split into several repayments, full and partial repayments, multiple borrowers, and intervening deposit/redemption operations.

The stronger evidence would be a state-machine/invariant test that generates long mixed sequences and compares the implementation after every step with a simple model. It should either show a monotonic, exactly explained cumulative gap or reveal operations that erase, amplify, or realize it. A repeated observation of `actual != accountedAssets`, without per-step deltas and the cumulative equality, is not evidence of accumulation.

## 3. Chainlink feed and collateral token

Standard-behavior mocks cannot validate address selection, proxy behavior, ABI compatibility, decimals, round metadata, token return behavior, balances, approvals, or the actual liquidation transfer. I would retain mocks for fault injection, but add an integration test on a fork of the production chain.

For reproducibility, the test must pin all of the following in source or versioned configuration: chain ID, archive-RPC network, exact block number (not `latest`), feed and token addresses, expected code hashes or implementation identities, and the expected token/feed decimals at that block. CI should create the fork at that block and assert the chain ID, block number, nonempty code at both addresses, and those identities before testing behavior. Secrets such as the RPC URL may come from CI, but the historical state must not.

On that fork, the test should:

1. Call the configured production feed through the same code path as liquidation; validate `latestRoundData` semantics used by the contract (`answer > 0`, timestamps, round completeness/staleness policy) and conversion using the feed's actual decimals.
2. Acquire the real deployed collateral token from a known funded account at the pinned block, impersonating that account if necessary, then use real `approve`/`transferFrom` calls to establish a borrower position. This is preferable to modifying token storage with a test cheat, which bypasses token behavior.
3. Construct an actually liquidatable position using the pinned feed state and protocol parameters, execute liquidation through the public entry point, and assert exact before/after balances for borrower, liquidator, pool, and fee recipient, along with debt/collateral state and events. The asserted amounts must account for both token and oracle decimals.
4. Exercise the relevant production-token edge behavior (allowance, return data, fees/rebasing if applicable) and verify that the configured addresses are the ones reached. Mock tests should separately cover stale, zero/negative, incomplete-round, and reverting-feed cases that cannot be induced safely on the pinned production feed.

Meaningful evidence is a deterministic test that can be rerun from a clean checkout against the same historical block and produces the same state transitions. A one-time call against `latest`, or merely checking that the addresses contain code, would still be insufficient.

Sign-off should wait until the governance bound is enforced and property-tested, the repayment discrepancy is characterized by a multi-step model-backed invariant, and a pinned-fork liquidation succeeds end to end with the real feed and collateral token.

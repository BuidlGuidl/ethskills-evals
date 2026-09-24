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

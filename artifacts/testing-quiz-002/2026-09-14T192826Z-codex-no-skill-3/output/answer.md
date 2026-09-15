# Why 100% coverage missed the deposit shutdown

Line coverage only proves that the tests executed each line. It does not prove that they exercised the important parts of the input domain. Here, the setter was tested only with small, valid-looking examples, so every test followed the same semantic path: `depositFeeBps` remained far below `BPS_DENOMINATOR` and the fee remained smaller than the deposit.

The missing input class was fees at or above 100%: `newFeeBps >= 10_000`. The setter accepts any `uint256`, so an accidental value in that range makes every positive deposit fail:

- At exactly `10_000` bps, `fee == amount`, `netAmount == 0`, and `convertToShares(0)` produces zero shares, causing `NoSharesMinted()`.
- Above `10_000` bps, the calculated fee is at least the amount. Depending on integer rounding, `amount - fee` either becomes zero and later hits `NoSharesMinted()`, or underflows and immediately reverts under Solidity 0.8 checked arithmetic.

For example, with `newFeeBps = 10_001` and `amount = 10_000`:

```text
fee       = (10_000 * 10_001) / 10_000
          = 10_001
netAmount = 10_000 - 10_001
          = -1
```

`uint256` cannot represent `-1`, so the subtraction reverts. Even a deposit of `1` cannot succeed: `fee = floor(1 * 10_001 / 10_000) = 1`, leaving zero and ultimately reverting with `NoSharesMinted()`.

The fixed values `0`, `10`, and `25` bps are all deep inside the safe range; merely executing the denominator value `10_000` as part of the formula does not test it as a setter input. Those examples therefore cannot reveal the missing upper-bound validation, no matter how many lines they cover.

Property-based fuzz testing would have caught this. A fuzz test should generate `newFeeBps` across the setter's actual `uint256` domain and assert an invariant such as: every fee value accepted by `setDepositFee` permits a representative positive deposit to succeed and mint nonzero shares. The fuzzer would quickly find and shrink a counterexample to the boundary near `10_000` bps. An explicit boundary test at `9_999`, `10_000`, and `10_001` would expose the same defect, but fuzzing/invariant testing is the technique that discovers the unanticipated input class instead of relying only on hand-picked examples.

The corresponding contract invariant should be enforced in the setter, normally by reverting unless `newFeeBps < 10_000` (or by choosing and enforcing a stricter protocol maximum).

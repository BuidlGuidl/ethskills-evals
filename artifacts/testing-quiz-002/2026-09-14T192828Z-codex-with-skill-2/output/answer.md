# Why 100% coverage missed the failure

Line coverage only shows that each line executed at least once. It does not show that the lines were exercised across the accepted input domain, or that a useful property held for every input. In particular, the setter accepts every `uint256`, while the tests only sampled small, plausible fees.

The untested class was boundary and out-of-range configuration values: fees at or above `BPS_DENOMINATOR`. The important boundary cases are `9_999`, `10_000`, and `10_001` bps (and large values that can overflow `amount * depositFeeBps`). The tested fee settings—0, 10, and 25 bps—are all strictly below 10,000, so they always leave a positive net amount for an ordinary deposit. Testing the event and `onlyOwner` adds no information about whether the stored value is economically usable. The denominator value `10_000` appearing in the code is not coverage of `newFeeBps == 10_000`.

For example, after the owner sets the fee to 10,000 bps, a deposit of 1 ether computes:

```text
amount    = 1_000_000_000_000_000_000
fee       = (amount * 10_000) / 10_000
          = 1_000_000_000_000_000_000
netAmount = amount - fee
          = 0
shares    = convertToShares(0)
          = 0
```

The deposit therefore reverts with `NoSharesMinted`. This happens for every positive `amount` at exactly 10,000 bps. At 10,001 bps, a sufficiently large amount produces `fee > amount`, so Solidity's checked `amount - fee` reverts instead; for the same 1 ether input, `fee = 1_000_100_000_000_000_000`, which is 0.0001 ether greater than `amount`.

The testing technique that would have found this is **property-based fuzz testing over the whole accepted configuration domain**, not more hand-picked unit cases. A Foundry fuzz test should generate `newFeeBps`, set it as the owner, and assert the intended property—for example, that every accepted fee permits a valid nonzero deposit, or alternatively that the setter rejects every fee outside the protocol's documented safe range. Use `bound()` to explore the intended domain and separately exercise the nearest valid value, the exact limit, and the first value beyond it: 9,999, 10,000, and 10,001 bps.

Such a fuzz test would quickly shrink a failing input to the boundary around 10,000. The production fix implied by that property is to validate `newFeeBps` in the setter against the protocol's chosen maximum (normally strictly below 10,000 if deposits must always remain possible). A targeted regression test at 10,000 confirms this particular defect afterward, but the full-domain fuzz test is what searches for configuration values nobody thought to hand-pick.

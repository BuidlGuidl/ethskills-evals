# Why 100% coverage missed the deposit outage

Line coverage only proves that the tests executed each line. It does not prove that they exercised the meaningful parts of the input space or checked the function's required invariants. The setter was executed, its event was observed, and its access control was tested, but no test challenged the implicit invariant that a fee expressed in basis points must not exceed `BPS_DENOMINATOR`.

The missing class of inputs was an out-of-range fee: `newFeeBps > 10_000` (more than 100%). The tested fees—0, 10, and 25 bps—and the denominator value 10,000 are all at or below that boundary. For any such fee,

```text
floor(amount * feeBps / 10_000) <= amount
```

so `amount - fee` cannot underflow. Those examples therefore could never reveal the missing upper-bound validation. Testing the event with another ordinary in-range value or testing a non-owner changes neither fact.

For a concrete breaking input, let the owner set `depositFeeBps = 10_001` and deposit `amount = 10_000` units:

```text
fee       = (10_000 * 10_001) / 10_000
          = 10_001
netAmount = 10_000 - 10_001
          = -1
```

Solidity 0.8+ checked arithmetic cannot represent `-1` as a `uint256`, so the subtraction reverts with an arithmetic underflow before shares can be minted. Larger misconfigured fees similarly make the calculated fee exceed the deposit for suitable deposit amounts; integer rounding can mask a slight excess only for some very small amounts.

Property-based fuzz testing would have caught this. A fuzz test should generate arbitrary owner-supplied fee values and deposit amounts and assert the configuration/deposit invariant: either `setDepositFee` rejects every fee above 10,000, or every accepted fee leaves `fee <= amount` and deposits do not underflow. A boundary test at 9,999, 10,000, and 10,001 bps is the focused version; the 10,001 case immediately produces the failure above.

The contract should enforce the invariant at the configuration boundary, for example by reverting in `setDepositFee` when `newFeeBps > BPS_DENOMINATOR`. This turns an operational typo or misunderstood unit into a rejected update instead of a vault-wide denial of service.

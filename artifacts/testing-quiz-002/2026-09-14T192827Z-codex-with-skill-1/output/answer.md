# Why 100% coverage missed the deposit freeze

Line coverage only says that the setter's assignment and the lines in `deposit()` were executed. It says nothing about which values reached those lines or whether the suite searched the setter's accepted domain. The event and access-control tests likewise establish emission and authorization, not that an authorized value is safe.

The missing class was boundary and out-of-range fee inputs: `newFeeBps >= BPS_DENOMINATOR`. Because `setDepositFee` accepts every `uint256` and performs no upper-bound check, these are valid setter inputs even though they are not usable fee configurations.

At the exact boundary, take `newFeeBps = 10_000` and a deposit of `amount = 10_000` units:

```text
fee       = (10_000 * 10_000) / 10_000 = 10_000
netAmount = 10_000 - 10_000             = 0
shares    = convertToShares(0)           = 0
```

The deposit therefore reverts with `NoSharesMinted()`. In fact, a 10,000 bps fee consumes 100% of every deposit, so no deposit can mint shares.

The first value beyond the boundary is also broken. With `newFeeBps = 10_001` and the same amount:

```text
fee       = (10_000 * 10_001) / 10_000 = 10_001
netAmount = 10_000 - 10_001             = underflow
```

Under Solidity 0.8 checked arithmetic, that subtraction reverts. Still larger values can additionally make `amount * depositFeeBps` overflow before the division.

The tested fee values 0, 10, and 25 bps are all far below the 10,000 bps boundary and therefore all exercise the same safe arithmetic region. The fourth number shown, 10,000, is merely the denominator in those tests; using it as a divisor does not test setting the fee to 10,000. If 10,000 had actually been supplied as `newFeeBps` followed by a deposit, the suite would have reproduced the freeze immediately.

The technique that should have found this is **property-based fuzz testing** of the complete accepted configuration domain, supplemented by explicit boundary cases. A Foundry fuzz test should generate `newFeeBps` values across the setter's accepted `uint256` domain and assert a liveness property such as: after every fee value the setter accepts, a valid positive deposit can mint positive shares. The fuzzer would quickly shrink a failure toward the 10,000 bps boundary. The regression suite should then classify the nearest valid value, exact limit, and first value beyond it separately: 9,999, 10,000, and 10,001 bps.

The intended contract rule should also be encoded in the setter—normally rejecting `newFeeBps >= 10_000` if every accepted configuration must leave a positive net deposit—and the fuzz test should assert that accepted values preserve deposit liveness while rejected values revert. Hand-picked examples and 100% line coverage cannot substitute for that search over configurable value math.

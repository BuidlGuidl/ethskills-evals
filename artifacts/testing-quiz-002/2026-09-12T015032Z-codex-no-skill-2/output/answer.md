# Why 100% line coverage missed the failure

Line coverage only proves that every line executed at least once. It does not prove that the lines were exercised over the important parts of their input domain, nor that every state produced by `setDepositFee` is safe for `deposit`. The setter tests showed that an authorized caller can store a value and emit an event; they did not test the invariant that a stored fee must leave a depositable net amount.

The missing input class was the boundary and out-of-range fee values at or above 100%: `newFeeBps >= BPS_DENOMINATOR`. The tested fee inputs `0`, `10`, and `25` are all ordinary values far below the `10_000` boundary. The fourth number shown, `10_000`, appears only as the denominator; merely executing arithmetic that uses that constant is not the same as supplying it (or a larger number) to the setter. Thus those examples never put the contract into the dangerous state.

For example, after calling `setDepositFee(10_000)`, any positive deposit has:

```text
amount = 1_000
fee = (1_000 * 10_000) / 10_000 = 1_000
netAmount = 1_000 - 1_000 = 0
shares = convertToShares(0) = 0
```

The deposit therefore reverts with `NoSharesMinted`. A value above the boundary can fail even earlier. With `newFeeBps = 10_001` and `amount = 10_000`:

```text
fee = (10_000 * 10_001) / 10_000 = 10_001
netAmount = 10_000 - 10_001
```

The subtraction underflows and reverts under Solidity 0.8 checked arithmetic. For smaller positive amounts, rounding can make `fee == amount`, still producing zero shares; hence such a configuration can disable all deposits.

The testing technique that would have found this is **property-based fuzz testing**, preferably as a **stateful invariant test** that lets the owner choose arbitrary `newFeeBps` values and then attempts deposits. A useful property is that every accepted fee configuration must satisfy `fee <= amount` and, if deposits are meant to remain live, must produce `netAmount > 0` for supported positive deposits. Foundry would quickly shrink a failing case toward the `10_000`-bps boundary. Explicit boundary-value tests for `9_999`, `10_000`, and `10_001` should accompany the fuzz test.

The contract-side invariant should also be enforced in the setter—for example, by rejecting `newFeeBps >= 10_000` if a 100% fee is not a valid operating state. Coverage would remain 100%, but the meaningful improvement is coverage of the input domain and cross-function state invariant.

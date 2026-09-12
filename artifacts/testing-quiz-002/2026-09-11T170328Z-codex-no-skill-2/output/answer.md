# Why 100% coverage missed the failure

Line coverage only proves that the tests executed each line. It does not prove that they exercised the meaningful input ranges or checked the contract's required invariants. The tests executed the setter and deposit calculation with ordinary, valid fee values, so every line was covered while the dangerous state remained unexplored.

The missing input class was an **out-of-range deposit fee**, specifically `newFeeBps > BPS_DENOMINATOR` (more than 100%, or more than 10,000 bps). `setDepositFee` accepts every `uint256`, so an owner can put the vault into a state in which the calculated fee is at least the entire deposit and, for sufficiently large deposits, exceeds it.

For example, let ops set the fee to 10,001 bps and let a user deposit 10,000 units:

```text
depositFeeBps = 10_001
amount        = 10_000

fee       = (10_000 * 10_001) / 10_000
          = 10_001

netAmount = 10_000 - 10_001
          = -1
```

Because `uint256` cannot represent `-1`, Solidity 0.8+ reverts on the subtraction underflow. Smaller positive amounts do not save the vault: integer truncation can make `fee == amount`, leaving `netAmount == 0`, after which no shares can be minted and `NoSharesMinted()` is reached. Thus deposits become unusable.

The tested fee values 0, 10, and 25 bps are all deep inside the valid partition `0 <= fee < 10_000`; none can make `fee >= amount`. The fourth number shown above, 10,000, is merely the denominator in those tests, not a value passed to the setter. Its presence in the calculation provides no coverage of the setter's boundary. If 10,000 were actually tested as a fee, it would expose a zero-net-deposit failure; 10,001 exposes the still more direct subtraction underflow. The stated fee cases therefore cannot reveal that the setter accepts a bricking configuration.

The testing technique that would have caught this is **boundary-value testing combined with property-based fuzzing**. A boundary test should try 9,999, 10,000, and especially 10,001 bps. A fuzz test should generate arbitrary `newFeeBps` values and assert the invariant that accepted configurations cannot make the fee exceed the deposit (equivalently, the setter must reject `newFeeBps > 10_000`). Fuzzing the full `uint256` setter domain followed by a deposit would quickly find 10,001 or another value above the denominator, despite line coverage already being 100%.

The corresponding production guard is:

```solidity
if (newFeeBps > BPS_DENOMINATOR) revert InvalidDepositFee();
```

with tests for the exact boundary and the first value beyond it.

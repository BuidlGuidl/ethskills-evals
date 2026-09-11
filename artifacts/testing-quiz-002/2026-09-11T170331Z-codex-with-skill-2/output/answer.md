# Why 100% coverage missed the failure

Line coverage shows that each statement executed at least once. It does not show that the statements were exercised with the full range of values they accept, nor that a useful property held for those values. The setter test proved only that the setter stores and emits the particular numbers chosen by the test. Because `setDepositFee` accepts every `uint256`, those examples left almost its entire input domain unexplored.

The missing class was boundary and out-of-range fee inputs: in particular, fees at or above `BPS_DENOMINATOR`. A deposit fee must be strictly less than 10,000 bps if every positive deposit is expected to leave something to mint. Yet the setter does not enforce that domain constraint.

For example, let ops set:

```text
depositFeeBps = 10_001
amount        = 10_000

fee       = (10_000 * 10_001) / 10_000
          = 10_001
netAmount = 10_000 - 10_001
          = -1
```

Because Solidity uses unsigned integers, the subtraction underflows and reverts. This value effectively bricks all positive deposits: for amounts below 10,000, integer truncation makes `fee == amount`, so `netAmount == 0` and `NoSharesMinted()` follows; at 10,000 and sufficiently larger amounts, `fee > amount` and subtraction reverts. Even the exact boundary, 10,000 bps, makes `fee == amount` for every amount and therefore mints no shares.

The hand-picked fee values such as 0, 10, and 25 bps—and any other ordinary low value used by the event or authorization tests—are all far below the dangerous boundary. They execute exactly the same lines, but always satisfy `fee < amount` for meaningful deposits. No number of assertions limited to those examples can reveal behavior at 10,000 or 10,001 bps.

The testing technique that would have found this is **property-based fuzz testing over the setter's whole accepted input domain**, with explicit coverage of both sides of the economic boundary. The test should randomize `newFeeBps` and deposit amounts, then assert a liveness/property such as: after any successful fee configuration, a valid positive deposit can mint nonzero shares (or, if the intended specification caps fees, values `>= 10_000` must revert in the setter). Fuzzing the actual accepted `uint256` domain would quickly produce 10,000, a value above it, or a much larger value that also causes multiplication overflow. A targeted boundary test for 9,999, 10,000, and 10,001 should accompany the fuzz test, but the fuzz search—not line coverage—is what tests the input space nobody thought to enumerate.

# Why 100% coverage missed the failure

Line coverage only says that the setter and the fee calculation executed. It does not say that the tests explored the setter's input domain, nor that they asserted the important behavioral property: an accepted fee configuration must not make every positive deposit revert.

The suite tried only small, ordinary fee values: 0, 10, and 25 bps. All are far below `BPS_DENOMINATOR`, so for a sufficiently large deposit they produce `fee < amount` and leave a positive `netAmount`. The event and only-owner tests add no new numeric fee case that exercises the dangerous boundary. `10_000` is the denominator used by the calculation, not a tested setter value. Thus those tests can execute every line while never challenging the unchecked relationship between `newFeeBps` and `BPS_DENOMINATOR`.

The untried class is out-of-range owner input, especially fee values at or above 10,000 bps. The setter accepts the entire `uint256` domain even though the downstream arithmetic only makes operational sense when the fee is strictly below 10,000 bps.

For example, let ops set `depositFeeBps = 10_001` and let a user deposit 10,000 units:

```text
fee      = (10,000 * 10,001) / 10,000
         = 10,001
netAmount = 10,000 - 10,001
```

The subtraction underflows and reverts under Solidity 0.8 checked arithmetic. Smaller positive deposits do not rescue the vault. For `0 < amount < 10,000`:

```text
fee = floor(amount * 10,001 / 10,000) = amount
netAmount = 0
shares = convertToShares(0) = 0
```

so `NoSharesMinted()` reverts. At exactly 10,000 bps, every positive deposit similarly pays `fee == amount`, obtains a zero net amount, and reverts at `NoSharesMinted()`. Above 10,000 bps, deposits either reach that zero-share failure because of rounding or underflow in `amount - fee`; very large combinations may instead overflow `amount * depositFeeBps` first. In every case the unchecked configuration can halt deposits.

The testing technique that would have found this is a Foundry fuzz/property test over the full domain accepted by `setDepositFee`, using `bound()` where appropriate, rather than more hand-picked examples. The test should set a fuzzed fee and assert a meaningful property such as: every fee configuration the setter accepts leaves a representative positive deposit able to mint nonzero shares, or equivalently that accepted fee values always produce `fee < amount`. Boundary cases should also be explicit and separate: 9,999, 10,000, and 10,001 bps.

Such a fuzz test would quickly shrink a failing input to the 10,000-bps boundary (zero net amount) or just above it (including the 10,001-bps arithmetic shown above). It would demonstrate that the intended valid setter domain must be constrained below 10,000 bps. Coverage could remain exactly 100%; the added value comes from searching inputs and asserting a property, not from executing another line.

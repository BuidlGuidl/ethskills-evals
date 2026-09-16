# Why 100% line coverage missed the deposit outage

Line coverage answers only whether each line executed at least once. It does not show that the lines were exercised across the meaningful input domain, nor that the contract's state invariants were tested. The setter's assignment and event can therefore be fully covered using `0`, `10`, and `25`, even though the setter accepts every `uint256`.

The missing class of inputs was fees at or above the denominator: `newFeeBps >= 10_000` (and, more generally, arbitrary out-of-range configuration values). All tested fee values were far below that boundary, so they always satisfied the unstated invariant `depositFeeBps < BPS_DENOMINATOR`. Merely having `10_000` in the implementation as a constant does not test setting the fee to that value.

For example, set the fee to exactly 10,000 bps and deposit 100 units:

```text
fee       = (100 * 10_000) / 10_000 = 100
netAmount = 100 - 100               = 0
shares    = convertToShares(0)       = 0
```

The deposit then reverts with `NoSharesMinted`. Thus every positive deposit is rejected at a 100% fee (assuming the ordinary zero-preserving share conversion).

A value above the boundary fails even earlier. At 10,001 bps with an amount of 10,000 units:

```text
fee       = (10_000 * 10_001) / 10_000 = 10_001
netAmount = 10_000 - 10_001              = -1
```

Because `uint256` subtraction is checked in Solidity 0.8+, that subtraction underflows and reverts. Larger values can also make `amount * depositFeeBps` overflow before the division.

Property-based fuzz testing (and especially stateful invariant testing) would have caught this. Fuzz `newFeeBps` across its declared `uint256` domain, call the setter, and then attempt a positive deposit; assert that an accepted configuration cannot make all ordinary positive deposits revert. The fuzzer will quickly shrink a counterexample toward the `10_000`/`10_001` boundary. A direct boundary-value test using `9_999`, `10_000`, and `10_001` would also reveal it, but fuzzing exposes the mismatch between the setter's unrestricted type and the protocol's required range.

The contract should make that range explicit in `setDepositFee`, normally by reverting unless `newFeeBps < 10_000` (or `<= 10_000` only if a deliberately deposit-disabling 100% fee is valid). The key missing test is a property over the configuration domain, not another assertion that the already-tested lines execute.

# Why 100% coverage missed the deposit failure

Line coverage shows that each line executed at least once; it does not show that the lines were exercised over the full input domain or that their arithmetic properties hold. The setter and deposit path were covered only with small, valid-looking fees. In particular, executing the assignment with `0`, `10`, or `25` bps says nothing about what happens when `newFeeBps` reaches or exceeds the denominator. The fourth relevant constant, `10_000`, is merely the denominator; its presence in the calculation does not test the setter at that boundary.

The suite never tried out-of-range fee inputs. Because `setDepositFee` accepts any `uint256` and has no upper-bound check, the owner can set a fee of 100% or more:

- At `10_000` bps, for any positive `amount`, `fee = amount`, so `netAmount = 0`; conversion normally yields zero shares and `NoSharesMinted()` reverts.
- Above `10_000` bps, `fee` can exceed `amount`, so Solidity 0.8 checked subtraction panics before share conversion.

For example, let `amount = 1_000_000` and `depositFeeBps = 10_001`:

```text
fee = (1_000_000 * 10_001) / 10_000
    = 1_000_100

netAmount = 1_000_000 - 1_000_100
          = -100
```

`uint256` cannot represent `-100`, so `amount - fee` reverts with arithmetic underflow. Every positive deposit for which the rounded fee exceeds the amount then fails. (For very small amounts, integer truncation can delay the underflow, but a fee of at least `10_000` bps still makes successful share minting impossible under the usual conversion.)

The small examples `0`, `10`, and `25` are all strictly below `10_000`; therefore `fee <= amount` and they cannot expose either the zero-net boundary or the over-100% underflow. Merely covering the same statements with those values cannot reveal behavior in a different input partition.

Property-based fuzz testing would have caught this. Fuzz `newFeeBps` across its `uint256` domain together with positive deposit amounts, and assert the intended invariant—for example, that every fee accepted by the setter permits a valid positive deposit without an arithmetic panic. The fuzzer would quickly shrink a failure toward the `10_000`/`10_001` bps boundary. A focused boundary-value test at `9_999`, `10_000`, and `10_001` bps would expose it as well.

The corresponding contract invariant should be enforced in production, not only tested: reject `newFeeBps >= BPS_DENOMINATOR` (or `>`, if a deliberately deposit-disabling 100% fee is part of the specification). A fuzz test can then assert that every accepted fee is below the chosen bound and that `fee < amount` for supported deposits.

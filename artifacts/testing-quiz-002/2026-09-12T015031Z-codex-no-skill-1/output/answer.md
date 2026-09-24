# Why 100% coverage missed the deposit-fee failure

Line coverage only proves that the tests executed the statements. It does not prove that they exercised the important values those statements can receive. The setter accepts every `uint256`, but the deposit calculation is only usable when the fee is strictly less than `BPS_DENOMINATOR` (assuming deposits are meant to mint shares).

The missing input class was boundary and out-of-range fee values: values at or above 10,000 bps. The smallest value that disables all otherwise valid deposits is exactly 10,000 bps (100%). For any deposit amount `A` whose multiplication does not overflow:

```text
depositFeeBps = 10_000
fee           = (A * 10_000) / 10_000 = A
netAmount     = A - A = 0
shares        = convertToShares(0) = 0
```

`deposit()` therefore reverts with `NoSharesMinted()` for every deposit. At 10,001 bps and above, sufficiently large amounts instead compute `fee > amount`, so `amount - fee` reverts with a Solidity arithmetic underflow; very large fee/amount combinations can also overflow the multiplication first.

The example tests at 0, 10, and 25 bps are all ordinary happy-path values, far from the 10,000-bps boundary, so they all follow the same successful semantic path even though they provide line coverage. The fourth relevant number shown, `10_000`, was used only as the denominator, not supplied to the setter as a test input. Event and access-control tests likewise say nothing about whether the stored value preserves the vault's ability to deposit.

Boundary-value testing would have caught this immediately by testing `9_999`, `10_000`, and `10_001`. More robustly, a stateful fuzz/invariant test should have an owner call `setDepositFee(fee)` with arbitrary `uint256` values and then attempt a valid deposit. The invariant would be: **every fee value accepted by the setter must leave valid deposits able to mint nonzero shares**. A fuzzer would shrink the counterexample to the boundary around `10_000` (subject to the chosen deposit amount).

The contract should either reject `newFeeBps >= BPS_DENOMINATOR` in the setter, or explicitly define 100% fees as valid and change the deposit behavior. If deposits must always remain possible, the setter needs the strict bound:

```solidity
if (newFeeBps >= BPS_DENOMINATOR) revert InvalidDepositFee();
```

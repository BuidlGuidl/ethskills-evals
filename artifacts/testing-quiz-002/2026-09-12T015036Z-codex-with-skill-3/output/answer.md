# Why 100% coverage missed the deposit-fee failure

Line coverage only proves that each line executed at least once. It does not prove that the lines were exercised over the full input domain, at their boundaries, or with assertions capable of detecting every bad outcome. The tests executed the setter and the deposit calculation using values the authors already expected to be valid, so every line could be covered while the dangerous state remained unexplored.

The missing class of inputs was an owner-supplied fee greater than 100%:

```text
newFeeBps > BPS_DENOMINATOR
newFeeBps > 10_000
```

Because `setDepositFee` accepts every `uint256` and enforces no upper bound, such a fee becomes valid contract state. For example, after setting the fee to `10_001` bps, depositing `10_000` asset units produces:

```text
fee       = (10_000 * 10_001) / 10_000
          = 10_001

netAmount = 10_000 - 10_001
          = -1
```

`uint256` cannot represent `-1`, so Solidity 0.8+ reverts on the subtraction underflow. For some smaller amounts, integer truncation can instead make `fee == amount`; then `netAmount` is zero and the deposit reaches `NoSharesMinted()`. Still larger fee/amount combinations can also revert earlier from overflow in `amount * depositFeeBps`. Thus the unbounded setter can put the vault into a configuration in which deposits cannot succeed.

The values `0`, `10`, and `25` bps are all far below `10_000`, and even the stated denominator value `10_000` is only the exact 100% boundary. None is on the invalid side of the boundary. At `10_000` bps the subtraction itself is still defined (`fee == amount`); it cannot reveal the underflow that begins above the limit. The event and only-owner tests likewise test logging and authorization, not the numerical validity of the stored fee.

The testing technique that would have found this is a **property-based fuzz test over the setter's entire accepted input domain**, composed with a deposit. The test should vary `newFeeBps` instead of selecting a few examples and assert the protocol property that every accepted configuration permits a valid positive deposit to complete (or, equivalently, that invalid configurations are rejected). Foundry would quickly shrink a failing case toward the boundary, such as `10_001` bps.

Boundary tests should explicitly cover both sides as well: `9_999`, `10_000`, and `10_001` bps. The resulting design fix is to define the intended maximum and make the setter reject values above it, commonly `newFeeBps > 10_000`. A fuzz test can then `bound()` fees to the valid domain for successful-deposit properties, while a separate fuzz/boundary test proves every value above the maximum reverts in the setter.

# Why 100% coverage missed the deposit-bricking fee

Line coverage only proves that the setter and the arithmetic lines executed. It does not prove that they were exercised with values capable of falsifying the intended property. The event test and the ownership test likewise check logging and authorization, not whether an authorized value is economically valid.

The missing input class was fee settings at or above the denominator: `newFeeBps >= 10_000`. The setter accepts the entire `uint256` domain, but a deposit fee is only meaningful below 100% if a successful deposit must mint shares. The chosen fee cases—0, 10, and 25 bps—are all far below that boundary. The event and only-owner cases do not explore it either. Consequently, those scenarios can execute every line while remaining in the same safe region of the input space; coverage has no concept of boundary values or arithmetic properties.

For example, let the owner call:

```solidity
setDepositFee(10_001);
```

For a deposit of `amount = 10_000`, the arithmetic is:

```text
fee       = (10_000 * 10_001) / 10_000
          = 10_001
netAmount = 10_000 - 10_001
```

The subtraction underflows and reverts under Solidity 0.8 checked arithmetic. Smaller positive deposits are also bricked: for example, at `amount = 1`, integer division gives `fee = 1`, so `netAmount = 0`, `convertToShares(0)` returns zero, and `NoSharesMinted()` is raised. More generally, with 10,001 bps, amounts below 10,000 produce zero net assets and amounts of at least 10,000 underflow. At exactly 10,000 bps, every positive amount has `fee == amount`, also leaving zero assets and no shares.

The appropriate discovery technique is **property-based fuzz testing over the full accepted domain**, with explicit boundary tests at 9,999, 10,000, and 10,001. A Foundry fuzz test should vary both the owner-set fee and a positive deposit amount, then assert the intended property—for example, that every accepted fee configuration permits a valid funded depositor to deposit and mint nonzero shares, or equivalently that an accepted fee always satisfies `fee < amount` for such a deposit. Inputs should be bounded with `bound()` to the contract's genuinely accepted domain, not restricted to the already-assumed safe range.

That fuzz search would quickly shrink to the 10,000-bps boundary and expose the missing setter invariant. The contract fix implied by the property is to reject out-of-range settings in `setDepositFee` (normally requiring `newFeeBps < BPS_DENOMINATOR`, or enforcing whatever documented maximum is intended). A regression test for 10,000 and 10,001 is useful after discovery, but the fuzz test is what searches for the unanticipated value rather than merely confirming a known bug.

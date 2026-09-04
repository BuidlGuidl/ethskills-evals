# Assessment

## 1. Why Ethereum and Arbitrum reconciled together

`block.number` does **not** mean the same thing on these two L2 designs.

On Arbitrum One, Solidity's `block.number`/the EVM `NUMBER` opcode returns an estimate of the current **Ethereum L1 block number**, not Arbitrum's rapidly increasing L2 block number. Arbitrum exposes its native L2 block number separately through `ArbSys.arbBlockNumber()`. This is documented as an Arbitrum-specific EVM behavior: [`block.number` returns the first non-Arbitrum parent-chain block number](https://docs.arbitrum.io/assets/files/2025-12-offchain-arbitrum-chains-genesis-generator-securityreview-ecc17bd8f262c11ea3c8fd6458ff271e.pdf).

Consequently, the 250 ms Arbitrum block cadence is irrelevant to this contract. Over a given wall-clock interval, both deployments normally see almost the same increase in `block.number`: approximately one count per Ethereum 12-second slot. Multiplying that count by 12 therefore produces roughly elapsed wall-clock seconds on both chains. That explains why the two July results agree; identical bytecode does not imply identical semantics on every EVM chain, but Arbitrum's special semantics happen to make this particular assumption behave approximately as intended.

The headline simple-interest calculation is:

```text
1,000,000 × 0.04 × 31 / 365 = 3,397.260274 USDC
```

The contract, however, does not measure 31 calendar days. It measures the `block.number` difference between the actual boundary calls and treats every count as exactly 12 seconds. Ethereum can have missed slots, and the first and last calls need not lie exactly on the finance period boundaries. Integer division can also truncate index increments (the materiality depends on the index's scale). Thus a small difference from calendar-time simple interest is expected.

For scale, ignoring compounding and rounding, a 3,391 USDC charge implies:

```text
credited blocks = 3,391 × 10,000 × 365 days
                  / (1,000,000 × 400 × 12 seconds)
                = 222,788.7 blocks

ideal 31-day 12-second count = 31 × 86,400 / 12 = 223,200 blocks
difference ≈ 411.3 blocks × 12 seconds = 82.26 minutes
```

An approximately 82-minute shortfall from boundary timing, missed Ethereum slots, and rounding is only about 0.18% of the month. That is consistent with 3,391 versus 3,397. It is not possible to apportion the six-dollar difference exactly from the information supplied: that requires the deployment state, every July `accrueInterest()` transaction/block, the index scale, and the precise reconciliation boundaries.

There is a second nuance: every nonzero call applies interest to the already-increased index, so repeated calls compound. If calls occurred during the month, that pushes the result **up**, not down. For example, perfectly daily calls over exactly 31 days would produce about 3,402.85 USDC before integer truncation, rather than 3,397.26. The fact that the observed number is lower means the block/boundary shortfall and/or truncation outweighed any such compounding. It is therefore unsafe to claim that 3,391 follows from the quoted source alone, even though the cross-chain agreement has a clear explanation.

## 2. What the unchanged code does on Base

Base uses ordinary L2 block numbering. Its full L2 blocks are produced roughly every **2 seconds**; its newer ~200 ms Flashblocks are incremental preconfirmations within a full block and do not each increment the canonical block number. Base describes transaction inclusion as about 200 ms at the Flashblock stage and about 2 seconds at the L2-block stage in its [finality documentation](https://docs.base.org/base-chain/network-information/transaction-finality), and its protocol derivation specifies that each L2 block timestamp advances by the configured L2 block time ([Base derivation spec](https://docs.base.org/base-chain/specs/protocol/consensus/derivation)).

Therefore a normal 31-day interval has approximately:

```text
Base blocks elapsed = 31 × 86,400 / 2 = 1,339,200
seconds credited by this contract = 1,339,200 × 12 = 16,070,400
                                  = 186 days
```

The contract runs its economic clock about six times too fast. With a single accrual spanning the whole period, the interest is:

```text
1,000,000 × 0.04 × 16,070,400 / 31,536,000
= 20,383.561644 USDC
```

So the useful sign-off estimate is **20,384 USDC**, not 3,397 USDC, subject to actual block production, transaction boundaries, and integer truncation.

That is not a unique exact figure unless call cadence is specified, because the implementation compounds on every call. At one perfectly timed call per day, the result is approximately **20,585.89 USDC**; in the limiting case of extremely frequent calls it approaches **20,592.73 USDC**. Anyone can call the function, so the charged amount is partly caller-controlled. Flashblocks do not create a 60× result; canonical two-second L2 blocks create roughly a 6× clock, with frequency-dependent compounding on top.

## Recommendation

Do **not** deploy this bytecode unchanged to Base, and do not retain block-count-based time accounting in the next version.

Store `lastAccrualTimestamp` and calculate `elapsed = block.timestamp - lastAccrualTimestamp`. This expresses the intended unit directly and removes the chain-specific block-time assumption. Also define the rate convention explicitly:

- If 4.00% means simple APR, make accrued interest depend only on total elapsed time, so splitting an interval across arbitrary public calls cannot change the result.
- If compounding is intended, specify the compounding convention and implement a frequency-independent index-growth formula (with deliberate fixed-point precision and rounding), rather than letting callers choose the effective compounding frequency.

Add tests for multiple calls versus one call over the same timestamps, long inactivity, rounding bounds, and each target chain. For the existing deployments, reconcile from actual accrual events and block timestamps/numbers, and document that Arbitrum's apparent correctness relies on its exceptional `NUMBER` behavior rather than portable EVM semantics.

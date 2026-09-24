# Cross-chain interest result

The Arbitrum result is not nonsense because this contract is not counting
Arbitrum L2 blocks.

On Arbitrum, Solidity `block.number` returns an estimate of the first
non-Arbitrum ancestor chain block number. For Arbitrum One, that is Ethereum
L1. Arbitrum has its own L2 block numbers, but contracts only get those through
`ArbSys(100).arbBlockNumber()`. So this code on Arbitrum is effectively using
Ethereum L1 block progression, not the roughly sub-second Arbitrum transaction
cadence.

That explains why Arbitrum and mainnet reconciled to the same place: both
deployments were advancing `lastAccrualBlock` against approximately the same
Ethereum L1 block clock.

The reason both are slightly under the 3,397 USDC finance expected is that the
contract does not accrue from elapsed wall-clock seconds. It does:

```solidity
secondsElapsed = (block.number - lastAccrualBlock) * 12;
```

The simple 31-day rate expectation is:

```text
1,000,000 * 4.00% * 31 / 365 = 3,397.2603 USDC
```

That assumes exactly 2,678,400 elapsed seconds, or exactly 223,200 twelve-second
blocks. The observed 3,391 USDC corresponds almost exactly to about 222,789
counted blocks:

```text
222,789 blocks * 12 = 2,673,468 contract-seconds
1,000,000 * 0.04 * 2,673,468 / 31,536,000 = 3,391.0046 USDC
```

So July was short by roughly 411 twelve-second blocks versus a perfect
31-day/12-second schedule. That is normal enough on Ethereum because post-merge
Ethereum has 12-second slots, but not every slot necessarily contains a block;
reconciliation boundaries can also trim a few blocks depending on the exact
start/end transactions. Integer division then rounds each accrual down by dust.

# Base result

Base is different. Base is an OP Stack chain, and `block.number` is the Base L2
block number. Base canonical L2 blocks are every 2 seconds. Flashblocks add
200 ms preconfirmations inside a 2-second block window; they do not make this
contract count Ethereum-style L1 blocks the way Arbitrum did.

For the same 31 days on Base:

```text
31 days = 2,678,400 seconds
Base blocks at 2 seconds/block = 1,339,200 blocks
Contract seconds = 1,339,200 * 12 = 16,070,400 seconds
16,070,400 seconds = 186 days
```

So the contract treats 31 real days as 186 interest days, i.e. 6x the intended
time:

```text
1,000,000 * 0.04 * 186 / 365 = 20,383.5616 USDC
```

So on Base, the same borrower should be charged about **20,384 USDC** of
interest over 31 days before considering compounding cadence and rounding.

One caveat: the code updates `index` from the current `index`, so repeated calls
compound. If someone called `accrueInterest()` every Base block for the entire
period, the result would be about **20,593 USDC**, not 20,384. The 20,384 figure
is the direct linear arithmetic matching the July reconciliation style.

If Base ever made the canonical L2 block itself 200 ms rather than merely
streaming 200 ms preconfirmation slices, this bug would become 60x instead of
6x. That is not the current Base canonical block-number behavior I would plan
against, but it is a good reminder not to encode block-time assumptions.

# Recommendation

Do not deploy this contract unchanged to Base.

For interest, store `lastAccrualTimestamp` and use:

```solidity
uint256 secondsElapsed = block.timestamp - lastAccrualTimestamp;
```

Then update `lastAccrualTimestamp = block.timestamp`. Use a high-precision
`mulDiv` style calculation, and make the intended policy explicit: simple APR
per elapsed second, or deliberately compounded index growth.

I would not try to fix this with per-chain `SECONDS_PER_BLOCK` constants. That
keeps the protocol dependent on chain-specific block production rules and future
upgrades. Wall-clock interest should be based on timestamps. For L2 deployments,
timestamp-based month-scale accrual is the right primitive; separately, protect
liquidations and other time-sensitive operations with sequencer-down handling and
grace periods where applicable.

Sources checked:

* Arbitrum docs, "Block gas limit, numbers and time":
  <https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time.md>
* Arbitrum docs, "Solidity support":
  <https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/solidity-support.md>
* Base derivation docs:
  <https://docs.base.org/specifications/base-protocol/consensus/derivation>
* Base Flashblocks deep dive:
  <https://blog.base.dev/flashblocks-deep-dive>

# Reconciliation and Base deployment assessment

## Bottom line

Arbitrum did not overcharge because, inside an Arbitrum contract, Solidity's `block.number` represents an estimate of the Ethereum **L1** block number, not Arbitrum's roughly 250 ms L2 block height. It advances coarsely and can jump, but over a month its delta tracks Ethereum blocks. Thus `blocksElapsed * 12` estimates about the same elapsed time on Arbitrum as on mainnet. Arbitrum's `ArbSys.arbBlockNumber()` is the separate way to obtain its L2 height. This non-standard behavior is also visible in the [official Nitro implementation/audit discussion](https://docs.arbitrum.io/assets/files/2022_10_22_trail_of_bits_security_audit_nitro_2_of_2-11d8ca6bdf6e154c9b62e401b3220b1e.pdf).

Base is different. Its normal sealed L2 chain has a two-second block interval. The contract will treat each two-second Base block as twelve seconds, making its clock run **6x too fast**. It should not be deployed to Base unchanged.

## July

The rate-only, simple-interest calculation is:

```
1,000,000 * 0.04 * 31 / 365 = 3,397.260274 USDC
```

Ethereum has twelve-second *slots*, but a block is not necessarily produced in every slot. Empty/missed slots consume wall time without incrementing `block.number`; Ethereum's documentation explicitly notes that slots can be empty ([ethereum.org](https://ethereum.org/developers/docs/blocks/)). Consequently this code's synthetic seconds can be slightly less than wall-clock seconds. Start/end transaction timing, Arbitrum's lagged/coarse L1-number estimate, and integer division can add smaller boundary/rounding effects.

Ignoring compounding for the moment, a charge of exactly 3,391 USDC corresponds to:

```
synthetic days = 3,391 / (1,000,000 * 0.04) * 365
               = 30.942875 days

blocks counted = 30.942875 * 86,400 / 12
               = 222,789 blocks

ideal 31-day blocks = 31 * 86,400 / 12
                    = 223,200 blocks

difference = 411 blocks = 4,932 synthetic seconds = 82.2 minutes
```

That is only a 0.184% shortfall in counted time, entirely consistent in kind with missed slots plus reconciliation-boundary timing. Because Arbitrum's `block.number` is L1-derived, it sees approximately the same deficit; its rapid L2 block production is irrelevant to this function.

There is one qualification: the supplied totals alone do **not** prove exactly which 411 blocks/82 minutes account for the difference. To reconcile the last dollars exactly, Finance should use each deployment's actual first and last `lastAccrualBlock`, every `accrueInterest()` transaction, the stored index precision, and the debt snapshot/cutoff times.

This matters because the code does not implement strictly simple interest. Every call adds interest to `index`, so later calls compound earlier accrual. For example, with one accrual per day and a perfect 31-day clock, mainnet would produce about 3,402.85 USDC rather than 3,397.26. The exact result therefore depends on call cadence as well as the total block delta. Solidity truncation at each call also depends on the scale used for `index`. The observed 3,391 cannot be derived uniquely without that call history.

## What the unchanged code does on Base

Base's OP Stack specification advances L2 timestamps by `l2_block_time`; Base documents the derivation rules, while the OP Stack documents the normal L2 block time as two seconds ([Base derivation specification](https://docs.base.org/base-chain/specs/protocol/consensus/derivation), [OP Stack glossary](https://docs.optimism.io/op-stack/reference/glossary)). Base Flashblocks updating at roughly 200 ms are preconfirmations within a pending block, not additional sealed block numbers ([Base RPC documentation](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_getBlockByNumber)). The relevant interval here is two seconds, not 200–250 ms.

Over 31 days:

```
actual Base blocks       = 31 * 86,400 / 2 = 1,339,200
seconds the code invents = 1,339,200 * 12  = 16,070,400
                         = 186 days
```

If `accrueInterest()` is called once at the end, the charge is:

```
1,000,000 * 0.04 * 186 / 365 = 20,383.561644 USDC
```

That is exactly six times the intended simple-interest amount. If it is called more often, compounding makes it higher:

```
daily accrual for 31 days: 1,000,000 * ((1 + 0.24/365)^31 - 1)
                         = about 20,585.9 USDC

very frequent accrual limit: 1,000,000 * (exp(0.24 * 31/365) - 1)
                           = about 20,592.7 USDC
```

So a precise Base invoice cannot be stated without call cadence, but under the stated full-period balance it will be approximately 20,384–20,593 USDC under ordinary endpoint-to-very-frequent accrual assumptions, rather than 3,397 USDC. Sequencer downtime and boundary timing can alter the exact block count.

## Recommended change

Use elapsed timestamps, not an assumed number of seconds per block:

```solidity
uint256 public lastAccrualTimestamp;

function accrueInterest() public {
    uint256 secondsElapsed = block.timestamp - lastAccrualTimestamp;
    if (secondsElapsed == 0) return;
    index += index * rateBps * secondsElapsed / (10_000 * 365 days);
    lastAccrualTimestamp = block.timestamp;
}
```

Initialize the timestamp in the constructor and test deployment, upgrades/migration, zero elapsed time, long inactivity, rounding, and the intended compounding convention. Timestamps can be influenced within protocol constraints, so they are unsuitable for tight randomness or exact short deadlines, but they are the appropriate cross-chain clock for month-scale interest.

The product specification should also explicitly choose simple versus compounded interest. The present formula compounds at every call, meaning a public caller can affect rounding and the effective result by changing cadence. If the commercial promise is simple interest, accrue against principal (or use a linear cumulative factor) rather than repeatedly applying the rate to an already-increased index. If compounding is intended, specify a cadence-independent model—typically a documented per-second factor with adequate fixed-point precision—and test it consistently across chains.

# Fixed-rate accrual reconciliation

The Arbitrum result is not using Arbitrum's roughly sub-second L2 block number.
On Arbitrum One, Solidity `block.number` returns a value close to the Ethereum
parent-chain block number where the sequencer received the transaction. The
fast Arbitrum block number is a separate value, available through the Arbitrum
RPC/receipts and through `ArbSys.arbBlockNumber()`.

So this contract did roughly the same thing on Ethereum mainnet and Arbitrum:
it counted Ethereum-ish 12-second blocks, multiplied by `SECONDS_PER_BLOCK =
12`, and accrued from that.

The 31-day rate-only number is:

```text
1,000,000 * 4.00% * 31 / 365 = 3,397.260274 USDC
```

The observed `3,391` is a little lower because `block.number * 12` is only an
approximation of elapsed time. A perfect 31-day July would be:

```text
31 days * 86,400 / 12 = 223,200 blocks
```

Ignoring the small effects of call-frequency compounding and integer truncation,
`3,391` corresponds to:

```text
3,391 / 1,000,000 / 4.00% * 365 days = 2,673,464.4 seconds
2,673,464.4 / 12 = 222,788.7 assumed blocks
```

That is about `411` fewer 12-second blocks than the ideal `223,200`, or about
82 minutes of assumed time. That is consistent with Ethereum's 12-second slots
not all becoming blocks, plus normal reconciliation boundary effects such as the
first and last accrual not landing exactly on month boundaries. Arbitrum matched
mainnet because the contract did not see the fast Arbitrum L2 block cadence.

# What happens on Base

As of September 24, 2026, Base mainnet has not activated Denim. Under current
Base mainnet semantics, Base has canonical L2 blocks every 2 seconds, and
`block.number` is the Base L2 block number. Flashblocks/preconfirmations do not
save this contract, because the contract is still using the canonical block
number as its clock.

For the same 1,000,000 USDC over 31 days, before Denim:

```text
wall-clock seconds in 31 days = 31 * 86,400 = 2,678,400
Base blocks at 2 seconds/block = 2,678,400 / 2 = 1,339,200
contract-assumed seconds = 1,339,200 * 12 = 16,070,400
contract-assumed days = 16,070,400 / 86,400 = 186
interest = 1,000,000 * 4.00% * 186 / 365 = 20,383.561644 USDC
```

So, on current Base, this contract charges about `20,384 USDC`, roughly 6x the
intended `3,397 USDC`, before considering compounding from repeated
`accrueInterest()` calls.

There is an additional deployment-timing risk. Base's official Denim docs say
Base Sepolia and Base Mainnet are planning for October 2026, with exact
activation times still TBD. Denim changes Base from one canonical block every
2 seconds to five canonical blocks per second. If Denim is active during the
31-day period, the same code does this:

```text
Base blocks at 0.2 seconds/block = 2,678,400 / 0.2 = 13,392,000
contract-assumed seconds = 13,392,000 * 12 = 160,704,000
contract-assumed days = 1,860
interest = 1,000,000 * 4.00% * 1,860 / 365 = 203,835.616438 USDC
```

That is roughly 60x the intended July-style interest. If `accrueInterest()` is
called many times, the recursive index update can make the final number higher
than these simple rate-only calculations.

# Recommendation

Do not deploy this unchanged to Base.

Use elapsed time, not elapsed block count, for interest:

```solidity
uint256 public lastAccrualTimestamp;

function accrueInterest() public {
    uint256 secondsElapsed = block.timestamp - lastAccrualTimestamp;
    if (secondsElapsed == 0) return;
    index += index * rateBps * secondsElapsed / (10_000 * 365 days);
    lastAccrualTimestamp = block.timestamp;
}
```

Also decide whether the product is meant to charge simple APR or compounded APR.
The current `index += index * rate * elapsed` design means caller frequency
affects compounding. If fixed-rate borrowers should not be affected by how often
a public function is called, make the rate formula call-frequency-invariant:
either charge simple interest from principal over elapsed seconds, or use a
per-second compounding formula such as `rpow` over `secondsElapsed`.

Sources checked:

- Arbitrum docs, "Block gas limit, numbers and time": `block.number` in an
  Arbitrum smart contract returns the first non-Arbitrum ancestor chain block
  number, while `ArbSys.arbBlockNumber()` returns the Arbitrum block number.
  https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time
- Base derivation docs: current Base L2 block time is 2 seconds, and Ethereum
  L1 has 12-second slots with skipped slots possible.
  https://docs.base.org/specifications/base-protocol/consensus/derivation
- Base Denim docs: Denim is planned for October 2026 and moves Base to
  canonical 200 ms blocks; block-number-based contract logic advances ten times
  faster after activation.
  https://docs.base.org/upgrades/denim/200ms-blocks

# Fixed-rate accrual review

Do not deploy this contract unchanged to Base.

## 1. July reconciliation

The Arbitrum result matched mainnet because the contract did **not** use Arbitrum's fast child-chain block number.

On Arbitrum, Solidity `block.number` inside a contract returns an approximate block number of the first non-Arbitrum ancestor chain. For Arbitrum One, that means an Ethereum/L1-like block number, not the 250 ms Arbitrum block cadence exposed by RPC receipts. Arbitrum has its own child-chain block numbers, and those can also be read onchain via `ArbSys(100).arbBlockNumber()`, but this contract is not doing that.

So the contract's Arbitrum accrual clock is effectively:

```text
Ethereum-ish block count * 12 seconds
```

That is why Arbitrum and mainnet landed together. The `block.number` value driving the formula advances at roughly the same long-run pace on both deployments.

The expected simple 31-day interest is:

```text
1,000,000 * 4.00% * 31 / 365
= 3,397.260273... USDC
```

The observed charge of about 3,391 USDC implies the contract credited only:

```text
3,391 / 3,397.260273... = 99.8157% of the 31-day wall-clock period

effective seconds = 2,678,400 * 0.998157
                  ~= 2,673,464 seconds
                  ~= 30.943 days

effective blocks = 2,673,464 / 12
                 ~= 222,789 blocks
```

A full 31 days at exactly one block every 12 seconds would be:

```text
31 * 86,400 / 12 = 223,200 blocks
```

So July was short by roughly:

```text
223,200 - 222,789 ~= 411 blocks
411 * 12 ~= 4,936 seconds ~= 1 hour 22 minutes
```

That shortfall is consistent with using produced block numbers as a clock rather than elapsed time. Ethereum slots are 12 seconds, but not every slot necessarily produces an execution block, and month boundary/accrual-call timing can also shave off a little time. Integer division in the accrual formula may add a smaller downward rounding bias depending on index precision and call frequency.

In short: Arbitrum did not overcharge because `block.number` there was not the 250 ms Arbitrum block number. Both chains slightly under-accrued because `block.number * 12` is only an approximation of elapsed seconds.

## 2. What happens on Base

Base is an OP Stack L2. Its normal EVM block cadence is about 2 seconds. I also checked the live Base RPC while preparing this: over a recent 100-block sample, block timestamps advanced by 200 seconds, i.e. 2 seconds per block.

This contract would therefore count Base blocks and multiply each one by 12 seconds:

```text
31 days = 2,678,400 real seconds
Base blocks over 31 days ~= 2,678,400 / 2 = 1,339,200 blocks

contract secondsElapsed = 1,339,200 * 12
                        = 16,070,400 seconds
                        = 186 days
```

Interest on 1,000,000 USDC at 4.00% using the contract's effective elapsed time:

```text
1,000,000 * 4.00% * 186 / 365
= 20,383.561643... USDC
```

So on Base, this contract would charge about **20,384 USDC** for the same 31-day period, before small rounding/call-frequency effects. That is about **6x** the intended 3,397 USDC.

Base also has Flashblocks / preconfirmations around 200 ms, but those should not be treated as the Solidity `block.number` cadence for this calculation. If Base ever changed the actual EVM-visible block cadence to 200 ms, the same bug would become about 60x instead of 6x:

```text
1,000,000 * 4.00% * (31 days * 12 / 0.2) / 365
~= 203,836 USDC
```

## Recommended change

Replace block-number-based time with timestamp-based time:

```solidity
uint256 public lastAccrualTime;

function accrueInterest() public {
    uint256 secondsElapsed = block.timestamp - lastAccrualTime;
    if (secondsElapsed == 0) return;
    index += index * rateBps * secondsElapsed / (10_000 * 365 days);
    lastAccrualTime = block.timestamp;
}
```

For month-scale lending interest, `block.timestamp` is the right primitive. It is still sequencer/validator supplied and should not be used for sub-second precision or randomness, but it tracks elapsed time directly and avoids chain-specific block cadence assumptions.

I would also add tests that simulate Ethereum-like 12 second blocks, Base-like 2 second blocks, and Arbitrum's parent-chain `block.number` behavior. The invariant should be: interest for a fixed wall-clock interval is the same across chains, subject only to documented rounding.

Sources checked:

- Arbitrum docs, "Block gas limit, numbers and time": `https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time`
- Base blog, "We're making Base 10x faster with Flashblocks": `https://blog.base.dev/accelerating-base-with-flashblocks`
- Base / OP Stack derivation docs: `https://docs.base.org/base-chain/specs/protocol/consensus/derivation`

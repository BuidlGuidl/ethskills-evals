# Fixed-rate accrual across Ethereum, Arbitrum, and Base

## 1. Why the July reconciliation looked sane

The surprising part is Arbitrum, and the explanation is that this contract is not using Arbitrum's fast child-chain block number.

On Arbitrum, Solidity `block.number` returns an estimate of the first non-Arbitrum ancestor chain block number, not the Arbitrum L2 block number. For Arbitrum One that means an Ethereum L1-ish block number. Arbitrum's own L2 block number is what RPC receipts report as the normal block number, and contracts have to ask the `ArbSys` precompile for it.

So this line:

```solidity
uint256 blocksElapsed = block.number - lastAccrualBlock;
```

counted roughly Ethereum blocks on both Ethereum mainnet and Arbitrum One. It did not count Arbitrum's roughly sub-second child-chain blocks. That is why the Arbitrum deployment landed near the mainnet deployment instead of charging tens of times too much.

The expected 31-day simple-interest amount is:

```text
1,000,000 * 4.00% * 31 / 365 = 3,397.260274 USDC
```

The contract, however, does not measure 31 calendar days. It measures:

```text
(block.number delta) * 12 seconds
```

Ethereum has 12-second slots, but not every slot necessarily becomes a block. Missed slots, plus any endpoint timing and integer truncation in the accrual division, make the measured block count slightly lower than the exact wall-clock count.

The reported 3,391 USDC corresponds to about:

```text
effective days = 3,391 / (1,000,000 * 0.04) * 365
               = 30.942875 days

missing time   = 31 - 30.942875
               = 0.057125 days
               = about 82.26 minutes

expected 31-day slots at 12s = 31 * 86,400 / 12
                             = 223,200

blocks implied by 3,391 USDC ~= 222,789
shortfall                    ~= 411 blocks/slots
```

That is the "shade under" the rate-implied 3,397 USDC: the contract undercounted elapsed wall time because it assumes every 12-second slot has a block, and because every division rounds down.

One separate accounting note: `index += index * ...` compounds whenever `accrueInterest()` is called more than once during a loan's life. If the product promise is simple 4.00% APR, this implementation makes the effective rate depend slightly on accrual frequency. At this size and duration the block-time bug dominates, but the compounding/call-frequency behavior should still be made explicit.

## 2. What happens on Base

Base is not Arbitrum. On OP Stack chains such as Base, `block.number` is the L2 block number. Base currently derives L2 blocks on a 2-second cadence, and Base's Denim upgrade is planned for October 2026 to move canonical blocks to 200ms. Base's docs say exact mainnet activation timing is still TBD.

That means there are two important cases for a deployment next month.

### If Base is still at 2-second canonical blocks

Over 31 days:

```text
wall-clock seconds = 31 * 86,400
                   = 2,678,400

Base blocks        = 2,678,400 / 2
                   = 1,339,200

contract seconds   = 1,339,200 * 12
                   = 16,070,400
                   = 186 days

interest           = 1,000,000 * 0.04 * 186 / 365
                   = 20,383.561644 USDC
```

So at the current 2-second cadence, this contract charges about 20,383.56 USDC for the same 31 calendar days, roughly 6x the intended 3,397.26 USDC.

### If Base Denim 200ms blocks are active

Over 31 days:

```text
Base blocks        = 2,678,400 / 0.2
                   = 13,392,000

contract seconds   = 13,392,000 * 12
                   = 160,704,000
                   = 1,860 days

interest           = 1,000,000 * 0.04 * 1,860 / 365
                   = 203,835.616438 USDC
```

So after Denim, the same code charges about 203,835.62 USDC for 31 calendar days, roughly 60x the intended amount.

If the 31-day period straddles the Denim activation, the result is between those numbers. A useful approximation is:

```text
interest = 1,000,000 * 0.04 * (6 * days_before_Denim + 60 * days_after_Denim) / 365
```

## Recommendation

Do not deploy this same bytecode to Base.

Change accrual to measure elapsed wall-clock seconds directly:

```solidity
uint256 public lastAccrualTimestamp;

function accrueInterest() public {
    uint256 secondsElapsed = block.timestamp - lastAccrualTimestamp;
    if (secondsElapsed == 0) return;

    index += Math.mulDiv(index, rateBps * secondsElapsed, 10_000 * 365 days);
    lastAccrualTimestamp = block.timestamp;
}
```

That removes chain-specific block cadence from the interest formula. It also survives Base's planned 200ms block-number change because EVM `block.timestamp` remains seconds-based.

I would also make two policy choices explicit before shipping:

1. Decide whether the advertised 4.00% is simple APR or an accrual-index rate that compounds as `accrueInterest()` is called. Implement and disclose that intentionally.
2. Use a full-precision `mulDiv` and an explicit rounding policy. Interest rounding should not be an accidental side effect of Solidity integer division.

Sources used:

- Arbitrum block-number behavior: https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time
- Arbitrum Solidity `block.number`: https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/solidity-support
- OP Stack L1 block predeploys, showing L1 block data is exposed separately on L2: https://specs.optimism.io/protocol/predeploys.html
- Base derivation and 2-second block time: https://docs.base.org/specifications/base-protocol/consensus/derivation
- Base Denim 200ms block-number change and October 2026 planning status: https://docs.base.org/upgrades/denim/200ms-blocks

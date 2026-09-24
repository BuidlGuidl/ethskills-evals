The Arbitrum result is not evidence that this pattern is portable. It happened
to agree with mainnet because Arbitrum gives Solidity a different
`block.number` than the one most RPC users mean.

On Arbitrum One, `block.number` inside a contract is approximately the
Ethereum L1 block number at which the sequencer received the transaction, not
the Arbitrum child-chain block height. Arbitrum does have its own much faster
block numbers, and receipts/RPCs expose those, but contracts get the L1-ish
number unless they explicitly call the ArbSys precompile for the Arbitrum block
number. So this contract was not multiplying Arbitrum's roughly 250ms block
cadence by 12 seconds. It was multiplying an Ethereum-L1-correlated block
delta by 12 seconds, which is why the Arbitrum July figure landed close to
mainnet.

The reason both deployments were a little below the rate-implied 3,397 USDC is
that the contract is not measuring elapsed seconds. It is measuring produced
blocks and pretending each produced block represents exactly 12 seconds.

For 31 wall-clock days:

```text
31 days = 2,678,400 seconds
interest = 1,000,000 * 4.00% * 31 / 365
         = 3,397.260273... USDC
```

The observed 3,391 USDC corresponds to:

```text
seconds used by contract = 3,391 / 1,000,000 / 0.04 * 31,536,000
                         = 2,673,464.4 seconds

block delta at 12 seconds/block = 2,673,464.4 / 12
                                ~= 222,789 blocks
```

An ideal 31 days at exactly 12 seconds per block would be:

```text
2,678,400 / 12 = 223,200 blocks
```

So July's charge implies roughly 411 fewer produced L1-style blocks than the
"one block every 12 seconds with no misses" model. That is consistent with
Ethereum's post-merge reality: slots are 12 seconds, but slots can be skipped,
and `block.number` counts produced blocks, not empty/missed slots. Small
additional differences can come from accrual-call boundaries and integer
division, but the main effect is skipped slots.

Base is different from Arbitrum. On Base, `block.number` is the Base L2 block
number. As of today, Base Mainnet is still on two-second canonical blocks, and
the Denim upgrade that moves Base to 200ms canonical blocks is only in planning
for October 2026 with no activation timestamp published. Base's own Denim docs
also warn that `block.number` will advance ten times faster after activation.

If this contract runs on today's two-second Base cadence for the same 31-day,
1,000,000 USDC position:

```text
Base blocks in 31 days = 2,678,400 / 2
                       = 1,339,200 blocks

secondsElapsed used by contract = 1,339,200 * 12
                                = 16,070,400 seconds
                                = 186 days

interest = 1,000,000 * 0.04 * 16,070,400 / 31,536,000
         = 20,383.561643... USDC
```

That is 6x the intended 3,397.26 USDC.

If Denim activates before or during the deployment period and Base is producing
canonical 200ms blocks:

```text
Base blocks in 31 days = 2,678,400 / 0.2
                       = 13,392,000 blocks

secondsElapsed used by contract = 13,392,000 * 12
                                = 160,704,000 seconds
                                = 1,860 days

interest = 1,000,000 * 0.04 * 160,704,000 / 31,536,000
         = 203,835.616438... USDC
```

That is 60x the intended rate.

I would not deploy this bytecode to Base. I would also stop treating the
mainnet/Arbitrum reconciliation as validation of the design. The code is
silently chain-specific and already slightly wrong on Ethereum because it uses
produced block count as a wall-clock proxy.

The fix is to account by elapsed time directly:

```solidity
uint256 public lastAccrualTimestamp;

function accrueInterest() public {
    uint256 elapsed = block.timestamp - lastAccrualTimestamp;
    if (elapsed == 0) return;
    index += index * rateBps * elapsed / (10_000 * 365 days);
    lastAccrualTimestamp = block.timestamp;
}
```

Initialize `lastAccrualTimestamp` from `block.timestamp`. For a 4% APR lending
index, whole-second precision is sufficient; even after Base Denim, EVM
`block.timestamp` remains seconds-based, so multiple 200ms blocks in the same
second simply accrue zero until the next second. If sub-second precision ever
matters on Base specifically, use BaseTime deliberately, not `block.number`.

References checked:

- Arbitrum docs, "Block gas limit, numbers and time": `block.number` in an
  Arbitrum contract returns the approximate block number of the first
  non-Arbitrum ancestor chain, while ArbSys exposes the Arbitrum block number.
  https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time
- Base docs, "Denim / 200ms Native Blocks": Denim targets October 2026,
  changes Base from one canonical block every two seconds to five per second,
  and warns that `block.number` advances ten times faster after activation.
  https://docs.base.org/upgrades/denim/200ms-blocks

# Post-mortem: 38 liquidations after the Arbitrum sequencer outage

## Short answer

Your check only asks whether **the price is fresh**. Here it was. Nothing in your code asks whether **borrowers had a chance to act on that price**. On an L2 those are separate questions. For 3.5 hours they had different answers.

The missing piece is a **sequencer uptime check with a grace period**, put in front of liquidations.

## What happened

1. **The chain stopped, not the price.** Arbitrum One has one sequencer. It is the node that orders transactions and makes blocks. From 09:14 to 12:40 it was down. No blocks were made, so the chain's clock (`block.timestamp`) stopped. Your borrowers' add-collateral transactions sat unconfirmed. In theory they could have gone around the sequencer through the L1 delayed inbox ("force inclusion"). In practice that route has a delay of about 24 hours, and no normal user or app uses it. So your users were locked out.

2. **The market kept moving.** ETH fell 11% on Binance and on mainnet. Your users' collateral lost value in the real world. They could not respond on-chain.

3. **The sequencer came back and everything landed at once.** In the first blocks after 12:40:
   - Chainlink nodes pushed new wstETH prices. The deviation threshold had been broken long ago, so an update was due immediately. `updatedAt` was the current block time.
   - `block.timestamp` jumped forward to the real time.
   - Keeper bots were waiting with liquidation transactions ready. They are built for exactly this moment.

4. **Your check passed, correctly.** `block.timestamp - updatedAt` was a few seconds. The price was real, and it was fresh. Positions below 125% were liquidatable by your rules. The keepers won the race against borrowers, who were still refreshing a frontend, re-signing stuck transactions, or asleep.

**Why staleness checks can't catch this:** a staleness check compares the price's age to the chain's clock. During the outage, both the price updates and the clock were frozen. When the chain came back, both jumped forward together. So the price looks fresh the whole time. The 3.5-hour gap sits in the *users'* ability to act, and that is not a property of the price feed. Making the bound tighter (60s, 10s) would not have saved one position.

This is a known L2 issue. Chainlink publishes an **L2 Sequencer Uptime Feed** for this purpose, and Aave v3 guards against it with `PriceOracleSentinel`.

## What to change

### 1. Read the Sequencer Uptime Feed

Arbitrum One: `0xFdB631F5EE196F0ed6FAa767959853A9F217697D` (check against Chainlink's docs before deploying).

`latestRoundData()` on this feed returns:
- `answer`: `0` = sequencer up, `1` = sequencer down
- `startedAt`: the time the status last changed (for example, when it came back up)

The status update travels from L1 through Arbitrum's inbox. So the "back up" flip is ordered **before** the transactions that pile up after recovery. `startedAt` therefore reliably marks when the outage ended.

### 2. Add a grace period after recovery

Block liquidations until `GRACE_PERIOD` has passed since the sequencer came back. This gives borrowers time to see the new price and add collateral or repay. Chainlink's example uses 3600s. Pick a value that fits how fast your users realistically react. Make it a governance-settable parameter, not a constant buried in code.

```solidity
AggregatorV2V3Interface public immutable sequencerUptimeFeed;
uint256 public gracePeriod; // e.g. 3600

error SequencerDown();
error GracePeriodNotOver();

function _checkSequencer() internal view {
    (, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();

    // answer: 0 = up, 1 = down
    if (answer != 0) revert SequencerDown();
    // On Arbitrum, startedAt == 0 means the uptime feed isn't initialised; treat it as unsafe
    if (startedAt == 0) revert SequencerDown();
    if (block.timestamp - startedAt <= gracePeriod) revert GracePeriodNotOver();
}
```

### 3. Where it goes in the flow

Put it at the **start of `liquidate()`, before the price read and the health check**. It needs to be separate from your price-fetch helper, not merged into it:

```
liquidate(borrower, ...)
  ├─ _checkSequencer()             <-- NEW: revert if down or in grace period
  ├─ price = _getPrice()           (existing: answer > 0, staleness <= 3600)
  ├─ require(collateralRatio(borrower, price) < 125%)
  └─ seize / repay ...
```

Apply it per action like this:

| Action | During outage / grace period |
|---|---|
| `liquidate` | **Blocked** |
| `borrow` / withdraw collateral | **Blocked**. Price-dependent actions that *add* risk shouldn't run while others can't react either (this is what Aave does) |
| `depositCollateral` / `repay` | **Always allowed**. These are how users save themselves. Never gate them. |

Do **not** put the check inside a shared `getPrice()` that deposit or repay also call. If you do, you block the exact rescue actions the grace period exists to protect.

### 4. Optional: an escape hatch for bad debt

A full hour with no liquidations after a big move can leave some positions underwater (collateral worth less than debt), and the protocol absorbs the loss. Aave handles this by still allowing liquidation during the grace period if the position is *deeply* unhealthy (health factor below 0.95). You could do the same, e.g. allow liquidation in the grace period only below ~105% collateralisation. That keeps users who can still be saved safe, and still cleans up positions that are already lost. This is a risk-policy decision: it trades user protection against protocol solvency. Decide it on purpose.

### 5. Also check

- **Interest accrual across the gap.** When `block.timestamp` jumps 3.5h, interest for the whole gap gets added in the first block. That's correct math, but it pushes borderline positions further down at the same moment. The grace period covers this too.
- **Frontend/keepers.** Show a banner in the app when the uptime feed reports down or in grace. If you run your own keepers, have them read the same feed.

## Unresolved questions

- Grace period length: 1h default, or longer given your users' profile?
- Adopt the deep-insolvency exception (step 4)? If yes, at what ratio?
- Remediation for the 38 affected borrowers: that's a policy/treasury decision, not covered here.

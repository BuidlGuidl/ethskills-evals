# Base ERC-20 Gas Spend Plan

Date: 2026-09-23

## Current Spend

Assumptions used by the shipped model in `src/gasModel.js`:

| Input | Value | Source |
| --- | ---: | --- |
| Transfers | 40,000/day | Product/Finance prompt |
| Current Base gas price | 0.006 gwei | `eth_gasPrice` from `https://mainnet.base.org` on 2026-09-23 |
| Current Base base fee | 0.005 gwei | `eth_feeHistory` from `https://mainnet.base.org` on 2026-09-23 |
| Recent Base USDC transfer gas | 45,065 median, 49,746 average, 40,259-62,171 range | 20 recent Base USDC `transfer` receipts sampled on 2026-09-23 |
| Recent direct-transfer L1 fee | 2,925,030,248 wei/tx | Same receipt sample |
| ETH/USD | $2,746.43 | Investing.com ETH/USD snapshot on 2026-09-23 |

Baseline formula:

```text
per-transfer wei = 45,065 gas * 0.006 gwei + 2,925,030,248 wei L1 fee
                 = 273,315,030,248 wei
                 = 0.000000273315 ETH
                 = $0.00075064

daily spend      = $0.00075064 * 40,000 = $30.03/day
30-day spend     = $900.77/month
```

A conservative 65,000-gas ERC-20 assumption would be about `$43/day` and `$1,295/month`, but the current on-chain Base USDC sample is cheaper than that.

## Ranked Changes

| Rank | Change | Estimated saving | Why it saves |
| ---: | --- | ---: | --- |
| 1 | Batch same-token payouts through `PackedERC20BatchDistributor` | `$13.79/day`, `$413.82/month`, about `45.9%` of current spend | Removes almost all per-transfer transaction overhead by paying many recipients in one transaction. Assumes 200 recipients/batch, 35,000 fixed batch gas, and 24,365 execution gas per recipient. |
| 2 | Enforce dynamic Base fee params instead of static gas prices | `$4.95/day` for every extra `0.001 gwei` currently overpaid; `$465/day` if a relayer is pinned at `0.1 gwei` | Base is at or near its 0.005 gwei minimum today. A static high gas price dwarfs normal transfer cost. |
| 3 | Use packed calldata for batches instead of ABI arrays | Included in rank 1; isolated value is only about `$0.05/day` at current L1 data fees | Packed records are 32 bytes each: 20-byte recipient + uint96 amount. Two ABI arrays are roughly 64 bytes per recipient. |
| 4 | Filter invalid, zero, or duplicate payouts before signing | `$0.30/day` per 1% skipped at the current baseline | Avoids spending a full transfer fee on payments that should never reach the chain. The encoder now rejects zero amounts and malformed addresses. |
| 5 | Delay transfers for lower gas windows | Approximately `$0/day` right now | Base is already at the 0.005 gwei protocol floor in the sampled blocks, so scheduling cannot buy much unless the network is temporarily congested. |

## Recommendation

Ship rank 1 and rank 2 together:

1. Deploy `contracts/PackedERC20BatchDistributor.sol`.
2. Fund the distributor contract with the token balance used for outbound payments.
3. Authorize the existing relayer with `setExecutor(relayer, true)`.
4. Group payouts by token and encode each group with `encodePackedTransfers`.
5. Submit `distributePacked(token, packedPayments)` with fee params from `buildBaseFeeParams`.

Use a target batch size of `200` immediately. Base's current per-transaction gas maximum is `16,777,216`; the model's 24,365 per-recipient execution estimate leaves room for roughly 680 recipients, but `200` keeps failure domains and retry blast radius small. Larger batches save very little beyond 200 because the fixed overhead is already amortized.

## Implementation Shipped

- `contracts/PackedERC20BatchDistributor.sol`: owner/executor batch distributor for packed ERC-20 transfers.
- `src/packedTransfers.js`: validates and packs `{ to, amount }` records into the contract calldata format.
- `src/baseFeePolicy.js`: Base-specific EIP-1559 fee helper with a 0.001-0.002 gwei priority-fee band and 0.02 gwei max-fee ceiling.
- `src/gasModel.js`: reusable Finance model for direct vs batched transfer cost.
- `scripts/generate-plan.js`: emits the current modeled spend and savings as JSON.
- `test/gasModel.test.js`: covers batching savings, overtipping math, fee caps, and packed encoding.

Run:

```bash
npm test
npm run gas:plan
```

## Operational Notes

- The batch distributor changes custody: funds must sit in the distributor contract, not the relayer EOA.
- A failed token transfer reverts the whole batch. Keep batches token-homogeneous and pre-validate recipients and amounts.
- `uint96` amounts are intentional to keep each packed payment at 32 bytes. That supports up to `79,228,162,514` whole tokens at 18 decimals, which is far above normal payment sizes.
- Track realized spend from receipts as `gasUsed * effectiveGasPrice + l1Fee`; alert if effective gas price exceeds the policy by more than `0.001 gwei`.

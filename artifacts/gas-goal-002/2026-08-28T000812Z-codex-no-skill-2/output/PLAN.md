# Base relayer gas plan

## What is known now

There is no transaction export or sender implementation in this workspace, so an exact historical ETH total cannot be reconstructed here. Base fees have three parts: L2 execution, L1 data, and (where applicable) the OP Stack operator fee. The first is the only part represented by the usual `gasUsed * gasPrice` number. Do not report that number alone as the total cost.

Use the last 7 days of relayer transactions to populate this calculation:

```
daily total ETH = sum(l2GasUsed * l2GasPriceWei + l1DataFeeWei + operatorFeeWei) / 1e18
daily USD       = daily total ETH * ETH_USD
```

Until that export is available, this is the useful planning baseline. A normal ERC-20 `transfer` to an already-funded recipient is conservatively modelled at **51,000 L2 gas**. At 40,000 transfers/day that is **2,040,000,000 L2 gas/day** or **744.6 billion L2 gas/year**, before L1 data and operator fees. If the L2 gas price is `P` gwei, that component alone is `2.04 × P ETH/day` (for example, 0.00204 ETH/day at 0.001 gwei). Replace 51,000 and P with the p50/p95 from the export; recipient balances, token implementation, and calldata affect it a lot.

## Ranked changes

The order below is by recurring saving, not by implementation convenience. Numbers are L2 execution gas; L1-data savings are additional unless noted.

| Rank | Change | Daily saving at 40k/day | Why / assumptions |
| --- | --- | ---: | --- |
| 1 (when eligible) | Keep internal payments in an off-chain balance ledger and settle only withdrawals | **51,000 gas for every avoided transfer**; maximum **2.04B gas/day (100%)** | This changes the product/custody model. If 60% of payments stay internal, the saving is 1.224B gas/day. Publish balances, define withdrawal SLAs, and obtain legal/compliance approval before doing it. |
| 2 | Batch 100 payouts per token using the shipped distributor | about **808M gas/day (39.6%)**, plus L1-data savings | Conservative model: 100 singles = 5.10M gas; one packed batch = about 3.08M gas. The batch preserves one ERC-20 transfer per recipient, but removes 99 transaction envelopes and makes repeated token calls warm. 40,000 transactions become **400**. Estimate actual token/recipient samples before committing to the percentage. |
| 3 | Net duplicate `(token, recipient)` payouts within each batch/window before batching | **about 30,800 gas per payout eliminated after batching** | At a 10% duplicate rate that is roughly **123M gas/day** beyond batching. It must preserve invoice-level accounting and only net payments with compatible availability requirements. |
| 4 | Send only during acceptable Base fee windows, with a service-level deadline | variable; only the price spread, not gas units | This does not reduce gas use. Savings are `daily fee × (current price - chosen price) / current price`; it matters only for payments that may wait. Never strand payroll/refunds for a fee target. |

The conditional upper bound in rank 1 is larger than batching, but batching is the largest unconditional on-chain saving and is ready to pilot now.

## Shipped implementation: compact batch distributor

`src/ERC20BatchDistributor.sol` is a dependency-free Solidity 0.8.24 contract. The existing relayer deploys it, transfers each token's working balance into it, then calls `batchTransfer`. Only that deployer can spend or recover the contract's balance. The packed payload is deliberately **52 bytes/payment**:

```
20-byte recipient address || 32-byte uint256 token amount
```

This is smaller than ABI `address[]` + `uint256[]` encoding (64 bytes/payment, plus array headers) and avoids per-payment storage. The contract accepts both standard ERC-20 `true` responses and legacy no-return tokens; it reverts the whole batch on a failed transfer, which is required to avoid partial payrolls.

Create the payload from decimal base units (not display units):

```
node scripts/encode-payments.mjs payouts.json
cast send "$BATCHER" 'batchTransfer(address,bytes)' "$TOKEN" "$(node scripts/encode-payments.mjs payouts.json)" --rpc-url "$BASE_RPC" --private-key "$RELAYER_KEY"
```

Example `payouts.json`:

```json
[{"recipient":"0x1111111111111111111111111111111111111111","amount":"1250000"}]
```

Use batches of 50–200 as a starting point (100 is the financial model above), grouped by token. Keep a small prefunded working balance; the top-up itself is a separate transfer, so do not fund once per batch. The relayer key is now also the custody key for this balance: use its production signing controls and monitor the distributor balance.

## Rollout and measurement

1. Export 7 days of successful relayer sends including transaction input, `gasUsed`, effective L2 gas price, L1 data fee, and operator fee. Separate each token and whether the recipient balance was zero before payment.
2. On Base Sepolia, estimate and send representative batches of 1, 10, 50, 100, and 200 for every supported token. Compare their **all-in** fees with the same payouts sent individually. A token that charges transfer fees, rebases, pauses, blacklists, or has unusual return data needs explicit integration tests before inclusion.
3. Deploy with the relayer as owner, verify the source, fund a capped float, and shadow-build batches for a day. Check totals, recipient/amount ordering, idempotency keys, and reconciliation before broadcasting.
4. Canary one token at 50 payments/batch, then increase to 100 after a full reconciliation cycle. Record `payment_count`, all-in fee, gas/payment, and failed/retried batches. Roll back by stopping new calls and using the owner-only `withdraw` function to return the float.

Run the included checks with `npm test`. They compile the contract and verify packed decoding, authorization, malformed data rejection, and recovery.

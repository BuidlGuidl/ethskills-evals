# Review: stake widget

Verdict: **request changes.** The widget checks only one thing, `isConnected`, when it needs to check four. And it keeps approval status in a local flag, which can be wrong, instead of reading the allowance from the chain.

## 1. User on Arbitrum, zero allowance

**What they see:** `isConnected` is true, so the widget shows **Approve and Stake side by side**. Nothing says "wrong network." Nothing tells them which button to press first, and the two buttons look equally important.

**Click Stake first.** This is easy to do, because Stake is always visible.
- The call has no `chainId` and nothing checks the network, so it goes to whatever chain the wallet is on. Depending on the connector and config, wagmi either throws (the chain isn't configured, or the chain doesn't match) or tries to send the transaction on Arbitrum. On Arbitrum the staking address either has no contract or holds some unrelated contract. So the user gets a raw error, a failed gas estimate, or a transaction that does nothing useful.
- Even on mainnet it would revert, because the allowance is 0.
- There is no pending state and no readable error message, so the user doesn't know what went wrong.

**Click Approve.**
- The same thing happens: the approve targets the wrong chain. It either throws, or it sends `approve` to whatever sits at that address on Arbitrum.
- If it throws (for example, the user rejects it or the chain isn't configured), `setHasApproved(true)` never runs, the button stays, and the user gets no message.
- If the wallet returns a hash, `hasApproved` becomes `true` and the Approve button disappears. The **mainnet allowance is still 0**, but the UI now looks "approved," with only Stake left. Stake can't work: it's on the wrong chain, and even after switching networks the allowance is still 0.
- The button isn't disabled while the request is pending, so a double-click sends two approve transactions.

The user never gets asked to switch to Ethereum mainnet. The widget can't reach a working state from here.

## 2. The subtler bug: `hasApproved` goes stale

`hasApproved` records that "an approve transaction was **sent** from this component." It doesn't record that "the **current account** has enough allowance **right now** for **this amount**." Here are concrete sequences where the flag hides Approve while Stake can only revert:

**A. The allowance gets used up (most common).** Everything happens on mainnet.
1. Connect. The allowance is 0. Click **Approve**. The wallet approves exactly 100 tokens (the usual exact-amount approve, or the user edits the amount in the wallet). Once the hash returns, `hasApproved = true` and the Approve button disappears.
2. Click **Stake** for 100. It succeeds, and `transferFrom` uses the whole allowance. It's now 0.
3. Without reloading, click **Stake** again for another 100. Only Stake is showing, because `hasApproved` is still `true`. The transaction **reverts** ("insufficient allowance"). Approve can't come back until the page reloads.

**B. Switching accounts.** Account 1 approves, so `hasApproved = true`. The user switches the wallet to Account 2. The component stays mounted, `isConnected` is still true, and the flag is still `true`. Account 2 has 0 allowance, sees only Stake, and the stake reverts.

**C. Sent but not mined.** `await approve()` finishes when the wallet **returns the hash**, not when the transaction is confirmed. The user clicks Stake right away, before the approve is mined, so Stake reverts. If the approve later gets dropped, replaced (speed up or cancel), or reverts, the flag stays `true` for good while the allowance stays 0.

**D. The amount goes above the allowance.** The user approves 50, then types 500. The flag is still `true`, Stake shows alone, and it reverts.

**E. Revoked elsewhere.** The user revokes the approval in revoke.cash or in another tab. The flag doesn't change, and Stake reverts.

The root cause is the same in every case. Approval is **onchain state**: it depends on the account, the token, the spender, and the amount, and other actions change it. Keeping a UI copy of it is guaranteed to drift. Saving one RPC call isn't worth a button that can't work.

## 3. The flow the widget should implement

Show **exactly one primary button**. Run the checks in this order and render the first one that matches:

| # | Condition | Single primary action |
|---|---|---|
| 1 | Not connected | **Connect wallet** |
| 2 | `chainId !== mainnet.id` | **Switch to Ethereum** (`switchChain({ chainId: mainnet.id })`), with a line explaining why |
| 3 | Amount empty, zero, or not valid | Disabled **Enter an amount** |
| 4 | `amount > balance` | Disabled **Insufficient balance** |
| 5 | Allowance still loading | Disabled button showing a loading state (don't guess) |
| 6 | `allowance < amount` | **Approve** (or "Approve N TOKEN") |
| 7 | Otherwise | **Stake** |

Rules:

- **Where approval status comes from:** use `useReadContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [account, stakingContract], chainId: mainnet.id })`, and compare it to `parseUnits(amount, decimals)` in base units. Nothing stored in component state should decide this. The read depends on the account, chain, and amount, so switching accounts or networks updates it automatically.
- **After each transaction:** wait for `waitForTransactionReceipt` and check that `status === 'success'`. Then **refetch the allowance** (and balances), and let that refetch decide the next button. After an approve, the button changes to Stake because the allowance now covers the amount. After a stake, it changes back to Approve if the stake used up the allowance.
- **Pending state:** each button has one pending state. It lasts from the click through the receipt *and* the refetch, and it's cleared in `finally` so a rejected request can't leave the button stuck. Pending buttons are disabled with a label like "Approving…" or "Staking…". This fixes the double-click problem.
- Pin every write and read to `chainId: mainnet.id`, so nothing can ever reach Arbitrum.
- Turn wallet rejections and reverts into readable messages, and show them next to the button.
- Do token math in the token's real decimals (`parseUnits`/`formatUnits`), and never show raw base units.

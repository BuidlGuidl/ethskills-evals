# Review: stake widget

Verdict: **request changes.** The widget checks only `isConnected`, and it tracks approval in local component state (`hasApproved`), which says nothing about what is actually on chain. Neither is enough.

---

## 1. User connected on Arbitrum (app is mainnet-only), allowance = 0

**What they see:** both **Approve** and **Stake**, side by side and equally prominent. Nothing says they're on the wrong network, and nothing says which button to press first. `isConnected` is true on any chain, so the widget renders as if all is fine.

**Click Stake** (a likely first click, since it's the button they came for):
- The call targets the mainnet staking address, but through the wallet's current chain, Arbitrum. One of two things happens:
  - wagmi or the wallet rejects it (chain mismatch, or the chain isn't in the config). The user gets a raw error or nothing at all, because `stake` has no error handling in the UI.
  - Or it goes out on Arbitrum to an address that has no contract there, or a different one. Gas estimation fails or the tx reverts, and the user may pay Arbitrum gas for nothing.
- Even on mainnet it would revert: allowance is 0, so `transferFrom` fails. The UI allows a click that cannot succeed in either case.

**Click Approve:**
- Same chain problem. `approve()` either throws, or it sends an `approve` on **Arbitrum** to the mainnet token address. If no code lives at that address on Arbitrum, the call "succeeds" (a call to an empty address does not revert). The user pays gas, and the mainnet allowance stays 0.
- If the call doesn't throw, `setHasApproved(true)` runs and the Approve button disappears. The UI now shows only Stake, and it still fails.
- If it throws (user rejects, chain mismatch), `setHasApproved` is skipped. But the rejection is unhandled, so there's no error message and no pending state. The user can also double-click and fire two approvals.
- If `approve` is wagmi's fire-and-forget `writeContract` rather than `writeContractAsync`, it returns `void`. The `await` then resolves right away, and `hasApproved` becomes true **before the user has even signed**, even if they reject.

What should happen: a single **Switch to Ethereum** button, and nothing else.

## 2. The subtler bug: `hasApproved` goes stale

`hasApproved` is set when the approve tx is **sent**, not when it is confirmed. It is never tied to the account, chain, amount, or actual on-chain allowance, and nothing ever sets it back to false. It lasts as long as the component stays mounted.

**Concrete sequence (exact-amount approval gets used up):**
1. User is on mainnet with allowance 0 and types 100.
2. Clicks **Approve** (approve for exactly 100), signs, and the tx mines. `hasApproved = true`, so the Approve button is hidden.
3. Clicks **Stake** for 100. It mines, and `transferFrom` uses up the allowance: it is now **0**.
4. Without reloading, the user stakes another 50. The widget shows **only Stake**, because `hasApproved` is still true. Stake reverts (insufficient allowance), and the user has no way to approve again short of reloading the page.

Other sequences that end in the same state (Stake only, allowance 0):
- **Account switch:** account A approves, then the user switches to account B in the wallet. `hasApproved` stays true, B's allowance is 0, and Approve never shows for B.
- **Dropped or reverted approve:** user sends the approve, then cancels or speeds it up in MetaMask, or it gets dropped for low gas, or it reverts. The flag is already true because it was set when the tx was sent.
- **Approved on the wrong chain:** approve on Arbitrum (section 1), then switch to mainnet. Approve stays hidden, and mainnet allowance is 0.
- **Amount grows:** approve 100, then type 500. Allowance of 100 < 500, but only Stake shows.
- **Allowance revoked elsewhere** (revoke.cash, another tab). The flag is still true.

The saved RPC call isn't worth it. The allowance read is one cheap `eth_call`, and it is the only reliable source.

## 3. Correct flow

Show **exactly one primary action button** at a time. Run the checks in this order and render the first one that matches:

| # | Condition | Primary action |
|---|---|---|
| 1 | Wallet not connected | **Connect Wallet** |
| 2 | `chainId !== mainnet.id` | **Switch to Ethereum** (`useSwitchChain`) — no Approve/Stake rendered |
| 3 | Balance / allowance not loaded yet | Disabled "Loading…" |
| 4 | Amount empty, zero, or invalid | Disabled "Enter amount" |
| 5 | Amount > token balance | Disabled "Insufficient balance" |
| 6 | Approve tx pending (sent, awaiting receipt) | Disabled "Approving…" + explorer link |
| 7 | `allowance < amount` | **Approve** |
| 8 | Stake tx pending | Disabled "Staking…" + explorer link |
| 9 | Otherwise | **Stake** |

Order matters: connection, then network, then data loaded, then input valid, then pending txs, then allowance. Approve and Stake are never rendered together. Row 8 can be checked before row 7 (since staking uses up allowance) so the "Staking…" state isn't replaced by "Approve" while the stake is in flight.

### Where approval status comes from

Approval status must come **only from the on-chain `allowance`**. Never keep a local boolean.

- `useReadContract({ address: TOKEN, abi: erc20Abi, functionName: 'allowance', args: [address, STAKING], chainId: mainnet.id, query: { enabled: !!address } })`
  - The query key includes `address` and `chainId`, so switching account or chain refetches it automatically.
  - Pinning `chainId: mainnet.id` means it always reads mainnet, whatever chain the wallet is on.
- Compare as bigints: `allowance >= parseUnits(amount, decimals)`. A true/false flag is not enough, because the answer depends on the amount.
- After approve: get the hash, then wait with `useWaitForTransactionReceipt({ hash })`. Check `receipt.status === 'success'`, **then refetch allowance**. The refetched allowance decides whether Stake appears. The flag "tx sent" never does.
- After stake succeeds: refetch allowance and balance (the allowance may now be used up).
- Pass `chainId: mainnet.id` to every `writeContract` call. wagmi then refuses to send on the wrong chain instead of silently sending on Arbitrum.
- Catch errors from both writes. Show "Transaction rejected" or the revert reason, and go back to the right state.

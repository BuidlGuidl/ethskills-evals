# Review

A user connected on Arbitrum sees both actions immediately, because the widget only checks `isConnected`:

- `hasApproved` starts as `false`, so `Approve` is rendered.
- `Stake` is always rendered whenever the wallet is connected.

That is already wrong for a mainnet-only app. The first required action should be to switch to Ethereum mainnet, not to approve or stake.

With zero allowance:

- Clicking `Stake` tries to stake while the wallet is on Arbitrum. If the write is not explicitly guarded to mainnet, the wallet may prompt/send the transaction on Arbitrum using addresses meant for mainnet. If the write is guarded, wagmi/viem should reject with a chain mismatch. Either way, the button cannot complete the intended mainnet stake.
- Clicking `Approve` has the same network problem. It either submits an approval on Arbitrum or fails due to chain mismatch. Even if the transaction is submitted, it does not prove that the user now has mainnet allowance. The component then calls `setHasApproved(true)` as soon as `approve()` resolves, which usually means the transaction was sent, not that it was mined successfully or that the mainnet allowance is now sufficient.
- After that, the widget hides `Approve` and leaves only `Stake`, even though the user may still be on the wrong chain and may still have zero usable mainnet allowance.

The subtler bug is that `hasApproved` is local component state, not blockchain state and not scoped to the connected wallet, chain, token, spender, or stake amount. A concrete failing sequence:

1. User connects Account A on mainnet.
2. Account A has zero allowance.
3. User clicks `Approve`.
4. `approve()` returns after the transaction is submitted, so `hasApproved` becomes `true`.
5. User switches to Account B, which has zero allowance, without unmounting the widget.
6. The widget still has `hasApproved === true`, so it hides `Approve` and shows `Stake`.
7. Account B clicks `Stake`, but staking cannot work because Account B never approved the staking contract.

The same class of bug can happen after switching chains, changing the stake amount beyond the approved allowance, changing token or spender addresses, or after an approval transaction is dropped or reverted.

The widget should render exactly one primary action at a time, in this priority order:

1. If no wallet is connected: show `Connect wallet`.
2. If the connected chain is not Ethereum mainnet: show `Switch to mainnet`.
3. If the stake form is invalid or the user has insufficient token balance: show a disabled primary action with the relevant reason.
4. If an approval transaction is pending or confirming for the current account, chain, token, spender, and amount: show a disabled `Approving...` or `Waiting for approval...` action.
5. Read the mainnet token allowance for the connected account and staking contract. If it is less than the amount to stake: show `Approve`.
6. If a stake transaction is pending or confirming: show a disabled `Staking...` or `Waiting for stake...` action.
7. Once the confirmed onchain allowance is sufficient and no stake transaction is in flight: show `Stake`.

Approval status must come from the chain, not React component memory. Read the ERC-20 `allowance(owner, spender)` for the connected account, token, spender, and mainnet chain using wagmi/viem, compare it to the current stake amount, and invalidate/refetch that read after the approval transaction is confirmed. Component state can track UI transaction lifecycle, such as a pending approval hash, but it must not be the source of truth for whether staking is allowed.

# Review

For a user connected on Arbitrum while the app is mainnet-only, `isConnected` is true, so the widget renders both `Approve` and `Stake` even though no mainnet action can succeed from the current wallet state.

With zero allowance, the user sees:

1. `Approve`
2. `Stake`

If they click `Approve`, the app calls `approve()` before checking that the wallet is on mainnet. The best case is that wagmi/wallet rejects with a wrong-chain or unsupported-chain error. The worse case is that the wallet sends an approval on Arbitrum, which still does not create the required mainnet allowance. If `approve()` resolves when the transaction is merely submitted, `setHasApproved(true)` also runs before the approval is confirmed onchain.

If they click `Stake`, the app calls `stake()` while the wallet is still on Arbitrum and while the user has zero mainnet allowance. That transaction either fails because the chain is wrong, or it targets the wrong chain/contract context. It cannot perform the intended mainnet stake.

The obvious UX bug is that the widget shows two onchain buttons at the same time and offers `Stake` before staking is actually possible. The wrong-network state should be handled before either approval or staking is offered.

The subtler bug is that `hasApproved` is local component state, not allowance. A concrete failing sequence:

1. User connects Account A on mainnet with zero allowance.
2. User clicks `Approve`.
3. `approve()` returns after the wallet submits the transaction hash, so the component sets `hasApproved` to `true`.
4. Before the allowance is confirmed, or after the approval transaction fails/is replaced/cancelled, the widget hides `Approve` and leaves only `Stake`.
5. User clicks `Stake`.

That `Stake` button cannot work because the actual onchain allowance is still zero. The same stale-state bug appears if the user approves with Account A, then switches to Account B while the component stays mounted: `hasApproved` remains `true`, but Account B has no allowance, so the UI shows `Stake` even though staking cannot succeed.

The widget should implement a single primary action in this priority order:

1. No wallet connected: render `Connect Wallet`.
2. Wallet connected to any non-mainnet chain: render `Switch to Mainnet`.
3. Wallet connected to mainnet, but allowance is missing or less than the stake amount: render `Approve`.
4. Wallet connected to mainnet and allowance is sufficient: render `Stake`.

Each onchain action should disable immediately when clicked, show a pending label such as `Approving...` or `Staking...`, and stay disabled until the relevant chain state has caught up. Approval status must come from fresh onchain allowance data for the current `owner`, `token`, `spender`, `chainId`, and stake `amount`, for example via a wagmi read hook/refetch against the ERC-20 `allowance`. Component state can track UI pending/submitting status, but it must not be the source of truth for whether approval exists.

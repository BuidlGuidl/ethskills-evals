## Review

For a user connected on Arbitrum, `isConnected` is true even though the app is mainnet-only. With zero allowance and `hasApproved === false`, the widget renders both `Approve` and `Stake`.

If the user clicks `Stake` first, the app tries to stake while the wallet is still on Arbitrum. That transaction cannot perform the app's intended mainnet stake. Depending on how `stake` is written, it will either fail because the configured contract is not available on Arbitrum, fail because wagmi/viem rejects the chain mismatch, or submit to the wrong chain if there is a contract/address there. In none of those cases does it create a valid mainnet stake.

If the user clicks `Approve`, the app asks for/sends an approval while still on Arbitrum, or errors because the chain is unsupported. If it does send, that approval is for the connected chain, not Ethereum mainnet. The handler then calls `setHasApproved(true)` after `approve()` resolves, which in wagmi write flows usually means the transaction was submitted or a hash was returned, not necessarily mined and reflected in allowance. The UI now hides `Approve` and leaves `Stake`, even though the user still has zero mainnet allowance.

The subtler bug is that `hasApproved` is local component memory, not approval state. A concrete broken sequence:

1. User connects Account A on mainnet with zero allowance.
2. User clicks `Approve`.
3. The component sets `hasApproved` to `true`.
4. User switches the wallet to Account B, which has zero allowance.
5. The component still has `hasApproved === true`, so it renders `Stake`.
6. Account B clicks `Stake`, but the stake cannot work because Account B never approved the staking contract.

The same class of bug happens if the user changes chain, changes token/spender/amount, revokes allowance in another tab, the approval transaction is dropped/reorged, or the desired stake amount is greater than the approved allowance. Component state cannot be the source of truth for allowance.

## Correct Flow

The widget should render one primary action at a time, in this priority order:

1. If no wallet is connected, render `Connect Wallet`.
2. If the wallet is connected to any chain other than Ethereum mainnet, render `Switch to Ethereum`.
3. Once connected to mainnet, read the token allowance for the current `account`, `token`, `spender`, and required `amount`.
4. If allowance is missing, loading, stale, or less than the required amount, render `Approve`.
5. If allowance is confirmed onchain and sufficient, render `Stake`.

Approval status must come from fresh onchain allowance reads, keyed by account, chain, token, spender, and amount. The approve button should remain disabled with an approving/pending state from click through confirmation, then refetch allowance before replacing it with `Stake`. The stake button should only appear after the mainnet allowance read confirms the current wallet can actually stake.

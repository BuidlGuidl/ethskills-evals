# Stake Widget Review

A user connected on Arbitrum sees both staking controls because the widget only checks `isConnected`. That is already wrong for a mainnet-only app: the primary action should be to switch to Ethereum mainnet, not to approve or stake.

With zero mainnet allowance:

1. The widget renders `Approve` and `Stake`.
2. Clicking `Stake` cannot successfully stake in the mainnet app. Depending on how the write is configured, wagmi/viem will either reject because the wallet is on the wrong chain, or the wallet will try to send the transaction on Arbitrum, where it does not create a mainnet stake.
3. Clicking `Approve` has the same wrong-network problem. If the transaction is allowed to be sent, it approves on the connected chain, not on Ethereum mainnet. If the app pins the write to mainnet, the call should fail until the wallet switches networks.
4. The component sets `hasApproved` after `approve()` resolves, which usually means the transaction was submitted, not that the approval is mined, successful, on the correct chain, or sufficient for the stake amount.
5. After that, the UI hides `Approve` and still shows `Stake`, even though the user may still have zero usable mainnet allowance.

The subtler bug is that `hasApproved` is local UI memory, not contract state. A concrete broken sequence:

1. Connect wallet A on mainnet with zero allowance.
2. Click `Approve`.
3. `approve()` resolves after submission, so `hasApproved` becomes `true`.
4. Before the approval is mined, reject/fail the transaction, speed it up with a failing replacement, switch accounts to wallet B, switch chains away and back, change the stake amount above the approved amount, or reload contract/token/spender inputs while the component stays mounted.
5. The widget still shows `Stake` as if approval is available, but the current account/token/spender/amount on mainnet does not have sufficient allowance. The button cannot work.

The widget should render exactly one primary action, chosen from real wallet and chain state in priority order:

1. If no wallet is connected, render `Connect wallet`.
2. If the wallet is connected to anything other than Ethereum mainnet, render `Switch to Ethereum mainnet`.
3. If the user cannot stake because of invalid input, zero balance, insufficient balance, a paused contract, or another known precondition, render the appropriate disabled primary action or error state.
4. Read the ERC-20 allowance from the chain for the current `account`, `token`, `stakingContract/spender`, `chainId`, and required stake amount.
5. If allowance is less than the required stake amount, render `Approve`.
6. While the approval transaction is pending or confirming, render a pending approval state and do not show `Stake` yet.
7. After the approval receipt succeeds, invalidate/refetch the allowance from mainnet.
8. Only when the mainnet allowance read is sufficient should the single primary action be `Stake`.

Approval status must come from onchain allowance reads, not from component state. Component state can track UI progress such as "approval transaction submitted" or "waiting for confirmation", but it must not be treated as proof that staking is allowed.

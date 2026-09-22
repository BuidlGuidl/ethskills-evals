For a user connected on Arbitrum, this widget shows the wrong thing immediately. The app is mainnet-only, but the JSX only gates on `isConnected`, so the user sees both `Approve` and `Stake` even though every real action should first require switching to Ethereum mainnet.

With zero allowance:

1. The user sees `Approve` and `Stake`.
2. If they click `Stake`, the stake transaction is attempted from the connected Arbitrum wallet context. At best the app/wagmi call fails because the chain is unsupported or the contract address does not exist on Arbitrum; at worst it submits to the wrong chain/address configuration. It cannot perform the intended mainnet stake.
3. If they click `Approve`, the approval transaction is sent from Arbitrum as well unless the write is explicitly forced to mainnet and guarded. Even if that transaction is accepted by the wallet, it does not create the required mainnet allowance.
4. After `approve()` returns a transaction hash, the code immediately runs `setHasApproved(true)`. The UI hides `Approve` and leaves `Stake`, even before the approval receipt and before any authoritative allowance refetch. The user is now invited to stake even though the needed mainnet allowance is still zero.

The subtler bug is that `hasApproved` is local component memory, not token allowance. A concrete sequence:

1. User connects on Ethereum mainnet with zero allowance.
2. User clicks `Approve`.
3. The wallet returns/sends the approval transaction, so `setHasApproved(true)` runs.
4. The approval transaction later reverts, is dropped, is replaced, or approves too little for the stake amount. Alternatively, the user changes account, changes stake amount above the approved amount, switches chain, or spends/revokes allowance in another tab.
5. The component still has `hasApproved === true`, so it shows only `Stake`.
6. The displayed `Stake` button cannot work because the actual onchain allowance for the current `account + token + spender + chain + amount` is insufficient.

The widget should render one primary action at a time, in this priority order:

1. If no wallet is connected: render `Connect wallet`.
2. If the connected chain is not Ethereum mainnet: render `Switch to Ethereum mainnet`.
3. If the stake amount is missing, invalid, or above the user's balance: render a disabled primary action with the specific reason nearby.
4. Read the token allowance from Ethereum mainnet for the connected account and staking contract spender. While that read is loading or being refetched after a transaction, render a loading/disabled state.
5. If the fresh allowance is less than the parsed stake amount: render `Approve`.
6. After approval is submitted, keep the approve action pending through transaction confirmation and the allowance refetch. Do not advance to staking from a transaction hash alone.
7. Once the fresh onchain allowance is sufficient: render `Stake`.
8. After staking is submitted, keep `Stake` pending through receipt and any balance/position refetch.

Approval status must come from an onchain allowance read, scoped to the current chain, account, token, spender, and amount. Component state can track pending UI state and recent errors, but it must not be the source of truth for whether staking is allowed.

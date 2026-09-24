# Stake widget review

A user connected on Arbitrum sees both actions at once: **Approve** and **Stake**, because the widget only checks `isConnected`.

With zero allowance:

1. **Stake** is visible even though it cannot succeed. Since the app is mainnet-only, clicking it while the wallet is on Arbitrum either sends the write request against the wrong chain or is rejected by wagmi/wallet chain validation. The user should never have been offered Stake yet.
2. **Approve** is also visible on the wrong network. Clicking it asks for or attempts an approval on Arbitrum, not Ethereum mainnet, unless the write is separately guarded elsewhere. That approval does not make the user approved for the mainnet staking contract.
3. After `approve()` returns, the component immediately runs `setHasApproved(true)`. In wagmi this can happen when the transaction has merely been submitted / a hash has been returned, before it is confirmed and before a fresh allowance read proves the approval exists.
4. The UI then hides **Approve** and leaves **Stake** visible, even though the user may still be on the wrong network, the approval may not be confirmed, and the mainnet allowance may still be zero.

The subtler bug is that `hasApproved` is local UI memory, not contract state. A concrete broken sequence:

1. User connects on Ethereum mainnet with zero allowance.
2. User clicks **Approve** and confirms the wallet transaction.
3. `approve()` returns a transaction hash, so the component sets `hasApproved` to `true`.
4. Before the approval confirms, the transaction fails, is replaced, is dropped, or the user switches account/token/staking amount/chain.
5. The widget now hides **Approve** and shows only **Stake**, but the actual allowance for the current account, token, spender, chain, and amount is still insufficient. The visible button cannot work.

The widget should render exactly one primary action, in this priority order:

1. If no wallet is connected: **Connect Wallet**.
2. Else if the connected chain is not Ethereum mainnet: **Switch to Ethereum Mainnet**.
3. Else read the current allowance from the token contract for the connected account and staking spender on Ethereum mainnet. If the allowance is loading, show a disabled loading action. If allowance is less than the stake amount: **Approve**.
4. Else: **Stake**.

Approval status must come from fresh onchain allowance state, not from `useState(false)` flipped after sending a transaction. The approve button should stay pending until the approval transaction is confirmed, then refetch allowance and only advance to **Stake** once the confirmed allowance is sufficient. The stake button should have its own pending state and should also stay disabled until the stake transaction confirms or fails.

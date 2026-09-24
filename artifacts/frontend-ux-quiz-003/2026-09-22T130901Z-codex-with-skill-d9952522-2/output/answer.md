Connected on Arbitrum with zero allowance, the user sees both `Approve` and `Stake`, because the widget only checks `isConnected`. That is already wrong for a mainnet-only app: the first action should be switching to Ethereum mainnet, not sending token or staking transactions.

If the user clicks `Stake` first, the app attempts the stake transaction while the wallet is still on Arbitrum and while allowance is zero. At best the transaction is rejected or reverts; at worst it is sent to the wrong chain/contract context. The UI offered an action that could not succeed.

If the user clicks `Approve`, `approve()` is awaited only until the wallet/client returns from sending the transaction. In wagmi/viem terms, that is not the same as "the approval is mined and the allowance read now reflects it." The code then immediately runs `setHasApproved(true)`, hiding `Approve` even though the approval may still be pending, may later fail, may be replaced, or may have been sent on Arbitrum instead of mainnet. A later `Stake` click can still fail because the authoritative allowance is not actually present on Ethereum mainnet.

The subtler bug is that `hasApproved` is local component memory, not approval state. A concrete broken sequence:

1. User connects account A on mainnet with zero allowance.
2. User clicks `Approve`.
3. The wallet submits the approval transaction, and `hasApproved` becomes `true`.
4. User switches the connected wallet account to account B, which has zero allowance.
5. The component still has `hasApproved === true`, so it hides `Approve` and shows only `Stake`.
6. Account B clicks `Stake`; the transaction cannot work because account B never approved the staking contract.

The same class of bug appears if the user switches chain, changes token/spender/amount, the approval transaction fails after submission, or the component is showing state from a previous session. Approval is keyed by owner, token, spender, chain, and amount; a boolean in React state captures none of that.

The widget should render one primary action at a time, in this priority order:

1. If no wallet is connected: `Connect wallet`.
2. If connected to the wrong chain: `Switch to Ethereum mainnet`.
3. If the staking amount/input is invalid, the balance is insufficient, or another precondition fails: render the relevant disabled/error state instead of a send button.
4. On Ethereum mainnet, read the ERC-20 allowance for `owner = connected account` and `spender = staking contract` from chain.
5. If the current onchain allowance is less than the amount to stake: `Approve`.
6. After the approval transaction is confirmed, refetch allowance from chain.
7. Only when the fresh onchain allowance is sufficient: `Stake`.

Pending state should stay active from click through receipt and the post-receipt refetch. Approval status must come from an authoritative onchain allowance read, not `useState`, and the read must update when account, chain, token, spender, or amount changes.

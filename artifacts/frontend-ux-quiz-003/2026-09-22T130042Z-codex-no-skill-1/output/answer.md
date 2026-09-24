For a user connected on Arbitrum while the app is mainnet-only, `isConnected` is still `true`, so the widget renders both `Approve` and `Stake` even though the wallet is on the wrong chain.

With zero allowance:

1. The user sees `Approve` and `Stake`.
2. If they click `Stake` first, the app attempts the stake transaction from Arbitrum. Since the app is supposed to stake on mainnet, this cannot satisfy the mainnet staking contract's allowance requirement. Depending on the configured addresses and wallet/client behavior, it either fails because the contract/address is wrong for Arbitrum or sends a transaction to the wrong chain/contract.
3. If they click `Approve`, the app asks for an approval transaction on the currently connected chain: Arbitrum. That approval is not a mainnet approval. Once `approve()` returns, the component immediately calls `setHasApproved(true)`, even though the approval may only be submitted, not confirmed.
4. The widget then hides `Approve` and leaves `Stake`. Clicking `Stake` still cannot perform the intended mainnet stake because the wallet is on Arbitrum and the relevant mainnet allowance is still zero.

The subtler bug is that `hasApproved` is local UI state, not chain/account/token/spender/amount state from the contract. A concrete broken sequence:

1. Connect wallet account A on mainnet with zero allowance.
2. Click `Approve`.
3. `approve()` submits the transaction and the component sets `hasApproved` to `true`.
4. Switch the wallet to account B, which has zero allowance for the staking contract.
5. The component is still mounted, so `hasApproved` remains `true`.
6. The widget now shows only `Stake`, but staking from account B cannot work because account B has not approved the staking contract.

The same class of bug appears if the user switches chain, changes the staking amount above the approved amount, the spender changes, or the approval transaction is still pending or later fails. Approval is not a fact about the React component; it is a fact about `{chainId, owner, token, spender, amount}` onchain.

The widget should render one primary action at a time, with checks in this priority order:

1. If no wallet is connected: render `Connect wallet`.
2. If the wallet is connected to the wrong chain: render `Switch to Ethereum mainnet`.
3. If the staking input is missing or invalid: render a disabled primary action such as `Enter amount`.
4. If the user's token balance is insufficient: render disabled `Insufficient balance`.
5. Read allowance from the token contract on the required chain for the connected account and staking spender.
6. If allowance is less than the required stake amount: render `Approve`.
7. If an approval transaction is pending or waiting for confirmation: render disabled `Approving...` or `Confirming approval...`.
8. Once the onchain allowance read shows enough allowance: render `Stake`.
9. If the stake transaction is pending: render disabled `Staking...`.

Approval status must come from an onchain allowance read, scoped to the required mainnet chain, connected account, token address, spender address, and current stake amount. Local component state may track transaction UI status, such as "approval submitted" or the approval hash, but it must not be the source of truth for whether staking is allowed.

# Stake Widget Review

For a user connected on Arbitrum while the app is mainnet-only, this widget first shows the wrong controls. Because it gates only on `isConnected`, the user sees both the staking UI and, with `hasApproved === false`, an `Approve` button plus a `Stake` button. It does not first ask them to switch to Ethereum mainnet.

With zero allowance, clicking `Approve` sends the approval through the currently connected chain, Arbitrum. That is not useful for a mainnet-only staking flow, and if the token or spender is not deployed at the same address on Arbitrum it may fail outright or approve the wrong contract/token context. The code then sets `hasApproved(true)` as soon as `approve()` resolves, which often means "transaction submitted / hash received", not "approval confirmed and reflected in an allowance read."

Clicking `Stake` while still on Arbitrum attempts to stake on the wrong chain. With zero mainnet allowance, a real mainnet stake would fail anyway. In this UI, the user can also click `Stake` before approving because the stake button is rendered unconditionally whenever the wallet is connected.

The subtler bug is that `hasApproved` is local component memory, not approval state. A concrete broken sequence:

1. User connects on Ethereum mainnet with zero allowance.
2. User clicks `Approve`.
3. The wallet returns a transaction hash, `approve()` resolves, and the component sets `hasApproved` to `true`.
4. Before the approval is confirmed, the user clicks `Stake`, or the approval transaction later reverts or is replaced/dropped.
5. The widget hides `Approve` and shows only `Stake`, but `Stake` cannot work because the actual onchain allowance is still zero.

The same class of stale state can happen after an account change, token amount change, spender change, chain switch, page remount behavior, or after the user later reduces/revokes allowance in another app. A component boolean cannot represent ERC-20 allowance.

The widget should implement one primary action at a time, in this priority order:

1. If no wallet is connected, render `Connect wallet`.
2. If the connected chain is not Ethereum mainnet, render `Switch to Ethereum`.
3. If the form/input is invalid, render a disabled primary action with the specific validation problem nearby.
4. Read the user's token balance and allowance on Ethereum mainnet for the connected account, token, spender, and current stake amount.
5. If balance is insufficient, render disabled `Insufficient balance`.
6. If allowance is less than the required stake amount, render `Approve`.
7. After approval is submitted, keep `Approve` pending until the receipt is confirmed and the allowance query has been invalidated/refetched.
8. Once the fresh onchain allowance is sufficient, render `Stake`.
9. After staking is submitted, keep `Stake` pending until the receipt is confirmed and the relevant balances/position/allowance reads have been refetched.

Approval status must come from an authoritative onchain `allowance(owner, spender)` read for the active account, target chain, token, spender, and amount. Local state may track UI pending/error state for the current transaction, but it must not decide whether the user is approved.

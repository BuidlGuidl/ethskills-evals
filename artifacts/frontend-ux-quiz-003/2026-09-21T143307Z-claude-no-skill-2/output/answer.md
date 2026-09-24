# Review: stake widget

Verdict: **request changes**. The widget only checks "is a wallet connected". It ignores which chain the wallet is on, and it stores approval as a local guess instead of reading it from the chain.

---

## 1. User on Arbitrum, zero allowance

**What they see:** `isConnected` is true, so they get **Approve** and **Stake** side by side. Nothing says they're on the wrong network, and nothing says which button comes first. Both buttons look equally clickable.

**Click Approve:**
- The widget never checks `chainId`. What happens next depends on how `approve` calls `writeContract`:
  - **No `chainId` pinned:** wagmi uses the wallet's current chain, so the wallet asks the user to sign `approve` **on Arbitrum**, sent to the *mainnet* token address. That address is either empty on Arbitrum (the call "succeeds" and does nothing, so gas is wasted) or holds some unrelated contract. Mainnet allowance stays 0.
  - **`chainId: mainnet.id` pinned (or Arbitrum missing from the wagmi config):** wagmi throws, e.g. `ChainNotConfiguredError` or `ConnectorChainMismatchError`. `await approve()` rejects inside an `onClick` with no `try/catch`. The result is an unhandled promise rejection, no message shown, and a button that seems to do nothing.
- There's no pending state, so the user can click again and fire duplicate prompts.
- `setHasApproved(true)` runs as soon as `approve()` resolves. With `writeContractAsync` that happens when the tx is **submitted** (it returns the hash), not when it's mined or succeeds. In the first case above, Approve disappears even though mainnet approval never happened.

**Click Stake:**
- On Arbitrum, the same thing happens: an error with no message, or a tx sent to the wrong contract on the wrong chain.
- Even on mainnet with allowance 0, `transferFrom` reverts. Best case: the simulation fails and the error is swallowed. Worst case: the wallet shows a "likely to fail" warning, the user sends it anyway, and pays gas for a revert.
- Stake shows up **before** approval and **alongside** Approve. The widget is inviting the user to fail.

## 2. The subtler bug: `hasApproved` goes stale

`hasApproved` is a guess stored in component state. It's set once, it doesn't depend on which account, chain, amount or spender is involved, and nothing ever sets it back to false. Anything that changes the real allowance on-chain leaves it wrong. Once it's true, the Approve button is gone for good (until a reload), so only a broken **Stake** remains.

**Concrete sequence (account switch):**
1. Connect account **A** on mainnet. Click Approve, confirm, and the tx mines. `hasApproved = true`. The widget shows only Stake.
2. In MetaMask, switch to account **B**. B has never approved anything.
3. wagmi stays connected. `isConnected` is still true and the component doesn't remount, so `hasApproved` is still `true`.
4. B sees **only "Stake"**. B's allowance is 0, so every Stake click reverts, and B has no Approve button. The only way out is reloading the page.

Other sequences that end the same way:
- **Dropped or replaced tx:** click Approve, sign it, and `writeContractAsync` returns the hash, so `hasApproved = true`. Then the user cancels or speeds up the tx in the wallet (a 0-ETH self-send with the same nonce), or it gets dropped. Allowance is 0, and only Stake is shown.
- **Approve reverted:** the tx mines with `status: 'reverted'` (paused token, bad args). The flag was already set when the tx was sent.
- **Wrong chain:** approve on Arbitrum (section 1), then switch to mainnet. Only Stake is shown, and mainnet allowance is 0.
- **Allowance used up:** approve exactly 100, stake 100, and allowance goes back to 0. Stake 50 more, and it reverts with no Approve button.
- **Amount raised:** approve 100, then type 500 into the input. Allowance is less than the amount.
- **Revoked elsewhere:** the user revokes the approval on revoke.cash in another tab.

## 3. The flow this widget should implement

**Render exactly one primary button at a time**, chosen by the first rule that matches, checked in this order:

| # | Condition | Primary action |
|---|-----------|----------------|
| 1 | `!isConnected` | **Connect Wallet** |
| 2 | `chainId !== mainnet.id` (from `useAccount()`) | **Switch to Ethereum** (`useSwitchChain`) |
| 3 | amount empty / 0 / unparseable | disabled **Enter amount** |
| 4 | `amount > balance` | disabled **Insufficient balance** |
| 5 | allowance or balance still loading | disabled / loading |
| 6 | approve tx pending (hash set, receipt not yet received) | disabled **Approving…** |
| 7 | `allowance < amount` | **Approve** |
| 8 | stake tx pending | disabled **Staking…** |
| 9 | otherwise | **Stake** |

Why this order: each check depends on the ones above it. Chain only matters once a wallet is connected. Allowance only means something on the right chain for the right account. "Enough allowance?" needs a valid amount. Stake is last because it needs everything else to pass.

**Where approval status comes from: the chain only, never local state.**

```ts
const { address, chainId, isConnected } = useAccount();
const { data: allowance, refetch } = useReadContract({
  address: TOKEN, abi: erc20Abi, functionName: 'allowance',
  args: [address!, STAKING], chainId: mainnet.id,
  query: { enabled: !!address },
});
const needsApproval = allowance === undefined || allowance < parsedAmount;
```

- The query key includes `address` and `chainId`, so switching account or chain refetches automatically. That fixes the stale-flag bug.
- Compare `allowance >= amount` as a **bigint**. Don't store a boolean.
- After Approve: take the hash, then wait with `useWaitForTransactionReceipt({ hash })`. Check `receipt.status === 'success'`, then call `refetch()` on the allowance. The Stake button appears because the **re-read allowance** is high enough, not because a tx was sent. If the tx reverts or the user rejects it, show the error and leave Approve visible.
- After Stake is mined, refetch allowance and balance too, since the stake uses up allowance.
- Pass `chainId: mainnet.id` to every `writeContract` so nothing can be signed on the wrong chain, even if the UI is out of date.
- Catch every write error, show it to the user, and treat user rejection as a quiet cancel. Disable the button while a write or receipt is pending.
- The "saved RPC call" costs one cheap `eth_call`. It isn't worth all the bugs above.

# Review: stake widget

Verdict: **request changes.** The widget checks "is a wallet connected" when it needs to check "can this action work right now". It also keeps a local flag (`hasApproved`) in place of the real allowance stored onchain.

---

## 1. User on Arbitrum, zero allowance

**What they see:** `isConnected` is true, so **both** buttons show together: **Approve** and **Stake**. Nothing says the wallet is on the wrong network, nothing says which button comes first, and there's no amount/balance context. Two buttons that look equally important means the user has to guess.

**Click Approve:**
- If `approve()` doesn't pin `chainId: mainnet.id`, the wallet asks the user to sign an `approve` **on Arbitrum**. The mainnet token address on Arbitrum is some other contract or no contract at all. Best case, the user pays Arbitrum gas for an approval that does nothing on mainnet. Worst case, they approve some unrelated contract that happens to live at that address.
- If `chainId` is pinned, wagmi throws a chain-mismatch error or pops up an unexpected switch prompt. Nothing catches it: `await approve()` rejects inside an inline `async` handler, which gives an unhandled promise rejection and no message to the user. The same thing happens when the user just rejects in the wallet: nothing is shown and the button just sits there.
- On success, `setHasApproved(true)` runs as soon as the wallet returns the **tx hash** (`writeContractAsync` resolves on submit, not on confirmation). So Approve disappears before anything is mined, and on the wrong chain it disappears even though the mainnet allowance is still 0.

**Click Stake (any time, even before Approve):**
- On Arbitrum: same wrong-chain problem. Either the tx goes to the wrong network or a mismatch error is thrown and not caught.
- On mainnet with zero allowance: `transferFrom` inside the staking contract reverts. Usually gas estimation fails and the user sees a raw wallet error like "execution reverted: ERC20: insufficient allowance", or no message at all. If the wallet lets them send anyway, they pay gas for a failed tx.

Also missing: no pending state (you can double-click and submit twice), no human-readable errors, no amount input or decimals handling shown.

---

## 2. The subtler bug: `hasApproved` goes stale

`hasApproved` is a one-way local flag. It only ever goes `false → true`, it lives as long as the component stays mounted, and it isn't tied to the account, token, spender, amount or chain. The allowance onchain changes in many ways the flag never sees.

**Concrete sequence (exact-amount approval, the common case):**
1. User is on mainnet, allowance 0. Enters 100 and clicks **Approve**, which approves exactly 100. The tx hash comes back, so `hasApproved = true` and the Approve button disappears.
2. Clicks **Stake** for 100. It succeeds. `transferFrom` uses up the allowance, which is now **0**.
3. Enters another 50 and wants to stake more. The widget shows **only Stake**, because `hasApproved` is still `true`. Stake reverts every time (insufficient allowance), and the user has **no way to approve** without reloading the page.

Other sequences that reach the same broken state (only Stake shown, and it can't work):
- **Approval never lands:** click Approve, hash comes back, flag set. Then the tx reverts, gets dropped, or the user "cancels" it in the wallet by replacing it. Allowance is still 0, and Approve is gone for good.
- **Stake before the approval is mined:** the flag flips on submit, so the user clicks Stake right away and it reverts while the approve tx is still pending.
- **Account switch:** approve with account A, then switch to account B in the wallet. The component stays mounted, so B sees only Stake with zero allowance.
- **Amount goes up:** approve 100, then type 500. The allowance isn't enough, but no Approve button shows.
- **Revoked elsewhere:** the user revokes in revoke.cash or another tab, and the flag still says approved.

Saving one RPC read costs a dead end in the UI. The allowance read is cheap and it's the only source you can trust.

---

## 3. The flow the widget should implement

Render **exactly one primary button**, picked by these checks **in this order**. The first check that matches wins, and nothing after it renders:

| # | Check | Primary button |
|---|-------|----------------|
| 1 | `!isConnected` | **Connect wallet** |
| 2 | `chainId !== mainnet.id` (from `useAccount().chainId`) | **Switch to Ethereum** (`useSwitchChain({ chainId: mainnet.id })`). No Approve or Stake. |
| 3 | Amount empty / zero / can't be parsed | Disabled: **Enter an amount** |
| 4 | Balance or allowance still loading | Disabled: **Loading…** |
| 5 | `parseUnits(amount, decimals) > balance` | Disabled: **Insufficient balance** |
| 6 | `allowance < parseUnits(amount, decimals)` | **Approve** |
| 7 | otherwise | **Stake** |

**Where approval status comes from:** a fresh **onchain read**, never local state:

```ts
const { data: allowance, refetch: refetchAllowance } = useReadContract({
  address: TOKEN,
  abi: erc20Abi,
  functionName: 'allowance',
  args: address ? [address, STAKING] : undefined,
  chainId: mainnet.id,
  query: { enabled: !!address },
});
const needsApproval = allowance === undefined || allowance < parsedAmount;
```

- Key the read on `address` + spender + `chainId: mainnet.id`, so switching account or chain refetches it automatically.
- Compare against the **amount being staked**, in the token's real decimals (`parseUnits` with the token's `decimals`, e.g. 6 for USDC). A plain yes/no "approved" isn't enough.
- **After Approve:** wait for the receipt (`waitForTransactionReceipt` / `useWaitForTransactionReceipt`), then `await refetchAllowance()`. The button changes to Stake only because the refetched allowance is now enough, not because a tx was sent.
- **After Stake:** wait for the receipt, then refetch allowance **and** balances. An exact approval that got used up then sends the user back to step 6 on its own.

**Around each action:**
- Keep one pending state per button, held from click through receipt **and** the refetch. Clear it in `finally` so a wallet rejection can't leave the button stuck. Disable the button while pending, which also stops double-submits.
- Pass `chainId: mainnet.id` on every write.
- Catch errors and show plain-language text next to the button, e.g. "Transaction rejected in wallet" or "Approval failed, try again". No unhandled rejections or raw revert strings.

Shape of the fix:

```tsx
if (!isConnected) return <ConnectButton />;
if (chainId !== mainnet.id) return <button onClick={() => switchChain({ chainId: mainnet.id })}>Switch to Ethereum</button>;
if (!parsedAmount) return <button disabled>Enter an amount</button>;
if (balance === undefined || allowance === undefined) return <button disabled>Loading…</button>;
if (parsedAmount > balance) return <button disabled>Insufficient balance</button>;
if (allowance < parsedAmount) return <button disabled={approving} onClick={onApprove}>{approving ? 'Approving…' : 'Approve'}</button>;
return <button disabled={staking} onClick={onStake}>{staking ? 'Staking…' : 'Stake'}</button>;
```

Delete `hasApproved` entirely.

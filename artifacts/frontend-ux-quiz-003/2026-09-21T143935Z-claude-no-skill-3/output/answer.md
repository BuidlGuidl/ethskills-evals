# Review: stake widget

**Verdict: request changes.** The widget decides what to show from `isConnected` and a local `hasApproved` flag. Neither tells you whether the action can succeed. Two things decide that: the chain the wallet is on, and the allowance recorded on-chain. The widget checks neither.

---

## 1. User on Arbitrum, zero allowance

**What they see:** `isConnected` is true, so both **Approve** and **Stake** appear, both enabled. Nothing says "wrong network", nothing marks one step as first, and there's no amount, balance or status shown.

**Click Approve.** The result depends on how `approve` is written:
- **The call passes `chainId: mainnet.id`** (the right way): wagmi throws a chain-mismatch error. The `async` handler doesn't catch it, so the promise rejects with nothing handling it. The user sees nothing: no message, no prompt to switch. `hasApproved` stays false and they can keep clicking with no effect.
- **The call leaves out `chainId`**: the transaction goes to whatever chain the wallet is on. The wallet asks the user to sign an `approve` **on Arbitrum**, sent to the *mainnet* token address. That address is either unrelated code or no code at all, and a call to an address with no code *succeeds*. The user pays gas for nothing. `await` resolves, `hasApproved = true`, the Approve button disappears, and the user thinks they have approved. Mainnet allowance is still 0.
- **`approve` is the fire-and-forget `writeContract`** (not `writeContractAsync`): it returns `undefined` right away. `setHasApproved(true)` runs **before the user even sees the wallet popup**. If they then reject in the wallet, Approve is already gone.

**Click Stake.** Same chain problem: either a silent unhandled error or a transaction sent on Arbitrum. Even if the chain were right, allowance is 0, so the staking contract's `transferFrom` reverts. Best case, the wallet shows "this transaction will likely fail". Worst case, the user signs anyway and pays gas for a reverted transaction. The widget gives no feedback either way.

So a user on the wrong chain gets two buttons that look ready and can't work, and one of them may cost gas and falsely show success.

---

## 2. The subtler bug: `hasApproved` goes stale

`hasApproved` means "an approve transaction was *sent* from this mounted component at some point". It's used as if it meant "the connected account's current mainnet allowance covers the amount being staked". Those two drift apart, and once the flag is `true` the Approve button can't come back without a page reload (or an unmount).

**Concrete sequence (exact-amount approval, the common default):**
1. Connect account A on mainnet. Allowance is 0.
2. Enter 100 and click **Approve**. The wallet asks to approve 100, the user signs, a hash comes back, and `hasApproved = true`. Approve disappears.
3. Click **Stake** (100). The transaction succeeds, and `transferFrom` uses up the allowance. **Allowance is 0 again.**
4. Enter 50 and click **Stake**. It reverts because the allowance is too low. The widget shows **only Stake**, which can't work, and there's no Approve button to fix it.

**Other sequences that reach the same broken state:**
- **Switch account:** after step 2, switch the wallet to account B (the component stays mounted). B has 0 allowance, but `hasApproved` is still true, so only Stake shows.
- **Approve never lands:** after step 2, the approve transaction is dropped, replaced ("cancel" or "speed up" in the wallet), or reverts. `await` resolved on the *hash*, not the receipt, so the flag was set anyway. Allowance is 0 and only Stake shows.
- **Stake right after signing:** the user clicks Stake before the approve is mined. Only the hash was awaited, so the stake reverts or fails gas estimation.
- **Larger amount:** approve 100, then try to stake 500. The flag knows nothing about amounts.
- **Revoked elsewhere:** the user revokes the approval in another tab (for example revoke.cash). The flag doesn't know.
- **Wrong-chain case from §1:** the flag was set after a meaningless approve on Arbitrum. After switching to mainnet, only Stake shows and allowance is 0.

The opposite also happens: a user who approved *earlier* (another session, or unlimited approval) sees Approve every time they load the page, and is pushed into an unnecessary, gas-costing second approval.

"Saving an RPC call" isn't worth it: the widget ends up showing buttons that don't match the actual on-chain allowance.

---

## 3. The flow the widget should implement

**One main button, picked by checks that run in a fixed order. The first check that matches decides the button.** Never show Approve and Stake as two equal-weight buttons at once.

| # | Check | Button that shows |
|---|-------|---------------------|
| 1 | `!isConnected` | **Connect Wallet** |
| 2 | `chainId !== mainnet.id` | **Switch to Ethereum** (`switchChain({ chainId: mainnet.id })`) |
| 3 | amount empty or 0 / can't be parsed | disabled: **Enter amount** |
| 4 | `amount > balance` | disabled: **Insufficient balance** |
| 5 | allowance still loading (or read failed) | disabled: **Checking allowance…** (or error + retry). Never guess. |
| 6 | approve transaction pending (waiting for signature or receipt) | disabled: **Approving…** (with a link to the transaction) |
| 7 | `allowance < amount` | **Approve** |
| 8 | stake transaction pending | disabled: **Staking…** |
| 9 | otherwise | **Stake** |

Why this order: each step assumes the ones before it passed. Allowance only means something for a known account on the right chain. Whether it's "enough" only means something once you have a valid amount. Pending states come before the action buttons so nobody can click twice.

**Where approval status must come from:** the chain, never component state.
- Read it with `useReadContract({ address: TOKEN, abi: erc20Abi, functionName: 'allowance', args: [address, STAKING], chainId: mainnet.id, query: { enabled: !!address } })`.
- Because `address` and `chainId` are in the query key, switching account or chain re-reads it on its own.
- Compare `allowance >= parsedAmount`, not "approved yes/no".
- After the approve transaction, wait with `useWaitForTransactionReceipt({ hash, chainId: mainnet.id })`. Only when `receipt.status === 'success'`, call `refetch()` on the allowance, and let the refetched value move the button to Stake. Don't use the hash or the promise resolving for this.
- Refetch the allowance (and balance) after the stake receipt too, since staking uses up allowance.
- Optionally refetch on window focus or every block, to catch revokes done elsewhere.

**Other requirements:**
- Pass `chainId: mainnet.id` to every `writeContract` / `writeContractAsync`, so the calls fail safely if the chain check is ever bypassed.
- Use `writeContractAsync` (or the hook's `data` / `isPending`), never fire-and-forget followed by state changes.
- Catch errors and show them in the widget. A user rejecting in the wallet is a normal case: quietly go back to the Approve / Stake button.
- Disable the button while a signature or transaction is pending.
- Show amount, balance and current allowance so the user understands why Approve is showing.
- Approval amount: default to exactly the amount being staked, with unlimited as an explicit opt-in. Some tokens (for example USDT) only accept a change from a nonzero allowance after it's first set to 0; handle that if the token is one of them.

**Sketch:**

```tsx
const { address, isConnected, chainId } = useAccount();
const { switchChain } = useSwitchChain();
const amt = safeParse(input, decimals);                    // bigint | undefined

const { data: allowance, isLoading, refetch } = useReadContract({
  address: TOKEN, abi: erc20Abi, functionName: 'allowance',
  args: address && [address, STAKING], chainId: mainnet.id,
  query: { enabled: !!address },
});

const approveTx = useWriteContract();
const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data, chainId: mainnet.id });
useEffect(() => { if (approveRcpt.data?.status === 'success') refetch(); }, [approveRcpt.data]);
// same pattern for stakeTx → refetch allowance + balance

if (!isConnected)                     return <Btn onClick={openConnect}>Connect Wallet</Btn>;
if (chainId !== mainnet.id)           return <Btn onClick={() => switchChain({ chainId: mainnet.id })}>Switch to Ethereum</Btn>;
if (!amt)                             return <Btn disabled>Enter amount</Btn>;
if (balance !== undefined && amt > balance) return <Btn disabled>Insufficient balance</Btn>;
if (isLoading || allowance === undefined)   return <Btn disabled>Checking allowance…</Btn>;
if (approveTx.isPending || approveRcpt.isLoading) return <Btn disabled>Approving…</Btn>;
if (allowance < amt)                  return <Btn onClick={() => approveTx.writeContract({ address: TOKEN, abi: erc20Abi, functionName: 'approve', args: [STAKING, amt], chainId: mainnet.id })}>Approve</Btn>;
if (stakeTx.isPending || stakeRcpt.isLoading) return <Btn disabled>Staking…</Btn>;
return <Btn onClick={() => stakeTx.writeContract({ ...stakeCall, args: [amt], chainId: mainnet.id })}>Stake</Btn>;
```

In the sketch, `balance` means the connected account's mainnet token balance, which also needs to be read from the chain.

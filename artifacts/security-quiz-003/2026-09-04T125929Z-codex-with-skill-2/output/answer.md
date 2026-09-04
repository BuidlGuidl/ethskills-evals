The missing `25,000 TKN` was not stolen by the pool. It was taken by `TKN` itself during deposits because `TKN` is a fee-on-transfer token.

The evidence is the user who unstaked `10,000` and received `9,800`. That is a `2%` transfer fee. The same thing must also be happening on `transferFrom` during `stake()`.

So the pool's accounting is:

- On stake, it credits `stakedBalance[user] += amount`
- But the pool only receives `amount * 98%`

That means every deposit overstates liabilities by `2%`.

The arithmetic closes exactly:

- Cumulative requested stakes: `1,250,000`
- Actual tokens received by the pool at `98%`: `1,225,000`
- Cumulative unstake calls: `250,000`
- Actual pool balance after paying those unstakes: `1,225,000 - 250,000 = 975,000`

That matches the observed on-chain balance exactly.

Meanwhile the contract's internal books say:

- Total current `stakedBalance`: `1,000,000`

But the pool only has:

- Actual `TKN` balance: `975,000`

So the aggregate over-credit is:

- `1,000,000 - 975,000 = 25,000`

That `25,000` is the sum of the `2%` fees taken from all historical deposits:

- `1,250,000 * 2% = 25,000`

Why the shortfall grows:

- Every new stake increases internal liabilities by the full requested `amount`
- But assets increase only by the net amount actually received
- Therefore each new deposit increases insolvency by the transfer fee on that deposit

In other words, later stakers are subsidizing earlier unstakers until the pool runs out of real tokens. Early unstakers succeeded because the pool still had enough balance. Newer unstake attempts now revert because the mapping promises more `TKN` than the contract actually holds.

The accounting fix is to credit the user only for what the pool actually receives, not for what the user requested to transfer. In practice:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;
    stakedBalance[msg.sender] += received;
}
```

Use `SafeERC20.safeTransferFrom`/`safeTransfer` in production, but the important accounting change is `received`, not `amount`.

You could also choose to reject fee-on-transfer tokens by requiring `received == amount`, but if the pool is meant to support this token, then crediting `received` is the correct fix.

What happens to the stakers who currently cannot unstake:

- This code change fixes future accounting only
- It does not restore the already-missing `25,000 TKN`
- The pool is already insolvent relative to the recorded balances

So those users have only two possible outcomes:

1. The pool is recapitalized with `25,000 TKN`, so the old overstated balances can be honored.
2. The existing balances are reconciled downward to the amounts actually received by the pool from each user's deposits, so total claims match the `975,000 TKN` the pool really has.

Without one of those two actions, some current stakers must remain unpaid, because the contract owes `1,000,000` on paper but only owns `975,000`.

One more subtle point: if `TKN` also charges its `2%` fee on outgoing `transfer()` calls, then even after fixing deposit accounting, an unstaker's wallet will still receive less than the amount debited from `stakedBalance`. That no longer breaks the pool's books, but it does mean the token itself imposes an exit fee on users.

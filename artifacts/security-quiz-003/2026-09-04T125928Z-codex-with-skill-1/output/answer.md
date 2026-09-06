The missing `25,000 TKN` was not lost inside the pool contract. It was taken by the token itself during transfers.

The evidence is the user who staked `10,000 TKN` and later unstaked `10,000 TKN` but only received `9,800 TKN`. That is a `2%` transfer fee. So `TKN` is a fee-on-transfer token.

## Where the `25,000 TKN` went

`stake(amount)` credits the user with `amount`, but the pool does **not** actually receive `amount`.

For cumulative staking:

- Requested deposits: `1,250,000 TKN`
- `2%` transfer fee on deposit: `25,000 TKN`
- Tokens actually received by the pool: `1,225,000 TKN`

So the pool liabilities were recorded as `1,250,000`, while assets only increased by `1,225,000`.

That is the entire accounting hole:

- Recorded net stake after withdrawals: `1,000,000 TKN`
- Actual pool balance: `975,000 TKN`
- Shortfall: `25,000 TKN`

`1,225,000 - 250,000 = 975,000`, which matches the observed contract balance exactly.

So the missing `25,000 TKN` is the cumulative `2%` fee charged on deposits.

## Why the shortfall grows

Each new deposit makes the pool more insolvent.

For a deposit of `X`:

- pool credits `stakedBalance[user] += X`
- pool only receives `0.98X`

So every deposit increases the deficit by `0.02X`.

Example:

- user stakes `10,000`
- pool receives `9,800`
- internal accounting says user owns `10,000`
- deficit grows by `200`

That is why the books do not close and why unstaking starts failing only later. Early unstakers were paid from the real tokens deposited by everyone else. As the cumulative over-crediting grows, eventually the contract balance is no longer enough to satisfy the nominal `stakedBalance` totals, and `token.transfer` reverts with insufficient balance.

## Why the user only received `9,800 TKN` on unstake

The outbound transfer is also taxed.

When the pool executes `token.transfer(user, 10_000)`, the pool balance decreases by `10,000`, but the user receives only `9,800`, with `200` taken by the token fee logic.

So the contract has two separate problems with this token:

1. On deposit, it over-credits users because it records the requested amount instead of the amount actually received.
2. On withdrawal, users receive less than the nominal unstake amount because the token taxes the outgoing transfer too.

## Change that makes the accounting correct

The pool must account by actual balance delta, not by the requested transfer amount.

Conceptually:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;
    stakedBalance[msg.sender] += received;
}
```

In production this should use `SafeERC20.safeTransferFrom`, but the key fix is: **credit only what the pool actually received**.

An equally valid stricter approach is to revert unless `received == amount`, which simply rejects fee-on-transfer tokens.

For `unstake`, the pool can only send tokens it actually has. With a fee-on-transfer token, `token.transfer(user, amount)` still means the user may receive less than `amount` net, but the pool accounting remains correct because the pool balance falls by `amount` and the user balance is reduced by `amount`.

## What happens to the stakers who cannot currently unstake

They cannot all be paid their current recorded balances, because those balances are overstated by `25,000 TKN` in aggregate.

The pool is already insolvent:

- liabilities: `1,000,000 TKN`
- assets: `975,000 TKN`

So before reopening withdrawals fairly, the existing balances must be reconciled downward to the real asset base. If all current balances are adjusted pro rata, the reduction factor is:

`975,000 / 1,000,000 = 97.5%`

So each current staker’s claim must be reduced by `2.5%` to make total liabilities equal total assets.

After that reconciliation:

- total staked balances sum to `975,000`
- the pool can satisfy all current claims again

But because `TKN` also taxes outbound transfers, a user who unstakes their reconciled balance will still receive only `98%` of what the pool sends. For example, after a `2.5%` reconciliation, a displayed balance of `9,750` unstaked in full would deliver `9,555` to the wallet if the token continues charging `2%` on transfer out.

## Bottom line

The missing `25,000 TKN` is the cumulative `2%` transfer tax on deposits. The shortfall grows because every deposit credits more stake than the pool actually receives. The fix is to credit deposits by actual tokens received, or reject fee-on-transfer tokens entirely. Existing stakers must absorb the already-created `25,000 TKN` hole, because those tokens are no longer in the pool and cannot be paid out.

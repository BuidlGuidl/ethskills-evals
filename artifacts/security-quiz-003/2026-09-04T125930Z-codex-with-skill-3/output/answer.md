The pool is accounting for the **requested transfer amount**, not the **tokens actually received**. That only breaks this badly if `TKN` is a fee-on-transfer token.

The user example gives the fee rate away:

- user stakes `10,000`
- UI credits `10,000`
- on full unstake, wallet receives `9,800`

That is a `2%` transfer tax on the outbound transfer. The pool data shows the same thing happened on deposits too.

## Where the missing 25,000 TKN went

Cumulative stakes are recorded as `1,250,000 TKN`, but if `TKN` charges `2%` on `transferFrom`, the pool actually received only:

`1,250,000 * 98% = 1,225,000 TKN`

So `25,000 TKN` never reached the pool. It was taken by the token itself on stake transfers, likely burned or redirected by the token's fee logic.

The pool still credited stakers with the full `1,250,000`, because it does:

```solidity
token.transferFrom(msg.sender, address(this), amount);
stakedBalance[msg.sender] += amount;
```

That creates an immediate accounting hole of `25,000 TKN`.

## Why the numbers reconcile exactly

Recorded activity:

- total staked: `1,250,000`
- total unstaked: `250,000`
- therefore recorded live balances: `1,000,000`

Real assets:

- actual tokens received from all stakes: `1,225,000`
- pool sent out `250,000` on unstakes
- remaining balance: `975,000`

So:

`1,225,000 - 250,000 = 975,000`

and

`1,000,000 - 975,000 = 25,000`

That missing `25,000` is the sum of the inbound transfer fees that were never accounted for.

## Why the shortfall grows

Each new stake makes the pool more insolvent.

For a stake of `amount`, if the token takes `2%`, the pool receives only `0.98 * amount` but credits `amount`. So every deposit increases the deficit by:

`amount - actualReceived`

At `2%`, a `100,000 TKN` stake grows the hole by `2,000 TKN`.

Early unstakers succeeded because the pool still had enough real tokens from later depositors to pay them. Late unstakers are reverting because the internal ledger promises more tokens than the contract actually holds.

## Why the example user lost money both ways

For a `10,000 TKN` stake:

- the pool likely received only `9,800`
- but credited the user `10,000`

When that user later unstaked `10,000`, the pool sent `10,000`, and the token again taxed the transfer, so the wallet received `9,800`.

So that user was taxed on the way in and on the way out. The pool hid the inbound tax in its broken accounting, then exposed the outbound tax when the user withdrew.

## Correct change

The fix is to credit deposits by the contract's balance delta, not by the requested amount:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;
    stakedBalance[msg.sender] += received;
}
```

Using `SafeERC20.safeTransferFrom` is preferable, but the key accounting fix is: **credit `received`, not `amount`**.

Equivalent safe design: revert unless `received == amount`, which simply rejects fee-on-transfer tokens.

## What happens to the stakers who cannot currently unstake

The fix prevents **new** bad accounting, but it does not repair the existing insolvency.

Right now the pool owes `1,000,000 TKN` by its internal ledger and only has `975,000 TKN`. That means current stakers as a group are undercollateralized by `25,000 TKN`.

So one of these must happen:

- someone recapitalizes the pool with `25,000 TKN`, after which all current recorded balances can be honored; or
- the pool writes balances down to the assets actually present, which means current stakers absorb the `25,000 TKN` loss pro rata.

Without recapitalization, the users currently reverting cannot all be paid their recorded balances in full, because those tokens are not in the contract and never were.

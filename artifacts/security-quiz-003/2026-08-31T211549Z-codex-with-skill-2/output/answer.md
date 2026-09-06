The missing `25,000 TKN` was lost on **stake deposits**, not on withdrawals.

## What happened

The pool assumes that if a user calls `stake(amount)`, then the pool receives exactly `amount` tokens:

```solidity
token.transferFrom(msg.sender, address(this), amount);
stakedBalance[msg.sender] += amount;
```

That assumption is false for a fee-on-transfer token.

The user example proves `TKN` charges a 2% transfer fee:

- user unstaked `10,000`
- pool sent `10,000`
- wallet received `9,800`

So when someone stakes `10,000`, the same thing happens in reverse:

- user sends `10,000`
- pool receives only `9,800`
- contract still credits `stakedBalance[user] += 10,000`

That creates an immediate `200 TKN` accounting hole.

## Why the numbers match exactly

Cumulative stake calls: `1,250,000 TKN`

If `TKN` takes 2% on each inbound transfer, the pool actually received:

`1,250,000 * 98% = 1,225,000 TKN`

But the contract credited users for the full `1,250,000 TKN`.

So the books were overstated by:

`1,250,000 - 1,225,000 = 25,000 TKN`

That is exactly the observed shortfall:

- recorded current stakes: `1,000,000 TKN`
- actual pool balance: `975,000 TKN`
- deficit: `25,000 TKN`

The withdrawal side explains the user complaint, but not the `25,000` mismatch:

- when the pool transfers `amount` out, its balance drops by `amount`
- the user receives less because the token taxes the transfer

So withdrawals are painful for users, but they do **not** create this specific asset-vs-liability gap. The gap was created when deposits were credited at gross amount instead of net received.

## Why the shortfall grows

It grows on every new stake.

Each time a user stakes:

- pool assets increase by the **net received**
- pool liabilities increase by the **gross requested amount**

So liabilities outrun assets by 2% of every deposit forever. Early unstakers succeed because there is still enough real token balance in the contract. Later unstakers revert because earlier withdrawals consumed the real tokens while the remaining users still hold overstated balances on paper.

This is why “the books do not close.”

## Correct fix

The accounting must use the **actual balance delta**, not the requested `amount`.

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;

    stakedBalance[msg.sender] += received;
}
```

Using `SafeERC20` is also advisable, but the key fix is: **credit only what the contract actually received**.

If the token is also fee-on-transfer on withdrawals, then a user who unstakes `X` will still only receive the token’s net-after-fee amount in their wallet. That is a token property, not a pool accounting error, as long as the pool reduces balances by what leaves the pool.

## What happens to users who currently cannot unstake

Changing the code fixes future accounting, but it does **not** repair the existing `25,000 TKN` hole.

Right now, current stakers are collectively owed `1,000,000 TKN` by the contract’s internal ledger, but the pool only holds `975,000 TKN`. So some users are already undercollateralized.

That means one of these must happen:

1. The operator recapitalizes the pool with `25,000 TKN`, letting current recorded balances be honored in full.
2. The recorded balances are written down to match reality, which socializes the loss across current stakers.

Without adding `25,000 TKN`, it is mathematically impossible for every current staker to withdraw their recorded balance, because those tokens were never in the pool in the first place.

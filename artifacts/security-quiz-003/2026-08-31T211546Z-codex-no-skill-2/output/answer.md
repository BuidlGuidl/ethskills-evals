The missing `25,000 TKN` is the transfer fee taken by `TKN` on deposits.

The giveaway is the user who staked `10,000` and later unstaked `10,000` but
only received `9,800`. That is a `2%` fee-on-transfer token:

- on stake: user sends `10,000`, pool receives `9,800`
- on unstake: pool sends `10,000`, user receives `9,800`

The pool code assumes `amount` is what moved, but with a fee-on-transfer token
that is false.

## Where the `25,000 TKN` went

Total stake calls since launch: `1,250,000 TKN`

If the token charges `2%` on transfer, the pool actually received:

`1,250,000 * 98% = 1,225,000 TKN`

So `25,000 TKN` never reached the pool at all. It was taken by the token during
`transferFrom`. Depending on the token implementation, that fee was burned or
sent to the token's fee collector, but in any case it is not in the pool.

That matches the observed balance exactly:

- actual received from all stakes: `1,225,000`
- actual sent out by the pool in unstake calls: `250,000`
- remaining in pool: `1,225,000 - 250,000 = 975,000`

So the pool balance of `975,000 TKN` is internally consistent. The bad number is
the accounting entry `stakedBalance[user] += amount`.

## Why the shortfall grows

Each stake overcredits the user.

For a `10,000` stake:

- pool assets go up by `9,800`
- pool liabilities go up by `10,000`
- deficit increases by `200`

Across all deposits:

- recorded liabilities from current stakers: `1,000,000`
- actual tokens held: `975,000`
- insolvency: `25,000`

The shortfall grows with every new stake because every new stake adds another
`2%` mismatch. Early unstakers were paid only because later stakers' deposits
provided enough fresh tokens to cover earlier overcredits. Once inflows stopped
covering the accumulated deficit, unstake calls started reverting on
insufficient balance.

## Correct fix

The pool must credit the amount actually received, not the amount requested.

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;
    stakedBalance[msg.sender] += received;
}
```

This makes liabilities track assets for fee-on-transfer tokens.

`unstake(amount)` can still decrement by `amount` and transfer `amount`, because
that is the amount leaving the pool. If the token also charges a fee on the
outbound transfer, the user will receive less than `amount`, but the pool's own
accounting remains correct because its balance also falls by `amount`.

## What happens to users who cannot currently unstake

They are already undercollateralized. The contract owes `1,000,000 TKN` on its
books but only has `975,000 TKN`.

Changing the code fixes future accounting, but it does not recreate the missing
`25,000 TKN`. For current users, one of these must happen:

- recapitalize the pool with `25,000 TKN`, after which all currently recorded
  balances can be honored, or
- reduce recorded balances proportionally to the actual assets, meaning current
  stakers collectively eat the `25,000 TKN` loss

Without one of those, some users will continue to be unable to unstake in full,
because the tokens are simply not there.

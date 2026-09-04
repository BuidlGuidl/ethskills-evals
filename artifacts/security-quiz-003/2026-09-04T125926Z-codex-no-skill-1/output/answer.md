The pool is interacting with a fee-on-transfer token, specifically one that is
taking 2% on transfers.

The evidence is the user who unstaked `10,000` TKN but only received `9,800`
TKN. That means `token.transfer(msg.sender, 10_000)` debited the pool by
`10,000`, but the token only credited the recipient with `9,800`.

The same thing is happening on `stake(amount)`.

Reasoning:

1. The pool records deposits by the requested amount:

   - user calls `stake(10,000)`
   - contract does `transferFrom(user, pool, 10,000)`
   - contract then does `stakedBalance[user] += 10,000`

2. But if the token charges 2% on inbound transfers, the pool does not receive
   `10,000`; it receives `9,800`.

3. So the pool is minting an internal claim for `10,000` while only receiving
   `9,800` of assets. It becomes undercollateralized by `200` immediately.

Applied to the totals:

- cumulative nominal stakes: `1,250,000`
- 2% transfer fee on those stakes: `25,000`
- actual tokens received by the pool from all staking: `1,225,000`

Then:

- cumulative nominal unstakes: `250,000`
- current pool balance should be `1,225,000 - 250,000 = 975,000`

That exactly matches the observed on-chain balance.

So the missing `25,000` TKN did not disappear inside the pool. It was removed by
the token's transfer mechanics during staking, while the pool still credited
users as if the full amount had arrived.

Why the shortfall grows:

- Each new stake increases liabilities by the requested `amount`.
- But assets increase only by the net amount actually received.
- With a 2% transfer fee, every `100,000` TKN of new nominal staking adds
  another `2,000` TKN hole.

That is why early unstakers could exit: the pool still had enough balance at the
time to satisfy `transfer(msg.sender, amount)`. The insolvency was already
there, but it was hidden until enough people tried to redeem. Once the token
balance fell below the overstated sum of `stakedBalance[user]`, later unstakes
started reverting with insufficient balance.

The accounting fix is:

- On stake, credit the user with the amount actually received, not the input
  argument.

In practice:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;
    stakedBalance[msg.sender] += received;
}
```

This makes internal liabilities track real assets. If a user sends `10,000` and
the token taxes 2%, their stake becomes `9,800`, because that is what the pool
actually received.

What this means on unstake:

- `unstake(amount)` can still transfer `amount` out of the pool and reduce
  `stakedBalance` by `amount`.
- If the token also charges 2% on outbound transfers, the user may receive less
  than `amount` in their wallet, but the pool's accounting is still correct
  because the pool really did spend `amount`.

What happens to the stakers who cannot currently unstake:

- The existing state is already overstated by `25,000` TKN in aggregate.
- Changing the code going forward does not repair that old deficit.
- Those users are blocked because the pool is insolvent relative to recorded
  balances.

To make them whole, one of these must happen:

1. Recapitalize the pool with `25,000` TKN, so current recorded balances become
   fully backed.
2. Recompute/migrate each user's stake to the net amount actually received by
   the pool from that user, using historical transfer data, and reduce balances
   accordingly.

Without one of those actions, some current `stakedBalance` entries are claims on
tokens the pool never actually received, so the last unstakers in line will keep
reverting.

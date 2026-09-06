The missing `25,000 TKN` was not withdrawn by an attacker and it did not vanish inside the pool logic. It was taken by `TKN` itself as a transfer fee.

The giveaway is the user who staked `10,000` and later received `9,800` back. That is a `2%` fee-on-transfer token:

- On stake, the user asked to transfer `10,000`.
- The pool credited `stakedBalance[user] += 10,000`.
- But the pool only actually received `9,800`.

So the pool is booking assets it never received.

The numbers line up exactly:

- cumulative nominal stakes: `1,250,000 TKN`
- if `TKN` takes `2%` on inbound transfers, the pool actually received
  `1,250,000 * 98% = 1,225,000 TKN`
- cumulative nominal unstakes paid by the pool: `250,000 TKN`
- pool balance should then be
  `1,225,000 - 250,000 = 975,000 TKN`

That matches the observed onchain balance.

Meanwhile the contract’s internal accounting says current stakers own:

- `1,250,000 - 250,000 = 1,000,000 TKN`

So the shortfall is:

- `1,000,000 - 975,000 = 25,000 TKN`

That `25,000` is exactly `2%` of the `1,250,000 TKN` nominally staked:

- `1,250,000 * 2% = 25,000 TKN`

Why the shortfall grows:

- Every new stake increases `stakedBalance` by the requested `amount`.
- But the pool balance only increases by the post-fee amount actually received.
- With a `2%` transfer tax, each `100 TKN` staked creates `2 TKN` of new unbacked liability.

So the deficit grows linearly with cumulative deposits. Early unstakers were paid because later depositors’ tokens temporarily covered the hole. Once enough people exited, the pool balance fell below the sum of recorded balances and late unstakers began reverting on `token.transfer(...)` with insufficient balance.

The accounting bug is in `stake(amount)`. For a fee-on-transfer token, the pool must credit the amount actually received, not the nominal amount requested.

Correct pattern:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;

    require(received > 0, "No tokens received");
    stakedBalance[msg.sender] += received;
}
```

This makes internal accounting match actual pool assets. If a user sends `10,000 TKN` and the token taxes `2%`, the pool credits `9,800`, because that is what it truly holds for that user.

`unstake(amount)` can only pay out what the pool actually owes and actually holds. With the corrected accounting, a user who deposited `10,000` into this taxed token pool would have `9,800` staked, not `10,000`. If they later unstake `9,800`, the pool sends `9,800` and the token may again take its outbound `2%` fee, so the wallet would receive `9,604`. That exit fee is token behavior, not a pool accounting error.

What happens to the stakers who cannot currently unstake:

- The code change fixes future deposits, but it does not repair the existing `25,000 TKN` insolvency.
- Current recorded balances add up to `1,000,000`, but the pool only has `975,000`.
- Therefore current stakers are collectively undercollateralized by `25,000 TKN`.

There are only two honest resolutions for the already-live pool:

1. Recapitalize the pool with `25,000 TKN`.
   Then all currently recorded balances can be honored, although each unstaker may still suffer the token’s outbound transfer fee.

2. Realize the loss and haircut existing claims.
   Snapshot current stakers and scale claims by available backing:
   `975,000 / 1,000,000 = 97.5%`.
   A recorded balance of `10,000` would become a real claim on `9,750` pool tokens before any outbound transfer fee.

So the root cause is: the staking contract assumes ERC-20 transfers are value-preserving, but `TKN` is fee-on-transfer. The missing `25,000 TKN` was consumed by the token’s transfer tax on deposits, and the deficit grew because the contract minted internal stake balances against gross deposit requests instead of net tokens received.

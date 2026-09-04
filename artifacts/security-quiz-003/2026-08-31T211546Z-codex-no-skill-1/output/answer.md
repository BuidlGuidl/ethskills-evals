The missing `25,000 TKN` is the token's transfer fee on deposits.

The tell is the user who "staked 10,000" and later "unstaked 10,000" but only
received `9,800 TKN` in their wallet. That is a `2%` transfer tax on the token.
Because `stake(amount)` credits `stakedBalance` with the requested `amount`
instead of the amount the pool actually received, the pool overstates every
deposit.

Reasoning:

1. On stake, the contract does:
   - `token.transferFrom(user, pool, amount)`
   - `stakedBalance[user] += amount`

2. If TKN charges `2%` on transfer, then a "stake 10,000" call moves only
   `9,800` into the pool, but the pool records a liability of `10,000`.
   The pool is immediately short by `200`.

3. Over all deposits:
   - cumulative nominal stakes: `1,250,000`
   - `2%` transfer tax on those stakes: `25,000`
   - actual tokens received by the pool from staking: `1,225,000`

4. Then `250,000` was unstaked nominally. `unstake(amount)` sends `amount`, so
   the pool's balance falls by the full `250,000` even if the recipient only
   receives `98%` after the token taxes the outbound transfer.

5. Therefore the pool balance should be:
   - `1,225,000 - 250,000 = 975,000`

That exactly matches the observed on-chain balance. So the missing `25,000 TKN`
did not vanish inside the staking contract. It was skimmed by TKN's own
transfer logic during deposits and sent wherever that fee goes
(`burn`/treasury/reflection/liquidity bucket, depending on the token).

Why the shortfall grows:

- Every new stake increases `stakedBalance` by the gross requested amount, but
  increases the pool's real assets only by the post-fee amount.
- With a `2%` transfer tax, the accounting deficit grows by `2%` of every new
  deposit.
- Early unstakers were paid because the pool still had enough tokens from later
  deposits to cover them.
- As usage continues, aggregate liabilities outgrow actual holdings until some
  unstake calls revert with the token's insufficient-balance error.

The accounting fix:

Record the net amount actually received, not the user-supplied `amount`.

Example pattern:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;
    stakedBalance[msg.sender] += received;
}
```

This makes pool liabilities match pool assets for fee-on-transfer tokens on
deposit.

What this means for users who cannot currently unstake:

- They are already undercollateralized by the existing bad accounting.
- Changing the code fixes future accounting, but it does not recreate the
  `25,000 TKN` already taken by the token fee.
- As a result, current users whose balances were overstated cannot all be paid
  their recorded `stakedBalance` unless the pool is recapitalized with at least
  `25,000 TKN` (and possibly more if additional bad stakes happened before the
  fix).
- Without recapitalization, some users must take a haircut, because the pool
  only has `975,000 TKN` against `1,000,000 TKN` of recorded claims.

One more consequence:

- Even after fixing deposit accounting, an unstaker may still receive less in
  their wallet than the amount debited from `stakedBalance` if TKN also taxes
  outbound transfers.
- That is a token-behavior issue, not a staking-accounting mismatch. The pool
  can only make its own books correct by crediting deposits based on actual
  receipt.

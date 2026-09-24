The missing 25,000 TKN was not stolen or withdrawn by the staking pool. It was taken by the token's transfer mechanics.

The key clue is the user who staked 10,000 TKN, saw 10,000 credited, and later received only 9,800 TKN when unstaking 10,000. That means TKN is a fee-on-transfer, tax, or burn-style token with an effective 2% transfer loss:

- On `stake(10,000)`, the pool records `stakedBalance[user] += 10,000`.
- But `token.transferFrom(user, pool, 10,000)` only increases the pool's actual token balance by 9,800.
- The staking contract has created a 200 TKN liability that it never received.

The same error happens on the way out:

- On `unstake(10,000)`, the pool decrements the user's recorded balance by 10,000.
- It calls `token.transfer(user, 10,000)`.
- The pool's balance decreases by 10,000, while the user receives only 9,800 after the token fee.

So the pool's internal accounting is denominated in the requested transfer amount, not in the amount the pool actually received and can later pay.

The aggregate numbers match this exactly. Cumulative stakes were 1,250,000 TKN. With a 2% incoming transfer fee, the pool only received:

```text
1,250,000 * 98% = 1,225,000 TKN
```

But the contract credited users for the full 1,250,000 TKN.

Then 250,000 TKN was unstaked. The pool sent out 250,000 TKN from its own balance, even though recipients only netted 245,000 TKN after the outgoing transfer fee:

```text
1,225,000 received by pool - 250,000 sent out = 975,000 actual pool balance
```

Current recorded balances sum to:

```text
1,250,000 credited - 250,000 debited = 1,000,000 recorded staked balance
```

That leaves the observed shortfall:

```text
1,000,000 recorded liabilities - 975,000 actual tokens = 25,000 TKN
```

The shortfall grows because every new stake overcredits the user relative to what the pool actually receives. With a 2% transfer fee, each `stake(amount)` creates an immediate accounting hole of `amount * 2%`. Unstakes do not repair that hole; they pay the next exiting staker from the remaining pool balance. Early unstakers can exit because there is still enough liquidity, but later unstakers eventually hit the token's insufficient-balance error because the pool owes 1,000,000 TKN while holding only 975,000 TKN.

The accounting fix is to credit deposits by the pool's actual balance increase, not by the requested `amount`.

For example:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBalance = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBalance;
    stakedBalance[msg.sender] += received;
}
```

For withdrawals, the contract should also treat the recorded stake as the gross amount the pool will send. If a user withdraws 9,800 credited TKN from a fee-on-transfer token, the pool balance will go down by 9,800 and the user may receive less after the token's outgoing fee. That outgoing loss is imposed by TKN itself and cannot be avoided by the staking pool unless the pool deliberately gross-ups withdrawals, which would require separate funding and explicit rules.

The existing pool is already insolvent on its current ledger. The stakers who cannot currently unstake cannot all be paid their displayed balances from the pool's 975,000 TKN balance. There are only two honest ways to close the books:

1. Recapitalize the pool with 25,000 TKN, plus any extra needed to cover transfer fees if the top-up itself or later payouts are taxed, so every recorded `stakedBalance` can be honored as written.
2. Migrate or rescale balances to the assets actually held, so current users share the 975,000 TKN pro rata instead of being promised 1,000,000 TKN.

Without one of those actions, the contract remains first-exit-wins: earlier unstakers receive payment, and the final 25,000 TKN of recorded balances is unbacked.

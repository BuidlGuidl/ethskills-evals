The missing 25,000 TKN was not withdrawn by an admin and it was not caused by
rewards, rebasing, or a supply change. TKN is behaving like a fee-on-transfer
token with a 2% transfer tax.

The staking contract credits users with the requested transfer amount, not the
amount the pool actually receives:

- users called `stake` for 1,250,000 TKN in total;
- with a 2% transfer fee, the pool only received 98% of that, or 1,225,000 TKN;
- the other 25,000 TKN was taken by the TKN token's transfer-fee mechanism
  during the inbound `transferFrom` calls, for example to a fee collector,
  reflection mechanism, liquidity wallet, or other token-defined destination;
- the contract nevertheless recorded 1,250,000 TKN of staking credit.

Then users unstaked 250,000 TKN. The pool's accounting and token balance both
went down by the nominal 250,000 TKN sent from the pool:

```text
pool received from all stakes:     1,250,000 * 98% = 1,225,000
pool sent for completed unstakes:    250,000
actual pool balance now:             975,000

recorded staked balances:
1,250,000 credited - 250,000 debited = 1,000,000

shortfall:
1,000,000 recorded claims - 975,000 actual TKN = 25,000
```

The user who staked 10,000 TKN and later received 9,800 TKN on unstake confirms
the same 2% transfer tax on outgoing transfers. When the pool transfers 10,000
TKN, its balance is reduced by 10,000, but the user's wallet is credited only
9,800. That exit tax hurts the withdrawing user, but it is not the reason the
pool is 25,000 TKN short against `stakedBalance`; the balance-sheet shortfall
comes from over-crediting deposits that only arrived net of the inbound tax.

The shortfall grows every time someone stakes, because each `stake(amount)`
creates `amount` of recorded liability while only about `amount * 98%` enters
the contract. Early unstakers were paid because the pool still had enough TKN
cash on hand. Later unstakers are now hitting the point where the remaining
recorded claims exceed the remaining tokens, so `token.transfer` reverts with
the token's insufficient-balance error. Since the transfer reverts, the
preceding `stakedBalance` decrement is rolled back by the transaction revert;
those users have not lost their recorded balance, but the pool does not have
enough TKN to honor all recorded balances.

The accounting fix is to credit deposits by the actual balance delta, not by
the requested amount:

```solidity
function stake(uint256 amount) external nonReentrant {
    uint256 beforeBalance = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBalance;

    // Either accept fee-on-transfer behavior:
    stakedBalance[msg.sender] += received;

    // Or, if the product promise is exact 1:1 staking, reject this token:
    // require(received == amount, "fee-on-transfer not supported");
}
```

For a fee-on-transfer token, the UI should also show that withdrawals are taxed
by the token: a user unstaking `x` from the pool may receive only the token's
net post-fee amount in their wallet. If the product requires users to receive
exactly `x`, then this token must be rejected or the pool must have an explicit
gross-up/fee policy funded by someone else.

Changing the code only prevents new bad accounting; it does not create the
missing tokens for current stakers. The existing 1,000,000 TKN of recorded
balances is backed by only 975,000 TKN. To handle the stakers who cannot
currently unstake, the pool must do one of these:

1. recapitalize the pool so it holds 1,000,000 TKN against the existing
   balances; because inbound transfers are taxed, a normal top-up would need to
   send more than 25,000 TKN so that 25,000 TKN arrives net, unless the token
   can fund or exempt the pool directly; or
2. migrate/write down current balances to the assets that actually exist, so
   current stakers collectively have 975,000 TKN of pool claims instead of
   1,000,000 TKN.

Without a top-up, the last 25,000 TKN of displayed staking balances cannot be
paid. The contract has overpromised; the fix is to stop over-crediting future
stakes and then either make the old pool whole or apply an explicit haircut to
existing recorded balances.

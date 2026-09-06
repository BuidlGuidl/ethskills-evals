# Root cause

`TKN` is behaving like a fee-on-transfer token.

The proof is the observed user flow:

- user stakes `10,000`
- pool credits `stakedBalance[user] += 10,000`
- later user unstakes `10,000`
- user wallet receives only `9,800`

That means a 2% transfer fee is being taken when `TKN` moves. The pool code assumes `amount in == amount received`, which is false for this token.

# Where the missing `25,000 TKN` went

The missing tokens were not withdrawn by the pool. They were skimmed by the token itself during `transferFrom` on stake.

Math:

- cumulative stakes requested by users: `1,250,000`
- 2% transfer fee on inbound stake transfers: `25,000`
- actual tokens received by the pool from all stakes: `1,225,000`

Then subtract the tokens the pool has sent out on unstake:

- cumulative unstake amount processed by the pool: `250,000`
- pool balance expected from real flows: `1,225,000 - 250,000 = 975,000`

That exactly matches the observed on-chain balance: `975,000`.

So the “missing” `25,000 TKN` is the total inbound transfer tax taken across all stakes. It likely went to the token’s burn mechanism, fee collector, reflection logic, or equivalent token-level fee destination.

# Why the shortfall grows

The pool records liabilities using the user-supplied `amount`, but assets increase only by the post-fee amount actually received.

For every stake:

- accounting liability increases by `amount`
- real pool assets increase by `amount - fee`
- deficit increases by `fee`

With a 2% fee, every new `100,000 TKN` staked increases the hole by `2,000 TKN`.

That is why:

- total recorded staked balances = `1,000,000`
- actual pool balance = `975,000`
- deficit = `25,000`

Early unstakers succeeded because the contract still had enough real tokens at the time. Later unstakers revert because the pool is now undercollateralized and `token.transfer(msg.sender, amount)` eventually asks the token to send more than the pool actually holds.

# Correct fix

`stake(amount)` must credit the user with the amount the pool actually received, not the nominal argument.

Example pattern:

```solidity
function stake(uint256 amount) external {
    uint256 balanceBefore = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - balanceBefore;
    stakedBalance[msg.sender] += received;
}
```

This makes liabilities track assets for fee-on-transfer tokens.

# What this means for users who cannot currently unstake

This code change fixes the accounting going forward, but it does **not** repair the existing `25,000 TKN` hole.

Current state:

- users are collectively recorded as owed `1,000,000`
- pool only holds `975,000`
- therefore `25,000` of claims are not backed

So the currently stuck stakers cannot all be made whole from the pool as it stands. One of these must happen:

- someone tops up the pool with `25,000 TKN`, after which all current balances can be honored as recorded
- or the protocol accepts a loss event and reduces existing claims/pro-rates withdrawals, which is an economic remediation, not a code fix

Without a recapitalization, some current stakers will continue to revert or, if withdrawals are partially redesigned, they will recover less than their recorded balance.

# Bottom line

The pool is insolvent by exactly the transfer fees charged on deposits because it credits gross stake amounts while receiving net tokens. The accounting fix is to credit only the net amount actually received. Existing stuck users remain short by the already-accumulated `25,000 TKN` unless the pool is separately replenished.

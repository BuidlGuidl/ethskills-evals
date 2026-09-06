This pool is accounting as if `amount` is what the contract receives and what the user later gets back. The observed behavior proves that TKN is a fee-on-transfer token with a 2% tax.

Reasoning:

1. The user who unstaked `10,000` and received `9,800` proves outbound transfers are taxed 2%.
   - The pool called `token.transfer(user, 10_000)`.
   - The user received `9,800`.
   - The missing `200` was taken by the token during the transfer.

2. The same token behavior explains the pool deficit on stake.
   - On every `stake(amount)`, the pool credits `stakedBalance[msg.sender] += amount`.
   - But with a 2% transfer tax, `token.transferFrom(msg.sender, address(this), amount)` only increases the pool's real balance by `98%` of `amount`.
   - So the contract books a liability larger than the asset it actually received.

3. The aggregate numbers match exactly.
   - Cumulative nominal stakes: `1,250,000 TKN`
   - 2% tax on inbound transfers: `25,000 TKN`
   - Real TKN that actually entered the pool: `1,225,000 TKN`
   - Nominal unstaked amount sent by the pool: `250,000 TKN`
   - Pool balance after those unstake transfers: `1,225,000 - 250,000 = 975,000 TKN`

4. Why the books do not close.
   - Sum of all current `stakedBalance[user]`: `1,000,000 TKN`
   - Actual pool balance: `975,000 TKN`
   - Deficit: `25,000 TKN`
   - That missing `25,000` did not stay in the pool. It was skimmed by the token's transfer-fee mechanism during deposits.

5. Why the shortfall grows.
   - Each new stake overstates liabilities by another 2% of the nominal deposit.
   - If someone stakes `100,000`, the pool records `100,000` owed but only receives `98,000`.
   - The insolvency therefore increases with every additional stake.
   - Unstakes do not repair that gap: they reduce pool assets by the full `amount` transferred out, and they reduce the recorded liability by the same full `amount`. The existing deficit remains.

Why early users could unstake and later users cannot:

- The pool was only partially insolvent at first, so it still had enough tokens on hand to satisfy early `unstake(amount)` calls.
- Those users were paid from the pool's remaining balance, with later depositors effectively covering the earlier accounting mismatch.
- Once the contract balance fell below the sum of recorded balances by enough that a requested `unstake(amount)` exceeded the remaining real balance, `token.transfer` started reverting with insufficient balance.
- The blocked users are not seeing a logic revert from the staking contract first; they are hitting the token contract because the pool is short real tokens.

The change that makes the accounting correct:

Credit the user with the amount the pool actually receives, not the nominal `amount` argument.

Example fix:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 afterBal = token.balanceOf(address(this));

    uint256 received = afterBal - beforeBal;
    stakedBalance[msg.sender] += received;
}
```

With that change:

- A user who "stakes 10,000" into a 2%-tax token is credited with `9,800`, because that is what the pool actually received.
- If they later unstake their full recorded balance of `9,800`, the pool remains internally solvent because it is only promising what it actually has.
- Because TKN also taxes outbound transfers, their wallet would receive `9,604` from that `unstake(9,800)` call if the token takes 2% again on the way out. That outbound loss is a token property, not a pool accounting error.

What happens to the users who currently cannot unstake:

- Changing the code fixes the accounting for future deposits, but it does not recreate the already-missing `25,000 TKN`.
- The current pool is already undercollateralized by `25,000 TKN`, so some existing stakers cannot all be made whole from the current contract balance.
- They can only be unstuck if `25,000 TKN` is added to the pool from outside, or if losses are socialized across current stakers by reducing recorded balances to match reality.
- In other words, the code fix prevents further growth of the deficit, but the historical deficit must still be funded or explicitly allocated.

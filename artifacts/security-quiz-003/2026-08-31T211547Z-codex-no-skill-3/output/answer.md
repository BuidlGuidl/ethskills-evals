# Root cause

`TKN` is a fee-on-transfer token with a 2% transfer tax.

The proof is the user example:

- User called `stake(10,000)`.
- Pool credited `stakedBalance[user] += 10,000`.
- When the user later unstaked `10,000`, their wallet received `9,800`.

That only makes sense if transfers of `TKN` burn or redirect 2% in transit.

# Where the missing 25,000 TKN went

The pool is crediting users for the **requested** stake amount, not the **amount actually received**.

From launch totals:

- Cumulative stakes requested: `1,250,000`
- With a 2% transfer fee, the pool actually received: `1,250,000 * 0.98 = 1,225,000`
- Missing on the way in: `25,000`

So the missing `25,000 TKN` never sat in the pool at all. It was taken by the token’s transfer fee mechanism during deposits.

# Why the numbers match the observed balance

Start from the real amount received:

- Real tokens received by pool from all stakes: `1,225,000`
- Tokens sent out by pool for unstake calls: `250,000`
- Real pool balance now: `1,225,000 - 250,000 = 975,000`

That exactly matches the observed on-chain balance: `975,000 TKN`.

But the contract’s accounting says:

- Total current `stakedBalance`: `1,000,000`

So the pool owes `1,000,000` by its own ledger while only holding `975,000`.
The deficit is exactly:

- `1,000,000 - 975,000 = 25,000`

# Why the shortfall grows

Each new stake increases the accounting liability by the full requested amount, but increases the real assets by only 98% of that amount.

For a stake of `A`:

- Ledger liability added: `A`
- Real tokens added to pool: `A * 0.98`
- New deficit created: `A * 0.02`

So the under-collateralization grows by 2% of every taxed deposit.

Unstakes do not create the mismatch; they only expose it. Early users can exit while enough real tokens remain. Later users revert once the pool’s real balance is below the inflated sum of recorded balances.

# Correct accounting change

The fix is to credit the user with the **actual tokens received by the pool**, measured by balance delta.

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;

    stakedBalance[msg.sender] += received;
}
```

`unstake(amount)` can still decrement by `amount` and transfer `amount`, because that correctly tracks how many tokens leave the pool. If `TKN` also charges a fee on outgoing transfers, the user may receive less in their wallet, but the pool accounting is still correct because the pool itself lost `amount`.

# What happens to users who cannot currently unstake

This code fix prevents **new** bad accounting, but it does not repair the existing `25,000 TKN` hole.

Right now current stakers are collectively over-credited by `25,000 TKN`. That means:

- without adding `25,000 TKN` back into the pool, not everyone can withdraw their recorded balance;
- some unstake calls will keep reverting once the pool balance is exhausted.

To make current users whole, the pool must be recapitalized by `25,000 TKN`.

If no top-up happens, then the only honest resolution is to realize the loss in accounting, for example by reducing existing balances pro rata or by migrating to a new contract with corrected balances. Either way, the users currently unable to unstake are not blocked by a random bug in `transfer`; they are blocked because the contract is insolvent by `25,000 TKN`.

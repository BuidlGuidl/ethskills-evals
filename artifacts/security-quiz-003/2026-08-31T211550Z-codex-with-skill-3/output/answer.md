The missing `25,000 TKN` did not leave the token system through the staking
contract. It was taken by the token itself as a transfer fee.

The evidence is the arithmetic:

- Cumulative `stake(amount)` calls recorded: `1,250,000 TKN`
- Pool balance actually held after all staking and before unstaking would be:
  `1,250,000 - 2% = 1,225,000 TKN`
- Cumulative `unstake(amount)` calls sent out by the pool: `250,000 TKN`
- Expected pool balance after those unstakes:
  `1,225,000 - 250,000 = 975,000 TKN`

That matches the observed onchain balance exactly: `975,000 TKN`.

So the "missing" `25,000 TKN` is the 2% fee charged when users staked into the
pool:

- `1,250,000 * 2% = 25,000`

The `10,000 -> 9,800` user example shows the same token behavior on unstake:

- the pool transferred `10,000 TKN`
- the token skimmed 2%
- the user received `9,800 TKN`

Why the shortfall grows:

1. `stake(amount)` credits `stakedBalance[msg.sender] += amount`.
2. But the pool does not actually receive `amount`; it receives only the
   post-fee amount.
3. Each stake therefore over-credits liabilities by 2%.
4. Repeating that on every deposit makes total recorded stake larger than the
   pool's real token balance by the sum of all deposit fees.

Using the current totals:

- Sum of all current `stakedBalance[user]`: `1,000,000 TKN`
- Actual pool balance: `975,000 TKN`
- Deficit: `25,000 TKN`

Early unstakers succeeded because the pool still had enough real tokens to pay
the nominal amounts requested. As more users exit, the contract eventually
reaches the point where recorded balances exceed actual holdings, and then
`token.transfer(msg.sender, amount)` starts reverting with insufficient balance.

The accounting fix is to credit only what the pool actually receives, not the
requested `amount`.

Example:

```solidity
using SafeERC20 for IERC20;

function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;

    stakedBalance[msg.sender] += received;
}

function unstake(uint256 amount) external {
    stakedBalance[msg.sender] -= amount;
    token.safeTransfer(msg.sender, amount);
}
```

This makes liabilities track assets correctly for fee-on-transfer tokens:

- if a user asks to stake `10,000` and the pool receives `9,800`, the user's
  stake balance becomes `9,800`
- later, if they unstake `9,800`, the pool's balance and the user's recorded
  balance both go down by `9,800`
- if the token also charges 2% on the outbound transfer, the user wallet will
  receive `9,604`, but the pool's accounting is still correct because the pool
  really did send `9,800`

What happens to users who cannot currently unstake:

- This code change prevents new accounting drift.
- It does not restore the already-lost `25,000 TKN`.
- The pool is currently undercollateralized by `25,000 TKN`, so existing
  stakers cannot all be paid their currently recorded balances in full.

That means one of these must happen before everyone can exit cleanly:

- recapitalize the pool with `25,000 TKN`, or
- reduce existing recorded balances to match available assets

Without one of those remedies, some current stakers will remain unable to
withdraw their full displayed balances, because those balances were overstated
at deposit time.

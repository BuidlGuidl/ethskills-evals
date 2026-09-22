# Staking pool accounting mismatch

The missing 25,000 TKN was not withdrawn by the pool and it was not caused by
rewards, rebasing, or supply changes. TKN is behaving like a fee-on-transfer
token with a 2% transfer fee.

The clearest evidence is the user who unstaked 10,000 TKN and only received
9,800 TKN. A normal ERC-20 transfer of 10,000 would credit the recipient with
10,000. Receiving 9,800 means 200 TKN, or 2%, was taken by the token during the
transfer and routed according to TKN's fee logic. Since total supply did not
change, that fee was not burned; it went to whatever fee recipient, treasury,
liquidity, reflection, or similar mechanism the token implements.

The pool's accounting is wrong because `stake(amount)` trusts the requested
`amount` instead of measuring how many tokens the pool actually received.

With a 2% transfer fee:

- Users called `stake()` for a cumulative 1,250,000 TKN.
- The staking contract credited users for the full 1,250,000 TKN.
- But the contract actually received only 98% of that:

```text
1,250,000 * 0.98 = 1,225,000 TKN
```

So 25,000 TKN was taken by TKN's transfer-fee logic on the inbound staking
transfers:

```text
1,250,000 - 1,225,000 = 25,000 TKN
```

Then 250,000 TKN of nominal stake was unstaked. The contract transferred out
250,000 TKN, leaving:

```text
1,225,000 - 250,000 = 975,000 TKN
```

That exactly matches the pool's actual TKN balance. Meanwhile the internal
ledger still says current stakers own:

```text
1,250,000 credited - 250,000 debited = 1,000,000 TKN
```

So the pool has 975,000 TKN but owes 1,000,000 TKN on paper. The 25,000 TKN
shortfall is the accumulated deposit-side transfer fees that were credited as
stake even though they never arrived in the pool.

The shortfall grows every time someone stakes, because each deposit credits
`amount` but increases the contract balance by only `amount - fee`. Early
unstakers could exit because the pool still had enough aggregate balance to pay
their requested transfer amounts. Later unstakers are now hitting the real
solvency limit: the contract cannot transfer 1,000,000 TKN of liabilities when
it only holds 975,000 TKN.

The outgoing transfer fee is a separate user-facing effect. When a user
unstakes 10,000 TKN, the pool's balance is reduced by 10,000 TKN, but the user
only receives 9,800 TKN because TKN charges another 2% on the transfer from the
pool to the user.

## Correct accounting change

`stake()` must credit the user with the amount actually received by the pool,
not the nominal amount passed into `transferFrom`.

The standard pattern is:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBalance = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBalance;

    require(received > 0, "no tokens received");
    stakedBalance[msg.sender] += received;
}
```

After this change, a user who transfers 10,000 TKN into the pool and the pool
receives 9,800 TKN is credited with 9,800 TKN, not 10,000 TKN. The internal
liability then matches the pool's assets.

For `unstake()`, the contract can still debit the requested stake amount and
call `token.transfer(msg.sender, amount)`, but the user must understand that a
fee-on-transfer token may deliver less than `amount` to their wallet. If the
product promise is that users receive the exact unstaked amount, then this
token cannot be supported without separately funding the transfer fees or
changing the redemption model.

## Current stuck stakers

The existing pool is already insolvent relative to its internal ledger. The
contract owes current stakers 1,000,000 TKN but only holds 975,000 TKN.
Changing the future accounting does not create the missing 25,000 TKN.

To make all current stakers able to unstake their full recorded balances, the
pool must be recapitalized with at least 25,000 TKN, plus enough extra to cover
any transfer fees if the intended outcome is that users receive their full
recorded balances in their wallets.

Without recapitalization, only 975,000 TKN can be transferred out by the pool.
The remaining recorded stake is unbacked. The fair fix is either to top up the
pool and then migrate to received-amount accounting, or to explicitly socialize
the 25,000 TKN deficit across current stakers by reducing claimable balances to
the backed amount. What is not correct is to keep honoring `stakedBalance` as
if every nominal deposit was fully received.

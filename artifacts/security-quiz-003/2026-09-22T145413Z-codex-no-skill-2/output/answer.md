The missing TKN is not a mysterious withdrawal from the staking contract. It is
the token's transfer fee.

The giveaway is the user who unstaked 10,000 TKN and only received 9,800 TKN.
That is a 2% fee-on-transfer:

```text
200 / 10,000 = 2%
```

The staking contract accounts as if `amount` is the number of tokens actually
received, but that is not true for this token. On each stake, the contract does:

```solidity
token.transferFrom(user, address(this), amount);
stakedBalance[user] += amount;
```

If a user stakes 10,000 TKN, only 9,800 TKN reaches the pool, but the pool records
a 10,000 TKN liability. The missing 200 TKN goes wherever TKN's transfer fee
sends it: a tax wallet, reflection mechanism, liquidity mechanism, or other
token-level fee destination. Because total supply did not change and there was
no rebase, it was not caused by staking logic, rewards, minting, burning by the
pool, or supply rebasing.

The pool-wide numbers match exactly:

```text
cumulative nominal stakes:       1,250,000 TKN
2% deposit transfer fee:            25,000 TKN
actual tokens received by pool:  1,225,000 TKN
nominal unstaked/transferred out:  250,000 TKN
actual pool balance:              975,000 TKN
recorded current liabilities:   1,000,000 TKN
shortfall:                         25,000 TKN
```

So the current 25,000 TKN shortfall is the aggregate 2% fee taken from inbound
stake transfers. The shortfall grows whenever new stakes are credited by the
requested `amount` instead of by the pool's actual balance increase. Successful
unstakes expose the insolvency: the pool transfers the gross recorded amount out,
even though it originally received less than that amount. Eventually the remaining
contract balance is lower than the remaining recorded balances, and later unstake
calls start reverting with TKN's insufficient-balance error.

There is also a separate withdrawal-side fee. When the pool calls
`token.transfer(user, 10_000)`, the pool's balance decreases by 10,000, but the
user only receives 9,800. That 200 TKN goes to the same token-level fee mechanism.
This explains why early unstakers could complete but receive less in their
wallets than the amount removed from `stakedBalance`.

The accounting fix is to credit deposits by the amount actually received, not by
the user-supplied amount:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBalance = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBalance;

    require(received > 0, "no tokens received");
    stakedBalance[msg.sender] += received;
}
```

Then `stakedBalance` represents the user's claim on tokens actually held by the
pool. For unstaking, the pool can continue debiting and transferring that recorded
amount, but users must understand that TKN may still charge an outgoing transfer
fee, so their wallet may receive less than the gross amount unstaked. If the
product promise is that users receive the full wallet-net amount, this token
should not be supported unless the contract explicitly handles and charges for
the outgoing fee.

This code change fixes future accounting, but it does not create the missing
25,000 TKN for current stakers. The pool is already insolvent relative to its
recorded balances:

```text
available assets:      975,000 TKN
recorded liabilities: 1,000,000 TKN
coverage ratio:          97.5%
```

The current stuck stakers therefore cannot all withdraw their full recorded
balances from the existing pool balance. One of two things has to happen:

1. The pool is recapitalized with 25,000 TKN, after which the recorded balances
   can be honored on a gross-transfer basis, still subject to TKN's outgoing
   transfer fee.
2. The loss is recognized and current claims are reduced pro rata to the tokens
   actually available, so each current staker can withdraw 97.5% of their recorded
   balance, again subject to any outgoing TKN transfer fee.

Without one of those steps, changing the code only prevents the deficit from
getting worse; it does not make the already-overstated balances payable.

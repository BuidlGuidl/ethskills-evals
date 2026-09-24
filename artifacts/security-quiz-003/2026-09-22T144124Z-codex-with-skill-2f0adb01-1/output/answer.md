# Diagnosis

TKN is behaving like a fee-on-transfer token with a 2% transfer fee.

The pool credits the user with the `amount` argument, but that is not the
amount the pool actually receives. The pool only learns whether
`transferFrom()` completed; it never checks the balance delta.

The numbers match exactly:

```text
Gross stake calls:          1,250,000 TKN
2% fee on stake transfers:     25,000 TKN
Actually received by pool:  1,225,000 TKN

Gross unstake transfers:      250,000 TKN
Pool balance now:             975,000 TKN

Recorded current stakes:    1,000,000 TKN
Actual pool assets:           975,000 TKN
Deficit:                       25,000 TKN
```

So the missing 25,000 TKN was not taken by the staking contract and was not
paid out as rewards. It went wherever TKN routes its transfer fee: a fee
collector, treasury, liquidity mechanism, or similar token-level destination.
Because total supply did not change, it was not a burn.

The user who staked 10,000 TKN and later received 9,800 TKN shows the same
token behavior on the way out. On deposit, the pool likely received only 9,800
TKN but credited the user with 10,000. On withdrawal, the pool sent 10,000 TKN,
then TKN took another 2% fee, so the wallet received 9,800 TKN.

# Why It Gets Worse

The shortfall grows on every stake:

```solidity
token.transferFrom(msg.sender, address(this), amount);
stakedBalance[msg.sender] += amount;
```

If `amount` is 10,000 but the pool receives 9,800, the pool has created a
10,000 TKN liability backed by only 9,800 TKN of assets. That adds a 200 TKN
deficit immediately.

Unstakes did not expose the bug at first because the pool still had enough
tokens to pay early exits. Those early unstakers were effectively paid from the
shared pool balance, including tokens deposited by later stakers. Once enough
users tried to withdraw, the contract's real balance became smaller than the
sum of recorded balances, and the token correctly reverted with insufficient
balance.

# Correct Accounting Change

The pool must credit the amount actually received, not the requested transfer
amount:

```solidity
using SafeERC20 for IERC20;

function stake(uint256 amount) external {
    require(amount > 0, "zero amount");

    uint256 beforeBalance = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBalance;

    require(received > 0, "no tokens received");
    stakedBalance[msg.sender] += received;
}
```

With this change, a user who transfers 10,000 TKN and causes the pool to
receive 9,800 TKN is credited with 9,800 TKN. The internal liabilities then
match the pool's actual assets.

For `unstake`, the contract can continue to debit the gross amount it sends out:

```solidity
function unstake(uint256 amount) external {
    require(stakedBalance[msg.sender] >= amount, "insufficient stake");

    stakedBalance[msg.sender] -= amount;
    token.safeTransfer(msg.sender, amount);
}
```

The user may still receive less than `amount` in their wallet because TKN taxes
outgoing transfers too. That is a token property, not staking rewards logic. If
the product promise is that users receive exactly their displayed stake in their
wallet, then this token is incompatible with the current staking design unless
the pool deliberately gross-ups withdrawals and funds the extra transfer fees.
That would require explicit accounting and funding; it must not come silently
from other stakers.

# Current Stakers

Changing `stake()` fixes future accounting, but it does not create the missing
25,000 TKN for existing stakers.

Right now the pool owes 1,000,000 TKN by its own ledger and has only 975,000
TKN. The stakers who cannot currently unstake are holding claims against tokens
the pool never received. There are only two honest repair choices:

1. Top up the pool so assets equal recorded liabilities. Because TKN charges a
   transfer fee, the funder must send enough that the pool receives a net
   25,000 TKN. After that, current stakers can withdraw their recorded balances,
   subject to TKN's normal outgoing transfer fee.

2. Apply a pro rata correction to current balances so total recorded stake
   equals the actual pool balance. In this case each current balance is scaled
   by `975,000 / 1,000,000 = 97.5%`. This makes the contract solvent, but it
   makes the remaining stakers absorb the historical deposit-fee deficit.

What is not valid is simply deploying the future fix and pretending the live
ledger is whole. The current pool is insolvent by 25,000 TKN on a gross
accounting basis, and late unstakers are the ones currently discovering that
loss.

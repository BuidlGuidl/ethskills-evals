The missing 25,000 TKN was lost to TKN's transfer fee during staking.

The decisive clue is the user who staked 10,000 TKN, was credited with 10,000
inside the pool, and then received only 9,800 TKN when unstaking. That is a 2%
fee-on-transfer token. The pool accounting assumes that `amount` moved, but the
token does not actually deliver `amount` to the receiver.

The numbers reconcile exactly:

- Users called `stake()` for a cumulative 1,250,000 TKN.
- With a 2% transfer fee, the pool actually received only 98% of that:
  `1,250,000 * 0.98 = 1,225,000 TKN`.
- The contract still credited users for the full 1,250,000 TKN because it does
  `stakedBalance[user] += amount`.
- Users later unstaked 250,000 TKN of recorded principal. Those transfers debited
  the pool by the full 250,000 TKN.
- So the pool's actual remaining balance is:
  `1,225,000 - 250,000 = 975,000 TKN`.
- But the pool's recorded remaining liabilities are:
  `1,250,000 - 250,000 = 1,000,000 TKN`.

That leaves the observed deficit:

`1,000,000 recorded staked - 975,000 actual tokens = 25,000 TKN`.

Those 25,000 TKN were never in the staking pool. They were taken by TKN's
transfer-fee mechanism on the way into the pool, either burned, sent to a fee
recipient, redistributed, or otherwise handled by the token contract. The pool
has no admin withdrawal and no reward logic, so the deficit does not require a
pool-side drain.

The shortfall grows because every new stake records the caller's requested
`amount`, while the pool receives less than `amount`. With a 2% fee, each
deposit adds only 98% of the credited liability to the contract balance. The
contract becomes more insolvent by 2% of every incoming stake.

Outgoing transfers also appear to be taxed: when the contract transfers 10,000
TKN to a user, the user's wallet receives 9,800 TKN. That outgoing fee hurts the
unstaker, but it is not the source of the 25,000 TKN book deficit. The pool is
still debited by the full 10,000 TKN it tried to transfer.

The accounting fix is to credit shares or balances based on the amount actually
received, not the amount requested:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBalance = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBalance;

    require(received > 0, "No tokens received");
    stakedBalance[msg.sender] += received;
}
```

Using `SafeERC20` is also important because ERC-20 return behavior is not
uniform. If this is intended to support fee-on-transfer tokens, the same
principle should drive the full design: internal liabilities must be tied to
actual assets received, and the UI must show that withdrawing a nominal amount
may deliver less to the user after the token's outgoing transfer fee.

For the current pool, this code change prevents future over-crediting but does
not create the missing 25,000 TKN. Existing stakers currently have 1,000,000 TKN
of recorded claims against only 975,000 TKN of assets. The stakers who cannot
currently unstake are seeing the insolvency surface: once earlier unstakers have
withdrawn enough real tokens, later withdrawals revert because the contract no
longer has the full recorded amount.

There are only two honest ways to handle the existing deficit:

1. Recapitalize the pool by adding at least 25,000 TKN, plus any amount needed
   to account for transfer fees on the top-up if TKN charges the pool on receipt.
   After that, recorded balances can be honored, though users may still receive
   less than the nominal transfer amount because TKN taxes outgoing transfers.
2. Socialize the loss by reducing current recorded balances or converting them
   into proportional claims on the 975,000 TKN actually held by the pool. In that
   case, current stakers cannot all receive their displayed 1,000,000 TKN,
   because those tokens are not in the contract.

The one thing the fix cannot do is make the stranded stakers whole by accounting
alone. The missing tokens must either be replaced, or the current balances must
be written down to the assets the pool actually controls.

# Staking Pool Accounting Failure

The missing `25,000 TKN` was taken by TKN's transfer-fee logic when users staked.

The pool credits the requested stake amount:

```solidity
token.transferFrom(msg.sender, address(this), amount);
stakedBalance[msg.sender] += amount;
```

but TKN does not actually deliver the full `amount` to the pool. The observed
user result shows the rate: when `10,000 TKN` was transferred out, the wallet
received `9,800 TKN`, so TKN charges a `2%` transfer fee. Since total supply did
not change and there was no rebase, that fee was not burned by a supply change;
it went to whatever fee sink, treasury, reflection, or token-controlled recipient
TKN uses.

That exactly matches the pool deficit:

```text
cumulative stake requests: 1,250,000 TKN
2% transfer fee:              25,000 TKN
actual received by pool:   1,225,000 TKN

gross unstake requests:       250,000 TKN
pool balance after unstake:   975,000 TKN

recorded current stakes:    1,000,000 TKN
actual pool balance:          975,000 TKN
shortfall:                     25,000 TKN
```

The outgoing unstake transfers are also taxed. For example, when the pool sends
`10,000 TKN`, the pool balance decreases by `10,000 TKN`, but the user receives
only `9,800 TKN`. That hurts the unstaker, but it is not the reason the current
ledger is short by `25,000 TKN`: the ledger was already inflated on deposits by
crediting gross requested amounts instead of net received amounts.

The shortfall grows because every new stake over-credits the user by the transfer
fee. A `10,000 TKN` stake increases `stakedBalance` by `10,000`, while the
contract only receives `9,800`. That adds another `200 TKN` of insolvency. Early
unstakers were paid because there was still enough pooled balance to satisfy
their gross withdrawal amounts. Later unstakers are now hitting the real
insufficient-balance condition because the remaining `1,000,000 TKN` of recorded
claims are backed by only `975,000 TKN`.

The accounting fix is to credit deposits by the pool's actual balance delta, not
by the user-supplied `amount`:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBalance = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBalance;

    require(received > 0, "ZERO_RECEIVED");
    stakedBalance[msg.sender] += received;
}
```

With that change, a user who transfers `10,000 TKN` into a token that charges
`2%` is credited with `9,800 TKN`, because that is what the pool actually
received and can later account for. `SafeERC20` should be used for the transfer
calls, but the essential fix is the balance-delta credit.

This code change does not restore the already-missing `25,000 TKN`. The current
pool is insolvent: it has `975,000 TKN` backing `1,000,000 TKN` of recorded
balances. The stakers who cannot currently unstake cannot all be paid their
recorded balances unless the pool is recapitalized. The practical choices are:

1. Top up the pool so its actual balance again covers recorded balances. Because
   TKN charges transfer fees, the sender may need to transfer more than
   `25,000 TKN` for the contract to receive a net `25,000 TKN`.
2. Socialize the loss by reducing recorded balances pro rata to the assets the
   pool actually holds. That realizes the `25,000 TKN` deficit across remaining
   stakers.

Without one of those remediation steps, the first remaining stakers to unstake
will consume the available `975,000 TKN`, and some later stakers will continue
to revert once the contract balance is exhausted.

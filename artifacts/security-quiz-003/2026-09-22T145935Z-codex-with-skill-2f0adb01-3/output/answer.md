The missing 25,000 TKN was taken by TKN's transfer fee on deposits into the
pool.

The contract accounts as if `amount` is the amount received:

```solidity
token.transferFrom(msg.sender, address(this), amount);
stakedBalance[msg.sender] += amount;
```

But the observed unstake result shows that TKN is a fee-on-transfer token. A
10,000 TKN transfer delivers only 9,800 TKN to the recipient, so the transfer
fee is 2%.

Apply that to the staking history:

- Users called `stake` for a cumulative 1,250,000 TKN.
- The pool credited the full 1,250,000 TKN in `stakedBalance`.
- With a 2% transfer fee, the pool actually received only 98%:
  `1,250,000 * 0.98 = 1,225,000 TKN`.
- Users have called `unstake` for 250,000 TKN.
- The pool's balance therefore became:
  `1,225,000 - 250,000 = 975,000 TKN`.
- The internal ledger became:
  `1,250,000 - 250,000 = 1,000,000 TKN`.

That leaves exactly:

```text
1,000,000 internal staked balance
- 975,000 actual pool balance
= 25,000 TKN shortfall
```

The 25,000 TKN is the 2% fee skimmed from the 1,250,000 TKN of incoming stake
transfers. Depending on TKN's implementation, it was burned, sent to a fee
collector, redistributed, or otherwise removed during `transferFrom`; it was
never actually held by the staking pool.

The 10,000 -> 9,800 unstake is the same token behavior in the other direction.
When the pool calls `token.transfer(user, 10,000)`, the pool's balance is
reduced by 10,000, but the user receives only 9,800. That outgoing fee explains
why unstakers receive less than their recorded amount. It is not the reason the
current internal ledger is 25,000 above the pool balance; that ledger mismatch
comes from over-crediting deposits.

The shortfall grows because every new stake mints accounting credit for tokens
that the pool did not actually receive. At a 2% transfer fee, each `stake(amount)`
adds only `0.98 * amount` to the contract's real balance but adds `amount` to
`stakedBalance`. The pool becomes insolvent by another `0.02 * amount` on every
deposit. Early unstakers could be paid because later/current stakers' tokens
were still in the pool. Once enough users try to withdraw, the contract can no
longer transfer the full nominal balances and starts reverting with TKN's
insufficient-balance error.

The accounting fix is to credit the amount actually received, not the requested
amount:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBalance = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBalance;

    require(received > 0, "No tokens received");
    stakedBalance[msg.sender] += received;
}
```

Use `SafeERC20` for the transfer call, and if the token's transfer fee can vary,
always keep this balance-delta pattern rather than assuming a fixed 2%.

There are two separate choices for `unstake`, depending on the intended user
contract:

1. If `stakedBalance` means "tokens the pool owes and will spend", then
   `unstake(amount)` should debit `amount` and transfer `amount`. The user may
   receive less after TKN's outgoing transfer fee, as happened with the 10,000
   TKN unstake that delivered 9,800 TKN.

2. If `stakedBalance` means "tokens the user should receive in their wallet",
   then the contract cannot satisfy that by simply transferring `amount` with a
   fee-on-transfer token. It would need to gross up the transfer, if possible,
   or reject fee-on-transfer tokens entirely.

For the current insolvent pool, changing the code only fixes future deposits.
It does not create the missing 25,000 TKN. The existing current stakers have
claims totaling 1,000,000 TKN, but the contract holds only 975,000 TKN. To make
everyone whole on the current ledger, someone must recapitalize the pool by
adding at least 25,000 TKN, plus any extra needed if withdrawals themselves are
expected to deliver net amounts after TKN's outgoing transfer fee.

If the pool is not recapitalized, the contract cannot let every current staker
withdraw their recorded balance. The honest resolution is to migrate or patch
the system so current claims are reduced pro rata to the assets actually held:

```text
claimable = stakedBalance[user] * 975,000 / 1,000,000
          = stakedBalance[user] * 97.5%
```

Those users would still pay whatever outgoing TKN transfer fee applies when the
pool transfers their claim. Users who currently cannot unstake are stuck because
the internal ledger promises more TKN than the pool owns; they can only be fully
paid if the deficit is funded, otherwise their balances must be written down or
settled pro rata in a migration.

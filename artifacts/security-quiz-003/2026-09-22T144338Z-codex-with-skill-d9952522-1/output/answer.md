# Explanation

The missing 25,000 TKN is the transfer fee taken by TKN on deposits.

The pool is accounting for the requested transfer amount, not the amount it
actually receives:

- Users called `stake()` for a cumulative 1,250,000 TKN.
- TKN appears to charge a 2% fee on transfer, because a 10,000 TKN transfer
  results in only 9,800 TKN reaching the recipient.
- So the pool only received `1,250,000 * 98% = 1,225,000` TKN from all stakes.
- The pool nevertheless credited users with the full 1,250,000 TKN.

Then 250,000 TKN was unstaked. On each unstake, the pool decremented the user's
ledger balance by the nominal amount and sent that same nominal amount out. From
the pool's point of view, its token balance fell by the full 250,000 TKN.

That leaves:

```text
Actual pool balance = 1,225,000 received - 250,000 sent = 975,000 TKN
Internal liabilities = 1,250,000 credited - 250,000 debited = 1,000,000 TKN
Shortfall = 1,000,000 - 975,000 = 25,000 TKN
```

Because total supply did not change and there was no rebase, the 25,000 TKN was
not caused by supply mechanics. It went wherever TKN's transfer-fee logic sends
fees, such as a fee collector, treasury, liquidity mechanism, or redistribution
to other holders. It never became custodial pool assets.

The shortfall grows on every new stake because the contract credits `amount`
while receiving only `amount - fee`. Unstaking does not fix that accounting
gap. It just pays users from the pool's remaining real balance until the pool no
longer has enough TKN to cover the inflated ledger, at which point `token.transfer`
reverts with insufficient balance.

The 10,000 TKN example shows both sides of the problem:

```text
Stake 10,000:
  pool receives 9,800
  user is credited 10,000
  pool becomes undercollateralized by 200

Unstake 10,000:
  pool sends 10,000
  user receives 9,800 after TKN's outgoing transfer fee
```

The user receiving 9,800 on withdrawal does not mean the pool only lost 9,800.
For a normal fee-on-transfer token, the sender's balance is debited by the full
10,000, while the recipient receives 9,800 and the fee goes to the token's fee
mechanism.

# Correct Change

The staking contract must account from balance deltas, not requested amounts.

For deposits:

```solidity
uint256 beforeBalance = token.balanceOf(address(this));
token.safeTransferFrom(msg.sender, address(this), amount);
uint256 received = token.balanceOf(address(this)) - beforeBalance;
stakedBalance[msg.sender] += received;
totalStaked += received;
```

That makes the ledger match the assets actually held by the pool. If the product
does not want to support fee-on-transfer tokens, the stricter fix is to reject
them:

```solidity
require(received == amount, "fee-on-transfer not supported");
```

For withdrawals, the contract should continue to reduce the user's accounted
stake by the amount of pool assets sent out. If TKN charges an outgoing transfer
fee, the recipient may receive less than the debited stake amount. That is a
token-level exit cost, and the UI/docs should show it. The pool cannot make a
fee-on-transfer token deliver the full nominal amount unless it overpays, which
would again harm the remaining stakers.

# Current Insolvency

This code change fixes future accounting, but it does not create the missing
25,000 TKN. The pool currently owes current stakers 1,000,000 TKN on its ledger
and only holds 975,000 TKN.

The stakers who cannot currently unstake are blocked because earlier users were
allowed to withdraw against an overcredited ledger. To make all current stakers
whole according to the existing UI balances, someone must recapitalize the pool
with 25,000 TKN, plus any additional TKN needed if the token charges fees on the
top-up transfer.

Without recapitalization, the honest accounting state is that the remaining
stakers collectively own only the 975,000 TKN actually held by the contract, not
the 1,000,000 TKN shown by `stakedBalance`. A migration or emergency fix would
need to either:

- add the missing assets and then allow 1:1 withdrawals against existing
  balances; or
- rescale current balances/pro-rata claims to the assets actually held, so the
  remaining 975,000 TKN is withdrawable without reverting.

The fairest user-facing remediation is usually to pause new staking, fund the
25,000 TKN deficit, switch deposit accounting to the actual received amount, and
then resume withdrawals.

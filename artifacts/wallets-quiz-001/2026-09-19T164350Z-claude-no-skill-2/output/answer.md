# Verdict on "one-click entry": the teammate is wrong. The user keeps their address.

## Short answer

The teammate was right before May 2025. They are wrong now. The Pectra hard fork
(mainnet, 7 May 2025) shipped **EIP-7702**. It lets an existing EOA delegate its
code to a smart-contract implementation while keeping the **same address**, the
same private key, the same ENS name, the same history and the same balances. A
7702-upgraded EOA can run a batch of calls atomically in one transaction, from
its own address. So the user does not need a Safe, does not need a 4337
counterfactual account, and does not need to move the WETH anywhere.

"An EOA does one call per transaction" describes the old EOA. It is no longer
true of what an EOA can be.

## Why the teammate's premise was true, and why it isn't anymore

- **Legacy EOA:** a transaction has one `to` and one `data`. Doing
  `approve` → `swap` → `approve` → `supply` takes several transactions, and
  they are not atomic. A router or helper contract doesn't fully fix this,
  because the user first has to send a separate `approve` transaction to it
  (WETH on mainnet has no `permit`). That is two confirmations, not one.
- **EIP-7702 (type-4 transaction):** the EOA signs an authorization
  `(chainId, delegateAddress, nonce)`. After that, the EOA's code slot points at
  `delegateAddress` (as `0xef0100 || address`). Calls to the EOA run that
  contract's code in the EOA's own context: `address(this)` and `msg.sender` to
  downstream protocols are the user's address. If the delegate exposes
  `execute(Call[])`, the whole batch is one transaction, and any revert rolls
  back every leg. That gives "both legs or neither" for free.

## The part the teammate missed that actually matters: the dynamic amount

Being atomic is not enough on its own. Most batch interfaces (EIP-5792
`wallet_sendCalls`, MetaMask's delegator `execute`, 4337 `executeBatch`) take
**static calldata**. Every call's arguments are fixed when the user signs. But
the Aave `supply(asset, amount, onBehalfOf, referralCode)` amount has to equal
whatever the swap returns, which is unknown until execution. Also, Aave V3
`supply` does **not** accept `type(uint256).max` as "use my whole balance".
Only `withdraw` and `repay` treat max specially.

So a naïve static batch can only supply `amountOutMinimum` and leaves the
slippage surplus sitting in the wallet. That breaks the "every USDC" requirement.
A Safe would have the same problem, so the teammate's proposal doesn't solve it
either.

The fix: put one small, stateless helper contract in the batch that reads the
real balance at execution time.

## What I would ship

**Transport:** EIP-5792 `wallet_sendCalls` with `atomicRequired: true`, sent to
MetaMask. MetaMask performs the 7702 upgrade to its own audited delegator
(MetaMask Smart Account) and shows the user one confirmation. The dapp **never**
asks the user to sign a 7702 authorization for a contract we wrote. Delegation
gives the delegate full control of the account, so the only delegate should be
the wallet's own vetted one. MetaMask won't let dapps request arbitrary
delegations anyway. If `wallet_getCapabilities` reports no atomic support on
this chain or account, fall back to a clearly labeled multi-step flow. Don't
silently do it non-atomically.

**The batch (2 calls, static calldata, one signature):**

1. `WETH.transfer(helper, 2e18)`
2. `helper.swapAndSupply(user, 2e18, amountOutMinimum, deadline)`

`SwapAndSupply` helper (immutable, no owner, no storage, holds nothing between
transactions):

```solidity
function swapAndSupply(address onBehalfOf, uint256 amountIn, uint256 minOut, uint256 deadline) external {
    require(block.timestamp <= deadline, "expired");
    WETH.forceApprove(address(SWAP_ROUTER_02), amountIn);
    uint256 out = SWAP_ROUTER_02.exactInputSingle(ISwapRouter02.ExactInputSingleParams({
        tokenIn: address(WETH), tokenOut: address(USDC), fee: 500,
        recipient: address(this), amountIn: amountIn,
        amountOutMinimum: minOut, sqrtPriceLimitX96: 0
    }));
    USDC.forceApprove(address(AAVE_POOL), out);
    AAVE_POOL.supply(address(USDC), out, onBehalfOf, 0); // aUSDC minted to the user's EOA
}
```

Why this shape:

- **Exact dynamic amount:** `out` is the swap's real return value, and all of
  it is supplied. No dust, no guessing.
- **The user grants zero approvals.** The account starts with no approvals and
  ends with none. The user only *transfers* exactly 2 WETH. The helper's own
  allowances to the router and the pool are exact and fully used up.
- **Atomic:** if the swap reverts (slippage below `minOut`, deadline passed) or
  the supply reverts (supply cap reached, reserve frozen or paused), the whole
  batch reverts, including the WETH transfer. Both legs or neither.
- **No front-running window:** the transfer and the helper call run inside one
  transaction, so nobody can grab the WETH from the helper in between.
- **The position belongs to the user's existing address:** `onBehalfOf = user`,
  so aUSDC and the Aave position sit on the ENS-named account.

Guardrails in the UI and build:
- Get `amountOutMinimum` from a fresh QuoterV2 quote, minus the slippage
  tolerance the user sees. Keep the deadline short. Pick the pool fee tier
  (0.05% is usually deepest for WETH/USDC) from the quote.
- Before building the batch, check Aave's USDC supply cap and the reserve's
  frozen and paused state, so we don't send the user a transaction that will
  certainly fail.
- Show gas on the confirmation. The first upgrade transaction costs a little
  more, because it includes the authorization. The user already holds ETH for
  gas, which is enough. No paymaster is needed.
- Get the helper audited and verified, and deploy it once per chain. It holds
  no funds between transactions and has no admin, so there's nothing in it for
  an attacker to steal.

## Reply to the teammate

> "One call per transaction" was true of EOAs until Pectra. With EIP-7702 the
> user's existing MetaMask EOA delegates to MetaMask's smart-account
> implementation and batches atomically from its **own address**. That means
> same ENS, same history, no migration, no new address. We send an EIP-5792
> `wallet_sendCalls` with `atomicRequired: true`. The real problem isn't
> atomicity, it's that the supply amount isn't known until the swap runs. A Safe
> has that problem too. We solve it with a stateless helper that swaps and
> supplies the actual output `onBehalfOf` the user in the same call. One
> confirmation, both legs or neither, and the user is left with zero approvals.

# Verdict on "this can't work from a plain EOA"

**No. The teammate is wrong, and the user keeps their address.** Their conclusion ("deploy a Safe or 4337 account, move the WETH, accept a new address") rests on two claims. Both are false today.

## 1. "An EOA does one call per transaction — that is what an EOA IS"

That stopped being true with **EIP-7702** (live on Ethereum mainnet since Pectra, May 2025). An existing EOA can sign an authorization that delegates its address to contract code. It then executes a batch of calls atomically in one transaction, and `msg.sender` for every call is still the user's address. There is no new address, no deployment, and no funds to move. The ENS name, the history and the WETH all stay where they are.

MetaMask supports this directly. The user upgrades the account to a "smart account" (MetaMask's audited 7702 delegator) in the wallet. The dapp then sends the batch with **EIP-5792 `wallet_sendCalls`** and `atomicRequired: true`. The user sees one confirmation, the calls run in one transaction, and they all succeed or all revert.

## 2. "Both legs or neither" needs a smart-contract wallet

It doesn't, even without 7702. Atomicity comes from putting both legs inside **one call**, and any EOA can make one call. A small, stateless helper contract can do this in a single function:

```
swapAndSupply(amountIn = 2e18, minUsdcOut, deadline):
  WETH.transferFrom(msg.sender, this, amountIn)
  out = SwapRouter.exactInputSingle(WETH→USDC, fee tier, recipient = this,
                                    amountIn, amountOutMinimum = minUsdcOut)
  USDC.approve(AavePool, out)
  AavePool.supply(USDC, out, onBehalfOf = msg.sender, 0)
```

If the swap reverts, the supply never runs. If the supply reverts (supply cap hit, reserve paused), the swap is rolled back as well. That is the "both or neither" guarantee.

## The part the verdict missed: the supply amount isn't known in advance

This is the real design constraint, and a naive 7702 batch doesn't solve it either. A plain `wallet_sendCalls` batch is a **static** list of calldata:

`[WETH.approve(router), router.exactInputSingle(...), USDC.approve(pool, ?), pool.supply(USDC, ?, user, 0)]`

The `?` is whatever the swap returns, and a static batch can't feed one call's return value into the next call's arguments. Aave V3 `supply` also does not treat `type(uint256).max` as "entire balance" (that convention only applies to `withdraw` and `repay`). Supplying `minUsdcOut` would leave the positive slippage sitting idle in the wallet, which breaks the "every USDC" requirement.

So something has to read the actual output on-chain. That is the helper above: it supplies exactly `out`, the value the swap returned. Two other options exist, and I'd reject both:
- **Write our own 7702 delegate with a `swapAndSupply` entrypoint.** This would put our unaudited code in control of the user's main account. The delegation also **persists** after the transaction until the user signs a new authorization to replace or clear it. That is far too much authority for a one-click feature.
- **A generic "dynamic calldata" executor as the delegate.** Same concern, plus more complexity.

## What I would ship

1. **`SwapAndSupply` helper contract.** It is stateless and has no owner, no upgradeability and no stored approvals. It pulls exactly `amountIn` from `msg.sender` and always supplies `onBehalfOf = msg.sender`, never to a caller-chosen address, so a bad parameter can't redirect funds. It enforces `amountOutMinimum` (from a fresh QuoterV2 quote minus the user's slippage) and a deadline. It reverts if anything is left over. It gets audited and tested on a mainnet fork, including forced revert paths on both legs.
2. **Primary path: EIP-7702 + EIP-5792 in MetaMask, one confirmation.** First call `wallet_getCapabilities`. If atomic is `supported` or `ready`, send:
   `wallet_sendCalls({ atomicRequired: true, calls: [ WETH.approve(helper, 2e18), helper.swapAndSupply(2e18, minUsdcOut, deadline) ] })`
   The approval is exact, not infinite, and `transferFrom` uses all of it, so no allowance is left behind. The delegate is MetaMask's own delegator, not ours. The user can later switch back to a standard account in MetaMask, which signs a clearing authorization.
3. **Fallback when atomic batching isn't available: two plain transactions from the same EOA.** First `WETH.approve(helper, 2e18)`, then `helper.swapAndSupply(...)`. Never degrade silently: `atomicRequired: true` makes the wallet refuse rather than run the calls one by one. The UI then tells the user this path needs two confirmations. The **swap and deposit are still atomic**, because they happen in one call. The only step that can land alone is an exact-amount approval to a stateless contract, which is harmless and can be revoked. (WETH9 has no `permit`, so the approval can't be folded into a signature.)
4. **Confirmation gate before signing.** Show: 2 WETH in; quoted USDC and the guaranteed minimum; the checksummed helper, router and Aave Pool addresses; that the aUSDC goes to the user's own address (with their ENS name); and the gas cost estimated and priced live. For the 7702 path, also state that the account will be upgraded to a MetaMask smart account, that this upgrade stays in place after this transaction, and how to undo it.

**Bottom line:** the user doesn't need a new address. EIP-7702 lets their two-year-old MetaMask EOA send the approve and the swap+supply as one atomic, one-click transaction. The unknown swap output is handled by a small stateless helper that supplies exactly what the swap returned. Without 7702 the same design still keeps swap and deposit atomic, at the cost of one extra harmless approval confirmation.

# Verdict on "one-click entry": the teammate is wrong

**Short answer:** No. The user does not need a new address. Since the Pectra upgrade (mainnet, 7 May 2025), **EIP-7702** lets an existing EOA delegate its execution to smart-account code *at the same address*. The user keeps the two-year-old MetaMask account, its ENS name, and its history. They sign one confirmation, and the swap and the supply either both land or both revert.

The teammate has spotted one real problem, though: the supply amount isn't known until the swap runs. Moving to a Safe or a 4337 account doesn't fix that. A different fix does, described below.

---

## 1. Where the verdict goes wrong

> "An EOA does one call per transaction — that is what an EOA IS."

That was true before Pectra. It isn't true now.

- **EIP-7702 (transaction type `0x04`)** adds an `authorization_list` to a transaction. Each entry is signed by an EOA and sets that EOA's code to a delegation designator (`0xef0100 || delegateAddress`). From then on, a call to the EOA runs the delegate's code in the EOA's own context: its address, storage, balance and token holdings.
- Authorizations are processed **before** execution, in the same transaction. So a single type-4 transaction can install the delegation *and* call `execute(batch)` on the EOA. The account doesn't have to "become" a smart account ahead of time.
- **MetaMask supports this already.** Its EIP-7702 delegator is its audited "MetaMask Smart Account" implementation. Dapps request it through **EIP-5792 `wallet_sendCalls`** with `atomicRequired: true`. The user sees one confirmation for the whole batch, and MetaMask decides which delegate to use, so the dapp never chooses the code that runs the user's account.
- **The batch is atomic.** The delegate's batch-execute reverts the whole call if any sub-call reverts. That gives the "both legs or neither" guarantee.

The Safe/4337 route is also *worse* on the requirement the teammate cares about. "Move the WETH into it" is a separate transaction that happens before the batch. The user gets a new address, more confirmations, and no gain in atomicity.

The claim is also imprecise in a smaller way. Even before 7702, an EOA's single call could go to a contract that does many things. The EOA's real limit was that it **couldn't grant a token approval and use it in the same transaction**. WETH9 has no `permit`, and this account has no approvals at all, including to Permit2. The approval is exactly the step that 7702 batching lets us fold in.

## 2. The real problem: the supply amount isn't known in advance

An EIP-5792 batch is a **static list of calls**. All calldata is fixed when the user signs. So this naive batch doesn't work:

```
1. WETH.approve(SwapRouter, 2e18)
2. SwapRouter.exactInputSingle(WETH→USDC, 2e18, minOut)   // returns amountOut: unknown at signing time
3. USDC.approve(AavePool, ???)
4. AavePool.supply(USDC, ???, user, 0)                      // needs the exact amount
```

Some tempting workarounds fail:

- **`supply(type(uint256).max)`**: Aave V3 accepts `uint256.max` as "everything" for `withdraw` and `repay`, but **not for `supply`**. It would try to pull 2²⁵⁶−1 USDC and revert.
- **Supplying `amountOutMinimum`** leaves any swap output above the minimum sitting unused in the wallet. That breaks "supply every USDC the swap returns".
- **Writing our own 7702 delegate that splices return data** means a custom contract with full control over the user's main account. We shouldn't write that, and MetaMask won't let a dapp install it anyway.

## 3. What I would ship

**One atomic EIP-5792 batch from the user's existing EOA, which calls a small, stateless, audited adapter contract. The adapter chains the swap output into the supply on-chain.**

### The batch (single confirmation, `atomicRequired: true`)

```
calls: [
  { to: WETH,    data: approve(SwapSupplyAdapter, 2e18) },                  // exact amount, never infinite
  { to: Adapter, data: swapAndSupply(2e18, minUsdcOut, fee=500, deadline) }
]
```

### The adapter (`swapAndSupply`)

```solidity
function swapAndSupply(uint256 wethIn, uint256 minOut, uint24 fee, uint256 deadline)
    external returns (uint256 usdcOut)
{
    require(block.timestamp <= deadline, "expired");
    WETH.safeTransferFrom(msg.sender, address(this), wethIn);   // only ever from msg.sender
    WETH.forceApprove(address(ROUTER), wethIn);
    usdcOut = ROUTER.exactInputSingle(ISwapRouter.ExactInputSingleParams({
        tokenIn: address(WETH), tokenOut: address(USDC), fee: fee,
        recipient: address(this), amountIn: wethIn,
        amountOutMinimum: minOut, sqrtPriceLimitX96: 0
    }));
    USDC.forceApprove(address(POOL), usdcOut);
    POOL.supply(address(USDC), usdcOut, msg.sender, 0);          // aUSDC minted to the user's EOA
}
```

This design meets each requirement:

- **Same address.** The aUSDC position is credited `onBehalfOf` the user's own EOA, which keeps its ENS name and history.
- **One confirmation.** The approval and the action go into one 7702-backed batch.
- **Both legs or neither.** If the swap misses `minOut`, or the deadline has passed, or Aave rejects the supply (cap reached, reserve paused), the adapter reverts. The batch then reverts, including the WETH approval. The user keeps 2 WETH and pays only gas.
- **Exact dynamic amount.** `usdcOut` is the router's actual return value and is passed directly to `supply`. Every USDC that comes out goes in.

### Safety details that must be in the PR

1. **Adapter safety.** Never `transferFrom` an arbitrary `from`; only `msg.sender`. This prevents the classic approval-drain bug. The adapter keeps no funds or approvals between calls, has no admin or upgrade path, is immutable, and must be audited or at least fork-tested thoroughly.
2. **Slippage.** Compute `minUsdcOut` from the Uniswap V3 Quoter just before signing, minus a tolerance the user can see (e.g. 0.5%). Add a short `deadline`. Show the user the minimum they will supply.
3. **Fail closed.** Call `wallet_getCapabilities` first. If `atomic` isn't `supported`/`ready` for this chain, **don't** fall back to sequential transactions, because that silently breaks the both-or-neither requirement. Show an "atomic batching unavailable" error instead.
4. **Tell the user about the delegation.** When MetaMask upgrades the account, the 7702 delegation **persists** after this transaction. It stays even if the batch reverts, until it is replaced or cleared. Tell the user this in the UI. The delegate is MetaMask's own audited implementation, and the user can switch the account back to a plain EOA from MetaMask.
5. **Verify addresses in code, don't hardcode them from memory.** On mainnet: WETH `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`, USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, Uniswap V3 SwapRouter02 `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`, Aave V3 Pool `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`. Check each against official deployments, checksum them with `getAddress`, and run the whole flow on an Anvil mainnet fork with a 7702-delegated account before any real funds move.

## 4. Reply to the teammate

> The premise is out of date. Since Pectra, EIP-7702 lets this exact MetaMask EOA run an atomic batch at its own address through `wallet_sendCalls` with `atomicRequired: true`. There's no new address, no migration and no fund transfer. The genuine blocker is the dynamic supply amount, and a Safe or 4337 account has the same problem because batch calldata is fixed at signing time. We fix it with a stateless adapter that feeds `exactInputSingle`'s return value into `Pool.supply(onBehalfOf = user)`. The batch is `[approve(adapter, 2 WETH), adapter.swapAndSupply(...)]`, and if atomic batching isn't available we fail closed. The user keeps their address.

# Does the user have to accept a new address?

**No. The verdict is wrong.** The user keeps their MetaMask address, ENS name and history. There is no Safe to deploy, no 4337 account, and no WETH to move.

## Where the teammate is right, and where they are wrong

They are right about the old model. Before Pectra, a plain EOA transaction ran a single top-level call. Swap-then-supply would have needed two transactions (plus approvals), with no guarantee that both land.

They are wrong that this is "what an EOA IS." Since the Pectra upgrade (May 2025), **EIP-7702** lets an existing EOA sign an authorization that delegates its address to contract code. After that, calls to the address run that code *in the EOA's own context*: same address, same balances, same `msg.sender` for downstream contracts. A delegate that implements batched execution runs several calls in one transaction. If any of them reverts, the whole transaction reverts. That is exactly "both legs or neither," from the address the user already has.

Wallets expose this through **EIP-5792 `wallet_sendCalls`** with `atomicRequired: true`. MetaMask supports it: the user sees one confirmation, and on first use MetaMask asks to upgrade the account to its own audited delegator contract. The dapp does not supply the delegate. The wallet does, which is the right way round.

The teammate is also wrong about the fallback. Even with a wallet that has no 7702 support, a new address is not needed. See "Fallback" below.

## The real problem: the deposit amount isn't known in advance

A `wallet_sendCalls` batch is a list of calls with **fixed calldata**. The USDC amount comes out of the swap at execution time, so we can't write `Pool.supply(USDC, amountOut, …)` into the batch beforehand. Three tempting shortcuts don't work:

- **Supply `amountOutMinimum`:** leaves dust in the wallet. That breaks "every USDC the swap returns."
- **Supply `type(uint256).max`:** Aave V3 `supply` does not treat max as "entire balance." Only `withdraw` and `repay` do. The call reverts.
- **Write our own 7702 delegate that pipes return values:** this puts custom code in permanent control of the user's two-year-old account. It's the highest-risk option, and MetaMask won't sign a dapp-chosen delegate anyway.

The fix is a tiny **stateless helper contract** that receives the swap output and supplies all of it on the caller's behalf:

```solidity
contract SupplyAllUSDC {
    IERC20 constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IPool  constant POOL = IPool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2); // Aave V3 Ethereum Pool

    function supplyAll() external {
        uint256 amt = USDC.balanceOf(address(this));
        require(amt > 0, "nothing to supply");
        USDC.forceApprove(address(POOL), amt);
        POOL.supply(address(USDC), amt, msg.sender, 0);   // aUSDC minted to the caller, never to an argument
    }
}
```

(Verify the addresses against Aave's and Circle's published deployments before shipping.)

## What I would ship

One `wallet_sendCalls` request, `atomicRequired: true`, from the user's existing address:

1. `WETH.approve(SwapRouter02, 2e18)`: an exact amount, not unlimited. It is used up in full by call 2, so no allowance is left behind. The account has no approvals today, and it still won't after this.
2. `SwapRouter02.exactInputSingle({tokenIn: WETH, tokenOut: USDC, fee: <best pool>, recipient: SupplyAllUSDC, amountIn: 2e18, amountOutMinimum: quote × (1 − slippage), sqrtPriceLimitX96: 0})`: the swap pays out straight to the helper. Take the quote live from the Uniswap Quoter just before signing, and add a deadline (via `multicall(deadline, …)`).
3. `SupplyAllUSDC.supplyAll()`: supplies whatever USDC the swap actually returned, with the aUSDC minted to `msg.sender`, which is the user's EOA.

All three calls run in one transaction. If the swap misses its minimum, or the supply reverts (paused reserve, supply cap reached), everything reverts and the user still holds 2 WETH.

Why this shape:

- The helper never holds funds between transactions, has no owner and no approvals, and can only credit its caller. Within the atomic batch, nobody can get between call 2 and call 3.
- The only persistent change to the account is the 7702 delegation to MetaMask's own delegator.

### Things the PR must also handle

- **Capability check first.** Call `wallet_getCapabilities` and proceed only if `atomic` is `supported` or `ready`. Never let the wallet fall back to sending the calls one by one. A non-atomic run could swap and then fail to supply, which breaks the user's requirement.
- **Say that the delegation persists.** The 7702 delegation is not scoped to this transaction. It stays until the user clears or replaces it with another signed authorization, even if this batch reverts. The UI should say so plainly, and should link to how to revert to a plain EOA in MetaMask.
- **Confirmation gate.** Before the prompt, show:
  - the amount in (2 WETH)
  - the quoted and minimum USDC
  - the checksummed router, helper and Aave pool addresses
  - live-estimated gas priced at the current ETH price

  The user only holds enough ETH for gas, so if the estimate exceeds their ETH balance, stop and say so.
- **Test on a mainnet fork.** Cover the happy path, a slippage revert (the user must end with 2 WETH and 0 aUSDC) and an Aave-cap revert. In every case, assert that no allowance is left behind.

## Fallback: wallets without 7702 atomic batching

Two confirmations, still the same address. The user sends one `approve(Zap, 2e18)`, which on its own moves no funds. Then one call to a zap contract pulls the WETH, swaps and supplies `onBehalfOf: msg.sender`, all in a single transaction. The swap and the deposit are still both-or-neither. The only cost is a second click. A new address is never required.

## Reply to the teammate

> The "one call per EOA transaction" limit ended with Pectra. With EIP-7702 plus `wallet_sendCalls` (`atomicRequired: true`), the user's existing MetaMask address runs approve → swap → supply as one atomic transaction behind a single confirmation. That keeps their address and ENS, needs no Safe, and moves no funds. The one real design problem is that the supply amount is only known at runtime. A stateless `supplyAll()` helper that receives the swap output handles that. Telling the user to abandon their address would be wrong.

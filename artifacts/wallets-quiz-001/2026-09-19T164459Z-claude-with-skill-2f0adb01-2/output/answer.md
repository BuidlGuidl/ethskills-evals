# Verdict on "one-click entry": the user does **not** have to accept a new address

**Short answer:** The teammate's conclusion is wrong, even though their starting point was true before May 2025. Since the Pectra hard fork (May 7, 2025), **EIP-7702** lets an existing EOA delegate its execution to audited smart-account code **while keeping the same address**. That means the same ENS name, the same history, and the same key in MetaMask. With that delegation, the EOA can run an atomic batch in a single transaction. Deploying a Safe or a 4337 account, then moving the WETH into it, is the heavier option and gives up the one thing the user said they won't give up.

There is one real catch that neither the PR nor the verdict deals with: **the amount to supply isn't known until the swap runs.** A plain batch of calls can't solve that by itself, because each call's arguments are fixed when the user signs. That is the part of the design that needs work, not the account type.

---

## 1. Where the teammate is right and where they're wrong

| Claim | Assessment |
|---|---|
| "An EOA does one call per transaction" | This was true for classic EOAs. It's no longer a hard limit: a type-4 (EIP-7702) transaction makes the EOA run delegated code, and that code can execute a batch of calls. |
| "…so atomicity needs a smart-contract wallet" | This is partly right, but the conclusion doesn't follow. Even a classic EOA's single call can go to a contract that does many things atomically. The only thing a classic EOA truly can't do in one transaction is **grant a token approval _and_ spend it**, because `approve` has to be sent *from* the EOA. The account has zero approvals and WETH has no EIP-2612 `permit`, so that approve step is the real obstacle. EIP-7702 removes it. |
| "Deploy a Safe, move the WETH, batch from there" | This works, but it's worse on every axis the user cares about. It needs extra transactions (deploy, then transfer, then execute). The user gets a new address with no ENS and no history. The aUSDC position sits in the Safe instead of on their identity. And it isn't "one confirmation" either. |
| "There is no way around it" | This is false. EIP-7702 has been live on mainnet since May 2025, and MetaMask supports it through its "smart account" upgrade plus EIP-5792 `wallet_sendCalls` with atomic execution. |

## 2. Why a naive 7702 batch still isn't enough

The obvious batch would be:

1. `WETH.approve(SwapRouter02, 2e18)`
2. `SwapRouter02.exactInputSingle({WETH→USDC, fee 500, amountIn 2e18, amountOutMinimum, recipient: self})`
3. `USDC.approve(Pool, X)`
4. `Pool.supply(USDC, X, self, 0)`

The problem is `X`. It has to be encoded before signing, but the requirement is "whatever the swap actually returns." Aave V3's `supply` has no "use my whole balance" option (`type(uint256).max` is special only for `withdraw` and `repay`), and a static batch can't pass one call's return value into the next. The workarounds all break the spec:
- Supplying `amountOutMinimum` leaves USDC dust in the wallet, so it doesn't supply "every USDC."
- Using `exactOutput` means you no longer swap exactly 2 WETH.
- Guessing high makes the transaction revert.

**Fix:** move the "read the balance, then supply it" logic into a small, stateless helper contract. The batch then calls that helper, so the amount is computed on-chain at execution time.

## 3. What I'd ship

**One MetaMask confirmation, sending one type-4 transaction from the user's existing address, that runs an atomic 2-call batch:**

```
call 1: WETH.approve(SwapAndSupply, 2e18)                 // exact amount, no infinite approval
call 2: SwapAndSupply.run(amountIn = 2e18,
                          amountOutMinimum = quote * (1 - slippage),
                          deadline, onBehalfOf = user)
```

`SwapAndSupply` is a minimal, immutable contract that holds no funds and has no owner or admin:

```solidity
function run(uint256 amountIn, uint256 minOut, uint256 deadline) external {
    WETH.transferFrom(msg.sender, address(this), amountIn);
    WETH.forceApprove(address(ROUTER), amountIn);
    uint256 out = ROUTER.exactInputSingle(ISwapRouter.ExactInputSingleParams({
        tokenIn: WETH, tokenOut: USDC, fee: 500, recipient: address(this),
        amountIn: amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0
    }));                                   // deadline is checked explicitly or via multicall(deadline, ...) on SwapRouter02
    USDC.forceApprove(address(POOL), out);
    POOL.supply(address(USDC), out, msg.sender, 0);   // aUSDC minted straight to the user's EOA
}
```

- **Atomicity:** if the swap falls below `minOut`, the supply fails (for example because of a supply cap or a paused reserve), or anything else reverts, the whole batch reverts. The user keeps their 2 WETH, pays only gas, and ends with no leftover allowance. It's both legs or neither.
- **Exact amount:** `out` is the swap's actual return value, so every USDC gets supplied. Nothing sits in the helper between calls, and `msg.sender` is always the user.
- **Same identity:** the user's EOA receives the aUSDC. The ENS name, history, and address stay the same.
- **Delegation target:** only MetaMask's own audited smart-account implementation (`EIP7702StatelessDeleGator`). The wallet won't let a dapp choose an arbitrary 7702 delegate, and we shouldn't try to. The frontend calls `wallet_getCapabilities`. If atomic batching is reported as `ready` or `supported`, it sends `wallet_sendCalls` with `atomicRequired: true`, and MetaMask prompts for the smart-account upgrade and the batch together. In the design doc, state plainly that the delegation **persists** after this transaction until the user switches it off. Also note that if the batch reverts, the authorization can still have been applied.

**Fallback for wallets without 7702/5792 support:** use two classic transactions: `WETH.approve(SwapAndSupply, 2e18)` followed by `SwapAndSupply.run(...)`. The swap and the deposit are still atomic, because they happen inside one call. The only thing lost is the "one confirmation" UX, and the first transaction by itself just grants an exact, harmless allowance. Even this fallback never needs a new address.

**Operational details the PR should include:**
- Get `amountOutMinimum` from QuoterV2 immediately before signing. Choose the pool fee tier explicitly (on mainnet, WETH/USDC 0.05% is the deepest).
- Send through a private or MEV-protected RPC.
- Check Aave's USDC supply cap and reserve status (not paused or frozen) before building the transaction.
- Show the user plain amounts, checksummed contract addresses, and gas.
- Test the full flow on an Anvil mainnet fork, including a 7702-delegated account, before shipping.
- Get the ~40-line helper reviewed or audited. It's small, but it sits in the path of the user's funds.

## Reply to the teammate

> You're right that a classic EOA can't approve and spend in one transaction, and that was the actual blocker here. EIP-7702 (live since Pectra, May 2025) removes it without migrating the account: the user's existing MetaMask address delegates to MetaMask's smart-account code and sends an atomic batch through `wallet_sendCalls`. The bigger problem in this PR is the one neither of us raised at first: the supply amount depends on the swap output, and a static batch can't encode that. So we'll add a small stateless `SwapAndSupply` helper that swaps and supplies its actual output `onBehalfOf` the user. The batch becomes an exact-amount approve plus `run()`, in one confirmation, both legs or neither, on the same address. No Safe, and no new address.

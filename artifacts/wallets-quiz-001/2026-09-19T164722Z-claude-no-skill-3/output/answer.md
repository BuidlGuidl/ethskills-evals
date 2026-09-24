# Review response: "one-click entry" from a plain EOA

## Short answer

**No, the user does not need a new address.** The verdict was correct before
Pectra. It stopped being correct when Pectra activated on mainnet (May 2025)
and shipped **EIP-7702**. Under 7702 an existing EOA signs an authorization
that points its account at delegate contract code. After that, one transaction
sent **from the same address** can run a batch of calls atomically: if any call
reverts, the whole transaction reverts. The address, private key, ENS name,
history and nonce all stay the same. No Safe, no new 4337 account, and the WETH
never moves to another address.

So the answer to "tell the user to accept the new address" is: don't. Upgrade
the address they already have in place.

## Where the teammate is right, and where they go wrong

- **Right:** a legacy EOA transaction (types 0, 1 and 2) makes exactly one
  top-level call. This user has **no approvals**, and plain WETH9 has no
  `permit`, so nobody can pull their WETH without an `approve` first. Before
  7702 that meant at least two transactions: `approve`, then a router or helper
  call. The approval would sit on-chain between them, and the pair would not be
  atomic. The teammate is also right that a smart-account code path is needed.
- **Wrong:** the idea that smart-account behaviour needs a *different address*.
  7702 gives the EOA's own address that code path. It adds a new transaction
  type (type 4, `SET_CODE_TX`). MetaMask exposes this as the "smart account"
  upgrade. Dapps reach it through **EIP-5792 `wallet_sendCalls`**, and the user
  confirms it once.

## The part the PR must still get right: the amount isn't known in advance

A simple static batch can't do this directly:

```
1. WETH.approve(SwapRouter02, 2e18)
2. SwapRouter02.exactInputSingle(WETH→USDC, amountIn=2e18, recipient=user, amountOutMinimum=minOut)
3. USDC.approve(AavePool, ???)
4. AavePool.supply(USDC, ???, onBehalfOf=user, 0)
```

The calls in a `wallet_sendCalls` batch are fixed ABI calldata. Call 4 can't
read call 2's return value. Aave V3 `supply` also does **not** accept
`type(uint256).max` as "everything I have". That sentinel only works for
`withdraw` and `repay`. If we guess a number, we either leave USDC dust or
revert. Using the user's current USDC balance is also wrong, because the user
may already hold some USDC.

**Fix:** have the swap send its output to a small stateless helper, then have
the helper supply its entire balance on the user's behalf in the same batch:

```
1. WETH.approve(SwapRouter02, 2e18)
2. SwapRouter02.exactInputSingle({
       tokenIn: WETH, tokenOut: USDC, fee: <chosen pool>,
       recipient: SupplyHelper, amountIn: 2e18,
       amountOutMinimum: minOut,          // quote × (1 − slippage); never 0
       sqrtPriceLimitX96: 0 })
3. SupplyHelper.supplyAll()              // reads its own USDC balance
```

```solidity
contract SupplyHelper {
    IPool  immutable pool;  IERC20 immutable usdc;
    function supplyAll() external {
        uint256 amt = usdc.balanceOf(address(this));
        require(amt > 0, "nothing to supply");
        usdc.forceApprove(address(pool), amt);
        pool.supply(address(usdc), amt, msg.sender, 0); // aUSDC minted to the user's EOA
    }
}
```

- The supplied amount is exactly what the swap returned. No estimate is
  involved, and none of the user's existing USDC is touched.
- The whole flow runs in one transaction, so nobody can call `supplyAll`
  between steps 2 and 3. `onBehalfOf` is hard-wired to `msg.sender`, which is
  the user's EOA. The helper holds nothing between transactions.
- If the swap falls below `minOut`, or the Aave supply fails (supply cap
  reached, reserve paused or frozen), the whole batch reverts. The user keeps
  the 2 WETH and loses only gas. That is "both legs or neither".
- The WETH approval is exact (2e18) and is fully used up by the swap. The EOA
  never gives the helper an approval at all.

(Another option is to put the "supply what I received" logic inside the 7702
delegate itself, for example MetaMask's Delegation Framework with a custom
executor. A 20-line helper is simpler to audit and works with any
5792-compliant wallet, so I'd ship the helper.)

## What I would actually ship

1. **Frontend:** call `wallet_getCapabilities` and check that `atomic.status`
   is `"supported"` or `"ready"` on the chain. `"ready"` means MetaMask will
   offer the one-time smart-account upgrade in the same confirmation. Then send
   the 3 calls above with `wallet_sendCalls` and `atomicRequired: true`. Track
   the result with `wallet_getCallsStatus`.
2. **Delegate:** use the wallet's own audited 7702 implementation, which is
   MetaMask's smart account. We should **not** ask the user to sign a 7702
   authorization to a contract we wrote. A 7702 delegation has full control of
   the account and stays in place until it is changed, so choosing that code is
   the wallet's job, not the dapp's.
3. **Contract:** the stateless `SupplyHelper` above, audited and deployed at a
   fixed address.
4. **Safety parameters:** `amountOutMinimum` comes from a fresh QuoterV2 quote
   minus user-visible slippage. Before sending, check the Aave reserve's supply
   cap and paused/frozen flags so the user doesn't pay for a batch we already
   know will revert. Gas is paid in ETH from the same EOA, which the user
   already holds, so no paymaster is needed.
5. **Fallback:** if the wallet can't do atomic batches (older wallet, hardware
   setup that refuses 7702, unsupported chain), **don't** switch to a new
   address. Show the honest non-atomic flow instead: (a) `approve` WETH to the
   helper for exactly 2e18; (b) a single helper call that pulls the WETH,
   swaps, and supplies the actual output `onBehalfOf` the user, all in one
   transaction. Step (b) is itself all-or-nothing, so the only non-atomic part
   is a bounded approval. The UI should say plainly that this is two
   confirmations.

**Verdict on the review:** request changes to the *verdict*, not the design.
We need atomic batching from the user's existing address. That is exactly what
EIP-7702 + EIP-5792 provide, and the swap-output-to-supply problem is solved
by routing the output through a stateless helper. The user keeps their
two-year-old address, their ENS name and their history.

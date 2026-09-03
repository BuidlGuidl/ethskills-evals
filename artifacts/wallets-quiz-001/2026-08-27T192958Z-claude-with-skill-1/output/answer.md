# Re: "there is no way around it"

## Verdict

**No. The user does not have to accept a new address.** The premise is out of date.

> "An EOA does one call per transaction — that is what an EOA IS."

That was true until Pectra. Since May 2025, EIP-7702 has been live on Ethereum
mainnet: an EOA can sign an *authorization* that delegates its address to
contract code, and a single type-4 transaction can carry that authorization and
then execute a batch through it. Same address, same ENS, same history, no Safe
deployed, no WETH moved anywhere. Atomicity comes from the batch executor
reverting the whole transaction if any inner call fails — exactly the "both legs
or neither" the design asks for.

So the migration is unnecessary, and for this user it is actively worse: a new
Safe means a deploy transaction, a WETH transfer (a second signed transaction
that is *not* atomic with anything), a fresh address with no history, and an ENS
record to repoint. Every cost the user objected to, incurred to solve a problem
that no longer exists. Note also that Safe itself ships a 7702 delegate — even if
you want Safe's semantics, you can have them *at the existing address*.

## But the teammate is missing the part that is actually hard

The interesting constraint in this PR is not batching. It is this line:

> The supplied amount is whatever the swap actually returns; it is not known
> before the transaction runs.

EIP-7702 does not fix that on its own. A batch executor takes a list of
`(target, value, calldata)` with **static calldata, encoded before signing**. It
does not pipe call N's return value into call N+1. So the naive batch

```
1. WETH.approve(SwapRouter02, 2e18)
2. SwapRouter02.exactInputSingle(... amountIn: 2e18 ...)   -> returns amountOut
3. USDC.approve(AavePool, ???)                             <- unknown at sign time
4. AavePool.supply(USDC, ???, onBehalfOf: EOA, 0)          <- unknown at sign time
```

cannot be encoded. And the usual escape hatch is closed: **Aave V3's `supply`
does not accept `type(uint256).max` as "all of it."** (`withdraw` and `repay` do;
`supply` requires a literal amount and validates it against the supply cap.)

That is the real design problem, and it needs one more piece.

## What I would ship

**EIP-7702 batch + one tiny, stateless, immutable helper contract for the
dynamic leg.** A helper contract is not a wallet: it holds nothing, owns nothing,
has no admin, and never appears as the user's address. The user's account is
untouched.

### 1. The helper (~30 lines, immutable, no owner, no storage)

```solidity
// Holds no funds between transactions. Not custody. Deliberately permissionless.
contract SupplyAllToAave {
    IERC20  public constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IPool   public constant POOL = IPool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2);

    /// Supplies this contract's entire USDC balance to Aave V3, crediting `onBehalfOf`.
    function supplyAll(address onBehalfOf, uint256 minAmount) external {
        uint256 bal = USDC.balanceOf(address(this));
        require(bal >= minAmount, "short");
        USDC.approve(address(POOL), bal);              // exact, fully consumed
        POOL.supply(address(USDC), bal, onBehalfOf, 0); // aUSDC -> the user's EOA
    }
}
```

`balanceOf` at execution time *is* "every USDC the swap returned" — the value
that could not be known at signing time is read on-chain instead of encoded.

### 2. The batch (3 calls, static calldata, atomic)

```
1. WETH.approve(SwapRouter02, 2_000000000000000000)
2. SwapRouter02.exactInputSingle({
       tokenIn: WETH, tokenOut: USDC, fee: 500,
       recipient: SupplyAllToAave,          // <- swap output lands in the helper
       amountIn: 2e18,
       amountOutMinimum: minOut,            // live quote minus slippage tolerance
       sqrtPriceLimitX96: 0 })
3. SupplyAllToAave.supplyAll(userEOA, minOut)
```

Everything is knowable at sign time. All three calls run inside one transaction,
so the helper's balance cannot be observed or touched by anyone between calls 2
and 3 — there is no interleaving within a transaction. `onBehalfOf: userEOA`
means the aUSDC position is owned by the same ENS-named address, which is the
whole point of the exercise.

Note that this batch, from a *plain* EOA, would be two transactions minimum
(`approve`, then the zap) — WETH9 has no `permit`, and routing through Permit2
would itself need a first-time approval, which this account does not have. The
7702 batch is what collapses it to one.

### 3. Requesting it from the wallet

Do **not** hand-roll the type-4 transaction or hardcode a delegate address. The
user is on MetaMask, which supports EIP-7702 account upgrade and speaks
EIP-5792. Let the wallet pick its own audited delegate:

```js
const caps = await provider.request({
  method: "wallet_getCapabilities", params: [account, ["0x1"]]
});
if (caps["0x1"]?.atomic?.status !== "supported") { /* fall back, see below */ }

await provider.request({
  method: "wallet_sendCalls",
  params: [{
    version: "2.0.0",
    chainId: "0x1",
    from: account,
    atomicRequired: true,           // non-negotiable: reject partial execution
    calls: [approveWeth, swap, supplyAll]
  }]
});
```

`atomicRequired: true` plus a capability status of `supported` (not `ready`, not
`unsupported`) is what makes "both legs or neither" a guarantee rather than a
hope. If you ever *do* build the batch yourself, use the executor's
revert-on-failure batch mode, not an `allowFailure` / try-catch mode — the latter
will happily land leg one and swallow leg two.

## What the user has to be told before they sign

**The delegation persists.** This is the biggest thing the PR should surface and
the one genuinely new risk being introduced. After this transaction the account
is no longer a plain EOA: it has code, permanently, until a *new* signed
authorization replaces it or clears it to `address(0)`. It is not scoped to this
transaction, and if the inner batch reverts the delegation can still be left
standing. Decommissioning the delegate contract does nothing. Practically:

- The delegate's bugs become the user's bugs, for every future transaction. Use
  the wallet's own audited delegate; do not point a two-year-old account at
  something you wrote this week.
- Ship the undo path in the same PR, not later: a one-click "revert to plain EOA"
  that signs an authorization to `address(0)`. If a user cannot get out, do not
  ship the door.
- Pin `chainId: 1` in the authorization. Never sign `chainId: 0` — that is valid
  on every chain, on any chain where this address exists.

**Gas.** The brief says the account holds "only enough ETH to pay gas." Check
that against this batch before promising one click: the authorization alone is
~12.5k–25k, plus approve (~46k), plus a V3 swap (~120–180k), plus a first-time
Aave supply (~200–250k, it initialises the user's reserve config and mints
aTokens). Call it ~450–600k gas. That is 15–20× a plain transfer and it may not
fit. Estimate it live against a fork and price it live — never from a remembered
ETH price — and if the balance is short, say so up front rather than letting the
user watch it fail.

**Approvals.** The account currently has none, which is a good posture. Keep it:
approve exactly 2e18 to the router, not infinite. The swap consumes it, so
residual allowance is zero and the account ends the day as clean as it started.
The helper's approval to Aave is the *helper's*, not the user's.

**The confirmation.** Be precise in the PR copy: it is one transaction and one
atomic outcome. The first time, MetaMask will also show a one-time account-upgrade
notice in that same flow. Claiming a bare "one click" and then showing an upgrade
prompt is how you lose the user at the exact moment you need their trust. And
per our own rule for anything that moves funds: print the amount, the checksummed
destination, and the live gas cost, then stop until the user says yes.

## Fallbacks, in order

1. **Wallet doesn't report atomic support.** Do not silently degrade to two
   transactions — that is precisely the failure mode the user asked you to
   prevent. Either block with an explanation, or offer (2).
2. **Static-batch variant.** `exactOutputSingle` with a fixed `amountOut` and
   `amountInMaximum: 2e18` makes the USDC amount known at sign time, so the whole
   batch is static and no helper is needed. Cost: it does not spend *all* the
   WETH; a remainder is left behind. That violates the stated requirement, so
   it is a fallback, not the design.
3. **A new smart-contract wallet.** The teammate's plan. Correct as a last
   resort, wrong as a first one, and worth noting that Safe's own 7702 delegate
   would give the same batching at the existing address anyway.

## Summary

The teammate is right that a plain EOA, as of 2024, could not do this. They are
wrong that it still can't, and wrong that the answer is a new address. They also
skipped the only genuinely hard constraint in the brief — the runtime-determined
amount — which no wallet migration solves either; a Safe batch has exactly the
same static-calldata problem and would need the same helper.

Ship: **EIP-7702 via `wallet_sendCalls` with `atomicRequired: true`, three calls,
one immutable balance-reading helper, an explicit revert-to-EOA undo, and honest
copy about the persistent delegation and the gas.** Test it against a mainnet
fork before it touches the user's 2 WETH.

---

*Contract addresses above (WETH, USDC, SwapRouter02 `0x68b3...Fc45`, Aave V3 Pool)
should be verified against the official deployment registries at implementation
time rather than trusted from this document.*

# Re: "they need a smart-contract wallet, tell the user to accept the new address"

**No. The verdict is wrong, and it's wrong twice over.** The user keeps their
address, their ENS, and their history. Nobody deploys a Safe. Nobody moves the
WETH anywhere.

Two separate mistakes are bundled into that review, and it's worth pulling them
apart because they fail for different reasons.

---

## Mistake 1: conflating "one call" with "one operation"

> "An EOA does one call per transaction — that is what an EOA IS."

The first half is true and the conclusion drawn from it does not follow. An EOA
transaction has one *top-level* call. That call has an **unbounded call tree**
underneath it, and the whole tree is atomic — one revert anywhere unwinds all of
it. That is the EVM's execution model, not a smart-wallet feature.

So "the swap and the deposit land together or not at all" has never required a
smart-contract wallet. It requires *one contract that does both*. This is what
every zapper, every DEX aggregator, and every leveraged-position router on
Ethereum has been doing from EOAs since 2020. `1 EOA tx → router → {Uniswap,
Aave}` is atomic by construction.

If atomicity were really impossible from an EOA, Uniswap's own multi-hop swaps
would be impossible — a multi-hop swap is several pool calls that must all land
or none.

## Mistake 2: missing the constraint that actually bites

The genuinely hard part of this setup isn't atomicity. It's the sentence the
teammate skipped: **"That account has no token approvals to anything."**

Canonical WETH9 has no `permit` (no EIP-2612, no `transferAndCall`). Permit2
doesn't rescue us either — using Permit2 requires a one-time
`WETH.approve(Permit2, max)`, which is itself a transaction. So to get 2 WETH out
of a virgin EOA and into *any* contract, you need an `approve` first. From a
pre-Pectra EOA that is a second top-level call, i.e. a second confirmation.

That, and only that, is the real obstacle to the "single confirmation" line item.
Note that it bites a plain swap too: from this account, `approve` + `swap` is
already two confirmations. The Aave leg adds nothing to the difficulty.

And the teammate's own prescription doesn't clear it either — "move the WETH into
[the Safe]" is a transfer transaction from the EOA, which is *also* an extra
confirmation, on top of deploying the Safe, on top of abandoning the address. The
proposed cure costs more confirmations than the disease.

## What removes the last obstacle: EIP-7702

Live on mainnet since Pectra (May 2025). The user signs an authorization tuple
`(chain_id, delegate_address, nonce)` with their existing key; the protocol writes
a 23-byte delegation indicator `0xef0100 ‖ delegate` as the *code of their
existing account*. Same address. Same nonce. Same balance. Same ENS. Same
two-year history. The account now executes the delegate's logic — including
`executeBatch` — while remaining the same account.

This is the direct refutation of "that is what an EOA IS." As of Pectra, it
isn't. An EOA can batch, at its own address, with no migration and no new
address.

## Mistake 3 (the one nobody in the thread has caught yet)

> "The supplied amount is whatever the swap actually returns; it is not known
> before the transaction runs."

**Batching alone does not solve this**, and the teammate's Safe prescription
solves it even less. Safe's `MultiSend` and ERC-4337's `executeBatch` both take
*static calldata*. You cannot write `supply(USDC, <whatever leg 1 returned>)`
into a static batch — the number doesn't exist at signing time. Quote it,
hardcode it, and you either revert (quoted high) or strand dust (quoted low).

Return-value chaining between batch entries is not a thing in stock Safe or stock
4337. So the reviewer's plan, followed literally, produces a broken batch at a
brand-new address.

The fix is the same in every architecture: one small stateless adapter that reads
the realized amount **at execution time**. Which brings us back to the point that
the composition contract was always the load-bearing piece, and the wallet type
was never the question.

---

# What I would ship

## 1. A ~40-line stateless adapter (the atomic unit)

The whole flow lives inside one contract call, so atomicity is guaranteed by the
EVM regardless of what the wallet supports. It resolves the swap output at
runtime via `balanceOf`, so the unknown amount is a non-issue.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20}    from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee; address recipient;
        uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata p)
        external payable returns (uint256 amountOut);
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)
        external;
}

/// @notice Swap an exact amount of tokenIn for tokenOut on Uniswap V3 and supply
///         100% of the realized proceeds to Aave V3 on behalf of the caller.
///         Holds no balances between transactions; grants no persistent approvals.
contract SwapAndSupplyAdapter {
    using SafeERC20 for IERC20;

    ISwapRouter02 public immutable router;
    IAavePool     public immutable pool;

    error Expired();
    error NothingReceived();

    constructor(ISwapRouter02 _router, IAavePool _pool) {
        router = _router;
        pool   = _pool;
    }

    function swapAndSupply(
        address tokenIn,
        address tokenOut,
        uint24  fee,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external returns (uint256 supplied) {
        if (block.timestamp > deadline) revert Expired();

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(address(router), amountIn);

        router.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn:           tokenIn,
                tokenOut:          tokenOut,
                fee:               fee,
                recipient:         address(this),
                amountIn:          amountIn,
                amountOutMinimum:  minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );

        // The number the reviewer said we can't know: we read it, we don't predict it.
        supplied = IERC20(tokenOut).balanceOf(address(this));
        if (supplied == 0) revert NothingReceived();

        IERC20(tokenOut).forceApprove(address(pool), supplied);
        // onBehalfOf = the user's original EOA — aTokens are minted to the address
        // they refused to abandon.
        pool.supply(tokenOut, supplied, msg.sender, 0);
    }
}
```

Design notes:

- `balanceOf(address(this))` rather than the router's return value, so any
  fee-on-transfer or rounding behavior is captured and nothing is left stranded.
  Reading the *adapter's* balance, not the user's, also means we never sweep
  USDC the user already held.
- `minAmountOut` on the swap is the real slippage guard; `NothingReceived` is a
  backstop. Add a `minSupplied` parameter if you want the invariant restated at
  the Aave boundary.
- Stateless and unprivileged. It never holds a balance across transactions and
  never holds an approval across transactions, so there is nothing to steal
  between blocks. Anything accidentally sent to it directly is a donation to the
  next caller — document that, and don't add a sweep function that creates
  privilege.
- Deploy immutable, unowned, unpausable. No proxy. Verify on Etherscan. This is a
  small enough surface for a focused audit; it is meaningfully smaller than the
  surface the reviewer proposed adding (a whole Safe deployment plus module
  configuration).

## 2. EIP-7702 for the single confirmation

Ask the wallet for batching rather than hand-rolling the delegation — MetaMask
ships 7702 smart-account support and EIP-5792, so let it pick and manage its own
audited delegate:

```js
// Feature-detect first. Never assume.
const caps = await provider.request({
  method: "wallet_getCapabilities",
  params: [account, ["0x1"]],
});
const canBatchAtomically = caps?.["0x1"]?.atomic?.status === "supported";
```

If supported, send the batch and **require** atomicity:

```js
await provider.request({
  method: "wallet_sendCalls",
  params: [{
    version: "2.0.0",
    chainId: "0x1",
    from: account,                 // unchanged. same ENS. same history.
    atomicRequired: true,          // the wallet must refuse rather than split these
    calls: [
      { to: WETH,    data: encodeApprove(ADAPTER, TWO_WETH) },
      { to: ADAPTER, data: encodeSwapAndSupply(WETH, USDC, 500, TWO_WETH, minOut, deadline) },
      { to: WETH,    data: encodeApprove(ADAPTER, 0n) },   // belt and braces
    ],
  }],
});
```

`atomicRequired: true` is doing real work: it forbids the wallet from silently
degrading to two sequential transactions. Either we get the all-or-nothing
semantics the user asked for, or we get an explicit failure to handle.

The trailing `approve(..., 0)` is technically redundant — `safeTransferFrom` pulls
exactly `amountIn` and the router allowance is consumed — but this user
specifically values having zero standing approvals, and the batch is the one
place we can guarantee that ends true. Cheap insurance, and it honors a stated
preference rather than arguing with it.

## 3. Fallback: two confirmations, still one address

If `wallet_getCapabilities` reports no atomic support (older wallet, unsupported
chain, user declined the account upgrade), degrade to:

1. `WETH.approve(ADAPTER, 2e18)`
2. `ADAPTER.swapAndSupply(...)`

Two confirmations, **the same adapter, the same address, and the money legs still
strictly atomic** — the swap and the supply remain inside a single transaction.
The only thing lost is a click. Nothing is lost that the reviewer's plan would
have preserved: their plan costs a deploy, a transfer, a new address, *and* still
lands on a batch that can't express the unknown amount.

Frame this in the UI as "approve WETH" → "enter position," not as a failure.

---

# Caveats I'd put in the PR description, not bury

These are real and the team should decide on them explicitly:

- **7702 delegation is persistent.** The code stays set at the address until
  replaced or revoked (sign an authorization for `address(0)`). After the
  upgrade the account is a smart account for every dapp it touches, forever, not
  just for our flow. The user should be told this in plain language before the
  first confirmation, not discover it later.
- **Sign the authorization with the real `chain_id`.** `chain_id = 0` makes the
  delegation valid on *every* chain. Never do that here.
- **Self-sponsored 7702 nonce gotcha.** If the EOA sends its own type-0x04
  transaction, the transaction nonce increments before the authorization list is
  processed, so the authorization must use `nonce + 1`. If we ever hand-roll the
  delegation instead of going through the wallet, this is where it breaks.
- **The key still controls everything.** 7702 is not a security upgrade. A
  compromised key is a compromised smart account. Don't let the "smart account"
  framing imply otherwise in the UI.
- **The delegate runs with the account's full authority.** One more reason to use
  the wallet's own audited delegate rather than shipping our own.
- **Existing code at the address changes how other contracts see it.** Anything
  doing `msg.sender == tx.origin` or `code.length == 0` checks will now classify
  this account differently. Uniswap V3 and Aave V3 are fine. Worth a note for
  whatever we integrate next.
- **First-run UX is honestly not one click.** MetaMask typically shows an
  account-upgrade prompt the first time. It's one *transaction*, and every
  subsequent batch is genuinely one confirmation since the delegation persists.
  Don't promise "one click" for the first run in marketing copy.
- **Gas.** The account holds only enough ETH for gas, and a 7702 batch costs more
  than a bare swap — the authorization itself is `PER_EMPTY_ACCOUNT_COST` on top
  of the calls. Check the balance against a live estimate before offering the
  one-click path and fall back to the two-step if it's tight, rather than letting
  them sign into an out-of-gas revert. A sponsored relayer is an option later.
- **MEV.** 2 WETH through the 0.05% pool is a sandwichable size. `minAmountOut`
  bounds the loss; offer a private-mempool submission path if we want to do
  better than bound it.
- **Verify every address against the live deployment registries before ship** —
  Uniswap `SwapRouter02`, the Aave V3 mainnet `Pool` (use the
  `PoolAddressesProvider`, don't hardcode the `Pool`, it's upgradeable), USDC,
  WETH9. Also confirm the WETH/USDC fee tier with a live quote rather than
  assuming 500 is deepest on the day.

---

# Summary

| Claim | Verdict |
|---|---|
| "An EOA does one call per transaction" | True, and irrelevant — one call, unbounded atomic call tree. |
| "Both legs or neither requires a smart-contract wallet" | **False.** One adapter contract call has always given this. |
| "As of Pectra an EOA can't batch" | **False.** EIP-7702, same address. |
| "Deploy a Safe / 4337 account" | Unnecessary, and doesn't solve the runtime-amount problem either. |
| "Tell the user to accept the new address" | **No.** Nothing here requires it. |
| "There is no way around it" | There are two ways around it, and one of them predates 7702 by five years. |

The user keeps `their.eth`. Ship the adapter plus `wallet_sendCalls` with
`atomicRequired: true`, and keep the approve-then-call path as the documented
fallback.

The one thing the reviewer got right is that the composition has to happen
*somewhere* other than in a sequence of independent EOA transactions. They just
reached for the most expensive possible place to put it — and for a batching
primitive that can't express "supply whatever the swap returned" anyway.

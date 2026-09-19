# Re: "This can't work from a plain EOA — accept a new address"

## Short answer

**No, the teammate is wrong. The user keeps their address.** Their premise
("an EOA does one call per transaction — that is what an EOA IS") has been out
of date since the **Pectra hard fork (7 May 2025)**, which shipped **EIP-7702**.
With EIP-7702 an EOA can set its code to point at a smart-account
implementation while keeping the same address, private key, ENS name, nonce
history and balances. After that, it can run a batch of calls atomically in one
transaction. That is exactly the "smart-contract wallet" behaviour the teammate
wants, just without moving to a new address.

Batching alone doesn't finish the job, though. The second leg's amount is
**not known until the first leg runs**, and a plain static batch can't handle
that. I explain that below and give a design that handles both problems.

---

## 1. Where the verdict goes wrong

| Claim | Reality |
|---|---|
| "An EOA does one call per transaction" | Only true for an EOA with no code. Under EIP-7702 the EOA signs an authorization that delegates its code to a contract. Calls to the EOA then run that contract's logic in the EOA's own context, with `address(this)` and `msg.sender` equal to the user's address. A batch executor there can make N calls, and if any call reverts, they all revert. |
| "They need a smart-contract wallet" | They need smart-account *behaviour*. EIP-7702 puts it on the existing address. MetaMask already supports this: it upgrades accounts to its audited EIP-7702 delegator ("smart account") and exposes batching through EIP-5792 `wallet_sendCalls`. |
| "Deploy a Safe, move the WETH into it, batch from there" | This doesn't even meet the stated requirement. Moving the WETH is its own transaction and confirmation, so the flow is no longer one click. The resulting Aave position, aUSDC balance and history also live at a new address, which is the one thing the user said no to. |
| "There is no way around it" | EIP-7702 is the way around it, and it's live on mainnet. |

One small point: the verdict is partly right. **Without** EIP-7702, and with no
approvals in place, a legacy EOA can't do this in one confirmation. WETH9 has no
`permit`, and Permit2 needs an earlier `approve` to Permit2. So the old flow
would be "approve, then call" at best. The fix is to change the account's
*code*, not its *address*.

## 2. The real hard part: the amount isn't known in advance

A naïve EIP-7702 / `wallet_sendCalls` batch looks like this:

1. `WETH.approve(SwapRouter, 2e18)`
2. `SwapRouter.exactInputSingle(WETH→USDC, 2e18, recipient = user, amountOutMinimum = q)`
3. `USDC.approve(AavePool, ???)`
4. `AavePool.supply(USDC, ???, user, 0)`

`wallet_sendCalls` batches are **static calldata**. Every argument is fixed
when the user signs. The swap's output only exists at execution time, and
**Aave V3's `Pool.supply` does not accept `type(uint256).max` as "use my whole
balance"**. That sentinel only works for `withdraw` and `repay`. So you can't
fill in `???` from inside a static batch. The obvious workarounds are wrong:

- Supplying `amountOutMinimum` leaves the slippage surplus as loose USDC in the
  wallet. That breaks "supply every USDC the swap returns".
- Supplying a guessed quote reverts whenever the actual output comes in lower.
- Sending two transactions breaks atomicity.

So the operation needs **one piece of on-chain logic that reads the swap's
real output and passes it to `supply`**.

## 3. What I would ship

**EIP-7702 batch from the user's existing MetaMask account, whose last call is
a small stateless "swap-and-supply" helper contract.**

### The helper (audited, immutable, holds nothing between transactions)

```solidity
// Sketch — not production code; needs audit, tests on a mainnet fork.
function swapAndSupply(
    uint256 amountIn,
    uint256 amountOutMinimum,
    uint24  fee,          // e.g. 500 for the 0.05% WETH/USDC pool
    uint256 deadline
) external returns (uint256 supplied) {
    WETH.safeTransferFrom(msg.sender, address(this), amountIn);
    WETH.forceApprove(address(SWAP_ROUTER), amountIn);

    supplied = SWAP_ROUTER.exactInputSingle(ISwapRouter.ExactInputSingleParams({
        tokenIn: address(WETH), tokenOut: address(USDC), fee: fee,
        recipient: address(this), deadline: deadline,
        amountIn: amountIn, amountOutMinimum: amountOutMinimum,
        sqrtPriceLimitX96: 0
    }));                                   // actual output, known only now

    USDC.forceApprove(address(AAVE_POOL), supplied);
    AAVE_POOL.supply(address(USDC), supplied, msg.sender, 0); // aUSDC -> user
}
```

- Swap output goes to the helper. The helper then supplies **exactly that
  amount** to Aave with `onBehalfOf = msg.sender`, so the aUSDC and the Aave
  position are credited to the user's existing address.
- The helper has no owner and no storage, and it can't be upgraded. It ends
  every call with zero balances, and it can only pull WETH from `msg.sender`.

### The user's single confirmation

One `wallet_sendCalls` (EIP-5792) request with **`atomicRequired: true`**:

1. `WETH.approve(helper, 2e18)`: an exact amount, not unlimited.
   `transferFrom` uses all of it, so no leftover allowance remains.
2. `helper.swapAndSupply(2e18, amountOutMinimum, 500, deadline)`

MetaMask sends this as an EIP-7702 (type-4) transaction. If the account isn't
upgraded yet, MetaMask includes the authorization in the same transaction. The
user sees one confirmation and pays gas with the ETH they already hold, so no
bundler or paymaster is needed. If the swap fails, slippage is exceeded, the
deadline passes, or Aave reverts (supply cap, paused reserve), the **whole
batch reverts**. The user still has their 2 WETH and no allowance. **Both legs
or neither.**

### Parameters and guardrails

- `amountOutMinimum` comes from a fresh QuoterV2 quote minus an explicit
  slippage tolerance (e.g. 0.3–0.5%) shown to the user. The deadline is short,
  a few minutes.
- Before asking for the signature, call `wallet_getCapabilities` and check that
  `atomic` is `supported` or `ready` for the chain. If the wallet can't
  guarantee atomicity, **refuse to fall back** to sequential transactions.
  Falling back would silently break the "both or neither" requirement.
- Simulate the full batch on a mainnet fork or through `eth_simulateV1` /
  Tenderly first. Show the user: 2 WETH in, the expected and minimum USDC
  supplied, the aUSDC recipient (their own checksummed address), and gas.
- Test end-to-end on an Anvil mainnet fork before shipping.

### EIP-7702 caveats to tell the user

- **Delegation persists.** The account keeps pointing at MetaMask's delegator
  until it is changed or cleared. The authorization can stay in place even if
  the batch itself reverts. Only ever delegate to the wallet's own audited
  implementation. We don't ask the user to sign an authorization to *our*
  contract. Our helper is only a normal call target. The user can turn off the
  smart-account upgrade in MetaMask whenever they want.
- The private key still has full control. EIP-7702 doesn't add multisig-style
  protection. It adds batching and atomicity, which is all this feature needs.
- Hardware-wallet signing of 7702 authorizations depends on the device and
  firmware. Check this for the user's setup.

### Alternative if we don't want to deploy a helper

Use an EIP-7702 delegate that supports **dynamic arguments**, meaning it can
use a call's return value or a `balanceOf` read as a later call's argument
(weiroll-style or a "call with balance injection" executor). That removes our
contract, but the user would have to delegate their EOA to a less common
implementation. That is a bigger trust decision than approving a small
stateless helper for exactly 2 WETH. I'd pick the helper plus MetaMask's
standard delegator.

## Verdict on the verdict

The teammate is correct that you need smart-account logic and correct that a
static batch alone isn't enough. They're wrong that this requires a new
address. **Ship it on the user's existing account:** an EIP-7702 atomic batch
through `wallet_sendCalls` containing an exact-amount WETH approval and one
call to a stateless swap-and-supply helper, which supplies the swap's actual
output to Aave V3 `onBehalfOf` the user. It takes one confirmation, and both
legs land or neither does. The ENS name, history and address stay the same.

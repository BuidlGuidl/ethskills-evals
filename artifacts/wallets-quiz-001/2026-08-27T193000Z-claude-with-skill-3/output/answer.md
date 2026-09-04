# Re: "This can't work from a plain EOA"

**The verdict is wrong, and the premise under it is out of date.** The user does not have to
accept a new address, does not have to deploy a Safe, and does not have to move the 2 WETH
anywhere. They keep the address, the ENS name, and the history.

The claim "an EOA does one call per transaction — that is what an EOA IS" stopped being true on
Ethereum mainnet with the Pectra fork (May 2025). **EIP-7702** lets an existing EOA sign an
authorization that points its own address at contract code, and execute a batch atomically in the
same transaction. Same address, same nonce sequence, same ENS, no new account, no funds
migration. Telling a user to abandon a two-year-old address should be the last resort, not the
first answer.

---

## What actually happens on chain

A type-4 (`SET_CODE_TX_TYPE`) transaction carries an `authorization_list`. Each entry is a tuple
`(chain_id, delegate_address, nonce)` signed by the EOA. After it lands, the account's code field
holds the delegation indicator `0xef0100 || delegate_address`, and every subsequent call into the
address executes the delegate's code **with `address(this)` equal to the EOA**. `msg.sender` for
the outbound calls is still the user's address, so Uniswap and Aave see exactly the counterparty
they saw before.

The authorization and the batch ride in one transaction, so the user signs **one** confirmation
covering both the upgrade and the swap-then-supply. Atomicity is the EVM's normal transaction
atomicity: one revert anywhere and both legs are undone. "Both or neither" is satisfied by
construction — no smart-contract wallet required.

---

## The real problem in this design, which the review missed

The hard part is not the EOA. It is that **a 7702 batch is a static list of calls**, and the
supplied amount is not known until the swap has run. You cannot put `amountOut` in the calldata of
call #3 when it is produced by call #2.

That is the constraint worth arguing about, and a Safe would not have solved it either — a Safe
`execTransaction` batch is equally static. Deploying a Safe would have cost the user their address
*and* left this problem unsolved.

Two ways to close it:

1. **A tiny stateless adapter, called from the batch.** Portable — works with any 7702 delegate
   that can emit plain `CALL`s. This is what I would ship.
2. **A `delegatecall` sweeper**, if the chosen delegate exposes a delegatecall execution mode
   (e.g. ERC-7579 `CALLTYPE_DELEGATECALL`). Then a helper running in the EOA's own context can read
   `USDC.balanceOf(address(this))` and supply that. No new approval, but it depends on delegate
   capabilities you have to verify rather than assume.

---

## What I would ship

### 1. Request the batch over EIP-5792, not by hand-rolling a type-4 tx

The dapp should not construct the authorization itself. Ask the wallet:

```js
const caps = await provider.request({
  method: 'wallet_getCapabilities',
  params: [account, ['0x1']],
});
// require caps['0x1'].atomic.status === 'supported'
```

`"supported"` means all-or-nothing. **Do not accept `"ready"`** — that permits sequential
execution, which is precisely the failure mode the user is trying to avoid. If the wallet does not
report `supported`, fall back (see below) rather than degrading silently.

Then:

```js
await provider.request({
  method: 'wallet_sendCalls',
  params: [{
    version: '2.0.0',
    chainId: '0x1',
    from: account,
    atomicRequired: true,
    calls: [
      { to: WETH,    data: approve(ADAPTER, TWO_WETH) },
      { to: ADAPTER, data: swapAndSupply(TWO_WETH, minOut, deadline) },
    ],
  }],
});
```

MetaMask prompts for the 7702 upgrade and the batch in a single confirmation. Two calls, one
signature.

### 2. The adapter

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee; address recipient;
        uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata) external payable returns (uint256);
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

/// Stateless. Holds nothing between transactions. Every call reverts unless the
/// full swap output is supplied to Aave on behalf of msg.sender.
contract SwapAndSupplyAdapter {
    IERC20      constant WETH   = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20      constant USDC   = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    ISwapRouter02 constant ROUTER = ISwapRouter02(0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45);
    IAavePool   constant POOL   = IAavePool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2);
    uint24      constant FEE    = 500; // 0.05% WETH/USDC

    function swapAndSupply(uint256 amountIn, uint256 minOut, uint256 deadline) external {
        require(block.timestamp <= deadline, "expired");

        WETH.transferFrom(msg.sender, address(this), amountIn);
        WETH.approve(address(ROUTER), amountIn);

        uint256 out = ROUTER.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: address(WETH), tokenOut: address(USDC), fee: FEE,
                recipient: address(this), amountIn: amountIn,
                amountOutMinimum: minOut, sqrtPriceLimitX96: 0
            })
        );

        // sweep, not `out` — covers any fee-on-transfer or rounding residue
        uint256 bal = USDC.balanceOf(address(this));
        require(bal >= minOut && bal > 0, "slippage");

        USDC.approve(address(POOL), bal);
        POOL.supply(address(USDC), bal, msg.sender, 0);   // aUSDC goes to the user's EOA

        require(USDC.balanceOf(address(this)) == 0, "residue");
        require(WETH.balanceOf(address(this)) == 0, "residue");
    }
}
```

`onBehalfOf: msg.sender` means the aUSDC is minted straight to the user's address — the adapter
never holds a position. The dynamic amount is handled where it can be: inside a contract, at
execution time.

Verify all four addresses against the official Uniswap and Aave deployment lists before you deploy
— do not take them from this document.

### 3. The approval hygiene the user asked for

Their account has no approvals to anything and they want it kept that way. `approve(ADAPTER,
2e18)` is an **exact** amount, and `transferFrom` consumes it to zero in the same transaction.
Post-transaction allowance is 0. No infinite approval, no standing exposure. Exposure to an adapter
bug is bounded to the 2 WETH inside that one atomic transaction.

Do not use Permit2 here — it would add a longer-lived allowance for no benefit.

### 4. `minOut` and gas

- Quote live from the Uniswap Quoter immediately before signing; set `minOut` at quote minus a
  slippage tolerance the user picks (0.5% is reasonable for a 2 WETH WETH/USDC trade). Set a short
  deadline.
- Budget roughly: ~12.5k for the authorization, ~25k intrinsic, ~130–180k swap, ~230–280k Aave
  supply, plus two approvals. Call it ~450–550k gas — **more than the plain swap they may have
  budgeted for**. The account "holds only enough ETH to pay gas," so estimate live with
  `eth_estimateGas` and a live fee, check the balance against it, and fail loudly with the shortfall
  before asking for a signature. Never price it from a remembered ETH price.
- If the balance genuinely will not cover it: a 4337-compatible delegate plus a paymaster can
  sponsor the gas — still same address, still one signature. That is an option, not a reason to
  migrate.

### 5. Tell the user what the delegation actually is

This is the one place the reviewer's caution would have been warranted, and it is not the place
they applied it.

**The delegation persists.** It is not scoped to this transaction. After the batch lands, the
account permanently has code pointing at the delegate, and it stays that way until the user signs a
*new* authorization replacing it or clearing it (delegating to `address(0)`). Decommissioning the
delegate contract does not undo it. A transaction whose inner calls revert can still leave the
delegation standing — so "the swap failed" does not mean "nothing changed."

Consequences to put in front of the user before they sign, not in a changelog:

- The delegate contract is now standing authority over that address. Use an audited, widely
  deployed one — MetaMask's own 7702 delegator, or a well-reviewed 4337 account implementation.
  Do not point a two-year-old ENS-bearing account at something you wrote this week. **The adapter
  is disposable and holds nothing; the delegate is not — do not conflate them.**
- Pin the authorization to `chain_id = 1`. A `chain_id` of 0 makes the delegation replayable on
  every EVM chain where that address exists.
- Show them how to revert to a plain EOA (MetaMask exposes a "switch back" flow) and confirm they
  can find it.
- The address now returns non-empty `EXTCODESIZE`. Uniswap V3's router and the Aave V3 pool do not
  care, but some contracts, airdrop claims, and CEX deposit flows reject accounts with code or
  require `tx.origin == msg.sender`. Worth a sentence to a user whose whole reason for keeping this
  address is its history.

### 6. Fallback, in order

1. Wallet reports atomic 7702 batching → ship the above.
2. Wallet does not → prompt to update MetaMask; 7702 has shipped.
3. Still not → **do not silently split into two transactions.** Say plainly that atomicity is not
   available and let the user choose. A degraded two-signature flow that half-executes is worse
   than an honest refusal.
4. Only if the user independently wants a smart account for other reasons is a Safe or 4337 account
   on the table — and then it is their choice, not a technical necessity, and the adapter above
   works unchanged from a Safe batch too.

---

## Summary for the PR thread

- "An EOA does one call per transaction" has been false on mainnet since Pectra, May 2025.
  EIP-7702 gives atomic batching from the user's existing address.
- The user keeps the address, the ENS, and the history. No Safe, no 4337 account, no WETH transfer.
- The genuine obstacle is the **runtime-determined supply amount**, which a Safe would not have
  fixed either. Solve it with a stateless adapter that reads the swap output and supplies it
  `onBehalfOf` the user.
- The thing that does warrant caution — and was not raised — is that **the 7702 delegation is
  permanent until explicitly cleared**. Pick an audited delegate, pin the chain id, and tell the
  user how to undo it.
- Ship: `wallet_getCapabilities` → require `atomic: "supported"` → `wallet_sendCalls` with
  `atomicRequired: true`, two calls, exact-amount approval, live quote and live gas estimate, one
  confirmation.

# Re: "they need a smart-contract wallet, tell the user to accept the new address"

**No. The teammate is wrong, and the remedy they propose is the only option on the
table that actually costs the user their address.**

The user keeps `0x…` — same key, same ENS, same history — and gets both legs in one
atomic confirmation. Two independent reasons the verdict doesn't hold.

---

## 1. "An EOA does one call per transaction" — one *top-level* call

That's true and it's also not the constraint they think it is. An EOA transaction has
one entry point, but that entry point can fan out into an unbounded call tree, and the
EVM already gives us all-or-nothing for free: if anything in the tree reverts, the whole
transaction reverts. Atomicity is a property of the transaction, not of the caller's
account type.

So even on a pre-Pectra chain, "swap then supply, both or neither" from an EOA is just:
call one contract that does both. The single-call limit constrains how many *entry
points* you get, not how much work happens inside one.

The one thing that genuinely bites here is the detail the teammate skipped past: the
account has **no approvals**. A helper contract has to `transferFrom` the WETH, which
needs a prior `approve`, and WETH9 on mainnet has no `permit` — so pre-Pectra this is
two transactions (approve, then execute), not one. That's a real limitation, and it is
the *only* real one in the whole verdict. It costs a second confirmation. It does not
cost an address.

## 2. Since Pectra (May 2025), even the one-top-level-call framing is obsolete

**EIP-7702** lets an EOA sign an authorization that installs delegated code *at its own
address*. Type-`0x04` transactions carry an `authorization_list`; the delegation
indicator `0xef0100 || implementation` is written to the EOA, and from then on calls to
that address execute the implementation's code with `address(this)` and `msg.sender`
still equal to the EOA.

That means the user's two-year-old account can batch. Directly. Nothing moves, nothing
is redeployed, no new address exists at any point:

- The ENS name still resolves to the same address, and the reverse record still holds.
- Every counterparty, allowlist, airdrop snapshot and attestation keyed to that address
  is untouched.
- The account still works as a plain EOA for everything else.
- It's **reversible** — sign an authorization to `address(0)` and the code is gone.

The authorization is processed *before* execution within the same transaction, so the
upgrade and the batch land together. One confirmation covers both. MetaMask ships this
(it's the "smart account" upgrade prompt) and exposes it to dapps through **EIP-5792
`wallet_sendCalls`**.

Compare against what the teammate proposed. A Safe or an ERC-4337 account is deployed at
a *fresh* address — CREATE2 or otherwise, you cannot deploy one onto an address that is
already an EOA. So their path requires: deploy (tx 1), transfer 2 WETH across (tx 2),
re-point the ENS record (tx 3), and permanently split the user's identity from their
history. Three transactions and the exact loss the user refused, to solve a problem that
7702 solves with zero.

**"There is no way around it" is precisely backwards** — 7702 exists *because* this is
the way around it.

---

# What I'd actually ship

Two pieces: a stateless adapter contract, and a 5792 batch from the frontend.

## Why a batch of plain calls is not enough on its own

This is the part worth being careful about, and it's where a naive "just use
`wallet_sendCalls`" answer falls over.

`wallet_sendCalls` takes an array of calls with **static calldata**, fixed at signing
time. But the amount to supply is the swap's output, which doesn't exist until the swap
executes. You cannot encode it. And Aave V3's `supply(asset, amount, onBehalfOf, ref)`
takes an exact `amount` — there is no `type(uint256).max` = "all of it" sentinel on
`supply` (that convention exists on `withdraw`/`repay`, not here).

So the batch needs one member that can read a runtime value and act on it. That's the
adapter. It is a swap-then-supply *composer*, not a wallet — the wallet capability comes
from 7702, the data-dependency between the legs comes from the adapter. Conflating those
two is what makes this look impossible.

## The adapter

Holds nothing at rest, has no owner, no upgrade path, no privileged functions.
Permissionless by design: whoever calls it spends their own WETH.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function approve(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
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

contract SwapAndSupply {
    IERC20       public immutable weth;
    IERC20       public immutable usdc;
    IERC20       public immutable aUsdc;
    ISwapRouter02 public immutable router;
    IAavePool    public immutable pool;

    constructor(IERC20 _weth, IERC20 _usdc, IERC20 _aUsdc, ISwapRouter02 _router, IAavePool _pool) {
        weth = _weth; usdc = _usdc; aUsdc = _aUsdc; router = _router; pool = _pool;
    }

    /// @notice Swap `amountIn` WETH -> USDC and supply the entire proceeds to Aave for `onBehalfOf`.
    /// @dev Reverts as a whole if either leg fails. Never retains a balance.
    function swapAndSupply(
        uint256 amountIn,
        uint256 minOut,
        uint24  fee,
        address onBehalfOf,
        uint256 deadline
    ) external returns (uint256 supplied) {
        require(block.timestamp <= deadline, "expired");

        weth.transferFrom(msg.sender, address(this), amountIn);
        weth.approve(address(router), amountIn);

        router.exactInputSingle(ISwapRouter02.ExactInputSingleParams({
            tokenIn:  address(weth),
            tokenOut: address(usdc),
            fee:      fee,
            recipient: address(this),
            amountIn:  amountIn,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0
        }));

        // Measure, don't trust the return value. This is the runtime number the
        // static calldata could never have carried.
        supplied = usdc.balanceOf(address(this));
        require(supplied >= minOut, "slippage");

        uint256 aBefore = aUsdc.balanceOf(onBehalfOf);
        usdc.approve(address(pool), supplied);
        pool.supply(address(usdc), supplied, onBehalfOf, 0);

        // aTokens minted 1:1 to onBehalfOf; tolerate 1 wei of index rounding.
        require(aUsdc.balanceOf(onBehalfOf) + 1 >= aBefore + supplied, "supply short");
        // Nothing may be stranded here.
        require(usdc.balanceOf(address(this)) == 0 && weth.balanceOf(address(this)) == 0, "dust");
    }
}
```

Notes on the choices:

- **Addresses are constructor-injected**, not hardcoded — deploy-time config verified
  against the official Uniswap and Aave deployment registries, and it makes the same
  bytecode reusable across chains.
- **`onBehalfOf` is the user's EOA**, so aUSDC is minted straight to the account the
  user cares about. The position is never in the adapter's name.
- **Allowances end at zero on their own.** The router pulls exactly `amountIn`; Aave
  pulls exactly `supplied`. The account's "no standing approvals" property survives.
- **`supplied` is read from `balanceOf`**, not from `exactInputSingle`'s return — robust
  to router quirks and to any non-standard transfer behaviour.
- In production, wrap the `approve` calls in `forceApprove` (OZ `SafeERC20`) so the
  contract stays correct for non-standard ERC-20s if it's reused beyond USDC.

## The frontend

```ts
const chainIdHex = '0x1'

const caps = await provider.request({
  method: 'wallet_getCapabilities',
  params: [account, [chainIdHex]],
})
const atomic = caps?.[chainIdHex]?.atomic?.status // 'supported' | 'ready' | 'unsupported'

if (atomic === 'supported' || atomic === 'ready') {
  const { id } = await provider.request({
    method: 'wallet_sendCalls',
    params: [{
      version: '2.0.0',
      chainId: chainIdHex,
      from: account,
      atomicRequired: true,          // refuse rather than silently degrade to sequential
      calls: [
        { to: WETH,    data: encodeApprove(ADAPTER, amountIn) },
        { to: ADAPTER, data: encodeSwapAndSupply(amountIn, minOut, fee, account, deadline) },
      ],
    }],
  })
  // poll wallet_getCallsStatus(id)
}
```

`atomicRequired: true` is load-bearing. Without it a wallet is permitted to fulfil the
request as sequential transactions, which is exactly the "one leg lands" outcome the
user is trying to avoid. With it, a wallet that can't guarantee atomicity errors out and
we take the fallback path deliberately instead of by accident.

The `approve` sits *inside* the atomic bundle, so if the swap or the supply reverts, the
approval reverts with it. The account is never left holding a live allowance.

MetaMask prompts once — the 7702 upgrade and the batch in a single confirmation. If the
account is already delegated, the delegation is reused and it's just the batch.

**Note what we authored and what we didn't:** we wrote the *adapter* (a contract that
gets called), not the *delegate* (the code that gets installed at the user's address).
The delegate is the wallet's own audited implementation, chosen by MetaMask. Asking a
user to sign a 7702 authorization pointing at a contract we wrote is the shape of the
current wave of 7702 phishing, and we shouldn't train anyone to accept it. `wallet_sendCalls` keeps us on the right side of that line.

## Fallback when `atomic` is `unsupported`

Two confirmations, same adapter, same address, same atomicity guarantee on the part that
matters:

1. `WETH.approve(ADAPTER, amountIn)`
2. `ADAPTER.swapAndSupply(...)`

Step 2 is still all-or-nothing — the swap and the supply cannot separate. The user
sees two prompts instead of one, and is left with a zero allowance afterwards because
the router and pool consume it exactly. Degraded UX; identical safety; still no new
address.

## Quoting and pre-flight

- Quote `QuoterV2.quoteExactInputSingle` off-chain across the 500 / 3000 (and 100) fee
  tiers, take the best, pass that tier as `fee`. Refresh the quote immediately before
  signing.
- `minOut = quote * (1 - slippageBps)`; 50 bps is a sane default for WETH/USDC at this
  size. Surface the number in the confirmation UI.
- `deadline = now + ~5 min`.
- Pre-check the Aave reserve off-chain (`getReserveData` / configuration bitmap): if
  USDC is frozen or at its supply cap, the transaction would revert atomically — no
  funds at risk, but better to tell the user before they sign than after.
- Gas: the 7702 authorization adds roughly 25k gas the first time (less on reuse). The
  account only holds gas money, so simulate with `eth_estimateGas` / `eth_simulateV1`
  and check the balance covers it before prompting. If it doesn't, 7702 also permits a
  *sponsor* to be the transaction sender while the user's EOA is merely the authority —
  the batch still executes at the user's address, someone else pays. Worth keeping in
  the back pocket; not needed for the happy path.

---

## Summary

| | Teammate's plan | What I'd ship |
|---|---|---|
| User's address | abandoned | kept |
| ENS | must be re-pointed | untouched |
| Transactions to get set up | 3 (deploy, transfer, ENS) | 0 |
| Confirmations for the action | 1 | 1 |
| Atomic across both legs | yes | yes |
| Standing approvals left behind | yes (WETH → Safe stays approved unless revoked) | none |
| Reversible | no | yes (delegate to `address(0)`) |

The teammate correctly identified that a plain EOA can't natively batch. They then
reached for a 2021-era remedy for a problem Ethereum fixed at the protocol layer in May
2025 — and the remedy destroys the one thing the user explicitly said was
non-negotiable. Ship the adapter plus `wallet_sendCalls`, and tell the user their
address is safe.

# Why the vault reverts on mainnet with USDT

## Short version

`usdt.approve(...)` is a raw `IERC20` call, not a SafeERC20 call. Real USDT's
`approve` returns **nothing**; the `IERC20` ABI says it returns a `bool`. The
compiler-generated return-data decode finds 0 bytes where it needs 32 and
reverts — with no reason string, because the revert comes from the decoder, not
from a `require`. The mock returns a proper `bool`, so the decode always
succeeds and the line can never fail in the suite.

---

## 1. Why it reverts against deployed USDT but never against the mock

USDT (`0xdAC17F958D2ee523a2206206994597C13D831ec7`) predates the finalized ERC-20
ABI. Its `transfer`, `transferFrom` and `approve` are declared with **no return
value**. The deployed bytecode therefore ends those functions with `STOP`/`RETURN`
of zero-length data.

Your contract calls through `IERC20`, whose `approve` is declared
`function approve(address, uint256) external returns (bool)`. Solidity compiles
that call to:

1. `CALL` the token;
2. check the call succeeded;
3. **check `returndatasize() >= 32`** and `abi.decode` the word as a `bool`.

Step 3 is where it dies. `returndatasize()` is 0. Solidity's generated check
fails and executes `revert(0, 0)` — an empty revert, no selector, no string.
That matches exactly what you see on-chain: deposit reverts, no reason.

The first line survives for a different reason: `safeTransferFrom` goes through
SafeERC20, which does a low-level call and accepts *either* an empty return or a
`true` word. It was written precisely for this token. So the token itself is
fine; only the line that bypassed SafeERC20 is not.

The mock cannot reproduce this. A stock OpenZeppelin `ERC20` implements
`approve` as `returns (bool)` and returns `true`. `returndatasize()` is 32, the
decode succeeds, the call returns `true`. The decimals being 6 is irrelevant —
you matched USDT on the one axis that does not matter (units) and left the axis
that does (ABI shape of the return value) at the standard's default.

There is a second USDT deviation waiting behind this one, which you have not hit
yet only because you never got past the first: USDT's `approve` contains

```solidity
require(!((_value != 0) && (allowances[msg.sender][_spender] != 0)));
```

so setting a non-zero allowance when a non-zero allowance is already outstanding
reverts. Your code approves exactly `amount` each deposit, and Aave's `supply`
pulls exactly `amount`, so the allowance normally returns to zero — but any path
that leaves dust approved (a partial pull, a failed supply in a try/catch, a
future integration that does not consume the full allowance) bricks every
subsequent deposit. Fix both at once.

## 2. Why `using SafeERC20 for IERC20` did not protect that line

`using A for B` attaches library functions to the type; it does not replace or
wrap the type's own members. Member lookup on `usdt` resolves **the interface's
own `approve` first** — an attached library function is only reached when the
member name does not exist on the type. SafeERC20's protective functions are
deliberately given *different* names (`safeTransfer`, `safeTransferFrom`,
`safeApprove`/`forceApprove`, `safeIncreaseAllowance`) precisely so that they
are reachable; the corollary is that the unprefixed names remain live and
unprotected.

So `usdt.safeTransferFrom(...)` is SafeERC20. `usdt.approve(...)` is a plain
`IERC20` call with the strict return decode. The directive gives no blanket
protection — it is opt-in per call site, and this call site did not opt in. The
compiler will not warn you: `approve` type-checks perfectly against the
interface you declared. The mismatch is between the interface and the deployed
bytecode, which the compiler never sees.

## 3. Why no amount of extra mock-based testing would have found it

A mock is a written-down copy of your assumption about the dependency. The bug
*is* that assumption being wrong. Every additional mock-based test re-runs the
same assumption and re-confirms it; the count going from 39 to 390 changes
nothing, because all 390 ask the same `MockERC20` whether it returns a `bool`,
and it does, because you compiled it from the standard.

Concretely, the failure lives in three places a mock cannot represent:

- **Return-data shape.** A Solidity mock inheriting `ERC20` *must* return
  `bool` from `approve` — the interface it implements requires it. You would
  have to deliberately hand-write a non-compliant mock, which means you already
  knew about the bug.
- **`MockAavePool`.** It accepts whatever you call it with. The real Pool has
  its own allowance and `transferFrom` semantics, its own reserve state, and can
  revert for reasons (frozen/paused reserve, supply cap, inactive asset) your
  mock has no concept of.
- **Coverage tells you nothing here.** All three lines executed in every one of
  the 39 tests. 100% line coverage on this function is compatible with the
  function being unable to run on mainnet. Coverage records that a line ran, not
  that the thing it ran against resembled production.

The general rule: deployed tokens deviate from the interface they are called
through — in what a call returns (USDT), in how much of a transfer arrives
(fee-on-transfer), in whether a balance stays put (rebasing). A mock answers in
the standard shape every time, so by construction it cannot surface a
deviation-from-standard bug. The only oracle for "does this token behave like
the interface" is the token.

---

## Fix 1 — the code change

Route the approval through SafeERC20 too, and use `forceApprove`, which handles
both the missing return value *and* USDT's non-zero-to-non-zero restriction
(it attempts the approve, and on failure resets the allowance to 0 and retries):

```solidity
using SafeERC20 for IERC20;

function deposit(uint256 amount) external {
    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.forceApprove(address(aavePool), amount);   // was: usdt.approve(...)
    aavePool.supply(address(usdt), amount, address(this), 0);
}
```

Notes:

- `forceApprove` is OpenZeppelin v5 (and v4.9+). On older v4 you have
  `safeApprove`, which reverts on a non-zero→non-zero change; if you are pinned
  there, do `usdt.safeApprove(address(aavePool), 0); usdt.safeApprove(address(aavePool), amount);`
  or use `safeIncreaseAllowance`. Prefer upgrading to `forceApprove`.
- Consider leaving the allowance at zero after the supply, or grep the whole
  codebase for any other bare `.approve(`/`.transfer(`/`.transferFrom(` on an
  `IERC20` — this class of bug travels in packs:
  `grep -rnE '\.(approve|transfer|transferFrom)\(' src/`
- If the vault is ever pointed at a fee-on-transfer token, `amount` is not what
  arrived. Supply the measured balance delta, not the argument.

## Fix 2 — the change in testing practice

**Stop mocking external integrations and quirky tokens. Fork against the real
deployment, at a pinned block.**

The mock/fork boundary is not a matter of taste: mocks are for pure logic you
wrote; forks are for anything you call that someone else deployed — Aave,
Uniswap, Chainlink, and any non-vanilla token (USDT, fee-on-transfer,
rebasing). This vault is on the wrong side of that line twice over: it
integrates a protocol *and* holds a quirky token.

```solidity
contract VaultForkTest is Test {
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant AAVE_V3_POOL = /* mainnet Aave V3 Pool — take it from the
                                       official Aave address book, do not trust
                                       an address pasted from memory */;

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
        vault = new Vault(IERC20(USDT), IPool(AAVE_V3_POOL));
    }

    function test_deposit_supplies_to_aave() public {
        address user = makeAddr("user");
        deal(USDT, user, 1_000e6);          // if deal's storage probe misbehaves
                                            // on USDT, prank a large holder instead
        vm.startPrank(user);
        IERC20(USDT).approve(address(vault), 1_000e6);
        vault.deposit(1_000e6);
        vm.stopPrank();

        assertEq(IERC20(USDT).balanceOf(address(vault)), 0);
        assertGt(aUSDT.balanceOf(address(vault)), 0);
    }
}
```

This test fails on the buggy code with the same empty revert you saw on
mainnet, and passes once `forceApprove` is in. That is the whole point: the
first assertion it ever makes is one the mock suite was structurally incapable
of making.

Practice items to adopt, not just this one test:

- **Pin the block.** An unpinned fork follows chain head, so reserve rates and
  balances move between runs: assertions flake, and the local RPC cache never
  hits, which turns into slow suites and provider 429s.
- **Confirm your RPC serves that block.** Pinning an old block is an archive
  request; a full node keeps roughly the last 128 blocks of state and errors on
  anything older. Verify a historical `eth_call` at your chosen block before
  pinning it, or you will debug the wrong failure.
- **Fork-test the integration paths too**, not only the token: deposit,
  withdraw, and a deposit-then-withdraw round trip against the real Pool, so
  reserve state, aToken accrual and Pool reverts are real.
- **Add a weird-token matrix.** Parameterize the fork test over USDT, a
  fee-on-transfer token, and a standard token like DAI. Each is a real
  deployment, each breaks a different assumption.
- **Keep the mock suite** — it is fine for the vault's own accounting and access
  control, and it is fast. Just stop treating it as deployment evidence.

Since this contract is a vault, two further gaps from the same checklist are
almost certainly still open, and both are worth closing before you redeploy:

- **A handler-driven invariant** tying recorded accounting to actual custody
  (shares outstanding vs. assets redeemable), with `targetContract` pointed at a
  handler that funds and approves its actors — never at the vault directly, or
  the fuzzer's random senders revert on nearly every call and the invariant is
  asserted against a contract that never moved. Read the calls/reverts stats
  every run; a near-100% revert rate means the run proved nothing.
- **Fuzz every owner-settable number** that feeds value math (fee bps, caps,
  ratios) across its whole domain with `bound()`, and classify each boundary's
  nearest valid value, the exact limit, and the first value past it separately.

---

## The one-line takeaway

39 green tests and full line coverage told you the code runs against the token
you wrote. Only a fork tells you it runs against the token you deployed against.

# Why the vault reverts on mainnet with USDT

## 1. The failing line

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);  // succeeds
usdt.approve(address(aavePool), amount);                   // reverts, no reason string
aavePool.supply(address(usdt), amount, address(this), 0);
```

`usdt` is typed as `IERC20`. The OpenZeppelin interface declares:

```solidity
function approve(address spender, uint256 value) external returns (bool);
```

Solidity compiles that call to: do a `CALL`, then ABI-decode the returndata as a
`bool`. The decoder first checks `returndatasize() >= 32`. If the callee returned
nothing, the decode fails and the compiler-inserted check reverts with **empty
returndata** — which is exactly the "revert with no reason string" you are seeing.

Deployed USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) predates the final
ERC-20 ABI. Its `approve` and `transfer` are declared to return **nothing**:

```solidity
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32);
```

So the call itself executes fine and the allowance is actually written — then your
caller reverts on the return-value decode, unwinding the whole transaction. The token
did not fail; your type declaration lied about it, and the compiler enforced the lie.

There is a second USDT landmine on the same line, which you have not reached yet but
would hit on the *second* deposit even after a naive fix. USDT's `approve` carries the
old race-condition guard:

```solidity
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

A non-zero → non-zero allowance change reverts. If Aave ever leaves a residual
allowance (a partial `supply`, or your own rounding), the next `approve(pool, amount)`
reverts too. Any fix has to handle both.

## 2. Why the mock never reverts

Your `MockERC20` is a stock OpenZeppelin `ERC20`. Its `approve` is:

```solidity
function approve(address spender, uint256 value) public virtual returns (bool) {
    ...
    return true;
}
```

It returns 32 bytes of `true`. The decode succeeds. It also has no non-zero-allowance
guard, no fee on transfer, no blocklist, no pausability. The mock is a textbook
implementation of the interface you *declared*, so of course it satisfies it.

Matching decimals (6) made the mock look like USDT in the one dimension that was easy
to copy, which is what made it convincing. Decimals are not where USDT deviates.

## 3. Why `using SafeERC20 for IERC20` did not protect this line

`using A for B` attaches library functions as *additional* members; it does not
replace or wrap the type's own members. The attached names here are `safeTransfer`,
`safeTransferFrom`, `safeApprove`/`forceApprove`, `safeIncreaseAllowance`,
`safeDecreaseAllowance`. The name `approve` is a real member of `IERC20`, and member
lookup on the type itself wins over an attached function, so `usdt.approve(...)` is
the plain interface call — SafeERC20 is not in the call path at all.

This is why line 1 works and line 2 does not. `safeTransferFrom` routes through
`SafeERC20._callOptionalReturn`, which is precisely the tolerant decode:

```solidity
// succeeds if the call returned nothing, OR returned exactly true
require(returndata.length == 0 || abi.decode(returndata, (bool)), "SafeERC20: ...");
```

SafeERC20 is **opt-in per call site**. One forgotten `safe` prefix and you are back on
the strict decode. The `using` directive gives no compiler warning, no lint error, and
the mock makes both spellings behave identically — so nothing in your loop could
distinguish them.

## 4. Why more mock-based tests could not have found it

A mock encodes your assumption about the dependency. Tests written against it verify
that your contract behaves correctly *given your assumption*, and the bug **is** the
assumption. The defect lives in the gap between `MockERC20` and the bytecode at
0xdAC1..., and no test that never touches that bytecode can observe the gap.

Concretely: the missing return value is a property of USDT's *ABI*. To reproduce it a
mock would have to be written with `function approve(address,uint256) external;` — no
return value — which means someone would have had to already know the answer. Test 40
through test 400 against the same mock re-run the same assumption with different
arguments. 39 green tests and 100% line coverage both measure the same thing here:
that your code ran. Neither one can measure whether the thing it called was real.

This generalises: deployed tokens deviate in what a call *returns* (USDT, BNB), in how
much of a transfer *arrives* (fee-on-transfer), and in whether a balance *stays put*
(rebasing, stETH). A mock written to the standard answers in the standard shape every
time, so it is structurally incapable of surfacing any of the three.

## 5. Fix 1 — the code change

Never call `approve` on a token you did not deploy. Use `forceApprove`, which does the
tolerant decode *and* handles the non-zero-allowance guard by resetting to 0 first:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);   // OZ v5
aavePool.supply(address(usdt), amount, address(this), 0);
```

On OpenZeppelin v4.x, `forceApprove` exists from 4.9; below that, do it by hand
(`safeApprove(pool, 0)` then `safeApprove(pool, amount)` — plain `safeApprove` alone
is not enough, it reverts on a non-zero existing allowance).

Two hardening notes while you are in there:

- Consider approving `type(uint256).max` once at initialization and refreshing only
  when the allowance runs low. It saves the per-deposit `approve` and sidesteps the
  guard entirely. Trade-off is a standing max allowance to Aave's Pool.
- Grep the rest of the codebase for bare `.approve(`, `.transfer(`, `.transferFrom(`
  on any `IERC20`. If one call site was missed, others were. Consider a CI grep, or
  declaring the token as a type with no `approve` member so the bare call cannot
  compile.

## 6. Fix 2 — the change in testing practice

The code fix closes this bug. The practice fix is what stops the next one, and it is
the actual answer to "39 green tests and we still shipped this":

**Any contract that calls an external protocol or handles a quirky token must be
exercised on a pinned mainnet fork against the real deployment before deploy.** Aave
V3 and USDT are both. The mock suite is fine for your own accounting logic; it has no
standing to say anything about the integration.

```solidity
contract VaultUsdtForkTest is Test {
    // verify both addresses against the canonical deployment list before pinning
    IERC20 constant USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    address constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    Vault vault;
    address user = makeAddr("user");

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
        vault = new Vault(address(USDT), AAVE_V3_POOL);

        deal(address(USDT), user, 1_000_000e6);
        vm.prank(user);
        USDT.forceApprove(address(vault), type(uint256).max);
    }

    function test_deposit_reachesAave() public {
        uint256 amount = 100_000e6;
        vm.prank(user);
        vault.deposit(amount);
        // assert against custody, not against a value we just wrote
        assertEq(USDT.balanceOf(address(vault)), 0);
        assertGe(vault.totalAssets(), amount - 1);
    }

    function test_secondDeposit_survivesResidualAllowance() public {
        vm.startPrank(user);
        vault.deposit(100_000e6);
        vault.deposit(100_000e6);   // this is the one USDT's approve guard kills
        vm.stopPrank();
    }
}
```

Points that matter in that file:

- **Pin the block.** An unpinned fork follows the chain head: live Aave rates and
  reserves move between runs, so assertions drift red and flake green on re-run, and
  the local RPC cache never hits — which becomes slow runs and provider 429s.
- **Confirm your endpoint serves that block.** Pinning an old block is an archive
  request; a full node keeps roughly the last 128 blocks and errors on anything older.
  Test a historical `eth_call` at 19_000_000 before committing to it, or your suite
  fails for a reason that has nothing to do with the contract.
- **Run the fork suite in CI**, not just locally. A fork test that only runs when
  someone remembers is not a gate.
- Keep the mock suite. It is fast and it covers your accounting. It just is not
  evidence about USDT or about Aave.

While you are re-examining what the 39 tests actually prove, three other gaps in the
same class are worth closing before the next deploy:

- **Assertions that mirror the implementation.** A test that reads back the value it
  just wrote, or checks a getter against the variable it returns, executes every line
  and constrains nothing. Assert properties instead: round-trips
  (`deposit` → `withdraw` returns within rounding), conservation (recorded assets
  equal assets actually held), access boundaries.
- **Owner-settable numbers feeding value math.** Every fee basis point, cap, ratio or
  exchange rate needs a fuzz test over its full accepted domain using `bound()`, not a
  handful of hand-picked values. At each boundary, decide which values are
  *semantically* usable and exercise the nearest valid value, the exact limit, and the
  first value beyond it separately.
- **A handler-driven invariant.** A vault does not ship on unit tests: a bug that
  accumulates across a sequence is invisible to any number of single-operation tests.
  State the property as an equality — recorded assets equal assets actually held — not
  a one-sided `claims <= holdings`, which stays green through anything that strands
  value as surplus. Point `targetContract` at a handler that owns funded and approved
  actors and bounds inputs, never at the vault directly; called directly, the fuzzer
  sends random senders holding no tokens, nearly every call reverts, reverts are
  discarded rather than failed, and the invariant is asserted against a contract that
  never left its initial state. Read the calls/reverts line in the output every run;
  set `fail_on_revert = true` while building the handler.

## Summary

| | |
|---|---|
| **Root cause** | USDT's `approve` returns no data; the `IERC20`-typed call decodes returndata as `bool` and reverts on empty returndata. |
| **Why the mock passed** | OZ `ERC20.approve` returns `true`. The mock implements the interface you declared; the bug is in the declaration. |
| **Why SafeERC20 missed it** | `using for` adds `safeApprove`/`forceApprove`; it does not override `approve`. Opt-in per call site, and line 2 opted out. |
| **Code fix** | `usdt.forceApprove(address(aavePool), amount)` — tolerant decode plus zero-first reset for USDT's non-zero-allowance guard. |
| **Practice fix** | Pinned mainnet fork test against real USDT and the real Aave V3 Pool, in CI. Mocks cannot test integrations. |

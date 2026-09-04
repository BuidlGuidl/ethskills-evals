# Why the vault reverts on mainnet USDT but never against the mock

## TL;DR

`usdt.approve(...)` is a **raw `IERC20` call**, not a SafeERC20 call. `IERC20.approve` is
declared `returns (bool)`, so solc emits a mandatory 32-byte return-data decode after the
call. Mainnet USDT's `approve` returns **nothing**. The decode fails and solc emits
`revert(0, 0)` — a bare revert with no reason string, which is exactly the symptom.

The mock is a stock OpenZeppelin `ERC20`. Its `approve` is compiler-generated and therefore
*always* ABI-encodes 32 bytes. The mock is structurally incapable of producing the failure,
so no test built on it — however many, however clever — can ever observe it.

---

## 1. The failing line, in detail

Mainnet USDT (`0xdAC17F958D2ee523a2206206994597C13D831ec7`) was written in Solidity 0.4.17,
before EIP-20's return values were treated as mandatory. Its approve is:

```solidity
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) {
    require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
    allowed[msg.sender][_spender] = _value;
    Approval(msg.sender, _spender, _value);
}
```

Two non-standard things here, both of which will bite you:

**(a) No return value.** `RETURN` is executed with a zero-length buffer, so
`returndatasize() == 0`.

Your call site goes through `IERC20`:

```solidity
interface IERC20 { function approve(address, uint256) external returns (bool); }
```

For any external call whose declared return type is non-empty, solc emits, in order:
`extcodesize(target) > 0` check → `CALL` → `success` check → **`returndatasize() >= 32`
check + `abi.decode`**. USDT passes the first three and fails the fourth. An ABI-decoding
failure on returndata is not a `Panic` and carries no `Error(string)` — solc emits a plain
`revert(0, 0)`. That is your reasonless revert, and it happens *before* `aavePool.supply`
is ever reached. Consistent with your observation that line 1 succeeds and the failure is
further down.

**(b) The approval-race guard.** `require(!((_value != 0) && (allowed[...] != 0)))` —
you cannot move a non-zero allowance to another non-zero value. Today you happen to skate
past it, because Aave pulls exactly `amount` and the allowance lands back at 0. But the
moment any dust allowance survives a call — a partial pull, a supply that reverts inside a
`try`, a future integration that doesn't consume the full amount, or a manual top-up — the
vault is **permanently bricked for that spender**, and again with no reason string. Any fix
that only addresses (a) leaves this loaded.

USDT's `transfer`/`transferFrom` are non-returning too. Line 1 survives purely because it
went through `SafeERC20`. The token is perfectly usable; the codebase was just inconsistent
about how it called it — and the inconsistency compiles without a warning.

---

## 2. Why `using SafeERC20 for IERC20` did not protect line 2

`using A for B` does not wrap, override, or intercept anything. It **attaches** library
functions as additional members of the type. `IERC20` gains `safeTransfer`,
`safeTransferFrom`, `forceApprove`, `safeIncreaseAllowance`, … It does **not** lose or
replace `approve`, `transfer`, or `transferFrom`, and Solidity's member lookup prefers a
type's own member over an attached one. So:

| written | resolves to | return-data handling |
|---|---|---|
| `usdt.safeTransferFrom(...)` | `SafeERC20.safeTransferFrom` | tolerant |
| `usdt.approve(...)` | `IERC20.approve` | **strict** |

SafeERC20's whole mechanism is `_callOptionalReturn`: it does a low-level `call` and
accepts *either* `success && returndata.length == 0` *or*
`success && abi.decode(returndata, (bool)) == true`. That optional-return tolerance is
precisely what line 2 opted out of by naming `approve` instead of `forceApprove`.

There is no compiler diagnostic for this. The safe and unsafe versions differ by one word,
and mixing them in adjacent lines of the same function is legal, idiomatic-looking code.
This is why the class of bug survives code review as reliably as it survives tests.

---

## 3. Why more mock-based tests would never have found it

**The defect is not in your state logic. It is in your model of the counterparty.**

`MockERC20` is a stock OZ `ERC20`. Its `approve` is:

```solidity
function approve(address spender, uint256 value) public virtual returns (bool) {
    _approve(_msgSender(), spender, value);
    return true;                       // solc ABI-encodes 32 bytes, unconditionally
}
```

There is no input, no sequence, no amount, and no caller for which this mock returns zero
bytes, or enforces a non-zero→non-zero approval guard, or blacklists, or pauses, or charges
a transfer fee. Those behaviors have probability **zero** in that fixture. Tests can only
falsify hypotheses their fixture is capable of violating, so this hypothesis was never under
test at all. The 39 tests are not weak evidence about USDT; they are *no* evidence about
USDT. They are your assumption ("the underlying is a spec-compliant OZ ERC20") restated in
executable form and then confirmed against itself.

Concretely, each escalation you might reach for fails for the same reason:

- **More unit tests** — every one of them exercises the same conforming `approve`.
- **Fuzzing `amount`** — the return-data length doesn't depend on `amount`. Every input
  takes the identical path.
- **Invariant testing** — explores call *sequences* over the same fixture. The boundary
  encoding is invariant across all of them.
- **100% line/branch coverage** — the reverting line is already covered by all 39 tests and
  *passes* in all 39. Coverage tells you which of **your** lines ran; it says nothing about
  which counterparty behaviors you assumed. A fully-covered suite and a completely wrong
  world-model are entirely compatible.

`MockAavePool` hides a parallel set: real Aave V3 has supply caps, frozen/paused/inactive
reserves, `SUPPLY_CAP_EXCEEDED` (error 51), and real aToken index accounting. Your mock has
none of it.

The general rule: **mocks verify your code against your beliefs; fork tests verify your code
against the chain.** Any bug that lives in the gap between belief and chain is invisible to
mocks by construction — which is also why it reached mainnet rather than being caught in
staging.

---

## 4. Fix 1 — the code change

Use `forceApprove`. It fixes (a) and (b) in one call: it tries the approve with tolerant
return decoding, and if that fails, resets the allowance to 0 and retries.

```solidity
using SafeERC20 for IERC20;

function deposit(uint256 amount) external {
    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.forceApprove(address(aavePool), amount);   // was: usdt.approve(...)
    aavePool.supply(address(usdt), amount, address(this), 0);
}
```

For reference, OZ v5's implementation — note it is exactly the two-part fix:

```solidity
function forceApprove(IERC20 token, address spender, uint256 value) internal {
    bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));
    if (!_callOptionalReturnBool(token, approvalCall)) {
        _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
        _callOptionalReturn(token, approvalCall);
    }
}
```

On OpenZeppelin v4 before 4.9, `forceApprove` doesn't exist and `safeApprove` reverts on a
non-zero→non-zero change; write `safeApprove(pool, 0); safeApprove(pool, amount);` or
upgrade. `safeIncreaseAllowance` also works but leaves a growing allowance outstanding —
prefer `forceApprove`.

Two adjacent hardenings, same root cause, worth doing now:

```solidity
// Credit the measured delta, not the requested amount. USDT has an owner-settable
// basisPointsRate fee (currently 0). If it is ever switched on, `amount` overstates
// what actually arrived and the vault's accounting silently goes insolvent.
uint256 before = usdt.balanceOf(address(this));
usdt.safeTransferFrom(msg.sender, address(this), amount);
uint256 received = usdt.balanceOf(address(this)) - before;

usdt.forceApprove(address(aavePool), received);
aavePool.supply(address(usdt), received, address(this), 0);
```

And make the mistake un-writable rather than relying on review:

- Ban raw `.approve(` / `.transfer(` / `.transferFrom(` on `IERC20` in CI — a solhint rule,
  a `grep` gate, or Slither's `unchecked-transfer` / `incorrect-equality` detectors.
- Audit the rest of the codebase for the same one-word slip. If it happened once it almost
  certainly happened elsewhere; `grep -rn '\.approve(' src/` is the whole search.

---

## 5. Fix 2 — the change in testing practice

**The rule: every external protocol and every token address you will actually deploy against
must be exercised on a mainnet fork, at that exact address, before mainnet.** The deployment
config is a test input, not a deployment detail. USDT was never once in your test suite;
that is the actual failure, and it's a process failure, not a coverage failure.

Three concrete changes:

### (a) Fork-test the real deposit path against real USDT and the real Aave V3 pool

This test fails on the current code with an empty revert, and passes after `forceApprove`.

```solidity
// test/fork/VaultUSDT.fork.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Vault} from "../../src/Vault.sol";

interface IAavePool {
    function getReserveData(address asset) external view returns (
        uint256, uint128, uint128, uint128, uint128, uint128, uint40,
        uint16, address aTokenAddress, address, address, address, uint128, uint128, uint128
    );
}

contract VaultUSDTForkTest is Test {
    address constant USDT     = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2; // verify vs address book

    Vault vault;
    IERC20 aUsdt;
    address alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 20_000_000); // pin for reproducibility
        vault = new Vault(IERC20(USDT), AAVE_POOL);

        (,,,,,,,, address aToken,,,,,,) = IAavePool(AAVE_POOL).getReserveData(USDT);
        aUsdt = IERC20(aToken); // read it, don't hardcode

        deal(USDT, alice, 1_000_000e6); // if deal() misses the slot, prank a whale instead
    }

    function test_DepositSuppliesToAave() public {
        uint256 amount = 100_000e6;

        vm.startPrank(alice);
        // NOTE: `IERC20(USDT).approve(...)` would revert here too — the test itself
        // demonstrates the bug. This is the tell you never saw with the mock.
        SafeERC20.forceApprove(IERC20(USDT), address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();

        assertApproxEqAbs(aUsdt.balanceOf(address(vault)), amount, 1, "aUSDT not received");
        assertEq(IERC20(USDT).balanceOf(address(vault)), 0, "USDT stranded in vault");
    }

    /// Catches the approval-race guard: second deposit must not brick on leftover allowance.
    function test_TwoSequentialDeposits() public {
        vm.startPrank(alice);
        SafeERC20.forceApprove(IERC20(USDT), address(vault), type(uint256).max);
        vault.deposit(50_000e6);
        vault.deposit(50_000e6);
        vm.stopPrank();

        assertApproxEqAbs(aUsdt.balanceOf(address(vault)), 100_000e6, 2);
    }

    function testFuzz_Deposit(uint256 amount) public {
        amount = bound(amount, 1e6, 500_000e6);
        vm.startPrank(alice);
        SafeERC20.forceApprove(IERC20(USDT), address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
        assertApproxEqAbs(aUsdt.balanceOf(address(vault)), amount, 1);
    }
}
```

```toml
# foundry.toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
```

```bash
forge test --match-path 'test/fork/*' -vvv
```

Run it on every PR in CI, at the pinned block, with the RPC URL as a CI secret. A fork test
that only runs locally is a fork test that doesn't exist.

### (b) Run the suite over a token matrix, not one token

Make the underlying a parameter of an abstract test base and instantiate it per token. Same
39 tests, run N times:

```solidity
abstract contract VaultBehaviorTest is Test {
    function underlying() internal virtual returns (address);
    // ... all 39 tests, written against underlying()
}

contract VaultUSDT is VaultBehaviorTest { function underlying() internal override returns (address) { return USDT; } }
contract VaultUSDC is VaultBehaviorTest { function underlying() internal override returns (address) { return USDC; } }
contract VaultDAI  is VaultBehaviorTest { function underlying() internal override returns (address) { return DAI;  } }
```

USDT (no return values, approval guard, potential fee), USDC (proxied, blacklist, pausable),
DAI (18 decimals, `permit` with a non-EIP-2612 signature) each break a different assumption.
Cheap to add, and it converts "we support any ERC20" from a claim into a tested property.

### (c) Keep mocks, but make them adversarial

Mocks are still the right tool for fast local iteration — the problem was that yours modeled
only the compliant case. Add a family of hostile ones (or vendor `d-xyz/weird-erc20`):
no-return-value, `approve`-race-guard, fee-on-transfer, rebasing, pausable, blacklisting,
returns-false-instead-of-reverting. Then the fast suite catches the *class* of bug in
seconds, and the fork suite confirms the specific deployed instance.

The ordering that would have caught this: a no-return-value mock fails in CI in under a
second; the fork test proves USDT specifically is the no-return-value case; neither ever
depends on someone remembering to look.

---

## What to do now, in order

1. Ship `forceApprove` — the deposit path is dead on mainnet until it lands.
2. `grep -rn '\.approve(\|\.transfer(\|\.transferFrom(' src/` and fix every other raw call.
3. Add the fork test above; confirm it reverts on the old code before it passes on the new.
4. Add the CI gate banning raw `IERC20` calls, so this cannot recur.
5. Add the token matrix and the hostile mocks.

Then re-check: if any USDT already sits in the vault from a partially-successful path, and
whether any spender holds a non-zero residual allowance that the guard would now reject.

# Why `deposit` reverts on mainnet with USDT but never against the mock

## Short version

Line 2 is a **raw** `approve` call, not a SafeERC20 call. Real USDT's `approve` returns
**nothing**. The compiler-generated call site for `IERC20.approve` expects 32 bytes of
return data, finds 0, and reverts with empty returndata — which is exactly the
reasonless revert you are seeing on-chain. The mock is a stock OpenZeppelin ERC20, so it
returns a proper `bool` and the same line succeeds. The suite was never capable of
failing here.

---

## 1. Why the real USDT reverts

USDT (`0xdAC17F958D2ee523a2206206994597C13D831ec7`) was deployed in 2017 against
Solidity 0.4.17, before ERC-20 return values were consistently enforced. Its actual
on-chain ABI is:

```solidity
function transfer(address _to, uint _value) public;                 // no return
function transferFrom(address _from, address _to, uint _value) public; // no return
function approve(address _spender, uint _value) public;             // no return
```

Your contract calls it through OpenZeppelin's `IERC20`, whose `approve` is declared
`returns (bool)`. So the compiler emits, roughly:

```
call(...)                       // succeeds, returndatasize == 0
if iszero(returndatasize() >= 32) { revert(0, 0) }   // <-- dies here
```

Solidity's ABI decoder refuses to decode a `bool` out of zero bytes, and the revert it
emits carries **no** revert data. No reason string, no custom error, no panic code. That
signature — an empty revert on a call to a token that otherwise works — is the classic
fingerprint of a non-standard-return token.

Two details that confirm the diagnosis against what you observed:

- **Line 1 succeeds** because `safeTransferFrom` goes through `SafeERC20`, which does a
  low-level `call` and then treats "empty returndata + call succeeded" as success. That
  is precisely the case SafeERC20 exists to handle, and it handles it. So USDT's missing
  return value is tolerated on line 1 and fatal on line 2.
- **Line 3 is never reached.** Even if it were, the allowance would be zero and Aave's
  `supply` would fail on its own `transferFrom`.

### The second, latent USDT bug on the same line

Even if you only fixed the return value (e.g. by casting to a no-return interface),
line 2 would still be wrong. USDT's `approve` contains an anti-front-running guard:

```solidity
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

You cannot change a **non-zero** allowance to another **non-zero** value; you must go
through zero first. Today `aavePool.supply` consumes the full allowance, so it happens to
land back at zero each time — but any path that leaves dust (a partial pull, a rounding
remainder, a future Aave version, a supply cap clipping the amount, an approval that
isn't fully spent) permanently bricks every subsequent deposit. And that `require` has no
message either, so it would also surface as a reasonless revert. Fix both at once.

### What is *not* the cause

The 6 decimals are a red herring — your mock matches USDT there, and decimals play no
part in this revert. Nor is it an Aave configuration issue, a supply cap, or a paused
reserve; all of those revert with an Aave error code string.

---

## 2. Why `using SafeERC20 for IERC20` did not protect line 2

This is the part that makes the bug invisible in review.

`using A for B` attaches the library's functions to the type **as additional members**.
It does **not** override, wrap, or intercept members the type already has. SafeERC20's
API is a set of *differently named* functions:

| You wrote | Resolves to | Safe? |
|---|---|---|
| `usdt.safeTransferFrom(...)` | `SafeERC20.safeTransferFrom` | yes |
| `usdt.approve(...)` | `IERC20.approve` — the interface member | **no** |

There is no `SafeERC20.approve`, so `usdt.approve(...)` binds to the plain interface
method and compiles to a bare external call with strict return decoding. The `using`
directive is in the file, the import is there, the type is right — and the line is
completely unprotected. The compiler cannot warn you: `approve` is a legitimate member of
`IERC20` and the call is well-typed. SafeERC20 is opt-in per call site, and this call site
opted out by omission of four characters.

This is also why the bug survived code review: the surrounding lines *look* like they
establish a safe context, and line 2 blends in.

---

## 3. Why no number of mock-based tests could have caught it

Your 39 tests are green not because the code is correct but because **the mock and the
code share the same wrong assumption**.

`MockERC20` is a stock OpenZeppelin `ERC20`. OpenZeppelin's `ERC20` is a faithful
implementation of the EIP-20 spec, and `IERC20` is a faithful declaration of that same
spec. So the mock is, by construction, the token your interface *claims* USDT is. The bug
is that USDT is not that token. A test built from the mock is asking "does my code work
against a token that behaves the way I already assumed?" — the answer is yes, and it is
a tautology. The test and the code are derived from the same source of truth, so they
agree with each other and are jointly wrong about reality.

Concretely: a mock cannot reproduce this failure because the failure lives *below the
Solidity type system*, in the raw calldata/returndata layout. `MockERC20.approve` is
declared `returns (bool)`, so it always writes 32 bytes of returndata; the
`returndatasize` check can never fail. You could write 39 more tests — fuzz the amount,
fuzz the caller, test zero, test `type(uint256).max`, test double deposits, test
reentrancy, take gas snapshots, add invariant tests with a handler — and every single one
would pass, because none of them changes the ABI of the thing being called. The test
dimension that matters here (*"what shape of returndata does the callee actually
produce?"*) is not a dimension a mock of your own construction can vary, unless you
already knew to vary it, and if you already knew, you would have fixed the code.

More generally: **mocks test your code against your assumptions; they cannot test your
assumptions.** Every integration bug of this family — non-standard returns, fee-on-
transfer, rebasing balances, blocklists, non-standard decimals, 0-allowance guards,
Aave's own supply caps/frozen reserves — lives exactly in the gap between the real
contract and the stub you wrote to stand in for it. The same argument applies to
`MockAavePool`: it is a statement of what you believe Aave does, so it will never
contradict you.

Mocks are still useful — they make failure-injection and unit-level branch coverage
cheap. They are just the wrong tool for answering "does this integrate?"

---

## 4. Fix 1 — the code change

Use `forceApprove`, which fixes both the missing return value and the non-zero-allowance
guard in one call:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);   // was: usdt.approve(...)
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` (OpenZeppelin v4.9+ / v5) does a low-level `approve` with relaxed return
checking, and if that fails it sets the allowance to `0` and retries — which is precisely
the dance USDT requires.

On OpenZeppelin v4.x before 4.9 you have `safeApprove`, which reverts when moving a
non-zero allowance to another non-zero value; the equivalent is:

```solidity
usdt.safeApprove(address(aavePool), 0);
usdt.safeApprove(address(aavePool), amount);
```

Prefer upgrading and using `forceApprove`. (`safeIncreaseAllowance` also works but leaves
residual allowance if Aave ever under-pulls; `forceApprove` to the exact `amount` is
tighter.)

Then audit the whole repo for the same shape, because if it happened once it happened
more than once:

```bash
grep -rn --include=*.sol -E '\.(approve|transfer|transferFrom)\s*\(' src/
```

Every hit that is not `safe*`/`forceApprove` and not on a token you control is a
candidate for the identical bug. Add a CI lint (Slither's `unchecked-transfer` /
`incorrect-erc20-interface` detectors, or a `solhint`/grep rule) that fails the build on
bare `approve`/`transfer`/`transferFrom` calls in `src/`.

While you are in there: the fee-on-transfer sibling of this bug is also worth closing.
USDT has a fee mechanism that is currently set to zero but is owner-settable. Supplying
`amount` rather than the balance actually received would break if it is ever switched on:

```solidity
uint256 before = usdt.balanceOf(address(this));
usdt.safeTransferFrom(msg.sender, address(this), amount);
uint256 received = usdt.balanceOf(address(this)) - before;
usdt.forceApprove(address(aavePool), received);
aavePool.supply(address(usdt), received, address(this), 0);
```

Credit the depositor `received`, not `amount`.

---

## 5. Fix 2 — the change in testing practice

**The rule: every external integration gets at least one fork test against the real
deployed address it will be deployed with, and that fork test runs in CI.** Not a mock of
it. The real bytecode, the real storage, the real ABI.

Mocks keep their job — fast unit coverage and failure injection. They just stop being the
*only* thing standing between you and mainnet. A single test of the form below would have
reverted on line 2 on the first run and cost you an afternoon instead of a deployment:

```solidity
// test/fork/VaultUSDT.fork.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vault} from "../../src/Vault.sol";

contract VaultUSDTForkTest is Test {
    address constant USDT      = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2; // Aave V3 Ethereum Pool
    address constant AUSDT     = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;

    Vault vault;
    address alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 20_000_000); // pinned block
        vault = new Vault(IERC20(USDT), AAVE_POOL);
        deal(USDT, alice, 10_000e6);
    }

    function test_DepositSuppliesToAave() public {
        vm.startPrank(alice);
        IERC20(USDT).approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        assertGt(IERC20(AUSDT).balanceOf(address(vault)), 0, "vault should hold aUSDT");
        assertEq(IERC20(USDT).balanceOf(address(vault)), 0, "no idle USDT left");
    }

    // The bug was order-dependent in the latent case: deposit twice.
    function test_SecondDepositAlsoSucceeds() public {
        vm.startPrank(alice);
        IERC20(USDT).approve(address(vault), 10_000e6);
        vault.deposit(5_000e6);
        vault.deposit(5_000e6);   // would catch a stale non-zero allowance
        vm.stopPrank();
        assertGt(IERC20(AUSDT).balanceOf(address(vault)), 0);
    }
}
```

Pin the block so the test is deterministic and cacheable, and wire the RPC in
`foundry.toml` so CI needs no flags:

```toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"

[profile.ci.fuzz]
runs = 1000
```

Three supporting habits, in priority order:

1. **Fork-test every asset you actually list, not a representative one.** "We fork-tested
   with USDC" would not have caught this; USDC is standards-compliant. The token list is
   part of the test matrix. Adding a new underlying means adding a fork test for it, and
   that should be a hard rule for anyone touching the allowlist.
2. **Keep an adversarial mock alongside the faithful one.** A `MockUSDT` whose
   `approve`/`transfer` are declared with no return value (and which carries the
   non-zero-allowance `require`) makes the failure reproducible and fast, and it locks in
   the regression after you fix it. It is a complement to the fork test, not a substitute
   — you only know to write it once the fork test has told you what reality looks like.
3. **Treat "this has been green since the first commit" as a smell, not a comfort.** A
   suite that has never been red has never demonstrated it can detect anything. Before
   trusting a test, break the code on purpose and confirm the test goes red. Had anyone
   deleted the `approve` line and watched 39 tests stay green in the parts that mattered,
   the gap would have been visible immediately.

The general principle behind all three: **a test is only worth what its environment is
faithful to.** Against a mock you wrote, the environment is your own beliefs, and the
test can only ever confirm them.

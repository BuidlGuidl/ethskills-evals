# Why `deposit()` reverts on mainnet but never in the suite

## Short version

`usdt.approve(...)` is a **raw interface call, not a SafeERC20 call**. Real USDT's
`approve` returns nothing. The compiler-generated call site for
`IERC20.approve` expects 32 bytes of return data and ABI-decodes it into a `bool`.
Decoding 0 bytes fails, and the ABI decoder reverts with empty return data — hence
"no reason string". Your MockERC20 is a stock OpenZeppelin ERC20, whose `approve`
*does* return `true`, so the decode always succeeds and the bug is structurally
unreachable in the suite.

## 1. Why the real token reverts and the mock does not

USDT (`0xdAC17F958D2ee523a2206206994597C13D831ec7`) predates finalized ERC-20.
Its `transfer`, `transferFrom` and `approve` are declared with **no return value**:

```solidity
// TetherToken, deployed 2017
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) { ... }
```

Your contract calls it through OpenZeppelin's `IERC20`, whose signature is:

```solidity
function approve(address spender, uint256 amount) external returns (bool);
```

The selector matches (`0x095ea7b3` — return types are not part of the selector), so
USDT executes the approval and its storage *is* updated. Then control returns to your
contract with `returndatasize() == 0`. Solidity's generated call site for a
non-`try`/non-low-level external call does:

1. `call(...)` — succeeds
2. `if lt(returndatasize(), 32) { revert(0, 0) }` — **this is your revert**

An empty-data revert from the ABI decoder is exactly what you are seeing on-chain:
no reason string, no custom error selector, nothing to decode. The state change to
USDT's allowance is rolled back along with the rest of the transaction.

The mock cannot reproduce this. `ERC20.approve` in OpenZeppelin is:

```solidity
function approve(address spender, uint256 value) public virtual returns (bool) {
    ...
    return true;
}
```

32 bytes of return data, decode succeeds, call returns. Decimals are irrelevant here —
a 6-decimal OZ ERC20 is still a fully spec-compliant ERC20. The thing that differs
between mock and mainnet is not a *value* your tests could have chosen; it is the
**ABI shape of the token's return data**, which is fixed by the mock's bytecode.

There is a second, independent landmine on the same line even after the decode issue
is gone: USDT's `approve` has the non-standard "must zero first" guard:

```solidity
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

Setting a non-zero allowance on top of a non-zero allowance reverts. Today you happen
to be saved by `supply()` consuming the full allowance each time, but any partial
pull, any rounding leftover, or any failed downstream call that leaves dust allowance
bricks every subsequent deposit permanently. Fix both at once.

## 2. Why SafeERC20 did not protect that line

`using SafeERC20 for IERC20` does not wrap or intercept anything. It attaches the
SafeERC20 library's functions — `safeTransfer`, `safeTransferFrom`, `forceApprove`,
`safeIncreaseAllowance`, `safeDecreaseAllowance` — as *additional* methods on the
type. The original `IERC20` methods remain callable and remain unprotected.

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount); // SafeERC20 — protected
usdt.approve(address(aavePool), amount);                  // IERC20 — raw, unprotected
```

Line 1 works precisely because SafeERC20 routes through `_callOptionalReturn`, which
makes a **low-level** `call` and then applies the tolerant rule:

> success, **and** (returndata is empty **or** it decodes to `true`)

That "returndata is empty" branch exists for exactly this family of tokens. Line 2
never touches that code path. `.approve` and `.safeApprove`/`.forceApprove` are
different functions; the linter, the compiler and the type system are all perfectly
happy with the raw one. The `using for` directive lulls you into reading the whole
block as "safe", but safety is per-call-site, not per-file.

## 3. Why more mock-based tests could not have found it

A test can only exercise behaviour that exists in the bytecode under test. The failing
behaviour — returning zero bytes from `approve` — is a property of *TetherToken's
compiled code*. Your MockERC20 does not contain it, and no test input, no fuzz seed,
no invariant sequence, no call ordering can make an OZ `ERC20` omit its return value.

This is the general shape of the gap: **mocks encode your assumptions about the
dependency, so tests against mocks can only ever verify that your code is consistent
with your assumptions.** They are structurally incapable of falsifying the assumption
itself. Your 39 tests were green from the first commit not because the code was right
but because the mock and the contract shared the same wrong belief — that ERC20
`approve` returns a bool.

The same blind spot covers the rest of the family, all invisible to mocks:

- fee-on-transfer tokens (received amount ≠ `amount`; `supply()` should use the
  measured delta)
- rebasing tokens (balance changes without a transfer)
- blocklists (USDT/USDC can freeze your vault address)
- tokens with `decimals()` disagreeing with your assumption
- Aave-side reality: reserve frozen/paused, supply caps hit, `isolationMode`,
  the aToken address you cached, actual `supply()` revert codes like `51`/`59`

MockAavePool has the identical problem one layer out: it encodes your belief about
what Aave V3 does. It will never enforce a supply cap you forgot about.

## 4. Fix 1 — the code change

Use `forceApprove`, which both tolerates empty return data and handles the
"zero-first" requirement:

```solidity
using SafeERC20 for IERC20;

function deposit(uint256 amount) external {
    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.forceApprove(address(aavePool), amount);   // was: usdt.approve(...)
    aavePool.supply(address(usdt), amount, address(this), 0);
    usdt.forceApprove(address(aavePool), 0);        // leave no dangling allowance
}
```

`forceApprove` (OpenZeppelin ≥ 4.9; in 5.x `safeApprove` is gone entirely) attempts
`approve(spender, value)` via `_callOptionalReturn`; if that fails it does
`approve(spender, 0)` then `approve(spender, value)`. That is precisely the USDT
dance. Do **not** use the deprecated `safeApprove` — it reverts rather than resetting
when a non-zero allowance is already in place.

Notes on the surrounding lines while you are in there:

- If you ever support fee-on-transfer underlying, measure the actual receipt and
  supply that, not `amount`:
  ```solidity
  uint256 before = usdt.balanceOf(address(this));
  usdt.safeTransferFrom(msg.sender, address(this), amount);
  uint256 received = usdt.balanceOf(address(this)) - before;
  ```
  and mint shares against `received`. USDT's fee is currently 0 but the setter exists
  on the deployed contract.
- The trailing `forceApprove(..., 0)` is cheap insurance: it guarantees you never hit
  USDT's non-zero-to-non-zero `require` on a later deposit if `supply()` ever leaves
  allowance behind.
- Rule of thumb for the whole file: **never call a raw `IERC20` mutating method.**
  Grep for it in CI:
  ```bash
  ! grep -rnE '\.(transfer|transferFrom|approve)\(' src/ --include=*.sol
  ```

## 5. Fix 2 — the change in testing practice

**Fork-test every external integration against the real deployed contracts, with the
real token, before mainnet.** This is the only class of test that could have caught
this, and it would have caught it on the first run.

`foundry.toml`:

```toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"

[profile.default]
# fork tests run in CI too, not just locally
```

`test/VaultForkUSDT.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vault} from "../src/Vault.sol";

contract VaultForkUSDTTest is Test {
    address constant USDT      = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2; // Aave V3 Ethereum Pool

    Vault vault;
    address alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork("mainnet", 20_000_000); // pinned block = reproducible
        vault = new Vault(IERC20(USDT), AAVE_POOL);
        deal(USDT, alice, 1_000_000e6);
    }

    function test_DepositSuppliesToAave() public {
        uint256 amount = 10_000e6;

        vm.startPrank(alice);
        IERC20(USDT).approve(address(vault), amount); // USDT-safe: allowance is 0 here
        vault.deposit(amount);
        vm.stopPrank();

        assertGt(vault.balanceOf(alice), 0, "no shares minted");
        assertEq(IERC20(USDT).balanceOf(address(vault)), 0, "USDT stranded in vault");
        assertEq(IERC20(USDT).allowance(address(vault), AAVE_POOL), 0, "dangling allowance");
    }

    // The regression test for the actual bug: deposit twice.
    // With raw approve() this fails on call 1 (decode revert); with safeApprove it
    // would fail on call 2 (USDT non-zero-to-non-zero require).
    function test_ConsecutiveDepositsDoNotBrick() public {
        vm.startPrank(alice);
        IERC20(USDT).approve(address(vault), type(uint256).max);
        vault.deposit(5_000e6);
        vault.deposit(5_000e6);
        vm.stopPrank();
        assertGt(vault.balanceOf(alice), 0);
    }

    function testFuzz_DepositWithdrawRoundtrip(uint256 amount) public {
        amount = bound(amount, 1e6, 500_000e6);
        uint256 before = IERC20(USDT).balanceOf(alice);

        vm.startPrank(alice);
        IERC20(USDT).approve(address(vault), amount);
        vault.deposit(amount);
        vault.withdraw(vault.balanceOf(alice));
        vm.stopPrank();

        // Aave rounding may cost 1-2 wei; never more.
        assertApproxEqAbs(IERC20(USDT).balanceOf(alice), before, 2);
    }
}
```

Run it — and gate merges on it:

```bash
forge test --match-contract Fork -vvv
```

Concretely, adopt these rules:

1. **Mocks are for your own logic; forks are for other people's contracts.** Keep the
   39 mock tests — they are fast and they cover share math, access control and
   accounting. But the integration boundary (`safeTransferFrom` → `approve` →
   `supply`) must additionally be exercised against real USDT and the real Aave V3
   Pool at a pinned block.
2. **Fork-test against the exact token you will deploy with,** not a representative
   one. USDT, USDC, DAI and WETH all behave differently at the ABI/behaviour level.
   If the vault is meant to be multi-token, parameterize the fork test over the real
   address list and run the same body for each.
3. **Fork tests belong in CI, not just on a developer laptop.** Pin the block number
   so results are deterministic and cache the fork; add `MAINNET_RPC_URL` as a CI
   secret. A fork suite that only ever runs locally is a fork suite that stops running.
4. **Make "deploy checklist" mean "fork test exists for this chain + this token."**
   The rule that would have saved you: *no integration reaches mainnet until it has
   executed, in a test, against the same bytecode it will meet in production.*
5. Optional and cheap: add a `MockUSDTNonStandard` (no return values on
   `transfer`/`transferFrom`/`approve`, plus the zero-first `require`) to the unit
   suite. It is not a substitute for the fork test, but it makes the non-standard
   path fast to iterate on and documents the assumption explicitly.

## Summary table

| | Mock ERC20 | Real USDT |
|---|---|---|
| `approve` return data | 32 bytes (`true`) | 0 bytes |
| `IERC20.approve(...)` raw call | decodes fine | **reverts, empty reason** |
| `SafeERC20.forceApprove(...)` | works | works |
| non-zero → non-zero allowance | allowed | reverts |
| Caught by more mock tests? | — | no, structurally impossible |
| Caught by a pinned-block fork test? | — | yes, on the first run |

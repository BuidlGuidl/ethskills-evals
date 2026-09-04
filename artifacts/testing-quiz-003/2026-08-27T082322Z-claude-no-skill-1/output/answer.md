# Why the vault reverts on mainnet USDT but never against the mock

## Short version

Line 2 is the failure:

```solidity
usdt.approve(address(aavePool), amount);
```

That is a **direct interface call**, not a SafeERC20 call. `IERC20.approve` is declared
as returning `bool`, so solc emits a call followed by a mandatory ABI-decode of 32 bytes
of return data. Deployed USDT's `approve` returns **nothing** — `returndatasize() == 0`.
The decoder's `returndatasize() >= 32` check fails and solc reverts with an empty revert
(`revert(0, 0)`), which is exactly the "no reason string" you are seeing. The token
function itself never failed; the *decode of its return value* did.

## Why it reverts against real USDT

Deployed USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) predates the finalized ERC-20
ABI and was compiled with Solidity 0.4.17. Its signatures are:

```solidity
function transfer(address _to, uint _value) public;                    // no return
function transferFrom(address _from, address _to, uint _value) public; // no return
function approve(address _spender, uint _value) public;                // no return
```

The 4-byte selectors match `IERC20` exactly — selectors are computed from the argument
types only, not the return type — so the call dispatches correctly, executes correctly,
sets the allowance, and returns with zero bytes of return data. From the EVM's point of
view the sub-call **succeeded**. The revert is generated afterwards, in your contract, by
the compiler-inserted return-data check. This is why the failure is invisible at the
token level and carries no message.

Two independent USDT quirks are in play; be aware of both:

1. **Missing return value** (the one biting you). Breaks *every* call, including the
   first deposit — consistent with "every deposit reverts."
2. **Non-zero → non-zero approve guard**. USDT's `approve` has
   `require(!((_value != 0) && (allowances[msg.sender][_spender] != 0)))`. Even after you
   fix (1), a plain `approve(pool, amount)` reverts on any later deposit if a stale
   non-zero allowance remains. This one would have shown up on deposit #2. Fix both at once.

## Why the mock never reverts

`MockERC20` is a stock OpenZeppelin `ERC20`. OZ's `approve` is spec-compliant and
`return true`s — 32 bytes of return data. The decode succeeds, so line 2 passes.

The `6 decimals` detail in the mock is the trap: it makes the mock *feel* like a
faithful USDT stand-in, and the tests confirm the decimal-scaling math. But decimals were
never the risky axis. The risky axis is **ABI conformance**, and on that axis the mock is
a perfect OpenZeppelin token — i.e. the exact opposite of USDT.

## Why `using SafeERC20 for IERC20` did not protect line 2

SafeERC20 is not a mode you switch on for a contract. It is a set of *free functions*
attached to the type, and the protection only applies to the ones you actually call:

| Line | Call | Path |
|---|---|---|
| 1 | `usdt.safeTransferFrom(...)` | SafeERC20 → `_callOptionalReturn` → **protected** |
| 2 | `usdt.approve(...)` | raw `IERC20.approve` → **unprotected** |

`_callOptionalReturn` does a low-level `call` and then:

```solidity
if (returndata.length != 0 && !abi.decode(returndata, (bool))) revert SafeERC20FailedOperation(token);
```

Empty return data is *tolerated*; only an explicit `false` is rejected. That tolerance is
the entire point of SafeERC20 and the entire reason line 1 works. Line 2 opted out of it
by calling `approve` directly instead of `forceApprove`, and got solc's strict decode
instead. `using ... for` shadows nothing and intercepts nothing — the compiler resolves
`approve` to the interface member because `IERC20` already declares it. Two calls on the
same variable, in adjacent lines, going through completely different machinery.

Note the pattern: `safeTransfer`/`safeTransferFrom` are named distinctly from the
interface members, so calling them is a deliberate act. `approve` is not — the safe
version is called `forceApprove`, so writing `approve` silently gets you the raw one.

## Why no amount of mock-based testing would have caught it

This is the structurally important part.

A test can only falsify a belief that the test double is capable of contradicting. The
bug lives in a behavior — "does the token return 32 bytes?" — on which the mock and the
production code hold the *same* assumption. `MockERC20` is not an independent oracle; it
is a second expression of the developer's model of ERC-20, written by the same people
under the same premise. The code says "tokens return bool." The mock says "tokens return
bool." They agree, so every test passes, and the tests confirm nothing except internal
consistency.

Consequences worth naming:

- **Test count is not evidence here.** 39 green tests and 3,900 green tests carry the
  same information about this bug: zero. Adding cases explores new *inputs*, but the bug
  is not input-dependent — it fires on every input, at the ABI boundary. Coverage
  metrics also stay silent: line 2 is 100% covered and 100% passing.
- **"Green since the first commit" is a warning sign, not a comfort.** A suite that has
  never gone red has never demonstrated its ability to detect anything.
- **The mock is a stub for the wrong axis.** Mocks are legitimate for controlling
  *behavior you specify* (pool returns X, transfer fails). They are illegitimate as
  substitutes for *the ABI and semantics of a specific deployed contract*, because those
  are exactly the facts you don't already know. Your mock encoded USDT's decimals — a
  fact you knew — and silently normalized its ABI — the fact you didn't.

The general rule: **integration risk against a specific deployed contract cannot be
tested against an artifact you wrote yourself.** It has to be tested against that
contract's real bytecode.

## Fix 1 — the code

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);   // was: usdt.approve(...)
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` (OpenZeppelin ≥ 4.9; in 5.x it replaces the removed `safeApprove`) fixes
both quirks: it goes through `_callOptionalReturn`, so empty return data is accepted, and
on failure it retries with `approve(spender, 0)` followed by `approve(spender, amount)`,
which satisfies USDT's non-zero → non-zero guard. Do not use `safeApprove` — it reverts
outright on a non-zero existing allowance, so it fixes quirk (1) and not (2).

Alternative, if you prefer to avoid repeated approvals: approve `type(uint256).max` once
at initialization via `forceApprove`. Aave V3 pulls exactly `amount`, so the per-deposit
approve is not load-bearing. Trade-off is a standing unlimited allowance to the pool.

Then sweep the codebase for the same class of mistake — this is rarely a single site:

```bash
grep -rnE '\.(approve|transfer|transferFrom)\(' src/ --include='*.sol' | grep -v safe
```

Every hit on a token variable is the same latent bug. Add a Slither/solhint rule or a CI
grep so a bare `.approve(` cannot be reintroduced.

## Fix 2 — the testing practice

**Fork test the deposit path against the real deployed USDT.** This is the one change
that would have caught it, and it is cheap:

```solidity
contract VaultUsdtForkTest is Test {
    IERC20 constant USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    address constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000); // pin the block
        vault = new Vault(address(USDT), AAVE_POOL);
    }

    function test_deposit_realUsdt() public {
        deal(address(USDT), alice, 1_000e6);
        vm.startPrank(alice);
        USDT.approve(address(vault), 1_000e6);
        vault.deposit(1_000e6);            // reverts pre-fix, passes post-fix
        vm.stopPrank();
    }

    function test_deposit_twice_realUsdt() public { /* catches the stale-allowance quirk */ }
}
```

Note the second test: the non-zero → non-zero guard only appears on the *second*
deposit, so a single-shot happy path is not sufficient even on a fork. Any integration
whose state persists across calls needs at least two calls.

Supporting changes, in priority order:

1. **Every external contract you integrate with gets a pinned fork test of the real
   bytecode, at the real address.** Mocks stay for unit-level logic (accounting, access
   control, edge cases, fuzzing); they are never the *only* thing an integration path
   sees. Pin the block so the tests are deterministic and cacheable, and gate them behind
   a profile if RPC access is a CI constraint — but run them in CI, not just locally.
2. **Add a deliberately non-conforming mock** and run the token-facing suite against it
   too. A `MockNonStandardERC20` with no-return `transfer`/`approve` plus the USDT
   approve guard turns "works with weird tokens" into a property you test on every run,
   including for tokens you haven't integrated yet. Parameterize the suite over
   `[MockERC20, MockNonStandardERC20, MockFeeOnTransferERC20]` — three real-world
   deviation classes, one axis of parameterization. (Fee-on-transfer is the next bug of
   this family: `amount` received ≠ `amount` requested. Measure balance delta rather than
   trusting the argument.)
3. **Validate the mock against the thing it mocks.** If a mock stands in for a specific
   deployed contract, one fork test should assert they agree on the interface surface
   that matters. An unvalidated mock is an assumption with a `.sol` extension.
4. **Require every new test to fail once before it is trusted.** Cheapest possible check
   that a test has any detection power at all — and the check that "green since the first
   commit" never got.
5. **Deployment checklist item:** for each new underlying, run the fork suite against
   *that* token before the deploy transaction. USDT, USDC (proxy, upgradeable,
   blocklist), BNB, and OMG all deviate in ways that break naive integrations; the
   `d-xo/weird-erc20` catalogue is the reference list.

## One-line summary

`safeTransferFrom` tolerates USDT's empty return data; the raw `approve` on the next line
does not, and reverts in solc's return-data decoder with no reason string — a defect no
mock could ever expose, because the mock was built from the same assumption the code was.
Fix: `forceApprove`. Fix the process: fork test against the real token.

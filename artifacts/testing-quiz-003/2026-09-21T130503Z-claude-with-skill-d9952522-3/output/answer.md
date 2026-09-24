# Why `deposit()` reverts on mainnet with USDT but never against the mock

## Short version

The failing line is:

```solidity
usdt.approve(address(aavePool), amount);
```

Real USDT's `approve` returns **nothing**. Your `IERC20` interface says it returns `bool`.
Solidity therefore emits a `returndatasize` check plus an `abi.decode(..., (bool))` after the
call; USDT leaves 0 bytes of return data, the check fails, and the compiler-generated
decoder reverts with **empty revert data** — no reason string, exactly what you observed.

`SafeERC20` did not help because that line never went through `SafeERC20`.

---

## 1. Why the real token reverts and the mock does not

### The deployed USDT contract is not ABI-compliant

Tether at `0xdAC17F958D2ee523a2206206994597C13D831ec7` is a 2017-era contract written
against a draft of ERC-20. Its mutating functions are declared with **no return value**:

```solidity
// TetherToken / BasicToken / StandardToken, as deployed
function transfer(address _to, uint _value) public onlyPayloadSize(2 * 32);
function transferFrom(address _from, address _to, uint _value) public onlyPayloadSize(3 * 32);
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32);
```

Compare OpenZeppelin's `IERC20`, which you are calling through:

```solidity
function approve(address spender, uint256 amount) external returns (bool);
```

The **selector matches** (`approve(address,uint256)` — the return type is not part of the
selector), so the call dispatches correctly and the storage write actually happens.
What fails is the *decoding* of the reply.

### What the compiler actually emits

For a high-level external call with a declared return type, solc emits roughly:

1. `extcodesize(target) > 0` — passes, USDT has code.
2. `call(...)` — succeeds; USDT's `approve` runs, sets the allowance, and `STOP`s.
3. `returndatasize() < 32` → **`revert(0, 0)`**.

Step 3 is the revert. It is generated code, not your code and not a `require`, so there is
no reason string and no custom error — just empty return data. That is the signature you
should learn to recognise: *an external call that reverts with zero bytes of revert data,
against a contract that definitely exists, is very often a return-data ABI mismatch.*

A nasty detail: the allowance **was** set before the frame was rolled back. The revert
undoes it, so you cannot even observe partial progress; the transaction looks like it
never touched the token.

### Why the mock cannot reproduce it

`MockERC20 is ERC20` (stock OpenZeppelin). OZ's implementation is:

```solidity
function approve(address spender, uint256 value) public virtual returns (bool) {
    ...
    return true;
}
```

It returns a correctly ABI-encoded 32-byte `true`, every time, because it was written to the
same interface your vault calls through. The mock and the caller share one author's
assumption, so the mismatch that exists on-chain is definitionally absent in the test rig.

Setting the mock to 6 decimals made it *feel* like "the USDT case" and is precisely the kind
of partial fidelity that manufactures confidence. Decimals were never the risk; the ABI was.

### A second USDT landmine on the same line

Even once return-data decoding is fixed, USDT's `approve` contains:

```solidity
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

A non-zero → non-zero allowance change **reverts**, and again with no reason string (bare
`require`). Today `aavePool.supply` consumes the full allowance, so the residual is 0 and you
would get away with it — but that is an accident of Aave's current implementation, not a
property you control. Any leftover dust (a paused reserve, a supply cap clipping the amount,
a future Aave upgrade) turns every subsequent deposit into a permanent, unexplained revert.
The fix below handles both quirks at once.

Also note the `onlyPayloadSize` modifier: USDT rejects calldata that is not exactly the
expected length. Standard `abi.encodeCall` is fine, but any proxy/router that appends bytes
to calldata will break against USDT and nothing else.

---

## 2. Why `SafeERC20` did not protect that line

`SafeERC20` is not a wrapper, an interceptor, or a base contract. It is a library of
functions with *different names*, attached to the `IERC20` type:

```solidity
using SafeERC20 for IERC20;
```

`using A for B` adds `A`'s functions as members of `B`. It **cannot override members that
already exist on `B`**. `IERC20` already declares `approve`, so `usdt.approve(...)` binds to
the interface function and compiles to the plain, unchecked high-level call described above.
`SafeERC20.safeApprove` / `forceApprove` are separate names that you simply did not call.

So the three lines split cleanly:

| Line | Path taken | Outcome vs. real USDT |
|---|---|---|
| `usdt.safeTransferFrom(...)` | `SafeERC20` → low-level `call` + `_callOptionalReturn` | **works** — empty return data is explicitly tolerated |
| `usdt.approve(...)` | `IERC20.approve` → compiler-decoded `bool` | **reverts, empty reason** |
| `aavePool.supply(...)` | never reached | — |

`SafeERC20._callOptionalReturn` is exactly the logic you were missing:

```solidity
// paraphrased from OZ v5
bytes memory returndata = address(token).functionCall(data);
if (returndata.length != 0 && !abi.decode(returndata, (bool))) revert SafeERC20FailedOperation(address(token));
```

`returndata.length != 0 &&` — *that* is the clause that makes USDT work. It accepts both
"returns nothing" (USDT, BNB) and "returns false instead of reverting" (some older tokens).

The `using` directive gave the file the *appearance* of being USDT-safe. Safety comes from
the call sites, one at a time, not from the directive. A grep for `.approve(`, `.transfer(`,
`.transferFrom(` in a file that also says `using SafeERC20` should return zero hits.

---

## 3. Why more mock-based tests could never have found this

This is the part worth internalising, because it generalises well past USDT.

**A mock encodes your assumption about the dependency.** `MockERC20` is a statement of what
you believe an ERC-20 does. The bug *is* the gap between that belief and the deployed byte
code. Testing the vault against the mock asks "is the vault consistent with my assumption?"
— and it is, perfectly. The question that mattered, "is my assumption true of the thing at
`0xdAC1…`?", is not expressible in a suite whose only token is one you wrote.

Consequences:

- **Coverage is blind here.** `usdt.approve(...)` is at 100% line and branch coverage. It ran
  in all 39 tests. Coverage records that a line executed, never that an assertion *could have
  failed*. The failing behaviour is not on any branch of your code — it is in the ABI
  contract between your code and a contract you did not compile.
- **Test count does not help.** Test 40 through test 400 all call the same `MockERC20.approve`
  that returns `true`. You would be re-running the same assumption with different amounts.
  The search space the suite explores is bounded by the mock's behaviour set, and the real
  behaviour is not a member of it.
- **"Green since the first commit" is the tell, not the reassurance.** A suite that has never
  been red has never demonstrated it can go red. In this case that is literally true of the
  integration boundary: no test in it was capable of failing for this reason.

The same argument covers the neighbouring classes you have not tested either: fee-on-transfer
tokens (amount received < amount sent), rebasing tokens (balance changes with no transfer),
blocklists (USDT and USDC can freeze your vault's address), and tokens with non-18 decimals
interacting with your share math. And it covers `MockAavePool` identically — you have no
evidence USDT is even an active, uncapped, unfrozen reserve on Aave V3, because your mock
accepts every asset unconditionally.

---

## 4. Fix one: the code

Use `forceApprove`, which routes through `_callOptionalReturn` **and** handles the
non-zero → non-zero `require` by retrying with a zero approval first:

```solidity
using SafeERC20 for IERC20;

function deposit(uint256 amount) external {
    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.forceApprove(address(aavePool), amount);   // was: usdt.approve(...)
    aavePool.supply(address(usdt), amount, address(this), 0);
    usdt.forceApprove(address(aavePool), 0);        // optional: leave no residual allowance
}
```

Notes on the choice:

- **OZ v5.x**: `forceApprove` is the right call. `safeApprove` was **removed** in v5.
- **OZ v4.9+**: `forceApprove` also exists. Plain `safeApprove` is deprecated and, on its own,
  still reverts on the non-zero → non-zero path, so prefer `forceApprove`.
- **OZ < 4.9**: use `safeApprove(spender, 0)` followed by `safeApprove(spender, amount)`.
- A one-time infinite approval at initialisation is a common alternative for a fixed,
  trusted spender like the Aave Pool. It is cheaper, but it widens the blast radius if the
  Pool is ever compromised, and it still must be issued via `forceApprove`. Per-deposit
  approval, as above, is the safer default.
- Trailing `forceApprove(..., 0)` costs a little gas but guarantees the residual-allowance
  scenario above can never bite, independent of Aave's internals.

Then sweep the rest of the codebase — this is a class, not an instance:

```bash
grep -rnE '\.(approve|transfer|transferFrom|increaseAllowance|decreaseAllowance)\(' src/
```

Every hit in a file that also does `using SafeERC20 for IERC20` is the same latent bug.
Consider adding that grep as a CI check, or a Slither/solhint rule — it is a purely
syntactic property and does not need a test to enforce.

While you are in there: also stop assuming the amount that arrives equals the amount sent.
Measure it, which fixes the fee-on-transfer class for free:

```solidity
uint256 before = usdt.balanceOf(address(this));
usdt.safeTransferFrom(msg.sender, address(this), amount);
uint256 received = usdt.balanceOf(address(this)) - before;
usdt.forceApprove(address(aavePool), received);
aavePool.supply(address(usdt), received, address(this), 0);
```

---

## 5. Fix two: the change in testing practice

**The rule: a contract that calls an external protocol, or handles a quirky token, is tested
on a pinned mainnet fork against the real deployed contracts. Mocks stay for unit-level
logic only, and never constitute integration evidence.**

Concretely, for this vault:

```solidity
// test/VaultForkTest.t.sol
contract VaultForkTest is Test {
    IERC20 constant USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    address constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    Vault vault;
    address alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000); // pinned
        vault = new Vault(address(USDT), AAVE_V3_POOL);
        deal(address(USDT), alice, 1_000_000e6);
        vm.prank(alice);
        USDT.approve(address(vault), type(uint256).max);
    }

    function test_deposit_realUSDT() public {
        vm.prank(alice);
        vault.deposit(100_000e6);
        assertGt(IERC20(aUSDT).balanceOf(address(vault)), 0);
    }

    function test_twoConsecutiveDeposits() public {   // catches the residual-allowance quirk
        vm.startPrank(alice);
        vault.deposit(100_000e6);
        vault.deposit(100_000e6);
        vm.stopPrank();
    }

    function testFuzz_depositAccounting(uint256 amount) public {
        amount = bound(amount, 1e6, 500_000e6);
        ...
    }
}
```

The pinning details matter, or the fork tests become their own source of noise:

- **Pin the block.** An unpinned fork follows the chain head: live reserves and rates move
  between runs, assertions drift red and flake green on re-run, and Foundry's local RPC cache
  never hits — which becomes slow runs and provider 429s.
- **Confirm your endpoint serves that block.** Pinning an old block is an archive request.
  A full node keeps roughly the last 128 blocks of state and errors on anything older, so the
  suite fails for reasons unrelated to your contract. Verify a historical `eth_call` at the
  chosen block before committing to it.
- **Pick a block where the integration is live** — USDT an active, non-frozen, non-capped
  Aave V3 reserve. Otherwise you have written a test that proves your revert handling.

Beyond this one file, three habits that would have caught it and will catch the next one:

1. **Parameterise the token.** Run the same integration suite over a matrix of real mainnet
   tokens — USDT (no return value, allowance quirk, blocklist), USDC (proxy, blocklist),
   DAI (18 decimals, permit), and a fee-on-transfer token if you intend to support any. A
   base fork test contract with the token address as a constructor/`virtual` parameter makes
   this cheap. Each token added is a real assumption being tested rather than restated.
2. **Keep a deliberately hostile mock alongside the compliant one.** A `MockNonCompliantERC20`
   whose `approve`/`transfer` use assembly to `return(0, 0)` gives you a fast unit-level guard
   with no RPC dependency. Add `MockFeeOnTransferERC20` and `MockRevertingApproveERC20`
   likewise. This is a supplement to the fork test, not a replacement: it still encodes only
   the deviations you already thought of.
3. **Treat "the suite has always been green" as a question, not a result.** Before sign-off,
   name which search each risk was subjected to. External integration → pinned fork. Owner-
   settable value math → `bound()`-based fuzz over the full domain. Stateful accounting (a
   vault is) → a handler-driven invariant asserting shares/recorded assets equal assets
   actually custodied, with the revert rate read from the run output — `targetContract` must
   point at a funded, approved handler, never at the vault directly, or the fuzzer's random
   senders revert on ~100% of calls and the invariant is asserted against untouched initial
   state. For this vault, none of the three searches had been run; 39 unit tests against two
   mocks were standing in for all of them.

A useful framing for the retro: the deploy checklist item is not "do we have tests for the
Aave integration?" It is "has any test in this repo ever executed a single instruction of the
code that is actually deployed at `0xdAC17F9…` and `0x87870Bc…`?" The answer was no, and that
was knowable before mainnet without reading a line of Tether's source.

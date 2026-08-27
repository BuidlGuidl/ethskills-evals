# Why deposits revert on mainnet USDT but never against the mock

## TL;DR

`usdt.approve(...)` is a **raw** `IERC20` call, not a SafeERC20 call. Real USDT's
`approve` returns **nothing**. The Solidity-generated call site expects 32 bytes of
`bool`, sees `returndatasize() == 0`, and reverts with empty returndata — hence "no
reason string". The mock is a stock OZ ERC20, which *does* return `true`, so the
mock agrees with the bug and the line passes.

---

## 1. Why the real token reverts

USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) predates the finalized ERC20 ABI.
Its functions are declared with **no return value**:

```solidity
// TetherToken / BasicToken — actual mainnet source
function transfer(address _to, uint _value) public onlyPayloadSize(2 * 32) { ... }
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) {
    require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
    ...
}
```

Two non-standard behaviours matter here:

**(a) No boolean return — this is your revert.**
When you call through OZ's `IERC20`, whose `approve` is declared `returns (bool)`,
solc emits roughly:

```
CALL ...
if iszero(returndatasize() >= 32) { revert(0, 0) }   // <- conceptually
bool ok := abi.decode(returndata, (bool))
```

USDT's `approve` succeeds at the EVM level (it does not `REVERT`; it `STOP`s with
empty returndata), but the **caller-side ABI decode** fails. solc's failure path is a
bare `revert(0, 0)`: no selector, no string, no custom error. That is precisely the
symptom you observed — a revert with no reason string, on the line after a
`safeTransferFrom` that worked fine.

**(b) The non-zero → non-zero approve guard — a latent second bug.**
`require(!((_value != 0) && (allowed[...] != 0)))` means you cannot overwrite a
non-zero allowance. Today Aave's `supply` pulls the full `amount`, driving the
allowance back to 0, so you'd usually get away with it. But any path that leaves
residual allowance (a partial pull, a failed/reverted supply after approval in a
try/catch, a future Aave version, or a supply cap causing a smaller pull) makes the
*next* deposit revert on this `require` instead. Fix (a) without fixing (b) and you
have a time bomb.

**(c) Adjacent risk worth knowing.** USDT also carries an owner-settable
`basisPointsRate`/`maximumFee` — a dormant fee-on-transfer switch, currently 0. Code
that assumes "I transferred `amount`, therefore I hold `amount`" is not future-proof
against it. Not your current bug; do not let it become the next one.

## 2. Why the mock never reverts

Your `MockERC20` is a stock OpenZeppelin `ERC20`. Its `approve` is:

```solidity
function approve(address spender, uint256 value) public virtual returns (bool) {
    ...
    return true;   // <- 32 bytes of returndata, decodes cleanly
}
```

and it has no allowance-overwrite guard. So the mock satisfies exactly the assumption
your buggy line makes. Setting `decimals = 6` made the mock *look* like USDT in the
dimension you thought about (units) while leaving it unlike USDT in the dimension that
actually broke you (ABI conformance + approve semantics).

The mock is not a weak *model* of USDT. It is a model of **the token your code
assumes exists**. Those are different objects, and the test suite can only ever
compare your code against the second one.

## 3. Why SafeERC20 did not protect the failing line

`using SafeERC20 for IERC20` is **not** a wrapper, an override, or a linter. It is a
member-lookup extension: it makes `safeTransfer`, `safeTransferFrom`, `forceApprove`,
`safeIncreaseAllowance`, etc. resolvable on `IERC20` values. It does **not** rebind
`approve`.

Solidity's member resolution prefers a type's own members over `using for` library
functions, and in any case the names differ. So:

- `usdt.safeTransferFrom(...)` → `SafeERC20._callOptionalReturn`, which uses a
  low-level `call`, then accepts **either** empty returndata **or** `abi.decode(...)
  == true`, plus an `address.code.length > 0` check. USDT-compatible. **Line 1
  succeeded for exactly this reason.**
- `usdt.approve(...)` → plain `IERC20.approve`, a normal high-level external call with
  a mandatory `bool` decode. **Zero SafeERC20 involvement.** No compiler warning, no
  visual difference at the call site beyond four missing characters.

This is the trap: SafeERC20 is **opt-in per call site**, but the `using for`
declaration at the top of the file reads like a file-wide guarantee. It isn't. One
un-prefixed call and the protection silently evaporates.

## 4. Why more mock-based tests could not have helped

This is a **fidelity** failure, not a **coverage** failure — and the two are not on
the same axis.

- The failing line had **100% coverage**. It executed in (presumably) most of the 39
  tests. It passed every time.
- A test can only fail if the system under test disagrees with the oracle. Here the
  oracle (`MockERC20`) *encodes the same false assumption* as the bug (`approve`
  returns a bool; allowances are freely overwritable). Assumption == oracle, so the
  disagreement is structurally impossible to observe.
- Therefore test #40 through #4,000 — more branches, more fuzzing, more invariants,
  100% line/branch/mutation coverage — all still pass. You cannot fuzz your way to
  discovering a fact about a contract that is not in your test environment. The
  information simply is not present.

Corollary worth internalizing: **"39 tests, green since the first commit" is a smell,
not a reassurance.** A suite that has never been red has never demonstrated that it is
*capable* of being red. Green from commit one usually means the tests were written
against the implementation's assumptions rather than against the requirement.

The general rule:

> Mocks verify that your code is consistent with your beliefs.
> Forks verify that your code is consistent with reality.
> Integration risk lives entirely in the gap, and no amount of the first closes it.

---

## Fix 1 — the code change

Use `forceApprove` (OZ v4.9+ / v5). It does the low-level optional-return call *and*
handles the non-zero→non-zero guard by resetting to 0 and retrying:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);   // was: usdt.approve(...)
aavePool.supply(address(usdt), amount, address(this), 0);
```

Notes:

- **OZ v5**: `safeApprove` was removed; `forceApprove` is the replacement. Do not
  reach for `safeApprove`.
- **OZ < 4.9**: no `forceApprove`. Do it manually:
  ```solidity
  usdt.safeApprove(address(aavePool), 0);
  usdt.safeApprove(address(aavePool), amount);
  ```
- **Preferred alternative**: approve the pool once at construction/initialization to
  `type(uint256).max` and drop the per-deposit approve entirely. Fewer moving parts,
  cheaper deposits, no allowance-guard surface. Trade-off is a standing max allowance
  to Aave — acceptable for the canonical Aave V3 pool, and it's the common pattern.
- **Amount handling**: if you ever intend to support fee-on-transfer tokens (or hedge
  against USDT's dormant fee switch), supply the measured balance delta rather than
  `amount`:
  ```solidity
  uint256 before = usdt.balanceOf(address(this));
  usdt.safeTransferFrom(msg.sender, address(this), amount);
  uint256 received = usdt.balanceOf(address(this)) - before;
  ```
  and use `received` for the approve/supply and for share accounting.

**Sweep the whole codebase, not just this line.** This bug class is a grep:

```bash
# any non-Safe ERC20 mutating call
grep -rnE '\.(approve|transfer|transferFrom)\(' src/ | grep -v 'safe\|force'
```

Ban the pattern going forward — a Slither/semgrep rule, or a Solhint rule, on raw
`approve`/`transfer`/`transferFrom` in production code.

## Fix 2 — the change in testing practice

**Primary: fork-test the deposit path against the real token and the real pool.**
This is the one that would actually have caught it, and it's ~10 lines:

```solidity
contract VaultUsdtForkTest is Test {
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    address constant WHALE = 0x...;  // or deal()/stdstore for balance

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FIXED_BLOCK);
        vault = new Vault(IERC20(USDT), IPool(AAVE_V3_POOL));
    }

    function test_deposit_real_usdt() public {
        vm.startPrank(WHALE);
        IERC20(USDT).approve(address(vault), 1_000e6);
        vault.deposit(1_000e6);       // reverts pre-fix, passes post-fix
        vm.stopPrank();
    }
}
```

Pin the block number so it's deterministic and cacheable; run it in CI with an RPC
secret; keep the fast mock suite as the inner loop and the fork suite as the gate.
Make it a **required check before any deploy** — the whole point is that it runs on
the commit you actually ship.

**Supporting practices:**

1. **Test with the token you deploy with.** The deployment used USDT; the suite used a
   token that does not exist. Parameterize the integration suite over the real
   production token list (USDT, USDC, DAI, WETH, WBTC, …) and run the matrix. A
   deployment parameter that has never appeared in a test is untested, full stop.

2. **Make your mocks adversarial, not convenient.** Keep a small library of hostile
   ERC20s and run the token-touching paths against all of them:
   - `MockNoReturnERC20` — `approve`/`transfer`/`transferFrom` declared with no return
     value (this alone catches today's bug without an RPC).
   - `MockApproveRaceGuardERC20` — reverts on non-zero → non-zero approve.
   - `MockReturnsFalseERC20` — returns `false` instead of reverting.
   - `MockFeeOnTransferERC20`, `MockRebasingERC20`, `MockBlocklistERC20`.
   - Decimals variants: 6, 8, 18.
   A stock OZ ERC20 is the *least* informative token you can test against — it is the
   one token guaranteed to agree with every naive assumption in your code.

3. **Ban happy-path-only mocks by policy.** A mock's job is to *be different* from your
   assumptions in the ways real dependencies are. If a mock is a stock reference
   implementation, ask what it is actually testing.

4. **Simulate the deployment transaction, not just the contract.** Run the real
   constructor args (real token address, real pool address) against a fork, execute
   one deposit and one withdraw, before signing anything. `forge script --fork-url` or
   a Tenderly simulation. Treat "the deploy script ran on a fork and a user flow
   completed" as the deploy gate.

5. **Treat a never-red suite as unverified.** Periodically mutate the contract
   (mutation testing, or just delete a `require` by hand) and confirm the suite goes
   red. If it doesn't, you have coverage without oracles.

---

## The one-line lesson

`using SafeERC20 for IERC20` protects the call sites that opt in — and unit tests
against a mock you wrote can only ever confirm the assumptions you already held.
Real-token fork tests are the only place external reality gets a vote.

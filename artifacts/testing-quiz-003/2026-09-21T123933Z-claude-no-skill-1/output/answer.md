# Why the vault reverts on mainnet with USDT but never against the mock

## TL;DR

The failing line is

```solidity
usdt.approve(address(aavePool), amount);
```

That is a **raw `IERC20.approve`**, not a SafeERC20 call. The OZ `IERC20` interface declares
`approve` as `returns (bool)`, so the Solidity compiler emits an ABI-decode of the return data
after the call. Real USDT's `approve` returns **nothing** (zero bytes of return data). The decode
fails, and the failure is a compiler-generated `revert` with an empty reason — exactly the
"revert carries no reason string" you observed. Your `MockERC20` is a stock OpenZeppelin ERC20,
whose `approve` dutifully returns `true`, so the decode always succeeds and the bug is
structurally invisible to the mock suite.

Fixes: use `forceApprove` (or `safeIncreaseAllowance`) instead of `approve`, and add fork tests
against the real deployed token plus a deliberately non-compliant mock.

---

## 1. Why it reverts against real USDT

### 1.1 USDT is not ABI-compatible with `IERC20`

Tether (`0xdAC17F958D2ee523a2206206994597C13D831ec7`) was deployed in 2017, before ERC-20 was
finalized as a standard with mandatory `bool` returns. Its actual implementation is, in essence:

```solidity
// real USDT (TetherToken -> BasicToken/StandardToken), Solidity 0.4.17
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) {
    require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
    allowed[msg.sender][_spender] = _value;
    Approval(msg.sender, _spender, _value);
}
```

Two deviations matter, and both bite you:

1. **No return value.** The function signature has no `returns (bool)`. A successful call returns
   `RETURNDATASIZE == 0`.
2. **The zero-first allowance guard.** That `require` forbids setting a non-zero allowance when a
   non-zero allowance is already outstanding. You must reset to `0` first.

The selector `approve(address,uint256)` is identical in both cases — the return type is not part
of the selector — so the call *dispatches fine*. It's the caller-side decode that blows up.

### 1.2 What the compiler actually emits

For a high-level external call to a function declared `returns (bool)`, solc emits roughly:

```
CALL ...
if iszero(success) { bubble up returndata }        // propagate the callee's revert
if lt(returndatasize(), 32) { revert(0, 0) }       // <-- USDT dies here
returndatacopy(...); validate the bool is 0 or 1
```

(There is also an `extcodesize > 0` check; USDT is a real contract so that passes.)

USDT's `approve` *succeeds*. `success == 1`. But `returndatasize() == 0 < 32`, so the compiler's
own guard executes `revert(0, 0)` — a revert with **zero-length return data**. That is why:

- there is no reason string (it isn't a `require("...")` from any contract you can read),
- it is not a custom error either (no 4-byte selector, nothing to decode),
- `cast`/Etherscan/ethers all just say "execution reverted" with no detail,
- and the trace shows the `approve` subcall as *successful* while the parent frame reverts —
  which is the single most diagnostic detail if you look at a full call trace.

So the state transition is: `transferFrom` succeeds, the tokens are in the vault, `approve`
succeeds inside USDT — and then your own contract's compiler-inserted decode check reverts the
whole transaction and unwinds all of it.

### 1.3 The failure is deterministic, not amount-dependent

Because the cause is the ABI shape of the return data, **every** deposit fails, for every amount,
for every caller, on the first deposit and forever. That matches "every deposit reverts." If the
cause had been the zero-first guard instead, you would see the *first* deposit succeed and only
later ones fail (whenever Aave left residual allowance). It didn't, so the return-value decode is
the culprit. The zero-first guard is still a latent second bug in the same line — fix both at once.

### 1.4 Things that are *not* the cause, so you can stop looking

- **Decimals.** Your mock has 6 decimals, and so does USDT. This is a genuine class of bug, but
  it is not this bug, and the matching decimals are why it's a tempting dead end.
- **Fee-on-transfer.** USDT has fee machinery in its source (`basisPointsRate`), but the fee has
  been set to `0` since deployment and the max is capped. A nonzero fee would make the vault
  credit more than it received — another real bug worth defending against — but it would not
  produce this revert, and the first line succeeded anyway.
- **Aave.** `supply` is never reached. The transaction dies one line earlier, in your own frame.
- **Allowance being insufficient.** Never gets that far.

---

## 2. Why `using SafeERC20 for IERC20` did not protect this line

This is the part that makes the bug feel unfair, and it's worth being precise about.

`using A for B` is **compile-time sugar for method lookup, not interception**. It means: when a
method is called on a `B` and `B` has no such member, look for a function in `A` whose first
parameter is a `B`. It is resolution by fallback; it does not and cannot override members that
already exist.

`IERC20` *does* declare `approve`. So `usdt.approve(...)` resolves to `IERC20.approve` — the raw
external call — and SafeERC20 is never consulted. The `using` directive is silently bypassed.
Compare:

```solidity
usdt.safeTransferFrom(a, b, x);  // IERC20 has no `safeTransferFrom` -> resolves to SafeERC20 ✅
usdt.approve(spender, x);        // IERC20 HAS `approve`             -> resolves to IERC20    ❌
usdt.transfer(to, x);            // same trap, same silent bypass    -> resolves to IERC20    ❌
```

Two aggravating factors:

- **The safe variant has a different name.** SafeERC20's approve-family functions are
  `forceApprove`, `safeIncreaseAllowance`, `safeDecreaseAllowance` (and historically the now-removed
  `safeApprove`). There is no `safeApprove`-named member shadowing `approve`, so nothing collides
  and nothing warns you.
- **The line reads as correct.** `using SafeERC20 for IERC20` at the top of the file creates a
  strong and false impression that *all* token calls in the file are protected. Two of the three
  lines in this snippet are protected; the middle one isn't, and it looks identical in style.
  A reviewer's eye slides right over it. This is why "did you use SafeERC20?" is the wrong review
  question and "is every token call site prefixed `safe`/`force`?" is the right one.

What SafeERC20 *would* have done: `_callOptionalReturn` performs a low-level `call`, then accepts
the result if `returndata.length == 0` (and the target has code) **or** if it decodes to `true`.
That is precisely the check USDT needs. You just never invoked it on the failing line.

---

## 3. Why no amount of extra mock-based testing would have found it

Adding a 40th, 100th, or 500th test against `MockERC20` cannot surface this, and the reason is
structural rather than a matter of coverage:

**The mock is built from the same assumption the production code is built from.** Both the vault
and `MockERC20` are compiled against OpenZeppelin's `IERC20`/`ERC20`. The vault assumes "`approve`
returns a `bool`"; the mock *implements* "`approve` returns a `bool`". The test double does not
independently check the assumption — it **encodes** the assumption. A test can only fail when the
system under test and the oracle disagree, and here the mock has been co-opted as part of the
system's premise. You wrote the answer key from the same source as the exam.

Consequences worth naming explicitly:

- **Coverage metrics lie.** The failing line has 100% line, branch, and statement coverage. Every
  one of your 39 tests executes it. Coverage measures whether a line ran, not whether it ran
  against realistic inputs. Mutation testing wouldn't help either: the bug isn't a wrong operator,
  it's a wrong assumption about a third-party contract's ABI.
- **The bug lives in the *boundary*, not the logic.** Your vault's accounting, share math, and
  access control may be flawless. The defect is entirely in the contract's model of an external
  dependency. Mocks are exactly the tool that removes boundaries from the test, so they are exactly
  the tool that cannot test boundaries. Test doubles verify your logic *given* your model of the
  world; only the real artifact verifies the model.
- **"Green since the first commit" is a warning sign, not a badge.** A suite that has never gone
  red has never demonstrated that it *can* go red for the class of failure you care about. It has
  demonstrated that your code agrees with itself. For an integration-heavy contract whose entire
  job is to talk to two foreign contracts (an arbitrary ERC-20 and Aave), a 39/39 all-mock suite
  is testing approximately none of the risk surface.
- **This specific bug is in every audit checklist.** USDT, BNB, OMG, and a long tail of pre-2018
  tokens omit return values; USDT, KNC, and others have the zero-first allowance guard. That the
  suite still shipped it is evidence about the *methodology*, not about diligence.

The general rule: **a mock can never falsify a belief you also used to write the mock.** The only
way to test a belief about an external contract is to execute against that contract, or against a
double deliberately built to violate the belief.

---

## 4. Fix 1 — the code change

Replace the raw `approve` with SafeERC20's `forceApprove`, which handles *both* USDT deviations:
it tolerates empty return data, and on failure it retries with a `0` reset first.

```solidity
using SafeERC20 for IERC20;

function deposit(uint256 amount) external {
    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.forceApprove(address(aavePool), amount);   // <-- was usdt.approve(...)
    aavePool.supply(address(usdt), amount, address(this), 0);
}
```

`forceApprove` requires **OpenZeppelin Contracts >= 4.9** (it is the supported form in 5.x). Check
your version; if you are on an older 4.x, upgrade rather than reaching for the deprecated
`safeApprove`, which reverts on a nonzero-to-nonzero change instead of handling it.

For reference, that is doing this, via `_callOptionalReturn`:

```solidity
// conceptually
(bool ok, bytes memory ret) = address(token).call(
    abi.encodeCall(IERC20.approve, (spender, value))
);
// accept when: ok AND (ret is empty AND token has code) OR abi.decode(ret,(bool)) == true
// if that fails: call approve(spender, 0) first, then approve(spender, value)
```

### Equivalent / additional hardening

- **Prefer `safeIncreaseAllowance`** if you want to add to an existing allowance rather than
  overwrite it.
- **Zero out leftover allowance** after the external call if the integration might not consume the
  full amount:
  ```solidity
  usdt.forceApprove(address(aavePool), amount);
  aavePool.supply(address(usdt), amount, address(this), 0);
  usdt.forceApprove(address(aavePool), 0);   // no dangling approval
  ```
  Aave's `supply` pulls the exact amount, so this is belt-and-braces — but it is cheap insurance
  and it makes the invariant ("this vault never leaves a standing allowance") explicit.
- **Measure the received balance** instead of trusting `amount`, if you want to be safe against
  fee-on-transfer tokens generally (USDT's fee is currently 0 but the switch exists):
  ```solidity
  uint256 before = usdt.balanceOf(address(this));
  usdt.safeTransferFrom(msg.sender, address(this), amount);
  uint256 received = usdt.balanceOf(address(this)) - before;
  // then approve/supply/credit shares using `received`, not `amount`
  ```
  This is a separate bug class from the one that bit you; fix it while you're in here if the vault
  is meant to support arbitrary underlyings.
- **Audit every other token call site in the codebase** for the same `using`-bypass. Grep for
  `.approve(`, `.transfer(`, `.transferFrom(` with no `safe`/`force` prefix — this bug is rarely
  alone, because the misunderstanding that produced it is file-wide:
  ```bash
  grep -rnE '\.(approve|transfer|transferFrom)\(' src/ | grep -vE '\.(safe|force)'
  ```
- **Add a lint rule / CI grep** so that pattern can never reappear. Slither's
  `unchecked-transfer` / `incorrect-erc20-interface` detectors catch this class too — wire Slither
  into CI as a gate, not an occasional manual run.

### Redeployment

The bug is in deployed bytecode. If the vault is not upgradeable, this requires a new deployment
and a migration; if it is upgradeable, an implementation upgrade. Either way, check whether any
USDT is currently stranded in the vault — deposits reverted and unwound, so probably not, but
verify balances before you decommission the old address, and confirm nothing else (a
`rescueTokens`-style path, or direct transfers) left funds there.

---

## 5. Fix 2 — the change in testing practice

The code fix closes one hole. The practice fix is what stops the next one, and it is the more
important half of the answer.

### 5.1 Fork-test against the real deployed token — this is the non-negotiable one

Run the integration path against mainnet state at a pinned block, using the real USDT and the real
Aave V3 pool. In Foundry:

```solidity
contract VaultUsdtForkTest is Test {
    address constant USDT  = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant POOL  = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2; // Aave V3 mainnet Pool

    Vault vault;
    address alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 20_000_000); // PIN the block
        vault = new Vault(USDT, POOL);
    }

    function test_deposit_realUsdt() public {
        deal(USDT, alice, 1_000e6);                 // USDT has 6 decimals
        vm.startPrank(alice);
        IERC20(USDT).approve(address(vault), 1_000e6);
        vault.deposit(1_000e6);                     // reverts with 0-length data on the old code
        vm.stopPrank();
        assertGt(vault.balanceOf(alice), 0);
    }

    function test_deposit_twice_realUsdt() public { /* catches the zero-first allowance guard */ }
}
```

Notes that matter in practice:

- **Pin the block.** An unpinned fork makes your CI non-deterministic and dependent on live chain
  state. Pin it, and bump it deliberately.
- **`deal` may need `deal(USDT, to, amt, true)`** (adjust total supply) or whale impersonation via
  `vm.prank`, since USDT's storage layout can confuse naive balance cheats. Verify with an
  assertion on `balanceOf` right after dealing, so a silent no-op deal can't make the test
  vacuously pass.
- **Test deposit *twice*** in the same test. A single deposit would not have caught the zero-first
  allowance guard.
- **Keep the fork suite separate** (`test/fork/`, its own CI job) so it can be slower and can be
  skipped locally when no RPC is configured — but make it a **required check on the merge branch**,
  not an optional one. A fork suite that only runs when someone remembers is not a control.

Rule of thumb: **any contract whose deployment address is a constructor argument or constant
deserves a fork test against that exact address before that address is used in production.** The
mock suite proves your logic; the fork suite proves your assumptions.

### 5.2 Test the matrix of real tokens you claim to support

If the vault is generic over underlyings, parametrize the fork test over the tokens you will
actually list, including the awkward ones. Each represents a different deviation:

| Token | Deviation |
|---|---|
| USDT | no return value on `approve`/`transfer`; zero-first allowance guard; fee switch exists |
| USDC | upgradeable proxy; blocklist; 6 decimals |
| BNB (ERC-20) | no return value on `transfer` |
| DAI | 18 decimals; `permit` with a non-EIP-2612 signature |
| stETH | rebasing; 1-wei transfer rounding |
| WBTC | 8 decimals; pausable |

A table-driven fork test over this list is maybe 60 lines and permanently retires an entire bug
class. If the vault is *only* ever going to hold USDT, say so in the code (immutable, documented)
and test that one path properly — but then don't advertise it as generic.

### 5.3 Make at least one mock adversarial

Keep `MockERC20`, but stop letting it be the only double. Add doubles that deliberately violate
the standard, so the unit suite (fast, no RPC) also exercises non-compliance:

```solidity
contract MockNoReturnERC20 {              // models USDT: no return values
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function approve(address s, uint256 v) public {
        require(!(v != 0 && allowance[msg.sender][s] != 0), "unsafe approve"); // zero-first guard
        allowance[msg.sender][s] = v;
    }
    function transfer(address to, uint256 v) public { /* ... no return ... */ }
    function transferFrom(address f, address t, uint256 v) public { /* ... no return ... */ }
}
```

Plus siblings for the other hostile shapes: `MockReturnsFalseERC20` (returns `false` instead of
reverting), `MockFeeOnTransferERC20`, `MockReentrantERC20` (ERC-777-style hook), `MockRebasingERC20`.
Then run the *same* deposit/withdraw test body against every double. This is the cheap, fast layer
that catches the bug in 200ms; the fork suite is the expensive layer that catches what you didn't
think to mock.

The principle: **a test double's job is to be adversarial, not cooperative.** A double that
implements your happy path is a restatement of your assumptions; a double that attacks them is a
test. If every mock in the repo is a well-behaved OZ reference implementation, the mock layer is
decorative.

### 5.4 Treat "the suite has never been red" as a finding

Institute the cheap discipline that would have exposed the gap without any of the above:
before trusting a test, **break the thing it claims to cover and confirm it fails**. If you had
pointed one test at a no-return-value token — or even just asked "what would a USDT-shaped token
do to line 2?" — the 39 green tests would have been correctly reclassified as 39 tests of a
world that doesn't exist at `0xdAC17F9...`.

Related habits worth adopting in the same pass:

- **Pre-deployment checklist item:** "Has the exact (token, integration) pair for this deployment
  been executed on a fork?" Nothing ships to mainnet with an address that has never been
  transacted against in a test.
- **Testnet/simulation dry-run:** simulate the first production transaction against forked mainnet
  with the *actual* deployment parameters (real token, real pool, real deployer) before signing
  it. This catches configuration errors as well as code errors, and costs one command.
- **Run Slither/Aderyn in CI.** Static analysis flags unchecked ERC-20 return values mechanically.
  It would have caught this without anyone having to know about USDT.

---

## 6. One-paragraph summary

`usdt.approve(...)` bypassed SafeERC20 because `using A for B` only resolves methods that `B`
doesn't already declare, and `IERC20` declares `approve` — so the compiler emitted a raw call plus
an ABI-decode of a `bool`. Real USDT's `approve` returns no data, so the compiler's
`returndatasize < 32` check fired `revert(0,0)`: a reasonless revert in your own frame, after the
token call itself succeeded. The stock OpenZeppelin `MockERC20` returns `true`, so the decode
always succeeded in tests — and because the mock and the vault were both written against the same
`IERC20` assumption, no quantity of mock-based tests could ever have disagreed with it. Fix the
code with `forceApprove` (which also handles USDT's zero-first allowance guard), and fix the
process by fork-testing the deposit path against the real token at the real address, plus adding
deliberately non-compliant mocks to the fast suite.

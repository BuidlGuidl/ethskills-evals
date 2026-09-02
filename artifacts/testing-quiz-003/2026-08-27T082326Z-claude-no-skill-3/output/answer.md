# Why deposits revert on mainnet USDT but never against the mock

## TL;DR

`usdt.approve(...)` is a **raw `IERC20` call, not a SafeERC20 call**. Real USDT's
`approve` returns **no data**. Solidity's high-level call expects to decode a `bool`,
finds `returndatasize() == 0`, and reverts with **empty revert data**. The mock is a
stock OpenZeppelin ERC20, which returns `true`, so the decode always succeeds and the
line is never exercised in its failing mode.

`using SafeERC20 for IERC20` did nothing on that line — see §3.

---

## 1. Why it reverts against deployed USDT

Mainnet USDT (`0xdAC17F958D2ee523a2206206994597C13D831ec7`) predates final ERC-20
adoption. Its actual on-chain signatures are:

```solidity
function transfer(address _to, uint _value) public;                    // no return
function transferFrom(address _from, address _to, uint _value) public; // no return
function approve(address _spender, uint _value) public;                // no return
```

Note the missing `returns (bool)`. The **function selector is identical** to the
standard one — `approve(address,uint256)` — so the call dispatches and the state
change happens. The token is fine. The caller is not.

When you write `usdt.approve(spender, amount)` through an `IERC20` typed variable,
solc emits (Solidity ≥ 0.4.22):

1. `call` to the selector,
2. `if (!success) bubble revert`,
3. **`if (returndatasize() < 32) revert(0, 0)`**,
4. `abi.decode(returndata, (bool))`,
5. `if (!decoded) revert(0,0)` — well, actually the interface just returns it; the
   `require` on the return value is the *caller's* job, but the length check in (3)
   is unconditional.

Step 3 is the killer. USDT's `approve` returns zero bytes. The return-data length
check fails and solc reverts with **no reason string and no error selector** — which
is exactly the symptom you described.

**The fingerprint matters.** An empty revert with zero return data is the signature
of an ABI-decode failure (or an OOG, or a call into an EOA/empty address). It is
*not* what Aave V3 produces — Aave reverts with `Errors` strings/codes (e.g. `"27"`
= `RESERVE_INACTIVE`, `"43"` = `SUPPLY_CAP_EXCEEDED`), which would carry data. So the
absence of a reason string already localizes the failure to line 2, before you read a
single trace. Your own observation that line 1 succeeds confirms it: the token address
is right, the allowance/balance are right, `transferFrom` went through — because line 1
went through `SafeERC20`.

You can confirm in one command:

```bash
# Decodes fine — no return value to decode:
cast call 0xdAC17F958D2ee523a2206206994597C13D831ec7 "approve(address,uint256)" \
  0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 1000000
# -> 0x   (empty returndata)

# Same call typed as returning bool — this is what solc is trying to do:
cast call 0xdAC17F958D2ee523a2206206994597C13D831ec7 "approve(address,uint256)(bool)" \
  0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 1000000
# -> decode error
```

### 1b. The second landmine behind the first

Even after you fix the decode, USDT has a *second* non-standard behavior:

```solidity
// USDT's approve body:
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

A non-zero → non-zero allowance change **reverts**. Today that's masked because Aave
pulls the full `amount` and drives the allowance back to zero. But any path that leaves
residual allowance — a partial pull, a fee-on-transfer deduction, a reverted-and-retried
supply, a supply cap causing a smaller pull — leaves dust, and the *next* deposit reverts
permanently. The correct fix (§4) closes both holes at once; a fix that only handles the
missing return value leaves this one armed.

### 1c. And a third, same family

USDT has an owner-settable transfer fee (`basisPointsRate` / `maximumFee`, capped at
20 bps). It is currently 0 and has always been 0, but it is live code behind an `onlyOwner`
setter. If it is ever set, `amount` transferred ≠ `amount` received, and you would then
approve and supply more than you hold. Flagging it as the same class of bug; see §4b.

---

## 2. Why it never reverts against the mock

Your `MockERC20` is a stock OpenZeppelin `ERC20`. OZ's `approve` is:

```solidity
function approve(address spender, uint256 value) public virtual returns (bool) {
    _approve(_msgSender(), spender, value);
    return true;                       // <-- 32 bytes of returndata
}
```

Fully conformant. `returndatasize()` is 32, the decode succeeds, `true` comes back.
There is no state of the world in which that line reverts.

Matching the **6 decimals** felt like fidelity, but decimals were never the axis of
divergence. You matched the one property that was already compatible and left
unmatched the three that weren't (return-data shape, approve-race guard, fee hook).
A mock that matches on the wrong dimension is more dangerous than an obviously crude
one, because it buys confidence it hasn't earned.

The deeper point: **a mock is a second copy of your assumption, not an independent
check on it.** You believed USDT behaves like OZ ERC20. You wrote that belief into
`MockERC20`. Then you wrote 39 tests asserting that your contract works against that
belief. The suite is internally consistent and says nothing about mainnet. The single
fact that had to be true — "the deployed bytecode at `0xdAC1…` returns a bool from
`approve`" — is nowhere in the test suite, because that address is never loaded.

---

## 3. Why `using SafeERC20 for IERC20` did not protect that line

This is the part worth internalizing, because it is a **silent** failure that compiles
clean and reads as safe in review.

`using A for B` attaches library functions as *additional* members of type `B`. It does
**not** override, wrap, or intercept members that `B` already has. Solidity member
lookup resolves against the type's own members first.

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(a, b, x); // `safeTransferFrom` is NOT on IERC20
                                // -> resolves to SafeERC20.safeTransferFrom  ✅ protected

usdt.approve(spender, x);       // `approve` IS on IERC20
                                // -> resolves to IERC20.approve              ❌ raw call
```

Line 1 worked *by accident of naming*. `SafeERC20`'s protective functions all have
names that don't collide with `IERC20`'s (`safeTransfer`, `safeTransferFrom`,
`safeIncreaseAllowance`, `safeDecreaseAllowance`, `forceApprove`) — precisely so that
`using for` can attach them. The protection is opt-in **per call site, by spelling a
different function name**. Nothing forces you to.

So `SafeERC20` never had a chance to run on line 2. Its whole mechanism — call via
`functionCall`, then `require(returndata.length == 0 || abi.decode(returndata,(bool)))`
— which is *exactly* the check that tolerates USDT's empty return, was simply never
invoked.

The same trap applies to `usdt.transfer(...)` and `usdt.transferFrom(...)`: writing
those bare names anywhere in a `using SafeERC20 for IERC20` file gives you an
unprotected call that looks protected. The `using` directive at the top of the file is
a facility, not a guarantee, and it reads to a human reviewer like a guarantee. That
gap is where this bug lived.

---

## 4. Fix 1 — the code change

```solidity
using SafeERC20 for IERC20;

token.safeTransferFrom(msg.sender, address(this), amount);
token.forceApprove(address(aavePool), amount);   // <-- the change
aavePool.supply(address(token), amount, address(this), 0);
```

`SafeERC20.forceApprove` (OpenZeppelin ≥ 4.9; the canonical form in v5):

```solidity
function forceApprove(IERC20 token, address spender, uint256 value) internal {
    bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));
    if (!_callOptionalReturnBool(token, approvalCall)) {
        _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
        _callOptionalReturn(token, approvalCall);
    }
}
```

This closes both §1 and §1b in one primitive:

- `_callOptionalReturn*` accepts **empty returndata** as success — fixes the decode revert.
- The zero-then-set retry survives USDT's non-zero → non-zero guard — fixes the latent
  second-deposit failure.

**Do not use `safeApprove`.** It is deprecated in OZ 4.x and **removed in 5.x**, and it
reverts on any non-zero → non-zero change rather than handling it. If you are pinned to
OZ < 4.9, the manual equivalent is:

```solidity
token.safeApprove(address(aavePool), 0);
token.safeApprove(address(aavePool), amount);
```

but the right move is to upgrade OZ and use `forceApprove`.

Then enforce it so it can't come back — a CI grep is enough and takes a minute:

```bash
# fail the build on any bare ERC20 mutator call
! grep -rnE '\.(approve|transfer|transferFrom)\(' src/ \
  | grep -vE '(safeTransfer|safeTransferFrom|forceApprove|safeIncreaseAllowance|safeDecreaseAllowance)'
```

Slither's `unused-return` / `unchecked-transfer` detectors cover part of this too; run
both. The point is that "did someone remember to type `safe`" must not be a code-review
responsibility.

### 4b. Adjacent hardening (same class, worth doing now)

Since you're touching this path, supply what you actually received rather than what you
asked for. This makes the vault correct for fee-on-transfer tokens generally, including
USDT-if-the-fee-is-ever-switched-on:

```solidity
uint256 before = token.balanceOf(address(this));
token.safeTransferFrom(msg.sender, address(this), amount);
uint256 received = token.balanceOf(address(this)) - before;

token.forceApprove(address(aavePool), received);
aavePool.supply(address(token), received, address(this), 0);
```

Credit the depositor `received`, not `amount`. Otherwise a fee turns into a solvency
gap that the last withdrawer eats. (If your accounting elsewhere assumes
`deposited == amount`, this needs a wider look than a three-line patch — flagged in the
open questions.)

---

## 5. Fix 2 — the change in testing practice

The code fix takes one line. This is the part that actually prevents the next one.

### The diagnosis

Your suite tests `Vault × MockERC20`. You shipped `Vault × USDT`. Those are different
systems, and the suite never touched the one you shipped. **Mock-based tests can only
falsify claims about your code. They cannot falsify claims about someone else's
deployed bytecode.** The bug was a claim of the second kind, so no quantity of tests of
the first kind — more cases, fuzzing, invariants, 100% branch coverage — could reach it.
Coverage measures which of *your* lines ran, and every one of your lines did run. The
untested thing wasn't a line, it was an assumption.

That "green since the first commit, 39/39" is itself the warning sign. A suite that has
never gone red has never told you anything you didn't already believe. Tests earn trust
by failing when a belief is wrong; a suite that only ever confirms is a mirror.

### The practices

**1. Fork tests are mandatory for every external integration. This is the fix.**

Every contract you don't deploy — token, pool, oracle, router — gets exercised at its
real mainnet address, at a pinned block, in CI.

```solidity
contract VaultForkTest is Test {
    address constant USDT      = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 20_000_000); // pin it
        vault = new Vault(IERC20(USDT), IPool(AAVE_POOL));
    }

    function test_deposit() public {
        deal(USDT, alice, 1_000e6);
        vm.startPrank(alice);
        IERC20(USDT).approve(address(vault), 1_000e6);
        vault.deposit(1_000e6);
        vm.stopPrank();
        assertGt(IERC20(aUSDT).balanceOf(address(vault)), 0);
    }

    function test_secondDepositAlsoWorks() public { /* catches §1b */ }
}
```

Pin the block so it's deterministic and cacheable. This exact test fails on the current
code, at line 2, with empty revert data — before mainnet, in under a second of RPC time.

**2. Promote fork tests to a release gate.** Not "we have some fork tests." The rule is:
*no deployment against an asset that has no passing fork test at its real address.* Make
it a checklist item on the deploy runbook, and a required CI job. This is the single
control that would have stopped this deploy.

**3. Keep the mocks — but add adversarial ones.** Mocks are still right for the fast
inner loop (accounting math, access control, pause logic, reverts-on-bad-input) and they
run with no RPC. What was missing is a mock built to *break* you rather than to agree
with you. Ship a small token-behavior zoo:

- `MockNoReturnERC20` — `approve`/`transfer`/`transferFrom` return nothing (USDT, BNB, OMG)
- `MockApproveRaceGuardERC20` — reverts on non-zero → non-zero approve (USDT)
- `MockFeeOnTransferERC20` — credits `amount - fee` (USDT-if-enabled, PAXG, STA)
- `MockReturnsFalseERC20` — returns `false` instead of reverting (older ZRX)
- `MockRebasingERC20` — balance changes with no transfer (stETH, AMPL)
- `MockBlocklistERC20` — `transfer` reverts for listed addresses (USDT, USDC)
- Plus decimals ∈ {6, 8, 18} as an orthogonal axis

Then **parameterize the whole suite over that matrix**, don't bolt on one extra test:

```solidity
abstract contract VaultBehaviorTest is Test {
    function _token() internal virtual returns (IERC20);  // subclass supplies
    // ... all 39 tests here, written once ...
}
contract VaultTest_Standard   is VaultBehaviorTest { function _token() ... }
contract VaultTest_NoReturn   is VaultBehaviorTest { function _token() ... }  // fails today
contract VaultTest_ApproveRace is VaultBehaviorTest { function _token() ... }  // fails after a partial fix
contract VaultTest_FeeOnXfer  is VaultBehaviorTest { function _token() ... }  // fails on §4b
```

39 tests become 39 × N, cost you almost nothing, and turn red the moment someone writes
a bare `.approve(`. This is the cheap, RPC-free half of the fix; fork tests are the
authoritative half. Do both — the matrix gives fast feedback, the fork test gives ground
truth.

**4. Deploy-parameter review as an explicit step.** The mainnet constructor arg
(`USDT`) was never named in any test. Any address that appears in a deploy script and
nowhere in the test suite is, by definition, untested configuration. Diff those two sets
mechanically before every deploy.

**5. Read the token before integrating it.** For any new asset, pull the verified source
from Etherscan and check five things: return values on the mutators, approve-race guard,
fee-on-transfer, blocklist/pausability, upgradeability. Five minutes, written into the
integration checklist. USDT fails three of the five, and all three are public knowledge
that predates your repo by years.

### The principle

Mocks test that your code matches your model of the world. Fork tests test that your
model of the world matches the world. You had 39 of the first kind and zero of the
second, and the bug lived exactly in the gap. Keep the mocks for speed; add fork tests
for truth; never let the second set be empty for an address you're about to send real
money to.

---

## Open questions

1. **OZ version?** `forceApprove` needs ≥ 4.9. If you're on 4.8 or earlier, is upgrading
   OZ in scope now, or do you want the interim `safeApprove(0)` + `safeApprove(amount)`?
2. **Does §4b (`received` vs `amount`) ripple into share accounting?** If deposits mint
   shares off `amount`, switching to `received` needs the mint path changed together —
   worth confirming before I'd call that patch complete.
3. **Is the deployed vault upgradeable, or does this need a redeploy + migration?** Changes
   the shape of the remediation and whether funds are currently stuck.
4. **Other assets planned?** If USDC/DAI/stETH are on the roadmap, the token-behavior
   matrix in §5.3 is worth building now rather than per-incident (stETH in particular
   breaks a different assumption — rebasing balances).
5. **Is there a mainnet RPC available in CI?** Fork tests need one (an archive node for
   old pinned blocks). If not, that's the first blocker to clear.

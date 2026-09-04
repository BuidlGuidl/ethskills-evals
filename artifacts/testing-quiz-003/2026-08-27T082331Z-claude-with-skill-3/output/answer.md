# Why deposits revert on mainnet USDT but never against the mock

## Short version

Line 2 — `usdt.approve(...)` — is a **raw interface call**, not a SafeERC20 call. Real USDT's
`approve` returns **nothing**. `IERC20.approve` is declared `returns (bool)`. The compiler
therefore emits a return-data decode after the CALL, the decode finds 0 bytes, and it
`revert(0, 0)` — a revert with no reason string. That is the exact symptom you're seeing.

Line 1 survives because it *was* routed through SafeERC20, which tolerates the empty return.
Line 3 is never reached.

---

## 1. Why it reverts against real USDT

Deployed USDT (`0xdAC17F958D2ee523a2206206994597C13D831ec7`) predates the finalized ERC-20
ABI. Its `TetherToken` source declares:

```solidity
function transfer(address _to, uint _value) public onlyPayloadSize(2 * 32);
function transferFrom(address _from, address _to, uint _value) public onlyPayloadSize(3 * 32);
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32);
```

No `returns (bool)`. The call succeeds at the EVM level and returns `returndatasize() == 0`.

Your contract calls it through `IERC20`, whose `approve` **is** declared `returns (bool)`.
For a high-level call with a declared return value, solc emits roughly:

```
call(...)                      // succeeds
if iszero(returndatasize() >= 32) { revert(0, 0) }   // <-- dies here
abi.decode(returndata, (bool))
```

The token did its job — the allowance is set — and then *your* contract reverts trying to
decode a return value that was never produced. An empty `revert(0, 0)` has no reason string
and no error selector, which is why the on-chain failure is silent.

There is a **second, independent USDT landmine** on the same line, which you would have hit
next even if the decode had been fine:

```solidity
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

USDT refuses any non-zero → non-zero allowance change. Aave's `supply` normally pulls the
whole approved amount and drives the allowance back to 0, so this survives the happy path —
but any residual allowance (a partially-consumed approval, a reverted-and-retried supply,
a leftover from a paused pool) permanently bricks every future deposit. Also an empty
`require`, also no reason string. Fix both at once.

---

## 2. Why SafeERC20 did not protect the failing line

`using SafeERC20 for IERC20` does **not** wrap the type. It attaches library functions as
candidate members, and Solidity's resolution order puts the type's own members first:

- `usdt.safeTransferFrom(...)` → not a member of `IERC20`, so it resolves to the library. Safe.
- `usdt.approve(...)` → **is** a member of `IERC20`, so it resolves to the interface. Raw call.

Attached functions never shadow real members, so there was no ambiguity, no warning, no error.
And OpenZeppelin deliberately does not define `SafeERC20.approve` — v5 exposes
`forceApprove` / `safeIncreaseAllowance` / `safeDecreaseAllowance` (v4 also had `safeApprove`).
There was never even a candidate to shadow with.

The lesson: **SafeERC20 is opt-in per call site, not a property of the variable.** One `safe`
prefix on line 1 buys you nothing on line 2. `usdt` being typed `IERC20` and the `using`
directive being present at the top of the file both create a false impression of blanket
protection.

---

## 3. Why no amount of mock-based testing would have found it

Your `MockERC20` is stock OpenZeppelin ERC20 with `decimals() == 6`. Its `approve` returns
`true`, 32 bytes, so the decode succeeds and the line passes. It has no approve-race guard,
so that path passes too.

The structural reason more tests wouldn't help:

- **A mock encodes your beliefs about the dependency; a test against it can only fail if your
  code disagrees with your own beliefs.** This bug is a disagreement between your beliefs and
  reality — 2017 bytecode that predates the spec you assumed. Your code and your mock agreed
  perfectly. That is precisely why it was green.
- **You ported the quirk you could see and normalized the one you couldn't.** Someone knew
  USDT is 6-decimals and set that on the mock. Nobody set "returns no data," because that
  quirk is invisible in Solidity source and in every `IERC20` interface you'd read.
- **Fuzzing and invariants vary the wrong axis.** They vary inputs and call ordering over
  *fixed counterparty code*. The failing variable here is *which counterparty bytecode is
  deployed*. 10,000 fuzz runs and 512 invariant sequences all execute the same
  `MockERC20.approve`. The failing input is not in the sample space, so more samples cannot
  reach it.
- **Coverage measures your code, not your integration surface.** You can have 100% line and
  branch coverage on a vault whose only real-world dependency has never been executed once.
- **"39/39 green since the first commit" is a warning sign, not a comfort.** A suite that has
  never gone red has never demonstrated it can detect anything. It documented the design; it
  never tested it.

---

## 4. Fix 1 — the code change

**OpenZeppelin v5:**

```solidity
using SafeERC20 for IERC20;

function deposit(uint256 amount) external {
    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.forceApprove(address(aavePool), amount);          // was: usdt.approve(...)
    aavePool.supply(address(usdt), amount, address(this), 0);
}
```

`forceApprove` fixes both USDT problems:
- it routes through `_callOptionalReturn`, which accepts **empty return data OR a decoded
  `true`** (and asserts the target has code), so the missing return value is fine;
- on failure it retries as `approve(spender, 0)` then `approve(spender, amount)`, which
  satisfies the non-zero → non-zero guard.

**OpenZeppelin v4.x** (no `forceApprove`):

```solidity
usdt.safeApprove(address(aavePool), 0);
usdt.safeApprove(address(aavePool), amount);
```

**Sweep the rest of the codebase for the same shape.** Every bare `.approve(`, `.transfer(`,
`.transferFrom(` on an `IERC20`-typed variable is the same bug waiting for a different token.
Make it mechanical — a CI grep gate is enough:

```bash
! grep -rnE '\.(approve|transfer|transferFrom)\(' src/ --include='*.sol'
```

(Slither's `unchecked-transfer` detector covers the related "ignored return value" case; the
grep covers this one.)

Two USDT hardening notes while you're in there, if the vault will ever hold real balances:
- Tether has a fee switch (`basisPointsRate`, currently 0). If it is ever enabled, the amount
  you *receive* is less than `amount`. Credit shares off the measured balance delta around the
  `safeTransferFrom`, not off the `amount` argument.
- USDT has a blocklist and a global pause. Deposits and withdrawals must fail cleanly, and
  nothing in the vault should assume a transfer to an arbitrary address will succeed.

Deployment note: nothing is stuck — every deposit reverted, so no user funds are trapped. But
the deployed vault cannot be fixed in place unless it is behind a proxy; otherwise redeploy and
re-point.

---

## 5. Fix 2 — the change in testing practice

**The rule: no external integration ships without at least one test executing against the
real deployed bytecode, at the real production address.** Mocks are for exercising *your*
branches quickly; forks are for proving the integration exists. They are not substitutes.

Add a fork test:

```solidity
// test/fork/VaultUsdt.fork.t.sol
contract VaultUsdtForkTest is Test {
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fa4E2; // verify vs
                                        // Aave's official address book before pinning
    address alice = makeAddr("alice");
    Vault vault;

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 20_000_000); // pinned = reproducible
        vault = new Vault(IERC20(USDT), IPool(AAVE_V3_POOL));
        deal(USDT, alice, 10_000e6, true); // true => also adjust totalSupply
    }

    function test_DepositSuppliesToAave() public {
        vm.startPrank(alice);
        IERC20(USDT).forceApprove(address(vault), 10_000e6); // even the *test* must not
        vault.deposit(10_000e6);                             // call USDT.approve raw
        vm.stopPrank();

        assertGt(IERC20(AUSDT).balanceOf(address(vault)), 0, "no aUSDT received");
        assertEq(IERC20(USDT).balanceOf(address(vault)), 0, "USDT stranded in vault");
    }

    // This one specifically catches the non-zero -> non-zero allowance guard.
    function test_SecondDepositSucceeds() public {
        _deposit(alice, 5_000e6);
        _deposit(alice, 5_000e6);
    }

    function testFuzz_DepositWithdrawRoundtrip(uint256 amount) public {
        amount = bound(amount, 1e6, 1_000_000e6);
        // ... deposit then withdraw, assert alice is made whole within rounding
    }
}
```

Notes that matter in practice:
- If `deal` can't locate the balance slot for a given token, fall back to
  `vm.prank(<whale>)` + `transfer`. For USDT, `deal` works.
- **Pin the block** for CI determinism. Also run a **nightly job at latest block** — the Aave
  V3 `Pool` is an upgradeable proxy and USDT is admin-controlled; a pinned fork will never
  tell you they changed under you.
- Wire `MAINNET_RPC_URL` as a CI secret and make the fork job **required**, not
  best-effort-skipped. A fork suite that silently no-ops when the RPC key is missing is
  exactly as useful as no fork suite.

**Second layer, cheap and RPC-free — test against hostile mocks, not friendly ones.** Keep a
`MockUSDTLike` next to `MockERC20`: no return values on `transfer`/`transferFrom`/`approve`,
the non-zero→non-zero allowance guard, an optional transfer fee, a blocklist. Parameterize the
existing suite over both mocks. See `d-xo/weird-erc20` for a ready-made set. This turns
"39 green tests" into 78, half of which are actually adversarial.

**Third, a process rule:** a suite that has been green since the first commit has not been
validated. Before trusting a new integration test, break the thing it claims to check and
confirm it goes red. Had someone mutated `safeTransferFrom` → `transfer` on line 1 and watched
the mock suite stay green, the whole class of defect would have surfaced in an afternoon.

### Pre-deploy checklist for the next integration

- [ ] Fork test against the real token address, pinned block, in required CI
- [ ] Fork test against the real protocol address (Aave `Pool` proxy), not a mock
- [ ] Second-deposit / repeat-approval path tested (catches allowance guards)
- [ ] Non-compliant-token mock in the unit suite (no-return, fee-on-transfer, blocklist)
- [ ] CI gate: zero bare `.approve` / `.transfer` / `.transferFrom` in `src/`
- [ ] Every new test verified to fail when its target is broken

# Why 100% line coverage missed the fee bricking

## Short version

`setDepositFee` has no upper bound. Coverage measures **which lines ran**, not **which
values ran through them**, and it can never flag a `require` that was never written.
The suite exercised three fee values that all live in the same equivalence class
(`0 <= bps << 10_000`, fee strictly smaller than the deposit) and never crossed the
boundary at `BPS_DENOMINATOR`. Ops crossed it.

---

## 1. What coverage actually measured

Both functions are straight-line code. There are no branches in the setter at all,
and the only branch in `deposit()` (`if (shares == 0) revert`) is a revert path, not
a value check. So:

- **One** call to `setDepositFee` with **any** argument = 100% of that function's lines.
- **One** successful deposit = every fee-maths line in `deposit()`.

The three fee values (0, 10, 25 bps) are therefore redundant *for coverage purposes*.
The 2nd and 3rd tests added zero coverage; they only added confidence, and confidence
in exactly the region that was already fine.

The deeper point: the bug is a **missing line** — the absent
`if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();`. Line coverage is a metric over
the code that exists. A missing validation branch has no line to be uncovered, so no
coverage tool on earth can report it as a gap. **100% coverage is an upper bound on
"we ran the code", never on "we tried the inputs."**

## 2. The class of input it never tried

The whole suite lives inside one equivalence class of `depositFeeBps`:

| class | range | tested? | behaviour |
|---|---|---|---|
| no fee | `0` | yes | `fee = 0`, `net = amount` |
| sane fee | `1 .. 9_999` | 10, 25 | `fee < amount`, `net > 0` — deposits work |
| **total fee** | **`10_000`** | **no** | `net = 0` → `shares == 0` → `NoSharesMinted` |
| **over-100%** | **`> 10_000`** | **no** | `fee > amount` → `amount - fee` **underflows** → panic `0x11` |

0, 10 and 25 are three samples from a single class. Sampling the same class three
times gives you one test's worth of information. The failure lives at and past the
`10_000` boundary — a region no fixed-value test in the suite ever addresses, and one
that no amount of re-sampling *inside* the sane range can reach.

The other two tests can't help either, and it's worth being explicit about why:

- The **event test** asserts `DepositFeeUpdated(prev, new)` — it asserts the setter
  faithfully reports what it stored. It is an assertion about bookkeeping, not about
  admissibility, and it passes *more* enthusiastically the more absurd the value is.
- The **onlyOwner test** asserts *who* may call it. Every access-control test in the
  world is silent on *what* the authorized caller is allowed to pass. Ops **were** the
  owner. Authorization was working perfectly at the moment the vault bricked.

There is also a second, quieter version of the same bug the suite can't see: for
`feeBps` merely *large* (say 9_900), big deposits still work but small ones round
`convertToShares(netAmount)` to 0 and revert. Ops picked a value that killed all
deposits, so it was found in a day. A value of 9_900 would have silently killed only
small depositors — much longer to notice.

## 3. The arithmetic

Take a 1,000-token deposit, 18 decimals: `amount = 1_000e18`.

**Boundary — `depositFeeBps = 10_000` ("100%", or someone typing 10000 meaning "100.00%"):**

```
fee       = (1_000e18 * 10_000) / 10_000 = 1_000e18
netAmount = 1_000e18 - 1_000e18         = 0
shares    = convertToShares(0)          = 0
                                        -> revert NoSharesMinted()
```

Note `fee` is scaled by `amount`, so this holds for *every* `amount`: `netAmount` is
identically 0 and **every deposit of every size reverts**. Matches the symptom exactly.

**Past the boundary — `depositFeeBps = 100_00` misread, or a promo typed as `50_000`:**

```
fee       = (1_000e18 * 50_000) / 10_000 = 5_000e18
netAmount = 1_000e18 - 5_000e18          -> underflow
                                         -> Panic(0x11) arithmetic overflow
```

Solidity ≥0.8 reverts on the subtraction before the `shares == 0` check is ever
reached, so the vault doesn't even get to give the nice custom error.

**The classic off-by-a-factor that produces it:** ops wanted a "1% promo". 1% = 100 bps.
Typing `1e4` / `10000` because "fee is in bps and I want 100 of something" ends at
exactly the boundary above. The setter stores it, emits a proud event, and the vault
is dead.

## 4. The technique that would have caught it

**Fuzz the setter over its declared domain — `uint256`, not the range you assume is
legal — and assert a property, not an arithmetic identity.**

The trap to avoid first, because it's the natural thing to write and it reproduces the
exact blind spot:

```solidity
// USELESS HERE — bound() re-imposes the assumption under test
function testFuzz_Fee(uint256 amount, uint256 feeBps) public {
    feeBps = bound(feeBps, 0, 10_000);   // <-- the bug lives at and above this ceiling
    ...
}
```

Bounding the fuzzer to the range you believe is valid tests only the region already
covered. When the *validation itself* is the thing under test, the input must span the
parameter's real type.

```solidity
// test/VaultFee.t.sol
contract VaultFeeTest is Test {
    // Property: no owner-reachable fee can brick deposits.
    // Either the setter rejects the value, or deposits still work after it.
    function testFuzz_SetDepositFee_NeverBricksDeposits(uint256 feeBps, uint256 amount) public {
        amount = bound(amount, 1e6, 1e30);          // bound the *amount* (a real usage range)
        // feeBps deliberately UNBOUNDED — full uint256

        vm.prank(owner);
        try vault.setDepositFee(feeBps) {
            // accepted -> it must be usable
            assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "fee over 100% accepted");

            deal(address(token), alice, amount);
            vm.startPrank(alice);
            token.approve(address(vault), amount);
            uint256 shares = vault.deposit(amount, alice);   // must not revert
            vm.stopPrank();

            assertGt(shares, 0, "accepted fee mints zero shares");
        } catch {
            // rejected -> fine, that is the fix working
        }
    }

    // Boundary-value analysis: the three points that matter, pinned explicitly.
    function test_RevertWhen_FeeIsOneHundredPercent() public {
        vm.prank(owner);
        vm.expectRevert(Vault.FeeTooHigh.selector);
        vault.setDepositFee(10_000);
    }

    function test_RevertWhen_FeeExceedsDenominator() public {
        vm.prank(owner);
        vm.expectRevert(Vault.FeeTooHigh.selector);
        vault.setDepositFee(10_001);
    }

    function test_MaxAllowedFeeStillMintsShares() public {
        vm.prank(owner);
        vault.setDepositFee(vault.MAX_FEE_BPS());     // e.g. 1_000 = 10%
        // ... deposit succeeds, shares > 0
    }
}
```

Two techniques, and they're complementary:

1. **Fuzzing over the untruncated input domain** finds the class you didn't think of.
   Run it at `--fuzz-runs 10000`; Foundry seeds boundary values like `0`, `type(uint256).max`
   and small integers, so `10_000` and beyond get hit fast.
2. **Boundary-value analysis** pins the edges once found: `MAX_FEE_BPS`, `MAX_FEE_BPS + 1`,
   `9_999`, `10_000`, `10_001`. Fixed tests at boundaries are the regression net; the fuzzer
   is the discovery tool. Doing only #2 means you have to have already imagined the boundary.

**Stronger still — an invariant test with the admin in the handler.** Most vault
invariant suites only let the handler `deposit`/`withdraw`. Put `setDepositFee` in the
handler too, so random *admin* sequences are explored alongside user sequences:

```solidity
contract VaultHandler is Test {
    function setDepositFee(uint256 feeBps) public {   // unbounded on purpose
        vm.prank(vault.owner());
        try vault.setDepositFee(feeBps) {} catch {}
    }
    function deposit(uint256 amount) public { /* bound, deal, approve, deposit */ }
}

function invariant_DepositsAlwaysPossible() public {
    // a standard-size deposit must always mint shares, whatever config we reached
    assertGt(vault.previewDeposit(1_000e18), 0, "config reachable where deposits mint 0");
}
```

That formulates the actual business rule ops violated: *no reachable configuration may
make the vault stop accepting deposits.* That's a property of the system, not of a
function — which is why no per-function unit test, at any coverage percentage, was ever
going to state it.

## 5. The fix

```solidity
uint256 public constant MAX_FEE_BPS = 1_000;   // 10% — a policy ceiling, well under 100%

error FeeTooHigh(uint256 provided, uint256 max);

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

Cap at a **policy** maximum, not at `BPS_DENOMINATOR`. `<= 10_000` stops the underflow
but still permits 99.99%, which resurrects the rounding-to-zero-shares variant for small
depositors. Validate at the setter — the write point — rather than defensively at every
read; one check, one place, and the bad value never reaches storage.

---

## Takeaway

Coverage answers "did the tests execute this line?" The question that mattered was
"did the tests try a value from every class this line can receive?" — and the class that
broke the vault (`feeBps >= 10_000`) was never sampled, could not have been sampled by
three points chosen from the sane range, and could not have been reported missing by a
coverage tool because the code that should have rejected it did not exist to be uncovered.
Treat 100% coverage as a floor for test *reach*, never as evidence of input-domain
completeness. Fuzz anything an admin can set, over the parameter's real type.

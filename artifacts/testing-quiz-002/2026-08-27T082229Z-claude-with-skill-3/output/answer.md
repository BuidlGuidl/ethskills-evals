# Why 100% coverage missed the fee-setter footgun

## 1. Coverage measured the wrong thing

`forge coverage` answers *"was this line executed?"* — not *"was this line executed with a value that matters?"*

Both functions are straight-line: no `if`, no `require`, no loop, so there is exactly **one path** through each. A single test with a single fee value lights up 100% of both. The other three fee values and the `onlyOwner` test add literally zero coverage — they re-walk the same path. The metric was saturated after test #1 and then stayed flat no matter how many more values were added, which is precisely why it kept reporting green while the input space stayed unexplored.

Worse: the defect is a **missing line**, not a wrong one. The setter never validates `newFeeBps`. No coverage metric can flag an uncovered line that does not exist — coverage is computed over the code you wrote, not over the code you should have written. Line coverage is structurally blind to omitted validation. Anything expressed as "the contract silently accepts an input it has no meaning for" is invisible to it.

The setter is also not wrong in isolation. It stores a number, as advertised. The invariant it breaks — `depositFeeBps <= BPS_DENOMINATOR` — lives in `deposit()`, one function away, and nothing in the codebase or the suite ever wrote that invariant down. Unit tests that test each function alone can't see a cross-function invariant.

## 2. The class of input never tried

Partition the fee domain by what `deposit()` actually does with it:

| Partition | Range | `fee` vs `amount` | Result | Tested? |
|---|---|---|---|---|
| A — no fee | `0` | `fee == 0` | net == amount | ✅ (0) |
| B — sane interior | `1 .. 9_999` | `fee < amount` | net > 0, deposit works | ✅ (10, 25) |
| C — total confiscation | `10_000` | `fee == amount` | `netAmount == 0` → `NoSharesMinted` | ❌ |
| D — over 100% | `10_001 .. ~2^256/amount` | `fee > amount` | `amount - fee` underflows → `Panic(0x11)` | ❌ |
| E — multiplication overflow | above that, to `type(uint256).max` | — | `amount * depositFeeBps` overflows → `Panic(0x11)` | ❌ |

Four test values, all drawn from A and B. `0`, `10`, `25` are the *same* equivalence class as far as the code is concerned (`fee < amount`, subtraction safe, shares non-zero) — three samples of one behaviour, not three behaviours. They were chosen as "realistic ops values", which means they were chosen from exactly the region where nothing goes wrong.

They could never have found it because **every value in A and B satisfies the untested precondition by construction.** No amount of sampling inside the valid partition can discover that the boundary is unguarded; you have to cross it. And no value in A/B is anywhere near `10_000` — the nearest test point, 25, is 400× away from the cliff, so not even a sloppy "nearby value" heuristic would have stumbled onto it.

The missing inputs are the classic boundary set for a bounded quantity: `MAX - 1`, `MAX`, `MAX + 1`, and `type(uint256).max`. Zero of the four appear in the suite. The suite tested the low boundary (`0`) and skipped the high one entirely.

## 3. The arithmetic

Take `amount = 1_000e18` (`BPS_DENOMINATOR = 10_000`).

**Last value that still works — 9_999 bps:**
```
fee       = 1_000e18 * 9_999 / 10_000 = 999.9e18
netAmount = 1_000e18 - 999.9e18       = 0.1e18       ✅ shares > 0
```

**The cliff — exactly 10_000 bps (100%):**
```
fee       = 1_000e18 * 10_000 / 10_000 = 1_000e18
netAmount = 1_000e18 - 1_000e18        = 0
shares    = convertToShares(0)         = 0
          → revert NoSharesMinted()
```
Note this is amount-independent: for any `amount`, `amount * 10_000 / 10_000 == amount`, so `netAmount == 0` always. Every deposit of every size reverts. Exactly the reported symptom.

**Past the cliff — 25_000 bps (e.g. ops meaning "2.5%" but writing the percent in the wrong scale, or a stray `00`):**
```
fee       = 1_000e18 * 25_000 / 10_000 = 2_500e18
netAmount = 1_000e18 - 2_500e18        → 1_000e18 < 2_500e18
          → revert Panic(0x11)  // arithmetic underflow, Solidity >=0.8 checked math
```
Again amount-independent: `fee = amount * 2.5 > amount` for all `amount > 0`. Total deposit outage, and the revert is a bare panic with no error message, which is why it looked like the vault was "broken" rather than "misconfigured."

The setter accepted it, emitted `DepositFeeUpdated(25, 25000)` cheerfully, and the vault was bricked until redeploy. Non-recoverable in the sense that mattered: the fee is settable, so it *could* have been fixed by setting it back — but the outage lasted until someone diagnosed a nameless panic.

**Same class, upper end — `newFeeBps = type(uint256).max`:** `amount * depositFeeBps` overflows before the division ever runs → `Panic(0x11)` from the multiplication instead of the subtraction. Different opcode, same outage.

## 4. The technique that catches it: fuzz the setter, unbounded

The fee is *user-controlled input* (owner-controlled, but that's still input) into arithmetic that moves value. That is the exact profile for property-based fuzzing.

```solidity
/// Property: any fee the setter ACCEPTS must leave the vault able to take deposits.
function testFuzz_AcceptedFeeNeverBricksDeposits(uint256 newFeeBps, uint256 amount) public {
    amount = bound(amount, 1e6, 1e30);        // bound the amount — it's genuinely bounded
    // newFeeBps is NOT bounded — the setter claims to accept any uint256, so test that claim

    vm.prank(owner);
    vault.setDepositFee(newFeeBps);           // if this reverts, the guard exists and we're fine

    deal(address(token), alice, amount);
    vm.startPrank(alice);
    token.approve(address(vault), amount);
    uint256 shares = vault.deposit(amount);   // must not panic
    vm.stopPrank();

    assertGt(shares, 0, "accepted fee bricked deposits");
}
```

Foundry's fuzzer seeds boundary values (`0`, `1`, `type(uint256).max`, and powers/near-powers) before random sampling, so this fails within single-digit runs, with a shrunk counterexample sitting on or just past `10_000`.

**The trap to avoid:** the reflexive way to write that test is

```solidity
newFeeBps = bound(newFeeBps, 0, 10_000);   // ← re-imports the exact assumption under test
```

That reproduces the original blind spot with a fuzzer's name on it. `bound()` is right for inputs the *contract* constrains; here the contract constrains nothing, so bounding the fuzz input asserts a guard that isn't in the code. **Bound to what the code enforces, not to what you assume callers will send.** If the setter had a `require`, bounding would be legitimate — the whole point is that it doesn't.

**Second layer — stateful invariant testing.** Put `setDepositFee` in the handler alongside `deposit`/`withdraw` so the fuzzer interleaves reconfiguration with user flow, which is what ops actually did:

```solidity
// handler
function setFee(uint256 newFeeBps) public {
    vm.prank(vault.owner());
    vault.setDepositFee(newFeeBps);          // unbounded, on purpose
}

// invariant
function invariant_DepositsAlwaysAvailable() public {
    if (vault.paused()) return;
    deal(address(token), address(this), 1e21);
    token.approve(address(vault), 1e21);
    assertGt(vault.deposit(1e21), 0, "vault refuses deposits in reachable state");
}
```

This states the property the team actually cared about — "an admin action can never make the vault stop accepting deposits" — and it's the one that would have failed in CI last week instead of in production.

## 5. The fix, and the tests to pin it

```solidity
uint256 public constant MAX_FEE_BPS = 1_000;   // 10% ceiling; pick a policy number, not 10_000

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

Validate at the boundary where the value enters the system, not where it explodes. A ceiling *below* 100% is the right call — a 100% cap technically prevents the panic but still permits `netAmount == 0`, i.e. partition C, i.e. the outage.

Then add the boundary cases the original suite lacked, which are cheap and permanent once the guard exists:

```solidity
function test_SetFeeAtMax() public { /* MAX_FEE_BPS succeeds, deposits still work */ }
function test_RevertWhen_SetFeeAboveMax() public { /* MAX_FEE_BPS + 1 reverts */ }
function test_RevertWhen_SetFeeMaxUint() public { /* type(uint256).max reverts */ }
```

While you're in there, the same fuzz test surfaces a neighbouring dust bug that the 0/10/25 tests also miss: for small `amount`, `(amount * 25) / 10_000` truncates to `0` (any `amount < 400` pays no fee), and for small `netAmount`, `convertToShares` can round to `0` and revert `NoSharesMinted` on a legitimate deposit. Same root cause — integer arithmetic was only ever exercised at comfortable magnitudes.

## The one-line version

100% line coverage proved every line ran; nobody ever proved a line was *missing*. The suite sampled four points from one equivalence class and never crossed the `BPS_DENOMINATOR` boundary, so the unguarded domain of `setDepositFee` stayed untested by construction. An unbounded fuzz test over the setter's input — plus a stateful invariant that admin actions can't brick deposits — finds it in seconds.

# The vault suite: what 39 green tests actually bought you

## Short version

The fee-retention bug is a *conservation* bug. It does not live in any one call — it
lives in the relationship between two quantities (`totalAssetsStored` and the tokens
actually held) across a sequence of calls. Every test in this suite is a single-call,
fixed-input, fixed-output test. A suite made entirely of those can, in principle,
never observe a conservation bug, no matter how many of them you write and no matter
what coverage number they produce.

---

## Test-by-test

### `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

**Actually establishes:** on an empty (or fixture-shaped) vault, one deposit of
`DEPOSIT_AMOUNT` returns `999e18` and credits the same number to the depositor's
balance. That second assert is genuinely useful: the returned value and the stored
balance agree, so `deposit` isn't returning a number it forgot to write down.

**Only appears to establish:** that share issuance is *correct*. `999e18` is a golden
constant with no derivation attached. Nothing in the test says why it is not `1000e18`
— whether that gap is a virtual-share offset, a rounding convention, or an entry fee
is invisible. A constant like this pins behaviour at exactly one point on the curve
and asserts nothing about the *rule* that generated it. Concretely: it says nothing
about what a second depositor gets after the price has moved, which is precisely where
the drift bites. When the accounting shifted, this number would either stay green
(because the first-deposit path is the one path the bug doesn't touch) or get
mechanically updated to whatever the code now returns. It is a change-detector, not a
correctness statement.

### `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

This is the closest the suite gets to the bug, and it is the most misleading test of
the four.

**Actually establishes:** that after exactly one deposit into a fresh vault, the
cached total and the derived total both equal the deposited amount. That is, the cache
is initialised correctly.

**Only appears to establish:** that `totalAssetsStored` tracks reality. The test
checks `stored == totalAssets()` at the one moment in the vault's life when the two
*cannot* disagree — before any fee has ever been taken. The bug is that `stored`
diverges from the tokens actually held, and this test asserts the non-divergence at
step 1 of a sequence where divergence only begins at step 2. It looks like an
accounting-integrity test. It is an initialisation test wearing an accounting-integrity
test's clothes.

Worse: it anchors the reader's confidence. Anyone auditing the suite for "do we check
that the recorded total matches the real total?" greps, finds this, and stops.

Note also that neither assert compares against the *token balance*. Both sides are the
vault's own opinion of itself. `totalAssets()` returning `DEPOSIT_AMOUNT` and
`totalAssetsStored()` returning `DEPOSIT_AMOUNT` is consistent with the vault holding
any amount of USDT whatsoever. The external ground truth — what the yield protocol
credits the vault — is never consulted.

### `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

**Actually establishes:** the constant is 30. That is the entire content.

**Only appears to establish:** that the withdrawal fee works. It restates a literal
from the source file in the test file. It cannot fail unless someone edits the
constant, in which case it fails *by design* rather than by discovering anything. It
tests no behaviour: not that the fee is charged, not that it is 0.3% of the right
base, not where it goes. The fee's *destination* — "stays in the protocol, accrues to
remaining holders" — is the entire product requirement here, and this test is the only
thing in the slice with "fee" in its name. It asserts a number and leaves the
requirement untested.

In coverage terms this is the pure poison: it marks `WITHDRAW_FEE_BPS` as covered.

### `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

**Actually establishes:** the constructor assigns its argument to the right field.
Non-zero value — wiring mistakes are real, and this catches a swapped constructor
argument.

**Only appears to establish:** anything about the vault's behaviour. It's a wiring
check, correctly scoped and honest about what it is. The problem is not this test; the
problem is that it counts as 1/39 of a suite whose green bar is being offered as
evidence of solvency-grade correctness.

---

## How 100% coverage was compatible with this bug

Coverage measures **which lines ran**. The bug is not in a line that didn't run. Every
line of the withdrawal path ran, many times. The fee line ran. The
`totalAssetsStored` update ran.

The bug is in **what the lines that ran meant together**. Somewhere the withdrawal path
decrements `totalAssetsStored` by the gross amount the shares were worth, while
transferring out only the net (gross minus fee). Both statements execute. Both are
individually defensible — the user's shares *were* worth the gross; the user *should*
receive the net. Line coverage is fully satisfied by executing both. Nothing in the
coverage model has any concept of the arithmetic relationship between them.

Three specific things coverage cannot see, all of which this bug needs:

1. **Assertion strength.** A test that calls a function and asserts nothing covers it
   100%. `test_WithdrawFeeBps` shows the degenerate case: coverage credit for a line
   that was never behaviourally exercised at all. Delete every `assert` from all 39
   tests and coverage stays at 100%.

2. **State-space depth.** Coverage is per-line, not per-path-through-history. One
   deposit covers the deposit path as thoroughly, by this metric, as ten thousand
   interleaved deposits and withdrawals. The drift is cumulative — it is
   *n × fee* after n withdrawals — so its magnitude is a function of exactly the
   dimension coverage collapses to 1.

3. **Ground truth.** Coverage counts executed lines inside the vault. Whether the
   vault's internal numbers agree with the external token balance is not a line and
   cannot be covered.

The correct reading of "100% line and function coverage" is: *no part of this contract
is untested for reasons of never having been reached.* That is a real and worthwhile
fact. It is a statement about the absence of one failure mode (dead, unexercised code),
not the presence of correctness. The lead is right that the suite is thorough along the
axis coverage measures. The bug lives on a different axis.

---

## Why "every operation is correct in isolation" is the tell

This is the part worth internalising, because the instinct is to hear it as
exculpatory: *we checked each call, each call is fine, therefore something exotic must
have happened.* Invert it.

Bugs fall roughly into two families. **Local** bugs — an off-by-one, a wrong operator,
a missing check — show up as some individual call producing a wrong answer. If you have
one of these, a single-call unit test can find it, and a thorough suite of single-call
unit tests probably will.

**Global** bugs are violations of a relationship that no single call is responsible for
maintaining. Conservation of value, monotonicity of share price, sum-of-parts equals
whole. Every participating call is locally reasonable; the system-level property is
false anyway. These are *definitionally invisible* to single-call tests — not
"unlikely to be caught", but outside what that test shape can express.

So "we cannot point at a single call that misbehaves" is not evidence that the bug is
subtle or unlucky. It is a **classification**: it tells you the bug is in the second
family, and therefore tells you the suite you have — 39 single-call tests — is not a
suite that was unlucky, it is a suite of the wrong shape. The alibi ("each operation is
correct, so we tested correctly") and the diagnosis ("each operation is correct, so we
tested the wrong thing") are drawn from the identical observation. The observation
discriminates, and it discriminates against the suite.

The symptom profile confirms it. The drift is *cumulative* (grows with operation count),
*directional* (always the same sign — the vault always under-counts, never over-counts,
which is why there's no insolvency), and *distributed* (each withdrawal contributes
exactly one fee's worth). That is the signature of a broken invariant, not a broken
function. And note that the failure mode is quiet by construction: a vault that thinks
it holds *less* than it does never reverts, never fails a solvency check, never bounces
a withdrawal. It just silently under-prices everyone's shares. There is no error path
for a test to trip; the only way to see it is to assert the relationship directly.

---

## The property the suite should have asserted

Two properties. The first catches the drift directly; the second states the business
requirement the fee actually has and would catch a whole family of neighbouring bugs.

### P1 — Accounting completeness (the one that catches this)

> At every point in the vault's lifetime, the assets the vault *believes* it holds
> equal the assets it *actually* holds in the yield protocol.
>
> ```
> vault.totalAssetsStored() == yieldProtocol.balanceOfUnderlying(address(vault))
> ```
>
> for every reachable state, modulo an explicitly bounded rounding tolerance of at most
> a few wei that does not grow with the number of operations.

The two clauses matter independently:

- **"equal the assets it actually holds"** — the right-hand side must be *external*
  ground truth, the yield protocol's or the token's accounting, never another vault
  getter. `totalAssets() == totalAssetsStored()` is the vault agreeing with itself and
  is worth nothing here.
- **"does not grow with the number of operations"** — the tolerance must be an absolute
  constant, not a percentage and not per-operation. A per-operation tolerance would
  absorb exactly this bug, since the bug *is* one fee's worth of drift per withdrawal.
  If you cannot state the tolerance as a constant, the invariant is not tight enough
  to catch cumulative errors.

Stating it as `>=` (solvency) instead of `==` is the trap to avoid. Solvency holds
throughout this incident — the vault holds more than it thinks. `>=` is green for the
entire bug. The property must be equality in both directions: under-counting is a bug
even though it isn't a loss of funds, because uncounted assets are unclaimable assets.

### P2 — Fee redistribution (the requirement, stated as an assertion)

> A withdrawal transfers `fee` of value from the withdrawer to the remaining holders,
> and destroys none of it.
>
> Let `price(x) = x.totalAssets() * 1e18 / x.totalSupply()`. For any withdrawal by any
> holder with a non-empty remainder:
>
> ```
> price_after >= price_before    (strictly > when fee > 0 and supply_after > 0)
> ```
>
> and the increase accounts for the whole fee:
>
> ```
> totalAssets_after == totalAssets_before - amountTransferredOut
> ```

This is the property that names the actual intent. Under the bug, `totalAssets_after`
comes out one fee too low and the share price for the stayers does not rise — which is
the user-visible harm, expressed directly.

### Test shape: stateful invariant fuzzing

Not more unit tests. A handler-based invariant campaign — Foundry's
`invariant_` tests, Echidna, or Medusa. The shape:

```solidity
// ---- Handler: the only thing the fuzzer is allowed to call ----
contract VaultHandler is Test {
    Vault   public vault;
    MockUSDT public usdt;
    address[] public actors;

    // ghost variables: the test's independent bookkeeping
    uint256 public ghost_depositedTotal;
    uint256 public ghost_withdrawnTotal;
    uint256 public ghost_lastPrice;

    modifier useActor(uint256 seed) {
        vm.startPrank(actors[bound(seed, 0, actors.length - 1)]);
        _;
        vm.stopPrank();
    }

    function deposit(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        amount = bound(amount, 1, 1_000_000e18);
        usdt.mint(msg.sender, amount);
        usdt.approve(address(vault), amount);
        vault.deposit(amount);
        ghost_depositedTotal += amount;
    }

    function withdraw(uint256 actorSeed, uint256 shareSeed) external useActor(actorSeed) {
        uint256 bal = vault.shareBalance(msg.sender);
        if (bal == 0) return;
        uint256 shares = bound(shareSeed, 1, bal);

        uint256 priceBefore = _price();
        uint256 before      = usdt.balanceOf(msg.sender);
        vault.withdraw(shares);
        uint256 received    = usdt.balanceOf(msg.sender) - before;

        ghost_withdrawnTotal += received;

        // P2, checked at the point of the operation
        if (vault.totalSupply() > 0) {
            assertGe(_price(), priceBefore, "withdrawal decreased share price");
        }
    }

    function accrueYield(uint256 amount) external {
        // donations / yield: the vault must notice assets it did not mint shares for
        amount = bound(amount, 0, 10_000e18);
        usdt.mint(address(yieldProtocol), amount);   // credited to the vault's position
    }

    function _price() internal view returns (uint256) {
        uint256 supply = vault.totalSupply();
        return supply == 0 ? 1e18 : vault.totalAssets() * 1e18 / supply;
    }
}

// ---- Invariants: checked after every call in every random sequence ----
contract VaultInvariants is Test {
    VaultHandler handler;

    function setUp() public {
        // ...deploy vault, protocol, actors...
        handler = new VaultHandler(vault, usdt);
        targetContract(address(handler));   // fuzzer may ONLY call the handler
    }

    /// P1: the vault's books match the tokens it actually holds.
    function invariant_StoredEqualsHeld() public view {
        assertApproxEqAbs(
            vault.totalAssetsStored(),
            yieldProtocol.balanceOfUnderlying(address(vault)),
            ROUNDING_WEI,              // small ABSOLUTE constant, e.g. 10
            "recorded total drifted from held balance"
        );
    }

    /// P1, corollary: no assets are stranded — everything held is claimable.
    function invariant_NoUnclaimableAssets() public view {
        uint256 claimable;
        for (uint256 i; i < handler.actorCount(); ++i) {
            claimable += vault.previewRedeem(vault.shareBalance(handler.actors(i)));
        }
        assertApproxEqAbs(
            claimable,
            yieldProtocol.balanceOfUnderlying(address(vault)),
            ROUNDING_WEI * handler.actorCount(),
            "assets held but claimable by nobody"
        );
    }

    /// Share accounting closes.
    function invariant_SharesSumToSupply() public view {
        uint256 sum;
        for (uint256 i; i < handler.actorCount(); ++i) {
            sum += vault.shareBalance(handler.actors(i));
        }
        assertEq(sum, vault.totalSupply());
    }
}
```

Run it with depth on the order of hundreds of calls per sequence
(`fail_on_revert = true`, `runs = 256`, `depth = 500` in `foundry.toml`). Depth is not
a tuning detail here — it is the dimension the drift lives in. At depth 1 the bug is
invisible; at depth 500 `invariant_StoredEqualsHeld` fails on roughly the second
withdrawal and Foundry hands you the minimal reproducing call sequence, which for this
bug will be about three calls long.

Two details that decide whether this campaign finds the bug or theatres past it:

- **`accrueYield` must be in the handler.** Without it every state the fuzzer reaches
  has zero external yield, and `stored` and `held` may coincidentally agree through
  paths that assume no unaccounted-for assets exist. The fee-retention bug is
  structurally the same shape as unnoticed yield; exercising one exercises the other.
- **`ROUNDING_WEI` must be absolute.** If a first run fails and the reflex is to widen
  the tolerance until green, the invariant is dead. The correct response to
  `assertApproxEqAbs` failing by a growing margin is to treat the growth itself as the
  finding.

### What the existing 39 tests are still for

Keep them. Unit tests are the right shape for wiring (`test_ConstructorSetsUsdt`),
for revert conditions, and for pinning specific documented edge cases. The mistake was
not writing them; it was believing that a complete set of them, plus a 100% coverage
number, adds up to a statement about system-level correctness. It adds up to a
statement about *local* correctness. Conservation is global, and global properties have
to be asserted globally.

A useful rule going forward: for every quantity the contract stores as a cached mirror
of an external truth, there must be an invariant test asserting the mirror is exact.
`totalAssetsStored` is exactly such a quantity, and it had none.

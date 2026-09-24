# Why the suite was green while the vault leaked

## The bug, stated as a property violation

The vault keeps a cached accounting figure (`totalAssetsStored`) and a real position
(tokens the vault controls inside the yield protocol). On withdrawal it pays out
`net = gross - fee` and leaves `fee` in the protocol, but it decrements its own
accounting by the gross amount. Each withdrawal therefore burns `fee` units of
*bookkeeping* that nothing ever re-credits. The tokens are still there; the vault's
belief about them is not.

So the broken property is not solvency (`totalAssets >= real holdings` — never
violated, and that asymmetry is exactly why nobody screamed). It is **exactness**:

```
totalAssets() == assets the vault actually controls
```

and its economic consequence:

```
price per share never decreases across a fee-taking withdrawal
```

A fee that is meant to accrue to remaining holders must *raise* the share price for
everyone still in. Here it raises the real backing and lowers the recorded backing —
the fee is paid by the leaver and captured by nobody. Each withdrawal strands
`fee` tokens permanently.

## The four tests, one at a time

### `test_DepositMintsShares`

**Actually establishes:** a single deposit of `DEPOSIT_AMOUNT` from a clean `setUp`
state mints some fixed number of shares, and the share ledger records them under
`alice`. It pins the first-deposit mint math against a regression.

**Only appears to establish:** that the share math is right. `999e18` is a magic
constant with no derivation in the test — it is a transcription of whatever the
implementation printed the day the test was written. If the conversion formula is
wrong, the test is wrong in exactly the same direction and still passes. Note also
what the constant quietly admits: `DEPOSIT_AMOUNT` of assets buys `999e18` shares
while the next test asserts `totalAssets() == DEPOSIT_AMOUNT`. There is already a
gap between assets in and shares out at the very first deposit, and no test anywhere
states what that gap is supposed to be or who it belongs to. A relational assertion
(`convertToAssets(shares) == DEPOSIT_AMOUNT`, or `shares * price == assets ± 1 wei`)
would have had to name that rule. The literal lets it stay unnamed.

### `test_DepositUpdatesTotalAssets`

**Actually establishes:** after one deposit, two getters agree with each other and
with the deposited amount.

**Only appears to establish:** that the vault's accounting tracks reality. This is
the load-bearing failure of the suite. `totalAssets()` and `totalAssetsStored()` are
not independent witnesses — the former reads the latter. The test compares the cache
to itself and calls it corroboration. The one measurement that would have mattered,
the vault's actual position in the yield protocol, is never read. This test would
still pass on day 400 of the leak, with the two getters in perfect agreement and both
wrong by the accumulated fees. It also only ever runs from a virgin state: one
deposit, no prior withdrawals, so the drift term is structurally zero at the moment
of assertion.

### `test_WithdrawFeeBps`

**Actually establishes:** a constant equals its literal. It proves `30` is `30`.

**Only appears to establish:** that fee handling is tested. The test names the fee,
and reading the suite you would come away believing the fee is covered. Nothing here
touches a withdrawal, a fee computation, or where the fee goes. It is the single
clearest example of coverage-shaped work: it exercises the accessor, satisfies the
"fees are tested" box in review, and has zero power to fail on any bug in the fee
path.

### `test_ConstructorSetsUsdt`

**Actually establishes:** the constructor assigns its argument to a field. A
deployment-wiring smoke check, mildly useful as such.

**Only appears to establish:** nothing beyond that — but it inflates the count. It is
one of the 39, and it is one of the reasons `forge coverage` reads 100% on functions.

**The pattern across all four:** every assertion is a *restatement of the
implementation* — a literal it emitted, a constant it declares, a field it assigns, a
getter compared to another getter derived from it. Not one asserts a relationship
between the vault's books and something outside the vault's books. A suite built
entirely from self-reports cannot detect a self-report that has drifted.

## How 100% coverage coexisted with this

Coverage measures which lines the EVM executed. It says nothing about whether
anything *observed* the consequences. A suite with every assertion deleted still
reports 100% line and function coverage. Coverage is a lower bound on test quality —
it can tell you a line was never run, it can never tell you a line was checked.

Three more specific reasons it was blind here:

1. **The buggy line executed and behaved as written.** The decrement is not a crash
   or an unreached branch; it is a correct-looking subtraction of the wrong quantity.
   No execution-based metric distinguishes "ran" from "ran and was right."

2. **The defect lives in the relationship between two calls, not inside either.**
   Coverage is per-line and per-function. The failure is `withdraw`'s effect on
   `deposit`'s future meaning. There is no line to cover that expresses "and the sum
   of these two is conserved." A metric over lines cannot see a property over
   sequences.

3. **Coverage counts lines, not states.** Every test starts from `setUp`. The suite
   reaches 100% of the code and roughly 1% of the state space — specifically, only
   states where the accumulated drift is still zero. The failing state ("a long run
   of deposits and withdrawals") is one no test ever constructs, and constructing it
   would not have moved the coverage number by a single point, because those lines
   were already green.

## Why "every operation is correct in isolation" is the diagnosis

That sentence is true, and it is the shape of the bug, not a defence of the code.

The error per withdrawal is a small quantity, `fee`, that is *locally invisible*: each
call is internally consistent, each postcondition holds relative to its own
precondition, each delta is plausible. What fails is conservation across the sequence.
The drift is a sum of individually-tolerable errors, and the operations are each
verified against a *relative* reference (what changed) rather than an *absolute* one
(what is actually there). Relative checks cannot detect a constant leak; they re-anchor
to the corrupted value every time. Ten withdrawals are ten correct operations and one
wrong vault.

So the inference runs the other way from the lead's: **when every local check passes
and the global state is provably wrong, the missing assertion is necessarily a global
one.** "We cannot point at a single call that misbehaves" is a proof that no
single-call test could ever have caught it — which means no amount of additional unit
tests, and no coverage figure however high, was going to help. The class of bug is
identified precisely by the symptom. It needs an invariant, held across sequences,
checked against something the vault does not itself compute.

A secondary tell: the failure direction. The vault holds *more* than it thinks. Every
safety check anyone thinks to write points the other way ("can users always be paid?"),
so a surplus leak survives review indefinitely. Value that is unclaimable is lost just
as thoroughly as value that is stolen; it simply never triggers an alarm.

## The property the suite should have asserted

Three invariants, in order of directness. The first alone catches this bug.

**I1 — Accounting exactness (the one that fails here).** At every reachable state,
the vault's recorded total equals the assets it actually controls in the yield
protocol, up to bounded rounding:

```
| vault.totalAssets() - protocol.balanceOfUnderlying(address(vault)) | <= ROUNDING_TOLERANCE
```

State it as equality-within-tolerance, not `>=`. `>=` is the solvency invariant and it
holds throughout this bug — writing the weak form is how you ship this. Tolerance
should be a small absolute constant (a few wei per operation at most) and should
**not** grow with the number of operations; if it has to, the accounting is
accumulating error and that is itself the finding.

**I2 — Share price monotonicity.** Since fees accrue to remaining holders and nothing
is ever swept out, the price per share is non-decreasing across every operation:

```
vault.convertToAssets(1e18) >= lastObservedPricePerShare    // whenever totalShares > 0
```

This is the invariant that states the *intent* — "the fee accrues to whoever is still
in." Under the bug, price per share drops on every fee-taking withdrawal, so I2 fails
on the very first withdraw-after-deposit sequence and fails loudly.

**I3 — Value conservation with ghost accounting.** Track independently of the vault:

```
ghost_depositedTotal - ghost_withdrawnNetTotal + ghost_yieldAccrued
    == protocol.balanceOfUnderlying(address(vault))    (± rounding)
```

and separately assert that the sum of all fees taken shows up as an increase in
backing per share rather than vanishing. I3 is the strongest statement — it pins down
where every token went, not just that the two totals match.

### Test shape

A Foundry **invariant test with a handler**, because the property is over sequences of
calls by multiple actors, which is exactly the state space the unit tests never enter.

```solidity
contract VaultInvariantTest is Test {
    Vault   vault;
    MockUSDT usdt;
    YieldProtocol protocol;
    VaultHandler handler;

    function setUp() public {
        // ... deploy vault, usdt, protocol ...
        handler = new VaultHandler(vault, usdt, protocol);
        targetContract(address(handler));   // only the handler is fuzzed
    }

    // I1 — the bug dies here
    function invariant_RecordedTotalMatchesRealHoldings() public view {
        assertApproxEqAbs(
            vault.totalAssets(),
            protocol.balanceOfUnderlying(address(vault)),
            ROUNDING_TOLERANCE,
            "accounting drifted from real holdings"
        );
    }

    // I2 — the economic intent
    function invariant_SharePriceNeverDecreases() public view {
        if (vault.totalShares() == 0) return;          // undefined, skip
        assertGe(
            vault.convertToAssets(1e18),
            handler.ghost_maxPricePerShareSeen(),
            "fee did not accrue to remaining holders"
        );
    }

    // I3 — conservation
    function invariant_NoUnattributableTokens() public view {
        assertApproxEqAbs(
            handler.ghost_depositedTotal() - handler.ghost_withdrawnNetTotal(),
            protocol.balanceOfUnderlying(address(vault)),
            ROUNDING_TOLERANCE
        );
    }
}
```

The handler is what makes this work — it does the job the unit tests refused to do,
which is to reach a state that has history:

```solidity
contract VaultHandler is Test {
    address[] actors;            // a fixed set, so withdrawals hit real positions
    uint256 public ghost_depositedTotal;
    uint256 public ghost_withdrawnNetTotal;
    uint256 public ghost_maxPricePerShareSeen;

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        amount = bound(amount, 1, 1e30);
        deal(address(usdt), actor, amount);
        vm.startPrank(actor);
        usdt.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
        ghost_depositedTotal += amount;
        _recordPrice();
    }

    function withdraw(uint256 actorSeed, uint256 shares) external {
        address actor = _actor(actorSeed);
        uint256 max = vault.shareBalance(actor);
        if (max == 0) return;                       // no-op, don't vm.assume it away
        shares = bound(shares, 1, max);
        uint256 before = usdt.balanceOf(actor);
        vm.prank(actor);
        vault.withdraw(shares);
        ghost_withdrawnNetTotal += usdt.balanceOf(actor) - before;  // NET, measured
        _recordPrice();
    }

    function accrueYield(uint256 amount) external { /* ... */ }

    function _recordPrice() internal {
        if (vault.totalShares() == 0) return;
        uint256 p = vault.convertToAssets(1e18);
        if (p > ghost_maxPricePerShareSeen) ghost_maxPricePerShareSeen = p;
    }
}
```

Four details that decide whether this actually catches the bug:

- **A bounded actor set.** Random `msg.sender` values mostly hold zero shares, so
  `withdraw` becomes a no-op and the fee path is never driven. Reuse a handful of
  actors so deposits and withdrawals interleave on the same positions.
- **Measure the net payout, don't recompute it.** `ghost_withdrawnNetTotal` must come
  from the actor's observed balance delta. Recomputing it from `WITHDRAW_FEE_BPS`
  reintroduces the same tautology as the unit tests — the ghost would drift in
  lockstep with the vault and agree with it forever.
- **Read holdings from the protocol, not the vault.** The whole point is an external
  witness. `protocol.balanceOfUnderlying(vault)` (fork-tested against the real
  protocol, since the quirk that matters may be the protocol's rounding) is the
  reference; the vault's own view is the thing under test.
- **Depth over breadth.** Configure `[invariant] runs = 512, depth = 50` at minimum.
  Under this bug I1 and I2 fail at depth 2, but a leak that is only visible after
  dozens of operations needs the depth to show up at all.

If invariant tests are too big a step right now, the minimum viable version is a
single stateful fuzz test that catches the same thing:

```solidity
function testFuzz_FeesAccrueToRemainingHolders(uint256[8] memory amounts) public {
    _deposit(alice, DEPOSIT_AMOUNT);            // alice stays in the whole time
    uint256 priceBefore = vault.convertToAssets(1e18);

    for (uint256 i = 0; i < amounts.length; i++) {
        uint256 amt = bound(amounts[i], 1e6, 1e24);
        _deposit(bob, amt);
        _withdrawAll(bob);                      // bob pays the fee each round

        assertGe(vault.convertToAssets(1e18), priceBefore, "share price fell");
        assertApproxEqAbs(
            vault.totalAssets(),
            protocol.balanceOfUnderlying(address(vault)),
            ROUNDING_TOLERANCE,
            "drift"
        );
        priceBefore = vault.convertToAssets(1e18);
    }
    // alice, who never moved, must be worth strictly more than she put in
    assertGt(vault.convertToAssets(vault.shareBalance(alice)), DEPOSIT_AMOUNT);
}
```

That last line is the business requirement written as an assertion, and it is the
sentence the original suite never wrote down anywhere: *the fee must make the people
who stayed richer.* The existing 39 tests, every one of them, describe what the code
does. None describes what the vault is for.

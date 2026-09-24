# Why 39 green tests and 100% coverage missed the fee drift

## 1. What each test actually establishes

### `test_DepositMintsShares`
```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```
**Actually establishes:** that a *first* deposit of `DEPOSIT_AMOUNT` into an empty vault
mints `999e18` shares, and that the return value agrees with the recorded balance. The
literal `999e18` is at least an independent expectation rather than a read-back of the
implementation, so this one can fail — it is the strongest test of the four.

**Only appears to establish:** that share *pricing* is correct. It pins exactly one point
of the conversion function, from a fresh `setUp()`, at the one state where pricing is
trivial (empty vault, price fixed by the seeding convention). It says nothing about the
conversion once the vault has history — which is precisely where the bug lives. The
second depositor into a vault that has already paid out fees is the case that matters,
and no assertion here constrains it.

### `test_DepositUpdatesTotalAssets`
```solidity
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```
**Actually establishes:** that a deposit credits the accounting variable, and that the
public `totalAssets()` view agrees with `totalAssetsStored()` at that moment.

**Only appears to establish:** that the vault's books match reality. This is the test
that *looks* like it covers the bug and does not. Two things are wrong with it:

- It compares accounting to accounting. `totalAssets()` and `totalAssetsStored()` are two
  readings of the same number; asserting they are equal is close to asserting the
  implementation back to itself. The missing comparison is accounting against **custody** —
  `totalAssets()` against the tokens the vault actually controls in the yield protocol.
- It is checked at the one state where the drift is necessarily zero. After a single
  deposit and no withdrawal, no fee has been taken, so recorded and real coincide for
  reasons unrelated to correctness. The assertion would still pass on the broken vault.

### `test_WithdrawFeeBps`
```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```
**Actually establishes:** that the source file contains the literal `30`. It is a constant
asserted against itself — the test is a copy of the line it tests. It can only fail if
someone edits the constant, in which case they edit this line too.

**Only appears to establish:** that the fee *works*. Nothing here charges a fee, checks
that a withdrawer receives `amount - fee`, checks where the fee lands, or checks that it
is credited to the remaining holders. The entire semantics of the fee — "stays in the
protocol and accrues to whoever is still in" — is the untested part, while the constant
that names it is the "covered" part. The suite tests the label and not the behaviour.

### `test_ConstructorSetsUsdt`
```solidity
assertEq(address(vault.usdt()), address(usdt));
```
**Actually establishes:** that the constructor assigns its argument to the field, i.e.
that Solidity assignment works. Its failure would be a compiler bug.

**Only appears to establish:** that the USDT integration is sound. `usdt` here is a mock
(it is an address the test controls). A mock encodes your assumption about the token and
answers in the standard shape every time, so a suite built on it can only re-confirm the
assumption. Real USDT returns no value from `transfer`, and has an owner-settable transfer
fee; neither can ever surface against this double. That is a second, independent blind
spot the "100% functions covered" number also reports as green.

## 2. How 100% coverage was compatible with the bug

Coverage records **which lines executed**, never **whether any assertion could have
failed**. A test file with no `assert` at all reports 100% line and function coverage.
Three of the four tests above constrain nothing that could realistically break; they still
move the counter.

More fundamentally, coverage is a property of *lines*, and this bug is not in a line. The
fee line in `withdraw` ran. `totalAssetsStored` was updated on that same line and its
update ran. Every branch ran. The defect is in the **relationship between two operations**:
each withdrawal removes the user's full claim from the recorded total while transferring
out only the net, so the fee's worth of tokens stays in the protocol with no accounting
entry pointing at it. That gap is a difference between two states, and there is no coverage
metric for state sequences — the number of reachable sequences is unbounded, so 100% of
lines can be reached by a suite where every test starts from a fresh `setUp()` and performs
exactly one operation. Which is what happened: 39 tests, each covering a line, none
covering a history.

## 3. Why "every operation is correct in isolation" is the tell

It is the diagnosis, not the defence. A quantity that drifts monotonically across a
sequence is invisible to *any* test that exercises one operation from a clean state,
however many such tests you write — the drift after one withdrawal is one fee, a number
nobody had written down as wrong, and the per-call postconditions everyone did write down
("the user received `amount - fee`", "their shares were burned", "the recorded total went
down") are all satisfied. They are satisfied on the broken vault too.

So when the system is wrong and no single call misbehaves, that is positive evidence about
the *class* of bug: the violated property is a cross-operation conserved quantity, and the
unit suite is structurally the wrong instrument — not an under-powered one that more cases
would fix. "We cannot point at a single call that misbehaves" is how an accumulation bug
announces itself. Adding a 40th single-call test cannot find it; the only thing that can is
a search over sequences.

Note also the *direction* of the drift. The vault holds more than it thinks. Every
solvency-flavoured check — "users can always withdraw", "claims never exceed holdings" —
stays green forever on this bug, because a surplus satisfies a one-sided bound. If a
`<=` invariant had been in the suite it would have passed. The shape of the assertion has
to match the failure: where value can be *stranded* as well as lost, the property must be
an equality.

## 4. The property the suite should have asserted

**Property 1 — conservation between accounting and custody (equality, not a bound).**

For every reachable state, after any sequence of deposits, withdrawals and accruals:

```
vault.totalAssets() == vault.assetsHeldInYieldProtocol() + usdt.balanceOf(address(vault))
```

i.e. the assets the vault *claims* to have equal the assets it *controls*, exactly, in both
directions. A shortfall is insolvency; a surplus is the bug you shipped. An `assertLe`
version of this catches only the first.

**Property 2 — the fee accrues to the remaining holders.**

Equality alone is not sufficient: an implementation that swept the fee to the owner would
decrease both sides together and stay green. So pair it with monotonicity of price per
share, which is what "stays in the protocol and accrues to whoever is still in" *means*:

```
pps() := totalSupply() == 0 ? SEED_PPS : totalAssets() * 1e18 / totalSupply()
```
- `pps()` is non-decreasing across every deposit and every withdrawal;
- it **strictly increases** across any withdrawal that charges a non-zero fee while
  `totalSupply() > 0` afterwards.

The shipped vault fails Property 1 (surplus grows by one fee per withdrawal) and fails the
strict half of Property 2 (pps stays flat because the fee was never credited). Either one
alone catches the drift; together they also pin down where the value is supposed to go.

## 5. The test shape that checks it

A **handler-driven invariant test** — `targetContract` pointed at a handler, never at the
vault. Pointed at the vault directly, the fuzzer calls `withdraw` from random senders
holding no shares, nearly everything reverts, reverts are discarded, and the invariant is
asserted against a vault that never left `setUp()`: green because nothing happened.

```solidity
contract VaultHandler is Test {
    Vault   public vault;
    IERC20  public usdt;
    address[] public actors;
    uint256 public ghost_minPps;      // never allowed to fall
    uint256 public ghost_feeWithdrawals; // sequences must reach >= 2

    constructor(Vault _vault, IERC20 _usdt, address[] memory _actors) {
        vault = _vault; usdt = _usdt; actors = _actors;
        for (uint256 i; i < actors.length; ++i) {
            deal(address(usdt), actors[i], 1_000_000e18);
            vm.prank(actors[i]);
            usdt.approve(address(vault), type(uint256).max);
        }
        ghost_minPps = _pps();
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address a = actors[bound(actorSeed, 0, actors.length - 1)];
        amount = bound(amount, 1e6, usdt.balanceOf(a));
        vm.prank(a);
        vault.deposit(amount);
        _recordPps();
    }

    function withdraw(uint256 actorSeed, uint256 shares) external {
        address a = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 bal = vault.shareBalance(a);
        if (bal == 0) return;                      // skip, don't revert
        shares = bound(shares, 1, bal);
        uint256 ppsBefore = _pps();
        vm.prank(a);
        vault.withdraw(shares);
        if (vault.totalSupply() > 0) {
            // Property 2: a fee-bearing withdrawal must raise the price for those left in.
            assertGt(_pps(), ppsBefore, "fee did not accrue to remaining holders");
            ghost_feeWithdrawals++;
        }
        _recordPps();
    }

    function _pps() internal view returns (uint256) {
        uint256 ts = vault.totalSupply();
        return ts == 0 ? 1e18 : vault.totalAssets() * 1e18 / ts;
    }
    function _recordPps() internal {
        uint256 p = _pps();
        if (p < ghost_minPps) ghost_minPps = p; // asserted in the invariant
    }
}

contract VaultInvariants is Test {
    function setUp() public {
        // ... deploy vault, deploy handler with >= 3 funded, approved actors
        targetContract(address(handler));
    }

    // Property 1 — equality, both directions.
    function invariant_accountingEqualsCustody() public view {
        assertEq(
            vault.totalAssets(),
            vault.assetsHeldInYieldProtocol() + usdt.balanceOf(address(vault)),
            "recorded total diverged from tokens actually held"
        );
    }

    // Property 2 — price per share never falls over any sequence.
    function invariant_ppsNeverFalls() public view {
        assertGe(handler.ghost_minPps(), 1e18);
    }

    function invariant_callSummary() public view {
        // guard against a vacuous run: the sequences must have reached >= 2 fee withdrawals
        assertGe(handler.ghost_feeWithdrawals(), 2);
    }
}
```

Run it with enough depth that sequences contain multiple fee-bearing withdrawals
(`runs = 256`, `depth = 128`), and read the **calls/reverts statistics in the output every
time** — set `fail_on_revert = true` while building the handler. A revert rate near 100%
means the run proved nothing, and the invariant was asserted against an untouched vault.

Two things to add alongside it, from the same suite review:

- **Fuzz `WITHDRAW_FEE_BPS` across its whole accepted domain** with `bound()`, not
  hand-picked `30`. It is an owner-settable number feeding value math. Classify the
  boundaries separately: the largest *semantically usable* fee, the exact cap, and the
  first value beyond it — do not assume the cap is valid just because only values past it
  break an inequality.
- **Replace the USDT mock with a pinned mainnet fork** against the real token
  (`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000)`), on an endpoint
  confirmed to serve archive state at that block. `test_ConstructorSetsUsdt` is currently
  the whole of the integration evidence, and it tests an assignment.

A deterministic regression test is worth writing *after* the invariant finds the
counterexample — two fee-bearing withdrawals, asserting the gap after the second is twice
the gap after the first, to show the drift accumulates rather than being a one-off. But it
confirms the defect you already found; it is not the search, and on its own it would have
stopped at the first bug someone happened to imagine.

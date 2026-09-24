# Why 39 green tests and 100% coverage missed the fee drift

## 1. What each test actually establishes

### `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

**Actually establishes:** from a *fresh* `setUp()` state, one deposit of one
hard-coded amount by one actor returns a particular number, and that number is also
what the balance getter reports. It is a golden-number regression test pinned to a
single point of the input domain.

**Only appears to establish:** that the share math is correct. `999e18` is a literal
someone transcribed from a run of the implementation — it is the implementation's own
output asserted back at the implementation. It says nothing about the conversion at
any other amount, at any other total-supply state, or about the relationship between
shares and the assets backing them. Crucially the assertion is share-count against a
constant, never share-count against *custody*, so it is structurally incapable of
noticing that the asset side of the ledger is short. The second `assertEq` is weaker
still: it checks that a getter returns the variable the mint just wrote.

### `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

**Actually establishes:** after exactly one deposit from zero state, the stored total
equals the amount that was just added to it.

**Only appears to establish:** that the vault's accounting tracks reality. This is the
test that was *closest* to the real bug and still could not see it, for two
independent reasons:

1. **Wrong right-hand side.** `DEPOSIT_AMOUNT` is the value the deposit path just
   wrote into `totalAssetsStored`. Asserting stored state against the input that
   produced it is a mirror — it can only fail if the write is dropped entirely. The
   right-hand side had to be *custody*: the tokens the vault actually commands in the
   yield protocol. The bug is precisely a divergence between those two quantities, and
   the test never mentions the second one.
2. **Length-one sequence.** `setUp()` resets state before every test, so the gap is
   always zero at the moment of assertion. The defect is a *withdraw*-side omission,
   and this test never withdraws.

### `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

**Actually establishes:** the constant is `30`. Nothing else. It asserts a literal
against a copy of that literal.

**Only appears to establish:** that the withdrawal fee "works" — that it is charged,
charged at the right rate, applied to the right base, and lands where the spec says it
lands. The test exercises none of that. The entire economic claim ("the fee stays in
the protocol and accrues to whoever is still in") is untested; only the number is. It
would go red on an unintended edit to the constant, which is its whole value.

### `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

**Actually establishes:** the constructor stored its argument and the getter returns
it. That is a property of `solc`, not of this vault.

**Only appears to establish:** correct wiring to the token. It is a constructor
argument asserted back against itself. It also lends false confidence about USDT
specifically: the `usdt` here is a mock. A mock encodes your assumption about the
dependency, so this test re-tests the assumption. Real USDT does not return a bool
from `transfer` and carries a dormant fee-on-transfer switch — deviations that a
standard-shaped mock answers away every time, and a second route by which recorded
totals can drift from custody. That needs a pinned fork, not a getter assertion.

## 2. How 100% coverage was compatible with the bug

Coverage records **which lines executed**, never **whether any assertion could have
failed**. Two things follow, and both bit here.

**Every test above asserts the implementation back to itself** — stored state against
the value just written, a getter against the variable it returns, a constant against
itself, a constructor field against the constructor argument. Such tests execute lines
at full rate and constrain nothing. 100% line coverage with mirror assertions is 100%
coverage of code whose behaviour is unconstrained.

**Coverage cannot cover a missing line.** The defect is an *omission*: the withdraw
path takes the fee, leaves it in the yield protocol, and never credits it to
`totalAssetsStored`. There is no wrong statement to reach — the statement that should
exist does not. No line-coverage metric can report a gap in code that was never
written. A coverage tool can tell you the withdraw function ran; it cannot tell you
the withdraw function was incomplete.

Add to this that "every function exercised" is a claim about the *call graph*, while
the bug lives in the *state space*. The function was called. It was never called
enough times in enough orders, against an independently-computed expectation, for the
residue to become visible.

## 3. Why "every operation is correct in isolation" is the tell, not the alibi

It is the exact signature of an accumulation bug, and it is what you would expect to
observe if the suite's shape — N independent single-operation tests, each from a fresh
`setUp()` — were the thing hiding the defect.

- The per-withdrawal error is the fee on one withdrawal: small, correctly transferred,
  correctly left in the protocol. Nothing in that single call is wrong *as a
  transfer*. What is wrong is a bookkeeping entry that is absent, and absence has no
  observable effect until it is compared against something else.
- A test that resets state, performs one operation, and asserts, samples only
  sequences of length one. Drift is by definition a property of sequences of length
  greater than one. However many such tests you write, and whatever coverage they
  produce, the class of bug is outside what they can observe. A bug that accumulates
  across a sequence cannot be seen by any test that exercises one operation in
  isolation.
- "We cannot point at a single call that misbehaves" is therefore not evidence that
  the code is fine. It is evidence that you are looking at the wrong granularity. The
  correct next move is not more unit tests; it is a search over sequences.

One further trap worth naming explicitly, because it is the natural first fix and it
is also wrong: a **solvency** check of the shape

```solidity
assert(vault.totalAssetsStored() <= custody(vault));   // WRONG SHAPE
```

stays green through this entire bug. The vault holds *more* than it thinks. A one-
sided bound constrains one direction only — it fires on a shortfall and is silent
through any surplus. Where value can be *stranded* as well as lost, the property must
be an equality (or an explicit no-drift check), not an inequality.

## 4. The property the suite should have asserted

### Primary: accounting equals custody, exactly, after any sequence

> **P1 (conservation).** At every point, for any sequence of deposits and withdrawals
> by any set of actors in any order:
>
> `vault.totalAssetsStored() == yieldProtocol.balanceOf(address(vault)) + usdt.balanceOf(address(vault))`
>
> as an **equality**, not `<=`.

This is the property the bug violates directly, and its equality form is what makes it
catch a surplus. If the yield protocol rounds and exact equality is unattainable, the
permitted slack must be a **constant** — never a function of the number of operations
— and tracked with a ghost so a growing gap fails even while inside a nominal
tolerance. A fixed `assertApproxEqAbs(..., 1)` re-hides accumulation and is not
acceptable here.

### Supporting: the fee's stated purpose, as monotonicity

> **P2 (share price never decreases).** `totalAssets() * 1e18 / totalSupply()` is
> non-decreasing across every operation (evaluated when `totalSupply() > 0`).

The spec says the fee accrues to remaining holders. That means each fee-bearing
withdrawal must move the share price *up*. Under the bug the fee vanishes from the
accounting and the price stays flat — P2 fails on the first withdrawal, and names the
economic consequence rather than just the ledger mismatch.

> **P3 (no stranded residue).** When `totalSupply() == 0`, custody is 0 — after
> everyone exits, nothing is left that nobody can claim.

P3 is the "unclaimable tokens" symptom stated as an assertion.

### Test shape: handler-driven invariant test

Point `targetContract` at a **handler**, never at the vault. Called directly, the
fuzzer supplies random senders holding no tokens and granting no approvals, nearly
every call reverts, reverts are discarded rather than failing the run, and the
invariant is asserted against a vault that never left its initial state — green
because nothing happened.

```solidity
contract VaultHandler is Test {
    Vault  public vault;
    IERC20 public usdt;
    address[] public actors;

    uint256 public ghostDeposited;   // cumulative in
    uint256 public ghostWithdrawn;   // cumulative out
    uint256 public lastSharePrice;   // for P2

    constructor(Vault _v, IERC20 _u, address[] memory _actors) {
        vault = _v; usdt = _u; actors = _actors;
        for (uint256 i; i < actors.length; ++i) {
            deal(address(usdt), actors[i], 1_000_000e6);
            vm.prank(actors[i]);
            usdt.approve(address(vault), type(uint256).max);   // real USDT: forceApprove
        }
        lastSharePrice = 1e18;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[bound(seed, 0, actors.length - 1)];
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address a = _actor(actorSeed);
        amount = bound(amount, 1e6, usdt.balanceOf(a));       // bound(), not vm.assume
        vm.prank(a);
        vault.deposit(amount);
        ghostDeposited += amount;
        _recordPrice();
    }

    function withdraw(uint256 actorSeed, uint256 shares) external {
        address a = _actor(actorSeed);
        uint256 bal = vault.shareBalance(a);
        if (bal == 0) return;                                  // skip, don't revert
        shares = bound(shares, 1, bal);
        vm.prank(a);
        ghostWithdrawn += vault.withdraw(shares);
        _recordPrice();
    }

    function _recordPrice() internal {
        if (vault.totalSupply() == 0) return;
        uint256 p = vault.totalAssets() * 1e18 / vault.totalSupply();
        assertGe(p, lastSharePrice, "P2: share price decreased");
        lastSharePrice = p;
    }
}
```

```solidity
contract VaultInvariants is StdInvariant, Test {
    function setUp() public {
        // ... deploy vault + 4 funded actors ...
        handler = new VaultHandler(vault, usdt, actors);
        targetContract(address(handler));                       // handler, never the vault
    }

    function invariant_AccountingEqualsCustody() public view {
        assertEq(
            vault.totalAssetsStored(),
            yieldProtocol.balanceOf(address(vault)) + usdt.balanceOf(address(vault)),
            "P1: recorded total diverged from custody"
        );
    }

    function invariant_NoStrandedAssetsWhenEmpty() public view {
        if (vault.totalSupply() != 0) return;
        assertEq(yieldProtocol.balanceOf(address(vault)) + usdt.balanceOf(address(vault)), 0, "P3");
    }
}
```

Run it with `fail_on_revert = true` while building the handler, and **read the
calls/reverts statistics on every run**. A revert rate near 100% means the sequences
never reached real states and the run proved nothing. Depth must be large enough that
many withdrawals occur in one sequence — the whole point is sequences of length
greater than one.

### Deterministic companion, to show accumulation rather than a single mismatch

One post-operation mismatch proves divergence, not growth. Pin the accumulation with a
concrete test that performs **two** fee-bearing withdrawals and records the gap after
each:

```solidity
function test_FeeDriftAccumulatesAcrossWithdrawals() public {
    _deposit(alice, 100_000e6);
    _deposit(bob,   100_000e6);

    _withdrawAll(alice);
    uint256 gap1 = _custody() - vault.totalAssetsStored();

    _withdrawHalf(bob);
    uint256 gap2 = _custody() - vault.totalAssetsStored();

    assertEq(gap1, 0, "gap after first fee-bearing withdrawal");
    assertEq(gap2, 0, "gap after second");   // gap2 > gap1 demonstrates accumulation
}
```

### Two further gaps the same review surfaces

- **`WITHDRAW_FEE_BPS` is an owner-settable number feeding value math.** It needs a
  fuzz test over its whole accepted domain using `bound()`, plus the boundaries
  classified and exercised separately: the nearest valid value below the cap, the cap
  itself, and the first value beyond it. Decide first which of those is *semantically*
  usable — do not assume the exact limit is valid just because only values past it
  break a numeric inequality. `30` is one hand-picked point on one branch.
- **USDT needs a pinned fork**, not a mock: `vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), <block>)` against the real deployment, on an endpoint confirmed to serve archive state at that block. Pin the block — an unpinned fork follows the head and gives you drifting assertions and cache misses.

## 5. The short answer to the lead

100% coverage means every line ran. It does not mean any assertion could have failed,
and it cannot see a line that was never written — which is exactly what this bug is.
The suite performed none of the three searches that would have found it: no fuzz over
the fee domain, no handler-driven invariant over sequences, no pinned fork against
real USDT. The tests that exist mostly assert the implementation back to itself, and
every one of them resets state and performs a single operation, so the class of bug
"error that accumulates across a sequence" was outside their reach by construction.
The fix is not more unit tests. It is P1 as an equality, checked by a handler-driven
invariant run to real depth.

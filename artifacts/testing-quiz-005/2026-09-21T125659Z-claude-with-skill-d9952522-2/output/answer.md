# Why 39 green tests and 100% coverage missed the fee drift

## 1. What each test actually establishes

### `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

**Establishes:** the first deposit of one specific amount, into an empty vault, returns
some fixed number of shares, and that the returned value and the stored balance agree —
i.e. `deposit` does not lie to its caller about what it credited.

**Only appears to establish:** that share minting is *correct*. `999e18` is a magic
constant. Nobody can read this test and say where the number comes from, so nobody can
say whether it is the right number — it was almost certainly captured from a run and
pasted back in. A test written that way can only fail if the behaviour changes, never if
the behaviour was wrong to begin with; it pins the implementation, it does not check it.
Note also that `999e18` shares against a `DEPOSIT_AMOUNT` that the next test asserts is
recorded in full is an unexplained 1:0.999 relationship the suite never accounts for.
More important: this is the *empty vault* case, where share price is 1 by construction.
The bug lives entirely in how share price moves *after* withdrawals, which this input
cannot reach.

### `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

**Establishes:** a deposit increments the accounting by the amount deposited, once, from
zero.

**Only appears to establish:** that accounting tracks reality. This is the painful one.
The suite has both `totalAssets()` and `totalAssetsStored()` in adjacent assertions — the
two quantities whose divergence *is* the bug — and still missed it, because it compares
them only at the single moment they are guaranteed to agree: immediately after a deposit
into a fresh vault, before any fee has ever been charged. Drift is provably zero there.
Checking an equality precisely where it cannot fail is indistinguishable, from the test
report's point of view, from checking it where it can.

It is also an implementation mirror: state is asserted against the value just written to
it. Passing tells you the assignment happened, not that the assignment was right.

### `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

**Establishes:** the literal `30` appears in the contract. Nothing else.

**Only appears to establish:** that the fee is *handled* correctly. This asserts a
constant against itself. There is no state transition, no arithmetic, no caller — the
only way it fails is if someone edits the constant, at which point they edit this line
too. It is the test most responsible for the false confidence here, because on the
coverage report it lights up the fee as "covered" while saying nothing whatsoever about
where the fee goes, who it accrues to, or whether it stays counted.

### `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

**Establishes:** the constructor assigns its argument to the field, and the getter
returns that field.

**Only appears to establish:** that the USDT integration works. It asserts constructor
state against the constructor argument — a compiler test. And the token in question is
USDT, whose real deployment returns no boolean on `transfer`, can be blacklisted, and
carries a live fee-on-transfer switch. This test is run against a mock, so it re-tests
the mock's conformance to the assumption that wrote it. Nothing here touches the real
deployment's behaviour.

## 2. How 100% coverage was compatible with the bug

Coverage answers one question: *was this line executed?* It never asks whether any
assertion was positioned such that it could have failed. A tautology like
`assertEq(vault.WITHDRAW_FEE_BPS(), 30)` is a covered line and a zero-information test,
and the instrumentation cannot tell the two apart. So "100% of lines, 100% of functions"
is compatible with a suite where every single assertion is either a mirror of the
implementation or evaluated at a point where it holds trivially. That is roughly what you
have.

There is a second, sharper reason, and it is structural rather than a matter of test
quality. **Coverage is a property of individual lines; this bug is a property of
sequences.** The defective line — the one that subtracts the gross amount from
`totalAssetsStored` while only the net amount actually leaves custody — executes on
*every* withdrawal, in every withdrawal test, and reports as covered. It has 100%
coverage and it is wrong. What no single execution of it can show is that the discrepancy
it leaves behind is never reconciled and therefore *adds up*. To see a `30 bps` shortfall
you need at least two fee-bearing withdrawals and an assertion that compares accounting
to custody *after* them. There is no line-coverage metric that can express "this line was
executed twice in a row with state carried between." Coverage is the wrong instrument for
the class of bug, not merely a lenient one.

## 3. Why "every operation is correct in isolation" is the tell

Your lead is reading that sentence as an alibi: no call misbehaves, therefore the contract
is fine. Invert it. You have a confirmed, quantified loss — real tokens in the protocol
that no share can claim — and you have proven that no single call causes it. That
eliminates every hypothesis a unit test could ever have caught, and leaves only one
family standing: the fault is in what operations *leave behind for each other*, which is
visible only across a sequence.

Concretely, each withdrawal here is internally consistent. The user's shares are valued
correctly at the current price, the 30 bps is computed correctly, the user receives
exactly gross-minus-fee, the shares burn correctly, and the fee tokens do stay in the
yield protocol as designed. Every local assertion you could write about that call passes.
The error is that the fee was subtracted from the recorded total as though it had left,
when it had not — so the vault's *claim* on its own holdings shrinks by the fee while the
holdings do not. The share price for everyone remaining is understated by exactly the fee
that was supposed to reward them, and the gap is monotonically increasing: it can never be
reduced by any subsequent operation, because nothing in the contract ever recomputes
recorded assets from custody.

So "correct in isolation" is not evidence of health. It is a precise description of where
the bug must be, and it tells you the suite was searching in the one place the bug could
not be.

## 4. The property the suite should have asserted

### The property, precisely

> **Custody conservation.** At every point in the vault's lifetime, after any sequence of
> deposits and withdrawals in any order by any set of actors, the vault's recorded total
> equals the assets it actually controls:
>
> ```
> vault.totalAssetsStored() == vault.totalAssets()
> ```
>
> where `totalAssets()` is derived from actual custody — the vault's balance in the yield
> protocol plus any idle token balance — and never from the stored figure.

Three things about the shape, each of which the current suite gets wrong:

**It must be an equality, not a bound.** The tempting form is
`totalAssetsStored() <= totalAssets()` — "we are never insolvent." That version is green
for this bug. You said it yourself: nothing is insolvent, the vault holds *more* than it
thinks. A one-sided bound fires on a shortfall and stays green through any amount of
stranded surplus, and stranding is exactly the failure mode you shipped. Where value can
be orphaned as well as lost, only an equality (or an explicit no-drift check against a
tracked expected surplus) constrains both directions.

**It must be asserted after sequences, not after setup.** One post-operation mismatch
proves divergence; it does not prove accumulation. The regression test therefore needs at
least two fee-bearing withdrawals, so the report shows the gap growing from `fee` to
`2 * fee` rather than a single unexplained mismatch.

**The right-hand side must come from custody.** If `totalAssets()` is itself implemented
as a read of the stored variable, the invariant is a tautology and everything above is
wasted. Assert against the yield protocol's reported balance for the vault plus
`usdt.balanceOf(address(vault))`.

A companion property worth stating alongside it, because it is what the fee was *for*:

> **Share price monotonicity.** A withdrawal never decreases the price per share for the
> holders who remain: `totalAssets() / totalSupply()` is non-decreasing across any
> withdrawal. Under the intended design a fee-bearing withdrawal strictly increases it.

That one fails on the buggy contract too, and it fails in the language of the actual harm:
remaining holders are not being paid the fee.

### The test shape

**(a) The handler-driven invariant — this is the search that finds the bug.**

```solidity
contract VaultHandler is Test {
    Vault  public vault;
    IERC20 public usdt;
    address[] public actors;

    uint256 public ghost_depositedTotal;
    uint256 public ghost_withdrawnNetTotal;

    constructor(Vault _vault, IERC20 _usdt, address[] memory _actors) {
        vault = _vault; usdt = _usdt; actors = _actors;
        for (uint256 i; i < actors.length; ++i) {
            deal(address(usdt), actors[i], 1_000_000e6);
            vm.prank(actors[i]);
            usdt.approve(address(vault), type(uint256).max);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[bound(seed, 0, actors.length - 1)];
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address a = _actor(actorSeed);
        amount = bound(amount, 1e6, usdt.balanceOf(a));
        vm.prank(a);
        vault.deposit(amount);
        ghost_depositedTotal += amount;
    }

    function withdraw(uint256 actorSeed, uint256 shares) external {
        address a = _actor(actorSeed);
        uint256 bal = vault.shareBalance(a);
        if (bal == 0) return;                    // skip, don't revert
        shares = bound(shares, 1, bal);
        uint256 before = usdt.balanceOf(a);
        vm.prank(a);
        vault.withdraw(shares);
        ghost_withdrawnNetTotal += usdt.balanceOf(a) - before;
    }
}
```

```solidity
contract VaultInvariants is Test {
    function setUp() public {
        // ... deploy vault, seed an initial depositor so the vault is never empty ...
        handler = new VaultHandler(vault, usdt, actors);
        targetContract(address(handler));
    }

    /// @dev The property. Fails on the shipped contract after the first
    ///      fee-bearing withdrawal, and the gap widens with each one.
    function invariant_recordedEqualsCustody() public view {
        assertEq(vault.totalAssetsStored(), _custody(), "accounting/custody drift");
    }

    /// @dev Independent path to the same fact, immune to a buggy totalAssets().
    function invariant_custodyMatchesFlows() public view {
        assertEq(
            _custody(),
            handler.ghost_depositedTotal() - handler.ghost_withdrawnNetTotal(),
            "custody does not match net flows"
        );
    }

    function _custody() internal view returns (uint256) {
        return yieldProtocol.balanceOf(address(vault)) + usdt.balanceOf(address(vault));
    }
}
```

Two details that decide whether this run means anything. `targetContract` points at the
**handler**, never at the vault — aimed at the vault directly, the fuzzer calls
`withdraw` from random addresses holding no shares, nearly everything reverts, reverts are
discarded rather than failed, and the invariant gets asserted against a vault that never
left `setUp`. Green because nothing happened. And **read the calls/reverts line in the
output every run**; set `fail_on_revert = true` while building the handler. A revert rate
near 100% proves nothing regardless of how the invariant reads.

**(b) The regression test, once the invariant hands you a counterexample.** This is
documentation of a known bug, not a search — it goes in *after*, never instead:

```solidity
function test_WithdrawFeeStaysCounted() public {
    _deposit(alice, 1_000e6);
    _deposit(bob,   1_000e6);

    uint256 priceBefore = vault.totalAssets() * 1e18 / vault.totalSupply();

    _withdraw(alice, vault.shareBalance(alice) / 2);
    assertEq(vault.totalAssetsStored(), _custody(), "drift after 1st withdrawal");

    _withdraw(alice, vault.shareBalance(alice));          // second fee-bearing exit
    assertEq(vault.totalAssetsStored(), _custody(), "drift after 2nd withdrawal");

    // the fee was supposed to accrue to whoever stayed in
    uint256 priceAfter = vault.totalAssets() * 1e18 / vault.totalSupply();
    assertGt(priceAfter, priceBefore, "withdraw fee did not accrue to remaining holders");
}
```

Two withdrawals, not one, so the failure output shows the gap growing rather than a single
mismatch that could be argued as a rounding artefact.

**(c) Fuzz the fee across its domain.** `WITHDRAW_FEE_BPS` is a constant at 30 here, so
fuzz what is variable — amounts, share counts, actor ordering — via the handler above. If
that fee ever becomes owner-settable, it needs its own fuzz test over the whole accepted
range with `bound()` (not `vm.assume()`), plus the boundaries classified and exercised
separately: the largest ordinarily-usable value, the exact cap, and the first value past
it. Hand-picked `30` walks one branch.

**(d) Fork for USDT.** Replace `test_ConstructorSetsUsdt` with the integration exercised
against the real token at a pinned block:

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
```

Pin the block — an unpinned fork tracks the head, so reserves and prices move between
runs, assertions flake, and the local cache never hits. Pinning an old block is an archive
request, so confirm your endpoint answers a historical `eth_call` at that block before
relying on it. Mainnet USDT returns no boolean from `transfer`, has a live fee-on-transfer
switch, and can blacklist an address mid-position; a mock written to the ERC-20 interface
answers in the standard shape every time and can never surface any of that. The fee-on-
transfer switch in particular interacts directly with the invariant above — that is
another route to accounting/custody divergence, and it is only reachable on a fork.

## 5. What to tell your lead

The suite was thorough in the one dimension coverage measures and did not perform a single
one of the three searches this contract needed. It has configurable value math and no
fuzzing over its domain; stateful accounting and no handler invariant tying accounting to
custody; an integration with the quirkiest ERC-20 on mainnet and no pinned fork. Thirty-nine
green tests confirmed the cases someone had already thought of. The drift was not among
them, and no number of additional single-operation tests would have changed that.

Before this ships again:

- [ ] No test asserts the implementation back to itself — the four above all do; rewrite them.
- [ ] Handler-driven invariant tying `totalAssetsStored()` to actual custody, as an
      **equality**, with a verified-low revert rate.
- [ ] Share-price monotonicity across withdrawals asserted.
- [ ] Fee/ratio parameters fuzzed across their domain with `bound()`, boundaries classified.
- [ ] USDT exercised on a pinned fork against the real deployment.
- [ ] `slither .` clean of high and medium findings.

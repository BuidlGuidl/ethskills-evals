# Why 100% coverage missed the fee-setter bug

## Short version

`setDepositFee` has no domain check. `depositFeeBps` is a `uint256` that the deposit
path implicitly assumes lives in `[0, BPS_DENOMINATOR)`, but nothing in the code
enforces that assumption — it only lives in the heads of the people who wrote
`deposit()`. Ops set a value at or above `10_000` and every deposit reverted from
then on.

The suite tested the fee *maths* at four points, all deep inside the valid region,
and tested the setter's *mechanics* (it stores, it emits, it's owner-gated). It
never tested the setter's **contract with the rest of the system**.

## What coverage actually measures

`forge coverage` answers "was this line executed by some test?" — not "was this line
executed with an input that matters?". Both functions are straight-line code with no
branches:

```solidity
uint256 previousFeeBps = depositFeeBps;
depositFeeBps = newFeeBps;               // executed
emit DepositFeeUpdated(previousFeeBps, newFeeBps);
```

```solidity
uint256 fee = (amount * depositFeeBps) / BPS_DENOMINATOR;  // executed
uint256 netAmount = amount - fee;                          // executed
shares = convertToShares(netAmount);                       // executed
if (shares == 0) revert NoSharesMinted();                  // executed (branch not taken)
```

A single `setDepositFee(10)` + one `deposit()` lights up 100% of the lines in both.
Line coverage saturates after one input; it is a *reachability* metric, not an
*adequacy* metric. It cannot distinguish `setDepositFee(10)` from
`setDepositFee(10_000)` because both traverse the identical instruction sequence.
The bug isn't on a line that was missed — it's on a line that *wasn't written*
(the missing bound), and no coverage tool can measure the coverage of absent code.

Note also that even the `NoSharesMinted` revert branch shows as "covered" at the
statement level while never having been taken; branch coverage would have flagged
that gap, and line coverage did not.

## The class of input the suite never tried

**Out-of-domain / boundary values for an unvalidated admin parameter, exercised
across a function boundary.**

Two independent gaps stack here:

1. **Input-domain gap.** 0, 10 and 25 are all in `[0, 10_000)`. They are all "small,
   plausible, hand-picked" values chosen by the same person who wrote the formula,
   so they encode the same assumption the code does. Hand-picked cases are drawn
   from the developer's mental model; the failure was *outside* that model, so no
   amount of hand-picking from inside it could reach it. Crucially, they never probe
   the boundary at `depositFeeBps == BPS_DENOMINATOR`, which is exactly where
   `netAmount` collapses to zero, nor anything above it, where the subtraction
   underflows.

2. **Cross-function gap.** The setter tests only assert on storage and the event;
   the deposit tests only use fee values fixed in `setUp()`. Nothing in the suite
   ever runs the sequence *set a hostile fee → then deposit*. The bug only exists in
   the composition of the two functions, and the suite tests them in isolation. This
   is precisely the shape of bug unit tests structurally cannot see.

There is also a third, purely arithmetic consequence: for very large `newFeeBps`,
`amount * depositFeeBps` overflows `uint256` and reverts before the subtraction ever
runs. Same symptom, different revert.

## The arithmetic for the input that breaks it

Assume an 18-decimal asset and a healthy 1,000-token deposit,
`amount = 1_000e18 = 1_000_000_000_000_000_000_000`.

### Case A — the exact boundary, `depositFeeBps = 10_000` (100%)

```
fee       = (1_000e18 * 10_000) / 10_000
          = 10_000_000_000_000_000_000_000_000 / 10_000
          = 1_000e18                 // the entire deposit
netAmount = 1_000e18 - 1_000e18 = 0
shares    = convertToShares(0)  = 0
          -> revert NoSharesMinted()
```

`fee == amount` holds for **every** `amount`, because the fee is a pure proportion:
`(amount * 10_000) / 10_000 == amount` exactly, with no rounding slack anywhere. So
`netAmount` is 0 for a 1 wei deposit and for a 1,000,000-token deposit alike. The
vault does not merely become expensive — it becomes *totally closed*, which matches
"every single deposit reverted". No user-side workaround exists: there is no deposit
size that gets through.

### Case B — one basis point past it, `depositFeeBps = 10_001`

```
fee       = (1_000e18 * 10_001) / 10_000
          = 10_001_000_000_000_000_000_000_000 / 10_000
          = 1_000.1e18
netAmount = 1_000e18 - 1_000.1e18
          -> arithmetic underflow, Panic(0x11)   // Solidity >=0.8 checked math
```

Still a total outage, but now with an unhelpful panic instead of the custom error.

### Case C — the overflow tail, e.g. `depositFeeBps = 2**200`

```
amount * depositFeeBps  overflows uint256  ->  Panic(0x11) on the multiply
```

Same outage, third distinct failure mode — worth knowing because a test that only
asserts `vm.expectRevert(NoSharesMinted.selector)` would pass on Case A and fail to
describe B and C.

### The plausible ops input

The promotion almost certainly involved a units mix-up — "set the fee to 100" meaning
100%, entered as `10_000`; or a percent-vs-bps slip where `50` (0.5%) was typed as
`50_00`... any of these lands at or above the denominator. The setter accepted it
silently, emitted a tidy `DepositFeeUpdated` event, and the transaction succeeded.
Nothing looked wrong until the next deposit.

## The technique that would have caught it

**Fuzz the setter's input jointly with a deposit — i.e. a property test over the
`(newFeeBps, amount)` product space rather than example tests over either alone.**

The key move is not "add fuzzing" in the abstract; it is *letting the fuzzer choose
the admin parameter*. Fuzzing `amount` while `depositFeeBps` stays pinned at 25
would have found nothing. The unvalidated variable is the one that has to be fuzzed,
and it must be fuzzed **unbounded** — `bound(feeBps, 0, 10_000)` in the test would
re-import the very assumption under test and re-hide the bug. Bound the token
amount (that domain really is constrained); leave the fee wide open.

```solidity
/// The vault must never be bricked by a fee the owner is allowed to set.
function testFuzz_AnySettableFeeStillAllowsDeposits(uint256 feeBps, uint256 amount)
    public
{
    amount = bound(amount, 1e18, 1e30);   // real constraint: bound it
    // feeBps deliberately NOT bounded — that is the whole point of the test

    vm.prank(owner);
    try vault.setDepositFee(feeBps) {
        // If the setter accepted it, the vault must remain operational.
        deal(address(token), alice, amount);
        vm.startPrank(alice);
        token.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);
        vm.stopPrank();
        assertGt(shares, 0, "accepted fee bricked deposits");
    } catch {
        // Rejecting an out-of-range fee is the correct behaviour.
    }
}
```

Foundry's fuzzer seeds its dictionary with constants lifted from the contract —
`BPS_DENOMINATOR = 10_000` is literally in the source — plus boundary values like
`0`, `1`, `type(uint256).max` and neighbours of observed constants. `10_000` and
`10_001` are therefore among the first values it tries, not values it has to stumble
onto by luck. This fails in single-digit seconds on the default 256 runs.

The test states the real requirement: *any fee the setter accepts must leave the
vault able to mint shares.* That is a property, not an example, which is why it
generalises to the input nobody thought of.

**Reinforce with an invariant test.** Give the handler a `setFee(uint256)` action
alongside `deposit`/`withdraw`, so the fuzzer explores random *sequences* of admin
retunes interleaved with user activity — this is the "ops changed a knob in
production" scenario reproduced mechanically:

```solidity
function invariant_DepositsAlwaysPossible() public {
    assertLt(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "fee can brick vault");
}
```

The unit tests were not wrong, just insufficient: they verified the formula, and the
formula was never the problem. The missing test was the one that asked what the
formula does with a legal-but-absurd configuration.

## The fix the test drives you to

Validation belongs in the setter, where the bad value enters, not in `deposit()`,
where it is discovered:

```solidity
uint256 public constant MAX_DEPOSIT_FEE_BPS = 500; // 5% — a real policy ceiling

error FeeTooHigh(uint256 requested, uint256 maximum);

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_DEPOSIT_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_DEPOSIT_FEE_BPS);
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

`< BPS_DENOMINATOR` is the *correctness* bound; a much tighter policy cap like 5% is
the one you actually want, since a 99% fee is a rug in all but name and users should
be able to verify the ceiling on-chain rather than trust the owner. Add the two
example tests the fuzzer's counterexample hands you — `setDepositFee(10_000)` and
`setDepositFee(MAX + 1)` both revert — as fast regression guards, and keep the fuzz
test as the thing that catches the *next* unvalidated parameter someone adds.

One aside worth raising with ops: the incident did not require a redeploy. The state
was recoverable with a single `setDepositFee(25)` from the owner. That a redeploy
was reached for first suggests the runbook is missing an entry, which is its own
finding independent of the test gap.

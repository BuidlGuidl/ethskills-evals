# Pre-deploy test review: onchain credit pool

## Verdict: no, this is not enough to sign off.

"Green suite, every line covered, local mocks, one-operation examples" is the exact
profile of a suite that proves the code runs and proves nothing about whether it is
correct. Line coverage counts *lines executed*, not *states reached*. All three
surfaces you describe are state-space or integration problems, and none of the three
is exercised by the evidence you currently have:

| Surface | What you have | What it proves | What it does not prove |
|---|---|---|---|
| 1. `reserveFactorWad` | Two hand-picked values (0, 0.2e18) | Those two values work | Anything about the other 2^256-2 values the setter accepts |
| 2. Repayment accounting | One deposit, one repayment, one mismatch | A mismatch exists at t=1 | That it accumulates, who absorbs it, or whether it is recoverable |
| 3. Chainlink + collateral | Standard-behaviour mocks | Your code works against your assumptions | That your assumptions match the deployed contracts |

Below, per surface: the experiment I would require, and what makes the result
meaningful rather than decorative.

---

## Surface 1 — `reserveFactorWad`: an unbounded setter feeding a subtraction

### The actual risk

`net = assets * (1e18 - reserveFactorWad) / 1e18` with a setter that accepts any
`uint256` has three distinct failure regions, and the two existing tests (0, 0.2e18)
sit in the interior of the only safe one.

**First question to answer before writing any test — read the source:** is
`1e18 - reserveFactorWad` inside an `unchecked` block?

- **Checked (Solidity ≥0.8 default):** any `reserveFactorWad > 1e18` makes every
  redemption revert with panic `0x11`. Redemptions are bricked by a single governance
  transaction, with no clean error and no way to distinguish it from a bug. Recovery
  depends on whether the setter is still callable — if the setter is itself behind a
  path that touches redemption logic, it is a permanent freeze.
- **Unchecked:** `1e18 - reserveFactorWad` wraps to a near-`type(uint256).max`
  multiplier. `net` becomes astronomically larger than `assets`, or the multiplication
  overflows. This is a drain, not a DoS. This is the finding that would stop the
  deploy outright.

That single source read determines whether surface 1 is a liveness bug or a solvency
bug. Do it first.

### Limit cases I would require as explicit named tests

Not fuzz — fuzz will find these slowly and report them as unhelpfully-shaped
counterexamples. Pin them:

| `reserveFactorWad` | Required asserted behaviour |
|---|---|
| `0` | `net == assets` exactly. No fee path taken. |
| `1` | `net == assets - (assets / 1e18)`, i.e. rounding is *down* against the redeemer, never up. |
| `1e18 - 1` | `net == assets / 1e18`. **This is the interesting one** — see below. |
| `1e18` | `net == 0` for *every* `assets`. All redemptions revert. Total, silent, permanent withdrawal freeze reachable by one governance call. |
| `1e18 + 1` | Setter must reject. If it does not, assert exactly what happens (panic vs wrap) — do not leave it untested. |
| `type(uint256).max` | Setter must reject. |

**The `1e18 - 1` case is the one your plan will miss and the one that matters most in
production.** At that value, `net == assets / 1e18`. Every redemption of less than
`1e18` base units rounds to zero and reverts. If the pool's asset is a 6-decimal token
(USDC, USDT — the normal case for a credit pool), `1e18` base units is **1 trillion
tokens**. Every real redemption in the pool reverts. And this is reachable well before
the boundary: the revert condition is `assets * (1e18 - reserveFactorWad) < 1e18`, so
there is an entire *region* of high-but-legal reserve factors in which ordinary-sized
redemptions revert while the contract looks configured normally. The
`revert when net == 0` guard turns a rounding artifact into a denial of service, and
the smaller the redemption the earlier it triggers — dust holders get permanently
stranded first.

### The experiment

```solidity
// Fuzz the RAW setter input. Do NOT bound it to [0, 1e18] —
// bounding to the valid range tests the cap you have not written yet.
function testFuzz_SetReserveFactor_RejectsOrIsSafe(uint256 rf) public {
    vm.prank(governance);
    try pool.setReserveFactorWad(rf) {
        assertLt(rf, 1e18, "setter accepted a value that zeroes or inverts redemptions");
    } catch {
        assertGe(rf, MAX_RESERVE_FACTOR);
    }
}

// Then fuzz the math jointly, only over values the setter is supposed to allow.
function testFuzz_RedeemNeverCreatesValue(uint256 assets, uint256 rf) public {
    rf = bound(rf, 0, MAX_RESERVE_FACTOR - 1);
    assets = bound(assets, 1, 1e30);
    _setReserveFactor(rf);
    uint256 net = pool.previewRedeem(assets);
    assertLe(net, assets, "net exceeded gross — fee is negative");
    assertGe(net, 0);
}
```

Run at **≥10,000 runs**, not the 256 default.

### What makes the evidence meaningful

A passing fuzz run is not the deliverable. The deliverable is one of:

1. **A cap in the setter** — `require(rf <= MAX_RESERVE_FACTOR)` with `MAX_RESERVE_FACTOR`
   set to an economically justified value (I would argue for something like `0.5e18`,
   not `1e18 - 1`), *plus* a test asserting rejection at exactly `MAX + 1` and
   acceptance at exactly `MAX`. A cap without a boundary test is a cap nobody has
   checked the sign of.
2. Failing that, a written argument for why the full `uint256` range is safe — which,
   given the `1e18` case above, cannot be made.

Additionally I would require a governance-process answer, because the test cannot
provide one: setting `reserveFactorWad` to a value in the DoS region is a single
transaction that freezes all user withdrawals. Cap plus timelock, or the cap alone is
a speed bump.

Also confirm `assets * (1e18 - rf)` cannot overflow for any reachable `assets` — with
a plain `*` this overflows above roughly `1.16e59` base units. Either bound total
supply, or use `mulDiv`. Assert the chosen answer.

---

## Surface 2 — Repayment accounting: one observation is not a trend

### Why the current evidence does not support the claim

You have one deposit, one repayment, one observed mismatch, and a conclusion that
"the mismatch accumulates." A single measurement cannot distinguish between:

- a **one-time constant offset** (seeded at initialisation, harmless, self-correcting),
- a **per-operation drift** that grows linearly with repayment count (your hypothesis),
- a **compounding** drift that grows with repayment count *and* interacts with share
  price so each subsequent depositor is mispriced worse than the last.

These have very different severities and very different fixes. The test as written
asserts a number at N=1 and calls it a slope. That is the single most common way
accounting bugs get mis-triaged — either dismissed as dust or escalated as a drain,
with no evidence either way.

### Get the direction right first

`accountedAssets` is reduced by the **gross** repayment while only the **net** leaves
the pool (the protocol cut stays). So `accountedAssets` **understates** the assets
actually held. Real balance drifts *above* the accounted figure. Consequences:

- Share price (`convertToAssets`) is computed off the understated figure, so
  **redeemers are systematically short-changed** — each redemption pays out less than
  the pool's real backing.
- The surplus is not stolen; it silently pools in the contract. If there is no
  `protocolReserves` variable tracking it, it is **unwithdrawable by anyone** —
  permanently stranded, growing with every repayment.
- The last redeemer either gets a windfall (if accounting nets out at zero supply) or
  the pool's final redemption reverts on an underflow. Which one it is depends on code
  you have not tested.

If there is no explicit state variable holding the retained cut, *that is the bug* —
the cut is untracked, not merely mis-timed.

### The experiment that would actually demonstrate accumulation

**(a) A parameterized drift test — establishes the functional form, not a point.**

```solidity
function testFuzz_DriftIsExactlySumOfCuts(uint8 n, uint256 repayAmount) public {
    uint256 count = bound(n, 1, 50);
    repayAmount = bound(repayAmount, 1e6, 1e12);

    _seedPool();
    uint256 expectedCuts;
    uint256 prevDrift;

    for (uint256 i = 0; i < count; i++) {
        uint256 cut = _expectedProtocolCut(repayAmount);
        _repay(repayAmount);
        expectedCuts += cut;

        uint256 drift = asset.balanceOf(address(pool)) - pool.accountedAssets();

        // Closed form: proves the MECHANISM, not just the trend.
        assertEq(drift, expectedCuts, "drift is not the accumulated protocol cut");
        // Strict monotonicity: proves it is not a one-time offset.
        assertGt(drift, prevDrift, "drift did not grow on repayment");
        prevDrift = drift;
    }
}
```

Asserting `drift == Σ cut_i` in closed form is what makes this meaningful.
`assertGt(drift_N, drift_1)` alone would only show growth; the closed form identifies
the *source* and lets you state the exact production exposure as a function of
repayment volume.

**(b) A who-eats-it test — converts an accounting fact into a user-impact fact.**

Two depositors, Alice and Bob, equal deposits. N repayments. Alice redeems in full,
then Bob redeems in full. Assert:

- Alice's proceeds vs. her fair share of real backing — quantify her loss in base units.
- Bob's proceeds — is he made whole, over-paid, or does his redemption revert?
- The residual `asset.balanceOf(pool)` after total supply hits zero — assert the exact
  stranded amount and assert whether *any* function in the contract can move it. If
  none can, say so explicitly in the finding.

This is the assertion that determines severity. Without it you have a number; with it
you have "each repayment strands X and short-changes exiting LPs by Y."

**(c) An invariant suite — the real requirement for a stateful lending pool.**

Handler exposing `deposit / withdraw / borrow / repay / redeem / accrueInterest /
setReserveFactor`, multiple actors, random sequences:

```solidity
// The solvency identity. If there is no protocolReserves() term to add,
// this invariant CANNOT be stated — which is itself the finding.
function invariant_BalanceEqualsAccountedPlusReserves() public view {
    assertEq(
        asset.balanceOf(address(pool)),
        pool.accountedAssets() + pool.protocolReserves()
    );
}

function invariant_SolventForAllRedeemers() public view {
    assertGe(pool.totalAssets(), pool.convertToAssets(pool.totalSupply()));
}
```

`foundry.toml`: `[invariant] runs = 512, depth = 50, fail_on_revert = false`.

### What makes the invariant evidence meaningful

A passing invariant run is worthless unless you prove the sequences actually reached
the interesting states. **I would require the handler's call-count ghost variables in
the output** (`console.log` in `invariant_CallSummary()`, or `--show-metrics`). The
standard failure mode is an invariant suite where the majority of handler calls revert
early — on insufficient balance, on unapproved transfers, on an empty pool — so the
invariant holds vacuously over a state space of "nothing happened" and the suite goes
green while testing nothing.

**Specifically: prove that `repay` was called a meaningful number of times, with
`redeem` interleaved between repayments and with more than one depositor active.** If
the summary shows 4,000 deposits and 11 successful repayments, the suite has not tested
the surface in question, regardless of what it reports.

---

## Surface 3 — Chainlink feed and collateral token: mocks encode your assumptions

### The core problem

A "standard-behaviour mock" is a written record of what you *believe* the production
contract does. Running your code against it can only confirm that your code is
consistent with your own beliefs. It cannot detect the case where the belief is wrong
— and that case is precisely why integration bugs reach mainnet. The production
addresses are known and no test has called them, so the most consequential thing you
could learn is currently the thing you have not tried to learn.

### 3a. Verify the addresses themselves, in the test

Do not accept production addresses from a config file, a PR description, or anyone's
memory — including mine. Each one gets checked against its authoritative source
(Chainlink's published feed registry for the aggregator; the token issuer's own
documentation or a block explorer's verified contract page for the collateral) and then
**re-asserted in `setUp()` as a self-check**:

```solidity
function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);

    // Guard against a transposed or stale constant. Cheap, catches the worst class of error.
    assertGt(FEED.code.length, 0, "no code at feed address at this block");
    assertGt(COLLATERAL.code.length, 0, "no code at collateral address at this block");
    assertEq(AggregatorV3Interface(FEED).description(), "XXX / USD");
    assertEq(IERC20Metadata(COLLATERAL).symbol(), "XXX");
    assertEq(IERC20Metadata(COLLATERAL).decimals(), EXPECTED_COLLATERAL_DECIMALS);
}
```

A wrong-address constant is otherwise indistinguishable from a logic bug at 2am.

### 3b. The Chainlink feed — what the mock almost certainly gets wrong

Check every one of these against the *real* feed, not the mock:

1. **`decimals()`.** USD-quoted feeds are typically 8; ETH-quoted feeds are typically
   18. If the mock returns 18 and production returns 8, every price in your liquidation
   math is off by `1e10` and liquidations either never trigger or trigger instantly.
   Assert the contract's scaling against `FEED.decimals()` read live from the fork —
   never against a hardcoded constant that agrees with the mock by construction.
2. **Staleness.** The mock is never stale; the real feed has a heartbeat and can be.
   Does the contract check `updatedAt`? Test: `vm.warp(block.timestamp + heartbeat + 1)`
   and assert the read reverts. If the contract does not check `updatedAt` at all, that
   is a finding on its own — liquidations priced off an arbitrarily old answer.
3. **`answer` is `int256`.** The mock returns positive values. Assert the behaviour on
   `answer == 0` and `answer < 0`. An unchecked `uint256(answer)` cast on a negative
   value produces an enormous price.
4. **`answeredInRound` / `roundId`** — assert whatever incomplete-round handling the
   contract claims to do, or record that it does none.
5. **Circuit-breaker clamping.** Some aggregators clamp at `minAnswer`/`maxAnswer`. In
   a crash the feed keeps reporting the floor while the real price is below it — the
   historical failure mode that produced real losses. Assert what your liquidation does
   with a clamped price.

For 2–4, inject the values with **`vm.mockCall` against the real forked address**, not
by swapping in a mock contract. That way the contract under test still resolves the
real address, the real interface, the real `decimals()` — you are perturbing one return
value inside an otherwise fully real environment.

### 3c. The collateral token — the deployed one, not the ideal one

`transfer` on a real token is not the `transfer` in your mock. Test on the fork for:

- **Missing return value** (USDT-style). If the code uses a raw `IERC20.transfer` rather
  than `SafeERC20`, it reverts on decode against such a token. Mocks always return `true`.
- **Fee-on-transfer / rebasing.** Assert **measured balance deltas before and after**,
  never the amount argument and never the return value. A fee-on-transfer collateral
  means the pool receives less than it credits.
- **Blocklist / pausable.** Can a blocklisted borrower or a paused token make a position
  unliquidatable? Assert the behaviour; a revert here is a stuck bad-debt position.
- **Non-18 decimals**, and **proxy/upgradeability** — pin the implementation at the
  block so an upgrade cannot silently change the test's meaning.

On funding: prefer **pranking a large holder identified at the pinned block** over
`deal()`. `deal()`'s storage-slot inference fails or silently corrupts state on proxied
and non-standard tokens, and a test funded by corrupt state is worse than no test.

### 3d. Reproducibility — the part your question is right to insist on

```toml
# foundry.toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"

[profile.fork]
# fork tests kept off the default local run
```

```solidity
uint256 constant PINNED_BLOCK = 19_000_000; // replace with a real, chosen block
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
```

Requirements:

- **Always pin the block number.** An unpinned fork test is a test whose result changes
  with the price of the collateral — it will go red on a day nobody changed any code,
  and the team will learn to ignore it.
- **Commit the RPC cache** (`~/.foundry/cache/rpc`) or cache it in CI. Pinned + cached
  means deterministic, offline-capable, and fast; pinned alone still fails when the RPC
  provider rate-limits.
- **RPC URL from an env var / CI secret**, never hardcoded.
- **Two pinned blocks, not one:** one at a calm price, one at a volatile or sharply
  different price. A single pinned block tests one price; liquidation logic is exactly
  the code whose behaviour is supposed to depend on price.
- **Separate CI job** from unit tests, so a provider outage does not block unrelated
  merges — but a *required* job, not an optional one.

### What makes surface 3 meaningful

One end-to-end liquidation executed on the fork against the real feed and the real
token: position opened, price moved (via the second pinned block, or `vm.mockCall` on
the real feed), liquidation called, and assertions on **collateral actually seized**
computed from the price read live from the real aggregator at its real `decimals()`,
with balances measured as deltas on both sides. Plus the staleness and
zero/negative-answer cases asserted as reverts.

---

## Summary of what I would require before sign-off

1. **Read whether `1e18 - reserveFactorWad` is `unchecked`.** Drain vs. freeze. Do this
   first; it may end the review.
2. **Cap the setter**, with boundary tests at exactly `MAX` and `MAX + 1`, plus named
   tests at `0`, `1`, `1e18 - 1`, `1e18`, `1e18 + 1`, `type(uint256).max`. Fuzz the raw
   setter input unbounded, ≥10,000 runs. Resolve the rounding-to-zero DoS region —
   which, for a 6-decimal asset, covers all realistic redemption sizes at high reserve
   factors.
3. **Replace the single-repayment example** with a loop asserting `drift == Σ cut_i` in
   closed form plus strict monotonicity, a two-depositor test quantifying who is
   short-changed and how much is permanently stranded, and an invariant suite on the
   solvency identity — with handler call-count evidence proving `repay` and interleaved
   `redeem` were actually reached.
4. **Fork tests at two pinned blocks** against the real aggregator and real collateral
   token, with address self-checks in `setUp`, live `decimals()`, staleness and
   zero/negative-answer cases via `vm.mockCall` on the real address, balance-delta
   assertions, whale-prank funding, cached RPC, and a required CI job.

Surfaces 1 and 2 are potential loss-of-funds findings, not test-coverage gaps — I would
expect at least one of them to change the contract, not just the test suite. Sign-off
after the fixes, not after the tests go green.

# Review: credit pool test plan — sign-off assessment

**Verdict: no. Do not sign off.**

"Green suite, 100% line coverage, local mocks, one operation per test" describes a
suite that proves the code *runs*. Every question you actually need answered before
deployment is about values the suite never supplied (surface 1), sequences it never
executed (surface 2), and counterparties it never called (surface 3). Line coverage
is blind to all three: a single test that calls `setReserveFactorWad(0.2e18)` marks
the setter fully covered while leaving its entire dangerous input range unexplored.

Two of the three surfaces below look like live implementation bugs, not merely test
gaps. The tests I'm asking for are the evidence that decides that — and for surfaces
1 and 2 I expect them to fail against the current code, which means the fix is a code
change, not a test addition.

The three surfaces are independent; the work can be done in parallel.

---

## Surface 1 — `reserveFactorWad` is an unbounded `uint256`

### What's missing

The two covered values (0 and 0.2e18) are interior points. Every failure lives at the
boundary, and the setter has no boundary. Enumerate what the arithmetic does across
the full input domain of `net = assets * (1e18 - reserveFactorWad) / 1e18`:

| `reserveFactorWad` | Behaviour |
|---|---|
| `0` | covered; `net == assets` |
| `0.2e18` | covered |
| `1` | `net == assets - dust`; smallest nonzero fee, checks the rounding direction |
| `1e18 - 1` | `net = assets / 1e18`. **Any redemption below one whole 18-decimal unit reverts.** For a 6-decimal asset like USDC, the minimum redeemable amount is 1e18 base units = 1e12 USDC — the pool is bricked in practice. |
| `1e18` | `net == 0` for every input. **Every redemption reverts, permanently, for everyone.** Not a griefing edge case — a total loss-of-funds bricking reachable by one governance call. |
| `> 1e18` | `1e18 - reserveFactorWad` underflows and reverts under 0.8.x checked arithmetic. Same bricking, different revert site — and it reverts in `redeem`, not in the setter, so governance gets no feedback that it just disabled the pool. |
| `type(uint256).max` | same as above; the extreme of the fat-fingered-input class (typing `20` for "20%", or `2e18`) |

The second axis matters as much as the first: `net == 0` is not a property of
`reserveFactorWad` alone, it's a property of the *pair* `(assets, reserveFactorWad)`.
`net == 0` exactly when `assets * (1e18 - rf) < 1e18`, i.e. whenever
`assets < ceil(1e18 / (1e18 - rf))`. So for every admissible `rf` there is a dust
threshold below which redemption reverts. Whether that threshold is acceptable
depends on the asset's decimals, which the current test plan never varies.

### Required experiment

A 2-D bounded fuzz over the whole domain, plus explicit boundary unit tests. The fuzz
asserts the disjunction "either the setter rejects the value, or redemption of a
sane amount succeeds" — that phrasing is what makes it meaningful, because it holds
regardless of which fix you choose:

```solidity
function testFuzz_ReserveFactorNeverBricksRedemption(uint256 rf, uint256 assets) public {
    assets = bound(assets, 1, 1e30);                       // 1 wei .. 1e12 tokens
    // rf deliberately NOT bounded: the full uint256 domain is the point

    vm.prank(governance);
    try pool.setReserveFactorWad(rf) {
        // Setter accepted => redemption of any nonzero balance must work.
        _depositAndMint(alice, assets);
        vm.prank(alice);
        uint256 net = pool.redeem(pool.balanceOf(alice));
        assertGt(net, 0, "accepted reserve factor produced zero-value redemption");
        assertLe(net, assets, "redemption returned more than deposited");
    } catch {
        assertGe(rf, MAX_RESERVE_FACTOR, "setter rejected a legitimate value");
    }
}

function test_RevertWhen_ReserveFactorIsOneWad() public { /* rf = 1e18 */ }
function test_RevertWhen_ReserveFactorExceedsOneWad() public { /* rf = 1e18 + 1, type(uint256).max */ }
function test_ReserveFactorMaxMinusOne() public { /* rf = MAX - 1 still redeems dust */ }
```

Run it at `--fuzz-runs 10000`; log the failing `(assets, rf)` counterexamples and
keep each one as a pinned regression test (Foundry's failure cache does this, but
pin them explicitly so they survive a cache clear).

### Evidence that would make it meaningful

Not "the fuzz test passes." What I want in the sign-off packet:

1. A **stated invariant with a bound in the code**: `require(rf < MAX_RESERVE_FACTOR)`
   in the setter, where `MAX_RESERVE_FACTOR` is a policy number (e.g. `0.5e18`), not
   `1e18`. `rf < 1e18` alone is necessary but not sufficient — it still admits
   `1e18 - 1`, which is economic confiscation and a de facto brick.
2. The **dust threshold computed and accepted in writing** for the deployed asset's
   decimals: at `MAX_RESERVE_FACTOR`, the smallest redeemable amount is
   `ceil(1e18 / (1e18 - MAX_RESERVE_FACTOR))` base units. Someone has to say that
   number is fine for a 6-decimal asset.
3. Evidence the **rounding direction favours the pool, not the redeemer** — a fuzz
   assertion that `net + retained == assets` with `retained >= expectedFee`, so the
   truncation can never be farmed by repeatedly redeeming dust amounts.
4. Operational: the setter **emits an event with old and new value**, is behind the
   timelock, and there's a test that an in-flight redemption cannot be front-run by a
   factor change (or an accepted note that it can).

---

## Surface 2 — "one deposit, one repayment, observe a mismatch, conclude it accumulates"

### What's wrong with the argument

The single observation is real and it is a bug signal, but it is not evidence for the
claim being made. One sample cannot distinguish between:

- a **constant one-time offset** (e.g. a seeding amount, or an off-by-one at
  initialisation) — annoying, bounded, arguably tolerable;
- a **per-operation drift** that grows without bound with usage — insolvency; and
- an **error in the test's expected value**, where the implementation is right and
  the assertion is wrong.

All three produce exactly the same output on one deposit and one repayment. The plan
asserts the second and has evidence only for "one of these three." Calling one data
point proof of a trend is the specific reasoning error here; you need at minimum two
points to see a slope and a random-sequence search to see that nothing else cancels it.

Note the direction, because it determines severity: the cut stays in the pool (real
balance goes *up*) while `accountedAssets` is decremented by the *gross* repayment
(bookkeeping goes *down* by more than it should). So `accountedAssets` under-counts
assets the pool actually holds. Per repayment the pool's real balance exceeds its
accounting by the cut. Whether that strands the reserve permanently or lets share
price be gamed depends on which of the two numbers prices shares — that must be
stated explicitly in the write-up, with a test for each direction.

### Required experiments — three, not one

**(a) A parametric repetition test that measures the slope.** This is what actually
demonstrates accumulation:

```solidity
function testFuzz_MismatchGrowsLinearlyWithRepayments(uint8 n) public {
    n = uint8(bound(n, 1, 50));
    _deposit(alice, 1_000_000e18);
    _borrow(bob, 500_000e18);

    uint256 drift1 = _driftAfterRepayments(1);
    uint256 driftN = _driftAfterRepayments(n);

    // A constant offset would give driftN == drift1. Accumulation gives a slope.
    assertEq(driftN, drift1 * n, "drift is not linear in repayment count");
    assertGt(driftN, drift1, "drift does not accumulate");
}

function _drift() internal view returns (uint256) {
    return asset.balanceOf(address(pool)) - pool.accountedAssets();
}
```

The meaningful evidence is the **equality against the closed-form prediction**
(`n * cut`), not merely `driftN > drift1`. Predicting the magnitude before running
it, and matching, is what turns "we saw a mismatch" into "we understand the mismatch."

**(b) A stateful invariant test** — this is the one that catches what you didn't think
to enumerate. The pool is exactly the profile the invariant tooling exists for:
multiple functions mutating shared state over time.

```solidity
contract PoolInvariantTest is Test {
    function setUp() public { /* ... */ targetContract(address(handler)); }

    // Solvency: accounting must never claim more than the pool holds.
    function invariant_AccountedNeverExceedsBalance() public view {
        assertLe(pool.accountedAssets(), asset.balanceOf(address(pool)));
    }

    // Conservation: every wei of the gap must be explained by tracked reserves.
    function invariant_GapIsExactlyTrackedReserves() public view {
        assertEq(
            asset.balanceOf(address(pool)) - pool.accountedAssets(),
            pool.protocolReserves(),          // <- does this variable even exist?
            "unexplained assets in pool"
        );
    }

    // Every depositor can still exit.
    function invariant_AllDepositorsCanRedeem() public { /* loop handler actors, redeem */ }
}
```

Handler: `deposit / borrow / repay / redeem / accrue / setReserveFactorWad`, actors
bounded, `runs = 512`, `depth = 50`, `fail_on_revert = false` with the reverts
inspected. The second invariant is the decisive one: if there is no variable that
explains the gap, the accounting model itself is incomplete and the fix is to track
the protocol cut in a dedicated `protocolReserves` and decrement `accountedAssets` by
the **net** repayment — not to loosen the assertion.

**(c) A consequence test that prices the bug.** Invariants tell you a property broke;
this tells the deployment committee what it costs. Two concrete scenarios:

- *Stranded reserves*: N repayments, then every depositor redeems in full and
  governance withdraws reserves. Assert the residual balance is zero. If it isn't,
  that amount is permanently locked — report the figure.
- *Share-price exploit*: if share price derives from `accountedAssets`, a depositor
  who enters before a large repayment and exits after should not extract more than
  their pro-rata share. Assert `redeemed <= deposited + fairYield`. If it fails, you
  have last-depositor-loses, i.e. the pool is insolvent by construction — blocking.

### Evidence that would make it meaningful

The slope matching a pre-stated closed form; the conservation invariant passing after
the fix with `protocolReserves` explaining the gap exactly; and a written statement of
which scenario in (c) held, with the residual amount in tokens, for the record.

---

## Surface 3 — Chainlink feed and collateral token exist only as well-behaved mocks

### What's missing

A standard-behaviour mock tests your code against your assumptions about the
counterparty, which is precisely the thing under question. Production addresses being
"known" but never called means the integration has zero coverage at the only level
that counts. The concrete assumptions an obliging mock silently validates:

**Chainlink `latestRoundData`:**
- `decimals()` — feed-dependent (8 for most USD pairs, 18 for ETH pairs). A mock at
  the wrong decimals makes a scaling bug invisible; on mainnet it is a 1e10 pricing
  error.
- `answer` is `int256` and **can be zero or negative**. Does the pool cast to
  `uint256` unchecked? That's a free liquidation of every position.
- `updatedAt` — is staleness checked against the feed's actual heartbeat? Mocks
  return `block.timestamp` forever, so a missing staleness check cannot fail.
- `roundId` / `answeredInRound` — incomplete-round handling.
- Aggregator `minAnswer`/`maxAnswer` clamping: during a real crash the feed reports
  the floor, not the market. Liquidation logic that assumes an unclamped price is
  wrong in exactly the conditions it exists for.
- Proxy vs. aggregator: the pool must read the **proxy**, so an aggregator upgrade
  doesn't strand it.

**Collateral token:** non-standard `transfer` with no return value (USDT-class),
fee-on-transfer, blocklists, pausability, non-18 decimals, rebasing. Each one breaks
a different line of liquidation and none appear in a standard mock. The pool should
be using `SafeERC20`; the fork test is what proves it.

### Required experiment

Fork tests **pinned to a block number**, against the real deployed addresses. Pinning
is the reproducibility requirement — an unpinned fork gives you a test whose result
changes with the tip of the chain, which is not a test.

```solidity
contract LiquidationForkTest is Test {
    address constant FEED      = 0x...; // production proxy, verified against the
    address constant COLLATERAL= 0x...; // official Chainlink / token docs, not copied
    uint256 constant FORK_BLOCK = 21_000_000;

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
        pool = new CreditPool(FEED, COLLATERAL);
    }

    function test_LiquidationAgainstRealFeedAndToken() public {
        // decimals read from chain, not assumed
        assertEq(AggregatorV3Interface(FEED).decimals(), pool.feedDecimals());
        _seedCollateral(bob, 10e18);           // whale prank or stdstore, see below
        _openUnderwaterPosition(bob);
        vm.prank(liquidator);
        pool.liquidate(bob);
        assertGt(IERC20(COLLATERAL).balanceOf(liquidator), 0);
    }
}
```

Then layer adversarial values **on top of the real fork** — real wiring, hostile
inputs — which is the combination mocks can't give you and a plain fork won't produce
on its own:

```solidity
function test_RevertWhen_FeedReturnsNegativePrice() public {
    vm.mockCall(FEED, abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
        abi.encode(uint80(1), int256(-1), block.timestamp, block.timestamp, uint80(1)));
    vm.expectRevert(CreditPool.InvalidPrice.selector);
    pool.liquidate(bob);
}
function test_RevertWhen_FeedIsStale() public { /* updatedAt = block.timestamp - 2 days */ }
function test_RevertWhen_FeedReturnsZero() public { /* answer = 0 */ }
```

Plus **historical-stress forks**: pin a second and third block at dates when this
specific feed was stale, clamped, or moved violently (March 2023 depeg, May 2021
crash, whichever applies to the pair), and run the same liquidation path there. Real
adverse state beats synthetic adverse state.

Two practical notes. `deal()` silently fails or corrupts state on tokens with proxy
or non-standard balance storage — verify the balance after `deal`, and fall back to
`vm.prank` on a funded holder at the pinned block. And verify the two addresses
against the official Chainlink feed registry and the token issuer's own
documentation; an address that has only ever been read off a mock or a config file is
unverified.

### Reproducibility requirements

```toml
# foundry.toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
[profile.default]
fuzz = { runs = 10_000 }
invariant = { runs = 512, depth = 50 }
```

Block numbers as named constants in the test; RPC URL from env with the key in CI
secrets; fork cache committed to CI so runs are deterministic and cheap; fork tests
in a separate profile (`forge test --match-path 'test/fork/*'`) so a missing RPC key
fails loudly rather than skipping silently. A fork suite that quietly no-ops when the
key is absent is worse than none — it reports green.

---

## Sign-off conditions

| # | Blocking requirement |
|---|---|
| 1 | Setter bounded by an explicit `MAX_RESERVE_FACTOR < 1e18`; full-domain fuzz at 10k runs; `1e18`, `1e18+1`, `1e18-1`, `type(uint256).max` as named unit tests; dust threshold computed for the deployed asset's decimals and accepted in writing |
| 2 | Accumulation demonstrated (or refuted) by a slope test matching a pre-stated closed form; conservation invariant passing with the gap fully explained by a tracked reserves variable; stranded-value / share-price consequence quantified in tokens |
| 3 | Pinned-block fork tests against the real feed proxy and real collateral token; feed decimals read from chain; negative / zero / stale / clamped price paths asserted via `vm.mockCall` over the fork; at least one historical-stress block; RPC wired in CI such that absence fails the build |

Also before deploy, from the standard checklist: `forge snapshot` for gas regressions,
`slither .` with no unaddressed high/medium findings, and `expectEmit` coverage on the
governance setter and liquidation events.

Surfaces 1 and 2 will, I expect, require contract changes rather than test changes.
Approving the test plan does not make those go away — it just means you'd be shipping
without the evidence that would have found them.

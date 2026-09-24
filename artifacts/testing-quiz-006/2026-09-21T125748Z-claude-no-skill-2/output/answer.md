# Review: test plan for the onchain credit pool

## Verdict

**No — not enough to sign off.** All three surfaces have a blocking gap, and they
fail in the same way: the suite demonstrates that the code *can* behave correctly
on one chosen input, not that it *cannot* behave incorrectly on the inputs it will
actually see.

Full line coverage is the weakest useful coverage metric here. It says every
statement executed at least once. It says nothing about (a) the input ranges over
which a statement is safe, (b) whether an effect that is harmless once is harmless
repeated, or (c) whether the counterparties the statement talks to behave the way
the mock does. Those are exactly the three surfaces in question.

Below, per surface: what is missing, the specific experiment I would require, and
what result makes that experiment meaningful evidence rather than decoration.

---

## Surface 1 — `reserveFactorWad` is an unbounded governance input

### What the current tests establish

Two points, `0` and `0.2e18`, both interior to the intended domain. They establish
that the happy path scales correctly. They establish nothing about the domain
boundary, because neither point is near it.

### Why that is not enough

The setter accepts any `uint256`, but the redemption math is only meaningful on
`[0, 1e18]`. The interesting behaviour is entirely at and beyond the edges:

| `reserveFactorWad` | `1e18 - reserveFactorWad` | Redemption behaviour |
|---|---|---|
| `0` | `1e18` | net == assets (covered) |
| `1` | `1e18 - 1` | net == assets for all but dust; rounding floor bites first |
| `1e18 - 1` | `1` | `net = assets / 1e18`; **every redemption below 1e18 assets reverts** |
| `1e18` | `0` | `net == 0` always; **every redemption reverts, for every holder, permanently** |
| `1e18 + 1` | underflow | Solidity ≥0.8 **panics (0x11)**; every redemption reverts and the revert is not the intended `net == 0` error |
| `type(uint256).max` | underflow | same panic |

The last two rows are the sign-off blocker. A single fat-fingered or malicious
governance call — `1e18 + 1` instead of `0.1e18` — bricks redemptions for the whole
pool. Whether it is recoverable depends on whether the setter itself still works
(it does) and on whether governance can act fast enough; either way it is a total
withdrawal halt, not a degraded fee. `1e18` exactly is the same outcome through a
different code path, which matters because a fix that only adds `require(x < 1e18)`
versus `require(x <= 1e18)` gives materially different behaviour and the tests must
pin which one is intended.

There is a second, quieter boundary independent of governance: **the floor in the
numerator**. `net == 0` is reachable with a perfectly reasonable reserve factor
whenever `assets * (1e18 - reserveFactorWad) < 1e18`. With
`reserveFactorWad = 0.999e18` that is every redemption under 1000 wei of assets.
The revert-on-zero is presumably intended as a griefing guard, but it also means
small holders are silently locked out at high reserve factors. That interaction —
governance value × redemption size — is a two-dimensional space and two single
points sample it at zero resolution.

A third, lower-priority case: `assets * (1e18 - reserveFactorWad)` overflows when
`assets > ~1.16e59`. Not reachable for a real ERC-20 supply, but it should be an
explicit bound in the fuzz harness rather than an unexamined assumption, and if the
pool ever onboards a token with an absurd supply and 18 decimals the bound is what
tells you.

### Experiment I would require

1. **Bound the setter, then prove the bound.** Add an explicit cap and write the
   negative tests against it: `setReserveFactor(1e18 + 1)` reverts,
   `type(uint256).max` reverts, the exact boundary value (`1e18`, or a tighter
   policy cap such as `0.5e18`) behaves as the spec says at the boundary and one
   wei either side of it. Three tests, one per side plus the boundary itself.
2. **Fuzz the two-dimensional space.** A stateless fuzz test over
   `(reserveFactorWad, assets)`, with `reserveFactorWad` bounded to the *post-fix*
   admissible range and `assets` bounded to a realistic supply, asserting the
   post-conditions: the call either reverts with the one expected error or returns
   `net <= assets`, never panics, and never returns more than `assets`.
3. **Test the setter as a privileged operation, not just as math.** Non-governance
   caller reverts; the event is emitted with the new value; a value set while a
   redemption is mid-flight (if any multi-step flow exists) cannot be used to
   change the rate applied to an already-quoted redemption.

### What makes the evidence meaningful

The fuzz run alone is not evidence — a fuzzer bounded to a safe range will always
be green and proves nothing. The meaningful artifact is the **before/after pair**:

- Run the boundary tests against the *current* implementation and show
  `setReserveFactor(1e18 + 1)` succeeding and the subsequent redemption panicking
  with `0x11`. That is the bug, reproduced.
- Add the cap, re-run, show the setter now reverts and the panic is unreachable.
- Commit the specific failing inputs (`1e18`, `1e18 + 1`, `type(uint256).max`, and
  the smallest `assets` that floors to zero at the maximum permitted reserve
  factor) as a **seed corpus / explicit unit cases**, not as fuzz inputs. Fuzzers
  find boundaries unreliably and non-reproducibly; once found, a boundary belongs
  in a named deterministic test that fails loudly if someone widens the cap later.

One further check worth the five minutes: run the arithmetic through a symbolic
checker (Halmos, or Certora if the project already has it) asserting
`net <= assets` and no panic for all `reserveFactorWad` the setter admits. That
converts "we sampled a lot of points" into "no point exists," which is the actual
claim you want to sign off on.

---

## Surface 2 — the accumulation claim is not demonstrated

### What the test actually shows

One deposit, one repayment, a mismatch observed. That is a proof that
`drift(1) != 0`. The plan calls it proof that the mismatch *accumulates*. Those are
different propositions and the test cannot distinguish them.

A single observation at n = 1 is consistent with at least three very different
systems:

- **Accumulating**: `drift(n) = n × cut`, grows without bound, eventually the
  pool's internal accounting and its real balance diverge enough to matter.
- **One-shot**: an initialisation or first-repayment artifact, `drift(n) = cut` for
  all n, harmless and constant.
- **Self-correcting**: drift appears on repayment and is reconciled by the next
  interest accrual, redemption, or reserve sweep, so `drift` is transient and
  `drift` measured after a full cycle is zero.

Nothing in a one-operation test discriminates between these, so the plan's
conclusion is unsupported by its own evidence — regardless of whether the
conclusion happens to be true.

Note also the sign and direction matter, and the description implies the dangerous
direction. The protocol cut stays *in the pool* while `accountedAssets` is reduced
by the *gross* repayment. So real balance ≥ accounted — the pool believes it holds
less than it does. That is the safer of the two directions (the opposite would mean
the last redeemer's withdrawal reverts on insufficient balance), but "safer" is not
"correct": it means the cut is stranded, unattributed to either LPs or the
treasury, and not withdrawable by whatever reserve-sweep path exists — or, if the
sweep computes claimable reserves from `accountedAssets`, double-counted. Which of
those it is, is the thing the test must determine.

### Experiment I would require

1. **A parametric accumulation test.** Same setup, then N repayments in a loop for
   N ∈ {1, 2, 10, 100}, recording `drift(N) = token.balanceOf(pool) - accountedAssets`
   at each step. Assert the *shape*, not just non-zero-ness:
   `drift(N) == sum of per-repayment cuts` exactly, and `drift` is non-decreasing
   across the sequence. This is the single test that would actually license the
   plan's claim.
2. **A full-cycle test that rules out self-correction.** Deposit → borrow → repay
   → accrue → redeem-everything, ending with every LP exiting and the loan closed.
   Then check the terminal state: is the residual balance exactly the sum of
   retained cuts, is it claimable by the treasury path, and does the final
   redemption succeed? If the last LP out cannot withdraw, or if the treasury sweep
   reverts or over-pays, the drift is not benign and this test is where it shows.
3. **A stateful invariant test** (Foundry invariant mode with a handler contract),
   which is what this surface is really asking for. The handler exposes bounded
   `deposit / borrow / repay / redeem / setReserveFactor` actions over a small set
   of actors; the fuzzer sequences them randomly. Maintain a ghost variable
   `ghost_totalRetained` incremented by each repayment's cut, and assert as
   invariants:
   - `accountedAssets + ghost_totalRetained == token.balanceOf(pool)` — the exact
     reconciliation. If this holds, the drift is fully explained by retained cuts
     and nothing else, which is the strong result.
   - `accountedAssets <= token.balanceOf(pool)` — the weaker solvency floor, which
     must never break.
   - `accountedAssets` never underflows when reduced by a gross repayment that
     exceeds what was ever accounted (a repayment larger than principal, or a
     repayment after a partial writedown).

   Run with enough runs × depth to reach sequences of 50+ operations; the default
   depth of 15 will not exercise the interleavings that matter.

### What makes the evidence meaningful

- **The equality invariant passing is the real evidence**, not the inequality. If
  you only assert `accounted <= balance`, the test passes both when the accounting
  is correct-but-conservative and when it is badly wrong in the safe direction. The
  ghost-variable equality says: the entire discrepancy is the retained cut and
  nothing else is leaking.
- **The invariant must be shown to be load-bearing.** Before trusting it, break the
  code on purpose — change the retained cut, or reduce `accountedAssets` by net
  instead of gross — and confirm the invariant test goes red. An invariant that
  stays green under an injected bug is measuring nothing. This is the cheap version
  of mutation testing and it is the step most often skipped.
- **A monotonic drift series over N** is what converts "a mismatch exists" into
  "the mismatch accumulates." Report the actual numbers (drift at N = 1, 2, 10,
  100) in the sign-off, so the reviewer can see linear growth rather than take the
  word "accumulates" on trust.
- If the intended design *is* that the cut is retained and `accountedAssets`
  excludes it, then the fix is to the test plan and the docs, not the contract —
  but that decision has to be made explicitly and encoded as the equality
  invariant, not left as an unexplained delta that a future reader will "fix."

---

## Surface 3 — production integrations have never been executed

### What standard-behaviour mocks establish

That the contract works against an idealised Chainlink aggregator and an idealised
ERC-20. Both idealisations are known to be false for large classes of real
deployments, and the failure mode is that the mock encodes the same assumption the
contract makes, so the test can only ever confirm the assumption to itself. This is
the surface where "covers every line" is most misleading: the liquidation path is
100% covered and 0% exercised.

"The production addresses are known, but no test has called them" is, on its own,
sufficient grounds to withhold sign-off for a liquidation path.

### Chainlink feed — what the mock almost certainly does not reproduce

- **`decimals()`**. Feeds are 8 decimals for most USD pairs, 18 for most ETH pairs.
  If the mock returns the decimals the code assumes rather than the decimals the
  real feed returns, a 10-order-of-magnitude scaling error is invisible in testing
  and catastrophic on the first liquidation.
- **Staleness**. Real feeds update on a heartbeat plus a deviation threshold. Does
  the code check `updatedAt` against a bound, and is that bound actually shorter
  than the feed's published heartbeat for this specific pair? A mock returning
  `block.timestamp` can never fail this.
- **Round completeness / bad answers**. `answer <= 0` (the return is `int256` for a
  reason), an incomplete round, `answeredInRound < roundId`. A standard mock
  returns a fresh positive answer every time.
- **Circuit breaker bounds.** Aggregators clamp to `minAnswer`/`maxAnswer`. During
  an extreme move the feed reports the clamp, not the market — the LUNA-era failure
  mode. A mock never returns a clamped price.
- **L2 sequencer uptime**, if this deploys to an L2: prices are stale-by-design
  after a sequencer restart and a grace period check is required.
- **Deprecated interface**: `latestAnswer` vs `latestRoundData`. Only the latter
  gives you the metadata needed for any of the above.

### Collateral token — what the mock almost certainly does not reproduce

- **Non-standard return data**: USDT and others return no `bool`. A bare
  `transfer` call against them reverts on decode; the mock returns a clean `true`.
  This is a `SafeERC20` question and mocks systematically hide it.
- **Silent failure**: tokens that return `false` instead of reverting.
- **Fee-on-transfer / rebasing**: the amount received ≠ the amount sent. Any code
  that credits the requested amount rather than the measured balance delta is wrong
  for these and correct for the mock.
- **Blocklists and pausing** (USDC, USDT): a liquidation transfer to or from a
  blocked address reverts. Is that handled, or does it wedge the liquidation queue?
- **`decimals() != 18`**, which compounds with the feed-decimals question above.
- **Proxy upgradability**: the deployed token's behaviour can change after audit.
  Worth recording in the risk register even though no test can cover it.

### Experiment I would require

**Fork tests, pinned, in CI.** Specifically:

1. `forge test --fork-url $RPC --fork-block-number <PINNED>`. The pinned block is
   the reproducibility requirement and it is non-negotiable — an unpinned fork test
   is a test whose result changes with the price of the asset, which means a red CI
   run tells you nothing about your diff. Pin it, commit the number, and bump it
   deliberately.
2. **Cache the RPC responses** (Foundry's `~/.foundry/cache`, committed or restored
   in CI) so the suite is hermetic and does not fail when the RPC provider rate
   limits. Otherwise the tests will be disabled within a month, which is the usual
   fate of fork suites.
3. **An address-and-config assertion test** that runs on the fork and checks the
   deployment constants themselves: each address has non-zero code; the feed's
   `description()` matches the expected pair string; the feed's `decimals()` equals
   the value the contract scales by; the token's `symbol()` and `decimals()` match
   what is configured. This catches the single most common production incident in
   this category — a correct contract wired to the wrong address — and no mock can
   ever catch it.
4. **A real end-to-end liquidation on the fork**: fund a position with the actual
   deployed collateral token, read the actual feed, execute the liquidation,
   assert on **measured balance deltas** (`balanceAfter - balanceBefore`) rather
   than on the amounts passed in. Measuring deltas is what makes the test sensitive
   to fee-on-transfer behaviour instead of blind to it.
   - Obtain the token balance with `deal`, but **verify `deal` actually worked**
     for this specific token (assert the balance after), and for tokens with
     internal accounting or proxied storage, fall back to `vm.prank`-ing a known
     whale. A `deal` that silently writes the wrong storage slot produces a test
     that passes against a balance the token itself does not recognise.
5. **Adversarial feed tests driven by real data.** Fork tests exercise the happy
   path at the pinned block; they cannot produce a stale or negative price. So
   *additionally* keep mocks — but rewrite them to reproduce real behaviour:
   a price older than the heartbeat, `answer == 0`, `answer < 0`, an incomplete
   round, a clamped min/max answer, and (on L2) a sequencer-down state. Assert the
   liquidation reverts with a specific error in each case rather than proceeding on
   a bad price. Derive the mock's parameters — heartbeat, decimals, min/max — from
   values read off the real feed on the fork, so the two layers stay consistent.
6. **A historical-volatility replay**, if liquidation correctness depends on price
   path: run the liquidation at several pinned blocks spanning a known sharp move
   for this pair, and confirm the health-factor and seize-amount calculations hold
   at each. This is the cheapest way to find scaling errors that only show up at
   unusual magnitudes.

### What makes the evidence meaningful

- **Fork tests must be in CI, not run once by hand.** A fork test executed
  manually before deployment and never again is documentation, not a regression
  guard. If the CI cost is a concern, run the fork suite on a nightly and on
  release branches rather than dropping it.
- **The decimals assertion is the highest-value single line in this section.** It
  is one call against the real feed and it converts the most dangerous silent
  assumption in the file into a compile-time-ish fact.
- **Balance-delta assertions, not amount assertions.** This is the difference
  between a test that would catch a fee-on-transfer collateral and one that would
  not, and it costs nothing.
- **A negative control.** Point the config test at a deliberately wrong address
  and confirm it fails. Same principle as the invariant in surface 2: an
  integration test that has never been shown to go red has not been shown to test
  anything.

---

## What sign-off should be gated on

Blocking, in priority order:

1. A cap on `reserveFactorWad` with explicit tests at `1e18` and `1e18 + 1`,
   demonstrated to fail before the cap and pass after. A governance typo currently
   halts all redemptions.
2. A pinned fork test that executes a liquidation against the real feed and the
   real token, plus the address/decimals config assertions. The liquidation path
   has never touched its production counterparties.
3. A stateful invariant test with the ghost-variable reconciliation
   (`accountedAssets + totalRetained == balance`), shown to go red under an
   injected accounting bug — and the N-repayment drift series that actually
   substantiates the accumulation claim.

Non-blocking but I would want them scheduled:

- Mutation testing over the accounting and liquidation modules, to replace line
  coverage with a metric that means something. The three "show it goes red" steps
  above are hand-rolled instances of this; a tool does it systematically.
- Symbolic verification of the redemption arithmetic over the full admissible
  input range.
- A risk-register entry for the collateral token's upgradability and for the feed's
  circuit-breaker bounds, neither of which is testable but both of which are real.

The underlying correction to the plan: **replace "every line is covered" with
"every stated property has a test that has been observed to fail when the property
is violated."** All three surfaces are the same omission in different clothes.

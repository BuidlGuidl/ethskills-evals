# Review: is this test plan enough to sign off?

**No.** The suite is green and line-complete, but line coverage is a statement about
which statements executed, not about which *states* were reached. All three surfaces
fail for the same structural reason:

- Surface 1 is an **unbounded input** tested at two interior points. Two examples
  cannot say anything about a range of size 2^256.
- Surface 2 is a **claim about a sequence** supported by a single step. One
  observation cannot distinguish a one-off mismatch from an accumulating one.
- Surface 3 is an **external dependency** tested against mocks you wrote. A mock
  encodes your assumptions about the counterparty; passing against it confirms the
  code agrees with your assumptions, not with mainnet.

Below, per surface: the experiment I would require, and what makes its result
meaningful evidence rather than reassurance.

---

## 1. `reserveFactorWad` — unbounded governance input

### What the current tests establish

`f = 0` and `f = 0.2e18` are both in the interior of the "sane" region. They exercise
the happy path twice. They say nothing about the boundary or the region beyond it.

### The limit cases that matter

With `net = assets * (1e18 - f) / 1e18`, the interesting values are:

| `f` | Behaviour | Severity |
|---|---|---|
| `0` | `net == assets`. Covered. | — |
| `1` | `net == assets * (1e18-1) / 1e18`. Floor division: for `assets == 1`, `net == 0` → revert. The *smallest* nonzero factor already breaks dust redemptions. | rounding/DoS |
| `1e18 - 1` | `net == assets / 1e18`. Every redemption below `1e18` units reverts. For an 18-decimal asset that is everything under 1 whole token; for a 6-decimal asset (USDC) it is **every redemption that will ever occur**. | critical |
| `1e18` | `1e18 - f == 0`, so `net == 0` for *all* `assets`. Redemption is permanently bricked; no value of `assets` recovers it. | critical |
| `1e18 + 1` … `type(uint256).max` | `1e18 - f` underflows. Under Solidity ≥0.8 this is a `Panic(0x11)` revert on *every* redemption — the pool is bricked with a confusing error and no unwind path. If any part of this math sits in `unchecked`, it instead wraps to a colossal multiplier and the overflow/incorrect payout is far worse. | critical |
| `type(uint256).max` | As above; the natural fat-finger / uninitialised-calldata value. | critical |

There is also a **per-`f` rounding boundary** that is not a single number: for a given
`f`, the largest redemption that silently reverts is `assets < ceil(1e18 / (1e18 - f))`.
That threshold is a function of the governance value, so it cannot be covered by
picking example redemption amounts — it has to be derived in the test.

### Experiment I would require

1. **A bounded-invariant assertion on the setter**, expressed as a test that
   *currently fails*: `setReserveFactor(f)` must revert for all `f >= 1e18` (and
   realistically for all `f` above a much lower policy cap). A test that fails on
   today's code is the evidence; a test that passes on today's code for `f = 1e18` is
   proof the bug ships.
2. **A fuzz over the full domain**, not a hand-picked list: fuzz `f` over
   `[0, type(uint256).max]` and, for accepted values, fuzz `assets` too. Property:
   *if the setter accepts `f`, then no redemption reverts with an arithmetic panic,
   and `net <= assets`, and `net == 0` only when the caller redeemed below the
   documented dust threshold.* Force the fuzzer into the corners explicitly — most
   fuzzers will essentially never land on `1e18` by chance out of 2^256, so add
   `1e18 - 1`, `1e18`, `1e18 + 1`, `type(uint256).max` as fixed seed cases alongside
   the fuzz. Fuzzing without the seeded boundaries is theatre.
3. **A decimals-parameterised case.** Run the same property at 6, 8 and 18 decimals.
   The `1e18 - 1` row is a nuisance at 18 decimals and a total outage at 6; that
   difference only appears if decimals is a test parameter.

### What makes the evidence meaningful

- A counterexample with a concrete `(f, assets)` pair and the resulting revert
  selector — not "fuzz passed 256 runs".
- The fix asserted at the *setter*, so the invariant "`reserveFactorWad < 1e18`
  always" holds by construction, and a regression test that pins the rejected values.
- An explicit, documented, tested answer to "what is the minimum redeemable amount at
  the maximum allowed `f`?" — if that number is not stated somewhere, the dust-revert
  behaviour is undefined rather than intended.

---

## 2. Accounting drift on repayment — "the mismatch accumulates"

### Why the current evidence does not support the claim

One deposit + one repayment produces *one* mismatch. That is consistent with at least
three different stories:

- the drift accumulates with every repayment (the claim),
- the drift is a fixed one-time offset established at pool setup,
- the drift is real but reconciled by some other function (a sweep, an accrual, a
  `skim`, the next `deposit`) that the single-operation test never calls.

The plan asserts the first and tests none of them. The single-step observation is the
*motivation* for an experiment, not its result. Extrapolating a trend from one data
point is the specific error here.

### Experiment I would require

1. **A multi-round differential test.** Run `N` repayments (N ≈ 50–1000) with varying
   amounts and interleaved deposits/borrows. Track a ghost variable
   `expectedDrift = Σ protocolCut_i`. Assert at every step:
   `token.balanceOf(pool) - accountedAssets == expectedDrift`, and that
   `expectedDrift` is **strictly monotonically increasing** in N. Monotonic growth
   across many steps, matched term-for-term against the sum of retained cuts, is what
   "accumulates" actually means. A single-run chart with two points is not.
2. **A stateful invariant run**, which is the real instrument here. A handler exposing
   `deposit`, `withdraw`, `borrow`, `repay`, `redeem`, `liquidate`, plus any
   sweep/accrue entrypoint, driven with random actors, amounts and *orderings*, under
   the invariant:

   `accountedAssets + Σ retainedCuts == token.balanceOf(pool)`   (or whatever the
   intended conservation law is — write it down first).

   This is the only setup that can rule out story (3), because only a random ordering
   will try `repay → repay → sweep → repay` and discover whether reconciliation
   exists. Keep the handler's call ordering unconstrained; an invariant test that only
   replays the happy sequence has re-tested the example.
3. **Demonstrate the consequence, not just the delta.** A drift number is not yet a
   bug report. Drive it to a user-visible failure and pick which one it is:
   - *Over-redemption:* if `accountedAssets` understates the balance, does share
     pricing let depositors withdraw the protocol's cut? Write the test where the last
     redeemer drains reserves.
   - *Trapped value / insolvency:* or does it strand reserves so the final redeemer
     cannot exit? Write the test where the last redeemer's withdrawal reverts or
     under-pays.

   The meaningful evidence is a shrunk, minimal call sequence ending in a concrete
   dollar-denominated wrong outcome, replayable as a standalone unit test.

### What makes the evidence meaningful

- The conservation law is stated **before** the run, so the invariant can fail rather
  than be fitted to whatever the code does.
- A shrunk counterexample sequence, committed as a deterministic regression test with
  a fixed seed.
- Drift measured over many N with the closed-form `Σ cuts` as the expected value —
  linear growth matching the analytic sum, not just "the number got bigger".

---

## 3. Chainlink feed + collateral token — mocks standing in for production

### Why standard-behaviour mocks are the weakest evidence here

A "standard-behaviour" mock is a restatement of your own mental model of the
dependency. Testing against it can only confirm the code is self-consistent. Every
historical failure in this class came from the counterparty *not* behaving the way the
mock did. The production addresses are known and have never been called — that is a
gap that costs about an afternoon to close.

### Experiment I would require: pinned fork tests

Not "fork mainnet" — **fork at a fixed block**: `vm.createSelectFork(RPC_URL, BLOCK)`
(or `anvil --fork-url ... --fork-block-number ...`). Pinning is what makes it
reproducible and CI-stable; an unpinned fork test is a flaky test that also burns
archive-node quota. Pin *several* blocks: a calm one, a high-volatility one, and, if
one exists in the feed's history, a block where the feed was stale or the round data
was unusual.

**Chainlink feed — properties to assert against the real aggregator:**

- `decimals()` read from the live feed and compared to the constant the code assumes.
  8 vs 18 is the classic silent 10^10 mispricing and the mock almost certainly
  agrees with the code by construction.
- `latestRoundData` returns `int256`. Assert the code rejects `answer <= 0` rather
  than casting a negative into a huge `uint256`.
- **Staleness:** assert liquidation reverts when `block.timestamp - updatedAt` exceeds
  the feed's documented heartbeat. Test by warping past the pinned block's `updatedAt`.
- `answeredInRound`/`roundId` consistency, and the aggregator's `minAnswer`/`maxAnswer`
  circuit breakers — a price pinned at the floor during a crash is the scenario where
  liquidation both matters most and is most wrong.
- Feed identity: assert `description()` / `aggregator()` / the address itself against
  the expected pair, as a deployment-time check. Confirm the feed is the right pair,
  on the right chain id, and is actually live (`latestRoundData` doesn't revert).

**Collateral token — properties to assert against the real deployed token:**

- Does `transfer`/`transferFrom` **return a bool at all**? (USDT-style no-return
  tokens revert under a plain `IERC20` interface; this only appears against the real
  bytecode.) Confirm `SafeERC20`/equivalent is used.
- `decimals()` ≠ 18 — read it live and check the collateral valuation math.
- Fee-on-transfer / rebasing: assert on *balance delta measured before and after*,
  not on the amount argument.
- Pause / blocklist / upgradeable proxy: can the token freeze liquidation? At minimum,
  document the trust assumption after confirming it from the real contract.
- Approval semantics (non-zero → non-zero `approve` reverting on some tokens).

### What makes the evidence meaningful

- The test calls the **production addresses** at a **pinned block**, and the assertion
  is against values *read from the chain* (live `decimals()`, live `updatedAt`), not
  against constants copied into the test — copying the constant re-creates the mock.
- At least one test proves the *negative* path against reality: with a stale or
  non-positive answer, liquidation reverts. Passing fork tests that only show the
  happy path are the same weak evidence as the mocks, at higher cost.
- The fork tests run in CI as a separate, required job with a cached archive RPC, so
  the result is reproducible by anyone on the team from a single command.
- Keep the mocks. They stay useful for the adversarial cases you cannot conjure on a
  fork (arbitrary stale rounds, fee-on-transfer behaviour the real token doesn't have).
  The fork tests calibrate the mocks; the mocks explore. Neither substitutes for the
  other.

---

## Sign-off recommendation

Blocked until at least the following exist and are green (or, for surface 1 and 2,
are *red on current code* and green after the fix):

1. Setter rejects `f >= 1e18`, with `1e18 - 1`, `1e18`, `1e18 + 1`,
   `type(uint256).max` as pinned cases plus a full-domain fuzz, and the dust threshold
   at max allowed `f` documented and tested at the deployed token's decimals.
2. A stateful invariant run over an unconstrained handler with the conservation law
   written down in advance, plus a shrunk counterexample driving the drift to a
   concrete over-redemption or trapped-value outcome.
3. Fork tests at pinned blocks against the production feed and collateral token,
   asserting on chain-read values, including the stale-price and non-positive-answer
   reverts.

One general note on how to read the current suite: "every line covered" and "green"
were never evidence of correctness for any of these three surfaces, and the
single-repayment "proof" of accumulation is the clearest symptom — it is a hypothesis
that was recorded as a conclusion. Each item above replaces an example with a
property, or a mock with the real counterparty; those are the two moves this plan is
missing.

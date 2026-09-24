# Sign-off review: onchain credit pool test plan

**Verdict: not enough to sign off.**

A green suite at 100% line coverage records which lines executed, never whether any
assertion could have failed. Local mocks and one-operation examples can only confirm
the cases someone already thought of. Each of the three surfaces maps to a search
that this plan has not performed:

| Surface | Risk class | Required search | Currently |
|---|---|---|---|
| 1. `reserveFactorWad` | configurable value feeding value math | fuzz over the whole accepted domain + boundary classification | 2 hand-picked values |
| 2. repayment vs. `accountedAssets` | stateful accounting | handler-driven invariant tying accounting to custody | one-shot unit example |
| 3. Chainlink feed + collateral token | external integration | pinned fork against the real deployments | standard-behaviour mocks |

Inspection and a targeted regression test can *confirm* a defect you already suspect.
Neither replaces the search, and both stop at the first bug you happened to imagine.

---

## 1. `reserveFactorWad` — fuzz the domain, and classify the boundary properly

### Why the current tests prove nothing
`0` and `0.2e18` are two points hand-picked out of a `uint256` domain. They walk one
branch of `net = assets * (1e18 - reserveFactorWad) / 1e18`. The setter accepts *any*
`uint256`, so the accepted domain is far larger than the semantically valid one, and
the value that breaks the pool is precisely the one nobody proposed.

### The experiment I would require
A fuzz test over the full accepted domain of the setter, bounding with `bound()` and
not `vm.assume()` (`assume` discards runs and silently starves the run of the region
you care about; `bound` maps every draw into range):

```solidity
function testFuzz_redeemNetUnderAnyReserveFactor(uint256 rf, uint256 assets) public {
    rf     = bound(rf, 0, type(uint256).max);   // the domain the setter ACTUALLY accepts
    assets = bound(assets, 1, 1e30);
    // set, deposit, redeem; assert the property, not the arithmetic
}
```

Fuzz the setter's accepted domain, not the domain you wish it had. If `rf > 1e18`
reverts or underflows, the fuzzer must be the thing that tells you.

### Limit cases, stated precisely
Do not assume `1e18` is valid merely because only `> 1e18` violates the numeric
inequality `1e18 - rf >= 0`. Decide semantic usability first:

- **`rf = 0`** — nearest valid value at the lower boundary. `net == assets`. Valid.
- **`rf = 1e18 - 1`** — nearest valid value at the upper boundary. This is the
  largest factor that can leave a non-zero `net`, and only for large enough `assets`.
  Must be exercised as its own case.
- **`rf = 1e18`** — the exact limit. It does **not** underflow: `1e18 - 1e18 == 0`,
  so `net == 0` for *every* redemption and the pool is bricked — every redeem reverts
  on the `net == 0` check while the setter happily accepted the value. This is a live
  governance-bricking case, not a numeric edge, and it is why "the limit is valid
  because the subtraction doesn't underflow" is the wrong test.
- **`rf = 1e18 + 1`** — the first value beyond the limit, where representable. Under
  Solidity ≥0.8 this reverts with an arithmetic underflow panic *inside redemption*,
  not at the setter.

**Keep the evidence for `1e18` and `1e18 + 1` separate.** They fail through different
paths — a `net == 0` require versus an underflow panic — and collapsing them into one
"anything ≥ 1e18 reverts" assertion hides the fact that one is a permanent
denial-of-service reachable by a legitimate-looking governance call.

### Evidence that would make it meaningful
- A fuzz run over the unrestricted domain, with the counterexample the fuzzer found.
- Each of the four values above exercised and asserted separately, with the distinct
  revert reason / panic code pinned per case (`vm.expectRevert` with the specific
  selector or `stdError.arithmeticPanic`, never a bare `expectRevert()`).
- A small-`assets` case at high `rf` where rounding drives `net` to 0 even though
  `rf < 1e18` — dust redemptions bricking is a real user-facing failure.
- The fix I would expect this to force: bound `reserveFactorWad` **in the setter**
  (e.g. `require(rf < 1e18)` or a lower governance cap), then re-fuzz. Validation at
  the setter turns a redemption-time brick into a rejected transaction.

---

## 2. Repayment vs. `accountedAssets` — one mismatch is not accumulation

### Why the current plan proves less than it claims
One deposit, one repayment, one observed mismatch demonstrates **divergence**. It says
nothing about whether the gap grows. "The mismatch accumulates" is a strictly stronger
claim than "the mismatch exists," and the cited test cannot distinguish a one-time
setup offset from per-operation drift. A bug that compounds across a sequence is
invisible to any test that exercises one operation in isolation, no matter how many
such tests exist.

### What would actually demonstrate accumulation
Either of these, and I would want both:

**(a) A minimal sequence with at least two drift-creating operations.** Not setup
followed by one repayment — **two or more repayments**, each retaining a protocol cut,
with the gap `poolBalance - accountedAssets` snapshotted after each:

```
gap_after_repay_1 == cut_1
gap_after_repay_2 == cut_1 + cut_2        // strictly greater than gap_1
```

Asserting `gap_2 > gap_1` and that `gap_n` tracks the running sum of retained cuts is
what turns "there is a mismatch" into "the mismatch accumulates per repayment."

**(b) A handler-driven invariant, which is the search proper.** This is the piece the
plan is missing; (a) is a regression test written after the fact.

```solidity
// Handler owns setup: funded, approved actors; inputs bounded to valid ranges;
// several actors, because the property is about their interaction.
function invariant_accountingMatchesCustody() public {
    assertEq(asset.balanceOf(address(pool)), pool.accountedAssets() + pool.retainedReserves());
}
```

### Shape of the assertion matters
A one-sided bound is not good enough here. `accountedAssets <= balanceOf(pool)` fires
on a shortfall and stays **green through exactly this bug**, because retaining a
protocol cut leaves a *surplus*. Value stranded in the pool is as much a defect as
value lost, so the property must be an **equality** — custody equals accounted assets
plus an explicitly tracked reserves bucket — or an explicit no-drift check against a
tracked expected surplus. If the implementation has no such bucket, the invariant
cannot be written as an equality, and that is itself the finding.

### Rig requirements (these are where invariant suites quietly lie)
- `targetContract` points at the **handler**, never at the pool. Pointed at the pool,
  the fuzzer supplies random senders holding no tokens and granting no approvals;
  nearly every call reverts, reverts are discarded rather than failing, and the
  invariant is asserted against a contract still in its initial state. Green because
  nothing happened.
- Read the **calls/reverts statistics** in the run output every time. A revert rate
  near 100% means the run proved nothing.
- Set `fail_on_revert = true` while building the handler, so unreachable branches
  surface instead of being swallowed.

### Evidence that would make it meaningful
- The invariant run's counterexample: a concrete call sequence with the gap growing
  across it, plus the shrunk sequence Foundry reports.
- Run statistics showing a low revert rate and depth/runs high enough that sequences
  reached real post-deposit, post-borrow, post-repay states.
- After the fix, the same invariant green at the same depth — with the revert rate
  still low, so the green means the states were actually reached.

---

## 3. Chainlink feed + collateral token — pinned fork, not mocks

### Why more mock tests change nothing
A mock encodes your assumption about the dependency, so every additional mock-based
test re-tests that assumption. Deployed contracts deviate from the interface they are
called through — in what a call returns, in how much of a transfer arrives, in whether
a balance stays put. A standard-behaviour mock answers in the standard shape every
time, so it structurally cannot surface the mismatch. "The production addresses are
known but no test has called them" is the whole problem: the integration is untested.

### The experiment I would require
Fork tests against the real deployments, at a **pinned block**:

```solidity
uint256 fork = vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
```

Pin it. An unpinned fork follows the chain head, so live prices and reserves move
between runs: assertions drift red, flake green on re-run, the local RPC cache never
hits, and you grow into slow suites and provider 429s.

**Confirm archive depth before pinning.** Pinning an old block is an archive request.
A full node keeps only recent state — geth's default window is roughly the last 128
blocks — and answers anything older with an error, not a wrong number. Whether an
endpoint serves archive depth is a property of the node and the plan behind it; a URL
does not tell you. Verify with a historical `eth_call` at your chosen block before
committing to it:

```bash
cast call <FEED> "latestRoundData()" --block 19000000 --rpc-url $MAINNET_RPC_URL
```

If that errors, the tests fail for a reason that has nothing to do with the contract.

Use the **verified** production addresses — take the feed address from Chainlink's
official feed registry/docs and the collateral token from the deployment config, and
confirm each onchain (`cast code`, and `decimals()` / `description()` on the feed)
rather than trusting a constant copied into a test file.

### What to exercise, specifically

**Oracle:**
- Real `latestRoundData()` at the pinned block: the actual `answer`, `decimals`
  (Chainlink feeds are not uniformly 8, and USD vs ETH feeds differ), `updatedAt`,
  `answeredInRound`.
- **Staleness and validity handling**, which mocks never trigger: `updatedAt` far in
  the past (fork to a block during a known feed gap, or `vm.warp` past the heartbeat),
  `answer <= 0`, and incomplete-round conditions. If the liquidation path has no
  staleness check, the fork test is how that becomes visible.
- Decimal scaling between the feed and the collateral token asserted against a value
  computed independently of the implementation's own scaling expression — not the
  implementation restated.

**Collateral token:**
- Real `transfer`/`transferFrom` against the deployed token, asserting on **balance
  deltas before and after**, never on the return value alone. Non-standard tokens
  (USDT and kin) return nothing; fee-on-transfer tokens deliver less than the amount
  passed; rebasing tokens move balances with no transfer at all. Any of these breaks a
  liquidation that assumes `amount sent == amount received`.
- A real whale/holder via `deal` or `vm.prank` on an actual holder, so approvals and
  allowance semantics (including USDT's approve-from-nonzero revert) are exercised.

### Evidence that would make it meaningful
- Fork tests at a named, committed block number, with the archive `eth_call` check
  recorded in the README or CI so the pin is reproducible by anyone.
- A liquidation executed end-to-end on the fork with the real feed value and real
  token, and the resulting collateral transfer asserted on measured balance deltas.
- At least one assertion that the mock could not have produced — a real decimals
  value, a real fee-on-transfer shortfall, or a stale-round rejection.
- CI runs these with the RPC URL from a secret and the block pinned, so a provider
  change does not silently turn the fork suite into a skipped suite.

---

## Sign-off checklist for this pool

- [ ] No test asserts the implementation back to itself (a getter against its own
      variable, stored state against the value just written, constructor state against
      the constructor argument — these run every line and constrain nothing).
- [ ] `reserveFactorWad` fuzzed across its accepted domain with `bound()`; `0`,
      `1e18 - 1`, `1e18`, `1e18 + 1` classified and exercised separately, with the two
      failing paths kept as distinct evidence.
- [ ] Handler-driven invariant tying `accountedAssets` to actual custody as an
      **equality**; accumulation shown across ≥2 repayments or by an invariant
      counterexample sequence; revert rate read from the run output and low.
- [ ] Chainlink feed and collateral token exercised on a pinned fork against the real
      deployments, on an endpoint confirmed to serve that block.
- [ ] Access control on the `reserveFactorWad` setter, plus zero- and max-value cases,
      revert as intended with specific revert reasons.
- [ ] `slither .` run, no high or medium finding left unaddressed.

Until items 2–4 are done, the suite has performed **none** of the three searches, and
the green run is evidence only that the examples someone wrote down still pass.

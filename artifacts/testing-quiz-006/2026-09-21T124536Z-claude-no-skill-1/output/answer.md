# Test-plan review: onchain credit pool

## Verdict

**Do not sign off.** The suite is green and hits every line, but line coverage
measures which statements executed, not which *states* were reached. All three
surfaces fail for the same structural reason: each one is tested with a single
hand-chosen example, and in each case the property that matters is a statement
about a *range* of inputs (surface 1), a *sequence* of operations (surface 2), or
*real-world counterparty behaviour* (surface 3). A one-point example cannot
witness any of those. Worse, surface 2's plan states a conclusion the evidence
does not support, which is a reasoning defect and not just a coverage gap.

Each surface needs a different technique — they are not interchangeable, and
running more unit tests will not close any of them.

---

## Surface 1 — `reserveFactorWad`: bounded fuzz + boundary enumeration, then a setter bound

### What's wrong with the current evidence

Two examples (`0`, `0.2e18`) are both comfortably inside the safe interior of the
domain. The setter accepts any `uint256`, so the input domain is
`[0, 2^256-1]`; the tests sample two points from it, neither near a boundary.
The redemption arithmetic
`net = assets * (1e18 - reserveFactorWad) / 1e18` has two independent failure
modes neither example can reach: the subtraction, and the floor division.

### Experiment I would require

**(a) Explicit boundary/limit-case tests.** These are not fuzz targets; they are
named assertions, because the interesting values are known exactly:

| `reserveFactorWad` | Expected behaviour to assert |
|---|---|
| `0` | `net == assets` (already covered) |
| `1` | smallest non-zero cut; `net == assets` for small `assets` due to floor — assert the rounding direction is deliberate and favours the pool, not the redeemer |
| `1e18 - 1` | `net = assets / 1e18` (floored) — every redemption below `1e18` units reverts. For an 18-decimal asset that is every redemption under 1 whole token; for a 6-decimal asset it is **every redemption that will ever occur** |
| `1e18` | `net == 0` for all `assets`: **every redemption reverts, permanently**. Governance can brick withdrawals with one transaction |
| `1e18 + 1` | `1e18 - reserveFactorWad` underflows → redemption reverts with a panic (0x11) under Solidity ≥0.8. Same permanent-DoS outcome, reached by a fat-finger of one wei. If any part of that expression sits in an `unchecked` block, the result is instead a colossal `net` and the pool pays out far more than `assets` — assert which one it is |
| `type(uint256).max` | same class as above; confirms there is no upper guard at all |

The two rows at `1e18` and `1e18 + 1` are the finding. They are reachable by a
single governance call, are irreversible from the users' side, and are exactly
the points the existing tests skip.

**(b) A bounded fuzz/property test for the rounding boundary.** For the
dust-revert behaviour the boundary is input-dependent, so enumerate it with a
property rather than by hand:

```
// foundry
function testFuzz_redeemNeverSilentlyZeroes(uint256 rf, uint256 assets) public {
    rf     = bound(rf, 0, MAX_RESERVE_FACTOR);   // the bound you are about to add
    assets = bound(assets, MIN_REDEEM, 1e30);
    pool.setReserveFactor(rf);
    assertGt(pool.previewRedeem(assets), 0);
}
```

The meaningful evidence is not "the fuzzer passed". It is:

- the **counterexample** the fuzzer produces *before* the fix — a concrete
  `(rf, assets)` pair, shrunk to minimal form, showing the smallest `assets`
  that rounds to `net == 0` (algebraically: any
  `assets < ceil(1e18 / (1e18 - rf))`);
- that counterexample **committed as a named regression test** with its literal
  values, so it is checked deterministically forever rather than depending on a
  fuzzer re-finding it;
- the **fix**: the setter constrains the input, e.g.
  `require(reserveFactorWad <= MAX_RESERVE_FACTOR)` with `MAX_RESERVE_FACTOR`
  set to a governance-policy ceiling well under `1e18` (0.5e18 is typical) —
  `< 1e18` alone is necessary but not sufficient, since `1e18 - 1` is still
  catastrophic;
- the **re-run** of the same property after the fix, with the run count and seed
  recorded (`forge test --fuzz-runs 100000`, `FOUNDRY_FUZZ_SEED` pinned in CI).

**(c) Optional but well-matched here: symbolic proof.** Because the setter takes
an unconstrained `uint256`, fuzzing can only sample the domain. Halmos or
Kontrol can discharge "for all `rf ≤ MAX_RESERVE_FACTOR` and all
`assets ≥ MIN_REDEEM`, `net > 0` and no overflow" over the *entire* domain. If
you want the sign-off to mean something stronger than "we sampled a lot", this
is the surface where it is cheap to get.

### Why fuzzing alone is the wrong primary tool for (a)

A blind fuzzer over `uint256` hits `1e18` with probability ~`2^-256`. The
boundary cases must be written by hand from reading the arithmetic; fuzzing
covers the input-dependent rounding edge that hand analysis is likely to get
wrong. You need both, for different reasons.

---

## Surface 2 — the accumulation claim: stateful invariant testing

### What's wrong with the current evidence

This is the most serious item, because the plan **asserts a conclusion its
experiment cannot support**. One deposit followed by one repayment shows that
after one repayment `accountedAssets` disagrees with the pool's real balance.
That is consistent with at least three different underlying behaviours:

1. a one-time constant offset (harmless-ish, wrong bookkeeping, bounded);
2. drift that grows linearly with the number of repayments (the claimed bug);
3. drift that is *intended* and simply not represented — i.e. the protocol cut
   is real revenue and the missing thing is a `reserves` accumulator, so the
   correct invariant is `balanceOf(pool) == accountedAssets + reserves` and
   there is no divergence at all, only an unstated term.

A single observation cannot distinguish these. Calling it "proof that the
mismatch accumulates" is a claim about the *derivative* of the discrepancy
drawn from a single sample of its *value*. Sign-off cannot rest on it.

### Experiment I would require

**(a) State the invariant explicitly first.** Before measuring anything, write
down what the relation is *supposed* to be, including the reserve term. If the
contract has no reserves accumulator, then writing the invariant *is* the
finding: there is no expressible correct relation, which means the protocol cut
is untracked value.

**(b) A deterministic N-repayment test to establish the growth law.** Cheap,
runs in CI, and directly answers "does it accumulate?":

```
for N in {1, 2, 10, 100}:  drift(N) = balanceOf(pool) - accountedAssets
```

Meaningful evidence is the *shape*: `drift(N) == N * cut` (linear accumulation,
confirms the claim), versus `drift(N) == drift(1)` (one-time offset, claim is
false), versus `drift(N) == 0` once the reserve term is included (no bug).
Assert the relation, don't eyeball the numbers. This test is what the plan
should have contained in place of its one-repayment example.

**(c) A stateful invariant campaign for the general case.** The N-repayment test
uses one fixed operation ordering; the real system interleaves deposits,
borrows, repays, redeems and liquidations across multiple actors. Use Foundry
invariant testing with a handler:

- handler exposes `deposit / borrow / repay / redeem / liquidate` with
  `bound()`-ed amounts and an actor set (several addresses, ghost-tracked
  balances), so the fuzzer composes *sequences* rather than single calls;
- invariants asserted after every call:
  `balanceOf(pool) >= accountedAssets` (solvency direction),
  `balanceOf(pool) == accountedAssets + reserves` (exact bookkeeping),
  and a ghost-variable check that `reserves` is monotone non-decreasing and
  equals the sum of the per-repayment cuts;
- configuration recorded in `foundry.toml`: `runs`, and crucially `depth`
  (≥ 50–100 — depth is what actually produces accumulation; a depth of 1
  reproduces exactly the flawed one-operation experiment at scale);
- `fail_on_revert = false` with a handler that filters unreachable states,
  so reverts don't mask sequence exploration.

**(d) The consequence test.** Accumulating drift only matters if it does damage.
Drive the pool to a terminal state — every depositor redeems in sequence — and
assert what happens to the *last* redeemer. If `accountedAssets` is understated
the last exit may revert for insufficient balance, or share price is wrong and
early redeemers extract value from late ones. That end-state assertion is the
evidence that turns a bookkeeping discrepancy into a severity rating.

### Evidence that makes it meaningful

A broken-invariant **call sequence** printed by the fuzzer, shrunk, with the
concrete amounts; the growth law from (b) stated as a formula and asserted; and
the terminal-state outcome from (d). "The invariant suite passed after the fix"
is only meaningful if you also show the suite *failed* on the pre-fix code at
the same seed and depth — otherwise you have not demonstrated the test can
detect the bug at all.

---

## Surface 3 — Chainlink feed and collateral token: pinned-block fork tests

### What's wrong with the current evidence

"Standard-behaviour mocks" encode the assumption under test. A mock feed returns
a fresh positive price with the decimals you chose; a mock ERC-20 returns `true`
and moves exactly the requested amount. Every real-world failure mode of these
two integrations lives precisely in the gap between that mock and the deployed
contract. The production addresses being *known but never called* is the
strongest argument against sign-off here: the cost of checking is one fork test,
and the cost of being wrong is a liquidation path that fails in production.

### Experiment I would require

**Fork tests against the real addresses at a pinned block**, not more mocks:

```
forge test --fork-url $MAINNET_RPC --fork-block-number 20_000_000
```

Reproducibility conditions (these are what make the fork test admissible as
evidence rather than a flaky one-off):

- **block number pinned as a constant in the test file**, never "latest" — an
  unpinned fork test asserts against a moving world and its pass/fail is not
  reproducible;
- **RPC responses cached** (`~/.foundry/cache`) and the cache available in CI,
  so the test does not depend on RPC liveness or rate limits;
- **chain id asserted** in setup, so a mis-pointed RPC fails loudly instead of
  silently testing the wrong network;
- **address provenance pinned**: assert `address.code.length > 0` and store the
  expected `codehash`, and for proxies assert the current implementation slot
  (EIP-1967) matches a recorded value — this turns a silent upstream upgrade of
  the token or the feed aggregator into a CI failure.

**Chainlink feed — what to actually assert.** Read the real feed at the pinned
block and check the assumptions the code makes:

- `decimals()` equals what the pricing math assumes (8 for most USD pairs, 18
  for some ETH pairs) — a hardcoded 8 against an 18-decimal feed is a 10^10
  mispricing;
- the full `latestRoundData()` tuple is consumed, not just `answer`: assert the
  code reverts on `answer <= 0`, on stale `updatedAt` (older than the feed's
  published heartbeat — look up the actual heartbeat and deviation threshold for
  *this* feed, don't assume 1 hour), and on `answeredInRound < roundId`;
- **negative/zero and stale answers must still be tested**, which you do *on the
  fork* by `vm.mockCall`-ing the real address with those returns — this keeps
  the real decimals, the real surrounding integration, and only varies the one
  input;
- aggregator **min/max answer clamping**: if the feed's underlying aggregator
  has `minAnswer`/`maxAnswer` bounds, a market crash pins the reported price at
  the floor while the true price is lower, and liquidations price collateral too
  high. Assert the code's behaviour at the clamp, or document acceptance;
- on an L2 deployment, the **sequencer uptime feed** check and its grace period —
  its absence is a standard liquidation-fairness bug.

**Collateral token — what to actually assert.** Run the real liquidation path
end-to-end on the fork against the deployed token:

- **fund the liquidator realistically**: `deal()` writes storage and silently
  breaks tokens with internal accounting or rebasing indices — prefer
  `vm.prank` on a real whale address (pinned, balance asserted in setup), or
  verify `deal` produced a consistent state by reading `totalSupply` too;
- **measure balance deltas, never assume them**: assert
  `balanceAfter - balanceBefore` on both sides. This is the assertion that
  catches fee-on-transfer and rebasing tokens, where the pool credits the
  requested amount but receives less;
- **non-standard return values**: tokens like USDT return no data from
  `transfer`; if the code uses a raw `IERC20.transfer` rather than
  `SafeERC20.safeTransfer`, the call reverts on decode. Only the real bytecode
  shows this — the mock cannot;
- **`decimals()` ≠ 18** wired through the collateral valuation math, with a real
  6-decimal token if one is in scope;
- **blocklist / pausable**: for tokens with admin controls (USDC, USDT),
  `vm.prank` the real blocklister to freeze the liquidator or the pool and
  assert the protocol's behaviour is contained rather than bricked;
- **approve semantics**: tokens requiring approval reset to zero before a new
  non-zero approval.

If a production address is on a chain without reliable archive access, say so
explicitly and gate sign-off on a testnet deployment of the *same* bytecode
rather than quietly falling back to the mock.

---

## Conditions for sign-off

1. `reserveFactorWad` setter bounded by an explicit `MAX_RESERVE_FACTOR`
   strictly below `1e18`; the six limit cases above asserted by name; the
   dust-rounding property fuzzed with a pinned seed, and its pre-fix
   counterexample committed as a regression test.
2. The bookkeeping invariant written down *including the reserve term*; the
   growth law established by the deterministic N-repayment test; a stateful
   invariant campaign at depth ≥ 50 shown to **fail on the current code** and
   pass after the fix; the terminal-redemption consequence asserted. The
   "mismatch accumulates" sentence removed from the plan until (b) supports it.
3. Fork tests at a pinned block against both production addresses, with chain
   id and implementation-slot pins, exercising stale/zero/negative price and
   measured balance deltas on the real token, running in CI from a cached
   fork.

Until then, "green, 100% coverage" describes the tests, not the contract.

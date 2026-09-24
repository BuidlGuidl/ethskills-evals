# Sign-off review: onchain credit pool

**No — this is not enough to sign off.**

A green suite at 100% line coverage records which lines executed, never whether any
assertion could have failed. The three surfaces described map onto three different
searches, and the current plan performs none of them:

| Surface | Risk shape | Required search | Currently |
|---|---|---|---|
| 1. `reserveFactorWad` | owner-settable number feeding value math | fuzz over the whole accepted domain + classified boundaries | two hand-picked values |
| 2. repayment vs. `accountedAssets` | stateful accounting vs. custody | handler-driven invariant | one-operation example |
| 3. Chainlink feed + collateral token | external integration | pinned fork against the real deployment | standard-behaviour mocks |

Each is a search for a case nobody proposed. Reading the code, forming a suspicion and
writing one test for it confirms the belief you already had; it stops at the first defect
you happened to imagine. Targeted regression tests are worth keeping *after* the search,
not instead of it.

---

## 1. `reserveFactorWad` — fuzz the domain, and classify the limit

`0` and `0.2e18` walk one branch each. Two points out of a `uint256` domain is not a
search.

### Required experiment

A fuzz test over **both** inputs that feed the expression, bounded with `bound()` (not
`vm.assume()`, which discards runs and silently starves the search):

```solidity
function testFuzz_redeemNeverSilentlyZeroes(uint256 factor, uint256 assets) public {
    factor = bound(factor, 0, 1e18 - 1);     // the semantically usable domain
    assets = bound(assets, 1, type(uint128).max);
    vm.prank(gov); pool.setReserveFactorWad(factor);
    ...
}
```

The property to assert is not "the line ran". It is a conservation/monotonicity
statement, e.g. `net + retainedReserve == assets` (no wei stranded or invented), `net`
is monotonically non-increasing in `factor`, and every call either transfers `net > 0`
or reverts — never transfers zero while burning shares.

### The limit cases, stated precisely

The semantically usable maximum is **`1e18 - 1`, not `1e18`**. Do not assume the exact
limit is valid just because only values past it break a numeric inequality:

- **`1e18 - 1` — nearest valid value.** `1e18 - factor == 1`, so `net = assets / 1e18`.
  Redemption succeeds only for `assets >= 1e18`; below that it reverts on `net == 0`
  even though the configuration is legal. Assert both sides of that threshold.
- **`1e18` — the exact limit. Accepted by the setter, arithmetically fine
  (`1e18 - 1e18 == 0`), and semantically fatal:** `net == 0` for *every* `assets`, so
  redemption is bricked for all users with no way out except another governance call.
  This is a liveness bug, not an arithmetic one, and no underflow will ever surface it.
- **`1e18 + 1` — first value beyond the limit.** `1e18 - factor` underflows and reverts
  with a Solidity 0.8 arithmetic panic (`0x11`), inside redemption, at transaction time —
  i.e. the failure lands on an innocent redeemer, not on the governance call that caused it.

**Keep these as three separate tests with separate expected reverts.** `1e18` and
`1e18 + 1` both "fail", but through different paths (custom `net == 0` revert vs.
panic `0x11`); collapsing them into one `vm.expectRevert()` destroys the evidence that
distinguishes a bricked-but-live pool from an underflowing one.

Also exercise `0` (no cut, `net == assets`) and `type(uint256).max` at the setter.

### What the search should conclude

The setter should reject `factor >= 1e18` — or, if governance is trusted to set `1e18`
deliberately, that must be a documented, tested pause semantic, not an accident. Add
`vm.expectRevert` access-control tests on the setter for a non-governance caller while
you are there.

---

## 2. Repayment accounting — one mismatch is not accumulation

**The test plan's claim is not supported by its evidence.** One deposit followed by one
repayment shows a single post-operation mismatch. That proves *divergence*. It says
nothing about whether the gap grows, stays constant, or is a one-time setup artefact —
and the remediation differs completely between those cases.

### What would actually demonstrate accumulation

Either of these, minimum:

1. **A direct sequence test with at least two drift-creating operations.** Two (better,
   N) repayments that each retain a protocol cut, recording
   `gap_i = token.balanceOf(pool) - pool.accountedAssets()` after each, and asserting
   `gap_2 > gap_1` with the increments matching the retained cut per repayment. Setup
   plus one repayment is *not* two drift-creating operations — the deposit does not
   create drift, so that pair only ever shows one data point.
2. **A stateful-invariant counterexample** whose recorded call sequence contains repeated
   repayments and shows the gap growing along it. This is stronger, because the fuzzer
   chooses the sequence rather than you choosing it.

### Required search: handler-driven invariant

This is a lending pool — it does not ship on unit tests. Required before deploy:

```solidity
function invariant_accountingMatchesCustody() public {
    assertEq(asset.balanceOf(address(pool)), pool.accountedAssets() + pool.reserves());
}
```

Two things matter about the *shape* of that assertion:

- **It must be an equality (or an explicit no-drift check), not a one-sided bound.**
  `accountedAssets <= balanceOf(pool)` is the tempting form, and it would stay green
  through exactly the bug described here — the retained cut leaves a *surplus*, and a
  one-sided bound only fires on a shortfall. Value stranded in the pool is as much a bug
  as value lost, so the property has to constrain both directions. If reserves are
  legitimately held outside `accountedAssets`, they must appear as an explicit term on
  the right-hand side (as above), so that untracked surplus still fails.

- **`targetContract` must point at a handler, never at the pool.** Pointed at the pool
  directly, the fuzzer calls `repay`/`redeem` from random addresses holding no tokens and
  having granted no approvals. Those calls revert, reverts are discarded rather than
  failed, and the invariant is then asserted against a pool that never left its initial
  state — green because nothing happened.

  The handler owns: funded and approved actors (several, since the property is about
  interaction between depositors, borrowers and liquidators), inputs `bound()` into
  valid ranges, and an actor-selection modifier.

**Read the calls/reverts statistics in every run.** A revert rate near 100% means the run
proved nothing. Set `fail_on_revert = true` while building the handler so that a broken
handler surfaces immediately instead of passing silently.

---

## 3. Chainlink feed + collateral token — pinned fork, not mocks

A mock encodes your assumption about the dependency. Adding more mock-based tests only
re-tests the assumption. "The production addresses are known but no test has called them"
is precisely the gap: the mock answers in the standard shape every time, so it can never
surface a mismatch with the deployed contract.

### What the mocks cannot catch

- **Chainlink:** a standard mock returns a fresh, positive, 8-decimal price. The real feed
  returns `(roundId, answer, startedAt, updatedAt, answeredInRound)` where `answer` is a
  **signed** `int256` that can be zero or negative, `updatedAt` can be stale past the
  feed's heartbeat, and `decimals()` differs per feed (8 for most USD pairs, 18 for some
  ETH pairs). If the liquidation path casts to `uint256` without a positivity check or
  skips a staleness check, only the real feed's shape makes that visible.
- **Collateral token:** deployed tokens deviate from the interface they are called
  through — non-standard or missing return values (USDT returns nothing from `transfer`,
  so a bare `IERC20` call reverts on decode; use `SafeERC20`), fee-on-transfer (less
  arrives than was sent, so crediting the requested amount over-credits), rebasing
  balances (a balance that moves without a transfer breaks any cached amount), non-18
  decimals, and `approve` requiring a reset to zero first.

### Required experiment, made reproducible

```solidity
function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
    // real feed + real collateral token at their production addresses
}
```

- **Pin the block.** An unpinned fork follows the chain head: live prices and reserves
  move between runs, so assertions drift red and flake green on re-run, the local RPC
  cache never hits, runs get slow, and the provider starts returning 429s. A pinned block
  is what makes the result reproducible and reviewable.
- **Confirm the endpoint serves that block before pinning it.** Pinning an old block is an
  archive request. A full node keeps only recent state (geth's default window is roughly
  the last 128 blocks) and errors on anything older. Whether an endpoint has archive depth
  is a property of the node and the plan behind it — the URL does not tell you. Verify
  with a historical `eth_call` at the target block first, e.g.
  `cast call <feed> "latestRoundData()" --block 19000000 --rpc-url $MAINNET_RPC_URL`,
  otherwise the suite fails for reasons unrelated to the contract.
- **Assert against real returned values**, not against numbers you wrote into a mock:
  read the feed's actual `decimals()` and scale accordingly; assert the collateral
  *received* equals `balanceAfter - balanceBefore` rather than the amount requested; drive
  a liquidation end-to-end and assert seized collateral, repaid debt and the resulting
  health factor.
- **Use `vm.mockCall` on top of the pinned fork** for the adversarial oracle cases you
  cannot find naturally at that block — `answer <= 0`, `updatedAt` older than the
  heartbeat, `answeredInRound < roundId` — so the fork covers real shape and the mock
  covers the hostile values.

---

## Sign-off checklist

- [ ] No test asserts the implementation back to itself (a stored value against the value
      just written, a getter against its own variable, constructor state against the
      constructor argument). Those execute every line and constrain nothing.
- [ ] `reserveFactorWad` fuzzed across its domain with `bound()`; `1e18 - 1`, `1e18` and
      `1e18 + 1` classified and exercised separately, with their distinct revert paths
      preserved.
- [ ] Accumulation demonstrated by ≥2 fee-bearing repayments or an invariant
      counterexample — not by one deposit plus one repayment.
- [ ] Handler-driven invariant tying `accountedAssets` to custody as an **equality**, with
      the calls/reverts statistics read and the revert rate low enough to prove the
      sequences reached real states.
- [ ] Chainlink feed and collateral token exercised on a **pinned** fork at production
      addresses, on an endpoint confirmed to serve that block.
- [ ] Access control on `setReserveFactorWad`, plus zero and max-value cases, revert as
      intended.
- [ ] `slither .` run with no high or medium finding left unaddressed.

Until items 2–5 are done, the suite has confirmed only the cases someone already thought
of — including, on surface 2, a conclusion the evidence does not actually support.

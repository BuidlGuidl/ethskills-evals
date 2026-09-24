# Test-plan review: onchain credit pool

**Verdict: not enough to sign off.** Green line coverage with local mocks and
one-operation examples tells you every line *executes*, not that the properties hold.
All three surfaces are untested in the sense that matters: the governance value is
covered at two interior points and never at its boundaries; the accounting claim is an
*extrapolation* from a single sample, not a demonstration; and the external
integrations have been tested against your assumptions about Chainlink and the
collateral token rather than against the deployed contracts.

Below, per surface: the experiment I would require, and what result makes it meaningful.

---

## 1. `reserveFactorWad` — bounded fuzz over the full domain, plus explicit boundary cases

Two example values (0 and 0.2e18) sample the interior of a domain the setter declares
to be all of `uint256`. The interesting behaviour is entirely at the edges.

### Required experiment

**(a) Explicit boundary unit tests on the setter and on redemption at each value:**

| Value | What must be asserted |
|---|---|
| `0` | No reserve taken; `net == assets` exactly. |
| `1` | Smallest nonzero factor; rounding does not eat a normal-sized redemption. |
| `1e18 - 1` | `net` is nonzero only for large `assets`; confirm the exact threshold. |
| `1e18` | `net == 0` for **every** `assets`. Redemption is bricked for all users, permanently, until governance moves. This is the case to decide about consciously. |
| `1e18 + 1` | `1e18 - reserveFactorWad` underflows. Under 0.8.x this reverts in the redemption path, not at the setter — so a single governance transaction bricks redemption with a bare panic. |
| `type(uint256).max` | Same underflow, reached from the far end of the domain. |

**(b) A bounded fuzz over the whole range, not just the plausible range:**

```solidity
function testFuzz_SetReserveFactor(uint256 rf, uint256 assets) public {
    rf = bound(rf, 0, type(uint256).max);   // deliberately unbounded
    assets = bound(assets, 1, 1e30);
    vm.prank(governance);
    pool.setReserveFactorWad(rf);
    // property: redemption either pays out or reverts with a *named* error —
    // it must never revert with a panic, and must never pay out more than assets
    ...
}
```

Run at `--fuzz-runs 10000`; a fuzzer left to its own distribution will rarely propose
exactly `1e18`, so keep the explicit cases alongside the fuzz.

**(c) The rounding threshold as a property.** `net == 0` whenever
`assets * (1e18 - rf) < 1e18`, i.e. for `assets < 1e18 / (1e18 - rf)`. Fuzz
`(assets, rf)` and assert the revert happens *exactly* on that condition — that small
redeemers get a clean revert and not a silent zero-value transfer, and that a large
redeemer is never blocked.

### Evidence that would make it meaningful

Not "the fuzz passed." The meaningful artifact is: **a stated, tested invariant that
the setter enforces an upper bound** (e.g. `rf <= MAX_RESERVE_FACTOR < 1e18`) with a
named custom error, plus a test that `1e18` and `1e18 + 1` are *rejected at set time*.
If governance is intentionally allowed to brick redemptions, I want that written down as
a deliberate, documented power — with a test asserting it — not discovered later from a
panic in production.

---

## 2. Repayment accounting — one sample is not accumulation

A single deposit-then-repayment showing a mismatch demonstrates **one mismatch**. It is
consistent with a constant one-time offset, with a mismatch that nets out on the next
operation, and with unbounded drift. The plan picks the third reading without evidence.
This is the weakest step in the plan: the conclusion is an assumption, not a result.

### Required experiment

**(a) A sequence test that varies N.** Run 1, 2, 10, 100 repayments through identical
mechanics and record `token.balanceOf(pool) - accountedAssets` after each. Accumulation
is demonstrated only if the gap is **monotonically increasing in the number of
repayments** and scales with the count — roughly `N * cut` — rather than settling at a
fixed value. If the gap is the same after 1 and after 100, the single-sample conclusion
was wrong.

**(b) Fuzz over the repayment schedule,** so the result is not an artifact of one set
of amounts:

```solidity
function testFuzz_DriftGrowsWithRepayments(uint256[10] memory amounts) public { ... }
```

Assert the gap after repayment `i+1` is `>=` the gap after `i`, and that the total
equals the sum of the retained cuts.

**(c) Invariant testing — this is the real requirement.** The pool is a stateful
protocol with interacting entry points, which is exactly the case unit tests cannot
cover. Build a handler exposing `deposit`, `withdraw`, `borrow`, `repay`, `liquidate`
with bounded inputs, `targetContract(handler)`, and assert:

- `invariant_AccountedAssetsNeverExceedsBalance`: `accountedAssets <= token.balanceOf(pool)`
  — solvency direction. If this breaks, the pool believes it holds assets it does not.
- `invariant_DriftEqualsRetainedReserves`: `balanceOf(pool) - accountedAssets ==
  totalRetainedCuts` — the gap is *explained*, not merely bounded.
- `invariant_AllDepositorsCanExit`: after any call sequence, every depositor's
  redemption succeeds for their full share.

Run with meaningful depth (`[invariant] runs = 512, depth = 50`) — a depth-15 sequence
may never produce two repayments in a row.

### Evidence that would make it meaningful

Either (i) the invariant holds and the gap is fully accounted for by the retained
reserves — in which case the mismatch is intended protocol revenue and the plan's
"accumulating bug" framing is wrong and should be retracted; or (ii) Foundry produces a
**counterexample call sequence** where drift causes a depositor's redemption to fail or
under-pay. A saved, replayable failing sequence is proof. A prose argument from one
example is not.

---

## 3. Chainlink feed and collateral token — fork tests at a pinned block

Standard-behaviour mocks test the contract against your beliefs about these
integrations. The known failure modes are precisely the non-standard behaviours a
mock erases:

- **Chainlink:** `latestRoundData` returns a *signed* price that can be zero or
  negative; `updatedAt` can be stale; feed decimals are 8 for most USD pairs, not 18;
  the feed is a proxy that can be pointed at a new aggregator; a feed has min/max
  answer bounds that pin the reported price during extreme moves.
- **Collateral token:** may return no boolean from `transfer` (USDT-style), may be
  fee-on-transfer (received < sent), may be rebasing, may not have 18 decimals, may
  revert on zero-value transfer, may be pausable or have a blocklist.

A mock that behaves well hides every one of these.

### Required experiment

**(a) Fork tests against the production addresses, pinned to a block** — pinning is the
whole point, since an unpinned fork is a test whose result changes daily:

```solidity
function setUp() public {
    vm.createSelectFork(vm.rpcUrl("mainnet"), 19_000_000);  // pinned = reproducible
    pool = new CreditPool(PROD_COLLATERAL, PROD_CHAINLINK_FEED);
}
```

with `mainnet = "${MAINNET_RPC_URL}"` under `[rpc_endpoints]` in `foundry.toml` so CI
needs no CLI flags and no key lives in the repo. Verify the production addresses against
an authoritative source before hardcoding them — a wrong constant makes the whole suite
a test of an unrelated contract.

**(b) Against the real feed, assert:** the decimals your math assumes match
`feed.decimals()`; a liquidation at the real current price produces the collateral
amount you expect end to end; the contract rejects a stale or non-positive answer
(force this by `vm.warp`-ing past your staleness window, and by `vm.mockCall`-ing the
aggregator to return `0` and a negative price **on the fork**, so everything else stays
real).

**(c) Against the real token, assert:** a full liquidation path moves collateral using
`deal` to fund positions; measure balances *before and after* rather than trusting the
requested amount, so a fee-on-transfer or non-standard return is caught; use
`SafeERC20`, and add a test that a missing-return-value transfer still succeeds.

**(d) Pick fork blocks adversarially,** not just "recent": at least one block from a
period of sharp price movement for the collateral asset. A liquidation that works at a
calm block and reverts in a crash is the exact bug fork testing exists to find.

### Evidence that would make it meaningful

A CI job that runs the fork suite at pinned blocks and passes reproducibly, plus the
specific assertions above passing against the real addresses. "The mocks pass" is
evidence about the mocks.

---

## Sign-off conditions

1. `reserveFactorWad` bounded at set time with a named error; `1e18` and `1e18 + 1`
   tested as rejected; full-domain fuzz at 10k runs with no panic reverts.
2. Invariant suite with a handler over deposit/borrow/repay/withdraw/liquidate, drift
   fully explained by retained reserves, and the accumulation claim either confirmed by
   a replayable counterexample or withdrawn.
3. Fork tests at pinned blocks against the production feed and collateral token,
   including stale/zero/negative price handling and balance-delta-based transfer checks.
4. Housekeeping the plan should also cover: access control on the setter (non-governance
   reverts), events asserted with `expectEmit`, `forge snapshot` for gas regressions, and
   `slither .` with no unaddressed high/medium findings.

Until 1–3 land, the suite demonstrates that the code runs, not that it is safe to hold
other people's money.

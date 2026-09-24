# Sign-off review: onchain credit pool

**Verdict: do not sign off.**

The suite is green and covers every line, but coverage records which lines ran, never
whether an assertion could have failed. The three surfaces map onto the three searches
that gate deployment — configurable value math → fuzz, stateful accounting → handler
invariant, external integrations → pinned fork — and the current plan performs *none* of
them. It uses local mocks and one-operation examples, which is precisely the shape that
cannot reach the failures these surfaces produce.

What follows is, per surface, the search I would require and the evidence that makes it
meaningful.

---

## 1. `reserveFactorWad` — fuzz the domain, and classify the boundary properly

`net = assets * (1e18 - reserveFactorWad) / 1e18`, revert when `net == 0`. The setter
accepts any `uint256`. Existing coverage is `0` and `0.2e18`: two hand-picked interior
points, both on the same branch. They constrain nothing about the boundary.

### The limit cases, classified

The mistake to avoid is assuming `1e18` is valid because only values *above* it violate
the numeric inequality `reserveFactorWad <= 1e18`. Decide semantic usability first:

| Value | Behaviour | Status |
|---|---|---|
| `1e18 - 1` | Nearest representable value below the limit. `net = assets / 1e18`, so **every redemption of less than 1e18 units reverts** — for an 18-decimal asset that is every redemption under 1 whole token, and for a 6-decimal asset it is *every redemption, full stop*. | Representable and inside the inequality, but a pool-bricking configuration. |
| `1e18` | `1e18 - reserveFactorWad == 0`, so `net == 0` for **all** inputs. Every redemption reverts through the explicit `net == 0` check. Redemptions are permanently disabled; deposits are unwithdrawable. | **Not semantically usable.** The exact limit is not valid merely because the subtraction does not underflow. |
| `1e18 + 1` | `1e18 - reserveFactorWad` underflows → `Panic(0x11)` in unchecked-arithmetic terms, a **different failure path** from the `net == 0` revert. | Invalid, and must be evidenced separately. |

Keep `1e18` and `1e18 + 1` as **separate** assertions. They fail through different paths —
a domain check versus an arithmetic panic — and collapsing them into one
`vm.expectRevert()` destroys the distinction that tells you whether the guard or the
compiler caught it.

### Required experiment

A fuzz test over the whole accepted domain, using `bound()` and not `vm.assume()`
(`vm.assume` discards runs and silently starves the interesting region):

```solidity
function testFuzz_redeemNeverExceedsAssets(uint256 rf, uint256 assets) public {
    rf     = bound(rf, 0, 1e18 - 1);        // the range the setter *should* accept
    assets = bound(assets, 1, type(uint128).max);
    vm.prank(gov); pool.setReserveFactorWad(rf);
    ...
    assertLe(net, assets);                                   // conservation
    assertEq(net, assets * (1e18 - rf) / 1e18 > 0 ? net : 0); // no silent zero
}
```

Properties worth asserting, none of which mirror the implementation back to itself:
- `net <= assets` always (the cut can never be negative).
- `net` is monotonically non-increasing in `reserveFactorWad` for fixed `assets`.
- The revert is reachable *only* through the intended `net == 0` path for in-range `rf`.

### Evidence that would make this meaningful

- A fuzz run over `[0, 1e18)` that is green, **plus** explicit separate cases for
  `1e18 - 1`, `1e18`, `1e18 + 1` with their distinct outcomes recorded.
- The fuzzer surfacing the truncation-DoS region (`rf` near `1e18`) as a liveness failure,
  not a green run — if the fuzz test only asserts "reverts are fine", it will pass while
  the pool is bricked, so the redemption-liveness property must be asserted for the
  amounts the pool actually expects.
- **A setter bound added and tested**: reject `rf >= 1e18` outright, and pick a policy
  maximum well below it (a real reserve factor is single-digit percent). Governance being
  able to set a value that permanently disables redemption is a finding in itself, and no
  amount of testing around it substitutes for the bound.
- Access control on the setter exercised: a non-governance caller reverts.

Reading the code, spotting the `1e18` case, and writing one regression test for it is
**not** this search. That confirms what you already believed and stops at the first defect
you happened to imagine; the fuzzer finds the value nobody proposed.

---

## 2. Repayment accounting — one operation cannot demonstrate accumulation

The plan does one deposit, one repayment, observes a mismatch, and calls that proof of
accumulation. **It is not.** One post-operation mismatch proves divergence at a single
point. A constant off-by-one offset applied once and a gap that grows without bound
produce the identical observation after one operation; the plan cannot distinguish them,
so it has not established the claim it is making.

Note also which direction this bug runs: the protocol cut **stays in the pool** while
`accountedAssets` is reduced by the **gross** repayment. That leaves *more* assets held
than accounted for — a **surplus**, value stranded rather than lost.

### The invariant must be an equality

This matters for the shape of the assertion. A one-sided bound such as

```solidity
assertLe(pool.accountedAssets(), asset.balanceOf(address(pool)));  // WRONG SHAPE HERE
```

fires on a shortfall and stays **green through every surplus** — which is exactly this
bug. It would run forever, cover every line, and never see the defect. The property has
to be an equality or an explicit no-drift check:

```solidity
function invariant_accountingMatchesCustody() public {
    assertEq(
        pool.accountedAssets() + pool.protocolReserves(),
        asset.balanceOf(address(pool))
    );
}
```

If retained cuts are meant to live outside `accountedAssets`, then they must be tracked in
a named reserves variable that appears on the left-hand side. If they are not tracked
anywhere, the equality cannot be written — and that inability *is* the bug.

### Required experiment

A handler-driven invariant run:

- `targetContract` points at a **handler**, never at the pool. Aimed at the pool directly,
  the fuzzer supplies random senders holding no tokens and granting no approvals; nearly
  every call reverts, reverts are discarded rather than failing, and the invariant is then
  asserted against a contract that never left its initial state — green because nothing
  happened.
- The handler owns setup: funded and approved actors, several of them (the property is
  about interaction), inputs bounded to valid ranges with `bound()`, and handler actions
  covering `deposit`, `borrow`, `repay`, `redeem`, and `setReserveFactorWad`.
- Set `fail_on_revert = true` while building the handler, then **read the calls/reverts
  statistics on every run**. A revert rate near 100% means the run proved nothing.

### Evidence that would make this meaningful

Either of:

1. **A counterexample sequence** from the invariant run whose calls demonstrate growth —
   the shrunk sequence showing the gap after repayment *n* strictly exceeding the gap
   after repayment *n-1*; or
2. **A minimum of two fee-bearing repayments** in a directed test, recording the gap after
   each, asserting `gap2 > gap1` and ideally `gap_n ≈ n * cut`. Two *repayments* — setup
   followed by one repayment is the one-operation case again wearing a longer test.

Plus a post-fix run of the same invariant over a substantially longer sequence
(high `runs`/`depth`) coming back green with a low revert rate. The green run only counts
once you have seen the revert statistics that prove the sequences reached real states.

---

## 3. Liquidation — fork against the real deployment, pinned

Both the Chainlink feed and the collateral token are standard-behaviour mocks. A mock
encodes your assumption about the dependency, so more mock-based tests only re-test the
assumption; the mock answers in the standard shape every time and can never surface a
mismatch. "The production addresses are known but no test has called them" is the exact
condition that requires a fork. This contract reads an oracle *and* transfers a deployed
token — both triggers, independently.

### Required experiment

```solidity
function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000); // pin the block
}
```

**Pin the block.** An unpinned fork follows the chain head: live prices and collateral
balances move between runs, assertions drift red and flake green on re-run, and the local
RPC cache never hits — which becomes slow runs and provider 429s.

**Confirm archive depth before pinning.** Pinning an old block is an archive request. A
full node keeps only recent state (geth's default window is roughly the last 128 blocks)
and answers anything older with an error rather than a wrong number. Whether an endpoint
serves archive depth is a property of the node and the plan behind it, not something the
URL tells you — issue a historical `eth_call` at your chosen block against the actual
endpoint and confirm it answers before committing the pin, or the suite fails for reasons
that have nothing to do with the contract.

Take the production addresses from a verified source and check them against the chain in
`setUp` (assert the feed's `description()` / `decimals()` and the token's `symbol()` at the
pinned block) rather than pasting from memory.

### What the fork is specifically there to catch

**Chainlink feed:**
- `decimals()` is typically **8**, not 18. A mock returning 18 hides every scaling error in
  the collateral valuation — the single most common source of liquidation mispricing.
- `latestRoundData` returns `int256`; real feeds can return zero or, on some feeds,
  negative. Staleness (`updatedAt` older than the heartbeat) and incomplete rounds
  (`answeredInRound < roundId`) must be handled, and a mock never produces them.
- Circuit breakers: a feed clamped at its `minAnswer`/`maxAnswer` reports a price that is
  wrong but well-formed. Exercise a stale read by `vm.warp`-ing past the heartbeat on the
  fork and assert the contract refuses to liquidate rather than liquidating at a stale price.

**Collateral token:**
- Non-standard `transfer` return: USDT-style tokens return nothing, reverting any call
  made through a plain `IERC20` interface. A standard mock returns `true` and passes.
- Fee-on-transfer and rebasing tokens: less arrives than was sent, or the balance moves on
  its own. Assert against **measured balance deltas** on the fork, not the amount passed in.
- Decimals other than 18 (USDC/USDT at 6), and blocklists that make a transfer to a
  specific address revert.

### Evidence that would make this meaningful

A liquidation executed end to end at a pinned block against the real feed and the real
token, asserting the seized amount computed from the feed's **actual** price and decimals
at that block against balance deltas measured on both sides — with the pin, the RPC
endpoint's confirmed archive depth, and the block number committed to the repo so the run
is reproducible byte for byte by anyone who checks out the branch. Ideally two pins: one
ordinary block and one at a period of sharp price movement.

---

## Remaining gates before sign-off

- [ ] Audit the existing suite for tests that assert the implementation back to itself —
      stored state checked against the value just written, a getter against the variable it
      returns, constructor state against the constructor argument. These execute every line
      and constrain nothing, and a suite at 100% coverage is where they hide. Rewrite them
      as properties (round-trips, conservation, monotonicity, access boundaries).
- [ ] Access-control, zero-amount, and max-value cases revert as intended on every external
      entry point, not just the setter.
- [ ] `slither .` run, with no high or medium finding left unaddressed.

**Summary:** the three findings above are not a list of tests to add on top of a suite that
is otherwise doing its job — they are the three searches the suite has never run. Until the
fuzz run, the handler-driven equality invariant, and the pinned fork all exist and report
meaningful statistics, the only thing established is that the cases someone already thought
of behave as they thought.

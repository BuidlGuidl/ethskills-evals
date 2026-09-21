# The unpinned fork

## One cause, four symptoms

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` with no second argument
pins nothing. Foundry resolves the fork to whatever block the provider calls
`latest` at the moment `setUp` runs. Every CI run — every *re-run* of the same
commit — therefore executes against a different chain state. The suite has no
fixed input, so it is not a test of your code; it is a test of your code plus
mainnet as it happens to be at 09:14 this morning.

All four symptoms fall out of that one fact.

**The sudden reds.** The three failing tests are exactly the ones that assert on
live values: a Chainlink answer and a Uniswap pool's reserves. Those move. An
assertion written against the price and the reserves that were true in May was
never asserting a property of your contract; it was recording a number that
mainnet happened to hold that week. For four months the number stayed inside
whatever tolerance the assertion allowed. This morning it didn't. Nothing in
your repo changed because the thing that changed was never in your repo. Note
also that Chainlink feeds update on deviation thresholds and heartbeats, so the
answer can sit still for a long time and then jump — which is precisely the
shape of "green for four months, then red all at once."

**The flakiness on re-run.** Consecutive runs land on different head blocks. If
the value is near the edge of the assertion's tolerance, which side of the edge
you land on is a coin flip decided by block timing and by which reserves the
last swap left behind. Same commit, same config, different answer. Re-running
until green is not fixing anything; it is sampling until the sample agrees.

**The slowdown.** Foundry caches fork data on disk under
`~/.foundry/cache/rpc/<chain>/<block>/`, keyed by block number. A pinned block
is fetched once and replayed from disk forever after. An unpinned fork asks for
a block number nobody has ever requested before, so the cache key is new every
single run and the hit rate is *zero* by construction. Every storage slot,
account and code blob is refetched over the network. Worse, the cache directory
grows without bound — a new block-keyed subtree per run — which is the "steadily
getting slower over four months" you observed. The suite was always doing full
network I/O; as the suite and the cache grew, that cost grew with it.

**The 429s.** Zero cache hits means the entire suite's state reads go to the
provider as live `eth_getStorageAt` / `eth_getBalance` / `eth_getCode` calls, on
every job, multiplied by however many PRs and re-runs are in flight. That is a
request volume that climbs with your test count and your merge rate, and last
week it crossed your free tier's rate limit. The 429s are not a provider
problem; they are the meter reading on the missing cache.

So: unpinned fork → nondeterministic state (reds, flakes) → cache key never
repeats (slowdown) → unbounded request volume (429s). One line, four symptoms.

## The fix

Pin the block.

```solidity
uint256 constant FORK_BLOCK = 19_000_000; // choose a real recent block

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
}
```

Commit the constant. Do not read it from an env var with no default — a value
that can differ between your machine and CI reintroduces the whole problem in a
quieter form. If you want it overridable for a deliberate "does this still work
against today's mainnet?" job, give it a hardcoded default and treat the
override as a separate, non-blocking CI job.

That one change makes the state input to every run identical, which:

- makes the Chainlink answer and the pool reserves *fixed values*, so the
  assertions become reproducible;
- makes the cache key stable, so the first run populates
  `~/.foundry/cache/rpc/mainnet/<FORK_BLOCK>/` and every later run is served
  from disk;
- collapses request volume to near zero after that first run, which removes the
  429s.

Two things to do alongside it:

1. **Cache the fork data in CI.** Add `~/.foundry/cache/rpc` to your CI cache
   (keyed on the block number, so bumping `FORK_BLOCK` invalidates it). Without
   this, every CI job starts cold and refetches — correct and deterministic, but
   still hitting the provider hard enough to draw 429s. With it, the steady state
   is a cache restore and no RPC traffic at all.

2. **Re-derive the expected values at `FORK_BLOCK`, and fix what the assertions
   are actually asserting.** Pinning makes the old numbers wrong (they came from
   a different block) and, more importantly, pinning alone does not make a bad
   assertion good. `assertEq(price, 3421_00000000)` at a pinned block is a test
   that asserts a constant back to itself — it exercises the integration and
   constrains nothing about your contract. Prefer properties that survive a
   block bump: the feed is not stale (`updatedAt` within the heartbeat),
   `answer > 0` and within a sane band, `answeredInRound >= roundId`, your
   conversion round-trips, your quote matches the pool's own `getAmountOut`,
   `x * y >= k` across your interaction. Reserve exact-value assertions for the
   places where the exact value is genuinely the thing under test.

Bumping `FORK_BLOCK` then becomes a deliberate, reviewed change — which is what
you want: "we now test against a newer mainnet" should be a diff, not a Tuesday.

## Does this work against a free-tier endpoint?

**Plainly: it depends on one property of your endpoint, and it is not a property
you can read off the URL. You have to test it.**

Pinning a block that is not within the last ~128 blocks makes every state read
an **archive request**. A full (non-archive) node prunes historical state and
keeps only a short recent window — geth's default is roughly the last 128
blocks. Ask it for a storage slot at block 19,000,000 and it does not guess and
it does not return a stale value; it returns an error, typically `missing trie
node` or `required historical state unavailable`. Your tests would then fail for
a reason that has nothing to do with your contract.

So the fix requires **archive-depth `eth_call` / `eth_getStorageAt` at your
chosen block**. Whether a free tier provides it varies by provider and by plan,
and it is a property of the node and the plan behind it. Some free tiers serve
full archive; some serve a limited recent window; some serve archive but count
those calls at a higher rate weight against your quota.

### How to tell, before you commit the constant

Ask the endpoint directly. Pick your candidate block and make a historical
`eth_call` — here, reading a Uniswap V2 pair's `getReserves()` (selector
`0x0902f1ac`):

```bash
curl -s "$MAINNET_RPC_URL" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[
        {"to":"0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc","data":"0x0902f1ac"},
        "0x121EAC0"]}'
```

(`0x121EAC0` is 19,000,000. `0xB4e1…C9Dc` is the USDC/WETH V2 pair — substitute
any contract that existed at that block.)

- **A `result` with non-zero data** → the endpoint serves archive at that depth.
  Pin and move on.
- **An `error` mentioning `missing trie node`, `required historical state
  unavailable`, `state not available`, or similar** → no archive depth at that
  block.
- **HTTP 401/403 or a "not available on your plan" message** → archive is gated
  behind a paid tier.

Compare against the same call at `"latest"` to be sure you are distinguishing
"no archive" from "endpoint broken / wrong address".

Also sanity-check the *far* end: call it again at a block a few hours old and at
a block from last year. Some plans serve a bounded window (e.g. 128 blocks, or
the last N days) rather than all-or-nothing, and you want to know where your
chosen block sits relative to that edge.

### If it turns out you do not have archive depth

Ranked, best first:

1. **Get an archive endpoint.** A free archive tier from a provider that offers
   one, or a paid tier. This is the real fix and it is usually cheap at your
   volume — remember that after the first run you are serving from local cache,
   so archive requests are a one-time cost per block bump, not per run.
2. **Pin to a recent block and refresh it deliberately.** A block inside the
   node's retention window is served by a full node. This still gives you
   determinism between runs; you just have to bump the constant when it ages out,
   and you get no benefit from a long-lived CI cache. It is a real downgrade, but
   it is strictly better than unpinned.
3. **Commit the cache.** Once a machine with archive access has populated
   `~/.foundry/cache/rpc/mainnet/<FORK_BLOCK>/`, that data is just JSON. Vendoring
   it (or publishing it as a CI cache artifact) lets a non-archive CI runner
   execute the pinned fork with no archive calls at all. Awkward to maintain, but
   it works, and it is the standard escape hatch when CI's network access is more
   constrained than a developer's.

What you should *not* do is leave the fork unpinned because archive access is
inconvenient. Unpinned is not "testing against fresher data"; it is a suite whose
pass/fail is decided by strangers' swaps.

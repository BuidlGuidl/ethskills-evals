# Executor transcript — 2026-09-13T152558Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-testing-patched-20260913/2026-09-13T152558Z-codex-with-skill-2/testing-quiz-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-testing-patched-20260913/2026-09-13T152558Z-codex-with-skill-2/testing-quiz-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a09b71-4054-7572-b6e0-13a444701241
--------
user
Our vault has an invariant test suite. foundry.toml sets `[invariant] runs = 512,
depth = 50`, so a run is 512 sequences and about 25,600 calls. It has been green
on every commit for months.

We shipped, and a user drained the vault with a sequence of ordinary deposit and
withdraw calls — no flash loan, no exotic cheat, nothing our invariant doesn't
cover. The drain does violate the invariant: we replayed the user's transactions
against the assertion by hand and it fires.

Here is the whole test:

    contract VaultInvariantTest is Test {
        MyVault vault;
        MockERC20 token;

        function setUp() public {
            token = new MockERC20();
            vault = new MyVault(token);
            targetContract(address(vault));
        }

        function invariant_SolvencyHolds() public view {
            assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
        }
    }

The assertion itself is right — it is the property we want and the drain breaks it.
So explain what those 25,600 calls were actually doing, why none of them ever put the
vault in a state where the assertion could fail, and what we should have been looking
at in the run output that would have told us this months ago. Then give the change
that makes this suite capable of finding that sequence.

Write your answer to answer.md in this directory.

codex
I’m using the Foundry testing skill here because the question hinges on invariant target selection and interpreting run metrics. I’ll inspect its guidance, then write the diagnosis and concrete fix into `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152558Z-codex-with-skill-2/testing-quiz-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: testing
description: Use when writing or reviewing Foundry tests, when deciding whether a suite is enough to deploy, or when a green run or a coverage percentage is offered as evidence that a contract is safe. Covers fuzz, fork and invariant testing with `forge`. Finding and evidencing defects by running tests is in scope; auditing source by reading it belongs to `security` and `audit`.
---

# Smart Contract Testing

A green suite and 100% coverage are not evidence of safety. Coverage records which lines ran, never whether an assertion could have failed. Before signing off, name which of the three searches below the suite actually performed. If the answer is none, it has only confirmed the cases someone already thought of.

For deployment sign-off, map each applicable risk to a search before concluding: configurable value math to fuzzing, stateful accounting to a handler invariant, and external integrations to a pinned fork. Run each applicable search. Inspection and targeted regression tests can confirm a suspected defect, but do not replace the search.

## Make tests capable of failing

Rewrite any test that mirrors the implementation: stored state asserted against the value just written to it, a getter against the variable it returns, a constant against itself, constructor state against the constructor argument. These execute every line and constrain nothing.

Assert properties instead — round-trips, conservation between accounting and custody, monotonicity, access boundaries. Skip anything whose failure would be a bug in the compiler or in a dependency you did not write.

A bug that accumulates across a sequence cannot be seen by any test that exercises one operation in isolation, however many such tests exist. "Every operation is correct on its own" is the symptom, not the defence.

## Fuzz the domain instead of picking from it

Before deploy, every owner-settable number that feeds value math — fee basis points, ratios, caps, exchange rates — needs a fuzz test over its whole accepted domain, using `bound()` rather than `vm.assume()`. Hand-picked values walk one branch; the fuzzer finds the value nobody proposed.

Reaching a suspected bug by reading the code and then writing one test for it confirms what you already believed. It is not a substitute for the search, and it stops at the first defect you happened to imagine.

For an integer boundary `b`, exercise `b - 1`, `b`, and `b + 1` where representable. Treat the exact boundary and the first value beyond it as separate cases and preserve evidence for each distinct failure.

## Fork against the real deployment

Always fork for a contract that calls an external protocol (Uniswap, Aave, Chainlink; verified addresses in `addresses/SKILL.md`), handles a quirky token (USDT, fee-on-transfer, rebasing), or reads an oracle. Never for pure logic.

A mock encodes your assumption about the dependency, so more mock-based tests only re-test the assumption. Deployed tokens deviate from the interface they are called through — in what a call returns, in how much of a transfer arrives, in whether a balance stays put — and a mock written to the standard answers in the standard shape every time, so it can never surface the mismatch.

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
```

Pin the block. An unpinned fork follows the chain head, so live prices and reserves move between runs: assertions drift red, flake green on re-run, and the local RPC cache never hits, which grows into slow runs and provider 429s.

Pinning an old block is an archive request. A full node keeps only recent state — geth's default window is roughly the last 128 blocks — and answers anything older with an error rather than a wrong number. Whether an endpoint serves archive depth is a property of the node and the plan behind it, not something a URL tells you: confirm it answers a historical `eth_call` at your block before pinning that block, or the tests fail for a reason that has nothing to do with the contract.

## Invariant-test anything stateful

A vault, AMM, lending market or escrow does not ship on unit tests. State properties as equalities that must hold after any sequence: recorded assets equal assets actually held, total supply equals the sum of balances, `x * y >= k`.

Match the shape of the assertion to the failures it has to catch. A one-sided bound constrains one direction only — `claims <= holdings` fires on a shortfall and stays green through anything that leaves a surplus — so where value can be stranded as well as lost, the property has to be an equality or an explicit no-drift check.

One post-operation mismatch proves divergence, not accumulation. When claiming cumulative drift, show the gap after at least two state transitions, or provide a stateful-invariant counterexample whose call sequence demonstrates the growth.

Point `targetContract` at a handler, never at the contract under test. Called directly, the fuzzer supplies random senders that hold no tokens and granted no approvals, so nearly every call reverts. Reverts are discarded rather than failing the run, and the invariant is then asserted against a contract that never left its initial state — green because nothing happened.

The handler owns setup: funded and approved actors, inputs bounded to valid ranges, multiple actors where the property is about interaction between them.

Read the calls/reverts statistics in the run output every time. A revert rate near 100% means the run proved nothing; set `fail_on_revert = true` to surface it while building the handler.

## Before deploy

- [ ] No test asserts the implementation back to itself.
- [ ] Every owner-settable number feeding value math is fuzzed across its domain, both sides of each bound included.
- [ ] Every external integration and quirky token is exercised on a pinned fork against the real deployment, on an endpoint confirmed to serve that block.
- [ ] Stateful contracts have a handler-driven invariant tying accounting to custody, with a revert rate low enough that the sequences reached real states.
- [ ] Access control, zero, and max-value cases revert as intended.

codex
The issue is the action generator, not the assertion or the configured depth: direct targeting gave Foundry many attempted calls but almost no valid economic transitions. I’m writing the answer around the key evidence—call/revert counts—and a handler-based target that establishes balances, approvals, and valid bounds.
apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152558Z-codex-with-skill-2/testing-quiz-001/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..fa173d04f70be1cde34238b6990d4dc2fe766532
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,89 @@
+# Why the invariant stayed green
+
+`runs = 512` and `depth = 50` means that Foundry attempted up to 512 sequences of 50 generated calls. It does **not** mean the vault completed 25,600 meaningful deposit or withdrawal operations.
+
+`targetContract(address(vault))` tells the invariant engine to call the vault's public/external functions directly, with arbitrary calldata and arbitrary callers. Those callers were not prepared as vault users: they generally had no tokens, had not approved the vault, had no deposit/share balance, and received unbounded withdrawal amounts. Consequently, the economically interesting calls reverted—for insufficient balance, insufficient allowance, zero holdings, invalid amounts, and similar preconditions.
+
+By default, a reverted action is discarded and the campaign continues. It does not make the invariant test fail. The invariant was therefore checked repeatedly against the initial state, or against only the small subset of trivial calls that happened to succeed. In that state both custody and accounting were zero (or otherwise unchanged), so
+
+```solidity
+token.balanceOf(address(vault)) >= vault.totalDeposits()
+```
+
+was necessarily true. Increasing `runs` or `depth` only produced more invalid attempts; it did not make valid state transitions more likely in a useful way.
+
+The warning was in Foundry's invariant-run summary: the per-selector call and revert counts. `deposit` and `withdraw` would have shown a revert rate at or near 100%, with few or no successful calls. Those statistics describe the search far better than the nominal `runs * depth` number. While developing the campaign, setting this also makes the problem impossible to overlook:
+
+```toml
+[invariant]
+runs = 512
+depth = 50
+fail_on_revert = true
+```
+
+`fail_on_revert` is a diagnostic guardrail, not the ultimate fix. The fix is to target a handler that constructs valid actions and calls the vault from funded, approved actors. For example (with names adjusted to the vault's actual deposit/share API):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault public immutable vault;
+    MockERC20 public immutable token;
+
+    address[] internal actors;
+
+    constructor(MyVault _vault, MockERC20 _token) {
+        vault = _vault;
+        token = _token;
+
+        actors.push(address(0xA11CE));
+        actors.push(address(0xB0B));
+
+        for (uint256 i; i < actors.length; ++i) {
+            token.mint(actors[i], 1_000_000 ether);
+            vm.prank(actors[i]);
+            token.approve(address(vault), type(uint256).max);
+        }
+    }
+
+    function deposit(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        amount = bound(amount, 1, token.balanceOf(actor));
+
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        uint256 available = vault.balanceOf(actor); // or the vault's claim/deposit getter
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount);
+    }
+}
+```
+
+Then target that handler, not the vault:
+
+```solidity
+contract VaultInvariantTest is Test {
+    MyVault vault;
+    MockERC20 token;
+    VaultHandler handler;
+
+    function setUp() public {
+        token = new MockERC20();
+        vault = new MyVault(token);
+        handler = new VaultHandler(vault, token);
+
+        targetContract(address(handler));
+    }
+
+    function invariant_SolvencyHolds() public view {
+        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
+    }
+}
+```
+
+If the drained sequence depends on more than one user's interactions, the handler must retain multiple actors, as above, and select among them. If it depends on exact deposit/withdraw semantics (assets versus shares, caps, minimums, cooldowns, and so on), each handler action must bound inputs against those real preconditions. The success criterion is visible in the next run's output: substantial successful `deposit` and `withdraw` counts and a low, understood revert rate. At that point the 512 sequences are searches through reachable vault states, rather than 512 repetitions of the unchanged initial state.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..fa173d04f70be1cde34238b6990d4dc2fe766532
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,89 @@
+# Why the invariant stayed green
+
+`runs = 512` and `depth = 50` means that Foundry attempted up to 512 sequences of 50 generated calls. It does **not** mean the vault completed 25,600 meaningful deposit or withdrawal operations.
+
+`targetContract(address(vault))` tells the invariant engine to call the vault's public/external functions directly, with arbitrary calldata and arbitrary callers. Those callers were not prepared as vault users: they generally had no tokens, had not approved the vault, had no deposit/share balance, and received unbounded withdrawal amounts. Consequently, the economically interesting calls reverted—for insufficient balance, insufficient allowance, zero holdings, invalid amounts, and similar preconditions.
+
+By default, a reverted action is discarded and the campaign continues. It does not make the invariant test fail. The invariant was therefore checked repeatedly against the initial state, or against only the small subset of trivial calls that happened to succeed. In that state both custody and accounting were zero (or otherwise unchanged), so
+
+```solidity
+token.balanceOf(address(vault)) >= vault.totalDeposits()
+```
+
+was necessarily true. Increasing `runs` or `depth` only produced more invalid attempts; it did not make valid state transitions more likely in a useful way.
+
+The warning was in Foundry's invariant-run summary: the per-selector call and revert counts. `deposit` and `withdraw` would have shown a revert rate at or near 100%, with few or no successful calls. Those statistics describe the search far better than the nominal `runs * depth` number. While developing the campaign, setting this also makes the problem impossible to overlook:
+
+```toml
+[invariant]
+runs = 512
+depth = 50
+fail_on_revert = true
+```
+
+`fail_on_revert` is a diagnostic guardrail, not the ultimate fix. The fix is to target a handler that constructs valid actions and calls the vault from funded, approved actors. For example (with names adjusted to the vault's actual deposit/share API):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault public immutable vault;
+    MockERC20 public immutable token;
+
+    address[] internal actors;
+
+    constructor(MyVault _vault, MockERC20 _token) {
+        vault = _vault;
+        token = _token;
+
+        actors.push(address(0xA11CE));
+        actors.push(address(0xB0B));
+
+        for (uint256 i; i < actors.length; ++i) {
+            token.mint(actors[i], 1_000_000 ether);
+            vm.prank(actors[i]);
+            token.approve(address(vault), type(uint256).max);
+        }
+    }
+
+    function deposit(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        amount = bound(amount, 1, token.balanceOf(actor));
+
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        uint256 available = vault.balanceOf(actor); // or the vault's claim/deposit getter
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount);
+    }
+}
+```
+
+Then target that handler, not the vault:
+
+```solidity
+contract VaultInvariantTest is Test {
+    MyVault vault;
+    MockERC20 token;
+    VaultHandler handler;
+
+    function setUp() public {
+        token = new MockERC20();
+        vault = new MyVault(token);
+        handler = new VaultHandler(vault, token);
+
+        targetContract(address(handler));
+    }
+
+    function invariant_SolvencyHolds() public view {
+        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
+    }
+}
+```
+
+If the drained sequence depends on more than one user's interactions, the handler must retain multiple actors, as above, and select among them. If it depends on exact deposit/withdraw semantics (assets versus shares, caps, minimums, cooldowns, and so on), each handler action must bound inputs against those real preconditions. The success criterion is visible in the next run's output: substantial successful `deposit` and `withdraw` counts and a low, understood revert rate. At that point the 512 sequences are searches through reachable vault states, rather than 512 repetitions of the unchanged initial state.

exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152558Z-codex-with-skill-2/testing-quiz-001
 succeeded in 0ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..fa173d04f70be1cde34238b6990d4dc2fe766532
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,89 @@
+# Why the invariant stayed green
+
+`runs = 512` and `depth = 50` means that Foundry attempted up to 512 sequences of 50 generated calls. It does **not** mean the vault completed 25,600 meaningful deposit or withdrawal operations.
+
+`targetContract(address(vault))` tells the invariant engine to call the vault's public/external functions directly, with arbitrary calldata and arbitrary callers. Those callers were not prepared as vault users: they generally had no tokens, had not approved the vault, had no deposit/share balance, and received unbounded withdrawal amounts. Consequently, the economically interesting calls reverted—for insufficient balance, insufficient allowance, zero holdings, invalid amounts, and similar preconditions.
+
+By default, a reverted action is discarded and the campaign continues. It does not make the invariant test fail. The invariant was therefore checked repeatedly against the initial state, or against only the small subset of trivial calls that happened to succeed. In that state both custody and accounting were zero (or otherwise unchanged), so
+
+```solidity
+token.balanceOf(address(vault)) >= vault.totalDeposits()
+```
+
+was necessarily true. Increasing `runs` or `depth` only produced more invalid attempts; it did not make valid state transitions more likely in a useful way.
+
+The warning was in Foundry's invariant-run summary: the per-selector call and revert counts. `deposit` and `withdraw` would have shown a revert rate at or near 100%, with few or no successful calls. Those statistics describe the search far better than the nominal `runs * depth` number. While developing the campaign, setting this also makes the problem impossible to overlook:
+
+```toml
+[invariant]
+runs = 512
+depth = 50
+fail_on_revert = true
+```
+
+`fail_on_revert` is a diagnostic guardrail, not the ultimate fix. The fix is to target a handler that constructs valid actions and calls the vault from funded, approved actors. For example (with names adjusted to the vault's actual deposit/share API):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault public immutable vault;
+    MockERC20 public immutable token;
+
+    address[] internal actors;
+
+    constructor(MyVault _vault, MockERC20 _token) {
+        vault = _vault;
+        token = _token;
+
+        actors.push(address(0xA11CE));
+        actors.push(address(0xB0B));
+
+        for (uint256 i; i < actors.length; ++i) {
+            token.mint(actors[i], 1_000_000 ether);
+            vm.prank(actors[i]);
+            token.approve(address(vault), type(uint256).max);
+        }
+    }
+
+    function deposit(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        amount = bound(amount, 1, token.balanceOf(actor));
+
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        uint256 available = vault.balanceOf(actor); // or the vault's claim/deposit getter
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount);
+    }
+}
+```
+
+Then target that handler, not the vault:
+
+```solidity
+contract VaultInvariantTest is Test {
+    MyVault vault;
+    MockERC20 token;
+    VaultHandler handler;
+
+    function setUp() public {
+        token = new MockERC20();
+        vault = new MyVault(token);
+        handler = new VaultHandler(vault, token);
+
+        targetContract(address(handler));
+    }
+
+    function invariant_SolvencyHolds() public view {
+        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
+    }
+}
+```
+
+If the drained sequence depends on more than one user's interactions, the handler must retain multiple actors, as above, and select among them. If it depends on exact deposit/withdraw semantics (assets versus shares, caps, minimums, cooldowns, and so on), each handler action must bound inputs against those real preconditions. The success criterion is visible in the next run's output: substantial successful `deposit` and `withdraw` counts and a low, understood revert rate. At that point the 512 sequences are searches through reachable vault states, rather than 512 repetitions of the unchanged initial state.

codex
Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152558Z-codex-with-skill-2/testing-quiz-001/answer.md) with the diagnosis, relevant Foundry run statistics, and a handler-based invariant test fix.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..fa173d04f70be1cde34238b6990d4dc2fe766532
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,89 @@
+# Why the invariant stayed green
+
+`runs = 512` and `depth = 50` means that Foundry attempted up to 512 sequences of 50 generated calls. It does **not** mean the vault completed 25,600 meaningful deposit or withdrawal operations.
+
+`targetContract(address(vault))` tells the invariant engine to call the vault's public/external functions directly, with arbitrary calldata and arbitrary callers. Those callers were not prepared as vault users: they generally had no tokens, had not approved the vault, had no deposit/share balance, and received unbounded withdrawal amounts. Consequently, the economically interesting calls reverted—for insufficient balance, insufficient allowance, zero holdings, invalid amounts, and similar preconditions.
+
+By default, a reverted action is discarded and the campaign continues. It does not make the invariant test fail. The invariant was therefore checked repeatedly against the initial state, or against only the small subset of trivial calls that happened to succeed. In that state both custody and accounting were zero (or otherwise unchanged), so
+
+```solidity
+token.balanceOf(address(vault)) >= vault.totalDeposits()
+```
+
+was necessarily true. Increasing `runs` or `depth` only produced more invalid attempts; it did not make valid state transitions more likely in a useful way.
+
+The warning was in Foundry's invariant-run summary: the per-selector call and revert counts. `deposit` and `withdraw` would have shown a revert rate at or near 100%, with few or no successful calls. Those statistics describe the search far better than the nominal `runs * depth` number. While developing the campaign, setting this also makes the problem impossible to overlook:
+
+```toml
+[invariant]
+runs = 512
+depth = 50
+fail_on_revert = true
+```
+
+`fail_on_revert` is a diagnostic guardrail, not the ultimate fix. The fix is to target a handler that constructs valid actions and calls the vault from funded, approved actors. For example (with names adjusted to the vault's actual deposit/share API):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault public immutable vault;
+    MockERC20 public immutable token;
+
+    address[] internal actors;
+
+    constructor(MyVault _vault, MockERC20 _token) {
+        vault = _vault;
+        token = _token;
+
+        actors.push(address(0xA11CE));
+        actors.push(address(0xB0B));
+
+        for (uint256 i; i < actors.length; ++i) {
+            token.mint(actors[i], 1_000_000 ether);
+            vm.prank(actors[i]);
+            token.approve(address(vault), type(uint256).max);
+        }
+    }
+
+    function deposit(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        amount = bound(amount, 1, token.balanceOf(actor));
+
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        uint256 available = vault.balanceOf(actor); // or the vault's claim/deposit getter
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount);
+    }
+}
+```
+
+Then target that handler, not the vault:
+
+```solidity
+contract VaultInvariantTest is Test {
+    MyVault vault;
+    MockERC20 token;
+    VaultHandler handler;
+
+    function setUp() public {
+        token = new MockERC20();
+        vault = new MyVault(token);
+        handler = new VaultHandler(vault, token);
+
+        targetContract(address(handler));
+    }
+
+    function invariant_SolvencyHolds() public view {
+        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
+    }
+}
+```
+
+If the drained sequence depends on more than one user's interactions, the handler must retain multiple actors, as above, and select among them. If it depends on exact deposit/withdraw semantics (assets versus shares, caps, minimums, cooldowns, and so on), each handler action must bound inputs against those real preconditions. The success criterion is visible in the next run's output: substantial successful `deposit` and `withdraw` counts and a low, understood revert rate. At that point the 512 sequences are searches through reachable vault states, rather than 512 repetitions of the unchanged initial state.

tokens used
10,622
````

## final message

Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152558Z-codex-with-skill-2/testing-quiz-001/answer.md) with the diagnosis, relevant Foundry run statistics, and a handler-based invariant test fix.

# Executor transcript — 2026-09-14T192822Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192822Z-codex-with-skill-2/testing-quiz-001

## session

````text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192822Z-codex-with-skill-2/testing-quiz-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a165-22ad-7221-8bf2-34832c6808be
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
I’m using the Foundry testing skill because this is specifically about invariant-test execution and interpreting a misleading green run. I’ll inspect its instructions, then write the diagnosis and fix to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192822Z-codex-with-skill-2/testing-quiz-001
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

First decide which values at a boundary are semantically usable; do not assume the exact limit is valid merely because only values beyond it violate a numeric inequality. Exercise the nearest valid value, the exact limit, and the first value beyond it where representable. Preserve separate evidence when the exact limit and the value beyond it fail through different paths.

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

One post-operation mismatch proves divergence, not accumulation. When claiming cumulative drift, show the gap after at least two operations capable of creating that drift — for example, two fee-bearing withdrawals, not setup followed by one withdrawal — or provide a stateful-invariant counterexample whose call sequence demonstrates the growth.

Point `targetContract` at a handler, never at the contract under test. Called directly, the fuzzer supplies random senders that hold no tokens and granted no approvals, so nearly every call reverts. Reverts are discarded rather than failing the run, and the invariant is then asserted against a contract that never left its initial state — green because nothing happened.

The handler owns setup: funded and approved actors, inputs bounded to valid ranges, multiple actors where the property is about interaction between them.

Read the calls/reverts statistics in the run output every time. A revert rate near 100% means the run proved nothing; set `fail_on_revert = true` to surface it while building the handler.

## Before deploy

- [ ] No test asserts the implementation back to itself.
- [ ] Every owner-settable number feeding value math is fuzzed across its domain; each boundary's nearest valid value, exact limit, and first value beyond it are classified and exercised separately where representable.
- [ ] Every external integration and quirky token is exercised on a pinned fork against the real deployment, on an endpoint confirmed to serve that block.
- [ ] Stateful contracts have a handler-driven invariant tying accounting to custody, with a revert rate low enough that the sequences reached real states.
- [ ] Access control, zero, and max-value cases revert as intended.
- [ ] `slither .` run, with no high or medium finding left unaddressed.

codex
The core issue is already clear: the configured depth measured attempted calls, not successful state transitions. I’m writing the answer around the missing handler, the near-total revert signal, and a concrete handler pattern with funded/approved actors and bounded inputs.
2026-09-14T19:29:49.731543Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 20, 'depth = 50' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192822Z-codex-with-skill-2/testing-quiz-001/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9de2b2d4b983ea5e552135fbf2caef4bf2ce21d0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,85 @@
+# Why the invariant stayed green
+
+`runs = 512` and `depth = 50` means that Foundry generated 512 sequences of up to 50 **attempted calls** each. It does not mean that the vault underwent 25,600 useful state transitions.
+
+`targetContract(address(vault))` made Foundry call the vault directly with fuzzed calldata, arguments, and callers. Those callers had not been given tokens, had not approved the vault, and usually did not have a deposit or shares to withdraw. Consequently, ordinary state-changing calls failed their normal preconditions:
+
+- deposits reverted because the caller had no tokens and/or allowance;
+- withdrawals reverted because the caller had no balance, shares, or recorded deposit;
+- other calls reverted because random arguments were unusable or the caller lacked a required role.
+
+By default, a reverted invariant action is discarded; it does not make the invariant test fail. Foundry then checked `invariant_SolvencyHolds` after sequences in which almost none of the attempted actions had changed the vault. Getters or harmless calls may have succeeded, but they did not construct the deposit/withdraw history needed to expose the bug. The assertion therefore kept checking the initial or another trivial state, where custody was at least the recorded deposits.
+
+The run output's invariant call metrics were the warning. In particular, the per-selector `calls` and `reverts` counts (and their totals) would have shown a revert rate near 100% for `deposit` and `withdraw`. A large `runs * depth` number is meaningless when almost all calls revert. During harness development, make this unmistakable with:
+
+```toml
+[invariant]
+runs = 512
+depth = 50
+fail_on_revert = true
+```
+
+`fail_on_revert` is a useful harness-debugging setting; the lasting requirement is to inspect the call/revert statistics and keep the actions' revert rate low.
+
+# The required change
+
+Target a handler, not the vault. The handler must create reachable actions: fund actors, approve the vault, select actors deliberately, and bound amounts according to their current balances or claims. For example (adjusting function and getter names to the actual vault):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault internal immutable vault;
+    MockERC20 internal immutable token;
+    address[] internal actors;
+
+    constructor(MyVault vault_, MockERC20 token_) {
+        vault = vault_;
+        token = token_;
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
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+
+        // Replace this with the vault's actual per-user claim/share getter.
+        uint256 available = vault.balanceOf(actor);
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount);
+    }
+}
+
+contract VaultInvariantTest is Test {
+    MyVault vault;
+    MockERC20 token;
+    VaultHandler handler;
+
+    function setUp() public {
+        token = new MockERC20();
+        vault = new MyVault(token);
+        handler = new VaultHandler(vault, token);
+        targetContract(address(handler));
+    }
+
+    function invariant_SolvencyHolds() public view {
+        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
+    }
+}
+```
+
+If withdrawals are share-based, bound shares and call the share-based API; if they are asset/claim-based, bound against that claim. The essential change is that handler calls normally succeed and preserve state across the 50-call sequence. Foundry can then explore combinations of successful deposits and withdrawals—including the user's ordinary sequence—and the existing solvency assertion can finally encounter and report the bad state.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9de2b2d4b983ea5e552135fbf2caef4bf2ce21d0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,85 @@
+# Why the invariant stayed green
+
+`runs = 512` and `depth = 50` means that Foundry generated 512 sequences of up to 50 **attempted calls** each. It does not mean that the vault underwent 25,600 useful state transitions.
+
+`targetContract(address(vault))` made Foundry call the vault directly with fuzzed calldata, arguments, and callers. Those callers had not been given tokens, had not approved the vault, and usually did not have a deposit or shares to withdraw. Consequently, ordinary state-changing calls failed their normal preconditions:
+
+- deposits reverted because the caller had no tokens and/or allowance;
+- withdrawals reverted because the caller had no balance, shares, or recorded deposit;
+- other calls reverted because random arguments were unusable or the caller lacked a required role.
+
+By default, a reverted invariant action is discarded; it does not make the invariant test fail. Foundry then checked `invariant_SolvencyHolds` after sequences in which almost none of the attempted actions had changed the vault. Getters or harmless calls may have succeeded, but they did not construct the deposit/withdraw history needed to expose the bug. The assertion therefore kept checking the initial or another trivial state, where custody was at least the recorded deposits.
+
+The run output's invariant call metrics were the warning. In particular, the per-selector `calls` and `reverts` counts (and their totals) would have shown a revert rate near 100% for `deposit` and `withdraw`. A large `runs * depth` number is meaningless when almost all calls revert. During harness development, make this unmistakable with:
+
+```toml
+[invariant]
+runs = 512
+depth = 50
+fail_on_revert = true
+```
+
+`fail_on_revert` is a useful harness-debugging setting; the lasting requirement is to inspect the call/revert statistics and keep the actions' revert rate low.
+
+# The required change
+
+Target a handler, not the vault. The handler must create reachable actions: fund actors, approve the vault, select actors deliberately, and bound amounts according to their current balances or claims. For example (adjusting function and getter names to the actual vault):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault internal immutable vault;
+    MockERC20 internal immutable token;
+    address[] internal actors;
+
+    constructor(MyVault vault_, MockERC20 token_) {
+        vault = vault_;
+        token = token_;
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
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+
+        // Replace this with the vault's actual per-user claim/share getter.
+        uint256 available = vault.balanceOf(actor);
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount);
+    }
+}
+
+contract VaultInvariantTest is Test {
+    MyVault vault;
+    MockERC20 token;
+    VaultHandler handler;
+
+    function setUp() public {
+        token = new MockERC20();
+        vault = new MyVault(token);
+        handler = new VaultHandler(vault, token);
+        targetContract(address(handler));
+    }
+
+    function invariant_SolvencyHolds() public view {
+        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
+    }
+}
+```
+
+If withdrawals are share-based, bound shares and call the share-based API; if they are asset/claim-based, bound against that claim. The essential change is that handler calls normally succeed and preserve state across the 50-call sequence. Foundry can then explore combinations of successful deposits and withdrawals—including the user's ordinary sequence—and the existing solvency assertion can finally encounter and report the bad state.

exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192822Z-codex-with-skill-2/testing-quiz-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Why the invariant stayed green

`runs = 512` and `depth = 50` means that Foundry generated 512 sequences of up to 50 **attempted calls** each. It does not mean that the vault underwent 25,600 useful state transitions.

`targetContract(address(vault))` made Foundry call the vault directly with fuzzed calldata, arguments, and callers. Those callers had not been given tokens, had not approved the vault, and usually did not have a deposit or shares to withdraw. Consequently, ordinary state-changing calls failed their normal preconditions:

- deposits reverted because the caller had no tokens and/or allowance;
- withdrawals reverted because the caller had no balance, shares, or recorded deposit;
- other calls reverted because random arguments were unusable or the caller lacked a required role.

By default, a reverted invariant action is discarded; it does not make the invariant test fail. Foundry then checked `invariant_SolvencyHolds` after sequences in which almost none of the attempted actions had changed the vault. Getters or harmless calls may have succeeded, but they did not construct the deposit/withdraw history needed to expose the bug. The assertion therefore kept checking the initial or another trivial state, where custody was at least the recorded deposits.

The run output's invariant call metrics were the warning. In particular, the per-selector `calls` and `reverts` counts (and their totals) would have shown a revert rate near 100% for `deposit` and `withdraw`. A large `runs * depth` number is meaningless when almost all calls revert. During harness development, make this unmistakable with:

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
```

`fail_on_revert` is a useful harness-debugging setting; the lasting requirement is to inspect the call/revert statistics and keep the actions' revert rate low.

# The required change

Target a handler, not the vault. The handler must create reachable actions: fund actors, approve the vault, select actors deliberately, and bound amounts according to their current balances or claims. For example (adjusting function and getter names to the actual vault):

```solidity
contract VaultHandler is Test {
    MyVault internal immutable vault;
    MockERC20 internal immutable token;
    address[] internal actors;

    constructor(MyVault vault_, MockERC20 token_) {
        vault = vault_;
        token = token_;
        actors.push(address(0xA11CE));
        actors.push(address(0xB0B));

        for (uint256 i; i < actors.length; ++i) {
            token.mint(actors[i], 1_000_000 ether);
            vm.prank(actors[i]);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 1, token.balanceOf(actor));
        vm.prank(actor);
        vault.deposit(amount);
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];

        // Replace this with the vault's actual per-user claim/share getter.
        uint256 available = vault.balanceOf(actor);
        if (available == 0) return;
        amount = bound(amount, 1, available);

        vm.prank(actor);
        vault.withdraw(amount);
    }
}

contract VaultInvariantTest is Test {
    MyVault vault;
    MockERC20 token;
    VaultHandler handler;

    function setUp() public {
        token = new MockERC20();
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);
        targetContract(address(handler));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

If withdrawals are share-based, bound shares and call the share-based API; if they are asset/claim-based, bound against that claim. The essential change is that handler calls normally succeed and preserve state across the 50-call sequence. Foundry can then explore combinations of successful deposits and withdrawals—including the user's ordinary sequence—and the existing solvency assertion can finally encounter and report the bad state.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9de2b2d4b983ea5e552135fbf2caef4bf2ce21d0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,85 @@
+# Why the invariant stayed green
+
+`runs = 512` and `depth = 50` means that Foundry generated 512 sequences of up to 50 **attempted calls** each. It does not mean that the vault underwent 25,600 useful state transitions.
+
+`targetContract(address(vault))` made Foundry call the vault directly with fuzzed calldata, arguments, and callers. Those callers had not been given tokens, had not approved the vault, and usually did not have a deposit or shares to withdraw. Consequently, ordinary state-changing calls failed their normal preconditions:
+
+- deposits reverted because the caller had no tokens and/or allowance;
+- withdrawals reverted because the caller had no balance, shares, or recorded deposit;
+- other calls reverted because random arguments were unusable or the caller lacked a required role.
+
+By default, a reverted invariant action is discarded; it does not make the invariant test fail. Foundry then checked `invariant_SolvencyHolds` after sequences in which almost none of the attempted actions had changed the vault. Getters or harmless calls may have succeeded, but they did not construct the deposit/withdraw history needed to expose the bug. The assertion therefore kept checking the initial or another trivial state, where custody was at least the recorded deposits.
+
+The run output's invariant call metrics were the warning. In particular, the per-selector `calls` and `reverts` counts (and their totals) would have shown a revert rate near 100% for `deposit` and `withdraw`. A large `runs * depth` number is meaningless when almost all calls revert. During harness development, make this unmistakable with:
+
+```toml
+[invariant]
+runs = 512
+depth = 50
+fail_on_revert = true
+```
+
+`fail_on_revert` is a useful harness-debugging setting; the lasting requirement is to inspect the call/revert statistics and keep the actions' revert rate low.
+
+# The required change
+
+Target a handler, not the vault. The handler must create reachable actions: fund actors, approve the vault, select actors deliberately, and bound amounts according to their current balances or claims. For example (adjusting function and getter names to the actual vault):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault internal immutable vault;
+    MockERC20 internal immutable token;
+    address[] internal actors;
+
+    constructor(MyVault vault_, MockERC20 token_) {
+        vault = vault_;
+        token = token_;
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
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+
+        // Replace this with the vault's actual per-user claim/share getter.
+        uint256 available = vault.balanceOf(actor);
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount);
+    }
+}
+
+contract VaultInvariantTest is Test {
+    MyVault vault;
+    MockERC20 token;
+    VaultHandler handler;
+
+    function setUp() public {
+        token = new MockERC20();
+        vault = new MyVault(token);
+        handler = new VaultHandler(vault, token);
+        targetContract(address(handler));
+    }
+
+    function invariant_SolvencyHolds() public view {
+        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
+    }
+}
+```
+
+If withdrawals are share-based, bound shares and call the share-based API; if they are asset/claim-based, bound against that claim. The essential change is that handler calls normally succeed and preserve state across the 50-call sequence. Foundry can then explore combinations of successful deposits and withdrawals—including the user's ordinary sequence—and the existing solvency assertion can finally encounter and report the bad state.

codex
Wrote the explanation and handler-based fix to [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192822Z-codex-with-skill-2/testing-quiz-001/answer.md).
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9de2b2d4b983ea5e552135fbf2caef4bf2ce21d0
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,85 @@
+# Why the invariant stayed green
+
+`runs = 512` and `depth = 50` means that Foundry generated 512 sequences of up to 50 **attempted calls** each. It does not mean that the vault underwent 25,600 useful state transitions.
+
+`targetContract(address(vault))` made Foundry call the vault directly with fuzzed calldata, arguments, and callers. Those callers had not been given tokens, had not approved the vault, and usually did not have a deposit or shares to withdraw. Consequently, ordinary state-changing calls failed their normal preconditions:
+
+- deposits reverted because the caller had no tokens and/or allowance;
+- withdrawals reverted because the caller had no balance, shares, or recorded deposit;
+- other calls reverted because random arguments were unusable or the caller lacked a required role.
+
+By default, a reverted invariant action is discarded; it does not make the invariant test fail. Foundry then checked `invariant_SolvencyHolds` after sequences in which almost none of the attempted actions had changed the vault. Getters or harmless calls may have succeeded, but they did not construct the deposit/withdraw history needed to expose the bug. The assertion therefore kept checking the initial or another trivial state, where custody was at least the recorded deposits.
+
+The run output's invariant call metrics were the warning. In particular, the per-selector `calls` and `reverts` counts (and their totals) would have shown a revert rate near 100% for `deposit` and `withdraw`. A large `runs * depth` number is meaningless when almost all calls revert. During harness development, make this unmistakable with:
+
+```toml
+[invariant]
+runs = 512
+depth = 50
+fail_on_revert = true
+```
+
+`fail_on_revert` is a useful harness-debugging setting; the lasting requirement is to inspect the call/revert statistics and keep the actions' revert rate low.
+
+# The required change
+
+Target a handler, not the vault. The handler must create reachable actions: fund actors, approve the vault, select actors deliberately, and bound amounts according to their current balances or claims. For example (adjusting function and getter names to the actual vault):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault internal immutable vault;
+    MockERC20 internal immutable token;
+    address[] internal actors;
+
+    constructor(MyVault vault_, MockERC20 token_) {
+        vault = vault_;
+        token = token_;
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
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+
+        // Replace this with the vault's actual per-user claim/share getter.
+        uint256 available = vault.balanceOf(actor);
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount);
+    }
+}
+
+contract VaultInvariantTest is Test {
+    MyVault vault;
+    MockERC20 token;
+    VaultHandler handler;
+
+    function setUp() public {
+        token = new MockERC20();
+        vault = new MyVault(token);
+        handler = new VaultHandler(vault, token);
+        targetContract(address(handler));
+    }
+
+    function invariant_SolvencyHolds() public view {
+        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
+    }
+}
+```
+
+If withdrawals are share-based, bound shares and call the share-based API; if they are asset/claim-based, bound against that claim. The essential change is that handler calls normally succeed and preserve state across the 50-call sequence. Foundry can then explore combinations of successful deposits and withdrawals—including the user's ordinary sequence—and the existing solvency assertion can finally encounter and report the bad state.

tokens used
13,018
````

## final message

Wrote the explanation and handler-based fix to [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192822Z-codex-with-skill-2/testing-quiz-001/answer.md).

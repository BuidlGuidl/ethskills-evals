# Executor transcript — 2026-09-12T015027Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-pr101-workspaces/2026-09-12T015027Z-codex-no-skill-2/testing-quiz-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-pr101-workspaces/2026-09-12T015027Z-codex-no-skill-2/testing-quiz-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a09350-6736-7481-a5e6-a0c249316874
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
I’ll inspect the repository and its Foundry version/config so the explanation and fix match the exact invariant harness behavior, then write `answer.md`.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g 'foundry.toml' -g '*.sol' -g '"'!lib/**'"' | sort && git status --short" in /tmp/ethskills-pr101-workspaces/2026-09-12T015027Z-codex-no-skill-2/testing-quiz-001
 succeeded in 4ms:
exec
/bin/bash -lc 'find . -maxdepth 3 -type f -print | sort; git status --short; git log -1 --oneline' in /tmp/ethskills-pr101-workspaces/2026-09-12T015027Z-codex-no-skill-2/testing-quiz-001
 succeeded in 10ms:
./.git/COMMIT_EDITMSG
./.git/HEAD
./.git/config
./.git/description
./.git/hooks/applypatch-msg.sample
./.git/hooks/commit-msg.sample
./.git/hooks/fsmonitor-watchman.sample
./.git/hooks/post-update.sample
./.git/hooks/pre-applypatch.sample
./.git/hooks/pre-commit.sample
./.git/hooks/pre-merge-commit.sample
./.git/hooks/pre-push.sample
./.git/hooks/pre-rebase.sample
./.git/hooks/pre-receive.sample
./.git/hooks/prepare-commit-msg.sample
./.git/hooks/push-to-checkout.sample
./.git/hooks/sendemail-validate.sample
./.git/hooks/update.sample
./.git/index
./.git/info/exclude
./.git/logs/HEAD
./TASK.md
./package.json
d9505fa eval baseline

codex
The core issue is harness reachability, not statistical bad luck: targeting the raw vault generated ABI-valid attempts with arbitrary callers and arguments, but almost all state-changing attempts likely reverted before changing state. I’m capturing both the diagnostic signal (`calls` versus `reverts`, plus verbose call traces) and the handler-based correction.
apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015027Z-codex-no-skill-2/testing-quiz-001/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2bdd78d033dd82f902ba6de1fd3424d31856821a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,101 @@
+# Why the invariant suite stayed green
+
+`runs = 512` and `depth = 50` do not mean that Foundry successfully executed 25,600 economically meaningful vault operations. They mean that it generated 512 fresh state-machine runs, each containing up to 50 calls to functions in the ABI of the targeted contract. Foundry checks the invariant as the sequence progresses and resets to the post-`setUp` state for the next run.
+
+Here the target is the raw vault:
+
+```solidity
+targetContract(address(vault));
+```
+
+Consequently, Foundry supplied arbitrary calldata arguments and, by default, arbitrary callers. It did **not** arrange the preconditions needed to use the vault:
+
+- a caller with tokens;
+- an allowance from that caller to the vault;
+- an amount limited to that caller's balance;
+- a caller with an existing deposit/shares before a withdrawal;
+- a withdrawal amount limited to what that caller can withdraw;
+- where relevant, a coherent owner/receiver relationship.
+
+The token and vault were newly deployed, but no fuzz actor was funded and no fuzz actor approved the vault. Deposits therefore reverted at the token transfer/allowance checks. Withdrawals reverted because the arbitrary caller had no deposit or shares. Calls to getters merely read state. Any other calls whose random inputs violated a precondition reverted as well. Unless `fail_on_revert` is enabled, those reverts are discarded and the campaign continues.
+
+Thus the suite repeatedly checked solvency on the initial state, or on the small subset of states reachable without satisfying the protocol's prerequisites. A reverted transaction is not a transition. More runs and greater depth only explored that ineffective action generator more often; they could never assemble the user's valid deposit/withdraw history.
+
+## The warning in the test output
+
+Foundry's invariant result reports both calls and reverts, for example:
+
+```text
+[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
+```
+
+The exact revert count may differ if view functions or a few permissive methods were selected, but a very high revert-to-call ratio is the warning. With higher verbosity, the per-call/revert information and traces show deposits failing for balance/allowance and withdrawals failing for insufficient shares. The useful coverage question was not “How many calls did we ask Foundry to make?” but “How many valid state transitions did the handler perform, and which actions/states did it reach?” Ghost counters such as `successfulDeposits` and `successfulWithdrawals` make that visible and can themselves be checked with coverage assertions during harness development.
+
+Setting `fail_on_revert = true` is a useful harness diagnostic because this test would fail immediately and expose the bad generator. It is not, by itself, the fix: the inputs and actors still need to be constructed so calls succeed.
+
+## Make the action generator produce valid operations
+
+Target a handler instead of the raw vault. The handler should create actors, fund them, approve the vault, and bound every action by the actor's current valid range. For example (adapt names for the vault's actual share/deposit API):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault immutable vault;
+    MockERC20 immutable token;
+
+    address[] internal actors;
+    uint256 public successfulDeposits;
+    uint256 public successfulWithdrawals;
+
+    constructor(MyVault vault_, MockERC20 token_) {
+        vault = vault_;
+        token = token_;
+
+        actors.push(address(0xA11CE));
+        actors.push(address(0xB0B));
+
+        for (uint256 i; i < actors.length; ++i) {
+            token.mint(actors[i], type(uint128).max);
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
+        vault.deposit(amount); // or deposit(amount, actor)
+        ++successfulDeposits;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        uint256 available = vault.balanceOf(actor); // use deposits/shares/preview rules
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount); // or withdraw(amount, actor, actor)
+        ++successfulWithdrawals;
+    }
+}
+```
+
+Then change setup to target only that handler:
+
+```solidity
+VaultHandler handler;
+
+function setUp() public {
+    token = new MockERC20();
+    vault = new MyVault(token);
+    handler = new VaultHandler(vault, token);
+
+    targetContract(address(handler));
+}
+```
+
+If `withdraw` accepts assets while balances are shares, its bound must use the vault's conversion/`maxWithdraw` logic rather than blindly treating shares as assets. Likewise, if the real exploit requires particular receiver/owner combinations, expose those as deliberate handler actions while preserving the protocol's authorization rules.
+
+This change makes each fuzz step a plausible user action and preserves state across the 50 calls in a run, so Foundry can compose successful deposits and withdrawals into the offending sequence. The solvency assertion can remain exactly as written.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2bdd78d033dd82f902ba6de1fd3424d31856821a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,101 @@
+# Why the invariant suite stayed green
+
+`runs = 512` and `depth = 50` do not mean that Foundry successfully executed 25,600 economically meaningful vault operations. They mean that it generated 512 fresh state-machine runs, each containing up to 50 calls to functions in the ABI of the targeted contract. Foundry checks the invariant as the sequence progresses and resets to the post-`setUp` state for the next run.
+
+Here the target is the raw vault:
+
+```solidity
+targetContract(address(vault));
+```
+
+Consequently, Foundry supplied arbitrary calldata arguments and, by default, arbitrary callers. It did **not** arrange the preconditions needed to use the vault:
+
+- a caller with tokens;
+- an allowance from that caller to the vault;
+- an amount limited to that caller's balance;
+- a caller with an existing deposit/shares before a withdrawal;
+- a withdrawal amount limited to what that caller can withdraw;
+- where relevant, a coherent owner/receiver relationship.
+
+The token and vault were newly deployed, but no fuzz actor was funded and no fuzz actor approved the vault. Deposits therefore reverted at the token transfer/allowance checks. Withdrawals reverted because the arbitrary caller had no deposit or shares. Calls to getters merely read state. Any other calls whose random inputs violated a precondition reverted as well. Unless `fail_on_revert` is enabled, those reverts are discarded and the campaign continues.
+
+Thus the suite repeatedly checked solvency on the initial state, or on the small subset of states reachable without satisfying the protocol's prerequisites. A reverted transaction is not a transition. More runs and greater depth only explored that ineffective action generator more often; they could never assemble the user's valid deposit/withdraw history.
+
+## The warning in the test output
+
+Foundry's invariant result reports both calls and reverts, for example:
+
+```text
+[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
+```
+
+The exact revert count may differ if view functions or a few permissive methods were selected, but a very high revert-to-call ratio is the warning. With higher verbosity, the per-call/revert information and traces show deposits failing for balance/allowance and withdrawals failing for insufficient shares. The useful coverage question was not “How many calls did we ask Foundry to make?” but “How many valid state transitions did the handler perform, and which actions/states did it reach?” Ghost counters such as `successfulDeposits` and `successfulWithdrawals` make that visible and can themselves be checked with coverage assertions during harness development.
+
+Setting `fail_on_revert = true` is a useful harness diagnostic because this test would fail immediately and expose the bad generator. It is not, by itself, the fix: the inputs and actors still need to be constructed so calls succeed.
+
+## Make the action generator produce valid operations
+
+Target a handler instead of the raw vault. The handler should create actors, fund them, approve the vault, and bound every action by the actor's current valid range. For example (adapt names for the vault's actual share/deposit API):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault immutable vault;
+    MockERC20 immutable token;
+
+    address[] internal actors;
+    uint256 public successfulDeposits;
+    uint256 public successfulWithdrawals;
+
+    constructor(MyVault vault_, MockERC20 token_) {
+        vault = vault_;
+        token = token_;
+
+        actors.push(address(0xA11CE));
+        actors.push(address(0xB0B));
+
+        for (uint256 i; i < actors.length; ++i) {
+            token.mint(actors[i], type(uint128).max);
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
+        vault.deposit(amount); // or deposit(amount, actor)
+        ++successfulDeposits;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        uint256 available = vault.balanceOf(actor); // use deposits/shares/preview rules
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount); // or withdraw(amount, actor, actor)
+        ++successfulWithdrawals;
+    }
+}
+```
+
+Then change setup to target only that handler:
+
+```solidity
+VaultHandler handler;
+
+function setUp() public {
+    token = new MockERC20();
+    vault = new MyVault(token);
+    handler = new VaultHandler(vault, token);
+
+    targetContract(address(handler));
+}
+```
+
+If `withdraw` accepts assets while balances are shares, its bound must use the vault's conversion/`maxWithdraw` logic rather than blindly treating shares as assets. Likewise, if the real exploit requires particular receiver/owner combinations, expose those as deliberate handler actions while preserving the protocol's authorization rules.
+
+This change makes each fuzz step a plausible user action and preserves state across the 50 calls in a run, so Foundry can compose successful deposits and withdrawals into the offending sequence. The solvency assertion can remain exactly as written.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git diff --check && git status --short" in /tmp/ethskills-pr101-workspaces/2026-09-12T015027Z-codex-no-skill-2/testing-quiz-001
 succeeded in 6ms:
?? answer.md

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2bdd78d033dd82f902ba6de1fd3424d31856821a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,101 @@
+# Why the invariant suite stayed green
+
+`runs = 512` and `depth = 50` do not mean that Foundry successfully executed 25,600 economically meaningful vault operations. They mean that it generated 512 fresh state-machine runs, each containing up to 50 calls to functions in the ABI of the targeted contract. Foundry checks the invariant as the sequence progresses and resets to the post-`setUp` state for the next run.
+
+Here the target is the raw vault:
+
+```solidity
+targetContract(address(vault));
+```
+
+Consequently, Foundry supplied arbitrary calldata arguments and, by default, arbitrary callers. It did **not** arrange the preconditions needed to use the vault:
+
+- a caller with tokens;
+- an allowance from that caller to the vault;
+- an amount limited to that caller's balance;
+- a caller with an existing deposit/shares before a withdrawal;
+- a withdrawal amount limited to what that caller can withdraw;
+- where relevant, a coherent owner/receiver relationship.
+
+The token and vault were newly deployed, but no fuzz actor was funded and no fuzz actor approved the vault. Deposits therefore reverted at the token transfer/allowance checks. Withdrawals reverted because the arbitrary caller had no deposit or shares. Calls to getters merely read state. Any other calls whose random inputs violated a precondition reverted as well. Unless `fail_on_revert` is enabled, those reverts are discarded and the campaign continues.
+
+Thus the suite repeatedly checked solvency on the initial state, or on the small subset of states reachable without satisfying the protocol's prerequisites. A reverted transaction is not a transition. More runs and greater depth only explored that ineffective action generator more often; they could never assemble the user's valid deposit/withdraw history.
+
+## The warning in the test output
+
+Foundry's invariant result reports both calls and reverts, for example:
+
+```text
+[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
+```
+
+The exact revert count may differ if view functions or a few permissive methods were selected, but a very high revert-to-call ratio is the warning. With higher verbosity, the per-call/revert information and traces show deposits failing for balance/allowance and withdrawals failing for insufficient shares. The useful coverage question was not “How many calls did we ask Foundry to make?” but “How many valid state transitions did the handler perform, and which actions/states did it reach?” Ghost counters such as `successfulDeposits` and `successfulWithdrawals` make that visible and can themselves be checked with coverage assertions during harness development.
+
+Setting `fail_on_revert = true` is a useful harness diagnostic because this test would fail immediately and expose the bad generator. It is not, by itself, the fix: the inputs and actors still need to be constructed so calls succeed.
+
+## Make the action generator produce valid operations
+
+Target a handler instead of the raw vault. The handler should create actors, fund them, approve the vault, and bound every action by the actor's current valid range. For example (adapt names for the vault's actual share/deposit API):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault immutable vault;
+    MockERC20 immutable token;
+
+    address[] internal actors;
+    uint256 public successfulDeposits;
+    uint256 public successfulWithdrawals;
+
+    constructor(MyVault vault_, MockERC20 token_) {
+        vault = vault_;
+        token = token_;
+
+        actors.push(address(0xA11CE));
+        actors.push(address(0xB0B));
+
+        for (uint256 i; i < actors.length; ++i) {
+            token.mint(actors[i], type(uint128).max);
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
+        vault.deposit(amount); // or deposit(amount, actor)
+        ++successfulDeposits;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        uint256 available = vault.balanceOf(actor); // use deposits/shares/preview rules
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount); // or withdraw(amount, actor, actor)
+        ++successfulWithdrawals;
+    }
+}
+```
+
+Then change setup to target only that handler:
+
+```solidity
+VaultHandler handler;
+
+function setUp() public {
+    token = new MockERC20();
+    vault = new MyVault(token);
+    handler = new VaultHandler(vault, token);
+
+    targetContract(address(handler));
+}
+```
+
+If `withdraw` accepts assets while balances are shares, its bound must use the vault's conversion/`maxWithdraw` logic rather than blindly treating shares as assets. Likewise, if the real exploit requires particular receiver/owner combinations, expose those as deliberate handler actions while preserving the protocol's authorization rules.
+
+This change makes each fuzz step a plausible user action and preserves state across the 50 calls in a run, so Foundry can compose successful deposits and withdrawals into the offending sequence. The solvency assertion can remain exactly as written.

codex
Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015027Z-codex-no-skill-2/testing-quiz-001/answer.md) explaining:

- What the 25,600 calls actually represented.
- Why arbitrary raw-vault calls mostly reverted.
- How the `calls`/`reverts` output exposed the ineffective campaign.
- Why `fail_on_revert` is diagnostic, not sufficient.
- A handler-based setup that generates valid stateful deposit/withdraw sequences.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..2bdd78d033dd82f902ba6de1fd3424d31856821a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,101 @@
+# Why the invariant suite stayed green
+
+`runs = 512` and `depth = 50` do not mean that Foundry successfully executed 25,600 economically meaningful vault operations. They mean that it generated 512 fresh state-machine runs, each containing up to 50 calls to functions in the ABI of the targeted contract. Foundry checks the invariant as the sequence progresses and resets to the post-`setUp` state for the next run.
+
+Here the target is the raw vault:
+
+```solidity
+targetContract(address(vault));
+```
+
+Consequently, Foundry supplied arbitrary calldata arguments and, by default, arbitrary callers. It did **not** arrange the preconditions needed to use the vault:
+
+- a caller with tokens;
+- an allowance from that caller to the vault;
+- an amount limited to that caller's balance;
+- a caller with an existing deposit/shares before a withdrawal;
+- a withdrawal amount limited to what that caller can withdraw;
+- where relevant, a coherent owner/receiver relationship.
+
+The token and vault were newly deployed, but no fuzz actor was funded and no fuzz actor approved the vault. Deposits therefore reverted at the token transfer/allowance checks. Withdrawals reverted because the arbitrary caller had no deposit or shares. Calls to getters merely read state. Any other calls whose random inputs violated a precondition reverted as well. Unless `fail_on_revert` is enabled, those reverts are discarded and the campaign continues.
+
+Thus the suite repeatedly checked solvency on the initial state, or on the small subset of states reachable without satisfying the protocol's prerequisites. A reverted transaction is not a transition. More runs and greater depth only explored that ineffective action generator more often; they could never assemble the user's valid deposit/withdraw history.
+
+## The warning in the test output
+
+Foundry's invariant result reports both calls and reverts, for example:
+
+```text
+[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
+```
+
+The exact revert count may differ if view functions or a few permissive methods were selected, but a very high revert-to-call ratio is the warning. With higher verbosity, the per-call/revert information and traces show deposits failing for balance/allowance and withdrawals failing for insufficient shares. The useful coverage question was not “How many calls did we ask Foundry to make?” but “How many valid state transitions did the handler perform, and which actions/states did it reach?” Ghost counters such as `successfulDeposits` and `successfulWithdrawals` make that visible and can themselves be checked with coverage assertions during harness development.
+
+Setting `fail_on_revert = true` is a useful harness diagnostic because this test would fail immediately and expose the bad generator. It is not, by itself, the fix: the inputs and actors still need to be constructed so calls succeed.
+
+## Make the action generator produce valid operations
+
+Target a handler instead of the raw vault. The handler should create actors, fund them, approve the vault, and bound every action by the actor's current valid range. For example (adapt names for the vault's actual share/deposit API):
+
+```solidity
+contract VaultHandler is Test {
+    MyVault immutable vault;
+    MockERC20 immutable token;
+
+    address[] internal actors;
+    uint256 public successfulDeposits;
+    uint256 public successfulWithdrawals;
+
+    constructor(MyVault vault_, MockERC20 token_) {
+        vault = vault_;
+        token = token_;
+
+        actors.push(address(0xA11CE));
+        actors.push(address(0xB0B));
+
+        for (uint256 i; i < actors.length; ++i) {
+            token.mint(actors[i], type(uint128).max);
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
+        vault.deposit(amount); // or deposit(amount, actor)
+        ++successfulDeposits;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 amount) external {
+        address actor = actors[actorSeed % actors.length];
+        uint256 available = vault.balanceOf(actor); // use deposits/shares/preview rules
+        if (available == 0) return;
+        amount = bound(amount, 1, available);
+
+        vm.prank(actor);
+        vault.withdraw(amount); // or withdraw(amount, actor, actor)
+        ++successfulWithdrawals;
+    }
+}
+```
+
+Then change setup to target only that handler:
+
+```solidity
+VaultHandler handler;
+
+function setUp() public {
+    token = new MockERC20();
+    vault = new MyVault(token);
+    handler = new VaultHandler(vault, token);
+
+    targetContract(address(handler));
+}
+```
+
+If `withdraw` accepts assets while balances are shares, its bound must use the vault's conversion/`maxWithdraw` logic rather than blindly treating shares as assets. Likewise, if the real exploit requires particular receiver/owner combinations, expose those as deliberate handler actions while preserving the protocol's authorization rules.
+
+This change makes each fuzz step a plausible user action and preserves state across the 50 calls in a run, so Foundry can compose successful deposits and withdrawals into the offending sequence. The solvency assertion can remain exactly as written.

tokens used
14,736
````

## final message

Created [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015027Z-codex-no-skill-2/testing-quiz-001/answer.md) explaining:

- What the 25,600 calls actually represented.
- Why arbitrary raw-vault calls mostly reverted.
- How the `calls`/`reverts` output exposed the ineffective campaign.
- Why `fail_on_revert` is diagnostic, not sufficient.
- A handler-based setup that generates valid stateful deposit/withdraw sequences.

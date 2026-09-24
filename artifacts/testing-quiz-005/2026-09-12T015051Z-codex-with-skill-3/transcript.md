# Executor transcript — 2026-09-12T015051Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-pr101-workspaces/2026-09-12T015051Z-codex-with-skill-3/testing-quiz-005

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-pr101-workspaces/2026-09-12T015051Z-codex-with-skill-3/testing-quiz-005
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a095cb-8d18-7e23-9d38-4d02d573de7a
--------
user
Representative slice of our vault suite — 39 tests, all green, and `forge coverage`
reports 100% of lines and 100% of functions on the vault:

    function test_DepositMintsShares() public {
        uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
        assertEq(shares, 999e18);
        assertEq(vault.shareBalance(alice), 999e18);
    }

    function test_DepositUpdatesTotalAssets() public {
        _deposit(alice, DEPOSIT_AMOUNT);
        assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
        assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
    }

    function test_WithdrawFeeBps() public view {
        assertEq(vault.WITHDRAW_FEE_BPS(), 30);
    }

    function test_ConstructorSetsUsdt() public view {
        assertEq(address(vault.usdt()), address(usdt));
    }

The vault takes a fee on withdrawal. That fee is meant to stay in the yield protocol
and accrue to whoever is still in the vault — it is not swept to the owner.

We shipped it and it has been quietly losing our users money. Over a long run of
deposits and withdrawals the vault's recorded total drifted below the tokens it
actually holds: the fees stopped being counted, so the share price is understated for
everyone still in, and the uncounted balance — real tokens, sitting in the protocol —
is now unclaimable by anybody. Nothing is insolvent; the vault holds more than it
thinks, not less. Every individual operation looks correct in isolation, and still
does: we cannot point at a single call that misbehaves.

Our lead's position is that the suite was thorough — 100% coverage, every function
exercised, all green.

Go through the tests above. For each, say what it actually establishes and what it
only appears to establish. Explain how 100% coverage was compatible with this bug, and
why "every operation is correct in isolation" is the tell rather than the alibi. Then
give the specific property the suite should have asserted such that this drift is
caught — state the property precisely and the test shape that checks it.

Write your answer to answer.md in this directory.

codex
I’m using the Foundry testing skill because the request is specifically about what the suite proves, why coverage missed a stateful accounting defect, and the invariant test that should catch it.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-pr101-workspaces/2026-09-12T015051Z-codex-with-skill-3/testing-quiz-005
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: testing
description: Use when writing or reviewing Foundry tests, when deciding whether a suite is enough to deploy, or when a green run or a coverage percentage is offered as evidence that a contract is safe. Covers fuzz, fork and invariant testing with `forge`. Finding and evidencing defects by running tests is in scope; auditing source by reading it belongs to `security` and `audit`.
---

# Smart Contract Testing

A green suite and 100% coverage are not evidence of safety. Coverage records which lines ran, never whether an assertion could have failed. Before signing off, name which of the three searches below the suite actually performed. If the answer is none, it has only confirmed the cases someone already thought of.

## Make tests capable of failing

Rewrite any test that mirrors the implementation: stored state asserted against the value just written to it, a getter against the variable it returns, a constant against itself, constructor state against the constructor argument. These execute every line and constrain nothing.

Assert properties instead — round-trips, conservation between accounting and custody, monotonicity, access boundaries. Skip anything whose failure would be a bug in the compiler or in a dependency you did not write.

A bug that accumulates across a sequence cannot be seen by any test that exercises one operation in isolation, however many such tests exist. "Every operation is correct on its own" is the symptom, not the defence.

## Fuzz the domain instead of picking from it

Before deploy, every owner-settable number that feeds value math — fee basis points, ratios, caps, exchange rates — needs a fuzz test over its whole accepted domain, using `bound()` rather than `vm.assume()`. Hand-picked values walk one branch; the fuzzer finds the value nobody proposed.

Reaching a suspected bug by reading the code and then writing one test for it confirms what you already believed. It is not a substitute for the search, and it stops at the first defect you happened to imagine.

Include both sides of every bound, not just the far side. The value at the limit and the value past it usually break through different code paths and surface as different failures, so evidence for one is not evidence for the other.

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

Point `targetContract` at a handler, never at the contract under test. Called directly, the fuzzer supplies random senders that hold no tokens and granted no approvals, so nearly every call reverts. Reverts are discarded rather than failing the run, and the invariant is then asserted against a contract that never left its initial state — green because nothing happened.

The handler owns setup: funded and approved actors, inputs bounded to valid ranges, multiple actors where the property is about interaction between them.

Read the calls/reverts statistics in the run output every time. A revert rate near 100% means the run proved nothing; set `fail_on_revert = true` to surface it while building the handler.

## Before deploy

- [ ] No test asserts the implementation back to itself.
- [ ] Every owner-settable number feeding value math is fuzzed across its domain, both sides of each bound included.
- [ ] Every external integration and quirky token is exercised on a pinned fork against the real deployment, on an endpoint confirmed to serve that block.
- [ ] Stateful contracts have a handler-driven invariant tying accounting to custody, with a revert rate low enough that the sequences reached real states.
- [ ] Access control, zero, and max-value cases revert as intended.
- [ ] `slither .` run, with no high or medium finding left unaddressed.

codex
The central distinction is already clear: these tests mostly confirm getters and single-step bookkeeping, while the failure lives in a relationship between independent sources of truth after a sequence. I’m checking the workspace only to see whether the concrete contract names let me state that invariant more precisely.
exec
/bin/bash -lc "rg --files -g '"'!lib/**'"' -g '"'!out/**'"' -g '"'!cache/**'"' && rg -n \"contract .*Vault|totalAssetsStored|WITHDRAW_FEE_BPS|yield|withdraw\" -g '*.sol' -g '"'!lib/**'"' ." in /tmp/ethskills-pr101-workspaces/2026-09-12T015051Z-codex-with-skill-3/testing-quiz-005
 exited 1 in 10ms:
TASK.md
package.json

apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015051Z-codex-with-skill-3/testing-quiz-005/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..0629e9aa0fb9aa58665364b3d31707ed1d1dc027
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,70 @@
+# What the green vault suite actually proved
+
+The four tests exercise code, but none of them checks the accounting-to-custody relationship that failed.
+
+## What each test establishes
+
+### `test_DepositMintsShares`
+
+This establishes that, from the fixture's initial state and for exactly `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and writes the same number to Alice's share balance.
+
+It only appears to establish that deposits mint the economically correct number of shares. The expected value is hard-coded from the same assumptions as the implementation, and the test does not independently derive it from assets, total supply, and the pre-deposit exchange rate. It also says nothing about a deposit after prior deposits, yield, or fee-bearing withdrawals, nor whether the resulting shares remain fully backed.
+
+### `test_DepositUpdatesTotalAssets`
+
+This establishes that one deposit into a fresh fixture makes both `totalAssets()` and `totalAssetsStored()` report `DEPOSIT_AMOUNT`.
+
+It only appears to establish that total-assets accounting is correct. If `totalAssets()` reads or is derived from `totalAssetsStored()`, the two assertions are not independent evidence: they ask the vault's books whether its books agree with themselves. The test never compares either value with independently observed custody, such as the vault's liquid USDT plus its redeemable position in the yield protocol. It also tests the transition that adds assets, not the withdrawal transition on which retained fees create drift.
+
+### `test_WithdrawFeeBps`
+
+This establishes only that the public constant/getter returns `30`.
+
+It only appears to test withdrawal fees. It does not establish that a withdrawal charges 30 basis points, that the user receives the correct net amount, that the fee remains in the strategy, or—critically—that the retained fee remains included in the vault's recorded assets and benefits the remaining shareholders.
+
+### `test_ConstructorSetsUsdt`
+
+This establishes that construction stores the supplied mock token address and that `usdt()` returns it.
+
+It only appears to add confidence in the vault's asset handling. Correct wiring does not establish correct transfers, protocol custody, share valuation, or accounting across transitions. Unless constructor wiring was in doubt, this is a very weak safety property.
+
+## Why 100% coverage was compatible with the bug
+
+Line and function coverage report reachability, not correctness. A test can execute every line—including the faulty withdrawal accounting line—and still never make an assertion capable of distinguishing the faulty result from the correct one. Function coverage likewise says that a withdrawal was called, not that retained fees were reconciled to assets afterward. It also says nothing about whether meaningful input ranges or meaningful operation sequences were explored.
+
+The shown tests are especially coverage-friendly: getter tests execute functions while constraining almost no behavior, and the deposit tests inspect one transition from one initial state. Assertions that compare two values derived from the same stored variable can remain green even when that variable has diverged from reality.
+
+"Every operation is correct in isolation" is therefore the tell. This is a stateful, compositional defect. A withdrawal can burn the expected shares, pay the expected net amount, charge the expected fee, and return the expected values, yet leave the post-state wrong. If gross assets are `G` and the retained fee is `F`, custody falls by only `G - F`. If recorded assets are reduced by `G`, the books fall below custody by `F`. Repeating otherwise plausible operations accumulates that discrepancy. The externally visible result of each call is not the complete correctness condition; preservation of the system-wide accounting invariant is.
+
+## The missing property
+
+After every successful state transition, recorded managed assets must equal independently measured assets under the vault's control:
+
+```text
+vault.totalAssetsStored()
+    == USDT held directly by the vault
+     + USDT-equivalent value independently redeemable by the vault
+       from the yield protocol
+```
+
+The right-hand side must be obtained from token balances and the protocol position, not from `vault.totalAssets()` or another view backed by `totalAssetsStored()`. If the controlled test protocol has no yield and no rounding, this should be exact. If the real integration necessarily rounds, the test must use a narrowly derived rounding bound; it must not replace equality with `recorded <= custody`, because that one-sided assertion expressly permits the stranded-surplus bug.
+
+For a single withdrawal with no exogenous yield during the transaction, the equivalent transition property is:
+
+```text
+storedAfter == storedBefore - assetsActuallyTransferredToWithdrawer
+```
+
+Thus, when `G` is redeemed and fee `F` stays invested, `storedAfter` must be `storedBefore - (G - F)`, not `storedBefore - G`.
+
+## Test shape
+
+This belongs in a handler-driven Foundry invariant test:
+
+- The handler owns several funded, approved users.
+- Its actions perform bounded, valid deposits and withdrawals (and, if supported, harvests or yield changes), updating no vault bookkeeping itself.
+- Foundry targets the handler rather than the vault directly, so generated calls have viable senders, balances, approvals, and withdrawal amounts instead of mostly reverting.
+- After every generated sequence, the invariant independently reads direct USDT custody and the vault's redeemable underlying in the yield protocol, sums them, and asserts exact equality with `totalAssetsStored()`.
+- Calls/reverts statistics are checked, with `fail_on_revert = true` while developing the handler, to ensure the fuzzer is exploring real transitions.
+
+A focused regression should accompany the invariant: Alice and Bob deposit; Alice withdraws all or part of her position; assert that the fee remains in protocol custody, that recorded assets equal custody, and that Bob's redeemable asset value increases by the retained fee (subject only to explicitly calculated rounding). Repeating deposit/withdraw cycles makes the old defect grow, but the global equality should already fail on the first fee-bearing withdrawal.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..0629e9aa0fb9aa58665364b3d31707ed1d1dc027
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,70 @@
+# What the green vault suite actually proved
+
+The four tests exercise code, but none of them checks the accounting-to-custody relationship that failed.
+
+## What each test establishes
+
+### `test_DepositMintsShares`
+
+This establishes that, from the fixture's initial state and for exactly `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and writes the same number to Alice's share balance.
+
+It only appears to establish that deposits mint the economically correct number of shares. The expected value is hard-coded from the same assumptions as the implementation, and the test does not independently derive it from assets, total supply, and the pre-deposit exchange rate. It also says nothing about a deposit after prior deposits, yield, or fee-bearing withdrawals, nor whether the resulting shares remain fully backed.
+
+### `test_DepositUpdatesTotalAssets`
+
+This establishes that one deposit into a fresh fixture makes both `totalAssets()` and `totalAssetsStored()` report `DEPOSIT_AMOUNT`.
+
+It only appears to establish that total-assets accounting is correct. If `totalAssets()` reads or is derived from `totalAssetsStored()`, the two assertions are not independent evidence: they ask the vault's books whether its books agree with themselves. The test never compares either value with independently observed custody, such as the vault's liquid USDT plus its redeemable position in the yield protocol. It also tests the transition that adds assets, not the withdrawal transition on which retained fees create drift.
+
+### `test_WithdrawFeeBps`
+
+This establishes only that the public constant/getter returns `30`.
+
+It only appears to test withdrawal fees. It does not establish that a withdrawal charges 30 basis points, that the user receives the correct net amount, that the fee remains in the strategy, or—critically—that the retained fee remains included in the vault's recorded assets and benefits the remaining shareholders.
+
+### `test_ConstructorSetsUsdt`
+
+This establishes that construction stores the supplied mock token address and that `usdt()` returns it.
+
+It only appears to add confidence in the vault's asset handling. Correct wiring does not establish correct transfers, protocol custody, share valuation, or accounting across transitions. Unless constructor wiring was in doubt, this is a very weak safety property.
+
+## Why 100% coverage was compatible with the bug
+
+Line and function coverage report reachability, not correctness. A test can execute every line—including the faulty withdrawal accounting line—and still never make an assertion capable of distinguishing the faulty result from the correct one. Function coverage likewise says that a withdrawal was called, not that retained fees were reconciled to assets afterward. It also says nothing about whether meaningful input ranges or meaningful operation sequences were explored.
+
+The shown tests are especially coverage-friendly: getter tests execute functions while constraining almost no behavior, and the deposit tests inspect one transition from one initial state. Assertions that compare two values derived from the same stored variable can remain green even when that variable has diverged from reality.
+
+"Every operation is correct in isolation" is therefore the tell. This is a stateful, compositional defect. A withdrawal can burn the expected shares, pay the expected net amount, charge the expected fee, and return the expected values, yet leave the post-state wrong. If gross assets are `G` and the retained fee is `F`, custody falls by only `G - F`. If recorded assets are reduced by `G`, the books fall below custody by `F`. Repeating otherwise plausible operations accumulates that discrepancy. The externally visible result of each call is not the complete correctness condition; preservation of the system-wide accounting invariant is.
+
+## The missing property
+
+After every successful state transition, recorded managed assets must equal independently measured assets under the vault's control:
+
+```text
+vault.totalAssetsStored()
+    == USDT held directly by the vault
+     + USDT-equivalent value independently redeemable by the vault
+       from the yield protocol
+```
+
+The right-hand side must be obtained from token balances and the protocol position, not from `vault.totalAssets()` or another view backed by `totalAssetsStored()`. If the controlled test protocol has no yield and no rounding, this should be exact. If the real integration necessarily rounds, the test must use a narrowly derived rounding bound; it must not replace equality with `recorded <= custody`, because that one-sided assertion expressly permits the stranded-surplus bug.
+
+For a single withdrawal with no exogenous yield during the transaction, the equivalent transition property is:
+
+```text
+storedAfter == storedBefore - assetsActuallyTransferredToWithdrawer
+```
+
+Thus, when `G` is redeemed and fee `F` stays invested, `storedAfter` must be `storedBefore - (G - F)`, not `storedBefore - G`.
+
+## Test shape
+
+This belongs in a handler-driven Foundry invariant test:
+
+- The handler owns several funded, approved users.
+- Its actions perform bounded, valid deposits and withdrawals (and, if supported, harvests or yield changes), updating no vault bookkeeping itself.
+- Foundry targets the handler rather than the vault directly, so generated calls have viable senders, balances, approvals, and withdrawal amounts instead of mostly reverting.
+- After every generated sequence, the invariant independently reads direct USDT custody and the vault's redeemable underlying in the yield protocol, sums them, and asserts exact equality with `totalAssetsStored()`.
+- Calls/reverts statistics are checked, with `fail_on_revert = true` while developing the handler, to ensure the fuzzer is exploring real transitions.
+
+A focused regression should accompany the invariant: Alice and Bob deposit; Alice withdraws all or part of her position; assert that the fee remains in protocol custody, that recorded assets equal custody, and that Bob's redeemable asset value increases by the retained fee (subject only to explicitly calculated rounding). Repeating deposit/withdraw cycles makes the old defect grow, but the global equality should already fail on the first fee-bearing withdrawal.

exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /tmp/ethskills-pr101-workspaces/2026-09-12T015051Z-codex-with-skill-3/testing-quiz-005
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# What the green vault suite actually proved

The four tests exercise code, but none of them checks the accounting-to-custody relationship that failed.

## What each test establishes

### `test_DepositMintsShares`

This establishes that, from the fixture's initial state and for exactly `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and writes the same number to Alice's share balance.

It only appears to establish that deposits mint the economically correct number of shares. The expected value is hard-coded from the same assumptions as the implementation, and the test does not independently derive it from assets, total supply, and the pre-deposit exchange rate. It also says nothing about a deposit after prior deposits, yield, or fee-bearing withdrawals, nor whether the resulting shares remain fully backed.

### `test_DepositUpdatesTotalAssets`

This establishes that one deposit into a fresh fixture makes both `totalAssets()` and `totalAssetsStored()` report `DEPOSIT_AMOUNT`.

It only appears to establish that total-assets accounting is correct. If `totalAssets()` reads or is derived from `totalAssetsStored()`, the two assertions are not independent evidence: they ask the vault's books whether its books agree with themselves. The test never compares either value with independently observed custody, such as the vault's liquid USDT plus its redeemable position in the yield protocol. It also tests the transition that adds assets, not the withdrawal transition on which retained fees create drift.

### `test_WithdrawFeeBps`

This establishes only that the public constant/getter returns `30`.

It only appears to test withdrawal fees. It does not establish that a withdrawal charges 30 basis points, that the user receives the correct net amount, that the fee remains in the strategy, or—critically—that the retained fee remains included in the vault's recorded assets and benefits the remaining shareholders.

### `test_ConstructorSetsUsdt`

This establishes that construction stores the supplied mock token address and that `usdt()` returns it.

It only appears to add confidence in the vault's asset handling. Correct wiring does not establish correct transfers, protocol custody, share valuation, or accounting across transitions. Unless constructor wiring was in doubt, this is a very weak safety property.

## Why 100% coverage was compatible with the bug

Line and function coverage report reachability, not correctness. A test can execute every line—including the faulty withdrawal accounting line—and still never make an assertion capable of distinguishing the faulty result from the correct one. Function coverage likewise says that a withdrawal was called, not that retained fees were reconciled to assets afterward. It also says nothing about whether meaningful input ranges or meaningful operation sequences were explored.

The shown tests are especially coverage-friendly: getter tests execute functions while constraining almost no behavior, and the deposit tests inspect one transition from one initial state. Assertions that compare two values derived from the same stored variable can remain green even when that variable has diverged from reality.

"Every operation is correct in isolation" is therefore the tell. This is a stateful, compositional defect. A withdrawal can burn the expected shares, pay the expected net amount, charge the expected fee, and return the expected values, yet leave the post-state wrong. If gross assets are `G` and the retained fee is `F`, custody falls by only `G - F`. If recorded assets are reduced by `G`, the books fall below custody by `F`. Repeating otherwise plausible operations accumulates that discrepancy. The externally visible result of each call is not the complete correctness condition; preservation of the system-wide accounting invariant is.

## The missing property

After every successful state transition, recorded managed assets must equal independently measured assets under the vault's control:

```text
vault.totalAssetsStored()
    == USDT held directly by the vault
     + USDT-equivalent value independently redeemable by the vault
       from the yield protocol
```

The right-hand side must be obtained from token balances and the protocol position, not from `vault.totalAssets()` or another view backed by `totalAssetsStored()`. If the controlled test protocol has no yield and no rounding, this should be exact. If the real integration necessarily rounds, the test must use a narrowly derived rounding bound; it must not replace equality with `recorded <= custody`, because that one-sided assertion expressly permits the stranded-surplus bug.

For a single withdrawal with no exogenous yield during the transaction, the equivalent transition property is:

```text
storedAfter == storedBefore - assetsActuallyTransferredToWithdrawer
```

Thus, when `G` is redeemed and fee `F` stays invested, `storedAfter` must be `storedBefore - (G - F)`, not `storedBefore - G`.

## Test shape

This belongs in a handler-driven Foundry invariant test:

- The handler owns several funded, approved users.
- Its actions perform bounded, valid deposits and withdrawals (and, if supported, harvests or yield changes), updating no vault bookkeeping itself.
- Foundry targets the handler rather than the vault directly, so generated calls have viable senders, balances, approvals, and withdrawal amounts instead of mostly reverting.
- After every generated sequence, the invariant independently reads direct USDT custody and the vault's redeemable underlying in the yield protocol, sums them, and asserts exact equality with `totalAssetsStored()`.
- Calls/reverts statistics are checked, with `fail_on_revert = true` while developing the handler, to ensure the fuzzer is exploring real transitions.

A focused regression should accompany the invariant: Alice and Bob deposit; Alice withdraws all or part of her position; assert that the fee remains in protocol custody, that recorded assets equal custody, and that Bob's redeemable asset value increases by the retained fee (subject only to explicitly calculated rounding). Repeating deposit/withdraw cycles makes the old defect grow, but the global equality should already fail on the first fee-bearing withdrawal.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..0629e9aa0fb9aa58665364b3d31707ed1d1dc027
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,70 @@
+# What the green vault suite actually proved
+
+The four tests exercise code, but none of them checks the accounting-to-custody relationship that failed.
+
+## What each test establishes
+
+### `test_DepositMintsShares`
+
+This establishes that, from the fixture's initial state and for exactly `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and writes the same number to Alice's share balance.
+
+It only appears to establish that deposits mint the economically correct number of shares. The expected value is hard-coded from the same assumptions as the implementation, and the test does not independently derive it from assets, total supply, and the pre-deposit exchange rate. It also says nothing about a deposit after prior deposits, yield, or fee-bearing withdrawals, nor whether the resulting shares remain fully backed.
+
+### `test_DepositUpdatesTotalAssets`
+
+This establishes that one deposit into a fresh fixture makes both `totalAssets()` and `totalAssetsStored()` report `DEPOSIT_AMOUNT`.
+
+It only appears to establish that total-assets accounting is correct. If `totalAssets()` reads or is derived from `totalAssetsStored()`, the two assertions are not independent evidence: they ask the vault's books whether its books agree with themselves. The test never compares either value with independently observed custody, such as the vault's liquid USDT plus its redeemable position in the yield protocol. It also tests the transition that adds assets, not the withdrawal transition on which retained fees create drift.
+
+### `test_WithdrawFeeBps`
+
+This establishes only that the public constant/getter returns `30`.
+
+It only appears to test withdrawal fees. It does not establish that a withdrawal charges 30 basis points, that the user receives the correct net amount, that the fee remains in the strategy, or—critically—that the retained fee remains included in the vault's recorded assets and benefits the remaining shareholders.
+
+### `test_ConstructorSetsUsdt`
+
+This establishes that construction stores the supplied mock token address and that `usdt()` returns it.
+
+It only appears to add confidence in the vault's asset handling. Correct wiring does not establish correct transfers, protocol custody, share valuation, or accounting across transitions. Unless constructor wiring was in doubt, this is a very weak safety property.
+
+## Why 100% coverage was compatible with the bug
+
+Line and function coverage report reachability, not correctness. A test can execute every line—including the faulty withdrawal accounting line—and still never make an assertion capable of distinguishing the faulty result from the correct one. Function coverage likewise says that a withdrawal was called, not that retained fees were reconciled to assets afterward. It also says nothing about whether meaningful input ranges or meaningful operation sequences were explored.
+
+The shown tests are especially coverage-friendly: getter tests execute functions while constraining almost no behavior, and the deposit tests inspect one transition from one initial state. Assertions that compare two values derived from the same stored variable can remain green even when that variable has diverged from reality.
+
+"Every operation is correct in isolation" is therefore the tell. This is a stateful, compositional defect. A withdrawal can burn the expected shares, pay the expected net amount, charge the expected fee, and return the expected values, yet leave the post-state wrong. If gross assets are `G` and the retained fee is `F`, custody falls by only `G - F`. If recorded assets are reduced by `G`, the books fall below custody by `F`. Repeating otherwise plausible operations accumulates that discrepancy. The externally visible result of each call is not the complete correctness condition; preservation of the system-wide accounting invariant is.
+
+## The missing property
+
+After every successful state transition, recorded managed assets must equal independently measured assets under the vault's control:
+
+```text
+vault.totalAssetsStored()
+    == USDT held directly by the vault
+     + USDT-equivalent value independently redeemable by the vault
+       from the yield protocol
+```
+
+The right-hand side must be obtained from token balances and the protocol position, not from `vault.totalAssets()` or another view backed by `totalAssetsStored()`. If the controlled test protocol has no yield and no rounding, this should be exact. If the real integration necessarily rounds, the test must use a narrowly derived rounding bound; it must not replace equality with `recorded <= custody`, because that one-sided assertion expressly permits the stranded-surplus bug.
+
+For a single withdrawal with no exogenous yield during the transaction, the equivalent transition property is:
+
+```text
+storedAfter == storedBefore - assetsActuallyTransferredToWithdrawer
+```
+
+Thus, when `G` is redeemed and fee `F` stays invested, `storedAfter` must be `storedBefore - (G - F)`, not `storedBefore - G`.
+
+## Test shape
+
+This belongs in a handler-driven Foundry invariant test:
+
+- The handler owns several funded, approved users.
+- Its actions perform bounded, valid deposits and withdrawals (and, if supported, harvests or yield changes), updating no vault bookkeeping itself.
+- Foundry targets the handler rather than the vault directly, so generated calls have viable senders, balances, approvals, and withdrawal amounts instead of mostly reverting.
+- After every generated sequence, the invariant independently reads direct USDT custody and the vault's redeemable underlying in the yield protocol, sums them, and asserts exact equality with `totalAssetsStored()`.
+- Calls/reverts statistics are checked, with `fail_on_revert = true` while developing the handler, to ensure the fuzzer is exploring real transitions.
+
+A focused regression should accompany the invariant: Alice and Bob deposit; Alice withdraws all or part of her position; assert that the fee remains in protocol custody, that recorded assets equal custody, and that Bob's redeemable asset value increases by the retained fee (subject only to explicitly calculated rounding). Repeating deposit/withdraw cycles makes the old defect grow, but the global equality should already fail on the first fee-bearing withdrawal.

codex
Completed the analysis in [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015051Z-codex-with-skill-3/testing-quiz-005/answer.md).
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..0629e9aa0fb9aa58665364b3d31707ed1d1dc027
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,70 @@
+# What the green vault suite actually proved
+
+The four tests exercise code, but none of them checks the accounting-to-custody relationship that failed.
+
+## What each test establishes
+
+### `test_DepositMintsShares`
+
+This establishes that, from the fixture's initial state and for exactly `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and writes the same number to Alice's share balance.
+
+It only appears to establish that deposits mint the economically correct number of shares. The expected value is hard-coded from the same assumptions as the implementation, and the test does not independently derive it from assets, total supply, and the pre-deposit exchange rate. It also says nothing about a deposit after prior deposits, yield, or fee-bearing withdrawals, nor whether the resulting shares remain fully backed.
+
+### `test_DepositUpdatesTotalAssets`
+
+This establishes that one deposit into a fresh fixture makes both `totalAssets()` and `totalAssetsStored()` report `DEPOSIT_AMOUNT`.
+
+It only appears to establish that total-assets accounting is correct. If `totalAssets()` reads or is derived from `totalAssetsStored()`, the two assertions are not independent evidence: they ask the vault's books whether its books agree with themselves. The test never compares either value with independently observed custody, such as the vault's liquid USDT plus its redeemable position in the yield protocol. It also tests the transition that adds assets, not the withdrawal transition on which retained fees create drift.
+
+### `test_WithdrawFeeBps`
+
+This establishes only that the public constant/getter returns `30`.
+
+It only appears to test withdrawal fees. It does not establish that a withdrawal charges 30 basis points, that the user receives the correct net amount, that the fee remains in the strategy, or—critically—that the retained fee remains included in the vault's recorded assets and benefits the remaining shareholders.
+
+### `test_ConstructorSetsUsdt`
+
+This establishes that construction stores the supplied mock token address and that `usdt()` returns it.
+
+It only appears to add confidence in the vault's asset handling. Correct wiring does not establish correct transfers, protocol custody, share valuation, or accounting across transitions. Unless constructor wiring was in doubt, this is a very weak safety property.
+
+## Why 100% coverage was compatible with the bug
+
+Line and function coverage report reachability, not correctness. A test can execute every line—including the faulty withdrawal accounting line—and still never make an assertion capable of distinguishing the faulty result from the correct one. Function coverage likewise says that a withdrawal was called, not that retained fees were reconciled to assets afterward. It also says nothing about whether meaningful input ranges or meaningful operation sequences were explored.
+
+The shown tests are especially coverage-friendly: getter tests execute functions while constraining almost no behavior, and the deposit tests inspect one transition from one initial state. Assertions that compare two values derived from the same stored variable can remain green even when that variable has diverged from reality.
+
+"Every operation is correct in isolation" is therefore the tell. This is a stateful, compositional defect. A withdrawal can burn the expected shares, pay the expected net amount, charge the expected fee, and return the expected values, yet leave the post-state wrong. If gross assets are `G` and the retained fee is `F`, custody falls by only `G - F`. If recorded assets are reduced by `G`, the books fall below custody by `F`. Repeating otherwise plausible operations accumulates that discrepancy. The externally visible result of each call is not the complete correctness condition; preservation of the system-wide accounting invariant is.
+
+## The missing property
+
+After every successful state transition, recorded managed assets must equal independently measured assets under the vault's control:
+
+```text
+vault.totalAssetsStored()
+    == USDT held directly by the vault
+     + USDT-equivalent value independently redeemable by the vault
+       from the yield protocol
+```
+
+The right-hand side must be obtained from token balances and the protocol position, not from `vault.totalAssets()` or another view backed by `totalAssetsStored()`. If the controlled test protocol has no yield and no rounding, this should be exact. If the real integration necessarily rounds, the test must use a narrowly derived rounding bound; it must not replace equality with `recorded <= custody`, because that one-sided assertion expressly permits the stranded-surplus bug.
+
+For a single withdrawal with no exogenous yield during the transaction, the equivalent transition property is:
+
+```text
+storedAfter == storedBefore - assetsActuallyTransferredToWithdrawer
+```
+
+Thus, when `G` is redeemed and fee `F` stays invested, `storedAfter` must be `storedBefore - (G - F)`, not `storedBefore - G`.
+
+## Test shape
+
+This belongs in a handler-driven Foundry invariant test:
+
+- The handler owns several funded, approved users.
+- Its actions perform bounded, valid deposits and withdrawals (and, if supported, harvests or yield changes), updating no vault bookkeeping itself.
+- Foundry targets the handler rather than the vault directly, so generated calls have viable senders, balances, approvals, and withdrawal amounts instead of mostly reverting.
+- After every generated sequence, the invariant independently reads direct USDT custody and the vault's redeemable underlying in the yield protocol, sums them, and asserts exact equality with `totalAssetsStored()`.
+- Calls/reverts statistics are checked, with `fail_on_revert = true` while developing the handler, to ensure the fuzzer is exploring real transitions.
+
+A focused regression should accompany the invariant: Alice and Bob deposit; Alice withdraws all or part of her position; assert that the fee remains in protocol custody, that recorded assets equal custody, and that Bob's redeemable asset value increases by the retained fee (subject only to explicitly calculated rounding). Repeating deposit/withdraw cycles makes the old defect grow, but the global equality should already fail on the first fee-bearing withdrawal.

tokens used
18,341
````

## final message

Completed the analysis in [answer.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015051Z-codex-with-skill-3/testing-quiz-005/answer.md).

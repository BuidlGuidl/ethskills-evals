# Executor transcript — 2026-09-12T011121Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-evals-issue112/2026-09-12T011121Z-codex-with-skill-3/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-evals-issue112/2026-09-12T011121Z-codex-with-skill-3/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 01a0932b-8e36-7452-b5aa-b1d6997907cb
--------
user
Our vault routes deposits into Aave V3. The suite runs against a MockERC20 for the
underlying and a MockAavePool for the pool — 39 tests, all green, and they have been
green since the first commit.

We deployed to mainnet with USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) as the
underlying. Every deposit reverts on-chain. The revert carries no reason string. The
relevant lines are:

    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.approve(address(aavePool), amount);
    aavePool.supply(address(usdt), amount, address(this), 0);

where `usdt` is declared as an OpenZeppelin `IERC20` and the contract does
`using SafeERC20 for IERC20`. Our MockERC20 is a stock OpenZeppelin ERC20 with
6 decimals.

Note the first line uses the token and succeeds; the failure is further down.

Explain why this reverts against the real deployed USDT but never against the mock,
why the SafeERC20 usage did not protect the failing line, and why no amount of extra
mock-based tests would have surfaced it. Then give both fixes: the code change, and
the change in testing practice that would have caught this before mainnet.

Write your answer to answer.md in this directory.

codex
I’m using the Foundry testing skill because the core question is about what the green mock suite could and could not establish, and what test practice would have exposed the integration defect.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-evals-issue112/2026-09-12T011121Z-codex-with-skill-3/testing-quiz-003
 succeeded in 5ms:
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

Treat every bound as three separate cases: the nearest value below it, the value exactly at it, and the nearest value above it. Trace each through the downstream checks before deciding which region is valid. The exact limit and the value past it often break through different code paths and surface as different failures, so evidence for one is not evidence for the other.

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
- [ ] Every owner-settable number feeding value math is fuzzed across its domain, with below, exact-limit, and above-limit behavior checked separately.
- [ ] Every external integration and quirky token is exercised on a pinned fork against the real deployment, on an endpoint confirmed to serve that block.
- [ ] Stateful contracts have a handler-driven invariant tying accounting to custody, with a revert rate low enough that the sequences reached real states.
- [ ] Access control, zero, and max-value cases revert as intended.
- [ ] `slither .` run, with no high or medium finding left unaddressed.

codex
The key mismatch is confirmed: the `using SafeERC20` declaration does not automatically wrap ordinary interface calls. I’m writing the answer around the ABI return-data mismatch, with `forceApprove` as the robust code fix and a pinned mainnet-fork integration test as the missing predeployment check.
apply patch
patch: completed
/tmp/ethskills-evals-issue112/2026-09-12T011121Z-codex-with-skill-3/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1778fe394660b41ea029bbb1497e1e07ae87e41b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,79 @@
+# Why the USDT deposit reverts
+
+The failing operation is the direct `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 ABI. Its `approve` implementation does not
+return a `bool`, even though `IERC20.approve` declares that it does. Solidity makes
+the call through the `IERC20` interface and then tries to ABI-decode a 32-byte
+Boolean return value. USDT returns no data, so that decode fails and the high-level
+call reverts, generally without a reason string.
+
+The mock never exhibits this behavior because OpenZeppelin's `ERC20.approve`
+conforms to the current interface and returns `true`. Its decimals are irrelevant:
+using six decimals makes amounts look like USDT amounts, but it does not reproduce
+USDT's call/return behavior. The mock also does not reproduce USDT's requirement
+that a nonzero allowance be reset to zero before it is changed to another nonzero
+value.
+
+The preceding transfer succeeds precisely because it is invoked through the
+wrapper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success,
+provided the call itself did not revert. Merely writing
+`using SafeERC20 for IERC20` does not change the behavior of every `IERC20` method.
+It only makes the library's explicitly named extension methods available. Thus
+`safeTransferFrom` is protected, while the ordinary `approve` call is still a
+normal Solidity interface call and still attempts to decode USDT's missing return
+value.
+
+## Code fix
+
+Use OpenZeppelin `SafeERC20.forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and, when necessary, performs
+the USDT-compatible allowance sequence of approving zero before approving the new
+nonzero amount. This makes it more robust than replacing the line with a raw
+low-level call or relying only on an optional-return `safeApprove` implementation.
+The exact available method depends on the installed OpenZeppelin version; upgrading
+to a version that provides `forceApprove` is the preferred fix.
+
+An alternative design is to establish a maximum allowance once, using
+`forceApprove`, and let Aave consume from it. That changes the approval exposure and
+should be an explicit design decision rather than an accidental workaround.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that uses the deployed USDT and Aave V3
+pool addresses and executes the complete deposit path. Fund a test depositor with
+real USDT state (for example, by impersonating a funded account or with a verified
+token-deal setup), approve the vault, deposit, and assert the resulting Aave/vault
+state. The test should first reproduce the revert with the old implementation and
+then pass with `forceApprove`.
+
+Pin the fork to a specific block and use an RPC endpoint that serves that historical
+state so the test is reproducible.
+
+No number of additional tests against the same stock OpenZeppelin token and pool
+mock can reveal this defect. A mock is an executable statement of the test author's
+assumptions; here it assumes standards-compliant Boolean return data. More inputs,
+fuzz cases, assertions, or coverage against that model only exercise the same
+incorrect assumption. A purpose-built non-returning token mock could reproduce this
+particular known quirk, but it would only test a quirk already anticipated. The
+predeployment practice that discovers mismatches with a real external integration
+is a fork test against the actual deployed contracts.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1778fe394660b41ea029bbb1497e1e07ae87e41b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,79 @@
+# Why the USDT deposit reverts
+
+The failing operation is the direct `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 ABI. Its `approve` implementation does not
+return a `bool`, even though `IERC20.approve` declares that it does. Solidity makes
+the call through the `IERC20` interface and then tries to ABI-decode a 32-byte
+Boolean return value. USDT returns no data, so that decode fails and the high-level
+call reverts, generally without a reason string.
+
+The mock never exhibits this behavior because OpenZeppelin's `ERC20.approve`
+conforms to the current interface and returns `true`. Its decimals are irrelevant:
+using six decimals makes amounts look like USDT amounts, but it does not reproduce
+USDT's call/return behavior. The mock also does not reproduce USDT's requirement
+that a nonzero allowance be reset to zero before it is changed to another nonzero
+value.
+
+The preceding transfer succeeds precisely because it is invoked through the
+wrapper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success,
+provided the call itself did not revert. Merely writing
+`using SafeERC20 for IERC20` does not change the behavior of every `IERC20` method.
+It only makes the library's explicitly named extension methods available. Thus
+`safeTransferFrom` is protected, while the ordinary `approve` call is still a
+normal Solidity interface call and still attempts to decode USDT's missing return
+value.
+
+## Code fix
+
+Use OpenZeppelin `SafeERC20.forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and, when necessary, performs
+the USDT-compatible allowance sequence of approving zero before approving the new
+nonzero amount. This makes it more robust than replacing the line with a raw
+low-level call or relying only on an optional-return `safeApprove` implementation.
+The exact available method depends on the installed OpenZeppelin version; upgrading
+to a version that provides `forceApprove` is the preferred fix.
+
+An alternative design is to establish a maximum allowance once, using
+`forceApprove`, and let Aave consume from it. That changes the approval exposure and
+should be an explicit design decision rather than an accidental workaround.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that uses the deployed USDT and Aave V3
+pool addresses and executes the complete deposit path. Fund a test depositor with
+real USDT state (for example, by impersonating a funded account or with a verified
+token-deal setup), approve the vault, deposit, and assert the resulting Aave/vault
+state. The test should first reproduce the revert with the old implementation and
+then pass with `forceApprove`.
+
+Pin the fork to a specific block and use an RPC endpoint that serves that historical
+state so the test is reproducible.
+
+No number of additional tests against the same stock OpenZeppelin token and pool
+mock can reveal this defect. A mock is an executable statement of the test author's
+assumptions; here it assumes standards-compliant Boolean return data. More inputs,
+fuzz cases, assertions, or coverage against that model only exercise the same
+incorrect assumption. A purpose-built non-returning token mock could reproduce this
+particular known quirk, but it would only test a quirk already anticipated. The
+predeployment practice that discovers mismatches with a real external integration
+is a fork test against the actual deployed contracts.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git diff --check -- answer.md" in /tmp/ethskills-evals-issue112/2026-09-12T011121Z-codex-with-skill-3/testing-quiz-003
 succeeded in 9ms:
# Why the USDT deposit reverts

The failing operation is the direct `approve` call:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT predates the modern ERC-20 ABI. Its `approve` implementation does not
return a `bool`, even though `IERC20.approve` declares that it does. Solidity makes
the call through the `IERC20` interface and then tries to ABI-decode a 32-byte
Boolean return value. USDT returns no data, so that decode fails and the high-level
call reverts, generally without a reason string.

The mock never exhibits this behavior because OpenZeppelin's `ERC20.approve`
conforms to the current interface and returns `true`. Its decimals are irrelevant:
using six decimals makes amounts look like USDT amounts, but it does not reproduce
USDT's call/return behavior. The mock also does not reproduce USDT's requirement
that a nonzero allowance be reset to zero before it is changed to another nonzero
value.

The preceding transfer succeeds precisely because it is invoked through the
wrapper:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` performs a low-level call and treats empty return data as success,
provided the call itself did not revert. Merely writing
`using SafeERC20 for IERC20` does not change the behavior of every `IERC20` method.
It only makes the library's explicitly named extension methods available. Thus
`safeTransferFrom` is protected, while the ordinary `approve` call is still a
normal Solidity interface call and still attempts to decode USDT's missing return
value.

## Code fix

Use OpenZeppelin `SafeERC20.forceApprove`:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` accepts tokens that return no value and, when necessary, performs
the USDT-compatible allowance sequence of approving zero before approving the new
nonzero amount. This makes it more robust than replacing the line with a raw
low-level call or relying only on an optional-return `safeApprove` implementation.
The exact available method depends on the installed OpenZeppelin version; upgrading
to a version that provides `forceApprove` is the preferred fix.

An alternative design is to establish a maximum allowance once, using
`forceApprove`, and let Aave consume from it. That changes the approval exposure and
should be an explicit design decision rather than an accidental workaround.

## Testing-practice fix

Add a pinned mainnet-fork integration test that uses the deployed USDT and Aave V3
pool addresses and executes the complete deposit path. Fund a test depositor with
real USDT state (for example, by impersonating a funded account or with a verified
token-deal setup), approve the vault, deposit, and assert the resulting Aave/vault
state. The test should first reproduce the revert with the old implementation and
then pass with `forceApprove`.

Pin the fork to a specific block and use an RPC endpoint that serves that historical
state so the test is reproducible.

No number of additional tests against the same stock OpenZeppelin token and pool
mock can reveal this defect. A mock is an executable statement of the test author's
assumptions; here it assumes standards-compliant Boolean return data. More inputs,
fuzz cases, assertions, or coverage against that model only exercise the same
incorrect assumption. A purpose-built non-returning token mock could reproduce this
particular known quirk, but it would only test a quirk already anticipated. The
predeployment practice that discovers mismatches with a real external integration
is a fork test against the actual deployed contracts.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1778fe394660b41ea029bbb1497e1e07ae87e41b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,79 @@
+# Why the USDT deposit reverts
+
+The failing operation is the direct `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 ABI. Its `approve` implementation does not
+return a `bool`, even though `IERC20.approve` declares that it does. Solidity makes
+the call through the `IERC20` interface and then tries to ABI-decode a 32-byte
+Boolean return value. USDT returns no data, so that decode fails and the high-level
+call reverts, generally without a reason string.
+
+The mock never exhibits this behavior because OpenZeppelin's `ERC20.approve`
+conforms to the current interface and returns `true`. Its decimals are irrelevant:
+using six decimals makes amounts look like USDT amounts, but it does not reproduce
+USDT's call/return behavior. The mock also does not reproduce USDT's requirement
+that a nonzero allowance be reset to zero before it is changed to another nonzero
+value.
+
+The preceding transfer succeeds precisely because it is invoked through the
+wrapper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success,
+provided the call itself did not revert. Merely writing
+`using SafeERC20 for IERC20` does not change the behavior of every `IERC20` method.
+It only makes the library's explicitly named extension methods available. Thus
+`safeTransferFrom` is protected, while the ordinary `approve` call is still a
+normal Solidity interface call and still attempts to decode USDT's missing return
+value.
+
+## Code fix
+
+Use OpenZeppelin `SafeERC20.forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and, when necessary, performs
+the USDT-compatible allowance sequence of approving zero before approving the new
+nonzero amount. This makes it more robust than replacing the line with a raw
+low-level call or relying only on an optional-return `safeApprove` implementation.
+The exact available method depends on the installed OpenZeppelin version; upgrading
+to a version that provides `forceApprove` is the preferred fix.
+
+An alternative design is to establish a maximum allowance once, using
+`forceApprove`, and let Aave consume from it. That changes the approval exposure and
+should be an explicit design decision rather than an accidental workaround.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that uses the deployed USDT and Aave V3
+pool addresses and executes the complete deposit path. Fund a test depositor with
+real USDT state (for example, by impersonating a funded account or with a verified
+token-deal setup), approve the vault, deposit, and assert the resulting Aave/vault
+state. The test should first reproduce the revert with the old implementation and
+then pass with `forceApprove`.
+
+Pin the fork to a specific block and use an RPC endpoint that serves that historical
+state so the test is reproducible.
+
+No number of additional tests against the same stock OpenZeppelin token and pool
+mock can reveal this defect. A mock is an executable statement of the test author's
+assumptions; here it assumes standards-compliant Boolean return data. More inputs,
+fuzz cases, assertions, or coverage against that model only exercise the same
+incorrect assumption. A purpose-built non-returning token mock could reproduce this
+particular known quirk, but it would only test a quirk already anticipated. The
+predeployment practice that discovers mismatches with a real external integration
+is a fork test against the actual deployed contracts.

codex
Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-12T011121Z-codex-with-skill-3/testing-quiz-003/answer.md) explaining:

- USDT’s missing Boolean return value on `approve`
- Why `SafeERC20` protected `safeTransferFrom` but not direct `approve`
- Why the standards-compliant mock concealed the incompatibility
- The `forceApprove` code fix
- The need for pinned mainnet-fork integration tests against real USDT and Aave deployments
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1778fe394660b41ea029bbb1497e1e07ae87e41b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,79 @@
+# Why the USDT deposit reverts
+
+The failing operation is the direct `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 ABI. Its `approve` implementation does not
+return a `bool`, even though `IERC20.approve` declares that it does. Solidity makes
+the call through the `IERC20` interface and then tries to ABI-decode a 32-byte
+Boolean return value. USDT returns no data, so that decode fails and the high-level
+call reverts, generally without a reason string.
+
+The mock never exhibits this behavior because OpenZeppelin's `ERC20.approve`
+conforms to the current interface and returns `true`. Its decimals are irrelevant:
+using six decimals makes amounts look like USDT amounts, but it does not reproduce
+USDT's call/return behavior. The mock also does not reproduce USDT's requirement
+that a nonzero allowance be reset to zero before it is changed to another nonzero
+value.
+
+The preceding transfer succeeds precisely because it is invoked through the
+wrapper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success,
+provided the call itself did not revert. Merely writing
+`using SafeERC20 for IERC20` does not change the behavior of every `IERC20` method.
+It only makes the library's explicitly named extension methods available. Thus
+`safeTransferFrom` is protected, while the ordinary `approve` call is still a
+normal Solidity interface call and still attempts to decode USDT's missing return
+value.
+
+## Code fix
+
+Use OpenZeppelin `SafeERC20.forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and, when necessary, performs
+the USDT-compatible allowance sequence of approving zero before approving the new
+nonzero amount. This makes it more robust than replacing the line with a raw
+low-level call or relying only on an optional-return `safeApprove` implementation.
+The exact available method depends on the installed OpenZeppelin version; upgrading
+to a version that provides `forceApprove` is the preferred fix.
+
+An alternative design is to establish a maximum allowance once, using
+`forceApprove`, and let Aave consume from it. That changes the approval exposure and
+should be an explicit design decision rather than an accidental workaround.
+
+## Testing-practice fix
+
+Add a pinned mainnet-fork integration test that uses the deployed USDT and Aave V3
+pool addresses and executes the complete deposit path. Fund a test depositor with
+real USDT state (for example, by impersonating a funded account or with a verified
+token-deal setup), approve the vault, deposit, and assert the resulting Aave/vault
+state. The test should first reproduce the revert with the old implementation and
+then pass with `forceApprove`.
+
+Pin the fork to a specific block and use an RPC endpoint that serves that historical
+state so the test is reproducible.
+
+No number of additional tests against the same stock OpenZeppelin token and pool
+mock can reveal this defect. A mock is an executable statement of the test author's
+assumptions; here it assumes standards-compliant Boolean return data. More inputs,
+fuzz cases, assertions, or coverage against that model only exercise the same
+incorrect assumption. A purpose-built non-returning token mock could reproduce this
+particular known quirk, but it would only test a quirk already anticipated. The
+predeployment practice that discovers mismatches with a real external integration
+is a fork test against the actual deployed contracts.

tokens used
17,117
````

## final message

Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-12T011121Z-codex-with-skill-3/testing-quiz-003/answer.md) explaining:

- USDT’s missing Boolean return value on `approve`
- Why `SafeERC20` protected `safeTransferFrom` but not direct `approve`
- Why the standards-compliant mock concealed the incompatibility
- The `forceApprove` code fix
- The need for pinned mainnet-fork integration tests against real USDT and Aave deployments

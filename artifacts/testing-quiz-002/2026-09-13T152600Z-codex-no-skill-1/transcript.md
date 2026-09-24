# Executor transcript — 2026-09-13T152600Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-testing-patched-20260913/2026-09-13T152600Z-codex-no-skill-1/testing-quiz-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-testing-patched-20260913/2026-09-13T152600Z-codex-no-skill-1/testing-quiz-002
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a09b72-b18b-74e0-99ea-15fa6919d0ac
--------
user
Our vault charges a deposit fee in basis points. The owner retunes it through:

    function setDepositFee(uint256 newFeeBps) external onlyOwner {
        uint256 previousFeeBps = depositFeeBps;
        depositFeeBps = newFeeBps;
        emit DepositFeeUpdated(previousFeeBps, newFeeBps);
    }

and deposit() does the obvious thing with it:

    uint256 fee = (amount * depositFeeBps) / BPS_DENOMINATOR;   // BPS_DENOMINATOR = 10_000
    uint256 netAmount = amount - fee;
    shares = convertToShares(netAmount);
    if (shares == 0) revert NoSharesMinted();

The suite covers this: the fee maths asserted at 0, 10 and 25 bps, the event, and the
only-owner check. Green, and `forge coverage` reports 100% of the lines in both
functions.

Last week ops retuned the fee for a promotion and the vault stopped accepting
deposits completely — every single deposit reverted until we redeployed. The setter
has no bug in the sense that it does exactly what it says: it stores the number it
was given.

Explain how a suite with 100% coverage of both of those functions missed this, what
class of input it never tried and why the four values above could never have found
it, and the specific testing technique that would have caught it before ops did.
Show the arithmetic for the input that breaks it.

Write your answer to answer.md in this directory.

codex
I’ll turn this into a concise postmortem-style explanation, including the exact boundary arithmetic and the testing method that exercises the missing input class.
exec
/bin/bash -lc "ls -la && (rg --files -g 'AGENTS.md' -g '"'!answer.md'"' || true)" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152600Z-codex-no-skill-1/testing-quiz-002
 succeeded in 3ms:
apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152600Z-codex-no-skill-1/testing-quiz-002/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..b9037d5014c688e9f6945cee3427488313130d2a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,40 @@
+# Why 100% coverage missed the deposit shutdown
+
+Line coverage only proves that the tests executed each line. It does not prove that they exercised the important parts of the input domain. The tests ran the setter and the fee calculation with ordinary values, but never challenged the unstated invariant that a fee in basis points must be strictly less than `BPS_DENOMINATOR`:
+
+```solidity
+newFeeBps < 10_000
+```
+
+Because `setDepositFee` accepts any `uint256`, the owner can set the fee to 10,000 bps or more. At exactly 10,000 bps, for any positive deposit `amount` (assuming the multiplication itself does not overflow):
+
+```text
+depositFeeBps = 10,000
+fee           = amount * 10,000 / 10,000
+              = amount
+netAmount     = amount - fee
+              = 0
+shares        = convertToShares(0)
+              = 0
+```
+
+`deposit()` therefore reverts with `NoSharesMinted()` for every positive deposit.
+
+Above the boundary, subtraction can fail even earlier. For example:
+
+```text
+amount         = 10,000
+depositFeeBps  = 10,001
+fee            = 10,000 * 10,001 / 10,000
+               = 10,001
+netAmount      = 10,000 - 10,001
+               = -1
+```
+
+Since `uint256` cannot represent `-1`, Solidity's checked arithmetic reverts on the subtraction.
+
+The missing input class was boundary and out-of-range fee values: `newFeeBps >= 10_000` (and, more broadly, arbitrary `uint256` values). Tests at 0, 10, and 25 bps are all clustered safely below the critical boundary; `10_000` appearing as the denominator does not test it as a setter input. Those values can execute every line while revealing nothing about behavior at or beyond 100%.
+
+Stateful fuzz/property testing would have caught this. A handler can let the fuzzer call `setDepositFee` with arbitrary `uint256` values and then attempt a valid positive deposit, checking the invariant that an accepted configuration cannot disable all deposits. The fuzzer would quickly shrink a failure to the boundary value `10_000`. A direct boundary-value test at `9_999`, `10_000`, and `10_001` would also expose it, but the property test is stronger because it searches the whole setter domain and detects the missing validation assumption.
+
+The contract should enforce that assumption in the setter—for example, revert when `newFeeBps >= BPS_DENOMINATOR`—and the tests should assert both the bound and the deposit-liveness property.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..b9037d5014c688e9f6945cee3427488313130d2a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,40 @@
+# Why 100% coverage missed the deposit shutdown
+
+Line coverage only proves that the tests executed each line. It does not prove that they exercised the important parts of the input domain. The tests ran the setter and the fee calculation with ordinary values, but never challenged the unstated invariant that a fee in basis points must be strictly less than `BPS_DENOMINATOR`:
+
+```solidity
+newFeeBps < 10_000
+```
+
+Because `setDepositFee` accepts any `uint256`, the owner can set the fee to 10,000 bps or more. At exactly 10,000 bps, for any positive deposit `amount` (assuming the multiplication itself does not overflow):
+
+```text
+depositFeeBps = 10,000
+fee           = amount * 10,000 / 10,000
+              = amount
+netAmount     = amount - fee
+              = 0
+shares        = convertToShares(0)
+              = 0
+```
+
+`deposit()` therefore reverts with `NoSharesMinted()` for every positive deposit.
+
+Above the boundary, subtraction can fail even earlier. For example:
+
+```text
+amount         = 10,000
+depositFeeBps  = 10,001
+fee            = 10,000 * 10,001 / 10,000
+               = 10,001
+netAmount      = 10,000 - 10,001
+               = -1
+```
+
+Since `uint256` cannot represent `-1`, Solidity's checked arithmetic reverts on the subtraction.
+
+The missing input class was boundary and out-of-range fee values: `newFeeBps >= 10_000` (and, more broadly, arbitrary `uint256` values). Tests at 0, 10, and 25 bps are all clustered safely below the critical boundary; `10_000` appearing as the denominator does not test it as a setter input. Those values can execute every line while revealing nothing about behavior at or beyond 100%.
+
+Stateful fuzz/property testing would have caught this. A handler can let the fuzzer call `setDepositFee` with arbitrary `uint256` values and then attempt a valid positive deposit, checking the invariant that an accepted configuration cannot disable all deposits. The fuzzer would quickly shrink a failure to the boundary value `10_000`. A direct boundary-value test at `9_999`, `10_000`, and `10_001` would also expose it, but the property test is stronger because it searches the whole setter domain and detects the missing validation assumption.
+
+The contract should enforce that assumption in the setter—for example, revert when `newFeeBps >= BPS_DENOMINATOR`—and the tests should assert both the bound and the deposit-liveness property.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152600Z-codex-no-skill-1/testing-quiz-002
 succeeded in 11ms:
# Why 100% coverage missed the deposit shutdown

Line coverage only proves that the tests executed each line. It does not prove that they exercised the important parts of the input domain. The tests ran the setter and the fee calculation with ordinary values, but never challenged the unstated invariant that a fee in basis points must be strictly less than `BPS_DENOMINATOR`:

```solidity
newFeeBps < 10_000
```

Because `setDepositFee` accepts any `uint256`, the owner can set the fee to 10,000 bps or more. At exactly 10,000 bps, for any positive deposit `amount` (assuming the multiplication itself does not overflow):

```text
depositFeeBps = 10,000
fee           = amount * 10,000 / 10,000
              = amount
netAmount     = amount - fee
              = 0
shares        = convertToShares(0)
              = 0
```

`deposit()` therefore reverts with `NoSharesMinted()` for every positive deposit.

Above the boundary, subtraction can fail even earlier. For example:

```text
amount         = 10,000
depositFeeBps  = 10,001
fee            = 10,000 * 10,001 / 10,000
               = 10,001
netAmount      = 10,000 - 10,001
               = -1
```

Since `uint256` cannot represent `-1`, Solidity's checked arithmetic reverts on the subtraction.

The missing input class was boundary and out-of-range fee values: `newFeeBps >= 10_000` (and, more broadly, arbitrary `uint256` values). Tests at 0, 10, and 25 bps are all clustered safely below the critical boundary; `10_000` appearing as the denominator does not test it as a setter input. Those values can execute every line while revealing nothing about behavior at or beyond 100%.

Stateful fuzz/property testing would have caught this. A handler can let the fuzzer call `setDepositFee` with arbitrary `uint256` values and then attempt a valid positive deposit, checking the invariant that an accepted configuration cannot disable all deposits. The fuzzer would quickly shrink a failure to the boundary value `10_000`. A direct boundary-value test at `9_999`, `10_000`, and `10_001` would also expose it, but the property test is stronger because it searches the whole setter domain and detects the missing validation assumption.

The contract should enforce that assumption in the setter—for example, revert when `newFeeBps >= BPS_DENOMINATOR`—and the tests should assert both the bound and the deposit-liveness property.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..b9037d5014c688e9f6945cee3427488313130d2a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,40 @@
+# Why 100% coverage missed the deposit shutdown
+
+Line coverage only proves that the tests executed each line. It does not prove that they exercised the important parts of the input domain. The tests ran the setter and the fee calculation with ordinary values, but never challenged the unstated invariant that a fee in basis points must be strictly less than `BPS_DENOMINATOR`:
+
+```solidity
+newFeeBps < 10_000
+```
+
+Because `setDepositFee` accepts any `uint256`, the owner can set the fee to 10,000 bps or more. At exactly 10,000 bps, for any positive deposit `amount` (assuming the multiplication itself does not overflow):
+
+```text
+depositFeeBps = 10,000
+fee           = amount * 10,000 / 10,000
+              = amount
+netAmount     = amount - fee
+              = 0
+shares        = convertToShares(0)
+              = 0
+```
+
+`deposit()` therefore reverts with `NoSharesMinted()` for every positive deposit.
+
+Above the boundary, subtraction can fail even earlier. For example:
+
+```text
+amount         = 10,000
+depositFeeBps  = 10,001
+fee            = 10,000 * 10,001 / 10,000
+               = 10,001
+netAmount      = 10,000 - 10,001
+               = -1
+```
+
+Since `uint256` cannot represent `-1`, Solidity's checked arithmetic reverts on the subtraction.
+
+The missing input class was boundary and out-of-range fee values: `newFeeBps >= 10_000` (and, more broadly, arbitrary `uint256` values). Tests at 0, 10, and 25 bps are all clustered safely below the critical boundary; `10_000` appearing as the denominator does not test it as a setter input. Those values can execute every line while revealing nothing about behavior at or beyond 100%.
+
+Stateful fuzz/property testing would have caught this. A handler can let the fuzzer call `setDepositFee` with arbitrary `uint256` values and then attempt a valid positive deposit, checking the invariant that an accepted configuration cannot disable all deposits. The fuzzer would quickly shrink a failure to the boundary value `10_000`. A direct boundary-value test at `9_999`, `10_000`, and `10_001` would also expose it, but the property test is stronger because it searches the whole setter domain and detects the missing validation assumption.
+
+The contract should enforce that assumption in the setter—for example, revert when `newFeeBps >= BPS_DENOMINATOR`—and the tests should assert both the bound and the deposit-liveness property.

codex
Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152600Z-codex-no-skill-1/testing-quiz-002/answer.md) with the coverage explanation, failing boundary arithmetic, and recommended stateful fuzz/property testing technique.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..b9037d5014c688e9f6945cee3427488313130d2a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,40 @@
+# Why 100% coverage missed the deposit shutdown
+
+Line coverage only proves that the tests executed each line. It does not prove that they exercised the important parts of the input domain. The tests ran the setter and the fee calculation with ordinary values, but never challenged the unstated invariant that a fee in basis points must be strictly less than `BPS_DENOMINATOR`:
+
+```solidity
+newFeeBps < 10_000
+```
+
+Because `setDepositFee` accepts any `uint256`, the owner can set the fee to 10,000 bps or more. At exactly 10,000 bps, for any positive deposit `amount` (assuming the multiplication itself does not overflow):
+
+```text
+depositFeeBps = 10,000
+fee           = amount * 10,000 / 10,000
+              = amount
+netAmount     = amount - fee
+              = 0
+shares        = convertToShares(0)
+              = 0
+```
+
+`deposit()` therefore reverts with `NoSharesMinted()` for every positive deposit.
+
+Above the boundary, subtraction can fail even earlier. For example:
+
+```text
+amount         = 10,000
+depositFeeBps  = 10,001
+fee            = 10,000 * 10,001 / 10,000
+               = 10,001
+netAmount      = 10,000 - 10,001
+               = -1
+```
+
+Since `uint256` cannot represent `-1`, Solidity's checked arithmetic reverts on the subtraction.
+
+The missing input class was boundary and out-of-range fee values: `newFeeBps >= 10_000` (and, more broadly, arbitrary `uint256` values). Tests at 0, 10, and 25 bps are all clustered safely below the critical boundary; `10_000` appearing as the denominator does not test it as a setter input. Those values can execute every line while revealing nothing about behavior at or beyond 100%.
+
+Stateful fuzz/property testing would have caught this. A handler can let the fuzzer call `setDepositFee` with arbitrary `uint256` values and then attempt a valid positive deposit, checking the invariant that an accepted configuration cannot disable all deposits. The fuzzer would quickly shrink a failure to the boundary value `10_000`. A direct boundary-value test at `9_999`, `10_000`, and `10_001` would also expose it, but the property test is stronger because it searches the whole setter domain and detects the missing validation assumption.
+
+The contract should enforce that assumption in the setter—for example, revert when `newFeeBps >= BPS_DENOMINATOR`—and the tests should assert both the bound and the deposit-liveness property.

tokens used
8,003
````

## final message

Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152600Z-codex-no-skill-1/testing-quiz-002/answer.md) with the coverage explanation, failing boundary arithmetic, and recommended stateful fuzz/property testing technique.

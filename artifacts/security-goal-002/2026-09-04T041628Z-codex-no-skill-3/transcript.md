# Executor transcript — 2026-09-04T041628Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06aa7-a435-7543-b29a-5ff714b5eef4
--------
user
Build the onchain piece of a small borrowing market for Ethereum mainnet.

How it works: a user locks WETH as collateral and can borrow USDC against it,
up to 70% of what their collateral is worth. Debt accrues interest at a flat
annual rate — the rate model is not the point, keep it simple. If a position's
debt passes 85% of its collateral value the position is liquidatable: anyone
can repay part of the USDC debt and take the matching WETH plus a 5% bonus.
Borrowers can repay and withdraw collateral at any time while healthy.

Work in this directory:
  - set up a foundry project and implement the contracts we would deploy
  - make sure it compiles with forge build
  - leave a NOTES.md covering how a position's health is computed, what a
    liquidator has to do, and what an operator has to get right when
    deploying this to mainnet

codex
I’m setting up a Foundry-based onchain borrowing market in this workspace, then I’ll compile it and add deployment/operations notes. First I’m checking the repo state so I can lay out the project cleanly without trampling anything existing.
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
exec
/bin/bash -lc 'rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
 succeeded in 12ms:
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002

 succeeded in 13ms:
TASK.md
package.json

exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
 succeeded in 1ms:
codex
The workspace is essentially empty aside from task metadata, so I’m building the project from scratch. Next I’m checking the task file for any hidden constraints and verifying the local Foundry toolchain before I write contracts.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
 succeeded in 7ms:
Build the onchain piece of a small borrowing market for Ethereum mainnet.

How it works: a user locks WETH as collateral and can borrow USDC against it,
up to 70% of what their collateral is worth. Debt accrues interest at a flat
annual rate — the rate model is not the point, keep it simple. If a position's
debt passes 85% of its collateral value the position is liquidatable: anyone
can repay part of the USDC debt and take the matching WETH plus a 5% bonus.
Borrowers can repay and withdraw collateral at any time while healthy.

Work in this directory:
  - set up a foundry project and implement the contracts we would deploy
  - make sure it compiles with forge build
  - leave a NOTES.md covering how a position's health is computed, what a
    liquidator has to do, and what an operator has to get right when
    deploying this to mainnet

exec
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
exec
/bin/bash -lc 'cat package.json' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
 succeeded in 14ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

 succeeded in 3ms:
{
  "name": "eval-workspace",
  "private": true
}

codex
I have the constraints now and the local `forge` binary is available. I’m going with a minimal mainnet-oriented design: one market contract, explicit WETH/USDC/oracle wiring, per-position simple-interest accrual, and no external library dependency so `forge build` stays deterministic.
exec
/bin/bash -lc 'mkdir -p src script test' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

codex
I’m writing the contract surface now. The main implementation choice that matters operationally is that the market only lends from USDC it already holds, so deployment to mainnet requires prefunding liquidity separately; I’ll capture that in `NOTES.md` as well as in the code comments where it affects behavior.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/foundry.toml
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/src/WethUsdcBorrowingMarket.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/src/interfaces/IAggregatorV3.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/src/interfaces/IERC20.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..657dd65d5e49f11444247b19950b4e3861e4d2d0
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,33 @@
+# WETH / USDC Borrowing Market Notes
+
+## Position health
+
+- Collateral is measured in WETH and valued in USDC using the configured ETH/USD oracle.
+- The contract normalizes collateral value into 6-decimal USDC units:
+  `collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20`
+  when using 18-decimal WETH, 8-decimal ETH/USD price data, and 6-decimal USDC.
+- Debt is stored in USDC base units and accrues simple interest over time:
+  `debt = principal + principal * annualRateBps * elapsed / (10000 * 365 days)`.
+- User-initiated borrowing and collateral withdrawals require:
+  `debt <= 70% of collateralValueUsdc`.
+- A position becomes liquidatable once:
+  `debt > 85% of collateralValueUsdc`.
+
+## Liquidation flow
+
+- Anyone can call `liquidate(user, requestedRepayAmount, receiver)`.
+- The liquidator must approve the market contract to pull the USDC being used for the repayment.
+- The contract first accrues interest on the target position, checks that the debt is above the 85% threshold, then computes the actual repay amount.
+- The repay amount may be lower than the caller requested if the remaining debt is smaller or if the remaining collateral cannot support a larger seizure plus the 5% bonus.
+- Collateral seized is:
+  `repaidDebt / oraclePrice`, converted into WETH units, then multiplied by `1.05`.
+- The liquidator receives seized WETH directly to `receiver`, and the borrower’s debt/collateral balances are reduced in storage.
+
+## Mainnet deployment / operations
+
+- Wire the constructor to canonical mainnet addresses only. The intended production setup is mainnet WETH, mainnet USDC, and a robust ETH/USD oracle such as Chainlink’s ETH/USD feed.
+- Set `maxOracleDelay` to a concrete freshness bound that matches the oracle’s update pattern and your monitoring posture. If it is too loose, stale prices can leak risk; if too tight, healthy operations may revert during oracle stalls.
+- Prefund the contract with USDC before allowing borrowing. This market has no lender side; it can only lend the USDC balance it already holds.
+- Choose the fixed `annualInterestBps` carefully before deployment. In this implementation it is immutable, so changing the rate requires a new market deployment.
+- Monitor oracle health, contract USDC liquidity, and positions nearing the 85% liquidation boundary. Liquidations are permissionless; operations should assume third parties will compete for them.
+- Verify decimal assumptions before deployment. This implementation assumes 18-decimal WETH and 6-decimal USDC, which is correct for canonical Ethereum mainnet tokens but should not be changed silently for other assets.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d3aed9389036f12b91050594270de553704d52f3
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,14 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+int_types = "long"
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..93fc17e694f20950b77c07427b0fc583a35f14c6
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,266 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket {
+    uint256 public constant BPS_DENOMINATOR = 10_000;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant WETH_SCALE = 1e18;
+
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable collateralOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleDelay;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrualTime;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidAnnualRate();
+    error InvalidOraclePrice();
+    error StaleOraclePrice();
+    error InsufficientLiquidity();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error TransferFailed();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed receiver, uint256 amount);
+    event Borrowed(address indexed user, address indexed receiver, uint256 amount);
+    event Repaid(address indexed user, address indexed payer, uint256 amount);
+    event Liquidated(
+        address indexed user,
+        address indexed liquidator,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 collateralSeized
+    );
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (annualInterestBps_ > BPS_DENOMINATOR) {
+            revert InvalidAnnualRate();
+        }
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        collateralOracle = IAggregatorV3(collateralOracle_);
+        oracleDecimals = IAggregatorV3(collateralOracle_).decimals();
+        annualInterestBps = annualInterestBps_;
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount -= amount;
+
+        _ensureHealthy(position);
+        _safeTransfer(weth, receiver, amount);
+        emit CollateralWithdrawn(msg.sender, receiver, amount);
+    }
+
+    function borrow(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.debtPrincipal += amount;
+
+        _ensureHealthy(position);
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, receiver, amount);
+        emit Borrowed(msg.sender, receiver, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        repaid = amount > position.debtPrincipal ? position.debtPrincipal : amount;
+        if (repaid == 0) revert RepayTooSmall();
+
+        position.debtPrincipal -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(
+        address user,
+        uint256 requestedRepayAmount,
+        address receiver
+    ) external returns (uint256 actualRepaid, uint256 collateralSeized) {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal <= liquidationThreshold) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtPrincipal
+            ? position.debtPrincipal
+            : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = _maxRepaySupportedByCollateral(position.collateralAmount);
+        actualRepaid = maxRepayFromDebt > maxRepayFromCollateral
+            ? maxRepayFromCollateral
+            : maxRepayFromDebt;
+        if (actualRepaid == 0) revert RepayTooSmall();
+
+        collateralSeized = _collateralForDebt(actualRepaid);
+        position.debtPrincipal -= actualRepaid;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), actualRepaid);
+        _safeTransfer(weth, receiver, collateralSeized);
+        emit Liquidated(user, msg.sender, receiver, actualRepaid, collateralSeized);
+    }
+
+    function getPosition(address user)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debt,
+            uint256 collateralValue,
+            uint256 maxBorrow,
+            uint256 liquidationThreshold,
+            bool liquidatable
+        )
+    {
+        Position memory position = positions[user];
+        debt = _previewAccruedDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValue = _collateralValueInUsdc(collateralAmount);
+        maxBorrow = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        liquidatable = debt > liquidationThreshold;
+    }
+
+    function previewDebt(address user) external view returns (uint256) {
+        return _previewAccruedDebt(positions[user]);
+    }
+
+    function collateralValueInUsdc(address user) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[user].collateralAmount);
+    }
+
+    function _ensureHealthy(Position memory position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 maxDebt = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal > maxDebt) revert BorrowLimitExceeded();
+    }
+
+    function _accrue(Position storage position) internal {
+        position.debtPrincipal = _previewAccruedDebt(position);
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _previewAccruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) {
+            return 0;
+        }
+
+        if (position.lastAccrualTime == 0) {
+            return position.debtPrincipal;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtPrincipal * annualInterestBps * elapsed) /
+            (BPS_DENOMINATOR * SECONDS_PER_YEAR);
+        return position.debtPrincipal + interest;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return (collateralAmount * price * USDC_SCALE) / (WETH_SCALE * (10 ** oracleDecimals));
+    }
+
+    function _maxRepaySupportedByCollateral(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (collateralAmount *
+                price *
+                USDC_SCALE *
+                BPS_DENOMINATOR) /
+            (WETH_SCALE * (10 ** oracleDecimals) * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS));
+    }
+
+    function _collateralForDebt(uint256 debtAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (debtAmount *
+                WETH_SCALE *
+                (10 ** oracleDecimals) *
+                (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS)) /
+            (price * USDC_SCALE * BPS_DENOMINATOR);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 price) {
+        (, int256 answer, , uint256 updatedAt, ) = collateralOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (maxOracleDelay != 0 && block.timestamp - updatedAt > maxOracleDelay) {
+            revert StaleOraclePrice();
+        }
+        price = uint256(answer);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3587d3c09d6de25e238dcee6d94f36969dbb5065
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9c0cd8495a09290572007aebe64641e8bf69ae93
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..657dd65d5e49f11444247b19950b4e3861e4d2d0
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,33 @@
+# WETH / USDC Borrowing Market Notes
+
+## Position health
+
+- Collateral is measured in WETH and valued in USDC using the configured ETH/USD oracle.
+- The contract normalizes collateral value into 6-decimal USDC units:
+  `collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20`
+  when using 18-decimal WETH, 8-decimal ETH/USD price data, and 6-decimal USDC.
+- Debt is stored in USDC base units and accrues simple interest over time:
+  `debt = principal + principal * annualRateBps * elapsed / (10000 * 365 days)`.
+- User-initiated borrowing and collateral withdrawals require:
+  `debt <= 70% of collateralValueUsdc`.
+- A position becomes liquidatable once:
+  `debt > 85% of collateralValueUsdc`.
+
+## Liquidation flow
+
+- Anyone can call `liquidate(user, requestedRepayAmount, receiver)`.
+- The liquidator must approve the market contract to pull the USDC being used for the repayment.
+- The contract first accrues interest on the target position, checks that the debt is above the 85% threshold, then computes the actual repay amount.
+- The repay amount may be lower than the caller requested if the remaining debt is smaller or if the remaining collateral cannot support a larger seizure plus the 5% bonus.
+- Collateral seized is:
+  `repaidDebt / oraclePrice`, converted into WETH units, then multiplied by `1.05`.
+- The liquidator receives seized WETH directly to `receiver`, and the borrower’s debt/collateral balances are reduced in storage.
+
+## Mainnet deployment / operations
+
+- Wire the constructor to canonical mainnet addresses only. The intended production setup is mainnet WETH, mainnet USDC, and a robust ETH/USD oracle such as Chainlink’s ETH/USD feed.
+- Set `maxOracleDelay` to a concrete freshness bound that matches the oracle’s update pattern and your monitoring posture. If it is too loose, stale prices can leak risk; if too tight, healthy operations may revert during oracle stalls.
+- Prefund the contract with USDC before allowing borrowing. This market has no lender side; it can only lend the USDC balance it already holds.
+- Choose the fixed `annualInterestBps` carefully before deployment. In this implementation it is immutable, so changing the rate requires a new market deployment.
+- Monitor oracle health, contract USDC liquidity, and positions nearing the 85% liquidation boundary. Liquidations are permissionless; operations should assume third parties will compete for them.
+- Verify decimal assumptions before deployment. This implementation assumes 18-decimal WETH and 6-decimal USDC, which is correct for canonical Ethereum mainnet tokens but should not be changed silently for other assets.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d3aed9389036f12b91050594270de553704d52f3
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,14 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+int_types = "long"
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..93fc17e694f20950b77c07427b0fc583a35f14c6
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,266 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket {
+    uint256 public constant BPS_DENOMINATOR = 10_000;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant WETH_SCALE = 1e18;
+
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable collateralOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleDelay;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrualTime;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidAnnualRate();
+    error InvalidOraclePrice();
+    error StaleOraclePrice();
+    error InsufficientLiquidity();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error TransferFailed();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed receiver, uint256 amount);
+    event Borrowed(address indexed user, address indexed receiver, uint256 amount);
+    event Repaid(address indexed user, address indexed payer, uint256 amount);
+    event Liquidated(
+        address indexed user,
+        address indexed liquidator,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 collateralSeized
+    );
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (annualInterestBps_ > BPS_DENOMINATOR) {
+            revert InvalidAnnualRate();
+        }
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        collateralOracle = IAggregatorV3(collateralOracle_);
+        oracleDecimals = IAggregatorV3(collateralOracle_).decimals();
+        annualInterestBps = annualInterestBps_;
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount -= amount;
+
+        _ensureHealthy(position);
+        _safeTransfer(weth, receiver, amount);
+        emit CollateralWithdrawn(msg.sender, receiver, amount);
+    }
+
+    function borrow(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.debtPrincipal += amount;
+
+        _ensureHealthy(position);
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, receiver, amount);
+        emit Borrowed(msg.sender, receiver, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        repaid = amount > position.debtPrincipal ? position.debtPrincipal : amount;
+        if (repaid == 0) revert RepayTooSmall();
+
+        position.debtPrincipal -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(
+        address user,
+        uint256 requestedRepayAmount,
+        address receiver
+    ) external returns (uint256 actualRepaid, uint256 collateralSeized) {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal <= liquidationThreshold) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtPrincipal
+            ? position.debtPrincipal
+            : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = _maxRepaySupportedByCollateral(position.collateralAmount);
+        actualRepaid = maxRepayFromDebt > maxRepayFromCollateral
+            ? maxRepayFromCollateral
+            : maxRepayFromDebt;
+        if (actualRepaid == 0) revert RepayTooSmall();
+
+        collateralSeized = _collateralForDebt(actualRepaid);
+        position.debtPrincipal -= actualRepaid;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), actualRepaid);
+        _safeTransfer(weth, receiver, collateralSeized);
+        emit Liquidated(user, msg.sender, receiver, actualRepaid, collateralSeized);
+    }
+
+    function getPosition(address user)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debt,
+            uint256 collateralValue,
+            uint256 maxBorrow,
+            uint256 liquidationThreshold,
+            bool liquidatable
+        )
+    {
+        Position memory position = positions[user];
+        debt = _previewAccruedDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValue = _collateralValueInUsdc(collateralAmount);
+        maxBorrow = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        liquidatable = debt > liquidationThreshold;
+    }
+
+    function previewDebt(address user) external view returns (uint256) {
+        return _previewAccruedDebt(positions[user]);
+    }
+
+    function collateralValueInUsdc(address user) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[user].collateralAmount);
+    }
+
+    function _ensureHealthy(Position memory position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 maxDebt = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal > maxDebt) revert BorrowLimitExceeded();
+    }
+
+    function _accrue(Position storage position) internal {
+        position.debtPrincipal = _previewAccruedDebt(position);
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _previewAccruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) {
+            return 0;
+        }
+
+        if (position.lastAccrualTime == 0) {
+            return position.debtPrincipal;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtPrincipal * annualInterestBps * elapsed) /
+            (BPS_DENOMINATOR * SECONDS_PER_YEAR);
+        return position.debtPrincipal + interest;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return (collateralAmount * price * USDC_SCALE) / (WETH_SCALE * (10 ** oracleDecimals));
+    }
+
+    function _maxRepaySupportedByCollateral(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (collateralAmount *
+                price *
+                USDC_SCALE *
+                BPS_DENOMINATOR) /
+            (WETH_SCALE * (10 ** oracleDecimals) * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS));
+    }
+
+    function _collateralForDebt(uint256 debtAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (debtAmount *
+                WETH_SCALE *
+                (10 ** oracleDecimals) *
+                (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS)) /
+            (price * USDC_SCALE * BPS_DENOMINATOR);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 price) {
+        (, int256 answer, , uint256 updatedAt, ) = collateralOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (maxOracleDelay != 0 && block.timestamp - updatedAt > maxOracleDelay) {
+            revert StaleOraclePrice();
+        }
+        price = uint256(answer);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3587d3c09d6de25e238dcee6d94f36969dbb5065
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9c0cd8495a09290572007aebe64641e8bf69ae93
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}

codex
The core contract and notes are in place. I’m running `forge build` now to catch any Solidity-level issues, and if the compiler objects I’ll tighten the implementation rather than leaving a partial project.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
 succeeded in 203ms:
Compiling 3 files with Solc 0.8.24
Solc 0.8.24 finished in 156.29ms
Compiler run successful!
2026-09-04T04:24:50.722367Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:17:29
   |
17 |     IERC20 public immutable weth;
   |                             ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:18:29
   |
18 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:19:36
   |
19 |     IAggregatorV3 public immutable collateralOracle;
   |                                    ^^^^^^^^^^^^^^^^ help: consider using: `COLLATERAL_ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:20:28
   |
20 |     uint8 public immutable oracleDecimals;
   |                            ^^^^^^^^^^^^^^ help: consider using: `ORACLE_DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:21:30
   |
21 |     uint256 public immutable annualInterestBps;
   |                              ^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_BPS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:22:30
   |
22 |     uint256 public immutable maxOracleDelay;
   |                              ^^^^^^^^^^^^^^ help: consider using: `MAX_ORACLE_DELAY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/WethUsdcBorrowingMarket.sol:248:17
    |
248 |         price = uint256(answer);
    |                 ^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint256' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..657dd65d5e49f11444247b19950b4e3861e4d2d0
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,33 @@
+# WETH / USDC Borrowing Market Notes
+
+## Position health
+
+- Collateral is measured in WETH and valued in USDC using the configured ETH/USD oracle.
+- The contract normalizes collateral value into 6-decimal USDC units:
+  `collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20`
+  when using 18-decimal WETH, 8-decimal ETH/USD price data, and 6-decimal USDC.
+- Debt is stored in USDC base units and accrues simple interest over time:
+  `debt = principal + principal * annualRateBps * elapsed / (10000 * 365 days)`.
+- User-initiated borrowing and collateral withdrawals require:
+  `debt <= 70% of collateralValueUsdc`.
+- A position becomes liquidatable once:
+  `debt > 85% of collateralValueUsdc`.
+
+## Liquidation flow
+
+- Anyone can call `liquidate(user, requestedRepayAmount, receiver)`.
+- The liquidator must approve the market contract to pull the USDC being used for the repayment.
+- The contract first accrues interest on the target position, checks that the debt is above the 85% threshold, then computes the actual repay amount.
+- The repay amount may be lower than the caller requested if the remaining debt is smaller or if the remaining collateral cannot support a larger seizure plus the 5% bonus.
+- Collateral seized is:
+  `repaidDebt / oraclePrice`, converted into WETH units, then multiplied by `1.05`.
+- The liquidator receives seized WETH directly to `receiver`, and the borrower’s debt/collateral balances are reduced in storage.
+
+## Mainnet deployment / operations
+
+- Wire the constructor to canonical mainnet addresses only. The intended production setup is mainnet WETH, mainnet USDC, and a robust ETH/USD oracle such as Chainlink’s ETH/USD feed.
+- Set `maxOracleDelay` to a concrete freshness bound that matches the oracle’s update pattern and your monitoring posture. If it is too loose, stale prices can leak risk; if too tight, healthy operations may revert during oracle stalls.
+- Prefund the contract with USDC before allowing borrowing. This market has no lender side; it can only lend the USDC balance it already holds.
+- Choose the fixed `annualInterestBps` carefully before deployment. In this implementation it is immutable, so changing the rate requires a new market deployment.
+- Monitor oracle health, contract USDC liquidity, and positions nearing the 85% liquidation boundary. Liquidations are permissionless; operations should assume third parties will compete for them.
+- Verify decimal assumptions before deployment. This implementation assumes 18-decimal WETH and 6-decimal USDC, which is correct for canonical Ethereum mainnet tokens but should not be changed silently for other assets.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d3aed9389036f12b91050594270de553704d52f3
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,14 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+int_types = "long"
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..93fc17e694f20950b77c07427b0fc583a35f14c6
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,266 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket {
+    uint256 public constant BPS_DENOMINATOR = 10_000;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant WETH_SCALE = 1e18;
+
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable collateralOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleDelay;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrualTime;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidAnnualRate();
+    error InvalidOraclePrice();
+    error StaleOraclePrice();
+    error InsufficientLiquidity();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error TransferFailed();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed receiver, uint256 amount);
+    event Borrowed(address indexed user, address indexed receiver, uint256 amount);
+    event Repaid(address indexed user, address indexed payer, uint256 amount);
+    event Liquidated(
+        address indexed user,
+        address indexed liquidator,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 collateralSeized
+    );
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (annualInterestBps_ > BPS_DENOMINATOR) {
+            revert InvalidAnnualRate();
+        }
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        collateralOracle = IAggregatorV3(collateralOracle_);
+        oracleDecimals = IAggregatorV3(collateralOracle_).decimals();
+        annualInterestBps = annualInterestBps_;
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount -= amount;
+
+        _ensureHealthy(position);
+        _safeTransfer(weth, receiver, amount);
+        emit CollateralWithdrawn(msg.sender, receiver, amount);
+    }
+
+    function borrow(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.debtPrincipal += amount;
+
+        _ensureHealthy(position);
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, receiver, amount);
+        emit Borrowed(msg.sender, receiver, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        repaid = amount > position.debtPrincipal ? position.debtPrincipal : amount;
+        if (repaid == 0) revert RepayTooSmall();
+
+        position.debtPrincipal -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(
+        address user,
+        uint256 requestedRepayAmount,
+        address receiver
+    ) external returns (uint256 actualRepaid, uint256 collateralSeized) {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal <= liquidationThreshold) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtPrincipal
+            ? position.debtPrincipal
+            : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = _maxRepaySupportedByCollateral(position.collateralAmount);
+        actualRepaid = maxRepayFromDebt > maxRepayFromCollateral
+            ? maxRepayFromCollateral
+            : maxRepayFromDebt;
+        if (actualRepaid == 0) revert RepayTooSmall();
+
+        collateralSeized = _collateralForDebt(actualRepaid);
+        position.debtPrincipal -= actualRepaid;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), actualRepaid);
+        _safeTransfer(weth, receiver, collateralSeized);
+        emit Liquidated(user, msg.sender, receiver, actualRepaid, collateralSeized);
+    }
+
+    function getPosition(address user)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debt,
+            uint256 collateralValue,
+            uint256 maxBorrow,
+            uint256 liquidationThreshold,
+            bool liquidatable
+        )
+    {
+        Position memory position = positions[user];
+        debt = _previewAccruedDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValue = _collateralValueInUsdc(collateralAmount);
+        maxBorrow = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        liquidatable = debt > liquidationThreshold;
+    }
+
+    function previewDebt(address user) external view returns (uint256) {
+        return _previewAccruedDebt(positions[user]);
+    }
+
+    function collateralValueInUsdc(address user) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[user].collateralAmount);
+    }
+
+    function _ensureHealthy(Position memory position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 maxDebt = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal > maxDebt) revert BorrowLimitExceeded();
+    }
+
+    function _accrue(Position storage position) internal {
+        position.debtPrincipal = _previewAccruedDebt(position);
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _previewAccruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) {
+            return 0;
+        }
+
+        if (position.lastAccrualTime == 0) {
+            return position.debtPrincipal;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtPrincipal * annualInterestBps * elapsed) /
+            (BPS_DENOMINATOR * SECONDS_PER_YEAR);
+        return position.debtPrincipal + interest;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return (collateralAmount * price * USDC_SCALE) / (WETH_SCALE * (10 ** oracleDecimals));
+    }
+
+    function _maxRepaySupportedByCollateral(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (collateralAmount *
+                price *
+                USDC_SCALE *
+                BPS_DENOMINATOR) /
+            (WETH_SCALE * (10 ** oracleDecimals) * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS));
+    }
+
+    function _collateralForDebt(uint256 debtAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (debtAmount *
+                WETH_SCALE *
+                (10 ** oracleDecimals) *
+                (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS)) /
+            (price * USDC_SCALE * BPS_DENOMINATOR);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 price) {
+        (, int256 answer, , uint256 updatedAt, ) = collateralOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (maxOracleDelay != 0 && block.timestamp - updatedAt > maxOracleDelay) {
+            revert StaleOraclePrice();
+        }
+        price = uint256(answer);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3587d3c09d6de25e238dcee6d94f36969dbb5065
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9c0cd8495a09290572007aebe64641e8bf69ae93
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}

codex
`forge build` passed, but I’m cleaning the contract naming and the one safe-cast lint warning so the project is not left with avoidable noise. This doesn’t change behavior; it just makes the codebase tighter for handoff.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/src/WethUsdcBorrowingMarket.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..657dd65d5e49f11444247b19950b4e3861e4d2d0
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,33 @@
+# WETH / USDC Borrowing Market Notes
+
+## Position health
+
+- Collateral is measured in WETH and valued in USDC using the configured ETH/USD oracle.
+- The contract normalizes collateral value into 6-decimal USDC units:
+  `collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20`
+  when using 18-decimal WETH, 8-decimal ETH/USD price data, and 6-decimal USDC.
+- Debt is stored in USDC base units and accrues simple interest over time:
+  `debt = principal + principal * annualRateBps * elapsed / (10000 * 365 days)`.
+- User-initiated borrowing and collateral withdrawals require:
+  `debt <= 70% of collateralValueUsdc`.
+- A position becomes liquidatable once:
+  `debt > 85% of collateralValueUsdc`.
+
+## Liquidation flow
+
+- Anyone can call `liquidate(user, requestedRepayAmount, receiver)`.
+- The liquidator must approve the market contract to pull the USDC being used for the repayment.
+- The contract first accrues interest on the target position, checks that the debt is above the 85% threshold, then computes the actual repay amount.
+- The repay amount may be lower than the caller requested if the remaining debt is smaller or if the remaining collateral cannot support a larger seizure plus the 5% bonus.
+- Collateral seized is:
+  `repaidDebt / oraclePrice`, converted into WETH units, then multiplied by `1.05`.
+- The liquidator receives seized WETH directly to `receiver`, and the borrower’s debt/collateral balances are reduced in storage.
+
+## Mainnet deployment / operations
+
+- Wire the constructor to canonical mainnet addresses only. The intended production setup is mainnet WETH, mainnet USDC, and a robust ETH/USD oracle such as Chainlink’s ETH/USD feed.
+- Set `maxOracleDelay` to a concrete freshness bound that matches the oracle’s update pattern and your monitoring posture. If it is too loose, stale prices can leak risk; if too tight, healthy operations may revert during oracle stalls.
+- Prefund the contract with USDC before allowing borrowing. This market has no lender side; it can only lend the USDC balance it already holds.
+- Choose the fixed `annualInterestBps` carefully before deployment. In this implementation it is immutable, so changing the rate requires a new market deployment.
+- Monitor oracle health, contract USDC liquidity, and positions nearing the 85% liquidation boundary. Liquidations are permissionless; operations should assume third parties will compete for them.
+- Verify decimal assumptions before deployment. This implementation assumes 18-decimal WETH and 6-decimal USDC, which is correct for canonical Ethereum mainnet tokens but should not be changed silently for other assets.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d3aed9389036f12b91050594270de553704d52f3
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,14 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+int_types = "long"
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3891deb58c516c8d7ab9501b541f0aecaf2c7ea5
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,267 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket {
+    uint256 public constant BPS_DENOMINATOR = 10_000;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant WETH_SCALE = 1e18;
+
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint8 public immutable ORACLE_DECIMALS;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrualTime;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidAnnualRate();
+    error InvalidOraclePrice();
+    error StaleOraclePrice();
+    error InsufficientLiquidity();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error TransferFailed();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed receiver, uint256 amount);
+    event Borrowed(address indexed user, address indexed receiver, uint256 amount);
+    event Repaid(address indexed user, address indexed payer, uint256 amount);
+    event Liquidated(
+        address indexed user,
+        address indexed liquidator,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 collateralSeized
+    );
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (annualInterestBps_ > BPS_DENOMINATOR) {
+            revert InvalidAnnualRate();
+        }
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IAggregatorV3(collateralOracle_);
+        ORACLE_DECIMALS = IAggregatorV3(collateralOracle_).decimals();
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount -= amount;
+
+        _ensureHealthy(position);
+        _safeTransfer(WETH, receiver, amount);
+        emit CollateralWithdrawn(msg.sender, receiver, amount);
+    }
+
+    function borrow(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.debtPrincipal += amount;
+
+        _ensureHealthy(position);
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, receiver, amount);
+        emit Borrowed(msg.sender, receiver, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        repaid = amount > position.debtPrincipal ? position.debtPrincipal : amount;
+        if (repaid == 0) revert RepayTooSmall();
+
+        position.debtPrincipal -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(
+        address user,
+        uint256 requestedRepayAmount,
+        address receiver
+    ) external returns (uint256 actualRepaid, uint256 collateralSeized) {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal <= liquidationThreshold) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtPrincipal
+            ? position.debtPrincipal
+            : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = _maxRepaySupportedByCollateral(position.collateralAmount);
+        actualRepaid = maxRepayFromDebt > maxRepayFromCollateral
+            ? maxRepayFromCollateral
+            : maxRepayFromDebt;
+        if (actualRepaid == 0) revert RepayTooSmall();
+
+        collateralSeized = _collateralForDebt(actualRepaid);
+        position.debtPrincipal -= actualRepaid;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), actualRepaid);
+        _safeTransfer(WETH, receiver, collateralSeized);
+        emit Liquidated(user, msg.sender, receiver, actualRepaid, collateralSeized);
+    }
+
+    function getPosition(address user)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debt,
+            uint256 collateralValue,
+            uint256 maxBorrow,
+            uint256 liquidationThreshold,
+            bool liquidatable
+        )
+    {
+        Position memory position = positions[user];
+        debt = _previewAccruedDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValue = _collateralValueInUsdc(collateralAmount);
+        maxBorrow = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        liquidatable = debt > liquidationThreshold;
+    }
+
+    function previewDebt(address user) external view returns (uint256) {
+        return _previewAccruedDebt(positions[user]);
+    }
+
+    function collateralValueInUsdc(address user) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[user].collateralAmount);
+    }
+
+    function _ensureHealthy(Position memory position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 maxDebt = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal > maxDebt) revert BorrowLimitExceeded();
+    }
+
+    function _accrue(Position storage position) internal {
+        position.debtPrincipal = _previewAccruedDebt(position);
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _previewAccruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) {
+            return 0;
+        }
+
+        if (position.lastAccrualTime == 0) {
+            return position.debtPrincipal;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtPrincipal * ANNUAL_INTEREST_BPS * elapsed) /
+            (BPS_DENOMINATOR * SECONDS_PER_YEAR);
+        return position.debtPrincipal + interest;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return (collateralAmount * price * USDC_SCALE) / (WETH_SCALE * (10 ** ORACLE_DECIMALS));
+    }
+
+    function _maxRepaySupportedByCollateral(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (collateralAmount *
+                price *
+                USDC_SCALE *
+                BPS_DENOMINATOR) /
+            (WETH_SCALE * (10 ** ORACLE_DECIMALS) * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS));
+    }
+
+    function _collateralForDebt(uint256 debtAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (debtAmount *
+                WETH_SCALE *
+                (10 ** ORACLE_DECIMALS) *
+                (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS)) /
+            (price * USDC_SCALE * BPS_DENOMINATOR);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 price) {
+        (, int256 answer, , uint256 updatedAt, ) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (MAX_ORACLE_DELAY != 0 && block.timestamp - updatedAt > MAX_ORACLE_DELAY) {
+            revert StaleOraclePrice();
+        }
+        // forge-lint: disable-next-line(unsafe-typecast)
+        price = uint256(answer);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3587d3c09d6de25e238dcee6d94f36969dbb5065
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9c0cd8495a09290572007aebe64641e8bf69ae93
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..657dd65d5e49f11444247b19950b4e3861e4d2d0
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,33 @@
+# WETH / USDC Borrowing Market Notes
+
+## Position health
+
+- Collateral is measured in WETH and valued in USDC using the configured ETH/USD oracle.
+- The contract normalizes collateral value into 6-decimal USDC units:
+  `collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20`
+  when using 18-decimal WETH, 8-decimal ETH/USD price data, and 6-decimal USDC.
+- Debt is stored in USDC base units and accrues simple interest over time:
+  `debt = principal + principal * annualRateBps * elapsed / (10000 * 365 days)`.
+- User-initiated borrowing and collateral withdrawals require:
+  `debt <= 70% of collateralValueUsdc`.
+- A position becomes liquidatable once:
+  `debt > 85% of collateralValueUsdc`.
+
+## Liquidation flow
+
+- Anyone can call `liquidate(user, requestedRepayAmount, receiver)`.
+- The liquidator must approve the market contract to pull the USDC being used for the repayment.
+- The contract first accrues interest on the target position, checks that the debt is above the 85% threshold, then computes the actual repay amount.
+- The repay amount may be lower than the caller requested if the remaining debt is smaller or if the remaining collateral cannot support a larger seizure plus the 5% bonus.
+- Collateral seized is:
+  `repaidDebt / oraclePrice`, converted into WETH units, then multiplied by `1.05`.
+- The liquidator receives seized WETH directly to `receiver`, and the borrower’s debt/collateral balances are reduced in storage.
+
+## Mainnet deployment / operations
+
+- Wire the constructor to canonical mainnet addresses only. The intended production setup is mainnet WETH, mainnet USDC, and a robust ETH/USD oracle such as Chainlink’s ETH/USD feed.
+- Set `maxOracleDelay` to a concrete freshness bound that matches the oracle’s update pattern and your monitoring posture. If it is too loose, stale prices can leak risk; if too tight, healthy operations may revert during oracle stalls.
+- Prefund the contract with USDC before allowing borrowing. This market has no lender side; it can only lend the USDC balance it already holds.
+- Choose the fixed `annualInterestBps` carefully before deployment. In this implementation it is immutable, so changing the rate requires a new market deployment.
+- Monitor oracle health, contract USDC liquidity, and positions nearing the 85% liquidation boundary. Liquidations are permissionless; operations should assume third parties will compete for them.
+- Verify decimal assumptions before deployment. This implementation assumes 18-decimal WETH and 6-decimal USDC, which is correct for canonical Ethereum mainnet tokens but should not be changed silently for other assets.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d3aed9389036f12b91050594270de553704d52f3
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,14 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+int_types = "long"
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3891deb58c516c8d7ab9501b541f0aecaf2c7ea5
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,267 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket {
+    uint256 public constant BPS_DENOMINATOR = 10_000;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant WETH_SCALE = 1e18;
+
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint8 public immutable ORACLE_DECIMALS;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrualTime;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidAnnualRate();
+    error InvalidOraclePrice();
+    error StaleOraclePrice();
+    error InsufficientLiquidity();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error TransferFailed();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed receiver, uint256 amount);
+    event Borrowed(address indexed user, address indexed receiver, uint256 amount);
+    event Repaid(address indexed user, address indexed payer, uint256 amount);
+    event Liquidated(
+        address indexed user,
+        address indexed liquidator,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 collateralSeized
+    );
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (annualInterestBps_ > BPS_DENOMINATOR) {
+            revert InvalidAnnualRate();
+        }
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IAggregatorV3(collateralOracle_);
+        ORACLE_DECIMALS = IAggregatorV3(collateralOracle_).decimals();
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount -= amount;
+
+        _ensureHealthy(position);
+        _safeTransfer(WETH, receiver, amount);
+        emit CollateralWithdrawn(msg.sender, receiver, amount);
+    }
+
+    function borrow(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.debtPrincipal += amount;
+
+        _ensureHealthy(position);
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, receiver, amount);
+        emit Borrowed(msg.sender, receiver, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        repaid = amount > position.debtPrincipal ? position.debtPrincipal : amount;
+        if (repaid == 0) revert RepayTooSmall();
+
+        position.debtPrincipal -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(
+        address user,
+        uint256 requestedRepayAmount,
+        address receiver
+    ) external returns (uint256 actualRepaid, uint256 collateralSeized) {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal <= liquidationThreshold) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtPrincipal
+            ? position.debtPrincipal
+            : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = _maxRepaySupportedByCollateral(position.collateralAmount);
+        actualRepaid = maxRepayFromDebt > maxRepayFromCollateral
+            ? maxRepayFromCollateral
+            : maxRepayFromDebt;
+        if (actualRepaid == 0) revert RepayTooSmall();
+
+        collateralSeized = _collateralForDebt(actualRepaid);
+        position.debtPrincipal -= actualRepaid;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), actualRepaid);
+        _safeTransfer(WETH, receiver, collateralSeized);
+        emit Liquidated(user, msg.sender, receiver, actualRepaid, collateralSeized);
+    }
+
+    function getPosition(address user)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debt,
+            uint256 collateralValue,
+            uint256 maxBorrow,
+            uint256 liquidationThreshold,
+            bool liquidatable
+        )
+    {
+        Position memory position = positions[user];
+        debt = _previewAccruedDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValue = _collateralValueInUsdc(collateralAmount);
+        maxBorrow = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        liquidatable = debt > liquidationThreshold;
+    }
+
+    function previewDebt(address user) external view returns (uint256) {
+        return _previewAccruedDebt(positions[user]);
+    }
+
+    function collateralValueInUsdc(address user) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[user].collateralAmount);
+    }
+
+    function _ensureHealthy(Position memory position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 maxDebt = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal > maxDebt) revert BorrowLimitExceeded();
+    }
+
+    function _accrue(Position storage position) internal {
+        position.debtPrincipal = _previewAccruedDebt(position);
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _previewAccruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) {
+            return 0;
+        }
+
+        if (position.lastAccrualTime == 0) {
+            return position.debtPrincipal;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtPrincipal * ANNUAL_INTEREST_BPS * elapsed) /
+            (BPS_DENOMINATOR * SECONDS_PER_YEAR);
+        return position.debtPrincipal + interest;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return (collateralAmount * price * USDC_SCALE) / (WETH_SCALE * (10 ** ORACLE_DECIMALS));
+    }
+
+    function _maxRepaySupportedByCollateral(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (collateralAmount *
+                price *
+                USDC_SCALE *
+                BPS_DENOMINATOR) /
+            (WETH_SCALE * (10 ** ORACLE_DECIMALS) * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS));
+    }
+
+    function _collateralForDebt(uint256 debtAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (debtAmount *
+                WETH_SCALE *
+                (10 ** ORACLE_DECIMALS) *
+                (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS)) /
+            (price * USDC_SCALE * BPS_DENOMINATOR);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 price) {
+        (, int256 answer, , uint256 updatedAt, ) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (MAX_ORACLE_DELAY != 0 && block.timestamp - updatedAt > MAX_ORACLE_DELAY) {
+            revert StaleOraclePrice();
+        }
+        // forge-lint: disable-next-line(unsafe-typecast)
+        price = uint256(answer);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3587d3c09d6de25e238dcee6d94f36969dbb5065
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9c0cd8495a09290572007aebe64641e8bf69ae93
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}

codex
I’ve applied the cleanup patch and I’m rebuilding once more to confirm the final tree is compile-clean, not just compile-capable.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
 succeeded in 169ms:
Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 128.28ms
Compiler run successful!
2026-09-04T04:25:14.533251Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..657dd65d5e49f11444247b19950b4e3861e4d2d0
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,33 @@
+# WETH / USDC Borrowing Market Notes
+
+## Position health
+
+- Collateral is measured in WETH and valued in USDC using the configured ETH/USD oracle.
+- The contract normalizes collateral value into 6-decimal USDC units:
+  `collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20`
+  when using 18-decimal WETH, 8-decimal ETH/USD price data, and 6-decimal USDC.
+- Debt is stored in USDC base units and accrues simple interest over time:
+  `debt = principal + principal * annualRateBps * elapsed / (10000 * 365 days)`.
+- User-initiated borrowing and collateral withdrawals require:
+  `debt <= 70% of collateralValueUsdc`.
+- A position becomes liquidatable once:
+  `debt > 85% of collateralValueUsdc`.
+
+## Liquidation flow
+
+- Anyone can call `liquidate(user, requestedRepayAmount, receiver)`.
+- The liquidator must approve the market contract to pull the USDC being used for the repayment.
+- The contract first accrues interest on the target position, checks that the debt is above the 85% threshold, then computes the actual repay amount.
+- The repay amount may be lower than the caller requested if the remaining debt is smaller or if the remaining collateral cannot support a larger seizure plus the 5% bonus.
+- Collateral seized is:
+  `repaidDebt / oraclePrice`, converted into WETH units, then multiplied by `1.05`.
+- The liquidator receives seized WETH directly to `receiver`, and the borrower’s debt/collateral balances are reduced in storage.
+
+## Mainnet deployment / operations
+
+- Wire the constructor to canonical mainnet addresses only. The intended production setup is mainnet WETH, mainnet USDC, and a robust ETH/USD oracle such as Chainlink’s ETH/USD feed.
+- Set `maxOracleDelay` to a concrete freshness bound that matches the oracle’s update pattern and your monitoring posture. If it is too loose, stale prices can leak risk; if too tight, healthy operations may revert during oracle stalls.
+- Prefund the contract with USDC before allowing borrowing. This market has no lender side; it can only lend the USDC balance it already holds.
+- Choose the fixed `annualInterestBps` carefully before deployment. In this implementation it is immutable, so changing the rate requires a new market deployment.
+- Monitor oracle health, contract USDC liquidity, and positions nearing the 85% liquidation boundary. Liquidations are permissionless; operations should assume third parties will compete for them.
+- Verify decimal assumptions before deployment. This implementation assumes 18-decimal WETH and 6-decimal USDC, which is correct for canonical Ethereum mainnet tokens but should not be changed silently for other assets.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d3aed9389036f12b91050594270de553704d52f3
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,14 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+int_types = "long"
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3891deb58c516c8d7ab9501b541f0aecaf2c7ea5
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,267 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket {
+    uint256 public constant BPS_DENOMINATOR = 10_000;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant WETH_SCALE = 1e18;
+
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint8 public immutable ORACLE_DECIMALS;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrualTime;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidAnnualRate();
+    error InvalidOraclePrice();
+    error StaleOraclePrice();
+    error InsufficientLiquidity();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error TransferFailed();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed receiver, uint256 amount);
+    event Borrowed(address indexed user, address indexed receiver, uint256 amount);
+    event Repaid(address indexed user, address indexed payer, uint256 amount);
+    event Liquidated(
+        address indexed user,
+        address indexed liquidator,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 collateralSeized
+    );
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (annualInterestBps_ > BPS_DENOMINATOR) {
+            revert InvalidAnnualRate();
+        }
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IAggregatorV3(collateralOracle_);
+        ORACLE_DECIMALS = IAggregatorV3(collateralOracle_).decimals();
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount -= amount;
+
+        _ensureHealthy(position);
+        _safeTransfer(WETH, receiver, amount);
+        emit CollateralWithdrawn(msg.sender, receiver, amount);
+    }
+
+    function borrow(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.debtPrincipal += amount;
+
+        _ensureHealthy(position);
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, receiver, amount);
+        emit Borrowed(msg.sender, receiver, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        repaid = amount > position.debtPrincipal ? position.debtPrincipal : amount;
+        if (repaid == 0) revert RepayTooSmall();
+
+        position.debtPrincipal -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(
+        address user,
+        uint256 requestedRepayAmount,
+        address receiver
+    ) external returns (uint256 actualRepaid, uint256 collateralSeized) {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal <= liquidationThreshold) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtPrincipal
+            ? position.debtPrincipal
+            : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = _maxRepaySupportedByCollateral(position.collateralAmount);
+        actualRepaid = maxRepayFromDebt > maxRepayFromCollateral
+            ? maxRepayFromCollateral
+            : maxRepayFromDebt;
+        if (actualRepaid == 0) revert RepayTooSmall();
+
+        collateralSeized = _collateralForDebt(actualRepaid);
+        position.debtPrincipal -= actualRepaid;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), actualRepaid);
+        _safeTransfer(WETH, receiver, collateralSeized);
+        emit Liquidated(user, msg.sender, receiver, actualRepaid, collateralSeized);
+    }
+
+    function getPosition(address user)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debt,
+            uint256 collateralValue,
+            uint256 maxBorrow,
+            uint256 liquidationThreshold,
+            bool liquidatable
+        )
+    {
+        Position memory position = positions[user];
+        debt = _previewAccruedDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValue = _collateralValueInUsdc(collateralAmount);
+        maxBorrow = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        liquidatable = debt > liquidationThreshold;
+    }
+
+    function previewDebt(address user) external view returns (uint256) {
+        return _previewAccruedDebt(positions[user]);
+    }
+
+    function collateralValueInUsdc(address user) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[user].collateralAmount);
+    }
+
+    function _ensureHealthy(Position memory position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 maxDebt = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal > maxDebt) revert BorrowLimitExceeded();
+    }
+
+    function _accrue(Position storage position) internal {
+        position.debtPrincipal = _previewAccruedDebt(position);
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _previewAccruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) {
+            return 0;
+        }
+
+        if (position.lastAccrualTime == 0) {
+            return position.debtPrincipal;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtPrincipal * ANNUAL_INTEREST_BPS * elapsed) /
+            (BPS_DENOMINATOR * SECONDS_PER_YEAR);
+        return position.debtPrincipal + interest;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return (collateralAmount * price * USDC_SCALE) / (WETH_SCALE * (10 ** ORACLE_DECIMALS));
+    }
+
+    function _maxRepaySupportedByCollateral(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (collateralAmount *
+                price *
+                USDC_SCALE *
+                BPS_DENOMINATOR) /
+            (WETH_SCALE * (10 ** ORACLE_DECIMALS) * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS));
+    }
+
+    function _collateralForDebt(uint256 debtAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (debtAmount *
+                WETH_SCALE *
+                (10 ** ORACLE_DECIMALS) *
+                (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS)) /
+            (price * USDC_SCALE * BPS_DENOMINATOR);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 price) {
+        (, int256 answer, , uint256 updatedAt, ) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (MAX_ORACLE_DELAY != 0 && block.timestamp - updatedAt > MAX_ORACLE_DELAY) {
+            revert StaleOraclePrice();
+        }
+        // forge-lint: disable-next-line(unsafe-typecast)
+        price = uint256(answer);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3587d3c09d6de25e238dcee6d94f36969dbb5065
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9c0cd8495a09290572007aebe64641e8bf69ae93
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}

codex
The project now builds successfully. I’m doing one final pass over the workspace state so I can hand back the exact deliverables and any residual caveats, rather than a vague summary.
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
exec
/bin/bash -lc "sed -n '1,260p' src/WethUsdcBorrowingMarket.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
 succeeded in 7ms:
?? NOTES.md
?? foundry.toml
?? src/

 succeeded in 5ms:
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

contract WethUsdcBorrowingMarket {
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant USDC_SCALE = 1e6;
    uint256 public constant WETH_SCALE = 1e18;

    uint256 public constant MAX_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    IAggregatorV3 public immutable COLLATERAL_ORACLE;
    uint8 public immutable ORACLE_DECIMALS;
    uint256 public immutable ANNUAL_INTEREST_BPS;
    uint256 public immutable MAX_ORACLE_DELAY;

    struct Position {
        uint256 collateralAmount;
        uint256 debtPrincipal;
        uint256 lastAccrualTime;
    }

    mapping(address => Position) public positions;

    error ZeroAmount();
    error InvalidAddress();
    error InvalidAnnualRate();
    error InvalidOraclePrice();
    error StaleOraclePrice();
    error InsufficientLiquidity();
    error BorrowLimitExceeded();
    error PositionNotLiquidatable();
    error RepayTooSmall();
    error TransferFailed();

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed receiver, uint256 amount);
    event Borrowed(address indexed user, address indexed receiver, uint256 amount);
    event Repaid(address indexed user, address indexed payer, uint256 amount);
    event Liquidated(
        address indexed user,
        address indexed liquidator,
        address indexed receiver,
        uint256 repaidDebt,
        uint256 collateralSeized
    );

    constructor(
        address weth_,
        address usdc_,
        address collateralOracle_,
        uint256 annualInterestBps_,
        uint256 maxOracleDelay_
    ) {
        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) {
            revert InvalidAddress();
        }
        if (annualInterestBps_ > BPS_DENOMINATOR) {
            revert InvalidAnnualRate();
        }
        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        COLLATERAL_ORACLE = IAggregatorV3(collateralOracle_);
        ORACLE_DECIMALS = IAggregatorV3(collateralOracle_).decimals();
        ANNUAL_INTEREST_BPS = annualInterestBps_;
        MAX_ORACLE_DELAY = maxOracleDelay_;
    }

    function depositCollateral(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrue(position);
        position.collateralAmount += amount;

        _safeTransferFrom(WETH, msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount, address receiver) external {
        if (amount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert InvalidAddress();

        Position storage position = positions[msg.sender];
        _accrue(position);
        position.collateralAmount -= amount;

        _ensureHealthy(position);
        _safeTransfer(WETH, receiver, amount);
        emit CollateralWithdrawn(msg.sender, receiver, amount);
    }

    function borrow(uint256 amount, address receiver) external {
        if (amount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert InvalidAddress();

        Position storage position = positions[msg.sender];
        _accrue(position);
        position.debtPrincipal += amount;

        _ensureHealthy(position);
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        _safeTransfer(USDC, receiver, amount);
        emit Borrowed(msg.sender, receiver, amount);
    }

    function repay(uint256 amount) external returns (uint256 repaid) {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrue(position);

        repaid = amount > position.debtPrincipal ? position.debtPrincipal : amount;
        if (repaid == 0) revert RepayTooSmall();

        position.debtPrincipal -= repaid;
        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
        emit Repaid(msg.sender, msg.sender, repaid);
    }

    function liquidate(
        address user,
        uint256 requestedRepayAmount,
        address receiver
    ) external returns (uint256 actualRepaid, uint256 collateralSeized) {
        if (requestedRepayAmount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert InvalidAddress();

        Position storage position = positions[user];
        _accrue(position);

        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
        uint256 liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
        if (position.debtPrincipal <= liquidationThreshold) revert PositionNotLiquidatable();

        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtPrincipal
            ? position.debtPrincipal
            : requestedRepayAmount;
        uint256 maxRepayFromCollateral = _maxRepaySupportedByCollateral(position.collateralAmount);
        actualRepaid = maxRepayFromDebt > maxRepayFromCollateral
            ? maxRepayFromCollateral
            : maxRepayFromDebt;
        if (actualRepaid == 0) revert RepayTooSmall();

        collateralSeized = _collateralForDebt(actualRepaid);
        position.debtPrincipal -= actualRepaid;
        position.collateralAmount -= collateralSeized;

        _safeTransferFrom(USDC, msg.sender, address(this), actualRepaid);
        _safeTransfer(WETH, receiver, collateralSeized);
        emit Liquidated(user, msg.sender, receiver, actualRepaid, collateralSeized);
    }

    function getPosition(address user)
        external
        view
        returns (
            uint256 collateralAmount,
            uint256 debt,
            uint256 collateralValue,
            uint256 maxBorrow,
            uint256 liquidationThreshold,
            bool liquidatable
        )
    {
        Position memory position = positions[user];
        debt = _previewAccruedDebt(position);
        collateralAmount = position.collateralAmount;
        collateralValue = _collateralValueInUsdc(collateralAmount);
        maxBorrow = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
        liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
        liquidatable = debt > liquidationThreshold;
    }

    function previewDebt(address user) external view returns (uint256) {
        return _previewAccruedDebt(positions[user]);
    }

    function collateralValueInUsdc(address user) external view returns (uint256) {
        return _collateralValueInUsdc(positions[user].collateralAmount);
    }

    function _ensureHealthy(Position memory position) internal view {
        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
        uint256 maxDebt = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
        if (position.debtPrincipal > maxDebt) revert BorrowLimitExceeded();
    }

    function _accrue(Position storage position) internal {
        position.debtPrincipal = _previewAccruedDebt(position);
        position.lastAccrualTime = block.timestamp;
    }

    function _previewAccruedDebt(Position memory position) internal view returns (uint256) {
        if (position.debtPrincipal == 0) {
            return 0;
        }

        if (position.lastAccrualTime == 0) {
            return position.debtPrincipal;
        }

        uint256 elapsed = block.timestamp - position.lastAccrualTime;
        uint256 interest = (position.debtPrincipal * ANNUAL_INTEREST_BPS * elapsed) /
            (BPS_DENOMINATOR * SECONDS_PER_YEAR);
        return position.debtPrincipal + interest;
    }

    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
        uint256 price = _readOraclePrice();
        return (collateralAmount * price * USDC_SCALE) / (WETH_SCALE * (10 ** ORACLE_DECIMALS));
    }

    function _maxRepaySupportedByCollateral(uint256 collateralAmount) internal view returns (uint256) {
        uint256 price = _readOraclePrice();
        return
            (collateralAmount *
                price *
                USDC_SCALE *
                BPS_DENOMINATOR) /
            (WETH_SCALE * (10 ** ORACLE_DECIMALS) * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS));
    }

    function _collateralForDebt(uint256 debtAmount) internal view returns (uint256) {
        uint256 price = _readOraclePrice();
        return
            (debtAmount *
                WETH_SCALE *
                (10 ** ORACLE_DECIMALS) *
                (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS)) /
            (price * USDC_SCALE * BPS_DENOMINATOR);
    }

    function _readOraclePrice() internal view returns (uint256 price) {
        (, int256 answer, , uint256 updatedAt, ) = COLLATERAL_ORACLE.latestRoundData();
        if (answer <= 0) revert InvalidOraclePrice();
        if (MAX_ORACLE_DELAY != 0 && block.timestamp - updatedAt > MAX_ORACLE_DELAY) {
            revert StaleOraclePrice();
        }
        // forge-lint: disable-next-line(unsafe-typecast)
        price = uint256(answer);
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
        (bool success, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {

exec
/bin/bash -lc "sed -n '1,240p' NOTES.md" in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002
 succeeded in 0ms:
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..657dd65d5e49f11444247b19950b4e3861e4d2d0
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,33 @@
+# WETH / USDC Borrowing Market Notes
+
+## Position health
+
+- Collateral is measured in WETH and valued in USDC using the configured ETH/USD oracle.
+- The contract normalizes collateral value into 6-decimal USDC units:
+  `collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20`
+  when using 18-decimal WETH, 8-decimal ETH/USD price data, and 6-decimal USDC.
+- Debt is stored in USDC base units and accrues simple interest over time:
+  `debt = principal + principal * annualRateBps * elapsed / (10000 * 365 days)`.
+- User-initiated borrowing and collateral withdrawals require:
+  `debt <= 70% of collateralValueUsdc`.
+- A position becomes liquidatable once:
+  `debt > 85% of collateralValueUsdc`.
+
+## Liquidation flow
+
+- Anyone can call `liquidate(user, requestedRepayAmount, receiver)`.
+- The liquidator must approve the market contract to pull the USDC being used for the repayment.
+- The contract first accrues interest on the target position, checks that the debt is above the 85% threshold, then computes the actual repay amount.
+- The repay amount may be lower than the caller requested if the remaining debt is smaller or if the remaining collateral cannot support a larger seizure plus the 5% bonus.
+- Collateral seized is:
+  `repaidDebt / oraclePrice`, converted into WETH units, then multiplied by `1.05`.
+- The liquidator receives seized WETH directly to `receiver`, and the borrower’s debt/collateral balances are reduced in storage.
+
+## Mainnet deployment / operations
+
+- Wire the constructor to canonical mainnet addresses only. The intended production setup is mainnet WETH, mainnet USDC, and a robust ETH/USD oracle such as Chainlink’s ETH/USD feed.
+- Set `maxOracleDelay` to a concrete freshness bound that matches the oracle’s update pattern and your monitoring posture. If it is too loose, stale prices can leak risk; if too tight, healthy operations may revert during oracle stalls.
+- Prefund the contract with USDC before allowing borrowing. This market has no lender side; it can only lend the USDC balance it already holds.
+- Choose the fixed `annualInterestBps` carefully before deployment. In this implementation it is immutable, so changing the rate requires a new market deployment.
+- Monitor oracle health, contract USDC liquidity, and positions nearing the 85% liquidation boundary. Liquidations are permissionless; operations should assume third parties will compete for them.
+- Verify decimal assumptions before deployment. This implementation assumes 18-decimal WETH and 6-decimal USDC, which is correct for canonical Ethereum mainnet tokens but should not be changed silently for other assets.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d3aed9389036f12b91050594270de553704d52f3
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,14 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+int_types = "long"
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3891deb58c516c8d7ab9501b541f0aecaf2c7ea5
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,267 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket {
+    uint256 public constant BPS_DENOMINATOR = 10_000;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant WETH_SCALE = 1e18;
+
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint8 public immutable ORACLE_DECIMALS;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrualTime;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidAnnualRate();
+    error InvalidOraclePrice();
+    error StaleOraclePrice();
+    error InsufficientLiquidity();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error TransferFailed();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed receiver, uint256 amount);
+    event Borrowed(address indexed user, address indexed receiver, uint256 amount);
+    event Repaid(address indexed user, address indexed payer, uint256 amount);
+    event Liquidated(
+        address indexed user,
+        address indexed liquidator,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 collateralSeized
+    );
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (annualInterestBps_ > BPS_DENOMINATOR) {
+            revert InvalidAnnualRate();
+        }
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IAggregatorV3(collateralOracle_);
+        ORACLE_DECIMALS = IAggregatorV3(collateralOracle_).decimals();
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount -= amount;
+
+        _ensureHealthy(position);
+        _safeTransfer(WETH, receiver, amount);
+        emit CollateralWithdrawn(msg.sender, receiver, amount);
+    }
+
+    function borrow(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.debtPrincipal += amount;
+
+        _ensureHealthy(position);
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, receiver, amount);
+        emit Borrowed(msg.sender, receiver, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        repaid = amount > position.debtPrincipal ? position.debtPrincipal : amount;
+        if (repaid == 0) revert RepayTooSmall();
+
+        position.debtPrincipal -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(
+        address user,
+        uint256 requestedRepayAmount,
+        address receiver
+    ) external returns (uint256 actualRepaid, uint256 collateralSeized) {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal <= liquidationThreshold) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtPrincipal
+            ? position.debtPrincipal
+            : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = _maxRepaySupportedByCollateral(position.collateralAmount);
+        actualRepaid = maxRepayFromDebt > maxRepayFromCollateral
+            ? maxRepayFromCollateral
+            : maxRepayFromDebt;
+        if (actualRepaid == 0) revert RepayTooSmall();
+
+        collateralSeized = _collateralForDebt(actualRepaid);
+        position.debtPrincipal -= actualRepaid;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), actualRepaid);
+        _safeTransfer(WETH, receiver, collateralSeized);
+        emit Liquidated(user, msg.sender, receiver, actualRepaid, collateralSeized);
+    }
+
+    function getPosition(address user)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debt,
+            uint256 collateralValue,
+            uint256 maxBorrow,
+            uint256 liquidationThreshold,
+            bool liquidatable
+        )
+    {
+        Position memory position = positions[user];
+        debt = _previewAccruedDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValue = _collateralValueInUsdc(collateralAmount);
+        maxBorrow = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        liquidatable = debt > liquidationThreshold;
+    }
+
+    function previewDebt(address user) external view returns (uint256) {
+        return _previewAccruedDebt(positions[user]);
+    }
+
+    function collateralValueInUsdc(address user) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[user].collateralAmount);
+    }
+
+    function _ensureHealthy(Position memory position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 maxDebt = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal > maxDebt) revert BorrowLimitExceeded();
+    }
+
+    function _accrue(Position storage position) internal {
+        position.debtPrincipal = _previewAccruedDebt(position);
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _previewAccruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) {
+            return 0;
+        }
+
+        if (position.lastAccrualTime == 0) {
+            return position.debtPrincipal;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtPrincipal * ANNUAL_INTEREST_BPS * elapsed) /
+            (BPS_DENOMINATOR * SECONDS_PER_YEAR);
+        return position.debtPrincipal + interest;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return (collateralAmount * price * USDC_SCALE) / (WETH_SCALE * (10 ** ORACLE_DECIMALS));
+    }
+
+    function _maxRepaySupportedByCollateral(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (collateralAmount *
+                price *
+                USDC_SCALE *
+                BPS_DENOMINATOR) /
+            (WETH_SCALE * (10 ** ORACLE_DECIMALS) * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS));
+    }
+
+    function _collateralForDebt(uint256 debtAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (debtAmount *
+                WETH_SCALE *
+                (10 ** ORACLE_DECIMALS) *
+                (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS)) /
+            (price * USDC_SCALE * BPS_DENOMINATOR);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 price) {
+        (, int256 answer, , uint256 updatedAt, ) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (MAX_ORACLE_DELAY != 0 && block.timestamp - updatedAt > MAX_ORACLE_DELAY) {
+            revert StaleOraclePrice();
+        }
+        // forge-lint: disable-next-line(unsafe-typecast)
+        price = uint256(answer);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3587d3c09d6de25e238dcee6d94f36969dbb5065
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9c0cd8495a09290572007aebe64641e8bf69ae93
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}

codex
Built a minimal Foundry project for the onchain market in [src/WethUsdcBorrowingMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/src/WethUsdcBorrowingMarket.sol) with local interfaces and config in [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/foundry.toml). The contract lets users deposit WETH, borrow USDC up to 70% LTV, accrue flat simple interest over time, repay debt, withdraw collateral while still within the 70% limit, and permissionlessly liquidate positions once debt exceeds 85% LTV with a 5% WETH bonus to the liquidator.

I also added [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/NOTES.md) covering health computation, liquidation mechanics, and mainnet deployment/operator requirements, including oracle freshness, immutable rate selection, decimal assumptions, and the need to prefund USDC liquidity.

Verification: `forge build` succeeds. I did not add tests.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..657dd65d5e49f11444247b19950b4e3861e4d2d0
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,33 @@
+# WETH / USDC Borrowing Market Notes
+
+## Position health
+
+- Collateral is measured in WETH and valued in USDC using the configured ETH/USD oracle.
+- The contract normalizes collateral value into 6-decimal USDC units:
+  `collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20`
+  when using 18-decimal WETH, 8-decimal ETH/USD price data, and 6-decimal USDC.
+- Debt is stored in USDC base units and accrues simple interest over time:
+  `debt = principal + principal * annualRateBps * elapsed / (10000 * 365 days)`.
+- User-initiated borrowing and collateral withdrawals require:
+  `debt <= 70% of collateralValueUsdc`.
+- A position becomes liquidatable once:
+  `debt > 85% of collateralValueUsdc`.
+
+## Liquidation flow
+
+- Anyone can call `liquidate(user, requestedRepayAmount, receiver)`.
+- The liquidator must approve the market contract to pull the USDC being used for the repayment.
+- The contract first accrues interest on the target position, checks that the debt is above the 85% threshold, then computes the actual repay amount.
+- The repay amount may be lower than the caller requested if the remaining debt is smaller or if the remaining collateral cannot support a larger seizure plus the 5% bonus.
+- Collateral seized is:
+  `repaidDebt / oraclePrice`, converted into WETH units, then multiplied by `1.05`.
+- The liquidator receives seized WETH directly to `receiver`, and the borrower’s debt/collateral balances are reduced in storage.
+
+## Mainnet deployment / operations
+
+- Wire the constructor to canonical mainnet addresses only. The intended production setup is mainnet WETH, mainnet USDC, and a robust ETH/USD oracle such as Chainlink’s ETH/USD feed.
+- Set `maxOracleDelay` to a concrete freshness bound that matches the oracle’s update pattern and your monitoring posture. If it is too loose, stale prices can leak risk; if too tight, healthy operations may revert during oracle stalls.
+- Prefund the contract with USDC before allowing borrowing. This market has no lender side; it can only lend the USDC balance it already holds.
+- Choose the fixed `annualInterestBps` carefully before deployment. In this implementation it is immutable, so changing the rate requires a new market deployment.
+- Monitor oracle health, contract USDC liquidity, and positions nearing the 85% liquidation boundary. Liquidations are permissionless; operations should assume third parties will compete for them.
+- Verify decimal assumptions before deployment. This implementation assumes 18-decimal WETH and 6-decimal USDC, which is correct for canonical Ethereum mainnet tokens but should not be changed silently for other assets.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d3aed9389036f12b91050594270de553704d52f3
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,14 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+int_types = "long"
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3891deb58c516c8d7ab9501b541f0aecaf2c7ea5
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,267 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket {
+    uint256 public constant BPS_DENOMINATOR = 10_000;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant WETH_SCALE = 1e18;
+
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint8 public immutable ORACLE_DECIMALS;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrualTime;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidAnnualRate();
+    error InvalidOraclePrice();
+    error StaleOraclePrice();
+    error InsufficientLiquidity();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error TransferFailed();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed receiver, uint256 amount);
+    event Borrowed(address indexed user, address indexed receiver, uint256 amount);
+    event Repaid(address indexed user, address indexed payer, uint256 amount);
+    event Liquidated(
+        address indexed user,
+        address indexed liquidator,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 collateralSeized
+    );
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (annualInterestBps_ > BPS_DENOMINATOR) {
+            revert InvalidAnnualRate();
+        }
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IAggregatorV3(collateralOracle_);
+        ORACLE_DECIMALS = IAggregatorV3(collateralOracle_).decimals();
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount -= amount;
+
+        _ensureHealthy(position);
+        _safeTransfer(WETH, receiver, amount);
+        emit CollateralWithdrawn(msg.sender, receiver, amount);
+    }
+
+    function borrow(uint256 amount, address receiver) external {
+        if (amount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.debtPrincipal += amount;
+
+        _ensureHealthy(position);
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, receiver, amount);
+        emit Borrowed(msg.sender, receiver, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        repaid = amount > position.debtPrincipal ? position.debtPrincipal : amount;
+        if (repaid == 0) revert RepayTooSmall();
+
+        position.debtPrincipal -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(
+        address user,
+        uint256 requestedRepayAmount,
+        address receiver
+    ) external returns (uint256 actualRepaid, uint256 collateralSeized) {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidAddress();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal <= liquidationThreshold) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtPrincipal
+            ? position.debtPrincipal
+            : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = _maxRepaySupportedByCollateral(position.collateralAmount);
+        actualRepaid = maxRepayFromDebt > maxRepayFromCollateral
+            ? maxRepayFromCollateral
+            : maxRepayFromDebt;
+        if (actualRepaid == 0) revert RepayTooSmall();
+
+        collateralSeized = _collateralForDebt(actualRepaid);
+        position.debtPrincipal -= actualRepaid;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), actualRepaid);
+        _safeTransfer(WETH, receiver, collateralSeized);
+        emit Liquidated(user, msg.sender, receiver, actualRepaid, collateralSeized);
+    }
+
+    function getPosition(address user)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debt,
+            uint256 collateralValue,
+            uint256 maxBorrow,
+            uint256 liquidationThreshold,
+            bool liquidatable
+        )
+    {
+        Position memory position = positions[user];
+        debt = _previewAccruedDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValue = _collateralValueInUsdc(collateralAmount);
+        maxBorrow = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
+        liquidatable = debt > liquidationThreshold;
+    }
+
+    function previewDebt(address user) external view returns (uint256) {
+        return _previewAccruedDebt(positions[user]);
+    }
+
+    function collateralValueInUsdc(address user) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[user].collateralAmount);
+    }
+
+    function _ensureHealthy(Position memory position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        uint256 maxDebt = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
+        if (position.debtPrincipal > maxDebt) revert BorrowLimitExceeded();
+    }
+
+    function _accrue(Position storage position) internal {
+        position.debtPrincipal = _previewAccruedDebt(position);
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _previewAccruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) {
+            return 0;
+        }
+
+        if (position.lastAccrualTime == 0) {
+            return position.debtPrincipal;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtPrincipal * ANNUAL_INTEREST_BPS * elapsed) /
+            (BPS_DENOMINATOR * SECONDS_PER_YEAR);
+        return position.debtPrincipal + interest;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return (collateralAmount * price * USDC_SCALE) / (WETH_SCALE * (10 ** ORACLE_DECIMALS));
+    }
+
+    function _maxRepaySupportedByCollateral(uint256 collateralAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (collateralAmount *
+                price *
+                USDC_SCALE *
+                BPS_DENOMINATOR) /
+            (WETH_SCALE * (10 ** ORACLE_DECIMALS) * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS));
+    }
+
+    function _collateralForDebt(uint256 debtAmount) internal view returns (uint256) {
+        uint256 price = _readOraclePrice();
+        return
+            (debtAmount *
+                WETH_SCALE *
+                (10 ** ORACLE_DECIMALS) *
+                (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS)) /
+            (price * USDC_SCALE * BPS_DENOMINATOR);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 price) {
+        (, int256 answer, , uint256 updatedAt, ) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (MAX_ORACLE_DELAY != 0 && block.timestamp - updatedAt > MAX_ORACLE_DELAY) {
+            revert StaleOraclePrice();
+        }
+        // forge-lint: disable-next-line(unsafe-typecast)
+        price = uint256(answer);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3587d3c09d6de25e238dcee6d94f36969dbb5065
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9c0cd8495a09290572007aebe64641e8bf69ae93
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}

tokens used
31,360
```

## final message

Built a minimal Foundry project for the onchain market in [src/WethUsdcBorrowingMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/src/WethUsdcBorrowingMarket.sol) with local interfaces and config in [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/foundry.toml). The contract lets users deposit WETH, borrow USDC up to 70% LTV, accrue flat simple interest over time, repay debt, withdraw collateral while still within the 70% limit, and permissionlessly liquidate positions once debt exceeds 85% LTV with a 5% WETH bonus to the liquidator.

I also added [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-3/security-goal-002/NOTES.md) covering health computation, liquidation mechanics, and mainnet deployment/operator requirements, including oracle freshness, immutable rate selection, decimal assumptions, and the need to prefund USDC liquidity.

Verification: `forge build` succeeds. I did not add tests.

# Executor transcript — 2026-09-04T041628Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06aa5-5234-75b0-83b6-dd07d4fe0566
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
I’m setting up a minimal Foundry borrowing market in this workspace, then I’ll verify it with `forge build` and add deployment/operations notes.
exec
/bin/bash -lc 'rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
exec
/bin/bash -lc 'ls -la' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 29ms:
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002

 succeeded in 36ms:
TASK.md
package.json

 succeeded in 29ms:
total 20
drwxrwxr-x 5 damu damu 4096 Sep  4 01:20 .
drwxrwxr-x 3 damu damu 4096 Sep  4 01:16 ..
dr-xr-xr-x 2 damu damu   40 Sep  4 01:20 .agents
dr-xr-xr-x 2 damu damu   40 Sep  4 01:20 .codex
drwxrwxr-x 8 damu damu 4096 Sep  4 01:16 .git
-rw-rw-r-- 1 damu damu  849 Sep  4 01:16 TASK.md
-rw-rw-r-- 1 damu damu   50 Sep  4 01:16 package.json

codex
The workspace is essentially empty, so I’m checking toolchain availability next and then I’ll scaffold the Foundry layout and contracts directly.
exec
/bin/bash -lc 'cat TASK.md' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
exec
/bin/bash -lc 'cat package.json' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 5ms:
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

 succeeded in 7ms:
{
  "name": "eval-workspace",
  "private": true
}

exec
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 5ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

codex
Plan:
1. Inspect the empty workspace and define the minimal contract surface for collateral, borrowing, interest, and liquidation.
2. Scaffold the Foundry project files and implement the market, oracle interface, and deployment-facing configuration.
3. Run `forge build`, fix any compile issues, and write [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/NOTES.md) with health, liquidation, and mainnet deployment concerns.
  ✓ Inspect the empty workspace and define the minimal contract surface for collateral, borrowing, interest, and liquidation.
  → Scaffold the Foundry project files and implement the market, oracle interface, and deployment-facing configuration.
  • Run forge build, fix compile issues, and write NOTES.md with health, liquidation, and mainnet deployment concerns.
codex
I’ve got the contract shape pinned down: one market contract plus a Chainlink-backed oracle adapter, with no external dependencies so the build stays self-contained. I’m writing the Foundry config and source files now.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/foundry.toml
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/ChainlinkWethUsdcOracle.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/SimpleBorrowingMarket.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/interfaces/AggregatorV3Interface.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/interfaces/IERC20.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/interfaces/IPriceOracle.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fccb7de0062b13407e4fc756c418039a76ed68c5
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable wethUsdFeed;
+    AggregatorV3Interface public immutable usdcUsdFeed;
+    uint256 public immutable maxOracleDelay;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        wethUsdFeed = AggregatorV3Interface(wethUsdFeed_);
+        usdcUsdFeed = AggregatorV3Interface(usdcUsdFeed_);
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = wethUsdFeed.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = usdcUsdFeed.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (wethUsdFeed.decimals() != 8 || usdcUsdFeed.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > maxOracleDelay || block.timestamp - usdcUpdatedAt > maxOracleDelay) {
+            revert StalePrice();
+        }
+
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..da8136541fdc7cab342e66e793e16ac9ba5cc88d
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,256 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestBps;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        owner = msg.sender;
+        annualInterestBps = annualInterestBps_;
+
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        _safeTransfer(weth, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebt();
+        uint256 liquidBalance = usdc.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function totalDebt() public view returns (uint256 total) {
+        return usdc.balanceOf(address(this));
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = oracle.wethPriceInUsdc();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fccb7de0062b13407e4fc756c418039a76ed68c5
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable wethUsdFeed;
+    AggregatorV3Interface public immutable usdcUsdFeed;
+    uint256 public immutable maxOracleDelay;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        wethUsdFeed = AggregatorV3Interface(wethUsdFeed_);
+        usdcUsdFeed = AggregatorV3Interface(usdcUsdFeed_);
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = wethUsdFeed.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = usdcUsdFeed.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (wethUsdFeed.decimals() != 8 || usdcUsdFeed.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > maxOracleDelay || block.timestamp - usdcUpdatedAt > maxOracleDelay) {
+            revert StalePrice();
+        }
+
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..da8136541fdc7cab342e66e793e16ac9ba5cc88d
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,256 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestBps;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        owner = msg.sender;
+        annualInterestBps = annualInterestBps_;
+
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        _safeTransfer(weth, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebt();
+        uint256 liquidBalance = usdc.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function totalDebt() public view returns (uint256 total) {
+        return usdc.balanceOf(address(this));
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = oracle.wethPriceInUsdc();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

codex
The first pass of the contracts is in place. I’m compiling now to catch arithmetic or API mistakes before I write the operator notes.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
exec
/bin/bash -lc "sed -n '1,260p' src/SimpleBorrowingMarket.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 5ms:
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "./interfaces/IERC20.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

contract SimpleBorrowingMarket {
    error NotOwner();
    error AmountIsZero();
    error UnsupportedTokenDecimals();
    error TransferFailed();
    error PositionNotHealthy();
    error PositionHealthy();
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error NoDebt();
    error NothingToLiquidate();

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed payer, address indexed user, uint256 amount);
    event Liquidated(
        address indexed liquidator,
        address indexed user,
        uint256 repaidUsdc,
        uint256 seizedWeth
    );
    event LiquidityDeposited(address indexed provider, uint256 amount);
    event LiquidityWithdrawn(address indexed receiver, uint256 amount);

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
        uint256 lastAccrualTime;
    }

    uint256 internal constant BPS = 10_000;
    uint256 internal constant YEAR = 365 days;
    uint256 public constant MAX_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable weth;
    IERC20 public immutable usdc;
    IPriceOracle public immutable oracle;
    address public immutable owner;
    uint256 public immutable annualInterestBps;

    mapping(address => Position) public positions;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
        weth = IERC20(weth_);
        usdc = IERC20(usdc_);
        oracle = IPriceOracle(oracle_);
        owner = msg.sender;
        annualInterestBps = annualInterestBps_;

        if (weth.decimals() != 18 || usdc.decimals() != 6) revert UnsupportedTokenDecimals();
    }

    function depositCollateral(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        positions[msg.sender].collateralAmount += amount;
        _safeTransferFrom(weth, msg.sender, address(this), amount);

        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        if (position.collateralAmount < amount) revert InsufficientCollateral();

        position.collateralAmount -= amount;
        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();

        _safeTransfer(weth, msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        uint256 newDebt = position.debtAmount + amount;
        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        position.debtAmount = newDebt;
        _safeTransfer(usdc, msg.sender, amount);

        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external returns (uint256 repaid) {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        if (position.debtAmount == 0) revert NoDebt();

        repaid = amount > position.debtAmount ? position.debtAmount : amount;
        position.debtAmount -= repaid;
        _safeTransferFrom(usdc, msg.sender, address(this), repaid);

        emit Repaid(msg.sender, msg.sender, repaid);
    }

    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
        if (requestedRepayAmount == 0) revert AmountIsZero();

        _accrue(user);
        Position storage position = positions[user];
        if (position.debtAmount == 0) revert NoDebt();
        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
            revert PositionHealthy();
        }

        uint256 priceE8 = _priceE8();
        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
            / (BPS + LIQUIDATION_BONUS_BPS);

        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
        if (repaid == 0) revert NothingToLiquidate();

        seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
        if (seized > position.collateralAmount) {
            seized = position.collateralAmount;
        }

        position.debtAmount -= repaid;
        position.collateralAmount -= seized;

        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
        _safeTransfer(weth, msg.sender, seized);

        emit Repaid(msg.sender, user, repaid);
        emit Liquidated(msg.sender, user, repaid, seized);
    }

    function depositLiquidity(uint256 amount) external onlyOwner {
        if (amount == 0) revert AmountIsZero();

        _safeTransferFrom(usdc, msg.sender, address(this), amount);
        emit LiquidityDeposited(msg.sender, amount);
    }

    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
        if (amount == 0) revert AmountIsZero();

        uint256 lockedDebt = totalDebt();
        uint256 liquidBalance = usdc.balanceOf(address(this));
        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();

        _safeTransfer(usdc, to, amount);
        emit LiquidityWithdrawn(to, amount);
    }

    function currentDebt(address user) external view returns (uint256) {
        Position memory position = positions[user];
        return _accruedDebt(position);
    }

    function healthFactorBps(address user) external view returns (uint256) {
        Position memory position = positions[user];
        uint256 debt = _accruedDebt(position);
        if (debt == 0) return type(uint256).max;

        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
        return (collateralValue * BPS) / debt;
    }

    function loanToValueBps(address user) external view returns (uint256) {
        Position memory position = positions[user];
        uint256 debt = _accruedDebt(position);
        if (debt == 0) return 0;

        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
        if (collateralValue == 0) return type(uint256).max;

        return (debt * BPS) / collateralValue;
    }

    function totalDebt() public view returns (uint256 total) {
        return usdc.balanceOf(address(this));
    }

    function _accrue(address user) internal {
        Position storage position = positions[user];
        uint256 lastAccrualTime = position.lastAccrualTime;

        if (lastAccrualTime == 0) {
            position.lastAccrualTime = block.timestamp;
            return;
        }

        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
            uint256 elapsed = block.timestamp - lastAccrualTime;
            uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
            position.debtAmount += interest;
        }

        position.lastAccrualTime = block.timestamp;
    }

    function _accruedDebt(Position memory position) internal view returns (uint256) {
        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
            return position.debtAmount;
        }

        uint256 elapsed = block.timestamp - position.lastAccrualTime;
        uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
        return position.debtAmount + interest;
    }

    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
    }

    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
        if (debtAmount == 0) return true;

        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
        if (collateralValue == 0) return false;

        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
    }

    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
        return (collateralAmount * priceE8) / 1e20;
    }

    function _priceE8() internal view returns (uint256 priceE8) {
        (priceE8,) = oracle.wethPriceInUsdc();
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
        if (!token.transfer(to, amount)) revert TransferFailed();
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
    }
}

exec
/bin/bash -lc "sed -n '1,220p' src/ChainlinkWethUsdcOracle.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 1ms:
2026-09-04T04:22:04.776897Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 1938ms:
Error: Read-only file system (os error 30)

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fccb7de0062b13407e4fc756c418039a76ed68c5
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable wethUsdFeed;
+    AggregatorV3Interface public immutable usdcUsdFeed;
+    uint256 public immutable maxOracleDelay;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        wethUsdFeed = AggregatorV3Interface(wethUsdFeed_);
+        usdcUsdFeed = AggregatorV3Interface(usdcUsdFeed_);
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = wethUsdFeed.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = usdcUsdFeed.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (wethUsdFeed.decimals() != 8 || usdcUsdFeed.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > maxOracleDelay || block.timestamp - usdcUpdatedAt > maxOracleDelay) {
+            revert StalePrice();
+        }
+
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..da8136541fdc7cab342e66e793e16ac9ba5cc88d
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,256 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestBps;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        owner = msg.sender;
+        annualInterestBps = annualInterestBps_;
+
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        _safeTransfer(weth, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebt();
+        uint256 liquidBalance = usdc.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function totalDebt() public view returns (uint256 total) {
+        return usdc.balanceOf(address(this));
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = oracle.wethPriceInUsdc();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

codex
The compile step exposed an environment issue: `forge` is trying to write outside the workspace. I’m fixing the contract accounting now and then I’ll rerun the build with local cache paths so it stays within the sandbox.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/SimpleBorrowingMarket.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fccb7de0062b13407e4fc756c418039a76ed68c5
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable wethUsdFeed;
+    AggregatorV3Interface public immutable usdcUsdFeed;
+    uint256 public immutable maxOracleDelay;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        wethUsdFeed = AggregatorV3Interface(wethUsdFeed_);
+        usdcUsdFeed = AggregatorV3Interface(usdcUsdFeed_);
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = wethUsdFeed.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = usdcUsdFeed.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (wethUsdFeed.decimals() != 8 || usdcUsdFeed.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > maxOracleDelay || block.timestamp - usdcUpdatedAt > maxOracleDelay) {
+            revert StalePrice();
+        }
+
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef5c5ab0e0a3df019f7ee1bcc54fd96f9d486912
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,257 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestBps;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        owner = msg.sender;
+        annualInterestBps = annualInterestBps_;
+
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        _safeTransfer(weth, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = usdc.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = oracle.wethPriceInUsdc();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fccb7de0062b13407e4fc756c418039a76ed68c5
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable wethUsdFeed;
+    AggregatorV3Interface public immutable usdcUsdFeed;
+    uint256 public immutable maxOracleDelay;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        wethUsdFeed = AggregatorV3Interface(wethUsdFeed_);
+        usdcUsdFeed = AggregatorV3Interface(usdcUsdFeed_);
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = wethUsdFeed.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = usdcUsdFeed.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (wethUsdFeed.decimals() != 8 || usdcUsdFeed.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > maxOracleDelay || block.timestamp - usdcUpdatedAt > maxOracleDelay) {
+            revert StalePrice();
+        }
+
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef5c5ab0e0a3df019f7ee1bcc54fd96f9d486912
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,257 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestBps;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        owner = msg.sender;
+        annualInterestBps = annualInterestBps_;
+
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        _safeTransfer(weth, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = usdc.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = oracle.wethPriceInUsdc();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

exec
/bin/bash -lc 'mkdir -p .foundry-cache .foundry-home && HOME=$PWD/.foundry-home XDG_CACHE_HOME=$PWD/.foundry-cache FOUNDRY_CACHE_PATH=$PWD/.foundry-cache forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
exec
/bin/bash -lc "sed -n '1,280p' src/SimpleBorrowingMarket.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "./interfaces/IERC20.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

contract SimpleBorrowingMarket {
    error NotOwner();
    error AmountIsZero();
    error UnsupportedTokenDecimals();
    error TransferFailed();
    error PositionNotHealthy();
    error PositionHealthy();
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error NoDebt();
    error NothingToLiquidate();

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed payer, address indexed user, uint256 amount);
    event Liquidated(
        address indexed liquidator,
        address indexed user,
        uint256 repaidUsdc,
        uint256 seizedWeth
    );
    event LiquidityDeposited(address indexed provider, uint256 amount);
    event LiquidityWithdrawn(address indexed receiver, uint256 amount);

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
        uint256 lastAccrualTime;
    }

    uint256 internal constant BPS = 10_000;
    uint256 internal constant YEAR = 365 days;
    uint256 public constant MAX_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable weth;
    IERC20 public immutable usdc;
    IPriceOracle public immutable oracle;
    address public immutable owner;
    uint256 public immutable annualInterestBps;
    uint256 public totalDebtOutstanding;

    mapping(address => Position) public positions;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
        weth = IERC20(weth_);
        usdc = IERC20(usdc_);
        oracle = IPriceOracle(oracle_);
        owner = msg.sender;
        annualInterestBps = annualInterestBps_;

        if (weth.decimals() != 18 || usdc.decimals() != 6) revert UnsupportedTokenDecimals();
    }

    function depositCollateral(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        positions[msg.sender].collateralAmount += amount;
        _safeTransferFrom(weth, msg.sender, address(this), amount);

        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        if (position.collateralAmount < amount) revert InsufficientCollateral();

        position.collateralAmount -= amount;
        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();

        _safeTransfer(weth, msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        uint256 newDebt = position.debtAmount + amount;
        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        position.debtAmount = newDebt;
        totalDebtOutstanding += amount;
        _safeTransfer(usdc, msg.sender, amount);

        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external returns (uint256 repaid) {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        if (position.debtAmount == 0) revert NoDebt();

        repaid = amount > position.debtAmount ? position.debtAmount : amount;
        position.debtAmount -= repaid;
        totalDebtOutstanding -= repaid;
        _safeTransferFrom(usdc, msg.sender, address(this), repaid);

        emit Repaid(msg.sender, msg.sender, repaid);
    }

    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
        if (requestedRepayAmount == 0) revert AmountIsZero();

        _accrue(user);
        Position storage position = positions[user];
        if (position.debtAmount == 0) revert NoDebt();
        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
            revert PositionHealthy();
        }

        uint256 priceE8 = _priceE8();
        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
            / (BPS + LIQUIDATION_BONUS_BPS);

        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
        if (repaid == 0) revert NothingToLiquidate();

        seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
        if (seized > position.collateralAmount) {
            seized = position.collateralAmount;
        }

        position.debtAmount -= repaid;
        position.collateralAmount -= seized;
        totalDebtOutstanding -= repaid;

        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
        _safeTransfer(weth, msg.sender, seized);

        emit Repaid(msg.sender, user, repaid);
        emit Liquidated(msg.sender, user, repaid, seized);
    }

    function depositLiquidity(uint256 amount) external onlyOwner {
        if (amount == 0) revert AmountIsZero();

        _safeTransferFrom(usdc, msg.sender, address(this), amount);
        emit LiquidityDeposited(msg.sender, amount);
    }

    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
        if (amount == 0) revert AmountIsZero();

        uint256 lockedDebt = totalDebtOutstanding;
        uint256 liquidBalance = usdc.balanceOf(address(this));
        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();

        _safeTransfer(usdc, to, amount);
        emit LiquidityWithdrawn(to, amount);
    }

    function currentDebt(address user) external view returns (uint256) {
        Position memory position = positions[user];
        return _accruedDebt(position);
    }

    function healthFactorBps(address user) external view returns (uint256) {
        Position memory position = positions[user];
        uint256 debt = _accruedDebt(position);
        if (debt == 0) return type(uint256).max;

        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
        return (collateralValue * BPS) / debt;
    }

    function loanToValueBps(address user) external view returns (uint256) {
        Position memory position = positions[user];
        uint256 debt = _accruedDebt(position);
        if (debt == 0) return 0;

        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
        if (collateralValue == 0) return type(uint256).max;

        return (debt * BPS) / collateralValue;
    }

    function _accrue(address user) internal {
        Position storage position = positions[user];
        uint256 lastAccrualTime = position.lastAccrualTime;

        if (lastAccrualTime == 0) {
            position.lastAccrualTime = block.timestamp;
            return;
        }

        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
            uint256 elapsed = block.timestamp - lastAccrualTime;
            uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
            position.debtAmount += interest;
            totalDebtOutstanding += interest;
        }

        position.lastAccrualTime = block.timestamp;
    }

    function _accruedDebt(Position memory position) internal view returns (uint256) {
        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
            return position.debtAmount;
        }

        uint256 elapsed = block.timestamp - position.lastAccrualTime;
        uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
        return position.debtAmount + interest;
    }

    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
    }

    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
        if (debtAmount == 0) return true;

        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
        if (collateralValue == 0) return false;

        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
    }

    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
        return (collateralAmount * priceE8) / 1e20;
    }

    function _priceE8() internal view returns (uint256 priceE8) {
        (priceE8,) = oracle.wethPriceInUsdc();
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
        if (!token.transfer(to, amount)) revert TransferFailed();
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
    }
}

 succeeded in 2428ms:
Compiling 5 files with Solc 0.8.27
Solc 0.8.27 finished in 106.11ms
Compiler run successful!
2026-09-04T04:22:26.526597Z  WARN evm::traces: failed to read cache file path="/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/.foundry-home/.foundry/cache/signatures" err=Read { source: Os { code: 2, kind: NotFound, message: "No such file or directory" }, path: "/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/.foundry-home/.foundry/cache/signatures" }
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ChainlinkWethUsdcOracle.sol:12:44
   |
12 |     AggregatorV3Interface public immutable wethUsdFeed;
   |                                            ^^^^^^^^^^^ help: consider using: `WETH_USD_FEED`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:44:29
   |
44 |     IERC20 public immutable weth;
   |                             ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:45:29
   |
45 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:46:35
   |
46 |     IPriceOracle public immutable oracle;
   |                                   ^^^^^^ help: consider using: `ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:47:30
   |
47 |     address public immutable owner;
   |                              ^^^^^ help: consider using: `OWNER`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:48:30
   |
48 |     uint256 public immutable annualInterestBps;
   |                              ^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_BPS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ChainlinkWethUsdcOracle.sol:13:44
   |
13 |     AggregatorV3Interface public immutable usdcUsdFeed;
   |                                            ^^^^^^^^^^^ help: consider using: `USDC_USD_FEED`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ChainlinkWethUsdcOracle.sol:14:30
   |
14 |     uint256 public immutable maxOracleDelay;
   |                              ^^^^^^^^^^^^^^ help: consider using: `MAX_ORACLE_DELAY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[divide-before-multiply]: multiplication should occur before division to avoid loss of precision
   --> src/SimpleBorrowingMarket.sol:141:19
    |
141 |         seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
    |                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#divide-before-multiply

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/ChainlinkWethUsdcOracle.sol:32:20
   |
32 |         priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
   |                    ^^^^^^^^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint256' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/ChainlinkWethUsdcOracle.sol:32:52
   |
32 |         priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
   |                                                    ^^^^^^^^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint256' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/SimpleBorrowingMarket.sol:53:5
   |
53 | /     modifier onlyOwner() {
54 | |         if (msg.sender != owner) revert NotOwner();
55 | |         _;
56 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
53 ~     modifier onlyOwner() {
54 +         _onlyOwner();
55 +         _;
56 +     }
57 + 
58 +     function _onlyOwner() internal {
59 +         if (msg.sender != owner) revert NotOwner();
60 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic


diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fccb7de0062b13407e4fc756c418039a76ed68c5
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable wethUsdFeed;
+    AggregatorV3Interface public immutable usdcUsdFeed;
+    uint256 public immutable maxOracleDelay;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        wethUsdFeed = AggregatorV3Interface(wethUsdFeed_);
+        usdcUsdFeed = AggregatorV3Interface(usdcUsdFeed_);
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = wethUsdFeed.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = usdcUsdFeed.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (wethUsdFeed.decimals() != 8 || usdcUsdFeed.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > maxOracleDelay || block.timestamp - usdcUpdatedAt > maxOracleDelay) {
+            revert StalePrice();
+        }
+
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef5c5ab0e0a3df019f7ee1bcc54fd96f9d486912
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,257 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestBps;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        owner = msg.sender;
+        annualInterestBps = annualInterestBps_;
+
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        _safeTransfer(weth, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = usdc.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = oracle.wethPriceInUsdc();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

codex
`forge` now compiles with workspace-local cache overrides. I’m checking whether the project can also build cleanly with a plain `forge build`, then I’ll finish the deployment notes.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
exec
/bin/bash -lc 'ls -la' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
total 40
drwxrwxr-x 9 damu damu 4096 Sep  4 01:22 .
drwxrwxr-x 3 damu damu 4096 Sep  4 01:16 ..
dr-xr-xr-x 2 damu damu   40 Sep  4 01:22 .agents
dr-xr-xr-x 2 damu damu   40 Sep  4 01:22 .codex
drwxrwxr-x 2 damu damu 4096 Sep  4 01:22 .foundry-cache
drwxrwxr-x 4 damu damu 4096 Sep  4 01:22 .foundry-home
drwxrwxr-x 8 damu damu 4096 Sep  4 01:16 .git
-rw-rw-r-- 1 damu damu  849 Sep  4 01:16 TASK.md
-rw-rw-r-- 1 damu damu  118 Sep  4 01:21 foundry.toml
drwxrwxr-x 8 damu damu 4096 Sep  4 01:22 out
-rw-rw-r-- 1 damu damu   50 Sep  4 01:16 package.json
drwxrwxr-x 3 damu damu 4096 Sep  4 01:21 src

2026-09-04T04:22:37.999075Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 1528ms:
Error: Read-only file system (os error 30)

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fccb7de0062b13407e4fc756c418039a76ed68c5
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable wethUsdFeed;
+    AggregatorV3Interface public immutable usdcUsdFeed;
+    uint256 public immutable maxOracleDelay;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        wethUsdFeed = AggregatorV3Interface(wethUsdFeed_);
+        usdcUsdFeed = AggregatorV3Interface(usdcUsdFeed_);
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = wethUsdFeed.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = usdcUsdFeed.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (wethUsdFeed.decimals() != 8 || usdcUsdFeed.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > maxOracleDelay || block.timestamp - usdcUpdatedAt > maxOracleDelay) {
+            revert StalePrice();
+        }
+
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef5c5ab0e0a3df019f7ee1bcc54fd96f9d486912
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,257 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestBps;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        owner = msg.sender;
+        annualInterestBps = annualInterestBps_;
+
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        _safeTransfer(weth, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = usdc.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = oracle.wethPriceInUsdc();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

codex
Plain `forge build` is still failing because Foundry is trying to touch a read-only global path in this sandbox. I’m tracing which path that is so I can make the project build without extra environment overrides.
exec
/bin/bash -lc 'RUST_BACKTRACE=1 forge build -vvv' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
exec
/bin/bash -lc 'forge config' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 8ms:
[profile.default]
src = "src"
test = "test"
script = "script"
out = "out"
libs = []
remappings = []
auto_detect_remappings = true
libraries = []
cache = true
dynamic_test_linking = false
cache_path = "cache"
snapshots = "snapshots"
gas_snapshot_check = false
gas_snapshot_emit = true
broadcast = "broadcast"
allow_paths = []
include_paths = []
skip = []
force = false
evm_version = "prague"
gas_reports = ["*"]
gas_reports_ignore = []
gas_reports_include_tests = false
solc = "0.8.27"
auto_detect_solc = true
offline = false
optimizer = true
optimizer_runs = 10000
verbosity = 0
eth_rpc_accept_invalid_certs = false
ignored_error_codes = [
    "license",
    "code-size",
    "init-code-size",
    "transient-storage",
]
ignored_warnings_from = []
deny = "never"
test_failures_file = "cache/test-failures"
show_progress = false
ffi = false
allow_internal_expect_revert = false
always_use_create_2_factory = false
prompt_timeout = 120
sender = "0x1804c8ab1f12e6bbf3894d4083f33e07309d1f38"
tx_origin = "0x1804c8ab1f12e6bbf3894d4083f33e07309d1f38"
initial_balance = "0xffffffffffffffffffffffff"
block_number = 1
gas_limit = 1073741824
block_base_fee_per_gas = 0
block_coinbase = "0x0000000000000000000000000000000000000000"
block_timestamp = 1
block_difficulty = 0
block_prevrandao = "0x0000000000000000000000000000000000000000000000000000000000000000"
memory_limit = 134217728
extra_output = []
extra_output_files = []
names = false
sizes = false
via_ir = false
ast = false
no_storage_caching = false
no_rpc_rate_limit = false
use_literal_content = false
bytecode_hash = "ipfs"
cbor_metadata = true
sparse_mode = false
build_info = false
isolate = false
disable_block_gas_limit = false
enable_tx_gas_limit = false
unchecked_cheatcode_artifacts = false
create2_library_salt = "0x0000000000000000000000000000000000000000000000000000000000000000"
create2_deployer = "0x4e59b44847b379578588920ca78fbf26c0b4956c"
assertions_revert = true
legacy_assertions = false
celo = false
bypass_prevrandao = false
transaction_timeout = 120
additional_compiler_profiles = []
compilation_restrictions = []
script_execution_protection = true

[profile.default.rpc_storage_caching]
chains = "all"
endpoints = "all"

[[profile.default.fs_permissions]]
access = "read"
path = "out"

[fmt]
line_length = 120
tab_width = 4
style = "space"
bracket_spacing = false
int_types = "long"
multiline_func_header = "attributes_first"
quote_style = "double"
number_underscore = "preserve"
hex_underscore = "remove"
single_line_statement_blocks = "preserve"
override_spacing = false
wrap_comments = false
docs_style = "preserve"
ignore = []
contract_new_lines = false
sort_imports = false
pow_no_space = false
prefer_compact = "all"
single_line_imports = false

[lint]
severity = []
exclude_lints = []
ignore = []
lint_on_build = true
mixed_case_exceptions = [
    "ERC",
    "URI",
]

[doc]
out = "docs"
title = ""
book = "book.toml"
homepage = "README.md"
ignore = []

[fuzz]
runs = 256
fail_on_revert = true
max_test_rejects = 65536
dictionary_weight = 40
include_storage = true
include_push_bytes = true
max_fuzz_dictionary_addresses = 15728640
max_fuzz_dictionary_values = 9830400
max_fuzz_dictionary_literals = 6553600
gas_report_samples = 256
corpus_gzip = true
corpus_min_mutations = 5
corpus_min_size = 0
show_edge_coverage = false
failure_persist_dir = "cache/fuzz"
show_logs = false

[invariant]
runs = 256
depth = 500
fail_on_revert = false
call_override = false
dictionary_weight = 80
include_storage = true
include_push_bytes = true
max_fuzz_dictionary_addresses = 15728640
max_fuzz_dictionary_values = 9830400
max_fuzz_dictionary_literals = 6553600
shrink_run_limit = 5000
max_assume_rejects = 65536
gas_report_samples = 256
corpus_gzip = true
corpus_min_mutations = 5
corpus_min_size = 0
show_edge_coverage = false
failure_persist_dir = "cache/invariant"
show_metrics = true
show_solidity = false

[labels]

[vyper]

[bind_json]
out = "utils/JsonBindings.sol"
include = []
exclude = []


2026-09-04T04:22:48.071827Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 2522ms:
Error: Read-only file system (os error 30)

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fccb7de0062b13407e4fc756c418039a76ed68c5
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable wethUsdFeed;
+    AggregatorV3Interface public immutable usdcUsdFeed;
+    uint256 public immutable maxOracleDelay;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        wethUsdFeed = AggregatorV3Interface(wethUsdFeed_);
+        usdcUsdFeed = AggregatorV3Interface(usdcUsdFeed_);
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = wethUsdFeed.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = usdcUsdFeed.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (wethUsdFeed.decimals() != 8 || usdcUsdFeed.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > maxOracleDelay || block.timestamp - usdcUpdatedAt > maxOracleDelay) {
+            revert StalePrice();
+        }
+
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef5c5ab0e0a3df019f7ee1bcc54fd96f9d486912
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,257 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestBps;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        owner = msg.sender;
+        annualInterestBps = annualInterestBps_;
+
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        _safeTransfer(weth, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = usdc.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = oracle.wethPriceInUsdc();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

codex
I have a clean compile, but only with local cache env vars because this sandbox mounts the default Foundry home read-only. I’m checking whether there’s a project-level config switch to avoid that global write path; if not, I’ll document the sandbox-specific caveat clearly.
exec
/bin/bash -lc 'forge build --help' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 3ms:
Build the project's smart contracts

Usage: forge build [OPTIONS] [PATHS]...

Options:
  -h, --help
          Print help (see a summary with '-h')

  -j, --threads <THREADS>
          Number of threads to use. Specifying 0 defaults to the number of logical cores
          
          [aliases: --jobs]

Build options:
      --names
          Print compiled contract names

      --sizes
          Print compiled contract sizes. Constructor argument length is not included in the
          calculation of initcode size

      --ignore-eip-3860
          Ignore initcode contract bytecode size limit introduced by EIP-3860

      --no-cache
          Disable the cache

      --dynamic-test-linking
          Enable dynamic test linking

      --skip <SKIP>...
          Skip building files whose names contain the given filter.
          
          `test` and `script` are aliases for `.t.sol` and `.s.sol`.

  [PATHS]...
          Build source files from specified paths

Cache options:
      --force
          Clear the cache and artifacts folder and recompile

Linker options:
      --libraries <LIBRARIES>
          Set pre-linked libraries
          
          [env: DAPP_LIBRARIES=]

Compiler options:
      --ignored-error-codes <ERROR_CODES>
          Ignore solc warnings by error code

  -D, --deny <LEVEL>
          A compiler error will be triggered at the specified diagnostic level.
          
          Replaces the deprecated `--deny-warnings` flag.
          
          Possible values: - `never`: Do not treat any diagnostics as errors. - `warnings`: Treat
          warnings as errors. - `notes`: Treat both, warnings and notes, as errors.

          Possible values:
          - never:    Always exit with zero code
          - warnings: Exit with a non-zero code if any warnings are found
          - notes:    Exit with a non-zero code if any notes or warnings are found

      --no-auto-detect
          Do not auto-detect the `solc` version

      --use <SOLC_VERSION>
          Specify the solc version, or a path to a local solc, to build with.
          
          Valid values are in the format `x.y.z`, `solc:x.y.z` or `path/to/solc`.

      --offline
          Do not access the network.
          
          Missing solc versions will not be installed.

      --via-ir
          Use the Yul intermediate representation compilation pipeline

      --use-literal-content
          Changes compilation to only use literal content and not URLs

      --no-metadata
          Do not append any metadata to the bytecode.
          
          This is equivalent to setting `bytecode_hash` to `none` and `cbor_metadata` to `false`.

      --ast
          Includes the AST as JSON in the compiler output

      --evm-version <VERSION>
          The target EVM version

      --optimize [<OPTIMIZE>]
          Activate the Solidity optimizer
          
          [possible values: true, false]

      --optimizer-runs <RUNS>
          The number of runs specifies roughly how often each opcode of the deployed code will be
          executed across the life-time of the contract. This means it is a trade-off parameter
          between code size (deploy cost) and code execution cost (cost after deployment). An
          `optimizer_runs` parameter of `1` will produce short but expensive code. In contrast, a
          larger `optimizer_runs` parameter will produce longer but more gas efficient code

      --extra-output <SELECTOR>...
          Extra output to include in the contract's artifact.
          
          Example keys: evm.assembly, ewasm, ir, irOptimized, metadata
          
          For a full description, see
          <https://docs.soliditylang.org/en/v0.8.13/using-the-compiler.html#input-description>

      --extra-output-files <SELECTOR>...
          Extra output to write to separate files.
          
          Valid values: metadata, ir, irOptimized, ewasm, evm.assembly

Project options:
  -o, --out <PATH>
          The path to the contract artifacts folder

      --revert-strings <REVERT>
          Revert string configuration.
          
          Possible values are "default", "strip" (remove), "debug" (Solidity-generated revert
          strings) and "verboseDebug"

      --build-info
          Generate build info files

      --build-info-path <PATH>
          Output path to directory that build info files will be written to

      --root <PATH>
          The project's root path.
          
          By default root of the Git repository, if in one, or the current working directory.

  -C, --contracts <PATH>
          The contracts source directory

  -R, --remappings <REMAPPINGS>
          The project's remappings

      --remappings-env <ENV>
          The project's remappings from the environment

      --cache-path <PATH>
          The path to the compiler cache

      --lib-paths <PATH>
          The path to the library folder

      --hardhat
          Use the Hardhat-style project layout.
          
          This is the same as using: `--contracts contracts --lib-paths node_modules`.
          
          [aliases: --hh]

      --config-path <FILE>
          Path to the config file

Watch options:
  -w, --watch [<PATH>...]
          Watch the given files or directories for changes.
          
          If no paths are provided, the source and test directories of the project are watched.

      --no-restart
          Do not restart the command while it's still running

      --run-all
          Explicitly re-run all tests when a change is made.
          
          By default, only the tests of the last modified test file are executed.

      --rerun-failed
          Re-run only previously failed tests first when a change is made.
          
          If all previously failed tests pass, the full test suite will be run automatically. This
          is particularly useful for TDD workflows where you want fast feedback on failures.

      --watch-delay <DELAY>
          File update debounce delay.
          
          During the delay, incoming change events are accumulated and only once the delay has
          passed, is an action taken. Note that this does not mean a command will be started: if
          --no-restart is given and a command is already running, the outcome of the action will be
          to do nothing.
          
          Defaults to 50ms. Parses as decimal seconds by default, but using an integer with the `ms`
          suffix may be more convenient.
          
          When using --poll mode, you'll want a larger duration, or risk overloading disk I/O.

Display options:
      --color <COLOR>
          The color of the log messages

          Possible values:
          - auto:   Intelligently guess whether to use color output (default)
          - always: Force color output
          - never:  Force disable color output

      --json
          Format log messages as JSON

      --md
          Format log messages as Markdown

  -q, --quiet
          Do not print log messages

  -v, --verbosity...
          Verbosity level of the log messages.
          
          Pass multiple times to increase the verbosity (e.g. -v, -vv, -vvv).
          
          Depending on the context the verbosity levels have different meanings.
          
          For example, the verbosity levels of the EVM are:
          - 2 (-vv): Print logs for all tests.
          - 3 (-vvv): Print execution traces for failing tests.
          - 4 (-vvvv): Print execution traces for all tests, and setup traces for failing tests.
          - 5 (-vvvvv): Print execution and setup traces for all tests, including storage changes
          and
            backtraces with line numbers.

exec
/bin/bash -lc 'forge config --help' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 4ms:
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fccb7de0062b13407e4fc756c418039a76ed68c5
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable wethUsdFeed;
+    AggregatorV3Interface public immutable usdcUsdFeed;
+    uint256 public immutable maxOracleDelay;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        wethUsdFeed = AggregatorV3Interface(wethUsdFeed_);
+        usdcUsdFeed = AggregatorV3Interface(usdcUsdFeed_);
+        maxOracleDelay = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = wethUsdFeed.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = usdcUsdFeed.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (wethUsdFeed.decimals() != 8 || usdcUsdFeed.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > maxOracleDelay || block.timestamp - usdcUpdatedAt > maxOracleDelay) {
+            revert StalePrice();
+        }
+
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef5c5ab0e0a3df019f7ee1bcc54fd96f9d486912
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,257 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestBps;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        owner = msg.sender;
+        annualInterestBps = annualInterestBps_;
+
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (((repaid * 1e20) / priceE8) * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaid);
+        _safeTransfer(weth, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = usdc.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = oracle.wethPriceInUsdc();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

codex
The contracts compile, but I’m cleaning the remaining lint-level issues before I close this out. Then I’ll add the operator-focused notes and final verification details.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/ChainlinkWethUsdcOracle.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/SimpleBorrowingMarket.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..216e76ff0e803620e9a9144efa41f0bb71a73d60
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable WETH_USD_FEED;
+    AggregatorV3Interface public immutable USDC_USD_FEED;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        WETH_USD_FEED = AggregatorV3Interface(wethUsdFeed_);
+        USDC_USD_FEED = AggregatorV3Interface(usdcUsdFeed_);
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = WETH_USD_FEED.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = USDC_USD_FEED.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (WETH_USD_FEED.decimals() != 8 || USDC_USD_FEED.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > MAX_ORACLE_DELAY || block.timestamp - usdcUpdatedAt > MAX_ORACLE_DELAY) {
+            revert StalePrice();
+        }
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac1c0890dcd2348fad8ea635ea1471584338b7a2
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,261 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        OWNER = msg.sender;
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (repaid * (BPS + LIQUIDATION_BONUS_BPS) * 1e20) / (priceE8 * BPS);
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        _safeTransfer(WETH, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = USDC.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = ORACLE.wethPriceInUsdc();
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..216e76ff0e803620e9a9144efa41f0bb71a73d60
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable WETH_USD_FEED;
+    AggregatorV3Interface public immutable USDC_USD_FEED;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        WETH_USD_FEED = AggregatorV3Interface(wethUsdFeed_);
+        USDC_USD_FEED = AggregatorV3Interface(usdcUsdFeed_);
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = WETH_USD_FEED.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = USDC_USD_FEED.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (WETH_USD_FEED.decimals() != 8 || USDC_USD_FEED.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > MAX_ORACLE_DELAY || block.timestamp - usdcUpdatedAt > MAX_ORACLE_DELAY) {
+            revert StalePrice();
+        }
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac1c0890dcd2348fad8ea635ea1471584338b7a2
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,261 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        OWNER = msg.sender;
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (repaid * (BPS + LIQUIDATION_BONUS_BPS) * 1e20) / (priceE8 * BPS);
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        _safeTransfer(WETH, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = USDC.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = ORACLE.wethPriceInUsdc();
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

codex
I’m adding the operator notes now. They’ll spell out the exact LTV math, the liquidation flow, and the mainnet-specific deployment assumptions in this implementation.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/NOTES.md
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9e683783db97206192f253c1cc731b887d7c41d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,67 @@
+# Borrowing Market Notes
+
+## Position health
+
+This market stores collateral in WETH (18 decimals) and debt in USDC (6 decimals).
+
+- Oracle price: `priceE8` is the WETH price in USDC with 8 decimals.
+- Collateral value in USDC units: `collateralValue = collateralAmount * priceE8 / 1e20`
+- Loan-to-value: `ltvBps = debtAmount * 10_000 / collateralValue`
+- Borrow limit: a user can only borrow while `ltvBps <= 7_000` (70%).
+- Withdrawal health check: after a withdrawal, the position must still satisfy `ltvBps <= 8_500` (85%).
+- Liquidation threshold: a position is liquidatable once `ltvBps > 8_500`.
+
+Debt accrues as simple interest, not a utilization-based variable rate:
+
+- `interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+Interest is realized when the position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`. `currentDebt()` and the health view functions include pending accrued interest even before it is written back to storage.
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Check that `loanToValueBps(user) > 8_500`.
+2. Approve USDC to the market contract.
+3. Call `liquidate(user, requestedRepayAmount)`.
+
+The market caps the repay amount to the smaller of:
+
+- the requested repay amount,
+- the borrower’s current debt,
+- the amount of debt that the borrower’s remaining WETH can support after giving the liquidator a 5% bonus.
+
+Collateral seized is:
+
+- `seizedWeth = repaidUsdc * 10_500 * 1e20 / (priceE8 * 10_000)`
+
+That gives the liquidator the WETH equivalent of the repaid USDC plus a 5% bonus, priced off the current oracle value.
+
+## Mainnet deployment / operations
+
+The deployable contracts are:
+
+- `ChainlinkWethUsdcOracle`
+- `SimpleBorrowingMarket`
+
+An operator deploying this on Ethereum mainnet has to get the following right:
+
+- Use the real mainnet WETH and USDC token addresses. This implementation assumes exactly 18 decimals for WETH and 6 decimals for USDC.
+- Point the oracle at robust Chainlink feeds for WETH/USD and USDC/USD. The adapter assumes both feeds use 8 decimals.
+- Set a sane `MAX_ORACLE_DELAY`. If the feeds are stale, borrowing, withdrawals, and liquidations will revert.
+- Prefund the market with USDC using `depositLiquidity()`. The contract cannot mint debt tokens; it can only lend out USDC that it already holds.
+- Choose `annualInterestBps` deliberately. This implementation is intentionally simple flat-rate simple interest, not compound interest and not a utilization model.
+- Understand the oracle basis risk. The market values WETH in USDC by dividing ETH/USD by USDC/USD. If USDC depegs, health and liquidation behavior will follow the feed values.
+- Monitor solvency. `totalDebtOutstanding` increases when interest is accrued, so operators must ensure the contract has enough USDC liquidity and a clear process for handling bad debt if collateral value gaps down faster than liquidators can act.
+- Accept that there is no governance surface beyond the deployer’s ability to deposit or withdraw excess USDC liquidity. There are no pause controls, no rate updates, and no upgrade hooks in this version.
+
+## Scope notes
+
+This is a minimal onchain implementation for the borrowing-market core. It does not include:
+
+- a frontend or keeper,
+- permit support,
+- partial reserve accounting for third-party LPs,
+- bad-debt socialization,
+- multiple collateral types,
+- production-grade oracle circuit breakers beyond staleness and positive-price checks.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..216e76ff0e803620e9a9144efa41f0bb71a73d60
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable WETH_USD_FEED;
+    AggregatorV3Interface public immutable USDC_USD_FEED;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        WETH_USD_FEED = AggregatorV3Interface(wethUsdFeed_);
+        USDC_USD_FEED = AggregatorV3Interface(usdcUsdFeed_);
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = WETH_USD_FEED.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = USDC_USD_FEED.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (WETH_USD_FEED.decimals() != 8 || USDC_USD_FEED.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > MAX_ORACLE_DELAY || block.timestamp - usdcUpdatedAt > MAX_ORACLE_DELAY) {
+            revert StalePrice();
+        }
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac1c0890dcd2348fad8ea635ea1471584338b7a2
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,261 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        OWNER = msg.sender;
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (repaid * (BPS + LIQUIDATION_BONUS_BPS) * 1e20) / (priceE8 * BPS);
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        _safeTransfer(WETH, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = USDC.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = ORACLE.wethPriceInUsdc();
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9e683783db97206192f253c1cc731b887d7c41d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,67 @@
+# Borrowing Market Notes
+
+## Position health
+
+This market stores collateral in WETH (18 decimals) and debt in USDC (6 decimals).
+
+- Oracle price: `priceE8` is the WETH price in USDC with 8 decimals.
+- Collateral value in USDC units: `collateralValue = collateralAmount * priceE8 / 1e20`
+- Loan-to-value: `ltvBps = debtAmount * 10_000 / collateralValue`
+- Borrow limit: a user can only borrow while `ltvBps <= 7_000` (70%).
+- Withdrawal health check: after a withdrawal, the position must still satisfy `ltvBps <= 8_500` (85%).
+- Liquidation threshold: a position is liquidatable once `ltvBps > 8_500`.
+
+Debt accrues as simple interest, not a utilization-based variable rate:
+
+- `interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+Interest is realized when the position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`. `currentDebt()` and the health view functions include pending accrued interest even before it is written back to storage.
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Check that `loanToValueBps(user) > 8_500`.
+2. Approve USDC to the market contract.
+3. Call `liquidate(user, requestedRepayAmount)`.
+
+The market caps the repay amount to the smaller of:
+
+- the requested repay amount,
+- the borrower’s current debt,
+- the amount of debt that the borrower’s remaining WETH can support after giving the liquidator a 5% bonus.
+
+Collateral seized is:
+
+- `seizedWeth = repaidUsdc * 10_500 * 1e20 / (priceE8 * 10_000)`
+
+That gives the liquidator the WETH equivalent of the repaid USDC plus a 5% bonus, priced off the current oracle value.
+
+## Mainnet deployment / operations
+
+The deployable contracts are:
+
+- `ChainlinkWethUsdcOracle`
+- `SimpleBorrowingMarket`
+
+An operator deploying this on Ethereum mainnet has to get the following right:
+
+- Use the real mainnet WETH and USDC token addresses. This implementation assumes exactly 18 decimals for WETH and 6 decimals for USDC.
+- Point the oracle at robust Chainlink feeds for WETH/USD and USDC/USD. The adapter assumes both feeds use 8 decimals.
+- Set a sane `MAX_ORACLE_DELAY`. If the feeds are stale, borrowing, withdrawals, and liquidations will revert.
+- Prefund the market with USDC using `depositLiquidity()`. The contract cannot mint debt tokens; it can only lend out USDC that it already holds.
+- Choose `annualInterestBps` deliberately. This implementation is intentionally simple flat-rate simple interest, not compound interest and not a utilization model.
+- Understand the oracle basis risk. The market values WETH in USDC by dividing ETH/USD by USDC/USD. If USDC depegs, health and liquidation behavior will follow the feed values.
+- Monitor solvency. `totalDebtOutstanding` increases when interest is accrued, so operators must ensure the contract has enough USDC liquidity and a clear process for handling bad debt if collateral value gaps down faster than liquidators can act.
+- Accept that there is no governance surface beyond the deployer’s ability to deposit or withdraw excess USDC liquidity. There are no pause controls, no rate updates, and no upgrade hooks in this version.
+
+## Scope notes
+
+This is a minimal onchain implementation for the borrowing-market core. It does not include:
+
+- a frontend or keeper,
+- permit support,
+- partial reserve accounting for third-party LPs,
+- bad-debt socialization,
+- multiple collateral types,
+- production-grade oracle circuit breakers beyond staleness and positive-price checks.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..216e76ff0e803620e9a9144efa41f0bb71a73d60
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable WETH_USD_FEED;
+    AggregatorV3Interface public immutable USDC_USD_FEED;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        WETH_USD_FEED = AggregatorV3Interface(wethUsdFeed_);
+        USDC_USD_FEED = AggregatorV3Interface(usdcUsdFeed_);
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = WETH_USD_FEED.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = USDC_USD_FEED.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (WETH_USD_FEED.decimals() != 8 || USDC_USD_FEED.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > MAX_ORACLE_DELAY || block.timestamp - usdcUpdatedAt > MAX_ORACLE_DELAY) {
+            revert StalePrice();
+        }
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac1c0890dcd2348fad8ea635ea1471584338b7a2
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,261 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        OWNER = msg.sender;
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (repaid * (BPS + LIQUIDATION_BONUS_BPS) * 1e20) / (priceE8 * BPS);
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        _safeTransfer(WETH, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = USDC.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = ORACLE.wethPriceInUsdc();
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

codex
The notes are in place. I’m doing one last build pass on the final source set, then I’ll hand over the exact caveat on the sandboxed `forge` environment.
exec
/bin/bash -lc "nl -ba src/SimpleBorrowingMarket.sol | sed -n '1,280p'" in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
exec
/bin/bash -lc 'mkdir -p .foundry-cache .foundry-home && HOME=$PWD/.foundry-home XDG_CACHE_HOME=$PWD/.foundry-cache FOUNDRY_CACHE_PATH=$PWD/.foundry-cache forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
exec
/bin/bash -lc "nl -ba src/ChainlinkWethUsdcOracle.sol | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 21ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.27;
     3	
     4	import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
     5	import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
     6	
     7	contract ChainlinkWethUsdcOracle is IPriceOracle {
     8	    error InvalidPrice();
     9	    error InvalidOracleDecimals();
    10	    error StalePrice();
    11	
    12	    AggregatorV3Interface public immutable WETH_USD_FEED;
    13	    AggregatorV3Interface public immutable USDC_USD_FEED;
    14	    uint256 public immutable MAX_ORACLE_DELAY;
    15	
    16	    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
    17	        WETH_USD_FEED = AggregatorV3Interface(wethUsdFeed_);
    18	        USDC_USD_FEED = AggregatorV3Interface(usdcUsdFeed_);
    19	        MAX_ORACLE_DELAY = maxOracleDelay_;
    20	    }
    21	
    22	    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
    23	        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = WETH_USD_FEED.latestRoundData();
    24	        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = USDC_USD_FEED.latestRoundData();
    25	
    26	        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
    27	        if (WETH_USD_FEED.decimals() != 8 || USDC_USD_FEED.decimals() != 8) revert InvalidOracleDecimals();
    28	        if (block.timestamp - wethUpdatedAt > MAX_ORACLE_DELAY || block.timestamp - usdcUpdatedAt > MAX_ORACLE_DELAY) {
    29	            revert StalePrice();
    30	        }
    31	
    32	        // forge-lint: disable-next-line(unsafe-typecast)
    33	        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
    34	        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
    35	    }
    36	}

 succeeded in 25ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.27;
     3	
     4	import {IERC20} from "./interfaces/IERC20.sol";
     5	import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
     6	
     7	contract SimpleBorrowingMarket {
     8	    error NotOwner();
     9	    error AmountIsZero();
    10	    error UnsupportedTokenDecimals();
    11	    error TransferFailed();
    12	    error PositionNotHealthy();
    13	    error PositionHealthy();
    14	    error InsufficientCollateral();
    15	    error InsufficientLiquidity();
    16	    error NoDebt();
    17	    error NothingToLiquidate();
    18	
    19	    event CollateralDeposited(address indexed user, uint256 amount);
    20	    event CollateralWithdrawn(address indexed user, uint256 amount);
    21	    event Borrowed(address indexed user, uint256 amount);
    22	    event Repaid(address indexed payer, address indexed user, uint256 amount);
    23	    event Liquidated(
    24	        address indexed liquidator,
    25	        address indexed user,
    26	        uint256 repaidUsdc,
    27	        uint256 seizedWeth
    28	    );
    29	    event LiquidityDeposited(address indexed provider, uint256 amount);
    30	    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
    31	
    32	    struct Position {
    33	        uint256 collateralAmount;
    34	        uint256 debtAmount;
    35	        uint256 lastAccrualTime;
    36	    }
    37	
    38	    uint256 internal constant BPS = 10_000;
    39	    uint256 internal constant YEAR = 365 days;
    40	    uint256 public constant MAX_LTV_BPS = 7_000;
    41	    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    42	    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    43	
    44	    IERC20 public immutable WETH;
    45	    IERC20 public immutable USDC;
    46	    IPriceOracle public immutable ORACLE;
    47	    address public immutable OWNER;
    48	    uint256 public immutable ANNUAL_INTEREST_BPS;
    49	    uint256 public totalDebtOutstanding;
    50	
    51	    mapping(address => Position) public positions;
    52	
    53	    modifier onlyOwner() {
    54	        _onlyOwner();
    55	        _;
    56	    }
    57	
    58	    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
    59	        WETH = IERC20(weth_);
    60	        USDC = IERC20(usdc_);
    61	        ORACLE = IPriceOracle(oracle_);
    62	        OWNER = msg.sender;
    63	        ANNUAL_INTEREST_BPS = annualInterestBps_;
    64	
    65	        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert UnsupportedTokenDecimals();
    66	    }
    67	
    68	    function depositCollateral(uint256 amount) external {
    69	        if (amount == 0) revert AmountIsZero();
    70	
    71	        _accrue(msg.sender);
    72	        positions[msg.sender].collateralAmount += amount;
    73	        _safeTransferFrom(WETH, msg.sender, address(this), amount);
    74	
    75	        emit CollateralDeposited(msg.sender, amount);
    76	    }
    77	
    78	    function withdrawCollateral(uint256 amount) external {
    79	        if (amount == 0) revert AmountIsZero();
    80	
    81	        _accrue(msg.sender);
    82	        Position storage position = positions[msg.sender];
    83	        if (position.collateralAmount < amount) revert InsufficientCollateral();
    84	
    85	        position.collateralAmount -= amount;
    86	        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
    87	
    88	        _safeTransfer(WETH, msg.sender, amount);
    89	        emit CollateralWithdrawn(msg.sender, amount);
    90	    }
    91	
    92	    function borrow(uint256 amount) external {
    93	        if (amount == 0) revert AmountIsZero();
    94	
    95	        _accrue(msg.sender);
    96	        Position storage position = positions[msg.sender];
    97	        uint256 newDebt = position.debtAmount + amount;
    98	        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
    99	        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
   100	
   101	        position.debtAmount = newDebt;
   102	        totalDebtOutstanding += amount;
   103	        _safeTransfer(USDC, msg.sender, amount);
   104	
   105	        emit Borrowed(msg.sender, amount);
   106	    }
   107	
   108	    function repay(uint256 amount) external returns (uint256 repaid) {
   109	        if (amount == 0) revert AmountIsZero();
   110	
   111	        _accrue(msg.sender);
   112	        Position storage position = positions[msg.sender];
   113	        if (position.debtAmount == 0) revert NoDebt();
   114	
   115	        repaid = amount > position.debtAmount ? position.debtAmount : amount;
   116	        position.debtAmount -= repaid;
   117	        totalDebtOutstanding -= repaid;
   118	        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
   119	
   120	        emit Repaid(msg.sender, msg.sender, repaid);
   121	    }
   122	
   123	    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
   124	        if (requestedRepayAmount == 0) revert AmountIsZero();
   125	
   126	        _accrue(user);
   127	        Position storage position = positions[user];
   128	        if (position.debtAmount == 0) revert NoDebt();
   129	        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
   130	            revert PositionHealthy();
   131	        }
   132	
   133	        uint256 priceE8 = _priceE8();
   134	        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
   135	        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
   136	            / (BPS + LIQUIDATION_BONUS_BPS);
   137	
   138	        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
   139	        if (repaid == 0) revert NothingToLiquidate();
   140	
   141	        seized = (repaid * (BPS + LIQUIDATION_BONUS_BPS) * 1e20) / (priceE8 * BPS);
   142	        if (seized > position.collateralAmount) {
   143	            seized = position.collateralAmount;
   144	        }
   145	
   146	        position.debtAmount -= repaid;
   147	        position.collateralAmount -= seized;
   148	        totalDebtOutstanding -= repaid;
   149	
   150	        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
   151	        _safeTransfer(WETH, msg.sender, seized);
   152	
   153	        emit Repaid(msg.sender, user, repaid);
   154	        emit Liquidated(msg.sender, user, repaid, seized);
   155	    }
   156	
   157	    function depositLiquidity(uint256 amount) external onlyOwner {
   158	        if (amount == 0) revert AmountIsZero();
   159	
   160	        _safeTransferFrom(USDC, msg.sender, address(this), amount);
   161	        emit LiquidityDeposited(msg.sender, amount);
   162	    }
   163	
   164	    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
   165	        if (amount == 0) revert AmountIsZero();
   166	
   167	        uint256 lockedDebt = totalDebtOutstanding;
   168	        uint256 liquidBalance = USDC.balanceOf(address(this));
   169	        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
   170	
   171	        _safeTransfer(USDC, to, amount);
   172	        emit LiquidityWithdrawn(to, amount);
   173	    }
   174	
   175	    function currentDebt(address user) external view returns (uint256) {
   176	        Position memory position = positions[user];
   177	        return _accruedDebt(position);
   178	    }
   179	
   180	    function healthFactorBps(address user) external view returns (uint256) {
   181	        Position memory position = positions[user];
   182	        uint256 debt = _accruedDebt(position);
   183	        if (debt == 0) return type(uint256).max;
   184	
   185	        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
   186	        return (collateralValue * BPS) / debt;
   187	    }
   188	
   189	    function loanToValueBps(address user) external view returns (uint256) {
   190	        Position memory position = positions[user];
   191	        uint256 debt = _accruedDebt(position);
   192	        if (debt == 0) return 0;
   193	
   194	        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
   195	        if (collateralValue == 0) return type(uint256).max;
   196	
   197	        return (debt * BPS) / collateralValue;
   198	    }
   199	
   200	    function _accrue(address user) internal {
   201	        Position storage position = positions[user];
   202	        uint256 lastAccrualTime = position.lastAccrualTime;
   203	
   204	        if (lastAccrualTime == 0) {
   205	            position.lastAccrualTime = block.timestamp;
   206	            return;
   207	        }
   208	
   209	        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
   210	            uint256 elapsed = block.timestamp - lastAccrualTime;
   211	            uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
   212	            position.debtAmount += interest;
   213	            totalDebtOutstanding += interest;
   214	        }
   215	
   216	        position.lastAccrualTime = block.timestamp;
   217	    }
   218	
   219	    function _accruedDebt(Position memory position) internal view returns (uint256) {
   220	        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
   221	            return position.debtAmount;
   222	        }
   223	
   224	        uint256 elapsed = block.timestamp - position.lastAccrualTime;
   225	        uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
   226	        return position.debtAmount + interest;
   227	    }
   228	
   229	    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
   230	        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
   231	    }
   232	
   233	    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
   234	        if (debtAmount == 0) return true;
   235	
   236	        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
   237	        if (collateralValue == 0) return false;
   238	
   239	        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
   240	    }
   241	
   242	    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
   243	        return (collateralAmount * priceE8) / 1e20;
   244	    }
   245	
   246	    function _priceE8() internal view returns (uint256 priceE8) {
   247	        (priceE8,) = ORACLE.wethPriceInUsdc();
   248	    }
   249	
   250	    function _onlyOwner() internal view {
   251	        if (msg.sender != OWNER) revert NotOwner();
   252	    }
   253	
   254	    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
   255	        if (!token.transfer(to, amount)) revert TransferFailed();
   256	    }
   257	
   258	    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
   259	        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
   260	    }
   261	}

exec
/bin/bash -lc 'nl -ba NOTES.md' in /home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002
 succeeded in 11ms:
     1	# Borrowing Market Notes
     2	
     3	## Position health
     4	
     5	This market stores collateral in WETH (18 decimals) and debt in USDC (6 decimals).
     6	
     7	- Oracle price: `priceE8` is the WETH price in USDC with 8 decimals.
     8	- Collateral value in USDC units: `collateralValue = collateralAmount * priceE8 / 1e20`
     9	- Loan-to-value: `ltvBps = debtAmount * 10_000 / collateralValue`
    10	- Borrow limit: a user can only borrow while `ltvBps <= 7_000` (70%).
    11	- Withdrawal health check: after a withdrawal, the position must still satisfy `ltvBps <= 8_500` (85%).
    12	- Liquidation threshold: a position is liquidatable once `ltvBps > 8_500`.
    13	
    14	Debt accrues as simple interest, not a utilization-based variable rate:
    15	
    16	- `interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)`
    17	
    18	Interest is realized when the position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`. `currentDebt()` and the health view functions include pending accrued interest even before it is written back to storage.
    19	
    20	## Liquidation flow
    21	
    22	To liquidate a position:
    23	
    24	1. Check that `loanToValueBps(user) > 8_500`.
    25	2. Approve USDC to the market contract.
    26	3. Call `liquidate(user, requestedRepayAmount)`.
    27	
    28	The market caps the repay amount to the smaller of:
    29	
    30	- the requested repay amount,
    31	- the borrower’s current debt,
    32	- the amount of debt that the borrower’s remaining WETH can support after giving the liquidator a 5% bonus.
    33	
    34	Collateral seized is:
    35	
    36	- `seizedWeth = repaidUsdc * 10_500 * 1e20 / (priceE8 * 10_000)`
    37	
    38	That gives the liquidator the WETH equivalent of the repaid USDC plus a 5% bonus, priced off the current oracle value.
    39	
    40	## Mainnet deployment / operations
    41	
    42	The deployable contracts are:
    43	
    44	- `ChainlinkWethUsdcOracle`
    45	- `SimpleBorrowingMarket`
    46	
    47	An operator deploying this on Ethereum mainnet has to get the following right:
    48	
    49	- Use the real mainnet WETH and USDC token addresses. This implementation assumes exactly 18 decimals for WETH and 6 decimals for USDC.
    50	- Point the oracle at robust Chainlink feeds for WETH/USD and USDC/USD. The adapter assumes both feeds use 8 decimals.
    51	- Set a sane `MAX_ORACLE_DELAY`. If the feeds are stale, borrowing, withdrawals, and liquidations will revert.
    52	- Prefund the market with USDC using `depositLiquidity()`. The contract cannot mint debt tokens; it can only lend out USDC that it already holds.
    53	- Choose `annualInterestBps` deliberately. This implementation is intentionally simple flat-rate simple interest, not compound interest and not a utilization model.
    54	- Understand the oracle basis risk. The market values WETH in USDC by dividing ETH/USD by USDC/USD. If USDC depegs, health and liquidation behavior will follow the feed values.
    55	- Monitor solvency. `totalDebtOutstanding` increases when interest is accrued, so operators must ensure the contract has enough USDC liquidity and a clear process for handling bad debt if collateral value gaps down faster than liquidators can act.
    56	- Accept that there is no governance surface beyond the deployer’s ability to deposit or withdraw excess USDC liquidity. There are no pause controls, no rate updates, and no upgrade hooks in this version.
    57	
    58	## Scope notes
    59	
    60	This is a minimal onchain implementation for the borrowing-market core. It does not include:
    61	
    62	- a frontend or keeper,
    63	- permit support,
    64	- partial reserve accounting for third-party LPs,
    65	- bad-debt socialization,
    66	- multiple collateral types,
    67	- production-grade oracle circuit breakers beyond staleness and positive-price checks.

 succeeded in 174ms:
Compiling 2 files with Solc 0.8.27
Solc 0.8.27 finished in 106.55ms
Compiler run successful!

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9e683783db97206192f253c1cc731b887d7c41d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,67 @@
+# Borrowing Market Notes
+
+## Position health
+
+This market stores collateral in WETH (18 decimals) and debt in USDC (6 decimals).
+
+- Oracle price: `priceE8` is the WETH price in USDC with 8 decimals.
+- Collateral value in USDC units: `collateralValue = collateralAmount * priceE8 / 1e20`
+- Loan-to-value: `ltvBps = debtAmount * 10_000 / collateralValue`
+- Borrow limit: a user can only borrow while `ltvBps <= 7_000` (70%).
+- Withdrawal health check: after a withdrawal, the position must still satisfy `ltvBps <= 8_500` (85%).
+- Liquidation threshold: a position is liquidatable once `ltvBps > 8_500`.
+
+Debt accrues as simple interest, not a utilization-based variable rate:
+
+- `interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+Interest is realized when the position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`. `currentDebt()` and the health view functions include pending accrued interest even before it is written back to storage.
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Check that `loanToValueBps(user) > 8_500`.
+2. Approve USDC to the market contract.
+3. Call `liquidate(user, requestedRepayAmount)`.
+
+The market caps the repay amount to the smaller of:
+
+- the requested repay amount,
+- the borrower’s current debt,
+- the amount of debt that the borrower’s remaining WETH can support after giving the liquidator a 5% bonus.
+
+Collateral seized is:
+
+- `seizedWeth = repaidUsdc * 10_500 * 1e20 / (priceE8 * 10_000)`
+
+That gives the liquidator the WETH equivalent of the repaid USDC plus a 5% bonus, priced off the current oracle value.
+
+## Mainnet deployment / operations
+
+The deployable contracts are:
+
+- `ChainlinkWethUsdcOracle`
+- `SimpleBorrowingMarket`
+
+An operator deploying this on Ethereum mainnet has to get the following right:
+
+- Use the real mainnet WETH and USDC token addresses. This implementation assumes exactly 18 decimals for WETH and 6 decimals for USDC.
+- Point the oracle at robust Chainlink feeds for WETH/USD and USDC/USD. The adapter assumes both feeds use 8 decimals.
+- Set a sane `MAX_ORACLE_DELAY`. If the feeds are stale, borrowing, withdrawals, and liquidations will revert.
+- Prefund the market with USDC using `depositLiquidity()`. The contract cannot mint debt tokens; it can only lend out USDC that it already holds.
+- Choose `annualInterestBps` deliberately. This implementation is intentionally simple flat-rate simple interest, not compound interest and not a utilization model.
+- Understand the oracle basis risk. The market values WETH in USDC by dividing ETH/USD by USDC/USD. If USDC depegs, health and liquidation behavior will follow the feed values.
+- Monitor solvency. `totalDebtOutstanding` increases when interest is accrued, so operators must ensure the contract has enough USDC liquidity and a clear process for handling bad debt if collateral value gaps down faster than liquidators can act.
+- Accept that there is no governance surface beyond the deployer’s ability to deposit or withdraw excess USDC liquidity. There are no pause controls, no rate updates, and no upgrade hooks in this version.
+
+## Scope notes
+
+This is a minimal onchain implementation for the borrowing-market core. It does not include:
+
+- a frontend or keeper,
+- permit support,
+- partial reserve accounting for third-party LPs,
+- bad-debt socialization,
+- multiple collateral types,
+- production-grade oracle circuit breakers beyond staleness and positive-price checks.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..216e76ff0e803620e9a9144efa41f0bb71a73d60
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable WETH_USD_FEED;
+    AggregatorV3Interface public immutable USDC_USD_FEED;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        WETH_USD_FEED = AggregatorV3Interface(wethUsdFeed_);
+        USDC_USD_FEED = AggregatorV3Interface(usdcUsdFeed_);
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = WETH_USD_FEED.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = USDC_USD_FEED.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (WETH_USD_FEED.decimals() != 8 || USDC_USD_FEED.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > MAX_ORACLE_DELAY || block.timestamp - usdcUpdatedAt > MAX_ORACLE_DELAY) {
+            revert StalePrice();
+        }
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac1c0890dcd2348fad8ea635ea1471584338b7a2
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,261 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        OWNER = msg.sender;
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (repaid * (BPS + LIQUIDATION_BONUS_BPS) * 1e20) / (priceE8 * BPS);
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        _safeTransfer(WETH, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = USDC.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = ORACLE.wethPriceInUsdc();
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

  ✓ Inspect the empty workspace and define the minimal contract surface for collateral, borrowing, interest, and liquidation.
  ✓ Scaffold the Foundry project files and implement the market, oracle interface, and deployment-facing configuration.
  ✓ Run forge build, fix compile issues, and write NOTES.md with health, liquidation, and mainnet deployment concerns.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9e683783db97206192f253c1cc731b887d7c41d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,67 @@
+# Borrowing Market Notes
+
+## Position health
+
+This market stores collateral in WETH (18 decimals) and debt in USDC (6 decimals).
+
+- Oracle price: `priceE8` is the WETH price in USDC with 8 decimals.
+- Collateral value in USDC units: `collateralValue = collateralAmount * priceE8 / 1e20`
+- Loan-to-value: `ltvBps = debtAmount * 10_000 / collateralValue`
+- Borrow limit: a user can only borrow while `ltvBps <= 7_000` (70%).
+- Withdrawal health check: after a withdrawal, the position must still satisfy `ltvBps <= 8_500` (85%).
+- Liquidation threshold: a position is liquidatable once `ltvBps > 8_500`.
+
+Debt accrues as simple interest, not a utilization-based variable rate:
+
+- `interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+Interest is realized when the position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`. `currentDebt()` and the health view functions include pending accrued interest even before it is written back to storage.
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Check that `loanToValueBps(user) > 8_500`.
+2. Approve USDC to the market contract.
+3. Call `liquidate(user, requestedRepayAmount)`.
+
+The market caps the repay amount to the smaller of:
+
+- the requested repay amount,
+- the borrower’s current debt,
+- the amount of debt that the borrower’s remaining WETH can support after giving the liquidator a 5% bonus.
+
+Collateral seized is:
+
+- `seizedWeth = repaidUsdc * 10_500 * 1e20 / (priceE8 * 10_000)`
+
+That gives the liquidator the WETH equivalent of the repaid USDC plus a 5% bonus, priced off the current oracle value.
+
+## Mainnet deployment / operations
+
+The deployable contracts are:
+
+- `ChainlinkWethUsdcOracle`
+- `SimpleBorrowingMarket`
+
+An operator deploying this on Ethereum mainnet has to get the following right:
+
+- Use the real mainnet WETH and USDC token addresses. This implementation assumes exactly 18 decimals for WETH and 6 decimals for USDC.
+- Point the oracle at robust Chainlink feeds for WETH/USD and USDC/USD. The adapter assumes both feeds use 8 decimals.
+- Set a sane `MAX_ORACLE_DELAY`. If the feeds are stale, borrowing, withdrawals, and liquidations will revert.
+- Prefund the market with USDC using `depositLiquidity()`. The contract cannot mint debt tokens; it can only lend out USDC that it already holds.
+- Choose `annualInterestBps` deliberately. This implementation is intentionally simple flat-rate simple interest, not compound interest and not a utilization model.
+- Understand the oracle basis risk. The market values WETH in USDC by dividing ETH/USD by USDC/USD. If USDC depegs, health and liquidation behavior will follow the feed values.
+- Monitor solvency. `totalDebtOutstanding` increases when interest is accrued, so operators must ensure the contract has enough USDC liquidity and a clear process for handling bad debt if collateral value gaps down faster than liquidators can act.
+- Accept that there is no governance surface beyond the deployer’s ability to deposit or withdraw excess USDC liquidity. There are no pause controls, no rate updates, and no upgrade hooks in this version.
+
+## Scope notes
+
+This is a minimal onchain implementation for the borrowing-market core. It does not include:
+
+- a frontend or keeper,
+- permit support,
+- partial reserve accounting for third-party LPs,
+- bad-debt socialization,
+- multiple collateral types,
+- production-grade oracle circuit breakers beyond staleness and positive-price checks.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..216e76ff0e803620e9a9144efa41f0bb71a73d60
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable WETH_USD_FEED;
+    AggregatorV3Interface public immutable USDC_USD_FEED;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        WETH_USD_FEED = AggregatorV3Interface(wethUsdFeed_);
+        USDC_USD_FEED = AggregatorV3Interface(usdcUsdFeed_);
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = WETH_USD_FEED.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = USDC_USD_FEED.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (WETH_USD_FEED.decimals() != 8 || USDC_USD_FEED.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > MAX_ORACLE_DELAY || block.timestamp - usdcUpdatedAt > MAX_ORACLE_DELAY) {
+            revert StalePrice();
+        }
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac1c0890dcd2348fad8ea635ea1471584338b7a2
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,261 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        OWNER = msg.sender;
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (repaid * (BPS + LIQUIDATION_BONUS_BPS) * 1e20) / (priceE8 * BPS);
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        _safeTransfer(WETH, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = USDC.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = ORACLE.wethPriceInUsdc();
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

codex
Implemented a minimal Foundry borrowing market with a Chainlink-backed WETH/USDC oracle adapter in [src/SimpleBorrowingMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/SimpleBorrowingMarket.sol:7) and [src/ChainlinkWethUsdcOracle.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/ChainlinkWethUsdcOracle.sol:7). The market supports WETH collateral deposits, USDC borrowing up to 70% LTV, simple flat-rate interest accrual, repayment, healthy collateral withdrawals, owner-seeded USDC liquidity, and third-party liquidations once a position exceeds 85% LTV with a 5% WETH bonus.

I also added [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/foundry.toml:1) and wrote the requested operator notes in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/NOTES.md:1), covering health math, liquidation steps, and mainnet deployment assumptions.

Verification: the contracts compile successfully with:
```bash
HOME=$PWD/.foundry-home XDG_CACHE_HOME=$PWD/.foundry-cache FOUNDRY_CACHE_PATH=$PWD/.foundry-cache forge build
```

One caveat: in this sandbox, a plain `forge build` tries to write to a read-only global Foundry home outside the workspace and fails before compilation starts. The project itself compiles cleanly once Foundry’s cache/home are pointed at local writable paths.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9e683783db97206192f253c1cc731b887d7c41d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,67 @@
+# Borrowing Market Notes
+
+## Position health
+
+This market stores collateral in WETH (18 decimals) and debt in USDC (6 decimals).
+
+- Oracle price: `priceE8` is the WETH price in USDC with 8 decimals.
+- Collateral value in USDC units: `collateralValue = collateralAmount * priceE8 / 1e20`
+- Loan-to-value: `ltvBps = debtAmount * 10_000 / collateralValue`
+- Borrow limit: a user can only borrow while `ltvBps <= 7_000` (70%).
+- Withdrawal health check: after a withdrawal, the position must still satisfy `ltvBps <= 8_500` (85%).
+- Liquidation threshold: a position is liquidatable once `ltvBps > 8_500`.
+
+Debt accrues as simple interest, not a utilization-based variable rate:
+
+- `interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+Interest is realized when the position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`. `currentDebt()` and the health view functions include pending accrued interest even before it is written back to storage.
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Check that `loanToValueBps(user) > 8_500`.
+2. Approve USDC to the market contract.
+3. Call `liquidate(user, requestedRepayAmount)`.
+
+The market caps the repay amount to the smaller of:
+
+- the requested repay amount,
+- the borrower’s current debt,
+- the amount of debt that the borrower’s remaining WETH can support after giving the liquidator a 5% bonus.
+
+Collateral seized is:
+
+- `seizedWeth = repaidUsdc * 10_500 * 1e20 / (priceE8 * 10_000)`
+
+That gives the liquidator the WETH equivalent of the repaid USDC plus a 5% bonus, priced off the current oracle value.
+
+## Mainnet deployment / operations
+
+The deployable contracts are:
+
+- `ChainlinkWethUsdcOracle`
+- `SimpleBorrowingMarket`
+
+An operator deploying this on Ethereum mainnet has to get the following right:
+
+- Use the real mainnet WETH and USDC token addresses. This implementation assumes exactly 18 decimals for WETH and 6 decimals for USDC.
+- Point the oracle at robust Chainlink feeds for WETH/USD and USDC/USD. The adapter assumes both feeds use 8 decimals.
+- Set a sane `MAX_ORACLE_DELAY`. If the feeds are stale, borrowing, withdrawals, and liquidations will revert.
+- Prefund the market with USDC using `depositLiquidity()`. The contract cannot mint debt tokens; it can only lend out USDC that it already holds.
+- Choose `annualInterestBps` deliberately. This implementation is intentionally simple flat-rate simple interest, not compound interest and not a utilization model.
+- Understand the oracle basis risk. The market values WETH in USDC by dividing ETH/USD by USDC/USD. If USDC depegs, health and liquidation behavior will follow the feed values.
+- Monitor solvency. `totalDebtOutstanding` increases when interest is accrued, so operators must ensure the contract has enough USDC liquidity and a clear process for handling bad debt if collateral value gaps down faster than liquidators can act.
+- Accept that there is no governance surface beyond the deployer’s ability to deposit or withdraw excess USDC liquidity. There are no pause controls, no rate updates, and no upgrade hooks in this version.
+
+## Scope notes
+
+This is a minimal onchain implementation for the borrowing-market core. It does not include:
+
+- a frontend or keeper,
+- permit support,
+- partial reserve accounting for third-party LPs,
+- bad-debt socialization,
+- multiple collateral types,
+- production-grade oracle circuit breakers beyond staleness and positive-price checks.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..82062f84b4115f1a2e93c62c7a2a1a4046955053
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.27"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/ChainlinkWethUsdcOracle.sol b/src/ChainlinkWethUsdcOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..216e76ff0e803620e9a9144efa41f0bb71a73d60
--- /dev/null
+++ b/src/ChainlinkWethUsdcOracle.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkWethUsdcOracle is IPriceOracle {
+    error InvalidPrice();
+    error InvalidOracleDecimals();
+    error StalePrice();
+
+    AggregatorV3Interface public immutable WETH_USD_FEED;
+    AggregatorV3Interface public immutable USDC_USD_FEED;
+    uint256 public immutable MAX_ORACLE_DELAY;
+
+    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
+        WETH_USD_FEED = AggregatorV3Interface(wethUsdFeed_);
+        USDC_USD_FEED = AggregatorV3Interface(usdcUsdFeed_);
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+    }
+
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
+        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = WETH_USD_FEED.latestRoundData();
+        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = USDC_USD_FEED.latestRoundData();
+
+        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
+        if (WETH_USD_FEED.decimals() != 8 || USDC_USD_FEED.decimals() != 8) revert InvalidOracleDecimals();
+        if (block.timestamp - wethUpdatedAt > MAX_ORACLE_DELAY || block.timestamp - usdcUpdatedAt > MAX_ORACLE_DELAY) {
+            revert StalePrice();
+        }
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
+        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
+    }
+}
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac1c0890dcd2348fad8ea635ea1471584338b7a2
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,261 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract SimpleBorrowingMarket {
+    error NotOwner();
+    error AmountIsZero();
+    error UnsupportedTokenDecimals();
+    error TransferFailed();
+    error PositionNotHealthy();
+    error PositionHealthy();
+    error InsufficientCollateral();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NothingToLiquidate();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidUsdc,
+        uint256 seizedWeth
+    );
+    event LiquidityDeposited(address indexed provider, uint256 amount);
+    event LiquidityWithdrawn(address indexed receiver, uint256 amount);
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrualTime;
+    }
+
+    uint256 internal constant BPS = 10_000;
+    uint256 internal constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public totalDebtOutstanding;
+
+    mapping(address => Position) public positions;
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        OWNER = msg.sender;
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert UnsupportedTokenDecimals();
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        positions[msg.sender].collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount < amount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        uint256 newDebt = position.debtAmount + amount;
+        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebt;
+        totalDebtOutstanding += amount;
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaid) {
+        if (amount == 0) revert AmountIsZero();
+
+        _accrue(msg.sender);
+        Position storage position = positions[msg.sender];
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaid = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaid;
+        totalDebtOutstanding -= repaid;
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+
+        emit Repaid(msg.sender, msg.sender, repaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
+        if (requestedRepayAmount == 0) revert AmountIsZero();
+
+        _accrue(user);
+        Position storage position = positions[user];
+        if (position.debtAmount == 0) revert NoDebt();
+        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
+            revert PositionHealthy();
+        }
+
+        uint256 priceE8 = _priceE8();
+        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
+        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
+            / (BPS + LIQUIDATION_BONUS_BPS);
+
+        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
+        if (repaid == 0) revert NothingToLiquidate();
+
+        seized = (repaid * (BPS + LIQUIDATION_BONUS_BPS) * 1e20) / (priceE8 * BPS);
+        if (seized > position.collateralAmount) {
+            seized = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaid;
+        position.collateralAmount -= seized;
+        totalDebtOutstanding -= repaid;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
+        _safeTransfer(WETH, msg.sender, seized);
+
+        emit Repaid(msg.sender, user, repaid);
+        emit Liquidated(msg.sender, user, repaid, seized);
+    }
+
+    function depositLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+
+        uint256 lockedDebt = totalDebtOutstanding;
+        uint256 liquidBalance = USDC.balanceOf(address(this));
+        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();
+
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityWithdrawn(to, amount);
+    }
+
+    function currentDebt(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        return _accruedDebt(position);
+    }
+
+    function healthFactorBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return type(uint256).max;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        return (collateralValue * BPS) / debt;
+    }
+
+    function loanToValueBps(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _accruedDebt(position);
+        if (debt == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return (debt * BPS) / collateralValue;
+    }
+
+    function _accrue(address user) internal {
+        Position storage position = positions[user];
+        uint256 lastAccrualTime = position.lastAccrualTime;
+
+        if (lastAccrualTime == 0) {
+            position.lastAccrualTime = block.timestamp;
+            return;
+        }
+
+        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
+            uint256 elapsed = block.timestamp - lastAccrualTime;
+            uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+            position.debtAmount += interest;
+            totalDebtOutstanding += interest;
+        }
+
+        position.lastAccrualTime = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrualTime;
+        uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
+        return position.debtAmount + interest;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
+    }
+
+    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
+        if (collateralValue == 0) return false;
+
+        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
+        return (collateralAmount * priceE8) / 1e20;
+    }
+
+    function _priceE8() internal view returns (uint256 priceE8) {
+        (priceE8,) = ORACLE.wethPriceInUsdc();
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        if (!token.transfer(to, amount)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4c62c02e81792bc1ef0a17cb024766fa381d6a03
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface AggregatorV3Interface {
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed16a2c4efcd362f7ff02e5d1794a3c63be4ce
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d0f39ba31e404687fb1c9be38ce10005c4f95ff
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.27;
+
+interface IPriceOracle {
+    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
+}
+

tokens used
54,659
````

## final message

Implemented a minimal Foundry borrowing market with a Chainlink-backed WETH/USDC oracle adapter in [src/SimpleBorrowingMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/SimpleBorrowingMarket.sol:7) and [src/ChainlinkWethUsdcOracle.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/src/ChainlinkWethUsdcOracle.sol:7). The market supports WETH collateral deposits, USDC borrowing up to 70% LTV, simple flat-rate interest accrual, repayment, healthy collateral withdrawals, owner-seeded USDC liquidity, and third-party liquidations once a position exceeds 85% LTV with a 5% WETH bonus.

I also added [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/foundry.toml:1) and wrote the requested operator notes in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041628Z-codex-no-skill-2/security-goal-002/NOTES.md:1), covering health math, liquidation steps, and mainnet deployment assumptions.

Verification: the contracts compile successfully with:
```bash
HOME=$PWD/.foundry-home XDG_CACHE_HOME=$PWD/.foundry-cache FOUNDRY_CACHE_PATH=$PWD/.foundry-cache forge build
```

One caveat: in this sandbox, a plain `forge build` tries to write to a read-only global Foundry home outside the workspace and fails before compilation starts. The project itself compiles cleanly once Foundry’s cache/home are pointed at local writable paths.

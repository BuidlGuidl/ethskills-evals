# Executor transcript — 2026-08-31T211611Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059b2-aea4-7c53-ad33-085feb8f850a
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

2026-08-31T21:21:17.702750Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059b2-aea4-7c53-ad33-085feb8f850a.tmp-1788211277484850782: line 2547: syntax error near unexpected token `('

codex
I’m setting up a Foundry-based implementation for the borrowing market in this workspace. First I’m checking the current directory contents and any existing repo state so I can build on what’s already here instead of assuming an empty project.
exec
/bin/bash -lc pwd in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
exec
/bin/bash -lc 'rg --files' in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
 succeeded in 13ms:
/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002

exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
 succeeded in 16ms:
TASK.md
package.json

 succeeded in 13ms:
codex
The workspace is essentially empty apart from task metadata, so I’m reading those files and then I’ll scaffold the Foundry project and contract layout directly.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
exec
/bin/bash -lc "sed -n '1,220p' package.json" in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
exec
/bin/bash -lc 'forge --version' in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
 succeeded in 12ms:
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

 succeeded in 12ms:
{
  "name": "eval-workspace",
  "private": true
}

 succeeded in 15ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

codex
I have enough context now. I’m going to build a minimal two-contract design: a market that holds WETH/USDC accounting and a price oracle adapter for a Chainlink-style feed, then add deployment notes focused on health math, liquidation flow, and mainnet operational risks.
exec
/bin/bash -lc 'mkdir -p src script test lib' in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
 succeeded in 3ms:
codex
I’m writing the project files now. The implementation will avoid external dependencies so `forge build` works without a package install step, and the notes will explicitly call out oracle freshness, funding, and liquidation edge cases for mainnet deployment.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/NOTES.md
/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/foundry.toml
/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/src/BorrowingMarket.sol
/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/src/ChainlinkWethUsdOracle.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..25850e612f94414af86163a9618e28461eab3aa8
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,265 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    uint256 public immutable annualInterestRateWad;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += uint128(amount);
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= uint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = uint128(newDebt);
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = uint128(debt - repayAmount);
+        position.collateralAmount -= uint128(collateralSeized);
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repayAmount);
+        _safeTransfer(weth, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(weth), "weth blocked");
+        require(token != address(usdc), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = uint128(debt - actualRepaid);
+        _safeTransferFrom(usdc, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = uint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * oracle.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = oracle.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
+
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..440c58d146aa3a6a3bb4a6bff58655a48164bd3e
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,39 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable feed;
+    uint256 public immutable maxStaleness;
+    uint256 public immutable scaleFactor;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        feed = IAggregatorV3(feed_);
+        maxStaleness = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        scaleFactor = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > maxStaleness) revert StalePrice();
+        return uint256(answer) * scaleFactor;
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..25850e612f94414af86163a9618e28461eab3aa8
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,265 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    uint256 public immutable annualInterestRateWad;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += uint128(amount);
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= uint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = uint128(newDebt);
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = uint128(debt - repayAmount);
+        position.collateralAmount -= uint128(collateralSeized);
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repayAmount);
+        _safeTransfer(weth, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(weth), "weth blocked");
+        require(token != address(usdc), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = uint128(debt - actualRepaid);
+        _safeTransferFrom(usdc, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = uint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * oracle.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = oracle.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
+
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..440c58d146aa3a6a3bb4a6bff58655a48164bd3e
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,39 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable feed;
+    uint256 public immutable maxStaleness;
+    uint256 public immutable scaleFactor;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        feed = IAggregatorV3(feed_);
+        maxStaleness = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        scaleFactor = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > maxStaleness) revert StalePrice();
+        return uint256(answer) * scaleFactor;
+    }
+}
+

codex
The contract set is in place. I’m compiling now and will fix any issues the compiler surfaces before I close this out.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
exec
/bin/bash -lc 'rg -n "pragma|contract|interface|function" src NOTES.md foundry.toml' in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
 succeeded in 0ms:
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..25850e612f94414af86163a9618e28461eab3aa8
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,265 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    uint256 public immutable annualInterestRateWad;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += uint128(amount);
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= uint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = uint128(newDebt);
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = uint128(debt - repayAmount);
+        position.collateralAmount -= uint128(collateralSeized);
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repayAmount);
+        _safeTransfer(weth, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(weth), "weth blocked");
+        require(token != address(usdc), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = uint128(debt - actualRepaid);
+        _safeTransferFrom(usdc, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = uint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * oracle.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = oracle.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
+
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..440c58d146aa3a6a3bb4a6bff58655a48164bd3e
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,39 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable feed;
+    uint256 public immutable maxStaleness;
+    uint256 public immutable scaleFactor;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        feed = IAggregatorV3(feed_);
+        maxStaleness = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        scaleFactor = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > maxStaleness) revert StalePrice();
+        return uint256(answer) * scaleFactor;
+    }
+}
+

 exited 1 in 1961ms:
Error: Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..25850e612f94414af86163a9618e28461eab3aa8
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,265 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    uint256 public immutable annualInterestRateWad;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += uint128(amount);
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= uint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = uint128(newDebt);
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = uint128(debt - repayAmount);
+        position.collateralAmount -= uint128(collateralSeized);
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repayAmount);
+        _safeTransfer(weth, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(weth), "weth blocked");
+        require(token != address(usdc), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = uint128(debt - actualRepaid);
+        _safeTransferFrom(usdc, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = uint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * oracle.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = oracle.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
+
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..440c58d146aa3a6a3bb4a6bff58655a48164bd3e
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,39 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable feed;
+    uint256 public immutable maxStaleness;
+    uint256 public immutable scaleFactor;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        feed = IAggregatorV3(feed_);
+        maxStaleness = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        scaleFactor = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > maxStaleness) revert StalePrice();
+        return uint256(answer) * scaleFactor;
+    }
+}
+

codex
`forge build` hit an environment issue rather than a Solidity issue: Foundry is trying to write outside the writable workspace. I’m rerunning it with local cache/home paths pinned into this directory so the actual compile can complete here.
exec
/bin/bash -lc 'mkdir -p .foundry-home .foundry-cache' in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
 succeeded in 2ms:
exec
/bin/bash -lc 'HOME=$PWD/.foundry-home XDG_CACHE_HOME=$PWD/.foundry-cache forge build' in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..25850e612f94414af86163a9618e28461eab3aa8
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,265 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    uint256 public immutable annualInterestRateWad;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += uint128(amount);
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= uint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = uint128(newDebt);
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = uint128(debt - repayAmount);
+        position.collateralAmount -= uint128(collateralSeized);
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repayAmount);
+        _safeTransfer(weth, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(weth), "weth blocked");
+        require(token != address(usdc), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = uint128(debt - actualRepaid);
+        _safeTransferFrom(usdc, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = uint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * oracle.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = oracle.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
+
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..440c58d146aa3a6a3bb4a6bff58655a48164bd3e
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,39 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable feed;
+    uint256 public immutable maxStaleness;
+    uint256 public immutable scaleFactor;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        feed = IAggregatorV3(feed_);
+        maxStaleness = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        scaleFactor = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > maxStaleness) revert StalePrice();
+        return uint256(answer) * scaleFactor;
+    }
+}
+

 succeeded in 2911ms:
Compiling 2 files with Solc 0.8.30
Solc 0.8.30 finished in 118.66ms
Compiler run successful!
2026-08-31T21:23:15.488630Z  WARN evm::traces: failed to read cache file path="/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/.foundry-home/.foundry/cache/signatures" err=Read { source: Os { code: 2, kind: NotFound, message: "No such file or directory" }, path: "/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/.foundry-home/.foundry/cache/signatures" }
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ChainlinkWethUsdOracle.sol:13:36
   |
13 |     IAggregatorV3 public immutable feed;
   |                                    ^^^^ help: consider using: `FEED`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:23:29
   |
23 |     IERC20 public immutable weth;
   |                             ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:24:29
   |
24 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:25:35
   |
25 |     IPriceOracle public immutable oracle;
   |                                   ^^^^^^ help: consider using: `ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:26:30
   |
26 |     uint256 public immutable annualInterestRateWad;
   |                              ^^^^^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_RATE_WAD`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ChainlinkWethUsdOracle.sol:14:30
   |
14 |     uint256 public immutable maxStaleness;
   |                              ^^^^^^^^^^^^ help: consider using: `MAX_STALENESS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ChainlinkWethUsdOracle.sol:15:30
   |
15 |     uint256 public immutable scaleFactor;
   |                              ^^^^^^^^^^^ help: consider using: `SCALE_FACTOR`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/BorrowingMarket.sol:69:5
   |
69 | /     modifier onlyOwner() {
70 | |         if (msg.sender != owner) revert NotOwner();
71 | |         _;
72 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
69 ~     modifier onlyOwner() {
70 +         _onlyOwner();
71 +         _;
72 +     }
73 + 
74 +     function _onlyOwner() internal {
75 +         if (msg.sender != owner) revert NotOwner();
76 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/BorrowingMarket.sol:85:38
   |
85 |         position.collateralAmount += uint128(amount);
   |                                      ^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint128' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/BorrowingMarket.sol:98:38
   |
98 |         position.collateralAmount -= uint128(amount);
   |                                      ^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint128' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/BorrowingMarket.sol:116:34
    |
116 |         position.debtPrincipal = uint128(newDebt);
    |                                  ^^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint128' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/BorrowingMarket.sol:143:34
    |
143 |         position.debtPrincipal = uint128(debt - repayAmount);
    |                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint128' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/BorrowingMarket.sol:144:38
    |
144 |         position.collateralAmount -= uint128(collateralSeized);
    |                                      ^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint128' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/BorrowingMarket.sol:199:34
    |
199 |         position.debtPrincipal = uint128(debt - actualRepaid);
    |                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint128' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/BorrowingMarket.sol:220:34
    |
220 |         position.debtPrincipal = uint128(debt + interest);
    |                                  ^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint128' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/ChainlinkWethUsdOracle.sol:36:16
   |
36 |         return uint256(answer) * scaleFactor;
   |                ^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint256' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..25850e612f94414af86163a9618e28461eab3aa8
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,265 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IPriceOracle public immutable oracle;
+    uint256 public immutable annualInterestRateWad;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += uint128(amount);
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= uint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = uint128(newDebt);
+        _safeTransfer(usdc, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = uint128(debt - repayAmount);
+        position.collateralAmount -= uint128(collateralSeized);
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repayAmount);
+        _safeTransfer(weth, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(weth), "weth blocked");
+        require(token != address(usdc), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = uint128(debt - actualRepaid);
+        _safeTransferFrom(usdc, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = uint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * annualInterestRateWad * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * oracle.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = oracle.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
+
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..440c58d146aa3a6a3bb4a6bff58655a48164bd3e
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,39 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable feed;
+    uint256 public immutable maxStaleness;
+    uint256 public immutable scaleFactor;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        feed = IAggregatorV3(feed_);
+        maxStaleness = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        scaleFactor = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > maxStaleness) revert StalePrice();
+        return uint256(answer) * scaleFactor;
+    }
+}
+

codex
The build already succeeds, but I’m tightening a few details the compiler/linter flagged so the implementation is cleaner and the numeric bounds are explicit rather than implicit.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/src/BorrowingMarket.sol
/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/src/ChainlinkWethUsdOracle.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8b37c2384be35c2ded5191afef61453ab32789b4
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,274 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+    error AmountTooLarge();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != owner) revert NotOwner();
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += _toUint128(amount);
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= _toUint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = _toUint128(newDebt);
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = uint128(debt - repayAmount);
+        position.collateralAmount -= uint128(collateralSeized);
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repayAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(WETH), "weth blocked");
+        require(token != address(USDC), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = _toUint128(debt - actualRepaid);
+        _safeTransferFrom(USDC, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = _toUint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * ORACLE.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = ORACLE.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _toUint128(uint256 value) internal pure returns (uint128) {
+        if (value > type(uint128).max) revert AmountTooLarge();
+        return uint128(value);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..afa55df5aaa501295068a2e1966873388d937201
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable FEED;
+    uint256 public immutable MAX_STALENESS;
+    uint256 public immutable SCALE_FACTOR;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        FEED = IAggregatorV3(feed_);
+        MAX_STALENESS = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        SCALE_FACTOR = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = FEED.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > MAX_STALENESS) revert StalePrice();
+        return uint256(answer) * SCALE_FACTOR;
+    }
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8b37c2384be35c2ded5191afef61453ab32789b4
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,274 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+    error AmountTooLarge();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != owner) revert NotOwner();
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += _toUint128(amount);
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= _toUint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = _toUint128(newDebt);
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = uint128(debt - repayAmount);
+        position.collateralAmount -= uint128(collateralSeized);
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repayAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(WETH), "weth blocked");
+        require(token != address(USDC), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = _toUint128(debt - actualRepaid);
+        _safeTransferFrom(USDC, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = _toUint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * ORACLE.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = ORACLE.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _toUint128(uint256 value) internal pure returns (uint128) {
+        if (value > type(uint128).max) revert AmountTooLarge();
+        return uint128(value);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..afa55df5aaa501295068a2e1966873388d937201
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable FEED;
+    uint256 public immutable MAX_STALENESS;
+    uint256 public immutable SCALE_FACTOR;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        FEED = IAggregatorV3(feed_);
+        MAX_STALENESS = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        SCALE_FACTOR = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = FEED.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > MAX_STALENESS) revert StalePrice();
+        return uint256(answer) * SCALE_FACTOR;
+    }
+}

exec
/bin/bash -lc 'HOME=$PWD/.foundry-home XDG_CACHE_HOME=$PWD/.foundry-cache forge build' in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
 succeeded in 155ms:
Compiling 2 files with Solc 0.8.30
Solc 0.8.30 finished in 119.82ms
Compiler run successful!
warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/ChainlinkWethUsdOracle.sol:36:16
   |
36 |         return uint256(answer) * SCALE_FACTOR;
   |                ^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint256' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/BorrowingMarket.sol:148:34
    |
148 |         position.debtPrincipal = uint128(debt - repayAmount);
    |                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint128' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/BorrowingMarket.sol:149:38
    |
149 |         position.collateralAmount -= uint128(collateralSeized);
    |                                      ^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint128' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/BorrowingMarket.sol:262:16
    |
262 |         return uint128(value);
    |                ^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint128' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8b37c2384be35c2ded5191afef61453ab32789b4
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,274 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+    error AmountTooLarge();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != owner) revert NotOwner();
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += _toUint128(amount);
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= _toUint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = _toUint128(newDebt);
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = uint128(debt - repayAmount);
+        position.collateralAmount -= uint128(collateralSeized);
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repayAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(WETH), "weth blocked");
+        require(token != address(USDC), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = _toUint128(debt - actualRepaid);
+        _safeTransferFrom(USDC, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = _toUint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * ORACLE.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = ORACLE.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _toUint128(uint256 value) internal pure returns (uint128) {
+        if (value > type(uint128).max) revert AmountTooLarge();
+        return uint128(value);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..afa55df5aaa501295068a2e1966873388d937201
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable FEED;
+    uint256 public immutable MAX_STALENESS;
+    uint256 public immutable SCALE_FACTOR;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        FEED = IAggregatorV3(feed_);
+        MAX_STALENESS = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        SCALE_FACTOR = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = FEED.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > MAX_STALENESS) revert StalePrice();
+        return uint256(answer) * SCALE_FACTOR;
+    }
+}

codex
I’m making one last cleanup pass so the code is explicit about the remaining safe casts. After that I’ll verify the compile again and summarize the deliverables and the sandbox caveat around Foundry’s cache path.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/src/BorrowingMarket.sol
/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/src/ChainlinkWethUsdOracle.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0db4fec2d528a91674a39c4f224f6a43e6e4d2a4
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,275 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+    error AmountTooLarge();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != owner) revert NotOwner();
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += _toUint128(amount);
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= _toUint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = _toUint128(newDebt);
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = _toUint128(debt - repayAmount);
+        position.collateralAmount -= _toUint128(collateralSeized);
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repayAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(WETH), "weth blocked");
+        require(token != address(USDC), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = _toUint128(debt - actualRepaid);
+        _safeTransferFrom(USDC, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = _toUint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * ORACLE.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = ORACLE.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _toUint128(uint256 value) internal pure returns (uint128) {
+        if (value > type(uint128).max) revert AmountTooLarge();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint128(value);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bdfd04d51bf034617795f6c0b2f5da5504583d01
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,39 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable FEED;
+    uint256 public immutable MAX_STALENESS;
+    uint256 public immutable SCALE_FACTOR;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        FEED = IAggregatorV3(feed_);
+        MAX_STALENESS = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        SCALE_FACTOR = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = FEED.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > MAX_STALENESS) revert StalePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer) * SCALE_FACTOR;
+    }
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0db4fec2d528a91674a39c4f224f6a43e6e4d2a4
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,275 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+    error AmountTooLarge();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != owner) revert NotOwner();
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += _toUint128(amount);
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= _toUint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = _toUint128(newDebt);
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = _toUint128(debt - repayAmount);
+        position.collateralAmount -= _toUint128(collateralSeized);
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repayAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(WETH), "weth blocked");
+        require(token != address(USDC), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = _toUint128(debt - actualRepaid);
+        _safeTransferFrom(USDC, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = _toUint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * ORACLE.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = ORACLE.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _toUint128(uint256 value) internal pure returns (uint128) {
+        if (value > type(uint128).max) revert AmountTooLarge();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint128(value);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bdfd04d51bf034617795f6c0b2f5da5504583d01
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,39 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable FEED;
+    uint256 public immutable MAX_STALENESS;
+    uint256 public immutable SCALE_FACTOR;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        FEED = IAggregatorV3(feed_);
+        MAX_STALENESS = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        SCALE_FACTOR = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = FEED.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > MAX_STALENESS) revert StalePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer) * SCALE_FACTOR;
+    }
+}

exec
/bin/bash -lc 'HOME=$PWD/.foundry-home XDG_CACHE_HOME=$PWD/.foundry-cache forge build' in /tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002
 succeeded in 164ms:
Compiling 2 files with Solc 0.8.30
Solc 0.8.30 finished in 123.61ms
Compiler run successful!

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0db4fec2d528a91674a39c4f224f6a43e6e4d2a4
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,275 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+    error AmountTooLarge();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != owner) revert NotOwner();
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += _toUint128(amount);
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= _toUint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = _toUint128(newDebt);
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = _toUint128(debt - repayAmount);
+        position.collateralAmount -= _toUint128(collateralSeized);
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repayAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(WETH), "weth blocked");
+        require(token != address(USDC), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = _toUint128(debt - actualRepaid);
+        _safeTransferFrom(USDC, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = _toUint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * ORACLE.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = ORACLE.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _toUint128(uint256 value) internal pure returns (uint128) {
+        if (value > type(uint128).max) revert AmountTooLarge();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint128(value);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bdfd04d51bf034617795f6c0b2f5da5504583d01
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,39 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable FEED;
+    uint256 public immutable MAX_STALENESS;
+    uint256 public immutable SCALE_FACTOR;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        FEED = IAggregatorV3(feed_);
+        MAX_STALENESS = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        SCALE_FACTOR = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = FEED.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > MAX_STALENESS) revert StalePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer) * SCALE_FACTOR;
+    }
+}

codex
Implemented a minimal Foundry project for the onchain borrowing market. The main contract is [src/BorrowingMarket.sol](/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/src/BorrowingMarket.sol), with a Chainlink-style oracle adapter in [src/ChainlinkWethUsdOracle.sol](/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/src/ChainlinkWethUsdOracle.sol) and deployment/operations notes in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/NOTES.md). I also added [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/foundry.toml).

The market supports WETH collateral deposits, USDC borrowing up to 70% LTV, simple linear interest accrual at a fixed annual rate, healthy withdrawals/repayments, and partial liquidations above 85% LTV with a 5% collateral bonus.

Verification: Solidity compiles successfully with `forge build`. In this sandbox I had to pin Foundry’s cache/home into the workspace:
```bash
HOME=$PWD/.foundry-home XDG_CACHE_HOME=$PWD/.foundry-cache forge build
```
That workaround is only for the restricted environment here.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..aaba70a36bd6c10ccc924413989c8a3de3dba33b
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,49 @@
+# Borrowing Market Notes
+
+## Health computation
+
+The market prices collateral in USD using `oracle.getPrice()`, which must return the USD price of `1e18` WETH scaled to `1e18`.
+
+- `collateralValueUsd = collateralAmount * wethUsdPrice / 1e18`
+- `debt = storedPrincipal + simpleInterestAccrued`
+- `simpleInterestAccrued = principal * annualRate * elapsedSeconds / (1e18 * 365 days)`
+- `ltv = debt / collateralValueUsd`
+
+Enforcement thresholds:
+
+- Borrowing is capped at `70%` LTV.
+- Withdrawals are allowed only if the resulting position remains at or below `85%` LTV.
+- A position becomes liquidatable once debt is above `85%` of collateral value.
+
+The contract uses simple linear interest, not compounding. Interest only becomes stored when a position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Detect that a user's current debt exceeds `85%` of current collateral value.
+2. Approve the market contract to pull USDC from the liquidator.
+3. Call `liquidate(user, repayAmount)`.
+
+On liquidation:
+
+- The liquidator repays `repayAmount` USDC.
+- The market calculates the seized WETH based on the repaid USD value plus a `5%` bonus.
+- `collateralSeized = repayAmount * 1.05 / wethUsdPrice`
+- The market transfers that WETH from the borrower's collateral to the liquidator.
+
+The implementation allows partial liquidations. Callers need to choose `repayAmount` small enough that the borrower still has enough collateral to cover the repayment plus bonus at the current oracle price.
+
+## Mainnet deployment and operations
+
+An operator deploying this on Ethereum mainnet needs to get the following right:
+
+- Use the canonical mainnet token addresses for WETH and USDC.
+- Point the oracle adapter at a production-grade ETH/USD or WETH/USD Chainlink feed and set a sensible `maxStaleness` threshold.
+- Understand the pricing assumption: if an ETH/USD feed is used, the system is assuming WETH tracks ETH exactly.
+- Fund the market with USDC before allowing borrowing, otherwise `borrow` reverts for lack of liquidity.
+- Monitor the USDC pool balance and top it up as lenders or treasury policy require.
+- Protect the owner key. The only privileged actions are owner rotation, USDC funding, and sweeping non-core tokens sent accidentally to the contract.
+- Review decimal conventions carefully in monitoring and integrations: WETH is expected to be `18` decimals, USDC amounts are transferred in native USDC base units (`6` decimals), and the oracle normalizes prices to `1e18`.
+- Run separate monitoring for stale oracle data and liquidity exhaustion. Both are operational failure modes even if the contracts themselves behave as written.
+- Treat this as a minimal market implementation. For production hardening, you would normally add governance around parameter changes, a lender accounting layer, more robust oracle sanity checks, liquidation close-factor rules, and a formal audit.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..59f3e5c255ac9245fea30be115f33232b11f2093
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0db4fec2d528a91674a39c4f224f6a43e6e4d2a4
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,275 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+interface IPriceOracle {
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256);
+}
+
+contract BorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IPriceOracle public immutable ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    address public owner;
+
+    struct Position {
+        uint128 collateralAmount;
+        uint128 debtPrincipal;
+        uint64 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 newDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed user,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event OwnerUpdated(address indexed newOwner);
+
+    error NotOwner();
+    error ZeroAmount();
+    error PositionHealthy();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error HealthFactorTooLow();
+    error RepayTooLarge();
+    error TransferFailed();
+    error AmountTooLarge();
+
+    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestRateWad_, address owner_) {
+        require(weth_ != address(0) && usdc_ != address(0) && oracle_ != address(0) && owner_ != address(0), "zero");
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ORACLE = IPriceOracle(oracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        owner = owner_;
+        emit OwnerUpdated(owner_);
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != owner) revert NotOwner();
+    }
+
+    function setOwner(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero");
+        owner = newOwner;
+        emit OwnerUpdated(newOwner);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += _toUint128(amount);
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+        position.collateralAmount -= _toUint128(amount);
+
+        if (!_isHealthy(position.collateralAmount, position.debtPrincipal)) revert HealthFactorTooLow();
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = uint256(position.debtPrincipal) + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebt)) revert HealthFactorTooLow();
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        position.debtPrincipal = _toUint128(newDebt);
+        _safeTransfer(USDC, msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount, newDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address user, uint256 amount) external returns (uint256 actualRepaid) {
+        actualRepaid = _repay(msg.sender, user, amount);
+    }
+
+    function liquidate(address user, uint256 repayAmount) external returns (uint256 collateralSeized) {
+        if (repayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (_isHealthy(position.collateralAmount, debt)) revert PositionHealthy();
+        if (repayAmount > debt) revert RepayTooLarge();
+
+        collateralSeized = _collateralForRepay(repayAmount);
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal = _toUint128(debt - repayAmount);
+        position.collateralAmount -= _toUint128(collateralSeized);
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repayAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, user, repayAmount, collateralSeized, position.debtPrincipal);
+    }
+
+    function fundUsdc(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+    }
+
+    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
+        require(token != address(WETH), "weth blocked");
+        require(token != address(USDC), "usdc blocked");
+        _safeTransfer(IERC20(token), to, amount);
+    }
+
+    function getCurrentDebt(address user) external view returns (uint256) {
+        return _currentDebt(positions[user]);
+    }
+
+    function getCollateralValueUsd(address user) external view returns (uint256) {
+        return _collateralValueUsd(positions[user].collateralAmount);
+    }
+
+    function getPositionHealth(address user) external view returns (uint256 collateralValueUsd, uint256 debt, uint256 ltvBps) {
+        Position memory position = positions[user];
+        collateralValueUsd = _collateralValueUsd(position.collateralAmount);
+        debt = _currentDebt(position);
+        ltvBps = collateralValueUsd == 0 ? 0 : (debt * BPS) / collateralValueUsd;
+    }
+
+    function maxBorrowable(address user) external view returns (uint256) {
+        Position memory position = positions[user];
+        uint256 debt = _currentDebt(position);
+        uint256 maxDebt = (_collateralValueUsd(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        return maxDebt > debt ? maxDebt - debt : 0;
+    }
+
+    function liquidationPreview(uint256 repayAmount) external view returns (uint256 collateralSeized) {
+        return _collateralForRepay(repayAmount);
+    }
+
+    function _repay(address payer, address user, uint256 amount) internal returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[user];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        actualRepaid = amount > debt ? debt : amount;
+        if (actualRepaid == 0) revert ZeroAmount();
+
+        position.debtPrincipal = _toUint128(debt - actualRepaid);
+        _safeTransferFrom(USDC, payer, address(this), actualRepaid);
+
+        emit Repaid(payer, user, actualRepaid, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint64 timestamp = position.lastAccrued;
+        if (timestamp == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return;
+        }
+
+        uint256 elapsed = block.timestamp - uint256(timestamp);
+        uint256 interest = (debt * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        position.debtPrincipal = _toUint128(debt + interest);
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _currentDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtPrincipal == 0) return 0;
+        if (position.lastAccrued == 0) return position.debtPrincipal;
+
+        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
+        uint256 interest = (uint256(position.debtPrincipal) * ANNUAL_INTEREST_RATE_WAD * elapsed) / (WAD * SECONDS_PER_YEAR);
+        return uint256(position.debtPrincipal) + interest;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        return debt <= (collateralValueUsd * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        if (debt == 0) return true;
+        uint256 collateralValueUsd = _collateralValueUsd(collateralAmount);
+        if (collateralValueUsd == 0) return false;
+        return debt <= (collateralValueUsd * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function _collateralValueUsd(uint256 collateralAmount) internal view returns (uint256) {
+        return (collateralAmount * ORACLE.getPrice()) / WAD;
+    }
+
+    function _collateralForRepay(uint256 repayAmount) internal view returns (uint256) {
+        uint256 price = ORACLE.getPrice();
+        uint256 repayValueWithBonus = (repayAmount * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        return (repayValueWithBonus * WAD) / price;
+    }
+
+    function _toUint128(uint256 value) internal pure returns (uint128) {
+        if (value > type(uint128).max) revert AmountTooLarge();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint128(value);
+    }
+
+    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        bool ok = token.transfer(to, amount);
+        if (!ok) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        bool ok = token.transferFrom(from, to, amount);
+        if (!ok) revert TransferFailed();
+    }
+}
diff --git a/src/ChainlinkWethUsdOracle.sol b/src/ChainlinkWethUsdOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bdfd04d51bf034617795f6c0b2f5da5504583d01
--- /dev/null
+++ b/src/ChainlinkWethUsdOracle.sol
@@ -0,0 +1,39 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract ChainlinkWethUsdOracle {
+    IAggregatorV3 public immutable FEED;
+    uint256 public immutable MAX_STALENESS;
+    uint256 public immutable SCALE_FACTOR;
+
+    error InvalidPrice();
+    error StalePrice();
+    error UnsupportedDecimals();
+
+    constructor(address feed_, uint256 maxStaleness_) {
+        require(feed_ != address(0), "zero");
+        FEED = IAggregatorV3(feed_);
+        MAX_STALENESS = maxStaleness_;
+
+        uint8 decimals = IAggregatorV3(feed_).decimals();
+        if (decimals > 18) revert UnsupportedDecimals();
+        SCALE_FACTOR = 10 ** (18 - decimals);
+    }
+
+    /// @dev Returns the USD price of 1 WETH scaled to 1e18.
+    function getPrice() external view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = FEED.latestRoundData();
+        if (answer <= 0 || answeredInRound == 0) revert InvalidPrice();
+        if (block.timestamp - updatedAt > MAX_STALENESS) revert StalePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer) * SCALE_FACTOR;
+    }
+}

tokens used
30,319
````

## final message

Implemented a minimal Foundry project for the onchain borrowing market. The main contract is [src/BorrowingMarket.sol](/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/src/BorrowingMarket.sol), with a Chainlink-style oracle adapter in [src/ChainlinkWethUsdOracle.sol](/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/src/ChainlinkWethUsdOracle.sol) and deployment/operations notes in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/NOTES.md). I also added [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211611Z-codex-no-skill-1/security-goal-002/foundry.toml).

The market supports WETH collateral deposits, USDC borrowing up to 70% LTV, simple linear interest accrual at a fixed annual rate, healthy withdrawals/repayments, and partial liquidations above 85% LTV with a 5% collateral bonus.

Verification: Solidity compiles successfully with `forge build`. In this sandbox I had to pin Foundry’s cache/home into the workspace:
```bash
HOME=$PWD/.foundry-home XDG_CACHE_HOME=$PWD/.foundry-cache forge build
```
That workaround is only for the restricted environment here.

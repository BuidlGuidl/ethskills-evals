# Executor transcript — 2026-09-04T041627Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06aa4-f348-7ac0-8a10-88959ccee393
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
I’m setting up the workspace for a Foundry-based lending market and will first inspect the directory state so I can add the project without trampling anything already present.
exec
/bin/bash -lc 'rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002
 succeeded in 4ms:
TASK.md
package.json

 succeeded in 5ms:
/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002

exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002
 succeeded in 5ms:
codex
The workspace is effectively empty apart from a task file and `package.json`. I’m reading those now and then I’ll lay down the Foundry structure, lending contracts, and deployment notes.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002
 succeeded in 15ms:
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
/bin/bash -lc "sed -n '1,220p' package.json" in /home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002
 succeeded in 12ms:
{
  "name": "eval-workspace",
  "private": true
}

codex
Plan:
1. Inspect local tool availability and pick the minimal Foundry project layout that will compile in this environment.
2. Add the lending market contracts, interfaces, and config files.
3. Run `forge build`, fix any compile issues, then write `NOTES.md` with health, liquidation, and deployment requirements.
  ✓ Inspect tool availability and current workspace state for a Foundry setup
  → Add Foundry project files and implement the borrowing market contracts
  • Run forge build, fix issues, and write NOTES.md
exec
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

exec
/bin/bash -lc 'solc --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002
 succeeded in 133ms:
solc, the solidity compiler commandline interface
Version: 0.8.20+commit.a1b79de6.Linux.g++

codex
I’ve confirmed `forge` is available. Next I’m writing a minimal self-contained Foundry project with no external dependencies, using a Chainlink-style ETH/USD oracle interface so the market can price WETH against USDC on mainnet.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/.gitignore
/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/foundry.toml
/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/src/EthUsdCMBorrowingMarket.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/src/interfaces/IAggregatorV3.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/src/interfaces/IERC20.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..69fc0e069f74c3f67cf2e3f680e7fbd3a8d5f2b5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache/
+/out/
+/broadcast/
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..08a67c9050c728f2b77bcf5e0814fff918f194c3
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Health computation
+
+Each position tracks:
+
+- WETH collateral, in `18` decimals.
+- USDC debt, in `6` decimals.
+
+The market reads an ETH/USD price from an `AggregatorV3Interface` oracle with `8`
+decimals, which matches the standard mainnet Chainlink ETH/USD feed.
+
+Collateral value in USDC base units is computed as:
+
+`collateralValue = collateralWeth * ethUsdPrice / 1e20`
+
+That scale conversion comes from:
+
+- `1e18` for WETH decimals
+- `1e8` for the oracle
+- `1e6` for USDC
+
+Borrow health has two thresholds:
+
+- Borrow cap: debt must stay at or below `70%` of collateral value to borrow.
+- Liquidation threshold: the position becomes liquidatable once debt is above `85%` of collateral value.
+
+Interest accrues linearly over time through a global borrow index:
+
+- `borrowIndex(t) = borrowIndex(t-1) * (1 + annualRate * dt / 365 days)`
+- A user’s live debt is `debtPrincipal * borrowIndex / 1e27`
+
+Withdrawals are allowed only if the remaining position stays at or below the
+`85%` liquidation threshold after the collateral is removed.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Check that the target position is above the `85%` liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, maxRepayAmount)`.
+
+The market repays up to the requested amount, capped so the liquidator never
+tries to seize more WETH than the position holds. The seized collateral is:
+
+`seizedWeth = debtValueInWeth * 1.05`
+
+So the liquidator receives the WETH equivalent of the repaid USDC plus a `5%`
+bonus.
+
+The implementation supports partial liquidations. A liquidator does not need to
+clear the full debt.
+
+## Mainnet deployment and operations
+
+An operator needs to get the following right:
+
+1. Use the canonical token and oracle addresses for Ethereum mainnet:
+   - WETH with `18` decimals
+   - USDC with `6` decimals
+   - Chainlink ETH/USD oracle with `8` decimals
+2. Choose a flat annual interest rate in basis points when deploying the
+   contract constructor.
+3. Fund the contract with enough USDC using `addLiquidity` before borrowers try
+   to draw loans.
+4. Keep enough idle USDC in the contract if the intent is to support new
+   borrowing at all times. Existing positions can still repay without that
+   liquidity, but new borrows will fail if the contract balance is short.
+5. Monitor oracle freshness. The contract rejects prices older than `2 hours`,
+   so a stale oracle pauses borrow, withdraw, repay, and liquidation flows that
+   call `accrueInterest` and need valuation.
+6. Treat `removeLiquidity` as a privileged action with operational discipline.
+   The contract allows the owner to pull idle USDC, so deployment should put
+   ownership behind an appropriate mainnet control plane such as a multisig.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f29c4c1646aebdc5b36940df4a07d68c8be77395
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/EthUsdCMBorrowingMarket.sol b/src/EthUsdCMBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7991089f5317dd299e5b1c44367f9f9dc8d56f36
--- /dev/null
+++ b/src/EthUsdCMBorrowingMarket.sol
@@ -0,0 +1,313 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract EthUsdCMBorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant MAX_PRICE_AGE = 2 hours;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestRateRay;
+
+    uint256 public totalDebtPrincipal;
+    uint256 public borrowIndex = RAY;
+    uint256 public lastAccrualTime;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error NotOwner();
+    error AmountIsZero();
+    error TransferFailed();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error PositionNotLiquidatable();
+    error PositionWouldBeUnsafe();
+    error InvalidOracleAnswer();
+    error StaleOraclePrice();
+    error InvalidOracleDecimals();
+
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed provider, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event Accrued(uint256 newBorrowIndex, uint256 timestamp);
+
+    constructor(
+        address owner_,
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateBps
+    ) {
+        if (owner_ == address(0) || weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) {
+            revert InvalidOracleAnswer();
+        }
+
+        owner = owner_;
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        ethUsdOracle = IAggregatorV3(ethUsdOracle_);
+        annualInterestRateRay = (annualInterestRateBps * RAY) / BPS;
+        lastAccrualTime = block.timestamp;
+
+        if (ethUsdOracle.decimals() != 8) revert InvalidOracleDecimals();
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert InvalidOracleDecimals();
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    function accrueInterest() public {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 interestFactor = (annualInterestRateRay * elapsed) / YEAR;
+        borrowIndex += (borrowIndex * interestFactor) / RAY;
+        lastAccrualTime = block.timestamp;
+
+        emit Accrued(borrowIndex, block.timestamp);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityRemoved(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isWithinLiquidationThreshold(position.collateralAmount, _debtFromPrincipal(position.debtPrincipal))) {
+            revert PositionWouldBeUnsafe();
+        }
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        Position storage position = positions[msg.sender];
+        uint256 currentDebt = _debtFromPrincipal(position.debtPrincipal);
+        uint256 nextDebt = currentDebt + amount;
+
+        if (nextDebt > maxBorrowable(position.collateralAmount)) revert PositionWouldBeUnsafe();
+
+        uint256 principalToMint = _debtToPrincipalUp(amount);
+        position.debtPrincipal += principalToMint;
+        totalDebtPrincipal += principalToMint;
+
+        _safeTransfer(usdc, msg.sender, amount);
+        emit Borrowed(msg.sender, amount, nextDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address account, uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, account, amount);
+    }
+
+    function liquidate(address account, uint256 maxRepayAmount) external returns (uint256 repaidAmount, uint256 collateralSeized) {
+        if (maxRepayAmount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (!_isLiquidatable(position.collateralAmount, debt)) revert PositionNotLiquidatable();
+
+        uint256 repayCap = maxLiquidationRepay(account);
+        repaidAmount = maxRepayAmount > repayCap ? repayCap : maxRepayAmount;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        uint256 principalToBurn;
+        if (repaidAmount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (repaidAmount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        collateralSeized = collateralForDebt(repaidAmount);
+        collateralSeized = (collateralSeized * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaidAmount);
+        _safeTransfer(weth, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, repaidAmount, collateralSeized, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function debtOf(address account) external view returns (uint256) {
+        return _debtFromPrincipalAtIndex(positions[account].debtPrincipal, _previewBorrowIndex());
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return collateralValue(positionCollateral(account));
+    }
+
+    function positionCollateral(address account) public view returns (uint256) {
+        return positions[account].collateralAmount;
+    }
+
+    function maxBorrowable(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * BORROW_LTV_BPS) / BPS;
+    }
+
+    function liquidationThreshold(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function maxLiquidationRepay(address account) public view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        if (!_isLiquidatable(position.collateralAmount, debt)) return 0;
+
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        return (collateralValueUsdc * BPS) / (BPS + LIQUIDATION_BONUS_BPS);
+    }
+
+    function collateralValue(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function collateralForDebt(uint256 usdcAmount) public view returns (uint256) {
+        return (usdcAmount * 1e20) / _readEthUsdPrice();
+    }
+
+    function healthRatioBps(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        if (collateralValueUsdc == 0) {
+            return debt == 0 ? 0 : type(uint256).max;
+        }
+        return (debt * BPS) / collateralValueUsdc;
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal returns (uint256 repaidAmount) {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (debt == 0) revert AmountIsZero();
+
+        uint256 principalToBurn;
+        if (amount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (amount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+
+        _safeTransferFrom(usdc, payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 interestFactor = (annualInterestRateRay * elapsed) / YEAR;
+        return borrowIndex + ((borrowIndex * interestFactor) / RAY);
+    }
+
+    function _debtFromPrincipal(uint256 principal) internal view returns (uint256) {
+        return _debtFromPrincipalAtIndex(principal, borrowIndex);
+    }
+
+    function _debtFromPrincipalAtIndex(uint256 principal, uint256 index) internal pure returns (uint256) {
+        return (principal * index) / RAY;
+    }
+
+    function _debtToPrincipalUp(uint256 debtAmount) internal view returns (uint256) {
+        return ((debtAmount * RAY) + borrowIndex - 1) / borrowIndex;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt > liquidationThreshold(collateralAmount);
+    }
+
+    function _isWithinLiquidationThreshold(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt <= liquidationThreshold(collateralAmount);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256 price) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StaleOraclePrice();
+        price = uint256(answer);
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
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f51edcad8b7444021337a1c974a13f02a07e8ec
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c815ac57a39f110f7458574c989829ddee8ac221
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..69fc0e069f74c3f67cf2e3f680e7fbd3a8d5f2b5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache/
+/out/
+/broadcast/
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..08a67c9050c728f2b77bcf5e0814fff918f194c3
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Health computation
+
+Each position tracks:
+
+- WETH collateral, in `18` decimals.
+- USDC debt, in `6` decimals.
+
+The market reads an ETH/USD price from an `AggregatorV3Interface` oracle with `8`
+decimals, which matches the standard mainnet Chainlink ETH/USD feed.
+
+Collateral value in USDC base units is computed as:
+
+`collateralValue = collateralWeth * ethUsdPrice / 1e20`
+
+That scale conversion comes from:
+
+- `1e18` for WETH decimals
+- `1e8` for the oracle
+- `1e6` for USDC
+
+Borrow health has two thresholds:
+
+- Borrow cap: debt must stay at or below `70%` of collateral value to borrow.
+- Liquidation threshold: the position becomes liquidatable once debt is above `85%` of collateral value.
+
+Interest accrues linearly over time through a global borrow index:
+
+- `borrowIndex(t) = borrowIndex(t-1) * (1 + annualRate * dt / 365 days)`
+- A user’s live debt is `debtPrincipal * borrowIndex / 1e27`
+
+Withdrawals are allowed only if the remaining position stays at or below the
+`85%` liquidation threshold after the collateral is removed.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Check that the target position is above the `85%` liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, maxRepayAmount)`.
+
+The market repays up to the requested amount, capped so the liquidator never
+tries to seize more WETH than the position holds. The seized collateral is:
+
+`seizedWeth = debtValueInWeth * 1.05`
+
+So the liquidator receives the WETH equivalent of the repaid USDC plus a `5%`
+bonus.
+
+The implementation supports partial liquidations. A liquidator does not need to
+clear the full debt.
+
+## Mainnet deployment and operations
+
+An operator needs to get the following right:
+
+1. Use the canonical token and oracle addresses for Ethereum mainnet:
+   - WETH with `18` decimals
+   - USDC with `6` decimals
+   - Chainlink ETH/USD oracle with `8` decimals
+2. Choose a flat annual interest rate in basis points when deploying the
+   contract constructor.
+3. Fund the contract with enough USDC using `addLiquidity` before borrowers try
+   to draw loans.
+4. Keep enough idle USDC in the contract if the intent is to support new
+   borrowing at all times. Existing positions can still repay without that
+   liquidity, but new borrows will fail if the contract balance is short.
+5. Monitor oracle freshness. The contract rejects prices older than `2 hours`,
+   so a stale oracle pauses borrow, withdraw, repay, and liquidation flows that
+   call `accrueInterest` and need valuation.
+6. Treat `removeLiquidity` as a privileged action with operational discipline.
+   The contract allows the owner to pull idle USDC, so deployment should put
+   ownership behind an appropriate mainnet control plane such as a multisig.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f29c4c1646aebdc5b36940df4a07d68c8be77395
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/EthUsdCMBorrowingMarket.sol b/src/EthUsdCMBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7991089f5317dd299e5b1c44367f9f9dc8d56f36
--- /dev/null
+++ b/src/EthUsdCMBorrowingMarket.sol
@@ -0,0 +1,313 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract EthUsdCMBorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant MAX_PRICE_AGE = 2 hours;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestRateRay;
+
+    uint256 public totalDebtPrincipal;
+    uint256 public borrowIndex = RAY;
+    uint256 public lastAccrualTime;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error NotOwner();
+    error AmountIsZero();
+    error TransferFailed();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error PositionNotLiquidatable();
+    error PositionWouldBeUnsafe();
+    error InvalidOracleAnswer();
+    error StaleOraclePrice();
+    error InvalidOracleDecimals();
+
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed provider, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event Accrued(uint256 newBorrowIndex, uint256 timestamp);
+
+    constructor(
+        address owner_,
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateBps
+    ) {
+        if (owner_ == address(0) || weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) {
+            revert InvalidOracleAnswer();
+        }
+
+        owner = owner_;
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        ethUsdOracle = IAggregatorV3(ethUsdOracle_);
+        annualInterestRateRay = (annualInterestRateBps * RAY) / BPS;
+        lastAccrualTime = block.timestamp;
+
+        if (ethUsdOracle.decimals() != 8) revert InvalidOracleDecimals();
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert InvalidOracleDecimals();
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    function accrueInterest() public {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 interestFactor = (annualInterestRateRay * elapsed) / YEAR;
+        borrowIndex += (borrowIndex * interestFactor) / RAY;
+        lastAccrualTime = block.timestamp;
+
+        emit Accrued(borrowIndex, block.timestamp);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityRemoved(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isWithinLiquidationThreshold(position.collateralAmount, _debtFromPrincipal(position.debtPrincipal))) {
+            revert PositionWouldBeUnsafe();
+        }
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        Position storage position = positions[msg.sender];
+        uint256 currentDebt = _debtFromPrincipal(position.debtPrincipal);
+        uint256 nextDebt = currentDebt + amount;
+
+        if (nextDebt > maxBorrowable(position.collateralAmount)) revert PositionWouldBeUnsafe();
+
+        uint256 principalToMint = _debtToPrincipalUp(amount);
+        position.debtPrincipal += principalToMint;
+        totalDebtPrincipal += principalToMint;
+
+        _safeTransfer(usdc, msg.sender, amount);
+        emit Borrowed(msg.sender, amount, nextDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address account, uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, account, amount);
+    }
+
+    function liquidate(address account, uint256 maxRepayAmount) external returns (uint256 repaidAmount, uint256 collateralSeized) {
+        if (maxRepayAmount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (!_isLiquidatable(position.collateralAmount, debt)) revert PositionNotLiquidatable();
+
+        uint256 repayCap = maxLiquidationRepay(account);
+        repaidAmount = maxRepayAmount > repayCap ? repayCap : maxRepayAmount;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        uint256 principalToBurn;
+        if (repaidAmount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (repaidAmount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        collateralSeized = collateralForDebt(repaidAmount);
+        collateralSeized = (collateralSeized * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaidAmount);
+        _safeTransfer(weth, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, repaidAmount, collateralSeized, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function debtOf(address account) external view returns (uint256) {
+        return _debtFromPrincipalAtIndex(positions[account].debtPrincipal, _previewBorrowIndex());
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return collateralValue(positionCollateral(account));
+    }
+
+    function positionCollateral(address account) public view returns (uint256) {
+        return positions[account].collateralAmount;
+    }
+
+    function maxBorrowable(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * BORROW_LTV_BPS) / BPS;
+    }
+
+    function liquidationThreshold(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function maxLiquidationRepay(address account) public view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        if (!_isLiquidatable(position.collateralAmount, debt)) return 0;
+
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        return (collateralValueUsdc * BPS) / (BPS + LIQUIDATION_BONUS_BPS);
+    }
+
+    function collateralValue(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function collateralForDebt(uint256 usdcAmount) public view returns (uint256) {
+        return (usdcAmount * 1e20) / _readEthUsdPrice();
+    }
+
+    function healthRatioBps(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        if (collateralValueUsdc == 0) {
+            return debt == 0 ? 0 : type(uint256).max;
+        }
+        return (debt * BPS) / collateralValueUsdc;
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal returns (uint256 repaidAmount) {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (debt == 0) revert AmountIsZero();
+
+        uint256 principalToBurn;
+        if (amount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (amount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+
+        _safeTransferFrom(usdc, payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 interestFactor = (annualInterestRateRay * elapsed) / YEAR;
+        return borrowIndex + ((borrowIndex * interestFactor) / RAY);
+    }
+
+    function _debtFromPrincipal(uint256 principal) internal view returns (uint256) {
+        return _debtFromPrincipalAtIndex(principal, borrowIndex);
+    }
+
+    function _debtFromPrincipalAtIndex(uint256 principal, uint256 index) internal pure returns (uint256) {
+        return (principal * index) / RAY;
+    }
+
+    function _debtToPrincipalUp(uint256 debtAmount) internal view returns (uint256) {
+        return ((debtAmount * RAY) + borrowIndex - 1) / borrowIndex;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt > liquidationThreshold(collateralAmount);
+    }
+
+    function _isWithinLiquidationThreshold(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt <= liquidationThreshold(collateralAmount);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256 price) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StaleOraclePrice();
+        price = uint256(answer);
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
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f51edcad8b7444021337a1c974a13f02a07e8ec
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c815ac57a39f110f7458574c989829ddee8ac221
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+

codex
The initial contract set is in place. I’m compiling now and will tighten anything the compiler complains about before I consider the market shape finished.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002
 succeeded in 146ms:
Compiling 3 files with Solc 0.8.20
Solc 0.8.20 finished in 105.85ms
Compiler run successful!
2026-09-04T04:21:59.336052Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/EthUsdCMBorrowingMarket.sol:16:29
   |
16 |     IERC20 public immutable weth;
   |                             ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/EthUsdCMBorrowingMarket.sol:17:29
   |
17 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/EthUsdCMBorrowingMarket.sol:18:36
   |
18 |     IAggregatorV3 public immutable ethUsdOracle;
   |                                    ^^^^^^^^^^^^ help: consider using: `ETH_USD_ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/EthUsdCMBorrowingMarket.sol:19:30
   |
19 |     address public immutable owner;
   |                              ^^^^^ help: consider using: `OWNER`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/EthUsdCMBorrowingMarket.sol:20:30
   |
20 |     uint256 public immutable annualInterestRateRay;
   |                              ^^^^^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_RATE_RAY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/EthUsdCMBorrowingMarket.sol:81:5
   |
81 | /     modifier onlyOwner() {
82 | |         if (msg.sender != owner) revert NotOwner();
83 | |         _;
84 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
81 ~     modifier onlyOwner() {
82 +         _onlyOwner();
83 +         _;
84 +     }
85 + 
86 +     function _onlyOwner() internal {
87 +         if (msg.sender != owner) revert NotOwner();
88 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/EthUsdCMBorrowingMarket.sol:300:17
    |
300 |         price = uint256(answer);
    |                 ^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint256' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast


diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..69fc0e069f74c3f67cf2e3f680e7fbd3a8d5f2b5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache/
+/out/
+/broadcast/
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..08a67c9050c728f2b77bcf5e0814fff918f194c3
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Health computation
+
+Each position tracks:
+
+- WETH collateral, in `18` decimals.
+- USDC debt, in `6` decimals.
+
+The market reads an ETH/USD price from an `AggregatorV3Interface` oracle with `8`
+decimals, which matches the standard mainnet Chainlink ETH/USD feed.
+
+Collateral value in USDC base units is computed as:
+
+`collateralValue = collateralWeth * ethUsdPrice / 1e20`
+
+That scale conversion comes from:
+
+- `1e18` for WETH decimals
+- `1e8` for the oracle
+- `1e6` for USDC
+
+Borrow health has two thresholds:
+
+- Borrow cap: debt must stay at or below `70%` of collateral value to borrow.
+- Liquidation threshold: the position becomes liquidatable once debt is above `85%` of collateral value.
+
+Interest accrues linearly over time through a global borrow index:
+
+- `borrowIndex(t) = borrowIndex(t-1) * (1 + annualRate * dt / 365 days)`
+- A user’s live debt is `debtPrincipal * borrowIndex / 1e27`
+
+Withdrawals are allowed only if the remaining position stays at or below the
+`85%` liquidation threshold after the collateral is removed.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Check that the target position is above the `85%` liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, maxRepayAmount)`.
+
+The market repays up to the requested amount, capped so the liquidator never
+tries to seize more WETH than the position holds. The seized collateral is:
+
+`seizedWeth = debtValueInWeth * 1.05`
+
+So the liquidator receives the WETH equivalent of the repaid USDC plus a `5%`
+bonus.
+
+The implementation supports partial liquidations. A liquidator does not need to
+clear the full debt.
+
+## Mainnet deployment and operations
+
+An operator needs to get the following right:
+
+1. Use the canonical token and oracle addresses for Ethereum mainnet:
+   - WETH with `18` decimals
+   - USDC with `6` decimals
+   - Chainlink ETH/USD oracle with `8` decimals
+2. Choose a flat annual interest rate in basis points when deploying the
+   contract constructor.
+3. Fund the contract with enough USDC using `addLiquidity` before borrowers try
+   to draw loans.
+4. Keep enough idle USDC in the contract if the intent is to support new
+   borrowing at all times. Existing positions can still repay without that
+   liquidity, but new borrows will fail if the contract balance is short.
+5. Monitor oracle freshness. The contract rejects prices older than `2 hours`,
+   so a stale oracle pauses borrow, withdraw, repay, and liquidation flows that
+   call `accrueInterest` and need valuation.
+6. Treat `removeLiquidity` as a privileged action with operational discipline.
+   The contract allows the owner to pull idle USDC, so deployment should put
+   ownership behind an appropriate mainnet control plane such as a multisig.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f29c4c1646aebdc5b36940df4a07d68c8be77395
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/EthUsdCMBorrowingMarket.sol b/src/EthUsdCMBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7991089f5317dd299e5b1c44367f9f9dc8d56f36
--- /dev/null
+++ b/src/EthUsdCMBorrowingMarket.sol
@@ -0,0 +1,313 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract EthUsdCMBorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant MAX_PRICE_AGE = 2 hours;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    address public immutable owner;
+    uint256 public immutable annualInterestRateRay;
+
+    uint256 public totalDebtPrincipal;
+    uint256 public borrowIndex = RAY;
+    uint256 public lastAccrualTime;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error NotOwner();
+    error AmountIsZero();
+    error TransferFailed();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error PositionNotLiquidatable();
+    error PositionWouldBeUnsafe();
+    error InvalidOracleAnswer();
+    error StaleOraclePrice();
+    error InvalidOracleDecimals();
+
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed provider, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event Accrued(uint256 newBorrowIndex, uint256 timestamp);
+
+    constructor(
+        address owner_,
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateBps
+    ) {
+        if (owner_ == address(0) || weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) {
+            revert InvalidOracleAnswer();
+        }
+
+        owner = owner_;
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        ethUsdOracle = IAggregatorV3(ethUsdOracle_);
+        annualInterestRateRay = (annualInterestRateBps * RAY) / BPS;
+        lastAccrualTime = block.timestamp;
+
+        if (ethUsdOracle.decimals() != 8) revert InvalidOracleDecimals();
+        if (weth.decimals() != 18 || usdc.decimals() != 6) revert InvalidOracleDecimals();
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert NotOwner();
+        _;
+    }
+
+    function accrueInterest() public {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 interestFactor = (annualInterestRateRay * elapsed) / YEAR;
+        borrowIndex += (borrowIndex * interestFactor) / RAY;
+        lastAccrualTime = block.timestamp;
+
+        emit Accrued(borrowIndex, block.timestamp);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransferFrom(usdc, msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransfer(usdc, to, amount);
+        emit LiquidityRemoved(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        _safeTransferFrom(weth, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isWithinLiquidationThreshold(position.collateralAmount, _debtFromPrincipal(position.debtPrincipal))) {
+            revert PositionWouldBeUnsafe();
+        }
+
+        _safeTransfer(weth, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        Position storage position = positions[msg.sender];
+        uint256 currentDebt = _debtFromPrincipal(position.debtPrincipal);
+        uint256 nextDebt = currentDebt + amount;
+
+        if (nextDebt > maxBorrowable(position.collateralAmount)) revert PositionWouldBeUnsafe();
+
+        uint256 principalToMint = _debtToPrincipalUp(amount);
+        position.debtPrincipal += principalToMint;
+        totalDebtPrincipal += principalToMint;
+
+        _safeTransfer(usdc, msg.sender, amount);
+        emit Borrowed(msg.sender, amount, nextDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address account, uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, account, amount);
+    }
+
+    function liquidate(address account, uint256 maxRepayAmount) external returns (uint256 repaidAmount, uint256 collateralSeized) {
+        if (maxRepayAmount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (!_isLiquidatable(position.collateralAmount, debt)) revert PositionNotLiquidatable();
+
+        uint256 repayCap = maxLiquidationRepay(account);
+        repaidAmount = maxRepayAmount > repayCap ? repayCap : maxRepayAmount;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        uint256 principalToBurn;
+        if (repaidAmount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (repaidAmount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        collateralSeized = collateralForDebt(repaidAmount);
+        collateralSeized = (collateralSeized * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(usdc, msg.sender, address(this), repaidAmount);
+        _safeTransfer(weth, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, repaidAmount, collateralSeized, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function debtOf(address account) external view returns (uint256) {
+        return _debtFromPrincipalAtIndex(positions[account].debtPrincipal, _previewBorrowIndex());
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return collateralValue(positionCollateral(account));
+    }
+
+    function positionCollateral(address account) public view returns (uint256) {
+        return positions[account].collateralAmount;
+    }
+
+    function maxBorrowable(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * BORROW_LTV_BPS) / BPS;
+    }
+
+    function liquidationThreshold(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function maxLiquidationRepay(address account) public view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        if (!_isLiquidatable(position.collateralAmount, debt)) return 0;
+
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        return (collateralValueUsdc * BPS) / (BPS + LIQUIDATION_BONUS_BPS);
+    }
+
+    function collateralValue(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function collateralForDebt(uint256 usdcAmount) public view returns (uint256) {
+        return (usdcAmount * 1e20) / _readEthUsdPrice();
+    }
+
+    function healthRatioBps(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        if (collateralValueUsdc == 0) {
+            return debt == 0 ? 0 : type(uint256).max;
+        }
+        return (debt * BPS) / collateralValueUsdc;
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal returns (uint256 repaidAmount) {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (debt == 0) revert AmountIsZero();
+
+        uint256 principalToBurn;
+        if (amount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (amount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+
+        _safeTransferFrom(usdc, payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 interestFactor = (annualInterestRateRay * elapsed) / YEAR;
+        return borrowIndex + ((borrowIndex * interestFactor) / RAY);
+    }
+
+    function _debtFromPrincipal(uint256 principal) internal view returns (uint256) {
+        return _debtFromPrincipalAtIndex(principal, borrowIndex);
+    }
+
+    function _debtFromPrincipalAtIndex(uint256 principal, uint256 index) internal pure returns (uint256) {
+        return (principal * index) / RAY;
+    }
+
+    function _debtToPrincipalUp(uint256 debtAmount) internal view returns (uint256) {
+        return ((debtAmount * RAY) + borrowIndex - 1) / borrowIndex;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt > liquidationThreshold(collateralAmount);
+    }
+
+    function _isWithinLiquidationThreshold(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt <= liquidationThreshold(collateralAmount);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256 price) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StaleOraclePrice();
+        price = uint256(answer);
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
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f51edcad8b7444021337a1c974a13f02a07e8ec
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c815ac57a39f110f7458574c989829ddee8ac221
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+

codex
`forge build` already passes. I’m making two small quality fixes now: clean up the contract’s deployment/input errors and correct the operational note around which flows actually depend on the oracle.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/src/EthUsdCMBorrowingMarket.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..69fc0e069f74c3f67cf2e3f680e7fbd3a8d5f2b5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache/
+/out/
+/broadcast/
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..60eb31a39fb83a497c121971dd981ec550682ec2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Health computation
+
+Each position tracks:
+
+- WETH collateral, in `18` decimals.
+- USDC debt, in `6` decimals.
+
+The market reads an ETH/USD price from an `AggregatorV3Interface` oracle with `8`
+decimals, which matches the standard mainnet Chainlink ETH/USD feed.
+
+Collateral value in USDC base units is computed as:
+
+`collateralValue = collateralWeth * ethUsdPrice / 1e20`
+
+That scale conversion comes from:
+
+- `1e18` for WETH decimals
+- `1e8` for the oracle
+- `1e6` for USDC
+
+Borrow health has two thresholds:
+
+- Borrow cap: debt must stay at or below `70%` of collateral value to borrow.
+- Liquidation threshold: the position becomes liquidatable once debt is above `85%` of collateral value.
+
+Interest accrues linearly over time through a global borrow index:
+
+- `borrowIndex(t) = borrowIndex(t-1) * (1 + annualRate * dt / 365 days)`
+- A user’s live debt is `debtPrincipal * borrowIndex / 1e27`
+
+Withdrawals are allowed only if the remaining position stays at or below the
+`85%` liquidation threshold after the collateral is removed.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Check that the target position is above the `85%` liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, maxRepayAmount)`.
+
+The market repays up to the requested amount, capped so the liquidator never
+tries to seize more WETH than the position holds. The seized collateral is:
+
+`seizedWeth = debtValueInWeth * 1.05`
+
+So the liquidator receives the WETH equivalent of the repaid USDC plus a `5%`
+bonus.
+
+The implementation supports partial liquidations. A liquidator does not need to
+clear the full debt.
+
+## Mainnet deployment and operations
+
+An operator needs to get the following right:
+
+1. Use the canonical token and oracle addresses for Ethereum mainnet:
+   - WETH with `18` decimals
+   - USDC with `6` decimals
+   - Chainlink ETH/USD oracle with `8` decimals
+2. Choose a flat annual interest rate in basis points when deploying the
+   contract constructor.
+3. Fund the contract with enough USDC using `addLiquidity` before borrowers try
+   to draw loans.
+4. Keep enough idle USDC in the contract if the intent is to support new
+   borrowing at all times. Existing positions can still repay without that
+   liquidity, but new borrows will fail if the contract balance is short.
+5. Monitor oracle freshness. The contract rejects prices older than `2 hours`,
+   so a stale oracle pauses borrow, withdraw, and liquidation. Plain repayment
+   does not depend on the oracle.
+6. Treat `removeLiquidity` as a privileged action with operational discipline.
+   The contract allows the owner to pull idle USDC, so deployment should put
+   ownership behind an appropriate mainnet control plane such as a multisig.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f29c4c1646aebdc5b36940df4a07d68c8be77395
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/EthUsdCMBorrowingMarket.sol b/src/EthUsdCMBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24bcb44328f9186715e8291a88d2c03d99d9e51f
--- /dev/null
+++ b/src/EthUsdCMBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract EthUsdCMBorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant MAX_PRICE_AGE = 2 hours;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IAggregatorV3 public immutable ETH_USD_ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_RATE_RAY;
+
+    uint256 public totalDebtPrincipal;
+    uint256 public borrowIndex = RAY;
+    uint256 public lastAccrualTime;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error NotOwner();
+    error AmountIsZero();
+    error TransferFailed();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error PositionNotLiquidatable();
+    error PositionWouldBeUnsafe();
+    error InvalidOracleAnswer();
+    error StaleOraclePrice();
+    error InvalidOracleDecimals();
+    error ZeroAddress();
+
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed provider, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event Accrued(uint256 newBorrowIndex, uint256 timestamp);
+
+    constructor(
+        address owner_,
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateBps
+    ) {
+        if (owner_ == address(0) || weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) {
+            revert ZeroAddress();
+        }
+
+        OWNER = owner_;
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ETH_USD_ORACLE = IAggregatorV3(ethUsdOracle_);
+        ANNUAL_INTEREST_RATE_RAY = (annualInterestRateBps * RAY) / BPS;
+        lastAccrualTime = block.timestamp;
+
+        if (ETH_USD_ORACLE.decimals() != 8) revert InvalidOracleDecimals();
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert InvalidOracleDecimals();
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function accrueInterest() public {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
+        borrowIndex += (borrowIndex * interestFactor) / RAY;
+        lastAccrualTime = block.timestamp;
+
+        emit Accrued(borrowIndex, block.timestamp);
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+        function removeLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityRemoved(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isWithinLiquidationThreshold(position.collateralAmount, _debtFromPrincipal(position.debtPrincipal))) {
+            revert PositionWouldBeUnsafe();
+        }
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        Position storage position = positions[msg.sender];
+        uint256 currentDebt = _debtFromPrincipal(position.debtPrincipal);
+        uint256 nextDebt = currentDebt + amount;
+
+        if (nextDebt > maxBorrowable(position.collateralAmount)) revert PositionWouldBeUnsafe();
+
+        uint256 principalToMint = _debtToPrincipalUp(amount);
+        position.debtPrincipal += principalToMint;
+        totalDebtPrincipal += principalToMint;
+
+        _safeTransfer(USDC, msg.sender, amount);
+        emit Borrowed(msg.sender, amount, nextDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address account, uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, account, amount);
+    }
+
+    function liquidate(address account, uint256 maxRepayAmount) external returns (uint256 repaidAmount, uint256 collateralSeized) {
+        if (maxRepayAmount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (!_isLiquidatable(position.collateralAmount, debt)) revert PositionNotLiquidatable();
+
+        uint256 repayCap = maxLiquidationRepay(account);
+        repaidAmount = maxRepayAmount > repayCap ? repayCap : maxRepayAmount;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        uint256 principalToBurn;
+        if (repaidAmount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (repaidAmount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        collateralSeized = collateralForDebt(repaidAmount);
+        collateralSeized = (collateralSeized * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaidAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, repaidAmount, collateralSeized, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function debtOf(address account) external view returns (uint256) {
+        return _debtFromPrincipalAtIndex(positions[account].debtPrincipal, _previewBorrowIndex());
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return collateralValue(positionCollateral(account));
+    }
+
+    function positionCollateral(address account) public view returns (uint256) {
+        return positions[account].collateralAmount;
+    }
+
+    function maxBorrowable(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * BORROW_LTV_BPS) / BPS;
+    }
+
+    function liquidationThreshold(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function maxLiquidationRepay(address account) public view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        if (!_isLiquidatable(position.collateralAmount, debt)) return 0;
+
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        return (collateralValueUsdc * BPS) / (BPS + LIQUIDATION_BONUS_BPS);
+    }
+
+    function collateralValue(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function collateralForDebt(uint256 usdcAmount) public view returns (uint256) {
+        return (usdcAmount * 1e20) / _readEthUsdPrice();
+    }
+
+    function healthRatioBps(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        if (collateralValueUsdc == 0) {
+            return debt == 0 ? 0 : type(uint256).max;
+        }
+        return (debt * BPS) / collateralValueUsdc;
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal returns (uint256 repaidAmount) {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (debt == 0) revert AmountIsZero();
+
+        uint256 principalToBurn;
+        if (amount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (amount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+
+        _safeTransferFrom(USDC, payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
+        return borrowIndex + ((borrowIndex * interestFactor) / RAY);
+    }
+
+    function _debtFromPrincipal(uint256 principal) internal view returns (uint256) {
+        return _debtFromPrincipalAtIndex(principal, borrowIndex);
+    }
+
+    function _debtFromPrincipalAtIndex(uint256 principal, uint256 index) internal pure returns (uint256) {
+        return (principal * index) / RAY;
+    }
+
+    function _debtToPrincipalUp(uint256 debtAmount) internal view returns (uint256) {
+        return ((debtAmount * RAY) + borrowIndex - 1) / borrowIndex;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt > liquidationThreshold(collateralAmount);
+    }
+
+    function _isWithinLiquidationThreshold(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt <= liquidationThreshold(collateralAmount);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256 price) {
+        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        price = uint256(answer);
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
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f51edcad8b7444021337a1c974a13f02a07e8ec
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c815ac57a39f110f7458574c989829ddee8ac221
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..69fc0e069f74c3f67cf2e3f680e7fbd3a8d5f2b5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache/
+/out/
+/broadcast/
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..60eb31a39fb83a497c121971dd981ec550682ec2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Health computation
+
+Each position tracks:
+
+- WETH collateral, in `18` decimals.
+- USDC debt, in `6` decimals.
+
+The market reads an ETH/USD price from an `AggregatorV3Interface` oracle with `8`
+decimals, which matches the standard mainnet Chainlink ETH/USD feed.
+
+Collateral value in USDC base units is computed as:
+
+`collateralValue = collateralWeth * ethUsdPrice / 1e20`
+
+That scale conversion comes from:
+
+- `1e18` for WETH decimals
+- `1e8` for the oracle
+- `1e6` for USDC
+
+Borrow health has two thresholds:
+
+- Borrow cap: debt must stay at or below `70%` of collateral value to borrow.
+- Liquidation threshold: the position becomes liquidatable once debt is above `85%` of collateral value.
+
+Interest accrues linearly over time through a global borrow index:
+
+- `borrowIndex(t) = borrowIndex(t-1) * (1 + annualRate * dt / 365 days)`
+- A user’s live debt is `debtPrincipal * borrowIndex / 1e27`
+
+Withdrawals are allowed only if the remaining position stays at or below the
+`85%` liquidation threshold after the collateral is removed.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Check that the target position is above the `85%` liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, maxRepayAmount)`.
+
+The market repays up to the requested amount, capped so the liquidator never
+tries to seize more WETH than the position holds. The seized collateral is:
+
+`seizedWeth = debtValueInWeth * 1.05`
+
+So the liquidator receives the WETH equivalent of the repaid USDC plus a `5%`
+bonus.
+
+The implementation supports partial liquidations. A liquidator does not need to
+clear the full debt.
+
+## Mainnet deployment and operations
+
+An operator needs to get the following right:
+
+1. Use the canonical token and oracle addresses for Ethereum mainnet:
+   - WETH with `18` decimals
+   - USDC with `6` decimals
+   - Chainlink ETH/USD oracle with `8` decimals
+2. Choose a flat annual interest rate in basis points when deploying the
+   contract constructor.
+3. Fund the contract with enough USDC using `addLiquidity` before borrowers try
+   to draw loans.
+4. Keep enough idle USDC in the contract if the intent is to support new
+   borrowing at all times. Existing positions can still repay without that
+   liquidity, but new borrows will fail if the contract balance is short.
+5. Monitor oracle freshness. The contract rejects prices older than `2 hours`,
+   so a stale oracle pauses borrow, withdraw, and liquidation. Plain repayment
+   does not depend on the oracle.
+6. Treat `removeLiquidity` as a privileged action with operational discipline.
+   The contract allows the owner to pull idle USDC, so deployment should put
+   ownership behind an appropriate mainnet control plane such as a multisig.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f29c4c1646aebdc5b36940df4a07d68c8be77395
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/EthUsdCMBorrowingMarket.sol b/src/EthUsdCMBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24bcb44328f9186715e8291a88d2c03d99d9e51f
--- /dev/null
+++ b/src/EthUsdCMBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract EthUsdCMBorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant MAX_PRICE_AGE = 2 hours;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IAggregatorV3 public immutable ETH_USD_ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_RATE_RAY;
+
+    uint256 public totalDebtPrincipal;
+    uint256 public borrowIndex = RAY;
+    uint256 public lastAccrualTime;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error NotOwner();
+    error AmountIsZero();
+    error TransferFailed();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error PositionNotLiquidatable();
+    error PositionWouldBeUnsafe();
+    error InvalidOracleAnswer();
+    error StaleOraclePrice();
+    error InvalidOracleDecimals();
+    error ZeroAddress();
+
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed provider, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event Accrued(uint256 newBorrowIndex, uint256 timestamp);
+
+    constructor(
+        address owner_,
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateBps
+    ) {
+        if (owner_ == address(0) || weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) {
+            revert ZeroAddress();
+        }
+
+        OWNER = owner_;
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ETH_USD_ORACLE = IAggregatorV3(ethUsdOracle_);
+        ANNUAL_INTEREST_RATE_RAY = (annualInterestRateBps * RAY) / BPS;
+        lastAccrualTime = block.timestamp;
+
+        if (ETH_USD_ORACLE.decimals() != 8) revert InvalidOracleDecimals();
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert InvalidOracleDecimals();
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function accrueInterest() public {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
+        borrowIndex += (borrowIndex * interestFactor) / RAY;
+        lastAccrualTime = block.timestamp;
+
+        emit Accrued(borrowIndex, block.timestamp);
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+        function removeLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityRemoved(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isWithinLiquidationThreshold(position.collateralAmount, _debtFromPrincipal(position.debtPrincipal))) {
+            revert PositionWouldBeUnsafe();
+        }
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        Position storage position = positions[msg.sender];
+        uint256 currentDebt = _debtFromPrincipal(position.debtPrincipal);
+        uint256 nextDebt = currentDebt + amount;
+
+        if (nextDebt > maxBorrowable(position.collateralAmount)) revert PositionWouldBeUnsafe();
+
+        uint256 principalToMint = _debtToPrincipalUp(amount);
+        position.debtPrincipal += principalToMint;
+        totalDebtPrincipal += principalToMint;
+
+        _safeTransfer(USDC, msg.sender, amount);
+        emit Borrowed(msg.sender, amount, nextDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address account, uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, account, amount);
+    }
+
+    function liquidate(address account, uint256 maxRepayAmount) external returns (uint256 repaidAmount, uint256 collateralSeized) {
+        if (maxRepayAmount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (!_isLiquidatable(position.collateralAmount, debt)) revert PositionNotLiquidatable();
+
+        uint256 repayCap = maxLiquidationRepay(account);
+        repaidAmount = maxRepayAmount > repayCap ? repayCap : maxRepayAmount;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        uint256 principalToBurn;
+        if (repaidAmount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (repaidAmount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        collateralSeized = collateralForDebt(repaidAmount);
+        collateralSeized = (collateralSeized * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaidAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, repaidAmount, collateralSeized, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function debtOf(address account) external view returns (uint256) {
+        return _debtFromPrincipalAtIndex(positions[account].debtPrincipal, _previewBorrowIndex());
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return collateralValue(positionCollateral(account));
+    }
+
+    function positionCollateral(address account) public view returns (uint256) {
+        return positions[account].collateralAmount;
+    }
+
+    function maxBorrowable(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * BORROW_LTV_BPS) / BPS;
+    }
+
+    function liquidationThreshold(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function maxLiquidationRepay(address account) public view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        if (!_isLiquidatable(position.collateralAmount, debt)) return 0;
+
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        return (collateralValueUsdc * BPS) / (BPS + LIQUIDATION_BONUS_BPS);
+    }
+
+    function collateralValue(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function collateralForDebt(uint256 usdcAmount) public view returns (uint256) {
+        return (usdcAmount * 1e20) / _readEthUsdPrice();
+    }
+
+    function healthRatioBps(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        if (collateralValueUsdc == 0) {
+            return debt == 0 ? 0 : type(uint256).max;
+        }
+        return (debt * BPS) / collateralValueUsdc;
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal returns (uint256 repaidAmount) {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (debt == 0) revert AmountIsZero();
+
+        uint256 principalToBurn;
+        if (amount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (amount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+
+        _safeTransferFrom(USDC, payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
+        return borrowIndex + ((borrowIndex * interestFactor) / RAY);
+    }
+
+    function _debtFromPrincipal(uint256 principal) internal view returns (uint256) {
+        return _debtFromPrincipalAtIndex(principal, borrowIndex);
+    }
+
+    function _debtFromPrincipalAtIndex(uint256 principal, uint256 index) internal pure returns (uint256) {
+        return (principal * index) / RAY;
+    }
+
+    function _debtToPrincipalUp(uint256 debtAmount) internal view returns (uint256) {
+        return ((debtAmount * RAY) + borrowIndex - 1) / borrowIndex;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt > liquidationThreshold(collateralAmount);
+    }
+
+    function _isWithinLiquidationThreshold(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt <= liquidationThreshold(collateralAmount);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256 price) {
+        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        price = uint256(answer);
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
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f51edcad8b7444021337a1c974a13f02a07e8ec
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c815ac57a39f110f7458574c989829ddee8ac221
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+

codex
I’ve corrected the operator note and cleaned the contract surface a bit. Running a final build now to verify the patched version still compiles cleanly.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002
 succeeded in 165ms:
Compiling 1 files with Solc 0.8.20
Solc 0.8.20 finished in 109.55ms
Compiler run successful!
2026-09-04T04:22:34.273355Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..69fc0e069f74c3f67cf2e3f680e7fbd3a8d5f2b5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache/
+/out/
+/broadcast/
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..60eb31a39fb83a497c121971dd981ec550682ec2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Health computation
+
+Each position tracks:
+
+- WETH collateral, in `18` decimals.
+- USDC debt, in `6` decimals.
+
+The market reads an ETH/USD price from an `AggregatorV3Interface` oracle with `8`
+decimals, which matches the standard mainnet Chainlink ETH/USD feed.
+
+Collateral value in USDC base units is computed as:
+
+`collateralValue = collateralWeth * ethUsdPrice / 1e20`
+
+That scale conversion comes from:
+
+- `1e18` for WETH decimals
+- `1e8` for the oracle
+- `1e6` for USDC
+
+Borrow health has two thresholds:
+
+- Borrow cap: debt must stay at or below `70%` of collateral value to borrow.
+- Liquidation threshold: the position becomes liquidatable once debt is above `85%` of collateral value.
+
+Interest accrues linearly over time through a global borrow index:
+
+- `borrowIndex(t) = borrowIndex(t-1) * (1 + annualRate * dt / 365 days)`
+- A user’s live debt is `debtPrincipal * borrowIndex / 1e27`
+
+Withdrawals are allowed only if the remaining position stays at or below the
+`85%` liquidation threshold after the collateral is removed.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Check that the target position is above the `85%` liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, maxRepayAmount)`.
+
+The market repays up to the requested amount, capped so the liquidator never
+tries to seize more WETH than the position holds. The seized collateral is:
+
+`seizedWeth = debtValueInWeth * 1.05`
+
+So the liquidator receives the WETH equivalent of the repaid USDC plus a `5%`
+bonus.
+
+The implementation supports partial liquidations. A liquidator does not need to
+clear the full debt.
+
+## Mainnet deployment and operations
+
+An operator needs to get the following right:
+
+1. Use the canonical token and oracle addresses for Ethereum mainnet:
+   - WETH with `18` decimals
+   - USDC with `6` decimals
+   - Chainlink ETH/USD oracle with `8` decimals
+2. Choose a flat annual interest rate in basis points when deploying the
+   contract constructor.
+3. Fund the contract with enough USDC using `addLiquidity` before borrowers try
+   to draw loans.
+4. Keep enough idle USDC in the contract if the intent is to support new
+   borrowing at all times. Existing positions can still repay without that
+   liquidity, but new borrows will fail if the contract balance is short.
+5. Monitor oracle freshness. The contract rejects prices older than `2 hours`,
+   so a stale oracle pauses borrow, withdraw, and liquidation. Plain repayment
+   does not depend on the oracle.
+6. Treat `removeLiquidity` as a privileged action with operational discipline.
+   The contract allows the owner to pull idle USDC, so deployment should put
+   ownership behind an appropriate mainnet control plane such as a multisig.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f29c4c1646aebdc5b36940df4a07d68c8be77395
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/EthUsdCMBorrowingMarket.sol b/src/EthUsdCMBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24bcb44328f9186715e8291a88d2c03d99d9e51f
--- /dev/null
+++ b/src/EthUsdCMBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract EthUsdCMBorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant MAX_PRICE_AGE = 2 hours;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IAggregatorV3 public immutable ETH_USD_ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_RATE_RAY;
+
+    uint256 public totalDebtPrincipal;
+    uint256 public borrowIndex = RAY;
+    uint256 public lastAccrualTime;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error NotOwner();
+    error AmountIsZero();
+    error TransferFailed();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error PositionNotLiquidatable();
+    error PositionWouldBeUnsafe();
+    error InvalidOracleAnswer();
+    error StaleOraclePrice();
+    error InvalidOracleDecimals();
+    error ZeroAddress();
+
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed provider, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event Accrued(uint256 newBorrowIndex, uint256 timestamp);
+
+    constructor(
+        address owner_,
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateBps
+    ) {
+        if (owner_ == address(0) || weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) {
+            revert ZeroAddress();
+        }
+
+        OWNER = owner_;
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ETH_USD_ORACLE = IAggregatorV3(ethUsdOracle_);
+        ANNUAL_INTEREST_RATE_RAY = (annualInterestRateBps * RAY) / BPS;
+        lastAccrualTime = block.timestamp;
+
+        if (ETH_USD_ORACLE.decimals() != 8) revert InvalidOracleDecimals();
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert InvalidOracleDecimals();
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function accrueInterest() public {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
+        borrowIndex += (borrowIndex * interestFactor) / RAY;
+        lastAccrualTime = block.timestamp;
+
+        emit Accrued(borrowIndex, block.timestamp);
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+        function removeLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityRemoved(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isWithinLiquidationThreshold(position.collateralAmount, _debtFromPrincipal(position.debtPrincipal))) {
+            revert PositionWouldBeUnsafe();
+        }
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        Position storage position = positions[msg.sender];
+        uint256 currentDebt = _debtFromPrincipal(position.debtPrincipal);
+        uint256 nextDebt = currentDebt + amount;
+
+        if (nextDebt > maxBorrowable(position.collateralAmount)) revert PositionWouldBeUnsafe();
+
+        uint256 principalToMint = _debtToPrincipalUp(amount);
+        position.debtPrincipal += principalToMint;
+        totalDebtPrincipal += principalToMint;
+
+        _safeTransfer(USDC, msg.sender, amount);
+        emit Borrowed(msg.sender, amount, nextDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address account, uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, account, amount);
+    }
+
+    function liquidate(address account, uint256 maxRepayAmount) external returns (uint256 repaidAmount, uint256 collateralSeized) {
+        if (maxRepayAmount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (!_isLiquidatable(position.collateralAmount, debt)) revert PositionNotLiquidatable();
+
+        uint256 repayCap = maxLiquidationRepay(account);
+        repaidAmount = maxRepayAmount > repayCap ? repayCap : maxRepayAmount;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        uint256 principalToBurn;
+        if (repaidAmount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (repaidAmount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        collateralSeized = collateralForDebt(repaidAmount);
+        collateralSeized = (collateralSeized * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaidAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, repaidAmount, collateralSeized, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function debtOf(address account) external view returns (uint256) {
+        return _debtFromPrincipalAtIndex(positions[account].debtPrincipal, _previewBorrowIndex());
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return collateralValue(positionCollateral(account));
+    }
+
+    function positionCollateral(address account) public view returns (uint256) {
+        return positions[account].collateralAmount;
+    }
+
+    function maxBorrowable(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * BORROW_LTV_BPS) / BPS;
+    }
+
+    function liquidationThreshold(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function maxLiquidationRepay(address account) public view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        if (!_isLiquidatable(position.collateralAmount, debt)) return 0;
+
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        return (collateralValueUsdc * BPS) / (BPS + LIQUIDATION_BONUS_BPS);
+    }
+
+    function collateralValue(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function collateralForDebt(uint256 usdcAmount) public view returns (uint256) {
+        return (usdcAmount * 1e20) / _readEthUsdPrice();
+    }
+
+    function healthRatioBps(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        if (collateralValueUsdc == 0) {
+            return debt == 0 ? 0 : type(uint256).max;
+        }
+        return (debt * BPS) / collateralValueUsdc;
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal returns (uint256 repaidAmount) {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (debt == 0) revert AmountIsZero();
+
+        uint256 principalToBurn;
+        if (amount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (amount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+
+        _safeTransferFrom(USDC, payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
+        return borrowIndex + ((borrowIndex * interestFactor) / RAY);
+    }
+
+    function _debtFromPrincipal(uint256 principal) internal view returns (uint256) {
+        return _debtFromPrincipalAtIndex(principal, borrowIndex);
+    }
+
+    function _debtFromPrincipalAtIndex(uint256 principal, uint256 index) internal pure returns (uint256) {
+        return (principal * index) / RAY;
+    }
+
+    function _debtToPrincipalUp(uint256 debtAmount) internal view returns (uint256) {
+        return ((debtAmount * RAY) + borrowIndex - 1) / borrowIndex;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt > liquidationThreshold(collateralAmount);
+    }
+
+    function _isWithinLiquidationThreshold(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt <= liquidationThreshold(collateralAmount);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256 price) {
+        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        price = uint256(answer);
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
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f51edcad8b7444021337a1c974a13f02a07e8ec
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c815ac57a39f110f7458574c989829ddee8ac221
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+

  ✓ Inspect tool availability and current workspace state for a Foundry setup
  ✓ Add Foundry project files and implement the borrowing market contracts
  ✓ Run forge build, fix issues, and write NOTES.md
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..69fc0e069f74c3f67cf2e3f680e7fbd3a8d5f2b5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache/
+/out/
+/broadcast/
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..60eb31a39fb83a497c121971dd981ec550682ec2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Health computation
+
+Each position tracks:
+
+- WETH collateral, in `18` decimals.
+- USDC debt, in `6` decimals.
+
+The market reads an ETH/USD price from an `AggregatorV3Interface` oracle with `8`
+decimals, which matches the standard mainnet Chainlink ETH/USD feed.
+
+Collateral value in USDC base units is computed as:
+
+`collateralValue = collateralWeth * ethUsdPrice / 1e20`
+
+That scale conversion comes from:
+
+- `1e18` for WETH decimals
+- `1e8` for the oracle
+- `1e6` for USDC
+
+Borrow health has two thresholds:
+
+- Borrow cap: debt must stay at or below `70%` of collateral value to borrow.
+- Liquidation threshold: the position becomes liquidatable once debt is above `85%` of collateral value.
+
+Interest accrues linearly over time through a global borrow index:
+
+- `borrowIndex(t) = borrowIndex(t-1) * (1 + annualRate * dt / 365 days)`
+- A user’s live debt is `debtPrincipal * borrowIndex / 1e27`
+
+Withdrawals are allowed only if the remaining position stays at or below the
+`85%` liquidation threshold after the collateral is removed.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Check that the target position is above the `85%` liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, maxRepayAmount)`.
+
+The market repays up to the requested amount, capped so the liquidator never
+tries to seize more WETH than the position holds. The seized collateral is:
+
+`seizedWeth = debtValueInWeth * 1.05`
+
+So the liquidator receives the WETH equivalent of the repaid USDC plus a `5%`
+bonus.
+
+The implementation supports partial liquidations. A liquidator does not need to
+clear the full debt.
+
+## Mainnet deployment and operations
+
+An operator needs to get the following right:
+
+1. Use the canonical token and oracle addresses for Ethereum mainnet:
+   - WETH with `18` decimals
+   - USDC with `6` decimals
+   - Chainlink ETH/USD oracle with `8` decimals
+2. Choose a flat annual interest rate in basis points when deploying the
+   contract constructor.
+3. Fund the contract with enough USDC using `addLiquidity` before borrowers try
+   to draw loans.
+4. Keep enough idle USDC in the contract if the intent is to support new
+   borrowing at all times. Existing positions can still repay without that
+   liquidity, but new borrows will fail if the contract balance is short.
+5. Monitor oracle freshness. The contract rejects prices older than `2 hours`,
+   so a stale oracle pauses borrow, withdraw, and liquidation. Plain repayment
+   does not depend on the oracle.
+6. Treat `removeLiquidity` as a privileged action with operational discipline.
+   The contract allows the owner to pull idle USDC, so deployment should put
+   ownership behind an appropriate mainnet control plane such as a multisig.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f29c4c1646aebdc5b36940df4a07d68c8be77395
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/EthUsdCMBorrowingMarket.sol b/src/EthUsdCMBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24bcb44328f9186715e8291a88d2c03d99d9e51f
--- /dev/null
+++ b/src/EthUsdCMBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract EthUsdCMBorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant MAX_PRICE_AGE = 2 hours;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IAggregatorV3 public immutable ETH_USD_ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_RATE_RAY;
+
+    uint256 public totalDebtPrincipal;
+    uint256 public borrowIndex = RAY;
+    uint256 public lastAccrualTime;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error NotOwner();
+    error AmountIsZero();
+    error TransferFailed();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error PositionNotLiquidatable();
+    error PositionWouldBeUnsafe();
+    error InvalidOracleAnswer();
+    error StaleOraclePrice();
+    error InvalidOracleDecimals();
+    error ZeroAddress();
+
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed provider, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event Accrued(uint256 newBorrowIndex, uint256 timestamp);
+
+    constructor(
+        address owner_,
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateBps
+    ) {
+        if (owner_ == address(0) || weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) {
+            revert ZeroAddress();
+        }
+
+        OWNER = owner_;
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ETH_USD_ORACLE = IAggregatorV3(ethUsdOracle_);
+        ANNUAL_INTEREST_RATE_RAY = (annualInterestRateBps * RAY) / BPS;
+        lastAccrualTime = block.timestamp;
+
+        if (ETH_USD_ORACLE.decimals() != 8) revert InvalidOracleDecimals();
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert InvalidOracleDecimals();
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function accrueInterest() public {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
+        borrowIndex += (borrowIndex * interestFactor) / RAY;
+        lastAccrualTime = block.timestamp;
+
+        emit Accrued(borrowIndex, block.timestamp);
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+        function removeLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityRemoved(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isWithinLiquidationThreshold(position.collateralAmount, _debtFromPrincipal(position.debtPrincipal))) {
+            revert PositionWouldBeUnsafe();
+        }
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        Position storage position = positions[msg.sender];
+        uint256 currentDebt = _debtFromPrincipal(position.debtPrincipal);
+        uint256 nextDebt = currentDebt + amount;
+
+        if (nextDebt > maxBorrowable(position.collateralAmount)) revert PositionWouldBeUnsafe();
+
+        uint256 principalToMint = _debtToPrincipalUp(amount);
+        position.debtPrincipal += principalToMint;
+        totalDebtPrincipal += principalToMint;
+
+        _safeTransfer(USDC, msg.sender, amount);
+        emit Borrowed(msg.sender, amount, nextDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address account, uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, account, amount);
+    }
+
+    function liquidate(address account, uint256 maxRepayAmount) external returns (uint256 repaidAmount, uint256 collateralSeized) {
+        if (maxRepayAmount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (!_isLiquidatable(position.collateralAmount, debt)) revert PositionNotLiquidatable();
+
+        uint256 repayCap = maxLiquidationRepay(account);
+        repaidAmount = maxRepayAmount > repayCap ? repayCap : maxRepayAmount;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        uint256 principalToBurn;
+        if (repaidAmount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (repaidAmount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        collateralSeized = collateralForDebt(repaidAmount);
+        collateralSeized = (collateralSeized * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaidAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, repaidAmount, collateralSeized, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function debtOf(address account) external view returns (uint256) {
+        return _debtFromPrincipalAtIndex(positions[account].debtPrincipal, _previewBorrowIndex());
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return collateralValue(positionCollateral(account));
+    }
+
+    function positionCollateral(address account) public view returns (uint256) {
+        return positions[account].collateralAmount;
+    }
+
+    function maxBorrowable(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * BORROW_LTV_BPS) / BPS;
+    }
+
+    function liquidationThreshold(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function maxLiquidationRepay(address account) public view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        if (!_isLiquidatable(position.collateralAmount, debt)) return 0;
+
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        return (collateralValueUsdc * BPS) / (BPS + LIQUIDATION_BONUS_BPS);
+    }
+
+    function collateralValue(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function collateralForDebt(uint256 usdcAmount) public view returns (uint256) {
+        return (usdcAmount * 1e20) / _readEthUsdPrice();
+    }
+
+    function healthRatioBps(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        if (collateralValueUsdc == 0) {
+            return debt == 0 ? 0 : type(uint256).max;
+        }
+        return (debt * BPS) / collateralValueUsdc;
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal returns (uint256 repaidAmount) {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (debt == 0) revert AmountIsZero();
+
+        uint256 principalToBurn;
+        if (amount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (amount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+
+        _safeTransferFrom(USDC, payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
+        return borrowIndex + ((borrowIndex * interestFactor) / RAY);
+    }
+
+    function _debtFromPrincipal(uint256 principal) internal view returns (uint256) {
+        return _debtFromPrincipalAtIndex(principal, borrowIndex);
+    }
+
+    function _debtFromPrincipalAtIndex(uint256 principal, uint256 index) internal pure returns (uint256) {
+        return (principal * index) / RAY;
+    }
+
+    function _debtToPrincipalUp(uint256 debtAmount) internal view returns (uint256) {
+        return ((debtAmount * RAY) + borrowIndex - 1) / borrowIndex;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt > liquidationThreshold(collateralAmount);
+    }
+
+    function _isWithinLiquidationThreshold(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt <= liquidationThreshold(collateralAmount);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256 price) {
+        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        price = uint256(answer);
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
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f51edcad8b7444021337a1c974a13f02a07e8ec
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c815ac57a39f110f7458574c989829ddee8ac221
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+

codex
Built a minimal Foundry project and implemented the market in [src/EthUsdCMBorrowingMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/src/EthUsdCMBorrowingMarket.sol). The contract supports WETH collateral deposits, USDC borrowing up to 70% LTV, flat annual interest via a global borrow index, repayment, healthy collateral withdrawals, and partial liquidations once debt exceeds 85% LTV with a 5% WETH bonus to the liquidator. It is self-contained and uses a Chainlink-style ETH/USD oracle interface suitable for mainnet deployment.

Project config is in [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/foundry.toml), and the operational write-up is in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/NOTES.md), covering health math, liquidation flow, and deployment/operator requirements.

Verification: `forge build` passes successfully.
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..69fc0e069f74c3f67cf2e3f680e7fbd3a8d5f2b5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache/
+/out/
+/broadcast/
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..60eb31a39fb83a497c121971dd981ec550682ec2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Health computation
+
+Each position tracks:
+
+- WETH collateral, in `18` decimals.
+- USDC debt, in `6` decimals.
+
+The market reads an ETH/USD price from an `AggregatorV3Interface` oracle with `8`
+decimals, which matches the standard mainnet Chainlink ETH/USD feed.
+
+Collateral value in USDC base units is computed as:
+
+`collateralValue = collateralWeth * ethUsdPrice / 1e20`
+
+That scale conversion comes from:
+
+- `1e18` for WETH decimals
+- `1e8` for the oracle
+- `1e6` for USDC
+
+Borrow health has two thresholds:
+
+- Borrow cap: debt must stay at or below `70%` of collateral value to borrow.
+- Liquidation threshold: the position becomes liquidatable once debt is above `85%` of collateral value.
+
+Interest accrues linearly over time through a global borrow index:
+
+- `borrowIndex(t) = borrowIndex(t-1) * (1 + annualRate * dt / 365 days)`
+- A user’s live debt is `debtPrincipal * borrowIndex / 1e27`
+
+Withdrawals are allowed only if the remaining position stays at or below the
+`85%` liquidation threshold after the collateral is removed.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Check that the target position is above the `85%` liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, maxRepayAmount)`.
+
+The market repays up to the requested amount, capped so the liquidator never
+tries to seize more WETH than the position holds. The seized collateral is:
+
+`seizedWeth = debtValueInWeth * 1.05`
+
+So the liquidator receives the WETH equivalent of the repaid USDC plus a `5%`
+bonus.
+
+The implementation supports partial liquidations. A liquidator does not need to
+clear the full debt.
+
+## Mainnet deployment and operations
+
+An operator needs to get the following right:
+
+1. Use the canonical token and oracle addresses for Ethereum mainnet:
+   - WETH with `18` decimals
+   - USDC with `6` decimals
+   - Chainlink ETH/USD oracle with `8` decimals
+2. Choose a flat annual interest rate in basis points when deploying the
+   contract constructor.
+3. Fund the contract with enough USDC using `addLiquidity` before borrowers try
+   to draw loans.
+4. Keep enough idle USDC in the contract if the intent is to support new
+   borrowing at all times. Existing positions can still repay without that
+   liquidity, but new borrows will fail if the contract balance is short.
+5. Monitor oracle freshness. The contract rejects prices older than `2 hours`,
+   so a stale oracle pauses borrow, withdraw, and liquidation. Plain repayment
+   does not depend on the oracle.
+6. Treat `removeLiquidity` as a privileged action with operational discipline.
+   The contract allows the owner to pull idle USDC, so deployment should put
+   ownership behind an appropriate mainnet control plane such as a multisig.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f29c4c1646aebdc5b36940df4a07d68c8be77395
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/EthUsdCMBorrowingMarket.sol b/src/EthUsdCMBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24bcb44328f9186715e8291a88d2c03d99d9e51f
--- /dev/null
+++ b/src/EthUsdCMBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
+
+contract EthUsdCMBorrowingMarket {
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant MAX_PRICE_AGE = 2 hours;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IAggregatorV3 public immutable ETH_USD_ORACLE;
+    address public immutable OWNER;
+    uint256 public immutable ANNUAL_INTEREST_RATE_RAY;
+
+    uint256 public totalDebtPrincipal;
+    uint256 public borrowIndex = RAY;
+    uint256 public lastAccrualTime;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error NotOwner();
+    error AmountIsZero();
+    error TransferFailed();
+    error InsufficientLiquidity();
+    error InsufficientCollateral();
+    error PositionNotLiquidatable();
+    error PositionWouldBeUnsafe();
+    error InvalidOracleAnswer();
+    error StaleOraclePrice();
+    error InvalidOracleDecimals();
+    error ZeroAddress();
+
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed provider, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebt
+    );
+    event Accrued(uint256 newBorrowIndex, uint256 timestamp);
+
+    constructor(
+        address owner_,
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateBps
+    ) {
+        if (owner_ == address(0) || weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) {
+            revert ZeroAddress();
+        }
+
+        OWNER = owner_;
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ETH_USD_ORACLE = IAggregatorV3(ethUsdOracle_);
+        ANNUAL_INTEREST_RATE_RAY = (annualInterestRateBps * RAY) / BPS;
+        lastAccrualTime = block.timestamp;
+
+        if (ETH_USD_ORACLE.decimals() != 8) revert InvalidOracleDecimals();
+        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert InvalidOracleDecimals();
+    }
+
+    modifier onlyOwner() {
+        _onlyOwner();
+        _;
+    }
+
+    function accrueInterest() public {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
+        borrowIndex += (borrowIndex * interestFactor) / RAY;
+        lastAccrualTime = block.timestamp;
+
+        emit Accrued(borrowIndex, block.timestamp);
+    }
+
+    function _onlyOwner() internal view {
+        if (msg.sender != OWNER) revert NotOwner();
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransferFrom(USDC, msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+        function removeLiquidity(uint256 amount, address to) external onlyOwner {
+        if (amount == 0) revert AmountIsZero();
+        _safeTransfer(USDC, to, amount);
+        emit LiquidityRemoved(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        _safeTransferFrom(WETH, msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert InsufficientCollateral();
+
+        position.collateralAmount -= amount;
+        if (!_isWithinLiquidationThreshold(position.collateralAmount, _debtFromPrincipal(position.debtPrincipal))) {
+            revert PositionWouldBeUnsafe();
+        }
+
+        _safeTransfer(WETH, msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+
+        Position storage position = positions[msg.sender];
+        uint256 currentDebt = _debtFromPrincipal(position.debtPrincipal);
+        uint256 nextDebt = currentDebt + amount;
+
+        if (nextDebt > maxBorrowable(position.collateralAmount)) revert PositionWouldBeUnsafe();
+
+        uint256 principalToMint = _debtToPrincipalUp(amount);
+        position.debtPrincipal += principalToMint;
+        totalDebtPrincipal += principalToMint;
+
+        _safeTransfer(USDC, msg.sender, amount);
+        emit Borrowed(msg.sender, amount, nextDebt);
+    }
+
+    function repay(uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, msg.sender, amount);
+    }
+
+    function repayFor(address account, uint256 amount) external returns (uint256 repaidAmount) {
+        repaidAmount = _repay(msg.sender, account, amount);
+    }
+
+    function liquidate(address account, uint256 maxRepayAmount) external returns (uint256 repaidAmount, uint256 collateralSeized) {
+        if (maxRepayAmount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (!_isLiquidatable(position.collateralAmount, debt)) revert PositionNotLiquidatable();
+
+        uint256 repayCap = maxLiquidationRepay(account);
+        repaidAmount = maxRepayAmount > repayCap ? repayCap : maxRepayAmount;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        uint256 principalToBurn;
+        if (repaidAmount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (repaidAmount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        collateralSeized = collateralForDebt(repaidAmount);
+        collateralSeized = (collateralSeized * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
+        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+        position.collateralAmount -= collateralSeized;
+
+        _safeTransferFrom(USDC, msg.sender, address(this), repaidAmount);
+        _safeTransfer(WETH, msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, repaidAmount, collateralSeized, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function debtOf(address account) external view returns (uint256) {
+        return _debtFromPrincipalAtIndex(positions[account].debtPrincipal, _previewBorrowIndex());
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return collateralValue(positionCollateral(account));
+    }
+
+    function positionCollateral(address account) public view returns (uint256) {
+        return positions[account].collateralAmount;
+    }
+
+    function maxBorrowable(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * BORROW_LTV_BPS) / BPS;
+    }
+
+    function liquidationThreshold(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralValue(collateralAmount) * LIQUIDATION_LTV_BPS) / BPS;
+    }
+
+    function maxLiquidationRepay(address account) public view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        if (!_isLiquidatable(position.collateralAmount, debt)) return 0;
+
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        return (collateralValueUsdc * BPS) / (BPS + LIQUIDATION_BONUS_BPS);
+    }
+
+    function collateralValue(uint256 collateralAmount) public view returns (uint256) {
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function collateralForDebt(uint256 usdcAmount) public view returns (uint256) {
+        return (usdcAmount * 1e20) / _readEthUsdPrice();
+    }
+
+    function healthRatioBps(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
+        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
+        if (collateralValueUsdc == 0) {
+            return debt == 0 ? 0 : type(uint256).max;
+        }
+        return (debt * BPS) / collateralValueUsdc;
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal returns (uint256 repaidAmount) {
+        if (amount == 0) revert AmountIsZero();
+        accrueInterest();
+
+        Position storage position = positions[account];
+        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
+        if (debt == 0) revert AmountIsZero();
+
+        uint256 principalToBurn;
+        if (amount >= debt) {
+            principalToBurn = position.debtPrincipal;
+            repaidAmount = debt;
+        } else {
+            principalToBurn = (amount * RAY) / borrowIndex;
+            if (principalToBurn == 0) revert AmountIsZero();
+            repaidAmount = _debtFromPrincipal(principalToBurn);
+        }
+
+        position.debtPrincipal -= principalToBurn;
+        totalDebtPrincipal -= principalToBurn;
+
+        _safeTransferFrom(USDC, payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, _debtFromPrincipal(position.debtPrincipal));
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
+        return borrowIndex + ((borrowIndex * interestFactor) / RAY);
+    }
+
+    function _debtFromPrincipal(uint256 principal) internal view returns (uint256) {
+        return _debtFromPrincipalAtIndex(principal, borrowIndex);
+    }
+
+    function _debtFromPrincipalAtIndex(uint256 principal, uint256 index) internal pure returns (uint256) {
+        return (principal * index) / RAY;
+    }
+
+    function _debtToPrincipalUp(uint256 debtAmount) internal view returns (uint256) {
+        return ((debtAmount * RAY) + borrowIndex - 1) / borrowIndex;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt > liquidationThreshold(collateralAmount);
+    }
+
+    function _isWithinLiquidationThreshold(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
+        return debt <= liquidationThreshold(collateralAmount);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256 price) {
+        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        price = uint256(answer);
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
diff --git a/src/interfaces/IAggregatorV3.sol b/src/interfaces/IAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f51edcad8b7444021337a1c974a13f02a07e8ec
--- /dev/null
+++ b/src/interfaces/IAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c815ac57a39f110f7458574c989829ddee8ac221
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function decimals() external view returns (uint8);
+}
+

tokens used
27,881
```

## final message

Built a minimal Foundry project and implemented the market in [src/EthUsdCMBorrowingMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/src/EthUsdCMBorrowingMarket.sol). The contract supports WETH collateral deposits, USDC borrowing up to 70% LTV, flat annual interest via a global borrow index, repayment, healthy collateral withdrawals, and partial liquidations once debt exceeds 85% LTV with a 5% WETH bonus to the liquidator. It is self-contained and uses a Chainlink-style ETH/USD oracle interface suitable for mainnet deployment.

Project config is in [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/foundry.toml), and the operational write-up is in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041627Z-codex-no-skill-1/security-goal-002/NOTES.md), covering health math, liquidation flow, and deployment/operator requirements.

Verification: `forge build` passes successfully.

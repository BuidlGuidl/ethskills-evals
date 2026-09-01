# Executor transcript — 2026-08-31T211613Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059b4-c4a7-7022-b900-7b544688e36f
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

2026-08-31T21:23:34.428969Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059b4-c4a7-7022-b900-7b544688e36f.tmp-1788211414198354565: line 2547: syntax error near unexpected token `('

codex
I’m setting up the onchain borrowing-market piece in this workspace: first I’ll inspect the directory state, then scaffold a Foundry project, implement the lending contracts, and verify with `forge build`.
exec
/bin/bash -lc 'rg --files' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
exec
/bin/bash -lc pwd in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
 succeeded in 11ms:
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002

 succeeded in 21ms:
TASK.md
package.json

exec
/bin/bash -lc 'ls -la' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
 succeeded in 12ms:
total 20
drwxrwxr-x 5 damu damu 4096 Aug 31 18:23 .
drwxrwxr-x 3 damu damu 4096 Aug 31 18:16 ..
dr-xr-xr-x 2 damu damu   40 Aug 31 18:23 .agents
dr-xr-xr-x 2 damu damu   40 Aug 31 18:23 .codex
drwxrwxr-x 8 damu damu 4096 Aug 31 18:16 .git
-rw-rw-r-- 1 damu damu  849 Aug 31 18:16 TASK.md
-rw-rw-r-- 1 damu damu   50 Aug 31 18:16 package.json

codex
The workspace is essentially empty apart from the task stub, so I’m checking toolchain availability next and then I’ll scaffold the project structure directly in place.
exec
/bin/bash -lc 'cat TASK.md' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
exec
/bin/bash -lc 'cat package.json' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
 succeeded in 8ms:
{
  "name": "eval-workspace",
  "private": true
}

exec
/bin/bash -lc 'forge --version' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
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

 succeeded in 13ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

codex
I have the requirements and `forge` is installed. Next I’m checking the repo state and then I’ll lay out the minimal deployable contract set: vault market, oracle interface, and mocks only if needed for compilation.
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
exec
/bin/bash -lc 'forge init --help' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
 succeeded in 8ms:
 succeeded in 13ms:
Create a new Forge project

Usage: forge init [OPTIONS] [PATH]

Arguments:
  [PATH]
          The root directory of the new project
          
          [default: .]

Options:
  -t, --template <TEMPLATE>
          The template to start from

  -b, --branch <BRANCH>
          Branch argument that can only be used with template option. If not specified, the default
          branch is used

      --offline
          Do not install dependencies from the network
          
          [aliases: --no-deps]

      --force
          Create the project even if the specified root directory is not empty

      --vscode
          Create a .vscode/settings.json file with Solidity settings, and generate a remappings.txt
          file

      --vyper
          Initialize a Vyper project template

      --use-parent-git
          Use the parent git repository instead of initializing a new one. Only valid if the target
          is in a git repository

      --empty
          Do not create example contracts (Counter.sol, Counter.t.sol, Counter.s.sol)

      --shallow
          Perform shallow clones instead of deep ones.
          
          Improves performance and reduces disk usage, but prevents switching branches or tags.

      --no-git
          Install without adding the dependency as a submodule

      --commit
          Create a commit after installing the dependencies

  -h, --help
          Print help (see a summary with '-h')

  -j, --threads <THREADS>
          Number of threads to use. Specifying 0 defaults to the number of logical cores
          
          [aliases: --jobs]

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
/bin/bash -lc 'which forge-std || true' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
 succeeded in 8ms:
codex
I’ve narrowed the design to a single-collateral/single-debt market with a global simple-interest debt index and a price-oracle adapter. I’m writing the project files now, including deployment-facing contracts and operator notes, then I’ll run `forge build` and fix anything the compiler surfaces.
exec
/bin/bash -lc 'mkdir -p src/interfaces script test' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

codex
I’m applying the first full patch now: Foundry config, minimal token/oracle interfaces, a Chainlink-backed price oracle, the market contract, and deployment notes. After that I’ll compile and iterate on any errors rather than leaving a partial scaffold.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/.gitignore
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/NOTES.md
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/foundry.toml
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/BorrowingMarket.sol
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/ChainlinkPriceOracle.sol
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/interfaces/AggregatorV3Interface.sol
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/interfaces/IERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/interfaces/IERC20Metadata.sol
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/interfaces/IPriceOracle.sol
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/libraries/SafeTransferLib.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..0620c3e57453ed02b57feef4caba905ebde13b37
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/out
+/cache
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..374ce541a04c9ac5bb69f599767ca93ae5441c7a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,56 @@
+# Borrowing Market Notes
+
+## Position health
+
+The market tracks one collateral asset (`WETH`) and one debt asset (`USDC`).
+
+- Collateral value in USD:
+  `collateralUsd = collateralAmount * wethPrice / 1e18`
+- Debt value in USD:
+  `debtUsd = debtAmount * usdcPrice / 1e6`
+- Borrow limit:
+  a user may only borrow or withdraw while `debtUsd <= collateralUsd * 70%`
+- Liquidation threshold:
+  a position becomes liquidatable once `debtUsd > collateralUsd * 85%`
+- Health factor:
+  the contract exposes `healthFactorWad`, where values above `1e18` are healthy at the liquidation threshold and values below `1e18` are liquidatable
+
+Debt grows through a single global borrow index:
+
+- `borrowIndex` starts at `1e18`
+- on each state-changing debt action it accrues by simple interest:
+  `borrowIndex = borrowIndex * (1e18 + annualRate * dt / 365 days) / 1e18`
+- a user stores debt shares, and live debt is:
+  `debt = debtShares * borrowIndex / 1e18`
+
+## Liquidation flow
+
+To liquidate an unhealthy position, a liquidator must:
+
+1. Read the target position and confirm the position is above the 85% liquidation LTV.
+2. Approve the market contract to pull `USDC`.
+3. Call `liquidate(user, repayAmount, to)`.
+
+The contract will:
+
+- pull up to the requested `USDC` amount, capped by the user’s live debt and by how much debt the remaining collateral can cover
+- burn the matching debt shares
+- transfer seized `WETH` to `to`
+
+Seized collateral is priced from the oracle and includes a 5% bonus:
+
+`seizedWeth = repayUsdcValue / wethPrice * 1.05`
+
+Because the liquidation is partial, a single liquidation does not need to make the position healthy again.
+
+## Mainnet deployment/operator concerns
+
+- Deploy with canonical Ethereum mainnet addresses for `WETH`, `USDC`, and Chainlink USD feeds.
+- Set `annualInterestRateWad` explicitly. Example: `0.05e18` means 5% APR with simple accrual on the borrow index.
+- Set `maxOracleDelay` conservatively so stale feeds halt borrowing, withdrawing, and liquidation rather than using bad prices.
+- Prefund the market with enough `USDC` liquidity before enabling borrowing. The contract only lends what it already holds.
+- Monitor oracle freshness continuously. If feeds are stale or returning bad answers, pause the market and leave deposit/repay paths operational in your runbook.
+- Run or outsource a liquidation bot. Positions can drift above 85% from price moves or accrued interest.
+- Fund and secure the owner key carefully. The owner can pause borrow-side actions and can move idle `USDC` liquidity.
+- Review token assumptions before deployment. This implementation expects standard ERC-20 behavior and uses token decimals from the deployed assets.
+- Test the exact mainnet feed addresses and staleness settings in a fork before deploying.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dd7ec858f0f54a6a424a6c7101a888522675bf16
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ce5cae1cd017cd424b7831a290b9547acd47e5c0
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,345 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract BorrowingMarket {
+    using SafeTransferLib for address;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+
+    error Unauthorized();
+    error Paused();
+    error ZeroAmount();
+    error InvalidConfiguration();
+    error OraclePriceStale();
+    error PositionUnhealthy();
+    error PositionHealthy();
+    error BorrowTooLarge();
+    error InsufficientLiquidity();
+    error WithdrawTooLarge();
+    error RepayTooSmall();
+    error LiquidationTooLarge();
+    error NoDebt();
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    IERC20 public immutable collateralToken;
+    IERC20 public immutable debtToken;
+    IPriceOracle public immutable oracle;
+    address public owner;
+    bool public paused;
+
+    uint256 public immutable collateralScale;
+    uint256 public immutable debtScale;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleDelay;
+
+    uint256 public borrowIndex = WAD;
+    uint256 public lastAccrualTime;
+    uint256 public totalDebtShares;
+
+    mapping(address => Position) public positions;
+
+    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
+    event PausedSet(bool paused);
+    event LiquiditySupplied(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed to, uint256 amount);
+    event Borrowed(address indexed user, address indexed to, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(address indexed liquidator, address indexed user, uint256 repaidDebt, uint256 seizedCollateral);
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier whenNotPaused() {
+        if (paused) revert Paused();
+        _;
+    }
+
+    constructor(
+        address owner_,
+        address collateralToken_,
+        address debtToken_,
+        address oracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleDelay_
+    ) {
+        uint8 collateralDecimals = IERC20Metadata(collateralToken_).decimals();
+        uint8 debtDecimals = IERC20Metadata(debtToken_).decimals();
+        if (owner_ == address(0) || oracle_ == address(0) || collateralDecimals > 18 || debtDecimals > 18) {
+            revert InvalidConfiguration();
+        }
+
+        owner = owner_;
+        collateralToken = IERC20(collateralToken_);
+        debtToken = IERC20(debtToken_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleDelay = maxOracleDelay_;
+        collateralScale = 10 ** uint256(collateralDecimals);
+        debtScale = 10 ** uint256(debtDecimals);
+        lastAccrualTime = block.timestamp;
+    }
+
+    function setPaused(bool paused_) external onlyOwner {
+        paused = paused_;
+        emit PausedSet(paused_);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert InvalidConfiguration();
+        emit OwnerUpdated(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function supplyLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquiditySupplied(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(address to, uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        address(address(collateralToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position)) revert PositionUnhealthy();
+
+        address(address(collateralToken)).safeTransfer(to, amount);
+        emit CollateralWithdrawn(msg.sender, to, amount);
+    }
+
+    function borrow(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount == 0) revert BorrowTooLarge();
+
+        uint256 newDebtShares = _debtToShares(amount);
+        if (newDebtShares == 0) revert BorrowTooLarge();
+
+        position.debtShares += newDebtShares;
+        totalDebtShares += newDebtShares;
+        if (!_fitsMaxBorrow(position)) revert BorrowTooLarge();
+
+        uint256 availableLiquidity = debtToken.balanceOf(address(this));
+        if (availableLiquidity < amount) revert InsufficientLiquidity();
+
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit Borrowed(msg.sender, to, amount);
+    }
+
+    function repay(uint256 amount, address forUser) external returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[forUser];
+        if (position.debtShares == 0) revert NoDebt();
+
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        if (amount >= debtAmount) {
+            actualRepaid = debtAmount;
+            totalDebtShares -= position.debtShares;
+            position.debtShares = 0;
+        } else {
+            uint256 sharesToBurn = amount * WAD / borrowIndex;
+            if (sharesToBurn == 0) revert RepayTooSmall();
+            position.debtShares -= sharesToBurn;
+            totalDebtShares -= sharesToBurn;
+            actualRepaid = _sharesToDebt(sharesToBurn);
+        }
+
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        emit Repaid(msg.sender, forUser, actualRepaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount, address to)
+        external
+        whenNotPaused
+        returns (uint256 actualRepaid, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[user];
+        if (position.debtShares == 0) revert NoDebt();
+        if (_isHealthy(position)) revert PositionHealthy();
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPrices();
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        uint256 maxRepayByCollateral = _maxRepayFromCollateral(position.collateralAmount, collateralPrice, debtPrice);
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayByCollateral) actualRepaid = maxRepayByCollateral;
+        if (actualRepaid == 0) revert LiquidationTooLarge();
+
+        seizedCollateral = _quoteCollateralForDebt(actualRepaid, collateralPrice, debtPrice);
+        if (seizedCollateral == 0 || seizedCollateral > position.collateralAmount) revert LiquidationTooLarge();
+
+        uint256 sharesToBurn = actualRepaid >= debtAmount ? position.debtShares : actualRepaid * WAD / borrowIndex;
+        if (sharesToBurn == 0) revert LiquidationTooLarge();
+
+        position.debtShares -= sharesToBurn;
+        totalDebtShares -= sharesToBurn;
+        position.collateralAmount -= seizedCollateral;
+
+        actualRepaid = sharesToBurn == 0 ? 0 : _sharesToDebt(sharesToBurn);
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        address(address(collateralToken)).safeTransfer(to, seizedCollateral);
+
+        emit Liquidated(msg.sender, user, actualRepaid, seizedCollateral);
+    }
+
+    function debtOf(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        return _sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex());
+    }
+
+    function collateralValueUsd(address user) external view returns (uint256) {
+        (uint256 collateralPrice,) = oracle.getPrice(address(collateralToken));
+        return _toUsdValue(positions[user].collateralAmount, collateralPrice, collateralScale);
+    }
+
+    function debtValueUsd(address user) external view returns (uint256) {
+        uint256 debtAmount = _sharesToDebtAtIndex(positions[user].debtShares, _previewBorrowIndex());
+        (, uint256 debtPrice) = _freshPricesView();
+        return _toUsdValue(debtAmount, debtPrice, debtScale);
+    }
+
+    function healthFactorWad(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.debtShares == 0) return type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        if (debtUsd == 0) return type(uint256).max;
+
+        return collateralUsd * LIQUIDATION_LTV_BPS * WAD / (debtUsd * BPS);
+    }
+
+    function currentLtvBps(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.collateralAmount == 0) return position.debtShares == 0 ? 0 : type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        if (collateralUsd == 0) return type(uint256).max;
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        return debtUsd * BPS / collateralUsd;
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        borrowIndex = borrowIndex * factor / WAD;
+        lastAccrualTime = block.timestamp;
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        return borrowIndex * factor / WAD;
+    }
+
+    function _debtToShares(uint256 debtAmount) internal view returns (uint256) {
+        return debtAmount * WAD / borrowIndex;
+    }
+
+    function _sharesToDebt(uint256 shares) internal view returns (uint256) {
+        return shares * borrowIndex / WAD;
+    }
+
+    function _sharesToDebtAtIndex(uint256 shares, uint256 index) internal pure returns (uint256) {
+        return shares * index / WAD;
+    }
+
+    function _fitsMaxBorrow(Position storage position) internal view returns (bool) {
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * MAX_BORROW_LTV_BPS;
+    }
+
+    function _isHealthy(Position storage position) internal view returns (bool) {
+        if (position.debtShares == 0) return true;
+        if (position.collateralAmount == 0) return false;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * LIQUIDATION_LTV_BPS;
+    }
+
+    function _freshPrices() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        (collateralPrice, debtPrice) = _freshPricesView();
+    }
+
+    function _freshPricesView() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        (collateralPrice, uint256 collateralUpdatedAt) = oracle.getPrice(address(collateralToken));
+        (debtPrice, uint256 debtUpdatedAt) = oracle.getPrice(address(debtToken));
+        if (block.timestamp - collateralUpdatedAt > maxOracleDelay || block.timestamp - debtUpdatedAt > maxOracleDelay) {
+            revert OraclePriceStale();
+        }
+    }
+
+    function _toUsdValue(uint256 amount, uint256 priceE18, uint256 tokenScale) internal pure returns (uint256) {
+        return amount * priceE18 / tokenScale;
+    }
+
+    function _quoteCollateralForDebt(uint256 debtAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return debtAmount * debtPrice * LIQUIDATION_BONUS_BPS * collateralScale
+            / (collateralPrice * debtScale * BPS);
+    }
+
+    function _maxRepayFromCollateral(uint256 collateralAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return collateralAmount * collateralPrice * debtScale * BPS
+            / (collateralScale * debtPrice * LIQUIDATION_BONUS_BPS);
+    }
+}
+
diff --git a/src/ChainlinkPriceOracle.sol b/src/ChainlinkPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..529aaa3fa56a502f5f652e148a52d9adbfb0a12d
--- /dev/null
+++ b/src/ChainlinkPriceOracle.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkPriceOracle is IPriceOracle {
+    error UnsupportedToken();
+    error InvalidPrice();
+
+    struct FeedConfig {
+        AggregatorV3Interface feed;
+        uint256 scale;
+    }
+
+    address public immutable weth;
+    address public immutable usdc;
+
+    FeedConfig internal wethConfig;
+    FeedConfig internal usdcConfig;
+
+    constructor(address weth_, address wethUsdFeed_, address usdc_, address usdcUsdFeed_) {
+        weth = weth_;
+        usdc = usdc_;
+        wethConfig = FeedConfig({
+            feed: AggregatorV3Interface(wethUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(wethUsdFeed_).decimals())
+        });
+        usdcConfig = FeedConfig({
+            feed: AggregatorV3Interface(usdcUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(usdcUsdFeed_).decimals())
+        });
+    }
+
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt) {
+        FeedConfig memory config;
+        if (token == weth) {
+            config = wethConfig;
+        } else if (token == usdc) {
+            config = usdcConfig;
+        } else {
+            revert UnsupportedToken();
+        }
+
+        (, int256 answer,, uint256 feedUpdatedAt,) = config.feed.latestRoundData();
+        if (answer <= 0 || feedUpdatedAt == 0) {
+            revert InvalidPrice();
+        }
+
+        priceE18 = uint256(answer) * 1e18 / config.scale;
+        updatedAt = feedUpdatedAt;
+    }
+}
+
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1f03d9a3ffef36ca7d291d7f8fc16830ade1dc92
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
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
index 0000000000000000000000000000000000000000..b43bf83b6c7bd9779d175214aeb3b0bd879ec0f7
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..39f790bd54daa4425adb01fe54ab4cb0026b5a61
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,9 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4bc303cc968cb590b01751e2fd7704e1c0a15a5f
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IPriceOracle {
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f3d11f8406a7c9889ab9874b6984e582a1f41a1
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = token.call(
+            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount)
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..0620c3e57453ed02b57feef4caba905ebde13b37
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/out
+/cache
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..374ce541a04c9ac5bb69f599767ca93ae5441c7a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,56 @@
+# Borrowing Market Notes
+
+## Position health
+
+The market tracks one collateral asset (`WETH`) and one debt asset (`USDC`).
+
+- Collateral value in USD:
+  `collateralUsd = collateralAmount * wethPrice / 1e18`
+- Debt value in USD:
+  `debtUsd = debtAmount * usdcPrice / 1e6`
+- Borrow limit:
+  a user may only borrow or withdraw while `debtUsd <= collateralUsd * 70%`
+- Liquidation threshold:
+  a position becomes liquidatable once `debtUsd > collateralUsd * 85%`
+- Health factor:
+  the contract exposes `healthFactorWad`, where values above `1e18` are healthy at the liquidation threshold and values below `1e18` are liquidatable
+
+Debt grows through a single global borrow index:
+
+- `borrowIndex` starts at `1e18`
+- on each state-changing debt action it accrues by simple interest:
+  `borrowIndex = borrowIndex * (1e18 + annualRate * dt / 365 days) / 1e18`
+- a user stores debt shares, and live debt is:
+  `debt = debtShares * borrowIndex / 1e18`
+
+## Liquidation flow
+
+To liquidate an unhealthy position, a liquidator must:
+
+1. Read the target position and confirm the position is above the 85% liquidation LTV.
+2. Approve the market contract to pull `USDC`.
+3. Call `liquidate(user, repayAmount, to)`.
+
+The contract will:
+
+- pull up to the requested `USDC` amount, capped by the user’s live debt and by how much debt the remaining collateral can cover
+- burn the matching debt shares
+- transfer seized `WETH` to `to`
+
+Seized collateral is priced from the oracle and includes a 5% bonus:
+
+`seizedWeth = repayUsdcValue / wethPrice * 1.05`
+
+Because the liquidation is partial, a single liquidation does not need to make the position healthy again.
+
+## Mainnet deployment/operator concerns
+
+- Deploy with canonical Ethereum mainnet addresses for `WETH`, `USDC`, and Chainlink USD feeds.
+- Set `annualInterestRateWad` explicitly. Example: `0.05e18` means 5% APR with simple accrual on the borrow index.
+- Set `maxOracleDelay` conservatively so stale feeds halt borrowing, withdrawing, and liquidation rather than using bad prices.
+- Prefund the market with enough `USDC` liquidity before enabling borrowing. The contract only lends what it already holds.
+- Monitor oracle freshness continuously. If feeds are stale or returning bad answers, pause the market and leave deposit/repay paths operational in your runbook.
+- Run or outsource a liquidation bot. Positions can drift above 85% from price moves or accrued interest.
+- Fund and secure the owner key carefully. The owner can pause borrow-side actions and can move idle `USDC` liquidity.
+- Review token assumptions before deployment. This implementation expects standard ERC-20 behavior and uses token decimals from the deployed assets.
+- Test the exact mainnet feed addresses and staleness settings in a fork before deploying.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dd7ec858f0f54a6a424a6c7101a888522675bf16
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ce5cae1cd017cd424b7831a290b9547acd47e5c0
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,345 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract BorrowingMarket {
+    using SafeTransferLib for address;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+
+    error Unauthorized();
+    error Paused();
+    error ZeroAmount();
+    error InvalidConfiguration();
+    error OraclePriceStale();
+    error PositionUnhealthy();
+    error PositionHealthy();
+    error BorrowTooLarge();
+    error InsufficientLiquidity();
+    error WithdrawTooLarge();
+    error RepayTooSmall();
+    error LiquidationTooLarge();
+    error NoDebt();
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    IERC20 public immutable collateralToken;
+    IERC20 public immutable debtToken;
+    IPriceOracle public immutable oracle;
+    address public owner;
+    bool public paused;
+
+    uint256 public immutable collateralScale;
+    uint256 public immutable debtScale;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleDelay;
+
+    uint256 public borrowIndex = WAD;
+    uint256 public lastAccrualTime;
+    uint256 public totalDebtShares;
+
+    mapping(address => Position) public positions;
+
+    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
+    event PausedSet(bool paused);
+    event LiquiditySupplied(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed to, uint256 amount);
+    event Borrowed(address indexed user, address indexed to, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(address indexed liquidator, address indexed user, uint256 repaidDebt, uint256 seizedCollateral);
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier whenNotPaused() {
+        if (paused) revert Paused();
+        _;
+    }
+
+    constructor(
+        address owner_,
+        address collateralToken_,
+        address debtToken_,
+        address oracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleDelay_
+    ) {
+        uint8 collateralDecimals = IERC20Metadata(collateralToken_).decimals();
+        uint8 debtDecimals = IERC20Metadata(debtToken_).decimals();
+        if (owner_ == address(0) || oracle_ == address(0) || collateralDecimals > 18 || debtDecimals > 18) {
+            revert InvalidConfiguration();
+        }
+
+        owner = owner_;
+        collateralToken = IERC20(collateralToken_);
+        debtToken = IERC20(debtToken_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleDelay = maxOracleDelay_;
+        collateralScale = 10 ** uint256(collateralDecimals);
+        debtScale = 10 ** uint256(debtDecimals);
+        lastAccrualTime = block.timestamp;
+    }
+
+    function setPaused(bool paused_) external onlyOwner {
+        paused = paused_;
+        emit PausedSet(paused_);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert InvalidConfiguration();
+        emit OwnerUpdated(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function supplyLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquiditySupplied(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(address to, uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        address(address(collateralToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position)) revert PositionUnhealthy();
+
+        address(address(collateralToken)).safeTransfer(to, amount);
+        emit CollateralWithdrawn(msg.sender, to, amount);
+    }
+
+    function borrow(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount == 0) revert BorrowTooLarge();
+
+        uint256 newDebtShares = _debtToShares(amount);
+        if (newDebtShares == 0) revert BorrowTooLarge();
+
+        position.debtShares += newDebtShares;
+        totalDebtShares += newDebtShares;
+        if (!_fitsMaxBorrow(position)) revert BorrowTooLarge();
+
+        uint256 availableLiquidity = debtToken.balanceOf(address(this));
+        if (availableLiquidity < amount) revert InsufficientLiquidity();
+
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit Borrowed(msg.sender, to, amount);
+    }
+
+    function repay(uint256 amount, address forUser) external returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[forUser];
+        if (position.debtShares == 0) revert NoDebt();
+
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        if (amount >= debtAmount) {
+            actualRepaid = debtAmount;
+            totalDebtShares -= position.debtShares;
+            position.debtShares = 0;
+        } else {
+            uint256 sharesToBurn = amount * WAD / borrowIndex;
+            if (sharesToBurn == 0) revert RepayTooSmall();
+            position.debtShares -= sharesToBurn;
+            totalDebtShares -= sharesToBurn;
+            actualRepaid = _sharesToDebt(sharesToBurn);
+        }
+
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        emit Repaid(msg.sender, forUser, actualRepaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount, address to)
+        external
+        whenNotPaused
+        returns (uint256 actualRepaid, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[user];
+        if (position.debtShares == 0) revert NoDebt();
+        if (_isHealthy(position)) revert PositionHealthy();
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPrices();
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        uint256 maxRepayByCollateral = _maxRepayFromCollateral(position.collateralAmount, collateralPrice, debtPrice);
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayByCollateral) actualRepaid = maxRepayByCollateral;
+        if (actualRepaid == 0) revert LiquidationTooLarge();
+
+        seizedCollateral = _quoteCollateralForDebt(actualRepaid, collateralPrice, debtPrice);
+        if (seizedCollateral == 0 || seizedCollateral > position.collateralAmount) revert LiquidationTooLarge();
+
+        uint256 sharesToBurn = actualRepaid >= debtAmount ? position.debtShares : actualRepaid * WAD / borrowIndex;
+        if (sharesToBurn == 0) revert LiquidationTooLarge();
+
+        position.debtShares -= sharesToBurn;
+        totalDebtShares -= sharesToBurn;
+        position.collateralAmount -= seizedCollateral;
+
+        actualRepaid = sharesToBurn == 0 ? 0 : _sharesToDebt(sharesToBurn);
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        address(address(collateralToken)).safeTransfer(to, seizedCollateral);
+
+        emit Liquidated(msg.sender, user, actualRepaid, seizedCollateral);
+    }
+
+    function debtOf(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        return _sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex());
+    }
+
+    function collateralValueUsd(address user) external view returns (uint256) {
+        (uint256 collateralPrice,) = oracle.getPrice(address(collateralToken));
+        return _toUsdValue(positions[user].collateralAmount, collateralPrice, collateralScale);
+    }
+
+    function debtValueUsd(address user) external view returns (uint256) {
+        uint256 debtAmount = _sharesToDebtAtIndex(positions[user].debtShares, _previewBorrowIndex());
+        (, uint256 debtPrice) = _freshPricesView();
+        return _toUsdValue(debtAmount, debtPrice, debtScale);
+    }
+
+    function healthFactorWad(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.debtShares == 0) return type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        if (debtUsd == 0) return type(uint256).max;
+
+        return collateralUsd * LIQUIDATION_LTV_BPS * WAD / (debtUsd * BPS);
+    }
+
+    function currentLtvBps(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.collateralAmount == 0) return position.debtShares == 0 ? 0 : type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        if (collateralUsd == 0) return type(uint256).max;
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        return debtUsd * BPS / collateralUsd;
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        borrowIndex = borrowIndex * factor / WAD;
+        lastAccrualTime = block.timestamp;
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        return borrowIndex * factor / WAD;
+    }
+
+    function _debtToShares(uint256 debtAmount) internal view returns (uint256) {
+        return debtAmount * WAD / borrowIndex;
+    }
+
+    function _sharesToDebt(uint256 shares) internal view returns (uint256) {
+        return shares * borrowIndex / WAD;
+    }
+
+    function _sharesToDebtAtIndex(uint256 shares, uint256 index) internal pure returns (uint256) {
+        return shares * index / WAD;
+    }
+
+    function _fitsMaxBorrow(Position storage position) internal view returns (bool) {
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * MAX_BORROW_LTV_BPS;
+    }
+
+    function _isHealthy(Position storage position) internal view returns (bool) {
+        if (position.debtShares == 0) return true;
+        if (position.collateralAmount == 0) return false;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * LIQUIDATION_LTV_BPS;
+    }
+
+    function _freshPrices() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        (collateralPrice, debtPrice) = _freshPricesView();
+    }
+
+    function _freshPricesView() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        (collateralPrice, uint256 collateralUpdatedAt) = oracle.getPrice(address(collateralToken));
+        (debtPrice, uint256 debtUpdatedAt) = oracle.getPrice(address(debtToken));
+        if (block.timestamp - collateralUpdatedAt > maxOracleDelay || block.timestamp - debtUpdatedAt > maxOracleDelay) {
+            revert OraclePriceStale();
+        }
+    }
+
+    function _toUsdValue(uint256 amount, uint256 priceE18, uint256 tokenScale) internal pure returns (uint256) {
+        return amount * priceE18 / tokenScale;
+    }
+
+    function _quoteCollateralForDebt(uint256 debtAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return debtAmount * debtPrice * LIQUIDATION_BONUS_BPS * collateralScale
+            / (collateralPrice * debtScale * BPS);
+    }
+
+    function _maxRepayFromCollateral(uint256 collateralAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return collateralAmount * collateralPrice * debtScale * BPS
+            / (collateralScale * debtPrice * LIQUIDATION_BONUS_BPS);
+    }
+}
+
diff --git a/src/ChainlinkPriceOracle.sol b/src/ChainlinkPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..529aaa3fa56a502f5f652e148a52d9adbfb0a12d
--- /dev/null
+++ b/src/ChainlinkPriceOracle.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkPriceOracle is IPriceOracle {
+    error UnsupportedToken();
+    error InvalidPrice();
+
+    struct FeedConfig {
+        AggregatorV3Interface feed;
+        uint256 scale;
+    }
+
+    address public immutable weth;
+    address public immutable usdc;
+
+    FeedConfig internal wethConfig;
+    FeedConfig internal usdcConfig;
+
+    constructor(address weth_, address wethUsdFeed_, address usdc_, address usdcUsdFeed_) {
+        weth = weth_;
+        usdc = usdc_;
+        wethConfig = FeedConfig({
+            feed: AggregatorV3Interface(wethUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(wethUsdFeed_).decimals())
+        });
+        usdcConfig = FeedConfig({
+            feed: AggregatorV3Interface(usdcUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(usdcUsdFeed_).decimals())
+        });
+    }
+
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt) {
+        FeedConfig memory config;
+        if (token == weth) {
+            config = wethConfig;
+        } else if (token == usdc) {
+            config = usdcConfig;
+        } else {
+            revert UnsupportedToken();
+        }
+
+        (, int256 answer,, uint256 feedUpdatedAt,) = config.feed.latestRoundData();
+        if (answer <= 0 || feedUpdatedAt == 0) {
+            revert InvalidPrice();
+        }
+
+        priceE18 = uint256(answer) * 1e18 / config.scale;
+        updatedAt = feedUpdatedAt;
+    }
+}
+
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1f03d9a3ffef36ca7d291d7f8fc16830ade1dc92
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
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
index 0000000000000000000000000000000000000000..b43bf83b6c7bd9779d175214aeb3b0bd879ec0f7
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..39f790bd54daa4425adb01fe54ab4cb0026b5a61
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,9 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4bc303cc968cb590b01751e2fd7704e1c0a15a5f
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IPriceOracle {
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f3d11f8406a7c9889ab9874b6984e582a1f41a1
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = token.call(
+            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount)
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

codex
The core files are in place. I’m compiling now to catch type issues and edge cases, and I expect at least one round of cleanup because I intentionally avoided external dependencies.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
 exited 1 in 53ms:
Compiling 7 files with Solc 0.8.26
Solc 0.8.26 finished in 8.69ms
Error: Compiler run failed:
Error (2314): Expected ',' but got identifier
   --> src/BorrowingMarket.sol:316:35:
    |
316 |         (collateralPrice, uint256 collateralUpdatedAt) = oracle.getPrice(address(collateralToken));
    |                                   ^^^^^^^^^^^^^^^^^^^

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..0620c3e57453ed02b57feef4caba905ebde13b37
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/out
+/cache
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..374ce541a04c9ac5bb69f599767ca93ae5441c7a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,56 @@
+# Borrowing Market Notes
+
+## Position health
+
+The market tracks one collateral asset (`WETH`) and one debt asset (`USDC`).
+
+- Collateral value in USD:
+  `collateralUsd = collateralAmount * wethPrice / 1e18`
+- Debt value in USD:
+  `debtUsd = debtAmount * usdcPrice / 1e6`
+- Borrow limit:
+  a user may only borrow or withdraw while `debtUsd <= collateralUsd * 70%`
+- Liquidation threshold:
+  a position becomes liquidatable once `debtUsd > collateralUsd * 85%`
+- Health factor:
+  the contract exposes `healthFactorWad`, where values above `1e18` are healthy at the liquidation threshold and values below `1e18` are liquidatable
+
+Debt grows through a single global borrow index:
+
+- `borrowIndex` starts at `1e18`
+- on each state-changing debt action it accrues by simple interest:
+  `borrowIndex = borrowIndex * (1e18 + annualRate * dt / 365 days) / 1e18`
+- a user stores debt shares, and live debt is:
+  `debt = debtShares * borrowIndex / 1e18`
+
+## Liquidation flow
+
+To liquidate an unhealthy position, a liquidator must:
+
+1. Read the target position and confirm the position is above the 85% liquidation LTV.
+2. Approve the market contract to pull `USDC`.
+3. Call `liquidate(user, repayAmount, to)`.
+
+The contract will:
+
+- pull up to the requested `USDC` amount, capped by the user’s live debt and by how much debt the remaining collateral can cover
+- burn the matching debt shares
+- transfer seized `WETH` to `to`
+
+Seized collateral is priced from the oracle and includes a 5% bonus:
+
+`seizedWeth = repayUsdcValue / wethPrice * 1.05`
+
+Because the liquidation is partial, a single liquidation does not need to make the position healthy again.
+
+## Mainnet deployment/operator concerns
+
+- Deploy with canonical Ethereum mainnet addresses for `WETH`, `USDC`, and Chainlink USD feeds.
+- Set `annualInterestRateWad` explicitly. Example: `0.05e18` means 5% APR with simple accrual on the borrow index.
+- Set `maxOracleDelay` conservatively so stale feeds halt borrowing, withdrawing, and liquidation rather than using bad prices.
+- Prefund the market with enough `USDC` liquidity before enabling borrowing. The contract only lends what it already holds.
+- Monitor oracle freshness continuously. If feeds are stale or returning bad answers, pause the market and leave deposit/repay paths operational in your runbook.
+- Run or outsource a liquidation bot. Positions can drift above 85% from price moves or accrued interest.
+- Fund and secure the owner key carefully. The owner can pause borrow-side actions and can move idle `USDC` liquidity.
+- Review token assumptions before deployment. This implementation expects standard ERC-20 behavior and uses token decimals from the deployed assets.
+- Test the exact mainnet feed addresses and staleness settings in a fork before deploying.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dd7ec858f0f54a6a424a6c7101a888522675bf16
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ce5cae1cd017cd424b7831a290b9547acd47e5c0
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,345 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract BorrowingMarket {
+    using SafeTransferLib for address;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+
+    error Unauthorized();
+    error Paused();
+    error ZeroAmount();
+    error InvalidConfiguration();
+    error OraclePriceStale();
+    error PositionUnhealthy();
+    error PositionHealthy();
+    error BorrowTooLarge();
+    error InsufficientLiquidity();
+    error WithdrawTooLarge();
+    error RepayTooSmall();
+    error LiquidationTooLarge();
+    error NoDebt();
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    IERC20 public immutable collateralToken;
+    IERC20 public immutable debtToken;
+    IPriceOracle public immutable oracle;
+    address public owner;
+    bool public paused;
+
+    uint256 public immutable collateralScale;
+    uint256 public immutable debtScale;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleDelay;
+
+    uint256 public borrowIndex = WAD;
+    uint256 public lastAccrualTime;
+    uint256 public totalDebtShares;
+
+    mapping(address => Position) public positions;
+
+    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
+    event PausedSet(bool paused);
+    event LiquiditySupplied(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed to, uint256 amount);
+    event Borrowed(address indexed user, address indexed to, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(address indexed liquidator, address indexed user, uint256 repaidDebt, uint256 seizedCollateral);
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier whenNotPaused() {
+        if (paused) revert Paused();
+        _;
+    }
+
+    constructor(
+        address owner_,
+        address collateralToken_,
+        address debtToken_,
+        address oracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleDelay_
+    ) {
+        uint8 collateralDecimals = IERC20Metadata(collateralToken_).decimals();
+        uint8 debtDecimals = IERC20Metadata(debtToken_).decimals();
+        if (owner_ == address(0) || oracle_ == address(0) || collateralDecimals > 18 || debtDecimals > 18) {
+            revert InvalidConfiguration();
+        }
+
+        owner = owner_;
+        collateralToken = IERC20(collateralToken_);
+        debtToken = IERC20(debtToken_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleDelay = maxOracleDelay_;
+        collateralScale = 10 ** uint256(collateralDecimals);
+        debtScale = 10 ** uint256(debtDecimals);
+        lastAccrualTime = block.timestamp;
+    }
+
+    function setPaused(bool paused_) external onlyOwner {
+        paused = paused_;
+        emit PausedSet(paused_);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert InvalidConfiguration();
+        emit OwnerUpdated(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function supplyLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquiditySupplied(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(address to, uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        address(address(collateralToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position)) revert PositionUnhealthy();
+
+        address(address(collateralToken)).safeTransfer(to, amount);
+        emit CollateralWithdrawn(msg.sender, to, amount);
+    }
+
+    function borrow(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount == 0) revert BorrowTooLarge();
+
+        uint256 newDebtShares = _debtToShares(amount);
+        if (newDebtShares == 0) revert BorrowTooLarge();
+
+        position.debtShares += newDebtShares;
+        totalDebtShares += newDebtShares;
+        if (!_fitsMaxBorrow(position)) revert BorrowTooLarge();
+
+        uint256 availableLiquidity = debtToken.balanceOf(address(this));
+        if (availableLiquidity < amount) revert InsufficientLiquidity();
+
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit Borrowed(msg.sender, to, amount);
+    }
+
+    function repay(uint256 amount, address forUser) external returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[forUser];
+        if (position.debtShares == 0) revert NoDebt();
+
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        if (amount >= debtAmount) {
+            actualRepaid = debtAmount;
+            totalDebtShares -= position.debtShares;
+            position.debtShares = 0;
+        } else {
+            uint256 sharesToBurn = amount * WAD / borrowIndex;
+            if (sharesToBurn == 0) revert RepayTooSmall();
+            position.debtShares -= sharesToBurn;
+            totalDebtShares -= sharesToBurn;
+            actualRepaid = _sharesToDebt(sharesToBurn);
+        }
+
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        emit Repaid(msg.sender, forUser, actualRepaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount, address to)
+        external
+        whenNotPaused
+        returns (uint256 actualRepaid, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[user];
+        if (position.debtShares == 0) revert NoDebt();
+        if (_isHealthy(position)) revert PositionHealthy();
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPrices();
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        uint256 maxRepayByCollateral = _maxRepayFromCollateral(position.collateralAmount, collateralPrice, debtPrice);
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayByCollateral) actualRepaid = maxRepayByCollateral;
+        if (actualRepaid == 0) revert LiquidationTooLarge();
+
+        seizedCollateral = _quoteCollateralForDebt(actualRepaid, collateralPrice, debtPrice);
+        if (seizedCollateral == 0 || seizedCollateral > position.collateralAmount) revert LiquidationTooLarge();
+
+        uint256 sharesToBurn = actualRepaid >= debtAmount ? position.debtShares : actualRepaid * WAD / borrowIndex;
+        if (sharesToBurn == 0) revert LiquidationTooLarge();
+
+        position.debtShares -= sharesToBurn;
+        totalDebtShares -= sharesToBurn;
+        position.collateralAmount -= seizedCollateral;
+
+        actualRepaid = sharesToBurn == 0 ? 0 : _sharesToDebt(sharesToBurn);
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        address(address(collateralToken)).safeTransfer(to, seizedCollateral);
+
+        emit Liquidated(msg.sender, user, actualRepaid, seizedCollateral);
+    }
+
+    function debtOf(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        return _sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex());
+    }
+
+    function collateralValueUsd(address user) external view returns (uint256) {
+        (uint256 collateralPrice,) = oracle.getPrice(address(collateralToken));
+        return _toUsdValue(positions[user].collateralAmount, collateralPrice, collateralScale);
+    }
+
+    function debtValueUsd(address user) external view returns (uint256) {
+        uint256 debtAmount = _sharesToDebtAtIndex(positions[user].debtShares, _previewBorrowIndex());
+        (, uint256 debtPrice) = _freshPricesView();
+        return _toUsdValue(debtAmount, debtPrice, debtScale);
+    }
+
+    function healthFactorWad(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.debtShares == 0) return type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        if (debtUsd == 0) return type(uint256).max;
+
+        return collateralUsd * LIQUIDATION_LTV_BPS * WAD / (debtUsd * BPS);
+    }
+
+    function currentLtvBps(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.collateralAmount == 0) return position.debtShares == 0 ? 0 : type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        if (collateralUsd == 0) return type(uint256).max;
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        return debtUsd * BPS / collateralUsd;
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        borrowIndex = borrowIndex * factor / WAD;
+        lastAccrualTime = block.timestamp;
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        return borrowIndex * factor / WAD;
+    }
+
+    function _debtToShares(uint256 debtAmount) internal view returns (uint256) {
+        return debtAmount * WAD / borrowIndex;
+    }
+
+    function _sharesToDebt(uint256 shares) internal view returns (uint256) {
+        return shares * borrowIndex / WAD;
+    }
+
+    function _sharesToDebtAtIndex(uint256 shares, uint256 index) internal pure returns (uint256) {
+        return shares * index / WAD;
+    }
+
+    function _fitsMaxBorrow(Position storage position) internal view returns (bool) {
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * MAX_BORROW_LTV_BPS;
+    }
+
+    function _isHealthy(Position storage position) internal view returns (bool) {
+        if (position.debtShares == 0) return true;
+        if (position.collateralAmount == 0) return false;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * LIQUIDATION_LTV_BPS;
+    }
+
+    function _freshPrices() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        (collateralPrice, debtPrice) = _freshPricesView();
+    }
+
+    function _freshPricesView() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        (collateralPrice, uint256 collateralUpdatedAt) = oracle.getPrice(address(collateralToken));
+        (debtPrice, uint256 debtUpdatedAt) = oracle.getPrice(address(debtToken));
+        if (block.timestamp - collateralUpdatedAt > maxOracleDelay || block.timestamp - debtUpdatedAt > maxOracleDelay) {
+            revert OraclePriceStale();
+        }
+    }
+
+    function _toUsdValue(uint256 amount, uint256 priceE18, uint256 tokenScale) internal pure returns (uint256) {
+        return amount * priceE18 / tokenScale;
+    }
+
+    function _quoteCollateralForDebt(uint256 debtAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return debtAmount * debtPrice * LIQUIDATION_BONUS_BPS * collateralScale
+            / (collateralPrice * debtScale * BPS);
+    }
+
+    function _maxRepayFromCollateral(uint256 collateralAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return collateralAmount * collateralPrice * debtScale * BPS
+            / (collateralScale * debtPrice * LIQUIDATION_BONUS_BPS);
+    }
+}
+
diff --git a/src/ChainlinkPriceOracle.sol b/src/ChainlinkPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..529aaa3fa56a502f5f652e148a52d9adbfb0a12d
--- /dev/null
+++ b/src/ChainlinkPriceOracle.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkPriceOracle is IPriceOracle {
+    error UnsupportedToken();
+    error InvalidPrice();
+
+    struct FeedConfig {
+        AggregatorV3Interface feed;
+        uint256 scale;
+    }
+
+    address public immutable weth;
+    address public immutable usdc;
+
+    FeedConfig internal wethConfig;
+    FeedConfig internal usdcConfig;
+
+    constructor(address weth_, address wethUsdFeed_, address usdc_, address usdcUsdFeed_) {
+        weth = weth_;
+        usdc = usdc_;
+        wethConfig = FeedConfig({
+            feed: AggregatorV3Interface(wethUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(wethUsdFeed_).decimals())
+        });
+        usdcConfig = FeedConfig({
+            feed: AggregatorV3Interface(usdcUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(usdcUsdFeed_).decimals())
+        });
+    }
+
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt) {
+        FeedConfig memory config;
+        if (token == weth) {
+            config = wethConfig;
+        } else if (token == usdc) {
+            config = usdcConfig;
+        } else {
+            revert UnsupportedToken();
+        }
+
+        (, int256 answer,, uint256 feedUpdatedAt,) = config.feed.latestRoundData();
+        if (answer <= 0 || feedUpdatedAt == 0) {
+            revert InvalidPrice();
+        }
+
+        priceE18 = uint256(answer) * 1e18 / config.scale;
+        updatedAt = feedUpdatedAt;
+    }
+}
+
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1f03d9a3ffef36ca7d291d7f8fc16830ade1dc92
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
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
index 0000000000000000000000000000000000000000..b43bf83b6c7bd9779d175214aeb3b0bd879ec0f7
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..39f790bd54daa4425adb01fe54ab4cb0026b5a61
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,9 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4bc303cc968cb590b01751e2fd7704e1c0a15a5f
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IPriceOracle {
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f3d11f8406a7c9889ab9874b6984e582a1f41a1
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = token.call(
+            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount)
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

codex
The first build failure is a Solidity tuple-declaration issue, not a design problem. I’m fixing that and then rerunning the build to surface any real logic or typing issues.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/BorrowingMarket.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..0620c3e57453ed02b57feef4caba905ebde13b37
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/out
+/cache
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..374ce541a04c9ac5bb69f599767ca93ae5441c7a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,56 @@
+# Borrowing Market Notes
+
+## Position health
+
+The market tracks one collateral asset (`WETH`) and one debt asset (`USDC`).
+
+- Collateral value in USD:
+  `collateralUsd = collateralAmount * wethPrice / 1e18`
+- Debt value in USD:
+  `debtUsd = debtAmount * usdcPrice / 1e6`
+- Borrow limit:
+  a user may only borrow or withdraw while `debtUsd <= collateralUsd * 70%`
+- Liquidation threshold:
+  a position becomes liquidatable once `debtUsd > collateralUsd * 85%`
+- Health factor:
+  the contract exposes `healthFactorWad`, where values above `1e18` are healthy at the liquidation threshold and values below `1e18` are liquidatable
+
+Debt grows through a single global borrow index:
+
+- `borrowIndex` starts at `1e18`
+- on each state-changing debt action it accrues by simple interest:
+  `borrowIndex = borrowIndex * (1e18 + annualRate * dt / 365 days) / 1e18`
+- a user stores debt shares, and live debt is:
+  `debt = debtShares * borrowIndex / 1e18`
+
+## Liquidation flow
+
+To liquidate an unhealthy position, a liquidator must:
+
+1. Read the target position and confirm the position is above the 85% liquidation LTV.
+2. Approve the market contract to pull `USDC`.
+3. Call `liquidate(user, repayAmount, to)`.
+
+The contract will:
+
+- pull up to the requested `USDC` amount, capped by the user’s live debt and by how much debt the remaining collateral can cover
+- burn the matching debt shares
+- transfer seized `WETH` to `to`
+
+Seized collateral is priced from the oracle and includes a 5% bonus:
+
+`seizedWeth = repayUsdcValue / wethPrice * 1.05`
+
+Because the liquidation is partial, a single liquidation does not need to make the position healthy again.
+
+## Mainnet deployment/operator concerns
+
+- Deploy with canonical Ethereum mainnet addresses for `WETH`, `USDC`, and Chainlink USD feeds.
+- Set `annualInterestRateWad` explicitly. Example: `0.05e18` means 5% APR with simple accrual on the borrow index.
+- Set `maxOracleDelay` conservatively so stale feeds halt borrowing, withdrawing, and liquidation rather than using bad prices.
+- Prefund the market with enough `USDC` liquidity before enabling borrowing. The contract only lends what it already holds.
+- Monitor oracle freshness continuously. If feeds are stale or returning bad answers, pause the market and leave deposit/repay paths operational in your runbook.
+- Run or outsource a liquidation bot. Positions can drift above 85% from price moves or accrued interest.
+- Fund and secure the owner key carefully. The owner can pause borrow-side actions and can move idle `USDC` liquidity.
+- Review token assumptions before deployment. This implementation expects standard ERC-20 behavior and uses token decimals from the deployed assets.
+- Test the exact mainnet feed addresses and staleness settings in a fork before deploying.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dd7ec858f0f54a6a424a6c7101a888522675bf16
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..780c52d5f127a547d8607a4a2ec4ab14a33b82b5
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,346 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract BorrowingMarket {
+    using SafeTransferLib for address;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+
+    error Unauthorized();
+    error Paused();
+    error ZeroAmount();
+    error InvalidConfiguration();
+    error OraclePriceStale();
+    error PositionUnhealthy();
+    error PositionHealthy();
+    error BorrowTooLarge();
+    error InsufficientLiquidity();
+    error WithdrawTooLarge();
+    error RepayTooSmall();
+    error LiquidationTooLarge();
+    error NoDebt();
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    IERC20 public immutable collateralToken;
+    IERC20 public immutable debtToken;
+    IPriceOracle public immutable oracle;
+    address public owner;
+    bool public paused;
+
+    uint256 public immutable collateralScale;
+    uint256 public immutable debtScale;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleDelay;
+
+    uint256 public borrowIndex = WAD;
+    uint256 public lastAccrualTime;
+    uint256 public totalDebtShares;
+
+    mapping(address => Position) public positions;
+
+    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
+    event PausedSet(bool paused);
+    event LiquiditySupplied(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed to, uint256 amount);
+    event Borrowed(address indexed user, address indexed to, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(address indexed liquidator, address indexed user, uint256 repaidDebt, uint256 seizedCollateral);
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier whenNotPaused() {
+        if (paused) revert Paused();
+        _;
+    }
+
+    constructor(
+        address owner_,
+        address collateralToken_,
+        address debtToken_,
+        address oracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleDelay_
+    ) {
+        uint8 collateralDecimals = IERC20Metadata(collateralToken_).decimals();
+        uint8 debtDecimals = IERC20Metadata(debtToken_).decimals();
+        if (owner_ == address(0) || oracle_ == address(0) || collateralDecimals > 18 || debtDecimals > 18) {
+            revert InvalidConfiguration();
+        }
+
+        owner = owner_;
+        collateralToken = IERC20(collateralToken_);
+        debtToken = IERC20(debtToken_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleDelay = maxOracleDelay_;
+        collateralScale = 10 ** uint256(collateralDecimals);
+        debtScale = 10 ** uint256(debtDecimals);
+        lastAccrualTime = block.timestamp;
+    }
+
+    function setPaused(bool paused_) external onlyOwner {
+        paused = paused_;
+        emit PausedSet(paused_);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert InvalidConfiguration();
+        emit OwnerUpdated(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function supplyLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquiditySupplied(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(address to, uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        address(address(collateralToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position)) revert PositionUnhealthy();
+
+        address(address(collateralToken)).safeTransfer(to, amount);
+        emit CollateralWithdrawn(msg.sender, to, amount);
+    }
+
+    function borrow(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount == 0) revert BorrowTooLarge();
+
+        uint256 newDebtShares = _debtToShares(amount);
+        if (newDebtShares == 0) revert BorrowTooLarge();
+
+        position.debtShares += newDebtShares;
+        totalDebtShares += newDebtShares;
+        if (!_fitsMaxBorrow(position)) revert BorrowTooLarge();
+
+        uint256 availableLiquidity = debtToken.balanceOf(address(this));
+        if (availableLiquidity < amount) revert InsufficientLiquidity();
+
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit Borrowed(msg.sender, to, amount);
+    }
+
+    function repay(uint256 amount, address forUser) external returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[forUser];
+        if (position.debtShares == 0) revert NoDebt();
+
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        if (amount >= debtAmount) {
+            actualRepaid = debtAmount;
+            totalDebtShares -= position.debtShares;
+            position.debtShares = 0;
+        } else {
+            uint256 sharesToBurn = amount * WAD / borrowIndex;
+            if (sharesToBurn == 0) revert RepayTooSmall();
+            position.debtShares -= sharesToBurn;
+            totalDebtShares -= sharesToBurn;
+            actualRepaid = _sharesToDebt(sharesToBurn);
+        }
+
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        emit Repaid(msg.sender, forUser, actualRepaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount, address to)
+        external
+        whenNotPaused
+        returns (uint256 actualRepaid, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[user];
+        if (position.debtShares == 0) revert NoDebt();
+        if (_isHealthy(position)) revert PositionHealthy();
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPrices();
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        uint256 maxRepayByCollateral = _maxRepayFromCollateral(position.collateralAmount, collateralPrice, debtPrice);
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayByCollateral) actualRepaid = maxRepayByCollateral;
+        if (actualRepaid == 0) revert LiquidationTooLarge();
+
+        seizedCollateral = _quoteCollateralForDebt(actualRepaid, collateralPrice, debtPrice);
+        if (seizedCollateral == 0 || seizedCollateral > position.collateralAmount) revert LiquidationTooLarge();
+
+        uint256 sharesToBurn = actualRepaid >= debtAmount ? position.debtShares : actualRepaid * WAD / borrowIndex;
+        if (sharesToBurn == 0) revert LiquidationTooLarge();
+
+        position.debtShares -= sharesToBurn;
+        totalDebtShares -= sharesToBurn;
+        position.collateralAmount -= seizedCollateral;
+
+        actualRepaid = sharesToBurn == 0 ? 0 : _sharesToDebt(sharesToBurn);
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        address(address(collateralToken)).safeTransfer(to, seizedCollateral);
+
+        emit Liquidated(msg.sender, user, actualRepaid, seizedCollateral);
+    }
+
+    function debtOf(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        return _sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex());
+    }
+
+    function collateralValueUsd(address user) external view returns (uint256) {
+        (uint256 collateralPrice,) = oracle.getPrice(address(collateralToken));
+        return _toUsdValue(positions[user].collateralAmount, collateralPrice, collateralScale);
+    }
+
+    function debtValueUsd(address user) external view returns (uint256) {
+        uint256 debtAmount = _sharesToDebtAtIndex(positions[user].debtShares, _previewBorrowIndex());
+        (, uint256 debtPrice) = _freshPricesView();
+        return _toUsdValue(debtAmount, debtPrice, debtScale);
+    }
+
+    function healthFactorWad(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.debtShares == 0) return type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        if (debtUsd == 0) return type(uint256).max;
+
+        return collateralUsd * LIQUIDATION_LTV_BPS * WAD / (debtUsd * BPS);
+    }
+
+    function currentLtvBps(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.collateralAmount == 0) return position.debtShares == 0 ? 0 : type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        if (collateralUsd == 0) return type(uint256).max;
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        return debtUsd * BPS / collateralUsd;
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        borrowIndex = borrowIndex * factor / WAD;
+        lastAccrualTime = block.timestamp;
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        return borrowIndex * factor / WAD;
+    }
+
+    function _debtToShares(uint256 debtAmount) internal view returns (uint256) {
+        return debtAmount * WAD / borrowIndex;
+    }
+
+    function _sharesToDebt(uint256 shares) internal view returns (uint256) {
+        return shares * borrowIndex / WAD;
+    }
+
+    function _sharesToDebtAtIndex(uint256 shares, uint256 index) internal pure returns (uint256) {
+        return shares * index / WAD;
+    }
+
+    function _fitsMaxBorrow(Position storage position) internal view returns (bool) {
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * MAX_BORROW_LTV_BPS;
+    }
+
+    function _isHealthy(Position storage position) internal view returns (bool) {
+        if (position.debtShares == 0) return true;
+        if (position.collateralAmount == 0) return false;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * LIQUIDATION_LTV_BPS;
+    }
+
+    function _freshPrices() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        (collateralPrice, debtPrice) = _freshPricesView();
+    }
+
+    function _freshPricesView() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        uint256 collateralUpdatedAt;
+        uint256 debtUpdatedAt;
+        (collateralPrice, collateralUpdatedAt) = oracle.getPrice(address(collateralToken));
+        (debtPrice, debtUpdatedAt) = oracle.getPrice(address(debtToken));
+        if (block.timestamp - collateralUpdatedAt > maxOracleDelay || block.timestamp - debtUpdatedAt > maxOracleDelay) {
+            revert OraclePriceStale();
+        }
+    }
+
+    function _toUsdValue(uint256 amount, uint256 priceE18, uint256 tokenScale) internal pure returns (uint256) {
+        return amount * priceE18 / tokenScale;
+    }
+
+    function _quoteCollateralForDebt(uint256 debtAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return debtAmount * debtPrice * LIQUIDATION_BONUS_BPS * collateralScale
+            / (collateralPrice * debtScale * BPS);
+    }
+
+    function _maxRepayFromCollateral(uint256 collateralAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return collateralAmount * collateralPrice * debtScale * BPS
+            / (collateralScale * debtPrice * LIQUIDATION_BONUS_BPS);
+    }
+}
diff --git a/src/ChainlinkPriceOracle.sol b/src/ChainlinkPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..529aaa3fa56a502f5f652e148a52d9adbfb0a12d
--- /dev/null
+++ b/src/ChainlinkPriceOracle.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkPriceOracle is IPriceOracle {
+    error UnsupportedToken();
+    error InvalidPrice();
+
+    struct FeedConfig {
+        AggregatorV3Interface feed;
+        uint256 scale;
+    }
+
+    address public immutable weth;
+    address public immutable usdc;
+
+    FeedConfig internal wethConfig;
+    FeedConfig internal usdcConfig;
+
+    constructor(address weth_, address wethUsdFeed_, address usdc_, address usdcUsdFeed_) {
+        weth = weth_;
+        usdc = usdc_;
+        wethConfig = FeedConfig({
+            feed: AggregatorV3Interface(wethUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(wethUsdFeed_).decimals())
+        });
+        usdcConfig = FeedConfig({
+            feed: AggregatorV3Interface(usdcUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(usdcUsdFeed_).decimals())
+        });
+    }
+
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt) {
+        FeedConfig memory config;
+        if (token == weth) {
+            config = wethConfig;
+        } else if (token == usdc) {
+            config = usdcConfig;
+        } else {
+            revert UnsupportedToken();
+        }
+
+        (, int256 answer,, uint256 feedUpdatedAt,) = config.feed.latestRoundData();
+        if (answer <= 0 || feedUpdatedAt == 0) {
+            revert InvalidPrice();
+        }
+
+        priceE18 = uint256(answer) * 1e18 / config.scale;
+        updatedAt = feedUpdatedAt;
+    }
+}
+
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1f03d9a3ffef36ca7d291d7f8fc16830ade1dc92
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
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
index 0000000000000000000000000000000000000000..b43bf83b6c7bd9779d175214aeb3b0bd879ec0f7
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..39f790bd54daa4425adb01fe54ab4cb0026b5a61
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,9 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4bc303cc968cb590b01751e2fd7704e1c0a15a5f
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IPriceOracle {
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f3d11f8406a7c9889ab9874b6984e582a1f41a1
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = token.call(
+            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount)
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..0620c3e57453ed02b57feef4caba905ebde13b37
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/out
+/cache
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..374ce541a04c9ac5bb69f599767ca93ae5441c7a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,56 @@
+# Borrowing Market Notes
+
+## Position health
+
+The market tracks one collateral asset (`WETH`) and one debt asset (`USDC`).
+
+- Collateral value in USD:
+  `collateralUsd = collateralAmount * wethPrice / 1e18`
+- Debt value in USD:
+  `debtUsd = debtAmount * usdcPrice / 1e6`
+- Borrow limit:
+  a user may only borrow or withdraw while `debtUsd <= collateralUsd * 70%`
+- Liquidation threshold:
+  a position becomes liquidatable once `debtUsd > collateralUsd * 85%`
+- Health factor:
+  the contract exposes `healthFactorWad`, where values above `1e18` are healthy at the liquidation threshold and values below `1e18` are liquidatable
+
+Debt grows through a single global borrow index:
+
+- `borrowIndex` starts at `1e18`
+- on each state-changing debt action it accrues by simple interest:
+  `borrowIndex = borrowIndex * (1e18 + annualRate * dt / 365 days) / 1e18`
+- a user stores debt shares, and live debt is:
+  `debt = debtShares * borrowIndex / 1e18`
+
+## Liquidation flow
+
+To liquidate an unhealthy position, a liquidator must:
+
+1. Read the target position and confirm the position is above the 85% liquidation LTV.
+2. Approve the market contract to pull `USDC`.
+3. Call `liquidate(user, repayAmount, to)`.
+
+The contract will:
+
+- pull up to the requested `USDC` amount, capped by the user’s live debt and by how much debt the remaining collateral can cover
+- burn the matching debt shares
+- transfer seized `WETH` to `to`
+
+Seized collateral is priced from the oracle and includes a 5% bonus:
+
+`seizedWeth = repayUsdcValue / wethPrice * 1.05`
+
+Because the liquidation is partial, a single liquidation does not need to make the position healthy again.
+
+## Mainnet deployment/operator concerns
+
+- Deploy with canonical Ethereum mainnet addresses for `WETH`, `USDC`, and Chainlink USD feeds.
+- Set `annualInterestRateWad` explicitly. Example: `0.05e18` means 5% APR with simple accrual on the borrow index.
+- Set `maxOracleDelay` conservatively so stale feeds halt borrowing, withdrawing, and liquidation rather than using bad prices.
+- Prefund the market with enough `USDC` liquidity before enabling borrowing. The contract only lends what it already holds.
+- Monitor oracle freshness continuously. If feeds are stale or returning bad answers, pause the market and leave deposit/repay paths operational in your runbook.
+- Run or outsource a liquidation bot. Positions can drift above 85% from price moves or accrued interest.
+- Fund and secure the owner key carefully. The owner can pause borrow-side actions and can move idle `USDC` liquidity.
+- Review token assumptions before deployment. This implementation expects standard ERC-20 behavior and uses token decimals from the deployed assets.
+- Test the exact mainnet feed addresses and staleness settings in a fork before deploying.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dd7ec858f0f54a6a424a6c7101a888522675bf16
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..780c52d5f127a547d8607a4a2ec4ab14a33b82b5
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,346 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract BorrowingMarket {
+    using SafeTransferLib for address;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+
+    error Unauthorized();
+    error Paused();
+    error ZeroAmount();
+    error InvalidConfiguration();
+    error OraclePriceStale();
+    error PositionUnhealthy();
+    error PositionHealthy();
+    error BorrowTooLarge();
+    error InsufficientLiquidity();
+    error WithdrawTooLarge();
+    error RepayTooSmall();
+    error LiquidationTooLarge();
+    error NoDebt();
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    IERC20 public immutable collateralToken;
+    IERC20 public immutable debtToken;
+    IPriceOracle public immutable oracle;
+    address public owner;
+    bool public paused;
+
+    uint256 public immutable collateralScale;
+    uint256 public immutable debtScale;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleDelay;
+
+    uint256 public borrowIndex = WAD;
+    uint256 public lastAccrualTime;
+    uint256 public totalDebtShares;
+
+    mapping(address => Position) public positions;
+
+    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
+    event PausedSet(bool paused);
+    event LiquiditySupplied(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed to, uint256 amount);
+    event Borrowed(address indexed user, address indexed to, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(address indexed liquidator, address indexed user, uint256 repaidDebt, uint256 seizedCollateral);
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier whenNotPaused() {
+        if (paused) revert Paused();
+        _;
+    }
+
+    constructor(
+        address owner_,
+        address collateralToken_,
+        address debtToken_,
+        address oracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleDelay_
+    ) {
+        uint8 collateralDecimals = IERC20Metadata(collateralToken_).decimals();
+        uint8 debtDecimals = IERC20Metadata(debtToken_).decimals();
+        if (owner_ == address(0) || oracle_ == address(0) || collateralDecimals > 18 || debtDecimals > 18) {
+            revert InvalidConfiguration();
+        }
+
+        owner = owner_;
+        collateralToken = IERC20(collateralToken_);
+        debtToken = IERC20(debtToken_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleDelay = maxOracleDelay_;
+        collateralScale = 10 ** uint256(collateralDecimals);
+        debtScale = 10 ** uint256(debtDecimals);
+        lastAccrualTime = block.timestamp;
+    }
+
+    function setPaused(bool paused_) external onlyOwner {
+        paused = paused_;
+        emit PausedSet(paused_);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert InvalidConfiguration();
+        emit OwnerUpdated(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function supplyLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquiditySupplied(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(address to, uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        address(address(collateralToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position)) revert PositionUnhealthy();
+
+        address(address(collateralToken)).safeTransfer(to, amount);
+        emit CollateralWithdrawn(msg.sender, to, amount);
+    }
+
+    function borrow(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount == 0) revert BorrowTooLarge();
+
+        uint256 newDebtShares = _debtToShares(amount);
+        if (newDebtShares == 0) revert BorrowTooLarge();
+
+        position.debtShares += newDebtShares;
+        totalDebtShares += newDebtShares;
+        if (!_fitsMaxBorrow(position)) revert BorrowTooLarge();
+
+        uint256 availableLiquidity = debtToken.balanceOf(address(this));
+        if (availableLiquidity < amount) revert InsufficientLiquidity();
+
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit Borrowed(msg.sender, to, amount);
+    }
+
+    function repay(uint256 amount, address forUser) external returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[forUser];
+        if (position.debtShares == 0) revert NoDebt();
+
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        if (amount >= debtAmount) {
+            actualRepaid = debtAmount;
+            totalDebtShares -= position.debtShares;
+            position.debtShares = 0;
+        } else {
+            uint256 sharesToBurn = amount * WAD / borrowIndex;
+            if (sharesToBurn == 0) revert RepayTooSmall();
+            position.debtShares -= sharesToBurn;
+            totalDebtShares -= sharesToBurn;
+            actualRepaid = _sharesToDebt(sharesToBurn);
+        }
+
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        emit Repaid(msg.sender, forUser, actualRepaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount, address to)
+        external
+        whenNotPaused
+        returns (uint256 actualRepaid, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[user];
+        if (position.debtShares == 0) revert NoDebt();
+        if (_isHealthy(position)) revert PositionHealthy();
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPrices();
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        uint256 maxRepayByCollateral = _maxRepayFromCollateral(position.collateralAmount, collateralPrice, debtPrice);
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayByCollateral) actualRepaid = maxRepayByCollateral;
+        if (actualRepaid == 0) revert LiquidationTooLarge();
+
+        seizedCollateral = _quoteCollateralForDebt(actualRepaid, collateralPrice, debtPrice);
+        if (seizedCollateral == 0 || seizedCollateral > position.collateralAmount) revert LiquidationTooLarge();
+
+        uint256 sharesToBurn = actualRepaid >= debtAmount ? position.debtShares : actualRepaid * WAD / borrowIndex;
+        if (sharesToBurn == 0) revert LiquidationTooLarge();
+
+        position.debtShares -= sharesToBurn;
+        totalDebtShares -= sharesToBurn;
+        position.collateralAmount -= seizedCollateral;
+
+        actualRepaid = sharesToBurn == 0 ? 0 : _sharesToDebt(sharesToBurn);
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        address(address(collateralToken)).safeTransfer(to, seizedCollateral);
+
+        emit Liquidated(msg.sender, user, actualRepaid, seizedCollateral);
+    }
+
+    function debtOf(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        return _sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex());
+    }
+
+    function collateralValueUsd(address user) external view returns (uint256) {
+        (uint256 collateralPrice,) = oracle.getPrice(address(collateralToken));
+        return _toUsdValue(positions[user].collateralAmount, collateralPrice, collateralScale);
+    }
+
+    function debtValueUsd(address user) external view returns (uint256) {
+        uint256 debtAmount = _sharesToDebtAtIndex(positions[user].debtShares, _previewBorrowIndex());
+        (, uint256 debtPrice) = _freshPricesView();
+        return _toUsdValue(debtAmount, debtPrice, debtScale);
+    }
+
+    function healthFactorWad(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.debtShares == 0) return type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        if (debtUsd == 0) return type(uint256).max;
+
+        return collateralUsd * LIQUIDATION_LTV_BPS * WAD / (debtUsd * BPS);
+    }
+
+    function currentLtvBps(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.collateralAmount == 0) return position.debtShares == 0 ? 0 : type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        if (collateralUsd == 0) return type(uint256).max;
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        return debtUsd * BPS / collateralUsd;
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        borrowIndex = borrowIndex * factor / WAD;
+        lastAccrualTime = block.timestamp;
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        return borrowIndex * factor / WAD;
+    }
+
+    function _debtToShares(uint256 debtAmount) internal view returns (uint256) {
+        return debtAmount * WAD / borrowIndex;
+    }
+
+    function _sharesToDebt(uint256 shares) internal view returns (uint256) {
+        return shares * borrowIndex / WAD;
+    }
+
+    function _sharesToDebtAtIndex(uint256 shares, uint256 index) internal pure returns (uint256) {
+        return shares * index / WAD;
+    }
+
+    function _fitsMaxBorrow(Position storage position) internal view returns (bool) {
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * MAX_BORROW_LTV_BPS;
+    }
+
+    function _isHealthy(Position storage position) internal view returns (bool) {
+        if (position.debtShares == 0) return true;
+        if (position.collateralAmount == 0) return false;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * LIQUIDATION_LTV_BPS;
+    }
+
+    function _freshPrices() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        (collateralPrice, debtPrice) = _freshPricesView();
+    }
+
+    function _freshPricesView() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        uint256 collateralUpdatedAt;
+        uint256 debtUpdatedAt;
+        (collateralPrice, collateralUpdatedAt) = oracle.getPrice(address(collateralToken));
+        (debtPrice, debtUpdatedAt) = oracle.getPrice(address(debtToken));
+        if (block.timestamp - collateralUpdatedAt > maxOracleDelay || block.timestamp - debtUpdatedAt > maxOracleDelay) {
+            revert OraclePriceStale();
+        }
+    }
+
+    function _toUsdValue(uint256 amount, uint256 priceE18, uint256 tokenScale) internal pure returns (uint256) {
+        return amount * priceE18 / tokenScale;
+    }
+
+    function _quoteCollateralForDebt(uint256 debtAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return debtAmount * debtPrice * LIQUIDATION_BONUS_BPS * collateralScale
+            / (collateralPrice * debtScale * BPS);
+    }
+
+    function _maxRepayFromCollateral(uint256 collateralAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return collateralAmount * collateralPrice * debtScale * BPS
+            / (collateralScale * debtPrice * LIQUIDATION_BONUS_BPS);
+    }
+}
diff --git a/src/ChainlinkPriceOracle.sol b/src/ChainlinkPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..529aaa3fa56a502f5f652e148a52d9adbfb0a12d
--- /dev/null
+++ b/src/ChainlinkPriceOracle.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkPriceOracle is IPriceOracle {
+    error UnsupportedToken();
+    error InvalidPrice();
+
+    struct FeedConfig {
+        AggregatorV3Interface feed;
+        uint256 scale;
+    }
+
+    address public immutable weth;
+    address public immutable usdc;
+
+    FeedConfig internal wethConfig;
+    FeedConfig internal usdcConfig;
+
+    constructor(address weth_, address wethUsdFeed_, address usdc_, address usdcUsdFeed_) {
+        weth = weth_;
+        usdc = usdc_;
+        wethConfig = FeedConfig({
+            feed: AggregatorV3Interface(wethUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(wethUsdFeed_).decimals())
+        });
+        usdcConfig = FeedConfig({
+            feed: AggregatorV3Interface(usdcUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(usdcUsdFeed_).decimals())
+        });
+    }
+
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt) {
+        FeedConfig memory config;
+        if (token == weth) {
+            config = wethConfig;
+        } else if (token == usdc) {
+            config = usdcConfig;
+        } else {
+            revert UnsupportedToken();
+        }
+
+        (, int256 answer,, uint256 feedUpdatedAt,) = config.feed.latestRoundData();
+        if (answer <= 0 || feedUpdatedAt == 0) {
+            revert InvalidPrice();
+        }
+
+        priceE18 = uint256(answer) * 1e18 / config.scale;
+        updatedAt = feedUpdatedAt;
+    }
+}
+
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1f03d9a3ffef36ca7d291d7f8fc16830ade1dc92
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
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
index 0000000000000000000000000000000000000000..b43bf83b6c7bd9779d175214aeb3b0bd879ec0f7
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..39f790bd54daa4425adb01fe54ab4cb0026b5a61
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,9 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4bc303cc968cb590b01751e2fd7704e1c0a15a5f
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IPriceOracle {
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f3d11f8406a7c9889ab9874b6984e582a1f41a1
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = token.call(
+            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount)
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
 succeeded in 196ms:
Compiling 7 files with Solc 0.8.26
Solc 0.8.26 finished in 161.27ms
Compiler run successful!
2026-08-31T21:26:54.771842Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ChainlinkPriceOracle.sol:16:30
   |
16 |     address public immutable weth;
   |                              ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ChainlinkPriceOracle.sol:17:30
   |
17 |     address public immutable usdc;
   |                              ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/ChainlinkPriceOracle.sol:50:20
   |
50 |         priceE18 = uint256(answer) * 1e18 / config.scale;
   |                    ^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint256' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:38:29
   |
38 |     IERC20 public immutable collateralToken;
   |                             ^^^^^^^^^^^^^^^ help: consider using: `COLLATERAL_TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:39:29
   |
39 |     IERC20 public immutable debtToken;
   |                             ^^^^^^^^^ help: consider using: `DEBT_TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:40:35
   |
40 |     IPriceOracle public immutable oracle;
   |                                   ^^^^^^ help: consider using: `ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:44:30
   |
44 |     uint256 public immutable collateralScale;
   |                              ^^^^^^^^^^^^^^^ help: consider using: `COLLATERAL_SCALE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:45:30
   |
45 |     uint256 public immutable debtScale;
   |                              ^^^^^^^^^ help: consider using: `DEBT_SCALE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:46:30
   |
46 |     uint256 public immutable annualInterestRateWad;
   |                              ^^^^^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_RATE_WAD`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:47:30
   |
47 |     uint256 public immutable maxOracleDelay;
   |                              ^^^^^^^^^^^^^^ help: consider using: `MAX_ORACLE_DELAY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/BorrowingMarket.sol:65:5
   |
65 | /     modifier onlyOwner() {
66 | |         if (msg.sender != owner) revert Unauthorized();
67 | |         _;
68 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
65 ~     modifier onlyOwner() {
66 +         _onlyOwner();
67 +         _;
68 +     }
69 + 
70 +     function _onlyOwner() internal {
71 +         if (msg.sender != owner) revert Unauthorized();
72 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/BorrowingMarket.sol:70:5
   |
70 | /     modifier whenNotPaused() {
71 | |         if (paused) revert Paused();
72 | |         _;
73 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
70 ~     modifier whenNotPaused() {
71 +         _whenNotPaused();
72 +         _;
73 +     }
74 + 
75 +     function _whenNotPaused() internal {
76 +         if (paused) revert Paused();
77 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic


diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..0620c3e57453ed02b57feef4caba905ebde13b37
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/out
+/cache
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..374ce541a04c9ac5bb69f599767ca93ae5441c7a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,56 @@
+# Borrowing Market Notes
+
+## Position health
+
+The market tracks one collateral asset (`WETH`) and one debt asset (`USDC`).
+
+- Collateral value in USD:
+  `collateralUsd = collateralAmount * wethPrice / 1e18`
+- Debt value in USD:
+  `debtUsd = debtAmount * usdcPrice / 1e6`
+- Borrow limit:
+  a user may only borrow or withdraw while `debtUsd <= collateralUsd * 70%`
+- Liquidation threshold:
+  a position becomes liquidatable once `debtUsd > collateralUsd * 85%`
+- Health factor:
+  the contract exposes `healthFactorWad`, where values above `1e18` are healthy at the liquidation threshold and values below `1e18` are liquidatable
+
+Debt grows through a single global borrow index:
+
+- `borrowIndex` starts at `1e18`
+- on each state-changing debt action it accrues by simple interest:
+  `borrowIndex = borrowIndex * (1e18 + annualRate * dt / 365 days) / 1e18`
+- a user stores debt shares, and live debt is:
+  `debt = debtShares * borrowIndex / 1e18`
+
+## Liquidation flow
+
+To liquidate an unhealthy position, a liquidator must:
+
+1. Read the target position and confirm the position is above the 85% liquidation LTV.
+2. Approve the market contract to pull `USDC`.
+3. Call `liquidate(user, repayAmount, to)`.
+
+The contract will:
+
+- pull up to the requested `USDC` amount, capped by the user’s live debt and by how much debt the remaining collateral can cover
+- burn the matching debt shares
+- transfer seized `WETH` to `to`
+
+Seized collateral is priced from the oracle and includes a 5% bonus:
+
+`seizedWeth = repayUsdcValue / wethPrice * 1.05`
+
+Because the liquidation is partial, a single liquidation does not need to make the position healthy again.
+
+## Mainnet deployment/operator concerns
+
+- Deploy with canonical Ethereum mainnet addresses for `WETH`, `USDC`, and Chainlink USD feeds.
+- Set `annualInterestRateWad` explicitly. Example: `0.05e18` means 5% APR with simple accrual on the borrow index.
+- Set `maxOracleDelay` conservatively so stale feeds halt borrowing, withdrawing, and liquidation rather than using bad prices.
+- Prefund the market with enough `USDC` liquidity before enabling borrowing. The contract only lends what it already holds.
+- Monitor oracle freshness continuously. If feeds are stale or returning bad answers, pause the market and leave deposit/repay paths operational in your runbook.
+- Run or outsource a liquidation bot. Positions can drift above 85% from price moves or accrued interest.
+- Fund and secure the owner key carefully. The owner can pause borrow-side actions and can move idle `USDC` liquidity.
+- Review token assumptions before deployment. This implementation expects standard ERC-20 behavior and uses token decimals from the deployed assets.
+- Test the exact mainnet feed addresses and staleness settings in a fork before deploying.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dd7ec858f0f54a6a424a6c7101a888522675bf16
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..780c52d5f127a547d8607a4a2ec4ab14a33b82b5
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,346 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract BorrowingMarket {
+    using SafeTransferLib for address;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+
+    error Unauthorized();
+    error Paused();
+    error ZeroAmount();
+    error InvalidConfiguration();
+    error OraclePriceStale();
+    error PositionUnhealthy();
+    error PositionHealthy();
+    error BorrowTooLarge();
+    error InsufficientLiquidity();
+    error WithdrawTooLarge();
+    error RepayTooSmall();
+    error LiquidationTooLarge();
+    error NoDebt();
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    IERC20 public immutable collateralToken;
+    IERC20 public immutable debtToken;
+    IPriceOracle public immutable oracle;
+    address public owner;
+    bool public paused;
+
+    uint256 public immutable collateralScale;
+    uint256 public immutable debtScale;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleDelay;
+
+    uint256 public borrowIndex = WAD;
+    uint256 public lastAccrualTime;
+    uint256 public totalDebtShares;
+
+    mapping(address => Position) public positions;
+
+    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
+    event PausedSet(bool paused);
+    event LiquiditySupplied(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed to, uint256 amount);
+    event Borrowed(address indexed user, address indexed to, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(address indexed liquidator, address indexed user, uint256 repaidDebt, uint256 seizedCollateral);
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier whenNotPaused() {
+        if (paused) revert Paused();
+        _;
+    }
+
+    constructor(
+        address owner_,
+        address collateralToken_,
+        address debtToken_,
+        address oracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleDelay_
+    ) {
+        uint8 collateralDecimals = IERC20Metadata(collateralToken_).decimals();
+        uint8 debtDecimals = IERC20Metadata(debtToken_).decimals();
+        if (owner_ == address(0) || oracle_ == address(0) || collateralDecimals > 18 || debtDecimals > 18) {
+            revert InvalidConfiguration();
+        }
+
+        owner = owner_;
+        collateralToken = IERC20(collateralToken_);
+        debtToken = IERC20(debtToken_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleDelay = maxOracleDelay_;
+        collateralScale = 10 ** uint256(collateralDecimals);
+        debtScale = 10 ** uint256(debtDecimals);
+        lastAccrualTime = block.timestamp;
+    }
+
+    function setPaused(bool paused_) external onlyOwner {
+        paused = paused_;
+        emit PausedSet(paused_);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert InvalidConfiguration();
+        emit OwnerUpdated(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function supplyLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquiditySupplied(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(address to, uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        address(address(collateralToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position)) revert PositionUnhealthy();
+
+        address(address(collateralToken)).safeTransfer(to, amount);
+        emit CollateralWithdrawn(msg.sender, to, amount);
+    }
+
+    function borrow(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount == 0) revert BorrowTooLarge();
+
+        uint256 newDebtShares = _debtToShares(amount);
+        if (newDebtShares == 0) revert BorrowTooLarge();
+
+        position.debtShares += newDebtShares;
+        totalDebtShares += newDebtShares;
+        if (!_fitsMaxBorrow(position)) revert BorrowTooLarge();
+
+        uint256 availableLiquidity = debtToken.balanceOf(address(this));
+        if (availableLiquidity < amount) revert InsufficientLiquidity();
+
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit Borrowed(msg.sender, to, amount);
+    }
+
+    function repay(uint256 amount, address forUser) external returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[forUser];
+        if (position.debtShares == 0) revert NoDebt();
+
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        if (amount >= debtAmount) {
+            actualRepaid = debtAmount;
+            totalDebtShares -= position.debtShares;
+            position.debtShares = 0;
+        } else {
+            uint256 sharesToBurn = amount * WAD / borrowIndex;
+            if (sharesToBurn == 0) revert RepayTooSmall();
+            position.debtShares -= sharesToBurn;
+            totalDebtShares -= sharesToBurn;
+            actualRepaid = _sharesToDebt(sharesToBurn);
+        }
+
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        emit Repaid(msg.sender, forUser, actualRepaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount, address to)
+        external
+        whenNotPaused
+        returns (uint256 actualRepaid, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[user];
+        if (position.debtShares == 0) revert NoDebt();
+        if (_isHealthy(position)) revert PositionHealthy();
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPrices();
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        uint256 maxRepayByCollateral = _maxRepayFromCollateral(position.collateralAmount, collateralPrice, debtPrice);
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayByCollateral) actualRepaid = maxRepayByCollateral;
+        if (actualRepaid == 0) revert LiquidationTooLarge();
+
+        seizedCollateral = _quoteCollateralForDebt(actualRepaid, collateralPrice, debtPrice);
+        if (seizedCollateral == 0 || seizedCollateral > position.collateralAmount) revert LiquidationTooLarge();
+
+        uint256 sharesToBurn = actualRepaid >= debtAmount ? position.debtShares : actualRepaid * WAD / borrowIndex;
+        if (sharesToBurn == 0) revert LiquidationTooLarge();
+
+        position.debtShares -= sharesToBurn;
+        totalDebtShares -= sharesToBurn;
+        position.collateralAmount -= seizedCollateral;
+
+        actualRepaid = sharesToBurn == 0 ? 0 : _sharesToDebt(sharesToBurn);
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        address(address(collateralToken)).safeTransfer(to, seizedCollateral);
+
+        emit Liquidated(msg.sender, user, actualRepaid, seizedCollateral);
+    }
+
+    function debtOf(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        return _sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex());
+    }
+
+    function collateralValueUsd(address user) external view returns (uint256) {
+        (uint256 collateralPrice,) = oracle.getPrice(address(collateralToken));
+        return _toUsdValue(positions[user].collateralAmount, collateralPrice, collateralScale);
+    }
+
+    function debtValueUsd(address user) external view returns (uint256) {
+        uint256 debtAmount = _sharesToDebtAtIndex(positions[user].debtShares, _previewBorrowIndex());
+        (, uint256 debtPrice) = _freshPricesView();
+        return _toUsdValue(debtAmount, debtPrice, debtScale);
+    }
+
+    function healthFactorWad(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.debtShares == 0) return type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        if (debtUsd == 0) return type(uint256).max;
+
+        return collateralUsd * LIQUIDATION_LTV_BPS * WAD / (debtUsd * BPS);
+    }
+
+    function currentLtvBps(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.collateralAmount == 0) return position.debtShares == 0 ? 0 : type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        if (collateralUsd == 0) return type(uint256).max;
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        return debtUsd * BPS / collateralUsd;
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        borrowIndex = borrowIndex * factor / WAD;
+        lastAccrualTime = block.timestamp;
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        return borrowIndex * factor / WAD;
+    }
+
+    function _debtToShares(uint256 debtAmount) internal view returns (uint256) {
+        return debtAmount * WAD / borrowIndex;
+    }
+
+    function _sharesToDebt(uint256 shares) internal view returns (uint256) {
+        return shares * borrowIndex / WAD;
+    }
+
+    function _sharesToDebtAtIndex(uint256 shares, uint256 index) internal pure returns (uint256) {
+        return shares * index / WAD;
+    }
+
+    function _fitsMaxBorrow(Position storage position) internal view returns (bool) {
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * MAX_BORROW_LTV_BPS;
+    }
+
+    function _isHealthy(Position storage position) internal view returns (bool) {
+        if (position.debtShares == 0) return true;
+        if (position.collateralAmount == 0) return false;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * LIQUIDATION_LTV_BPS;
+    }
+
+    function _freshPrices() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        (collateralPrice, debtPrice) = _freshPricesView();
+    }
+
+    function _freshPricesView() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        uint256 collateralUpdatedAt;
+        uint256 debtUpdatedAt;
+        (collateralPrice, collateralUpdatedAt) = oracle.getPrice(address(collateralToken));
+        (debtPrice, debtUpdatedAt) = oracle.getPrice(address(debtToken));
+        if (block.timestamp - collateralUpdatedAt > maxOracleDelay || block.timestamp - debtUpdatedAt > maxOracleDelay) {
+            revert OraclePriceStale();
+        }
+    }
+
+    function _toUsdValue(uint256 amount, uint256 priceE18, uint256 tokenScale) internal pure returns (uint256) {
+        return amount * priceE18 / tokenScale;
+    }
+
+    function _quoteCollateralForDebt(uint256 debtAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return debtAmount * debtPrice * LIQUIDATION_BONUS_BPS * collateralScale
+            / (collateralPrice * debtScale * BPS);
+    }
+
+    function _maxRepayFromCollateral(uint256 collateralAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return collateralAmount * collateralPrice * debtScale * BPS
+            / (collateralScale * debtPrice * LIQUIDATION_BONUS_BPS);
+    }
+}
diff --git a/src/ChainlinkPriceOracle.sol b/src/ChainlinkPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..529aaa3fa56a502f5f652e148a52d9adbfb0a12d
--- /dev/null
+++ b/src/ChainlinkPriceOracle.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkPriceOracle is IPriceOracle {
+    error UnsupportedToken();
+    error InvalidPrice();
+
+    struct FeedConfig {
+        AggregatorV3Interface feed;
+        uint256 scale;
+    }
+
+    address public immutable weth;
+    address public immutable usdc;
+
+    FeedConfig internal wethConfig;
+    FeedConfig internal usdcConfig;
+
+    constructor(address weth_, address wethUsdFeed_, address usdc_, address usdcUsdFeed_) {
+        weth = weth_;
+        usdc = usdc_;
+        wethConfig = FeedConfig({
+            feed: AggregatorV3Interface(wethUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(wethUsdFeed_).decimals())
+        });
+        usdcConfig = FeedConfig({
+            feed: AggregatorV3Interface(usdcUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(usdcUsdFeed_).decimals())
+        });
+    }
+
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt) {
+        FeedConfig memory config;
+        if (token == weth) {
+            config = wethConfig;
+        } else if (token == usdc) {
+            config = usdcConfig;
+        } else {
+            revert UnsupportedToken();
+        }
+
+        (, int256 answer,, uint256 feedUpdatedAt,) = config.feed.latestRoundData();
+        if (answer <= 0 || feedUpdatedAt == 0) {
+            revert InvalidPrice();
+        }
+
+        priceE18 = uint256(answer) * 1e18 / config.scale;
+        updatedAt = feedUpdatedAt;
+    }
+}
+
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1f03d9a3ffef36ca7d291d7f8fc16830ade1dc92
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
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
index 0000000000000000000000000000000000000000..b43bf83b6c7bd9779d175214aeb3b0bd879ec0f7
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..39f790bd54daa4425adb01fe54ab4cb0026b5a61
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,9 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4bc303cc968cb590b01751e2fd7704e1c0a15a5f
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IPriceOracle {
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f3d11f8406a7c9889ab9874b6984e582a1f41a1
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = token.call(
+            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount)
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

codex
The contracts compile. I’m doing one last pass on the repo state and then I’ll close with the exact files added and the remaining operational caveat: this is a minimal market, so safety depends on deploying it with the right oracle, liquidity, and monitoring.
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
 succeeded in 2ms:
exec
/bin/bash -lc 'find src -maxdepth 2 -type f | sort' in /tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
src/BorrowingMarket.sol
src/ChainlinkPriceOracle.sol
src/interfaces/AggregatorV3Interface.sol
src/interfaces/IERC20.sol
src/interfaces/IERC20Metadata.sol
src/interfaces/IPriceOracle.sol
src/libraries/SafeTransferLib.sol

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..0620c3e57453ed02b57feef4caba905ebde13b37
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/out
+/cache
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..374ce541a04c9ac5bb69f599767ca93ae5441c7a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,56 @@
+# Borrowing Market Notes
+
+## Position health
+
+The market tracks one collateral asset (`WETH`) and one debt asset (`USDC`).
+
+- Collateral value in USD:
+  `collateralUsd = collateralAmount * wethPrice / 1e18`
+- Debt value in USD:
+  `debtUsd = debtAmount * usdcPrice / 1e6`
+- Borrow limit:
+  a user may only borrow or withdraw while `debtUsd <= collateralUsd * 70%`
+- Liquidation threshold:
+  a position becomes liquidatable once `debtUsd > collateralUsd * 85%`
+- Health factor:
+  the contract exposes `healthFactorWad`, where values above `1e18` are healthy at the liquidation threshold and values below `1e18` are liquidatable
+
+Debt grows through a single global borrow index:
+
+- `borrowIndex` starts at `1e18`
+- on each state-changing debt action it accrues by simple interest:
+  `borrowIndex = borrowIndex * (1e18 + annualRate * dt / 365 days) / 1e18`
+- a user stores debt shares, and live debt is:
+  `debt = debtShares * borrowIndex / 1e18`
+
+## Liquidation flow
+
+To liquidate an unhealthy position, a liquidator must:
+
+1. Read the target position and confirm the position is above the 85% liquidation LTV.
+2. Approve the market contract to pull `USDC`.
+3. Call `liquidate(user, repayAmount, to)`.
+
+The contract will:
+
+- pull up to the requested `USDC` amount, capped by the user’s live debt and by how much debt the remaining collateral can cover
+- burn the matching debt shares
+- transfer seized `WETH` to `to`
+
+Seized collateral is priced from the oracle and includes a 5% bonus:
+
+`seizedWeth = repayUsdcValue / wethPrice * 1.05`
+
+Because the liquidation is partial, a single liquidation does not need to make the position healthy again.
+
+## Mainnet deployment/operator concerns
+
+- Deploy with canonical Ethereum mainnet addresses for `WETH`, `USDC`, and Chainlink USD feeds.
+- Set `annualInterestRateWad` explicitly. Example: `0.05e18` means 5% APR with simple accrual on the borrow index.
+- Set `maxOracleDelay` conservatively so stale feeds halt borrowing, withdrawing, and liquidation rather than using bad prices.
+- Prefund the market with enough `USDC` liquidity before enabling borrowing. The contract only lends what it already holds.
+- Monitor oracle freshness continuously. If feeds are stale or returning bad answers, pause the market and leave deposit/repay paths operational in your runbook.
+- Run or outsource a liquidation bot. Positions can drift above 85% from price moves or accrued interest.
+- Fund and secure the owner key carefully. The owner can pause borrow-side actions and can move idle `USDC` liquidity.
+- Review token assumptions before deployment. This implementation expects standard ERC-20 behavior and uses token decimals from the deployed assets.
+- Test the exact mainnet feed addresses and staleness settings in a fork before deploying.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dd7ec858f0f54a6a424a6c7101a888522675bf16
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..780c52d5f127a547d8607a4a2ec4ab14a33b82b5
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,346 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract BorrowingMarket {
+    using SafeTransferLib for address;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+
+    error Unauthorized();
+    error Paused();
+    error ZeroAmount();
+    error InvalidConfiguration();
+    error OraclePriceStale();
+    error PositionUnhealthy();
+    error PositionHealthy();
+    error BorrowTooLarge();
+    error InsufficientLiquidity();
+    error WithdrawTooLarge();
+    error RepayTooSmall();
+    error LiquidationTooLarge();
+    error NoDebt();
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    IERC20 public immutable collateralToken;
+    IERC20 public immutable debtToken;
+    IPriceOracle public immutable oracle;
+    address public owner;
+    bool public paused;
+
+    uint256 public immutable collateralScale;
+    uint256 public immutable debtScale;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleDelay;
+
+    uint256 public borrowIndex = WAD;
+    uint256 public lastAccrualTime;
+    uint256 public totalDebtShares;
+
+    mapping(address => Position) public positions;
+
+    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
+    event PausedSet(bool paused);
+    event LiquiditySupplied(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed to, uint256 amount);
+    event Borrowed(address indexed user, address indexed to, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(address indexed liquidator, address indexed user, uint256 repaidDebt, uint256 seizedCollateral);
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier whenNotPaused() {
+        if (paused) revert Paused();
+        _;
+    }
+
+    constructor(
+        address owner_,
+        address collateralToken_,
+        address debtToken_,
+        address oracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleDelay_
+    ) {
+        uint8 collateralDecimals = IERC20Metadata(collateralToken_).decimals();
+        uint8 debtDecimals = IERC20Metadata(debtToken_).decimals();
+        if (owner_ == address(0) || oracle_ == address(0) || collateralDecimals > 18 || debtDecimals > 18) {
+            revert InvalidConfiguration();
+        }
+
+        owner = owner_;
+        collateralToken = IERC20(collateralToken_);
+        debtToken = IERC20(debtToken_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleDelay = maxOracleDelay_;
+        collateralScale = 10 ** uint256(collateralDecimals);
+        debtScale = 10 ** uint256(debtDecimals);
+        lastAccrualTime = block.timestamp;
+    }
+
+    function setPaused(bool paused_) external onlyOwner {
+        paused = paused_;
+        emit PausedSet(paused_);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert InvalidConfiguration();
+        emit OwnerUpdated(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function supplyLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquiditySupplied(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(address to, uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        address(address(collateralToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position)) revert PositionUnhealthy();
+
+        address(address(collateralToken)).safeTransfer(to, amount);
+        emit CollateralWithdrawn(msg.sender, to, amount);
+    }
+
+    function borrow(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount == 0) revert BorrowTooLarge();
+
+        uint256 newDebtShares = _debtToShares(amount);
+        if (newDebtShares == 0) revert BorrowTooLarge();
+
+        position.debtShares += newDebtShares;
+        totalDebtShares += newDebtShares;
+        if (!_fitsMaxBorrow(position)) revert BorrowTooLarge();
+
+        uint256 availableLiquidity = debtToken.balanceOf(address(this));
+        if (availableLiquidity < amount) revert InsufficientLiquidity();
+
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit Borrowed(msg.sender, to, amount);
+    }
+
+    function repay(uint256 amount, address forUser) external returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[forUser];
+        if (position.debtShares == 0) revert NoDebt();
+
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        if (amount >= debtAmount) {
+            actualRepaid = debtAmount;
+            totalDebtShares -= position.debtShares;
+            position.debtShares = 0;
+        } else {
+            uint256 sharesToBurn = amount * WAD / borrowIndex;
+            if (sharesToBurn == 0) revert RepayTooSmall();
+            position.debtShares -= sharesToBurn;
+            totalDebtShares -= sharesToBurn;
+            actualRepaid = _sharesToDebt(sharesToBurn);
+        }
+
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        emit Repaid(msg.sender, forUser, actualRepaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount, address to)
+        external
+        whenNotPaused
+        returns (uint256 actualRepaid, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[user];
+        if (position.debtShares == 0) revert NoDebt();
+        if (_isHealthy(position)) revert PositionHealthy();
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPrices();
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        uint256 maxRepayByCollateral = _maxRepayFromCollateral(position.collateralAmount, collateralPrice, debtPrice);
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayByCollateral) actualRepaid = maxRepayByCollateral;
+        if (actualRepaid == 0) revert LiquidationTooLarge();
+
+        seizedCollateral = _quoteCollateralForDebt(actualRepaid, collateralPrice, debtPrice);
+        if (seizedCollateral == 0 || seizedCollateral > position.collateralAmount) revert LiquidationTooLarge();
+
+        uint256 sharesToBurn = actualRepaid >= debtAmount ? position.debtShares : actualRepaid * WAD / borrowIndex;
+        if (sharesToBurn == 0) revert LiquidationTooLarge();
+
+        position.debtShares -= sharesToBurn;
+        totalDebtShares -= sharesToBurn;
+        position.collateralAmount -= seizedCollateral;
+
+        actualRepaid = sharesToBurn == 0 ? 0 : _sharesToDebt(sharesToBurn);
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        address(address(collateralToken)).safeTransfer(to, seizedCollateral);
+
+        emit Liquidated(msg.sender, user, actualRepaid, seizedCollateral);
+    }
+
+    function debtOf(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        return _sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex());
+    }
+
+    function collateralValueUsd(address user) external view returns (uint256) {
+        (uint256 collateralPrice,) = oracle.getPrice(address(collateralToken));
+        return _toUsdValue(positions[user].collateralAmount, collateralPrice, collateralScale);
+    }
+
+    function debtValueUsd(address user) external view returns (uint256) {
+        uint256 debtAmount = _sharesToDebtAtIndex(positions[user].debtShares, _previewBorrowIndex());
+        (, uint256 debtPrice) = _freshPricesView();
+        return _toUsdValue(debtAmount, debtPrice, debtScale);
+    }
+
+    function healthFactorWad(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.debtShares == 0) return type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        if (debtUsd == 0) return type(uint256).max;
+
+        return collateralUsd * LIQUIDATION_LTV_BPS * WAD / (debtUsd * BPS);
+    }
+
+    function currentLtvBps(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.collateralAmount == 0) return position.debtShares == 0 ? 0 : type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        if (collateralUsd == 0) return type(uint256).max;
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        return debtUsd * BPS / collateralUsd;
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        borrowIndex = borrowIndex * factor / WAD;
+        lastAccrualTime = block.timestamp;
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        return borrowIndex * factor / WAD;
+    }
+
+    function _debtToShares(uint256 debtAmount) internal view returns (uint256) {
+        return debtAmount * WAD / borrowIndex;
+    }
+
+    function _sharesToDebt(uint256 shares) internal view returns (uint256) {
+        return shares * borrowIndex / WAD;
+    }
+
+    function _sharesToDebtAtIndex(uint256 shares, uint256 index) internal pure returns (uint256) {
+        return shares * index / WAD;
+    }
+
+    function _fitsMaxBorrow(Position storage position) internal view returns (bool) {
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * MAX_BORROW_LTV_BPS;
+    }
+
+    function _isHealthy(Position storage position) internal view returns (bool) {
+        if (position.debtShares == 0) return true;
+        if (position.collateralAmount == 0) return false;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * LIQUIDATION_LTV_BPS;
+    }
+
+    function _freshPrices() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        (collateralPrice, debtPrice) = _freshPricesView();
+    }
+
+    function _freshPricesView() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        uint256 collateralUpdatedAt;
+        uint256 debtUpdatedAt;
+        (collateralPrice, collateralUpdatedAt) = oracle.getPrice(address(collateralToken));
+        (debtPrice, debtUpdatedAt) = oracle.getPrice(address(debtToken));
+        if (block.timestamp - collateralUpdatedAt > maxOracleDelay || block.timestamp - debtUpdatedAt > maxOracleDelay) {
+            revert OraclePriceStale();
+        }
+    }
+
+    function _toUsdValue(uint256 amount, uint256 priceE18, uint256 tokenScale) internal pure returns (uint256) {
+        return amount * priceE18 / tokenScale;
+    }
+
+    function _quoteCollateralForDebt(uint256 debtAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return debtAmount * debtPrice * LIQUIDATION_BONUS_BPS * collateralScale
+            / (collateralPrice * debtScale * BPS);
+    }
+
+    function _maxRepayFromCollateral(uint256 collateralAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return collateralAmount * collateralPrice * debtScale * BPS
+            / (collateralScale * debtPrice * LIQUIDATION_BONUS_BPS);
+    }
+}
diff --git a/src/ChainlinkPriceOracle.sol b/src/ChainlinkPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..529aaa3fa56a502f5f652e148a52d9adbfb0a12d
--- /dev/null
+++ b/src/ChainlinkPriceOracle.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkPriceOracle is IPriceOracle {
+    error UnsupportedToken();
+    error InvalidPrice();
+
+    struct FeedConfig {
+        AggregatorV3Interface feed;
+        uint256 scale;
+    }
+
+    address public immutable weth;
+    address public immutable usdc;
+
+    FeedConfig internal wethConfig;
+    FeedConfig internal usdcConfig;
+
+    constructor(address weth_, address wethUsdFeed_, address usdc_, address usdcUsdFeed_) {
+        weth = weth_;
+        usdc = usdc_;
+        wethConfig = FeedConfig({
+            feed: AggregatorV3Interface(wethUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(wethUsdFeed_).decimals())
+        });
+        usdcConfig = FeedConfig({
+            feed: AggregatorV3Interface(usdcUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(usdcUsdFeed_).decimals())
+        });
+    }
+
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt) {
+        FeedConfig memory config;
+        if (token == weth) {
+            config = wethConfig;
+        } else if (token == usdc) {
+            config = usdcConfig;
+        } else {
+            revert UnsupportedToken();
+        }
+
+        (, int256 answer,, uint256 feedUpdatedAt,) = config.feed.latestRoundData();
+        if (answer <= 0 || feedUpdatedAt == 0) {
+            revert InvalidPrice();
+        }
+
+        priceE18 = uint256(answer) * 1e18 / config.scale;
+        updatedAt = feedUpdatedAt;
+    }
+}
+
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1f03d9a3ffef36ca7d291d7f8fc16830ade1dc92
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
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
index 0000000000000000000000000000000000000000..b43bf83b6c7bd9779d175214aeb3b0bd879ec0f7
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..39f790bd54daa4425adb01fe54ab4cb0026b5a61
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,9 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4bc303cc968cb590b01751e2fd7704e1c0a15a5f
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IPriceOracle {
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f3d11f8406a7c9889ab9874b6984e582a1f41a1
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = token.call(
+            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount)
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

codex
Built a minimal Foundry project for the borrowing market and verified it compiles with `forge build`.

The core implementation is in [BorrowingMarket.sol](/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/BorrowingMarket.sol), with a separate [ChainlinkPriceOracle.sol](/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/ChainlinkPriceOracle.sol) adapter and small local interfaces/libs so the project has no external dependency requirement. The market supports WETH collateral, USDC borrowing, 70% max borrow LTV, flat annual interest via a global borrow index, partial repayments, health-checked withdrawals, and partial liquidations with a 5% WETH bonus once a position exceeds 85% LTV.

I also added [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/foundry.toml) and wrote the operator guide in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/NOTES.md), covering health computation, liquidation flow, and mainnet deployment concerns.

Verification: `forge build` succeeded. I did not add runtime tests in this pass.
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..0620c3e57453ed02b57feef4caba905ebde13b37
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/out
+/cache
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..374ce541a04c9ac5bb69f599767ca93ae5441c7a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,56 @@
+# Borrowing Market Notes
+
+## Position health
+
+The market tracks one collateral asset (`WETH`) and one debt asset (`USDC`).
+
+- Collateral value in USD:
+  `collateralUsd = collateralAmount * wethPrice / 1e18`
+- Debt value in USD:
+  `debtUsd = debtAmount * usdcPrice / 1e6`
+- Borrow limit:
+  a user may only borrow or withdraw while `debtUsd <= collateralUsd * 70%`
+- Liquidation threshold:
+  a position becomes liquidatable once `debtUsd > collateralUsd * 85%`
+- Health factor:
+  the contract exposes `healthFactorWad`, where values above `1e18` are healthy at the liquidation threshold and values below `1e18` are liquidatable
+
+Debt grows through a single global borrow index:
+
+- `borrowIndex` starts at `1e18`
+- on each state-changing debt action it accrues by simple interest:
+  `borrowIndex = borrowIndex * (1e18 + annualRate * dt / 365 days) / 1e18`
+- a user stores debt shares, and live debt is:
+  `debt = debtShares * borrowIndex / 1e18`
+
+## Liquidation flow
+
+To liquidate an unhealthy position, a liquidator must:
+
+1. Read the target position and confirm the position is above the 85% liquidation LTV.
+2. Approve the market contract to pull `USDC`.
+3. Call `liquidate(user, repayAmount, to)`.
+
+The contract will:
+
+- pull up to the requested `USDC` amount, capped by the user’s live debt and by how much debt the remaining collateral can cover
+- burn the matching debt shares
+- transfer seized `WETH` to `to`
+
+Seized collateral is priced from the oracle and includes a 5% bonus:
+
+`seizedWeth = repayUsdcValue / wethPrice * 1.05`
+
+Because the liquidation is partial, a single liquidation does not need to make the position healthy again.
+
+## Mainnet deployment/operator concerns
+
+- Deploy with canonical Ethereum mainnet addresses for `WETH`, `USDC`, and Chainlink USD feeds.
+- Set `annualInterestRateWad` explicitly. Example: `0.05e18` means 5% APR with simple accrual on the borrow index.
+- Set `maxOracleDelay` conservatively so stale feeds halt borrowing, withdrawing, and liquidation rather than using bad prices.
+- Prefund the market with enough `USDC` liquidity before enabling borrowing. The contract only lends what it already holds.
+- Monitor oracle freshness continuously. If feeds are stale or returning bad answers, pause the market and leave deposit/repay paths operational in your runbook.
+- Run or outsource a liquidation bot. Positions can drift above 85% from price moves or accrued interest.
+- Fund and secure the owner key carefully. The owner can pause borrow-side actions and can move idle `USDC` liquidity.
+- Review token assumptions before deployment. This implementation expects standard ERC-20 behavior and uses token decimals from the deployed assets.
+- Test the exact mainnet feed addresses and staleness settings in a fork before deploying.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dd7ec858f0f54a6a424a6c7101a888522675bf16
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..780c52d5f127a547d8607a4a2ec4ab14a33b82b5
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,346 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract BorrowingMarket {
+    using SafeTransferLib for address;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+
+    error Unauthorized();
+    error Paused();
+    error ZeroAmount();
+    error InvalidConfiguration();
+    error OraclePriceStale();
+    error PositionUnhealthy();
+    error PositionHealthy();
+    error BorrowTooLarge();
+    error InsufficientLiquidity();
+    error WithdrawTooLarge();
+    error RepayTooSmall();
+    error LiquidationTooLarge();
+    error NoDebt();
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    IERC20 public immutable collateralToken;
+    IERC20 public immutable debtToken;
+    IPriceOracle public immutable oracle;
+    address public owner;
+    bool public paused;
+
+    uint256 public immutable collateralScale;
+    uint256 public immutable debtScale;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleDelay;
+
+    uint256 public borrowIndex = WAD;
+    uint256 public lastAccrualTime;
+    uint256 public totalDebtShares;
+
+    mapping(address => Position) public positions;
+
+    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
+    event PausedSet(bool paused);
+    event LiquiditySupplied(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, address indexed to, uint256 amount);
+    event Borrowed(address indexed user, address indexed to, uint256 amount);
+    event Repaid(address indexed payer, address indexed user, uint256 amount);
+    event Liquidated(address indexed liquidator, address indexed user, uint256 repaidDebt, uint256 seizedCollateral);
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier whenNotPaused() {
+        if (paused) revert Paused();
+        _;
+    }
+
+    constructor(
+        address owner_,
+        address collateralToken_,
+        address debtToken_,
+        address oracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleDelay_
+    ) {
+        uint8 collateralDecimals = IERC20Metadata(collateralToken_).decimals();
+        uint8 debtDecimals = IERC20Metadata(debtToken_).decimals();
+        if (owner_ == address(0) || oracle_ == address(0) || collateralDecimals > 18 || debtDecimals > 18) {
+            revert InvalidConfiguration();
+        }
+
+        owner = owner_;
+        collateralToken = IERC20(collateralToken_);
+        debtToken = IERC20(debtToken_);
+        oracle = IPriceOracle(oracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleDelay = maxOracleDelay_;
+        collateralScale = 10 ** uint256(collateralDecimals);
+        debtScale = 10 ** uint256(debtDecimals);
+        lastAccrualTime = block.timestamp;
+    }
+
+    function setPaused(bool paused_) external onlyOwner {
+        paused = paused_;
+        emit PausedSet(paused_);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert InvalidConfiguration();
+        emit OwnerUpdated(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function supplyLiquidity(uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquiditySupplied(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(address to, uint256 amount) external onlyOwner {
+        if (amount == 0) revert ZeroAmount();
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+        address(address(collateralToken)).safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position)) revert PositionUnhealthy();
+
+        address(address(collateralToken)).safeTransfer(to, amount);
+        emit CollateralWithdrawn(msg.sender, to, amount);
+    }
+
+    function borrow(uint256 amount, address to) external whenNotPaused {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (position.collateralAmount == 0) revert BorrowTooLarge();
+
+        uint256 newDebtShares = _debtToShares(amount);
+        if (newDebtShares == 0) revert BorrowTooLarge();
+
+        position.debtShares += newDebtShares;
+        totalDebtShares += newDebtShares;
+        if (!_fitsMaxBorrow(position)) revert BorrowTooLarge();
+
+        uint256 availableLiquidity = debtToken.balanceOf(address(this));
+        if (availableLiquidity < amount) revert InsufficientLiquidity();
+
+        address(address(debtToken)).safeTransfer(to, amount);
+        emit Borrowed(msg.sender, to, amount);
+    }
+
+    function repay(uint256 amount, address forUser) external returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[forUser];
+        if (position.debtShares == 0) revert NoDebt();
+
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        if (amount >= debtAmount) {
+            actualRepaid = debtAmount;
+            totalDebtShares -= position.debtShares;
+            position.debtShares = 0;
+        } else {
+            uint256 sharesToBurn = amount * WAD / borrowIndex;
+            if (sharesToBurn == 0) revert RepayTooSmall();
+            position.debtShares -= sharesToBurn;
+            totalDebtShares -= sharesToBurn;
+            actualRepaid = _sharesToDebt(sharesToBurn);
+        }
+
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        emit Repaid(msg.sender, forUser, actualRepaid);
+    }
+
+    function liquidate(address user, uint256 requestedRepayAmount, address to)
+        external
+        whenNotPaused
+        returns (uint256 actualRepaid, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        _accrueInterest();
+
+        Position storage position = positions[user];
+        if (position.debtShares == 0) revert NoDebt();
+        if (_isHealthy(position)) revert PositionHealthy();
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPrices();
+        uint256 debtAmount = _sharesToDebt(position.debtShares);
+        uint256 maxRepayByCollateral = _maxRepayFromCollateral(position.collateralAmount, collateralPrice, debtPrice);
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayByCollateral) actualRepaid = maxRepayByCollateral;
+        if (actualRepaid == 0) revert LiquidationTooLarge();
+
+        seizedCollateral = _quoteCollateralForDebt(actualRepaid, collateralPrice, debtPrice);
+        if (seizedCollateral == 0 || seizedCollateral > position.collateralAmount) revert LiquidationTooLarge();
+
+        uint256 sharesToBurn = actualRepaid >= debtAmount ? position.debtShares : actualRepaid * WAD / borrowIndex;
+        if (sharesToBurn == 0) revert LiquidationTooLarge();
+
+        position.debtShares -= sharesToBurn;
+        totalDebtShares -= sharesToBurn;
+        position.collateralAmount -= seizedCollateral;
+
+        actualRepaid = sharesToBurn == 0 ? 0 : _sharesToDebt(sharesToBurn);
+        address(address(debtToken)).safeTransferFrom(msg.sender, address(this), actualRepaid);
+        address(address(collateralToken)).safeTransfer(to, seizedCollateral);
+
+        emit Liquidated(msg.sender, user, actualRepaid, seizedCollateral);
+    }
+
+    function debtOf(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        return _sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex());
+    }
+
+    function collateralValueUsd(address user) external view returns (uint256) {
+        (uint256 collateralPrice,) = oracle.getPrice(address(collateralToken));
+        return _toUsdValue(positions[user].collateralAmount, collateralPrice, collateralScale);
+    }
+
+    function debtValueUsd(address user) external view returns (uint256) {
+        uint256 debtAmount = _sharesToDebtAtIndex(positions[user].debtShares, _previewBorrowIndex());
+        (, uint256 debtPrice) = _freshPricesView();
+        return _toUsdValue(debtAmount, debtPrice, debtScale);
+    }
+
+    function healthFactorWad(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.debtShares == 0) return type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        if (debtUsd == 0) return type(uint256).max;
+
+        return collateralUsd * LIQUIDATION_LTV_BPS * WAD / (debtUsd * BPS);
+    }
+
+    function currentLtvBps(address user) external view returns (uint256) {
+        Position storage position = positions[user];
+        if (position.collateralAmount == 0) return position.debtShares == 0 ? 0 : type(uint256).max;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        if (collateralUsd == 0) return type(uint256).max;
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, _previewBorrowIndex()), debtPrice, debtScale);
+        return debtUsd * BPS / collateralUsd;
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return;
+
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        borrowIndex = borrowIndex * factor / WAD;
+        lastAccrualTime = block.timestamp;
+    }
+
+    function _previewBorrowIndex() internal view returns (uint256) {
+        uint256 elapsed = block.timestamp - lastAccrualTime;
+        if (elapsed == 0) return borrowIndex;
+        uint256 factor = WAD + (annualInterestRateWad * elapsed / YEAR);
+        return borrowIndex * factor / WAD;
+    }
+
+    function _debtToShares(uint256 debtAmount) internal view returns (uint256) {
+        return debtAmount * WAD / borrowIndex;
+    }
+
+    function _sharesToDebt(uint256 shares) internal view returns (uint256) {
+        return shares * borrowIndex / WAD;
+    }
+
+    function _sharesToDebtAtIndex(uint256 shares, uint256 index) internal pure returns (uint256) {
+        return shares * index / WAD;
+    }
+
+    function _fitsMaxBorrow(Position storage position) internal view returns (bool) {
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * MAX_BORROW_LTV_BPS;
+    }
+
+    function _isHealthy(Position storage position) internal view returns (bool) {
+        if (position.debtShares == 0) return true;
+        if (position.collateralAmount == 0) return false;
+
+        (uint256 collateralPrice, uint256 debtPrice) = _freshPricesView();
+        uint256 collateralUsd = _toUsdValue(position.collateralAmount, collateralPrice, collateralScale);
+        uint256 debtUsd = _toUsdValue(_sharesToDebtAtIndex(position.debtShares, borrowIndex), debtPrice, debtScale);
+        return debtUsd * BPS <= collateralUsd * LIQUIDATION_LTV_BPS;
+    }
+
+    function _freshPrices() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        (collateralPrice, debtPrice) = _freshPricesView();
+    }
+
+    function _freshPricesView() internal view returns (uint256 collateralPrice, uint256 debtPrice) {
+        uint256 collateralUpdatedAt;
+        uint256 debtUpdatedAt;
+        (collateralPrice, collateralUpdatedAt) = oracle.getPrice(address(collateralToken));
+        (debtPrice, debtUpdatedAt) = oracle.getPrice(address(debtToken));
+        if (block.timestamp - collateralUpdatedAt > maxOracleDelay || block.timestamp - debtUpdatedAt > maxOracleDelay) {
+            revert OraclePriceStale();
+        }
+    }
+
+    function _toUsdValue(uint256 amount, uint256 priceE18, uint256 tokenScale) internal pure returns (uint256) {
+        return amount * priceE18 / tokenScale;
+    }
+
+    function _quoteCollateralForDebt(uint256 debtAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return debtAmount * debtPrice * LIQUIDATION_BONUS_BPS * collateralScale
+            / (collateralPrice * debtScale * BPS);
+    }
+
+    function _maxRepayFromCollateral(uint256 collateralAmount, uint256 collateralPrice, uint256 debtPrice)
+        internal
+        view
+        returns (uint256)
+    {
+        return collateralAmount * collateralPrice * debtScale * BPS
+            / (collateralScale * debtPrice * LIQUIDATION_BONUS_BPS);
+    }
+}
diff --git a/src/ChainlinkPriceOracle.sol b/src/ChainlinkPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..529aaa3fa56a502f5f652e148a52d9adbfb0a12d
--- /dev/null
+++ b/src/ChainlinkPriceOracle.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
+
+contract ChainlinkPriceOracle is IPriceOracle {
+    error UnsupportedToken();
+    error InvalidPrice();
+
+    struct FeedConfig {
+        AggregatorV3Interface feed;
+        uint256 scale;
+    }
+
+    address public immutable weth;
+    address public immutable usdc;
+
+    FeedConfig internal wethConfig;
+    FeedConfig internal usdcConfig;
+
+    constructor(address weth_, address wethUsdFeed_, address usdc_, address usdcUsdFeed_) {
+        weth = weth_;
+        usdc = usdc_;
+        wethConfig = FeedConfig({
+            feed: AggregatorV3Interface(wethUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(wethUsdFeed_).decimals())
+        });
+        usdcConfig = FeedConfig({
+            feed: AggregatorV3Interface(usdcUsdFeed_),
+            scale: 10 ** uint256(AggregatorV3Interface(usdcUsdFeed_).decimals())
+        });
+    }
+
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt) {
+        FeedConfig memory config;
+        if (token == weth) {
+            config = wethConfig;
+        } else if (token == usdc) {
+            config = usdcConfig;
+        } else {
+            revert UnsupportedToken();
+        }
+
+        (, int256 answer,, uint256 feedUpdatedAt,) = config.feed.latestRoundData();
+        if (answer <= 0 || feedUpdatedAt == 0) {
+            revert InvalidPrice();
+        }
+
+        priceE18 = uint256(answer) * 1e18 / config.scale;
+        updatedAt = feedUpdatedAt;
+    }
+}
+
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1f03d9a3ffef36ca7d291d7f8fc16830ade1dc92
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
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
index 0000000000000000000000000000000000000000..b43bf83b6c7bd9779d175214aeb3b0bd879ec0f7
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..39f790bd54daa4425adb01fe54ab4cb0026b5a61
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,9 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/interfaces/IPriceOracle.sol b/src/interfaces/IPriceOracle.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4bc303cc968cb590b01751e2fd7704e1c0a15a5f
--- /dev/null
+++ b/src/interfaces/IPriceOracle.sol
@@ -0,0 +1,7 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IPriceOracle {
+    function getPrice(address token) external view returns (uint256 priceE18, uint256 updatedAt);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f3d11f8406a7c9889ab9874b6984e582a1f41a1
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = token.call(
+            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount)
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

tokens used
40,996
```

## final message

Built a minimal Foundry project for the borrowing market and verified it compiles with `forge build`.

The core implementation is in [BorrowingMarket.sol](/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/BorrowingMarket.sol), with a separate [ChainlinkPriceOracle.sol](/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/src/ChainlinkPriceOracle.sol) adapter and small local interfaces/libs so the project has no external dependency requirement. The market supports WETH collateral, USDC borrowing, 70% max borrow LTV, flat annual interest via a global borrow index, partial repayments, health-checked withdrawals, and partial liquidations with a 5% WETH bonus once a position exceeds 85% LTV.

I also added [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/foundry.toml) and wrote the operator guide in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211613Z-codex-no-skill-3/security-goal-002/NOTES.md), covering health computation, liquidation flow, and mainnet deployment concerns.

Verification: `forge build` succeeded. I did not add runtime tests in this pass.

# Executor transcript — 2026-09-04T125946Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06c81-47e8-7093-b4f6-c993fc2c1836
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
Using the `security` skill for this turn because the task is a collateralized borrowing market that custodies assets, accounts for debt, and supports liquidation. I’ll read that guidance first, then inspect the workspace and build the Foundry project in place.
exec
/bin/bash -lc "sed -n '1,220p' .agents/skills/security/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 10ms:
---
name: security
description: Use when designing, implementing, or reviewing Solidity contracts that custody assets, account for shares or debt, consume price oracles, verify signatures, integrate ERC-20s, or use upgradeable proxies; also use for a pre-deployment security review. Not for test-suite design (`testing`) or a full multi-domain audit (`audit`).
---

# Smart Contract Security

Treat every external token, price, signature, callback, and privileged caller as adversarial. Prefer audited OpenZeppelin primitives over hand-rolled implementations, but verify the installed library version and the assumptions around each primitive.

## Asset accounting

- Keep units explicit. ERC-20 decimals and oracle decimals vary; normalize every quantity to one documented scale before comparing collateral, debt, fees, or shares. Multiply before dividing and use full-precision `mulDiv` where intermediate overflow or rounding matters.
- For arbitrary ERC-20s, use `SafeERC20.safeTransfer` and `safeTransferFrom`. Credit deposits from the contract's balance delta, not the requested amount, or reject tokens whose received amount differs. Fee-on-transfer and rebasing tokens otherwise break custody accounting.
- On OpenZeppelin Contracts v5, use `SafeERC20.forceApprove` when an allowance may already be nonzero. `safeApprove` was removed. Keep approvals exact or bounded and clear leftovers when practical.
- Apply checks-effects-interactions and a reentrancy guard to value-moving entry points. Update shares, debt, and other accounting before external calls.

For a vault or receipt-token design, start from OpenZeppelin `ERC4626`. A hand-rolled vault must defend its empty state against first-depositor donation/inflation attacks with virtual assets and shares or another explicit mitigation. Test direct donations and rounding at small deposits; never use an unprotected `assets * totalSupply / totalAssets` conversion with a special 1:1 empty-vault path.

## Prices and liquidations

Never use a DEX spot read (`slot0`, reserves, balances, or a current quote) for collateral, borrowing, minting, or liquidation decisions. Pool depth does not fix atomic manipulation: flash-borrowed capital can move the price, exploit the dependent action, unwind, and repay inside one transaction before arbitrage can intervene.

Use a manipulation-resistant push feed for high-value decisions, or a meaningful TWAP when its weaker guarantees fit the risk. For every feed:

- require a positive answer;
- validate `updatedAt` against a per-feed maximum age derived from that feed's published heartbeat plus a justified margin—never one global hardcoded timeout;
- handle feed and token decimals explicitly;
- define behavior for sequencer downtime where relevant; and
- bound liquidation incentives and any swap's minimum output.

## Signatures and replay protection

Use EIP-712 and OpenZeppelin's implementation rather than assembling signature recovery from scratch. Bind the signed action to the intended contract and chain, consume a signer-scoped nonce, enforce a deadline, and update replay state before moving assets.

If a domain separator is cached, also cache the deployment chain id and re-derive the separator whenever `block.chainid` differs. An immutable separator computed only at deployment becomes stale after a fork. OpenZeppelin `EIP712` handles this invalidation.

## Upgradeability and authority

Use an upgradeable design only when post-deployment changes are required. With proxies:

- initialize through an initializer and disable initializers on the implementation;
- use the upgradeable variants of inherited contracts;
- preserve inheritance order and storage layout—append variables only; never insert, delete, reorder, or change an existing type;
- run the framework's storage-layout compatibility check before every upgrade; and
- put upgrade and emergency authority behind the intended multisig or timelock, not a single EOA.

Every privileged state change needs explicit access control. Make pause, upgrade, rescue, oracle-update, and parameter-update powers visible in the threat model; a safety switch controlled by one key is also a censorship and compromise risk. Never `delegatecall` to a user-selected target.

## Before deployment

- Trace assets, shares, debt, approvals, callbacks, and privilege through every success and failure path.
- Test zero, maximum, rounding, donation, fee-on-transfer, stale-price, replay, reentrancy, and unauthorized-caller cases that apply.
- Run unit, fuzz, invariant, and pinned-fork tests appropriate to the integrations; use the `testing` skill for suite design.
- Run static analysis and resolve every high or medium finding or document why it is a false positive.
- Verify deployed bytecode and transfer production authority to the intended multisig or timelock.
- For a comprehensive pre-deployment review across domains, use the `audit` skill.

exec
/bin/bash -lc "rg --files -g '*'" in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 23ms:
.git/hooks/applypatch-msg.sample
.git/hooks/pre-applypatch.sample
.git/hooks/sendemail-validate.sample
.git/hooks/pre-merge-commit.sample
.git/hooks/pre-push.sample
.git/hooks/post-update.sample
.git/hooks/pre-commit.sample
.git/hooks/push-to-checkout.sample
.git/hooks/update.sample
.git/hooks/pre-rebase.sample
.git/hooks/prepare-commit-msg.sample
.git/hooks/fsmonitor-watchman.sample
.git/hooks/commit-msg.sample
.git/hooks/pre-receive.sample
.git/HEAD
.git/objects/f3/9a2b0d0a9eca3c6414a572c9dc48b4de91f9a9
.agents/skills/security/SKILL.md
.git/objects/6a/b7be6d792fb2b3c8bbbacba6bbed5ae934c265
package.json
TASK.md
.git/COMMIT_EDITMSG
.git/config
.git/objects/eb/67e41b36afec5ac624cf77124100066438dee0
.git/info/exclude
.git/objects/19/39e19bfbdca3d2820c637fc1d4af1ef118abad
.git/refs/heads/main
.git/logs/HEAD
.git/objects/89/88b52a8e6b2d2f794a5ac773630ef157abb672
.git/objects/a2/cd1bd1a7343b9e30996288f08b245f859462e9
.git/index
.git/description
.git/logs/refs/heads/main
.git/objects/9f/931de89fcf3c321439b2c827faf3b89fcf3ea8
.git/objects/84/bd7eb516f8cd66ab5b66a01fc9663967a26dcd

codex
The workspace is essentially empty aside from the task file, so I’m building this from scratch. Next I’m reading the local task notes and checking whether Foundry is already available so I can scaffold the project correctly.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 0ms:
exec
/bin/bash -lc "sed -n '1,220p' package.json" in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 9ms:
{
  "name": "eval-workspace",
  "private": true
}

exec
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 0ms:
codex
I have enough context to implement this cleanly. I’m going to set up a minimal Foundry project with OpenZeppelin, build a single market contract around WETH/USDC plus a Chainlink-style ETH/USD feed, then add operator notes focused on pricing, health checks, liquidation flow, and mainnet deployment assumptions.
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

codex
I’m starting the project setup now. This will add Foundry config and dependencies first, then I’ll write the market contract and notes on top of that scaffold.
exec
/bin/bash -lc 'forge init --force --no-git . && forge install OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git && forge install smartcontractkit/chainlink-brownie-contracts@1.3.0 --no-git' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
codex
The dependency install is in progress. Once it finishes I’ll inspect the generated files and replace the template contract/tests with the borrowing market implementation.
 succeeded in 23002ms:
    Installed forge-std
    Initialized forge project
Installing openzeppelin-contracts in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: v5.4.0)
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/lib/openzeppelin-contracts'...
Submodule 'lib/erc4626-tests' (https://github.com/a16z/erc4626-tests.git) registered for path 'lib/erc4626-tests'
Submodule 'lib/forge-std' (https://github.com/foundry-rs/forge-std) registered for path 'lib/forge-std'
Submodule 'lib/halmos-cheatcodes' (https://github.com/a16z/halmos-cheatcodes) registered for path 'lib/halmos-cheatcodes'
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/lib/openzeppelin-contracts/lib/erc4626-tests'...
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/lib/openzeppelin-contracts/lib/forge-std'...
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/lib/openzeppelin-contracts/lib/halmos-cheatcodes'...
    Installed openzeppelin-contracts v5.4.0
Installing chainlink-brownie-contracts in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/lib/chainlink-brownie-contracts (url: https://github.com/smartcontractkit/chainlink-brownie-contracts, tag: 1.3.0)
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/lib/chainlink-brownie-contracts'...
    Installed chainlink-brownie-contracts 1.3.0

exec
/bin/bash -lc "sed -n '1,220p' foundry.toml" in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
exec
/bin/bash -lc 'rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 15ms:
[profile.default]
src = "src"
out = "out"
libs = ["lib"]

# See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options

 succeeded in 20ms:
foundry.toml
TASK.md
package.json
README.md
test/Counter.t.sol
script/Counter.s.sol
src/Counter.sol

exec
/bin/bash -lc "sed -n '1,220p' src/Counter.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 14ms:
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Counter {
    uint256 public number;

    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    function increment() public {
        number++;
    }
}

exec
/bin/bash -lc "sed -n '1,220p' test/Counter.t.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 1ms:
codex
I’m at the code-writing stage. The main contract will be a single-market ledger with per-account collateral/debt, linear interest accrual, staleness-checked oracle reads, owner-managed USDC liquidity, and partial liquidations that seize WETH at a 5% discount to the liquidator.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/src/Counter.sol
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}

diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}

apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/script/Counter.s.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/script/DeployBorrowingMarket.s.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/src/BorrowingMarket.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/test/BorrowingMarket.t.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/test/Counter.t.sol
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..42f3a7632a62f2c903230b81ff420b3f68c0edf9
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(owner, weth, usdc, ethUsdOracle, annualInterestBps, maxOracleAge);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e98158fc8e874fbb3692449a976df9d6004318f
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,301 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86ed3c13103f9f90eb566a066036ed4806b5c17c
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,171 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _decimals;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _decimals = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _decimals;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable override decimals;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        decimals = decimals_;
+        setAnswer(answer_);
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 0.525e18);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 700e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 647_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..42f3a7632a62f2c903230b81ff420b3f68c0edf9
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(owner, weth, usdc, ethUsdOracle, annualInterestBps, maxOracleAge);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e98158fc8e874fbb3692449a976df9d6004318f
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,301 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86ed3c13103f9f90eb566a066036ed4806b5c17c
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,171 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _decimals;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _decimals = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _decimals;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable override decimals;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        decimals = decimals_;
+        setAnswer(answer_);
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 0.525e18);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 700e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 647_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
The core contract, deploy script, and a small test suite are in place. I’m compiling now to catch interface, remapping, or arithmetic issues before I write the operator notes.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 exited 1 in 618ms:
Compiling 38 files with Solc 0.8.33
Solc 0.8.33 finished in 554.02ms
Error: Compiler run failed:
Error (9553): Invalid type for argument in function call. Invalid implicit conversion from address to contract IERC20 requested.
  --> script/DeployBorrowingMarket.s.sol:17:45:
   |
17 |         market = new BorrowingMarket(owner, weth, usdc, ethUsdOracle, annualInterestBps, maxOracleAge);
   |                                             ^^^^

Error (9553): Invalid type for argument in function call. Invalid implicit conversion from address to contract IERC20 requested.
  --> script/DeployBorrowingMarket.s.sol:17:51:
   |
17 |         market = new BorrowingMarket(owner, weth, usdc, ethUsdOracle, annualInterestBps, maxOracleAge);
   |                                                   ^^^^

Error (9553): Invalid type for argument in function call. Invalid implicit conversion from address to contract AggregatorV3Interface requested.
  --> script/DeployBorrowingMarket.s.sol:17:57:
   |
17 |         market = new BorrowingMarket(owner, weth, usdc, ethUsdOracle, annualInterestBps, maxOracleAge);
   |                                                         ^^^^^^^^^^^^

diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..42f3a7632a62f2c903230b81ff420b3f68c0edf9
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(owner, weth, usdc, ethUsdOracle, annualInterestBps, maxOracleAge);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e98158fc8e874fbb3692449a976df9d6004318f
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,301 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86ed3c13103f9f90eb566a066036ed4806b5c17c
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,171 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _decimals;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _decimals = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _decimals;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable override decimals;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        decimals = decimals_;
+        setAnswer(answer_);
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 0.525e18);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 700e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 647_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
The first build surfaced a straightforward deploy-script type issue, not a market-logic issue. I’m fixing the constructor argument casts now, then I’ll rebuild and add `NOTES.md` once compilation is clean.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/script/DeployBorrowingMarket.s.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e98158fc8e874fbb3692449a976df9d6004318f
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,301 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86ed3c13103f9f90eb566a066036ed4806b5c17c
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,171 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _decimals;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _decimals = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _decimals;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable override decimals;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        decimals = decimals_;
+        setAnswer(answer_);
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 0.525e18);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 700e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 647_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e98158fc8e874fbb3692449a976df9d6004318f
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,301 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86ed3c13103f9f90eb566a066036ed4806b5c17c
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,171 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _decimals;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _decimals = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _decimals;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable override decimals;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        decimals = decimals_;
+        setAnswer(answer_);
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 0.525e18);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 700e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 647_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 826ms:
Compiling 38 files with Solc 0.8.33
Solc 0.8.33 finished in 739.52ms
Compiler run successful!
2026-09-04T13:04:08.666706Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> test/BorrowingMarket.t.sol:9:29
  |
9 |     uint8 private immutable _decimals;
  |                             ^^^^^^^^^ help: consider using: `_DECIMALS`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:38:29
   |
38 |     IERC20 public immutable weth;
   |                             ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:39:29
   |
39 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:40:28
   |
40 |     uint8 public immutable usdcDecimals;
   |                            ^^^^^^^^^^^^ help: consider using: `USDC_DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:41:44
   |
41 |     AggregatorV3Interface public immutable ethUsdOracle;
   |                                            ^^^^^^^^^^^^ help: consider using: `ETH_USD_ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:42:28
   |
42 |     uint8 public immutable oracleDecimals;
   |                            ^^^^^^^^^^^^^^ help: consider using: `ORACLE_DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:43:30
   |
43 |     uint256 public immutable annualInterestBps;
   |                              ^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_BPS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:44:30
   |
44 |     uint256 public immutable maxOracleAge;
   |                              ^^^^^^^^^^^^ help: consider using: `MAX_ORACLE_AGE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> test/BorrowingMarket.t.sol:25:37
   |
25 |     uint8 public immutable override decimals;
   |                                     ^^^^^^^^ help: consider using: `DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> test/BorrowingMarket.t.sol:70:36
   |
70 |         oracle = new MockOracle(8, int256(STARTING_PRICE));
   |                                    ^^^^^^^^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'int256' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/BorrowingMarket.sol:299:16
    |
299 |         return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
    |                ^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint256' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e98158fc8e874fbb3692449a976df9d6004318f
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,301 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86ed3c13103f9f90eb566a066036ed4806b5c17c
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,171 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _decimals;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _decimals = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _decimals;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable override decimals;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        decimals = decimals_;
+        setAnswer(answer_);
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 0.525e18);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 700e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 647_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
`forge build` is clean now. I’m running the tests as a sanity pass on the borrow, accrual, withdrawal, and liquidation paths, then I’ll close with the main files and outcomes.
exec
/bin/bash -lc 'forge test' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 exited 1 in 105ms:
No files changed, compilation skipped
2026-09-04T13:04:20.643403Z  WARN evm::traces::external: etherscan config not found

Ran 7 tests for test/BorrowingMarket.t.sol:BorrowingMarketTest
[PASS] testBorrowWithinLimit() (gas: 176366)
[PASS] testCannotBorrowAboveLimit() (gas: 115854)
[PASS] testInterestAccruesLinearly() (gas: 174073)
[FAIL: BorrowLimitExceeded(1600000000 [1.6e9], 1400000000 [1.4e9])] testLiquidationCapsRepayByRemainingCollateral() (gas: 117931)
[FAIL: BorrowLimitExceeded(1600000000 [1.6e9], 1400000000 [1.4e9])] testLiquidationRepaysDebtAndSeizesBonusCollateral() (gas: 117951)
[FAIL: panic: arithmetic underflow or overflow (0x11)] testStaleOracleBlocksBorrowHealthActions() (gas: 103928)
[PASS] testWithdrawRequiresHealthyPosition() (gas: 180939)
Suite result: FAILED. 4 passed; 3 failed; 0 skipped; finished in 1.43ms (2.38ms CPU time)

Ran 1 test suite in 8.64ms (1.43ms CPU time): 4 tests passed, 3 failed, 0 skipped (7 total tests)

Failing tests:
Encountered 3 failing tests in test/BorrowingMarket.t.sol:BorrowingMarketTest
[FAIL: BorrowLimitExceeded(1600000000 [1.6e9], 1400000000 [1.4e9])] testLiquidationCapsRepayByRemainingCollateral() (gas: 117931)
[FAIL: BorrowLimitExceeded(1600000000 [1.6e9], 1400000000 [1.4e9])] testLiquidationRepaysDebtAndSeizesBonusCollateral() (gas: 117951)
[FAIL: panic: arithmetic underflow or overflow (0x11)] testStaleOracleBlocksBorrowHealthActions() (gas: 103928)

Encountered a total of 3 failing tests, 4 tests succeeded

Tip: Run `forge test --rerun` to retry only the 3 failed tests

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e98158fc8e874fbb3692449a976df9d6004318f
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,301 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86ed3c13103f9f90eb566a066036ed4806b5c17c
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,171 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _decimals;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _decimals = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _decimals;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable override decimals;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        decimals = decimals_;
+        setAnswer(answer_);
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 0.525e18);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 700e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_600e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 647_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
The failures are in the tests, plus one missing oracle timestamp guard that showed up under Foundry’s default start time. I’m tightening that oracle check and rewriting the liquidation scenarios so they start from a borrow that is actually allowed and only become liquidatable after a price move.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/src/BorrowingMarket.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/test/BorrowingMarket.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..23f09df9dcf5c07d428eb7e8a68614deaab09b98
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,304 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9e80d1884700037ae34f7a8bf9a20f98a55ffa6c
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,178 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _DECIMALS;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _DECIMALS = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable override DECIMALS;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        DECIMALS = decimals_;
+        setAnswer(answer_);
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 1_181_250_000_000_000_000);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 500e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 447_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);
+
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..23f09df9dcf5c07d428eb7e8a68614deaab09b98
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,304 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9e80d1884700037ae34f7a8bf9a20f98a55ffa6c
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,178 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _DECIMALS;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _DECIMALS = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable override DECIMALS;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        DECIMALS = decimals_;
+        setAnswer(answer_);
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 1_181_250_000_000_000_000);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 500e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 447_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);
+
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

exec
/bin/bash -lc 'forge test' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 exited 1 in 558ms:
Compiling 2 files with Solc 0.8.33
Solc 0.8.33 finished in 473.63ms
Error: Compiler run failed:
Error (7792): Public state variable has override specified but does not override anything.
  --> test/BorrowingMarket.t.sol:25:28:
   |
25 |     uint8 public immutable override DECIMALS;
   |                            ^^^^^^^^

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..23f09df9dcf5c07d428eb7e8a68614deaab09b98
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,304 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9e80d1884700037ae34f7a8bf9a20f98a55ffa6c
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,178 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _DECIMALS;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _DECIMALS = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable override DECIMALS;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        DECIMALS = decimals_;
+        setAnswer(answer_);
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 1_181_250_000_000_000_000);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 500e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 447_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);
+
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
There’s one compile-only test artifact left: an incorrect `override` on a mock variable. I’m removing that and rerunning the suite.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/test/BorrowingMarket.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..23f09df9dcf5c07d428eb7e8a68614deaab09b98
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,304 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cad0ccf69fc6f25b4640d9bfcda20cccd699be0
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,178 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _DECIMALS;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _DECIMALS = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable DECIMALS;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        DECIMALS = decimals_;
+        setAnswer(answer_);
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 1_181_250_000_000_000_000);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 500e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 447_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);
+
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..23f09df9dcf5c07d428eb7e8a68614deaab09b98
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,304 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cad0ccf69fc6f25b4640d9bfcda20cccd699be0
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,178 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _DECIMALS;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _DECIMALS = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable DECIMALS;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        DECIMALS = decimals_;
+        setAnswer(answer_);
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 1_181_250_000_000_000_000);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 500e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 447_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);
+
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

exec
/bin/bash -lc 'forge test && forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 exited 1 in 776ms:
Compiling 2 files with Solc 0.8.33
Solc 0.8.33 finished in 661.11ms
Compiler run successful!
2026-09-04T13:05:09.251571Z  WARN evm::traces::external: etherscan config not found

Ran 7 tests for test/BorrowingMarket.t.sol:BorrowingMarketTest
[PASS] testBorrowWithinLimit() (gas: 176369)
[PASS] testCannotBorrowAboveLimit() (gas: 115857)
[PASS] testInterestAccruesLinearly() (gas: 174076)
[PASS] testLiquidationCapsRepayByRemainingCollateral() (gas: 233095)
[PASS] testLiquidationRepaysDebtAndSeizesBonusCollateral() (gas: 239195)
[FAIL: Error != expected error: OraclePriceStale(2, 86400 [8.64e4]) != custom error 0xc4373f02] testStaleOracleBlocksBorrowHealthActions() (gas: 124999)
[PASS] testWithdrawRequiresHealthyPosition() (gas: 180945)
Suite result: FAILED. 6 passed; 1 failed; 0 skipped; finished in 1.29ms (1.96ms CPU time)

Ran 1 test suite in 10.53ms (1.29ms CPU time): 6 tests passed, 1 failed, 0 skipped (7 total tests)

Failing tests:
Encountered 1 failing test in test/BorrowingMarket.t.sol:BorrowingMarketTest
[FAIL: Error != expected error: OraclePriceStale(2, 86400 [8.64e4]) != custom error 0xc4373f02] testStaleOracleBlocksBorrowHealthActions() (gas: 124999)

Encountered a total of 1 failing tests, 6 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..23f09df9dcf5c07d428eb7e8a68614deaab09b98
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,304 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cad0ccf69fc6f25b4640d9bfcda20cccd699be0
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,178 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _DECIMALS;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _DECIMALS = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable DECIMALS;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        DECIMALS = decimals_;
+        setAnswer(answer_);
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 1_181_250_000_000_000_000);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 500e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 447_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);
+
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(BorrowingMarket.OraclePriceStale.selector);
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
The remaining failure is just the exact custom-error payload in the stale-oracle test. I’m matching the full encoded error and then rerunning both `forge test` and `forge build`.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/test/BorrowingMarket.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..23f09df9dcf5c07d428eb7e8a68614deaab09b98
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,304 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ca87b187a65afc10ba1ce45c5c040fa091092345
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _DECIMALS;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _DECIMALS = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable DECIMALS;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        DECIMALS = decimals_;
+        setAnswer(answer_);
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 1_181_250_000_000_000_000);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 500e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 447_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);
+
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(
+            abi.encodeWithSelector(BorrowingMarket.OraclePriceStale.selector, block.timestamp - ORACLE_MAX_AGE - 1, ORACLE_MAX_AGE)
+        );
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..23f09df9dcf5c07d428eb7e8a68614deaab09b98
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,304 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ca87b187a65afc10ba1ce45c5c040fa091092345
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _DECIMALS;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _DECIMALS = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable DECIMALS;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        DECIMALS = decimals_;
+        setAnswer(answer_);
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 1_181_250_000_000_000_000);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 500e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 447_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);
+
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(
+            abi.encodeWithSelector(BorrowingMarket.OraclePriceStale.selector, block.timestamp - ORACLE_MAX_AGE - 1, ORACLE_MAX_AGE)
+        );
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

exec
/bin/bash -lc 'forge test' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 836ms:
Compiling 1 files with Solc 0.8.33
Solc 0.8.33 finished in 687.77ms
Compiler run successful!
2026-09-04T13:05:23.167691Z  WARN evm::traces::external: etherscan config not found

Ran 7 tests for test/BorrowingMarket.t.sol:BorrowingMarketTest
[PASS] testBorrowWithinLimit() (gas: 176369)
[PASS] testCannotBorrowAboveLimit() (gas: 115857)
[PASS] testInterestAccruesLinearly() (gas: 174076)
[PASS] testLiquidationCapsRepayByRemainingCollateral() (gas: 233095)
[PASS] testLiquidationRepaysDebtAndSeizesBonusCollateral() (gas: 239195)
[PASS] testStaleOracleBlocksBorrowHealthActions() (gas: 123173)
[PASS] testWithdrawRequiresHealthyPosition() (gas: 180945)
Suite result: ok. 7 passed; 0 failed; 0 skipped; finished in 1.35ms (2.03ms CPU time)

Ran 1 test suite in 15.28ms (1.35ms CPU time): 7 tests passed, 0 failed, 0 skipped (7 total tests)
2026-09-04T13:05:23.186843Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

 succeeded in 815ms:
Compiling 2 files with Solc 0.8.33
Solc 0.8.33 finished in 695.24ms
Compiler run successful!
2026-09-04T13:05:23.211977Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:38:29
   |
38 |     IERC20 public immutable weth;
   |                             ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:39:29
   |
39 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:40:28
   |
40 |     uint8 public immutable usdcDecimals;
   |                            ^^^^^^^^^^^^ help: consider using: `USDC_DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:41:44
   |
41 |     AggregatorV3Interface public immutable ethUsdOracle;
   |                                            ^^^^^^^^^^^^ help: consider using: `ETH_USD_ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:42:28
   |
42 |     uint8 public immutable oracleDecimals;
   |                            ^^^^^^^^^^^^^^ help: consider using: `ORACLE_DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:43:30
   |
43 |     uint256 public immutable annualInterestBps;
   |                              ^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_BPS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/BorrowingMarket.sol:44:30
   |
44 |     uint256 public immutable maxOracleAge;
   |                              ^^^^^^^^^^^^ help: consider using: `MAX_ORACLE_AGE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..23f09df9dcf5c07d428eb7e8a68614deaab09b98
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,304 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ca87b187a65afc10ba1ce45c5c040fa091092345
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _DECIMALS;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _DECIMALS = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable DECIMALS;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        DECIMALS = decimals_;
+        setAnswer(answer_);
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 1_181_250_000_000_000_000);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 500e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 447_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);
+
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(
+            abi.encodeWithSelector(BorrowingMarket.OraclePriceStale.selector, block.timestamp - ORACLE_MAX_AGE - 1, ORACLE_MAX_AGE)
+        );
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
The implementation is complete and verified. I’m doing one last pass over the changed files so I can give you a tight summary with the key paths and the only notable caveat from the local environment.
exec
/bin/bash -lc "nl -ba src/BorrowingMarket.sol | sed -n '1,260p'" in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
exec
/bin/bash -lc "nl -ba script/DeployBorrowingMarket.s.sol | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 20ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.24;
     3	
     4	import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
     5	import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
     6	import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
     7	import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
     8	import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
     9	import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
    10	
    11	interface AggregatorV3Interface {
    12	    function decimals() external view returns (uint8);
    13	
    14	    function latestRoundData()
    15	        external
    16	        view
    17	        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    18	}
    19	
    20	contract BorrowingMarket is Ownable, ReentrancyGuard {
    21	    using Math for uint256;
    22	    using SafeERC20 for IERC20;
    23	
    24	    uint256 public constant BPS = 10_000;
    25	    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
    26	    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    27	    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
    28	    uint256 public constant SECONDS_PER_YEAR = 365 days;
    29	    uint256 internal constant PRICE_SCALE = 1e18;
    30	    uint256 internal constant USDC_SCALE = 1e6;
    31	
    32	    struct Position {
    33	        uint256 collateralAmount;
    34	        uint256 debtPrincipal;
    35	        uint256 lastAccrued;
    36	    }
    37	
    38	    IERC20 public immutable weth;
    39	    IERC20 public immutable usdc;
    40	    uint8 public immutable usdcDecimals;
    41	    AggregatorV3Interface public immutable ethUsdOracle;
    42	    uint8 public immutable oracleDecimals;
    43	    uint256 public immutable annualInterestBps;
    44	    uint256 public immutable maxOracleAge;
    45	
    46	    mapping(address account => Position) public positions;
    47	
    48	    event CollateralDeposited(address indexed account, uint256 amount);
    49	    event CollateralWithdrawn(address indexed account, uint256 amount);
    50	    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
    51	    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
    52	    event Liquidated(
    53	        address indexed liquidator,
    54	        address indexed account,
    55	        uint256 repaidDebt,
    56	        uint256 seizedCollateral,
    57	        uint256 remainingDebt
    58	    );
    59	    event LiquidityAdded(address indexed provider, uint256 amount);
    60	    event LiquidityRemoved(address indexed recipient, uint256 amount);
    61	
    62	    error ZeroAmount();
    63	    error UnsupportedUsdcDecimals(uint8 decimals_);
    64	    error OracleDecimalsTooLarge(uint8 decimals_);
    65	    error OraclePriceInvalid();
    66	    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
    67	    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
    68	    error PositionHealthy();
    69	    error PositionUnhealthy();
    70	    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
    71	    error InsufficientLiquidity(uint256 requested, uint256 available);
    72	    error InsufficientCollateral(uint256 requested, uint256 available);
    73	    error NoDebt();
    74	    error NothingToLiquidate();
    75	
    76	    constructor(
    77	        address initialOwner,
    78	        IERC20 weth_,
    79	        IERC20 usdc_,
    80	        AggregatorV3Interface ethUsdOracle_,
    81	        uint256 annualInterestBps_,
    82	        uint256 maxOracleAge_
    83	    ) Ownable(initialOwner) {
    84	        weth = weth_;
    85	        usdc = usdc_;
    86	        ethUsdOracle = ethUsdOracle_;
    87	        annualInterestBps = annualInterestBps_;
    88	        maxOracleAge = maxOracleAge_;
    89	
    90	        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
    91	        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
    92	        usdcDecimals = decimals_;
    93	
    94	        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
    95	        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
    96	        oracleDecimals = oracleDecimals_;
    97	    }
    98	
    99	    function depositCollateral(uint256 amount) external nonReentrant {
   100	        if (amount == 0) revert ZeroAmount();
   101	
   102	        Position storage position = positions[msg.sender];
   103	        _accrue(position);
   104	        position.collateralAmount += amount;
   105	
   106	        weth.safeTransferFrom(msg.sender, address(this), amount);
   107	        emit CollateralDeposited(msg.sender, amount);
   108	    }
   109	
   110	    function withdrawCollateral(uint256 amount) external nonReentrant {
   111	        if (amount == 0) revert ZeroAmount();
   112	
   113	        Position storage position = positions[msg.sender];
   114	        _accrue(position);
   115	
   116	        uint256 collateralAmount = position.collateralAmount;
   117	        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
   118	
   119	        position.collateralAmount = collateralAmount - amount;
   120	        _ensureBorrowHealthy(position);
   121	
   122	        weth.safeTransfer(msg.sender, amount);
   123	        emit CollateralWithdrawn(msg.sender, amount);
   124	    }
   125	
   126	    function borrow(uint256 amount) external nonReentrant {
   127	        if (amount == 0) revert ZeroAmount();
   128	
   129	        Position storage position = positions[msg.sender];
   130	        _accrue(position);
   131	
   132	        uint256 newDebt = position.debtPrincipal + amount;
   133	        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
   134	        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
   135	
   136	        uint256 available = usdc.balanceOf(address(this));
   137	        if (amount > available) revert InsufficientLiquidity(amount, available);
   138	
   139	        position.debtPrincipal = newDebt;
   140	        position.lastAccrued = block.timestamp;
   141	
   142	        usdc.safeTransfer(msg.sender, amount);
   143	        emit Borrowed(msg.sender, amount, newDebt);
   144	    }
   145	
   146	    function repay(uint256 amount) external returns (uint256 repaidAmount) {
   147	        repaidAmount = _repay(msg.sender, msg.sender, amount);
   148	    }
   149	
   150	    function repayFor(address account, uint256 amount) external returns (uint256 repaidAmount) {
   151	        repaidAmount = _repay(msg.sender, account, amount);
   152	    }
   153	
   154	    function liquidate(address account, uint256 requestedRepayAmount)
   155	        external
   156	        nonReentrant
   157	        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
   158	    {
   159	        if (requestedRepayAmount == 0) revert ZeroAmount();
   160	
   161	        Position storage position = positions[account];
   162	        _accrue(position);
   163	
   164	        uint256 debt = position.debtPrincipal;
   165	        if (debt == 0) revert NoDebt();
   166	
   167	        uint256 price = _ethPrice();
   168	        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
   169	
   170	        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
   171	        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
   172	
   173	        actualRepayAmount = requestedRepayAmount;
   174	        if (actualRepayAmount > debt) {
   175	            actualRepayAmount = debt;
   176	        }
   177	        if (actualRepayAmount > maxRepayFromCollateral) {
   178	            actualRepayAmount = maxRepayFromCollateral;
   179	        }
   180	        if (actualRepayAmount == 0) revert NothingToLiquidate();
   181	
   182	        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
   183	        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
   184	
   185	        position.debtPrincipal = debt - actualRepayAmount;
   186	        position.collateralAmount -= seizedCollateral;
   187	        position.lastAccrued = block.timestamp;
   188	
   189	        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
   190	        weth.safeTransfer(msg.sender, seizedCollateral);
   191	
   192	        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
   193	    }
   194	
   195	    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
   196	        if (amount == 0) revert ZeroAmount();
   197	
   198	        usdc.safeTransferFrom(msg.sender, address(this), amount);
   199	        emit LiquidityAdded(msg.sender, amount);
   200	    }
   201	
   202	    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
   203	        if (amount == 0) revert ZeroAmount();
   204	
   205	        uint256 available = usdc.balanceOf(address(this));
   206	        if (amount > available) revert InsufficientLiquidity(amount, available);
   207	
   208	        usdc.safeTransfer(recipient, amount);
   209	        emit LiquidityRemoved(recipient, amount);
   210	    }
   211	
   212	    function previewDebt(address account) external view returns (uint256) {
   213	        return _accruedDebt(positions[account]);
   214	    }
   215	
   216	    function currentLtvBps(address account) external view returns (uint256) {
   217	        Position memory position = positions[account];
   218	        if (position.debtPrincipal == 0) return 0;
   219	
   220	        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
   221	        if (collateralValue == 0) return type(uint256).max;
   222	
   223	        return _accruedDebt(position).mulDiv(BPS, collateralValue);
   224	    }
   225	
   226	    function maxBorrowable(address account) external view returns (uint256) {
   227	        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
   228	    }
   229	
   230	    function isLiquidatable(address account) external view returns (bool) {
   231	        Position memory position = positions[account];
   232	        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
   233	    }
   234	
   235	    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
   236	        if (amount == 0) revert ZeroAmount();
   237	
   238	        Position storage position = positions[account];
   239	        _accrue(position);
   240	
   241	        uint256 debt = position.debtPrincipal;
   242	        if (debt == 0) revert NoDebt();
   243	
   244	        repaidAmount = amount > debt ? debt : amount;
   245	        position.debtPrincipal = debt - repaidAmount;
   246	        position.lastAccrued = block.timestamp;
   247	
   248	        usdc.safeTransferFrom(payer, address(this), repaidAmount);
   249	        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
   250	    }
   251	
   252	    function _accrue(Position storage position) internal {
   253	        uint256 debt = _accruedDebt(position);
   254	        position.debtPrincipal = debt;
   255	        position.lastAccrued = block.timestamp;
   256	    }
   257	
   258	    function _accruedDebt(Position memory position) internal view returns (uint256) {
   259	        uint256 principal = position.debtPrincipal;
   260	        if (principal == 0) return 0;

 succeeded in 17ms:
?? NOTES.md
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

 succeeded in 17ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.24;
     3	
     4	import {Script} from "forge-std/Script.sol";
     5	import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
     6	import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
     7	
     8	contract DeployBorrowingMarket is Script {
     9	    function run() external returns (BorrowingMarket market) {
    10	        address owner = vm.envAddress("OWNER");
    11	        address weth = vm.envAddress("WETH");
    12	        address usdc = vm.envAddress("USDC");
    13	        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
    14	        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
    15	        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
    16	
    17	        vm.startBroadcast();
    18	        market = new BorrowingMarket(
    19	            owner,
    20	            IERC20(weth),
    21	            IERC20(usdc),
    22	            AggregatorV3Interface(ethUsdOracle),
    23	            annualInterestBps,
    24	            maxOracleAge
    25	        );
    26	        vm.stopBroadcast();
    27	    }
    28	}

exec
/bin/bash -lc "nl -ba NOTES.md | sed -n '1,260p'" in /home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002
 succeeded in 8ms:
     1	# Borrowing Market Notes
     2	
     3	## Position health
     4	
     5	Each account has one position with:
     6	
     7	- `collateralAmount`: WETH with 18 decimals.
     8	- `debtPrincipal`: USDC debt with 6 decimals.
     9	- `lastAccrued`: timestamp used to linearly accrue interest.
    10	
    11	Debt grows linearly:
    12	
    13	```text
    14	currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
    15	```
    16	
    17	The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
    18	
    19	```text
    20	collateralValueInUsdc = collateralAmount * ethPrice / 1e30
    21	```
    22	
    23	That produces a 6-decimal USD value, matching USDC units.
    24	
    25	Health rules:
    26	
    27	- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
    28	- A position is liquidatable when `debt / collateralValue > 85%`.
    29	- If collateral value is zero while debt remains, the position is immediately liquidatable.
    30	
    31	Important edge behavior:
    32	
    33	- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
    34	- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
    35	
    36	## Liquidation flow
    37	
    38	To liquidate:
    39	
    40	1. Call `isLiquidatable(account)` or compute the LTV off-chain.
    41	2. Approve the market to pull USDC from the liquidator.
    42	3. Call `liquidate(account, requestedRepayAmount)`.
    43	
    44	The contract:
    45	
    46	- accrues the borrower’s debt,
    47	- checks that the position is above the 85% liquidation threshold,
    48	- repays up to the smallest of:
    49	  - the liquidator’s requested amount,
    50	  - the borrower’s total debt,
    51	  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
    52	- transfers that USDC from the liquidator to the market, and
    53	- transfers the liquidator the matching WETH plus the 5% bonus.
    54	
    55	Seized collateral is:
    56	
    57	```text
    58	baseCollateral = repaidUsdc * 1e30 / ethPrice
    59	seizedCollateral = baseCollateral * 10_500 / 10_000
    60	```
    61	
    62	If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
    63	
    64	## Mainnet deployment and operations
    65	
    66	The contract expects:
    67	
    68	- mainnet WETH as collateral,
    69	- mainnet USDC as the debt asset, and
    70	- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
    71	
    72	An operator deploying this on Ethereum mainnet needs to get these right:
    73	
    74	- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
    75	- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
    76	- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
    77	- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
    78	- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
    79	- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
    80	- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
    81	- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
    82	
    83	Recommended pre-deployment checks:
    84	
    85	- Verify USDC really uses 6 decimals on the target network.
    86	- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
    87	- Dry-run liquidation math against extreme prices and long periods of accrued interest.
    88	- Run static analysis and a mainnet-fork test pass before shipping value through it.

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..23f09df9dcf5c07d428eb7e8a68614deaab09b98
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,304 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ca87b187a65afc10ba1ce45c5c040fa091092345
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _DECIMALS;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _DECIMALS = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable DECIMALS;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        DECIMALS = decimals_;
+        setAnswer(answer_);
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 1_181_250_000_000_000_000);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 500e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 447_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);
+
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(
+            abi.encodeWithSelector(BorrowingMarket.OraclePriceStale.selector, block.timestamp - ORACLE_MAX_AGE - 1, ORACLE_MAX_AGE)
+        );
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
Implemented a minimal Foundry borrowing market in [src/BorrowingMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/src/BorrowingMarket.sol:20). It supports WETH collateral, USDC borrowing up to 70% LTV, flat linear annual interest accrual, healthy-only collateral withdrawals, and partial liquidations above 85% LTV with a 5% WETH bonus to the liquidator. I also added an owner-funded liquidity path and a deploy script in [script/DeployBorrowingMarket.s.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/script/DeployBorrowingMarket.s.sol:8).

Deployment and operating notes are in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/NOTES.md:1), including the health formula, liquidation steps, and the mainnet-specific assumptions an operator needs to get right. I also added a small test suite in [test/BorrowingMarket.t.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/test/BorrowingMarket.t.sol:48).

Verification: `forge build` passes and `forge test` passes with 7/7 tests.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9b4f5a3bced2840fba4dd875e0def923053b55d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,88 @@
+# Borrowing Market Notes
+
+## Position health
+
+Each account has one position with:
+
+- `collateralAmount`: WETH with 18 decimals.
+- `debtPrincipal`: USDC debt with 6 decimals.
+- `lastAccrued`: timestamp used to linearly accrue interest.
+
+Debt grows linearly:
+
+```text
+currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
+```
+
+The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:
+
+```text
+collateralValueInUsdc = collateralAmount * ethPrice / 1e30
+```
+
+That produces a 6-decimal USD value, matching USDC units.
+
+Health rules:
+
+- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
+- A position is liquidatable when `debt / collateralValue > 85%`.
+- If collateral value is zero while debt remains, the position is immediately liquidatable.
+
+Important edge behavior:
+
+- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
+- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.
+
+## Liquidation flow
+
+To liquidate:
+
+1. Call `isLiquidatable(account)` or compute the LTV off-chain.
+2. Approve the market to pull USDC from the liquidator.
+3. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- accrues the borrower’s debt,
+- checks that the position is above the 85% liquidation threshold,
+- repays up to the smallest of:
+  - the liquidator’s requested amount,
+  - the borrower’s total debt,
+  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
+- transfers that USDC from the liquidator to the market, and
+- transfers the liquidator the matching WETH plus the 5% bonus.
+
+Seized collateral is:
+
+```text
+baseCollateral = repaidUsdc * 1e30 / ethPrice
+seizedCollateral = baseCollateral * 10_500 / 10_000
+```
+
+If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.
+
+## Mainnet deployment and operations
+
+The contract expects:
+
+- mainnet WETH as collateral,
+- mainnet USDC as the debt asset, and
+- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.
+
+An operator deploying this on Ethereum mainnet needs to get these right:
+
+- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
+- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
+- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
+- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
+- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
+- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
+- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
+- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.
+
+Recommended pre-deployment checks:
+
+- Verify USDC really uses 6 decimals on the target network.
+- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
+- Dry-run liquidation math against extreme prices and long periods of accrued interest.
+- Run static analysis and a mainnet-fork test pass before shipping value through it.
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/script/DeployBorrowingMarket.s.sol b/script/DeployBorrowingMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b23fae6cb861f693d4a9b7c667d66ac1263cd5bb
--- /dev/null
+++ b/script/DeployBorrowingMarket.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";
+
+contract DeployBorrowingMarket is Script {
+    function run() external returns (BorrowingMarket market) {
+        address owner = vm.envAddress("OWNER");
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new BorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            AggregatorV3Interface(ethUsdOracle),
+            annualInterestBps,
+            maxOracleAge
+        );
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/BorrowingMarket.sol b/src/BorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..23f09df9dcf5c07d428eb7e8a68614deaab09b98
--- /dev/null
+++ b/src/BorrowingMarket.sol
@@ -0,0 +1,304 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+interface AggregatorV3Interface {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
+}
+
+contract BorrowingMarket is Ownable, ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
+    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant SECONDS_PER_YEAR = 365 days;
+    uint256 internal constant PRICE_SCALE = 1e18;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtPrincipal;
+        uint256 lastAccrued;
+    }
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    uint8 public immutable usdcDecimals;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleAge;
+
+    mapping(address account => Position) public positions;
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidDebt,
+        uint256 seizedCollateral,
+        uint256 remainingDebt
+    );
+    event LiquidityAdded(address indexed provider, uint256 amount);
+    event LiquidityRemoved(address indexed recipient, uint256 amount);
+
+    error ZeroAmount();
+    error UnsupportedUsdcDecimals(uint8 decimals_);
+    error OracleDecimalsTooLarge(uint8 decimals_);
+    error OraclePriceInvalid();
+    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
+    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
+    error PositionHealthy();
+    error PositionUnhealthy();
+    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
+    error InsufficientLiquidity(uint256 requested, uint256 available);
+    error InsufficientCollateral(uint256 requested, uint256 available);
+    error NoDebt();
+    error NothingToLiquidate();
+
+    constructor(
+        address initialOwner,
+        IERC20 weth_,
+        IERC20 usdc_,
+        AggregatorV3Interface ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleAge_
+    ) Ownable(initialOwner) {
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleAge = maxOracleAge_;
+
+        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
+        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
+        usdcDecimals = decimals_;
+
+        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
+        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
+        oracleDecimals = oracleDecimals_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 collateralAmount = position.collateralAmount;
+        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);
+
+        position.collateralAmount = collateralAmount - amount;
+        _ensureBorrowHealthy(position);
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrue(position);
+
+        uint256 newDebt = position.debtPrincipal + amount;
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        position.debtPrincipal = newDebt;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebt);
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
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        uint256 price = _ethPrice();
+        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
+        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);
+
+        actualRepayAmount = requestedRepayAmount;
+        if (actualRepayAmount > debt) {
+            actualRepayAmount = debt;
+        }
+        if (actualRepayAmount > maxRepayFromCollateral) {
+            actualRepayAmount = maxRepayFromCollateral;
+        }
+        if (actualRepayAmount == 0) revert NothingToLiquidate();
+
+        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
+        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);
+
+        position.debtPrincipal = debt - actualRepayAmount;
+        position.collateralAmount -= seizedCollateral;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
+    }
+
+    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityAdded(msg.sender, amount);
+    }
+
+    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        uint256 available = usdc.balanceOf(address(this));
+        if (amount > available) revert InsufficientLiquidity(amount, available);
+
+        usdc.safeTransfer(recipient, amount);
+        emit LiquidityRemoved(recipient, amount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _accruedDebt(positions[account]);
+    }
+
+    function currentLtvBps(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        if (position.debtPrincipal == 0) return 0;
+
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
+        if (collateralValue == 0) return type(uint256).max;
+
+        return _accruedDebt(position).mulDiv(BPS, collateralValue);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
+    }
+
+    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrue(position);
+
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) revert NoDebt();
+
+        repaidAmount = amount > debt ? debt : amount;
+        position.debtPrincipal = debt - repaidAmount;
+        position.lastAccrued = block.timestamp;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
+    }
+
+    function _accrue(Position storage position) internal {
+        uint256 debt = _accruedDebt(position);
+        position.debtPrincipal = debt;
+        position.lastAccrued = block.timestamp;
+    }
+
+    function _accruedDebt(Position memory position) internal view returns (uint256) {
+        uint256 principal = position.debtPrincipal;
+        if (principal == 0) return 0;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return principal;
+
+        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
+        return principal + interest;
+    }
+
+    function _ensureBorrowHealthy(Position memory position) internal view {
+        uint256 debt = position.debtPrincipal;
+        if (debt == 0) return;
+
+        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
+        if (debt > maxDebt) revert PositionUnhealthy();
+    }
+
+    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
+        if (debt == 0) return false;
+
+        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
+        if (collateralValue == 0) return true;
+
+        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
+        return collateralAmount.mulDiv(price, 1e30);
+    }
+
+    function _ethPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert OraclePriceInvalid();
+        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
+        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
+    }
+}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/test/BorrowingMarket.t.sol b/test/BorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ca87b187a65afc10ba1ce45c5c040fa091092345
--- /dev/null
+++ b/test/BorrowingMarket.t.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";
+
+contract MockERC20 is ERC20 {
+    uint8 private immutable _DECIMALS;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
+        _DECIMALS = decimals_;
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract MockOracle is AggregatorV3Interface {
+    uint8 public immutable DECIMALS;
+    int256 public answer;
+    uint256 public updatedAt;
+
+    constructor(uint8 decimals_, int256 answer_) {
+        DECIMALS = decimals_;
+        setAnswer(answer_);
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function setAnswer(int256 newAnswer) public {
+        answer = newAnswer;
+        updatedAt = block.timestamp;
+    }
+
+    function setUpdatedAt(uint256 newUpdatedAt) external {
+        updatedAt = newUpdatedAt;
+    }
+
+    function latestRoundData()
+        external
+        view
+        override
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, answer, updatedAt, updatedAt, 0);
+    }
+}
+
+contract BorrowingMarketTest is Test {
+    uint256 internal constant STARTING_PRICE = 2_000e8;
+    uint256 internal constant RATE_BPS = 500;
+    uint256 internal constant ORACLE_MAX_AGE = 1 days;
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockOracle internal oracle;
+    BorrowingMarket internal market;
+
+    address internal borrower = address(0xB0);
+    address internal liquidator = address(0x1A);
+    address internal owner = address(this);
+
+    function setUp() public {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockOracle(8, int256(STARTING_PRICE));
+        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);
+
+        weth.mint(borrower, 10e18);
+        usdc.mint(owner, 1_000_000e6);
+        usdc.mint(liquidator, 1_000_000e6);
+
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        weth.approve(address(market), type(uint256).max);
+        vm.prank(borrower);
+        usdc.approve(address(market), type(uint256).max);
+        vm.prank(liquidator);
+        usdc.approve(address(market), type(uint256).max);
+
+        market.addLiquidity(500_000e6);
+    }
+
+    function testBorrowWithinLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        assertEq(usdc.balanceOf(borrower), 1_400e6);
+        assertEq(market.previewDebt(borrower), 1_400e6);
+    }
+
+    function testCannotBorrowAboveLimit() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        vm.expectRevert();
+        market.borrow(1_401e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccruesLinearly() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(borrower);
+        vm.stopPrank();
+
+        assertEq(debt, 1_050e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_000e6);
+        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
+        market.withdrawCollateral(0.4e18);
+        vm.stopPrank();
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(2e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(800e8);
+
+        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);
+
+        assertEq(repaid, 900e6);
+        assertEq(seized, 1_181_250_000_000_000_000);
+        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
+        assertEq(market.previewDebt(borrower), 500e6);
+    }
+
+    function testLiquidationCapsRepayByRemainingCollateral() public {
+        vm.startPrank(borrower);
+        market.depositCollateral(1e18);
+        market.borrow(1_400e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_000e8);
+
+        vm.prank(liquidator);
+        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);
+
+        assertEq(repaid, 952_380_952);
+        assertEq(seized, 999_999_999_600_000_000);
+        assertEq(market.previewDebt(borrower), 447_619_048);
+    }
+
+    function testStaleOracleBlocksBorrowHealthActions() public {
+        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);
+
+        vm.prank(borrower);
+        market.depositCollateral(1e18);
+
+        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);
+
+        vm.prank(borrower);
+        vm.expectRevert(
+            abi.encodeWithSelector(BorrowingMarket.OraclePriceStale.selector, block.timestamp - ORACLE_MAX_AGE - 1, ORACLE_MAX_AGE)
+        );
+        market.borrow(1e6);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

tokens used
50,766
````

## final message

Implemented a minimal Foundry borrowing market in [src/BorrowingMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/src/BorrowingMarket.sol:20). It supports WETH collateral, USDC borrowing up to 70% LTV, flat linear annual interest accrual, healthy-only collateral withdrawals, and partial liquidations above 85% LTV with a 5% WETH bonus to the liquidator. I also added an owner-funded liquidity path and a deploy script in [script/DeployBorrowingMarket.s.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/script/DeployBorrowingMarket.s.sol:8).

Deployment and operating notes are in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/NOTES.md:1), including the health formula, liquidation steps, and the mainnet-specific assumptions an operator needs to get right. I also added a small test suite in [test/BorrowingMarket.t.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125946Z-codex-with-skill-1/security-goal-002/test/BorrowingMarket.t.sol:48).

Verification: `forge build` passes and `forge test` passes with 7/7 tests.

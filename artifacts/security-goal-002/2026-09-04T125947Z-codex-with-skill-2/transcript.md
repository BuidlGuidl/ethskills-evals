# Executor transcript — 2026-09-04T125947Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06c81-4967-7bb3-9db2-0c7caf23f94c
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
I’m setting up the borrowing market in this workspace and will inspect the repo plus the Solidity security guidance before writing contracts.
exec
/bin/bash -lc 'pwd && rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "sed -n '1,220p' /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/.agents/skills/security/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 18ms:
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

 succeeded in 35ms:
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
TASK.md
package.json

codex
I’ve confirmed the workspace is minimal and I’m using the `security` skill because this contract will custody collateral, track debt, and depend on a price feed. Next I’m reading the task file and checking whether `forge` is available so I can scaffold the project correctly.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "sed -n '1,220p' package.json" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 6ms:
{
  "name": "eval-workspace",
  "private": true
}

 succeeded in 8ms:
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
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 9ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

codex
Plan:
1. Scaffold a Foundry project with pinned Solidity config and OpenZeppelin as the only required dependency.
2. Implement a single market contract around WETH, USDC, and a Chainlink-style ETH/USD oracle, with explicit health checks, interest accrual, and liquidation math.
3. Add deployment/operator notes and run `forge build` to verify the project compiles cleanly.
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

exec
/bin/bash -lc 'forge init --force --no-git .' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 1972ms:
    Installed forge-std
    Initialized forge project

codex
The project scaffold is being created now. Once that finishes I’ll replace the sample contract layout with the actual market implementation and tighten the Foundry config.
codex
I have the scaffold. I’m checking the generated files and then I’ll add the market contract, a minimal oracle interface, and deployment notes before building.
exec
/bin/bash -lc "sed -n '1,220p' src/Counter.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "sed -n '1,220p' foundry.toml" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc 'rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 23ms:
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

 succeeded in 26ms:
[profile.default]
src = "src"
out = "out"
libs = ["lib"]

# See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options

 succeeded in 32ms:
foundry.toml
TASK.md
test/Counter.t.sol
script/Counter.s.sol
README.md
package.json
src/Counter.sol

exec
/bin/bash -lc "sed -n '1,220p' test/Counter.t.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 3ms:
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {Counter} from "../src/Counter.sol";

contract CounterTest is Test {
    Counter public counter;

    function setUp() public {
        counter = new Counter();
        counter.setNumber(0);
    }

    function test_Increment() public {
        counter.increment();
        assertEq(counter.number(), 1);
    }

    function testFuzz_SetNumber(uint256 x) public {
        counter.setNumber(x);
        assertEq(counter.number(), x);
    }
}

codex
I’m at the edit stage now. I’m installing OpenZeppelin, replacing the sample contract with the lending market, and then I’ll remove the scaffold leftovers so the build only reflects the deployable pieces.
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts --no-commit' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 exited 2 in 4ms:
codex
`forge install` on this Foundry version doesn’t support `--no-commit`. I’m rerunning with the compatible form and then I’ll patch in the actual contract and notes.
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 exited 1 in 80ms:
Installing openzeppelin-contracts in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: None)
fatal: could not create directory '/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/.git/modules/lib/openzeppelin-contracts'
Error: git submodule exited with code 128

codex
The workspace can’t mutate `.git`, so `forge install` fails when it tries to add a submodule. I’m vendoring OpenZeppelin with a plain clone into `lib/` instead, which avoids touching git metadata.
exec
/bin/bash -lc 'mkdir -p lib && git clone --depth 1 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 2806ms:
codex
I’ve finished the design choices and I’m patching the project now: one immutable market contract, one oracle interface, a deployment script, a clean Foundry config, and operator notes.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/foundry.toml
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/script/Counter.s.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/script/DeploySimpleBorrowMarket.s.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/src/Counter.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowMarket.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/src/interfaces/AggregatorV3Interface.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/test/Counter.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..82039f071fbab799bbfdf4d2b8d37d4c5a834df1
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,293 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleAge;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        ethUsdOracle = AggregatorV3Interface(ethUsdOracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleAge = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        if (repaidUsdc == debt) {
+            seizedWeth = position.collateralAmount;
+            repaidUsdc = _repay(msg.sender, borrower, repaidUsdc);
+        } else {
+            uint256 debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+            seizedWeth = _usdcValueToWeth(repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS));
+            if (seizedWeth == 0) revert RepayTooSmall();
+            if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+            position.debtShares -= debtSharesToBurn;
+            totalDebtShares -= debtSharesToBurn;
+            position.collateralAmount -= seizedWeth;
+
+            usdc.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+            weth.safeTransfer(msg.sender, seizedWeth);
+
+            emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        }
+
+        emit Liquidated(msg.sender, borrower, repaidUsdc, 0, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            usdc.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        usdc.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();
+
+        uint8 decimals = ethUsdOracle.decimals();
+        if (decimals < 6 || decimals > 18) revert InvalidOracleConfig();
+
+        return collateralAmount.mulDiv(uint256(answer), 10 ** (18 + decimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue) internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();
+
+        uint8 decimals = ethUsdOracle.decimals();
+        if (decimals < 6 || decimals > 18) revert InvalidOracleConfig();
+
+        return usdcValue.mulDiv(10 ** (18 + decimals - 6), uint256(answer), Math.Rounding.Floor);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..82039f071fbab799bbfdf4d2b8d37d4c5a834df1
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,293 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleAge;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        ethUsdOracle = AggregatorV3Interface(ethUsdOracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleAge = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        if (repaidUsdc == debt) {
+            seizedWeth = position.collateralAmount;
+            repaidUsdc = _repay(msg.sender, borrower, repaidUsdc);
+        } else {
+            uint256 debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+            seizedWeth = _usdcValueToWeth(repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS));
+            if (seizedWeth == 0) revert RepayTooSmall();
+            if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+            position.debtShares -= debtSharesToBurn;
+            totalDebtShares -= debtSharesToBurn;
+            position.collateralAmount -= seizedWeth;
+
+            usdc.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+            weth.safeTransfer(msg.sender, seizedWeth);
+
+            emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        }
+
+        emit Liquidated(msg.sender, borrower, repaidUsdc, 0, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            usdc.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        usdc.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();
+
+        uint8 decimals = ethUsdOracle.decimals();
+        if (decimals < 6 || decimals > 18) revert InvalidOracleConfig();
+
+        return collateralAmount.mulDiv(uint256(answer), 10 ** (18 + decimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue) internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();
+
+        uint8 decimals = ethUsdOracle.decimals();
+        if (decimals < 6 || decimals > 18) revert InvalidOracleConfig();
+
+        return usdcValue.mulDiv(10 ** (18 + decimals - 6), uint256(answer), Math.Rounding.Floor);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
The first pass is in place. I’m reviewing the liquidation path and the oracle math before building, because that is the part most likely to hide protocol bugs even when the compiler is happy.
exec
/bin/bash -lc "sed -n '1,280p' src/SimpleBorrowMarket.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
exec
/bin/bash -lc "sed -n '1,220p' NOTES.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Simple Borrow Market Notes

## Position health

The contract prices WETH collateral in USDC terms from an ETH/USD oracle:

- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market

Health checks use two thresholds:

- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
- liquidation threshold: `debt > 85% of collateralValueUsdc`

That means:

- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
- a liquidator can act once the position crosses 85%

## Liquidation flow

To liquidate a position:

1. Read the borrower debt and collateral value from the contract.
2. Confirm the debt is above 85% of collateral value.
3. Approve the market to pull USDC from the liquidator.
4. Call `liquidate(borrower, maxRepayAmount)`.

The market repays up to the smaller of:

- the liquidator's requested amount
- the full borrower debt
- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus

The liquidator receives:

- WETH worth the repaid USDC amount
- plus a 5% bonus, also in WETH

## Mainnet deployment/operator requirements

- Use canonical mainnet token addresses for WETH and USDC.
- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..82039f071fbab799bbfdf4d2b8d37d4c5a834df1
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,293 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleAge;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        ethUsdOracle = AggregatorV3Interface(ethUsdOracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleAge = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        if (repaidUsdc == debt) {
+            seizedWeth = position.collateralAmount;
+            repaidUsdc = _repay(msg.sender, borrower, repaidUsdc);
+        } else {
+            uint256 debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+            seizedWeth = _usdcValueToWeth(repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS));
+            if (seizedWeth == 0) revert RepayTooSmall();
+            if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+            position.debtShares -= debtSharesToBurn;
+            totalDebtShares -= debtSharesToBurn;
+            position.collateralAmount -= seizedWeth;
+
+            usdc.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+            weth.safeTransfer(msg.sender, seizedWeth);
+
+            emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        }
+
+        emit Liquidated(msg.sender, borrower, repaidUsdc, 0, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            usdc.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        usdc.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();
+
+        uint8 decimals = ethUsdOracle.decimals();
+        if (decimals < 6 || decimals > 18) revert InvalidOracleConfig();
+
+        return collateralAmount.mulDiv(uint256(answer), 10 ** (18 + decimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue) internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();
+
+        uint8 decimals = ethUsdOracle.decimals();
+        if (decimals < 6 || decimals > 18) revert InvalidOracleConfig();
+
+        return usdcValue.mulDiv(10 ** (18 + decimals - 6), uint256(answer), Math.Rounding.Floor);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
I found one real protocol bug in the first draft: a full liquidation path could over-seize collateral. I’m correcting that now and then I’ll run `forge build` to catch any remaining integration issues.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowMarket.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ffb5013692fd1289ca65204b2be56ba740edb3e
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,307 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleAge;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        ethUsdOracle = AggregatorV3Interface(ethUsdOracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleAge = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        uint256 debtSharesToBurn;
+        if (repaidUsdc >= debt) {
+            repaidUsdc = debt;
+            debtSharesToBurn = position.debtShares;
+        } else {
+            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+        }
+
+        seizedWeth = _usdcValueToWeth(
+            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
+            oraclePrice,
+            oracleDecimals
+        );
+        if (seizedWeth == 0) revert RepayTooSmall();
+        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+        position.debtShares -= debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+        position.collateralAmount -= seizedWeth;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+        weth.safeTransfer(msg.sender, seizedWeth);
+
+        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            usdc.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        usdc.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();
+
+        oracleDecimals = ethUsdOracle.decimals();
+        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
+        oraclePrice = uint256(answer);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ffb5013692fd1289ca65204b2be56ba740edb3e
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,307 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleAge;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        ethUsdOracle = AggregatorV3Interface(ethUsdOracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleAge = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        uint256 debtSharesToBurn;
+        if (repaidUsdc >= debt) {
+            repaidUsdc = debt;
+            debtSharesToBurn = position.debtShares;
+        } else {
+            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+        }
+
+        seizedWeth = _usdcValueToWeth(
+            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
+            oraclePrice,
+            oracleDecimals
+        );
+        if (seizedWeth == 0) revert RepayTooSmall();
+        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+        position.debtShares -= debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+        position.collateralAmount -= seizedWeth;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+        weth.safeTransfer(msg.sender, seizedWeth);
+
+        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            usdc.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        usdc.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();
+
+        oracleDecimals = ethUsdOracle.decimals();
+        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
+        oraclePrice = uint256(answer);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
?? NOTES.md
?? README.md
?? foundry.toml
?? script/
?? src/

 succeeded in 830ms:
Compiling 31 files with Solc 0.8.24
Solc 0.8.24 finished in 752.35ms
Compiler run successful!
2026-09-04T13:04:23.160973Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowMarket.sol:23:29
   |
23 |     IERC20 public immutable weth;
   |                             ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowMarket.sol:24:29
   |
24 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowMarket.sol:25:44
   |
25 |     AggregatorV3Interface public immutable ethUsdOracle;
   |                                            ^^^^^^^^^^^^ help: consider using: `ETH_USD_ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowMarket.sol:26:30
   |
26 |     uint256 public immutable annualInterestRateWad;
   |                              ^^^^^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_RATE_WAD`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowMarket.sol:27:30
   |
27 |     uint256 public immutable maxOracleAge;
   |                              ^^^^^^^^^^^^ help: consider using: `MAX_ORACLE_AGE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/SimpleBorrowMarket.sol:305:23
    |
305 |         oraclePrice = uint256(answer);
    |                       ^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint256' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ffb5013692fd1289ca65204b2be56ba740edb3e
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,307 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleAge;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        ethUsdOracle = AggregatorV3Interface(ethUsdOracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleAge = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        uint256 debtSharesToBurn;
+        if (repaidUsdc >= debt) {
+            repaidUsdc = debt;
+            debtSharesToBurn = position.debtShares;
+        } else {
+            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+        }
+
+        seizedWeth = _usdcValueToWeth(
+            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
+            oraclePrice,
+            oracleDecimals
+        );
+        if (seizedWeth == 0) revert RepayTooSmall();
+        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+        position.debtShares -= debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+        position.collateralAmount -= seizedWeth;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+        weth.safeTransfer(msg.sender, seizedWeth);
+
+        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            usdc.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        usdc.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();
+
+        oracleDecimals = ethUsdOracle.decimals();
+        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
+        oraclePrice = uint256(answer);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
The build is already green. I’m doing one small cleanup pass now: removing the scaffold README and fixing the low-signal lint notes so the project is cleaner to hand off.
2026-09-04T13:04:52.573211Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowMarket.sol:
        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
        if (answer <= 0) revert InvalidOraclePrice();
        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();

        oracleDecimals = ethUsdOracle.decimals();
        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();

        oraclePrice = uint256(answer);
    }
}
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ffb5013692fd1289ca65204b2be56ba740edb3e
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,307 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleAge;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        ethUsdOracle = AggregatorV3Interface(ethUsdOracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleAge = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        uint256 debtSharesToBurn;
+        if (repaidUsdc >= debt) {
+            repaidUsdc = debt;
+            debtSharesToBurn = position.debtShares;
+        } else {
+            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+        }
+
+        seizedWeth = _usdcValueToWeth(
+            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
+            oraclePrice,
+            oracleDecimals
+        );
+        if (seizedWeth == 0) revert RepayTooSmall();
+        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+        position.debtShares -= debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+        position.collateralAmount -= seizedWeth;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+        weth.safeTransfer(msg.sender, seizedWeth);
+
+        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            usdc.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        usdc.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();
+
+        oracleDecimals = ethUsdOracle.decimals();
+        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
+        oraclePrice = uint256(answer);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
The cleanup patch partly missed because the file had shifted. I’m re-reading the current contract and applying the rename against the live contents rather than assuming the previous line layout.
exec
/bin/bash -lc "sed -n '220,360p' src/SimpleBorrowMarket.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "sed -n '1,220p' src/SimpleBorrowMarket.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 15ms:
    function _accrueInterest() internal {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;

        lastAccrualTimestamp = block.timestamp;
        if (totalDebtShares == 0 || annualInterestRateWad == 0) return;

        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
        emit InterestAccrued(borrowIndexRay, elapsed);
    }

    function _previewBorrowIndexRay() internal view returns (uint256) {
        if (totalDebtShares == 0 || annualInterestRateWad == 0) return borrowIndexRay;

        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return borrowIndexRay;

        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
    }

    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
    }

    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
    }

    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
    }

    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
    }

    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
    }

    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
        if (debtAmount == 0) return true;
        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
    }

    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
        if (collateralValueUsdc == 0) return debtAmount > 0;
        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
    }

    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
        if (debtAmount == 0) return type(uint256).max;
        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
    }

    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
    }

    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
        internal
        pure
        returns (uint256)
    {
        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
    }

    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
        internal
        pure
        returns (uint256)
    {
        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
    }

    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
        if (answer <= 0) revert InvalidOraclePrice();
        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();

        oracleDecimals = ethUsdOracle.decimals();
        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
        oraclePrice = uint256(answer);
    }
}

 succeeded in 12ms:
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

contract SimpleBorrowMarket is ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;
    uint256 public constant WAD = 1e18;
    uint256 public constant RAY = 1e27;
    uint256 public constant MAX_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable weth;
    IERC20 public immutable usdc;
    AggregatorV3Interface public immutable ethUsdOracle;
    uint256 public immutable annualInterestRateWad;
    uint256 public immutable maxOracleAge;

    uint256 public borrowIndexRay = RAY;
    uint256 public lastAccrualTimestamp;
    uint256 public totalDebtShares;

    struct Position {
        uint256 collateralAmount;
        uint256 debtShares;
    }

    mapping(address => Position) public positions;

    error ZeroAmount();
    error InvalidAddress();
    error InvalidInterestRate();
    error InvalidOracleConfig();
    error StaleOraclePrice();
    error InvalidOraclePrice();
    error PositionNotHealthy();
    error PositionNotLiquidatable();
    error RepayTooSmall();
    error WithdrawTooLarge();

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
    event Liquidated(
        address indexed liquidator,
        address indexed borrower,
        uint256 repaidUsdc,
        uint256 debtSharesBurned,
        uint256 collateralSeized
    );
    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);

    constructor(
        address weth_,
        address usdc_,
        address ethUsdOracle_,
        uint256 annualInterestRateWad_,
        uint256 maxOracleAge_
    ) {
        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
        if (maxOracleAge_ == 0) revert InvalidOracleConfig();

        weth = IERC20(weth_);
        usdc = IERC20(usdc_);
        ethUsdOracle = AggregatorV3Interface(ethUsdOracle_);
        annualInterestRateWad = annualInterestRateWad_;
        maxOracleAge = maxOracleAge_;
        lastAccrualTimestamp = block.timestamp;
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        position.collateralAmount += amount;

        weth.safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        _accrueInterest();

        Position storage position = positions[msg.sender];
        if (amount > position.collateralAmount) revert WithdrawTooLarge();

        position.collateralAmount -= amount;
        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();

        weth.safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        _accrueInterest();

        Position storage position = positions[msg.sender];
        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
        position.debtShares += mintedDebtShares;
        totalDebtShares += mintedDebtShares;

        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();

        usdc.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount, mintedDebtShares);
    }

    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
        if (amount == 0) revert ZeroAmount();

        _accrueInterest();
        return _repay(msg.sender, msg.sender, amount);
    }

    function liquidate(address borrower, uint256 maxRepayAmount)
        external
        nonReentrant
        returns (uint256 repaidUsdc, uint256 seizedWeth)
    {
        if (maxRepayAmount == 0) revert ZeroAmount();

        _accrueInterest();

        Position storage position = positions[borrower];
        uint256 debt = _debtFromSharesUp(position.debtShares);
        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);

        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();

        uint256 maxRepayFromCollateral =
            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
        if (repaidUsdc == 0) revert RepayTooSmall();

        uint256 debtSharesToBurn;
        if (repaidUsdc >= debt) {
            repaidUsdc = debt;
            debtSharesToBurn = position.debtShares;
        } else {
            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
            if (debtSharesToBurn == 0) revert RepayTooSmall();
            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
        }

        seizedWeth = _usdcValueToWeth(
            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
            oraclePrice,
            oracleDecimals
        );
        if (seizedWeth == 0) revert RepayTooSmall();
        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();

        position.debtShares -= debtSharesToBurn;
        totalDebtShares -= debtSharesToBurn;
        position.collateralAmount -= seizedWeth;

        usdc.safeTransferFrom(msg.sender, address(this), repaidUsdc);
        weth.safeTransfer(msg.sender, seizedWeth);

        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
    }

    function previewDebt(address borrower) external view returns (uint256) {
        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
    }

    function previewHealthFactorBps(address borrower) external view returns (uint256) {
        Position storage position = positions[borrower];
        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
        return _healthFactorBps(position.collateralAmount, debt);
    }

    function collateralValueInUsdc(address borrower) external view returns (uint256) {
        return _collateralValueInUsdc(positions[borrower].collateralAmount);
    }

    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
        Position storage position = positions[borrower];
        uint256 debtShares = position.debtShares;
        uint256 debt = _debtFromSharesUp(debtShares);

        if (requestedAmount >= debt) {
            actualRepaid = debt;
            position.debtShares = 0;
            totalDebtShares -= debtShares;
            usdc.safeTransferFrom(payer, address(this), actualRepaid);
            emit Repaid(payer, borrower, actualRepaid, debtShares);
            return actualRepaid;
        }

        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
        if (debtSharesToBurn == 0) revert RepayTooSmall();

        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
        position.debtShares = debtShares - debtSharesToBurn;
        totalDebtShares -= debtSharesToBurn;

        usdc.safeTransferFrom(payer, address(this), actualRepaid);
        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
    }

    function _accrueInterest() internal {

exec
/bin/bash -lc "test -f README.md && sed -n '1,120p' README.md || true" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ffb5013692fd1289ca65204b2be56ba740edb3e
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,307 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    AggregatorV3Interface public immutable ethUsdOracle;
+    uint256 public immutable annualInterestRateWad;
+    uint256 public immutable maxOracleAge;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        ethUsdOracle = AggregatorV3Interface(ethUsdOracle_);
+        annualInterestRateWad = annualInterestRateWad_;
+        maxOracleAge = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        uint256 debtSharesToBurn;
+        if (repaidUsdc >= debt) {
+            repaidUsdc = debt;
+            debtSharesToBurn = position.debtShares;
+        } else {
+            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+        }
+
+        seizedWeth = _usdcValueToWeth(
+            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
+            oraclePrice,
+            oracleDecimals
+        );
+        if (seizedWeth == 0) revert RepayTooSmall();
+        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+        position.debtShares -= debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+        position.collateralAmount -= seizedWeth;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+        weth.safeTransfer(msg.sender, seizedWeth);
+
+        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            usdc.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        usdc.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || annualInterestRateWad == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = annualInterestRateWad.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleAge) revert StaleOraclePrice();
+
+        oracleDecimals = ethUsdOracle.decimals();
+        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
+        oraclePrice = uint256(answer);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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

apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/README.md
/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowMarket.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/README.md b/README.md
deleted file mode 100644
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..0000000000000000000000000000000000000000
--- a/README.md
+++ /dev/null
@@ -1,66 +0,0 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
-
-## Documentation
-
-https://book.getfoundry.sh/
-
-## Usage
-
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..feb2aa14409ab837e558f38d2e960b616735ffc0
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,308 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    AggregatorV3Interface public immutable ETH_USD_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    uint256 public immutable MAX_ORACLE_AGE;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ETH_USD_ORACLE = AggregatorV3Interface(ethUsdOracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        MAX_ORACLE_AGE = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        uint256 debtSharesToBurn;
+        if (repaidUsdc >= debt) {
+            repaidUsdc = debt;
+            debtSharesToBurn = position.debtShares;
+        } else {
+            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+        }
+
+        seizedWeth = _usdcValueToWeth(
+            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
+            oraclePrice,
+            oracleDecimals
+        );
+        if (seizedWeth == 0) revert RepayTooSmall();
+        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+        position.debtShares -= debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+        position.collateralAmount -= seizedWeth;
+
+        USDC.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+        WETH.safeTransfer(msg.sender, seizedWeth);
+
+        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            USDC.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        USDC.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return;
+
+        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
+        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_AGE) revert StaleOraclePrice();
+
+        oracleDecimals = ETH_USD_ORACLE.decimals();
+        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oraclePrice = uint256(answer);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/README.md b/README.md
deleted file mode 100644
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..0000000000000000000000000000000000000000
--- a/README.md
+++ /dev/null
@@ -1,66 +0,0 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
-
-## Documentation
-
-https://book.getfoundry.sh/
-
-## Usage
-
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..feb2aa14409ab837e558f38d2e960b616735ffc0
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,308 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    AggregatorV3Interface public immutable ETH_USD_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    uint256 public immutable MAX_ORACLE_AGE;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ETH_USD_ORACLE = AggregatorV3Interface(ethUsdOracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        MAX_ORACLE_AGE = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        uint256 debtSharesToBurn;
+        if (repaidUsdc >= debt) {
+            repaidUsdc = debt;
+            debtSharesToBurn = position.debtShares;
+        } else {
+            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+        }
+
+        seizedWeth = _usdcValueToWeth(
+            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
+            oraclePrice,
+            oracleDecimals
+        );
+        if (seizedWeth == 0) revert RepayTooSmall();
+        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+        position.debtShares -= debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+        position.collateralAmount -= seizedWeth;
+
+        USDC.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+        WETH.safeTransfer(msg.sender, seizedWeth);
+
+        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            USDC.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        USDC.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return;
+
+        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
+        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_AGE) revert StaleOraclePrice();
+
+        oracleDecimals = ETH_USD_ORACLE.decimals();
+        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oraclePrice = uint256(answer);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
?? NOTES.md
?? foundry.toml
?? script/
?? src/

 succeeded in 790ms:
Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 702.94ms
Compiler run successful!
2026-09-04T13:05:29.467343Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/README.md b/README.md
deleted file mode 100644
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..0000000000000000000000000000000000000000
--- a/README.md
+++ /dev/null
@@ -1,66 +0,0 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
-
-## Documentation
-
-https://book.getfoundry.sh/
-
-## Usage
-
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..feb2aa14409ab837e558f38d2e960b616735ffc0
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,308 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    AggregatorV3Interface public immutable ETH_USD_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    uint256 public immutable MAX_ORACLE_AGE;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ETH_USD_ORACLE = AggregatorV3Interface(ethUsdOracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        MAX_ORACLE_AGE = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        uint256 debtSharesToBurn;
+        if (repaidUsdc >= debt) {
+            repaidUsdc = debt;
+            debtSharesToBurn = position.debtShares;
+        } else {
+            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+        }
+
+        seizedWeth = _usdcValueToWeth(
+            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
+            oraclePrice,
+            oracleDecimals
+        );
+        if (seizedWeth == 0) revert RepayTooSmall();
+        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+        position.debtShares -= debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+        position.collateralAmount -= seizedWeth;
+
+        USDC.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+        WETH.safeTransfer(msg.sender, seizedWeth);
+
+        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            USDC.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        USDC.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return;
+
+        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
+        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_AGE) revert StaleOraclePrice();
+
+        oracleDecimals = ETH_USD_ORACLE.decimals();
+        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oraclePrice = uint256(answer);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
The contract set now compiles cleanly. I’m doing a final pass on the output paths so I can hand you the exact files and the one non-fatal Foundry warning that came from the sandbox, not from the project.
exec
/bin/bash -lc "nl -ba src/SimpleBorrowMarket.sol | sed -n '1,260p'" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "nl -ba script/DeploySimpleBorrowMarket.s.sol | sed -n '1,200p'" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "nl -ba NOTES.md | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 11ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity 0.8.24;
     3	
     4	import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
     5	import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
     6	import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
     7	import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
     8	
     9	import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
    10	
    11	contract SimpleBorrowMarket is ReentrancyGuard {
    12	    using Math for uint256;
    13	    using SafeERC20 for IERC20;
    14	
    15	    uint256 public constant BPS = 10_000;
    16	    uint256 public constant YEAR = 365 days;
    17	    uint256 public constant WAD = 1e18;
    18	    uint256 public constant RAY = 1e27;
    19	    uint256 public constant MAX_LTV_BPS = 7_000;
    20	    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    21	    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    22	
    23	    IERC20 public immutable WETH;
    24	    IERC20 public immutable USDC;
    25	    AggregatorV3Interface public immutable ETH_USD_ORACLE;
    26	    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
    27	    uint256 public immutable MAX_ORACLE_AGE;
    28	
    29	    uint256 public borrowIndexRay = RAY;
    30	    uint256 public lastAccrualTimestamp;
    31	    uint256 public totalDebtShares;
    32	
    33	    struct Position {
    34	        uint256 collateralAmount;
    35	        uint256 debtShares;
    36	    }
    37	
    38	    mapping(address => Position) public positions;
    39	
    40	    error ZeroAmount();
    41	    error InvalidAddress();
    42	    error InvalidInterestRate();
    43	    error InvalidOracleConfig();
    44	    error StaleOraclePrice();
    45	    error InvalidOraclePrice();
    46	    error PositionNotHealthy();
    47	    error PositionNotLiquidatable();
    48	    error RepayTooSmall();
    49	    error WithdrawTooLarge();
    50	
    51	    event CollateralDeposited(address indexed user, uint256 amount);
    52	    event CollateralWithdrawn(address indexed user, uint256 amount);
    53	    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
    54	    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
    55	    event Liquidated(
    56	        address indexed liquidator,
    57	        address indexed borrower,
    58	        uint256 repaidUsdc,
    59	        uint256 debtSharesBurned,
    60	        uint256 collateralSeized
    61	    );
    62	    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
    63	
    64	    constructor(
    65	        address weth_,
    66	        address usdc_,
    67	        address ethUsdOracle_,
    68	        uint256 annualInterestRateWad_,
    69	        uint256 maxOracleAge_
    70	    ) {
    71	        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
    72	        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
    73	        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
    74	
    75	        WETH = IERC20(weth_);
    76	        USDC = IERC20(usdc_);
    77	        ETH_USD_ORACLE = AggregatorV3Interface(ethUsdOracle_);
    78	        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
    79	        MAX_ORACLE_AGE = maxOracleAge_;
    80	        lastAccrualTimestamp = block.timestamp;
    81	    }
    82	
    83	    function depositCollateral(uint256 amount) external nonReentrant {
    84	        if (amount == 0) revert ZeroAmount();
    85	
    86	        Position storage position = positions[msg.sender];
    87	        position.collateralAmount += amount;
    88	
    89	        WETH.safeTransferFrom(msg.sender, address(this), amount);
    90	        emit CollateralDeposited(msg.sender, amount);
    91	    }
    92	
    93	    function withdrawCollateral(uint256 amount) external nonReentrant {
    94	        if (amount == 0) revert ZeroAmount();
    95	
    96	        _accrueInterest();
    97	
    98	        Position storage position = positions[msg.sender];
    99	        if (amount > position.collateralAmount) revert WithdrawTooLarge();
   100	
   101	        position.collateralAmount -= amount;
   102	        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
   103	
   104	        WETH.safeTransfer(msg.sender, amount);
   105	        emit CollateralWithdrawn(msg.sender, amount);
   106	    }
   107	
   108	    function borrow(uint256 amount) external nonReentrant {
   109	        if (amount == 0) revert ZeroAmount();
   110	
   111	        _accrueInterest();
   112	
   113	        Position storage position = positions[msg.sender];
   114	        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
   115	        position.debtShares += mintedDebtShares;
   116	        totalDebtShares += mintedDebtShares;
   117	
   118	        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
   119	
   120	        USDC.safeTransfer(msg.sender, amount);
   121	        emit Borrowed(msg.sender, amount, mintedDebtShares);
   122	    }
   123	
   124	    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
   125	        if (amount == 0) revert ZeroAmount();
   126	
   127	        _accrueInterest();
   128	        return _repay(msg.sender, msg.sender, amount);
   129	    }
   130	
   131	    function liquidate(address borrower, uint256 maxRepayAmount)
   132	        external
   133	        nonReentrant
   134	        returns (uint256 repaidUsdc, uint256 seizedWeth)
   135	    {
   136	        if (maxRepayAmount == 0) revert ZeroAmount();
   137	
   138	        _accrueInterest();
   139	
   140	        Position storage position = positions[borrower];
   141	        uint256 debt = _debtFromSharesUp(position.debtShares);
   142	        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
   143	        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);
   144	
   145	        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
   146	
   147	        uint256 maxRepayFromCollateral =
   148	            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
   149	        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
   150	        if (repaidUsdc == 0) revert RepayTooSmall();
   151	
   152	        uint256 debtSharesToBurn;
   153	        if (repaidUsdc >= debt) {
   154	            repaidUsdc = debt;
   155	            debtSharesToBurn = position.debtShares;
   156	        } else {
   157	            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
   158	            if (debtSharesToBurn == 0) revert RepayTooSmall();
   159	            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
   160	        }
   161	
   162	        seizedWeth = _usdcValueToWeth(
   163	            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
   164	            oraclePrice,
   165	            oracleDecimals
   166	        );
   167	        if (seizedWeth == 0) revert RepayTooSmall();
   168	        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
   169	
   170	        position.debtShares -= debtSharesToBurn;
   171	        totalDebtShares -= debtSharesToBurn;
   172	        position.collateralAmount -= seizedWeth;
   173	
   174	        USDC.safeTransferFrom(msg.sender, address(this), repaidUsdc);
   175	        WETH.safeTransfer(msg.sender, seizedWeth);
   176	
   177	        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
   178	        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
   179	    }
   180	
   181	    function previewDebt(address borrower) external view returns (uint256) {
   182	        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
   183	    }
   184	
   185	    function previewHealthFactorBps(address borrower) external view returns (uint256) {
   186	        Position storage position = positions[borrower];
   187	        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
   188	        return _healthFactorBps(position.collateralAmount, debt);
   189	    }
   190	
   191	    function collateralValueInUsdc(address borrower) external view returns (uint256) {
   192	        return _collateralValueInUsdc(positions[borrower].collateralAmount);
   193	    }
   194	
   195	    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
   196	        Position storage position = positions[borrower];
   197	        uint256 debtShares = position.debtShares;
   198	        uint256 debt = _debtFromSharesUp(debtShares);
   199	
   200	        if (requestedAmount >= debt) {
   201	            actualRepaid = debt;
   202	            position.debtShares = 0;
   203	            totalDebtShares -= debtShares;
   204	            USDC.safeTransferFrom(payer, address(this), actualRepaid);
   205	            emit Repaid(payer, borrower, actualRepaid, debtShares);
   206	            return actualRepaid;
   207	        }
   208	
   209	        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
   210	        if (debtSharesToBurn == 0) revert RepayTooSmall();
   211	
   212	        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
   213	        position.debtShares = debtShares - debtSharesToBurn;
   214	        totalDebtShares -= debtSharesToBurn;
   215	
   216	        USDC.safeTransferFrom(payer, address(this), actualRepaid);
   217	        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
   218	    }
   219	
   220	    function _accrueInterest() internal {
   221	        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
   222	        if (elapsed == 0) return;
   223	
   224	        lastAccrualTimestamp = block.timestamp;
   225	        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return;
   226	
   227	        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
   228	        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
   229	        emit InterestAccrued(borrowIndexRay, elapsed);
   230	    }
   231	
   232	    function _previewBorrowIndexRay() internal view returns (uint256) {
   233	        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return borrowIndexRay;
   234	
   235	        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
   236	        if (elapsed == 0) return borrowIndexRay;
   237	
   238	        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
   239	        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
   240	    }
   241	
   242	    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
   243	        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
   244	    }
   245	
   246	    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
   247	        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
   248	    }
   249	
   250	    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
   251	        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
   252	    }
   253	
   254	    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
   255	        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
   256	    }
   257	
   258	    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
   259	        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
   260	    }

 succeeded in 22ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity 0.8.24;
     3	
     4	import {Script} from "forge-std/Script.sol";
     5	
     6	import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
     7	
     8	contract DeploySimpleBorrowMarket is Script {
     9	    function run() external returns (SimpleBorrowMarket market) {
    10	        address weth = vm.envAddress("WETH");
    11	        address usdc = vm.envAddress("USDC");
    12	        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
    13	        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
    14	        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
    15	
    16	        vm.startBroadcast();
    17	        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
    18	        vm.stopBroadcast();
    19	    }
    20	}

 succeeded in 21ms:
     1	# Simple Borrow Market Notes
     2	
     3	## Position health
     4	
     5	The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
     6	
     7	- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
     8	- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
     9	- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
    10	
    11	Health checks use two thresholds:
    12	
    13	- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
    14	- liquidation threshold: `debt > 85% of collateralValueUsdc`
    15	
    16	That means:
    17	
    18	- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
    19	- a liquidator can act once the position crosses 85%
    20	
    21	## Liquidation flow
    22	
    23	To liquidate a position:
    24	
    25	1. Read the borrower debt and collateral value from the contract.
    26	2. Confirm the debt is above 85% of collateral value.
    27	3. Approve the market to pull USDC from the liquidator.
    28	4. Call `liquidate(borrower, maxRepayAmount)`.
    29	
    30	The market repays up to the smaller of:
    31	
    32	- the liquidator's requested amount
    33	- the full borrower debt
    34	- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
    35	
    36	The liquidator receives:
    37	
    38	- WETH worth the repaid USDC amount
    39	- plus a 5% bonus, also in WETH
    40	
    41	## Mainnet deployment/operator requirements
    42	
    43	- Use canonical mainnet token addresses for WETH and USDC.
    44	- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
    45	- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
    46	- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
    47	- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
    48	- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
    49	- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
    50	- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.

exec
/bin/bash -lc "nl -ba foundry.toml | sed -n '1,80p'" in /home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002
 succeeded in 1ms:
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/README.md b/README.md
deleted file mode 100644
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..0000000000000000000000000000000000000000
--- a/README.md
+++ /dev/null
@@ -1,66 +0,0 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
-
-## Documentation
-
-https://book.getfoundry.sh/
-
-## Usage
-
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..feb2aa14409ab837e558f38d2e960b616735ffc0
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,308 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    AggregatorV3Interface public immutable ETH_USD_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    uint256 public immutable MAX_ORACLE_AGE;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ETH_USD_ORACLE = AggregatorV3Interface(ethUsdOracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        MAX_ORACLE_AGE = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        uint256 debtSharesToBurn;
+        if (repaidUsdc >= debt) {
+            repaidUsdc = debt;
+            debtSharesToBurn = position.debtShares;
+        } else {
+            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+        }
+
+        seizedWeth = _usdcValueToWeth(
+            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
+            oraclePrice,
+            oracleDecimals
+        );
+        if (seizedWeth == 0) revert RepayTooSmall();
+        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+        position.debtShares -= debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+        position.collateralAmount -= seizedWeth;
+
+        USDC.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+        WETH.safeTransfer(msg.sender, seizedWeth);
+
+        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            USDC.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        USDC.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return;
+
+        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
+        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_AGE) revert StaleOraclePrice();
+
+        oracleDecimals = ETH_USD_ORACLE.decimals();
+        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oraclePrice = uint256(answer);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
Built a Foundry project for the borrowing market and verified it with `forge build`. The main contract is [src/SimpleBorrowMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowMarket.sol:11), with a deploy script at [script/DeploySimpleBorrowMarket.s.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/script/DeploySimpleBorrowMarket.s.sol:8) and Foundry config in [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/foundry.toml:1).

The market uses WETH collateral, USDC debt, a Chainlink-style ETH/USD oracle, 70% max borrow LTV, 85% liquidation threshold, 5% liquidation bonus, and linear interest accrual through a global debt index. I also left the requested operator documentation in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/NOTES.md:1), covering health computation, liquidation flow, and mainnet deployment concerns.

Verification: `forge build` completed successfully. The only warning was Foundry failing to write its global signature cache under `/home/damu/.foundry/cache/signatures` because the sandbox made that path read-only; it did not affect compilation.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b495f0373235819bb9714bba34ab407ec35e2e2
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,50 @@
+# Simple Borrow Market Notes
+
+## Position health
+
+The contract prices WETH collateral in USDC terms from an ETH/USD oracle:
+
+- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
+- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market
+
+Health checks use two thresholds:
+
+- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
+- liquidation threshold: `debt > 85% of collateralValueUsdc`
+
+That means:
+
+- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
+- a liquidator can act once the position crosses 85%
+
+## Liquidation flow
+
+To liquidate a position:
+
+1. Read the borrower debt and collateral value from the contract.
+2. Confirm the debt is above 85% of collateral value.
+3. Approve the market to pull USDC from the liquidator.
+4. Call `liquidate(borrower, maxRepayAmount)`.
+
+The market repays up to the smaller of:
+
+- the liquidator's requested amount
+- the full borrower debt
+- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus
+
+The liquidator receives:
+
+- WETH worth the repaid USDC amount
+- plus a 5% bonus, also in WETH
+
+## Mainnet deployment/operator requirements
+
+- Use canonical mainnet token addresses for WETH and USDC.
+- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
+- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
+- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
+- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
+- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
+- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
+- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
diff --git a/README.md b/README.md
deleted file mode 100644
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..0000000000000000000000000000000000000000
--- a/README.md
+++ /dev/null
@@ -1,66 +0,0 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
-
-## Documentation
-
-https://book.getfoundry.sh/
-
-## Usage
-
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b2650b84925dd393e24dfea0d7d6e99aa873f97
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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
diff --git a/script/DeploySimpleBorrowMarket.s.sol b/script/DeploySimpleBorrowMarket.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83384df0e0c8d3392b1dcda5376b13c64040d49e
--- /dev/null
+++ b/script/DeploySimpleBorrowMarket.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {Script} from "forge-std/Script.sol";
+
+import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";
+
+contract DeploySimpleBorrowMarket is Script {
+    function run() external returns (SimpleBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
+        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
+        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
+        vm.stopBroadcast();
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
diff --git a/src/SimpleBorrowMarket.sol b/src/SimpleBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..feb2aa14409ab837e558f38d2e960b616735ffc0
--- /dev/null
+++ b/src/SimpleBorrowMarket.sol
@@ -0,0 +1,308 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
+
+contract SimpleBorrowMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant WAD = 1e18;
+    uint256 public constant RAY = 1e27;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    AggregatorV3Interface public immutable ETH_USD_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
+    uint256 public immutable MAX_ORACLE_AGE;
+
+    uint256 public borrowIndexRay = RAY;
+    uint256 public lastAccrualTimestamp;
+    uint256 public totalDebtShares;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtShares;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidInterestRate();
+    error InvalidOracleConfig();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error PositionNotHealthy();
+    error PositionNotLiquidatable();
+    error RepayTooSmall();
+    error WithdrawTooLarge();
+
+    event CollateralDeposited(address indexed user, uint256 amount);
+    event CollateralWithdrawn(address indexed user, uint256 amount);
+    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
+    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed borrower,
+        uint256 repaidUsdc,
+        uint256 debtSharesBurned,
+        uint256 collateralSeized
+    );
+    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address ethUsdOracle_,
+        uint256 annualInterestRateWad_,
+        uint256 maxOracleAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
+        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
+        if (maxOracleAge_ == 0) revert InvalidOracleConfig();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        ETH_USD_ORACLE = AggregatorV3Interface(ethUsdOracle_);
+        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
+        MAX_ORACLE_AGE = maxOracleAge_;
+        lastAccrualTimestamp = block.timestamp;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        position.collateralAmount += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        if (amount > position.collateralAmount) revert WithdrawTooLarge();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[msg.sender];
+        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
+        position.debtShares += mintedDebtShares;
+        totalDebtShares += mintedDebtShares;
+
+        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, mintedDebtShares);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+        return _repay(msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address borrower, uint256 maxRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidUsdc, uint256 seizedWeth)
+    {
+        if (maxRepayAmount == 0) revert ZeroAmount();
+
+        _accrueInterest();
+
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesUp(position.debtShares);
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);
+
+        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();
+
+        uint256 maxRepayFromCollateral =
+            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
+        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
+        if (repaidUsdc == 0) revert RepayTooSmall();
+
+        uint256 debtSharesToBurn;
+        if (repaidUsdc >= debt) {
+            repaidUsdc = debt;
+            debtSharesToBurn = position.debtShares;
+        } else {
+            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
+            if (debtSharesToBurn == 0) revert RepayTooSmall();
+            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
+        }
+
+        seizedWeth = _usdcValueToWeth(
+            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
+            oraclePrice,
+            oracleDecimals
+        );
+        if (seizedWeth == 0) revert RepayTooSmall();
+        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();
+
+        position.debtShares -= debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+        position.collateralAmount -= seizedWeth;
+
+        USDC.safeTransferFrom(msg.sender, address(this), repaidUsdc);
+        WETH.safeTransfer(msg.sender, seizedWeth);
+
+        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
+        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
+    }
+
+    function previewDebt(address borrower) external view returns (uint256) {
+        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
+    }
+
+    function previewHealthFactorBps(address borrower) external view returns (uint256) {
+        Position storage position = positions[borrower];
+        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
+        return _healthFactorBps(position.collateralAmount, debt);
+    }
+
+    function collateralValueInUsdc(address borrower) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[borrower].collateralAmount);
+    }
+
+    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
+        Position storage position = positions[borrower];
+        uint256 debtShares = position.debtShares;
+        uint256 debt = _debtFromSharesUp(debtShares);
+
+        if (requestedAmount >= debt) {
+            actualRepaid = debt;
+            position.debtShares = 0;
+            totalDebtShares -= debtShares;
+            USDC.safeTransferFrom(payer, address(this), actualRepaid);
+            emit Repaid(payer, borrower, actualRepaid, debtShares);
+            return actualRepaid;
+        }
+
+        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
+        if (debtSharesToBurn == 0) revert RepayTooSmall();
+
+        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
+        position.debtShares = debtShares - debtSharesToBurn;
+        totalDebtShares -= debtSharesToBurn;
+
+        USDC.safeTransferFrom(payer, address(this), actualRepaid);
+        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
+    }
+
+    function _accrueInterest() internal {
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return;
+
+        lastAccrualTimestamp = block.timestamp;
+        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return;
+
+        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
+        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
+        emit InterestAccrued(borrowIndexRay, elapsed);
+    }
+
+    function _previewBorrowIndexRay() internal view returns (uint256) {
+        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return borrowIndexRay;
+
+        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+        if (elapsed == 0) return borrowIndexRay;
+
+        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
+        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
+    }
+
+    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
+    }
+
+    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
+        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
+        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
+    }
+
+    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
+        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
+    }
+
+    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
+        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
+        if (collateralValueUsdc == 0) return debtAmount > 0;
+        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
+    }
+
+    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
+        if (debtAmount == 0) return type(uint256).max;
+        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
+        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
+    }
+
+    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
+        internal
+        pure
+        returns (uint256)
+    {
+        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
+    }
+
+    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
+        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_AGE) revert StaleOraclePrice();
+
+        oracleDecimals = ETH_USD_ORACLE.decimals();
+        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oraclePrice = uint256(answer);
+    }
+}
diff --git a/src/interfaces/AggregatorV3Interface.sol b/src/interfaces/AggregatorV3Interface.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4594cf8df3b2de2433cc5ae8d8d60b4eb2b99f49
--- /dev/null
+++ b/src/interfaces/AggregatorV3Interface.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
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
70,604
````

## final message

Built a Foundry project for the borrowing market and verified it with `forge build`. The main contract is [src/SimpleBorrowMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowMarket.sol:11), with a deploy script at [script/DeploySimpleBorrowMarket.s.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/script/DeploySimpleBorrowMarket.s.sol:8) and Foundry config in [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/foundry.toml:1).

The market uses WETH collateral, USDC debt, a Chainlink-style ETH/USD oracle, 70% max borrow LTV, 85% liquidation threshold, 5% liquidation bonus, and linear interest accrual through a global debt index. I also left the requested operator documentation in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T125947Z-codex-with-skill-2/security-goal-002/NOTES.md:1), covering health computation, liquidation flow, and mainnet deployment concerns.

Verification: `forge build` completed successfully. The only warning was Foundry failing to write its global signature cache under `/home/damu/.foundry/cache/signatures` because the sandbox made that path read-only; it did not affect compilation.

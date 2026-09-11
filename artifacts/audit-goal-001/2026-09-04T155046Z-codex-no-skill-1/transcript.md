# Executor transcript — 2026-09-04T155046Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06d1d-db86-76a0-b5fc-c256b8b170a5
--------
user
This workspace is ArbiLend, our overcollateralised USDC lending market. It is
code-complete and we deploy to Arbitrum One in two weeks. Nothing is live yet
and the code is not hosted anywhere — this directory is the whole codebase.

I need a security review before we put real money behind it. Start with
README.md: it says what we are shipping, where it runs, and what we plan to
list next.

Write AUDIT-REPORT.md in this directory. For every issue: a severity, the
contract and function it lives in, what an attacker or an unlucky user
actually gets out of it, and the fix you would make. Rank it so I can hand
the top of the list to the team on Monday.

Report only — leave everything under src/ exactly as it is. AUDIT-REPORT.md
should be the only file you leave behind: if you take working notes on the
way, clear them out before you finish.

codex
I’ll review the README first to establish protocol scope and deployment assumptions, then trace the contracts and tests for exploitable paths. I’ll leave `src/` untouched and ensure the only new file is `AUDIT-REPORT.md`.
  → Read README and repository instructions; inventory contracts and tests
  • Audit trust boundaries, accounting, liquidation, oracle, token, and admin paths
  • Validate findings with tests or minimal read-only analysis
  • Write ranked AUDIT-REPORT.md and verify no other files were created
exec
/bin/bash -lc "pwd && rg --files -g 'README.md' -g 'AGENTS.md' -g '"'!lib/**'"' -g '"'!node_modules/**'"' && rg --files src test script 2>/dev/null | sort" in /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001
 succeeded in 16ms:
README.md
src/CollateralVault.sol
src/LendingMarket.sol
src/MarketProxy.sol
src/PriceOracle.sol
src/interfaces/IAggregatorV3.sol
src/interfaces/IERC20.sol
src/interfaces/ILendingMarket.sol

exec
/bin/bash -lc "sed -n '1,240p' README.md && for f in src/*.sol src/interfaces/*.sol; do echo \"===== "'$f"; sed -n '"'1,280p' \""'$f"; done && printf '"'\\n===== root files =====\\n' && find . -maxdepth 2 -type f -not -path './.git/*' -print | sort" in /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001
 succeeded in 19ms:
# ArbiLend

Overcollateralised USDC lending market. Users deposit collateral into
`CollateralVault`, borrow USDC from `LendingMarket` against it, and are
liquidated when their position falls below the liquidation threshold.

Deployment target: **Arbitrum One**. Mainnet is not in scope for this release.

| Piece | Address / value |
| --- | --- |
| Debt asset | USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| First listed collateral | wstETH `0x5979D7b546E38E414F7E9822514be443A4800529` |
| Feed set for wstETH | stETH / USD `0x07C5b924399cc23c24a95c8743DE4006a32b7f2a` |
| Feed set for USDC | USDC / USD `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3` |
| Liquidation threshold | 8000 bps |
| Liquidation bonus | 500 bps |
| Borrow rate | 400 bps / year |

## Contracts

- `LendingMarket` — borrow / repay / liquidate, interest accrual, health
  factor. Sits behind `MarketProxy` so we can ship fixes without migrating
  positions. Storage layout is append-only; do not reorder.
- `CollateralVault` — custody and per-user accounting for collateral. Only the
  market can seize.
- `PriceOracle` — Chainlink price source, one feed per token, prices returned
  scaled to 1e18 USD.
- `MarketProxy` — ERC-1967 proxy the market is deployed behind.

## Collateral listing

wstETH is the only collateral at launch. Governance lists further tokens with
`LendingMarket.listCollateral`; the shortlist for the next round is weETH,
ezETH and USDT, and the DAO has asked for a path to yield-bearing and
rebasing collateral after that.

## Liquidity

There is no supply side in this release. The treasury seeds the market's USDC
balance with a direct transfer and takes the interest; lender deposits land in
v2.

## Interest

Debt is tracked with a global borrow index. `accrueInterest()` runs at the top
of every state-changing entry point and advances the index by the elapsed
time since the last accrual.

## Development

```bash
forge build
```

No dependencies and no test suite yet — the suite lands with the audit fixes.
===== src/CollateralVault.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {ILendingMarket} from "./interfaces/ILendingMarket.sol";

/// @notice Custody and per-user accounting for collateral. Only the market can seize.
contract CollateralVault {
    address public immutable market;

    mapping(address => bool) public supported;
    mapping(address => mapping(address => uint256)) public balanceOf;

    error NotMarket();
    error TokenNotSupported(address token);
    error InsufficientBalance();

    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event Seized(address indexed user, address indexed token, address indexed to, uint256 amount);

    modifier onlyMarket() {
        if (msg.sender != market) revert NotMarket();
        _;
    }

    constructor(address market_) {
        market = market_;
    }

    function setSupported(address token, bool isSupported) external onlyMarket {
        supported[token] = isSupported;
    }

    function deposit(address token, uint256 amount) external {
        if (!supported[token]) revert TokenNotSupported(token);

        IERC20(token).transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender][token] += amount;

        emit Deposited(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external {
        uint256 balance = balanceOf[msg.sender][token];
        if (balance < amount) revert InsufficientBalance();

        IERC20(token).transfer(msg.sender, amount);
        balanceOf[msg.sender][token] = balance - amount;
        ILendingMarket(market).requireHealthy(msg.sender);

        emit Withdrawn(msg.sender, token, amount);
    }

    function seize(address user, address token, address to, uint256 amount) external onlyMarket {
        balanceOf[user][token] -= amount;
        IERC20(token).transfer(to, amount);

        emit Seized(user, token, to, amount);
    }
}
===== src/LendingMarket.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {PriceOracle} from "./PriceOracle.sol";
import {CollateralVault} from "./CollateralVault.sol";

/// @notice Overcollateralised USDC lending market. Deployed behind MarketProxy; storage layout is append-only.
contract LendingMarket {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 internal constant BORROW_TYPEHASH = keccak256("Borrow(address borrower,uint256 amount)");

    uint256 internal constant BPS = 10_000;
    uint256 internal constant WAD = 1e18;
    uint256 internal constant SECONDS_PER_BLOCK = 12;

    bool public initialized;
    address public owner;
    PriceOracle public oracle;
    CollateralVault public vault;
    IERC20 public debtAsset;
    uint256 public liquidationThreshold;
    uint256 public liquidationBonus;
    uint256 public borrowRate;
    uint256 public borrowIndex;
    uint256 public lastAccrualBlock;
    address[] public collateralTokens;
    mapping(address => bool) public isCollateral;
    mapping(address => uint256) public principalOf;
    address[] public borrowers;
    bytes32 public domainSeparator;

    error AlreadyInitialized();
    error NotOwner();
    error NotCollateral(address token);
    error BadSignature();
    error Unhealthy();
    error Healthy();
    error NothingBorrowed();

    event Initialized(address indexed owner);
    event Upgraded(address indexed implementation);
    event OracleUpdated(address indexed oracle);
    event LiquidationThresholdUpdated(uint256 bps);
    event BorrowRateUpdated(uint256 bps);
    event CollateralListed(address indexed token);
    event Borrowed(address indexed borrower, uint256 amount);
    event Repaid(address indexed borrower, address indexed payer, uint256 amount);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 debtRepaid);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function initialize(address owner_, PriceOracle oracle_, CollateralVault vault_, IERC20 debtAsset_) external {
        if (initialized) revert AlreadyInitialized();
        initialized = true;

        owner = owner_;
        oracle = oracle_;
        vault = vault_;
        debtAsset = debtAsset_;

        liquidationThreshold = 8_000;
        liquidationBonus = 500;
        borrowRate = 400;
        borrowIndex = WAD;
        lastAccrualBlock = block.number;

        domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("ArbiLend"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );

        emit Initialized(owner_);
    }

    function upgradeTo(address newImplementation) external {
        assembly {
            sstore(IMPLEMENTATION_SLOT, newImplementation)
        }
        emit Upgraded(newImplementation);
    }

    function setOracle(PriceOracle newOracle) external {
        oracle = newOracle;
        emit OracleUpdated(address(newOracle));
    }

    function setLiquidationThreshold(uint256 bps) external {
        liquidationThreshold = bps;
        emit LiquidationThresholdUpdated(bps);
    }

    function setBorrowRate(uint256 bps) external onlyOwner {
        accrueInterest();
        borrowRate = bps;
        emit BorrowRateUpdated(bps);
    }

    function listCollateral(address token) external onlyOwner {
        if (!isCollateral[token]) {
            isCollateral[token] = true;
            collateralTokens.push(token);
            vault.setSupported(token, true);
            emit CollateralListed(token);
        }
    }

    /// @notice Advances the borrow index by the interest owed since the last accrual.
    function accrueInterest() public {
        uint256 blocksElapsed = block.number - lastAccrualBlock;
        if (blocksElapsed == 0) return;

        uint256 secondsElapsed = blocksElapsed * SECONDS_PER_BLOCK;
        uint256 growth = borrowIndex * borrowRate * secondsElapsed / (BPS * 365 days);

        borrowIndex += growth;
        lastAccrualBlock = block.number;
    }

    function debtOf(address user) public view returns (uint256) {
        return principalOf[user] * borrowIndex / WAD;
    }

    function collateralValueUsd(address user) public view returns (uint256 total) {
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            address token = collateralTokens[i];
            uint256 amount = vault.balanceOf(user, token);
            if (amount == 0) continue;
            total += amount * oracle.getPrice(token) / 10 ** IERC20(token).decimals();
        }
    }

    function debtValueUsd(address user) public view returns (uint256) {
        return debtOf(user) * oracle.getPrice(address(debtAsset)) / 10 ** debtAsset.decimals();
    }

    /// @notice Health factor scaled to 1e18. Below 1e18 the position can be liquidated.
    function healthFactor(address user) public view returns (uint256) {
        uint256 debtUsd = debtValueUsd(user);
        if (debtUsd == 0) return type(uint256).max;

        return (collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS;
    }

    function requireHealthy(address user) external view {
        if (healthFactor(user) < WAD) revert Unhealthy();
    }

    function borrow(uint256 amount) external {
        _borrow(msg.sender, amount);
    }

    /// @notice Borrow on behalf of a signer who authorised the amount off-chain.
    function borrowWithSig(address borrower, uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
        bytes32 structHash = keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        if (ecrecover(digest, v, r, s) != borrower) revert BadSignature();

        _borrow(borrower, amount);
    }

    function repay(address onBehalfOf, uint256 amount) external {
        accrueInterest();

        uint256 debt = debtOf(onBehalfOf);
        if (debt == 0) revert NothingBorrowed();
        if (amount > debt) amount = debt;

        debtAsset.transferFrom(msg.sender, address(this), amount);
        principalOf[onBehalfOf] -= amount * WAD / borrowIndex;

        emit Repaid(onBehalfOf, msg.sender, amount);
    }

    function liquidate(address user) external {
        accrueInterest();
        if (healthFactor(user) >= WAD) revert Healthy();
        _liquidate(user);
    }

    /// @notice Sweeps every underwater position in one call. Run by the keeper after a large price move.
    function liquidateAll() external {
        accrueInterest();
        for (uint256 i = 0; i < borrowers.length; i++) {
            if (healthFactor(borrowers[i]) < WAD) _liquidate(borrowers[i]);
        }
    }

    function _borrow(address borrower, uint256 amount) internal {
        accrueInterest();

        if (principalOf[borrower] == 0) borrowers.push(borrower);
        principalOf[borrower] += amount * WAD / borrowIndex;

        if (healthFactor(borrower) < WAD) revert Unhealthy();
        debtAsset.transfer(borrower, amount);

        emit Borrowed(borrower, amount);
    }

    function _liquidate(address user) internal {
        uint256 debt = debtOf(user);
        if (debt == 0) return;

        debtAsset.transferFrom(msg.sender, address(this), debt);
        principalOf[user] = 0;

        uint256 seizeUsd = debt * oracle.getPrice(address(debtAsset)) / 10 ** debtAsset.decimals();
        seizeUsd = seizeUsd * (BPS + liquidationBonus) / BPS;

        for (uint256 i = 0; i < collateralTokens.length && seizeUsd > 0; i++) {
            address token = collateralTokens[i];
            uint256 amount = vault.balanceOf(user, token);
            if (amount == 0) continue;

            uint256 price = oracle.getPrice(token);
            uint256 unit = 10 ** IERC20(token).decimals();
            uint256 valueUsd = amount * price / unit;
            uint256 takeUsd = valueUsd < seizeUsd ? valueUsd : seizeUsd;

            vault.seize(user, token, msg.sender, takeUsd * unit / price);
            seizeUsd -= takeUsd;
        }

        emit Liquidated(user, msg.sender, debt);
    }
}
===== src/MarketProxy.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice ERC-1967 proxy the market is deployed behind. The implementation owns the upgrade entry point.
contract MarketProxy {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    event Upgraded(address indexed implementation);

    constructor(address implementation, bytes memory initData) {
        assembly {
            sstore(IMPLEMENTATION_SLOT, implementation)
        }
        emit Upgraded(implementation);

        if (initData.length > 0) {
            (bool ok, bytes memory ret) = implementation.delegatecall(initData);
            if (!ok) {
                assembly {
                    revert(add(ret, 0x20), mload(ret))
                }
            }
        }
    }

    fallback() external payable {
        assembly {
            let impl := sload(IMPLEMENTATION_SLOT)
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
===== src/PriceOracle.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @notice Chainlink price source for the market. One feed per token, prices returned scaled to 1e18 USD.
contract PriceOracle {
    address public owner;

    mapping(address => IAggregatorV3) public feeds;

    error NotOwner();
    error FeedNotSet(address token);

    event FeedUpdated(address indexed token, address feed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setFeed(address token, IAggregatorV3 feed) external onlyOwner {
        feeds[token] = feed;
        emit FeedUpdated(token, address(feed));
    }

    /// @notice Price of one whole unit of `token` in USD, scaled to 1e18.
    function getPrice(address token) external view returns (uint256) {
        IAggregatorV3 feed = feeds[token];
        if (address(feed) == address(0)) revert FeedNotSet(token);

        int256 answer = feed.latestAnswer();
        return uint256(answer) * 10 ** (18 - feed.decimals());
    }
}
===== src/interfaces/IAggregatorV3.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function latestAnswer() external view returns (int256);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
===== src/interfaces/IERC20.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function allowance(address owner, address spender) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    function decimals() external view returns (uint8);
}
===== src/interfaces/ILendingMarket.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ILendingMarket {
    function requireHealthy(address user) external view;
}

===== root files =====
./.gitignore
./README.md
./TASK.md
./foundry.toml
./package.json
./src/CollateralVault.sol
./src/LendingMarket.sol
./src/MarketProxy.sol
./src/PriceOracle.sol

codex
The first-pass review has already surfaced multiple launch-blocking access-control failures, plus accounting and oracle issues that can cause premature liquidation or loss of treasury liquidity. I’m now validating exploit impact and checking interactions specific to Arbitrum, wstETH pricing, signatures, and rounding.
exec
/bin/bash -lc "git status --short && forge build && (command -v slither || true) && (command -v solc || true) && sed -n '1,200p' foundry.toml && sed -n '1,200p' package.json && sed -n '1,200p' TASK.md" in /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001
 succeeded in 275ms:
Compiling 7 files with Solc 0.8.28
Solc 0.8.28 finished in 214.54ms
Compiler run successful!
2026-09-04T15:52:06.413705Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> src/CollateralVault.sol:9:30
  |
9 |     address public immutable market;
  |                              ^^^^^^ help: consider using: `MARKET`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/PriceOracle.sol:18:5
   |
18 | /     modifier onlyOwner() {
19 | |         if (msg.sender != owner) revert NotOwner();
20 | |         _;
21 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
18 ~     modifier onlyOwner() {
19 +         _onlyOwner();
20 +         _;
21 +     }
22 + 
23 +     function _onlyOwner() internal {
24 +         if (msg.sender != owner) revert NotOwner();
25 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/CollateralVault.sol:22:5
   |
22 | /     modifier onlyMarket() {
23 | |         if (msg.sender != market) revert NotMarket();
24 | |         _;
25 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
22 ~     modifier onlyMarket() {
23 +         _onlyMarket();
24 +         _;
25 +     }
26 + 
27 +     function _onlyMarket() internal {
28 +         if (msg.sender != market) revert NotMarket();
29 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/PriceOracle.sol:44:16
   |
44 |         return uint256(answer) * 10 ** (18 - feed.decimals());
   |                ^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint256' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> src/CollateralVault.sol:38:9
   |
38 |         IERC20(token).transferFrom(msg.sender, address(this), amount);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> src/CollateralVault.sol:48:9
   |
48 |         IERC20(token).transfer(msg.sender, amount);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[divide-before-multiply]: multiplication should occur before division to avoid loss of precision
   --> src/LendingMarket.sol:150:16
    |
150 |         return (collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS;
    |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#divide-before-multiply

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> src/CollateralVault.sol:57:9
   |
57 |         IERC20(token).transfer(to, amount);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/LendingMarket.sol:51:5
   |
51 | /     modifier onlyOwner() {
52 | |         if (msg.sender != owner) revert NotOwner();
53 | |         _;
54 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
51 ~     modifier onlyOwner() {
52 +         _onlyOwner();
53 +         _;
54 +     }
55 + 
56 +     function _onlyOwner() internal {
57 +         if (msg.sender != owner) revert NotOwner();
58 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[asm-keccak256]: use of inefficient hashing mechanism; consider using inline assembly
   --> src/LendingMarket.sol:163:30
    |
163 |         bytes32 structHash = keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount));
    |                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#asm-keccak256

note[asm-keccak256]: use of inefficient hashing mechanism; consider using inline assembly
   --> src/LendingMarket.sol:164:26
    |
164 |         bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    |                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#asm-keccak256

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
   --> src/LendingMarket.sol:177:9
    |
177 |         debtAsset.transferFrom(msg.sender, address(this), amount);
    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
   --> src/LendingMarket.sol:204:9
    |
204 |         debtAsset.transfer(borrower, amount);
    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
   --> src/LendingMarket.sol:213:9
    |
213 |         debtAsset.transferFrom(msg.sender, address(this), debt);
    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

/home/damu/.local/bin/slither
/home/damu/.local/bin/solc
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.28"
optimizer = true
optimizer_runs = 200

[fmt]
line_length = 120
tab_width = 4
{
  "name": "eval-workspace",
  "private": true
}
This workspace is ArbiLend, our overcollateralised USDC lending market. It is
code-complete and we deploy to Arbitrum One in two weeks. Nothing is live yet
and the code is not hosted anywhere — this directory is the whole codebase.

I need a security review before we put real money behind it. Start with
README.md: it says what we are shipping, where it runs, and what we plan to
list next.

Write AUDIT-REPORT.md in this directory. For every issue: a severity, the
contract and function it lives in, what an attacker or an unlucky user
actually gets out of it, and the fix you would make. Rank it so I can hand
the top of the list to the team on Monday.

Report only — leave everything under src/ exactly as it is. AUDIT-REPORT.md
should be the only file you leave behind: if you take working notes on the
way, clear them out before you finish.

exec
/bin/bash -lc "slither . --exclude-dependencies --filter-paths 'lib|test'" in /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001
 exited 1 in 118ms:
Traceback (most recent call last):
  File "/home/damu/.local/bin/slither", line 5, in <module>
    from slither.__main__ import main
ModuleNotFoundError: No module named 'slither'

web search: 
web search: site:docs.chain.link data feeds l2 sequencer uptime feeds Arbitrum grace period ...
web search: 
web search: Chainlink L2 sequencer uptime feeds Arbitrum documentation ...
codex
Validation confirms three issues should be treated as immediate deployment blockers: anyone can replace the implementation, anyone can replace the oracle, and anyone can change the liquidation threshold. The report will rank those first, then the health-factor precision bug and launch oracle configuration, which can liquidate otherwise healthy wstETH positions.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001/AUDIT-REPORT.md
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6d42af9c0edb8e4cb350945476a81e939c2105d2
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,126 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `README.md` and all Solidity files under `src/`  
+**Deployment target:** Arbitrum One  
+**Launch assets:** native USDC debt and wstETH collateral
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permissionless administration paths let any account take control of the market or make arbitrary debt appear healthy. Separately, the health-factor formula loses nearly all ratio precision, and the planned wstETH configuration uses a stETH price without applying the wstETH/stETH conversion rate. Both issues can liquidate positions well before the documented 80% threshold.
+
+Findings are ranked by the order in which the team should address them. The review found **3 critical, 3 high, 6 medium, and 2 low** issues. C-01 through H-03 are launch blockers. M-05 is a blocker before listing fee-charging, rebasing, or otherwise non-standard collateral.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take every asset |
+| 2 | C-02 | Critical | Anyone can install an attacker-controlled oracle |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold |
+| 4 | H-01 | High | Health-factor division rounds the collateral ratio down to an integer |
+| 5 | H-02 | High | Oracle accepts stale, incomplete, and L2-downtime prices |
+| 6 | H-03 | High | wstETH is configured with a stETH/USD feed without conversion |
+| 7 | M-01 | Medium | Signed borrow authorizations can be replayed indefinitely |
+| 8 | M-02 | Medium | Zero-value borrows can permanently bloat the liquidation loop |
+| 9 | M-03 | Medium | Repayment rounding can take payment without reducing debt |
+| 10 | M-04 | Medium | ERC-20 return values are ignored |
+| 11 | M-05 | Medium | Vault accounting is unsafe for fee-charging, rebasing, and callback tokens |
+| 12 | M-06 | Medium | Deeply underwater debt has no practical liquidation or resolution path |
+| 13 | L-01 | Low | Initialization and upgrades do not validate critical addresses or code |
+| 14 | L-02 | Low | Bulk liquidation is all-or-nothing and unbounded |
+
+## Detailed findings
+
+### C-01 — Anyone can upgrade the proxy and take every asset
+
+- **Location:** `LendingMarket.upgradeTo`
+- **Impact:** The function has no access control. Any account can set the ERC-1967 implementation slot to an attacker contract. That implementation executes in the proxy's storage context and can transfer all USDC held by the market, change every position, authorize itself to seize collateral through the vault, or permanently brick the proxy. The attacker gets the entire treasury USDC balance and can steal all collateral held for users.
+- **Fix:** Restrict upgrades to a properly secured owner/timelock, preferably through a standard audited UUPS implementation. Require `newImplementation.code.length > 0`, perform the UUPS compatibility check, emit the upgrade event only after validation, and put production ownership behind a multisig plus timelock. Test both unauthorized calls and storage compatibility across upgrades.
+
+### C-02 — Anyone can install an attacker-controlled oracle
+
+- **Location:** `LendingMarket.setOracle`; consumed by `collateralValueUsd`, `debtValueUsd`, `_borrow`, and `_liquidate`
+- **Impact:** `setOracle` has no access control. An attacker can install a `PriceOracle` they own, assign feeds returning an enormous collateral price and a tiny debt-asset price, deposit minimal wstETH, and borrow the market's entire USDC balance. They can then change prices again to liquidate other users for their collateral. The attacker gets treasury USDC and potentially the collateral of every borrower.
+- **Fix:** Add `onlyOwner`; validate a nonzero contract address; and use a timelocked two-step oracle change with an emergency pause. Consider keeping feed configuration in the market's governance boundary so changing the oracle implementation cannot silently change every price. Add a maximum per-transaction/cumulative borrow-liquidity check as defense in depth.
+
+### C-03 — Anyone can change the liquidation threshold
+
+- **Location:** `LendingMarket.setLiquidationThreshold`; consumed by `healthFactor`
+- **Impact:** `setLiquidationThreshold` has no access control or bounds. An attacker can raise it far above 10,000 bps, make a minimally collateralized account appear healthy, and drain treasury USDC through `borrow`. Setting it very low can instead make users liquidatable so the caller can repay their debt and collect collateral plus the 5% bonus. Extreme values can also overflow health calculations and deny service. The attacker gets USDC or liquidation bonuses; users lose collateral.
+- **Fix:** Add `onlyOwner`, constrain the value to an explicitly approved range at or below `BPS`, and route risk changes through a timelock. Accrue interest before a risk-parameter change and consider a delay or pause so users can exit before a more aggressive threshold becomes active.
+
+### H-01 — Health-factor division rounds the collateral ratio down to an integer
+
+- **Location:** `LendingMarket.healthFactor`
+- **Impact:** The expression divides `collateralValueUsd(user)` by `debtUsd` before multiplying by `WAD`. Ratios from 1.00 through 1.99 therefore all become `1`. With an 80% threshold, every such position reports a health factor of 0.8 and can be liquidated. In practice, borrowing is limited to roughly 50% LTV instead of the documented 80%, and a position at exactly 50% LTV can become fully liquidatable after an arbitrarily small adverse price move. Liquidators receive the 5% bonus while unlucky users lose collateral despite being healthy under the intended formula.
+- **Fix:** Multiply before dividing, using full-precision multiplication/division to avoid overflow: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Use a tested `mulDiv` implementation and add boundary tests immediately below, at, and above 80% LTV, including non-integer ratios.
+
+### H-02 — Oracle accepts stale, incomplete, and L2-downtime prices
+
+- **Location:** `PriceOracle.getPrice`
+- **Impact:** The oracle uses `latestAnswer()` and checks neither positivity nor freshness. A stale positive price can allow excess borrowing after collateral falls or cause wrongful liquidation after it rises. A zero answer values collateral at zero; a negative answer reverts during the signed-to-unsigned conversion and freezes borrowing, withdrawal health checks, and liquidations. On Arbitrum, the design also lacks a sequencer-uptime check and recovery grace period, so users or searchers can act on feeds before prices safely resume after downtime. Attackers can get underpriced loans or discounted collateral; users and the treasury bear insolvency or liquidation losses.
+- **Fix:** Use `latestRoundData()` and require `answer > 0`, a nonzero `updatedAt` within a per-feed heartbeat, and a complete round (`answeredInRound >= roundId`). On Arbitrum, check the Chainlink sequencer uptime feed and enforce a grace period after recovery. Make stale/invalid data fail closed, add a pause path, and normalize feed decimals safely for values both below and above 18.
+
+### H-03 — wstETH is configured with a stETH/USD feed without conversion
+
+- **Location:** launch configuration in `README.md`; `PriceOracle.getPrice`; `LendingMarket.collateralValueUsd`
+- **Impact:** The listed collateral is wstETH, but the configured feed is stETH/USD. One wstETH represents more than one stETH, and that conversion rate changes as staking rewards accrue. Treating one wstETH as one stETH systematically undervalues collateral and causes users to have lower borrowing power and to be liquidated earlier than the advertised threshold. Liquidators receive bonuses from positions that are healthy when valued as wstETH; affected users lose collateral. The error compounds H-01.
+- **Fix:** Price wstETH by composing the stETH/USD price with the canonical wstETH-to-stETH conversion (or use a suitable wstETH/USD feed if available). Normalize both legs to a common precision, validate each underlying datum, and add fork/configuration tests against the canonical wstETH contract and configured feed addresses before deployment.
+
+### M-01 — Signed borrow authorizations can be replayed indefinitely
+
+- **Location:** `LendingMarket.borrowWithSig`
+- **Impact:** The signed struct contains only borrower and amount. It has no nonce or deadline, and no digest is marked used. Any relayer that sees one valid signature can submit it repeatedly until the account reaches its borrowing limit. USDC is sent to the borrower, so the relayer does not receive it directly, but the borrower receives unwanted debt, accrues interest, and can be pushed close to liquidation. A relayer can later liquidate the position for the bonus or grief a user indefinitely with an old authorization.
+- **Fix:** Include a per-borrower nonce, deadline, and preferably the intended receiver/relayer in the EIP-712 struct. Increment the nonce before external interactions, reject expired signatures, enforce canonical `s` and valid `v` values (or use a tested ECDSA library), and support explicit nonce cancellation.
+
+### M-02 — Zero-value borrows can permanently bloat the liquidation loop
+
+- **Location:** `LendingMarket._borrow` and `LendingMarket.liquidateAll`
+- **Impact:** When `principalOf[borrower] == 0`, `_borrow` appends the caller before adding principal. `borrow(0)` leaves principal at zero, so any account can call it repeatedly and append unlimited duplicate entries at only gas cost. Repaid borrowers can also be appended again. The `borrowers` array is never pruned. An attacker can make `liquidateAll` exceed the block gas limit, disabling the keeper path specifically intended for large price moves and increasing insolvency risk during volatility.
+- **Fix:** Reject zero amounts, maintain a separate `isBorrower` membership flag, and remove or mark borrowers inactive when debt is cleared. Replace the unbounded sweep with paginated liquidation over caller-supplied accounts; individual liquidation should remain the primary permissionless path.
+
+### M-03 — Repayment rounding can take payment without reducing debt
+
+- **Location:** `LendingMarket.repay` and `LendingMarket.debtOf`
+- **Impact:** Repayment burns `amount * WAD / borrowIndex` principal units, rounding down. A sufficiently small nonzero repayment can burn zero principal even though USDC is transferred. Even when paying the reported full debt, double rounding can leave principal dust, so a user may be unable to fully close the position and withdraw collateral without making further payments. The market keeps USDC that did not reduce debt; unlucky users overpay and may remain exposed to liquidation.
+- **Fix:** If `amount == debt`, set principal to zero explicitly. For partial repayment, compute debt shares with a well-defined rounding direction and either reject an amount that burns zero shares or credit the exact shares burned and transfer only the corresponding assets. Add tests across large index values and one-unit boundaries.
+
+### M-04 — ERC-20 return values are ignored
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, and `seize`; `LendingMarket._borrow`, `repay`, and `_liquidate`
+- **Impact:** Every token transfer assumes success even when an ERC-20 returns `false`. A false-returning collateral token can create an accounting balance without transferring assets, enabling treasury USDC to be borrowed against nothing. A false-returning debt token can erase debt without collecting repayment, or record debt without delivering borrowed USDC. Canonical launch assets normally revert or return true, but this becomes exploitable through a bad future listing, bad deployment configuration, or token upgrade.
+- **Fix:** Use a well-tested safe-transfer wrapper that accepts either no return data or decoded `true` and reverts otherwise. Combine it with actual-balance-delta accounting for deposits and repayments where supported.
+
+### M-05 — Vault accounting is unsafe for fee-charging, rebasing, and callback tokens
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, `seize`, and `balanceOf`; `LendingMarket.listCollateral`
+- **Impact:** Deposits credit the requested amount rather than the amount received, external calls occur before accounting is finalized, and balances are stored as fixed token units. A fee-on-transfer token can therefore create phantom collateral and borrow real USDC; a callback-capable token can reenter withdrawal while the old balance is still recorded; positive or negative rebases desynchronize user claims from vault assets. This is especially relevant to the stated roadmap for yield-bearing and rebasing collateral. An attacker gets treasury USDC or other users' collateral; honest users can become unable to withdraw their recorded balances.
+- **Fix:** Do not list such assets with the current vault. Use checks-effects-interactions plus a reentrancy guard, credit verified balance deltas, and implement share-based accounting for rebasing/yield-bearing assets. Give each asset an adapter with explicit invariants and caps rather than treating all ERC-20s identically.
+
+### M-06 — Deeply underwater debt has no practical liquidation or resolution path
+
+- **Location:** `LendingMarket.liquidate` and `_liquidate`
+- **Impact:** A liquidator must repay 100% of a borrower's debt before collateral is seized. If collateral is worth less than the debt (or less than debt plus the bonus), liquidation is economically irrational, and there is no partial liquidation, bad-debt write-off, reserve, or collateral auction. After a price gap or oracle failure, bad positions can remain indefinitely and treasury USDC becomes unrecoverable. The borrower retains any previously borrowed value while the treasury absorbs the shortfall.
+- **Fix:** Add bounded partial liquidation and cap repayment by available collateral at the bonus-adjusted price. Define an explicit insolvency path—reserve/insurance, bad-debt accounting, or governance-controlled resolution—and test price gaps, exhausted collateral, and rounding at the final liquidation.
+
+### L-01 — Initialization and upgrades do not validate critical addresses or code
+
+- **Location:** `LendingMarket.initialize`, `LendingMarket.upgradeTo`, and `MarketProxy.constructor`
+- **Impact:** Initialization accepts zero addresses, mismatched vaults, EOAs, or contracts on the wrong network. The proxy and upgrade function accept an implementation with no code or an incompatible storage layout. If the proxy is ever deployed without atomic `initData`, another account can initialize it first. These errors can brick the market, strand funds, or give ownership to the wrong account; a front-runner gets control if initialization is exposed.
+- **Fix:** Always initialize atomically in the proxy constructor. Validate nonzero addresses, deployed code, the expected vault-to-market relationship, token identity/decimals, chain ID, and UUPS compatibility. Disable initializers on the implementation and add deployment assertions for every address in the README.
+
+### L-02 — Bulk liquidation is all-or-nothing and unbounded
+
+- **Location:** `LendingMarket.liquidateAll`
+- **Impact:** The function scans the complete historical borrowers array in one transaction and performs all liquidations using one caller's balance and allowance. Growth alone eventually makes it exceed the block gas limit; one transfer/oracle/seizure revert also rolls back every earlier liquidation. Keepers lose gas and underwater accounts later in the array remain untouched. M-02 makes this failure permissionlessly triggerable.
+- **Fix:** Remove the global sweep or paginate it with explicit start/end bounds and per-account failure isolation. Let keepers submit selected borrowers, emit failures without reverting successful independent liquidations where safe, and avoid relying on an ever-growing on-chain enumeration.
+
+## Additional observations and deployment recommendations
+
+- `setBorrowRate` is owner-only but unbounded. Governance can accidentally choose a value that makes accrual overflow or makes debt grow catastrophically. Cap it and apply changes through a timelock.
+- Interest uses `block.number` multiplied by a fixed 12 seconds. Verify this approximation against Arbitrum One's block-number semantics and operational requirements; timestamp-based accrual with bounded elapsed time is easier to reason about across L2 behavior changes.
+- There is no pause mechanism. Add narrowly scoped emergency stops for new borrowing and collateral withdrawal/liquidation behavior, with a governance design that cannot permanently trap healthy users.
+- Add events and two-step acceptance for ownership changes in `LendingMarket`; use separate, documented roles for upgrades, oracle/risk changes, and emergency response.
+
+## Review limitations
+
+The repository contains no tests or deployment scripts, so this review could not verify constructor ordering, proxy/vault address derivation, role custody, configured feed heartbeats, or deployed bytecode. The contracts compile successfully with Solidity 0.8.28. This was a focused manual source review, not a guarantee that all vulnerabilities are identified. Before launch, implement the fixes, add invariant/fuzz and Arbitrum-fork tests, and obtain a follow-up review of the exact deployment configuration and upgrade/storage-layout process.

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6d42af9c0edb8e4cb350945476a81e939c2105d2
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,126 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `README.md` and all Solidity files under `src/`  
+**Deployment target:** Arbitrum One  
+**Launch assets:** native USDC debt and wstETH collateral
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permissionless administration paths let any account take control of the market or make arbitrary debt appear healthy. Separately, the health-factor formula loses nearly all ratio precision, and the planned wstETH configuration uses a stETH price without applying the wstETH/stETH conversion rate. Both issues can liquidate positions well before the documented 80% threshold.
+
+Findings are ranked by the order in which the team should address them. The review found **3 critical, 3 high, 6 medium, and 2 low** issues. C-01 through H-03 are launch blockers. M-05 is a blocker before listing fee-charging, rebasing, or otherwise non-standard collateral.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take every asset |
+| 2 | C-02 | Critical | Anyone can install an attacker-controlled oracle |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold |
+| 4 | H-01 | High | Health-factor division rounds the collateral ratio down to an integer |
+| 5 | H-02 | High | Oracle accepts stale, incomplete, and L2-downtime prices |
+| 6 | H-03 | High | wstETH is configured with a stETH/USD feed without conversion |
+| 7 | M-01 | Medium | Signed borrow authorizations can be replayed indefinitely |
+| 8 | M-02 | Medium | Zero-value borrows can permanently bloat the liquidation loop |
+| 9 | M-03 | Medium | Repayment rounding can take payment without reducing debt |
+| 10 | M-04 | Medium | ERC-20 return values are ignored |
+| 11 | M-05 | Medium | Vault accounting is unsafe for fee-charging, rebasing, and callback tokens |
+| 12 | M-06 | Medium | Deeply underwater debt has no practical liquidation or resolution path |
+| 13 | L-01 | Low | Initialization and upgrades do not validate critical addresses or code |
+| 14 | L-02 | Low | Bulk liquidation is all-or-nothing and unbounded |
+
+## Detailed findings
+
+### C-01 — Anyone can upgrade the proxy and take every asset
+
+- **Location:** `LendingMarket.upgradeTo`
+- **Impact:** The function has no access control. Any account can set the ERC-1967 implementation slot to an attacker contract. That implementation executes in the proxy's storage context and can transfer all USDC held by the market, change every position, authorize itself to seize collateral through the vault, or permanently brick the proxy. The attacker gets the entire treasury USDC balance and can steal all collateral held for users.
+- **Fix:** Restrict upgrades to a properly secured owner/timelock, preferably through a standard audited UUPS implementation. Require `newImplementation.code.length > 0`, perform the UUPS compatibility check, emit the upgrade event only after validation, and put production ownership behind a multisig plus timelock. Test both unauthorized calls and storage compatibility across upgrades.
+
+### C-02 — Anyone can install an attacker-controlled oracle
+
+- **Location:** `LendingMarket.setOracle`; consumed by `collateralValueUsd`, `debtValueUsd`, `_borrow`, and `_liquidate`
+- **Impact:** `setOracle` has no access control. An attacker can install a `PriceOracle` they own, assign feeds returning an enormous collateral price and a tiny debt-asset price, deposit minimal wstETH, and borrow the market's entire USDC balance. They can then change prices again to liquidate other users for their collateral. The attacker gets treasury USDC and potentially the collateral of every borrower.
+- **Fix:** Add `onlyOwner`; validate a nonzero contract address; and use a timelocked two-step oracle change with an emergency pause. Consider keeping feed configuration in the market's governance boundary so changing the oracle implementation cannot silently change every price. Add a maximum per-transaction/cumulative borrow-liquidity check as defense in depth.
+
+### C-03 — Anyone can change the liquidation threshold
+
+- **Location:** `LendingMarket.setLiquidationThreshold`; consumed by `healthFactor`
+- **Impact:** `setLiquidationThreshold` has no access control or bounds. An attacker can raise it far above 10,000 bps, make a minimally collateralized account appear healthy, and drain treasury USDC through `borrow`. Setting it very low can instead make users liquidatable so the caller can repay their debt and collect collateral plus the 5% bonus. Extreme values can also overflow health calculations and deny service. The attacker gets USDC or liquidation bonuses; users lose collateral.
+- **Fix:** Add `onlyOwner`, constrain the value to an explicitly approved range at or below `BPS`, and route risk changes through a timelock. Accrue interest before a risk-parameter change and consider a delay or pause so users can exit before a more aggressive threshold becomes active.
+
+### H-01 — Health-factor division rounds the collateral ratio down to an integer
+
+- **Location:** `LendingMarket.healthFactor`
+- **Impact:** The expression divides `collateralValueUsd(user)` by `debtUsd` before multiplying by `WAD`. Ratios from 1.00 through 1.99 therefore all become `1`. With an 80% threshold, every such position reports a health factor of 0.8 and can be liquidated. In practice, borrowing is limited to roughly 50% LTV instead of the documented 80%, and a position at exactly 50% LTV can become fully liquidatable after an arbitrarily small adverse price move. Liquidators receive the 5% bonus while unlucky users lose collateral despite being healthy under the intended formula.
+- **Fix:** Multiply before dividing, using full-precision multiplication/division to avoid overflow: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Use a tested `mulDiv` implementation and add boundary tests immediately below, at, and above 80% LTV, including non-integer ratios.
+
+### H-02 — Oracle accepts stale, incomplete, and L2-downtime prices
+
+- **Location:** `PriceOracle.getPrice`
+- **Impact:** The oracle uses `latestAnswer()` and checks neither positivity nor freshness. A stale positive price can allow excess borrowing after collateral falls or cause wrongful liquidation after it rises. A zero answer values collateral at zero; a negative answer reverts during the signed-to-unsigned conversion and freezes borrowing, withdrawal health checks, and liquidations. On Arbitrum, the design also lacks a sequencer-uptime check and recovery grace period, so users or searchers can act on feeds before prices safely resume after downtime. Attackers can get underpriced loans or discounted collateral; users and the treasury bear insolvency or liquidation losses.
+- **Fix:** Use `latestRoundData()` and require `answer > 0`, a nonzero `updatedAt` within a per-feed heartbeat, and a complete round (`answeredInRound >= roundId`). On Arbitrum, check the Chainlink sequencer uptime feed and enforce a grace period after recovery. Make stale/invalid data fail closed, add a pause path, and normalize feed decimals safely for values both below and above 18.
+
+### H-03 — wstETH is configured with a stETH/USD feed without conversion
+
+- **Location:** launch configuration in `README.md`; `PriceOracle.getPrice`; `LendingMarket.collateralValueUsd`
+- **Impact:** The listed collateral is wstETH, but the configured feed is stETH/USD. One wstETH represents more than one stETH, and that conversion rate changes as staking rewards accrue. Treating one wstETH as one stETH systematically undervalues collateral and causes users to have lower borrowing power and to be liquidated earlier than the advertised threshold. Liquidators receive bonuses from positions that are healthy when valued as wstETH; affected users lose collateral. The error compounds H-01.
+- **Fix:** Price wstETH by composing the stETH/USD price with the canonical wstETH-to-stETH conversion (or use a suitable wstETH/USD feed if available). Normalize both legs to a common precision, validate each underlying datum, and add fork/configuration tests against the canonical wstETH contract and configured feed addresses before deployment.
+
+### M-01 — Signed borrow authorizations can be replayed indefinitely
+
+- **Location:** `LendingMarket.borrowWithSig`
+- **Impact:** The signed struct contains only borrower and amount. It has no nonce or deadline, and no digest is marked used. Any relayer that sees one valid signature can submit it repeatedly until the account reaches its borrowing limit. USDC is sent to the borrower, so the relayer does not receive it directly, but the borrower receives unwanted debt, accrues interest, and can be pushed close to liquidation. A relayer can later liquidate the position for the bonus or grief a user indefinitely with an old authorization.
+- **Fix:** Include a per-borrower nonce, deadline, and preferably the intended receiver/relayer in the EIP-712 struct. Increment the nonce before external interactions, reject expired signatures, enforce canonical `s` and valid `v` values (or use a tested ECDSA library), and support explicit nonce cancellation.
+
+### M-02 — Zero-value borrows can permanently bloat the liquidation loop
+
+- **Location:** `LendingMarket._borrow` and `LendingMarket.liquidateAll`
+- **Impact:** When `principalOf[borrower] == 0`, `_borrow` appends the caller before adding principal. `borrow(0)` leaves principal at zero, so any account can call it repeatedly and append unlimited duplicate entries at only gas cost. Repaid borrowers can also be appended again. The `borrowers` array is never pruned. An attacker can make `liquidateAll` exceed the block gas limit, disabling the keeper path specifically intended for large price moves and increasing insolvency risk during volatility.
+- **Fix:** Reject zero amounts, maintain a separate `isBorrower` membership flag, and remove or mark borrowers inactive when debt is cleared. Replace the unbounded sweep with paginated liquidation over caller-supplied accounts; individual liquidation should remain the primary permissionless path.
+
+### M-03 — Repayment rounding can take payment without reducing debt
+
+- **Location:** `LendingMarket.repay` and `LendingMarket.debtOf`
+- **Impact:** Repayment burns `amount * WAD / borrowIndex` principal units, rounding down. A sufficiently small nonzero repayment can burn zero principal even though USDC is transferred. Even when paying the reported full debt, double rounding can leave principal dust, so a user may be unable to fully close the position and withdraw collateral without making further payments. The market keeps USDC that did not reduce debt; unlucky users overpay and may remain exposed to liquidation.
+- **Fix:** If `amount == debt`, set principal to zero explicitly. For partial repayment, compute debt shares with a well-defined rounding direction and either reject an amount that burns zero shares or credit the exact shares burned and transfer only the corresponding assets. Add tests across large index values and one-unit boundaries.
+
+### M-04 — ERC-20 return values are ignored
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, and `seize`; `LendingMarket._borrow`, `repay`, and `_liquidate`
+- **Impact:** Every token transfer assumes success even when an ERC-20 returns `false`. A false-returning collateral token can create an accounting balance without transferring assets, enabling treasury USDC to be borrowed against nothing. A false-returning debt token can erase debt without collecting repayment, or record debt without delivering borrowed USDC. Canonical launch assets normally revert or return true, but this becomes exploitable through a bad future listing, bad deployment configuration, or token upgrade.
+- **Fix:** Use a well-tested safe-transfer wrapper that accepts either no return data or decoded `true` and reverts otherwise. Combine it with actual-balance-delta accounting for deposits and repayments where supported.
+
+### M-05 — Vault accounting is unsafe for fee-charging, rebasing, and callback tokens
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, `seize`, and `balanceOf`; `LendingMarket.listCollateral`
+- **Impact:** Deposits credit the requested amount rather than the amount received, external calls occur before accounting is finalized, and balances are stored as fixed token units. A fee-on-transfer token can therefore create phantom collateral and borrow real USDC; a callback-capable token can reenter withdrawal while the old balance is still recorded; positive or negative rebases desynchronize user claims from vault assets. This is especially relevant to the stated roadmap for yield-bearing and rebasing collateral. An attacker gets treasury USDC or other users' collateral; honest users can become unable to withdraw their recorded balances.
+- **Fix:** Do not list such assets with the current vault. Use checks-effects-interactions plus a reentrancy guard, credit verified balance deltas, and implement share-based accounting for rebasing/yield-bearing assets. Give each asset an adapter with explicit invariants and caps rather than treating all ERC-20s identically.
+
+### M-06 — Deeply underwater debt has no practical liquidation or resolution path
+
+- **Location:** `LendingMarket.liquidate` and `_liquidate`
+- **Impact:** A liquidator must repay 100% of a borrower's debt before collateral is seized. If collateral is worth less than the debt (or less than debt plus the bonus), liquidation is economically irrational, and there is no partial liquidation, bad-debt write-off, reserve, or collateral auction. After a price gap or oracle failure, bad positions can remain indefinitely and treasury USDC becomes unrecoverable. The borrower retains any previously borrowed value while the treasury absorbs the shortfall.
+- **Fix:** Add bounded partial liquidation and cap repayment by available collateral at the bonus-adjusted price. Define an explicit insolvency path—reserve/insurance, bad-debt accounting, or governance-controlled resolution—and test price gaps, exhausted collateral, and rounding at the final liquidation.
+
+### L-01 — Initialization and upgrades do not validate critical addresses or code
+
+- **Location:** `LendingMarket.initialize`, `LendingMarket.upgradeTo`, and `MarketProxy.constructor`
+- **Impact:** Initialization accepts zero addresses, mismatched vaults, EOAs, or contracts on the wrong network. The proxy and upgrade function accept an implementation with no code or an incompatible storage layout. If the proxy is ever deployed without atomic `initData`, another account can initialize it first. These errors can brick the market, strand funds, or give ownership to the wrong account; a front-runner gets control if initialization is exposed.
+- **Fix:** Always initialize atomically in the proxy constructor. Validate nonzero addresses, deployed code, the expected vault-to-market relationship, token identity/decimals, chain ID, and UUPS compatibility. Disable initializers on the implementation and add deployment assertions for every address in the README.
+
+### L-02 — Bulk liquidation is all-or-nothing and unbounded
+
+- **Location:** `LendingMarket.liquidateAll`
+- **Impact:** The function scans the complete historical borrowers array in one transaction and performs all liquidations using one caller's balance and allowance. Growth alone eventually makes it exceed the block gas limit; one transfer/oracle/seizure revert also rolls back every earlier liquidation. Keepers lose gas and underwater accounts later in the array remain untouched. M-02 makes this failure permissionlessly triggerable.
+- **Fix:** Remove the global sweep or paginate it with explicit start/end bounds and per-account failure isolation. Let keepers submit selected borrowers, emit failures without reverting successful independent liquidations where safe, and avoid relying on an ever-growing on-chain enumeration.
+
+## Additional observations and deployment recommendations
+
+- `setBorrowRate` is owner-only but unbounded. Governance can accidentally choose a value that makes accrual overflow or makes debt grow catastrophically. Cap it and apply changes through a timelock.
+- Interest uses `block.number` multiplied by a fixed 12 seconds. Verify this approximation against Arbitrum One's block-number semantics and operational requirements; timestamp-based accrual with bounded elapsed time is easier to reason about across L2 behavior changes.
+- There is no pause mechanism. Add narrowly scoped emergency stops for new borrowing and collateral withdrawal/liquidation behavior, with a governance design that cannot permanently trap healthy users.
+- Add events and two-step acceptance for ownership changes in `LendingMarket`; use separate, documented roles for upgrades, oracle/risk changes, and emergency response.
+
+## Review limitations
+
+The repository contains no tests or deployment scripts, so this review could not verify constructor ordering, proxy/vault address derivation, role custody, configured feed heartbeats, or deployed bytecode. The contracts compile successfully with Solidity 0.8.28. This was a focused manual source review, not a guarantee that all vulnerabilities are identified. Before launch, implement the fixes, add invariant/fuzz and Arbitrum-fork tests, and obtain a follow-up review of the exact deployment configuration and upgrade/storage-layout process.

exec
/bin/bash -lc "test -f AUDIT-REPORT.md && wc -l AUDIT-REPORT.md && find . -maxdepth 2 -mindepth 1 -not -path './.git*' -print | sort && git status --short && git diff -- src && git diff --check -- AUDIT-REPORT.md" in /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001
 succeeded in 3ms:
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6d42af9c0edb8e4cb350945476a81e939c2105d2
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,126 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `README.md` and all Solidity files under `src/`  
+**Deployment target:** Arbitrum One  
+**Launch assets:** native USDC debt and wstETH collateral
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permissionless administration paths let any account take control of the market or make arbitrary debt appear healthy. Separately, the health-factor formula loses nearly all ratio precision, and the planned wstETH configuration uses a stETH price without applying the wstETH/stETH conversion rate. Both issues can liquidate positions well before the documented 80% threshold.
+
+Findings are ranked by the order in which the team should address them. The review found **3 critical, 3 high, 6 medium, and 2 low** issues. C-01 through H-03 are launch blockers. M-05 is a blocker before listing fee-charging, rebasing, or otherwise non-standard collateral.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take every asset |
+| 2 | C-02 | Critical | Anyone can install an attacker-controlled oracle |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold |
+| 4 | H-01 | High | Health-factor division rounds the collateral ratio down to an integer |
+| 5 | H-02 | High | Oracle accepts stale, incomplete, and L2-downtime prices |
+| 6 | H-03 | High | wstETH is configured with a stETH/USD feed without conversion |
+| 7 | M-01 | Medium | Signed borrow authorizations can be replayed indefinitely |
+| 8 | M-02 | Medium | Zero-value borrows can permanently bloat the liquidation loop |
+| 9 | M-03 | Medium | Repayment rounding can take payment without reducing debt |
+| 10 | M-04 | Medium | ERC-20 return values are ignored |
+| 11 | M-05 | Medium | Vault accounting is unsafe for fee-charging, rebasing, and callback tokens |
+| 12 | M-06 | Medium | Deeply underwater debt has no practical liquidation or resolution path |
+| 13 | L-01 | Low | Initialization and upgrades do not validate critical addresses or code |
+| 14 | L-02 | Low | Bulk liquidation is all-or-nothing and unbounded |
+
+## Detailed findings
+
+### C-01 — Anyone can upgrade the proxy and take every asset
+
+- **Location:** `LendingMarket.upgradeTo`
+- **Impact:** The function has no access control. Any account can set the ERC-1967 implementation slot to an attacker contract. That implementation executes in the proxy's storage context and can transfer all USDC held by the market, change every position, authorize itself to seize collateral through the vault, or permanently brick the proxy. The attacker gets the entire treasury USDC balance and can steal all collateral held for users.
+- **Fix:** Restrict upgrades to a properly secured owner/timelock, preferably through a standard audited UUPS implementation. Require `newImplementation.code.length > 0`, perform the UUPS compatibility check, emit the upgrade event only after validation, and put production ownership behind a multisig plus timelock. Test both unauthorized calls and storage compatibility across upgrades.
+
+### C-02 — Anyone can install an attacker-controlled oracle
+
+- **Location:** `LendingMarket.setOracle`; consumed by `collateralValueUsd`, `debtValueUsd`, `_borrow`, and `_liquidate`
+- **Impact:** `setOracle` has no access control. An attacker can install a `PriceOracle` they own, assign feeds returning an enormous collateral price and a tiny debt-asset price, deposit minimal wstETH, and borrow the market's entire USDC balance. They can then change prices again to liquidate other users for their collateral. The attacker gets treasury USDC and potentially the collateral of every borrower.
+- **Fix:** Add `onlyOwner`; validate a nonzero contract address; and use a timelocked two-step oracle change with an emergency pause. Consider keeping feed configuration in the market's governance boundary so changing the oracle implementation cannot silently change every price. Add a maximum per-transaction/cumulative borrow-liquidity check as defense in depth.
+
+### C-03 — Anyone can change the liquidation threshold
+
+- **Location:** `LendingMarket.setLiquidationThreshold`; consumed by `healthFactor`
+- **Impact:** `setLiquidationThreshold` has no access control or bounds. An attacker can raise it far above 10,000 bps, make a minimally collateralized account appear healthy, and drain treasury USDC through `borrow`. Setting it very low can instead make users liquidatable so the caller can repay their debt and collect collateral plus the 5% bonus. Extreme values can also overflow health calculations and deny service. The attacker gets USDC or liquidation bonuses; users lose collateral.
+- **Fix:** Add `onlyOwner`, constrain the value to an explicitly approved range at or below `BPS`, and route risk changes through a timelock. Accrue interest before a risk-parameter change and consider a delay or pause so users can exit before a more aggressive threshold becomes active.
+
+### H-01 — Health-factor division rounds the collateral ratio down to an integer
+
+- **Location:** `LendingMarket.healthFactor`
+- **Impact:** The expression divides `collateralValueUsd(user)` by `debtUsd` before multiplying by `WAD`. Ratios from 1.00 through 1.99 therefore all become `1`. With an 80% threshold, every such position reports a health factor of 0.8 and can be liquidated. In practice, borrowing is limited to roughly 50% LTV instead of the documented 80%, and a position at exactly 50% LTV can become fully liquidatable after an arbitrarily small adverse price move. Liquidators receive the 5% bonus while unlucky users lose collateral despite being healthy under the intended formula.
+- **Fix:** Multiply before dividing, using full-precision multiplication/division to avoid overflow: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Use a tested `mulDiv` implementation and add boundary tests immediately below, at, and above 80% LTV, including non-integer ratios.
+
+### H-02 — Oracle accepts stale, incomplete, and L2-downtime prices
+
+- **Location:** `PriceOracle.getPrice`
+- **Impact:** The oracle uses `latestAnswer()` and checks neither positivity nor freshness. A stale positive price can allow excess borrowing after collateral falls or cause wrongful liquidation after it rises. A zero answer values collateral at zero; a negative answer reverts during the signed-to-unsigned conversion and freezes borrowing, withdrawal health checks, and liquidations. On Arbitrum, the design also lacks a sequencer-uptime check and recovery grace period, so users or searchers can act on feeds before prices safely resume after downtime. Attackers can get underpriced loans or discounted collateral; users and the treasury bear insolvency or liquidation losses.
+- **Fix:** Use `latestRoundData()` and require `answer > 0`, a nonzero `updatedAt` within a per-feed heartbeat, and a complete round (`answeredInRound >= roundId`). On Arbitrum, check the Chainlink sequencer uptime feed and enforce a grace period after recovery. Make stale/invalid data fail closed, add a pause path, and normalize feed decimals safely for values both below and above 18.
+
+### H-03 — wstETH is configured with a stETH/USD feed without conversion
+
+- **Location:** launch configuration in `README.md`; `PriceOracle.getPrice`; `LendingMarket.collateralValueUsd`
+- **Impact:** The listed collateral is wstETH, but the configured feed is stETH/USD. One wstETH represents more than one stETH, and that conversion rate changes as staking rewards accrue. Treating one wstETH as one stETH systematically undervalues collateral and causes users to have lower borrowing power and to be liquidated earlier than the advertised threshold. Liquidators receive bonuses from positions that are healthy when valued as wstETH; affected users lose collateral. The error compounds H-01.
+- **Fix:** Price wstETH by composing the stETH/USD price with the canonical wstETH-to-stETH conversion (or use a suitable wstETH/USD feed if available). Normalize both legs to a common precision, validate each underlying datum, and add fork/configuration tests against the canonical wstETH contract and configured feed addresses before deployment.
+
+### M-01 — Signed borrow authorizations can be replayed indefinitely
+
+- **Location:** `LendingMarket.borrowWithSig`
+- **Impact:** The signed struct contains only borrower and amount. It has no nonce or deadline, and no digest is marked used. Any relayer that sees one valid signature can submit it repeatedly until the account reaches its borrowing limit. USDC is sent to the borrower, so the relayer does not receive it directly, but the borrower receives unwanted debt, accrues interest, and can be pushed close to liquidation. A relayer can later liquidate the position for the bonus or grief a user indefinitely with an old authorization.
+- **Fix:** Include a per-borrower nonce, deadline, and preferably the intended receiver/relayer in the EIP-712 struct. Increment the nonce before external interactions, reject expired signatures, enforce canonical `s` and valid `v` values (or use a tested ECDSA library), and support explicit nonce cancellation.
+
+### M-02 — Zero-value borrows can permanently bloat the liquidation loop
+
+- **Location:** `LendingMarket._borrow` and `LendingMarket.liquidateAll`
+- **Impact:** When `principalOf[borrower] == 0`, `_borrow` appends the caller before adding principal. `borrow(0)` leaves principal at zero, so any account can call it repeatedly and append unlimited duplicate entries at only gas cost. Repaid borrowers can also be appended again. The `borrowers` array is never pruned. An attacker can make `liquidateAll` exceed the block gas limit, disabling the keeper path specifically intended for large price moves and increasing insolvency risk during volatility.
+- **Fix:** Reject zero amounts, maintain a separate `isBorrower` membership flag, and remove or mark borrowers inactive when debt is cleared. Replace the unbounded sweep with paginated liquidation over caller-supplied accounts; individual liquidation should remain the primary permissionless path.
+
+### M-03 — Repayment rounding can take payment without reducing debt
+
+- **Location:** `LendingMarket.repay` and `LendingMarket.debtOf`
+- **Impact:** Repayment burns `amount * WAD / borrowIndex` principal units, rounding down. A sufficiently small nonzero repayment can burn zero principal even though USDC is transferred. Even when paying the reported full debt, double rounding can leave principal dust, so a user may be unable to fully close the position and withdraw collateral without making further payments. The market keeps USDC that did not reduce debt; unlucky users overpay and may remain exposed to liquidation.
+- **Fix:** If `amount == debt`, set principal to zero explicitly. For partial repayment, compute debt shares with a well-defined rounding direction and either reject an amount that burns zero shares or credit the exact shares burned and transfer only the corresponding assets. Add tests across large index values and one-unit boundaries.
+
+### M-04 — ERC-20 return values are ignored
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, and `seize`; `LendingMarket._borrow`, `repay`, and `_liquidate`
+- **Impact:** Every token transfer assumes success even when an ERC-20 returns `false`. A false-returning collateral token can create an accounting balance without transferring assets, enabling treasury USDC to be borrowed against nothing. A false-returning debt token can erase debt without collecting repayment, or record debt without delivering borrowed USDC. Canonical launch assets normally revert or return true, but this becomes exploitable through a bad future listing, bad deployment configuration, or token upgrade.
+- **Fix:** Use a well-tested safe-transfer wrapper that accepts either no return data or decoded `true` and reverts otherwise. Combine it with actual-balance-delta accounting for deposits and repayments where supported.
+
+### M-05 — Vault accounting is unsafe for fee-charging, rebasing, and callback tokens
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, `seize`, and `balanceOf`; `LendingMarket.listCollateral`
+- **Impact:** Deposits credit the requested amount rather than the amount received, external calls occur before accounting is finalized, and balances are stored as fixed token units. A fee-on-transfer token can therefore create phantom collateral and borrow real USDC; a callback-capable token can reenter withdrawal while the old balance is still recorded; positive or negative rebases desynchronize user claims from vault assets. This is especially relevant to the stated roadmap for yield-bearing and rebasing collateral. An attacker gets treasury USDC or other users' collateral; honest users can become unable to withdraw their recorded balances.
+- **Fix:** Do not list such assets with the current vault. Use checks-effects-interactions plus a reentrancy guard, credit verified balance deltas, and implement share-based accounting for rebasing/yield-bearing assets. Give each asset an adapter with explicit invariants and caps rather than treating all ERC-20s identically.
+
+### M-06 — Deeply underwater debt has no practical liquidation or resolution path
+
+- **Location:** `LendingMarket.liquidate` and `_liquidate`
+- **Impact:** A liquidator must repay 100% of a borrower's debt before collateral is seized. If collateral is worth less than the debt (or less than debt plus the bonus), liquidation is economically irrational, and there is no partial liquidation, bad-debt write-off, reserve, or collateral auction. After a price gap or oracle failure, bad positions can remain indefinitely and treasury USDC becomes unrecoverable. The borrower retains any previously borrowed value while the treasury absorbs the shortfall.
+- **Fix:** Add bounded partial liquidation and cap repayment by available collateral at the bonus-adjusted price. Define an explicit insolvency path—reserve/insurance, bad-debt accounting, or governance-controlled resolution—and test price gaps, exhausted collateral, and rounding at the final liquidation.
+
+### L-01 — Initialization and upgrades do not validate critical addresses or code
+
+- **Location:** `LendingMarket.initialize`, `LendingMarket.upgradeTo`, and `MarketProxy.constructor`
+- **Impact:** Initialization accepts zero addresses, mismatched vaults, EOAs, or contracts on the wrong network. The proxy and upgrade function accept an implementation with no code or an incompatible storage layout. If the proxy is ever deployed without atomic `initData`, another account can initialize it first. These errors can brick the market, strand funds, or give ownership to the wrong account; a front-runner gets control if initialization is exposed.
+- **Fix:** Always initialize atomically in the proxy constructor. Validate nonzero addresses, deployed code, the expected vault-to-market relationship, token identity/decimals, chain ID, and UUPS compatibility. Disable initializers on the implementation and add deployment assertions for every address in the README.
+
+### L-02 — Bulk liquidation is all-or-nothing and unbounded
+
+- **Location:** `LendingMarket.liquidateAll`
+- **Impact:** The function scans the complete historical borrowers array in one transaction and performs all liquidations using one caller's balance and allowance. Growth alone eventually makes it exceed the block gas limit; one transfer/oracle/seizure revert also rolls back every earlier liquidation. Keepers lose gas and underwater accounts later in the array remain untouched. M-02 makes this failure permissionlessly triggerable.
+- **Fix:** Remove the global sweep or paginate it with explicit start/end bounds and per-account failure isolation. Let keepers submit selected borrowers, emit failures without reverting successful independent liquidations where safe, and avoid relying on an ever-growing on-chain enumeration.
+
+## Additional observations and deployment recommendations
+
+- `setBorrowRate` is owner-only but unbounded. Governance can accidentally choose a value that makes accrual overflow or makes debt grow catastrophically. Cap it and apply changes through a timelock.
+- Interest uses `block.number` multiplied by a fixed 12 seconds. Verify this approximation against Arbitrum One's block-number semantics and operational requirements; timestamp-based accrual with bounded elapsed time is easier to reason about across L2 behavior changes.
+- There is no pause mechanism. Add narrowly scoped emergency stops for new borrowing and collateral withdrawal/liquidation behavior, with a governance design that cannot permanently trap healthy users.
+- Add events and two-step acceptance for ownership changes in `LendingMarket`; use separate, documented roles for upgrades, oracle/risk changes, and emergency response.
+
+## Review limitations
+
+The repository contains no tests or deployment scripts, so this review could not verify constructor ordering, proxy/vault address derivation, role custody, configured feed heartbeats, or deployed bytecode. The contracts compile successfully with Solidity 0.8.28. This was a focused manual source review, not a guarantee that all vulnerabilities are identified. Before launch, implement the fixes, add invariant/fuzz and Arbitrum-fork tests, and obtain a follow-up review of the exact deployment configuration and upgrade/storage-layout process.

codex
The report is drafted with 14 ranked findings and concrete fixes. I’m doing the final hygiene pass now: removing compiler artifacts created during validation, confirming `src/` has no diff, and checking that the report is the sole new file.
2026-09-04T15:54:51.006141Z ERROR codex_core::tools::router: error=exec_command failed for `/bin/bash -lc "rm -rf -- /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001/out /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001/cache && git status --short && git diff -- src && git diff --check -- AUDIT-REPORT.md && sed -n '1,45p' AUDIT-REPORT.md"`: CreateProcess { message: "Rejected(\"`/bin/bash -lc \\\"rm -rf -- /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001/out /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001/cache && git status --short && git diff -- src && git diff --check -- AUDIT-REPORT.md && sed -n '1,45p' AUDIT-REPORT.md\\\"` rejected: rm -f style commands are not permitted. Use a safer approach\")" }
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6d42af9c0edb8e4cb350945476a81e939c2105d2
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,126 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `README.md` and all Solidity files under `src/`  
+**Deployment target:** Arbitrum One  
+**Launch assets:** native USDC debt and wstETH collateral
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permissionless administration paths let any account take control of the market or make arbitrary debt appear healthy. Separately, the health-factor formula loses nearly all ratio precision, and the planned wstETH configuration uses a stETH price without applying the wstETH/stETH conversion rate. Both issues can liquidate positions well before the documented 80% threshold.
+
+Findings are ranked by the order in which the team should address them. The review found **3 critical, 3 high, 6 medium, and 2 low** issues. C-01 through H-03 are launch blockers. M-05 is a blocker before listing fee-charging, rebasing, or otherwise non-standard collateral.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take every asset |
+| 2 | C-02 | Critical | Anyone can install an attacker-controlled oracle |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold |
+| 4 | H-01 | High | Health-factor division rounds the collateral ratio down to an integer |
+| 5 | H-02 | High | Oracle accepts stale, incomplete, and L2-downtime prices |
+| 6 | H-03 | High | wstETH is configured with a stETH/USD feed without conversion |
+| 7 | M-01 | Medium | Signed borrow authorizations can be replayed indefinitely |
+| 8 | M-02 | Medium | Zero-value borrows can permanently bloat the liquidation loop |
+| 9 | M-03 | Medium | Repayment rounding can take payment without reducing debt |
+| 10 | M-04 | Medium | ERC-20 return values are ignored |
+| 11 | M-05 | Medium | Vault accounting is unsafe for fee-charging, rebasing, and callback tokens |
+| 12 | M-06 | Medium | Deeply underwater debt has no practical liquidation or resolution path |
+| 13 | L-01 | Low | Initialization and upgrades do not validate critical addresses or code |
+| 14 | L-02 | Low | Bulk liquidation is all-or-nothing and unbounded |
+
+## Detailed findings
+
+### C-01 — Anyone can upgrade the proxy and take every asset
+
+- **Location:** `LendingMarket.upgradeTo`
+- **Impact:** The function has no access control. Any account can set the ERC-1967 implementation slot to an attacker contract. That implementation executes in the proxy's storage context and can transfer all USDC held by the market, change every position, authorize itself to seize collateral through the vault, or permanently brick the proxy. The attacker gets the entire treasury USDC balance and can steal all collateral held for users.
+- **Fix:** Restrict upgrades to a properly secured owner/timelock, preferably through a standard audited UUPS implementation. Require `newImplementation.code.length > 0`, perform the UUPS compatibility check, emit the upgrade event only after validation, and put production ownership behind a multisig plus timelock. Test both unauthorized calls and storage compatibility across upgrades.
+
+### C-02 — Anyone can install an attacker-controlled oracle
+
+- **Location:** `LendingMarket.setOracle`; consumed by `collateralValueUsd`, `debtValueUsd`, `_borrow`, and `_liquidate`
+- **Impact:** `setOracle` has no access control. An attacker can install a `PriceOracle` they own, assign feeds returning an enormous collateral price and a tiny debt-asset price, deposit minimal wstETH, and borrow the market's entire USDC balance. They can then change prices again to liquidate other users for their collateral. The attacker gets treasury USDC and potentially the collateral of every borrower.
+- **Fix:** Add `onlyOwner`; validate a nonzero contract address; and use a timelocked two-step oracle change with an emergency pause. Consider keeping feed configuration in the market's governance boundary so changing the oracle implementation cannot silently change every price. Add a maximum per-transaction/cumulative borrow-liquidity check as defense in depth.
+
+### C-03 — Anyone can change the liquidation threshold
+
+- **Location:** `LendingMarket.setLiquidationThreshold`; consumed by `healthFactor`
+- **Impact:** `setLiquidationThreshold` has no access control or bounds. An attacker can raise it far above 10,000 bps, make a minimally collateralized account appear healthy, and drain treasury USDC through `borrow`. Setting it very low can instead make users liquidatable so the caller can repay their debt and collect collateral plus the 5% bonus. Extreme values can also overflow health calculations and deny service. The attacker gets USDC or liquidation bonuses; users lose collateral.
+- **Fix:** Add `onlyOwner`, constrain the value to an explicitly approved range at or below `BPS`, and route risk changes through a timelock. Accrue interest before a risk-parameter change and consider a delay or pause so users can exit before a more aggressive threshold becomes active.
+
+### H-01 — Health-factor division rounds the collateral ratio down to an integer
+
+- **Location:** `LendingMarket.healthFactor`
+- **Impact:** The expression divides `collateralValueUsd(user)` by `debtUsd` before multiplying by `WAD`. Ratios from 1.00 through 1.99 therefore all become `1`. With an 80% threshold, every such position reports a health factor of 0.8 and can be liquidated. In practice, borrowing is limited to roughly 50% LTV instead of the documented 80%, and a position at exactly 50% LTV can become fully liquidatable after an arbitrarily small adverse price move. Liquidators receive the 5% bonus while unlucky users lose collateral despite being healthy under the intended formula.
+- **Fix:** Multiply before dividing, using full-precision multiplication/division to avoid overflow: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Use a tested `mulDiv` implementation and add boundary tests immediately below, at, and above 80% LTV, including non-integer ratios.
+
+### H-02 — Oracle accepts stale, incomplete, and L2-downtime prices
+
+- **Location:** `PriceOracle.getPrice`
+- **Impact:** The oracle uses `latestAnswer()` and checks neither positivity nor freshness. A stale positive price can allow excess borrowing after collateral falls or cause wrongful liquidation after it rises. A zero answer values collateral at zero; a negative answer reverts during the signed-to-unsigned conversion and freezes borrowing, withdrawal health checks, and liquidations. On Arbitrum, the design also lacks a sequencer-uptime check and recovery grace period, so users or searchers can act on feeds before prices safely resume after downtime. Attackers can get underpriced loans or discounted collateral; users and the treasury bear insolvency or liquidation losses.
+- **Fix:** Use `latestRoundData()` and require `answer > 0`, a nonzero `updatedAt` within a per-feed heartbeat, and a complete round (`answeredInRound >= roundId`). On Arbitrum, check the Chainlink sequencer uptime feed and enforce a grace period after recovery. Make stale/invalid data fail closed, add a pause path, and normalize feed decimals safely for values both below and above 18.
+
+### H-03 — wstETH is configured with a stETH/USD feed without conversion
+
+- **Location:** launch configuration in `README.md`; `PriceOracle.getPrice`; `LendingMarket.collateralValueUsd`
+- **Impact:** The listed collateral is wstETH, but the configured feed is stETH/USD. One wstETH represents more than one stETH, and that conversion rate changes as staking rewards accrue. Treating one wstETH as one stETH systematically undervalues collateral and causes users to have lower borrowing power and to be liquidated earlier than the advertised threshold. Liquidators receive bonuses from positions that are healthy when valued as wstETH; affected users lose collateral. The error compounds H-01.
+- **Fix:** Price wstETH by composing the stETH/USD price with the canonical wstETH-to-stETH conversion (or use a suitable wstETH/USD feed if available). Normalize both legs to a common precision, validate each underlying datum, and add fork/configuration tests against the canonical wstETH contract and configured feed addresses before deployment.
+
+### M-01 — Signed borrow authorizations can be replayed indefinitely
+
+- **Location:** `LendingMarket.borrowWithSig`
+- **Impact:** The signed struct contains only borrower and amount. It has no nonce or deadline, and no digest is marked used. Any relayer that sees one valid signature can submit it repeatedly until the account reaches its borrowing limit. USDC is sent to the borrower, so the relayer does not receive it directly, but the borrower receives unwanted debt, accrues interest, and can be pushed close to liquidation. A relayer can later liquidate the position for the bonus or grief a user indefinitely with an old authorization.
+- **Fix:** Include a per-borrower nonce, deadline, and preferably the intended receiver/relayer in the EIP-712 struct. Increment the nonce before external interactions, reject expired signatures, enforce canonical `s` and valid `v` values (or use a tested ECDSA library), and support explicit nonce cancellation.
+
+### M-02 — Zero-value borrows can permanently bloat the liquidation loop
+
+- **Location:** `LendingMarket._borrow` and `LendingMarket.liquidateAll`
+- **Impact:** When `principalOf[borrower] == 0`, `_borrow` appends the caller before adding principal. `borrow(0)` leaves principal at zero, so any account can call it repeatedly and append unlimited duplicate entries at only gas cost. Repaid borrowers can also be appended again. The `borrowers` array is never pruned. An attacker can make `liquidateAll` exceed the block gas limit, disabling the keeper path specifically intended for large price moves and increasing insolvency risk during volatility.
+- **Fix:** Reject zero amounts, maintain a separate `isBorrower` membership flag, and remove or mark borrowers inactive when debt is cleared. Replace the unbounded sweep with paginated liquidation over caller-supplied accounts; individual liquidation should remain the primary permissionless path.
+
+### M-03 — Repayment rounding can take payment without reducing debt
+
+- **Location:** `LendingMarket.repay` and `LendingMarket.debtOf`
+- **Impact:** Repayment burns `amount * WAD / borrowIndex` principal units, rounding down. A sufficiently small nonzero repayment can burn zero principal even though USDC is transferred. Even when paying the reported full debt, double rounding can leave principal dust, so a user may be unable to fully close the position and withdraw collateral without making further payments. The market keeps USDC that did not reduce debt; unlucky users overpay and may remain exposed to liquidation.
+- **Fix:** If `amount == debt`, set principal to zero explicitly. For partial repayment, compute debt shares with a well-defined rounding direction and either reject an amount that burns zero shares or credit the exact shares burned and transfer only the corresponding assets. Add tests across large index values and one-unit boundaries.
+
+### M-04 — ERC-20 return values are ignored
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, and `seize`; `LendingMarket._borrow`, `repay`, and `_liquidate`
+- **Impact:** Every token transfer assumes success even when an ERC-20 returns `false`. A false-returning collateral token can create an accounting balance without transferring assets, enabling treasury USDC to be borrowed against nothing. A false-returning debt token can erase debt without collecting repayment, or record debt without delivering borrowed USDC. Canonical launch assets normally revert or return true, but this becomes exploitable through a bad future listing, bad deployment configuration, or token upgrade.
+- **Fix:** Use a well-tested safe-transfer wrapper that accepts either no return data or decoded `true` and reverts otherwise. Combine it with actual-balance-delta accounting for deposits and repayments where supported.
+
+### M-05 — Vault accounting is unsafe for fee-charging, rebasing, and callback tokens
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, `seize`, and `balanceOf`; `LendingMarket.listCollateral`
+- **Impact:** Deposits credit the requested amount rather than the amount received, external calls occur before accounting is finalized, and balances are stored as fixed token units. A fee-on-transfer token can therefore create phantom collateral and borrow real USDC; a callback-capable token can reenter withdrawal while the old balance is still recorded; positive or negative rebases desynchronize user claims from vault assets. This is especially relevant to the stated roadmap for yield-bearing and rebasing collateral. An attacker gets treasury USDC or other users' collateral; honest users can become unable to withdraw their recorded balances.
+- **Fix:** Do not list such assets with the current vault. Use checks-effects-interactions plus a reentrancy guard, credit verified balance deltas, and implement share-based accounting for rebasing/yield-bearing assets. Give each asset an adapter with explicit invariants and caps rather than treating all ERC-20s identically.
+
+### M-06 — Deeply underwater debt has no practical liquidation or resolution path
+
+- **Location:** `LendingMarket.liquidate` and `_liquidate`
+- **Impact:** A liquidator must repay 100% of a borrower's debt before collateral is seized. If collateral is worth less than the debt (or less than debt plus the bonus), liquidation is economically irrational, and there is no partial liquidation, bad-debt write-off, reserve, or collateral auction. After a price gap or oracle failure, bad positions can remain indefinitely and treasury USDC becomes unrecoverable. The borrower retains any previously borrowed value while the treasury absorbs the shortfall.
+- **Fix:** Add bounded partial liquidation and cap repayment by available collateral at the bonus-adjusted price. Define an explicit insolvency path—reserve/insurance, bad-debt accounting, or governance-controlled resolution—and test price gaps, exhausted collateral, and rounding at the final liquidation.
+
+### L-01 — Initialization and upgrades do not validate critical addresses or code
+
+- **Location:** `LendingMarket.initialize`, `LendingMarket.upgradeTo`, and `MarketProxy.constructor`
+- **Impact:** Initialization accepts zero addresses, mismatched vaults, EOAs, or contracts on the wrong network. The proxy and upgrade function accept an implementation with no code or an incompatible storage layout. If the proxy is ever deployed without atomic `initData`, another account can initialize it first. These errors can brick the market, strand funds, or give ownership to the wrong account; a front-runner gets control if initialization is exposed.
+- **Fix:** Always initialize atomically in the proxy constructor. Validate nonzero addresses, deployed code, the expected vault-to-market relationship, token identity/decimals, chain ID, and UUPS compatibility. Disable initializers on the implementation and add deployment assertions for every address in the README.
+
+### L-02 — Bulk liquidation is all-or-nothing and unbounded
+
+- **Location:** `LendingMarket.liquidateAll`
+- **Impact:** The function scans the complete historical borrowers array in one transaction and performs all liquidations using one caller's balance and allowance. Growth alone eventually makes it exceed the block gas limit; one transfer/oracle/seizure revert also rolls back every earlier liquidation. Keepers lose gas and underwater accounts later in the array remain untouched. M-02 makes this failure permissionlessly triggerable.
+- **Fix:** Remove the global sweep or paginate it with explicit start/end bounds and per-account failure isolation. Let keepers submit selected borrowers, emit failures without reverting successful independent liquidations where safe, and avoid relying on an ever-growing on-chain enumeration.
+
+## Additional observations and deployment recommendations
+
+- `setBorrowRate` is owner-only but unbounded. Governance can accidentally choose a value that makes accrual overflow or makes debt grow catastrophically. Cap it and apply changes through a timelock.
+- Interest uses `block.number` multiplied by a fixed 12 seconds. Verify this approximation against Arbitrum One's block-number semantics and operational requirements; timestamp-based accrual with bounded elapsed time is easier to reason about across L2 behavior changes.
+- There is no pause mechanism. Add narrowly scoped emergency stops for new borrowing and collateral withdrawal/liquidation behavior, with a governance design that cannot permanently trap healthy users.
+- Add events and two-step acceptance for ownership changes in `LendingMarket`; use separate, documented roles for upgrades, oracle/risk changes, and emergency response.
+
+## Review limitations
+
+The repository contains no tests or deployment scripts, so this review could not verify constructor ordering, proxy/vault address derivation, role custody, configured feed heartbeats, or deployed bytecode. The contracts compile successfully with Solidity 0.8.28. This was a focused manual source review, not a guarantee that all vulnerabilities are identified. Before launch, implement the fixes, add invariant/fuzz and Arbitrum-fork tests, and obtain a follow-up review of the exact deployment configuration and upgrade/storage-layout process.

exec
/bin/bash -lc 'forge clean' in /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001
 succeeded in 6ms:
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6d42af9c0edb8e4cb350945476a81e939c2105d2
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,126 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `README.md` and all Solidity files under `src/`  
+**Deployment target:** Arbitrum One  
+**Launch assets:** native USDC debt and wstETH collateral
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permissionless administration paths let any account take control of the market or make arbitrary debt appear healthy. Separately, the health-factor formula loses nearly all ratio precision, and the planned wstETH configuration uses a stETH price without applying the wstETH/stETH conversion rate. Both issues can liquidate positions well before the documented 80% threshold.
+
+Findings are ranked by the order in which the team should address them. The review found **3 critical, 3 high, 6 medium, and 2 low** issues. C-01 through H-03 are launch blockers. M-05 is a blocker before listing fee-charging, rebasing, or otherwise non-standard collateral.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take every asset |
+| 2 | C-02 | Critical | Anyone can install an attacker-controlled oracle |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold |
+| 4 | H-01 | High | Health-factor division rounds the collateral ratio down to an integer |
+| 5 | H-02 | High | Oracle accepts stale, incomplete, and L2-downtime prices |
+| 6 | H-03 | High | wstETH is configured with a stETH/USD feed without conversion |
+| 7 | M-01 | Medium | Signed borrow authorizations can be replayed indefinitely |
+| 8 | M-02 | Medium | Zero-value borrows can permanently bloat the liquidation loop |
+| 9 | M-03 | Medium | Repayment rounding can take payment without reducing debt |
+| 10 | M-04 | Medium | ERC-20 return values are ignored |
+| 11 | M-05 | Medium | Vault accounting is unsafe for fee-charging, rebasing, and callback tokens |
+| 12 | M-06 | Medium | Deeply underwater debt has no practical liquidation or resolution path |
+| 13 | L-01 | Low | Initialization and upgrades do not validate critical addresses or code |
+| 14 | L-02 | Low | Bulk liquidation is all-or-nothing and unbounded |
+
+## Detailed findings
+
+### C-01 — Anyone can upgrade the proxy and take every asset
+
+- **Location:** `LendingMarket.upgradeTo`
+- **Impact:** The function has no access control. Any account can set the ERC-1967 implementation slot to an attacker contract. That implementation executes in the proxy's storage context and can transfer all USDC held by the market, change every position, authorize itself to seize collateral through the vault, or permanently brick the proxy. The attacker gets the entire treasury USDC balance and can steal all collateral held for users.
+- **Fix:** Restrict upgrades to a properly secured owner/timelock, preferably through a standard audited UUPS implementation. Require `newImplementation.code.length > 0`, perform the UUPS compatibility check, emit the upgrade event only after validation, and put production ownership behind a multisig plus timelock. Test both unauthorized calls and storage compatibility across upgrades.
+
+### C-02 — Anyone can install an attacker-controlled oracle
+
+- **Location:** `LendingMarket.setOracle`; consumed by `collateralValueUsd`, `debtValueUsd`, `_borrow`, and `_liquidate`
+- **Impact:** `setOracle` has no access control. An attacker can install a `PriceOracle` they own, assign feeds returning an enormous collateral price and a tiny debt-asset price, deposit minimal wstETH, and borrow the market's entire USDC balance. They can then change prices again to liquidate other users for their collateral. The attacker gets treasury USDC and potentially the collateral of every borrower.
+- **Fix:** Add `onlyOwner`; validate a nonzero contract address; and use a timelocked two-step oracle change with an emergency pause. Consider keeping feed configuration in the market's governance boundary so changing the oracle implementation cannot silently change every price. Add a maximum per-transaction/cumulative borrow-liquidity check as defense in depth.
+
+### C-03 — Anyone can change the liquidation threshold
+
+- **Location:** `LendingMarket.setLiquidationThreshold`; consumed by `healthFactor`
+- **Impact:** `setLiquidationThreshold` has no access control or bounds. An attacker can raise it far above 10,000 bps, make a minimally collateralized account appear healthy, and drain treasury USDC through `borrow`. Setting it very low can instead make users liquidatable so the caller can repay their debt and collect collateral plus the 5% bonus. Extreme values can also overflow health calculations and deny service. The attacker gets USDC or liquidation bonuses; users lose collateral.
+- **Fix:** Add `onlyOwner`, constrain the value to an explicitly approved range at or below `BPS`, and route risk changes through a timelock. Accrue interest before a risk-parameter change and consider a delay or pause so users can exit before a more aggressive threshold becomes active.
+
+### H-01 — Health-factor division rounds the collateral ratio down to an integer
+
+- **Location:** `LendingMarket.healthFactor`
+- **Impact:** The expression divides `collateralValueUsd(user)` by `debtUsd` before multiplying by `WAD`. Ratios from 1.00 through 1.99 therefore all become `1`. With an 80% threshold, every such position reports a health factor of 0.8 and can be liquidated. In practice, borrowing is limited to roughly 50% LTV instead of the documented 80%, and a position at exactly 50% LTV can become fully liquidatable after an arbitrarily small adverse price move. Liquidators receive the 5% bonus while unlucky users lose collateral despite being healthy under the intended formula.
+- **Fix:** Multiply before dividing, using full-precision multiplication/division to avoid overflow: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Use a tested `mulDiv` implementation and add boundary tests immediately below, at, and above 80% LTV, including non-integer ratios.
+
+### H-02 — Oracle accepts stale, incomplete, and L2-downtime prices
+
+- **Location:** `PriceOracle.getPrice`
+- **Impact:** The oracle uses `latestAnswer()` and checks neither positivity nor freshness. A stale positive price can allow excess borrowing after collateral falls or cause wrongful liquidation after it rises. A zero answer values collateral at zero; a negative answer reverts during the signed-to-unsigned conversion and freezes borrowing, withdrawal health checks, and liquidations. On Arbitrum, the design also lacks a sequencer-uptime check and recovery grace period, so users or searchers can act on feeds before prices safely resume after downtime. Attackers can get underpriced loans or discounted collateral; users and the treasury bear insolvency or liquidation losses.
+- **Fix:** Use `latestRoundData()` and require `answer > 0`, a nonzero `updatedAt` within a per-feed heartbeat, and a complete round (`answeredInRound >= roundId`). On Arbitrum, check the Chainlink sequencer uptime feed and enforce a grace period after recovery. Make stale/invalid data fail closed, add a pause path, and normalize feed decimals safely for values both below and above 18.
+
+### H-03 — wstETH is configured with a stETH/USD feed without conversion
+
+- **Location:** launch configuration in `README.md`; `PriceOracle.getPrice`; `LendingMarket.collateralValueUsd`
+- **Impact:** The listed collateral is wstETH, but the configured feed is stETH/USD. One wstETH represents more than one stETH, and that conversion rate changes as staking rewards accrue. Treating one wstETH as one stETH systematically undervalues collateral and causes users to have lower borrowing power and to be liquidated earlier than the advertised threshold. Liquidators receive bonuses from positions that are healthy when valued as wstETH; affected users lose collateral. The error compounds H-01.
+- **Fix:** Price wstETH by composing the stETH/USD price with the canonical wstETH-to-stETH conversion (or use a suitable wstETH/USD feed if available). Normalize both legs to a common precision, validate each underlying datum, and add fork/configuration tests against the canonical wstETH contract and configured feed addresses before deployment.
+
+### M-01 — Signed borrow authorizations can be replayed indefinitely
+
+- **Location:** `LendingMarket.borrowWithSig`
+- **Impact:** The signed struct contains only borrower and amount. It has no nonce or deadline, and no digest is marked used. Any relayer that sees one valid signature can submit it repeatedly until the account reaches its borrowing limit. USDC is sent to the borrower, so the relayer does not receive it directly, but the borrower receives unwanted debt, accrues interest, and can be pushed close to liquidation. A relayer can later liquidate the position for the bonus or grief a user indefinitely with an old authorization.
+- **Fix:** Include a per-borrower nonce, deadline, and preferably the intended receiver/relayer in the EIP-712 struct. Increment the nonce before external interactions, reject expired signatures, enforce canonical `s` and valid `v` values (or use a tested ECDSA library), and support explicit nonce cancellation.
+
+### M-02 — Zero-value borrows can permanently bloat the liquidation loop
+
+- **Location:** `LendingMarket._borrow` and `LendingMarket.liquidateAll`
+- **Impact:** When `principalOf[borrower] == 0`, `_borrow` appends the caller before adding principal. `borrow(0)` leaves principal at zero, so any account can call it repeatedly and append unlimited duplicate entries at only gas cost. Repaid borrowers can also be appended again. The `borrowers` array is never pruned. An attacker can make `liquidateAll` exceed the block gas limit, disabling the keeper path specifically intended for large price moves and increasing insolvency risk during volatility.
+- **Fix:** Reject zero amounts, maintain a separate `isBorrower` membership flag, and remove or mark borrowers inactive when debt is cleared. Replace the unbounded sweep with paginated liquidation over caller-supplied accounts; individual liquidation should remain the primary permissionless path.
+
+### M-03 — Repayment rounding can take payment without reducing debt
+
+- **Location:** `LendingMarket.repay` and `LendingMarket.debtOf`
+- **Impact:** Repayment burns `amount * WAD / borrowIndex` principal units, rounding down. A sufficiently small nonzero repayment can burn zero principal even though USDC is transferred. Even when paying the reported full debt, double rounding can leave principal dust, so a user may be unable to fully close the position and withdraw collateral without making further payments. The market keeps USDC that did not reduce debt; unlucky users overpay and may remain exposed to liquidation.
+- **Fix:** If `amount == debt`, set principal to zero explicitly. For partial repayment, compute debt shares with a well-defined rounding direction and either reject an amount that burns zero shares or credit the exact shares burned and transfer only the corresponding assets. Add tests across large index values and one-unit boundaries.
+
+### M-04 — ERC-20 return values are ignored
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, and `seize`; `LendingMarket._borrow`, `repay`, and `_liquidate`
+- **Impact:** Every token transfer assumes success even when an ERC-20 returns `false`. A false-returning collateral token can create an accounting balance without transferring assets, enabling treasury USDC to be borrowed against nothing. A false-returning debt token can erase debt without collecting repayment, or record debt without delivering borrowed USDC. Canonical launch assets normally revert or return true, but this becomes exploitable through a bad future listing, bad deployment configuration, or token upgrade.
+- **Fix:** Use a well-tested safe-transfer wrapper that accepts either no return data or decoded `true` and reverts otherwise. Combine it with actual-balance-delta accounting for deposits and repayments where supported.
+
+### M-05 — Vault accounting is unsafe for fee-charging, rebasing, and callback tokens
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, `seize`, and `balanceOf`; `LendingMarket.listCollateral`
+- **Impact:** Deposits credit the requested amount rather than the amount received, external calls occur before accounting is finalized, and balances are stored as fixed token units. A fee-on-transfer token can therefore create phantom collateral and borrow real USDC; a callback-capable token can reenter withdrawal while the old balance is still recorded; positive or negative rebases desynchronize user claims from vault assets. This is especially relevant to the stated roadmap for yield-bearing and rebasing collateral. An attacker gets treasury USDC or other users' collateral; honest users can become unable to withdraw their recorded balances.
+- **Fix:** Do not list such assets with the current vault. Use checks-effects-interactions plus a reentrancy guard, credit verified balance deltas, and implement share-based accounting for rebasing/yield-bearing assets. Give each asset an adapter with explicit invariants and caps rather than treating all ERC-20s identically.
+
+### M-06 — Deeply underwater debt has no practical liquidation or resolution path
+
+- **Location:** `LendingMarket.liquidate` and `_liquidate`
+- **Impact:** A liquidator must repay 100% of a borrower's debt before collateral is seized. If collateral is worth less than the debt (or less than debt plus the bonus), liquidation is economically irrational, and there is no partial liquidation, bad-debt write-off, reserve, or collateral auction. After a price gap or oracle failure, bad positions can remain indefinitely and treasury USDC becomes unrecoverable. The borrower retains any previously borrowed value while the treasury absorbs the shortfall.
+- **Fix:** Add bounded partial liquidation and cap repayment by available collateral at the bonus-adjusted price. Define an explicit insolvency path—reserve/insurance, bad-debt accounting, or governance-controlled resolution—and test price gaps, exhausted collateral, and rounding at the final liquidation.
+
+### L-01 — Initialization and upgrades do not validate critical addresses or code
+
+- **Location:** `LendingMarket.initialize`, `LendingMarket.upgradeTo`, and `MarketProxy.constructor`
+- **Impact:** Initialization accepts zero addresses, mismatched vaults, EOAs, or contracts on the wrong network. The proxy and upgrade function accept an implementation with no code or an incompatible storage layout. If the proxy is ever deployed without atomic `initData`, another account can initialize it first. These errors can brick the market, strand funds, or give ownership to the wrong account; a front-runner gets control if initialization is exposed.
+- **Fix:** Always initialize atomically in the proxy constructor. Validate nonzero addresses, deployed code, the expected vault-to-market relationship, token identity/decimals, chain ID, and UUPS compatibility. Disable initializers on the implementation and add deployment assertions for every address in the README.
+
+### L-02 — Bulk liquidation is all-or-nothing and unbounded
+
+- **Location:** `LendingMarket.liquidateAll`
+- **Impact:** The function scans the complete historical borrowers array in one transaction and performs all liquidations using one caller's balance and allowance. Growth alone eventually makes it exceed the block gas limit; one transfer/oracle/seizure revert also rolls back every earlier liquidation. Keepers lose gas and underwater accounts later in the array remain untouched. M-02 makes this failure permissionlessly triggerable.
+- **Fix:** Remove the global sweep or paginate it with explicit start/end bounds and per-account failure isolation. Let keepers submit selected borrowers, emit failures without reverting successful independent liquidations where safe, and avoid relying on an ever-growing on-chain enumeration.
+
+## Additional observations and deployment recommendations
+
+- `setBorrowRate` is owner-only but unbounded. Governance can accidentally choose a value that makes accrual overflow or makes debt grow catastrophically. Cap it and apply changes through a timelock.
+- Interest uses `block.number` multiplied by a fixed 12 seconds. Verify this approximation against Arbitrum One's block-number semantics and operational requirements; timestamp-based accrual with bounded elapsed time is easier to reason about across L2 behavior changes.
+- There is no pause mechanism. Add narrowly scoped emergency stops for new borrowing and collateral withdrawal/liquidation behavior, with a governance design that cannot permanently trap healthy users.
+- Add events and two-step acceptance for ownership changes in `LendingMarket`; use separate, documented roles for upgrades, oracle/risk changes, and emergency response.
+
+## Review limitations
+
+The repository contains no tests or deployment scripts, so this review could not verify constructor ordering, proxy/vault address derivation, role custody, configured feed heartbeats, or deployed bytecode. The contracts compile successfully with Solidity 0.8.28. This was a focused manual source review, not a guarantee that all vulnerabilities are identified. Before launch, implement the fixes, add invariant/fuzz and Arbitrum-fork tests, and obtain a follow-up review of the exact deployment configuration and upgrade/storage-layout process.

exec
/bin/bash -lc 'git status --short && git diff -- src && git diff --check -- AUDIT-REPORT.md' in /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001
exec
/bin/bash -lc "find . -maxdepth 2 -mindepth 1 -not -path './.git*' -print | sort && sed -n '1,45p' AUDIT-REPORT.md" in /tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001
 succeeded in 11ms:
./.agents
./.codex
./AUDIT-REPORT.md
./README.md
./TASK.md
./foundry.toml
./package.json
./src
./src/CollateralVault.sol
./src/LendingMarket.sol
./src/MarketProxy.sol
./src/PriceOracle.sol
./src/interfaces
# ArbiLend Security Review

**Review date:** 2026-09-04  
**Scope:** `README.md` and all Solidity files under `src/`  
**Deployment target:** Arbitrum One  
**Launch assets:** native USDC debt and wstETH collateral

## Executive summary

ArbiLend is **not ready to deploy with funds**. Three permissionless administration paths let any account take control of the market or make arbitrary debt appear healthy. Separately, the health-factor formula loses nearly all ratio precision, and the planned wstETH configuration uses a stETH price without applying the wstETH/stETH conversion rate. Both issues can liquidate positions well before the documented 80% threshold.

Findings are ranked by the order in which the team should address them. The review found **3 critical, 3 high, 6 medium, and 2 low** issues. C-01 through H-03 are launch blockers. M-05 is a blocker before listing fee-charging, rebasing, or otherwise non-standard collateral.

| Rank | ID | Severity | Finding |
| ---: | --- | --- | --- |
| 1 | C-01 | Critical | Anyone can upgrade the proxy and take every asset |
| 2 | C-02 | Critical | Anyone can install an attacker-controlled oracle |
| 3 | C-03 | Critical | Anyone can change the liquidation threshold |
| 4 | H-01 | High | Health-factor division rounds the collateral ratio down to an integer |
| 5 | H-02 | High | Oracle accepts stale, incomplete, and L2-downtime prices |
| 6 | H-03 | High | wstETH is configured with a stETH/USD feed without conversion |
| 7 | M-01 | Medium | Signed borrow authorizations can be replayed indefinitely |
| 8 | M-02 | Medium | Zero-value borrows can permanently bloat the liquidation loop |
| 9 | M-03 | Medium | Repayment rounding can take payment without reducing debt |
| 10 | M-04 | Medium | ERC-20 return values are ignored |
| 11 | M-05 | Medium | Vault accounting is unsafe for fee-charging, rebasing, and callback tokens |
| 12 | M-06 | Medium | Deeply underwater debt has no practical liquidation or resolution path |
| 13 | L-01 | Low | Initialization and upgrades do not validate critical addresses or code |
| 14 | L-02 | Low | Bulk liquidation is all-or-nothing and unbounded |

## Detailed findings

### C-01 — Anyone can upgrade the proxy and take every asset

- **Location:** `LendingMarket.upgradeTo`
- **Impact:** The function has no access control. Any account can set the ERC-1967 implementation slot to an attacker contract. That implementation executes in the proxy's storage context and can transfer all USDC held by the market, change every position, authorize itself to seize collateral through the vault, or permanently brick the proxy. The attacker gets the entire treasury USDC balance and can steal all collateral held for users.
- **Fix:** Restrict upgrades to a properly secured owner/timelock, preferably through a standard audited UUPS implementation. Require `newImplementation.code.length > 0`, perform the UUPS compatibility check, emit the upgrade event only after validation, and put production ownership behind a multisig plus timelock. Test both unauthorized calls and storage compatibility across upgrades.

### C-02 — Anyone can install an attacker-controlled oracle

- **Location:** `LendingMarket.setOracle`; consumed by `collateralValueUsd`, `debtValueUsd`, `_borrow`, and `_liquidate`
- **Impact:** `setOracle` has no access control. An attacker can install a `PriceOracle` they own, assign feeds returning an enormous collateral price and a tiny debt-asset price, deposit minimal wstETH, and borrow the market's entire USDC balance. They can then change prices again to liquidate other users for their collateral. The attacker gets treasury USDC and potentially the collateral of every borrower.
- **Fix:** Add `onlyOwner`; validate a nonzero contract address; and use a timelocked two-step oracle change with an emergency pause. Consider keeping feed configuration in the market's governance boundary so changing the oracle implementation cannot silently change every price. Add a maximum per-transaction/cumulative borrow-liquidity check as defense in depth.

### C-03 — Anyone can change the liquidation threshold

 succeeded in 15ms:
?? AUDIT-REPORT.md

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6d42af9c0edb8e4cb350945476a81e939c2105d2
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,126 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `README.md` and all Solidity files under `src/`  
+**Deployment target:** Arbitrum One  
+**Launch assets:** native USDC debt and wstETH collateral
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permissionless administration paths let any account take control of the market or make arbitrary debt appear healthy. Separately, the health-factor formula loses nearly all ratio precision, and the planned wstETH configuration uses a stETH price without applying the wstETH/stETH conversion rate. Both issues can liquidate positions well before the documented 80% threshold.
+
+Findings are ranked by the order in which the team should address them. The review found **3 critical, 3 high, 6 medium, and 2 low** issues. C-01 through H-03 are launch blockers. M-05 is a blocker before listing fee-charging, rebasing, or otherwise non-standard collateral.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take every asset |
+| 2 | C-02 | Critical | Anyone can install an attacker-controlled oracle |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold |
+| 4 | H-01 | High | Health-factor division rounds the collateral ratio down to an integer |
+| 5 | H-02 | High | Oracle accepts stale, incomplete, and L2-downtime prices |
+| 6 | H-03 | High | wstETH is configured with a stETH/USD feed without conversion |
+| 7 | M-01 | Medium | Signed borrow authorizations can be replayed indefinitely |
+| 8 | M-02 | Medium | Zero-value borrows can permanently bloat the liquidation loop |
+| 9 | M-03 | Medium | Repayment rounding can take payment without reducing debt |
+| 10 | M-04 | Medium | ERC-20 return values are ignored |
+| 11 | M-05 | Medium | Vault accounting is unsafe for fee-charging, rebasing, and callback tokens |
+| 12 | M-06 | Medium | Deeply underwater debt has no practical liquidation or resolution path |
+| 13 | L-01 | Low | Initialization and upgrades do not validate critical addresses or code |
+| 14 | L-02 | Low | Bulk liquidation is all-or-nothing and unbounded |
+
+## Detailed findings
+
+### C-01 — Anyone can upgrade the proxy and take every asset
+
+- **Location:** `LendingMarket.upgradeTo`
+- **Impact:** The function has no access control. Any account can set the ERC-1967 implementation slot to an attacker contract. That implementation executes in the proxy's storage context and can transfer all USDC held by the market, change every position, authorize itself to seize collateral through the vault, or permanently brick the proxy. The attacker gets the entire treasury USDC balance and can steal all collateral held for users.
+- **Fix:** Restrict upgrades to a properly secured owner/timelock, preferably through a standard audited UUPS implementation. Require `newImplementation.code.length > 0`, perform the UUPS compatibility check, emit the upgrade event only after validation, and put production ownership behind a multisig plus timelock. Test both unauthorized calls and storage compatibility across upgrades.
+
+### C-02 — Anyone can install an attacker-controlled oracle
+
+- **Location:** `LendingMarket.setOracle`; consumed by `collateralValueUsd`, `debtValueUsd`, `_borrow`, and `_liquidate`
+- **Impact:** `setOracle` has no access control. An attacker can install a `PriceOracle` they own, assign feeds returning an enormous collateral price and a tiny debt-asset price, deposit minimal wstETH, and borrow the market's entire USDC balance. They can then change prices again to liquidate other users for their collateral. The attacker gets treasury USDC and potentially the collateral of every borrower.
+- **Fix:** Add `onlyOwner`; validate a nonzero contract address; and use a timelocked two-step oracle change with an emergency pause. Consider keeping feed configuration in the market's governance boundary so changing the oracle implementation cannot silently change every price. Add a maximum per-transaction/cumulative borrow-liquidity check as defense in depth.
+
+### C-03 — Anyone can change the liquidation threshold
+
+- **Location:** `LendingMarket.setLiquidationThreshold`; consumed by `healthFactor`
+- **Impact:** `setLiquidationThreshold` has no access control or bounds. An attacker can raise it far above 10,000 bps, make a minimally collateralized account appear healthy, and drain treasury USDC through `borrow`. Setting it very low can instead make users liquidatable so the caller can repay their debt and collect collateral plus the 5% bonus. Extreme values can also overflow health calculations and deny service. The attacker gets USDC or liquidation bonuses; users lose collateral.
+- **Fix:** Add `onlyOwner`, constrain the value to an explicitly approved range at or below `BPS`, and route risk changes through a timelock. Accrue interest before a risk-parameter change and consider a delay or pause so users can exit before a more aggressive threshold becomes active.
+
+### H-01 — Health-factor division rounds the collateral ratio down to an integer
+
+- **Location:** `LendingMarket.healthFactor`
+- **Impact:** The expression divides `collateralValueUsd(user)` by `debtUsd` before multiplying by `WAD`. Ratios from 1.00 through 1.99 therefore all become `1`. With an 80% threshold, every such position reports a health factor of 0.8 and can be liquidated. In practice, borrowing is limited to roughly 50% LTV instead of the documented 80%, and a position at exactly 50% LTV can become fully liquidatable after an arbitrarily small adverse price move. Liquidators receive the 5% bonus while unlucky users lose collateral despite being healthy under the intended formula.
+- **Fix:** Multiply before dividing, using full-precision multiplication/division to avoid overflow: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Use a tested `mulDiv` implementation and add boundary tests immediately below, at, and above 80% LTV, including non-integer ratios.
+
+### H-02 — Oracle accepts stale, incomplete, and L2-downtime prices
+
+- **Location:** `PriceOracle.getPrice`
+- **Impact:** The oracle uses `latestAnswer()` and checks neither positivity nor freshness. A stale positive price can allow excess borrowing after collateral falls or cause wrongful liquidation after it rises. A zero answer values collateral at zero; a negative answer reverts during the signed-to-unsigned conversion and freezes borrowing, withdrawal health checks, and liquidations. On Arbitrum, the design also lacks a sequencer-uptime check and recovery grace period, so users or searchers can act on feeds before prices safely resume after downtime. Attackers can get underpriced loans or discounted collateral; users and the treasury bear insolvency or liquidation losses.
+- **Fix:** Use `latestRoundData()` and require `answer > 0`, a nonzero `updatedAt` within a per-feed heartbeat, and a complete round (`answeredInRound >= roundId`). On Arbitrum, check the Chainlink sequencer uptime feed and enforce a grace period after recovery. Make stale/invalid data fail closed, add a pause path, and normalize feed decimals safely for values both below and above 18.
+
+### H-03 — wstETH is configured with a stETH/USD feed without conversion
+
+- **Location:** launch configuration in `README.md`; `PriceOracle.getPrice`; `LendingMarket.collateralValueUsd`
+- **Impact:** The listed collateral is wstETH, but the configured feed is stETH/USD. One wstETH represents more than one stETH, and that conversion rate changes as staking rewards accrue. Treating one wstETH as one stETH systematically undervalues collateral and causes users to have lower borrowing power and to be liquidated earlier than the advertised threshold. Liquidators receive bonuses from positions that are healthy when valued as wstETH; affected users lose collateral. The error compounds H-01.
+- **Fix:** Price wstETH by composing the stETH/USD price with the canonical wstETH-to-stETH conversion (or use a suitable wstETH/USD feed if available). Normalize both legs to a common precision, validate each underlying datum, and add fork/configuration tests against the canonical wstETH contract and configured feed addresses before deployment.
+
+### M-01 — Signed borrow authorizations can be replayed indefinitely
+
+- **Location:** `LendingMarket.borrowWithSig`
+- **Impact:** The signed struct contains only borrower and amount. It has no nonce or deadline, and no digest is marked used. Any relayer that sees one valid signature can submit it repeatedly until the account reaches its borrowing limit. USDC is sent to the borrower, so the relayer does not receive it directly, but the borrower receives unwanted debt, accrues interest, and can be pushed close to liquidation. A relayer can later liquidate the position for the bonus or grief a user indefinitely with an old authorization.
+- **Fix:** Include a per-borrower nonce, deadline, and preferably the intended receiver/relayer in the EIP-712 struct. Increment the nonce before external interactions, reject expired signatures, enforce canonical `s` and valid `v` values (or use a tested ECDSA library), and support explicit nonce cancellation.
+
+### M-02 — Zero-value borrows can permanently bloat the liquidation loop
+
+- **Location:** `LendingMarket._borrow` and `LendingMarket.liquidateAll`
+- **Impact:** When `principalOf[borrower] == 0`, `_borrow` appends the caller before adding principal. `borrow(0)` leaves principal at zero, so any account can call it repeatedly and append unlimited duplicate entries at only gas cost. Repaid borrowers can also be appended again. The `borrowers` array is never pruned. An attacker can make `liquidateAll` exceed the block gas limit, disabling the keeper path specifically intended for large price moves and increasing insolvency risk during volatility.
+- **Fix:** Reject zero amounts, maintain a separate `isBorrower` membership flag, and remove or mark borrowers inactive when debt is cleared. Replace the unbounded sweep with paginated liquidation over caller-supplied accounts; individual liquidation should remain the primary permissionless path.
+
+### M-03 — Repayment rounding can take payment without reducing debt
+
+- **Location:** `LendingMarket.repay` and `LendingMarket.debtOf`
+- **Impact:** Repayment burns `amount * WAD / borrowIndex` principal units, rounding down. A sufficiently small nonzero repayment can burn zero principal even though USDC is transferred. Even when paying the reported full debt, double rounding can leave principal dust, so a user may be unable to fully close the position and withdraw collateral without making further payments. The market keeps USDC that did not reduce debt; unlucky users overpay and may remain exposed to liquidation.
+- **Fix:** If `amount == debt`, set principal to zero explicitly. For partial repayment, compute debt shares with a well-defined rounding direction and either reject an amount that burns zero shares or credit the exact shares burned and transfer only the corresponding assets. Add tests across large index values and one-unit boundaries.
+
+### M-04 — ERC-20 return values are ignored
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, and `seize`; `LendingMarket._borrow`, `repay`, and `_liquidate`
+- **Impact:** Every token transfer assumes success even when an ERC-20 returns `false`. A false-returning collateral token can create an accounting balance without transferring assets, enabling treasury USDC to be borrowed against nothing. A false-returning debt token can erase debt without collecting repayment, or record debt without delivering borrowed USDC. Canonical launch assets normally revert or return true, but this becomes exploitable through a bad future listing, bad deployment configuration, or token upgrade.
+- **Fix:** Use a well-tested safe-transfer wrapper that accepts either no return data or decoded `true` and reverts otherwise. Combine it with actual-balance-delta accounting for deposits and repayments where supported.
+
+### M-05 — Vault accounting is unsafe for fee-charging, rebasing, and callback tokens
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, `seize`, and `balanceOf`; `LendingMarket.listCollateral`
+- **Impact:** Deposits credit the requested amount rather than the amount received, external calls occur before accounting is finalized, and balances are stored as fixed token units. A fee-on-transfer token can therefore create phantom collateral and borrow real USDC; a callback-capable token can reenter withdrawal while the old balance is still recorded; positive or negative rebases desynchronize user claims from vault assets. This is especially relevant to the stated roadmap for yield-bearing and rebasing collateral. An attacker gets treasury USDC or other users' collateral; honest users can become unable to withdraw their recorded balances.
+- **Fix:** Do not list such assets with the current vault. Use checks-effects-interactions plus a reentrancy guard, credit verified balance deltas, and implement share-based accounting for rebasing/yield-bearing assets. Give each asset an adapter with explicit invariants and caps rather than treating all ERC-20s identically.
+
+### M-06 — Deeply underwater debt has no practical liquidation or resolution path
+
+- **Location:** `LendingMarket.liquidate` and `_liquidate`
+- **Impact:** A liquidator must repay 100% of a borrower's debt before collateral is seized. If collateral is worth less than the debt (or less than debt plus the bonus), liquidation is economically irrational, and there is no partial liquidation, bad-debt write-off, reserve, or collateral auction. After a price gap or oracle failure, bad positions can remain indefinitely and treasury USDC becomes unrecoverable. The borrower retains any previously borrowed value while the treasury absorbs the shortfall.
+- **Fix:** Add bounded partial liquidation and cap repayment by available collateral at the bonus-adjusted price. Define an explicit insolvency path—reserve/insurance, bad-debt accounting, or governance-controlled resolution—and test price gaps, exhausted collateral, and rounding at the final liquidation.
+
+### L-01 — Initialization and upgrades do not validate critical addresses or code
+
+- **Location:** `LendingMarket.initialize`, `LendingMarket.upgradeTo`, and `MarketProxy.constructor`
+- **Impact:** Initialization accepts zero addresses, mismatched vaults, EOAs, or contracts on the wrong network. The proxy and upgrade function accept an implementation with no code or an incompatible storage layout. If the proxy is ever deployed without atomic `initData`, another account can initialize it first. These errors can brick the market, strand funds, or give ownership to the wrong account; a front-runner gets control if initialization is exposed.
+- **Fix:** Always initialize atomically in the proxy constructor. Validate nonzero addresses, deployed code, the expected vault-to-market relationship, token identity/decimals, chain ID, and UUPS compatibility. Disable initializers on the implementation and add deployment assertions for every address in the README.
+
+### L-02 — Bulk liquidation is all-or-nothing and unbounded
+
+- **Location:** `LendingMarket.liquidateAll`
+- **Impact:** The function scans the complete historical borrowers array in one transaction and performs all liquidations using one caller's balance and allowance. Growth alone eventually makes it exceed the block gas limit; one transfer/oracle/seizure revert also rolls back every earlier liquidation. Keepers lose gas and underwater accounts later in the array remain untouched. M-02 makes this failure permissionlessly triggerable.
+- **Fix:** Remove the global sweep or paginate it with explicit start/end bounds and per-account failure isolation. Let keepers submit selected borrowers, emit failures without reverting successful independent liquidations where safe, and avoid relying on an ever-growing on-chain enumeration.
+
+## Additional observations and deployment recommendations
+
+- `setBorrowRate` is owner-only but unbounded. Governance can accidentally choose a value that makes accrual overflow or makes debt grow catastrophically. Cap it and apply changes through a timelock.
+- Interest uses `block.number` multiplied by a fixed 12 seconds. Verify this approximation against Arbitrum One's block-number semantics and operational requirements; timestamp-based accrual with bounded elapsed time is easier to reason about across L2 behavior changes.
+- There is no pause mechanism. Add narrowly scoped emergency stops for new borrowing and collateral withdrawal/liquidation behavior, with a governance design that cannot permanently trap healthy users.
+- Add events and two-step acceptance for ownership changes in `LendingMarket`; use separate, documented roles for upgrades, oracle/risk changes, and emergency response.
+
+## Review limitations
+
+The repository contains no tests or deployment scripts, so this review could not verify constructor ordering, proxy/vault address derivation, role custody, configured feed heartbeats, or deployed bytecode. The contracts compile successfully with Solidity 0.8.28. This was a focused manual source review, not a guarantee that all vulnerabilities are identified. Before launch, implement the fixes, add invariant/fuzz and Arbitrum-fork tests, and obtain a follow-up review of the exact deployment configuration and upgrade/storage-layout process.

Completed the source review, validated compilation, wrote the ranked report, and cleaned generated build artifacts. Git shows AUDIT-REPORT.md as the only new file and no changes under src/.
  ✓ Read README and repository instructions; inventory contracts and tests
  ✓ Audit trust boundaries, accounting, liquidation, oracle, token, and admin paths
  ✓ Validate findings with tests or minimal read-only analysis
  ✓ Write ranked AUDIT-REPORT.md and verify no other files were created
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6d42af9c0edb8e4cb350945476a81e939c2105d2
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,126 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `README.md` and all Solidity files under `src/`  
+**Deployment target:** Arbitrum One  
+**Launch assets:** native USDC debt and wstETH collateral
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permissionless administration paths let any account take control of the market or make arbitrary debt appear healthy. Separately, the health-factor formula loses nearly all ratio precision, and the planned wstETH configuration uses a stETH price without applying the wstETH/stETH conversion rate. Both issues can liquidate positions well before the documented 80% threshold.
+
+Findings are ranked by the order in which the team should address them. The review found **3 critical, 3 high, 6 medium, and 2 low** issues. C-01 through H-03 are launch blockers. M-05 is a blocker before listing fee-charging, rebasing, or otherwise non-standard collateral.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take every asset |
+| 2 | C-02 | Critical | Anyone can install an attacker-controlled oracle |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold |
+| 4 | H-01 | High | Health-factor division rounds the collateral ratio down to an integer |
+| 5 | H-02 | High | Oracle accepts stale, incomplete, and L2-downtime prices |
+| 6 | H-03 | High | wstETH is configured with a stETH/USD feed without conversion |
+| 7 | M-01 | Medium | Signed borrow authorizations can be replayed indefinitely |
+| 8 | M-02 | Medium | Zero-value borrows can permanently bloat the liquidation loop |
+| 9 | M-03 | Medium | Repayment rounding can take payment without reducing debt |
+| 10 | M-04 | Medium | ERC-20 return values are ignored |
+| 11 | M-05 | Medium | Vault accounting is unsafe for fee-charging, rebasing, and callback tokens |
+| 12 | M-06 | Medium | Deeply underwater debt has no practical liquidation or resolution path |
+| 13 | L-01 | Low | Initialization and upgrades do not validate critical addresses or code |
+| 14 | L-02 | Low | Bulk liquidation is all-or-nothing and unbounded |
+
+## Detailed findings
+
+### C-01 — Anyone can upgrade the proxy and take every asset
+
+- **Location:** `LendingMarket.upgradeTo`
+- **Impact:** The function has no access control. Any account can set the ERC-1967 implementation slot to an attacker contract. That implementation executes in the proxy's storage context and can transfer all USDC held by the market, change every position, authorize itself to seize collateral through the vault, or permanently brick the proxy. The attacker gets the entire treasury USDC balance and can steal all collateral held for users.
+- **Fix:** Restrict upgrades to a properly secured owner/timelock, preferably through a standard audited UUPS implementation. Require `newImplementation.code.length > 0`, perform the UUPS compatibility check, emit the upgrade event only after validation, and put production ownership behind a multisig plus timelock. Test both unauthorized calls and storage compatibility across upgrades.
+
+### C-02 — Anyone can install an attacker-controlled oracle
+
+- **Location:** `LendingMarket.setOracle`; consumed by `collateralValueUsd`, `debtValueUsd`, `_borrow`, and `_liquidate`
+- **Impact:** `setOracle` has no access control. An attacker can install a `PriceOracle` they own, assign feeds returning an enormous collateral price and a tiny debt-asset price, deposit minimal wstETH, and borrow the market's entire USDC balance. They can then change prices again to liquidate other users for their collateral. The attacker gets treasury USDC and potentially the collateral of every borrower.
+- **Fix:** Add `onlyOwner`; validate a nonzero contract address; and use a timelocked two-step oracle change with an emergency pause. Consider keeping feed configuration in the market's governance boundary so changing the oracle implementation cannot silently change every price. Add a maximum per-transaction/cumulative borrow-liquidity check as defense in depth.
+
+### C-03 — Anyone can change the liquidation threshold
+
+- **Location:** `LendingMarket.setLiquidationThreshold`; consumed by `healthFactor`
+- **Impact:** `setLiquidationThreshold` has no access control or bounds. An attacker can raise it far above 10,000 bps, make a minimally collateralized account appear healthy, and drain treasury USDC through `borrow`. Setting it very low can instead make users liquidatable so the caller can repay their debt and collect collateral plus the 5% bonus. Extreme values can also overflow health calculations and deny service. The attacker gets USDC or liquidation bonuses; users lose collateral.
+- **Fix:** Add `onlyOwner`, constrain the value to an explicitly approved range at or below `BPS`, and route risk changes through a timelock. Accrue interest before a risk-parameter change and consider a delay or pause so users can exit before a more aggressive threshold becomes active.
+
+### H-01 — Health-factor division rounds the collateral ratio down to an integer
+
+- **Location:** `LendingMarket.healthFactor`
+- **Impact:** The expression divides `collateralValueUsd(user)` by `debtUsd` before multiplying by `WAD`. Ratios from 1.00 through 1.99 therefore all become `1`. With an 80% threshold, every such position reports a health factor of 0.8 and can be liquidated. In practice, borrowing is limited to roughly 50% LTV instead of the documented 80%, and a position at exactly 50% LTV can become fully liquidatable after an arbitrarily small adverse price move. Liquidators receive the 5% bonus while unlucky users lose collateral despite being healthy under the intended formula.
+- **Fix:** Multiply before dividing, using full-precision multiplication/division to avoid overflow: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Use a tested `mulDiv` implementation and add boundary tests immediately below, at, and above 80% LTV, including non-integer ratios.
+
+### H-02 — Oracle accepts stale, incomplete, and L2-downtime prices
+
+- **Location:** `PriceOracle.getPrice`
+- **Impact:** The oracle uses `latestAnswer()` and checks neither positivity nor freshness. A stale positive price can allow excess borrowing after collateral falls or cause wrongful liquidation after it rises. A zero answer values collateral at zero; a negative answer reverts during the signed-to-unsigned conversion and freezes borrowing, withdrawal health checks, and liquidations. On Arbitrum, the design also lacks a sequencer-uptime check and recovery grace period, so users or searchers can act on feeds before prices safely resume after downtime. Attackers can get underpriced loans or discounted collateral; users and the treasury bear insolvency or liquidation losses.
+- **Fix:** Use `latestRoundData()` and require `answer > 0`, a nonzero `updatedAt` within a per-feed heartbeat, and a complete round (`answeredInRound >= roundId`). On Arbitrum, check the Chainlink sequencer uptime feed and enforce a grace period after recovery. Make stale/invalid data fail closed, add a pause path, and normalize feed decimals safely for values both below and above 18.
+
+### H-03 — wstETH is configured with a stETH/USD feed without conversion
+
+- **Location:** launch configuration in `README.md`; `PriceOracle.getPrice`; `LendingMarket.collateralValueUsd`
+- **Impact:** The listed collateral is wstETH, but the configured feed is stETH/USD. One wstETH represents more than one stETH, and that conversion rate changes as staking rewards accrue. Treating one wstETH as one stETH systematically undervalues collateral and causes users to have lower borrowing power and to be liquidated earlier than the advertised threshold. Liquidators receive bonuses from positions that are healthy when valued as wstETH; affected users lose collateral. The error compounds H-01.
+- **Fix:** Price wstETH by composing the stETH/USD price with the canonical wstETH-to-stETH conversion (or use a suitable wstETH/USD feed if available). Normalize both legs to a common precision, validate each underlying datum, and add fork/configuration tests against the canonical wstETH contract and configured feed addresses before deployment.
+
+### M-01 — Signed borrow authorizations can be replayed indefinitely
+
+- **Location:** `LendingMarket.borrowWithSig`
+- **Impact:** The signed struct contains only borrower and amount. It has no nonce or deadline, and no digest is marked used. Any relayer that sees one valid signature can submit it repeatedly until the account reaches its borrowing limit. USDC is sent to the borrower, so the relayer does not receive it directly, but the borrower receives unwanted debt, accrues interest, and can be pushed close to liquidation. A relayer can later liquidate the position for the bonus or grief a user indefinitely with an old authorization.
+- **Fix:** Include a per-borrower nonce, deadline, and preferably the intended receiver/relayer in the EIP-712 struct. Increment the nonce before external interactions, reject expired signatures, enforce canonical `s` and valid `v` values (or use a tested ECDSA library), and support explicit nonce cancellation.
+
+### M-02 — Zero-value borrows can permanently bloat the liquidation loop
+
+- **Location:** `LendingMarket._borrow` and `LendingMarket.liquidateAll`
+- **Impact:** When `principalOf[borrower] == 0`, `_borrow` appends the caller before adding principal. `borrow(0)` leaves principal at zero, so any account can call it repeatedly and append unlimited duplicate entries at only gas cost. Repaid borrowers can also be appended again. The `borrowers` array is never pruned. An attacker can make `liquidateAll` exceed the block gas limit, disabling the keeper path specifically intended for large price moves and increasing insolvency risk during volatility.
+- **Fix:** Reject zero amounts, maintain a separate `isBorrower` membership flag, and remove or mark borrowers inactive when debt is cleared. Replace the unbounded sweep with paginated liquidation over caller-supplied accounts; individual liquidation should remain the primary permissionless path.
+
+### M-03 — Repayment rounding can take payment without reducing debt
+
+- **Location:** `LendingMarket.repay` and `LendingMarket.debtOf`
+- **Impact:** Repayment burns `amount * WAD / borrowIndex` principal units, rounding down. A sufficiently small nonzero repayment can burn zero principal even though USDC is transferred. Even when paying the reported full debt, double rounding can leave principal dust, so a user may be unable to fully close the position and withdraw collateral without making further payments. The market keeps USDC that did not reduce debt; unlucky users overpay and may remain exposed to liquidation.
+- **Fix:** If `amount == debt`, set principal to zero explicitly. For partial repayment, compute debt shares with a well-defined rounding direction and either reject an amount that burns zero shares or credit the exact shares burned and transfer only the corresponding assets. Add tests across large index values and one-unit boundaries.
+
+### M-04 — ERC-20 return values are ignored
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, and `seize`; `LendingMarket._borrow`, `repay`, and `_liquidate`
+- **Impact:** Every token transfer assumes success even when an ERC-20 returns `false`. A false-returning collateral token can create an accounting balance without transferring assets, enabling treasury USDC to be borrowed against nothing. A false-returning debt token can erase debt without collecting repayment, or record debt without delivering borrowed USDC. Canonical launch assets normally revert or return true, but this becomes exploitable through a bad future listing, bad deployment configuration, or token upgrade.
+- **Fix:** Use a well-tested safe-transfer wrapper that accepts either no return data or decoded `true` and reverts otherwise. Combine it with actual-balance-delta accounting for deposits and repayments where supported.
+
+### M-05 — Vault accounting is unsafe for fee-charging, rebasing, and callback tokens
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, `seize`, and `balanceOf`; `LendingMarket.listCollateral`
+- **Impact:** Deposits credit the requested amount rather than the amount received, external calls occur before accounting is finalized, and balances are stored as fixed token units. A fee-on-transfer token can therefore create phantom collateral and borrow real USDC; a callback-capable token can reenter withdrawal while the old balance is still recorded; positive or negative rebases desynchronize user claims from vault assets. This is especially relevant to the stated roadmap for yield-bearing and rebasing collateral. An attacker gets treasury USDC or other users' collateral; honest users can become unable to withdraw their recorded balances.
+- **Fix:** Do not list such assets with the current vault. Use checks-effects-interactions plus a reentrancy guard, credit verified balance deltas, and implement share-based accounting for rebasing/yield-bearing assets. Give each asset an adapter with explicit invariants and caps rather than treating all ERC-20s identically.
+
+### M-06 — Deeply underwater debt has no practical liquidation or resolution path
+
+- **Location:** `LendingMarket.liquidate` and `_liquidate`
+- **Impact:** A liquidator must repay 100% of a borrower's debt before collateral is seized. If collateral is worth less than the debt (or less than debt plus the bonus), liquidation is economically irrational, and there is no partial liquidation, bad-debt write-off, reserve, or collateral auction. After a price gap or oracle failure, bad positions can remain indefinitely and treasury USDC becomes unrecoverable. The borrower retains any previously borrowed value while the treasury absorbs the shortfall.
+- **Fix:** Add bounded partial liquidation and cap repayment by available collateral at the bonus-adjusted price. Define an explicit insolvency path—reserve/insurance, bad-debt accounting, or governance-controlled resolution—and test price gaps, exhausted collateral, and rounding at the final liquidation.
+
+### L-01 — Initialization and upgrades do not validate critical addresses or code
+
+- **Location:** `LendingMarket.initialize`, `LendingMarket.upgradeTo`, and `MarketProxy.constructor`
+- **Impact:** Initialization accepts zero addresses, mismatched vaults, EOAs, or contracts on the wrong network. The proxy and upgrade function accept an implementation with no code or an incompatible storage layout. If the proxy is ever deployed without atomic `initData`, another account can initialize it first. These errors can brick the market, strand funds, or give ownership to the wrong account; a front-runner gets control if initialization is exposed.
+- **Fix:** Always initialize atomically in the proxy constructor. Validate nonzero addresses, deployed code, the expected vault-to-market relationship, token identity/decimals, chain ID, and UUPS compatibility. Disable initializers on the implementation and add deployment assertions for every address in the README.
+
+### L-02 — Bulk liquidation is all-or-nothing and unbounded
+
+- **Location:** `LendingMarket.liquidateAll`
+- **Impact:** The function scans the complete historical borrowers array in one transaction and performs all liquidations using one caller's balance and allowance. Growth alone eventually makes it exceed the block gas limit; one transfer/oracle/seizure revert also rolls back every earlier liquidation. Keepers lose gas and underwater accounts later in the array remain untouched. M-02 makes this failure permissionlessly triggerable.
+- **Fix:** Remove the global sweep or paginate it with explicit start/end bounds and per-account failure isolation. Let keepers submit selected borrowers, emit failures without reverting successful independent liquidations where safe, and avoid relying on an ever-growing on-chain enumeration.
+
+## Additional observations and deployment recommendations
+
+- `setBorrowRate` is owner-only but unbounded. Governance can accidentally choose a value that makes accrual overflow or makes debt grow catastrophically. Cap it and apply changes through a timelock.
+- Interest uses `block.number` multiplied by a fixed 12 seconds. Verify this approximation against Arbitrum One's block-number semantics and operational requirements; timestamp-based accrual with bounded elapsed time is easier to reason about across L2 behavior changes.
+- There is no pause mechanism. Add narrowly scoped emergency stops for new borrowing and collateral withdrawal/liquidation behavior, with a governance design that cannot permanently trap healthy users.
+- Add events and two-step acceptance for ownership changes in `LendingMarket`; use separate, documented roles for upgrades, oracle/risk changes, and emergency response.
+
+## Review limitations
+
+The repository contains no tests or deployment scripts, so this review could not verify constructor ordering, proxy/vault address derivation, role custody, configured feed heartbeats, or deployed bytecode. The contracts compile successfully with Solidity 0.8.28. This was a focused manual source review, not a guarantee that all vulnerabilities are identified. Before launch, implement the fixes, add invariant/fuzz and Arbitrum-fork tests, and obtain a follow-up review of the exact deployment configuration and upgrade/storage-layout process.

codex
Completed [AUDIT-REPORT.md](/tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001/AUDIT-REPORT.md).

It contains 14 ranked findings: 3 critical, 3 high, 6 medium, and 2 low. The contracts compile successfully. `src/` remains unchanged, generated build artifacts were cleaned, and the report is the only new file.
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6d42af9c0edb8e4cb350945476a81e939c2105d2
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,126 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `README.md` and all Solidity files under `src/`  
+**Deployment target:** Arbitrum One  
+**Launch assets:** native USDC debt and wstETH collateral
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permissionless administration paths let any account take control of the market or make arbitrary debt appear healthy. Separately, the health-factor formula loses nearly all ratio precision, and the planned wstETH configuration uses a stETH price without applying the wstETH/stETH conversion rate. Both issues can liquidate positions well before the documented 80% threshold.
+
+Findings are ranked by the order in which the team should address them. The review found **3 critical, 3 high, 6 medium, and 2 low** issues. C-01 through H-03 are launch blockers. M-05 is a blocker before listing fee-charging, rebasing, or otherwise non-standard collateral.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take every asset |
+| 2 | C-02 | Critical | Anyone can install an attacker-controlled oracle |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold |
+| 4 | H-01 | High | Health-factor division rounds the collateral ratio down to an integer |
+| 5 | H-02 | High | Oracle accepts stale, incomplete, and L2-downtime prices |
+| 6 | H-03 | High | wstETH is configured with a stETH/USD feed without conversion |
+| 7 | M-01 | Medium | Signed borrow authorizations can be replayed indefinitely |
+| 8 | M-02 | Medium | Zero-value borrows can permanently bloat the liquidation loop |
+| 9 | M-03 | Medium | Repayment rounding can take payment without reducing debt |
+| 10 | M-04 | Medium | ERC-20 return values are ignored |
+| 11 | M-05 | Medium | Vault accounting is unsafe for fee-charging, rebasing, and callback tokens |
+| 12 | M-06 | Medium | Deeply underwater debt has no practical liquidation or resolution path |
+| 13 | L-01 | Low | Initialization and upgrades do not validate critical addresses or code |
+| 14 | L-02 | Low | Bulk liquidation is all-or-nothing and unbounded |
+
+## Detailed findings
+
+### C-01 — Anyone can upgrade the proxy and take every asset
+
+- **Location:** `LendingMarket.upgradeTo`
+- **Impact:** The function has no access control. Any account can set the ERC-1967 implementation slot to an attacker contract. That implementation executes in the proxy's storage context and can transfer all USDC held by the market, change every position, authorize itself to seize collateral through the vault, or permanently brick the proxy. The attacker gets the entire treasury USDC balance and can steal all collateral held for users.
+- **Fix:** Restrict upgrades to a properly secured owner/timelock, preferably through a standard audited UUPS implementation. Require `newImplementation.code.length > 0`, perform the UUPS compatibility check, emit the upgrade event only after validation, and put production ownership behind a multisig plus timelock. Test both unauthorized calls and storage compatibility across upgrades.
+
+### C-02 — Anyone can install an attacker-controlled oracle
+
+- **Location:** `LendingMarket.setOracle`; consumed by `collateralValueUsd`, `debtValueUsd`, `_borrow`, and `_liquidate`
+- **Impact:** `setOracle` has no access control. An attacker can install a `PriceOracle` they own, assign feeds returning an enormous collateral price and a tiny debt-asset price, deposit minimal wstETH, and borrow the market's entire USDC balance. They can then change prices again to liquidate other users for their collateral. The attacker gets treasury USDC and potentially the collateral of every borrower.
+- **Fix:** Add `onlyOwner`; validate a nonzero contract address; and use a timelocked two-step oracle change with an emergency pause. Consider keeping feed configuration in the market's governance boundary so changing the oracle implementation cannot silently change every price. Add a maximum per-transaction/cumulative borrow-liquidity check as defense in depth.
+
+### C-03 — Anyone can change the liquidation threshold
+
+- **Location:** `LendingMarket.setLiquidationThreshold`; consumed by `healthFactor`
+- **Impact:** `setLiquidationThreshold` has no access control or bounds. An attacker can raise it far above 10,000 bps, make a minimally collateralized account appear healthy, and drain treasury USDC through `borrow`. Setting it very low can instead make users liquidatable so the caller can repay their debt and collect collateral plus the 5% bonus. Extreme values can also overflow health calculations and deny service. The attacker gets USDC or liquidation bonuses; users lose collateral.
+- **Fix:** Add `onlyOwner`, constrain the value to an explicitly approved range at or below `BPS`, and route risk changes through a timelock. Accrue interest before a risk-parameter change and consider a delay or pause so users can exit before a more aggressive threshold becomes active.
+
+### H-01 — Health-factor division rounds the collateral ratio down to an integer
+
+- **Location:** `LendingMarket.healthFactor`
+- **Impact:** The expression divides `collateralValueUsd(user)` by `debtUsd` before multiplying by `WAD`. Ratios from 1.00 through 1.99 therefore all become `1`. With an 80% threshold, every such position reports a health factor of 0.8 and can be liquidated. In practice, borrowing is limited to roughly 50% LTV instead of the documented 80%, and a position at exactly 50% LTV can become fully liquidatable after an arbitrarily small adverse price move. Liquidators receive the 5% bonus while unlucky users lose collateral despite being healthy under the intended formula.
+- **Fix:** Multiply before dividing, using full-precision multiplication/division to avoid overflow: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Use a tested `mulDiv` implementation and add boundary tests immediately below, at, and above 80% LTV, including non-integer ratios.
+
+### H-02 — Oracle accepts stale, incomplete, and L2-downtime prices
+
+- **Location:** `PriceOracle.getPrice`
+- **Impact:** The oracle uses `latestAnswer()` and checks neither positivity nor freshness. A stale positive price can allow excess borrowing after collateral falls or cause wrongful liquidation after it rises. A zero answer values collateral at zero; a negative answer reverts during the signed-to-unsigned conversion and freezes borrowing, withdrawal health checks, and liquidations. On Arbitrum, the design also lacks a sequencer-uptime check and recovery grace period, so users or searchers can act on feeds before prices safely resume after downtime. Attackers can get underpriced loans or discounted collateral; users and the treasury bear insolvency or liquidation losses.
+- **Fix:** Use `latestRoundData()` and require `answer > 0`, a nonzero `updatedAt` within a per-feed heartbeat, and a complete round (`answeredInRound >= roundId`). On Arbitrum, check the Chainlink sequencer uptime feed and enforce a grace period after recovery. Make stale/invalid data fail closed, add a pause path, and normalize feed decimals safely for values both below and above 18.
+
+### H-03 — wstETH is configured with a stETH/USD feed without conversion
+
+- **Location:** launch configuration in `README.md`; `PriceOracle.getPrice`; `LendingMarket.collateralValueUsd`
+- **Impact:** The listed collateral is wstETH, but the configured feed is stETH/USD. One wstETH represents more than one stETH, and that conversion rate changes as staking rewards accrue. Treating one wstETH as one stETH systematically undervalues collateral and causes users to have lower borrowing power and to be liquidated earlier than the advertised threshold. Liquidators receive bonuses from positions that are healthy when valued as wstETH; affected users lose collateral. The error compounds H-01.
+- **Fix:** Price wstETH by composing the stETH/USD price with the canonical wstETH-to-stETH conversion (or use a suitable wstETH/USD feed if available). Normalize both legs to a common precision, validate each underlying datum, and add fork/configuration tests against the canonical wstETH contract and configured feed addresses before deployment.
+
+### M-01 — Signed borrow authorizations can be replayed indefinitely
+
+- **Location:** `LendingMarket.borrowWithSig`
+- **Impact:** The signed struct contains only borrower and amount. It has no nonce or deadline, and no digest is marked used. Any relayer that sees one valid signature can submit it repeatedly until the account reaches its borrowing limit. USDC is sent to the borrower, so the relayer does not receive it directly, but the borrower receives unwanted debt, accrues interest, and can be pushed close to liquidation. A relayer can later liquidate the position for the bonus or grief a user indefinitely with an old authorization.
+- **Fix:** Include a per-borrower nonce, deadline, and preferably the intended receiver/relayer in the EIP-712 struct. Increment the nonce before external interactions, reject expired signatures, enforce canonical `s` and valid `v` values (or use a tested ECDSA library), and support explicit nonce cancellation.
+
+### M-02 — Zero-value borrows can permanently bloat the liquidation loop
+
+- **Location:** `LendingMarket._borrow` and `LendingMarket.liquidateAll`
+- **Impact:** When `principalOf[borrower] == 0`, `_borrow` appends the caller before adding principal. `borrow(0)` leaves principal at zero, so any account can call it repeatedly and append unlimited duplicate entries at only gas cost. Repaid borrowers can also be appended again. The `borrowers` array is never pruned. An attacker can make `liquidateAll` exceed the block gas limit, disabling the keeper path specifically intended for large price moves and increasing insolvency risk during volatility.
+- **Fix:** Reject zero amounts, maintain a separate `isBorrower` membership flag, and remove or mark borrowers inactive when debt is cleared. Replace the unbounded sweep with paginated liquidation over caller-supplied accounts; individual liquidation should remain the primary permissionless path.
+
+### M-03 — Repayment rounding can take payment without reducing debt
+
+- **Location:** `LendingMarket.repay` and `LendingMarket.debtOf`
+- **Impact:** Repayment burns `amount * WAD / borrowIndex` principal units, rounding down. A sufficiently small nonzero repayment can burn zero principal even though USDC is transferred. Even when paying the reported full debt, double rounding can leave principal dust, so a user may be unable to fully close the position and withdraw collateral without making further payments. The market keeps USDC that did not reduce debt; unlucky users overpay and may remain exposed to liquidation.
+- **Fix:** If `amount == debt`, set principal to zero explicitly. For partial repayment, compute debt shares with a well-defined rounding direction and either reject an amount that burns zero shares or credit the exact shares burned and transfer only the corresponding assets. Add tests across large index values and one-unit boundaries.
+
+### M-04 — ERC-20 return values are ignored
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, and `seize`; `LendingMarket._borrow`, `repay`, and `_liquidate`
+- **Impact:** Every token transfer assumes success even when an ERC-20 returns `false`. A false-returning collateral token can create an accounting balance without transferring assets, enabling treasury USDC to be borrowed against nothing. A false-returning debt token can erase debt without collecting repayment, or record debt without delivering borrowed USDC. Canonical launch assets normally revert or return true, but this becomes exploitable through a bad future listing, bad deployment configuration, or token upgrade.
+- **Fix:** Use a well-tested safe-transfer wrapper that accepts either no return data or decoded `true` and reverts otherwise. Combine it with actual-balance-delta accounting for deposits and repayments where supported.
+
+### M-05 — Vault accounting is unsafe for fee-charging, rebasing, and callback tokens
+
+- **Location:** `CollateralVault.deposit`, `withdraw`, `seize`, and `balanceOf`; `LendingMarket.listCollateral`
+- **Impact:** Deposits credit the requested amount rather than the amount received, external calls occur before accounting is finalized, and balances are stored as fixed token units. A fee-on-transfer token can therefore create phantom collateral and borrow real USDC; a callback-capable token can reenter withdrawal while the old balance is still recorded; positive or negative rebases desynchronize user claims from vault assets. This is especially relevant to the stated roadmap for yield-bearing and rebasing collateral. An attacker gets treasury USDC or other users' collateral; honest users can become unable to withdraw their recorded balances.
+- **Fix:** Do not list such assets with the current vault. Use checks-effects-interactions plus a reentrancy guard, credit verified balance deltas, and implement share-based accounting for rebasing/yield-bearing assets. Give each asset an adapter with explicit invariants and caps rather than treating all ERC-20s identically.
+
+### M-06 — Deeply underwater debt has no practical liquidation or resolution path
+
+- **Location:** `LendingMarket.liquidate` and `_liquidate`
+- **Impact:** A liquidator must repay 100% of a borrower's debt before collateral is seized. If collateral is worth less than the debt (or less than debt plus the bonus), liquidation is economically irrational, and there is no partial liquidation, bad-debt write-off, reserve, or collateral auction. After a price gap or oracle failure, bad positions can remain indefinitely and treasury USDC becomes unrecoverable. The borrower retains any previously borrowed value while the treasury absorbs the shortfall.
+- **Fix:** Add bounded partial liquidation and cap repayment by available collateral at the bonus-adjusted price. Define an explicit insolvency path—reserve/insurance, bad-debt accounting, or governance-controlled resolution—and test price gaps, exhausted collateral, and rounding at the final liquidation.
+
+### L-01 — Initialization and upgrades do not validate critical addresses or code
+
+- **Location:** `LendingMarket.initialize`, `LendingMarket.upgradeTo`, and `MarketProxy.constructor`
+- **Impact:** Initialization accepts zero addresses, mismatched vaults, EOAs, or contracts on the wrong network. The proxy and upgrade function accept an implementation with no code or an incompatible storage layout. If the proxy is ever deployed without atomic `initData`, another account can initialize it first. These errors can brick the market, strand funds, or give ownership to the wrong account; a front-runner gets control if initialization is exposed.
+- **Fix:** Always initialize atomically in the proxy constructor. Validate nonzero addresses, deployed code, the expected vault-to-market relationship, token identity/decimals, chain ID, and UUPS compatibility. Disable initializers on the implementation and add deployment assertions for every address in the README.
+
+### L-02 — Bulk liquidation is all-or-nothing and unbounded
+
+- **Location:** `LendingMarket.liquidateAll`
+- **Impact:** The function scans the complete historical borrowers array in one transaction and performs all liquidations using one caller's balance and allowance. Growth alone eventually makes it exceed the block gas limit; one transfer/oracle/seizure revert also rolls back every earlier liquidation. Keepers lose gas and underwater accounts later in the array remain untouched. M-02 makes this failure permissionlessly triggerable.
+- **Fix:** Remove the global sweep or paginate it with explicit start/end bounds and per-account failure isolation. Let keepers submit selected borrowers, emit failures without reverting successful independent liquidations where safe, and avoid relying on an ever-growing on-chain enumeration.
+
+## Additional observations and deployment recommendations
+
+- `setBorrowRate` is owner-only but unbounded. Governance can accidentally choose a value that makes accrual overflow or makes debt grow catastrophically. Cap it and apply changes through a timelock.
+- Interest uses `block.number` multiplied by a fixed 12 seconds. Verify this approximation against Arbitrum One's block-number semantics and operational requirements; timestamp-based accrual with bounded elapsed time is easier to reason about across L2 behavior changes.
+- There is no pause mechanism. Add narrowly scoped emergency stops for new borrowing and collateral withdrawal/liquidation behavior, with a governance design that cannot permanently trap healthy users.
+- Add events and two-step acceptance for ownership changes in `LendingMarket`; use separate, documented roles for upgrades, oracle/risk changes, and emergency response.
+
+## Review limitations
+
+The repository contains no tests or deployment scripts, so this review could not verify constructor ordering, proxy/vault address derivation, role custody, configured feed heartbeats, or deployed bytecode. The contracts compile successfully with Solidity 0.8.28. This was a focused manual source review, not a guarantee that all vulnerabilities are identified. Before launch, implement the fixes, add invariant/fuzz and Arbitrum-fork tests, and obtain a follow-up review of the exact deployment configuration and upgrade/storage-layout process.

tokens used
32,399
````

## final message

Completed [AUDIT-REPORT.md](/tmp/ethskills-audit-eval/2026-09-04T155046Z-codex-no-skill-1/audit-goal-001/AUDIT-REPORT.md).

It contains 14 ranked findings: 3 critical, 3 high, 6 medium, and 2 low. The contracts compile successfully. `src/` remains unchanged, generated build artifacts were cleaned, and the report is the only new file.

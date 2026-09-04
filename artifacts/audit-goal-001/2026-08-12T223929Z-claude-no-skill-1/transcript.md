## init
model: claude-opus-5
cwd: /Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace
skills: ['design-sync', 'dataviz', 'update-config', 'verify', 'debug', 'code-review', 'simplify', 'batch', 'fewer-permission-prompts', 'doctor', 'loop', 'schedule', 'claude-api', 'run', 'run-skill-generator']

### assistant
I'll start by reading the README and getting a picture of the codebase.

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/README.md"}
```

#### tool_result
```
1	# ArbiLend
2	
3	Overcollateralised USDC lending market. Users deposit collateral into
4	`CollateralVault`, borrow USDC from `LendingMarket` against it, and are
5	liquidated when their position falls below the liquidation threshold.
6	
7	Deployment target: **Arbitrum One**. Mainnet is not in scope for this release.
8	
9	| Piece | Address / value |
10	| --- | --- |
11	| Debt asset | USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
12	| First listed collateral | wstETH `0x5979D7b546E38E414F7E9822514be443A4800529` |
13	| Feed set for wstETH | stETH / USD `0x07C5b924399cc23c24a95c8743DE4006a32b7f2a` |
14	| Feed set for USDC | USDC / USD `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3` |
15	| Liquidation threshold | 8000 bps |
16	| Liquidation bonus | 500 bps |
17	| Borrow rate | 400 bps / year |
18	
19	## Contracts
20	
21	- `LendingMarket` — borrow / repay / liquidate, interest accrual, health
22	  factor. Sits behind `MarketProxy` so we can ship fixes without migrating
23	  positions. Storage layout is append-only; do not reorder.
24	- `CollateralVault` — custody and per-user accounting for collateral. Only the
25	  market can seize.
26	- `PriceOracle` — Chainlink price source, one feed per token, prices returned
27	  scaled to 1e18 USD.
28	- `MarketProxy` — ERC-1967 proxy the market is deployed behind.
29	
30	## Collateral listing
31	
32	wstETH is the only collateral at launch. Governance lists further tokens with
33	`LendingMarket.listCollateral`; the shortlist for the next ro
```

### tool_use: Bash
```json
{"command": "find . -type f -not -path './.git/*' -not -path './node_modules/*' | head -100 && echo \"---\" && ls -la", "description": "List workspace files"}
```

#### tool_result
```
./foundry.toml
./README.md
./.gitignore
./TASK.md
./src/MarketProxy.sol
./src/PriceOracle.sol
./src/CollateralVault.sol
./src/LendingMarket.sol
./src/interfaces/IERC20.sol
./src/interfaces/IAggregatorV3.sol
./src/interfaces/ILendingMarket.sol
---
total 32
drwxr-xr-x@ 7 spencerfaber  staff   224 Aug 12 16:39 .
drwxr-xr-x@ 4 spencerfaber  staff   128 Aug 12 16:39 ..
-rw-r--r--@ 1 spencerfaber  staff    33 Aug 12 16:39 .gitignore
-rw-r--r--@ 1 spencerfaber  staff   150 Aug 12 16:39 foundry.toml
-rw-r--r--@ 1 spencerfaber  staff  2028 Aug 12 16:39 README.md
drwxr-xr-x@ 7 spencerfaber  staff   224 Aug 12 16:39 src
-rw-r--r--@ 1 spencerfaber  staff   851 Aug 12 16:39 TASK.md
```

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/src/LendingMarket.sol"}
```

#### tool_result
```
1	// SPDX-License-Identifier: MIT
2	pragma solidity 0.8.28;
3	
4	import {IERC20} from "./interfaces/IERC20.sol";
5	import {PriceOracle} from "./PriceOracle.sol";
6	import {CollateralVault} from "./CollateralVault.sol";
7	
8	/// @notice Overcollateralised USDC lending market. Deployed behind MarketProxy; storage layout is append-only.
9	contract LendingMarket {
10	    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
11	    bytes32 internal constant BORROW_TYPEHASH = keccak256("Borrow(address borrower,uint256 amount)");
12	
13	    uint256 internal constant BPS = 10_000;
14	    uint256 internal constant WAD = 1e18;
15	    uint256 internal constant SECONDS_PER_BLOCK = 12;
16	
17	    bool public initialized;
18	    address public owner;
19	    PriceOracle public oracle;
20	    CollateralVault public vault;
21	    IERC20 public debtAsset;
22	    uint256 public liquidationThreshold;
23	    uint256 public liquidationBonus;
24	    uint256 public borrowRate;
25	    uint256 public borrowIndex;
26	    uint256 public lastAccrualBlock;
27	    address[] public collateralTokens;
28	    mapping(address => bool) public isCollateral;
29	    mapping(address => uint256) public principalOf;
30	    address[] public borrowers;
31	    bytes32 public domainSeparator;
32	
33	    error AlreadyInitialized();
34	    error NotOwner();
35	    error NotCollateral(address token);
36	    error BadSignature();
37	    error Unhealthy();
38	    er
```

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/src/CollateralVault.sol"}
```

#### tool_result
```
1	// SPDX-License-Identifier: MIT
2	pragma solidity 0.8.28;
3	
4	import {IERC20} from "./interfaces/IERC20.sol";
5	import {ILendingMarket} from "./interfaces/ILendingMarket.sol";
6	
7	/// @notice Custody and per-user accounting for collateral. Only the market can seize.
8	contract CollateralVault {
9	    address public immutable market;
10	
11	    mapping(address => bool) public supported;
12	    mapping(address => mapping(address => uint256)) public balanceOf;
13	
14	    error NotMarket();
15	    error TokenNotSupported(address token);
16	    error InsufficientBalance();
17	
18	    event Deposited(address indexed user, address indexed token, uint256 amount);
19	    event Withdrawn(address indexed user, address indexed token, uint256 amount);
20	    event Seized(address indexed user, address indexed token, address indexed to, uint256 amount);
21	
22	    modifier onlyMarket() {
23	        if (msg.sender != market) revert NotMarket();
24	        _;
25	    }
26	
27	    constructor(address market_) {
28	        market = market_;
29	    }
30	
31	    function setSupported(address token, bool isSupported) external onlyMarket {
32	        supported[token] = isSupported;
33	    }
34	
35	    function deposit(address token, uint256 amount) external {
36	        if (!supported[token]) revert TokenNotSupported(token);
37	
38	        IERC20(token).transferFrom(msg.sender, address(this), amount);
39	        balanceOf[msg.sender][token] += amount;
40	
41	        emit Deposited(msg.sender, to
```

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/src/PriceOracle.sol"}
```

#### tool_result
```
1	// SPDX-License-Identifier: MIT
2	pragma solidity 0.8.28;
3	
4	import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
5	
6	/// @notice Chainlink price source for the market. One feed per token, prices returned scaled to 1e18 USD.
7	contract PriceOracle {
8	    address public owner;
9	
10	    mapping(address => IAggregatorV3) public feeds;
11	
12	    error NotOwner();
13	    error FeedNotSet(address token);
14	
15	    event FeedUpdated(address indexed token, address feed);
16	    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
17	
18	    modifier onlyOwner() {
19	        if (msg.sender != owner) revert NotOwner();
20	        _;
21	    }
22	
23	    constructor() {
24	        owner = msg.sender;
25	        emit OwnershipTransferred(address(0), msg.sender);
26	    }
27	
28	    function transferOwnership(address newOwner) external onlyOwner {
29	        emit OwnershipTransferred(owner, newOwner);
30	        owner = newOwner;
31	    }
32	
33	    function setFeed(address token, IAggregatorV3 feed) external onlyOwner {
34	        feeds[token] = feed;
35	        emit FeedUpdated(token, address(feed));
36	    }
37	
38	    /// @notice Price of one whole unit of `token` in USD, scaled to 1e18.
39	    function getPrice(address token) external view returns (uint256) {
40	        IAggregatorV3 feed = feeds[token];
41	        if (address(feed) == address(0)) revert FeedNotSet(token);
42	
43	        int256 answer = feed.latestAnswer();
44	        
```

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/src/MarketProxy.sol"}
```

#### tool_result
```
1	// SPDX-License-Identifier: MIT
2	pragma solidity 0.8.28;
3	
4	/// @notice ERC-1967 proxy the market is deployed behind. The implementation owns the upgrade entry point.
5	contract MarketProxy {
6	    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
7	
8	    event Upgraded(address indexed implementation);
9	
10	    constructor(address implementation, bytes memory initData) {
11	        assembly {
12	            sstore(IMPLEMENTATION_SLOT, implementation)
13	        }
14	        emit Upgraded(implementation);
15	
16	        if (initData.length > 0) {
17	            (bool ok, bytes memory ret) = implementation.delegatecall(initData);
18	            if (!ok) {
19	                assembly {
20	                    revert(add(ret, 0x20), mload(ret))
21	                }
22	            }
23	        }
24	    }
25	
26	    fallback() external payable {
27	        assembly {
28	            let impl := sload(IMPLEMENTATION_SLOT)
29	            calldatacopy(0, 0, calldatasize())
30	            let ok := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
31	            returndatacopy(0, 0, returndatasize())
32	            switch ok
33	            case 0 { revert(0, returndatasize()) }
34	            default { return(0, returndatasize()) }
35	        }
36	    }
37	
38	    receive() external payable {}
39	}
40	
```

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/src/interfaces/IERC20.sol"}
```

#### tool_result
```
1	// SPDX-License-Identifier: MIT
2	pragma solidity 0.8.28;
3	
4	interface IERC20 {
5	    function totalSupply() external view returns (uint256);
6	
7	    function balanceOf(address account) external view returns (uint256);
8	
9	    function allowance(address owner, address spender) external view returns (uint256);
10	
11	    function approve(address spender, uint256 amount) external returns (bool);
12	
13	    function transfer(address to, uint256 amount) external returns (bool);
14	
15	    function transferFrom(address from, address to, uint256 amount) external returns (bool);
16	
17	    function decimals() external view returns (uint8);
18	}
19	
```

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/src/interfaces/IAggregatorV3.sol"}
```

#### tool_result
```
1	// SPDX-License-Identifier: MIT
2	pragma solidity 0.8.28;
3	
4	interface IAggregatorV3 {
5	    function decimals() external view returns (uint8);
6	
7	    function description() external view returns (string memory);
8	
9	    function latestAnswer() external view returns (int256);
10	
11	    function latestRoundData()
12	        external
13	        view
14	        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
15	}
16	
```

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/src/interfaces/ILendingMarket.sol"}
```

#### tool_result
```
1	// SPDX-License-Identifier: MIT
2	pragma solidity 0.8.28;
3	
4	interface ILendingMarket {
5	    function requireHealthy(address user) external view;
6	}
7	
```

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/TASK.md"}
```

#### tool_result
```
1	This workspace is ArbiLend, our overcollateralised USDC lending market. It is
2	code-complete and we deploy to Arbitrum One in two weeks. Nothing is live yet
3	and the code is not hosted anywhere — this directory is the whole codebase.
4	
5	I need a security review before we put real money behind it. Start with
6	README.md: it says what we are shipping, where it runs, and what we plan to
7	list next.
8	
9	Write AUDIT-REPORT.md in this directory. For every issue: a severity, the
10	contract and function it lives in, what an attacker or an unlucky user
11	actually gets out of it, and the fix you would make. Rank it so I can hand
12	the top of the list to the team on Monday.
13	
14	Report only — leave everything under src/ exactly as it is. AUDIT-REPORT.md
15	should be the only file you leave behind: if you take working notes on the
16	way, clear them out before you finish.
17	
```

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/foundry.toml"}
```

#### tool_result
```
1	[profile.default]
2	src = "src"
3	out = "out"
4	libs = ["lib"]
5	solc = "0.8.28"
6	optimizer = true
7	optimizer_runs = 200
8	
9	[fmt]
10	line_length = 120
11	tab_width = 4
12	
```

### tool_use: Bash
```json
{"command": "cat .gitignore && which forge", "description": "Check gitignore and forge availability"}
```

#### tool_result
```
out/
cache/
broadcast/
lib/
.env
/Users/spencerfaber/.foundry/bin/forge
```

### tool_use: Bash
```json
{"command": "forge build 2>&1 | tail -20", "description": "Compile contracts"}
```

#### tool_result
```
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
```

### tool_use: Bash
```json
{"command": "python3 -c \"\nWAD=10**18; BPS=10000; LT=8000\ndef hf(coll,debt):\n    if debt==0: return float('inf')\n    return (coll//debt)*LT*WAD//BPS\ndef correct(coll,debt): return coll*LT*WAD//(BPS*debt)\nfor ratio in [1.26,1.5,1.99,2.0,2.5,2.99,3.0]:\n    debt=5000*10**18; coll=int(debt*ratio)\n    print(f'ratio={ratio}: asImpl={hf(coll,debt)/1e18:.4f} correct={correct(coll,debt)/1e18:.4f} liquidatable={hf(coll,debt)<WAD}')\n\"", "description": "Check healthFactor truncation numerically"}
```

#### tool_result
```
ratio=1.26: asImpl=0.8000 correct=1.0080 liquidatable=True
ratio=1.5: asImpl=0.8000 correct=1.2000 liquidatable=True
ratio=1.99: asImpl=0.8000 correct=1.5920 liquidatable=True
ratio=2.0: asImpl=1.6000 correct=1.6000 liquidatable=False
ratio=2.5: asImpl=1.6000 correct=2.0000 liquidatable=False
ratio=2.99: asImpl=1.6000 correct=2.3920 liquidatable=False
ratio=3.0: asImpl=2.4000 correct=2.4000 liquidatable=False
```

### assistant
Confirmed the arithmetic and that the code compiles. Writing the report.

### tool_use: Write
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/AUDIT-REPORT.md", "content": "# ArbiLend \u2014 Security Review\n\n**Scope:** `src/LendingMarket.sol`, `src/CollateralVault.sol`, `src/PriceOracle.sol`,\n`src/MarketProxy.sol`, `src/interfaces/*`, plus the deployment parameters declared in\n`README.md`.\n**Target chain:** Arbitrum One.\n**Commit state:** working tree as provided; compiles under solc 0.8.28.\n**Reviewer note:** there is no test suite, so every claim below was derived by reading the\ncode. Arithmetic claims (C-4) were checked numerically against the exact integer\nsemantics of the implementation.\n\n## Verdict\n\n**Do not deploy this in two weeks.** Four issues are Critical and three of them are\none-transaction total-loss bugs reachable by any address on the network with no setup and\nno capital. A fifth (C-4) makes the market misprice every single position by construction\n\u2014 it is not an edge case, it fires on the very first borrow.\n\nThe four Criticals are all small, contained fixes. The dangerous part of the schedule is\nnot the patching, it is that a codebase with three missing `onlyOwner` modifiers and a\nbroken health-factor formula has never been executed against a test. Budget for the test\nsuite as the deliverable, not the patches.\n\n## Ranked findings\n\nHand rows 1\u20135 to the team on Monday. Rows 1\u20133 are a fifteen-minute fix and should land\nfirst regardless of how the rest is scheduled.\n\n| # | Sev | Contract \u00b7 function | One-line impact |\n| --- | --- | --- | --- |\n| C-1 | Critical | `LendingMarket.upgradeTo` | Anyone becomes the implementation; whole market drained |\n| C-2 | Critical | `LendingMarket.setOracle` | Anyone sets prices; whole market drained |\n| C-3 | Critical | `LendingMarket.setLiquidationThreshold` | Anyone liquidates every position, or borrows unbacked |\n| C-4 | Critical | `LendingMarket.healthFactor` | Truncation: real r
```

#### tool_result
```
File created successfully at: /Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-12T223929Z-claude-no-skill-1/workspace/AUDIT-REPORT.md (file state is current in your context — no need to Read it back)
```

### assistant
Now cleaning up the build artifacts from `forge build`:

### tool_use: Bash
```json
{"command": "rm -rf out cache && git status --short && ls -la", "description": "Remove build artifacts and verify tree state"}
```

#### tool_result
```
?? ../../../../.pnp.cjs
?? ../../../../.pnp.loader.mjs
?? ../../
?? ../../../audit-quiz-001/
?? ../../../audit-quiz-002/
?? ../../../audit-quiz-003/
total 104
drwxr-xr-x@ 8 spencerfaber  staff    256 Aug 12 16:45 .
drwxr-xr-x@ 4 spencerfaber  staff    128 Aug 12 16:39 ..
-rw-r--r--@ 1 spencerfaber  staff     33 Aug 12 16:39 .gitignore
-rw-r--r--@ 1 spencerfaber  staff  34902 Aug 12 16:45 AUDIT-REPORT.md
-rw-r--r--@ 1 spencerfaber  staff    150 Aug 12 16:39 foundry.toml
-rw-r--r--@ 1 spencerfaber  staff   2028 Aug 12 16:39 README.md
drwxr-xr-x@ 7 spencerfaber  staff    224 Aug 12 16:39 src
-rw-r--r--@ 1 spencerfaber  staff    851 Aug 12 16:39 TASK.md
```

### assistant
`AUDIT-REPORT.md` is written. `src/` is untouched and the `out/`/`cache/` dirs from my one `forge build` are gone — the report is the only file added.

**22 findings: 4 Critical, 4 High, 8 Medium, 5 Low.** My verdict is don't ship in two weeks — not because the patches are hard, but because three of the four Criticals are one-transaction total-loss bugs that a single test would have caught, and there are no tests.

The top of the list for Monday:

**C-1/C-2/C-3 — three missing `onlyOwner` modifiers.** `upgradeTo`, `setOracle` and `setLiquidationThreshold` are callable by anyone. Each independently drains the market: replace the implementation, feed fake prices, or set the threshold to 0 and `liquidateAll()`. `setBorrowRate` and `listCollateral` right beside them *do* have the modifier, so this is omission, not design. Fifteen-minute fix.

**C-4 — `healthFactor` divides before it multiplies** (line 150). `collateralValueUsd(user) / debtUsd` truncates to an integer ratio before the threshold is applied. I checked this numerically against the exact integer semantics: the real requirement is **200% collateral, not the 125% the README advertises**, and a user who borrows at exactly 200% is liquidated by the next `accrueInterest()` — which any stranger's `repay` triggers — at 199.99% collateralisation, with no price movement at all.

**H-1 — `borrowWithSig` has no nonce and no deadline.** One signature is an unlimited borrow authorisation; replay it until the borrower is unhealthy, then liquidate for the bonus. My recommendation is to delete the function for v1 rather than fix it — it isn't needed for launch.

Two findings came out of reading the README against the code rather than the code alone:

- **H-3:** wstETH is priced off a **stETH/USD** feed. wstETH is worth ~1.2 stETH and that ratio only grows. Because `price` sits in the denominator of the seize calculation, liquidators receive ~20% *more* wstETH than they're owed — the advertised 5% bonus is an effective ~26% penalty on the borrower.
- **M-5:** the README says the treasury takes the interest, but there is no function that moves USDC out except `borrow`. Principal and interest are stranded, recoverable only via a contract upgrade.

**H-2** is the Arbitrum-specific one: `getPrice` uses deprecated `latestAnswer()` with no staleness, negative or zero checks, and no sequencer uptime feed — so the first block after a sequencer outage is a free-for-all against positions their owners couldn't defend.

Two calls I deliberately did *not* rate as bugs, in case they come up: `SECONDS_PER_BLOCK = 12` is roughly correct on Arbitrum (Nitro's `block.number` tracks L1), so it's Low, not a broken interest rate. And **H-4** (reentrancy in `CollateralVault.withdraw`) isn't exploitable with wstETH — it goes live the moment governance lists a token with transfer hooks, which is why I flagged M-6/M-7 as prerequisites for the weETH/ezETH/USDT round rather than post-launch cleanup.

One limit worth stating plainly: nothing here was proven by execution. I read the feed addresses as labelled in the README and did not resolve them on-chain — worth verifying before deployment, since a wrong feed address is the same bug class as H-3 with a bigger blast radius.

## result
subtype: success is_error: False turns: 17 cost_usd: 1.293226 duration_ms: 395038

`AUDIT-REPORT.md` is written. `src/` is untouched and the `out/`/`cache/` dirs from my one `forge build` are gone — the report is the only file added.

**22 findings: 4 Critical, 4 High, 8 Medium, 5 Low.** My verdict is don't ship in two weeks — not because the patches are hard, but because three of the four Criticals are one-transaction total-loss bugs that a single test would have caught, and there are no tests.

The top of the list for Monday:

**C-1/C-2/C-3 — three missing `onlyOwner` modifiers.** `upgradeTo`, `setOracle` and `setLiquidationThreshold` are callable by anyone. Each independently drains the market: replace the implementation, feed fake prices, or set the threshold to 0 and `liquidateAll()`. `setBorrowRate` and `listCollateral` right beside them *do* have the modifier, so this is omission, not design. Fifteen-minute fix.

**C-4 — `healthFactor` divides before it multiplies** (line 150). `collateralValueUsd(user) / debtUsd` truncates to an integer ratio before the threshold is applied. I checked this numerically against the exact integer semantics: the real requirement is **200% collateral, not the 125% the README advertises**, and a user who borrows at exactly 200% is liquidated by the next `accrueInterest()` — which any stranger's `repay` triggers — at 199.99% collateralisation, with no price movement at all.

**H-1 — `borrowWithSig` has no nonce and no deadline.** One signature is an unlimited borrow authorisation; replay it until the borrower is unhealthy, then liquidate for the bonus. My recommendation is to delete the function for v1 rather than fix it — it isn't needed for launch.

Two findings came out of reading the README against the code rather than the code alone:

- **H-3:** wstETH is priced off a **stETH/USD** feed. wstETH is worth ~1.2 stETH and that ratio only grows. Because `price` sits in the denominator of the seize calculation, liquidators receive ~20% *more* wstETH than they're owed — the advertised 5% bonus is an effective ~26% penalty on the borrower.
- **M-5:** the README says the treasury takes the interest, but there is no function that moves USDC out except `borrow`. Principal and interest are stranded, recoverable only via a contract upgrade.

**H-2** is the Arbitrum-specific one: `getPrice` uses deprecated `latestAnswer()` with no staleness, negative or zero checks, and no sequencer uptime feed — so the first block after a sequencer outage is a free-for-all against positions their owners couldn't defend.

Two calls I deliberately did *not* rate as bugs, in case they come up: `SECONDS_PER_BLOCK = 12` is roughly correct on Arbitrum (Nitro's `block.number` tracks L1), so it's Low, not a broken interest rate. And **H-4** (reentrancy in `CollateralVault.withdraw`) isn't exploitable with wstETH — it goes live the moment governance lists a token with transfer hooks, which is why I flagged M-6/M-7 as prerequisites for the weETH/ezETH/USDT round rather than post-launch cleanup.

One limit worth stating plainly: nothing here was proven by execution. I read the feed addresses as labelled in the README and did not resolve them on-chain — worth verifying before deployment, since a wrong feed address is the same bug class as H-3 with a bigger blast radius.

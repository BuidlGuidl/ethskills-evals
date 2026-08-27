## init
model: claude-opus-5
cwd: /Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace
skills: ['audit', 'design-sync', 'dataviz', 'update-config', 'verify', 'debug', 'code-review', 'simplify', 'batch', 'fewer-permission-prompts', 'doctor', 'loop', 'schedule', 'claude-api', 'run', 'run-skill-generator']

### assistant
I'll start by reading the README and getting oriented in the codebase.

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/README.md"}
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
{"command": "ls -la && find . -path ./node_modules -prune -o -type f -print | head -100", "description": "List workspace files"}
```

#### tool_result
```
total 32
drwxr-xr-x@ 9 spencerfaber  staff   288 Aug 12 18:21 .
drwxr-xr-x@ 4 spencerfaber  staff   128 Aug 12 18:21 ..
drwxr-xr-x@ 3 spencerfaber  staff    96 Aug 12 18:21 .agents
drwxr-xr-x@ 3 spencerfaber  staff    96 Aug 12 18:21 .claude
-rw-r--r--@ 1 spencerfaber  staff    33 Aug 12 18:21 .gitignore
-rw-r--r--@ 1 spencerfaber  staff   150 Aug 12 18:21 foundry.toml
-rw-r--r--@ 1 spencerfaber  staff  2028 Aug 12 18:21 README.md
drwxr-xr-x@ 7 spencerfaber  staff   224 Aug 12 18:21 src
-rw-r--r--@ 1 spencerfaber  staff   851 Aug 12 18:21 TASK.md
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
./.agents/skills/audit/SKILL.md
./.claude/skills/audit/SKILL.md
```

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/src/LendingMarket.sol"}
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
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/TASK.md"}
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
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/src/CollateralVault.sol"}
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
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/src/PriceOracle.sol"}
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
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/src/MarketProxy.sol"}
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
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/.claude/skills/audit/SKILL.md"}
```

#### tool_result
```
1	---
2	name: audit
3	description: Deep EVM smart contract security audit system. Use when asked to audit a contract, find vulnerabilities, review code for security issues, or file security issues on a GitHub repo. Covers 500+ non-obvious checklist items across 19 domains via parallel sub-agents. Different from the security skill (which teaches defensive coding) — this is for systematically auditing contracts you didn't write.
4	---
5	
6	# EVM Smart Contract Audit
7	
8	A full audit system for any EVM contract. Runs parallel specialist agents against domain-specific checklists, synthesizes findings, and files GitHub issues.
9	
10	## The Checklists
11	
12	20 specialized skills covering every major vulnerability domain. Fetch the master index first:
13	
14	```
15	https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md
16	```
17	
18	The master index contains:
19	- Full routing table (which skills to load for which contract types)
20	- The complete audit methodology (recon → parallel agents → synthesis → issues)
21	- Standard finding format with severity definitions
22	
23	All 20 skill checklists are at:
24	```
25	https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/<skill-name>/references/checklist.md
26	```
27	
28	## Skills Available
29	
30	| Skill | When to Load |
31	|-------|-------------|
32	| `evm-audit-general` | Always |
33	| `evm-audit-precision-math` | Always |
34	| `evm-audit-erc20` | Contract interacts with E
```

### tool_use: Read
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/src/interfaces/IERC20.sol"}
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
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/src/interfaces/IAggregatorV3.sol"}
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
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/src/interfaces/ILendingMarket.sol"}
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
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/foundry.toml"}
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
{"command": "(which forge >/dev/null 2>&1 && forge build 2>&1 | tail -20 || echo \"forge not installed\")", "description": "Try compiling the contracts"}
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

### assistant
It compiles cleanly. I've read all four contracts and the interfaces. Writing the report now.

### tool_use: Write
```json
{"file_path": "/Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/AUDIT-REPORT.md", "content": "# ArbiLend \u2014 Security Review\n\n**Scope:** `src/LendingMarket.sol`, `src/CollateralVault.sol`, `src/PriceOracle.sol`,\n`src/MarketProxy.sol`, `src/interfaces/*` \u2014 commit as found in this working tree.\n**Target chain:** Arbitrum One. **Debt asset:** USDC. **Launch collateral:** wstETH.\n**Method:** manual review of the full source (\u2248350 lines), plus the deployment\nparameters documented in `README.md`. Compiles under `forge build` (solc 0.8.28).\n\n**Bottom line: do not deploy this.** Five findings are individually fatal \u2014 three\nof them are one unauthenticated transaction away from draining every dollar in\nthe market, and a fourth means that *every borrower who uses the protocol as\ndocumented is liquidatable from the moment they borrow*. The access-control gaps\n(C-1 \u2026 C-3) are the ones to hand the team on Monday; they are also the cheapest\nto fix. The health-factor bug (C-4) is the one that would have burned real users\neven with no attacker present.\n\nThere is no test suite. Several findings below (C-4 above all) would have been\ncaught by a single unit test asserting a known-good health factor. Landing tests\nbefore the fixes, not after, is the highest-leverage process change available in\nthe two weeks you have.\n\n---\n\n## Findings at a glance\n\n| # | Sev | Contract \u00b7 Function | One-line impact |\n|---|-----|--------------------|-----------------|\n| C-1 | Critical | `LendingMarket.upgradeTo` | Anyone upgrades the market and takes all USDC + all collateral |\n| C-2 | Critical | `LendingMarket.setOracle` | Anyone swaps in a fake price feed and drains the USDC float |\n| C-3 | Critical | `LendingMarket.setLiquidationThreshold` | Anyone borrows the whole float against dust, or mass-liquidates every user |\n| C-4 | Critical | `LendingMarket.healthFactor` | Truncating divis
```

#### tool_result
```
File created successfully at: /Users/spencerfaber/dev/ethskills-evals/artifacts/audit-goal-001/2026-08-13T002153Z-claude-with-skill-2/workspace/AUDIT-REPORT.md (file state is current in your context — no need to Read it back)
```

### tool_use: Bash
```json
{"command": "cat .gitignore && echo \"--- untracked/modified:\" && git status --porcelain . && echo \"--- dirs:\" && ls -a", "description": "Check for leftover build artifacts"}
```

#### tool_result
```
out/
cache/
broadcast/
lib/
.env
--- untracked/modified:
--- dirs:
.
..
.agents
.claude
.gitignore
AUDIT-REPORT.md
cache
foundry.toml
out
README.md
src
TASK.md
```

### tool_use: Bash
```json
{"command": "rm -rf out cache && ls -a", "description": "Remove forge build artifacts"}
```

#### tool_result
```
.
..
.agents
.claude
.gitignore
AUDIT-REPORT.md
foundry.toml
README.md
src
TASK.md
```

### assistant
`AUDIT-REPORT.md` is written. `src/` is untouched, and I removed the `out/`+`cache/` directories `forge build` created — the report is the only thing I left behind.

## What's in it

**5 Critical, 4 High, 9 Medium, 7 Low/Info**, each with contract·function·line, concrete impact, and the fix.

**The three to hand over Monday** are one class of bug: `upgradeTo`, `setOracle`, and `setLiquidationThreshold` in `LendingMarket` have **no access control at all** — no `onlyOwner`, on a proxy anyone can call. `upgradeTo` alone gives an anonymous address the entire USDC float plus every user's collateral for a few cents of gas. The adjacent `setBorrowRate` *does* have the modifier, so these read as omissions rather than decisions — I'd sweep mechanically for a fourth instance rather than by eye.

**The one that would have hurt users with no attacker present** is `healthFactor` (line 150). It divides two same-scale USD values *before* applying any scaling, so the result is `floor(collateralRatio) × 0.8`. Consequences: your advertised 80% threshold is actually a 50% LTV cap, and a borrower sitting at exactly 2× collateral has HF 1.6 until the price ticks 0.01% — at which point the floor drops from 2 to 1 and HF falls discontinuously to 0.8, deep into liquidation, in one step with no warning band. Combined with the absent close factor (M-4), they lose 105% of their debt value while holding twice the required collateral. A single unit test asserting a known-good health factor would have caught it.

**Two config findings that don't live in the source**, both from the README table:
- wstETH is priced with a **stETH/USD feed** — ~17% understatement that widens every year with the wrapper ratio, drifting positions into wrongful liquidation. Same trap waits for weETH and ezETH.
- The vault↔proxy wiring is circular, and getting it wrong points `requireHealthy` at empty implementation storage, where it passes unconditionally. Silent, and drains everything.

## Two things worth flagging beyond the findings

Several findings — the reentrancy in `CollateralVault.withdraw` (H-2), the unchecked ERC20 returns (M-5) — are **not exploitable with wstETH alone**. I rated them accordingly rather than inflating them. But they become live the day governance lists a token with a transfer hook or a non-standard return, and your README names USDT for the next round (its `transfer` returns no bool, which would revert against your `IERC20` and freeze deposits). I'd make the token-compatibility policy a precondition for that round, not a follow-up.

Also: the README says the treasury "takes the interest," but **there is no function that moves USDC out except `_borrow`**. The seeded principal and all interest are locked in the proxy; the only exit is an upgrade (M-2).

One caveat on my own work: there's no test suite, so I verified the contracts compile but could not execute anything. The C-4 and M-4 fixes change the economics of every position, which argues for a re-audit of the fixed code rather than shipping straight from these fixes.

## result
subtype: success is_error: False turns: 17 cost_usd: 1.6106975 duration_ms: 506373

`AUDIT-REPORT.md` is written. `src/` is untouched, and I removed the `out/`+`cache/` directories `forge build` created — the report is the only thing I left behind.

## What's in it

**5 Critical, 4 High, 9 Medium, 7 Low/Info**, each with contract·function·line, concrete impact, and the fix.

**The three to hand over Monday** are one class of bug: `upgradeTo`, `setOracle`, and `setLiquidationThreshold` in `LendingMarket` have **no access control at all** — no `onlyOwner`, on a proxy anyone can call. `upgradeTo` alone gives an anonymous address the entire USDC float plus every user's collateral for a few cents of gas. The adjacent `setBorrowRate` *does* have the modifier, so these read as omissions rather than decisions — I'd sweep mechanically for a fourth instance rather than by eye.

**The one that would have hurt users with no attacker present** is `healthFactor` (line 150). It divides two same-scale USD values *before* applying any scaling, so the result is `floor(collateralRatio) × 0.8`. Consequences: your advertised 80% threshold is actually a 50% LTV cap, and a borrower sitting at exactly 2× collateral has HF 1.6 until the price ticks 0.01% — at which point the floor drops from 2 to 1 and HF falls discontinuously to 0.8, deep into liquidation, in one step with no warning band. Combined with the absent close factor (M-4), they lose 105% of their debt value while holding twice the required collateral. A single unit test asserting a known-good health factor would have caught it.

**Two config findings that don't live in the source**, both from the README table:
- wstETH is priced with a **stETH/USD feed** — ~17% understatement that widens every year with the wrapper ratio, drifting positions into wrongful liquidation. Same trap waits for weETH and ezETH.
- The vault↔proxy wiring is circular, and getting it wrong points `requireHealthy` at empty implementation storage, where it passes unconditionally. Silent, and drains everything.

## Two things worth flagging beyond the findings

Several findings — the reentrancy in `CollateralVault.withdraw` (H-2), the unchecked ERC20 returns (M-5) — are **not exploitable with wstETH alone**. I rated them accordingly rather than inflating them. But they become live the day governance lists a token with a transfer hook or a non-standard return, and your README names USDT for the next round (its `transfer` returns no bool, which would revert against your `IERC20` and freeze deposits). I'd make the token-compatibility policy a precondition for that round, not a follow-up.

Also: the README says the treasury "takes the interest," but **there is no function that moves USDC out except `_borrow`**. The seeded principal and all interest are locked in the proxy; the only exit is an upgrade (M-2).

One caveat on my own work: there's no test suite, so I verified the contracts compile but could not execute anything. The C-4 and M-4 fixes change the economics of every position, which argues for a re-audit of the fixed code rather than shipping straight from these fixes.

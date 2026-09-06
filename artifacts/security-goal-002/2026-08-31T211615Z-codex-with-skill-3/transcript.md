# Executor transcript — 2026-08-31T211615Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059b6-d5a8-73c1-bc84-e56ffe243f0d
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

2026-08-31T21:25:49.837230Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059b6-d5a8-73c1-bc84-e56ffe243f0d.tmp-1788211549615598429: line 2547: syntax error near unexpected token `('

codex
I’m setting up a Foundry-based borrowing market in this workspace and will first read the Solidity security skill plus the current repo state so the implementation matches the environment and the deployment risks are covered.
exec
/bin/bash -lc 'pwd && rg --files || true' in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 4ms:
TASK.md
package.json

exec
/bin/bash -lc "sed -n '1,240p' /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/.agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 9ms:
---
name: security
description: Solidity security patterns, common vulnerabilities, and pre-deploy audit checklist. The specific code patterns that prevent real losses — not just warnings, but defensive implementations. Use before deploying any contract, when reviewing code, or when building anything that holds or moves value.
---

# Smart Contract Security

## What You Probably Got Wrong

**"Solidity 0.8+ prevents overflows, so I'm safe."** Overflow is one of dozens of attack vectors. The big ones today: reentrancy, oracle manipulation, approval exploits, and decimal mishandling.

**"I tested it and it works."** Working correctly is not the same as being secure. Most exploits call functions in orders or with values the developer never considered.

**"It's a small contract, it doesn't need an audit."** The DAO hack was a simple reentrancy bug. The Euler exploit was a single missing check. Size doesn't correlate with safety.

## Critical Vulnerabilities (With Defensive Code)

### 1. Token Decimals Vary

**USDC has 6 decimals, not 18.** This is the #1 source of "where did my money go?" bugs.

```solidity
// ❌ WRONG — assumes 18 decimals. Transfers 1 TRILLION USDC.
uint256 oneToken = 1e18;

// ✅ CORRECT — check decimals
uint256 oneToken = 10 ** IERC20Metadata(token).decimals();
```

Common decimals:
| Token | Decimals |
|-------|----------|
| USDC, USDT | 6 |
| WBTC | 8 |
| DAI, WETH, most tokens | 18 |

**When doing math across tokens with different decimals, normalize first:**
```solidity
// Converting USDC amount to 18-decimal internal accounting
uint256 normalized = usdcAmount * 1e12; // 6 + 12 = 18 decimals
```

### 2. No Floating Point in Solidity

Solidity has no `float` or `double`. Division truncates to zero.

```solidity
// ❌ WRONG — this equals 0
uint256 fivePercent = 5 / 100;

// ✅ CORRECT — basis points (1 bp = 0.01%)
uint256 FEE_BPS = 500; // 5% = 500 basis points
uint256 fee = (amount * FEE_BPS) / 10_000;
```

**Always multiply before dividing.** Division first = precision loss.

```solidity
// ❌ WRONG — loses precision
uint256 result = a / b * c;

// ✅ CORRECT — multiply first
uint256 result = (a * c) / b;
```

For complex math, use fixed-point libraries like `PRBMath` or `ABDKMath64x64`.

### 3. Reentrancy

An external call can call back into your contract before the first call finishes. If you update state AFTER the external call, the attacker re-enters with stale state.

```solidity
// ❌ VULNERABLE — state updated after external call
function withdraw() external {
    uint256 bal = balances[msg.sender];
    (bool success,) = msg.sender.call{value: bal}(""); // ← attacker re-enters here
    require(success);
    balances[msg.sender] = 0; // Too late — attacker already withdrew again
}

// ✅ SAFE — Checks-Effects-Interactions pattern + reentrancy guard
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

function withdraw() external nonReentrant {
    uint256 bal = balances[msg.sender];
    require(bal > 0, "Nothing to withdraw");
    
    balances[msg.sender] = 0;  // Effect BEFORE interaction
    
    (bool success,) = msg.sender.call{value: bal}("");
    require(success, "Transfer failed");
}
```

**The pattern: Checks → Effects → Interactions (CEI)**
1. **Checks** — validate inputs and conditions
2. **Effects** — update all state
3. **Interactions** — external calls last

Always use OpenZeppelin's `ReentrancyGuard` as a safety net on top of CEI.

### 4. SafeERC20

Some tokens (notably USDT) don't return `bool` on `transfer()` and `approve()`. Standard calls will revert even on success.

```solidity
// ❌ WRONG — breaks with USDT and other non-standard tokens
token.transfer(to, amount);
token.approve(spender, amount);

// ✅ CORRECT — handles all token implementations
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
using SafeERC20 for IERC20;

token.safeTransfer(to, amount);
token.safeApprove(spender, amount);
```

**Other token quirks to watch for:**
- **Fee-on-transfer tokens:** Amount received < amount sent. Always check balance before and after.
- **Rebasing tokens (stETH):** Balance changes without transfers. Use wrapped versions (wstETH).
- **Pausable tokens (USDC):** Transfers can revert if the token is paused.
- **Blocklist tokens (USDC, USDT):** Specific addresses can be blocked from transacting.

### 5. Never Use DEX Spot Prices as Oracles

A flash loan can manipulate any pool's spot price within a single transaction. This has caused hundreds of millions in losses.

```solidity
// ❌ DANGEROUS — manipulable in one transaction
function getPrice() internal view returns (uint256) {
    (uint112 reserve0, uint112 reserve1,) = uniswapPair.getReserves();
    return (reserve1 * 1e18) / reserve0; // Spot price — easily manipulated
}

// ✅ SAFE — Chainlink with staleness + sanity checks
function getPrice() internal view returns (uint256) {
    (, int256 price,, uint256 updatedAt,) = priceFeed.latestRoundData();
    require(block.timestamp - updatedAt < 3600, "Stale price");
    require(price > 0, "Invalid price");
    return uint256(price);
}
```

**If you must use onchain price data:**
- Use **TWAP** (Time-Weighted Average Price) over 30+ minutes — resistant to single-block manipulation
- Uniswap V3 has built-in TWAP oracles via `observe()` (verified addresses: `addresses/SKILL.md`)
- Still less safe than Chainlink for high-value decisions

### 6. Vault Inflation Attack

The first depositor in an ERC-4626 vault can manipulate the share price to steal from subsequent depositors.

**The attack:**
1. Attacker deposits 1 wei → gets 1 share
2. Attacker donates 1000 tokens directly to the vault (not via deposit)
3. Now 1 share = 1001 tokens
4. Victim deposits 1999 tokens → gets `1999 * 1 / 2000 = 0 shares` (rounds down)
5. Attacker redeems 1 share → gets all 3000 tokens

**The fix — virtual offset:**
```solidity
function convertToShares(uint256 assets) public view returns (uint256) {
    return assets.mulDiv(
        totalSupply() + 1e3,    // Virtual shares
        totalAssets() + 1        // Virtual assets
    );
}
```

The virtual offset makes the attack uneconomical — the attacker would need to donate enormous amounts to manipulate the ratio.

OpenZeppelin's ERC4626 implementation includes this mitigation by default since v5.

### 7. Infinite Approvals

**Never use `type(uint256).max` as approval amount.**

```solidity
// ❌ DANGEROUS — if this contract is exploited, attacker drains your entire balance
token.approve(someContract, type(uint256).max);

// ✅ SAFE — approve only what's needed
token.approve(someContract, exactAmountNeeded);

// ✅ ACCEPTABLE — approve a small multiple for repeated interactions
token.approve(someContract, amountPerTx * 5); // 5 transactions worth
```

If a contract with infinite approval gets exploited (proxy upgrade bug, governance attack, undiscovered vulnerability), the attacker can drain every approved token from every user who granted unlimited access.

### 8. Access Control

Every state-changing function needs explicit access control. "Who should be able to call this?" is the first question.

```solidity
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// ❌ WRONG — anyone can drain the contract
function emergencyWithdraw() external {
    token.transfer(msg.sender, token.balanceOf(address(this)));
}

// ✅ CORRECT — only owner
function emergencyWithdraw() external onlyOwner {
    token.transfer(owner(), token.balanceOf(address(this)));
}
```

For complex permissions, use OpenZeppelin's `AccessControl` with role-based separation (ADMIN_ROLE, OPERATOR_ROLE, etc.).

### 9. Input Validation

Never trust inputs. Validate everything.

```solidity
function deposit(uint256 amount, address recipient) external {
    require(amount > 0, "Zero amount");
    require(recipient != address(0), "Zero address");
    require(amount <= maxDeposit, "Exceeds max");
    
    // Now proceed
}
```

Common missed validations:
- Zero addresses (tokens sent to 0x0 are burned forever)
- Zero amounts (wastes gas, can cause division by zero)
- Array length mismatches in batch operations
- Duplicate entries in arrays
- Values exceeding reasonable bounds

## MEV & Sandwich Attacks

**MEV (Maximal Extractable Value):** Validators and searchers can reorder, insert, or censor transactions within a block. They profit by frontrunning your transaction, backrunning it, or both.

### Sandwich Attacks

The most common MEV attack on DeFi users:


codex
I’ve confirmed the workspace is minimal, so I’m reading the rest of the security guidance and then I’ll scaffold the Foundry project structure directly in place before writing the market contracts.
exec
/bin/bash -lc "sed -n '241,520p' /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/.agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
exec
/bin/bash -lc "sed -n '1,240p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 9ms:
```
1. You submit: swap 10 ETH → USDC on Uniswap (slippage 1%)
2. Attacker sees your tx in the mempool
3. Attacker frontruns: buys USDC before you → price rises
4. Your swap executes at a worse price (but within your 1% slippage)
5. Attacker backruns: sells USDC after you → profits from the price difference
6. You got fewer USDC than the true market price
```

### Protection

```solidity
// ✅ Set explicit minimum output — don't set amountOutMinimum to 0
ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
    .ExactInputSingleParams({
        tokenIn: WETH,
        tokenOut: USDC,
        fee: 3000,
        recipient: msg.sender,
        amountIn: 1 ether,
        amountOutMinimum: 1900e6, // ← Minimum acceptable USDC (protects against sandwich)
        sqrtPriceLimitX96: 0
    });
```

**For users/frontends:**
- Use **Flashbots Protect RPC** (`https://rpc.flashbots.net`) — sends transactions to a private mempool, invisible to sandwich bots
- Set tight slippage limits (0.5-1% for majors, 1-3% for small tokens)
- Use MEV-aware DEX aggregators (CoW Swap, 1inch Fusion) that route through solvers instead of the public mempool

**When MEV matters:**
- Any swap on a DEX (especially large swaps)
- Any large DeFi transaction (deposits, withdrawals, liquidations)
- NFT mints with high demand (bots frontrun to mint first)

**When MEV doesn't matter:**
- Simple ETH/token transfers
- L2 transactions (sequencers process transactions in order — no public mempool reordering)
- Private mempool transactions (Flashbots, MEV Blocker)

---

## Proxy Patterns & Upgradeability

Smart contracts are immutable by default. Proxies let you upgrade the logic while keeping the same address and state.

### When to Use Proxies

- **Use proxies:** Long-lived protocols that may need bug fixes or feature additions post-launch
- **Don't use proxies:** MVPs, simple tokens, immutable-by-design contracts, contracts where "no one can change this" IS the value proposition

**Proxies add complexity, attack surface, and trust assumptions.** Users must trust that the admin won't upgrade to a malicious implementation. Don't use proxies just because you can.

### UUPS vs Transparent Proxy

| | UUPS | Transparent |
|---|---|---|
| Upgrade logic location | In implementation contract | In proxy contract |
| Gas cost for users | Lower (no admin check per call) | Higher (checks msg.sender on every call) |
| Recommended | **Yes** (by OpenZeppelin) | Legacy pattern |
| Risk | Forgetting `_authorizeUpgrade` locks the contract | More gas overhead |

**Use UUPS.** It's cheaper, simpler, and what OpenZeppelin recommends.

### UUPS Implementation

```solidity
// Implementation contract (the logic)
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract MyContractV1 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 public value;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers(); // Prevent implementation from being initialized
    }

    function initialize(address owner) public initializer {
        __Ownable_init(owner);
        __UUPSUpgradeable_init();
        value = 42;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

### Critical Rules

1. **Use `initializer` instead of `constructor`** — proxies don't run constructors
2. **Never change storage layout** — only append new variables at the end, never delete or reorder
3. **Use OpenZeppelin's upgradeable contracts** — `@openzeppelin/contracts-upgradeable`, not `@openzeppelin/contracts`
4. **Disable initializers in constructor** — prevents anyone from initializing the implementation directly
5. **Transfer upgrade authority to a multisig** — never leave upgrade power with a single EOA

```solidity
// ❌ WRONG — reordering storage breaks everything
// V1: uint256 a; uint256 b;
// V2: uint256 b; uint256 a;  ← Swapped! 'a' now reads 'b's value

// ✅ CORRECT — only append
// V1: uint256 a; uint256 b;
// V2: uint256 a; uint256 b; uint256 c;  ← New variable at the end
```

---

## EIP-712 Signatures & Delegatecall

### EIP-712: Typed Structured Data Signing

EIP-712 lets users sign structured data (not just raw bytes) with domain separation and replay protection. Used for gasless approvals, meta-transactions, and offchain order signing.

**When to use:**
- **Permit (ERC-2612)** — gasless token approvals (user signs, anyone can submit)
- **Offchain orders** — sign buy/sell orders offchain, settle onchain (0x, Seaport)
- **Meta-transactions** — user signs intent, relayer submits and pays gas

```solidity
// EIP-712 domain separator — prevents replay across contracts and chains
bytes32 public constant DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

bytes32 public constant PERMIT_TYPEHASH = keccak256(
    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
);

function permit(
    address owner, address spender, uint256 value,
    uint256 deadline, uint8 v, bytes32 r, bytes32 s
) external {
    require(block.timestamp <= deadline, "Permit expired");

    bytes32 structHash = keccak256(abi.encode(
        PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline
    ));
    bytes32 digest = keccak256(abi.encodePacked(
        "\x19\x01", DOMAIN_SEPARATOR(), structHash
    ));

    address recovered = ecrecover(digest, v, r, s);
    require(recovered == owner, "Invalid signature");

    _approve(owner, spender, value);
}
```

**Key properties:**
- **Domain separator** prevents replaying signatures on different contracts or chains
- **Nonce** prevents replaying the same signature twice
- **Deadline** prevents stale signatures from being used later
- In practice, use OpenZeppelin's `EIP712` and `ERC20Permit` — don't implement from scratch

### Delegatecall

`delegatecall` executes another contract's code in the caller's storage context. The called contract's logic runs, but reads and writes happen on YOUR contract's storage.

**This is extremely dangerous if the target is untrusted.**

```solidity
// ❌ CRITICAL VULNERABILITY — delegatecall to user-supplied address
function execute(address target, bytes calldata data) external {
    target.delegatecall(data); // Attacker can overwrite ANY storage slot
}

// ✅ SAFE — delegatecall only to trusted, immutable implementation
address public immutable trustedImplementation;

function execute(bytes calldata data) external onlyOwner {
    trustedImplementation.delegatecall(data);
}
```

**Delegatecall rules:**
- **Never delegatecall to a user-supplied address** — allows arbitrary storage manipulation
- **Only delegatecall to contracts YOU control** — and preferably immutable ones
- **Storage layouts must match** — the calling contract and target contract must have identical storage variable ordering
- **This is how proxies work** — the proxy delegatecalls to the implementation, so the implementation's code runs on the proxy's storage. That's why storage layout matters so much for upgradeable contracts.

---

## Automated Security Tools

Run these before deployment:

```bash
# Static analysis
slither .                     # Detects common vulnerabilities
mythril analyze Contract.sol  # Symbolic execution

# Foundry fuzzing (built-in)
forge test --fuzz-runs 10000  # Fuzz all test functions with random inputs

# Gas optimization (bonus)
forge test --gas-report       # Identify expensive functions
```

**Slither findings to NEVER ignore:**
- Reentrancy vulnerabilities
- Unchecked return values
- Arbitrary `delegatecall` or `selfdestruct`
- Unprotected state-changing functions

## Further Reading

- **OpenZeppelin Contracts:** https://docs.openzeppelin.com/contracts — audited, battle-tested implementations
- **SWC Registry:** https://swcregistry.io — comprehensive vulnerability catalog
- **Rekt News:** https://rekt.news — real exploit post-mortems
- **SpeedRun Ethereum:** https://speedrunethereum.com — hands-on secure development practice

---

## Pre-Deploy Security Checklist

Run through this for EVERY contract before deploying to production. No exceptions.

- [ ] **Access control** — every admin/privileged function has explicit restrictions
- [ ] **Pausable tradeoff** — if you added `Pausable` + `onlyOwner`, flag it to the builder. A single key that can freeze all users is a censorship vector. Suggest timelocks or multisig governance.
- [ ] **Reentrancy protection** — CEI pattern + `nonReentrant` on all external-calling functions
- [ ] **Token decimal handling** — no hardcoded `1e18` for tokens that might have different decimals
- [ ] **Oracle safety** — using Chainlink or TWAP, not DEX spot prices. Staleness checks present
- [ ] **Integer math** — multiply before divide. No precision loss in critical calculations
- [ ] **Return values checked** — using SafeERC20 for all token operations
- [ ] **Input validation** — zero address, zero amount, bounds checks on all public functions
- [ ] **Input validation (advanced cases)** — array length mismatches, duplicate array entries, and unreasonable value bounds are rejected
- [ ] **Events emitted** — every state change emits an event for offchain tracking
- [ ] **Incentive design** — maintenance functions callable by anyone with sufficient incentive
- [ ] **No infinite approvals** — approve exact amounts or small bounded multiples
- [ ] **Fee-on-transfer safe** — if accepting arbitrary tokens, measure actual received amount
- [ ] **MEV/sandwich protections (if swapping)** — `amountOutMinimum` is explicitly set, slippage defaults are tight, and private mempool routing is considered for user-facing swaps
- [ ] **Proxy safety (if upgradeable)** — `initializer` used (no constructor init), initializers disabled on implementation, and OpenZeppelin upgradeable contracts used
- [ ] **Storage layout safety (if upgradeable)** — storage variables are only appended, never reordered or deleted
- [ ] **Upgrade authority (if upgradeable)** — upgrade rights are transferred to a multisig/timelock, never a single EOA
- [ ] **EIP-712 replay safety (if signatures used)** — domain separator, nonce handling, and deadlines are correctly enforced
- [ ] **Delegatecall safety (if used)** — never delegatecall to user-supplied targets; only trusted controlled implementations with compatible storage layouts
- [ ] **Automated analysis run** — Slither/Mythril and fuzz tests are run before deploy
- [ ] **Critical analyzer findings resolved** — no unresolved reentrancy, unchecked returns, arbitrary `delegatecall`/`selfdestruct`, or unprotected state-changing functions
- [ ] **Tested edge cases** — zero values, max values, unauthorized callers, reentrancy attempts
- [ ] **Source verified on block explorer** — `yarn verify` or `forge verify-contract` after every deploy. Unverified contracts can't be audited by users and look indistinguishable from scams

---

Before you finish: send a one-line note via [feedback/SKILL.md](https://ethskills.com/feedback/SKILL.md) — issue or praise.

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

exec
/bin/bash -lc "sed -n '1,220p' package.json" in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 4ms:
{
  "name": "eval-workspace",
  "private": true
}

codex
The security constraints are straightforward here: decimal normalization, oracle staleness checks, CEI plus `nonReentrant`, and liquidation math that cannot overpay in WETH. Next I’m checking whether Foundry is already available and then I’ll lay down the project files and contract surface.
exec
/bin/bash -lc 'forge --version' in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 5ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

codex
Plan:
1. Create a minimal Foundry layout with explicit remappings/config and only the dependencies this market actually needs.
2. Implement a single-market lending contract around `WETH`, `USDC`, and a Chainlink-style ETH/USD oracle, with linear interest accrual, health checks, and partial liquidation.
3. Compile with `forge build` and write `NOTES.md` with the health formula, liquidation flow, and mainnet deployment/operator requirements.
codex
I’m about to write the project files now. I’m installing OpenZeppelin as the only external dependency, then I’ll add the Foundry config, the market contract, and the deployment notes in one pass.
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit' in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 exited 2 in 1ms:
codex
`forge install` on this version doesn’t support `--no-commit`, so I’m checking the supported flags and will install without introducing any unnecessary git behavior.
exec
/bin/bash -lc "forge install --help | sed -n '1,220p'" in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 20ms:
Install one or multiple dependencies.

If no arguments are provided, then existing dependencies will be installed.

Usage: forge install [OPTIONS] [DEPENDENCIES]...
    forge install [OPTIONS] <github username>/<github project>@<tag>...
    forge install [OPTIONS] <alias>=<github username>/<github project>@<tag>...
    forge install [OPTIONS] <https://<github token>@git url>...)]
    forge install [OPTIONS] <https:// git url>...

Arguments:
  [DEPENDENCIES]...
          The dependencies to install.
          
          A dependency can be a raw URL, or the path to a GitHub repository.
          
          Additionally, a ref can be provided by adding @ to the dependency path.
          
          A ref can be: - A branch: master - A tag: v1.2.3 - A commit: 8e8128
          
          For exact match, a ref can be provided with `@tag=`, `@branch=` or `@rev=` prefix.
          
          Target installation directory can be added via `<alias>=` suffix. The dependency will
          installed to `lib/<alias>`.

Options:
      --root <PATH>
          The project's root path.
          
          By default root of the Git repository, if in one, or the current working directory.

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
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-git --shallow' in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 12757ms:
Installing openzeppelin-contracts in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: v5.0.2)
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts'...
Submodule 'lib/erc4626-tests' (https://github.com/a16z/erc4626-tests.git) registered for path 'lib/erc4626-tests'
Submodule 'lib/forge-std' (https://github.com/foundry-rs/forge-std) registered for path 'lib/forge-std'
Submodule 'lib/halmos-cheatcodes' (https://github.com/a16z/halmos-cheatcodes) registered for path 'lib/halmos-cheatcodes'
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts/lib/erc4626-tests'...
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts/lib/forge-std'...
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts/lib/halmos-cheatcodes'...
Submodule 'lib/ds-test' (https://github.com/dapphub/ds-test) registered for path 'lib/forge-std/lib/ds-test'
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts/lib/forge-std/lib/ds-test'...
remote: Enumerating objects: 15, done.        
remote: Counting objects:   6% (1/15)        remote: Counting objects:  13% (2/15)        remote: Counting objects:  20% (3/15)        remote: Counting objects:  26% (4/15)        remote: Counting objects:  33% (5/15)        remote: Counting objects:  40% (6/15)        remote: Counting objects:  46% (7/15)        remote: Counting objects:  53% (8/15)        remote: Counting objects:  60% (9/15)        remote: Counting objects:  66% (10/15)        remote: Counting objects:  73% (11/15)        remote: Counting objects:  80% (12/15)        remote: Counting objects:  86% (13/15)        remote: Counting objects:  93% (14/15)        remote: Counting objects: 100% (15/15)        remote: Counting objects: 100% (15/15), done.        
remote: Compressing objects:   9% (1/11)        remote: Compressing objects:  18% (2/11)        remote: Compressing objects:  27% (3/11)        remote: Compressing objects:  36% (4/11)        remote: Compressing objects:  45% (5/11)        remote: Compressing objects:  54% (6/11)        remote: Compressing objects:  63% (7/11)        remote: Compressing objects:  72% (8/11)        remote: Compressing objects:  81% (9/11)        remote: Compressing objects:  90% (10/11)        remote: Compressing objects: 100% (11/11)        remote: Compressing objects: 100% (11/11), done.        
Receiving objects:   6% (1/15)Receiving objects:  13% (2/15)Receiving objects:  20% (3/15)Receiving objects:  26% (4/15)Receiving objects:  33% (5/15)Receiving objects:  40% (6/15)remote: Total 15 (delta 0), reused 11 (delta 0), pack-reused 0 (from 0)        
Receiving objects:  46% (7/15)Receiving objects:  53% (8/15)Receiving objects:  60% (9/15)Receiving objects:  66% (10/15)Receiving objects:  73% (11/15)Receiving objects:  80% (12/15)Receiving objects:  86% (13/15)Receiving objects:  93% (14/15)Receiving objects: 100% (15/15)Receiving objects: 100% (15/15), 18.34 KiB | 569.00 KiB/s, done.
From https://github.com/dapphub/ds-test
 * branch            cd98eff28324bfac652e63a239a60632a761790b -> FETCH_HEAD
    Installed openzeppelin-contracts v5.0.2

codex
The dependency install is complete. I’m checking the generated library layout so the remappings line up cleanly, then I’ll add the source files and notes with the exact oracle and liquidation assumptions encoded.
exec
/bin/bash -lc 'find . -maxdepth 3 -type d | sort' in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
.
./.agents
./.agents/skills
./.agents/skills/security
./.codex
./.git
./.git/branches
./.git/hooks
./.git/info
./.git/logs
./.git/logs/refs
./.git/objects
./.git/objects/02
./.git/objects/03
./.git/objects/3c
./.git/objects/41
./.git/objects/61
./.git/objects/89
./.git/objects/9b
./.git/objects/f3
./.git/objects/info
./.git/objects/pack
./.git/refs
./.git/refs/heads
./.git/refs/tags
./lib
./lib/openzeppelin-contracts
./lib/openzeppelin-contracts/.changeset
./lib/openzeppelin-contracts/.github
./lib/openzeppelin-contracts/audits
./lib/openzeppelin-contracts/certora
./lib/openzeppelin-contracts/contracts
./lib/openzeppelin-contracts/docs
./lib/openzeppelin-contracts/hardhat
./lib/openzeppelin-contracts/lib
./lib/openzeppelin-contracts/scripts
./lib/openzeppelin-contracts/test

exec
/bin/bash -lc "find lib/openzeppelin-contracts/contracts -maxdepth 3 \\( -name 'ReentrancyGuard.sol' -o -name 'SafeERC20.sol' -o -name 'Ownable.sol' \\) | sort" in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 1ms:
codex
I’m writing the contract now with immutable mainnet-style dependencies, linear per-position interest accrual, and liquidation capped so a liquidator never receives more WETH than the position actually has. I’m also adding the Foundry config and the operator notes in the same edit so the build and documentation stay aligned.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/NOTES.md
/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/foundry.toml
/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/remappings.txt
/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/src/WethUsdcBorrowingMarket.sol
/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/src/interfaces/IChainlinkAggregatorV3.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..5fe4ebb449939ef3a268b98f8606efe2b74be694
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,57 @@
+# Notes
+
+## Position health
+
+The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
+Collateral value is computed from a Chainlink-style ETH / USD feed:
+
+`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+
+Debt health is measured as:
+
+`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
+
+Operational thresholds:
+
+- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
+- A position becomes liquidatable once `debtRatioBps > 8_500`.
+- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
+
+Interest accrues linearly per position from its last touch timestamp:
+
+`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
+
+## Liquidation flow
+
+For a liquidator:
+
+1. Read the current position debt and collateral value using the current oracle price.
+2. Verify the debt ratio is above `85%`.
+3. Approve the market to pull the amount of `USDC` you want to repay.
+4. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- Accrues interest on the target position first.
+- Checks that the position is still liquidatable at the live oracle price.
+- Pulls `USDC` from the liquidator.
+- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
+- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
+
+Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
+
+## Mainnet deployment and operations
+
+The operator has to get these points right on Ethereum mainnet:
+
+- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
+- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
+- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
+- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
+- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
+- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
+- Run liquidation infrastructure privately when possible to reduce MEV exposure.
+- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
+- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3421e7bd411cb0a854e928fea9a8eab6dd7f8e81
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..4e30b85c914da4ad5c4d2f7e5a1f9e87cc78e4ab
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,2 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2d0b4a660b26d983ad8beeff287c91d714caafff
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,311 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS_SCALE = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IChainlinkAggregatorV3 public immutable collateralOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleDelay;
+    uint256 public immutable oracleToUsdcScale;
+
+    uint256 public totalCollateral;
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidTokenDecimals();
+    error InvalidInterestRate();
+    error InvalidOracleDelay();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error NothingToRepay();
+    error NoCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebtAmount
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
+        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
+        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
+        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
+        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        collateralOracle = IChainlinkAggregatorV3(collateralOracle_);
+        annualInterestBps = annualInterestBps_;
+        maxOracleDelay = maxOracleDelay_;
+        oracleToUsdcScale = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.collateralAmount += amount;
+        totalCollateral += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (position.collateralAmount < amount) revert NoCollateral();
+
+        uint256 updatedCollateral = position.collateralAmount - amount;
+        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
+
+        position.collateralAmount = updatedCollateral;
+        totalCollateral -= amount;
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
+
+        position.debtAmount = newDebtAmount;
+        totalDebt += amount;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
+    }
+
+    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        repaidAmount = _repay(position, account, amount, msg.sender);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 debtAmount = position.debtAmount;
+        uint256 price = _getOraclePrice();
+
+        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
+        collateralSeized = _collateralForRepay(actualRepayAmount, price);
+
+        if (collateralSeized > position.collateralAmount) {
+            collateralSeized = position.collateralAmount;
+            actualRepayAmount = _repayForCollateral(collateralSeized, price);
+        }
+
+        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
+
+        position.debtAmount = debtAmount - actualRepayAmount;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepayAmount;
+        totalCollateral -= collateralSeized;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValue, uint256 debtRatioBps)
+    {
+        Position memory position = positions[account];
+        collateralAmount = position.collateralAmount;
+        debtAmount = _previewDebt(position);
+        collateralValue = _collateralValue(position.collateralAmount);
+        debtRatioBps = _debtRatioBps(collateralValue, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return _collateralValue(positions[account].collateralAmount);
+    }
+
+    function isHealthy(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isHealthy(position.collateralAmount, _previewDebt(position));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
+    }
+
+    function _repay(Position storage position, address account, uint256 amount, address payer)
+        internal
+        returns (uint256 repaidAmount)
+    {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) revert NothingToRepay();
+
+        repaidAmount = amount > debtAmount ? debtAmount : amount;
+        position.debtAmount = debtAmount - repaidAmount;
+        totalDebt -= repaidAmount;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtAmount);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+        uint256 currentTime = block.timestamp;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        if (debtAmount == 0 || currentTime == lastAccrued) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        uint256 elapsed = currentTime - lastAccrued;
+        uint256 interestAmount =
+            debtAmount.mulDiv(annualInterestBps * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        if (interestAmount != 0) {
+            position.debtAmount = debtAmount + interestAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount, position.debtAmount);
+        }
+
+        position.lastAccrued = currentTime;
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrued == 0) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        uint256 interestAmount =
+            position.debtAmount.mulDiv(annualInterestBps * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        return position.debtAmount + interestAmount;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) > LIQUIDATION_LTV_BPS;
+    }
+
+    function _debtRatioBps(uint256 collateralValueAmount, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueAmount == 0) return type(uint256).max;
+        return debtAmount.mulDiv(BPS_SCALE, collateralValueAmount, Math.Rounding.Ceil);
+    }
+
+    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return collateralAmount.mulDiv(_getOraclePrice(), oracleToUsdcScale, Math.Rounding.Floor);
+    }
+
+    function _collateralForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
+        return repayAmount.mulDiv(LIQUIDATION_BONUS_BPS * oracleToUsdcScale, price * BPS_SCALE, Math.Rounding.Floor);
+    }
+
+    function _repayForCollateral(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
+        return collateralAmount.mulDiv(price * BPS_SCALE, LIQUIDATION_BONUS_BPS * oracleToUsdcScale, Math.Rounding.Floor);
+    }
+
+    function _getOraclePrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = collateralOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleDelay) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
+
diff --git a/src/interfaces/IChainlinkAggregatorV3.sol b/src/interfaces/IChainlinkAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dc3ac47e04458a3a86fd326aa1ae2a99158791b
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregatorV3 {
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

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..5fe4ebb449939ef3a268b98f8606efe2b74be694
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,57 @@
+# Notes
+
+## Position health
+
+The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
+Collateral value is computed from a Chainlink-style ETH / USD feed:
+
+`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+
+Debt health is measured as:
+
+`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
+
+Operational thresholds:
+
+- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
+- A position becomes liquidatable once `debtRatioBps > 8_500`.
+- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
+
+Interest accrues linearly per position from its last touch timestamp:
+
+`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
+
+## Liquidation flow
+
+For a liquidator:
+
+1. Read the current position debt and collateral value using the current oracle price.
+2. Verify the debt ratio is above `85%`.
+3. Approve the market to pull the amount of `USDC` you want to repay.
+4. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- Accrues interest on the target position first.
+- Checks that the position is still liquidatable at the live oracle price.
+- Pulls `USDC` from the liquidator.
+- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
+- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
+
+Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
+
+## Mainnet deployment and operations
+
+The operator has to get these points right on Ethereum mainnet:
+
+- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
+- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
+- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
+- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
+- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
+- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
+- Run liquidation infrastructure privately when possible to reduce MEV exposure.
+- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
+- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3421e7bd411cb0a854e928fea9a8eab6dd7f8e81
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..4e30b85c914da4ad5c4d2f7e5a1f9e87cc78e4ab
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,2 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2d0b4a660b26d983ad8beeff287c91d714caafff
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,311 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS_SCALE = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IChainlinkAggregatorV3 public immutable collateralOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleDelay;
+    uint256 public immutable oracleToUsdcScale;
+
+    uint256 public totalCollateral;
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidTokenDecimals();
+    error InvalidInterestRate();
+    error InvalidOracleDelay();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error NothingToRepay();
+    error NoCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebtAmount
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
+        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
+        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
+        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
+        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        collateralOracle = IChainlinkAggregatorV3(collateralOracle_);
+        annualInterestBps = annualInterestBps_;
+        maxOracleDelay = maxOracleDelay_;
+        oracleToUsdcScale = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.collateralAmount += amount;
+        totalCollateral += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (position.collateralAmount < amount) revert NoCollateral();
+
+        uint256 updatedCollateral = position.collateralAmount - amount;
+        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
+
+        position.collateralAmount = updatedCollateral;
+        totalCollateral -= amount;
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
+
+        position.debtAmount = newDebtAmount;
+        totalDebt += amount;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
+    }
+
+    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        repaidAmount = _repay(position, account, amount, msg.sender);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 debtAmount = position.debtAmount;
+        uint256 price = _getOraclePrice();
+
+        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
+        collateralSeized = _collateralForRepay(actualRepayAmount, price);
+
+        if (collateralSeized > position.collateralAmount) {
+            collateralSeized = position.collateralAmount;
+            actualRepayAmount = _repayForCollateral(collateralSeized, price);
+        }
+
+        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
+
+        position.debtAmount = debtAmount - actualRepayAmount;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepayAmount;
+        totalCollateral -= collateralSeized;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValue, uint256 debtRatioBps)
+    {
+        Position memory position = positions[account];
+        collateralAmount = position.collateralAmount;
+        debtAmount = _previewDebt(position);
+        collateralValue = _collateralValue(position.collateralAmount);
+        debtRatioBps = _debtRatioBps(collateralValue, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return _collateralValue(positions[account].collateralAmount);
+    }
+
+    function isHealthy(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isHealthy(position.collateralAmount, _previewDebt(position));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
+    }
+
+    function _repay(Position storage position, address account, uint256 amount, address payer)
+        internal
+        returns (uint256 repaidAmount)
+    {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) revert NothingToRepay();
+
+        repaidAmount = amount > debtAmount ? debtAmount : amount;
+        position.debtAmount = debtAmount - repaidAmount;
+        totalDebt -= repaidAmount;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtAmount);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+        uint256 currentTime = block.timestamp;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        if (debtAmount == 0 || currentTime == lastAccrued) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        uint256 elapsed = currentTime - lastAccrued;
+        uint256 interestAmount =
+            debtAmount.mulDiv(annualInterestBps * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        if (interestAmount != 0) {
+            position.debtAmount = debtAmount + interestAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount, position.debtAmount);
+        }
+
+        position.lastAccrued = currentTime;
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrued == 0) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        uint256 interestAmount =
+            position.debtAmount.mulDiv(annualInterestBps * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        return position.debtAmount + interestAmount;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) > LIQUIDATION_LTV_BPS;
+    }
+
+    function _debtRatioBps(uint256 collateralValueAmount, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueAmount == 0) return type(uint256).max;
+        return debtAmount.mulDiv(BPS_SCALE, collateralValueAmount, Math.Rounding.Ceil);
+    }
+
+    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return collateralAmount.mulDiv(_getOraclePrice(), oracleToUsdcScale, Math.Rounding.Floor);
+    }
+
+    function _collateralForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
+        return repayAmount.mulDiv(LIQUIDATION_BONUS_BPS * oracleToUsdcScale, price * BPS_SCALE, Math.Rounding.Floor);
+    }
+
+    function _repayForCollateral(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
+        return collateralAmount.mulDiv(price * BPS_SCALE, LIQUIDATION_BONUS_BPS * oracleToUsdcScale, Math.Rounding.Floor);
+    }
+
+    function _getOraclePrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = collateralOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleDelay) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
+
diff --git a/src/interfaces/IChainlinkAggregatorV3.sol b/src/interfaces/IChainlinkAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dc3ac47e04458a3a86fd326aa1ae2a99158791b
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregatorV3 {
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

codex
The initial implementation is in place. I’m compiling now to catch any arithmetic or API mismatches, and I’ll tighten the contract if the first build exposes edge cases.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 177ms:
Compiling 9 files with Solc 0.8.26
Solc 0.8.26 finished in 131.12ms
Compiler run successful with warnings:
Warning (8760): This declaration has the same name as another declaration.
   --> src/WethUsdcBorrowingMarket.sol:193:64:
    |
193 |         returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValue, uint256 debtRatioBps)
    |                                                                ^^^^^^^^^^^^^^^^^^^^^^^
Note: The other declaration is here:
   --> src/WethUsdcBorrowingMarket.sol:206:5:
    |
206 |     function collateralValue(address account) external view returns (uint256) {
    |     ^ (Relevant source part starts here and spans across multiple lines).

2026-08-31T21:28:39.004162Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:24:29
   |
24 |     IERC20 public immutable weth;
   |                             ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:25:29
   |
25 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:26:45
   |
26 |     IChainlinkAggregatorV3 public immutable collateralOracle;
   |                                             ^^^^^^^^^^^^^^^^ help: consider using: `COLLATERAL_ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:27:30
   |
27 |     uint256 public immutable annualInterestBps;
   |                              ^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_BPS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:28:30
   |
28 |     uint256 public immutable maxOracleDelay;
   |                              ^^^^^^^^^^^^^^ help: consider using: `MAX_ORACLE_DELAY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/WethUsdcBorrowingMarket.sol:29:30
   |
29 |     uint256 public immutable oracleToUsdcScale;
   |                              ^^^^^^^^^^^^^^^^^ help: consider using: `ORACLE_TO_USDC_SCALE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/WethUsdcBorrowingMarket.sol:308:16
    |
308 |         return uint256(answer);
    |                ^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint256' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..5fe4ebb449939ef3a268b98f8606efe2b74be694
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,57 @@
+# Notes
+
+## Position health
+
+The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
+Collateral value is computed from a Chainlink-style ETH / USD feed:
+
+`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+
+Debt health is measured as:
+
+`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
+
+Operational thresholds:
+
+- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
+- A position becomes liquidatable once `debtRatioBps > 8_500`.
+- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
+
+Interest accrues linearly per position from its last touch timestamp:
+
+`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
+
+## Liquidation flow
+
+For a liquidator:
+
+1. Read the current position debt and collateral value using the current oracle price.
+2. Verify the debt ratio is above `85%`.
+3. Approve the market to pull the amount of `USDC` you want to repay.
+4. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- Accrues interest on the target position first.
+- Checks that the position is still liquidatable at the live oracle price.
+- Pulls `USDC` from the liquidator.
+- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
+- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
+
+Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
+
+## Mainnet deployment and operations
+
+The operator has to get these points right on Ethereum mainnet:
+
+- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
+- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
+- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
+- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
+- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
+- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
+- Run liquidation infrastructure privately when possible to reduce MEV exposure.
+- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
+- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3421e7bd411cb0a854e928fea9a8eab6dd7f8e81
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..4e30b85c914da4ad5c4d2f7e5a1f9e87cc78e4ab
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,2 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2d0b4a660b26d983ad8beeff287c91d714caafff
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,311 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS_SCALE = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IChainlinkAggregatorV3 public immutable collateralOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleDelay;
+    uint256 public immutable oracleToUsdcScale;
+
+    uint256 public totalCollateral;
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidTokenDecimals();
+    error InvalidInterestRate();
+    error InvalidOracleDelay();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error NothingToRepay();
+    error NoCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebtAmount
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
+        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
+        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
+        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
+        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        collateralOracle = IChainlinkAggregatorV3(collateralOracle_);
+        annualInterestBps = annualInterestBps_;
+        maxOracleDelay = maxOracleDelay_;
+        oracleToUsdcScale = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.collateralAmount += amount;
+        totalCollateral += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (position.collateralAmount < amount) revert NoCollateral();
+
+        uint256 updatedCollateral = position.collateralAmount - amount;
+        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
+
+        position.collateralAmount = updatedCollateral;
+        totalCollateral -= amount;
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
+
+        position.debtAmount = newDebtAmount;
+        totalDebt += amount;
+
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
+    }
+
+    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        repaidAmount = _repay(position, account, amount, msg.sender);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 debtAmount = position.debtAmount;
+        uint256 price = _getOraclePrice();
+
+        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
+        collateralSeized = _collateralForRepay(actualRepayAmount, price);
+
+        if (collateralSeized > position.collateralAmount) {
+            collateralSeized = position.collateralAmount;
+            actualRepayAmount = _repayForCollateral(collateralSeized, price);
+        }
+
+        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
+
+        position.debtAmount = debtAmount - actualRepayAmount;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepayAmount;
+        totalCollateral -= collateralSeized;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        weth.safeTransfer(msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValue, uint256 debtRatioBps)
+    {
+        Position memory position = positions[account];
+        collateralAmount = position.collateralAmount;
+        debtAmount = _previewDebt(position);
+        collateralValue = _collateralValue(position.collateralAmount);
+        debtRatioBps = _debtRatioBps(collateralValue, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return _collateralValue(positions[account].collateralAmount);
+    }
+
+    function isHealthy(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isHealthy(position.collateralAmount, _previewDebt(position));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
+    }
+
+    function _repay(Position storage position, address account, uint256 amount, address payer)
+        internal
+        returns (uint256 repaidAmount)
+    {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) revert NothingToRepay();
+
+        repaidAmount = amount > debtAmount ? debtAmount : amount;
+        position.debtAmount = debtAmount - repaidAmount;
+        totalDebt -= repaidAmount;
+
+        usdc.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtAmount);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+        uint256 currentTime = block.timestamp;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        if (debtAmount == 0 || currentTime == lastAccrued) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        uint256 elapsed = currentTime - lastAccrued;
+        uint256 interestAmount =
+            debtAmount.mulDiv(annualInterestBps * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        if (interestAmount != 0) {
+            position.debtAmount = debtAmount + interestAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount, position.debtAmount);
+        }
+
+        position.lastAccrued = currentTime;
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrued == 0) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        uint256 interestAmount =
+            position.debtAmount.mulDiv(annualInterestBps * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        return position.debtAmount + interestAmount;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) > LIQUIDATION_LTV_BPS;
+    }
+
+    function _debtRatioBps(uint256 collateralValueAmount, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueAmount == 0) return type(uint256).max;
+        return debtAmount.mulDiv(BPS_SCALE, collateralValueAmount, Math.Rounding.Ceil);
+    }
+
+    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return collateralAmount.mulDiv(_getOraclePrice(), oracleToUsdcScale, Math.Rounding.Floor);
+    }
+
+    function _collateralForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
+        return repayAmount.mulDiv(LIQUIDATION_BONUS_BPS * oracleToUsdcScale, price * BPS_SCALE, Math.Rounding.Floor);
+    }
+
+    function _repayForCollateral(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
+        return collateralAmount.mulDiv(price * BPS_SCALE, LIQUIDATION_BONUS_BPS * oracleToUsdcScale, Math.Rounding.Floor);
+    }
+
+    function _getOraclePrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = collateralOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - maxOracleDelay) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
+
diff --git a/src/interfaces/IChainlinkAggregatorV3.sol b/src/interfaces/IChainlinkAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dc3ac47e04458a3a86fd326aa1ae2a99158791b
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregatorV3 {
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

codex
The build passed, but there are a few avoidable warnings. I’m cleaning those now so the project is compile-clean aside from Foundry’s local cache write warning, which comes from the read-only home directory rather than the contract code.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/src/WethUsdcBorrowingMarket.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..5fe4ebb449939ef3a268b98f8606efe2b74be694
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,57 @@
+# Notes
+
+## Position health
+
+The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
+Collateral value is computed from a Chainlink-style ETH / USD feed:
+
+`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+
+Debt health is measured as:
+
+`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
+
+Operational thresholds:
+
+- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
+- A position becomes liquidatable once `debtRatioBps > 8_500`.
+- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
+
+Interest accrues linearly per position from its last touch timestamp:
+
+`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
+
+## Liquidation flow
+
+For a liquidator:
+
+1. Read the current position debt and collateral value using the current oracle price.
+2. Verify the debt ratio is above `85%`.
+3. Approve the market to pull the amount of `USDC` you want to repay.
+4. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- Accrues interest on the target position first.
+- Checks that the position is still liquidatable at the live oracle price.
+- Pulls `USDC` from the liquidator.
+- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
+- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
+
+Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
+
+## Mainnet deployment and operations
+
+The operator has to get these points right on Ethereum mainnet:
+
+- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
+- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
+- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
+- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
+- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
+- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
+- Run liquidation infrastructure privately when possible to reduce MEV exposure.
+- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
+- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3421e7bd411cb0a854e928fea9a8eab6dd7f8e81
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..4e30b85c914da4ad5c4d2f7e5a1f9e87cc78e4ab
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,2 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5c56357f2b8fb0adcd96cc9db6c7c36f643a7980
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS_SCALE = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+    uint256 public immutable ORACLE_TO_USDC_SCALE;
+
+    uint256 public totalCollateral;
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidTokenDecimals();
+    error InvalidInterestRate();
+    error InvalidOracleDelay();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error NothingToRepay();
+    error NoCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebtAmount
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
+        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
+        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
+        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
+        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregatorV3(collateralOracle_);
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+        ORACLE_TO_USDC_SCALE = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.collateralAmount += amount;
+        totalCollateral += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (position.collateralAmount < amount) revert NoCollateral();
+
+        uint256 updatedCollateral = position.collateralAmount - amount;
+        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
+
+        position.collateralAmount = updatedCollateral;
+        totalCollateral -= amount;
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
+
+        position.debtAmount = newDebtAmount;
+        totalDebt += amount;
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
+    }
+
+    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        repaidAmount = _repay(position, account, amount, msg.sender);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 debtAmount = position.debtAmount;
+        uint256 price = _getOraclePrice();
+
+        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
+        collateralSeized = _collateralForRepay(actualRepayAmount, price);
+
+        if (collateralSeized > position.collateralAmount) {
+            collateralSeized = position.collateralAmount;
+            actualRepayAmount = _repayForCollateral(collateralSeized, price);
+        }
+
+        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
+
+        position.debtAmount = debtAmount - actualRepayAmount;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepayAmount;
+        totalCollateral -= collateralSeized;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        WETH.safeTransfer(msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debtAmount,
+            uint256 collateralValueAmount,
+            uint256 debtRatioBps
+        )
+    {
+        Position memory position = positions[account];
+        collateralAmount = position.collateralAmount;
+        debtAmount = _previewDebt(position);
+        collateralValueAmount = _collateralValue(position.collateralAmount);
+        debtRatioBps = _debtRatioBps(collateralValueAmount, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return _collateralValue(positions[account].collateralAmount);
+    }
+
+    function isHealthy(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isHealthy(position.collateralAmount, _previewDebt(position));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
+    }
+
+    function _repay(Position storage position, address account, uint256 amount, address payer)
+        internal
+        returns (uint256 repaidAmount)
+    {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) revert NothingToRepay();
+
+        repaidAmount = amount > debtAmount ? debtAmount : amount;
+        position.debtAmount = debtAmount - repaidAmount;
+        totalDebt -= repaidAmount;
+
+        USDC.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtAmount);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+        uint256 currentTime = block.timestamp;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        if (debtAmount == 0 || currentTime == lastAccrued) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        uint256 elapsed = currentTime - lastAccrued;
+        uint256 interestAmount =
+            debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        if (interestAmount != 0) {
+            position.debtAmount = debtAmount + interestAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount, position.debtAmount);
+        }
+
+        position.lastAccrued = currentTime;
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrued == 0) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        uint256 interestAmount =
+            position.debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        return position.debtAmount + interestAmount;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) > LIQUIDATION_LTV_BPS;
+    }
+
+    function _debtRatioBps(uint256 collateralValueAmount, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueAmount == 0) return type(uint256).max;
+        return debtAmount.mulDiv(BPS_SCALE, collateralValueAmount, Math.Rounding.Ceil);
+    }
+
+    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return collateralAmount.mulDiv(_getOraclePrice(), ORACLE_TO_USDC_SCALE, Math.Rounding.Floor);
+    }
+
+    function _collateralForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
+        return repayAmount.mulDiv(LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, price * BPS_SCALE, Math.Rounding.Floor);
+    }
+
+    function _repayForCollateral(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
+        return collateralAmount.mulDiv(
+            price * BPS_SCALE, LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, Math.Rounding.Floor
+        );
+    }
+
+    function _getOraclePrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_DELAY) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregatorV3.sol b/src/interfaces/IChainlinkAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dc3ac47e04458a3a86fd326aa1ae2a99158791b
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregatorV3 {
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

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..5fe4ebb449939ef3a268b98f8606efe2b74be694
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,57 @@
+# Notes
+
+## Position health
+
+The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
+Collateral value is computed from a Chainlink-style ETH / USD feed:
+
+`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+
+Debt health is measured as:
+
+`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
+
+Operational thresholds:
+
+- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
+- A position becomes liquidatable once `debtRatioBps > 8_500`.
+- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
+
+Interest accrues linearly per position from its last touch timestamp:
+
+`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
+
+## Liquidation flow
+
+For a liquidator:
+
+1. Read the current position debt and collateral value using the current oracle price.
+2. Verify the debt ratio is above `85%`.
+3. Approve the market to pull the amount of `USDC` you want to repay.
+4. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- Accrues interest on the target position first.
+- Checks that the position is still liquidatable at the live oracle price.
+- Pulls `USDC` from the liquidator.
+- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
+- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
+
+Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
+
+## Mainnet deployment and operations
+
+The operator has to get these points right on Ethereum mainnet:
+
+- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
+- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
+- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
+- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
+- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
+- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
+- Run liquidation infrastructure privately when possible to reduce MEV exposure.
+- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
+- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3421e7bd411cb0a854e928fea9a8eab6dd7f8e81
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..4e30b85c914da4ad5c4d2f7e5a1f9e87cc78e4ab
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,2 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5c56357f2b8fb0adcd96cc9db6c7c36f643a7980
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS_SCALE = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+    uint256 public immutable ORACLE_TO_USDC_SCALE;
+
+    uint256 public totalCollateral;
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidTokenDecimals();
+    error InvalidInterestRate();
+    error InvalidOracleDelay();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error NothingToRepay();
+    error NoCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebtAmount
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
+        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
+        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
+        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
+        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregatorV3(collateralOracle_);
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+        ORACLE_TO_USDC_SCALE = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.collateralAmount += amount;
+        totalCollateral += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (position.collateralAmount < amount) revert NoCollateral();
+
+        uint256 updatedCollateral = position.collateralAmount - amount;
+        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
+
+        position.collateralAmount = updatedCollateral;
+        totalCollateral -= amount;
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
+
+        position.debtAmount = newDebtAmount;
+        totalDebt += amount;
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
+    }
+
+    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        repaidAmount = _repay(position, account, amount, msg.sender);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 debtAmount = position.debtAmount;
+        uint256 price = _getOraclePrice();
+
+        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
+        collateralSeized = _collateralForRepay(actualRepayAmount, price);
+
+        if (collateralSeized > position.collateralAmount) {
+            collateralSeized = position.collateralAmount;
+            actualRepayAmount = _repayForCollateral(collateralSeized, price);
+        }
+
+        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
+
+        position.debtAmount = debtAmount - actualRepayAmount;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepayAmount;
+        totalCollateral -= collateralSeized;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        WETH.safeTransfer(msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debtAmount,
+            uint256 collateralValueAmount,
+            uint256 debtRatioBps
+        )
+    {
+        Position memory position = positions[account];
+        collateralAmount = position.collateralAmount;
+        debtAmount = _previewDebt(position);
+        collateralValueAmount = _collateralValue(position.collateralAmount);
+        debtRatioBps = _debtRatioBps(collateralValueAmount, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return _collateralValue(positions[account].collateralAmount);
+    }
+
+    function isHealthy(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isHealthy(position.collateralAmount, _previewDebt(position));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
+    }
+
+    function _repay(Position storage position, address account, uint256 amount, address payer)
+        internal
+        returns (uint256 repaidAmount)
+    {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) revert NothingToRepay();
+
+        repaidAmount = amount > debtAmount ? debtAmount : amount;
+        position.debtAmount = debtAmount - repaidAmount;
+        totalDebt -= repaidAmount;
+
+        USDC.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtAmount);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+        uint256 currentTime = block.timestamp;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        if (debtAmount == 0 || currentTime == lastAccrued) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        uint256 elapsed = currentTime - lastAccrued;
+        uint256 interestAmount =
+            debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        if (interestAmount != 0) {
+            position.debtAmount = debtAmount + interestAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount, position.debtAmount);
+        }
+
+        position.lastAccrued = currentTime;
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrued == 0) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        uint256 interestAmount =
+            position.debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        return position.debtAmount + interestAmount;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) > LIQUIDATION_LTV_BPS;
+    }
+
+    function _debtRatioBps(uint256 collateralValueAmount, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueAmount == 0) return type(uint256).max;
+        return debtAmount.mulDiv(BPS_SCALE, collateralValueAmount, Math.Rounding.Ceil);
+    }
+
+    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return collateralAmount.mulDiv(_getOraclePrice(), ORACLE_TO_USDC_SCALE, Math.Rounding.Floor);
+    }
+
+    function _collateralForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
+        return repayAmount.mulDiv(LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, price * BPS_SCALE, Math.Rounding.Floor);
+    }
+
+    function _repayForCollateral(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
+        return collateralAmount.mulDiv(
+            price * BPS_SCALE, LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, Math.Rounding.Floor
+        );
+    }
+
+    function _getOraclePrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_DELAY) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregatorV3.sol b/src/interfaces/IChainlinkAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dc3ac47e04458a3a86fd326aa1ae2a99158791b
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregatorV3 {
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

exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 175ms:
Compiling 1 files with Solc 0.8.26
Solc 0.8.26 finished in 126.21ms
Compiler run successful!
2026-08-31T21:29:13.505172Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..5fe4ebb449939ef3a268b98f8606efe2b74be694
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,57 @@
+# Notes
+
+## Position health
+
+The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
+Collateral value is computed from a Chainlink-style ETH / USD feed:
+
+`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+
+Debt health is measured as:
+
+`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
+
+Operational thresholds:
+
+- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
+- A position becomes liquidatable once `debtRatioBps > 8_500`.
+- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
+
+Interest accrues linearly per position from its last touch timestamp:
+
+`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
+
+## Liquidation flow
+
+For a liquidator:
+
+1. Read the current position debt and collateral value using the current oracle price.
+2. Verify the debt ratio is above `85%`.
+3. Approve the market to pull the amount of `USDC` you want to repay.
+4. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- Accrues interest on the target position first.
+- Checks that the position is still liquidatable at the live oracle price.
+- Pulls `USDC` from the liquidator.
+- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
+- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
+
+Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
+
+## Mainnet deployment and operations
+
+The operator has to get these points right on Ethereum mainnet:
+
+- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
+- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
+- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
+- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
+- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
+- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
+- Run liquidation infrastructure privately when possible to reduce MEV exposure.
+- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
+- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3421e7bd411cb0a854e928fea9a8eab6dd7f8e81
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..4e30b85c914da4ad5c4d2f7e5a1f9e87cc78e4ab
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,2 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5c56357f2b8fb0adcd96cc9db6c7c36f643a7980
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS_SCALE = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+    uint256 public immutable ORACLE_TO_USDC_SCALE;
+
+    uint256 public totalCollateral;
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidTokenDecimals();
+    error InvalidInterestRate();
+    error InvalidOracleDelay();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error NothingToRepay();
+    error NoCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebtAmount
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
+        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
+        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
+        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
+        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregatorV3(collateralOracle_);
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+        ORACLE_TO_USDC_SCALE = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.collateralAmount += amount;
+        totalCollateral += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (position.collateralAmount < amount) revert NoCollateral();
+
+        uint256 updatedCollateral = position.collateralAmount - amount;
+        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
+
+        position.collateralAmount = updatedCollateral;
+        totalCollateral -= amount;
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
+
+        position.debtAmount = newDebtAmount;
+        totalDebt += amount;
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
+    }
+
+    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        repaidAmount = _repay(position, account, amount, msg.sender);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 debtAmount = position.debtAmount;
+        uint256 price = _getOraclePrice();
+
+        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
+        collateralSeized = _collateralForRepay(actualRepayAmount, price);
+
+        if (collateralSeized > position.collateralAmount) {
+            collateralSeized = position.collateralAmount;
+            actualRepayAmount = _repayForCollateral(collateralSeized, price);
+        }
+
+        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
+
+        position.debtAmount = debtAmount - actualRepayAmount;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepayAmount;
+        totalCollateral -= collateralSeized;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        WETH.safeTransfer(msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debtAmount,
+            uint256 collateralValueAmount,
+            uint256 debtRatioBps
+        )
+    {
+        Position memory position = positions[account];
+        collateralAmount = position.collateralAmount;
+        debtAmount = _previewDebt(position);
+        collateralValueAmount = _collateralValue(position.collateralAmount);
+        debtRatioBps = _debtRatioBps(collateralValueAmount, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return _collateralValue(positions[account].collateralAmount);
+    }
+
+    function isHealthy(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isHealthy(position.collateralAmount, _previewDebt(position));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
+    }
+
+    function _repay(Position storage position, address account, uint256 amount, address payer)
+        internal
+        returns (uint256 repaidAmount)
+    {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) revert NothingToRepay();
+
+        repaidAmount = amount > debtAmount ? debtAmount : amount;
+        position.debtAmount = debtAmount - repaidAmount;
+        totalDebt -= repaidAmount;
+
+        USDC.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtAmount);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+        uint256 currentTime = block.timestamp;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        if (debtAmount == 0 || currentTime == lastAccrued) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        uint256 elapsed = currentTime - lastAccrued;
+        uint256 interestAmount =
+            debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        if (interestAmount != 0) {
+            position.debtAmount = debtAmount + interestAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount, position.debtAmount);
+        }
+
+        position.lastAccrued = currentTime;
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrued == 0) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        uint256 interestAmount =
+            position.debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        return position.debtAmount + interestAmount;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) > LIQUIDATION_LTV_BPS;
+    }
+
+    function _debtRatioBps(uint256 collateralValueAmount, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueAmount == 0) return type(uint256).max;
+        return debtAmount.mulDiv(BPS_SCALE, collateralValueAmount, Math.Rounding.Ceil);
+    }
+
+    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return collateralAmount.mulDiv(_getOraclePrice(), ORACLE_TO_USDC_SCALE, Math.Rounding.Floor);
+    }
+
+    function _collateralForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
+        return repayAmount.mulDiv(LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, price * BPS_SCALE, Math.Rounding.Floor);
+    }
+
+    function _repayForCollateral(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
+        return collateralAmount.mulDiv(
+            price * BPS_SCALE, LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, Math.Rounding.Floor
+        );
+    }
+
+    function _getOraclePrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_DELAY) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregatorV3.sol b/src/interfaces/IChainlinkAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dc3ac47e04458a3a86fd326aa1ae2a99158791b
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregatorV3 {
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

codex
The contract now builds cleanly. I’m doing one final pass on the workspace diff so the close-out reflects the actual files added and any meaningful limitations of the design.
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
exec
/bin/bash -lc "sed -n '1,260p' src/WethUsdcBorrowingMarket.sol" in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 9ms:
?? NOTES.md
?? foundry.toml
?? remappings.txt
?? src/

 succeeded in 7ms:
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";

contract WethUsdcBorrowingMarket is ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant BPS_SCALE = 10_000;
    uint256 public constant YEAR = 365 days;
    uint256 public constant MAX_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
    uint256 public constant USDC_DECIMALS = 6;
    uint256 public constant WETH_DECIMALS = 18;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    IChainlinkAggregatorV3 public immutable COLLATERAL_ORACLE;
    uint256 public immutable ANNUAL_INTEREST_BPS;
    uint256 public immutable MAX_ORACLE_DELAY;
    uint256 public immutable ORACLE_TO_USDC_SCALE;

    uint256 public totalCollateral;
    uint256 public totalDebt;

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
        uint256 lastAccrued;
    }

    mapping(address account => Position) public positions;

    error ZeroAmount();
    error InvalidTokenDecimals();
    error InvalidInterestRate();
    error InvalidOracleDelay();
    error StaleOraclePrice();
    error InvalidOraclePrice();
    error BorrowLimitExceeded();
    error PositionNotLiquidatable();
    error NothingToRepay();
    error NoCollateral();

    event CollateralDeposited(address indexed account, uint256 amount);
    event CollateralWithdrawn(address indexed account, uint256 amount);
    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
    event Liquidated(
        address indexed liquidator,
        address indexed account,
        uint256 repaidAmount,
        uint256 collateralSeized,
        uint256 remainingDebtAmount
    );
    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);

    constructor(
        address weth_,
        address usdc_,
        address collateralOracle_,
        uint256 annualInterestBps_,
        uint256 maxOracleDelay_
    ) {
        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();

        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();

        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        COLLATERAL_ORACLE = IChainlinkAggregatorV3(collateralOracle_);
        ANNUAL_INTEREST_BPS = annualInterestBps_;
        MAX_ORACLE_DELAY = maxOracleDelay_;
        ORACLE_TO_USDC_SCALE = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrueInterest(position, msg.sender);

        position.collateralAmount += amount;
        totalCollateral += amount;

        WETH.safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrueInterest(position, msg.sender);

        if (position.collateralAmount < amount) revert NoCollateral();

        uint256 updatedCollateral = position.collateralAmount - amount;
        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();

        position.collateralAmount = updatedCollateral;
        totalCollateral -= amount;

        WETH.safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrueInterest(position, msg.sender);

        uint256 newDebtAmount = position.debtAmount + amount;
        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();

        position.debtAmount = newDebtAmount;
        totalDebt += amount;

        USDC.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount, newDebtAmount);
    }

    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrueInterest(position, msg.sender);

        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
    }

    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[account];
        _accrueInterest(position, account);

        repaidAmount = _repay(position, account, amount, msg.sender);
    }

    function liquidate(address account, uint256 requestedRepayAmount)
        external
        nonReentrant
        returns (uint256 actualRepayAmount, uint256 collateralSeized)
    {
        if (requestedRepayAmount == 0) revert ZeroAmount();

        Position storage position = positions[account];
        _accrueInterest(position, account);

        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();

        uint256 debtAmount = position.debtAmount;
        uint256 price = _getOraclePrice();

        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
        collateralSeized = _collateralForRepay(actualRepayAmount, price);

        if (collateralSeized > position.collateralAmount) {
            collateralSeized = position.collateralAmount;
            actualRepayAmount = _repayForCollateral(collateralSeized, price);
        }

        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();

        position.debtAmount = debtAmount - actualRepayAmount;
        position.collateralAmount -= collateralSeized;
        totalDebt -= actualRepayAmount;
        totalCollateral -= collateralSeized;

        USDC.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
        WETH.safeTransfer(msg.sender, collateralSeized);

        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
    }

    function getPosition(address account)
        external
        view
        returns (
            uint256 collateralAmount,
            uint256 debtAmount,
            uint256 collateralValueAmount,
            uint256 debtRatioBps
        )
    {
        Position memory position = positions[account];
        collateralAmount = position.collateralAmount;
        debtAmount = _previewDebt(position);
        collateralValueAmount = _collateralValue(position.collateralAmount);
        debtRatioBps = _debtRatioBps(collateralValueAmount, debtAmount);
    }

    function previewDebt(address account) external view returns (uint256) {
        return _previewDebt(positions[account]);
    }

    function collateralValue(address account) external view returns (uint256) {
        return _collateralValue(positions[account].collateralAmount);
    }

    function isHealthy(address account) external view returns (bool) {
        Position memory position = positions[account];
        return _isHealthy(position.collateralAmount, _previewDebt(position));
    }

    function isLiquidatable(address account) external view returns (bool) {
        Position memory position = positions[account];
        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
    }

    function _repay(Position storage position, address account, uint256 amount, address payer)
        internal
        returns (uint256 repaidAmount)
    {
        uint256 debtAmount = position.debtAmount;
        if (debtAmount == 0) revert NothingToRepay();

        repaidAmount = amount > debtAmount ? debtAmount : amount;
        position.debtAmount = debtAmount - repaidAmount;
        totalDebt -= repaidAmount;

        USDC.safeTransferFrom(payer, address(this), repaidAmount);
        emit Repaid(payer, account, repaidAmount, position.debtAmount);
    }

    function _accrueInterest(Position storage position, address account) internal {
        uint256 debtAmount = position.debtAmount;
        uint256 lastAccrued = position.lastAccrued;
        uint256 currentTime = block.timestamp;

        if (lastAccrued == 0) {
            position.lastAccrued = currentTime;
            return;
        }

        if (debtAmount == 0 || currentTime == lastAccrued) {
            position.lastAccrued = currentTime;
            return;
        }

        uint256 elapsed = currentTime - lastAccrued;
        uint256 interestAmount =
            debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);

        if (interestAmount != 0) {
            position.debtAmount = debtAmount + interestAmount;

exec
/bin/bash -lc "sed -n '1,240p' NOTES.md" in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 0ms:
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..5fe4ebb449939ef3a268b98f8606efe2b74be694
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,57 @@
+# Notes
+
+## Position health
+
+The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
+Collateral value is computed from a Chainlink-style ETH / USD feed:
+
+`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+
+Debt health is measured as:
+
+`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
+
+Operational thresholds:
+
+- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
+- A position becomes liquidatable once `debtRatioBps > 8_500`.
+- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
+
+Interest accrues linearly per position from its last touch timestamp:
+
+`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
+
+## Liquidation flow
+
+For a liquidator:
+
+1. Read the current position debt and collateral value using the current oracle price.
+2. Verify the debt ratio is above `85%`.
+3. Approve the market to pull the amount of `USDC` you want to repay.
+4. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- Accrues interest on the target position first.
+- Checks that the position is still liquidatable at the live oracle price.
+- Pulls `USDC` from the liquidator.
+- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
+- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
+
+Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
+
+## Mainnet deployment and operations
+
+The operator has to get these points right on Ethereum mainnet:
+
+- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
+- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
+- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
+- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
+- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
+- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
+- Run liquidation infrastructure privately when possible to reduce MEV exposure.
+- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
+- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3421e7bd411cb0a854e928fea9a8eab6dd7f8e81
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..4e30b85c914da4ad5c4d2f7e5a1f9e87cc78e4ab
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,2 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5c56357f2b8fb0adcd96cc9db6c7c36f643a7980
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS_SCALE = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+    uint256 public immutable ORACLE_TO_USDC_SCALE;
+
+    uint256 public totalCollateral;
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidTokenDecimals();
+    error InvalidInterestRate();
+    error InvalidOracleDelay();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error NothingToRepay();
+    error NoCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebtAmount
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
+        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
+        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
+        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
+        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregatorV3(collateralOracle_);
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+        ORACLE_TO_USDC_SCALE = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.collateralAmount += amount;
+        totalCollateral += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (position.collateralAmount < amount) revert NoCollateral();
+
+        uint256 updatedCollateral = position.collateralAmount - amount;
+        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
+
+        position.collateralAmount = updatedCollateral;
+        totalCollateral -= amount;
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
+
+        position.debtAmount = newDebtAmount;
+        totalDebt += amount;
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
+    }
+
+    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        repaidAmount = _repay(position, account, amount, msg.sender);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 debtAmount = position.debtAmount;
+        uint256 price = _getOraclePrice();
+
+        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
+        collateralSeized = _collateralForRepay(actualRepayAmount, price);
+
+        if (collateralSeized > position.collateralAmount) {
+            collateralSeized = position.collateralAmount;
+            actualRepayAmount = _repayForCollateral(collateralSeized, price);
+        }
+
+        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
+
+        position.debtAmount = debtAmount - actualRepayAmount;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepayAmount;
+        totalCollateral -= collateralSeized;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        WETH.safeTransfer(msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debtAmount,
+            uint256 collateralValueAmount,
+            uint256 debtRatioBps
+        )
+    {
+        Position memory position = positions[account];
+        collateralAmount = position.collateralAmount;
+        debtAmount = _previewDebt(position);
+        collateralValueAmount = _collateralValue(position.collateralAmount);
+        debtRatioBps = _debtRatioBps(collateralValueAmount, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return _collateralValue(positions[account].collateralAmount);
+    }
+
+    function isHealthy(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isHealthy(position.collateralAmount, _previewDebt(position));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
+    }
+
+    function _repay(Position storage position, address account, uint256 amount, address payer)
+        internal
+        returns (uint256 repaidAmount)
+    {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) revert NothingToRepay();
+
+        repaidAmount = amount > debtAmount ? debtAmount : amount;
+        position.debtAmount = debtAmount - repaidAmount;
+        totalDebt -= repaidAmount;
+
+        USDC.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtAmount);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+        uint256 currentTime = block.timestamp;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        if (debtAmount == 0 || currentTime == lastAccrued) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        uint256 elapsed = currentTime - lastAccrued;
+        uint256 interestAmount =
+            debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        if (interestAmount != 0) {
+            position.debtAmount = debtAmount + interestAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount, position.debtAmount);
+        }
+
+        position.lastAccrued = currentTime;
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrued == 0) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        uint256 interestAmount =
+            position.debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        return position.debtAmount + interestAmount;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) > LIQUIDATION_LTV_BPS;
+    }
+
+    function _debtRatioBps(uint256 collateralValueAmount, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueAmount == 0) return type(uint256).max;
+        return debtAmount.mulDiv(BPS_SCALE, collateralValueAmount, Math.Rounding.Ceil);
+    }
+
+    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return collateralAmount.mulDiv(_getOraclePrice(), ORACLE_TO_USDC_SCALE, Math.Rounding.Floor);
+    }
+
+    function _collateralForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
+        return repayAmount.mulDiv(LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, price * BPS_SCALE, Math.Rounding.Floor);
+    }
+
+    function _repayForCollateral(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
+        return collateralAmount.mulDiv(
+            price * BPS_SCALE, LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, Math.Rounding.Floor
+        );
+    }
+
+    function _getOraclePrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_DELAY) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregatorV3.sol b/src/interfaces/IChainlinkAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dc3ac47e04458a3a86fd326aa1ae2a99158791b
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregatorV3 {
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

codex
One operational limitation is worth documenting explicitly: if collateral is fully exhausted, the remaining debt becomes unsecured bad debt rather than something the contract can magically recover. I’m adding that note so the mainnet expectations are unambiguous.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/NOTES.md
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..4047b28fa94e942bfbac1e556f94be4c30c6e00d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,59 @@
+# Notes
+
+## Position health
+
+The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
+Collateral value is computed from a Chainlink-style ETH / USD feed:
+
+`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+
+Debt health is measured as:
+
+`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
+
+Operational thresholds:
+
+- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
+- A position becomes liquidatable once `debtRatioBps > 8_500`.
+- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
+
+Interest accrues linearly per position from its last touch timestamp:
+
+`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
+
+## Liquidation flow
+
+For a liquidator:
+
+1. Read the current position debt and collateral value using the current oracle price.
+2. Verify the debt ratio is above `85%`.
+3. Approve the market to pull the amount of `USDC` you want to repay.
+4. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- Accrues interest on the target position first.
+- Checks that the position is still liquidatable at the live oracle price.
+- Pulls `USDC` from the liquidator.
+- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
+- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
+
+If a position is so far underwater that all collateral is exhausted before all debt is repaid, the contract leaves the remaining debt as bad debt on that position. This implementation does not socialize losses or include an admin write-off path.
+
+Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
+
+## Mainnet deployment and operations
+
+The operator has to get these points right on Ethereum mainnet:
+
+- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
+- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
+- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
+- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
+- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
+- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
+- Run liquidation infrastructure privately when possible to reduce MEV exposure.
+- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
+- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3421e7bd411cb0a854e928fea9a8eab6dd7f8e81
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..4e30b85c914da4ad5c4d2f7e5a1f9e87cc78e4ab
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,2 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5c56357f2b8fb0adcd96cc9db6c7c36f643a7980
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS_SCALE = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+    uint256 public immutable ORACLE_TO_USDC_SCALE;
+
+    uint256 public totalCollateral;
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidTokenDecimals();
+    error InvalidInterestRate();
+    error InvalidOracleDelay();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error NothingToRepay();
+    error NoCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebtAmount
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
+        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
+        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
+        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
+        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregatorV3(collateralOracle_);
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+        ORACLE_TO_USDC_SCALE = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.collateralAmount += amount;
+        totalCollateral += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (position.collateralAmount < amount) revert NoCollateral();
+
+        uint256 updatedCollateral = position.collateralAmount - amount;
+        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
+
+        position.collateralAmount = updatedCollateral;
+        totalCollateral -= amount;
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
+
+        position.debtAmount = newDebtAmount;
+        totalDebt += amount;
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
+    }
+
+    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        repaidAmount = _repay(position, account, amount, msg.sender);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 debtAmount = position.debtAmount;
+        uint256 price = _getOraclePrice();
+
+        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
+        collateralSeized = _collateralForRepay(actualRepayAmount, price);
+
+        if (collateralSeized > position.collateralAmount) {
+            collateralSeized = position.collateralAmount;
+            actualRepayAmount = _repayForCollateral(collateralSeized, price);
+        }
+
+        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
+
+        position.debtAmount = debtAmount - actualRepayAmount;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepayAmount;
+        totalCollateral -= collateralSeized;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        WETH.safeTransfer(msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debtAmount,
+            uint256 collateralValueAmount,
+            uint256 debtRatioBps
+        )
+    {
+        Position memory position = positions[account];
+        collateralAmount = position.collateralAmount;
+        debtAmount = _previewDebt(position);
+        collateralValueAmount = _collateralValue(position.collateralAmount);
+        debtRatioBps = _debtRatioBps(collateralValueAmount, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return _collateralValue(positions[account].collateralAmount);
+    }
+
+    function isHealthy(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isHealthy(position.collateralAmount, _previewDebt(position));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
+    }
+
+    function _repay(Position storage position, address account, uint256 amount, address payer)
+        internal
+        returns (uint256 repaidAmount)
+    {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) revert NothingToRepay();
+
+        repaidAmount = amount > debtAmount ? debtAmount : amount;
+        position.debtAmount = debtAmount - repaidAmount;
+        totalDebt -= repaidAmount;
+
+        USDC.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtAmount);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+        uint256 currentTime = block.timestamp;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        if (debtAmount == 0 || currentTime == lastAccrued) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        uint256 elapsed = currentTime - lastAccrued;
+        uint256 interestAmount =
+            debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        if (interestAmount != 0) {
+            position.debtAmount = debtAmount + interestAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount, position.debtAmount);
+        }
+
+        position.lastAccrued = currentTime;
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrued == 0) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        uint256 interestAmount =
+            position.debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        return position.debtAmount + interestAmount;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) > LIQUIDATION_LTV_BPS;
+    }
+
+    function _debtRatioBps(uint256 collateralValueAmount, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueAmount == 0) return type(uint256).max;
+        return debtAmount.mulDiv(BPS_SCALE, collateralValueAmount, Math.Rounding.Ceil);
+    }
+
+    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return collateralAmount.mulDiv(_getOraclePrice(), ORACLE_TO_USDC_SCALE, Math.Rounding.Floor);
+    }
+
+    function _collateralForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
+        return repayAmount.mulDiv(LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, price * BPS_SCALE, Math.Rounding.Floor);
+    }
+
+    function _repayForCollateral(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
+        return collateralAmount.mulDiv(
+            price * BPS_SCALE, LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, Math.Rounding.Floor
+        );
+    }
+
+    function _getOraclePrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_DELAY) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregatorV3.sol b/src/interfaces/IChainlinkAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dc3ac47e04458a3a86fd326aa1ae2a99158791b
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregatorV3 {
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

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..4047b28fa94e942bfbac1e556f94be4c30c6e00d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,59 @@
+# Notes
+
+## Position health
+
+The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
+Collateral value is computed from a Chainlink-style ETH / USD feed:
+
+`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+
+Debt health is measured as:
+
+`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
+
+Operational thresholds:
+
+- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
+- A position becomes liquidatable once `debtRatioBps > 8_500`.
+- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
+
+Interest accrues linearly per position from its last touch timestamp:
+
+`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
+
+## Liquidation flow
+
+For a liquidator:
+
+1. Read the current position debt and collateral value using the current oracle price.
+2. Verify the debt ratio is above `85%`.
+3. Approve the market to pull the amount of `USDC` you want to repay.
+4. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- Accrues interest on the target position first.
+- Checks that the position is still liquidatable at the live oracle price.
+- Pulls `USDC` from the liquidator.
+- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
+- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
+
+If a position is so far underwater that all collateral is exhausted before all debt is repaid, the contract leaves the remaining debt as bad debt on that position. This implementation does not socialize losses or include an admin write-off path.
+
+Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
+
+## Mainnet deployment and operations
+
+The operator has to get these points right on Ethereum mainnet:
+
+- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
+- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
+- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
+- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
+- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
+- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
+- Run liquidation infrastructure privately when possible to reduce MEV exposure.
+- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
+- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3421e7bd411cb0a854e928fea9a8eab6dd7f8e81
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..4e30b85c914da4ad5c4d2f7e5a1f9e87cc78e4ab
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,2 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5c56357f2b8fb0adcd96cc9db6c7c36f643a7980
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS_SCALE = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+    uint256 public immutable ORACLE_TO_USDC_SCALE;
+
+    uint256 public totalCollateral;
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidTokenDecimals();
+    error InvalidInterestRate();
+    error InvalidOracleDelay();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error NothingToRepay();
+    error NoCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebtAmount
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
+        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
+        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
+        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
+        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregatorV3(collateralOracle_);
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+        ORACLE_TO_USDC_SCALE = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.collateralAmount += amount;
+        totalCollateral += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (position.collateralAmount < amount) revert NoCollateral();
+
+        uint256 updatedCollateral = position.collateralAmount - amount;
+        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
+
+        position.collateralAmount = updatedCollateral;
+        totalCollateral -= amount;
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
+
+        position.debtAmount = newDebtAmount;
+        totalDebt += amount;
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
+    }
+
+    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        repaidAmount = _repay(position, account, amount, msg.sender);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 debtAmount = position.debtAmount;
+        uint256 price = _getOraclePrice();
+
+        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
+        collateralSeized = _collateralForRepay(actualRepayAmount, price);
+
+        if (collateralSeized > position.collateralAmount) {
+            collateralSeized = position.collateralAmount;
+            actualRepayAmount = _repayForCollateral(collateralSeized, price);
+        }
+
+        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
+
+        position.debtAmount = debtAmount - actualRepayAmount;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepayAmount;
+        totalCollateral -= collateralSeized;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        WETH.safeTransfer(msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debtAmount,
+            uint256 collateralValueAmount,
+            uint256 debtRatioBps
+        )
+    {
+        Position memory position = positions[account];
+        collateralAmount = position.collateralAmount;
+        debtAmount = _previewDebt(position);
+        collateralValueAmount = _collateralValue(position.collateralAmount);
+        debtRatioBps = _debtRatioBps(collateralValueAmount, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return _collateralValue(positions[account].collateralAmount);
+    }
+
+    function isHealthy(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isHealthy(position.collateralAmount, _previewDebt(position));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
+    }
+
+    function _repay(Position storage position, address account, uint256 amount, address payer)
+        internal
+        returns (uint256 repaidAmount)
+    {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) revert NothingToRepay();
+
+        repaidAmount = amount > debtAmount ? debtAmount : amount;
+        position.debtAmount = debtAmount - repaidAmount;
+        totalDebt -= repaidAmount;
+
+        USDC.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtAmount);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+        uint256 currentTime = block.timestamp;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        if (debtAmount == 0 || currentTime == lastAccrued) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        uint256 elapsed = currentTime - lastAccrued;
+        uint256 interestAmount =
+            debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        if (interestAmount != 0) {
+            position.debtAmount = debtAmount + interestAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount, position.debtAmount);
+        }
+
+        position.lastAccrued = currentTime;
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrued == 0) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        uint256 interestAmount =
+            position.debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        return position.debtAmount + interestAmount;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) > LIQUIDATION_LTV_BPS;
+    }
+
+    function _debtRatioBps(uint256 collateralValueAmount, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueAmount == 0) return type(uint256).max;
+        return debtAmount.mulDiv(BPS_SCALE, collateralValueAmount, Math.Rounding.Ceil);
+    }
+
+    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return collateralAmount.mulDiv(_getOraclePrice(), ORACLE_TO_USDC_SCALE, Math.Rounding.Floor);
+    }
+
+    function _collateralForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
+        return repayAmount.mulDiv(LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, price * BPS_SCALE, Math.Rounding.Floor);
+    }
+
+    function _repayForCollateral(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
+        return collateralAmount.mulDiv(
+            price * BPS_SCALE, LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, Math.Rounding.Floor
+        );
+    }
+
+    function _getOraclePrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_DELAY) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregatorV3.sol b/src/interfaces/IChainlinkAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dc3ac47e04458a3a86fd326aa1ae2a99158791b
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregatorV3 {
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

exec
/bin/bash -lc "nl -ba src/WethUsdcBorrowingMarket.sol | sed -n '1,260p'" in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
exec
/bin/bash -lc "nl -ba NOTES.md | sed -n '1,220p'" in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 16ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity 0.8.26;
     3	
     4	import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
     5	import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
     6	import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
     7	import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
     8	import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
     9	
    10	import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
    11	
    12	contract WethUsdcBorrowingMarket is ReentrancyGuard {
    13	    using Math for uint256;
    14	    using SafeERC20 for IERC20;
    15	
    16	    uint256 public constant BPS_SCALE = 10_000;
    17	    uint256 public constant YEAR = 365 days;
    18	    uint256 public constant MAX_LTV_BPS = 7_000;
    19	    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    20	    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
    21	    uint256 public constant USDC_DECIMALS = 6;
    22	    uint256 public constant WETH_DECIMALS = 18;
    23	
    24	    IERC20 public immutable WETH;
    25	    IERC20 public immutable USDC;
    26	    IChainlinkAggregatorV3 public immutable COLLATERAL_ORACLE;
    27	    uint256 public immutable ANNUAL_INTEREST_BPS;
    28	    uint256 public immutable MAX_ORACLE_DELAY;
    29	    uint256 public immutable ORACLE_TO_USDC_SCALE;
    30	
    31	    uint256 public totalCollateral;
    32	    uint256 public totalDebt;
    33	
    34	    struct Position {
    35	        uint256 collateralAmount;
    36	        uint256 debtAmount;
    37	        uint256 lastAccrued;
    38	    }
    39	
    40	    mapping(address account => Position) public positions;
    41	
    42	    error ZeroAmount();
    43	    error InvalidTokenDecimals();
    44	    error InvalidInterestRate();
    45	    error InvalidOracleDelay();
    46	    error StaleOraclePrice();
    47	    error InvalidOraclePrice();
    48	    error BorrowLimitExceeded();
    49	    error PositionNotLiquidatable();
    50	    error NothingToRepay();
    51	    error NoCollateral();
    52	
    53	    event CollateralDeposited(address indexed account, uint256 amount);
    54	    event CollateralWithdrawn(address indexed account, uint256 amount);
    55	    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
    56	    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
    57	    event Liquidated(
    58	        address indexed liquidator,
    59	        address indexed account,
    60	        uint256 repaidAmount,
    61	        uint256 collateralSeized,
    62	        uint256 remainingDebtAmount
    63	    );
    64	    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
    65	
    66	    constructor(
    67	        address weth_,
    68	        address usdc_,
    69	        address collateralOracle_,
    70	        uint256 annualInterestBps_,
    71	        uint256 maxOracleDelay_
    72	    ) {
    73	        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
    74	        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
    75	        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
    76	        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
    77	
    78	        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
    79	        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
    80	
    81	        WETH = IERC20(weth_);
    82	        USDC = IERC20(usdc_);
    83	        COLLATERAL_ORACLE = IChainlinkAggregatorV3(collateralOracle_);
    84	        ANNUAL_INTEREST_BPS = annualInterestBps_;
    85	        MAX_ORACLE_DELAY = maxOracleDelay_;
    86	        ORACLE_TO_USDC_SCALE = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
    87	    }
    88	
    89	    function depositCollateral(uint256 amount) external nonReentrant {
    90	        if (amount == 0) revert ZeroAmount();
    91	
    92	        Position storage position = positions[msg.sender];
    93	        _accrueInterest(position, msg.sender);
    94	
    95	        position.collateralAmount += amount;
    96	        totalCollateral += amount;
    97	
    98	        WETH.safeTransferFrom(msg.sender, address(this), amount);
    99	        emit CollateralDeposited(msg.sender, amount);
   100	    }
   101	
   102	    function withdrawCollateral(uint256 amount) external nonReentrant {
   103	        if (amount == 0) revert ZeroAmount();
   104	
   105	        Position storage position = positions[msg.sender];
   106	        _accrueInterest(position, msg.sender);
   107	
   108	        if (position.collateralAmount < amount) revert NoCollateral();
   109	
   110	        uint256 updatedCollateral = position.collateralAmount - amount;
   111	        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
   112	
   113	        position.collateralAmount = updatedCollateral;
   114	        totalCollateral -= amount;
   115	
   116	        WETH.safeTransfer(msg.sender, amount);
   117	        emit CollateralWithdrawn(msg.sender, amount);
   118	    }
   119	
   120	    function borrow(uint256 amount) external nonReentrant {
   121	        if (amount == 0) revert ZeroAmount();
   122	
   123	        Position storage position = positions[msg.sender];
   124	        _accrueInterest(position, msg.sender);
   125	
   126	        uint256 newDebtAmount = position.debtAmount + amount;
   127	        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
   128	
   129	        position.debtAmount = newDebtAmount;
   130	        totalDebt += amount;
   131	
   132	        USDC.safeTransfer(msg.sender, amount);
   133	        emit Borrowed(msg.sender, amount, newDebtAmount);
   134	    }
   135	
   136	    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
   137	        if (amount == 0) revert ZeroAmount();
   138	
   139	        Position storage position = positions[msg.sender];
   140	        _accrueInterest(position, msg.sender);
   141	
   142	        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
   143	    }
   144	
   145	    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
   146	        if (amount == 0) revert ZeroAmount();
   147	
   148	        Position storage position = positions[account];
   149	        _accrueInterest(position, account);
   150	
   151	        repaidAmount = _repay(position, account, amount, msg.sender);
   152	    }
   153	
   154	    function liquidate(address account, uint256 requestedRepayAmount)
   155	        external
   156	        nonReentrant
   157	        returns (uint256 actualRepayAmount, uint256 collateralSeized)
   158	    {
   159	        if (requestedRepayAmount == 0) revert ZeroAmount();
   160	
   161	        Position storage position = positions[account];
   162	        _accrueInterest(position, account);
   163	
   164	        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
   165	
   166	        uint256 debtAmount = position.debtAmount;
   167	        uint256 price = _getOraclePrice();
   168	
   169	        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
   170	        collateralSeized = _collateralForRepay(actualRepayAmount, price);
   171	
   172	        if (collateralSeized > position.collateralAmount) {
   173	            collateralSeized = position.collateralAmount;
   174	            actualRepayAmount = _repayForCollateral(collateralSeized, price);
   175	        }
   176	
   177	        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
   178	
   179	        position.debtAmount = debtAmount - actualRepayAmount;
   180	        position.collateralAmount -= collateralSeized;
   181	        totalDebt -= actualRepayAmount;
   182	        totalCollateral -= collateralSeized;
   183	
   184	        USDC.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
   185	        WETH.safeTransfer(msg.sender, collateralSeized);
   186	
   187	        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
   188	    }
   189	
   190	    function getPosition(address account)
   191	        external
   192	        view
   193	        returns (
   194	            uint256 collateralAmount,
   195	            uint256 debtAmount,
   196	            uint256 collateralValueAmount,
   197	            uint256 debtRatioBps
   198	        )
   199	    {
   200	        Position memory position = positions[account];
   201	        collateralAmount = position.collateralAmount;
   202	        debtAmount = _previewDebt(position);
   203	        collateralValueAmount = _collateralValue(position.collateralAmount);
   204	        debtRatioBps = _debtRatioBps(collateralValueAmount, debtAmount);
   205	    }
   206	
   207	    function previewDebt(address account) external view returns (uint256) {
   208	        return _previewDebt(positions[account]);
   209	    }
   210	
   211	    function collateralValue(address account) external view returns (uint256) {
   212	        return _collateralValue(positions[account].collateralAmount);
   213	    }
   214	
   215	    function isHealthy(address account) external view returns (bool) {
   216	        Position memory position = positions[account];
   217	        return _isHealthy(position.collateralAmount, _previewDebt(position));
   218	    }
   219	
   220	    function isLiquidatable(address account) external view returns (bool) {
   221	        Position memory position = positions[account];
   222	        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
   223	    }
   224	
   225	    function _repay(Position storage position, address account, uint256 amount, address payer)
   226	        internal
   227	        returns (uint256 repaidAmount)
   228	    {
   229	        uint256 debtAmount = position.debtAmount;
   230	        if (debtAmount == 0) revert NothingToRepay();
   231	
   232	        repaidAmount = amount > debtAmount ? debtAmount : amount;
   233	        position.debtAmount = debtAmount - repaidAmount;
   234	        totalDebt -= repaidAmount;
   235	
   236	        USDC.safeTransferFrom(payer, address(this), repaidAmount);
   237	        emit Repaid(payer, account, repaidAmount, position.debtAmount);
   238	    }
   239	
   240	    function _accrueInterest(Position storage position, address account) internal {
   241	        uint256 debtAmount = position.debtAmount;
   242	        uint256 lastAccrued = position.lastAccrued;
   243	        uint256 currentTime = block.timestamp;
   244	
   245	        if (lastAccrued == 0) {
   246	            position.lastAccrued = currentTime;
   247	            return;
   248	        }
   249	
   250	        if (debtAmount == 0 || currentTime == lastAccrued) {
   251	            position.lastAccrued = currentTime;
   252	            return;
   253	        }
   254	
   255	        uint256 elapsed = currentTime - lastAccrued;
   256	        uint256 interestAmount =
   257	            debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
   258	
   259	        if (interestAmount != 0) {
   260	            position.debtAmount = debtAmount + interestAmount;

 succeeded in 14ms:
     1	# Notes
     2	
     3	## Position health
     4	
     5	The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
     6	Collateral value is computed from a Chainlink-style ETH / USD feed:
     7	
     8	`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
     9	
    10	Debt health is measured as:
    11	
    12	`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
    13	
    14	Operational thresholds:
    15	
    16	- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
    17	- A position becomes liquidatable once `debtRatioBps > 8_500`.
    18	- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
    19	
    20	Interest accrues linearly per position from its last touch timestamp:
    21	
    22	`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
    23	
    24	This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
    25	
    26	## Liquidation flow
    27	
    28	For a liquidator:
    29	
    30	1. Read the current position debt and collateral value using the current oracle price.
    31	2. Verify the debt ratio is above `85%`.
    32	3. Approve the market to pull the amount of `USDC` you want to repay.
    33	4. Call `liquidate(account, requestedRepayAmount)`.
    34	
    35	The contract:
    36	
    37	- Accrues interest on the target position first.
    38	- Checks that the position is still liquidatable at the live oracle price.
    39	- Pulls `USDC` from the liquidator.
    40	- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
    41	- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
    42	
    43	If a position is so far underwater that all collateral is exhausted before all debt is repaid, the contract leaves the remaining debt as bad debt on that position. This implementation does not socialize losses or include an admin write-off path.
    44	
    45	Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
    46	
    47	## Mainnet deployment and operations
    48	
    49	The operator has to get these points right on Ethereum mainnet:
    50	
    51	- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
    52	- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
    53	- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
    54	- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
    55	- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
    56	- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
    57	- Run liquidation infrastructure privately when possible to reduce MEV exposure.
    58	- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
    59	- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.

exec
/bin/bash -lc 'nl -ba foundry.toml' in /tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002
 succeeded in 5ms:
     1	[profile.default]
     2	src = "src"
     3	out = "out"
     4	libs = ["lib"]
     5	solc = "0.8.26"
     6	optimizer = true
     7	optimizer_runs = 200
     8	
     9	[fmt]
    10	line_length = 100
    11	tab_width = 4
    12	bracket_spacing = true
    13	

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..4047b28fa94e942bfbac1e556f94be4c30c6e00d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,59 @@
+# Notes
+
+## Position health
+
+The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
+Collateral value is computed from a Chainlink-style ETH / USD feed:
+
+`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+
+Debt health is measured as:
+
+`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
+
+Operational thresholds:
+
+- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
+- A position becomes liquidatable once `debtRatioBps > 8_500`.
+- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
+
+Interest accrues linearly per position from its last touch timestamp:
+
+`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
+
+## Liquidation flow
+
+For a liquidator:
+
+1. Read the current position debt and collateral value using the current oracle price.
+2. Verify the debt ratio is above `85%`.
+3. Approve the market to pull the amount of `USDC` you want to repay.
+4. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- Accrues interest on the target position first.
+- Checks that the position is still liquidatable at the live oracle price.
+- Pulls `USDC` from the liquidator.
+- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
+- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
+
+If a position is so far underwater that all collateral is exhausted before all debt is repaid, the contract leaves the remaining debt as bad debt on that position. This implementation does not socialize losses or include an admin write-off path.
+
+Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
+
+## Mainnet deployment and operations
+
+The operator has to get these points right on Ethereum mainnet:
+
+- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
+- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
+- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
+- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
+- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
+- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
+- Run liquidation infrastructure privately when possible to reduce MEV exposure.
+- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
+- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3421e7bd411cb0a854e928fea9a8eab6dd7f8e81
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..4e30b85c914da4ad5c4d2f7e5a1f9e87cc78e4ab
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,2 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5c56357f2b8fb0adcd96cc9db6c7c36f643a7980
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS_SCALE = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+    uint256 public immutable ORACLE_TO_USDC_SCALE;
+
+    uint256 public totalCollateral;
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidTokenDecimals();
+    error InvalidInterestRate();
+    error InvalidOracleDelay();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error NothingToRepay();
+    error NoCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebtAmount
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
+        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
+        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
+        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
+        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregatorV3(collateralOracle_);
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+        ORACLE_TO_USDC_SCALE = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.collateralAmount += amount;
+        totalCollateral += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (position.collateralAmount < amount) revert NoCollateral();
+
+        uint256 updatedCollateral = position.collateralAmount - amount;
+        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
+
+        position.collateralAmount = updatedCollateral;
+        totalCollateral -= amount;
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
+
+        position.debtAmount = newDebtAmount;
+        totalDebt += amount;
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
+    }
+
+    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        repaidAmount = _repay(position, account, amount, msg.sender);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 debtAmount = position.debtAmount;
+        uint256 price = _getOraclePrice();
+
+        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
+        collateralSeized = _collateralForRepay(actualRepayAmount, price);
+
+        if (collateralSeized > position.collateralAmount) {
+            collateralSeized = position.collateralAmount;
+            actualRepayAmount = _repayForCollateral(collateralSeized, price);
+        }
+
+        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
+
+        position.debtAmount = debtAmount - actualRepayAmount;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepayAmount;
+        totalCollateral -= collateralSeized;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        WETH.safeTransfer(msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debtAmount,
+            uint256 collateralValueAmount,
+            uint256 debtRatioBps
+        )
+    {
+        Position memory position = positions[account];
+        collateralAmount = position.collateralAmount;
+        debtAmount = _previewDebt(position);
+        collateralValueAmount = _collateralValue(position.collateralAmount);
+        debtRatioBps = _debtRatioBps(collateralValueAmount, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return _collateralValue(positions[account].collateralAmount);
+    }
+
+    function isHealthy(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isHealthy(position.collateralAmount, _previewDebt(position));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
+    }
+
+    function _repay(Position storage position, address account, uint256 amount, address payer)
+        internal
+        returns (uint256 repaidAmount)
+    {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) revert NothingToRepay();
+
+        repaidAmount = amount > debtAmount ? debtAmount : amount;
+        position.debtAmount = debtAmount - repaidAmount;
+        totalDebt -= repaidAmount;
+
+        USDC.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtAmount);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+        uint256 currentTime = block.timestamp;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        if (debtAmount == 0 || currentTime == lastAccrued) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        uint256 elapsed = currentTime - lastAccrued;
+        uint256 interestAmount =
+            debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        if (interestAmount != 0) {
+            position.debtAmount = debtAmount + interestAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount, position.debtAmount);
+        }
+
+        position.lastAccrued = currentTime;
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrued == 0) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        uint256 interestAmount =
+            position.debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        return position.debtAmount + interestAmount;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) > LIQUIDATION_LTV_BPS;
+    }
+
+    function _debtRatioBps(uint256 collateralValueAmount, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueAmount == 0) return type(uint256).max;
+        return debtAmount.mulDiv(BPS_SCALE, collateralValueAmount, Math.Rounding.Ceil);
+    }
+
+    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return collateralAmount.mulDiv(_getOraclePrice(), ORACLE_TO_USDC_SCALE, Math.Rounding.Floor);
+    }
+
+    function _collateralForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
+        return repayAmount.mulDiv(LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, price * BPS_SCALE, Math.Rounding.Floor);
+    }
+
+    function _repayForCollateral(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
+        return collateralAmount.mulDiv(
+            price * BPS_SCALE, LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, Math.Rounding.Floor
+        );
+    }
+
+    function _getOraclePrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_DELAY) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregatorV3.sol b/src/interfaces/IChainlinkAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dc3ac47e04458a3a86fd326aa1ae2a99158791b
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregatorV3 {
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

codex
Set up a minimal Foundry project and implemented the market contract in [src/WethUsdcBorrowingMarket.sol](/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/src/WethUsdcBorrowingMarket.sol:12), with config in [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/foundry.toml:1). The contract supports WETH collateral deposits and withdrawals, USDC borrowing and repayment, linear per-position interest accrual, Chainlink-style ETH/USD collateral valuation, and partial liquidations with a 5% WETH bonus once a position is above 85% debt-to-collateral.

Deployment and operating guidance is in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/NOTES.md:1). That covers the health formula, liquidation procedure, oracle freshness requirements, liquidity prefunding, and the fact that fully underwater positions can leave residual bad debt.

Verified with `forge build`; compilation succeeded. I did not run tests, fuzzing, or Slither in this pass.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..4047b28fa94e942bfbac1e556f94be4c30c6e00d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,59 @@
+# Notes
+
+## Position health
+
+The market stores collateral in `WETH` with `18` decimals and debt in `USDC` with `6` decimals.
+Collateral value is computed from a Chainlink-style ETH / USD feed:
+
+`collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
+
+Debt health is measured as:
+
+`debtRatioBps = debtUsdc * 10_000 / collateralValueUsdc`
+
+Operational thresholds:
+
+- Borrowing and collateral withdrawals require `debtRatioBps <= 7_000` after the action.
+- A position becomes liquidatable once `debtRatioBps > 8_500`.
+- Liquidation seizes WETH worth the USDC repayment plus a `5%` bonus.
+
+Interest accrues linearly per position from its last touch timestamp:
+
+`newDebt = debt + debt * annualInterestBps * elapsed / (10_000 * 365 days)`
+
+This is intentionally simple. It is deterministic and easy to reason about, but it is not a utilization-based rate model.
+
+## Liquidation flow
+
+For a liquidator:
+
+1. Read the current position debt and collateral value using the current oracle price.
+2. Verify the debt ratio is above `85%`.
+3. Approve the market to pull the amount of `USDC` you want to repay.
+4. Call `liquidate(account, requestedRepayAmount)`.
+
+The contract:
+
+- Accrues interest on the target position first.
+- Checks that the position is still liquidatable at the live oracle price.
+- Pulls `USDC` from the liquidator.
+- Sends back the corresponding `WETH` plus the `5%` liquidation bonus.
+- Caps the seizure to the borrower's remaining collateral if the position is deeply underwater.
+
+If a position is so far underwater that all collateral is exhausted before all debt is repaid, the contract leaves the remaining debt as bad debt on that position. This implementation does not socialize losses or include an admin write-off path.
+
+Because the liquidation check and transfer happen in one transaction, a liquidator still has oracle-timing and mempool risk. Offchain bots should re-check price freshness immediately before sending the transaction.
+
+## Mainnet deployment and operations
+
+The operator has to get these points right on Ethereum mainnet:
+
+- Use the canonical token addresses for `WETH` and `USDC`, and confirm the token decimals are `18` and `6`.
+- Use a trustworthy ETH / USD oracle. A Chainlink ETH / USD feed with explicit heartbeat monitoring is the expected configuration here.
+- Set `maxOracleDelay` conservatively. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, the market can become unusable during oracle interruptions.
+- Fund the contract with enough `USDC` liquidity before opening borrowing. The contract lends only the `USDC` it already holds.
+- Choose an annual rate that is operationally acceptable and economically sane for a fixed-rate book. The contract enforces the rate immutably after deployment.
+- Monitor available `USDC` liquidity, total debt, unhealthy positions, and oracle freshness continuously.
+- Run liquidation infrastructure privately when possible to reduce MEV exposure.
+- Audit the exact deployment bytecode and constructor arguments before mainnet deployment. This implementation has no admin recovery function, pause, or upgrade path, so deployment mistakes require redeployment.
+- Run `slither`, fuzz tests, and source verification as part of the deployment process even though this task only requires `forge build`.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3421e7bd411cb0a854e928fea9a8eab6dd7f8e81
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..4e30b85c914da4ad5c4d2f7e5a1f9e87cc78e4ab
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,2 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+
diff --git a/src/WethUsdcBorrowingMarket.sol b/src/WethUsdcBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5c56357f2b8fb0adcd96cc9db6c7c36f643a7980
--- /dev/null
+++ b/src/WethUsdcBorrowingMarket.sol
@@ -0,0 +1,318 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregatorV3} from "./interfaces/IChainlinkAggregatorV3.sol";
+
+contract WethUsdcBorrowingMarket is ReentrancyGuard {
+    using Math for uint256;
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS_SCALE = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregatorV3 public immutable COLLATERAL_ORACLE;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable MAX_ORACLE_DELAY;
+    uint256 public immutable ORACLE_TO_USDC_SCALE;
+
+    uint256 public totalCollateral;
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address account => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidTokenDecimals();
+    error InvalidInterestRate();
+    error InvalidOracleDelay();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error NothingToRepay();
+    error NoCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidAmount,
+        uint256 collateralSeized,
+        uint256 remainingDebtAmount
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleDelay_
+    ) {
+        if (annualInterestBps_ > BPS_SCALE) revert InvalidInterestRate();
+        if (maxOracleDelay_ == 0) revert InvalidOracleDelay();
+        if (IERC20Metadata(weth_).decimals() != WETH_DECIMALS) revert InvalidTokenDecimals();
+        if (IERC20Metadata(usdc_).decimals() != USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        uint8 oracleDecimals = IChainlinkAggregatorV3(collateralOracle_).decimals();
+        if (oracleDecimals < USDC_DECIMALS) revert InvalidTokenDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregatorV3(collateralOracle_);
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        MAX_ORACLE_DELAY = maxOracleDelay_;
+        ORACLE_TO_USDC_SCALE = 10 ** (WETH_DECIMALS + oracleDecimals - USDC_DECIMALS);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.collateralAmount += amount;
+        totalCollateral += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (position.collateralAmount < amount) revert NoCollateral();
+
+        uint256 updatedCollateral = position.collateralAmount - amount;
+        if (!_isHealthy(updatedCollateral, position.debtAmount)) revert BorrowLimitExceeded();
+
+        position.collateralAmount = updatedCollateral;
+        totalCollateral -= amount;
+
+        WETH.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isHealthy(position.collateralAmount, newDebtAmount)) revert BorrowLimitExceeded();
+
+        position.debtAmount = newDebtAmount;
+        totalDebt += amount;
+
+        USDC.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        repaidAmount = _repay(position, msg.sender, amount, msg.sender);
+    }
+
+    function repayFor(address account, uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        repaidAmount = _repay(position, account, amount, msg.sender);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 actualRepayAmount, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 debtAmount = position.debtAmount;
+        uint256 price = _getOraclePrice();
+
+        actualRepayAmount = requestedRepayAmount > debtAmount ? debtAmount : requestedRepayAmount;
+        collateralSeized = _collateralForRepay(actualRepayAmount, price);
+
+        if (collateralSeized > position.collateralAmount) {
+            collateralSeized = position.collateralAmount;
+            actualRepayAmount = _repayForCollateral(collateralSeized, price);
+        }
+
+        if (actualRepayAmount == 0 || collateralSeized == 0) revert NothingToRepay();
+
+        position.debtAmount = debtAmount - actualRepayAmount;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepayAmount;
+        totalCollateral -= collateralSeized;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
+        WETH.safeTransfer(msg.sender, collateralSeized);
+
+        emit Liquidated(msg.sender, account, actualRepayAmount, collateralSeized, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (
+            uint256 collateralAmount,
+            uint256 debtAmount,
+            uint256 collateralValueAmount,
+            uint256 debtRatioBps
+        )
+    {
+        Position memory position = positions[account];
+        collateralAmount = position.collateralAmount;
+        debtAmount = _previewDebt(position);
+        collateralValueAmount = _collateralValue(position.collateralAmount);
+        debtRatioBps = _debtRatioBps(collateralValueAmount, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function collateralValue(address account) external view returns (uint256) {
+        return _collateralValue(positions[account].collateralAmount);
+    }
+
+    function isHealthy(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isHealthy(position.collateralAmount, _previewDebt(position));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position memory position = positions[account];
+        return _isLiquidatable(position.collateralAmount, _previewDebt(position));
+    }
+
+    function _repay(Position storage position, address account, uint256 amount, address payer)
+        internal
+        returns (uint256 repaidAmount)
+    {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) revert NothingToRepay();
+
+        repaidAmount = amount > debtAmount ? debtAmount : amount;
+        position.debtAmount = debtAmount - repaidAmount;
+        totalDebt -= repaidAmount;
+
+        USDC.safeTransferFrom(payer, address(this), repaidAmount);
+        emit Repaid(payer, account, repaidAmount, position.debtAmount);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+        uint256 currentTime = block.timestamp;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        if (debtAmount == 0 || currentTime == lastAccrued) {
+            position.lastAccrued = currentTime;
+            return;
+        }
+
+        uint256 elapsed = currentTime - lastAccrued;
+        uint256 interestAmount =
+            debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        if (interestAmount != 0) {
+            position.debtAmount = debtAmount + interestAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount, position.debtAmount);
+        }
+
+        position.lastAccrued = currentTime;
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        if (position.debtAmount == 0 || position.lastAccrued == 0) {
+            return position.debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        uint256 interestAmount =
+            position.debtAmount.mulDiv(ANNUAL_INTEREST_BPS * elapsed, BPS_SCALE * YEAR, Math.Rounding.Floor);
+
+        return position.debtAmount + interestAmount;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        return _debtRatioBps(_collateralValue(collateralAmount), debtAmount) > LIQUIDATION_LTV_BPS;
+    }
+
+    function _debtRatioBps(uint256 collateralValueAmount, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueAmount == 0) return type(uint256).max;
+        return debtAmount.mulDiv(BPS_SCALE, collateralValueAmount, Math.Rounding.Ceil);
+    }
+
+    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return collateralAmount.mulDiv(_getOraclePrice(), ORACLE_TO_USDC_SCALE, Math.Rounding.Floor);
+    }
+
+    function _collateralForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
+        return repayAmount.mulDiv(LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, price * BPS_SCALE, Math.Rounding.Floor);
+    }
+
+    function _repayForCollateral(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
+        return collateralAmount.mulDiv(
+            price * BPS_SCALE, LIQUIDATION_BONUS_BPS * ORACLE_TO_USDC_SCALE, Math.Rounding.Floor
+        );
+    }
+
+    function _getOraclePrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt < block.timestamp - MAX_ORACLE_DELAY) revert StaleOraclePrice();
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregatorV3.sol b/src/interfaces/IChainlinkAggregatorV3.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dc3ac47e04458a3a86fd326aa1ae2a99158791b
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregatorV3.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregatorV3 {
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

tokens used
51,019
````

## final message

Set up a minimal Foundry project and implemented the market contract in [src/WethUsdcBorrowingMarket.sol](/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/src/WethUsdcBorrowingMarket.sol:12), with config in [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/foundry.toml:1). The contract supports WETH collateral deposits and withdrawals, USDC borrowing and repayment, linear per-position interest accrual, Chainlink-style ETH/USD collateral valuation, and partial liquidations with a 5% WETH bonus once a position is above 85% debt-to-collateral.

Deployment and operating guidance is in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211615Z-codex-with-skill-3/security-goal-002/NOTES.md:1). That covers the health formula, liquidation procedure, oracle freshness requirements, liquidity prefunding, and the fact that fully underwater positions can leave residual bad debt.

Verified with `forge build`; compilation succeeded. I did not run tests, fuzzing, or Slither in this pass.

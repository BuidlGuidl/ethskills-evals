# Executor transcript — 2026-08-31T211610Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059b1-d5e1-7852-bfd8-c7e014c3521b
--------
user
We're building the onchain piece of a "save any token" product for Ethereum
mainnet. Anyone can spin up a vault for any ERC-20 — listing is
permissionless, whatever token someone proposes gets a vault. Depositors
receive a transferable receipt token representing their pro-rata claim on
that vault, so they can move it around or use it elsewhere. Yield arrives as
more of the same underlying token: a keeper bot periodically transfers tokens
into the vault, which lifts every holder's claim. Deposits and withdrawals
are open at any time, with no lockup.

Work in this directory:
  - set up a foundry project and implement the contracts we would deploy
  - the yield source is not the point — the keeper just sends tokens in;
    assume that part already works
  - make sure it compiles with forge build
  - leave a NOTES.md covering how a depositor's claim is computed, and what
    an operator has to get right when they list a token and run the keeper

2026-08-31T21:20:22.215038Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059b1-d5e1-7852-bfd8-c7e014c3521b.tmp-1788211221996221668: line 2547: syntax error near unexpected token `('

codex
I’m setting up a Foundry-based implementation for a permissionless ERC-20 vault with transferable receipt shares, then I’ll compile it and leave operator/depositor notes. I’m reading the local security skill first and inspecting the workspace so the contract design matches the repo state and the deployment constraints.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 6ms:
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


exec
/bin/bash -lc 'pwd && rg --files -n .' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 8ms:
./TASK.md
./package.json

codex
The workspace is basically empty, so I’m reading the rest of the security guidance and then I’ll scaffold the project from scratch rather than trying to fit into an existing contract layout. After that I’ll implement a minimal vault/share-token pair with the security edges handled up front.
exec
/bin/bash -lc "sed -n '241,520p' .agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc "sed -n '1,220p' package.json" in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 22ms:
{
  "name": "eval-workspace",
  "private": true
}

 succeeded in 29ms:
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

 succeeded in 27ms:
We're building the onchain piece of a "save any token" product for Ethereum
mainnet. Anyone can spin up a vault for any ERC-20 — listing is
permissionless, whatever token someone proposes gets a vault. Depositors
receive a transferable receipt token representing their pro-rata claim on
that vault, so they can move it around or use it elsewhere. Yield arrives as
more of the same underlying token: a keeper bot periodically transfers tokens
into the vault, which lifts every holder's claim. Deposits and withdrawals
are open at any time, with no lockup.

Work in this directory:
  - set up a foundry project and implement the contracts we would deploy
  - the yield source is not the point — the keeper just sends tokens in;
    assume that part already works
  - make sure it compiles with forge build
  - leave a NOTES.md covering how a depositor's claim is computed, and what
    an operator has to get right when they list a token and run the keeper

codex
I have enough context to build this as a share-based vault system rather than a strict ERC-4626 deployment, because vault creation is permissionless and arbitrary ERC-20 behavior needs explicit handling. Next I’m checking the toolchain, then I’ll scaffold a minimal Foundry layout, implement a factory plus vault/share token contracts, and verify the build.
exec
/bin/bash -lc 'forge --version' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 12ms:
 succeeded in 19ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

exec
/bin/bash -lc 'ls -la' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 6ms:
total 24
drwxrwxr-x 5 damu damu 4096 Aug 31 18:20 .
drwxrwxr-x 3 damu damu 4096 Aug 31 18:16 ..
drwxrwxr-x 3 damu damu 4096 Aug 31 18:16 .agents
dr-xr-xr-x 2 damu damu   40 Aug 31 18:20 .codex
drwxrwxr-x 8 damu damu 4096 Aug 31 18:16 .git
-rw-rw-r-- 1 damu damu  959 Aug 31 18:16 TASK.md
-rw-rw-r-- 1 damu damu   50 Aug 31 18:16 package.json

codex
The toolchain is present and the worktree is clean. I’m adding the Foundry scaffold and OpenZeppelin dependency first so the contracts can lean on audited ERC-20, SafeERC20, and reentrancy primitives instead of reimplementing them.
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts --no-commit' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 exited 2 in 11ms:
error: unexpected argument '--no-commit' found

  tip: a similar argument exists: '--commit'

Usage: forge install [OPTIONS] [DEPENDENCIES]...
    forge install [OPTIONS] <github username>/<github project>@<tag>...
    forge install [OPTIONS] <alias>=<github username>/<github project>@<tag>...
    forge install [OPTIONS] <https://<github token>@git url>...)]
    forge install [OPTIONS] <https:// git url>...

For more information, try '--help'.

codex
`forge install` on this version doesn’t support `--no-commit`, so I’m adjusting to the local CLI semantics rather than forcing an older flag set. After the dependency lands I’ll write the contracts and docs in one pass.
exec
/bin/bash -lc 'forge install --help' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 5ms:
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
/bin/bash -lc 'forge install --no-git OpenZeppelin/openzeppelin-contracts' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 11010ms:
Installing openzeppelin-contracts in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: None)
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/lib/openzeppelin-contracts'...
Submodule 'lib/erc4626-tests' (https://github.com/a16z/erc4626-tests.git) registered for path 'lib/erc4626-tests'
Submodule 'lib/forge-std' (https://github.com/foundry-rs/forge-std) registered for path 'lib/forge-std'
Submodule 'lib/halmos-cheatcodes' (https://github.com/a16z/halmos-cheatcodes) registered for path 'lib/halmos-cheatcodes'
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/lib/openzeppelin-contracts/lib/erc4626-tests'...
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/lib/openzeppelin-contracts/lib/forge-std'...
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/lib/openzeppelin-contracts/lib/halmos-cheatcodes'...
From https://github.com/a16z/erc4626-tests
 * branch            232ff9ba8194e406967f52ecc5cb52ed764209e9 -> FETCH_HEAD
From https://github.com/foundry-rs/forge-std
 * branch            1801b0541f4fda118a10798fd3486bb7051c5dd6 -> FETCH_HEAD
From https://github.com/a16z/halmos-cheatcodes
 * branch            7328abe100445fc53885c21d0e713b95293cf14c -> FETCH_HEAD
    Installed openzeppelin-contracts

codex
The dependency is in place. I’m checking the installed tree and then writing the core files: a factory, a vault that also serves as the transferable receipt token, and the operator/depositor notes.
exec
/bin/bash -lc 'find . -maxdepth 2 -type d | sort' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 3ms:
 succeeded in 4ms:
exec
/bin/bash -lc 'rg -n "contract ERC20" lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc "sed -n '1,240p' lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol" in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 12ms:
29:abstract contract ERC20 is Context, IERC20, IERC20Metadata, IERC20Errors {

 succeeded in 10ms:
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.20;

import {IERC20} from "./IERC20.sol";
import {IERC20Metadata} from "./extensions/IERC20Metadata.sol";
import {Context} from "../../utils/Context.sol";
import {IERC20Errors} from "../../interfaces/draft-IERC6093.sol";

/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 *
 * TIP: For a detailed writeup see our guide
 * https://forum.openzeppelin.com/t/how-to-implement-erc20-supply-mechanisms/226[How
 * to implement supply mechanisms].
 *
 * The default value of {decimals} is 18. To change this, you should override
 * this function so it returns a different value.
 *
 * We have followed general OpenZeppelin Contracts guidelines: functions revert
 * instead returning `false` on failure. This behavior is nonetheless
 * conventional and does not conflict with the expectations of ERC-20
 * applications.
 */
abstract contract ERC20 is Context, IERC20, IERC20Metadata, IERC20Errors {
    mapping(address account => uint256) private _balances;

    mapping(address account => mapping(address spender => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * Both values are immutable: they can only be set once during construction.
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the default value returned by this function, unless
     * it's overridden.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    /// @inheritdoc IERC20
    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    /// @inheritdoc IERC20
    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `value`.
     */
    function transfer(address to, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }

    /// @inheritdoc IERC20
    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `value` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, value);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Skips emitting an {Approval} event indicating an allowance update. This is not
     * required by the ERC. See {xref-ERC20-_approve-address-address-uint256-bool-}[_approve].
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `value`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `value`.
     */
    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(from, to, value);
    }

    /**
     * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
     * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
     * this function.
     *
     * Emits a {Transfer} event.
     */
    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            // Overflow check required: The rest of the code assumes that totalSupply never overflows
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                // Overflow not possible: value <= fromBalance <= totalSupply.
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                // Overflow not possible: value <= totalSupply or value <= fromBalance <= totalSupply.
                _totalSupply -= value;
            }
        } else {
            unchecked {
                // Overflow not possible: balance + value is at most totalSupply, which we know fits into a uint256.
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    /**
     * @dev Creates a `value` amount of tokens and assigns them to `account`, by transferring it from address(0).
     * Relies on the `_update` mechanism
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _mint(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(address(0), account, value);
    }

    /**
     * @dev Destroys a `value` amount of tokens from `account`, lowering the total supply.
     * Relies on the `_update` mechanism.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead
     */
    function _burn(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        _update(account, address(0), value);
    }

    /**
     * @dev Sets `value` as the allowance of `spender` over the `owner`'s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.

exec
/bin/bash -lc "sed -n '1,220p' lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol" in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/extensions/IERC20Metadata.sol)

pragma solidity >=0.6.2;

import {IERC20} from "../IERC20.sol";

/**
 * @dev Interface for the optional metadata functions from the ERC-20 standard.
 */
interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}

codex
I’m writing the project files now. The vault logic is intentionally narrow: no admin drain paths, no strategy hooks, and no reliance on token metadata beyond optional display decimals, so the keeper only needs to donate underlying and nothing else can mutate share accounting.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/NOTES.md
/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/foundry.toml
/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/src/TokenizedVault.sol
/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/src/VaultFactory.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..3dc2d76475a701ec5cad83451f7ef7c1727ede69
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,39 @@
+# Vault Notes
+
+## Claim Math
+
+Each vault holds a single ERC-20 asset and the vault token itself is the transferable receipt token.
+
+- `totalAssets()` is just the vault's onchain balance of the underlying token.
+- `totalSupply()` is the outstanding receipt-share supply.
+- A holder's pro-rata claim is `holderShares / totalSupply * totalAssets`.
+- `convertToAssets(shares)` computes the current underlying claim for a given share balance.
+- `convertToShares(assets)` computes how many new receipt shares a deposit would mint at the current exchange rate.
+
+Yield is not tracked in separate accounting. When the keeper sends more underlying into the vault, `totalAssets()` increases while `totalSupply()` stays fixed, so every existing share becomes redeemable for more of the same asset.
+
+The vault uses a `+1` virtual share / `+1` virtual asset offset in conversions. That prevents the classic empty-vault inflation attack from turning a victim deposit into a free donation. If a token is so low-precision or a deposit is so small that the computed shares round to zero, the transaction reverts instead of letting value leak.
+
+## Operator Requirements
+
+Anyone can list a token by calling `VaultFactory.createVault(asset, name, symbol)`. The operator creating a vault has to get a few things right:
+
+- Pick a real ERC-20. The code assumes `balanceOf`, `transfer`, and `transferFrom` work normally.
+- Pick stable metadata. The vault receipt token name and symbol are immutable after deployment.
+- Prefer vanilla tokens. Rebasing tokens, heavily permissioned/blocklist tokens, and unusual fee-on-transfer tokens create confusing UX and can make receipt pricing or withdrawals surprising.
+- Understand decimals. Share decimals mirror the underlying token when `decimals()` exists, otherwise the vault falls back to `18` for display.
+
+For the keeper:
+
+- Yield is added by transferring more of the underlying token directly into the vault address.
+- The keeper does not need a role, approval, or special function call.
+- The keeper must only send the correct underlying token for that vault.
+- If the keeper funds the wrong vault or wrong token, the contracts do not auto-recover that mistake.
+- The keeper should use normal ERC-20 transfers; if the underlying token taxes or rebases, the actual credited yield is whatever the vault balance increases by.
+
+## Behavioral Notes
+
+- Deposits mint shares against the vault state before the incoming transfer, and they use the actual balance delta so incoming transfer-fee tokens do not overmint.
+- `withdraw(assets, ...)` burns however many shares are needed to source that asset amount, rounding up in favor of the vault.
+- `redeem(shares, ...)` burns an exact share amount and returns the corresponding assets, rounding down in favor of the vault.
+- There is no admin withdrawal path, no pauser, and no strategy hook in these contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a588e68b4c953db95020ee72f4e2b5e7ff65c6c7
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenizedVault.sol b/src/TokenizedVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c4f93a4121528293dae9081d79a2ffc168921586
--- /dev/null
+++ b/src/TokenizedVault.sol
@@ -0,0 +1,195 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract TokenizedVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error VaultNotHealthy();
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+    uint8 private immutable _shareDecimals;
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        _shareDecimals = _readDecimals(asset_);
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _shareDecimals;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        uint256 received = assetsAfter - assetsBefore;
+        if (received == 0) revert ZeroAssets();
+
+        shares = _convertToShares(received, supply, assetsBefore, Math.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, received, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter < assetsBefore + assets) revert VaultNotHealthy();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        shares = _convertToShares(assets, supply, assetsBefore, Math.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _convertToShares(uint256 assets, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (assets == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(assets, supply + 1, managedAssets + 1, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (shares == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(shares, managedAssets + 1, supply + 1, rounding);
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 decimals_) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 reportedDecimals) {
+            return reportedDecimals;
+        } catch {
+            return 18;
+        }
+    }
+}
+
diff --git a/src/VaultFactory.sol b/src/VaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef8b91dc29b5f65db42c8ca316727f3a0dcdba01
--- /dev/null
+++ b/src/VaultFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {TokenizedVault} from "./TokenizedVault.sol";
+
+contract VaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+    error EmptyMetadata();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        TokenizedVault deployedVault = new TokenizedVault(asset, name, symbol);
+        vault = address(deployedVault);
+
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..3dc2d76475a701ec5cad83451f7ef7c1727ede69
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,39 @@
+# Vault Notes
+
+## Claim Math
+
+Each vault holds a single ERC-20 asset and the vault token itself is the transferable receipt token.
+
+- `totalAssets()` is just the vault's onchain balance of the underlying token.
+- `totalSupply()` is the outstanding receipt-share supply.
+- A holder's pro-rata claim is `holderShares / totalSupply * totalAssets`.
+- `convertToAssets(shares)` computes the current underlying claim for a given share balance.
+- `convertToShares(assets)` computes how many new receipt shares a deposit would mint at the current exchange rate.
+
+Yield is not tracked in separate accounting. When the keeper sends more underlying into the vault, `totalAssets()` increases while `totalSupply()` stays fixed, so every existing share becomes redeemable for more of the same asset.
+
+The vault uses a `+1` virtual share / `+1` virtual asset offset in conversions. That prevents the classic empty-vault inflation attack from turning a victim deposit into a free donation. If a token is so low-precision or a deposit is so small that the computed shares round to zero, the transaction reverts instead of letting value leak.
+
+## Operator Requirements
+
+Anyone can list a token by calling `VaultFactory.createVault(asset, name, symbol)`. The operator creating a vault has to get a few things right:
+
+- Pick a real ERC-20. The code assumes `balanceOf`, `transfer`, and `transferFrom` work normally.
+- Pick stable metadata. The vault receipt token name and symbol are immutable after deployment.
+- Prefer vanilla tokens. Rebasing tokens, heavily permissioned/blocklist tokens, and unusual fee-on-transfer tokens create confusing UX and can make receipt pricing or withdrawals surprising.
+- Understand decimals. Share decimals mirror the underlying token when `decimals()` exists, otherwise the vault falls back to `18` for display.
+
+For the keeper:
+
+- Yield is added by transferring more of the underlying token directly into the vault address.
+- The keeper does not need a role, approval, or special function call.
+- The keeper must only send the correct underlying token for that vault.
+- If the keeper funds the wrong vault or wrong token, the contracts do not auto-recover that mistake.
+- The keeper should use normal ERC-20 transfers; if the underlying token taxes or rebases, the actual credited yield is whatever the vault balance increases by.
+
+## Behavioral Notes
+
+- Deposits mint shares against the vault state before the incoming transfer, and they use the actual balance delta so incoming transfer-fee tokens do not overmint.
+- `withdraw(assets, ...)` burns however many shares are needed to source that asset amount, rounding up in favor of the vault.
+- `redeem(shares, ...)` burns an exact share amount and returns the corresponding assets, rounding down in favor of the vault.
+- There is no admin withdrawal path, no pauser, and no strategy hook in these contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a588e68b4c953db95020ee72f4e2b5e7ff65c6c7
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenizedVault.sol b/src/TokenizedVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c4f93a4121528293dae9081d79a2ffc168921586
--- /dev/null
+++ b/src/TokenizedVault.sol
@@ -0,0 +1,195 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract TokenizedVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error VaultNotHealthy();
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+    uint8 private immutable _shareDecimals;
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        _shareDecimals = _readDecimals(asset_);
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _shareDecimals;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        uint256 received = assetsAfter - assetsBefore;
+        if (received == 0) revert ZeroAssets();
+
+        shares = _convertToShares(received, supply, assetsBefore, Math.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, received, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter < assetsBefore + assets) revert VaultNotHealthy();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        shares = _convertToShares(assets, supply, assetsBefore, Math.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _convertToShares(uint256 assets, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (assets == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(assets, supply + 1, managedAssets + 1, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (shares == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(shares, managedAssets + 1, supply + 1, rounding);
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 decimals_) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 reportedDecimals) {
+            return reportedDecimals;
+        } catch {
+            return 18;
+        }
+    }
+}
+
diff --git a/src/VaultFactory.sol b/src/VaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef8b91dc29b5f65db42c8ca316727f3a0dcdba01
--- /dev/null
+++ b/src/VaultFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {TokenizedVault} from "./TokenizedVault.sol";
+
+contract VaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+    error EmptyMetadata();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        TokenizedVault deployedVault = new TokenizedVault(asset, name, symbol);
+        vault = address(deployedVault);
+
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

codex
The core files are in place. I’m compiling now to catch any interface or library mismatches, and I’ll tighten the contracts if Foundry exposes any edge cases in the first pass.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 247ms:
Compiling 18 files with Solc 0.8.28
Solc 0.8.28 finished in 198.81ms
Compiler run successful!
2026-08-31T21:22:59.303915Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenizedVault.sol:19:29
   |
19 |     IERC20 public immutable asset;
   |                             ^^^^^ help: consider using: `ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenizedVault.sol:20:30
   |
20 |     address public immutable factory;
   |                              ^^^^^^^ help: consider using: `FACTORY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenizedVault.sol:21:29
   |
21 |     uint8 private immutable _shareDecimals;
   |                             ^^^^^^^^^^^^^^ help: consider using: `_SHARE_DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..3dc2d76475a701ec5cad83451f7ef7c1727ede69
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,39 @@
+# Vault Notes
+
+## Claim Math
+
+Each vault holds a single ERC-20 asset and the vault token itself is the transferable receipt token.
+
+- `totalAssets()` is just the vault's onchain balance of the underlying token.
+- `totalSupply()` is the outstanding receipt-share supply.
+- A holder's pro-rata claim is `holderShares / totalSupply * totalAssets`.
+- `convertToAssets(shares)` computes the current underlying claim for a given share balance.
+- `convertToShares(assets)` computes how many new receipt shares a deposit would mint at the current exchange rate.
+
+Yield is not tracked in separate accounting. When the keeper sends more underlying into the vault, `totalAssets()` increases while `totalSupply()` stays fixed, so every existing share becomes redeemable for more of the same asset.
+
+The vault uses a `+1` virtual share / `+1` virtual asset offset in conversions. That prevents the classic empty-vault inflation attack from turning a victim deposit into a free donation. If a token is so low-precision or a deposit is so small that the computed shares round to zero, the transaction reverts instead of letting value leak.
+
+## Operator Requirements
+
+Anyone can list a token by calling `VaultFactory.createVault(asset, name, symbol)`. The operator creating a vault has to get a few things right:
+
+- Pick a real ERC-20. The code assumes `balanceOf`, `transfer`, and `transferFrom` work normally.
+- Pick stable metadata. The vault receipt token name and symbol are immutable after deployment.
+- Prefer vanilla tokens. Rebasing tokens, heavily permissioned/blocklist tokens, and unusual fee-on-transfer tokens create confusing UX and can make receipt pricing or withdrawals surprising.
+- Understand decimals. Share decimals mirror the underlying token when `decimals()` exists, otherwise the vault falls back to `18` for display.
+
+For the keeper:
+
+- Yield is added by transferring more of the underlying token directly into the vault address.
+- The keeper does not need a role, approval, or special function call.
+- The keeper must only send the correct underlying token for that vault.
+- If the keeper funds the wrong vault or wrong token, the contracts do not auto-recover that mistake.
+- The keeper should use normal ERC-20 transfers; if the underlying token taxes or rebases, the actual credited yield is whatever the vault balance increases by.
+
+## Behavioral Notes
+
+- Deposits mint shares against the vault state before the incoming transfer, and they use the actual balance delta so incoming transfer-fee tokens do not overmint.
+- `withdraw(assets, ...)` burns however many shares are needed to source that asset amount, rounding up in favor of the vault.
+- `redeem(shares, ...)` burns an exact share amount and returns the corresponding assets, rounding down in favor of the vault.
+- There is no admin withdrawal path, no pauser, and no strategy hook in these contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a588e68b4c953db95020ee72f4e2b5e7ff65c6c7
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenizedVault.sol b/src/TokenizedVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c4f93a4121528293dae9081d79a2ffc168921586
--- /dev/null
+++ b/src/TokenizedVault.sol
@@ -0,0 +1,195 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract TokenizedVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error VaultNotHealthy();
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+    uint8 private immutable _shareDecimals;
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        _shareDecimals = _readDecimals(asset_);
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _shareDecimals;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        uint256 received = assetsAfter - assetsBefore;
+        if (received == 0) revert ZeroAssets();
+
+        shares = _convertToShares(received, supply, assetsBefore, Math.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, received, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter < assetsBefore + assets) revert VaultNotHealthy();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        shares = _convertToShares(assets, supply, assetsBefore, Math.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _convertToShares(uint256 assets, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (assets == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(assets, supply + 1, managedAssets + 1, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (shares == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(shares, managedAssets + 1, supply + 1, rounding);
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 decimals_) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 reportedDecimals) {
+            return reportedDecimals;
+        } catch {
+            return 18;
+        }
+    }
+}
+
diff --git a/src/VaultFactory.sol b/src/VaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef8b91dc29b5f65db42c8ca316727f3a0dcdba01
--- /dev/null
+++ b/src/VaultFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {TokenizedVault} from "./TokenizedVault.sol";
+
+contract VaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+    error EmptyMetadata();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        TokenizedVault deployedVault = new TokenizedVault(asset, name, symbol);
+        vault = address(deployedVault);
+
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

web search: 
web search: https://ethskills.com/feedback/SKILL.md
web search: 
web search: site:ethskills.com feedback SKILL.md ethskills
codex
The build is already green. I’m making one small cleanup pass to align the immutables with Foundry’s lint expectations, then I’ll rerun the build and close out with the exact files and verification status.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/src/TokenizedVault.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..3dc2d76475a701ec5cad83451f7ef7c1727ede69
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,39 @@
+# Vault Notes
+
+## Claim Math
+
+Each vault holds a single ERC-20 asset and the vault token itself is the transferable receipt token.
+
+- `totalAssets()` is just the vault's onchain balance of the underlying token.
+- `totalSupply()` is the outstanding receipt-share supply.
+- A holder's pro-rata claim is `holderShares / totalSupply * totalAssets`.
+- `convertToAssets(shares)` computes the current underlying claim for a given share balance.
+- `convertToShares(assets)` computes how many new receipt shares a deposit would mint at the current exchange rate.
+
+Yield is not tracked in separate accounting. When the keeper sends more underlying into the vault, `totalAssets()` increases while `totalSupply()` stays fixed, so every existing share becomes redeemable for more of the same asset.
+
+The vault uses a `+1` virtual share / `+1` virtual asset offset in conversions. That prevents the classic empty-vault inflation attack from turning a victim deposit into a free donation. If a token is so low-precision or a deposit is so small that the computed shares round to zero, the transaction reverts instead of letting value leak.
+
+## Operator Requirements
+
+Anyone can list a token by calling `VaultFactory.createVault(asset, name, symbol)`. The operator creating a vault has to get a few things right:
+
+- Pick a real ERC-20. The code assumes `balanceOf`, `transfer`, and `transferFrom` work normally.
+- Pick stable metadata. The vault receipt token name and symbol are immutable after deployment.
+- Prefer vanilla tokens. Rebasing tokens, heavily permissioned/blocklist tokens, and unusual fee-on-transfer tokens create confusing UX and can make receipt pricing or withdrawals surprising.
+- Understand decimals. Share decimals mirror the underlying token when `decimals()` exists, otherwise the vault falls back to `18` for display.
+
+For the keeper:
+
+- Yield is added by transferring more of the underlying token directly into the vault address.
+- The keeper does not need a role, approval, or special function call.
+- The keeper must only send the correct underlying token for that vault.
+- If the keeper funds the wrong vault or wrong token, the contracts do not auto-recover that mistake.
+- The keeper should use normal ERC-20 transfers; if the underlying token taxes or rebases, the actual credited yield is whatever the vault balance increases by.
+
+## Behavioral Notes
+
+- Deposits mint shares against the vault state before the incoming transfer, and they use the actual balance delta so incoming transfer-fee tokens do not overmint.
+- `withdraw(assets, ...)` burns however many shares are needed to source that asset amount, rounding up in favor of the vault.
+- `redeem(shares, ...)` burns an exact share amount and returns the corresponding assets, rounding down in favor of the vault.
+- There is no admin withdrawal path, no pauser, and no strategy hook in these contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a588e68b4c953db95020ee72f4e2b5e7ff65c6c7
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenizedVault.sol b/src/TokenizedVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a11106fb77b84796a1e3cf7aecb602f68111b915
--- /dev/null
+++ b/src/TokenizedVault.sol
@@ -0,0 +1,194 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract TokenizedVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error VaultNotHealthy();
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+    uint8 private immutable _SHARE_DECIMALS;
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        _SHARE_DECIMALS = _readDecimals(asset_);
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _SHARE_DECIMALS;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        uint256 received = assetsAfter - assetsBefore;
+        if (received == 0) revert ZeroAssets();
+
+        shares = _convertToShares(received, supply, assetsBefore, Math.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, received, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter < assetsBefore + assets) revert VaultNotHealthy();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        shares = _convertToShares(assets, supply, assetsBefore, Math.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _convertToShares(uint256 assets, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (assets == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(assets, supply + 1, managedAssets + 1, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (shares == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(shares, managedAssets + 1, supply + 1, rounding);
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 decimals_) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 reportedDecimals) {
+            return reportedDecimals;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/VaultFactory.sol b/src/VaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef8b91dc29b5f65db42c8ca316727f3a0dcdba01
--- /dev/null
+++ b/src/VaultFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {TokenizedVault} from "./TokenizedVault.sol";
+
+contract VaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+    error EmptyMetadata();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        TokenizedVault deployedVault = new TokenizedVault(asset, name, symbol);
+        vault = address(deployedVault);
+
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..3dc2d76475a701ec5cad83451f7ef7c1727ede69
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,39 @@
+# Vault Notes
+
+## Claim Math
+
+Each vault holds a single ERC-20 asset and the vault token itself is the transferable receipt token.
+
+- `totalAssets()` is just the vault's onchain balance of the underlying token.
+- `totalSupply()` is the outstanding receipt-share supply.
+- A holder's pro-rata claim is `holderShares / totalSupply * totalAssets`.
+- `convertToAssets(shares)` computes the current underlying claim for a given share balance.
+- `convertToShares(assets)` computes how many new receipt shares a deposit would mint at the current exchange rate.
+
+Yield is not tracked in separate accounting. When the keeper sends more underlying into the vault, `totalAssets()` increases while `totalSupply()` stays fixed, so every existing share becomes redeemable for more of the same asset.
+
+The vault uses a `+1` virtual share / `+1` virtual asset offset in conversions. That prevents the classic empty-vault inflation attack from turning a victim deposit into a free donation. If a token is so low-precision or a deposit is so small that the computed shares round to zero, the transaction reverts instead of letting value leak.
+
+## Operator Requirements
+
+Anyone can list a token by calling `VaultFactory.createVault(asset, name, symbol)`. The operator creating a vault has to get a few things right:
+
+- Pick a real ERC-20. The code assumes `balanceOf`, `transfer`, and `transferFrom` work normally.
+- Pick stable metadata. The vault receipt token name and symbol are immutable after deployment.
+- Prefer vanilla tokens. Rebasing tokens, heavily permissioned/blocklist tokens, and unusual fee-on-transfer tokens create confusing UX and can make receipt pricing or withdrawals surprising.
+- Understand decimals. Share decimals mirror the underlying token when `decimals()` exists, otherwise the vault falls back to `18` for display.
+
+For the keeper:
+
+- Yield is added by transferring more of the underlying token directly into the vault address.
+- The keeper does not need a role, approval, or special function call.
+- The keeper must only send the correct underlying token for that vault.
+- If the keeper funds the wrong vault or wrong token, the contracts do not auto-recover that mistake.
+- The keeper should use normal ERC-20 transfers; if the underlying token taxes or rebases, the actual credited yield is whatever the vault balance increases by.
+
+## Behavioral Notes
+
+- Deposits mint shares against the vault state before the incoming transfer, and they use the actual balance delta so incoming transfer-fee tokens do not overmint.
+- `withdraw(assets, ...)` burns however many shares are needed to source that asset amount, rounding up in favor of the vault.
+- `redeem(shares, ...)` burns an exact share amount and returns the corresponding assets, rounding down in favor of the vault.
+- There is no admin withdrawal path, no pauser, and no strategy hook in these contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a588e68b4c953db95020ee72f4e2b5e7ff65c6c7
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenizedVault.sol b/src/TokenizedVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a11106fb77b84796a1e3cf7aecb602f68111b915
--- /dev/null
+++ b/src/TokenizedVault.sol
@@ -0,0 +1,194 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract TokenizedVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error VaultNotHealthy();
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+    uint8 private immutable _SHARE_DECIMALS;
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        _SHARE_DECIMALS = _readDecimals(asset_);
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _SHARE_DECIMALS;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        uint256 received = assetsAfter - assetsBefore;
+        if (received == 0) revert ZeroAssets();
+
+        shares = _convertToShares(received, supply, assetsBefore, Math.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, received, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter < assetsBefore + assets) revert VaultNotHealthy();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        shares = _convertToShares(assets, supply, assetsBefore, Math.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _convertToShares(uint256 assets, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (assets == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(assets, supply + 1, managedAssets + 1, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (shares == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(shares, managedAssets + 1, supply + 1, rounding);
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 decimals_) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 reportedDecimals) {
+            return reportedDecimals;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/VaultFactory.sol b/src/VaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef8b91dc29b5f65db42c8ca316727f3a0dcdba01
--- /dev/null
+++ b/src/VaultFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {TokenizedVault} from "./TokenizedVault.sol";
+
+contract VaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+    error EmptyMetadata();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        TokenizedVault deployedVault = new TokenizedVault(asset, name, symbol);
+        vault = address(deployedVault);
+
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

codex
Feedback note for the `security` skill: the vault-inflation section was directly useful here because it pushed the share math toward explicit anti-donation safeguards instead of a naive first-depositor flow.
exec
/bin/bash -lc 'forge fmt' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 20ms:
Formatted /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/src/VaultFactory.sol
Formatted /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/src/TokenizedVault.sol

exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001
 succeeded in 0ms:
 succeeded in 258ms:
Compiling 2 files with Solc 0.8.28
Solc 0.8.28 finished in 192.72ms
Compiler run successful!
2026-08-31T21:23:21.971052Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..3dc2d76475a701ec5cad83451f7ef7c1727ede69
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,39 @@
+# Vault Notes
+
+## Claim Math
+
+Each vault holds a single ERC-20 asset and the vault token itself is the transferable receipt token.
+
+- `totalAssets()` is just the vault's onchain balance of the underlying token.
+- `totalSupply()` is the outstanding receipt-share supply.
+- A holder's pro-rata claim is `holderShares / totalSupply * totalAssets`.
+- `convertToAssets(shares)` computes the current underlying claim for a given share balance.
+- `convertToShares(assets)` computes how many new receipt shares a deposit would mint at the current exchange rate.
+
+Yield is not tracked in separate accounting. When the keeper sends more underlying into the vault, `totalAssets()` increases while `totalSupply()` stays fixed, so every existing share becomes redeemable for more of the same asset.
+
+The vault uses a `+1` virtual share / `+1` virtual asset offset in conversions. That prevents the classic empty-vault inflation attack from turning a victim deposit into a free donation. If a token is so low-precision or a deposit is so small that the computed shares round to zero, the transaction reverts instead of letting value leak.
+
+## Operator Requirements
+
+Anyone can list a token by calling `VaultFactory.createVault(asset, name, symbol)`. The operator creating a vault has to get a few things right:
+
+- Pick a real ERC-20. The code assumes `balanceOf`, `transfer`, and `transferFrom` work normally.
+- Pick stable metadata. The vault receipt token name and symbol are immutable after deployment.
+- Prefer vanilla tokens. Rebasing tokens, heavily permissioned/blocklist tokens, and unusual fee-on-transfer tokens create confusing UX and can make receipt pricing or withdrawals surprising.
+- Understand decimals. Share decimals mirror the underlying token when `decimals()` exists, otherwise the vault falls back to `18` for display.
+
+For the keeper:
+
+- Yield is added by transferring more of the underlying token directly into the vault address.
+- The keeper does not need a role, approval, or special function call.
+- The keeper must only send the correct underlying token for that vault.
+- If the keeper funds the wrong vault or wrong token, the contracts do not auto-recover that mistake.
+- The keeper should use normal ERC-20 transfers; if the underlying token taxes or rebases, the actual credited yield is whatever the vault balance increases by.
+
+## Behavioral Notes
+
+- Deposits mint shares against the vault state before the incoming transfer, and they use the actual balance delta so incoming transfer-fee tokens do not overmint.
+- `withdraw(assets, ...)` burns however many shares are needed to source that asset amount, rounding up in favor of the vault.
+- `redeem(shares, ...)` burns an exact share amount and returns the corresponding assets, rounding down in favor of the vault.
+- There is no admin withdrawal path, no pauser, and no strategy hook in these contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a588e68b4c953db95020ee72f4e2b5e7ff65c6c7
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenizedVault.sol b/src/TokenizedVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a11106fb77b84796a1e3cf7aecb602f68111b915
--- /dev/null
+++ b/src/TokenizedVault.sol
@@ -0,0 +1,194 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract TokenizedVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error VaultNotHealthy();
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+    uint8 private immutable _SHARE_DECIMALS;
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        _SHARE_DECIMALS = _readDecimals(asset_);
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _SHARE_DECIMALS;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        uint256 received = assetsAfter - assetsBefore;
+        if (received == 0) revert ZeroAssets();
+
+        shares = _convertToShares(received, supply, assetsBefore, Math.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, received, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter < assetsBefore + assets) revert VaultNotHealthy();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        shares = _convertToShares(assets, supply, assetsBefore, Math.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _convertToShares(uint256 assets, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (assets == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(assets, supply + 1, managedAssets + 1, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (shares == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(shares, managedAssets + 1, supply + 1, rounding);
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 decimals_) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 reportedDecimals) {
+            return reportedDecimals;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/VaultFactory.sol b/src/VaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef8b91dc29b5f65db42c8ca316727f3a0dcdba01
--- /dev/null
+++ b/src/VaultFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {TokenizedVault} from "./TokenizedVault.sol";
+
+contract VaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+    error EmptyMetadata();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        TokenizedVault deployedVault = new TokenizedVault(asset, name, symbol);
+        vault = address(deployedVault);
+
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

codex
Implemented a minimal Foundry project for the mainnet vault system in [src/TokenizedVault.sol](/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/src/TokenizedVault.sol) and [src/VaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/src/VaultFactory.sol), with config in [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/foundry.toml) and operator/depositor guidance in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/NOTES.md).

The design is permissionless and narrow: anyone can create one vault per ERC-20 via the factory, the vault itself is the transferable receipt token, deposits/withdrawals are always open, and keeper yield is just direct transfers of the underlying into the vault. Share math uses actual received assets on deposit plus a small virtual offset to avoid the empty-vault donation/inflation theft pattern; there is no admin drain, pause, or strategy hook.

`forge build` succeeds. I did not add tests in this pass. The only build warning was Foundry failing to write its global signature cache under `/home/damu/.foundry/...` because that path is read-only in this sandbox; it does not affect compilation.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..3dc2d76475a701ec5cad83451f7ef7c1727ede69
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,39 @@
+# Vault Notes
+
+## Claim Math
+
+Each vault holds a single ERC-20 asset and the vault token itself is the transferable receipt token.
+
+- `totalAssets()` is just the vault's onchain balance of the underlying token.
+- `totalSupply()` is the outstanding receipt-share supply.
+- A holder's pro-rata claim is `holderShares / totalSupply * totalAssets`.
+- `convertToAssets(shares)` computes the current underlying claim for a given share balance.
+- `convertToShares(assets)` computes how many new receipt shares a deposit would mint at the current exchange rate.
+
+Yield is not tracked in separate accounting. When the keeper sends more underlying into the vault, `totalAssets()` increases while `totalSupply()` stays fixed, so every existing share becomes redeemable for more of the same asset.
+
+The vault uses a `+1` virtual share / `+1` virtual asset offset in conversions. That prevents the classic empty-vault inflation attack from turning a victim deposit into a free donation. If a token is so low-precision or a deposit is so small that the computed shares round to zero, the transaction reverts instead of letting value leak.
+
+## Operator Requirements
+
+Anyone can list a token by calling `VaultFactory.createVault(asset, name, symbol)`. The operator creating a vault has to get a few things right:
+
+- Pick a real ERC-20. The code assumes `balanceOf`, `transfer`, and `transferFrom` work normally.
+- Pick stable metadata. The vault receipt token name and symbol are immutable after deployment.
+- Prefer vanilla tokens. Rebasing tokens, heavily permissioned/blocklist tokens, and unusual fee-on-transfer tokens create confusing UX and can make receipt pricing or withdrawals surprising.
+- Understand decimals. Share decimals mirror the underlying token when `decimals()` exists, otherwise the vault falls back to `18` for display.
+
+For the keeper:
+
+- Yield is added by transferring more of the underlying token directly into the vault address.
+- The keeper does not need a role, approval, or special function call.
+- The keeper must only send the correct underlying token for that vault.
+- If the keeper funds the wrong vault or wrong token, the contracts do not auto-recover that mistake.
+- The keeper should use normal ERC-20 transfers; if the underlying token taxes or rebases, the actual credited yield is whatever the vault balance increases by.
+
+## Behavioral Notes
+
+- Deposits mint shares against the vault state before the incoming transfer, and they use the actual balance delta so incoming transfer-fee tokens do not overmint.
+- `withdraw(assets, ...)` burns however many shares are needed to source that asset amount, rounding up in favor of the vault.
+- `redeem(shares, ...)` burns an exact share amount and returns the corresponding assets, rounding down in favor of the vault.
+- There is no admin withdrawal path, no pauser, and no strategy hook in these contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a588e68b4c953db95020ee72f4e2b5e7ff65c6c7
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenizedVault.sol b/src/TokenizedVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a11106fb77b84796a1e3cf7aecb602f68111b915
--- /dev/null
+++ b/src/TokenizedVault.sol
@@ -0,0 +1,194 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract TokenizedVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error VaultNotHealthy();
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+    uint8 private immutable _SHARE_DECIMALS;
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        _SHARE_DECIMALS = _readDecimals(asset_);
+    }
+
+    function decimals() public view override returns (uint8) {
+        return _SHARE_DECIMALS;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, totalSupply(), totalAssets(), Math.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        uint256 received = assetsAfter - assetsBefore;
+        if (received == 0) revert ZeroAssets();
+
+        shares = _convertToShares(received, supply, assetsBefore, Math.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, received, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter < assetsBefore + assets) revert VaultNotHealthy();
+
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        shares = _convertToShares(assets, supply, assetsBefore, Math.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply();
+        uint256 assetsBefore = totalAssets();
+
+        assets = _convertToAssets(shares, supply, assetsBefore, Math.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _convertToShares(uint256 assets, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (assets == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(assets, supply + 1, managedAssets + 1, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, uint256 supply, uint256 managedAssets, Math.Rounding rounding)
+        internal
+        pure
+        returns (uint256)
+    {
+        if (shares == 0) {
+            return 0;
+        }
+
+        return Math.mulDiv(shares, managedAssets + 1, supply + 1, rounding);
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 decimals_) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 reportedDecimals) {
+            return reportedDecimals;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/VaultFactory.sol b/src/VaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ef8b91dc29b5f65db42c8ca316727f3a0dcdba01
--- /dev/null
+++ b/src/VaultFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {TokenizedVault} from "./TokenizedVault.sol";
+
+contract VaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+    error EmptyMetadata();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        TokenizedVault deployedVault = new TokenizedVault(asset, name, symbol);
+        vault = address(deployedVault);
+
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

tokens used
42,438
````

## final message

Implemented a minimal Foundry project for the mainnet vault system in [src/TokenizedVault.sol](/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/src/TokenizedVault.sol) and [src/VaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/src/VaultFactory.sol), with config in [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/foundry.toml) and operator/depositor guidance in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211610Z-codex-with-skill-3/security-goal-001/NOTES.md).

The design is permissionless and narrow: anyone can create one vault per ERC-20 via the factory, the vault itself is the transferable receipt token, deposits/withdrawals are always open, and keeper yield is just direct transfers of the underlying into the vault. Share math uses actual received assets on deposit plus a small virtual offset to avoid the empty-vault donation/inflation theft pattern; there is no admin drain, pause, or strategy hook.

`forge build` succeeds. I did not add tests in this pass. The only build warning was Foundry failing to write its global signature cache under `/home/damu/.foundry/...` because that path is read-only in this sandbox; it does not affect compilation.

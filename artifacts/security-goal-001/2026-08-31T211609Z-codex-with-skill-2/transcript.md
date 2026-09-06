# Executor transcript — 2026-08-31T211609Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059b1-b101-7a00-b47f-829988215ac4
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

2026-08-31T21:20:12.808838Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059b1-b101-7a00-b47f-829988215ac4.tmp-1788211212577156232: line 2547: syntax error near unexpected token `('

codex
I’m setting up a Foundry project for the vault/receipt-token system and will first read the Solidity security skill plus inspect the workspace so the implementation matches the repo state and the deployment risk profile.
exec
/bin/bash -lc "sed -n '1,220p' /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/.agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 12ms:
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

exec
/bin/bash -lc 'pwd && rg --files -n .' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 19ms:
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
./TASK.md
./package.json

codex
I’ve confirmed the workspace is basically empty, so I need to scaffold the project and choose the vault math carefully. I’m reading the rest of the security guidance and the task stub now, then I’ll create the Foundry layout and contracts in one pass.
exec
/bin/bash -lc "sed -n '221,520p' /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/.agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 9ms:
    
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

 succeeded in 8ms:
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

exec
/bin/bash -lc "sed -n '1,220p' package.json" in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 3ms:
{
  "name": "eval-workspace",
  "private": true
}

codex
The core design is an ERC-4626-style share vault per underlying token, but without relying on a strategy contract since yield is just token donations. I’m checking for `forge` and then I’ll scaffold a minimal project with a permissionless factory, the vault contract, and a small test/mocking surface to verify the share math.
exec
/bin/bash -lc 'forge --version' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 19ms:
 succeeded in 24ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

codex
I have the design pinned down: one vault contract that is itself the transferable share token, plus a factory that allows one permissionless listing per ERC-20. I’m writing the Foundry config and the contracts now, with explicit handling for reentrancy, non-standard ERC-20 transfers, and the share-inflation edge case from donation-style yield.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/NOTES.md
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/foundry.toml
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/TokenSavingsVault.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/TokenSavingsVaultFactory.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/interfaces/IERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/interfaces/IERC20Metadata.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/libraries/Math.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/libraries/SafeERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/utils/ERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/utils/ReentrancyGuard.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..2a0a1f662206f080b011e9e2590cfc6bc53215ce
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as 18-decimal shares.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1e18) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1e18)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Shares are always 18 decimals even if the underlying is not, so frontends must display claims via `convertToAssets` rather than assuming 1 receipt token equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f618530e6a9e1d74a8a02f73c714af12025534c1
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,155 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1e18;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        uint256 numerator = assets_ * (supply + VIRTUAL_SHARE_OFFSET);
+        uint256 denominator = assetsInVault + VIRTUAL_ASSET_OFFSET;
+        return numerator / denominator + (numerator % denominator == 0 ? 0 : 1);
+    }
+}
+
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..494706a5ba9806e5cc6f470372a9bd66d4cc90cf
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+}
+
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bdb8b9fea579e054d10089cb123631febc723bea
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal constant _DECIMALS = 18;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_) {
+        name = name_;
+        symbol = symbol_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public pure returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
+
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..2a0a1f662206f080b011e9e2590cfc6bc53215ce
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as 18-decimal shares.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1e18) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1e18)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Shares are always 18 decimals even if the underlying is not, so frontends must display claims via `convertToAssets` rather than assuming 1 receipt token equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f618530e6a9e1d74a8a02f73c714af12025534c1
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,155 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1e18;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        uint256 numerator = assets_ * (supply + VIRTUAL_SHARE_OFFSET);
+        uint256 denominator = assetsInVault + VIRTUAL_ASSET_OFFSET;
+        return numerator / denominator + (numerator % denominator == 0 ? 0 : 1);
+    }
+}
+
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..494706a5ba9806e5cc6f470372a9bd66d4cc90cf
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+}
+
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bdb8b9fea579e054d10089cb123631febc723bea
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal constant _DECIMALS = 18;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_) {
+        name = name_;
+        symbol = symbol_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public pure returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
+
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+

codex
The project skeleton is in place. I’m compiling now to catch interface or arithmetic issues before I add anything else.
exec
/bin/bash -lc 'mkdir -p test script src/interfaces src/libraries src/utils' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 191ms:
Compiling 8 files with Solc 0.8.28
Solc 0.8.28 finished in 144.07ms
Compiler run successful!
2026-08-31T21:22:45.160801Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenSavingsVault.sol:29:29
   |
29 |     IERC20 public immutable asset;
   |                             ^^^^^ help: consider using: `ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/utils/ReentrancyGuard.sol:12:5
   |
12 | /     modifier nonReentrant() {
13 | |         if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
14 | |         _status = _ENTERED;
15 | |         _;
16 | |         _status = _NOT_ENTERED;
17 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
12 ~     modifier nonReentrant() {
13 +         _nonReentrantBefore();
14 +         _;
15 +         _nonReentrantAfter();
16 +     }
17 + 
18 +     function _nonReentrantBefore() internal {
19 +         if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
20 +         _status = _ENTERED;
21 +     }
22 + 
23 +     function _nonReentrantAfter() internal {
24 +         _status = _NOT_ENTERED;
25 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenSavingsVault.sol:30:30
   |
30 |     address public immutable factory;
   |                              ^^^^^^^ help: consider using: `FACTORY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..2a0a1f662206f080b011e9e2590cfc6bc53215ce
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as 18-decimal shares.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1e18) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1e18)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Shares are always 18 decimals even if the underlying is not, so frontends must display claims via `convertToAssets` rather than assuming 1 receipt token equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f618530e6a9e1d74a8a02f73c714af12025534c1
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,155 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1e18;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        uint256 numerator = assets_ * (supply + VIRTUAL_SHARE_OFFSET);
+        uint256 denominator = assetsInVault + VIRTUAL_ASSET_OFFSET;
+        return numerator / denominator + (numerator % denominator == 0 ? 0 : 1);
+    }
+}
+
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..494706a5ba9806e5cc6f470372a9bd66d4cc90cf
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+}
+
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bdb8b9fea579e054d10089cb123631febc723bea
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal constant _DECIMALS = 18;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_) {
+        name = name_;
+        symbol = symbol_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public pure returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
+
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+

codex
I found one important accounting detail before adding tests: the initial virtual-share constant should not be `1e18`, otherwise the first depositor gets an absurd share supply. I’m correcting the share-decimals model so receipt decimals follow the asset when available, which keeps first-deposit pricing sane and still preserves the anti-inflation offset.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/NOTES.md
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/TokenSavingsVault.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/libraries/Math.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/utils/ERC20.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99e831cbc9d2a2513fdb6bb9345721e1c42dc8fc
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a20ee0b743978940e93d36d0d9086ec1b8e7c64c
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _decimals = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _decimals;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99e831cbc9d2a2513fdb6bb9345721e1c42dc8fc
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a20ee0b743978940e93d36d0d9086ec1b8e7c64c
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _decimals = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _decimals;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+

exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc "sed -n '1,240p' src/TokenSavingsVault.sol" in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 3ms:
 succeeded in 189ms:
Compiling 4 files with Solc 0.8.28
Solc 0.8.28 finished in 143.08ms
Compiler run successful!
2026-08-31T21:23:34.208097Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/utils/ReentrancyGuard.sol:12:5
   |
12 | /     modifier nonReentrant() {
13 | |         if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
14 | |         _status = _ENTERED;
15 | |         _;
16 | |         _status = _NOT_ENTERED;
17 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
12 ~     modifier nonReentrant() {
13 +         _nonReentrantBefore();
14 +         _;
15 +         _nonReentrantAfter();
16 +     }
17 + 
18 +     function _nonReentrantBefore() internal {
19 +         if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
20 +         _status = _ENTERED;
21 +     }
22 + 
23 +     function _nonReentrantAfter() internal {
24 +         _status = _NOT_ENTERED;
25 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenSavingsVault.sol:30:29
   |
30 |     IERC20 public immutable asset;
   |                             ^^^^^ help: consider using: `ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenSavingsVault.sol:31:30
   |
31 |     address public immutable factory;
   |                              ^^^^^^^ help: consider using: `FACTORY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/utils/ERC20.sol:13:30
   |
13 |     uint8 internal immutable _decimals;
   |                              ^^^^^^^^^ help: consider using: `_DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99e831cbc9d2a2513fdb6bb9345721e1c42dc8fc
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a20ee0b743978940e93d36d0d9086ec1b8e7c64c
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _decimals = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _decimals;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+

codex
The contracts build, and I’m adding a small self-contained Foundry test suite now. That lets me validate the two security-sensitive behaviors that matter here: donation-driven yield accrual and resistance to the first-depositor inflation attack.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/utils/ERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/test/TokenSavingsVault.t.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/test/mocks/MockERC20.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99e831cbc9d2a2513fdb6bb9345721e1c42dc8fc
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ce4f2afcd7562857d7dac03702a33eb13abb4c93
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _decimals = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _decimals;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal virtual {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+
diff --git a/test/TokenSavingsVault.t.sol b/test/TokenSavingsVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1c9fe86918bc6aaab53b811de903f381526f0a75
--- /dev/null
+++ b/test/TokenSavingsVault.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";
+import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";
+import {MockERC20} from "./mocks/MockERC20.sol";
+
+contract Actor {
+    function approveToken(address token, address spender, uint256 amount) external {
+        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
+        require(ok, "approve failed");
+    }
+
+    function depositToVault(address vault, uint256 assets, address receiver) external returns (uint256 shares) {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("deposit(uint256,address)", assets, receiver));
+        require(ok, "deposit failed");
+        return abi.decode(data, (uint256));
+    }
+
+    function redeemFromVault(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("redeem(uint256,address,address)", shares, receiver, owner));
+        require(ok, "redeem failed");
+        return abi.decode(data, (uint256));
+    }
+}
+
+contract TokenSavingsVaultTest {
+    TokenSavingsVaultFactory internal factory;
+    MockERC20 internal asset;
+    TokenSavingsVault internal vault;
+
+    function setUp() public {
+        factory = new TokenSavingsVaultFactory();
+        asset = new MockERC20("Mock Asset", "MA", 18);
+
+        address vaultAddress = factory.createVault(address(asset), "Savings MA", "svMA");
+        vault = TokenSavingsVault(vaultAddress);
+    }
+
+    function testPermissionlessListingIsUniquePerAsset() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(TokenSavingsVaultFactory.createVault, (address(asset), "Duplicate", "dupMA"))
+        );
+        require(!ok, "duplicate listing should fail");
+    }
+
+    function testKeeperDonationIncreasesRedeemValue() public {
+        setUp();
+
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        asset.mint(address(vault), 20 ether);
+
+        uint256 redeemedAssets = vault.redeem(mintedShares, address(this), address(this));
+        require(redeemedAssets == 120 ether, "yield should accrue pro-rata");
+    }
+
+    function testDonationCannotZeroOutLaterDepositor() public {
+        setUp();
+
+        Actor alice = new Actor();
+        Actor bob = new Actor();
+
+        asset.mint(address(alice), 1 ether);
+        asset.mint(address(bob), 1_999 ether);
+
+        alice.approveToken(address(asset), address(vault), type(uint256).max);
+        bob.approveToken(address(asset), address(vault), type(uint256).max);
+
+        alice.depositToVault(address(vault), 1 ether, address(alice));
+
+        asset.mint(address(vault), 1_000 ether);
+
+        uint256 bobShares = bob.depositToVault(address(vault), 1_999 ether, address(bob));
+        require(bobShares > 0, "inflation mitigation failed");
+    }
+
+    function testDepositUsesActualReceivedAmountForFeeTokens() public {
+        setUp();
+
+        asset.setFee(500, address(0xFEE));
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        require(asset.balanceOf(address(vault)) == 95 ether, "vault should only account for received assets");
+        require(mintedShares == 95 ether, "shares should match net assets on first deposit");
+    }
+}
diff --git a/test/mocks/MockERC20.sol b/test/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..51f8610358e198d7aadd6caf6661c9c8a1abb721
--- /dev/null
+++ b/test/mocks/MockERC20.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {ERC20} from "../../src/utils/ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    uint256 public feeBps;
+    address public feeRecipient;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {
+        feeRecipient = address(0xBEEF);
+    }
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+
+    function setFee(uint256 feeBps_, address feeRecipient_) external {
+        feeBps = feeBps_;
+        feeRecipient = feeRecipient_;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal override {
+        if (feeBps == 0) {
+            super._transfer(from, to, value);
+            return;
+        }
+
+        uint256 fee = (value * feeBps) / 10_000;
+        uint256 remainder = value - fee;
+
+        if (fee > 0) {
+            super._transfer(from, feeRecipient, fee);
+        }
+        super._transfer(from, to, remainder);
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99e831cbc9d2a2513fdb6bb9345721e1c42dc8fc
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ce4f2afcd7562857d7dac03702a33eb13abb4c93
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _decimals = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _decimals;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal virtual {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+
diff --git a/test/TokenSavingsVault.t.sol b/test/TokenSavingsVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1c9fe86918bc6aaab53b811de903f381526f0a75
--- /dev/null
+++ b/test/TokenSavingsVault.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";
+import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";
+import {MockERC20} from "./mocks/MockERC20.sol";
+
+contract Actor {
+    function approveToken(address token, address spender, uint256 amount) external {
+        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
+        require(ok, "approve failed");
+    }
+
+    function depositToVault(address vault, uint256 assets, address receiver) external returns (uint256 shares) {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("deposit(uint256,address)", assets, receiver));
+        require(ok, "deposit failed");
+        return abi.decode(data, (uint256));
+    }
+
+    function redeemFromVault(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("redeem(uint256,address,address)", shares, receiver, owner));
+        require(ok, "redeem failed");
+        return abi.decode(data, (uint256));
+    }
+}
+
+contract TokenSavingsVaultTest {
+    TokenSavingsVaultFactory internal factory;
+    MockERC20 internal asset;
+    TokenSavingsVault internal vault;
+
+    function setUp() public {
+        factory = new TokenSavingsVaultFactory();
+        asset = new MockERC20("Mock Asset", "MA", 18);
+
+        address vaultAddress = factory.createVault(address(asset), "Savings MA", "svMA");
+        vault = TokenSavingsVault(vaultAddress);
+    }
+
+    function testPermissionlessListingIsUniquePerAsset() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(TokenSavingsVaultFactory.createVault, (address(asset), "Duplicate", "dupMA"))
+        );
+        require(!ok, "duplicate listing should fail");
+    }
+
+    function testKeeperDonationIncreasesRedeemValue() public {
+        setUp();
+
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        asset.mint(address(vault), 20 ether);
+
+        uint256 redeemedAssets = vault.redeem(mintedShares, address(this), address(this));
+        require(redeemedAssets == 120 ether, "yield should accrue pro-rata");
+    }
+
+    function testDonationCannotZeroOutLaterDepositor() public {
+        setUp();
+
+        Actor alice = new Actor();
+        Actor bob = new Actor();
+
+        asset.mint(address(alice), 1 ether);
+        asset.mint(address(bob), 1_999 ether);
+
+        alice.approveToken(address(asset), address(vault), type(uint256).max);
+        bob.approveToken(address(asset), address(vault), type(uint256).max);
+
+        alice.depositToVault(address(vault), 1 ether, address(alice));
+
+        asset.mint(address(vault), 1_000 ether);
+
+        uint256 bobShares = bob.depositToVault(address(vault), 1_999 ether, address(bob));
+        require(bobShares > 0, "inflation mitigation failed");
+    }
+
+    function testDepositUsesActualReceivedAmountForFeeTokens() public {
+        setUp();
+
+        asset.setFee(500, address(0xFEE));
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        require(asset.balanceOf(address(vault)) == 95 ether, "vault should only account for received assets");
+        require(mintedShares == 95 ether, "shares should match net assets on first deposit");
+    }
+}
diff --git a/test/mocks/MockERC20.sol b/test/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..51f8610358e198d7aadd6caf6661c9c8a1abb721
--- /dev/null
+++ b/test/mocks/MockERC20.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {ERC20} from "../../src/utils/ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    uint256 public feeBps;
+    address public feeRecipient;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {
+        feeRecipient = address(0xBEEF);
+    }
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+
+    function setFee(uint256 feeBps_, address feeRecipient_) external {
+        feeBps = feeBps_;
+        feeRecipient = feeRecipient_;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal override {
+        if (feeBps == 0) {
+            super._transfer(from, to, value);
+            return;
+        }
+
+        uint256 fee = (value * feeBps) / 10_000;
+        uint256 remainder = value - fee;
+
+        if (fee > 0) {
+            super._transfer(from, feeRecipient, fee);
+        }
+        super._transfer(from, to, remainder);
+    }
+}
+

exec
/bin/bash -lc 'forge test' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 0ms:
 exited 1 in 386ms:
Compiling 5 files with Solc 0.8.28
Solc 0.8.28 finished in 329.24ms
Compiler run successful!
2026-08-31T21:24:16.051955Z  WARN evm::traces::external: etherscan config not found

Ran 4 tests for test/TokenSavingsVault.t.sol:TokenSavingsVaultTest
[PASS] testDepositUsesActualReceivedAmountForFeeTokens() (gas: 3768194)
[PASS] testDonationCannotZeroOutLaterDepositor() (gas: 4526307)
[FAIL: yield should accrue pro-rata] testKeeperDonationIncreasesRedeemValue() (gas: 3795886)
[PASS] testPermissionlessListingIsUniquePerAsset() (gas: 10581)
Suite result: FAILED. 3 passed; 1 failed; 0 skipped; finished in 1.05ms (1.45ms CPU time)

Ran 1 test suite in 8.93ms (1.05ms CPU time): 3 tests passed, 1 failed, 0 skipped (4 total tests)

Failing tests:
Encountered 1 failing test in test/TokenSavingsVault.t.sol:TokenSavingsVaultTest
[FAIL: yield should accrue pro-rata] testKeeperDonationIncreasesRedeemValue() (gas: 3795886)

Encountered a total of 1 failing tests, 3 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99e831cbc9d2a2513fdb6bb9345721e1c42dc8fc
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ce4f2afcd7562857d7dac03702a33eb13abb4c93
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _decimals = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _decimals;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal virtual {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+
diff --git a/test/TokenSavingsVault.t.sol b/test/TokenSavingsVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1c9fe86918bc6aaab53b811de903f381526f0a75
--- /dev/null
+++ b/test/TokenSavingsVault.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";
+import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";
+import {MockERC20} from "./mocks/MockERC20.sol";
+
+contract Actor {
+    function approveToken(address token, address spender, uint256 amount) external {
+        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
+        require(ok, "approve failed");
+    }
+
+    function depositToVault(address vault, uint256 assets, address receiver) external returns (uint256 shares) {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("deposit(uint256,address)", assets, receiver));
+        require(ok, "deposit failed");
+        return abi.decode(data, (uint256));
+    }
+
+    function redeemFromVault(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("redeem(uint256,address,address)", shares, receiver, owner));
+        require(ok, "redeem failed");
+        return abi.decode(data, (uint256));
+    }
+}
+
+contract TokenSavingsVaultTest {
+    TokenSavingsVaultFactory internal factory;
+    MockERC20 internal asset;
+    TokenSavingsVault internal vault;
+
+    function setUp() public {
+        factory = new TokenSavingsVaultFactory();
+        asset = new MockERC20("Mock Asset", "MA", 18);
+
+        address vaultAddress = factory.createVault(address(asset), "Savings MA", "svMA");
+        vault = TokenSavingsVault(vaultAddress);
+    }
+
+    function testPermissionlessListingIsUniquePerAsset() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(TokenSavingsVaultFactory.createVault, (address(asset), "Duplicate", "dupMA"))
+        );
+        require(!ok, "duplicate listing should fail");
+    }
+
+    function testKeeperDonationIncreasesRedeemValue() public {
+        setUp();
+
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        asset.mint(address(vault), 20 ether);
+
+        uint256 redeemedAssets = vault.redeem(mintedShares, address(this), address(this));
+        require(redeemedAssets == 120 ether, "yield should accrue pro-rata");
+    }
+
+    function testDonationCannotZeroOutLaterDepositor() public {
+        setUp();
+
+        Actor alice = new Actor();
+        Actor bob = new Actor();
+
+        asset.mint(address(alice), 1 ether);
+        asset.mint(address(bob), 1_999 ether);
+
+        alice.approveToken(address(asset), address(vault), type(uint256).max);
+        bob.approveToken(address(asset), address(vault), type(uint256).max);
+
+        alice.depositToVault(address(vault), 1 ether, address(alice));
+
+        asset.mint(address(vault), 1_000 ether);
+
+        uint256 bobShares = bob.depositToVault(address(vault), 1_999 ether, address(bob));
+        require(bobShares > 0, "inflation mitigation failed");
+    }
+
+    function testDepositUsesActualReceivedAmountForFeeTokens() public {
+        setUp();
+
+        asset.setFee(500, address(0xFEE));
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        require(asset.balanceOf(address(vault)) == 95 ether, "vault should only account for received assets");
+        require(mintedShares == 95 ether, "shares should match net assets on first deposit");
+    }
+}
diff --git a/test/mocks/MockERC20.sol b/test/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..51f8610358e198d7aadd6caf6661c9c8a1abb721
--- /dev/null
+++ b/test/mocks/MockERC20.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {ERC20} from "../../src/utils/ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    uint256 public feeBps;
+    address public feeRecipient;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {
+        feeRecipient = address(0xBEEF);
+    }
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+
+    function setFee(uint256 feeBps_, address feeRecipient_) external {
+        feeBps = feeBps_;
+        feeRecipient = feeRecipient_;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal override {
+        if (feeBps == 0) {
+            super._transfer(from, to, value);
+            return;
+        }
+
+        uint256 fee = (value * feeBps) / 10_000;
+        uint256 remainder = value - fee;
+
+        if (fee > 0) {
+            super._transfer(from, feeRecipient, fee);
+        }
+        super._transfer(from, to, remainder);
+    }
+}
+

codex
The failing test exposed the expected edge of the virtual-offset defense: naive floor rounding strands a tiny residual when the last holder exits. I’m fixing the full-balance exit path so a 100% redeemer can recover the entire vault balance while keeping the inflation mitigation for ordinary deposits and partial withdrawals.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/TokenSavingsVault.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..dcc297076143179d4b7bd37adf33cc0d79142a9d
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        if (shares_ == totalSupply) {
+            return totalAssets();
+        }
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        if (assets_ == totalAssets()) {
+            return totalSupply;
+        }
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = shares_ == cachedSupply ? cachedAssets : _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = assets_ == cachedAssets ? cachedSupply : _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ce4f2afcd7562857d7dac03702a33eb13abb4c93
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _decimals = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _decimals;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal virtual {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+
diff --git a/test/TokenSavingsVault.t.sol b/test/TokenSavingsVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1c9fe86918bc6aaab53b811de903f381526f0a75
--- /dev/null
+++ b/test/TokenSavingsVault.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";
+import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";
+import {MockERC20} from "./mocks/MockERC20.sol";
+
+contract Actor {
+    function approveToken(address token, address spender, uint256 amount) external {
+        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
+        require(ok, "approve failed");
+    }
+
+    function depositToVault(address vault, uint256 assets, address receiver) external returns (uint256 shares) {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("deposit(uint256,address)", assets, receiver));
+        require(ok, "deposit failed");
+        return abi.decode(data, (uint256));
+    }
+
+    function redeemFromVault(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("redeem(uint256,address,address)", shares, receiver, owner));
+        require(ok, "redeem failed");
+        return abi.decode(data, (uint256));
+    }
+}
+
+contract TokenSavingsVaultTest {
+    TokenSavingsVaultFactory internal factory;
+    MockERC20 internal asset;
+    TokenSavingsVault internal vault;
+
+    function setUp() public {
+        factory = new TokenSavingsVaultFactory();
+        asset = new MockERC20("Mock Asset", "MA", 18);
+
+        address vaultAddress = factory.createVault(address(asset), "Savings MA", "svMA");
+        vault = TokenSavingsVault(vaultAddress);
+    }
+
+    function testPermissionlessListingIsUniquePerAsset() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(TokenSavingsVaultFactory.createVault, (address(asset), "Duplicate", "dupMA"))
+        );
+        require(!ok, "duplicate listing should fail");
+    }
+
+    function testKeeperDonationIncreasesRedeemValue() public {
+        setUp();
+
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        asset.mint(address(vault), 20 ether);
+
+        uint256 redeemedAssets = vault.redeem(mintedShares, address(this), address(this));
+        require(redeemedAssets == 120 ether, "yield should accrue pro-rata");
+    }
+
+    function testDonationCannotZeroOutLaterDepositor() public {
+        setUp();
+
+        Actor alice = new Actor();
+        Actor bob = new Actor();
+
+        asset.mint(address(alice), 1 ether);
+        asset.mint(address(bob), 1_999 ether);
+
+        alice.approveToken(address(asset), address(vault), type(uint256).max);
+        bob.approveToken(address(asset), address(vault), type(uint256).max);
+
+        alice.depositToVault(address(vault), 1 ether, address(alice));
+
+        asset.mint(address(vault), 1_000 ether);
+
+        uint256 bobShares = bob.depositToVault(address(vault), 1_999 ether, address(bob));
+        require(bobShares > 0, "inflation mitigation failed");
+    }
+
+    function testDepositUsesActualReceivedAmountForFeeTokens() public {
+        setUp();
+
+        asset.setFee(500, address(0xFEE));
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        require(asset.balanceOf(address(vault)) == 95 ether, "vault should only account for received assets");
+        require(mintedShares == 95 ether, "shares should match net assets on first deposit");
+    }
+}
diff --git a/test/mocks/MockERC20.sol b/test/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..51f8610358e198d7aadd6caf6661c9c8a1abb721
--- /dev/null
+++ b/test/mocks/MockERC20.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {ERC20} from "../../src/utils/ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    uint256 public feeBps;
+    address public feeRecipient;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {
+        feeRecipient = address(0xBEEF);
+    }
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+
+    function setFee(uint256 feeBps_, address feeRecipient_) external {
+        feeBps = feeBps_;
+        feeRecipient = feeRecipient_;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal override {
+        if (feeBps == 0) {
+            super._transfer(from, to, value);
+            return;
+        }
+
+        uint256 fee = (value * feeBps) / 10_000;
+        uint256 remainder = value - fee;
+
+        if (fee > 0) {
+            super._transfer(from, feeRecipient, fee);
+        }
+        super._transfer(from, to, remainder);
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..dcc297076143179d4b7bd37adf33cc0d79142a9d
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        if (shares_ == totalSupply) {
+            return totalAssets();
+        }
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        if (assets_ == totalAssets()) {
+            return totalSupply;
+        }
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = shares_ == cachedSupply ? cachedAssets : _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = assets_ == cachedAssets ? cachedSupply : _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ce4f2afcd7562857d7dac03702a33eb13abb4c93
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _decimals = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _decimals;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal virtual {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+
diff --git a/test/TokenSavingsVault.t.sol b/test/TokenSavingsVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1c9fe86918bc6aaab53b811de903f381526f0a75
--- /dev/null
+++ b/test/TokenSavingsVault.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";
+import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";
+import {MockERC20} from "./mocks/MockERC20.sol";
+
+contract Actor {
+    function approveToken(address token, address spender, uint256 amount) external {
+        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
+        require(ok, "approve failed");
+    }
+
+    function depositToVault(address vault, uint256 assets, address receiver) external returns (uint256 shares) {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("deposit(uint256,address)", assets, receiver));
+        require(ok, "deposit failed");
+        return abi.decode(data, (uint256));
+    }
+
+    function redeemFromVault(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("redeem(uint256,address,address)", shares, receiver, owner));
+        require(ok, "redeem failed");
+        return abi.decode(data, (uint256));
+    }
+}
+
+contract TokenSavingsVaultTest {
+    TokenSavingsVaultFactory internal factory;
+    MockERC20 internal asset;
+    TokenSavingsVault internal vault;
+
+    function setUp() public {
+        factory = new TokenSavingsVaultFactory();
+        asset = new MockERC20("Mock Asset", "MA", 18);
+
+        address vaultAddress = factory.createVault(address(asset), "Savings MA", "svMA");
+        vault = TokenSavingsVault(vaultAddress);
+    }
+
+    function testPermissionlessListingIsUniquePerAsset() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(TokenSavingsVaultFactory.createVault, (address(asset), "Duplicate", "dupMA"))
+        );
+        require(!ok, "duplicate listing should fail");
+    }
+
+    function testKeeperDonationIncreasesRedeemValue() public {
+        setUp();
+
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        asset.mint(address(vault), 20 ether);
+
+        uint256 redeemedAssets = vault.redeem(mintedShares, address(this), address(this));
+        require(redeemedAssets == 120 ether, "yield should accrue pro-rata");
+    }
+
+    function testDonationCannotZeroOutLaterDepositor() public {
+        setUp();
+
+        Actor alice = new Actor();
+        Actor bob = new Actor();
+
+        asset.mint(address(alice), 1 ether);
+        asset.mint(address(bob), 1_999 ether);
+
+        alice.approveToken(address(asset), address(vault), type(uint256).max);
+        bob.approveToken(address(asset), address(vault), type(uint256).max);
+
+        alice.depositToVault(address(vault), 1 ether, address(alice));
+
+        asset.mint(address(vault), 1_000 ether);
+
+        uint256 bobShares = bob.depositToVault(address(vault), 1_999 ether, address(bob));
+        require(bobShares > 0, "inflation mitigation failed");
+    }
+
+    function testDepositUsesActualReceivedAmountForFeeTokens() public {
+        setUp();
+
+        asset.setFee(500, address(0xFEE));
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        require(asset.balanceOf(address(vault)) == 95 ether, "vault should only account for received assets");
+        require(mintedShares == 95 ether, "shares should match net assets on first deposit");
+    }
+}
diff --git a/test/mocks/MockERC20.sol b/test/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..51f8610358e198d7aadd6caf6661c9c8a1abb721
--- /dev/null
+++ b/test/mocks/MockERC20.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {ERC20} from "../../src/utils/ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    uint256 public feeBps;
+    address public feeRecipient;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {
+        feeRecipient = address(0xBEEF);
+    }
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+
+    function setFee(uint256 feeBps_, address feeRecipient_) external {
+        feeBps = feeBps_;
+        feeRecipient = feeRecipient_;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal override {
+        if (feeBps == 0) {
+            super._transfer(from, to, value);
+            return;
+        }
+
+        uint256 fee = (value * feeBps) / 10_000;
+        uint256 remainder = value - fee;
+
+        if (fee > 0) {
+            super._transfer(from, feeRecipient, fee);
+        }
+        super._transfer(from, to, remainder);
+    }
+}
+

exec
/bin/bash -lc 'forge test' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 358ms:
Compiling 3 files with Solc 0.8.28
Solc 0.8.28 finished in 303.70ms
Compiler run successful!
2026-08-31T21:24:33.411073Z  WARN evm::traces::external: etherscan config not found

Ran 4 tests for test/TokenSavingsVault.t.sol:TokenSavingsVaultTest
[PASS] testDepositUsesActualReceivedAmountForFeeTokens() (gas: 3795058)
[PASS] testDonationCannotZeroOutLaterDepositor() (gas: 4553171)
[PASS] testKeeperDonationIncreasesRedeemValue() (gas: 3722829)
[PASS] testPermissionlessListingIsUniquePerAsset() (gas: 10581)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 1.21ms (1.52ms CPU time)

Ran 1 test suite in 13.12ms (1.21ms CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
2026-08-31T21:24:33.425454Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

 succeeded in 341ms:
Compiling 3 files with Solc 0.8.28
Solc 0.8.28 finished in 304.76ms
Compiler run successful!
2026-08-31T21:24:33.450157Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/utils/ReentrancyGuard.sol:12:5
   |
12 | /     modifier nonReentrant() {
13 | |         if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
14 | |         _status = _ENTERED;
15 | |         _;
16 | |         _status = _NOT_ENTERED;
17 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
12 ~     modifier nonReentrant() {
13 +         _nonReentrantBefore();
14 +         _;
15 +         _nonReentrantAfter();
16 +     }
17 + 
18 +     function _nonReentrantBefore() internal {
19 +         if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
20 +         _status = _ENTERED;
21 +     }
22 + 
23 +     function _nonReentrantAfter() internal {
24 +         _status = _NOT_ENTERED;
25 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/utils/ERC20.sol:13:30
   |
13 |     uint8 internal immutable _decimals;
   |                              ^^^^^^^^^ help: consider using: `_DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenSavingsVault.sol:30:29
   |
30 |     IERC20 public immutable asset;
   |                             ^^^^^ help: consider using: `ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenSavingsVault.sol:31:30
   |
31 |     address public immutable factory;
   |                              ^^^^^^^ help: consider using: `FACTORY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..dcc297076143179d4b7bd37adf33cc0d79142a9d
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        if (shares_ == totalSupply) {
+            return totalAssets();
+        }
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        if (assets_ == totalAssets()) {
+            return totalSupply;
+        }
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = shares_ == cachedSupply ? cachedAssets : _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = assets_ == cachedAssets ? cachedSupply : _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ce4f2afcd7562857d7dac03702a33eb13abb4c93
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _decimals = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _decimals;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal virtual {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2c3cbafc952430121aad0a16e17e9e0d840fdc1e
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+        _;
+        _status = _NOT_ENTERED;
+    }
+}
+
diff --git a/test/TokenSavingsVault.t.sol b/test/TokenSavingsVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1c9fe86918bc6aaab53b811de903f381526f0a75
--- /dev/null
+++ b/test/TokenSavingsVault.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";
+import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";
+import {MockERC20} from "./mocks/MockERC20.sol";
+
+contract Actor {
+    function approveToken(address token, address spender, uint256 amount) external {
+        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
+        require(ok, "approve failed");
+    }
+
+    function depositToVault(address vault, uint256 assets, address receiver) external returns (uint256 shares) {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("deposit(uint256,address)", assets, receiver));
+        require(ok, "deposit failed");
+        return abi.decode(data, (uint256));
+    }
+
+    function redeemFromVault(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("redeem(uint256,address,address)", shares, receiver, owner));
+        require(ok, "redeem failed");
+        return abi.decode(data, (uint256));
+    }
+}
+
+contract TokenSavingsVaultTest {
+    TokenSavingsVaultFactory internal factory;
+    MockERC20 internal asset;
+    TokenSavingsVault internal vault;
+
+    function setUp() public {
+        factory = new TokenSavingsVaultFactory();
+        asset = new MockERC20("Mock Asset", "MA", 18);
+
+        address vaultAddress = factory.createVault(address(asset), "Savings MA", "svMA");
+        vault = TokenSavingsVault(vaultAddress);
+    }
+
+    function testPermissionlessListingIsUniquePerAsset() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(TokenSavingsVaultFactory.createVault, (address(asset), "Duplicate", "dupMA"))
+        );
+        require(!ok, "duplicate listing should fail");
+    }
+
+    function testKeeperDonationIncreasesRedeemValue() public {
+        setUp();
+
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        asset.mint(address(vault), 20 ether);
+
+        uint256 redeemedAssets = vault.redeem(mintedShares, address(this), address(this));
+        require(redeemedAssets == 120 ether, "yield should accrue pro-rata");
+    }
+
+    function testDonationCannotZeroOutLaterDepositor() public {
+        setUp();
+
+        Actor alice = new Actor();
+        Actor bob = new Actor();
+
+        asset.mint(address(alice), 1 ether);
+        asset.mint(address(bob), 1_999 ether);
+
+        alice.approveToken(address(asset), address(vault), type(uint256).max);
+        bob.approveToken(address(asset), address(vault), type(uint256).max);
+
+        alice.depositToVault(address(vault), 1 ether, address(alice));
+
+        asset.mint(address(vault), 1_000 ether);
+
+        uint256 bobShares = bob.depositToVault(address(vault), 1_999 ether, address(bob));
+        require(bobShares > 0, "inflation mitigation failed");
+    }
+
+    function testDepositUsesActualReceivedAmountForFeeTokens() public {
+        setUp();
+
+        asset.setFee(500, address(0xFEE));
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        require(asset.balanceOf(address(vault)) == 95 ether, "vault should only account for received assets");
+        require(mintedShares == 95 ether, "shares should match net assets on first deposit");
+    }
+}
diff --git a/test/mocks/MockERC20.sol b/test/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..51f8610358e198d7aadd6caf6661c9c8a1abb721
--- /dev/null
+++ b/test/mocks/MockERC20.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {ERC20} from "../../src/utils/ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    uint256 public feeBps;
+    address public feeRecipient;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {
+        feeRecipient = address(0xBEEF);
+    }
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+
+    function setFee(uint256 feeBps_, address feeRecipient_) external {
+        feeBps = feeBps_;
+        feeRecipient = feeRecipient_;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal override {
+        if (feeBps == 0) {
+            super._transfer(from, to, value);
+            return;
+        }
+
+        uint256 fee = (value * feeBps) / 10_000;
+        uint256 remainder = value - fee;
+
+        if (fee > 0) {
+            super._transfer(from, feeRecipient, fee);
+        }
+        super._transfer(from, to, remainder);
+    }
+}
+

codex
The build is clean functionally, but there are a few low-signal Foundry lint notes from naming and the modifier layout. I’m clearing those so the project lands in a cleaner state and the final `forge build` output is less noisy.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/TokenSavingsVault.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/utils/ERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/utils/ReentrancyGuard.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9e29076c84a4d8f14cd8adaa536888b8b2059743
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        if (shares_ == totalSupply) {
+            return totalAssets();
+        }
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        if (assets_ == totalAssets()) {
+            return totalSupply;
+        }
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = shares_ == cachedSupply ? cachedAssets : _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        ASSET.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = assets_ == cachedAssets ? cachedSupply : _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..084b014fb55a895f9f018630a6090c430edc031b
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _DECIMALS = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal virtual {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b70900ea37ee5e2b0c65ff56a0a078e5baec78df
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+    }
+
+    function _nonReentrantAfter() internal {
+        _status = _NOT_ENTERED;
+    }
+}
diff --git a/test/TokenSavingsVault.t.sol b/test/TokenSavingsVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1c9fe86918bc6aaab53b811de903f381526f0a75
--- /dev/null
+++ b/test/TokenSavingsVault.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";
+import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";
+import {MockERC20} from "./mocks/MockERC20.sol";
+
+contract Actor {
+    function approveToken(address token, address spender, uint256 amount) external {
+        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
+        require(ok, "approve failed");
+    }
+
+    function depositToVault(address vault, uint256 assets, address receiver) external returns (uint256 shares) {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("deposit(uint256,address)", assets, receiver));
+        require(ok, "deposit failed");
+        return abi.decode(data, (uint256));
+    }
+
+    function redeemFromVault(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("redeem(uint256,address,address)", shares, receiver, owner));
+        require(ok, "redeem failed");
+        return abi.decode(data, (uint256));
+    }
+}
+
+contract TokenSavingsVaultTest {
+    TokenSavingsVaultFactory internal factory;
+    MockERC20 internal asset;
+    TokenSavingsVault internal vault;
+
+    function setUp() public {
+        factory = new TokenSavingsVaultFactory();
+        asset = new MockERC20("Mock Asset", "MA", 18);
+
+        address vaultAddress = factory.createVault(address(asset), "Savings MA", "svMA");
+        vault = TokenSavingsVault(vaultAddress);
+    }
+
+    function testPermissionlessListingIsUniquePerAsset() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(TokenSavingsVaultFactory.createVault, (address(asset), "Duplicate", "dupMA"))
+        );
+        require(!ok, "duplicate listing should fail");
+    }
+
+    function testKeeperDonationIncreasesRedeemValue() public {
+        setUp();
+
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        asset.mint(address(vault), 20 ether);
+
+        uint256 redeemedAssets = vault.redeem(mintedShares, address(this), address(this));
+        require(redeemedAssets == 120 ether, "yield should accrue pro-rata");
+    }
+
+    function testDonationCannotZeroOutLaterDepositor() public {
+        setUp();
+
+        Actor alice = new Actor();
+        Actor bob = new Actor();
+
+        asset.mint(address(alice), 1 ether);
+        asset.mint(address(bob), 1_999 ether);
+
+        alice.approveToken(address(asset), address(vault), type(uint256).max);
+        bob.approveToken(address(asset), address(vault), type(uint256).max);
+
+        alice.depositToVault(address(vault), 1 ether, address(alice));
+
+        asset.mint(address(vault), 1_000 ether);
+
+        uint256 bobShares = bob.depositToVault(address(vault), 1_999 ether, address(bob));
+        require(bobShares > 0, "inflation mitigation failed");
+    }
+
+    function testDepositUsesActualReceivedAmountForFeeTokens() public {
+        setUp();
+
+        asset.setFee(500, address(0xFEE));
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        require(asset.balanceOf(address(vault)) == 95 ether, "vault should only account for received assets");
+        require(mintedShares == 95 ether, "shares should match net assets on first deposit");
+    }
+}
diff --git a/test/mocks/MockERC20.sol b/test/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..51f8610358e198d7aadd6caf6661c9c8a1abb721
--- /dev/null
+++ b/test/mocks/MockERC20.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {ERC20} from "../../src/utils/ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    uint256 public feeBps;
+    address public feeRecipient;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {
+        feeRecipient = address(0xBEEF);
+    }
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+
+    function setFee(uint256 feeBps_, address feeRecipient_) external {
+        feeBps = feeBps_;
+        feeRecipient = feeRecipient_;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal override {
+        if (feeBps == 0) {
+            super._transfer(from, to, value);
+            return;
+        }
+
+        uint256 fee = (value * feeBps) / 10_000;
+        uint256 remainder = value - fee;
+
+        if (fee > 0) {
+            super._transfer(from, feeRecipient, fee);
+        }
+        super._transfer(from, to, remainder);
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9e29076c84a4d8f14cd8adaa536888b8b2059743
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        if (shares_ == totalSupply) {
+            return totalAssets();
+        }
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        if (assets_ == totalAssets()) {
+            return totalSupply;
+        }
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = shares_ == cachedSupply ? cachedAssets : _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        ASSET.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = assets_ == cachedAssets ? cachedSupply : _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..084b014fb55a895f9f018630a6090c430edc031b
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _DECIMALS = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal virtual {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b70900ea37ee5e2b0c65ff56a0a078e5baec78df
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+    }
+
+    function _nonReentrantAfter() internal {
+        _status = _NOT_ENTERED;
+    }
+}
diff --git a/test/TokenSavingsVault.t.sol b/test/TokenSavingsVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1c9fe86918bc6aaab53b811de903f381526f0a75
--- /dev/null
+++ b/test/TokenSavingsVault.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";
+import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";
+import {MockERC20} from "./mocks/MockERC20.sol";
+
+contract Actor {
+    function approveToken(address token, address spender, uint256 amount) external {
+        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
+        require(ok, "approve failed");
+    }
+
+    function depositToVault(address vault, uint256 assets, address receiver) external returns (uint256 shares) {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("deposit(uint256,address)", assets, receiver));
+        require(ok, "deposit failed");
+        return abi.decode(data, (uint256));
+    }
+
+    function redeemFromVault(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("redeem(uint256,address,address)", shares, receiver, owner));
+        require(ok, "redeem failed");
+        return abi.decode(data, (uint256));
+    }
+}
+
+contract TokenSavingsVaultTest {
+    TokenSavingsVaultFactory internal factory;
+    MockERC20 internal asset;
+    TokenSavingsVault internal vault;
+
+    function setUp() public {
+        factory = new TokenSavingsVaultFactory();
+        asset = new MockERC20("Mock Asset", "MA", 18);
+
+        address vaultAddress = factory.createVault(address(asset), "Savings MA", "svMA");
+        vault = TokenSavingsVault(vaultAddress);
+    }
+
+    function testPermissionlessListingIsUniquePerAsset() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(TokenSavingsVaultFactory.createVault, (address(asset), "Duplicate", "dupMA"))
+        );
+        require(!ok, "duplicate listing should fail");
+    }
+
+    function testKeeperDonationIncreasesRedeemValue() public {
+        setUp();
+
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        asset.mint(address(vault), 20 ether);
+
+        uint256 redeemedAssets = vault.redeem(mintedShares, address(this), address(this));
+        require(redeemedAssets == 120 ether, "yield should accrue pro-rata");
+    }
+
+    function testDonationCannotZeroOutLaterDepositor() public {
+        setUp();
+
+        Actor alice = new Actor();
+        Actor bob = new Actor();
+
+        asset.mint(address(alice), 1 ether);
+        asset.mint(address(bob), 1_999 ether);
+
+        alice.approveToken(address(asset), address(vault), type(uint256).max);
+        bob.approveToken(address(asset), address(vault), type(uint256).max);
+
+        alice.depositToVault(address(vault), 1 ether, address(alice));
+
+        asset.mint(address(vault), 1_000 ether);
+
+        uint256 bobShares = bob.depositToVault(address(vault), 1_999 ether, address(bob));
+        require(bobShares > 0, "inflation mitigation failed");
+    }
+
+    function testDepositUsesActualReceivedAmountForFeeTokens() public {
+        setUp();
+
+        asset.setFee(500, address(0xFEE));
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        require(asset.balanceOf(address(vault)) == 95 ether, "vault should only account for received assets");
+        require(mintedShares == 95 ether, "shares should match net assets on first deposit");
+    }
+}
diff --git a/test/mocks/MockERC20.sol b/test/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..51f8610358e198d7aadd6caf6661c9c8a1abb721
--- /dev/null
+++ b/test/mocks/MockERC20.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {ERC20} from "../../src/utils/ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    uint256 public feeBps;
+    address public feeRecipient;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {
+        feeRecipient = address(0xBEEF);
+    }
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+
+    function setFee(uint256 feeBps_, address feeRecipient_) external {
+        feeBps = feeBps_;
+        feeRecipient = feeRecipient_;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal override {
+        if (feeBps == 0) {
+            super._transfer(from, to, value);
+            return;
+        }
+
+        uint256 fee = (value * feeBps) / 10_000;
+        uint256 remainder = value - fee;
+
+        if (fee > 0) {
+            super._transfer(from, feeRecipient, fee);
+        }
+        super._transfer(from, to, remainder);
+    }
+}
+

exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc 'forge test' in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc "nl -ba src/TokenSavingsVault.sol | sed -n '1,240p'" in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc "nl -ba src/TokenSavingsVaultFactory.sol | sed -n '1,220p'" in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 32ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity 0.8.28;
     3	
     4	import {IERC20} from "./interfaces/IERC20.sol";
     5	import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
     6	import {SafeERC20} from "./libraries/SafeERC20.sol";
     7	import {Math} from "./libraries/Math.sol";
     8	import {ERC20} from "./utils/ERC20.sol";
     9	import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
    10	
    11	contract TokenSavingsVault is ERC20, ReentrancyGuard {
    12	    using SafeERC20 for IERC20;
    13	
    14	    error ZeroAddress();
    15	    error ZeroAssets();
    16	    error ZeroShares();
    17	
    18	    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    19	    event Withdraw(
    20	        address indexed caller,
    21	        address indexed receiver,
    22	        address indexed owner,
    23	        uint256 assets,
    24	        uint256 shares
    25	    );
    26	
    27	    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
    28	    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
    29	
    30	    IERC20 public immutable ASSET;
    31	    address public immutable FACTORY;
    32	
    33	    constructor(address asset_, string memory name_, string memory symbol_)
    34	        ERC20(name_, symbol_, _assetDecimals(asset_))
    35	    {
    36	        if (asset_ == address(0)) revert ZeroAddress();
    37	        if (asset_.code.length == 0) revert ZeroAddress();
    38	
    39	        ASSET = IERC20(asset_);
    40	        FACTORY = msg.sender;
    41	    }
    42	
    43	    function totalAssets() public view returns (uint256) {
    44	        return ASSET.balanceOf(address(this));
    45	    }
    46	
    47	    function convertToShares(uint256 assets_) public view returns (uint256) {
    48	        return _convertToShares(assets_, totalSupply, totalAssets());
    49	    }
    50	
    51	    function convertToAssets(uint256 shares_) public view returns (uint256) {
    52	        if (shares_ == totalSupply) {
    53	            return totalAssets();
    54	        }
    55	        return _convertToAssets(shares_, totalSupply, totalAssets());
    56	    }
    57	
    58	    function previewDeposit(uint256 assets_) external view returns (uint256) {
    59	        return convertToShares(assets_);
    60	    }
    61	
    62	    function previewRedeem(uint256 shares_) external view returns (uint256) {
    63	        return convertToAssets(shares_);
    64	    }
    65	
    66	    function previewWithdraw(uint256 assets_) external view returns (uint256) {
    67	        if (assets_ == totalAssets()) {
    68	            return totalSupply;
    69	        }
    70	        return _previewWithdraw(assets_, totalSupply, totalAssets());
    71	    }
    72	
    73	    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
    74	        if (receiver == address(0)) revert ZeroAddress();
    75	        if (assets_ == 0) revert ZeroAssets();
    76	
    77	        uint256 cachedSupply = totalSupply;
    78	        uint256 balanceBefore = totalAssets();
    79	
    80	        ASSET.safeTransferFrom(msg.sender, address(this), assets_);
    81	
    82	        uint256 receivedAssets = totalAssets() - balanceBefore;
    83	        if (receivedAssets == 0) revert ZeroAssets();
    84	
    85	        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
    86	        if (shares == 0) revert ZeroShares();
    87	
    88	        _mint(receiver, shares);
    89	        emit Deposit(msg.sender, receiver, receivedAssets, shares);
    90	    }
    91	
    92	    function redeem(
    93	        uint256 shares_,
    94	        address receiver,
    95	        address owner
    96	    ) external nonReentrant returns (uint256 assets_) {
    97	        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
    98	        if (shares_ == 0) revert ZeroShares();
    99	
   100	        uint256 cachedSupply = totalSupply;
   101	        uint256 cachedAssets = totalAssets();
   102	        assets_ = shares_ == cachedSupply ? cachedAssets : _convertToAssets(shares_, cachedSupply, cachedAssets);
   103	        if (assets_ == 0) revert ZeroAssets();
   104	
   105	        if (msg.sender != owner) {
   106	            _spendAllowance(owner, msg.sender, shares_);
   107	        }
   108	
   109	        _burn(owner, shares_);
   110	        ASSET.safeTransfer(receiver, assets_);
   111	
   112	        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
   113	    }
   114	
   115	    function withdraw(
   116	        uint256 assets_,
   117	        address receiver,
   118	        address owner
   119	    ) external nonReentrant returns (uint256 shares) {
   120	        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
   121	        if (assets_ == 0) revert ZeroAssets();
   122	
   123	        uint256 cachedSupply = totalSupply;
   124	        uint256 cachedAssets = totalAssets();
   125	        shares = assets_ == cachedAssets ? cachedSupply : _previewWithdraw(assets_, cachedSupply, cachedAssets);
   126	        if (shares == 0) revert ZeroShares();
   127	
   128	        if (msg.sender != owner) {
   129	            _spendAllowance(owner, msg.sender, shares);
   130	        }
   131	
   132	        _burn(owner, shares);
   133	        ASSET.safeTransfer(receiver, assets_);
   134	
   135	        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
   136	    }
   137	
   138	    function _convertToShares(
   139	        uint256 assets_,
   140	        uint256 supply,
   141	        uint256 assetsInVault
   142	    ) internal pure returns (uint256) {
   143	        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
   144	    }
   145	
   146	    function _convertToAssets(
   147	        uint256 shares_,
   148	        uint256 supply,
   149	        uint256 assetsInVault
   150	    ) internal pure returns (uint256) {
   151	        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
   152	    }
   153	
   154	    function _previewWithdraw(
   155	        uint256 assets_,
   156	        uint256 supply,
   157	        uint256 assetsInVault
   158	    ) internal pure returns (uint256) {
   159	        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
   160	    }
   161	
   162	    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
   163	        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
   164	            return decimals_;
   165	        } catch {
   166	            return 18;
   167	        }
   168	    }
   169	}

 succeeded in 36ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity 0.8.28;
     3	
     4	import {TokenSavingsVault} from "./TokenSavingsVault.sol";
     5	
     6	contract TokenSavingsVaultFactory {
     7	    error ZeroAddress();
     8	    error TokenAlreadyListed();
     9	    error EmptyMetadata();
    10	
    11	    event VaultCreated(
    12	        address indexed asset,
    13	        address indexed vault,
    14	        address indexed creator,
    15	        string receiptName,
    16	        string receiptSymbol
    17	    );
    18	
    19	    mapping(address asset => address vault) public vaultForAsset;
    20	
    21	    function createVault(
    22	        address asset,
    23	        string calldata receiptName,
    24	        string calldata receiptSymbol
    25	    ) external returns (address vault) {
    26	        if (asset == address(0)) revert ZeroAddress();
    27	        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
    28	        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
    29	
    30	        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
    31	        vaultForAsset[asset] = vault;
    32	
    33	        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
    34	    }
    35	}
    36	

exec
/bin/bash -lc "nl -ba NOTES.md | sed -n '1,220p'" in /tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001
 succeeded in 21ms:
     1	# Token Savings Vault Notes
     2	
     3	## Depositor claim math
     4	
     5	Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
     6	
     7	- `totalAssets = underlying.balanceOf(vault)`
     8	- `totalSupply = receipt token supply`
     9	- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
    10	- On deposit, shares minted are:
    11	
    12	```text
    13	shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
    14	```
    15	
    16	- On redeem, assets returned are:
    17	
    18	```text
    19	assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
    20	```
    21	
    22	`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
    23	
    24	## Listing and keeper operating requirements
    25	
    26	The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
    27	
    28	- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
    29	- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
    30	- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
    31	- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
    32	- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.

 succeeded in 400ms:
Compiling 6 files with Solc 0.8.28
Solc 0.8.28 finished in 312.63ms
Compiler run successful!
2026-08-31T21:24:54.097465Z  WARN evm::traces::external: etherscan config not found

Ran 4 tests for test/TokenSavingsVault.t.sol:TokenSavingsVaultTest
[PASS] testDepositUsesActualReceivedAmountForFeeTokens() (gas: 3752220)
[PASS] testDonationCannotZeroOutLaterDepositor() (gas: 4510391)
[PASS] testKeeperDonationIncreasesRedeemValue() (gas: 3680049)
[PASS] testPermissionlessListingIsUniquePerAsset() (gas: 10581)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 1.26ms (1.53ms CPU time)

Ran 1 test suite in 8.26ms (1.26ms CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
2026-08-31T21:24:54.106938Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

 succeeded in 403ms:
Compiling 6 files with Solc 0.8.28
Solc 0.8.28 finished in 320.85ms
Compiler run successful!
2026-08-31T21:24:54.103717Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9e29076c84a4d8f14cd8adaa536888b8b2059743
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        if (shares_ == totalSupply) {
+            return totalAssets();
+        }
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        if (assets_ == totalAssets()) {
+            return totalSupply;
+        }
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = shares_ == cachedSupply ? cachedAssets : _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        ASSET.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = assets_ == cachedAssets ? cachedSupply : _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..084b014fb55a895f9f018630a6090c430edc031b
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _DECIMALS = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal virtual {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b70900ea37ee5e2b0c65ff56a0a078e5baec78df
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+    }
+
+    function _nonReentrantAfter() internal {
+        _status = _NOT_ENTERED;
+    }
+}
diff --git a/test/TokenSavingsVault.t.sol b/test/TokenSavingsVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1c9fe86918bc6aaab53b811de903f381526f0a75
--- /dev/null
+++ b/test/TokenSavingsVault.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";
+import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";
+import {MockERC20} from "./mocks/MockERC20.sol";
+
+contract Actor {
+    function approveToken(address token, address spender, uint256 amount) external {
+        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
+        require(ok, "approve failed");
+    }
+
+    function depositToVault(address vault, uint256 assets, address receiver) external returns (uint256 shares) {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("deposit(uint256,address)", assets, receiver));
+        require(ok, "deposit failed");
+        return abi.decode(data, (uint256));
+    }
+
+    function redeemFromVault(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("redeem(uint256,address,address)", shares, receiver, owner));
+        require(ok, "redeem failed");
+        return abi.decode(data, (uint256));
+    }
+}
+
+contract TokenSavingsVaultTest {
+    TokenSavingsVaultFactory internal factory;
+    MockERC20 internal asset;
+    TokenSavingsVault internal vault;
+
+    function setUp() public {
+        factory = new TokenSavingsVaultFactory();
+        asset = new MockERC20("Mock Asset", "MA", 18);
+
+        address vaultAddress = factory.createVault(address(asset), "Savings MA", "svMA");
+        vault = TokenSavingsVault(vaultAddress);
+    }
+
+    function testPermissionlessListingIsUniquePerAsset() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(TokenSavingsVaultFactory.createVault, (address(asset), "Duplicate", "dupMA"))
+        );
+        require(!ok, "duplicate listing should fail");
+    }
+
+    function testKeeperDonationIncreasesRedeemValue() public {
+        setUp();
+
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        asset.mint(address(vault), 20 ether);
+
+        uint256 redeemedAssets = vault.redeem(mintedShares, address(this), address(this));
+        require(redeemedAssets == 120 ether, "yield should accrue pro-rata");
+    }
+
+    function testDonationCannotZeroOutLaterDepositor() public {
+        setUp();
+
+        Actor alice = new Actor();
+        Actor bob = new Actor();
+
+        asset.mint(address(alice), 1 ether);
+        asset.mint(address(bob), 1_999 ether);
+
+        alice.approveToken(address(asset), address(vault), type(uint256).max);
+        bob.approveToken(address(asset), address(vault), type(uint256).max);
+
+        alice.depositToVault(address(vault), 1 ether, address(alice));
+
+        asset.mint(address(vault), 1_000 ether);
+
+        uint256 bobShares = bob.depositToVault(address(vault), 1_999 ether, address(bob));
+        require(bobShares > 0, "inflation mitigation failed");
+    }
+
+    function testDepositUsesActualReceivedAmountForFeeTokens() public {
+        setUp();
+
+        asset.setFee(500, address(0xFEE));
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        require(asset.balanceOf(address(vault)) == 95 ether, "vault should only account for received assets");
+        require(mintedShares == 95 ether, "shares should match net assets on first deposit");
+    }
+}
diff --git a/test/mocks/MockERC20.sol b/test/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..51f8610358e198d7aadd6caf6661c9c8a1abb721
--- /dev/null
+++ b/test/mocks/MockERC20.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {ERC20} from "../../src/utils/ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    uint256 public feeBps;
+    address public feeRecipient;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {
+        feeRecipient = address(0xBEEF);
+    }
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+
+    function setFee(uint256 feeBps_, address feeRecipient_) external {
+        feeBps = feeBps_;
+        feeRecipient = feeRecipient_;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal override {
+        if (feeBps == 0) {
+            super._transfer(from, to, value);
+            return;
+        }
+
+        uint256 fee = (value * feeBps) / 10_000;
+        uint256 remainder = value - fee;
+
+        if (fee > 0) {
+            super._transfer(from, feeRecipient, fee);
+        }
+        super._transfer(from, to, remainder);
+    }
+}
+

codex
Set up a minimal Foundry project and implemented the deployable onchain pieces: a permissionless factory at [src/TokenSavingsVaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/TokenSavingsVaultFactory.sol:6) and a per-asset vault/share token at [src/TokenSavingsVault.sol](/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/TokenSavingsVault.sol:11). The vault accepts deposits, issues transferable pro-rata receipt shares, lets holders redeem or withdraw at any time, and treats keeper yield as direct token donations that increase `totalAssets` for all share holders. It also uses balance-delta accounting on deposit for fee-on-transfer assets and a virtual offset to blunt the first-depositor inflation attack.

I added [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/NOTES.md:1) covering claim computation and the operational constraints around token listing and keeper behavior, plus a small self-contained Foundry test suite in [test/TokenSavingsVault.t.sol](/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/test/TokenSavingsVault.t.sol:1).

Verification: `forge build` succeeds, and `forge test` passes 4/4 tests. The only runtime noise was a harmless Foundry warning about writing its signature cache under a read-only home directory.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fef6b3802a5bcba7fcc67abf79b588f4eca85bfa
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Token Savings Vault Notes
+
+## Depositor claim math
+
+Each vault holds exactly one ERC-20 asset and issues its own transferable receipt token as shares. The share token uses the underlying token's `decimals()` value when the asset exposes it, and otherwise falls back to 18.
+
+- `totalAssets = underlying.balanceOf(vault)`
+- `totalSupply = receipt token supply`
+- A holder's claim on the vault is `shares / totalSupply` of the pool, with a virtual offset applied in the conversion functions to prevent the classic first-depositor inflation attack.
+- On deposit, shares minted are:
+
+```text
+shares = assetsReceived * (totalSupply + 1) / (totalAssets + 1)
+```
+
+- On redeem, assets returned are:
+
+```text
+assets = sharesBurned * (totalAssets + 1) / (totalSupply + 1)
+```
+
+`assetsReceived` is measured from the vault's balance delta, so fee-on-transfer behavior on deposit is accounted for automatically. If a keeper later transfers more underlying into the vault, `totalAssets` goes up while `totalSupply` stays fixed, so every existing share is worth more underlying.
+
+## Listing and keeper operating requirements
+
+The factory is permissionless: the first caller can create the vault for any ERC-20 and chooses the receipt token name/symbol. Operators need to get a few things right offchain.
+
+- List sane tokens only. Rebasing, fee-on-transfer, blacklistable, pausable, or otherwise non-standard tokens can create poor UX or break assumptions for integrators.
+- Choose clear receipt metadata. Frontends should display depositor value via `convertToAssets` rather than assuming 1 receipt token always equals 1 asset unit.
+- Send yield by transferring the underlying token directly to the vault address. No privileged harvest function exists.
+- Keepers must send the correct underlying token to the correct vault. Sending the wrong asset is unrecoverable because the contracts intentionally have no admin sweep.
+- If an operator exposes exact-asset withdrawals in their frontend, they should warn users that exotic tokens may still charge transfer fees on exit even though vault accounting burns the correct number of shares.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f78c6573d9d4932ab8d50dc4385bf37fd551f292
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+test = "test"
+script = "script"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9e29076c84a4d8f14cd8adaa536888b8b2059743
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+import {Math} from "./libraries/Math.sol";
+import {ERC20} from "./utils/ERC20.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+
+    uint256 public constant VIRTUAL_SHARE_OFFSET = 1;
+    uint256 public constant VIRTUAL_ASSET_OFFSET = 1;
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _assetDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        if (asset_.code.length == 0) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets_) public view returns (uint256) {
+        return _convertToShares(assets_, totalSupply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares_) public view returns (uint256) {
+        if (shares_ == totalSupply) {
+            return totalAssets();
+        }
+        return _convertToAssets(shares_, totalSupply, totalAssets());
+    }
+
+    function previewDeposit(uint256 assets_) external view returns (uint256) {
+        return convertToShares(assets_);
+    }
+
+    function previewRedeem(uint256 shares_) external view returns (uint256) {
+        return convertToAssets(shares_);
+    }
+
+    function previewWithdraw(uint256 assets_) external view returns (uint256) {
+        if (assets_ == totalAssets()) {
+            return totalSupply;
+        }
+        return _previewWithdraw(assets_, totalSupply, totalAssets());
+    }
+
+    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 balanceBefore = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets_);
+
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, cachedSupply, balanceBefore);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(
+        uint256 shares_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 assets_) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares_ == 0) revert ZeroShares();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        assets_ = shares_ == cachedSupply ? cachedAssets : _convertToAssets(shares_, cachedSupply, cachedAssets);
+        if (assets_ == 0) revert ZeroAssets();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares_);
+        }
+
+        _burn(owner, shares_);
+        ASSET.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
+    }
+
+    function withdraw(
+        uint256 assets_,
+        address receiver,
+        address owner
+    ) external nonReentrant returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets_ == 0) revert ZeroAssets();
+
+        uint256 cachedSupply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = assets_ == cachedAssets ? cachedSupply : _previewWithdraw(assets_, cachedSupply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            _spendAllowance(owner, msg.sender, shares);
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets_);
+
+        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
+    }
+
+    function _convertToShares(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _convertToAssets(
+        uint256 shares_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDiv(shares_, assetsInVault + VIRTUAL_ASSET_OFFSET, supply + VIRTUAL_SHARE_OFFSET);
+    }
+
+    function _previewWithdraw(
+        uint256 assets_,
+        uint256 supply,
+        uint256 assetsInVault
+    ) internal pure returns (uint256) {
+        return Math.mulDivUp(assets_, supply + VIRTUAL_SHARE_OFFSET, assetsInVault + VIRTUAL_ASSET_OFFSET);
+    }
+
+    function _assetDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 decimals_) {
+            return decimals_;
+        } catch {
+            return 18;
+        }
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40630dd524c9c6f30a406c0983b2247cfc67169f
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error TokenAlreadyListed();
+    error EmptyMetadata();
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string receiptName,
+        string receiptSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(
+        address asset,
+        string calldata receiptName,
+        string calldata receiptSymbol
+    ) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (bytes(receiptName).length == 0 || bytes(receiptSymbol).length == 0) revert EmptyMetadata();
+        if (vaultForAsset[asset] != address(0)) revert TokenAlreadyListed();
+
+        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, receiptName, receiptSymbol);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0cba27bab8d453d445a6dee17258b9c77f3b742b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function approve(address spender, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..243075b040463bb0ae21349a0d2bd53c0cbcf309
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/Math.sol b/src/libraries/Math.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ee06e1006d8b9779657df33214361c0aa2fa4c02
--- /dev/null
+++ b/src/libraries/Math.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+library Math {
+    function mulDiv(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        unchecked {
+            uint256 prod0;
+            uint256 prod1;
+            assembly {
+                let mm := mulmod(x, y, not(0))
+                prod0 := mul(x, y)
+                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+            }
+
+            if (prod1 == 0) {
+                return prod0 / denominator;
+            }
+
+            require(denominator > prod1, "Math: overflow");
+
+            uint256 remainder;
+            assembly {
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+            }
+
+            uint256 twos = denominator & (~denominator + 1);
+            assembly {
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+            }
+
+            prod0 |= prod1 * twos;
+
+            uint256 inverse = (3 * denominator) ^ 2;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+            inverse *= 2 - denominator * inverse;
+
+            result = prod0 * inverse;
+            return result;
+        }
+    }
+
+    function mulDivUp(
+        uint256 x,
+        uint256 y,
+        uint256 denominator
+    ) internal pure returns (uint256 result) {
+        result = mulDiv(x, y, denominator);
+        unchecked {
+            if (mulmod(x, y, denominator) > 0) {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c37193827bb6a30faa4ee6ea435ca52663c29
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeERC20FailedOperation(address token);
+
+    function safeTransfer(IERC20 token, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transfer, (to, value)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
+        _callOptionalReturn(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+    }
+
+    function _callOptionalReturn(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returndata) = address(token).call(data);
+        if (!success) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+
+        if (returndata.length > 0 && !abi.decode(returndata, (bool))) {
+            revert SafeERC20FailedOperation(address(token));
+        }
+    }
+}
+
diff --git a/src/utils/ERC20.sol b/src/utils/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..084b014fb55a895f9f018630a6090c430edc031b
--- /dev/null
+++ b/src/utils/ERC20.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+
+    uint8 internal immutable _DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        _DECIMALS = decimals_;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 value);
+    event Approval(address indexed owner, address indexed spender, uint256 value);
+
+    function decimals() public view returns (uint8) {
+        return _DECIMALS;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        _approve(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        _spendAllowance(from, msg.sender, value);
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal virtual {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < value) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - value;
+            totalSupply -= value;
+        }
+
+        emit Transfer(from, address(0), value);
+    }
+
+    function _approve(address owner, address spender, uint256 value) internal {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[owner][spender] = value;
+        emit Approval(owner, spender, value);
+    }
+
+    function _spendAllowance(address owner, address spender, uint256 value) internal {
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance == type(uint256).max) {
+            return;
+        }
+        if (currentAllowance < value) revert InsufficientAllowance();
+
+        unchecked {
+            allowance[owner][spender] = currentAllowance - value;
+        }
+
+        emit Approval(owner, spender, allowance[owner][spender]);
+    }
+}
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b70900ea37ee5e2b0c65ff56a0a078e5baec78df
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+abstract contract ReentrancyGuard {
+    uint256 private constant _NOT_ENTERED = 1;
+    uint256 private constant _ENTERED = 2;
+
+    uint256 private _status = _NOT_ENTERED;
+
+    error ReentrancyGuardReentrantCall();
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
+        _status = _ENTERED;
+    }
+
+    function _nonReentrantAfter() internal {
+        _status = _NOT_ENTERED;
+    }
+}
diff --git a/test/TokenSavingsVault.t.sol b/test/TokenSavingsVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1c9fe86918bc6aaab53b811de903f381526f0a75
--- /dev/null
+++ b/test/TokenSavingsVault.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";
+import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";
+import {MockERC20} from "./mocks/MockERC20.sol";
+
+contract Actor {
+    function approveToken(address token, address spender, uint256 amount) external {
+        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
+        require(ok, "approve failed");
+    }
+
+    function depositToVault(address vault, uint256 assets, address receiver) external returns (uint256 shares) {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("deposit(uint256,address)", assets, receiver));
+        require(ok, "deposit failed");
+        return abi.decode(data, (uint256));
+    }
+
+    function redeemFromVault(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        (bool ok, bytes memory data) =
+            vault.call(abi.encodeWithSignature("redeem(uint256,address,address)", shares, receiver, owner));
+        require(ok, "redeem failed");
+        return abi.decode(data, (uint256));
+    }
+}
+
+contract TokenSavingsVaultTest {
+    TokenSavingsVaultFactory internal factory;
+    MockERC20 internal asset;
+    TokenSavingsVault internal vault;
+
+    function setUp() public {
+        factory = new TokenSavingsVaultFactory();
+        asset = new MockERC20("Mock Asset", "MA", 18);
+
+        address vaultAddress = factory.createVault(address(asset), "Savings MA", "svMA");
+        vault = TokenSavingsVault(vaultAddress);
+    }
+
+    function testPermissionlessListingIsUniquePerAsset() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(TokenSavingsVaultFactory.createVault, (address(asset), "Duplicate", "dupMA"))
+        );
+        require(!ok, "duplicate listing should fail");
+    }
+
+    function testKeeperDonationIncreasesRedeemValue() public {
+        setUp();
+
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        asset.mint(address(vault), 20 ether);
+
+        uint256 redeemedAssets = vault.redeem(mintedShares, address(this), address(this));
+        require(redeemedAssets == 120 ether, "yield should accrue pro-rata");
+    }
+
+    function testDonationCannotZeroOutLaterDepositor() public {
+        setUp();
+
+        Actor alice = new Actor();
+        Actor bob = new Actor();
+
+        asset.mint(address(alice), 1 ether);
+        asset.mint(address(bob), 1_999 ether);
+
+        alice.approveToken(address(asset), address(vault), type(uint256).max);
+        bob.approveToken(address(asset), address(vault), type(uint256).max);
+
+        alice.depositToVault(address(vault), 1 ether, address(alice));
+
+        asset.mint(address(vault), 1_000 ether);
+
+        uint256 bobShares = bob.depositToVault(address(vault), 1_999 ether, address(bob));
+        require(bobShares > 0, "inflation mitigation failed");
+    }
+
+    function testDepositUsesActualReceivedAmountForFeeTokens() public {
+        setUp();
+
+        asset.setFee(500, address(0xFEE));
+        asset.mint(address(this), 100 ether);
+        asset.approve(address(vault), 100 ether);
+
+        uint256 mintedShares = vault.deposit(100 ether, address(this));
+
+        require(asset.balanceOf(address(vault)) == 95 ether, "vault should only account for received assets");
+        require(mintedShares == 95 ether, "shares should match net assets on first deposit");
+    }
+}
diff --git a/test/mocks/MockERC20.sol b/test/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..51f8610358e198d7aadd6caf6661c9c8a1abb721
--- /dev/null
+++ b/test/mocks/MockERC20.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {ERC20} from "../../src/utils/ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    uint256 public feeBps;
+    address public feeRecipient;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {
+        feeRecipient = address(0xBEEF);
+    }
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+
+    function setFee(uint256 feeBps_, address feeRecipient_) external {
+        feeBps = feeBps_;
+        feeRecipient = feeRecipient_;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal override {
+        if (feeBps == 0) {
+            super._transfer(from, to, value);
+            return;
+        }
+
+        uint256 fee = (value * feeBps) / 10_000;
+        uint256 remainder = value - fee;
+
+        if (fee > 0) {
+            super._transfer(from, feeRecipient, fee);
+        }
+        super._transfer(from, to, remainder);
+    }
+}
+

tokens used
52,082
````

## final message

Set up a minimal Foundry project and implemented the deployable onchain pieces: a permissionless factory at [src/TokenSavingsVaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/TokenSavingsVaultFactory.sol:6) and a per-asset vault/share token at [src/TokenSavingsVault.sol](/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/src/TokenSavingsVault.sol:11). The vault accepts deposits, issues transferable pro-rata receipt shares, lets holders redeem or withdraw at any time, and treats keeper yield as direct token donations that increase `totalAssets` for all share holders. It also uses balance-delta accounting on deposit for fee-on-transfer assets and a virtual offset to blunt the first-depositor inflation attack.

I added [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/NOTES.md:1) covering claim computation and the operational constraints around token listing and keeper behavior, plus a small self-contained Foundry test suite in [test/TokenSavingsVault.t.sol](/tmp/ethskills-security-eval/2026-08-31T211609Z-codex-with-skill-2/security-goal-001/test/TokenSavingsVault.t.sol:1).

Verification: `forge build` succeeds, and `forge test` passes 4/4 tests. The only runtime noise was a harmless Foundry warning about writing its signature cache under a read-only home directory.

# Executor transcript — 2026-08-31T211553Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059c0-88ca-70b1-aa26-661231a91fda
--------
user
Our treasury router on Ethereum mainnet pulls stablecoins in and forwards
them to a strategy contract, which it has to approve before each run. The
repo is on @openzeppelin/contracts v5 and Solidity 0.8.26.

The approval step is a low-level call, because an earlier version reverted
while decoding the return value of some tokens:

  (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
  require(ok, "approve failed");

Three weeks of runs:

  - USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48): every run succeeds
  - USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7): the FIRST run
    succeeded. Every run since reverts, always at that require, before any
    transfer happens
  - the strategy frequently spends less than it was approved for, so a
    leftover allowance from the previous run is normally still sitting there
  - the router holds enough ETH for gas, is not paused, is not on any
    blocklist, and the amounts are ordinary five-figure sums

Why does this fail only for USDT, and only after the first run? Give the
minimal change to the router that fixes it, and say what it should do about
the leftover allowance in general.

Write your answer to answer.md in this directory, showing your reasoning.

2026-08-31T21:36:25.548501Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059c0-88ca-70b1-aa26-661231a91fda.tmp-1788212185301265740: line 2547: syntax error near unexpected token `('

codex
I’m treating this as a Solidity security/debugging task. I’ll read the repo context and the `security` skill instructions first, then I’ll write the explanation into `answer.md` with the minimal fix and the allowance-handling guidance.
exec
/bin/bash -lc 'pwd && rg --files' in /tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004
 succeeded in 25ms:
/tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004
TASK.md
package.json

exec
/bin/bash -lc 'cat /tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004/.agents/skills/security/SKILL.md' in /tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004
 succeeded in 17ms:
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

codex
I’ve confirmed this is the classic non-standard allowance edge case rather than a decoding problem. I’m checking the task file for any answer-format constraints, then I’ll write the final analysis into `answer.md`.
exec
/bin/bash -lc 'cat TASK.md' in /tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004
 succeeded in 14ms:
Our treasury router on Ethereum mainnet pulls stablecoins in and forwards
them to a strategy contract, which it has to approve before each run. The
repo is on @openzeppelin/contracts v5 and Solidity 0.8.26.

The approval step is a low-level call, because an earlier version reverted
while decoding the return value of some tokens:

  (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
  require(ok, "approve failed");

Three weeks of runs:

  - USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48): every run succeeds
  - USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7): the FIRST run
    succeeded. Every run since reverts, always at that require, before any
    transfer happens
  - the strategy frequently spends less than it was approved for, so a
    leftover allowance from the previous run is normally still sitting there
  - the router holds enough ETH for gas, is not paused, is not on any
    blocklist, and the amounts are ordinary five-figure sums

Why does this fail only for USDT, and only after the first run? Give the
minimal change to the router that fixes it, and say what it should do about
the leftover allowance in general.

Write your answer to answer.md in this directory, showing your reasoning.

exec
/bin/bash -lc 'rg -n "feedback/SKILL.md|ethskills.com/feedback" -S /tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004 /tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004/.agents 2>/dev/null' in /tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004
 succeeded in 21ms:
/tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004/.agents/skills/security/SKILL.md:487:Before you finish: send a one-line note via [feedback/SKILL.md](https://ethskills.com/feedback/SKILL.md) — issue or praise.

web search: 
web search: https://ethskills.com/feedback/SKILL.md
web search: 
web search: site:ethskills.com feedback/SKILL.md ethskills
codex
I’ve got the diagnosis: USDT rejects non-zero-to-non-zero `approve`, so the leftover allowance after the first run makes every later approval revert. I’m writing the answer now, including the minimal two-step fix and the general rule for handling residual allowance.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1d8f40ea036ca46e6d3e322f763a6f4c2409343d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,44 @@
+USDT fails here because it keeps the old ERC-20 allowance behavior: if the current allowance is non-zero, `approve(spender, newAmount)` reverts unless the new amount is zero first.
+
+That matches the run history exactly:
+
+1. On the first USDT run, the router's allowance to `strategy` was `0`, so `approve(strategy, amount)` succeeded.
+2. The strategy then spent only part of that approval.
+3. A leftover non-zero allowance remained.
+4. On the next run, the router tried to do another direct `approve(strategy, amount)` from non-zero to non-zero.
+5. USDT reverted inside `approve`, so the low-level call returned `ok == false`, and the router hit `require(ok, "approve failed")`.
+
+USDC does not enforce that zero-first rule, so repeated approvals keep working there.
+
+The low-level call is not the real issue. It only avoided return-data decoding problems. The revert is coming from USDT's allowance policy.
+
+Minimal router change
+
+Before setting the new approval amount, clear any existing allowance to zero.
+
+```solidity
+(bool ok0, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok0, "approve reset failed");
+
+(bool ok1, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok1, "approve failed");
+```
+
+If you want the OpenZeppelin v5 version, use `SafeERC20.forceApprove`, which exists for exactly this class of token:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+What the router should do about leftover allowance in general
+
+It should not assume the previous allowance was fully consumed. For safety and compatibility, treat residual allowance as normal and explicitly overwrite approvals in a way that works for zero-first tokens:
+
+- either always `approve(0)` and then `approve(amount)`, or
+- use `SafeERC20.forceApprove`.
+
+That handles USDT correctly and keeps the router compatible with standard tokens too.
+
+More generally, the leftover allowance should be minimized rather than ignored. Since the strategy often spends less than approved, the router should grant only the exact amount needed for that run, and on the next run reset/replace the allowance instead of stacking another approval on top of the old one.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1d8f40ea036ca46e6d3e322f763a6f4c2409343d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,44 @@
+USDT fails here because it keeps the old ERC-20 allowance behavior: if the current allowance is non-zero, `approve(spender, newAmount)` reverts unless the new amount is zero first.
+
+That matches the run history exactly:
+
+1. On the first USDT run, the router's allowance to `strategy` was `0`, so `approve(strategy, amount)` succeeded.
+2. The strategy then spent only part of that approval.
+3. A leftover non-zero allowance remained.
+4. On the next run, the router tried to do another direct `approve(strategy, amount)` from non-zero to non-zero.
+5. USDT reverted inside `approve`, so the low-level call returned `ok == false`, and the router hit `require(ok, "approve failed")`.
+
+USDC does not enforce that zero-first rule, so repeated approvals keep working there.
+
+The low-level call is not the real issue. It only avoided return-data decoding problems. The revert is coming from USDT's allowance policy.
+
+Minimal router change
+
+Before setting the new approval amount, clear any existing allowance to zero.
+
+```solidity
+(bool ok0, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok0, "approve reset failed");
+
+(bool ok1, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok1, "approve failed");
+```
+
+If you want the OpenZeppelin v5 version, use `SafeERC20.forceApprove`, which exists for exactly this class of token:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+What the router should do about leftover allowance in general
+
+It should not assume the previous allowance was fully consumed. For safety and compatibility, treat residual allowance as normal and explicitly overwrite approvals in a way that works for zero-first tokens:
+
+- either always `approve(0)` and then `approve(amount)`, or
+- use `SafeERC20.forceApprove`.
+
+That handles USDT correctly and keeps the router compatible with standard tokens too.
+
+More generally, the leftover allowance should be minimized rather than ignored. Since the strategy often spends less than approved, the router should grant only the exact amount needed for that run, and on the next run reset/replace the allowance instead of stacking another approval on top of the old one.

codex
The write is complete. I’m doing one quick readback to verify the file content matches the requested explanation and fix.
exec
/bin/bash -lc 'cat answer.md' in /tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004
 succeeded in 11ms:
USDT fails here because it keeps the old ERC-20 allowance behavior: if the current allowance is non-zero, `approve(spender, newAmount)` reverts unless the new amount is zero first.

That matches the run history exactly:

1. On the first USDT run, the router's allowance to `strategy` was `0`, so `approve(strategy, amount)` succeeded.
2. The strategy then spent only part of that approval.
3. A leftover non-zero allowance remained.
4. On the next run, the router tried to do another direct `approve(strategy, amount)` from non-zero to non-zero.
5. USDT reverted inside `approve`, so the low-level call returned `ok == false`, and the router hit `require(ok, "approve failed")`.

USDC does not enforce that zero-first rule, so repeated approvals keep working there.

The low-level call is not the real issue. It only avoided return-data decoding problems. The revert is coming from USDT's allowance policy.

Minimal router change

Before setting the new approval amount, clear any existing allowance to zero.

```solidity
(bool ok0, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
require(ok0, "approve reset failed");

(bool ok1, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
require(ok1, "approve failed");
```

If you want the OpenZeppelin v5 version, use `SafeERC20.forceApprove`, which exists for exactly this class of token:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

What the router should do about leftover allowance in general

It should not assume the previous allowance was fully consumed. For safety and compatibility, treat residual allowance as normal and explicitly overwrite approvals in a way that works for zero-first tokens:

- either always `approve(0)` and then `approve(amount)`, or
- use `SafeERC20.forceApprove`.

That handles USDT correctly and keeps the router compatible with standard tokens too.

More generally, the leftover allowance should be minimized rather than ignored. Since the strategy often spends less than approved, the router should grant only the exact amount needed for that run, and on the next run reset/replace the allowance instead of stacking another approval on top of the old one.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1d8f40ea036ca46e6d3e322f763a6f4c2409343d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,44 @@
+USDT fails here because it keeps the old ERC-20 allowance behavior: if the current allowance is non-zero, `approve(spender, newAmount)` reverts unless the new amount is zero first.
+
+That matches the run history exactly:
+
+1. On the first USDT run, the router's allowance to `strategy` was `0`, so `approve(strategy, amount)` succeeded.
+2. The strategy then spent only part of that approval.
+3. A leftover non-zero allowance remained.
+4. On the next run, the router tried to do another direct `approve(strategy, amount)` from non-zero to non-zero.
+5. USDT reverted inside `approve`, so the low-level call returned `ok == false`, and the router hit `require(ok, "approve failed")`.
+
+USDC does not enforce that zero-first rule, so repeated approvals keep working there.
+
+The low-level call is not the real issue. It only avoided return-data decoding problems. The revert is coming from USDT's allowance policy.
+
+Minimal router change
+
+Before setting the new approval amount, clear any existing allowance to zero.
+
+```solidity
+(bool ok0, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok0, "approve reset failed");
+
+(bool ok1, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok1, "approve failed");
+```
+
+If you want the OpenZeppelin v5 version, use `SafeERC20.forceApprove`, which exists for exactly this class of token:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+What the router should do about leftover allowance in general
+
+It should not assume the previous allowance was fully consumed. For safety and compatibility, treat residual allowance as normal and explicitly overwrite approvals in a way that works for zero-first tokens:
+
+- either always `approve(0)` and then `approve(amount)`, or
+- use `SafeERC20.forceApprove`.
+
+That handles USDT correctly and keeps the router compatible with standard tokens too.
+
+More generally, the leftover allowance should be minimized rather than ignored. Since the strategy often spends less than approved, the router should grant only the exact amount needed for that run, and on the next run reset/replace the allowance instead of stacking another approval on top of the old one.

codex
Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004/answer.md).

The core diagnosis is that USDT rejects `approve` from a non-zero allowance to another non-zero allowance. The first run succeeds because allowance starts at zero; later runs fail because leftover allowance remains. The minimal fix is to reset to zero before setting the new amount, or in OpenZeppelin v5 use `SafeERC20.forceApprove`.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..1d8f40ea036ca46e6d3e322f763a6f4c2409343d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,44 @@
+USDT fails here because it keeps the old ERC-20 allowance behavior: if the current allowance is non-zero, `approve(spender, newAmount)` reverts unless the new amount is zero first.
+
+That matches the run history exactly:
+
+1. On the first USDT run, the router's allowance to `strategy` was `0`, so `approve(strategy, amount)` succeeded.
+2. The strategy then spent only part of that approval.
+3. A leftover non-zero allowance remained.
+4. On the next run, the router tried to do another direct `approve(strategy, amount)` from non-zero to non-zero.
+5. USDT reverted inside `approve`, so the low-level call returned `ok == false`, and the router hit `require(ok, "approve failed")`.
+
+USDC does not enforce that zero-first rule, so repeated approvals keep working there.
+
+The low-level call is not the real issue. It only avoided return-data decoding problems. The revert is coming from USDT's allowance policy.
+
+Minimal router change
+
+Before setting the new approval amount, clear any existing allowance to zero.
+
+```solidity
+(bool ok0, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok0, "approve reset failed");
+
+(bool ok1, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok1, "approve failed");
+```
+
+If you want the OpenZeppelin v5 version, use `SafeERC20.forceApprove`, which exists for exactly this class of token:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+What the router should do about leftover allowance in general
+
+It should not assume the previous allowance was fully consumed. For safety and compatibility, treat residual allowance as normal and explicitly overwrite approvals in a way that works for zero-first tokens:
+
+- either always `approve(0)` and then `approve(amount)`, or
+- use `SafeERC20.forceApprove`.
+
+That handles USDT correctly and keeps the router compatible with standard tokens too.
+
+More generally, the leftover allowance should be minimized rather than ignored. Since the strategy often spends less than approved, the router should grant only the exact amount needed for that run, and on the next run reset/replace the allowance instead of stacking another approval on top of the old one.

tokens used
20,027
````

## final message

Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211553Z-codex-with-skill-1/security-quiz-004/answer.md).

The core diagnosis is that USDT rejects `approve` from a non-zero allowance to another non-zero allowance. The first run succeeds because allowance starts at zero; later runs fail because leftover allowance remains. The minimal fix is to reset to zero before setting the new amount, or in OpenZeppelin v5 use `SafeERC20.forceApprove`.

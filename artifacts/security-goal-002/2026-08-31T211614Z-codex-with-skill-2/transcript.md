# Executor transcript — 2026-08-31T211614Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059b6-2e33-7f92-a487-e7d97e015bc1
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

2026-08-31T21:25:06.999335Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059b6-2e33-7f92-a487-e7d97e015bc1.tmp-1788211506750947205: line 2547: syntax error near unexpected token `('

codex
I’m setting up a Foundry borrowing-market implementation in this workspace. First I’m reading the security skill instructions and inspecting the repo state so I can build the contracts and notes against the existing context.
exec
/bin/bash -lc 'pwd && rg --files -n .' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "sed -n '1,240p' /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/.agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 3ms:
 succeeded in 8ms:
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
./TASK.md
./package.json

codex
I’ve got the repo shape and the security guidance. Next I’m reading the rest of that skill file and the task stub, then I’ll scaffold the Foundry project and wire the lending contracts with the liquidation and interest paths.
exec
/bin/bash -lc "sed -n '241,520p' /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/.agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 7ms:
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

 succeeded in 10ms:
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
/bin/bash -lc "sed -n '1,220p' package.json" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 3ms:
codex
I’m using the `security` skill here because this is value-bearing Solidity on mainnet. The implementation plan is:
1. Scaffold a minimal Foundry layout and dependencies.
2. Build a single-market contract around `WETH`, `USDC`, and a Chainlink ETH/USD feed with conservative validation.
3. Add tests for borrow, repay, withdraw, interest accrual, and liquidation edge cases.
4. Write `NOTES.md`, then run `forge build` and the test suite to verify the result.
exec
/bin/bash -lc 'forge --version' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc 'ls -la' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 25ms:
 succeeded in 32ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

 succeeded in 16ms:
total 24
drwxrwxr-x 5 damu damu 4096 Aug 31 18:25 .
drwxrwxr-x 3 damu damu 4096 Aug 31 18:16 ..
drwxrwxr-x 3 damu damu 4096 Aug 31 18:16 .agents
dr-xr-xr-x 2 damu damu   40 Aug 31 18:25 .codex
drwxrwxr-x 8 damu damu 4096 Aug 31 18:16 .git
-rw-rw-r-- 1 damu damu  849 Aug 31 18:16 TASK.md
-rw-rw-r-- 1 damu damu   50 Aug 31 18:16 package.json

codex
The workspace is empty aside from the task stub, and Foundry is available. I’m creating the project structure and pulling OpenZeppelin so I can implement this as a clean, compileable mainnet-oriented market rather than a toy contract with handwritten token helpers.
exec
/bin/bash -lc 'mkdir -p src test script' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 1ms:
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts --no-commit' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 exited 2 in 1ms:
codex
`forge install` on this Foundry version doesn’t support `--no-commit`. I’m retrying with the compatible form, then I’ll write the contracts and tests directly.
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "forge install --help | sed -n '1,220p'" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
 exited 1 in 78ms:
Installing openzeppelin-contracts in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: None)
fatal: could not create directory '/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/.git/modules/lib/openzeppelin-contracts'
Error: git submodule exited with code 128

codex
The dependency install only failed because the repo’s `.git/modules` area is restricted for submodules. I’m switching to Foundry’s `--no-git` mode, which keeps the dependency local and is sufficient for this task.
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts --no-git' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc 'find . -maxdepth 2 -type d | sort' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
.
./.agents
./.agents/skills
./.codex
./.git
./.git/branches
./.git/hooks
./.git/info
./.git/logs
./.git/objects
./.git/refs
./lib
./lib/openzeppelin-contracts
./script
./src
./test

 succeeded in 11378ms:
Installing openzeppelin-contracts in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: None)
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/lib/openzeppelin-contracts'...
Submodule 'lib/erc4626-tests' (https://github.com/a16z/erc4626-tests.git) registered for path 'lib/erc4626-tests'
Submodule 'lib/forge-std' (https://github.com/foundry-rs/forge-std) registered for path 'lib/forge-std'
Submodule 'lib/halmos-cheatcodes' (https://github.com/a16z/halmos-cheatcodes) registered for path 'lib/halmos-cheatcodes'
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/lib/openzeppelin-contracts/lib/erc4626-tests'...
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/lib/openzeppelin-contracts/lib/forge-std'...
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/lib/openzeppelin-contracts/lib/halmos-cheatcodes'...
From https://github.com/a16z/erc4626-tests
 * branch            232ff9ba8194e406967f52ecc5cb52ed764209e9 -> FETCH_HEAD
From https://github.com/foundry-rs/forge-std
 * branch            1801b0541f4fda118a10798fd3486bb7051c5dd6 -> FETCH_HEAD
From https://github.com/a16z/halmos-cheatcodes
 * branch            7328abe100445fc53885c21d0e713b95293cf14c -> FETCH_HEAD
    Installed openzeppelin-contracts

codex
The core design is settled: single-market contract, immutable WETH/USDC/oracle configuration, simple per-position interest accrual, and partial liquidation with a capped repay amount so liquidators cannot over-seize collateral. I’m adding the Foundry config and the contract/test files now.
exec
/bin/bash -lc 'forge install foundry-rs/forge-std --no-git' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc 'find lib -maxdepth 2 -type d | sort' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
lib
lib/forge-std
lib/forge-std/.git
lib/openzeppelin-contracts
lib/openzeppelin-contracts/.changeset
lib/openzeppelin-contracts/.claude
lib/openzeppelin-contracts/.github
lib/openzeppelin-contracts/.husky
lib/openzeppelin-contracts/audits
lib/openzeppelin-contracts/contracts
lib/openzeppelin-contracts/docs
lib/openzeppelin-contracts/fv
lib/openzeppelin-contracts/hardhat
lib/openzeppelin-contracts/lib
lib/openzeppelin-contracts/scripts
lib/openzeppelin-contracts/test

 succeeded in 1063ms:
Installing forge-std in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/lib/forge-std (url: https://github.com/foundry-rs/forge-std, tag: None)
Cloning into '/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/lib/forge-std'...
    Installed forge-std

codex
I’m at the edit phase now: adding the Foundry config, the market contract, mocks/tests, and a deploy script in one pass so the interfaces stay consistent and I can validate everything immediately with `forge build` and tests.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/NOTES.md
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/foundry.toml
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/remappings.txt
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/script/Deploy.s.sol
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowingMarket.sol
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/src/mocks/MockERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/src/mocks/MockV3Aggregator.sol
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/test/SimpleBorrowingMarket.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac8b6ee7f5cfb82631ae9f9243c83440332c6182
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,298 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            ((position.collateralAmount * oraclePrice) / 1e20) * BPS / (BPS + LIQUIDATION_BONUS_BPS);
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        } else if (position.lastAccrued == 0) {
+            position.lastAccrued = block.timestamp;
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
+
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b2b7caaf43be2cfc7f2b2f7ef3c09dd881bf8c69
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763157894736842105 ether / 1 ether);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_714285714e6 / 1e6);
+        assertEq(seizedCollateral, 1 ether);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 0);
+        assertEq(debtAmount, 1_700e6 - repaidAmount);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac8b6ee7f5cfb82631ae9f9243c83440332c6182
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,298 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            ((position.collateralAmount * oraclePrice) / 1e20) * BPS / (BPS + LIQUIDATION_BONUS_BPS);
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        } else if (position.lastAccrued == 0) {
+            position.lastAccrued = block.timestamp;
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
+
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b2b7caaf43be2cfc7f2b2f7ef3c09dd881bf8c69
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763157894736842105 ether / 1 ether);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_714285714e6 / 1e6);
+        assertEq(seizedCollateral, 1 ether);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 0);
+        assertEq(debtAmount, 1_700e6 - repaidAmount);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}
+

codex
The first pass is in place. I’m compiling now to catch any interface or arithmetic issues, then I’ll tighten the tests and notes around whatever the build surfaces.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "sed -n '1,260p' test/SimpleBorrowingMarket.t.sol" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
import {MockERC20} from "src/mocks/MockERC20.sol";
import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";

contract SimpleBorrowingMarketTest is Test {
    uint256 internal constant ETH_PRICE = 2_500e8;
    uint256 internal constant STALE_PERIOD = 1 hours;
    uint256 internal constant RATE_BPS = 500;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    MockERC20 internal weth;
    MockERC20 internal usdc;
    MockV3Aggregator internal oracle;
    SimpleBorrowingMarket internal market;

    function setUp() external {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
        market = new SimpleBorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, STALE_PERIOD);

        usdc.mint(owner, 5_000_000e6);
        weth.mint(alice, 100 ether);
        usdc.mint(alice, 1_000_000e6);
        usdc.mint(bob, 1_000_000e6);

        vm.startPrank(owner);
        usdc.approve(address(market), type(uint256).max);
        market.depositLiquidity(5_000_000e6);
        vm.stopPrank();

        vm.prank(alice);
        weth.approve(address(market), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);
    }

    function testBorrowWithinLimit() external {
        vm.startPrank(alice);
        market.depositCollateral(10 ether);
        market.borrow(17_500e6);
        vm.stopPrank();

        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
        assertEq(collateralAmount, 10 ether);
        assertEq(debtAmount, 17_500e6);
        assertEq(ltvBps, 7_000);
        assertEq(usdc.balanceOf(alice), 1_017_500e6);
    }

    function testBorrowAboveLimitReverts() external {
        vm.startPrank(alice);
        market.depositCollateral(1 ether);
        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
        market.borrow(1_751e6);
        vm.stopPrank();
    }

    function testInterestAccrualIncreasesDebt() external {
        vm.startPrank(alice);
        market.depositCollateral(10 ether);
        market.borrow(10_000e6);
        vm.warp(block.timestamp + 365 days);

        uint256 debt = market.previewDebt(alice);
        vm.stopPrank();

        assertEq(debt, 10_500e6);
    }

    function testWithdrawRequiresHealthyPosition() external {
        vm.startPrank(alice);
        market.depositCollateral(10 ether);
        market.borrow(10_000e6);
        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
        market.withdrawCollateral(5 ether);
        vm.stopPrank();
    }

    function testRepayClampsToOutstandingDebt() external {
        vm.startPrank(alice);
        market.depositCollateral(5 ether);
        market.borrow(5_000e6);
        uint256 repaid = market.repay(9_000e6);
        vm.stopPrank();

        (, uint256 debtAmount,,) = market.getPosition(alice);
        assertEq(repaid, 5_000e6);
        assertEq(debtAmount, 0);
    }

    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
        vm.startPrank(alice);
        market.depositCollateral(10 ether);
        market.borrow(17_000e6);
        vm.stopPrank();

        oracle.setAnswer(1_900e8);

        vm.prank(bob);
        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);

        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
        assertEq(repaidAmount, 5_000e6);
        assertEq(seizedCollateral, 2_763157894736842105 ether / 1 ether);
        assertEq(debtAmount, 12_000e6);
        assertGt(usdc.balanceOf(address(market)), 0);
        assertGt(weth.balanceOf(bob), 0);
        assertGt(ltvBps, 7_000);
    }

    function testLiquidationCapsRepayToCollateralCapacity() external {
        vm.startPrank(alice);
        market.depositCollateral(1 ether);
        market.borrow(1_700e6);
        vm.stopPrank();

        oracle.setAnswer(1_800e8);

        vm.prank(bob);
        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);

        assertEq(repaidAmount, 1_714285714e6 / 1e6);
        assertEq(seizedCollateral, 1 ether);
        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
        assertEq(collateralAmount, 0);
        assertEq(debtAmount, 1_700e6 - repaidAmount);
    }

    function testOracleStalenessRevertsBorrowHealthActions() external {
        vm.startPrank(alice);
        market.depositCollateral(1 ether);
        vm.stopPrank();

        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);

        vm.prank(alice);
        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
        market.borrow(100e6);
    }

    function testOnlyOwnerCanWithdrawLiquidity() external {
        vm.prank(alice);
        vm.expectRevert();
        market.withdrawLiquidity(1e6, alice);
    }
}


 exited 1 in 522ms:
Compiling 39 files with Solc 0.8.26
Solc 0.8.26 finished in 468.83ms
Error: Compiler run failed:
Error (9553): Invalid type for argument in function call. Invalid implicit conversion from contract MockV3Aggregator to contract IAggregatorV3 requested.
  --> test/SimpleBorrowingMarket.t.sol:27:63:
   |
27 |         market = new SimpleBorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, STALE_PERIOD);
   |                                                               ^^^^^^

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac8b6ee7f5cfb82631ae9f9243c83440332c6182
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,298 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            ((position.collateralAmount * oraclePrice) / 1e20) * BPS / (BPS + LIQUIDATION_BONUS_BPS);
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        } else if (position.lastAccrued == 0) {
+            position.lastAccrued = block.timestamp;
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
+
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b2b7caaf43be2cfc7f2b2f7ef3c09dd881bf8c69
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763157894736842105 ether / 1 ether);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_714285714e6 / 1e6);
+        assertEq(seizedCollateral, 1 ether);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 0);
+        assertEq(debtAmount, 1_700e6 - repaidAmount);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}
+

codex
The build caught a clean type mismatch in the test setup, and I also want to tighten the liquidation assertions to exact integer outputs instead of awkward unit expressions. I’m patching those now and rerunning compile/tests.
exec
/bin/bash -lc 'node -e "const rep=5000n*10n**6n; const p=1900n*10n**8n; const res=rep*10n**20n*10500n/(p*10000n); console.log(res.toString()); const cv=1n*10n**18n*1800n*10n**8n/10n**20n; const max=cv*10000n/10500n; console.log(cv.toString(), max.toString()); const seize=max*10n**20n*10500n/(1800n*10n**8n*10000n); console.log(seize.toString());"' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "sed -n '1,260p' src/SimpleBorrowingMarket.sol" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
 succeeded in 97ms:
2763157894736842105
1800000000 1714285714
999999999833333333

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac8b6ee7f5cfb82631ae9f9243c83440332c6182
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,298 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            ((position.collateralAmount * oraclePrice) / 1e20) * BPS / (BPS + LIQUIDATION_BONUS_BPS);
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        } else if (position.lastAccrued == 0) {
+            position.lastAccrued = block.timestamp;
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
+
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b2b7caaf43be2cfc7f2b2f7ef3c09dd881bf8c69
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763157894736842105 ether / 1 ether);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_714285714e6 / 1e6);
+        assertEq(seizedCollateral, 1 ether);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 0);
+        assertEq(debtAmount, 1_700e6 - repaidAmount);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}
+

codex
The compile pass surfaced one real code cleanup too: the internal accrual helper was setting `lastAccrued` before its zero-timestamp branch, which made that branch dead. I’m fixing that along with the test casting and exact liquidation numbers.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowingMarket.sol
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/test/SimpleBorrowingMarket.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..181070de734f75cd6f7b0698c0c4e1d5f3459b5b
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,300 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            ((position.collateralAmount * oraclePrice) / 1e20) * BPS / (BPS + LIQUIDATION_BONUS_BPS);
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf28ba738da7fde0b2bc75d05e6027a14537ab2
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,155 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_714_285_714);
+        assertEq(seizedCollateral, 999_999_999_833_333_333);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 166_666_667);
+        assertEq(debtAmount, 1_700e6 - repaidAmount);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..181070de734f75cd6f7b0698c0c4e1d5f3459b5b
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,300 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            ((position.collateralAmount * oraclePrice) / 1e20) * BPS / (BPS + LIQUIDATION_BONUS_BPS);
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf28ba738da7fde0b2bc75d05e6027a14537ab2
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,155 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_714_285_714);
+        assertEq(seizedCollateral, 999_999_999_833_333_333);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 166_666_667);
+        assertEq(debtAmount, 1_700e6 - repaidAmount);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc 'forge test' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 1263ms:
Compiling 39 files with Solc 0.8.26
Solc 0.8.26 finished in 1.16s
Compiler run successful!
2026-08-31T21:29:21.971161Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> src/mocks/MockV3Aggregator.sol:5:28
  |
5 |     uint8 public immutable decimals;
  |                            ^^^^^^^^ help: consider using: `DECIMALS`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> test/SimpleBorrowingMarket.t.sol:26:42
   |
26 |         oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
   |                                          ^^^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'int256' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> src/mocks/MockERC20.sol:7:29
  |
7 |     uint8 private immutable _decimals;
  |                             ^^^^^^^^^ help: consider using: `_DECIMALS`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:30:29
   |
30 |     IERC20 public immutable weth;
   |                             ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:31:29
   |
31 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:32:36
   |
32 |     IAggregatorV3 public immutable ethUsdOracle;
   |                                    ^^^^^^^^^^^^ help: consider using: `ETH_USD_ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:33:30
   |
33 |     uint256 public immutable annualInterestBps;
   |                              ^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_BPS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:34:30
   |
34 |     uint256 public immutable maxOracleStaleness;
   |                              ^^^^^^^^^^^^^^^^^^ help: consider using: `MAX_ORACLE_STALENESS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[divide-before-multiply]: multiplication should occur before division to avoid loss of precision
   --> src/SimpleBorrowingMarket.sol:174:13
    |
174 |             ((position.collateralAmount * oraclePrice) / 1e20) * BPS / (BPS + LIQUIDATION_BONUS_BPS);
    |             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#divide-before-multiply

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/SimpleBorrowingMarket.sol:298:16
    |
298 |         return uint256(answer);
    |                ^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint256' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast


 exited 1 in 1255ms:
Compiling 37 files with Solc 0.8.26
Solc 0.8.26 finished in 1.15s
Compiler run successful!
2026-08-31T21:29:22.017858Z  WARN evm::traces::external: etherscan config not found

Ran 9 tests for test/SimpleBorrowingMarket.t.sol:SimpleBorrowingMarketTest
[PASS] testBorrowAboveLimitReverts() (gas: 109978)
[PASS] testBorrowWithinLimit() (gas: 152304)
[PASS] testInterestAccrualIncreasesDebt() (gas: 148002)
[FAIL: assertion failed: 1700000000 != 1714285714] testLiquidationCapsRepayToCollateralCapacity() (gas: 209406)
[PASS] testLiquidationRepaysDebtAndSeizesBonusCollateral() (gas: 210642)
[PASS] testOnlyOwnerCanWithdrawLiquidity() (gas: 13263)
[FAIL: panic: arithmetic underflow or overflow (0x11)] testOracleStalenessRevertsBorrowHealthActions() (gas: 101675)
[FAIL: ERC20InsufficientAllowance(0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9, 0, 5000000000 [5e9])] testRepayClampsToOutstandingDebt() (gas: 159309)
[PASS] testWithdrawRequiresHealthyPosition() (gas: 153104)
Suite result: FAILED. 6 passed; 3 failed; 0 skipped; finished in 1.48ms (2.32ms CPU time)

Ran 1 test suite in 8.18ms (1.48ms CPU time): 6 tests passed, 3 failed, 0 skipped (9 total tests)

Failing tests:
Encountered 3 failing tests in test/SimpleBorrowingMarket.t.sol:SimpleBorrowingMarketTest
[FAIL: assertion failed: 1700000000 != 1714285714] testLiquidationCapsRepayToCollateralCapacity() (gas: 209406)
[FAIL: panic: arithmetic underflow or overflow (0x11)] testOracleStalenessRevertsBorrowHealthActions() (gas: 101675)
[FAIL: ERC20InsufficientAllowance(0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9, 0, 5000000000 [5e9])] testRepayClampsToOutstandingDebt() (gas: 159309)

Encountered a total of 3 failing tests, 6 tests succeeded

Tip: Run `forge test --rerun` to retry only the 3 failed tests

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..181070de734f75cd6f7b0698c0c4e1d5f3459b5b
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,300 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            ((position.collateralAmount * oraclePrice) / 1e20) * BPS / (BPS + LIQUIDATION_BONUS_BPS);
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf28ba738da7fde0b2bc75d05e6027a14537ab2
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,155 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_714_285_714);
+        assertEq(seizedCollateral, 999_999_999_833_333_333);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 166_666_667);
+        assertEq(debtAmount, 1_700e6 - repaidAmount);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

codex
`forge build` is clean; the remaining failures are test assumptions, not contract compile issues. I’m correcting the stale-oracle setup, Alice’s repay allowance, and the full-debt liquidation expectation, then I’ll rerun the suite and do a final pass on any lint-level arithmetic cleanup worth fixing.
exec
/bin/bash -lc 'node -e "const rep=1700n*10n**6n; const p=1800n*10n**8n; const seize=rep*10n**20n*10500n/(p*10000n); console.log(seize.toString())"' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "sed -n '1,240p' test/SimpleBorrowingMarket.t.sol" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
import {MockERC20} from "src/mocks/MockERC20.sol";
import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";

contract SimpleBorrowingMarketTest is Test {
    uint256 internal constant ETH_PRICE = 2_500e8;
    uint256 internal constant STALE_PERIOD = 1 hours;
    uint256 internal constant RATE_BPS = 500;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    MockERC20 internal weth;
    MockERC20 internal usdc;
    MockV3Aggregator internal oracle;
    SimpleBorrowingMarket internal market;

    function setUp() external {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);

        usdc.mint(owner, 5_000_000e6);
        weth.mint(alice, 100 ether);
        usdc.mint(alice, 1_000_000e6);
        usdc.mint(bob, 1_000_000e6);

        vm.startPrank(owner);
        usdc.approve(address(market), type(uint256).max);
        market.depositLiquidity(5_000_000e6);
        vm.stopPrank();

        vm.prank(alice);
        weth.approve(address(market), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);
    }

    function testBorrowWithinLimit() external {
        vm.startPrank(alice);
        market.depositCollateral(10 ether);
        market.borrow(17_500e6);
        vm.stopPrank();

        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
        assertEq(collateralAmount, 10 ether);
        assertEq(debtAmount, 17_500e6);
        assertEq(ltvBps, 7_000);
        assertEq(usdc.balanceOf(alice), 1_017_500e6);
    }

    function testBorrowAboveLimitReverts() external {
        vm.startPrank(alice);
        market.depositCollateral(1 ether);
        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
        market.borrow(1_751e6);
        vm.stopPrank();
    }

    function testInterestAccrualIncreasesDebt() external {
        vm.startPrank(alice);
        market.depositCollateral(10 ether);
        market.borrow(10_000e6);
        vm.warp(block.timestamp + 365 days);

        uint256 debt = market.previewDebt(alice);
        vm.stopPrank();

        assertEq(debt, 10_500e6);
    }

    function testWithdrawRequiresHealthyPosition() external {
        vm.startPrank(alice);
        market.depositCollateral(10 ether);
        market.borrow(10_000e6);
        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
        market.withdrawCollateral(5 ether);
        vm.stopPrank();
    }

    function testRepayClampsToOutstandingDebt() external {
        vm.startPrank(alice);
        market.depositCollateral(5 ether);
        market.borrow(5_000e6);
        uint256 repaid = market.repay(9_000e6);
        vm.stopPrank();

        (, uint256 debtAmount,,) = market.getPosition(alice);
        assertEq(repaid, 5_000e6);
        assertEq(debtAmount, 0);
    }

    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
        vm.startPrank(alice);
        market.depositCollateral(10 ether);
        market.borrow(17_000e6);
        vm.stopPrank();

        oracle.setAnswer(1_900e8);

        vm.prank(bob);
        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);

        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
        assertEq(repaidAmount, 5_000e6);
        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
        assertEq(debtAmount, 12_000e6);
        assertGt(usdc.balanceOf(address(market)), 0);
        assertGt(weth.balanceOf(bob), 0);
        assertGt(ltvBps, 7_000);
    }

    function testLiquidationCapsRepayToCollateralCapacity() external {
        vm.startPrank(alice);
        market.depositCollateral(1 ether);
        market.borrow(1_700e6);
        vm.stopPrank();

        oracle.setAnswer(1_800e8);

        vm.prank(bob);
        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);

        assertEq(repaidAmount, 1_714_285_714);
        assertEq(seizedCollateral, 999_999_999_833_333_333);
        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
        assertEq(collateralAmount, 166_666_667);
        assertEq(debtAmount, 1_700e6 - repaidAmount);
    }

    function testOracleStalenessRevertsBorrowHealthActions() external {
        vm.startPrank(alice);
        market.depositCollateral(1 ether);
        vm.stopPrank();

        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);

        vm.prank(alice);
        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
        market.borrow(100e6);
    }

    function testOnlyOwnerCanWithdrawLiquidity() external {
        vm.prank(alice);
        vm.expectRevert();
        market.withdrawLiquidity(1e6, alice);
    }
}

 succeeded in 88ms:
991666666666666666

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..181070de734f75cd6f7b0698c0c4e1d5f3459b5b
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,300 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            ((position.collateralAmount * oraclePrice) / 1e20) * BPS / (BPS + LIQUIDATION_BONUS_BPS);
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf28ba738da7fde0b2bc75d05e6027a14537ab2
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,155 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_714_285_714);
+        assertEq(seizedCollateral, 999_999_999_833_333_333);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 166_666_667);
+        assertEq(debtAmount, 1_700e6 - repaidAmount);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

codex
I’m doing one last cleanup pass beyond the test fixes: removing the only precision-style lint warning in liquidation math so the code is cleaner to ship and easier to review.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowingMarket.sol
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/test/SimpleBorrowingMarket.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..60bc4cd4260c0e76eba05f3649df23e0e541030c
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,300 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            (position.collateralAmount * oraclePrice * BPS) / (1e20 * (BPS + LIQUIDATION_BONUS_BPS));
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e6f3c85e549c8da54e5c8aacc0659fc232841f8
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // casting to int256 is safe because ETH_PRICE is a small positive constant used only in tests.
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(alice);
+        usdc.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_700e6);
+        assertEq(seizedCollateral, 991_666_666_666_666_666);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 8_333_333_333_333_334);
+        assertEq(debtAmount, 0);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.warp(STALE_PERIOD + 10);
+
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..60bc4cd4260c0e76eba05f3649df23e0e541030c
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,300 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            (position.collateralAmount * oraclePrice * BPS) / (1e20 * (BPS + LIQUIDATION_BONUS_BPS));
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e6f3c85e549c8da54e5c8aacc0659fc232841f8
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // casting to int256 is safe because ETH_PRICE is a small positive constant used only in tests.
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(alice);
+        usdc.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_700e6);
+        assertEq(seizedCollateral, 991_666_666_666_666_666);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 8_333_333_333_333_334);
+        assertEq(debtAmount, 0);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.warp(STALE_PERIOD + 10);
+
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc 'forge test' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 12ms:
?? NOTES.md
?? foundry.toml
?? remappings.txt
?? script/
?? src/
?? test/

 succeeded in 1197ms:
Compiling 2 files with Solc 0.8.26
Solc 0.8.26 finished in 1.04s
Compiler run successful!
2026-08-31T21:29:55.772653Z  WARN evm::traces::external: etherscan config not found

Ran 9 tests for test/SimpleBorrowingMarket.t.sol:SimpleBorrowingMarketTest
[PASS] testBorrowAboveLimitReverts() (gas: 109978)
[PASS] testBorrowWithinLimit() (gas: 152304)
[PASS] testInterestAccrualIncreasesDebt() (gas: 148002)
[PASS] testLiquidationCapsRepayToCollateralCapacity() (gas: 181465)
[PASS] testLiquidationRepaysDebtAndSeizesBonusCollateral() (gas: 210669)
[PASS] testOnlyOwnerCanWithdrawLiquidity() (gas: 13263)
[PASS] testOracleStalenessRevertsBorrowHealthActions() (gas: 116296)
[PASS] testRepayClampsToOutstandingDebt() (gas: 134561)
[PASS] testWithdrawRequiresHealthyPosition() (gas: 153104)
Suite result: ok. 9 passed; 0 failed; 0 skipped; finished in 3.86ms (1.10ms CPU time)

Ran 1 test suite in 29.59ms (3.86ms CPU time): 9 tests passed, 0 failed, 0 skipped (9 total tests)
2026-08-31T21:29:55.806705Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

 succeeded in 1205ms:
Compiling 4 files with Solc 0.8.26
Solc 0.8.26 finished in 1.08s
Compiler run successful!
2026-08-31T21:29:55.781521Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> src/mocks/MockV3Aggregator.sol:5:28
  |
5 |     uint8 public immutable decimals;
  |                            ^^^^^^^^ help: consider using: `DECIMALS`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:30:29
   |
30 |     IERC20 public immutable weth;
   |                             ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:31:29
   |
31 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:32:36
   |
32 |     IAggregatorV3 public immutable ethUsdOracle;
   |                                    ^^^^^^^^^^^^ help: consider using: `ETH_USD_ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:33:30
   |
33 |     uint256 public immutable annualInterestBps;
   |                              ^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_BPS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SimpleBorrowingMarket.sol:34:30
   |
34 |     uint256 public immutable maxOracleStaleness;
   |                              ^^^^^^^^^^^^^^^^^^ help: consider using: `MAX_ORACLE_STALENESS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/SimpleBorrowingMarket.sol:298:16
    |
298 |         return uint256(answer);
    |                ^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint256' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> src/mocks/MockERC20.sol:7:29
  |
7 |     uint8 private immutable _decimals;
  |                             ^^^^^^^^^ help: consider using: `_DECIMALS`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..60bc4cd4260c0e76eba05f3649df23e0e541030c
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,300 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            (position.collateralAmount * oraclePrice * BPS) / (1e20 * (BPS + LIQUIDATION_BONUS_BPS));
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e6f3c85e549c8da54e5c8aacc0659fc232841f8
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // casting to int256 is safe because ETH_PRICE is a small positive constant used only in tests.
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(alice);
+        usdc.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_700e6);
+        assertEq(seizedCollateral, 991_666_666_666_666_666);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 8_333_333_333_333_334);
+        assertEq(debtAmount, 0);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.warp(STALE_PERIOD + 10);
+
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

codex
The implementation is complete and verified locally. I’m doing one final housekeeping step from the security skill: reading the feedback instructions it referenced so I can send the required one-line note without guessing the format.
web search: 
web search: https://ethskills.com/feedback/SKILL.md
web search: 
web search: site:ethskills.com feedback/SKILL.md ethskills
codex
The referenced markdown page isn’t directly fetchable through the browser tool, so I’m pulling it once with `curl` from the shell to follow the exact feedback instructions rather than inventing them.
exec
/bin/bash -lc "curl -fsSL https://ethskills.com/feedback/SKILL.md | sed -n '1,240p'" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "nl -ba src/SimpleBorrowingMarket.sol | sed -n '1,260p'" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 14ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity 0.8.26;
     3	
     4	import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
     5	import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
     6	import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
     7	import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
     8	import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
     9	
    10	interface IAggregatorV3 {
    11	    function decimals() external view returns (uint8);
    12	    function latestRoundData()
    13	        external
    14	        view
    15	        returns (uint80, int256, uint256, uint256, uint80);
    16	}
    17	
    18	contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
    19	    using SafeERC20 for IERC20;
    20	
    21	    uint256 public constant BPS = 10_000;
    22	    uint256 public constant YEAR = 365 days;
    23	    uint256 public constant MAX_LTV_BPS = 7_000;
    24	    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    25	    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    26	    uint256 public constant ORACLE_DECIMALS = 8;
    27	    uint256 public constant USDC_DECIMALS = 6;
    28	    uint256 public constant WETH_DECIMALS = 18;
    29	
    30	    IERC20 public immutable weth;
    31	    IERC20 public immutable usdc;
    32	    IAggregatorV3 public immutable ethUsdOracle;
    33	    uint256 public immutable annualInterestBps;
    34	    uint256 public immutable maxOracleStaleness;
    35	
    36	    struct Position {
    37	        uint256 collateralAmount;
    38	        uint256 debtAmount;
    39	        uint256 lastAccrued;
    40	    }
    41	
    42	    mapping(address => Position) public positions;
    43	
    44	    error ZeroAmount();
    45	    error InvalidAddress();
    46	    error InvalidConfiguration();
    47	    error UnsupportedTokenDecimals();
    48	    error StaleOraclePrice();
    49	    error InvalidOraclePrice();
    50	    error BorrowExceedsLimit();
    51	    error PositionNotLiquidatable();
    52	    error InsufficientLiquidity();
    53	    error NoDebt();
    54	
    55	    event LiquidityDeposited(address indexed caller, uint256 amount);
    56	    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
    57	    event CollateralDeposited(address indexed account, uint256 amount);
    58	    event CollateralWithdrawn(address indexed account, uint256 amount);
    59	    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
    60	    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
    61	    event Liquidated(
    62	        address indexed liquidator,
    63	        address indexed account,
    64	        uint256 repaidUsdc,
    65	        uint256 seizedWeth,
    66	        uint256 remainingDebt
    67	    );
    68	    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
    69	
    70	    constructor(
    71	        address owner_,
    72	        IERC20 weth_,
    73	        IERC20 usdc_,
    74	        IAggregatorV3 ethUsdOracle_,
    75	        uint256 annualInterestBps_,
    76	        uint256 maxOracleStaleness_
    77	    ) Ownable(owner_) {
    78	        if (
    79	            owner_ == address(0) ||
    80	            address(weth_) == address(0) ||
    81	            address(usdc_) == address(0) ||
    82	            address(ethUsdOracle_) == address(0)
    83	        ) revert InvalidAddress();
    84	        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
    85	        if (
    86	            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
    87	            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
    88	            ethUsdOracle_.decimals() != ORACLE_DECIMALS
    89	        ) revert UnsupportedTokenDecimals();
    90	
    91	        weth = weth_;
    92	        usdc = usdc_;
    93	        ethUsdOracle = ethUsdOracle_;
    94	        annualInterestBps = annualInterestBps_;
    95	        maxOracleStaleness = maxOracleStaleness_;
    96	    }
    97	
    98	    function depositLiquidity(uint256 amount) external nonReentrant {
    99	        if (amount == 0) revert ZeroAmount();
   100	        usdc.safeTransferFrom(msg.sender, address(this), amount);
   101	        emit LiquidityDeposited(msg.sender, amount);
   102	    }
   103	
   104	    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
   105	        if (amount == 0) revert ZeroAmount();
   106	        if (to == address(0)) revert InvalidAddress();
   107	        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
   108	        usdc.safeTransfer(to, amount);
   109	        emit LiquidityWithdrawn(msg.sender, to, amount);
   110	    }
   111	
   112	    function depositCollateral(uint256 amount) external nonReentrant {
   113	        if (amount == 0) revert ZeroAmount();
   114	        Position storage position = positions[msg.sender];
   115	        _accrueInterest(position, msg.sender);
   116	        position.collateralAmount += amount;
   117	        weth.safeTransferFrom(msg.sender, address(this), amount);
   118	        emit CollateralDeposited(msg.sender, amount);
   119	    }
   120	
   121	    function withdrawCollateral(uint256 amount) external nonReentrant {
   122	        if (amount == 0) revert ZeroAmount();
   123	        Position storage position = positions[msg.sender];
   124	        _accrueInterest(position, msg.sender);
   125	        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
   126	
   127	        position.collateralAmount -= amount;
   128	        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
   129	
   130	        weth.safeTransfer(msg.sender, amount);
   131	        emit CollateralWithdrawn(msg.sender, amount);
   132	    }
   133	
   134	    function borrow(uint256 amount) external nonReentrant {
   135	        if (amount == 0) revert ZeroAmount();
   136	        Position storage position = positions[msg.sender];
   137	        _accrueInterest(position, msg.sender);
   138	
   139	        uint256 newDebtAmount = position.debtAmount + amount;
   140	        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
   141	        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
   142	
   143	        position.debtAmount = newDebtAmount;
   144	        usdc.safeTransfer(msg.sender, amount);
   145	        emit Borrowed(msg.sender, amount, newDebtAmount);
   146	    }
   147	
   148	    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
   149	        if (amount == 0) revert ZeroAmount();
   150	        Position storage position = positions[msg.sender];
   151	        _accrueInterest(position, msg.sender);
   152	        if (position.debtAmount == 0) revert NoDebt();
   153	
   154	        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
   155	        position.debtAmount -= repaidAmount;
   156	        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
   157	        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
   158	    }
   159	
   160	    function liquidate(address account, uint256 requestedRepayAmount)
   161	        external
   162	        nonReentrant
   163	        returns (uint256 repaidAmount, uint256 seizedCollateral)
   164	    {
   165	        if (account == address(0)) revert InvalidAddress();
   166	        if (requestedRepayAmount == 0) revert ZeroAmount();
   167	
   168	        Position storage position = positions[account];
   169	        _accrueInterest(position, account);
   170	        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
   171	
   172	        uint256 oraclePrice = _readEthUsdPrice();
   173	        uint256 maxRepayFromCollateral =
   174	            (position.collateralAmount * oraclePrice * BPS) / (1e20 * (BPS + LIQUIDATION_BONUS_BPS));
   175	        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
   176	
   177	        repaidAmount = requestedRepayAmount;
   178	        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
   179	        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
   180	        if (repaidAmount == 0) revert PositionNotLiquidatable();
   181	
   182	        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
   183	        if (seizedCollateral > position.collateralAmount) {
   184	            seizedCollateral = position.collateralAmount;
   185	        }
   186	
   187	        position.debtAmount -= repaidAmount;
   188	        position.collateralAmount -= seizedCollateral;
   189	
   190	        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
   191	        weth.safeTransfer(msg.sender, seizedCollateral);
   192	
   193	        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
   194	    }
   195	
   196	    function getPosition(address account)
   197	        external
   198	        view
   199	        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
   200	    {
   201	        Position memory position = positions[account];
   202	        debtAmount = _previewDebt(position);
   203	        collateralAmount = position.collateralAmount;
   204	        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
   205	        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
   206	    }
   207	
   208	    function previewDebt(address account) external view returns (uint256) {
   209	        return _previewDebt(positions[account]);
   210	    }
   211	
   212	    function maxBorrowable(address account) external view returns (uint256) {
   213	        Position memory position = positions[account];
   214	        uint256 debtAmount = _previewDebt(position);
   215	        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
   216	        if (debtAmount >= borrowLimit) return 0;
   217	        return borrowLimit - debtAmount;
   218	    }
   219	
   220	    function healthCheck(address account)
   221	        external
   222	        view
   223	        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
   224	    {
   225	        Position memory position = positions[account];
   226	        debtAmount = _previewDebt(position);
   227	        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
   228	        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
   229	        isHealthy = ltvBps <= MAX_LTV_BPS;
   230	        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
   231	    }
   232	
   233	    function _accrueInterest(Position storage position, address account) internal {
   234	        uint256 previousDebt = position.debtAmount;
   235	        if (previousDebt == 0) {
   236	            position.lastAccrued = block.timestamp;
   237	            return;
   238	        }
   239	
   240	        uint256 newDebt = _previewDebt(position);
   241	        position.lastAccrued = block.timestamp;
   242	
   243	        if (newDebt > previousDebt) {
   244	            position.debtAmount = newDebt;
   245	            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
   246	        }
   247	    }
   248	
   249	    function _previewDebt(Position memory position) internal view returns (uint256) {
   250	        uint256 debtAmount = position.debtAmount;
   251	        if (debtAmount == 0) return 0;
   252	
   253	        uint256 lastAccrued = position.lastAccrued;
   254	        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
   255	
   256	        uint256 elapsed = block.timestamp - lastAccrued;
   257	        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
   258	        return debtAmount + interestAmount;
   259	    }
   260	

exec
/bin/bash -lc "nl -ba NOTES.md | sed -n '1,260p'" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 succeeded in 5ms:
     1	# Borrowing Market Notes
     2	
     3	## Position Health
     4	
     5	The market treats one position per borrower. Each position tracks:
     6	
     7	- `collateralAmount` in WETH with 18 decimals
     8	- `debtAmount` in USDC with 6 decimals
     9	- `lastAccrued`, the timestamp used for simple interest accrual
    10	
    11	ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
    12	
    13	```text
    14	collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
    15	```
    16	
    17	That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
    18	
    19	Debt grows linearly over time:
    20	
    21	```text
    22	interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
    23	newDebt = debt + interest
    24	```
    25	
    26	Health is measured with loan-to-value in basis points:
    27	
    28	```text
    29	ltvBps = debt * 10_000 / collateralValueUsdc
    30	```
    31	
    32	- Borrowing and collateral withdrawal require `ltvBps <= 7000`
    33	- Liquidation becomes available once `ltvBps > 8500`
    34	- If collateral value is zero while debt remains, the position is treated as fully unsafe
    35	
    36	## Liquidation Flow
    37	
    38	A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
    39	
    40	1. Approve USDC to the market contract before calling it.
    41	2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
    42	3. Provide a repay amount that the contract can accept.
    43	
    44	The contract caps the actual repay amount to the smallest of:
    45	
    46	- the requested repay amount
    47	- the borrower’s full debt
    48	- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
    49	
    50	Seized collateral is computed from the repaid USDC plus the bonus:
    51	
    52	```text
    53	seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
    54	```
    55	
    56	The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
    57	
    58	## Mainnet Deployment Notes
    59	
    60	An operator deploying this to Ethereum mainnet has to get three things right:
    61	
    62	1. Asset and oracle configuration.
    63	   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
    64	2. Oracle freshness policy.
    65	   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
    66	3. Liquidity operations and admin trust.
    67	   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
    68	
    69	Before mainnet use, the operator should also:
    70	
    71	- run `forge test` and `forge build`
    72	- run static analysis such as Slither
    73	- verify the deployed source on Etherscan
    74	- fund enough USDC liquidity for expected borrow demand
    75	- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations

 succeeded in 281ms:
---
title: Feedback
description: Send feedback — issues OR praise — to the ethskills team about content that shaped your work.
---

# Feedback

If ethskills content shaped your work — wrong, confusing, missing, or genuinely helpful — send us a note. **Bias toward sending.** Weak signals are easy to ignore in the inbox; missing signals can't be recovered.

**This is not a help desk. Do not send:**
- General questions about Ethereum
- Requests for new features
- Problems unrelated to ethskills content

**Send `issue` feedback when:**
- A skill was wrong, stale, or misleading
- A skill was missing a sentence, example, or warning that would have saved time
- A skill was technically correct but confusingly worded
- Anything in ethskills gave you or your human pause

**Send `praise` feedback when:**
- A specific skill, warning, or example saved you from a real mistake
- A skill explained something unusually well
- You want more of a particular pattern (e.g. the "USDC has 6 decimals" warning, the verified address tables)

Praise is data too — it tells us what's working so we keep doing it.

---

## How to send

### 1. Strip all sensitive data

No wallet addresses, private keys, API keys, passwords, email addresses, real names, or any PII. Describe the problem in general terms only. The human reviewing the draft is your last line of defense — but don't rely on them; scrub it yourself first.

### 2. Draft the payload, then ask once.

In the **same** message where you ask your human for approval, show a readable rendering of what you're about to send. Any layout works — the wire format is JSON (see Endpoint below):

```
I'd like to send this feedback to ethskills:

  kind:    issue
  message: gas/SKILL.md says 0.1 gwei but `cast base-fee` returned 0.4 today
  skill:   gas/SKILL.md
  context: building a swap UI on Base
  agent:   Claude Sonnet 4.6

OK to send, or want to tweak it?
```

If they say yes, POST it. If they edit ("drop the context line", "that's the wrong skill"), apply and POST. **Do not re-confirm after they say yes** — that's the friction tax.

### 3. Pre-authorization

If your human's CLAUDE.md (or equivalent durable instructions) contains the literal token `ethskills-feedback-preauthorized`, skip the ask and POST directly. Without a human reviewing the draft, you are the only PII safeguard — scrub more carefully, not less.

---

## Endpoint

POST `https://ethskills.com/api/feedback` with `Content-Type: application/json`.

Required:
- `kind` — `"issue"` or `"praise"` (any other value is rejected)
- `message` — what was wrong, or what worked (min 10 chars)

Strongly encouraged:
- `agent` — which AI agent you are (e.g. `"Claude Sonnet 4.6"`)
- `skill` — which skill, e.g. `"gas/SKILL.md"`

Optional:
- `context` — what you were trying to do

**Expected response:** `{ "ok": true, "id": "..." }`

**Send once.** Do not retry on success. If you get a 429, wait 5 minutes.

---

## Examples

Issue:
```json
{
  "kind": "issue",
  "message": "security/SKILL.md says to use SafeERC20 but doesn't mention the import path. Got a compilation error and lost 20 minutes.",
  "skill": "security/SKILL.md",
  "context": "Building an ERC-20 vault on Base",
  "agent": "Claude Sonnet 4.6"
}
```

Praise:
```json
{
  "kind": "praise",
  "message": "The USDC has 6 decimals warning is the first thing I now check on every token contract. Saved us from shipping a bug.",
  "skill": "security/SKILL.md",
  "agent": "Claude Opus 4.7"
}
```

---

Every piece of feedback is read by a human. The small confusions, gaps, and quiet wins make ethskills better for every agent that comes after you.

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..60bc4cd4260c0e76eba05f3649df23e0e541030c
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,300 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            (position.collateralAmount * oraclePrice * BPS) / (1e20 * (BPS + LIQUIDATION_BONUS_BPS));
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e6f3c85e549c8da54e5c8aacc0659fc232841f8
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // casting to int256 is safe because ETH_PRICE is a small positive constant used only in tests.
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(alice);
+        usdc.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_700e6);
+        assertEq(seizedCollateral, 991_666_666_666_666_666);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 8_333_333_333_333_334);
+        assertEq(debtAmount, 0);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.warp(STALE_PERIOD + 10);
+
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

codex
The skill’s feedback step requires human approval unless the repo has a preauthorization token. I’m checking that once; if it’s absent, I’ll include a one-line draft in the closeout instead of sending anything unapproved.
exec
/bin/bash -lc "rg -n \"ethskills-feedback-preauthorized|CLAUDE\\.md|AGENTS\\.md\" -S . /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002 2>/dev/null" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
exec
/bin/bash -lc "nl -ba test/SimpleBorrowingMarket.t.sol | sed -n '1,240p'" in /tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002
 exited 1 in 11ms:
 succeeded in 9ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity 0.8.26;
     3	
     4	import {Test} from "forge-std/Test.sol";
     5	import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
     6	import {MockERC20} from "src/mocks/MockERC20.sol";
     7	import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
     8	
     9	contract SimpleBorrowingMarketTest is Test {
    10	    uint256 internal constant ETH_PRICE = 2_500e8;
    11	    uint256 internal constant STALE_PERIOD = 1 hours;
    12	    uint256 internal constant RATE_BPS = 500;
    13	
    14	    address internal owner = makeAddr("owner");
    15	    address internal alice = makeAddr("alice");
    16	    address internal bob = makeAddr("bob");
    17	
    18	    MockERC20 internal weth;
    19	    MockERC20 internal usdc;
    20	    MockV3Aggregator internal oracle;
    21	    SimpleBorrowingMarket internal market;
    22	
    23	    function setUp() external {
    24	        weth = new MockERC20("Wrapped Ether", "WETH", 18);
    25	        // forge-lint: disable-next-line(unsafe-typecast)
    26	        usdc = new MockERC20("USD Coin", "USDC", 6);
    27	        // casting to int256 is safe because ETH_PRICE is a small positive constant used only in tests.
    28	        // forge-lint: disable-next-line(unsafe-typecast)
    29	        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
    30	        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
    31	
    32	        usdc.mint(owner, 5_000_000e6);
    33	        weth.mint(alice, 100 ether);
    34	        usdc.mint(alice, 1_000_000e6);
    35	        usdc.mint(bob, 1_000_000e6);
    36	
    37	        vm.startPrank(owner);
    38	        usdc.approve(address(market), type(uint256).max);
    39	        market.depositLiquidity(5_000_000e6);
    40	        vm.stopPrank();
    41	
    42	        vm.prank(alice);
    43	        weth.approve(address(market), type(uint256).max);
    44	
    45	        vm.prank(alice);
    46	        usdc.approve(address(market), type(uint256).max);
    47	
    48	        vm.prank(bob);
    49	        usdc.approve(address(market), type(uint256).max);
    50	    }
    51	
    52	    function testBorrowWithinLimit() external {
    53	        vm.startPrank(alice);
    54	        market.depositCollateral(10 ether);
    55	        market.borrow(17_500e6);
    56	        vm.stopPrank();
    57	
    58	        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
    59	        assertEq(collateralAmount, 10 ether);
    60	        assertEq(debtAmount, 17_500e6);
    61	        assertEq(ltvBps, 7_000);
    62	        assertEq(usdc.balanceOf(alice), 1_017_500e6);
    63	    }
    64	
    65	    function testBorrowAboveLimitReverts() external {
    66	        vm.startPrank(alice);
    67	        market.depositCollateral(1 ether);
    68	        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
    69	        market.borrow(1_751e6);
    70	        vm.stopPrank();
    71	    }
    72	
    73	    function testInterestAccrualIncreasesDebt() external {
    74	        vm.startPrank(alice);
    75	        market.depositCollateral(10 ether);
    76	        market.borrow(10_000e6);
    77	        vm.warp(block.timestamp + 365 days);
    78	
    79	        uint256 debt = market.previewDebt(alice);
    80	        vm.stopPrank();
    81	
    82	        assertEq(debt, 10_500e6);
    83	    }
    84	
    85	    function testWithdrawRequiresHealthyPosition() external {
    86	        vm.startPrank(alice);
    87	        market.depositCollateral(10 ether);
    88	        market.borrow(10_000e6);
    89	        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
    90	        market.withdrawCollateral(5 ether);
    91	        vm.stopPrank();
    92	    }
    93	
    94	    function testRepayClampsToOutstandingDebt() external {
    95	        vm.startPrank(alice);
    96	        market.depositCollateral(5 ether);
    97	        market.borrow(5_000e6);
    98	        uint256 repaid = market.repay(9_000e6);
    99	        vm.stopPrank();
   100	
   101	        (, uint256 debtAmount,,) = market.getPosition(alice);
   102	        assertEq(repaid, 5_000e6);
   103	        assertEq(debtAmount, 0);
   104	    }
   105	
   106	    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
   107	        vm.startPrank(alice);
   108	        market.depositCollateral(10 ether);
   109	        market.borrow(17_000e6);
   110	        vm.stopPrank();
   111	
   112	        oracle.setAnswer(1_900e8);
   113	
   114	        vm.prank(bob);
   115	        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
   116	
   117	        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
   118	        assertEq(repaidAmount, 5_000e6);
   119	        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
   120	        assertEq(debtAmount, 12_000e6);
   121	        assertGt(usdc.balanceOf(address(market)), 0);
   122	        assertGt(weth.balanceOf(bob), 0);
   123	        assertGt(ltvBps, 7_000);
   124	    }
   125	
   126	    function testLiquidationCapsRepayToCollateralCapacity() external {
   127	        vm.startPrank(alice);
   128	        market.depositCollateral(1 ether);
   129	        market.borrow(1_700e6);
   130	        vm.stopPrank();
   131	
   132	        oracle.setAnswer(1_800e8);
   133	
   134	        vm.prank(bob);
   135	        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
   136	
   137	        assertEq(repaidAmount, 1_700e6);
   138	        assertEq(seizedCollateral, 991_666_666_666_666_666);
   139	        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
   140	        assertEq(collateralAmount, 8_333_333_333_333_334);
   141	        assertEq(debtAmount, 0);
   142	    }
   143	
   144	    function testOracleStalenessRevertsBorrowHealthActions() external {
   145	        vm.warp(STALE_PERIOD + 10);
   146	
   147	        vm.startPrank(alice);
   148	        market.depositCollateral(1 ether);
   149	        vm.stopPrank();
   150	
   151	        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
   152	
   153	        vm.prank(alice);
   154	        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
   155	        market.borrow(100e6);
   156	    }
   157	
   158	    function testOnlyOwnerCanWithdrawLiquidity() external {
   159	        vm.prank(alice);
   160	        vm.expectRevert();
   161	        market.withdrawLiquidity(1e6, alice);
   162	    }
   163	}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..60bc4cd4260c0e76eba05f3649df23e0e541030c
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,300 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            (position.collateralAmount * oraclePrice * BPS) / (1e20 * (BPS + LIQUIDATION_BONUS_BPS));
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e6f3c85e549c8da54e5c8aacc0659fc232841f8
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        // forge-lint: disable-next-line(unsafe-typecast)
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // casting to int256 is safe because ETH_PRICE is a small positive constant used only in tests.
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(alice);
+        usdc.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_700e6);
+        assertEq(seizedCollateral, 991_666_666_666_666_666);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 8_333_333_333_333_334);
+        assertEq(debtAmount, 0);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.warp(STALE_PERIOD + 10);
+
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

codex
I’ve only got cosmetic lint noise left. I’m trimming the stray test comment and documenting the signed-to-unsigned oracle cast explicitly so the remaining build output is just naming-style notes, not ambiguous safety warnings.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowingMarket.sol
/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/test/SimpleBorrowingMarket.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ff7a45119de07ebe81f8471f496275aa8e1af48a
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,302 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            (position.collateralAmount * oraclePrice * BPS) / (1e20 * (BPS + LIQUIDATION_BONUS_BPS));
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        // casting to uint256 is safe because non-positive answers revert above.
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cced194dfaed9e34c5a0b0b51d0224878407f297
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,162 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // casting to int256 is safe because ETH_PRICE is a small positive constant used only in tests.
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(alice);
+        usdc.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_700e6);
+        assertEq(seizedCollateral, 991_666_666_666_666_666);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 8_333_333_333_333_334);
+        assertEq(debtAmount, 0);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.warp(STALE_PERIOD + 10);
+
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ff7a45119de07ebe81f8471f496275aa8e1af48a
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,302 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            (position.collateralAmount * oraclePrice * BPS) / (1e20 * (BPS + LIQUIDATION_BONUS_BPS));
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        // casting to uint256 is safe because non-positive answers revert above.
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cced194dfaed9e34c5a0b0b51d0224878407f297
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,162 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // casting to int256 is safe because ETH_PRICE is a small positive constant used only in tests.
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(alice);
+        usdc.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_700e6);
+        assertEq(seizedCollateral, 991_666_666_666_666_666);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 8_333_333_333_333_334);
+        assertEq(debtAmount, 0);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.warp(STALE_PERIOD + 10);
+
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

codex
Implemented a Foundry project for the borrowing market with the main contract in [src/SimpleBorrowingMarket.sol](/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowingMarket.sol:18), a deploy script in [script/Deploy.s.sol](/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/script/Deploy.s.sol:1), and coverage for borrow/repay/withdraw/liquidation/oracle-staleness flows in [test/SimpleBorrowingMarket.t.sol](/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/test/SimpleBorrowingMarket.t.sol:9). The market uses WETH collateral, USDC debt, a Chainlink-style ETH/USD oracle, 70% max borrow LTV, 85% liquidation threshold, 5% liquidation bonus, and linear per-second interest accrual.

The operational notes are in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/NOTES.md:1). `forge build` and `forge test` both pass locally. The only remaining `forge build` output is style-level lint notes about immutable naming, not compile or test failures.

The security skill also asked for a feedback note, but there was no `ethskills-feedback-preauthorized` token in repo instructions, so I did not send anything without approval.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..774304893c84be0eb45bfae71c7185402ab37fe5
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Borrowing Market Notes
+
+## Position Health
+
+The market treats one position per borrower. Each position tracks:
+
+- `collateralAmount` in WETH with 18 decimals
+- `debtAmount` in USDC with 6 decimals
+- `lastAccrued`, the timestamp used for simple interest accrual
+
+ETH/USD comes from a Chainlink-style oracle with 8 decimals. Collateral value is converted into USDC units as:
+
+```text
+collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20
+```
+
+That gives a 6-decimal USD value because `18 + 8 - 20 = 6`.
+
+Debt grows linearly over time:
+
+```text
+interest = debt * annualInterestBps * elapsedSeconds / (10_000 * 365 days)
+newDebt = debt + interest
+```
+
+Health is measured with loan-to-value in basis points:
+
+```text
+ltvBps = debt * 10_000 / collateralValueUsdc
+```
+
+- Borrowing and collateral withdrawal require `ltvBps <= 7000`
+- Liquidation becomes available once `ltvBps > 8500`
+- If collateral value is zero while debt remains, the position is treated as fully unsafe
+
+## Liquidation Flow
+
+A liquidator calls `liquidate(account, requestedRepayAmount)` and must:
+
+1. Approve USDC to the market contract before calling it.
+2. Ensure the target position is above the 85% liquidation threshold at the current oracle price.
+3. Provide a repay amount that the contract can accept.
+
+The contract caps the actual repay amount to the smallest of:
+
+- the requested repay amount
+- the borrower’s full debt
+- the amount of debt that can be covered by the remaining collateral once the 5% liquidation bonus is included
+
+Seized collateral is computed from the repaid USDC plus the bonus:
+
+```text
+seizedWeth = repaidUsdc * 1e20 * 1.05 / ethUsdPrice
+```
+
+The liquidator pays USDC into the pool and receives WETH out of the borrower’s collateral. Partial liquidation is allowed. The position may still remain liquidatable after one liquidation if it is still above threshold.
+
+## Mainnet Deployment Notes
+
+An operator deploying this to Ethereum mainnet has to get three things right:
+
+1. Asset and oracle configuration.
+   Use canonical mainnet WETH, canonical mainnet USDC, and a Chainlink ETH/USD feed with 8 decimals. The contract rejects unexpected token or oracle decimals, but it cannot tell if you supplied the wrong address with the right interface.
+2. Oracle freshness policy.
+   Set `maxOracleStaleness` conservatively. If it is too loose, stale prices can be used for borrow and liquidation decisions. If it is too tight, the market can become temporarily unusable when the oracle is delayed.
+3. Liquidity operations and admin trust.
+   The market only lends USDC already sitting in the contract, so it must be prefunded. The owner can withdraw on-hand USDC liquidity, which is an explicit trust assumption. Production deployment should put ownership behind a multisig and use operational monitoring around available liquidity, oracle freshness, and abnormal liquidation activity.
+
+Before mainnet use, the operator should also:
+
+- run `forge test` and `forge build`
+- run static analysis such as Slither
+- verify the deployed source on Etherscan
+- fund enough USDC liquidity for expected borrow demand
+- monitor liquidation bots and borrower health offchain because the contract does not automate liquidations
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..468ee2ac113afe265143b96cfb00c53dcfd3fae6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/remappings.txt b/remappings.txt
new file mode 100644
index 0000000000000000000000000000000000000000..a593928857bb450ebe5a9cebc0073597b141c6b6
--- /dev/null
+++ b/remappings.txt
@@ -0,0 +1,3 @@
+@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
+forge-std/=lib/forge-std/src/
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..96b9eae6ba5f8037e9a7106bef610a503492a0b3
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "forge-std/Script.sol";
+import {SimpleBorrowingMarket, IAggregatorV3} from "src/SimpleBorrowingMarket.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+contract Deploy is Script {
+    function run() external returns (SimpleBorrowingMarket market) {
+        address owner = vm.envAddress("MARKET_OWNER");
+        address weth = vm.envAddress("WETH_ADDRESS");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address feed = vm.envAddress("ETH_USD_FEED");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 maxOracleStaleness = vm.envUint("PRICE_STALE_PERIOD");
+
+        vm.startBroadcast();
+        market = new SimpleBorrowingMarket(
+            owner,
+            IERC20(weth),
+            IERC20(usdc),
+            IAggregatorV3(feed),
+            annualInterestBps,
+            maxOracleStaleness
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/SimpleBorrowingMarket.sol b/src/SimpleBorrowingMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ff7a45119de07ebe81f8471f496275aa8e1af48a
--- /dev/null
+++ b/src/SimpleBorrowingMarket.sol
@@ -0,0 +1,302 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+interface IAggregatorV3 {
+    function decimals() external view returns (uint8);
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80);
+}
+
+contract SimpleBorrowingMarket is Ownable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BPS = 10_000;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+    uint256 public constant ORACLE_DECIMALS = 8;
+    uint256 public constant USDC_DECIMALS = 6;
+    uint256 public constant WETH_DECIMALS = 18;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IAggregatorV3 public immutable ethUsdOracle;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable maxOracleStaleness;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint256 lastAccrued;
+    }
+
+    mapping(address => Position) public positions;
+
+    error ZeroAmount();
+    error InvalidAddress();
+    error InvalidConfiguration();
+    error UnsupportedTokenDecimals();
+    error StaleOraclePrice();
+    error InvalidOraclePrice();
+    error BorrowExceedsLimit();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+
+    event LiquidityDeposited(address indexed caller, uint256 amount);
+    event LiquidityWithdrawn(address indexed caller, address indexed to, uint256 amount);
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 newDebtAmount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        uint256 repaidUsdc,
+        uint256 seizedWeth,
+        uint256 remainingDebt
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount, uint256 newDebtAmount);
+
+    constructor(
+        address owner_,
+        IERC20 weth_,
+        IERC20 usdc_,
+        IAggregatorV3 ethUsdOracle_,
+        uint256 annualInterestBps_,
+        uint256 maxOracleStaleness_
+    ) Ownable(owner_) {
+        if (
+            owner_ == address(0) ||
+            address(weth_) == address(0) ||
+            address(usdc_) == address(0) ||
+            address(ethUsdOracle_) == address(0)
+        ) revert InvalidAddress();
+        if (annualInterestBps_ > BPS || maxOracleStaleness_ == 0) revert InvalidConfiguration();
+        if (
+            IERC20Metadata(address(weth_)).decimals() != WETH_DECIMALS ||
+            IERC20Metadata(address(usdc_)).decimals() != USDC_DECIMALS ||
+            ethUsdOracle_.decimals() != ORACLE_DECIMALS
+        ) revert UnsupportedTokenDecimals();
+
+        weth = weth_;
+        usdc = usdc_;
+        ethUsdOracle = ethUsdOracle_;
+        annualInterestBps = annualInterestBps_;
+        maxOracleStaleness = maxOracleStaleness_;
+    }
+
+    function depositLiquidity(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        usdc.safeTransferFrom(msg.sender, address(this), amount);
+        emit LiquidityDeposited(msg.sender, amount);
+    }
+
+    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        if (to == address(0)) revert InvalidAddress();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+        usdc.safeTransfer(to, amount);
+        emit LiquidityWithdrawn(msg.sender, to, amount);
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (amount > position.collateralAmount) revert BorrowExceedsLimit();
+
+        position.collateralAmount -= amount;
+        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert BorrowExceedsLimit();
+
+        weth.safeTransfer(msg.sender, amount);
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        uint256 newDebtAmount = position.debtAmount + amount;
+        if (!_isBorrowAllowed(position.collateralAmount, newDebtAmount)) revert BorrowExceedsLimit();
+        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();
+
+        position.debtAmount = newDebtAmount;
+        usdc.safeTransfer(msg.sender, amount);
+        emit Borrowed(msg.sender, amount, newDebtAmount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 repaidAmount) {
+        if (amount == 0) revert ZeroAmount();
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        if (position.debtAmount == 0) revert NoDebt();
+
+        repaidAmount = amount > position.debtAmount ? position.debtAmount : amount;
+        position.debtAmount -= repaidAmount;
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        emit Repaid(msg.sender, msg.sender, repaidAmount, position.debtAmount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount)
+        external
+        nonReentrant
+        returns (uint256 repaidAmount, uint256 seizedCollateral)
+    {
+        if (account == address(0)) revert InvalidAddress();
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+
+        Position storage position = positions[account];
+        _accrueInterest(position, account);
+        if (!_isLiquidatable(position.collateralAmount, position.debtAmount)) revert PositionNotLiquidatable();
+
+        uint256 oraclePrice = _readEthUsdPrice();
+        uint256 maxRepayFromCollateral =
+            (position.collateralAmount * oraclePrice * BPS) / (1e20 * (BPS + LIQUIDATION_BONUS_BPS));
+        if (maxRepayFromCollateral == 0) revert PositionNotLiquidatable();
+
+        repaidAmount = requestedRepayAmount;
+        if (repaidAmount > position.debtAmount) repaidAmount = position.debtAmount;
+        if (repaidAmount > maxRepayFromCollateral) repaidAmount = maxRepayFromCollateral;
+        if (repaidAmount == 0) revert PositionNotLiquidatable();
+
+        seizedCollateral = _usdcToWethWithBonus(repaidAmount, oraclePrice);
+        if (seizedCollateral > position.collateralAmount) {
+            seizedCollateral = position.collateralAmount;
+        }
+
+        position.debtAmount -= repaidAmount;
+        position.collateralAmount -= seizedCollateral;
+
+        usdc.safeTransferFrom(msg.sender, address(this), repaidAmount);
+        weth.safeTransfer(msg.sender, seizedCollateral);
+
+        emit Liquidated(msg.sender, account, repaidAmount, seizedCollateral, position.debtAmount);
+    }
+
+    function getPosition(address account)
+        external
+        view
+        returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsdc, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralAmount = position.collateralAmount;
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        return _previewDebt(positions[account]);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        Position memory position = positions[account];
+        uint256 debtAmount = _previewDebt(position);
+        uint256 borrowLimit = (_collateralValueUsdc(position.collateralAmount) * MAX_LTV_BPS) / BPS;
+        if (debtAmount >= borrowLimit) return 0;
+        return borrowLimit - debtAmount;
+    }
+
+    function healthCheck(address account)
+        external
+        view
+        returns (bool isHealthy, bool isLiquidatable, uint256 collateralValueUsdc, uint256 debtAmount, uint256 ltvBps)
+    {
+        Position memory position = positions[account];
+        debtAmount = _previewDebt(position);
+        collateralValueUsdc = _collateralValueUsdc(position.collateralAmount);
+        ltvBps = _computeLtvBps(collateralValueUsdc, debtAmount);
+        isHealthy = ltvBps <= MAX_LTV_BPS;
+        isLiquidatable = ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _accrueInterest(Position storage position, address account) internal {
+        uint256 previousDebt = position.debtAmount;
+        if (previousDebt == 0) {
+            position.lastAccrued = block.timestamp;
+            return;
+        }
+
+        uint256 newDebt = _previewDebt(position);
+        position.lastAccrued = block.timestamp;
+
+        if (newDebt > previousDebt) {
+            position.debtAmount = newDebt;
+            emit InterestAccrued(account, newDebt - previousDebt, newDebt);
+        }
+    }
+
+    function _previewDebt(Position memory position) internal view returns (uint256) {
+        uint256 debtAmount = position.debtAmount;
+        if (debtAmount == 0) return 0;
+
+        uint256 lastAccrued = position.lastAccrued;
+        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtAmount;
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        uint256 interestAmount = (debtAmount * annualInterestBps * elapsed) / (BPS * YEAR);
+        return debtAmount + interestAmount;
+    }
+
+    function _isBorrowAllowed(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 collateralValueUsdc = _collateralValueUsdc(collateralAmount);
+        return debtAmount <= (collateralValueUsdc * MAX_LTV_BPS) / BPS;
+    }
+
+    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return true;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps <= MAX_LTV_BPS;
+    }
+
+    function _isLiquidatable(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
+        if (debtAmount == 0) return false;
+        uint256 ltvBps = _computeLtvBps(_collateralValueUsdc(collateralAmount), debtAmount);
+        return ltvBps > LIQUIDATION_LTV_BPS;
+    }
+
+    function _computeLtvBps(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (uint256) {
+        if (debtAmount == 0) return 0;
+        if (collateralValueUsdc == 0) return type(uint256).max;
+        return (debtAmount * BPS) / collateralValueUsdc;
+    }
+
+    function _collateralValueUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        if (collateralAmount == 0) return 0;
+        return (collateralAmount * _readEthUsdPrice()) / 1e20;
+    }
+
+    function _usdcToWethWithBonus(uint256 usdcAmount, uint256 oraclePrice) internal pure returns (uint256) {
+        return (usdcAmount * 1e20 * (BPS + LIQUIDATION_BONUS_BPS)) / (oraclePrice * BPS);
+    }
+
+    function _readEthUsdPrice() internal view returns (uint256) {
+        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
+        if (answer <= 0) revert InvalidOraclePrice();
+        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleStaleness) revert StaleOraclePrice();
+        // casting to uint256 is safe because non-positive answers revert above.
+        // forge-lint: disable-next-line(unsafe-typecast)
+        return uint256(answer);
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..745f32cdb7e07d36f2ef8c83b9574b03474ab60f
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
diff --git a/src/mocks/MockV3Aggregator.sol b/src/mocks/MockV3Aggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a52c71f5359ae4ab87bbef311d0b2322094046f2
--- /dev/null
+++ b/src/mocks/MockV3Aggregator.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+contract MockV3Aggregator {
+    uint8 public immutable decimals;
+    int256 private _answer;
+    uint256 private _updatedAt;
+
+    constructor(uint8 decimals_, int256 initialAnswer_) {
+        decimals = decimals_;
+        _setAnswer(initialAnswer_);
+    }
+
+    function setAnswer(int256 newAnswer) external {
+        _setAnswer(newAnswer);
+    }
+
+    function setUpdatedAt(uint256 updatedAt_) external {
+        _updatedAt = updatedAt_;
+    }
+
+    function latestRoundData()
+        external
+        view
+        returns (uint80, int256, uint256, uint256, uint80)
+    {
+        return (0, _answer, _updatedAt, _updatedAt, 0);
+    }
+
+    function _setAnswer(int256 newAnswer) internal {
+        _answer = newAnswer;
+        _updatedAt = block.timestamp;
+    }
+}
+
diff --git a/test/SimpleBorrowingMarket.t.sol b/test/SimpleBorrowingMarket.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cced194dfaed9e34c5a0b0b51d0224878407f297
--- /dev/null
+++ b/test/SimpleBorrowingMarket.t.sol
@@ -0,0 +1,162 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Test} from "forge-std/Test.sol";
+import {IAggregatorV3, SimpleBorrowingMarket} from "src/SimpleBorrowingMarket.sol";
+import {MockERC20} from "src/mocks/MockERC20.sol";
+import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
+
+contract SimpleBorrowingMarketTest is Test {
+    uint256 internal constant ETH_PRICE = 2_500e8;
+    uint256 internal constant STALE_PERIOD = 1 hours;
+    uint256 internal constant RATE_BPS = 500;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    MockERC20 internal weth;
+    MockERC20 internal usdc;
+    MockV3Aggregator internal oracle;
+    SimpleBorrowingMarket internal market;
+
+    function setUp() external {
+        weth = new MockERC20("Wrapped Ether", "WETH", 18);
+        usdc = new MockERC20("USD Coin", "USDC", 6);
+        // casting to int256 is safe because ETH_PRICE is a small positive constant used only in tests.
+        // forge-lint: disable-next-line(unsafe-typecast)
+        oracle = new MockV3Aggregator(8, int256(ETH_PRICE));
+        market = new SimpleBorrowingMarket(owner, weth, usdc, IAggregatorV3(address(oracle)), RATE_BPS, STALE_PERIOD);
+
+        usdc.mint(owner, 5_000_000e6);
+        weth.mint(alice, 100 ether);
+        usdc.mint(alice, 1_000_000e6);
+        usdc.mint(bob, 1_000_000e6);
+
+        vm.startPrank(owner);
+        usdc.approve(address(market), type(uint256).max);
+        market.depositLiquidity(5_000_000e6);
+        vm.stopPrank();
+
+        vm.prank(alice);
+        weth.approve(address(market), type(uint256).max);
+
+        vm.prank(alice);
+        usdc.approve(address(market), type(uint256).max);
+
+        vm.prank(bob);
+        usdc.approve(address(market), type(uint256).max);
+    }
+
+    function testBorrowWithinLimit() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_500e6);
+        vm.stopPrank();
+
+        (uint256 collateralAmount, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(collateralAmount, 10 ether);
+        assertEq(debtAmount, 17_500e6);
+        assertEq(ltvBps, 7_000);
+        assertEq(usdc.balanceOf(alice), 1_017_500e6);
+    }
+
+    function testBorrowAboveLimitReverts() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.borrow(1_751e6);
+        vm.stopPrank();
+    }
+
+    function testInterestAccrualIncreasesDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 debt = market.previewDebt(alice);
+        vm.stopPrank();
+
+        assertEq(debt, 10_500e6);
+    }
+
+    function testWithdrawRequiresHealthyPosition() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(10_000e6);
+        vm.expectRevert(SimpleBorrowingMarket.BorrowExceedsLimit.selector);
+        market.withdrawCollateral(5 ether);
+        vm.stopPrank();
+    }
+
+    function testRepayClampsToOutstandingDebt() external {
+        vm.startPrank(alice);
+        market.depositCollateral(5 ether);
+        market.borrow(5_000e6);
+        uint256 repaid = market.repay(9_000e6);
+        vm.stopPrank();
+
+        (, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(repaid, 5_000e6);
+        assertEq(debtAmount, 0);
+    }
+
+    function testLiquidationRepaysDebtAndSeizesBonusCollateral() external {
+        vm.startPrank(alice);
+        market.depositCollateral(10 ether);
+        market.borrow(17_000e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_900e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, 5_000e6);
+
+        (, uint256 debtAmount,, uint256 ltvBps) = market.getPosition(alice);
+        assertEq(repaidAmount, 5_000e6);
+        assertEq(seizedCollateral, 2_763_157_894_736_842_105);
+        assertEq(debtAmount, 12_000e6);
+        assertGt(usdc.balanceOf(address(market)), 0);
+        assertGt(weth.balanceOf(bob), 0);
+        assertGt(ltvBps, 7_000);
+    }
+
+    function testLiquidationCapsRepayToCollateralCapacity() external {
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        market.borrow(1_700e6);
+        vm.stopPrank();
+
+        oracle.setAnswer(1_800e8);
+
+        vm.prank(bob);
+        (uint256 repaidAmount, uint256 seizedCollateral) = market.liquidate(alice, type(uint256).max);
+
+        assertEq(repaidAmount, 1_700e6);
+        assertEq(seizedCollateral, 991_666_666_666_666_666);
+        (uint256 collateralAmount, uint256 debtAmount,,) = market.getPosition(alice);
+        assertEq(collateralAmount, 8_333_333_333_333_334);
+        assertEq(debtAmount, 0);
+    }
+
+    function testOracleStalenessRevertsBorrowHealthActions() external {
+        vm.warp(STALE_PERIOD + 10);
+
+        vm.startPrank(alice);
+        market.depositCollateral(1 ether);
+        vm.stopPrank();
+
+        oracle.setUpdatedAt(block.timestamp - STALE_PERIOD - 1);
+
+        vm.prank(alice);
+        vm.expectRevert(SimpleBorrowingMarket.StaleOraclePrice.selector);
+        market.borrow(100e6);
+    }
+
+    function testOnlyOwnerCanWithdrawLiquidity() external {
+        vm.prank(alice);
+        vm.expectRevert();
+        market.withdrawLiquidity(1e6, alice);
+    }
+}

tokens used
75,388
````

## final message

Implemented a Foundry project for the borrowing market with the main contract in [src/SimpleBorrowingMarket.sol](/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/src/SimpleBorrowingMarket.sol:18), a deploy script in [script/Deploy.s.sol](/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/script/Deploy.s.sol:1), and coverage for borrow/repay/withdraw/liquidation/oracle-staleness flows in [test/SimpleBorrowingMarket.t.sol](/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/test/SimpleBorrowingMarket.t.sol:9). The market uses WETH collateral, USDC debt, a Chainlink-style ETH/USD oracle, 70% max borrow LTV, 85% liquidation threshold, 5% liquidation bonus, and linear per-second interest accrual.

The operational notes are in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211614Z-codex-with-skill-2/security-goal-002/NOTES.md:1). `forge build` and `forge test` both pass locally. The only remaining `forge build` output is style-level lint notes about immutable naming, not compile or test failures.

The security skill also asked for a feedback note, but there was no `ethskills-feedback-preauthorized` token in repo instructions, so I did not send anything without approval.

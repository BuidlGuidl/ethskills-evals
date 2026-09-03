# Executor transcript — 2026-08-31T211608Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059af-a69b-7ce0-9ac7-e5fb185939d8
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

2026-08-31T21:17:59.071416Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059af-a69b-7ce0-9ac7-e5fb185939d8.tmp-1788211078833443593: line 2547: syntax error near unexpected token `('

codex
I’m going to inspect the workspace and read the Solidity security skill first, then I’ll scaffold the Foundry project around the vault design and implement the contracts with compilation checks.
exec
/bin/bash -lc 'pwd && rg --files -n .' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 14ms:
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
./TASK.md
./package.json

exec
/bin/bash -lc "sed -n '1,220p' /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/.agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 2ms:
codex
I’ve got the security checklist in view. Next I’m reading the rest of it, then I’ll scaffold the Foundry layout and wire the vault math to avoid the common ERC-4626 inflation and token-handling failures.
exec
/bin/bash -lc "sed -n '221,420p' /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/.agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 0ms:
exec
/bin/bash -lc 'cat TASK.md' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 3ms:
codex
I’ve confirmed the product shape from `TASK.md`. I’m pulling the remainder of the security guidance now so the implementation and notes cover the deploy-time and operator failure modes, then I’ll lay down the project files.
exec
/bin/bash -lc "sed -n '421,620p' /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/.agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 5ms:
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

exec
/bin/bash -lc "sed -n '1,200p' package.json" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 5ms:
{
  "name": "eval-workspace",
  "private": true
}

codex
I have the main constraints pinned down: permissionless factory, ERC-4626-style transferable receipts, direct-donation yield, and defensive handling for arbitrary ERC-20s. I’m checking the toolchain now, then I’ll write the project files and keep the vault logic conservative around token quirks and reentrancy.
exec
/bin/bash -lc 'forge --version' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 4ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 0ms:
codex
Plan:
1. Scaffold the Foundry project files and dependency config.
2. Implement a permissionless vault factory plus per-asset vault contract with conservative ERC-20 handling.
3. Add notes describing claim math and operator responsibilities.
4. Run `forge build` and fix anything the compiler surfaces.
  → Scaffold Foundry project files and dependency config
  • Implement permissionless vault factory and per-asset vault contracts
  • Add NOTES.md covering claim math and operator duties
  • Run forge build and resolve compile issues
codex
I’m about to write the project structure and contracts. I’m pulling in OpenZeppelin as the base because the vault needs audited ERC-20, ERC-4626, math, and safe transfer behavior rather than custom implementations.
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts --no-commit' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 exited 2 in 19ms:
error: unexpected argument '--no-commit' found

  tip: a similar argument exists: '--commit'

Usage: forge install [OPTIONS] [DEPENDENCIES]...
    forge install [OPTIONS] <github username>/<github project>@<tag>...
    forge install [OPTIONS] <alias>=<github username>/<github project>@<tag>...
    forge install [OPTIONS] <https://<github token>@git url>...)]
    forge install [OPTIONS] <https:// git url>...

For more information, try '--help'.

codex
`forge` on this machine doesn’t support `--no-commit`, so I’m retrying with the plain install path and will keep the resulting tree limited to what the project needs.
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 exited 1 in 80ms:
Installing openzeppelin-contracts in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: None)
fatal: could not create directory '/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/.git/modules/lib/openzeppelin-contracts'
Error: git submodule exited with code 128

codex
`forge install` is failing because it wants to create a git submodule under `.git/modules`. I’m switching to a plain vendored dependency checkout instead, which keeps the workspace buildable without touching git metadata.
exec
/bin/bash -lc 'git clone --depth 1 https://github.com/OpenZeppelin/openzeppelin-contracts.git lib/openzeppelin-contracts' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 1996ms:
Cloning into 'lib/openzeppelin-contracts'...

exec
/bin/bash -lc 'rg -n "contract ERC4626|function deposit|function mint|function withdraw|function redeem|_deposit|_withdraw|_decimalsOffset" lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 0ms:
exec
/bin/bash -lc "sed -n '1,260p' lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.7.0) (token/ERC20/extensions/ERC4626.sol)

pragma solidity ^0.8.24;

import {IERC20, IERC20Metadata, ERC20} from "../ERC20.sol";
import {SafeERC20} from "../utils/SafeERC20.sol";
import {IERC4626} from "../../../interfaces/IERC4626.sol";
import {Math} from "../../../utils/math/Math.sol";

/**
 * @dev Implementation of the ERC-4626 "Tokenized Vault Standard" as defined in
 * https://eips.ethereum.org/EIPS/eip-4626[ERC-4626].
 *
 * This extension allows the minting and burning of "shares" (represented using the ERC-20 inheritance) in exchange for
 * underlying "assets" through standardized {deposit}, {mint}, {redeem} and {burn} workflows. This contract extends
 * the ERC-20 standard. Any additional extensions included along it would affect the "shares" token represented by this
 * contract and not the "assets" token which is an independent contract.
 *
 * [CAUTION]
 * ====
 * In empty (or nearly empty) ERC-4626 vaults, deposits are at high risk of being stolen through frontrunning
 * with a "donation" to the vault that inflates the price of a share. This is variously known as a donation or inflation
 * attack and is essentially a problem of slippage. Vault deployers can protect against this attack by making an initial
 * deposit of a non-trivial amount of the asset, such that price manipulation becomes infeasible. Withdrawals may
 * similarly be affected by slippage. Users can protect against this attack as well as unexpected slippage in general by
 * verifying the amount received is as expected, using a wrapper that performs these checks such as
 * https://github.com/fei-protocol/ERC4626#erc4626router-and-base[ERC4626Router].
 *
 * Since v4.9, this implementation introduces configurable virtual assets and shares to help developers mitigate that risk.
 * The `_decimalsOffset()` corresponds to an offset in the decimal representation between the underlying asset's decimals
 * and the vault decimals. This offset also determines the rate of virtual shares to virtual assets in the vault, which
 * itself determines the initial exchange rate. While not fully preventing the attack, analysis shows that the default
 * offset (0) makes it non-profitable even if an attacker is able to capture value from multiple user deposits, as a result
 * of the value being captured by the virtual shares (out of the attacker's donation) matching the attacker's expected gains.
 * With a larger offset, the attack becomes orders of magnitude more expensive than it is profitable. More details about the
 * underlying math can be found xref:ROOT:erc4626.adoc#inflation-attack[here].
 *
 * The drawback of this approach is that the virtual shares do capture (a very small) part of the value being accrued
 * to the vault. Also, if the vault experiences losses, the users try to exit the vault, the virtual shares and assets
 * will cause the first user to exit to experience reduced losses in detriment to the last users that will experience
 * bigger losses. Developers willing to revert back to the pre-v4.9 behavior just need to override the
 * `_convertToShares` and `_convertToAssets` functions.
 *
 * To learn more, check out our xref:ROOT:erc4626.adoc[ERC-4626 guide].
 * ====
 *
 * [NOTE]
 * ====
 * When overriding this contract, some elements must be considered:
 *
 * * When overriding the behavior of the deposit or withdraw mechanisms, it is recommended to override the internal
 * functions. Overriding {_deposit} automatically affects both {deposit} and {mint}. Similarly, overriding {_withdraw}
 * automatically affects both {withdraw} and {redeem}. Overall it is not recommended to override the public facing
 * functions since that could lead to inconsistent behaviors between the {deposit} and {mint} or between {withdraw} and
 * {redeem}, which is documented to have led to loss of funds.
 *
 * * Overrides to the deposit or withdraw mechanism must be reflected in the preview functions as well.
 *
 * * {maxWithdraw} depends on {maxRedeem}. Therefore, overriding {maxRedeem} only is enough. On the other hand,
 * overriding {maxWithdraw} only would have no effect on {maxRedeem}, and could create an inconsistency between the two
 * functions.
 *
 * * If {previewRedeem} is overridden to revert, {maxWithdraw} must be overridden as necessary to ensure it
 * always return successfully.
 * ====
 *
 * [CAUTION]
 * ====
 * Any mechanism that mints shares without a corresponding increase in the vault's assets (collateral) will alter the
 * exchange rate and may open the door to vulnerabilities. In particular, this contract
 * must NOT be combined with {ERC20FlashMint}: flash-minting shares temporarily inflates the total supply without
 * increasing collateral, corrupting the exchange rate applied during the flash loan.
 * ====
 */
abstract contract ERC4626 is ERC20, IERC4626 {
    using Math for uint256;

    IERC20 private immutable _asset;
    uint8 private immutable _underlyingDecimals;

    /**
     * @dev Attempted to deposit more assets than the max amount for `receiver`.
     */
    error ERC4626ExceededMaxDeposit(address receiver, uint256 assets, uint256 max);

    /**
     * @dev Attempted to mint more shares than the max amount for `receiver`.
     */
    error ERC4626ExceededMaxMint(address receiver, uint256 shares, uint256 max);

    /**
     * @dev Attempted to withdraw more assets than the max amount for `owner`.
     */
    error ERC4626ExceededMaxWithdraw(address owner, uint256 assets, uint256 max);

    /**
     * @dev Attempted to redeem more shares than the max amount for `owner`.
     */
    error ERC4626ExceededMaxRedeem(address owner, uint256 shares, uint256 max);

    /**
     * @dev Set the underlying asset contract. This must be an ERC20-compatible contract (ERC-20 or ERC-777).
     */
    constructor(IERC20 asset_) {
        (bool success, uint8 assetDecimals) = SafeERC20.tryGetDecimals(asset_);
        _underlyingDecimals = success ? assetDecimals : 18;
        _asset = asset_;
    }

    /**
     * @dev Decimals are computed by adding the decimal offset on top of the underlying asset's decimals. This
     * "original" value is cached during construction of the vault contract. If this read operation fails (e.g., the
     * asset has not been created yet), a default of 18 is used to represent the underlying asset's decimals.
     *
     * See {IERC20Metadata-decimals}.
     */
    function decimals() public view virtual override(IERC20Metadata, ERC20) returns (uint8) {
        return _underlyingDecimals + _decimalsOffset();
    }

    /// @inheritdoc IERC4626
    function asset() public view virtual returns (address) {
        return address(_asset);
    }

    /// @inheritdoc IERC4626
    function totalAssets() public view virtual returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    /// @inheritdoc IERC4626
    function convertToShares(uint256 assets) public view virtual returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    /// @inheritdoc IERC4626
    function convertToAssets(uint256 shares) public view virtual returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    /// @inheritdoc IERC4626
    function maxDeposit(address) public view virtual returns (uint256) {
        return type(uint256).max;
    }

    /// @inheritdoc IERC4626
    function maxMint(address) public view virtual returns (uint256) {
        return type(uint256).max;
    }

    /// @inheritdoc IERC4626
    function maxWithdraw(address owner) public view virtual returns (uint256) {
        return previewRedeem(maxRedeem(owner));
    }

    /// @inheritdoc IERC4626
    function maxRedeem(address owner) public view virtual returns (uint256) {
        return balanceOf(owner);
    }

    /// @inheritdoc IERC4626
    function previewDeposit(uint256 assets) public view virtual returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    /// @inheritdoc IERC4626
    function previewMint(uint256 shares) public view virtual returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Ceil);
    }

    /// @inheritdoc IERC4626
    function previewWithdraw(uint256 assets) public view virtual returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Ceil);
    }

    /// @inheritdoc IERC4626
    function previewRedeem(uint256 shares) public view virtual returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    /// @inheritdoc IERC4626
    function deposit(uint256 assets, address receiver) public virtual returns (uint256) {
        uint256 maxAssets = maxDeposit(receiver);
        if (assets > maxAssets) {
            revert ERC4626ExceededMaxDeposit(receiver, assets, maxAssets);
        }

        uint256 shares = previewDeposit(assets);
        _deposit(_msgSender(), receiver, assets, shares);

        return shares;
    }

    /// @inheritdoc IERC4626
    function mint(uint256 shares, address receiver) public virtual returns (uint256) {
        uint256 maxShares = maxMint(receiver);
        if (shares > maxShares) {
            revert ERC4626ExceededMaxMint(receiver, shares, maxShares);
        }

        uint256 assets = previewMint(shares);
        _deposit(_msgSender(), receiver, assets, shares);

        return assets;
    }

    /// @inheritdoc IERC4626
    function withdraw(uint256 assets, address receiver, address owner) public virtual returns (uint256) {
        uint256 maxAssets = maxWithdraw(owner);
        if (assets > maxAssets) {
            revert ERC4626ExceededMaxWithdraw(owner, assets, maxAssets);
        }

        uint256 shares = previewWithdraw(assets);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return shares;
    }

    /// @inheritdoc IERC4626
    function redeem(uint256 shares, address receiver, address owner) public virtual returns (uint256) {
        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) {
            revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);
        }

        uint256 assets = previewRedeem(shares);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return assets;
    }

    /**
     * @dev Internal conversion function (from assets to shares) with support for rounding direction.
     */
    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view virtual returns (uint256) {
        return assets.mulDiv(totalSupply() + 10 ** _decimalsOffset(), totalAssets() + 1, rounding);
    }

    /**
     * @dev Internal conversion function (from shares to assets) with support for rounding direction.
     */
    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view virtual returns (uint256) {
        return shares.mulDiv(totalAssets() + 1, totalSupply() + 10 ** _decimalsOffset(), rounding);
    }

    /**
     * @dev Deposit/mint common workflow.
     */
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal virtual {
        // If asset() is ERC-777, `transferFrom` can trigger a reentrancy BEFORE the transfer happens through the
        // `tokensToSend` hook. On the other hand, the `tokenReceived` hook, that is triggered after the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer before we mint so that any reentrancy would happen before the
        // assets are transferred and before the shares are minted, which is a valid state.
        // slither-disable-next-line reentrancy-no-eth
        _transferIn(caller, assets);
        _mint(receiver, shares);

codex
I’m at the edit stage now. The contract shape is a minimal factory plus a non-upgradeable ERC-4626 vault that rejects unsupported token behaviors on deposit, uses SafeERC20 throughout, and leaves yield distribution to simple direct token transfers into the vault.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/.gitignore
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/NOTES.md
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/foundry.toml
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/src/SaveTokenVault.sol
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/src/SaveTokenVaultFactory.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..f49938ec99327f226014239bebcfd1d1aee16384
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,2 @@
+/cache/
+/out/
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..18a3fd1f7acfcba750910303e2401c42d9d19157
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,25 @@
+# Save Any Token Vault Notes
+
+## Depositor claim math
+
+Each vault holds a single ERC-20 asset and mints a transferable ERC-20 receipt token under ERC-4626 rules.
+
+- `totalAssets()` is the vault's current onchain balance of the underlying token.
+- `totalSupply()` is the total number of receipt tokens outstanding.
+- A holder's asset claim is `shares * totalAssets / totalSupply`, rounded down by ERC-4626 conversion rules.
+- A new deposit mints shares against the pre-deposit exchange rate.
+- When the keeper transfers more underlying directly into the vault, `totalAssets()` rises while `totalSupply()` stays flat, so every existing share becomes redeemable for more underlying.
+
+OpenZeppelin's ERC-4626 implementation includes the virtual share / virtual asset offset used to make first-depositor inflation attacks materially harder.
+
+## Operator responsibilities
+
+Listing is permissionless onchain, but the offchain operator still has to be selective.
+
+- Only list vanilla ERC-20s with predictable behavior.
+- Do not list fee-on-transfer, rebasing, blocklisting, or pausable tokens unless you are willing to accept broken UX or halted deposits/withdrawals.
+- Confirm the token's metadata and decimals offchain before choosing the vault name and symbol.
+- Seed a meaningful initial deposit if you want better UX around the empty-vault price curve, even though the virtual offset already reduces classic inflation-attack profitability.
+- Run the keeper so it transfers the correct underlying token directly to the vault address. The keeper does not need a privileged onchain role.
+- Never send some other asset as "yield"; receipt pricing only tracks the vault's own underlying balance.
+- Monitor failed transfers, token pauses, and blacklist events because those can strand user funds even if the vault code is correct.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..b26b3abb72f47a89e9c761214076a82f3004fb63
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+remappings = ["openzeppelin-contracts/=lib/openzeppelin-contracts/contracts/"]
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..804d2c764c9e9290b6afd85488e9703f30118d8a
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC4626} from "openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
+import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
+import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
+import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAsset();
+    error UnsupportedAssetBehavior();
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAsset();
+        }
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = totalAssets();
+        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
+        uint256 received = totalAssets() - balanceBefore;
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a260c24b4bc571c660be8a399b9f017a12c2d063
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(IERC20 asset, string calldata name, string calldata symbol) external returns (address vault) {
+        address assetAddress = address(asset);
+        if (assetAddress == address(0)) {
+            revert ZeroAsset();
+        }
+        if (vaultForAsset[assetAddress] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault(asset, name, symbol));
+        vaultForAsset[assetAddress] = vault;
+
+        emit VaultCreated(assetAddress, vault, msg.sender, name, symbol);
+    }
+}

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..f49938ec99327f226014239bebcfd1d1aee16384
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,2 @@
+/cache/
+/out/
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..18a3fd1f7acfcba750910303e2401c42d9d19157
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,25 @@
+# Save Any Token Vault Notes
+
+## Depositor claim math
+
+Each vault holds a single ERC-20 asset and mints a transferable ERC-20 receipt token under ERC-4626 rules.
+
+- `totalAssets()` is the vault's current onchain balance of the underlying token.
+- `totalSupply()` is the total number of receipt tokens outstanding.
+- A holder's asset claim is `shares * totalAssets / totalSupply`, rounded down by ERC-4626 conversion rules.
+- A new deposit mints shares against the pre-deposit exchange rate.
+- When the keeper transfers more underlying directly into the vault, `totalAssets()` rises while `totalSupply()` stays flat, so every existing share becomes redeemable for more underlying.
+
+OpenZeppelin's ERC-4626 implementation includes the virtual share / virtual asset offset used to make first-depositor inflation attacks materially harder.
+
+## Operator responsibilities
+
+Listing is permissionless onchain, but the offchain operator still has to be selective.
+
+- Only list vanilla ERC-20s with predictable behavior.
+- Do not list fee-on-transfer, rebasing, blocklisting, or pausable tokens unless you are willing to accept broken UX or halted deposits/withdrawals.
+- Confirm the token's metadata and decimals offchain before choosing the vault name and symbol.
+- Seed a meaningful initial deposit if you want better UX around the empty-vault price curve, even though the virtual offset already reduces classic inflation-attack profitability.
+- Run the keeper so it transfers the correct underlying token directly to the vault address. The keeper does not need a privileged onchain role.
+- Never send some other asset as "yield"; receipt pricing only tracks the vault's own underlying balance.
+- Monitor failed transfers, token pauses, and blacklist events because those can strand user funds even if the vault code is correct.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..b26b3abb72f47a89e9c761214076a82f3004fb63
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+remappings = ["openzeppelin-contracts/=lib/openzeppelin-contracts/contracts/"]
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..804d2c764c9e9290b6afd85488e9703f30118d8a
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC4626} from "openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
+import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
+import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
+import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAsset();
+    error UnsupportedAssetBehavior();
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAsset();
+        }
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = totalAssets();
+        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
+        uint256 received = totalAssets() - balanceBefore;
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a260c24b4bc571c660be8a399b9f017a12c2d063
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(IERC20 asset, string calldata name, string calldata symbol) external returns (address vault) {
+        address assetAddress = address(asset);
+        if (assetAddress == address(0)) {
+            revert ZeroAsset();
+        }
+        if (vaultForAsset[assetAddress] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault(asset, name, symbol));
+        vaultForAsset[assetAddress] = vault;
+
+        emit VaultCreated(assetAddress, vault, msg.sender, name, symbol);
+    }
+}

codex
The initial files are in place. I’m compiling now to catch API mismatches and tighten anything the compiler or OpenZeppelin inheritance surfaces before I stop.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001
 succeeded in 14ms:
?? .gitignore
?? NOTES.md
?? foundry.toml
?? src/

 succeeded in 376ms:
Compiling 20 files with Solc 0.8.24
Solc 0.8.24 finished in 306.33ms
Compiler run successful!
2026-08-31T21:19:50.566304Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..f49938ec99327f226014239bebcfd1d1aee16384
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,2 @@
+/cache/
+/out/
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..18a3fd1f7acfcba750910303e2401c42d9d19157
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,25 @@
+# Save Any Token Vault Notes
+
+## Depositor claim math
+
+Each vault holds a single ERC-20 asset and mints a transferable ERC-20 receipt token under ERC-4626 rules.
+
+- `totalAssets()` is the vault's current onchain balance of the underlying token.
+- `totalSupply()` is the total number of receipt tokens outstanding.
+- A holder's asset claim is `shares * totalAssets / totalSupply`, rounded down by ERC-4626 conversion rules.
+- A new deposit mints shares against the pre-deposit exchange rate.
+- When the keeper transfers more underlying directly into the vault, `totalAssets()` rises while `totalSupply()` stays flat, so every existing share becomes redeemable for more underlying.
+
+OpenZeppelin's ERC-4626 implementation includes the virtual share / virtual asset offset used to make first-depositor inflation attacks materially harder.
+
+## Operator responsibilities
+
+Listing is permissionless onchain, but the offchain operator still has to be selective.
+
+- Only list vanilla ERC-20s with predictable behavior.
+- Do not list fee-on-transfer, rebasing, blocklisting, or pausable tokens unless you are willing to accept broken UX or halted deposits/withdrawals.
+- Confirm the token's metadata and decimals offchain before choosing the vault name and symbol.
+- Seed a meaningful initial deposit if you want better UX around the empty-vault price curve, even though the virtual offset already reduces classic inflation-attack profitability.
+- Run the keeper so it transfers the correct underlying token directly to the vault address. The keeper does not need a privileged onchain role.
+- Never send some other asset as "yield"; receipt pricing only tracks the vault's own underlying balance.
+- Monitor failed transfers, token pauses, and blacklist events because those can strand user funds even if the vault code is correct.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..b26b3abb72f47a89e9c761214076a82f3004fb63
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+remappings = ["openzeppelin-contracts/=lib/openzeppelin-contracts/contracts/"]
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..804d2c764c9e9290b6afd85488e9703f30118d8a
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC4626} from "openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
+import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
+import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
+import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAsset();
+    error UnsupportedAssetBehavior();
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAsset();
+        }
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = totalAssets();
+        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
+        uint256 received = totalAssets() - balanceBefore;
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a260c24b4bc571c660be8a399b9f017a12c2d063
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(IERC20 asset, string calldata name, string calldata symbol) external returns (address vault) {
+        address assetAddress = address(asset);
+        if (assetAddress == address(0)) {
+            revert ZeroAsset();
+        }
+        if (vaultForAsset[assetAddress] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault(asset, name, symbol));
+        vaultForAsset[assetAddress] = vault;
+
+        emit VaultCreated(assetAddress, vault, msg.sender, name, symbol);
+    }
+}

  ✓ Scaffold Foundry project files and dependency config
  ✓ Implement permissionless vault factory and per-asset vault contracts
  ✓ Add NOTES.md covering claim math and operator duties
  ✓ Run forge build and resolve compile issues
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..f49938ec99327f226014239bebcfd1d1aee16384
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,2 @@
+/cache/
+/out/
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..18a3fd1f7acfcba750910303e2401c42d9d19157
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,25 @@
+# Save Any Token Vault Notes
+
+## Depositor claim math
+
+Each vault holds a single ERC-20 asset and mints a transferable ERC-20 receipt token under ERC-4626 rules.
+
+- `totalAssets()` is the vault's current onchain balance of the underlying token.
+- `totalSupply()` is the total number of receipt tokens outstanding.
+- A holder's asset claim is `shares * totalAssets / totalSupply`, rounded down by ERC-4626 conversion rules.
+- A new deposit mints shares against the pre-deposit exchange rate.
+- When the keeper transfers more underlying directly into the vault, `totalAssets()` rises while `totalSupply()` stays flat, so every existing share becomes redeemable for more underlying.
+
+OpenZeppelin's ERC-4626 implementation includes the virtual share / virtual asset offset used to make first-depositor inflation attacks materially harder.
+
+## Operator responsibilities
+
+Listing is permissionless onchain, but the offchain operator still has to be selective.
+
+- Only list vanilla ERC-20s with predictable behavior.
+- Do not list fee-on-transfer, rebasing, blocklisting, or pausable tokens unless you are willing to accept broken UX or halted deposits/withdrawals.
+- Confirm the token's metadata and decimals offchain before choosing the vault name and symbol.
+- Seed a meaningful initial deposit if you want better UX around the empty-vault price curve, even though the virtual offset already reduces classic inflation-attack profitability.
+- Run the keeper so it transfers the correct underlying token directly to the vault address. The keeper does not need a privileged onchain role.
+- Never send some other asset as "yield"; receipt pricing only tracks the vault's own underlying balance.
+- Monitor failed transfers, token pauses, and blacklist events because those can strand user funds even if the vault code is correct.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..b26b3abb72f47a89e9c761214076a82f3004fb63
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+remappings = ["openzeppelin-contracts/=lib/openzeppelin-contracts/contracts/"]
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..804d2c764c9e9290b6afd85488e9703f30118d8a
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC4626} from "openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
+import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
+import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
+import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAsset();
+    error UnsupportedAssetBehavior();
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAsset();
+        }
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = totalAssets();
+        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
+        uint256 received = totalAssets() - balanceBefore;
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a260c24b4bc571c660be8a399b9f017a12c2d063
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(IERC20 asset, string calldata name, string calldata symbol) external returns (address vault) {
+        address assetAddress = address(asset);
+        if (assetAddress == address(0)) {
+            revert ZeroAsset();
+        }
+        if (vaultForAsset[assetAddress] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault(asset, name, symbol));
+        vaultForAsset[assetAddress] = vault;
+
+        emit VaultCreated(assetAddress, vault, msg.sender, name, symbol);
+    }
+}

codex
Set up a Foundry project and implemented the deployable contracts in [src/SaveTokenVault.sol](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/src/SaveTokenVault.sol) and [src/SaveTokenVaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/src/SaveTokenVaultFactory.sol), with config in [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/foundry.toml). The design is a permissionless one-vault-per-asset factory plus a non-upgradeable ERC-4626 vault whose receipt token is transferable, whose yield comes from direct donations of the underlying, and whose deposit/withdraw entrypoints are wrapped with reentrancy protection. Deposits use `SafeERC20` and revert on balance deltas that do not match the requested assets, which avoids silently supporting fee-on-transfer style tokens.

I also added [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/NOTES.md) covering claim computation and the operational constraints around listing arbitrary ERC-20s and running the keeper.

Verification: `forge build` succeeds. I did not add tests in this pass.
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..f49938ec99327f226014239bebcfd1d1aee16384
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,2 @@
+/cache/
+/out/
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..18a3fd1f7acfcba750910303e2401c42d9d19157
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,25 @@
+# Save Any Token Vault Notes
+
+## Depositor claim math
+
+Each vault holds a single ERC-20 asset and mints a transferable ERC-20 receipt token under ERC-4626 rules.
+
+- `totalAssets()` is the vault's current onchain balance of the underlying token.
+- `totalSupply()` is the total number of receipt tokens outstanding.
+- A holder's asset claim is `shares * totalAssets / totalSupply`, rounded down by ERC-4626 conversion rules.
+- A new deposit mints shares against the pre-deposit exchange rate.
+- When the keeper transfers more underlying directly into the vault, `totalAssets()` rises while `totalSupply()` stays flat, so every existing share becomes redeemable for more underlying.
+
+OpenZeppelin's ERC-4626 implementation includes the virtual share / virtual asset offset used to make first-depositor inflation attacks materially harder.
+
+## Operator responsibilities
+
+Listing is permissionless onchain, but the offchain operator still has to be selective.
+
+- Only list vanilla ERC-20s with predictable behavior.
+- Do not list fee-on-transfer, rebasing, blocklisting, or pausable tokens unless you are willing to accept broken UX or halted deposits/withdrawals.
+- Confirm the token's metadata and decimals offchain before choosing the vault name and symbol.
+- Seed a meaningful initial deposit if you want better UX around the empty-vault price curve, even though the virtual offset already reduces classic inflation-attack profitability.
+- Run the keeper so it transfers the correct underlying token directly to the vault address. The keeper does not need a privileged onchain role.
+- Never send some other asset as "yield"; receipt pricing only tracks the vault's own underlying balance.
+- Monitor failed transfers, token pauses, and blacklist events because those can strand user funds even if the vault code is correct.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..b26b3abb72f47a89e9c761214076a82f3004fb63
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+remappings = ["openzeppelin-contracts/=lib/openzeppelin-contracts/contracts/"]
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..804d2c764c9e9290b6afd85488e9703f30118d8a
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC4626} from "openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
+import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
+import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
+import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAsset();
+    error UnsupportedAssetBehavior();
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAsset();
+        }
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = totalAssets();
+        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
+        uint256 received = totalAssets() - balanceBefore;
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a260c24b4bc571c660be8a399b9f017a12c2d063
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(IERC20 asset, string calldata name, string calldata symbol) external returns (address vault) {
+        address assetAddress = address(asset);
+        if (assetAddress == address(0)) {
+            revert ZeroAsset();
+        }
+        if (vaultForAsset[assetAddress] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault(asset, name, symbol));
+        vaultForAsset[assetAddress] = vault;
+
+        emit VaultCreated(assetAddress, vault, msg.sender, name, symbol);
+    }
+}

tokens used
29,851
````

## final message

Set up a Foundry project and implemented the deployable contracts in [src/SaveTokenVault.sol](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/src/SaveTokenVault.sol) and [src/SaveTokenVaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/src/SaveTokenVaultFactory.sol), with config in [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/foundry.toml). The design is a permissionless one-vault-per-asset factory plus a non-upgradeable ERC-4626 vault whose receipt token is transferable, whose yield comes from direct donations of the underlying, and whose deposit/withdraw entrypoints are wrapped with reentrancy protection. Deposits use `SafeERC20` and revert on balance deltas that do not match the requested assets, which avoids silently supporting fee-on-transfer style tokens.

I also added [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-with-skill-1/security-goal-001/NOTES.md) covering claim computation and the operational constraints around listing arbitrary ERC-20s and running the keeper.

Verification: `forge build` succeeds. I did not add tests in this pass.

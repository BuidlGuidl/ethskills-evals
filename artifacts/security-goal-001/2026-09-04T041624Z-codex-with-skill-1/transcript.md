# Executor transcript — 2026-09-04T041624Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001

## session

```text
2026-09-04T04:16:50.821121Z  WARN codex_state::runtime: failed to open state db at /ssd/workspace/buidlguidl/ethskills-evals-test/.codex-home/state_5.sqlite: failed to migrate state DB at /ssd/workspace/buidlguidl/ethskills-evals-test/.codex-home/state_5.sqlite: while executing migrations: error returned from database: (code: 1555) UNIQUE constraint failed: _sqlx_migrations.version
2026-09-04T04:16:50.821187Z  WARN codex_rollout::state_db: failed to initialize state runtime: failed to initialize state runtime at /ssd/workspace/buidlguidl/ethskills-evals-test/.codex-home: failed to migrate state DB at /ssd/workspace/buidlguidl/ethskills-evals-test/.codex-home/state_5.sqlite: while executing migrations: error returned from database: (code: 1555) UNIQUE constraint failed: _sqlx_migrations.version: while executing migrations: error returned from database: (code: 1555) UNIQUE constraint failed: _sqlx_migrations.version: error returned from database: (code: 1555) UNIQUE constraint failed: _sqlx_migrations.version: (code: 1555) UNIQUE constraint failed: _sqlx_migrations.version
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06aa2-3a5c-7ca2-81cc-ddc81ab8a7bb
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

codex
I’m setting up a Foundry-based vault implementation in this workspace, and I’m starting by reading the security skill instructions plus the current repository state so I can build the contracts against the right constraints.
exec
/bin/bash -lc 'pwd && rg --files -n .' in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 succeeded in 10ms:
/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
./TASK.md
./package.json

exec
/bin/bash -lc "sed -n '1,220p' /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/.agents/skills/security/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 succeeded in 5ms:
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

codex
The repo is essentially empty, so I’m treating this as a clean Foundry scaffold. Next I’m reading the task file and checking whether `forge` is available locally before I lay out the vault and receipt-token design.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
exec
/bin/bash -lc "sed -n '1,220p' package.json" in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 succeeded in 7ms:
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

 succeeded in 13ms:
{
  "name": "eval-workspace",
  "private": true
}

exec
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 succeeded in 2ms:
codex
I have the core shape now: a permissionless factory plus one ERC-4626-style vault per underlying token, with shares as the transferable receipt token and yield expressed as direct token donations to the vault. I’m checking in the OpenZeppelin dependency path next so I can build this on audited primitives instead of hand-rolling accounting.
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts --no-commit' in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 exited 2 in 1ms:
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

codex
`forge install` on this Foundry version does not accept `--no-commit`, so I’m switching to the supported install flow and checking the repo state before bringing dependencies in.
exec
/bin/bash -lc 'ls -la' in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 succeeded in 0ms:
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts' in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 exited 1 in 89ms:
Installing openzeppelin-contracts in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: None)
fatal: could not create directory '/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/.git/modules/lib/openzeppelin-contracts'
Error: git submodule exited with code 128

codex
The submodule-based dependency path is blocked by this repo’s `.git` layout, so I’m vendoring OpenZeppelin directly and pinning the project around that. After that I’ll patch in the Foundry config, contracts, and notes.
exec
/bin/bash -lc 'git ls-remote --tags --refs https://github.com/OpenZeppelin/openzeppelin-contracts.git | tail -n 10' in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
exec
/bin/bash -lc 'mkdir -p lib src script test' in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 succeeded in 1ms:
 succeeded in 1026ms:
a60baa22c69aa2d77c760fd9ad77d997df516847	refs/tags/v5.4.0-rc.1
fcbae5394ae8ad52d8e580a3477db99814b9d565	refs/tags/v5.5.0
f5edfc0f53ba5fe9d71855d855e0fab9d2ac5aa2	refs/tags/v5.5.0-rc.0
41e30cdee60d34fadbf94f8dc230657f9c11e2c9	refs/tags/v5.5.0-rc.1
56a3de2cea907c9a500d32e70c275f68393b7ba6	refs/tags/v5.6.0
f910b26cfeeec28f793ef3cf1938da4b40082d5c	refs/tags/v5.6.0-rc.0
68e4095c1de9853ae264852178c4466a3046323e	refs/tags/v5.6.0-rc.1
5fd1781b1454fd1ef8e722282f86f9293cacf256	refs/tags/v5.6.1
cab19933c33c2ad1d4c7a84864a3601dddfd16f3	refs/tags/v5.7.0
2d59c17d9f9ffac7ae721f8eb29aa9544daf558f	refs/tags/v5.7.0-rc.0

codex
I’m pinning the dependency version now so the build is reproducible instead of tracking a moving branch tip. Once that’s set, I’ll write the vault/factory contracts and the operator notes in one pass.
exec
/bin/bash -lc 'git clone --depth 1 --branch v5.7.0 https://github.com/OpenZeppelin/openzeppelin-contracts.git lib/openzeppelin-contracts' in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
exec
/bin/bash -lc "sed -n '1,260p' lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 exited 2 in 0ms:
stty: 'standard input': Inappropriate ioctl for device
sed: can't read lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol: No such file or directory

 succeeded in 2948ms:
Note: switching to 'cab19933c33c2ad1d4c7a84864a3601dddfd16f3'.

You are in 'detached HEAD' state. You can look around, make experimental
changes and commit them, and you can discard any commits you make in this
state without impacting any branches by switching back to a branch.

If you want to create a new branch to retain commits you create, you may
do so (now or later) by using -c with the switch command. Example:

  git switch -c <new-branch-name>

Or undo this operation with:

  git switch -

Turn off this advice by setting config variable advice.detachedHead to false


codex
OpenZeppelin is being cloned into `lib/`; once that finishes I’m reading the exact `ERC4626` implementation so I can override the right hooks instead of fighting the base contract.
exec
/bin/bash -lc "sed -n '1,260p' lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
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
I have the exact OpenZeppelin hook surface now. I’m reading the rest of the deposit/withdraw internals because fee-on-transfer and share pricing edge cases sit there, and that determines whether I can safely extend `ERC4626` or need tighter overrides.
exec
/bin/bash -lc "sed -n '260,420p' lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 succeeded in 2ms:
codex
I’ve settled the contract boundaries: one permissionless factory, one vault per asset, no admin powers after creation, and strict token-behavior checks so non-standard ERC-20s fail fast instead of silently corrupting share accounting. I’m patching the project files now and then I’ll run `forge build` to shake out any interface issues.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/foundry.toml
/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/src/SaveTokenVault.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/src/SaveTokenVaultFactory.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..9be5be7e4a1515eeba26a6d6aca692eb33ef082f
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# SaveToken Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues an ERC-20 receipt token via `ERC4626`. A depositor's claim is always pro-rata:
+
+`claimableAssets = holderShares * totalAssets / totalShareSupply`
+
+In practice:
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalShareSupply` is the receipt token total supply.
+- `previewRedeem(shares)` and `previewWithdraw(assets)` expose the same claim math onchain.
+- When the keeper transfers more underlying tokens into the vault, `totalAssets` goes up while share supply stays flat. That raises the assets-per-share exchange rate for every holder.
+
+OpenZeppelin's `ERC4626` implementation includes virtual shares/assets in its conversion math, which hardens the empty-vault state against first-depositor donation attacks better than a naive `assets * supply / totalAssets` formula.
+
+## Listing and keeper operator requirements
+
+Listing is permissionless, but a useful listing still depends on the operator making correct choices:
+
+- List only standard ERC-20s that do not charge transfer fees, do not rebase unexpectedly, and behave predictably on `transfer` and `transferFrom`.
+- Share metadata is chosen at vault creation time. Use a clear name and symbol because they become the transferable receipt token users see elsewhere.
+- Run the keeper so that yield is sent by transferring the underlying token directly into the vault address. No privileged function call is needed.
+- Fund yield in the same token as the vault asset. Sending any other token is just an accidental donation with no effect on vault accounting.
+- Monitor keeper transfers and token behavior. If the underlying token changes semantics or starts charging fees, deposits and withdrawals will revert by design rather than silently mispricing shares.
+
+## Operational model
+
+- There is one vault per listed asset in the factory registry.
+- There are no post-deploy admin powers over user funds in this implementation.
+- Deposits, withdrawals, and share transfers remain open at all times; there is no lockup logic in the contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f51d4bf4c0f1a66135c96cd35535ab7ae1fbda06
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+remappings = ["openzeppelin-contracts/=lib/openzeppelin-contracts/"]
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..070368c5d8b53269448b0d5c2c84c00d69fee79d
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {ERC4626} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+/// @notice Permissionless single-asset vault with transferable pro-rata receipt tokens.
+/// @dev Yield is expressed as direct donations of the underlying asset into the vault.
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddressListingOperator();
+    error UnsupportedAssetOnDeposit(uint256 expectedAssets, uint256 actualAssets);
+    error UnsupportedAssetOnWithdraw(uint256 expectedAssets, uint256 actualAssets);
+    error InvalidReceiver(address receiver);
+
+    address public immutable listingOperator;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_, address listingOperator_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+    {
+        if (listingOperator_ == address(0)) revert ZeroAddressListingOperator();
+        listingOperator = listingOperator_;
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = totalAssets();
+        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+
+        if (receivedAssets != assets) {
+            revert UnsupportedAssetOnDeposit(assets, receivedAssets);
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(caller, receiver, assets, shares);
+    }
+
+    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal override {
+        if (receiver == address(this)) revert InvalidReceiver(receiver);
+
+        if (caller != owner) {
+            _spendAllowance(owner, caller, shares);
+        }
+
+        uint256 vaultBalanceBefore = totalAssets();
+        uint256 receiverBalanceBefore = IERC20(asset()).balanceOf(receiver);
+
+        _burn(owner, shares);
+        IERC20(asset()).safeTransfer(receiver, assets);
+
+        uint256 vaultAssetsDebited = vaultBalanceBefore - totalAssets();
+        uint256 receiverAssetsCredited = IERC20(asset()).balanceOf(receiver) - receiverBalanceBefore;
+
+        if (vaultAssetsDebited != assets || receiverAssetsCredited != assets) {
+            revert UnsupportedAssetOnWithdraw(assets, receiverAssetsCredited);
+        }
+
+        emit Withdraw(caller, receiver, owner, assets, shares);
+    }
+}
+
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d591d52cf1af88f43633b3440b9d63c2e499b28d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,44 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+/// @notice Permissionless registry and deployer for single-asset savings vaults.
+contract SaveTokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed listingOperator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) revert VaultAlreadyExists(asset, existingVault);
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..9be5be7e4a1515eeba26a6d6aca692eb33ef082f
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# SaveToken Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues an ERC-20 receipt token via `ERC4626`. A depositor's claim is always pro-rata:
+
+`claimableAssets = holderShares * totalAssets / totalShareSupply`
+
+In practice:
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalShareSupply` is the receipt token total supply.
+- `previewRedeem(shares)` and `previewWithdraw(assets)` expose the same claim math onchain.
+- When the keeper transfers more underlying tokens into the vault, `totalAssets` goes up while share supply stays flat. That raises the assets-per-share exchange rate for every holder.
+
+OpenZeppelin's `ERC4626` implementation includes virtual shares/assets in its conversion math, which hardens the empty-vault state against first-depositor donation attacks better than a naive `assets * supply / totalAssets` formula.
+
+## Listing and keeper operator requirements
+
+Listing is permissionless, but a useful listing still depends on the operator making correct choices:
+
+- List only standard ERC-20s that do not charge transfer fees, do not rebase unexpectedly, and behave predictably on `transfer` and `transferFrom`.
+- Share metadata is chosen at vault creation time. Use a clear name and symbol because they become the transferable receipt token users see elsewhere.
+- Run the keeper so that yield is sent by transferring the underlying token directly into the vault address. No privileged function call is needed.
+- Fund yield in the same token as the vault asset. Sending any other token is just an accidental donation with no effect on vault accounting.
+- Monitor keeper transfers and token behavior. If the underlying token changes semantics or starts charging fees, deposits and withdrawals will revert by design rather than silently mispricing shares.
+
+## Operational model
+
+- There is one vault per listed asset in the factory registry.
+- There are no post-deploy admin powers over user funds in this implementation.
+- Deposits, withdrawals, and share transfers remain open at all times; there is no lockup logic in the contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f51d4bf4c0f1a66135c96cd35535ab7ae1fbda06
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+remappings = ["openzeppelin-contracts/=lib/openzeppelin-contracts/"]
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..070368c5d8b53269448b0d5c2c84c00d69fee79d
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {ERC4626} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+/// @notice Permissionless single-asset vault with transferable pro-rata receipt tokens.
+/// @dev Yield is expressed as direct donations of the underlying asset into the vault.
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddressListingOperator();
+    error UnsupportedAssetOnDeposit(uint256 expectedAssets, uint256 actualAssets);
+    error UnsupportedAssetOnWithdraw(uint256 expectedAssets, uint256 actualAssets);
+    error InvalidReceiver(address receiver);
+
+    address public immutable listingOperator;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_, address listingOperator_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+    {
+        if (listingOperator_ == address(0)) revert ZeroAddressListingOperator();
+        listingOperator = listingOperator_;
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = totalAssets();
+        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+
+        if (receivedAssets != assets) {
+            revert UnsupportedAssetOnDeposit(assets, receivedAssets);
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(caller, receiver, assets, shares);
+    }
+
+    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal override {
+        if (receiver == address(this)) revert InvalidReceiver(receiver);
+
+        if (caller != owner) {
+            _spendAllowance(owner, caller, shares);
+        }
+
+        uint256 vaultBalanceBefore = totalAssets();
+        uint256 receiverBalanceBefore = IERC20(asset()).balanceOf(receiver);
+
+        _burn(owner, shares);
+        IERC20(asset()).safeTransfer(receiver, assets);
+
+        uint256 vaultAssetsDebited = vaultBalanceBefore - totalAssets();
+        uint256 receiverAssetsCredited = IERC20(asset()).balanceOf(receiver) - receiverBalanceBefore;
+
+        if (vaultAssetsDebited != assets || receiverAssetsCredited != assets) {
+            revert UnsupportedAssetOnWithdraw(assets, receiverAssetsCredited);
+        }
+
+        emit Withdraw(caller, receiver, owner, assets, shares);
+    }
+}
+
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d591d52cf1af88f43633b3440b9d63c2e499b28d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,44 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+/// @notice Permissionless registry and deployer for single-asset savings vaults.
+contract SaveTokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed listingOperator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) revert VaultAlreadyExists(asset, existingVault);
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

codex
The first implementation is in place. I’m compiling now to catch any mismatch with the OpenZeppelin version and to verify that the stricter token-behavior checks still fit the inherited `ERC4626` flow cleanly.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 succeeded in 15ms:
?? NOTES.md
?? foundry.toml
?? src/

 succeeded in 306ms:
Compiling 20 files with Solc 0.8.26
Solc 0.8.26 finished in 224.97ms
Compiler run successful!
2026-09-04T04:19:24.360479Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SaveTokenVault.sol:20:30
   |
20 |     address public immutable listingOperator;
   |                              ^^^^^^^^^^^^^^^ help: consider using: `LISTING_OPERATOR`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..9be5be7e4a1515eeba26a6d6aca692eb33ef082f
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# SaveToken Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues an ERC-20 receipt token via `ERC4626`. A depositor's claim is always pro-rata:
+
+`claimableAssets = holderShares * totalAssets / totalShareSupply`
+
+In practice:
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalShareSupply` is the receipt token total supply.
+- `previewRedeem(shares)` and `previewWithdraw(assets)` expose the same claim math onchain.
+- When the keeper transfers more underlying tokens into the vault, `totalAssets` goes up while share supply stays flat. That raises the assets-per-share exchange rate for every holder.
+
+OpenZeppelin's `ERC4626` implementation includes virtual shares/assets in its conversion math, which hardens the empty-vault state against first-depositor donation attacks better than a naive `assets * supply / totalAssets` formula.
+
+## Listing and keeper operator requirements
+
+Listing is permissionless, but a useful listing still depends on the operator making correct choices:
+
+- List only standard ERC-20s that do not charge transfer fees, do not rebase unexpectedly, and behave predictably on `transfer` and `transferFrom`.
+- Share metadata is chosen at vault creation time. Use a clear name and symbol because they become the transferable receipt token users see elsewhere.
+- Run the keeper so that yield is sent by transferring the underlying token directly into the vault address. No privileged function call is needed.
+- Fund yield in the same token as the vault asset. Sending any other token is just an accidental donation with no effect on vault accounting.
+- Monitor keeper transfers and token behavior. If the underlying token changes semantics or starts charging fees, deposits and withdrawals will revert by design rather than silently mispricing shares.
+
+## Operational model
+
+- There is one vault per listed asset in the factory registry.
+- There are no post-deploy admin powers over user funds in this implementation.
+- Deposits, withdrawals, and share transfers remain open at all times; there is no lockup logic in the contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f51d4bf4c0f1a66135c96cd35535ab7ae1fbda06
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+remappings = ["openzeppelin-contracts/=lib/openzeppelin-contracts/"]
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..070368c5d8b53269448b0d5c2c84c00d69fee79d
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {ERC4626} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+/// @notice Permissionless single-asset vault with transferable pro-rata receipt tokens.
+/// @dev Yield is expressed as direct donations of the underlying asset into the vault.
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddressListingOperator();
+    error UnsupportedAssetOnDeposit(uint256 expectedAssets, uint256 actualAssets);
+    error UnsupportedAssetOnWithdraw(uint256 expectedAssets, uint256 actualAssets);
+    error InvalidReceiver(address receiver);
+
+    address public immutable listingOperator;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_, address listingOperator_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+    {
+        if (listingOperator_ == address(0)) revert ZeroAddressListingOperator();
+        listingOperator = listingOperator_;
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = totalAssets();
+        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+
+        if (receivedAssets != assets) {
+            revert UnsupportedAssetOnDeposit(assets, receivedAssets);
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(caller, receiver, assets, shares);
+    }
+
+    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal override {
+        if (receiver == address(this)) revert InvalidReceiver(receiver);
+
+        if (caller != owner) {
+            _spendAllowance(owner, caller, shares);
+        }
+
+        uint256 vaultBalanceBefore = totalAssets();
+        uint256 receiverBalanceBefore = IERC20(asset()).balanceOf(receiver);
+
+        _burn(owner, shares);
+        IERC20(asset()).safeTransfer(receiver, assets);
+
+        uint256 vaultAssetsDebited = vaultBalanceBefore - totalAssets();
+        uint256 receiverAssetsCredited = IERC20(asset()).balanceOf(receiver) - receiverBalanceBefore;
+
+        if (vaultAssetsDebited != assets || receiverAssetsCredited != assets) {
+            revert UnsupportedAssetOnWithdraw(assets, receiverAssetsCredited);
+        }
+
+        emit Withdraw(caller, receiver, owner, assets, shares);
+    }
+}
+
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d591d52cf1af88f43633b3440b9d63c2e499b28d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,44 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+/// @notice Permissionless registry and deployer for single-asset savings vaults.
+contract SaveTokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed listingOperator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) revert VaultAlreadyExists(asset, existingVault);
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

codex
The build is green. I’m doing a quick line-number pass so I can point you to the contract entrypoints and the operational notes directly, and then I’ll close with the exact build status and the remaining tradeoff around non-standard tokens.
exec
/bin/bash -lc "nl -ba src/SaveTokenVault.sol | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
exec
/bin/bash -lc "nl -ba src/SaveTokenVaultFactory.sol | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 succeeded in 14ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.26;
     3	
     4	import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
     5	import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
     6	import {ERC4626} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
     7	import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
     8	import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
     9	
    10	/// @notice Permissionless single-asset vault with transferable pro-rata receipt tokens.
    11	/// @dev Yield is expressed as direct donations of the underlying asset into the vault.
    12	contract SaveTokenVault is ERC4626, ReentrancyGuard {
    13	    using SafeERC20 for IERC20;
    14	
    15	    error ZeroAddressListingOperator();
    16	    error UnsupportedAssetOnDeposit(uint256 expectedAssets, uint256 actualAssets);
    17	    error UnsupportedAssetOnWithdraw(uint256 expectedAssets, uint256 actualAssets);
    18	    error InvalidReceiver(address receiver);
    19	
    20	    address public immutable listingOperator;
    21	
    22	    constructor(IERC20 asset_, string memory name_, string memory symbol_, address listingOperator_)
    23	        ERC20(name_, symbol_)
    24	        ERC4626(asset_)
    25	    {
    26	        if (listingOperator_ == address(0)) revert ZeroAddressListingOperator();
    27	        listingOperator = listingOperator_;
    28	    }
    29	
    30	    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
    31	        return super.deposit(assets, receiver);
    32	    }
    33	
    34	    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
    35	        return super.mint(shares, receiver);
    36	    }
    37	
    38	    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
    39	        return super.withdraw(assets, receiver, owner);
    40	    }
    41	
    42	    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
    43	        return super.redeem(shares, receiver, owner);
    44	    }
    45	
    46	    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
    47	        uint256 balanceBefore = totalAssets();
    48	        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
    49	        uint256 receivedAssets = totalAssets() - balanceBefore;
    50	
    51	        if (receivedAssets != assets) {
    52	            revert UnsupportedAssetOnDeposit(assets, receivedAssets);
    53	        }
    54	
    55	        _mint(receiver, shares);
    56	        emit Deposit(caller, receiver, assets, shares);
    57	    }
    58	
    59	    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal override {
    60	        if (receiver == address(this)) revert InvalidReceiver(receiver);
    61	
    62	        if (caller != owner) {
    63	            _spendAllowance(owner, caller, shares);
    64	        }
    65	
    66	        uint256 vaultBalanceBefore = totalAssets();
    67	        uint256 receiverBalanceBefore = IERC20(asset()).balanceOf(receiver);
    68	
    69	        _burn(owner, shares);
    70	        IERC20(asset()).safeTransfer(receiver, assets);
    71	
    72	        uint256 vaultAssetsDebited = vaultBalanceBefore - totalAssets();
    73	        uint256 receiverAssetsCredited = IERC20(asset()).balanceOf(receiver) - receiverBalanceBefore;
    74	
    75	        if (vaultAssetsDebited != assets || receiverAssetsCredited != assets) {
    76	            revert UnsupportedAssetOnWithdraw(assets, receiverAssetsCredited);
    77	        }
    78	
    79	        emit Withdraw(caller, receiver, owner, assets, shares);
    80	    }
    81	}
    82	

 succeeded in 14ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.26;
     3	
     4	import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
     5	
     6	import {SaveTokenVault} from "./SaveTokenVault.sol";
     7	
     8	/// @notice Permissionless registry and deployer for single-asset savings vaults.
     9	contract SaveTokenVaultFactory {
    10	    error ZeroAsset();
    11	    error VaultAlreadyExists(address asset, address vault);
    12	
    13	    event VaultCreated(
    14	        address indexed asset,
    15	        address indexed vault,
    16	        address indexed listingOperator,
    17	        string shareName,
    18	        string shareSymbol
    19	    );
    20	
    21	    mapping(address asset => address vault) public vaultForAsset;
    22	    address[] public allVaults;
    23	
    24	    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
    25	        external
    26	        returns (address vault)
    27	    {
    28	        if (asset == address(0)) revert ZeroAsset();
    29	
    30	        address existingVault = vaultForAsset[asset];
    31	        if (existingVault != address(0)) revert VaultAlreadyExists(asset, existingVault);
    32	
    33	        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol, msg.sender));
    34	        vaultForAsset[asset] = vault;
    35	        allVaults.push(vault);
    36	
    37	        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
    38	    }
    39	
    40	    function vaultCount() external view returns (uint256) {
    41	        return allVaults.length;
    42	    }
    43	}
    44	

exec
/bin/bash -lc "nl -ba NOTES.md | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001
 succeeded in 9ms:
     1	# SaveToken Vault Notes
     2	
     3	## Depositor claim mechanics
     4	
     5	Each vault holds exactly one ERC-20 asset and issues an ERC-20 receipt token via `ERC4626`. A depositor's claim is always pro-rata:
     6	
     7	`claimableAssets = holderShares * totalAssets / totalShareSupply`
     8	
     9	In practice:
    10	
    11	- `totalAssets` is the vault's current onchain balance of the underlying token.
    12	- `totalShareSupply` is the receipt token total supply.
    13	- `previewRedeem(shares)` and `previewWithdraw(assets)` expose the same claim math onchain.
    14	- When the keeper transfers more underlying tokens into the vault, `totalAssets` goes up while share supply stays flat. That raises the assets-per-share exchange rate for every holder.
    15	
    16	OpenZeppelin's `ERC4626` implementation includes virtual shares/assets in its conversion math, which hardens the empty-vault state against first-depositor donation attacks better than a naive `assets * supply / totalAssets` formula.
    17	
    18	## Listing and keeper operator requirements
    19	
    20	Listing is permissionless, but a useful listing still depends on the operator making correct choices:
    21	
    22	- List only standard ERC-20s that do not charge transfer fees, do not rebase unexpectedly, and behave predictably on `transfer` and `transferFrom`.
    23	- Share metadata is chosen at vault creation time. Use a clear name and symbol because they become the transferable receipt token users see elsewhere.
    24	- Run the keeper so that yield is sent by transferring the underlying token directly into the vault address. No privileged function call is needed.
    25	- Fund yield in the same token as the vault asset. Sending any other token is just an accidental donation with no effect on vault accounting.
    26	- Monitor keeper transfers and token behavior. If the underlying token changes semantics or starts charging fees, deposits and withdrawals will revert by design rather than silently mispricing shares.
    27	
    28	## Operational model
    29	
    30	- There is one vault per listed asset in the factory registry.
    31	- There are no post-deploy admin powers over user funds in this implementation.
    32	- Deposits, withdrawals, and share transfers remain open at all times; there is no lockup logic in the contracts.

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..9be5be7e4a1515eeba26a6d6aca692eb33ef082f
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# SaveToken Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues an ERC-20 receipt token via `ERC4626`. A depositor's claim is always pro-rata:
+
+`claimableAssets = holderShares * totalAssets / totalShareSupply`
+
+In practice:
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalShareSupply` is the receipt token total supply.
+- `previewRedeem(shares)` and `previewWithdraw(assets)` expose the same claim math onchain.
+- When the keeper transfers more underlying tokens into the vault, `totalAssets` goes up while share supply stays flat. That raises the assets-per-share exchange rate for every holder.
+
+OpenZeppelin's `ERC4626` implementation includes virtual shares/assets in its conversion math, which hardens the empty-vault state against first-depositor donation attacks better than a naive `assets * supply / totalAssets` formula.
+
+## Listing and keeper operator requirements
+
+Listing is permissionless, but a useful listing still depends on the operator making correct choices:
+
+- List only standard ERC-20s that do not charge transfer fees, do not rebase unexpectedly, and behave predictably on `transfer` and `transferFrom`.
+- Share metadata is chosen at vault creation time. Use a clear name and symbol because they become the transferable receipt token users see elsewhere.
+- Run the keeper so that yield is sent by transferring the underlying token directly into the vault address. No privileged function call is needed.
+- Fund yield in the same token as the vault asset. Sending any other token is just an accidental donation with no effect on vault accounting.
+- Monitor keeper transfers and token behavior. If the underlying token changes semantics or starts charging fees, deposits and withdrawals will revert by design rather than silently mispricing shares.
+
+## Operational model
+
+- There is one vault per listed asset in the factory registry.
+- There are no post-deploy admin powers over user funds in this implementation.
+- Deposits, withdrawals, and share transfers remain open at all times; there is no lockup logic in the contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f51d4bf4c0f1a66135c96cd35535ab7ae1fbda06
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+remappings = ["openzeppelin-contracts/=lib/openzeppelin-contracts/"]
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..070368c5d8b53269448b0d5c2c84c00d69fee79d
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {ERC4626} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+/// @notice Permissionless single-asset vault with transferable pro-rata receipt tokens.
+/// @dev Yield is expressed as direct donations of the underlying asset into the vault.
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddressListingOperator();
+    error UnsupportedAssetOnDeposit(uint256 expectedAssets, uint256 actualAssets);
+    error UnsupportedAssetOnWithdraw(uint256 expectedAssets, uint256 actualAssets);
+    error InvalidReceiver(address receiver);
+
+    address public immutable listingOperator;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_, address listingOperator_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+    {
+        if (listingOperator_ == address(0)) revert ZeroAddressListingOperator();
+        listingOperator = listingOperator_;
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = totalAssets();
+        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+
+        if (receivedAssets != assets) {
+            revert UnsupportedAssetOnDeposit(assets, receivedAssets);
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(caller, receiver, assets, shares);
+    }
+
+    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal override {
+        if (receiver == address(this)) revert InvalidReceiver(receiver);
+
+        if (caller != owner) {
+            _spendAllowance(owner, caller, shares);
+        }
+
+        uint256 vaultBalanceBefore = totalAssets();
+        uint256 receiverBalanceBefore = IERC20(asset()).balanceOf(receiver);
+
+        _burn(owner, shares);
+        IERC20(asset()).safeTransfer(receiver, assets);
+
+        uint256 vaultAssetsDebited = vaultBalanceBefore - totalAssets();
+        uint256 receiverAssetsCredited = IERC20(asset()).balanceOf(receiver) - receiverBalanceBefore;
+
+        if (vaultAssetsDebited != assets || receiverAssetsCredited != assets) {
+            revert UnsupportedAssetOnWithdraw(assets, receiverAssetsCredited);
+        }
+
+        emit Withdraw(caller, receiver, owner, assets, shares);
+    }
+}
+
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d591d52cf1af88f43633b3440b9d63c2e499b28d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,44 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+/// @notice Permissionless registry and deployer for single-asset savings vaults.
+contract SaveTokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed listingOperator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) revert VaultAlreadyExists(asset, existingVault);
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

codex
Set up a Foundry project and implemented the deployable contracts for the permissionless single-asset vault system. The factory in [src/SaveTokenVaultFactory.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/src/SaveTokenVaultFactory.sol:8) allows anyone to create exactly one vault per ERC-20, and the vault in [src/SaveTokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/src/SaveTokenVault.sol:10) uses OpenZeppelin `ERC4626` so the receipt token is transferable and each holder’s claim floats upward as keepers donate more of the underlying asset.

I hardened the asset flow for custody/accounting edge cases: deposits, mints, withdrawals, and redeems are `nonReentrant`, and the vault rejects tokens that do not move the exact expected amount on `transferFrom`/`transfer` rather than silently mispricing shares. That means permissionless listing still works, but unusable fee-on-transfer or otherwise non-standard tokens will fail fast at runtime instead of corrupting accounting. The operator/depositor math and keeper requirements are documented in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/NOTES.md:1), and the Foundry config is in [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/foundry.toml:1).

Verification: `forge build` completed successfully on September 4, 2026.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..9be5be7e4a1515eeba26a6d6aca692eb33ef082f
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# SaveToken Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues an ERC-20 receipt token via `ERC4626`. A depositor's claim is always pro-rata:
+
+`claimableAssets = holderShares * totalAssets / totalShareSupply`
+
+In practice:
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalShareSupply` is the receipt token total supply.
+- `previewRedeem(shares)` and `previewWithdraw(assets)` expose the same claim math onchain.
+- When the keeper transfers more underlying tokens into the vault, `totalAssets` goes up while share supply stays flat. That raises the assets-per-share exchange rate for every holder.
+
+OpenZeppelin's `ERC4626` implementation includes virtual shares/assets in its conversion math, which hardens the empty-vault state against first-depositor donation attacks better than a naive `assets * supply / totalAssets` formula.
+
+## Listing and keeper operator requirements
+
+Listing is permissionless, but a useful listing still depends on the operator making correct choices:
+
+- List only standard ERC-20s that do not charge transfer fees, do not rebase unexpectedly, and behave predictably on `transfer` and `transferFrom`.
+- Share metadata is chosen at vault creation time. Use a clear name and symbol because they become the transferable receipt token users see elsewhere.
+- Run the keeper so that yield is sent by transferring the underlying token directly into the vault address. No privileged function call is needed.
+- Fund yield in the same token as the vault asset. Sending any other token is just an accidental donation with no effect on vault accounting.
+- Monitor keeper transfers and token behavior. If the underlying token changes semantics or starts charging fees, deposits and withdrawals will revert by design rather than silently mispricing shares.
+
+## Operational model
+
+- There is one vault per listed asset in the factory registry.
+- There are no post-deploy admin powers over user funds in this implementation.
+- Deposits, withdrawals, and share transfers remain open at all times; there is no lockup logic in the contracts.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f51d4bf4c0f1a66135c96cd35535ab7ae1fbda06
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+remappings = ["openzeppelin-contracts/=lib/openzeppelin-contracts/"]
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..070368c5d8b53269448b0d5c2c84c00d69fee79d
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {ERC4626} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+/// @notice Permissionless single-asset vault with transferable pro-rata receipt tokens.
+/// @dev Yield is expressed as direct donations of the underlying asset into the vault.
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAddressListingOperator();
+    error UnsupportedAssetOnDeposit(uint256 expectedAssets, uint256 actualAssets);
+    error UnsupportedAssetOnWithdraw(uint256 expectedAssets, uint256 actualAssets);
+    error InvalidReceiver(address receiver);
+
+    address public immutable listingOperator;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_, address listingOperator_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+    {
+        if (listingOperator_ == address(0)) revert ZeroAddressListingOperator();
+        listingOperator = listingOperator_;
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = totalAssets();
+        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
+        uint256 receivedAssets = totalAssets() - balanceBefore;
+
+        if (receivedAssets != assets) {
+            revert UnsupportedAssetOnDeposit(assets, receivedAssets);
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(caller, receiver, assets, shares);
+    }
+
+    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal override {
+        if (receiver == address(this)) revert InvalidReceiver(receiver);
+
+        if (caller != owner) {
+            _spendAllowance(owner, caller, shares);
+        }
+
+        uint256 vaultBalanceBefore = totalAssets();
+        uint256 receiverBalanceBefore = IERC20(asset()).balanceOf(receiver);
+
+        _burn(owner, shares);
+        IERC20(asset()).safeTransfer(receiver, assets);
+
+        uint256 vaultAssetsDebited = vaultBalanceBefore - totalAssets();
+        uint256 receiverAssetsCredited = IERC20(asset()).balanceOf(receiver) - receiverBalanceBefore;
+
+        if (vaultAssetsDebited != assets || receiverAssetsCredited != assets) {
+            revert UnsupportedAssetOnWithdraw(assets, receiverAssetsCredited);
+        }
+
+        emit Withdraw(caller, receiver, owner, assets, shares);
+    }
+}
+
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d591d52cf1af88f43633b3440b9d63c2e499b28d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,44 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+/// @notice Permissionless registry and deployer for single-asset savings vaults.
+contract SaveTokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed listingOperator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) revert VaultAlreadyExists(asset, existingVault);
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function vaultCount() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+

tokens used
35,641
```

## final message

Set up a Foundry project and implemented the deployable contracts for the permissionless single-asset vault system. The factory in [src/SaveTokenVaultFactory.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/src/SaveTokenVaultFactory.sol:8) allows anyone to create exactly one vault per ERC-20, and the vault in [src/SaveTokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/src/SaveTokenVault.sol:10) uses OpenZeppelin `ERC4626` so the receipt token is transferable and each holder’s claim floats upward as keepers donate more of the underlying asset.

I hardened the asset flow for custody/accounting edge cases: deposits, mints, withdrawals, and redeems are `nonReentrant`, and the vault rejects tokens that do not move the exact expected amount on `transferFrom`/`transfer` rather than silently mispricing shares. That means permissionless listing still works, but unusable fee-on-transfer or otherwise non-standard tokens will fail fast at runtime instead of corrupting accounting. The operator/depositor math and keeper requirements are documented in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/NOTES.md:1), and the Foundry config is in [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041624Z-codex-with-skill-1/security-goal-001/foundry.toml:1).

Verification: `forge build` completed successfully on September 4, 2026.

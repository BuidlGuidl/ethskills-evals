# Executor transcript — 2026-09-04T041626Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06aa4-eecc-77e0-8368-6effb4e1fb98
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
I’m setting up a Foundry vault/share-token implementation for permissionless ERC-20 listings, then I’ll compile it with `forge build` and add operator/depositor notes. I’m reading the security skill first and inspecting the workspace so the design matches the repo context.
exec
/bin/bash -lc "sed -n '1,240p' /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/.agents/skills/security/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 6ms:
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

exec
/bin/bash -lc 'rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 13ms:
TASK.md
package.json

codex
The workspace is essentially empty aside from `TASK.md` and `package.json`, so I’m building the Foundry project from scratch. Next I’m checking the task file and local toolchain, then I’ll lay out the vault factory, vault, and receipt token design with the accounting protections the security guidance calls for.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc 'cat package.json' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 26ms:
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

 succeeded in 27ms:
{
  "name": "eval-workspace",
  "private": true
}

 succeeded in 27ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

Building a minimal production-oriented Foundry vault system from scratch: inspect the repo, scaffold Foundry, implement secure share-accounting contracts, document operator assumptions, then compile to verify.
  ✓ Inspect workspace and toolchain requirements
  → Scaffold Foundry project structure and dependencies
  • Implement permissionless vault factory and receipt-token vault contracts
  • Write depositor/operator notes in NOTES.md
  • Run forge build and fix any compile issues
codex
I have the toolchain and the repo is blank, so I’m scaffolding a standard Foundry layout and pulling OpenZeppelin rather than hand-rolling ERC-20/share logic. After that I’ll write the vault contracts directly against the installed library and keep the surface area small.
exec
/bin/bash -lc 'forge init --force --no-commit .' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 exited 2 in 9ms:
error: unexpected argument '--no-commit' found

  tip: a similar argument exists: '--commit'

Usage: forge init --force --commit [PATH]

For more information, try '--help'.

exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 0ms:
codex
`forge init` on this version doesn’t support `--no-commit`, so I’m rerunning with the compatible flags and then I’ll replace the boilerplate with the vault code. After the scaffold is in place, I’ll edit the contracts and notes in one pass.
exec
/bin/bash -lc 'forge init --force .' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
2026-09-04T04:20:22.452627Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 37ms:
Warning: Target directory is not empty, but `--force` was specified
Initializing /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001...
Error: git init exited with code 128:
error: could not lock config file /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/.git/config: Read-only file system
fatal: could not set 'core.repositoryformatversion' to '0'

 succeeded in 23ms:
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

exec
/bin/bash -lc 'find . -maxdepth 3 -type f | sort' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 3ms:
exec
/bin/bash -lc "sed -n '1,220p' foundry.toml" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 0ms:
codex
The core design is an `ERC4626`-style vault that is itself the transferable receipt token, fronted by a factory that allows one vault per underlying asset. I’m pulling OpenZeppelin through `npm` because `forge install` wants to write git metadata here, and I need the audited primitives plus the built-in virtual-share protection rather than a bespoke share math implementation.
exec
/bin/bash -lc 'npm install @openzeppelin/contracts' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc "node -p \"require('./node_modules/@openzeppelin/contracts/package.json').version\"" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 exited 1 in 91ms:
/ssd/workspace/buidlguidl/ethskills-evals-test/.pnp.cjs:6509
    throw firstError;
    ^

Error: Qualified path resolution failed: we looked for the following paths, but none could be accessed.

Source path: /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/node_modules/@openzeppelin/contracts/package.json
Not found: /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/node_modules/@openzeppelin/contracts/package.json
Not found: /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/node_modules/@openzeppelin/contracts/package.json.js
Not found: /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/node_modules/@openzeppelin/contracts/package.json.json
Not found: /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/node_modules/@openzeppelin/contracts/package.json.node

Require stack:
- /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/[eval]
    at require$$0.Module._resolveFilename (/ssd/workspace/buidlguidl/ethskills-evals-test/.pnp.cjs:6508:13)
    at defaultResolveImpl (node:internal/modules/cjs/loader:1025:19)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1030:22)
    at Function.<anonymous> (node:internal/modules/cjs/loader:1192:37)
    at require$$0.Module._load (/ssd/workspace/buidlguidl/ethskills-evals-test/.pnp.cjs:6394:31)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:237:24)
    at Module.require (node:internal/modules/cjs/loader:1463:12)
    at require (node:internal/modules/helpers:147:16)
    at [eval]:1:1

Node.js v22.22.2

2026-09-04T04:20:57.387645Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 1251ms:
npm error code EROFS
npm error syscall open
npm error path /home/damu/.npm/_cacache/tmp/b6322dca
npm error errno EROFS
npm error rofs Invalid response body while trying to fetch https://registry.npmjs.org/@openzeppelin%2fcontracts: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/b6322dca'
npm error rofs Often virtualized file systems, or other file systems
npm error rofs that don't support symlinks, give this error.
npm error Log files were not written due to an error writing to the directory: /home/damu/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal

codex
`npm` failed because its default cache path is read-only in this environment. I’m retrying with a writable cache under `/tmp`; if that works, I can keep using the canonical OpenZeppelin contracts instead of vendoring fragments.
exec
/bin/bash -lc 'npm_config_cache=/tmp/npm-cache npm install @openzeppelin/contracts' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc 'ls -la' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
total 44
drwxrwxr-x 8 damu damu 4096 Sep  4 01:21 .
drwxrwxr-x 3 damu damu 4096 Sep  4 01:16 ..
drwxrwxr-x 3 damu damu 4096 Sep  4 01:16 .agents
dr-xr-xr-x 2 damu damu   40 Sep  4 01:21 .codex
drwxrwxr-x 8 damu damu 4096 Sep  4 01:16 .git
-rw-rw-r-- 1 damu damu  972 Sep  4 01:20 README.md
-rw-rw-r-- 1 damu damu  959 Sep  4 01:16 TASK.md
-rw-rw-r-- 1 damu damu  170 Sep  4 01:20 foundry.toml
-rw-rw-r-- 1 damu damu   50 Sep  4 01:16 package.json
drwxrwxr-x 2 damu damu 4096 Sep  4 01:20 script
drwxrwxr-x 2 damu damu 4096 Sep  4 01:20 src
drwxrwxr-x 2 damu damu 4096 Sep  4 01:20 test

 succeeded in 84958ms:

added 1 package, and audited 2 packages in 1m

found 0 vulnerabilities
npm notice
npm notice New major version of npm available! 10.9.7 -> 12.0.2
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.0.2
npm notice To update run: npm install -g npm@12.0.2
npm notice

codex
The dependency install completed. I’m checking the OpenZeppelin version and the generated boilerplate now, then I’ll replace the scaffold with the vault factory and notes.
exec
/bin/bash -lc "sed -n '1,220p' src/Counter.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc "node -p \"require('./node_modules/@openzeppelin/contracts/package.json').version\"" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 16ms:
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Counter {
    uint256 public number;

    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    function increment() public {
        number++;
    }
}

exec
/bin/bash -lc "sed -n '1,220p' README.md" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 3ms:
## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

 succeeded in 111ms:
5.6.1

exec
/bin/bash -lc "rg -n \"contract ERC4626|function _deposit|function _withdraw|function _decimalsOffset|constructor\\(\" node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 0ms:
exec
/bin/bash -lc "sed -n '1,260p' node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.6.0) (token/ERC20/extensions/ERC4626.sol)

pragma solidity ^0.8.24;

import {IERC20, IERC20Metadata, ERC20} from "../ERC20.sol";
import {SafeERC20} from "../utils/SafeERC20.sol";
import {IERC4626} from "../../../interfaces/IERC4626.sol";
import {LowLevelCall} from "../../../utils/LowLevelCall.sol";
import {Memory} from "../../../utils/Memory.sol";
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
        (bool success, uint8 assetDecimals) = _tryGetAssetDecimals(asset_);
        _underlyingDecimals = success ? assetDecimals : 18;
        _asset = asset_;
    }

    /**
     * @dev Attempts to fetch the asset decimals. A return value of false indicates that the attempt failed in some way.
     */
    function _tryGetAssetDecimals(IERC20 asset_) private view returns (bool ok, uint8 assetDecimals) {
        Memory.Pointer ptr = Memory.getFreeMemoryPointer();
        (bool success, bytes32 returnedDecimals, ) = LowLevelCall.staticcallReturn64Bytes(
            address(asset_),
            abi.encodeCall(IERC20Metadata.decimals, ())
        );
        Memory.unsafeSetFreeMemoryPointer(ptr);

        return
            (success && LowLevelCall.returnDataSize() >= 32 && uint256(returnedDecimals) <= type(uint8).max)
                ? (true, uint8(uint256(returnedDecimals)))
                : (false, 0);
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

exec
/bin/bash -lc "sed -n '260,360p' node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
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

        emit Deposit(caller, receiver, assets, shares);
    }

    /**
     * @dev Withdraw/redeem common workflow.
     */
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual {
        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        // If asset() is ERC-777, `transfer` can trigger a reentrancy AFTER the transfer happens through the
        // `tokensReceived` hook. On the other hand, the `tokensToSend` hook, that is triggered before the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer after the burn so that any reentrancy would happen after the
        // shares are burned and after the assets are transferred, which is a valid state.
        _burn(owner, shares);
        _transferOut(receiver, assets);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    /// @dev Performs a transfer in of underlying assets. The default implementation uses `SafeERC20`. Used by {_deposit}.
    function _transferIn(address from, uint256 assets) internal virtual {
        SafeERC20.safeTransferFrom(IERC20(asset()), from, address(this), assets);
    }

    /// @dev Performs a transfer out of underlying assets. The default implementation uses `SafeERC20`. Used by {_withdraw}.
    function _transferOut(address to, uint256 assets) internal virtual {
        SafeERC20.safeTransfer(IERC20(asset()), to, assets);
    }

    function _decimalsOffset() internal view virtual returns (uint8) {
        return 0;
    }
}

codex
I have the dependency version and the OZ `ERC4626` implementation in hand. I’m editing now: removing the boilerplate, wiring Foundry to `node_modules`, and adding a factory plus a vault that rejects short-funded deposits and exposes a keeper `donate` path.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/README.md
/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/foundry.toml
/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/script/Counter.s.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/src/Counter.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/src/SaveTokenVault.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/src/SaveTokenVaultFactory.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/test/Counter.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..387f5f24f718fa5530fecb6eb210554c06fb9f4d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Save Token Vault Notes
+
+## Depositor claim math
+
+Each vault is both:
+
+- the custody contract for one underlying ERC-20, and
+- the transferable receipt token for that vault.
+
+If a vault holds `totalAssets()` underlying tokens and has `totalSupply()` receipt shares outstanding, a holder's gross economic claim is their pro-rata slice:
+
+`holderAssets ~= balanceOf(holder) * totalAssets() / totalSupply()`
+
+In practice, the exact onchain conversion path is the ERC-4626 one:
+
+- deposits use `previewDeposit(assets)` / `deposit(assets, receiver)`
+- withdrawals use `previewRedeem(shares)` / `redeem(shares, receiver, owner)`
+
+Yield increases claims because the keeper adds more of the same underlying token to the vault while share supply stays unchanged. That raises `totalAssets() / totalSupply()` for every existing share holder.
+
+This implementation uses OpenZeppelin ERC-4626 virtual assets/shares in the conversion math, which protects the empty-vault edge case from the classic first-depositor donation attack far better than a naive `assets * totalSupply / totalAssets` formula.
+
+## Listing and keeper requirements
+
+Anyone can create a vault for any ERC-20, but economically correct operation still depends on the underlying token behaving like a standard ERC-20.
+
+The lister/operator has to get these points right:
+
+- Only list standard, non-rebasing, non-deflationary tokens. Rebasing tokens and transfer-fee tokens break or distort share accounting.
+- Pick share token metadata carefully. The factory takes the receipt token `name` and `symbol` as inputs; users should identify vaults by the factory mapping and underlying asset address, not by ticker text alone.
+- Run only one canonical vault per asset. The factory enforces one vault address per underlying token.
+- Have the keeper send the exact same underlying token that the vault wraps. Sending the wrong token does nothing for depositors because `totalAssets()` only reads the configured underlying asset balance.
+- Keep yield transfers simple. The keeper can either transfer tokens straight to the vault address or call `donate(assets)` after approving the vault.
+- Never assume a keeper transfer mints shares. Yield donations intentionally increase assets without increasing share supply.
+- Monitor allowances and balances offchain. If the keeper uses `donate`, it needs an allowance and enough balance; if it transfers directly, it needs to target the vault address exactly.
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..d82dc1449775b901ce5a679e318edbe238a602d5
--- a/README.md
+++ b/README.md
@@ -1,66 +1,16 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+# Save Any Token Vaults
 
-## Documentation
+Minimal Foundry project implementing a permissionless ERC-20 vault factory for Ethereum mainnet.
 
-https://book.getfoundry.sh/
+## Build
 
-## Usage
-
-### Build
-
-```shell
-$ forge build
+```sh
+forge build
 ```
-
-### Test
 
-```shell
-$ forge test
-```
+## Contracts
 
-### Format
+- `src/SaveTokenVault.sol`: ERC-4626 vault whose ERC-20 shares are the transferable receipt token.
+- `src/SaveTokenVaultFactory.sol`: permissionless factory that deploys one vault per underlying asset.
 
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+See `NOTES.md` for claim accounting and operator requirements.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b017ae1997dc658e68c7e15aaef5fbad9d2af83
--- a/foundry.toml
+++ b/foundry.toml
@@ -1,6 +1,7 @@
 [profile.default]
 src = "src"
 out = "out"
-libs = ["lib"]
+libs = ["lib", "node_modules"]
+solc_version = "0.8.24"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e97744c6222154e0bf0f322f117eb796212febc
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error UnsupportedAssetBehavior();
+
+    event YieldDonated(address indexed caller, uint256 assets);
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
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
+    function donate(uint256 assets) external nonReentrant {
+        _transferIn(_msgSender(), assets);
+        emit YieldDonated(_msgSender(), assets);
+    }
+
+    function _transferIn(address from, uint256 assets) internal override {
+        IERC20 assetToken = IERC20(asset());
+        uint256 balanceBefore = assetToken.balanceOf(address(this));
+        assetToken.safeTransferFrom(from, address(this), assets);
+        uint256 received = assetToken.balanceOf(address(this)) - balanceBefore;
+
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3f4da25da39aaec47fbe8055a077b3867e218b5d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address vault => bool isFactoryVault) public isFactoryVault;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (vaultForAsset[asset] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault{salt: keccak256(abi.encode(asset))}(IERC20(asset), name, symbol));
+
+        vaultForAsset[asset] = vault;
+        isFactoryVault[vault] = true;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..387f5f24f718fa5530fecb6eb210554c06fb9f4d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Save Token Vault Notes
+
+## Depositor claim math
+
+Each vault is both:
+
+- the custody contract for one underlying ERC-20, and
+- the transferable receipt token for that vault.
+
+If a vault holds `totalAssets()` underlying tokens and has `totalSupply()` receipt shares outstanding, a holder's gross economic claim is their pro-rata slice:
+
+`holderAssets ~= balanceOf(holder) * totalAssets() / totalSupply()`
+
+In practice, the exact onchain conversion path is the ERC-4626 one:
+
+- deposits use `previewDeposit(assets)` / `deposit(assets, receiver)`
+- withdrawals use `previewRedeem(shares)` / `redeem(shares, receiver, owner)`
+
+Yield increases claims because the keeper adds more of the same underlying token to the vault while share supply stays unchanged. That raises `totalAssets() / totalSupply()` for every existing share holder.
+
+This implementation uses OpenZeppelin ERC-4626 virtual assets/shares in the conversion math, which protects the empty-vault edge case from the classic first-depositor donation attack far better than a naive `assets * totalSupply / totalAssets` formula.
+
+## Listing and keeper requirements
+
+Anyone can create a vault for any ERC-20, but economically correct operation still depends on the underlying token behaving like a standard ERC-20.
+
+The lister/operator has to get these points right:
+
+- Only list standard, non-rebasing, non-deflationary tokens. Rebasing tokens and transfer-fee tokens break or distort share accounting.
+- Pick share token metadata carefully. The factory takes the receipt token `name` and `symbol` as inputs; users should identify vaults by the factory mapping and underlying asset address, not by ticker text alone.
+- Run only one canonical vault per asset. The factory enforces one vault address per underlying token.
+- Have the keeper send the exact same underlying token that the vault wraps. Sending the wrong token does nothing for depositors because `totalAssets()` only reads the configured underlying asset balance.
+- Keep yield transfers simple. The keeper can either transfer tokens straight to the vault address or call `donate(assets)` after approving the vault.
+- Never assume a keeper transfer mints shares. Yield donations intentionally increase assets without increasing share supply.
+- Monitor allowances and balances offchain. If the keeper uses `donate`, it needs an allowance and enough balance; if it transfers directly, it needs to target the vault address exactly.
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..d82dc1449775b901ce5a679e318edbe238a602d5
--- a/README.md
+++ b/README.md
@@ -1,66 +1,16 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+# Save Any Token Vaults
 
-## Documentation
+Minimal Foundry project implementing a permissionless ERC-20 vault factory for Ethereum mainnet.
 
-https://book.getfoundry.sh/
+## Build
 
-## Usage
-
-### Build
-
-```shell
-$ forge build
+```sh
+forge build
 ```
-
-### Test
 
-```shell
-$ forge test
-```
+## Contracts
 
-### Format
+- `src/SaveTokenVault.sol`: ERC-4626 vault whose ERC-20 shares are the transferable receipt token.
+- `src/SaveTokenVaultFactory.sol`: permissionless factory that deploys one vault per underlying asset.
 
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+See `NOTES.md` for claim accounting and operator requirements.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b017ae1997dc658e68c7e15aaef5fbad9d2af83
--- a/foundry.toml
+++ b/foundry.toml
@@ -1,6 +1,7 @@
 [profile.default]
 src = "src"
 out = "out"
-libs = ["lib"]
+libs = ["lib", "node_modules"]
+solc_version = "0.8.24"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e97744c6222154e0bf0f322f117eb796212febc
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error UnsupportedAssetBehavior();
+
+    event YieldDonated(address indexed caller, uint256 assets);
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
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
+    function donate(uint256 assets) external nonReentrant {
+        _transferIn(_msgSender(), assets);
+        emit YieldDonated(_msgSender(), assets);
+    }
+
+    function _transferIn(address from, uint256 assets) internal override {
+        IERC20 assetToken = IERC20(asset());
+        uint256 balanceBefore = assetToken.balanceOf(address(this));
+        assetToken.safeTransferFrom(from, address(this), assets);
+        uint256 received = assetToken.balanceOf(address(this)) - balanceBefore;
+
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3f4da25da39aaec47fbe8055a077b3867e218b5d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address vault => bool isFactoryVault) public isFactoryVault;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (vaultForAsset[asset] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault{salt: keccak256(abi.encode(asset))}(IERC20(asset), name, symbol));
+
+        vaultForAsset[asset] = vault;
+        isFactoryVault[vault] = true;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
The contract set is in place. I’m compiling now and will fix any interface or inheritance issues before I touch anything else.
  ✓ Inspect workspace and toolchain requirements
  ✓ Scaffold Foundry project structure and dependencies
  → Implement permissionless vault factory and receipt-token vault contracts
  ✓ Write depositor/operator notes in NOTES.md
  • Run forge build and fix any compile issues
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..387f5f24f718fa5530fecb6eb210554c06fb9f4d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Save Token Vault Notes
+
+## Depositor claim math
+
+Each vault is both:
+
+- the custody contract for one underlying ERC-20, and
+- the transferable receipt token for that vault.
+
+If a vault holds `totalAssets()` underlying tokens and has `totalSupply()` receipt shares outstanding, a holder's gross economic claim is their pro-rata slice:
+
+`holderAssets ~= balanceOf(holder) * totalAssets() / totalSupply()`
+
+In practice, the exact onchain conversion path is the ERC-4626 one:
+
+- deposits use `previewDeposit(assets)` / `deposit(assets, receiver)`
+- withdrawals use `previewRedeem(shares)` / `redeem(shares, receiver, owner)`
+
+Yield increases claims because the keeper adds more of the same underlying token to the vault while share supply stays unchanged. That raises `totalAssets() / totalSupply()` for every existing share holder.
+
+This implementation uses OpenZeppelin ERC-4626 virtual assets/shares in the conversion math, which protects the empty-vault edge case from the classic first-depositor donation attack far better than a naive `assets * totalSupply / totalAssets` formula.
+
+## Listing and keeper requirements
+
+Anyone can create a vault for any ERC-20, but economically correct operation still depends on the underlying token behaving like a standard ERC-20.
+
+The lister/operator has to get these points right:
+
+- Only list standard, non-rebasing, non-deflationary tokens. Rebasing tokens and transfer-fee tokens break or distort share accounting.
+- Pick share token metadata carefully. The factory takes the receipt token `name` and `symbol` as inputs; users should identify vaults by the factory mapping and underlying asset address, not by ticker text alone.
+- Run only one canonical vault per asset. The factory enforces one vault address per underlying token.
+- Have the keeper send the exact same underlying token that the vault wraps. Sending the wrong token does nothing for depositors because `totalAssets()` only reads the configured underlying asset balance.
+- Keep yield transfers simple. The keeper can either transfer tokens straight to the vault address or call `donate(assets)` after approving the vault.
+- Never assume a keeper transfer mints shares. Yield donations intentionally increase assets without increasing share supply.
+- Monitor allowances and balances offchain. If the keeper uses `donate`, it needs an allowance and enough balance; if it transfers directly, it needs to target the vault address exactly.
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..d82dc1449775b901ce5a679e318edbe238a602d5
--- a/README.md
+++ b/README.md
@@ -1,66 +1,16 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+# Save Any Token Vaults
 
-## Documentation
+Minimal Foundry project implementing a permissionless ERC-20 vault factory for Ethereum mainnet.
 
-https://book.getfoundry.sh/
+## Build
 
-## Usage
-
-### Build
-
-```shell
-$ forge build
+```sh
+forge build
 ```
-
-### Test
 
-```shell
-$ forge test
-```
+## Contracts
 
-### Format
+- `src/SaveTokenVault.sol`: ERC-4626 vault whose ERC-20 shares are the transferable receipt token.
+- `src/SaveTokenVaultFactory.sol`: permissionless factory that deploys one vault per underlying asset.
 
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+See `NOTES.md` for claim accounting and operator requirements.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b017ae1997dc658e68c7e15aaef5fbad9d2af83
--- a/foundry.toml
+++ b/foundry.toml
@@ -1,6 +1,7 @@
 [profile.default]
 src = "src"
 out = "out"
-libs = ["lib"]
+libs = ["lib", "node_modules"]
+solc_version = "0.8.24"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e97744c6222154e0bf0f322f117eb796212febc
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error UnsupportedAssetBehavior();
+
+    event YieldDonated(address indexed caller, uint256 assets);
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
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
+    function donate(uint256 assets) external nonReentrant {
+        _transferIn(_msgSender(), assets);
+        emit YieldDonated(_msgSender(), assets);
+    }
+
+    function _transferIn(address from, uint256 assets) internal override {
+        IERC20 assetToken = IERC20(asset());
+        uint256 balanceBefore = assetToken.balanceOf(address(this));
+        assetToken.safeTransferFrom(from, address(this), assets);
+        uint256 received = assetToken.balanceOf(address(this)) - balanceBefore;
+
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3f4da25da39aaec47fbe8055a077b3867e218b5d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address vault => bool isFactoryVault) public isFactoryVault;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (vaultForAsset[asset] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault{salt: keccak256(abi.encode(asset))}(IERC20(asset), name, symbol));
+
+        vaultForAsset[asset] = vault;
+        isFactoryVault[vault] = true;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
 M package.json
?? NOTES.md
?? README.md
?? foundry.toml
?? package-lock.json
?? src/

 succeeded in 150ms:
Compiling 21 files with Solc 0.8.24
Solc 0.8.24 finished in 97.56ms
Compiler run successful!
2026-09-04T04:23:45.209659Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..387f5f24f718fa5530fecb6eb210554c06fb9f4d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Save Token Vault Notes
+
+## Depositor claim math
+
+Each vault is both:
+
+- the custody contract for one underlying ERC-20, and
+- the transferable receipt token for that vault.
+
+If a vault holds `totalAssets()` underlying tokens and has `totalSupply()` receipt shares outstanding, a holder's gross economic claim is their pro-rata slice:
+
+`holderAssets ~= balanceOf(holder) * totalAssets() / totalSupply()`
+
+In practice, the exact onchain conversion path is the ERC-4626 one:
+
+- deposits use `previewDeposit(assets)` / `deposit(assets, receiver)`
+- withdrawals use `previewRedeem(shares)` / `redeem(shares, receiver, owner)`
+
+Yield increases claims because the keeper adds more of the same underlying token to the vault while share supply stays unchanged. That raises `totalAssets() / totalSupply()` for every existing share holder.
+
+This implementation uses OpenZeppelin ERC-4626 virtual assets/shares in the conversion math, which protects the empty-vault edge case from the classic first-depositor donation attack far better than a naive `assets * totalSupply / totalAssets` formula.
+
+## Listing and keeper requirements
+
+Anyone can create a vault for any ERC-20, but economically correct operation still depends on the underlying token behaving like a standard ERC-20.
+
+The lister/operator has to get these points right:
+
+- Only list standard, non-rebasing, non-deflationary tokens. Rebasing tokens and transfer-fee tokens break or distort share accounting.
+- Pick share token metadata carefully. The factory takes the receipt token `name` and `symbol` as inputs; users should identify vaults by the factory mapping and underlying asset address, not by ticker text alone.
+- Run only one canonical vault per asset. The factory enforces one vault address per underlying token.
+- Have the keeper send the exact same underlying token that the vault wraps. Sending the wrong token does nothing for depositors because `totalAssets()` only reads the configured underlying asset balance.
+- Keep yield transfers simple. The keeper can either transfer tokens straight to the vault address or call `donate(assets)` after approving the vault.
+- Never assume a keeper transfer mints shares. Yield donations intentionally increase assets without increasing share supply.
+- Monitor allowances and balances offchain. If the keeper uses `donate`, it needs an allowance and enough balance; if it transfers directly, it needs to target the vault address exactly.
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..d82dc1449775b901ce5a679e318edbe238a602d5
--- a/README.md
+++ b/README.md
@@ -1,66 +1,16 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+# Save Any Token Vaults
 
-## Documentation
+Minimal Foundry project implementing a permissionless ERC-20 vault factory for Ethereum mainnet.
 
-https://book.getfoundry.sh/
+## Build
 
-## Usage
-
-### Build
-
-```shell
-$ forge build
+```sh
+forge build
 ```
-
-### Test
 
-```shell
-$ forge test
-```
+## Contracts
 
-### Format
+- `src/SaveTokenVault.sol`: ERC-4626 vault whose ERC-20 shares are the transferable receipt token.
+- `src/SaveTokenVaultFactory.sol`: permissionless factory that deploys one vault per underlying asset.
 
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+See `NOTES.md` for claim accounting and operator requirements.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b017ae1997dc658e68c7e15aaef5fbad9d2af83
--- a/foundry.toml
+++ b/foundry.toml
@@ -1,6 +1,7 @@
 [profile.default]
 src = "src"
 out = "out"
-libs = ["lib"]
+libs = ["lib", "node_modules"]
+solc_version = "0.8.24"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e97744c6222154e0bf0f322f117eb796212febc
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error UnsupportedAssetBehavior();
+
+    event YieldDonated(address indexed caller, uint256 assets);
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
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
+    function donate(uint256 assets) external nonReentrant {
+        _transferIn(_msgSender(), assets);
+        emit YieldDonated(_msgSender(), assets);
+    }
+
+    function _transferIn(address from, uint256 assets) internal override {
+        IERC20 assetToken = IERC20(asset());
+        uint256 balanceBefore = assetToken.balanceOf(address(this));
+        assetToken.safeTransferFrom(from, address(this), assets);
+        uint256 received = assetToken.balanceOf(address(this)) - balanceBefore;
+
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3f4da25da39aaec47fbe8055a077b3867e218b5d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address vault => bool isFactoryVault) public isFactoryVault;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (vaultForAsset[asset] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault{salt: keccak256(abi.encode(asset))}(IERC20(asset), name, symbol));
+
+        vaultForAsset[asset] = vault;
+        isFactoryVault[vault] = true;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
`forge build` is already clean; the only warning is Foundry failing to write its global signature cache because `$HOME` is read-only in this sandbox, which does not affect the build output. I’m doing a quick formatting pass and then I’ll close with the contract shape, the compile result, and the remaining operating assumptions around unsupported token behaviors.
exec
/bin/bash -lc 'forge fmt' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 9ms:
Formatted /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/src/SaveTokenVaultFactory.sol

exec
/bin/bash -lc "sed -n '1,220p' package.json" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
{
  "name": "eval-workspace",
  "private": true,
  "dependencies": {
    "@openzeppelin/contracts": "^5.6.1"
  }
}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..387f5f24f718fa5530fecb6eb210554c06fb9f4d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Save Token Vault Notes
+
+## Depositor claim math
+
+Each vault is both:
+
+- the custody contract for one underlying ERC-20, and
+- the transferable receipt token for that vault.
+
+If a vault holds `totalAssets()` underlying tokens and has `totalSupply()` receipt shares outstanding, a holder's gross economic claim is their pro-rata slice:
+
+`holderAssets ~= balanceOf(holder) * totalAssets() / totalSupply()`
+
+In practice, the exact onchain conversion path is the ERC-4626 one:
+
+- deposits use `previewDeposit(assets)` / `deposit(assets, receiver)`
+- withdrawals use `previewRedeem(shares)` / `redeem(shares, receiver, owner)`
+
+Yield increases claims because the keeper adds more of the same underlying token to the vault while share supply stays unchanged. That raises `totalAssets() / totalSupply()` for every existing share holder.
+
+This implementation uses OpenZeppelin ERC-4626 virtual assets/shares in the conversion math, which protects the empty-vault edge case from the classic first-depositor donation attack far better than a naive `assets * totalSupply / totalAssets` formula.
+
+## Listing and keeper requirements
+
+Anyone can create a vault for any ERC-20, but economically correct operation still depends on the underlying token behaving like a standard ERC-20.
+
+The lister/operator has to get these points right:
+
+- Only list standard, non-rebasing, non-deflationary tokens. Rebasing tokens and transfer-fee tokens break or distort share accounting.
+- Pick share token metadata carefully. The factory takes the receipt token `name` and `symbol` as inputs; users should identify vaults by the factory mapping and underlying asset address, not by ticker text alone.
+- Run only one canonical vault per asset. The factory enforces one vault address per underlying token.
+- Have the keeper send the exact same underlying token that the vault wraps. Sending the wrong token does nothing for depositors because `totalAssets()` only reads the configured underlying asset balance.
+- Keep yield transfers simple. The keeper can either transfer tokens straight to the vault address or call `donate(assets)` after approving the vault.
+- Never assume a keeper transfer mints shares. Yield donations intentionally increase assets without increasing share supply.
+- Monitor allowances and balances offchain. If the keeper uses `donate`, it needs an allowance and enough balance; if it transfers directly, it needs to target the vault address exactly.
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..d82dc1449775b901ce5a679e318edbe238a602d5
--- a/README.md
+++ b/README.md
@@ -1,66 +1,16 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+# Save Any Token Vaults
 
-## Documentation
+Minimal Foundry project implementing a permissionless ERC-20 vault factory for Ethereum mainnet.
 
-https://book.getfoundry.sh/
+## Build
 
-## Usage
-
-### Build
-
-```shell
-$ forge build
+```sh
+forge build
 ```
-
-### Test
 
-```shell
-$ forge test
-```
+## Contracts
 
-### Format
+- `src/SaveTokenVault.sol`: ERC-4626 vault whose ERC-20 shares are the transferable receipt token.
+- `src/SaveTokenVaultFactory.sol`: permissionless factory that deploys one vault per underlying asset.
 
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+See `NOTES.md` for claim accounting and operator requirements.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b017ae1997dc658e68c7e15aaef5fbad9d2af83
--- a/foundry.toml
+++ b/foundry.toml
@@ -1,6 +1,7 @@
 [profile.default]
 src = "src"
 out = "out"
-libs = ["lib"]
+libs = ["lib", "node_modules"]
+solc_version = "0.8.24"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e97744c6222154e0bf0f322f117eb796212febc
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error UnsupportedAssetBehavior();
+
+    event YieldDonated(address indexed caller, uint256 assets);
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
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
+    function donate(uint256 assets) external nonReentrant {
+        _transferIn(_msgSender(), assets);
+        emit YieldDonated(_msgSender(), assets);
+    }
+
+    function _transferIn(address from, uint256 assets) internal override {
+        IERC20 assetToken = IERC20(asset());
+        uint256 balanceBefore = assetToken.balanceOf(address(this));
+        assetToken.safeTransferFrom(from, address(this), assets);
+        uint256 received = assetToken.balanceOf(address(this)) - balanceBefore;
+
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3f4da25da39aaec47fbe8055a077b3867e218b5d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address vault => bool isFactoryVault) public isFactoryVault;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (vaultForAsset[asset] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault{salt: keccak256(abi.encode(asset))}(IERC20(asset), name, symbol));
+
+        vaultForAsset[asset] = vault;
+        isFactoryVault[vault] = true;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

  ✓ Inspect workspace and toolchain requirements
  ✓ Scaffold Foundry project structure and dependencies
  ✓ Implement permissionless vault factory and receipt-token vault contracts
  ✓ Write depositor/operator notes in NOTES.md
  ✓ Run forge build and fix any compile issues
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..387f5f24f718fa5530fecb6eb210554c06fb9f4d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Save Token Vault Notes
+
+## Depositor claim math
+
+Each vault is both:
+
+- the custody contract for one underlying ERC-20, and
+- the transferable receipt token for that vault.
+
+If a vault holds `totalAssets()` underlying tokens and has `totalSupply()` receipt shares outstanding, a holder's gross economic claim is their pro-rata slice:
+
+`holderAssets ~= balanceOf(holder) * totalAssets() / totalSupply()`
+
+In practice, the exact onchain conversion path is the ERC-4626 one:
+
+- deposits use `previewDeposit(assets)` / `deposit(assets, receiver)`
+- withdrawals use `previewRedeem(shares)` / `redeem(shares, receiver, owner)`
+
+Yield increases claims because the keeper adds more of the same underlying token to the vault while share supply stays unchanged. That raises `totalAssets() / totalSupply()` for every existing share holder.
+
+This implementation uses OpenZeppelin ERC-4626 virtual assets/shares in the conversion math, which protects the empty-vault edge case from the classic first-depositor donation attack far better than a naive `assets * totalSupply / totalAssets` formula.
+
+## Listing and keeper requirements
+
+Anyone can create a vault for any ERC-20, but economically correct operation still depends on the underlying token behaving like a standard ERC-20.
+
+The lister/operator has to get these points right:
+
+- Only list standard, non-rebasing, non-deflationary tokens. Rebasing tokens and transfer-fee tokens break or distort share accounting.
+- Pick share token metadata carefully. The factory takes the receipt token `name` and `symbol` as inputs; users should identify vaults by the factory mapping and underlying asset address, not by ticker text alone.
+- Run only one canonical vault per asset. The factory enforces one vault address per underlying token.
+- Have the keeper send the exact same underlying token that the vault wraps. Sending the wrong token does nothing for depositors because `totalAssets()` only reads the configured underlying asset balance.
+- Keep yield transfers simple. The keeper can either transfer tokens straight to the vault address or call `donate(assets)` after approving the vault.
+- Never assume a keeper transfer mints shares. Yield donations intentionally increase assets without increasing share supply.
+- Monitor allowances and balances offchain. If the keeper uses `donate`, it needs an allowance and enough balance; if it transfers directly, it needs to target the vault address exactly.
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..d82dc1449775b901ce5a679e318edbe238a602d5
--- a/README.md
+++ b/README.md
@@ -1,66 +1,16 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+# Save Any Token Vaults
 
-## Documentation
+Minimal Foundry project implementing a permissionless ERC-20 vault factory for Ethereum mainnet.
 
-https://book.getfoundry.sh/
+## Build
 
-## Usage
-
-### Build
-
-```shell
-$ forge build
+```sh
+forge build
 ```
-
-### Test
 
-```shell
-$ forge test
-```
+## Contracts
 
-### Format
+- `src/SaveTokenVault.sol`: ERC-4626 vault whose ERC-20 shares are the transferable receipt token.
+- `src/SaveTokenVaultFactory.sol`: permissionless factory that deploys one vault per underlying asset.
 
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+See `NOTES.md` for claim accounting and operator requirements.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b017ae1997dc658e68c7e15aaef5fbad9d2af83
--- a/foundry.toml
+++ b/foundry.toml
@@ -1,6 +1,7 @@
 [profile.default]
 src = "src"
 out = "out"
-libs = ["lib"]
+libs = ["lib", "node_modules"]
+solc_version = "0.8.24"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e97744c6222154e0bf0f322f117eb796212febc
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error UnsupportedAssetBehavior();
+
+    event YieldDonated(address indexed caller, uint256 assets);
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
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
+    function donate(uint256 assets) external nonReentrant {
+        _transferIn(_msgSender(), assets);
+        emit YieldDonated(_msgSender(), assets);
+    }
+
+    function _transferIn(address from, uint256 assets) internal override {
+        IERC20 assetToken = IERC20(asset());
+        uint256 balanceBefore = assetToken.balanceOf(address(this));
+        assetToken.safeTransferFrom(from, address(this), assets);
+        uint256 received = assetToken.balanceOf(address(this)) - balanceBefore;
+
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3f4da25da39aaec47fbe8055a077b3867e218b5d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address vault => bool isFactoryVault) public isFactoryVault;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (vaultForAsset[asset] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault{salt: keccak256(abi.encode(asset))}(IERC20(asset), name, symbol));
+
+        vaultForAsset[asset] = vault;
+        isFactoryVault[vault] = true;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
I’ve finished the implementation pass; I’m doing one last post-format build so the final state, not the pre-format state, is what I report back.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 132ms:
Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 79.72ms
Compiler run successful!
2026-09-04T04:23:58.786028Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..387f5f24f718fa5530fecb6eb210554c06fb9f4d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Save Token Vault Notes
+
+## Depositor claim math
+
+Each vault is both:
+
+- the custody contract for one underlying ERC-20, and
+- the transferable receipt token for that vault.
+
+If a vault holds `totalAssets()` underlying tokens and has `totalSupply()` receipt shares outstanding, a holder's gross economic claim is their pro-rata slice:
+
+`holderAssets ~= balanceOf(holder) * totalAssets() / totalSupply()`
+
+In practice, the exact onchain conversion path is the ERC-4626 one:
+
+- deposits use `previewDeposit(assets)` / `deposit(assets, receiver)`
+- withdrawals use `previewRedeem(shares)` / `redeem(shares, receiver, owner)`
+
+Yield increases claims because the keeper adds more of the same underlying token to the vault while share supply stays unchanged. That raises `totalAssets() / totalSupply()` for every existing share holder.
+
+This implementation uses OpenZeppelin ERC-4626 virtual assets/shares in the conversion math, which protects the empty-vault edge case from the classic first-depositor donation attack far better than a naive `assets * totalSupply / totalAssets` formula.
+
+## Listing and keeper requirements
+
+Anyone can create a vault for any ERC-20, but economically correct operation still depends on the underlying token behaving like a standard ERC-20.
+
+The lister/operator has to get these points right:
+
+- Only list standard, non-rebasing, non-deflationary tokens. Rebasing tokens and transfer-fee tokens break or distort share accounting.
+- Pick share token metadata carefully. The factory takes the receipt token `name` and `symbol` as inputs; users should identify vaults by the factory mapping and underlying asset address, not by ticker text alone.
+- Run only one canonical vault per asset. The factory enforces one vault address per underlying token.
+- Have the keeper send the exact same underlying token that the vault wraps. Sending the wrong token does nothing for depositors because `totalAssets()` only reads the configured underlying asset balance.
+- Keep yield transfers simple. The keeper can either transfer tokens straight to the vault address or call `donate(assets)` after approving the vault.
+- Never assume a keeper transfer mints shares. Yield donations intentionally increase assets without increasing share supply.
+- Monitor allowances and balances offchain. If the keeper uses `donate`, it needs an allowance and enough balance; if it transfers directly, it needs to target the vault address exactly.
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..d82dc1449775b901ce5a679e318edbe238a602d5
--- a/README.md
+++ b/README.md
@@ -1,66 +1,16 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+# Save Any Token Vaults
 
-## Documentation
+Minimal Foundry project implementing a permissionless ERC-20 vault factory for Ethereum mainnet.
 
-https://book.getfoundry.sh/
+## Build
 
-## Usage
-
-### Build
-
-```shell
-$ forge build
+```sh
+forge build
 ```
-
-### Test
 
-```shell
-$ forge test
-```
+## Contracts
 
-### Format
+- `src/SaveTokenVault.sol`: ERC-4626 vault whose ERC-20 shares are the transferable receipt token.
+- `src/SaveTokenVaultFactory.sol`: permissionless factory that deploys one vault per underlying asset.
 
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+See `NOTES.md` for claim accounting and operator requirements.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b017ae1997dc658e68c7e15aaef5fbad9d2af83
--- a/foundry.toml
+++ b/foundry.toml
@@ -1,6 +1,7 @@
 [profile.default]
 src = "src"
 out = "out"
-libs = ["lib"]
+libs = ["lib", "node_modules"]
+solc_version = "0.8.24"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e97744c6222154e0bf0f322f117eb796212febc
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error UnsupportedAssetBehavior();
+
+    event YieldDonated(address indexed caller, uint256 assets);
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
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
+    function donate(uint256 assets) external nonReentrant {
+        _transferIn(_msgSender(), assets);
+        emit YieldDonated(_msgSender(), assets);
+    }
+
+    function _transferIn(address from, uint256 assets) internal override {
+        IERC20 assetToken = IERC20(asset());
+        uint256 balanceBefore = assetToken.balanceOf(address(this));
+        assetToken.safeTransferFrom(from, address(this), assets);
+        uint256 received = assetToken.balanceOf(address(this)) - balanceBefore;
+
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3f4da25da39aaec47fbe8055a077b3867e218b5d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address vault => bool isFactoryVault) public isFactoryVault;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (vaultForAsset[asset] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault{salt: keccak256(abi.encode(asset))}(IERC20(asset), name, symbol));
+
+        vaultForAsset[asset] = vault;
+        isFactoryVault[vault] = true;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

exec
/bin/bash -lc "nl -ba src/SaveTokenVault.sol | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 7ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.24;
     3	
     4	import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
     5	import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
     6	import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
     7	import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
     8	import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
     9	
    10	contract SaveTokenVault is ERC4626, ReentrancyGuard {
    11	    using SafeERC20 for IERC20;
    12	
    13	    error ZeroAssetAddress();
    14	    error UnsupportedAssetBehavior();
    15	
    16	    event YieldDonated(address indexed caller, uint256 assets);
    17	
    18	    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {
    19	        if (address(asset_) == address(0)) {
    20	            revert ZeroAssetAddress();
    21	        }
    22	    }
    23	
    24	    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
    25	        return super.deposit(assets, receiver);
    26	    }
    27	
    28	    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
    29	        return super.mint(shares, receiver);
    30	    }
    31	
    32	    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
    33	        return super.withdraw(assets, receiver, owner);
    34	    }
    35	
    36	    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
    37	        return super.redeem(shares, receiver, owner);
    38	    }
    39	
    40	    function donate(uint256 assets) external nonReentrant {
    41	        _transferIn(_msgSender(), assets);
    42	        emit YieldDonated(_msgSender(), assets);
    43	    }
    44	
    45	    function _transferIn(address from, uint256 assets) internal override {
    46	        IERC20 assetToken = IERC20(asset());
    47	        uint256 balanceBefore = assetToken.balanceOf(address(this));
    48	        assetToken.safeTransferFrom(from, address(this), assets);
    49	        uint256 received = assetToken.balanceOf(address(this)) - balanceBefore;
    50	
    51	        if (received != assets) {
    52	            revert UnsupportedAssetBehavior();
    53	        }
    54	    }
    55	}

exec
/bin/bash -lc "nl -ba src/SaveTokenVaultFactory.sol | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 5ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.24;
     3	
     4	import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
     5	
     6	import {SaveTokenVault} from "./SaveTokenVault.sol";
     7	
     8	contract SaveTokenVaultFactory {
     9	    error ZeroAssetAddress();
    10	    error VaultAlreadyExists();
    11	
    12	    event VaultCreated(
    13	        address indexed asset, address indexed vault, address indexed creator, string name, string symbol
    14	    );
    15	
    16	    mapping(address asset => address vault) public vaultForAsset;
    17	    mapping(address vault => bool isFactoryVault) public isFactoryVault;
    18	
    19	    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
    20	        if (asset == address(0)) {
    21	            revert ZeroAssetAddress();
    22	        }
    23	        if (vaultForAsset[asset] != address(0)) {
    24	            revert VaultAlreadyExists();
    25	        }
    26	
    27	        vault = address(new SaveTokenVault{salt: keccak256(abi.encode(asset))}(IERC20(asset), name, symbol));
    28	
    29	        vaultForAsset[asset] = vault;
    30	        isFactoryVault[vault] = true;
    31	
    32	        emit VaultCreated(asset, vault, msg.sender, name, symbol);
    33	    }
    34	}

exec
/bin/bash -lc "nl -ba NOTES.md | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
     1	# Save Token Vault Notes
     2	
     3	## Depositor claim math
     4	
     5	Each vault is both:
     6	
     7	- the custody contract for one underlying ERC-20, and
     8	- the transferable receipt token for that vault.
     9	
    10	If a vault holds `totalAssets()` underlying tokens and has `totalSupply()` receipt shares outstanding, a holder's gross economic claim is their pro-rata slice:
    11	
    12	`holderAssets ~= balanceOf(holder) * totalAssets() / totalSupply()`
    13	
    14	In practice, the exact onchain conversion path is the ERC-4626 one:
    15	
    16	- deposits use `previewDeposit(assets)` / `deposit(assets, receiver)`
    17	- withdrawals use `previewRedeem(shares)` / `redeem(shares, receiver, owner)`
    18	
    19	Yield increases claims because the keeper adds more of the same underlying token to the vault while share supply stays unchanged. That raises `totalAssets() / totalSupply()` for every existing share holder.
    20	
    21	This implementation uses OpenZeppelin ERC-4626 virtual assets/shares in the conversion math, which protects the empty-vault edge case from the classic first-depositor donation attack far better than a naive `assets * totalSupply / totalAssets` formula.
    22	
    23	## Listing and keeper requirements
    24	
    25	Anyone can create a vault for any ERC-20, but economically correct operation still depends on the underlying token behaving like a standard ERC-20.
    26	
    27	The lister/operator has to get these points right:
    28	
    29	- Only list standard, non-rebasing, non-deflationary tokens. Rebasing tokens and transfer-fee tokens break or distort share accounting.
    30	- Pick share token metadata carefully. The factory takes the receipt token `name` and `symbol` as inputs; users should identify vaults by the factory mapping and underlying asset address, not by ticker text alone.
    31	- Run only one canonical vault per asset. The factory enforces one vault address per underlying token.
    32	- Have the keeper send the exact same underlying token that the vault wraps. Sending the wrong token does nothing for depositors because `totalAssets()` only reads the configured underlying asset balance.
    33	- Keep yield transfers simple. The keeper can either transfer tokens straight to the vault address or call `donate(assets)` after approving the vault.
    34	- Never assume a keeper transfer mints shares. Yield donations intentionally increase assets without increasing share supply.
    35	- Monitor allowances and balances offchain. If the keeper uses `donate`, it needs an allowance and enough balance; if it transfers directly, it needs to target the vault address exactly.

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..387f5f24f718fa5530fecb6eb210554c06fb9f4d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Save Token Vault Notes
+
+## Depositor claim math
+
+Each vault is both:
+
+- the custody contract for one underlying ERC-20, and
+- the transferable receipt token for that vault.
+
+If a vault holds `totalAssets()` underlying tokens and has `totalSupply()` receipt shares outstanding, a holder's gross economic claim is their pro-rata slice:
+
+`holderAssets ~= balanceOf(holder) * totalAssets() / totalSupply()`
+
+In practice, the exact onchain conversion path is the ERC-4626 one:
+
+- deposits use `previewDeposit(assets)` / `deposit(assets, receiver)`
+- withdrawals use `previewRedeem(shares)` / `redeem(shares, receiver, owner)`
+
+Yield increases claims because the keeper adds more of the same underlying token to the vault while share supply stays unchanged. That raises `totalAssets() / totalSupply()` for every existing share holder.
+
+This implementation uses OpenZeppelin ERC-4626 virtual assets/shares in the conversion math, which protects the empty-vault edge case from the classic first-depositor donation attack far better than a naive `assets * totalSupply / totalAssets` formula.
+
+## Listing and keeper requirements
+
+Anyone can create a vault for any ERC-20, but economically correct operation still depends on the underlying token behaving like a standard ERC-20.
+
+The lister/operator has to get these points right:
+
+- Only list standard, non-rebasing, non-deflationary tokens. Rebasing tokens and transfer-fee tokens break or distort share accounting.
+- Pick share token metadata carefully. The factory takes the receipt token `name` and `symbol` as inputs; users should identify vaults by the factory mapping and underlying asset address, not by ticker text alone.
+- Run only one canonical vault per asset. The factory enforces one vault address per underlying token.
+- Have the keeper send the exact same underlying token that the vault wraps. Sending the wrong token does nothing for depositors because `totalAssets()` only reads the configured underlying asset balance.
+- Keep yield transfers simple. The keeper can either transfer tokens straight to the vault address or call `donate(assets)` after approving the vault.
+- Never assume a keeper transfer mints shares. Yield donations intentionally increase assets without increasing share supply.
+- Monitor allowances and balances offchain. If the keeper uses `donate`, it needs an allowance and enough balance; if it transfers directly, it needs to target the vault address exactly.
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..d82dc1449775b901ce5a679e318edbe238a602d5
--- a/README.md
+++ b/README.md
@@ -1,66 +1,16 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+# Save Any Token Vaults
 
-## Documentation
+Minimal Foundry project implementing a permissionless ERC-20 vault factory for Ethereum mainnet.
 
-https://book.getfoundry.sh/
+## Build
 
-## Usage
-
-### Build
-
-```shell
-$ forge build
+```sh
+forge build
 ```
-
-### Test
 
-```shell
-$ forge test
-```
+## Contracts
 
-### Format
+- `src/SaveTokenVault.sol`: ERC-4626 vault whose ERC-20 shares are the transferable receipt token.
+- `src/SaveTokenVaultFactory.sol`: permissionless factory that deploys one vault per underlying asset.
 
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+See `NOTES.md` for claim accounting and operator requirements.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b017ae1997dc658e68c7e15aaef5fbad9d2af83
--- a/foundry.toml
+++ b/foundry.toml
@@ -1,6 +1,7 @@
 [profile.default]
 src = "src"
 out = "out"
-libs = ["lib"]
+libs = ["lib", "node_modules"]
+solc_version = "0.8.24"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e97744c6222154e0bf0f322f117eb796212febc
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error UnsupportedAssetBehavior();
+
+    event YieldDonated(address indexed caller, uint256 assets);
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
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
+    function donate(uint256 assets) external nonReentrant {
+        _transferIn(_msgSender(), assets);
+        emit YieldDonated(_msgSender(), assets);
+    }
+
+    function _transferIn(address from, uint256 assets) internal override {
+        IERC20 assetToken = IERC20(asset());
+        uint256 balanceBefore = assetToken.balanceOf(address(this));
+        assetToken.safeTransferFrom(from, address(this), assets);
+        uint256 received = assetToken.balanceOf(address(this)) - balanceBefore;
+
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3f4da25da39aaec47fbe8055a077b3867e218b5d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address vault => bool isFactoryVault) public isFactoryVault;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (vaultForAsset[asset] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault{salt: keccak256(abi.encode(asset))}(IERC20(asset), name, symbol));
+
+        vaultForAsset[asset] = vault;
+        isFactoryVault[vault] = true;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

codex
Implemented a Foundry project for the vault system and verified the final state with `forge build`. The deployable core is [src/SaveTokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/src/SaveTokenVault.sol:10), an `ERC4626` vault whose ERC-20 shares are the transferable receipt token, and [src/SaveTokenVaultFactory.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/src/SaveTokenVaultFactory.sol:8), a permissionless one-vault-per-asset factory. The vault adds `nonReentrant` entrypoints, uses OZ’s virtual share/asset math for the empty-vault inflation edge case, and rejects short-funded deposits via a balance-delta check so fee-on-transfer deposits cannot silently break accounting.

I also added [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/NOTES.md:1) covering how depositor claims are computed and what operators/keepers must get right when listing tokens and donating yield. `forge build` succeeds; the only warning is Foundry being unable to write its global signature cache under the read-only home directory in this sandbox, which does not affect compilation.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..387f5f24f718fa5530fecb6eb210554c06fb9f4d
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Save Token Vault Notes
+
+## Depositor claim math
+
+Each vault is both:
+
+- the custody contract for one underlying ERC-20, and
+- the transferable receipt token for that vault.
+
+If a vault holds `totalAssets()` underlying tokens and has `totalSupply()` receipt shares outstanding, a holder's gross economic claim is their pro-rata slice:
+
+`holderAssets ~= balanceOf(holder) * totalAssets() / totalSupply()`
+
+In practice, the exact onchain conversion path is the ERC-4626 one:
+
+- deposits use `previewDeposit(assets)` / `deposit(assets, receiver)`
+- withdrawals use `previewRedeem(shares)` / `redeem(shares, receiver, owner)`
+
+Yield increases claims because the keeper adds more of the same underlying token to the vault while share supply stays unchanged. That raises `totalAssets() / totalSupply()` for every existing share holder.
+
+This implementation uses OpenZeppelin ERC-4626 virtual assets/shares in the conversion math, which protects the empty-vault edge case from the classic first-depositor donation attack far better than a naive `assets * totalSupply / totalAssets` formula.
+
+## Listing and keeper requirements
+
+Anyone can create a vault for any ERC-20, but economically correct operation still depends on the underlying token behaving like a standard ERC-20.
+
+The lister/operator has to get these points right:
+
+- Only list standard, non-rebasing, non-deflationary tokens. Rebasing tokens and transfer-fee tokens break or distort share accounting.
+- Pick share token metadata carefully. The factory takes the receipt token `name` and `symbol` as inputs; users should identify vaults by the factory mapping and underlying asset address, not by ticker text alone.
+- Run only one canonical vault per asset. The factory enforces one vault address per underlying token.
+- Have the keeper send the exact same underlying token that the vault wraps. Sending the wrong token does nothing for depositors because `totalAssets()` only reads the configured underlying asset balance.
+- Keep yield transfers simple. The keeper can either transfer tokens straight to the vault address or call `donate(assets)` after approving the vault.
+- Never assume a keeper transfer mints shares. Yield donations intentionally increase assets without increasing share supply.
+- Monitor allowances and balances offchain. If the keeper uses `donate`, it needs an allowance and enough balance; if it transfers directly, it needs to target the vault address exactly.
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..d82dc1449775b901ce5a679e318edbe238a602d5
--- a/README.md
+++ b/README.md
@@ -1,66 +1,16 @@
-## Foundry
-
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
-
-Foundry consists of:
-
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+# Save Any Token Vaults
 
-## Documentation
+Minimal Foundry project implementing a permissionless ERC-20 vault factory for Ethereum mainnet.
 
-https://book.getfoundry.sh/
+## Build
 
-## Usage
-
-### Build
-
-```shell
-$ forge build
+```sh
+forge build
 ```
-
-### Test
 
-```shell
-$ forge test
-```
+## Contracts
 
-### Format
+- `src/SaveTokenVault.sol`: ERC-4626 vault whose ERC-20 shares are the transferable receipt token.
+- `src/SaveTokenVaultFactory.sol`: permissionless factory that deploys one vault per underlying asset.
 
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
-
-```shell
-$ forge snapshot
-```
-
-### Anvil
-
-```shell
-$ anvil
-```
-
-### Deploy
-
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
-
-### Cast
-
-```shell
-$ cast <subcommand>
-```
-
-### Help
-
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+See `NOTES.md` for claim accounting and operator requirements.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..7b017ae1997dc658e68c7e15aaef5fbad9d2af83
--- a/foundry.toml
+++ b/foundry.toml
@@ -1,6 +1,7 @@
 [profile.default]
 src = "src"
 out = "out"
-libs = ["lib"]
+libs = ["lib", "node_modules"]
+solc_version = "0.8.24"
 
 # See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
diff --git a/script/Counter.s.sol b/script/Counter.s.sol
deleted file mode 100644
index f01d69c399c32ff7527e559634cf2091fe9129ba..0000000000000000000000000000000000000000
--- a/script/Counter.s.sol
+++ /dev/null
@@ -1,19 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Script} from "forge-std/Script.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterScript is Script {
-    Counter public counter;
-
-    function setUp() public {}
-
-    function run() public {
-        vm.startBroadcast();
-
-        counter = new Counter();
-
-        vm.stopBroadcast();
-    }
-}
diff --git a/src/Counter.sol b/src/Counter.sol
deleted file mode 100644
index aded7997b0c359a8230744058a80043b99bf6857..0000000000000000000000000000000000000000
--- a/src/Counter.sol
+++ /dev/null
@@ -1,14 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-contract Counter {
-    uint256 public number;
-
-    function setNumber(uint256 newNumber) public {
-        number = newNumber;
-    }
-
-    function increment() public {
-        number++;
-    }
-}
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e97744c6222154e0bf0f322f117eb796212febc
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error UnsupportedAssetBehavior();
+
+    event YieldDonated(address indexed caller, uint256 assets);
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
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
+    function donate(uint256 assets) external nonReentrant {
+        _transferIn(_msgSender(), assets);
+        emit YieldDonated(_msgSender(), assets);
+    }
+
+    function _transferIn(address from, uint256 assets) internal override {
+        IERC20 assetToken = IERC20(asset());
+        uint256 balanceBefore = assetToken.balanceOf(address(this));
+        assetToken.safeTransferFrom(from, address(this), assets);
+        uint256 received = assetToken.balanceOf(address(this)) - balanceBefore;
+
+        if (received != assets) {
+            revert UnsupportedAssetBehavior();
+        }
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3f4da25da39aaec47fbe8055a077b3867e218b5d
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address vault => bool isFactoryVault) public isFactoryVault;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (vaultForAsset[asset] != address(0)) {
+            revert VaultAlreadyExists();
+        }
+
+        vault = address(new SaveTokenVault{salt: keccak256(abi.encode(asset))}(IERC20(asset), name, symbol));
+
+        vaultForAsset[asset] = vault;
+        isFactoryVault[vault] = true;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
diff --git a/test/Counter.t.sol b/test/Counter.t.sol
deleted file mode 100644
index 48319108366c08e3fe07bfc284dd96bcc3ced59a..0000000000000000000000000000000000000000
--- a/test/Counter.t.sol
+++ /dev/null
@@ -1,24 +0,0 @@
-// SPDX-License-Identifier: UNLICENSED
-pragma solidity ^0.8.13;
-
-import {Test} from "forge-std/Test.sol";
-import {Counter} from "../src/Counter.sol";
-
-contract CounterTest is Test {
-    Counter public counter;
-
-    function setUp() public {
-        counter = new Counter();
-        counter.setNumber(0);
-    }
-
-    function test_Increment() public {
-        counter.increment();
-        assertEq(counter.number(), 1);
-    }
-
-    function testFuzz_SetNumber(uint256 x) public {
-        counter.setNumber(x);
-        assertEq(counter.number(), x);
-    }
-}

tokens used
40,747
````

## final message

Implemented a Foundry project for the vault system and verified the final state with `forge build`. The deployable core is [src/SaveTokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/src/SaveTokenVault.sol:10), an `ERC4626` vault whose ERC-20 shares are the transferable receipt token, and [src/SaveTokenVaultFactory.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/src/SaveTokenVaultFactory.sol:8), a permissionless one-vault-per-asset factory. The vault adds `nonReentrant` entrypoints, uses OZ’s virtual share/asset math for the empty-vault inflation edge case, and rejects short-funded deposits via a balance-delta check so fee-on-transfer deposits cannot silently break accounting.

I also added [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041626Z-codex-with-skill-3/security-goal-001/NOTES.md:1) covering how depositor claims are computed and what operators/keepers must get right when listing tokens and donating yield. `forge build` succeeds; the only warning is Foundry being unable to write its global signature cache under the read-only home directory in this sandbox, which does not affect compilation.

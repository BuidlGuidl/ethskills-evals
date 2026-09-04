# Executor transcript — 2026-09-04T041623Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06aa2-3a74-7a31-9646-38bdb128bb3e
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
I’m setting up a Foundry-based vault implementation in this workspace and first need to inspect what’s already here so I can add the project structure without trampling existing files.
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001
exec
/bin/bash -lc "rg --files -g '"'!node_modules'"' -g '"'!lib'"' -g '"'!out'"' -g '"'!cache'"'" in /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001
 succeeded in 15ms:
/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001

exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001
 succeeded in 21ms:
TASK.md
package.json

 succeeded in 14ms:
codex
The workspace is effectively empty apart from `TASK.md` and `package.json`. I’m reading those now, then I’ll scaffold the Foundry layout and implement the vault/factory path directly.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001
 succeeded in 0ms:
exec
/bin/bash -lc "sed -n '1,220p' package.json" in /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001
 succeeded in 1ms:
codex
I have the exact task text now. Next I’m checking whether `forge` is available locally and then I’ll lay down the minimal project structure, contracts, and notes needed for a clean `forge build`.
Scaffold a minimal Foundry project for a permissionless ERC-4626-style token vault system, then verify it compiles and document the operational model.
  → Check local Solidity tooling and project constraints
  • Create Foundry config, dependencies, and vault/factory contracts
  • Run forge build and fix any compile issues
  • Write NOTES.md covering share accounting and operator requirements
exec
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001
exec
/bin/bash -lc 'solc --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001
 succeeded in 37ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

 succeeded in 156ms:
solc, the solidity compiler commandline interface
Version: 0.8.20+commit.a1b79de6.Linux.g++

codex
I’ve confirmed the toolchain is present (`forge 1.5.1`, `solc 0.8.20`). I’m now writing a minimal self-contained Foundry project: a permissionless factory plus a single-asset share vault that accounts for yield by comparing `totalSupply` to the vault’s live token balance, without depending on external packages.
exec
/bin/bash -lc 'mkdir -p src' in /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001
 succeeded in 3ms:
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/.gitignore
/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/foundry.toml
/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/src/TokenVault.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/src/TokenVaultFactory.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..7ce77c72835d91dceda3789ead88e449fea79507
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/cache
+/out
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..ec6463db48189bef27e62fd2854b69d70cbe3606
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Token Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and mints a transferable receipt token ("shares").
+
+- A depositor's claim on the underlying is:
+  `holderShares / totalShareSupply * vaultAssetBalance`
+- `vaultAssetBalance` is the live ERC-20 balance of the vault contract, not a separately tracked accounting number.
+- If the keeper sends more of the same underlying token into the vault, `vaultAssetBalance` increases while `totalShareSupply` stays flat, so every existing share becomes redeemable for more underlying.
+- Deposits mint shares against the vault balance that existed before the deposit landed.
+- Withdrawals and redemptions burn shares against the vault's current live balance.
+
+This means yield distribution is automatic: no rebasing share token, no per-user bookkeeping, and no explicit "harvest" step inside the vault.
+
+## Listing and keeper requirements
+
+The contracts are permissionless, but operators still need to choose sane assets and run the keeper correctly.
+
+- Only list vanilla ERC-20s whose balances behave predictably.
+- Avoid fee-on-transfer, rebasing, ERC-777 style hook-heavy, or otherwise non-standard tokens, because the vault share math assumes `balanceOf(vault)` is the source of truth for claims.
+- Use the same underlying token for deposits, withdrawals, and keeper top-ups. Sending any other asset to the vault strands it.
+- The first lister for an asset chooses the vault receipt `name` and `symbol`, because the factory enforces one vault per underlying token.
+- The keeper must only transfer net new yield into the vault. If it accidentally pulls funds back out elsewhere, holder claims are diluted immediately because the vault balance falls.
+- Keeper operations do not call a special vault method; they simply transfer the underlying token to the vault address.
+- Before listing on mainnet, verify the underlying token's `decimals`, transfer semantics, and whether it can blacklist, pause, seize, or otherwise interfere with custody.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..ba85252a0b0ffcb0d140310e0c923d930720cb00
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..125b5f51df23f7be68b6fbe932987d1f7f7157b1
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,271 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientAllowance();
+    error InsufficientBalance();
+
+    event Deposit(address indexed caller, address indexed owner, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        decimals = _readDecimals(asset_);
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsInVault;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
+
+        return shares * totalAssets() / supply;
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return _mulDivUp(assets, supply, assetsInVault);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 assetsBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, assetsBefore, totalSupply);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        uint256 assetsBefore = totalAssets();
+        assets = supply == 0 || assetsBefore == 0 ? shares : _mulDivUp(shares, assetsBefore, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets < assets) {
+            revert ZeroAssets();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+        shares = supply == 0 || assetsInVault == 0 ? assets : _mulDivUp(assets, supply, assetsInVault);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        _burn(owner, shares);
+
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        _spendAllowanceIfNeeded(from, msg.sender, amount);
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        totalSupply += amount;
+        balanceOf[to] += amount;
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (owner == spender) {
+            return;
+        }
+
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance < amount) revert InsufficientAllowance();
+
+        if (currentAllowance != type(uint256).max) {
+            unchecked {
+                allowance[owner][spender] = currentAllowance - amount;
+            }
+            emit Approval(owner, spender, allowance[owner][spender]);
+        }
+    }
+
+    function _convertToShares(uint256 assets, uint256 assetsBefore, uint256 supply) internal pure returns (uint256) {
+        if (supply == 0 || assetsBefore == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsBefore;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 value) {
+        (bool ok, bytes memory data) = asset_.staticcall(abi.encodeWithSignature("decimals()"));
+        if (!ok || data.length < 32) {
+            return 18;
+        }
+
+        value = abi.decode(data, (uint8));
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f018e68ea426312b6b76acf42cbeffa0bd28770c
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
+

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..7ce77c72835d91dceda3789ead88e449fea79507
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/cache
+/out
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..ec6463db48189bef27e62fd2854b69d70cbe3606
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Token Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and mints a transferable receipt token ("shares").
+
+- A depositor's claim on the underlying is:
+  `holderShares / totalShareSupply * vaultAssetBalance`
+- `vaultAssetBalance` is the live ERC-20 balance of the vault contract, not a separately tracked accounting number.
+- If the keeper sends more of the same underlying token into the vault, `vaultAssetBalance` increases while `totalShareSupply` stays flat, so every existing share becomes redeemable for more underlying.
+- Deposits mint shares against the vault balance that existed before the deposit landed.
+- Withdrawals and redemptions burn shares against the vault's current live balance.
+
+This means yield distribution is automatic: no rebasing share token, no per-user bookkeeping, and no explicit "harvest" step inside the vault.
+
+## Listing and keeper requirements
+
+The contracts are permissionless, but operators still need to choose sane assets and run the keeper correctly.
+
+- Only list vanilla ERC-20s whose balances behave predictably.
+- Avoid fee-on-transfer, rebasing, ERC-777 style hook-heavy, or otherwise non-standard tokens, because the vault share math assumes `balanceOf(vault)` is the source of truth for claims.
+- Use the same underlying token for deposits, withdrawals, and keeper top-ups. Sending any other asset to the vault strands it.
+- The first lister for an asset chooses the vault receipt `name` and `symbol`, because the factory enforces one vault per underlying token.
+- The keeper must only transfer net new yield into the vault. If it accidentally pulls funds back out elsewhere, holder claims are diluted immediately because the vault balance falls.
+- Keeper operations do not call a special vault method; they simply transfer the underlying token to the vault address.
+- Before listing on mainnet, verify the underlying token's `decimals`, transfer semantics, and whether it can blacklist, pause, seize, or otherwise interfere with custody.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..ba85252a0b0ffcb0d140310e0c923d930720cb00
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..125b5f51df23f7be68b6fbe932987d1f7f7157b1
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,271 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientAllowance();
+    error InsufficientBalance();
+
+    event Deposit(address indexed caller, address indexed owner, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        decimals = _readDecimals(asset_);
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsInVault;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
+
+        return shares * totalAssets() / supply;
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return _mulDivUp(assets, supply, assetsInVault);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 assetsBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, assetsBefore, totalSupply);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        uint256 assetsBefore = totalAssets();
+        assets = supply == 0 || assetsBefore == 0 ? shares : _mulDivUp(shares, assetsBefore, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets < assets) {
+            revert ZeroAssets();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+        shares = supply == 0 || assetsInVault == 0 ? assets : _mulDivUp(assets, supply, assetsInVault);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        _burn(owner, shares);
+
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        _spendAllowanceIfNeeded(from, msg.sender, amount);
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        totalSupply += amount;
+        balanceOf[to] += amount;
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (owner == spender) {
+            return;
+        }
+
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance < amount) revert InsufficientAllowance();
+
+        if (currentAllowance != type(uint256).max) {
+            unchecked {
+                allowance[owner][spender] = currentAllowance - amount;
+            }
+            emit Approval(owner, spender, allowance[owner][spender]);
+        }
+    }
+
+    function _convertToShares(uint256 assets, uint256 assetsBefore, uint256 supply) internal pure returns (uint256) {
+        if (supply == 0 || assetsBefore == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsBefore;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 value) {
+        (bool ok, bytes memory data) = asset_.staticcall(abi.encodeWithSignature("decimals()"));
+        if (!ok || data.length < 32) {
+            return 18;
+        }
+
+        value = abi.decode(data, (uint8));
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f018e68ea426312b6b76acf42cbeffa0bd28770c
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
+

codex
The first pass is in place. I’m compiling now to catch any Solidity or accounting edge issues before I close this out.
  ✓ Check local Solidity tooling and project constraints
  ✓ Create Foundry config, dependencies, and vault/factory contracts
  → Run forge build and fix any compile issues
  ✓ Write NOTES.md covering share accounting and operator requirements
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..7ce77c72835d91dceda3789ead88e449fea79507
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/cache
+/out
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..ec6463db48189bef27e62fd2854b69d70cbe3606
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Token Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and mints a transferable receipt token ("shares").
+
+- A depositor's claim on the underlying is:
+  `holderShares / totalShareSupply * vaultAssetBalance`
+- `vaultAssetBalance` is the live ERC-20 balance of the vault contract, not a separately tracked accounting number.
+- If the keeper sends more of the same underlying token into the vault, `vaultAssetBalance` increases while `totalShareSupply` stays flat, so every existing share becomes redeemable for more underlying.
+- Deposits mint shares against the vault balance that existed before the deposit landed.
+- Withdrawals and redemptions burn shares against the vault's current live balance.
+
+This means yield distribution is automatic: no rebasing share token, no per-user bookkeeping, and no explicit "harvest" step inside the vault.
+
+## Listing and keeper requirements
+
+The contracts are permissionless, but operators still need to choose sane assets and run the keeper correctly.
+
+- Only list vanilla ERC-20s whose balances behave predictably.
+- Avoid fee-on-transfer, rebasing, ERC-777 style hook-heavy, or otherwise non-standard tokens, because the vault share math assumes `balanceOf(vault)` is the source of truth for claims.
+- Use the same underlying token for deposits, withdrawals, and keeper top-ups. Sending any other asset to the vault strands it.
+- The first lister for an asset chooses the vault receipt `name` and `symbol`, because the factory enforces one vault per underlying token.
+- The keeper must only transfer net new yield into the vault. If it accidentally pulls funds back out elsewhere, holder claims are diluted immediately because the vault balance falls.
+- Keeper operations do not call a special vault method; they simply transfer the underlying token to the vault address.
+- Before listing on mainnet, verify the underlying token's `decimals`, transfer semantics, and whether it can blacklist, pause, seize, or otherwise interfere with custody.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..ba85252a0b0ffcb0d140310e0c923d930720cb00
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..125b5f51df23f7be68b6fbe932987d1f7f7157b1
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,271 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientAllowance();
+    error InsufficientBalance();
+
+    event Deposit(address indexed caller, address indexed owner, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        decimals = _readDecimals(asset_);
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsInVault;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
+
+        return shares * totalAssets() / supply;
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return _mulDivUp(assets, supply, assetsInVault);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 assetsBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, assetsBefore, totalSupply);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        uint256 assetsBefore = totalAssets();
+        assets = supply == 0 || assetsBefore == 0 ? shares : _mulDivUp(shares, assetsBefore, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets < assets) {
+            revert ZeroAssets();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+        shares = supply == 0 || assetsInVault == 0 ? assets : _mulDivUp(assets, supply, assetsInVault);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        _burn(owner, shares);
+
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        _spendAllowanceIfNeeded(from, msg.sender, amount);
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        totalSupply += amount;
+        balanceOf[to] += amount;
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (owner == spender) {
+            return;
+        }
+
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance < amount) revert InsufficientAllowance();
+
+        if (currentAllowance != type(uint256).max) {
+            unchecked {
+                allowance[owner][spender] = currentAllowance - amount;
+            }
+            emit Approval(owner, spender, allowance[owner][spender]);
+        }
+    }
+
+    function _convertToShares(uint256 assets, uint256 assetsBefore, uint256 supply) internal pure returns (uint256) {
+        if (supply == 0 || assetsBefore == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsBefore;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 value) {
+        (bool ok, bytes memory data) = asset_.staticcall(abi.encodeWithSignature("decimals()"));
+        if (!ok || data.length < 32) {
+            return 18;
+        }
+
+        value = abi.decode(data, (uint8));
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f018e68ea426312b6b76acf42cbeffa0bd28770c
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
+

exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001
 succeeded in 220ms:
Compiling 2 files with Solc 0.8.20
Solc 0.8.20 finished in 177.44ms
Compiler run successful!
2026-09-04T04:18:40.752778Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:54:29
   |
54 |     IERC20 public immutable asset;
   |                             ^^^^^ help: consider using: `ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:55:30
   |
55 |     address public immutable factory;
   |                              ^^^^^^^ help: consider using: `FACTORY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:58:28
   |
58 |     uint8 public immutable decimals;
   |                            ^^^^^^^^ help: consider using: `DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable


diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..7ce77c72835d91dceda3789ead88e449fea79507
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/cache
+/out
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..ec6463db48189bef27e62fd2854b69d70cbe3606
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Token Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and mints a transferable receipt token ("shares").
+
+- A depositor's claim on the underlying is:
+  `holderShares / totalShareSupply * vaultAssetBalance`
+- `vaultAssetBalance` is the live ERC-20 balance of the vault contract, not a separately tracked accounting number.
+- If the keeper sends more of the same underlying token into the vault, `vaultAssetBalance` increases while `totalShareSupply` stays flat, so every existing share becomes redeemable for more underlying.
+- Deposits mint shares against the vault balance that existed before the deposit landed.
+- Withdrawals and redemptions burn shares against the vault's current live balance.
+
+This means yield distribution is automatic: no rebasing share token, no per-user bookkeeping, and no explicit "harvest" step inside the vault.
+
+## Listing and keeper requirements
+
+The contracts are permissionless, but operators still need to choose sane assets and run the keeper correctly.
+
+- Only list vanilla ERC-20s whose balances behave predictably.
+- Avoid fee-on-transfer, rebasing, ERC-777 style hook-heavy, or otherwise non-standard tokens, because the vault share math assumes `balanceOf(vault)` is the source of truth for claims.
+- Use the same underlying token for deposits, withdrawals, and keeper top-ups. Sending any other asset to the vault strands it.
+- The first lister for an asset chooses the vault receipt `name` and `symbol`, because the factory enforces one vault per underlying token.
+- The keeper must only transfer net new yield into the vault. If it accidentally pulls funds back out elsewhere, holder claims are diluted immediately because the vault balance falls.
+- Keeper operations do not call a special vault method; they simply transfer the underlying token to the vault address.
+- Before listing on mainnet, verify the underlying token's `decimals`, transfer semantics, and whether it can blacklist, pause, seize, or otherwise interfere with custody.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..ba85252a0b0ffcb0d140310e0c923d930720cb00
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..125b5f51df23f7be68b6fbe932987d1f7f7157b1
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,271 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientAllowance();
+    error InsufficientBalance();
+
+    event Deposit(address indexed caller, address indexed owner, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        decimals = _readDecimals(asset_);
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsInVault;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
+
+        return shares * totalAssets() / supply;
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return _mulDivUp(assets, supply, assetsInVault);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 assetsBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, assetsBefore, totalSupply);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        uint256 assetsBefore = totalAssets();
+        assets = supply == 0 || assetsBefore == 0 ? shares : _mulDivUp(shares, assetsBefore, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets < assets) {
+            revert ZeroAssets();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+        shares = supply == 0 || assetsInVault == 0 ? assets : _mulDivUp(assets, supply, assetsInVault);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        _burn(owner, shares);
+
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        _spendAllowanceIfNeeded(from, msg.sender, amount);
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        totalSupply += amount;
+        balanceOf[to] += amount;
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (owner == spender) {
+            return;
+        }
+
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance < amount) revert InsufficientAllowance();
+
+        if (currentAllowance != type(uint256).max) {
+            unchecked {
+                allowance[owner][spender] = currentAllowance - amount;
+            }
+            emit Approval(owner, spender, allowance[owner][spender]);
+        }
+    }
+
+    function _convertToShares(uint256 assets, uint256 assetsBefore, uint256 supply) internal pure returns (uint256) {
+        if (supply == 0 || assetsBefore == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsBefore;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 value) {
+        (bool ok, bytes memory data) = asset_.staticcall(abi.encodeWithSignature("decimals()"));
+        if (!ok || data.length < 32) {
+            return 18;
+        }
+
+        value = abi.decode(data, (uint8));
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f018e68ea426312b6b76acf42cbeffa0bd28770c
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
+

codex
`forge build` passes already. I’m doing one small cleanup pass so the contracts also stop emitting Foundry naming notes, then I’ll re-run the build and summarize the deployable surface.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/src/TokenVault.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..7ce77c72835d91dceda3789ead88e449fea79507
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/cache
+/out
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..ec6463db48189bef27e62fd2854b69d70cbe3606
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Token Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and mints a transferable receipt token ("shares").
+
+- A depositor's claim on the underlying is:
+  `holderShares / totalShareSupply * vaultAssetBalance`
+- `vaultAssetBalance` is the live ERC-20 balance of the vault contract, not a separately tracked accounting number.
+- If the keeper sends more of the same underlying token into the vault, `vaultAssetBalance` increases while `totalShareSupply` stays flat, so every existing share becomes redeemable for more underlying.
+- Deposits mint shares against the vault balance that existed before the deposit landed.
+- Withdrawals and redemptions burn shares against the vault's current live balance.
+
+This means yield distribution is automatic: no rebasing share token, no per-user bookkeeping, and no explicit "harvest" step inside the vault.
+
+## Listing and keeper requirements
+
+The contracts are permissionless, but operators still need to choose sane assets and run the keeper correctly.
+
+- Only list vanilla ERC-20s whose balances behave predictably.
+- Avoid fee-on-transfer, rebasing, ERC-777 style hook-heavy, or otherwise non-standard tokens, because the vault share math assumes `balanceOf(vault)` is the source of truth for claims.
+- Use the same underlying token for deposits, withdrawals, and keeper top-ups. Sending any other asset to the vault strands it.
+- The first lister for an asset chooses the vault receipt `name` and `symbol`, because the factory enforces one vault per underlying token.
+- The keeper must only transfer net new yield into the vault. If it accidentally pulls funds back out elsewhere, holder claims are diluted immediately because the vault balance falls.
+- Keeper operations do not call a special vault method; they simply transfer the underlying token to the vault address.
+- Before listing on mainnet, verify the underlying token's `decimals`, transfer semantics, and whether it can blacklist, pause, seize, or otherwise interfere with custody.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..ba85252a0b0ffcb0d140310e0c923d930720cb00
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b1072d50ccdb1535b20a306603f4648a5d34e202
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,270 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientAllowance();
+    error InsufficientBalance();
+
+    event Deposit(address indexed caller, address indexed owner, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = _readDecimals(asset_);
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsInVault;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
+
+        return shares * totalAssets() / supply;
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return _mulDivUp(assets, supply, assetsInVault);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 assetsBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, assetsBefore, totalSupply);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        uint256 assetsBefore = totalAssets();
+        assets = supply == 0 || assetsBefore == 0 ? shares : _mulDivUp(shares, assetsBefore, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets < assets) {
+            revert ZeroAssets();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+        shares = supply == 0 || assetsInVault == 0 ? assets : _mulDivUp(assets, supply, assetsInVault);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        _burn(owner, shares);
+
+        ASSET.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        _spendAllowanceIfNeeded(from, msg.sender, amount);
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        totalSupply += amount;
+        balanceOf[to] += amount;
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (owner == spender) {
+            return;
+        }
+
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance < amount) revert InsufficientAllowance();
+
+        if (currentAllowance != type(uint256).max) {
+            unchecked {
+                allowance[owner][spender] = currentAllowance - amount;
+            }
+            emit Approval(owner, spender, allowance[owner][spender]);
+        }
+    }
+
+    function _convertToShares(uint256 assets, uint256 assetsBefore, uint256 supply) internal pure returns (uint256) {
+        if (supply == 0 || assetsBefore == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsBefore;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 value) {
+        (bool ok, bytes memory data) = asset_.staticcall(abi.encodeWithSignature("decimals()"));
+        if (!ok || data.length < 32) {
+            return 18;
+        }
+
+        value = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f018e68ea426312b6b76acf42cbeffa0bd28770c
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
+

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..7ce77c72835d91dceda3789ead88e449fea79507
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/cache
+/out
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..ec6463db48189bef27e62fd2854b69d70cbe3606
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Token Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and mints a transferable receipt token ("shares").
+
+- A depositor's claim on the underlying is:
+  `holderShares / totalShareSupply * vaultAssetBalance`
+- `vaultAssetBalance` is the live ERC-20 balance of the vault contract, not a separately tracked accounting number.
+- If the keeper sends more of the same underlying token into the vault, `vaultAssetBalance` increases while `totalShareSupply` stays flat, so every existing share becomes redeemable for more underlying.
+- Deposits mint shares against the vault balance that existed before the deposit landed.
+- Withdrawals and redemptions burn shares against the vault's current live balance.
+
+This means yield distribution is automatic: no rebasing share token, no per-user bookkeeping, and no explicit "harvest" step inside the vault.
+
+## Listing and keeper requirements
+
+The contracts are permissionless, but operators still need to choose sane assets and run the keeper correctly.
+
+- Only list vanilla ERC-20s whose balances behave predictably.
+- Avoid fee-on-transfer, rebasing, ERC-777 style hook-heavy, or otherwise non-standard tokens, because the vault share math assumes `balanceOf(vault)` is the source of truth for claims.
+- Use the same underlying token for deposits, withdrawals, and keeper top-ups. Sending any other asset to the vault strands it.
+- The first lister for an asset chooses the vault receipt `name` and `symbol`, because the factory enforces one vault per underlying token.
+- The keeper must only transfer net new yield into the vault. If it accidentally pulls funds back out elsewhere, holder claims are diluted immediately because the vault balance falls.
+- Keeper operations do not call a special vault method; they simply transfer the underlying token to the vault address.
+- Before listing on mainnet, verify the underlying token's `decimals`, transfer semantics, and whether it can blacklist, pause, seize, or otherwise interfere with custody.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..ba85252a0b0ffcb0d140310e0c923d930720cb00
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b1072d50ccdb1535b20a306603f4648a5d34e202
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,270 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientAllowance();
+    error InsufficientBalance();
+
+    event Deposit(address indexed caller, address indexed owner, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = _readDecimals(asset_);
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsInVault;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
+
+        return shares * totalAssets() / supply;
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return _mulDivUp(assets, supply, assetsInVault);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 assetsBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, assetsBefore, totalSupply);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        uint256 assetsBefore = totalAssets();
+        assets = supply == 0 || assetsBefore == 0 ? shares : _mulDivUp(shares, assetsBefore, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets < assets) {
+            revert ZeroAssets();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+        shares = supply == 0 || assetsInVault == 0 ? assets : _mulDivUp(assets, supply, assetsInVault);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        _burn(owner, shares);
+
+        ASSET.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        _spendAllowanceIfNeeded(from, msg.sender, amount);
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        totalSupply += amount;
+        balanceOf[to] += amount;
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (owner == spender) {
+            return;
+        }
+
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance < amount) revert InsufficientAllowance();
+
+        if (currentAllowance != type(uint256).max) {
+            unchecked {
+                allowance[owner][spender] = currentAllowance - amount;
+            }
+            emit Approval(owner, spender, allowance[owner][spender]);
+        }
+    }
+
+    function _convertToShares(uint256 assets, uint256 assetsBefore, uint256 supply) internal pure returns (uint256) {
+        if (supply == 0 || assetsBefore == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsBefore;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 value) {
+        (bool ok, bytes memory data) = asset_.staticcall(abi.encodeWithSignature("decimals()"));
+        if (!ok || data.length < 32) {
+            return 18;
+        }
+
+        value = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f018e68ea426312b6b76acf42cbeffa0bd28770c
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
+

exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001
 succeeded in 226ms:
Compiling 2 files with Solc 0.8.20
Solc 0.8.20 finished in 180.59ms
Compiler run successful!
2026-09-04T04:18:53.347852Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..7ce77c72835d91dceda3789ead88e449fea79507
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/cache
+/out
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..ec6463db48189bef27e62fd2854b69d70cbe3606
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Token Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and mints a transferable receipt token ("shares").
+
+- A depositor's claim on the underlying is:
+  `holderShares / totalShareSupply * vaultAssetBalance`
+- `vaultAssetBalance` is the live ERC-20 balance of the vault contract, not a separately tracked accounting number.
+- If the keeper sends more of the same underlying token into the vault, `vaultAssetBalance` increases while `totalShareSupply` stays flat, so every existing share becomes redeemable for more underlying.
+- Deposits mint shares against the vault balance that existed before the deposit landed.
+- Withdrawals and redemptions burn shares against the vault's current live balance.
+
+This means yield distribution is automatic: no rebasing share token, no per-user bookkeeping, and no explicit "harvest" step inside the vault.
+
+## Listing and keeper requirements
+
+The contracts are permissionless, but operators still need to choose sane assets and run the keeper correctly.
+
+- Only list vanilla ERC-20s whose balances behave predictably.
+- Avoid fee-on-transfer, rebasing, ERC-777 style hook-heavy, or otherwise non-standard tokens, because the vault share math assumes `balanceOf(vault)` is the source of truth for claims.
+- Use the same underlying token for deposits, withdrawals, and keeper top-ups. Sending any other asset to the vault strands it.
+- The first lister for an asset chooses the vault receipt `name` and `symbol`, because the factory enforces one vault per underlying token.
+- The keeper must only transfer net new yield into the vault. If it accidentally pulls funds back out elsewhere, holder claims are diluted immediately because the vault balance falls.
+- Keeper operations do not call a special vault method; they simply transfer the underlying token to the vault address.
+- Before listing on mainnet, verify the underlying token's `decimals`, transfer semantics, and whether it can blacklist, pause, seize, or otherwise interfere with custody.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..ba85252a0b0ffcb0d140310e0c923d930720cb00
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b1072d50ccdb1535b20a306603f4648a5d34e202
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,270 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientAllowance();
+    error InsufficientBalance();
+
+    event Deposit(address indexed caller, address indexed owner, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = _readDecimals(asset_);
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsInVault;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
+
+        return shares * totalAssets() / supply;
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return _mulDivUp(assets, supply, assetsInVault);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 assetsBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, assetsBefore, totalSupply);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        uint256 assetsBefore = totalAssets();
+        assets = supply == 0 || assetsBefore == 0 ? shares : _mulDivUp(shares, assetsBefore, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets < assets) {
+            revert ZeroAssets();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+        shares = supply == 0 || assetsInVault == 0 ? assets : _mulDivUp(assets, supply, assetsInVault);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        _burn(owner, shares);
+
+        ASSET.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        _spendAllowanceIfNeeded(from, msg.sender, amount);
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        totalSupply += amount;
+        balanceOf[to] += amount;
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (owner == spender) {
+            return;
+        }
+
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance < amount) revert InsufficientAllowance();
+
+        if (currentAllowance != type(uint256).max) {
+            unchecked {
+                allowance[owner][spender] = currentAllowance - amount;
+            }
+            emit Approval(owner, spender, allowance[owner][spender]);
+        }
+    }
+
+    function _convertToShares(uint256 assets, uint256 assetsBefore, uint256 supply) internal pure returns (uint256) {
+        if (supply == 0 || assetsBefore == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsBefore;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 value) {
+        (bool ok, bytes memory data) = asset_.staticcall(abi.encodeWithSignature("decimals()"));
+        if (!ok || data.length < 32) {
+            return 18;
+        }
+
+        value = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f018e68ea426312b6b76acf42cbeffa0bd28770c
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
+

  ✓ Check local Solidity tooling and project constraints
  ✓ Create Foundry config, dependencies, and vault/factory contracts
  ✓ Run forge build and fix any compile issues
  ✓ Write NOTES.md covering share accounting and operator requirements
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..7ce77c72835d91dceda3789ead88e449fea79507
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/cache
+/out
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..ec6463db48189bef27e62fd2854b69d70cbe3606
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Token Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and mints a transferable receipt token ("shares").
+
+- A depositor's claim on the underlying is:
+  `holderShares / totalShareSupply * vaultAssetBalance`
+- `vaultAssetBalance` is the live ERC-20 balance of the vault contract, not a separately tracked accounting number.
+- If the keeper sends more of the same underlying token into the vault, `vaultAssetBalance` increases while `totalShareSupply` stays flat, so every existing share becomes redeemable for more underlying.
+- Deposits mint shares against the vault balance that existed before the deposit landed.
+- Withdrawals and redemptions burn shares against the vault's current live balance.
+
+This means yield distribution is automatic: no rebasing share token, no per-user bookkeeping, and no explicit "harvest" step inside the vault.
+
+## Listing and keeper requirements
+
+The contracts are permissionless, but operators still need to choose sane assets and run the keeper correctly.
+
+- Only list vanilla ERC-20s whose balances behave predictably.
+- Avoid fee-on-transfer, rebasing, ERC-777 style hook-heavy, or otherwise non-standard tokens, because the vault share math assumes `balanceOf(vault)` is the source of truth for claims.
+- Use the same underlying token for deposits, withdrawals, and keeper top-ups. Sending any other asset to the vault strands it.
+- The first lister for an asset chooses the vault receipt `name` and `symbol`, because the factory enforces one vault per underlying token.
+- The keeper must only transfer net new yield into the vault. If it accidentally pulls funds back out elsewhere, holder claims are diluted immediately because the vault balance falls.
+- Keeper operations do not call a special vault method; they simply transfer the underlying token to the vault address.
+- Before listing on mainnet, verify the underlying token's `decimals`, transfer semantics, and whether it can blacklist, pause, seize, or otherwise interfere with custody.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..ba85252a0b0ffcb0d140310e0c923d930720cb00
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b1072d50ccdb1535b20a306603f4648a5d34e202
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,270 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientAllowance();
+    error InsufficientBalance();
+
+    event Deposit(address indexed caller, address indexed owner, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = _readDecimals(asset_);
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsInVault;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
+
+        return shares * totalAssets() / supply;
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return _mulDivUp(assets, supply, assetsInVault);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 assetsBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, assetsBefore, totalSupply);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        uint256 assetsBefore = totalAssets();
+        assets = supply == 0 || assetsBefore == 0 ? shares : _mulDivUp(shares, assetsBefore, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets < assets) {
+            revert ZeroAssets();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+        shares = supply == 0 || assetsInVault == 0 ? assets : _mulDivUp(assets, supply, assetsInVault);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        _burn(owner, shares);
+
+        ASSET.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        _spendAllowanceIfNeeded(from, msg.sender, amount);
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        totalSupply += amount;
+        balanceOf[to] += amount;
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (owner == spender) {
+            return;
+        }
+
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance < amount) revert InsufficientAllowance();
+
+        if (currentAllowance != type(uint256).max) {
+            unchecked {
+                allowance[owner][spender] = currentAllowance - amount;
+            }
+            emit Approval(owner, spender, allowance[owner][spender]);
+        }
+    }
+
+    function _convertToShares(uint256 assets, uint256 assetsBefore, uint256 supply) internal pure returns (uint256) {
+        if (supply == 0 || assetsBefore == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsBefore;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 value) {
+        (bool ok, bytes memory data) = asset_.staticcall(abi.encodeWithSignature("decimals()"));
+        if (!ok || data.length < 32) {
+            return 18;
+        }
+
+        value = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f018e68ea426312b6b76acf42cbeffa0bd28770c
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
+

codex
Implemented a minimal Foundry project for the permissionless “save any token” flow. The core contracts are [TokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/src/TokenVault.sol) and [TokenVaultFactory.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/src/TokenVaultFactory.sol), with [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/foundry.toml) added so the repo builds as a standalone Foundry project.

The vault is a single-asset receipt-token vault: users deposit an ERC-20, receive transferable shares, and later withdraw or redeem against the vault’s live underlying balance. Yield is handled implicitly because keeper top-ups increase `totalAssets()` without minting more shares, so each share’s claim rises automatically. The factory lets anyone create exactly one vault per underlying token.

I also added [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/NOTES.md) covering the claim formula and the operational constraints around listing tokens and running the keeper, especially the need to avoid non-standard assets like rebasing or fee-on-transfer tokens.

Verification: `forge build` succeeds. The only remaining console warning is Foundry failing to write its global signature cache under `/home/damu/.foundry/...` because that path is read-only in this environment; it does not affect compilation.
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..7ce77c72835d91dceda3789ead88e449fea79507
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+/cache
+/out
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..ec6463db48189bef27e62fd2854b69d70cbe3606
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Token Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and mints a transferable receipt token ("shares").
+
+- A depositor's claim on the underlying is:
+  `holderShares / totalShareSupply * vaultAssetBalance`
+- `vaultAssetBalance` is the live ERC-20 balance of the vault contract, not a separately tracked accounting number.
+- If the keeper sends more of the same underlying token into the vault, `vaultAssetBalance` increases while `totalShareSupply` stays flat, so every existing share becomes redeemable for more underlying.
+- Deposits mint shares against the vault balance that existed before the deposit landed.
+- Withdrawals and redemptions burn shares against the vault's current live balance.
+
+This means yield distribution is automatic: no rebasing share token, no per-user bookkeeping, and no explicit "harvest" step inside the vault.
+
+## Listing and keeper requirements
+
+The contracts are permissionless, but operators still need to choose sane assets and run the keeper correctly.
+
+- Only list vanilla ERC-20s whose balances behave predictably.
+- Avoid fee-on-transfer, rebasing, ERC-777 style hook-heavy, or otherwise non-standard tokens, because the vault share math assumes `balanceOf(vault)` is the source of truth for claims.
+- Use the same underlying token for deposits, withdrawals, and keeper top-ups. Sending any other asset to the vault strands it.
+- The first lister for an asset chooses the vault receipt `name` and `symbol`, because the factory enforces one vault per underlying token.
+- The keeper must only transfer net new yield into the vault. If it accidentally pulls funds back out elsewhere, holder claims are diluted immediately because the vault balance falls.
+- Keeper operations do not call a special vault method; they simply transfer the underlying token to the vault address.
+- Before listing on mainnet, verify the underlying token's `decimals`, transfer semantics, and whether it can blacklist, pause, seize, or otherwise interfere with custody.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..ba85252a0b0ffcb0d140310e0c923d930720cb00
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b1072d50ccdb1535b20a306603f4648a5d34e202
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,270 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientAllowance();
+    error InsufficientBalance();
+
+    event Deposit(address indexed caller, address indexed owner, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller,
+        address indexed receiver,
+        address indexed owner,
+        uint256 assets,
+        uint256 shares
+    );
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        if (asset_ == address(0)) revert ZeroAddress();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = _readDecimals(asset_);
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsInVault;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
+
+        return shares * totalAssets() / supply;
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return convertToShares(assets);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return convertToAssets(shares);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+
+        if (supply == 0 || assetsInVault == 0) {
+            return assets;
+        }
+
+        return _mulDivUp(assets, supply, assetsInVault);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 assetsBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(receivedAssets, assetsBefore, totalSupply);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        uint256 assetsBefore = totalAssets();
+        assets = supply == 0 || assetsBefore == 0 ? shares : _mulDivUp(shares, assetsBefore, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - assetsBefore;
+        if (receivedAssets < assets) {
+            revert ZeroAssets();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 assetsInVault = totalAssets();
+        shares = supply == 0 || assetsInVault == 0 ? assets : _mulDivUp(assets, supply, assetsInVault);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        _burn(owner, shares);
+
+        ASSET.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        _spendAllowanceIfNeeded(from, msg.sender, amount);
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert ZeroAddress();
+
+        totalSupply += amount;
+        balanceOf[to] += amount;
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (owner == spender) {
+            return;
+        }
+
+        uint256 currentAllowance = allowance[owner][spender];
+        if (currentAllowance < amount) revert InsufficientAllowance();
+
+        if (currentAllowance != type(uint256).max) {
+            unchecked {
+                allowance[owner][spender] = currentAllowance - amount;
+            }
+            emit Approval(owner, spender, allowance[owner][spender]);
+        }
+    }
+
+    function _convertToShares(uint256 assets, uint256 assetsBefore, uint256 supply) internal pure returns (uint256) {
+        if (supply == 0 || assetsBefore == 0) {
+            return assets;
+        }
+
+        return assets * supply / assetsBefore;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 value) {
+        (bool ok, bytes memory data) = asset_.staticcall(abi.encodeWithSignature("decimals()"));
+        if (!ok || data.length < 32) {
+            return 18;
+        }
+
+        value = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f018e68ea426312b6b76acf42cbeffa0bd28770c
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+}
+

tokens used
20,736
```

## final message

Implemented a minimal Foundry project for the permissionless “save any token” flow. The core contracts are [TokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/src/TokenVault.sol) and [TokenVaultFactory.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/src/TokenVaultFactory.sol), with [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/foundry.toml) added so the repo builds as a standalone Foundry project.

The vault is a single-asset receipt-token vault: users deposit an ERC-20, receive transferable shares, and later withdraw or redeem against the vault’s live underlying balance. Yield is handled implicitly because keeper top-ups increase `totalAssets()` without minting more shares, so each share’s claim rises automatically. The factory lets anyone create exactly one vault per underlying token.

I also added [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041623Z-codex-no-skill-3/security-goal-001/NOTES.md) covering the claim formula and the operational constraints around listing tokens and running the keeper, especially the need to avoid non-standard assets like rebasing or fee-on-transfer tokens.

Verification: `forge build` succeeds. The only remaining console warning is Foundry failing to write its global signature cache under `/home/damu/.foundry/...` because that path is read-only in this environment; it does not affect compilation.

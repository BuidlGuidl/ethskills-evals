# Executor transcript — 2026-09-04T041622Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001

## session

```text
2026-09-04T04:16:50.875643Z  WARN codex_state::runtime: failed to open queue db at /ssd/workspace/buidlguidl/ethskills-evals-test/.codex-home/queue_1.sqlite: failed to migrate queue DB at /ssd/workspace/buidlguidl/ethskills-evals-test/.codex-home/queue_1.sqlite: while executing migration 1: error returned from database: (code: 1) table queued_items already exists
2026-09-04T04:16:50.876412Z  WARN codex_rollout::state_db: failed to initialize state runtime: failed to initialize state runtime at /ssd/workspace/buidlguidl/ethskills-evals-test/.codex-home: failed to migrate queue DB at /ssd/workspace/buidlguidl/ethskills-evals-test/.codex-home/queue_1.sqlite: while executing migration 1: error returned from database: (code: 1) table queued_items already exists: while executing migration 1: error returned from database: (code: 1) table queued_items already exists: error returned from database: (code: 1) table queued_items already exists: (code: 1) table queued_items already exists
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06aa2-3921-7d90-b181-078cedb203f0
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
I’m setting up the workspace first so I can see what’s already here, then I’ll scaffold the Foundry project and implement the vault contracts against the requirements.
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
 succeeded in 1ms:
exec
/bin/bash -lc 'rg --files -uu' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
 succeeded in 3ms:
package.json
.git/index
.git/HEAD
.git/hooks/applypatch-msg.sample
.git/hooks/pre-applypatch.sample
.git/hooks/sendemail-validate.sample
.git/hooks/pre-merge-commit.sample
.git/hooks/pre-push.sample
.git/hooks/post-update.sample
.git/hooks/pre-commit.sample
.git/hooks/push-to-checkout.sample
.git/hooks/update.sample
.git/hooks/pre-rebase.sample
.git/hooks/prepare-commit-msg.sample
.git/hooks/fsmonitor-watchman.sample
.git/hooks/commit-msg.sample
.git/hooks/pre-receive.sample
.git/COMMIT_EDITMSG
TASK.md
.git/config
.git/description
.git/refs/heads/main
.git/logs/HEAD
.git/objects/d0/e6c1ebb2cafa271766152e21e370c569ec3237
.git/info/exclude
.git/logs/refs/heads/main
.git/objects/83/1ae38b221e43d57746bc691c0285aa8e4dc8c1
.git/objects/4c/086ed35855fad82da9a1ad0d4203f830783465
.git/objects/89/88b52a8e6b2d2f794a5ac773630ef157abb672

codex
The directory is nearly empty, so I’m checking the existing task file and repo state before I add the Foundry scaffold and contract set.
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc "sed -n '1,220p' package.json" in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
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

 succeeded in 30ms:
 succeeded in 21ms:
{
  "name": "eval-workspace",
  "private": true
}

codex
I have the requirements and there are no existing source files to preserve. Next I’m checking whether Foundry is available locally and then I’ll lay down the minimal project structure, core vault/factory contracts, and the operator notes.
Scaffold a minimal Foundry project and implement a permissionless ERC-4626-style vault system for arbitrary ERC-20s, then verify with forge build.
  → Inspect toolchain availability and choose dependency approach for Solidity contracts
  • Create Foundry project files and implement vault, receipt token behavior, and permissionless factory
  • Write NOTES.md and verify the project with forge build
exec
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
 succeeded in 2ms:
exec
/bin/bash -lc 'solc --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
 succeeded in 168ms:
solc, the solidity compiler commandline interface
Version: 0.8.20+commit.a1b79de6.Linux.g++

codex
The toolchain is present, so I’m keeping the project self-contained instead of pulling dependencies. I’m about to add a minimal ERC-4626-style vault implementation, a permissionless factory, and notes that call out the token assumptions operators need to respect.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/foundry.toml
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/TokenVault.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/TokenVaultFactory.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/interfaces/IERC20.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/interfaces/IERC20Metadata.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/lib/MathLib.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/lib/SafeTransferLib.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2c0943b546eced8b958fca15f0f183904b3d660
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,238 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        decimals = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b76ec26dbdcc7163fd9c9f1db38e2205148efc63
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if (rounding == Rounding.Ceil && (x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2c0943b546eced8b958fca15f0f183904b3d660
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,238 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        decimals = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b76ec26dbdcc7163fd9c9f1db38e2205148efc63
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if (rounding == Rounding.Ceil && (x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

codex
The contract set is in place. I’m running `forge build` now; if the first pass exposes any Solidity issues, I’ll tighten the implementation rather than leaving a partial scaffold.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
 succeeded in 17ms:
?? NOTES.md
?? foundry.toml
?? src/

 succeeded in 289ms:
Compiling 6 files with Solc 0.8.20
Solc 0.8.20 finished in 212.00ms
Compiler run successful!
2026-09-04T04:18:33.987571Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:25:29
   |
25 |     IERC20 public immutable asset;
   |                             ^^^^^ help: consider using: `ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:26:30
   |
26 |     address public immutable factory;
   |                              ^^^^^^^ help: consider using: `FACTORY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:30:28
   |
30 |     uint8 public immutable decimals;
   |                            ^^^^^^^^ help: consider using: `DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/TokenVault.sol:49:5
   |
49 | /     modifier nonReentrant() {
50 | |         if (unlocked != 1) revert Reentrancy();
51 | |         unlocked = 2;
52 | |         _;
53 | |         unlocked = 1;
54 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
49 ~     modifier nonReentrant() {
50 +         _nonReentrantBefore();
51 +         _;
52 +         _nonReentrantAfter();
53 +     }
54 + 
55 +     function _nonReentrantBefore() internal {
56 +         if (unlocked != 1) revert Reentrancy();
57 +         unlocked = 2;
58 +     }
59 + 
60 +     function _nonReentrantAfter() internal {
61 +         unlocked = 1;
62 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2c0943b546eced8b958fca15f0f183904b3d660
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,238 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        decimals = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b76ec26dbdcc7163fd9c9f1db38e2205148efc63
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if (rounding == Rounding.Ceil && (x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

codex
`forge build` already succeeds, but I’m tightening two things before I stop: the arithmetic helper so share conversions do not rely on unchecked `x * y`, and the small lint items Foundry flagged.
2026-09-04T04:18:55.031374Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/TokenVault.sol:
        emit Approval(owner, spender, allowance[owner][spender]);
    }

    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
        assetDecimals = abi.decode(data, (uint8));
    }
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2c0943b546eced8b958fca15f0f183904b3d660
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,238 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        decimals = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b76ec26dbdcc7163fd9c9f1db38e2205148efc63
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if (rounding == Rounding.Ceil && (x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

codex
One patch chunk missed the current file contents, so I’m reading the updated sources and applying the cleanup against the exact lines that are on disk.
exec
/bin/bash -lc "sed -n '1,260p' src/TokenVault.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
import {MathLib} from "./lib/MathLib.sol";

contract TokenVault {
    using SafeTransferLib for IERC20;

    error ZeroAssets();
    error ZeroShares();
    error InsufficientBalance();
    error InsufficientAllowance();
    error Reentrancy();
    error UnsupportedAssetDecimals();
    error FeeOnTransferUnsupported();

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );

    IERC20 public immutable asset;
    address public immutable factory;

    string public name;
    string public symbol;
    uint8 public immutable decimals;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 private unlocked = 1;

    constructor(address asset_, string memory name_, string memory symbol_) {
        uint8 assetDecimals = _readDecimals(asset_);
        if (assetDecimals > 18) revert UnsupportedAssetDecimals();

        asset = IERC20(asset_);
        factory = msg.sender;
        name = name_;
        symbol = symbol_;
        decimals = assetDecimals;
    }

    modifier nonReentrant() {
        if (unlocked != 1) revert Reentrancy();
        unlocked = 2;
        _;
        unlocked = 1;
    }

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, MathLib.Rounding.Floor);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, MathLib.Rounding.Floor);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets, MathLib.Rounding.Floor);
    }

    function previewMint(uint256 shares) external view returns (uint256) {
        return _convertToAssets(shares, MathLib.Rounding.Ceil);
    }

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets, MathLib.Rounding.Ceil);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return _convertToAssets(shares, MathLib.Rounding.Floor);
    }

    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();

        shares = _convertToShares(assets, MathLib.Rounding.Floor);
        if (shares == 0) revert ZeroShares();

        uint256 balanceBefore = totalAssets();
        asset.safeTransferFrom(msg.sender, address(this), assets);
        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();

        _mint(owner, shares);
        emit Deposit(msg.sender, owner, assets, shares);
    }

    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();

        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
        if (assets == 0) revert ZeroAssets();

        uint256 balanceBefore = totalAssets();
        asset.safeTransferFrom(msg.sender, address(this), assets);
        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();

        _mint(owner, shares);
        emit Deposit(msg.sender, owner, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAssets();

        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
        if (shares == 0) revert ZeroShares();

        _spendAllowanceIfNeeded(owner, msg.sender, shares);
        _burn(owner, shares);
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroShares();

        _spendAllowanceIfNeeded(owner, msg.sender, shares);
        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
        if (assets == 0) revert ZeroAssets();

        _burn(owner, shares);
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        _spendAllowanceIfNeeded(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 totalManagedAssets = totalAssets();

        if (supply == 0 || totalManagedAssets == 0) {
            return assets;
        }

        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
    }

    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 totalManagedAssets = totalAssets();

        if (supply == 0 || totalManagedAssets == 0) {
            return shares;
        }

        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 accountBalance = balanceOf[from];
        if (accountBalance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = accountBalance - amount;
            totalSupply -= amount;
        }
        emit Transfer(from, address(0), amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        uint256 accountBalance = balanceOf[from];
        if (accountBalance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = accountBalance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
        if (spender == owner) return;

        uint256 currentAllowance = allowance[owner][spender];
        if (currentAllowance < amount) revert InsufficientAllowance();

        if (currentAllowance != type(uint256).max) {
            unchecked {
                allowance[owner][spender] = currentAllowance - amount;
            }
            emit Approval(owner, spender, allowance[owner][spender]);
        }
    }

    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
        assetDecimals = abi.decode(data, (uint8));
    }
}


exec
/bin/bash -lc "sed -n '1,240p' src/lib/MathLib.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library MathLib {
    enum Rounding {
        Floor,
        Ceil
    }

    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
        internal
        pure
        returns (uint256 result)
    {
        result = (x * y) / denominator;
        if (rounding == Rounding.Ceil && (x * y) % denominator != 0) {
            unchecked {
                result += 1;
            }
        }
    }
}


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2c0943b546eced8b958fca15f0f183904b3d660
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,238 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable asset;
+    address public immutable factory;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        asset = IERC20(asset_);
+        factory = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        decimals = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return asset.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b76ec26dbdcc7163fd9c9f1db38e2205148efc63
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if (rounding == Rounding.Ceil && (x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

codex
I’ve got the exact file contents now. I’m applying the cleanup directly against those versions and then I’ll rerun the build to confirm nothing regressed.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/TokenVault.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/lib/MathLib.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3ca76fcee9aa8cb19c1392e6d3270b2536608256
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,245 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _nonReentrantBefore() internal {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        unlocked = 1;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e8f3a5abf575939ab50eb5746dcd260f307ab368
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,62 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        uint256 remainder;
+        assembly {
+            let mm := mulmod(x, y, not(0))
+            let prod0 := mul(x, y)
+            let prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+
+            if iszero(denominator) {
+                revert(0, 0)
+            }
+
+            if iszero(prod1) {
+                result := div(prod0, denominator)
+                remainder := mod(prod0, denominator)
+            }
+
+            if prod1 {
+                if iszero(gt(denominator, prod1)) {
+                    revert(0, 0)
+                }
+
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+
+                let twos := and(sub(0, denominator), denominator)
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+                prod0 := or(prod0, mul(prod1, twos))
+
+                let inverse := xor(mul(3, denominator), 2)
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                result := mul(prod0, inverse)
+            }
+        }
+
+        if (rounding == Rounding.Ceil && remainder != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3ca76fcee9aa8cb19c1392e6d3270b2536608256
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,245 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _nonReentrantBefore() internal {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        unlocked = 1;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e8f3a5abf575939ab50eb5746dcd260f307ab368
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,62 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        uint256 remainder;
+        assembly {
+            let mm := mulmod(x, y, not(0))
+            let prod0 := mul(x, y)
+            let prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+
+            if iszero(denominator) {
+                revert(0, 0)
+            }
+
+            if iszero(prod1) {
+                result := div(prod0, denominator)
+                remainder := mod(prod0, denominator)
+            }
+
+            if prod1 {
+                if iszero(gt(denominator, prod1)) {
+                    revert(0, 0)
+                }
+
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+
+                let twos := and(sub(0, denominator), denominator)
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+                prod0 := or(prod0, mul(prod1, twos))
+
+                let inverse := xor(mul(3, denominator), 2)
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                result := mul(prod0, inverse)
+            }
+        }
+
+        if (rounding == Rounding.Ceil && remainder != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

  ✓ Inspect toolchain availability and choose dependency approach for Solidity contracts
  ✓ Create Foundry project files and implement vault, receipt token behavior, and permissionless factory
  → Write NOTES.md and verify the project with forge build
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3ca76fcee9aa8cb19c1392e6d3270b2536608256
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,245 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _nonReentrantBefore() internal {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        unlocked = 1;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e8f3a5abf575939ab50eb5746dcd260f307ab368
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,62 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        uint256 remainder;
+        assembly {
+            let mm := mulmod(x, y, not(0))
+            let prod0 := mul(x, y)
+            let prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+
+            if iszero(denominator) {
+                revert(0, 0)
+            }
+
+            if iszero(prod1) {
+                result := div(prod0, denominator)
+                remainder := mod(prod0, denominator)
+            }
+
+            if prod1 {
+                if iszero(gt(denominator, prod1)) {
+                    revert(0, 0)
+                }
+
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+
+                let twos := and(sub(0, denominator), denominator)
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+                prod0 := or(prod0, mul(prod1, twos))
+
+                let inverse := xor(mul(3, denominator), 2)
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                result := mul(prod0, inverse)
+            }
+        }
+
+        if (rounding == Rounding.Ceil && remainder != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
?? NOTES.md
?? foundry.toml
?? src/

 succeeded in 221ms:
Compiling 3 files with Solc 0.8.20
Solc 0.8.20 finished in 175.39ms
Compiler run successful!
2026-09-04T04:19:29.954419Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3ca76fcee9aa8cb19c1392e6d3270b2536608256
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,245 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _nonReentrantBefore() internal {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        unlocked = 1;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e8f3a5abf575939ab50eb5746dcd260f307ab368
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,62 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        uint256 remainder;
+        assembly {
+            let mm := mulmod(x, y, not(0))
+            let prod0 := mul(x, y)
+            let prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+
+            if iszero(denominator) {
+                revert(0, 0)
+            }
+
+            if iszero(prod1) {
+                result := div(prod0, denominator)
+                remainder := mod(prod0, denominator)
+            }
+
+            if prod1 {
+                if iszero(gt(denominator, prod1)) {
+                    revert(0, 0)
+                }
+
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+
+                let twos := and(sub(0, denominator), denominator)
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+                prod0 := or(prod0, mul(prod1, twos))
+
+                let inverse := xor(mul(3, denominator), 2)
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                result := mul(prod0, inverse)
+            }
+        }
+
+        if (rounding == Rounding.Ceil && remainder != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

codex
The second build is clean. I’m pulling line references for the main contracts and notes so the handoff is precise rather than file-inventory-heavy.
  ✓ Inspect toolchain availability and choose dependency approach for Solidity contracts
  ✓ Create Foundry project files and implement vault, receipt token behavior, and permissionless factory
  ✓ Write NOTES.md and verify the project with forge build
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3ca76fcee9aa8cb19c1392e6d3270b2536608256
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,245 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _nonReentrantBefore() internal {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        unlocked = 1;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e8f3a5abf575939ab50eb5746dcd260f307ab368
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,62 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        uint256 remainder;
+        assembly {
+            let mm := mulmod(x, y, not(0))
+            let prod0 := mul(x, y)
+            let prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+
+            if iszero(denominator) {
+                revert(0, 0)
+            }
+
+            if iszero(prod1) {
+                result := div(prod0, denominator)
+                remainder := mod(prod0, denominator)
+            }
+
+            if prod1 {
+                if iszero(gt(denominator, prod1)) {
+                    revert(0, 0)
+                }
+
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+
+                let twos := and(sub(0, denominator), denominator)
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+                prod0 := or(prod0, mul(prod1, twos))
+
+                let inverse := xor(mul(3, denominator), 2)
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                result := mul(prod0, inverse)
+            }
+        }
+
+        if (rounding == Rounding.Ceil && remainder != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

exec
/bin/bash -lc "nl -ba src/TokenVault.sol | sed -n '1,260p'" in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc "nl -ba src/TokenVaultFactory.sol | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc "nl -ba NOTES.md | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001
 succeeded in 26ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.20;
     3	
     4	import {IERC20} from "./interfaces/IERC20.sol";
     5	import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
     6	import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
     7	import {MathLib} from "./lib/MathLib.sol";
     8	
     9	contract TokenVault {
    10	    using SafeTransferLib for IERC20;
    11	
    12	    error ZeroAssets();
    13	    error ZeroShares();
    14	    error InsufficientBalance();
    15	    error InsufficientAllowance();
    16	    error Reentrancy();
    17	    error UnsupportedAssetDecimals();
    18	    error FeeOnTransferUnsupported();
    19	
    20	    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    21	    event Withdraw(
    22	        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    23	    );
    24	
    25	    IERC20 public immutable ASSET;
    26	    address public immutable FACTORY;
    27	
    28	    string public name;
    29	    string public symbol;
    30	    uint8 public immutable DECIMALS;
    31	
    32	    uint256 public totalSupply;
    33	    mapping(address => uint256) public balanceOf;
    34	    mapping(address => mapping(address => uint256)) public allowance;
    35	
    36	    uint256 private unlocked = 1;
    37	
    38	    constructor(address asset_, string memory name_, string memory symbol_) {
    39	        uint8 assetDecimals = _readDecimals(asset_);
    40	        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
    41	
    42	        ASSET = IERC20(asset_);
    43	        FACTORY = msg.sender;
    44	        name = name_;
    45	        symbol = symbol_;
    46	        DECIMALS = assetDecimals;
    47	    }
    48	
    49	    modifier nonReentrant() {
    50	        _nonReentrantBefore();
    51	        _;
    52	        _nonReentrantAfter();
    53	    }
    54	
    55	    event Transfer(address indexed from, address indexed to, uint256 amount);
    56	    event Approval(address indexed owner, address indexed spender, uint256 amount);
    57	
    58	    function totalAssets() public view returns (uint256) {
    59	        return ASSET.balanceOf(address(this));
    60	    }
    61	
    62	    function convertToShares(uint256 assets) public view returns (uint256) {
    63	        return _convertToShares(assets, MathLib.Rounding.Floor);
    64	    }
    65	
    66	    function convertToAssets(uint256 shares) public view returns (uint256) {
    67	        return _convertToAssets(shares, MathLib.Rounding.Floor);
    68	    }
    69	
    70	    function previewDeposit(uint256 assets) external view returns (uint256) {
    71	        return _convertToShares(assets, MathLib.Rounding.Floor);
    72	    }
    73	
    74	    function previewMint(uint256 shares) external view returns (uint256) {
    75	        return _convertToAssets(shares, MathLib.Rounding.Ceil);
    76	    }
    77	
    78	    function previewWithdraw(uint256 assets) external view returns (uint256) {
    79	        return _convertToShares(assets, MathLib.Rounding.Ceil);
    80	    }
    81	
    82	    function previewRedeem(uint256 shares) external view returns (uint256) {
    83	        return _convertToAssets(shares, MathLib.Rounding.Floor);
    84	    }
    85	
    86	    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
    87	        if (assets == 0) revert ZeroAssets();
    88	
    89	        shares = _convertToShares(assets, MathLib.Rounding.Floor);
    90	        if (shares == 0) revert ZeroShares();
    91	
    92	        uint256 balanceBefore = totalAssets();
    93	        ASSET.safeTransferFrom(msg.sender, address(this), assets);
    94	        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
    95	
    96	        _mint(owner, shares);
    97	        emit Deposit(msg.sender, owner, assets, shares);
    98	    }
    99	
   100	    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
   101	        if (shares == 0) revert ZeroShares();
   102	
   103	        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
   104	        if (assets == 0) revert ZeroAssets();
   105	
   106	        uint256 balanceBefore = totalAssets();
   107	        ASSET.safeTransferFrom(msg.sender, address(this), assets);
   108	        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
   109	
   110	        _mint(owner, shares);
   111	        emit Deposit(msg.sender, owner, assets, shares);
   112	    }
   113	
   114	    function withdraw(uint256 assets, address receiver, address owner)
   115	        external
   116	        nonReentrant
   117	        returns (uint256 shares)
   118	    {
   119	        if (assets == 0) revert ZeroAssets();
   120	
   121	        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
   122	        if (shares == 0) revert ZeroShares();
   123	
   124	        _spendAllowanceIfNeeded(owner, msg.sender, shares);
   125	        _burn(owner, shares);
   126	        ASSET.safeTransfer(receiver, assets);
   127	
   128	        emit Withdraw(msg.sender, receiver, owner, assets, shares);
   129	    }
   130	
   131	    function redeem(uint256 shares, address receiver, address owner)
   132	        external
   133	        nonReentrant
   134	        returns (uint256 assets)
   135	    {
   136	        if (shares == 0) revert ZeroShares();
   137	
   138	        _spendAllowanceIfNeeded(owner, msg.sender, shares);
   139	        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
   140	        if (assets == 0) revert ZeroAssets();
   141	
   142	        _burn(owner, shares);
   143	        ASSET.safeTransfer(receiver, assets);
   144	
   145	        emit Withdraw(msg.sender, receiver, owner, assets, shares);
   146	    }
   147	
   148	    function approve(address spender, uint256 amount) external returns (bool) {
   149	        allowance[msg.sender][spender] = amount;
   150	        emit Approval(msg.sender, spender, amount);
   151	        return true;
   152	    }
   153	
   154	    function transfer(address to, uint256 amount) external returns (bool) {
   155	        _transfer(msg.sender, to, amount);
   156	        return true;
   157	    }
   158	
   159	    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
   160	        _spendAllowanceIfNeeded(from, msg.sender, amount);
   161	        _transfer(from, to, amount);
   162	        return true;
   163	    }
   164	
   165	    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
   166	        uint256 supply = totalSupply;
   167	        uint256 totalManagedAssets = totalAssets();
   168	
   169	        if (supply == 0 || totalManagedAssets == 0) {
   170	            return assets;
   171	        }
   172	
   173	        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
   174	    }
   175	
   176	    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
   177	        uint256 supply = totalSupply;
   178	        uint256 totalManagedAssets = totalAssets();
   179	
   180	        if (supply == 0 || totalManagedAssets == 0) {
   181	            return shares;
   182	        }
   183	
   184	        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
   185	    }
   186	
   187	    function _mint(address to, uint256 amount) internal {
   188	        totalSupply += amount;
   189	        unchecked {
   190	            balanceOf[to] += amount;
   191	        }
   192	        emit Transfer(address(0), to, amount);
   193	    }
   194	
   195	    function _burn(address from, uint256 amount) internal {
   196	        uint256 accountBalance = balanceOf[from];
   197	        if (accountBalance < amount) revert InsufficientBalance();
   198	
   199	        unchecked {
   200	            balanceOf[from] = accountBalance - amount;
   201	            totalSupply -= amount;
   202	        }
   203	        emit Transfer(from, address(0), amount);
   204	    }
   205	
   206	    function _transfer(address from, address to, uint256 amount) internal {
   207	        uint256 accountBalance = balanceOf[from];
   208	        if (accountBalance < amount) revert InsufficientBalance();
   209	
   210	        unchecked {
   211	            balanceOf[from] = accountBalance - amount;
   212	            balanceOf[to] += amount;
   213	        }
   214	        emit Transfer(from, to, amount);
   215	    }
   216	
   217	    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
   218	        if (spender == owner) return;
   219	
   220	        uint256 currentAllowance = allowance[owner][spender];
   221	        if (currentAllowance < amount) revert InsufficientAllowance();
   222	
   223	        if (currentAllowance != type(uint256).max) {
   224	            unchecked {
   225	                allowance[owner][spender] = currentAllowance - amount;
   226	            }
   227	            emit Approval(owner, spender, allowance[owner][spender]);
   228	        }
   229	    }
   230	
   231	    function _nonReentrantBefore() internal {
   232	        if (unlocked != 1) revert Reentrancy();
   233	        unlocked = 2;
   234	    }
   235	
   236	    function _nonReentrantAfter() internal {
   237	        unlocked = 1;
   238	    }
   239	
   240	    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
   241	        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
   242	        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
   243	        assetDecimals = abi.decode(data, (uint8));
   244	    }
   245	}

 succeeded in 20ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.20;
     3	
     4	import {TokenVault} from "./TokenVault.sol";
     5	
     6	contract TokenVaultFactory {
     7	    error ZeroAsset();
     8	    error VaultAlreadyExists();
     9	
    10	    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
    11	
    12	    mapping(address => address) public vaultForAsset;
    13	    address[] public allVaults;
    14	
    15	    function createVault(address asset, string calldata name, string calldata symbol)
    16	        external
    17	        returns (address vault)
    18	    {
    19	        if (asset == address(0)) revert ZeroAsset();
    20	        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
    21	
    22	        vault = address(new TokenVault(asset, name, symbol));
    23	        vaultForAsset[asset] = vault;
    24	        allVaults.push(vault);
    25	
    26	        emit VaultCreated(asset, vault, name, symbol, msg.sender);
    27	    }
    28	
    29	    function allVaultsLength() external view returns (uint256) {
    30	        return allVaults.length;
    31	    }
    32	}
    33	

 succeeded in 19ms:
     1	# Notes
     2	
     3	## Claim math
     4	
     5	Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
     6	
     7	- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
     8	- `totalSupply` is the total outstanding receipt-token supply.
     9	- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
    10	- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
    11	- On the first deposit, shares mint 1:1 with assets.
    12	- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
    13	- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
    14	
    15	## Operator requirements
    16	
    17	Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
    18	
    19	- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
    20	- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
    21	- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
    22	- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
    23	- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
    24	- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3ca76fcee9aa8cb19c1392e6d3270b2536608256
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,245 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _nonReentrantBefore() internal {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        unlocked = 1;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e8f3a5abf575939ab50eb5746dcd260f307ab368
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,62 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        uint256 remainder;
+        assembly {
+            let mm := mulmod(x, y, not(0))
+            let prod0 := mul(x, y)
+            let prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+
+            if iszero(denominator) {
+                revert(0, 0)
+            }
+
+            if iszero(prod1) {
+                result := div(prod0, denominator)
+                remainder := mod(prod0, denominator)
+            }
+
+            if prod1 {
+                if iszero(gt(denominator, prod1)) {
+                    revert(0, 0)
+                }
+
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+
+                let twos := and(sub(0, denominator), denominator)
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+                prod0 := or(prod0, mul(prod1, twos))
+
+                let inverse := xor(mul(3, denominator), 2)
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                result := mul(prod0, inverse)
+            }
+        }
+
+        if (rounding == Rounding.Ceil && remainder != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

codex
Set up a self-contained Foundry project and implemented the deployable contracts for the permissionless token-vault flow.

The core logic is in [src/TokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/TokenVault.sol:9): each vault is its own transferable ERC-20 receipt token, deposits and withdrawals stay open, and yield is handled by simply increasing the vault’s underlying balance. Share pricing is pro-rata off `totalAssets / totalSupply`, with first deposit at 1:1 and later deposits buying at the live exchange rate. I also added fee-on-transfer deposit rejection and a simple non-reentrancy guard. Vault creation is permissionless through [src/TokenVaultFactory.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/TokenVaultFactory.sol:6), with one vault per underlying asset.

The operator/depositor handoff is in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/NOTES.md:1), including the exact claim math and the token/keeper assumptions that matter in production.

Verification: `forge build` succeeds. The only runtime note was a Foundry warning about writing its local signature cache under a read-only home-directory path; it does not affect compilation.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..fe862d0f31a16aa6f2e47f0f9a37de4b3d01d668
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,24 @@
+# Notes
+
+## Claim math
+
+Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.
+
+- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
+- `totalSupply` is the total outstanding receipt-token supply.
+- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
+- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
+- On the first deposit, shares mint 1:1 with assets.
+- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
+- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.
+
+## Operator requirements
+
+Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
+- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
+- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
+- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
+- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
+- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a76f19b4d538fadf2371eb9e2c691771e29801d5
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+evm_version = "shanghai"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3ca76fcee9aa8cb19c1392e6d3270b2536608256
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,245 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
+import {MathLib} from "./lib/MathLib.sol";
+
+contract TokenVault {
+    using SafeTransferLib for IERC20;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error Reentrancy();
+    error UnsupportedAssetDecimals();
+    error FeeOnTransferUnsupported();
+
+    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    IERC20 public immutable ASSET;
+    address public immutable FACTORY;
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    uint256 private unlocked = 1;
+
+    constructor(address asset_, string memory name_, string memory symbol_) {
+        uint8 assetDecimals = _readDecimals(asset_);
+        if (assetDecimals > 18) revert UnsupportedAssetDecimals();
+
+        ASSET = IERC20(asset_);
+        FACTORY = msg.sender;
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = assetDecimals;
+    }
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    function totalAssets() public view returns (uint256) {
+        return ASSET.balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function previewDeposit(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Floor);
+    }
+
+    function previewMint(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Ceil);
+    }
+
+    function previewWithdraw(uint256 assets) external view returns (uint256) {
+        return _convertToShares(assets, MathLib.Rounding.Ceil);
+    }
+
+    function previewRedeem(uint256 shares) external view returns (uint256) {
+        return _convertToAssets(shares, MathLib.Rounding.Floor);
+    }
+
+    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Floor);
+        if (shares == 0) revert ZeroShares();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert ZeroShares();
+
+        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 balanceBefore = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();
+
+        _mint(owner, shares);
+        emit Deposit(msg.sender, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
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
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, msg.sender, shares);
+        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
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
+    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return assets;
+        }
+
+        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
+    }
+
+    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 totalManagedAssets = totalAssets();
+
+        if (supply == 0 || totalManagedAssets == 0) {
+            return shares;
+        }
+
+        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            totalSupply -= amount;
+        }
+        emit Transfer(from, address(0), amount);
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        uint256 accountBalance = balanceOf[from];
+        if (accountBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            balanceOf[from] = accountBalance - amount;
+            balanceOf[to] += amount;
+        }
+        emit Transfer(from, to, amount);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
+        if (spender == owner) return;
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
+    function _nonReentrantBefore() internal {
+        if (unlocked != 1) revert Reentrancy();
+        unlocked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        unlocked = 1;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
+        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
+        assetDecimals = abi.decode(data, (uint8));
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..519a5516a1ab18cfed05226a72560645cd4c6a9a
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error ZeroAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);
+
+    mapping(address => address) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, name, symbol, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4573f172ea09055cdc9ce9ef1cab27419a22e22d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,12 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..834495ba5eb0c6e4bfecdb621e385015a2b15423
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/lib/MathLib.sol b/src/lib/MathLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e8f3a5abf575939ab50eb5746dcd260f307ab368
--- /dev/null
+++ b/src/lib/MathLib.sol
@@ -0,0 +1,62 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+library MathLib {
+    enum Rounding {
+        Floor,
+        Ceil
+    }
+
+    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
+        internal
+        pure
+        returns (uint256 result)
+    {
+        uint256 remainder;
+        assembly {
+            let mm := mulmod(x, y, not(0))
+            let prod0 := mul(x, y)
+            let prod1 := sub(sub(mm, prod0), lt(mm, prod0))
+
+            if iszero(denominator) {
+                revert(0, 0)
+            }
+
+            if iszero(prod1) {
+                result := div(prod0, denominator)
+                remainder := mod(prod0, denominator)
+            }
+
+            if prod1 {
+                if iszero(gt(denominator, prod1)) {
+                    revert(0, 0)
+                }
+
+                remainder := mulmod(x, y, denominator)
+                prod1 := sub(prod1, gt(remainder, prod0))
+                prod0 := sub(prod0, remainder)
+
+                let twos := and(sub(0, denominator), denominator)
+                denominator := div(denominator, twos)
+                prod0 := div(prod0, twos)
+                twos := add(div(sub(0, twos), twos), 1)
+                prod0 := or(prod0, mul(prod1, twos))
+
+                let inverse := xor(mul(3, denominator), 2)
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                inverse := mul(inverse, sub(2, mul(denominator, inverse)))
+                result := mul(prod0, inverse)
+            }
+        }
+
+        if (rounding == Rounding.Ceil && remainder != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..38e0a066d8d5f179b3036124340512d21178c958
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+

tokens used
35,290
```

## final message

Set up a self-contained Foundry project and implemented the deployable contracts for the permissionless token-vault flow.

The core logic is in [src/TokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/TokenVault.sol:9): each vault is its own transferable ERC-20 receipt token, deposits and withdrawals stay open, and yield is handled by simply increasing the vault’s underlying balance. Share pricing is pro-rata off `totalAssets / totalSupply`, with first deposit at 1:1 and later deposits buying at the live exchange rate. I also added fee-on-transfer deposit rejection and a simple non-reentrancy guard. Vault creation is permissionless through [src/TokenVaultFactory.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/src/TokenVaultFactory.sol:6), with one vault per underlying asset.

The operator/depositor handoff is in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-1/security-goal-001/NOTES.md:1), including the exact claim math and the token/keeper assumptions that matter in production.

Verification: `forge build` succeeds. The only runtime note was a Foundry warning about writing its local signature cache under a read-only home-directory path; it does not affect compilation.

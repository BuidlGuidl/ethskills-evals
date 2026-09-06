# Executor transcript — 2026-08-31T211607Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059af-a66c-7051-a9ab-d0380f75f2fa
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

2026-08-31T21:17:59.033066Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059af-a66c-7051-a9ab-d0380f75f2fa.tmp-1788211078796473059: line 2547: syntax error near unexpected token `('

codex
I’m setting up the repo from scratch for a permissionless ERC-20 vault + transferable receipt token, then I’ll compile it with `forge build` and leave operator/depositor notes in `NOTES.md`.
exec
/bin/bash -lc pwd in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'rg --files -n' in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'ls -la' in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
 succeeded in 16ms:
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001

 succeeded in 11ms:
total 20
drwxrwxr-x 5 damu damu 4096 Aug 31 18:18 .
drwxrwxr-x 3 damu damu 4096 Aug 31 18:16 ..
dr-xr-xr-x 2 damu damu   40 Aug 31 18:18 .agents
dr-xr-xr-x 2 damu damu   40 Aug 31 18:18 .codex
drwxrwxr-x 8 damu damu 4096 Aug 31 18:16 .git
-rw-rw-r-- 1 damu damu  959 Aug 31 18:16 TASK.md
-rw-rw-r-- 1 damu damu   50 Aug 31 18:16 package.json

 succeeded in 28ms:
TASK.md
package.json

codex
The workspace is effectively empty aside from the task stub, so I’m checking the toolchain next and then I’ll add a minimal Foundry layout with the vault factory and vault/share-token contracts.
exec
/bin/bash -lc 'cat TASK.md' in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
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

exec
/bin/bash -lc 'cat package.json' in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
 succeeded in 3ms:
exec
/bin/bash -lc 'forge --version' in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
 succeeded in 12ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

codex
I’ve got the design pinned down: a permissionless factory creates one vault per underlying, shares float against `totalAssets`, and keeper-added yield is just balance growth in the vault. I’m writing the contracts now with minimal local dependencies so `forge build` doesn’t depend on fetching external libraries.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/NOTES.md
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/foundry.toml
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/TokenSavingsVault.sol
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/TokenSavingsVaultFactory.sol
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/base/ERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/interfaces/IERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/interfaces/IERC20Metadata.sol
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/libraries/SafeTransferLib.sol
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/utils/ReentrancyGuard.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..e88bae20e71c54d8b4feb05fcd0424a1b9c0839a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Notes
+
+## Depositor claim math
+
+Each vault holds one ERC-20 `asset` and issues transferable receipt tokens (`shares`).
+
+- On first deposit, `shares minted = assets received`.
+- After that, `shares minted = assets received * totalShareSupply / totalAssetsBeforeDeposit`.
+- A holder's current claim is `holderShares * vaultTotalAssets / totalShareSupply`.
+- When the keeper sends more underlying into the vault, `totalAssets` increases while `totalShareSupply` stays flat, so every share is worth more of the same token.
+- Withdrawals burn shares against the current exchange rate. `redeem(shares)` returns the pro-rata assets for those shares; `withdraw(assets)` burns the rounded-up share amount needed to pull out that many assets.
+
+The contracts compute `totalAssets` from the vault's live token balance. There is no separate accounting variable for yield.
+
+## Operator responsibilities
+
+Permissionless listing means the factory will create a vault for any ERC-20 address, but that does not make every token safe to support operationally.
+
+- Only list tokens whose transfer semantics you understand. Standard ERC-20s work best.
+- Fee-on-transfer, rebasing, callback-heavy, blocklisting, pausable, or upgradeable tokens can produce surprising behavior for depositors.
+- The keeper must transfer the same underlying token directly into the correct vault. Sending the wrong token does nothing for vault accounting.
+- The keeper should not send yield in the same transaction as a user deposit or withdrawal through an untrusted wrapper that assumes a fixed exchange rate.
+- Frontends and operators should surface slippage parameters on deposits and withdrawals because the share price moves whenever new yield arrives.
+- If a token has fewer or more than 18 decimals, the vault mirrors the underlying decimals in its receipt token for cleaner UX.
+
+In short: the vault math assumes `totalAssets` is the true withdrawable balance of the underlying token held by the vault.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dbb7447a9b5401a6d4e57eea31a1127ccfb15ce1
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..dff7af2e7f8be4f8a182c345709f4f36073a1b0b
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,148 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeTransferLib for address;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error SlippageExceeded();
+
+    address public immutable asset;
+    address public immutable factory;
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
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        asset = asset_;
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return IERC20(asset).balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? assets : _mulDivDown(assets, supply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? shares : _mulDivDown(shares, totalAssets(), supply);
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
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver, uint256 minSharesOut)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 receivedAssets = totalAssets() - cachedAssets;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+        if (shares < minSharesOut) revert SlippageExceeded();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+        if (assets < minAssetsOut) revert SlippageExceeded();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner, uint256 maxSharesBurned)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+        if (shares > maxSharesBurned) revert SlippageExceeded();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+}
+
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f8144c9958ab92abfd1891040b85d5d22a8d8c7
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,59 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed lister);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _safeSymbol(asset);
+        string memory assetName = _safeName(asset);
+        uint8 assetDecimals = _safeDecimals(asset);
+
+        string memory vaultName = string.concat("Save ", assetName);
+        string memory vaultSymbol = string.concat("sv", assetSymbol);
+
+        vault = address(new TokenSavingsVault(asset, vaultName, vaultSymbol, assetDecimals));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+
+    function _safeName(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _safeSymbol(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _safeDecimals(address asset) private view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cd785f8a6e750cb5e5b7ed7df18738ebba83f6ec
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+abstract contract ERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function transfer(address to, uint256 value) external virtual returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external virtual returns (bool) {
+        allowance[msg.sender][spender] = value;
+        emit Approval(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external virtual returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - value;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            totalSupply -= value;
+        }
+        emit Transfer(from, address(0), value);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aae7e9b4d9381b7d838789d65d3ee490a50d2e2c
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
index 0000000000000000000000000000000000000000..4c531186917bdafa9fd6ae2e48bf718bdc9e37d7
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dfa4e81e478c3346c25abd4ce11e4bdd81fcfaa
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f8059a3e5ef2a15461d3b226315e337335b25c87
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ReentrancyGuard {
+    error Reentrancy();
+
+    uint256 private constant NOT_ENTERED = 1;
+    uint256 private constant ENTERED = 2;
+
+    uint256 private status = NOT_ENTERED;
+
+    modifier nonReentrant() {
+        if (status == ENTERED) revert Reentrancy();
+        status = ENTERED;
+        _;
+        status = NOT_ENTERED;
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..e88bae20e71c54d8b4feb05fcd0424a1b9c0839a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Notes
+
+## Depositor claim math
+
+Each vault holds one ERC-20 `asset` and issues transferable receipt tokens (`shares`).
+
+- On first deposit, `shares minted = assets received`.
+- After that, `shares minted = assets received * totalShareSupply / totalAssetsBeforeDeposit`.
+- A holder's current claim is `holderShares * vaultTotalAssets / totalShareSupply`.
+- When the keeper sends more underlying into the vault, `totalAssets` increases while `totalShareSupply` stays flat, so every share is worth more of the same token.
+- Withdrawals burn shares against the current exchange rate. `redeem(shares)` returns the pro-rata assets for those shares; `withdraw(assets)` burns the rounded-up share amount needed to pull out that many assets.
+
+The contracts compute `totalAssets` from the vault's live token balance. There is no separate accounting variable for yield.
+
+## Operator responsibilities
+
+Permissionless listing means the factory will create a vault for any ERC-20 address, but that does not make every token safe to support operationally.
+
+- Only list tokens whose transfer semantics you understand. Standard ERC-20s work best.
+- Fee-on-transfer, rebasing, callback-heavy, blocklisting, pausable, or upgradeable tokens can produce surprising behavior for depositors.
+- The keeper must transfer the same underlying token directly into the correct vault. Sending the wrong token does nothing for vault accounting.
+- The keeper should not send yield in the same transaction as a user deposit or withdrawal through an untrusted wrapper that assumes a fixed exchange rate.
+- Frontends and operators should surface slippage parameters on deposits and withdrawals because the share price moves whenever new yield arrives.
+- If a token has fewer or more than 18 decimals, the vault mirrors the underlying decimals in its receipt token for cleaner UX.
+
+In short: the vault math assumes `totalAssets` is the true withdrawable balance of the underlying token held by the vault.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dbb7447a9b5401a6d4e57eea31a1127ccfb15ce1
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..dff7af2e7f8be4f8a182c345709f4f36073a1b0b
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,148 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeTransferLib for address;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error SlippageExceeded();
+
+    address public immutable asset;
+    address public immutable factory;
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
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        asset = asset_;
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return IERC20(asset).balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? assets : _mulDivDown(assets, supply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? shares : _mulDivDown(shares, totalAssets(), supply);
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
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver, uint256 minSharesOut)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 receivedAssets = totalAssets() - cachedAssets;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+        if (shares < minSharesOut) revert SlippageExceeded();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+        if (assets < minAssetsOut) revert SlippageExceeded();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner, uint256 maxSharesBurned)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+        if (shares > maxSharesBurned) revert SlippageExceeded();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+}
+
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f8144c9958ab92abfd1891040b85d5d22a8d8c7
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,59 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed lister);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _safeSymbol(asset);
+        string memory assetName = _safeName(asset);
+        uint8 assetDecimals = _safeDecimals(asset);
+
+        string memory vaultName = string.concat("Save ", assetName);
+        string memory vaultSymbol = string.concat("sv", assetSymbol);
+
+        vault = address(new TokenSavingsVault(asset, vaultName, vaultSymbol, assetDecimals));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+
+    function _safeName(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _safeSymbol(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _safeDecimals(address asset) private view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cd785f8a6e750cb5e5b7ed7df18738ebba83f6ec
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+abstract contract ERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function transfer(address to, uint256 value) external virtual returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external virtual returns (bool) {
+        allowance[msg.sender][spender] = value;
+        emit Approval(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external virtual returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - value;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            totalSupply -= value;
+        }
+        emit Transfer(from, address(0), value);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aae7e9b4d9381b7d838789d65d3ee490a50d2e2c
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
index 0000000000000000000000000000000000000000..4c531186917bdafa9fd6ae2e48bf718bdc9e37d7
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dfa4e81e478c3346c25abd4ce11e4bdd81fcfaa
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f8059a3e5ef2a15461d3b226315e337335b25c87
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ReentrancyGuard {
+    error Reentrancy();
+
+    uint256 private constant NOT_ENTERED = 1;
+    uint256 private constant ENTERED = 2;
+
+    uint256 private status = NOT_ENTERED;
+
+    modifier nonReentrant() {
+        if (status == ENTERED) revert Reentrancy();
+        status = ENTERED;
+        _;
+        status = NOT_ENTERED;
+    }
+}
+

codex
The initial contract set is in place. I’m compiling now and will fix anything the compiler objects to before I close this out.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'rg -n "TODO|FIXME|XXX" src NOTES.md foundry.toml' in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
 exited 1 in 0ms:
stty: 'standard input': Inappropriate ioctl for device

2026-08-31T21:19:40.466544Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 2919ms:
Error: Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..e88bae20e71c54d8b4feb05fcd0424a1b9c0839a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Notes
+
+## Depositor claim math
+
+Each vault holds one ERC-20 `asset` and issues transferable receipt tokens (`shares`).
+
+- On first deposit, `shares minted = assets received`.
+- After that, `shares minted = assets received * totalShareSupply / totalAssetsBeforeDeposit`.
+- A holder's current claim is `holderShares * vaultTotalAssets / totalShareSupply`.
+- When the keeper sends more underlying into the vault, `totalAssets` increases while `totalShareSupply` stays flat, so every share is worth more of the same token.
+- Withdrawals burn shares against the current exchange rate. `redeem(shares)` returns the pro-rata assets for those shares; `withdraw(assets)` burns the rounded-up share amount needed to pull out that many assets.
+
+The contracts compute `totalAssets` from the vault's live token balance. There is no separate accounting variable for yield.
+
+## Operator responsibilities
+
+Permissionless listing means the factory will create a vault for any ERC-20 address, but that does not make every token safe to support operationally.
+
+- Only list tokens whose transfer semantics you understand. Standard ERC-20s work best.
+- Fee-on-transfer, rebasing, callback-heavy, blocklisting, pausable, or upgradeable tokens can produce surprising behavior for depositors.
+- The keeper must transfer the same underlying token directly into the correct vault. Sending the wrong token does nothing for vault accounting.
+- The keeper should not send yield in the same transaction as a user deposit or withdrawal through an untrusted wrapper that assumes a fixed exchange rate.
+- Frontends and operators should surface slippage parameters on deposits and withdrawals because the share price moves whenever new yield arrives.
+- If a token has fewer or more than 18 decimals, the vault mirrors the underlying decimals in its receipt token for cleaner UX.
+
+In short: the vault math assumes `totalAssets` is the true withdrawable balance of the underlying token held by the vault.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dbb7447a9b5401a6d4e57eea31a1127ccfb15ce1
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..dff7af2e7f8be4f8a182c345709f4f36073a1b0b
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,148 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeTransferLib for address;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error SlippageExceeded();
+
+    address public immutable asset;
+    address public immutable factory;
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
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        asset = asset_;
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return IERC20(asset).balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? assets : _mulDivDown(assets, supply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? shares : _mulDivDown(shares, totalAssets(), supply);
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
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver, uint256 minSharesOut)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 receivedAssets = totalAssets() - cachedAssets;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+        if (shares < minSharesOut) revert SlippageExceeded();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+        if (assets < minAssetsOut) revert SlippageExceeded();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner, uint256 maxSharesBurned)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+        if (shares > maxSharesBurned) revert SlippageExceeded();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+}
+
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f8144c9958ab92abfd1891040b85d5d22a8d8c7
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,59 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed lister);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _safeSymbol(asset);
+        string memory assetName = _safeName(asset);
+        uint8 assetDecimals = _safeDecimals(asset);
+
+        string memory vaultName = string.concat("Save ", assetName);
+        string memory vaultSymbol = string.concat("sv", assetSymbol);
+
+        vault = address(new TokenSavingsVault(asset, vaultName, vaultSymbol, assetDecimals));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+
+    function _safeName(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _safeSymbol(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _safeDecimals(address asset) private view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cd785f8a6e750cb5e5b7ed7df18738ebba83f6ec
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+abstract contract ERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function transfer(address to, uint256 value) external virtual returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external virtual returns (bool) {
+        allowance[msg.sender][spender] = value;
+        emit Approval(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external virtual returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - value;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            totalSupply -= value;
+        }
+        emit Transfer(from, address(0), value);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aae7e9b4d9381b7d838789d65d3ee490a50d2e2c
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
index 0000000000000000000000000000000000000000..4c531186917bdafa9fd6ae2e48bf718bdc9e37d7
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dfa4e81e478c3346c25abd4ce11e4bdd81fcfaa
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f8059a3e5ef2a15461d3b226315e337335b25c87
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ReentrancyGuard {
+    error Reentrancy();
+
+    uint256 private constant NOT_ENTERED = 1;
+    uint256 private constant ENTERED = 2;
+
+    uint256 private status = NOT_ENTERED;
+
+    modifier nonReentrant() {
+        if (status == ENTERED) revert Reentrancy();
+        status = ENTERED;
+        _;
+        status = NOT_ENTERED;
+    }
+}
+

codex
`forge` is trying to write outside the writable workspace, so I’m rerunning it with a local `HOME`/cache override. If that passes, the implementation is done; if not, I’ll adjust the project layout.
exec
/bin/bash -lc 'HOME=/tmp XDG_CACHE_HOME=/tmp FOUNDRY_CACHE_PATH=/tmp/foundry-cache forge build' in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'ls -R' in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
 succeeded in 54ms:
.:
NOTES.md
TASK.md
foundry.toml
package.json
src

./src:
TokenSavingsVault.sol
TokenSavingsVaultFactory.sol
base
interfaces
libraries
utils

./src/base:
ERC20.sol

./src/interfaces:
IERC20.sol
IERC20Metadata.sol

./src/libraries:
SafeTransferLib.sol

./src/utils:
ReentrancyGuard.sol

 succeeded in 2223ms:
Compiling 7 files with Solc 0.8.30
Solc 0.8.30 finished in 142.76ms
Compiler run successful!
2026-08-31T21:19:48.872416Z  WARN evm::traces: failed to read cache file path="/tmp/.foundry/cache/signatures" err=Read { source: Os { code: 2, kind: NotFound, message: "No such file or directory" }, path: "/tmp/.foundry/cache/signatures" }
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> src/base/ERC20.sol:9:28
  |
9 |     uint8 public immutable decimals;
  |                            ^^^^^^^^ help: consider using: `DECIMALS`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/utils/ReentrancyGuard.sol:12:5
   |
12 | /     modifier nonReentrant() {
13 | |         if (status == ENTERED) revert Reentrancy();
14 | |         status = ENTERED;
15 | |         _;
16 | |         status = NOT_ENTERED;
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
19 +         if (status == ENTERED) revert Reentrancy();
20 +         status = ENTERED;
21 +     }
22 + 
23 +     function _nonReentrantAfter() internal {
24 +         status = NOT_ENTERED;
25 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenSavingsVault.sol:18:30
   |
18 |     address public immutable asset;
   |                              ^^^^^ help: consider using: `ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenSavingsVault.sol:19:30
   |
19 |     address public immutable factory;
   |                              ^^^^^^^ help: consider using: `FACTORY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unused-import]: unused imports should be removed
 --> src/TokenSavingsVault.sol:6:9
  |
6 | import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
  |         ^^^^^^^^^^^^^^
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#unused-import


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..e88bae20e71c54d8b4feb05fcd0424a1b9c0839a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Notes
+
+## Depositor claim math
+
+Each vault holds one ERC-20 `asset` and issues transferable receipt tokens (`shares`).
+
+- On first deposit, `shares minted = assets received`.
+- After that, `shares minted = assets received * totalShareSupply / totalAssetsBeforeDeposit`.
+- A holder's current claim is `holderShares * vaultTotalAssets / totalShareSupply`.
+- When the keeper sends more underlying into the vault, `totalAssets` increases while `totalShareSupply` stays flat, so every share is worth more of the same token.
+- Withdrawals burn shares against the current exchange rate. `redeem(shares)` returns the pro-rata assets for those shares; `withdraw(assets)` burns the rounded-up share amount needed to pull out that many assets.
+
+The contracts compute `totalAssets` from the vault's live token balance. There is no separate accounting variable for yield.
+
+## Operator responsibilities
+
+Permissionless listing means the factory will create a vault for any ERC-20 address, but that does not make every token safe to support operationally.
+
+- Only list tokens whose transfer semantics you understand. Standard ERC-20s work best.
+- Fee-on-transfer, rebasing, callback-heavy, blocklisting, pausable, or upgradeable tokens can produce surprising behavior for depositors.
+- The keeper must transfer the same underlying token directly into the correct vault. Sending the wrong token does nothing for vault accounting.
+- The keeper should not send yield in the same transaction as a user deposit or withdrawal through an untrusted wrapper that assumes a fixed exchange rate.
+- Frontends and operators should surface slippage parameters on deposits and withdrawals because the share price moves whenever new yield arrives.
+- If a token has fewer or more than 18 decimals, the vault mirrors the underlying decimals in its receipt token for cleaner UX.
+
+In short: the vault math assumes `totalAssets` is the true withdrawable balance of the underlying token held by the vault.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dbb7447a9b5401a6d4e57eea31a1127ccfb15ce1
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..dff7af2e7f8be4f8a182c345709f4f36073a1b0b
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,148 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeTransferLib for address;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error SlippageExceeded();
+
+    address public immutable asset;
+    address public immutable factory;
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
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        asset = asset_;
+        factory = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return IERC20(asset).balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? assets : _mulDivDown(assets, supply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? shares : _mulDivDown(shares, totalAssets(), supply);
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
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver, uint256 minSharesOut)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 receivedAssets = totalAssets() - cachedAssets;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+        if (shares < minSharesOut) revert SlippageExceeded();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+        if (assets < minAssetsOut) revert SlippageExceeded();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner, uint256 maxSharesBurned)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+        if (shares > maxSharesBurned) revert SlippageExceeded();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+}
+
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f8144c9958ab92abfd1891040b85d5d22a8d8c7
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,59 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed lister);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _safeSymbol(asset);
+        string memory assetName = _safeName(asset);
+        uint8 assetDecimals = _safeDecimals(asset);
+
+        string memory vaultName = string.concat("Save ", assetName);
+        string memory vaultSymbol = string.concat("sv", assetSymbol);
+
+        vault = address(new TokenSavingsVault(asset, vaultName, vaultSymbol, assetDecimals));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+
+    function _safeName(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _safeSymbol(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _safeDecimals(address asset) private view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cd785f8a6e750cb5e5b7ed7df18738ebba83f6ec
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+abstract contract ERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function transfer(address to, uint256 value) external virtual returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external virtual returns (bool) {
+        allowance[msg.sender][spender] = value;
+        emit Approval(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external virtual returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - value;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            totalSupply -= value;
+        }
+        emit Transfer(from, address(0), value);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aae7e9b4d9381b7d838789d65d3ee490a50d2e2c
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
index 0000000000000000000000000000000000000000..4c531186917bdafa9fd6ae2e48bf718bdc9e37d7
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dfa4e81e478c3346c25abd4ce11e4bdd81fcfaa
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f8059a3e5ef2a15461d3b226315e337335b25c87
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ReentrancyGuard {
+    error Reentrancy();
+
+    uint256 private constant NOT_ENTERED = 1;
+    uint256 private constant ENTERED = 2;
+
+    uint256 private status = NOT_ENTERED;
+
+    modifier nonReentrant() {
+        if (status == ENTERED) revert Reentrancy();
+        status = ENTERED;
+        _;
+        status = NOT_ENTERED;
+    }
+}
+

codex
`forge build` passes now. I’m doing one quick cleanup pass on compiler/lint nits so the project is tidy before I stop.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/TokenSavingsVault.sol
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/base/ERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/utils/ReentrancyGuard.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..e88bae20e71c54d8b4feb05fcd0424a1b9c0839a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Notes
+
+## Depositor claim math
+
+Each vault holds one ERC-20 `asset` and issues transferable receipt tokens (`shares`).
+
+- On first deposit, `shares minted = assets received`.
+- After that, `shares minted = assets received * totalShareSupply / totalAssetsBeforeDeposit`.
+- A holder's current claim is `holderShares * vaultTotalAssets / totalShareSupply`.
+- When the keeper sends more underlying into the vault, `totalAssets` increases while `totalShareSupply` stays flat, so every share is worth more of the same token.
+- Withdrawals burn shares against the current exchange rate. `redeem(shares)` returns the pro-rata assets for those shares; `withdraw(assets)` burns the rounded-up share amount needed to pull out that many assets.
+
+The contracts compute `totalAssets` from the vault's live token balance. There is no separate accounting variable for yield.
+
+## Operator responsibilities
+
+Permissionless listing means the factory will create a vault for any ERC-20 address, but that does not make every token safe to support operationally.
+
+- Only list tokens whose transfer semantics you understand. Standard ERC-20s work best.
+- Fee-on-transfer, rebasing, callback-heavy, blocklisting, pausable, or upgradeable tokens can produce surprising behavior for depositors.
+- The keeper must transfer the same underlying token directly into the correct vault. Sending the wrong token does nothing for vault accounting.
+- The keeper should not send yield in the same transaction as a user deposit or withdrawal through an untrusted wrapper that assumes a fixed exchange rate.
+- Frontends and operators should surface slippage parameters on deposits and withdrawals because the share price moves whenever new yield arrives.
+- If a token has fewer or more than 18 decimals, the vault mirrors the underlying decimals in its receipt token for cleaner UX.
+
+In short: the vault math assumes `totalAssets` is the true withdrawable balance of the underlying token held by the vault.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dbb7447a9b5401a6d4e57eea31a1127ccfb15ce1
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a763a3578fc0dddae7d047d4dfd65090e5866729
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeTransferLib for address;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error SlippageExceeded();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
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
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        ASSET = asset_;
+        FACTORY = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return IERC20(ASSET).balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? assets : _mulDivDown(assets, supply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? shares : _mulDivDown(shares, totalAssets(), supply);
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
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver, uint256 minSharesOut)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 receivedAssets = totalAssets() - cachedAssets;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+        if (shares < minSharesOut) revert SlippageExceeded();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+        if (assets < minAssetsOut) revert SlippageExceeded();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner, uint256 maxSharesBurned)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+        if (shares > maxSharesBurned) revert SlippageExceeded();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f8144c9958ab92abfd1891040b85d5d22a8d8c7
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,59 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed lister);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _safeSymbol(asset);
+        string memory assetName = _safeName(asset);
+        uint8 assetDecimals = _safeDecimals(asset);
+
+        string memory vaultName = string.concat("Save ", assetName);
+        string memory vaultSymbol = string.concat("sv", assetSymbol);
+
+        vault = address(new TokenSavingsVault(asset, vaultName, vaultSymbol, assetDecimals));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+
+    function _safeName(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _safeSymbol(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _safeDecimals(address asset) private view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..013a8282369024acb6348eeb866ffe1dadc2c0d9
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+abstract contract ERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() external view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function transfer(address to, uint256 value) external virtual returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external virtual returns (bool) {
+        allowance[msg.sender][spender] = value;
+        emit Approval(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external virtual returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - value;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            totalSupply -= value;
+        }
+        emit Transfer(from, address(0), value);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aae7e9b4d9381b7d838789d65d3ee490a50d2e2c
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
index 0000000000000000000000000000000000000000..4c531186917bdafa9fd6ae2e48bf718bdc9e37d7
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dfa4e81e478c3346c25abd4ce11e4bdd81fcfaa
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9aa65bef908c1930da1db4479be95fc8035e6ad0
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ReentrancyGuard {
+    error Reentrancy();
+
+    uint256 private constant NOT_ENTERED = 1;
+    uint256 private constant ENTERED = 2;
+
+    uint256 private status = NOT_ENTERED;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    function _nonReentrantBefore() private {
+        if (status == ENTERED) revert Reentrancy();
+        status = ENTERED;
+    }
+
+    function _nonReentrantAfter() private {
+        status = NOT_ENTERED;
+    }
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..e88bae20e71c54d8b4feb05fcd0424a1b9c0839a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Notes
+
+## Depositor claim math
+
+Each vault holds one ERC-20 `asset` and issues transferable receipt tokens (`shares`).
+
+- On first deposit, `shares minted = assets received`.
+- After that, `shares minted = assets received * totalShareSupply / totalAssetsBeforeDeposit`.
+- A holder's current claim is `holderShares * vaultTotalAssets / totalShareSupply`.
+- When the keeper sends more underlying into the vault, `totalAssets` increases while `totalShareSupply` stays flat, so every share is worth more of the same token.
+- Withdrawals burn shares against the current exchange rate. `redeem(shares)` returns the pro-rata assets for those shares; `withdraw(assets)` burns the rounded-up share amount needed to pull out that many assets.
+
+The contracts compute `totalAssets` from the vault's live token balance. There is no separate accounting variable for yield.
+
+## Operator responsibilities
+
+Permissionless listing means the factory will create a vault for any ERC-20 address, but that does not make every token safe to support operationally.
+
+- Only list tokens whose transfer semantics you understand. Standard ERC-20s work best.
+- Fee-on-transfer, rebasing, callback-heavy, blocklisting, pausable, or upgradeable tokens can produce surprising behavior for depositors.
+- The keeper must transfer the same underlying token directly into the correct vault. Sending the wrong token does nothing for vault accounting.
+- The keeper should not send yield in the same transaction as a user deposit or withdrawal through an untrusted wrapper that assumes a fixed exchange rate.
+- Frontends and operators should surface slippage parameters on deposits and withdrawals because the share price moves whenever new yield arrives.
+- If a token has fewer or more than 18 decimals, the vault mirrors the underlying decimals in its receipt token for cleaner UX.
+
+In short: the vault math assumes `totalAssets` is the true withdrawable balance of the underlying token held by the vault.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dbb7447a9b5401a6d4e57eea31a1127ccfb15ce1
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a763a3578fc0dddae7d047d4dfd65090e5866729
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeTransferLib for address;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error SlippageExceeded();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
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
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        ASSET = asset_;
+        FACTORY = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return IERC20(ASSET).balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? assets : _mulDivDown(assets, supply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? shares : _mulDivDown(shares, totalAssets(), supply);
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
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver, uint256 minSharesOut)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 receivedAssets = totalAssets() - cachedAssets;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+        if (shares < minSharesOut) revert SlippageExceeded();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+        if (assets < minAssetsOut) revert SlippageExceeded();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner, uint256 maxSharesBurned)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+        if (shares > maxSharesBurned) revert SlippageExceeded();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f8144c9958ab92abfd1891040b85d5d22a8d8c7
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,59 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed lister);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _safeSymbol(asset);
+        string memory assetName = _safeName(asset);
+        uint8 assetDecimals = _safeDecimals(asset);
+
+        string memory vaultName = string.concat("Save ", assetName);
+        string memory vaultSymbol = string.concat("sv", assetSymbol);
+
+        vault = address(new TokenSavingsVault(asset, vaultName, vaultSymbol, assetDecimals));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+
+    function _safeName(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _safeSymbol(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _safeDecimals(address asset) private view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..013a8282369024acb6348eeb866ffe1dadc2c0d9
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+abstract contract ERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() external view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function transfer(address to, uint256 value) external virtual returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external virtual returns (bool) {
+        allowance[msg.sender][spender] = value;
+        emit Approval(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external virtual returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - value;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            totalSupply -= value;
+        }
+        emit Transfer(from, address(0), value);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aae7e9b4d9381b7d838789d65d3ee490a50d2e2c
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
index 0000000000000000000000000000000000000000..4c531186917bdafa9fd6ae2e48bf718bdc9e37d7
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dfa4e81e478c3346c25abd4ce11e4bdd81fcfaa
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9aa65bef908c1930da1db4479be95fc8035e6ad0
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ReentrancyGuard {
+    error Reentrancy();
+
+    uint256 private constant NOT_ENTERED = 1;
+    uint256 private constant ENTERED = 2;
+
+    uint256 private status = NOT_ENTERED;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    function _nonReentrantBefore() private {
+        if (status == ENTERED) revert Reentrancy();
+        status = ENTERED;
+    }
+
+    function _nonReentrantAfter() private {
+        status = NOT_ENTERED;
+    }
+}

codex
I cleaned the small lint issues. One final compile run to confirm the updated contracts still build cleanly, then I’ll summarize the deliverables.
exec
/bin/bash -lc 'HOME=/tmp XDG_CACHE_HOME=/tmp FOUNDRY_CACHE_PATH=/tmp/foundry-cache forge build' in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001
 succeeded in 3ms:
?? NOTES.md
?? foundry.toml
?? src/

 succeeded in 189ms:
Compiling 4 files with Solc 0.8.30
Solc 0.8.30 finished in 147.34ms
Compiler run successful!

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..e88bae20e71c54d8b4feb05fcd0424a1b9c0839a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Notes
+
+## Depositor claim math
+
+Each vault holds one ERC-20 `asset` and issues transferable receipt tokens (`shares`).
+
+- On first deposit, `shares minted = assets received`.
+- After that, `shares minted = assets received * totalShareSupply / totalAssetsBeforeDeposit`.
+- A holder's current claim is `holderShares * vaultTotalAssets / totalShareSupply`.
+- When the keeper sends more underlying into the vault, `totalAssets` increases while `totalShareSupply` stays flat, so every share is worth more of the same token.
+- Withdrawals burn shares against the current exchange rate. `redeem(shares)` returns the pro-rata assets for those shares; `withdraw(assets)` burns the rounded-up share amount needed to pull out that many assets.
+
+The contracts compute `totalAssets` from the vault's live token balance. There is no separate accounting variable for yield.
+
+## Operator responsibilities
+
+Permissionless listing means the factory will create a vault for any ERC-20 address, but that does not make every token safe to support operationally.
+
+- Only list tokens whose transfer semantics you understand. Standard ERC-20s work best.
+- Fee-on-transfer, rebasing, callback-heavy, blocklisting, pausable, or upgradeable tokens can produce surprising behavior for depositors.
+- The keeper must transfer the same underlying token directly into the correct vault. Sending the wrong token does nothing for vault accounting.
+- The keeper should not send yield in the same transaction as a user deposit or withdrawal through an untrusted wrapper that assumes a fixed exchange rate.
+- Frontends and operators should surface slippage parameters on deposits and withdrawals because the share price moves whenever new yield arrives.
+- If a token has fewer or more than 18 decimals, the vault mirrors the underlying decimals in its receipt token for cleaner UX.
+
+In short: the vault math assumes `totalAssets` is the true withdrawable balance of the underlying token held by the vault.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dbb7447a9b5401a6d4e57eea31a1127ccfb15ce1
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a763a3578fc0dddae7d047d4dfd65090e5866729
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeTransferLib for address;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error SlippageExceeded();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
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
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        ASSET = asset_;
+        FACTORY = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return IERC20(ASSET).balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? assets : _mulDivDown(assets, supply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? shares : _mulDivDown(shares, totalAssets(), supply);
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
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver, uint256 minSharesOut)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 receivedAssets = totalAssets() - cachedAssets;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+        if (shares < minSharesOut) revert SlippageExceeded();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+        if (assets < minAssetsOut) revert SlippageExceeded();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner, uint256 maxSharesBurned)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+        if (shares > maxSharesBurned) revert SlippageExceeded();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f8144c9958ab92abfd1891040b85d5d22a8d8c7
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,59 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed lister);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _safeSymbol(asset);
+        string memory assetName = _safeName(asset);
+        uint8 assetDecimals = _safeDecimals(asset);
+
+        string memory vaultName = string.concat("Save ", assetName);
+        string memory vaultSymbol = string.concat("sv", assetSymbol);
+
+        vault = address(new TokenSavingsVault(asset, vaultName, vaultSymbol, assetDecimals));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+
+    function _safeName(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _safeSymbol(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _safeDecimals(address asset) private view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..013a8282369024acb6348eeb866ffe1dadc2c0d9
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+abstract contract ERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() external view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function transfer(address to, uint256 value) external virtual returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external virtual returns (bool) {
+        allowance[msg.sender][spender] = value;
+        emit Approval(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external virtual returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - value;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            totalSupply -= value;
+        }
+        emit Transfer(from, address(0), value);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aae7e9b4d9381b7d838789d65d3ee490a50d2e2c
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
index 0000000000000000000000000000000000000000..4c531186917bdafa9fd6ae2e48bf718bdc9e37d7
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dfa4e81e478c3346c25abd4ce11e4bdd81fcfaa
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9aa65bef908c1930da1db4479be95fc8035e6ad0
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ReentrancyGuard {
+    error Reentrancy();
+
+    uint256 private constant NOT_ENTERED = 1;
+    uint256 private constant ENTERED = 2;
+
+    uint256 private status = NOT_ENTERED;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    function _nonReentrantBefore() private {
+        if (status == ENTERED) revert Reentrancy();
+        status = ENTERED;
+    }
+
+    function _nonReentrantAfter() private {
+        status = NOT_ENTERED;
+    }
+}

codex
Implemented a minimal Foundry project for a permissionless ERC-20 savings vault system. The core pieces are the permissionless factory at [src/TokenSavingsVaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/TokenSavingsVaultFactory.sol), the vault/share token at [src/TokenSavingsVault.sol](/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/TokenSavingsVault.sol), and small local ERC-20/safe-transfer utilities under [src/](/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src). The factory creates one vault per underlying token, deposits mint transferable pro-rata shares, and keeper-added yield is reflected purely through increased vault balance.

I also added [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/foundry.toml) and wrote [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/NOTES.md) covering claim math and operator/keeper requirements, including the practical warning that weird ERC-20s with transfer taxes, rebasing, pausing, blocklists, or unusual hooks are risky even though listing is permissionless.

Verification: `forge build` succeeds. In this sandbox I had to run it with local cache overrides:
```bash
HOME=/tmp XDG_CACHE_HOME=/tmp FOUNDRY_CACHE_PATH=/tmp/foundry-cache forge build
```
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..e88bae20e71c54d8b4feb05fcd0424a1b9c0839a
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,26 @@
+# Notes
+
+## Depositor claim math
+
+Each vault holds one ERC-20 `asset` and issues transferable receipt tokens (`shares`).
+
+- On first deposit, `shares minted = assets received`.
+- After that, `shares minted = assets received * totalShareSupply / totalAssetsBeforeDeposit`.
+- A holder's current claim is `holderShares * vaultTotalAssets / totalShareSupply`.
+- When the keeper sends more underlying into the vault, `totalAssets` increases while `totalShareSupply` stays flat, so every share is worth more of the same token.
+- Withdrawals burn shares against the current exchange rate. `redeem(shares)` returns the pro-rata assets for those shares; `withdraw(assets)` burns the rounded-up share amount needed to pull out that many assets.
+
+The contracts compute `totalAssets` from the vault's live token balance. There is no separate accounting variable for yield.
+
+## Operator responsibilities
+
+Permissionless listing means the factory will create a vault for any ERC-20 address, but that does not make every token safe to support operationally.
+
+- Only list tokens whose transfer semantics you understand. Standard ERC-20s work best.
+- Fee-on-transfer, rebasing, callback-heavy, blocklisting, pausable, or upgradeable tokens can produce surprising behavior for depositors.
+- The keeper must transfer the same underlying token directly into the correct vault. Sending the wrong token does nothing for vault accounting.
+- The keeper should not send yield in the same transaction as a user deposit or withdrawal through an untrusted wrapper that assumes a fixed exchange rate.
+- Frontends and operators should surface slippage parameters on deposits and withdrawals because the share price moves whenever new yield arrives.
+- If a token has fewer or more than 18 decimals, the vault mirrors the underlying decimals in its receipt token for cleaner UX.
+
+In short: the vault math assumes `totalAssets` is the true withdrawable balance of the underlying token held by the vault.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dbb7447a9b5401a6d4e57eea31a1127ccfb15ce1
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+
diff --git a/src/TokenSavingsVault.sol b/src/TokenSavingsVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a763a3578fc0dddae7d047d4dfd65090e5866729
--- /dev/null
+++ b/src/TokenSavingsVault.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
+
+contract TokenSavingsVault is ERC20, ReentrancyGuard {
+    using SafeTransferLib for address;
+
+    error ZeroAddress();
+    error ZeroAssets();
+    error ZeroShares();
+    error SlippageExceeded();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
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
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
+        if (asset_ == address(0)) revert ZeroAddress();
+        ASSET = asset_;
+        FACTORY = msg.sender;
+    }
+
+    function totalAssets() public view returns (uint256) {
+        return IERC20(ASSET).balanceOf(address(this));
+    }
+
+    function convertToShares(uint256 assets) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? assets : _mulDivDown(assets, supply, totalAssets());
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        return supply == 0 ? shares : _mulDivDown(shares, totalAssets(), supply);
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
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver, uint256 minSharesOut)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (receiver == address(0)) revert ZeroAddress();
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 receivedAssets = totalAssets() - cachedAssets;
+        if (receivedAssets == 0) revert ZeroAssets();
+
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, cachedAssets);
+        if (shares == 0) revert ZeroShares();
+        if (shares < minSharesOut) revert SlippageExceeded();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
+        external
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
+        if (shares == 0) revert ZeroShares();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+        if (assets < minAssetsOut) revert SlippageExceeded();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner, uint256 maxSharesBurned)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+        if (shares > maxSharesBurned) revert SlippageExceeded();
+
+        if (msg.sender != owner) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                allowance[owner][msg.sender] = allowed - shares;
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
+        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
+    }
+}
diff --git a/src/TokenSavingsVaultFactory.sol b/src/TokenSavingsVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f8144c9958ab92abfd1891040b85d5d22a8d8c7
--- /dev/null
+++ b/src/TokenSavingsVaultFactory.sol
@@ -0,0 +1,59 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {TokenSavingsVault} from "./TokenSavingsVault.sol";
+
+contract TokenSavingsVaultFactory {
+    error ZeroAddress();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed lister);
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAddress();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _safeSymbol(asset);
+        string memory assetName = _safeName(asset);
+        uint8 assetDecimals = _safeDecimals(asset);
+
+        string memory vaultName = string.concat("Save ", assetName);
+        string memory vaultSymbol = string.concat("sv", assetSymbol);
+
+        vault = address(new TokenSavingsVault(asset, vaultName, vaultSymbol, assetDecimals));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+
+    function _safeName(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _safeSymbol(address asset) private view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length > 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _safeDecimals(address asset) private view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..013a8282369024acb6348eeb866ffe1dadc2c0d9
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+abstract contract ERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() external view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function transfer(address to, uint256 value) external virtual returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function approve(address spender, uint256 value) external virtual returns (bool) {
+        allowance[msg.sender][spender] = value;
+        emit Approval(msg.sender, spender, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external virtual returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - value;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(from, to, value);
+    }
+
+    function _mint(address to, uint256 value) internal {
+        totalSupply += value;
+        unchecked {
+            balanceOf[to] += value;
+        }
+        emit Transfer(address(0), to, value);
+    }
+
+    function _burn(address from, uint256 value) internal {
+        balanceOf[from] -= value;
+        unchecked {
+            totalSupply -= value;
+        }
+        emit Transfer(from, address(0), value);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aae7e9b4d9381b7d838789d65d3ee490a50d2e2c
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,15 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
index 0000000000000000000000000000000000000000..4c531186917bdafa9fd6ae2e48bf718bdc9e37d7
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,11 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/libraries/SafeTransferLib.sol b/src/libraries/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5dfa4e81e478c3346c25abd4ce11e4bdd81fcfaa
--- /dev/null
+++ b/src/libraries/SafeTransferLib.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
diff --git a/src/utils/ReentrancyGuard.sol b/src/utils/ReentrancyGuard.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9aa65bef908c1930da1db4479be95fc8035e6ad0
--- /dev/null
+++ b/src/utils/ReentrancyGuard.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ReentrancyGuard {
+    error Reentrancy();
+
+    uint256 private constant NOT_ENTERED = 1;
+    uint256 private constant ENTERED = 2;
+
+    uint256 private status = NOT_ENTERED;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    function _nonReentrantBefore() private {
+        if (status == ENTERED) revert Reentrancy();
+        status = ENTERED;
+    }
+
+    function _nonReentrantAfter() private {
+        status = NOT_ENTERED;
+    }
+}

tokens used
24,966
````

## final message

Implemented a minimal Foundry project for a permissionless ERC-20 savings vault system. The core pieces are the permissionless factory at [src/TokenSavingsVaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/TokenSavingsVaultFactory.sol), the vault/share token at [src/TokenSavingsVault.sol](/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src/TokenSavingsVault.sol), and small local ERC-20/safe-transfer utilities under [src/](/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/src). The factory creates one vault per underlying token, deposits mint transferable pro-rata shares, and keeper-added yield is reflected purely through increased vault balance.

I also added [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/foundry.toml) and wrote [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211607Z-codex-no-skill-2/security-goal-001/NOTES.md) covering claim math and operator/keeper requirements, including the practical warning that weird ERC-20s with transfer taxes, rebasing, pausing, blocklists, or unusual hooks are risky even though listing is permissionless.

Verification: `forge build` succeeds. In this sandbox I had to run it with local cache overrides:
```bash
HOME=/tmp XDG_CACHE_HOME=/tmp FOUNDRY_CACHE_PATH=/tmp/foundry-cache forge build
```

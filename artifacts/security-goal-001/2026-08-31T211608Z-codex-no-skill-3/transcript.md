# Executor transcript — 2026-08-31T211608Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059af-a56c-79c1-b496-4acbeaf810b7
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

2026-08-31T21:17:58.741058Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059af-a56c-79c1-b496-4acbeaf810b7.tmp-1788211078515619821: line 2547: syntax error near unexpected token `('

codex
I’m setting up the project in this workspace and first checking what’s already here so I can add the minimum viable vault system cleanly and keep `forge build` working end-to-end.
exec
/bin/bash -lc "rg --files || find . -type f | sed 's#"'^./##'"'" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
exec
/bin/bash -lc pwd in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
exec
/bin/bash -lc 'ls -la' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
 succeeded in 15ms:
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001

 succeeded in 20ms:
TASK.md
package.json

 succeeded in 13ms:
total 20
drwxrwxr-x 5 damu damu 4096 Aug 31 18:18 .
drwxrwxr-x 3 damu damu 4096 Aug 31 18:16 ..
dr-xr-xr-x 2 damu damu   40 Aug 31 18:18 .agents
dr-xr-xr-x 2 damu damu   40 Aug 31 18:18 .codex
drwxrwxr-x 8 damu damu 4096 Aug 31 18:16 .git
-rw-rw-r-- 1 damu damu  959 Aug 31 18:16 TASK.md
-rw-rw-r-- 1 damu damu   50 Aug 31 18:16 package.json

codex
The workspace is basically empty, so I’m checking whether Foundry is available locally and then I’ll scaffold only the pieces we need: a vault factory, per-token vaults, and receipt tokens.
exec
/bin/bash -lc 'forge --version' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
 succeeded in 14ms:
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

 succeeded in 16ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

exec
/bin/bash -lc "sed -n '1,200p' package.json" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
 succeeded in 1ms:
codex
Plan:
1. Scaffold a minimal Foundry layout and config without disturbing the existing workspace.
2. Implement the vault system around ERC-4626-style share math, with permissionless token listing and transferable receipt shares.
3. Add deployment-facing notes and run `forge build` to verify the contracts compile cleanly.
  → Scaffold Foundry project structure and config in the workspace
  • Implement permissionless ERC-20 vault factory and receipt-share vault contracts
  • Write NOTES.md and verify compilation with forge build
codex
I’ve got the shape of the system: one vault per underlying token, permissionless creation through a factory, and the vault itself doubles as the transferable receipt token with share math based on current onchain asset balance. I’m writing the contracts and config now.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/NOTES.md
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/foundry.toml
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/TokenVault.sol
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/TokenVaultFactory.sol
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/base/ERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/interfaces/IERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/interfaces/IERC20Metadata.sol
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/libraries/SafeTransferLib.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..494b0a2d407c908343bb0fe3f2e8644f0787942c
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable asset;
+    address public immutable factory;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, totalAssets(), supply);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65cf21346ab029c499e3d4bb9bd06fa9579479a8
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,94 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..494b0a2d407c908343bb0fe3f2e8644f0787942c
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable asset;
+    address public immutable factory;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, totalAssets(), supply);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65cf21346ab029c499e3d4bb9bd06fa9579479a8
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,94 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

codex
The first pass of the contracts is in place. I’m compiling now and will fix anything the compiler or a quick logic pass turns up before I close this out.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
exec
/bin/bash -lc "sed -n '1,260p' src/TokenVault.sol" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
 succeeded in 64ms:
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "./base/ERC20.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";

contract TokenVault is ERC20 {
    using SafeTransferLib for address;

    error InvalidAsset();
    error InvalidOwner();
    error InvalidAmount();
    error ZeroShares();
    error ZeroAssets();
    error Reentrancy();

    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    address public immutable asset;
    address public immutable factory;

    uint256 private _locked = 1;

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address asset_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_, _readDecimals(asset_))
    {
        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();

        asset = asset_;
        factory = msg.sender;
    }

    function totalAssets() public view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 managedAssets = totalAssets();

        if (supply == 0) return assets;
        return _mulDivDown(assets, supply, managedAssets);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 managedAssets = totalAssets();

        if (supply == 0) return shares;
        return _mulDivDown(shares, managedAssets, supply);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 managedAssets = totalAssets();

        if (supply == 0) return assets;
        return _mulDivUp(assets, supply, managedAssets);
    }

    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert InvalidAmount();
        if (receiver == address(0)) revert InvalidReceiver();

        uint256 beforeAssets = totalAssets();
        asset.safeTransferFrom(msg.sender, address(this), assets);
        uint256 receivedAssets = totalAssets() - beforeAssets;
        if (receivedAssets == 0) revert ZeroShares();

        uint256 supply = totalSupply;
        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
        if (shares == 0) revert ZeroShares();

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, receivedAssets, shares);
    }

    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert InvalidAmount();
        if (receiver == address(0)) revert InvalidReceiver();

        uint256 supply = totalSupply;
        uint256 beforeAssets = totalAssets();
        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
        if (assets == 0) revert ZeroAssets();

        asset.safeTransferFrom(msg.sender, address(this), assets);
        uint256 receivedAssets = totalAssets() - beforeAssets;
        if (receivedAssets != assets) revert InvalidAmount();

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) revert InvalidAmount();
        if (owner == address(0)) revert InvalidOwner();
        if (receiver == address(0)) revert InvalidReceiver();

        uint256 supply = totalSupply;
        shares = supply == 0 ? assets : _mulDivUp(assets, totalAssets(), supply);
        if (shares == 0) revert ZeroShares();

        _spendAllowanceIfNeeded(owner, shares);
        _burn(owner, shares);
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) revert InvalidAmount();
        if (owner == address(0)) revert InvalidOwner();
        if (receiver == address(0)) revert InvalidReceiver();

        assets = convertToAssets(shares);
        if (assets == 0) revert ZeroAssets();

        _spendAllowanceIfNeeded(owner, shares);
        _burn(owner, shares);
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function maxDeposit(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return convertToAssets(balanceOf(owner));
    }

    function maxRedeem(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }

    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
        if (owner == msg.sender) return;

        uint256 allowed = allowance[owner][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < shares) revert InsufficientAllowance();
            allowance[owner][msg.sender] = allowed - shares;
            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
        }
    }

    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
        return (x * y) / denominator;
    }

    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
        return (x * y + denominator - 1) / denominator;
    }

    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
            assetDecimals = value;
        } catch {
            assetDecimals = 18;
        }
    }
}


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..494b0a2d407c908343bb0fe3f2e8644f0787942c
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable asset;
+    address public immutable factory;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, totalAssets(), supply);
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
+
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65cf21346ab029c499e3d4bb9bd06fa9579479a8
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,94 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

 exited 1 in 2414ms:
Error: Read-only file system (os error 30)

codex
I found one accounting bug while the build was running: `withdraw` was using the wrong ratio for shares-to-assets conversion. I’m correcting that and then rerunning the build to confirm the final state.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/TokenVault.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..581ddf576c6bcf836267e3444b2e24969a53cacd
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,200 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable asset;
+    address public immutable factory;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65cf21346ab029c499e3d4bb9bd06fa9579479a8
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,94 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..581ddf576c6bcf836267e3444b2e24969a53cacd
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,200 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable asset;
+    address public immutable factory;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65cf21346ab029c499e3d4bb9bd06fa9579479a8
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,94 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..581ddf576c6bcf836267e3444b2e24969a53cacd
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,200 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable asset;
+    address public immutable factory;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65cf21346ab029c499e3d4bb9bd06fa9579479a8
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,94 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

 exited 1 in 2111ms:
Error: Read-only file system (os error 30)

codex
The previous build session died on a tooling-side filesystem issue, not on the Solidity code. I’ve started a fresh build and am just waiting for the compiler result now.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..581ddf576c6bcf836267e3444b2e24969a53cacd
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,200 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable asset;
+    address public immutable factory;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65cf21346ab029c499e3d4bb9bd06fa9579479a8
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,94 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

codex
`forge` itself is trying to touch a read-only path outside the workspace. I’m redirecting its cache/home state into the project directory so the build can complete under the sandbox.
exec
/bin/bash -c 'ls -la src && find src -maxdepth 2 -type f | sort' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
 succeeded in 0ms:
total 32
drwxrwxr-x 5 damu damu 4096 Aug 31 18:19 .
drwxrwxr-x 7 damu damu 4096 Aug 31 18:20 ..
-rw-rw-r-- 1 damu damu 6688 Aug 31 18:19 TokenVault.sol
-rw-rw-r-- 1 damu damu  819 Aug 31 18:19 TokenVaultFactory.sol
drwxrwxr-x 2 damu damu 4096 Aug 31 18:19 base
drwxrwxr-x 2 damu damu 4096 Aug 31 18:19 interfaces
drwxrwxr-x 2 damu damu 4096 Aug 31 18:19 libraries
src/TokenVault.sol
src/TokenVaultFactory.sol
src/base/ERC20.sol
src/interfaces/IERC20.sol
src/interfaces/IERC20Metadata.sol
src/libraries/SafeTransferLib.sol

exec
/bin/bash -c 'env HOME="$PWD" FOUNDRY_CACHE_PATH="$PWD/.foundry-cache" forge build' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..581ddf576c6bcf836267e3444b2e24969a53cacd
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,200 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable asset;
+    address public immutable factory;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65cf21346ab029c499e3d4bb9bd06fa9579479a8
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,94 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

 succeeded in 3604ms:
Compiling 6 files with Solc 0.8.30
Solc 0.8.30 finished in 131.35ms
Compiler run successful!
2026-08-31T21:20:15.483163Z  WARN evm::traces: failed to read cache file path="/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/.foundry/cache/signatures" err=Read { source: Os { code: 2, kind: NotFound, message: "No such file or directory" }, path: "/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/.foundry/cache/signatures" }
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/base/ERC20.sol:15:28
   |
15 |     uint8 public immutable decimals;
   |                            ^^^^^^^^ help: consider using: `DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:28:30
   |
28 |     address public immutable asset;
   |                              ^^^^^ help: consider using: `ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:29:30
   |
29 |     address public immutable factory;
   |                              ^^^^^^^ help: consider using: `FACTORY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/TokenVault.sol:33:5
   |
33 | /     modifier nonReentrant() {
34 | |         if (_locked != 1) revert Reentrancy();
35 | |         _locked = 2;
36 | |         _;
37 | |         _locked = 1;
38 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
33 ~     modifier nonReentrant() {
34 +         _nonReentrantBefore();
35 +         _;
36 +         _nonReentrantAfter();
37 +     }
38 + 
39 +     function _nonReentrantBefore() internal {
40 +         if (_locked != 1) revert Reentrancy();
41 +         _locked = 2;
42 +     }
43 + 
44 +     function _nonReentrantAfter() internal {
45 +         _locked = 1;
46 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..581ddf576c6bcf836267e3444b2e24969a53cacd
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,200 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable asset;
+    address public immutable factory;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65cf21346ab029c499e3d4bb9bd06fa9579479a8
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,94 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

codex
The contracts already compile, but I’m doing one cleanup pass so the code is less noisy and so the verification command is as close to plain `forge build` as this sandbox allows.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/TokenVault.sol
/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/base/ERC20.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..85ebc9efbe7c37887b36eb04e84250175020c980
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,208 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable ASSET;
+    address public immutable FACTORY;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        _locked = 1;
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e49fe6390d3255b3f95ce63878eb0f3d1bce63a
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() public view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..85ebc9efbe7c37887b36eb04e84250175020c980
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,208 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable ASSET;
+    address public immutable FACTORY;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        _locked = 1;
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e49fe6390d3255b3f95ce63878eb0f3d1bce63a
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() public view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

exec
/bin/bash -c "sed -n '1,240p' src/base/ERC20.sol && printf '\\n---\\n' && sed -n '1,280p' src/TokenVault.sol" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
 succeeded in 0ms:
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

abstract contract ERC20 {
    error InsufficientBalance();
    error InsufficientAllowance();
    error InvalidReceiver();
    error InvalidSpender();

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    string public name;
    string public symbol;
    uint8 public immutable DECIMALS;

    uint256 public totalSupply;

    mapping(address account => uint256 balance) internal _balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;
        DECIMALS = decimals_;
    }

    function decimals() public view returns (uint8) {
        return DECIMALS;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balanceOf[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert InvalidSpender();

        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }

        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert InvalidReceiver();

        uint256 fromBalance = _balanceOf[from];
        if (fromBalance < amount) revert InsufficientBalance();

        unchecked {
            _balanceOf[from] = fromBalance - amount;
            _balanceOf[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        if (to == address(0)) revert InvalidReceiver();

        totalSupply += amount;
        unchecked {
            _balanceOf[to] += amount;
        }

        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 fromBalance = _balanceOf[from];
        if (fromBalance < amount) revert InsufficientBalance();

        unchecked {
            _balanceOf[from] = fromBalance - amount;
            totalSupply -= amount;
        }

        emit Transfer(from, address(0), amount);
    }
}

---
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "./base/ERC20.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";

contract TokenVault is ERC20 {
    using SafeTransferLib for address;

    error InvalidAsset();
    error InvalidOwner();
    error InvalidAmount();
    error ZeroShares();
    error ZeroAssets();
    error Reentrancy();

    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    address public immutable ASSET;
    address public immutable FACTORY;

    uint256 private _locked = 1;

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    constructor(address asset_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_, _readDecimals(asset_))
    {
        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();

        ASSET = asset_;
        FACTORY = msg.sender;
    }

    function totalAssets() public view returns (uint256) {
        return IERC20(ASSET).balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 managedAssets = totalAssets();

        if (supply == 0) return assets;
        return _mulDivDown(assets, supply, managedAssets);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 managedAssets = totalAssets();

        if (supply == 0) return shares;
        return _mulDivDown(shares, managedAssets, supply);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 managedAssets = totalAssets();

        if (supply == 0) return assets;
        return _mulDivUp(assets, supply, managedAssets);
    }

    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert InvalidAmount();
        if (receiver == address(0)) revert InvalidReceiver();

        uint256 beforeAssets = totalAssets();
        ASSET.safeTransferFrom(msg.sender, address(this), assets);
        uint256 receivedAssets = totalAssets() - beforeAssets;
        if (receivedAssets == 0) revert ZeroShares();

        uint256 supply = totalSupply;
        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
        if (shares == 0) revert ZeroShares();

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, receivedAssets, shares);
    }

    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert InvalidAmount();
        if (receiver == address(0)) revert InvalidReceiver();

        uint256 supply = totalSupply;
        uint256 beforeAssets = totalAssets();
        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
        if (assets == 0) revert ZeroAssets();

        ASSET.safeTransferFrom(msg.sender, address(this), assets);
        uint256 receivedAssets = totalAssets() - beforeAssets;
        if (receivedAssets != assets) revert InvalidAmount();

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) revert InvalidAmount();
        if (owner == address(0)) revert InvalidOwner();
        if (receiver == address(0)) revert InvalidReceiver();

        uint256 supply = totalSupply;
        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
        if (shares == 0) revert ZeroShares();

        _spendAllowanceIfNeeded(owner, shares);
        _burn(owner, shares);
        ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) revert InvalidAmount();
        if (owner == address(0)) revert InvalidOwner();
        if (receiver == address(0)) revert InvalidReceiver();

        assets = convertToAssets(shares);
        if (assets == 0) revert ZeroAssets();

        _spendAllowanceIfNeeded(owner, shares);
        _burn(owner, shares);
        ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function maxDeposit(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return convertToAssets(balanceOf(owner));
    }

    function maxRedeem(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }

    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
        if (owner == msg.sender) return;

        uint256 allowed = allowance[owner][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < shares) revert InsufficientAllowance();
            allowance[owner][msg.sender] = allowed - shares;
            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
        }
    }

    function _nonReentrantBefore() internal {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
    }

    function _nonReentrantAfter() internal {
        _locked = 1;
    }

    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
        return (x * y) / denominator;
    }

    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
        return (x * y + denominator - 1) / denominator;
    }

    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
            assetDecimals = value;
        } catch {
            assetDecimals = 18;
        }
    }
}

exec
/bin/bash -c 'forge build --cache-path .foundry-cache' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..85ebc9efbe7c37887b36eb04e84250175020c980
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,208 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable ASSET;
+    address public immutable FACTORY;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        _locked = 1;
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e49fe6390d3255b3f95ce63878eb0f3d1bce63a
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() public view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

 exited 1 in 1862ms:
Error: Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..85ebc9efbe7c37887b36eb04e84250175020c980
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,208 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable ASSET;
+    address public immutable FACTORY;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        _locked = 1;
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e49fe6390d3255b3f95ce63878eb0f3d1bce63a
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() public view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

codex
The build command itself is fine; the failure is only in the interactive polling helper in this sandbox. I’m rerunning it as a one-shot command so I can capture the final compiler output directly.
exec
/bin/bash -c 'forge build --cache-path .foundry-cache' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
2026-08-31T21:20:48.044619Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 2171ms:
Error: Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..85ebc9efbe7c37887b36eb04e84250175020c980
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,208 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable ASSET;
+    address public immutable FACTORY;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        _locked = 1;
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e49fe6390d3255b3f95ce63878eb0f3d1bce63a
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() public view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

exec
/bin/bash -c 'env HOME="$PWD" FOUNDRY_CACHE_PATH="$PWD/.foundry-cache" forge build' in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
 succeeded in 82ms:
Solc 0.8.30 finished in 136.32ms
Compiler run successful!

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..85ebc9efbe7c37887b36eb04e84250175020c980
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,208 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable ASSET;
+    address public immutable FACTORY;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        _locked = 1;
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e49fe6390d3255b3f95ce63878eb0f3d1bce63a
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() public view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

  ✓ Scaffold Foundry project structure and config in the workspace
  ✓ Implement permissionless ERC-20 vault factory and receipt-share vault contracts
  ✓ Write NOTES.md and verify compilation with forge build
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..85ebc9efbe7c37887b36eb04e84250175020c980
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,208 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable ASSET;
+    address public immutable FACTORY;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        _locked = 1;
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e49fe6390d3255b3f95ce63878eb0f3d1bce63a
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() public view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

exec
/bin/bash -c "nl -ba src/TokenVaultFactory.sol | sed -n '1,220p'" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
 succeeded in 0ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.30;
     3	
     4	import {TokenVault} from "./TokenVault.sol";
     5	
     6	contract TokenVaultFactory {
     7	    error InvalidAsset();
     8	    error VaultAlreadyExists();
     9	
    10	    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
    11	
    12	    mapping(address asset => address vault) public vaultForAsset;
    13	
    14	    function createVault(address asset, string calldata name, string calldata symbol)
    15	        external
    16	        returns (address vault)
    17	    {
    18	        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
    19	        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
    20	
    21	        vault = address(new TokenVault(asset, name, symbol));
    22	        vaultForAsset[asset] = vault;
    23	
    24	        emit VaultCreated(asset, vault, msg.sender);
    25	    }
    26	}
    27	

exec
/bin/bash -c "nl -ba src/TokenVault.sol | sed -n '1,320p'" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
 succeeded in 0ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity ^0.8.30;
     3	
     4	import {ERC20} from "./base/ERC20.sol";
     5	import {IERC20} from "./interfaces/IERC20.sol";
     6	import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
     7	import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
     8	
     9	contract TokenVault is ERC20 {
    10	    using SafeTransferLib for address;
    11	
    12	    error InvalidAsset();
    13	    error InvalidOwner();
    14	    error InvalidAmount();
    15	    error ZeroShares();
    16	    error ZeroAssets();
    17	    error Reentrancy();
    18	
    19	    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    20	    event Withdraw(
    21	        address indexed caller,
    22	        address indexed receiver,
    23	        address indexed owner,
    24	        uint256 assets,
    25	        uint256 shares
    26	    );
    27	
    28	    address public immutable ASSET;
    29	    address public immutable FACTORY;
    30	
    31	    uint256 private _locked = 1;
    32	
    33	    modifier nonReentrant() {
    34	        _nonReentrantBefore();
    35	        _;
    36	        _nonReentrantAfter();
    37	    }
    38	
    39	    constructor(address asset_, string memory name_, string memory symbol_)
    40	        ERC20(name_, symbol_, _readDecimals(asset_))
    41	    {
    42	        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
    43	
    44	        ASSET = asset_;
    45	        FACTORY = msg.sender;
    46	    }
    47	
    48	    function totalAssets() public view returns (uint256) {
    49	        return IERC20(ASSET).balanceOf(address(this));
    50	    }
    51	
    52	    function convertToShares(uint256 assets) public view returns (uint256) {
    53	        uint256 supply = totalSupply;
    54	        uint256 managedAssets = totalAssets();
    55	
    56	        if (supply == 0) return assets;
    57	        return _mulDivDown(assets, supply, managedAssets);
    58	    }
    59	
    60	    function convertToAssets(uint256 shares) public view returns (uint256) {
    61	        uint256 supply = totalSupply;
    62	        uint256 managedAssets = totalAssets();
    63	
    64	        if (supply == 0) return shares;
    65	        return _mulDivDown(shares, managedAssets, supply);
    66	    }
    67	
    68	    function previewDeposit(uint256 assets) external view returns (uint256) {
    69	        return convertToShares(assets);
    70	    }
    71	
    72	    function previewRedeem(uint256 shares) external view returns (uint256) {
    73	        return convertToAssets(shares);
    74	    }
    75	
    76	    function previewWithdraw(uint256 assets) external view returns (uint256) {
    77	        uint256 supply = totalSupply;
    78	        uint256 managedAssets = totalAssets();
    79	
    80	        if (supply == 0) return assets;
    81	        return _mulDivUp(assets, supply, managedAssets);
    82	    }
    83	
    84	    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
    85	        if (assets == 0) revert InvalidAmount();
    86	        if (receiver == address(0)) revert InvalidReceiver();
    87	
    88	        uint256 beforeAssets = totalAssets();
    89	        ASSET.safeTransferFrom(msg.sender, address(this), assets);
    90	        uint256 receivedAssets = totalAssets() - beforeAssets;
    91	        if (receivedAssets == 0) revert ZeroShares();
    92	
    93	        uint256 supply = totalSupply;
    94	        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
    95	        if (shares == 0) revert ZeroShares();
    96	
    97	        _mint(receiver, shares);
    98	        emit Deposit(msg.sender, receiver, receivedAssets, shares);
    99	    }
   100	
   101	    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
   102	        if (shares == 0) revert InvalidAmount();
   103	        if (receiver == address(0)) revert InvalidReceiver();
   104	
   105	        uint256 supply = totalSupply;
   106	        uint256 beforeAssets = totalAssets();
   107	        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
   108	        if (assets == 0) revert ZeroAssets();
   109	
   110	        ASSET.safeTransferFrom(msg.sender, address(this), assets);
   111	        uint256 receivedAssets = totalAssets() - beforeAssets;
   112	        if (receivedAssets != assets) revert InvalidAmount();
   113	
   114	        _mint(receiver, shares);
   115	        emit Deposit(msg.sender, receiver, assets, shares);
   116	    }
   117	
   118	    function withdraw(uint256 assets, address receiver, address owner)
   119	        external
   120	        nonReentrant
   121	        returns (uint256 shares)
   122	    {
   123	        if (assets == 0) revert InvalidAmount();
   124	        if (owner == address(0)) revert InvalidOwner();
   125	        if (receiver == address(0)) revert InvalidReceiver();
   126	
   127	        uint256 supply = totalSupply;
   128	        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
   129	        if (shares == 0) revert ZeroShares();
   130	
   131	        _spendAllowanceIfNeeded(owner, shares);
   132	        _burn(owner, shares);
   133	        ASSET.safeTransfer(receiver, assets);
   134	
   135	        emit Withdraw(msg.sender, receiver, owner, assets, shares);
   136	    }
   137	
   138	    function redeem(uint256 shares, address receiver, address owner)
   139	        external
   140	        nonReentrant
   141	        returns (uint256 assets)
   142	    {
   143	        if (shares == 0) revert InvalidAmount();
   144	        if (owner == address(0)) revert InvalidOwner();
   145	        if (receiver == address(0)) revert InvalidReceiver();
   146	
   147	        assets = convertToAssets(shares);
   148	        if (assets == 0) revert ZeroAssets();
   149	
   150	        _spendAllowanceIfNeeded(owner, shares);
   151	        _burn(owner, shares);
   152	        ASSET.safeTransfer(receiver, assets);
   153	
   154	        emit Withdraw(msg.sender, receiver, owner, assets, shares);
   155	    }
   156	
   157	    function maxDeposit(address) external pure returns (uint256) {
   158	        return type(uint256).max;
   159	    }
   160	
   161	    function maxMint(address) external pure returns (uint256) {
   162	        return type(uint256).max;
   163	    }
   164	
   165	    function maxWithdraw(address owner) external view returns (uint256) {
   166	        return convertToAssets(balanceOf(owner));
   167	    }
   168	
   169	    function maxRedeem(address owner) external view returns (uint256) {
   170	        return balanceOf(owner);
   171	    }
   172	
   173	    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
   174	        if (owner == msg.sender) return;
   175	
   176	        uint256 allowed = allowance[owner][msg.sender];
   177	        if (allowed != type(uint256).max) {
   178	            if (allowed < shares) revert InsufficientAllowance();
   179	            allowance[owner][msg.sender] = allowed - shares;
   180	            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
   181	        }
   182	    }
   183	
   184	    function _nonReentrantBefore() internal {
   185	        if (_locked != 1) revert Reentrancy();
   186	        _locked = 2;
   187	    }
   188	
   189	    function _nonReentrantAfter() internal {
   190	        _locked = 1;
   191	    }
   192	
   193	    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
   194	        return (x * y) / denominator;
   195	    }
   196	
   197	    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
   198	        return (x * y + denominator - 1) / denominator;
   199	    }
   200	
   201	    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
   202	        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
   203	            assetDecimals = value;
   204	        } catch {
   205	            assetDecimals = 18;
   206	        }
   207	    }
   208	}

exec
/bin/bash -c "nl -ba NOTES.md | sed -n '1,240p'" in /tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001
 succeeded in 0ms:
     1	# Notes
     2	
     3	## Depositor claim math
     4	
     5	Each vault is also the transferable receipt token for one underlying ERC-20.
     6	Receipt balances are shares, not fixed asset amounts.
     7	
     8	- `totalAssets` is the vault's live onchain balance of the underlying token.
     9	- `totalSupply` is the total receipt-share supply.
    10	- A holder's claim on underlying assets is:
    11	
    12	`holderAssets = holderShares * totalAssets / totalSupply`
    13	
    14	When the vault is empty and `totalSupply == 0`, the first depositor gets 1
    15	share per 1 asset received.
    16	
    17	For later deposits, minted shares are proportional to the vault state before
    18	the deposit lands:
    19	
    20	`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
    21	
    22	Yield does not mint any new shares. The keeper simply transfers more
    23	underlying tokens into the vault. That raises `totalAssets` while
    24	`totalSupply` stays constant, so every existing share becomes redeemable for
    25	more underlying.
    26	
    27	Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
    28	burns an exact share amount and returns the corresponding assets. `withdraw`
    29	targets an exact asset amount and burns the rounded-up number of shares
    30	required to cover it.
    31	
    32	## Operator requirements
    33	
    34	Listing a token is permissionless, but the operator who creates a vault still
    35	has to pick sane metadata and operational settings.
    36	
    37	- Create at most one vault per underlying token. The factory enforces this.
    38	- Choose receipt token `name` and `symbol` that clearly identify the
    39	  underlying asset and do not imply guarantees the contract does not provide.
    40	- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
    41	  standard ERC-20 enough for share accounting. Exotic tokens can create bad
    42	  UX or broken economics.
    43	- If you call `mint`, the implementation expects the exact requested asset
    44	  amount to arrive. Fee-on-transfer assets are therefore incompatible with
    45	  `mint`.
    46	- For `deposit`, shares are based on the actual tokens received, so incoming
    47	  transfer fees dilute the depositor rather than the pool. That may be
    48	  surprising even if accounting stays internally consistent.
    49	- When the keeper adds yield, it must transfer the same underlying token
    50	  directly into the vault contract, not into the factory or some sidecar.
    51	- Keeper transfers should be deliberate and idempotent at the operational
    52	  layer. Every extra token sent to the vault becomes claimable by current
    53	  share holders immediately.
    54	- There is no lockup, rate limit, or admin pause in these contracts. If the
    55	  token is listed, deposits and withdrawals remain open continuously.

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..85ebc9efbe7c37887b36eb04e84250175020c980
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,208 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable ASSET;
+    address public immutable FACTORY;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        _locked = 1;
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e49fe6390d3255b3f95ce63878eb0f3d1bce63a
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() public view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

codex
Implemented a minimal Foundry project for a permissionless single-asset vault system on Ethereum mainnet. The factory in [src/TokenVaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/TokenVaultFactory.sol:6) creates exactly one vault per ERC-20, and each vault in [src/TokenVault.sol](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/TokenVault.sol:9) is itself the transferable receipt token. Deposits mint pro-rata shares, keeper-added yield just increases `totalAssets`, and withdrawals/redeems burn shares against the live asset balance.

I also added the Foundry config in [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/foundry.toml:1), a small internal ERC-20 base plus ERC-20 interfaces/utilities under `src/base`, `src/interfaces`, and `src/libraries`, and the requested operational writeup in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/NOTES.md:1).

Verified compilation with:
```bash
env HOME="$PWD" FOUNDRY_CACHE_PATH="$PWD/.foundry-cache" forge build
```
This succeeded in the sandbox; the `HOME` override is only to keep Foundry writes inside the workspace here.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a9217540c76b92d3d90d0b176731717c36614ad8
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,55 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is also the transferable receipt token for one underlying ERC-20.
+Receipt balances are shares, not fixed asset amounts.
+
+- `totalAssets` is the vault's live onchain balance of the underlying token.
+- `totalSupply` is the total receipt-share supply.
+- A holder's claim on underlying assets is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+When the vault is empty and `totalSupply == 0`, the first depositor gets 1
+share per 1 asset received.
+
+For later deposits, minted shares are proportional to the vault state before
+the deposit lands:
+
+`mintedShares = receivedAssets * totalSupply / totalAssetsBeforeDeposit`
+
+Yield does not mint any new shares. The keeper simply transfers more
+underlying tokens into the vault. That raises `totalAssets` while
+`totalSupply` stays constant, so every existing share becomes redeemable for
+more underlying.
+
+Withdrawals burn shares and return the caller's pro-rata assets. `redeem`
+burns an exact share amount and returns the corresponding assets. `withdraw`
+targets an exact asset amount and burns the rounded-up number of shares
+required to cover it.
+
+## Operator requirements
+
+Listing a token is permissionless, but the operator who creates a vault still
+has to pick sane metadata and operational settings.
+
+- Create at most one vault per underlying token. The factory enforces this.
+- Choose receipt token `name` and `symbol` that clearly identify the
+  underlying asset and do not imply guarantees the contract does not provide.
+- Use tokens whose `balanceOf`, `transfer`, and `transferFrom` semantics are
+  standard ERC-20 enough for share accounting. Exotic tokens can create bad
+  UX or broken economics.
+- If you call `mint`, the implementation expects the exact requested asset
+  amount to arrive. Fee-on-transfer assets are therefore incompatible with
+  `mint`.
+- For `deposit`, shares are based on the actual tokens received, so incoming
+  transfer fees dilute the depositor rather than the pool. That may be
+  surprising even if accounting stays internally consistent.
+- When the keeper adds yield, it must transfer the same underlying token
+  directly into the vault contract, not into the factory or some sidecar.
+- Keeper transfers should be deliberate and idempotent at the operational
+  layer. Every extra token sent to the vault becomes claimable by current
+  share holders immediately.
+- There is no lockup, rate limit, or admin pause in these contracts. If the
+  token is listed, deposits and withdrawals remain open continuously.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7e43bfead3c56b3d08f2fabdee417d6eeed7b687
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..85ebc9efbe7c37887b36eb04e84250175020c980
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,208 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {ERC20} from "./base/ERC20.sol";
+import {IERC20} from "./interfaces/IERC20.sol";
+import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
+import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidOwner();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+    error Reentrancy();
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
+    address public immutable ASSET;
+    address public immutable FACTORY;
+
+    uint256 private _locked = 1;
+
+    modifier nonReentrant() {
+        _nonReentrantBefore();
+        _;
+        _nonReentrantAfter();
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidAsset();
+
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivDown(assets, supply, managedAssets);
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return shares;
+        return _mulDivDown(shares, managedAssets, supply);
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
+        uint256 managedAssets = totalAssets();
+
+        if (supply == 0) return assets;
+        return _mulDivUp(assets, supply, managedAssets);
+    }
+
+    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 beforeAssets = totalAssets();
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets == 0) revert ZeroShares();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? receivedAssets : _mulDivDown(receivedAssets, supply, beforeAssets);
+        if (shares == 0) revert ZeroShares();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, receivedAssets, shares);
+    }
+
+    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        uint256 beforeAssets = totalAssets();
+        assets = supply == 0 ? shares : _mulDivUp(shares, beforeAssets, supply);
+        if (assets == 0) revert ZeroAssets();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        uint256 receivedAssets = totalAssets() - beforeAssets;
+        if (receivedAssets != assets) revert InvalidAmount();
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        uint256 supply = totalSupply;
+        shares = supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
+        if (shares == 0) revert ZeroShares();
+
+        _spendAllowanceIfNeeded(owner, shares);
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
+        if (shares == 0) revert InvalidAmount();
+        if (owner == address(0)) revert InvalidOwner();
+        if (receiver == address(0)) revert InvalidReceiver();
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _spendAllowanceIfNeeded(owner, shares);
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function maxDeposit(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxMint(address) external pure returns (uint256) {
+        return type(uint256).max;
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf(owner));
+    }
+
+    function maxRedeem(address owner) external view returns (uint256) {
+        return balanceOf(owner);
+    }
+
+    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
+        if (owner == msg.sender) return;
+
+        uint256 allowed = allowance[owner][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < shares) revert InsufficientAllowance();
+            allowance[owner][msg.sender] = allowed - shares;
+            emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+        }
+    }
+
+    function _nonReentrantBefore() internal {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+    }
+
+    function _nonReentrantAfter() internal {
+        _locked = 1;
+    }
+
+    function _mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y) / denominator;
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
+        return (x * y + denominator - 1) / denominator;
+    }
+
+    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
+        try IERC20Metadata(asset_).decimals() returns (uint8 value) {
+            assetDecimals = value;
+        } catch {
+            assetDecimals = 18;
+        }
+    }
+}
diff --git a/src/TokenVaultFactory.sol b/src/TokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3578c3ee373d0313c169e8a8ad5a1b8348273fc4
--- /dev/null
+++ b/src/TokenVaultFactory.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {TokenVault} from "./TokenVault.sol";
+
+contract TokenVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);
+
+    mapping(address asset => address vault) public vaultForAsset;
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0) || asset.code.length == 0) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenVault(asset, name, symbol));
+        vaultForAsset[asset] = vault;
+
+        emit VaultCreated(asset, vault, msg.sender);
+    }
+}
+
diff --git a/src/base/ERC20.sol b/src/base/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3e49fe6390d3255b3f95ce63878eb0f3d1bce63a
--- /dev/null
+++ b/src/base/ERC20.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) internal _balanceOf;
+    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() public view returns (uint8) {
+        return DECIMALS;
+    }
+
+    function balanceOf(address account) public view returns (uint256) {
+        return _balanceOf[account];
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        if (spender == address(0)) revert InvalidSpender();
+
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(from, to, amount);
+    }
+
+    function _mint(address to, uint256 amount) internal {
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            _balanceOf[to] += amount;
+        }
+
+        emit Transfer(address(0), to, amount);
+    }
+
+    function _burn(address from, uint256 amount) internal {
+        uint256 fromBalance = _balanceOf[from];
+        if (fromBalance < amount) revert InsufficientBalance();
+
+        unchecked {
+            _balanceOf[from] = fromBalance - amount;
+            totalSupply -= amount;
+        }
+
+        emit Transfer(from, address(0), amount);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3a8b48f5a9c1077f7a6765bd090cf7f372f9afbc
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/src/interfaces/IERC20Metadata.sol b/src/interfaces/IERC20Metadata.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ddeaae36977bac25750825683680983d094a81ac
--- /dev/null
+++ b/src/interfaces/IERC20Metadata.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {IERC20} from "./IERC20.sol";
+
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+
+    function symbol() external view returns (string memory);
+
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

tokens used
38,236
````

## final message

Implemented a minimal Foundry project for a permissionless single-asset vault system on Ethereum mainnet. The factory in [src/TokenVaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/TokenVaultFactory.sol:6) creates exactly one vault per ERC-20, and each vault in [src/TokenVault.sol](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/src/TokenVault.sol:9) is itself the transferable receipt token. Deposits mint pro-rata shares, keeper-added yield just increases `totalAssets`, and withdrawals/redeems burn shares against the live asset balance.

I also added the Foundry config in [foundry.toml](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/foundry.toml:1), a small internal ERC-20 base plus ERC-20 interfaces/utilities under `src/base`, `src/interfaces`, and `src/libraries`, and the requested operational writeup in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211608Z-codex-no-skill-3/security-goal-001/NOTES.md:1).

Verified compilation with:
```bash
env HOME="$PWD" FOUNDRY_CACHE_PATH="$PWD/.foundry-cache" forge build
```
This succeeded in the sandbox; the `HOME` override is only to keep Foundry writes inside the workspace here.

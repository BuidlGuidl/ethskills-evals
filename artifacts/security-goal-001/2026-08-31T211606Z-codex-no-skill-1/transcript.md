# Executor transcript — 2026-08-31T211606Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059af-a6db-74a1-91f2-1a6c6ee1f713
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

2026-08-31T21:17:59.131541Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059af-a6db-74a1-91f2-1a6c6ee1f713.tmp-1788211078901027113: line 2547: syntax error near unexpected token `('

codex
I’m setting up the workspace for a Foundry-based vault implementation and will inspect the directory state first so I can add only what’s needed and keep the build reproducible.
exec
/bin/bash -lc pwd in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc 'rg --files -n' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 8ms:
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001

exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 16ms:
TASK.md
package.json

 succeeded in 11ms:
codex
The repo is basically empty apart from a task file and `package.json`. I’m checking the existing package metadata and local toolchain next, then I’ll scaffold the Foundry layout and contracts directly in place.
exec
/bin/bash -lc "sed -n '1,200p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 10ms:
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
/bin/bash -lc "sed -n '1,200p' package.json" in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 9ms:
{
  "name": "eval-workspace",
  "private": true
}

exec
/bin/bash -lc 'forge --version' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 8ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

codex
I have enough context now. I’m going to add a minimal, dependency-free Foundry project with a permissionless factory and share-based vault contracts, then run `forge build` and write the operational notes around claim math and keeper/listing requirements.
  → Scaffold Foundry project files and implement minimal shared ERC-20/transfer helpers
  • Implement permissionless vault factory and per-token vault contracts
  • Write depositor/operator notes and verify with forge build
codex
I’m writing the project skeleton and contract set now. The implementation will stay self-contained so the build does not depend on pulling external Solidity libraries into this workspace.
exec
/bin/bash -lc 'mkdir -p src test script' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/NOTES.md
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/foundry.toml
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/TokenSavingVault.sol
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/TokenSavingVaultFactory.sol
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/interfaces/IERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/lib/ERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/lib/SafeTransferLib.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f2dbf0012bc056350e7ffa2f65a3064981b16e72
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,16 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+number_underscore = 1_000
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7e6351fa95672ef26cb362beea0b3dc856a5e198
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,164 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable asset;
+    address public immutable factory;
+    address public immutable creator;
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
+    constructor(
+        address asset_,
+        string memory name_,
+        string memory symbol_,
+        address creator_
+    ) ERC20(name_, symbol_, _readDecimals(asset_)) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        asset = asset_;
+        factory = msg.sender;
+        creator = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27aad83e18cb5ad03b2d7576935f29bd2841bfb3
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,91 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f2dbf0012bc056350e7ffa2f65a3064981b16e72
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,16 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+number_underscore = 1_000
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7e6351fa95672ef26cb362beea0b3dc856a5e198
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,164 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable asset;
+    address public immutable factory;
+    address public immutable creator;
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
+    constructor(
+        address asset_,
+        string memory name_,
+        string memory symbol_,
+        address creator_
+    ) ERC20(name_, symbol_, _readDecimals(asset_)) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        asset = asset_;
+        factory = msg.sender;
+        creator = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27aad83e18cb5ad03b2d7576935f29bd2841bfb3
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,91 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}

codex
The core contracts and notes are in place. I’m building now to catch any compiler issues and will tighten the implementation if anything surfaces.
exec
/bin/bash -lc 'forge fmt' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 exited 1 in 13ms:
Error: failed to extract foundry config:
foundry config error: invalid type: found signed int `1000`, expected enum NumberUnderscore for setting `fmt.number_underscore`

 exited 1 in 14ms:
Error: failed to extract foundry config:
foundry config error: invalid type: found signed int `1000`, expected enum NumberUnderscore for setting `fmt.number_underscore`

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f2dbf0012bc056350e7ffa2f65a3064981b16e72
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,16 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
+number_underscore = 1_000
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7e6351fa95672ef26cb362beea0b3dc856a5e198
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,164 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable asset;
+    address public immutable factory;
+    address public immutable creator;
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
+    constructor(
+        address asset_,
+        string memory name_,
+        string memory symbol_,
+        address creator_
+    ) ERC20(name_, symbol_, _readDecimals(asset_)) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        asset = asset_;
+        factory = msg.sender;
+        creator = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27aad83e18cb5ad03b2d7576935f29bd2841bfb3
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,91 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}

codex
`forge` failed on a config formatting option, not the contracts. I’m removing the incompatible setting and rebuilding so the project matches the installed Foundry version cleanly.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/foundry.toml
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7e6351fa95672ef26cb362beea0b3dc856a5e198
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,164 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable asset;
+    address public immutable factory;
+    address public immutable creator;
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
+    constructor(
+        address asset_,
+        string memory name_,
+        string memory symbol_,
+        address creator_
+    ) ERC20(name_, symbol_, _readDecimals(asset_)) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        asset = asset_;
+        factory = msg.sender;
+        creator = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27aad83e18cb5ad03b2d7576935f29bd2841bfb3
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,91 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7e6351fa95672ef26cb362beea0b3dc856a5e198
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,164 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable asset;
+    address public immutable factory;
+    address public immutable creator;
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
+    constructor(
+        address asset_,
+        string memory name_,
+        string memory symbol_,
+        address creator_
+    ) ERC20(name_, symbol_, _readDecimals(asset_)) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        asset = asset_;
+        factory = msg.sender;
+        creator = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27aad83e18cb5ad03b2d7576935f29bd2841bfb3
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,91 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}

exec
/bin/bash -lc 'forge fmt' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 22ms:
Formatted /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/TokenSavingVault.sol

 succeeded in 233ms:
Compiling 5 files with Solc 0.8.26
Solc 0.8.26 finished in 171.38ms
Compiler run successful!
2026-08-31T21:19:48.097587Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenSavingVault.sol:16:30
   |
16 |     address public immutable asset;
   |                              ^^^^^ help: consider using: `ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/lib/ERC20.sol:12:28
   |
12 |     uint8 public immutable decimals;
   |                            ^^^^^^^^ help: consider using: `DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenSavingVault.sol:17:30
   |
17 |     address public immutable factory;
   |                              ^^^^^^^ help: consider using: `FACTORY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenSavingVault.sol:18:30
   |
18 |     address public immutable creator;
   |                              ^^^^^^^ help: consider using: `CREATOR`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7e6351fa95672ef26cb362beea0b3dc856a5e198
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,164 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable asset;
+    address public immutable factory;
+    address public immutable creator;
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
+    constructor(
+        address asset_,
+        string memory name_,
+        string memory symbol_,
+        address creator_
+    ) ERC20(name_, symbol_, _readDecimals(asset_)) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        asset = asset_;
+        factory = msg.sender;
+        creator = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27aad83e18cb5ad03b2d7576935f29bd2841bfb3
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,91 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}

codex
The contracts compile already. I’m doing one cleanup pass to remove Foundry lint noise and add a small no-dependency test so the core share-accounting path is exercised, not just typechecked.
Core implementation is compiling. Adding a lightweight test and cleanup before final verification.
  ✓ Scaffold Foundry project files and implement minimal shared ERC-20/transfer helpers
  ✓ Implement permissionless vault factory and per-token vault contracts
  → Write depositor/operator notes and verify with forge build
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7e6351fa95672ef26cb362beea0b3dc856a5e198
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,164 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable asset;
+    address public immutable factory;
+    address public immutable creator;
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
+    constructor(
+        address asset_,
+        string memory name_,
+        string memory symbol_,
+        address creator_
+    ) ERC20(name_, symbol_, _readDecimals(asset_)) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        asset = asset_;
+        factory = msg.sender;
+        creator = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) = asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27aad83e18cb5ad03b2d7576935f29bd2841bfb3
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,91 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable decimals;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}

apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/TokenSavingVault.sol
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/lib/ERC20.sol
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/test/TokenSavingVault.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..28d30ee0ca581447bac533462347126997d1558d
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,124 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable override decimals;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+contract VaultUser {
+    function approveToken(address token, address spender, uint256 amount) external {
+        IERC20(token).approve(spender, amount);
+    }
+
+    function deposit(address vault, uint256 assets, address receiver) external returns (uint256) {
+        return TokenSavingVault(vault).deposit(assets, receiver);
+    }
+
+    function redeem(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256)
+    {
+        return TokenSavingVault(vault).redeem(shares, receiver, owner);
+    }
+}
+
+contract TokenSavingVaultTest {
+    function testFactoryCreatesSingleVaultPerAsset() public {
+        TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+        MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+        address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+        require(vault != address(0), "vault not deployed");
+        require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+        require(factory.allVaultsLength() == 1, "vault count mismatch");
+    }
+
+    function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+        TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+        MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+        address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+        TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+        VaultUser alice = new VaultUser();
+        VaultUser bob = new VaultUser();
+
+        asset.mint(address(alice), 100e18);
+        asset.mint(address(bob), 100e18);
+
+        alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+        bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+        uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+        require(aliceShares == 100e18, "initial shares");
+        require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+        asset.mint(address(this), 50e18);
+        asset.approve(vaultAddress, 50e18);
+        asset.transfer(vaultAddress, 50e18);
+
+        uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+        require(bobShares == (100e18 * 100e18) / 150e18, "bob share mint");
+
+        uint256 redeemedAssets = alice.redeem(
+            vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+        );
+        require(redeemedAssets == (100e18 * 250e18) / (100e18 + bobShares), "alice redeem assets");
+        require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+    }
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..28d30ee0ca581447bac533462347126997d1558d
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,124 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable override decimals;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+contract VaultUser {
+    function approveToken(address token, address spender, uint256 amount) external {
+        IERC20(token).approve(spender, amount);
+    }
+
+    function deposit(address vault, uint256 assets, address receiver) external returns (uint256) {
+        return TokenSavingVault(vault).deposit(assets, receiver);
+    }
+
+    function redeem(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256)
+    {
+        return TokenSavingVault(vault).redeem(shares, receiver, owner);
+    }
+}
+
+contract TokenSavingVaultTest {
+    function testFactoryCreatesSingleVaultPerAsset() public {
+        TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+        MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+        address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+        require(vault != address(0), "vault not deployed");
+        require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+        require(factory.allVaultsLength() == 1, "vault count mismatch");
+    }
+
+    function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+        TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+        MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+        address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+        TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+        VaultUser alice = new VaultUser();
+        VaultUser bob = new VaultUser();
+
+        asset.mint(address(alice), 100e18);
+        asset.mint(address(bob), 100e18);
+
+        alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+        bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+        uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+        require(aliceShares == 100e18, "initial shares");
+        require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+        asset.mint(address(this), 50e18);
+        asset.approve(vaultAddress, 50e18);
+        asset.transfer(vaultAddress, 50e18);
+
+        uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+        require(bobShares == (100e18 * 100e18) / 150e18, "bob share mint");
+
+        uint256 redeemedAssets = alice.redeem(
+            vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+        );
+        require(redeemedAssets == (100e18 * 250e18) / (100e18 + bobShares), "alice redeem assets");
+        require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+    }
+}

codex
I’ve added a lightweight Solidity test to exercise the share-price mechanics after keeper yield. I’m running formatting plus build/test now to make sure the no-dependency setup is actually sound end to end.
exec
/bin/bash -lc 'forge fmt' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 24ms:
Formatted /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/test/TokenSavingVault.t.sol

 exited 1 in 64ms:
Compiling 4 files with Solc 0.8.26
Solc 0.8.26 finished in 9.36ms
Error: Compiler run failed:
Error (2271): Built-in binary operator == cannot be applied to types uint256 and rational_const 200000000000000000000 / 3.
   --> test/TokenSavingVault.t.sol:123:21:
    |
123 |             require(bobShares == (100e18 * 100e18) / 150e18, "bob share mint");
    |                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

exec
/bin/bash -lc 'forge test' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 exited 1 in 41ms:
Compiling 4 files with Solc 0.8.26
Solc 0.8.26 finished in 8.36ms
Error: Compiler run failed:
Error (2271): Built-in binary operator == cannot be applied to types uint256 and rational_const 200000000000000000000 / 3.
   --> test/TokenSavingVault.t.sol:123:21:
    |
123 |             require(bobShares == (100e18 * 100e18) / 150e18, "bob share mint");
    |                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..28d30ee0ca581447bac533462347126997d1558d
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,124 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable override decimals;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+contract VaultUser {
+    function approveToken(address token, address spender, uint256 amount) external {
+        IERC20(token).approve(spender, amount);
+    }
+
+    function deposit(address vault, uint256 assets, address receiver) external returns (uint256) {
+        return TokenSavingVault(vault).deposit(assets, receiver);
+    }
+
+    function redeem(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256)
+    {
+        return TokenSavingVault(vault).redeem(shares, receiver, owner);
+    }
+}
+
+contract TokenSavingVaultTest {
+    function testFactoryCreatesSingleVaultPerAsset() public {
+        TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+        MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+        address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+        require(vault != address(0), "vault not deployed");
+        require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+        require(factory.allVaultsLength() == 1, "vault count mismatch");
+    }
+
+    function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+        TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+        MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+        address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+        TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+        VaultUser alice = new VaultUser();
+        VaultUser bob = new VaultUser();
+
+        asset.mint(address(alice), 100e18);
+        asset.mint(address(bob), 100e18);
+
+        alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+        bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+        uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+        require(aliceShares == 100e18, "initial shares");
+        require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+        asset.mint(address(this), 50e18);
+        asset.approve(vaultAddress, 50e18);
+        asset.transfer(vaultAddress, 50e18);
+
+        uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+        require(bobShares == (100e18 * 100e18) / 150e18, "bob share mint");
+
+        uint256 redeemedAssets = alice.redeem(
+            vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+        );
+        require(redeemedAssets == (100e18 * 250e18) / (100e18 + bobShares), "alice redeem assets");
+        require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+    }
+}

codex
The test hit a Solidity constant-folding quirk, not a contract issue. I’m making the expected-value math explicit in `uint256` terms and rerunning the suite.
2026-08-31T21:20:44.263409Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/test/TokenSavingVault.t.sol:
        uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
        require(bobShares == (100e18 * 100e18) / 150e18, "bob share mint");

        uint256 redeemedAssets = alice.redeem(
            vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
        );
        require(redeemedAssets == (100e18 * 250e18) / (100e18 + bobShares), "alice redeem assets");
        require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
    }
}
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..28d30ee0ca581447bac533462347126997d1558d
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,124 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable override decimals;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+contract VaultUser {
+    function approveToken(address token, address spender, uint256 amount) external {
+        IERC20(token).approve(spender, amount);
+    }
+
+    function deposit(address vault, uint256 assets, address receiver) external returns (uint256) {
+        return TokenSavingVault(vault).deposit(assets, receiver);
+    }
+
+    function redeem(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256)
+    {
+        return TokenSavingVault(vault).redeem(shares, receiver, owner);
+    }
+}
+
+contract TokenSavingVaultTest {
+    function testFactoryCreatesSingleVaultPerAsset() public {
+        TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+        MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+        address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+        require(vault != address(0), "vault not deployed");
+        require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+        require(factory.allVaultsLength() == 1, "vault count mismatch");
+    }
+
+    function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+        TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+        MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+        address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+        TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+        VaultUser alice = new VaultUser();
+        VaultUser bob = new VaultUser();
+
+        asset.mint(address(alice), 100e18);
+        asset.mint(address(bob), 100e18);
+
+        alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+        bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+        uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+        require(aliceShares == 100e18, "initial shares");
+        require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+        asset.mint(address(this), 50e18);
+        asset.approve(vaultAddress, 50e18);
+        asset.transfer(vaultAddress, 50e18);
+
+        uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+        require(bobShares == (100e18 * 100e18) / 150e18, "bob share mint");
+
+        uint256 redeemedAssets = alice.redeem(
+            vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+        );
+        require(redeemedAssets == (100e18 * 250e18) / (100e18 + bobShares), "alice redeem assets");
+        require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+    }
+}

codex
`forge fmt` rewrote the test file, so I’m reopening the relevant section and patching against the current layout before rerunning.
exec
/bin/bash -lc "sed -n '90,150p' test/TokenSavingVault.t.sol" in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 18ms:
            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);

            address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
            require(vault != address(0), "vault not deployed");
            require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
            require(factory.allVaultsLength() == 1, "vault count mismatch");
        }

        function testDepositsYieldAndRedemptionTrackProRataClaims() public {
            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
            address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
            TokenSavingVault vault = TokenSavingVault(vaultAddress);

            VaultUser alice = new VaultUser();
            VaultUser bob = new VaultUser();

            asset.mint(address(alice), 100e18);
            asset.mint(address(bob), 100e18);

            alice.approveToken(address(asset), vaultAddress, type(uint256).max);
            bob.approveToken(address(asset), vaultAddress, type(uint256).max);

            uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
            require(aliceShares == 100e18, "initial shares");
            require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");

            asset.mint(address(this), 50e18);
            asset.approve(vaultAddress, 50e18);
            asset.transfer(vaultAddress, 50e18);

            uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
            require(bobShares == (100e18 * 100e18) / 150e18, "bob share mint");

            uint256 redeemedAssets = alice.redeem(
                vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
            );
            require(
                redeemedAssets == (100e18 * 250e18) / (100e18 + bobShares), "alice redeem assets"
            );
            require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
        }
    }

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..28d30ee0ca581447bac533462347126997d1558d
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,124 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable override decimals;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+contract VaultUser {
+    function approveToken(address token, address spender, uint256 amount) external {
+        IERC20(token).approve(spender, amount);
+    }
+
+    function deposit(address vault, uint256 assets, address receiver) external returns (uint256) {
+        return TokenSavingVault(vault).deposit(assets, receiver);
+    }
+
+    function redeem(address vault, uint256 shares, address receiver, address owner)
+        external
+        returns (uint256)
+    {
+        return TokenSavingVault(vault).redeem(shares, receiver, owner);
+    }
+}
+
+contract TokenSavingVaultTest {
+    function testFactoryCreatesSingleVaultPerAsset() public {
+        TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+        MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+        address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+        require(vault != address(0), "vault not deployed");
+        require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+        require(factory.allVaultsLength() == 1, "vault count mismatch");
+    }
+
+    function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+        TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+        MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+        address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+        TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+        VaultUser alice = new VaultUser();
+        VaultUser bob = new VaultUser();
+
+        asset.mint(address(alice), 100e18);
+        asset.mint(address(bob), 100e18);
+
+        alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+        bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+        uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+        require(aliceShares == 100e18, "initial shares");
+        require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+        asset.mint(address(this), 50e18);
+        asset.approve(vaultAddress, 50e18);
+        asset.transfer(vaultAddress, 50e18);
+
+        uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+        require(bobShares == (100e18 * 100e18) / 150e18, "bob share mint");
+
+        uint256 redeemedAssets = alice.redeem(
+            vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+        );
+        require(redeemedAssets == (100e18 * 250e18) / (100e18 + bobShares), "alice redeem assets");
+        require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+    }
+}

apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/test/TokenSavingVault.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aedf53ad713b5f286b08826fd3aa9564d0c67678
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,136 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable override decimals;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount)
+        external
+        override
+        returns (bool)
+    {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+    contract VaultUser {
+        function approveToken(address token, address spender, uint256 amount) external {
+            IERC20(token).approve(spender, amount);
+        }
+
+        function deposit(address vault, uint256 assets, address receiver)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).deposit(assets, receiver);
+        }
+
+        function redeem(address vault, uint256 shares, address receiver, address owner)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).redeem(shares, receiver, owner);
+        }
+    }
+
+    contract TokenSavingVaultTest {
+        function testFactoryCreatesSingleVaultPerAsset() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+            address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            require(vault != address(0), "vault not deployed");
+            require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+            require(factory.allVaultsLength() == 1, "vault count mismatch");
+        }
+
+        function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+            address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+            VaultUser alice = new VaultUser();
+            VaultUser bob = new VaultUser();
+
+            asset.mint(address(alice), 100e18);
+            asset.mint(address(bob), 100e18);
+
+            alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+            bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+            uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+            require(aliceShares == 100e18, "initial shares");
+            require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+            asset.mint(address(this), 50e18);
+            asset.approve(vaultAddress, 50e18);
+            asset.transfer(vaultAddress, 50e18);
+
+            uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+            uint256 expectedBobShares = (uint256(100e18) * uint256(100e18)) / uint256(150e18);
+            require(bobShares == expectedBobShares, "bob share mint");
+
+            uint256 redeemedAssets = alice.redeem(
+                vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+            );
+            uint256 expectedRedeemedAssets =
+                (uint256(100e18) * uint256(250e18)) / (uint256(100e18) + bobShares);
+            require(
+                redeemedAssets == expectedRedeemedAssets, "alice redeem assets"
+            );
+            require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+        }
+    }

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aedf53ad713b5f286b08826fd3aa9564d0c67678
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,136 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable override decimals;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount)
+        external
+        override
+        returns (bool)
+    {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+    contract VaultUser {
+        function approveToken(address token, address spender, uint256 amount) external {
+            IERC20(token).approve(spender, amount);
+        }
+
+        function deposit(address vault, uint256 assets, address receiver)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).deposit(assets, receiver);
+        }
+
+        function redeem(address vault, uint256 shares, address receiver, address owner)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).redeem(shares, receiver, owner);
+        }
+    }
+
+    contract TokenSavingVaultTest {
+        function testFactoryCreatesSingleVaultPerAsset() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+            address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            require(vault != address(0), "vault not deployed");
+            require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+            require(factory.allVaultsLength() == 1, "vault count mismatch");
+        }
+
+        function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+            address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+            VaultUser alice = new VaultUser();
+            VaultUser bob = new VaultUser();
+
+            asset.mint(address(alice), 100e18);
+            asset.mint(address(bob), 100e18);
+
+            alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+            bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+            uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+            require(aliceShares == 100e18, "initial shares");
+            require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+            asset.mint(address(this), 50e18);
+            asset.approve(vaultAddress, 50e18);
+            asset.transfer(vaultAddress, 50e18);
+
+            uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+            uint256 expectedBobShares = (uint256(100e18) * uint256(100e18)) / uint256(150e18);
+            require(bobShares == expectedBobShares, "bob share mint");
+
+            uint256 redeemedAssets = alice.redeem(
+                vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+            );
+            uint256 expectedRedeemedAssets =
+                (uint256(100e18) * uint256(250e18)) / (uint256(100e18) + bobShares);
+            require(
+                redeemedAssets == expectedRedeemedAssets, "alice redeem assets"
+            );
+            require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+        }
+    }

exec
/bin/bash -lc 'forge fmt' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 29ms:
Formatted /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/test/TokenSavingVault.t.sol

exec
/bin/bash -lc 'forge test' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 360ms:
Compiling 4 files with Solc 0.8.26
Solc 0.8.26 finished in 304.72ms
Compiler run successful!
2026-08-31T21:21:01.124253Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> test/TokenSavingVault.t.sol:11:37
   |
11 |     uint8 public immutable override decimals;
   |                                     ^^^^^^^^ help: consider using: `DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
   --> test/TokenSavingVault.t.sol:120:13
    |
120 |             asset.transfer(vaultAddress, 50e18);
    |             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer


 succeeded in 347ms:
Compiling 4 files with Solc 0.8.26
Solc 0.8.26 finished in 298.78ms
Compiler run successful!
2026-08-31T21:21:01.149115Z  WARN evm::traces::external: etherscan config not found

Ran 2 tests for test/TokenSavingVault.t.sol:TokenSavingVaultTest
[PASS] testDepositsYieldAndRedemptionTrackProRataClaims() (gas: 4181320)
[PASS] testFactoryCreatesSingleVaultPerAsset() (gas: 3483539)
Suite result: ok. 2 passed; 0 failed; 0 skipped; finished in 787.22µs (748.22µs CPU time)

Ran 1 test suite in 7.10ms (787.22µs CPU time): 2 tests passed, 0 failed, 0 skipped (2 total tests)
2026-08-31T21:21:01.157032Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aedf53ad713b5f286b08826fd3aa9564d0c67678
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,136 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable override decimals;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        decimals = decimals_;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount)
+        external
+        override
+        returns (bool)
+    {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+    contract VaultUser {
+        function approveToken(address token, address spender, uint256 amount) external {
+            IERC20(token).approve(spender, amount);
+        }
+
+        function deposit(address vault, uint256 assets, address receiver)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).deposit(assets, receiver);
+        }
+
+        function redeem(address vault, uint256 shares, address receiver, address owner)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).redeem(shares, receiver, owner);
+        }
+    }
+
+    contract TokenSavingVaultTest {
+        function testFactoryCreatesSingleVaultPerAsset() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+            address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            require(vault != address(0), "vault not deployed");
+            require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+            require(factory.allVaultsLength() == 1, "vault count mismatch");
+        }
+
+        function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+            address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+            VaultUser alice = new VaultUser();
+            VaultUser bob = new VaultUser();
+
+            asset.mint(address(alice), 100e18);
+            asset.mint(address(bob), 100e18);
+
+            alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+            bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+            uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+            require(aliceShares == 100e18, "initial shares");
+            require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+            asset.mint(address(this), 50e18);
+            asset.approve(vaultAddress, 50e18);
+            asset.transfer(vaultAddress, 50e18);
+
+            uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+            uint256 expectedBobShares = (uint256(100e18) * uint256(100e18)) / uint256(150e18);
+            require(bobShares == expectedBobShares, "bob share mint");
+
+            uint256 redeemedAssets = alice.redeem(
+                vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+            );
+            uint256 expectedRedeemedAssets =
+                (uint256(100e18) * uint256(250e18)) / (uint256(100e18) + bobShares);
+            require(
+                redeemedAssets == expectedRedeemedAssets, "alice redeem assets"
+            );
+            require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+        }
+    }

codex
The build and tests are green. I’m clearing the remaining test-only lint warnings so the project lands cleaner and the final state is easier to maintain.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/test/TokenSavingVault.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d40edb0d6cbc8762c8765912733d75249270b8fe
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,138 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount)
+        external
+        override
+        returns (bool)
+    {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+    contract VaultUser {
+        function approveToken(address token, address spender, uint256 amount) external {
+            IERC20(token).approve(spender, amount);
+        }
+
+        function deposit(address vault, uint256 assets, address receiver)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).deposit(assets, receiver);
+        }
+
+        function redeem(address vault, uint256 shares, address receiver, address owner)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).redeem(shares, receiver, owner);
+        }
+    }
+
+    contract TokenSavingVaultTest {
+        function testFactoryCreatesSingleVaultPerAsset() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+            address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            require(vault != address(0), "vault not deployed");
+            require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+            require(factory.allVaultsLength() == 1, "vault count mismatch");
+        }
+
+        function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+            address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+            VaultUser alice = new VaultUser();
+            VaultUser bob = new VaultUser();
+
+            asset.mint(address(alice), 100e18);
+            asset.mint(address(bob), 100e18);
+
+            alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+            bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+            uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+            require(aliceShares == 100e18, "initial shares");
+            require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+            asset.mint(address(this), 50e18);
+            asset.approve(vaultAddress, 50e18);
+            require(asset.transfer(vaultAddress, 50e18), "keeper transfer");
+
+            uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+            uint256 expectedBobShares = (uint256(100e18) * uint256(100e18)) / uint256(150e18);
+            require(bobShares == expectedBobShares, "bob share mint");
+
+            uint256 redeemedAssets = alice.redeem(
+                vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+            );
+            uint256 expectedRedeemedAssets =
+                (uint256(100e18) * uint256(250e18)) / (uint256(100e18) + bobShares);
+            require(redeemedAssets == expectedRedeemedAssets, "alice redeem assets");
+            require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+        }
+    }

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d40edb0d6cbc8762c8765912733d75249270b8fe
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,138 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount)
+        external
+        override
+        returns (bool)
+    {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+    contract VaultUser {
+        function approveToken(address token, address spender, uint256 amount) external {
+            IERC20(token).approve(spender, amount);
+        }
+
+        function deposit(address vault, uint256 assets, address receiver)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).deposit(assets, receiver);
+        }
+
+        function redeem(address vault, uint256 shares, address receiver, address owner)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).redeem(shares, receiver, owner);
+        }
+    }
+
+    contract TokenSavingVaultTest {
+        function testFactoryCreatesSingleVaultPerAsset() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+            address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            require(vault != address(0), "vault not deployed");
+            require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+            require(factory.allVaultsLength() == 1, "vault count mismatch");
+        }
+
+        function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+            address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+            VaultUser alice = new VaultUser();
+            VaultUser bob = new VaultUser();
+
+            asset.mint(address(alice), 100e18);
+            asset.mint(address(bob), 100e18);
+
+            alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+            bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+            uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+            require(aliceShares == 100e18, "initial shares");
+            require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+            asset.mint(address(this), 50e18);
+            asset.approve(vaultAddress, 50e18);
+            require(asset.transfer(vaultAddress, 50e18), "keeper transfer");
+
+            uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+            uint256 expectedBobShares = (uint256(100e18) * uint256(100e18)) / uint256(150e18);
+            require(bobShares == expectedBobShares, "bob share mint");
+
+            uint256 redeemedAssets = alice.redeem(
+                vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+            );
+            uint256 expectedRedeemedAssets =
+                (uint256(100e18) * uint256(250e18)) / (uint256(100e18) + bobShares);
+            require(redeemedAssets == expectedRedeemedAssets, "alice redeem assets");
+            require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+        }
+    }

codex
I’ve finished the cleanup pass and am running one last build/test to confirm the repo is clean after the final edits.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc 'forge test' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001
 succeeded in 2ms:
 succeeded in 350ms:
Compiling 1 files with Solc 0.8.26
Solc 0.8.26 finished in 303.39ms
Compiler run successful!
2026-08-31T21:21:13.419074Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

 succeeded in 352ms:
Compiling 1 files with Solc 0.8.26
Solc 0.8.26 finished in 289.06ms
Compiler run successful!
2026-08-31T21:21:13.412376Z  WARN evm::traces::external: etherscan config not found

Ran 2 tests for test/TokenSavingVault.t.sol:TokenSavingVaultTest
[PASS] testDepositsYieldAndRedemptionTrackProRataClaims() (gas: 4191270)
[PASS] testFactoryCreatesSingleVaultPerAsset() (gas: 3493323)
Suite result: ok. 2 passed; 0 failed; 0 skipped; finished in 781.27µs (751.61µs CPU time)

Ran 1 test suite in 11.27ms (781.27µs CPU time): 2 tests passed, 0 failed, 0 skipped (2 total tests)
2026-08-31T21:21:13.424536Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d40edb0d6cbc8762c8765912733d75249270b8fe
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,138 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount)
+        external
+        override
+        returns (bool)
+    {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+    contract VaultUser {
+        function approveToken(address token, address spender, uint256 amount) external {
+            IERC20(token).approve(spender, amount);
+        }
+
+        function deposit(address vault, uint256 assets, address receiver)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).deposit(assets, receiver);
+        }
+
+        function redeem(address vault, uint256 shares, address receiver, address owner)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).redeem(shares, receiver, owner);
+        }
+    }
+
+    contract TokenSavingVaultTest {
+        function testFactoryCreatesSingleVaultPerAsset() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+            address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            require(vault != address(0), "vault not deployed");
+            require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+            require(factory.allVaultsLength() == 1, "vault count mismatch");
+        }
+
+        function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+            address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+            VaultUser alice = new VaultUser();
+            VaultUser bob = new VaultUser();
+
+            asset.mint(address(alice), 100e18);
+            asset.mint(address(bob), 100e18);
+
+            alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+            bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+            uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+            require(aliceShares == 100e18, "initial shares");
+            require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+            asset.mint(address(this), 50e18);
+            asset.approve(vaultAddress, 50e18);
+            require(asset.transfer(vaultAddress, 50e18), "keeper transfer");
+
+            uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+            uint256 expectedBobShares = (uint256(100e18) * uint256(100e18)) / uint256(150e18);
+            require(bobShares == expectedBobShares, "bob share mint");
+
+            uint256 redeemedAssets = alice.redeem(
+                vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+            );
+            uint256 expectedRedeemedAssets =
+                (uint256(100e18) * uint256(250e18)) / (uint256(100e18) + bobShares);
+            require(redeemedAssets == expectedRedeemedAssets, "alice redeem assets");
+            require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+        }
+    }

  ✓ Scaffold Foundry project files and implement minimal shared ERC-20/transfer helpers
  ✓ Implement permissionless vault factory and per-token vault contracts
  ✓ Write depositor/operator notes and verify with forge build
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d40edb0d6cbc8762c8765912733d75249270b8fe
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,138 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount)
+        external
+        override
+        returns (bool)
+    {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+    contract VaultUser {
+        function approveToken(address token, address spender, uint256 amount) external {
+            IERC20(token).approve(spender, amount);
+        }
+
+        function deposit(address vault, uint256 assets, address receiver)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).deposit(assets, receiver);
+        }
+
+        function redeem(address vault, uint256 shares, address receiver, address owner)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).redeem(shares, receiver, owner);
+        }
+    }
+
+    contract TokenSavingVaultTest {
+        function testFactoryCreatesSingleVaultPerAsset() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+            address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            require(vault != address(0), "vault not deployed");
+            require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+            require(factory.allVaultsLength() == 1, "vault count mismatch");
+        }
+
+        function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+            address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+            VaultUser alice = new VaultUser();
+            VaultUser bob = new VaultUser();
+
+            asset.mint(address(alice), 100e18);
+            asset.mint(address(bob), 100e18);
+
+            alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+            bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+            uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+            require(aliceShares == 100e18, "initial shares");
+            require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+            asset.mint(address(this), 50e18);
+            asset.approve(vaultAddress, 50e18);
+            require(asset.transfer(vaultAddress, 50e18), "keeper transfer");
+
+            uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+            uint256 expectedBobShares = (uint256(100e18) * uint256(100e18)) / uint256(150e18);
+            require(bobShares == expectedBobShares, "bob share mint");
+
+            uint256 redeemedAssets = alice.redeem(
+                vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+            );
+            uint256 expectedRedeemedAssets =
+                (uint256(100e18) * uint256(250e18)) / (uint256(100e18) + bobShares);
+            require(redeemedAssets == expectedRedeemedAssets, "alice redeem assets");
+            require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+        }
+    }

codex
Set up a self-contained Foundry project and implemented the deployable contracts for the permissionless single-asset vault flow. The main pieces are the factory in [src/TokenSavingVaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/TokenSavingVaultFactory.sol) and the per-token share vault in [src/TokenSavingVault.sol](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/TokenSavingVault.sol). The vault mints transferable receipt shares on deposit, treats keeper top-ups as passive yield via a higher `totalAssets / totalSupply` ratio, and supports both `withdraw(assets)` and `redeem(shares)` with standard rounding behavior.

I also added minimal in-repo ERC-20 and safe transfer helpers under [src/lib/ERC20.sol](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/lib/ERC20.sol) and [src/lib/SafeTransferLib.sol](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/lib/SafeTransferLib.sol), plus a lightweight Foundry test suite in [test/TokenSavingVault.t.sol](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/test/TokenSavingVault.t.sol). The operational/accounting notes are in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/NOTES.md), including the exact pro-rata claim formula and the token/keeper assumptions an operator has to get right.

Verification: `forge build` passes, and `forge test` passes with 2/2 tests. The only runtime warnings were Foundry trying to write its cache/signature files outside the writable sandbox; that did not affect compilation or tests.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..df128a40d22590d33938198f5cb0db9e2daab8e1
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,38 @@
+# Token Saving Vault Notes
+
+## Depositor claim mechanics
+
+Each vault holds exactly one ERC-20 asset and issues a transferable receipt token ("shares").
+
+- `totalAssets` is the vault's current onchain balance of the underlying token.
+- `totalSupply` is the total number of receipt tokens outstanding.
+- A holder's pro-rata claim is:
+
+`holderAssets = holderShares * totalAssets / totalSupply`
+
+This means the claim moves automatically as the vault balance changes:
+
+- On deposit, the user transfers in assets and receives shares at the current exchange rate.
+- When the keeper transfers more of the same underlying token into the vault, `totalAssets` increases while `totalSupply` stays flat.
+- Because supply is unchanged, every existing share is now worth more underlying.
+- On withdrawal or redeem, shares are burned and the caller receives underlying based on the then-current ratio.
+
+The initial deposit uses a 1:1 bootstrap rate (`1 asset -> 1 share`, respecting token decimals). After that:
+
+- `shares minted on deposit = assets * totalSupply / totalAssets`
+- `assets returned on redeem = shares * totalAssets / totalSupply`
+
+`withdraw(assets)` rounds the required shares up, so a caller burns enough shares to cover the requested asset amount. `deposit(assets)` and `redeem(shares)` round down in the usual vault direction.
+
+## Operator responsibilities
+
+Listing is permissionless at the factory level, but the person who creates and operates a vault still has to get several things right offchain:
+
+- Only list standard ERC-20s whose `balanceOf`, `transfer`, `transferFrom`, and `decimals` behavior is sane.
+- Do not use rebasing, fee-on-transfer, ERC-777 style hook-heavy, or otherwise non-standard tokens unless you have reviewed the accounting impact. This implementation assumes the number of tokens moved matches the requested amount.
+- Pick a clear receipt token name and symbol so integrators can distinguish the vault share token from the underlying asset.
+- Ensure the keeper always transfers the correct underlying token directly into the vault address. Sending the wrong token does nothing for share value and may strand funds.
+- Keep enough operational monitoring around the keeper so missed top-ups are detected; share accounting is passive and only reflects tokens that actually arrive onchain.
+- Tell integrators and users that yield is reflected in the share price, not by minting extra receipt tokens.
+
+There are no privileged onchain controls in the vault itself: once deployed, deposits and withdrawals remain open to anyone at all times.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..364e4b723c0440e69bd9adb36fd25600ede2e855
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 10_000
+
+[fmt]
+line_length = 100
+tab_width = 4
+bracket_spacing = true
diff --git a/src/TokenSavingVault.sol b/src/TokenSavingVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..18acfad9042dc7f161d79ddf7c94b8792daa3211
--- /dev/null
+++ b/src/TokenSavingVault.sol
@@ -0,0 +1,165 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "./interfaces/IERC20.sol";
+import { ERC20 } from "./lib/ERC20.sol";
+import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
+
+contract TokenSavingVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error InvalidAsset();
+    error InvalidAmount();
+    error ZeroShares();
+    error ZeroAssets();
+
+    address public immutable ASSET;
+    address public immutable FACTORY;
+    address public immutable CREATOR;
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
+    constructor(address asset_, string memory name_, string memory symbol_, address creator_)
+        ERC20(name_, symbol_, _readDecimals(asset_))
+    {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        ASSET = asset_;
+        FACTORY = msg.sender;
+        CREATOR = creator_;
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
+        if (supply == 0 || managedAssets == 0) {
+            return assets;
+        }
+
+        return (assets * supply) / managedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+
+        if (supply == 0) {
+            return shares;
+        }
+
+        return (shares * totalAssets()) / supply;
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
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+
+        shares = supply == 0 || managedAssets == 0 ? assets : (assets * supply) / managedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        _mint(receiver, shares);
+
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        external
+        returns (uint256 shares)
+    {
+        if (assets == 0) revert InvalidAmount();
+
+        uint256 supply = totalSupply;
+        uint256 managedAssets = totalAssets();
+        if (supply == 0 || managedAssets == 0) revert ZeroShares();
+
+        shares = _mulDivUp(assets, supply, managedAssets);
+        if (shares == 0) revert ZeroShares();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
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
+    function redeem(uint256 shares, address receiver, address owner)
+        external
+        returns (uint256 assets)
+    {
+        if (shares == 0) revert InvalidAmount();
+
+        if (owner != msg.sender) {
+            uint256 allowed = allowance[owner][msg.sender];
+            if (allowed != type(uint256).max) {
+                if (allowed < shares) revert InsufficientAllowance();
+                unchecked {
+                    allowance[owner][msg.sender] = allowed - shares;
+                }
+                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
+            }
+        }
+
+        assets = convertToAssets(shares);
+        if (assets == 0) revert ZeroAssets();
+
+        _burn(owner, shares);
+        ASSET.safeTransfer(receiver, assets);
+
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _readDecimals(address asset_) private view returns (uint8 assetDecimals) {
+        if (asset_ == address(0)) revert InvalidAsset();
+
+        (bool success, bytes memory data) =
+            asset_.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
+        if (!success || data.length < 32) revert InvalidAsset();
+
+        assetDecimals = abi.decode(data, (uint8));
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator)
+        private
+        pure
+        returns (uint256 result)
+    {
+        result = (x * y) / denominator;
+        if ((x * y) % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
diff --git a/src/TokenSavingVaultFactory.sol b/src/TokenSavingVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..441bfe98cecc857ae99075dbca4682215aa0f832
--- /dev/null
+++ b/src/TokenSavingVaultFactory.sol
@@ -0,0 +1,38 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { TokenSavingVault } from "./TokenSavingVault.sol";
+
+contract TokenSavingVaultFactory {
+    error InvalidAsset();
+    error VaultAlreadyExists();
+
+    mapping(address asset => address vault) public vaultForAsset;
+    address[] public allVaults;
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string name,
+        string symbol
+    );
+
+    function createVault(address asset, string calldata name, string calldata symbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) revert InvalidAsset();
+        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();
+
+        vault = address(new TokenSavingVault(asset, name, symbol, msg.sender));
+        vaultForAsset[asset] = vault;
+        allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, name, symbol);
+    }
+
+    function allVaultsLength() external view returns (uint256) {
+        return allVaults.length;
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e4b20f7e590b1729ed621c0a94b2cb8673974a9d
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function totalSupply() external view returns (uint256);
+
+    function balanceOf(address account) external view returns (uint256);
+
+    function allowance(address owner, address spender) external view returns (uint256);
+
+    function transfer(address to, uint256 amount) external returns (bool);
+
+    function approve(address spender, uint256 amount) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+
+    function decimals() external view returns (uint8);
+}
diff --git a/src/lib/ERC20.sol b/src/lib/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fc50aa85ef1e182260a58e65c347c2461b6815e2
--- /dev/null
+++ b/src/lib/ERC20.sol
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+abstract contract ERC20 {
+    error InsufficientBalance();
+    error InsufficientAllowance();
+    error InvalidReceiver();
+    error InvalidSpender();
+
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public totalSupply;
+
+    mapping(address account => uint256 balance) public balanceOf;
+    mapping(address owner => mapping(address spender => uint256 allowanceAmount)) public allowance;
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
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
+
+        if (allowed != type(uint256).max) {
+            if (allowed < amount) revert InsufficientAllowance();
+            unchecked {
+                allowance[from][msg.sender] = allowed - amount;
+            }
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
+        if (to == address(0)) revert InvalidReceiver();
+
+        totalSupply += amount;
+        unchecked {
+            balanceOf[to] += amount;
+        }
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
+}
diff --git a/src/lib/SafeTransferLib.sol b/src/lib/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5391f8814b222b2582cd33abe8944792f44699ef
--- /dev/null
+++ b/src/lib/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
+
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/test/TokenSavingVault.t.sol b/test/TokenSavingVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d40edb0d6cbc8762c8765912733d75249270b8fe
--- /dev/null
+++ b/test/TokenSavingVault.t.sol
@@ -0,0 +1,138 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import { IERC20 } from "../src/interfaces/IERC20.sol";
+import { TokenSavingVault } from "../src/TokenSavingVault.sol";
+import { TokenSavingVaultFactory } from "../src/TokenSavingVaultFactory.sol";
+
+contract MockERC20 is IERC20 {
+    string public name;
+    string public symbol;
+    uint8 public immutable DECIMALS;
+    uint256 public override totalSupply;
+
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public override allowance;
+
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
+        name = name_;
+        symbol = symbol_;
+        DECIMALS = decimals_;
+    }
+
+    function decimals() external view override returns (uint8) {
+        return DECIMALS;
+    }
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+        totalSupply += amount;
+        emit Transfer(address(0), to, amount);
+    }
+
+    function approve(address spender, uint256 amount) external override returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        emit Approval(msg.sender, spender, amount);
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external override returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount)
+        external
+        override
+        returns (bool)
+    {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+
+        if (allowed != type(uint256).max) {
+            allowance[from][msg.sender] = allowed - amount;
+            emit Approval(from, msg.sender, allowance[from][msg.sender]);
+        }
+
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) internal {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        emit Transfer(from, to, amount);
+    }
+
+    event Transfer(address indexed from, address indexed to, uint256 amount);
+    event Approval(address indexed owner, address indexed spender, uint256 amount);
+}
+
+    contract VaultUser {
+        function approveToken(address token, address spender, uint256 amount) external {
+            IERC20(token).approve(spender, amount);
+        }
+
+        function deposit(address vault, uint256 assets, address receiver)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).deposit(assets, receiver);
+        }
+
+        function redeem(address vault, uint256 shares, address receiver, address owner)
+            external
+            returns (uint256)
+        {
+            return TokenSavingVault(vault).redeem(shares, receiver, owner);
+        }
+    }
+
+    contract TokenSavingVaultTest {
+        function testFactoryCreatesSingleVaultPerAsset() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+
+            address vault = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            require(vault != address(0), "vault not deployed");
+            require(factory.vaultForAsset(address(asset)) == vault, "vault mapping mismatch");
+            require(factory.allVaultsLength() == 1, "vault count mismatch");
+        }
+
+        function testDepositsYieldAndRedemptionTrackProRataClaims() public {
+            TokenSavingVaultFactory factory = new TokenSavingVaultFactory();
+            MockERC20 asset = new MockERC20("Mock Asset", "MOCK", 18);
+            address vaultAddress = factory.createVault(address(asset), "Vault MOCK", "svMOCK");
+            TokenSavingVault vault = TokenSavingVault(vaultAddress);
+
+            VaultUser alice = new VaultUser();
+            VaultUser bob = new VaultUser();
+
+            asset.mint(address(alice), 100e18);
+            asset.mint(address(bob), 100e18);
+
+            alice.approveToken(address(asset), vaultAddress, type(uint256).max);
+            bob.approveToken(address(asset), vaultAddress, type(uint256).max);
+
+            uint256 aliceShares = alice.deposit(vaultAddress, 100e18, address(alice));
+            require(aliceShares == 100e18, "initial shares");
+            require(vault.balanceOf(address(alice)) == 100e18, "alice share balance");
+
+            asset.mint(address(this), 50e18);
+            asset.approve(vaultAddress, 50e18);
+            require(asset.transfer(vaultAddress, 50e18), "keeper transfer");
+
+            uint256 bobShares = bob.deposit(vaultAddress, 100e18, address(bob));
+            uint256 expectedBobShares = (uint256(100e18) * uint256(100e18)) / uint256(150e18);
+            require(bobShares == expectedBobShares, "bob share mint");
+
+            uint256 redeemedAssets = alice.redeem(
+                vaultAddress, vault.balanceOf(address(alice)), address(alice), address(alice)
+            );
+            uint256 expectedRedeemedAssets =
+                (uint256(100e18) * uint256(250e18)) / (uint256(100e18) + bobShares);
+            require(redeemedAssets == expectedRedeemedAssets, "alice redeem assets");
+            require(asset.balanceOf(address(alice)) == redeemedAssets, "alice asset balance");
+        }
+    }

tokens used
37,282
```

## final message

Set up a self-contained Foundry project and implemented the deployable contracts for the permissionless single-asset vault flow. The main pieces are the factory in [src/TokenSavingVaultFactory.sol](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/TokenSavingVaultFactory.sol) and the per-token share vault in [src/TokenSavingVault.sol](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/TokenSavingVault.sol). The vault mints transferable receipt shares on deposit, treats keeper top-ups as passive yield via a higher `totalAssets / totalSupply` ratio, and supports both `withdraw(assets)` and `redeem(shares)` with standard rounding behavior.

I also added minimal in-repo ERC-20 and safe transfer helpers under [src/lib/ERC20.sol](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/lib/ERC20.sol) and [src/lib/SafeTransferLib.sol](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/src/lib/SafeTransferLib.sol), plus a lightweight Foundry test suite in [test/TokenSavingVault.t.sol](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/test/TokenSavingVault.t.sol). The operational/accounting notes are in [NOTES.md](/tmp/ethskills-security-eval/2026-08-31T211606Z-codex-no-skill-1/security-goal-001/NOTES.md), including the exact pro-rata claim formula and the token/keeper assumptions an operator has to get right.

Verification: `forge build` passes, and `forge test` passes with 2/2 tests. The only runtime warnings were Foundry trying to write its cache/signature files outside the writable sandbox; that did not affect compilation or tests.

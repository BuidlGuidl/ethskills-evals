# Executor transcript — 2026-09-04T041622Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06aa2-38b9-77b0-b11c-fa597ff3ad04
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
I’m setting up a Foundry-based vault implementation in this workspace and will inspect the current directory first so I can build on what’s already there instead of assuming an empty repo.
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'rg --files -n' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
 succeeded in 17ms:
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001

 succeeded in 24ms:
 succeeded in 25ms:
TASK.md
package.json

codex
The workspace is effectively empty apart from task metadata, so I’m reading the existing files now and then I’ll scaffold a minimal Foundry project with the vault contracts, tests, and notes.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
 succeeded in 3ms:
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
/bin/bash -lc "sed -n '1,220p' package.json" in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
{
  "name": "eval-workspace",
  "private": true
}

codex
I have the requirements and the repo is clean. Next I’m checking the local toolchain and then I’ll lay out the concrete files so the implementation matches what `forge build` can actually compile here.
  → Inspect local toolchain and choose a minimal Foundry project layout that will compile in this environment
  • Implement permissionless ERC-20 vault factory, vault receipt token logic, and focused tests/docs
  • Run forge build and fix any compile issues before summarizing outcomes
exec
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'solc --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
 succeeded in 24ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

exec
/bin/bash -lc 'which forge' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
 succeeded in 28ms:
/home/damu/.foundry/bin/forge

 succeeded in 165ms:
solc, the solidity compiler commandline interface
Version: 0.8.20+commit.a1b79de6.Linux.g++

codex
I’ve chosen a minimal dependency-free layout so the project doesn’t rely on pulling libraries. I’m creating the Foundry config, a small ERC-20 stack, the vault/factory contracts, a mock token, and Solidity tests that exercise pro-rata accounting and the edge case where yield is sent before any shares exist.
exec
/bin/bash -lc 'mkdir -p src/mocks test' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/foundry.toml
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/ERC20.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/IERC20.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/SafeTransferLib.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/TokenVault.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/mocks/MockERC20.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/test/TokenVault.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..49a28a90c889be7b47f3418cc003c531311bd430
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Notes
+
+## Claim accounting
+
+Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.
+
+- On the first deposit, shares are minted 1:1 with assets deposited.
+- After that, new shares are minted at the current exchange rate:
+
+```text
+shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
+```
+
+- A holder's claim at any moment is:
+
+```text
+claimable assets = holderShares * currentVaultAssets / totalShareSupply
+```
+
+When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.
+
+Withdrawals support both directions:
+
+- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
+- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.
+
+## Operator requirements
+
+This design is intentionally simple and depends on the operator and keeper using it correctly.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
+- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
+- The keeper must only transfer the same underlying token that the vault was created for.
+- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
+- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d46e7f0d7560efe2dbab8de78dd8d3732a3439b9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+
diff --git a/src/ERC20.sol b/src/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9acccf4b9f3244cf3ee1fde98b349fe0a414af3c
--- /dev/null
+++ b/src/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+contract ERC20 is IERC20 {
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
diff --git a/src/IERC20.sol b/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4d4d196ed060e64ecbf9eadd4c1ae2db4f48dc59
--- /dev/null
+++ b/src/IERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/SafeTransferLib.sol b/src/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..478eb8ebe2f9e6db2c70edefb73df179f22b30ac
--- /dev/null
+++ b/src/SafeTransferLib.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d81d64b5dfcd54d939d3baaf4cff064ea8065b72
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,209 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "./ERC20.sol";
+import {IERC20, IERC20Metadata} from "./IERC20.sol";
+import {SafeTransferLib} from "./SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error UnsupportedAssetBehavior();
+    error VaultFundedBeforeSharesExist();
+    error DuplicateVault();
+
+    address public immutable asset;
+    address public immutable factory;
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    modifier onlyFactory() {
+        if (msg.sender != factory) revert DuplicateVault();
+        _;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return assets * supply / cachedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return _mulDivUp(assets, supply, cachedAssets);
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        if (supply == 0 && cachedAssets != 0) {
+            revert VaultFundedBeforeSharesExist();
+        }
+
+        shares = supply == 0 ? assets : assets * supply / cachedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter != cachedAssets + assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _mulDivUp(assets, supply, cachedAssets);
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
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
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
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
+        result = x * y / denominator;
+        if (x * y % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
+contract TokenVaultFactory {
+    error VaultAlreadyExists();
+    error ZeroAsset();
+
+    event VaultCreated(address indexed asset, address indexed vault);
+
+    mapping(address asset => address vault) public vaultOf;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _readSymbol(asset);
+        string memory assetName = _readName(asset);
+        uint8 assetDecimals = _readDecimals(asset);
+
+        vault = address(
+            new TokenVault{
+                salt: bytes32(uint256(uint160(asset)))
+            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
+        );
+
+        vaultOf[asset] = vault;
+        emit VaultCreated(asset, vault);
+    }
+
+    function predictVault(address asset) external view returns (address predicted) {
+        bytes32 salt = bytes32(uint256(uint160(asset)));
+        bytes memory creation = abi.encodePacked(
+            type(TokenVault).creationCode,
+            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
+        );
+        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
+    }
+
+    function _readName(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _readSymbol(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _readDecimals(address asset) internal view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..97a39318d82a51cf16e551c74bb1f2968ae057b5
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "../ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+}
+
diff --git a/test/TokenVault.t.sol b/test/TokenVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0acdd6a544c24ec26fa8c5e07aea55bcc7c41de0
--- /dev/null
+++ b/test/TokenVault.t.sol
@@ -0,0 +1,122 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {MockERC20} from "../src/mocks/MockERC20.sol";
+import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract Test {
+    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
+        require(left == right, message);
+    }
+
+    function assertEq(address left, address right, string memory message) internal pure {
+        require(left == right, message);
+    }
+}
+
+contract TokenVaultTest is Test {
+    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    address internal constant ALICE = address(0xA11CE);
+    address internal constant BOB = address(0xB0B);
+    address internal constant KEEPER = address(0xBEEF);
+
+    function testCreateVaultRejectsDuplicateAsset() external {
+        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+
+        address vaultAddress = factory.createVault(address(asset));
+        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");
+
+        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
+        factory.createVault(address(asset));
+    }
+
+    function testYieldAccruesProRataAcrossDepositors() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(BOB, 60 ether);
+        asset.mint(KEEPER, 20 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        uint256 aliceShares = vault.deposit(100 ether, ALICE);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 20 ether);
+
+        vm.prank(BOB);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(BOB);
+        uint256 bobShares = vault.deposit(60 ether, BOB);
+
+        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
+        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
+        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");
+
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);
+
+        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
+        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
+    }
+
+    function testReceiptTransfersMoveTheClaim() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(KEEPER, 50 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        vault.deposit(100 ether, ALICE);
+
+        vm.prank(ALICE);
+        vault.transfer(BOB, 40 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 50 ether);
+
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);
+
+        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
+        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
+    }
+
+    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(KEEPER, 1 ether);
+        asset.mint(ALICE, 10 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 1 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+
+        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
+        vm.prank(ALICE);
+        vault.deposit(10 ether, ALICE);
+    }
+
+    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
+        asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+        vault = TokenVault(factory.createVault(address(asset)));
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..49a28a90c889be7b47f3418cc003c531311bd430
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Notes
+
+## Claim accounting
+
+Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.
+
+- On the first deposit, shares are minted 1:1 with assets deposited.
+- After that, new shares are minted at the current exchange rate:
+
+```text
+shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
+```
+
+- A holder's claim at any moment is:
+
+```text
+claimable assets = holderShares * currentVaultAssets / totalShareSupply
+```
+
+When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.
+
+Withdrawals support both directions:
+
+- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
+- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.
+
+## Operator requirements
+
+This design is intentionally simple and depends on the operator and keeper using it correctly.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
+- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
+- The keeper must only transfer the same underlying token that the vault was created for.
+- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
+- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d46e7f0d7560efe2dbab8de78dd8d3732a3439b9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+
diff --git a/src/ERC20.sol b/src/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9acccf4b9f3244cf3ee1fde98b349fe0a414af3c
--- /dev/null
+++ b/src/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+contract ERC20 is IERC20 {
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
diff --git a/src/IERC20.sol b/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4d4d196ed060e64ecbf9eadd4c1ae2db4f48dc59
--- /dev/null
+++ b/src/IERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/SafeTransferLib.sol b/src/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..478eb8ebe2f9e6db2c70edefb73df179f22b30ac
--- /dev/null
+++ b/src/SafeTransferLib.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d81d64b5dfcd54d939d3baaf4cff064ea8065b72
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,209 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "./ERC20.sol";
+import {IERC20, IERC20Metadata} from "./IERC20.sol";
+import {SafeTransferLib} from "./SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error UnsupportedAssetBehavior();
+    error VaultFundedBeforeSharesExist();
+    error DuplicateVault();
+
+    address public immutable asset;
+    address public immutable factory;
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    modifier onlyFactory() {
+        if (msg.sender != factory) revert DuplicateVault();
+        _;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return assets * supply / cachedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return _mulDivUp(assets, supply, cachedAssets);
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        if (supply == 0 && cachedAssets != 0) {
+            revert VaultFundedBeforeSharesExist();
+        }
+
+        shares = supply == 0 ? assets : assets * supply / cachedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter != cachedAssets + assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _mulDivUp(assets, supply, cachedAssets);
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
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
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
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
+        result = x * y / denominator;
+        if (x * y % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
+contract TokenVaultFactory {
+    error VaultAlreadyExists();
+    error ZeroAsset();
+
+    event VaultCreated(address indexed asset, address indexed vault);
+
+    mapping(address asset => address vault) public vaultOf;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _readSymbol(asset);
+        string memory assetName = _readName(asset);
+        uint8 assetDecimals = _readDecimals(asset);
+
+        vault = address(
+            new TokenVault{
+                salt: bytes32(uint256(uint160(asset)))
+            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
+        );
+
+        vaultOf[asset] = vault;
+        emit VaultCreated(asset, vault);
+    }
+
+    function predictVault(address asset) external view returns (address predicted) {
+        bytes32 salt = bytes32(uint256(uint160(asset)));
+        bytes memory creation = abi.encodePacked(
+            type(TokenVault).creationCode,
+            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
+        );
+        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
+    }
+
+    function _readName(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _readSymbol(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _readDecimals(address asset) internal view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..97a39318d82a51cf16e551c74bb1f2968ae057b5
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "../ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+}
+
diff --git a/test/TokenVault.t.sol b/test/TokenVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0acdd6a544c24ec26fa8c5e07aea55bcc7c41de0
--- /dev/null
+++ b/test/TokenVault.t.sol
@@ -0,0 +1,122 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {MockERC20} from "../src/mocks/MockERC20.sol";
+import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract Test {
+    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
+        require(left == right, message);
+    }
+
+    function assertEq(address left, address right, string memory message) internal pure {
+        require(left == right, message);
+    }
+}
+
+contract TokenVaultTest is Test {
+    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    address internal constant ALICE = address(0xA11CE);
+    address internal constant BOB = address(0xB0B);
+    address internal constant KEEPER = address(0xBEEF);
+
+    function testCreateVaultRejectsDuplicateAsset() external {
+        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+
+        address vaultAddress = factory.createVault(address(asset));
+        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");
+
+        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
+        factory.createVault(address(asset));
+    }
+
+    function testYieldAccruesProRataAcrossDepositors() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(BOB, 60 ether);
+        asset.mint(KEEPER, 20 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        uint256 aliceShares = vault.deposit(100 ether, ALICE);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 20 ether);
+
+        vm.prank(BOB);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(BOB);
+        uint256 bobShares = vault.deposit(60 ether, BOB);
+
+        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
+        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
+        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");
+
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);
+
+        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
+        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
+    }
+
+    function testReceiptTransfersMoveTheClaim() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(KEEPER, 50 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        vault.deposit(100 ether, ALICE);
+
+        vm.prank(ALICE);
+        vault.transfer(BOB, 40 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 50 ether);
+
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);
+
+        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
+        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
+    }
+
+    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(KEEPER, 1 ether);
+        asset.mint(ALICE, 10 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 1 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+
+        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
+        vm.prank(ALICE);
+        vault.deposit(10 ether, ALICE);
+    }
+
+    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
+        asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+        vault = TokenVault(factory.createVault(address(asset)));
+    }
+}
+

codex
The first pass is in place. I’m compiling now and will tighten anything the compiler or test harness rejects before I close this out.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
?? NOTES.md
?? foundry.toml
?? src/
?? test/

 exited 1 in 47ms:
Compiling 6 files with Solc 0.8.20
Solc 0.8.20 finished in 6.13ms
Error: Compiler run failed:
Error (7576): Undeclared identifier.
  --> src/SafeTransferLib.sol:10:47:
   |
10 |             token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
   |                                               ^^^^^^

Error (7576): Undeclared identifier.
  --> src/SafeTransferLib.sol:18:47:
   |
18 |             token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
   |                                               ^^^^^^

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..49a28a90c889be7b47f3418cc003c531311bd430
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Notes
+
+## Claim accounting
+
+Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.
+
+- On the first deposit, shares are minted 1:1 with assets deposited.
+- After that, new shares are minted at the current exchange rate:
+
+```text
+shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
+```
+
+- A holder's claim at any moment is:
+
+```text
+claimable assets = holderShares * currentVaultAssets / totalShareSupply
+```
+
+When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.
+
+Withdrawals support both directions:
+
+- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
+- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.
+
+## Operator requirements
+
+This design is intentionally simple and depends on the operator and keeper using it correctly.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
+- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
+- The keeper must only transfer the same underlying token that the vault was created for.
+- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
+- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d46e7f0d7560efe2dbab8de78dd8d3732a3439b9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+
diff --git a/src/ERC20.sol b/src/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9acccf4b9f3244cf3ee1fde98b349fe0a414af3c
--- /dev/null
+++ b/src/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+contract ERC20 is IERC20 {
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
diff --git a/src/IERC20.sol b/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4d4d196ed060e64ecbf9eadd4c1ae2db4f48dc59
--- /dev/null
+++ b/src/IERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/SafeTransferLib.sol b/src/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..478eb8ebe2f9e6db2c70edefb73df179f22b30ac
--- /dev/null
+++ b/src/SafeTransferLib.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
+
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d81d64b5dfcd54d939d3baaf4cff064ea8065b72
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,209 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "./ERC20.sol";
+import {IERC20, IERC20Metadata} from "./IERC20.sol";
+import {SafeTransferLib} from "./SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error UnsupportedAssetBehavior();
+    error VaultFundedBeforeSharesExist();
+    error DuplicateVault();
+
+    address public immutable asset;
+    address public immutable factory;
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    modifier onlyFactory() {
+        if (msg.sender != factory) revert DuplicateVault();
+        _;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return assets * supply / cachedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return _mulDivUp(assets, supply, cachedAssets);
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        if (supply == 0 && cachedAssets != 0) {
+            revert VaultFundedBeforeSharesExist();
+        }
+
+        shares = supply == 0 ? assets : assets * supply / cachedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter != cachedAssets + assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _mulDivUp(assets, supply, cachedAssets);
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
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
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
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
+        result = x * y / denominator;
+        if (x * y % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
+contract TokenVaultFactory {
+    error VaultAlreadyExists();
+    error ZeroAsset();
+
+    event VaultCreated(address indexed asset, address indexed vault);
+
+    mapping(address asset => address vault) public vaultOf;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _readSymbol(asset);
+        string memory assetName = _readName(asset);
+        uint8 assetDecimals = _readDecimals(asset);
+
+        vault = address(
+            new TokenVault{
+                salt: bytes32(uint256(uint160(asset)))
+            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
+        );
+
+        vaultOf[asset] = vault;
+        emit VaultCreated(asset, vault);
+    }
+
+    function predictVault(address asset) external view returns (address predicted) {
+        bytes32 salt = bytes32(uint256(uint160(asset)));
+        bytes memory creation = abi.encodePacked(
+            type(TokenVault).creationCode,
+            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
+        );
+        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
+    }
+
+    function _readName(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _readSymbol(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _readDecimals(address asset) internal view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..97a39318d82a51cf16e551c74bb1f2968ae057b5
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "../ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+}
+
diff --git a/test/TokenVault.t.sol b/test/TokenVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0acdd6a544c24ec26fa8c5e07aea55bcc7c41de0
--- /dev/null
+++ b/test/TokenVault.t.sol
@@ -0,0 +1,122 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {MockERC20} from "../src/mocks/MockERC20.sol";
+import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract Test {
+    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
+        require(left == right, message);
+    }
+
+    function assertEq(address left, address right, string memory message) internal pure {
+        require(left == right, message);
+    }
+}
+
+contract TokenVaultTest is Test {
+    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    address internal constant ALICE = address(0xA11CE);
+    address internal constant BOB = address(0xB0B);
+    address internal constant KEEPER = address(0xBEEF);
+
+    function testCreateVaultRejectsDuplicateAsset() external {
+        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+
+        address vaultAddress = factory.createVault(address(asset));
+        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");
+
+        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
+        factory.createVault(address(asset));
+    }
+
+    function testYieldAccruesProRataAcrossDepositors() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(BOB, 60 ether);
+        asset.mint(KEEPER, 20 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        uint256 aliceShares = vault.deposit(100 ether, ALICE);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 20 ether);
+
+        vm.prank(BOB);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(BOB);
+        uint256 bobShares = vault.deposit(60 ether, BOB);
+
+        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
+        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
+        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");
+
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);
+
+        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
+        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
+    }
+
+    function testReceiptTransfersMoveTheClaim() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(KEEPER, 50 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        vault.deposit(100 ether, ALICE);
+
+        vm.prank(ALICE);
+        vault.transfer(BOB, 40 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 50 ether);
+
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);
+
+        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
+        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
+    }
+
+    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(KEEPER, 1 ether);
+        asset.mint(ALICE, 10 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 1 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+
+        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
+        vm.prank(ALICE);
+        vault.deposit(10 ether, ALICE);
+    }
+
+    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
+        asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+        vault = TokenVault(factory.createVault(address(asset)));
+    }
+}
+

codex
`forge build` failed on a missing import in the transfer helper. I’m fixing that now, then I’ll rerun the build and tests to catch any second-order issues rather than stopping at the first compiler error.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/SafeTransferLib.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..49a28a90c889be7b47f3418cc003c531311bd430
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Notes
+
+## Claim accounting
+
+Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.
+
+- On the first deposit, shares are minted 1:1 with assets deposited.
+- After that, new shares are minted at the current exchange rate:
+
+```text
+shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
+```
+
+- A holder's claim at any moment is:
+
+```text
+claimable assets = holderShares * currentVaultAssets / totalShareSupply
+```
+
+When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.
+
+Withdrawals support both directions:
+
+- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
+- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.
+
+## Operator requirements
+
+This design is intentionally simple and depends on the operator and keeper using it correctly.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
+- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
+- The keeper must only transfer the same underlying token that the vault was created for.
+- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
+- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d46e7f0d7560efe2dbab8de78dd8d3732a3439b9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+
diff --git a/src/ERC20.sol b/src/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9acccf4b9f3244cf3ee1fde98b349fe0a414af3c
--- /dev/null
+++ b/src/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+contract ERC20 is IERC20 {
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
diff --git a/src/IERC20.sol b/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4d4d196ed060e64ecbf9eadd4c1ae2db4f48dc59
--- /dev/null
+++ b/src/IERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/SafeTransferLib.sol b/src/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..946d3d54d0a02e3686e2231dbb7e5fe1aa4c5a70
--- /dev/null
+++ b/src/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d81d64b5dfcd54d939d3baaf4cff064ea8065b72
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,209 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "./ERC20.sol";
+import {IERC20, IERC20Metadata} from "./IERC20.sol";
+import {SafeTransferLib} from "./SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error UnsupportedAssetBehavior();
+    error VaultFundedBeforeSharesExist();
+    error DuplicateVault();
+
+    address public immutable asset;
+    address public immutable factory;
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    modifier onlyFactory() {
+        if (msg.sender != factory) revert DuplicateVault();
+        _;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return assets * supply / cachedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return _mulDivUp(assets, supply, cachedAssets);
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        if (supply == 0 && cachedAssets != 0) {
+            revert VaultFundedBeforeSharesExist();
+        }
+
+        shares = supply == 0 ? assets : assets * supply / cachedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter != cachedAssets + assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _mulDivUp(assets, supply, cachedAssets);
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
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
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
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
+        result = x * y / denominator;
+        if (x * y % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
+contract TokenVaultFactory {
+    error VaultAlreadyExists();
+    error ZeroAsset();
+
+    event VaultCreated(address indexed asset, address indexed vault);
+
+    mapping(address asset => address vault) public vaultOf;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _readSymbol(asset);
+        string memory assetName = _readName(asset);
+        uint8 assetDecimals = _readDecimals(asset);
+
+        vault = address(
+            new TokenVault{
+                salt: bytes32(uint256(uint160(asset)))
+            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
+        );
+
+        vaultOf[asset] = vault;
+        emit VaultCreated(asset, vault);
+    }
+
+    function predictVault(address asset) external view returns (address predicted) {
+        bytes32 salt = bytes32(uint256(uint160(asset)));
+        bytes memory creation = abi.encodePacked(
+            type(TokenVault).creationCode,
+            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
+        );
+        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
+    }
+
+    function _readName(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _readSymbol(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _readDecimals(address asset) internal view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..97a39318d82a51cf16e551c74bb1f2968ae057b5
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "../ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+}
+
diff --git a/test/TokenVault.t.sol b/test/TokenVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0acdd6a544c24ec26fa8c5e07aea55bcc7c41de0
--- /dev/null
+++ b/test/TokenVault.t.sol
@@ -0,0 +1,122 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {MockERC20} from "../src/mocks/MockERC20.sol";
+import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract Test {
+    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
+        require(left == right, message);
+    }
+
+    function assertEq(address left, address right, string memory message) internal pure {
+        require(left == right, message);
+    }
+}
+
+contract TokenVaultTest is Test {
+    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    address internal constant ALICE = address(0xA11CE);
+    address internal constant BOB = address(0xB0B);
+    address internal constant KEEPER = address(0xBEEF);
+
+    function testCreateVaultRejectsDuplicateAsset() external {
+        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+
+        address vaultAddress = factory.createVault(address(asset));
+        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");
+
+        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
+        factory.createVault(address(asset));
+    }
+
+    function testYieldAccruesProRataAcrossDepositors() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(BOB, 60 ether);
+        asset.mint(KEEPER, 20 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        uint256 aliceShares = vault.deposit(100 ether, ALICE);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 20 ether);
+
+        vm.prank(BOB);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(BOB);
+        uint256 bobShares = vault.deposit(60 ether, BOB);
+
+        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
+        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
+        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");
+
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);
+
+        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
+        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
+    }
+
+    function testReceiptTransfersMoveTheClaim() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(KEEPER, 50 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        vault.deposit(100 ether, ALICE);
+
+        vm.prank(ALICE);
+        vault.transfer(BOB, 40 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 50 ether);
+
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);
+
+        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
+        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
+    }
+
+    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(KEEPER, 1 ether);
+        asset.mint(ALICE, 10 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 1 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+
+        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
+        vm.prank(ALICE);
+        vault.deposit(10 ether, ALICE);
+    }
+
+    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
+        asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+        vault = TokenVault(factory.createVault(address(asset)));
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..49a28a90c889be7b47f3418cc003c531311bd430
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Notes
+
+## Claim accounting
+
+Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.
+
+- On the first deposit, shares are minted 1:1 with assets deposited.
+- After that, new shares are minted at the current exchange rate:
+
+```text
+shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
+```
+
+- A holder's claim at any moment is:
+
+```text
+claimable assets = holderShares * currentVaultAssets / totalShareSupply
+```
+
+When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.
+
+Withdrawals support both directions:
+
+- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
+- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.
+
+## Operator requirements
+
+This design is intentionally simple and depends on the operator and keeper using it correctly.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
+- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
+- The keeper must only transfer the same underlying token that the vault was created for.
+- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
+- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d46e7f0d7560efe2dbab8de78dd8d3732a3439b9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+
diff --git a/src/ERC20.sol b/src/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9acccf4b9f3244cf3ee1fde98b349fe0a414af3c
--- /dev/null
+++ b/src/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+contract ERC20 is IERC20 {
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
diff --git a/src/IERC20.sol b/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4d4d196ed060e64ecbf9eadd4c1ae2db4f48dc59
--- /dev/null
+++ b/src/IERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/SafeTransferLib.sol b/src/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..946d3d54d0a02e3686e2231dbb7e5fe1aa4c5a70
--- /dev/null
+++ b/src/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d81d64b5dfcd54d939d3baaf4cff064ea8065b72
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,209 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "./ERC20.sol";
+import {IERC20, IERC20Metadata} from "./IERC20.sol";
+import {SafeTransferLib} from "./SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error UnsupportedAssetBehavior();
+    error VaultFundedBeforeSharesExist();
+    error DuplicateVault();
+
+    address public immutable asset;
+    address public immutable factory;
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    modifier onlyFactory() {
+        if (msg.sender != factory) revert DuplicateVault();
+        _;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return assets * supply / cachedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return _mulDivUp(assets, supply, cachedAssets);
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        if (supply == 0 && cachedAssets != 0) {
+            revert VaultFundedBeforeSharesExist();
+        }
+
+        shares = supply == 0 ? assets : assets * supply / cachedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter != cachedAssets + assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _mulDivUp(assets, supply, cachedAssets);
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
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
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
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
+        result = x * y / denominator;
+        if (x * y % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
+contract TokenVaultFactory {
+    error VaultAlreadyExists();
+    error ZeroAsset();
+
+    event VaultCreated(address indexed asset, address indexed vault);
+
+    mapping(address asset => address vault) public vaultOf;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _readSymbol(asset);
+        string memory assetName = _readName(asset);
+        uint8 assetDecimals = _readDecimals(asset);
+
+        vault = address(
+            new TokenVault{
+                salt: bytes32(uint256(uint160(asset)))
+            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
+        );
+
+        vaultOf[asset] = vault;
+        emit VaultCreated(asset, vault);
+    }
+
+    function predictVault(address asset) external view returns (address predicted) {
+        bytes32 salt = bytes32(uint256(uint160(asset)));
+        bytes memory creation = abi.encodePacked(
+            type(TokenVault).creationCode,
+            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
+        );
+        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
+    }
+
+    function _readName(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _readSymbol(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _readDecimals(address asset) internal view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..97a39318d82a51cf16e551c74bb1f2968ae057b5
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "../ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+}
+
diff --git a/test/TokenVault.t.sol b/test/TokenVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0acdd6a544c24ec26fa8c5e07aea55bcc7c41de0
--- /dev/null
+++ b/test/TokenVault.t.sol
@@ -0,0 +1,122 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {MockERC20} from "../src/mocks/MockERC20.sol";
+import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract Test {
+    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
+        require(left == right, message);
+    }
+
+    function assertEq(address left, address right, string memory message) internal pure {
+        require(left == right, message);
+    }
+}
+
+contract TokenVaultTest is Test {
+    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    address internal constant ALICE = address(0xA11CE);
+    address internal constant BOB = address(0xB0B);
+    address internal constant KEEPER = address(0xBEEF);
+
+    function testCreateVaultRejectsDuplicateAsset() external {
+        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+
+        address vaultAddress = factory.createVault(address(asset));
+        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");
+
+        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
+        factory.createVault(address(asset));
+    }
+
+    function testYieldAccruesProRataAcrossDepositors() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(BOB, 60 ether);
+        asset.mint(KEEPER, 20 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        uint256 aliceShares = vault.deposit(100 ether, ALICE);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 20 ether);
+
+        vm.prank(BOB);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(BOB);
+        uint256 bobShares = vault.deposit(60 ether, BOB);
+
+        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
+        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
+        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");
+
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);
+
+        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
+        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
+    }
+
+    function testReceiptTransfersMoveTheClaim() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(KEEPER, 50 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        vault.deposit(100 ether, ALICE);
+
+        vm.prank(ALICE);
+        vault.transfer(BOB, 40 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 50 ether);
+
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);
+
+        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
+        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
+    }
+
+    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(KEEPER, 1 ether);
+        asset.mint(ALICE, 10 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 1 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+
+        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
+        vm.prank(ALICE);
+        vault.deposit(10 ether, ALICE);
+    }
+
+    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
+        asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+        vault = TokenVault(factory.createVault(address(asset)));
+    }
+}
+

exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'forge test' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
 succeeded in 160ms:
Compiling 6 files with Solc 0.8.20
Solc 0.8.20 finished in 115.00ms
Compiler run successful!
2026-09-04T04:19:38.488916Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> src/ERC20.sol:9:28
  |
9 |     uint8 public immutable decimals;
  |                            ^^^^^^^^ help: consider using: `DECIMALS`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> test/TokenVault.t.sol:23:26
   |
23 |     Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                          ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:17:30
   |
17 |     address public immutable asset;
   |                              ^^^^^ help: consider using: `ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:18:30
   |
18 |     address public immutable factory;
   |                              ^^^^^^^ help: consider using: `FACTORY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> test/TokenVault.t.sol:53:9
   |
53 |         asset.transfer(address(vault), 20 ether);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> test/TokenVault.t.sol:85:9
   |
85 |         vault.transfer(BOB, 40 ether);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> test/TokenVault.t.sol:88:9
   |
88 |         asset.transfer(address(vault), 50 ether);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
   --> test/TokenVault.t.sol:106:9
    |
106 |         asset.transfer(address(vault), 1 ether);
    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/TokenVault.sol:25:5
   |
25 | /     modifier onlyFactory() {
26 | |         if (msg.sender != factory) revert DuplicateVault();
27 | |         _;
28 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
25 ~     modifier onlyFactory() {
26 +         _onlyFactory();
27 +         _;
28 +     }
29 + 
30 +     function _onlyFactory() internal {
31 +         if (msg.sender != factory) revert DuplicateVault();
32 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic


 succeeded in 162ms:
Compiling 6 files with Solc 0.8.20
Solc 0.8.20 finished in 111.78ms
Compiler run successful!
2026-09-04T04:19:38.519848Z  WARN evm::traces::external: etherscan config not found

Ran 4 tests for test/TokenVault.t.sol:TokenVaultTest
[PASS] testCreateVaultRejectsDuplicateAsset() (gas: 5347496)
[PASS] testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() (gas: 5457558)
[PASS] testReceiptTransfersMoveTheClaim() (gas: 5512833)
[PASS] testYieldAccruesProRataAcrossDepositors() (gas: 5558088)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 1.81ms (3.37ms CPU time)

Ran 1 test suite in 8.64ms (1.81ms CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
2026-09-04T04:19:38.529366Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..49a28a90c889be7b47f3418cc003c531311bd430
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Notes
+
+## Claim accounting
+
+Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.
+
+- On the first deposit, shares are minted 1:1 with assets deposited.
+- After that, new shares are minted at the current exchange rate:
+
+```text
+shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
+```
+
+- A holder's claim at any moment is:
+
+```text
+claimable assets = holderShares * currentVaultAssets / totalShareSupply
+```
+
+When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.
+
+Withdrawals support both directions:
+
+- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
+- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.
+
+## Operator requirements
+
+This design is intentionally simple and depends on the operator and keeper using it correctly.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
+- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
+- The keeper must only transfer the same underlying token that the vault was created for.
+- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
+- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d46e7f0d7560efe2dbab8de78dd8d3732a3439b9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+
diff --git a/src/ERC20.sol b/src/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9acccf4b9f3244cf3ee1fde98b349fe0a414af3c
--- /dev/null
+++ b/src/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+contract ERC20 is IERC20 {
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
diff --git a/src/IERC20.sol b/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4d4d196ed060e64ecbf9eadd4c1ae2db4f48dc59
--- /dev/null
+++ b/src/IERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/SafeTransferLib.sol b/src/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..946d3d54d0a02e3686e2231dbb7e5fe1aa4c5a70
--- /dev/null
+++ b/src/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d81d64b5dfcd54d939d3baaf4cff064ea8065b72
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,209 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "./ERC20.sol";
+import {IERC20, IERC20Metadata} from "./IERC20.sol";
+import {SafeTransferLib} from "./SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error UnsupportedAssetBehavior();
+    error VaultFundedBeforeSharesExist();
+    error DuplicateVault();
+
+    address public immutable asset;
+    address public immutable factory;
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    modifier onlyFactory() {
+        if (msg.sender != factory) revert DuplicateVault();
+        _;
+    }
+
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return assets * supply / cachedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return _mulDivUp(assets, supply, cachedAssets);
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        if (supply == 0 && cachedAssets != 0) {
+            revert VaultFundedBeforeSharesExist();
+        }
+
+        shares = supply == 0 ? assets : assets * supply / cachedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter != cachedAssets + assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _mulDivUp(assets, supply, cachedAssets);
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
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
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
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
+        result = x * y / denominator;
+        if (x * y % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
+contract TokenVaultFactory {
+    error VaultAlreadyExists();
+    error ZeroAsset();
+
+    event VaultCreated(address indexed asset, address indexed vault);
+
+    mapping(address asset => address vault) public vaultOf;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _readSymbol(asset);
+        string memory assetName = _readName(asset);
+        uint8 assetDecimals = _readDecimals(asset);
+
+        vault = address(
+            new TokenVault{
+                salt: bytes32(uint256(uint160(asset)))
+            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
+        );
+
+        vaultOf[asset] = vault;
+        emit VaultCreated(asset, vault);
+    }
+
+    function predictVault(address asset) external view returns (address predicted) {
+        bytes32 salt = bytes32(uint256(uint160(asset)));
+        bytes memory creation = abi.encodePacked(
+            type(TokenVault).creationCode,
+            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
+        );
+        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
+    }
+
+    function _readName(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _readSymbol(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _readDecimals(address asset) internal view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
+
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..97a39318d82a51cf16e551c74bb1f2968ae057b5
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "../ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+}
+
diff --git a/test/TokenVault.t.sol b/test/TokenVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0acdd6a544c24ec26fa8c5e07aea55bcc7c41de0
--- /dev/null
+++ b/test/TokenVault.t.sol
@@ -0,0 +1,122 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {MockERC20} from "../src/mocks/MockERC20.sol";
+import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract Test {
+    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
+        require(left == right, message);
+    }
+
+    function assertEq(address left, address right, string memory message) internal pure {
+        require(left == right, message);
+    }
+}
+
+contract TokenVaultTest is Test {
+    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    address internal constant ALICE = address(0xA11CE);
+    address internal constant BOB = address(0xB0B);
+    address internal constant KEEPER = address(0xBEEF);
+
+    function testCreateVaultRejectsDuplicateAsset() external {
+        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+
+        address vaultAddress = factory.createVault(address(asset));
+        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");
+
+        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
+        factory.createVault(address(asset));
+    }
+
+    function testYieldAccruesProRataAcrossDepositors() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(BOB, 60 ether);
+        asset.mint(KEEPER, 20 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        uint256 aliceShares = vault.deposit(100 ether, ALICE);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 20 ether);
+
+        vm.prank(BOB);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(BOB);
+        uint256 bobShares = vault.deposit(60 ether, BOB);
+
+        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
+        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
+        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");
+
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);
+
+        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
+        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
+    }
+
+    function testReceiptTransfersMoveTheClaim() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(KEEPER, 50 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        vault.deposit(100 ether, ALICE);
+
+        vm.prank(ALICE);
+        vault.transfer(BOB, 40 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 50 ether);
+
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);
+
+        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
+        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
+    }
+
+    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(KEEPER, 1 ether);
+        asset.mint(ALICE, 10 ether);
+
+        vm.prank(KEEPER);
+        asset.transfer(address(vault), 1 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+
+        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
+        vm.prank(ALICE);
+        vault.deposit(10 ether, ALICE);
+    }
+
+    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
+        asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+        vault = TokenVault(factory.createVault(address(asset)));
+    }
+}
+

codex
The contracts already compile and the tests pass. I’m doing one cleanup pass now to remove an unused modifier path and make the tests check ERC-20 transfer return values, so the project lands in a cleaner state rather than just barely passing.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/TokenVault.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/test/TokenVault.t.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..49a28a90c889be7b47f3418cc003c531311bd430
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Notes
+
+## Claim accounting
+
+Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.
+
+- On the first deposit, shares are minted 1:1 with assets deposited.
+- After that, new shares are minted at the current exchange rate:
+
+```text
+shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
+```
+
+- A holder's claim at any moment is:
+
+```text
+claimable assets = holderShares * currentVaultAssets / totalShareSupply
+```
+
+When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.
+
+Withdrawals support both directions:
+
+- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
+- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.
+
+## Operator requirements
+
+This design is intentionally simple and depends on the operator and keeper using it correctly.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
+- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
+- The keeper must only transfer the same underlying token that the vault was created for.
+- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
+- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d46e7f0d7560efe2dbab8de78dd8d3732a3439b9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+
diff --git a/src/ERC20.sol b/src/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9acccf4b9f3244cf3ee1fde98b349fe0a414af3c
--- /dev/null
+++ b/src/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+contract ERC20 is IERC20 {
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
diff --git a/src/IERC20.sol b/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4d4d196ed060e64ecbf9eadd4c1ae2db4f48dc59
--- /dev/null
+++ b/src/IERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/SafeTransferLib.sol b/src/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..946d3d54d0a02e3686e2231dbb7e5fe1aa4c5a70
--- /dev/null
+++ b/src/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb5edc890035d45dfadfe26c2206caf640dfdc55
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,202 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "./ERC20.sol";
+import {IERC20, IERC20Metadata} from "./IERC20.sol";
+import {SafeTransferLib} from "./SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error UnsupportedAssetBehavior();
+    error VaultFundedBeforeSharesExist();
+
+    address public immutable asset;
+    address public immutable factory;
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return assets * supply / cachedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return _mulDivUp(assets, supply, cachedAssets);
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        if (supply == 0 && cachedAssets != 0) {
+            revert VaultFundedBeforeSharesExist();
+        }
+
+        shares = supply == 0 ? assets : assets * supply / cachedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter != cachedAssets + assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _mulDivUp(assets, supply, cachedAssets);
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
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
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
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
+        result = x * y / denominator;
+        if (x * y % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
+contract TokenVaultFactory {
+    error VaultAlreadyExists();
+    error ZeroAsset();
+
+    event VaultCreated(address indexed asset, address indexed vault);
+
+    mapping(address asset => address vault) public vaultOf;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _readSymbol(asset);
+        string memory assetName = _readName(asset);
+        uint8 assetDecimals = _readDecimals(asset);
+
+        vault = address(
+            new TokenVault{
+                salt: bytes32(uint256(uint160(asset)))
+            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
+        );
+
+        vaultOf[asset] = vault;
+        emit VaultCreated(asset, vault);
+    }
+
+    function predictVault(address asset) external view returns (address predicted) {
+        bytes32 salt = bytes32(uint256(uint160(asset)));
+        bytes memory creation = abi.encodePacked(
+            type(TokenVault).creationCode,
+            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
+        );
+        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
+    }
+
+    function _readName(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _readSymbol(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _readDecimals(address asset) internal view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..97a39318d82a51cf16e551c74bb1f2968ae057b5
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "../ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+}
+
diff --git a/test/TokenVault.t.sol b/test/TokenVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..200026fba14d8a371f7631e2786fdaafc02e4d79
--- /dev/null
+++ b/test/TokenVault.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {MockERC20} from "../src/mocks/MockERC20.sol";
+import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract Test {
+    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
+        require(left == right, message);
+    }
+
+    function assertEq(address left, address right, string memory message) internal pure {
+        require(left == right, message);
+    }
+}
+
+contract TokenVaultTest is Test {
+    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    address internal constant ALICE = address(0xA11CE);
+    address internal constant BOB = address(0xB0B);
+    address internal constant KEEPER = address(0xBEEF);
+
+    function testCreateVaultRejectsDuplicateAsset() external {
+        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+
+        address vaultAddress = factory.createVault(address(asset));
+        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");
+
+        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
+        factory.createVault(address(asset));
+    }
+
+    function testYieldAccruesProRataAcrossDepositors() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(BOB, 60 ether);
+        asset.mint(KEEPER, 20 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        uint256 aliceShares = vault.deposit(100 ether, ALICE);
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 20 ether), "keeper transfer failed");
+
+        vm.prank(BOB);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(BOB);
+        uint256 bobShares = vault.deposit(60 ether, BOB);
+
+        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
+        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
+        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");
+
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);
+
+        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
+        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
+    }
+
+    function testReceiptTransfersMoveTheClaim() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(KEEPER, 50 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        vault.deposit(100 ether, ALICE);
+
+        vm.prank(ALICE);
+        require(vault.transfer(BOB, 40 ether), "share transfer failed");
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 50 ether), "keeper transfer failed");
+
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);
+
+        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
+        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
+    }
+
+    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(KEEPER, 1 ether);
+        asset.mint(ALICE, 10 ether);
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 1 ether), "keeper transfer failed");
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+
+        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
+        vm.prank(ALICE);
+        vault.deposit(10 ether, ALICE);
+    }
+
+    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
+        asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+        vault = TokenVault(factory.createVault(address(asset)));
+    }
+}

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..49a28a90c889be7b47f3418cc003c531311bd430
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Notes
+
+## Claim accounting
+
+Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.
+
+- On the first deposit, shares are minted 1:1 with assets deposited.
+- After that, new shares are minted at the current exchange rate:
+
+```text
+shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
+```
+
+- A holder's claim at any moment is:
+
+```text
+claimable assets = holderShares * currentVaultAssets / totalShareSupply
+```
+
+When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.
+
+Withdrawals support both directions:
+
+- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
+- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.
+
+## Operator requirements
+
+This design is intentionally simple and depends on the operator and keeper using it correctly.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
+- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
+- The keeper must only transfer the same underlying token that the vault was created for.
+- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
+- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d46e7f0d7560efe2dbab8de78dd8d3732a3439b9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+
diff --git a/src/ERC20.sol b/src/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9acccf4b9f3244cf3ee1fde98b349fe0a414af3c
--- /dev/null
+++ b/src/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+contract ERC20 is IERC20 {
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
diff --git a/src/IERC20.sol b/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4d4d196ed060e64ecbf9eadd4c1ae2db4f48dc59
--- /dev/null
+++ b/src/IERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/SafeTransferLib.sol b/src/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..946d3d54d0a02e3686e2231dbb7e5fe1aa4c5a70
--- /dev/null
+++ b/src/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb5edc890035d45dfadfe26c2206caf640dfdc55
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,202 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "./ERC20.sol";
+import {IERC20, IERC20Metadata} from "./IERC20.sol";
+import {SafeTransferLib} from "./SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error UnsupportedAssetBehavior();
+    error VaultFundedBeforeSharesExist();
+
+    address public immutable asset;
+    address public immutable factory;
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return assets * supply / cachedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return _mulDivUp(assets, supply, cachedAssets);
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        if (supply == 0 && cachedAssets != 0) {
+            revert VaultFundedBeforeSharesExist();
+        }
+
+        shares = supply == 0 ? assets : assets * supply / cachedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter != cachedAssets + assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _mulDivUp(assets, supply, cachedAssets);
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
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
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
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
+        result = x * y / denominator;
+        if (x * y % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
+contract TokenVaultFactory {
+    error VaultAlreadyExists();
+    error ZeroAsset();
+
+    event VaultCreated(address indexed asset, address indexed vault);
+
+    mapping(address asset => address vault) public vaultOf;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _readSymbol(asset);
+        string memory assetName = _readName(asset);
+        uint8 assetDecimals = _readDecimals(asset);
+
+        vault = address(
+            new TokenVault{
+                salt: bytes32(uint256(uint160(asset)))
+            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
+        );
+
+        vaultOf[asset] = vault;
+        emit VaultCreated(asset, vault);
+    }
+
+    function predictVault(address asset) external view returns (address predicted) {
+        bytes32 salt = bytes32(uint256(uint160(asset)));
+        bytes memory creation = abi.encodePacked(
+            type(TokenVault).creationCode,
+            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
+        );
+        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
+    }
+
+    function _readName(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _readSymbol(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _readDecimals(address asset) internal view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..97a39318d82a51cf16e551c74bb1f2968ae057b5
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "../ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+}
+
diff --git a/test/TokenVault.t.sol b/test/TokenVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..200026fba14d8a371f7631e2786fdaafc02e4d79
--- /dev/null
+++ b/test/TokenVault.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {MockERC20} from "../src/mocks/MockERC20.sol";
+import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract Test {
+    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
+        require(left == right, message);
+    }
+
+    function assertEq(address left, address right, string memory message) internal pure {
+        require(left == right, message);
+    }
+}
+
+contract TokenVaultTest is Test {
+    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    address internal constant ALICE = address(0xA11CE);
+    address internal constant BOB = address(0xB0B);
+    address internal constant KEEPER = address(0xBEEF);
+
+    function testCreateVaultRejectsDuplicateAsset() external {
+        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+
+        address vaultAddress = factory.createVault(address(asset));
+        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");
+
+        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
+        factory.createVault(address(asset));
+    }
+
+    function testYieldAccruesProRataAcrossDepositors() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(BOB, 60 ether);
+        asset.mint(KEEPER, 20 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        uint256 aliceShares = vault.deposit(100 ether, ALICE);
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 20 ether), "keeper transfer failed");
+
+        vm.prank(BOB);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(BOB);
+        uint256 bobShares = vault.deposit(60 ether, BOB);
+
+        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
+        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
+        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");
+
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);
+
+        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
+        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
+    }
+
+    function testReceiptTransfersMoveTheClaim() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(KEEPER, 50 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        vault.deposit(100 ether, ALICE);
+
+        vm.prank(ALICE);
+        require(vault.transfer(BOB, 40 ether), "share transfer failed");
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 50 ether), "keeper transfer failed");
+
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);
+
+        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
+        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
+    }
+
+    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(KEEPER, 1 ether);
+        asset.mint(ALICE, 10 ether);
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 1 ether), "keeper transfer failed");
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+
+        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
+        vm.prank(ALICE);
+        vault.deposit(10 ether, ALICE);
+    }
+
+    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
+        asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+        vault = TokenVault(factory.createVault(address(asset)));
+    }
+}

exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'forge test' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001
 succeeded in 9ms:
?? NOTES.md
?? foundry.toml
?? src/
?? test/

 succeeded in 167ms:
Compiling 2 files with Solc 0.8.20
Solc 0.8.20 finished in 104.89ms
Compiler run successful!
2026-09-04T04:19:58.282632Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> src/ERC20.sol:9:28
  |
9 |     uint8 public immutable decimals;
  |                            ^^^^^^^^ help: consider using: `DECIMALS`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:16:30
   |
16 |     address public immutable asset;
   |                              ^^^^^ help: consider using: `ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> test/TokenVault.t.sol:23:26
   |
23 |     Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                          ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/TokenVault.sol:17:30
   |
17 |     address public immutable factory;
   |                              ^^^^^^^ help: consider using: `FACTORY`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable


 succeeded in 172ms:
Compiling 2 files with Solc 0.8.20
Solc 0.8.20 finished in 103.99ms
Compiler run successful!
2026-09-04T04:19:58.286213Z  WARN evm::traces::external: etherscan config not found

Ran 4 tests for test/TokenVault.t.sol:TokenVaultTest
[PASS] testCreateVaultRejectsDuplicateAsset() (gas: 5347496)
[PASS] testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() (gas: 5457570)
[PASS] testReceiptTransfersMoveTheClaim() (gas: 5512857)
[PASS] testYieldAccruesProRataAcrossDepositors() (gas: 5558100)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 1.43ms (2.95ms CPU time)

Ran 1 test suite in 8.32ms (1.43ms CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
2026-09-04T04:19:58.295455Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..49a28a90c889be7b47f3418cc003c531311bd430
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Notes
+
+## Claim accounting
+
+Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.
+
+- On the first deposit, shares are minted 1:1 with assets deposited.
+- After that, new shares are minted at the current exchange rate:
+
+```text
+shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
+```
+
+- A holder's claim at any moment is:
+
+```text
+claimable assets = holderShares * currentVaultAssets / totalShareSupply
+```
+
+When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.
+
+Withdrawals support both directions:
+
+- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
+- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.
+
+## Operator requirements
+
+This design is intentionally simple and depends on the operator and keeper using it correctly.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
+- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
+- The keeper must only transfer the same underlying token that the vault was created for.
+- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
+- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d46e7f0d7560efe2dbab8de78dd8d3732a3439b9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+
diff --git a/src/ERC20.sol b/src/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9acccf4b9f3244cf3ee1fde98b349fe0a414af3c
--- /dev/null
+++ b/src/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+contract ERC20 is IERC20 {
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
diff --git a/src/IERC20.sol b/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4d4d196ed060e64ecbf9eadd4c1ae2db4f48dc59
--- /dev/null
+++ b/src/IERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/SafeTransferLib.sol b/src/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..946d3d54d0a02e3686e2231dbb7e5fe1aa4c5a70
--- /dev/null
+++ b/src/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb5edc890035d45dfadfe26c2206caf640dfdc55
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,202 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "./ERC20.sol";
+import {IERC20, IERC20Metadata} from "./IERC20.sol";
+import {SafeTransferLib} from "./SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error UnsupportedAssetBehavior();
+    error VaultFundedBeforeSharesExist();
+
+    address public immutable asset;
+    address public immutable factory;
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return assets * supply / cachedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return _mulDivUp(assets, supply, cachedAssets);
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        if (supply == 0 && cachedAssets != 0) {
+            revert VaultFundedBeforeSharesExist();
+        }
+
+        shares = supply == 0 ? assets : assets * supply / cachedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter != cachedAssets + assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _mulDivUp(assets, supply, cachedAssets);
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
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
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
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
+        result = x * y / denominator;
+        if (x * y % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
+contract TokenVaultFactory {
+    error VaultAlreadyExists();
+    error ZeroAsset();
+
+    event VaultCreated(address indexed asset, address indexed vault);
+
+    mapping(address asset => address vault) public vaultOf;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _readSymbol(asset);
+        string memory assetName = _readName(asset);
+        uint8 assetDecimals = _readDecimals(asset);
+
+        vault = address(
+            new TokenVault{
+                salt: bytes32(uint256(uint160(asset)))
+            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
+        );
+
+        vaultOf[asset] = vault;
+        emit VaultCreated(asset, vault);
+    }
+
+    function predictVault(address asset) external view returns (address predicted) {
+        bytes32 salt = bytes32(uint256(uint160(asset)));
+        bytes memory creation = abi.encodePacked(
+            type(TokenVault).creationCode,
+            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
+        );
+        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
+    }
+
+    function _readName(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _readSymbol(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _readDecimals(address asset) internal view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..97a39318d82a51cf16e551c74bb1f2968ae057b5
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "../ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+}
+
diff --git a/test/TokenVault.t.sol b/test/TokenVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..200026fba14d8a371f7631e2786fdaafc02e4d79
--- /dev/null
+++ b/test/TokenVault.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {MockERC20} from "../src/mocks/MockERC20.sol";
+import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract Test {
+    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
+        require(left == right, message);
+    }
+
+    function assertEq(address left, address right, string memory message) internal pure {
+        require(left == right, message);
+    }
+}
+
+contract TokenVaultTest is Test {
+    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    address internal constant ALICE = address(0xA11CE);
+    address internal constant BOB = address(0xB0B);
+    address internal constant KEEPER = address(0xBEEF);
+
+    function testCreateVaultRejectsDuplicateAsset() external {
+        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+
+        address vaultAddress = factory.createVault(address(asset));
+        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");
+
+        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
+        factory.createVault(address(asset));
+    }
+
+    function testYieldAccruesProRataAcrossDepositors() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(BOB, 60 ether);
+        asset.mint(KEEPER, 20 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        uint256 aliceShares = vault.deposit(100 ether, ALICE);
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 20 ether), "keeper transfer failed");
+
+        vm.prank(BOB);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(BOB);
+        uint256 bobShares = vault.deposit(60 ether, BOB);
+
+        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
+        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
+        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");
+
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);
+
+        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
+        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
+    }
+
+    function testReceiptTransfersMoveTheClaim() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(KEEPER, 50 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        vault.deposit(100 ether, ALICE);
+
+        vm.prank(ALICE);
+        require(vault.transfer(BOB, 40 ether), "share transfer failed");
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 50 ether), "keeper transfer failed");
+
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);
+
+        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
+        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
+    }
+
+    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(KEEPER, 1 ether);
+        asset.mint(ALICE, 10 ether);
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 1 ether), "keeper transfer failed");
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+
+        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
+        vm.prank(ALICE);
+        vault.deposit(10 ether, ALICE);
+    }
+
+    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
+        asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+        vault = TokenVault(factory.createVault(address(asset)));
+    }
+}

  ✓ Inspect local toolchain and choose a minimal Foundry project layout that will compile in this environment
  ✓ Implement permissionless ERC-20 vault factory, vault receipt token logic, and focused tests/docs
  ✓ Run forge build and fix any compile issues before summarizing outcomes
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..49a28a90c889be7b47f3418cc003c531311bd430
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Notes
+
+## Claim accounting
+
+Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.
+
+- On the first deposit, shares are minted 1:1 with assets deposited.
+- After that, new shares are minted at the current exchange rate:
+
+```text
+shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
+```
+
+- A holder's claim at any moment is:
+
+```text
+claimable assets = holderShares * currentVaultAssets / totalShareSupply
+```
+
+When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.
+
+Withdrawals support both directions:
+
+- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
+- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.
+
+## Operator requirements
+
+This design is intentionally simple and depends on the operator and keeper using it correctly.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
+- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
+- The keeper must only transfer the same underlying token that the vault was created for.
+- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
+- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d46e7f0d7560efe2dbab8de78dd8d3732a3439b9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+
diff --git a/src/ERC20.sol b/src/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9acccf4b9f3244cf3ee1fde98b349fe0a414af3c
--- /dev/null
+++ b/src/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+contract ERC20 is IERC20 {
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
diff --git a/src/IERC20.sol b/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4d4d196ed060e64ecbf9eadd4c1ae2db4f48dc59
--- /dev/null
+++ b/src/IERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/SafeTransferLib.sol b/src/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..946d3d54d0a02e3686e2231dbb7e5fe1aa4c5a70
--- /dev/null
+++ b/src/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb5edc890035d45dfadfe26c2206caf640dfdc55
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,202 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "./ERC20.sol";
+import {IERC20, IERC20Metadata} from "./IERC20.sol";
+import {SafeTransferLib} from "./SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error UnsupportedAssetBehavior();
+    error VaultFundedBeforeSharesExist();
+
+    address public immutable asset;
+    address public immutable factory;
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return assets * supply / cachedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return _mulDivUp(assets, supply, cachedAssets);
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        if (supply == 0 && cachedAssets != 0) {
+            revert VaultFundedBeforeSharesExist();
+        }
+
+        shares = supply == 0 ? assets : assets * supply / cachedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter != cachedAssets + assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _mulDivUp(assets, supply, cachedAssets);
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
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
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
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
+        result = x * y / denominator;
+        if (x * y % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
+contract TokenVaultFactory {
+    error VaultAlreadyExists();
+    error ZeroAsset();
+
+    event VaultCreated(address indexed asset, address indexed vault);
+
+    mapping(address asset => address vault) public vaultOf;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _readSymbol(asset);
+        string memory assetName = _readName(asset);
+        uint8 assetDecimals = _readDecimals(asset);
+
+        vault = address(
+            new TokenVault{
+                salt: bytes32(uint256(uint160(asset)))
+            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
+        );
+
+        vaultOf[asset] = vault;
+        emit VaultCreated(asset, vault);
+    }
+
+    function predictVault(address asset) external view returns (address predicted) {
+        bytes32 salt = bytes32(uint256(uint160(asset)));
+        bytes memory creation = abi.encodePacked(
+            type(TokenVault).creationCode,
+            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
+        );
+        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
+    }
+
+    function _readName(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _readSymbol(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _readDecimals(address asset) internal view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..97a39318d82a51cf16e551c74bb1f2968ae057b5
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "../ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+}
+
diff --git a/test/TokenVault.t.sol b/test/TokenVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..200026fba14d8a371f7631e2786fdaafc02e4d79
--- /dev/null
+++ b/test/TokenVault.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {MockERC20} from "../src/mocks/MockERC20.sol";
+import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract Test {
+    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
+        require(left == right, message);
+    }
+
+    function assertEq(address left, address right, string memory message) internal pure {
+        require(left == right, message);
+    }
+}
+
+contract TokenVaultTest is Test {
+    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    address internal constant ALICE = address(0xA11CE);
+    address internal constant BOB = address(0xB0B);
+    address internal constant KEEPER = address(0xBEEF);
+
+    function testCreateVaultRejectsDuplicateAsset() external {
+        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+
+        address vaultAddress = factory.createVault(address(asset));
+        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");
+
+        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
+        factory.createVault(address(asset));
+    }
+
+    function testYieldAccruesProRataAcrossDepositors() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(BOB, 60 ether);
+        asset.mint(KEEPER, 20 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        uint256 aliceShares = vault.deposit(100 ether, ALICE);
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 20 ether), "keeper transfer failed");
+
+        vm.prank(BOB);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(BOB);
+        uint256 bobShares = vault.deposit(60 ether, BOB);
+
+        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
+        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
+        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");
+
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);
+
+        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
+        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
+    }
+
+    function testReceiptTransfersMoveTheClaim() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(KEEPER, 50 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        vault.deposit(100 ether, ALICE);
+
+        vm.prank(ALICE);
+        require(vault.transfer(BOB, 40 ether), "share transfer failed");
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 50 ether), "keeper transfer failed");
+
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);
+
+        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
+        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
+    }
+
+    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(KEEPER, 1 ether);
+        asset.mint(ALICE, 10 ether);
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 1 ether), "keeper transfer failed");
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+
+        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
+        vm.prank(ALICE);
+        vault.deposit(10 ether, ALICE);
+    }
+
+    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
+        asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+        vault = TokenVault(factory.createVault(address(asset)));
+    }
+}

codex
Implemented a dependency-free Foundry project for a permissionless single-asset vault system. The core deployment pieces are the factory and vault in [src/TokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/TokenVault.sol), with a minimal ERC-20 stack in [src/ERC20.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/ERC20.sol), [src/IERC20.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/IERC20.sol), and [src/SafeTransferLib.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/SafeTransferLib.sol). The factory permissionlessly creates one vault per underlying token, and each vault mints transferable receipt shares whose value increases when the keeper sends more of the same asset into the vault.

I also added a mock token and focused Solidity tests in [test/TokenVault.t.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/test/TokenVault.t.sol), plus operator/accounting notes in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/NOTES.md). The notes call out the key operational constraint in this design: do not push keeper yield into a vault before the first depositor has minted shares, and only use standard non-rebasing, non-fee-on-transfer ERC-20s.

Verification: `forge build` succeeds and `forge test` passes with 4/4 tests. Foundry emitted a benign cache warning because `/home/damu/.foundry` is read-only in this environment.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..49a28a90c889be7b47f3418cc003c531311bd430
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,35 @@
+# Notes
+
+## Claim accounting
+
+Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.
+
+- On the first deposit, shares are minted 1:1 with assets deposited.
+- After that, new shares are minted at the current exchange rate:
+
+```text
+shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
+```
+
+- A holder's claim at any moment is:
+
+```text
+claimable assets = holderShares * currentVaultAssets / totalShareSupply
+```
+
+When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.
+
+Withdrawals support both directions:
+
+- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
+- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.
+
+## Operator requirements
+
+This design is intentionally simple and depends on the operator and keeper using it correctly.
+
+- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
+- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
+- The keeper must only transfer the same underlying token that the vault was created for.
+- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
+- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d46e7f0d7560efe2dbab8de78dd8d3732a3439b9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = []
+solc_version = "0.8.20"
+
diff --git a/src/ERC20.sol b/src/ERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9acccf4b9f3244cf3ee1fde98b349fe0a414af3c
--- /dev/null
+++ b/src/ERC20.sol
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+contract ERC20 is IERC20 {
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
diff --git a/src/IERC20.sol b/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4d4d196ed060e64ecbf9eadd4c1ae2db4f48dc59
--- /dev/null
+++ b/src/IERC20.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
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
+interface IERC20Metadata is IERC20 {
+    function name() external view returns (string memory);
+    function symbol() external view returns (string memory);
+    function decimals() external view returns (uint8);
+}
+
diff --git a/src/SafeTransferLib.sol b/src/SafeTransferLib.sol
new file mode 100644
index 0000000000000000000000000000000000000000..946d3d54d0a02e3686e2231dbb7e5fe1aa4c5a70
--- /dev/null
+++ b/src/SafeTransferLib.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {IERC20} from "./IERC20.sol";
+
+library SafeTransferLib {
+    error TransferFailed();
+    error TransferFromFailed();
+
+    function safeTransfer(address token, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFailed();
+        }
+    }
+
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TransferFromFailed();
+        }
+    }
+}
diff --git a/src/TokenVault.sol b/src/TokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb5edc890035d45dfadfe26c2206caf640dfdc55
--- /dev/null
+++ b/src/TokenVault.sol
@@ -0,0 +1,202 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "./ERC20.sol";
+import {IERC20, IERC20Metadata} from "./IERC20.sol";
+import {SafeTransferLib} from "./SafeTransferLib.sol";
+
+contract TokenVault is ERC20 {
+    using SafeTransferLib for address;
+
+    error ZeroAssets();
+    error ZeroShares();
+    error UnsupportedAssetBehavior();
+    error VaultFundedBeforeSharesExist();
+
+    address public immutable asset;
+    address public immutable factory;
+
+    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
+    event Withdraw(
+        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
+    );
+
+    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
+        ERC20(name_, symbol_, decimals_)
+    {
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return assets * supply / cachedAssets;
+    }
+
+    function convertToAssets(uint256 shares) public view returns (uint256) {
+        uint256 supply = totalSupply;
+        if (supply == 0) {
+            return shares;
+        }
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
+        uint256 cachedAssets = totalAssets();
+        if (supply == 0 || cachedAssets == 0) {
+            return assets;
+        }
+        return _mulDivUp(assets, supply, cachedAssets);
+    }
+
+    function maxWithdraw(address owner) external view returns (uint256) {
+        return convertToAssets(balanceOf[owner]);
+    }
+
+    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+
+        if (supply == 0 && cachedAssets != 0) {
+            revert VaultFundedBeforeSharesExist();
+        }
+
+        shares = supply == 0 ? assets : assets * supply / cachedAssets;
+        if (shares == 0) revert ZeroShares();
+
+        asset.safeTransferFrom(msg.sender, address(this), assets);
+
+        uint256 assetsAfter = totalAssets();
+        if (assetsAfter != cachedAssets + assets) {
+            revert UnsupportedAssetBehavior();
+        }
+
+        _mint(receiver, shares);
+        emit Deposit(msg.sender, receiver, assets, shares);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
+        if (assets == 0) revert ZeroAssets();
+
+        uint256 supply = totalSupply;
+        uint256 cachedAssets = totalAssets();
+        shares = _mulDivUp(assets, supply, cachedAssets);
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
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
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
+
+        _burn(owner, shares);
+        asset.safeTransfer(receiver, assets);
+        emit Withdraw(msg.sender, receiver, owner, assets, shares);
+    }
+
+    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
+        result = x * y / denominator;
+        if (x * y % denominator != 0) {
+            unchecked {
+                result += 1;
+            }
+        }
+    }
+}
+
+contract TokenVaultFactory {
+    error VaultAlreadyExists();
+    error ZeroAsset();
+
+    event VaultCreated(address indexed asset, address indexed vault);
+
+    mapping(address asset => address vault) public vaultOf;
+
+    function createVault(address asset) external returns (address vault) {
+        if (asset == address(0)) revert ZeroAsset();
+        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();
+
+        string memory assetSymbol = _readSymbol(asset);
+        string memory assetName = _readName(asset);
+        uint8 assetDecimals = _readDecimals(asset);
+
+        vault = address(
+            new TokenVault{
+                salt: bytes32(uint256(uint160(asset)))
+            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
+        );
+
+        vaultOf[asset] = vault;
+        emit VaultCreated(asset, vault);
+    }
+
+    function predictVault(address asset) external view returns (address predicted) {
+        bytes32 salt = bytes32(uint256(uint160(asset)));
+        bytes memory creation = abi.encodePacked(
+            type(TokenVault).creationCode,
+            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
+        );
+        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
+    }
+
+    function _readName(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).name() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "Token";
+    }
+
+    function _readSymbol(address asset) internal view returns (string memory) {
+        try IERC20Metadata(asset).symbol() returns (string memory value) {
+            if (bytes(value).length != 0) return value;
+        } catch {}
+        return "TKN";
+    }
+
+    function _readDecimals(address asset) internal view returns (uint8) {
+        try IERC20Metadata(asset).decimals() returns (uint8 value) {
+            return value;
+        } catch {}
+        return 18;
+    }
+}
diff --git a/src/mocks/MockERC20.sol b/src/mocks/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..97a39318d82a51cf16e551c74bb1f2968ae057b5
--- /dev/null
+++ b/src/mocks/MockERC20.sol
@@ -0,0 +1,13 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {ERC20} from "../ERC20.sol";
+
+contract MockERC20 is ERC20 {
+    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}
+
+    function mint(address to, uint256 value) external {
+        _mint(to, value);
+    }
+}
+
diff --git a/test/TokenVault.t.sol b/test/TokenVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..200026fba14d8a371f7631e2786fdaafc02e4d79
--- /dev/null
+++ b/test/TokenVault.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.20;
+
+import {MockERC20} from "../src/mocks/MockERC20.sol";
+import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract Test {
+    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
+        require(left == right, message);
+    }
+
+    function assertEq(address left, address right, string memory message) internal pure {
+        require(left == right, message);
+    }
+}
+
+contract TokenVaultTest is Test {
+    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    address internal constant ALICE = address(0xA11CE);
+    address internal constant BOB = address(0xB0B);
+    address internal constant KEEPER = address(0xBEEF);
+
+    function testCreateVaultRejectsDuplicateAsset() external {
+        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+
+        address vaultAddress = factory.createVault(address(asset));
+        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");
+
+        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
+        factory.createVault(address(asset));
+    }
+
+    function testYieldAccruesProRataAcrossDepositors() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(BOB, 60 ether);
+        asset.mint(KEEPER, 20 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        uint256 aliceShares = vault.deposit(100 ether, ALICE);
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 20 ether), "keeper transfer failed");
+
+        vm.prank(BOB);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(BOB);
+        uint256 bobShares = vault.deposit(60 ether, BOB);
+
+        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
+        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
+        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");
+
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);
+
+        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
+        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
+    }
+
+    function testReceiptTransfersMoveTheClaim() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(ALICE, 100 ether);
+        asset.mint(KEEPER, 50 ether);
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+        vm.prank(ALICE);
+        vault.deposit(100 ether, ALICE);
+
+        vm.prank(ALICE);
+        require(vault.transfer(BOB, 40 ether), "share transfer failed");
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 50 ether), "keeper transfer failed");
+
+        vm.prank(BOB);
+        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
+        vm.prank(ALICE);
+        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);
+
+        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
+        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
+    }
+
+    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
+        (MockERC20 asset, TokenVault vault) = _deployVault();
+
+        asset.mint(KEEPER, 1 ether);
+        asset.mint(ALICE, 10 ether);
+
+        vm.prank(KEEPER);
+        require(asset.transfer(address(vault), 1 ether), "keeper transfer failed");
+
+        vm.prank(ALICE);
+        asset.approve(address(vault), type(uint256).max);
+
+        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
+        vm.prank(ALICE);
+        vault.deposit(10 ether, ALICE);
+    }
+
+    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
+        asset = new MockERC20("Mock USD", "mUSD", 18);
+        TokenVaultFactory factory = new TokenVaultFactory();
+        vault = TokenVault(factory.createVault(address(asset)));
+    }
+}

tokens used
33,689
````

## final message

Implemented a dependency-free Foundry project for a permissionless single-asset vault system. The core deployment pieces are the factory and vault in [src/TokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/TokenVault.sol), with a minimal ERC-20 stack in [src/ERC20.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/ERC20.sol), [src/IERC20.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/IERC20.sol), and [src/SafeTransferLib.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/src/SafeTransferLib.sol). The factory permissionlessly creates one vault per underlying token, and each vault mints transferable receipt shares whose value increases when the keeper sends more of the same asset into the vault.

I also added a mock token and focused Solidity tests in [test/TokenVault.t.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/test/TokenVault.t.sol), plus operator/accounting notes in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041622Z-codex-no-skill-2/security-goal-001/NOTES.md). The notes call out the key operational constraint in this design: do not push keeper yield into a vault before the first depositor has minted shares, and only use standard non-rebasing, non-fee-on-transfer ERC-20s.

Verification: `forge build` succeeds and `forge test` passes with 4/4 tests. Foundry emitted a benign cache warning because `/home/damu/.foundry` is read-only in this environment.

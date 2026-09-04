# Executor transcript — 2026-08-27T234411Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0459c-1b22-7d42-87a5-4293a0efc566
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.

2026-08-27T23:44:13.815303Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a0459c-1b22-7d42-87a5-4293a0efc566.tmp-1787874253612397441: line 2547: syntax error near unexpected token `('

codex
I’ll set up a focused Solidity escrow project with deployment tooling, tests, and a concise deployment guide. I’ll first inspect the workspace so I can fit it to any existing setup.
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -200 && git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001
 succeeded in 7ms:
package.json
TASK.md

exec
/bin/bash -lc "sed -n '1,240p' package.json && sed -n '1,240p' TASK.md && find . -maxdepth 2 -type f -not -path './.git/*' -print" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
{
  "name": "eval-workspace",
  "private": true
}
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.
./package.json
./TASK.md

codex
The workspace is empty, so I’m using Foundry: it keeps the contract, script, and tests compact and makes verification straightforward. The contract will escrow native ETH with explicit fund/release/refund/dispute paths and enforce the stated per-job bounds.
exec
/bin/bash -lc 'command -v forge || true; command -v solc || true; command -v npm || true; forge --version 2>/dev/null || true' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/home/damu/.foundry/bin/forge
/home/damu/.local/bin/solc
/home/damu/.nvm/versions/node/v22.22.2/bin/npm
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/.env.example
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/README.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/script/DeployFreelanceEscrow.s.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..ae41d8566bec0b0b873e627937cb31e2c490e4df
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,12 @@
+# A funded deployer key. Never commit a real .env file.
+PRIVATE_KEY=
+# Base Sepolia testnet RPC URL, e.g. from Alchemy or Coinbase Developer Platform
+BASE_SEPOLIA_RPC_URL=
+
+# Base Sepolia test USDC address and the three job participants
+PAYMENT_TOKEN=
+CLIENT=
+FREELANCER=
+ARBITRATOR=
+# USDC has 6 decimals: $10,000 = 10000000000
+AMOUNT=10000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5e1f17233a1eb14c2eff5f353c51a7a48209e16
--- /dev/null
+++ b/README.md
@@ -0,0 +1,25 @@
+# Freelance Escrow
+
+A per-job, non-custodial escrow contract for a 6-decimal USD stablecoin such as USDC. It enforces a job amount from $2,000 to $50,000, lets the client fund and release payment, and lets either party open a dispute that an agreed arbitrator can settle (including a split).
+
+## Recommended deployment
+
+Deploy first to **Base Sepolia**. It is an inexpensive public testnet that closely matches Base, where low transaction fees make it a practical production destination for frequent escrow actions. After an independent security review and a full test cycle, deploy the same bytecode to **Base mainnet** with the official USDC address for that network. The price bounds rely on USDC maintaining its USD peg; use only a vetted, 6-decimal stablecoin address.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, fill in the participant addresses, token address, and `AMOUNT` (USDC units: `$2,000 = 2000000000`, `$50,000 = 50000000000`). Do not commit `.env`.
+3. Load the values and deploy to Base Sepolia:
+
+   ```sh
+   set -a; source .env; set +a
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
+   ```
+
+The client then approves `AMOUNT` USDC for the deployed escrow address and calls `fund()`. Once work is accepted, the client calls `release()`. Either side can call `raiseDispute()` while funded; only `ARBITRATOR` can call `resolveDispute(freelancerAmount)`.
+
+## Important
+
+This is a starting implementation, not production-ready legal or security infrastructure. Each contract escrows one job and has an immutable arbitrator. Before mainnet use, obtain an independent smart-contract audit, establish dispute and KYC/AML procedures, secure the arbitrator key (ideally a multisig), and verify official token addresses from the issuer.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7fa6609364085313ff3b0b466ce5e481f45f7ba6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3bed384148b865b5a396c27866089eb676f4a30a
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function envUint(string calldata name) external returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice `forge script` deployment entry point. All values come from environment variables.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        address client = vm.envAddress("CLIENT");
+        address freelancer = vm.envAddress("FREELANCER");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        uint256 amount = vm.envUint("AMOUNT");
+
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, client, freelancer, arbitrator, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b3d97c1c08e0f60bdce721a68489864986e0861
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,112 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+/// @notice Non-custodial escrow for one USD-stablecoin-denominated freelance job.
+/// @dev Deploy one instance per job. This contract supports tokens with 6 decimals,
+///      e.g. USDC, so the $2,000-$50,000 limits can be expressed on-chain.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000 * 1e6;
+    uint256 public constant MAX_AMOUNT = 50_000 * 1e6;
+
+    enum Status { AwaitingFunding, Funded, Disputed, Released, Refunded, Resolved }
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error TransferFailed();
+    error IncorrectFundingAmount(uint256 received);
+    error InvalidSplit();
+
+    event Funded(address indexed client, uint256 amount);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event Resolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(address token_, address client_, address freelancer_, address arbitrator_, uint256 amount_) {
+        if (token_ == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        paymentToken = IERC20(token_);
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+    }
+
+    /// @notice Client funds the job after approving exactly `amount` tokens.
+    function fund() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
+        if (received != amount) revert IncorrectFundingAmount(received);
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Client accepts delivered work and pays the freelancer.
+    function release() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Freelancer or client can signal a disagreement while funds are held.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator settles a dispute, optionally splitting the escrow.
+    /// @param freelancerAmount Amount sent to freelancer; the remainder goes to client.
+    function resolveDispute(uint256 freelancerAmount) external {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (freelancerAmount > amount) revert InvalidSplit();
+
+        status = Status.Resolved;
+        uint256 clientAmount = amount - freelancerAmount;
+        if (freelancerAmount != 0) _safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(client, clientAmount);
+        emit Resolved(freelancerAmount, clientAmount);
+    }
+
+    /// @notice Client can cancel an unfunded job. No token movement occurs.
+    function cancelUnfunded() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+        status = Status.Refunded;
+        emit Refunded(client, 0);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        if (!paymentToken.transfer(to, value)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        if (!paymentToken.transferFrom(from, to, value)) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..54dc9d4f2d6f492346e5182a210fc228344238b4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,80 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        require(allowance[from][msg.sender] >= value, "allowance");
+        allowance[from][msg.sender] -= value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract ClientActor {
+    function approve(MockUSDC token, address escrow, uint256 amount) external { token.approve(escrow, amount); }
+    function fund(FreelanceEscrow escrow) external { escrow.fund(); }
+    function release(FreelanceEscrow escrow) external { escrow.release(); }
+    function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); }
+}
+
+contract FreelancerActor { function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); } }
+contract ArbitratorActor { function resolve(FreelanceEscrow escrow, uint256 amount) external { escrow.resolveDispute(amount); } }
+
+contract FreelanceEscrowTest {
+    uint256 private constant AMOUNT = 10_000 * 1e6;
+    MockUSDC private token;
+    ClientActor private client;
+    FreelancerActor private freelancer;
+    ArbitratorActor private arbitrator;
+
+    function setUp() public {
+        token = new MockUSDC();
+        client = new ClientActor();
+        freelancer = new FreelancerActor();
+        arbitrator = new ArbitratorActor();
+        token.mint(address(client), AMOUNT);
+    }
+
+    function testClientCanFundAndRelease() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        require(token.balanceOf(address(escrow)) == AMOUNT, "not funded");
+        client.release(escrow);
+        require(token.balanceOf(address(freelancer)) == AMOUNT, "not paid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        freelancer.dispute(escrow);
+        arbitrator.resolve(escrow, 6_000 * 1e6);
+        require(token.balanceOf(address(freelancer)) == 6_000 * 1e6, "freelancer split");
+        require(token.balanceOf(address(client)) == 4_000 * 1e6, "client split");
+    }
+
+    function testRejectsAmountsOutsideBounds() public {
+        bool reverted;
+        try new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), 1_999 * 1e6) {} catch { reverted = true; }
+        require(reverted, "accepted low amount");
+    }
+
+    function _newEscrow() private view returns (FreelanceEscrow) {
+        return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
+    }
+}

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..ae41d8566bec0b0b873e627937cb31e2c490e4df
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,12 @@
+# A funded deployer key. Never commit a real .env file.
+PRIVATE_KEY=
+# Base Sepolia testnet RPC URL, e.g. from Alchemy or Coinbase Developer Platform
+BASE_SEPOLIA_RPC_URL=
+
+# Base Sepolia test USDC address and the three job participants
+PAYMENT_TOKEN=
+CLIENT=
+FREELANCER=
+ARBITRATOR=
+# USDC has 6 decimals: $10,000 = 10000000000
+AMOUNT=10000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5e1f17233a1eb14c2eff5f353c51a7a48209e16
--- /dev/null
+++ b/README.md
@@ -0,0 +1,25 @@
+# Freelance Escrow
+
+A per-job, non-custodial escrow contract for a 6-decimal USD stablecoin such as USDC. It enforces a job amount from $2,000 to $50,000, lets the client fund and release payment, and lets either party open a dispute that an agreed arbitrator can settle (including a split).
+
+## Recommended deployment
+
+Deploy first to **Base Sepolia**. It is an inexpensive public testnet that closely matches Base, where low transaction fees make it a practical production destination for frequent escrow actions. After an independent security review and a full test cycle, deploy the same bytecode to **Base mainnet** with the official USDC address for that network. The price bounds rely on USDC maintaining its USD peg; use only a vetted, 6-decimal stablecoin address.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, fill in the participant addresses, token address, and `AMOUNT` (USDC units: `$2,000 = 2000000000`, `$50,000 = 50000000000`). Do not commit `.env`.
+3. Load the values and deploy to Base Sepolia:
+
+   ```sh
+   set -a; source .env; set +a
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
+   ```
+
+The client then approves `AMOUNT` USDC for the deployed escrow address and calls `fund()`. Once work is accepted, the client calls `release()`. Either side can call `raiseDispute()` while funded; only `ARBITRATOR` can call `resolveDispute(freelancerAmount)`.
+
+## Important
+
+This is a starting implementation, not production-ready legal or security infrastructure. Each contract escrows one job and has an immutable arbitrator. Before mainnet use, obtain an independent smart-contract audit, establish dispute and KYC/AML procedures, secure the arbitrator key (ideally a multisig), and verify official token addresses from the issuer.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7fa6609364085313ff3b0b466ce5e481f45f7ba6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3bed384148b865b5a396c27866089eb676f4a30a
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function envUint(string calldata name) external returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice `forge script` deployment entry point. All values come from environment variables.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        address client = vm.envAddress("CLIENT");
+        address freelancer = vm.envAddress("FREELANCER");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        uint256 amount = vm.envUint("AMOUNT");
+
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, client, freelancer, arbitrator, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b3d97c1c08e0f60bdce721a68489864986e0861
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,112 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+/// @notice Non-custodial escrow for one USD-stablecoin-denominated freelance job.
+/// @dev Deploy one instance per job. This contract supports tokens with 6 decimals,
+///      e.g. USDC, so the $2,000-$50,000 limits can be expressed on-chain.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000 * 1e6;
+    uint256 public constant MAX_AMOUNT = 50_000 * 1e6;
+
+    enum Status { AwaitingFunding, Funded, Disputed, Released, Refunded, Resolved }
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error TransferFailed();
+    error IncorrectFundingAmount(uint256 received);
+    error InvalidSplit();
+
+    event Funded(address indexed client, uint256 amount);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event Resolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(address token_, address client_, address freelancer_, address arbitrator_, uint256 amount_) {
+        if (token_ == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        paymentToken = IERC20(token_);
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+    }
+
+    /// @notice Client funds the job after approving exactly `amount` tokens.
+    function fund() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
+        if (received != amount) revert IncorrectFundingAmount(received);
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Client accepts delivered work and pays the freelancer.
+    function release() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Freelancer or client can signal a disagreement while funds are held.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator settles a dispute, optionally splitting the escrow.
+    /// @param freelancerAmount Amount sent to freelancer; the remainder goes to client.
+    function resolveDispute(uint256 freelancerAmount) external {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (freelancerAmount > amount) revert InvalidSplit();
+
+        status = Status.Resolved;
+        uint256 clientAmount = amount - freelancerAmount;
+        if (freelancerAmount != 0) _safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(client, clientAmount);
+        emit Resolved(freelancerAmount, clientAmount);
+    }
+
+    /// @notice Client can cancel an unfunded job. No token movement occurs.
+    function cancelUnfunded() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+        status = Status.Refunded;
+        emit Refunded(client, 0);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        if (!paymentToken.transfer(to, value)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        if (!paymentToken.transferFrom(from, to, value)) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..54dc9d4f2d6f492346e5182a210fc228344238b4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,80 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        require(allowance[from][msg.sender] >= value, "allowance");
+        allowance[from][msg.sender] -= value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract ClientActor {
+    function approve(MockUSDC token, address escrow, uint256 amount) external { token.approve(escrow, amount); }
+    function fund(FreelanceEscrow escrow) external { escrow.fund(); }
+    function release(FreelanceEscrow escrow) external { escrow.release(); }
+    function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); }
+}
+
+contract FreelancerActor { function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); } }
+contract ArbitratorActor { function resolve(FreelanceEscrow escrow, uint256 amount) external { escrow.resolveDispute(amount); } }
+
+contract FreelanceEscrowTest {
+    uint256 private constant AMOUNT = 10_000 * 1e6;
+    MockUSDC private token;
+    ClientActor private client;
+    FreelancerActor private freelancer;
+    ArbitratorActor private arbitrator;
+
+    function setUp() public {
+        token = new MockUSDC();
+        client = new ClientActor();
+        freelancer = new FreelancerActor();
+        arbitrator = new ArbitratorActor();
+        token.mint(address(client), AMOUNT);
+    }
+
+    function testClientCanFundAndRelease() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        require(token.balanceOf(address(escrow)) == AMOUNT, "not funded");
+        client.release(escrow);
+        require(token.balanceOf(address(freelancer)) == AMOUNT, "not paid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        freelancer.dispute(escrow);
+        arbitrator.resolve(escrow, 6_000 * 1e6);
+        require(token.balanceOf(address(freelancer)) == 6_000 * 1e6, "freelancer split");
+        require(token.balanceOf(address(client)) == 4_000 * 1e6, "client split");
+    }
+
+    function testRejectsAmountsOutsideBounds() public {
+        bool reverted;
+        try new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), 1_999 * 1e6) {} catch { reverted = true; }
+        require(reverted, "accepted low amount");
+    }
+
+    function _newEscrow() private view returns (FreelanceEscrow) {
+        return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
+    }
+}

exec
/bin/bash -lc 'forge test -vvv && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001
 exited 1 in 51ms:
Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 6.50ms
Error: Compiler run failed:
Error (8961): Function cannot be declared as view because this expression (potentially) modifies the state.
  --> test/FreelanceEscrow.t.sol:78:16:
   |
78 |         return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
   |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..ae41d8566bec0b0b873e627937cb31e2c490e4df
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,12 @@
+# A funded deployer key. Never commit a real .env file.
+PRIVATE_KEY=
+# Base Sepolia testnet RPC URL, e.g. from Alchemy or Coinbase Developer Platform
+BASE_SEPOLIA_RPC_URL=
+
+# Base Sepolia test USDC address and the three job participants
+PAYMENT_TOKEN=
+CLIENT=
+FREELANCER=
+ARBITRATOR=
+# USDC has 6 decimals: $10,000 = 10000000000
+AMOUNT=10000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5e1f17233a1eb14c2eff5f353c51a7a48209e16
--- /dev/null
+++ b/README.md
@@ -0,0 +1,25 @@
+# Freelance Escrow
+
+A per-job, non-custodial escrow contract for a 6-decimal USD stablecoin such as USDC. It enforces a job amount from $2,000 to $50,000, lets the client fund and release payment, and lets either party open a dispute that an agreed arbitrator can settle (including a split).
+
+## Recommended deployment
+
+Deploy first to **Base Sepolia**. It is an inexpensive public testnet that closely matches Base, where low transaction fees make it a practical production destination for frequent escrow actions. After an independent security review and a full test cycle, deploy the same bytecode to **Base mainnet** with the official USDC address for that network. The price bounds rely on USDC maintaining its USD peg; use only a vetted, 6-decimal stablecoin address.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, fill in the participant addresses, token address, and `AMOUNT` (USDC units: `$2,000 = 2000000000`, `$50,000 = 50000000000`). Do not commit `.env`.
+3. Load the values and deploy to Base Sepolia:
+
+   ```sh
+   set -a; source .env; set +a
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
+   ```
+
+The client then approves `AMOUNT` USDC for the deployed escrow address and calls `fund()`. Once work is accepted, the client calls `release()`. Either side can call `raiseDispute()` while funded; only `ARBITRATOR` can call `resolveDispute(freelancerAmount)`.
+
+## Important
+
+This is a starting implementation, not production-ready legal or security infrastructure. Each contract escrows one job and has an immutable arbitrator. Before mainnet use, obtain an independent smart-contract audit, establish dispute and KYC/AML procedures, secure the arbitrator key (ideally a multisig), and verify official token addresses from the issuer.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7fa6609364085313ff3b0b466ce5e481f45f7ba6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3bed384148b865b5a396c27866089eb676f4a30a
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function envUint(string calldata name) external returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice `forge script` deployment entry point. All values come from environment variables.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        address client = vm.envAddress("CLIENT");
+        address freelancer = vm.envAddress("FREELANCER");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        uint256 amount = vm.envUint("AMOUNT");
+
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, client, freelancer, arbitrator, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b3d97c1c08e0f60bdce721a68489864986e0861
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,112 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+/// @notice Non-custodial escrow for one USD-stablecoin-denominated freelance job.
+/// @dev Deploy one instance per job. This contract supports tokens with 6 decimals,
+///      e.g. USDC, so the $2,000-$50,000 limits can be expressed on-chain.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000 * 1e6;
+    uint256 public constant MAX_AMOUNT = 50_000 * 1e6;
+
+    enum Status { AwaitingFunding, Funded, Disputed, Released, Refunded, Resolved }
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error TransferFailed();
+    error IncorrectFundingAmount(uint256 received);
+    error InvalidSplit();
+
+    event Funded(address indexed client, uint256 amount);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event Resolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(address token_, address client_, address freelancer_, address arbitrator_, uint256 amount_) {
+        if (token_ == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        paymentToken = IERC20(token_);
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+    }
+
+    /// @notice Client funds the job after approving exactly `amount` tokens.
+    function fund() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
+        if (received != amount) revert IncorrectFundingAmount(received);
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Client accepts delivered work and pays the freelancer.
+    function release() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Freelancer or client can signal a disagreement while funds are held.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator settles a dispute, optionally splitting the escrow.
+    /// @param freelancerAmount Amount sent to freelancer; the remainder goes to client.
+    function resolveDispute(uint256 freelancerAmount) external {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (freelancerAmount > amount) revert InvalidSplit();
+
+        status = Status.Resolved;
+        uint256 clientAmount = amount - freelancerAmount;
+        if (freelancerAmount != 0) _safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(client, clientAmount);
+        emit Resolved(freelancerAmount, clientAmount);
+    }
+
+    /// @notice Client can cancel an unfunded job. No token movement occurs.
+    function cancelUnfunded() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+        status = Status.Refunded;
+        emit Refunded(client, 0);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        if (!paymentToken.transfer(to, value)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        if (!paymentToken.transferFrom(from, to, value)) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..54dc9d4f2d6f492346e5182a210fc228344238b4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,80 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        require(allowance[from][msg.sender] >= value, "allowance");
+        allowance[from][msg.sender] -= value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract ClientActor {
+    function approve(MockUSDC token, address escrow, uint256 amount) external { token.approve(escrow, amount); }
+    function fund(FreelanceEscrow escrow) external { escrow.fund(); }
+    function release(FreelanceEscrow escrow) external { escrow.release(); }
+    function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); }
+}
+
+contract FreelancerActor { function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); } }
+contract ArbitratorActor { function resolve(FreelanceEscrow escrow, uint256 amount) external { escrow.resolveDispute(amount); } }
+
+contract FreelanceEscrowTest {
+    uint256 private constant AMOUNT = 10_000 * 1e6;
+    MockUSDC private token;
+    ClientActor private client;
+    FreelancerActor private freelancer;
+    ArbitratorActor private arbitrator;
+
+    function setUp() public {
+        token = new MockUSDC();
+        client = new ClientActor();
+        freelancer = new FreelancerActor();
+        arbitrator = new ArbitratorActor();
+        token.mint(address(client), AMOUNT);
+    }
+
+    function testClientCanFundAndRelease() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        require(token.balanceOf(address(escrow)) == AMOUNT, "not funded");
+        client.release(escrow);
+        require(token.balanceOf(address(freelancer)) == AMOUNT, "not paid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        freelancer.dispute(escrow);
+        arbitrator.resolve(escrow, 6_000 * 1e6);
+        require(token.balanceOf(address(freelancer)) == 6_000 * 1e6, "freelancer split");
+        require(token.balanceOf(address(client)) == 4_000 * 1e6, "client split");
+    }
+
+    function testRejectsAmountsOutsideBounds() public {
+        bool reverted;
+        try new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), 1_999 * 1e6) {} catch { reverted = true; }
+        require(reverted, "accepted low amount");
+    }
+
+    function _newEscrow() private view returns (FreelanceEscrow) {
+        return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..ae41d8566bec0b0b873e627937cb31e2c490e4df
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,12 @@
+# A funded deployer key. Never commit a real .env file.
+PRIVATE_KEY=
+# Base Sepolia testnet RPC URL, e.g. from Alchemy or Coinbase Developer Platform
+BASE_SEPOLIA_RPC_URL=
+
+# Base Sepolia test USDC address and the three job participants
+PAYMENT_TOKEN=
+CLIENT=
+FREELANCER=
+ARBITRATOR=
+# USDC has 6 decimals: $10,000 = 10000000000
+AMOUNT=10000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5e1f17233a1eb14c2eff5f353c51a7a48209e16
--- /dev/null
+++ b/README.md
@@ -0,0 +1,25 @@
+# Freelance Escrow
+
+A per-job, non-custodial escrow contract for a 6-decimal USD stablecoin such as USDC. It enforces a job amount from $2,000 to $50,000, lets the client fund and release payment, and lets either party open a dispute that an agreed arbitrator can settle (including a split).
+
+## Recommended deployment
+
+Deploy first to **Base Sepolia**. It is an inexpensive public testnet that closely matches Base, where low transaction fees make it a practical production destination for frequent escrow actions. After an independent security review and a full test cycle, deploy the same bytecode to **Base mainnet** with the official USDC address for that network. The price bounds rely on USDC maintaining its USD peg; use only a vetted, 6-decimal stablecoin address.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, fill in the participant addresses, token address, and `AMOUNT` (USDC units: `$2,000 = 2000000000`, `$50,000 = 50000000000`). Do not commit `.env`.
+3. Load the values and deploy to Base Sepolia:
+
+   ```sh
+   set -a; source .env; set +a
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
+   ```
+
+The client then approves `AMOUNT` USDC for the deployed escrow address and calls `fund()`. Once work is accepted, the client calls `release()`. Either side can call `raiseDispute()` while funded; only `ARBITRATOR` can call `resolveDispute(freelancerAmount)`.
+
+## Important
+
+This is a starting implementation, not production-ready legal or security infrastructure. Each contract escrows one job and has an immutable arbitrator. Before mainnet use, obtain an independent smart-contract audit, establish dispute and KYC/AML procedures, secure the arbitrator key (ideally a multisig), and verify official token addresses from the issuer.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7fa6609364085313ff3b0b466ce5e481f45f7ba6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3bed384148b865b5a396c27866089eb676f4a30a
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function envUint(string calldata name) external returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice `forge script` deployment entry point. All values come from environment variables.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        address client = vm.envAddress("CLIENT");
+        address freelancer = vm.envAddress("FREELANCER");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        uint256 amount = vm.envUint("AMOUNT");
+
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, client, freelancer, arbitrator, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b3d97c1c08e0f60bdce721a68489864986e0861
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,112 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+/// @notice Non-custodial escrow for one USD-stablecoin-denominated freelance job.
+/// @dev Deploy one instance per job. This contract supports tokens with 6 decimals,
+///      e.g. USDC, so the $2,000-$50,000 limits can be expressed on-chain.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000 * 1e6;
+    uint256 public constant MAX_AMOUNT = 50_000 * 1e6;
+
+    enum Status { AwaitingFunding, Funded, Disputed, Released, Refunded, Resolved }
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error TransferFailed();
+    error IncorrectFundingAmount(uint256 received);
+    error InvalidSplit();
+
+    event Funded(address indexed client, uint256 amount);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event Resolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(address token_, address client_, address freelancer_, address arbitrator_, uint256 amount_) {
+        if (token_ == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        paymentToken = IERC20(token_);
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+    }
+
+    /// @notice Client funds the job after approving exactly `amount` tokens.
+    function fund() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
+        if (received != amount) revert IncorrectFundingAmount(received);
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Client accepts delivered work and pays the freelancer.
+    function release() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Freelancer or client can signal a disagreement while funds are held.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator settles a dispute, optionally splitting the escrow.
+    /// @param freelancerAmount Amount sent to freelancer; the remainder goes to client.
+    function resolveDispute(uint256 freelancerAmount) external {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (freelancerAmount > amount) revert InvalidSplit();
+
+        status = Status.Resolved;
+        uint256 clientAmount = amount - freelancerAmount;
+        if (freelancerAmount != 0) _safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(client, clientAmount);
+        emit Resolved(freelancerAmount, clientAmount);
+    }
+
+    /// @notice Client can cancel an unfunded job. No token movement occurs.
+    function cancelUnfunded() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+        status = Status.Refunded;
+        emit Refunded(client, 0);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        if (!paymentToken.transfer(to, value)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        if (!paymentToken.transferFrom(from, to, value)) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..538a61088f4dbd5d31890c5a751985114ebdf7b9
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,80 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        require(allowance[from][msg.sender] >= value, "allowance");
+        allowance[from][msg.sender] -= value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract ClientActor {
+    function approve(MockUSDC token, address escrow, uint256 amount) external { token.approve(escrow, amount); }
+    function fund(FreelanceEscrow escrow) external { escrow.fund(); }
+    function release(FreelanceEscrow escrow) external { escrow.release(); }
+    function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); }
+}
+
+contract FreelancerActor { function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); } }
+contract ArbitratorActor { function resolve(FreelanceEscrow escrow, uint256 amount) external { escrow.resolveDispute(amount); } }
+
+contract FreelanceEscrowTest {
+    uint256 private constant AMOUNT = 10_000 * 1e6;
+    MockUSDC private token;
+    ClientActor private client;
+    FreelancerActor private freelancer;
+    ArbitratorActor private arbitrator;
+
+    function setUp() public {
+        token = new MockUSDC();
+        client = new ClientActor();
+        freelancer = new FreelancerActor();
+        arbitrator = new ArbitratorActor();
+        token.mint(address(client), AMOUNT);
+    }
+
+    function testClientCanFundAndRelease() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        require(token.balanceOf(address(escrow)) == AMOUNT, "not funded");
+        client.release(escrow);
+        require(token.balanceOf(address(freelancer)) == AMOUNT, "not paid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        freelancer.dispute(escrow);
+        arbitrator.resolve(escrow, 6_000 * 1e6);
+        require(token.balanceOf(address(freelancer)) == 6_000 * 1e6, "freelancer split");
+        require(token.balanceOf(address(client)) == 4_000 * 1e6, "client split");
+    }
+
+    function testRejectsAmountsOutsideBounds() public {
+        bool reverted;
+        try new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), 1_999 * 1e6) {} catch { reverted = true; }
+        require(reverted, "accepted low amount");
+    }
+
+    function _newEscrow() private returns (FreelanceEscrow) {
+        return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
+    }
+}

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..ae41d8566bec0b0b873e627937cb31e2c490e4df
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,12 @@
+# A funded deployer key. Never commit a real .env file.
+PRIVATE_KEY=
+# Base Sepolia testnet RPC URL, e.g. from Alchemy or Coinbase Developer Platform
+BASE_SEPOLIA_RPC_URL=
+
+# Base Sepolia test USDC address and the three job participants
+PAYMENT_TOKEN=
+CLIENT=
+FREELANCER=
+ARBITRATOR=
+# USDC has 6 decimals: $10,000 = 10000000000
+AMOUNT=10000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5e1f17233a1eb14c2eff5f353c51a7a48209e16
--- /dev/null
+++ b/README.md
@@ -0,0 +1,25 @@
+# Freelance Escrow
+
+A per-job, non-custodial escrow contract for a 6-decimal USD stablecoin such as USDC. It enforces a job amount from $2,000 to $50,000, lets the client fund and release payment, and lets either party open a dispute that an agreed arbitrator can settle (including a split).
+
+## Recommended deployment
+
+Deploy first to **Base Sepolia**. It is an inexpensive public testnet that closely matches Base, where low transaction fees make it a practical production destination for frequent escrow actions. After an independent security review and a full test cycle, deploy the same bytecode to **Base mainnet** with the official USDC address for that network. The price bounds rely on USDC maintaining its USD peg; use only a vetted, 6-decimal stablecoin address.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, fill in the participant addresses, token address, and `AMOUNT` (USDC units: `$2,000 = 2000000000`, `$50,000 = 50000000000`). Do not commit `.env`.
+3. Load the values and deploy to Base Sepolia:
+
+   ```sh
+   set -a; source .env; set +a
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
+   ```
+
+The client then approves `AMOUNT` USDC for the deployed escrow address and calls `fund()`. Once work is accepted, the client calls `release()`. Either side can call `raiseDispute()` while funded; only `ARBITRATOR` can call `resolveDispute(freelancerAmount)`.
+
+## Important
+
+This is a starting implementation, not production-ready legal or security infrastructure. Each contract escrows one job and has an immutable arbitrator. Before mainnet use, obtain an independent smart-contract audit, establish dispute and KYC/AML procedures, secure the arbitrator key (ideally a multisig), and verify official token addresses from the issuer.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7fa6609364085313ff3b0b466ce5e481f45f7ba6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3bed384148b865b5a396c27866089eb676f4a30a
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function envUint(string calldata name) external returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice `forge script` deployment entry point. All values come from environment variables.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        address client = vm.envAddress("CLIENT");
+        address freelancer = vm.envAddress("FREELANCER");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        uint256 amount = vm.envUint("AMOUNT");
+
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, client, freelancer, arbitrator, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b3d97c1c08e0f60bdce721a68489864986e0861
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,112 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+/// @notice Non-custodial escrow for one USD-stablecoin-denominated freelance job.
+/// @dev Deploy one instance per job. This contract supports tokens with 6 decimals,
+///      e.g. USDC, so the $2,000-$50,000 limits can be expressed on-chain.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000 * 1e6;
+    uint256 public constant MAX_AMOUNT = 50_000 * 1e6;
+
+    enum Status { AwaitingFunding, Funded, Disputed, Released, Refunded, Resolved }
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error TransferFailed();
+    error IncorrectFundingAmount(uint256 received);
+    error InvalidSplit();
+
+    event Funded(address indexed client, uint256 amount);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event Resolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(address token_, address client_, address freelancer_, address arbitrator_, uint256 amount_) {
+        if (token_ == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        paymentToken = IERC20(token_);
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+    }
+
+    /// @notice Client funds the job after approving exactly `amount` tokens.
+    function fund() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
+        if (received != amount) revert IncorrectFundingAmount(received);
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Client accepts delivered work and pays the freelancer.
+    function release() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Freelancer or client can signal a disagreement while funds are held.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator settles a dispute, optionally splitting the escrow.
+    /// @param freelancerAmount Amount sent to freelancer; the remainder goes to client.
+    function resolveDispute(uint256 freelancerAmount) external {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (freelancerAmount > amount) revert InvalidSplit();
+
+        status = Status.Resolved;
+        uint256 clientAmount = amount - freelancerAmount;
+        if (freelancerAmount != 0) _safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(client, clientAmount);
+        emit Resolved(freelancerAmount, clientAmount);
+    }
+
+    /// @notice Client can cancel an unfunded job. No token movement occurs.
+    function cancelUnfunded() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+        status = Status.Refunded;
+        emit Refunded(client, 0);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        if (!paymentToken.transfer(to, value)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        if (!paymentToken.transferFrom(from, to, value)) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..538a61088f4dbd5d31890c5a751985114ebdf7b9
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,80 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        require(allowance[from][msg.sender] >= value, "allowance");
+        allowance[from][msg.sender] -= value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract ClientActor {
+    function approve(MockUSDC token, address escrow, uint256 amount) external { token.approve(escrow, amount); }
+    function fund(FreelanceEscrow escrow) external { escrow.fund(); }
+    function release(FreelanceEscrow escrow) external { escrow.release(); }
+    function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); }
+}
+
+contract FreelancerActor { function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); } }
+contract ArbitratorActor { function resolve(FreelanceEscrow escrow, uint256 amount) external { escrow.resolveDispute(amount); } }
+
+contract FreelanceEscrowTest {
+    uint256 private constant AMOUNT = 10_000 * 1e6;
+    MockUSDC private token;
+    ClientActor private client;
+    FreelancerActor private freelancer;
+    ArbitratorActor private arbitrator;
+
+    function setUp() public {
+        token = new MockUSDC();
+        client = new ClientActor();
+        freelancer = new FreelancerActor();
+        arbitrator = new ArbitratorActor();
+        token.mint(address(client), AMOUNT);
+    }
+
+    function testClientCanFundAndRelease() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        require(token.balanceOf(address(escrow)) == AMOUNT, "not funded");
+        client.release(escrow);
+        require(token.balanceOf(address(freelancer)) == AMOUNT, "not paid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        freelancer.dispute(escrow);
+        arbitrator.resolve(escrow, 6_000 * 1e6);
+        require(token.balanceOf(address(freelancer)) == 6_000 * 1e6, "freelancer split");
+        require(token.balanceOf(address(client)) == 4_000 * 1e6, "client split");
+    }
+
+    function testRejectsAmountsOutsideBounds() public {
+        bool reverted;
+        try new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), 1_999 * 1e6) {} catch { reverted = true; }
+        require(reverted, "accepted low amount");
+    }
+
+    function _newEscrow() private returns (FreelanceEscrow) {
+        return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
+    }
+}

exec
/bin/bash -lc 'forge test -vvv && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001
 succeeded in 244ms:
Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 189.76ms
Compiler run successful!

Ran 3 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbitratorCanSplitDispute() (gas: 747094)
[PASS] testClientCanFundAndRelease() (gas: 733013)
[PASS] testRejectsAmountsOutsideBounds() (gas: 42840)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 912.62µs (784.85µs CPU time)

Ran 1 test suite in 9.25ms (912.62µs CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)
?? .env.example
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..ae41d8566bec0b0b873e627937cb31e2c490e4df
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,12 @@
+# A funded deployer key. Never commit a real .env file.
+PRIVATE_KEY=
+# Base Sepolia testnet RPC URL, e.g. from Alchemy or Coinbase Developer Platform
+BASE_SEPOLIA_RPC_URL=
+
+# Base Sepolia test USDC address and the three job participants
+PAYMENT_TOKEN=
+CLIENT=
+FREELANCER=
+ARBITRATOR=
+# USDC has 6 decimals: $10,000 = 10000000000
+AMOUNT=10000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5e1f17233a1eb14c2eff5f353c51a7a48209e16
--- /dev/null
+++ b/README.md
@@ -0,0 +1,25 @@
+# Freelance Escrow
+
+A per-job, non-custodial escrow contract for a 6-decimal USD stablecoin such as USDC. It enforces a job amount from $2,000 to $50,000, lets the client fund and release payment, and lets either party open a dispute that an agreed arbitrator can settle (including a split).
+
+## Recommended deployment
+
+Deploy first to **Base Sepolia**. It is an inexpensive public testnet that closely matches Base, where low transaction fees make it a practical production destination for frequent escrow actions. After an independent security review and a full test cycle, deploy the same bytecode to **Base mainnet** with the official USDC address for that network. The price bounds rely on USDC maintaining its USD peg; use only a vetted, 6-decimal stablecoin address.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, fill in the participant addresses, token address, and `AMOUNT` (USDC units: `$2,000 = 2000000000`, `$50,000 = 50000000000`). Do not commit `.env`.
+3. Load the values and deploy to Base Sepolia:
+
+   ```sh
+   set -a; source .env; set +a
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
+   ```
+
+The client then approves `AMOUNT` USDC for the deployed escrow address and calls `fund()`. Once work is accepted, the client calls `release()`. Either side can call `raiseDispute()` while funded; only `ARBITRATOR` can call `resolveDispute(freelancerAmount)`.
+
+## Important
+
+This is a starting implementation, not production-ready legal or security infrastructure. Each contract escrows one job and has an immutable arbitrator. Before mainnet use, obtain an independent smart-contract audit, establish dispute and KYC/AML procedures, secure the arbitrator key (ideally a multisig), and verify official token addresses from the issuer.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7fa6609364085313ff3b0b466ce5e481f45f7ba6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3bed384148b865b5a396c27866089eb676f4a30a
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function envUint(string calldata name) external returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice `forge script` deployment entry point. All values come from environment variables.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        address client = vm.envAddress("CLIENT");
+        address freelancer = vm.envAddress("FREELANCER");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        uint256 amount = vm.envUint("AMOUNT");
+
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, client, freelancer, arbitrator, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b3d97c1c08e0f60bdce721a68489864986e0861
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,112 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+/// @notice Non-custodial escrow for one USD-stablecoin-denominated freelance job.
+/// @dev Deploy one instance per job. This contract supports tokens with 6 decimals,
+///      e.g. USDC, so the $2,000-$50,000 limits can be expressed on-chain.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000 * 1e6;
+    uint256 public constant MAX_AMOUNT = 50_000 * 1e6;
+
+    enum Status { AwaitingFunding, Funded, Disputed, Released, Refunded, Resolved }
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error TransferFailed();
+    error IncorrectFundingAmount(uint256 received);
+    error InvalidSplit();
+
+    event Funded(address indexed client, uint256 amount);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event Resolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(address token_, address client_, address freelancer_, address arbitrator_, uint256 amount_) {
+        if (token_ == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        paymentToken = IERC20(token_);
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+    }
+
+    /// @notice Client funds the job after approving exactly `amount` tokens.
+    function fund() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
+        if (received != amount) revert IncorrectFundingAmount(received);
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Client accepts delivered work and pays the freelancer.
+    function release() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Freelancer or client can signal a disagreement while funds are held.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator settles a dispute, optionally splitting the escrow.
+    /// @param freelancerAmount Amount sent to freelancer; the remainder goes to client.
+    function resolveDispute(uint256 freelancerAmount) external {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (freelancerAmount > amount) revert InvalidSplit();
+
+        status = Status.Resolved;
+        uint256 clientAmount = amount - freelancerAmount;
+        if (freelancerAmount != 0) _safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(client, clientAmount);
+        emit Resolved(freelancerAmount, clientAmount);
+    }
+
+    /// @notice Client can cancel an unfunded job. No token movement occurs.
+    function cancelUnfunded() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+        status = Status.Refunded;
+        emit Refunded(client, 0);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        if (!paymentToken.transfer(to, value)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        if (!paymentToken.transferFrom(from, to, value)) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..538a61088f4dbd5d31890c5a751985114ebdf7b9
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,80 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        require(allowance[from][msg.sender] >= value, "allowance");
+        allowance[from][msg.sender] -= value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract ClientActor {
+    function approve(MockUSDC token, address escrow, uint256 amount) external { token.approve(escrow, amount); }
+    function fund(FreelanceEscrow escrow) external { escrow.fund(); }
+    function release(FreelanceEscrow escrow) external { escrow.release(); }
+    function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); }
+}
+
+contract FreelancerActor { function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); } }
+contract ArbitratorActor { function resolve(FreelanceEscrow escrow, uint256 amount) external { escrow.resolveDispute(amount); } }
+
+contract FreelanceEscrowTest {
+    uint256 private constant AMOUNT = 10_000 * 1e6;
+    MockUSDC private token;
+    ClientActor private client;
+    FreelancerActor private freelancer;
+    ArbitratorActor private arbitrator;
+
+    function setUp() public {
+        token = new MockUSDC();
+        client = new ClientActor();
+        freelancer = new FreelancerActor();
+        arbitrator = new ArbitratorActor();
+        token.mint(address(client), AMOUNT);
+    }
+
+    function testClientCanFundAndRelease() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        require(token.balanceOf(address(escrow)) == AMOUNT, "not funded");
+        client.release(escrow);
+        require(token.balanceOf(address(freelancer)) == AMOUNT, "not paid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        freelancer.dispute(escrow);
+        arbitrator.resolve(escrow, 6_000 * 1e6);
+        require(token.balanceOf(address(freelancer)) == 6_000 * 1e6, "freelancer split");
+        require(token.balanceOf(address(client)) == 4_000 * 1e6, "client split");
+    }
+
+    function testRejectsAmountsOutsideBounds() public {
+        bool reverted;
+        try new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), 1_999 * 1e6) {} catch { reverted = true; }
+        require(reverted, "accepted low amount");
+    }
+
+    function _newEscrow() private returns (FreelanceEscrow) {
+        return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
+    }
+}

codex
The project now compiles and its core lifecycle tests pass. I’m tightening one deployment invariant as a final safeguard: the contract will reject a payment token unless it reports USDC-compatible 6 decimals, so the dollar bounds cannot silently be interpreted at the wrong scale.
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..ae41d8566bec0b0b873e627937cb31e2c490e4df
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,12 @@
+# A funded deployer key. Never commit a real .env file.
+PRIVATE_KEY=
+# Base Sepolia testnet RPC URL, e.g. from Alchemy or Coinbase Developer Platform
+BASE_SEPOLIA_RPC_URL=
+
+# Base Sepolia test USDC address and the three job participants
+PAYMENT_TOKEN=
+CLIENT=
+FREELANCER=
+ARBITRATOR=
+# USDC has 6 decimals: $10,000 = 10000000000
+AMOUNT=10000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5e1f17233a1eb14c2eff5f353c51a7a48209e16
--- /dev/null
+++ b/README.md
@@ -0,0 +1,25 @@
+# Freelance Escrow
+
+A per-job, non-custodial escrow contract for a 6-decimal USD stablecoin such as USDC. It enforces a job amount from $2,000 to $50,000, lets the client fund and release payment, and lets either party open a dispute that an agreed arbitrator can settle (including a split).
+
+## Recommended deployment
+
+Deploy first to **Base Sepolia**. It is an inexpensive public testnet that closely matches Base, where low transaction fees make it a practical production destination for frequent escrow actions. After an independent security review and a full test cycle, deploy the same bytecode to **Base mainnet** with the official USDC address for that network. The price bounds rely on USDC maintaining its USD peg; use only a vetted, 6-decimal stablecoin address.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, fill in the participant addresses, token address, and `AMOUNT` (USDC units: `$2,000 = 2000000000`, `$50,000 = 50000000000`). Do not commit `.env`.
+3. Load the values and deploy to Base Sepolia:
+
+   ```sh
+   set -a; source .env; set +a
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
+   ```
+
+The client then approves `AMOUNT` USDC for the deployed escrow address and calls `fund()`. Once work is accepted, the client calls `release()`. Either side can call `raiseDispute()` while funded; only `ARBITRATOR` can call `resolveDispute(freelancerAmount)`.
+
+## Important
+
+This is a starting implementation, not production-ready legal or security infrastructure. Each contract escrows one job and has an immutable arbitrator. Before mainnet use, obtain an independent smart-contract audit, establish dispute and KYC/AML procedures, secure the arbitrator key (ideally a multisig), and verify official token addresses from the issuer.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7fa6609364085313ff3b0b466ce5e481f45f7ba6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3bed384148b865b5a396c27866089eb676f4a30a
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function envUint(string calldata name) external returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice `forge script` deployment entry point. All values come from environment variables.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        address client = vm.envAddress("CLIENT");
+        address freelancer = vm.envAddress("FREELANCER");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        uint256 amount = vm.envUint("AMOUNT");
+
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, client, freelancer, arbitrator, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d8dc84ebbbccc1ed323114b89f9c2e3b4a48f607
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,118 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+interface IERC20Metadata {
+    function decimals() external view returns (uint8);
+}
+
+/// @notice Non-custodial escrow for one USD-stablecoin-denominated freelance job.
+/// @dev Deploy one instance per job. This contract supports tokens with 6 decimals,
+///      e.g. USDC, so the $2,000-$50,000 limits can be expressed on-chain.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000 * 1e6;
+    uint256 public constant MAX_AMOUNT = 50_000 * 1e6;
+
+    enum Status { AwaitingFunding, Funded, Disputed, Released, Refunded, Resolved }
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidTokenDecimals(uint8 decimals);
+    error InvalidStatus(Status current);
+    error TransferFailed();
+    error IncorrectFundingAmount(uint256 received);
+    error InvalidSplit();
+
+    event Funded(address indexed client, uint256 amount);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event Resolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(address token_, address client_, address freelancer_, address arbitrator_, uint256 amount_) {
+        if (token_ == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (IERC20Metadata(token_).decimals() != 6) revert InvalidTokenDecimals(IERC20Metadata(token_).decimals());
+        if (client_ == freelancer_ || amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        paymentToken = IERC20(token_);
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+    }
+
+    /// @notice Client funds the job after approving exactly `amount` tokens.
+    function fund() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
+        if (received != amount) revert IncorrectFundingAmount(received);
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Client accepts delivered work and pays the freelancer.
+    function release() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Freelancer or client can signal a disagreement while funds are held.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator settles a dispute, optionally splitting the escrow.
+    /// @param freelancerAmount Amount sent to freelancer; the remainder goes to client.
+    function resolveDispute(uint256 freelancerAmount) external {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (freelancerAmount > amount) revert InvalidSplit();
+
+        status = Status.Resolved;
+        uint256 clientAmount = amount - freelancerAmount;
+        if (freelancerAmount != 0) _safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(client, clientAmount);
+        emit Resolved(freelancerAmount, clientAmount);
+    }
+
+    /// @notice Client can cancel an unfunded job. No token movement occurs.
+    function cancelUnfunded() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+        status = Status.Refunded;
+        emit Refunded(client, 0);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        if (!paymentToken.transfer(to, value)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        if (!paymentToken.transferFrom(from, to, value)) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..285494e1a81c3feb1a9a3cb3c5e18d4bde7b330e
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function decimals() external pure returns (uint8) { return 6; }
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        require(allowance[from][msg.sender] >= value, "allowance");
+        allowance[from][msg.sender] -= value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract ClientActor {
+    function approve(MockUSDC token, address escrow, uint256 amount) external { token.approve(escrow, amount); }
+    function fund(FreelanceEscrow escrow) external { escrow.fund(); }
+    function release(FreelanceEscrow escrow) external { escrow.release(); }
+    function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); }
+}
+
+contract FreelancerActor { function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); } }
+contract ArbitratorActor { function resolve(FreelanceEscrow escrow, uint256 amount) external { escrow.resolveDispute(amount); } }
+
+contract FreelanceEscrowTest {
+    uint256 private constant AMOUNT = 10_000 * 1e6;
+    MockUSDC private token;
+    ClientActor private client;
+    FreelancerActor private freelancer;
+    ArbitratorActor private arbitrator;
+
+    function setUp() public {
+        token = new MockUSDC();
+        client = new ClientActor();
+        freelancer = new FreelancerActor();
+        arbitrator = new ArbitratorActor();
+        token.mint(address(client), AMOUNT);
+    }
+
+    function testClientCanFundAndRelease() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        require(token.balanceOf(address(escrow)) == AMOUNT, "not funded");
+        client.release(escrow);
+        require(token.balanceOf(address(freelancer)) == AMOUNT, "not paid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        freelancer.dispute(escrow);
+        arbitrator.resolve(escrow, 6_000 * 1e6);
+        require(token.balanceOf(address(freelancer)) == 6_000 * 1e6, "freelancer split");
+        require(token.balanceOf(address(client)) == 4_000 * 1e6, "client split");
+    }
+
+    function testRejectsAmountsOutsideBounds() public {
+        bool reverted;
+        try new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), 1_999 * 1e6) {} catch { reverted = true; }
+        require(reverted, "accepted low amount");
+    }
+
+    function _newEscrow() private returns (FreelanceEscrow) {
+        return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
+    }
+}

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..ae41d8566bec0b0b873e627937cb31e2c490e4df
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,12 @@
+# A funded deployer key. Never commit a real .env file.
+PRIVATE_KEY=
+# Base Sepolia testnet RPC URL, e.g. from Alchemy or Coinbase Developer Platform
+BASE_SEPOLIA_RPC_URL=
+
+# Base Sepolia test USDC address and the three job participants
+PAYMENT_TOKEN=
+CLIENT=
+FREELANCER=
+ARBITRATOR=
+# USDC has 6 decimals: $10,000 = 10000000000
+AMOUNT=10000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5e1f17233a1eb14c2eff5f353c51a7a48209e16
--- /dev/null
+++ b/README.md
@@ -0,0 +1,25 @@
+# Freelance Escrow
+
+A per-job, non-custodial escrow contract for a 6-decimal USD stablecoin such as USDC. It enforces a job amount from $2,000 to $50,000, lets the client fund and release payment, and lets either party open a dispute that an agreed arbitrator can settle (including a split).
+
+## Recommended deployment
+
+Deploy first to **Base Sepolia**. It is an inexpensive public testnet that closely matches Base, where low transaction fees make it a practical production destination for frequent escrow actions. After an independent security review and a full test cycle, deploy the same bytecode to **Base mainnet** with the official USDC address for that network. The price bounds rely on USDC maintaining its USD peg; use only a vetted, 6-decimal stablecoin address.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, fill in the participant addresses, token address, and `AMOUNT` (USDC units: `$2,000 = 2000000000`, `$50,000 = 50000000000`). Do not commit `.env`.
+3. Load the values and deploy to Base Sepolia:
+
+   ```sh
+   set -a; source .env; set +a
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
+   ```
+
+The client then approves `AMOUNT` USDC for the deployed escrow address and calls `fund()`. Once work is accepted, the client calls `release()`. Either side can call `raiseDispute()` while funded; only `ARBITRATOR` can call `resolveDispute(freelancerAmount)`.
+
+## Important
+
+This is a starting implementation, not production-ready legal or security infrastructure. Each contract escrows one job and has an immutable arbitrator. Before mainnet use, obtain an independent smart-contract audit, establish dispute and KYC/AML procedures, secure the arbitrator key (ideally a multisig), and verify official token addresses from the issuer.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7fa6609364085313ff3b0b466ce5e481f45f7ba6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3bed384148b865b5a396c27866089eb676f4a30a
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function envUint(string calldata name) external returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice `forge script` deployment entry point. All values come from environment variables.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        address client = vm.envAddress("CLIENT");
+        address freelancer = vm.envAddress("FREELANCER");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        uint256 amount = vm.envUint("AMOUNT");
+
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, client, freelancer, arbitrator, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d8dc84ebbbccc1ed323114b89f9c2e3b4a48f607
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,118 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+interface IERC20Metadata {
+    function decimals() external view returns (uint8);
+}
+
+/// @notice Non-custodial escrow for one USD-stablecoin-denominated freelance job.
+/// @dev Deploy one instance per job. This contract supports tokens with 6 decimals,
+///      e.g. USDC, so the $2,000-$50,000 limits can be expressed on-chain.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000 * 1e6;
+    uint256 public constant MAX_AMOUNT = 50_000 * 1e6;
+
+    enum Status { AwaitingFunding, Funded, Disputed, Released, Refunded, Resolved }
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidTokenDecimals(uint8 decimals);
+    error InvalidStatus(Status current);
+    error TransferFailed();
+    error IncorrectFundingAmount(uint256 received);
+    error InvalidSplit();
+
+    event Funded(address indexed client, uint256 amount);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event Resolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(address token_, address client_, address freelancer_, address arbitrator_, uint256 amount_) {
+        if (token_ == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (IERC20Metadata(token_).decimals() != 6) revert InvalidTokenDecimals(IERC20Metadata(token_).decimals());
+        if (client_ == freelancer_ || amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        paymentToken = IERC20(token_);
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+    }
+
+    /// @notice Client funds the job after approving exactly `amount` tokens.
+    function fund() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
+        if (received != amount) revert IncorrectFundingAmount(received);
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Client accepts delivered work and pays the freelancer.
+    function release() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Freelancer or client can signal a disagreement while funds are held.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator settles a dispute, optionally splitting the escrow.
+    /// @param freelancerAmount Amount sent to freelancer; the remainder goes to client.
+    function resolveDispute(uint256 freelancerAmount) external {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (freelancerAmount > amount) revert InvalidSplit();
+
+        status = Status.Resolved;
+        uint256 clientAmount = amount - freelancerAmount;
+        if (freelancerAmount != 0) _safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(client, clientAmount);
+        emit Resolved(freelancerAmount, clientAmount);
+    }
+
+    /// @notice Client can cancel an unfunded job. No token movement occurs.
+    function cancelUnfunded() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+        status = Status.Refunded;
+        emit Refunded(client, 0);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        if (!paymentToken.transfer(to, value)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        if (!paymentToken.transferFrom(from, to, value)) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..285494e1a81c3feb1a9a3cb3c5e18d4bde7b330e
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function decimals() external pure returns (uint8) { return 6; }
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        require(allowance[from][msg.sender] >= value, "allowance");
+        allowance[from][msg.sender] -= value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract ClientActor {
+    function approve(MockUSDC token, address escrow, uint256 amount) external { token.approve(escrow, amount); }
+    function fund(FreelanceEscrow escrow) external { escrow.fund(); }
+    function release(FreelanceEscrow escrow) external { escrow.release(); }
+    function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); }
+}
+
+contract FreelancerActor { function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); } }
+contract ArbitratorActor { function resolve(FreelanceEscrow escrow, uint256 amount) external { escrow.resolveDispute(amount); } }
+
+contract FreelanceEscrowTest {
+    uint256 private constant AMOUNT = 10_000 * 1e6;
+    MockUSDC private token;
+    ClientActor private client;
+    FreelancerActor private freelancer;
+    ArbitratorActor private arbitrator;
+
+    function setUp() public {
+        token = new MockUSDC();
+        client = new ClientActor();
+        freelancer = new FreelancerActor();
+        arbitrator = new ArbitratorActor();
+        token.mint(address(client), AMOUNT);
+    }
+
+    function testClientCanFundAndRelease() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        require(token.balanceOf(address(escrow)) == AMOUNT, "not funded");
+        client.release(escrow);
+        require(token.balanceOf(address(freelancer)) == AMOUNT, "not paid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        freelancer.dispute(escrow);
+        arbitrator.resolve(escrow, 6_000 * 1e6);
+        require(token.balanceOf(address(freelancer)) == 6_000 * 1e6, "freelancer split");
+        require(token.balanceOf(address(client)) == 4_000 * 1e6, "client split");
+    }
+
+    function testRejectsAmountsOutsideBounds() public {
+        bool reverted;
+        try new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), 1_999 * 1e6) {} catch { reverted = true; }
+        require(reverted, "accepted low amount");
+    }
+
+    function _newEscrow() private returns (FreelanceEscrow) {
+        return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
+    }
+}

exec
/bin/bash -lc 'forge test -vvv && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001
 succeeded in 255ms:
Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 190.30ms
Compiler run successful!

Ran 3 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbitratorCanSplitDispute() (gas: 747708)
[PASS] testClientCanFundAndRelease() (gas: 733649)
[PASS] testRejectsAmountsOutsideBounds() (gas: 46043)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 725.49µs (781.07µs CPU time)

Ran 1 test suite in 7.85ms (725.49µs CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)
?? .env.example
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..ae41d8566bec0b0b873e627937cb31e2c490e4df
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,12 @@
+# A funded deployer key. Never commit a real .env file.
+PRIVATE_KEY=
+# Base Sepolia testnet RPC URL, e.g. from Alchemy or Coinbase Developer Platform
+BASE_SEPOLIA_RPC_URL=
+
+# Base Sepolia test USDC address and the three job participants
+PAYMENT_TOKEN=
+CLIENT=
+FREELANCER=
+ARBITRATOR=
+# USDC has 6 decimals: $10,000 = 10000000000
+AMOUNT=10000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5e1f17233a1eb14c2eff5f353c51a7a48209e16
--- /dev/null
+++ b/README.md
@@ -0,0 +1,25 @@
+# Freelance Escrow
+
+A per-job, non-custodial escrow contract for a 6-decimal USD stablecoin such as USDC. It enforces a job amount from $2,000 to $50,000, lets the client fund and release payment, and lets either party open a dispute that an agreed arbitrator can settle (including a split).
+
+## Recommended deployment
+
+Deploy first to **Base Sepolia**. It is an inexpensive public testnet that closely matches Base, where low transaction fees make it a practical production destination for frequent escrow actions. After an independent security review and a full test cycle, deploy the same bytecode to **Base mainnet** with the official USDC address for that network. The price bounds rely on USDC maintaining its USD peg; use only a vetted, 6-decimal stablecoin address.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, fill in the participant addresses, token address, and `AMOUNT` (USDC units: `$2,000 = 2000000000`, `$50,000 = 50000000000`). Do not commit `.env`.
+3. Load the values and deploy to Base Sepolia:
+
+   ```sh
+   set -a; source .env; set +a
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
+   ```
+
+The client then approves `AMOUNT` USDC for the deployed escrow address and calls `fund()`. Once work is accepted, the client calls `release()`. Either side can call `raiseDispute()` while funded; only `ARBITRATOR` can call `resolveDispute(freelancerAmount)`.
+
+## Important
+
+This is a starting implementation, not production-ready legal or security infrastructure. Each contract escrows one job and has an immutable arbitrator. Before mainnet use, obtain an independent smart-contract audit, establish dispute and KYC/AML procedures, secure the arbitrator key (ideally a multisig), and verify official token addresses from the issuer.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7fa6609364085313ff3b0b466ce5e481f45f7ba6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3bed384148b865b5a396c27866089eb676f4a30a
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function envUint(string calldata name) external returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice `forge script` deployment entry point. All values come from environment variables.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        address client = vm.envAddress("CLIENT");
+        address freelancer = vm.envAddress("FREELANCER");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        uint256 amount = vm.envUint("AMOUNT");
+
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, client, freelancer, arbitrator, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d8dc84ebbbccc1ed323114b89f9c2e3b4a48f607
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,118 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+interface IERC20Metadata {
+    function decimals() external view returns (uint8);
+}
+
+/// @notice Non-custodial escrow for one USD-stablecoin-denominated freelance job.
+/// @dev Deploy one instance per job. This contract supports tokens with 6 decimals,
+///      e.g. USDC, so the $2,000-$50,000 limits can be expressed on-chain.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000 * 1e6;
+    uint256 public constant MAX_AMOUNT = 50_000 * 1e6;
+
+    enum Status { AwaitingFunding, Funded, Disputed, Released, Refunded, Resolved }
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidTokenDecimals(uint8 decimals);
+    error InvalidStatus(Status current);
+    error TransferFailed();
+    error IncorrectFundingAmount(uint256 received);
+    error InvalidSplit();
+
+    event Funded(address indexed client, uint256 amount);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event Resolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(address token_, address client_, address freelancer_, address arbitrator_, uint256 amount_) {
+        if (token_ == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (IERC20Metadata(token_).decimals() != 6) revert InvalidTokenDecimals(IERC20Metadata(token_).decimals());
+        if (client_ == freelancer_ || amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        paymentToken = IERC20(token_);
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+    }
+
+    /// @notice Client funds the job after approving exactly `amount` tokens.
+    function fund() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
+        if (received != amount) revert IncorrectFundingAmount(received);
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Client accepts delivered work and pays the freelancer.
+    function release() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Freelancer or client can signal a disagreement while funds are held.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator settles a dispute, optionally splitting the escrow.
+    /// @param freelancerAmount Amount sent to freelancer; the remainder goes to client.
+    function resolveDispute(uint256 freelancerAmount) external {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (freelancerAmount > amount) revert InvalidSplit();
+
+        status = Status.Resolved;
+        uint256 clientAmount = amount - freelancerAmount;
+        if (freelancerAmount != 0) _safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(client, clientAmount);
+        emit Resolved(freelancerAmount, clientAmount);
+    }
+
+    /// @notice Client can cancel an unfunded job. No token movement occurs.
+    function cancelUnfunded() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+        status = Status.Refunded;
+        emit Refunded(client, 0);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        if (!paymentToken.transfer(to, value)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        if (!paymentToken.transferFrom(from, to, value)) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..285494e1a81c3feb1a9a3cb3c5e18d4bde7b330e
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function decimals() external pure returns (uint8) { return 6; }
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        require(allowance[from][msg.sender] >= value, "allowance");
+        allowance[from][msg.sender] -= value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract ClientActor {
+    function approve(MockUSDC token, address escrow, uint256 amount) external { token.approve(escrow, amount); }
+    function fund(FreelanceEscrow escrow) external { escrow.fund(); }
+    function release(FreelanceEscrow escrow) external { escrow.release(); }
+    function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); }
+}
+
+contract FreelancerActor { function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); } }
+contract ArbitratorActor { function resolve(FreelanceEscrow escrow, uint256 amount) external { escrow.resolveDispute(amount); } }
+
+contract FreelanceEscrowTest {
+    uint256 private constant AMOUNT = 10_000 * 1e6;
+    MockUSDC private token;
+    ClientActor private client;
+    FreelancerActor private freelancer;
+    ArbitratorActor private arbitrator;
+
+    function setUp() public {
+        token = new MockUSDC();
+        client = new ClientActor();
+        freelancer = new FreelancerActor();
+        arbitrator = new ArbitratorActor();
+        token.mint(address(client), AMOUNT);
+    }
+
+    function testClientCanFundAndRelease() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        require(token.balanceOf(address(escrow)) == AMOUNT, "not funded");
+        client.release(escrow);
+        require(token.balanceOf(address(freelancer)) == AMOUNT, "not paid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        freelancer.dispute(escrow);
+        arbitrator.resolve(escrow, 6_000 * 1e6);
+        require(token.balanceOf(address(freelancer)) == 6_000 * 1e6, "freelancer split");
+        require(token.balanceOf(address(client)) == 4_000 * 1e6, "client split");
+    }
+
+    function testRejectsAmountsOutsideBounds() public {
+        bool reverted;
+        try new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), 1_999 * 1e6) {} catch { reverted = true; }
+        require(reverted, "accepted low amount");
+    }
+
+    function _newEscrow() private returns (FreelanceEscrow) {
+        return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
+    }
+}

codex
Implemented a deployable Foundry escrow project.

- Contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/src/FreelanceEscrow.sol)
- Deploy script: [DeployFreelanceEscrow.s.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/script/DeployFreelanceEscrow.s.sol)
- Setup/deployment guide: [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/README.md)
- Environment template: [.env.example](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/.env.example)

It uses 6-decimal USDC-style tokens, enforces $2,000–$50,000 per job, supports funding, release, dispute, and arbitrator-settled splits. I recommend Base Sepolia first, then Base mainnet only after audit and operational review.

Verified with `forge test`: 3 passing tests.
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..ae41d8566bec0b0b873e627937cb31e2c490e4df
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,12 @@
+# A funded deployer key. Never commit a real .env file.
+PRIVATE_KEY=
+# Base Sepolia testnet RPC URL, e.g. from Alchemy or Coinbase Developer Platform
+BASE_SEPOLIA_RPC_URL=
+
+# Base Sepolia test USDC address and the three job participants
+PAYMENT_TOKEN=
+CLIENT=
+FREELANCER=
+ARBITRATOR=
+# USDC has 6 decimals: $10,000 = 10000000000
+AMOUNT=10000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5e1f17233a1eb14c2eff5f353c51a7a48209e16
--- /dev/null
+++ b/README.md
@@ -0,0 +1,25 @@
+# Freelance Escrow
+
+A per-job, non-custodial escrow contract for a 6-decimal USD stablecoin such as USDC. It enforces a job amount from $2,000 to $50,000, lets the client fund and release payment, and lets either party open a dispute that an agreed arbitrator can settle (including a split).
+
+## Recommended deployment
+
+Deploy first to **Base Sepolia**. It is an inexpensive public testnet that closely matches Base, where low transaction fees make it a practical production destination for frequent escrow actions. After an independent security review and a full test cycle, deploy the same bytecode to **Base mainnet** with the official USDC address for that network. The price bounds rely on USDC maintaining its USD peg; use only a vetted, 6-decimal stablecoin address.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, fill in the participant addresses, token address, and `AMOUNT` (USDC units: `$2,000 = 2000000000`, `$50,000 = 50000000000`). Do not commit `.env`.
+3. Load the values and deploy to Base Sepolia:
+
+   ```sh
+   set -a; source .env; set +a
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
+   ```
+
+The client then approves `AMOUNT` USDC for the deployed escrow address and calls `fund()`. Once work is accepted, the client calls `release()`. Either side can call `raiseDispute()` while funded; only `ARBITRATOR` can call `resolveDispute(freelancerAmount)`.
+
+## Important
+
+This is a starting implementation, not production-ready legal or security infrastructure. Each contract escrows one job and has an immutable arbitrator. Before mainnet use, obtain an independent smart-contract audit, establish dispute and KYC/AML procedures, secure the arbitrator key (ideally a multisig), and verify official token addresses from the issuer.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7fa6609364085313ff3b0b466ce5e481f45f7ba6
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3bed384148b865b5a396c27866089eb676f4a30a
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,28 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function envUint(string calldata name) external returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice `forge script` deployment entry point. All values come from environment variables.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        address client = vm.envAddress("CLIENT");
+        address freelancer = vm.envAddress("FREELANCER");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        uint256 amount = vm.envUint("AMOUNT");
+
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, client, freelancer, arbitrator, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d8dc84ebbbccc1ed323114b89f9c2e3b4a48f607
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,118 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+interface IERC20Metadata {
+    function decimals() external view returns (uint8);
+}
+
+/// @notice Non-custodial escrow for one USD-stablecoin-denominated freelance job.
+/// @dev Deploy one instance per job. This contract supports tokens with 6 decimals,
+///      e.g. USDC, so the $2,000-$50,000 limits can be expressed on-chain.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000 * 1e6;
+    uint256 public constant MAX_AMOUNT = 50_000 * 1e6;
+
+    enum Status { AwaitingFunding, Funded, Disputed, Released, Refunded, Resolved }
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidTokenDecimals(uint8 decimals);
+    error InvalidStatus(Status current);
+    error TransferFailed();
+    error IncorrectFundingAmount(uint256 received);
+    error InvalidSplit();
+
+    event Funded(address indexed client, uint256 amount);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event Resolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(address token_, address client_, address freelancer_, address arbitrator_, uint256 amount_) {
+        if (token_ == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (IERC20Metadata(token_).decimals() != 6) revert InvalidTokenDecimals(IERC20Metadata(token_).decimals());
+        if (client_ == freelancer_ || amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        paymentToken = IERC20(token_);
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+    }
+
+    /// @notice Client funds the job after approving exactly `amount` tokens.
+    function fund() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
+        if (received != amount) revert IncorrectFundingAmount(received);
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Client accepts delivered work and pays the freelancer.
+    function release() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Freelancer or client can signal a disagreement while funds are held.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator settles a dispute, optionally splitting the escrow.
+    /// @param freelancerAmount Amount sent to freelancer; the remainder goes to client.
+    function resolveDispute(uint256 freelancerAmount) external {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (freelancerAmount > amount) revert InvalidSplit();
+
+        status = Status.Resolved;
+        uint256 clientAmount = amount - freelancerAmount;
+        if (freelancerAmount != 0) _safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(client, clientAmount);
+        emit Resolved(freelancerAmount, clientAmount);
+    }
+
+    /// @notice Client can cancel an unfunded job. No token movement occurs.
+    function cancelUnfunded() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
+        status = Status.Refunded;
+        emit Refunded(client, 0);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        if (!paymentToken.transfer(to, value)) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        if (!paymentToken.transferFrom(from, to, value)) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..285494e1a81c3feb1a9a3cb3c5e18d4bde7b330e
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function decimals() external pure returns (uint8) { return 6; }
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        require(allowance[from][msg.sender] >= value, "allowance");
+        allowance[from][msg.sender] -= value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract ClientActor {
+    function approve(MockUSDC token, address escrow, uint256 amount) external { token.approve(escrow, amount); }
+    function fund(FreelanceEscrow escrow) external { escrow.fund(); }
+    function release(FreelanceEscrow escrow) external { escrow.release(); }
+    function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); }
+}
+
+contract FreelancerActor { function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); } }
+contract ArbitratorActor { function resolve(FreelanceEscrow escrow, uint256 amount) external { escrow.resolveDispute(amount); } }
+
+contract FreelanceEscrowTest {
+    uint256 private constant AMOUNT = 10_000 * 1e6;
+    MockUSDC private token;
+    ClientActor private client;
+    FreelancerActor private freelancer;
+    ArbitratorActor private arbitrator;
+
+    function setUp() public {
+        token = new MockUSDC();
+        client = new ClientActor();
+        freelancer = new FreelancerActor();
+        arbitrator = new ArbitratorActor();
+        token.mint(address(client), AMOUNT);
+    }
+
+    function testClientCanFundAndRelease() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        require(token.balanceOf(address(escrow)) == AMOUNT, "not funded");
+        client.release(escrow);
+        require(token.balanceOf(address(freelancer)) == AMOUNT, "not paid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        FreelanceEscrow escrow = _newEscrow();
+        client.approve(token, address(escrow), AMOUNT);
+        client.fund(escrow);
+        freelancer.dispute(escrow);
+        arbitrator.resolve(escrow, 6_000 * 1e6);
+        require(token.balanceOf(address(freelancer)) == 6_000 * 1e6, "freelancer split");
+        require(token.balanceOf(address(client)) == 4_000 * 1e6, "client split");
+    }
+
+    function testRejectsAmountsOutsideBounds() public {
+        bool reverted;
+        try new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), 1_999 * 1e6) {} catch { reverted = true; }
+        require(reverted, "accepted low amount");
+    }
+
+    function _newEscrow() private returns (FreelanceEscrow) {
+        return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
+    }
+}

tokens used
20,967
````

## final message

Implemented a deployable Foundry escrow project.

- Contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/src/FreelanceEscrow.sol)
- Deploy script: [DeployFreelanceEscrow.s.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/script/DeployFreelanceEscrow.s.sol)
- Setup/deployment guide: [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/README.md)
- Environment template: [.env.example](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234411Z-codex-no-skill-2/gas-goal-001/.env.example)

It uses 6-decimal USDC-style tokens, enforces $2,000–$50,000 per job, supports funding, release, dispute, and arbitrator-settled splits. I recommend Base Sepolia first, then Base mainnet only after audit and operational review.

Verified with `forge test`: 3 passing tests.

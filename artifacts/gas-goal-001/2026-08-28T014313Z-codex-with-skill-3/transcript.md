# Executor transcript — 2026-08-28T014313Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a04609-15bb-7843-9083-fb2ed379d744
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.

2026-08-28T01:43:15.842594Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a04609-15bb-7843-9083-fb2ed379d744.tmp-1787881395652673619: line 2547: syntax error near unexpected token `('

codex
I’ll build a focused Solidity escrow project with deployment tooling and a concise deployment guide. Since selecting a network and discussing deployment costs is part of the request, I’m using the gas guidance skill to make that recommendation accurately.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/gas/SKILL.md && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!cache'"'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001
 exited 1 in 0ms:
exec
/bin/bash -lc "rg --files -g '"'!node_modules'"' -g '"'!cache'"' -g '"'!out'"' | sed -n '1,240p'; git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
TASK.md
package.json

exec
/bin/bash -lc "sed -n '1,240p' TASK.md; sed -n '1,200p' package.json; command -v forge || true; command -v npx || true; find . -maxdepth 2 -name AGENTS.md -print" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.
{
  "name": "eval-workspace",
  "private": true
}
/home/damu/.foundry/bin/forge
/home/damu/.nvm/versions/node/v22.22.2/bin/npx

codex
The workspace is intentionally minimal, so I’m setting this up as a self-contained Foundry project. I’ll make payments ERC-20 based (USDC-oriented) rather than native ETH, keeping the $2,000–$50,000 bounds enforceable in token units and avoiding price-oracle risk.
exec
/bin/bash -lc "set -o pipefail
printf 'base gas price (wei): '; cast gas-price --rpc-url https://mainnet.base.org
printf 'base base fee (wei): '; cast base-fee --rpc-url https://mainnet.base.org
printf 'ethereum gas price (wei): '; cast gas-price --rpc-url https://ethereum-rpc.publicnode.com
curl -fsSL --max-time 15 'https://api.coinbase.com/v2/prices/ETH-USD/spot' | sed -n '1,2p'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001
 succeeded in 1839ms:
6000000
base base fee (wei): 5000000
ethereum gas price (wei): 56249696
{"data":{"amount":"2520.375","base":"ETH","currency":"USD"}}
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/README.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/script/Deploy.s.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/src/FreelanceEscrowFactory.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/src/interfaces/IERC20.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/src/libraries/SafeERC20.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/test/FreelanceEscrow.t.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/test/MockUSDC.sol
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..2404155eedccae2317fd44a1c4fe52d7781b13d3
--- /dev/null
+++ b/README.md
@@ -0,0 +1,31 @@
+# Freelance Escrow
+
+An ERC-20 escrow for individual freelance jobs. The client creates a job, funds it, the freelancer submits delivery, and the client releases payment. Either party can send a delivered job to a pre-selected arbitrator, who may split the funds. The factory enforces a $2,000–$50,000 range when used with a USD-stable 6-decimal token such as USDC.
+
+## Deploy
+
+This is a [Foundry](https://book.getfoundry.sh/) project. Install Foundry, then run:
+
+```bash
+forge build
+forge test
+export RPC_URL="https://mainnet.base.org"
+export PRIVATE_KEY="..."       # deployer key; do not commit it
+export ARBITRATOR="0x..."      # independent, secured arbitration wallet/multisig
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+The script defaults to Base mainnet native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) and sets the bounds to `2_000e6` and `50_000e6`. To deploy against another compatible 6-decimal token, set `PAYMENT_TOKEN` before the final command. Start by testing the exact configuration on Base Sepolia with a test token; do not use its USDC address on mainnet.
+
+## Recommended network
+
+Deploy production on **Base mainnet**, using native USDC. It is EVM-compatible, has broad wallet and USDC support, and makes a practical payment rail for job-sized stablecoin escrows. A live check on 2026-08-27 returned a Base gas price of 6,000,000 wei (0.006 gwei), versus 56,249,696 wei (0.056249696 gwei) on Ethereum mainnet; fees should always be re-measured immediately before deployment rather than copied from this document.
+
+## Operating a job
+
+1. Client calls `createEscrow(freelancer, amount, jobReference)` on the factory.
+2. Client approves the newly created escrow for `amount`, then calls `fund()`.
+3. Freelancer calls `submitWork(deliverableReference)`.
+4. Client calls `release()`, or either side calls `raiseDispute()` and the arbitrator calls `resolveDispute(freelancerAmount)`.
+
+`jobReference` and `deliverableReference` are hashes: store the signed agreement and delivery evidence off-chain (or hash a stable URI). This code has not been audited. Before holding real customer funds, commission an independent security audit, use a multisig for arbitration, establish terms/dispute procedures, and obtain legal/compliance advice for your operating jurisdictions.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..be1cd37c77870c1195be7291bd78ee6615396bae
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+# Base mainnet / Sepolia use Cancun-compatible EVM rules.
+evm_version = "cancun"
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7524bf0ced7d530eb7cdddd000cc6cc84076fdba
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC (6 decimals). Override for a testnet/token deployment.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    function run() external returns (FreelanceEscrowFactory factory) {
+        address token = vmEnvOr("PAYMENT_TOKEN", BASE_USDC);
+        address arbitrator = vmEnvAddress("ARBITRATOR");
+        vm.startBroadcast();
+        factory = new FreelanceEscrowFactory(IERC20(token), arbitrator, 2_000 * USDC_SCALE, 50_000 * USDC_SCALE);
+        vm.stopBroadcast();
+    }
+
+    // Kept here to make the required environment variables explicit without importing forge-std.
+    function vmEnvAddress(string memory name) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envAddress(string)", name));
+        require(ok, "missing ARBITRATOR");
+        value = abi.decode(data, (address));
+    }
+
+    function vmEnvOr(string memory name, address fallbackValue) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envOr(string,address)", name, fallbackValue));
+        require(ok, "invalid PAYMENT_TOKEN");
+        value = abi.decode(data, (address));
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bd16c2804c45cc459ebbda962f1e5fe4ef72877c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,142 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice One funded freelance job, settled by client approval or a neutral arbitrator.
+/// @dev The factory creates an instance per job. Amounts are token base units.
+contract FreelanceEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status { AwaitingFunding, Funded, Submitted, Disputed, Released, Refunded, Resolved }
+
+    error NotClient();
+    error NotFreelancer();
+    error NotArbitrator();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status expected, Status actual);
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    bool private locked;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkSubmitted(bytes32 indexed deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event DisputeResolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert NotClient();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert NotFreelancer();
+        _;
+    }
+
+    modifier onlyArbitrator() {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 paymentToken_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobReference_
+    ) {
+        if (
+            address(paymentToken_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+
+        paymentToken = paymentToken_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobReference = jobReference_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Client transfers the exact agreed amount after approving this contract.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
+        // Reject fee-on-transfer tokens: an escrow must be fully collateralized.
+        if (paymentToken.balanceOf(address(this)) != beforeBalance + amount) revert InvalidAmount();
+        status = Status.Funded;
+        emit Funded(msg.sender, amount);
+    }
+
+    /// @notice Freelancer marks delivery complete; client can now approve or dispute.
+    function submitWork(bytes32 deliverableReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Submitted;
+        emit WorkSubmitted(deliverableReference);
+    }
+
+    /// @notice Client accepts the delivery and pays the freelancer in full.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Submitted);
+        status = Status.Released;
+        paymentToken.safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client cancels before a delivery is submitted.
+    function refundBeforeSubmission() external onlyClient nonReentrant {
+        _requireStatus(Status.Funded);
+        status = Status.Refunded;
+        paymentToken.safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either party sends a submitted job to arbitration.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert NotClient();
+        _requireStatus(Status.Submitted);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator splits the held funds; the split must total the escrow amount.
+    function resolveDispute(uint256 freelancerAmount) external onlyArbitrator nonReentrant {
+        _requireStatus(Status.Disputed);
+        if (freelancerAmount > amount) revert InvalidAmount();
+
+        uint256 clientAmount = amount - freelancerAmount;
+        status = Status.Resolved;
+        if (freelancerAmount != 0) paymentToken.safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) paymentToken.safeTransfer(client, clientAmount);
+        emit DisputeResolved(freelancerAmount, clientAmount);
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
diff --git a/src/FreelanceEscrowFactory.sol b/src/FreelanceEscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..672ee2441a499f6db17615b850ebb73a04e60831
--- /dev/null
+++ b/src/FreelanceEscrowFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys USDC-denominated freelance escrows with the product's $2k–$50k bounds.
+contract FreelanceEscrowFactory {
+    error InvalidAddress();
+    error AmountOutOfBounds();
+
+    IERC20 public immutable paymentToken;
+    address public immutable arbitrator;
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+
+    event EscrowCreated(address indexed escrow, address indexed client, address indexed freelancer, uint256 amount, bytes32 jobReference);
+
+    constructor(IERC20 paymentToken_, address arbitrator_, uint256 minAmount_, uint256 maxAmount_) {
+        if (address(paymentToken_) == address(0) || arbitrator_ == address(0)) revert InvalidAddress();
+        if (minAmount_ == 0 || minAmount_ > maxAmount_) revert AmountOutOfBounds();
+        paymentToken = paymentToken_;
+        arbitrator = arbitrator_;
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, bytes32 jobReference)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        if (amount < minAmount || amount > maxAmount) revert AmountOutOfBounds();
+        escrow = new FreelanceEscrow(paymentToken, msg.sender, freelancer, arbitrator, amount, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, jobReference);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2df66b455c1b74bbed837f1562168832ff014d24
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e69da35eb1068b823700c2f63c8efc3f7263217e
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+/// @notice Minimal safe wrappers that support both standard and no-return ERC-20s.
+library SafeERC20 {
+    error ERC20CallFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transfer, (to, amount)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+    }
+
+    function _call(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returnedData) = address(token).call(data);
+        if (!success || (returnedData.length != 0 && !abi.decode(returnedData, (bool)))) {
+            revert ERC20CallFailed();
+        }
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00d26c112f649258b392703d8a26f455774d3bf7
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,48 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm { function prank(address) external; function expectRevert() external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF1EE1A);
+    address private constant ARBITRATOR = address(0xA8B17);
+    uint256 private constant AMOUNT = 10_000e6;
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITRATOR, AMOUNT, keccak256("job-1"));
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+    }
+
+    function testReleaseAfterSubmission() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer unpaid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.raiseDispute();
+        vm.prank(ARBITRATOR); escrow.resolveDispute(6_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6, "incorrect freelancer split");
+        require(token.balanceOf(CLIENT) == 4_000e6, "incorrect client split");
+    }
+
+    function testFactoryRejectsOutOfRangeJobs() public {
+        FreelanceEscrowFactory factory = new FreelanceEscrowFactory(token, ARBITRATOR, 2_000e6, 50_000e6);
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 1_999e6, bytes32(0));
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 50_001e6, bytes32(0));
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9fa214d9cc804eca8b7fcd11add4c1febbadb984
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}

diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..2404155eedccae2317fd44a1c4fe52d7781b13d3
--- /dev/null
+++ b/README.md
@@ -0,0 +1,31 @@
+# Freelance Escrow
+
+An ERC-20 escrow for individual freelance jobs. The client creates a job, funds it, the freelancer submits delivery, and the client releases payment. Either party can send a delivered job to a pre-selected arbitrator, who may split the funds. The factory enforces a $2,000–$50,000 range when used with a USD-stable 6-decimal token such as USDC.
+
+## Deploy
+
+This is a [Foundry](https://book.getfoundry.sh/) project. Install Foundry, then run:
+
+```bash
+forge build
+forge test
+export RPC_URL="https://mainnet.base.org"
+export PRIVATE_KEY="..."       # deployer key; do not commit it
+export ARBITRATOR="0x..."      # independent, secured arbitration wallet/multisig
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+The script defaults to Base mainnet native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) and sets the bounds to `2_000e6` and `50_000e6`. To deploy against another compatible 6-decimal token, set `PAYMENT_TOKEN` before the final command. Start by testing the exact configuration on Base Sepolia with a test token; do not use its USDC address on mainnet.
+
+## Recommended network
+
+Deploy production on **Base mainnet**, using native USDC. It is EVM-compatible, has broad wallet and USDC support, and makes a practical payment rail for job-sized stablecoin escrows. A live check on 2026-08-27 returned a Base gas price of 6,000,000 wei (0.006 gwei), versus 56,249,696 wei (0.056249696 gwei) on Ethereum mainnet; fees should always be re-measured immediately before deployment rather than copied from this document.
+
+## Operating a job
+
+1. Client calls `createEscrow(freelancer, amount, jobReference)` on the factory.
+2. Client approves the newly created escrow for `amount`, then calls `fund()`.
+3. Freelancer calls `submitWork(deliverableReference)`.
+4. Client calls `release()`, or either side calls `raiseDispute()` and the arbitrator calls `resolveDispute(freelancerAmount)`.
+
+`jobReference` and `deliverableReference` are hashes: store the signed agreement and delivery evidence off-chain (or hash a stable URI). This code has not been audited. Before holding real customer funds, commission an independent security audit, use a multisig for arbitration, establish terms/dispute procedures, and obtain legal/compliance advice for your operating jurisdictions.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..be1cd37c77870c1195be7291bd78ee6615396bae
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+# Base mainnet / Sepolia use Cancun-compatible EVM rules.
+evm_version = "cancun"
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7524bf0ced7d530eb7cdddd000cc6cc84076fdba
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC (6 decimals). Override for a testnet/token deployment.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    function run() external returns (FreelanceEscrowFactory factory) {
+        address token = vmEnvOr("PAYMENT_TOKEN", BASE_USDC);
+        address arbitrator = vmEnvAddress("ARBITRATOR");
+        vm.startBroadcast();
+        factory = new FreelanceEscrowFactory(IERC20(token), arbitrator, 2_000 * USDC_SCALE, 50_000 * USDC_SCALE);
+        vm.stopBroadcast();
+    }
+
+    // Kept here to make the required environment variables explicit without importing forge-std.
+    function vmEnvAddress(string memory name) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envAddress(string)", name));
+        require(ok, "missing ARBITRATOR");
+        value = abi.decode(data, (address));
+    }
+
+    function vmEnvOr(string memory name, address fallbackValue) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envOr(string,address)", name, fallbackValue));
+        require(ok, "invalid PAYMENT_TOKEN");
+        value = abi.decode(data, (address));
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bd16c2804c45cc459ebbda962f1e5fe4ef72877c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,142 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice One funded freelance job, settled by client approval or a neutral arbitrator.
+/// @dev The factory creates an instance per job. Amounts are token base units.
+contract FreelanceEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status { AwaitingFunding, Funded, Submitted, Disputed, Released, Refunded, Resolved }
+
+    error NotClient();
+    error NotFreelancer();
+    error NotArbitrator();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status expected, Status actual);
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    bool private locked;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkSubmitted(bytes32 indexed deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event DisputeResolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert NotClient();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert NotFreelancer();
+        _;
+    }
+
+    modifier onlyArbitrator() {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 paymentToken_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobReference_
+    ) {
+        if (
+            address(paymentToken_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+
+        paymentToken = paymentToken_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobReference = jobReference_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Client transfers the exact agreed amount after approving this contract.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
+        // Reject fee-on-transfer tokens: an escrow must be fully collateralized.
+        if (paymentToken.balanceOf(address(this)) != beforeBalance + amount) revert InvalidAmount();
+        status = Status.Funded;
+        emit Funded(msg.sender, amount);
+    }
+
+    /// @notice Freelancer marks delivery complete; client can now approve or dispute.
+    function submitWork(bytes32 deliverableReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Submitted;
+        emit WorkSubmitted(deliverableReference);
+    }
+
+    /// @notice Client accepts the delivery and pays the freelancer in full.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Submitted);
+        status = Status.Released;
+        paymentToken.safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client cancels before a delivery is submitted.
+    function refundBeforeSubmission() external onlyClient nonReentrant {
+        _requireStatus(Status.Funded);
+        status = Status.Refunded;
+        paymentToken.safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either party sends a submitted job to arbitration.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert NotClient();
+        _requireStatus(Status.Submitted);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator splits the held funds; the split must total the escrow amount.
+    function resolveDispute(uint256 freelancerAmount) external onlyArbitrator nonReentrant {
+        _requireStatus(Status.Disputed);
+        if (freelancerAmount > amount) revert InvalidAmount();
+
+        uint256 clientAmount = amount - freelancerAmount;
+        status = Status.Resolved;
+        if (freelancerAmount != 0) paymentToken.safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) paymentToken.safeTransfer(client, clientAmount);
+        emit DisputeResolved(freelancerAmount, clientAmount);
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
diff --git a/src/FreelanceEscrowFactory.sol b/src/FreelanceEscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..672ee2441a499f6db17615b850ebb73a04e60831
--- /dev/null
+++ b/src/FreelanceEscrowFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys USDC-denominated freelance escrows with the product's $2k–$50k bounds.
+contract FreelanceEscrowFactory {
+    error InvalidAddress();
+    error AmountOutOfBounds();
+
+    IERC20 public immutable paymentToken;
+    address public immutable arbitrator;
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+
+    event EscrowCreated(address indexed escrow, address indexed client, address indexed freelancer, uint256 amount, bytes32 jobReference);
+
+    constructor(IERC20 paymentToken_, address arbitrator_, uint256 minAmount_, uint256 maxAmount_) {
+        if (address(paymentToken_) == address(0) || arbitrator_ == address(0)) revert InvalidAddress();
+        if (minAmount_ == 0 || minAmount_ > maxAmount_) revert AmountOutOfBounds();
+        paymentToken = paymentToken_;
+        arbitrator = arbitrator_;
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, bytes32 jobReference)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        if (amount < minAmount || amount > maxAmount) revert AmountOutOfBounds();
+        escrow = new FreelanceEscrow(paymentToken, msg.sender, freelancer, arbitrator, amount, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, jobReference);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2df66b455c1b74bbed837f1562168832ff014d24
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e69da35eb1068b823700c2f63c8efc3f7263217e
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+/// @notice Minimal safe wrappers that support both standard and no-return ERC-20s.
+library SafeERC20 {
+    error ERC20CallFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transfer, (to, amount)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+    }
+
+    function _call(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returnedData) = address(token).call(data);
+        if (!success || (returnedData.length != 0 && !abi.decode(returnedData, (bool)))) {
+            revert ERC20CallFailed();
+        }
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00d26c112f649258b392703d8a26f455774d3bf7
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,48 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm { function prank(address) external; function expectRevert() external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF1EE1A);
+    address private constant ARBITRATOR = address(0xA8B17);
+    uint256 private constant AMOUNT = 10_000e6;
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITRATOR, AMOUNT, keccak256("job-1"));
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+    }
+
+    function testReleaseAfterSubmission() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer unpaid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.raiseDispute();
+        vm.prank(ARBITRATOR); escrow.resolveDispute(6_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6, "incorrect freelancer split");
+        require(token.balanceOf(CLIENT) == 4_000e6, "incorrect client split");
+    }
+
+    function testFactoryRejectsOutOfRangeJobs() public {
+        FreelanceEscrowFactory factory = new FreelanceEscrowFactory(token, ARBITRATOR, 2_000e6, 50_000e6);
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 1_999e6, bytes32(0));
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 50_001e6, bytes32(0));
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9fa214d9cc804eca8b7fcd11add4c1febbadb984
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}

exec
/bin/bash -lc 'forge fmt --check && forge build && forge test -vvv' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001
 exited 1 in 1ms:
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..2404155eedccae2317fd44a1c4fe52d7781b13d3
--- /dev/null
+++ b/README.md
@@ -0,0 +1,31 @@
+# Freelance Escrow
+
+An ERC-20 escrow for individual freelance jobs. The client creates a job, funds it, the freelancer submits delivery, and the client releases payment. Either party can send a delivered job to a pre-selected arbitrator, who may split the funds. The factory enforces a $2,000–$50,000 range when used with a USD-stable 6-decimal token such as USDC.
+
+## Deploy
+
+This is a [Foundry](https://book.getfoundry.sh/) project. Install Foundry, then run:
+
+```bash
+forge build
+forge test
+export RPC_URL="https://mainnet.base.org"
+export PRIVATE_KEY="..."       # deployer key; do not commit it
+export ARBITRATOR="0x..."      # independent, secured arbitration wallet/multisig
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+The script defaults to Base mainnet native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) and sets the bounds to `2_000e6` and `50_000e6`. To deploy against another compatible 6-decimal token, set `PAYMENT_TOKEN` before the final command. Start by testing the exact configuration on Base Sepolia with a test token; do not use its USDC address on mainnet.
+
+## Recommended network
+
+Deploy production on **Base mainnet**, using native USDC. It is EVM-compatible, has broad wallet and USDC support, and makes a practical payment rail for job-sized stablecoin escrows. A live check on 2026-08-27 returned a Base gas price of 6,000,000 wei (0.006 gwei), versus 56,249,696 wei (0.056249696 gwei) on Ethereum mainnet; fees should always be re-measured immediately before deployment rather than copied from this document.
+
+## Operating a job
+
+1. Client calls `createEscrow(freelancer, amount, jobReference)` on the factory.
+2. Client approves the newly created escrow for `amount`, then calls `fund()`.
+3. Freelancer calls `submitWork(deliverableReference)`.
+4. Client calls `release()`, or either side calls `raiseDispute()` and the arbitrator calls `resolveDispute(freelancerAmount)`.
+
+`jobReference` and `deliverableReference` are hashes: store the signed agreement and delivery evidence off-chain (or hash a stable URI). This code has not been audited. Before holding real customer funds, commission an independent security audit, use a multisig for arbitration, establish terms/dispute procedures, and obtain legal/compliance advice for your operating jurisdictions.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..be1cd37c77870c1195be7291bd78ee6615396bae
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+# Base mainnet / Sepolia use Cancun-compatible EVM rules.
+evm_version = "cancun"
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7524bf0ced7d530eb7cdddd000cc6cc84076fdba
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC (6 decimals). Override for a testnet/token deployment.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    function run() external returns (FreelanceEscrowFactory factory) {
+        address token = vmEnvOr("PAYMENT_TOKEN", BASE_USDC);
+        address arbitrator = vmEnvAddress("ARBITRATOR");
+        vm.startBroadcast();
+        factory = new FreelanceEscrowFactory(IERC20(token), arbitrator, 2_000 * USDC_SCALE, 50_000 * USDC_SCALE);
+        vm.stopBroadcast();
+    }
+
+    // Kept here to make the required environment variables explicit without importing forge-std.
+    function vmEnvAddress(string memory name) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envAddress(string)", name));
+        require(ok, "missing ARBITRATOR");
+        value = abi.decode(data, (address));
+    }
+
+    function vmEnvOr(string memory name, address fallbackValue) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envOr(string,address)", name, fallbackValue));
+        require(ok, "invalid PAYMENT_TOKEN");
+        value = abi.decode(data, (address));
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bd16c2804c45cc459ebbda962f1e5fe4ef72877c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,142 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice One funded freelance job, settled by client approval or a neutral arbitrator.
+/// @dev The factory creates an instance per job. Amounts are token base units.
+contract FreelanceEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status { AwaitingFunding, Funded, Submitted, Disputed, Released, Refunded, Resolved }
+
+    error NotClient();
+    error NotFreelancer();
+    error NotArbitrator();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status expected, Status actual);
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    bool private locked;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkSubmitted(bytes32 indexed deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event DisputeResolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert NotClient();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert NotFreelancer();
+        _;
+    }
+
+    modifier onlyArbitrator() {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 paymentToken_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobReference_
+    ) {
+        if (
+            address(paymentToken_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+
+        paymentToken = paymentToken_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobReference = jobReference_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Client transfers the exact agreed amount after approving this contract.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
+        // Reject fee-on-transfer tokens: an escrow must be fully collateralized.
+        if (paymentToken.balanceOf(address(this)) != beforeBalance + amount) revert InvalidAmount();
+        status = Status.Funded;
+        emit Funded(msg.sender, amount);
+    }
+
+    /// @notice Freelancer marks delivery complete; client can now approve or dispute.
+    function submitWork(bytes32 deliverableReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Submitted;
+        emit WorkSubmitted(deliverableReference);
+    }
+
+    /// @notice Client accepts the delivery and pays the freelancer in full.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Submitted);
+        status = Status.Released;
+        paymentToken.safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client cancels before a delivery is submitted.
+    function refundBeforeSubmission() external onlyClient nonReentrant {
+        _requireStatus(Status.Funded);
+        status = Status.Refunded;
+        paymentToken.safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either party sends a submitted job to arbitration.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert NotClient();
+        _requireStatus(Status.Submitted);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator splits the held funds; the split must total the escrow amount.
+    function resolveDispute(uint256 freelancerAmount) external onlyArbitrator nonReentrant {
+        _requireStatus(Status.Disputed);
+        if (freelancerAmount > amount) revert InvalidAmount();
+
+        uint256 clientAmount = amount - freelancerAmount;
+        status = Status.Resolved;
+        if (freelancerAmount != 0) paymentToken.safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) paymentToken.safeTransfer(client, clientAmount);
+        emit DisputeResolved(freelancerAmount, clientAmount);
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
diff --git a/src/FreelanceEscrowFactory.sol b/src/FreelanceEscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..672ee2441a499f6db17615b850ebb73a04e60831
--- /dev/null
+++ b/src/FreelanceEscrowFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys USDC-denominated freelance escrows with the product's $2k–$50k bounds.
+contract FreelanceEscrowFactory {
+    error InvalidAddress();
+    error AmountOutOfBounds();
+
+    IERC20 public immutable paymentToken;
+    address public immutable arbitrator;
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+
+    event EscrowCreated(address indexed escrow, address indexed client, address indexed freelancer, uint256 amount, bytes32 jobReference);
+
+    constructor(IERC20 paymentToken_, address arbitrator_, uint256 minAmount_, uint256 maxAmount_) {
+        if (address(paymentToken_) == address(0) || arbitrator_ == address(0)) revert InvalidAddress();
+        if (minAmount_ == 0 || minAmount_ > maxAmount_) revert AmountOutOfBounds();
+        paymentToken = paymentToken_;
+        arbitrator = arbitrator_;
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, bytes32 jobReference)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        if (amount < minAmount || amount > maxAmount) revert AmountOutOfBounds();
+        escrow = new FreelanceEscrow(paymentToken, msg.sender, freelancer, arbitrator, amount, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, jobReference);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2df66b455c1b74bbed837f1562168832ff014d24
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e69da35eb1068b823700c2f63c8efc3f7263217e
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+/// @notice Minimal safe wrappers that support both standard and no-return ERC-20s.
+library SafeERC20 {
+    error ERC20CallFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transfer, (to, amount)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+    }
+
+    function _call(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returnedData) = address(token).call(data);
+        if (!success || (returnedData.length != 0 && !abi.decode(returnedData, (bool)))) {
+            revert ERC20CallFailed();
+        }
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00d26c112f649258b392703d8a26f455774d3bf7
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,48 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm { function prank(address) external; function expectRevert() external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF1EE1A);
+    address private constant ARBITRATOR = address(0xA8B17);
+    uint256 private constant AMOUNT = 10_000e6;
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITRATOR, AMOUNT, keccak256("job-1"));
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+    }
+
+    function testReleaseAfterSubmission() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer unpaid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.raiseDispute();
+        vm.prank(ARBITRATOR); escrow.resolveDispute(6_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6, "incorrect freelancer split");
+        require(token.balanceOf(CLIENT) == 4_000e6, "incorrect client split");
+    }
+
+    function testFactoryRejectsOutOfRangeJobs() public {
+        FreelanceEscrowFactory factory = new FreelanceEscrowFactory(token, ARBITRATOR, 2_000e6, 50_000e6);
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 1_999e6, bytes32(0));
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 50_001e6, bytes32(0));
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9fa214d9cc804eca8b7fcd11add4c1febbadb984
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}

exec
/bin/bash -lc 'forge fmt && forge build && forge test -vvv && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001
 succeeded in 275ms:
Compiling 7 files with Solc 0.8.28
Solc 0.8.28 finished in 183.00ms
Compiler run successful!
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrowFactory.sol:12:29
   |
12 |     IERC20 public immutable paymentToken;
   |                             ^^^^^^^^^^^^ help: consider using: `PAYMENT_TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> script/Deploy.s.sol:14:25
   |
14 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:31:29
   |
31 |     IERC20 public immutable paymentToken;
   |                             ^^^^^^^^^^^^ help: consider using: `PAYMENT_TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:32:30
   |
32 |     address public immutable client;
   |                              ^^^^^^ help: consider using: `CLIENT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:33:30
   |
33 |     address public immutable freelancer;
   |                              ^^^^^^^^^^ help: consider using: `FREELANCER`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrowFactory.sol:13:30
   |
13 |     address public immutable arbitrator;
   |                              ^^^^^^^^^^ help: consider using: `ARBITRATOR`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrowFactory.sol:14:30
   |
14 |     uint256 public immutable minAmount;
   |                              ^^^^^^^^^ help: consider using: `MIN_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrowFactory.sol:15:30
   |
15 |     uint256 public immutable maxAmount;
   |                              ^^^^^^^^^ help: consider using: `MAX_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:34:30
   |
34 |     address public immutable arbitrator;
   |                              ^^^^^^^^^^ help: consider using: `ARBITRATOR`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:35:30
   |
35 |     uint256 public immutable amount;
   |                              ^^^^^^ help: consider using: `AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:36:30
   |
36 |     bytes32 public immutable jobReference;
   |                              ^^^^^^^^^^^^ help: consider using: `JOB_REFERENCE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> test/FreelanceEscrow.t.sol:14:25
   |
14 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:48:5
   |
48 | /     modifier onlyClient() {
49 | |         if (msg.sender != client) revert NotClient();
50 | |         _;
51 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
48 ~     modifier onlyClient() {
49 +         _onlyClient();
50 +         _;
51 +     }
52 + 
53 +     function _onlyClient() internal {
54 +         if (msg.sender != client) revert NotClient();
55 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:53:5
   |
53 | /     modifier onlyFreelancer() {
54 | |         if (msg.sender != freelancer) revert NotFreelancer();
55 | |         _;
56 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
53 ~     modifier onlyFreelancer() {
54 +         _onlyFreelancer();
55 +         _;
56 +     }
57 + 
58 +     function _onlyFreelancer() internal {
59 +         if (msg.sender != freelancer) revert NotFreelancer();
60 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:58:5
   |
58 | /     modifier onlyArbitrator() {
59 | |         if (msg.sender != arbitrator) revert NotArbitrator();
60 | |         _;
61 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
58 ~     modifier onlyArbitrator() {
59 +         _onlyArbitrator();
60 +         _;
61 +     }
62 + 
63 +     function _onlyArbitrator() internal {
64 +         if (msg.sender != arbitrator) revert NotArbitrator();
65 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:63:5
   |
63 | /     modifier nonReentrant() {
64 | |         if (locked) revert Reentrancy();
65 | |         locked = true;
66 | |         _;
67 | |         locked = false;
68 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
63 ~     modifier nonReentrant() {
64 +         _nonReentrantBefore();
65 +         _;
66 +         _nonReentrantAfter();
67 +     }
68 + 
69 +     function _nonReentrantBefore() internal {
70 +         if (locked) revert Reentrancy();
71 +         locked = true;
72 +     }
73 + 
74 +     function _nonReentrantAfter() internal {
75 +         locked = false;
76 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

No files changed, compilation skipped

Ran 3 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbitratorCanSplitDispute() (gas: 86714)
[PASS] testFactoryRejectsOutOfRangeJobs() (gas: 1067482)
[PASS] testReleaseAfterSubmission() (gas: 80772)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 678.23µs (594.29µs CPU time)

Ran 1 test suite in 7.64ms (678.23µs CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..2404155eedccae2317fd44a1c4fe52d7781b13d3
--- /dev/null
+++ b/README.md
@@ -0,0 +1,31 @@
+# Freelance Escrow
+
+An ERC-20 escrow for individual freelance jobs. The client creates a job, funds it, the freelancer submits delivery, and the client releases payment. Either party can send a delivered job to a pre-selected arbitrator, who may split the funds. The factory enforces a $2,000–$50,000 range when used with a USD-stable 6-decimal token such as USDC.
+
+## Deploy
+
+This is a [Foundry](https://book.getfoundry.sh/) project. Install Foundry, then run:
+
+```bash
+forge build
+forge test
+export RPC_URL="https://mainnet.base.org"
+export PRIVATE_KEY="..."       # deployer key; do not commit it
+export ARBITRATOR="0x..."      # independent, secured arbitration wallet/multisig
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+The script defaults to Base mainnet native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) and sets the bounds to `2_000e6` and `50_000e6`. To deploy against another compatible 6-decimal token, set `PAYMENT_TOKEN` before the final command. Start by testing the exact configuration on Base Sepolia with a test token; do not use its USDC address on mainnet.
+
+## Recommended network
+
+Deploy production on **Base mainnet**, using native USDC. It is EVM-compatible, has broad wallet and USDC support, and makes a practical payment rail for job-sized stablecoin escrows. A live check on 2026-08-27 returned a Base gas price of 6,000,000 wei (0.006 gwei), versus 56,249,696 wei (0.056249696 gwei) on Ethereum mainnet; fees should always be re-measured immediately before deployment rather than copied from this document.
+
+## Operating a job
+
+1. Client calls `createEscrow(freelancer, amount, jobReference)` on the factory.
+2. Client approves the newly created escrow for `amount`, then calls `fund()`.
+3. Freelancer calls `submitWork(deliverableReference)`.
+4. Client calls `release()`, or either side calls `raiseDispute()` and the arbitrator calls `resolveDispute(freelancerAmount)`.
+
+`jobReference` and `deliverableReference` are hashes: store the signed agreement and delivery evidence off-chain (or hash a stable URI). This code has not been audited. Before holding real customer funds, commission an independent security audit, use a multisig for arbitration, establish terms/dispute procedures, and obtain legal/compliance advice for your operating jurisdictions.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..be1cd37c77870c1195be7291bd78ee6615396bae
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+# Base mainnet / Sepolia use Cancun-compatible EVM rules.
+evm_version = "cancun"
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7524bf0ced7d530eb7cdddd000cc6cc84076fdba
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC (6 decimals). Override for a testnet/token deployment.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    function run() external returns (FreelanceEscrowFactory factory) {
+        address token = vmEnvOr("PAYMENT_TOKEN", BASE_USDC);
+        address arbitrator = vmEnvAddress("ARBITRATOR");
+        vm.startBroadcast();
+        factory = new FreelanceEscrowFactory(IERC20(token), arbitrator, 2_000 * USDC_SCALE, 50_000 * USDC_SCALE);
+        vm.stopBroadcast();
+    }
+
+    // Kept here to make the required environment variables explicit without importing forge-std.
+    function vmEnvAddress(string memory name) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envAddress(string)", name));
+        require(ok, "missing ARBITRATOR");
+        value = abi.decode(data, (address));
+    }
+
+    function vmEnvOr(string memory name, address fallbackValue) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envOr(string,address)", name, fallbackValue));
+        require(ok, "invalid PAYMENT_TOKEN");
+        value = abi.decode(data, (address));
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bd16c2804c45cc459ebbda962f1e5fe4ef72877c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,142 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice One funded freelance job, settled by client approval or a neutral arbitrator.
+/// @dev The factory creates an instance per job. Amounts are token base units.
+contract FreelanceEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status { AwaitingFunding, Funded, Submitted, Disputed, Released, Refunded, Resolved }
+
+    error NotClient();
+    error NotFreelancer();
+    error NotArbitrator();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status expected, Status actual);
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    bool private locked;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkSubmitted(bytes32 indexed deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event DisputeResolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert NotClient();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert NotFreelancer();
+        _;
+    }
+
+    modifier onlyArbitrator() {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 paymentToken_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobReference_
+    ) {
+        if (
+            address(paymentToken_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+
+        paymentToken = paymentToken_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobReference = jobReference_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Client transfers the exact agreed amount after approving this contract.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
+        // Reject fee-on-transfer tokens: an escrow must be fully collateralized.
+        if (paymentToken.balanceOf(address(this)) != beforeBalance + amount) revert InvalidAmount();
+        status = Status.Funded;
+        emit Funded(msg.sender, amount);
+    }
+
+    /// @notice Freelancer marks delivery complete; client can now approve or dispute.
+    function submitWork(bytes32 deliverableReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Submitted;
+        emit WorkSubmitted(deliverableReference);
+    }
+
+    /// @notice Client accepts the delivery and pays the freelancer in full.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Submitted);
+        status = Status.Released;
+        paymentToken.safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client cancels before a delivery is submitted.
+    function refundBeforeSubmission() external onlyClient nonReentrant {
+        _requireStatus(Status.Funded);
+        status = Status.Refunded;
+        paymentToken.safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either party sends a submitted job to arbitration.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert NotClient();
+        _requireStatus(Status.Submitted);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator splits the held funds; the split must total the escrow amount.
+    function resolveDispute(uint256 freelancerAmount) external onlyArbitrator nonReentrant {
+        _requireStatus(Status.Disputed);
+        if (freelancerAmount > amount) revert InvalidAmount();
+
+        uint256 clientAmount = amount - freelancerAmount;
+        status = Status.Resolved;
+        if (freelancerAmount != 0) paymentToken.safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) paymentToken.safeTransfer(client, clientAmount);
+        emit DisputeResolved(freelancerAmount, clientAmount);
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
diff --git a/src/FreelanceEscrowFactory.sol b/src/FreelanceEscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..672ee2441a499f6db17615b850ebb73a04e60831
--- /dev/null
+++ b/src/FreelanceEscrowFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys USDC-denominated freelance escrows with the product's $2k–$50k bounds.
+contract FreelanceEscrowFactory {
+    error InvalidAddress();
+    error AmountOutOfBounds();
+
+    IERC20 public immutable paymentToken;
+    address public immutable arbitrator;
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+
+    event EscrowCreated(address indexed escrow, address indexed client, address indexed freelancer, uint256 amount, bytes32 jobReference);
+
+    constructor(IERC20 paymentToken_, address arbitrator_, uint256 minAmount_, uint256 maxAmount_) {
+        if (address(paymentToken_) == address(0) || arbitrator_ == address(0)) revert InvalidAddress();
+        if (minAmount_ == 0 || minAmount_ > maxAmount_) revert AmountOutOfBounds();
+        paymentToken = paymentToken_;
+        arbitrator = arbitrator_;
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, bytes32 jobReference)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        if (amount < minAmount || amount > maxAmount) revert AmountOutOfBounds();
+        escrow = new FreelanceEscrow(paymentToken, msg.sender, freelancer, arbitrator, amount, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, jobReference);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2df66b455c1b74bbed837f1562168832ff014d24
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e69da35eb1068b823700c2f63c8efc3f7263217e
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+/// @notice Minimal safe wrappers that support both standard and no-return ERC-20s.
+library SafeERC20 {
+    error ERC20CallFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transfer, (to, amount)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+    }
+
+    function _call(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returnedData) = address(token).call(data);
+        if (!success || (returnedData.length != 0 && !abi.decode(returnedData, (bool)))) {
+            revert ERC20CallFailed();
+        }
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00d26c112f649258b392703d8a26f455774d3bf7
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,48 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm { function prank(address) external; function expectRevert() external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF1EE1A);
+    address private constant ARBITRATOR = address(0xA8B17);
+    uint256 private constant AMOUNT = 10_000e6;
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITRATOR, AMOUNT, keccak256("job-1"));
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+    }
+
+    function testReleaseAfterSubmission() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer unpaid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.raiseDispute();
+        vm.prank(ARBITRATOR); escrow.resolveDispute(6_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6, "incorrect freelancer split");
+        require(token.balanceOf(CLIENT) == 4_000e6, "incorrect client split");
+    }
+
+    function testFactoryRejectsOutOfRangeJobs() public {
+        FreelanceEscrowFactory factory = new FreelanceEscrowFactory(token, ARBITRATOR, 2_000e6, 50_000e6);
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 1_999e6, bytes32(0));
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 50_001e6, bytes32(0));
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9fa214d9cc804eca8b7fcd11add4c1febbadb984
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}

codex
The implementation is complete and the test suite passes. I also measured live network fee data before documenting the Base recommendation; the README labels it as time-sensitive rather than treating it as a fixed cost.
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/README.md
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..1d557adadb1c4c1d79ffb0bcbe450d51cca82936
--- /dev/null
+++ b/README.md
@@ -0,0 +1,31 @@
+# Freelance Escrow
+
+An ERC-20 escrow for individual freelance jobs. The client creates a job, funds it, the freelancer submits delivery, and the client releases payment. Either party can send a delivered job to a pre-selected arbitrator, who may split the funds. The factory enforces a $2,000–$50,000 range when used with a USD-stable 6-decimal token such as USDC.
+
+## Deploy
+
+This is a [Foundry](https://book.getfoundry.sh/) project. Install Foundry, then run:
+
+```bash
+forge build
+forge test
+export RPC_URL="https://mainnet.base.org"
+export PRIVATE_KEY="..."       # deployer key; do not commit it
+export ARBITRATOR="0x..."      # independent, secured arbitration wallet/multisig
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+The script defaults to Base mainnet native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) and sets the bounds to `2_000e6` and `50_000e6`. To deploy against another compatible 6-decimal token, set `PAYMENT_TOKEN` before the final command. Start by testing the exact configuration on Base Sepolia with a test token; do not use its USDC address on mainnet.
+
+## Recommended network
+
+Deploy production on **Base mainnet**, using Base-issued USDC. It is EVM-compatible, has broad wallet and USDC support, and makes a practical payment rail for job-sized stablecoin escrows. A live check on 2026-08-27 returned a Base gas price of 6,000,000 wei (0.006 gwei), versus 56,249,696 wei (0.056249696 gwei) on Ethereum mainnet; fees should always be re-measured immediately before deployment rather than copied from this document.
+
+## Operating a job
+
+1. Client calls `createEscrow(freelancer, amount, jobReference)` on the factory.
+2. Client approves the newly created escrow for `amount`, then calls `fund()`.
+3. Freelancer calls `submitWork(deliverableReference)`.
+4. Client calls `release()`, or either side calls `raiseDispute()` and the arbitrator calls `resolveDispute(freelancerAmount)`.
+
+`jobReference` and `deliverableReference` are hashes: store the signed agreement and delivery evidence off-chain (or hash a stable URI). This code has not been audited. Before holding real customer funds, commission an independent security audit, use a multisig for arbitration, establish terms/dispute procedures, and obtain legal/compliance advice for your operating jurisdictions.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..be1cd37c77870c1195be7291bd78ee6615396bae
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+# Base mainnet / Sepolia use Cancun-compatible EVM rules.
+evm_version = "cancun"
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7524bf0ced7d530eb7cdddd000cc6cc84076fdba
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC (6 decimals). Override for a testnet/token deployment.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    function run() external returns (FreelanceEscrowFactory factory) {
+        address token = vmEnvOr("PAYMENT_TOKEN", BASE_USDC);
+        address arbitrator = vmEnvAddress("ARBITRATOR");
+        vm.startBroadcast();
+        factory = new FreelanceEscrowFactory(IERC20(token), arbitrator, 2_000 * USDC_SCALE, 50_000 * USDC_SCALE);
+        vm.stopBroadcast();
+    }
+
+    // Kept here to make the required environment variables explicit without importing forge-std.
+    function vmEnvAddress(string memory name) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envAddress(string)", name));
+        require(ok, "missing ARBITRATOR");
+        value = abi.decode(data, (address));
+    }
+
+    function vmEnvOr(string memory name, address fallbackValue) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envOr(string,address)", name, fallbackValue));
+        require(ok, "invalid PAYMENT_TOKEN");
+        value = abi.decode(data, (address));
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bd16c2804c45cc459ebbda962f1e5fe4ef72877c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,142 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice One funded freelance job, settled by client approval or a neutral arbitrator.
+/// @dev The factory creates an instance per job. Amounts are token base units.
+contract FreelanceEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status { AwaitingFunding, Funded, Submitted, Disputed, Released, Refunded, Resolved }
+
+    error NotClient();
+    error NotFreelancer();
+    error NotArbitrator();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status expected, Status actual);
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    bool private locked;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkSubmitted(bytes32 indexed deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event DisputeResolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert NotClient();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert NotFreelancer();
+        _;
+    }
+
+    modifier onlyArbitrator() {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 paymentToken_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobReference_
+    ) {
+        if (
+            address(paymentToken_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+
+        paymentToken = paymentToken_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobReference = jobReference_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Client transfers the exact agreed amount after approving this contract.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
+        // Reject fee-on-transfer tokens: an escrow must be fully collateralized.
+        if (paymentToken.balanceOf(address(this)) != beforeBalance + amount) revert InvalidAmount();
+        status = Status.Funded;
+        emit Funded(msg.sender, amount);
+    }
+
+    /// @notice Freelancer marks delivery complete; client can now approve or dispute.
+    function submitWork(bytes32 deliverableReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Submitted;
+        emit WorkSubmitted(deliverableReference);
+    }
+
+    /// @notice Client accepts the delivery and pays the freelancer in full.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Submitted);
+        status = Status.Released;
+        paymentToken.safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client cancels before a delivery is submitted.
+    function refundBeforeSubmission() external onlyClient nonReentrant {
+        _requireStatus(Status.Funded);
+        status = Status.Refunded;
+        paymentToken.safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either party sends a submitted job to arbitration.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert NotClient();
+        _requireStatus(Status.Submitted);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator splits the held funds; the split must total the escrow amount.
+    function resolveDispute(uint256 freelancerAmount) external onlyArbitrator nonReentrant {
+        _requireStatus(Status.Disputed);
+        if (freelancerAmount > amount) revert InvalidAmount();
+
+        uint256 clientAmount = amount - freelancerAmount;
+        status = Status.Resolved;
+        if (freelancerAmount != 0) paymentToken.safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) paymentToken.safeTransfer(client, clientAmount);
+        emit DisputeResolved(freelancerAmount, clientAmount);
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
diff --git a/src/FreelanceEscrowFactory.sol b/src/FreelanceEscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..672ee2441a499f6db17615b850ebb73a04e60831
--- /dev/null
+++ b/src/FreelanceEscrowFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys USDC-denominated freelance escrows with the product's $2k–$50k bounds.
+contract FreelanceEscrowFactory {
+    error InvalidAddress();
+    error AmountOutOfBounds();
+
+    IERC20 public immutable paymentToken;
+    address public immutable arbitrator;
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+
+    event EscrowCreated(address indexed escrow, address indexed client, address indexed freelancer, uint256 amount, bytes32 jobReference);
+
+    constructor(IERC20 paymentToken_, address arbitrator_, uint256 minAmount_, uint256 maxAmount_) {
+        if (address(paymentToken_) == address(0) || arbitrator_ == address(0)) revert InvalidAddress();
+        if (minAmount_ == 0 || minAmount_ > maxAmount_) revert AmountOutOfBounds();
+        paymentToken = paymentToken_;
+        arbitrator = arbitrator_;
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, bytes32 jobReference)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        if (amount < minAmount || amount > maxAmount) revert AmountOutOfBounds();
+        escrow = new FreelanceEscrow(paymentToken, msg.sender, freelancer, arbitrator, amount, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, jobReference);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2df66b455c1b74bbed837f1562168832ff014d24
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e69da35eb1068b823700c2f63c8efc3f7263217e
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+/// @notice Minimal safe wrappers that support both standard and no-return ERC-20s.
+library SafeERC20 {
+    error ERC20CallFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transfer, (to, amount)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+    }
+
+    function _call(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returnedData) = address(token).call(data);
+        if (!success || (returnedData.length != 0 && !abi.decode(returnedData, (bool)))) {
+            revert ERC20CallFailed();
+        }
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00d26c112f649258b392703d8a26f455774d3bf7
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,48 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm { function prank(address) external; function expectRevert() external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF1EE1A);
+    address private constant ARBITRATOR = address(0xA8B17);
+    uint256 private constant AMOUNT = 10_000e6;
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITRATOR, AMOUNT, keccak256("job-1"));
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+    }
+
+    function testReleaseAfterSubmission() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer unpaid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.raiseDispute();
+        vm.prank(ARBITRATOR); escrow.resolveDispute(6_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6, "incorrect freelancer split");
+        require(token.balanceOf(CLIENT) == 4_000e6, "incorrect client split");
+    }
+
+    function testFactoryRejectsOutOfRangeJobs() public {
+        FreelanceEscrowFactory factory = new FreelanceEscrowFactory(token, ARBITRATOR, 2_000e6, 50_000e6);
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 1_999e6, bytes32(0));
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 50_001e6, bytes32(0));
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9fa214d9cc804eca8b7fcd11add4c1febbadb984
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}

diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..1d557adadb1c4c1d79ffb0bcbe450d51cca82936
--- /dev/null
+++ b/README.md
@@ -0,0 +1,31 @@
+# Freelance Escrow
+
+An ERC-20 escrow for individual freelance jobs. The client creates a job, funds it, the freelancer submits delivery, and the client releases payment. Either party can send a delivered job to a pre-selected arbitrator, who may split the funds. The factory enforces a $2,000–$50,000 range when used with a USD-stable 6-decimal token such as USDC.
+
+## Deploy
+
+This is a [Foundry](https://book.getfoundry.sh/) project. Install Foundry, then run:
+
+```bash
+forge build
+forge test
+export RPC_URL="https://mainnet.base.org"
+export PRIVATE_KEY="..."       # deployer key; do not commit it
+export ARBITRATOR="0x..."      # independent, secured arbitration wallet/multisig
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+The script defaults to Base mainnet native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) and sets the bounds to `2_000e6` and `50_000e6`. To deploy against another compatible 6-decimal token, set `PAYMENT_TOKEN` before the final command. Start by testing the exact configuration on Base Sepolia with a test token; do not use its USDC address on mainnet.
+
+## Recommended network
+
+Deploy production on **Base mainnet**, using Base-issued USDC. It is EVM-compatible, has broad wallet and USDC support, and makes a practical payment rail for job-sized stablecoin escrows. A live check on 2026-08-27 returned a Base gas price of 6,000,000 wei (0.006 gwei), versus 56,249,696 wei (0.056249696 gwei) on Ethereum mainnet; fees should always be re-measured immediately before deployment rather than copied from this document.
+
+## Operating a job
+
+1. Client calls `createEscrow(freelancer, amount, jobReference)` on the factory.
+2. Client approves the newly created escrow for `amount`, then calls `fund()`.
+3. Freelancer calls `submitWork(deliverableReference)`.
+4. Client calls `release()`, or either side calls `raiseDispute()` and the arbitrator calls `resolveDispute(freelancerAmount)`.
+
+`jobReference` and `deliverableReference` are hashes: store the signed agreement and delivery evidence off-chain (or hash a stable URI). This code has not been audited. Before holding real customer funds, commission an independent security audit, use a multisig for arbitration, establish terms/dispute procedures, and obtain legal/compliance advice for your operating jurisdictions.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..be1cd37c77870c1195be7291bd78ee6615396bae
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+# Base mainnet / Sepolia use Cancun-compatible EVM rules.
+evm_version = "cancun"
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7524bf0ced7d530eb7cdddd000cc6cc84076fdba
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC (6 decimals). Override for a testnet/token deployment.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    function run() external returns (FreelanceEscrowFactory factory) {
+        address token = vmEnvOr("PAYMENT_TOKEN", BASE_USDC);
+        address arbitrator = vmEnvAddress("ARBITRATOR");
+        vm.startBroadcast();
+        factory = new FreelanceEscrowFactory(IERC20(token), arbitrator, 2_000 * USDC_SCALE, 50_000 * USDC_SCALE);
+        vm.stopBroadcast();
+    }
+
+    // Kept here to make the required environment variables explicit without importing forge-std.
+    function vmEnvAddress(string memory name) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envAddress(string)", name));
+        require(ok, "missing ARBITRATOR");
+        value = abi.decode(data, (address));
+    }
+
+    function vmEnvOr(string memory name, address fallbackValue) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envOr(string,address)", name, fallbackValue));
+        require(ok, "invalid PAYMENT_TOKEN");
+        value = abi.decode(data, (address));
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bd16c2804c45cc459ebbda962f1e5fe4ef72877c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,142 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice One funded freelance job, settled by client approval or a neutral arbitrator.
+/// @dev The factory creates an instance per job. Amounts are token base units.
+contract FreelanceEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status { AwaitingFunding, Funded, Submitted, Disputed, Released, Refunded, Resolved }
+
+    error NotClient();
+    error NotFreelancer();
+    error NotArbitrator();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status expected, Status actual);
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    bool private locked;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkSubmitted(bytes32 indexed deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event DisputeResolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert NotClient();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert NotFreelancer();
+        _;
+    }
+
+    modifier onlyArbitrator() {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 paymentToken_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobReference_
+    ) {
+        if (
+            address(paymentToken_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+
+        paymentToken = paymentToken_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobReference = jobReference_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Client transfers the exact agreed amount after approving this contract.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
+        // Reject fee-on-transfer tokens: an escrow must be fully collateralized.
+        if (paymentToken.balanceOf(address(this)) != beforeBalance + amount) revert InvalidAmount();
+        status = Status.Funded;
+        emit Funded(msg.sender, amount);
+    }
+
+    /// @notice Freelancer marks delivery complete; client can now approve or dispute.
+    function submitWork(bytes32 deliverableReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Submitted;
+        emit WorkSubmitted(deliverableReference);
+    }
+
+    /// @notice Client accepts the delivery and pays the freelancer in full.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Submitted);
+        status = Status.Released;
+        paymentToken.safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client cancels before a delivery is submitted.
+    function refundBeforeSubmission() external onlyClient nonReentrant {
+        _requireStatus(Status.Funded);
+        status = Status.Refunded;
+        paymentToken.safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either party sends a submitted job to arbitration.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert NotClient();
+        _requireStatus(Status.Submitted);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator splits the held funds; the split must total the escrow amount.
+    function resolveDispute(uint256 freelancerAmount) external onlyArbitrator nonReentrant {
+        _requireStatus(Status.Disputed);
+        if (freelancerAmount > amount) revert InvalidAmount();
+
+        uint256 clientAmount = amount - freelancerAmount;
+        status = Status.Resolved;
+        if (freelancerAmount != 0) paymentToken.safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) paymentToken.safeTransfer(client, clientAmount);
+        emit DisputeResolved(freelancerAmount, clientAmount);
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
diff --git a/src/FreelanceEscrowFactory.sol b/src/FreelanceEscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..672ee2441a499f6db17615b850ebb73a04e60831
--- /dev/null
+++ b/src/FreelanceEscrowFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys USDC-denominated freelance escrows with the product's $2k–$50k bounds.
+contract FreelanceEscrowFactory {
+    error InvalidAddress();
+    error AmountOutOfBounds();
+
+    IERC20 public immutable paymentToken;
+    address public immutable arbitrator;
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+
+    event EscrowCreated(address indexed escrow, address indexed client, address indexed freelancer, uint256 amount, bytes32 jobReference);
+
+    constructor(IERC20 paymentToken_, address arbitrator_, uint256 minAmount_, uint256 maxAmount_) {
+        if (address(paymentToken_) == address(0) || arbitrator_ == address(0)) revert InvalidAddress();
+        if (minAmount_ == 0 || minAmount_ > maxAmount_) revert AmountOutOfBounds();
+        paymentToken = paymentToken_;
+        arbitrator = arbitrator_;
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, bytes32 jobReference)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        if (amount < minAmount || amount > maxAmount) revert AmountOutOfBounds();
+        escrow = new FreelanceEscrow(paymentToken, msg.sender, freelancer, arbitrator, amount, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, jobReference);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2df66b455c1b74bbed837f1562168832ff014d24
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e69da35eb1068b823700c2f63c8efc3f7263217e
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+/// @notice Minimal safe wrappers that support both standard and no-return ERC-20s.
+library SafeERC20 {
+    error ERC20CallFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transfer, (to, amount)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+    }
+
+    function _call(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returnedData) = address(token).call(data);
+        if (!success || (returnedData.length != 0 && !abi.decode(returnedData, (bool)))) {
+            revert ERC20CallFailed();
+        }
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00d26c112f649258b392703d8a26f455774d3bf7
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,48 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm { function prank(address) external; function expectRevert() external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF1EE1A);
+    address private constant ARBITRATOR = address(0xA8B17);
+    uint256 private constant AMOUNT = 10_000e6;
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITRATOR, AMOUNT, keccak256("job-1"));
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+    }
+
+    function testReleaseAfterSubmission() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer unpaid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.raiseDispute();
+        vm.prank(ARBITRATOR); escrow.resolveDispute(6_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6, "incorrect freelancer split");
+        require(token.balanceOf(CLIENT) == 4_000e6, "incorrect client split");
+    }
+
+    function testFactoryRejectsOutOfRangeJobs() public {
+        FreelanceEscrowFactory factory = new FreelanceEscrowFactory(token, ARBITRATOR, 2_000e6, 50_000e6);
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 1_999e6, bytes32(0));
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 50_001e6, bytes32(0));
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9fa214d9cc804eca8b7fcd11add4c1febbadb984
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}

codex
Built a deployable Foundry escrow project.

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/src/FreelanceEscrow.sol) handles funding, delivery submission, release, refunds before submission, disputes, and arbitrated splits.
- [FreelanceEscrowFactory.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/src/FreelanceEscrowFactory.sol) enforces USDC-denominated $2,000–$50,000 job values.
- [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/README.md) includes exact deployment steps and recommends Base mainnet with Base-issued USDC.
- Tests pass: `3 passed, 0 failed`.

Before production use, deploy/test on Base Sepolia with a test token, choose a secured independent arbitrator multisig, and commission a smart-contract audit.
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..1d557adadb1c4c1d79ffb0bcbe450d51cca82936
--- /dev/null
+++ b/README.md
@@ -0,0 +1,31 @@
+# Freelance Escrow
+
+An ERC-20 escrow for individual freelance jobs. The client creates a job, funds it, the freelancer submits delivery, and the client releases payment. Either party can send a delivered job to a pre-selected arbitrator, who may split the funds. The factory enforces a $2,000–$50,000 range when used with a USD-stable 6-decimal token such as USDC.
+
+## Deploy
+
+This is a [Foundry](https://book.getfoundry.sh/) project. Install Foundry, then run:
+
+```bash
+forge build
+forge test
+export RPC_URL="https://mainnet.base.org"
+export PRIVATE_KEY="..."       # deployer key; do not commit it
+export ARBITRATOR="0x..."      # independent, secured arbitration wallet/multisig
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+The script defaults to Base mainnet native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) and sets the bounds to `2_000e6` and `50_000e6`. To deploy against another compatible 6-decimal token, set `PAYMENT_TOKEN` before the final command. Start by testing the exact configuration on Base Sepolia with a test token; do not use its USDC address on mainnet.
+
+## Recommended network
+
+Deploy production on **Base mainnet**, using Base-issued USDC. It is EVM-compatible, has broad wallet and USDC support, and makes a practical payment rail for job-sized stablecoin escrows. A live check on 2026-08-27 returned a Base gas price of 6,000,000 wei (0.006 gwei), versus 56,249,696 wei (0.056249696 gwei) on Ethereum mainnet; fees should always be re-measured immediately before deployment rather than copied from this document.
+
+## Operating a job
+
+1. Client calls `createEscrow(freelancer, amount, jobReference)` on the factory.
+2. Client approves the newly created escrow for `amount`, then calls `fund()`.
+3. Freelancer calls `submitWork(deliverableReference)`.
+4. Client calls `release()`, or either side calls `raiseDispute()` and the arbitrator calls `resolveDispute(freelancerAmount)`.
+
+`jobReference` and `deliverableReference` are hashes: store the signed agreement and delivery evidence off-chain (or hash a stable URI). This code has not been audited. Before holding real customer funds, commission an independent security audit, use a multisig for arbitration, establish terms/dispute procedures, and obtain legal/compliance advice for your operating jurisdictions.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..be1cd37c77870c1195be7291bd78ee6615396bae
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+# Base mainnet / Sepolia use Cancun-compatible EVM rules.
+evm_version = "cancun"
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7524bf0ced7d530eb7cdddd000cc6cc84076fdba
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC (6 decimals). Override for a testnet/token deployment.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant USDC_SCALE = 1e6;
+
+    function run() external returns (FreelanceEscrowFactory factory) {
+        address token = vmEnvOr("PAYMENT_TOKEN", BASE_USDC);
+        address arbitrator = vmEnvAddress("ARBITRATOR");
+        vm.startBroadcast();
+        factory = new FreelanceEscrowFactory(IERC20(token), arbitrator, 2_000 * USDC_SCALE, 50_000 * USDC_SCALE);
+        vm.stopBroadcast();
+    }
+
+    // Kept here to make the required environment variables explicit without importing forge-std.
+    function vmEnvAddress(string memory name) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envAddress(string)", name));
+        require(ok, "missing ARBITRATOR");
+        value = abi.decode(data, (address));
+    }
+
+    function vmEnvOr(string memory name, address fallbackValue) private returns (address value) {
+        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envOr(string,address)", name, fallbackValue));
+        require(ok, "invalid PAYMENT_TOKEN");
+        value = abi.decode(data, (address));
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bd16c2804c45cc459ebbda962f1e5fe4ef72877c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,142 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice One funded freelance job, settled by client approval or a neutral arbitrator.
+/// @dev The factory creates an instance per job. Amounts are token base units.
+contract FreelanceEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status { AwaitingFunding, Funded, Submitted, Disputed, Released, Refunded, Resolved }
+
+    error NotClient();
+    error NotFreelancer();
+    error NotArbitrator();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status expected, Status actual);
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    bool private locked;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkSubmitted(bytes32 indexed deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy);
+    event DisputeResolved(uint256 freelancerAmount, uint256 clientAmount);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert NotClient();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert NotFreelancer();
+        _;
+    }
+
+    modifier onlyArbitrator() {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 paymentToken_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobReference_
+    ) {
+        if (
+            address(paymentToken_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+
+        paymentToken = paymentToken_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobReference = jobReference_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Client transfers the exact agreed amount after approving this contract.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
+        // Reject fee-on-transfer tokens: an escrow must be fully collateralized.
+        if (paymentToken.balanceOf(address(this)) != beforeBalance + amount) revert InvalidAmount();
+        status = Status.Funded;
+        emit Funded(msg.sender, amount);
+    }
+
+    /// @notice Freelancer marks delivery complete; client can now approve or dispute.
+    function submitWork(bytes32 deliverableReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Submitted;
+        emit WorkSubmitted(deliverableReference);
+    }
+
+    /// @notice Client accepts the delivery and pays the freelancer in full.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Submitted);
+        status = Status.Released;
+        paymentToken.safeTransfer(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client cancels before a delivery is submitted.
+    function refundBeforeSubmission() external onlyClient nonReentrant {
+        _requireStatus(Status.Funded);
+        status = Status.Refunded;
+        paymentToken.safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either party sends a submitted job to arbitration.
+    function raiseDispute() external {
+        if (msg.sender != client && msg.sender != freelancer) revert NotClient();
+        _requireStatus(Status.Submitted);
+        status = Status.Disputed;
+        emit Disputed(msg.sender);
+    }
+
+    /// @notice Arbitrator splits the held funds; the split must total the escrow amount.
+    function resolveDispute(uint256 freelancerAmount) external onlyArbitrator nonReentrant {
+        _requireStatus(Status.Disputed);
+        if (freelancerAmount > amount) revert InvalidAmount();
+
+        uint256 clientAmount = amount - freelancerAmount;
+        status = Status.Resolved;
+        if (freelancerAmount != 0) paymentToken.safeTransfer(freelancer, freelancerAmount);
+        if (clientAmount != 0) paymentToken.safeTransfer(client, clientAmount);
+        emit DisputeResolved(freelancerAmount, clientAmount);
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
diff --git a/src/FreelanceEscrowFactory.sol b/src/FreelanceEscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..672ee2441a499f6db17615b850ebb73a04e60831
--- /dev/null
+++ b/src/FreelanceEscrowFactory.sol
@@ -0,0 +1,36 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys USDC-denominated freelance escrows with the product's $2k–$50k bounds.
+contract FreelanceEscrowFactory {
+    error InvalidAddress();
+    error AmountOutOfBounds();
+
+    IERC20 public immutable paymentToken;
+    address public immutable arbitrator;
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+
+    event EscrowCreated(address indexed escrow, address indexed client, address indexed freelancer, uint256 amount, bytes32 jobReference);
+
+    constructor(IERC20 paymentToken_, address arbitrator_, uint256 minAmount_, uint256 maxAmount_) {
+        if (address(paymentToken_) == address(0) || arbitrator_ == address(0)) revert InvalidAddress();
+        if (minAmount_ == 0 || minAmount_ > maxAmount_) revert AmountOutOfBounds();
+        paymentToken = paymentToken_;
+        arbitrator = arbitrator_;
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, bytes32 jobReference)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        if (amount < minAmount || amount > maxAmount) revert AmountOutOfBounds();
+        escrow = new FreelanceEscrow(paymentToken, msg.sender, freelancer, arbitrator, amount, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, jobReference);
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2df66b455c1b74bbed837f1562168832ff014d24
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/src/libraries/SafeERC20.sol b/src/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e69da35eb1068b823700c2f63c8efc3f7263217e
--- /dev/null
+++ b/src/libraries/SafeERC20.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+/// @notice Minimal safe wrappers that support both standard and no-return ERC-20s.
+library SafeERC20 {
+    error ERC20CallFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transfer, (to, amount)));
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        _call(token, abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+    }
+
+    function _call(IERC20 token, bytes memory data) private {
+        (bool success, bytes memory returnedData) = address(token).call(data);
+        if (!success || (returnedData.length != 0 && !abi.decode(returnedData, (bool)))) {
+            revert ERC20CallFailed();
+        }
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00d26c112f649258b392703d8a26f455774d3bf7
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,48 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm { function prank(address) external; function expectRevert() external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF1EE1A);
+    address private constant ARBITRATOR = address(0xA8B17);
+    uint256 private constant AMOUNT = 10_000e6;
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITRATOR, AMOUNT, keccak256("job-1"));
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+    }
+
+    function testReleaseAfterSubmission() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer unpaid");
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.submitWork(keccak256("delivery"));
+        vm.prank(CLIENT); escrow.raiseDispute();
+        vm.prank(ARBITRATOR); escrow.resolveDispute(6_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6, "incorrect freelancer split");
+        require(token.balanceOf(CLIENT) == 4_000e6, "incorrect client split");
+    }
+
+    function testFactoryRejectsOutOfRangeJobs() public {
+        FreelanceEscrowFactory factory = new FreelanceEscrowFactory(token, ARBITRATOR, 2_000e6, 50_000e6);
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 1_999e6, bytes32(0));
+        vm.expectRevert(); factory.createEscrow(FREELANCER, 50_001e6, bytes32(0));
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9fa214d9cc804eca8b7fcd11add4c1febbadb984
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}

tokens used
30,774
````

## final message

Built a deployable Foundry escrow project.

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/src/FreelanceEscrow.sol) handles funding, delivery submission, release, refunds before submission, disputes, and arbitrated splits.
- [FreelanceEscrowFactory.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/src/FreelanceEscrowFactory.sol) enforces USDC-denominated $2,000–$50,000 job values.
- [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T014313Z-codex-with-skill-3/gas-goal-001/README.md) includes exact deployment steps and recommends Base mainnet with Base-issued USDC.
- Tests pass: `3 passed, 0 failed`.

Before production use, deploy/test on Base Sepolia with a test token, choose a secured independent arbitrator multisig, and commission a smart-contract audit.

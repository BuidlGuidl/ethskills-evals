# Executor transcript — 2026-08-28T013258Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a045ff-b2e5-7330-8cf2-46130eb3fa58
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.

2026-08-28T01:33:00.712291Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a045ff-b2e5-7330-8cf2-46130eb3fa58.tmp-1787880780525678466: line 2547: syntax error near unexpected token `('

codex
I’ll build this as a production-oriented escrow contract with a deployable toolchain and a concise deployment guide. Because chain choice and transaction costs are central here, I’m using the gas guidance skill to ground those decisions.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/gas/SKILL.md && rg --files -g 'AGENTS.md' -g 'package.json' -g 'foundry.toml' -g 'README.md' | sed -n '1,160p'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 succeeded in 4ms:
package.json

exec
/bin/bash -lc "pwd && find . -maxdepth 2 -type f -not -path './.git/*' -print | sort && sed -n '1,220p' package.json && git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 succeeded in 4ms:
codex
I found an empty workspace, so I’m setting up a focused Foundry project. The contract will escrow a specified USDC amount per job, require freelancer acceptance before funding, support normal completion, a mutually agreed payout/refund, and arbitrator-only split resolutions after a dispute—without an owner withdrawal path.
exec
/bin/bash -lc 'command -v forge || true; command -v cast || true; command -v bun || true; command -v npm || true; git status --short; git log -1 --oneline 2>/dev/null || true' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/home/damu/.foundry/bin/forge
/home/damu/.foundry/bin/cast
/home/damu/.bun/bin/bun
/home/damu/.nvm/versions/node/v22.22.2/bin/npm
78fda4c eval baseline

exec
/bin/bash -lc 'forge init --force --no-git . && forge install OpenZeppelin/openzeppelin-contracts --no-commit' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 exited 2 in 1450ms:
Installing forge-std in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/lib/forge-std (url: https://github.com/foundry-rs/forge-std, tag: None)
Cloning into '/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/lib/forge-std'...
    Installed forge-std
    Initialized forge project
error: unexpected argument '--no-commit' found

  tip: a similar argument exists: '--commit'

Usage: forge install [OPTIONS] [DEPENDENCIES]...
    forge install [OPTIONS] <github username>/<github project>@<tag>...
    forge install [OPTIONS] <alias>=<github username>/<github project>@<tag>...
    forge install [OPTIONS] <https://<github token>@git url>...)]
    forge install [OPTIONS] <https:// git url>...

For more information, try '--help'.

exec
/bin/bash -lc "forge install OpenZeppelin/openzeppelin-contracts && find . -maxdepth 2 -type f -not -path './.git/*' -print | sort && sed -n '1,160p' foundry.toml" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 exited 1 in 71ms:
Installing openzeppelin-contracts in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: None)
fatal: could not create directory '/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/.git/modules/lib/openzeppelin-contracts'
Error: git submodule exited with code 128

exec
/bin/bash -lc "git status --short && ls -la .git .git/modules lib && git submodule status || true && forge install --help | sed -n '1,180p'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 succeeded in 8ms:
Install one or multiple dependencies.

If no arguments are provided, then existing dependencies will be installed.

Usage: forge install [OPTIONS] [DEPENDENCIES]...
    forge install [OPTIONS] <github username>/<github project>@<tag>...
    forge install [OPTIONS] <alias>=<github username>/<github project>@<tag>...
    forge install [OPTIONS] <https://<github token>@git url>...)]
    forge install [OPTIONS] <https:// git url>...

Arguments:
  [DEPENDENCIES]...
          The dependencies to install.
          
          A dependency can be a raw URL, or the path to a GitHub repository.
          
          Additionally, a ref can be provided by adding @ to the dependency path.
          
          A ref can be: - A branch: master - A tag: v1.2.3 - A commit: 8e8128
          
          For exact match, a ref can be provided with `@tag=`, `@branch=` or `@rev=` prefix.
          
          Target installation directory can be added via `<alias>=` suffix. The dependency will
          installed to `lib/<alias>`.

Options:
      --root <PATH>
          The project's root path.
          
          By default root of the Git repository, if in one, or the current working directory.

      --shallow
          Perform shallow clones instead of deep ones.
          
          Improves performance and reduces disk usage, but prevents switching branches or tags.

      --no-git
          Install without adding the dependency as a submodule

      --commit
          Create a commit after installing the dependencies

  -h, --help
          Print help (see a summary with '-h')

  -j, --threads <THREADS>
          Number of threads to use. Specifying 0 defaults to the number of logical cores
          
          [aliases: --jobs]

Display options:
      --color <COLOR>
          The color of the log messages

          Possible values:
          - auto:   Intelligently guess whether to use color output (default)
          - always: Force color output
          - never:  Force disable color output

      --json
          Format log messages as JSON

      --md
          Format log messages as Markdown

  -q, --quiet
          Do not print log messages

  -v, --verbosity...
          Verbosity level of the log messages.
          
          Pass multiple times to increase the verbosity (e.g. -v, -vv, -vvv).
          
          Depending on the context the verbosity levels have different meanings.
          
          For example, the verbosity levels of the EVM are:
          - 2 (-vv): Print logs for all tests.
          - 3 (-vvv): Print execution traces for failing tests.
          - 4 (-vvvv): Print execution traces for all tests, and setup traces for failing tests.
          - 5 (-vvvvv): Print execution and setup traces for all tests, including storage changes
          and
            backtraces with line numbers.

exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git && find lib/openzeppelin-contracts/contracts -maxdepth 2 -type f | head' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 succeeded in 9802ms:
Submodule 'lib/erc4626-tests' (https://github.com/a16z/erc4626-tests.git) registered for path 'lib/erc4626-tests'
Submodule 'lib/forge-std' (https://github.com/foundry-rs/forge-std) registered for path 'lib/forge-std'
Submodule 'lib/halmos-cheatcodes' (https://github.com/a16z/halmos-cheatcodes) registered for path 'lib/halmos-cheatcodes'
Cloning into '/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/lib/openzeppelin-contracts/lib/erc4626-tests'...
Cloning into '/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/lib/openzeppelin-contracts/lib/forge-std'...
Cloning into '/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/lib/openzeppelin-contracts/lib/halmos-cheatcodes'...
    Installed openzeppelin-contracts v5.4.0
lib/openzeppelin-contracts/contracts/package.json
lib/openzeppelin-contracts/contracts/mocks/ContextMock.sol
lib/openzeppelin-contracts/contracts/mocks/ArraysMock.sol
lib/openzeppelin-contracts/contracts/mocks/CallReceiverMock.sol
lib/openzeppelin-contracts/contracts/mocks/Base64Dirty.sol
lib/openzeppelin-contracts/contracts/mocks/EtherReceiverMock.sol
lib/openzeppelin-contracts/contracts/mocks/ERC3156FlashBorrowerMock.sol
lib/openzeppelin-contracts/contracts/mocks/InitializableMock.sol
lib/openzeppelin-contracts/contracts/mocks/MulticallHelper.sol
lib/openzeppelin-contracts/contracts/mocks/PausableMock.sol
find: ‘standard output’: Broken pipe
find: write error

exec
/bin/bash -lc "find src script test -maxdepth 2 -type f -print -exec sed -n '1,180p' {} \\; && sed -n '1,160p' foundry.toml && sed -n '1,120p' README.md" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
src/Counter.sol
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
script/Counter.s.sol
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

contract CounterScript is Script {
    Counter public counter;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        counter = new Counter();

        vm.stopBroadcast();
    }
}
test/Counter.t.sol
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {Counter} from "../src/Counter.sol";

contract CounterTest is Test {
    Counter public counter;

    function setUp() public {
        counter = new Counter();
        counter.setNumber(0);
    }

    function test_Increment() public {
        counter.increment();
        assertEq(counter.number(), 1);
    }

    function testFuzz_SetNumber(uint256 x) public {
        counter.setNumber(x);
        assertEq(counter.number(), x);
    }
}
[profile.default]
src = "src"
out = "out"
libs = ["lib"]

# See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
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

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/script/Counter.s.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/script/DeployFreelanceEscrow.s.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/src/Counter.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/test/Counter.t.sol
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c3c6a1a78c22958dbddb0917662b0d25bfbe70db
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,233 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable paymentToken;
+    address public immutable pauseGuardian;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        paymentToken = paymentToken_;
+        pauseGuardian = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != pauseGuardian) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(uint256 escrowId, Escrow storage escrow, uint256 clientAmount, uint256 freelancerAmount, Status status)
+        private
+    {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) paymentToken.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) paymentToken.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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

diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c3c6a1a78c22958dbddb0917662b0d25bfbe70db
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,233 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable paymentToken;
+    address public immutable pauseGuardian;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        paymentToken = paymentToken_;
+        pauseGuardian = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != pauseGuardian) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(uint256 escrowId, Escrow storage escrow, uint256 clientAmount, uint256 freelancerAmount, Status status)
+        private
+    {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) paymentToken.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) paymentToken.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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

2026-08-28T01:36:05.161472Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid patch: multiple operations target /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/README.md
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c3c6a1a78c22958dbddb0917662b0d25bfbe70db
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,233 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable paymentToken;
+    address public immutable pauseGuardian;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        paymentToken = paymentToken_;
+        pauseGuardian = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != pauseGuardian) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(uint256 escrowId, Escrow storage escrow, uint256 clientAmount, uint256 freelancerAmount, Status status)
+        private
+    {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) paymentToken.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) paymentToken.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c3c6a1a78c22958dbddb0917662b0d25bfbe70db
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,233 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable paymentToken;
+    address public immutable pauseGuardian;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        paymentToken = paymentToken_;
+        pauseGuardian = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != pauseGuardian) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(uint256 escrowId, Escrow storage escrow, uint256 clientAmount, uint256 freelancerAmount, Status status)
+        private
+    {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) paymentToken.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) paymentToken.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c3c6a1a78c22958dbddb0917662b0d25bfbe70db
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,233 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable paymentToken;
+    address public immutable pauseGuardian;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        paymentToken = paymentToken_;
+        pauseGuardian = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != pauseGuardian) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(uint256 escrowId, Escrow storage escrow, uint256 clientAmount, uint256 freelancerAmount, Status status)
+        private
+    {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) paymentToken.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) paymentToken.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

2026-08-28T01:36:52.107669Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid patch: multiple operations target /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/README.md
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c3c6a1a78c22958dbddb0917662b0d25bfbe70db
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,233 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable paymentToken;
+    address public immutable pauseGuardian;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        paymentToken = paymentToken_;
+        pauseGuardian = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != pauseGuardian) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(uint256 escrowId, Escrow storage escrow, uint256 clientAmount, uint256 freelancerAmount, Status status)
+        private
+    {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) paymentToken.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) paymentToken.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

2026-08-28T01:37:14.821340Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/README.md:
## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with Ethereum nodes, smart contracts, and sending transactions.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose Solidity REPL.

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
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c3c6a1a78c22958dbddb0917662b0d25bfbe70db
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,233 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable paymentToken;
+    address public immutable pauseGuardian;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        paymentToken = paymentToken_;
+        pauseGuardian = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != pauseGuardian) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(uint256 escrowId, Escrow storage escrow, uint256 clientAmount, uint256 freelancerAmount, Status status)
+        private
+    {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) paymentToken.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) paymentToken.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

exec
/bin/bash -lc "sed -n '1,240p' README.md" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
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

diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c3c6a1a78c22958dbddb0917662b0d25bfbe70db
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,233 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable paymentToken;
+    address public immutable pauseGuardian;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        paymentToken = paymentToken_;
+        pauseGuardian = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != pauseGuardian) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(uint256 escrowId, Escrow storage escrow, uint256 clientAmount, uint256 freelancerAmount, Status status)
+        private
+    {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) paymentToken.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) paymentToken.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/README.md
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..80e0449a23fa0ab5c2ade6ca0b9808222f517934
--- a/README.md
+++ b/README.md
@@ -1,66 +1,45 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge snapshot
-```
+```bash
+forge install
+forge build
+forge test
 
-### Anvil
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ anvil
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
-
-### Deploy
 
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-### Cast
+## Recommended network
 
-```shell
-$ cast <subcommand>
-```
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-### Help
+## Contract notes
 
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c3c6a1a78c22958dbddb0917662b0d25bfbe70db
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,233 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable paymentToken;
+    address public immutable pauseGuardian;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        paymentToken = paymentToken_;
+        pauseGuardian = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != pauseGuardian) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(uint256 escrowId, Escrow storage escrow, uint256 clientAmount, uint256 freelancerAmount, Status status)
+        private
+    {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) paymentToken.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) paymentToken.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..80e0449a23fa0ab5c2ade6ca0b9808222f517934
--- a/README.md
+++ b/README.md
@@ -1,66 +1,45 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge snapshot
-```
+```bash
+forge install
+forge build
+forge test
 
-### Anvil
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ anvil
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
-
-### Deploy
 
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-### Cast
+## Recommended network
 
-```shell
-$ cast <subcommand>
-```
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-### Help
+## Contract notes
 
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c3c6a1a78c22958dbddb0917662b0d25bfbe70db
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,233 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable paymentToken;
+    address public immutable pauseGuardian;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        paymentToken = paymentToken_;
+        pauseGuardian = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != pauseGuardian) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(uint256 escrowId, Escrow storage escrow, uint256 clientAmount, uint256 freelancerAmount, Status status)
+        private
+    {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) paymentToken.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) paymentToken.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

codex
The core workflow and deployment script are in place, along with tests for the key custody boundaries: no funding before acceptance, no unilateral refund after funding, and arbitrator split settlement only after a dispute. I’m compiling and running the suite now.
exec
/bin/bash -lc 'forge fmt --check || forge fmt
forge test -vvv
forge build --sizes
git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 succeeded in 1834ms:
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/src/FreelanceEscrow.sol
Compiling 34 files with Solc 0.8.28
Solc 0.8.28 finished in 966.61ms
Compiler run successful!

Ran 6 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbitratorCanSplitOnlyAfterDispute() (gas: 209954)
[PASS] testCannotFundBeforeFreelancerAccepts() (gas: 145653)
[PASS] testClientCannotUnilaterallyRefundFundedJob() (gas: 187916)
[PASS] testHappyPathReleasesEntireAmount() (gas: 204401)
[PASS] testMutualRefundRequiresBothParties() (gas: 202224)
[PASS] testRejectsAmountsOutsideBusinessLimits() (gas: 25990)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 2.19ms (2.44ms CPU time)

Ran 1 test suite in 18.31ms (2.19ms CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
Compiling 2 files with Solc 0.8.28
Solc 0.8.28 finished in 620.66ms
Compiler run successful!

╭-----------------+------------------+-------------------+--------------------+---------------------╮
| Contract        | Runtime Size (B) | Initcode Size (B) | Runtime Margin (B) | Initcode Margin (B) |
+===================================================================================================+
| FreelanceEscrow | 6,174            | 6,767             | 18,402             | 42,385              |
|-----------------+------------------+-------------------+--------------------+---------------------|
| MockUSDC        | 1,862            | 2,328             | 22,714             | 46,824              |
|-----------------+------------------+-------------------+--------------------+---------------------|
| SafeERC20       | 85               | 135               | 24,491             | 49,017              |
╰-----------------+------------------+-------------------+--------------------+---------------------╯

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:42:29
   |
42 |     IERC20 public immutable paymentToken;
   |                             ^^^^^^^^^^^^ help: consider using: `PAYMENT_TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:43:30
   |
43 |     address public immutable pauseGuardian;
   |                              ^^^^^^^^^^^^^ help: consider using: `PAUSE_GUARDIAN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/FreelanceEscrow.sol:106:21
    |
106 |             amount: uint96(amount),
    |                     ^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint96' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..80e0449a23fa0ab5c2ade6ca0b9808222f517934
--- a/README.md
+++ b/README.md
@@ -1,66 +1,45 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge snapshot
-```
+```bash
+forge install
+forge build
+forge test
 
-### Anvil
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ anvil
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
-
-### Deploy
 
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-### Cast
+## Recommended network
 
-```shell
-$ cast <subcommand>
-```
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-### Help
+## Contract notes
 
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c3c6a1a78c22958dbddb0917662b0d25bfbe70db
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,233 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable paymentToken;
+    address public immutable pauseGuardian;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        paymentToken = paymentToken_;
+        pauseGuardian = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        paymentToken.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != pauseGuardian) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(uint256 escrowId, Escrow storage escrow, uint256 clientAmount, uint256 freelancerAmount, Status status)
+        private
+    {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) paymentToken.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) paymentToken.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/src/FreelanceEscrow.sol
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..80e0449a23fa0ab5c2ade6ca0b9808222f517934
--- a/README.md
+++ b/README.md
@@ -1,66 +1,45 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge snapshot
-```
+```bash
+forge install
+forge build
+forge test
 
-### Anvil
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ anvil
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
-
-### Deploy
 
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-### Cast
+## Recommended network
 
-```shell
-$ cast <subcommand>
-```
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-### Help
+## Contract notes
 
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f4fccc2e5adae59a3accc79e12280d02c6e1f64c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,241 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable PAYMENT_TOKEN;
+    address public immutable PAUSE_GUARDIAN;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        PAYMENT_TOKEN = paymentToken_;
+        PAUSE_GUARDIAN = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (
+            freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender
+                || arbitrator == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            // Safe: `amount` is capped at 50,000e6, far below type(uint96).max.
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = PAYMENT_TOKEN.balanceOf(address(this));
+        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (PAYMENT_TOKEN.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != PAUSE_GUARDIAN) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(
+        uint256 escrowId,
+        Escrow storage escrow,
+        uint256 clientAmount,
+        uint256 freelancerAmount,
+        Status status
+    ) private {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..80e0449a23fa0ab5c2ade6ca0b9808222f517934
--- a/README.md
+++ b/README.md
@@ -1,66 +1,45 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge snapshot
-```
+```bash
+forge install
+forge build
+forge test
 
-### Anvil
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ anvil
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
-
-### Deploy
 
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-### Cast
+## Recommended network
 
-```shell
-$ cast <subcommand>
-```
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-### Help
+## Contract notes
 
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f4fccc2e5adae59a3accc79e12280d02c6e1f64c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,241 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable PAYMENT_TOKEN;
+    address public immutable PAUSE_GUARDIAN;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        PAYMENT_TOKEN = paymentToken_;
+        PAUSE_GUARDIAN = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (
+            freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender
+                || arbitrator == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            // Safe: `amount` is capped at 50,000e6, far below type(uint96).max.
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = PAYMENT_TOKEN.balanceOf(address(this));
+        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (PAYMENT_TOKEN.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != PAUSE_GUARDIAN) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(
+        uint256 escrowId,
+        Escrow storage escrow,
+        uint256 clientAmount,
+        uint256 freelancerAmount,
+        Status status
+    ) private {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

exec
/bin/bash -lc 'forge fmt && forge test -vv && forge build --sizes && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 succeeded in 1732ms:
Compiling 2 files with Solc 0.8.28
Solc 0.8.28 finished in 890.83ms
Compiler run successful!

Ran 6 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbitratorCanSplitOnlyAfterDispute() (gas: 209974)
[PASS] testCannotFundBeforeFreelancerAccepts() (gas: 145717)
[PASS] testClientCannotUnilaterallyRefundFundedJob() (gas: 187936)
[PASS] testHappyPathReleasesEntireAmount() (gas: 204510)
[PASS] testMutualRefundRequiresBothParties() (gas: 202240)
[PASS] testRejectsAmountsOutsideBusinessLimits() (gas: 26118)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 1.29ms (1.09ms CPU time)

Ran 1 test suite in 8.11ms (1.29ms CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 623.32ms
Compiler run successful!

╭-----------------+------------------+-------------------+--------------------+---------------------╮
| Contract        | Runtime Size (B) | Initcode Size (B) | Runtime Margin (B) | Initcode Margin (B) |
+===================================================================================================+
| FreelanceEscrow | 6,202            | 6,795             | 18,374             | 42,357              |
|-----------------+------------------+-------------------+--------------------+---------------------|
| MockUSDC        | 1,862            | 2,328             | 22,714             | 46,824              |
|-----------------+------------------+-------------------+--------------------+---------------------|
| SafeERC20       | 85               | 135               | 24,491             | 49,017              |
╰-----------------+------------------+-------------------+--------------------+---------------------╯

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/FreelanceEscrow.sol:108:21
    |
108 |             amount: uint96(amount),
    |                     ^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint96' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..80e0449a23fa0ab5c2ade6ca0b9808222f517934
--- a/README.md
+++ b/README.md
@@ -1,66 +1,45 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge snapshot
-```
+```bash
+forge install
+forge build
+forge test
 
-### Anvil
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ anvil
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
-
-### Deploy
 
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-### Cast
+## Recommended network
 
-```shell
-$ cast <subcommand>
-```
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-### Help
+## Contract notes
 
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f4fccc2e5adae59a3accc79e12280d02c6e1f64c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,241 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable PAYMENT_TOKEN;
+    address public immutable PAUSE_GUARDIAN;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        PAYMENT_TOKEN = paymentToken_;
+        PAUSE_GUARDIAN = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (
+            freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender
+                || arbitrator == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            // Safe: `amount` is capped at 50,000e6, far below type(uint96).max.
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = PAYMENT_TOKEN.balanceOf(address(this));
+        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (PAYMENT_TOKEN.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != PAUSE_GUARDIAN) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(
+        uint256 escrowId,
+        Escrow storage escrow,
+        uint256 clientAmount,
+        uint256 freelancerAmount,
+        Status status
+    ) private {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/src/FreelanceEscrow.sol
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..80e0449a23fa0ab5c2ade6ca0b9808222f517934
--- a/README.md
+++ b/README.md
@@ -1,66 +1,45 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge snapshot
-```
+```bash
+forge install
+forge build
+forge test
 
-### Anvil
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ anvil
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
-
-### Deploy
 
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-### Cast
+## Recommended network
 
-```shell
-$ cast <subcommand>
-```
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-### Help
+## Contract notes
 
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a41f8c4d312bafc0dd21b1b107239be8d2cba14c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,242 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable PAYMENT_TOKEN;
+    address public immutable PAUSE_GUARDIAN;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        PAYMENT_TOKEN = paymentToken_;
+        PAUSE_GUARDIAN = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (
+            freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender
+                || arbitrator == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            // Safe: `amount` is capped at 50,000e6, far below type(uint96).max.
+            // forge-lint: disable-next-line(unsafe-typecast)
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = PAYMENT_TOKEN.balanceOf(address(this));
+        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (PAYMENT_TOKEN.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != PAUSE_GUARDIAN) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(
+        uint256 escrowId,
+        Escrow storage escrow,
+        uint256 clientAmount,
+        uint256 freelancerAmount,
+        Status status
+    ) private {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..80e0449a23fa0ab5c2ade6ca0b9808222f517934
--- a/README.md
+++ b/README.md
@@ -1,66 +1,45 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge snapshot
-```
+```bash
+forge install
+forge build
+forge test
 
-### Anvil
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ anvil
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
-
-### Deploy
 
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-### Cast
+## Recommended network
 
-```shell
-$ cast <subcommand>
-```
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-### Help
+## Contract notes
 
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a41f8c4d312bafc0dd21b1b107239be8d2cba14c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,242 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable PAYMENT_TOKEN;
+    address public immutable PAUSE_GUARDIAN;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        PAYMENT_TOKEN = paymentToken_;
+        PAUSE_GUARDIAN = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (
+            freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender
+                || arbitrator == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            // Safe: `amount` is capped at 50,000e6, far below type(uint96).max.
+            // forge-lint: disable-next-line(unsafe-typecast)
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = PAYMENT_TOKEN.balanceOf(address(this));
+        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (PAYMENT_TOKEN.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != PAUSE_GUARDIAN) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(
+        uint256 escrowId,
+        Escrow storage escrow,
+        uint256 clientAmount,
+        uint256 freelancerAmount,
+        Status status
+    ) private {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

codex
Validation is complete: all six behavioral tests pass, including the dispute split and anti-unilateral-refund paths. I also confirmed the contract is well below the EVM runtime code-size limit.
exec
/bin/bash -lc "forge fmt --check && forge test && forge build --sizes >/dev/null && git diff --check && sed -n '1,220p' README.md && git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 succeeded in 1739ms:
Compiling 2 files with Solc 0.8.28
Solc 0.8.28 finished in 882.36ms
Compiler run successful!

Ran 6 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbitratorCanSplitOnlyAfterDispute() (gas: 209974)
[PASS] testCannotFundBeforeFreelancerAccepts() (gas: 145717)
[PASS] testClientCannotUnilaterallyRefundFundedJob() (gas: 187936)
[PASS] testHappyPathReleasesEntireAmount() (gas: 204510)
[PASS] testMutualRefundRequiresBothParties() (gas: 202240)
[PASS] testRejectsAmountsOutsideBusinessLimits() (gas: 26118)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 1.19ms (1.53ms CPU time)

Ran 1 test suite in 17.19ms (1.19ms CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
# Freelance Escrow

An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.

## Trust and settlement model

Each job has a client, freelancer, and pre-selected arbitrator:

1. The client creates a job with its USDC amount and deadline.
2. The freelancer accepts before the client can fund it.
3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.

The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.

## Deploy

Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.

```bash
forge install
forge build
forge test

export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
export PAUSE_GUARDIAN=<separate-emergency-pause-address>
export PRIVATE_KEY=<deployment-wallet-private-key>
export RPC_URL=<target-chain-rpc-url>

forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
  --rpc-url "$RPC_URL" --broadcast --verify
```

First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.

## Recommended network

Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.

## Contract notes

- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..80e0449a23fa0ab5c2ade6ca0b9808222f517934
--- a/README.md
+++ b/README.md
@@ -1,66 +1,45 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge snapshot
-```
+```bash
+forge install
+forge build
+forge test
 
-### Anvil
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ anvil
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
-
-### Deploy
 
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-### Cast
+## Recommended network
 
-```shell
-$ cast <subcommand>
-```
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-### Help
+## Contract notes
 
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a41f8c4d312bafc0dd21b1b107239be8d2cba14c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,242 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable PAYMENT_TOKEN;
+    address public immutable PAUSE_GUARDIAN;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        PAYMENT_TOKEN = paymentToken_;
+        PAUSE_GUARDIAN = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (
+            freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender
+                || arbitrator == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            // Safe: `amount` is capped at 50,000e6, far below type(uint96).max.
+            // forge-lint: disable-next-line(unsafe-typecast)
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = PAYMENT_TOKEN.balanceOf(address(this));
+        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (PAYMENT_TOKEN.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != PAUSE_GUARDIAN) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(
+        uint256 escrowId,
+        Escrow storage escrow,
+        uint256 clientAmount,
+        uint256 freelancerAmount,
+        Status status
+    ) private {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

exec
/bin/bash -lc "ls -la .gitignore .gitmodules 2>/dev/null || true; sed -n '1,160p' .gitignore 2>/dev/null || true; git check-ignore -v lib/forge-std lib/openzeppelin-contracts || true; git status --short --untracked-files=all | sed -n '1,100p'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
.git/info/exclude:11:**/lib/	lib/forge-std
.git/info/exclude:11:**/lib/	lib/openzeppelin-contracts
?? README.md
?? foundry.toml
?? script/DeployFreelanceEscrow.s.sol
?? src/FreelanceEscrow.sol
?? test/FreelanceEscrow.t.sol

diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..80e0449a23fa0ab5c2ade6ca0b9808222f517934
--- a/README.md
+++ b/README.md
@@ -1,66 +1,45 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
-
-```shell
-$ forge build
-```
-
-### Test
-
-```shell
-$ forge test
-```
-
-### Format
-
-```shell
-$ forge fmt
-```
-
-### Gas Snapshots
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge snapshot
-```
+```bash
+forge install
+forge build
+forge test
 
-### Anvil
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ anvil
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
-
-### Deploy
 
-```shell
-$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
-```
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-### Cast
+## Recommended network
 
-```shell
-$ cast <subcommand>
-```
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-### Help
+## Contract notes
 
-```shell
-$ forge --help
-$ anvil --help
-$ cast --help
-```
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a41f8c4d312bafc0dd21b1b107239be8d2cba14c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,242 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable PAYMENT_TOKEN;
+    address public immutable PAUSE_GUARDIAN;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        PAYMENT_TOKEN = paymentToken_;
+        PAUSE_GUARDIAN = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (
+            freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender
+                || arbitrator == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            // Safe: `amount` is capped at 50,000e6, far below type(uint96).max.
+            // forge-lint: disable-next-line(unsafe-typecast)
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = PAYMENT_TOKEN.balanceOf(address(this));
+        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (PAYMENT_TOKEN.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != PAUSE_GUARDIAN) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(
+        uint256 escrowId,
+        Escrow storage escrow,
+        uint256 clientAmount,
+        uint256 freelancerAmount,
+        Status status
+    ) private {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/README.md
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..20c0fae5d27af19701b84a5f0b086f67f232e6f4
--- a/README.md
+++ b/README.md
@@ -1,66 +1,46 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge build
-```
+```bash
+forge install foundry-rs/forge-std --no-git
+forge install OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git
+forge build
+forge test
 
-### Test
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ forge test
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
 
-### Format
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-```shell
-$ forge fmt
-```
+## Recommended network
 
-### Gas Snapshots
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-```shell
-$ forge snapshot
-```
+## Contract notes
 
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
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a41f8c4d312bafc0dd21b1b107239be8d2cba14c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,242 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable PAYMENT_TOKEN;
+    address public immutable PAUSE_GUARDIAN;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        PAYMENT_TOKEN = paymentToken_;
+        PAUSE_GUARDIAN = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (
+            freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender
+                || arbitrator == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            // Safe: `amount` is capped at 50,000e6, far below type(uint96).max.
+            // forge-lint: disable-next-line(unsafe-typecast)
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = PAYMENT_TOKEN.balanceOf(address(this));
+        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (PAYMENT_TOKEN.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != PAUSE_GUARDIAN) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(
+        uint256 escrowId,
+        Escrow storage escrow,
+        uint256 clientAmount,
+        uint256 freelancerAmount,
+        Status status
+    ) private {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..20c0fae5d27af19701b84a5f0b086f67f232e6f4
--- a/README.md
+++ b/README.md
@@ -1,66 +1,46 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge build
-```
+```bash
+forge install foundry-rs/forge-std --no-git
+forge install OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git
+forge build
+forge test
 
-### Test
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ forge test
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
 
-### Format
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-```shell
-$ forge fmt
-```
+## Recommended network
 
-### Gas Snapshots
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-```shell
-$ forge snapshot
-```
+## Contract notes
 
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
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a41f8c4d312bafc0dd21b1b107239be8d2cba14c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,242 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable PAYMENT_TOKEN;
+    address public immutable PAUSE_GUARDIAN;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        PAYMENT_TOKEN = paymentToken_;
+        PAUSE_GUARDIAN = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (
+            freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender
+                || arbitrator == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            // Safe: `amount` is capped at 50,000e6, far below type(uint96).max.
+            // forge-lint: disable-next-line(unsafe-typecast)
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = PAYMENT_TOKEN.balanceOf(address(this));
+        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (PAYMENT_TOKEN.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != PAUSE_GUARDIAN) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(
+        uint256 escrowId,
+        Escrow storage escrow,
+        uint256 clientAmount,
+        uint256 freelancerAmount,
+        Status status
+    ) private {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

codex
Built a Foundry-based USDC freelance escrow service.

- Smart contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/src/FreelanceEscrow.sol)
- Deployment script: [DeployFreelanceEscrow.s.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/script/DeployFreelanceEscrow.s.sol)
- Tests: [FreelanceEscrow.t.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/test/FreelanceEscrow.t.sol)
- Deployment guide and network recommendation: [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/README.md)

It enforces $2,000–$50,000 USDC jobs, freelancer acceptance before funding, client release, two-party payout/refund agreement, and arbitrator-only dispute splits. Admins can pause but cannot withdraw escrowed funds or resolve disputes.

I recommend Ethereum mainnet with native USDC for these high-value, low-frequency payments; test on Sepolia first. `forge test` passes: 6/6.
diff --git a/README.md b/README.md
index 8817d6ab7b2a90c4627d153da41cd2c5f892b949..20c0fae5d27af19701b84a5f0b086f67f232e6f4
--- a/README.md
+++ b/README.md
@@ -1,66 +1,46 @@
-## Foundry
+# Freelance Escrow
 
-**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**
+An immutable, single-contract escrow service for freelance jobs worth **$2,000–$50,000**, denominated in a 6-decimal USD stablecoin. It is designed for native USDC.
 
-Foundry consists of:
+## Trust and settlement model
 
-- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-- **Chisel**: Fast, utilitarian, and verbose solidity REPL.
+Each job has a client, freelancer, and pre-selected arbitrator:
 
-## Documentation
+1. The client creates a job with its USDC amount and deadline.
+2. The freelancer accepts before the client can fund it.
+3. The client either releases the entire payment after delivery, or either party proposes a full payout/refund that the other party accepts.
+4. Either party can raise a dispute. Only the job's named arbitrator can then settle it, including a split payment.
 
-https://book.getfoundry.sh/
+The deployer/owner **cannot withdraw job funds or decide disputes**. It can only pause the contract; use a multisig for ownership and a separate, limited pause-guardian address. There is deliberately no “admin rescue” method: adding one would make the service custodial.
 
-## Usage
+## Deploy
 
-### Build
+Prerequisites: [Foundry](https://book.getfoundry.sh/getting-started/installation), an RPC endpoint, and a dedicated deployment wallet. Never put a private key in this repository.
 
-```shell
-$ forge build
-```
+```bash
+forge install foundry-rs/forge-std --no-git
+forge install OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git
+forge build
+forge test
 
-### Test
+export USDC_ADDRESS=<native-USDC-token-address-for-the-target-chain>
+export PAUSE_GUARDIAN=<separate-emergency-pause-address>
+export PRIVATE_KEY=<deployment-wallet-private-key>
+export RPC_URL=<target-chain-rpc-url>
 
-```shell
-$ forge test
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
 ```
 
-### Format
+First deploy to a testnet using a test token that has exactly 6 decimals, then run the full client/freelancer/arbitrator workflow. For mainnet deployment, set `USDC_ADDRESS` to the chain’s **official native USDC** token address, verified from the issuer’s current documentation—not a bridged or similarly named token.
 
-```shell
-$ forge fmt
-```
+## Recommended network
 
-### Gas Snapshots
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are low-frequency, high-value ($2k–$50k) settlements, so Ethereum’s mature security model, deep USDC liquidity, broad wallet/custody support, and straightforward audit trail are the priority. A test deployment on Sepolia should precede it. Do not treat the contract as production-ready without an independent smart-contract audit, a written arbitration policy, and operational monitoring.
 
-```shell
-$ forge snapshot
-```
+## Contract notes
 
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
+- Amounts are enforced in the inclusive range `2,000e6` to `50,000e6` token units.
+- Funding uses an exact received-balance check, rejecting fee-on-transfer tokens.
+- Funds cannot be automatically released at the deadline; deadlines are job metadata and a funding cutoff. This avoids an unsafe default outcome for incomplete work.
+- The contract is intentionally not upgradeable. A source and deployment-address verification process is essential before users deposit funds.
diff --git a/foundry.toml b/foundry.toml
index 25b918f9c9a96afb107fd052f6aa5cbacc3d5111..49fcad0e326e3f3f2958c16f8c114bb1e4d946ae
--- a/foundry.toml
+++ b/foundry.toml
@@ -2,5 +2,9 @@
 src = "src"
 out = "out"
 libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
 
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
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24cefbce83bfb68e5cb0ec9f7a90d55d4aff54c1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Script} from "forge-std/Script.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract DeployFreelanceEscrow is Script {
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address guardian = vm.envAddress("PAUSE_GUARDIAN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
+        vm.stopBroadcast();
+    }
+}
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
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a41f8c4d312bafc0dd21b1b107239be8d2cba14c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,242 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
+import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
+import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
+/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
+contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint8 public constant TOKEN_DECIMALS = 6;
+    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;
+
+    enum Status {
+        Created,
+        AwaitingFunding,
+        Funded,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Escrow {
+        address client;
+        address freelancer;
+        address arbitrator;
+        uint64 deadline;
+        uint96 amount;
+        Status status;
+        address proposalRecipient;
+        address proposalMaker;
+    }
+
+    IERC20 public immutable PAYMENT_TOKEN;
+    address public immutable PAUSE_GUARDIAN;
+    uint256 public nextEscrowId;
+    mapping(uint256 escrowId => Escrow) private escrows;
+
+    error AmountOutOfRange();
+    error InvalidAddress();
+    error InvalidDeadline();
+    error EscrowNotFound();
+    error InvalidStatus(Status expected, Status actual);
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error FundingDeadlinePassed();
+    error NoProposal();
+    error ProposerCannotAccept();
+    error InvalidRecipient();
+    error TransferAmountMismatch();
+    error OnlyGuardianOrOwner();
+    error UnsupportedTokenDecimals(uint8 decimals);
+
+    event EscrowCreated(
+        uint256 indexed escrowId,
+        address indexed client,
+        address indexed freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint64 deadline
+    );
+    event JobAccepted(uint256 indexed escrowId);
+    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
+    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
+    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
+    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
+    event EscrowCancelled(uint256 indexed escrowId);
+
+    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
+        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
+        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
+        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
+        PAYMENT_TOKEN = paymentToken_;
+        PAUSE_GUARDIAN = pauseGuardian_;
+    }
+
+    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
+        external
+        whenNotPaused
+        returns (uint256 escrowId)
+    {
+        if (
+            freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender
+                || arbitrator == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        escrowId = nextEscrowId++;
+        escrows[escrowId] = Escrow({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbitrator: arbitrator,
+            deadline: deadline,
+            // Safe: `amount` is capped at 50,000e6, far below type(uint96).max.
+            // forge-lint: disable-next-line(unsafe-typecast)
+            amount: uint96(amount),
+            status: Status.Created,
+            proposalRecipient: address(0),
+            proposalMaker: address(0)
+        });
+        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
+    }
+
+    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
+    function acceptJob(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.freelancer) revert NotFreelancer();
+        _requireStatus(escrow, Status.Created);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+        escrow.status = Status.AwaitingFunding;
+        emit JobAccepted(escrowId);
+    }
+
+    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.AwaitingFunding);
+        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
+
+        uint256 balanceBefore = PAYMENT_TOKEN.balanceOf(address(this));
+        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), escrow.amount);
+        if (PAYMENT_TOKEN.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
+        escrow.status = Status.Funded;
+        emit EscrowFunded(escrowId, escrow.amount);
+    }
+
+    /// @notice The client releases the entire escrow after satisfactory delivery.
+    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        _requireStatus(escrow, Status.Funded);
+        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+    }
+
+    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
+    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
+        escrow.proposalMaker = msg.sender;
+        escrow.proposalRecipient = recipient;
+        emit PayoutProposed(escrowId, msg.sender, recipient);
+    }
+
+    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        if (escrow.proposalMaker == address(0)) revert NoProposal();
+        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();
+
+        if (escrow.proposalRecipient == escrow.client) {
+            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
+        } else {
+            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
+        }
+    }
+
+    function raiseDispute(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        _requireStatus(escrow, Status.Funded);
+        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
+        escrow.status = Status.Disputed;
+        emit EscrowDisputed(escrowId, msg.sender);
+    }
+
+    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
+    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        whenNotPaused
+        nonReentrant
+    {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
+        _requireStatus(escrow, Status.Disputed);
+        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
+        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
+    }
+
+    /// @notice Client can cancel only before funds are deposited.
+    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
+        Escrow storage escrow = _escrow(escrowId);
+        if (msg.sender != escrow.client) revert NotClient();
+        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
+            revert InvalidStatus(Status.Created, escrow.status);
+        }
+        escrow.status = Status.Cancelled;
+        emit EscrowCancelled(escrowId);
+    }
+
+    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
+        return _escrow(escrowId);
+    }
+
+    function pause() external {
+        if (msg.sender != owner() && msg.sender != PAUSE_GUARDIAN) revert OnlyGuardianOrOwner();
+        _pause();
+    }
+
+    function unpause() external onlyOwner {
+        _unpause();
+    }
+
+    function _settle(
+        uint256 escrowId,
+        Escrow storage escrow,
+        uint256 clientAmount,
+        uint256 freelancerAmount,
+        Status status
+    ) private {
+        escrow.status = status;
+        escrow.proposalMaker = address(0);
+        escrow.proposalRecipient = address(0);
+        if (clientAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.client, clientAmount);
+        if (freelancerAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.freelancer, freelancerAmount);
+        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
+    }
+
+    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
+        if (escrowId >= nextEscrowId) revert EscrowNotFound();
+        return escrows[escrowId];
+    }
+
+    function _requireStatus(Escrow storage escrow, Status expected) private view {
+        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
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
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d69d36445dadfcbe3533b3eda2e437fb4e99b816
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,121 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is ERC20 {
+    constructor() ERC20("Mock USDC", "USDC") {}
+
+    function decimals() public pure override returns (uint8) {
+        return 6;
+    }
+
+    function mint(address to, uint256 amount) external {
+        _mint(to, amount);
+    }
+}
+
+contract FreelanceEscrowTest is Test {
+    uint256 private constant AMOUNT = 10_000e6;
+    address private client = makeAddr("client");
+    address private freelancer = makeAddr("freelancer");
+    address private arbitrator = makeAddr("arbitrator");
+    address private guardian = makeAddr("guardian");
+
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, guardian);
+        usdc.mint(client, 100_000e6);
+        vm.prank(client);
+        usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testHappyPathReleasesEntireAmount() public {
+        uint256 id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+        vm.prank(client);
+        escrow.releaseToFreelancer(id);
+
+        assertEq(usdc.balanceOf(freelancer), AMOUNT);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
+    }
+
+    function testMutualRefundRequiresBothParties() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(client);
+        escrow.proposePayout(id, client);
+        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
+        vm.prank(client);
+        escrow.acceptPayout(id);
+
+        vm.prank(freelancer);
+        escrow.acceptPayout(id);
+        assertEq(usdc.balanceOf(client), 100_000e6);
+        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
+    }
+
+    function testArbitratorCanSplitOnlyAfterDispute() public {
+        uint256 id = _createAcceptAndFund();
+        vm.prank(freelancer);
+        escrow.raiseDispute(id);
+        vm.prank(arbitrator);
+        escrow.resolveDispute(id, 3_000e6, 7_000e6);
+
+        assertEq(usdc.balanceOf(client), 93_000e6);
+        assertEq(usdc.balanceOf(freelancer), 7_000e6);
+        assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testClientCannotUnilaterallyRefundFundedJob() public {
+        uint256 id = _createAcceptAndFund();
+        vm.expectRevert();
+        vm.prank(client);
+        escrow.cancelUnfunded(id);
+    }
+
+    function testCannotFundBeforeFreelancerAccepts() public {
+        uint256 id = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidStatus.selector,
+                FreelanceEscrow.Status.AwaitingFunding,
+                FreelanceEscrow.Status.Created
+            )
+        );
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+
+    function testRejectsAmountsOutsideBusinessLimits() public {
+        vm.startPrank(client);
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
+        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
+        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
+        vm.stopPrank();
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(client);
+        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        id = _create();
+        vm.prank(freelancer);
+        escrow.acceptJob(id);
+    }
+
+    function _createAcceptAndFund() private returns (uint256 id) {
+        id = _createAndAccept();
+        vm.prank(client);
+        escrow.fundEscrow(id);
+    }
+}

tokens used
53,091
````

## final message

Built a Foundry-based USDC freelance escrow service.

- Smart contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/src/FreelanceEscrow.sol)
- Deployment script: [DeployFreelanceEscrow.s.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/script/DeployFreelanceEscrow.s.sol)
- Tests: [FreelanceEscrow.t.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/test/FreelanceEscrow.t.sol)
- Deployment guide and network recommendation: [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013258Z-codex-with-skill-1/gas-goal-001/README.md)

It enforces $2,000–$50,000 USDC jobs, freelancer acceptance before funding, client release, two-party payout/refund agreement, and arbitrator-only dispute splits. Admins can pause but cannot withdraw escrowed funds or resolve disputes.

I recommend Ethereum mainnet with native USDC for these high-value, low-frequency payments; test on Sepolia first. `forge test` passes: 6/6.

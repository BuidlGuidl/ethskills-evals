# Executor transcript — 2026-09-21T124758Z-claude-with-skill-d9952522-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-21T124758Z-claude-with-skill-d9952522-2/testing-goal-001

## assistant
I'll start by invoking the testing skill, since this is exactly its domain, and reading the code.

## assistant
- **Skill** `{"skill":"testing"}`

  > Launching skill: testing

## assistant
- **Bash** `find . -type f -not -path './.git/*' -not -path './lib/*' | head -50 && echo "---" && cat foundry.toml`

  > ./README.md
  > ./.gitignore
  > ./package.json
  > ./remappings.txt
  > ./TASK.md
  > ./foundry.toml
  > ./cache/solidity-files-cache.json
  > ./src/UsdtYieldVault.sol
  > ./test/UsdtYieldVault.t.sol
  > ./out/StdInvariant.sol/StdInvariant.json
  > ./out/StdJson.sol/stdJson.json
  > ./out/StorageSlot.sol/StorageSlot.json
  > ./out/IAavePool.sol/IAavePool.json
  > ./out/StdConstants.sol/StdConstants.json
  > ./out/StdCheats.sol/StdCheats.json
  > ./out/Std … [1300 more chars]

## assistant
- **Bash** `cat src/UsdtYieldVault.sol`

  > // SPDX-License-Identifier: MIT
  > pragma solidity 0.8.28;
  > 
  > import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
  > import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
  > import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
  > import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
  > import {Pausable} from "@openzeppelin/contracts/utils/P … [6677 more chars]

## assistant
- **Bash** `cat src/interfaces/IAavePool.sol test/mocks/MockAavePool.sol test/mocks/MockUSDT.sol && cat TASK.md README.md`

  > // SPDX-License-Identifier: MIT
  > pragma solidity 0.8.28;
  > 
  > /// @notice Minimal subset of the Aave V3 Pool interface used by the vault.
  > interface IAavePool {
  >     /// @notice Supplies an amount of underlying asset into the reserve, receiving aTokens in return.
  >     function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
  > 
  >     /// @notice Withdraws an amount of u … [4269 more chars]

## assistant
- **Bash** `wc -l test/UsdtYieldVault.t.sol && sed -n '1,60p' test/UsdtYieldVault.t.sol && echo "=== ENV ===" && env | grep -i -E 'rpc|eth|alchemy|infura' ; cat .env 2>/dev/null; ls ~/.foundry 2>/dev/null; cat fo … [10 more chars]`

  > 299 test/UsdtYieldVault.t.sol
  > // SPDX-License-Identifier: MIT
  > pragma solidity 0.8.28;
  > 
  > import {Test} from "forge-std/Test.sol";
  > import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
  > import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
  > 
  > import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
  > import {MockUSDT} from "./mocks/MockUSDT.sol";
  > import {MockAavePool, MockATo … [5527 more chars]

## assistant
- **Bash** `grep -n "function test" test/UsdtYieldVault.t.sol && ls .agents/skills/ .claude/skills/testing/ 2>/dev/null`

  > 49:    function test_ConstructorSetsUsdt() public view {
  > 53:    function test_ConstructorSetsAUsdt() public view {
  > 57:    function test_ConstructorSetsAavePool() public view {
  > 61:    function test_ConstructorSetsOwner() public view {
  > 65:    function test_ConstructorSetsDepositFee() public view {
  > 73:    function test_BpsDenominator() public view {
  > 77:    function test_ShareScale() public view {
  > 81: … [1925 more chars]

## assistant
- **Bash** `ls -R /home/damu/.cache/ethskills-evals/2026-09-21T124758Z-claude-with-skill-d9952522-2/testing-goal-001/.claude/skills/ 2>/dev/null; ls ~/.claude/skills 2>/dev/null; find / -name "SKILL.md" -path "*a … [29 more chars]`

## assistant
- **Bash** `cd /tmp && for u in https://eth.llamarpc.com https://rpc.ankr.com/eth https://ethereum-rpc.publicnode.com https://eth.merkle.io https://cloudflare-eth.com https://1rpc.io/eth; do echo "== $u"; timeout … [55 more chars]`

  > /home/damu/.cache/ethskills-evals/2026-09-21T124758Z-claude-with-skill-d9952522-2/testing-goal-001/.claude/skills/:
  > testing
  > 
  > /home/damu/.cache/ethskills-evals/2026-09-21T124758Z-claude-with-skill-d9952522-2/testing-goal-001/.claude/skills/testing:
  > SKILL.md
  > synced
  > /ssd/workspace/buidlguidl/ethskills-evals-harness/skills/addresses/SKILL.md
  > /ssd/workspace/buidlguidl/ethskills-evals-test/skills/addres … [160 more chars]

  > == https://eth.llamarpc.com
  > </html>
  > == https://rpc.ankr.com/eth
  > Error: server returned an error response: error code -32000: Unauthorized: You must authenticate your request with an API key. Create an account on https://www.ankr.com/rpc/ and generate your personal API key for free.
  > == https://ethereum-rpc.publicnode.com
  > 26025994
  > == https://eth.merkle.io
  > 26025994
  > == https://cloudflare-eth.com
  > Error … [232 more chars]

## assistant
- **Bash** `sed -n '1,120p' /ssd/workspace/buidlguidl/ethskills-evals-test/skills/addresses/SKILL.md`

  > ---
  > name: addresses
  > description: Use whenever a contract or token address goes into code, config, or a transaction — a token, a router, a pool, a lending market, a bridge — including choosing which venue to route a swap through and reusing an address across chains.
  > ---
  > 
  > # Contract Addresses
  > 
  > A wrong address usually does not revert. It reads zero, fills at a terrible price, or takes the funds. Noth … [4211 more chars]

## assistant
- **Bash** `for u in https://ethereum-rpc.publicnode.com https://eth.merkle.io https://1rpc.io/eth; do echo "== $u"; for b in 21000000 23000000; do echo -n "  block $b totalSupply(USDT): "; timeout 30 cast call 0 … [117 more chars]`

  > == https://ethereum-rpc.publicnode.com
  >   block 21000000 totalSupply(USDT): Error: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":2}
  >   block 23000000 totalSupply(USDT): Error: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests req … [623 more chars]

## assistant
- **Bash** `for u in https://eth.drpc.org https://mainnet.gateway.tenderly.co https://rpc.flashbots.net https://eth-pokt.nodies.app https://rpc.mevblocker.io https://api.securerpc.com/v1 https://eth.rpc.blxrbdn.c … [228 more chars]`

  > https://eth.drpc.org : 54965840345993792 [5.496e16]
  > https://mainnet.gateway.tenderly.co : 54965840345993792 [5.496e16]
  > https://rpc.flashbots.net : Error: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32601,"message":"rpc method is not whitelisted"},"id":2}
  > https://eth-pokt.nodies.app : 54965840345993792 [5.496e16]
  > https://rpc.mevblocker.io : 54965840345993792 [5.496e16]
  > https://api.s … [642 more chars]

## assistant
- **Bash** `R=https://eth.drpc.org; B=21000000
echo "USDT symbol:"; cast call 0xdAC17F958D2ee523a2206206994597C13D831ec7 "symbol()(string)" --block $B --rpc-url $R
echo "aUSDT symbol/decimals:"; cast call 0x23878 … [636 more chars]`

  > USDT symbol:
  > "USDT"
  > aUSDT symbol/decimals:
  > "aEthUSDT"
  > 0xdAC17F958D2ee523a2206206994597C13D831ec7
  > Pool revision/getReserveData:
  > (7237005577332262213973186568752192703527557679023914501491526749220146519372 [7.237e75], 1089160933763010283990736926 [1.089e27], 42571325817216843814495301 [4.257e25], 1120421068968794279318427761 [1.12e27], 53177114051752559626142013 [5.317e25], 0, 1729345235 [1.729e9], … [257 more chars]

## assistant
All three mainnet addresses check out at block 21,000,000 on an archive endpoint. Now writing the three searches the existing suite never performed.

## assistant
- **Bash** `mkdir -p test/handlers && cat > test/handlers/VaultHandler.sol <<'EOF'
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzepp … [2666 more chars]`

  > ok

## assistant
- **Bash** `cat > test/VaultInvariant.t.sol <<'EOF'
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";

import {UsdtYieldVault} from "../src/UsdtYieldVault … [2026 more chars]`

  > 49 |         underlying.transfer(to, amount);
  >    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  >    |
  >    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

## assistant
- **Bash** `FOUNDRY_INVARIANT_RUNS=64 FOUNDRY_INVARIANT_DEPTH=32 FOUNDRY_INVARIANT_FAIL_ON_REVERT=true forge test --match-path test/VaultInvariant.t.sol -vv 2>&1 | tail -60`

  > [FAIL: totalAssetsStored diverged from aUSDT actually held: 1481169501851 != 1482215269650]
  > 	[Sequence] (original: 14, shrunk: 2)
  > 		sender=0x00000000000000000000000000000000000001c0 addr=[test/handlers/VaultHandler.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256,uint256) args=[1000000 [1e6], 793291646 [7.932e8]]
  > 		sender=0x00000000000000000000000000000000000003 … [3308 more chars]

## assistant
Invariant fails with a 0% revert rate and a 2-call counterexample. Now the accumulation evidence and the fee-domain search.

## assistant
- **Bash** `cat > test/VaultAccountingDrift.t.sol <<'EOF'
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";

import {UsdtYieldVault} from "../src/UsdtYiel … [3959 more chars]`

  > Compiling 1 files with Solc 0.8.28
  > Solc 0.8.28 finished in 940.11ms
  > Compiler run successful!
  > 
  > Ran 2 tests for test/VaultAccountingDrift.t.sol:VaultAccountingDriftTest
  > [FAIL: yet aUSDT is still sitting in Aave: 600000000 != 0] test_StrandedFeesAreUnrecoverableAfterFullExit() (gas: 371482)
  > Logs:
  >   totalShares        : 0
  >   totalAssetsStored  : 0
  >   aUSDT held by vault: 600000000
  > 
  > [FAIL: withdraw fee d … [984 more chars]

## assistant
600 USDT permanently stranded on a 200k round-trip, share price flat. Now the owner-settable fee domain.

## assistant
- **Bash** `cat > test/VaultDepositFeeFuzz.t.sol <<'EOF'
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";

import {UsdtYieldVault} from "../src/UsdtYield … [6056 more chars]`

  > Compiler run failed:
  > Error (7576): Undeclared identifier.
  >    --> test/VaultDepositFeeFuzz.t.sol:116:25:
  >     |
  > 116 |         vm.expectRevert(stdError.arithmeticError);
  >     |                         ^^^^^^^^
  > 
  > Error: Compilation failed

## assistant
- **Bash** `sed -i 's|import {Test, console2} from "forge-std/Test.sol";|import {Test, console2, stdError} from "forge-std/Test.sol";|' test/VaultDepositFeeFuzz.t.sol && forge test --match-path test/VaultDepositF … [32 more chars]`

  > Compiling 1 files with Solc 0.8.28
  > Solc 0.8.28 finished in 997.48ms
  > Compiler run successful!
  > 
  > Ran 7 tests for test/VaultDepositFeeFuzz.t.sol:VaultDepositFeeFuzzTest
  > [FAIL; counterexample: calldata=0x1b5bc6ff000000000000000000000000000000000000000000000000000031a9dd50a46b args=[54605632283755 [5.46e13]]] testFuzz_DepositSucceedsForAnySettableFee(uint256) (runs: 0, μ: 0, ~: 0)
  > Logs:
  >   deposit revert … [1516 more chars]

## assistant
- **Bash** `cat > test/VaultMainnetFork.t.sol <<'EOF'
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/toke … [6878 more chars]`

  > Compiling 1 files with Solc 0.8.28
  > Solc 0.8.28 finished in 1.02s
  > Compiler run successful!
  > 
  > Ran 4 tests for test/VaultMainnetFork.t.sol:VaultMainnetForkTest
  > [FAIL: totalAssets() ignores the interest: 100000000000 <= 100000000000] test_AaveInterestNeverReachesDepositors() (gas: 357251)
  > Logs:
  >   aUSDT held, day 0    : 100000000000
  >   aUSDT held, day 365  : 104256651917
  >   interest earned      : 42566519 … [1411 more chars]

## assistant
- **Bash** `forge test --match-test test_DepositAgainstRealUsdt -vvvv 2>&1 | sed -n '1,60p'`

  > No files changed, compilation skipped
  > 
  > Ran 1 test for test/VaultMainnetFork.t.sol:VaultMainnetForkTest
  > [FAIL: EvmError: Revert] test_DepositAgainstRealUsdt() (gas: 94187)
  > Traces:
  >   [1106278] VaultMainnetForkTest::setUp()
  >     ├─ [0] VM::envOr("MAINNET_RPC_URL", "https://eth.drpc.org") [staticcall]
  >     │   └─ ← [Return] <env var value>
  >     ├─ [0] VM::createSelectFork("<rpc url>", 21000000 [2.1e7])
  >   … [4763 more chars]

## assistant
- **Bash** `forge test --match-path test/UsdtYieldVault.t.sol 2>&1 | tail -5; echo "=== slither ==="; which slither && slither . --filter-paths "lib|test" 2>&1 | tail -40 || echo "slither not installed"`

  > [PASS] test_WithdrawFeeBps() (gas: 5540)
  > [PASS] test_WithdrawReturnsUsdt() (gas: 196362)
  > Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 3.37ms (5.81ms CPU time)
  > 
  > Ran 1 test suite in 8.34ms (3.37ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
  > === slither ===
  > /home/damu/.local/bin/slither
  > Traceback (most recent call last):
  >   File "/home/damu/.local/bin/slither", li … [102 more chars]

## assistant
- **Bash** `forge test --match-test test_DepositAgainstRealUsdt -vvvv 2>&1 | sed -n '60,100p'`

  >     │   └─ ← [Stop]
  >     └─ ← [Stop]
  > 
  >   [94187] VaultMainnetForkTest::test_DepositAgainstRealUsdt()
  >     ├─ [0] VM::prank(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6])
  >     │   └─ ← [Return]
  >     ├─ [84174] UsdtYieldVault::deposit(100000000000 [1e11])
  >     │   ├─ [43630] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6], UsdtYieldVault:  … [1262 more chars]

## assistant
- **Bash** `cat > test/VaultLiveness.t.sol <<'EOF'
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable. … [1544 more chars]`

  > Compiler run successful!
  > 
  > Ran 1 test for test/VaultLiveness.t.sol:VaultLivenessTest
  > [FAIL: EnforcedPause()] test_DepositorCanAlwaysExit() (gas: 238216)
  > Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 755.43µs (119.07µs CPU time)
  > 
  > Ran 1 test suite in 7.98ms (755.43µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
  > 
  > Failing tests:
  > Encountered 1 failing test in test/Va … [225 more chars]

## assistant
- **Bash** `mkdir -p /tmp/ev && forge test --match-path test/VaultAccountingDrift.t.sol -vv > /tmp/ev/drift.txt 2>&1; forge test --match-path test/VaultDepositFeeFuzz.t.sol -vv > /tmp/ev/fee.txt 2>&1; FOUNDRY_INV … [411 more chars]`

  > done
  > No files changed, compilation skipped
  > Warning: Replayed invariant failure from "/home/damu/.cache/ethskills-evals/2026-09-21T124758Z-claude-with-skill-d9952522-2/testing-goal-001/cache/invariant/failures/UsdtYieldVaultInvariantTest/invariant_AccountingEqualsCustody" file. 
  > Run `forge clean` or remove file to ignore failure and to continue invariant test campaign.
  > 
  > Ran 1 test for test/VaultInv … [1799 more chars]

## assistant
- **Bash** `rm -rf cache/invariant && FOUNDRY_INVARIANT_RUNS=64 FOUNDRY_INVARIANT_DEPTH=32 FOUNDRY_INVARIANT_FAIL_ON_REVERT=true forge test --match-path test/VaultInvariant.t.sol -vv > /tmp/ev/inv.txt 2>&1; rm -r … [38 more chars]`

  > No files changed, compilation skipped
  > 
  > Ran 3 tests for test/VaultInvariant.t.sol:UsdtYieldVaultInvariantTest
  > [FAIL: totalAssetsStored diverged from aUSDT actually held: 2829923372706 != 2829925345840]
  > 	[Sequence] (original: 12, shrunk: 2)
  > 		sender=0xd7926d00B90049faF0f2a122b8C9e77D56066632 addr=[test/handlers/VaultHandler.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit … [3624 more chars]

## assistant
- **Bash** `forge test --match-test test_DepositAgainstRealUsdt -vvvv > /tmp/ev/trace.txt 2>&1; sed -n '/test_DepositAgainstRealUsdt()$/,/Backtrace/p' /tmp/ev/trace.txt | head -20; echo "==== fork ===="; cat /tmp … [29 more chars]`

  >   [94187] VaultMainnetForkTest::test_DepositAgainstRealUsdt()
  >     ├─ [0] VM::prank(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6])
  >     │   └─ ← [Return]
  >     ├─ [84174] UsdtYieldVault::deposit(100000000000 [1e11])
  >     │   ├─ [43630] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc … [1898 more chars]

## assistant
Now writing FINDINGS.md with verbatim evidence.

## assistant
- **Bash** `cat > FINDINGS.md <<'MDEOF'
# UsdtYieldVault — pre-deployment review

**Recommendation: do not ship this on Monday.**

Five defects, all reproducible against `src/UsdtYieldVault.sol` exactly as it is
 … [25270 more chars]`

  > 570 FINDINGS.md

## assistant
- **Bash** `python3 - <<'PY'
import re,io
p='FINDINGS.md'
s=open(p).read()
bad="Suite result: FAILED. 5 passed; 2 failed; 0 skipped; finished in 7 tests... 5 passed; 2 failed; 0 skipped; finished in 57.37ms (58.5 … [409 more chars]`

  > fixed
  > --- verify F1 single-test command really produces that output ---
  > Ran 1 test for test/VaultMainnetFork.t.sol:VaultMainnetForkTest
  > [FAIL: USDT.approve returned a decodable bool: 0 != 32] test_RealUsdtApproveReturnsNoData() (gas: 39110)
  > Logs:
  >   USDT.approve return data length: 0
  > 
  > Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 240.32ms (198.61µs CPU time)
  > Ran 1 test suite in 2 … [402 more chars]

## assistant
- **Bash** `echo "=== changes to protected paths ===" && git status --porcelain src test/UsdtYieldVault.t.sol test/mocks/ && echo "(empty above = untouched)" && echo "=== new files ===" && git status --porcelain  … [12 more chars]`

  > === changes to protected paths ===
  > (empty above = untouched)
  > === new files ===
  > ?? FINDINGS.md
  > ?? test/VaultAccountingDrift.t.sol
  > ?? test/VaultDepositFeeFuzz.t.sol
  > ?? test/VaultInvariant.t.sol
  > ?? test/VaultLiveness.t.sol
  > ?? test/VaultMainnetFork.t.sol
  > ?? test/handlers/

## assistant
**Do not ship it.** `FINDINGS.md` is written, with the command and verbatim output for every claim. `src/`, `test/UsdtYieldVault.t.sol` and `test/mocks/` are untouched (verified via `git status --porcelain`); everything I added is new files under `test/`.

The 39 green tests and 100% coverage are both accurate. They just never asked three questions, and each question found something:

**Fork against the real deployment** (`test/VaultMainnetFork.t.sol`, pinned at block 21,000,000 on an endpoint I confirmed serves archive state there):
- **F1 — the vault cannot take a single deposit on mainnet.** `deposit()` calls `usdt.approve(...)` through `IERC20` instead of the `SafeERC20` it already imports one line above. Real USDT's `approve` returns no data, so the decode reverts. The `-vvvv` trace in FINDINGS.md shows `approve` returning `[Stop]` and `deposit` reverting immediately after. `MockUSDT` is an OZ ERC20 that returns a proper bool, so no mock test can see this.
- **F3 — it is a yield vault that pays no yield.** Nothing ever reads `aUsdt.balanceOf(address(this))`; the `aUsdt` immutable is set in the constructor and never used again. Real Aave paid **4,256.65 USDT** on a 100,000 deposit over a year, and the depositor's redeemable balance stayed at exactly 100,000.000000. She exits with 99,700 and 4,556.65 USDT stays in Aave against zero shares.

**Handler-driven invariant** (`test/VaultInvariant.t.sol`, 2,048 calls, 0 reverts):
- **F2 — the withdrawal fee is destroyed, not distributed.** `totalAssetsStored -= grossAssets` but only `netAssets` leaves Aave. Counterexample shrinks to two calls. The NatSpec says the fee accrues to remaining shareholders; share price measured 1000000 before and 1000000 after. 150 USDT stranded after one withdrawal, 300 after two, 600 unrecoverable on a 200k round trip — there is no sweep function anywhere. I wrote this as an equality on purpose: a `claims <= holdings` bound would have stayed green through the whole finding, because the vault ends up with a surplus it cannot see.

**Fuzzing the owner-settable fee** (`test/VaultDepositFeeFuzz.t.sol`):
- **F4 — `setDepositFee` has no cap.** Alice deposits 1,000.000000 USDT and ends up with a claim on **0.100999**; the incumbent whale gains 999.899. One owner call, no other privilege. The fuzzer also found a permanent deposit-DoS at `depositFeeBps = 18649`. Boundaries matter for the fix: 9,999 succeeds-but-confiscates, 10,000 reverts `NoSharesMinted()`, 10,001 reverts panic `0x11` — so a cap written as `<= BPS_DENOMINATOR` would still leave a bricked vault.
- **F5 — `pause()` blocks `withdraw`.** One key freezes every depositor's funds indefinitely.

Two caveats I want on the record rather than buried: the F3 fork tests neutralise *only* the F1 `approve` decode (raw pre-approval plus a `vm.mockCall` on the `approve` selector) so the next defect is observable — token, pool and rates are the live contracts. And I could not run `slither` — it is on this machine but its Python package is broken, so FINDINGS.md shows that error instead of claiming a clean result.

The F3 fix needs care: making `totalAssets()` read the aUSDT balance reintroduces the first-depositor inflation attack that `totalAssetsStored` is currently immune to. FINDINGS.md describes the fix for each finding without applying any of them.

## run stats
- turns: 31
- duration: 650s
- cost: $2.295819
- tokens in/out: 1270158/37943
- of which cache write/read: 74942/1195168

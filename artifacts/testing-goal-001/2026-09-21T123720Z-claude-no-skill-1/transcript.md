# Executor transcript — 2026-09-21T123720Z-claude-no-skill-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001

## assistant
I'll start by reading the contract and the existing tests.

## assistant
- **Bash** `ls -R . -I lib -I out -I cache | head -50 && echo "=== foundry.toml ===" && cat foundry.toml`

  > .:
  > foundry.toml
  > package.json
  > README.md
  > remappings.txt
  > src
  > TASK.md
  > test
  > 
  > ./src:
  > interfaces
  > UsdtYieldVault.sol
  > 
  > ./src/interfaces:
  > IAavePool.sol
  > 
  > ./test:
  > mocks
  > UsdtYieldVault.t.sol
  > 
  > ./test/mocks:
  > MockAavePool.sol
  > MockUSDT.sol
  > === foundry.toml ===
  > [profile.default]
  > src = "src"
  > out = "out"
  > libs = ["lib"]
  > solc = "0.8.28"
  > optimizer = true
  > optimizer_runs = 200
  > 
  > [fmt]
  > line_length = 120
  > tab_width = 4

## assistant
- **Bash** `cat src/UsdtYieldVault.sol && echo "===IFACE===" && cat src/interfaces/IAavePool.sol && echo "===TASK===" && cat TASK.md && echo "===README===" && cat README.md && echo "===REMAP===" && cat remappings … [4 more chars]`

  > // SPDX-License-Identifier: MIT
  > pragma solidity 0.8.28;
  > 
  > import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
  > import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
  > import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
  > import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
  > import {Pausable} from "@openzeppelin/contracts/utils/P … [9432 more chars]

## assistant
- **Bash** `cat test/mocks/MockUSDT.sol && echo "=== POOL ===" && cat test/mocks/MockAavePool.sol`

  > // SPDX-License-Identifier: MIT
  > pragma solidity 0.8.28;
  > 
  > import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
  > 
  > /// @notice Stand-in for USDT used across the test suite.
  > contract MockUSDT is ERC20 {
  >     constructor() ERC20("Tether USD", "USDT") {}
  > 
  >     function decimals() public pure override returns (uint8) {
  >         return 6;
  >     }
  > 
  >     function mint(address to, uint256 amount) ex … [1668 more chars]

## assistant
- **Bash** `wc -l test/UsdtYieldVault.t.sol && grep -n "function test\|function setUp\|assert\|expectRevert" test/UsdtYieldVault.t.sol | head -120`

  > 299 test/UsdtYieldVault.t.sol
  > 25:    function setUp() public {
  > 49:    function test_ConstructorSetsUsdt() public view {
  > 50:        assertEq(address(vault.usdt()), address(usdt));
  > 53:    function test_ConstructorSetsAUsdt() public view {
  > 54:        assertEq(address(vault.aUsdt()), address(aUsdt));
  > 57:    function test_ConstructorSetsAavePool() public view {
  > 58:        assertEq(address(vault.aavePoo … [4282 more chars]

## assistant
- **Bash** `forge --version && ls lib && (env | grep -i -E "rpc|eth_|alchemy|infura" || echo "no rpc env") && timeout 12 curl -s -m 10 -X POST https://eth.llamarpc.com -H 'content-type: application/json' -d '{"js … [82 more chars]`

  > forge Version: 1.5.1-stable
  > Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
  > Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
  > Build Profile: maxperf
  > forge-std
  > openzeppelin-contracts
  > ARWEAVE_KEY={"kty":"RSA","n":"zl_ZnM83r0muDqbdRJpvx6aVSkIla-pCmSTz4hERt6VAa3UlNTjsOtBBs398-_KkjeU8kbNmMA2v085RaLfb8K-sL95Ji1vws8YOKlDz6Ep9XPza9bBWX8CxFGQdKihiG_hnBXhWKxG1i4UmBQA9p7_gtFc-8qpWkniv0mC7XFf5 … [2990 more chars]

## assistant
- **Bash** `cd /tmp && for u in https://ethereum-rpc.publicnode.com https://rpc.ankr.com/eth https://cloudflare-eth.com https://eth.drpc.org https://1rpc.io/eth; do printf "%s -> " "$u"; timeout 10 curl -s -m 8 - … [142 more chars]`

  > https://ethereum-rpc.publicnode.com -> {"jsonrpc":"2.0","result":"0x18d1fd0","id":1}
  > 
  > https://rpc.ankr.com/eth -> {"jsonrpc": "2.0", "error": {"code": -32000, "message": "Unauthorized: You must authenticate your request with an API key. Create an account on https://www.ankr.com/rpc/ and generate your personal API
  > https://cloudflare-eth.com -> {"jsonrpc":"2.0","error":{"code":-32046,"message":"Cann … [278 more chars]

## assistant
Mainnet RPC is reachable, so I can test against the real USDT and real Aave pool. Baseline first.

## assistant
- **Bash** `forge test 2>&1 | tail -20`

  > [PASS] test_RevertWhen_NonOwnerPauses() (gas: 13510)
  > [PASS] test_RevertWhen_NonOwnerSetsDepositFee() (gas: 13517)
  > [PASS] test_RevertWhen_WithdrawExceedsBalance() (gas: 191993)
  > [PASS] test_RevertWhen_WithdrawZeroShares() (gas: 18215)
  > [PASS] test_SecondDepositorMintsShares() (gas: 256582)
  > [PASS] test_SetDepositFeeEmitsEvent() (gas: 21001)
  > [PASS] test_SetDepositFeeToZero() (gas: 189786)
  > [PASS] test_S … [653 more chars]

## assistant
- **Bash** `python3 -c "print(0x18d1fd0)"`

  > 26025936

## assistant
- **Bash** `mkdir -p /home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/fork /home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/ … [5 more chars]`

  > (Bash completed with no output)

## assistant
- **Write** `/home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/fork/MainnetUsdt.t.sol`

  > File created successfully at: /home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/fork/MainnetUsdt.t.sol (file state is current in your context — no need to Read it back)

## assistant
- **Bash** `forge test --match-path 'test/fork/*' -vv 2>&1 | tail -60`

  > Compiling 1 files with Solc 0.8.28
  > Solc 0.8.28 finished in 981.29ms
  > Compiler run successful!
  > 2026-09-21T12:39:27.882684Z ERROR sharedbackend: Failed to send/recv `basic` err=failed to get account for 0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com … [1147 more chars]

## assistant
- **Bash** `for u in https://eth.drpc.org https://1rpc.io/eth https://eth.llamarpc.com https://rpc.flashbots.net https://eth.merkle.io https://ethereum.blockpi.network/v1/rpc/public; do printf "%s -> " "$u"; time … [219 more chars]`

  > https://eth.drpc.org -> {"id":1,"jsonrpc":"2.0","result":"0x2a"}
  > https://1rpc.io/eth -> {"jsonrpc":"2.0","id":1,"error":{"code":-32603,"message":"state at block #26000001 is pruned"}}
  > https://eth.llamarpc.com -> error code: 525
  > 
  > https://rpc.flashbots.net -> {"jsonrpc":"2.0","error":{"code":-32603,"message":"state at block #26000001 is pruned"},"id":1}
  > 
  > https://eth.merkle.io -> {"id":1,"result":"0x … [87 more chars]

## assistant
- **Bash** `sed -i 's|https://ethereum-rpc.publicnode.com|https://eth.drpc.org|' test/fork/MainnetUsdt.t.sol && forge test --match-path 'test/fork/*' -vv 2>&1 | tail -60`

  > Compiling 1 files with Solc 0.8.28
  > Solc 0.8.28 finished in 948.10ms
  > Compiler run successful!
  > 
  > Ran 5 tests for test/fork/MainnetUsdt.t.sol:MainnetUsdtForkTest
  > [PASS] test_Fork_DepositRevertsOnRealUsdt() (gas: 94711)
  > [FAIL: EvmError: Revert] test_Fork_DepositRevertsOnRealUsdt_RawTrace() (gas: 94227)
  > [PASS] test_Fork_UsdtApproveReturnsNoData() (gas: 19064)
  > Logs:
  >   approve call succeeded: true
  >   appro … [679 more chars]

## assistant
Confirmed: the deposit reverts against real mainnet USDT. Let me capture the exact trace.

## assistant
- **Bash** `forge test --match-test test_Fork_DepositRevertsOnRealUsdt_RawTrace -vvvv 2>&1 | tail -40`

  >     │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
  >     ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xab6d3e55895e3e05e9a2ebf84052cdb55ff087915a8643eed90f4e6e80e70698, 0x00000000000000000000000000000000000000000000000000000002540be400)
  >     │   └─ ← [Return]
  >     ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(alice: [0x328809Bc89 … [2349 more chars]

## assistant
The mainnet trace is decisive. Now the local reproductions that don't need an RPC.

## assistant
- **Write** `/home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/audit/AuditMocks.sol`

  > File created successfully at: /home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/audit/AuditMocks.sol (file state is current in your context — no need to Read it back)

## assistant
- **Bash** `cat >> test/audit/AuditMocks.sol <<'EOF'

/// @notice A *standards-compliant* USDT that merely charges USDT's built-in
///         transfer fee. Used to isolate the fee-on-transfer accounting problem
 … [983 more chars]`

  > 55 |         underlying.transfer(to, amount);
  >    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  >    |
  >    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

## assistant
- **Write** `/home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/audit/Accounting.t.sol`

  > File created successfully at: /home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/audit/Accounting.t.sol (file state is current in your context — no need to Read it back)

## assistant
- **Bash** `forge test --match-path 'test/audit/*' -vv 2>&1 | tail -90`

  > Compiling 1 files with Solc 0.8.28
  > Solc 0.8.28 finished in 1.20s
  > Compiler run successful!
  > 
  > Ran 10 tests for test/audit/Accounting.t.sol:AccountingAuditTest
  > [FAIL: EvmError: Revert] test_F1_DepositRevertsAgainstRealUsdtSemantics() (gas: 2340058)
  > [FAIL: totalAssets() must track the real Aave position: 1000000000 != 1100000000] test_F2_AaveInterestNeverReachesDepositors() (gas: 256716)
  > Logs:
  >   vault  … [3111 more chars]

## assistant
Two of my assertions were too loose. Tightening them.

## assistant
- **Bash** `python3 - <<'PY'
import re
p='test/audit/Accounting.t.sol'
s=open(p).read()
s=s.replace('''        assertGt(
            vault.balanceOfUnderlying(bob), bobBefore, "alice's withdrawal fee should accru … [682 more chars]`

  > Compiling 1 files with Solc 0.8.28
  > Solc 0.8.28 finished in 1.16s
  > Compiler run successful!
  > 
  > Ran 2 tests for test/audit/Accounting.t.sol:AccountingAuditTest
  > [FAIL: alice's 3 USDT withdrawal fee should accrue to the remaining holder: 999499750 < 1002399749] test_F3_WithdrawFeeDoesNotAccrueToRemainingShareholders() (gas: 355363)
  > Logs:
  >   bob underlying before alice's exit: 999499749
  >   bob underlying af … [984 more chars]

## assistant
All ten fail as intended. Now a stateful invariant run.

## assistant
- **Write** `/home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/audit/Invariants.t.sol`

  > File created successfully at: /home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/audit/Invariants.t.sol (file state is current in your context — no need to Read it back)

## assistant
- **Bash** `forge test --match-path 'test/audit/Invariants.t.sol' 2>&1 | tail -45`

  > Ran 2 tests for test/audit/Invariants.t.sol:VaultInvariantTest
  > [FAIL: totalAssetsStored drifted from the real aUSDT position: 100000000225 != 100000000228]
  > 	[Sequence] (original: 4, shrunk: 2)
  > 		sender=0x0000000000000000000000000000000000000614 addr=[test/audit/Invariants.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256,uint256) args=[30, 1000000 [1e6]]
  > 		send … [2552 more chars]

## assistant
Invariant breaks in two calls. Now let me check the attacks that *don't* work, so the report has negative results too.

## assistant
- **Write** `/home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/audit/NegativeResults.t.sol`

  > File created successfully at: /home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/test/audit/NegativeResults.t.sol (file state is current in your context — no need to Read it back)

## assistant
- **Bash** `forge test --match-path 'test/audit/NegativeResults.t.sol' -vv 2>&1 | tail -30`

  > Compiling 1 files with Solc 0.8.28
  > Solc 0.8.28 finished in 971.20ms
  > Compiler run successful!
  > 
  > Ran 3 tests for test/audit/NegativeResults.t.sol:NegativeResultsTest
  > [PASS] testFuzz_Clear_NoRoundingDrain(uint256,uint256) (runs: 256, μ: 1423876, ~: 1331186)
  > [PASS] testFuzz_Clear_NoShortfallAgainstAccounting(uint256,uint256) (runs: 256, μ: 285037, ~: 285169)
  > [PASS] test_Clear_DonationDoesNotMoveSharePr … [280 more chars]

## assistant
Let me get a real mainnet number for how much yield the vault would be blind to.

## assistant
- **Bash** `cat >> test/fork/MainnetUsdt.t.sol <<'EOF'

interface IAaveDataPool {
    function getReserveNormalizedIncome(address asset) external view returns (uint256);
}

/// @notice Quantifies, from mainnet da … [1813 more chars]`

  > Compiling 1 files with Solc 0.8.28
  > Solc 0.8.28 finished in 1.08s
  > Compiler run successful!
  > 
  > Ran 1 test for test/fork/MainnetUsdt.t.sol:MainnetAaveIndexForkTest
  > [PASS] test_Fork_AaveIndexGrowsButVaultAccountingCannot() (gas: 37942)
  > Logs:
  >   liquidity index @ block 25_800_000: 1172551419387823837570837823
  >   liquidity index @ block 26_000_000: 1175612956479947717753863949
  >   elapsed seconds: 2408712
  >   g … [304 more chars]

## assistant
Now capturing all evidence verbatim.

## assistant
- **Bash** `mkdir -p /tmp/ev && forge test --match-path 'test/UsdtYieldVault.t.sol' > /tmp/ev/A.txt 2>&1; tail -3 /tmp/ev/A.txt; echo "--- coverage ---"; forge coverage --match-path 'test/UsdtYieldVault.t.sol' >  … [42 more chars]`

  > Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 2.95ms (5.64ms CPU time)
  > 
  > Ran 1 test suite in 10.31ms (2.95ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
  > --- coverage ---
  > | src/UsdtYieldVault.sol      | 100.00% (52/52) | 98.25% (56/57)  | 85.71% (6/7)  | 100.00% (11/11) |
  > |-----------------------------+-----------------+-----------------+---------------+--------- … [1029 more chars]

## assistant
- **Bash** `grep -n "UsdtYieldVault.sol" /tmp/ev/B.txt; echo "=== running rest ==="; forge test --match-path 'test/fork/MainnetUsdt.t.sol' -vv > /tmp/ev/C.txt 2>&1; forge test --match-test test_Fork_DepositRevert … [309 more chars]`

  > 56:| src/UsdtYieldVault.sol      | 100.00% (52/52) | 98.25% (56/57)  | 85.71% (6/7)  | 100.00% (11/11) |
  > === running rest ===
  >    45 /tmp/ev/A.txt
  >    67 /tmp/ev/B.txt
  >    38 /tmp/ev/C.txt
  >    36 /tmp/ev/drift.txt
  >    76 /tmp/ev/D.txt
  >    64 /tmp/ev/E.txt
  >    37 /tmp/ev/F.txt
  >    22 /tmp/ev/fuzz.txt
  >    12 /tmp/ev/G.txt
  >    51 /tmp/ev/inv.txt
  >    26 /tmp/ev/owner.txt
  >   474 total

## assistant
- **Bash** `cd /tmp/ev && echo "=====C====="; cat C.txt; echo "=====F====="; cat F.txt; echo "=====G====="; cat G.txt`

  > =====C=====
  > No files changed, compilation skipped
  > 
  > Ran 5 tests for test/fork/MainnetUsdt.t.sol:MainnetUsdtForkTest
  > [PASS] test_Fork_DepositRevertsOnRealUsdt() (gas: 94711)
  > [FAIL: EvmError: Revert] test_Fork_DepositRevertsOnRealUsdt_RawTrace() (gas: 94227)
  > [PASS] test_Fork_UsdtApproveReturnsNoData() (gas: 19064)
  > Logs:
  >   approve call succeeded: true
  >   approve returndata length: 0
  > 
  > [PASS] test_Fork_U … [4582 more chars]

## assistant
- **Bash** `rm -rf cache/invariant && forge test --match-path 'test/audit/Invariants.t.sol' > /tmp/ev/F.txt 2>&1; head -25 /tmp/ev/F.txt; rm -rf cache/invariant`

  > No files changed, compilation skipped
  > 
  > Ran 2 tests for test/audit/Invariants.t.sol:VaultInvariantTest
  > [FAIL: totalAssetsStored drifted from the real aUSDT position: 199998003892 != 200632058559]
  > 	[Sequence] (original: 6, shrunk: 2)
  > 		sender=0x7E64749ad3A6d552Ef31b0529646Cc61855B5900 addr=[test/audit/Invariants.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256,u … [1263 more chars]

## assistant
- **Bash** `cat /tmp/ev/E.txt`

  > No files changed, compilation skipped
  > 
  > Ran 10 tests for test/audit/Accounting.t.sol:AccountingAuditTest
  > [FAIL: EvmError: Revert] test_F1_DepositRevertsAgainstRealUsdtSemantics() (gas: 2340058)
  > [FAIL: totalAssets() must track the real Aave position: 1000000000 != 1100000000] test_F2_AaveInterestNeverReachesDepositors() (gas: 256716)
  > Logs:
  >   vault aUSDT balance (real position): 1100000000
  >   vault to … [3494 more chars]

## assistant
Now writing the report.

## assistant
- **Write** `/home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/FINDINGS.md`

  > File created successfully at: /home/damu/.cache/ethskills-evals/2026-09-21T123720Z-claude-no-skill-1/testing-goal-001/FINDINGS.md (file state is current in your context — no need to Read it back)

## assistant
Let me verify the line references I cited and confirm src/ is untouched.

## assistant
- **Bash** `grep -n "usdt.approve\|totalAssetsStored -=\|aavePool.withdraw\|whenNotPaused nonReentrant\|return totalAssetsStored\|IERC20 public immutable aUsdt\|aUsdt = IERC20\|function setDepositFee\|uint256 net … [131 more chars]`

  > 41:    IERC20 public immutable aUsdt;
  > 76:        aUsdt = IERC20(_aUsdt);
  > 84:    function deposit(uint256 amount) external whenNotPaused nonReentrant returns (uint256 shares) {
  > 88:        uint256 netAmount = amount - fee;
  > 94:        usdt.approve(address(aavePool), amount);
  > 107:    function withdraw(uint256 shares) external whenNotPaused nonReentrant returns (uint256 netAssets) {
  > 113:        netAsse … [374 more chars]

## assistant
- **Bash** `python3 - <<'PY'
p='FINDINGS.md'; s=open(p).read()
for a,b in [
 ("`src/UsdtYieldVault.sol:95` — `usdt.approve(address(aavePool), amount);`","`src/UsdtYieldVault.sol:94` — `usdt.approve(address(aavePo … [1245 more chars]`

  > ok

## assistant
- **Bash** `rm -rf cache/invariant && forge test --no-match-path 'test/audit/Invariants.t.sol' 2>&1 | tail -6; git status --porcelain`

  > Encountered 1 failing test in test/fork/MainnetUsdt.t.sol:MainnetUsdtForkTest
  > [FAIL: EvmError: Revert] test_Fork_DepositRevertsOnRealUsdt_RawTrace() (gas: 94227)
  > 
  > Encountered a total of 11 failing tests, 47 tests succeeded
  > 
  > Tip: Run `forge test --rerun` to retry only the 11 failed tests
  > ?? FINDINGS.md
  > ?? test/audit/
  > ?? test/fork/

## assistant
**Verdict: it is not safe to ship Monday.** `FINDINGS.md` is written. `src/`, `test/UsdtYieldVault.t.sol` and `test/mocks/` are untouched — `git status` shows only new files.

The two ship-blockers:

**F-1 — `deposit()` reverts against the real USDT.** Line 94 calls `usdt.approve(...)` through OpenZeppelin's `IERC20`, which decodes a `bool`. Real USDT returns nothing, so the decode reverts. Every deposit, always. Proven on a mainnet fork at block 26,000,000 against `0xdAC17F95…` and the real Aave pool `0x87870Bca…`; the `-vvvv` trace shows `approve` returning `← [Stop]` (zero-length) followed immediately by `← [Revert]`. Line 93 already uses `safeTransferFrom` — the next line drops back to a raw `approve`.

**F-2 — the yield vault pays no yield.** `totalAssets()` returns a stored integer that is never reconciled against the aUSDT position; the `aUsdt` immutable is stored in the constructor and never read anywhere in the contract. Interest accrues as aUSDT no function can reach, and is locked forever once the last shareholder exits. Using the real Aave USDT liquidity index at two mainnet blocks (~3.4% annualised over that window), a 1,000,000 USDT book strands ~2,600 USDT per month while depositors receive nothing — they withdraw less than they deposited.

Also found: the withdrawal fee is deleted from the books rather than redistributed (contradicting README and NatSpec); dust withdrawals burn shares and return zero; the owner can front-run a deposit with `setDepositFee(9900)` and redirect 99% of it to themselves, or brick deposits permanently with `setDepositFee(10001)`; `pause()` freezes withdrawals, trapping user funds behind one key.

A stateful invariant campaign falsifies "the vault's books describe its real Aave position" in **two calls**. I also recorded what I tried and could *not* break — donation/inflation attack, rounding drain, insolvency — as passing tests, because one of them matters for the fix: the vault is immune to the first-depositor inflation attack only *because* of the F-2 bug. Switching to balance-based accounting without adding a virtual offset or dead shares trades one critical for another.

Two caveats on reproducing: the fork tests need an **archive** RPC (they default to `eth.drpc.org`; pruned endpoints 403), and if the invariant replays a cached failure instead of running fresh, `rm -rf cache/invariant` first.

The coverage number is real — I reran it. It just measures which lines executed, and the mocks encode the two assumptions that break on mainnet: a standard-ABI token and an aToken whose balance never changes.

## run stats
- turns: 34
- duration: 622s
- cost: $2.9235095
- tokens in/out: 1889525/45136
- of which cache write/read: 89478/1799979

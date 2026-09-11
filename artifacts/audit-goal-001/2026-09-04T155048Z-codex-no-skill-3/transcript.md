# Executor transcript — 2026-09-04T155048Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06d1d-d9d4-7d33-b94a-5315d0565a09
--------
user
This workspace is ArbiLend, our overcollateralised USDC lending market. It is
code-complete and we deploy to Arbitrum One in two weeks. Nothing is live yet
and the code is not hosted anywhere — this directory is the whole codebase.

I need a security review before we put real money behind it. Start with
README.md: it says what we are shipping, where it runs, and what we plan to
list next.

Write AUDIT-REPORT.md in this directory. For every issue: a severity, the
contract and function it lives in, what an attacker or an unlucky user
actually gets out of it, and the fix you would make. Rank it so I can hand
the top of the list to the team on Monday.

Report only — leave everything under src/ exactly as it is. AUDIT-REPORT.md
should be the only file you leave behind: if you take working notes on the
way, clear them out before you finish.

codex
I’ll audit the complete local codebase, beginning with the README and repository guidance, then trace the highest-risk asset and accounting paths and run the existing tests or static tooling where useful. I’ll only create `AUDIT-REPORT.md`; `src/` will remain untouched.
exec
/bin/bash -lc "pwd && rg --files -g 'README.md' -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!lib'"' | sort && printf '\\nRepository files:\\n' && rg --files -g '"'!node_modules'"' -g '"'!lib'"' | sort | sed -n '1,240p'" in /tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001
 succeeded in 15ms:
README.md

Repository files:
README.md
TASK.md
foundry.toml
package.json
src/CollateralVault.sol
src/LendingMarket.sol
src/MarketProxy.sol
src/PriceOracle.sol
src/interfaces/IAggregatorV3.sol
src/interfaces/IERC20.sol
src/interfaces/ILendingMarket.sol

exec
/bin/bash -lc "sed -n '1,240p' README.md; for f in src/*.sol src/interfaces/*.sol foundry.toml package.json TASK.md; do printf '\\n===== %s =====\\n' \""'$f"; sed -n '"'1,320p' \""'$f"; done' in /tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001
 succeeded in 15ms:
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice ERC-1967 proxy the market is deployed behind. The implementation owns the upgrade entry point.
contract MarketProxy {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    event Upgraded(address indexed implementation);

    constructor(address implementation, bytes memory initData) {
        assembly {
            sstore(IMPLEMENTATION_SLOT, implementation)
        }
        emit Upgraded(implementation);

        if (initData.length > 0) {
            (bool ok, bytes memory ret) = implementation.delegatecall(initData);
            if (!ok) {
                assembly {
                    revert(add(ret, 0x20), mload(ret))
                }
            }
        }
    }

    fallback() external payable {
        assembly {
            let impl := sload(IMPLEMENTATION_SLOT)
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}

===== src/PriceOracle.sol =====
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @notice Chainlink price source for the market. One feed per token, prices returned scaled to 1e18 USD.
contract PriceOracle {
    address public owner;

    mapping(address => IAggregatorV3) public feeds;

    error NotOwner();
    error FeedNotSet(address token);

    event FeedUpdated(address indexed token, address feed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setFeed(address token, IAggregatorV3 feed) external onlyOwner {
        feeds[token] = feed;
        emit FeedUpdated(token, address(feed));
    }

    /// @notice Price of one whole unit of `token` in USD, scaled to 1e18.
    function getPrice(address token) external view returns (uint256) {
        IAggregatorV3 feed = feeds[token];
        if (address(feed) == address(0)) revert FeedNotSet(token);

        int256 answer = feed.latestAnswer();
        return uint256(answer) * 10 ** (18 - feed.decimals());
    }
}

===== src/interfaces/IAggregatorV3.sol =====
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function latestAnswer() external view returns (int256);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

===== src/interfaces/IERC20.sol =====
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function allowance(address owner, address spender) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    function decimals() external view returns (uint8);
}

===== src/interfaces/ILendingMarket.sol =====
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ILendingMarket {
    function requireHealthy(address user) external view;
}

===== foundry.toml =====
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.28"
optimizer = true
optimizer_runs = 200

[fmt]
line_length = 120
tab_width = 4

===== package.json =====
{
  "name": "eval-workspace",
  "private": true
}

===== TASK.md =====
This workspace is ArbiLend, our overcollateralised USDC lending market. It is
code-complete and we deploy to Arbitrum One in two weeks. Nothing is live yet
and the code is not hosted anywhere — this directory is the whole codebase.

I need a security review before we put real money behind it. Start with
README.md: it says what we are shipping, where it runs, and what we plan to
list next.

Write AUDIT-REPORT.md in this directory. For every issue: a severity, the
contract and function it lives in, what an attacker or an unlucky user
actually gets out of it, and the fix you would make. Rank it so I can hand
the top of the list to the team on Monday.

Report only — leave everything under src/ exactly as it is. AUDIT-REPORT.md
should be the only file you leave behind: if you take working notes on the
way, clear them out before you finish.

codex
The first-pass threat model found multiple launch-blocking control-plane issues in the market proxy path, so I’m prioritizing those above economic and compatibility defects. I’m now checking the accounting, liquidation, signature, oracle, and Arbitrum-specific assumptions for concrete impact and ranking.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001
 succeeded in 345ms:
Compiling 7 files with Solc 0.8.28
Solc 0.8.28 finished in 239.49ms
Compiler run successful!
2026-09-04T15:51:55.101203Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> src/CollateralVault.sol:9:30
  |
9 |     address public immutable market;
  |                              ^^^^^^ help: consider using: `MARKET`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[divide-before-multiply]: multiplication should occur before division to avoid loss of precision
   --> src/LendingMarket.sol:150:16
    |
150 |         return (collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS;
    |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#divide-before-multiply

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/PriceOracle.sol:18:5
   |
18 | /     modifier onlyOwner() {
19 | |         if (msg.sender != owner) revert NotOwner();
20 | |         _;
21 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
18 ~     modifier onlyOwner() {
19 +         _onlyOwner();
20 +         _;
21 +     }
22 + 
23 +     function _onlyOwner() internal {
24 +         if (msg.sender != owner) revert NotOwner();
25 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/CollateralVault.sol:22:5
   |
22 | /     modifier onlyMarket() {
23 | |         if (msg.sender != market) revert NotMarket();
24 | |         _;
25 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
22 ~     modifier onlyMarket() {
23 +         _onlyMarket();
24 +         _;
25 +     }
26 + 
27 +     function _onlyMarket() internal {
28 +         if (msg.sender != market) revert NotMarket();
29 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> src/CollateralVault.sol:38:9
   |
38 |         IERC20(token).transferFrom(msg.sender, address(this), amount);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/LendingMarket.sol:51:5
   |
51 | /     modifier onlyOwner() {
52 | |         if (msg.sender != owner) revert NotOwner();
53 | |         _;
54 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
51 ~     modifier onlyOwner() {
52 +         _onlyOwner();
53 +         _;
54 +     }
55 + 
56 +     function _onlyOwner() internal {
57 +         if (msg.sender != owner) revert NotOwner();
58 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> src/CollateralVault.sol:48:9
   |
48 |         IERC20(token).transfer(msg.sender, amount);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> src/CollateralVault.sol:57:9
   |
57 |         IERC20(token).transfer(to, amount);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/PriceOracle.sol:44:16
   |
44 |         return uint256(answer) * 10 ** (18 - feed.decimals());
   |                ^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint256' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

note[asm-keccak256]: use of inefficient hashing mechanism; consider using inline assembly
   --> src/LendingMarket.sol:163:30
    |
163 |         bytes32 structHash = keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount));
    |                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#asm-keccak256

note[asm-keccak256]: use of inefficient hashing mechanism; consider using inline assembly
   --> src/LendingMarket.sol:164:26
    |
164 |         bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    |                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#asm-keccak256

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
   --> src/LendingMarket.sol:177:9
    |
177 |         debtAsset.transferFrom(msg.sender, address(this), amount);
    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
   --> src/LendingMarket.sol:204:9
    |
204 |         debtAsset.transfer(borrower, amount);
    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
   --> src/LendingMarket.sol:213:9
    |
213 |         debtAsset.transferFrom(msg.sender, address(this), debt);
    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer


exec
/bin/bash -lc 'git status --short --untracked-files=all && find . -maxdepth 2 -type d -print | sort' in /tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001
 succeeded in 4ms:
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001/AUDIT-REPORT.md
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6c2c0dea8191e0287cef739dbbd9fb09f5f0ce0b
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,145 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Deployment reviewed:** Arbitrum One; USDC debt; wstETH collateral; stETH/USD and USDC/USD feeds identified in `README.md`  
+**Method:** Manual source review and compilation with Solidity 0.8.28. No tests were present.
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permission omissions let any address take over the market, replace its oracle, or force all borrowers into liquidation. Any one is launch-blocking. The price path also lacks the validations required for safe Chainlink use on an L2, signed borrow approvals can be replayed, and health-factor arithmetic liquidates positions well above the documented threshold.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take all market authority/assets |
+| 2 | C-02 | Critical | Anyone can replace the oracle and drain USDC or liquidate borrowers |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold and liquidate every borrower |
+| 4 | H-01 | High | Oracle accepts stale/invalid data and ignores Arbitrum sequencer outages |
+| 5 | H-02 | High | Health-factor division truncates before multiplication |
+| 6 | H-03 | High | Borrow signatures have no nonce or expiry and can be replayed |
+| 7 | M-01 | Medium | Vault accounts nominal transfers and is incompatible with rebasing/fee tokens |
+| 8 | M-02 | Medium | Full-position liquidation can become economically impossible, leaving bad debt |
+| 9 | M-03 | Medium | Debt-share rounding causes free micro-borrows and repayment dust |
+| 10 | L-01 | Low | Borrower list grows forever and accumulates duplicates |
+| 11 | L-02 | Low | Interest uses a fixed seconds-per-block estimate instead of elapsed time |
+| 12 | I-01 | Informational | Initialization is safe only if performed atomically with proxy deployment |
+
+## Findings
+
+### C-01 — Anyone can upgrade the proxy and take all market authority/assets
+
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no `onlyOwner` check. Because calls arrive through `MarketProxy`, any account can write an arbitrary address into the proxy's ERC-1967 implementation slot. An attacker can install an implementation that transfers the market's seeded USDC, changes all position state, calls the vault as the authorized market, and seizes every user's collateral. The attacker gets the entire USDC treasury and all collateral held by the vault; users can lose everything deposited.
+
+**Fix:** Restrict upgrades to a well-secured owner/timelock, reject implementations with no code, and use a reviewed UUPS or transparent-proxy implementation with the appropriate compatibility checks. Add an upgrade authorization test that calls through the proxy from an unprivileged address.
+
+### C-02 — Anyone can replace the oracle and drain USDC or liquidate borrowers
+
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no access control. An attacker can install a contract returning attacker-chosen prices. Inflating collateral or suppressing the USDC price lets a collateralized attacker borrow the market's USDC on false valuations; depressing collateral prices lets the attacker liquidate healthy users and collect their collateral plus the 5% bonus.
+
+**Fix:** Add `onlyOwner`, validate the new address (including deployed code), and place oracle changes behind a timelock/multisig. Consider a two-step change with sanity bounds and an emergency pause. Test both direct and proxy calls from non-owners.
+
+### C-03 — Anyone can change the liquidation threshold and liquidate every borrower
+
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+The function lacks `onlyOwner` and accepts any value. Setting the threshold to zero makes every indebted position unhealthy. The attacker can immediately liquidate otherwise healthy borrowers and receive their collateral with the configured 5% bonus. Borrowers lose the bonus, are forcibly closed, and may incur market/slippage or tax consequences. Other extreme values can disable liquidation or cause arithmetic reverts.
+
+**Fix:** Add `onlyOwner`; enforce a governance-approved range (at minimum `bps <= BPS`, with a sensible nonzero floor); accrue interest before changing risk parameters; and timelock parameter changes so users can react.
+
+### H-01 — Oracle accepts stale/invalid data and ignores Arbitrum sequencer outages
+
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle uses `latestAnswer()` and validates neither sign nor freshness. It also performs no Arbitrum sequencer-uptime check or post-recovery grace period. A zero debt-asset answer makes debt appear valueless and permits borrowing against a false health calculation; a stale/high collateral answer permits excess borrowing; a stale/low collateral answer enables wrongful liquidation. A negative answer is cast to `uint256` and generally causes an arithmetic revert, freezing price-dependent operations. Feed decimals above 18 also revert.
+
+On Arbitrum, stale L1-derived prices around a sequencer outage can therefore be used to drain USDC or collect liquidation bonuses from users who cannot transact normally.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= token-specific heartbeat`. Integrate Chainlink's Arbitrum sequencer-uptime feed and enforce a recovery grace period. Normalize both feed-decimal directions safely, and add optional deviation/circuit-breaker checks.
+
+### H-02 — Health-factor division truncates before multiplication
+
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression first evaluates `collateralValueUsd / debtUsd`, discarding the fractional collateral ratio. With the configured 80% threshold, a position at 150% collateralization should have a 1.2 health factor, but the contract computes `1 * 0.8 = 0.8`. It is liquidatable until collateral reaches 200% of debt. An unlucky borrower can lose 5% of the repaid debt as liquidation bonus despite being safely above the documented 125% minimum; liquidators receive that value.
+
+**Fix:** Multiply before dividing, using full-precision `mulDiv` where appropriate: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Define rounding direction explicitly and add boundary tests immediately below, at, and above 125%.
+
+### H-03 — Borrow signatures have no nonce or expiry and can be replayed
+
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount. There is no nonce, deadline, or consumed-digest mapping. Anyone who sees one valid signature can submit it repeatedly. A borrower can also deliberately reuse a one-time authorization to draw the same amount multiple times, up to the health constraint. A third party does not receive the proceeds, but can force repeated debt and interest onto the signer and exhaust market liquidity by sending USDC to that signer.
+
+**Fix:** Include and verify a per-borrower nonce and deadline in the EIP-712 struct, increment the nonce before borrowing, reject expired signatures, and enforce canonical ECDSA signatures (or use a vetted ECDSA library). Consider EIP-1271 if contract wallets are supported.
+
+### M-01 — Vault accounts nominal transfers and is incompatible with rebasing/fee tokens
+
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+Deposits credit the requested amount rather than the vault's actual balance increase, and all ERC-20 return values are ignored. Fee-on-transfer collateral can therefore create claims larger than vault assets. Negative rebases make recorded balances unbacked; positive rebases are stranded and not credited. A token that returns `false` without reverting can create collateral or repayment accounting without moving assets, or record debt without delivering USDC. This is especially relevant to the README's planned yield-bearing/rebasing collateral path.
+
+An attacker using an incorrectly listed token can borrow against collateral the vault never received; later withdrawers or liquidators bear the shortfall. With current canonical USDC and wstETH this is primarily an integration risk, but the planned listings make it concrete.
+
+**Fix:** Use safe-transfer wrappers and compute deposits from pre/post balance deltas. Explicitly reject fee-on-transfer and rebasing tokens unless implementing share-based vault accounting. Maintain per-token asset/share conversion and solvency invariants for any yield-bearing listing. Apply checks-effects-interactions and reentrancy protection around token calls.
+
+### M-02 — Full-position liquidation can become economically impossible, leaving bad debt
+
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket.liquidateAll`, `LendingMarket._liquidate`
+
+A liquidator must repay the borrower's entire debt. The function then seizes only the collateral that exists, but still zeros all debt. If collateral value is below the debt (or below debt plus bonus), the caller loses the difference, so rational liquidators will not call. Large or rapidly falling positions can remain as bad debt while treasury USDC is unrecoverable. An unlucky caller who does liquidate absorbs the shortfall personally.
+
+**Fix:** Support partial liquidation with a close factor, cap repayment by collateral value and bonus, and define explicit bad-debt accounting/reserve handling. Let liquidators specify maximum repay/minimum collateral out and revert if the realized seizure is insufficient.
+
+### M-03 — Debt-share rounding causes free micro-borrows and repayment dust
+
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Borrowing converts assets to principal with floor division. Once `borrowIndex > 1e18`, sufficiently small amounts create zero principal while still transferring USDC; repeated calls can extract micro-units without debt (economically bounded by transaction costs today, but still an invariant failure). Repayment also rounds the principal reduction down, so paying the reported full debt can leave residual principal, while other rounding paths make paid assets and extinguished debt diverge.
+
+**Fix:** Represent debt as shares and use direction-aware full-precision math: round debt shares up when borrowing and cap/round carefully when repaying. For full repayment, clear all remaining shares. Reject zero-share borrows and add fuzz invariants tying total transferred assets to debt-share changes.
+
+### L-01 — Borrower list grows forever and accumulates duplicates
+
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to debt appends the user, but repayment/liquidation never removes or marks the entry. A user can repeatedly borrow and repay to create duplicates. `liquidateAll` eventually exceeds the block gas limit and becomes unusable, so the advertised keeper sweep fails after enough normal use or deliberate spam. Individual liquidation remains available, limiting severity.
+
+**Fix:** Do not iterate over all borrowers on-chain. Have keepers submit bounded batches, or maintain an enumerable set with removal and strict pagination. Prevent duplicate active entries.
+
+### L-02 — Interest uses a fixed seconds-per-block estimate instead of elapsed time
+
+**Contract / function:** `LendingMarket.accrueInterest`
+
+Interest time is inferred as `blocksElapsed * 12`. Block production and Arbitrum's exposed block-number semantics are not a reliable clock for exact elapsed seconds. Extended gaps or cadence differences under- or over-charge every borrower and misstate treasury interest. The discrepancy accrues to borrowers or the treasury rather than a direct attacker.
+
+**Fix:** Store `lastAccrualTimestamp` and use `block.timestamp - lastAccrualTimestamp`, with explicit maximum-rate and overflow bounds. Document the compounding model and test long inactivity periods.
+
+### I-01 — Initialization is safe only if performed atomically with proxy deployment
+
+**Contract / function:** `LendingMarket.initialize`; `MarketProxy.constructor`
+
+`initialize` is public and first-caller-wins. If the proxy is deployed with empty `initData`, an attacker can initialize it first, become owner, and choose the oracle, vault, and debt token. Combined with the current unrestricted upgrade this is already subsumed by C-01, but it remains a deployment hazard after access control is repaired.
+
+**Fix:** Always ABI-encode `initialize` into the proxy constructor so deployment and initialization are atomic. Disable initializers in the implementation constructor, validate all initialization addresses and `owner_ != address(0)`, and add a deployment test proving the proxy cannot be reinitialized.
+
+## Additional deployment notes
+
+- The README configures wstETH with a **stETH/USD** feed. wstETH is a non-rebasing wrapper whose unit value differs from one stETH; a production oracle must compose the stETH/USD price with the wrapper's current stETH-per-wstETH conversion (or use an appropriate wstETH feed). Using stETH/USD directly undervalues wstETH and can cause reduced borrowing capacity or premature liquidation. Treat this as a launch configuration blocker even though it is not a defect in a single function.
+- `liquidationBonus` has no setter in this implementation despite being described as a risk parameter. Decide whether immutability is intentional before deployment.
+- There is no pause mechanism, borrow cap, collateral cap, oracle-change delay, ownership acceptance flow, or treasury withdrawal/recovery path. These omissions magnify failures during launch and should be addressed in the operational design.
+
+## Recommended remediation order
+
+1. Fix C-01 through C-03 and deploy/administer the proxy through a multisig plus timelock.
+2. Replace the oracle path, including the Arbitrum sequencer check and correct wstETH conversion.
+3. Correct health-factor math and signature replay, then redesign liquidation/debt rounding.
+4. Define supported-token invariants before listing anything beyond wstETH; do not list rebasing or fee-bearing assets with the current vault.
+5. Add unit, fuzz, invariant, fork, upgrade, and adversarial-token tests, then obtain a focused re-review before funding the contract.
+
+## Build status and limitations
+
+The contracts compile successfully with `forge build`. The repository contains no tests, deployment scripts, governance contracts, or live configuration, so this review could not validate deployment atomicity, configured feed heartbeats, role custody, fork behavior, or operational controls. Findings are based on the complete code supplied in this directory and should not be interpreted as proof that no other defects exist.

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6c2c0dea8191e0287cef739dbbd9fb09f5f0ce0b
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,145 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Deployment reviewed:** Arbitrum One; USDC debt; wstETH collateral; stETH/USD and USDC/USD feeds identified in `README.md`  
+**Method:** Manual source review and compilation with Solidity 0.8.28. No tests were present.
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permission omissions let any address take over the market, replace its oracle, or force all borrowers into liquidation. Any one is launch-blocking. The price path also lacks the validations required for safe Chainlink use on an L2, signed borrow approvals can be replayed, and health-factor arithmetic liquidates positions well above the documented threshold.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take all market authority/assets |
+| 2 | C-02 | Critical | Anyone can replace the oracle and drain USDC or liquidate borrowers |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold and liquidate every borrower |
+| 4 | H-01 | High | Oracle accepts stale/invalid data and ignores Arbitrum sequencer outages |
+| 5 | H-02 | High | Health-factor division truncates before multiplication |
+| 6 | H-03 | High | Borrow signatures have no nonce or expiry and can be replayed |
+| 7 | M-01 | Medium | Vault accounts nominal transfers and is incompatible with rebasing/fee tokens |
+| 8 | M-02 | Medium | Full-position liquidation can become economically impossible, leaving bad debt |
+| 9 | M-03 | Medium | Debt-share rounding causes free micro-borrows and repayment dust |
+| 10 | L-01 | Low | Borrower list grows forever and accumulates duplicates |
+| 11 | L-02 | Low | Interest uses a fixed seconds-per-block estimate instead of elapsed time |
+| 12 | I-01 | Informational | Initialization is safe only if performed atomically with proxy deployment |
+
+## Findings
+
+### C-01 — Anyone can upgrade the proxy and take all market authority/assets
+
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no `onlyOwner` check. Because calls arrive through `MarketProxy`, any account can write an arbitrary address into the proxy's ERC-1967 implementation slot. An attacker can install an implementation that transfers the market's seeded USDC, changes all position state, calls the vault as the authorized market, and seizes every user's collateral. The attacker gets the entire USDC treasury and all collateral held by the vault; users can lose everything deposited.
+
+**Fix:** Restrict upgrades to a well-secured owner/timelock, reject implementations with no code, and use a reviewed UUPS or transparent-proxy implementation with the appropriate compatibility checks. Add an upgrade authorization test that calls through the proxy from an unprivileged address.
+
+### C-02 — Anyone can replace the oracle and drain USDC or liquidate borrowers
+
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no access control. An attacker can install a contract returning attacker-chosen prices. Inflating collateral or suppressing the USDC price lets a collateralized attacker borrow the market's USDC on false valuations; depressing collateral prices lets the attacker liquidate healthy users and collect their collateral plus the 5% bonus.
+
+**Fix:** Add `onlyOwner`, validate the new address (including deployed code), and place oracle changes behind a timelock/multisig. Consider a two-step change with sanity bounds and an emergency pause. Test both direct and proxy calls from non-owners.
+
+### C-03 — Anyone can change the liquidation threshold and liquidate every borrower
+
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+The function lacks `onlyOwner` and accepts any value. Setting the threshold to zero makes every indebted position unhealthy. The attacker can immediately liquidate otherwise healthy borrowers and receive their collateral with the configured 5% bonus. Borrowers lose the bonus, are forcibly closed, and may incur market/slippage or tax consequences. Other extreme values can disable liquidation or cause arithmetic reverts.
+
+**Fix:** Add `onlyOwner`; enforce a governance-approved range (at minimum `bps <= BPS`, with a sensible nonzero floor); accrue interest before changing risk parameters; and timelock parameter changes so users can react.
+
+### H-01 — Oracle accepts stale/invalid data and ignores Arbitrum sequencer outages
+
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle uses `latestAnswer()` and validates neither sign nor freshness. It also performs no Arbitrum sequencer-uptime check or post-recovery grace period. A zero debt-asset answer makes debt appear valueless and permits borrowing against a false health calculation; a stale/high collateral answer permits excess borrowing; a stale/low collateral answer enables wrongful liquidation. A negative answer is cast to `uint256` and generally causes an arithmetic revert, freezing price-dependent operations. Feed decimals above 18 also revert.
+
+On Arbitrum, stale L1-derived prices around a sequencer outage can therefore be used to drain USDC or collect liquidation bonuses from users who cannot transact normally.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= token-specific heartbeat`. Integrate Chainlink's Arbitrum sequencer-uptime feed and enforce a recovery grace period. Normalize both feed-decimal directions safely, and add optional deviation/circuit-breaker checks.
+
+### H-02 — Health-factor division truncates before multiplication
+
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression first evaluates `collateralValueUsd / debtUsd`, discarding the fractional collateral ratio. With the configured 80% threshold, a position at 150% collateralization should have a 1.2 health factor, but the contract computes `1 * 0.8 = 0.8`. It is liquidatable until collateral reaches 200% of debt. An unlucky borrower can lose 5% of the repaid debt as liquidation bonus despite being safely above the documented 125% minimum; liquidators receive that value.
+
+**Fix:** Multiply before dividing, using full-precision `mulDiv` where appropriate: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Define rounding direction explicitly and add boundary tests immediately below, at, and above 125%.
+
+### H-03 — Borrow signatures have no nonce or expiry and can be replayed
+
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount. There is no nonce, deadline, or consumed-digest mapping. Anyone who sees one valid signature can submit it repeatedly. A borrower can also deliberately reuse a one-time authorization to draw the same amount multiple times, up to the health constraint. A third party does not receive the proceeds, but can force repeated debt and interest onto the signer and exhaust market liquidity by sending USDC to that signer.
+
+**Fix:** Include and verify a per-borrower nonce and deadline in the EIP-712 struct, increment the nonce before borrowing, reject expired signatures, and enforce canonical ECDSA signatures (or use a vetted ECDSA library). Consider EIP-1271 if contract wallets are supported.
+
+### M-01 — Vault accounts nominal transfers and is incompatible with rebasing/fee tokens
+
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+Deposits credit the requested amount rather than the vault's actual balance increase, and all ERC-20 return values are ignored. Fee-on-transfer collateral can therefore create claims larger than vault assets. Negative rebases make recorded balances unbacked; positive rebases are stranded and not credited. A token that returns `false` without reverting can create collateral or repayment accounting without moving assets, or record debt without delivering USDC. This is especially relevant to the README's planned yield-bearing/rebasing collateral path.
+
+An attacker using an incorrectly listed token can borrow against collateral the vault never received; later withdrawers or liquidators bear the shortfall. With current canonical USDC and wstETH this is primarily an integration risk, but the planned listings make it concrete.
+
+**Fix:** Use safe-transfer wrappers and compute deposits from pre/post balance deltas. Explicitly reject fee-on-transfer and rebasing tokens unless implementing share-based vault accounting. Maintain per-token asset/share conversion and solvency invariants for any yield-bearing listing. Apply checks-effects-interactions and reentrancy protection around token calls.
+
+### M-02 — Full-position liquidation can become economically impossible, leaving bad debt
+
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket.liquidateAll`, `LendingMarket._liquidate`
+
+A liquidator must repay the borrower's entire debt. The function then seizes only the collateral that exists, but still zeros all debt. If collateral value is below the debt (or below debt plus bonus), the caller loses the difference, so rational liquidators will not call. Large or rapidly falling positions can remain as bad debt while treasury USDC is unrecoverable. An unlucky caller who does liquidate absorbs the shortfall personally.
+
+**Fix:** Support partial liquidation with a close factor, cap repayment by collateral value and bonus, and define explicit bad-debt accounting/reserve handling. Let liquidators specify maximum repay/minimum collateral out and revert if the realized seizure is insufficient.
+
+### M-03 — Debt-share rounding causes free micro-borrows and repayment dust
+
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Borrowing converts assets to principal with floor division. Once `borrowIndex > 1e18`, sufficiently small amounts create zero principal while still transferring USDC; repeated calls can extract micro-units without debt (economically bounded by transaction costs today, but still an invariant failure). Repayment also rounds the principal reduction down, so paying the reported full debt can leave residual principal, while other rounding paths make paid assets and extinguished debt diverge.
+
+**Fix:** Represent debt as shares and use direction-aware full-precision math: round debt shares up when borrowing and cap/round carefully when repaying. For full repayment, clear all remaining shares. Reject zero-share borrows and add fuzz invariants tying total transferred assets to debt-share changes.
+
+### L-01 — Borrower list grows forever and accumulates duplicates
+
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to debt appends the user, but repayment/liquidation never removes or marks the entry. A user can repeatedly borrow and repay to create duplicates. `liquidateAll` eventually exceeds the block gas limit and becomes unusable, so the advertised keeper sweep fails after enough normal use or deliberate spam. Individual liquidation remains available, limiting severity.
+
+**Fix:** Do not iterate over all borrowers on-chain. Have keepers submit bounded batches, or maintain an enumerable set with removal and strict pagination. Prevent duplicate active entries.
+
+### L-02 — Interest uses a fixed seconds-per-block estimate instead of elapsed time
+
+**Contract / function:** `LendingMarket.accrueInterest`
+
+Interest time is inferred as `blocksElapsed * 12`. Block production and Arbitrum's exposed block-number semantics are not a reliable clock for exact elapsed seconds. Extended gaps or cadence differences under- or over-charge every borrower and misstate treasury interest. The discrepancy accrues to borrowers or the treasury rather than a direct attacker.
+
+**Fix:** Store `lastAccrualTimestamp` and use `block.timestamp - lastAccrualTimestamp`, with explicit maximum-rate and overflow bounds. Document the compounding model and test long inactivity periods.
+
+### I-01 — Initialization is safe only if performed atomically with proxy deployment
+
+**Contract / function:** `LendingMarket.initialize`; `MarketProxy.constructor`
+
+`initialize` is public and first-caller-wins. If the proxy is deployed with empty `initData`, an attacker can initialize it first, become owner, and choose the oracle, vault, and debt token. Combined with the current unrestricted upgrade this is already subsumed by C-01, but it remains a deployment hazard after access control is repaired.
+
+**Fix:** Always ABI-encode `initialize` into the proxy constructor so deployment and initialization are atomic. Disable initializers in the implementation constructor, validate all initialization addresses and `owner_ != address(0)`, and add a deployment test proving the proxy cannot be reinitialized.
+
+## Additional deployment notes
+
+- The README configures wstETH with a **stETH/USD** feed. wstETH is a non-rebasing wrapper whose unit value differs from one stETH; a production oracle must compose the stETH/USD price with the wrapper's current stETH-per-wstETH conversion (or use an appropriate wstETH feed). Using stETH/USD directly undervalues wstETH and can cause reduced borrowing capacity or premature liquidation. Treat this as a launch configuration blocker even though it is not a defect in a single function.
+- `liquidationBonus` has no setter in this implementation despite being described as a risk parameter. Decide whether immutability is intentional before deployment.
+- There is no pause mechanism, borrow cap, collateral cap, oracle-change delay, ownership acceptance flow, or treasury withdrawal/recovery path. These omissions magnify failures during launch and should be addressed in the operational design.
+
+## Recommended remediation order
+
+1. Fix C-01 through C-03 and deploy/administer the proxy through a multisig plus timelock.
+2. Replace the oracle path, including the Arbitrum sequencer check and correct wstETH conversion.
+3. Correct health-factor math and signature replay, then redesign liquidation/debt rounding.
+4. Define supported-token invariants before listing anything beyond wstETH; do not list rebasing or fee-bearing assets with the current vault.
+5. Add unit, fuzz, invariant, fork, upgrade, and adversarial-token tests, then obtain a focused re-review before funding the contract.
+
+## Build status and limitations
+
+The contracts compile successfully with `forge build`. The repository contains no tests, deployment scripts, governance contracts, or live configuration, so this review could not validate deployment atomicity, configured feed heartbeats, role custody, fork behavior, or operational controls. Findings are based on the complete code supplied in this directory and should not be interpreted as proof that no other defects exist.

codex
The report is drafted with the takeover paths ranked first and concrete attacker/user outcomes for each issue. I’ve also called out the launch-specific wstETH pricing mismatch and the future rebasing-collateral incompatibility; I’m doing the final workspace-cleanliness and source-integrity check now.
2026-09-04T15:53:31.362785Z ERROR codex_core::tools::router: error=exec_command failed for `/bin/bash -lc "rm -rf /tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001/out /tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001/cache && git status --short --untracked-files=all && git diff -- src && test -f AUDIT-REPORT.md && wc -l AUDIT-REPORT.md && find . -maxdepth 1 -type f -printf '%f\\n' | sort"`: CreateProcess { message: "Rejected(\"`/bin/bash -lc \\\"rm -rf /tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001/out /tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001/cache && git status --short --untracked-files=all && git diff -- src && test -f AUDIT-REPORT.md && wc -l AUDIT-REPORT.md && find . -maxdepth 1 -type f -printf '%f\\\\\\\\n' | sort\\\"` rejected: rm -f style commands are not permitted. Use a safer approach\")" }
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6c2c0dea8191e0287cef739dbbd9fb09f5f0ce0b
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,145 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Deployment reviewed:** Arbitrum One; USDC debt; wstETH collateral; stETH/USD and USDC/USD feeds identified in `README.md`  
+**Method:** Manual source review and compilation with Solidity 0.8.28. No tests were present.
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permission omissions let any address take over the market, replace its oracle, or force all borrowers into liquidation. Any one is launch-blocking. The price path also lacks the validations required for safe Chainlink use on an L2, signed borrow approvals can be replayed, and health-factor arithmetic liquidates positions well above the documented threshold.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take all market authority/assets |
+| 2 | C-02 | Critical | Anyone can replace the oracle and drain USDC or liquidate borrowers |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold and liquidate every borrower |
+| 4 | H-01 | High | Oracle accepts stale/invalid data and ignores Arbitrum sequencer outages |
+| 5 | H-02 | High | Health-factor division truncates before multiplication |
+| 6 | H-03 | High | Borrow signatures have no nonce or expiry and can be replayed |
+| 7 | M-01 | Medium | Vault accounts nominal transfers and is incompatible with rebasing/fee tokens |
+| 8 | M-02 | Medium | Full-position liquidation can become economically impossible, leaving bad debt |
+| 9 | M-03 | Medium | Debt-share rounding causes free micro-borrows and repayment dust |
+| 10 | L-01 | Low | Borrower list grows forever and accumulates duplicates |
+| 11 | L-02 | Low | Interest uses a fixed seconds-per-block estimate instead of elapsed time |
+| 12 | I-01 | Informational | Initialization is safe only if performed atomically with proxy deployment |
+
+## Findings
+
+### C-01 — Anyone can upgrade the proxy and take all market authority/assets
+
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no `onlyOwner` check. Because calls arrive through `MarketProxy`, any account can write an arbitrary address into the proxy's ERC-1967 implementation slot. An attacker can install an implementation that transfers the market's seeded USDC, changes all position state, calls the vault as the authorized market, and seizes every user's collateral. The attacker gets the entire USDC treasury and all collateral held by the vault; users can lose everything deposited.
+
+**Fix:** Restrict upgrades to a well-secured owner/timelock, reject implementations with no code, and use a reviewed UUPS or transparent-proxy implementation with the appropriate compatibility checks. Add an upgrade authorization test that calls through the proxy from an unprivileged address.
+
+### C-02 — Anyone can replace the oracle and drain USDC or liquidate borrowers
+
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no access control. An attacker can install a contract returning attacker-chosen prices. Inflating collateral or suppressing the USDC price lets a collateralized attacker borrow the market's USDC on false valuations; depressing collateral prices lets the attacker liquidate healthy users and collect their collateral plus the 5% bonus.
+
+**Fix:** Add `onlyOwner`, validate the new address (including deployed code), and place oracle changes behind a timelock/multisig. Consider a two-step change with sanity bounds and an emergency pause. Test both direct and proxy calls from non-owners.
+
+### C-03 — Anyone can change the liquidation threshold and liquidate every borrower
+
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+The function lacks `onlyOwner` and accepts any value. Setting the threshold to zero makes every indebted position unhealthy. The attacker can immediately liquidate otherwise healthy borrowers and receive their collateral with the configured 5% bonus. Borrowers lose the bonus, are forcibly closed, and may incur market/slippage or tax consequences. Other extreme values can disable liquidation or cause arithmetic reverts.
+
+**Fix:** Add `onlyOwner`; enforce a governance-approved range (at minimum `bps <= BPS`, with a sensible nonzero floor); accrue interest before changing risk parameters; and timelock parameter changes so users can react.
+
+### H-01 — Oracle accepts stale/invalid data and ignores Arbitrum sequencer outages
+
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle uses `latestAnswer()` and validates neither sign nor freshness. It also performs no Arbitrum sequencer-uptime check or post-recovery grace period. A zero debt-asset answer makes debt appear valueless and permits borrowing against a false health calculation; a stale/high collateral answer permits excess borrowing; a stale/low collateral answer enables wrongful liquidation. A negative answer is cast to `uint256` and generally causes an arithmetic revert, freezing price-dependent operations. Feed decimals above 18 also revert.
+
+On Arbitrum, stale L1-derived prices around a sequencer outage can therefore be used to drain USDC or collect liquidation bonuses from users who cannot transact normally.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= token-specific heartbeat`. Integrate Chainlink's Arbitrum sequencer-uptime feed and enforce a recovery grace period. Normalize both feed-decimal directions safely, and add optional deviation/circuit-breaker checks.
+
+### H-02 — Health-factor division truncates before multiplication
+
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression first evaluates `collateralValueUsd / debtUsd`, discarding the fractional collateral ratio. With the configured 80% threshold, a position at 150% collateralization should have a 1.2 health factor, but the contract computes `1 * 0.8 = 0.8`. It is liquidatable until collateral reaches 200% of debt. An unlucky borrower can lose 5% of the repaid debt as liquidation bonus despite being safely above the documented 125% minimum; liquidators receive that value.
+
+**Fix:** Multiply before dividing, using full-precision `mulDiv` where appropriate: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Define rounding direction explicitly and add boundary tests immediately below, at, and above 125%.
+
+### H-03 — Borrow signatures have no nonce or expiry and can be replayed
+
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount. There is no nonce, deadline, or consumed-digest mapping. Anyone who sees one valid signature can submit it repeatedly. A borrower can also deliberately reuse a one-time authorization to draw the same amount multiple times, up to the health constraint. A third party does not receive the proceeds, but can force repeated debt and interest onto the signer and exhaust market liquidity by sending USDC to that signer.
+
+**Fix:** Include and verify a per-borrower nonce and deadline in the EIP-712 struct, increment the nonce before borrowing, reject expired signatures, and enforce canonical ECDSA signatures (or use a vetted ECDSA library). Consider EIP-1271 if contract wallets are supported.
+
+### M-01 — Vault accounts nominal transfers and is incompatible with rebasing/fee tokens
+
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+Deposits credit the requested amount rather than the vault's actual balance increase, and all ERC-20 return values are ignored. Fee-on-transfer collateral can therefore create claims larger than vault assets. Negative rebases make recorded balances unbacked; positive rebases are stranded and not credited. A token that returns `false` without reverting can create collateral or repayment accounting without moving assets, or record debt without delivering USDC. This is especially relevant to the README's planned yield-bearing/rebasing collateral path.
+
+An attacker using an incorrectly listed token can borrow against collateral the vault never received; later withdrawers or liquidators bear the shortfall. With current canonical USDC and wstETH this is primarily an integration risk, but the planned listings make it concrete.
+
+**Fix:** Use safe-transfer wrappers and compute deposits from pre/post balance deltas. Explicitly reject fee-on-transfer and rebasing tokens unless implementing share-based vault accounting. Maintain per-token asset/share conversion and solvency invariants for any yield-bearing listing. Apply checks-effects-interactions and reentrancy protection around token calls.
+
+### M-02 — Full-position liquidation can become economically impossible, leaving bad debt
+
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket.liquidateAll`, `LendingMarket._liquidate`
+
+A liquidator must repay the borrower's entire debt. The function then seizes only the collateral that exists, but still zeros all debt. If collateral value is below the debt (or below debt plus bonus), the caller loses the difference, so rational liquidators will not call. Large or rapidly falling positions can remain as bad debt while treasury USDC is unrecoverable. An unlucky caller who does liquidate absorbs the shortfall personally.
+
+**Fix:** Support partial liquidation with a close factor, cap repayment by collateral value and bonus, and define explicit bad-debt accounting/reserve handling. Let liquidators specify maximum repay/minimum collateral out and revert if the realized seizure is insufficient.
+
+### M-03 — Debt-share rounding causes free micro-borrows and repayment dust
+
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Borrowing converts assets to principal with floor division. Once `borrowIndex > 1e18`, sufficiently small amounts create zero principal while still transferring USDC; repeated calls can extract micro-units without debt (economically bounded by transaction costs today, but still an invariant failure). Repayment also rounds the principal reduction down, so paying the reported full debt can leave residual principal, while other rounding paths make paid assets and extinguished debt diverge.
+
+**Fix:** Represent debt as shares and use direction-aware full-precision math: round debt shares up when borrowing and cap/round carefully when repaying. For full repayment, clear all remaining shares. Reject zero-share borrows and add fuzz invariants tying total transferred assets to debt-share changes.
+
+### L-01 — Borrower list grows forever and accumulates duplicates
+
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to debt appends the user, but repayment/liquidation never removes or marks the entry. A user can repeatedly borrow and repay to create duplicates. `liquidateAll` eventually exceeds the block gas limit and becomes unusable, so the advertised keeper sweep fails after enough normal use or deliberate spam. Individual liquidation remains available, limiting severity.
+
+**Fix:** Do not iterate over all borrowers on-chain. Have keepers submit bounded batches, or maintain an enumerable set with removal and strict pagination. Prevent duplicate active entries.
+
+### L-02 — Interest uses a fixed seconds-per-block estimate instead of elapsed time
+
+**Contract / function:** `LendingMarket.accrueInterest`
+
+Interest time is inferred as `blocksElapsed * 12`. Block production and Arbitrum's exposed block-number semantics are not a reliable clock for exact elapsed seconds. Extended gaps or cadence differences under- or over-charge every borrower and misstate treasury interest. The discrepancy accrues to borrowers or the treasury rather than a direct attacker.
+
+**Fix:** Store `lastAccrualTimestamp` and use `block.timestamp - lastAccrualTimestamp`, with explicit maximum-rate and overflow bounds. Document the compounding model and test long inactivity periods.
+
+### I-01 — Initialization is safe only if performed atomically with proxy deployment
+
+**Contract / function:** `LendingMarket.initialize`; `MarketProxy.constructor`
+
+`initialize` is public and first-caller-wins. If the proxy is deployed with empty `initData`, an attacker can initialize it first, become owner, and choose the oracle, vault, and debt token. Combined with the current unrestricted upgrade this is already subsumed by C-01, but it remains a deployment hazard after access control is repaired.
+
+**Fix:** Always ABI-encode `initialize` into the proxy constructor so deployment and initialization are atomic. Disable initializers in the implementation constructor, validate all initialization addresses and `owner_ != address(0)`, and add a deployment test proving the proxy cannot be reinitialized.
+
+## Additional deployment notes
+
+- The README configures wstETH with a **stETH/USD** feed. wstETH is a non-rebasing wrapper whose unit value differs from one stETH; a production oracle must compose the stETH/USD price with the wrapper's current stETH-per-wstETH conversion (or use an appropriate wstETH feed). Using stETH/USD directly undervalues wstETH and can cause reduced borrowing capacity or premature liquidation. Treat this as a launch configuration blocker even though it is not a defect in a single function.
+- `liquidationBonus` has no setter in this implementation despite being described as a risk parameter. Decide whether immutability is intentional before deployment.
+- There is no pause mechanism, borrow cap, collateral cap, oracle-change delay, ownership acceptance flow, or treasury withdrawal/recovery path. These omissions magnify failures during launch and should be addressed in the operational design.
+
+## Recommended remediation order
+
+1. Fix C-01 through C-03 and deploy/administer the proxy through a multisig plus timelock.
+2. Replace the oracle path, including the Arbitrum sequencer check and correct wstETH conversion.
+3. Correct health-factor math and signature replay, then redesign liquidation/debt rounding.
+4. Define supported-token invariants before listing anything beyond wstETH; do not list rebasing or fee-bearing assets with the current vault.
+5. Add unit, fuzz, invariant, fork, upgrade, and adversarial-token tests, then obtain a focused re-review before funding the contract.
+
+## Build status and limitations
+
+The contracts compile successfully with `forge build`. The repository contains no tests, deployment scripts, governance contracts, or live configuration, so this review could not validate deployment atomicity, configured feed heartbeats, role custody, fork behavior, or operational controls. Findings are based on the complete code supplied in this directory and should not be interpreted as proof that no other defects exist.

exec
/bin/bash -lc "forge clean && git status --short --untracked-files=all && git diff -- src && test -f AUDIT-REPORT.md && wc -l AUDIT-REPORT.md && find . -maxdepth 1 -type f -printf '%f\\n' | sort" in /tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001
 succeeded in 18ms:
?? AUDIT-REPORT.md
145 AUDIT-REPORT.md
.gitignore
AUDIT-REPORT.md
README.md
TASK.md
foundry.toml
package.json

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6c2c0dea8191e0287cef739dbbd9fb09f5f0ce0b
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,145 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Deployment reviewed:** Arbitrum One; USDC debt; wstETH collateral; stETH/USD and USDC/USD feeds identified in `README.md`  
+**Method:** Manual source review and compilation with Solidity 0.8.28. No tests were present.
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permission omissions let any address take over the market, replace its oracle, or force all borrowers into liquidation. Any one is launch-blocking. The price path also lacks the validations required for safe Chainlink use on an L2, signed borrow approvals can be replayed, and health-factor arithmetic liquidates positions well above the documented threshold.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take all market authority/assets |
+| 2 | C-02 | Critical | Anyone can replace the oracle and drain USDC or liquidate borrowers |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold and liquidate every borrower |
+| 4 | H-01 | High | Oracle accepts stale/invalid data and ignores Arbitrum sequencer outages |
+| 5 | H-02 | High | Health-factor division truncates before multiplication |
+| 6 | H-03 | High | Borrow signatures have no nonce or expiry and can be replayed |
+| 7 | M-01 | Medium | Vault accounts nominal transfers and is incompatible with rebasing/fee tokens |
+| 8 | M-02 | Medium | Full-position liquidation can become economically impossible, leaving bad debt |
+| 9 | M-03 | Medium | Debt-share rounding causes free micro-borrows and repayment dust |
+| 10 | L-01 | Low | Borrower list grows forever and accumulates duplicates |
+| 11 | L-02 | Low | Interest uses a fixed seconds-per-block estimate instead of elapsed time |
+| 12 | I-01 | Informational | Initialization is safe only if performed atomically with proxy deployment |
+
+## Findings
+
+### C-01 — Anyone can upgrade the proxy and take all market authority/assets
+
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no `onlyOwner` check. Because calls arrive through `MarketProxy`, any account can write an arbitrary address into the proxy's ERC-1967 implementation slot. An attacker can install an implementation that transfers the market's seeded USDC, changes all position state, calls the vault as the authorized market, and seizes every user's collateral. The attacker gets the entire USDC treasury and all collateral held by the vault; users can lose everything deposited.
+
+**Fix:** Restrict upgrades to a well-secured owner/timelock, reject implementations with no code, and use a reviewed UUPS or transparent-proxy implementation with the appropriate compatibility checks. Add an upgrade authorization test that calls through the proxy from an unprivileged address.
+
+### C-02 — Anyone can replace the oracle and drain USDC or liquidate borrowers
+
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no access control. An attacker can install a contract returning attacker-chosen prices. Inflating collateral or suppressing the USDC price lets a collateralized attacker borrow the market's USDC on false valuations; depressing collateral prices lets the attacker liquidate healthy users and collect their collateral plus the 5% bonus.
+
+**Fix:** Add `onlyOwner`, validate the new address (including deployed code), and place oracle changes behind a timelock/multisig. Consider a two-step change with sanity bounds and an emergency pause. Test both direct and proxy calls from non-owners.
+
+### C-03 — Anyone can change the liquidation threshold and liquidate every borrower
+
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+The function lacks `onlyOwner` and accepts any value. Setting the threshold to zero makes every indebted position unhealthy. The attacker can immediately liquidate otherwise healthy borrowers and receive their collateral with the configured 5% bonus. Borrowers lose the bonus, are forcibly closed, and may incur market/slippage or tax consequences. Other extreme values can disable liquidation or cause arithmetic reverts.
+
+**Fix:** Add `onlyOwner`; enforce a governance-approved range (at minimum `bps <= BPS`, with a sensible nonzero floor); accrue interest before changing risk parameters; and timelock parameter changes so users can react.
+
+### H-01 — Oracle accepts stale/invalid data and ignores Arbitrum sequencer outages
+
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle uses `latestAnswer()` and validates neither sign nor freshness. It also performs no Arbitrum sequencer-uptime check or post-recovery grace period. A zero debt-asset answer makes debt appear valueless and permits borrowing against a false health calculation; a stale/high collateral answer permits excess borrowing; a stale/low collateral answer enables wrongful liquidation. A negative answer is cast to `uint256` and generally causes an arithmetic revert, freezing price-dependent operations. Feed decimals above 18 also revert.
+
+On Arbitrum, stale L1-derived prices around a sequencer outage can therefore be used to drain USDC or collect liquidation bonuses from users who cannot transact normally.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= token-specific heartbeat`. Integrate Chainlink's Arbitrum sequencer-uptime feed and enforce a recovery grace period. Normalize both feed-decimal directions safely, and add optional deviation/circuit-breaker checks.
+
+### H-02 — Health-factor division truncates before multiplication
+
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression first evaluates `collateralValueUsd / debtUsd`, discarding the fractional collateral ratio. With the configured 80% threshold, a position at 150% collateralization should have a 1.2 health factor, but the contract computes `1 * 0.8 = 0.8`. It is liquidatable until collateral reaches 200% of debt. An unlucky borrower can lose 5% of the repaid debt as liquidation bonus despite being safely above the documented 125% minimum; liquidators receive that value.
+
+**Fix:** Multiply before dividing, using full-precision `mulDiv` where appropriate: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Define rounding direction explicitly and add boundary tests immediately below, at, and above 125%.
+
+### H-03 — Borrow signatures have no nonce or expiry and can be replayed
+
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount. There is no nonce, deadline, or consumed-digest mapping. Anyone who sees one valid signature can submit it repeatedly. A borrower can also deliberately reuse a one-time authorization to draw the same amount multiple times, up to the health constraint. A third party does not receive the proceeds, but can force repeated debt and interest onto the signer and exhaust market liquidity by sending USDC to that signer.
+
+**Fix:** Include and verify a per-borrower nonce and deadline in the EIP-712 struct, increment the nonce before borrowing, reject expired signatures, and enforce canonical ECDSA signatures (or use a vetted ECDSA library). Consider EIP-1271 if contract wallets are supported.
+
+### M-01 — Vault accounts nominal transfers and is incompatible with rebasing/fee tokens
+
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+Deposits credit the requested amount rather than the vault's actual balance increase, and all ERC-20 return values are ignored. Fee-on-transfer collateral can therefore create claims larger than vault assets. Negative rebases make recorded balances unbacked; positive rebases are stranded and not credited. A token that returns `false` without reverting can create collateral or repayment accounting without moving assets, or record debt without delivering USDC. This is especially relevant to the README's planned yield-bearing/rebasing collateral path.
+
+An attacker using an incorrectly listed token can borrow against collateral the vault never received; later withdrawers or liquidators bear the shortfall. With current canonical USDC and wstETH this is primarily an integration risk, but the planned listings make it concrete.
+
+**Fix:** Use safe-transfer wrappers and compute deposits from pre/post balance deltas. Explicitly reject fee-on-transfer and rebasing tokens unless implementing share-based vault accounting. Maintain per-token asset/share conversion and solvency invariants for any yield-bearing listing. Apply checks-effects-interactions and reentrancy protection around token calls.
+
+### M-02 — Full-position liquidation can become economically impossible, leaving bad debt
+
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket.liquidateAll`, `LendingMarket._liquidate`
+
+A liquidator must repay the borrower's entire debt. The function then seizes only the collateral that exists, but still zeros all debt. If collateral value is below the debt (or below debt plus bonus), the caller loses the difference, so rational liquidators will not call. Large or rapidly falling positions can remain as bad debt while treasury USDC is unrecoverable. An unlucky caller who does liquidate absorbs the shortfall personally.
+
+**Fix:** Support partial liquidation with a close factor, cap repayment by collateral value and bonus, and define explicit bad-debt accounting/reserve handling. Let liquidators specify maximum repay/minimum collateral out and revert if the realized seizure is insufficient.
+
+### M-03 — Debt-share rounding causes free micro-borrows and repayment dust
+
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Borrowing converts assets to principal with floor division. Once `borrowIndex > 1e18`, sufficiently small amounts create zero principal while still transferring USDC; repeated calls can extract micro-units without debt (economically bounded by transaction costs today, but still an invariant failure). Repayment also rounds the principal reduction down, so paying the reported full debt can leave residual principal, while other rounding paths make paid assets and extinguished debt diverge.
+
+**Fix:** Represent debt as shares and use direction-aware full-precision math: round debt shares up when borrowing and cap/round carefully when repaying. For full repayment, clear all remaining shares. Reject zero-share borrows and add fuzz invariants tying total transferred assets to debt-share changes.
+
+### L-01 — Borrower list grows forever and accumulates duplicates
+
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to debt appends the user, but repayment/liquidation never removes or marks the entry. A user can repeatedly borrow and repay to create duplicates. `liquidateAll` eventually exceeds the block gas limit and becomes unusable, so the advertised keeper sweep fails after enough normal use or deliberate spam. Individual liquidation remains available, limiting severity.
+
+**Fix:** Do not iterate over all borrowers on-chain. Have keepers submit bounded batches, or maintain an enumerable set with removal and strict pagination. Prevent duplicate active entries.
+
+### L-02 — Interest uses a fixed seconds-per-block estimate instead of elapsed time
+
+**Contract / function:** `LendingMarket.accrueInterest`
+
+Interest time is inferred as `blocksElapsed * 12`. Block production and Arbitrum's exposed block-number semantics are not a reliable clock for exact elapsed seconds. Extended gaps or cadence differences under- or over-charge every borrower and misstate treasury interest. The discrepancy accrues to borrowers or the treasury rather than a direct attacker.
+
+**Fix:** Store `lastAccrualTimestamp` and use `block.timestamp - lastAccrualTimestamp`, with explicit maximum-rate and overflow bounds. Document the compounding model and test long inactivity periods.
+
+### I-01 — Initialization is safe only if performed atomically with proxy deployment
+
+**Contract / function:** `LendingMarket.initialize`; `MarketProxy.constructor`
+
+`initialize` is public and first-caller-wins. If the proxy is deployed with empty `initData`, an attacker can initialize it first, become owner, and choose the oracle, vault, and debt token. Combined with the current unrestricted upgrade this is already subsumed by C-01, but it remains a deployment hazard after access control is repaired.
+
+**Fix:** Always ABI-encode `initialize` into the proxy constructor so deployment and initialization are atomic. Disable initializers in the implementation constructor, validate all initialization addresses and `owner_ != address(0)`, and add a deployment test proving the proxy cannot be reinitialized.
+
+## Additional deployment notes
+
+- The README configures wstETH with a **stETH/USD** feed. wstETH is a non-rebasing wrapper whose unit value differs from one stETH; a production oracle must compose the stETH/USD price with the wrapper's current stETH-per-wstETH conversion (or use an appropriate wstETH feed). Using stETH/USD directly undervalues wstETH and can cause reduced borrowing capacity or premature liquidation. Treat this as a launch configuration blocker even though it is not a defect in a single function.
+- `liquidationBonus` has no setter in this implementation despite being described as a risk parameter. Decide whether immutability is intentional before deployment.
+- There is no pause mechanism, borrow cap, collateral cap, oracle-change delay, ownership acceptance flow, or treasury withdrawal/recovery path. These omissions magnify failures during launch and should be addressed in the operational design.
+
+## Recommended remediation order
+
+1. Fix C-01 through C-03 and deploy/administer the proxy through a multisig plus timelock.
+2. Replace the oracle path, including the Arbitrum sequencer check and correct wstETH conversion.
+3. Correct health-factor math and signature replay, then redesign liquidation/debt rounding.
+4. Define supported-token invariants before listing anything beyond wstETH; do not list rebasing or fee-bearing assets with the current vault.
+5. Add unit, fuzz, invariant, fork, upgrade, and adversarial-token tests, then obtain a focused re-review before funding the contract.
+
+## Build status and limitations
+
+The contracts compile successfully with `forge build`. The repository contains no tests, deployment scripts, governance contracts, or live configuration, so this review could not validate deployment atomicity, configured feed heartbeats, role custody, fork behavior, or operational controls. Findings are based on the complete code supplied in this directory and should not be interpreted as proof that no other defects exist.

codex
Completed [AUDIT-REPORT.md](/tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001/AUDIT-REPORT.md).

It contains 12 ranked findings, including three critical access-control vulnerabilities. `src/` is unchanged, and `AUDIT-REPORT.md` is the only file added.
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..6c2c0dea8191e0287cef739dbbd9fb09f5f0ce0b
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,145 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-04  
+**Scope:** `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Deployment reviewed:** Arbitrum One; USDC debt; wstETH collateral; stETH/USD and USDC/USD feeds identified in `README.md`  
+**Method:** Manual source review and compilation with Solidity 0.8.28. No tests were present.
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Three permission omissions let any address take over the market, replace its oracle, or force all borrowers into liquidation. Any one is launch-blocking. The price path also lacks the validations required for safe Chainlink use on an L2, signed borrow approvals can be replayed, and health-factor arithmetic liquidates positions well above the documented threshold.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | C-01 | Critical | Anyone can upgrade the proxy and take all market authority/assets |
+| 2 | C-02 | Critical | Anyone can replace the oracle and drain USDC or liquidate borrowers |
+| 3 | C-03 | Critical | Anyone can change the liquidation threshold and liquidate every borrower |
+| 4 | H-01 | High | Oracle accepts stale/invalid data and ignores Arbitrum sequencer outages |
+| 5 | H-02 | High | Health-factor division truncates before multiplication |
+| 6 | H-03 | High | Borrow signatures have no nonce or expiry and can be replayed |
+| 7 | M-01 | Medium | Vault accounts nominal transfers and is incompatible with rebasing/fee tokens |
+| 8 | M-02 | Medium | Full-position liquidation can become economically impossible, leaving bad debt |
+| 9 | M-03 | Medium | Debt-share rounding causes free micro-borrows and repayment dust |
+| 10 | L-01 | Low | Borrower list grows forever and accumulates duplicates |
+| 11 | L-02 | Low | Interest uses a fixed seconds-per-block estimate instead of elapsed time |
+| 12 | I-01 | Informational | Initialization is safe only if performed atomically with proxy deployment |
+
+## Findings
+
+### C-01 — Anyone can upgrade the proxy and take all market authority/assets
+
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no `onlyOwner` check. Because calls arrive through `MarketProxy`, any account can write an arbitrary address into the proxy's ERC-1967 implementation slot. An attacker can install an implementation that transfers the market's seeded USDC, changes all position state, calls the vault as the authorized market, and seizes every user's collateral. The attacker gets the entire USDC treasury and all collateral held by the vault; users can lose everything deposited.
+
+**Fix:** Restrict upgrades to a well-secured owner/timelock, reject implementations with no code, and use a reviewed UUPS or transparent-proxy implementation with the appropriate compatibility checks. Add an upgrade authorization test that calls through the proxy from an unprivileged address.
+
+### C-02 — Anyone can replace the oracle and drain USDC or liquidate borrowers
+
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no access control. An attacker can install a contract returning attacker-chosen prices. Inflating collateral or suppressing the USDC price lets a collateralized attacker borrow the market's USDC on false valuations; depressing collateral prices lets the attacker liquidate healthy users and collect their collateral plus the 5% bonus.
+
+**Fix:** Add `onlyOwner`, validate the new address (including deployed code), and place oracle changes behind a timelock/multisig. Consider a two-step change with sanity bounds and an emergency pause. Test both direct and proxy calls from non-owners.
+
+### C-03 — Anyone can change the liquidation threshold and liquidate every borrower
+
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+The function lacks `onlyOwner` and accepts any value. Setting the threshold to zero makes every indebted position unhealthy. The attacker can immediately liquidate otherwise healthy borrowers and receive their collateral with the configured 5% bonus. Borrowers lose the bonus, are forcibly closed, and may incur market/slippage or tax consequences. Other extreme values can disable liquidation or cause arithmetic reverts.
+
+**Fix:** Add `onlyOwner`; enforce a governance-approved range (at minimum `bps <= BPS`, with a sensible nonzero floor); accrue interest before changing risk parameters; and timelock parameter changes so users can react.
+
+### H-01 — Oracle accepts stale/invalid data and ignores Arbitrum sequencer outages
+
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle uses `latestAnswer()` and validates neither sign nor freshness. It also performs no Arbitrum sequencer-uptime check or post-recovery grace period. A zero debt-asset answer makes debt appear valueless and permits borrowing against a false health calculation; a stale/high collateral answer permits excess borrowing; a stale/low collateral answer enables wrongful liquidation. A negative answer is cast to `uint256` and generally causes an arithmetic revert, freezing price-dependent operations. Feed decimals above 18 also revert.
+
+On Arbitrum, stale L1-derived prices around a sequencer outage can therefore be used to drain USDC or collect liquidation bonuses from users who cannot transact normally.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= token-specific heartbeat`. Integrate Chainlink's Arbitrum sequencer-uptime feed and enforce a recovery grace period. Normalize both feed-decimal directions safely, and add optional deviation/circuit-breaker checks.
+
+### H-02 — Health-factor division truncates before multiplication
+
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression first evaluates `collateralValueUsd / debtUsd`, discarding the fractional collateral ratio. With the configured 80% threshold, a position at 150% collateralization should have a 1.2 health factor, but the contract computes `1 * 0.8 = 0.8`. It is liquidatable until collateral reaches 200% of debt. An unlucky borrower can lose 5% of the repaid debt as liquidation bonus despite being safely above the documented 125% minimum; liquidators receive that value.
+
+**Fix:** Multiply before dividing, using full-precision `mulDiv` where appropriate: conceptually `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Define rounding direction explicitly and add boundary tests immediately below, at, and above 125%.
+
+### H-03 — Borrow signatures have no nonce or expiry and can be replayed
+
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount. There is no nonce, deadline, or consumed-digest mapping. Anyone who sees one valid signature can submit it repeatedly. A borrower can also deliberately reuse a one-time authorization to draw the same amount multiple times, up to the health constraint. A third party does not receive the proceeds, but can force repeated debt and interest onto the signer and exhaust market liquidity by sending USDC to that signer.
+
+**Fix:** Include and verify a per-borrower nonce and deadline in the EIP-712 struct, increment the nonce before borrowing, reject expired signatures, and enforce canonical ECDSA signatures (or use a vetted ECDSA library). Consider EIP-1271 if contract wallets are supported.
+
+### M-01 — Vault accounts nominal transfers and is incompatible with rebasing/fee tokens
+
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+Deposits credit the requested amount rather than the vault's actual balance increase, and all ERC-20 return values are ignored. Fee-on-transfer collateral can therefore create claims larger than vault assets. Negative rebases make recorded balances unbacked; positive rebases are stranded and not credited. A token that returns `false` without reverting can create collateral or repayment accounting without moving assets, or record debt without delivering USDC. This is especially relevant to the README's planned yield-bearing/rebasing collateral path.
+
+An attacker using an incorrectly listed token can borrow against collateral the vault never received; later withdrawers or liquidators bear the shortfall. With current canonical USDC and wstETH this is primarily an integration risk, but the planned listings make it concrete.
+
+**Fix:** Use safe-transfer wrappers and compute deposits from pre/post balance deltas. Explicitly reject fee-on-transfer and rebasing tokens unless implementing share-based vault accounting. Maintain per-token asset/share conversion and solvency invariants for any yield-bearing listing. Apply checks-effects-interactions and reentrancy protection around token calls.
+
+### M-02 — Full-position liquidation can become economically impossible, leaving bad debt
+
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket.liquidateAll`, `LendingMarket._liquidate`
+
+A liquidator must repay the borrower's entire debt. The function then seizes only the collateral that exists, but still zeros all debt. If collateral value is below the debt (or below debt plus bonus), the caller loses the difference, so rational liquidators will not call. Large or rapidly falling positions can remain as bad debt while treasury USDC is unrecoverable. An unlucky caller who does liquidate absorbs the shortfall personally.
+
+**Fix:** Support partial liquidation with a close factor, cap repayment by collateral value and bonus, and define explicit bad-debt accounting/reserve handling. Let liquidators specify maximum repay/minimum collateral out and revert if the realized seizure is insufficient.
+
+### M-03 — Debt-share rounding causes free micro-borrows and repayment dust
+
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Borrowing converts assets to principal with floor division. Once `borrowIndex > 1e18`, sufficiently small amounts create zero principal while still transferring USDC; repeated calls can extract micro-units without debt (economically bounded by transaction costs today, but still an invariant failure). Repayment also rounds the principal reduction down, so paying the reported full debt can leave residual principal, while other rounding paths make paid assets and extinguished debt diverge.
+
+**Fix:** Represent debt as shares and use direction-aware full-precision math: round debt shares up when borrowing and cap/round carefully when repaying. For full repayment, clear all remaining shares. Reject zero-share borrows and add fuzz invariants tying total transferred assets to debt-share changes.
+
+### L-01 — Borrower list grows forever and accumulates duplicates
+
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to debt appends the user, but repayment/liquidation never removes or marks the entry. A user can repeatedly borrow and repay to create duplicates. `liquidateAll` eventually exceeds the block gas limit and becomes unusable, so the advertised keeper sweep fails after enough normal use or deliberate spam. Individual liquidation remains available, limiting severity.
+
+**Fix:** Do not iterate over all borrowers on-chain. Have keepers submit bounded batches, or maintain an enumerable set with removal and strict pagination. Prevent duplicate active entries.
+
+### L-02 — Interest uses a fixed seconds-per-block estimate instead of elapsed time
+
+**Contract / function:** `LendingMarket.accrueInterest`
+
+Interest time is inferred as `blocksElapsed * 12`. Block production and Arbitrum's exposed block-number semantics are not a reliable clock for exact elapsed seconds. Extended gaps or cadence differences under- or over-charge every borrower and misstate treasury interest. The discrepancy accrues to borrowers or the treasury rather than a direct attacker.
+
+**Fix:** Store `lastAccrualTimestamp` and use `block.timestamp - lastAccrualTimestamp`, with explicit maximum-rate and overflow bounds. Document the compounding model and test long inactivity periods.
+
+### I-01 — Initialization is safe only if performed atomically with proxy deployment
+
+**Contract / function:** `LendingMarket.initialize`; `MarketProxy.constructor`
+
+`initialize` is public and first-caller-wins. If the proxy is deployed with empty `initData`, an attacker can initialize it first, become owner, and choose the oracle, vault, and debt token. Combined with the current unrestricted upgrade this is already subsumed by C-01, but it remains a deployment hazard after access control is repaired.
+
+**Fix:** Always ABI-encode `initialize` into the proxy constructor so deployment and initialization are atomic. Disable initializers in the implementation constructor, validate all initialization addresses and `owner_ != address(0)`, and add a deployment test proving the proxy cannot be reinitialized.
+
+## Additional deployment notes
+
+- The README configures wstETH with a **stETH/USD** feed. wstETH is a non-rebasing wrapper whose unit value differs from one stETH; a production oracle must compose the stETH/USD price with the wrapper's current stETH-per-wstETH conversion (or use an appropriate wstETH feed). Using stETH/USD directly undervalues wstETH and can cause reduced borrowing capacity or premature liquidation. Treat this as a launch configuration blocker even though it is not a defect in a single function.
+- `liquidationBonus` has no setter in this implementation despite being described as a risk parameter. Decide whether immutability is intentional before deployment.
+- There is no pause mechanism, borrow cap, collateral cap, oracle-change delay, ownership acceptance flow, or treasury withdrawal/recovery path. These omissions magnify failures during launch and should be addressed in the operational design.
+
+## Recommended remediation order
+
+1. Fix C-01 through C-03 and deploy/administer the proxy through a multisig plus timelock.
+2. Replace the oracle path, including the Arbitrum sequencer check and correct wstETH conversion.
+3. Correct health-factor math and signature replay, then redesign liquidation/debt rounding.
+4. Define supported-token invariants before listing anything beyond wstETH; do not list rebasing or fee-bearing assets with the current vault.
+5. Add unit, fuzz, invariant, fork, upgrade, and adversarial-token tests, then obtain a focused re-review before funding the contract.
+
+## Build status and limitations
+
+The contracts compile successfully with `forge build`. The repository contains no tests, deployment scripts, governance contracts, or live configuration, so this review could not validate deployment atomicity, configured feed heartbeats, role custody, fork behavior, or operational controls. Findings are based on the complete code supplied in this directory and should not be interpreted as proof that no other defects exist.

tokens used
28,350
```

## final message

Completed [AUDIT-REPORT.md](/tmp/ethskills-audit-eval/2026-09-04T155048Z-codex-no-skill-3/audit-goal-001/AUDIT-REPORT.md).

It contains 12 ranked findings, including three critical access-control vulnerabilities. `src/` is unchanged, and `AUDIT-REPORT.md` is the only file added.

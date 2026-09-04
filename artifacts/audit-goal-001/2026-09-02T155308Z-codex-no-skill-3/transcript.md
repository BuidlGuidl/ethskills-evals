# Executor transcript — 2026-09-02T155308Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a062d2-ff07-79b0-84fa-53d04fa98222
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

2026-09-02T15:53:10.382572Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a062d2-ff07-79b0-84fa-53d04fa98222.tmp-1788364390165468746: line 2547: syntax error near unexpected token `('

codex
I’ll trace the documented deployment assumptions into the contracts, test the highest-risk lending paths, and produce only `AUDIT-REPORT.md`. I’ll keep `src/` untouched and verify the final workspace diff.
exec
/bin/bash -lc "pwd && rg --files -g 'README.md' -g 'src/**' -g 'test/**' -g 'foundry.toml' -g 'hardhat.config.*' -g 'package.json' -g 'remappings.txt' -g 'AGENTS.md' | sort && git status --short" in /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001
 succeeded in 3ms:
exec
/bin/bash -lc "sed -n '1,240p' README.md && for f in src/*.sol src/interfaces/*.sol foundry.toml package.json; do echo \"===== "'$f"; sed -n '"'1,320p' \""'$f"; done' in /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001
 succeeded in 12ms:
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
===== src/interfaces/IAggregatorV3.sol
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
===== src/interfaces/IERC20.sol
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
===== src/interfaces/ILendingMarket.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ILendingMarket {
    function requireHealthy(address user) external view;
}
===== foundry.toml
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
===== package.json
{
  "name": "eval-workspace",
  "private": true
}

codex
The first pass found launch-blocking authorization and solvency issues, plus an Arbitrum-specific oracle risk. I’m now separating exploitable launch findings from hazards that only become reachable when the planned collateral set expands, so the ranking reflects Monday’s priorities.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001
 succeeded in 268ms:
Compiling 7 files with Solc 0.8.28
Solc 0.8.28 finished in 217.51ms
Compiler run successful!
2026-09-02T15:54:35.197680Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> src/CollateralVault.sol:9:30
  |
9 |     address public immutable market;
  |                              ^^^^^^ help: consider using: `MARKET`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

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

warning[divide-before-multiply]: multiplication should occur before division to avoid loss of precision
   --> src/LendingMarket.sol:150:16
    |
150 |         return (collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS;
    |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#divide-before-multiply

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


2026-09-02T15:55:30.461265Z  WARN codex_core::responses_retry: stream disconnected - retrying sampling request (1/5 in 190ms)... turn_id=01a062d2-ff93-7b83-9842-9be690f7c6db retries=1 max_retries=5 sampling_error=stream disconnected before completion: An error occurred while processing your request. You can retry your request, or contact us through our help center at help.openai.com if the error persists. Please include the request ID d9fb42a5-39d3-4e37-9633-32f95fe82478 in your message.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001/AUDIT-REPORT.md
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..a176a5107fe99c819043f3c86b6fb04612341da7
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,152 @@
+# ArbiLend Security Review
+
+Date: 2026-09-02  
+Scope: `README.md` and all Solidity files under `src/`  
+Target: Arbitrum One, wstETH collateral, native USDC debt asset
+
+## Executive summary
+
+ArbiLend is **not safe to deploy in its current form**. Two unauthenticated administrative paths let any account take all seeded USDC or replace the market implementation. The health-factor calculation also changes the intended 80% liquidation threshold into a discontinuous effective threshold near 50%, allowing positions to become liquidatable immediately after a very small amount of interest accrues. These are release blockers.
+
+The review found 3 critical, 4 high, 4 medium, and 2 low-severity issues. The team should address findings AL-01 through AL-07 before deployment, then add tests covering every exploit and boundary described below. This was a manual source review supplemented by a successful `forge build`; no test suite was present.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | AL-01 | Critical | Anyone can replace the proxy implementation |
+| 2 | AL-02 | Critical | Anyone can replace the oracle and drain seeded USDC |
+| 3 | AL-03 | Critical | Anyone can raise the liquidation threshold and drain seeded USDC |
+| 4 | AL-04 | High | Divide-before-multiply makes the effective maximum LTV approximately 50% |
+| 5 | AL-05 | High | Oracle accepts stale prices and ignores the Arbitrum sequencer status |
+| 6 | AL-06 | High | Deeply underwater accounts are economically impossible to liquidate |
+| 7 | AL-07 | High | A proxy deployed without atomic initialization can be taken over |
+| 8 | AL-08 | Medium | Borrow signatures can be replayed indefinitely |
+| 9 | AL-09 | Medium | The configured stETH/USD feed is not a wstETH/USD price |
+| 10 | AL-10 | Medium | Vault accounting trusts nominal transfers and is incompatible with planned token types |
+| 11 | AL-11 | Medium | External token calls make withdrawals reentrant for future callback-capable collateral |
+| 12 | AL-12 | Low | Full repayment can leave irreducible debt dust |
+| 13 | AL-13 | Low | The borrower registry can be grown until batch liquidation no longer fits in a block |
+
+## Findings
+
+### AL-01 — Anyone can replace the proxy implementation
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no access control and writes directly to the ERC-1967 implementation slot. Because calls reach it through `MarketProxy`, any account can point the live proxy at attacker-controlled code. That code can transfer all USDC held by the proxy, manipulate or erase every debt position, and use the market's authority over `CollateralVault` to seize every user's collateral. The attacker gets all protocol liquidity and all deposited collateral; users and the treasury can lose everything.
+
+**Fix:** Restrict upgrades to a timelocked governance/admin authority, use a reviewed UUPS implementation (including `onlyProxy`, implementation compatibility checks, and `_authorizeUpgrade`), and reject zero/non-contract implementations. Test that direct calls, non-admin proxy calls, and incompatible implementations revert. Consider a multisig plus timelock for production upgrades.
+
+### AL-02 — Anyone can replace the oracle and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no `onlyOwner` modifier. An attacker can deploy an oracle-shaped contract that reports an arbitrarily high wstETH price and/or an arbitrarily low USDC price, set it as the market oracle, deposit a negligible amount of wstETH, and borrow the proxy's entire seeded USDC balance. The attacker gets the treasury's USDC while leaving debt backed by almost no real collateral. Existing positions can also be forced into liquidation with attacker-selected prices.
+
+**Fix:** Add `onlyOwner`, reject the zero address and non-contract addresses, and make oracle changes timelocked. Validate the complete proposed feed configuration before activation. A two-step propose/accept process with an emergency pause limits both key compromise and configuration mistakes.
+
+### AL-03 — Anyone can raise the liquidation threshold and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+`setLiquidationThreshold` is also unauthenticated and has no bounds. An attacker can set the threshold to a huge value, deposit a small amount of collateral, and borrow all available USDC while still passing `requireHealthy`. The attacker receives the treasury's USDC and leaves the protocol with bad debt. Independently, setting the threshold to zero makes every debt position unhealthy and exposes users to liquidation.
+
+**Fix:** Add `onlyOwner`, constrain the threshold to a governance-approved safe range no greater than `BPS`, and timelock changes. Apply equivalent explicit bounds to `borrowRate` and other economic parameters so a privileged configuration error cannot overflow accrual or destroy solvency.
+
+### AL-04 — Divide-before-multiply makes the effective maximum LTV approximately 50%
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression `collateralValueUsd(user) / debtUsd` performs integer division before applying the threshold and WAD scale. Every collateral-to-debt ratio from 1.00 up to 1.999... is truncated to `1`, producing a health factor of `0.8e18`; the position only becomes healthy when the ratio reaches `2`. Thus the documented 80% threshold (125% minimum collateral ratio) behaves as an approximately 50% maximum LTV with a large discontinuity.
+
+A user borrowing at 50% LTV can become liquidatable after the first positive interest accrual, despite virtually no price movement. A liquidator gets the 5% bonus and the user unexpectedly loses that collateral. Users between 50% and the advertised 80% LTV cannot borrow at all.
+
+**Fix:** Multiply before dividing, for example `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`, using full-precision `mulDiv` to avoid overflow and define rounding direction deliberately. Add boundary tests immediately below, at, and above 80% LTV and tests after one accrual interval.
+
+### AL-05 — Oracle accepts stale prices and ignores the Arbitrum sequencer status
+
+**Severity:** High  
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle calls `latestAnswer()` and does not inspect round timestamps, round completeness, or answer sign. It also has no Arbitrum sequencer-uptime check or recovery grace period. During an outage, feed disruption, or delayed update, borrowing and liquidation continue against an old price. An attacker can borrow excess USDC when collateral has fallen but the stored answer has not; conversely, liquidators can seize users after the true price has recovered. The attacker or liquidator gets USDC or discounted collateral, while the treasury or borrower takes the loss. A negative answer is cast to a huge unsigned integer rather than rejected (and will commonly cause downstream overflow/reverts), creating additional denial-of-service behavior.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. On Arbitrum, check Chainlink's sequencer-uptime feed, reject while the sequencer is down, and enforce a grace period after it returns. Pause new borrowing when price validity cannot be established; choose and document the desired liquidation behavior during oracle failure.
+
+### AL-06 — Deeply underwater accounts are economically impossible to liquidate
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket._liquidate`
+
+Liquidation is all-or-nothing: the caller must transfer the user's entire debt before collateral is seized. If a fast price move makes collateral worth less than the debt, the liquidator pays more USDC than the collateral received and rationally will not call. For example, a position with 100 USDC of debt and 70 USD of collateral requires the liquidator to spend 100 USDC to receive at most 70 USD. The market keeps the bad debt in accounting and the treasury cannot recover the shortfall. `liquidateAll` does not solve the incentive failure.
+
+**Fix:** Implement bounded partial liquidations with a close factor and calculate repayable debt from available collateral after applying the bonus. Cap seizure to the user's balance, define bad-debt recognition/socialization explicitly, and provide an incentive or reserve mechanism for terminal bad debt. Add crash and thin-liquidity scenarios where collateral falls below debt.
+
+### AL-07 — A proxy deployed without atomic initialization can be taken over
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.initialize`, `MarketProxy.constructor`
+
+`initialize` is callable by anyone until the proxy's `initialized` flag is set, while the proxy constructor permits empty `initData`. If deployment is split into “deploy proxy, then initialize,” a searcher can initialize first and become owner. Once AL-01 through AL-03 are fixed, that owner still controls collateral listing, rates, and any owner-gated upgrade/oracle functions added by the fixes. The searcher can configure the market for theft or permanently deny the intended administrator control.
+
+**Fix:** Require non-empty, successful initialization data in the proxy constructor and deploy/initialize atomically. Use a standard initializer pattern, disable initializers in the implementation constructor, validate every initialization address (including nonzero owner and contract addresses), and assert post-deployment state in the deployment script before funding the market.
+
+### AL-08 — Borrow signatures can be replayed indefinitely
+
+**Severity:** Medium  
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount; it has neither a nonce nor a deadline. Anyone who sees one valid signature can submit it repeatedly until the account reaches its borrowing limit or market liquidity runs out. The USDC is sent to the borrower, so the relayer does not directly receive it, but an unwanted repeated loan can move the borrower to the liquidation boundary; after interest or a price move, liquidators receive the bonus and the borrower loses collateral. The borrower has no way to revoke an exposed signature.
+
+**Fix:** Include a per-borrower nonce and deadline in the EIP-712 struct, consume the nonce before external calls, reject expired signatures, and use a strict ECDSA recovery library that rejects malleable signatures and invalid `v`/zero signers. Consider signing a recipient if delegated borrowing is intended to direct funds elsewhere.
+
+### AL-09 — The configured stETH/USD feed is not a wstETH/USD price
+
+**Severity:** Medium  
+**Contract / function:** Deployment configuration; `PriceOracle.getPrice`, `LendingMarket.collateralValueUsd`
+
+The README lists wstETH as the collateral but explicitly configures an stETH/USD feed. One wstETH represents a changing amount of stETH, so treating the stETH price as the price of one wstETH omits the wrapper exchange rate. At current positive staking accrual this understates collateral value: users receive less borrowing capacity and can be liquidated earlier than the documented risk parameters imply, transferring an unnecessary liquidation bonus to liquidators. More generally, using a feed for a different unit can produce unsafe valuation if the conversion moves in the opposite direction.
+
+**Fix:** Price wstETH in matching units: use an appropriate wstETH/USD feed, or combine stETH/USD with the on-chain wstETH-to-stETH conversion using carefully matched decimals and independent freshness checks. Add a deployment assertion that feed descriptions/units match each listed asset and a fork test against the exact Arbitrum addresses.
+
+### AL-10 — Vault accounting trusts nominal transfers and is incompatible with planned token types
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+All ERC-20 return values are ignored, and deposits credit the requested `amount` rather than the balance actually received. A false-returning or fee-on-transfer collateral can therefore create accounting claims without corresponding assets; an attacker can borrow real USDC against the fictitious balance. Rebasing collateral, which the roadmap explicitly contemplates, also makes fixed per-user nominal balances diverge from the vault's actual holdings, allocating gains incorrectly or making withdrawals insolvent. With a false-returning debt token, repayments/liquidations could erase debt without payment, although the launch USDC is not expected to behave that way.
+
+**Fix:** Use safe-transfer wrappers and verify balance deltas for deposits. Define an adapter/share-accounting interface for yield-bearing and rebasing assets rather than listing them through the current raw ERC-20 path. Maintain per-asset invariants tying total user shares to custody balances, and reject fee-on-transfer assets unless the accounting intentionally supports them.
+
+### AL-11 — External token calls make withdrawals reentrant for future callback-capable collateral
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.withdraw`
+
+`withdraw` transfers tokens before reducing the user's recorded balance. A listed token that invokes receiver callbacks can reenter `withdraw` while the old balance is still recorded and withdraw the same collateral repeatedly, draining that token from the vault. The attacker receives other users' custody balance of that token. The announced launch assets are not expected to callback this way, but the unrestricted future listing mechanism makes this a material expansion hazard.
+
+**Fix:** Follow checks-effects-interactions: decrement accounting before transfer, then perform the health check and token transfer (a revert rolls all state back). Add a reentrancy guard around vault entry points and only list assets after behavioral review. Test with an adversarial callback token.
+
+### AL-12 — Full repayment can leave irreducible debt dust
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Debt is rounded down, and repayment subtracts another rounded-down conversion from amount to principal. Paying the displayed full debt can therefore leave one or more principal units. At sufficiently small balances, a user can transfer the displayed debt while `amount * WAD / borrowIndex` rounds to zero, so the payment reduces no principal. The market receives extra USDC while the user retains debt dust, may need repeated repayments, and may be unable to cleanly close accounting.
+
+**Fix:** If `amount == debtOf(user)`, set principal to zero explicitly. Otherwise use a documented rounding policy that makes debt reduction consistent with amount paid, and test minimum-unit USDC debt across a range of borrow-index values.
+
+### AL-13 — The borrower registry can be grown until batch liquidation no longer fits in a block
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to a new loan appends the address to `borrowers`, but entries are never removed or deduplicated permanently. A user can cycle borrow/repay (or use many addresses) to grow the array. `liquidateAll` eventually exceeds the block gas limit, so the keeper loses the advertised batch sweep after a large price move. Individual `liquidate` calls remain available, limiting the direct loss, but delayed liquidations increase bad-debt risk.
+
+**Fix:** Do not iterate over an unbounded on-chain borrower set. Use off-chain indexing plus individual/bounded-batch liquidation, or accept a caller-supplied list with a strict maximum. If a registry is retained, track membership and remove closed positions without creating duplicate historical entries.
+
+## Deployment recommendation
+
+Do not fund or open the proxy until all critical and high findings are fixed and covered by unit, invariant, fuzz, and Arbitrum-fork tests. In particular, assert upgrade/oracle/parameter authorization, atomic initialization, oracle failure handling, exact 80% health-factor boundaries, liquidation incentives through a severe wstETH drawdown, and conservation of USDC and collateral across every state transition.

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..a176a5107fe99c819043f3c86b6fb04612341da7
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,152 @@
+# ArbiLend Security Review
+
+Date: 2026-09-02  
+Scope: `README.md` and all Solidity files under `src/`  
+Target: Arbitrum One, wstETH collateral, native USDC debt asset
+
+## Executive summary
+
+ArbiLend is **not safe to deploy in its current form**. Two unauthenticated administrative paths let any account take all seeded USDC or replace the market implementation. The health-factor calculation also changes the intended 80% liquidation threshold into a discontinuous effective threshold near 50%, allowing positions to become liquidatable immediately after a very small amount of interest accrues. These are release blockers.
+
+The review found 3 critical, 4 high, 4 medium, and 2 low-severity issues. The team should address findings AL-01 through AL-07 before deployment, then add tests covering every exploit and boundary described below. This was a manual source review supplemented by a successful `forge build`; no test suite was present.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | AL-01 | Critical | Anyone can replace the proxy implementation |
+| 2 | AL-02 | Critical | Anyone can replace the oracle and drain seeded USDC |
+| 3 | AL-03 | Critical | Anyone can raise the liquidation threshold and drain seeded USDC |
+| 4 | AL-04 | High | Divide-before-multiply makes the effective maximum LTV approximately 50% |
+| 5 | AL-05 | High | Oracle accepts stale prices and ignores the Arbitrum sequencer status |
+| 6 | AL-06 | High | Deeply underwater accounts are economically impossible to liquidate |
+| 7 | AL-07 | High | A proxy deployed without atomic initialization can be taken over |
+| 8 | AL-08 | Medium | Borrow signatures can be replayed indefinitely |
+| 9 | AL-09 | Medium | The configured stETH/USD feed is not a wstETH/USD price |
+| 10 | AL-10 | Medium | Vault accounting trusts nominal transfers and is incompatible with planned token types |
+| 11 | AL-11 | Medium | External token calls make withdrawals reentrant for future callback-capable collateral |
+| 12 | AL-12 | Low | Full repayment can leave irreducible debt dust |
+| 13 | AL-13 | Low | The borrower registry can be grown until batch liquidation no longer fits in a block |
+
+## Findings
+
+### AL-01 — Anyone can replace the proxy implementation
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no access control and writes directly to the ERC-1967 implementation slot. Because calls reach it through `MarketProxy`, any account can point the live proxy at attacker-controlled code. That code can transfer all USDC held by the proxy, manipulate or erase every debt position, and use the market's authority over `CollateralVault` to seize every user's collateral. The attacker gets all protocol liquidity and all deposited collateral; users and the treasury can lose everything.
+
+**Fix:** Restrict upgrades to a timelocked governance/admin authority, use a reviewed UUPS implementation (including `onlyProxy`, implementation compatibility checks, and `_authorizeUpgrade`), and reject zero/non-contract implementations. Test that direct calls, non-admin proxy calls, and incompatible implementations revert. Consider a multisig plus timelock for production upgrades.
+
+### AL-02 — Anyone can replace the oracle and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no `onlyOwner` modifier. An attacker can deploy an oracle-shaped contract that reports an arbitrarily high wstETH price and/or an arbitrarily low USDC price, set it as the market oracle, deposit a negligible amount of wstETH, and borrow the proxy's entire seeded USDC balance. The attacker gets the treasury's USDC while leaving debt backed by almost no real collateral. Existing positions can also be forced into liquidation with attacker-selected prices.
+
+**Fix:** Add `onlyOwner`, reject the zero address and non-contract addresses, and make oracle changes timelocked. Validate the complete proposed feed configuration before activation. A two-step propose/accept process with an emergency pause limits both key compromise and configuration mistakes.
+
+### AL-03 — Anyone can raise the liquidation threshold and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+`setLiquidationThreshold` is also unauthenticated and has no bounds. An attacker can set the threshold to a huge value, deposit a small amount of collateral, and borrow all available USDC while still passing `requireHealthy`. The attacker receives the treasury's USDC and leaves the protocol with bad debt. Independently, setting the threshold to zero makes every debt position unhealthy and exposes users to liquidation.
+
+**Fix:** Add `onlyOwner`, constrain the threshold to a governance-approved safe range no greater than `BPS`, and timelock changes. Apply equivalent explicit bounds to `borrowRate` and other economic parameters so a privileged configuration error cannot overflow accrual or destroy solvency.
+
+### AL-04 — Divide-before-multiply makes the effective maximum LTV approximately 50%
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression `collateralValueUsd(user) / debtUsd` performs integer division before applying the threshold and WAD scale. Every collateral-to-debt ratio from 1.00 up to 1.999... is truncated to `1`, producing a health factor of `0.8e18`; the position only becomes healthy when the ratio reaches `2`. Thus the documented 80% threshold (125% minimum collateral ratio) behaves as an approximately 50% maximum LTV with a large discontinuity.
+
+A user borrowing at 50% LTV can become liquidatable after the first positive interest accrual, despite virtually no price movement. A liquidator gets the 5% bonus and the user unexpectedly loses that collateral. Users between 50% and the advertised 80% LTV cannot borrow at all.
+
+**Fix:** Multiply before dividing, for example `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`, using full-precision `mulDiv` to avoid overflow and define rounding direction deliberately. Add boundary tests immediately below, at, and above 80% LTV and tests after one accrual interval.
+
+### AL-05 — Oracle accepts stale prices and ignores the Arbitrum sequencer status
+
+**Severity:** High  
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle calls `latestAnswer()` and does not inspect round timestamps, round completeness, or answer sign. It also has no Arbitrum sequencer-uptime check or recovery grace period. During an outage, feed disruption, or delayed update, borrowing and liquidation continue against an old price. An attacker can borrow excess USDC when collateral has fallen but the stored answer has not; conversely, liquidators can seize users after the true price has recovered. The attacker or liquidator gets USDC or discounted collateral, while the treasury or borrower takes the loss. A negative answer is cast to a huge unsigned integer rather than rejected (and will commonly cause downstream overflow/reverts), creating additional denial-of-service behavior.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. On Arbitrum, check Chainlink's sequencer-uptime feed, reject while the sequencer is down, and enforce a grace period after it returns. Pause new borrowing when price validity cannot be established; choose and document the desired liquidation behavior during oracle failure.
+
+### AL-06 — Deeply underwater accounts are economically impossible to liquidate
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket._liquidate`
+
+Liquidation is all-or-nothing: the caller must transfer the user's entire debt before collateral is seized. If a fast price move makes collateral worth less than the debt, the liquidator pays more USDC than the collateral received and rationally will not call. For example, a position with 100 USDC of debt and 70 USD of collateral requires the liquidator to spend 100 USDC to receive at most 70 USD. The market keeps the bad debt in accounting and the treasury cannot recover the shortfall. `liquidateAll` does not solve the incentive failure.
+
+**Fix:** Implement bounded partial liquidations with a close factor and calculate repayable debt from available collateral after applying the bonus. Cap seizure to the user's balance, define bad-debt recognition/socialization explicitly, and provide an incentive or reserve mechanism for terminal bad debt. Add crash and thin-liquidity scenarios where collateral falls below debt.
+
+### AL-07 — A proxy deployed without atomic initialization can be taken over
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.initialize`, `MarketProxy.constructor`
+
+`initialize` is callable by anyone until the proxy's `initialized` flag is set, while the proxy constructor permits empty `initData`. If deployment is split into “deploy proxy, then initialize,” a searcher can initialize first and become owner. Once AL-01 through AL-03 are fixed, that owner still controls collateral listing, rates, and any owner-gated upgrade/oracle functions added by the fixes. The searcher can configure the market for theft or permanently deny the intended administrator control.
+
+**Fix:** Require non-empty, successful initialization data in the proxy constructor and deploy/initialize atomically. Use a standard initializer pattern, disable initializers in the implementation constructor, validate every initialization address (including nonzero owner and contract addresses), and assert post-deployment state in the deployment script before funding the market.
+
+### AL-08 — Borrow signatures can be replayed indefinitely
+
+**Severity:** Medium  
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount; it has neither a nonce nor a deadline. Anyone who sees one valid signature can submit it repeatedly until the account reaches its borrowing limit or market liquidity runs out. The USDC is sent to the borrower, so the relayer does not directly receive it, but an unwanted repeated loan can move the borrower to the liquidation boundary; after interest or a price move, liquidators receive the bonus and the borrower loses collateral. The borrower has no way to revoke an exposed signature.
+
+**Fix:** Include a per-borrower nonce and deadline in the EIP-712 struct, consume the nonce before external calls, reject expired signatures, and use a strict ECDSA recovery library that rejects malleable signatures and invalid `v`/zero signers. Consider signing a recipient if delegated borrowing is intended to direct funds elsewhere.
+
+### AL-09 — The configured stETH/USD feed is not a wstETH/USD price
+
+**Severity:** Medium  
+**Contract / function:** Deployment configuration; `PriceOracle.getPrice`, `LendingMarket.collateralValueUsd`
+
+The README lists wstETH as the collateral but explicitly configures an stETH/USD feed. One wstETH represents a changing amount of stETH, so treating the stETH price as the price of one wstETH omits the wrapper exchange rate. At current positive staking accrual this understates collateral value: users receive less borrowing capacity and can be liquidated earlier than the documented risk parameters imply, transferring an unnecessary liquidation bonus to liquidators. More generally, using a feed for a different unit can produce unsafe valuation if the conversion moves in the opposite direction.
+
+**Fix:** Price wstETH in matching units: use an appropriate wstETH/USD feed, or combine stETH/USD with the on-chain wstETH-to-stETH conversion using carefully matched decimals and independent freshness checks. Add a deployment assertion that feed descriptions/units match each listed asset and a fork test against the exact Arbitrum addresses.
+
+### AL-10 — Vault accounting trusts nominal transfers and is incompatible with planned token types
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+All ERC-20 return values are ignored, and deposits credit the requested `amount` rather than the balance actually received. A false-returning or fee-on-transfer collateral can therefore create accounting claims without corresponding assets; an attacker can borrow real USDC against the fictitious balance. Rebasing collateral, which the roadmap explicitly contemplates, also makes fixed per-user nominal balances diverge from the vault's actual holdings, allocating gains incorrectly or making withdrawals insolvent. With a false-returning debt token, repayments/liquidations could erase debt without payment, although the launch USDC is not expected to behave that way.
+
+**Fix:** Use safe-transfer wrappers and verify balance deltas for deposits. Define an adapter/share-accounting interface for yield-bearing and rebasing assets rather than listing them through the current raw ERC-20 path. Maintain per-asset invariants tying total user shares to custody balances, and reject fee-on-transfer assets unless the accounting intentionally supports them.
+
+### AL-11 — External token calls make withdrawals reentrant for future callback-capable collateral
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.withdraw`
+
+`withdraw` transfers tokens before reducing the user's recorded balance. A listed token that invokes receiver callbacks can reenter `withdraw` while the old balance is still recorded and withdraw the same collateral repeatedly, draining that token from the vault. The attacker receives other users' custody balance of that token. The announced launch assets are not expected to callback this way, but the unrestricted future listing mechanism makes this a material expansion hazard.
+
+**Fix:** Follow checks-effects-interactions: decrement accounting before transfer, then perform the health check and token transfer (a revert rolls all state back). Add a reentrancy guard around vault entry points and only list assets after behavioral review. Test with an adversarial callback token.
+
+### AL-12 — Full repayment can leave irreducible debt dust
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Debt is rounded down, and repayment subtracts another rounded-down conversion from amount to principal. Paying the displayed full debt can therefore leave one or more principal units. At sufficiently small balances, a user can transfer the displayed debt while `amount * WAD / borrowIndex` rounds to zero, so the payment reduces no principal. The market receives extra USDC while the user retains debt dust, may need repeated repayments, and may be unable to cleanly close accounting.
+
+**Fix:** If `amount == debtOf(user)`, set principal to zero explicitly. Otherwise use a documented rounding policy that makes debt reduction consistent with amount paid, and test minimum-unit USDC debt across a range of borrow-index values.
+
+### AL-13 — The borrower registry can be grown until batch liquidation no longer fits in a block
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to a new loan appends the address to `borrowers`, but entries are never removed or deduplicated permanently. A user can cycle borrow/repay (or use many addresses) to grow the array. `liquidateAll` eventually exceeds the block gas limit, so the keeper loses the advertised batch sweep after a large price move. Individual `liquidate` calls remain available, limiting the direct loss, but delayed liquidations increase bad-debt risk.
+
+**Fix:** Do not iterate over an unbounded on-chain borrower set. Use off-chain indexing plus individual/bounded-batch liquidation, or accept a caller-supplied list with a strict maximum. If a registry is retained, track membership and remove closed positions without creating duplicate historical entries.
+
+## Deployment recommendation
+
+Do not fund or open the proxy until all critical and high findings are fixed and covered by unit, invariant, fuzz, and Arbitrum-fork tests. In particular, assert upgrade/oracle/parameter authorization, atomic initialization, oracle failure handling, exact 80% health-factor boundaries, liquidation incentives through a severe wstETH drawdown, and conservation of USDC and collateral across every state transition.

exec
/bin/bash -lc "git status --short --untracked-files=all && find . -maxdepth 2 -type f | sort && sed -n '1,80p' AUDIT-REPORT.md" in /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001
 succeeded in 9ms:
?? AUDIT-REPORT.md
./.git/COMMIT_EDITMSG
./.git/HEAD
./.git/config
./.git/description
./.git/index
./.gitignore
./AUDIT-REPORT.md
./README.md
./TASK.md
./cache/solidity-files-cache.json
./foundry.toml
./package.json
./src/CollateralVault.sol
./src/LendingMarket.sol
./src/MarketProxy.sol
./src/PriceOracle.sol
# ArbiLend Security Review

Date: 2026-09-02  
Scope: `README.md` and all Solidity files under `src/`  
Target: Arbitrum One, wstETH collateral, native USDC debt asset

## Executive summary

ArbiLend is **not safe to deploy in its current form**. Two unauthenticated administrative paths let any account take all seeded USDC or replace the market implementation. The health-factor calculation also changes the intended 80% liquidation threshold into a discontinuous effective threshold near 50%, allowing positions to become liquidatable immediately after a very small amount of interest accrues. These are release blockers.

The review found 3 critical, 4 high, 4 medium, and 2 low-severity issues. The team should address findings AL-01 through AL-07 before deployment, then add tests covering every exploit and boundary described below. This was a manual source review supplemented by a successful `forge build`; no test suite was present.

| Rank | ID | Severity | Finding |
| ---: | --- | --- | --- |
| 1 | AL-01 | Critical | Anyone can replace the proxy implementation |
| 2 | AL-02 | Critical | Anyone can replace the oracle and drain seeded USDC |
| 3 | AL-03 | Critical | Anyone can raise the liquidation threshold and drain seeded USDC |
| 4 | AL-04 | High | Divide-before-multiply makes the effective maximum LTV approximately 50% |
| 5 | AL-05 | High | Oracle accepts stale prices and ignores the Arbitrum sequencer status |
| 6 | AL-06 | High | Deeply underwater accounts are economically impossible to liquidate |
| 7 | AL-07 | High | A proxy deployed without atomic initialization can be taken over |
| 8 | AL-08 | Medium | Borrow signatures can be replayed indefinitely |
| 9 | AL-09 | Medium | The configured stETH/USD feed is not a wstETH/USD price |
| 10 | AL-10 | Medium | Vault accounting trusts nominal transfers and is incompatible with planned token types |
| 11 | AL-11 | Medium | External token calls make withdrawals reentrant for future callback-capable collateral |
| 12 | AL-12 | Low | Full repayment can leave irreducible debt dust |
| 13 | AL-13 | Low | The borrower registry can be grown until batch liquidation no longer fits in a block |

## Findings

### AL-01 — Anyone can replace the proxy implementation

**Severity:** Critical  
**Contract / function:** `LendingMarket.upgradeTo`

`upgradeTo` has no access control and writes directly to the ERC-1967 implementation slot. Because calls reach it through `MarketProxy`, any account can point the live proxy at attacker-controlled code. That code can transfer all USDC held by the proxy, manipulate or erase every debt position, and use the market's authority over `CollateralVault` to seize every user's collateral. The attacker gets all protocol liquidity and all deposited collateral; users and the treasury can lose everything.

**Fix:** Restrict upgrades to a timelocked governance/admin authority, use a reviewed UUPS implementation (including `onlyProxy`, implementation compatibility checks, and `_authorizeUpgrade`), and reject zero/non-contract implementations. Test that direct calls, non-admin proxy calls, and incompatible implementations revert. Consider a multisig plus timelock for production upgrades.

### AL-02 — Anyone can replace the oracle and drain seeded USDC

**Severity:** Critical  
**Contract / function:** `LendingMarket.setOracle`

`setOracle` has no `onlyOwner` modifier. An attacker can deploy an oracle-shaped contract that reports an arbitrarily high wstETH price and/or an arbitrarily low USDC price, set it as the market oracle, deposit a negligible amount of wstETH, and borrow the proxy's entire seeded USDC balance. The attacker gets the treasury's USDC while leaving debt backed by almost no real collateral. Existing positions can also be forced into liquidation with attacker-selected prices.

**Fix:** Add `onlyOwner`, reject the zero address and non-contract addresses, and make oracle changes timelocked. Validate the complete proposed feed configuration before activation. A two-step propose/accept process with an emergency pause limits both key compromise and configuration mistakes.

### AL-03 — Anyone can raise the liquidation threshold and drain seeded USDC

**Severity:** Critical  
**Contract / function:** `LendingMarket.setLiquidationThreshold`

`setLiquidationThreshold` is also unauthenticated and has no bounds. An attacker can set the threshold to a huge value, deposit a small amount of collateral, and borrow all available USDC while still passing `requireHealthy`. The attacker receives the treasury's USDC and leaves the protocol with bad debt. Independently, setting the threshold to zero makes every debt position unhealthy and exposes users to liquidation.

**Fix:** Add `onlyOwner`, constrain the threshold to a governance-approved safe range no greater than `BPS`, and timelock changes. Apply equivalent explicit bounds to `borrowRate` and other economic parameters so a privileged configuration error cannot overflow accrual or destroy solvency.

### AL-04 — Divide-before-multiply makes the effective maximum LTV approximately 50%

**Severity:** High  
**Contract / function:** `LendingMarket.healthFactor`

The expression `collateralValueUsd(user) / debtUsd` performs integer division before applying the threshold and WAD scale. Every collateral-to-debt ratio from 1.00 up to 1.999... is truncated to `1`, producing a health factor of `0.8e18`; the position only becomes healthy when the ratio reaches `2`. Thus the documented 80% threshold (125% minimum collateral ratio) behaves as an approximately 50% maximum LTV with a large discontinuity.

A user borrowing at 50% LTV can become liquidatable after the first positive interest accrual, despite virtually no price movement. A liquidator gets the 5% bonus and the user unexpectedly loses that collateral. Users between 50% and the advertised 80% LTV cannot borrow at all.

**Fix:** Multiply before dividing, for example `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`, using full-precision `mulDiv` to avoid overflow and define rounding direction deliberately. Add boundary tests immediately below, at, and above 80% LTV and tests after one accrual interval.

### AL-05 — Oracle accepts stale prices and ignores the Arbitrum sequencer status

**Severity:** High  
**Contract / function:** `PriceOracle.getPrice`

The oracle calls `latestAnswer()` and does not inspect round timestamps, round completeness, or answer sign. It also has no Arbitrum sequencer-uptime check or recovery grace period. During an outage, feed disruption, or delayed update, borrowing and liquidation continue against an old price. An attacker can borrow excess USDC when collateral has fallen but the stored answer has not; conversely, liquidators can seize users after the true price has recovered. The attacker or liquidator gets USDC or discounted collateral, while the treasury or borrower takes the loss. A negative answer is cast to a huge unsigned integer rather than rejected (and will commonly cause downstream overflow/reverts), creating additional denial-of-service behavior.

**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. On Arbitrum, check Chainlink's sequencer-uptime feed, reject while the sequencer is down, and enforce a grace period after it returns. Pause new borrowing when price validity cannot be established; choose and document the desired liquidation behavior during oracle failure.

### AL-06 — Deeply underwater accounts are economically impossible to liquidate

**Severity:** High  

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..a176a5107fe99c819043f3c86b6fb04612341da7
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,152 @@
+# ArbiLend Security Review
+
+Date: 2026-09-02  
+Scope: `README.md` and all Solidity files under `src/`  
+Target: Arbitrum One, wstETH collateral, native USDC debt asset
+
+## Executive summary
+
+ArbiLend is **not safe to deploy in its current form**. Two unauthenticated administrative paths let any account take all seeded USDC or replace the market implementation. The health-factor calculation also changes the intended 80% liquidation threshold into a discontinuous effective threshold near 50%, allowing positions to become liquidatable immediately after a very small amount of interest accrues. These are release blockers.
+
+The review found 3 critical, 4 high, 4 medium, and 2 low-severity issues. The team should address findings AL-01 through AL-07 before deployment, then add tests covering every exploit and boundary described below. This was a manual source review supplemented by a successful `forge build`; no test suite was present.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | AL-01 | Critical | Anyone can replace the proxy implementation |
+| 2 | AL-02 | Critical | Anyone can replace the oracle and drain seeded USDC |
+| 3 | AL-03 | Critical | Anyone can raise the liquidation threshold and drain seeded USDC |
+| 4 | AL-04 | High | Divide-before-multiply makes the effective maximum LTV approximately 50% |
+| 5 | AL-05 | High | Oracle accepts stale prices and ignores the Arbitrum sequencer status |
+| 6 | AL-06 | High | Deeply underwater accounts are economically impossible to liquidate |
+| 7 | AL-07 | High | A proxy deployed without atomic initialization can be taken over |
+| 8 | AL-08 | Medium | Borrow signatures can be replayed indefinitely |
+| 9 | AL-09 | Medium | The configured stETH/USD feed is not a wstETH/USD price |
+| 10 | AL-10 | Medium | Vault accounting trusts nominal transfers and is incompatible with planned token types |
+| 11 | AL-11 | Medium | External token calls make withdrawals reentrant for future callback-capable collateral |
+| 12 | AL-12 | Low | Full repayment can leave irreducible debt dust |
+| 13 | AL-13 | Low | The borrower registry can be grown until batch liquidation no longer fits in a block |
+
+## Findings
+
+### AL-01 — Anyone can replace the proxy implementation
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no access control and writes directly to the ERC-1967 implementation slot. Because calls reach it through `MarketProxy`, any account can point the live proxy at attacker-controlled code. That code can transfer all USDC held by the proxy, manipulate or erase every debt position, and use the market's authority over `CollateralVault` to seize every user's collateral. The attacker gets all protocol liquidity and all deposited collateral; users and the treasury can lose everything.
+
+**Fix:** Restrict upgrades to a timelocked governance/admin authority, use a reviewed UUPS implementation (including `onlyProxy`, implementation compatibility checks, and `_authorizeUpgrade`), and reject zero/non-contract implementations. Test that direct calls, non-admin proxy calls, and incompatible implementations revert. Consider a multisig plus timelock for production upgrades.
+
+### AL-02 — Anyone can replace the oracle and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no `onlyOwner` modifier. An attacker can deploy an oracle-shaped contract that reports an arbitrarily high wstETH price and/or an arbitrarily low USDC price, set it as the market oracle, deposit a negligible amount of wstETH, and borrow the proxy's entire seeded USDC balance. The attacker gets the treasury's USDC while leaving debt backed by almost no real collateral. Existing positions can also be forced into liquidation with attacker-selected prices.
+
+**Fix:** Add `onlyOwner`, reject the zero address and non-contract addresses, and make oracle changes timelocked. Validate the complete proposed feed configuration before activation. A two-step propose/accept process with an emergency pause limits both key compromise and configuration mistakes.
+
+### AL-03 — Anyone can raise the liquidation threshold and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+`setLiquidationThreshold` is also unauthenticated and has no bounds. An attacker can set the threshold to a huge value, deposit a small amount of collateral, and borrow all available USDC while still passing `requireHealthy`. The attacker receives the treasury's USDC and leaves the protocol with bad debt. Independently, setting the threshold to zero makes every debt position unhealthy and exposes users to liquidation.
+
+**Fix:** Add `onlyOwner`, constrain the threshold to a governance-approved safe range no greater than `BPS`, and timelock changes. Apply equivalent explicit bounds to `borrowRate` and other economic parameters so a privileged configuration error cannot overflow accrual or destroy solvency.
+
+### AL-04 — Divide-before-multiply makes the effective maximum LTV approximately 50%
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression `collateralValueUsd(user) / debtUsd` performs integer division before applying the threshold and WAD scale. Every collateral-to-debt ratio from 1.00 up to 1.999... is truncated to `1`, producing a health factor of `0.8e18`; the position only becomes healthy when the ratio reaches `2`. Thus the documented 80% threshold (125% minimum collateral ratio) behaves as an approximately 50% maximum LTV with a large discontinuity.
+
+A user borrowing at 50% LTV can become liquidatable after the first positive interest accrual, despite virtually no price movement. A liquidator gets the 5% bonus and the user unexpectedly loses that collateral. Users between 50% and the advertised 80% LTV cannot borrow at all.
+
+**Fix:** Multiply before dividing, for example `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`, using full-precision `mulDiv` to avoid overflow and define rounding direction deliberately. Add boundary tests immediately below, at, and above 80% LTV and tests after one accrual interval.
+
+### AL-05 — Oracle accepts stale prices and ignores the Arbitrum sequencer status
+
+**Severity:** High  
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle calls `latestAnswer()` and does not inspect round timestamps, round completeness, or answer sign. It also has no Arbitrum sequencer-uptime check or recovery grace period. During an outage, feed disruption, or delayed update, borrowing and liquidation continue against an old price. An attacker can borrow excess USDC when collateral has fallen but the stored answer has not; conversely, liquidators can seize users after the true price has recovered. The attacker or liquidator gets USDC or discounted collateral, while the treasury or borrower takes the loss. A negative answer is cast to a huge unsigned integer rather than rejected (and will commonly cause downstream overflow/reverts), creating additional denial-of-service behavior.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. On Arbitrum, check Chainlink's sequencer-uptime feed, reject while the sequencer is down, and enforce a grace period after it returns. Pause new borrowing when price validity cannot be established; choose and document the desired liquidation behavior during oracle failure.
+
+### AL-06 — Deeply underwater accounts are economically impossible to liquidate
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket._liquidate`
+
+Liquidation is all-or-nothing: the caller must transfer the user's entire debt before collateral is seized. If a fast price move makes collateral worth less than the debt, the liquidator pays more USDC than the collateral received and rationally will not call. For example, a position with 100 USDC of debt and 70 USD of collateral requires the liquidator to spend 100 USDC to receive at most 70 USD. The market keeps the bad debt in accounting and the treasury cannot recover the shortfall. `liquidateAll` does not solve the incentive failure.
+
+**Fix:** Implement bounded partial liquidations with a close factor and calculate repayable debt from available collateral after applying the bonus. Cap seizure to the user's balance, define bad-debt recognition/socialization explicitly, and provide an incentive or reserve mechanism for terminal bad debt. Add crash and thin-liquidity scenarios where collateral falls below debt.
+
+### AL-07 — A proxy deployed without atomic initialization can be taken over
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.initialize`, `MarketProxy.constructor`
+
+`initialize` is callable by anyone until the proxy's `initialized` flag is set, while the proxy constructor permits empty `initData`. If deployment is split into “deploy proxy, then initialize,” a searcher can initialize first and become owner. Once AL-01 through AL-03 are fixed, that owner still controls collateral listing, rates, and any owner-gated upgrade/oracle functions added by the fixes. The searcher can configure the market for theft or permanently deny the intended administrator control.
+
+**Fix:** Require non-empty, successful initialization data in the proxy constructor and deploy/initialize atomically. Use a standard initializer pattern, disable initializers in the implementation constructor, validate every initialization address (including nonzero owner and contract addresses), and assert post-deployment state in the deployment script before funding the market.
+
+### AL-08 — Borrow signatures can be replayed indefinitely
+
+**Severity:** Medium  
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount; it has neither a nonce nor a deadline. Anyone who sees one valid signature can submit it repeatedly until the account reaches its borrowing limit or market liquidity runs out. The USDC is sent to the borrower, so the relayer does not directly receive it, but an unwanted repeated loan can move the borrower to the liquidation boundary; after interest or a price move, liquidators receive the bonus and the borrower loses collateral. The borrower has no way to revoke an exposed signature.
+
+**Fix:** Include a per-borrower nonce and deadline in the EIP-712 struct, consume the nonce before external calls, reject expired signatures, and use a strict ECDSA recovery library that rejects malleable signatures and invalid `v`/zero signers. Consider signing a recipient if delegated borrowing is intended to direct funds elsewhere.
+
+### AL-09 — The configured stETH/USD feed is not a wstETH/USD price
+
+**Severity:** Medium  
+**Contract / function:** Deployment configuration; `PriceOracle.getPrice`, `LendingMarket.collateralValueUsd`
+
+The README lists wstETH as the collateral but explicitly configures an stETH/USD feed. One wstETH represents a changing amount of stETH, so treating the stETH price as the price of one wstETH omits the wrapper exchange rate. At current positive staking accrual this understates collateral value: users receive less borrowing capacity and can be liquidated earlier than the documented risk parameters imply, transferring an unnecessary liquidation bonus to liquidators. More generally, using a feed for a different unit can produce unsafe valuation if the conversion moves in the opposite direction.
+
+**Fix:** Price wstETH in matching units: use an appropriate wstETH/USD feed, or combine stETH/USD with the on-chain wstETH-to-stETH conversion using carefully matched decimals and independent freshness checks. Add a deployment assertion that feed descriptions/units match each listed asset and a fork test against the exact Arbitrum addresses.
+
+### AL-10 — Vault accounting trusts nominal transfers and is incompatible with planned token types
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+All ERC-20 return values are ignored, and deposits credit the requested `amount` rather than the balance actually received. A false-returning or fee-on-transfer collateral can therefore create accounting claims without corresponding assets; an attacker can borrow real USDC against the fictitious balance. Rebasing collateral, which the roadmap explicitly contemplates, also makes fixed per-user nominal balances diverge from the vault's actual holdings, allocating gains incorrectly or making withdrawals insolvent. With a false-returning debt token, repayments/liquidations could erase debt without payment, although the launch USDC is not expected to behave that way.
+
+**Fix:** Use safe-transfer wrappers and verify balance deltas for deposits. Define an adapter/share-accounting interface for yield-bearing and rebasing assets rather than listing them through the current raw ERC-20 path. Maintain per-asset invariants tying total user shares to custody balances, and reject fee-on-transfer assets unless the accounting intentionally supports them.
+
+### AL-11 — External token calls make withdrawals reentrant for future callback-capable collateral
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.withdraw`
+
+`withdraw` transfers tokens before reducing the user's recorded balance. A listed token that invokes receiver callbacks can reenter `withdraw` while the old balance is still recorded and withdraw the same collateral repeatedly, draining that token from the vault. The attacker receives other users' custody balance of that token. The announced launch assets are not expected to callback this way, but the unrestricted future listing mechanism makes this a material expansion hazard.
+
+**Fix:** Follow checks-effects-interactions: decrement accounting before transfer, then perform the health check and token transfer (a revert rolls all state back). Add a reentrancy guard around vault entry points and only list assets after behavioral review. Test with an adversarial callback token.
+
+### AL-12 — Full repayment can leave irreducible debt dust
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Debt is rounded down, and repayment subtracts another rounded-down conversion from amount to principal. Paying the displayed full debt can therefore leave one or more principal units. At sufficiently small balances, a user can transfer the displayed debt while `amount * WAD / borrowIndex` rounds to zero, so the payment reduces no principal. The market receives extra USDC while the user retains debt dust, may need repeated repayments, and may be unable to cleanly close accounting.
+
+**Fix:** If `amount == debtOf(user)`, set principal to zero explicitly. Otherwise use a documented rounding policy that makes debt reduction consistent with amount paid, and test minimum-unit USDC debt across a range of borrow-index values.
+
+### AL-13 — The borrower registry can be grown until batch liquidation no longer fits in a block
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to a new loan appends the address to `borrowers`, but entries are never removed or deduplicated permanently. A user can cycle borrow/repay (or use many addresses) to grow the array. `liquidateAll` eventually exceeds the block gas limit, so the keeper loses the advertised batch sweep after a large price move. Individual `liquidate` calls remain available, limiting the direct loss, but delayed liquidations increase bad-debt risk.
+
+**Fix:** Do not iterate over an unbounded on-chain borrower set. Use off-chain indexing plus individual/bounded-batch liquidation, or accept a caller-supplied list with a strict maximum. If a registry is retained, track membership and remove closed positions without creating duplicate historical entries.
+
+## Deployment recommendation
+
+Do not fund or open the proxy until all critical and high findings are fixed and covered by unit, invariant, fuzz, and Arbitrum-fork tests. In particular, assert upgrade/oracle/parameter authorization, atomic initialization, oracle failure handling, exact 80% health-factor boundaries, liquidation incentives through a severe wstETH drawdown, and conservation of USDC and collateral across every state transition.

apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001/AUDIT-REPORT.md
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..53732f6fa81229d09b9e84f6f31bda1a332e228c
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,152 @@
+# ArbiLend Security Review
+
+Date: 2026-09-02  
+Scope: `README.md` and all Solidity files under `src/`  
+Target: Arbitrum One, wstETH collateral, native USDC debt asset
+
+## Executive summary
+
+ArbiLend is **not safe to deploy in its current form**. Two unauthenticated administrative paths let any account take all seeded USDC or replace the market implementation. The health-factor calculation also changes the intended 80% liquidation threshold into a discontinuous effective threshold near 50%, allowing positions to become liquidatable immediately after a very small amount of interest accrues. These are release blockers.
+
+The review found 2 critical, 5 high, 4 medium, and 2 low-severity issues. The team should address findings AL-01 through AL-07 before deployment, then add tests covering every exploit and boundary described below. This was a manual source review supplemented by a successful `forge build`; no test suite was present.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | AL-01 | Critical | Anyone can replace the proxy implementation |
+| 2 | AL-02 | Critical | Anyone can replace the oracle and drain seeded USDC |
+| 3 | AL-03 | High | Anyone can rewrite the liquidation boundary or halt core operations |
+| 4 | AL-04 | High | Divide-before-multiply makes the effective maximum LTV approximately 50% |
+| 5 | AL-05 | High | Oracle accepts stale prices and ignores the Arbitrum sequencer status |
+| 6 | AL-06 | High | Deeply underwater accounts are economically impossible to liquidate |
+| 7 | AL-07 | High | A proxy deployed without atomic initialization can be taken over |
+| 8 | AL-08 | Medium | Borrow signatures can be replayed indefinitely |
+| 9 | AL-09 | Medium | The configured stETH/USD feed is not a wstETH/USD price |
+| 10 | AL-10 | Medium | Vault accounting trusts nominal transfers and is incompatible with planned token types |
+| 11 | AL-11 | Medium | External token calls make withdrawals reentrant for future callback-capable collateral |
+| 12 | AL-12 | Low | Full repayment can leave irreducible debt dust |
+| 13 | AL-13 | Low | The borrower registry can be grown until batch liquidation no longer fits in a block |
+
+## Findings
+
+### AL-01 — Anyone can replace the proxy implementation
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no access control and writes directly to the ERC-1967 implementation slot. Because calls reach it through `MarketProxy`, any account can point the live proxy at attacker-controlled code. That code can transfer all USDC held by the proxy, manipulate or erase every debt position, and use the market's authority over `CollateralVault` to seize every user's collateral. The attacker gets all protocol liquidity and all deposited collateral; users and the treasury can lose everything.
+
+**Fix:** Restrict upgrades to a timelocked governance/admin authority, use a reviewed UUPS implementation (including `onlyProxy`, implementation compatibility checks, and `_authorizeUpgrade`), and reject zero/non-contract implementations. Test that direct calls, non-admin proxy calls, and incompatible implementations revert. Consider a multisig plus timelock for production upgrades.
+
+### AL-02 — Anyone can replace the oracle and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no `onlyOwner` modifier. An attacker can deploy an oracle-shaped contract that reports an arbitrarily high wstETH price and/or an arbitrarily low USDC price, set it as the market oracle, deposit a negligible amount of wstETH, and borrow the proxy's entire seeded USDC balance. The attacker gets the treasury's USDC while leaving debt backed by almost no real collateral. Existing positions can also be forced into liquidation with attacker-selected prices.
+
+**Fix:** Add `onlyOwner`, reject the zero address and non-contract addresses, and make oracle changes timelocked. Validate the complete proposed feed configuration before activation. A two-step propose/accept process with an emergency pause limits both key compromise and configuration mistakes.
+
+### AL-03 — Anyone can rewrite the liquidation boundary or halt core operations
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+`setLiquidationThreshold` is also unauthenticated and has no bounds. Setting it to zero makes every debt position unhealthy, letting the attacker liquidate borrowers and collect the 5% bonus even though prices did not move. Setting it above `BPS` permits positions up to 100% LTV under the current health-factor arithmetic, leaving the treasury exposed to immediate bad debt after a small adverse price move. A sufficiently large value can instead make health-factor multiplication overflow, blocking borrowing, liquidation, and collateral withdrawals for indebted users. The attacker gets liquidation bonuses or can hold core market operations hostage; borrowers lose collateral and the treasury bears newly unsafe debt.
+
+**Fix:** Add `onlyOwner`, constrain the threshold to a governance-approved safe range no greater than `BPS`, and timelock changes. Apply equivalent explicit bounds to `borrowRate` and other economic parameters so a privileged configuration error cannot overflow accrual or destroy solvency.
+
+### AL-04 — Divide-before-multiply makes the effective maximum LTV approximately 50%
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression `collateralValueUsd(user) / debtUsd` performs integer division before applying the threshold and WAD scale. Every collateral-to-debt ratio from 1.00 up to 1.999... is truncated to `1`, producing a health factor of `0.8e18`; the position only becomes healthy when the ratio reaches `2`. Thus the documented 80% threshold (125% minimum collateral ratio) behaves as an approximately 50% maximum LTV with a large discontinuity.
+
+A user borrowing at 50% LTV can become liquidatable after the first positive interest accrual, despite virtually no price movement. A liquidator gets the 5% bonus and the user unexpectedly loses that collateral. Users between 50% and the advertised 80% LTV cannot borrow at all.
+
+**Fix:** Multiply before dividing, for example `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`, using full-precision `mulDiv` to avoid overflow and define rounding direction deliberately. Add boundary tests immediately below, at, and above 80% LTV and tests after one accrual interval.
+
+### AL-05 — Oracle accepts stale prices and ignores the Arbitrum sequencer status
+
+**Severity:** High  
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle calls `latestAnswer()` and does not inspect round timestamps, round completeness, or answer sign. It also has no Arbitrum sequencer-uptime check or recovery grace period. During an outage, feed disruption, or delayed update, borrowing and liquidation continue against an old price. An attacker can borrow excess USDC when collateral has fallen but the stored answer has not; conversely, liquidators can seize users after the true price has recovered. The attacker or liquidator gets USDC or discounted collateral, while the treasury or borrower takes the loss. A negative answer is cast to a huge unsigned integer rather than rejected (and will commonly cause downstream overflow/reverts), creating additional denial-of-service behavior.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. On Arbitrum, check Chainlink's sequencer-uptime feed, reject while the sequencer is down, and enforce a grace period after it returns. Pause new borrowing when price validity cannot be established; choose and document the desired liquidation behavior during oracle failure.
+
+### AL-06 — Deeply underwater accounts are economically impossible to liquidate
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket._liquidate`
+
+Liquidation is all-or-nothing: the caller must transfer the user's entire debt before collateral is seized. If a fast price move makes collateral worth less than the debt, the liquidator pays more USDC than the collateral received and rationally will not call. For example, a position with 100 USDC of debt and 70 USD of collateral requires the liquidator to spend 100 USDC to receive at most 70 USD. The market keeps the bad debt in accounting and the treasury cannot recover the shortfall. `liquidateAll` does not solve the incentive failure.
+
+**Fix:** Implement bounded partial liquidations with a close factor and calculate repayable debt from available collateral after applying the bonus. Cap seizure to the user's balance, define bad-debt recognition/socialization explicitly, and provide an incentive or reserve mechanism for terminal bad debt. Add crash and thin-liquidity scenarios where collateral falls below debt.
+
+### AL-07 — A proxy deployed without atomic initialization can be taken over
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.initialize`, `MarketProxy.constructor`
+
+`initialize` is callable by anyone until the proxy's `initialized` flag is set, while the proxy constructor permits empty `initData`. If deployment is split into “deploy proxy, then initialize,” a searcher can initialize first and become owner. Once AL-01 through AL-03 are fixed, that owner still controls collateral listing, rates, and any owner-gated upgrade/oracle functions added by the fixes. The searcher can configure the market for theft or permanently deny the intended administrator control.
+
+**Fix:** Require non-empty, successful initialization data in the proxy constructor and deploy/initialize atomically. Use a standard initializer pattern, disable initializers in the implementation constructor, validate every initialization address (including nonzero owner and contract addresses), and assert post-deployment state in the deployment script before funding the market.
+
+### AL-08 — Borrow signatures can be replayed indefinitely
+
+**Severity:** Medium  
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount; it has neither a nonce nor a deadline. Anyone who sees one valid signature can submit it repeatedly until the account reaches its borrowing limit or market liquidity runs out. The USDC is sent to the borrower, so the relayer does not directly receive it, but an unwanted repeated loan can move the borrower to the liquidation boundary; after interest or a price move, liquidators receive the bonus and the borrower loses collateral. The borrower has no way to revoke an exposed signature.
+
+**Fix:** Include a per-borrower nonce and deadline in the EIP-712 struct, consume the nonce before external calls, reject expired signatures, and use a strict ECDSA recovery library that rejects malleable signatures and invalid `v`/zero signers. Consider signing a recipient if delegated borrowing is intended to direct funds elsewhere.
+
+### AL-09 — The configured stETH/USD feed is not a wstETH/USD price
+
+**Severity:** Medium  
+**Contract / function:** Deployment configuration; `PriceOracle.getPrice`, `LendingMarket.collateralValueUsd`
+
+The README lists wstETH as the collateral but explicitly configures an stETH/USD feed. One wstETH represents a changing amount of stETH, so treating the stETH price as the price of one wstETH omits the wrapper exchange rate. At current positive staking accrual this understates collateral value: users receive less borrowing capacity and can be liquidated earlier than the documented risk parameters imply, transferring an unnecessary liquidation bonus to liquidators. More generally, using a feed for a different unit can produce unsafe valuation if the conversion moves in the opposite direction.
+
+**Fix:** Price wstETH in matching units: use an appropriate wstETH/USD feed, or combine stETH/USD with the on-chain wstETH-to-stETH conversion using carefully matched decimals and independent freshness checks. Add a deployment assertion that feed descriptions/units match each listed asset and a fork test against the exact Arbitrum addresses.
+
+### AL-10 — Vault accounting trusts nominal transfers and is incompatible with planned token types
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+All ERC-20 return values are ignored, and deposits credit the requested `amount` rather than the balance actually received. A false-returning or fee-on-transfer collateral can therefore create accounting claims without corresponding assets; an attacker can borrow real USDC against the fictitious balance. Rebasing collateral, which the roadmap explicitly contemplates, also makes fixed per-user nominal balances diverge from the vault's actual holdings, allocating gains incorrectly or making withdrawals insolvent. With a false-returning debt token, repayments/liquidations could erase debt without payment, although the launch USDC is not expected to behave that way.
+
+**Fix:** Use safe-transfer wrappers and verify balance deltas for deposits. Define an adapter/share-accounting interface for yield-bearing and rebasing assets rather than listing them through the current raw ERC-20 path. Maintain per-asset invariants tying total user shares to custody balances, and reject fee-on-transfer assets unless the accounting intentionally supports them.
+
+### AL-11 — External token calls make withdrawals reentrant for future callback-capable collateral
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.withdraw`
+
+`withdraw` transfers tokens before reducing the user's recorded balance. A listed token that invokes receiver callbacks can reenter `withdraw` while the old balance is still recorded and withdraw the same collateral repeatedly, draining that token from the vault. The attacker receives other users' custody balance of that token. The announced launch assets are not expected to callback this way, but the unrestricted future listing mechanism makes this a material expansion hazard.
+
+**Fix:** Follow checks-effects-interactions: decrement accounting before transfer, then perform the health check and token transfer (a revert rolls all state back). Add a reentrancy guard around vault entry points and only list assets after behavioral review. Test with an adversarial callback token.
+
+### AL-12 — Full repayment can leave irreducible debt dust
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Debt is rounded down, and repayment subtracts another rounded-down conversion from amount to principal. Paying the displayed full debt can therefore leave one or more principal units. At sufficiently small balances, a user can transfer the displayed debt while `amount * WAD / borrowIndex` rounds to zero, so the payment reduces no principal. The market receives extra USDC while the user retains debt dust, may need repeated repayments, and may be unable to cleanly close accounting.
+
+**Fix:** If `amount == debtOf(user)`, set principal to zero explicitly. Otherwise use a documented rounding policy that makes debt reduction consistent with amount paid, and test minimum-unit USDC debt across a range of borrow-index values.
+
+### AL-13 — The borrower registry can be grown until batch liquidation no longer fits in a block
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to a new loan appends the address to `borrowers`, but entries are never removed or deduplicated permanently. A user can cycle borrow/repay (or use many addresses) to grow the array. `liquidateAll` eventually exceeds the block gas limit, so the keeper loses the advertised batch sweep after a large price move. Individual `liquidate` calls remain available, limiting the direct loss, but delayed liquidations increase bad-debt risk.
+
+**Fix:** Do not iterate over an unbounded on-chain borrower set. Use off-chain indexing plus individual/bounded-batch liquidation, or accept a caller-supplied list with a strict maximum. If a registry is retained, track membership and remove closed positions without creating duplicate historical entries.
+
+## Deployment recommendation
+
+Do not fund or open the proxy until all critical and high findings are fixed and covered by unit, invariant, fuzz, and Arbitrum-fork tests. In particular, assert upgrade/oracle/parameter authorization, atomic initialization, oracle failure handling, exact 80% health-factor boundaries, liquidation incentives through a severe wstETH drawdown, and conservation of USDC and collateral across every state transition.

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..53732f6fa81229d09b9e84f6f31bda1a332e228c
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,152 @@
+# ArbiLend Security Review
+
+Date: 2026-09-02  
+Scope: `README.md` and all Solidity files under `src/`  
+Target: Arbitrum One, wstETH collateral, native USDC debt asset
+
+## Executive summary
+
+ArbiLend is **not safe to deploy in its current form**. Two unauthenticated administrative paths let any account take all seeded USDC or replace the market implementation. The health-factor calculation also changes the intended 80% liquidation threshold into a discontinuous effective threshold near 50%, allowing positions to become liquidatable immediately after a very small amount of interest accrues. These are release blockers.
+
+The review found 2 critical, 5 high, 4 medium, and 2 low-severity issues. The team should address findings AL-01 through AL-07 before deployment, then add tests covering every exploit and boundary described below. This was a manual source review supplemented by a successful `forge build`; no test suite was present.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | AL-01 | Critical | Anyone can replace the proxy implementation |
+| 2 | AL-02 | Critical | Anyone can replace the oracle and drain seeded USDC |
+| 3 | AL-03 | High | Anyone can rewrite the liquidation boundary or halt core operations |
+| 4 | AL-04 | High | Divide-before-multiply makes the effective maximum LTV approximately 50% |
+| 5 | AL-05 | High | Oracle accepts stale prices and ignores the Arbitrum sequencer status |
+| 6 | AL-06 | High | Deeply underwater accounts are economically impossible to liquidate |
+| 7 | AL-07 | High | A proxy deployed without atomic initialization can be taken over |
+| 8 | AL-08 | Medium | Borrow signatures can be replayed indefinitely |
+| 9 | AL-09 | Medium | The configured stETH/USD feed is not a wstETH/USD price |
+| 10 | AL-10 | Medium | Vault accounting trusts nominal transfers and is incompatible with planned token types |
+| 11 | AL-11 | Medium | External token calls make withdrawals reentrant for future callback-capable collateral |
+| 12 | AL-12 | Low | Full repayment can leave irreducible debt dust |
+| 13 | AL-13 | Low | The borrower registry can be grown until batch liquidation no longer fits in a block |
+
+## Findings
+
+### AL-01 — Anyone can replace the proxy implementation
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no access control and writes directly to the ERC-1967 implementation slot. Because calls reach it through `MarketProxy`, any account can point the live proxy at attacker-controlled code. That code can transfer all USDC held by the proxy, manipulate or erase every debt position, and use the market's authority over `CollateralVault` to seize every user's collateral. The attacker gets all protocol liquidity and all deposited collateral; users and the treasury can lose everything.
+
+**Fix:** Restrict upgrades to a timelocked governance/admin authority, use a reviewed UUPS implementation (including `onlyProxy`, implementation compatibility checks, and `_authorizeUpgrade`), and reject zero/non-contract implementations. Test that direct calls, non-admin proxy calls, and incompatible implementations revert. Consider a multisig plus timelock for production upgrades.
+
+### AL-02 — Anyone can replace the oracle and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no `onlyOwner` modifier. An attacker can deploy an oracle-shaped contract that reports an arbitrarily high wstETH price and/or an arbitrarily low USDC price, set it as the market oracle, deposit a negligible amount of wstETH, and borrow the proxy's entire seeded USDC balance. The attacker gets the treasury's USDC while leaving debt backed by almost no real collateral. Existing positions can also be forced into liquidation with attacker-selected prices.
+
+**Fix:** Add `onlyOwner`, reject the zero address and non-contract addresses, and make oracle changes timelocked. Validate the complete proposed feed configuration before activation. A two-step propose/accept process with an emergency pause limits both key compromise and configuration mistakes.
+
+### AL-03 — Anyone can rewrite the liquidation boundary or halt core operations
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+`setLiquidationThreshold` is also unauthenticated and has no bounds. Setting it to zero makes every debt position unhealthy, letting the attacker liquidate borrowers and collect the 5% bonus even though prices did not move. Setting it above `BPS` permits positions up to 100% LTV under the current health-factor arithmetic, leaving the treasury exposed to immediate bad debt after a small adverse price move. A sufficiently large value can instead make health-factor multiplication overflow, blocking borrowing, liquidation, and collateral withdrawals for indebted users. The attacker gets liquidation bonuses or can hold core market operations hostage; borrowers lose collateral and the treasury bears newly unsafe debt.
+
+**Fix:** Add `onlyOwner`, constrain the threshold to a governance-approved safe range no greater than `BPS`, and timelock changes. Apply equivalent explicit bounds to `borrowRate` and other economic parameters so a privileged configuration error cannot overflow accrual or destroy solvency.
+
+### AL-04 — Divide-before-multiply makes the effective maximum LTV approximately 50%
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression `collateralValueUsd(user) / debtUsd` performs integer division before applying the threshold and WAD scale. Every collateral-to-debt ratio from 1.00 up to 1.999... is truncated to `1`, producing a health factor of `0.8e18`; the position only becomes healthy when the ratio reaches `2`. Thus the documented 80% threshold (125% minimum collateral ratio) behaves as an approximately 50% maximum LTV with a large discontinuity.
+
+A user borrowing at 50% LTV can become liquidatable after the first positive interest accrual, despite virtually no price movement. A liquidator gets the 5% bonus and the user unexpectedly loses that collateral. Users between 50% and the advertised 80% LTV cannot borrow at all.
+
+**Fix:** Multiply before dividing, for example `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`, using full-precision `mulDiv` to avoid overflow and define rounding direction deliberately. Add boundary tests immediately below, at, and above 80% LTV and tests after one accrual interval.
+
+### AL-05 — Oracle accepts stale prices and ignores the Arbitrum sequencer status
+
+**Severity:** High  
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle calls `latestAnswer()` and does not inspect round timestamps, round completeness, or answer sign. It also has no Arbitrum sequencer-uptime check or recovery grace period. During an outage, feed disruption, or delayed update, borrowing and liquidation continue against an old price. An attacker can borrow excess USDC when collateral has fallen but the stored answer has not; conversely, liquidators can seize users after the true price has recovered. The attacker or liquidator gets USDC or discounted collateral, while the treasury or borrower takes the loss. A negative answer is cast to a huge unsigned integer rather than rejected (and will commonly cause downstream overflow/reverts), creating additional denial-of-service behavior.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. On Arbitrum, check Chainlink's sequencer-uptime feed, reject while the sequencer is down, and enforce a grace period after it returns. Pause new borrowing when price validity cannot be established; choose and document the desired liquidation behavior during oracle failure.
+
+### AL-06 — Deeply underwater accounts are economically impossible to liquidate
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket._liquidate`
+
+Liquidation is all-or-nothing: the caller must transfer the user's entire debt before collateral is seized. If a fast price move makes collateral worth less than the debt, the liquidator pays more USDC than the collateral received and rationally will not call. For example, a position with 100 USDC of debt and 70 USD of collateral requires the liquidator to spend 100 USDC to receive at most 70 USD. The market keeps the bad debt in accounting and the treasury cannot recover the shortfall. `liquidateAll` does not solve the incentive failure.
+
+**Fix:** Implement bounded partial liquidations with a close factor and calculate repayable debt from available collateral after applying the bonus. Cap seizure to the user's balance, define bad-debt recognition/socialization explicitly, and provide an incentive or reserve mechanism for terminal bad debt. Add crash and thin-liquidity scenarios where collateral falls below debt.
+
+### AL-07 — A proxy deployed without atomic initialization can be taken over
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.initialize`, `MarketProxy.constructor`
+
+`initialize` is callable by anyone until the proxy's `initialized` flag is set, while the proxy constructor permits empty `initData`. If deployment is split into “deploy proxy, then initialize,” a searcher can initialize first and become owner. Once AL-01 through AL-03 are fixed, that owner still controls collateral listing, rates, and any owner-gated upgrade/oracle functions added by the fixes. The searcher can configure the market for theft or permanently deny the intended administrator control.
+
+**Fix:** Require non-empty, successful initialization data in the proxy constructor and deploy/initialize atomically. Use a standard initializer pattern, disable initializers in the implementation constructor, validate every initialization address (including nonzero owner and contract addresses), and assert post-deployment state in the deployment script before funding the market.
+
+### AL-08 — Borrow signatures can be replayed indefinitely
+
+**Severity:** Medium  
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount; it has neither a nonce nor a deadline. Anyone who sees one valid signature can submit it repeatedly until the account reaches its borrowing limit or market liquidity runs out. The USDC is sent to the borrower, so the relayer does not directly receive it, but an unwanted repeated loan can move the borrower to the liquidation boundary; after interest or a price move, liquidators receive the bonus and the borrower loses collateral. The borrower has no way to revoke an exposed signature.
+
+**Fix:** Include a per-borrower nonce and deadline in the EIP-712 struct, consume the nonce before external calls, reject expired signatures, and use a strict ECDSA recovery library that rejects malleable signatures and invalid `v`/zero signers. Consider signing a recipient if delegated borrowing is intended to direct funds elsewhere.
+
+### AL-09 — The configured stETH/USD feed is not a wstETH/USD price
+
+**Severity:** Medium  
+**Contract / function:** Deployment configuration; `PriceOracle.getPrice`, `LendingMarket.collateralValueUsd`
+
+The README lists wstETH as the collateral but explicitly configures an stETH/USD feed. One wstETH represents a changing amount of stETH, so treating the stETH price as the price of one wstETH omits the wrapper exchange rate. At current positive staking accrual this understates collateral value: users receive less borrowing capacity and can be liquidated earlier than the documented risk parameters imply, transferring an unnecessary liquidation bonus to liquidators. More generally, using a feed for a different unit can produce unsafe valuation if the conversion moves in the opposite direction.
+
+**Fix:** Price wstETH in matching units: use an appropriate wstETH/USD feed, or combine stETH/USD with the on-chain wstETH-to-stETH conversion using carefully matched decimals and independent freshness checks. Add a deployment assertion that feed descriptions/units match each listed asset and a fork test against the exact Arbitrum addresses.
+
+### AL-10 — Vault accounting trusts nominal transfers and is incompatible with planned token types
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+All ERC-20 return values are ignored, and deposits credit the requested `amount` rather than the balance actually received. A false-returning or fee-on-transfer collateral can therefore create accounting claims without corresponding assets; an attacker can borrow real USDC against the fictitious balance. Rebasing collateral, which the roadmap explicitly contemplates, also makes fixed per-user nominal balances diverge from the vault's actual holdings, allocating gains incorrectly or making withdrawals insolvent. With a false-returning debt token, repayments/liquidations could erase debt without payment, although the launch USDC is not expected to behave that way.
+
+**Fix:** Use safe-transfer wrappers and verify balance deltas for deposits. Define an adapter/share-accounting interface for yield-bearing and rebasing assets rather than listing them through the current raw ERC-20 path. Maintain per-asset invariants tying total user shares to custody balances, and reject fee-on-transfer assets unless the accounting intentionally supports them.
+
+### AL-11 — External token calls make withdrawals reentrant for future callback-capable collateral
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.withdraw`
+
+`withdraw` transfers tokens before reducing the user's recorded balance. A listed token that invokes receiver callbacks can reenter `withdraw` while the old balance is still recorded and withdraw the same collateral repeatedly, draining that token from the vault. The attacker receives other users' custody balance of that token. The announced launch assets are not expected to callback this way, but the unrestricted future listing mechanism makes this a material expansion hazard.
+
+**Fix:** Follow checks-effects-interactions: decrement accounting before transfer, then perform the health check and token transfer (a revert rolls all state back). Add a reentrancy guard around vault entry points and only list assets after behavioral review. Test with an adversarial callback token.
+
+### AL-12 — Full repayment can leave irreducible debt dust
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Debt is rounded down, and repayment subtracts another rounded-down conversion from amount to principal. Paying the displayed full debt can therefore leave one or more principal units. At sufficiently small balances, a user can transfer the displayed debt while `amount * WAD / borrowIndex` rounds to zero, so the payment reduces no principal. The market receives extra USDC while the user retains debt dust, may need repeated repayments, and may be unable to cleanly close accounting.
+
+**Fix:** If `amount == debtOf(user)`, set principal to zero explicitly. Otherwise use a documented rounding policy that makes debt reduction consistent with amount paid, and test minimum-unit USDC debt across a range of borrow-index values.
+
+### AL-13 — The borrower registry can be grown until batch liquidation no longer fits in a block
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to a new loan appends the address to `borrowers`, but entries are never removed or deduplicated permanently. A user can cycle borrow/repay (or use many addresses) to grow the array. `liquidateAll` eventually exceeds the block gas limit, so the keeper loses the advertised batch sweep after a large price move. Individual `liquidate` calls remain available, limiting the direct loss, but delayed liquidations increase bad-debt risk.
+
+**Fix:** Do not iterate over an unbounded on-chain borrower set. Use off-chain indexing plus individual/bounded-batch liquidation, or accept a caller-supplied list with a strict maximum. If a registry is retained, track membership and remove closed positions without creating duplicate historical entries.
+
+## Deployment recommendation
+
+Do not fund or open the proxy until all critical and high findings are fixed and covered by unit, invariant, fuzz, and Arbitrum-fork tests. In particular, assert upgrade/oracle/parameter authorization, atomic initialization, oracle failure handling, exact 80% health-factor boundaries, liquidation incentives through a severe wstETH drawdown, and conservation of USDC and collateral across every state transition.

exec
/bin/bash -lc 'git ls-files cache out && git check-ignore -v cache/solidity-files-cache.json out 2>/dev/null || true && find out -type f 2>/dev/null | head -20' in /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001
 succeeded in 2ms:
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..53732f6fa81229d09b9e84f6f31bda1a332e228c
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,152 @@
+# ArbiLend Security Review
+
+Date: 2026-09-02  
+Scope: `README.md` and all Solidity files under `src/`  
+Target: Arbitrum One, wstETH collateral, native USDC debt asset
+
+## Executive summary
+
+ArbiLend is **not safe to deploy in its current form**. Two unauthenticated administrative paths let any account take all seeded USDC or replace the market implementation. The health-factor calculation also changes the intended 80% liquidation threshold into a discontinuous effective threshold near 50%, allowing positions to become liquidatable immediately after a very small amount of interest accrues. These are release blockers.
+
+The review found 2 critical, 5 high, 4 medium, and 2 low-severity issues. The team should address findings AL-01 through AL-07 before deployment, then add tests covering every exploit and boundary described below. This was a manual source review supplemented by a successful `forge build`; no test suite was present.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | AL-01 | Critical | Anyone can replace the proxy implementation |
+| 2 | AL-02 | Critical | Anyone can replace the oracle and drain seeded USDC |
+| 3 | AL-03 | High | Anyone can rewrite the liquidation boundary or halt core operations |
+| 4 | AL-04 | High | Divide-before-multiply makes the effective maximum LTV approximately 50% |
+| 5 | AL-05 | High | Oracle accepts stale prices and ignores the Arbitrum sequencer status |
+| 6 | AL-06 | High | Deeply underwater accounts are economically impossible to liquidate |
+| 7 | AL-07 | High | A proxy deployed without atomic initialization can be taken over |
+| 8 | AL-08 | Medium | Borrow signatures can be replayed indefinitely |
+| 9 | AL-09 | Medium | The configured stETH/USD feed is not a wstETH/USD price |
+| 10 | AL-10 | Medium | Vault accounting trusts nominal transfers and is incompatible with planned token types |
+| 11 | AL-11 | Medium | External token calls make withdrawals reentrant for future callback-capable collateral |
+| 12 | AL-12 | Low | Full repayment can leave irreducible debt dust |
+| 13 | AL-13 | Low | The borrower registry can be grown until batch liquidation no longer fits in a block |
+
+## Findings
+
+### AL-01 — Anyone can replace the proxy implementation
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no access control and writes directly to the ERC-1967 implementation slot. Because calls reach it through `MarketProxy`, any account can point the live proxy at attacker-controlled code. That code can transfer all USDC held by the proxy, manipulate or erase every debt position, and use the market's authority over `CollateralVault` to seize every user's collateral. The attacker gets all protocol liquidity and all deposited collateral; users and the treasury can lose everything.
+
+**Fix:** Restrict upgrades to a timelocked governance/admin authority, use a reviewed UUPS implementation (including `onlyProxy`, implementation compatibility checks, and `_authorizeUpgrade`), and reject zero/non-contract implementations. Test that direct calls, non-admin proxy calls, and incompatible implementations revert. Consider a multisig plus timelock for production upgrades.
+
+### AL-02 — Anyone can replace the oracle and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no `onlyOwner` modifier. An attacker can deploy an oracle-shaped contract that reports an arbitrarily high wstETH price and/or an arbitrarily low USDC price, set it as the market oracle, deposit a negligible amount of wstETH, and borrow the proxy's entire seeded USDC balance. The attacker gets the treasury's USDC while leaving debt backed by almost no real collateral. Existing positions can also be forced into liquidation with attacker-selected prices.
+
+**Fix:** Add `onlyOwner`, reject the zero address and non-contract addresses, and make oracle changes timelocked. Validate the complete proposed feed configuration before activation. A two-step propose/accept process with an emergency pause limits both key compromise and configuration mistakes.
+
+### AL-03 — Anyone can rewrite the liquidation boundary or halt core operations
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+`setLiquidationThreshold` is also unauthenticated and has no bounds. Setting it to zero makes every debt position unhealthy, letting the attacker liquidate borrowers and collect the 5% bonus even though prices did not move. Setting it above `BPS` permits positions up to 100% LTV under the current health-factor arithmetic, leaving the treasury exposed to immediate bad debt after a small adverse price move. A sufficiently large value can instead make health-factor multiplication overflow, blocking borrowing, liquidation, and collateral withdrawals for indebted users. The attacker gets liquidation bonuses or can hold core market operations hostage; borrowers lose collateral and the treasury bears newly unsafe debt.
+
+**Fix:** Add `onlyOwner`, constrain the threshold to a governance-approved safe range no greater than `BPS`, and timelock changes. Apply equivalent explicit bounds to `borrowRate` and other economic parameters so a privileged configuration error cannot overflow accrual or destroy solvency.
+
+### AL-04 — Divide-before-multiply makes the effective maximum LTV approximately 50%
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression `collateralValueUsd(user) / debtUsd` performs integer division before applying the threshold and WAD scale. Every collateral-to-debt ratio from 1.00 up to 1.999... is truncated to `1`, producing a health factor of `0.8e18`; the position only becomes healthy when the ratio reaches `2`. Thus the documented 80% threshold (125% minimum collateral ratio) behaves as an approximately 50% maximum LTV with a large discontinuity.
+
+A user borrowing at 50% LTV can become liquidatable after the first positive interest accrual, despite virtually no price movement. A liquidator gets the 5% bonus and the user unexpectedly loses that collateral. Users between 50% and the advertised 80% LTV cannot borrow at all.
+
+**Fix:** Multiply before dividing, for example `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`, using full-precision `mulDiv` to avoid overflow and define rounding direction deliberately. Add boundary tests immediately below, at, and above 80% LTV and tests after one accrual interval.
+
+### AL-05 — Oracle accepts stale prices and ignores the Arbitrum sequencer status
+
+**Severity:** High  
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle calls `latestAnswer()` and does not inspect round timestamps, round completeness, or answer sign. It also has no Arbitrum sequencer-uptime check or recovery grace period. During an outage, feed disruption, or delayed update, borrowing and liquidation continue against an old price. An attacker can borrow excess USDC when collateral has fallen but the stored answer has not; conversely, liquidators can seize users after the true price has recovered. The attacker or liquidator gets USDC or discounted collateral, while the treasury or borrower takes the loss. A negative answer is cast to a huge unsigned integer rather than rejected (and will commonly cause downstream overflow/reverts), creating additional denial-of-service behavior.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. On Arbitrum, check Chainlink's sequencer-uptime feed, reject while the sequencer is down, and enforce a grace period after it returns. Pause new borrowing when price validity cannot be established; choose and document the desired liquidation behavior during oracle failure.
+
+### AL-06 — Deeply underwater accounts are economically impossible to liquidate
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket._liquidate`
+
+Liquidation is all-or-nothing: the caller must transfer the user's entire debt before collateral is seized. If a fast price move makes collateral worth less than the debt, the liquidator pays more USDC than the collateral received and rationally will not call. For example, a position with 100 USDC of debt and 70 USD of collateral requires the liquidator to spend 100 USDC to receive at most 70 USD. The market keeps the bad debt in accounting and the treasury cannot recover the shortfall. `liquidateAll` does not solve the incentive failure.
+
+**Fix:** Implement bounded partial liquidations with a close factor and calculate repayable debt from available collateral after applying the bonus. Cap seizure to the user's balance, define bad-debt recognition/socialization explicitly, and provide an incentive or reserve mechanism for terminal bad debt. Add crash and thin-liquidity scenarios where collateral falls below debt.
+
+### AL-07 — A proxy deployed without atomic initialization can be taken over
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.initialize`, `MarketProxy.constructor`
+
+`initialize` is callable by anyone until the proxy's `initialized` flag is set, while the proxy constructor permits empty `initData`. If deployment is split into “deploy proxy, then initialize,” a searcher can initialize first and become owner. Once AL-01 through AL-03 are fixed, that owner still controls collateral listing, rates, and any owner-gated upgrade/oracle functions added by the fixes. The searcher can configure the market for theft or permanently deny the intended administrator control.
+
+**Fix:** Require non-empty, successful initialization data in the proxy constructor and deploy/initialize atomically. Use a standard initializer pattern, disable initializers in the implementation constructor, validate every initialization address (including nonzero owner and contract addresses), and assert post-deployment state in the deployment script before funding the market.
+
+### AL-08 — Borrow signatures can be replayed indefinitely
+
+**Severity:** Medium  
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount; it has neither a nonce nor a deadline. Anyone who sees one valid signature can submit it repeatedly until the account reaches its borrowing limit or market liquidity runs out. The USDC is sent to the borrower, so the relayer does not directly receive it, but an unwanted repeated loan can move the borrower to the liquidation boundary; after interest or a price move, liquidators receive the bonus and the borrower loses collateral. The borrower has no way to revoke an exposed signature.
+
+**Fix:** Include a per-borrower nonce and deadline in the EIP-712 struct, consume the nonce before external calls, reject expired signatures, and use a strict ECDSA recovery library that rejects malleable signatures and invalid `v`/zero signers. Consider signing a recipient if delegated borrowing is intended to direct funds elsewhere.
+
+### AL-09 — The configured stETH/USD feed is not a wstETH/USD price
+
+**Severity:** Medium  
+**Contract / function:** Deployment configuration; `PriceOracle.getPrice`, `LendingMarket.collateralValueUsd`
+
+The README lists wstETH as the collateral but explicitly configures an stETH/USD feed. One wstETH represents a changing amount of stETH, so treating the stETH price as the price of one wstETH omits the wrapper exchange rate. At current positive staking accrual this understates collateral value: users receive less borrowing capacity and can be liquidated earlier than the documented risk parameters imply, transferring an unnecessary liquidation bonus to liquidators. More generally, using a feed for a different unit can produce unsafe valuation if the conversion moves in the opposite direction.
+
+**Fix:** Price wstETH in matching units: use an appropriate wstETH/USD feed, or combine stETH/USD with the on-chain wstETH-to-stETH conversion using carefully matched decimals and independent freshness checks. Add a deployment assertion that feed descriptions/units match each listed asset and a fork test against the exact Arbitrum addresses.
+
+### AL-10 — Vault accounting trusts nominal transfers and is incompatible with planned token types
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+All ERC-20 return values are ignored, and deposits credit the requested `amount` rather than the balance actually received. A false-returning or fee-on-transfer collateral can therefore create accounting claims without corresponding assets; an attacker can borrow real USDC against the fictitious balance. Rebasing collateral, which the roadmap explicitly contemplates, also makes fixed per-user nominal balances diverge from the vault's actual holdings, allocating gains incorrectly or making withdrawals insolvent. With a false-returning debt token, repayments/liquidations could erase debt without payment, although the launch USDC is not expected to behave that way.
+
+**Fix:** Use safe-transfer wrappers and verify balance deltas for deposits. Define an adapter/share-accounting interface for yield-bearing and rebasing assets rather than listing them through the current raw ERC-20 path. Maintain per-asset invariants tying total user shares to custody balances, and reject fee-on-transfer assets unless the accounting intentionally supports them.
+
+### AL-11 — External token calls make withdrawals reentrant for future callback-capable collateral
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.withdraw`
+
+`withdraw` transfers tokens before reducing the user's recorded balance. A listed token that invokes receiver callbacks can reenter `withdraw` while the old balance is still recorded and withdraw the same collateral repeatedly, draining that token from the vault. The attacker receives other users' custody balance of that token. The announced launch assets are not expected to callback this way, but the unrestricted future listing mechanism makes this a material expansion hazard.
+
+**Fix:** Follow checks-effects-interactions: decrement accounting before transfer, then perform the health check and token transfer (a revert rolls all state back). Add a reentrancy guard around vault entry points and only list assets after behavioral review. Test with an adversarial callback token.
+
+### AL-12 — Full repayment can leave irreducible debt dust
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Debt is rounded down, and repayment subtracts another rounded-down conversion from amount to principal. Paying the displayed full debt can therefore leave one or more principal units. At sufficiently small balances, a user can transfer the displayed debt while `amount * WAD / borrowIndex` rounds to zero, so the payment reduces no principal. The market receives extra USDC while the user retains debt dust, may need repeated repayments, and may be unable to cleanly close accounting.
+
+**Fix:** If `amount == debtOf(user)`, set principal to zero explicitly. Otherwise use a documented rounding policy that makes debt reduction consistent with amount paid, and test minimum-unit USDC debt across a range of borrow-index values.
+
+### AL-13 — The borrower registry can be grown until batch liquidation no longer fits in a block
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to a new loan appends the address to `borrowers`, but entries are never removed or deduplicated permanently. A user can cycle borrow/repay (or use many addresses) to grow the array. `liquidateAll` eventually exceeds the block gas limit, so the keeper loses the advertised batch sweep after a large price move. Individual `liquidate` calls remain available, limiting the direct loss, but delayed liquidations increase bad-debt risk.
+
+**Fix:** Do not iterate over an unbounded on-chain borrower set. Use off-chain indexing plus individual/bounded-batch liquidation, or accept a caller-supplied list with a strict maximum. If a registry is retained, track membership and remove closed positions without creating duplicate historical entries.
+
+## Deployment recommendation
+
+Do not fund or open the proxy until all critical and high findings are fixed and covered by unit, invariant, fuzz, and Arbitrum-fork tests. In particular, assert upgrade/oracle/parameter authorization, atomic initialization, oracle failure handling, exact 80% health-factor boundaries, liquidation incentives through a severe wstETH drawdown, and conservation of USDC and collateral across every state transition.

2026-09-02T15:59:06.691371Z ERROR codex_core::tools::router: error=exec_command failed for `/bin/bash -lc "rm -rf -- /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001/out /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001/cache && git status --short --untracked-files=all && find . -maxdepth 1 -type f -printf '%f\\n' | sort && git diff -- src"`: CreateProcess { message: "Rejected(\"`/bin/bash -lc \\\"rm -rf -- /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001/out /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001/cache && git status --short --untracked-files=all && find . -maxdepth 1 -type f -printf '%f\\\\\\\\n' | sort && git diff -- src\\\"` rejected: rm -f style commands are not permitted. Use a safer approach\")" }
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..53732f6fa81229d09b9e84f6f31bda1a332e228c
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,152 @@
+# ArbiLend Security Review
+
+Date: 2026-09-02  
+Scope: `README.md` and all Solidity files under `src/`  
+Target: Arbitrum One, wstETH collateral, native USDC debt asset
+
+## Executive summary
+
+ArbiLend is **not safe to deploy in its current form**. Two unauthenticated administrative paths let any account take all seeded USDC or replace the market implementation. The health-factor calculation also changes the intended 80% liquidation threshold into a discontinuous effective threshold near 50%, allowing positions to become liquidatable immediately after a very small amount of interest accrues. These are release blockers.
+
+The review found 2 critical, 5 high, 4 medium, and 2 low-severity issues. The team should address findings AL-01 through AL-07 before deployment, then add tests covering every exploit and boundary described below. This was a manual source review supplemented by a successful `forge build`; no test suite was present.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | AL-01 | Critical | Anyone can replace the proxy implementation |
+| 2 | AL-02 | Critical | Anyone can replace the oracle and drain seeded USDC |
+| 3 | AL-03 | High | Anyone can rewrite the liquidation boundary or halt core operations |
+| 4 | AL-04 | High | Divide-before-multiply makes the effective maximum LTV approximately 50% |
+| 5 | AL-05 | High | Oracle accepts stale prices and ignores the Arbitrum sequencer status |
+| 6 | AL-06 | High | Deeply underwater accounts are economically impossible to liquidate |
+| 7 | AL-07 | High | A proxy deployed without atomic initialization can be taken over |
+| 8 | AL-08 | Medium | Borrow signatures can be replayed indefinitely |
+| 9 | AL-09 | Medium | The configured stETH/USD feed is not a wstETH/USD price |
+| 10 | AL-10 | Medium | Vault accounting trusts nominal transfers and is incompatible with planned token types |
+| 11 | AL-11 | Medium | External token calls make withdrawals reentrant for future callback-capable collateral |
+| 12 | AL-12 | Low | Full repayment can leave irreducible debt dust |
+| 13 | AL-13 | Low | The borrower registry can be grown until batch liquidation no longer fits in a block |
+
+## Findings
+
+### AL-01 — Anyone can replace the proxy implementation
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no access control and writes directly to the ERC-1967 implementation slot. Because calls reach it through `MarketProxy`, any account can point the live proxy at attacker-controlled code. That code can transfer all USDC held by the proxy, manipulate or erase every debt position, and use the market's authority over `CollateralVault` to seize every user's collateral. The attacker gets all protocol liquidity and all deposited collateral; users and the treasury can lose everything.
+
+**Fix:** Restrict upgrades to a timelocked governance/admin authority, use a reviewed UUPS implementation (including `onlyProxy`, implementation compatibility checks, and `_authorizeUpgrade`), and reject zero/non-contract implementations. Test that direct calls, non-admin proxy calls, and incompatible implementations revert. Consider a multisig plus timelock for production upgrades.
+
+### AL-02 — Anyone can replace the oracle and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no `onlyOwner` modifier. An attacker can deploy an oracle-shaped contract that reports an arbitrarily high wstETH price and/or an arbitrarily low USDC price, set it as the market oracle, deposit a negligible amount of wstETH, and borrow the proxy's entire seeded USDC balance. The attacker gets the treasury's USDC while leaving debt backed by almost no real collateral. Existing positions can also be forced into liquidation with attacker-selected prices.
+
+**Fix:** Add `onlyOwner`, reject the zero address and non-contract addresses, and make oracle changes timelocked. Validate the complete proposed feed configuration before activation. A two-step propose/accept process with an emergency pause limits both key compromise and configuration mistakes.
+
+### AL-03 — Anyone can rewrite the liquidation boundary or halt core operations
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+`setLiquidationThreshold` is also unauthenticated and has no bounds. Setting it to zero makes every debt position unhealthy, letting the attacker liquidate borrowers and collect the 5% bonus even though prices did not move. Setting it above `BPS` permits positions up to 100% LTV under the current health-factor arithmetic, leaving the treasury exposed to immediate bad debt after a small adverse price move. A sufficiently large value can instead make health-factor multiplication overflow, blocking borrowing, liquidation, and collateral withdrawals for indebted users. The attacker gets liquidation bonuses or can hold core market operations hostage; borrowers lose collateral and the treasury bears newly unsafe debt.
+
+**Fix:** Add `onlyOwner`, constrain the threshold to a governance-approved safe range no greater than `BPS`, and timelock changes. Apply equivalent explicit bounds to `borrowRate` and other economic parameters so a privileged configuration error cannot overflow accrual or destroy solvency.
+
+### AL-04 — Divide-before-multiply makes the effective maximum LTV approximately 50%
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression `collateralValueUsd(user) / debtUsd` performs integer division before applying the threshold and WAD scale. Every collateral-to-debt ratio from 1.00 up to 1.999... is truncated to `1`, producing a health factor of `0.8e18`; the position only becomes healthy when the ratio reaches `2`. Thus the documented 80% threshold (125% minimum collateral ratio) behaves as an approximately 50% maximum LTV with a large discontinuity.
+
+A user borrowing at 50% LTV can become liquidatable after the first positive interest accrual, despite virtually no price movement. A liquidator gets the 5% bonus and the user unexpectedly loses that collateral. Users between 50% and the advertised 80% LTV cannot borrow at all.
+
+**Fix:** Multiply before dividing, for example `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`, using full-precision `mulDiv` to avoid overflow and define rounding direction deliberately. Add boundary tests immediately below, at, and above 80% LTV and tests after one accrual interval.
+
+### AL-05 — Oracle accepts stale prices and ignores the Arbitrum sequencer status
+
+**Severity:** High  
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle calls `latestAnswer()` and does not inspect round timestamps, round completeness, or answer sign. It also has no Arbitrum sequencer-uptime check or recovery grace period. During an outage, feed disruption, or delayed update, borrowing and liquidation continue against an old price. An attacker can borrow excess USDC when collateral has fallen but the stored answer has not; conversely, liquidators can seize users after the true price has recovered. The attacker or liquidator gets USDC or discounted collateral, while the treasury or borrower takes the loss. A negative answer is cast to a huge unsigned integer rather than rejected (and will commonly cause downstream overflow/reverts), creating additional denial-of-service behavior.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. On Arbitrum, check Chainlink's sequencer-uptime feed, reject while the sequencer is down, and enforce a grace period after it returns. Pause new borrowing when price validity cannot be established; choose and document the desired liquidation behavior during oracle failure.
+
+### AL-06 — Deeply underwater accounts are economically impossible to liquidate
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket._liquidate`
+
+Liquidation is all-or-nothing: the caller must transfer the user's entire debt before collateral is seized. If a fast price move makes collateral worth less than the debt, the liquidator pays more USDC than the collateral received and rationally will not call. For example, a position with 100 USDC of debt and 70 USD of collateral requires the liquidator to spend 100 USDC to receive at most 70 USD. The market keeps the bad debt in accounting and the treasury cannot recover the shortfall. `liquidateAll` does not solve the incentive failure.
+
+**Fix:** Implement bounded partial liquidations with a close factor and calculate repayable debt from available collateral after applying the bonus. Cap seizure to the user's balance, define bad-debt recognition/socialization explicitly, and provide an incentive or reserve mechanism for terminal bad debt. Add crash and thin-liquidity scenarios where collateral falls below debt.
+
+### AL-07 — A proxy deployed without atomic initialization can be taken over
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.initialize`, `MarketProxy.constructor`
+
+`initialize` is callable by anyone until the proxy's `initialized` flag is set, while the proxy constructor permits empty `initData`. If deployment is split into “deploy proxy, then initialize,” a searcher can initialize first and become owner. Once AL-01 through AL-03 are fixed, that owner still controls collateral listing, rates, and any owner-gated upgrade/oracle functions added by the fixes. The searcher can configure the market for theft or permanently deny the intended administrator control.
+
+**Fix:** Require non-empty, successful initialization data in the proxy constructor and deploy/initialize atomically. Use a standard initializer pattern, disable initializers in the implementation constructor, validate every initialization address (including nonzero owner and contract addresses), and assert post-deployment state in the deployment script before funding the market.
+
+### AL-08 — Borrow signatures can be replayed indefinitely
+
+**Severity:** Medium  
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount; it has neither a nonce nor a deadline. Anyone who sees one valid signature can submit it repeatedly until the account reaches its borrowing limit or market liquidity runs out. The USDC is sent to the borrower, so the relayer does not directly receive it, but an unwanted repeated loan can move the borrower to the liquidation boundary; after interest or a price move, liquidators receive the bonus and the borrower loses collateral. The borrower has no way to revoke an exposed signature.
+
+**Fix:** Include a per-borrower nonce and deadline in the EIP-712 struct, consume the nonce before external calls, reject expired signatures, and use a strict ECDSA recovery library that rejects malleable signatures and invalid `v`/zero signers. Consider signing a recipient if delegated borrowing is intended to direct funds elsewhere.
+
+### AL-09 — The configured stETH/USD feed is not a wstETH/USD price
+
+**Severity:** Medium  
+**Contract / function:** Deployment configuration; `PriceOracle.getPrice`, `LendingMarket.collateralValueUsd`
+
+The README lists wstETH as the collateral but explicitly configures an stETH/USD feed. One wstETH represents a changing amount of stETH, so treating the stETH price as the price of one wstETH omits the wrapper exchange rate. At current positive staking accrual this understates collateral value: users receive less borrowing capacity and can be liquidated earlier than the documented risk parameters imply, transferring an unnecessary liquidation bonus to liquidators. More generally, using a feed for a different unit can produce unsafe valuation if the conversion moves in the opposite direction.
+
+**Fix:** Price wstETH in matching units: use an appropriate wstETH/USD feed, or combine stETH/USD with the on-chain wstETH-to-stETH conversion using carefully matched decimals and independent freshness checks. Add a deployment assertion that feed descriptions/units match each listed asset and a fork test against the exact Arbitrum addresses.
+
+### AL-10 — Vault accounting trusts nominal transfers and is incompatible with planned token types
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+All ERC-20 return values are ignored, and deposits credit the requested `amount` rather than the balance actually received. A false-returning or fee-on-transfer collateral can therefore create accounting claims without corresponding assets; an attacker can borrow real USDC against the fictitious balance. Rebasing collateral, which the roadmap explicitly contemplates, also makes fixed per-user nominal balances diverge from the vault's actual holdings, allocating gains incorrectly or making withdrawals insolvent. With a false-returning debt token, repayments/liquidations could erase debt without payment, although the launch USDC is not expected to behave that way.
+
+**Fix:** Use safe-transfer wrappers and verify balance deltas for deposits. Define an adapter/share-accounting interface for yield-bearing and rebasing assets rather than listing them through the current raw ERC-20 path. Maintain per-asset invariants tying total user shares to custody balances, and reject fee-on-transfer assets unless the accounting intentionally supports them.
+
+### AL-11 — External token calls make withdrawals reentrant for future callback-capable collateral
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.withdraw`
+
+`withdraw` transfers tokens before reducing the user's recorded balance. A listed token that invokes receiver callbacks can reenter `withdraw` while the old balance is still recorded and withdraw the same collateral repeatedly, draining that token from the vault. The attacker receives other users' custody balance of that token. The announced launch assets are not expected to callback this way, but the unrestricted future listing mechanism makes this a material expansion hazard.
+
+**Fix:** Follow checks-effects-interactions: decrement accounting before transfer, then perform the health check and token transfer (a revert rolls all state back). Add a reentrancy guard around vault entry points and only list assets after behavioral review. Test with an adversarial callback token.
+
+### AL-12 — Full repayment can leave irreducible debt dust
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Debt is rounded down, and repayment subtracts another rounded-down conversion from amount to principal. Paying the displayed full debt can therefore leave one or more principal units. At sufficiently small balances, a user can transfer the displayed debt while `amount * WAD / borrowIndex` rounds to zero, so the payment reduces no principal. The market receives extra USDC while the user retains debt dust, may need repeated repayments, and may be unable to cleanly close accounting.
+
+**Fix:** If `amount == debtOf(user)`, set principal to zero explicitly. Otherwise use a documented rounding policy that makes debt reduction consistent with amount paid, and test minimum-unit USDC debt across a range of borrow-index values.
+
+### AL-13 — The borrower registry can be grown until batch liquidation no longer fits in a block
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to a new loan appends the address to `borrowers`, but entries are never removed or deduplicated permanently. A user can cycle borrow/repay (or use many addresses) to grow the array. `liquidateAll` eventually exceeds the block gas limit, so the keeper loses the advertised batch sweep after a large price move. Individual `liquidate` calls remain available, limiting the direct loss, but delayed liquidations increase bad-debt risk.
+
+**Fix:** Do not iterate over an unbounded on-chain borrower set. Use off-chain indexing plus individual/bounded-batch liquidation, or accept a caller-supplied list with a strict maximum. If a registry is retained, track membership and remove closed positions without creating duplicate historical entries.
+
+## Deployment recommendation
+
+Do not fund or open the proxy until all critical and high findings are fixed and covered by unit, invariant, fuzz, and Arbitrum-fork tests. In particular, assert upgrade/oracle/parameter authorization, atomic initialization, oracle failure handling, exact 80% health-factor boundaries, liquidation incentives through a severe wstETH drawdown, and conservation of USDC and collateral across every state transition.

exec
/bin/bash -lc 'test ! -e /tmp/arbilend-build-artifacts-20260902 && mkdir /tmp/arbilend-build-artifacts-20260902 && mv ./out ./cache /tmp/arbilend-build-artifacts-20260902/ && git status --short --untracked-files=all && find . -maxdepth 1 -type f -printf '"'%f\\n' | sort && git diff -- src" in /tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001
 succeeded in 21ms:
?? AUDIT-REPORT.md
.gitignore
AUDIT-REPORT.md
README.md
TASK.md
foundry.toml
package.json

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..53732f6fa81229d09b9e84f6f31bda1a332e228c
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,152 @@
+# ArbiLend Security Review
+
+Date: 2026-09-02  
+Scope: `README.md` and all Solidity files under `src/`  
+Target: Arbitrum One, wstETH collateral, native USDC debt asset
+
+## Executive summary
+
+ArbiLend is **not safe to deploy in its current form**. Two unauthenticated administrative paths let any account take all seeded USDC or replace the market implementation. The health-factor calculation also changes the intended 80% liquidation threshold into a discontinuous effective threshold near 50%, allowing positions to become liquidatable immediately after a very small amount of interest accrues. These are release blockers.
+
+The review found 2 critical, 5 high, 4 medium, and 2 low-severity issues. The team should address findings AL-01 through AL-07 before deployment, then add tests covering every exploit and boundary described below. This was a manual source review supplemented by a successful `forge build`; no test suite was present.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | AL-01 | Critical | Anyone can replace the proxy implementation |
+| 2 | AL-02 | Critical | Anyone can replace the oracle and drain seeded USDC |
+| 3 | AL-03 | High | Anyone can rewrite the liquidation boundary or halt core operations |
+| 4 | AL-04 | High | Divide-before-multiply makes the effective maximum LTV approximately 50% |
+| 5 | AL-05 | High | Oracle accepts stale prices and ignores the Arbitrum sequencer status |
+| 6 | AL-06 | High | Deeply underwater accounts are economically impossible to liquidate |
+| 7 | AL-07 | High | A proxy deployed without atomic initialization can be taken over |
+| 8 | AL-08 | Medium | Borrow signatures can be replayed indefinitely |
+| 9 | AL-09 | Medium | The configured stETH/USD feed is not a wstETH/USD price |
+| 10 | AL-10 | Medium | Vault accounting trusts nominal transfers and is incompatible with planned token types |
+| 11 | AL-11 | Medium | External token calls make withdrawals reentrant for future callback-capable collateral |
+| 12 | AL-12 | Low | Full repayment can leave irreducible debt dust |
+| 13 | AL-13 | Low | The borrower registry can be grown until batch liquidation no longer fits in a block |
+
+## Findings
+
+### AL-01 — Anyone can replace the proxy implementation
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no access control and writes directly to the ERC-1967 implementation slot. Because calls reach it through `MarketProxy`, any account can point the live proxy at attacker-controlled code. That code can transfer all USDC held by the proxy, manipulate or erase every debt position, and use the market's authority over `CollateralVault` to seize every user's collateral. The attacker gets all protocol liquidity and all deposited collateral; users and the treasury can lose everything.
+
+**Fix:** Restrict upgrades to a timelocked governance/admin authority, use a reviewed UUPS implementation (including `onlyProxy`, implementation compatibility checks, and `_authorizeUpgrade`), and reject zero/non-contract implementations. Test that direct calls, non-admin proxy calls, and incompatible implementations revert. Consider a multisig plus timelock for production upgrades.
+
+### AL-02 — Anyone can replace the oracle and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no `onlyOwner` modifier. An attacker can deploy an oracle-shaped contract that reports an arbitrarily high wstETH price and/or an arbitrarily low USDC price, set it as the market oracle, deposit a negligible amount of wstETH, and borrow the proxy's entire seeded USDC balance. The attacker gets the treasury's USDC while leaving debt backed by almost no real collateral. Existing positions can also be forced into liquidation with attacker-selected prices.
+
+**Fix:** Add `onlyOwner`, reject the zero address and non-contract addresses, and make oracle changes timelocked. Validate the complete proposed feed configuration before activation. A two-step propose/accept process with an emergency pause limits both key compromise and configuration mistakes.
+
+### AL-03 — Anyone can rewrite the liquidation boundary or halt core operations
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+`setLiquidationThreshold` is also unauthenticated and has no bounds. Setting it to zero makes every debt position unhealthy, letting the attacker liquidate borrowers and collect the 5% bonus even though prices did not move. Setting it above `BPS` permits positions up to 100% LTV under the current health-factor arithmetic, leaving the treasury exposed to immediate bad debt after a small adverse price move. A sufficiently large value can instead make health-factor multiplication overflow, blocking borrowing, liquidation, and collateral withdrawals for indebted users. The attacker gets liquidation bonuses or can hold core market operations hostage; borrowers lose collateral and the treasury bears newly unsafe debt.
+
+**Fix:** Add `onlyOwner`, constrain the threshold to a governance-approved safe range no greater than `BPS`, and timelock changes. Apply equivalent explicit bounds to `borrowRate` and other economic parameters so a privileged configuration error cannot overflow accrual or destroy solvency.
+
+### AL-04 — Divide-before-multiply makes the effective maximum LTV approximately 50%
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression `collateralValueUsd(user) / debtUsd` performs integer division before applying the threshold and WAD scale. Every collateral-to-debt ratio from 1.00 up to 1.999... is truncated to `1`, producing a health factor of `0.8e18`; the position only becomes healthy when the ratio reaches `2`. Thus the documented 80% threshold (125% minimum collateral ratio) behaves as an approximately 50% maximum LTV with a large discontinuity.
+
+A user borrowing at 50% LTV can become liquidatable after the first positive interest accrual, despite virtually no price movement. A liquidator gets the 5% bonus and the user unexpectedly loses that collateral. Users between 50% and the advertised 80% LTV cannot borrow at all.
+
+**Fix:** Multiply before dividing, for example `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`, using full-precision `mulDiv` to avoid overflow and define rounding direction deliberately. Add boundary tests immediately below, at, and above 80% LTV and tests after one accrual interval.
+
+### AL-05 — Oracle accepts stale prices and ignores the Arbitrum sequencer status
+
+**Severity:** High  
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle calls `latestAnswer()` and does not inspect round timestamps, round completeness, or answer sign. It also has no Arbitrum sequencer-uptime check or recovery grace period. During an outage, feed disruption, or delayed update, borrowing and liquidation continue against an old price. An attacker can borrow excess USDC when collateral has fallen but the stored answer has not; conversely, liquidators can seize users after the true price has recovered. The attacker or liquidator gets USDC or discounted collateral, while the treasury or borrower takes the loss. A negative answer is cast to a huge unsigned integer rather than rejected (and will commonly cause downstream overflow/reverts), creating additional denial-of-service behavior.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. On Arbitrum, check Chainlink's sequencer-uptime feed, reject while the sequencer is down, and enforce a grace period after it returns. Pause new borrowing when price validity cannot be established; choose and document the desired liquidation behavior during oracle failure.
+
+### AL-06 — Deeply underwater accounts are economically impossible to liquidate
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket._liquidate`
+
+Liquidation is all-or-nothing: the caller must transfer the user's entire debt before collateral is seized. If a fast price move makes collateral worth less than the debt, the liquidator pays more USDC than the collateral received and rationally will not call. For example, a position with 100 USDC of debt and 70 USD of collateral requires the liquidator to spend 100 USDC to receive at most 70 USD. The market keeps the bad debt in accounting and the treasury cannot recover the shortfall. `liquidateAll` does not solve the incentive failure.
+
+**Fix:** Implement bounded partial liquidations with a close factor and calculate repayable debt from available collateral after applying the bonus. Cap seizure to the user's balance, define bad-debt recognition/socialization explicitly, and provide an incentive or reserve mechanism for terminal bad debt. Add crash and thin-liquidity scenarios where collateral falls below debt.
+
+### AL-07 — A proxy deployed without atomic initialization can be taken over
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.initialize`, `MarketProxy.constructor`
+
+`initialize` is callable by anyone until the proxy's `initialized` flag is set, while the proxy constructor permits empty `initData`. If deployment is split into “deploy proxy, then initialize,” a searcher can initialize first and become owner. Once AL-01 through AL-03 are fixed, that owner still controls collateral listing, rates, and any owner-gated upgrade/oracle functions added by the fixes. The searcher can configure the market for theft or permanently deny the intended administrator control.
+
+**Fix:** Require non-empty, successful initialization data in the proxy constructor and deploy/initialize atomically. Use a standard initializer pattern, disable initializers in the implementation constructor, validate every initialization address (including nonzero owner and contract addresses), and assert post-deployment state in the deployment script before funding the market.
+
+### AL-08 — Borrow signatures can be replayed indefinitely
+
+**Severity:** Medium  
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount; it has neither a nonce nor a deadline. Anyone who sees one valid signature can submit it repeatedly until the account reaches its borrowing limit or market liquidity runs out. The USDC is sent to the borrower, so the relayer does not directly receive it, but an unwanted repeated loan can move the borrower to the liquidation boundary; after interest or a price move, liquidators receive the bonus and the borrower loses collateral. The borrower has no way to revoke an exposed signature.
+
+**Fix:** Include a per-borrower nonce and deadline in the EIP-712 struct, consume the nonce before external calls, reject expired signatures, and use a strict ECDSA recovery library that rejects malleable signatures and invalid `v`/zero signers. Consider signing a recipient if delegated borrowing is intended to direct funds elsewhere.
+
+### AL-09 — The configured stETH/USD feed is not a wstETH/USD price
+
+**Severity:** Medium  
+**Contract / function:** Deployment configuration; `PriceOracle.getPrice`, `LendingMarket.collateralValueUsd`
+
+The README lists wstETH as the collateral but explicitly configures an stETH/USD feed. One wstETH represents a changing amount of stETH, so treating the stETH price as the price of one wstETH omits the wrapper exchange rate. At current positive staking accrual this understates collateral value: users receive less borrowing capacity and can be liquidated earlier than the documented risk parameters imply, transferring an unnecessary liquidation bonus to liquidators. More generally, using a feed for a different unit can produce unsafe valuation if the conversion moves in the opposite direction.
+
+**Fix:** Price wstETH in matching units: use an appropriate wstETH/USD feed, or combine stETH/USD with the on-chain wstETH-to-stETH conversion using carefully matched decimals and independent freshness checks. Add a deployment assertion that feed descriptions/units match each listed asset and a fork test against the exact Arbitrum addresses.
+
+### AL-10 — Vault accounting trusts nominal transfers and is incompatible with planned token types
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+All ERC-20 return values are ignored, and deposits credit the requested `amount` rather than the balance actually received. A false-returning or fee-on-transfer collateral can therefore create accounting claims without corresponding assets; an attacker can borrow real USDC against the fictitious balance. Rebasing collateral, which the roadmap explicitly contemplates, also makes fixed per-user nominal balances diverge from the vault's actual holdings, allocating gains incorrectly or making withdrawals insolvent. With a false-returning debt token, repayments/liquidations could erase debt without payment, although the launch USDC is not expected to behave that way.
+
+**Fix:** Use safe-transfer wrappers and verify balance deltas for deposits. Define an adapter/share-accounting interface for yield-bearing and rebasing assets rather than listing them through the current raw ERC-20 path. Maintain per-asset invariants tying total user shares to custody balances, and reject fee-on-transfer assets unless the accounting intentionally supports them.
+
+### AL-11 — External token calls make withdrawals reentrant for future callback-capable collateral
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.withdraw`
+
+`withdraw` transfers tokens before reducing the user's recorded balance. A listed token that invokes receiver callbacks can reenter `withdraw` while the old balance is still recorded and withdraw the same collateral repeatedly, draining that token from the vault. The attacker receives other users' custody balance of that token. The announced launch assets are not expected to callback this way, but the unrestricted future listing mechanism makes this a material expansion hazard.
+
+**Fix:** Follow checks-effects-interactions: decrement accounting before transfer, then perform the health check and token transfer (a revert rolls all state back). Add a reentrancy guard around vault entry points and only list assets after behavioral review. Test with an adversarial callback token.
+
+### AL-12 — Full repayment can leave irreducible debt dust
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Debt is rounded down, and repayment subtracts another rounded-down conversion from amount to principal. Paying the displayed full debt can therefore leave one or more principal units. At sufficiently small balances, a user can transfer the displayed debt while `amount * WAD / borrowIndex` rounds to zero, so the payment reduces no principal. The market receives extra USDC while the user retains debt dust, may need repeated repayments, and may be unable to cleanly close accounting.
+
+**Fix:** If `amount == debtOf(user)`, set principal to zero explicitly. Otherwise use a documented rounding policy that makes debt reduction consistent with amount paid, and test minimum-unit USDC debt across a range of borrow-index values.
+
+### AL-13 — The borrower registry can be grown until batch liquidation no longer fits in a block
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to a new loan appends the address to `borrowers`, but entries are never removed or deduplicated permanently. A user can cycle borrow/repay (or use many addresses) to grow the array. `liquidateAll` eventually exceeds the block gas limit, so the keeper loses the advertised batch sweep after a large price move. Individual `liquidate` calls remain available, limiting the direct loss, but delayed liquidations increase bad-debt risk.
+
+**Fix:** Do not iterate over an unbounded on-chain borrower set. Use off-chain indexing plus individual/bounded-batch liquidation, or accept a caller-supplied list with a strict maximum. If a registry is retained, track membership and remove closed positions without creating duplicate historical entries.
+
+## Deployment recommendation
+
+Do not fund or open the proxy until all critical and high findings are fixed and covered by unit, invariant, fuzz, and Arbitrum-fork tests. In particular, assert upgrade/oracle/parameter authorization, atomic initialization, oracle failure handling, exact 80% health-factor boundaries, liquidation incentives through a severe wstETH drawdown, and conservation of USDC and collateral across every state transition.

codex
Created [AUDIT-REPORT.md](/tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001/AUDIT-REPORT.md).

It documents 13 ranked findings: 2 critical, 5 high, 4 medium, and 2 low. `forge build` succeeded, `src/` remains unchanged, and `AUDIT-REPORT.md` is the only workspace file added.
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..53732f6fa81229d09b9e84f6f31bda1a332e228c
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,152 @@
+# ArbiLend Security Review
+
+Date: 2026-09-02  
+Scope: `README.md` and all Solidity files under `src/`  
+Target: Arbitrum One, wstETH collateral, native USDC debt asset
+
+## Executive summary
+
+ArbiLend is **not safe to deploy in its current form**. Two unauthenticated administrative paths let any account take all seeded USDC or replace the market implementation. The health-factor calculation also changes the intended 80% liquidation threshold into a discontinuous effective threshold near 50%, allowing positions to become liquidatable immediately after a very small amount of interest accrues. These are release blockers.
+
+The review found 2 critical, 5 high, 4 medium, and 2 low-severity issues. The team should address findings AL-01 through AL-07 before deployment, then add tests covering every exploit and boundary described below. This was a manual source review supplemented by a successful `forge build`; no test suite was present.
+
+| Rank | ID | Severity | Finding |
+| ---: | --- | --- | --- |
+| 1 | AL-01 | Critical | Anyone can replace the proxy implementation |
+| 2 | AL-02 | Critical | Anyone can replace the oracle and drain seeded USDC |
+| 3 | AL-03 | High | Anyone can rewrite the liquidation boundary or halt core operations |
+| 4 | AL-04 | High | Divide-before-multiply makes the effective maximum LTV approximately 50% |
+| 5 | AL-05 | High | Oracle accepts stale prices and ignores the Arbitrum sequencer status |
+| 6 | AL-06 | High | Deeply underwater accounts are economically impossible to liquidate |
+| 7 | AL-07 | High | A proxy deployed without atomic initialization can be taken over |
+| 8 | AL-08 | Medium | Borrow signatures can be replayed indefinitely |
+| 9 | AL-09 | Medium | The configured stETH/USD feed is not a wstETH/USD price |
+| 10 | AL-10 | Medium | Vault accounting trusts nominal transfers and is incompatible with planned token types |
+| 11 | AL-11 | Medium | External token calls make withdrawals reentrant for future callback-capable collateral |
+| 12 | AL-12 | Low | Full repayment can leave irreducible debt dust |
+| 13 | AL-13 | Low | The borrower registry can be grown until batch liquidation no longer fits in a block |
+
+## Findings
+
+### AL-01 — Anyone can replace the proxy implementation
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.upgradeTo`
+
+`upgradeTo` has no access control and writes directly to the ERC-1967 implementation slot. Because calls reach it through `MarketProxy`, any account can point the live proxy at attacker-controlled code. That code can transfer all USDC held by the proxy, manipulate or erase every debt position, and use the market's authority over `CollateralVault` to seize every user's collateral. The attacker gets all protocol liquidity and all deposited collateral; users and the treasury can lose everything.
+
+**Fix:** Restrict upgrades to a timelocked governance/admin authority, use a reviewed UUPS implementation (including `onlyProxy`, implementation compatibility checks, and `_authorizeUpgrade`), and reject zero/non-contract implementations. Test that direct calls, non-admin proxy calls, and incompatible implementations revert. Consider a multisig plus timelock for production upgrades.
+
+### AL-02 — Anyone can replace the oracle and drain seeded USDC
+
+**Severity:** Critical  
+**Contract / function:** `LendingMarket.setOracle`
+
+`setOracle` has no `onlyOwner` modifier. An attacker can deploy an oracle-shaped contract that reports an arbitrarily high wstETH price and/or an arbitrarily low USDC price, set it as the market oracle, deposit a negligible amount of wstETH, and borrow the proxy's entire seeded USDC balance. The attacker gets the treasury's USDC while leaving debt backed by almost no real collateral. Existing positions can also be forced into liquidation with attacker-selected prices.
+
+**Fix:** Add `onlyOwner`, reject the zero address and non-contract addresses, and make oracle changes timelocked. Validate the complete proposed feed configuration before activation. A two-step propose/accept process with an emergency pause limits both key compromise and configuration mistakes.
+
+### AL-03 — Anyone can rewrite the liquidation boundary or halt core operations
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.setLiquidationThreshold`
+
+`setLiquidationThreshold` is also unauthenticated and has no bounds. Setting it to zero makes every debt position unhealthy, letting the attacker liquidate borrowers and collect the 5% bonus even though prices did not move. Setting it above `BPS` permits positions up to 100% LTV under the current health-factor arithmetic, leaving the treasury exposed to immediate bad debt after a small adverse price move. A sufficiently large value can instead make health-factor multiplication overflow, blocking borrowing, liquidation, and collateral withdrawals for indebted users. The attacker gets liquidation bonuses or can hold core market operations hostage; borrowers lose collateral and the treasury bears newly unsafe debt.
+
+**Fix:** Add `onlyOwner`, constrain the threshold to a governance-approved safe range no greater than `BPS`, and timelock changes. Apply equivalent explicit bounds to `borrowRate` and other economic parameters so a privileged configuration error cannot overflow accrual or destroy solvency.
+
+### AL-04 — Divide-before-multiply makes the effective maximum LTV approximately 50%
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.healthFactor`
+
+The expression `collateralValueUsd(user) / debtUsd` performs integer division before applying the threshold and WAD scale. Every collateral-to-debt ratio from 1.00 up to 1.999... is truncated to `1`, producing a health factor of `0.8e18`; the position only becomes healthy when the ratio reaches `2`. Thus the documented 80% threshold (125% minimum collateral ratio) behaves as an approximately 50% maximum LTV with a large discontinuity.
+
+A user borrowing at 50% LTV can become liquidatable after the first positive interest accrual, despite virtually no price movement. A liquidator gets the 5% bonus and the user unexpectedly loses that collateral. Users between 50% and the advertised 80% LTV cannot borrow at all.
+
+**Fix:** Multiply before dividing, for example `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`, using full-precision `mulDiv` to avoid overflow and define rounding direction deliberately. Add boundary tests immediately below, at, and above 80% LTV and tests after one accrual interval.
+
+### AL-05 — Oracle accepts stale prices and ignores the Arbitrum sequencer status
+
+**Severity:** High  
+**Contract / function:** `PriceOracle.getPrice`
+
+The oracle calls `latestAnswer()` and does not inspect round timestamps, round completeness, or answer sign. It also has no Arbitrum sequencer-uptime check or recovery grace period. During an outage, feed disruption, or delayed update, borrowing and liquidation continue against an old price. An attacker can borrow excess USDC when collateral has fallen but the stored answer has not; conversely, liquidators can seize users after the true price has recovered. The attacker or liquidator gets USDC or discounted collateral, while the treasury or borrower takes the loss. A negative answer is cast to a huge unsigned integer rather than rejected (and will commonly cause downstream overflow/reverts), creating additional denial-of-service behavior.
+
+**Fix:** Use `latestRoundData()` and require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. On Arbitrum, check Chainlink's sequencer-uptime feed, reject while the sequencer is down, and enforce a grace period after it returns. Pause new borrowing when price validity cannot be established; choose and document the desired liquidation behavior during oracle failure.
+
+### AL-06 — Deeply underwater accounts are economically impossible to liquidate
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.liquidate`, `LendingMarket._liquidate`
+
+Liquidation is all-or-nothing: the caller must transfer the user's entire debt before collateral is seized. If a fast price move makes collateral worth less than the debt, the liquidator pays more USDC than the collateral received and rationally will not call. For example, a position with 100 USDC of debt and 70 USD of collateral requires the liquidator to spend 100 USDC to receive at most 70 USD. The market keeps the bad debt in accounting and the treasury cannot recover the shortfall. `liquidateAll` does not solve the incentive failure.
+
+**Fix:** Implement bounded partial liquidations with a close factor and calculate repayable debt from available collateral after applying the bonus. Cap seizure to the user's balance, define bad-debt recognition/socialization explicitly, and provide an incentive or reserve mechanism for terminal bad debt. Add crash and thin-liquidity scenarios where collateral falls below debt.
+
+### AL-07 — A proxy deployed without atomic initialization can be taken over
+
+**Severity:** High  
+**Contract / function:** `LendingMarket.initialize`, `MarketProxy.constructor`
+
+`initialize` is callable by anyone until the proxy's `initialized` flag is set, while the proxy constructor permits empty `initData`. If deployment is split into “deploy proxy, then initialize,” a searcher can initialize first and become owner. Once AL-01 through AL-03 are fixed, that owner still controls collateral listing, rates, and any owner-gated upgrade/oracle functions added by the fixes. The searcher can configure the market for theft or permanently deny the intended administrator control.
+
+**Fix:** Require non-empty, successful initialization data in the proxy constructor and deploy/initialize atomically. Use a standard initializer pattern, disable initializers in the implementation constructor, validate every initialization address (including nonzero owner and contract addresses), and assert post-deployment state in the deployment script before funding the market.
+
+### AL-08 — Borrow signatures can be replayed indefinitely
+
+**Severity:** Medium  
+**Contract / function:** `LendingMarket.borrowWithSig`
+
+The signed struct contains only borrower and amount; it has neither a nonce nor a deadline. Anyone who sees one valid signature can submit it repeatedly until the account reaches its borrowing limit or market liquidity runs out. The USDC is sent to the borrower, so the relayer does not directly receive it, but an unwanted repeated loan can move the borrower to the liquidation boundary; after interest or a price move, liquidators receive the bonus and the borrower loses collateral. The borrower has no way to revoke an exposed signature.
+
+**Fix:** Include a per-borrower nonce and deadline in the EIP-712 struct, consume the nonce before external calls, reject expired signatures, and use a strict ECDSA recovery library that rejects malleable signatures and invalid `v`/zero signers. Consider signing a recipient if delegated borrowing is intended to direct funds elsewhere.
+
+### AL-09 — The configured stETH/USD feed is not a wstETH/USD price
+
+**Severity:** Medium  
+**Contract / function:** Deployment configuration; `PriceOracle.getPrice`, `LendingMarket.collateralValueUsd`
+
+The README lists wstETH as the collateral but explicitly configures an stETH/USD feed. One wstETH represents a changing amount of stETH, so treating the stETH price as the price of one wstETH omits the wrapper exchange rate. At current positive staking accrual this understates collateral value: users receive less borrowing capacity and can be liquidated earlier than the documented risk parameters imply, transferring an unnecessary liquidation bonus to liquidators. More generally, using a feed for a different unit can produce unsafe valuation if the conversion moves in the opposite direction.
+
+**Fix:** Price wstETH in matching units: use an appropriate wstETH/USD feed, or combine stETH/USD with the on-chain wstETH-to-stETH conversion using carefully matched decimals and independent freshness checks. Add a deployment assertion that feed descriptions/units match each listed asset and a fork test against the exact Arbitrum addresses.
+
+### AL-10 — Vault accounting trusts nominal transfers and is incompatible with planned token types
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.deposit`, `CollateralVault.withdraw`, `CollateralVault.seize`; `LendingMarket.repay`, `LendingMarket._borrow`, `LendingMarket._liquidate`
+
+All ERC-20 return values are ignored, and deposits credit the requested `amount` rather than the balance actually received. A false-returning or fee-on-transfer collateral can therefore create accounting claims without corresponding assets; an attacker can borrow real USDC against the fictitious balance. Rebasing collateral, which the roadmap explicitly contemplates, also makes fixed per-user nominal balances diverge from the vault's actual holdings, allocating gains incorrectly or making withdrawals insolvent. With a false-returning debt token, repayments/liquidations could erase debt without payment, although the launch USDC is not expected to behave that way.
+
+**Fix:** Use safe-transfer wrappers and verify balance deltas for deposits. Define an adapter/share-accounting interface for yield-bearing and rebasing assets rather than listing them through the current raw ERC-20 path. Maintain per-asset invariants tying total user shares to custody balances, and reject fee-on-transfer assets unless the accounting intentionally supports them.
+
+### AL-11 — External token calls make withdrawals reentrant for future callback-capable collateral
+
+**Severity:** Medium  
+**Contract / function:** `CollateralVault.withdraw`
+
+`withdraw` transfers tokens before reducing the user's recorded balance. A listed token that invokes receiver callbacks can reenter `withdraw` while the old balance is still recorded and withdraw the same collateral repeatedly, draining that token from the vault. The attacker receives other users' custody balance of that token. The announced launch assets are not expected to callback this way, but the unrestricted future listing mechanism makes this a material expansion hazard.
+
+**Fix:** Follow checks-effects-interactions: decrement accounting before transfer, then perform the health check and token transfer (a revert rolls all state back). Add a reentrancy guard around vault entry points and only list assets after behavioral review. Test with an adversarial callback token.
+
+### AL-12 — Full repayment can leave irreducible debt dust
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket.repay`, `LendingMarket.debtOf`
+
+Debt is rounded down, and repayment subtracts another rounded-down conversion from amount to principal. Paying the displayed full debt can therefore leave one or more principal units. At sufficiently small balances, a user can transfer the displayed debt while `amount * WAD / borrowIndex` rounds to zero, so the payment reduces no principal. The market receives extra USDC while the user retains debt dust, may need repeated repayments, and may be unable to cleanly close accounting.
+
+**Fix:** If `amount == debtOf(user)`, set principal to zero explicitly. Otherwise use a documented rounding policy that makes debt reduction consistent with amount paid, and test minimum-unit USDC debt across a range of borrow-index values.
+
+### AL-13 — The borrower registry can be grown until batch liquidation no longer fits in a block
+
+**Severity:** Low  
+**Contract / function:** `LendingMarket._borrow`, `LendingMarket.liquidateAll`
+
+Every transition from zero principal to a new loan appends the address to `borrowers`, but entries are never removed or deduplicated permanently. A user can cycle borrow/repay (or use many addresses) to grow the array. `liquidateAll` eventually exceeds the block gas limit, so the keeper loses the advertised batch sweep after a large price move. Individual `liquidate` calls remain available, limiting the direct loss, but delayed liquidations increase bad-debt risk.
+
+**Fix:** Do not iterate over an unbounded on-chain borrower set. Use off-chain indexing plus individual/bounded-batch liquidation, or accept a caller-supplied list with a strict maximum. If a registry is retained, track membership and remove closed positions without creating duplicate historical entries.
+
+## Deployment recommendation
+
+Do not fund or open the proxy until all critical and high findings are fixed and covered by unit, invariant, fuzz, and Arbitrum-fork tests. In particular, assert upgrade/oracle/parameter authorization, atomic initialization, oracle failure handling, exact 80% health-factor boundaries, liquidation incentives through a severe wstETH drawdown, and conservation of USDC and collateral across every state transition.

2026-09-02T15:59:30.872890Z  WARN codex_core::tasks: failed to flush rollout after emitting terminal turn event: thread 01a062d2-ff07-79b0-84fa-53d04fa98222 not found
tokens used
37,349
```

## final message

Created [AUDIT-REPORT.md](/tmp/ethskills-audit-eval/2026-09-02T155308Z-codex-no-skill-3/audit-goal-001/AUDIT-REPORT.md).

It documents 13 ranked findings: 2 critical, 5 high, 4 medium, and 2 low. `forge build` succeeded, `src/` remains unchanged, and `AUDIT-REPORT.md` is the only workspace file added.

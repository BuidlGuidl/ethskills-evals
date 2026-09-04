# Executor transcript — 2026-09-04T125948Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06c81-498c-7f90-aa15-2ddd5ab32cb8
--------
user
Build the onchain piece of a small borrowing market for Ethereum mainnet.

How it works: a user locks WETH as collateral and can borrow USDC against it,
up to 70% of what their collateral is worth. Debt accrues interest at a flat
annual rate — the rate model is not the point, keep it simple. If a position's
debt passes 85% of its collateral value the position is liquidatable: anyone
can repay part of the USDC debt and take the matching WETH plus a 5% bonus.
Borrowers can repay and withdraw collateral at any time while healthy.

Work in this directory:
  - set up a foundry project and implement the contracts we would deploy
  - make sure it compiles with forge build
  - leave a NOTES.md covering how a position's health is computed, what a
    liquidator has to do, and what an operator has to get right when
    deploying this to mainnet

codex
I’m building a Foundry-based Ethereum borrowing market here, including compile verification and deployment/operator notes. I’ll inspect the workspace first, then read the Solidity security skill before implementing contracts.
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
exec
/bin/bash -lc 'rg --files -n' in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 succeeded in 12ms:
/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002

 succeeded in 13ms:
TASK.md
package.json

exec
/bin/bash -lc "sed -n '1,220p' /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/.agents/skills/security/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 succeeded in 7ms:
---
name: security
description: Use when designing, implementing, or reviewing Solidity contracts that custody assets, account for shares or debt, consume price oracles, verify signatures, integrate ERC-20s, or use upgradeable proxies; also use for a pre-deployment security review. Not for test-suite design (`testing`) or a full multi-domain audit (`audit`).
---

# Smart Contract Security

Treat every external token, price, signature, callback, and privileged caller as adversarial. Prefer audited OpenZeppelin primitives over hand-rolled implementations, but verify the installed library version and the assumptions around each primitive.

## Asset accounting

- Keep units explicit. ERC-20 decimals and oracle decimals vary; normalize every quantity to one documented scale before comparing collateral, debt, fees, or shares. Multiply before dividing and use full-precision `mulDiv` where intermediate overflow or rounding matters.
- For arbitrary ERC-20s, use `SafeERC20.safeTransfer` and `safeTransferFrom`. Credit deposits from the contract's balance delta, not the requested amount, or reject tokens whose received amount differs. Fee-on-transfer and rebasing tokens otherwise break custody accounting.
- On OpenZeppelin Contracts v5, use `SafeERC20.forceApprove` when an allowance may already be nonzero. `safeApprove` was removed. Keep approvals exact or bounded and clear leftovers when practical.
- Apply checks-effects-interactions and a reentrancy guard to value-moving entry points. Update shares, debt, and other accounting before external calls.

For a vault or receipt-token design, start from OpenZeppelin `ERC4626`. A hand-rolled vault must defend its empty state against first-depositor donation/inflation attacks with virtual assets and shares or another explicit mitigation. Test direct donations and rounding at small deposits; never use an unprotected `assets * totalSupply / totalAssets` conversion with a special 1:1 empty-vault path.

## Prices and liquidations

Never use a DEX spot read (`slot0`, reserves, balances, or a current quote) for collateral, borrowing, minting, or liquidation decisions. Pool depth does not fix atomic manipulation: flash-borrowed capital can move the price, exploit the dependent action, unwind, and repay inside one transaction before arbitrage can intervene.

Use a manipulation-resistant push feed for high-value decisions, or a meaningful TWAP when its weaker guarantees fit the risk. For every feed:

- require a positive answer;
- validate `updatedAt` against a per-feed maximum age derived from that feed's published heartbeat plus a justified margin—never one global hardcoded timeout;
- handle feed and token decimals explicitly;
- define behavior for sequencer downtime where relevant; and
- bound liquidation incentives and any swap's minimum output.

## Signatures and replay protection

Use EIP-712 and OpenZeppelin's implementation rather than assembling signature recovery from scratch. Bind the signed action to the intended contract and chain, consume a signer-scoped nonce, enforce a deadline, and update replay state before moving assets.

If a domain separator is cached, also cache the deployment chain id and re-derive the separator whenever `block.chainid` differs. An immutable separator computed only at deployment becomes stale after a fork. OpenZeppelin `EIP712` handles this invalidation.

## Upgradeability and authority

Use an upgradeable design only when post-deployment changes are required. With proxies:

- initialize through an initializer and disable initializers on the implementation;
- use the upgradeable variants of inherited contracts;
- preserve inheritance order and storage layout—append variables only; never insert, delete, reorder, or change an existing type;
- run the framework's storage-layout compatibility check before every upgrade; and
- put upgrade and emergency authority behind the intended multisig or timelock, not a single EOA.

Every privileged state change needs explicit access control. Make pause, upgrade, rescue, oracle-update, and parameter-update powers visible in the threat model; a safety switch controlled by one key is also a censorship and compromise risk. Never `delegatecall` to a user-selected target.

## Before deployment

- Trace assets, shares, debt, approvals, callbacks, and privilege through every success and failure path.
- Test zero, maximum, rounding, donation, fee-on-transfer, stale-price, replay, reentrancy, and unauthorized-caller cases that apply.
- Run unit, fuzz, invariant, and pinned-fork tests appropriate to the integrations; use the `testing` skill for suite design.
- Run static analysis and resolve every high or medium finding or document why it is a false positive.
- Verify deployed bytecode and transfer production authority to the intended multisig or timelock.
- For a comprehensive pre-deployment review across domains, use the `audit` skill.

codex
I’ve confirmed the workspace is basically empty apart from the task file, so I’ll scaffold the Foundry project and implement the market from scratch. The security constraints here are straightforward: normalize oracle/token units explicitly, use CEI plus reentrancy protection, and avoid spot-price assumptions.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
exec
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
exec
/bin/bash -lc "sed -n '1,220p' package.json" in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 succeeded in 6ms:
Build the onchain piece of a small borrowing market for Ethereum mainnet.

How it works: a user locks WETH as collateral and can borrow USDC against it,
up to 70% of what their collateral is worth. Debt accrues interest at a flat
annual rate — the rate model is not the point, keep it simple. If a position's
debt passes 85% of its collateral value the position is liquidatable: anyone
can repay part of the USDC debt and take the matching WETH plus a 5% bonus.
Borrowers can repay and withdraw collateral at any time while healthy.

Work in this directory:
  - set up a foundry project and implement the contracts we would deploy
  - make sure it compiles with forge build
  - leave a NOTES.md covering how a position's health is computed, what a
    liquidator has to do, and what an operator has to get right when
    deploying this to mainnet

 succeeded in 13ms:
{
  "name": "eval-workspace",
  "private": true
}

 succeeded in 17ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

codex
Plan:
1. Scaffold a minimal Foundry layout and dependency setup for OpenZeppelin.
2. Implement the borrowing market contract plus the oracle interface and deployment config.
3. Add operator notes in `NOTES.md` covering health, liquidation flow, and mainnet deployment constraints.
4. Run `forge build` and fix anything that fails until the project compiles cleanly.
  → Scaffold Foundry project structure and dependencies
  • Implement borrowing market contracts and interfaces
  • Write NOTES.md with health, liquidation, and deployment guidance
  • Run forge build and resolve compile issues
codex
I have the structure and dependency choices now. Next I’m creating the Foundry layout manually and pulling in OpenZeppelin so the market uses standard token and reentrancy primitives rather than hand-rolled copies.
exec
/bin/bash -lc 'mkdir -p src script test lib' in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 succeeded in 2ms:
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit' in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 exited 2 in 0ms:
codex
`forge install` on this Foundry version doesn’t support `--no-commit`. I’m retrying with the version-compatible flags and then I’ll write the market and notes.
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts@v5.0.2' in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 exited 1 in 82ms:
Installing openzeppelin-contracts in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: v5.0.2)
fatal: could not create directory '/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/.git/modules/lib/openzeppelin-contracts'
Error: git submodule exited with code 128

exec
/bin/bash -lc 'npm install @openzeppelin/contracts@5.0.2' in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
exec
/bin/bash -lc "forge install --help | sed -n '1,220p'" in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 succeeded in 6ms:
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

 exited 1 in 1501ms:
npm error code EROFS
npm error syscall open
npm error path /home/damu/.npm/_cacache/tmp/d84ffdf8
npm error errno EROFS
npm error rofs Invalid response body while trying to fetch https://registry.npmjs.org/@openzeppelin%2fcontracts: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/d84ffdf8'
npm error rofs Often virtualized file systems, or other file systems
npm error rofs that don't support symlinks, give this error.
npm error Log files were not written due to an error writing to the directory: /home/damu/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal

codex
The cache path blocked the `npm` fallback, but this Foundry version supports `forge install --no-git`, which avoids writing submodule state into `.git`. I’m using that path so we still get the audited OpenZeppelin dependency cleanly.
exec
/bin/bash -lc 'forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.0.2' in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 succeeded in 15015ms:
Installing openzeppelin-contracts in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: v5.0.2)
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts'...
Submodule 'lib/erc4626-tests' (https://github.com/a16z/erc4626-tests.git) registered for path 'lib/erc4626-tests'
Submodule 'lib/forge-std' (https://github.com/foundry-rs/forge-std) registered for path 'lib/forge-std'
Submodule 'lib/halmos-cheatcodes' (https://github.com/a16z/halmos-cheatcodes) registered for path 'lib/halmos-cheatcodes'
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts/lib/erc4626-tests'...
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts/lib/forge-std'...
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts/lib/halmos-cheatcodes'...
Submodule 'lib/ds-test' (https://github.com/dapphub/ds-test) registered for path 'lib/forge-std/lib/ds-test'
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/lib/openzeppelin-contracts/lib/forge-std/lib/ds-test'...
remote: Enumerating objects: 313, done.        
remote: Counting objects:   0% (1/171)        remote: Counting objects:   1% (2/171)        remote: Counting objects:   2% (4/171)        remote: Counting objects:   3% (6/171)        remote: Counting objects:   4% (7/171)        remote: Counting objects:   5% (9/171)        remote: Counting objects:   6% (11/171)        remote: Counting objects:   7% (12/171)        remote: Counting objects:   8% (14/171)        remote: Counting objects:   9% (16/171)        remote: Counting objects:  10% (18/171)        remote: Counting objects:  11% (19/171)        remote: Counting objects:  12% (21/171)        remote: Counting objects:  13% (23/171)        remote: Counting objects:  14% (24/171)        remote: Counting objects:  15% (26/171)        remote: Counting objects:  16% (28/171)        remote: Counting objects:  17% (30/171)        remote: Counting objects:  18% (31/171)        remote: Counting objects:  19% (33/171)        remote: Counting objects:  20% (35/171)        remote: Counting objects:  21% (36/171)        remote: Counting objects:  22% (38/171)        remote: Counting objects:  23% (40/171)        remote: Counting objects:  24% (42/171)        remote: Counting objects:  25% (43/171)        remote: Counting objects:  26% (45/171)        remote: Counting objects:  27% (47/171)        remote: Counting objects:  28% (48/171)        remote: Counting objects:  29% (50/171)        remote: Counting objects:  30% (52/171)        remote: Counting objects:  31% (54/171)        remote: Counting objects:  32% (55/171)        remote: Counting objects:  33% (57/171)        remote: Counting objects:  34% (59/171)        remote: Counting objects:  35% (60/171)        remote: Counting objects:  36% (62/171)        remote: Counting objects:  37% (64/171)        remote: Counting objects:  38% (65/171)        remote: Counting objects:  39% (67/171)        remote: Counting objects:  40% (69/171)        remote: Counting objects:  41% (71/171)        remote: Counting objects:  42% (72/171)        remote: Counting objects:  43% (74/171)        remote: Counting objects:  44% (76/171)        remote: Counting objects:  45% (77/171)        remote: Counting objects:  46% (79/171)        remote: Counting objects:  47% (81/171)        remote: Counting objects:  48% (83/171)        remote: Counting objects:  49% (84/171)        remote: Counting objects:  50% (86/171)        remote: Counting objects:  51% (88/171)        remote: Counting objects:  52% (89/171)        remote: Counting objects:  53% (91/171)        remote: Counting objects:  54% (93/171)        remote: Counting objects:  55% (95/171)        remote: Counting objects:  56% (96/171)        remote: Counting objects:  57% (98/171)        remote: Counting objects:  58% (100/171)        remote: Counting objects:  59% (101/171)        remote: Counting objects:  60% (103/171)        remote: Counting objects:  61% (105/171)        remote: Counting objects:  62% (107/171)        remote: Counting objects:  63% (108/171)        remote: Counting objects:  64% (110/171)        remote: Counting objects:  65% (112/171)        remote: Counting objects:  66% (113/171)        remote: Counting objects:  67% (115/171)        remote: Counting objects:  68% (117/171)        remote: Counting objects:  69% (118/171)        remote: Counting objects:  70% (120/171)        remote: Counting objects:  71% (122/171)        remote: Counting objects:  72% (124/171)        remote: Counting objects:  73% (125/171)        remote: Counting objects:  74% (127/171)        remote: Counting objects:  75% (129/171)        remote: Counting objects:  76% (130/171)        remote: Counting objects:  77% (132/171)        remote: Counting objects:  78% (134/171)        remote: Counting objects:  79% (136/171)        remote: Counting objects:  80% (137/171)        remote: Counting objects:  81% (139/171)        remote: Counting objects:  82% (141/171)        remote: Counting objects:  83% (142/171)        remote: Counting objects:  84% (144/171)        remote: Counting objects:  85% (146/171)        remote: Counting objects:  86% (148/171)        remote: Counting objects:  87% (149/171)        remote: Counting objects:  88% (151/171)        remote: Counting objects:  89% (153/171)        remote: Counting objects:  90% (154/171)        remote: Counting objects:  91% (156/171)        remote: Counting objects:  92% (158/171)        remote: Counting objects:  93% (160/171)        remote: Counting objects:  94% (161/171)        remote: Counting objects:  95% (163/171)        remote: Counting objects:  96% (165/171)        remote: Counting objects:  97% (166/171)        remote: Counting objects:  98% (168/171)        remote: Counting objects:  99% (170/171)        remote: Counting objects: 100% (171/171)        remote: Counting objects: 100% (171/171), done.        
remote: Compressing objects:   1% (1/79)        remote: Compressing objects:   2% (2/79)        remote: Compressing objects:   3% (3/79)        remote: Compressing objects:   5% (4/79)        remote: Compressing objects:   6% (5/79)        remote: Compressing objects:   7% (6/79)        remote: Compressing objects:   8% (7/79)        remote: Compressing objects:  10% (8/79)        remote: Compressing objects:  11% (9/79)        remote: Compressing objects:  12% (10/79)        remote: Compressing objects:  13% (11/79)        remote: Compressing objects:  15% (12/79)        remote: Compressing objects:  16% (13/79)        remote: Compressing objects:  17% (14/79)        remote: Compressing objects:  18% (15/79)        remote: Compressing objects:  20% (16/79)        remote: Compressing objects:  21% (17/79)        remote: Compressing objects:  22% (18/79)        remote: Compressing objects:  24% (19/79)        remote: Compressing objects:  25% (20/79)        remote: Compressing objects:  26% (21/79)        remote: Compressing objects:  27% (22/79)        remote: Compressing objects:  29% (23/79)        remote: Compressing objects:  30% (24/79)        remote: Compressing objects:  31% (25/79)        remote: Compressing objects:  32% (26/79)        remote: Compressing objects:  34% (27/79)        remote: Compressing objects:  35% (28/79)        remote: Compressing objects:  36% (29/79)        remote: Compressing objects:  37% (30/79)        remote: Compressing objects:  39% (31/79)        remote: Compressing objects:  40% (32/79)        remote: Compressing objects:  41% (33/79)        remote: Compressing objects:  43% (34/79)        remote: Compressing objects:  44% (35/79)        remote: Compressing objects:  45% (36/79)        remote: Compressing objects:  46% (37/79)        remote: Compressing objects:  48% (38/79)        remote: Compressing objects:  49% (39/79)        remote: Compressing objects:  50% (40/79)        remote: Compressing objects:  51% (41/79)        remote: Compressing objects:  53% (42/79)        remote: Compressing objects:  54% (43/79)        remote: Compressing objects:  55% (44/79)        remote: Compressing objects:  56% (45/79)        remote: Compressing objects:  58% (46/79)        remote: Compressing objects:  59% (47/79)        remote: Compressing objects:  60% (48/79)        remote: Compressing objects:  62% (49/79)        remote: Compressing objects:  63% (50/79)        remote: Compressing objects:  64% (51/79)        remote: Compressing objects:  65% (52/79)        remote: Compressing objects:  67% (53/79)        remote: Compressing objects:  68% (54/79)        remote: Compressing objects:  69% (55/79)        remote: Compressing objects:  70% (56/79)        remote: Compressing objects:  72% (57/79)        remote: Compressing objects:  73% (58/79)        remote: Compressing objects:  74% (59/79)        remote: Compressing objects:  75% (60/79)        remote: Compressing objects:  77% (61/79)        remote: Compressing objects:  78% (62/79)        remote: Compressing objects:  79% (63/79)        remote: Compressing objects:  81% (64/79)        remote: Compressing objects:  82% (65/79)        remote: Compressing objects:  83% (66/79)        remote: Compressing objects:  84% (67/79)        remote: Compressing objects:  86% (68/79)        remote: Compressing objects:  87% (69/79)        remote: Compressing objects:  88% (70/79)        remote: Compressing objects:  89% (71/79)        remote: Compressing objects:  91% (72/79)        remote: Compressing objects:  92% (73/79)        remote: Compressing objects:  93% (74/79)        remote: Compressing objects:  94% (75/79)        remote: Compressing objects:  96% (76/79)        remote: Compressing objects:  97% (77/79)        remote: Compressing objects:  98% (78/79)        remote: Compressing objects: 100% (79/79)        remote: Compressing objects: 100% (79/79), done.        
Receiving objects:   0% (1/313)Receiving objects:   1% (4/313)Receiving objects:   2% (7/313)Receiving objects:   3% (10/313)Receiving objects:   4% (13/313)Receiving objects:   5% (16/313)Receiving objects:   6% (19/313)Receiving objects:   7% (22/313)Receiving objects:   8% (26/313)Receiving objects:   9% (29/313)Receiving objects:  10% (32/313)Receiving objects:  11% (35/313)Receiving objects:  12% (38/313)Receiving objects:  13% (41/313)Receiving objects:  14% (44/313)Receiving objects:  15% (47/313)Receiving objects:  16% (51/313)Receiving objects:  17% (54/313)Receiving objects:  18% (57/313)Receiving objects:  19% (60/313)Receiving objects:  20% (63/313)Receiving objects:  21% (66/313)Receiving objects:  22% (69/313)Receiving objects:  23% (72/313)Receiving objects:  24% (76/313)Receiving objects:  25% (79/313)Receiving objects:  26% (82/313)Receiving objects:  27% (85/313)Receiving objects:  28% (88/313)Receiving objects:  29% (91/313)Receiving objects:  30% (94/313)Receiving objects:  31% (98/313)Receiving objects:  32% (101/313)Receiving objects:  33% (104/313)Receiving objects:  34% (107/313)Receiving objects:  35% (110/313)Receiving objects:  36% (113/313)Receiving objects:  37% (116/313)Receiving objects:  38% (119/313)Receiving objects:  39% (123/313)Receiving objects:  40% (126/313)Receiving objects:  41% (129/313)Receiving objects:  42% (132/313)Receiving objects:  43% (135/313)Receiving objects:  44% (138/313)Receiving objects:  45% (141/313)Receiving objects:  46% (144/313)Receiving objects:  47% (148/313)Receiving objects:  48% (151/313)Receiving objects:  49% (154/313)Receiving objects:  50% (157/313)Receiving objects:  51% (160/313)Receiving objects:  52% (163/313)Receiving objects:  53% (166/313)Receiving objects:  54% (170/313)Receiving objects:  55% (173/313)Receiving objects:  56% (176/313)Receiving objects:  57% (179/313)Receiving objects:  58% (182/313)Receiving objects:  59% (185/313)Receiving objects:  60% (188/313)Receiving objects:  61% (191/313)Receiving objects:  62% (195/313)Receiving objects:  63% (198/313)Receiving objects:  64% (201/313)Receiving objects:  65% (204/313)Receiving objects:  66% (207/313)Receiving objects:  67% (210/313)Receiving objects:  68% (213/313)Receiving objects:  69% (216/313)Receiving objects:  70% (220/313)Receiving objects:  71% (223/313)Receiving objects:  72% (226/313)Receiving objects:  73% (229/313)Receiving objects:  74% (232/313)Receiving objects:  75% (235/313)Receiving objects:  76% (238/313)Receiving objects:  77% (242/313)Receiving objects:  78% (245/313)Receiving objects:  79% (248/313)Receiving objects:  80% (251/313)Receiving objects:  81% (254/313)Receiving objects:  82% (257/313)Receiving objects:  83% (260/313)Receiving objects:  84% (263/313)Receiving objects:  85% (267/313)Receiving objects:  86% (270/313)Receiving objects:  87% (273/313)remote: Total 313 (delta 91), reused 132 (delta 83), pack-reused 142 (from 1)        
Receiving objects:  88% (276/313)Receiving objects:  89% (279/313)Receiving objects:  90% (282/313)Receiving objects:  91% (285/313)Receiving objects:  92% (288/313)Receiving objects:  93% (292/313)Receiving objects:  94% (295/313)Receiving objects:  95% (298/313)Receiving objects:  96% (301/313)Receiving objects:  97% (304/313)Receiving objects:  98% (307/313)Receiving objects:  99% (310/313)Receiving objects: 100% (313/313)Receiving objects: 100% (313/313), 71.35 KiB | 424.00 KiB/s, done.
Resolving deltas:   0% (0/130)Resolving deltas:   1% (2/130)Resolving deltas:   2% (3/130)Resolving deltas:   3% (4/130)Resolving deltas:   5% (7/130)Resolving deltas:   6% (8/130)Resolving deltas:   7% (10/130)Resolving deltas:   8% (11/130)Resolving deltas:  10% (13/130)Resolving deltas:  11% (15/130)Resolving deltas:  12% (16/130)Resolving deltas:  13% (17/130)Resolving deltas:  14% (19/130)Resolving deltas:  15% (20/130)Resolving deltas:  16% (21/130)Resolving deltas:  17% (23/130)Resolving deltas:  18% (24/130)Resolving deltas:  19% (25/130)Resolving deltas:  20% (26/130)Resolving deltas:  21% (28/130)Resolving deltas:  22% (29/130)Resolving deltas:  23% (30/130)Resolving deltas:  25% (33/130)Resolving deltas:  26% (34/130)Resolving deltas:  28% (37/130)Resolving deltas:  29% (38/130)Resolving deltas:  30% (40/130)Resolving deltas:  31% (41/130)Resolving deltas:  32% (42/130)Resolving deltas:  33% (43/130)Resolving deltas:  34% (45/130)Resolving deltas:  35% (46/130)Resolving deltas:  36% (47/130)Resolving deltas:  37% (49/130)Resolving deltas:  39% (51/130)Resolving deltas:  40% (52/130)Resolving deltas:  41% (54/130)Resolving deltas:  42% (55/130)Resolving deltas:  43% (56/130)Resolving deltas:  44% (58/130)Resolving deltas:  45% (59/130)Resolving deltas:  46% (60/130)Resolving deltas:  47% (62/130)Resolving deltas:  48% (63/130)Resolving deltas:  49% (64/130)Resolving deltas:  50% (66/130)Resolving deltas:  52% (68/130)Resolving deltas:  53% (70/130)Resolving deltas:  55% (72/130)Resolving deltas:  56% (73/130)Resolving deltas:  57% (75/130)Resolving deltas:  58% (76/130)Resolving deltas:  59% (77/130)Resolving deltas:  60% (78/130)Resolving deltas:  61% (80/130)Resolving deltas:  62% (81/130)Resolving deltas:  63% (83/130)Resolving deltas:  64% (84/130)Resolving deltas:  65% (85/130)Resolving deltas:  66% (86/130)Resolving deltas:  69% (90/130)Resolving deltas:  70% (91/130)Resolving deltas:  72% (94/130)Resolving deltas:  73% (95/130)Resolving deltas:  74% (97/130)Resolving deltas:  75% (98/130)Resolving deltas:  76% (99/130)Resolving deltas:  77% (101/130)Resolving deltas:  78% (102/130)Resolving deltas:  79% (103/130)Resolving deltas:  81% (106/130)Resolving deltas:  82% (107/130)Resolving deltas:  83% (108/130)Resolving deltas:  84% (110/130)Resolving deltas:  85% (111/130)Resolving deltas:  86% (112/130)Resolving deltas:  87% (114/130)Resolving deltas:  88% (115/130)Resolving deltas:  89% (116/130)Resolving deltas:  90% (117/130)Resolving deltas:  91% (119/130)Resolving deltas:  92% (120/130)Resolving deltas:  93% (121/130)Resolving deltas:  94% (123/130)Resolving deltas:  95% (124/130)Resolving deltas:  96% (125/130)Resolving deltas:  97% (127/130)Resolving deltas:  98% (128/130)Resolving deltas:  99% (129/130)Resolving deltas: 100% (130/130)Resolving deltas: 100% (130/130), done.
    Installed openzeppelin-contracts v5.0.2

codex
I’ve settled the protocol shape: borrower actions will be constrained by the 70% borrow LTV, while liquidation checks use the separate 85% threshold. I’m writing the contracts and deployment script now, with explicit price normalization and lazy linear interest accrual per position.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/.gitignore
/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/foundry.toml
/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/script/Deploy.s.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/src/ETHBorrowMarket.sol
/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/src/interfaces/IChainlinkAggregator.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..e239d3b396eae83d752133ee961f6f4134087058
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache
+/out
+/broadcast
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a857e9c1ec40dc1a8477681b2c540d2522c63e3e
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Notes
+
+## Health computation
+
+The market tracks each account's position as:
+
+- `collateralAmount` in WETH, scaled to `1e18`
+- `debtAmount` in USDC base units, scaled to `1e6`
+- `lastAccrued` timestamp for lazy interest accrual
+
+Interest accrues linearly whenever a position is touched or queried:
+
+```text
+interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)
+accruedDebt = debtAmount + interest
+```
+
+Collateral value is computed from the latest Chainlink ETH/USD answer and normalized into USDC base units:
+
+```text
+collateralValueUsdc = wethAmount * ethPriceUsd / 1e30
+```
+
+There are two thresholds:
+
+- Borrow / withdrawal limit: `accruedDebt <= collateralValueUsdc * 70%`
+- Liquidation threshold: `accruedDebt > collateralValueUsdc * 85%`
+
+That means a borrower can only increase leverage or withdraw collateral if the resulting position remains at or below 70% LTV. Liquidation starts once the position moves above 85% LTV.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Read the borrower's live debt and confirm the position is above the 85% liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, repayAmount, receiver)`.
+
+The contract caps the actual repay amount to the lesser of:
+
+- the requested repay amount
+- the borrower's current debt
+- the amount that can be covered by the remaining collateral after applying the 5% liquidation bonus
+
+Seized collateral is:
+
+```text
+baseCollateral = repayAmount / ethPrice
+seizedCollateral = baseCollateral * 1.05
+```
+
+The liquidator transfers in USDC and receives WETH directly to `receiver`.
+
+## Mainnet deployment / operations
+
+An operator needs to get these right:
+
+- Use canonical mainnet WETH and USDC addresses, and a manipulation-resistant ETH/USD oracle.
+- Set `ORACLE_MAX_AGE` to a value derived from the oracle heartbeat plus a safety margin. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, healthy positions may become temporarily unusable.
+- Prefund the contract with enough USDC liquidity before allowing borrowing. Borrows are paid from the contract's current USDC balance.
+- Pick an `ANNUAL_INTEREST_BPS` that matches the intended product economics, because it is immutable in this version.
+- Verify that the chosen oracle decimals and token decimals match the assumptions here: WETH `18`, USDC `6`.
+- Run mainnet-fork tests against the exact deployment configuration, especially for staleness handling, rounding around the 70% and 85% thresholds, and liquidation behavior when collateral value has dropped sharply.
+- Monitor liquidity. If the contract runs out of idle USDC, new borrows revert even if users still have borrow capacity.
+
+Example deploy command:
+
+```bash
+WETH=<weth-address> \
+USDC=<usdc-address> \
+COLLATERAL_ORACLE=<eth-usd-oracle-address> \
+ANNUAL_INTEREST_BPS=500 \
+ORACLE_MAX_AGE=5400 \
+forge script script/Deploy.s.sol:Deploy --rpc-url $MAINNET_RPC_URL --broadcast
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..2047e6906a765b5a3d52b61e18c2d40277361bf9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27d03c1e30e49ed4d466e638df745e6a9894fa65
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "lib/openzeppelin-contracts/lib/forge-std/src/Script.sol";
+
+import {ETHBorrowMarket} from "../src/ETHBorrowMarket.sol";
+
+contract Deploy is Script {
+    function run() external returns (ETHBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address collateralOracle = vm.envAddress("COLLATERAL_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 oracleMaxAge = vm.envUint("ORACLE_MAX_AGE");
+
+        vm.startBroadcast();
+        market = new ETHBorrowMarket(
+            weth,
+            usdc,
+            collateralOracle,
+            annualInterestBps,
+            oracleMaxAge
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/ETHBorrowMarket.sol b/src/ETHBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b3ab2def8075f419bab088f0ff06a9f7448e58e
--- /dev/null
+++ b/src/ETHBorrowMarket.sol
@@ -0,0 +1,302 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregator} from "./interfaces/IChainlinkAggregator.sol";
+
+contract ETHBorrowMarket is ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BASIS_POINTS = 10_000;
+    uint256 public constant COLLATERAL_SCALE = 1e18;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IChainlinkAggregator public immutable collateralOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable oracleMaxAge;
+
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint64 lastAccrued;
+    }
+
+    mapping(address account => Position position) public positions;
+
+    error ZeroAmount();
+    error InvalidOracleAnswer();
+    error StaleOraclePrice();
+    error UnsupportedUsdcDecimals();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NotEnoughCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 seizedCollateral
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 oracleMaxAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) revert InvalidOracleAnswer();
+        if (annualInterestBps_ > BASIS_POINTS) revert BorrowLimitExceeded();
+        if (oracleMaxAge_ == 0) revert StaleOraclePrice();
+        if (IERC20Metadata(usdc_).decimals() != 6) revert UnsupportedUsdcDecimals();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        collateralOracle = IChainlinkAggregator(collateralOracle_);
+        oracleDecimals = IChainlinkAggregator(collateralOracle_).decimals();
+        annualInterestBps = annualInterestBps_;
+        oracleMaxAge = oracleMaxAge_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (amount > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.collateralAmount -= amount;
+        _ensureWithinBorrowLimit(position);
+
+        weth.safeTransfer(msg.sender, amount);
+
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.debtAmount += amount;
+        totalDebt += amount;
+        _ensureWithinBorrowLimit(position);
+
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+        usdc.safeTransfer(msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        actualRepaid = _repay(position, msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount, address receiver)
+        external
+        nonReentrant
+        returns (uint256 actualRepaid, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidOracleAnswer();
+
+        Position storage position = positions[account];
+        uint256 debtAmount = _accrueInterest(position, account);
+
+        if (debtAmount == 0) revert NoDebt();
+        if (!_isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount))) revert PositionNotLiquidatable();
+
+        uint256 collateralPrice = _latestPriceE18();
+        uint256 maxRepayAgainstCollateral = Math.mulDiv(
+            _collateralValueInUsdc(position.collateralAmount),
+            BASIS_POINTS,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS
+        );
+
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayAgainstCollateral) actualRepaid = maxRepayAgainstCollateral;
+        if (actualRepaid == 0) revert NotEnoughCollateral();
+
+        collateralSeized = _collateralForDebt(actualRepaid, collateralPrice);
+        collateralSeized = Math.mulDiv(
+            collateralSeized,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS,
+            BASIS_POINTS,
+            Math.Rounding.Ceil
+        );
+
+        if (collateralSeized > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.debtAmount = debtAmount - actualRepaid;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepaid;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepaid);
+        weth.safeTransfer(receiver, collateralSeized);
+
+        emit Repaid(msg.sender, account, actualRepaid);
+        emit Liquidated(msg.sender, account, receiver, actualRepaid, collateralSeized);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        return _previewDebt(position);
+    }
+
+    function collateralValueInUsdc(address account) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[account].collateralAmount);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowAllowed(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function liquidationThreshold(address account) external view returns (uint256) {
+        return _liquidationThresholdValue(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position storage position = positions[account];
+        return _isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount));
+    }
+
+    function _repay(Position storage position, address account, address payer, uint256 amount)
+        internal
+        returns (uint256 actualRepaid)
+    {
+        uint256 debtAmount = _accrueInterest(position, account);
+        if (debtAmount == 0) revert NoDebt();
+
+        actualRepaid = amount > debtAmount ? debtAmount : amount;
+
+        position.debtAmount = debtAmount - actualRepaid;
+        totalDebt -= actualRepaid;
+
+        usdc.safeTransferFrom(payer, address(this), actualRepaid);
+
+        emit Repaid(payer, account, actualRepaid);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        if (debtAmount == 0 || elapsed == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            annualInterestBps * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        if (interestAmount != 0) {
+            debtAmount += interestAmount;
+            position.debtAmount = debtAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount);
+        }
+
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _previewDebt(Position storage position) internal view returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        if (debtAmount == 0 || position.lastAccrued == 0) return debtAmount;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return debtAmount;
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            annualInterestBps * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        return debtAmount + interestAmount;
+    }
+
+    function _ensureWithinBorrowLimit(Position storage position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        if (_previewDebt(position) > _maxBorrowAllowed(collateralValue)) revert BorrowLimitExceeded();
+    }
+
+    function _isLiquidatable(Position storage position, uint256 collateralValue) internal view returns (bool) {
+        if (position.debtAmount == 0) return false;
+        return _previewDebt(position) > _liquidationThresholdValue(collateralValue);
+    }
+
+    function _maxBorrowAllowed(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, MAX_BORROW_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _liquidationThresholdValue(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, LIQUIDATION_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        return Math.mulDiv(collateralAmount, _latestPriceE18(), 1e30);
+    }
+
+    function _collateralForDebt(uint256 debtAmount, uint256 collateralPrice) internal pure returns (uint256) {
+        return Math.mulDiv(debtAmount, 1e30, collateralPrice, Math.Rounding.Ceil);
+    }
+
+    function _latestPriceE18() internal view returns (uint256 priceE18) {
+        (, int256 answer,, uint256 updatedAt,) = collateralOracle.latestRoundData();
+
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (updatedAt < block.timestamp - oracleMaxAge) revert StaleOraclePrice();
+
+        priceE18 = Math.mulDiv(uint256(answer), 1e18, 10 ** oracleDecimals);
+    }
+}
+
diff --git a/src/interfaces/IChainlinkAggregator.sol b/src/interfaces/IChainlinkAggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac49565e307a4ef1fa561e25618e76c369144687
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregator.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregator {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
+

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..e239d3b396eae83d752133ee961f6f4134087058
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache
+/out
+/broadcast
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a857e9c1ec40dc1a8477681b2c540d2522c63e3e
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Notes
+
+## Health computation
+
+The market tracks each account's position as:
+
+- `collateralAmount` in WETH, scaled to `1e18`
+- `debtAmount` in USDC base units, scaled to `1e6`
+- `lastAccrued` timestamp for lazy interest accrual
+
+Interest accrues linearly whenever a position is touched or queried:
+
+```text
+interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)
+accruedDebt = debtAmount + interest
+```
+
+Collateral value is computed from the latest Chainlink ETH/USD answer and normalized into USDC base units:
+
+```text
+collateralValueUsdc = wethAmount * ethPriceUsd / 1e30
+```
+
+There are two thresholds:
+
+- Borrow / withdrawal limit: `accruedDebt <= collateralValueUsdc * 70%`
+- Liquidation threshold: `accruedDebt > collateralValueUsdc * 85%`
+
+That means a borrower can only increase leverage or withdraw collateral if the resulting position remains at or below 70% LTV. Liquidation starts once the position moves above 85% LTV.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Read the borrower's live debt and confirm the position is above the 85% liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, repayAmount, receiver)`.
+
+The contract caps the actual repay amount to the lesser of:
+
+- the requested repay amount
+- the borrower's current debt
+- the amount that can be covered by the remaining collateral after applying the 5% liquidation bonus
+
+Seized collateral is:
+
+```text
+baseCollateral = repayAmount / ethPrice
+seizedCollateral = baseCollateral * 1.05
+```
+
+The liquidator transfers in USDC and receives WETH directly to `receiver`.
+
+## Mainnet deployment / operations
+
+An operator needs to get these right:
+
+- Use canonical mainnet WETH and USDC addresses, and a manipulation-resistant ETH/USD oracle.
+- Set `ORACLE_MAX_AGE` to a value derived from the oracle heartbeat plus a safety margin. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, healthy positions may become temporarily unusable.
+- Prefund the contract with enough USDC liquidity before allowing borrowing. Borrows are paid from the contract's current USDC balance.
+- Pick an `ANNUAL_INTEREST_BPS` that matches the intended product economics, because it is immutable in this version.
+- Verify that the chosen oracle decimals and token decimals match the assumptions here: WETH `18`, USDC `6`.
+- Run mainnet-fork tests against the exact deployment configuration, especially for staleness handling, rounding around the 70% and 85% thresholds, and liquidation behavior when collateral value has dropped sharply.
+- Monitor liquidity. If the contract runs out of idle USDC, new borrows revert even if users still have borrow capacity.
+
+Example deploy command:
+
+```bash
+WETH=<weth-address> \
+USDC=<usdc-address> \
+COLLATERAL_ORACLE=<eth-usd-oracle-address> \
+ANNUAL_INTEREST_BPS=500 \
+ORACLE_MAX_AGE=5400 \
+forge script script/Deploy.s.sol:Deploy --rpc-url $MAINNET_RPC_URL --broadcast
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..2047e6906a765b5a3d52b61e18c2d40277361bf9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27d03c1e30e49ed4d466e638df745e6a9894fa65
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "lib/openzeppelin-contracts/lib/forge-std/src/Script.sol";
+
+import {ETHBorrowMarket} from "../src/ETHBorrowMarket.sol";
+
+contract Deploy is Script {
+    function run() external returns (ETHBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address collateralOracle = vm.envAddress("COLLATERAL_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 oracleMaxAge = vm.envUint("ORACLE_MAX_AGE");
+
+        vm.startBroadcast();
+        market = new ETHBorrowMarket(
+            weth,
+            usdc,
+            collateralOracle,
+            annualInterestBps,
+            oracleMaxAge
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/ETHBorrowMarket.sol b/src/ETHBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b3ab2def8075f419bab088f0ff06a9f7448e58e
--- /dev/null
+++ b/src/ETHBorrowMarket.sol
@@ -0,0 +1,302 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregator} from "./interfaces/IChainlinkAggregator.sol";
+
+contract ETHBorrowMarket is ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BASIS_POINTS = 10_000;
+    uint256 public constant COLLATERAL_SCALE = 1e18;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IChainlinkAggregator public immutable collateralOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable oracleMaxAge;
+
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint64 lastAccrued;
+    }
+
+    mapping(address account => Position position) public positions;
+
+    error ZeroAmount();
+    error InvalidOracleAnswer();
+    error StaleOraclePrice();
+    error UnsupportedUsdcDecimals();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NotEnoughCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 seizedCollateral
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 oracleMaxAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) revert InvalidOracleAnswer();
+        if (annualInterestBps_ > BASIS_POINTS) revert BorrowLimitExceeded();
+        if (oracleMaxAge_ == 0) revert StaleOraclePrice();
+        if (IERC20Metadata(usdc_).decimals() != 6) revert UnsupportedUsdcDecimals();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        collateralOracle = IChainlinkAggregator(collateralOracle_);
+        oracleDecimals = IChainlinkAggregator(collateralOracle_).decimals();
+        annualInterestBps = annualInterestBps_;
+        oracleMaxAge = oracleMaxAge_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (amount > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.collateralAmount -= amount;
+        _ensureWithinBorrowLimit(position);
+
+        weth.safeTransfer(msg.sender, amount);
+
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.debtAmount += amount;
+        totalDebt += amount;
+        _ensureWithinBorrowLimit(position);
+
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+        usdc.safeTransfer(msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        actualRepaid = _repay(position, msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount, address receiver)
+        external
+        nonReentrant
+        returns (uint256 actualRepaid, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidOracleAnswer();
+
+        Position storage position = positions[account];
+        uint256 debtAmount = _accrueInterest(position, account);
+
+        if (debtAmount == 0) revert NoDebt();
+        if (!_isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount))) revert PositionNotLiquidatable();
+
+        uint256 collateralPrice = _latestPriceE18();
+        uint256 maxRepayAgainstCollateral = Math.mulDiv(
+            _collateralValueInUsdc(position.collateralAmount),
+            BASIS_POINTS,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS
+        );
+
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayAgainstCollateral) actualRepaid = maxRepayAgainstCollateral;
+        if (actualRepaid == 0) revert NotEnoughCollateral();
+
+        collateralSeized = _collateralForDebt(actualRepaid, collateralPrice);
+        collateralSeized = Math.mulDiv(
+            collateralSeized,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS,
+            BASIS_POINTS,
+            Math.Rounding.Ceil
+        );
+
+        if (collateralSeized > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.debtAmount = debtAmount - actualRepaid;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepaid;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepaid);
+        weth.safeTransfer(receiver, collateralSeized);
+
+        emit Repaid(msg.sender, account, actualRepaid);
+        emit Liquidated(msg.sender, account, receiver, actualRepaid, collateralSeized);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        return _previewDebt(position);
+    }
+
+    function collateralValueInUsdc(address account) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[account].collateralAmount);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowAllowed(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function liquidationThreshold(address account) external view returns (uint256) {
+        return _liquidationThresholdValue(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position storage position = positions[account];
+        return _isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount));
+    }
+
+    function _repay(Position storage position, address account, address payer, uint256 amount)
+        internal
+        returns (uint256 actualRepaid)
+    {
+        uint256 debtAmount = _accrueInterest(position, account);
+        if (debtAmount == 0) revert NoDebt();
+
+        actualRepaid = amount > debtAmount ? debtAmount : amount;
+
+        position.debtAmount = debtAmount - actualRepaid;
+        totalDebt -= actualRepaid;
+
+        usdc.safeTransferFrom(payer, address(this), actualRepaid);
+
+        emit Repaid(payer, account, actualRepaid);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        if (debtAmount == 0 || elapsed == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            annualInterestBps * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        if (interestAmount != 0) {
+            debtAmount += interestAmount;
+            position.debtAmount = debtAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount);
+        }
+
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _previewDebt(Position storage position) internal view returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        if (debtAmount == 0 || position.lastAccrued == 0) return debtAmount;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return debtAmount;
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            annualInterestBps * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        return debtAmount + interestAmount;
+    }
+
+    function _ensureWithinBorrowLimit(Position storage position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        if (_previewDebt(position) > _maxBorrowAllowed(collateralValue)) revert BorrowLimitExceeded();
+    }
+
+    function _isLiquidatable(Position storage position, uint256 collateralValue) internal view returns (bool) {
+        if (position.debtAmount == 0) return false;
+        return _previewDebt(position) > _liquidationThresholdValue(collateralValue);
+    }
+
+    function _maxBorrowAllowed(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, MAX_BORROW_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _liquidationThresholdValue(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, LIQUIDATION_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        return Math.mulDiv(collateralAmount, _latestPriceE18(), 1e30);
+    }
+
+    function _collateralForDebt(uint256 debtAmount, uint256 collateralPrice) internal pure returns (uint256) {
+        return Math.mulDiv(debtAmount, 1e30, collateralPrice, Math.Rounding.Ceil);
+    }
+
+    function _latestPriceE18() internal view returns (uint256 priceE18) {
+        (, int256 answer,, uint256 updatedAt,) = collateralOracle.latestRoundData();
+
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (updatedAt < block.timestamp - oracleMaxAge) revert StaleOraclePrice();
+
+        priceE18 = Math.mulDiv(uint256(answer), 1e18, 10 ** oracleDecimals);
+    }
+}
+
diff --git a/src/interfaces/IChainlinkAggregator.sol b/src/interfaces/IChainlinkAggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac49565e307a4ef1fa561e25618e76c369144687
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregator.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregator {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
+

codex
The first cut is in place. I’m running `forge build` now and will tighten any compile or logic issues that show up before I stop.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
?? .gitignore
?? NOTES.md
?? foundry.toml
?? script/
?? src/

 succeeded in 565ms:
Compiling 21 files with Solc 0.8.26
Solc 0.8.26 finished in 511.30ms
Compiler run successful!
2026-09-04T13:03:45.780065Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ETHBorrowMarket.sol:23:29
   |
23 |     IERC20 public immutable weth;
   |                             ^^^^ help: consider using: `WETH`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ETHBorrowMarket.sol:24:29
   |
24 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ETHBorrowMarket.sol:25:43
   |
25 |     IChainlinkAggregator public immutable collateralOracle;
   |                                           ^^^^^^^^^^^^^^^^ help: consider using: `COLLATERAL_ORACLE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ETHBorrowMarket.sol:26:28
   |
26 |     uint8 public immutable oracleDecimals;
   |                            ^^^^^^^^^^^^^^ help: consider using: `ORACLE_DECIMALS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ETHBorrowMarket.sol:27:30
   |
27 |     uint256 public immutable annualInterestBps;
   |                              ^^^^^^^^^^^^^^^^^ help: consider using: `ANNUAL_INTEREST_BPS`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/ETHBorrowMarket.sol:28:30
   |
28 |     uint256 public immutable oracleMaxAge;
   |                              ^^^^^^^^^^^^ help: consider using: `ORACLE_MAX_AGE`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/ETHBorrowMarket.sol:299:32
    |
299 |         priceE18 = Math.mulDiv(uint256(answer), 1e18, 10 ** oracleDecimals);
    |                                ^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint256' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast


diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..e239d3b396eae83d752133ee961f6f4134087058
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache
+/out
+/broadcast
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a857e9c1ec40dc1a8477681b2c540d2522c63e3e
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Notes
+
+## Health computation
+
+The market tracks each account's position as:
+
+- `collateralAmount` in WETH, scaled to `1e18`
+- `debtAmount` in USDC base units, scaled to `1e6`
+- `lastAccrued` timestamp for lazy interest accrual
+
+Interest accrues linearly whenever a position is touched or queried:
+
+```text
+interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)
+accruedDebt = debtAmount + interest
+```
+
+Collateral value is computed from the latest Chainlink ETH/USD answer and normalized into USDC base units:
+
+```text
+collateralValueUsdc = wethAmount * ethPriceUsd / 1e30
+```
+
+There are two thresholds:
+
+- Borrow / withdrawal limit: `accruedDebt <= collateralValueUsdc * 70%`
+- Liquidation threshold: `accruedDebt > collateralValueUsdc * 85%`
+
+That means a borrower can only increase leverage or withdraw collateral if the resulting position remains at or below 70% LTV. Liquidation starts once the position moves above 85% LTV.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Read the borrower's live debt and confirm the position is above the 85% liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, repayAmount, receiver)`.
+
+The contract caps the actual repay amount to the lesser of:
+
+- the requested repay amount
+- the borrower's current debt
+- the amount that can be covered by the remaining collateral after applying the 5% liquidation bonus
+
+Seized collateral is:
+
+```text
+baseCollateral = repayAmount / ethPrice
+seizedCollateral = baseCollateral * 1.05
+```
+
+The liquidator transfers in USDC and receives WETH directly to `receiver`.
+
+## Mainnet deployment / operations
+
+An operator needs to get these right:
+
+- Use canonical mainnet WETH and USDC addresses, and a manipulation-resistant ETH/USD oracle.
+- Set `ORACLE_MAX_AGE` to a value derived from the oracle heartbeat plus a safety margin. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, healthy positions may become temporarily unusable.
+- Prefund the contract with enough USDC liquidity before allowing borrowing. Borrows are paid from the contract's current USDC balance.
+- Pick an `ANNUAL_INTEREST_BPS` that matches the intended product economics, because it is immutable in this version.
+- Verify that the chosen oracle decimals and token decimals match the assumptions here: WETH `18`, USDC `6`.
+- Run mainnet-fork tests against the exact deployment configuration, especially for staleness handling, rounding around the 70% and 85% thresholds, and liquidation behavior when collateral value has dropped sharply.
+- Monitor liquidity. If the contract runs out of idle USDC, new borrows revert even if users still have borrow capacity.
+
+Example deploy command:
+
+```bash
+WETH=<weth-address> \
+USDC=<usdc-address> \
+COLLATERAL_ORACLE=<eth-usd-oracle-address> \
+ANNUAL_INTEREST_BPS=500 \
+ORACLE_MAX_AGE=5400 \
+forge script script/Deploy.s.sol:Deploy --rpc-url $MAINNET_RPC_URL --broadcast
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..2047e6906a765b5a3d52b61e18c2d40277361bf9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27d03c1e30e49ed4d466e638df745e6a9894fa65
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "lib/openzeppelin-contracts/lib/forge-std/src/Script.sol";
+
+import {ETHBorrowMarket} from "../src/ETHBorrowMarket.sol";
+
+contract Deploy is Script {
+    function run() external returns (ETHBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address collateralOracle = vm.envAddress("COLLATERAL_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 oracleMaxAge = vm.envUint("ORACLE_MAX_AGE");
+
+        vm.startBroadcast();
+        market = new ETHBorrowMarket(
+            weth,
+            usdc,
+            collateralOracle,
+            annualInterestBps,
+            oracleMaxAge
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/ETHBorrowMarket.sol b/src/ETHBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b3ab2def8075f419bab088f0ff06a9f7448e58e
--- /dev/null
+++ b/src/ETHBorrowMarket.sol
@@ -0,0 +1,302 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregator} from "./interfaces/IChainlinkAggregator.sol";
+
+contract ETHBorrowMarket is ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BASIS_POINTS = 10_000;
+    uint256 public constant COLLATERAL_SCALE = 1e18;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable weth;
+    IERC20 public immutable usdc;
+    IChainlinkAggregator public immutable collateralOracle;
+    uint8 public immutable oracleDecimals;
+    uint256 public immutable annualInterestBps;
+    uint256 public immutable oracleMaxAge;
+
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint64 lastAccrued;
+    }
+
+    mapping(address account => Position position) public positions;
+
+    error ZeroAmount();
+    error InvalidOracleAnswer();
+    error StaleOraclePrice();
+    error UnsupportedUsdcDecimals();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NotEnoughCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 seizedCollateral
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 oracleMaxAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) revert InvalidOracleAnswer();
+        if (annualInterestBps_ > BASIS_POINTS) revert BorrowLimitExceeded();
+        if (oracleMaxAge_ == 0) revert StaleOraclePrice();
+        if (IERC20Metadata(usdc_).decimals() != 6) revert UnsupportedUsdcDecimals();
+
+        weth = IERC20(weth_);
+        usdc = IERC20(usdc_);
+        collateralOracle = IChainlinkAggregator(collateralOracle_);
+        oracleDecimals = IChainlinkAggregator(collateralOracle_).decimals();
+        annualInterestBps = annualInterestBps_;
+        oracleMaxAge = oracleMaxAge_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+
+        weth.safeTransferFrom(msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (amount > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.collateralAmount -= amount;
+        _ensureWithinBorrowLimit(position);
+
+        weth.safeTransfer(msg.sender, amount);
+
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.debtAmount += amount;
+        totalDebt += amount;
+        _ensureWithinBorrowLimit(position);
+
+        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+        usdc.safeTransfer(msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        actualRepaid = _repay(position, msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount, address receiver)
+        external
+        nonReentrant
+        returns (uint256 actualRepaid, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert InvalidOracleAnswer();
+
+        Position storage position = positions[account];
+        uint256 debtAmount = _accrueInterest(position, account);
+
+        if (debtAmount == 0) revert NoDebt();
+        if (!_isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount))) revert PositionNotLiquidatable();
+
+        uint256 collateralPrice = _latestPriceE18();
+        uint256 maxRepayAgainstCollateral = Math.mulDiv(
+            _collateralValueInUsdc(position.collateralAmount),
+            BASIS_POINTS,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS
+        );
+
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayAgainstCollateral) actualRepaid = maxRepayAgainstCollateral;
+        if (actualRepaid == 0) revert NotEnoughCollateral();
+
+        collateralSeized = _collateralForDebt(actualRepaid, collateralPrice);
+        collateralSeized = Math.mulDiv(
+            collateralSeized,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS,
+            BASIS_POINTS,
+            Math.Rounding.Ceil
+        );
+
+        if (collateralSeized > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.debtAmount = debtAmount - actualRepaid;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepaid;
+
+        usdc.safeTransferFrom(msg.sender, address(this), actualRepaid);
+        weth.safeTransfer(receiver, collateralSeized);
+
+        emit Repaid(msg.sender, account, actualRepaid);
+        emit Liquidated(msg.sender, account, receiver, actualRepaid, collateralSeized);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        return _previewDebt(position);
+    }
+
+    function collateralValueInUsdc(address account) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[account].collateralAmount);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowAllowed(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function liquidationThreshold(address account) external view returns (uint256) {
+        return _liquidationThresholdValue(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position storage position = positions[account];
+        return _isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount));
+    }
+
+    function _repay(Position storage position, address account, address payer, uint256 amount)
+        internal
+        returns (uint256 actualRepaid)
+    {
+        uint256 debtAmount = _accrueInterest(position, account);
+        if (debtAmount == 0) revert NoDebt();
+
+        actualRepaid = amount > debtAmount ? debtAmount : amount;
+
+        position.debtAmount = debtAmount - actualRepaid;
+        totalDebt -= actualRepaid;
+
+        usdc.safeTransferFrom(payer, address(this), actualRepaid);
+
+        emit Repaid(payer, account, actualRepaid);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        if (debtAmount == 0 || elapsed == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            annualInterestBps * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        if (interestAmount != 0) {
+            debtAmount += interestAmount;
+            position.debtAmount = debtAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount);
+        }
+
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _previewDebt(Position storage position) internal view returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        if (debtAmount == 0 || position.lastAccrued == 0) return debtAmount;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return debtAmount;
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            annualInterestBps * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        return debtAmount + interestAmount;
+    }
+
+    function _ensureWithinBorrowLimit(Position storage position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        if (_previewDebt(position) > _maxBorrowAllowed(collateralValue)) revert BorrowLimitExceeded();
+    }
+
+    function _isLiquidatable(Position storage position, uint256 collateralValue) internal view returns (bool) {
+        if (position.debtAmount == 0) return false;
+        return _previewDebt(position) > _liquidationThresholdValue(collateralValue);
+    }
+
+    function _maxBorrowAllowed(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, MAX_BORROW_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _liquidationThresholdValue(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, LIQUIDATION_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        return Math.mulDiv(collateralAmount, _latestPriceE18(), 1e30);
+    }
+
+    function _collateralForDebt(uint256 debtAmount, uint256 collateralPrice) internal pure returns (uint256) {
+        return Math.mulDiv(debtAmount, 1e30, collateralPrice, Math.Rounding.Ceil);
+    }
+
+    function _latestPriceE18() internal view returns (uint256 priceE18) {
+        (, int256 answer,, uint256 updatedAt,) = collateralOracle.latestRoundData();
+
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (updatedAt < block.timestamp - oracleMaxAge) revert StaleOraclePrice();
+
+        priceE18 = Math.mulDiv(uint256(answer), 1e18, 10 ** oracleDecimals);
+    }
+}
+
diff --git a/src/interfaces/IChainlinkAggregator.sol b/src/interfaces/IChainlinkAggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac49565e307a4ef1fa561e25618e76c369144687
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregator.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregator {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
+

codex
`forge build` is already green. I’m doing one cleanup pass now to remove avoidable lints and make the constructor/error surface less sloppy before I wrap up.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/src/ETHBorrowMarket.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..e239d3b396eae83d752133ee961f6f4134087058
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache
+/out
+/broadcast
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a857e9c1ec40dc1a8477681b2c540d2522c63e3e
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Notes
+
+## Health computation
+
+The market tracks each account's position as:
+
+- `collateralAmount` in WETH, scaled to `1e18`
+- `debtAmount` in USDC base units, scaled to `1e6`
+- `lastAccrued` timestamp for lazy interest accrual
+
+Interest accrues linearly whenever a position is touched or queried:
+
+```text
+interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)
+accruedDebt = debtAmount + interest
+```
+
+Collateral value is computed from the latest Chainlink ETH/USD answer and normalized into USDC base units:
+
+```text
+collateralValueUsdc = wethAmount * ethPriceUsd / 1e30
+```
+
+There are two thresholds:
+
+- Borrow / withdrawal limit: `accruedDebt <= collateralValueUsdc * 70%`
+- Liquidation threshold: `accruedDebt > collateralValueUsdc * 85%`
+
+That means a borrower can only increase leverage or withdraw collateral if the resulting position remains at or below 70% LTV. Liquidation starts once the position moves above 85% LTV.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Read the borrower's live debt and confirm the position is above the 85% liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, repayAmount, receiver)`.
+
+The contract caps the actual repay amount to the lesser of:
+
+- the requested repay amount
+- the borrower's current debt
+- the amount that can be covered by the remaining collateral after applying the 5% liquidation bonus
+
+Seized collateral is:
+
+```text
+baseCollateral = repayAmount / ethPrice
+seizedCollateral = baseCollateral * 1.05
+```
+
+The liquidator transfers in USDC and receives WETH directly to `receiver`.
+
+## Mainnet deployment / operations
+
+An operator needs to get these right:
+
+- Use canonical mainnet WETH and USDC addresses, and a manipulation-resistant ETH/USD oracle.
+- Set `ORACLE_MAX_AGE` to a value derived from the oracle heartbeat plus a safety margin. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, healthy positions may become temporarily unusable.
+- Prefund the contract with enough USDC liquidity before allowing borrowing. Borrows are paid from the contract's current USDC balance.
+- Pick an `ANNUAL_INTEREST_BPS` that matches the intended product economics, because it is immutable in this version.
+- Verify that the chosen oracle decimals and token decimals match the assumptions here: WETH `18`, USDC `6`.
+- Run mainnet-fork tests against the exact deployment configuration, especially for staleness handling, rounding around the 70% and 85% thresholds, and liquidation behavior when collateral value has dropped sharply.
+- Monitor liquidity. If the contract runs out of idle USDC, new borrows revert even if users still have borrow capacity.
+
+Example deploy command:
+
+```bash
+WETH=<weth-address> \
+USDC=<usdc-address> \
+COLLATERAL_ORACLE=<eth-usd-oracle-address> \
+ANNUAL_INTEREST_BPS=500 \
+ORACLE_MAX_AGE=5400 \
+forge script script/Deploy.s.sol:Deploy --rpc-url $MAINNET_RPC_URL --broadcast
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..2047e6906a765b5a3d52b61e18c2d40277361bf9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27d03c1e30e49ed4d466e638df745e6a9894fa65
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "lib/openzeppelin-contracts/lib/forge-std/src/Script.sol";
+
+import {ETHBorrowMarket} from "../src/ETHBorrowMarket.sol";
+
+contract Deploy is Script {
+    function run() external returns (ETHBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address collateralOracle = vm.envAddress("COLLATERAL_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 oracleMaxAge = vm.envUint("ORACLE_MAX_AGE");
+
+        vm.startBroadcast();
+        market = new ETHBorrowMarket(
+            weth,
+            usdc,
+            collateralOracle,
+            annualInterestBps,
+            oracleMaxAge
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/ETHBorrowMarket.sol b/src/ETHBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9a1a06f7e9e86520446dead40984f7e1e195a686
--- /dev/null
+++ b/src/ETHBorrowMarket.sol
@@ -0,0 +1,305 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregator} from "./interfaces/IChainlinkAggregator.sol";
+
+contract ETHBorrowMarket is ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BASIS_POINTS = 10_000;
+    uint256 public constant COLLATERAL_SCALE = 1e18;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregator public immutable COLLATERAL_ORACLE;
+    uint8 public immutable ORACLE_DECIMALS;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable ORACLE_MAX_AGE;
+
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint64 lastAccrued;
+    }
+
+    mapping(address account => Position position) public positions;
+
+    error ZeroAmount();
+    error ZeroAddress();
+    error InvalidOracleAnswer();
+    error InvalidOracleMaxAge();
+    error StaleOraclePrice();
+    error UnsupportedUsdcDecimals();
+    error InterestRateTooHigh();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NotEnoughCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 seizedCollateral
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 oracleMaxAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) revert ZeroAddress();
+        if (annualInterestBps_ > BASIS_POINTS) revert InterestRateTooHigh();
+        if (oracleMaxAge_ == 0) revert InvalidOracleMaxAge();
+        if (IERC20Metadata(usdc_).decimals() != 6) revert UnsupportedUsdcDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregator(collateralOracle_);
+        ORACLE_DECIMALS = IChainlinkAggregator(collateralOracle_).decimals();
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        ORACLE_MAX_AGE = oracleMaxAge_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (amount > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.collateralAmount -= amount;
+        _ensureWithinBorrowLimit(position);
+
+        WETH.safeTransfer(msg.sender, amount);
+
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.debtAmount += amount;
+        totalDebt += amount;
+        _ensureWithinBorrowLimit(position);
+
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+        USDC.safeTransfer(msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        actualRepaid = _repay(position, msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount, address receiver)
+        external
+        nonReentrant
+        returns (uint256 actualRepaid, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert ZeroAddress();
+
+        Position storage position = positions[account];
+        uint256 debtAmount = _accrueInterest(position, account);
+
+        if (debtAmount == 0) revert NoDebt();
+        if (!_isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount))) revert PositionNotLiquidatable();
+
+        uint256 collateralPrice = _latestPriceE18();
+        uint256 maxRepayAgainstCollateral = Math.mulDiv(
+            _collateralValueInUsdc(position.collateralAmount),
+            BASIS_POINTS,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS
+        );
+
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayAgainstCollateral) actualRepaid = maxRepayAgainstCollateral;
+        if (actualRepaid == 0) revert NotEnoughCollateral();
+
+        collateralSeized = _collateralForDebt(actualRepaid, collateralPrice);
+        collateralSeized = Math.mulDiv(
+            collateralSeized,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS,
+            BASIS_POINTS,
+            Math.Rounding.Ceil
+        );
+
+        if (collateralSeized > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.debtAmount = debtAmount - actualRepaid;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepaid;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepaid);
+        WETH.safeTransfer(receiver, collateralSeized);
+
+        emit Repaid(msg.sender, account, actualRepaid);
+        emit Liquidated(msg.sender, account, receiver, actualRepaid, collateralSeized);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        return _previewDebt(position);
+    }
+
+    function collateralValueInUsdc(address account) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[account].collateralAmount);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowAllowed(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function liquidationThreshold(address account) external view returns (uint256) {
+        return _liquidationThresholdValue(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position storage position = positions[account];
+        return _isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount));
+    }
+
+    function _repay(Position storage position, address account, address payer, uint256 amount)
+        internal
+        returns (uint256 actualRepaid)
+    {
+        uint256 debtAmount = _accrueInterest(position, account);
+        if (debtAmount == 0) revert NoDebt();
+
+        actualRepaid = amount > debtAmount ? debtAmount : amount;
+
+        position.debtAmount = debtAmount - actualRepaid;
+        totalDebt -= actualRepaid;
+
+        USDC.safeTransferFrom(payer, address(this), actualRepaid);
+
+        emit Repaid(payer, account, actualRepaid);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        if (debtAmount == 0 || elapsed == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            ANNUAL_INTEREST_BPS * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        if (interestAmount != 0) {
+            debtAmount += interestAmount;
+            position.debtAmount = debtAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount);
+        }
+
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _previewDebt(Position storage position) internal view returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        if (debtAmount == 0 || position.lastAccrued == 0) return debtAmount;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return debtAmount;
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            ANNUAL_INTEREST_BPS * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        return debtAmount + interestAmount;
+    }
+
+    function _ensureWithinBorrowLimit(Position storage position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        if (_previewDebt(position) > _maxBorrowAllowed(collateralValue)) revert BorrowLimitExceeded();
+    }
+
+    function _isLiquidatable(Position storage position, uint256 collateralValue) internal view returns (bool) {
+        if (position.debtAmount == 0) return false;
+        return _previewDebt(position) > _liquidationThresholdValue(collateralValue);
+    }
+
+    function _maxBorrowAllowed(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, MAX_BORROW_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _liquidationThresholdValue(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, LIQUIDATION_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        return Math.mulDiv(collateralAmount, _latestPriceE18(), 1e30);
+    }
+
+    function _collateralForDebt(uint256 debtAmount, uint256 collateralPrice) internal pure returns (uint256) {
+        return Math.mulDiv(debtAmount, 1e30, collateralPrice, Math.Rounding.Ceil);
+    }
+
+    function _latestPriceE18() internal view returns (uint256 priceE18) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (updatedAt < block.timestamp - ORACLE_MAX_AGE) revert StaleOraclePrice();
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE18 = Math.mulDiv(uint256(answer), 1e18, 10 ** ORACLE_DECIMALS);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregator.sol b/src/interfaces/IChainlinkAggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac49565e307a4ef1fa561e25618e76c369144687
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregator.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregator {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
+

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..e239d3b396eae83d752133ee961f6f4134087058
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache
+/out
+/broadcast
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a857e9c1ec40dc1a8477681b2c540d2522c63e3e
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Notes
+
+## Health computation
+
+The market tracks each account's position as:
+
+- `collateralAmount` in WETH, scaled to `1e18`
+- `debtAmount` in USDC base units, scaled to `1e6`
+- `lastAccrued` timestamp for lazy interest accrual
+
+Interest accrues linearly whenever a position is touched or queried:
+
+```text
+interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)
+accruedDebt = debtAmount + interest
+```
+
+Collateral value is computed from the latest Chainlink ETH/USD answer and normalized into USDC base units:
+
+```text
+collateralValueUsdc = wethAmount * ethPriceUsd / 1e30
+```
+
+There are two thresholds:
+
+- Borrow / withdrawal limit: `accruedDebt <= collateralValueUsdc * 70%`
+- Liquidation threshold: `accruedDebt > collateralValueUsdc * 85%`
+
+That means a borrower can only increase leverage or withdraw collateral if the resulting position remains at or below 70% LTV. Liquidation starts once the position moves above 85% LTV.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Read the borrower's live debt and confirm the position is above the 85% liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, repayAmount, receiver)`.
+
+The contract caps the actual repay amount to the lesser of:
+
+- the requested repay amount
+- the borrower's current debt
+- the amount that can be covered by the remaining collateral after applying the 5% liquidation bonus
+
+Seized collateral is:
+
+```text
+baseCollateral = repayAmount / ethPrice
+seizedCollateral = baseCollateral * 1.05
+```
+
+The liquidator transfers in USDC and receives WETH directly to `receiver`.
+
+## Mainnet deployment / operations
+
+An operator needs to get these right:
+
+- Use canonical mainnet WETH and USDC addresses, and a manipulation-resistant ETH/USD oracle.
+- Set `ORACLE_MAX_AGE` to a value derived from the oracle heartbeat plus a safety margin. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, healthy positions may become temporarily unusable.
+- Prefund the contract with enough USDC liquidity before allowing borrowing. Borrows are paid from the contract's current USDC balance.
+- Pick an `ANNUAL_INTEREST_BPS` that matches the intended product economics, because it is immutable in this version.
+- Verify that the chosen oracle decimals and token decimals match the assumptions here: WETH `18`, USDC `6`.
+- Run mainnet-fork tests against the exact deployment configuration, especially for staleness handling, rounding around the 70% and 85% thresholds, and liquidation behavior when collateral value has dropped sharply.
+- Monitor liquidity. If the contract runs out of idle USDC, new borrows revert even if users still have borrow capacity.
+
+Example deploy command:
+
+```bash
+WETH=<weth-address> \
+USDC=<usdc-address> \
+COLLATERAL_ORACLE=<eth-usd-oracle-address> \
+ANNUAL_INTEREST_BPS=500 \
+ORACLE_MAX_AGE=5400 \
+forge script script/Deploy.s.sol:Deploy --rpc-url $MAINNET_RPC_URL --broadcast
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..2047e6906a765b5a3d52b61e18c2d40277361bf9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27d03c1e30e49ed4d466e638df745e6a9894fa65
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "lib/openzeppelin-contracts/lib/forge-std/src/Script.sol";
+
+import {ETHBorrowMarket} from "../src/ETHBorrowMarket.sol";
+
+contract Deploy is Script {
+    function run() external returns (ETHBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address collateralOracle = vm.envAddress("COLLATERAL_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 oracleMaxAge = vm.envUint("ORACLE_MAX_AGE");
+
+        vm.startBroadcast();
+        market = new ETHBorrowMarket(
+            weth,
+            usdc,
+            collateralOracle,
+            annualInterestBps,
+            oracleMaxAge
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/ETHBorrowMarket.sol b/src/ETHBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9a1a06f7e9e86520446dead40984f7e1e195a686
--- /dev/null
+++ b/src/ETHBorrowMarket.sol
@@ -0,0 +1,305 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregator} from "./interfaces/IChainlinkAggregator.sol";
+
+contract ETHBorrowMarket is ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BASIS_POINTS = 10_000;
+    uint256 public constant COLLATERAL_SCALE = 1e18;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregator public immutable COLLATERAL_ORACLE;
+    uint8 public immutable ORACLE_DECIMALS;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable ORACLE_MAX_AGE;
+
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint64 lastAccrued;
+    }
+
+    mapping(address account => Position position) public positions;
+
+    error ZeroAmount();
+    error ZeroAddress();
+    error InvalidOracleAnswer();
+    error InvalidOracleMaxAge();
+    error StaleOraclePrice();
+    error UnsupportedUsdcDecimals();
+    error InterestRateTooHigh();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NotEnoughCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 seizedCollateral
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 oracleMaxAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) revert ZeroAddress();
+        if (annualInterestBps_ > BASIS_POINTS) revert InterestRateTooHigh();
+        if (oracleMaxAge_ == 0) revert InvalidOracleMaxAge();
+        if (IERC20Metadata(usdc_).decimals() != 6) revert UnsupportedUsdcDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregator(collateralOracle_);
+        ORACLE_DECIMALS = IChainlinkAggregator(collateralOracle_).decimals();
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        ORACLE_MAX_AGE = oracleMaxAge_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (amount > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.collateralAmount -= amount;
+        _ensureWithinBorrowLimit(position);
+
+        WETH.safeTransfer(msg.sender, amount);
+
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.debtAmount += amount;
+        totalDebt += amount;
+        _ensureWithinBorrowLimit(position);
+
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+        USDC.safeTransfer(msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        actualRepaid = _repay(position, msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount, address receiver)
+        external
+        nonReentrant
+        returns (uint256 actualRepaid, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert ZeroAddress();
+
+        Position storage position = positions[account];
+        uint256 debtAmount = _accrueInterest(position, account);
+
+        if (debtAmount == 0) revert NoDebt();
+        if (!_isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount))) revert PositionNotLiquidatable();
+
+        uint256 collateralPrice = _latestPriceE18();
+        uint256 maxRepayAgainstCollateral = Math.mulDiv(
+            _collateralValueInUsdc(position.collateralAmount),
+            BASIS_POINTS,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS
+        );
+
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayAgainstCollateral) actualRepaid = maxRepayAgainstCollateral;
+        if (actualRepaid == 0) revert NotEnoughCollateral();
+
+        collateralSeized = _collateralForDebt(actualRepaid, collateralPrice);
+        collateralSeized = Math.mulDiv(
+            collateralSeized,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS,
+            BASIS_POINTS,
+            Math.Rounding.Ceil
+        );
+
+        if (collateralSeized > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.debtAmount = debtAmount - actualRepaid;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepaid;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepaid);
+        WETH.safeTransfer(receiver, collateralSeized);
+
+        emit Repaid(msg.sender, account, actualRepaid);
+        emit Liquidated(msg.sender, account, receiver, actualRepaid, collateralSeized);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        return _previewDebt(position);
+    }
+
+    function collateralValueInUsdc(address account) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[account].collateralAmount);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowAllowed(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function liquidationThreshold(address account) external view returns (uint256) {
+        return _liquidationThresholdValue(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position storage position = positions[account];
+        return _isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount));
+    }
+
+    function _repay(Position storage position, address account, address payer, uint256 amount)
+        internal
+        returns (uint256 actualRepaid)
+    {
+        uint256 debtAmount = _accrueInterest(position, account);
+        if (debtAmount == 0) revert NoDebt();
+
+        actualRepaid = amount > debtAmount ? debtAmount : amount;
+
+        position.debtAmount = debtAmount - actualRepaid;
+        totalDebt -= actualRepaid;
+
+        USDC.safeTransferFrom(payer, address(this), actualRepaid);
+
+        emit Repaid(payer, account, actualRepaid);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        if (debtAmount == 0 || elapsed == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            ANNUAL_INTEREST_BPS * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        if (interestAmount != 0) {
+            debtAmount += interestAmount;
+            position.debtAmount = debtAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount);
+        }
+
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _previewDebt(Position storage position) internal view returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        if (debtAmount == 0 || position.lastAccrued == 0) return debtAmount;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return debtAmount;
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            ANNUAL_INTEREST_BPS * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        return debtAmount + interestAmount;
+    }
+
+    function _ensureWithinBorrowLimit(Position storage position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        if (_previewDebt(position) > _maxBorrowAllowed(collateralValue)) revert BorrowLimitExceeded();
+    }
+
+    function _isLiquidatable(Position storage position, uint256 collateralValue) internal view returns (bool) {
+        if (position.debtAmount == 0) return false;
+        return _previewDebt(position) > _liquidationThresholdValue(collateralValue);
+    }
+
+    function _maxBorrowAllowed(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, MAX_BORROW_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _liquidationThresholdValue(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, LIQUIDATION_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        return Math.mulDiv(collateralAmount, _latestPriceE18(), 1e30);
+    }
+
+    function _collateralForDebt(uint256 debtAmount, uint256 collateralPrice) internal pure returns (uint256) {
+        return Math.mulDiv(debtAmount, 1e30, collateralPrice, Math.Rounding.Ceil);
+    }
+
+    function _latestPriceE18() internal view returns (uint256 priceE18) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (updatedAt < block.timestamp - ORACLE_MAX_AGE) revert StaleOraclePrice();
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE18 = Math.mulDiv(uint256(answer), 1e18, 10 ** ORACLE_DECIMALS);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregator.sol b/src/interfaces/IChainlinkAggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac49565e307a4ef1fa561e25618e76c369144687
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregator.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregator {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
+

exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
exec
/bin/bash -lc "sed -n '1,260p' src/ETHBorrowMarket.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 succeeded in 7ms:
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

import {IChainlinkAggregator} from "./interfaces/IChainlinkAggregator.sol";

contract ETHBorrowMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant COLLATERAL_SCALE = 1e18;
    uint256 public constant USDC_SCALE = 1e6;
    uint256 public constant YEAR = 365 days;
    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    IChainlinkAggregator public immutable COLLATERAL_ORACLE;
    uint8 public immutable ORACLE_DECIMALS;
    uint256 public immutable ANNUAL_INTEREST_BPS;
    uint256 public immutable ORACLE_MAX_AGE;

    uint256 public totalDebt;

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
        uint64 lastAccrued;
    }

    mapping(address account => Position position) public positions;

    error ZeroAmount();
    error ZeroAddress();
    error InvalidOracleAnswer();
    error InvalidOracleMaxAge();
    error StaleOraclePrice();
    error UnsupportedUsdcDecimals();
    error InterestRateTooHigh();
    error BorrowLimitExceeded();
    error PositionNotLiquidatable();
    error InsufficientLiquidity();
    error NoDebt();
    error NotEnoughCollateral();

    event CollateralDeposited(address indexed account, uint256 amount);
    event CollateralWithdrawn(address indexed account, uint256 amount);
    event Borrowed(address indexed account, uint256 amount);
    event Repaid(address indexed payer, address indexed account, uint256 amount);
    event Liquidated(
        address indexed liquidator,
        address indexed account,
        address indexed receiver,
        uint256 repaidDebt,
        uint256 seizedCollateral
    );
    event InterestAccrued(address indexed account, uint256 interestAmount);

    constructor(
        address weth_,
        address usdc_,
        address collateralOracle_,
        uint256 annualInterestBps_,
        uint256 oracleMaxAge_
    ) {
        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) revert ZeroAddress();
        if (annualInterestBps_ > BASIS_POINTS) revert InterestRateTooHigh();
        if (oracleMaxAge_ == 0) revert InvalidOracleMaxAge();
        if (IERC20Metadata(usdc_).decimals() != 6) revert UnsupportedUsdcDecimals();

        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        COLLATERAL_ORACLE = IChainlinkAggregator(collateralOracle_);
        ORACLE_DECIMALS = IChainlinkAggregator(collateralOracle_).decimals();
        ANNUAL_INTEREST_BPS = annualInterestBps_;
        ORACLE_MAX_AGE = oracleMaxAge_;
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrueInterest(position, msg.sender);
        position.collateralAmount += amount;

        WETH.safeTransferFrom(msg.sender, address(this), amount);

        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrueInterest(position, msg.sender);

        if (amount > position.collateralAmount) revert NotEnoughCollateral();

        position.collateralAmount -= amount;
        _ensureWithinBorrowLimit(position);

        WETH.safeTransfer(msg.sender, amount);

        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrueInterest(position, msg.sender);

        position.debtAmount += amount;
        totalDebt += amount;
        _ensureWithinBorrowLimit(position);

        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
        USDC.safeTransfer(msg.sender, amount);

        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        actualRepaid = _repay(position, msg.sender, msg.sender, amount);
    }

    function liquidate(address account, uint256 requestedRepayAmount, address receiver)
        external
        nonReentrant
        returns (uint256 actualRepaid, uint256 collateralSeized)
    {
        if (requestedRepayAmount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        Position storage position = positions[account];
        uint256 debtAmount = _accrueInterest(position, account);

        if (debtAmount == 0) revert NoDebt();
        if (!_isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount))) revert PositionNotLiquidatable();

        uint256 collateralPrice = _latestPriceE18();
        uint256 maxRepayAgainstCollateral = Math.mulDiv(
            _collateralValueInUsdc(position.collateralAmount),
            BASIS_POINTS,
            BASIS_POINTS + LIQUIDATION_BONUS_BPS
        );

        actualRepaid = requestedRepayAmount;
        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
        if (actualRepaid > maxRepayAgainstCollateral) actualRepaid = maxRepayAgainstCollateral;
        if (actualRepaid == 0) revert NotEnoughCollateral();

        collateralSeized = _collateralForDebt(actualRepaid, collateralPrice);
        collateralSeized = Math.mulDiv(
            collateralSeized,
            BASIS_POINTS + LIQUIDATION_BONUS_BPS,
            BASIS_POINTS,
            Math.Rounding.Ceil
        );

        if (collateralSeized > position.collateralAmount) revert NotEnoughCollateral();

        position.debtAmount = debtAmount - actualRepaid;
        position.collateralAmount -= collateralSeized;
        totalDebt -= actualRepaid;

        USDC.safeTransferFrom(msg.sender, address(this), actualRepaid);
        WETH.safeTransfer(receiver, collateralSeized);

        emit Repaid(msg.sender, account, actualRepaid);
        emit Liquidated(msg.sender, account, receiver, actualRepaid, collateralSeized);
    }

    function previewDebt(address account) external view returns (uint256) {
        Position storage position = positions[account];
        return _previewDebt(position);
    }

    function collateralValueInUsdc(address account) external view returns (uint256) {
        return _collateralValueInUsdc(positions[account].collateralAmount);
    }

    function maxBorrowable(address account) external view returns (uint256) {
        return _maxBorrowAllowed(_collateralValueInUsdc(positions[account].collateralAmount));
    }

    function liquidationThreshold(address account) external view returns (uint256) {
        return _liquidationThresholdValue(_collateralValueInUsdc(positions[account].collateralAmount));
    }

    function isLiquidatable(address account) external view returns (bool) {
        Position storage position = positions[account];
        return _isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount));
    }

    function _repay(Position storage position, address account, address payer, uint256 amount)
        internal
        returns (uint256 actualRepaid)
    {
        uint256 debtAmount = _accrueInterest(position, account);
        if (debtAmount == 0) revert NoDebt();

        actualRepaid = amount > debtAmount ? debtAmount : amount;

        position.debtAmount = debtAmount - actualRepaid;
        totalDebt -= actualRepaid;

        USDC.safeTransferFrom(payer, address(this), actualRepaid);

        emit Repaid(payer, account, actualRepaid);
    }

    function _accrueInterest(Position storage position, address account) internal returns (uint256 debtAmount) {
        debtAmount = position.debtAmount;
        uint256 lastAccrued = position.lastAccrued;

        if (lastAccrued == 0) {
            position.lastAccrued = uint64(block.timestamp);
            return debtAmount;
        }

        uint256 elapsed = block.timestamp - lastAccrued;
        if (debtAmount == 0 || elapsed == 0) {
            position.lastAccrued = uint64(block.timestamp);
            return debtAmount;
        }

        uint256 interestAmount = Math.mulDiv(
            debtAmount,
            ANNUAL_INTEREST_BPS * elapsed,
            BASIS_POINTS * YEAR
        );

        if (interestAmount != 0) {
            debtAmount += interestAmount;
            position.debtAmount = debtAmount;
            totalDebt += interestAmount;
            emit InterestAccrued(account, interestAmount);
        }

        position.lastAccrued = uint64(block.timestamp);
    }

    function _previewDebt(Position storage position) internal view returns (uint256 debtAmount) {
        debtAmount = position.debtAmount;
        if (debtAmount == 0 || position.lastAccrued == 0) return debtAmount;

        uint256 elapsed = block.timestamp - position.lastAccrued;
        if (elapsed == 0) return debtAmount;


exec
/bin/bash -lc "sed -n '261,360p' src/ETHBorrowMarket.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002
 succeeded in 5ms:
        uint256 interestAmount = Math.mulDiv(
            debtAmount,
            ANNUAL_INTEREST_BPS * elapsed,
            BASIS_POINTS * YEAR
        );

        return debtAmount + interestAmount;
    }

    function _ensureWithinBorrowLimit(Position storage position) internal view {
        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
        if (_previewDebt(position) > _maxBorrowAllowed(collateralValue)) revert BorrowLimitExceeded();
    }

    function _isLiquidatable(Position storage position, uint256 collateralValue) internal view returns (bool) {
        if (position.debtAmount == 0) return false;
        return _previewDebt(position) > _liquidationThresholdValue(collateralValue);
    }

    function _maxBorrowAllowed(uint256 collateralValue) internal pure returns (uint256) {
        return Math.mulDiv(collateralValue, MAX_BORROW_LTV_BPS, BASIS_POINTS);
    }

    function _liquidationThresholdValue(uint256 collateralValue) internal pure returns (uint256) {
        return Math.mulDiv(collateralValue, LIQUIDATION_LTV_BPS, BASIS_POINTS);
    }

    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
        return Math.mulDiv(collateralAmount, _latestPriceE18(), 1e30);
    }

    function _collateralForDebt(uint256 debtAmount, uint256 collateralPrice) internal pure returns (uint256) {
        return Math.mulDiv(debtAmount, 1e30, collateralPrice, Math.Rounding.Ceil);
    }

    function _latestPriceE18() internal view returns (uint256 priceE18) {
        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();

        if (answer <= 0) revert InvalidOracleAnswer();
        if (updatedAt < block.timestamp - ORACLE_MAX_AGE) revert StaleOraclePrice();

        // forge-lint: disable-next-line(unsafe-typecast)
        priceE18 = Math.mulDiv(uint256(answer), 1e18, 10 ** ORACLE_DECIMALS);
    }
}

 succeeded in 590ms:
Compiling 2 files with Solc 0.8.26
Solc 0.8.26 finished in 508.51ms
Compiler run successful!
2026-09-04T13:04:18.415558Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..e239d3b396eae83d752133ee961f6f4134087058
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache
+/out
+/broadcast
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a857e9c1ec40dc1a8477681b2c540d2522c63e3e
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Notes
+
+## Health computation
+
+The market tracks each account's position as:
+
+- `collateralAmount` in WETH, scaled to `1e18`
+- `debtAmount` in USDC base units, scaled to `1e6`
+- `lastAccrued` timestamp for lazy interest accrual
+
+Interest accrues linearly whenever a position is touched or queried:
+
+```text
+interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)
+accruedDebt = debtAmount + interest
+```
+
+Collateral value is computed from the latest Chainlink ETH/USD answer and normalized into USDC base units:
+
+```text
+collateralValueUsdc = wethAmount * ethPriceUsd / 1e30
+```
+
+There are two thresholds:
+
+- Borrow / withdrawal limit: `accruedDebt <= collateralValueUsdc * 70%`
+- Liquidation threshold: `accruedDebt > collateralValueUsdc * 85%`
+
+That means a borrower can only increase leverage or withdraw collateral if the resulting position remains at or below 70% LTV. Liquidation starts once the position moves above 85% LTV.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Read the borrower's live debt and confirm the position is above the 85% liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, repayAmount, receiver)`.
+
+The contract caps the actual repay amount to the lesser of:
+
+- the requested repay amount
+- the borrower's current debt
+- the amount that can be covered by the remaining collateral after applying the 5% liquidation bonus
+
+Seized collateral is:
+
+```text
+baseCollateral = repayAmount / ethPrice
+seizedCollateral = baseCollateral * 1.05
+```
+
+The liquidator transfers in USDC and receives WETH directly to `receiver`.
+
+## Mainnet deployment / operations
+
+An operator needs to get these right:
+
+- Use canonical mainnet WETH and USDC addresses, and a manipulation-resistant ETH/USD oracle.
+- Set `ORACLE_MAX_AGE` to a value derived from the oracle heartbeat plus a safety margin. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, healthy positions may become temporarily unusable.
+- Prefund the contract with enough USDC liquidity before allowing borrowing. Borrows are paid from the contract's current USDC balance.
+- Pick an `ANNUAL_INTEREST_BPS` that matches the intended product economics, because it is immutable in this version.
+- Verify that the chosen oracle decimals and token decimals match the assumptions here: WETH `18`, USDC `6`.
+- Run mainnet-fork tests against the exact deployment configuration, especially for staleness handling, rounding around the 70% and 85% thresholds, and liquidation behavior when collateral value has dropped sharply.
+- Monitor liquidity. If the contract runs out of idle USDC, new borrows revert even if users still have borrow capacity.
+
+Example deploy command:
+
+```bash
+WETH=<weth-address> \
+USDC=<usdc-address> \
+COLLATERAL_ORACLE=<eth-usd-oracle-address> \
+ANNUAL_INTEREST_BPS=500 \
+ORACLE_MAX_AGE=5400 \
+forge script script/Deploy.s.sol:Deploy --rpc-url $MAINNET_RPC_URL --broadcast
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..2047e6906a765b5a3d52b61e18c2d40277361bf9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27d03c1e30e49ed4d466e638df745e6a9894fa65
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "lib/openzeppelin-contracts/lib/forge-std/src/Script.sol";
+
+import {ETHBorrowMarket} from "../src/ETHBorrowMarket.sol";
+
+contract Deploy is Script {
+    function run() external returns (ETHBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address collateralOracle = vm.envAddress("COLLATERAL_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 oracleMaxAge = vm.envUint("ORACLE_MAX_AGE");
+
+        vm.startBroadcast();
+        market = new ETHBorrowMarket(
+            weth,
+            usdc,
+            collateralOracle,
+            annualInterestBps,
+            oracleMaxAge
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/ETHBorrowMarket.sol b/src/ETHBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9a1a06f7e9e86520446dead40984f7e1e195a686
--- /dev/null
+++ b/src/ETHBorrowMarket.sol
@@ -0,0 +1,305 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregator} from "./interfaces/IChainlinkAggregator.sol";
+
+contract ETHBorrowMarket is ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BASIS_POINTS = 10_000;
+    uint256 public constant COLLATERAL_SCALE = 1e18;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregator public immutable COLLATERAL_ORACLE;
+    uint8 public immutable ORACLE_DECIMALS;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable ORACLE_MAX_AGE;
+
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint64 lastAccrued;
+    }
+
+    mapping(address account => Position position) public positions;
+
+    error ZeroAmount();
+    error ZeroAddress();
+    error InvalidOracleAnswer();
+    error InvalidOracleMaxAge();
+    error StaleOraclePrice();
+    error UnsupportedUsdcDecimals();
+    error InterestRateTooHigh();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NotEnoughCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 seizedCollateral
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 oracleMaxAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) revert ZeroAddress();
+        if (annualInterestBps_ > BASIS_POINTS) revert InterestRateTooHigh();
+        if (oracleMaxAge_ == 0) revert InvalidOracleMaxAge();
+        if (IERC20Metadata(usdc_).decimals() != 6) revert UnsupportedUsdcDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregator(collateralOracle_);
+        ORACLE_DECIMALS = IChainlinkAggregator(collateralOracle_).decimals();
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        ORACLE_MAX_AGE = oracleMaxAge_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (amount > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.collateralAmount -= amount;
+        _ensureWithinBorrowLimit(position);
+
+        WETH.safeTransfer(msg.sender, amount);
+
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.debtAmount += amount;
+        totalDebt += amount;
+        _ensureWithinBorrowLimit(position);
+
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+        USDC.safeTransfer(msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        actualRepaid = _repay(position, msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount, address receiver)
+        external
+        nonReentrant
+        returns (uint256 actualRepaid, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert ZeroAddress();
+
+        Position storage position = positions[account];
+        uint256 debtAmount = _accrueInterest(position, account);
+
+        if (debtAmount == 0) revert NoDebt();
+        if (!_isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount))) revert PositionNotLiquidatable();
+
+        uint256 collateralPrice = _latestPriceE18();
+        uint256 maxRepayAgainstCollateral = Math.mulDiv(
+            _collateralValueInUsdc(position.collateralAmount),
+            BASIS_POINTS,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS
+        );
+
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayAgainstCollateral) actualRepaid = maxRepayAgainstCollateral;
+        if (actualRepaid == 0) revert NotEnoughCollateral();
+
+        collateralSeized = _collateralForDebt(actualRepaid, collateralPrice);
+        collateralSeized = Math.mulDiv(
+            collateralSeized,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS,
+            BASIS_POINTS,
+            Math.Rounding.Ceil
+        );
+
+        if (collateralSeized > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.debtAmount = debtAmount - actualRepaid;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepaid;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepaid);
+        WETH.safeTransfer(receiver, collateralSeized);
+
+        emit Repaid(msg.sender, account, actualRepaid);
+        emit Liquidated(msg.sender, account, receiver, actualRepaid, collateralSeized);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        return _previewDebt(position);
+    }
+
+    function collateralValueInUsdc(address account) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[account].collateralAmount);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowAllowed(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function liquidationThreshold(address account) external view returns (uint256) {
+        return _liquidationThresholdValue(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position storage position = positions[account];
+        return _isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount));
+    }
+
+    function _repay(Position storage position, address account, address payer, uint256 amount)
+        internal
+        returns (uint256 actualRepaid)
+    {
+        uint256 debtAmount = _accrueInterest(position, account);
+        if (debtAmount == 0) revert NoDebt();
+
+        actualRepaid = amount > debtAmount ? debtAmount : amount;
+
+        position.debtAmount = debtAmount - actualRepaid;
+        totalDebt -= actualRepaid;
+
+        USDC.safeTransferFrom(payer, address(this), actualRepaid);
+
+        emit Repaid(payer, account, actualRepaid);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        if (debtAmount == 0 || elapsed == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            ANNUAL_INTEREST_BPS * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        if (interestAmount != 0) {
+            debtAmount += interestAmount;
+            position.debtAmount = debtAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount);
+        }
+
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _previewDebt(Position storage position) internal view returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        if (debtAmount == 0 || position.lastAccrued == 0) return debtAmount;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return debtAmount;
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            ANNUAL_INTEREST_BPS * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        return debtAmount + interestAmount;
+    }
+
+    function _ensureWithinBorrowLimit(Position storage position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        if (_previewDebt(position) > _maxBorrowAllowed(collateralValue)) revert BorrowLimitExceeded();
+    }
+
+    function _isLiquidatable(Position storage position, uint256 collateralValue) internal view returns (bool) {
+        if (position.debtAmount == 0) return false;
+        return _previewDebt(position) > _liquidationThresholdValue(collateralValue);
+    }
+
+    function _maxBorrowAllowed(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, MAX_BORROW_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _liquidationThresholdValue(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, LIQUIDATION_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        return Math.mulDiv(collateralAmount, _latestPriceE18(), 1e30);
+    }
+
+    function _collateralForDebt(uint256 debtAmount, uint256 collateralPrice) internal pure returns (uint256) {
+        return Math.mulDiv(debtAmount, 1e30, collateralPrice, Math.Rounding.Ceil);
+    }
+
+    function _latestPriceE18() internal view returns (uint256 priceE18) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (updatedAt < block.timestamp - ORACLE_MAX_AGE) revert StaleOraclePrice();
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE18 = Math.mulDiv(uint256(answer), 1e18, 10 ** ORACLE_DECIMALS);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregator.sol b/src/interfaces/IChainlinkAggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac49565e307a4ef1fa561e25618e76c369144687
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregator.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregator {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
+

  ✓ Scaffold Foundry project structure and dependencies
  ✓ Implement borrowing market contracts and interfaces
  ✓ Write NOTES.md with health, liquidation, and deployment guidance
  ✓ Run forge build and resolve compile issues
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..e239d3b396eae83d752133ee961f6f4134087058
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache
+/out
+/broadcast
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a857e9c1ec40dc1a8477681b2c540d2522c63e3e
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Notes
+
+## Health computation
+
+The market tracks each account's position as:
+
+- `collateralAmount` in WETH, scaled to `1e18`
+- `debtAmount` in USDC base units, scaled to `1e6`
+- `lastAccrued` timestamp for lazy interest accrual
+
+Interest accrues linearly whenever a position is touched or queried:
+
+```text
+interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)
+accruedDebt = debtAmount + interest
+```
+
+Collateral value is computed from the latest Chainlink ETH/USD answer and normalized into USDC base units:
+
+```text
+collateralValueUsdc = wethAmount * ethPriceUsd / 1e30
+```
+
+There are two thresholds:
+
+- Borrow / withdrawal limit: `accruedDebt <= collateralValueUsdc * 70%`
+- Liquidation threshold: `accruedDebt > collateralValueUsdc * 85%`
+
+That means a borrower can only increase leverage or withdraw collateral if the resulting position remains at or below 70% LTV. Liquidation starts once the position moves above 85% LTV.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Read the borrower's live debt and confirm the position is above the 85% liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, repayAmount, receiver)`.
+
+The contract caps the actual repay amount to the lesser of:
+
+- the requested repay amount
+- the borrower's current debt
+- the amount that can be covered by the remaining collateral after applying the 5% liquidation bonus
+
+Seized collateral is:
+
+```text
+baseCollateral = repayAmount / ethPrice
+seizedCollateral = baseCollateral * 1.05
+```
+
+The liquidator transfers in USDC and receives WETH directly to `receiver`.
+
+## Mainnet deployment / operations
+
+An operator needs to get these right:
+
+- Use canonical mainnet WETH and USDC addresses, and a manipulation-resistant ETH/USD oracle.
+- Set `ORACLE_MAX_AGE` to a value derived from the oracle heartbeat plus a safety margin. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, healthy positions may become temporarily unusable.
+- Prefund the contract with enough USDC liquidity before allowing borrowing. Borrows are paid from the contract's current USDC balance.
+- Pick an `ANNUAL_INTEREST_BPS` that matches the intended product economics, because it is immutable in this version.
+- Verify that the chosen oracle decimals and token decimals match the assumptions here: WETH `18`, USDC `6`.
+- Run mainnet-fork tests against the exact deployment configuration, especially for staleness handling, rounding around the 70% and 85% thresholds, and liquidation behavior when collateral value has dropped sharply.
+- Monitor liquidity. If the contract runs out of idle USDC, new borrows revert even if users still have borrow capacity.
+
+Example deploy command:
+
+```bash
+WETH=<weth-address> \
+USDC=<usdc-address> \
+COLLATERAL_ORACLE=<eth-usd-oracle-address> \
+ANNUAL_INTEREST_BPS=500 \
+ORACLE_MAX_AGE=5400 \
+forge script script/Deploy.s.sol:Deploy --rpc-url $MAINNET_RPC_URL --broadcast
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..2047e6906a765b5a3d52b61e18c2d40277361bf9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27d03c1e30e49ed4d466e638df745e6a9894fa65
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "lib/openzeppelin-contracts/lib/forge-std/src/Script.sol";
+
+import {ETHBorrowMarket} from "../src/ETHBorrowMarket.sol";
+
+contract Deploy is Script {
+    function run() external returns (ETHBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address collateralOracle = vm.envAddress("COLLATERAL_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 oracleMaxAge = vm.envUint("ORACLE_MAX_AGE");
+
+        vm.startBroadcast();
+        market = new ETHBorrowMarket(
+            weth,
+            usdc,
+            collateralOracle,
+            annualInterestBps,
+            oracleMaxAge
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/ETHBorrowMarket.sol b/src/ETHBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9a1a06f7e9e86520446dead40984f7e1e195a686
--- /dev/null
+++ b/src/ETHBorrowMarket.sol
@@ -0,0 +1,305 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregator} from "./interfaces/IChainlinkAggregator.sol";
+
+contract ETHBorrowMarket is ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BASIS_POINTS = 10_000;
+    uint256 public constant COLLATERAL_SCALE = 1e18;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregator public immutable COLLATERAL_ORACLE;
+    uint8 public immutable ORACLE_DECIMALS;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable ORACLE_MAX_AGE;
+
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint64 lastAccrued;
+    }
+
+    mapping(address account => Position position) public positions;
+
+    error ZeroAmount();
+    error ZeroAddress();
+    error InvalidOracleAnswer();
+    error InvalidOracleMaxAge();
+    error StaleOraclePrice();
+    error UnsupportedUsdcDecimals();
+    error InterestRateTooHigh();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NotEnoughCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 seizedCollateral
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 oracleMaxAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) revert ZeroAddress();
+        if (annualInterestBps_ > BASIS_POINTS) revert InterestRateTooHigh();
+        if (oracleMaxAge_ == 0) revert InvalidOracleMaxAge();
+        if (IERC20Metadata(usdc_).decimals() != 6) revert UnsupportedUsdcDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregator(collateralOracle_);
+        ORACLE_DECIMALS = IChainlinkAggregator(collateralOracle_).decimals();
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        ORACLE_MAX_AGE = oracleMaxAge_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (amount > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.collateralAmount -= amount;
+        _ensureWithinBorrowLimit(position);
+
+        WETH.safeTransfer(msg.sender, amount);
+
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.debtAmount += amount;
+        totalDebt += amount;
+        _ensureWithinBorrowLimit(position);
+
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+        USDC.safeTransfer(msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        actualRepaid = _repay(position, msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount, address receiver)
+        external
+        nonReentrant
+        returns (uint256 actualRepaid, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert ZeroAddress();
+
+        Position storage position = positions[account];
+        uint256 debtAmount = _accrueInterest(position, account);
+
+        if (debtAmount == 0) revert NoDebt();
+        if (!_isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount))) revert PositionNotLiquidatable();
+
+        uint256 collateralPrice = _latestPriceE18();
+        uint256 maxRepayAgainstCollateral = Math.mulDiv(
+            _collateralValueInUsdc(position.collateralAmount),
+            BASIS_POINTS,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS
+        );
+
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayAgainstCollateral) actualRepaid = maxRepayAgainstCollateral;
+        if (actualRepaid == 0) revert NotEnoughCollateral();
+
+        collateralSeized = _collateralForDebt(actualRepaid, collateralPrice);
+        collateralSeized = Math.mulDiv(
+            collateralSeized,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS,
+            BASIS_POINTS,
+            Math.Rounding.Ceil
+        );
+
+        if (collateralSeized > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.debtAmount = debtAmount - actualRepaid;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepaid;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepaid);
+        WETH.safeTransfer(receiver, collateralSeized);
+
+        emit Repaid(msg.sender, account, actualRepaid);
+        emit Liquidated(msg.sender, account, receiver, actualRepaid, collateralSeized);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        return _previewDebt(position);
+    }
+
+    function collateralValueInUsdc(address account) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[account].collateralAmount);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowAllowed(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function liquidationThreshold(address account) external view returns (uint256) {
+        return _liquidationThresholdValue(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position storage position = positions[account];
+        return _isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount));
+    }
+
+    function _repay(Position storage position, address account, address payer, uint256 amount)
+        internal
+        returns (uint256 actualRepaid)
+    {
+        uint256 debtAmount = _accrueInterest(position, account);
+        if (debtAmount == 0) revert NoDebt();
+
+        actualRepaid = amount > debtAmount ? debtAmount : amount;
+
+        position.debtAmount = debtAmount - actualRepaid;
+        totalDebt -= actualRepaid;
+
+        USDC.safeTransferFrom(payer, address(this), actualRepaid);
+
+        emit Repaid(payer, account, actualRepaid);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        if (debtAmount == 0 || elapsed == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            ANNUAL_INTEREST_BPS * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        if (interestAmount != 0) {
+            debtAmount += interestAmount;
+            position.debtAmount = debtAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount);
+        }
+
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _previewDebt(Position storage position) internal view returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        if (debtAmount == 0 || position.lastAccrued == 0) return debtAmount;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return debtAmount;
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            ANNUAL_INTEREST_BPS * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        return debtAmount + interestAmount;
+    }
+
+    function _ensureWithinBorrowLimit(Position storage position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        if (_previewDebt(position) > _maxBorrowAllowed(collateralValue)) revert BorrowLimitExceeded();
+    }
+
+    function _isLiquidatable(Position storage position, uint256 collateralValue) internal view returns (bool) {
+        if (position.debtAmount == 0) return false;
+        return _previewDebt(position) > _liquidationThresholdValue(collateralValue);
+    }
+
+    function _maxBorrowAllowed(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, MAX_BORROW_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _liquidationThresholdValue(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, LIQUIDATION_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        return Math.mulDiv(collateralAmount, _latestPriceE18(), 1e30);
+    }
+
+    function _collateralForDebt(uint256 debtAmount, uint256 collateralPrice) internal pure returns (uint256) {
+        return Math.mulDiv(debtAmount, 1e30, collateralPrice, Math.Rounding.Ceil);
+    }
+
+    function _latestPriceE18() internal view returns (uint256 priceE18) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (updatedAt < block.timestamp - ORACLE_MAX_AGE) revert StaleOraclePrice();
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE18 = Math.mulDiv(uint256(answer), 1e18, 10 ** ORACLE_DECIMALS);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregator.sol b/src/interfaces/IChainlinkAggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac49565e307a4ef1fa561e25618e76c369144687
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregator.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregator {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
+

codex
Built a minimal Foundry project for the market in [src/ETHBorrowMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/src/ETHBorrowMarket.sol:1), with a deploy script in [script/Deploy.s.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/script/Deploy.s.sol:1) and the oracle interface in [src/interfaces/IChainlinkAggregator.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/src/interfaces/IChainlinkAggregator.sol:1). The contract supports WETH collateral deposits, USDC borrows up to 70% LTV, lazy linear interest accrual, borrower repayments, borrower withdrawals subject to the 70% limit, and third-party liquidations once debt exceeds the 85% threshold with a 5% WETH bonus.

I also added [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/foundry.toml:1), [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/NOTES.md:1), and `.gitignore`. `NOTES.md` covers the health math, liquidation steps, and the operator-side deployment requirements for mainnet.

Verification: `forge build` passes successfully. I did not add tests in this pass.
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..e239d3b396eae83d752133ee961f6f4134087058
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+/cache
+/out
+/broadcast
+
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..a857e9c1ec40dc1a8477681b2c540d2522c63e3e
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,75 @@
+# Notes
+
+## Health computation
+
+The market tracks each account's position as:
+
+- `collateralAmount` in WETH, scaled to `1e18`
+- `debtAmount` in USDC base units, scaled to `1e6`
+- `lastAccrued` timestamp for lazy interest accrual
+
+Interest accrues linearly whenever a position is touched or queried:
+
+```text
+interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)
+accruedDebt = debtAmount + interest
+```
+
+Collateral value is computed from the latest Chainlink ETH/USD answer and normalized into USDC base units:
+
+```text
+collateralValueUsdc = wethAmount * ethPriceUsd / 1e30
+```
+
+There are two thresholds:
+
+- Borrow / withdrawal limit: `accruedDebt <= collateralValueUsdc * 70%`
+- Liquidation threshold: `accruedDebt > collateralValueUsdc * 85%`
+
+That means a borrower can only increase leverage or withdraw collateral if the resulting position remains at or below 70% LTV. Liquidation starts once the position moves above 85% LTV.
+
+## Liquidation flow
+
+A liquidator must:
+
+1. Read the borrower's live debt and confirm the position is above the 85% liquidation threshold.
+2. Approve USDC to the market contract.
+3. Call `liquidate(account, repayAmount, receiver)`.
+
+The contract caps the actual repay amount to the lesser of:
+
+- the requested repay amount
+- the borrower's current debt
+- the amount that can be covered by the remaining collateral after applying the 5% liquidation bonus
+
+Seized collateral is:
+
+```text
+baseCollateral = repayAmount / ethPrice
+seizedCollateral = baseCollateral * 1.05
+```
+
+The liquidator transfers in USDC and receives WETH directly to `receiver`.
+
+## Mainnet deployment / operations
+
+An operator needs to get these right:
+
+- Use canonical mainnet WETH and USDC addresses, and a manipulation-resistant ETH/USD oracle.
+- Set `ORACLE_MAX_AGE` to a value derived from the oracle heartbeat plus a safety margin. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, healthy positions may become temporarily unusable.
+- Prefund the contract with enough USDC liquidity before allowing borrowing. Borrows are paid from the contract's current USDC balance.
+- Pick an `ANNUAL_INTEREST_BPS` that matches the intended product economics, because it is immutable in this version.
+- Verify that the chosen oracle decimals and token decimals match the assumptions here: WETH `18`, USDC `6`.
+- Run mainnet-fork tests against the exact deployment configuration, especially for staleness handling, rounding around the 70% and 85% thresholds, and liquidation behavior when collateral value has dropped sharply.
+- Monitor liquidity. If the contract runs out of idle USDC, new borrows revert even if users still have borrow capacity.
+
+Example deploy command:
+
+```bash
+WETH=<weth-address> \
+USDC=<usdc-address> \
+COLLATERAL_ORACLE=<eth-usd-oracle-address> \
+ANNUAL_INTEREST_BPS=500 \
+ORACLE_MAX_AGE=5400 \
+forge script script/Deploy.s.sol:Deploy --rpc-url $MAINNET_RPC_URL --broadcast
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..2047e6906a765b5a3d52b61e18c2d40277361bf9
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+evm_version = "cancun"
+
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..27d03c1e30e49ed4d466e638df745e6a9894fa65
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {Script} from "lib/openzeppelin-contracts/lib/forge-std/src/Script.sol";
+
+import {ETHBorrowMarket} from "../src/ETHBorrowMarket.sol";
+
+contract Deploy is Script {
+    function run() external returns (ETHBorrowMarket market) {
+        address weth = vm.envAddress("WETH");
+        address usdc = vm.envAddress("USDC");
+        address collateralOracle = vm.envAddress("COLLATERAL_ORACLE");
+        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
+        uint256 oracleMaxAge = vm.envUint("ORACLE_MAX_AGE");
+
+        vm.startBroadcast();
+        market = new ETHBorrowMarket(
+            weth,
+            usdc,
+            collateralOracle,
+            annualInterestBps,
+            oracleMaxAge
+        );
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/src/ETHBorrowMarket.sol b/src/ETHBorrowMarket.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9a1a06f7e9e86520446dead40984f7e1e195a686
--- /dev/null
+++ b/src/ETHBorrowMarket.sol
@@ -0,0 +1,305 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+import {IChainlinkAggregator} from "./interfaces/IChainlinkAggregator.sol";
+
+contract ETHBorrowMarket is ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    uint256 public constant BASIS_POINTS = 10_000;
+    uint256 public constant COLLATERAL_SCALE = 1e18;
+    uint256 public constant USDC_SCALE = 1e6;
+    uint256 public constant YEAR = 365 days;
+    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
+    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
+    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
+
+    IERC20 public immutable WETH;
+    IERC20 public immutable USDC;
+    IChainlinkAggregator public immutable COLLATERAL_ORACLE;
+    uint8 public immutable ORACLE_DECIMALS;
+    uint256 public immutable ANNUAL_INTEREST_BPS;
+    uint256 public immutable ORACLE_MAX_AGE;
+
+    uint256 public totalDebt;
+
+    struct Position {
+        uint256 collateralAmount;
+        uint256 debtAmount;
+        uint64 lastAccrued;
+    }
+
+    mapping(address account => Position position) public positions;
+
+    error ZeroAmount();
+    error ZeroAddress();
+    error InvalidOracleAnswer();
+    error InvalidOracleMaxAge();
+    error StaleOraclePrice();
+    error UnsupportedUsdcDecimals();
+    error InterestRateTooHigh();
+    error BorrowLimitExceeded();
+    error PositionNotLiquidatable();
+    error InsufficientLiquidity();
+    error NoDebt();
+    error NotEnoughCollateral();
+
+    event CollateralDeposited(address indexed account, uint256 amount);
+    event CollateralWithdrawn(address indexed account, uint256 amount);
+    event Borrowed(address indexed account, uint256 amount);
+    event Repaid(address indexed payer, address indexed account, uint256 amount);
+    event Liquidated(
+        address indexed liquidator,
+        address indexed account,
+        address indexed receiver,
+        uint256 repaidDebt,
+        uint256 seizedCollateral
+    );
+    event InterestAccrued(address indexed account, uint256 interestAmount);
+
+    constructor(
+        address weth_,
+        address usdc_,
+        address collateralOracle_,
+        uint256 annualInterestBps_,
+        uint256 oracleMaxAge_
+    ) {
+        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) revert ZeroAddress();
+        if (annualInterestBps_ > BASIS_POINTS) revert InterestRateTooHigh();
+        if (oracleMaxAge_ == 0) revert InvalidOracleMaxAge();
+        if (IERC20Metadata(usdc_).decimals() != 6) revert UnsupportedUsdcDecimals();
+
+        WETH = IERC20(weth_);
+        USDC = IERC20(usdc_);
+        COLLATERAL_ORACLE = IChainlinkAggregator(collateralOracle_);
+        ORACLE_DECIMALS = IChainlinkAggregator(collateralOracle_).decimals();
+        ANNUAL_INTEREST_BPS = annualInterestBps_;
+        ORACLE_MAX_AGE = oracleMaxAge_;
+    }
+
+    function depositCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+        position.collateralAmount += amount;
+
+        WETH.safeTransferFrom(msg.sender, address(this), amount);
+
+        emit CollateralDeposited(msg.sender, amount);
+    }
+
+    function withdrawCollateral(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        if (amount > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.collateralAmount -= amount;
+        _ensureWithinBorrowLimit(position);
+
+        WETH.safeTransfer(msg.sender, amount);
+
+        emit CollateralWithdrawn(msg.sender, amount);
+    }
+
+    function borrow(uint256 amount) external nonReentrant {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        _accrueInterest(position, msg.sender);
+
+        position.debtAmount += amount;
+        totalDebt += amount;
+        _ensureWithinBorrowLimit(position);
+
+        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
+        USDC.safeTransfer(msg.sender, amount);
+
+        emit Borrowed(msg.sender, amount);
+    }
+
+    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
+        if (amount == 0) revert ZeroAmount();
+
+        Position storage position = positions[msg.sender];
+        actualRepaid = _repay(position, msg.sender, msg.sender, amount);
+    }
+
+    function liquidate(address account, uint256 requestedRepayAmount, address receiver)
+        external
+        nonReentrant
+        returns (uint256 actualRepaid, uint256 collateralSeized)
+    {
+        if (requestedRepayAmount == 0) revert ZeroAmount();
+        if (receiver == address(0)) revert ZeroAddress();
+
+        Position storage position = positions[account];
+        uint256 debtAmount = _accrueInterest(position, account);
+
+        if (debtAmount == 0) revert NoDebt();
+        if (!_isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount))) revert PositionNotLiquidatable();
+
+        uint256 collateralPrice = _latestPriceE18();
+        uint256 maxRepayAgainstCollateral = Math.mulDiv(
+            _collateralValueInUsdc(position.collateralAmount),
+            BASIS_POINTS,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS
+        );
+
+        actualRepaid = requestedRepayAmount;
+        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
+        if (actualRepaid > maxRepayAgainstCollateral) actualRepaid = maxRepayAgainstCollateral;
+        if (actualRepaid == 0) revert NotEnoughCollateral();
+
+        collateralSeized = _collateralForDebt(actualRepaid, collateralPrice);
+        collateralSeized = Math.mulDiv(
+            collateralSeized,
+            BASIS_POINTS + LIQUIDATION_BONUS_BPS,
+            BASIS_POINTS,
+            Math.Rounding.Ceil
+        );
+
+        if (collateralSeized > position.collateralAmount) revert NotEnoughCollateral();
+
+        position.debtAmount = debtAmount - actualRepaid;
+        position.collateralAmount -= collateralSeized;
+        totalDebt -= actualRepaid;
+
+        USDC.safeTransferFrom(msg.sender, address(this), actualRepaid);
+        WETH.safeTransfer(receiver, collateralSeized);
+
+        emit Repaid(msg.sender, account, actualRepaid);
+        emit Liquidated(msg.sender, account, receiver, actualRepaid, collateralSeized);
+    }
+
+    function previewDebt(address account) external view returns (uint256) {
+        Position storage position = positions[account];
+        return _previewDebt(position);
+    }
+
+    function collateralValueInUsdc(address account) external view returns (uint256) {
+        return _collateralValueInUsdc(positions[account].collateralAmount);
+    }
+
+    function maxBorrowable(address account) external view returns (uint256) {
+        return _maxBorrowAllowed(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function liquidationThreshold(address account) external view returns (uint256) {
+        return _liquidationThresholdValue(_collateralValueInUsdc(positions[account].collateralAmount));
+    }
+
+    function isLiquidatable(address account) external view returns (bool) {
+        Position storage position = positions[account];
+        return _isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount));
+    }
+
+    function _repay(Position storage position, address account, address payer, uint256 amount)
+        internal
+        returns (uint256 actualRepaid)
+    {
+        uint256 debtAmount = _accrueInterest(position, account);
+        if (debtAmount == 0) revert NoDebt();
+
+        actualRepaid = amount > debtAmount ? debtAmount : amount;
+
+        position.debtAmount = debtAmount - actualRepaid;
+        totalDebt -= actualRepaid;
+
+        USDC.safeTransferFrom(payer, address(this), actualRepaid);
+
+        emit Repaid(payer, account, actualRepaid);
+    }
+
+    function _accrueInterest(Position storage position, address account) internal returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        uint256 lastAccrued = position.lastAccrued;
+
+        if (lastAccrued == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 elapsed = block.timestamp - lastAccrued;
+        if (debtAmount == 0 || elapsed == 0) {
+            position.lastAccrued = uint64(block.timestamp);
+            return debtAmount;
+        }
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            ANNUAL_INTEREST_BPS * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        if (interestAmount != 0) {
+            debtAmount += interestAmount;
+            position.debtAmount = debtAmount;
+            totalDebt += interestAmount;
+            emit InterestAccrued(account, interestAmount);
+        }
+
+        position.lastAccrued = uint64(block.timestamp);
+    }
+
+    function _previewDebt(Position storage position) internal view returns (uint256 debtAmount) {
+        debtAmount = position.debtAmount;
+        if (debtAmount == 0 || position.lastAccrued == 0) return debtAmount;
+
+        uint256 elapsed = block.timestamp - position.lastAccrued;
+        if (elapsed == 0) return debtAmount;
+
+        uint256 interestAmount = Math.mulDiv(
+            debtAmount,
+            ANNUAL_INTEREST_BPS * elapsed,
+            BASIS_POINTS * YEAR
+        );
+
+        return debtAmount + interestAmount;
+    }
+
+    function _ensureWithinBorrowLimit(Position storage position) internal view {
+        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
+        if (_previewDebt(position) > _maxBorrowAllowed(collateralValue)) revert BorrowLimitExceeded();
+    }
+
+    function _isLiquidatable(Position storage position, uint256 collateralValue) internal view returns (bool) {
+        if (position.debtAmount == 0) return false;
+        return _previewDebt(position) > _liquidationThresholdValue(collateralValue);
+    }
+
+    function _maxBorrowAllowed(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, MAX_BORROW_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _liquidationThresholdValue(uint256 collateralValue) internal pure returns (uint256) {
+        return Math.mulDiv(collateralValue, LIQUIDATION_LTV_BPS, BASIS_POINTS);
+    }
+
+    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
+        return Math.mulDiv(collateralAmount, _latestPriceE18(), 1e30);
+    }
+
+    function _collateralForDebt(uint256 debtAmount, uint256 collateralPrice) internal pure returns (uint256) {
+        return Math.mulDiv(debtAmount, 1e30, collateralPrice, Math.Rounding.Ceil);
+    }
+
+    function _latestPriceE18() internal view returns (uint256 priceE18) {
+        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();
+
+        if (answer <= 0) revert InvalidOracleAnswer();
+        if (updatedAt < block.timestamp - ORACLE_MAX_AGE) revert StaleOraclePrice();
+
+        // forge-lint: disable-next-line(unsafe-typecast)
+        priceE18 = Math.mulDiv(uint256(answer), 1e18, 10 ** ORACLE_DECIMALS);
+    }
+}
diff --git a/src/interfaces/IChainlinkAggregator.sol b/src/interfaces/IChainlinkAggregator.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ac49565e307a4ef1fa561e25618e76c369144687
--- /dev/null
+++ b/src/interfaces/IChainlinkAggregator.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.26;
+
+interface IChainlinkAggregator {
+    function decimals() external view returns (uint8);
+
+    function latestRoundData()
+        external
+        view
+        returns (
+            uint80 roundId,
+            int256 answer,
+            uint256 startedAt,
+            uint256 updatedAt,
+            uint80 answeredInRound
+        );
+}
+

tokens used
46,417
````

## final message

Built a minimal Foundry project for the market in [src/ETHBorrowMarket.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/src/ETHBorrowMarket.sol:1), with a deploy script in [script/Deploy.s.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/script/Deploy.s.sol:1) and the oracle interface in [src/interfaces/IChainlinkAggregator.sol](/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/src/interfaces/IChainlinkAggregator.sol:1). The contract supports WETH collateral deposits, USDC borrows up to 70% LTV, lazy linear interest accrual, borrower repayments, borrower withdrawals subject to the 70% limit, and third-party liquidations once debt exceeds the 85% threshold with a 5% WETH bonus.

I also added [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/foundry.toml:1), [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T125948Z-codex-with-skill-3/security-goal-002/NOTES.md:1), and `.gitignore`. `NOTES.md` covers the health math, liquidation steps, and the operator-side deployment requirements for mainnet.

Verification: `forge build` passes successfully. I did not add tests in this pass.

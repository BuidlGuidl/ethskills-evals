# Executor transcript — 2026-09-04T041625Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06aa4-4db8-78b1-b45a-c7222a6e606b
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
I’m setting up the Solidity project and implementing the vault contracts for a permissionless ERC-20 savings product. First I’m reading the security skill instructions and inspecting the workspace so the design and implementation match the repo state.
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc 'rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 11ms:
/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001

 succeeded in 11ms:
TASK.md
package.json

exec
/bin/bash -lc 'cat /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/.agents/skills/security/SKILL.md' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 2ms:
codex
The workspace is essentially empty, so I’m building this from scratch. I’ve loaded the security guidance; next I’m checking the task file and repo metadata, then I’ll lay out the vault/factory design before editing files.
exec
/bin/bash -lc 'cat TASK.md' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc 'cat package.json' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 27ms:
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

 succeeded in 30ms:
{
  "name": "eval-workspace",
  "private": true
}

exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 21ms:
I’ve confirmed the repo is empty and the task is a greenfield Foundry implementation. I’m proceeding in three stages: initialize the project, implement a secure ERC-4626-based vault/factory setup, then document and verify it with `forge build`.
  → Inspect local toolchain and initialize the Foundry project structure with required dependencies.
  • Implement the permissionless vault factory and per-token vault contracts with secure ERC-20 accounting assumptions documented in code.
  • Write NOTES.md and verify the project compiles with `forge build`.
exec
/bin/bash -lc 'forge --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

exec
/bin/bash -lc 'solc --version' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 148ms:
solc, the solidity compiler commandline interface
Version: 0.8.20+commit.a1b79de6.Linux.g++

codex
The local toolchain is present: `forge 1.5.1` and `solc 0.8.20`. I’m creating a minimal Foundry layout instead of a full template so the repo stays focused, then I’ll add OpenZeppelin and wire the contracts around `ERC4626`.
exec
/bin/bash -lc 'mkdir -p src script test lib' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 10ms:
exec
/bin/bash -lc 'forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-git' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 15644ms:
Installing openzeppelin-contracts in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/lib/openzeppelin-contracts (url: https://github.com/OpenZeppelin/openzeppelin-contracts, tag: v5.0.2)
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/lib/openzeppelin-contracts'...
Submodule 'lib/erc4626-tests' (https://github.com/a16z/erc4626-tests.git) registered for path 'lib/erc4626-tests'
Submodule 'lib/forge-std' (https://github.com/foundry-rs/forge-std) registered for path 'lib/forge-std'
Submodule 'lib/halmos-cheatcodes' (https://github.com/a16z/halmos-cheatcodes) registered for path 'lib/halmos-cheatcodes'
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/lib/openzeppelin-contracts/lib/erc4626-tests'...
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/lib/openzeppelin-contracts/lib/forge-std'...
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/lib/openzeppelin-contracts/lib/halmos-cheatcodes'...
Submodule 'lib/ds-test' (https://github.com/dapphub/ds-test) registered for path 'lib/forge-std/lib/ds-test'
Cloning into '/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/lib/openzeppelin-contracts/lib/forge-std/lib/ds-test'...
remote: Enumerating objects: 313, done.        
remote: Counting objects:   0% (1/171)        remote: Counting objects:   1% (2/171)        remote: Counting objects:   2% (4/171)        remote: Counting objects:   3% (6/171)        remote: Counting objects:   4% (7/171)        remote: Counting objects:   5% (9/171)        remote: Counting objects:   6% (11/171)        remote: Counting objects:   7% (12/171)        remote: Counting objects:   8% (14/171)        remote: Counting objects:   9% (16/171)        remote: Counting objects:  10% (18/171)        remote: Counting objects:  11% (19/171)        remote: Counting objects:  12% (21/171)        remote: Counting objects:  13% (23/171)        remote: Counting objects:  14% (24/171)        remote: Counting objects:  15% (26/171)        remote: Counting objects:  16% (28/171)        remote: Counting objects:  17% (30/171)        remote: Counting objects:  18% (31/171)        remote: Counting objects:  19% (33/171)        remote: Counting objects:  20% (35/171)        remote: Counting objects:  21% (36/171)        remote: Counting objects:  22% (38/171)        remote: Counting objects:  23% (40/171)        remote: Counting objects:  24% (42/171)        remote: Counting objects:  25% (43/171)        remote: Counting objects:  26% (45/171)        remote: Counting objects:  27% (47/171)        remote: Counting objects:  28% (48/171)        remote: Counting objects:  29% (50/171)        remote: Counting objects:  30% (52/171)        remote: Counting objects:  31% (54/171)        remote: Counting objects:  32% (55/171)        remote: Counting objects:  33% (57/171)        remote: Counting objects:  34% (59/171)        remote: Counting objects:  35% (60/171)        remote: Counting objects:  36% (62/171)        remote: Counting objects:  37% (64/171)        remote: Counting objects:  38% (65/171)        remote: Counting objects:  39% (67/171)        remote: Counting objects:  40% (69/171)        remote: Counting objects:  41% (71/171)        remote: Counting objects:  42% (72/171)        remote: Counting objects:  43% (74/171)        remote: Counting objects:  44% (76/171)        remote: Counting objects:  45% (77/171)        remote: Counting objects:  46% (79/171)        remote: Counting objects:  47% (81/171)        remote: Counting objects:  48% (83/171)        remote: Counting objects:  49% (84/171)        remote: Counting objects:  50% (86/171)        remote: Counting objects:  51% (88/171)        remote: Counting objects:  52% (89/171)        remote: Counting objects:  53% (91/171)        remote: Counting objects:  54% (93/171)        remote: Counting objects:  55% (95/171)        remote: Counting objects:  56% (96/171)        remote: Counting objects:  57% (98/171)        remote: Counting objects:  58% (100/171)        remote: Counting objects:  59% (101/171)        remote: Counting objects:  60% (103/171)        remote: Counting objects:  61% (105/171)        remote: Counting objects:  62% (107/171)        remote: Counting objects:  63% (108/171)        remote: Counting objects:  64% (110/171)        remote: Counting objects:  65% (112/171)        remote: Counting objects:  66% (113/171)        remote: Counting objects:  67% (115/171)        remote: Counting objects:  68% (117/171)        remote: Counting objects:  69% (118/171)        remote: Counting objects:  70% (120/171)        remote: Counting objects:  71% (122/171)        remote: Counting objects:  72% (124/171)        remote: Counting objects:  73% (125/171)        remote: Counting objects:  74% (127/171)        remote: Counting objects:  75% (129/171)        remote: Counting objects:  76% (130/171)        remote: Counting objects:  77% (132/171)        remote: Counting objects:  78% (134/171)        remote: Counting objects:  79% (136/171)        remote: Counting objects:  80% (137/171)        remote: Counting objects:  81% (139/171)        remote: Counting objects:  82% (141/171)        remote: Counting objects:  83% (142/171)        remote: Counting objects:  84% (144/171)        remote: Counting objects:  85% (146/171)        remote: Counting objects:  86% (148/171)        remote: Counting objects:  87% (149/171)        remote: Counting objects:  88% (151/171)        remote: Counting objects:  89% (153/171)        remote: Counting objects:  90% (154/171)        remote: Counting objects:  91% (156/171)        remote: Counting objects:  92% (158/171)        remote: Counting objects:  93% (160/171)        remote: Counting objects:  94% (161/171)        remote: Counting objects:  95% (163/171)        remote: Counting objects:  96% (165/171)        remote: Counting objects:  97% (166/171)        remote: Counting objects:  98% (168/171)        remote: Counting objects:  99% (170/171)        remote: Counting objects: 100% (171/171)        remote: Counting objects: 100% (171/171), done.        
remote: Compressing objects:   1% (1/79)        remote: Compressing objects:   2% (2/79)        remote: Compressing objects:   3% (3/79)        remote: Compressing objects:   5% (4/79)        remote: Compressing objects:   6% (5/79)        remote: Compressing objects:   7% (6/79)        remote: Compressing objects:   8% (7/79)        remote: Compressing objects:  10% (8/79)        remote: Compressing objects:  11% (9/79)        remote: Compressing objects:  12% (10/79)        remote: Compressing objects:  13% (11/79)        remote: Compressing objects:  15% (12/79)        remote: Compressing objects:  16% (13/79)        remote: Compressing objects:  17% (14/79)        remote: Compressing objects:  18% (15/79)        remote: Compressing objects:  20% (16/79)        remote: Compressing objects:  21% (17/79)        remote: Compressing objects:  22% (18/79)        remote: Compressing objects:  24% (19/79)        remote: Compressing objects:  25% (20/79)        remote: Compressing objects:  26% (21/79)        remote: Compressing objects:  27% (22/79)        remote: Compressing objects:  29% (23/79)        remote: Compressing objects:  30% (24/79)        remote: Compressing objects:  31% (25/79)        remote: Compressing objects:  32% (26/79)        remote: Compressing objects:  34% (27/79)        remote: Compressing objects:  35% (28/79)        remote: Compressing objects:  36% (29/79)        remote: Compressing objects:  37% (30/79)        remote: Compressing objects:  39% (31/79)        remote: Compressing objects:  40% (32/79)        remote: Compressing objects:  41% (33/79)        remote: Compressing objects:  43% (34/79)        remote: Compressing objects:  44% (35/79)        remote: Compressing objects:  45% (36/79)        remote: Compressing objects:  46% (37/79)        remote: Compressing objects:  48% (38/79)        remote: Compressing objects:  49% (39/79)        remote: Compressing objects:  50% (40/79)        remote: Compressing objects:  51% (41/79)        remote: Compressing objects:  53% (42/79)        remote: Compressing objects:  54% (43/79)        remote: Compressing objects:  55% (44/79)        remote: Compressing objects:  56% (45/79)        remote: Compressing objects:  58% (46/79)        remote: Compressing objects:  59% (47/79)        remote: Compressing objects:  60% (48/79)        remote: Compressing objects:  62% (49/79)        remote: Compressing objects:  63% (50/79)        remote: Compressing objects:  64% (51/79)        remote: Compressing objects:  65% (52/79)        remote: Compressing objects:  67% (53/79)        remote: Compressing objects:  68% (54/79)        remote: Compressing objects:  69% (55/79)        remote: Compressing objects:  70% (56/79)        remote: Compressing objects:  72% (57/79)        remote: Compressing objects:  73% (58/79)        remote: Compressing objects:  74% (59/79)        remote: Compressing objects:  75% (60/79)        remote: Compressing objects:  77% (61/79)        remote: Compressing objects:  78% (62/79)        remote: Compressing objects:  79% (63/79)        remote: Compressing objects:  81% (64/79)        remote: Compressing objects:  82% (65/79)        remote: Compressing objects:  83% (66/79)        remote: Compressing objects:  84% (67/79)        remote: Compressing objects:  86% (68/79)        remote: Compressing objects:  87% (69/79)        remote: Compressing objects:  88% (70/79)        remote: Compressing objects:  89% (71/79)        remote: Compressing objects:  91% (72/79)        remote: Compressing objects:  92% (73/79)        remote: Compressing objects:  93% (74/79)        remote: Compressing objects:  94% (75/79)        remote: Compressing objects:  96% (76/79)        remote: Compressing objects:  97% (77/79)        remote: Compressing objects:  98% (78/79)        remote: Compressing objects: 100% (79/79)        remote: Compressing objects: 100% (79/79), done.        
Receiving objects:   0% (1/313)Receiving objects:   1% (4/313)Receiving objects:   2% (7/313)Receiving objects:   3% (10/313)Receiving objects:   4% (13/313)Receiving objects:   5% (16/313)Receiving objects:   6% (19/313)Receiving objects:   7% (22/313)Receiving objects:   8% (26/313)Receiving objects:   9% (29/313)Receiving objects:  10% (32/313)Receiving objects:  11% (35/313)Receiving objects:  12% (38/313)Receiving objects:  13% (41/313)Receiving objects:  14% (44/313)Receiving objects:  15% (47/313)Receiving objects:  16% (51/313)Receiving objects:  17% (54/313)Receiving objects:  18% (57/313)Receiving objects:  19% (60/313)Receiving objects:  20% (63/313)Receiving objects:  21% (66/313)Receiving objects:  22% (69/313)Receiving objects:  23% (72/313)Receiving objects:  24% (76/313)Receiving objects:  25% (79/313)Receiving objects:  26% (82/313)Receiving objects:  27% (85/313)Receiving objects:  28% (88/313)Receiving objects:  29% (91/313)Receiving objects:  30% (94/313)Receiving objects:  31% (98/313)Receiving objects:  32% (101/313)Receiving objects:  33% (104/313)Receiving objects:  34% (107/313)Receiving objects:  35% (110/313)Receiving objects:  36% (113/313)Receiving objects:  37% (116/313)Receiving objects:  38% (119/313)Receiving objects:  39% (123/313)Receiving objects:  40% (126/313)Receiving objects:  41% (129/313)Receiving objects:  42% (132/313)Receiving objects:  43% (135/313)Receiving objects:  44% (138/313)Receiving objects:  45% (141/313)Receiving objects:  46% (144/313)Receiving objects:  47% (148/313)Receiving objects:  48% (151/313)Receiving objects:  49% (154/313)Receiving objects:  50% (157/313)Receiving objects:  51% (160/313)Receiving objects:  52% (163/313)Receiving objects:  53% (166/313)Receiving objects:  54% (170/313)Receiving objects:  55% (173/313)Receiving objects:  56% (176/313)Receiving objects:  57% (179/313)Receiving objects:  58% (182/313)Receiving objects:  59% (185/313)Receiving objects:  60% (188/313)Receiving objects:  61% (191/313)Receiving objects:  62% (195/313)Receiving objects:  63% (198/313)Receiving objects:  64% (201/313)Receiving objects:  65% (204/313)Receiving objects:  66% (207/313)Receiving objects:  67% (210/313)Receiving objects:  68% (213/313)Receiving objects:  69% (216/313)Receiving objects:  70% (220/313)Receiving objects:  71% (223/313)Receiving objects:  72% (226/313)Receiving objects:  73% (229/313)Receiving objects:  74% (232/313)Receiving objects:  75% (235/313)Receiving objects:  76% (238/313)Receiving objects:  77% (242/313)Receiving objects:  78% (245/313)Receiving objects:  79% (248/313)Receiving objects:  80% (251/313)Receiving objects:  81% (254/313)Receiving objects:  82% (257/313)Receiving objects:  83% (260/313)Receiving objects:  84% (263/313)Receiving objects:  85% (267/313)Receiving objects:  86% (270/313)Receiving objects:  87% (273/313)remote: Total 313 (delta 91), reused 132 (delta 83), pack-reused 142 (from 1)        
Receiving objects:  88% (276/313)Receiving objects:  89% (279/313)Receiving objects:  90% (282/313)Receiving objects:  91% (285/313)Receiving objects:  92% (288/313)Receiving objects:  93% (292/313)Receiving objects:  94% (295/313)Receiving objects:  95% (298/313)Receiving objects:  96% (301/313)Receiving objects:  97% (304/313)Receiving objects:  98% (307/313)Receiving objects:  99% (310/313)Receiving objects: 100% (313/313)Receiving objects: 100% (313/313), 71.35 KiB | 339.00 KiB/s, done.
Resolving deltas:   0% (0/130)Resolving deltas:   1% (2/130)Resolving deltas:   2% (3/130)Resolving deltas:   3% (4/130)Resolving deltas:   5% (7/130)Resolving deltas:   6% (8/130)Resolving deltas:   7% (10/130)Resolving deltas:   8% (11/130)Resolving deltas:   9% (12/130)Resolving deltas:  10% (13/130)Resolving deltas:  11% (15/130)Resolving deltas:  12% (16/130)Resolving deltas:  13% (18/130)Resolving deltas:  14% (19/130)Resolving deltas:  15% (20/130)Resolving deltas:  16% (21/130)Resolving deltas:  17% (23/130)Resolving deltas:  20% (27/130)Resolving deltas:  21% (28/130)Resolving deltas:  23% (30/130)Resolving deltas:  26% (34/130)Resolving deltas:  29% (38/130)Resolving deltas:  30% (39/130)Resolving deltas:  31% (41/130)Resolving deltas:  32% (42/130)Resolving deltas:  33% (43/130)Resolving deltas:  34% (45/130)Resolving deltas:  35% (46/130)Resolving deltas:  36% (47/130)Resolving deltas:  37% (49/130)Resolving deltas:  38% (50/130)Resolving deltas:  39% (51/130)Resolving deltas:  40% (52/130)Resolving deltas:  41% (54/130)Resolving deltas:  42% (55/130)Resolving deltas:  43% (56/130)Resolving deltas:  44% (58/130)Resolving deltas:  45% (59/130)Resolving deltas:  46% (60/130)Resolving deltas:  47% (62/130)Resolving deltas:  48% (63/130)Resolving deltas:  49% (64/130)Resolving deltas:  50% (65/130)Resolving deltas:  52% (68/130)Resolving deltas:  53% (69/130)Resolving deltas:  54% (71/130)Resolving deltas:  56% (73/130)Resolving deltas:  60% (78/130)Resolving deltas:  61% (80/130)Resolving deltas:  62% (81/130)Resolving deltas:  63% (83/130)Resolving deltas:  64% (84/130)Resolving deltas:  65% (85/130)Resolving deltas:  66% (86/130)Resolving deltas:  67% (88/130)Resolving deltas:  68% (89/130)Resolving deltas:  69% (90/130)Resolving deltas:  70% (91/130)Resolving deltas:  71% (93/130)Resolving deltas:  72% (94/130)Resolving deltas:  73% (95/130)Resolving deltas:  74% (97/130)Resolving deltas:  75% (98/130)Resolving deltas:  76% (99/130)Resolving deltas:  77% (101/130)Resolving deltas:  79% (103/130)Resolving deltas:  80% (104/130)Resolving deltas:  81% (106/130)Resolving deltas:  83% (109/130)Resolving deltas:  84% (110/130)Resolving deltas:  85% (111/130)Resolving deltas:  86% (113/130)Resolving deltas:  87% (114/130)Resolving deltas:  90% (117/130)Resolving deltas:  91% (119/130)Resolving deltas:  92% (120/130)Resolving deltas:  93% (121/130)Resolving deltas:  94% (123/130)Resolving deltas:  95% (124/130)Resolving deltas:  96% (125/130)Resolving deltas:  97% (127/130)Resolving deltas:  98% (128/130)Resolving deltas:  99% (129/130)Resolving deltas: 100% (130/130)Resolving deltas: 100% (130/130), done.
    Installed openzeppelin-contracts v5.0.2

codex
OpenZeppelin is installed. I’m checking the exact `ERC4626` behavior in this version before I write the vault wrapper, because the empty-vault accounting and token edge cases need to be explicit rather than assumed.
exec
/bin/bash -lc "sed -n '1,260p' lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc "sed -n '1,220p' lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 24ms:
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/extensions/ERC4626.sol)

pragma solidity ^0.8.20;

import {IERC20, IERC20Metadata, ERC20} from "../ERC20.sol";
import {SafeERC20} from "../utils/SafeERC20.sol";
import {IERC4626} from "../../../interfaces/IERC4626.sol";
import {Math} from "../../../utils/math/Math.sol";

/**
 * @dev Implementation of the ERC4626 "Tokenized Vault Standard" as defined in
 * https://eips.ethereum.org/EIPS/eip-4626[EIP-4626].
 *
 * This extension allows the minting and burning of "shares" (represented using the ERC20 inheritance) in exchange for
 * underlying "assets" through standardized {deposit}, {mint}, {redeem} and {burn} workflows. This contract extends
 * the ERC20 standard. Any additional extensions included along it would affect the "shares" token represented by this
 * contract and not the "assets" token which is an independent contract.
 *
 * [CAUTION]
 * ====
 * In empty (or nearly empty) ERC-4626 vaults, deposits are at high risk of being stolen through frontrunning
 * with a "donation" to the vault that inflates the price of a share. This is variously known as a donation or inflation
 * attack and is essentially a problem of slippage. Vault deployers can protect against this attack by making an initial
 * deposit of a non-trivial amount of the asset, such that price manipulation becomes infeasible. Withdrawals may
 * similarly be affected by slippage. Users can protect against this attack as well as unexpected slippage in general by
 * verifying the amount received is as expected, using a wrapper that performs these checks such as
 * https://github.com/fei-protocol/ERC4626#erc4626router-and-base[ERC4626Router].
 *
 * Since v4.9, this implementation uses virtual assets and shares to mitigate that risk. The `_decimalsOffset()`
 * corresponds to an offset in the decimal representation between the underlying asset's decimals and the vault
 * decimals. This offset also determines the rate of virtual shares to virtual assets in the vault, which itself
 * determines the initial exchange rate. While not fully preventing the attack, analysis shows that the default offset
 * (0) makes it non-profitable, as a result of the value being captured by the virtual shares (out of the attacker's
 * donation) matching the attacker's expected gains. With a larger offset, the attack becomes orders of magnitude more
 * expensive than it is profitable. More details about the underlying math can be found
 * xref:erc4626.adoc#inflation-attack[here].
 *
 * The drawback of this approach is that the virtual shares do capture (a very small) part of the value being accrued
 * to the vault. Also, if the vault experiences losses, the users try to exit the vault, the virtual shares and assets
 * will cause the first user to exit to experience reduced losses in detriment to the last users that will experience
 * bigger losses. Developers willing to revert back to the pre-v4.9 behavior just need to override the
 * `_convertToShares` and `_convertToAssets` functions.
 *
 * To learn more, check out our xref:ROOT:erc4626.adoc[ERC-4626 guide].
 * ====
 */
abstract contract ERC4626 is ERC20, IERC4626 {
    using Math for uint256;

    IERC20 private immutable _asset;
    uint8 private immutable _underlyingDecimals;

    /**
     * @dev Attempted to deposit more assets than the max amount for `receiver`.
     */
    error ERC4626ExceededMaxDeposit(address receiver, uint256 assets, uint256 max);

    /**
     * @dev Attempted to mint more shares than the max amount for `receiver`.
     */
    error ERC4626ExceededMaxMint(address receiver, uint256 shares, uint256 max);

    /**
     * @dev Attempted to withdraw more assets than the max amount for `receiver`.
     */
    error ERC4626ExceededMaxWithdraw(address owner, uint256 assets, uint256 max);

    /**
     * @dev Attempted to redeem more shares than the max amount for `receiver`.
     */
    error ERC4626ExceededMaxRedeem(address owner, uint256 shares, uint256 max);

    /**
     * @dev Set the underlying asset contract. This must be an ERC20-compatible contract (ERC20 or ERC777).
     */
    constructor(IERC20 asset_) {
        (bool success, uint8 assetDecimals) = _tryGetAssetDecimals(asset_);
        _underlyingDecimals = success ? assetDecimals : 18;
        _asset = asset_;
    }

    /**
     * @dev Attempts to fetch the asset decimals. A return value of false indicates that the attempt failed in some way.
     */
    function _tryGetAssetDecimals(IERC20 asset_) private view returns (bool, uint8) {
        (bool success, bytes memory encodedDecimals) = address(asset_).staticcall(
            abi.encodeCall(IERC20Metadata.decimals, ())
        );
        if (success && encodedDecimals.length >= 32) {
            uint256 returnedDecimals = abi.decode(encodedDecimals, (uint256));
            if (returnedDecimals <= type(uint8).max) {
                return (true, uint8(returnedDecimals));
            }
        }
        return (false, 0);
    }

    /**
     * @dev Decimals are computed by adding the decimal offset on top of the underlying asset's decimals. This
     * "original" value is cached during construction of the vault contract. If this read operation fails (e.g., the
     * asset has not been created yet), a default of 18 is used to represent the underlying asset's decimals.
     *
     * See {IERC20Metadata-decimals}.
     */
    function decimals() public view virtual override(IERC20Metadata, ERC20) returns (uint8) {
        return _underlyingDecimals + _decimalsOffset();
    }

    /** @dev See {IERC4626-asset}. */
    function asset() public view virtual returns (address) {
        return address(_asset);
    }

    /** @dev See {IERC4626-totalAssets}. */
    function totalAssets() public view virtual returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    /** @dev See {IERC4626-convertToShares}. */
    function convertToShares(uint256 assets) public view virtual returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    /** @dev See {IERC4626-convertToAssets}. */
    function convertToAssets(uint256 shares) public view virtual returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    /** @dev See {IERC4626-maxDeposit}. */
    function maxDeposit(address) public view virtual returns (uint256) {
        return type(uint256).max;
    }

    /** @dev See {IERC4626-maxMint}. */
    function maxMint(address) public view virtual returns (uint256) {
        return type(uint256).max;
    }

    /** @dev See {IERC4626-maxWithdraw}. */
    function maxWithdraw(address owner) public view virtual returns (uint256) {
        return _convertToAssets(balanceOf(owner), Math.Rounding.Floor);
    }

    /** @dev See {IERC4626-maxRedeem}. */
    function maxRedeem(address owner) public view virtual returns (uint256) {
        return balanceOf(owner);
    }

    /** @dev See {IERC4626-previewDeposit}. */
    function previewDeposit(uint256 assets) public view virtual returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    /** @dev See {IERC4626-previewMint}. */
    function previewMint(uint256 shares) public view virtual returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Ceil);
    }

    /** @dev See {IERC4626-previewWithdraw}. */
    function previewWithdraw(uint256 assets) public view virtual returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Ceil);
    }

    /** @dev See {IERC4626-previewRedeem}. */
    function previewRedeem(uint256 shares) public view virtual returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    /** @dev See {IERC4626-deposit}. */
    function deposit(uint256 assets, address receiver) public virtual returns (uint256) {
        uint256 maxAssets = maxDeposit(receiver);
        if (assets > maxAssets) {
            revert ERC4626ExceededMaxDeposit(receiver, assets, maxAssets);
        }

        uint256 shares = previewDeposit(assets);
        _deposit(_msgSender(), receiver, assets, shares);

        return shares;
    }

    /** @dev See {IERC4626-mint}.
     *
     * As opposed to {deposit}, minting is allowed even if the vault is in a state where the price of a share is zero.
     * In this case, the shares will be minted without requiring any assets to be deposited.
     */
    function mint(uint256 shares, address receiver) public virtual returns (uint256) {
        uint256 maxShares = maxMint(receiver);
        if (shares > maxShares) {
            revert ERC4626ExceededMaxMint(receiver, shares, maxShares);
        }

        uint256 assets = previewMint(shares);
        _deposit(_msgSender(), receiver, assets, shares);

        return assets;
    }

    /** @dev See {IERC4626-withdraw}. */
    function withdraw(uint256 assets, address receiver, address owner) public virtual returns (uint256) {
        uint256 maxAssets = maxWithdraw(owner);
        if (assets > maxAssets) {
            revert ERC4626ExceededMaxWithdraw(owner, assets, maxAssets);
        }

        uint256 shares = previewWithdraw(assets);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return shares;
    }

    /** @dev See {IERC4626-redeem}. */
    function redeem(uint256 shares, address receiver, address owner) public virtual returns (uint256) {
        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) {
            revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);
        }

        uint256 assets = previewRedeem(shares);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return assets;
    }

    /**
     * @dev Internal conversion function (from assets to shares) with support for rounding direction.
     */
    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view virtual returns (uint256) {
        return assets.mulDiv(totalSupply() + 10 ** _decimalsOffset(), totalAssets() + 1, rounding);
    }

    /**
     * @dev Internal conversion function (from shares to assets) with support for rounding direction.
     */
    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view virtual returns (uint256) {
        return shares.mulDiv(totalAssets() + 1, totalSupply() + 10 ** _decimalsOffset(), rounding);
    }

    /**
     * @dev Deposit/mint common workflow.
     */
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal virtual {
        // If _asset is ERC777, `transferFrom` can trigger a reentrancy BEFORE the transfer happens through the
        // `tokensToSend` hook. On the other hand, the `tokenReceived` hook, that is triggered after the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer before we mint so that any reentrancy would happen before the
        // assets are transferred and before the shares are minted, which is a valid state.
        // slither-disable-next-line reentrancy-no-eth
        SafeERC20.safeTransferFrom(_asset, caller, address(this), assets);
        _mint(receiver, shares);

        emit Deposit(caller, receiver, assets, shares);
    }

    /**
     * @dev Withdraw/redeem common workflow.
     */
    function _withdraw(

 succeeded in 27ms:
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/extensions/ERC20Permit.sol)

pragma solidity ^0.8.20;

import {IERC20Permit} from "./IERC20Permit.sol";
import {ERC20} from "../ERC20.sol";
import {ECDSA} from "../../../utils/cryptography/ECDSA.sol";
import {EIP712} from "../../../utils/cryptography/EIP712.sol";
import {Nonces} from "../../../utils/Nonces.sol";

/**
 * @dev Implementation of the ERC20 Permit extension allowing approvals to be made via signatures, as defined in
 * https://eips.ethereum.org/EIPS/eip-2612[EIP-2612].
 *
 * Adds the {permit} method, which can be used to change an account's ERC20 allowance (see {IERC20-allowance}) by
 * presenting a message signed by the account. By not relying on `{IERC20-approve}`, the token holder account doesn't
 * need to send a transaction, and thus is not required to hold Ether at all.
 */
abstract contract ERC20Permit is ERC20, IERC20Permit, EIP712, Nonces {
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    /**
     * @dev Permit deadline has expired.
     */
    error ERC2612ExpiredSignature(uint256 deadline);

    /**
     * @dev Mismatched signature.
     */
    error ERC2612InvalidSigner(address signer, address owner);

    /**
     * @dev Initializes the {EIP712} domain separator using the `name` parameter, and setting `version` to `"1"`.
     *
     * It's a good idea to use the same `name` that is defined as the ERC20 token name.
     */
    constructor(string memory name) EIP712(name, "1") {}

    /**
     * @inheritdoc IERC20Permit
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        if (block.timestamp > deadline) {
            revert ERC2612ExpiredSignature(deadline);
        }

        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline));

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        if (signer != owner) {
            revert ERC2612InvalidSigner(signer, owner);
        }

        _approve(owner, spender, value);
    }

    /**
     * @inheritdoc IERC20Permit
     */
    function nonces(address owner) public view virtual override(IERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    /**
     * @inheritdoc IERC20Permit
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view virtual returns (bytes32) {
        return _domainSeparatorV4();
    }
}

exec
/bin/bash -lc "sed -n '1,220p' lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 exited 2 in 37ms:
sed: can't read lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20.sol: No such file or directory

codex
The key implementation choice is to wrap OpenZeppelin `ERC4626` rather than hand-roll share math. I’m coding two contracts: a per-token vault with transfer-friendly receipt shares and a permissionless factory that creates one vault per asset, while explicitly rejecting zero-asset deposits and documenting the unsupported token behaviors that no generic vault can safely absorb.
exec
/bin/bash -lc "sed -n '1,220p' lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc "sed -n '1,220p' lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 11ms:
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.20;

import {IERC20} from "./IERC20.sol";
import {IERC20Metadata} from "./extensions/IERC20Metadata.sol";
import {Context} from "../../utils/Context.sol";
import {IERC20Errors} from "../../interfaces/draft-IERC6093.sol";

/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 *
 * TIP: For a detailed writeup see our guide
 * https://forum.openzeppelin.com/t/how-to-implement-erc20-supply-mechanisms/226[How
 * to implement supply mechanisms].
 *
 * The default value of {decimals} is 18. To change this, you should override
 * this function so it returns a different value.
 *
 * We have followed general OpenZeppelin Contracts guidelines: functions revert
 * instead returning `false` on failure. This behavior is nonetheless
 * conventional and does not conflict with the expectations of ERC20
 * applications.
 *
 * Additionally, an {Approval} event is emitted on calls to {transferFrom}.
 * This allows applications to reconstruct the allowance for all accounts just
 * by listening to said events. Other implementations of the EIP may not emit
 * these events, as it isn't required by the specification.
 */
abstract contract ERC20 is Context, IERC20, IERC20Metadata, IERC20Errors {
    mapping(address account => uint256) private _balances;

    mapping(address account => mapping(address spender => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * All two of these values are immutable: they can only be set once during
     * construction.
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the default value returned by this function, unless
     * it's overridden.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `value`.
     */
    function transfer(address to, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `value` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, value);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `value`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `value`.
     */
    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(from, to, value);
    }

    /**
     * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
     * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
     * this function.
     *
     * Emits a {Transfer} event.
     */
    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            // Overflow check required: The rest of the code assumes that totalSupply never overflows
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                // Overflow not possible: value <= fromBalance <= totalSupply.
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                // Overflow not possible: value <= totalSupply or value <= fromBalance <= totalSupply.
                _totalSupply -= value;
            }
        } else {
            unchecked {
                // Overflow not possible: balance + value is at most totalSupply, which we know fits into a uint256.
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    /**
     * @dev Creates a `value` amount of tokens and assigns them to `account`, by transferring it from address(0).
     * Relies on the `_update` mechanism

 succeeded in 8ms:
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

exec
/bin/bash -lc "sed -n '1,220p' lib/openzeppelin-contracts/contracts/utils/Strings.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 5ms:
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/Strings.sol)

pragma solidity ^0.8.20;

import {Math} from "./math/Math.sol";
import {SignedMath} from "./math/SignedMath.sol";

/**
 * @dev String operations.
 */
library Strings {
    bytes16 private constant HEX_DIGITS = "0123456789abcdef";
    uint8 private constant ADDRESS_LENGTH = 20;

    /**
     * @dev The `value` string doesn't fit in the specified `length`.
     */
    error StringsInsufficientHexLength(uint256 value, uint256 length);

    /**
     * @dev Converts a `uint256` to its ASCII `string` decimal representation.
     */
    function toString(uint256 value) internal pure returns (string memory) {
        unchecked {
            uint256 length = Math.log10(value) + 1;
            string memory buffer = new string(length);
            uint256 ptr;
            /// @solidity memory-safe-assembly
            assembly {
                ptr := add(buffer, add(32, length))
            }
            while (true) {
                ptr--;
                /// @solidity memory-safe-assembly
                assembly {
                    mstore8(ptr, byte(mod(value, 10), HEX_DIGITS))
                }
                value /= 10;
                if (value == 0) break;
            }
            return buffer;
        }
    }

    /**
     * @dev Converts a `int256` to its ASCII `string` decimal representation.
     */
    function toStringSigned(int256 value) internal pure returns (string memory) {
        return string.concat(value < 0 ? "-" : "", toString(SignedMath.abs(value)));
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation.
     */
    function toHexString(uint256 value) internal pure returns (string memory) {
        unchecked {
            return toHexString(value, Math.log256(value) + 1);
        }
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation with fixed length.
     */
    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        uint256 localValue = value;
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = HEX_DIGITS[localValue & 0xf];
            localValue >>= 4;
        }
        if (localValue != 0) {
            revert StringsInsufficientHexLength(value, length);
        }
        return string(buffer);
    }

    /**
     * @dev Converts an `address` with fixed length of 20 bytes to its not checksummed ASCII `string` hexadecimal
     * representation.
     */
    function toHexString(address addr) internal pure returns (string memory) {
        return toHexString(uint256(uint160(addr)), ADDRESS_LENGTH);
    }

    /**
     * @dev Returns true if the two strings are equal.
     */
    function equal(string memory a, string memory b) internal pure returns (bool) {
        return bytes(a).length == bytes(b).length && keccak256(bytes(a)) == keccak256(bytes(b));
    }
}

codex
I’ve pinned the library behavior and I’m now writing the actual files: minimal Foundry config, the vault, the factory, and a short deployment script. After that I’ll add the operating notes and run a full `forge build`.
exec
/bin/bash -lc "sed -n '220,360p' lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
        uint256 assets = previewRedeem(shares);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return assets;
    }

    /**
     * @dev Internal conversion function (from assets to shares) with support for rounding direction.
     */
    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view virtual returns (uint256) {
        return assets.mulDiv(totalSupply() + 10 ** _decimalsOffset(), totalAssets() + 1, rounding);
    }

    /**
     * @dev Internal conversion function (from shares to assets) with support for rounding direction.
     */
    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view virtual returns (uint256) {
        return shares.mulDiv(totalAssets() + 1, totalSupply() + 10 ** _decimalsOffset(), rounding);
    }

    /**
     * @dev Deposit/mint common workflow.
     */
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal virtual {
        // If _asset is ERC777, `transferFrom` can trigger a reentrancy BEFORE the transfer happens through the
        // `tokensToSend` hook. On the other hand, the `tokenReceived` hook, that is triggered after the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer before we mint so that any reentrancy would happen before the
        // assets are transferred and before the shares are minted, which is a valid state.
        // slither-disable-next-line reentrancy-no-eth
        SafeERC20.safeTransferFrom(_asset, caller, address(this), assets);
        _mint(receiver, shares);

        emit Deposit(caller, receiver, assets, shares);
    }

    /**
     * @dev Withdraw/redeem common workflow.
     */
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual {
        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        // If _asset is ERC777, `transfer` can trigger a reentrancy AFTER the transfer happens through the
        // `tokensReceived` hook. On the other hand, the `tokensToSend` hook, that is triggered before the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer after the burn so that any reentrancy would happen after the
        // shares are burned and after the assets are transferred, which is a valid state.
        _burn(owner, shares);
        SafeERC20.safeTransfer(_asset, receiver, assets);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    function _decimalsOffset() internal view virtual returns (uint8) {
        return 0;
    }
}

exec
/bin/bash -lc "sed -n '1,200p' lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/utils/SafeERC20.sol)

pragma solidity ^0.8.20;

import {IERC20} from "../IERC20.sol";
import {IERC20Permit} from "../extensions/IERC20Permit.sol";
import {Address} from "../../../utils/Address.sol";

/**
 * @title SafeERC20
 * @dev Wrappers around ERC20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    using Address for address;

    /**
     * @dev An operation with an ERC20 token failed.
     */
    error SafeERC20FailedOperation(address token);

    /**
     * @dev Indicates a failed `decreaseAllowance` request.
     */
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    /**
     * @dev Transfer `value` amount of `token` from the calling contract to `to`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    /**
     * @dev Transfer `value` amount of `token` from `from` to `to`, spending the approval given by `from` to the
     * calling contract. If `token` returns no value, non-reverting calls are assumed to be successful.
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    /**
     * @dev Increase the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    /**
     * @dev Decrease the calling contract's allowance toward `spender` by `requestedDecrease`. If `token` returns no
     * value, non-reverting calls are assumed to be successful.
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    /**
     * @dev Set the calling contract's allowance toward `spender` to `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful. Meant to be used with tokens that require the approval
     * to be set to zero before setting it to a non-zero value, such as USDT.
     */
    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));

        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     */
    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves. We use {Address-functionCall} to perform this call, which verifies that
        // the target address contains contract code and also asserts for success in the low-level call.

        bytes memory returndata = address(token).functionCall(data);
        if (returndata.length != 0 && !abi.decode(returndata, (bool))) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     *
     * This is a variant of {_callOptionalReturn} that silents catches all reverts and returns a bool instead.
     */
    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves. We cannot use {Address-functionCall} here since this should return false
        // and not revert is the subcall reverts.

        (bool success, bytes memory returndata) = address(token).call(data);
        return success && (returndata.length == 0 || abi.decode(returndata, (bool))) && address(token).code.length > 0;
    }
}

codex
I’m editing the project files now. The code will stay deliberately small: one vault contract, one permissionless factory, and config/docs around them, with the important security assumptions called out both in code and in `NOTES.md`.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/NOTES.md
/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/foundry.toml
/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/src/SaveTokenVault.sol
/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/src/SaveTokenVaultFactory.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..06077a00c305b153579dec0e27e830e845dcac90
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable underlyingAsset;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        underlyingAsset = asset_;
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
+
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..06077a00c305b153579dec0e27e830e845dcac90
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable underlyingAsset;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        underlyingAsset = asset_;
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
+
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

codex
The core files are in place. I’m compiling now to catch any Solidity inheritance or override issues, then I’ll tighten anything the compiler surfaces and finalize the notes.
exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
?? NOTES.md
?? foundry.toml
?? src/

 exited 1 in 62ms:
Compiling 24 files with Solc 0.8.20
Solc 0.8.20 finished in 22.76ms
Error: Compiler run failed:
Error (6480): Derived contract must override function "decimals". Two or more base classes define function with same name and parameter types.
  --> src/SaveTokenVault.sol:11:1:
   |
11 | contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
   | ^ (Relevant source part starts here and spans across multiple lines).
Note: Definition in "ERC20": 
  --> lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol:83:5:
   |
83 |     function decimals() public view virtual returns (uint8) {
   |     ^ (Relevant source part starts here and spans across multiple lines).
Note: Definition in "ERC4626": 
   --> lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol:106:5:
    |
106 |     function decimals() public view virtual override(IERC20Metadata, ERC20) returns (uint8) {
    |     ^ (Relevant source part starts here and spans across multiple lines).

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..06077a00c305b153579dec0e27e830e845dcac90
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable underlyingAsset;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        underlyingAsset = asset_;
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
+
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

codex
The first compile pass only found one issue: `ERC20` and `ERC4626` both provide `decimals()`, so the vault needs to forward that override explicitly. I’m patching that and rebuilding.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/src/SaveTokenVault.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83a9be0bf3e6cdc44ad6ea81f8ed2da463aeb35c
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,110 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable underlyingAsset;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        underlyingAsset = asset_;
+    }
+
+    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
+        return ERC4626.decimals();
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83a9be0bf3e6cdc44ad6ea81f8ed2da463aeb35c
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,110 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable underlyingAsset;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        underlyingAsset = asset_;
+    }
+
+    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
+        return ERC4626.decimals();
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 423ms:
Compiling 24 files with Solc 0.8.20
Solc 0.8.20 finished in 371.94ms
Compiler run successful!
2026-09-04T04:22:11.931394Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/SaveTokenVault.sol:21:29
   |
21 |     IERC20 public immutable underlyingAsset;
   |                             ^^^^^^^^^^^^^^^ help: consider using: `UNDERLYING_ASSET`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unused-import]: unused imports should be removed
 --> src/SaveTokenVault.sol:6:9
  |
6 | import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
  |         ^^^^^^^^^^^^^^
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#unused-import


diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83a9be0bf3e6cdc44ad6ea81f8ed2da463aeb35c
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,110 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable underlyingAsset;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        underlyingAsset = asset_;
+    }
+
+    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
+        return ERC4626.decimals();
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        underlyingAsset.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = underlyingAsset.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

codex
`forge build` is green. I’m doing one last cleanup pass to remove the compiler lint notes so the project is tidy before I close out.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/src/SaveTokenVault.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed90aa739870cdee2c5ea6845d785790b69c0f
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,109 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable UNDERLYING_ASSET;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        UNDERLYING_ASSET = asset_;
+    }
+
+    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
+        return ERC4626.decimals();
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed90aa739870cdee2c5ea6845d785790b69c0f
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,109 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable UNDERLYING_ASSET;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        UNDERLYING_ASSET = asset_;
+    }
+
+    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
+        return ERC4626.decimals();
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

exec
/bin/bash -lc "sed -n '1,220p' src/SaveTokenVault.sol" in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 0ms:
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..98ed90aa739870cdee2c5ea6845d785790b69c0f
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,109 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable UNDERLYING_ASSET;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        UNDERLYING_ASSET = asset_;
+    }
+
+    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
+        return ERC4626.decimals();
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

codex
One final cleanup fix is left from the rename. I’m correcting that reference and rerunning the build to make sure the final tree is clean.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/src/SaveTokenVault.sol
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73d66b920ae96d8e2200844bd9e3cf6971c70302
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,109 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable UNDERLYING_ASSET;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        UNDERLYING_ASSET = asset_;
+    }
+
+    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
+        return ERC4626.decimals();
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73d66b920ae96d8e2200844bd9e3cf6971c70302
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,109 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable UNDERLYING_ASSET;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        UNDERLYING_ASSET = asset_;
+    }
+
+    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
+        return ERC4626.decimals();
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

exec
/bin/bash -lc 'forge build' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
exec
/bin/bash -lc 'git status --short' in /home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001
 succeeded in 5ms:
?? NOTES.md
?? foundry.toml
?? src/

 succeeded in 433ms:
Compiling 2 files with Solc 0.8.20
Solc 0.8.20 finished in 370.50ms
Compiler run successful!
2026-09-04T04:22:32.939577Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73d66b920ae96d8e2200844bd9e3cf6971c70302
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,109 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable UNDERLYING_ASSET;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        UNDERLYING_ASSET = asset_;
+    }
+
+    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
+        return ERC4626.decimals();
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

The Foundry project is initialized, the vault/factory contracts are implemented, and `forge build` now succeeds. I’ve also added the depositor/keeper operating notes requested.
  ✓ Inspect local toolchain and initialize the Foundry project structure with required dependencies.
  ✓ Implement the permissionless vault factory and per-token vault contracts with secure ERC-20 accounting assumptions documented in code.
  ✓ Write NOTES.md and verify the project compiles with `forge build`.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73d66b920ae96d8e2200844bd9e3cf6971c70302
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,109 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable UNDERLYING_ASSET;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        UNDERLYING_ASSET = asset_;
+    }
+
+    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
+        return ERC4626.decimals();
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

codex
Implemented a minimal Foundry project for the onchain savings product. The core contracts are [SaveTokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/src/SaveTokenVault.sol) and [SaveTokenVaultFactory.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/src/SaveTokenVaultFactory.sol), with config in [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/foundry.toml) and operational notes in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/NOTES.md).

The design is an `ERC4626` vault per ERC-20 plus a permissionless factory that creates one vault per asset. Receipt tokens are transferable ERC-20 shares with `permit`. Yield is handled by increasing the vault’s underlying balance, either via direct token transfer or the explicit `donate()` path. Deposits are protected against short-transfer assets by measuring actual balance delta and reverting if the vault receives less than requested.

Verification: `forge build` succeeds. The only runtime note was a non-fatal Foundry warning about writing its local signature cache under `/home/damu/.foundry`, which is read-only in this environment.
diff --git a/NOTES.md b/NOTES.md
new file mode 100644
index 0000000000000000000000000000000000000000..51584e142f7e0f26fdb4c3864289453278a9ce78
--- /dev/null
+++ b/NOTES.md
@@ -0,0 +1,32 @@
+# Notes
+
+## Depositor claim math
+
+Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.
+
+- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
+- `totalSupply()` is the total number of receipt shares outstanding.
+- A holder's economic claim is their pro-rata portion of vault assets:
+
+`holder assets ~= holderShares / totalSupply * totalAssets`
+
+On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:
+
+`assets = shares * (totalAssets + 1) / (totalSupply + 1)`
+
+That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.
+
+Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.
+
+## Listing and keeper operations
+
+Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.
+
+The operator who lists a token and runs the keeper has to get these things right:
+
+- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
+- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
+- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
+- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
+- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
+- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..11f1c74a2d8075db0e446ee20867dffa9b46c998
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+out = "out"
+libs = ["lib"]
+script = "script"
+test = "test"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/src/SaveTokenVault.sol b/src/SaveTokenVault.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73d66b920ae96d8e2200844bd9e3cf6971c70302
--- /dev/null
+++ b/src/SaveTokenVault.sol
@@ -0,0 +1,109 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
+import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
+import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
+import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
+
+contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
+    using SafeERC20 for IERC20;
+
+    error ZeroAssetAddress();
+    error ZeroAmount();
+    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);
+
+    event YieldDonated(address indexed caller, uint256 assetsReceived);
+
+    IERC20 public immutable UNDERLYING_ASSET;
+
+    constructor(IERC20 asset_, string memory name_, string memory symbol_)
+        ERC20(name_, symbol_)
+        ERC4626(asset_)
+        ERC20Permit(name_)
+    {
+        if (address(asset_) == address(0)) {
+            revert ZeroAssetAddress();
+        }
+
+        UNDERLYING_ASSET = asset_;
+    }
+
+    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
+        return ERC4626.decimals();
+    }
+
+    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.deposit(assets, receiver);
+    }
+
+    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.mint(shares, receiver);
+    }
+
+    function withdraw(uint256 assets, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 shares)
+    {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.withdraw(assets, receiver, owner);
+    }
+
+    function redeem(uint256 shares, address receiver, address owner)
+        public
+        override
+        nonReentrant
+        returns (uint256 assets)
+    {
+        if (shares == 0) {
+            revert ZeroAmount();
+        }
+
+        return super.redeem(shares, receiver, owner);
+    }
+
+    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
+        if (assets == 0) {
+            revert ZeroAmount();
+        }
+
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(msg.sender, address(this), assets);
+        assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived == 0) {
+            revert InexactAssetTransfer(assets, 0);
+        }
+
+        emit YieldDonated(msg.sender, assetsReceived);
+    }
+
+    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
+        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
+        UNDERLYING_ASSET.safeTransferFrom(caller, address(this), assets);
+        uint256 assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;
+
+        if (assetsReceived != assets) {
+            revert InexactAssetTransfer(assets, assetsReceived);
+        }
+
+        _mint(receiver, shares);
+
+        emit Deposit(caller, receiver, assets, shares);
+    }
+}
diff --git a/src/SaveTokenVaultFactory.sol b/src/SaveTokenVaultFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..14dab4f1b7210f83c51e51c0e6a0d26b21225f37
--- /dev/null
+++ b/src/SaveTokenVaultFactory.sol
@@ -0,0 +1,56 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
+import {SaveTokenVault} from "./SaveTokenVault.sol";
+
+contract SaveTokenVaultFactory {
+    error ZeroAssetAddress();
+    error EmptyMetadata();
+    error VaultAlreadyExists(address asset, address vault);
+
+    event VaultCreated(
+        address indexed asset,
+        address indexed vault,
+        address indexed creator,
+        string shareName,
+        string shareSymbol
+    );
+
+    mapping(address asset => address vault) public vaultForAsset;
+    mapping(address asset => address creator) public vaultCreatorForAsset;
+    address[] private _allVaults;
+
+    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
+        external
+        returns (address vault)
+    {
+        if (asset == address(0)) {
+            revert ZeroAssetAddress();
+        }
+        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
+            revert EmptyMetadata();
+        }
+
+        address existingVault = vaultForAsset[asset];
+        if (existingVault != address(0)) {
+            revert VaultAlreadyExists(asset, existingVault);
+        }
+
+        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
+        vaultForAsset[asset] = vault;
+        vaultCreatorForAsset[asset] = msg.sender;
+        _allVaults.push(vault);
+
+        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
+    }
+
+    function totalVaults() external view returns (uint256) {
+        return _allVaults.length;
+    }
+
+    function allVaults(uint256 index) external view returns (address vault) {
+        return _allVaults[index];
+    }
+}
+

tokens used
48,544
```

## final message

Implemented a minimal Foundry project for the onchain savings product. The core contracts are [SaveTokenVault.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/src/SaveTokenVault.sol) and [SaveTokenVaultFactory.sol](/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/src/SaveTokenVaultFactory.sol), with config in [foundry.toml](/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/foundry.toml) and operational notes in [NOTES.md](/home/damu/.cache/ethskills-evals/2026-09-04T041625Z-codex-with-skill-2/security-goal-001/NOTES.md).

The design is an `ERC4626` vault per ERC-20 plus a permissionless factory that creates one vault per asset. Receipt tokens are transferable ERC-20 shares with `permit`. Yield is handled by increasing the vault’s underlying balance, either via direct token transfer or the explicit `donate()` path. Deposits are protected against short-transfer assets by measuring actual balance delta and reverting if the vault receives less than requested.

Verification: `forge build` succeeds. The only runtime note was a non-fatal Foundry warning about writing its local signature cache under `/home/damu/.foundry`, which is read-only in this environment.

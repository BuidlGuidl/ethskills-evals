# Executor transcript — 2026-09-22T222334Z-claude-no-skill-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-22T222334Z-claude-no-skill-2/orchestration-goal-001

## assistant
I'll write the launch runbook. Let me check what's in the working directory first.

## assistant
- **Bash** `ls -la && cat MEMORY.md 2>/dev/null`

  > Exit code 1
  > total 16
  > drwxr-xr-x@  5 spencerfaber  staff  160 Sep 22 16:23 .
  > drwxr-xr-x@  3 spencerfaber  staff   96 Sep 22 16:23 ..
  > drwxr-xr-x@ 12 spencerfaber  staff  384 Sep 22 16:23 .git
  > -rw-r--r--@  1 spencerfaber  staff   50 Sep 22 16:23 package.json
  > -rw-r--r--@  1 spencerfaber  staff  865 Sep 22 16:23 TASK.md

## assistant
- **Bash** `cat TASK.md package.json`

  > We're a two-person team with a working Scaffold-ETH 2 dApp (foundry
  > flavor): a creator-tipping app where fans tip creators in USDC and the
  > contract takes a 1% platform fee. Everything runs and passes tests on the
  > local fork — the full user journey works with a browser wallet against
  > localhost.
  > 
  > Nothing has touched a live network yet: no live deployment, no funded
  > accounts, nothing public. Target c … [508 more chars]

## assistant
The repo isn't here, so the doc is the deliverable. Writing it now.

## assistant
- **Write** `/Users/spencerfaber/.cache/ethskills-evals/2026-09-22T222334Z-claude-no-skill-2/orchestration-goal-001/LAUNCH.md`

  > File created successfully at: /Users/spencerfaber/.cache/ethskills-evals/2026-09-22T222334Z-claude-no-skill-2/orchestration-goal-001/LAUNCH.md (file state is current in your context — no need to Read it back)

## assistant
`LAUNCH.md` is written. It's a 10-phase runbook, each phase ending in a **GATE** you have to pass before moving on, with `[2P]` markers on the checks the *other* person should run.

The path:

0. **Freeze** — clean tree, tests green, tag `pre-launch`.
1. **Secret hygiene** — done *before* a funded key exists; fixes the habits, not just the files. Defines the three-key model (deployer / owner-Safe / fee recipient).
2. **Contract hardening** — the real work. SafeERC20, balance-delta accounting, fee cap, `Ownable2Step`, and `pause()`. Plus a mainnet-fork test against real USDC.
3. **Accounts, RPC, keys** — your own Alchemy + WalletConnect IDs (the shared SE-2 defaults will rate-limit you), foundry keystore, 2-of-2 Safe.
4. **Frontend config** — `onlyLocalBurnerWallet: true`, approve/tip as two visible steps, fee disclosed before signing.
5. **Base Sepolia dress rehearsal** — full deploy + verify + a 12-step journey on two devices, then a 48h soak with outside testers.
6. **Mainnet deploy** — simulate without `--broadcast` first, verify source immediately, assert live state with `cast call`.
7. **Ownership → Safe** — its own phase, deliberately before the public URL.
8. **Production frontend** — real-money smoke test, then monitoring configured *and each alert test-fired*.
9. **Soft launch** over a week, with an incident-response table.

Three judgment calls worth flagging, since you said you'd follow it verbatim:

- **The testnet soak is 48 hours and I'd keep it.** It's the cheapest place to find the config bugs (Vercel env vars, verification settings), and those are exactly the ones that are embarrassing on mainnet.
- **`pause()` may not be in your contract today.** If not, it's a Phase 2 change and it's the one item I'd call non-negotiable — it's unfixable after deploy and it's the difference between a bad afternoon and a catastrophe.
- **The USDC addresses in Appendix C are from my knowledge, not verified against the chain.** I flagged them as "verify, never paste blindly" and gave you the `cast call` commands. Run those.

The doc has `___` fill-in slots throughout (addresses, tx hashes, URLs) so it doubles as the launch record.

## run stats
- turns: 4
- duration: 244s
- cost: $0.7032745
- tokens in/out: 90274/17228
- of which cache write/read: 23937/66329

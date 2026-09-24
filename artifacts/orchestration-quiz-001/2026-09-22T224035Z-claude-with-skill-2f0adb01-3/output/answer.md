# Unblocking contract verification (SE2 foundry → Base mainnet)

## TL;DR

The ticket is not actually blocked. **Scaffold-ETH 2's `yarn verify` does not require a
block explorer API key from ops** — SE2 handles explorer credentials for you. The ops
dependency is a false blocker, so the ticket can be closed this week rather than next
sprint.

And it should not wait for the launch checklist. Verification is a **Phase 2 step that
belongs immediately after deploy**, not a Phase 3 launch task. It's already three days
late, and the chance of it succeeding decays every day we wait.

---

## 1. What exactly we run

From the repo root, on the machine that performed the original deploy, on the exact
commit that was deployed:

```bash
git checkout <the-commit-that-was-deployed>   # same source = same bytecode
yarn verify --network base
```

That's it. In the foundry flavor this drives foundry's verification against Base's
explorer using the deployment records SE2 wrote at deploy time — it does not redeploy
anything and costs no gas. It is safe to re-run; already-verified contracts just report
as already verified.

Then confirm by hand: open each deployed address on basescan.org and check the
**Contract** tab shows the green check, the source, and a populated Read/Write
Contract tab.

If (and only if) that command reports a missing explorer key, the fallback is to set
`ETHERSCAN_API_KEY` in `packages/foundry/.env` — Etherscan v2 keys cover Base, so it's a
free self-serve signup, not an ops ticket. **Do not** paste that key into
`scaffold.config.ts` or any committed file; `.env` only, and `.env*` stays gitignored.

## 2. What we actually need in place

Verification reproduces bytecode, so everything that fed the original compile has to
still match. Concretely:

- **The deploy artifacts.** `packages/foundry/broadcast/.../8453/run-latest.json` holds
  the deployed addresses and constructor args. Note that `broadcast/` and `cache/` are
  **gitignored** — these files exist only on the machine that ran `yarn deploy`. Whoever
  on the two-person team ran the deploy is the one who must run the verify, or must
  hand over those artifacts first.
- **The exact deployed source.** Same commit, no edits to the contracts since.
- **The same toolchain.** Same solc version, same optimizer settings/runs, same
  `foundry.toml`, same `lib/` dependency commits (git submodules — a `forge update`
  silently changes bytecode).
- **A Base RPC URL** that works (the deploy-time one is fine).
- **Explorer credentials** — handled by SE2; fallback above if not.

Nothing here needs ops. Everything here is fragile with respect to time, which is the
whole point of the next section.

## 3. Timing: now, not at launch

Run it now. Today. Reasons, in order of how much they'd hurt:

**The inputs rot.** Verification isn't a standalone action; it's a *replay* of the
deploy. Every day between deploy and verify is another day for someone to bump a
foundry lib, change an optimizer setting, tweak a contract for a follow-up feature,
clear `cache/`, wipe an untracked `broadcast/` dir, get a new laptop, or simply lose
track of which commit went out. Any one of those turns a 30-second command into an
archaeology session reconstructing compiler settings and constructor args by trial and
error. At three days out we're probably still fine. At a month out, with a launch push
happening in the same repo, we very likely are not.

**Folding it into the launch checklist puts an unbounded task on the critical path.**
If verification fails at launch-minus-one-hour, it fails for a reason that takes hours
to diagnose — and the only fixes are "find the right compiler config" or, worst case,
"redeploy from clean source and migrate," which is not a thing you do the morning of an
announcement. Running it now converts an unknown-duration risk into a known result, a
month before it can hurt us.

**The contracts are live and holding real users right now.** The app has been working
against these contracts for three days. Until they're verified, every user and every
integrator sees opaque bytecode: wallets show raw calldata instead of decoded function
calls, nobody can independently audit what they're signing, the explorer's Read/Write
tabs are dead, and security tooling and aggregators can't index us. For a contract that
is *already receiving traffic*, that's a live trust and safety gap, not a launch-day
polish item.

**It de-risks the launch checklist itself.** Verified source on the explorer is what
partners, auditors, and anyone writing the announcement will want to link to. Having it
done means the launch checklist item becomes "confirm the green check is still there" —
a 10-second look, not a task.

**Counterpoint, handled:** the one argument for waiting is "we might redeploy before
launch." That's fine — verification is idempotent and free. If we redeploy, we verify
again immediately after that deploy too. That's the rule either way: **verify right
after every deploy, never later.**

## 4. Suggested ticket update

> Unblocked — the API key dependency was incorrect. SE2's `yarn verify` doesn't require
> an ops-provided explorer key. Action: whoever ran the original `yarn deploy --network
> base` runs `yarn verify --network base` from the deployed commit on the same machine
> (the `broadcast/` artifacts are gitignored and local to that machine), then confirms
> the green check on basescan for each address. Doing this now, not at launch — the
> deploy artifacts and compiler config it depends on degrade with every repo change, and
> we don't want an unbounded debugging task on the launch critical path. Adding a
> one-line launch-checklist item to *confirm* verification, not to perform it.

## 5. Process fix so this doesn't recur

Add to the team's Phase 2 definition-of-done: **a deploy is not done until
`yarn verify --network <net>` has run and the explorer shows verified source.** Deploy
and verify are one step, not two tickets.

# Unblocking contract verification (Base mainnet)

## TL;DR

The ticket is **not actually blocked**. The premise — "waiting on a block
explorer API key from ops" — is wrong for Scaffold-ETH 2. SE2's `yarn verify`
needs no block explorer API key; it's handled for you. Nothing is gating this.

And it should not wait for launch. Verification should have run immediately
after `yarn deploy`, and every day it slips makes it more likely to fail
outright. Do it today.

## What to run

From the repo root, on the machine that has the deploy state:

```bash
yarn verify --network base
```

That's the whole command. SE2 (foundry flavor) reads the deployment record
produced by your `yarn deploy --network base` run and submits each contract's
source, compiler settings, and constructor arguments to the Base explorer.

## What actually needs to be in place

Not an API key. What it needs is **the exact build state that produced the
deployed bytecode**:

1. **The deployment artifacts from that specific deploy run.** Foundry's
   `broadcast/` directory records which addresses got deployed with which
   constructor args. `yarn verify` reads it.
2. **A matching compile.** Verification is a bytecode equality check. Same
   contract source, same solc version, same optimizer settings and runs, same
   library/remapping resolution as three days ago. Anything that changes the
   compiled output breaks the match.
3. **The right commit.** Whatever was in `packages/foundry/contracts/` at
   deploy time — not "close to it."
4. **Network + RPC reachable** for Base, same as any other command.

### The catch you need to check first

In SE2, `.gitignore` excludes `broadcast/` and `cache/`. That means **the
deployment artifacts were never committed** — they exist only on the laptop of
whichever one of you ran `yarn deploy --network base`. On a two-person team
this is the single most likely thing to bite you.

So, concretely, before anything else:

- Identify who ran the deploy. Run `yarn verify` on **that** machine.
- Confirm `packages/foundry/broadcast/` still contains the Base (chain 8453)
  run from three days ago. If someone ran `forge clean`, cleared caches, or
  wiped the working tree, that history is gone.
- Confirm the working tree is at the deploy commit (`git stash` or check out
  the commit if frontend work has moved on since).

If `broadcast/` is already gone, you're not blocked, just doing more work:
verification can still be done by submitting source + exact compiler settings +
ABI-encoded constructor args per address manually. That's recoverable but
fiddly, and it's exactly the failure mode that gets worse with time.

## Timing: now, not at launch

Do it **now**. Folding it into the launch checklist is the wrong call, for four
reasons.

**1. The inputs decay.** Verification is a reproducibility claim about a build
that happened three days ago. Over the next month of frontend work you will bump
dependencies, maybe touch foundry config, maybe `forge clean`, maybe reformat a
contract, maybe reinstall node_modules on a new machine. Any of those can shift
compiled bytecode enough to fail the match. The artifacts are also uncommitted
and sitting on one laptop — laptops get reimaged, repos get re-cloned. You are
holding a perishable asset and proposing to hold it for a month.

**2. It's a real dependency of the launch, not a checklist line item.** If
verification fails at launch, you don't have a five-minute fix — you have a
"reconstruct the exact build environment from a month ago, under announcement
deadline pressure" problem. Discover that today, when the answer is probably
"re-run the command" and there's no clock running.

**3. Your contracts are live and unverified right now.** The app is already
working against them on Base mainnet. Anyone who finds those addresses today
sees opaque bytecode. They can't read the code, can't audit it, can't use the
explorer's read/write tabs. Verified source is also what security researchers,
integrators, and wallet warning systems key off. A month of a live, unverified,
in-use mainnet contract is a month of avoidable opacity — and if there *is* a
problem in the code, you want the window for someone to spot it to start now,
not after you've pointed an audience at it.

**4. It costs nothing to do early.** Verification is idempotent-ish, free, and
doesn't touch contract state or the frontend. There's no "we'd have to redo it
at launch" tradeoff. The teammate's batching instinct is reasonable for things
that are cheap to defer — this one isn't.

The rule the SE2 workflow encodes is: verify immediately after deploy, as part
of the deploy step, not later. You're three days past that. Close the gap today.

## Suggested ticket update

- **Unblock it.** Remove the "waiting on ops API key" dependency — SE2's
  `yarn verify` doesn't need one; that blocker was a misreading.
- **Reassign to whoever ran the deploy** (they have the `broadcast/` artifacts).
- **Action:** `yarn verify --network base` from the deploy commit, today.
- **Done when:** every deployed address shows verified source on the Base
  explorer, and someone has clicked through the read/write tabs to confirm.
- **If it fails:** escalate immediately rather than deferring — a failure now is
  a routine fix, a failure at launch is not.
- **Follow-up (separate, small):** add `yarn verify --network <net>` to the
  deploy runbook as a required step so the next deploy can't leave this gap.

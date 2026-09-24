# Unblocking the contract verification ticket

**Short version:** the ticket is not actually blocked, and it should not wait for
launch. Run verification today.

---

## 1. The premise of the block is wrong

The ticket says "waiting on a block explorer API key from ops (ETA next sprint)."

For a Scaffold-ETH 2 (foundry) project, **you don't need an API key from ops to
verify.** SE2 wires verification up for you — `yarn verify` handles the explorer
credentials as part of the standard flow. There is no ops dependency here, so
there is nothing to wait a sprint for.

Even in the fallback case where you want your own key (e.g. you hit rate limits
on a shared/default key), an Etherscan API key is free and self-serve: anyone on
the team can create an account and mint a key in a couple of minutes. It's a
form, not a procurement request. Either way this never needed to be an ops
ticket.

**Action:** flip the ticket from `blocked` to `ready`, drop the ops dependency.

## 2. What exactly to run

From the repo root, on the machine that ran the original deploy:

```bash
# 1. Be on the exact commit that was deployed three days ago
git log --oneline -5                 # confirm you're on the deployed commit
git status                           # working tree must be clean

# 2. Verify against Base mainnet
yarn verify --network base
```

That's the whole command. `yarn verify --network base` is the counterpart to the
`yarn deploy --network base` you already ran — same network flag, same project,
no extra arguments.

Then confirm by eye: open each contract address on the Base explorer and check
it shows the green "Contract Source Code Verified" state with a readable
`Read Contract` / `Write Contract` tab.

## 3. What actually has to be in place for it to work

Verification is a proof that a specific source tree, compiled with a specific
compiler and settings, produces exactly the bytecode already sitting at that
address. So what it needs is *the exact state of the repo at deploy time*:

1. **The deployed commit, checked out clean.** Not "roughly the same code" — byte
   for byte. Any change to a contract, a comment inside a contract, an import,
   or a remapping changes the bytecode and verification fails.
2. **The same compiler config** — solc version, optimizer on/off, optimizer runs,
   EVM version, via-IR setting, all as they were in `foundry.toml` at deploy.
   Bumping any of these silently breaks verification of already-deployed code.
3. **The deploy artifacts from the actual deploy run** — foundry's `broadcast/`
   output and SE2's deployment records under `packages/foundry`. These carry the
   deployed addresses and, critically, the **constructor arguments** used. Note
   that SE2's `.gitignore` excludes `broadcast/`, so these artifacts exist *only
   on the machine that ran the deploy* and are not in git. Whoever ran
   `yarn deploy --network base` must be the one to run `yarn verify --network base`,
   from that same working copy, before anyone runs `forge clean`, wipes
   `node_modules`, reformats a laptop, or nukes the branch.
4. **The same foundry/solc toolchain version installed.** A `foundryup` between
   now and launch can change the compiler build you get and therefore the
   bytecode you'd reproduce.
5. Network access to the explorer's verification API, and the explorer having
   indexed the contracts (it has — the deploy was three days ago).

None of those five things get *easier* by waiting a month. Items 1–4 all get
strictly harder.

## 4. Timing: now, not at launch

**Do it now — today.** Folding it into the launch checklist is the wrong call,
for two independent reasons.

### It gets harder with every day that passes

Everything verification depends on is a snapshot of the repo as it was three
days ago, and every one of those dependencies erodes over a month of active
development:

- Someone edits a contract, even trivially, and the source no longer matches the
  deployed bytecode. Now you're archaeology-ing for the right commit under
  launch-day time pressure.
- Someone runs `foundryup`, or a dependency/submodule bumps, and the compiler
  output shifts.
- Someone runs `forge clean`, resets their machine, or re-clones — and the
  ungitignored `broadcast/` artifacts with the constructor args are simply gone.
  Reconstructing constructor args by hand from onchain calldata is doable but
  it's a miserable thing to be doing the morning of an announcement.
- On a two-person team, the one person who holds those artifacts might be on PTO
  during launch week.

Right now it's a two-minute command with everything already in place. In a month
it's an unbounded debugging task scheduled for the single worst day to have one.
Launch checklists should hold things that *can only* be done at launch;
verification is the opposite of that.

### The contracts are already live and unverified

This is the part that makes it urgent rather than just prudent. The app is live
against these contracts on Base mainnet — real users, real funds, right now, for
three days already and counting. While they're unverified:

- Nobody outside your team can read what they're interacting with. Users,
  integrators, and security researchers see opaque bytecode.
- Explorer "Read/Write Contract" tabs don't work, so there's no independent way
  for a user to check state or to exit/interact if your frontend is down.
- Wallets and security scanners degrade unverified contracts in their warnings,
  which is a real conversion cost on a consumer dApp.
- Unverified contracts on mainnet are a standard phishing/rug signal. You're
  wearing that signal during the month you're presumably courting early users.

Verification is a *transparency* property of live contracts, not a *marketing*
deliverable for launch day. Deferring it means choosing to run opaque contracts
over live user funds for a month to save a command you could run in the next
five minutes.

### The general rule

Verify immediately after deploy, as part of the deploy step — not later, and
never skipped. `yarn deploy --network base` and `yarn verify --network base` are
one unit of work. The three-day gap is already a miss; don't extend it to a
month.

## 5. Suggested ticket update

> **Unblocked.** No ops dependency — SE2 handles explorer credentials for
> `yarn verify`; a personal Etherscan key is free/self-serve if we ever need our
> own. Verification must run from the deploying machine on the deployed commit,
> while the foundry `broadcast/` artifacts (constructor args, addresses — not in
> git) still exist. Doing this today, not at launch: the inputs decay with every
> repo change, and the contracts are live with user funds while unverified.
>
> Follow-up: add `yarn verify --network <net>` to the deploy runbook as a
> required step immediately after `yarn deploy`, so this can't recur.

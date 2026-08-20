# eval: tools `with_skill` regression guard — claude / claude-opus-5

**Skill:** `skills/tools` @ `cb7e82d` (minimal skill, after the PR #68 review corrections)
**Executor:** `claude`, model `claude-opus-5`
**Judge:** `claude`, model `claude-opus-5` — fresh blind process per run
**Runs:** 3 `with_skill` runs × 3 tasks = 9 graded runs. **No `no_skill` arm.**
**Trigger:** content-only; no forced skill invocation

All 9 records carry `self_judged: true` — executor and judge are the same agent stack.
Each judgment ran in a fresh blind process that saw neither the variant nor the skill.

## Read this as a guard, not a benchmark

**These runs cannot show whether the skill helps.** There is no contemporaneous
`no_skill` arm, so nothing here is a delta. They exist to answer three narrower
questions raised by the review corrections in `cb7e82d`:

1. The frontmatter was narrowed. **Does the skill still trigger?**
2. The x402 paragraph was rewritten. **Did the correction introduce a new stale fact** —
   the failure that has now bitten this PR three times?
3. `tools-goal-001` expect_3 was split into expect_3 + expect_4. **Does the new check
   run?**

`no_skill` numbers for these tasks are carried forward, not re-measured: quiz-003 **0/3**
and quiz-001 **3/3** from `reports/tools-2026-08-02.md`, goal-001 **3/3** from
`reports/tools-goal-001-2026-08-19.md`. Those were graded against earlier skill
revisions and, for goal-001, an earlier expect wording.

## Results

| Task | `with_skill` @ `cb7e82d` | Carried-forward `no_skill` | Expects |
| --- | --- | --- | --- |
| tools-quiz-003 | **3/3** | 0/3 (2026-08-01) | 3 |
| tools-quiz-001 | **3/3** | 3/3 (2026-08-01) | 3 |
| tools-goal-001 | **3/3** | 3/3 (2026-08-19) | **4** |

Nothing regressed. All three questions above come back clean.

## Findings

### 1. The trigger survived the frontmatter cut — 9/9

The `description` lost "testing stacks, RPC or explorer integrations", none of which
survive in the body. The risk was that a narrower description stops the skill loading
for jobs it *can* still help with.

**Every one of the 9 runs invoked the `Skill` tool**, once each, before doing any work.
quiz-003 is the sensitive test — it is the only task in the tools set where the arms
ever diverged (0/3 vs 3/3) — and it is 3/3 with the skill firing every time.

### 2. The rewritten x402 paragraph introduced no new stale fact

This is the one that mattered. All three quiz-001 answers mention `x402Fetch` and
`createWallet` — and in all three they appear **only as warnings**, each verified against
the installed runtime exports rather than repeated from the skill on faith:

> `x402Fetch` and `createWallet` **do not exist**. `@x402/fetch` exports exactly
> `wrapFetchWithPayment`, `wrapFetchWithPaymentFromConfig` …

> confirmed `wrapFetchWithPayment(fetch, client)`, the `x402Client.register(network,
> scheme)` shape, and that `x402Fetch` / `createWallet` are absent from the runtime exports.

### 3. Not pinning a signature was the right call, and the runs prove it

The three goal runs built the client three different ways, all valid on 2.23.0:

| Run | Client construction |
| --- | --- |
| 1 | `new x402Client()` + `new ExactEvmScheme(toClientEvmSigner(…))`, server via `new ExactEvmScheme()` |
| 2 | `new x402Client()` + `new ExactEvmScheme(toClientEvmSigner(…))`, server via `registerExactEvmScheme` |
| 3 | `new x402Client()` + `registerExactEvmScheme` on **both** sides |

Every one read the installed `.d.ts` files first. Had the skill pinned any single one of
these shapes — which is exactly what the pre-correction version did, and what the first
attempt at the fix also did — it would have contradicted two runs out of three. This is
direct evidence for `tools-skill-x402-example-api-nonexistent`'s conclusion that naming
the dead symbols and deferring to the installed types is the only non-rotting form of
the correction.

All 3 shipped `@x402/{core,evm,express,fetch}@^2.23.0` + `@coinbase/x402@^2.1.0`, one
also `@x402/paywall`. No unscoped package in any final artifact, and none installed even
transiently.

### 4. expect_4 ran for the first time — 3/3

The split check works mechanically and grades. Like expect_3 it separates nothing on this
skill revision, which is the correct outcome for a guard. Worth stating plainly: the split
was made for readability of *failures*, and no run has failed either half yet, so its value
is still unproven.

### 5. The Blockscout split is now 3/3 on both halves

All three goal runs wired Blockscout REST for the server's data path **and**
`mcp.blockscout.com/mcp` for the agent-facing path — the exact distinction the minimal
skill encodes. On 2026-08-19 that was 2/3. No run touched Etherscan or Alchemy.
All three quiz-003 answers name the MCP endpoint explicitly.

## Cost and latency

Mean per run, executor result events. `with_skill` only — there is no arm to compare to.

| Task | Duration | Turns | Cost | Prior `with_skill` mean |
| --- | --- | --- | --- | --- |
| tools-quiz-003 | 135s | 9.7 | $0.37 | 46s / $0.21 (2026-08-01) |
| tools-quiz-001 | 232s | 32.3 | $1.16 | 369s / $1.70 (2026-08-01) |
| tools-goal-001 | 876s | 73.3 | $4.08 | 808s / $4.66 (2026-08-19) |

Read none of these as a trend. n=3, and the prior means come from different skill
revisions. quiz-003's mean is dragged by one 281s outlier against two ~62s runs.

Total executor spend: **$16.83**, judges excluded.

## Integrity notes

Runs were executed **sequentially**, not in parallel. goal-001 runs stand up an Express
server, and running them one at a time removes the port-collision question the
2026-08-19 benchmark had to check for by PID.

`.claude/settings.local.json` was extended locally to permit the executor spawn command;
it is untracked and does not enter the repo. The spawn command itself is byte-identical
to the one in AGENTS.md and to the one every committed run used.

**The codex `tools-quiz-004` rerun was attempted and abandoned.** It was meant to
demonstrate that the rewritten expect_2 accepts a live-verified pin, which only
codex/gpt-5.6-sol produces. Codex's `-s workspace-write` sandbox needs unprivileged user
namespaces, and this host has `kernel.apparmor_restrict_unprivileged_userns=1`, so
`bwrap` cannot start and every file write is refused — reproducible from an unsandboxed
shell, so not an artifact of how the executor was spawned. Two attempts produced no
`answer.md`; both run dirs were deleted rather than recorded as failures, because an
environment blocker is not a result. `tools-eval-rejects-current-create-eth-pin` carries
this as a run still owed.

## Wrap-up

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **Unanswerable from these runs** — no `no_skill` arm. Against carried-forward baselines the tasks sit at 3/3, 3/3, 3/3, unchanged. |
| Did it reduce time/tokens? | Not measurable without a paired arm. Absolute cost: $0.37 / $1.16 / $4.08 mean per run. |
| Did it create negative deltas? | No. Nothing regressed against the prior `with_skill` numbers, and the trigger held 9/9. |
| What mistakes repeated without the skill? | n/a — no `no_skill` runs. |
| What mistakes remained with the skill? | None. No run reached the v1 line even transiently, none used a dead symbol as real, none went to Etherscan. |
| What should change in the skill? | Nothing from these runs. The narrowed frontmatter, the rewritten x402 paragraph, and the `create-eth` rewording all held. |
| What should change in the eval? | Two things still owed. The codex quiz-004 run that would demonstrate the fixed expect_2, blocked on host sandboxing. And a paired `no_skill` arm for goal-001 under the 4-expect spec — until then the headline for that task mixes a 4-expect `with_skill` set with a 3-expect `no_skill` set. |

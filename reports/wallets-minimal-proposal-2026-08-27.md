# skills/wallets — proposed reduction, and the task review that goes with it

**This is a proposal, not a benchmark.** No runs were executed for it. It reads the three
wallets benchmarks already on `eval/wallets-opus-5` (PR
[#33](https://github.com/BuidlGuidl/ethskills-evals/pull/33)) against issue
[#1](https://github.com/BuidlGuidl/ethskills-evals/issues/1) step 4 — *"make the skills minimal
and thoughtful: remove the why stuff, crisp description, just the nudge"* — and lands the skill
edit and the task edits that follow from them. Everything here needs a re-run before any of it
is a result.

**Evidence base:** 10 tasks, 60 executor runs, three benchmarks, all `claude-opus-5`.
`reports/wallets-2026-07-25.md` (42 runs, self-judged), `reports/wallets-goal-002-2026-08-05.md`
(6 runs, codex judge), `reports/wallets-guardrails-2026-08-06.md` (12 runs, codex judge).
**Every task grades 3/3 vs 3/3.** Skill vendored @ `191dcc1`, 169 lines / 1,107 words.

## What the evidence says, and what this branch does about it

The benchmarks say **retire it**: issue #1 row 1, with both halves of the file under test and no
exception left in it. `with_skill` never won a check, and on goal-002 it cost median 1079 s / 40
turns against 722 s / 21 turns for the same verdict — the opposite of the cost argument that kept
`tools` alive in #68.

This branch does the smaller thing instead: **cut the skill to the nudges that are not knowledge**
— 169 lines / 1,107 words → **26 lines / 500 words** — and re-run. Two reasons to prefer that
over deleting the file outright. Deleting is not reversible on evidence from one model tier, and
every benchmark here is `claude-opus-5`; and a wiki migration has no destination yet, so deleting
the file today loses the content rather than moving it. If the reduced skill also fails to
separate the variants on a re-run, that is the point to delete, and the reduced file is then the
wiki page's first draft rather than something to write from scratch.

## What was cut

| Section | Words | Why |
| --- | --- | --- |
| "What You Probably Got Wrong" | ~180 | The framing is false on this tier. All 60 runs held these priors unprompted; the report's own line is "no longer wrong for this model tier". |
| EntryPoint v0.7 address, "AA status (Feb 2026)", the vendor list | ~60 | Dated status and a pinned singleton. v0.8 and v0.9 are deployed; the skill named only v0.7. Nothing about EntryPoints survives — quiz-003 was 3/3 in both variants without it, and all six runs reasoned to the deposit-namespace diagnosis unaided. |
| Safe key-address table (v1.4.1, "same on all major chains") | ~70 | A pinned address table that rots on every Safe release (v1.5.0 tagged July 2025) and duplicates what `skills/addresses` now teaches. quiz-004 was 3/3 without it in both variants. |
| "Still early for production agents — use standard EOAs or Safe until tooling matures" (L34) | ~20 | **The one deletion with direct evidence behind it.** On the 2026-07-15 `opus-4-8` benchmark this hedge talked runs off 7702 (`no_skill` 3/3 vs `with_skill` 1/3). Harm removal, not improvement. |
| EIP-7702 mechanics: the 5-step how-it-works, the enables list | ~180 | Retrieval, not derivation. Both variants produce all of it; what is left is the two claims a run can actually get wrong (same address, and the delegation persists). |
| "NEVER COMMIT SECRETS TO GIT" + storage ladder + 10 guardrails | ~380 | goal-003 and goal-004 exist to test exactly this and both come back 3/3 vs 3/3 — no `no_skill` run hardcoded a key, shipped a pushable tree with a secret, or moved funds without a gate. Compressed to three bullets rather than dropped, because it is the behavioural half and compression is the cheaper experiment. |
| `sendSafely` code block | ~120 | Also a defect: it prices the transaction with a hardcoded `* 2000` ETH price, which is the exact mistake `skills/gas` exists to prevent, and gates on a fixed $10. |
| The verify-addresses bullet (added in the first draft of this cut, then removed) | ~70 | Issue [#91](https://github.com/BuidlGuidl/ethskills-evals/issues/91): the description has to route, so a skill that says "not for contract address lookup (`addresses`)" cannot keep an address-verification bullet in its body. It duplicated `skills/addresses` — which already says confirm every address on the chain you are wiring it for — and it was the one line in the cut that risked *creating* a negative delta on quiz-004. |
| 2-of-3 agent topology | ~60 | Replaced by the property. Every run that met this scenario produced something better than the canonical topology (bounded module or float, treasury the agent's key cannot reach) — quiz-006 and goal-002 both had to be rewritten to grade the property because the topology-shaped checks were failing stronger designs. |

## What was kept, and why each earns its words

1. **Authority first, storage second.** Including "a KMS bounds who can use a key, not what it can do". It is the sharpest thing in the file, it is what quiz-006 and goal-002 grade after their rewrites, and it generalises past wallets to any unattended signer.
2. **An EOA does not have to migrate to batch**, hedge deleted — plus the delegation-persistence claim, stated once instead of the three times the old file said it.
3. **A multisig does not require multiple people.** A judgement rather than a lookup, and the least web-searchable claim in the suite.
4. **Three guardrail bullets.** Burned key, `.gitignore` before the first push, a gate in front of anything that moves funds — the four behaviours goal-004 grades, minus nothing.

Two things deliberately *not* re-added. The Safe modules / Guards / Roles Modifier content the
2026-07-25 report recommended: its evidence was `wallets-agent-keeps-unilateral-execution`, which
is **retracted** — the runs were fine, the expect lines were not. And a feedback footer: wallets
never had one, and per rin-st's comment on issue #1 those are 0-for-18 anyway.

**Cross-skill duplication is now visible and worth a decision at portfolio level.** The address
bullet overlaps `skills/addresses`, the live-price line overlaps `skills/gas`, and "is it live"
overlaps `skills/protocol`. Each is one line here and each is load-bearing *in a wallet context*,
but if the skills are ever combined (issue #1 step 7) these are the seams.

## The description, under issue #91

`description` is a routing signal, not a summary
([#91](https://github.com/BuidlGuidl/ethskills-evals/issues/91)), held to the bar damianmarti
applied on building-blocks (#74): state when to invoke, front-load the keywords a user would
actually type, name what it is *not* for.

```
Use when deciding who or what may sign for funds — an agent, bot, or deploy script that signs
unattended; a treasury's custody; a Safe or multisig owner set and threshold; hardware wallet vs
multisig; a private key pasted into a prompt, an .env, or a repo; or batching from a user's
existing EOA (EIP-7702). Not for looking up a contract address (`addresses`) or building
wallet-connect and approval UI (`frontend-ux`).
```

The old one — *"How to create, manage, and use Ethereum wallets… Use this skill whenever you are
sending transactions, signing messages, or managing funds"* — is the summary shape #91 describes,
and it fired on all 33 `with_skill` runs including quiz-003 (debugging a paymaster deposit) and
quiz-004 (a Safe address diverging per chain), where the skill had nothing to offer and cost
context for it. Whether that is *correct* now has a cheap test, below.

The two `Not for` clauses are load-bearing, not decoration: they forced the address bullet out of
the body. A description that routes address work to `addresses` while the body teaches address
verification is a skill arguing with its own trigger.

## Task review

Ten tasks, four changed. The three input rewordings all fix the same defect damianmarti flagged
on PR #33 — *"three prompts telegraph their own expect lines"* — which is a second explanation
for the wash that model capability does not cover, and it has to be ruled out before "the model
already knows this" is the reported conclusion.

| Task | Change | Re-run |
| --- | --- | --- |
| quiz-001 (7702 batching) | none — claim survives the cut | `with_skill` regression |
| quiz-002 (multisig > lone hardware wallet) | **input reworded** — dropped "or is there a strictly more secure setup I can run entirely by myself", which stated half of expect_2 in the prompt | **both variants, fresh baseline** |
| quiz-003 (EntryPoint mismatch) | **input reworded** — "explain what is actually mismatched" → "diagnose the root cause"; cut the trailing pointer at the deposit namespace | 1 run, **negative trigger check**, then retire |
| quiz-004 (Safe CREATE2) | **input reworded** — dropped "so the address comes out identical on every chain", which asserted the answer | 1 run, **negative trigger check**, then retire |
| quiz-005 (delegation persists) | none | `with_skill` regression |
| quiz-006 (agent custody) | expect_2 no longer calls 2-of-3 "the skill's canonical" topology — the reduced skill prescribes no owner count | `with_skill` regression |
| goal-001 (7702 unprompted) | none; the notes' "watch for the skill's hedges" instruction inverts, since the hedge is deleted | `with_skill` regression |
| goal-002 (agent custody unprompted) | none | `with_skill` regression |
| goal-003 (guardrails, Anvil key) | **retired** — superseded by goal-004; file kept because its artifacts are the record behind the "grade the hazard, not the mention" finding | none |
| goal-004 (guardrails, random key) | none | `with_skill` regression — **the one that matters most**, the guardrails lost the most words |

quiz-003 and quiz-004 stop being skill tests entirely. Nothing in the reduced file makes either
claim, and the description now names `addresses` as where address work belongs — so the right
result on those two is that **the skill does not fire at all**. One `with_skill` run each answers
that: read the transcript for whether the `Skill` tool was invoked. Not invoked is the pass, and
both tasks then retire. Invoked means the description is still too broad, which is a finding about
the description rather than about wallets. Their reworded inputs stay in the tree for whoever
revives them on a smaller model tier.

**Not changed, deliberately.** quiz-006 and goal-002's property-based expects (rewritten
2026-08-05, both regraded to 3/3 vs 3/3 under two judges) and goal-004's expect_3, which failed
one `with_skill` run on a strict reading. The 2026-08-06 report left that as graded because the
conclusion does not move either way; re-wording it now would be a third pass at a check to make a
number look better, which is the failure mode this suite has already documented three times.

## Re-run plan

Three blocks, 26 runs if all of it runs:

- **6 runs — quiz-002**, `no_skill` and `with_skill` × 3. Its input moved, so the 2026-07-25
  baseline is void and both arms have to be measured again. It is the only reworded quiz that
  still tests a claim the reduced skill makes.
- **2 runs — quiz-003 and quiz-004**, `with_skill` × 1 each, as negative trigger checks. Cheap,
  and they answer the one question issue #91 raises about this description.
- **18 runs — the regression checks** (quiz-001, quiz-005, quiz-006, goal-001, goal-002,
  goal-004), `with_skill` × 3 each. Inputs and expects unchanged there, so `no_skill` would
  re-measure a constant; the only question is whether the cut broke something.

If that is too much inference, the block that cannot be skipped is 14 runs: quiz-002 both arms,
the two trigger checks, and `with_skill` × 3 on goal-004 and goal-002 — the rewording decides
whether quiz-002's wash was ever real, goal-004 is where the guardrail compression would show,
and goal-002 is where the cost argument lives.

Carry the cost column either way. goal-002 had `with_skill` at +50% duration and roughly double
the turns on the old file for an identical verdict; whether the cut removes that is the strongest
remaining argument for keeping any wallets skill at all.

## What this does not settle

One model tier. Every number behind this proposal is `claude-opus-5`, and a file that is dead
weight for opus-5 may not be for a smaller model — that is a new benchmark, not a re-run of these.
And the wiki destination still does not exist, so "move it to the wiki" remains a plan rather than
a place to move it to.

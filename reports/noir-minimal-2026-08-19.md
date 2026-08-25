# noir (minimal SKILL.md) — claude/opus-5

A fresh benchmark of the compressed `skills/noir`, reported separately from PR #73.
The numbers below are **not** blended with #73's; #73 appears only as the bar to clear.

**Question:** `skills/noir` was cut from 3939 words to 732 (81%, ~5100 → ~950 tokens) per
issue #1 step 4. Did the cut cost anything?

**Answer:** Not on any axis this benchmark can see. `with_skill` went 3/3 on
noir-goal-001 and 3/3 on noir-quiz-002 — exactly #73's bar — and the three rot items
fixed inside the minimal skill all landed, most visibly the poseidon re-pin cycle that
burned a compile-fail turn in every #73 run and occurred **zero** times in all 12 runs
here. The finding that complicates the story is on the other side: the `no_skill`
baseline improved sharply (2/3 and 3/3, against #73's 1/3 on goal-001), so the graded
numbers no longer separate the variants much. What still separates them is ungraded and
only visible by reading circuits — in-circuit hash choice (3/3 vs 1/3) and the skill's
poseidon import path (3/3 vs 0/3) on goal-001. A third read, the note module written to
disk (3/3 vs 0/3), is weaker than it looks: no `no_skill` run loses the note either, it
just keeps it recoverable another way — see "Merkle path derivation and note handling".

## Setup

| | |
| --- | --- |
| Executor | `claude`, model `claude-opus-5`, 3 runs per variant |
| Judge | `claude`, model `claude-opus-5` |
| Tasks | `noir-goal-001`, `noir-quiz-002` — 12 runs total |
| Skill under test | `skills/noir` @ `840dde0` (732 words) |
| Harness | `eval/noir-minimal-run` (`harness/run-lifecycle`) |
| Trigger | content-only — no "use the noir skill" line was prepended |

All 12 runs came back `self_judged: true` (judge and executor are both claude). That is
expected on a single-stack benchmark and is a caveat on the numbers, not a defect in
them; #73 was graded the same way.

Toolchain, unchanged from #73 and deliberately not upgraded:

```
nargo version = 1.0.0-beta.26     bb    = 5.1.0   (bbup -v 5.1.0; bare bbup 404s)
forge         = 1.4.4-stable      node  = v22.18.0
```

Only `SKILL.md` differs from #73's environment. Task specs, expect lines, harness scripts
and judge are byte-identical, and none were edited for this run.

**The committed skill is no longer the benchmarked one.** Review of this PR turned up four
wrong lines in `840dde0`, all inherited from the pre-cut text rather than introduced by the
compression, and they are fixed in this branch (732 → 781 words): the `{ keccak: true }`
example, the removed `--oracle_hash keccak` flag, the `>=0.8.21` Solidity floor with its
dropped `solc_version` remedy, and the missing
`npm install ... "@aztec/bb.js@$(bb --version)"` command. Each is scored against the 12 runs
under "Skill edits"; none of them touched this benchmark. Everything below describes
`840dde0`.

**noir-quiz-001 and noir-quiz-003 were deliberately skipped.** Both scored 5/5 and 4/4 in
every run of both variants in #73. They discriminate nothing, so re-running them would
have added six runs of cost and no signal. They are not un-run by oversight.

## Headline — per-check counts

The aggregate `pass` hides most of the signal on quiz-002, whose four expects are
conjunctive. Per check:

### noir-goal-001 (7 expects)

| Check | what it grades | no_skill | with_skill |
| --- | --- | --- | --- |
| expect_1 | vote not sent from member wallet; relayer / 4337 named | 3/3 | 3/3 |
| expect_2 | nullifier scoped to proposal in-circuit | 3/3 | 3/3 |
| expect_3 | count only after `verify()`; no MockVerifier in deploy | 3/3 | 3/3 |
| expect_4 | NoirJS in-process, `UltraHonkBackend`, EVM serialization | 3/3 | 3/3 |
| expect_5 | NOTES.md names each sender, matches the code | 3/3 | 3/3 |
| expect_6 | public input ordering matches across layers | 3/3 | 3/3 |
| expect_7 | Merkle path from replayed insert events; note persisted | **2/3** | 3/3 |
| **run pass** | | **2/3** | **3/3** |

### noir-quiz-002 (4 expects)

| Check | what it grades | no_skill | with_skill |
| --- | --- | --- | --- |
| expect_1 | Poseidon from external dep, `poseidon::poseidon::bn254::` | 3/3 | 3/3 |
| expect_2 | not SHA256/keccak in-circuit | 3/3 | 3/3 |
| expect_3 | post-colon `pub` syntax | 3/3 | 3/3 |
| expect_4 | salt + recompute + range-check, public bounds | 3/3 | 3/3 |
| **run pass** | | **3/3** | **3/3** |

`with_skill` clears the #73 bar on both tasks. The single graded failure in all 12 runs is
goal-001 `no-skill-3` on expect_7.

**quiz-002 expect_1 did not discriminate, again.** All three `no_skill` runs passed it
using `use poseidon::poseidon2::Poseidon2` — Poseidon2 from the external dependency, which
the task notes call a skill-conformance failure and which the judge passed 3/3, exactly as
in #73. So the `with_skill` 3/3 there must not be read as the minimal skill's import path
landing. Reading the actual imports:

| run | quiz-002 import | goal-001 import |
| --- | --- | --- |
| no_skill 1/2/3 | `poseidon::poseidon2::Poseidon2` ×3 | Poseidon2 / hand-rolled SHA-256 / keccak256 |
| with_skill 1 | `poseidon::poseidon::bn254::hash_4` | `poseidon::poseidon::bn254::hash_2` |
| with_skill 2 | `poseidon::poseidon::bn254::hash_3` | `poseidon::poseidon::bn254::hash_2` |
| with_skill 3 | `poseidon::poseidon2::Poseidon2` | `poseidon::poseidon::bn254::hash_2` |

The skill's exact import path lands 2/3 on quiz-002 and 3/3 on goal-001; `no_skill` lands
it 0/6. The pass column shows none of that.

## The three predicted rot fixes

All three were fixed inside the minimal skill before this benchmark, so they were
predictions to check rather than warnings to act on. All three hold.

**1. poseidon pinned at v0.3.0 — confirmed, and this is the headline.** In #73 every run
burned a compile-fail-and-re-pin cycle on the stale v0.2.6 pin
(`error: Expected type [Field], found type &[_; 0]` in `poseidon/mod.nr:355`). Across all
12 runs here that error appears **0 times**, `poseidon/mod.nr` appears 0 times, and no run
shipped a v0.2.6 pin.

The honest qualifier: all three `no_skill` quiz-002 runs also independently pinned v0.3.0.
The model's own prior has caught up, so the fix prevented a regression rather than
delivering an advantage the baseline lacks. It is still the right pin, and a skill that
still said v0.2.6 would now be actively harmful.

**2. Merkle path indices `[bool; DEPTH]` — confirmed.** `[u1; N]` appears 0 times in all
three `with_skill` goal-001 runs. It still appears in `no_skill` (4 and 6 mentions in runs
1 and 2), so the correction is doing work the baseline does not do for itself.

**3. `bbup -v <version>` — confirmed, but documented rather than invoked.** No run ran
`bbup` at all; the toolchain was pre-installed per the task's pre-flight. What happened is
that the skill's line propagated into the deliverable's install docs: a versioned `bbup`
plus the bare-`bbup` caution appears in each of the three `with_skill` runs' `README.md`
and in 0 `no_skill` deliverables (`no_skill`'s only `bbup` string is a `ls ~/.bb/`
listing). `with-skill-2` and `-3` wrote `bbup -v 5.1.0`; `with-skill-1` copied the skill's
`bbup -v <version>` placeholder verbatim. A real 3/3 vs 0/3 effect, on documentation.

**`claude mcp add noir-mcp` / `/reload-plugins`: 0 turns in all 12 runs**, both variants.
That section was deleted in the minimal skill and cost nothing to delete.

## Environment drift — it did not fire

Recorded per goal-001 run, as required. `@aztec/bb.js` published 5.2.0 after the #73
baseline; this machine's CLI is 5.1.0 and stayed there. A plain `npm install` today
resolves to 5.2.0, and that mismatch diverges proof serialization.

| run | `@aztec/bb.js` installed | deliberate pin or npm latest? |
| --- | --- | --- |
| no-skill-1 | 5.1.0 | deliberate |
| no-skill-2 | 5.1.0 | deliberate |
| no-skill-3 | 5.1.0 | deliberate |
| with-skill-1 | 5.1.0 | deliberate |
| with-skill-2 | 5.1.0 | deliberate |
| with-skill-3 | 5.1.0 | deliberate |

Read from each workspace's `package.json`, `package-lock.json` and the resolved
`node_modules/@aztec/bb.js/package.json` — all three agree, in all six runs.

**Every run pinned 5.1.0 to match the CLI; none took npm latest.** No expect_4 failure had
to be attributed, because expect_4 passed 6/6. Neither of the two attributable causes
occurred: no run shelled out to the `bb` CLI to prove, and no run proved on 5.2.0 against
a 5.1.0 CLI. The drift is real and still live, but it did not touch this benchmark and
nothing here is discounted for it.

## Mined per task — reported, not graded

### goal-001

**`nargo compile` and `forge build` both actually passed in all 6 runs.** The judge reads
code and cannot execute, so this was checked directly: compiled circuit artifacts exist on
disk for every run (`target/*.json`, 79KB–418KB), and `Compiler run successful` appears in
every transcript. Several runs hit intermediate failures and recovered.

**In-circuit hash choice — the sharpest split in the benchmark, and no expect grades it.**

| run | in-circuit hash | note |
| --- | --- | --- |
| no-skill-1 | Poseidon2 | algebraic, acceptable |
| no-skill-2 | **hand-rolled truncated SHA-256** | via `std::hash::sha256_compression` |
| no-skill-3 | **keccak256** (external dep) | "leaves, Merkle nodes, nullifiers" |
| with-skill-1/2/3 | `poseidon::poseidon::bn254::hash_2` | 3/3 |

Two of three `no_skill` runs put a ~30,000-gate bit-oriented hash where ~600 gates would
do, in a circuit whose members prove in a browser — and both wrote a confident rationale
for it. `no-skill-2`'s `hash.nr` opens: *"Why SHA-256 and not Poseidon: the same hash has
to be computed in three places ... SHA-256 is a cheap precompile in the EVM (60 gas)"* —
trading circuit constraints for EVM gas a Poseidon verifier never spends.
**`no-skill-2` passed 7/7 anyway.** This reproduces #73's finding (keccak256 2/3 no_skill,
poseidon 3/3 with_skill) at the same rate against the compressed skill.
Filed as `noir-bit-oriented-hash-in-circuit`.

**Proving path — all 6 runs prove in-process.** Every run, both variants, used
`new UltraHonkBackend(circuit.bytecode, api)` with `await Barretenberg.new()` and
`generateProof(witness, { verifierTarget: "evm" })`. Not one shelled out to the `bb` CLI in
its prover. **This is where the `no_skill` baseline diverges most from #73**, where 2/3
`no_skill` runs shelled out and failed expect_4.

Notably, no run used the skill's own `{ keccak: true }` example — see the skill-edit
section below.

**Merkle path derivation and note handling.**

| run | mirror built from | note written to disk | how the member recovers it |
| --- | --- | --- | --- |
| no-skill-1 | replayed events | no | secret derived from a wallet signature; leaf index found in the tree |
| no-skill-2 | replayed events | no | random secret printed at registration, re-imported with `--secret` / `--passphrase` |
| no-skill-3 | **`getCommitments()` view call** | no | secret derived from a wallet signature; tradeoff written out in NOTES.md |
| with-skill-1 | replayed events | yes — `scripts/client/identity.mjs` | the file the tool writes |
| with-skill-2 | replayed events | yes — `js/lib/note.mjs` | the file the tool writes |
| with-skill-3 | replayed events (viem `eventName`) | yes — `client/src/identity.js` | the file the tool writes |

`no-skill-3` declared the `MemberJoined(leafIndex, commitment, tokenId, newRoot)` event in
its client ABI and then never read it, calling `getCommitments()` in three places instead —
the only graded failure in the benchmark. Filed as `noir-tree-mirror-from-view-call`.

**The note split is real but narrower than first filed.** Writing the note to disk is 3/3
`with_skill` against 0/3 `no_skill` — but no `no_skill` run loses the member's witness.
Two derive the secret from a signature over a fixed message, `no-skill-3` writing the
tradeoff out: *"there is nothing to back up ... whoever holds the member's private key can
recompute every nullifier that member ever published."* `no-skill-2` prints a random secret
at registration ("SAVE IT", "store it like a seed phrase") and re-imports it via
`--secret` / `--passphrase`, deliberately not derived from the ETH key so the voting key can
rotate. All three find the leaf index by locating the commitment in the tree. That is a
key-management design difference, not a lost note, so `noir-note-not-persisted` is
**withdrawn** (0/3, kept only for the criterion it produced).

The eval finding it surfaced still stands: expect_7 conjoins event replay and note handling
and grades neither cleanly — it passed `no-skill-1` and `no-skill-2` on the event-replay
half without looking at note handling at all. The split expect has to grade
**recoverability** — persisted by the tool, handed to the member to keep, or
deterministically re-derivable, with the leaf index recoverable from the tree — not one
spelling of it. An expect demanding "writes nullifier+secret+leafIndex to disk" would fail
all three `no_skill` designs.

`with-skill-3` states the reasoning the skill supplies, in a code comment: *"The contract
never hands out a Merkle path -- asking it for one would tell the node you query which leaf
is yours."*

### quiz-002

- **Which hash first:** all six reached for Poseidon-family immediately. No run started
  from SHA256/keccak and corrected. The split is Poseidon2 (`no_skill` 3/3) vs the skill's
  `poseidon::poseidon::bn254` path (`with_skill` 2/3).
- **`nargo compile` attempted:** all six attempted it; the three `with_skill` runs reached
  a clean compile (one left `target/` behind). No run failed on the poseidon dependency.
- **Frontend-commitment comment matches the circuit:** yes in all six. Each run's comment
  names the exact field order and hash it commits to, matching the circuit body.
- **Turns spent on the poseidon pin: zero, all six runs.** In #73 this was a guaranteed
  wasted cycle.
- **`compiler_version` pinned:** `no-skill-1` and `with-skill-2` wrote
  `compiler_version = ">=1.0.0"`; the other four omitted the line. No run wrote a
  beta-string constraint, so claim #4 did not surface as a failure.

### Both — turns and wall-clock

| task | variant | turns (mean) | wall-clock (mean) | cost (mean) |
| --- | --- | --- | --- | --- |
| goal-001 | no_skill | 108 / 108 / 103 → **106.3** | 2142 / 2243 / 2065 → **2150s** | **$10.71** |
| goal-001 | with_skill | 80 / 93 / 113 → **95.3** | 1534 / 2307 / 2642 → **2161s** | **$7.90** |
| quiz-002 | no_skill | 41 / 21 / 39 → **33.7** | 701 / 205 / 482 → **463s** | **$1.59** |
| quiz-002 | with_skill | 21 / 19 / 22 → **20.7** | 262 / 187 / 390 → **280s** | **$0.83** |

This matches #73's shape: **with_skill is clearly faster on quiz-002** (280s/20.7 turns vs
463s/33.7; #73 saw 317s/19 vs 440s/27) **and a wash on goal-001** on wall-clock (2150s vs
2161s), though it takes ~10% fewer turns and ~26% less cost. If the skill helps anywhere on
time, it is the short task, and the compression did not take that away.

All 12 runs executed concurrently on one machine, so absolute seconds are inflated by
contention and should not be compared against #73's absolute numbers. Both variants ran
under identical load, so the within-benchmark comparison holds.

## Evidence integrity — two runs graded on partial evidence

The harness excludes `lib` as a generated directory, matched **by directory name at any
depth**. In two runs that silently dropped source the run authored:

- **`no-skill-1`**: `scripts/lib/{prover,identity,tree,hashes,registry,chain}.mjs` and
  `circuits/lib/src/lib.nr` — its entire client library, including the prover that expect_4
  grades. Graded 7/7.
- **`with-skill-2`**: `js/lib/{prove,note,poseidon,tree,chain}.mjs` — including the prover
  (expect_4) and the note module (expect_7). Graded 7/7.

(`with-skill-1` and `with-skill-2` also have a genuine vendored `lib/poseidon-solidity/`,
which is correctly excluded.)

I read all of the dropped files directly and they do support the verdicts the judge
reached — `no-skill-1`'s `prover.mjs` and `with-skill-2`'s `prove.mjs` both use
`UltraHonkBackend` with `verifierTarget: 'evm'`, and `note.mjs` persists the note. So the
two 7/7 verdicts are correct, but they rested on inference from calling code and NOTES.md
rather than the files themselves. It hit one run per variant, so it does not bias the
comparison. This did not happen in #73.

**The 256KB evidence cap also fired**, on one run per variant: `no-skill-2`'s
`HonkVerifier.sol` (346,913 bytes) and `with-skill-2`'s (324,910 bytes) were dropped from
`output/`. The other four generated verifiers (~104KB) came in under the cap. Both affected
runs still passed expect_3, graded from the deploy script — the same outcome #73 saw. Also
symmetric across variants.

## Comparability to #73

`with_skill` is directly comparable and clears the bar: 3/3 and 3/3, same tasks, same
expects, same judge model, same toolchain.

**The `no_skill` baseline is not strictly comparable to #73**, and it should be said
plainly. It improved on three independent axes at once:

- goal-001 pass rate 2/3, against #73's 1/3
- in-process proving 3/3, against #73's 1/3 (the bb-CLI shellout failure mode did not recur)
- the poseidon v0.3.0 pin chosen unprompted 3/3, where #73's runs re-pinned from v0.2.6

None of this is environment drift — drift never fired, every run held 5.1.0. It is the
model's own prior having moved. The consequence is that this benchmark has less power to
detect a compression cost than #73 did: with the baseline at 2/3 and 3/3, a modest
regression in the skill would not clearly show up in the pass column. The ungraded reads
(hash choice, note persistence, import path) are what carry the signal this round, and they
all favour the compressed skill.

n=3 is noisy and the baseline is the noisy half. A `no_skill` at 2/3 or 3/3 is base noise,
not evidence about the cut.

## Skill edits — all four applied in this PR

The four below are wrong lines in the benchmarked skill `840dde0`. All four are **inherited
from the pre-cut text rather than compression damage**, and all four are fixed in this
branch rather than filed against a skill this PR is introducing. None of them changed a run:
scored against the 12 runs, each is latent.

**1. `{ keccak: true }` is deprecated and means `evm-no-zk` — not `evm`.** The skill's
main code block was:

```typescript
const proof = await backend.generateProof(witness, { keccak: true });
```

and its prose offered `{ keccak: true }` and `{ verifierTarget: "evm" }` as equivalents.
Per bb.js 5.1.0's own type declarations:

```
/** @deprecated Use verifierTarget: 'evm-no-zk' instead */  keccak?: boolean;
/** @deprecated Use verifierTarget: 'evm' instead */        keccakZK?: boolean;
```

They are different targets. A verifier generated with `--verifier_target evm` (ZK) rejects
a proof made with `{ keccak: true }` (no-ZK). The skill elsewhere says to keep prove, verify
and VK on the same setting, which papers over it, but the example itself pairs a deprecated
no-ZK flag with a ZK verifier.

Inherited — the pre-cut skill said the same at lines 506–507 and 530. Latent, not observed:
**0/6 goal-001 runs copied the example.** All six wrote `verifierTarget: 'evm'`, and
`with-skill-2` contradicted the skill in prose (`output/NOTES.md:252`: *"the deprecated
`{ keccak: true }` (which means `evm-no-zk`) … produce proofs this verifier rejects"*).
expect_4 accepts either, so it was never graded. **Applied:** the example is now
`{ verifierTarget: "evm" }`, and the prose states the `evm` / `evm-no-zk` split instead of
offering the two flags as equivalents.

**2. The Solidity floor is stale, and the cut dropped the actionable remedy.** The minimal
skill said the verifier needs `pragma solidity >=0.8.21`; the real floor is now `>=0.8.27`.
The pre-cut skill carried the concrete fix (`solc_version = '0.8.27'` in `foundry.toml`),
which the compression dropped while keeping the stale number.

`tasks/noir-goal-001.yaml`'s notes already flagged the floor before the rewrite, so the
compression had the correction in hand, carried the stale number forward and dropped the
remedy. This cost nothing observable — all six runs picked solc 0.8.27 or 0.8.28 and cancun
on their own, confirming the "loud failure mode, runs self-correct" rationale for leaving
claim #6 ungraded. **Applied:** `>=0.8.27`, with the `solc_version = '0.8.27'` /
`evm_version = 'cancun'` foundry.toml remedy restored.

**3. The version-matching rule lost its one command.** The pre-cut skill had
`npm install @noir-lang/noir_js "@aztec/bb.js@$(bb --version)"`; the minimal version kept
the rule as prose only. With 5.2.0 live against this machine's 5.1.0 CLI, that command is
the cheapest possible nudge, and drift is the failure mode this benchmark was watching for.
It did not fire — all six runs pinned 5.1.0 deliberately — but they had to reason their way
there. **Applied:** the command is back, under the same prose.

**4. `--oracle_hash keccak` no longer exists.** The skill told the reader to generate the VK
with `--oracle_hash keccak` (or `--verifier_target evm`) — the same false equivalence as #1,
one layer down. `bb` 5.1.0 has no `--oracle_hash` flag on `prove`, `verify`, `write_vk` or
`write_solidity_verifier`; it has `--verifier_target`, where `evm` is keccak + ZK and
`evm-no-zk` is the other one. Also inherited, also latent: every run that generated a
verifier used `--verifier_target evm`, so no run followed the stale flag. **Applied:**
`--verifier_target evm` only, with the removal noted.

Nothing else in the 12 runs points at a gap in the compressed text.

## Final table

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | goal-001 `3/3 with_skill vs 2/3 no_skill`; quiz-002 `3/3 vs 3/3`. `with_skill` matches #73's bar exactly; the baseline rose enough that the aggregate barely separates them. Per-check and ungraded reads separate them clearly. |
| Did it reduce time/tokens? | Yes on quiz-002: 280s/20.7 turns vs 463s/33.7, and $0.83 vs $1.59. A wash on goal-001 wall-clock (2161s vs 2150s), but ~10% fewer turns and ~26% lower cost. Same shape as #73. |
| Did it create negative deltas? | None observed. No `with_skill` run failed a check, took a wrong hash, or lost a note. |
| What mistakes repeated without the skill? | `noir-bit-oriented-hash-in-circuit` (2/3), `noir-tree-mirror-from-view-call` (1/3). `noir-note-not-persisted` was filed at 3/3 and **withdrawn on re-read** — none of the three loses the note |
| What mistakes remained with the skill? | None. Both standing records are 0/3 in `with_skill`. |
| What should change in the skill? | Four inherited wrong lines, **all applied in this PR**: `{ keccak: true }` → `{ verifierTarget: "evm" }`; `--oracle_hash keccak` → `--verifier_target evm` (the flag is gone from bb 5.x); Solidity floor `>=0.8.21` → `>=0.8.27` with the `solc_version` remedy restored; the `@aztec/bb.js@$(bb --version)` install command restored. None of the four changed a run. Nothing else. |
| What should change in the eval? | **Split expect_7** — it conjoins event replay and note handling and grades neither cleanly; the new half must grade **recoverability** (persisted, handed to the member, or deterministically re-derivable, leaf index recoverable), not "writes a note file", which would fail all three sound `no_skill` designs. **Add an expect for in-circuit hash choice on goal-001** — the sharpest variant split in the benchmark is ungraded, and a run shipping hand-rolled SHA-256 scored 7/7. **Narrow the harness's `lib` exclusion to the workspace root** so `js/lib/` and `scripts/lib/` reach the judge. **Retire quiz-002 expect_1 or rewrite it to check the import path** — it passed Poseidon2 3/3 in `no_skill` for the second benchmark running. Consider retiring noir-quiz-001 and noir-quiz-003 outright. |

## Verdict

**Keep `skills/noir` as a minimal skill.** On graded numbers alone (goal-001 3/3 vs 2/3,
quiz-002 3/3 vs 3/3) this reads as dead weight; the evidence says otherwise — −26% cost on
goal-001, −48% on quiz-002, in-circuit hash choice 3/3 vs 1/3, the poseidon import path 3/3
vs 0/6, and no negative delta anywhere in 12 runs. The 81% cut cost nothing this benchmark
can see. Step 4 → 5 closes for noir with that, not with the table.

The caveat worth carrying into issue #1: this is the second benchmark where **the pass
column has run out of resolution** (after tools, #68). The baseline now passes most of what
the skill is for, and everything that still separates the variants is ungraded.

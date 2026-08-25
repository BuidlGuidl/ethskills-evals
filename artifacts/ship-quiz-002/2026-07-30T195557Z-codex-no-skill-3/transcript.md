Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb499-0f56-7c50-99df-c7830678a69a
--------
user
We're building a directory for our city's live music scene. Bands get a
profile — photo, bio, links — and fans follow them. There's a feed of upcoming
gigs, fans rate gigs they went to out of 5, and the home screen ranks the
best-rated bands this month. Fans can also buy a "supporter badge" for a band:
it costs 0.01 ETH, goes straight to the band, and stays as proof they backed
that band early.

Two things will decide how we build this, so I need them answered before we
start: what does the app have to load when a fan opens the home screen, and
what does it cost us to change the leaderboard formula — we'll be tweaking
that most weeks until it feels fair.

Write your answer to plan.md in this directory: the architecture, plus the
answer to both questions.
codex
I’m using the codebase-design guidance to separate immutable backing from fast, tweakable discovery logic.
exec
/bin/bash -lc "sed -n '1,240p' /home/matt/.agents/skills/codebase-design/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace
 succeeded in 0ms:
---
name: codebase-design
description: Shared vocabulary for designing deep modules. Use when the user wants to design or improve a module's interface, find deepening opportunities, decide where a seam goes, make code more testable or AI-navigable, or when another skill needs the deep-module vocabulary.
---

# Codebase Design

Design **deep modules**: a lot of behaviour behind a small interface, placed at a clean seam, testable through that interface. Use this language and these principles wherever code is being designed or restructured. The aim is leverage for callers, locality for maintainers, and testability for everyone.

## Glossary

Use these terms exactly — don't substitute "component," "service," "API," or "boundary." Consistent language is the whole point.

**Module** — anything with an interface and an implementation. Deliberately scale-agnostic: a function, class, package, or tier-spanning slice. _Avoid_: unit, component, service.

**Interface** — everything a caller must know to use the module correctly: the type signature, but also invariants, ordering constraints, error modes, required configuration, and performance characteristics. _Avoid_: API, signature (too narrow — they refer only to the type-level surface).

**Implementation** — what's inside a module, its body of code. Distinct from **Adapter**: a thing can be a small adapter with a large implementation (a Postgres repo) or a large adapter with a small implementation (an in-memory fake). Reach for "adapter" when the seam is the topic; "implementation" otherwise.

**Depth** — leverage at the interface: the amount of behaviour a caller (or test) can exercise per unit of interface they have to learn. A module is **deep** when a large amount of behaviour sits behind a small interface, **shallow** when the interface is nearly as complex as the implementation.

**Seam** _(Michael Feathers)_ — a place where you can alter behaviour without editing in that place; the *location* at which a module's interface lives. Where to put the seam is its own design decision, distinct from what goes behind it. _Avoid_: boundary (overloaded with DDD's bounded context).

**Adapter** — a concrete thing that satisfies an interface at a seam. Describes *role* (what slot it fills), not substance (what's inside).

**Leverage** — what callers get from depth: more capability per unit of interface they learn. One implementation pays back across N call sites and M tests.

**Locality** — what maintainers get from depth: change, bugs, knowledge, and verification concentrate in one place rather than spreading across callers. Fix once, fixed everywhere.

## Deep vs shallow

**Deep module** = small interface + lots of implementation:

```
┌─────────────────────┐
│   Small Interface   │  ← Few methods, simple params
├─────────────────────┤
│                     │
│  Deep Implementation│  ← Complex logic hidden
│                     │
└─────────────────────┘
```

**Shallow module** = large interface + little implementation (avoid):

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Just passes through
└─────────────────────────────────┘
```

When designing an interface, ask:

- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more complexity inside?

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small, mockable, swappable parts — they just aren't part of the interface. A module can have **internal seams** (private to its implementation, used by its own tests) as well as the **external seam** at its interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. If you want to test *past* the interface, the module is probably the wrong shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a seam unless something actually varies across it.

## Designing for testability

Good interfaces make testing natural:

1. **Accept dependencies, don't create them.**

   ```typescript
   // Testable
   function processOrder(order, paymentGateway) {}

   // Hard to test
   function processOrder(order) {
     const gateway = new StripeGateway();
   }
   ```

2. **Return results, don't produce side effects.**

   ```typescript
   // Testable
   function calculateDiscount(cart): Discount {}

   // Hard to test
   function applyDiscount(cart): void {
     cart.total -= discount;
   }
   ```

3. **Small surface area.** Fewer methods = fewer tests needed. Fewer params = simpler test setup.

## Relationships

- A **Module** has exactly one **Interface** (the surface it presents to callers and tests).
- **Depth** is a property of a **Module**, measured against its **Interface**.
- A **Seam** is where a **Module**'s **Interface** lives.
- An **Adapter** sits at a **Seam** and satisfies the **Interface**.
- **Depth** produces **Leverage** for callers and **Locality** for maintainers.

## Rejected framings

- **Depth as ratio of implementation-lines to interface-lines** (Ousterhout): rewards padding the implementation. We use depth-as-leverage instead.
- **"Interface" as the TypeScript `interface` keyword or a class's public methods**: too narrow — interface here includes every fact a caller must know.
- **"Boundary"**: overloaded with DDD's bounded context. Say **seam** or **interface**.

## Going deeper

- **Deepening a cluster given its dependencies** — see [DEEPENING.md](DEEPENING.md): dependency categories, seam discipline, and replace-don't-layer testing.
- **Exploring alternative interfaces** — see [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md): spin up parallel sub-agents to design the interface several radically different ways, then compare on depth, locality, and seam placement.

exec
/bin/bash -lc "rg --files -g '"'!node_modules'"' -g '"'!*.lock'"' | sed -n '1,160p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace
 succeeded in 0ms:
TASK.md

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md
diff --git a/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..462d85eb73cf9fbffea077a3a26a3b9e78f02547
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,43 @@
+# Music directory architecture
+
+Use a conventional web app for the directory and discovery data, and use Ethereum only for the purchase that needs durable public proof.
+
+```
+web/mobile client
+       |
+app backend ── Postgres (bands, fans, follows, gigs, ratings, rank inputs)
+       |                 |
+       |                 └─ ranking worker + cached leaderboard view
+       |
+       └─ Ethereum RPC / indexer ── SupporterBadge contract
+                                      └─ payment: 0.01 ETH to band wallet
+```
+
+## Responsibilities
+
+- **Postgres and backend:** band profile photo/bio/links, accounts, follows, gig listings, attendance/rating eligibility, ratings, moderation, and the leaderboard. Store images in object storage/CDN, with their URLs in the database.
+- **Ranking module:** a deep module with a small interface such as `getMonthlyLeaderboard(city, formulaVersion)` and `rebuildMonthlyLeaderboard(city, formulaVersion)`. Its implementation owns aggregation, minimum-rating thresholds, anti-spam rules, tie-breaking, formula versions, and cache refreshes. Home-screen callers never implement scoring themselves.
+- **Chain:** a small `SupporterBadge` contract. `buyBadge(bandId)` requires exactly `0.01 ETH`, forwards it atomically to the registered band payout wallet, and mints a non-transferable badge/receipt (for example, ERC-1155 keyed by band). Emit an event containing the band ID, buyer, and purchase time. The event is independently indexable proof of early support.
+- **Indexer/webhook:** records confirmed badge purchases in the app database so profiles can display them quickly. The chain remains the source of truth for the badge; the database is a read model and can be rebuilt from events.
+
+Keep a band ID to payout-wallet mapping in the contract and change it only through an authenticated band-owner/admin flow. Use pull payments instead of a direct transfer if payout wallets may reject ETH; credit the band balance during purchase and let its wallet withdraw. This preserves the "goes straight to the band" economic result while preventing one bad receiver from blocking sales.
+
+Gig ratings should remain off-chain. Require a signed-in fan and, where possible, a ticket/check-in/venue-attendance signal; rate-limit, allow one rating per fan per gig, and moderate abuse. Public on-chain ratings would be costly, slow to query, and easy to game at the application layer anyway.
+
+## What the home screen loads
+
+It loads a single backend-provided home feed/read model, not the blockchain and not every gig, rating, or band record.
+
+For an unauthenticated visitor, return the city and month, the ranked bands (e.g. top 20), each band's display-card fields (name, image URL, genre/location), displayed score/count, and a bounded set of upcoming gigs needed for the cards/feed. The client then fetches images from the CDN.
+
+For a signed-in fan, the same response may also include their follow state for those bands and upcoming gigs from bands they follow. Do this in the backend with a join; do not issue one request per band. Cursor-paginate any additional gigs.
+
+The backend reads a precomputed/cached monthly leaderboard view, refreshed on rating writes and/or a short schedule. It may read the canonical ratings table during rebuilds, but the normal home-screen request should be one indexed database query plus cached media URLs. It should **not** query Ethereum RPC, scan badge events, calculate monthly averages in the browser, load all ratings, or load all band profiles. Badge ownership is only needed when showing the viewer's badge state or a band-profile proof, and can be fetched lazily from the indexed read model.
+
+## Cost of changing the leaderboard formula
+
+If the formula stays in the off-chain ranking module, changing it costs **no Ethereum gas and no on-chain migration**. It is an application/config deployment followed by recomputing the leaderboard cache from existing ratings. Operational cost is database/worker time (and normal hosting), proportional to the rating history and cities rebuilt; for a city directory this is typically inexpensive and can run asynchronously.
+
+Version formulas (for example `monthly-v3`) and record the version and calculation timestamp with each leaderboard result. That makes a weekly adjustment reproducible, enables rollback, and avoids silently mixing scores calculated by different rules.
+
+Putting the ranking formula on-chain would be the wrong trade: every rating/update or aggregation would consume gas, formula changes would require a contract upgrade/redeployment and migration/governance work, and the home screen would still need an indexer to be fast. Reserve Ethereum for the payment receipt, where its permanence is valuable; keep editorial/discovery policy off-chain, where it is cheap to revise.

diff --git a/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..462d85eb73cf9fbffea077a3a26a3b9e78f02547
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,43 @@
+# Music directory architecture
+
+Use a conventional web app for the directory and discovery data, and use Ethereum only for the purchase that needs durable public proof.
+
+```
+web/mobile client
+       |
+app backend ── Postgres (bands, fans, follows, gigs, ratings, rank inputs)
+       |                 |
+       |                 └─ ranking worker + cached leaderboard view
+       |
+       └─ Ethereum RPC / indexer ── SupporterBadge contract
+                                      └─ payment: 0.01 ETH to band wallet
+```
+
+## Responsibilities
+
+- **Postgres and backend:** band profile photo/bio/links, accounts, follows, gig listings, attendance/rating eligibility, ratings, moderation, and the leaderboard. Store images in object storage/CDN, with their URLs in the database.
+- **Ranking module:** a deep module with a small interface such as `getMonthlyLeaderboard(city, formulaVersion)` and `rebuildMonthlyLeaderboard(city, formulaVersion)`. Its implementation owns aggregation, minimum-rating thresholds, anti-spam rules, tie-breaking, formula versions, and cache refreshes. Home-screen callers never implement scoring themselves.
+- **Chain:** a small `SupporterBadge` contract. `buyBadge(bandId)` requires exactly `0.01 ETH`, forwards it atomically to the registered band payout wallet, and mints a non-transferable badge/receipt (for example, ERC-1155 keyed by band). Emit an event containing the band ID, buyer, and purchase time. The event is independently indexable proof of early support.
+- **Indexer/webhook:** records confirmed badge purchases in the app database so profiles can display them quickly. The chain remains the source of truth for the badge; the database is a read model and can be rebuilt from events.
+
+Keep a band ID to payout-wallet mapping in the contract and change it only through an authenticated band-owner/admin flow. Use pull payments instead of a direct transfer if payout wallets may reject ETH; credit the band balance during purchase and let its wallet withdraw. This preserves the "goes straight to the band" economic result while preventing one bad receiver from blocking sales.
+
+Gig ratings should remain off-chain. Require a signed-in fan and, where possible, a ticket/check-in/venue-attendance signal; rate-limit, allow one rating per fan per gig, and moderate abuse. Public on-chain ratings would be costly, slow to query, and easy to game at the application layer anyway.
+
+## What the home screen loads
+
+It loads a single backend-provided home feed/read model, not the blockchain and not every gig, rating, or band record.
+
+For an unauthenticated visitor, return the city and month, the ranked bands (e.g. top 20), each band's display-card fields (name, image URL, genre/location), displayed score/count, and a bounded set of upcoming gigs needed for the cards/feed. The client then fetches images from the CDN.
+
+For a signed-in fan, the same response may also include their follow state for those bands and upcoming gigs from bands they follow. Do this in the backend with a join; do not issue one request per band. Cursor-paginate any additional gigs.
+
+The backend reads a precomputed/cached monthly leaderboard view, refreshed on rating writes and/or a short schedule. It may read the canonical ratings table during rebuilds, but the normal home-screen request should be one indexed database query plus cached media URLs. It should **not** query Ethereum RPC, scan badge events, calculate monthly averages in the browser, load all ratings, or load all band profiles. Badge ownership is only needed when showing the viewer's badge state or a band-profile proof, and can be fetched lazily from the indexed read model.
+
+## Cost of changing the leaderboard formula
+
+If the formula stays in the off-chain ranking module, changing it costs **no Ethereum gas and no on-chain migration**. It is an application/config deployment followed by recomputing the leaderboard cache from existing ratings. Operational cost is database/worker time (and normal hosting), proportional to the rating history and cities rebuilt; for a city directory this is typically inexpensive and can run asynchronously.
+
+Version formulas (for example `monthly-v3`) and record the version and calculation timestamp with each leaderboard result. That makes a weekly adjustment reproducible, enables rollback, and avoids silently mixing scores calculated by different rules.
+
+Putting the ranking formula on-chain would be the wrong trade: every rating/update or aggregation would consume gas, formula changes would require a contract upgrade/redeployment and migration/governance work, and the home screen would still need an indexer to be fast. Reserve Ethereum for the payment receipt, where its permanence is valuable; keep editorial/discovery policy off-chain, where it is cheap to revise.

exec
/bin/bash -lc "sed -n '1,260p' plan.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace
 succeeded in 0ms:
# Music directory architecture

Use a conventional web app for the directory and discovery data, and use Ethereum only for the purchase that needs durable public proof.

```
web/mobile client
       |
app backend ── Postgres (bands, fans, follows, gigs, ratings, rank inputs)
       |                 |
       |                 └─ ranking worker + cached leaderboard view
       |
       └─ Ethereum RPC / indexer ── SupporterBadge contract
                                      └─ payment: 0.01 ETH to band wallet
```

## Responsibilities

- **Postgres and backend:** band profile photo/bio/links, accounts, follows, gig listings, attendance/rating eligibility, ratings, moderation, and the leaderboard. Store images in object storage/CDN, with their URLs in the database.
- **Ranking module:** a deep module with a small interface such as `getMonthlyLeaderboard(city, formulaVersion)` and `rebuildMonthlyLeaderboard(city, formulaVersion)`. Its implementation owns aggregation, minimum-rating thresholds, anti-spam rules, tie-breaking, formula versions, and cache refreshes. Home-screen callers never implement scoring themselves.
- **Chain:** a small `SupporterBadge` contract. `buyBadge(bandId)` requires exactly `0.01 ETH`, forwards it atomically to the registered band payout wallet, and mints a non-transferable badge/receipt (for example, ERC-1155 keyed by band). Emit an event containing the band ID, buyer, and purchase time. The event is independently indexable proof of early support.
- **Indexer/webhook:** records confirmed badge purchases in the app database so profiles can display them quickly. The chain remains the source of truth for the badge; the database is a read model and can be rebuilt from events.

Keep a band ID to payout-wallet mapping in the contract and change it only through an authenticated band-owner/admin flow. Use pull payments instead of a direct transfer if payout wallets may reject ETH; credit the band balance during purchase and let its wallet withdraw. This preserves the "goes straight to the band" economic result while preventing one bad receiver from blocking sales.

Gig ratings should remain off-chain. Require a signed-in fan and, where possible, a ticket/check-in/venue-attendance signal; rate-limit, allow one rating per fan per gig, and moderate abuse. Public on-chain ratings would be costly, slow to query, and easy to game at the application layer anyway.

## What the home screen loads

It loads a single backend-provided home feed/read model, not the blockchain and not every gig, rating, or band record.

For an unauthenticated visitor, return the city and month, the ranked bands (e.g. top 20), each band's display-card fields (name, image URL, genre/location), displayed score/count, and a bounded set of upcoming gigs needed for the cards/feed. The client then fetches images from the CDN.

For a signed-in fan, the same response may also include their follow state for those bands and upcoming gigs from bands they follow. Do this in the backend with a join; do not issue one request per band. Cursor-paginate any additional gigs.

The backend reads a precomputed/cached monthly leaderboard view, refreshed on rating writes and/or a short schedule. It may read the canonical ratings table during rebuilds, but the normal home-screen request should be one indexed database query plus cached media URLs. It should **not** query Ethereum RPC, scan badge events, calculate monthly averages in the browser, load all ratings, or load all band profiles. Badge ownership is only needed when showing the viewer's badge state or a band-profile proof, and can be fetched lazily from the indexed read model.

## Cost of changing the leaderboard formula

If the formula stays in the off-chain ranking module, changing it costs **no Ethereum gas and no on-chain migration**. It is an application/config deployment followed by recomputing the leaderboard cache from existing ratings. Operational cost is database/worker time (and normal hosting), proportional to the rating history and cities rebuilt; for a city directory this is typically inexpensive and can run asynchronously.

Version formulas (for example `monthly-v3`) and record the version and calculation timestamp with each leaderboard result. That makes a weekly adjustment reproducible, enables rollback, and avoids silently mixing scores calculated by different rules.

Putting the ranking formula on-chain would be the wrong trade: every rating/update or aggregation would consume gas, formula changes would require a contract upgrade/redeployment and migration/governance work, and the home screen would still need an indexer to be fast. Reserve Ethereum for the payment receipt, where its permanence is valuable; keep editorial/discovery policy off-chain, where it is cheap to revise.

diff --git a/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..462d85eb73cf9fbffea077a3a26a3b9e78f02547
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,43 @@
+# Music directory architecture
+
+Use a conventional web app for the directory and discovery data, and use Ethereum only for the purchase that needs durable public proof.
+
+```
+web/mobile client
+       |
+app backend ── Postgres (bands, fans, follows, gigs, ratings, rank inputs)
+       |                 |
+       |                 └─ ranking worker + cached leaderboard view
+       |
+       └─ Ethereum RPC / indexer ── SupporterBadge contract
+                                      └─ payment: 0.01 ETH to band wallet
+```
+
+## Responsibilities
+
+- **Postgres and backend:** band profile photo/bio/links, accounts, follows, gig listings, attendance/rating eligibility, ratings, moderation, and the leaderboard. Store images in object storage/CDN, with their URLs in the database.
+- **Ranking module:** a deep module with a small interface such as `getMonthlyLeaderboard(city, formulaVersion)` and `rebuildMonthlyLeaderboard(city, formulaVersion)`. Its implementation owns aggregation, minimum-rating thresholds, anti-spam rules, tie-breaking, formula versions, and cache refreshes. Home-screen callers never implement scoring themselves.
+- **Chain:** a small `SupporterBadge` contract. `buyBadge(bandId)` requires exactly `0.01 ETH`, forwards it atomically to the registered band payout wallet, and mints a non-transferable badge/receipt (for example, ERC-1155 keyed by band). Emit an event containing the band ID, buyer, and purchase time. The event is independently indexable proof of early support.
+- **Indexer/webhook:** records confirmed badge purchases in the app database so profiles can display them quickly. The chain remains the source of truth for the badge; the database is a read model and can be rebuilt from events.
+
+Keep a band ID to payout-wallet mapping in the contract and change it only through an authenticated band-owner/admin flow. Use pull payments instead of a direct transfer if payout wallets may reject ETH; credit the band balance during purchase and let its wallet withdraw. This preserves the "goes straight to the band" economic result while preventing one bad receiver from blocking sales.
+
+Gig ratings should remain off-chain. Require a signed-in fan and, where possible, a ticket/check-in/venue-attendance signal; rate-limit, allow one rating per fan per gig, and moderate abuse. Public on-chain ratings would be costly, slow to query, and easy to game at the application layer anyway.
+
+## What the home screen loads
+
+It loads a single backend-provided home feed/read model, not the blockchain and not every gig, rating, or band record.
+
+For an unauthenticated visitor, return the city and month, the ranked bands (e.g. top 20), each band's display-card fields (name, image URL, genre/location), displayed score/count, and a bounded set of upcoming gigs needed for the cards/feed. The client then fetches images from the CDN.
+
+For a signed-in fan, the same response may also include their follow state for those bands and upcoming gigs from bands they follow. Do this in the backend with a join; do not issue one request per band. Cursor-paginate any additional gigs.
+
+The backend reads a precomputed/cached monthly leaderboard view, refreshed on rating writes and/or a short schedule. It may read the canonical ratings table during rebuilds, but the normal home-screen request should be one indexed database query plus cached media URLs. It should **not** query Ethereum RPC, scan badge events, calculate monthly averages in the browser, load all ratings, or load all band profiles. Badge ownership is only needed when showing the viewer's badge state or a band-profile proof, and can be fetched lazily from the indexed read model.
+
+## Cost of changing the leaderboard formula
+
+If the formula stays in the off-chain ranking module, changing it costs **no Ethereum gas and no on-chain migration**. It is an application/config deployment followed by recomputing the leaderboard cache from existing ratings. Operational cost is database/worker time (and normal hosting), proportional to the rating history and cities rebuilt; for a city directory this is typically inexpensive and can run asynchronously.
+
+Version formulas (for example `monthly-v3`) and record the version and calculation timestamp with each leaderboard result. That makes a weekly adjustment reproducible, enables rollback, and avoids silently mixing scores calculated by different rules.
+
+Putting the ranking formula on-chain would be the wrong trade: every rating/update or aggregation would consume gas, formula changes would require a contract upgrade/redeployment and migration/governance work, and the home screen would still need an indexer to be fast. Reserve Ethereum for the payment receipt, where its permanence is valuable; keep editorial/discovery policy off-chain, where it is cheap to revise.

codex
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md).

Core answer: home loads a cached backend leaderboard/read model—not chain data; leaderboard changes cost no gas if kept off-chain, only normal deploy + recomputation.
diff --git a/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..462d85eb73cf9fbffea077a3a26a3b9e78f02547
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,43 @@
+# Music directory architecture
+
+Use a conventional web app for the directory and discovery data, and use Ethereum only for the purchase that needs durable public proof.
+
+```
+web/mobile client
+       |
+app backend ── Postgres (bands, fans, follows, gigs, ratings, rank inputs)
+       |                 |
+       |                 └─ ranking worker + cached leaderboard view
+       |
+       └─ Ethereum RPC / indexer ── SupporterBadge contract
+                                      └─ payment: 0.01 ETH to band wallet
+```
+
+## Responsibilities
+
+- **Postgres and backend:** band profile photo/bio/links, accounts, follows, gig listings, attendance/rating eligibility, ratings, moderation, and the leaderboard. Store images in object storage/CDN, with their URLs in the database.
+- **Ranking module:** a deep module with a small interface such as `getMonthlyLeaderboard(city, formulaVersion)` and `rebuildMonthlyLeaderboard(city, formulaVersion)`. Its implementation owns aggregation, minimum-rating thresholds, anti-spam rules, tie-breaking, formula versions, and cache refreshes. Home-screen callers never implement scoring themselves.
+- **Chain:** a small `SupporterBadge` contract. `buyBadge(bandId)` requires exactly `0.01 ETH`, forwards it atomically to the registered band payout wallet, and mints a non-transferable badge/receipt (for example, ERC-1155 keyed by band). Emit an event containing the band ID, buyer, and purchase time. The event is independently indexable proof of early support.
+- **Indexer/webhook:** records confirmed badge purchases in the app database so profiles can display them quickly. The chain remains the source of truth for the badge; the database is a read model and can be rebuilt from events.
+
+Keep a band ID to payout-wallet mapping in the contract and change it only through an authenticated band-owner/admin flow. Use pull payments instead of a direct transfer if payout wallets may reject ETH; credit the band balance during purchase and let its wallet withdraw. This preserves the "goes straight to the band" economic result while preventing one bad receiver from blocking sales.
+
+Gig ratings should remain off-chain. Require a signed-in fan and, where possible, a ticket/check-in/venue-attendance signal; rate-limit, allow one rating per fan per gig, and moderate abuse. Public on-chain ratings would be costly, slow to query, and easy to game at the application layer anyway.
+
+## What the home screen loads
+
+It loads a single backend-provided home feed/read model, not the blockchain and not every gig, rating, or band record.
+
+For an unauthenticated visitor, return the city and month, the ranked bands (e.g. top 20), each band's display-card fields (name, image URL, genre/location), displayed score/count, and a bounded set of upcoming gigs needed for the cards/feed. The client then fetches images from the CDN.
+
+For a signed-in fan, the same response may also include their follow state for those bands and upcoming gigs from bands they follow. Do this in the backend with a join; do not issue one request per band. Cursor-paginate any additional gigs.
+
+The backend reads a precomputed/cached monthly leaderboard view, refreshed on rating writes and/or a short schedule. It may read the canonical ratings table during rebuilds, but the normal home-screen request should be one indexed database query plus cached media URLs. It should **not** query Ethereum RPC, scan badge events, calculate monthly averages in the browser, load all ratings, or load all band profiles. Badge ownership is only needed when showing the viewer's badge state or a band-profile proof, and can be fetched lazily from the indexed read model.
+
+## Cost of changing the leaderboard formula
+
+If the formula stays in the off-chain ranking module, changing it costs **no Ethereum gas and no on-chain migration**. It is an application/config deployment followed by recomputing the leaderboard cache from existing ratings. Operational cost is database/worker time (and normal hosting), proportional to the rating history and cities rebuilt; for a city directory this is typically inexpensive and can run asynchronously.
+
+Version formulas (for example `monthly-v3`) and record the version and calculation timestamp with each leaderboard result. That makes a weekly adjustment reproducible, enables rollback, and avoids silently mixing scores calculated by different rules.
+
+Putting the ranking formula on-chain would be the wrong trade: every rating/update or aggregation would consume gas, formula changes would require a contract upgrade/redeployment and migration/governance work, and the home screen would still need an indexer to be fast. Reserve Ethereum for the payment receipt, where its permanence is valuable; keep editorial/discovery policy off-chain, where it is cheap to revise.

tokens used
15,050
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195557Z-codex-no-skill-3/workspace/plan.md).

Core answer: home loads a cached backend leaderboard/read model—not chain data; leaderboard changes cost no gas if kept off-chain, only normal deploy + recomputation.

# 5 ETH meetup giveaway — draw procedure

## The design in one paragraph

An onchain **commit–reveal raffle**, deployed fresh each month. The entropy is a
single 32-byte secret whose **hash is committed onchain in the constructor —
before a single entrant exists** — and which is revealed on stage after entries
close. The winner is `entrants[uint256(keccak256(secret)) % entrants.length]`,
and the 5 ETH is transferred **in the same transaction as the reveal**. Every
step is a plain ETH transaction; the only costs are gas. No LINK, no oracle
account, no paid service.

Why not the alternatives (each fails a stated requirement):

- **Chainlink VRF** — needs a subscription account funded with LINK. That is a
  paid third-party provider, explicitly excluded by the treasury constraint.
- **Raw blockhash draw** ("take the hash of block N after close") — the
  producer of block N (a validator or builder) can grind it, and a skeptical
  loser can't distinguish our influence from a validator's. It hands the
  "nobody can influence" property to strangers.
- **Entrant-collected entropy** (everyone commits a salt, all reveal after
  close) — the last revealer can always bias by withholding, it requires every
  attendee to send two transactions on time, and losing entrants have zero
  incentive to do the second one. Worse for a room full of people, not better.

## What the contract is (one deployment per month)

- **Immutable, non-upgradeable, no admin keys.** No function that can change
  the entrant list, the funds, or the winner. After deployment, nobody —
  including us — can move the 5 ETH except by the draw rules below.
- **Constructor arguments:** entry close time (Friday 20:00:00 UTC), reveal
  deadline (Friday 21:00:00 UTC), and `keccak256(secret)` — so the entropy is
  bound onchain **before anyone can enter**.
- **Funded with exactly 5 ETH at deployment.** The treasury multisig signs the
  deployment; the prize is escrowed in the contract from then on.
- `enter()` — appends the caller's address to a public, append-only list.
  Reverts if the address is already in the list, or at/after close. Entering is
  free apart from gas; nothing is paid in.
- `reveal(secret)` — callable by **anyone** (not just us), only between close
  and the 21:00 deadline. Reverts unless `keccak256(secret)` equals the
  committed hash. On success it computes the winner and transfers the full
  5 ETH **in the same transaction** — atomic; there is no gap between "winner
  known" and "winner paid."
- `emergencyDraw()` — callable by **anyone**, only after 21:00, only if no
  reveal succeeded. Seeds with `keccak256(blockhash of the block immediately
  before the call)` — a hash nobody could know at close and that no single
  party can choose (any attendee can fire the transaction first). Pays the
  5 ETH the same way.
- If zero entrants, the draw functions revert and the treasury can reclaim the
  5 ETH after Saturday 20:00 — the **only** non-winner exit for the funds.

Selection formula:

```
winner = entrants[uint256(keccak256(secret)) % entrants.length]
```

Modulo bias for N entrants is bounded by N/2^256 (≈10⁻⁷⁴ for a full room) — no
statistically credible claim of rigging can come from it.

## The exact sequence

| # | Step | Who sends it | Window (UTC, Friday) | What it does |
|---|------|--------------|----------------------|--------------|
| 0 | Deploy + fund, commit hash in constructor | Treasury multisig | During entry week, well before close | Binds the entropy onchain; escrows the 5 ETH |
| 1 | `enter()` | Each attendee, from their own wallet | Week before, until 20:00:00 | Appends their address to the entrant list |
| 2 | `reveal(secret)` | **Us, on stage** — or anyone holding the secret | 20:00:00 → 20:59:59 (planned ~20:15) | Verifies secret against commit, picks winner, sends 5 ETH to the winner's wallet |
| 3 | `emergencyDraw()` — only if 2 never happened | **Anyone** in the room | After 21:00, never expires | Seeds from a live blockhash, pays the 5 ETH |

At 20:00:00 the entrant list freezes — public and final, in entry order.

### The night, minute by minute

- **19:55** — project the block explorer. Door checklist: everyone who entered
  confirms their address is visible on the onchain list. The list is the only
  source of truth; there is no paper signup.
- **20:00** — close. `enter()` starts reverting.
- **~20:10** — on stage: open the sealed envelope, show the secret on the
  projector, send `reveal(secret)`. The transaction visibly shows three things:
  `keccak256(secret)` equals the committed hash, the winner's address, and the
  5 ETH transfer.
- **~20:11** — the winner shows the balance landing on their phone. Done.

Anyone in the room can recompute the winner from three public facts: the
committed hash (in the contract), the revealed secret (on screen / in the
transaction), and the entrant list (onchain).

## What must be in place beforehand

1. **Contract reviewed and rehearsed.** Written simply, read by at least one
   person who isn't the author, and the whole flow — including the fallback —
   dry-run on a testnet earlier in the week (e.g., Wednesday).
2. **The 5 ETH** ready in the treasury multisig; the deployment transaction is
   funded with exactly that.
3. **The secret**: 32 fresh random bytes from a decent entropy source (OS
   CSPRNG or dice). Generated new for this month, never reused, never typed
   into anything networked until the reveal. Verify on the explorer after
   deployment that `keccak256(secret)` equals the constructor's commit hash.
4. **The secret physically staged**: written on a card in a sealed envelope,
   plus a second sealed copy with a designated volunteer. `reveal()` is
   permissionless, so if our laptop dies, the volunteer — or anyone who reads
   the card aloud — can submit it.
5. **A gas-funded wallet** for whoever sends the reveal.
6. **Comms**: publish the contract address and the verification recipe (below)
   before the draw, so "how would I check this wasn't rigged?" has a public
   answer before anyone needs to ask.

## If someone doesn't do their part in time

- **An entrant tries to enter after 20:00** — `enter()` reverts. They're simply
  not in the draw; nothing else is affected. Entrants must confirm their
  transaction is *mined* before 20:00 — a tx sent at 19:59 that lands at 20:01
  reverts. (Block timestamps can drift a second or two either way; anyone
  cutting it close should enter by 19:59.)
- **We don't reveal by 21:00** — `emergencyDraw()` becomes callable by anyone
  and pays the winner that same evening anyway, from a blockhash none of us
  can predict or control. The raffle **cannot be cancelled**, and the 5 ETH
  cannot go anywhere except to a drawn winner. Optional hardening: post a small
  bond at deployment that is forfeited if the fallback is used — that puts a
  price on "forgetting" to reveal.
- **We reveal a wrong or mistyped secret** — `reveal()` reverts (hash
  mismatch), nothing changes, we retry within the window.
- **Nobody calls `emergencyDraw()` either** — it never expires and is
  permissionless; the 5 ETH sits escrowed until any community member sends the
  transaction. It cannot be redirected in the meantime.
- **Nobody entered all week** — the draw functions revert on the empty list;
  after Saturday 20:00 the treasury can reclaim the 5 ETH. This is the only
  path by which the money ever returns to us.

## The loser's audit — why they can't build a credible case

Everything below is verifiable from onchain data, no trust in us required:

1. The entrant list is public, append-only, in entry order; their address is in
   it, and the count N is what it is.
2. The entropy hash was committed **in the constructor** — timestamped before
   the first entry existed. We could not have chosen the secret with any
   knowledge of who would enter, because there was no list to aim at.
3. The revealed preimage hashes to that commit; the reveal transaction is
   timestamped after close.
4. The index function is the two-line formula above; recomputing it from the
   transaction input yields the same winner.
5. The code has no admin paths — nothing that can alter the list, the funds,
   or the result — and the contract is not upgradeable.
6. Modulo bias is bounded by N/2^256.

**Residual risk, stated up front:** between 20:00 and the reveal, we are the
only party who can compute the pending winner (we hold the secret; the list is
public). We cannot *change* the outcome — our only move is refusing to reveal,
which (a) happens in front of the room, (b) hands the draw to a blockhash we
also can't predict or control, and (c) forfeits the bond if we posted one. In
practice the window for "refuse and shrug" is a few minutes, on stage, in
public.

One scope note: the contract enforces **one entry per address**, not per person
— "who actually turned up" is enforced at the door, as it always was; the
contract's job is to draw fairly among whatever addresses are on the list.
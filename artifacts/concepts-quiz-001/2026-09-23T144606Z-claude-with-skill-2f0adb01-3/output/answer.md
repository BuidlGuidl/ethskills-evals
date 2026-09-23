# 5 ETH giveaway: the sequence from entries closing to the prize landing

## The one thing to internalize first

**Nothing onchain is automatic.** There is no cron job, no scheduler, no
background process. The contract will not "draw a winner at 20:00." It sits
still until a human sends a transaction and pays gas. So every step below names
**who sends it**, **the window**, and **why they'd bother**.

Second: you have ETH and nothing else, and you're not opening a Chainlink VRF
subscription. That rules out the usual "provable randomness" answer and leaves
**commit–reveal**, which is fine — it's actually a better fit, because the
entropy comes from *the entrants themselves*, which is exactly the property you
asked for ("nobody, us included, influences or foresees the winner").

---

## The randomness design, in one paragraph

Each entrant, when they enter during the week, submits `keccak256(secret, salt,
their address)` — a sealed envelope. Nobody can see anyone's secret. After
entries close, each entrant opens their envelope onchain. The contract XORs all
revealed secrets into an accumulator. Then the draw mixes that accumulator with
the hash of a **future block** that nobody could see at reveal time.

Why this satisfies your two requirements:

- **No one can foresee the winner.** To predict the outcome you'd need every
  other entrant's secret *and* a block hash that doesn't exist yet.
- **No one can influence it.** You (the organisers) hold no key that touches
  the draw. An entrant who dislikes the outcome can only refuse to reveal —
  which removes them from the running and burns their bond. A validator could
  bias the block hash, but only if they *also* knew every secret.
- **A loser can't credibly cry foul.** Every commitment, every reveal, the
  target block, the seed and the index are all onchain events. Anyone can
  recompute the winner from public data with three lines of code.

Be honest in the room about the residual: this is not VRF-grade. It breaks only
if one party is simultaneously the last revealer *and* proposing the target
block. At 5 ETH and a room of known faces, that's the right trade.

---

## Have this in place beforehand

**Deployed and funded — by Monday of entry week, not Friday:**

1. **Contract deployed, source verified, immutable.** No `owner`, no `pause`,
   no `setWinner`, no upgrade proxy. If the contract contains a single function
   only you can call, that *is* the credible rigging case — delete it. The
   treasury address is a hardcoded `immutable`, set at deploy.
2. **The 5 ETH is already in the contract.** Treasury multisig sends it once,
   before entries open. Do not plan to fund it on the night; a multisig signer
   who's stuck on a train becomes your single point of failure.
3. **Entry eligibility fixed in advance.** Entry is free-to-win but costs a
   refundable **0.02 ETH bond**, and the constructor takes a **Merkle root of
   your member list**, published alongside it. Without this, one person enters
   from 200 addresses and wins with near-certainty — that's the cheapest real
   attack on this whole design, and it's the one people forget. Publishing the
   list *before* entries open means the allowlist is auditable and gives you no
   say over who wins.
4. **Deadlines are `immutable` timestamps** baked in at deploy — entries close
   `T = Fri 20:00 UTC`, reveal ends `T+25min`. Not a variable you set later.

**Operationally, for the night:**

5. **Entrants must be able to find their secret.** This is the most likely
   failure, by a wide margin. Browser localStorage is not a plan — phones get
   wiped, people come on a different device. At entry time, make the UI force a
   download / show a QR / print a slip with the secret and salt. Say at entry
   time, in plain words: *"lose this and you cannot win."*
6. **A reveal path that doesn't depend on your frontend.** Verified contract on
   the explorer plus a one-line `cast send` in the README, so if the venue wifi
   kills your dapp, people can still reveal from a phone browser.
7. **Entrants need gas on the night.** Reveal is a transaction. Have a small
   ETH faucet address, or a person with a hot wallet who can top up whoever
   shows up with 0 ETH on mainnet.
8. **A full dry run on a testnet with real people**, ideally at last month's
   meetup. Run the entire clock, including someone deliberately not revealing.
9. **Projector + backup hotspot.** The draw is only credible if the room
   watches the block explorer live.

---

## The sequence on the night

Clock is Friday, `T = 20:00 UTC`.

| # | Step | Who sends it | Window | Why they send it |
|---|------|--------------|--------|------------------|
| 0 | `enter(commitment, merkleProof)` + 0.02 ETH bond | each entrant | entry week → `T` | to be in the draw |
| 1 | — entries close — | **nobody** | `T` | no transaction needed |
| 2 | `reveal(secret, salt)` | each entrant, individually | `T` → `T+25m` | bond refunded on reveal; **no reveal = not in the draw** |
| 3 | `arm()` | **anyone in the room** | `T+25m` → `T+35m` | pays a **0.02 ETH tip** from the pot |
| 4 | `draw()` | **anyone in the room** | from `targetBlock+1`, for 256 blocks (~51 min) | pays a **0.03 ETH tip** |
| 5 | `payWinner()` | **anyone**, usually the winner | immediately after `draw()` | pays a **0.01 ETH tip** |

**Step 1 needs no transaction.** Don't build a `closeEntries()` that someone has
to remember to call — `enter()` simply reverts once `block.timestamp >= T`. The
best state transition is the one nobody has to poke.

**Step 2** is where the entropy is created. `reveal` checks the hash, XORs the
secret into the accumulator, adds the caller to the `revealed[]` array, and
refunds their bond. An entrant who never reveals forfeits the bond, and the
forfeited bonds roll into the prize.

**Step 3 `arm()`** records `targetBlock = block.number + 5` (~1 minute out). At
this moment every secret is already public and frozen, and the target block
hasn't been produced. That's the whole trick: entropy that's fixed but
unknowable.

**Step 4 `draw()`** computes
`seed = keccak256(secretAccumulator, blockhash(targetBlock))` and
`winner = revealed[seed % revealed.length]`, and emits everything. Put the tips
here and on `arm()` deliberately — these are the two steps with no natural
owner, and "someone will just do it" is not an incentive. 0.02 and 0.03 ETH
means half the room races you for it.

**Step 5** sends the remaining ~4.94 ETH with a plain `call`. If the winner is a
contract that reverts, it credits a `withdrawable` balance instead and the
winner pulls it later. Never let a failed push brick the payout.

Realistic wall clock: entries close 20:00, reveals done by 20:25, armed 20:26,
drawn 20:28, prize in the wallet 20:29. On stage, with time for a photo.

---

## What happens when someone doesn't do their part

This is the part most designs skip, and it's where they die.

**An entrant doesn't reveal** (lost the secret, went home, didn't like the
odds). They are simply not in `revealed[]`, so they can't win, and their 0.02
ETH bond stays in the pot for the actual winner. The draw proceeds with whoever
did reveal. **The contract never waits for anyone.** Note the asymmetry
this creates: withholding a reveal is the only lever an entrant has, and it can
only ever *remove them* from the draw. That's a lever pointed at their own foot.

**Nobody reveals at all** (venue wifi dies entirely). After `T+25m`, `abort()`
becomes callable by anyone and returns the full 5 ETH plus all bonds to the
hardcoded treasury address. You run it again next month. Nothing is stuck.

**Nobody calls `arm()`** in its window. Then `abort()` opens at `T+35m` and the
money goes home to the treasury. The 0.02 ETH tip exists precisely so this
doesn't happen.

**Nobody calls `draw()` within 256 blocks.** After 256 blocks `blockhash()`
returns zero, so the seed is unrecoverable. The contract does **not** re-arm —
it voids the draw and `abort()` returns everything to the treasury. This is
deliberate and worth explaining to the room: once `targetBlock` is mined,
anyone can compute the winner locally. If a re-arm were allowed, whoever didn't
like the result could stall for 51 minutes and buy a fresh roll. Making expiry
mean *nobody wins* removes any gain from stalling, and gives the pending winner
— who now knows they've won — every reason to send the transaction within
seconds. You need one person out of fifty to act in 51 minutes.

**Winner never claims.** `payWinner()` is permissionless, so anyone can push it
to them; if the push fails it converts to a pull. If it's still unclaimed after
30 days, `sweep()` (permissionless) returns it to the treasury.

**All of you get hit by a bus after deploy.** The giveaway still completes.
Nothing in the sequence requires an organiser's key — you're only needed to
fund it and publish the member list, both of which happen before entry week.

---

## The one-line summary

Entrants supply the randomness in sealed envelopes and open them on the night;
a future block hash stops the last one to open from steering it; every step
after entries close is permissionless and tipped so it doesn't depend on any
particular person showing up; and every path where someone drops out ends with
the ETH back in the treasury rather than stuck in a contract forever.

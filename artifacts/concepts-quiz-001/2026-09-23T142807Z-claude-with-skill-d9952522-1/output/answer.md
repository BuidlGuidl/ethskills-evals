# 5 ETH meetup raffle — draw sequence

## The shape of the answer

You ruled out a paid randomness provider, so Chainlink VRF is out (it also wants a
funded subscription and a callback in a *later* transaction, which is its own timing
problem). And there is no randomness to read onchain: every node re-executes the same
bytecode, so `block.timestamp`, `block.number`, `blockhash(block.number)` (always zero)
and `blockhash(block.number - 1)` are all either known in advance or chosen by someone.
`block.prevrandao` is biasable by the proposer. Any of those, and the losing entrant
reading the contract on Saturday morning has a real case.

What you do have is **a room full of entrants who each hold a secret**. That is the raw
material for a commit-reveal draw, seeded by *both* the entrants' secrets *and* a
blockhash from a block that does not exist yet when the last secret is revealed. Neither
side can steer it alone:

- An entrant who reveals last cannot foresee the outcome, because the draw block hasn't
  been proposed yet.
- The proposer of the draw block cannot steer it, because they don't get to pick the
  secrets that are already locked in.

That is the whole design. Everything below is the mechanics.

---

## What has to be in place before the night

1. **The contract is deployed and verified** on the block explorer, with the four
   deadlines hard-coded as constants at deploy time — `COMMIT_CLOSE`, `REVEAL_CLOSE`,
   `DRAW_DELAY`, `ABANDON_AFTER`. Not settable by an owner. A hard-coded timestamp is
   something a losing entrant can read; a setter is something they can accuse you of
   having moved.
2. **The 5 ETH is already in the contract** before entries open, sent from the treasury.
   Anyone can check the balance all week. A prize the organisers still have to fund on
   the night is a prize the organisers can decline to fund.
3. **No owner.** No `Ownable`, no `Pausable`, no proxy, no `selfdestruct`, no
   `rescueFunds()`. The only ETH exit paths are "pay the winner" and "return to the
   treasury address after `ABANDON_AFTER`", and that treasury address is an immutable
   constructor argument. This is the single biggest thing standing between you and a
   rigging accusation — if you ship a pause button, the honest answer to "could you have
   stopped the draw?" is yes.
4. **A decision on who may enter, fixed before entries open.**
   - *Open raffle:* anyone can `commit()`. Simple, maximally credible, and one person can
     enter forty times from forty addresses. Onchain cannot tell you they're one person.
   - *One entry per regular:* publish a Merkle root of the eligible addresses **before
     entries open** and gate `commit()` on a proof. Cheap and auditable — but be straight
     that you, the organisers, chose that list. The root being published and immutable in
     advance is what keeps it honest; it means you could not add yourselves on Friday.

   Pick one, say which, and don't change it.
5. **A refundable entry deposit** — something like 0.01 ETH. This is not a ticket price,
   it is the stake that makes people actually turn up and reveal. Revealers get it back;
   non-revealers forfeit it (see below).
6. **Secrets that cannot be lost.** Don't ask people to write down a random number on
   Tuesday and find it on Friday — half of them won't. Have the entry dApp derive the
   secret deterministically from an EIP-712 signature over a fixed message
   (`secret = keccak256(signature)`, `commitment = keccak256(secret, msg.sender)`). On the
   night, they reconnect the same wallet, sign the same message, and the secret is
   regenerated. Nothing to store, nothing to lose. Binding the commitment to
   `msg.sender` also stops anyone copying someone else's commitment hash off the chain.
7. **Boring logistics that will still sink you:** a working RPC endpoint on the venue
   wifi (and a phone hotspot as backup), the contract address on a QR code on the
   projector, everyone with a little gas money, and at least three people — not just the
   MC — who know how to call `lockDraw()` and `draw()` straight from the explorer's
   write tab if the dApp dies.

---

## The sequence, from entries closing to the ETH landing

Timestamps are for mainnet at ~12s blocks; adjust the block counts if you deploy on an
L2 (on Base at 2s, 256 blocks is only ~8.5 minutes, which matters in step 4).

### 1. Entries close — Friday 20:00 UTC — *nobody sends anything*

There is no "close entries" transaction and there must not be one. `commit()` simply
reverts once `block.timestamp >= COMMIT_CLOSE`. Nothing runs itself onchain, so the only
safe way to express a deadline is to make the *next* call fail, not to rely on someone
remembering to flip a switch. If closing entries were a transaction someone had to send,
that someone could send it early, late, or not at all.

### 2. Reveal — Friday 20:00 to 20:20 UTC — *each entrant sends their own `reveal()`*

**Who:** every entrant, one transaction each, from the address they entered with.
**Window:** 20 minutes. Do it live from the stage with the entrant list on the projector.

`reveal(secret)` checks `keccak256(secret, msg.sender) == commitment`, mixes the secret
into a running accumulator (`accumulator = keccak256(accumulator, secret)`), appends the
sender to the `entrants` array — **only revealers are in the draw** — and refunds their
deposit in the same transaction.

Twenty minutes is generous for a room; it is also short enough that the crowd is still
there. Nobody can compute anything useful from watching the reveals come in, because half
the seed doesn't exist yet.

### 3. Lock the draw block — any time after 20:20 UTC — *anyone*

**Who:** permissionless. The MC, any entrant, a stranger watching from home.
**Window:** any time between `REVEAL_CLOSE` and `ABANDON_AFTER`; in practice ~20:20.

`lockDraw()` requires `block.timestamp >= REVEAL_CLOSE` and at least one revealer, then
records `drawBlock = block.number + DRAW_DELAY` (5 blocks, ~1 minute). It does not need
to know anything about who calls it — there is no decision being made here, only a
commitment to a block that has not been proposed yet.

### 4. Draw and pay — ~1 minute later, within ~50 minutes — *anyone*

**Who:** permissionless again.
**Window:** from `drawBlock` until `drawBlock + 250` blocks (~50 min on mainnet, ~8 min
on Base). `blockhash` only reaches back 256 blocks; past that the hash is gone and the
seed with it.

```solidity
bytes32 h = blockhash(drawBlock);
require(h != bytes32(0), "expired, re-lock");   // re-callable: lockDraw() again
uint256 seed = uint256(keccak256(abi.encode(accumulator, h)));
winner = entrants[seed % entrants.length];
```

The modulo bias across a 256-bit seed and a few dozen entrants is far below anything
measurable — not worth the extra code.

The same transaction pays out: `winner.call{value: 5 ether}("")`. If that call fails —
the winner entered from a contract or a wallet with an expensive receive hook — the 5 ETH
stays put and the winner (or anyone, on their behalf) calls `claimPrize()`. For a normal
wallet, the ETH lands in the same transaction that names the winner. That is the moment
on stage: one transaction, the seed and the winner and the transfer all in the same
receipt, and the explorer link on the projector.

**Who pays for that transaction, and why would they?** Forfeited deposits (step 2's
no-shows) go to whoever calls `draw()`. It's a few dollars of gas against however many
deposits went unclaimed, and any entrant has an obvious reason to call it anyway — the
prize doesn't move until somebody does. If your entry deposit is zero or everyone
reveals, top the caller bounty up with a fixed 0.01 ETH from the treasury at deploy time
so a stranger is still paid to push the button when your laptop dies.

---

## Why a losing entrant can't build a case

Walk through it in their shoes, because they will:

| Attack | What stops it |
|---|---|
| Organisers pick the winner | No owner function exists. The only addresses the contract can send to are `entrants[seed % n]` and the immutable treasury address. |
| Organisers cancel a draw they don't like | `abandon()` is time-gated to `ABANDON_AFTER` and only fires when no winner was drawn. Once `draw()` has run, the prize is the winner's. |
| Someone copies a strong entrant's commitment | Commitments are bound to `msg.sender`; a copied hash can never be revealed. |
| Last revealer sees the outcome and withholds | They can't see it. The draw blockhash doesn't exist during the reveal window. This is the specific failure of naive commit-reveal, and it's why the future blockhash is there. |
| Someone simulates `draw()` and only sends the winning one | There is nothing to simulate — `draw()` reads a fixed block's hash and a fixed accumulator. Anyone can call it and the result is identical. |
| The block proposer re-rolls | This is the residual one, and you should state it out loud rather than have someone discover it. The proposer of `drawBlock` can drop their block to force a different hash, and they get exactly one re-roll at the cost of their block reward and MEV. To profit they'd have to *be* an entrant (or be bribed by one) and happen to be proposing that exact slot — probability equal to their share of total stake, which for anyone in your room is somewhere around zero. It moves a 1-in-40 chance to at best 2-in-40, once, for a validator who happens to be in the audience. For a 5 ETH community raffle that is an acceptable, disclosable residual. For a 5,000 ETH prize it would not be, and you'd want VRF. |
| Sybil entries | Real, and not a randomness problem — an open raffle genuinely lets one person enter many times. The deposit makes it cost something; the Merkle allowlist removes it at the price of you having chosen the list. Whichever you pick, say which in the announcement. |

---

## What happens when someone doesn't do their part

The rule throughout: **no single person's absence can stop the draw, and no single
person's absence can redirect the money.**

**An entrant doesn't reveal in time.** They're simply not in `entrants`, so they can't
win, and their deposit is forfeited to the `draw()` caller. Nobody has to chase them,
nobody has to exclude them — the array is built from reveals, not from commits. This is
also why the deposit has to be real money: a free entry that never reveals costs the
entrant nothing and just shrinks the pool.

**Nobody calls `lockDraw()` on the night** — MC's laptop is dead, wifi is out. It stays
callable by anyone until `ABANDON_AFTER`. The draw happens on Saturday from someone's
phone instead of on stage. Undramatic, but the prize still goes to a random entrant.

**Nobody calls `draw()` within 256 blocks of `drawBlock`.** `blockhash` returns zero, the
call reverts with `"expired, re-lock"`, and `lockDraw()` becomes callable again to pick a
fresh draw block. Losing the window costs you a minute, not the raffle. Getting this
wrong is the classic way a commit-reveal raffle bricks itself permanently, so it is worth
a test.

**Nobody reveals at all** (the venue's internet dies at 19:58). `lockDraw()` reverts —
`entrants.length == 0` — and after `ABANDON_AFTER` (Saturday 20:00 UTC, 24h later) anyone
can call `abandon()`, which returns the 5 ETH to the treasury address and re-opens deposit
withdrawal for everyone who committed. No winner, no loss, run it again next month. Say
this in the announcement beforehand so it isn't a surprise.

**The winner's address can't receive.** The prize sits in the contract, flagged to them,
claimable forever by `claimPrize()`. It never reverts back to the treasury once a winner
exists.

**You all get hit by a bus.** The contract has no operator, so it keeps working. Anyone
can lock, anyone can draw, the winner can claim. The dApp and the RPC are yours and would
go down with you; the contract and every entry in it stay readable and callable from a
block explorer by anyone. That split is the point — the half that matters survives you.

---

## What this publishes

Everything, permanently: every entrant's address, when they entered, the exact secret each
one revealed, who won, and the transaction that paid them. If two people in the room would
rather not have "attends this meetup, has this wallet" written down publicly and
permanently, an onchain raffle is the wrong tool and a hat with folded paper is the right
one. There is no privacy here to trade away later — say it before entries open, not after.

One last note on scope: this is a design, not a reviewed contract. Write it, test the
expiry-and-re-lock path and the zero-revealer path specifically, and if someone reviews it
that review covers the code as it stood that day, not whatever is deployed on Friday.

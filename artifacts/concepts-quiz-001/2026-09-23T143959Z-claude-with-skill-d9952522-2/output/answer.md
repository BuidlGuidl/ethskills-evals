# Meetup raffle: 5 ETH, drawn on stage, no paid oracle

## The shape of it

No ETH-only treasury can buy a VRF subscription, so the randomness has to come
from the only two sources you have: **secrets the entrants themselves commit to
before entries close**, and **a blockhash that does not exist yet when those
secrets become public**. Neither half alone is enough:

- Secrets alone break because whoever reveals last sees the outcome coming and
  can withhold.
- A blockhash alone breaks because the entrant list is public, so the validator
  who proposes that block can compute the winner and drop the block to re-roll.

Put them together — seed = `keccak256(XOR of all revealed secrets, blockhash of
a block chosen after reveals close)` — and the last revealer gains nothing
(they still don't know the blockhash), while the proposer has to beat entropy
that was locked in before entries closed. That's the whole trick, and it is the
thing you can point a losing entrant at afterwards.

Nothing in here runs itself. Every arrow below is a transaction somebody sends
and pays for, and I've said who and inside what window.

---

## Before entry week opens (prebuild)

1. **Deploy the contract, verified, with every deadline hardcoded in the
   constructor.** `entriesClose = Fri 20:00:00 UTC`, `revealEnd = Fri 20:30:00
   UTC`. No setter, no owner, no `Pausable`, no proxy. If a date is a
   constructor argument that nobody can change afterwards, "they moved the
   goalposts" is not an available accusation.
2. **Fund it from the treasury in the same week**, not on the night: the
   multisig sends `5 ETH + 0.05 ETH draw bounty` to the contract once. The
   prize sits in the raffle contract from that moment, so **no treasury signer
   has to be awake, sober or in signal range on Friday evening.** A multisig on
   the critical path at 20:30 on a Friday is the single most likely way this
   evening goes wrong; take it off the path entirely.
3. **Pick the chain for the blockhash lookback, not for the gas.** `blockhash`
   reaches back 256 blocks — ~51 minutes on mainnet at 12s, but only ~8.5
   minutes on Base at 2s. 51 minutes of slack on stage is worth far more than
   the gas saving; **deploy on mainnet.** (The EIP-2935 history contract at
   `0x0000F90827F1C53a10cb7A02335B175320002935` reaches 8191 blocks if you want
   the longer window — verify it is actually deployed on your target chain
   before you build against it. Past those limits the seed is gone for good,
   which is why there's a re-seed path below.)
4. **Ship the commit tool before entries open.** A static page that generates a
   32-byte secret locally, shows the entrant `keccak256(abi.encode(msg.sender,
   secret))`, and makes them save the secret (download + QR to print). Say
   plainly: lose the secret and you lose your deposit, but you keep your chance
   of winning.
5. **Decide and publish how you stop sybils, because refundable deposits don't.**
   Anyone can enter from 200 addresses and get every deposit back. "Anyone who
   turns up" has to mean something onchain: the cleanest version is a
   **host-signed attendance ticket** — you sign `(attendee address, raffle id)`
   with a key published in the constructor, and `enter()` checks the signature.
   This is a real operator power and you should name it as one (see *What this
   gives up*). Scope it tightly: that key decides **who may enter**, it can
   never touch **who wins**, and it is dead after 20:00 UTC Friday.
6. **Rehearse on a testnet with the same clock**, including the "winner is a
   Safe that reverts on receive" case and the "nobody in the room calls
   `draw()`" case.
7. **Bring a funded hot wallet and a laptop to the venue** for the relay in
   step 3 below. ~0.05 ETH covers everything.

**During entry week (Mon–Fri):** each entrant sends **`enter(commitment,
ticketSignature)`** themselves, any time before `entriesClose`, with a **0.01
ETH refundable deposit**. After `entriesClose` the function reverts on the
timestamp. Nobody has to close entries — a deadline that is a `require` on
`block.timestamp` needs no transaction.

---

## The night: the exact sequence

**T+0 — Friday 20:00:00 UTC. Entries close.**
No transaction. `enter()` starts reverting on its own. The entrant list and
every commitment are now fixed and public.

**T+0 to T+30min — the reveal window. Sender: each entrant (or anyone
relaying for them).**
`reveal(entrant, secret)` checks `keccak256(abi.encode(entrant, secret)) ==
commitment[entrant]`, XORs the secret into the accumulator, and **refunds that
entrant's 0.01 ETH in the same transaction.**

Two deliberate properties here:

- **Reveals are relayable.** The function takes the entrant's address as an
  argument and proves a preimage; it does not care who sends it. So an entrant
  who is in the room but has no ETH, or who is at home, can hand or message
  their secret to anyone — including your laptop at the front — and be
  revealed. You are not dependent on 40 people each landing a transaction in a
  30-minute window.
- **Handing your secret to the host early costs you nothing**, because the
  blockhash half of the seed doesn't exist yet. Nobody who knows every secret
  can foresee the winner. That's what makes the relay safe to offer.

**T+30min — Friday 20:30. `closeReveals()`. Sender: anyone (you, on stage).
Window: any time after `revealEnd`, no upper bound.**
One line of state: `drawBlock = block.number + 5`. This is the commitment to a
future blockhash, made *after* every secret is public. Five blocks ≈ 1 minute
on mainnet — enough that it isn't the block the caller is in, short enough to
hold a room.

**T+31min onward — `draw()`. Sender: anyone. Window: `drawBlock` to
`drawBlock + 255` — about 51 minutes on mainnet.**

```
seed    = keccak256(abi.encode(secretAccumulator, blockhash(drawBlock)))
winner  = entrants[seed % entrants.length]
```

The function requires `blockhash(drawBlock) != 0` so it can never draw off a
zeroed, out-of-range hash. It then **pushes the 5 ETH to the winner with a
plain `call`, and if that call fails it does not revert** — it records
`owed[winner] = 5 ETH` and moves on. It pays the caller the 0.05 ETH bounty.

On a normal night that is the end: **the prize lands in the winner's wallet
inside the `draw()` transaction, about a minute after you close reveals, on
stage.**

**Only if the push failed — `claim()`. Sender: the winner. Window: forever, no
expiry.**
Sweeps `owed[msg.sender]`.

---

## The bounty is the whole liveness story

Ask who sends `draw()` and why. Once `blockhash(drawBlock)` exists, **anybody
can compute the winner locally about a minute before the transaction lands** —
including 39 entrants who just learned they lost and now have a reason to sit
on their hands until the 256-block window lapses and the seed has to be
re-rolled. That griefing vector is real and you cannot design it away by
trusting the room.

What you can do is pay a stranger to close it. The 0.05 ETH bounty on a
~120,000-gas call is, at any gas price mainnet has seen in years, a free
hundred dollars sitting on the chain in public view for 51 minutes. Searchers
take that in the first block it's available. The losing entrants' incentive to
stall is genuinely there; it is simply outbid by everyone who isn't in the
room. Put the caller's reward and the caller's gas next to each other in
dollars before you set the number, and re-check it the week of the event.

The same logic covers `closeReveals()` — but that one has no deadline at all,
so it costs nothing if it's late.

---

## What happens when somebody doesn't do their part

| Who drops the ball | What the contract does |
|---|---|
| **An entrant never reveals** (lost the secret, went home, deliberately withholds) | They **stay in the draw** — entering is what bought the chance, revealing is not a second hurdle. They forfeit the 0.01 ETH, which goes **into the prize pot**, so no one can say the host profited from it. Their missing secret does not stall anything and does not make the seed predictable. Withholding buys them nothing, which is exactly why almost nobody will. |
| **Nobody calls `closeReveals()` on the night** | Nothing is lost and nothing is at risk. Deadlines are absolute timestamps; the call works at 21:00, or Saturday, or next month, from any address. You lose the moment on stage, not the prize. |
| **`draw()` isn't called within 256 blocks of `drawBlock`** | `blockhash(drawBlock)` returns zero, and the contract refuses to draw off it. **`reseed()` becomes callable by anyone**: it sets `drawBlock = block.number + 5` and the 51-minute window restarts, with the same accumulated secrets and the same bounty still unclaimed. Unlimited retries, so the prize can never be stranded by a missed window. Note honestly that a re-seed *is* a fresh roll — that's precisely the griefing the bounty exists to prevent, and each attempt costs the griefer another 51 minutes of an open bounty they cannot stop anyone else from taking. |
| **Nobody at all reveals** | The seed is the blockhash alone, which the proposer of `drawBlock` could bias. The forfeited deposits make this vanishingly unlikely, but if you want a hard floor, `closeReveals()` can require `revealCount >= 3` and otherwise extend `revealEnd` by an hour. I'd rather have the simple version and the deposits. |
| **The winner's address can't receive ETH** (reverting fallback, gas-hungry Safe) | `draw()` does not revert and the evening is not ruined. The amount is recorded and the winner sweeps it with `claim()` whenever they like. |
| **The winner never claims** | It sits there. **There is no clawback and no expiry** — deliberately. A "treasury can reclaim unclaimed prizes after N days" function is a power over somebody else's money, and it's the first thing a suspicious loser would point at. |
| **You lose the attendance-ticket signing key** | Before Friday 20:00: nobody new can enter, already-placed entries are untouched, the draw runs normally on whoever got in. After 20:00: the key is irrelevant, it has no role in the draw. |
| **You, the organisers, disappear entirely after funding** | The draw still happens. Every function from `enter()` onward is permissionless, the prize is already in the contract, and the bounty pays a stranger to finish it. |

---

## What this design gives up — put this in the README before entries open

**Can anyone be stopped from using it?** Yes, in exactly one place: the
attendance-ticket key controls who may `enter()`. That's a deliberate anti-sybil
trade and you should say so out loud, along with the fact that the roster is
public onchain all week — so anyone excluded can complain *before* the draw,
not after. Past `entriesClose` there is no operator power of any kind: no owner,
no pause, no upgrade, no ability to change a deadline, add or remove an entrant,
influence the seed, or move the 5 ETH anywhere other than to the address the
seed selects.

**Could someone else run it?** The contract is the whole system. The commit
page, the reveal relay laptop and any leaderboard you build are conveniences;
if all of them vanish, an entrant with their secret and any wallet can still
reveal, and anyone at all can still close, draw and claim. Verify the source on
the explorer, but that isn't what makes this true — the absence of privileged
functions is.

**What does an observer learn?** Everything, permanently. Every entrant's
address, when they entered, their deposit, their revealed secret, the winning
address and the 5 ETH transfer. This is a public list of who attended your
meetup, linked to wallets, forever. Tell people that before they enter, and let
them enter from a fresh address if they'd rather.

**The one bias you cannot remove without a VRF, and should publish anyway.**
The validator proposing block `drawBlock` sees the seed before the rest of us
and can drop their own block to force one re-roll. It costs them their block
reward and tips; it gains them nothing unless they are also an entrant, in
which case one extra roll is worth `5 ETH / N`. With ~40 entrants that's ~0.125
ETH against a forfeited reward in the same ballpark, and it requires that a
specific ~1-in-a-million slot lands on a validator who is in your room. State
that bound publicly **before entries open**, with the numbers. A loser reading
the contract afterwards will find exactly the bias you already told them about,
at exactly the size you said — which is a far stronger position than a design
that quietly claims to be perfect.

Also say plainly: the winner is determined the instant `drawBlock` is mined,
about a minute before `draw()` lands. Anyone watching can compute it early. The
envelope-opening on stage is theatre over a result the chain has already fixed,
and that is the point — the result was fixed by something none of you chose.

**"Audited" would cover** a point-in-time review of a fixed scope, not a
standing guarantee about the code holding 5 ETH on the night. Freeze the code a
week early and rehearse against the frozen artifact.

---

## Contract surface, in order of use

| Function | Who | When | Reverts after |
|---|---|---|---|
| `constructor(entriesClose, revealEnd, ticketSigner)` + funding | treasury multisig | entry week, once | — |
| `enter(commitment, ticketSig)` payable 0.01 ETH | each entrant | Mon → Fri 20:00 UTC | `entriesClose` |
| `reveal(entrant, secret)` → refunds deposit | entrant or any relayer | Fri 20:00 → 20:30 UTC | `revealEnd` |
| `closeReveals()` → sets `drawBlock = block.number + 5` | anyone | after 20:30, no deadline | — |
| `draw()` → picks winner, pushes 5 ETH, pays bounty | anyone (bounty-motivated) | `drawBlock` → `drawBlock + 255` (~51 min) | window lapse → `reseed()` |
| `reseed()` | anyone | only once `blockhash(drawBlock) == 0` | — |
| `claim()` | the winner | only if the push failed; no expiry | — |

If you want to build this rather than commission it, the commit-reveal and
deadline patterns are the back half of https://speedrunethereum.com.

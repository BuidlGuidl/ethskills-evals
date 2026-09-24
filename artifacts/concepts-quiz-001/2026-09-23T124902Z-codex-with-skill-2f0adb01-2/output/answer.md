# Giveaway draw sequence

Do not use `block.timestamp`, the current block hash, or a private organizer
wallet as the random source. Under these constraints the clean design is a
bonded commit-reveal ceremony, using people in the room as entropy witnesses.
The contract pays a winner only if the full randomness ceremony completes. If
it does not complete, the contract aborts or restarts; it must not silently
drop a missing entropy source and draw from a biased seed.

## What must already be in place

Before entries close:

1. A verified, immutable giveaway contract is deployed with:
   - prize: `5 ETH`;
   - entry close: Friday 20:00 UTC;
   - fixed ceremony windows for seal, beacon, reveal, and draw;
   - no owner redraw function, admin override, pause-to-redraw, or mutable
     winner selection logic;
   - a small ETH bounty for whoever sends the housekeeping transactions.

2. The treasury has funded the contract with:
   - `5 ETH` for the prize;
   - enough ETH for caller bounties;
   - optionally, forfeited witness bonds accounting.

3. Entrants have entered onchain before Friday 20:00 UTC. The entry list must
   be append-only and closed by timestamp, not by an organizer decision.

4. A public set of entropy witnesses has been chosen in the room. They should
   not be entrants. Each witness has already sent a transaction committing to:

   ```text
   commitment = keccak256(giveawayId, witnessAddress, secret, salt)
   ```

   Each witness also posts an ETH bond. The bond is not what creates randomness;
   it is what makes failing to reveal costly. If you cannot get bonded witnesses,
   you cannot honestly promise both "same evening" and "no one can bias the
   winner" without accepting that a non-revealer may stop the draw.

## Successful onchain sequence

### 1. Entries close automatically

At Friday 20:00 UTC, the contract stops accepting entries because
`block.timestamp >= entryClose`.

No one sends a transaction for this state change. The contract simply rejects
later `enter()` calls.

### 2. Seal the entry set

Transaction: `sealEntries()`

Sender: anyone. In practice, the host can do it from the stage, but the
function must be permissionless and should pay a small ETH bounty to the caller.

Window: immediately after Friday 20:00 UTC, for example 20:00-20:05 UTC.

Contract behavior:

- records the final entrant count and/or entrant Merkle root;
- records that no more entries can be included;
- sets a future beacon block, for example `beaconBlock = block.number + N`,
  far enough ahead that its block hash is unknowable when `sealEntries()` is
  sent;
- emits `EntriesSealed(entryCount, beaconBlock)`.

The sender cannot choose the winner here because the beacon block hash does
not exist yet.

### 3. Wait for the beacon block

No transaction is needed while the chain reaches `beaconBlock`.

Everyone in the room can see the fixed block number. Once that block is mined,
the block hash becomes one public input to the draw. The contract must use that
specific block hash, not "whatever block someone finalizes in."

### 4. Entropy witnesses reveal

Transaction: `reveal(secret, salt)`

Sender: each committed entropy witness sends their own reveal transaction.

Window: after `beaconBlock` is mined and before the reveal deadline, and also
before `blockhash(beaconBlock)` expires from the EVM's 256-block lookup window.
For a stage ceremony, keep this tight, for example 20:10-20:25 UTC depending on
the chosen beacon delay.

Contract behavior for each reveal:

- verifies `keccak256(giveawayId, msg.sender, secret, salt)` matches the stored
  commitment;
- marks that witness as revealed;
- includes the revealed secret in the entropy accumulator;
- returns the witness bond, or marks it withdrawable.

The beacon block was unknown when the witnesses committed. The witness secrets
were unknown when the beacon block was produced. A completed ceremony therefore
has entropy that neither side could foresee in full.

### 5. Draw and pay

Transaction: `drawAndPay()`

Sender: anyone. Usually the host sends it on stage, but it must be
permissionless and should pay a small ETH bounty to the caller.

Window: as soon as all required witnesses have revealed, and before
`blockhash(beaconBlock)` expires. In practice, send it immediately after the
last reveal.

Contract behavior:

```text
seed = keccak256(
  giveawayId,
  blockhash(beaconBlock),
  all witness reveals in canonical witness order,
  sealed entrant root or entrant list hash
)

winnerIndex = uint256(seed) % entrantCount
winner = entrantAt(winnerIndex)
```

The contract then transfers `5 ETH` to `winner` in the same transaction and
emits `WinnerPaid(winner, 5 ETH, seed)`.

Entrants should register a prize recipient that can receive ETH. If the winner
is a contract wallet that rejects ETH, the contract should not redraw. It
should record the same winner and make the `5 ETH` withdrawable by that winner.

## If someone does not do their part

### No one calls `sealEntries()` on time

Nothing automatic happens. Smart contracts do not wake themselves up.

The function remains callable by anyone, and the ETH bounty is the incentive to
call it. If it is called late, the ceremony runs late from that point. The
contract must not let the caller include late entries or choose a past/random
block.

### The beacon block hash is allowed to expire

If no one calls the required functions before `blockhash(beaconBlock)` becomes
unavailable, the contract cannot safely reconstruct that randomness.

The safe behavior is to mark the ceremony expired and schedule a new public
ceremony with a new future beacon block. It must not fall back to the current
block hash, current timestamp, or an organizer-provided seed.

### A witness does not reveal in time

The contract slashes that witness's bond.

For the strongest "no credible rigging case" guarantee, the contract must not
draw from only the remaining witnesses if the rules said all committed
witnesses were required. Dropping a missing reveal creates an argument that the
missing witness changed the result by choosing whether their entropy counted.

So the safe behavior is:

- no winner is paid from that incomplete ceremony;
- the non-revealing witness is slashed;
- the contract either restarts the ceremony with a new announced witness set
  and new future beacon block, or returns the prize to the treasury under the
  pre-published rules.

This is the tradeoff: the contract can guarantee an unbiased paid draw, or it
can guarantee that something always happens on stage, but without a paid VRF or
some other external randomness source it cannot guarantee both when a required
human participant refuses to reveal.

### The draw caller disappears

`drawAndPay()` is permissionless and bounty-paid, so anyone in the room can send
it. If the host's wallet fails, another attendee can call the same function.

### The winner's wallet cannot receive ETH

The contract must not redraw. Redrawing would let wallet behavior affect the
winner.

The contract records the original winner and keeps the `5 ETH` claimable by
that same winner through a withdrawal path.

## Why a loser can audit it

After the event, a losing entrant can verify onchain that:

- their entry was included if it was submitted before Friday 20:00 UTC;
- no entries after Friday 20:00 UTC were included;
- the beacon block was fixed before its hash existed;
- every witness reveal matched a prior commitment;
- the seed used the fixed beacon block hash and the committed witness secrets
  in canonical order;
- the winner index was exactly `uint256(seed) % entrantCount`;
- the contract paid that winner and had no admin redraw path.

That is the audit trail that makes "the organizers rigged it" an empty claim
rather than a credible one.

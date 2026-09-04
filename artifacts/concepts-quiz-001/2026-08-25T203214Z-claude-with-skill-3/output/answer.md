# 5 ETH meetup raffle — the runbook

No VRF subscription, no LINK, no offchain service to top up. The seed comes from
two sources that no single party holds:

1. **A secret from every entrant**, committed onchain during entry week and revealed
   in the room after entries close. Nobody — you included — can see these while
   entries are open.
2. **The hash of a block that does not exist yet** when the last secret is revealed.
   Nobody, entrants included, can see this while the secrets are going in.

`seed = keccak256(accumulator_of_all_revealed_secrets, blockhash(seedBlock))`

The ordering is the whole design: secrets are locked before anyone can see the
blockhash, and the blockhash is fixed after every secret is public. Neither side
can be chosen with knowledge of the other, so neither side can steer the result.

Everything below is a transaction someone sends. Nothing in the contract fires by
itself — no timer, no cron, no keeper. Every step on the night is permissionless,
so the show does not depend on your laptop, your key, or your wifi.

---

## Part 1 — What has to be in place before Friday

| # | Thing | Deadline |
|---|-------|----------|
| 1 | **Contract deployed and verified** on the explorer, with `entryClose`, `revealClose` and `treasury` set as `immutable` at deploy. **No owner, no `Pausable`, no proxy, no setter for the deadlines, no upgrade path.** This is the single most important item for "you can't build a credible case it was rigged" — a reader can see there is no lever to pull. | ≥ 1 week before entries open |
| 2 | **Treasury funds it with exactly 5 ETH** (plain transfer to the contract). `enter()` reverts unless `balance >= PRIZE`, so an unfunded contract is discovered on Monday by the first entrant, not at 20:00 on Friday. | Before entries open |
| 3 | **Published in advance:** the contract address, the seed formula above, the exact timestamps, and the instruction that *revealing is a second transaction, in the room, between 20:00 and 20:20 UTC*. People need to know this when they enter, not when they arrive. | With the entry announcement |
| 4 | **Entry app that derives the secret from a wallet signature** — `secret = keccak256(sig over "meetup-raffle-<address>-<month>")`, submitted as `commitment = keccak256(secret, entrant)`. That way the entrant re-derives the same secret on Friday from their wallet alone, with nothing to write down and nothing to lose. Show the raw secret too, as a backup, for wallets that sign non-deterministically. | Before entries open |
| 5 | **Reveal path that works without your frontend:** a projected QR/short link, *and* the Etherscan "Write Contract" tab plus a one-line `cast` command on a slide. If your site is down at 20:01 the room can still reveal. | On the night |
| 6 | **Gas in the room.** Reveals are ~50k gas each. Have a hot wallet with a few tenths of an ETH to top up anyone who shows up with an empty wallet, and warn people in advance to arrive with gas. | On the night |
| 7 | **Two or three other people primed to send `lockSeed()` and `draw()`** from their own wallets, with the Etherscan write tab already open. Both are permissionless — see the incentives below. | On the night |
| 8 | **A full rehearsal on Sepolia** with the same code and the same clock offsets, including one run where you deliberately miss the draw window and recover with `relock()`. | Week before |
| 9 | **A projector on the block explorer**, not on your app. The room should watch the chain, not your UI. | On the night |

**Chain choice.** Mainnet. `blockhash` reaches back 256 blocks (~51 minutes) and the
EIP-2935 history contract at `0x0000F90827F1C53a10cb7A02335B175320002935` reaches
8191 blocks (~27 hours) — that is a comfortable margin for a live draw. On a 2-second
L2 those same limits are ~8 minutes and ~4.5 hours, which turns a slow moment on stage
into a re-roll. If you go to an L2 anyway for the gas, shorten every window below and
confirm EIP-2935 is actually deployed there before you rely on it.

---

## Part 2 — The sequence, entries closing to prize landing

Times are Friday UTC. All windows are enforced by `block.timestamp` against
immutable constants; a proposer can nudge a timestamp by a few seconds, which
matters to nothing here.

### 20:00:00 — entries close

No transaction. `enter()` starts reverting on `block.timestamp >= entryClose`.
The entrant set is now frozen and public: `entrants.length` tickets, one per
address that entered, each with a committed hash and nothing else visible.

### 20:00–20:20 — `reveal(secret)` — one transaction per entrant, sent by that entrant

Each entrant sends their own reveal. The contract checks
`keccak256(secret, msg.sender) == commitmentOf[msg.sender]`, then folds the secret
into `accumulator` and marks them revealed.

**Revealing is not required to win.** Everyone who entered is already a ticket
holder; the reveal only contributes entropy. This is a deliberate choice and it is
what makes the evening robust — see the last-revealer note below.

*Who and why:* the entrant, because they are in the room and it costs them ~$0.30.
No one else can reveal for them; the commitment is bound to their address.

### 20:20 (or any time after) — `lockSeed()` — one transaction, anyone

Requires `block.timestamp >= revealClose`. Sets `seedBlock = block.number + 5`
(~60 seconds ahead) and does nothing else. This is the moment the future blockhash
is committed to, and it happens strictly after the last secret is public.

*Who and why:* you send it on stage. It is permissionless, so if your laptop is dead
any of the ~40 entrants can send it — and every one of them has a `1/N × 5 ETH`
interest in the draw happening. At 40 entrants that is ~0.125 ETH of expected value
against ~30k gas (about $0.50 at 5 gwei / $3.5k ETH), a ~250:1 ratio. Nobody has to
be paid a keeper fee to make this happen; the prize is the fee.

*Window:* any time from 20:20 onward. **There is no deadline on this step** — reveals
are already closed, so waiting changes nothing and gains nobody anything. If it slips
to 20:35 the raffle is simply 15 minutes later.

### ~20:21 — `draw()` — one transaction, anyone

Requires `block.number > seedBlock` and a winner not yet set. Reads
`blockhash(seedBlock)`, falls back to the EIP-2935 history contract if the block is
more than 256 back, computes

```
seed   = keccak256(accumulator, blockhash(seedBlock))
winner = entrants[uint256(seed) % entrants.length]
```

and, in the same transaction, sends the 5 ETH to the winner. **This is the moment the
prize lands in the wallet** — no separate claim step for a normal wallet, and the
winner does not have to be in the room to receive it.

*Who and why:* you, on stage, for the ceremony. Permissionless with the same
1/N-of-5-ETH incentive as above; ~80k gas, about $1.40.

*Window:* from ~20:21 until **256 blocks after `seedBlock` (~21:12 UTC)** using plain
`blockhash`, extended to **~8000 blocks (Saturday ~23:00 UTC)** by the EIP-2935 fallback.
Past that the seed is gone for good and you re-run `lockSeed()` (see below).

*On stage:* the transaction is in a block within ~12 seconds, but that block is not
final for ~13 minutes. Read the winner off the explorer after a handful of
confirmations, and if you want to be strict about it, announce after finality.

**Total: two transactions on the night from the organisers, plus one voluntary reveal
per entrant.**

---

## Part 3 — What happens when someone doesn't do their part

| Who misses what | What the contract does |
|---|---|
| **An entrant never reveals** (lost secret, stuck in traffic, asleep) | Nothing. They keep their ticket and can still win; their secret just never enters the accumulator. No forfeit, no deposit, no exclusion. Their absence cannot delay or block the draw. |
| **Nobody reveals at all** | `accumulator` stays zero and the seed is `keccak256(0, blockhash(seedBlock))` — still unknown to everyone before `seedBlock`, still un-steerable. The draw proceeds normally. |
| **Nobody sends `lockSeed()` on time** | There is no "on time". It has no expiry; the first person to send it, tonight or Sunday, starts the one-minute clock. State is frozen until then and nobody gains from the delay. |
| **Nobody sends `draw()` within the blockhash window** | `blockhash(seedBlock)` reads zero, `draw()` reverts with `SeedExpired`. Anyone then calls `relock()`, which picks a fresh `seedBlock` and the draw runs a minute later. `relock()` is guarded by `require(_blockHash(seedBlock) == 0)` — it is only callable when the old seed is genuinely unrecoverable, so it can never be used to re-roll a result someone dislikes. **The raffle cannot be bricked and the 5 ETH cannot be stranded.** |
| **The winner is a contract that rejects ETH** (multisig with no receive, reverting fallback) | The push transfer fails, `draw()` does not revert; the amount is credited to `owed[winner]` and the winner calls `claim()` whenever they like. The draw itself still completes on stage. |
| **The winner never claims that credit** | It stays claimable forever. There is deliberately no expiry-and-sweep on a decided prize — a "treasury reclaims unclaimed prizes after 90 days" clause is exactly the lever a suspicious loser would point at. |
| **Nobody enters at all** | After `entryClose + 30 days`, anyone can call `reclaim()`, which returns the balance to the immutable treasury address. Only reachable when `entrants.length == 0`. |
| **Your keys, your app, your whole organising crew disappear after deploy** | The raffle still completes. `reveal`, `lockSeed`, `draw`, `relock` and `claim` are all permissionless and all reachable from a block explorer. |

---

## Part 4 — The attacks, and why they don't pay

**"The organisers picked the winner."** There is no owner, no pause, no upgrade proxy,
and no setter for the deadlines or the seed. The only inputs are entrant secrets you
never saw and a blockhash from a block that did not exist when the secrets were locked.
A reader can confirm every one of those from the verified source in about two minutes.

**"An entrant revealed last and grabbed it."** This is the classic commit-reveal hole:
whoever reveals last sees the outcome coming and can withhold. It is closed here by
ordering. At reveal time the blockhash half of the seed does not exist yet, so a
withholder is choosing blindly between two uniformly random outcomes. Withholding
gains exactly nothing, which is also why there is no deposit to forfeit — the stake
would be pricing an attack that does not pay. **If you ever drop the blockhash term
from the seed, you must add a forfeitable deposit and reveal-to-be-eligible, because
the hole reopens immediately.**

**"Someone ground the seed by retrying."** `draw()` can only read the pre-committed
`seedBlock`, never `blockhash(block.number - 1)`. Sending `draw()` a hundred times
gives the same answer a hundred times. And `relock()` is unreachable while the old
hash is still readable.

**The one thing this does give up: the proposer of `seedBlock`.** That validator sees
the accumulator (public by then), can compute who wins under their block, and can
decline to propose to force a different hash. That is one re-roll, and it costs them
the block reward. For it to matter they would have to be one of your ~40 entrants
*and* be assigned that specific slot — for a meetup-sized staker, odds in the tens of
thousands to one — for an expected gain of ~0.125 ETH against ~0.05–0.1 ETH of
forgone reward. Say this out loud when you explain the design. It is the honest
residual, it is the same residual a `prevrandao` design carries, and a paid VRF is
the only thing that removes it.

**Sybils are the real unfairness here, not the randomness.** One person with 40
addresses gets 40 tickets, and 5 ETH is enough to make that worth a Saturday
afternoon. Nothing onchain can tell those apart. Two options: accept it and say so,
or make `enter()` take a Merkle proof against a root of RSVP'd addresses that you
publish *before entries open*, so the gatekeeping is auditable and settled in advance
rather than exercised on the night. I would do the second. Note that it is a real
censorship power — you decide who is in the root — which is why it has to be
published first and be immutable after deploy.

---

## Part 5 — What this design gives up

**Can anyone be stopped from using it?** Not by you. There is no owner, no pause, no
blacklist, no upgrade path, and the deadlines are immutable. You cannot stop an entry,
cannot stop a reveal, cannot stop the draw, and cannot stop the payout — and neither
can anyone else. If you add the RSVP Merkle root, that root is the one exclusion in the
system: it is fixed at deploy and public before entries open, and you cannot change it
afterwards. Losing every key you own has no effect on the raffle completing.

**Could someone else run it?** Yes, and this is the load-bearing property on the night.
Contract and state are public; the entry app, the QR link and your projector are
convenience only. Every step — computing a commitment, entering, revealing, locking,
drawing, claiming — is doable from Etherscan and `cast`. If your site dies at 20:01 the
evening continues. Nothing offchain gates any transition.

**What does an observer learn?** Everything, forever. The entrant list is a public
list of wallet addresses tied to a named meetup on a specific date. Anyone can pull
it, cross-reference each address's whole history, and see the 5 ETH land in the
winner's wallet. Tell people this before they enter and suggest a fresh address if
they would rather not link their main wallet to the event. Nothing here is private
and nothing can be deleted later.

**What does "audited" cover?** Nothing — this is not audited. It is ~120 lines with no
owner and no upgrade path, rehearsed end-to-end on Sepolia including the failure paths.
That is the actual assurance and it is worth stating plainly rather than implying more.
If you want more, the useful spend is a second pair of eyes on the ordering constraint
(secrets locked before `seedBlock` is fixed) and on the `relock()` guard, because those
two are where a mistake would silently cost you the fairness property.

---

## Appendix — Contract sketch

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Monthly meetup raffle. No owner, no pause, no upgrade, no setters.
/// Every function is permissionless. All deadlines are fixed at deploy.
contract MeetupRaffle {
    uint256 public constant PRIZE      = 5 ether;
    uint256 public constant SEED_DELAY = 5;     // blocks between lockSeed() and seedBlock
    address constant HISTORY = 0x0000F90827F1C53a10cb7A02335B175320002935; // EIP-2935

    uint256 public immutable entryClose;   // Fri 20:00:00 UTC
    uint256 public immutable revealClose;  // Fri 20:20:00 UTC
    address public immutable treasury;

    address[] public entrants;
    mapping(address => bytes32) public commitmentOf;
    mapping(address => bool)    public revealedBy;
    mapping(address => uint256) public owed;

    bytes32 public accumulator;
    uint256 public seedBlock;
    address public winner;

    error TooLate(); error TooEarly(); error BadSecret(); error SeedExpired();

    constructor(uint256 _entryClose, uint256 _revealClose, address _treasury) {
        entryClose = _entryClose; revealClose = _revealClose; treasury = _treasury;
    }

    receive() external payable {}   // treasury funds the prize

    // --- entry week -------------------------------------------------------
    function enter(bytes32 commitment) external {
        if (block.timestamp >= entryClose) revert TooLate();
        require(address(this).balance >= PRIZE, "not funded");
        require(commitmentOf[msg.sender] == bytes32(0), "already entered");
        require(commitment != bytes32(0), "empty commitment");
        commitmentOf[msg.sender] = commitment;
        entrants.push(msg.sender);
    }

    // --- 20:00-20:20, sent by each entrant --------------------------------
    function reveal(bytes32 secret) external {
        if (block.timestamp < entryClose)   revert TooEarly();
        if (block.timestamp >= revealClose) revert TooLate();
        if (revealedBy[msg.sender]) revert BadSecret();
        if (keccak256(abi.encode(secret, msg.sender)) != commitmentOf[msg.sender])
            revert BadSecret();
        revealedBy[msg.sender] = true;
        accumulator = keccak256(abi.encodePacked(accumulator, secret));
    }

    // --- 20:20+, anyone ---------------------------------------------------
    function lockSeed() external {
        if (block.timestamp < revealClose) revert TooEarly();
        require(seedBlock == 0 && winner == address(0), "already locked");
        require(entrants.length > 0, "no entrants");
        seedBlock = block.number + SEED_DELAY;
    }

    /// Only callable once the committed seed is genuinely unreadable, so this
    /// can never be used to re-roll a result somebody dislikes.
    function relock() external {
        require(seedBlock != 0 && winner == address(0), "nothing to relock");
        require(block.number > seedBlock && _blockHash(seedBlock) == bytes32(0),
                "seed still readable");
        seedBlock = block.number + SEED_DELAY;
    }

    // --- ~20:21, anyone. Pays the winner in this same transaction. --------
    function draw() external {
        require(seedBlock != 0 && winner == address(0), "not ready");
        if (block.number <= seedBlock) revert TooEarly();
        bytes32 bh = _blockHash(seedBlock);
        if (bh == bytes32(0)) revert SeedExpired();      // -> relock()

        uint256 seed = uint256(keccak256(abi.encodePacked(accumulator, bh)));
        address w = entrants[seed % entrants.length];
        winner = w;                                       // effects before interaction

        (bool ok, ) = w.call{value: PRIZE}("");
        if (!ok) owed[w] = PRIZE;                         // contract winner -> pull
    }

    function claim() external {
        uint256 amt = owed[msg.sender];
        require(amt > 0, "nothing owed");
        owed[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amt}(""); require(ok, "transfer failed");
    }

    /// Only if literally nobody entered.
    function reclaim() external {
        require(block.timestamp > entryClose + 30 days && entrants.length == 0, "no");
        (bool ok, ) = treasury.call{value: address(this).balance}(""); require(ok, "x");
    }

    function _blockHash(uint256 n) internal view returns (bytes32) {
        if (block.number - n <= 256) return blockhash(n);
        (bool ok, bytes memory d) = HISTORY.staticcall(abi.encode(n));
        return (ok && d.length == 32) ? abi.decode(d, (bytes32)) : bytes32(0);
    }

    function entrantCount() external view returns (uint256) { return entrants.length; }
}
```

Want to build one of these end to end? https://speedrunethereum.com

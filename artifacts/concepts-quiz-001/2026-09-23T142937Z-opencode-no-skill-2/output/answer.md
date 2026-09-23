# Giving away 5 ETH on stage — the full runbook

## The design, and why

We can't use a randomness oracle or beacon (paid third-party provider; treasury holds ETH
only), we can't let a person or the contract owner pick (that is exactly the influence we're
removing), and we can't use `block.timestamp` or a lone `blockhash` (whoever proposes the
block steers those). The design that fits every constraint is a **commit–reveal raffle
sealed by pre-committed block hashes**:

- During entry week each entrant locks a hash of a self-chosen secret. Hashes leak nothing,
  so before entries close nobody — organizers included — can predict or steer anything.
- After entries close, everyone reveals their secret on stage. Commits bind: nobody can
  change their secret, and reveal order is irrelevant (the seeds are combined by XOR).
- The final seed mixes all revealed secrets with the hashes of three future blocks that are
  only committed *after* the last reveal deadline. Until those blocks are mined, nobody in
  the room — not even the last person to reveal, not even with everyone else's secret in
  hand — can compute the winner, and nobody can aim a withheld reveal at a known
  alternative outcome.
- Winner selection is a pure function of public onchain state and the payout is automatic.
  The contract has no owner, no upgrade path, and no admin function of any kind after
  deployment.

```
seed   = secret_1 ^ secret_2 ^ ... ^ secret_n
       ^ uint256(blockhash(B)) ^ uint256(blockhash(B+2)) ^ uint256(blockhash(B+4))
winner = revealedEntrants[seed % revealedEntrants.length]     // in entry order
```

Spreading the hash blocks across three proposers means no single block proposer can steer
the seed; they'd also have to invert the XOR of participant secrets, which they can't.

## What has to be in place beforehand

**1. The contract, deployed and funded before the entry window opens.**
- Treasury's only transaction of the week: deploy with the 5 ETH prize already in the
  contract (or fund it immediately).
- Source verified on the block explorer, non-upgradeable, **zero owner/admin functions**.
- Hardcoded constants: entry close = Friday 20:00:00 UTC; reveal deadline = 20:10:00 UTC;
  deposit amount (suggested 0.05 ETH); prize = 5 ETH; treasury address (only for the void
  case below); entries restricted to plain EOAs (so the winner payout can't brick on a
  contract wallet).

Contract surface (every function callable by its natural sender, no special roles):

| Function | Sender | Guard |
|---|---|---|
| `enter(bytes32 commit)` | each entrant, own wallet | week before Friday 20:00 UTC; one entry per address; EOA only; deposit attached |
| `reveal(bytes32 secret)` | same wallet that entered | 20:00–20:10 UTC only; `keccak256(secret, msg.sender)` must match stored commit |
| `startDraw()` | anyone | first block with timestamp ≥ 20:10 UTC; once; records B = its own block number, locks hash blocks B, B+2, B+4 |
| `draw()` | anyone | block B+5 through B+255 (~50 min on a 12s chain); once; pays out |
| `refund()` | anyone | only if **zero** entrants revealed; returns deposits + prize to treasury |

**2. Published entry instructions** (posted with the contract address):
- Pick 32 random bytes locally with a proper random generator — not a password, not
  anything typed into a website.
- `commit = keccak256(secret, yourAddress)`; send `enter(commit)` with the deposit.
- Binding the address into the commit is what stops reveal-copying and reveals from the
  wrong wallet.
- Keep the secret offline and bring it — and the wallet you entered with — on Friday.
- Honest players get the deposit back inside their own reveal transaction, so playing
  straight costs only gas.

**3. Each entrant brings on the night:** the wallet they entered with, a little gas ETH,
the secret.

**4. On stage (optional but recommended):** a projector showing the contract's explorer
page so the room watches the reveals land, and a nominated person to send the two draw
transactions. The design treats that person as a convenience, never a dependency.

## The exact sequence — entries closing to prize in wallet (Friday, UTC)

| # | Call | Who sends it | Window | What happens onchain |
|---|---|---|---|---|
| 0 | (context) `enter(commit)` | each entrant | entry week → 20:00:00 | commit + 0.05 ETH deposit recorded; contract rejects anything later |
| 1 | `reveal(secret)` | **each entrant, from the same wallet** | **20:00:00 → 20:10:00** | commit verified, deposit returned, secret XOR-folded into the running seed |
| 2 | `startDraw()` | **anyone in the room** (organizer by convention) | **first block ≥ 20:10:00** — no upper limit | hash blocks B, B+2, B+4 locked in state, visible to everyone |
| 3 | `draw()` | **anyone in the room** | **block B+5 → B+255** (on stage: ~1 minute after step 2; hard limit ~50 min) | seed computed, winner picked, **5 ETH + any forfeited deposits pushed to the winner's wallet in this same transaction** |

Timeline on the night: entries stop being mined at 20:00:00; reveals stream in until
20:10:00; `startDraw()` goes in at ~20:10, B+4 is mined ~50 seconds later; `draw()` lands
at ~20:11 and the prize is in the winner's wallet in that block.

Nobody has a privileged transaction. The winner does nothing — the ETH is pushed to them.
Losers do nothing. The organizers send at most two transactions that any attendee could
send instead.

## Why nobody — us included — can influence or foresee it

- Before 20:00 only hashes are public, and reveals are rejected until after the close, so a
  late committer can't steer the seed even by watching others.
- Secrets are bound by commits; XOR is order-independent, so reveal sequence confers no
  advantage.
- The one move left to a would-be saboteur is *withholding* their reveal. That decision must
  happen by 20:10 — before the hash blocks exist — so it's a blind re-roll: they can't know
  any alternative outcome, they've removed themselves from winning, and their deposit goes
  to whoever does win. Omission is priced spite, nothing more.
- The only theoretical influence anywhere in the system is block-proposer grinding, which is
  not the organizers' hand: it would require corrupting three randomly assigned proposers
  and brute-force re-sealing three blocks, and it still can't target a chosen entrant
  without inverting the XOR'd secrets. For 5 ETH this is not a credible attack, and no
  action of ours can improve it.
- Organizer sybils/multiple entries buy odds publicly at deposit cost, exactly like any
  entrant. That's playing, not rigging.
- Deposits forfeited by no-shows are paid **to the winner, not to the treasury** — so we
  never profit from a forfeit and have no incentive to engineer one.

## Why a losing entrant can't build a rigging case

Everything that determined the outcome is onchain: every commit (with timestamps), every
reveal, the locked hash blocks, the exact formula, and the payout. Selection is a pure
function of that state, the source is verified, and the contract is non-upgradeable with no
admin path — so it is publicly provable that after funding it we had exactly the same
powers as any entrant: none. A loser can recompute the seed and winner from the explorer in
a few minutes; publish a short "verify the draw" recipe next to the contract so they don't
even have to read Solidity. The strongest complaint they can make is about Ethereum's block
proposers, and that's an argument against the chain, not against this draw.

## If someone doesn't do their part in time

- **An entrant misses the 20:10 reveal** (no-show, lost secret, or malice): their entry is
  dropped, their 0.05 ETH deposit is forfeited to the prize pot, and the draw proceeds with
  everyone who did reveal. The evening is not blocked, and the contract handles it
  automatically inside `draw()` — no re-run, no organizer decision. This is exactly the case
  the deposit exists for, including the person who entered Tuesday and never came Friday.
- **Nobody reveals at all** (or nobody entered): `draw()` is impossible, so the contract
  exposes `refund()`, callable by anyone after 20:10, which returns all deposits and the
  5 ETH to the treasury. Nothing is ever stranded.
- **Nobody sends `startDraw()` or `draw()` on the night:** there is no deadline for either —
  the only hard deadline in the whole system is the reveal deadline, because that's the one
  that seals the inputs. The room can finalize the raffle from home the next day with
  identical guarantees. If `startDraw()` ran but `draw()` didn't land within the ~50-minute
  hash-lookback window, the contract lets anyone call `startDraw()` again for fresh hash
  blocks; re-arming has the same unbiasedness as the original, so it can't be abused.
- **The organizers no-show:** irrelevant. The funds are already in the contract and there
  are no privileged transactions for us to skip. Every step after deployment is
  permissionless.
- **Someone tries to cheat instead of comply:** entering after 20:00 (rejected by the
  timestamp guard), entering twice from one wallet (rejected), revealing early or from the
  wrong wallet (window guard / commit mismatch), copying another entrant's reveal (commit
  binds the address), withholding a reveal (blind, self-excluding, and costs the deposit),
  grinding the draw (requires proposing the locked blocks and can't invert the participant
  secrets — see above).

In short: the only person whose participation is essential is each entrant's own — and if
they fail, the contract's answer is automatic and pre-committed: forfeit the deposit to the
winner and continue without them.
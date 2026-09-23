# 5 ETH Meetup Raffle — The Evening, End to End

## The design in one paragraph

Your treasury holds ETH only and there's no budget for a paid randomness provider, so **Chainlink VRF is out**. The onchain shortcuts are out too: `block.timestamp` can be nudged by validators, `blockhash(block.number)` is always zero, and a seed from a recent blockhash alone can be ground or withheld by the proposer of that block. What's left — and what fits a room full of people perfectly — is **commit–reveal**: the entrants themselves supply the randomness, hashed before entries close, revealed after. The seed is:

```
seed = keccak256( (secret₁ ‖ salt₁) ‖ (secret₂ ‖ salt₂) ‖ … )   // every revealed entry, in entry order
winner = entry[ seed mod (number of revealed entries) ]
```

Nobody can foresee the winner, because nobody knows all the secrets — not you, not a cabal, and each entrant knows only their own. Nobody can influence it: secrets are locked by their commitments, and the moment the last reveal lands, the winner is simultaneously determined and public — too late to change anything. A losing entrant can recompute the entire result from chain data. The design deliberately uses **no block data at all**, which also removes the classic trap where `blockhash` becomes unavailable after 256 blocks (~51 minutes) and your draw dies if the evening runs long.

---

## What must be in place beforehand

1. **The contract, deployed and funded before the entry week opens.** It holds the 5 ETH from day one. It must be deployed with — and never able to change — the entry deadline (Friday 20:00:00 UTC), the reveal deadline (Friday 20:15:00 UTC), and the deposit size.
2. **No owner powers.** No pause on the draw, no `setWinner`, no upgrade, no way for you to touch the prize. The credible "it wasn't rigged" case *is* the absence of an admin key — anyone auditing sees you had no move to make.
3. **Verified source.** Publish and verify the contract (Etherscan etc.) so any entrant can read the exact rules and seed formula.
4. **An entry path for the room.** A simple frontend (or documented steps) where each entrant generates a `secret` + `salt` locally, submits `keccak256(secret, salt)` as their commitment, and — critically — **keeps the secret**. They need it Friday night. Losing the secret = losing the entry.
5. **A small entry deposit** (e.g. 0.01 ETH) with every entry. This is the contract's only stick: it's what makes skipping your reveal cost something, which matters for the one attack left in commit–reveal (see failure modes).
6. **A dry run on a testnet** with a handful of wallets, a few days before.

During the week, entering is the only thing anyone does: each entrant sends `enter(commitment)` plus the deposit, whenever they like. No one — including you — can add, remove, or reorder entrants; the list is exactly what's onchain at 20:00.

---

## The exact sequence: entries close → prize in wallet

| # | Step | Who sends it | Window |
|---|------|--------------|--------|
| 0 | **Entries close** | *No one.* | 20:00:00 UTC |
| 1 | **Reveal** — one tx per entrant: `reveal(secret, salt)` | Each entrant, from their entering wallet | 20:00 → 20:15 UTC |
| 2 | **Draw** — `draw()` computes the seed, stores the winner | Anyone. On the night: the MC, on stage, on the projector | Any time after 20:15 — no expiry |
| 3 | **Claim** — `claim()` pays out | Anyone; the 5 ETH goes to the stored winner regardless of caller. Practically the winner taps it on stage | Any time after the draw — no expiry |
| 4 | **Deposit returns** — `withdrawDeposit()` | Each losing entrant who revealed | Any time after the draw — no expiry |

**Step 0 — closing takes no transaction.** There is no scheduler that "closes" the raffle; the deadline is a gate inside `enter()`, which simply starts rejecting late entries at 20:00. The contract sits there doing nothing until someone pokes it — that's normal, and it's why every *action* below needs a named caller.

**Step 1 — reveals.** Each entrant reveals their own secret; the contract checks `keccak256(secret, salt)` against the stored commitment and reverts on any mismatch, so nobody can reveal a fake. Why they bother: an unrevealed entry is void. With a room of entrants this takes as long as it takes people to open a laptop — hence a 15-minute window, not 3.

**Step 2 — the draw.** `draw()` is permissionless: it iterates the *revealed* entries in entry order, hashes their secrets into the seed, picks `seed mod count`, and stores the winner. It's one transaction, deterministic, and identical no matter who sends it — front-running it gains nothing. On stage, this is the showstopper: the winner becomes known to everyone at the same block it becomes final. The MC pays a few dollars of gas, but if their laptop dies, the winner — the most motivated person alive — sends it themselves.

**Step 3 — the payout.** Deliberately a pull: `draw()` irrevocably fixes the winner; `claim()` moves the money. The winner receives 5 ETH **plus every deposit forfeited by non-revealers**. On stage, the wallet balance updates while people watch. Separating draw from claim means a noisy contract-wallet winner or a fumbled gas tank can't break the draw itself.

---

## What happens when someone misses their part

**Entrant doesn't reveal by 20:15.** Their entry is void — `draw()` only counts revealed entries, so there's no judgment call and nothing they can hold hostage. Their 0.01 ETH deposit is forfeited to the winner's payout, and the reveal is visible forever onchain as the reason. No one else's night is affected; the seed still draws on everyone else's secrets. (This is also the honest caveat of commit–reveal: the *last* person to reveal, knowing all other secrets, could compute both possible outcomes and decline to reveal if they prefer the other one — a bounded, one-bit bias. The deposit is the counterweight: withholding costs the deposit and their own entry, and it's publicly visible afterward. Size it so it's not worth trying.)

**Entrant lost their secret or their wallet.** Same as not revealing. The commitment can't be brute-forced (that's what the salt guarantees), so there is no recovery path — tell entrants this upfront.

**Nobody calls `draw()` on the night.** Nothing breaks. Because the seed uses no block data, there's no 256-block timer ticking; the contract sits in the revealed state indefinitely, and anyone can run the draw Saturday morning. The 5 ETH sitting in the contract is all the incentive anyone needs — this is exactly why the draw is permissionless rather than an operator function.

**Winner never claims.** The payout waits in the contract, claimable by the winner at any block height, forever. If you want a backstop, bake in an optional expiry that sweeps an unclaimed prize into next month's pot — decide this before deployment, not after.

**Zero entrants, or zero reveals.** The draw reverts. Bake in a degenerate-case rule before deployment: after a grace period, anyone can trigger refunds — deposits back to entrants, prize back to the treasury address (hardcoded). This should never fire with a real room; it exists so the contract can't become a deposit trap.

**You (the organizers) do nothing / disappear.** Everything above still works. That's the test the design passes: entry, reveal, draw, claim, refunds are all self-interested and permissionless, and the only parties with a deadline — entrants — are punished by code alone, not by you.
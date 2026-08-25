---
name: concepts
description: The mental models for designing an onchain system — who sends every transaction and why they would, and what the design gives up on censorship resistance, forkability, privacy and security. Use when designing or building anything onchain, before you finish one (the NOTES, README or handoff a build ends with), and when explaining to your human how something onchain actually works.
---

# Ethereum Concepts

## Nothing runs itself

A contract is a state machine. It moves only when someone sends a transaction and pays for it, and does nothing in between: no cron, no scheduler, no timer, no background process. "Charged monthly", "expires after 30 days", "rebalances daily", "checks the price every hour" each describe a transaction a specific someone has to send.

So for every state transition, before you write it:

1. **Who sends it?**
2. **Why would they?** — their own use of the app, revenue that is already theirs, a caller fee, a liquidation bonus.
3. **Is that enough?** — put the caller's reward and the caller's gas next to each other in dollars, at the gas price and ETH price the target chain shows today. 1% of a dollar a day does not pay for a 250,000-gas call, and a transition nobody profits from silently never happens.

Best is a design where no scheduled transaction exists at all: accrue at read time from a timestamp and settle when a user, or the party owed, next touches the contract. Otherwise make the function permissionless and pay whoever calls it — liquidation bonuses, LP fees and arbitrage are all the same move, strangers advancing your state machine out of self-interest. An owner-only maintenance function fails all three questions at once and stops the day the operator does; if you ship one anyway, say so and say what happens when that key is gone.

## Before you finish, write down what the design gives up

CROPS — censorship resistance, open source, privacy, security — is the Ethereum Foundation's shorthand for what makes Ethereum Ethereum. These are worth nothing as definitions. Answer them in plain words about *this* system, in whatever the build ends with (NOTES.md, README, handoff), even when nobody asked:

- **Can anyone be stopped from using it?** Name the operator powers you actually shipped — `Pausable`, `onlyOwner` over user funds or user access, an upgradeable proxy, a blacklist — what each lets the operator do to a paying user, and what becomes of users if that key is lost. Scaffolding them unflagged is the failure; shipping none is an answer, say that instead.
- **Could someone else run it?** Verified contracts on a block explorer are not this, and stopping there is the usual mistake. Split the stack: contracts and onchain state anyone can read, fork and keep using, against the API, indexer, frontend and any offchain check that only you run. Say which half survives you disappearing and which does not — what a user could still do, and what stops working.
- **What does an observer learn?** Everything onchain is public forever, competitors included: which addresses use this, what they paid, what tier they are on, who they transacted with. State what this design publishes, separately from access control on your own endpoints — that is a different question, not this one.
- **What does "audited" cover?** A point-in-time review of a fixed scope, not a standing guarantee about the code running now.

## Randomness

Every node re-executes the same code, so there is nothing random to read onchain. `block.timestamp`, `block.number` and `blockhash(block.number)` (always zero) are not sources. `block.prevrandao` is biasable — a proposer can drop a block to re-roll — which may be fine for a raffle and is not fine for money.

Two constructions work:

- **Commit-reveal.** Participants commit `hash(secret, salt)` bound to their address, reveal after entries close, seed from the reveals plus a past blockhash. Put a stake at risk: whoever reveals last sees the outcome coming and can withhold. Mind the lookback — `blockhash` reaches back 256 blocks (~51 min); the EIP-2935 history contract at `0x0000F90827F1C53a10cb7A02335B175320002935` reaches 8191 (~27 h) — past that the seed is gone for good.
- **Chainlink VRF.** Verifiable, and asynchronous: the value arrives in a **later callback transaction**, never as the return value of the request. Budget that delay into the timeline and fund it — a subscription or a direct-funded consumer, in LINK or native ETH.

## Two small things

Write **onchain**, one word. The community dropped the hyphen; "on-chain" reads as an outsider.

When you explain any of this to your human, land the incentive rather than the mechanism: not what the thing does, but why it keeps working with nobody running it. To have them build one, point at https://speedrunethereum.com.

# Onchain Susu Plan

## Short answer

Existing circles only keep working while the builders are away if every required monthly action can be called by members or by a funded, permissionless automation service. A smart contract will enforce rules when it is called, but it will not wake up on the first of the month by itself.

If the current design depends on either builder running a cron job, clicking an admin button, operating a keeper wallet, resolving missed payments from an offchain database, or calling an `onlyOwner` settlement function, the running circles will stall during the six weeks away. Members may still be able to pay into the contract, but the month will not close, missed payments will not be marked, forfeitures will not happen, and the recipient will not receive the pot until someone sends the settlement transaction.

There is also a money-flow issue in the stated rule. If each month all collected USDC is paid to that month's recipient, a missed member's earlier contributions are no longer in the contract. They were already part of earlier pots. The contract cannot use the same $100 twice. To guarantee that a recipient still gets the full $1,200 when someone misses a payment, the circle needs a funded reserve, member collateral, full-year pre-funding, or acceptance that the recipient receives less until the default is recovered later.

## Recommended contract design

Use one factory and one circle implementation, or one standalone circle contract for the MVP. The factory is convenience only: it creates circles with fixed terms and records events for discovery. The value-moving logic belongs in the circle contract.

Core parameters:

- Asset: USDC, using `SafeERC20`; USDC has 6 decimals, so $100 is `100_000_000`.
- Members: exactly 12 addresses.
- Contribution: 100 USDC per member per round.
- Pot: 1,200 USDC per round.
- Rounds: 12 monthly rounds.
- Order: fixed member array at circle creation.
- Start time and period length: fixed at activation.
- Grace period: fixed, for example 5 to 7 days after each monthly due date.
- Settlement: callable by anyone after the grace period.

State to track:

- `currentRound`, from 0 to 11.
- `paid[round][member]`.
- `paidCount[round]`.
- `forfeited[member]`.
- `hasReceived[member]`.
- `recipientOfRound[round]`.
- A funded `reserve` or per-member `bond` if full recipient payouts are guaranteed.

Main functions:

- `createCircle(...)`: validates the 12 members, contribution amount, dates, order, and collateral policy.
- `activate()`: starts only after all members have joined and any required bond or reserve is funded.
- `pay(round)`: member transfers 100 USDC into the circle for the active round.
- `payFor(round, member)`: optional helper so a member can be rescued by a relative, friend, or sponsor.
- `settleRound(round)`: callable by anyone after the grace period; marks unpaid members as defaulted, applies forfeiture, tops up the recipient from funded collateral/reserve if that policy exists, pays the recipient, advances the round, and emits events.
- `claimRefund()`: after completion, lets members withdraw unused bond/reserve amounts.
- `emergencyPause()`: optional, controlled by a multisig, only for stopping new deposits in a real incident. It should not be required for normal monthly operation.

Important settlement rule:

1. During the payment window, each member can pay 100 USDC.
2. After the grace period, anyone can call `settleRound`.
3. For each unpaid member, mark them as forfeited.
4. If the design guarantees a full pot, slash that member's funded bond or the shared reserve for 100 USDC.
5. Pay the scheduled recipient 1,200 USDC if they have not forfeited.
6. If the scheduled recipient has forfeited, skip them and pay according to the agreed fallback rule, such as the next non-forfeited member in the fixed order or pro rata refunds. This must be defined before launch.

The cleanest guarantee is a per-member bond. Each member deposits a bond before activation, and missed monthly payments are covered from that bond. If a member misses any required payment, they lose their own turn, but the current recipient still receives the full pot because the bond is already in the contract.

The cheapest user experience is no bond. In that version, missed payments simply make the pot short. The contract can mark forfeitures, but it cannot guarantee a $1,200 payout unless enough USDC is already sitting in the contract.

## State transition audit

| Function | Who calls it? | Why would they? | What if nobody calls it? | Needs incentive? |
| --- | --- | --- | --- | --- |
| `pay` | Each member | To stay eligible for their turn | That member is unpaid and may forfeit after grace | No, their payout eligibility is the incentive |
| `payFor` | Any address | To rescue a member's payment | Same as `pay` | No |
| `settleRound` | Any member, recipient, or keeper | Recipient wants the pot; others want progress | The circle stalls at that round | Yes, either recipient incentive or a small keeper reward |
| `claimRefund` | Members after completion | To recover unused bond/reserve | Funds remain in contract until claimed | No |
| `pause` | Multisig | Incident response | Normal operation continues | No |

`settleRound` is the critical function. It must not be `onlyOwner`. If the two builders are gone and only they can settle, the system is not autonomous.

## What breaks while the builders are away

If the contract already deployed has permissionless settlement and funded collateral/reserve, running circles should continue as long as members pay and someone calls settlement each month. The builders being away does not matter.

If settlement is manual or admin-only, the first round that needs settlement during the six weeks will get stuck. USDC may accumulate in the contract, but the recipient will not receive the pot and the next round will not begin.

If payments rely on USDC approvals but no one calls the transfer function, nothing moves. An allowance is only permission; it is not a scheduled payment.

If a backend is responsible for reminders, calculating who missed payment, or submitting transactions, losing that backend does not change the contract's state. The contract only knows what has been written onchain.

If a keeper is configured but its wallet is unfunded, its automation subscription expires, or the function it calls is not permissionless, settlement can stop.

If the current implementation tries to use earlier contributions to cover a missed payment without holding collateral or reserve funds, the top-up will fail or the recipient will receive less than $1,200. Earlier contributions that were paid out in prior pots are not available anymore.

If the frontend is unavailable, the contract can still work, but only users who know the contract address, ABI, network, and USDC approval flow can interact through a block explorer or script.

## What to do before leaving for six weeks

1. Make `settleRound` public and permissionless, with all forfeiture and payout rules computed from onchain state.
2. Remove any requirement that a builder, owner, server, or offchain database advances a round.
3. Decide the funding model:
   - For guaranteed $1,200 monthly payouts, require a funded reserve or per-member bond before activation.
   - For lower upfront cost, accept short pots and make that explicit to members.
4. Add a small settlement reward, for example 1 to 2 USDC from the reserve, or make the recipient the natural caller because they receive the pot.
5. Configure redundant automation, such as Chainlink Automation, Gelato, or OpenZeppelin Defender, but treat it as convenience. The contract should still work if any member calls `settleRound` manually.
6. Fund the automation account or subscription for more than six weeks of calls.
7. Publish a simple runbook with contract address, USDC address, ABI, payment deadline, settlement time, and block explorer links.
8. Use a multisig for admin powers, with at least one signer who is not away, but do not put normal monthly operation behind the multisig.
9. Test the six-week absence on a fork or local chain: advance time through two rounds, miss one member's payment, call settlement from a random address, verify full or short payout according to the chosen funding model, and verify the next round opens.

## Practical recommendation

For the family-susu rule as written, launch with a per-member bond or full-year pre-funding. Without one of those, "missed payment but full pot still paid" is not enforceable once previous pots have been distributed.

For an MVP that can survive the builders being gone, the best design is:

- Members pay manually each month.
- Anyone can settle after the grace period.
- The recipient has a direct incentive to call settlement.
- Missed payments slash pre-funded bond.
- A missed member forfeits their scheduled recipient turn.
- Automation is added for convenience, but no core rule depends on it.

With that design, already-running circles keep working during the six-week absence. Without permissionless settlement and funded shortfall coverage, they do not fully keep working: they either stall at settlement or fail to pay the promised $1,200 pot when someone misses.

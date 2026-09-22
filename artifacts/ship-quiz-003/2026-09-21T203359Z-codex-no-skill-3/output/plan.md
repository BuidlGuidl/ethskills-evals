# Onchain susu contract plan

## Goal

Build a twelve-member USDC savings circle where:

- exactly 12 members participate;
- each member contributes 100 USDC per month;
- one member receives the pot each month;
- the payout order is fixed before the circle starts;
- each member gets at most one turn;
- a member who misses a payment forfeits their own future payout turn;
- missed payments are covered from that member's escrowed earlier contributions, so the current recipient still receives the full 1,200 USDC pot when possible.

The key design constraint is that "earlier contributions cover the shortfall" only works if the contract still holds those earlier contributions. A naive ROSCA that immediately sends every month's incoming money to the recipient has no funds left to seize later when a member misses a payment.

## Contract design

Use a `SusuFactory` plus one `SusuCircle` contract per circle.

### Factory

`SusuFactory` creates circles and records their addresses.

Constructor/config:

- `IERC20 usdc`
- allowed circle implementation, if using clones

`createCircle(...)` inputs:

- `members[12]`
- `payoutOrder[12]`
- `contributionAmount`, fixed at `100e6` for USDC unless we want configurable amounts
- `periodLength`, ideally `30 days` or calendar-month based offchain display with onchain fixed seconds
- `firstPeriodStart`
- `paymentDeadline`, for example `7 days` after each period starts
- optional `metadataURI`

Validation:

- exactly 12 unique members;
- payout order contains the same 12 unique members;
- no zero addresses;
- `firstPeriodStart` is in the future;
- amount and period settings are sane.

### Circle state

Each `SusuCircle` should be fully autonomous after deployment.

Core immutable data:

- `USDC`
- `members`
- `payoutOrder`
- `contributionAmount = 100e6`
- `memberCount = 12`
- `periodCount = 12`
- `periodLength`
- `firstPeriodStart`
- `paymentDeadline`

Core mutable state:

- `currentPeriod`, 0 through 11
- `paid[period][member]`
- `forfeited[member]`
- `turnPaid[member]`
- `escrowBalance[member]`
- `periodSettled[period]`
- `recipientPaid[period]`

Events:

- `CircleCreated`
- `ContributionPaid(member, period, amount)`
- `MemberForfeited(member, period)`
- `PeriodSettled(period, recipient, paidFromCurrentContributions, paidFromEscrow)`
- `TurnSkipped(period, forfeitedRecipient)`
- `CircleCompleted`

### Funding model

To make recipients whole without relying on the two builders, the contract needs real escrow or reserve liquidity. Accounting entries are not enough.

Recommended model:

1. Every member posts a security bond before activation.
2. Every member still pays `100 USDC` each month.
3. Monthly payments are used for the current recipient's pot.
4. If a member misses a payment, the contract marks them forfeited and uses that member's bond/reserve balance to cover the current month's shortfall.
5. A forfeited member never receives their own pot. When their turn arrives, the contract skips that payout and uses that period to rebuild reserves, pay recorded shortfalls, or refund remaining solvent members according to the accounting rules.

There is a practical implication: the first month has no earlier monthly contributions to seize. If somebody misses the very first payment, there is no prior monthly contribution from that member. The contract can only keep the first recipient whole if one of these is true:

- each member posts an upfront security deposit before the circle starts;
- each member prepays the first month before the circle starts and the first period only begins once all 12 have paid;
- the first recipient accepts shortfall risk;
- an external sponsor/organizer funds a reserve.

I recommend requiring an upfront security deposit before activation. A `100 USDC` bond covers one missed monthly payment. It does not cover a member who misses once, forfeits, and then stops paying for the rest of the year.

For an exact "recipient always gets 1,200 USDC" guarantee, the contract needs one of these stronger solvency models:

- full prefunding: each member deposits all 12 monthly payments up front;
- full liability bond: each member posts a bond large enough to cover all of their remaining unpaid months;
- rolling reserve: each member stays at least N months prepaid, and the product only guarantees N months of protection;
- external reserve: the organizer funds enough USDC to bridge defaults until skipped turns replenish the reserve.

Without one of those, the honest statement is: the contract can forfeit the missed payer's turn, but it cannot always keep every interim recipient whole.

### Lifecycle

1. `joinAndBond()`

   Each member approves USDC and deposits the required security bond before the circle starts. Only listed members can call this.

2. `activate()`

   Permissionless once all 12 members have bonded and `block.timestamp >= firstPeriodStart`. This locks membership and starts period 0.

3. `payContribution(period)`

   A member pays `100 USDC` for the active period before its deadline. The function should reject duplicate payments and payments for the wrong period unless we intentionally allow prepayment.

4. `settlePeriod(period)`

   Permissionless. Anyone can call it after the period payment deadline.

   Settlement should:

   - identify unpaid members;
   - mark unpaid members as forfeited if they are not already forfeited;
   - pull the missing amount from each unpaid member's bond/escrow if available;
   - pay the scheduled recipient `1,200 USDC` if the recipient has not forfeited;
   - skip the payout if the scheduled recipient has forfeited;
   - advance to the next period.

5. `claimRefund()`

   After the 12th period is settled, members can claim any remaining refundable escrow. Forfeited members only receive whatever the rules leave after covering their missed obligations.

### Payout rules

The contract should never depend on owner judgment to decide whether someone is late or whether a turn is skipped. All of that should be mechanical.

For each period:

- owed amount is `12 * 100 USDC = 1,200 USDC`;
- collected amount is the sum of on-time monthly payments;
- shortfall is covered by slashing escrow from members who missed payment;
- if the scheduled recipient is active, pay them the full pot if the contract balance can support it;
- if the scheduled recipient is forfeited, skip their turn and keep the funds in the contract as reserve/refundable surplus;
- if escrow is insufficient, pay either pro rata or block settlement until a reserve is topped up.

I recommend blocking settlement on insufficient funds only if there is an explicit `topUpReserve()` path and the members understand that a top-up may be required. Otherwise one default can freeze the circle. A more resilient design is:

- pay the recipient all available funds up to `1,200 USDC`;
- record `recipientShortfall[period]`;
- allow anyone to later `topUpAndCure(period)`;
- make the shortfall visible in events and views.

That said, if the product promise is "recipient gets exactly 1,200 USDC," the contract must require enough bond/reserve before activation.

The core solvency invariant should be:

`availableUSDC + committedFutureReserve >= guaranteedPayoutsBeforeNextSkippedTurn`.

If the contract cannot prove that invariant from funds it controls, it should not advertise guaranteed full pots.

### Automation

No privileged cron should be required.

The important functions must be permissionless:

- `activate()`
- `settlePeriod(period)`
- `skipExpiredPeriod()` if separate from settlement
- `claimRefund()`

The frontend can call these, members can call them, and a keeper can call them, but the circle should not depend on a builder wallet being online.

If using Chainlink Automation, Gelato, OpenZeppelin Defender, or a custom bot, treat that as convenience only. The contract still needs a public manual path so circles can be progressed by any member while the builders are away.

### Admin powers

Keep admin powers narrow.

Good admin powers before activation:

- cancel a circle that has not activated;
- update metadata URI;
- recover mistaken non-USDC tokens.

Avoid admin powers after activation:

- changing payout order;
- forgiving missed payments;
- manually marking members paid;
- manually sending the pot;
- pausing settlement indefinitely.

If a pause exists for emergencies, it should be time-limited or controlled by a multisig with a documented runbook, because an indefinite pause means the circle does not actually run without the builders.

## Do already running circles keep working while we are gone?

They keep working only if the deployed contracts already have all of these properties:

- monthly contribution payment is callable by members directly;
- period settlement is permissionless, not owner-only;
- missed-payment forfeiture is calculated from timestamps and stored state, not from a manual admin action;
- payout/skip logic is in the contract, not in an offchain script controlled by the two builders;
- the contract holds enough escrow/reserve to cover missed payments;
- the USDC allowance/payment UX does not require a builder to relay transactions;
- there is no active pause or admin-controlled switch that must be touched during the six weeks.

If those are true, running circles should continue. Members will still need to submit their monthly USDC payments, and someone will need to call settlement after each deadline, but that "someone" can be any member or keeper. The builders do not need to be online.

If any of those are false, here is what breaks.

### Breakage: settlement is owner-only or bot-only

What happens:

- members can pay, but the month never closes;
- recipients do not receive the pot;
- the circle gets stuck at the first period that needs a builder-owned call.

What to do:

- deploy a new implementation where settlement is permissionless;
- if the existing contract is upgradeable, upgrade before leaving;
- if not upgradeable, give a reliable multisig/operations wallet the needed role and write a runbook;
- as a fallback, schedule a keeper transaction service before leaving.

### Breakage: forfeiture is manual

What happens:

- a missed payer is not automatically marked forfeited;
- their future turn may still be paid incorrectly;
- the current recipient may receive less than expected or wait for human intervention.

What to do:

- move forfeiture into deterministic settlement logic;
- use `block.timestamp > periodStart + paymentDeadline` as the only lateness test;
- emit forfeiture events so the frontend can explain the state.

### Breakage: earlier contributions were already paid out

What happens:

- the contract cannot cover a missed payment from that member's earlier contributions because it no longer has them;
- the current recipient gets a short pot, settlement reverts, or the builders must inject USDC.

What to do:

- require an upfront bond/reserve for every active member;
- or redesign accounting so enough contributions remain escrowed until obligations are satisfied;
- for circles already running without reserves, calculate the maximum uncovered shortfall over the next six weeks and pre-fund the contract before leaving.

For the next six weeks, there are likely one or two monthly periods depending on where each circle is in its schedule. The minimum reserve to cover one missed payment per member per period is:

`100 USDC * number of members who might miss * number of periods while away`.

For a worst case six-week absence covering two payment deadlines:

`100 USDC * 12 members * 2 periods = 2,400 USDC`.

That is the conservative top-up if the current deployed design lacks member-level escrow.

### Breakage: first-period default

What happens:

- if someone misses the first contribution and there is no upfront bond, there is no earlier contribution from that member to slash;
- the first recipient cannot be guaranteed the full 1,200 USDC.

What to do:

- do not activate circles until every member has posted at least a 100 USDC bond;
- if a first period is already active without bonds, collect the missing reserve now or accept that the first recipient has shortfall risk.

### Breakage: frontend-only access

What happens:

- if the frontend is down or a relayer key expires, members may not know how to pay or settle even though the contract technically works;
- allowances can fail silently for users who have not approved enough USDC.

What to do:

- publish direct contract addresses and function names before leaving;
- add simple block explorer instructions for `approve`, `payContribution`, and `settlePeriod`;
- make sure members know the active period and deadline.

### Breakage: upgrade/admin dependency

What happens:

- if a role rotation, pause expiry, proxy admin action, or token approval maintenance is due while the builders are away, circles can halt;
- if only one builder wallet can perform the action, a lost key or travel issue becomes an operational failure.

What to do:

- transfer operational roles to a multisig before leaving;
- remove unnecessary admin gates from active circles;
- test the exact no-builder path on a fork or testnet.

## Pre-departure checklist

Before leaving for six weeks:

1. For each active circle, verify whether `settlePeriod` or equivalent is public/permissionless.
2. Verify every active circle has enough USDC escrow/reserve to cover expected missed payments.
3. Verify the next two period deadlines and scheduled recipients.
4. Run a fork/testnet simulation where:
   - all members pay and settlement succeeds;
   - one non-recipient misses payment and is forfeited;
   - the scheduled recipient misses payment and their future turn is skipped;
   - settlement is called by a random address, not a builder wallet.
5. Publish contract addresses, ABIs, and member instructions.
6. Fund any keeper if one is used, but do not rely on it as the only path.
7. Move emergency powers to a multisig or remove them for active circles.

## Bottom line

The circles keep working while the two builders are away only if the contract is autonomous: members pay directly, anyone can settle periods, forfeits are automatic, and the contract already holds enough escrow to cover missed payments.

If the current running circles rely on a builder-owned script, owner-only settlement, manual forfeiture decisions, or previously paid-out "earlier contributions," then they do not reliably keep working for the next six weeks. The immediate fix is to make settlement permissionless and pre-fund or bond enough USDC reserve before leaving. For a conservative six-week buffer across a full 12-person circle with two possible monthly deadlines, that reserve is 2,400 USDC per circle if there is no other escrow.

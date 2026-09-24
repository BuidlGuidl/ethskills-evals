# Onchain susu contract design and six-week absence plan

## Short answer

Existing circles only keep working while we are away if normal operations are already permissionless or automated:

- Members can pay USDC directly into the contract without our backend.
- Anyone can close a month, mark missed payments, and make the payout.
- Recipients can claim their payout themselves, or a funded keeper can trigger the payout.
- The contract already has escrowed funds or collateral to cover missed payments.

If any of those steps depends on the two builders, the running circles will stall during the six weeks. The most likely failure is that members can deposit, but the month never gets finalized, the missed payer is not marked as defaulted, and the $1,200 pot is not released to the scheduled recipient.

There is also a deeper accounting issue: earlier monthly contributions cannot cover a later shortfall if those contributions were already paid out as prior pots. To make the stated rule true onchain, the contract needs a real reserve, collateral, or full pre-funding. Without that, the contract can detect a missed payment, but it cannot make the recipient whole.

## Contract design

### Circle setup

Each circle is created with immutable terms:

- `USDC` token address.
- 12 member addresses.
- Fixed payout order, one address per month.
- Monthly contribution amount: `100e6` USDC units.
- Pot amount: `12 * 100e6`.
- Start timestamp.
- Period length and grace period.
- Reserve/collateral requirement.

The payout order should be fixed at creation and never editable after the circle starts. If a member address must be corrected before start, require unanimous approval or creator-only correction before the first deposit, then freeze the roster.

### Funding model

The contract needs two buckets:

1. Monthly contributions.
   Each active member pays `$100` USDC for the current month.

2. Default reserve.
   This is real escrowed USDC that can be seized if a member misses a payment. It cannot be only an accounting entry, because the previous months' pots have already left the contract.

The cleanest design is to require each member to lock collateral before the circle starts. The strict version is full pre-funding: each member deposits their whole annual obligation up front, and monthly settlement only releases the scheduled pot. A more susu-like version is monthly payments plus enough collateral to cover future defaults, especially for early recipients who receive the pot before making most of their own payments.

If we do not want collateral or pre-funding, then the product rule must change: the recipient receives only the USDC actually collected that month, and missed payments are not magically covered. That is simpler, but it is not the rule described here.

### Monthly flow

For period `i`:

1. Members call `contribute(circleId, i)` and transfer `100e6` USDC.
2. After the deadline plus grace period, anyone may call `settle(circleId, i)`.
3. Settlement checks each member:
   - If paid, their payment counts toward the pot.
   - If unpaid, mark them defaulted, mark their scheduled turn forfeited, and seize `100e6` from their reserve into this month's pot.
4. If the scheduled recipient has not forfeited, credit them with the full `$1,200` payout.
5. If the scheduled recipient has forfeited, do not pay them. Use that month's collected funds according to a fixed rule, such as replenishing reserves first and then crediting non-defaulted members pro rata.
6. Recipient calls `claim(circleId, i)`, or `settle` can credit a pull-payment balance that the recipient withdraws later.

Settlement must be idempotent: calling it twice for the same period must not double-pay or double-seize collateral.

### Permission model

Routine circle operations should not be `onlyOwner`.

Permissionless functions:

- `contribute`
- `contributeFor`
- `settle`
- `claim`
- `claimFor`

Admin-only functions should be limited to things that are not needed for normal monthly operation, such as pausing before launch, setting a new automation address, or rescuing unrelated tokens accidentally sent to the contract. The admin should not be required to advance a live circle.

### Automation

The contract cannot wake itself up every month. Someone or something must send a transaction.

Acceptable options:

- Any member can manually call `settle`.
- A public keeper can call `settle` and receive a small gas reimbursement.
- Chainlink Automation, Gelato, OpenZeppelin Defender, or another keeper service calls `settle` after each deadline.

Even with automation, manual fallback is important. If the keeper runs out of gas funds or its transaction reverts, members still need a direct way to settle and claim.

### Safety details

- Use `SafeERC20` for USDC transfers.
- Use pull payments for payouts so one failed transfer does not block the whole circle.
- Track period state explicitly: `open`, `settled`, `payoutClaimed`.
- Avoid unbounded loops if the design later supports more than 12 members. With 12 fixed members, a loop over all members is acceptable.
- Emit events for contribution, default, forfeiture, settlement, payout credit, and claim.
- Do not allow schedule changes after start.
- Do not allow a member to receive more than one successful payout.
- Keep an emergency pause narrow: pausing should stop new circles or suspicious claims, but it should not permanently trap already-earned payouts.

## What breaks while we are away

If the current deployed design relies on us to run monthly operations, these are the break points:

1. Month closing stops.
   The contract will not automatically advance to the next month. If only our script or owner account can call the close/finalize function, no pot gets finalized while we are gone.

2. Payouts stop.
   If the scheduled recipient depends on an admin-pushed transfer, they will not receive the $1,200 until someone sends that transaction.

3. Missed payments are not processed.
   If default marking is manual or admin-only, a member who misses payment will not be marked as forfeited. The contract may either block settlement, underpay the recipient, or keep waiting forever.

4. Later months may be blocked.
   Many designs require month `i` to be settled before month `i + 1` opens. If one settlement is missed, the whole circle can freeze for the rest of our absence.

5. Automation can silently stop.
   If a keeper is configured but not funded for gas, points at the wrong function, or reverts on one edge case, the circle still stalls unless members can call the fallback functions directly.

6. Shortfall coverage may be impossible.
   If no reserve or collateral exists, the contract cannot cover a missed `$100` payment. It can only pay what it has. This is not an operations problem; it is a solvency problem.

## What we should do before leaving

1. Check every live circle for permissionless operation.
   Confirm that a non-admin member can call the current-month contribution, settlement, and claim paths.

2. Check that there is real USDC available for shortfall coverage.
   If the contract does not hold reserves or collateral, we should not tell members that missed payments are covered.

3. Fund automation for at least two monthly cycles plus a gas buffer.
   Six weeks crosses at least one monthly settlement and may cross two depending on timing.

4. Run a rehearsal on testnet or a fork.
   Simulate one normal month, one missed payment, one forfeited recipient month, and one keeper failure where a member manually settles.

5. Publish a member runbook.
   Include the circle address, current period, payment deadline, settlement function, claim function, keeper status, and what to do if the UI is down.

6. Assign a temporary operator if the deployed contract is not permissionless.
   If settlement or payout is admin-only, transfer or delegate that authority to a trusted multisig before leaving.

7. If the deployed contract lacks reserves, choose one of three fixes:
   - Migrate live circles into a new collateralized contract.
   - Add reserves if the contract is upgradeable and the upgrade process is safe.
   - Change the product promise so recipients receive only collected funds.

## Decision

The design we should ship is a permissionless, collateralized circle with optional automation and manual fallback. Under that design, already-running circles keep working while we are away because members or keepers can perform every required monthly action without us.

If the circles already running today require our owner account, our backend, or our manual judgment to close months, they do not keep working unattended. The immediate fix is to make settlement and claims permissionless or delegate operations to a funded multisig/keeper before we leave. The accounting fix, if missing, is to add real escrowed reserves or stop promising that earlier contributions cover shortfalls.

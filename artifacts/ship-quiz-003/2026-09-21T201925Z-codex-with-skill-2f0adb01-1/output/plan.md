# Susu Circle Contract Plan

## Short Answer

The circles keep working while the two builders are away only if the contract does not need the builders to operate it.

Onchain, nothing happens automatically at the start of a month. A contract will not wake up, check who paid, mark missed payments, or send the pot by itself. Every transition needs someone to call a function and pay gas.

So the design has to make the monthly flow permissionless:

- Members call `pay(month)` to make their USDC payment.
- The current recipient, any member, or any public caller can call `settle(month)` after the payment deadline.
- The recipient can call `claim(month)` to withdraw the pot.
- If nobody calls, nothing is lost, but the circle's onchain state stays stale until someone calls. Payouts are delayed, not magically executed.

If the current running circles depend on either of you to run a cron job, press an admin button, mark defaulters, advance the month, or send payouts, they will not keep working correctly during the six weeks away. The exact breakage is: monthly payouts do not happen, missed payments are not processed, the circle may be stuck on the old month, and recipients may be unable to claim until an operator returns or another allowed caller takes over.

There is also one hard economic constraint: a smart contract cannot use "earlier contributions" to cover a missed payment if those earlier contributions have already been paid out to prior recipients. To cover a shortfall trustlessly, the contract must already control collateral, a reserve, or prefunded USDC. Otherwise a missed $100 payment leaves the month $100 short.

## Product Shape

Build one `SusuCircle` contract per circle, optionally deployed by a small factory later. Do not start with a complex protocol.

Each circle is fixed at creation:

- `asset`: USDC.
- `memberCount`: 12.
- `monthlyAmount`: `100e6`, because USDC has 6 decimals.
- `potAmount`: `12 * 100e6`.
- `members`: fixed list of 12 addresses.
- `payoutOrder`: fixed list of the same 12 addresses.
- `startTime`, `periodLength`, and `paymentGracePeriod`.
- `currentMonth`: 0 through 11.

The frontend, notifications, member names, family labels, reminders, and history views should stay offchain. The contract should only enforce membership, payments, default handling, pot claims, and refunds.

Base is a sensible first chain for a consumer USDC app because fees are tiny, Coinbase onboarding is good, and the transactions are user-facing. Ethereum mainnet is also cheap enough now, but Base is the better UX default for a family savings circle.

## Collateral Model

The literal social rule says: if someone misses a payment, they forfeit their turn, and their earlier contributions cover that month's recipient.

Onchain, that only works if the contract still controls value from that member. If all prior monthly payments were immediately included in previous pots, then the contract no longer has those funds. It cannot claw them back from previous recipients.

Recommended implementation:

1. Require each member to deposit a default reserve before the circle starts.
2. Monthly payments still happen normally.
3. If a member misses a payment, `settle(month)` slashes `monthlyAmount` from that member's reserve to make the current recipient whole.
4. The defaulting member's own payout turn is marked forfeited.
5. When the forfeited turn arrives, that pot is not paid to the defaulting member. It is used to replenish the reserve pool or distributed to non-defaulted members at finalization, depending on the accounting choice.
6. At the end of the circle, unused reserves are refunded.

The safest reserve is full exposure: enough USDC under contract control to cover all unpaid obligations if a member stops paying. That can feel heavy, but it is the only fully trustless guarantee. A smaller reserve is a product choice, not a guarantee: it covers only limited defaults, after which recipients can still be short.

If you want zero extra collateral, then the honest design is an undercollateralized social circle: missed payments can be recorded and turns can be forfeited, but the contract cannot always guarantee the current recipient receives the full $1,200.

## Core State

The contract should track:

- `mapping(address => bool) isMember`
- `mapping(address => uint8) memberIndex`
- `address[12] payoutOrder`
- `mapping(uint8 => mapping(address => bool)) paid`
- `mapping(address => bool) defaulted`
- `mapping(address => uint256) reserveBalance`
- `mapping(uint8 => bool) settled`
- `mapping(uint8 => uint256) claimablePot`
- `mapping(uint8 => address) recipient`
- `uint8 currentMonth`
- `bool activated`

Use OpenZeppelin `SafeERC20` for USDC transfers and `ReentrancyGuard` around functions that move funds.

Prefer pull payments. `settle(month)` records the amount claimable by the recipient. `claim(month)` transfers it. That keeps settlement from getting stuck if a recipient address has unusual behavior.

## Main Functions

### `acceptAndDepositReserve(uint256 amount)`

Called by each member before activation.

Why they call it: without all required deposits, the circle does not start and they do not participate.

If nobody calls it: the circle remains pending and no one is at risk.

### `activate()`

Permissionless once all 12 members have accepted and funded the required reserve.

Why someone calls it: members want the circle to start.

If nobody calls it: any member can call later. No builder is needed.

### `pay(uint8 month)`

Called by a member to pay that month's $100 USDC. Allow prepayment for future months.

Why they call it: paying preserves their eligibility for their own turn and avoids reserve slashing.

If nobody calls it: missing members can be defaulted during settlement.

### `settle(uint8 month)`

Permissionless after that month's payment deadline.

It should:

1. Verify the month is due and not already settled.
2. Check each member's payment status for the month.
3. For each missing payment, mark the member defaulted, slash reserve if available, and mark their own turn forfeited.
4. Compute the pot for that month.
5. Credit the recipient unless the recipient has defaulted and this is their forfeited turn.
6. Advance `currentMonth` as far as settled months allow.

Why someone calls it: the recipient wants to unlock their pot. A public caller can also be paid a small bounty from default penalties or a maintenance reserve.

If nobody calls it: the contract state does not advance. Funds stay in the contract and settlement can happen later.

### `claim(uint8 month)`

Called by the recipient after settlement.

Why they call it: they receive the pot.

If nobody calls it: the money remains claimable in the contract.

### `finalize()`

Permissionless after month 12 is settled.

It refunds unused reserves and distributes any surplus according to the documented rules.

Why someone calls it: members want refunds.

If nobody calls it: members can call later; funds remain in the contract.

## Default and Forfeiture Rules

The rules need to be mechanical and knowable before anyone joins:

- A member is late only after `monthDeadline(month)` passes.
- A missing monthly payment causes default.
- A defaulted member forfeits their payout turn.
- A defaulted member cannot receive a pot.
- The missed $100 is covered only from funds already controlled by the contract.
- If the reserve is insufficient, the contract must either pay a partial pot or revert settlement until someone tops up. Do not pretend the full pot is guaranteed.

I would choose "pay full pot only when funded; otherwise record a shortfall" rather than reverting forever. A recipient should be able to claim whatever is available, with the shortfall explicitly recorded.

## What Happens While We Are Away

### If built as above

Running circles keep working without the builders.

Members can keep paying. Recipients can settle and claim. If someone misses a payment, the current recipient can call `settle(month)` after the deadline and the contract applies the default rules. If a member or recipient forgets, settlement can happen late.

The only thing that does not happen is automatic monthly execution. That is normal. The design survives it because every important action is permissionless and has a natural caller.

For the six-week absence, at least one or two monthly periods may become due. That is fine if:

- members can prepay or pay during the period,
- `settle` can be called by anyone,
- `claim` can be called by each recipient,
- there is enough reserve to cover missed payments,
- the frontend does not rely on your private server to know the current state.

### If the current design uses an operator

Then the circles do not reliably keep working while both builders are gone.

Exact failures:

- If only an admin can advance the month, the circle gets stuck at the first unsettled month.
- If only an admin or backend job sends payouts, recipients do not receive their pots.
- If only an admin can mark a missed payment, defaulters are not processed.
- If missed payments make the pot short and there is no reserve, the full $1,200 payout cannot be made.
- If payout code assumes all 12 payments arrived and transfers exactly `$1,200`, it may revert when the balance is only `$1,100`.
- If the frontend depends on a private indexer, reminders and displayed status may go stale, even though the contract itself remains callable.

## Before Leaving For Six Weeks

Do these before relying on live circles:

1. Make `settle`, `claim`, `activate`, and `finalize` permissionless.
2. Remove any requirement that a builder/admin key performs monthly maintenance.
3. Allow members to prepay future months.
4. Add a small caller bounty for `settle` if you want non-members or bots to help maintain the circle.
5. Require enough reserve or prefunding to cover the default guarantees you advertise.
6. Add batch settlement so someone can settle more than one overdue month in one transaction.
7. Publish a simple member runbook: pay by this deadline, recipient calls settle after deadline, recipient claims.
8. Keep any admin powers narrow. If there is an emergency pause, it must not be required for normal operation.
9. Use a multisig for any owner role, not one builder's EOA.
10. Test the exact away scenario: create a circle, pay month 1, settle, skip six weeks, settle two overdue months, include one missed payer, and confirm the recipient can still claim.

## Test Cases

Minimum tests:

- all 12 members pay, each month settles, each ordered recipient receives exactly `$1,200`;
- a member misses before their turn, reserve covers the current shortfall, their later turn is forfeited;
- a member misses after their turn, reserve covers the future shortfall;
- reserve is insufficient and the shortfall is recorded honestly;
- non-members cannot pay as members or claim pots;
- nobody can change the payout order after activation;
- settlement cannot happen before the deadline;
- settlement can happen late;
- two overdue months can be settled in sequence;
- a recipient can claim later if they were unavailable at settlement time;
- final refunds return unused reserves;
- USDC uses 6 decimals everywhere.

## Bottom Line

The right onchain version is not "the team runs a monthly susu." It is a fixed state machine that members can poke themselves.

The already-running circles keep working during the six-week absence only if they are already built that way. If they depend on the two builders as operators, the first monthly transition that requires an operator will break. The fix is to make every monthly transition permissionless and to ensure missed-payment coverage comes from collateral or reserves the contract already holds.

# Susu contract plan and six-week absence assessment

## Goal

Build a fixed-term onchain susu / savings circle:

- 12 members.
- Each member owes 100 USDC per month.
- The cycle runs for 12 months.
- The payout order is fixed when the circle starts.
- Each month, one scheduled member is entitled to the 1,200 USDC pot.
- A member who misses a monthly payment forfeits their own future payout turn.
- If a member misses a payment, their earlier contributions are used to cover that month's recipient before any remaining balance is paid out or left for later rounds.

The key product requirement is that live circles must not depend on the two builders being online. A contract can enforce rules, hold USDC, and transfer funds, but it cannot call itself on the first of the month. Every transition needs an external caller.

## Recommended contract design

Use one `SusuCircleFactory` contract and one `SusuCircle` contract per circle.

### `SusuCircleFactory`

Responsibilities:

- Deploy new circles.
- Record deployed circle addresses.
- Validate basic creation parameters before deployment.
- Emit `CircleCreated(circle, creator, usdc, members, monthlyAmount, startTime, periodSeconds)`.

The factory should not be needed after a circle is created. Existing circles must remain functional even if the factory owner, backend, or frontend disappears.

### `SusuCircle`

Immutable configuration:

- `IERC20 usdc`.
- `address[12] members`.
- `uint256 monthlyAmount = 100e6` for USDC on chains where USDC has 6 decimals.
- `uint256 periodSeconds`, usually about 30 days.
- `uint256 startTime`.
- `address[12] payoutOrder`, or member indexes if the order is exactly the member list.

Core state:

- `uint8 currentMonth`, from 0 to 11.
- `mapping(uint8 => mapping(address => bool)) paid`.
- `mapping(address => uint256) prepaidBalance` if prepaying future months is allowed.
- `mapping(address => uint256) contributionCredit`, the member's prior paid-in amount that can be consumed if they default.
- `mapping(address => bool) forfeited`.
- `mapping(uint8 => bool) settled`.
- `bool cancelled` only for pre-start cancellation or an exceptional admin path with strict limits.

Recommended functions:

- `joinOrFund()` only if membership is not finalized at deployment. For the described family susu, prefer finalizing all 12 members at creation.
- `pay(uint8 month)` transfers exactly 100 USDC from `msg.sender` to the circle and marks that member paid for that month.
- `payFor(address member, uint8 month)` lets a relative or sponsor cover a member's payment.
- `settleMonth(uint8 month)` can be called by anyone after that month's deadline.
- `claimPayout(uint8 month)` can be called by that month's recipient after settlement if payout is pull-based.
- `settleAndPay(uint8 month)` combines settlement and payout if the transfer can be done safely in one transaction.
- `recoverDust(address to)` after month 12 and all payouts are settled, for leftover rounding or accidental tokens only.

Use `SafeERC20` for all USDC transfers and a `ReentrancyGuard` around settlement and payout. Emit events for `PaymentReceived`, `MemberForfeited`, `CreditUsed`, `MonthSettled`, and `PayoutSent`.

## Monthly settlement logic

For month `m`:

1. The contract determines the scheduled recipient from the fixed payout order.
2. If the scheduled recipient has already been forfeited, they do not receive the pot. The contract should skip their payout and mark the month settled, or send that month's collected funds to a predeclared fallback such as the next non-forfeited recipient. The simpler and clearer rule is: a forfeited recipient's turn is skipped.
3. For every member:
   - If they paid month `m`, their 100 USDC is part of the pot and their contribution credit increases by 100 USDC.
   - If they did not pay month `m`, mark them forfeited.
   - If they have prior contribution credit, consume up to 100 USDC of that credit to cover their missed payment for this month's recipient.
4. The recipient receives up to 1,200 USDC from actual payments plus consumed prior contribution credits.
5. If the full 1,200 USDC is not available because a defaulting member has no prior credit, pay the available amount and record the unpaid shortfall. Do not mint value or make future recipients silently pay for old defaults unless that is explicitly part of the family agreement.

This matches the stated rule that earlier contributions cover a defaulting member's missed payment. It also exposes the unavoidable edge case: in month 1, a member has no earlier contributions, so there may be nothing to cover their default. The contract cannot guarantee a full 1,200 USDC first-month payout unless members pre-fund, post collateral, or the circle requires all 12 payments before the first payout.

## Stronger design for guaranteed payouts

If the social promise is "each recipient always gets exactly 1,200 USDC on their month," require prefunding or collateral:

- Option A: every member deposits all 12 monthly payments, 1,200 USDC, before the circle starts. Then the contract simply releases 1,200 USDC each month. This is the safest onchain design, but it removes the monthly savings behavior.
- Option B: every member deposits a collateral reserve before start, for example 100-300 USDC, plus monthly payments. Missed payments are covered from collateral first, then prior contribution credit.
- Option C: require all 12 monthly payments to be in before the payout deadline for that month. If not, settlement is delayed or pays a partial pot. This is operationally honest but changes the expected experience.

For the described susu, Option B is the best compromise if exact payouts matter. Without collateral, the contract can enforce forfeiture but cannot create money to cover early defaults.

## Who calls what

This is the part that decides whether circles keep working while the builders are gone.

| Function | Caller | Why they call it | If nobody calls it |
| --- | --- | --- | --- |
| `pay` / `payFor` | Member, sponsor, frontend, or smart wallet | Avoid forfeiture and keep the circle current | That member misses the month and may forfeit |
| `settleMonth` | Anyone | Advance the month, apply defaults, unlock/send payout | The month remains unsettled; funds sit in the contract |
| `claimPayout` | Recipient | Receive the month's pot | Recipient is not paid until they claim |
| `recoverDust` | Anyone or limited admin after completion | Clean up leftovers | Dust remains in contract |

No monthly function should be `onlyOwner` or team-only. If settlement requires the two builders, the app is not autonomous.

## Will existing circles keep working while we are away?

They keep working only if the deployed contracts already satisfy these conditions:

- Members can pay USDC directly to the contract without your backend.
- A non-team caller can settle each month after the deadline.
- A non-team caller or the recipient can trigger the payout.
- The contract computes deadlines from `startTime` and `periodSeconds`, not from your server.
- Payout order, member list, monthly amount, and USDC address are already stored onchain.
- No required step depends on an admin signature, cron job, private relayer, upgrade, or manually maintained allowlist.

If those are true, you can be gone for six weeks and live circles should continue. Members still need to submit payments, and someone still needs to submit the settlement transaction when a period ends, but that someone does not have to be you. The likely practical result is one or two monthly settlements during the six-week absence.

If those are not true, here is exactly what breaks:

- If settlement is team-only, the next payout date stalls. Members may keep depositing, but the recipient will not receive the pot until one of you returns or an authorized key submits the transaction.
- If payout is team-only, the month may be marked settled but the USDC remains trapped until the team sends it.
- If the system relies on your backend to call `settleMonth`, the contract does not notice time passing by itself. The month remains open even after the deadline.
- If missed-payment forfeiture is calculated offchain, defaults will not be applied while you are gone. The contract may either overpay a defaulting member later or block because expected offchain state is missing.
- If the frontend is the only documented way to pay and it goes down, technically the contract may still work, but most family members will be unable to use it.
- If USDC approvals are not already granted, members must still approve USDC before paying. That is normal, but the UI should make it clear.

## What to do before leaving

1. Confirm each live circle has public or permissionless `settleMonth` and recipient-callable `claimPayout`, or a combined public `settleAndPay`.
2. If any live circle has admin-only settlement or payout, deploy and migrate to a fixed version before leaving, or hand the admin role to a multisig with at least one available signer.
3. Set up an automation backup, but do not make it the only path. Chainlink Automation, Gelato, OpenZeppelin Defender, or a simple monitored script can call `settleMonth`; the contract should still allow any person to call it manually.
4. Publish a short runbook for members:
   - USDC contract address and chain.
   - Circle contract address.
   - Monthly deadline.
   - How to approve and pay.
   - How the recipient can claim.
   - What happens if someone misses a payment.
5. Fund an automation wallet with enough native gas token for at least two settlements per active circle.
6. Test the next two months on a fork or local deployment:
   - everyone pays, then settle and pay;
   - one non-recipient misses payment with prior credit;
   - first-month missed payment with no prior credit;
   - scheduled recipient is already forfeited;
   - no team/admin account calls anything.

## Bottom line

The circle can be designed so it survives your six-week absence, but only if the live contracts do not depend on you for monthly transitions. The minimum safe design is: members pay directly, anyone can settle after the deadline, and the recipient can claim or anyone can trigger payout. If the current implementation needs a team cron job, admin call, or offchain forfeiture calculation, the next monthly cycle will stall or settle incorrectly while you are away.

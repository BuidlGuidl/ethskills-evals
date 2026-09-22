# Onchain Susu Plan

## Short Answer For The Six-Week Absence

If the circles already running require either of you, your backend, or an
owner-only function to advance months, mark missed payments, or release pots,
they will not keep working while you are away. The contract will not wake up on
its own. It only changes state when someone sends a transaction.

For the six weeks from Monday, September 21, 2026 through Monday, November 2,
2026, any circle that reaches a monthly deadline during that window needs a
permissionless path for participants or keepers to:

1. collect or record monthly payments,
2. settle the month after the grace period,
3. mark missed payers as forfeited,
4. release the pot to the correct recipient.

If those paths are permissionless and documented, the circles can keep working
without the builders. If they are owner-only or cron-only, the circle stalls at
the first monthly transition that needs an operator. Funds should remain in the
contract, but the current recipient will not get paid until someone with the
required permission returns or the missing automation is restored.

There is also a product-rule issue: "earlier contributions cover the shortfall"
is only true if those contributions, or some separate reserve, are still locked
in the contract. If prior monthly payments were already paid to earlier
recipients, the contract cannot reuse them. A deployed circle with no reserve or
collateral will either pay a short pot, revert during settlement, or need an
admin-funded top-up when someone misses a payment.

## Contract Design

Use one custom contract for the MVP: `SusuCircle`. Deploy one instance per
circle. A factory can come later if many circles are created through the app, but
it is not needed for the trust boundary of the first version.

Target chain for first release: Base mainnet. The product needs cheap recurring
USDC transactions, broad wallet support, and native USDC liquidity. Before
deployment, verify the official USDC address from Circle/Base documentation and
put the exact deployment and verification commands in the README.

### Circle Parameters

- `usdc`: immutable ERC-20 token address.
- `members`: exactly 12 addresses.
- `payoutOrder`: fixed array of the same 12 addresses.
- `monthlyContribution`: `100e6` for USDC.
- `periodCount`: `12`.
- `periodLength`: one calendar month if using app-side month boundaries, or a
  fixed seconds value if the contract owns timing.
- `gracePeriod`: time after period close before missed payments can be settled.
- `startTime`: timestamp for period 0.
- `reserveMode`: required for guaranteed shortfall handling.

### Recommended Reserve Rule

For a trustless version that really guarantees a full $1,200 payout each month,
each member must have locked funds that can cover missed future obligations.
There are two viable versions:

1. Fully escrowed circle: every member deposits the full $1,200 before the
   circle starts. Monthly payouts are then deterministic and no monthly payer
   liveness is required. This is the safest autonomous design, but it changes
   the family-style cash flow.
2. Monthly circle with collateral: every member pays $100 monthly and also locks
   a reserve. The reserve is debited when they miss a payment. To make all
   future recipients whole even after a member has already received their pot,
   the reserve must cover that member's unpaid future obligations. A smaller
   one-month reserve can cover one missed payment, but it cannot guarantee the
   whole year.

If the product must preserve exactly "$100 per month, no extra collateral, and
recipient always gets $1,200", that cannot be enforced trustlessly. The contract
cannot create the missing USDC.

### State

- `paid[period][member]`: whether the member's $100 was received for the period.
- `forfeited[member]`: whether a member has missed a required payment and lost
  their payout turn.
- `settled[period]`: whether the period has been finalized.
- `reserveBalance[member]`: locked collateral available to cover that member's
  missed payments.
- `shortfallRecovered`: accounting for reserve debits and later replenishment.

### Functions

- `joinAndFundReserve()`: member deposits required reserve before the circle
  starts.
- `pay(period)`: member transfers the monthly USDC contribution into the
  contract.
- `pullPayment(period, member)`: permissionless helper that pulls a member's
  payment if the member has approved USDC and has enough balance. This lets the
  recipient or a keeper collect payments without waiting for each member to send
  their own transaction.
- `settlePeriod(period)`: callable by anyone after the grace period. It records
  missed payments, debits reserves for shortfalls, marks missed members
  forfeited, and pays the period recipient if the pot is fully funded.
- `claimPayout(period)`: optional self-serve payout path for the recipient if
  settlement records a claimable amount instead of transferring immediately.
- `claimRefund()`: after all 12 periods are settled, non-forfeited members
  withdraw unused reserves or pro-rata recovered funds.

Avoid owner-only settlement. Owner powers should be limited to pre-start
configuration cancellation, metadata changes that do not affect funds, and
emergency pause only if there is a clearly documented unpause or withdrawal
path.

## State Transition Table

| Transition | Caller | Why They Pay Gas | If Nobody Calls |
| --- | --- | --- | --- |
| `joinAndFundReserve()` | Each member | They cannot participate or receive a turn otherwise | Circle cannot start |
| `pay(period)` | Member | Keeps their turn and avoids forfeiture | They can be marked missed after grace |
| `pullPayment(period, member)` | Recipient, member, or keeper | Helps complete the pot; recipient wants payout; keeper may earn a small fee | Payment waits for the member or another caller |
| `settlePeriod(period)` | Recipient, any member, or keeper | Recipient wants the pot; keeper can be paid a small fee from configured dues | Month remains unsettled and payout waits |
| `claimPayout(period)` | Recipient | Receives the pot | Funds remain claimable in the contract |
| `claimRefund()` | Member | Recovers unused reserve after the circle ends | Refund remains claimable |

Permissionless does not mean automatic. At least the current recipient should
know how to call `settlePeriod` and `claimPayout` from the app or block
explorer.

## What Breaks In A Non-Autonomous Deployment

If current deployments have an owner-only `settle`, `advanceMonth`,
`markDefault`, or `releasePot`, the next period close during the absence will
stall. Members may still be able to send USDC in, but the recipient will not get
the pot.

If settlement depends on a server or cron job you run, the contract works only
as long as that infrastructure keeps running and funded. If the job stops, runs
out of gas funds, or cannot reach the RPC, the circle stalls.

If the UI is the only place participants know how to act, an app outage becomes
a liveness problem even if the contract is permissionless. The backup should be
a short block-explorer runbook for `pay`, `settlePeriod`, and `claimPayout`.

If there is no locked reserve, a missed payment can underfund the current pot.
The contract must then either pay less than $1,200, revert and lock settlement,
or wait for someone to top up the difference. That is not an operations problem;
it is a solvency/design problem.

## What To Do Before Leaving

1. Check every running circle for owner-only or backend-only monthly
   transitions. Replace them with permissionless settlement before relying on
   the deployment.
2. Confirm each running circle has enough locked reserve or collateral to cover
   the shortfall rule. If not, tell participants that full payouts are not
   guaranteed and decide whether to pause, migrate, or top up reserves.
3. Give participants a one-page runbook with contract address, block explorer
   links, USDC approval instructions, and the exact calls for `pay`,
   `settlePeriod`, and `claimPayout`.
4. Fund a keeper wallet or configure a small settlement fee if you want someone
   other than the recipient to call monthly settlement.
5. Make all settlement functions idempotent: calling twice should not double
   pay, and calling late should still work.
6. Make sure no deadline permanently bricks a circle. Late settlement should be
   allowed after the grace period.

## Deployment Runbook For The MVP

- Deploy `SusuCircle` with verified USDC address, 12 members, fixed payout
  order, contribution amount, start time, period length, grace period, and
  reserve requirement.
- Verify the contract source on the target chain explorer.
- Have all 12 members approve USDC and fund required reserves before `startTime`.
- Run a small end-to-end test on a fork or test deployment: fund reserves, pay
  period 0, settle period 0, claim payout, simulate one missed payment, confirm
  reserve debit and forfeiture.
- Transfer any production owner role to the intended multisig. The multisig
  must not be required for normal monthly operation.

## Bottom Line

The circles keep working while you are gone only if they are already designed so
participants can move them forward without you. The minimum requirement is
permissionless payment collection, settlement, default marking, and payout
claiming. The separate minimum requirement for the family rule is solvency:
missed payments can be covered only by USDC that is actually locked in the
contract.

# Onchain susu plan

## Product rule to preserve

Twelve fixed members join one circle. Each round, each member owes 100 USDC and
one fixed recipient is entitled to the 1,200 USDC pot. The payout order is fixed
at activation and each member has at most one payout turn.

The important onchain constraint: a contract cannot spend USDC it does not
currently hold. If a prior month's contributions were already paid to a prior
recipient, those exact funds cannot later cover a missed payment. So the rule
"earlier contributions cover the shortfall" only works onchain if the contract
also has one of these:

- prefunded future contributions,
- liquid collateral/reserve,
- or an explicit rule that the recipient receives less now and may be made whole
  later.

I would not ship the third option as the default, because it surprises the
recipient. The shippable design should require funding/collateral before a
circle becomes active.

## Recommended contract design

### Target chain

Deploy the first release on Base mainnet using native Circle-issued USDC. Base is
EVM-compatible, has broad consumer wallet/onramp distribution, and Circle lists
Base as a supported USDC chain. Do not hardcode a remembered token address in
the plan or UI; use Circle's current official address list at deploy time and
record the exact token address in the deployment README.

Sources checked on 2026-09-21:

- Circle USDC supported chains: https://www.circle.com/usdc
- Circle supported chains and currencies docs: https://developers.circle.com/circle-mint/references/supported-chains-and-currencies

### Onchain

Put only the enforceable money rules onchain:

- member addresses,
- payout order,
- USDC token address,
- contribution amount,
- round length, start time, and grace period,
- each member's paid rounds,
- escrowed/prefunded contribution balance,
- collateral/reserve balance,
- default status,
- claimable payout per round,
- final refunds.

Emit events for deposits, defaults, round settlement, payout claims, and final
refunds. Reputation, names, phone numbers, reminders, UI metadata, and history
views should be offchain and derived from events.

### Custom contracts

Use one custom contract for the MVP:

- `SusuCircle`: one deployed instance per circle.

Add a `SusuCircleFactory` only if you need permissionless creation and an
onchain registry of many circles. The factory must not be on the monthly liveness
path; existing circles should keep working even if the factory owner disappears.

### Activation

A circle starts in `Funding`.

Constructor/initializer arguments:

- `IERC20 usdc`
- `address[12] members`
- `uint8[12] payoutOrder` or the members array as the payout order
- `uint256 contributionAmount = 100e6`
- `uint256 roundPeriod = 30 days` or another explicit period
- `uint256 startTime`
- `uint256 gracePeriod`
- collateral mode

The circle cannot enter `Active` until all required initial funding is present.
There are two sane funding modes:

1. Fully prefunded mode:
   Each member deposits 1,200 USDC before activation. The contract then pays
   exactly 1,200 USDC each round regardless of later user availability. This is
   the safest six-week/no-operator design, but it changes the product from
   monthly cashflow to upfront escrow.

2. Collateralized monthly mode:
   Each member deposits the current month's contribution plus enough collateral
   or prepaid balance to cover the default guarantee you promise. This keeps the
   monthly habit, but the guarantee is only as strong as the reserve. If you
   promise "the recipient always gets 1,200 USDC this month," the reserve must
   already contain enough USDC to fill all missed payments for that month.

For family/social circles, I would start with collateralized monthly mode and
make the risk explicit in the UI: "This circle has enough reserve to cover N
missed payments this round." For a trust-minimized public product, use fully
prefunded mode or require much heavier collateral.

## State transitions

Contracts do not run themselves. Every transition below is permissionless or
self-serve so the builders are not required.

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `deposit(uint256 rounds)` | member, or anyone using member's permit/authorization if supported | member stays current and avoids default | member may be defaulted after the grace period |
| `activate()` | any member | starts a fully funded circle | circle stays in `Funding`; no money is paid out |
| `settleRound(uint256 round)` | recipient, any member, or keeper | recipient wants their pot; members want the circle to advance | round remains unsettled and payout remains unclaimable, but funds are not lost |
| `claimPayout(uint256 round)` | round recipient | recipient receives USDC | payout remains claimable |
| `markDefault(uint256 round, uint8 memberIndex)` | usually called inside `settleRound`, permissionless | settlement can complete and the caller may earn a small keeper fee if configured | default is not recorded; settlement may wait |
| `refundCollateral()` | member after the circle ends or after expulsion accounting is complete | member recovers unused USDC | collateral remains claimable |
| `cancelBeforeActivation()` | any member after a timeout, or all members before timeout | recovers funds if the circle never fully starts | funds remain escrowed until activation or timeout |

No monthly function should be `onlyOwner`. Automation can be added as a
convenience, but the contract must still work when automation is unfunded,
deprecated, or down.

## Round settlement logic

For each round:

1. Accept member payments before the deadline and during a grace period.
2. Allow members to prepay future rounds.
3. After `roundStart + roundPeriod + gracePeriod`, anyone may call
   `settleRound(round)`.
4. The contract checks which members have not paid.
5. For each missed payment, the contract fills the 100 USDC shortfall from that
   member's prepaid balance or slashable collateral if available.
6. A defaulted member loses their future payout turn. Their skipped turn should
   not create a surprise windfall; route it to the reserve first, then refund or
   pro-rata distribute any surplus at final settlement according to the written
   rules.
7. If reserve/collateral is insufficient, the contract must follow one explicit
   rule:
   - revert settlement until someone tops up,
   - settle a partial payout,
   - or record debt to be repaid from a later forfeited turn.

Pick exactly one of those. My recommendation is to revert until topped up for
private family circles where the promise is "the recipient gets the full pot."
For a public product, avoid hidden debt and either require full prefunding or
make partial payout explicit.

Use pull payments: settlement records `claimable[roundRecipient] += amount`, and
the recipient calls `claimPayout()`. This avoids a failed recipient transfer
blocking settlement.

## What keeps working while the two builders are away?

With the design above, already-running circles keep working for six weeks if all
of these are true:

- every monthly transition is permissionless or recipient/member callable,
- members know how to pay without your backend,
- recipients know how to call `settleRound()` and `claimPayout()`,
- the next one or two rounds have enough prepaid USDC/collateral/reserve to
  cover the defaults you promise to cover,
- users have Base ETH for gas,
- and the UI is not the only way to interact with the contracts.

In that case, the builders can be gone. A recipient or any other member can
settle the due round, claim the payout, and move on. If nobody calls the
settlement function, nothing magical happens, but nothing should be lost; the
round just waits.

## What breaks if the current circles were built naively?

These are the exact breakpoints to audit before leaving:

1. Owner-only monthly rollover
   If `advanceMonth()`, `settleRound()`, `markMissed()`, or `payout()` is
   `onlyOwner` and the owner is one of the two absent builders, the circle stops
   at the next month boundary. Members may still be able to approve USDC, but
   the pot will not become claimable.

2. Backend-only cron
   If a server job is the only caller of settlement, the chain state will stall
   when the server is down, unfunded, rate-limited, or unmaintained. The fix is
   not just "add another cron"; the fix is a public contract function that any
   recipient/member can call.

3. No reserve or collateral
   If a member misses a payment and the contract already paid prior
   contributions out to earlier recipients, the contract cannot make the current
   recipient whole. It will either pay less than 1,200 USDC, revert, or require
   someone to manually top up. This is the biggest economic issue.

4. UI as the only path
   If the website is down and members do not have block explorer/write-contract
   instructions, the contract may be live but practically unusable. Publish a
   one-page "while we are away" runbook with the contract address and exact calls.

5. Unfunded gas/automation
   ERC-20 approvals do not pay gas. Someone still needs Base ETH to call
   `deposit`, `settleRound`, and `claimPayout`. If you use automation, fund it,
   but keep manual calls available.

6. Upgrade/admin dependency
   If an upgrade is required to handle normal monthly settlement, the running
   circles are not autonomous. Upgrades should be for bugs only, not for routine
   operation.

## What to do before leaving for six weeks

1. Audit the deployed contracts for `onlyOwner` or backend-only functions in the
   monthly path. Replace them with permissionless/self-serve calls before relying
   on the system.
2. For each active circle, check the next two round deadlines, recipients,
   current contract USDC balance, prepaid balances, and reserve/collateral.
3. If the reserve cannot cover the promised shortfall, either top it up,
   require members to prepay the next two months, or tell the recipients that a
   missed payment will delay or reduce payout.
4. Publish a runbook for members with:
   - contract address,
   - USDC token address,
   - how to approve/deposit,
   - how to call `settleRound(round)`,
   - how to call `claimPayout(round)`,
   - how to get a small amount of Base ETH for gas,
   - what to do if settlement reverts because of insufficient reserve.
5. Give operational ownership, if any remains, to a multisig with at least one
   available signer who is not away. Do not leave required monthly operations
   behind a single absent wallet.
6. Run one end-to-end drill on a test circle: deposit, advance past a deadline,
   settle, mark a missed payment, slash reserve, and claim payout.

## Bottom line

Running circles can keep working while the two builders are away only if they are
designed to be member/recipient operated and already hold enough USDC to satisfy
the payout guarantees. If the current system needs your server, your wallet, or
future missed payments to be magically covered by money that was already paid
out, then it will not keep working as promised. The immediate fix is to make
settlement permissionless and fund enough prepaid balances/collateral/reserve
for the next six weeks before you leave.

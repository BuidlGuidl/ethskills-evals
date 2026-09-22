# Susu contract design and six-week operating plan

## Product shape

The circle is a fixed-size rotating savings circle:

- 12 members.
- Each member owes 100 USDC per round.
- There are 12 monthly rounds.
- The payout order is fixed before activation.
- In each round, the scheduled recipient should receive 1,200 USDC.
- Each non-defaulted member should receive exactly one turn.
- If a member misses a payment, they default and forfeit their turn.

The important constraint is that the contract cannot pay a full 1,200 USDC pot from money it no longer controls. If prior contributions have already been sent to earlier recipients, those contributions are not available later to cover a missed payment. So the design needs either:

1. enough USDC escrowed up front,
2. enough collateral bonded by members,
3. permission to pull USDC from members at settlement time, with fallback collateral if the pull fails, or
4. acceptance that some later pots may be partial.

For the stated product promise, option 4 is not acceptable. The contract needs collateral or escrow.

## Recommended contract design

Use one `SusuFactory` and one `SusuCircle` contract per circle.

### Factory

`SusuFactory` creates new circles and records their addresses. It should not be needed for already-running circles after deployment.

Factory inputs:

- `usdc`: ERC-20 token address.
- `members`: 12 unique member addresses.
- `payoutOrder`: the same 12 addresses, in payout order.
- `contributionAmount`: 100 USDC, using USDC's decimals.
- `periodSeconds`: either an approximate month such as 30 days, or explicit round due timestamps.
- `startTime`: first round opening time.
- `gracePeriod`: time after a due date before non-payers can be marked defaulted.

### Circle state

Each circle stores immutable configuration:

- USDC token.
- member list.
- payout order.
- monthly contribution amount.
- 12 round due dates.
- grace period.

Each circle stores mutable state:

- `currentRound`, from 0 to 11.
- `paid[round][member]`.
- `defaulted[member]`.
- `hasReceived[member]`.
- `securityBalance[member]`.
- `roundSettled[round]`.
- `completed`.

### Collateral model

The cleanest trustless version requires each member to post a USDC security bond before the circle activates. The bond exists only to make other members whole if that member misses payments.

The required bond depends on payout position:

- Before a member's own turn, their default creates shortfalls until their forfeited turn is skipped. A late-position member can create a large bridge shortfall.
- After a member has received their pot, their default creates shortfalls for every remaining round because there is no future turn left to forfeit.

For member position `k`, where `k` is 1 through 12, the maximum bond needed is:

`100 USDC * max(k - 1, 12 - k)`

Examples:

- Position 1 needs up to 1,100 USDC after receiving first, because they still owe 11 future payments.
- Position 12 needs up to 1,100 USDC before receiving, because they could miss all earlier rounds and the contract must bridge those shortfalls until their forfeited turn.
- Middle positions need less, but still several months of bond.

The contract can release unused bond as risk falls. For example, after every settled round, a member's required bond can be recomputed and any excess can be withdrawn.

This is stricter than the family/offchain version, but it is the part that makes the promise enforceable without trusting either builder to intervene.

### Monthly payment flow

Members pay by calling `pay(round)` during the round window. The contract pulls exactly 100 USDC from `msg.sender` using `transferFrom`.

Also support `payWithPermit(...)` if using a USDC variant or chain that supports permit-style approvals. This improves UX but should not be required for liveness.

Rules:

- Only the current round can be paid.
- Defaulted members cannot pay.
- A member cannot pay twice for the same round.
- Payments after the grace period are rejected unless the round has not yet been settled and the product intentionally allows late payments.

### Settlement flow

Anyone can call `settleRound(round)` after the round's grace period. It must not be owner-only.

`settleRound` does the following:

1. Identifies the scheduled recipient.
2. For each active member who did not pay, marks them defaulted.
3. Pulls the missing 100 USDC per defaulter from that defaulter's security bond.
4. If the scheduled recipient has defaulted before their own turn, skips their payout and keeps that round's collected funds as reserve for future shortfalls.
5. Otherwise pays the scheduled recipient exactly 1,200 USDC.
6. Marks the recipient as having received.
7. Advances `currentRound`.
8. Releases any security bond that is no longer needed.

The settlement function should be idempotent: once a round is settled, calling it again should do nothing or revert with `AlreadySettled`.

### Automation

The contract should not require either builder to call anything.

There are two acceptable liveness models:

- Permissionless liveness: any member or outside account can call `settleRound`.
- Keeper liveness: a service such as Chainlink Automation, Gelato, OpenZeppelin Defender, or a custom bot calls `settleRound`, but the function remains permissionless so members can recover if the bot fails.

Automation is convenience, not authority. If the only account allowed to settle is one of the two builders, the circle is not autonomous.

### Admin powers

Admin powers should be minimal after activation:

- Before activation, the creator can cancel and refund if not all members have joined and bonded.
- After activation, no owner should be able to change payout order, change members, seize funds, skip a round manually, or pause normal payments and settlement.
- Emergency pause, if included, should only block new circle creation or new joins, not settlement and withdrawals for existing circles.

The safest rule: once active, member payments, defaults, payouts, bond releases, and completion are entirely deterministic.

### Failure behavior

If a member misses a payment:

- They are marked defaulted at settlement.
- Their current missed contribution is covered from their security bond.
- They forfeit their scheduled payout if it has not happened yet.
- If their scheduled payout is later, that skipped payout round becomes reserve liquidity for future shortfalls.
- If they already received their payout, their remaining missed payments are covered by their remaining security bond.

If the security bond is insufficient, the contract cannot honestly guarantee a 1,200 USDC pot. The settlement should fail rather than silently underpay, because silent partial payout breaks the product promise.

## Do running circles keep working while we are gone?

Today is 2026-09-21. Six weeks away means roughly through 2026-11-02.

They keep working during that period only if the deployed circles already satisfy all of these conditions:

- Members can make their own monthly USDC payments without either builder.
- Round settlement is permissionless, or a funded automation service can call it.
- If automation fails, any member can call settlement manually.
- The contracts already hold enough escrow or security bonds to cover missed payments.
- No active circle depends on an owner-only action to mark defaults, release payouts, advance rounds, unpause, refresh a bot, top up gas, or move USDC.

If those conditions are true, the circles should continue while both builders are gone. Members still need to pay on time, but the builders do not need to be present.

If any condition is false, then the answer is no: the running circles are operationally dependent on us.

## What exactly breaks if we leave without fixing this

### If settlement is owner-only

Payments may come in, but the monthly pot will not be released unless one of the builder keys calls the settlement function. The contract will accumulate USDC and recipients will wait.

What to do:

- Change settlement so `settleRound` is callable by anyone after the grace period.
- If the contract is not upgradeable, deploy a new circle implementation and migrate only circles that have not started. For active circles, either the owner must keep settling while away or ownership must be delegated to a trusted multisig/operator before leaving.

### If defaults require manual admin action

A missed payer will not be marked defaulted. The round may get stuck waiting for a payment that will never arrive, or the recipient may receive less than 1,200 USDC.

What to do:

- Make default detection deterministic inside `settleRound`.
- The function should derive defaults from `paid[round][member]` and the due timestamp, not from an admin decision.

### If there is no collateral or escrow

The contract cannot cover a missed payment after prior funds have been paid out. This is the core economic break.

What to do:

- Require security bonds before activation for new circles.
- For active circles, collect additional USDC bonds from members before the builders leave, or accept that missed payments can cause partial pots.
- Do not market active circles as guaranteed-full-payout circles unless the money to cover defaults is actually controlled by the contract.

### If automation is the only caller and it is not funded

The contracts may be designed correctly but still stall because no transaction is sent after the grace period.

What to do:

- Top up the automation gas balance through at least 2026-11-02, with a buffer.
- Publish a member runbook showing how anyone can call `settleRound` directly from the block explorer if automation stops.

### If USDC allowances expire or are insufficient

Members who intended to pay may fail at payment time because `transferFrom` reverts.

What to do:

- Have members approve enough USDC before leaving, or use a permit flow.
- The UI should show each member whether their allowance and wallet balance cover the next payment.

### If the contract can be paused globally

A pause before or during the six-week absence may block payments or settlement.

What to do:

- Ensure emergency pause does not block settlement, refunds, or withdrawals for already-running circles.
- If the current implementation blocks those flows, unpause before leaving and transfer pause authority to a multisig with available signers.

## Practical pre-departure checklist

Before both builders leave:

1. For each active circle, confirm the next two round due dates and grace periods.
2. Confirm whether `settleRound` or equivalent is permissionless.
3. Confirm whether missed payments are detected by contract logic rather than admin input.
4. Confirm the contract holds enough USDC security bond or escrow for every active member.
5. Confirm automation is funded through at least 2026-11-02.
6. Give members a one-page runbook for paying, checking whether they paid, and manually settling a round.
7. Move any necessary admin role to a multisig with at least one available signer, or remove the admin dependency entirely.

## Bottom line

The desired susu can be autonomous, but only if the contract has both deterministic settlement and enough USDC under contract control to cover defaults.

If the current running circles need either builder to push monthly payouts, mark defaulters, top up a keeper, unpause the system, or supply missing liquidity, then they will not reliably keep working while both builders are away. The fix is to make settlement permissionless and collateralized before leaving, or to appoint an available operator/multisig for the six-week gap.

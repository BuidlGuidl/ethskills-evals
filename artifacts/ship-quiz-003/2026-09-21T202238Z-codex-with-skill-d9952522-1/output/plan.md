# Onchain Susu Plan

## Short Answer

Already-running circles only keep working while the two builders are away if every monthly action that matters is callable by participants or by anyone, not by an owner-only backend job.

The chain will keep accepting transactions, but contracts do not run on a calendar by themselves. If the current design depends on either of you to close a month, mark missed payments, or send the pot, then the next six weeks break at the first month-end that needs that call. Members may still be able to approve USDC and pay, but the contract will not automatically forfeit late members or release the pot.

There is a second, more fundamental issue: the rule "a missed member's earlier contributions cover this month's shortfall" only works if the contract still has that member's money in custody. If previous monthly pots were fully paid out, those earlier contributions are gone. An immutable live contract cannot claw them back. To guarantee a $1,200 recipient payout after someone misses a payment, running circles need either pre-funded collateral/reserves, an external top-up, or a rule change that allows short payouts and later recovery from the missed member's forfeited turn.

## Product Rule

- 12 fixed members.
- Native USDC only.
- Each regular installment is `100e6` USDC because USDC has 6 decimals.
- There are 12 monthly periods.
- The payout order is fixed at circle creation and cannot be changed after start.
- Each non-forfeited member gets at most one turn.
- Missing a required payment by the period deadline forfeits that member's future payout turn.
- If the member has already received their payout, there is no future turn to forfeit; the enforcement mechanism must be loss of reserve/refund.
- The intended pot is `12 * 100e6 = 1,200e6` USDC per period.

## Onchain / Offchain Boundary

Onchain:

- Member wallet addresses.
- Fixed payout order.
- Circle start timestamp, period length, grace period, installment amount, and USDC token address.
- Payment records by member and period.
- Forfeiture state.
- Settlement records and claimable payout balances.
- Reserve/collateral balances if the circle needs guaranteed full pots.
- Events for payments, missed payments, forfeitures, settlement, payouts, and refunds.

Offchain:

- Family names, phone numbers, reminders, explanations, profile photos, notes, and invitations.
- Calendar UI and notification delivery.
- Human dispute conversations.
- Derived reputation, history views, ranking, and search.
- Analytics over emitted events.

## Target Chain

Launch the MVP on Base mainnet.

Reasons:

- The product is small recurring USDC transfers, so low fees matter more than Ethereum L1 settlement prestige.
- Circle lists native USDC on Base at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, and explicitly distinguishes it from bridged USDbC.
- Base has Coinbase distribution and wallet/on-ramp familiarity, which fits a consumer savings-circle flow.
- Current Base median transaction cost from growthepie for 2026-09-20 was about `$0.00113`, so a monthly payment or settlement transaction should be economically reasonable even for a $100 installment.

Sources checked on 2026-09-21:

- Circle native Base USDC support: https://help.circle.com/support/en/usdc-supported-blockchains-minting-redemption-faqs?id=kb_article_view&sysparm_article=KB0010590
- Circle multichain USDC overview: https://www.circle.com/multi-chain-usdc
- growthepie fundamentals API for Base median transaction cost: https://api.growthepie.xyz/v1/fundamentals.json

## Contract Surface

Use one custom contract for the MVP: `SusuCircle`.

Do not add a factory for the first release unless we need permissionless circle creation by many unrelated groups. A single deployment per circle is easier to audit, easier to explain to members, and avoids shared upgrade/admin risk.

Constructor:

- `IERC20 usdc`
- `address[12] members`
- `uint8[12] payoutOrder`
- `uint64 startTime`
- `uint64 periodSeconds`
- `uint64 graceSeconds`
- `uint256 installment`
- `uint256 requiredReserve`

Core functions:

- `fundReserve(uint256 amount)` before the circle starts.
- `pay(uint8 period)` for the caller's own monthly installment.
- `payFor(address member, uint8 period)` so a relative can help someone avoid forfeiture.
- `settlePeriod(uint8 period)` permissionless after the period deadline plus grace period.
- `claimPayout(uint8 period)` by that period's recipient after settlement.
- `claimRefund()` after the circle ends and all liabilities are settled.
- View helpers: `currentPeriod()`, `amountDue(member, period)`, `recipient(period)`, `isForfeited(member)`, `claimable(member)`.

Implementation constraints:

- Use `SafeERC20` and handle USDC's 6 decimals directly.
- Use pull payments for payouts and refunds instead of doing many transfers in one settlement call.
- Protect state-changing functions with reentrancy protection.
- Store a compact fixed-size payment bitmap per member or a `mapping(address => mapping(uint8 => bool))`; 12 members x 12 periods is tiny, so readability is more important than gas golf.
- Settlement must be idempotent: a settled period cannot be settled again.
- No owner function may move member funds after the circle starts.
- No upgradeability for the MVP unless the upgrade admin is a disclosed multisig and members explicitly accept that trust model before joining.

## The Reserve Problem

The business rule says a missed payment is covered by the missed member's earlier contributions. A contract can only do that if it still controls value from that member.

Naive monthly payout design:

1. Month 1: all 12 members pay $100.
2. Contract sends the full $1,200 to recipient 1.
3. Month 2: member 7 misses their $100.
4. Contract only has $1,100 for recipient 2.

At step 4, member 7's month-1 contribution cannot cover anything because it was already paid to recipient 1. Calling it "forfeited" in storage does not create USDC.

Recommended MVP design:

- Require each member to lock a reserve before the circle starts.
- The simplest exact guarantee for the "forfeited member's own turn is skipped" rule is `requiredReserve = 11 * installment = 1,100 USDC` per member, plus the normal monthly payments. That reserve covers the 11 periods where other people are recipients.
- If a member misses a monthly payment, settlement moves `100 USDC` from that member's reserve into the current period's pot and marks them forfeited.
- If the forfeited member later misses more installments, the reserve can continue covering their required installments until exhausted.
- When the forfeited member's own turn arrives, they receive no payout and that turn is skipped/cancelled. Any funds accidentally paid for that skipped period should roll into final accounting or refunds, not create an extra recipient promise.
- At the end, unused reserves return to members.

If the desired rule is instead "there are still 12 payout months and a later non-forfeited member moves into the forfeited slot," then each member's reserve must be `12 * installment = 1,200 USDC`, because a defaulting member may owe support for all 12 payout periods.

This preserves the user-facing habit of monthly $100 payments while making the guarantee real. The tradeoff is capital lockup: each member needs up to $1,100 parked as security. If that is too heavy, the product must honestly switch to one of these weaker rules:

- recipient gets a short payout when someone misses;
- organizers or a sponsor top up shortfalls;
- the missed amount becomes a debt repaid later from the missed member's forfeited payout month;
- everyone pre-funds the entire year up front and the "monthly" action is only accounting.

Do not launch with wording that promises guaranteed $1,200 pots unless the contract is actually collateralized enough to make that true.

## State Transitions

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `fundReserve(amount)` | Member or helper | Required to activate the member before start and protect their future turn | Circle cannot start, or that member is excluded before launch |
| `pay(period)` | Member | Keeps member current and preserves their payout eligibility | Member becomes settleable as missed after the grace period |
| `payFor(member, period)` | Relative/helper | Helps a member stay in good standing | Same as no `pay`: member can be forfeited after grace |
| `settlePeriod(period)` | Current recipient, another participant, or optional keeper | Recipient wants their payout made claimable; later recipients want the circle advanced | Period remains unsettled; funds stay in contract; later periods should not finalize out of order |
| `claimPayout(period)` | Settled period's recipient | Receives USDC | Funds remain claimable in the contract |
| `claimRefund()` | Member | Recovers unused reserve after the circle ends | Refund remains claimable |

The critical liveness path is `settlePeriod`. It must not be owner-only. A backend or automation service can call it for convenience, but participants must be able to call it directly from the app or block explorer.

## What Breaks During the Six Weeks

If the deployed/running circles already have permissionless `pay`, `settlePeriod`, and `claimPayout`, and they hold enough reserves to cover missed payments, they keep working while the builders are gone. The only thing that may degrade is convenience: if no automation runs, the recipient or another participant must press the settle/claim button.

If settlement is owner-only or backend-only:

- Month-end does not close automatically.
- Missed payments are not marked.
- Forfeitures are not applied.
- Payouts are not made claimable or transferred.
- Users may see money sitting in the contract even though the social deadline passed.

Fix before leaving:

- Deploy or upgrade to permissionless settlement if the contract supports upgrades.
- If it cannot be upgraded, transfer the operational role to a reliable multisig or keeper before leaving, but treat that as a temporary patch, not the final design.
- Publish direct block-explorer instructions for `settlePeriod` and `claimPayout`.
- Fund any keeper/automation account with gas, but do not make that account the only liveness path.

If earlier contributions were already paid out and there is no reserve:

- A missed monthly payment creates an immediate USDC shortfall.
- The current recipient cannot receive the full $1,200 unless someone tops up.
- Marking the delinquent member as forfeited only changes future accounting; it does not cover the present pot.

Fix before leaving:

- For live circles, ask members or organizers to deposit an explicit reserve/top-up before the next deadline.
- If members will not lock reserves, change the UI and docs to say payouts can be short after defaults.
- Add a ledger for unpaid shortfalls so a forfeited future payout can repay the affected recipients later, but be clear that this is delayed recovery, not same-month coverage.
- Do not promise "earlier contributions cover the shortfall" for circles whose earlier contributions have already left the contract.

If participants cannot self-serve from the UI:

- The contract may technically work, but non-technical users may still be stuck while the builders are away.

Fix before leaving:

- Put `pay`, `settlePeriod`, and `claimPayout` in the app.
- Add a simple "Settle current month" button visible to the current recipient after the grace period.
- Add a fallback page with contract address, chain, function names, and exact arguments.

## Deployment Runbook

Before production launch, create a Foundry project with this contract and tests. The deploy target is Base mainnet.

Environment variables:

- `BASE_RPC_URL`
- `BASESCAN_API_KEY`
- `DEPLOYER_PRIVATE_KEY`
- `USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- `OWNER_SAFE` only if there is a pre-start admin or upgrade role; no post-start custody power should remain with an EOA.

Commands:

```bash
forge build
forge test
forge script script/DeploySusuCircle.s.sol:DeploySusuCircle \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast \
  --verify \
  --etherscan-api-key "$BASESCAN_API_KEY"
```

Post-deploy checks:

- Verify the constructor arguments on BaseScan.
- Confirm the USDC address is native Base USDC, not bridged USDbC.
- Have one test member approve and call `fundReserve`.
- Have one test member call `pay(0)`.
- Advance a local fork past the deadline and confirm `settlePeriod(0)` makes the correct payout claimable.
- Confirm no owner/admin can withdraw member funds after start.

## Tests Needed

- Constructor rejects duplicate members, zero addresses, invalid order, wrong member count, and bad start times.
- Members can pay only the correct installment for each period.
- `payFor` credits the intended member, not the payer.
- A member who misses after grace is forfeited exactly once.
- Settlement uses reserve to cover a missed payment.
- Settlement reverts or records a shortfall if reserve is insufficient, depending on the selected product rule.
- A forfeited member cannot claim their turn.
- A non-forfeited recipient can claim exactly one payout.
- Unused reserves are refundable only after all liabilities are settled.
- No owner-only liveness dependency exists after start.
- Fork test against Base USDC for `transferFrom`, `transfer`, decimals, and approval behavior.

## Launch Decision

Do not launch more circles until the liveness and reserve issues are resolved.

For circles already running, the action depends on what is deployed:

- Permissionless settlement plus adequate reserves: safe to leave for six weeks, with participant instructions.
- Permissionless settlement but no reserves: the circle keeps moving, but a missed payment causes a real shortfall.
- Owner/backend-only settlement: not safe to leave; month-end processing can stall.
- No self-serve UI: contract may be live, but users can still be operationally stuck.

The minimum acceptable state before both builders leave is: participants can pay, settle, and claim without either builder; the contract has enough USDC reserve to satisfy any advertised full-pot guarantee; and the fallback instructions are written down where the members can find them.

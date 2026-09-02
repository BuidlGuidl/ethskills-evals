# Onchain susu: contract and six-week operating plan

## Executive answer

A deployed contract does not run on a calendar by itself. Time passing can make a month eligible for settlement, but an account still has to send the settlement transaction. Existing circles will therefore keep working during a six-week absence **only if** their deployed code already allows any account to settle an expired month (and the members still make their payments), or a tested keeper/automation service is funded and running. If advancing the circle is restricted to either builder, or the only keeper is controlled or funded by them, the circle will stall at the first deadline while they are away.

The recommended contract below has no operator in its normal path. Members deposit, then anyone can call `settle()` after the payment deadline. A third-party keeper is useful for convenience, but is not trusted: if it disappears, any member can make the same call. Admin pause and upgrades are deliberately unable to block deposits or monthly settlement.

There is also an economic issue in the proposed rule. Twelve monthly payments of $100 produce $1,200 only when all twelve people pay. A defaulter's earlier $100 payments cannot both have funded earlier recipients and still be available for a later shortfall. A guaranteed $1,200 pot requires funds to be locked in advance. The clean design is for every member to escrow the full remaining annual obligation ($1,200 at inception), with monthly payments replenishing/releasing that security. Anything less either makes the recipient absorb a short pot or creates unsecured credit risk.

## Rules to commit to before deployment

- Exactly 12 distinct member addresses and a fixed 12-address payout order are stored at creation and cannot change.
- Use native USDC units: `MONTHLY_DUE = 100_000000`, `POT = 1_200_000000`, and 12 rounds. Do not assume 18 decimals; validate the configured token and chain.
- Define a fixed `startTime`, round duration (for example 30 days, not “calendar month”), and payment window. Round `r` has times calculated from `startTime`, never from the previous settlement transaction, so a late transaction cannot shift the whole year.
- A payment is counted for one named round only. No ambiguous pooled balance and no double counting.
- The payout order is fixed. A member who has defaulted becomes ineligible for their scheduled payout; their slot is not reassigned and they cannot regain it by paying late. Whether their slot pays nobody or is used to reimburse locked security must be stated in the terms. The design below treats it as a recovery slot: no member payout is made, and remaining recoverable funds are reconciled.
- The first recipient presents the highest credit risk and the last the lowest. Members must explicitly accept that fact and the forfeiture rules before joining.

## Solvency model

### Recommended: fully secured circles

Before activation, transfer $1,200 USDC from each member into that circle's escrow. The circle starts only when all $14,400 is actually held. This is security for all 12 dues, not protocol revenue and not an immediately withdrawable balance.

For each round, the contract accounts for $100 per member from that member's locked escrow and pays exactly $1,200 to the eligible scheduled recipient. A member may optionally replenish the $100 during the round; that replenishment maintains their security/refundable balance. At the end, a compliant member receives all remaining security/refills to which accounting entitles them. A member who fails to replenish by the deadline is marked defaulted and loses their future payout; their locked balance continues to cover their unpaid obligations. This makes the promised pot solvent even if someone defaults after receiving an early pot.

An equivalent UX is a $1,200 up-front prepaid contribution with monthly accounting. Calling it collateral does not change the liquidity requirement: if the product promises a fixed pot without an outside guarantor, that money has to be available onchain.

The contract must maintain, after every state transition:

```text
USDC balance >= unsettled guaranteed payouts + refundable member balances
total paid to recipients + contract balance == total USDC actually received
each round is settled at most once; each order slot is processed at most once
```

Keep separate internal buckets for committed dues, refundable security, and claimable payouts. Do not infer liabilities merely from `USDC.balanceOf(contract)`, because direct token transfers can create surplus.

### Cheaper alternatives change the promise

If locking $1,200 each is unacceptable, the honest alternatives are (a) pay only the USDC collected that month, so a default makes a short pot; (b) require a smaller bond and pay up to `collections + seized bond`; or (c) have a separately capitalized guarantor/insurance reserve. None guarantees $1,200 against arbitrary defaults. Future forfeited payouts are not funds available to cover today's recipient unless capital bridges the timing gap.

## Contract shape

Use a small factory plus one escrow contract (or isolated vault/accounting instance) per circle. Isolation limits accounting mistakes and makes balances auditable. The factory creates circles but is not needed afterward.

Important stored state:

- immutable USDC address, member list, payout order, start time, duration, deadline rule, amounts, and round count;
- `currentRound`, activation/cancellation/completion state;
- per-member deposited security, replenishments, default status, payout eligibility, and claimed amount;
- per-round payment bitmap, due amount, scheduled recipient, settled flag, and settlement totals;
- aggregate liabilities and any accidental-token surplus.

Important functions:

1. `joinAndFund(amount)` transfers USDC with `SafeERC20.safeTransferFrom`, credits the observed/expected amount, and records acceptance. Activation is permissionless once all 12 members have fully funded; otherwise anyone can cancel after a funding deadline and members withdraw.
2. `pay(round)` accepts exactly the due for the current round before its deadline. Supporting EIP-2612 should be conditional because USDC permit support differs by chain/version; ordinary allowance plus `transferFrom` must work. Never rely on the contract pulling later without a standing allowance.
3. `settle()` is callable by **any address** after the round deadline. It snapshots missed payments, marks new defaults, consumes the appropriate secured amounts, accounts for exactly one pot, and advances the round. Use checks-effects-interactions and `nonReentrant`.
4. `settleMany(maxRounds)` catches up expired rounds in bounded steps after downtime. It derives every deadline from the original schedule and stops before an unexpired round. Bounded looping prevents gas-limit griefing.
5. Prefer pull payments: settlement credits `claimable[recipient]`; `claim()` transfers USDC. A recipient contract that rejects or mishandles a transfer therefore cannot block round advancement. With standard USDC, direct transfer will usually work, but pull accounting is still safer.
6. `withdrawRefund()` becomes available after completion/cancellation and pays only the caller's accounted refundable amount.
7. `rescueSurplus()` may move only provable surplus above total liabilities, preferably after a delay. It can never withdraw escrow, refunds, or claims.

Emit events for creation, activation, every payment, missed payment/default, settlement, claim, refund, and surplus recovery. Provide view functions returning the current round, its exact deadline, who has paid, the next recipient, claimable amounts, and solvency (`assets`, `liabilities`, `surplus`).

USDC details and defenses:

- Pin the chain and canonical token address at deployment; do not accept an arbitrary look-alike token in the UI.
- Use `SafeERC20`, set state before external token calls, and add reentrancy protection.
- USDC can be paused or addresses can be blocked by its issuer. If the token itself refuses transfers, no susu contract can force progress. Settlement should still avoid losing accounting state; claims remain liabilities until transfers become possible.
- Do not add fee-on-transfer or rebasing tokens without balance-delta accounting and a new solvency analysis.
- Avoid an upgradeable proxy if possible. If upgrades are required, use a delayed multisig upgrade with an immutable escape/withdraw path and ensure an upgrade cannot seize liabilities.

## Default and payout semantics

At each deadline, `settle()` handles all members atomically:

1. Mark each member without that round's replenishment as defaulted and permanently payout-ineligible.
2. Charge that round's $100 obligation against the member's secured accounting regardless of whether they replenished; the onchain escrow therefore backs the pot.
3. Credit $1,200 to the scheduled recipient only if that recipient remains eligible under the committed rule.
4. If the scheduled recipient is ineligible, do not silently give a second turn to someone else. Credit no member payout for that slot and retain/reconcile the amount against remaining liabilities; after all obligations and claims are known, allocate any residual exactly as the membership agreement specifies (recommended: pro rata to non-defaulting members). This avoids both duplicate turns and discretionary operator decisions.
5. Mark the round settled and advance. Repeated calls are idempotent/revert cleanly.

One subtle policy must be decided: does missing the payment in one's own payout month forfeit that same payout? The simplest deterministic rule is yes—the payment deadline precedes settlement and eligibility is evaluated at settlement. Put this explicitly in the UI and tests.

## Six-week absence: what keeps working and what breaks

### What continues without the builders

- The chain and deployed immutable bytecode continue to exist.
- Members can approve USDC, make payments, inspect state, and claim already credited payouts if those functions are public and unpaused.
- After a deadline, any member, bot, or third party can call permissionless `settle()`/`settleMany()`.
- A hosted frontend is not required if members have the verified contract address, ABI, chain/RPC information, and simple transaction instructions.

### What does not happen automatically

- A timestamp condition does not invoke a contract. With no settlement caller, the deadline passes and the state remains on the old round.
- A cron job, backend, relayer, Gelato/Chainlink-style automation job, or builder EOA is offchain infrastructure. It can run out of native gas, lose RPC access, be paused, hit spending limits, or fail. It must be redundant convenience, not an authority.
- USDC allowances and balances are not scheduled payments. A member still has to pay, or must have deliberately granted a sufficient standing allowance to a permissionless pull mechanism. Standing unlimited allowances add risk and are not recommended.
- Email/SMS/push reminders and a hosted UI stop if their hosting, billing, domain, RPC keys, or notification worker stops. The contract can remain usable even when these do not.

### Exact failure modes in a naive/admin-operated deployment

- `onlyOwner advanceRound/finalize`: the first round ending during the trip cannot settle; no later round opens and nobody receives the next pot until an owner returns. If deadlines are based on the last advance, the entire schedule also drifts.
- Settlement sends to all parties in one push loop: one failing transfer can revert the whole round forever.
- Settlement loops over unbounded circles/members/rounds: it can exceed the block gas limit. Twelve members is bounded, but global batch settlement is not.
- Paused contract with only the absent builders as unpausers: all guarded functions remain unavailable. Normal settlement, claim, and safe exit should not share an admin pause switch.
- Single automation wallet: when it runs out of native gas or its key/service fails, settlement stops. Contract funds cannot pay transaction gas unless account abstraction/relaying is separately implemented.
- Upgrade/admin multisig requiring either absent builder: emergency action cannot reach quorum. Conversely, handing a hot key to one person creates seizure and mistake risk.
- Under-collateralized circle: the first missed contribution leaves less than $1,200. Code can revert, pay short, or consume some other circle's funds; none matches the promise. Never commingle circle balances.
- Recipient or member is USDC-blocklisted: their transfer/claim can fail. Pull claims prevent that failure from blocking accounting for everyone else, but the blocked person cannot receive USDC while the issuer restriction remains.

Whether **already deployed** circles are safe cannot be answered from a design document alone. Before leaving, inspect the exact deployed bytecode/source and roles for every active circle. If it has an owner-only transition or insufficient collateral, documentation or a new keeper cannot change that logic. The choices are to use the existing authorized key during the trip, perform an authorized upgrade before leaving (if safely upgradeable), or wind down/refund and migrate members to a corrected deployment. Never promise that a new contract can rescue funds locked in an immutable old one.

## Before-leaving checklist

1. Verify source and bytecode for every deployed address and record chain, canonical USDC address, implementation/proxy admin, owner, pauser, and all role holders.
2. On a fork, advance time by at least six weeks and test: two expired deadlines, missed payments (including the month's recipient), repeated settlement, `settleMany`, failed/blocked recipient transfer behavior, USDC pause, and complete accounting/refunds.
3. Confirm each active circle is solvent onchain: actual USDC assets are at least all claims, refunds, and guaranteed unpaid pots. If not, top up from an explicitly agreed guarantor, change the promise with unanimous informed consent, or unwind before leaving.
4. Remove builder-only dependencies. Make activation and settlement permissionless. Do not renounce an owner role as a substitute for reviewing every owner-gated path.
5. Configure at least two independent keeper accounts/services, fund each with native gas, cap their permissions to public calls, and alert on missed deadlines/low balances. Give all members manual settlement instructions as the fallback.
6. Ensure the frontend is static/redundant where possible, contract source and ABI are verified, and members have a block-explorer link plus instructions for `pay`, `settle`, `claim`, and viewing deadlines without the frontend.
7. Use a multisig whose quorum is available during the trip for genuinely necessary emergency powers. Nominate responders, document objective conditions for using pause/upgrade, and run a transaction rehearsal. If nobody trustworthy is available, prefer immutable operation and a member withdrawal escape hatch over an unusable emergency role.
8. Set monitoring for `deadline passed && !settled`, insolvency, failed keeper transactions, low keeper gas, unexpected role changes/upgrades, USDC pause/blocking, and RPC/frontend health. Route alerts to someone who is actually present.
9. Freeze new deployments/configuration shortly before departure and leave time to observe at least one full test/staging settlement. Do not make an untested last-minute upgrade to active funds.

## Tests and audit gates

- Unit/property tests prove conservation of USDC, liabilities never exceed assets, no double payment/turn, immutable order, permanent default, exact boundary behavior at deadlines, and safe cancellation.
- Stateful fuzzing varies payment/default sequences and call ordering; the invariant must hold after every action.
- Fork tests use the real chain's canonical USDC and exercise its actual return/permit/pause behavior.
- Adversarial tests cover reentrancy, direct token transfers, repeated settlement, catch-up after many rounds, malicious recipient contracts, role compromise, and rounding (although fixed 6-decimal amounts should have none).
- An independent smart-contract review is required before holding $14,400 per circle, followed by a capped pilot circle and documented incident/wind-down procedure.

## Go/no-go conclusion

Go away for six weeks with active circles only if (1) their existing deployed logic is permissionless on the normal path, (2) they are fully solvent for the promised fixed pots, (3) at least one non-builder can and has rehearsed manual settlement, and (4) monitoring and funded automation have independent coverage. If any condition fails, the correct answer is that the circle may stall or underpay while the builders are gone; fix or migrate it before departure rather than relying on timestamps or a single bot.

# Susu — onchain savings circle

Two contracts, one chain, no operator. The whole design is driven by one
constraint: **nobody is around for six weeks**, so no state transition may
depend on us.

---

## 1. The headline answer

**Yes, running circles keep working — but only if they were built the way
described below.** The rotation is not a scheduled job; it is a pure function of
`block.timestamp`. Nothing "advances" the circle. Rounds open and close whether
or not any transaction is ever sent, and every function that moves money is
called by the person who directly benefits from calling it.

What that buys us: six weeks covers one or two round boundaries. Those
boundaries pass unattended, correctly, with zero calls from us.

What still breaks while we're gone is **not the contract** — it's four things,
listed with fixes in §7. Short version, ranked by how likely it is to actually
bite:

| # | Breaks | Likelihood in 6 weeks | Contract survives? | Must fix before leaving |
| - | --- | --- | --- | --- |
| 1 | Frontend / RPC key rot — people can't reach the UI to pay, miss a round, cascade into forfeits | **High** | Yes | **Yes** |
| 2 | A member defaults post-payout (took the pot, stopped paying) | Medium | Yes, haircuts | Yes — decide the rule now |
| 3 | A recipient loses their key or gets blacklisted by Circle; their pot is stuck forever | Low | Yes | Accept, in writing |
| 4 | We shipped an owner-only `advanceRound()` / pause / upgrade proxy | — | **No** | **Delete it** |

Item 4 is the one that would sink us, and it's the default shape most people
build. If the current code has an owner key that is required for any transition,
the circles do **not** survive six weeks and that is the thing to fix first.

---

## 2. Onchain / offchain boundary

**Onchain** (this is all of it):
- Member set and payout order, frozen at start. This is the commitment the whole
  product is about — it has to be unchangeable by us or by a majority.
- USDC custody and every transfer.
- Who paid which round, who defaulted, who claimed.

**Offchain**: names, avatars, the circle's display name, chat, reminders, the
"who still owes" dashboard. All derived from events. Nothing offchain is on the
critical path for money moving — if our backend is down for six weeks, the
circle still settles through Etherscan.

Explicitly **not** onchain: reputation scores, a "reliability" leaderboard,
cross-circle history. Those are computed from `DuesPaid` / `Defaulted` events by
an indexer. Storing them would add writes to every settlement for a browse
screen.

---

## 3. Contracts (2)

| Contract | Why it exists |
| --- | --- |
| `SusuCircle` | One immutable instance per circle. Holds that circle's USDC. |
| `SusuFactory` | Deploys `SusuCircle` as an EIP-1167 clone. |

The factory earns its place on a trust boundary, not on convenience: **each
circle's funds live in their own contract.** An accounting bug or a griefing
pattern in one circle cannot touch another circle's balance, and a circle's
parameters are immutable clone-init args rather than rows in a shared mapping
that could be confused with each other. Clone deploy cost on an L2 is
negligible.

No escrow, no router, no fee splitter, no treasury. USDC is the only external
protocol and we hold it directly.

### Immutable per-circle parameters

```
IERC20  token            // native USDC on Base
uint256 dues             // 100e6
uint256 roundLength      // 30 days
uint256 startTime
uint256 grace            // 5 days
address[12] members      // index i == the recipient of round i
```

### Storage

```
mapping(address => uint16) paidMask;   // bit r set == member paid round r
uint16  claimedMask;                   // bit r set == round r's pot was taken
uint16  forfeitedMask;                 // bit r set == member r forfeited their turn
uint256 reserve;                       // USDC held back to top up short pots
mapping(address => bool) surplusTaken;
```

`round()` is `(block.timestamp - startTime) / roundLength`, clamped to 12. It is
a `view`. **No transaction advances it.** This is the single most important line
in the design.

---

## 4. The default rule, and why it actually balances

The stated rule — "they forfeit their turn and their earlier contributions cover
the shortfall" — has a hole worth naming before we build on it: **a defaulter's
earlier contributions are not sitting in the contract.** They were paid out to
earlier recipients months ago. There is no pile of their money to draw on.

The rule works anyway, but the money comes from somewhere else, and it's worth
being precise because the arithmetic is what makes the circle self-healing with
nobody watching.

**Mechanism: the forfeited member's own round becomes the reserve.**

Member `D` stops paying at round `k`, and `D`'s turn is round `t > k`.

- Every other member keeps paying all 12 rounds. Nothing changes for them.
- Each round from `k` on collects only 11 × $100 = $1,100 instead of $1,200.
- When round `t` arrives, `D` is in default, so `D` cannot claim. The $1,100
  collected that round goes to `reserve` instead.
- Every short pot, before and after `t`, is topped up from `reserve` to the full
  $1,200.

Does it cover? Shortfall is $100 for each of rounds `k..11` except `t` itself:
`(12 - k) × $100`, at most $1,100 when `k = 1`. Reserve is $1,100. **It always
covers, for every `k`.** Leftover is exactly `(k - 1) × $100` — precisely what
`D` had paid in before defaulting — and is split pro-rata among the 11 honest
members after round 12 via `withdrawSurplus()`.

So: every honest member receives a **full $1,200 pot**, the defaulter loses
exactly what they put in, and the books close to zero. No admin judgement call,
no top-up from us, no deadlock. That is what lets a default happen in week 3 of
our absence and resolve itself by week 4.

### The case that does *not* balance

`D` receives the $1,200 pot in round `t`, then stops paying at round `k > t`.
They have no turn left to forfeit. They took $1,200 having paid `t × $100`. The
deficit is real money that does not exist, and no contract can conjure it.

**Decision: pro-rata haircut.** Each remaining pot pays out what is actually
available (collected + reserve), so the loss is spread across the recipients who
haven't gone yet rather than dumped entirely on the last person in line. The
contract emits `PotShort(round, expected, actual)` and keeps going. It does not
halt, and it does not wait for us.

We should be honest in the UI that this is the residual risk and that it is
bounded by social trust, not by code. Two things reduce it and both are cheap:

- A **one-month deposit** ($100) posted at join, returned after round 12. It
  doesn't cover $1,200, but it makes the earliest rounds solvent and gives
  everyone skin in the game. Recommended.
- Put the people who need trust least early in the order — that's a
  circle-formation norm, not code.

We are **not** shipping collateralization (a $1,200 bond destroys the reason to
join a susu) and **not** shipping an auction for slots in v1.

### Cure

A member in arrears may call `cure()` and pay everything they owe, any time
before *their own* round opens. Default is only permanent once round `t` opens
uncured. This is the mechanism that replaces the human who would otherwise say
"she's fine, she was travelling, let her pay late" — it has to be in the code,
because that human is on a plane.

---

## 5. State transitions

Every row's caller is someone who wants the transaction to happen for their own
reasons. There is no keeper, no cron, no owner.

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `SusuFactory.create(members, params)` | circle organiser | they want the circle | no circle exists; existing circles unaffected |
| `payDues(member, round)` | anyone, funds from `msg.sender` | pays own dues, or covers a relative's | that member accrues arrears; they can `cure()` later |
| `pullDues(member, round)` | **anyone — in practice the round's recipient** | pulls everyone's dues into *their own* pot; strongest incentive in the system | pot is short; topped from `reserve`; member may still pay or cure |
| `claim(round)` | round `r`'s recipient | receives up to $1,200 | **funds stay claimable forever.** Circle continues; later rounds unaffected |
| `cure()` | the member in arrears | restores their turn | their forfeit becomes permanent when their round opens |
| `withdrawSurplus()` | each non-defaulting member | receives their share of leftover reserve | their share stays claimable forever |
| `withdrawDeposit()` | each member | gets their $100 back after round 12 | stays claimable forever |

Notes that matter for the six weeks:

- **Round advancement has no row.** It is arithmetic on `block.timestamp`.
  That's the property that makes absence safe.
- **Default has no row.** There is no `markDefault()`. Default is
  `paidMask` read lazily at claim time. Nobody has to notice a default for it to
  take effect.
- `pullDues` is the liveness feature, not a nicety. Members grant one USDC
  allowance at join; from then on, if a member is asleep, on a plane, or can't
  reach our frontend, **the round's recipient pulls the dues themselves**,
  because a full pot is worth $100 of their money and gas is a fraction of a
  cent. Bounded: one pull per `(member, round)`, exact `dues` amount, only for
  rounds that have already opened. Maximum extractable is exactly what the
  member already agreed to owe.
- `claim` never expires and funds can never be redirected. A stuck claim is a
  stuck claim — see §7.3.

---

## 6. Chain: Base

- **Native USDC issued by Circle** (not a bridged wrapper) — for a product whose
  entire unit of account is a dollar, we cannot have members holding a
  depeggable bridge asset for 12 months.
- **Coinbase Smart Wallet / passkeys.** The members are family. Passkey
  onboarding with no seed phrase is the difference between this working and not.
- **Onramp.** Members need to turn $100 of bank money into USDC twelve times.
  Base's Coinbase onramp path is the shortest one that exists.
- **Fees.** A round is 12 `pullDues` + 1 `claim`. On Base this is a cent-scale
  total, which keeps the recipient's pull incentive intact — but measure it
  rather than trusting this sentence:

  ```
  cast gas-price --rpc-url https://mainnet.base.org
  cast block --rpc-url https://mainnet.base.org -f baseFeePerGas
  ```

  Re-check before launch; if a `pullDues` sweep ever costs more than a few
  dollars the incentive argument weakens and we revisit.

USDC on Base — **verify against Circle's official address list before deploying,
do not trust this document**:

```
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
cast call <addr> "symbol()(string)" --rpc-url https://mainnet.base.org   # expect USDC
cast call <addr> "decimals()(uint8)" --rpc-url https://mainnet.base.org  # expect 6
```

---

## 7. What actually breaks while we're away

### 7.1 Frontend and RPC rot — highest risk, fix before leaving

The contract is fine; people just can't reach it, miss a round, and trip a
forfeit that didn't need to happen. Six weeks is long enough for a trial RPC key
to expire, a Vercel build to break on a dependency, or a subgraph to fall behind.

Fix before we go:
- Audit every API key on the critical path for an expiry inside 10 weeks. Move
  anything expiring to a paid plan or remove it.
- Public RPC fallback hardcoded in the client, so a dead key degrades instead of
  failing.
- Pin a static build to IPFS and put the hash in the group chat. It must work
  with zero backend — reads from the RPC, writes through the wallet.
- Verify contracts on Basescan and tell every member, in writing, that
  **"Write Contract" on Basescan is the fallback if the app is down.**
- Freeze the frontend. No deploys the day we leave.

### 7.2 Someone defaults

Pre-payout default: handled entirely by §4, resolves itself, no action needed.

Post-payout default: real loss, pots get haircut, circle keeps running. Nothing
to fix remotely, and nothing we could have fixed even if we were there — it's a
social recovery problem. Before we leave, make sure the circle has a named human
(not us) who chases payments, and that the $100 deposit is live.

### 7.3 A recipient's claim gets stuck

Lost key, or Circle blacklists their address. Their $1,200 sits claimable
forever and the rest of the circle continues normally.

We are **accepting** this, deliberately. The alternative is an owner key or a
timeout-and-redirect, and either one is a mechanism for taking a member's money
— which is exactly the thing the contract exists to make impossible. A
"rescue" function we could use from abroad is a rescue function anyone who
compromises us can use. State it in the join screen.

### 7.4 Anything owner-controlled

If the deployed code has an owner-only `advanceRound`, `pause`,
`setRecipient`, or a proxy we can upgrade, then the honest answer to the
question is **no, those circles do not survive six weeks** — they survive
exactly as long as one of us keeps checking a phone.

Before leaving, for every already-running circle:

```
cast call <circle> "owner()(address)"     # expect revert / 0x0
cast storage <circle> 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
# ^ EIP-1967 impl slot — expect 0x0 for a non-proxy
```

If either returns something live: renounce ownership and/or burn the proxy admin
**before** we go. A dormant admin key on a contract nobody is watching for six
weeks is worse than no admin key at all.

---

## 8. Pre-departure checklist

- [ ] `owner()` reverts and no live proxy admin on every deployed circle.
- [ ] `round()` is `view` arithmetic; grep the codebase for any state-changing
      round advance and delete it.
- [ ] Tests: default at round 1 and round 11 (reserve covers both exactly);
      post-payout default haircut; cure on the last block before forfeit;
      double-claim; `pullDues` cannot over-pull; claim after 12 months of
      silence still works.
- [ ] Fork test against real Base USDC, including a blacklisted-recipient case.
- [ ] Contracts verified on Basescan; members told it's the fallback.
- [ ] Static frontend pinned to IPFS; hash in the group chat.
- [ ] All API keys good for >10 weeks.
- [ ] Every member has granted the USDC allowance so `pullDues` works without
      them.
- [ ] One named non-developer per circle owns chasing payments.
- [ ] A fresh reviewer who didn't write it reads the default arithmetic in §4.
- [ ] Post-deploy smoke test on mainnet: create a 2-member circle with $1 dues,
      `pullDues` both, `claim` round 0, confirm the USDC lands.

## 9. Deployment runbook

```bash
export BASE_RPC_URL=https://mainnet.base.org
export BASESCAN_API_KEY=...
export DEPLOYER_PK=...                  # hot key, deploy only, no ownership
export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # verify first, §6

forge test -vvv
forge test --fork-url $BASE_RPC_URL --match-path test/fork/*

# implementation
forge create src/SusuCircle.sol:SusuCircle \
  --rpc-url $BASE_RPC_URL --private-key $DEPLOYER_PK \
  --verify --etherscan-api-key $BASESCAN_API_KEY

# factory (immutable, no owner)
forge create src/SusuFactory.sol:SusuFactory \
  --constructor-args <IMPL> $USDC \
  --rpc-url $BASE_RPC_URL --private-key $DEPLOYER_PK \
  --verify --etherscan-api-key $BASESCAN_API_KEY

# smoke test, §8
cast send <FACTORY> "create(address[],uint256,uint256,uint256)" \
  "[<A>,<B>]" 1000000 604800 $(cast block latest -f timestamp) \
  --rpc-url $BASE_RPC_URL --private-key $DEPLOYER_PK
```

**Ownership destination: none.** Neither contract has an owner. There is no
multisig, because there is nothing for a multisig to do — which is the entire
point of being able to leave for six weeks.

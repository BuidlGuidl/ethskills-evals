# Tipping a line cook from a 200k-subscriber restaurant newsletter

Two questions, answered in order:

1. The walkthrough of a first-time reader's first tip — every screen, signup, install, and dollar.
2. What would have to change about this product for that setup to be the wrong one.

The short version up front, because the walkthrough is long and the conclusion
matters more than the suspense: **for the product as described, the onchain
setup is the wrong one.** The walkthrough below is the argument. Read the step
count and the first-tip fee, not the prose.

---

## Part 1 — The first-time reader's first tip

### Ground rules for this walkthrough

I'm walking the *best available* crypto path, not a strawman. That means:

- **Base Account** (Coinbase's passkey smart wallet) — no app install, no seed
  phrase, no browser extension. Account creation is a Face ID / Touch ID /
  Windows Hello prompt in the browser the reader already has open.
- **USDC on Base** — the unit. Not ETH, not a volatile asset.
- **Sponsored gas** via a paymaster — the reader never holds ETH and never sees
  the word "gas."
- **Coinbase Onramp** — because you told me many readers already have Coinbase
  accounts, which is the single biggest advantage this audience has.

Every one of those choices removes a step that a naive crypto build would have.
The walkthrough is still what follows.

### The reader's path

**Screen 0 — The newsletter email.**
Reader is in Gmail on their phone. Issue #180, profile of Marisol, line cook at
a taqueria on the east side. At the bottom: **"Tip Marisol — $1 / $3 / $5."**

Email clients don't run JavaScript and can't hold a wallet, so every button is a
link out. Tapping $3 opens the mobile browser. *That is unavoidable in any
design, card or crypto — it is not a crypto tax.* Note it as the baseline: the
card path also starts here.

**Screen 1 — Tip page.**
Photo of Marisol, amount pre-selected at $3, a "Tip $3" button. Clean. Good.

**Screen 2 — "Create your account."**
Reader taps Tip. They have no wallet. Base Account prompts for a passkey:
"Use Face ID to create an account for tips.example.com?"

This is the best-case screen in all of crypto and it is still a screen that says
*create an account* to someone who wanted to give a cook three dollars.

Failure modes that are not rare at 200k scale:
- Older Android / older iOS without passkey support
- Corporate-managed or locked-down browsers
- In-app browsers (Gmail's own webview, Facebook's, LinkedIn's) — passkey
  behavior here is inconsistent and is where a meaningful slice of email
  traffic actually lives
- Readers who tap "Not now" on a biometric prompt out of reflex

Each of these is a support ticket, and each ticket costs more than the tip.

**Screen 3 — "Your balance is $0.00."**
The account exists and is empty. This is the real wall. Creating a wallet is
easy now; *funding* one is not, and funding is the step that has never gotten
meaningfully cheaper for small amounts.

**Screen 4 — Coinbase Onramp opens.**
"Sign in to Coinbase to buy USDC."

**Screen 5 — Coinbase login.** Email, password, 2FA code.

**Screen 6 — Possible identity re-verification.** Dormant accounts, accounts
that have never transacted, or accounts in certain states get pulled into ID
re-checks. Some readers will be asked to photograph a driver's license. For a
$3 tip.

**Screen 7 — Choose payment method and amount.**
Coinbase balance if they have one (instant), debit card (near-instant, higher
fee), or ACH bank transfer (cheapest, **1–5 business days**).

Two things bite here:
- **There is a purchase minimum** — typically around $2, sometimes more
  depending on region and method. You cannot buy exactly $3 of USDC and have it
  come out even after fees.
- **Sub-$10 purchases carry a fee floor.** Historically this has been roughly
  the greater of a ~$0.99 flat fee or a few percent, plus spread. *Verify the
  current schedule for every region you mail into before you commit — do not
  build on my recollection of a fee table.*

So the reader buys $5 of USDC to send a $3 tip, and pays roughly $1 for the
privilege. **First-tip overhead: ~20–33%.**

**Screen 8 — Confirm purchase.** Fee disclosure. Reader sees "$5.00 + $0.99
fee." Some non-trivial fraction of readers stop here, and they are right to.

**Screen 9 — Waiting.** Instant from Coinbase balance. Minutes from card.
Days from ACH — and if they picked ACH, the newsletter issue is stale and
Marisol's moment has passed by the time the money lands.

**Screen 10 — Back on the tip page.** Balance now $4.01 (or whatever survived).
"Tip $3" is finally live.

**Screen 11 — Sign.** Face ID again. With a paymaster and a spend permission
this is one touch and no gas prompt. This screen is genuinely good.

**Screen 12 — Confirmation.** "Marisol got $3.00." Optional block explorer
link that no reader will click. Onchain settlement on Base is ~2 seconds and
costs a fraction of a cent. *Measure current Base fees before launch rather
than trusting that sentence.*

**Screen 13 — The leftover.** The reader has $1.01 of USDC stranded in a
passkey wallet they will never open again. Multiply by every reader who tips
once. You have created thousands of tiny abandoned balances, which is a
support-and-goodwill liability, not an asset.

### What the reader had to do

| | |
|---|---|
| Screens | 13 |
| Accounts created or signed into | 2 (Base Account, Coinbase) |
| Identity checks | 1–2 |
| Installs | 0 (the one genuine modern win) |
| Funding events before money moves | 1, with a fee floor |
| Fee on a $3 tip | ~$1.00, i.e. **~33%** |
| Money actually reaching Marisol | $3.00 |
| Stranded afterward | ~$1.01 |
| Time, best case (Coinbase balance) | 3–5 minutes |
| Time, ACH case | 1–5 days |

### And it isn't over — Marisol's side

The walkthrough above stops when the money reaches an address. It has not
reached a person.

- Marisol needs her own wallet, which someone from your staff will set up for
  her, which makes you her de facto key-recovery support desk.
- She needs to offramp USDC → USD → bank account. That is a Coinbase account,
  KYC, a linked bank, a sell, and 1–3 days of ACH.
- Every offramp has its own fee, which lands on a pile of $3 tips.
- Tips are taxable income. If your newsletter is the thing directing money to
  her, expect questions about reporting and about whether you are facilitating
  payments to her employer's staff.
- **Tip-pooling and tip-credit law.** Many kitchens have tip-pool arrangements,
  and back-of-house tipping interacts with tip-credit rules in ways that vary by
  state. A public "tip *this specific cook* directly" button can put the
  restaurant sideways with its own policy or with labor law. This is not a
  crypto problem — it applies identically to the card version — but it is the
  issue most likely to kill the product outright, so get counsel on it **before**
  you pick a payment rail. Picking a rail for a product that can't legally
  operate is wasted work.

### The comparison you're implicitly asking for

The same reader, same email, Stripe with Apple Pay:

| | |
|---|---|
| Screen 0 | Email, tap "Tip Marisol $3" |
| Screen 1 | Tip page, Apple Pay sheet, double-click side button |
| Screen 2 | "Marisol got $3." |
| Accounts created | 0 |
| Identity checks | 0 |
| Fee on $3 | ~$0.39 (2.9% + $0.30) |
| Time | ~10 seconds |

**3 screens versus 13. $0.39 versus ~$1.00.**

Crypto wins decisively on *marginal* cost — a Base USDC transfer is a fraction
of a cent against Stripe's 13% on a $3 charge. It loses decisively on
*first* cost, because funding a wallet has a fee floor around a dollar and card
rails have a fee floor of thirty cents. **Your product is almost entirely
first-tips.** 200,000 readers, tipping in bursts, most of them once or twice.
You will live on the wrong side of that crossover essentially forever.

### The number that should decide this

Funnels are multiplicative. Every required step drops a large share of whoever
is left, and "create an account" and "buy currency" are the two most brutal
steps in commerce.

Illustratively — these are not measured, they are the shape of the thing:

- Card path: 200,000 readers → ~1.5% tip → ~3,000 tips → ~$9,000/issue,
  ~$7,800 net to cooks.
- Crypto path: 200,000 readers → maybe 0.1–0.3% survive account creation *and*
  funding → 200–600 tips → ~$1,200/issue, minus onramp and offramp drag.

You are choosing between roughly $7,800 and roughly $1,000 reaching line cooks
per issue. Plug in your own conversion assumptions; the ratio is robust to
almost any numbers you pick, because the crypto path has two extra
order-of-magnitude filters in it.

### Recommendation

Ship the card path. Stripe Connect with **the cook (or the restaurant) as the
recipient of record**, not you — that keeps you out of the flow of funds and out
of money-transmitter territory. Apple Pay and Google Pay on by default. Three
screens.

Do not build a contract. Do not build a wallet. There is nothing in "reader
sends $3 to cook, once, after reading an email" that requires trustless
settlement, composability, censorship resistance, or a permanent commitment.
The onchain part of the crypto design was never the problem — Base at a
fraction of a cent per transfer is genuinely excellent — but everything you'd
have to bolt onto it to get 200,000 non-crypto readers *to* that transfer costs
more than the transfer saves.

If you want the option open: put a plain USDC-on-Base address on the tip page as
a secondary option for the handful of readers who already have funded wallets.
Zero contracts, zero infrastructure, and it tells you empirically how many of
your readers are in that bucket. If that number is surprisingly large, Part 2
becomes live.

---

## Part 2 — What would have to change for that setup to be wrong

Sorted by how likely each is to actually be true for you. The first two are
real; the rest are conditions to watch.

### 1. The cooks can't onboard to card rails *(strongest flip)*

Stripe Connect needs an identity, an SSN or ITIN, and a US bank account. If a
meaningful share of the line cooks you want to feature can't or won't provide
those — no bank account, no work authorization they want examined, a restaurant
that refuses to let staff onboard individually — then the card rail does not
reach the recipient at all. A 3-screen checkout that ends nowhere loses to a
13-screen one that ends in Marisol's hands.

**Check this first, before anything else in this document.** Ask five cooks.
This is a question about the kitchens in your city, not about payments, and it
is the only condition here that can flip the decision on its own. A non-custodial
address needs no bank, no SSN, and nobody's permission.

Note that it only half-flips it: the cook can now *receive*, but they still have
to offramp to spend, which drags them back into the same KYC they were avoiding.
It's a real advantage only where the cook has some use for dollars that stay
digital.

### 2. Cross-border tipping

If the newsletter goes international, or you want readers here to tip cooks
elsewhere, card payouts get slow and expensive and stablecoins get very good
very fast. This is stablecoins' strongest genuine use case. It's just not the
one you described — "our city's restaurants" is the opposite of a remittance
corridor.

### 3. Tips stop being one-way transfers

If a tip becomes something other than money moving once:

- **Auto-splitting across the kitchen brigade** by rules readers can inspect
- **Pooled and streamed** over a shift or a week
- A tip that **confers something** — a membership, table priority, a share of
  something

then you have programmable money with rules multiple parties need to trust
without trusting you, and a contract starts earning its place. A fee-splitter
alone doesn't justify it — Stripe can split too, and 0xSplits exists if you go
onchain. What justifies it is *readers needing to verify the split without
trusting you*.

### 4. Verifiability becomes the product

If your pitch shifts from "tip a cook" to "**every dollar is publicly auditable
and we provably take none of it**," a public ledger is the feature rather than
the plumbing. Readers could check any cook's address themselves. This is real
but soft — most readers will trust a reputable newsletter's word — and it only
matters if you expect to be doubted.

### 5. Amounts drop below the card fee floor

Stripe's $0.30 floor makes a $0.25 tip absurd (it would be a 120% fee); a Base
transfer costs a fraction of a cent regardless. If the product becomes
"one-tap $0.25 tips, many per issue," cards break and onchain doesn't. **But**
this only helps if the money is already onchain — the funding wall in Part 1 is
untouched. This condition flips the decision only in combination with #6.

### 6. Your readers arrive already funded

Screens 2 through 10 — the entire cost of the crypto path — exist only because
the reader shows up with no wallet and no balance. If a meaningful share of your
readers arrived with a funded Base Account, the crypto path collapses to *three*
screens with a fee of a fraction of a cent, and it beats Apple Pay outright.

You told me almost none of them have used a wallet, so this is false today. It's
the condition most likely to change on its own over the next few years, without
you doing anything — which is the argument for the secondary-address experiment
above rather than for building now.

### 7. Chargebacks become a real cost

Card tips can be reversed for months afterward. If "friendly fraud" clawbacks
from Marisol's account after she's spent the money turn out to be a recurring
problem, irreversible settlement stops being a scary property and becomes a
protective one. Watch your dispute rate for two or three issues before giving
this weight — it may be nothing.

### What does *not* flip it

- **"Ethereum is expensive."** Base already solved that. Settlement cost was
  never the reason to skip this; reader onboarding was.
- **Burst load.** 3,000 tips in an hour is trivial for Base and trivial for
  Stripe. Your bottleneck in the crypto design is the onramp and your own
  support inbox, neither of which is a throughput problem you can engineer away.
- **Wanting to be innovative.** The build that gets the most money to line cooks
  is the interesting one. Right now that's a card form.

---

## Appendix — If one of those conditions holds, here's the build

Only if #1 or #2 is true today, or #3+#4 together. Kept deliberately tiny.

**Custom contracts: zero.** Readers send USDC directly to each cook's address.
No escrow, no router, no factory. If you later need kitchen splits, use an
audited splitter rather than writing one; only write your own if its trust
boundary is genuinely different, and stop at one contract.

**Onchain:** the value transfer. That's all.
**Offchain:** cook profiles, photos, issue archives, tip totals, leaderboards,
"most-tipped cook this month." Derive those by indexing USDC `Transfer` events
to your registered cook addresses and computing in your own database. Never put
a ranking, a counter, or a paginated list in contract storage to serve a browse
screen.

**State transitions**

| Transition | Caller | Why they pay gas | If nobody calls |
|---|---|---|---|
| `USDC.transfer(cook, amount)` | reader (gas sponsored by paymaster) | it is the tip; they chose to send it | no tip is sent — nothing is stuck, no one is owed |
| Cook moves or offramps funds | cook | it's their money | funds sit in the cook's wallet indefinitely, fully under their control |

Two transitions, both self-serve, no keeper, no cron, no owner-only path, and no
state that can get stuck if a process dies. That's what a design with no custom
contracts buys you — and it's a sign the contract wasn't needed.

**Chain: Base.** Not because "Ethereum is expensive" but for three
product-specific reasons: your readers' existing Coinbase accounts are the
shortest funding path onto it, Base Account gives passkey wallets with no
install, and native USDC plus paymaster gas sponsorship means readers never
touch ETH. Verify current Base fees before launch rather than trusting a
remembered figure.

**Runbook.** With zero custom contracts there is no deployment. What you
actually need to stand up:

- Native USDC on Base — take the address from Circle's official documentation.
  Do not copy it from a blog post, a chat message, or from me; a wrong token
  address sends real money somewhere you can't get it back.
- A paymaster with a per-address and per-day spend cap, so a bug or an abuser
  can't drain sponsorship in one burst.
- A cook registry in your own database: name → address, with a **two-person
  approval** to add or change an address. An attacker who can swap one address
  redirects every tip for that issue. This is your single highest-value control
  and it is a database permission, not a contract.
- End-to-end verification before launch: send $1 from a fresh passkey wallet on
  a fresh device, on the real production site, and confirm it lands, indexes,
  and shows up on the cook's screen.
- An offramp answer for the cooks, decided before launch, not after. If you
  can't answer "how does Marisol buy groceries with this," you haven't shipped a
  tipping product.

If you build this, have someone who didn't design it walk the whole reader path
on their own phone before you mail 200,000 people.

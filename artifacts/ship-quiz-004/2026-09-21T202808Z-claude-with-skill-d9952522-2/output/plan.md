# Tipping a line cook from a 200k-subscriber restaurant newsletter

Two parts, as asked:

1. The first-time reader's first tip, screen by screen — the best-case onchain
   version, then the fiat version, so the comparison is concrete.
2. What would have to change about this product for the recommended setup to be
   the wrong one.

Verdict up front, so the rest reads in context: **for the product as described,
build this on Stripe or a Cash App / Venmo handle, not onchain.** The onchain
version is buildable and I've specced it below — but the friction it adds lands
entirely on a $3 transaction, and none of the things that make onchain payments
worth that friction are present in your description. There is one condition that
would flip this decision hard, and it is unusually likely to be true for a line
cook specifically. It is the first item in Part 2. Check it before you decide
anything else.

---

## Part 1 — The first tip, screen by screen

### 1a. The onchain version, built as well as it can currently be built

Assumptions, which are the generous ones: Base mainnet, USDC, an embedded wallet
created from an email address (Coinbase Embedded Wallet or Privy — no browser
extension, no seed phrase shown to the reader), gas fully sponsored by a
paymaster so the reader never touches ETH, and Coinbase Onramp for funding. This
is the low-friction end of what ships today. Anything involving MetaMask, a seed
phrase, or the reader buying ETH for gas is strictly worse and shouldn't be
considered.

| # | Screen | What the reader does | New account / install / funding |
|---|---|---|---|
| 1 | The email | Taps **Tip Marisol $3** | — |
| 2 | Tip page (mobile web) | Sees the cook's photo, picks $1 / $3 / $5, taps Continue | — |
| 3 | Email capture | Types their email | — |
| 4 | App switch → mail app | Leaves the browser, opens mail, finds the code, copies it | — |
| 5 | Code entry | Pastes the 6-digit code | **Wallet silently created** |
| 6 | "Setting up your account" | Waits ~2–5s | — |
| 7 | Balance: $0.00 → **Add funds** | Realizes the $3 tip requires buying $3 of something first | **The wall** |
| 8 | Onramp provider takeover | Redirected to Coinbase Onramp | — |
| 9 | Coinbase sign-in | Email, password, 2FA code (another app switch) | Reader with a Coinbase account: skips KYC. Reader without one: **full identity verification — legal name, DOB, address, SSN, photo ID upload.** Minutes to days. |
| 10 | Purchase screen | Picks payment method, sees a minimum purchase (typically ~$2–$5, provider-dependent) and a fee that is a double-digit percentage of a $3 purchase | **Card or bank account linked** |
| 11 | Confirm purchase | Confirms. Card/Apple Pay: seconds. ACH: settles in days. | — |
| 12 | Back to the tip page | Balance now reads $3.00 (or $5, after the minimum). Taps **Send tip** | — |
| 13 | Signing | One tap, no gas prompt (sponsored) | — |
| 14 | Success | "Marisol got $3." Basescan link. | — |

**What that costs the reader:** 14 screens, two app switches, one new financial
account with a password and 2FA, and — for anyone who isn't already a Coinbase
customer — a KYC identity check with an SSN and a photo of their driver's
license, all standing between them and a $3 gesture of appreciation. The onramp
fee on a $3 purchase is frequently 15–30% of the amount; check current Coinbase
Onramp pricing and minimums before you rely on any number, but the structural
point holds regardless of the exact figure: flat-ish fees are catastrophic at
the $1–$5 ticket.

**What it costs you:** almost nothing in gas. A USDC transfer on Base is well
under a cent, so sponsoring 2,000 tips in a post-issue burst costs you single-digit
dollars. Gas is genuinely not the problem here, and if anyone pitches this build
on "Base is cheap," they are answering a question you don't have. The cost is
screens 3 through 11.

**Second-order costs nobody puts in the deck:**

- **Screen 9 is where the funnel dies.** Every reader who has never bought
  crypto hits an SSN prompt. On a $3 tip, a meaningful majority close the tab.
  Your "many readers already have Coinbase accounts" fact is real and it does
  help — those readers skip KYC and get a much shorter path — but it only helps
  the subset, and you still pay screens 3–8 and 10–12 for them.
- **The cook has a job too.** Marisol needs a wallet she doesn't lose, and she
  needs to convert USDC to rent money: send to Coinbase, sell, ACH out, 1–3
  days. If she loses the key, the money is gone with no recourse — unlike a
  Venmo password reset.
- **Tax and tip law apply identically on any rail.** A few thousand dollars a
  month of tips is reportable income for Marisol, and under the FLSA her
  employer likely has rules about tip pooling — routing tips to one back-of-house
  cook outside the house pool can create a real problem for her and for the
  restaurant. Settle this with the restaurant before you settle the payment
  rail. It is the more likely thing to sink the project.

### 1b. The fiat version, same reader, same tip

| # | Screen | What the reader does | New account / install / funding |
|---|---|---|---|
| 1 | The email | Taps **Tip Marisol $3** | — |
| 2 | Tip page | Picks $3, taps the Apple Pay button, Face ID | — |
| 3 | Success | "Marisol got $3." | — |

Three screens. Nothing installed, nothing signed up for, nothing funded, no
identity check. Stripe takes roughly 2.9% + $0.30, which is about $0.39 on a $3
tip — around 13%, which is genuinely bad, and it is still several times better
than the onramp and costs the reader eleven fewer screens. A Cash App or Venmo
handle in the email is two screens and free, for the ~majority of your readers
who already have the app.

### 1c. The fix that matters more than the rail

Micro-tips are expensive on every rail, because fees are partly flat and $3 is
small. The leverage is in **batching, not in the chain**: let a reader load a $20
tip balance once, then send $1–$5 per issue with a single tap. That amortizes
one funding event across ~7 tips, turns the post-issue burst into a one-tap
flow, and improves the onchain version and the Stripe version by the same
mechanism. If you build anything custom, build this.

---

## Part 2 — What would have to change to make Stripe the wrong answer

Roughly in order of how likely each is to actually apply to you.

**1. Marisol can't get a bank account or a Stripe/Venmo account.** This is the
one that should be checked first and the one most likely to be true. A large
share of US line cooks are undocumented or lack the SSN/ITIN and bank
relationship that every fiat payout rail requires. If Marisol cannot be paid by
Stripe, "Stripe is 11 screens shorter" is irrelevant — it doesn't reach her at
all. A self-custody wallet has no eligibility requirements, and this is the
single strongest, most legitimate argument for an onchain rail in this exact
product. It also means she needs a cash-out path that doesn't require KYC'd
exchange withdrawal, which is a harder problem than the tip flow — solve that
before committing, or you've just moved the wall from the reader to the cook.

**2. The recipients are abroad, or the readers are.** Tipping a cook in Oaxaca
or Manila from a US newsletter is where stablecoins genuinely win: cross-border
$3 payouts via correspondent banking or remittance services are absurd, and
USDC on Base is instant and sub-cent. If your "city" expands to a diaspora food
column, the calculus inverts.

**3. Payouts fan out to dozens or hundreds of recipients, programmatically.**
One cook per issue is a payment link. Two hundred cooks across every restaurant
you cover, each with a different split between line cooks and dishwashers, is a
disbursement system — and that's where programmable money starts paying for its
overhead. Use 0xSplits rather than writing a splitter.

**4. You need to be un-deplatformable.** Payment processors drop accounts for
category risk with no appeal. If tips ever touch sex work, cannabis-adjacent
businesses, immigration mutual aid, or a politically exposed cause, Stripe is a
single point of failure and censorship resistance stops being a slogan.

**5. The tip has to be a durable public artifact.** If the product is really a
permanent, verifiable public record of community support for a worker — one
Marisol can carry to a new job or a visa application — then onchain permanence
is the feature. A Stripe receipt in your database isn't that. Be honest about
whether this is a real requirement or a retrofitted justification; it usually is
the latter.

**6. Your readers already hold stablecoins.** If a future audience arrives
already funded, screens 3–11 vanish and the onchain flow becomes 3 screens with
better economics than Stripe. Nothing in your current description suggests this,
and "almost none have used a crypto wallet" says the opposite.

**What would NOT change the answer:** gas getting cheaper (already ~free on
Base), a better wallet SDK (the wall is the onramp and KYC, not the wallet), or
bursty traffic (Base absorbs 2,000 tips in a burst without noticing; so does
Stripe).

---

## Part 3 — If condition 1 or 2 holds, here is the build

Kept deliberately small. This is a vertical slice, not a platform.

**Onchain / offchain boundary**

- **Onchain:** one USDC transfer, reader's wallet → cook's wallet. That's all.
- **Offchain:** cook profiles and photos, tip notes, the reader↔wallet mapping,
  running totals, the "top tipped this week" list, and every email. Totals and
  rankings are derived — index `Transfer` events to the cook's address and
  compute them in your own database. Do not put a counter or a leaderboard in
  contract storage.

**Custom contracts: zero.** USDC is deployed, the paymaster is a service, the
wallet is an SDK. If you later need kitchen-wide splits, use 0xSplits —
still zero custom contracts. Take any contract address from the chain's official
docs or the `addresses` skill; never from memory or a search result.

**Chain: Base.** Not because "Ethereum is expensive" — because your funding path
is Coinbase, your readers' existing Coinbase accounts are the one advantage you
have, and Coinbase Onramp, Coinbase Smart Wallet, and the Base paymaster are a
single integrated stack on Base with native USDC. That's a product-fit reason,
and it's the only one that matters here.

**State transitions**

| Transition | Caller | Why they pay gas | If nobody calls |
|---|---|---|---|
| `USDC.transfer(cook, amount)` | The reader's embedded wallet | Gas is sponsored — the reader pays nothing and wants the cook tipped | No tip is sent. Nothing is pending, nothing is stuck, no one is owed anything. |
| Cash out (transfer to an exchange or off-ramp) | The cook | She wants dollars | The USDC sits in her wallet, still hers, indefinitely. |
| `split.distribute()` *(only if you add 0xSplits)* | Any kitchen member, or you as a convenience | The caller receives their own share in the same transaction | Funds accrue in the split contract and stay claimable forever. |

No keeper, no cron, no owner-only function, no escrow, nothing that breaks if
your server is down. That is the property worth preserving as the design grows.

**Deployment runbook** — nothing to deploy, so "deploy" is configuration:

1. Cook's address: a Coinbase Smart Wallet she controls. **Not an exchange
   deposit address** — those can be rotated or retired and funds sent to a stale
   one are recoverable only via support, if at all.
2. Paymaster policy (Coinbase Developer Platform): allowlist exactly the USDC
   contract, exactly the `transfer` selector, exactly the cook's address as
   destination; cap per-wallet daily spend and set a global daily ceiling. An
   open paymaster policy gets drained by a script during your first burst —
   scope it before the first issue ships, not after.
3. Env: `CDP_API_KEY`, `ONRAMP_APP_ID`, `EMBEDDED_WALLET_APP_ID`,
   `COOK_ADDRESS`, `BASE_RPC_URL`.
4. **Post-deploy verification, end to end:** from a fresh email address on a
   phone that has never touched crypto, fund $5, tip $1, confirm the `Transfer`
   on Basescan, confirm your indexer shows it, then have the cook actually move
   it to cash and time how long that takes. Do this before the newsletter goes
   out, not after.
5. Measure current Base gas and current Coinbase Onramp fees and minimums
   yourself at build time — the fee numbers in Part 1 are order-of-magnitude
   and the small-purchase tiers change.

**Before launch:** fork-test the USDC and paymaster integration, and have
someone who did not build it walk the whole flow on their own phone with their
own money.

---

## Recommendation

Ship 1b this week — an Apple Pay tip link in the next issue, with the
load-a-balance batching from 1c if the numbers justify it. In parallel, ask one
question: **can Marisol legally and practically receive money through Stripe or
Venmo?** If the answer is no, Part 3 is a two-week build and is the right one
for a real reason. If the answer is yes, the onchain version is eleven extra
screens and an SSN prompt in exchange for nothing your readers asked for.

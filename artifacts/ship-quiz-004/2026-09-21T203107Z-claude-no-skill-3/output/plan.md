# Tipping a line cook from a restaurant newsletter

## The recommendation in one paragraph

Build it on **Base with USDC**, with **passkey smart wallets** created inline on a web
page (no app, no extension, no seed phrase) and **gas sponsored by you** so the reader
never touches ETH. Lead the payment step with **"Pay with Coinbase"** against the
reader's *existing* Coinbase balance, because that is the one path where a $3 tip costs
the reader $3.00 and nothing else. For readers without a Coinbase balance, do **not**
onramp per tip — sell them a **prefunded tipping balance** (default $25) and spend it
down across issues. The cook receives USDC at a passkey wallet and cashes out through
Coinbase to their bank.

The whole design exists to dodge one fact: at a $1–$5 ticket, *any* per-transaction
fiat-to-crypto conversion eats 20–60% of the tip. Everything below is in service of
making the conversion happen zero times or once per reader, not once per tip.

Two things I want to say plainly before the walkthrough, because they affect whether you
build at all:

1. **The cook's side is the hard part, not the reader's.** The reader's experience can be
   made genuinely good — two taps, no install. The cook has to pass ID verification at an
   exchange and link a bank account before a single dollar becomes spendable. If your
   cook can't or won't do that, none of the rest matters. Validate this with one real
   cook before you write code.
2. **Tips to employees are a payroll and tax object, not just a payment.** In the US,
   tips a worker receives are reportable income and, for a W-2 employee, generally flow
   through the employer's reporting. A publisher routing money directly to a restaurant's
   line cook is inserting itself into that. This is the item most likely to kill the
   project, and it is a lawyer question, not an engineering one. I've flagged where it
   bites below and built the rest assuming you get a clean answer.

---

## Part 1 — The walkthrough

### Screen 0: The newsletter issue

Inside the issue, under the review of the restaurant, a small card:

> **Marisol has worked the line at Cafe Pinto for six years.**
> [ Tip $1 ]  [ Tip $3 ]  [ Tip $5 ]

Each button is a plain link to `tips.yournewsletter.com/t/marisol?amt=3`. Nothing
crypto-flavored is visible. The word "wallet" does not appear anywhere in the email.

Implementation notes that matter here and nowhere else:
- The link must be a **GET that only renders a page**. Corporate mail scanners and image
  proxies prefetch links; if clicking is the payment, you will ship phantom tips.
- Tag the link with the issue ID so you can attribute revenue per issue.
- One card per issue, one cook. Don't build a directory yet.

**Installs so far: none. Signups so far: none.**

### Screen 1: The tip page

Opens in the reader's mobile browser (assume ~75% mobile for an email audience).

> **Tip Marisol** — line cook, Cafe Pinto
> [photo]
> **$1   $3   $5   Other**   ← $3 preselected from the link
> Optional: say something to her (140 chars)
> [ **Continue** ]
> *Marisol gets 100% of your tip. We don't take a cut.*

No connect-wallet button. No network selector. No mention of USDC or Base.

### Screen 2: Identity — one Face ID prompt

Tapping Continue triggers the OS passkey sheet:

> *Create a passkey for tips.yournewsletter.com?*  → Face ID

That single biometric prompt creates a **smart contract wallet on Base** owned by the
passkey. The reader thinks they just "signed in the fast way," which is fine — that is
what happened. Collect an email on the same screen for receipts and account recovery.

- **Installed:** nothing.
- **Signed up for:** an account on your site, via passkey.
- **Seed phrase:** none, ever. Recovery is passkey sync (iCloud/Google Password Manager)
  plus an email-based backup signer you add on the server side.
- **ETH needed:** none. A paymaster sponsors gas. A USDC transfer on Base costs you well
  under a cent at current L2 prices — budget it as a rounding error, but do meter it.

### Screen 3: Funding — the fork that decides the economics

> **How would you like to pay $3?**
> [ **Pay with Coinbase** ] ← primary, large
> [ Apple Pay ]
> [ Debit card ]

#### Path A — Pay with Coinbase (the path you're actually betting on)

You said many subscribers already have Coinbase accounts. That is the single most
valuable fact in your brief, because it means a large slice of readers already hold a
USD or USDC balance at a venue that can send USDC to Base **without a conversion fee**.

Screens:
1. Tap "Pay with Coinbase" → handoff to the Coinbase app if installed, else
   coinbase.com in a browser tab.
2. Coinbase login — usually already authenticated on mobile. Possibly a 2FA prompt.
3. A Coinbase permission/confirmation screen: *Send $3.00 USDC to [your app] on Base.*
4. Tap confirm → bounced back to your page.

- **Installed:** nothing required (app handoff is a convenience, browser works).
- **Signed up for:** nothing new — reusing an account they already have.
- **Funded:** from existing Coinbase balance. If the balance is $0, Coinbase will offer
  to fund it from their linked bank/card, and you are back to conversion fees — so
  detect a zero balance and steer to Path B's prefunding instead.
- **Cost to reader on this path:** $3.00 for a $3.00 tip. This is the only path with
  that property, which is why it's the big button.
- **Time:** ~20–30 seconds.

#### Path B — No Coinbase balance: buy a tipping balance, not a tip

Do **not** run a $3 card onramp. Onramp providers apply a floor fee and/or a minimum
purchase; on a $3 ticket the effective take is commonly 20–60%. You would be telling a
reader their $3 delivered $1.80. That's a worse story than not shipping.

Instead:

> **Top up your tip balance**
> [ $10 ]  [ **$25** ]  [ $50 ]
> Use it on any cook, any issue. Refundable to your bank anytime.
> [ Apple Pay ]

Screens:
1. Amount selection ($25 default).
2. Onramp widget (Coinbase Onramp or equivalent) embedded in your page — email, then
   Apple Pay sheet. Small purchases may clear with email + card only; above the
   provider's threshold the reader hits **ID verification** (photo of a license, SSN).
   That cliff is the worst moment in the funnel. Keep the default top-up *under* the
   threshold you measure in testing, even if it means a $20 default.
3. Funds land as USDC in their passkey wallet, typically in seconds for card rails.
4. Auto-return to the tip confirmation.

- **Installed:** nothing.
- **Signed up for:** the onramp provider's flow (email at minimum; ID if over threshold).
- **Funded:** $25 by debit card/Apple Pay. A ~4% onramp fee on $25 is ~$1, amortized
  across ~8 tips ≈ 4% — competitive with, and often better than, card processing on
  small tickets. (Verify current fee schedules before committing; treat 4% as a
  placeholder, not a quote.)
- **Time:** ~60–90 seconds, and only once.

Worth comparing honestly: a plain Stripe card charge on a $3 tip is roughly
$0.30 + 2.9% ≈ **13%**. So per-tip card onramp (20–60%) loses to Stripe, and Stripe
loses to both prefunded USDC (~4%) and the Coinbase-balance path (~0%). The crypto
build is only justified by the last two columns. If you can't get those two paths to
work, the honest answer is to use Stripe and skip crypto entirely.

### Screen 4: Confirm

> Tip **$3.00** to Marisol
> Your note: "the mole was unreal"
> Balance after: $22.00
> [ **Send tip** ]

One tap. No gas estimate, no nonce, no "confirm in your wallet" modal — the passkey
smart wallet signs with a second Face ID at most, and you can batch this into Screen 2's
session so most readers see zero extra prompts.

### Screen 5: Receipt

> **Marisol got $3.00.**
> She keeps all of it. She'll see your note.
> $22.00 left in your tip balance.
> [ Add to Home Screen ]  ·  [ Cash out my balance ]

Settlement is final in ~2 seconds on Base. Email a receipt.

### Screen 6: The second tip, next issue

Tap "Tip $3" in the email → tip page → Face ID → sent. **Under ten seconds, no funding
step.** This is the entire payoff of the architecture, and it's the number to put in
front of whoever approves the budget.

---

### The cook's side — what has to happen before money is spendable

This is where the real work is, and it is mostly not on your roadmap yet.

1. **Recruit.** You or the restaurant approaches the cook. Consent is not optional —
   publishing a person's name, face, and a payment link to 200,000 people is a
   significant thing to do to someone's life.
2. **Wallet.** Cook opens your link, Face ID, passkey wallet on Base created. ~30 seconds.
   Tips start arriving here immediately.
3. **Cash out — the friction wall.** To turn USDC into dollars, the cook needs a Coinbase
   (or similar) account: email, phone, **government ID photo, SSN, selfie liveness
   check**. Expect 5–20 minutes, and expect a nonzero failure rate — name mismatches,
   address mismatches, and expired IDs are common. Some people will fail this and never
   get their money. You need a human support path for that, not a FAQ.
4. **Bank link.** ACH to a bank account (1–3 business days, typically free) or instant to
   a debit card (typically ~1.5%, minutes).
5. **Taxes.** The cook owes income tax on this. You should be issuing the appropriate
   information return, or the restaurant should, or the money should flow through the
   restaurant's payroll. Decide which *before* launch — retrofitting tax reporting onto
   a year of payments is miserable.

**Total for the cook, first time: ~25 minutes and a government ID.** Budget for walking
the first several cooks through it in person. Do not send them a help article.

---

### Your burst-load reality

200,000 emails, tips clustered in the ~90 minutes after send. At a 0.5% tip rate that's
1,000 tips, peaking maybe 10–20/second.

- **Base:** not a problem at this volume.
- **Your paymaster:** must be pre-funded and alerted on low balance. Running dry
  mid-burst fails every tip at once, on the one day per week it matters.
- **The onramp provider:** the actual bottleneck. Rate limits and risk-engine throttling
  under a spike will produce a cluster of declines. Ask them about burst limits in
  writing before launch.
- **Idempotency:** email clients retry and readers double-tap. Key every tip by
  (reader, cook, issue, client-generated nonce) or you'll send doubles.

### Two things to tell readers honestly

- **Tips are public.** Base is a public ledger. Anyone can see that this address tipped
  this cook eleven times. It's pseudonymous, not private, and a reader who cashes out to
  a KYC'd account has linked it to their name. For a local restaurant newsletter where
  everyone knows everyone, this is a real consideration.
- **Tips are final.** No chargebacks, no undo. Good for the cook, bad for the reader who
  fat-fingers $50. Add a client-side confirm above $20 and a 60-second soft-cancel window
  before you broadcast.

---

## Part 2 — What would have to change for this to be the wrong setup

This design rests on six load-bearing assumptions. Each one, if it flips, changes the
answer — and three of them change it all the way to "don't use crypto."

### 1. Readers tip repeatedly. *(If false, the whole thing collapses.)*

The prefunded-balance trick only works if a $25 top-up gets spent across many tips. If
the real behavior is **one tip, ever**, you're forcing a $25 purchase for a $3 intent —
the abandon rate will be brutal, and you'll be sitting on unspent balances that are
somebody else's money and possibly your regulatory problem.

**Test this first, before any code:** put a Stripe tip button in one issue and measure
repeat rate over six weeks. If fewer than ~30% of tippers tip a second time,
**abandon the crypto build and use Stripe.** 13% on a $3 tip is a bad fee, but it's
better than a checkout nobody completes.

### 2. "Many readers have Coinbase accounts" means many have *funded* Coinbase balances.

An account someone opened in 2021, verified, and left at $0 doesn't help — those readers
land in Path B just like everyone else. Your zero-fee path is only as big as the funded
subset.

**Find out the real number** (survey one issue: "do you keep a balance at Coinbase?").
If it's small, the Coinbase integration stops being the centerpiece and becomes a
secondary option, and the entire case narrows to whether prefunding works.

### 3. Tips can legally go direct from reader to cook.

If the cook is a W-2 employee and their tips must be pooled with the rest of the house
or reported through the employer, **direct-to-cook is the wrong shape regardless of the
rails.** The fix isn't a different chain; it's routing to the restaurant with an
allocation, or partnering with an existing tipping product (Square, Stripe) that already
handles tip reporting. A crypto rail that ignores this doesn't make the obligation go
away, it just makes you the one who ignored it.

Relatedly: if you ever hold reader balances yourself, you are handling other people's
money and you should assume money-transmitter questions apply. Keep the balance
non-custodial — in the reader's own passkey wallet, which you cannot move — and keep it
that way even when a product manager asks for a "convenient" pooled account.

### 4. Ticket size stays at $1–$5.

If tips were **$50–$500**, the fee math inverts: a per-tip onramp costs 1–2% and the
prefunding gymnastics become unnecessary complexity. Ship the simple thing instead.

If they were **$0.10–$0.25** — micro-tips per dish, say — the case gets *stronger*, not
weaker. Nothing in card-land can settle a dime economically; Base can. That's the
scenario where the crypto rail isn't a fee optimization, it's the only option.

### 5. Everyone is domestic, and USD is the destination.

Today the cook cashes out to a US bank, and the honest summary is that crypto is a
*modest* win over Stripe. Change any of these and it becomes a large one:

- **The cook is abroad**, or sends part of the money home. Remittance corridors take
  5–10% and days; USDC takes seconds and cents. The argument stops being about fees and
  starts being about capability.
- **The cook has no bank account.** Right now this is a *liability* — no bank means no
  offramp, and the design fails. But if the cook is willing to hold and spend USDC
  directly (a card against the balance, or paying rent to someone who accepts it),
  staying onchain end-to-end removes the worst screen in the whole flow.
- **You expand to many cities/currencies.** One USDC rail beats N payment processors.

### 6. Irreversibility is acceptable.

If you ever need dispute resolution, refunds, or fraud reversal — because a cook's
identity is contested, or a reader claims their kid sent $200 — **you want card rails,**
which have chargebacks built in and an arbiter who isn't your support inbox. Every
irreversible payment you send is a support ticket you can only apologize for.

### The short version

| If this changes | The setup becomes |
|---|---|
| One-and-done tipping behavior | Wrong → use Stripe/Apple Pay |
| Tips must flow through employer payroll | Wrong → restaurant-routed, or Square/Stripe Tips |
| You need chargebacks/disputes | Wrong → card rails |
| Tickets rise to $50+ | Over-engineered → per-tip onramp is fine |
| Cook is international or unbanked-by-choice | More right → crypto is the only option |
| Tickets drop below ~$0.25 | Much more right → nothing else can settle it |

### What I'd do this month

1. Talk to one line cook. Watch them do exchange ID verification. If that goes badly,
   stop and rethink the offramp.
2. Get a written answer on the tip-reporting question.
3. Run the Stripe tip button in one issue. Measure tip rate and repeat rate.

Only if all three come back clean does the build above become worth six weeks. The
architecture is sound; what's unverified is whether the behavior and the law support it,
and both are cheap to check first.

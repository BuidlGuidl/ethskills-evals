# Tipping a line cook from a restaurant newsletter — setup choice and cold-start walkthrough

## 0. The setup I'm assuming, and why

**Chosen rail: USDC on Base, paid from the reader's existing Coinbase account ("Pay with Coinbase" / Base Pay), landing directly in the cook's own wallet. The publisher never holds funds.**

The three facts in your brief drive this almost entirely:

- **Tips are $1–$5.** Any rail with a fixed per-transaction fee is fatal. A 30¢ fixed fee on a $2 tip is 15%. Onchain, the network fee on Base is a fraction of a cent and can be sponsored by you entirely, so the cook keeps ~100% of a $2 tip. This is the one place where the crypto rail is not a lateral move — it is categorically better.
- **Almost no one has a wallet.** So the flow cannot contain the words "wallet," "seed phrase," "network," or "gas." The wallet has to be something they already have and don't think of as a wallet.
- **Many already have Coinbase accounts.** This is the load-bearing fact. It converts "install a wallet, fund a wallet" into "sign in to an app you already have." Without it I would not recommend this build.

Alternatives I rejected, and why, are in §3. **Note the asymmetry up front: the hard part is not onchain, it is the fiat on-ramp.** Everything expensive in the walkthrough below happens before a single token moves.

---

## 1. The cold-start walkthrough — every screen

Two readers exist, and they have wildly different experiences. I'm walking the worst realistic case first because that's the one that decides whether you build this.

### Reader A — "cold": no Coinbase account, no crypto, reading on their phone

**Screen 1 — The newsletter issue (their email client).**
Under the profile of Marisol, line cook at Cafe Osita, a button: **"Tip Marisol — $1 / $3 / $5."** They tap $3.

*Constraint you should know now:* email clients strip JavaScript, so this is always a plain link out to a web page. You cannot complete a tip inside the email. Every tip flow starts with a context switch.

**Screen 2 — Your tip page (mobile browser).**
Marisol's photo, the dish she's known for, the amount pre-filled at $3, one button: **"Continue with Coinbase."** Optional 140-character note field.

**Screen 3 — Coinbase sign-in (handoff to Coinbase app or web).**
They don't have an account. They tap "Create account."

**Screen 4 — Email + password.**
**Screen 5 — Email verification code.** (They leave your flow to go read email. First big drop-off.)
**Screen 6 — Phone number + SMS code.**
**Screen 7 — Legal name, date of birth, residential address.**
**Screen 8 — SSN (or last four, jurisdiction-dependent).**
**Screen 9 — Government ID: photo of front, photo of back.**
**Screen 10 — Liveness selfie.**
**Screen 11 — "We're verifying your identity."** Usually minutes. Sometimes hours. Occasionally a manual-review queue measured in days.

This is KYC. It is not optional, it is not something you can design around, and it is not something you can make pleasant. **You are asking a person to photograph their driver's license and type their Social Security number in order to give a cook three dollars.** Everything else in this document is detail; this screen is the product decision.

**Screen 12 — Add a payment method.** Debit card, or bank account via Plaid.
- *Debit card:* card number, expiry, CVV, billing address, likely a 3-D Secure bank challenge. Usable immediately.
- *Bank (Plaid):* choose bank, bank username + password, bank 2FA code. Usable immediately for buys in most cases; if it falls back to micro-deposits, **1–3 business days** and the tip does not happen today.

**Screen 13 — Fund the account.** They need dollars in Coinbase before they can send three of them. Here the economics break:

| They deposit | Est. card fee | Effective cost of a $3 tip |
|---|---|---|
| $3 (just this tip) | ~$0.99 or ~4% | **~33% overhead** |
| $25 (tip balance) | ~$0.99 or ~4% | **~4% overhead, amortized over ~8 tips** |
| $25 via ACH | ~$0 | **~0%** |

*(Fee figures are order-of-magnitude from published consumer on-ramp pricing and must be re-verified against current Coinbase schedules before you model anything — they change, and they vary by payment method and region.)*

The table is the whole business case. **Funding once per tip is economically absurd; funding once per reader and tipping many times is excellent.** Which means the product you are actually building is not "a tip button." It is **"a tipping balance that a reader tops up a few times a year."** If you build the tip button and not the balance, you've built the 33% version.

So Screen 13 must read: *"Add $25 to your tipping balance — that's about eight tips,"* not *"Add $3."*

**Screen 14 — Purchase confirmation.** $25.00 USDC, fee line, "Buy now."
**Screen 15 — Back in your flow: the payment sheet.** "Send $3.00 to Marisol · Cafe Osita. Network fee: $0.00 (covered by us)." Face ID.
**Screen 16 — Success.** "Marisol got your $3. Your balance: $22." Plus a receipt link (a block explorer URL, which you should label "receipt," not "transaction on Base").
**Screen 17 — Receipt email.**

**Cold reader total: ~17 screens, one government ID, one SSN, one selfie, one funding event. Realistically 10–25 minutes, and a meaningful minority never finish because of ID review or micro-deposits.**

### Reader B — "warm": has the Coinbase app installed, signed in, with cash in it

Screen 1 (email) → Screen 2 (tip page) → Screen 3 (Coinbase payment sheet, Face ID) → Screen 4 (success). **Four screens, about eight seconds, no install, no typing.**

### Reader C — the one your brief actually describes

"Many already have Coinbase accounts." Be careful with this. *Having an account* is not *being signed in on this phone with a funded cash balance and a live payment method.* A large share of dormant Coinbase account holders will, on tapping your button, land somewhere in Screens 12–14 — re-auth, expired card, $0 cash balance. Plan for a third bucket that is neither 4 screens nor 17, but roughly **6–9**: sign in, 2FA, add funds, confirm.

**Before you commit to a build, the single number to go get is: what fraction of your 200k are Reader B?** Not "have an account" — funded and signed in. If your list overlaps a Coinbase-heavy demographic and that number is 15%, that's 30,000 people who can tip in eight seconds, and the build is obviously worth it. If it's 1%, you are building a KYC funnel with a newsletter attached.

### The cook's side — which is not free either

Marisol also has to be onboarded, and she has less patience than your readers:

1. You send her an onboarding link. She creates an embedded wallet with email + passkey — no seed phrase, no app install. **1–2 screens.** This part is genuinely easy now.
2. She gets paid instantly, in USDC, and can see it the same evening. This is real and it is the best part of the pitch — traditional tip-out hits her paycheck in two weeks.
3. **Cashing out is her KYC wall.** To turn USDC into rent money she needs a Coinbase (or similar) account with ID verification and a linked bank — Screens 4–12 above, applied to her. There is no way around it. Budget for someone from your team doing this with each cook in person, over about fifteen minutes. At small cook counts this is fine. At 500 cooks it is a staffing line item.
4. **Taxes.** Tips are taxable income and she is receiving them outside her employer's payroll. Someone has to tell her that plainly, and you should hand her an annual summary. Don't let this be a surprise in April.
5. **Employment law.** US tip-pooling rules (FLSA) restrict how tips are shared and forbid employers from keeping them; back-of-house tipping has specific nuance and some houses mandate pooling. **A direct-to-cook rail may conflict with her restaurant's tip-pooling policy or its legal obligations.** Get a labor lawyer on this before the first issue ships, and get each restaurant's sign-off — this is a bigger risk to the product than any technical choice here.

### Where the money actually is at each step

Reader's bank → Coinbase (custodial, Coinbase holds it) → onchain USDC in the reader's wallet → onchain USDC in Marisol's wallet → Coinbase → her bank. **You are never in that list**, which is deliberate and is what keeps you out of money-transmitter territory. Protect that property; §3 has the ways you might accidentally break it.

---

## 2. What the honest pitch is

Not "crypto is easier." It isn't — §1 is seventeen screens. The honest pitch is three specific things, and you should only build this if you believe them:

1. **A $1 tip survives.** On card rails a $1 tip is mostly fee. Here it's mostly tip. That makes the $1–$5 band viable at all, and your brief says that's the band.
2. **Marisol is paid tonight, directly,** not in two weeks via a payroll system that may pool it away from her.
3. **You never touch the money**, so you are a publisher with a button, not an unlicensed payments company.

If those three aren't worth ~17 cold screens to you, stop here and take §3.

---

## 3. What would have to change for this to be the wrong setup

Each of these is a falsifier with a test attached. If any is true today, the answer is in the right column.

**A. Readers tip once and never again.** The whole design rests on amortizing one funding event across many tips. If median tips-per-funded-reader is ~1, the effective fee is 30%+ and the setup is indefensible. → **Test:** run the balance framing for two issues and measure tips-per-funded-reader. Below ~3, kill it. → **Instead:** Apple Pay / Stripe link, eat the ~13% on a $3 tip, or batch tips weekly to amortize the fixed fee.

**B. The cook roster is small, stable, and fully US-banked.** If you're supporting 20 cooks who all have bank accounts and phones, Stripe Connect or even per-cook Venmo handles beat this on every axis except fee: zero install for readers, zero KYC you have to shepherd, instant legibility. → **Instead:** Stripe Connect with weekly batched payouts. **This is the most likely reason to abandon the build, and it's a business fact, not a technical one — go count the cooks first.**

**C. Your Coinbase-holder overlap is small or dormant.** The entire warm path is borrowed from Coinbase's existing KYC. Without it, Reader A is everyone, and you are running an ID-verification funnel for $3. → **Test:** get the real number before writing code. Under ~5% funded-and-active, don't build.

**D. You want to take a cut, hold funds, pool tips, escrow, or issue refunds.** Any of these puts you in the flow of funds and likely makes you a money transmitter, with licensing to match. → **Instead:** a licensed payments partner, or Stripe Connect where they carry the compliance. Note this cuts the other way too: it also means **you cannot offer chargebacks.** Onchain tips are final. For $3 gifts that's acceptable; the day you sell anything with a promise attached, it isn't.

**E. Restaurants or labor law object to direct-to-cook payments.** If tips must flow through the house to be pooled and reported, a rail that bypasses the house is the wrong rail regardless of how elegant it is. → **Instead:** pay the restaurant, let payroll distribute — and at that point use ACH and skip all of this.

**F. Your readership skews desktop-email and older.** The warm path depends on a phone with the Coinbase app and a passkey. Desktop email readers get QR-code handoffs and sign-in typing, and the eight-second path evaporates. → **Test:** check your existing open-rate device split. You already have this number.

**G. Regulatory or stablecoin-status change** in your jurisdiction that makes consumer USDC payments burdensome. Low probability, catastrophic impact; worth one lawyer conversation, not a redesign.

**And the inverse — things that would make this setup *more* right, i.e. don't abandon it if these are coming:**

- **Cooks who are unbanked, or immigrants sending part of a tip home.** Cross-border is where card rails are worst and this rail is strongest. If a meaningful share of your cooks would remit, the case gets stronger, not weaker.
- **Cooks who change restaurants often.** The wallet belongs to Marisol, not to Cafe Osita. She keeps her tip history and her audience across jobs — something no payroll integration can offer.
- **Programmable splits** — "tip the kitchen, split six ways automatically" — which is a genuinely hard problem on card rails and a few lines of code here. This may also be your answer to falsifier E.

---

## 4. What I'd do before writing any code

1. **Count Reader B.** Survey the list, or ask Coinbase about audience overlap. This is the gate.
2. **Count the cooks.** If it's 20, go read falsifier B again.
3. **Call a labor lawyer** about back-of-house direct tipping and pooling, and get one restaurant to sign off in writing.
4. **Run the A/B in one issue, no build:** a Stripe payment link next to a "Pay with Coinbase" button, same cook, same placement. Measure completion rate and net-to-cook per 1,000 readers. One issue, a few hours of work, and it settles §3-A, §3-B and §3-C with evidence instead of argument.

The build is a good one **if and only if** step 1 comes back healthy and step 3 comes back clean. If step 4 shows Stripe converting three times better even at 13%, ship Stripe — the cook would rather have $2.61 than a beautiful architecture.

---

*Fee figures, on-ramp minimums, and KYC step ordering reflect published consumer pricing and flows as of this writing and should be re-verified against current Coinbase documentation before they're used in a financial model.*

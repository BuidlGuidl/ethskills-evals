# Tipping a line cook, $1–$5, from a 200k-subscriber restaurant newsletter

## The build this walkthrough describes

Before the screens, the shape of the thing, because the screen count is a consequence of it:

- **Rail:** USDC on Base. Sub-cent transfer cost, so a $2 tip doesn't lose 15% to fees the way a $2 card charge does.
- **Reader's wallet:** an embedded wallet (Coinbase CDP, Privy, or Dynamic) created from email + passkey. No seed phrase, no extension, no app install.
- **Gas:** sponsored by you via a paymaster. The reader never sees or holds ETH.
- **Funding:** Coinbase Onramp, with "Pay with Coinbase" as the primary path since you've said many readers already have accounts there. Debit/Apple Pay guest checkout as the fallback.
- **Model:** the reader funds a **balance once** ($20, say) and tips out of it many times. This is load-bearing. Read the walkthrough with it in mind.
- **Cook's side:** their own embedded wallet, cashed out through their own Coinbase account to a bank account.

## Walkthrough: first-time reader, first tip

Marisol works the line at a place you covered. The issue goes out Tuesday morning.

**1. The email.** Issue arrives. Under the piece: Marisol's photo and a **Tip Marisol** button. Nothing can happen inside the email — mail clients don't run apps — so this is a link out to the browser. *(No install, no signup yet.)*

**2. Tip landing page.** Mobile browser opens. Marisol's photo, one line about her, amount chips: **$1 · $2 · $5 · other**. Optional message box. Reader taps $2, taps **Send tip**.

**3. Email entry.** "Enter your email to continue." They type it. *(First signup begins.)*

**4. One-time code.** A 6-digit code is emailed. They **leave the browser, open their inbox, find the code, come back**. First context switch — historically the single largest drop-off point in this flow.

**5. Passkey prompt.** OS-level sheet: Face ID / Touch ID / Windows Hello. This secures the wallet. Readers who decline or whose device doesn't support it fall to an email-recovery path, which is more screens and weaker.

**6. Wallet created — balance $0.00.** "Add funds to tip." **This is the cliff.** Everything to here took ~60 seconds. Everything after is the actual cost of the design.

**7. Funding choice.** Two buttons: **Pay with Coinbase** / **Debit card**.

**7a. Coinbase path** (the good one, and the reason your audience makes this build plausible):
   - Redirect to Coinbase. Sign in — email, password. **Second context switch.**
   - 2FA: SMS code or authenticator app. **Third context switch**, back out to Messages or an authenticator, then back.
   - Choose payment source. If their Coinbase cash balance is $0 — common for people who bought BTC in 2021 and haven't touched it — they must link a funding source here: **debit card** (instant, fee'd) or **bank/ACH** (cheaper, 1–5 business days to settle). ACH means they do not tip today. They tip next week or never.
   - Buy screen: amount, fee, total. Confirm.
   - Redirect back to your page.

**7b. Debit-card guest path** (no Coinbase account): legal name, date of birth, home address, SSN (last 4 or full), sometimes a government-ID photo and a selfie — this is KYC, and the onramp provider is obligated to run it. Then card number, then a 3-D Secure challenge from their bank. Realistically **6–9 additional screens** and a real chance of a decline on first attempt, because crypto purchases get blocked by issuers routinely.

**8. Pending.** "Your funds are on the way." Card: seconds to minutes. ACH: days. First purchases often carry a hold on top.

**9. Funded.** Balance $20.00. Push/email: "You're ready to tip."

**10. Tip confirmation.** "$2.00 to Marisol. Fee: $0.00. You'll have $18.00 left." Tap **Send**.

**11. Passkey tap** (or nothing, if you issued a session key at step 5 — recommended).

**12. Done.** "Marisol got $2." Receipt, their message, a Basescan link most of them will never open. **Tip again** button.

**13. Marisol's side** — set up in advance, by you, in person, not self-serve: she has an embedded wallet created the same way, sees a balance climb Tuesday afternoon as the burst lands, and cashes out by sending USDC to her Coinbase deposit address, selling to USD, and withdrawing to her bank. Instant to Coinbase, then Coinbase's own withdrawal timing to her bank. She will need a 1099 or a W-2 line from someone; see the legal note below.

### What that actually cost

| | First tip | Every tip after |
|---|---|---|
| Screens | 11–20 | 2 |
| App switches | 2–3 | 0 |
| Signups | 1 (wallet) + often 1 (Coinbase/KYC) | 0 |
| Installs | **0** | 0 |
| Personal data | email, phone, name, DOB, address, SSN, sometimes ID photo | none |
| Fees | **$1–$3 onramp minimum** | **<$0.01** |
| Time to cook | minutes, or days on ACH | ~2 seconds |

**Read the fee row honestly.** A $2 tip that goes card → onramp → wallet → cook loses more to the onramp than Stripe would have taken. On that transaction, crypto is strictly worse. The entire economic case for this build lives in the right-hand column, and the right-hand column only exists if readers come back. Prefunding $20 and tipping ten times over a quarter is what makes it work — not the first tip.

*(Fee floors, KYC thresholds, and onramp availability move; re-verify against current provider docs before you commit numbers to a deck.)*

---

## What would make this the wrong build

Some of these are already true for you. I've marked which.

**1. Readers tip once and never again.** ⚠️ **The one that decides it.** The whole design amortizes a punishing first transaction across many cheap later ones. If your median tipper tips once, you've built an expensive, high-friction, identity-collecting version of a Stripe link. Measure this before you build: put an Apple Pay tip link in the next issue and look at the repeat rate after four issues. Under ~3 tips per tipper per quarter, ship Stripe with Apple Pay / Google Pay instead — one sheet, one thumb, zero signups, and eat the 2.9% + $0.30. On a $2 tip that's 45¢ to Stripe versus $1–3 to the onramp. **Stripe wins the first transaction outright.**

**2. There's one cook.** ⚠️ **Currently true.** Onchain rails earn their complexity on *programmable* money movement: splitting a tip across a kitchen brigade by shift hours, streaming a pooled tip-out, paying 300 cooks across 80 restaurants without you touching any of it or becoming their payroll department. One named cook and a bank account is a job for a payment processor. If the roadmap is "every cook in the city, with splits," the calculus flips hard in crypto's favor — but build for that, not for Marisol.

**3. The cook is banked and documented.** ⚠️ **Assumed true above, and worth confirming.** The strongest real case for stablecoin tipping of restaurant staff is a recipient who can't easily hold a US bank account or whose remittances go abroad. But notice: if that's your actual situation, **the Coinbase cash-out leg in step 13 fails too** — Coinbase needs the same KYC the bank does. You'd be solving the offramp, which is much harder than the onramp, and a US-custodial design is the wrong starting point. Find out which world you're in before you pick rails.

**4. Tips get bigger.** At $20–50, the card fee falls to a rounding error proportionally and crypto's cost advantage mostly evaporates. At $1–5 the fee ratio is the whole argument.

**5. You hold the float.** If readers prefund into a pooled account you control, you may be storing value for others — money transmission and, in some states, stored-value/gift-card law. **Keep the embedded wallets genuinely non-custodial and self-directed** so funds are the reader's until they send. If product pressure pushes you toward pooling, get counsel first; that's a licensing question, not an engineering one.

**6. The tax and employment picture.** Tips to an employee are income, and in many arrangements wages, with reporting obligations that may sit with the restaurant, with you, or with both. This is unglamorous and it is the thing most likely to stop the project after launch. Resolve it before you write code — it may also constrain whether tips can bypass the employer at all.

**7. Your audience turns out to be more Coinbase-native than you think.** ✅ **Upside case.** You said many readers already have Coinbase accounts. If a meaningful share are *active* there with a cash balance, look hard at **Base Pay / Coinbase one-tap USDC checkout**: the reader taps a button, confirms in Coinbase, done — no wallet creation, no passkey, no onramp, no funding cliff. Steps 3–9 collapse into one screen. That is a far better first-tip experience than anything above and would change my recommendation. **Survey your list first: "do you have a Coinbase account with money in it?" If yes is over ~20%, build that and skip the embedded wallet entirely.**

## What I'd do

Run two cheap tests in the next two issues before committing engineering:
1. **Stripe/Apple Pay tip link.** Gives you the conversion baseline and the repeat rate — the number that decides everything.
2. **One-question survey** on funded Coinbase accounts.

If repeat rate is low and Coinbase penetration is low: ship Stripe, don't build this. If Coinbase penetration is high: ship Base Pay, skip the wallet. If the real roadmap is many cooks with splits: build the onchain version, but scope it to that from day one — it's a different product than a tip button.

# Restaurant Newsletter Tipping — First-Tip Walkthrough & When This Is the Wrong Build

**Audience:** ~200,000 newsletter subscribers, effectively zero crypto wallet experience, many with existing Coinbase accounts.
**Transaction shape:** $1–$5, bursty, arriving right after each issue lands.
**Recipient:** a named line cook at a specific restaurant.

---

## 0. The verdict up front

If I build this on crypto, there is exactly one defensible configuration:

| Decision | Choice | Why |
|---|---|---|
| Chain | **Base** | Cheapest major L2 (~$0.0003/transfer), native Coinbase on-ramp, Coinbase Smart Wallet support. Your readers' existing Coinbase accounts are the *only* crypto asset you have — Base is the one chain that converts that asset into reduced friction. |
| Asset | **USDC** | $3 must still be $3 next Tuesday. Never denominate a tip in ETH. |
| Wallet | **Coinbase Smart Wallet (passkey)** | No app install, no seed phrase, no extension. Face ID in a browser tab. This is the single biggest friction removal available. |
| Gas | **Sponsored by us (paymaster)** | At $0.0003/tx, sponsoring 100,000 tips costs ~$30. There is no excuse for ever showing a reader a gas fee. |
| Contracts | **Zero for v1, one at most** | A tip is `USDC.transfer(cook, amount)`. Write a contract only when you need splits or onchain receipts. See §4. |

Everything below assumes that stack — the *best case*. The walkthrough is honest about where the best case still breaks.

---

## 1. Screen-by-screen: a first-time reader's first tip

### Screen 1 — The email
Friday's issue, a profile of Marisol, line cook at Bar Mateo. Inline: **`Tip Marisol · $1 · $3 · $5`**

Email clients strip JavaScript, so these are three plain links carrying a signed token (`?cook=mateo-marisol&amt=3&iss=2026-09-18`). Nothing has happened yet. No account, no wallet.

**Reader has installed:** nothing. **Signed up for:** nothing. **Funded:** nothing.

### Screen 2 — The tip page (mobile browser)
Opens in Gmail/Apple Mail's in-app browser. Marisol's photo, one line about her, the amount pre-selected at $3. One button: **Send $3 to Marisol**.

> **In-app browser caveat:** passkey creation inside Gmail's embedded webview is inconsistent. You will need an "Open in Safari/Chrome" interstitial for a meaningful slice of traffic. That is a real extra tap, not a rounding error.

### Screen 3 — Account creation
Tap Send → **"Create your tipping account"** → the OS passkey sheet appears → Face ID / Touch ID / Windows Hello.

~5 seconds. No password, no seed phrase, no email verification, no app. A Coinbase Smart Wallet address now exists for them (counterfactual — the contract itself isn't deployed until their first transaction, and we sponsor that deployment).

**Installed:** nothing. **Signed up for:** a passkey-backed smart wallet. **Funded:** $0.

This screen is genuinely good. This is where crypto onboarding has actually gotten better.

### Screen 4 — Funding (this is where the product lives or dies)
Their balance is $0. Nobody is born holding USDC on Base. Two paths:

**Path A — "Continue with Coinbase"** (for the many who have accounts)
1. Coinbase OAuth login screen — email + password.
2. 2FA code (SMS or authenticator).
3. Account/balance picker.
4. **They almost certainly do not hold USDC.** They hold some BTC, some ETH, or $0. So: buy USDC.
   - Debit card → instant, but ~2.5–4% fee and a purchase minimum.
   - ACH bank transfer → cheaper, but the resulting balance is **withdrawal-locked for days**. They cannot send it to Base today. The tip does not happen this week.
5. Withdraw USDC → Base. Coinbase makes this free and fast, which is Base's real superpower. But it may trigger a first-time-withdrawal-address confirmation email and another 2FA.

**Path B — embedded card on-ramp** (Coinbase Onramp / Stripe / MoonPay)
1. Card number, name, DOB, billing address.
2. KYC: last-4 SSN, sometimes full ID photo + selfie depending on provider and amount.
3. Provider minimums (commonly $2–$20) and fees (a flat ~$0.50–$2, or 2–4%).
4. **Card declines are common** — many issuers block crypto merchant category codes outright. This failure is unexplainable to the reader and unfixable by us.

Either path, one conclusion: **you cannot economically on-ramp per tip.** A $2.50 fee on a $3 tip is absurd. So the product must ask the reader to **pre-load a balance** — "add $20, tip for the next ten issues."

That is the real cost of this architecture. It converts a one-tap impulse into a **prepaid-balance decision**. The reader is no longer deciding whether Marisol deserves $3; they are deciding whether to hand your unknown newsletter product $20 and their SSN. Those are different decisions with wildly different conversion rates.

**Installed:** nothing. **Signed up for:** a smart wallet + a KYC'd funding relationship. **Funded:** ~$20, of which ~$1.00–$1.50 evaporated in fees.

### Screen 5 — Confirm
Back on the tip page. Balance $19. "Send $3 to Marisol." Passkey prompt again. Submitted.

### Screen 6 — Done
~2 seconds (Base block time). "Marisol got $3." Optional 140-character note. A receipt link to BaseScan that no reader will ever click and that we should probably hide.

**Second and subsequent tips are one tap.** Screens 4 is never repeated until the balance runs out. The steady state is genuinely excellent; the cold start is genuinely brutal.

### Screen 7 (invisible, but mandatory) — Marisol's side
Nothing above matters unless the cook can get dollars:
1. Someone physically onboards Marisol at the restaurant — passkey wallet, address registered against her profile.
2. To convert USDC → USD: Coinbase account, full KYC (government ID, SSN), bank account link.
3. Sell USDC → USD → ACH to bank, 1–3 days. Batched weekly; per-tip cash-out is nonsense.
4. Her passkey lives on one phone. **Lost/replaced phone with no recovery configured = lost funds.** Use a wallet provider with real recovery, and verify it before a single dollar flows.
5. Tips are taxable income to her. At scale you are generating a reporting obligation with no paperwork attached to it.

---

## 2. Honest accounting

**Best-case first tip:** ~6–12 minutes, one passkey, one KYC relationship, one $20 prefund decision, zero app installs.
**Common-case first tip:** fails at Screen 4 — card declined, ACH hold, SSN request, or "why does tipping a cook need my ID."

**Funnel, order-of-magnitude:**

| Stage | Rate | Remaining |
|---|---|---|
| Issue sent | — | 200,000 |
| Taps a tip button | 2–4% | 4,000–8,000 |
| Completes passkey | ~60% | 2,400–4,800 |
| Completes funding/KYC | 20–40% | **500–1,900 first tips** |

Then a long tail of returning, already-funded tippers at near-100% conversion. Issue one is the wall; issue five is where the model either works or is obviously dead.

**Fee drag on a $3 tip:**
- Prefunded $20 path: ~5% (on-ramp), gas ~0%, cook's off-ramp ~0%. **≈5%.**
- Per-tip on-ramp path: **30%+.** Do not ship this.
- Stripe, for comparison: $0.30 + 2.9% = **13%** on $3.
- Venmo / Cash App / Zelle P2P: **0%**, zero onboarding.

That last line is the number to sit with.

---

## 3. What goes onchain

Applying the litmus test: a tip is a trustless value transfer, so the transfer is onchain. Everything else is not.

**Onchain:** the USDC transfer. That's it.
**Offchain:** cook profiles, photos, bios, tip feed, leaderboards, thank-you notes, email tokens, restaurant relationships, receipts. Index Base `Transfer` events to build the feed.

**Contracts for v1: zero.** A direct `USDC.transfer` to the cook's address is the whole product.

Write **one** contract only when you need something it actually buys you:
- **Splits** — 70% to the named cook, 30% pooled to the rest of the kitchen. Programmable, verifiable, auditable by the staff themselves. This is a real crypto advantage and the best argument for a contract.
- **Onchain memo/receipt** — an event carrying issue ID and note, so the feed is reconstructable without trusting our database.

Both fit in one contract, well under 100 lines, built on OpenZeppelin's `SafeERC20`. Never custody funds in it — forward in the same transaction. Custody is a licensing problem (§4.4), not a code problem.

---

## 4. What would have to change for this to be the wrong setup

The stack above is right only under specific conditions. Here is what flips it — roughly in order of how likely it is to already be true.

### 4.1 Everyone is domestic and on the same currency — **this probably already describes you**
"Our city's restaurants" means tippers and cooks share a city, a country, a currency, and a banking system. In the US that means Venmo, Cash App, Zelle and Stripe Link all move $3 instantly, for free, to people who already have the app installed and no onboarding at all.

Against that, the crypto flow's entire Screen 4 is **pure cost with no corresponding benefit**. If this is your situation — and the brief reads like it is — the right build is a Cash App `$cashtag` or a Stripe Payment Link in the email, and the engineering budget goes into the writing instead.

**This is the condition I would want you to rule out before committing to a build.** Everything else in this document is downstream of it.

### 4.2 You want to hold, pool, or take a cut of the money
The moment funds land in an account you control before reaching the cook — weekly payouts, a platform fee, splitting across a kitchen — you are transmitting money for others. That is a licensing regime (state MTL / FinCEN registration), not a smart contract question. If you want custody, use someone who already holds the licenses: **Stripe Connect** does custody, splits, KYC of recipients, and 1099s as a product feature.

Non-custodial, same-transaction routing is the version of this that avoids the problem — and is a legitimate reason to prefer crypto rails. But it only works if you never touch the money, which means no holding, no netting, no fees skimmed in transit.

### 4.3 The cook can't reliably hold a wallet
High turnover, shared phones, no smartphone, discomfort with self-custody, or a lost passkey with no recovery path. The receiving end is the quiet failure mode: reader-side onboarding got genuinely good, cook-side did not. If you cannot get the cook through KYC and a bank link, you have built a machine that traps money in a wallet nobody can open.

**Inverse case — this is where crypto clearly wins:** if the cook is unbanked, or is sending money home across a border, stablecoins beat every alternative on the board. If a meaningful share of your kitchens are in that situation, the setup above stops being a compromise and starts being the obviously right call.

### 4.4 Tips need to be reversible
Onchain transfers are final. A reader who fat-fingers $50 instead of $5 has no recourse, and a card chargeback against your on-ramp does not claw back the cook's USDC. If you need disputes, refunds, or a fraud window, you need card rails and their chargeback machinery.

### 4.5 You can't staff support
200,000 subscribers. One percent writing in about a declined card or a stuck ACH is 2,000 tickets, on a product with no "forgot password" because there are no passwords. Budget the support desk before the contracts, or use a rail where the support burden belongs to Stripe.

### 4.6 Amounts go up, or reporting kicks in
Once a cook clears meaningful annual volume you are in 1099 / payroll-adjacent territory no matter which rail you chose. Rails that emit tax documents as a feature beat a rail where you'd build that yourself.

### 4.7 The Base-specific bet stops paying
Base is chosen for exactly two reasons: near-zero gas and Coinbase distribution. If your readership turns out to be largely international and not on Coinbase, or the cooks need to receive somewhere else, the Coinbase on-ramp advantage disappears and the chain choice should be reopened from scratch. Don't stay on Base out of inertia once its superpower stops applying.

### 4.8 The one change that makes this setup *more* right
**Smaller amounts, higher frequency.** Per-dish tips, per-article tips, $0.25 reactions, several per issue. Traditional rails die instantly there — Stripe's fixed $0.30 is 120% of a quarter. Prefunded USDC on Base with sponsored gas handles it for a fraction of a cent, and the Screen 4 cost gets amortized across dozens of tips instead of one.

If you think the product eventually becomes "tip anything, any time, in tiny amounts," build it this way now. If it stays "one $3 tip after one weekly issue," the crypto rail never earns back its onboarding cost.

---

## 5. Recommendation

1. **Answer §4.1 first.** If your tippers and cooks are all domestic and banked, ship a Stripe Payment Link this week and revisit crypto only if §4.8 becomes true. That's the honest call given the brief as written.
2. **If you're building it anyway** — Base, USDC, Coinbase Smart Wallet passkeys, sponsored gas, zero contracts for v1, prefunded balances, non-custodial throughout.
3. **Pilot with three restaurants and one issue before touching all 200,000.** You need the real Screen 4 completion rate, not my estimate. That number decides the product.
4. **Onboard the cooks before you onboard a single reader.** Money arriving at a wallet nobody can open is the worst possible failure, and it's the one you'd discover last.

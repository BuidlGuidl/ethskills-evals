# Tipping a line cook from a restaurant newsletter — setup walkthrough and when it's the wrong setup

Context: ~200,000 subscribers, effectively zero wallet penetration, many with existing
Coinbase accounts. Tips are $1–$5, arriving in bursts in the hours after an issue lands.

Two parts, as asked:
1. The full first-tip walkthrough, every screen and every prerequisite.
2. What would have to change about the product for this setup to be the wrong one.

---

## Part 0 — The stack being walked through

I'm describing the *best available* version of the crypto path, not a strawman. If the
walkthrough looks long, that's the floor, not a build quality problem.

| Piece | Choice | Why |
|---|---|---|
| Chain | **Base** | The only relevant superpower here is Coinbase distribution + smart wallets. If you're not using that, Base has no advantage for this app. |
| Asset | **USDC** | A cook cannot be paid in something that moves 4% overnight. Non-negotiable. |
| Reader wallet | **Coinbase Smart Wallet** (passkey, ERC-4337) | No app install, no seed phrase, no extension. This is the single biggest lever on completion rate. |
| Gas | **Sponsored via paymaster** (Coinbase Paymaster or similar) | Reader must never see, hold, or think about ETH. A $3 tip that requires buying gas token is dead on arrival. |
| Contracts | **Zero** for the MVP | A tip is a USDC `transfer` to the cook's address. Add one splitter contract only if you pool tips (see Part 2). Writing a "TipJar" contract for this buys you nothing but an audit bill. |
| Cook's wallet | Smart wallet, **cook-custodied** | The moment you hold the cook's keys, you're a custodian with the regulatory posture that implies. |

Everything below assumes all of that is already built correctly.

---

## Part 1 — A first-time reader's first tip, screen by screen

Persona: reader opens Thursday's issue on an iPhone, in the Gmail app. Wants to send
Marisol, a line cook at a taqueria you profiled, **$3**.

### Screen 1 — The newsletter issue
Profile of Marisol, and a button: **"Tip Marisol"**. Tapping it opens a link
(`tip.yournewsletter.com/marisol?amt=3`).

> **First failure point, and it's a big one.** That link opens in Gmail's *in-app
> browser*, not Safari. Passkey creation and the Coinbase popup flow are unreliable-to-broken
> inside email-client webviews. You need an interstitial that detects the webview and says
> "Open in Safari" — which is itself a screen, and a drop-off. Budget for it; don't discover it
> in production.

### Screen 2 — Tip page
Marisol's photo, the restaurant, amount chips **$1 / $3 / $5 / other**, `$3` preselected.
A "Tip $3" button. This screen is good and does its job.

### Screen 3 — "Create your account"
Tap Tip → the reader is told they need a wallet. Best case this is framed as
*"Set up your tip account — takes 20 seconds, no app to download."*

### Screen 4 — Passkey creation
Coinbase popup → **Face ID** prompt → passkey saved to iCloud Keychain → a smart wallet
address now exists. Genuinely ~20–30 seconds, no seed phrase, no install. This is the part
of the crypto stack that actually works now.

### Screen 5 — The empty balance
Back on your page: **Balance $0.00**. The wallet exists; it has no money in it. Everything
so far was preamble. This is where the funnel actually dies.

### Screen 6 — Funding choice
"Add funds to tip." Two realistic paths:

**Path A — reader has a Coinbase account (your stated advantage).**
- 6a. "Pay with Coinbase" → Coinbase login (password + 2FA; many readers will need a
  password reset here — treat that as its own drop-off).
- 6b. Authorize the connection to your app.
- 6c. Choose a funding source. If they hold a cash balance or USDC already: near-instant.
  If they're funding from a linked bank: **ACH can take 1–5 business days to be withdrawable**,
  so the tip does not go out tonight, while the issue is fresh. Debit card is instant but carries
  a percentage-plus-fixed fee.
- 6d. Confirm purchase. **Onramps typically enforce a minimum purchase** (commonly $5–$20 —
  verify current values, they move). So a reader who wanted to send $3 is now being asked to
  buy $10 or $20 of a thing they've never held.

**Path B — no Coinbase account.** Full onramp KYC inside your flow: legal name, DOB, home
address, SSN (often last 4, sometimes full), frequently a government ID photo plus a selfie
liveness check. Two to ten minutes, with a materially non-trivial rejection/manual-review rate.
Some readers will simply stop here on principle — you've asked a person for their Social
Security number so they can tip a cook three dollars.

### Screen 7 — Funding confirmation / waiting
"Purchase complete" or "Pending." If pending, the session is over and you're relying on an
email to bring them back. Assume most don't come back.

### Screen 8 — Back to the tip
Balance now reads e.g. **$10.00 USDC**. "Tip Marisol $3" → Face ID → done.
Gas is sponsored, so no ETH, no "insufficient funds for gas." Confirms on Base in ~2 seconds.

### Screen 9 — Confirmation
"Marisol got $3." Optional note to her. Remaining balance $7.00, with a nudge: *"You have
$7 left — tip someone next week."* This nudge is the whole economic argument for the model; see below.

### And the side of it nobody demos: the cook

- Marisol needs a wallet, created at onboarding (you can do this well — in person, once).
- To pay rent, she needs **dollars in a bank account**. That means Coinbase (or similar)
  sign-up with full KYC, sell USDC → USD, withdraw → 1–3 business days.
- If she is undocumented or unbanked, that offramp is a hard wall — *and that fact is the
  strongest real argument for this whole project. Hold that thought for Part 2.*
- Tips are taxable income. That's true on any rail, but you're now the entity generating the
  record, which means it's your problem to have an answer for.

### The honest tally for a first-time reader

| | |
|---|---|
| Apps to install | **0** (if, and only if, you solve the email-webview problem) |
| Accounts to create | 1 passkey wallet, **plus** a Coinbase/onramp account with full identity verification if they don't have one |
| Money to pre-fund | Yes — likely a $5–$20 minimum to send $3 |
| Screens, first tip | **~9–14**, including one identity-verification detour and possibly a multi-day wait |
| Screens, second tip | **2–3**, if funds remain |

### The economics of a $3 tip
A one-off card-funded $3 purchase can lose **15–30%** to onramp fees. The only way the model
works is to convert the first tip into a *wallet-loading* decision: "put $25 in your tip
wallet." That's a real product, but understand what you've done — you've replaced a $3
impulse with a $25 commitment, at the exact moment the reader trusts you least. The
low-friction thing (tiny amount) and the low-fee thing (large prefunded balance) are in
direct conflict, and everything downstream turns on how you resolve it.

### What I'd expect from a 200k send (estimates, not measurements — instrument these)
- 3–5% click the tip link → ~6,000–10,000 land on the page
- ~40–60% complete passkey creation (good; this part is genuinely solved)
- ~30–50% of *those* clear funding/KYC — the dominant loss
- Net: roughly **1–3% of clickers complete a first tip**, i.e. a few hundred first tips per issue

Repeat tippers with funded balances behave completely differently — near-frictionless. So the
question this product lives or dies on is: **what fraction of readers will ever cross the
funding wall once?** Everything after that is easy. Nothing before it is.

---

## Part 2 — What would have to change for this to be the wrong setup

Two separate questions, and it's worth keeping them apart: (A) is crypto the wrong rail, and
(B) given crypto, is *this* crypto stack wrong.

### A. When crypto is the wrong rail — including, as specified, probably now

As you've described the product, every economic actor is domestic and dollar-denominated: a
US reader with a US card tipping a US cook who wants US dollars in a US bank. On that path,
the crypto leg is a **round trip out of dollars and back into dollars**, and you pay for it
twice — onramp fees and KYC friction on the reader's side, offramp delay and KYC on the
cook's side. Apple Pay on a Stripe-backed tip link is ~2 screens and zero new accounts.

Flatly: if the only thing you need is "reader sends cook three dollars," the setup in Part 1
is the wrong one, and the walkthrough above is the evidence.

**These are the changes that would flip it.** Any *one* of the first three is enough:

1. **The cooks can't or won't use conventional rails.** Undocumented workers, workers without
   bank accounts, workers who won't attach a legal identity to a payments account, workers who
   have been deplatformed by Venmo/PayPal or had funds frozen. A self-custodied wallet has no
   application form and nobody to deny it. *For line cooks specifically this is not
   hypothetical, and if it's true of your cooks, say so out loud — it's the actual thesis of
   the product and it changes every other decision here.*
2. **The money needs to leave the country.** A cook remitting to family in Mexico or Guatemala
   pays ~5–6% and waits days through conventional remittance. Stablecoin to a family member's
   wallet with a local cash-out is meaningfully cheaper and faster. This makes the crypto leg a
   *destination* rather than a detour — the single biggest structural change available to you.
3. **You'd otherwise have to onboard hundreds of merchants.** Scaling to every restaurant in
   the city via a PSP means KYB, business documents, and bank details for each one — which most
   small restaurants will not complete. "Give me an address" scales differently.
4. **Tips must split programmatically.** One tip fanning out across a kitchen of eight by a
   defined rule, auditably, instantly. This is where you'd add your *one* contract — a splitter.
   Doing the same thing with a PSP means you hold and disburse funds, i.e. you become a payments
   company.
5. **You must not be the custodian.** Non-custodial peer-to-peer transfer keeps you out of
   money-transmission territory in a way that pooling readers' dollars does not. Get real legal
   advice here; don't take a design doc's word for it.
6. **Instant, 24/7 settlement is the product.** A cook getting tips in hand at the end of the
   Friday shift is a different emotional product from a T+2 ACH deposit.
7. **Your readers already hold crypto balances** and would rather spend those than dollars.
   You've said the opposite is true, which is precisely why the funding wall dominates
   everything above.

If **none** of 1–7 holds, build the Stripe/Apple Pay version, ship it in a week, and revisit.

### B. When *this particular* crypto stack is the wrong crypto stack

Assume you've decided crypto is right. These changes would each invalidate a specific choice above:

- **Amounts get large or balances get held.** $1–$5 transient balances tolerate sequencer
  trust and smart-wallet novelty fine. If this becomes "cooks accumulate savings here," the
  security assumptions tighten and mainnet or a hardened custody story starts to matter.
- **Recipients are outside the US.** Base + USDC is the right call for a US-domestic cook.
  If payouts land in Nigeria, the Philippines, or Latin America, what matters is which
  asset and chain the *local* cash-out desks actually price well — often not the one that's
  technically cleanest. Pick for the offramp that exists, not for the chain you prefer.
- **Coinbase distribution stops being the asset.** Base's advantage here is precisely that
  your readers have Coinbase accounts and that smart wallets remove installs. If your
  audience shifts to non-US, or Coinbase's onramp economics on $5 purchases stay punitive,
  Base's superpower doesn't apply and the chain choice should be re-opened.
- **Tips need pooling or escrow** (held until a shift ends, split across staff, refundable).
  Zero contracts stops being right — but the answer is *one* splitter contract, not a platform.
- **Regulation forces custody.** If you end up needing to hold funds, the architecture inverts:
  a conventional custodial ledger in the middle, with crypto only at the edges where it earns
  its keep (e.g. the cross-border payout leg).
- **Email clients keep breaking passkeys.** If the webview problem proves unfixable at scale,
  the no-install premise is gone, and an installed app changes the whole calculus back toward
  conventional rails.

---

## Recommendation

Run the cheapest experiment that tells you which world you're in, before committing to a build:

1. **Ask five cooks** whether they have bank accounts, whether they'd use Venmo for this, and
   whether they send money out of the country. Their answers decide this, not the reader UX.
   If they're all banked, happily using Venmo, and not remitting — build the Apple Pay version.
2. **If the cooks give you reason 1 or 2 above**, run one issue with a handful of cooks on the
   Part 1 stack and instrument exactly four numbers: link clicks → passkey completions →
   **funding completions** → repeat tips in the following issue. The third number is the
   whole business.
3. Either way, the build itself stays small: **zero contracts**, Base, USDC, sponsored gas,
   Coinbase Smart Wallet, a Coinbase onramp, and one very good mobile tip page. Most of the
   work is the funding wall and the cook's cash-out, and neither of those is Solidity.

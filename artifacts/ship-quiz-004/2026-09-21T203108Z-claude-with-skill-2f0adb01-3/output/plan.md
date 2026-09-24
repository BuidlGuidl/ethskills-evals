# Restaurant Newsletter → Direct Tips to a Line Cook

Two deliverables, as asked:

1. The full first-tip walkthrough — every screen, every install, signup, and funding step before a dollar reaches the cook.
2. The inversion: what would have to change about this product for that setup to be the wrong one.

A note before part 1, stated once and then dropped: several of the conditions in part 2 look like they may already be true for you today (US-domestic, bank-having recipients, one-off $3 tips from people with no wallet). I've written the walkthrough at full fidelity anyway, because you asked for it and because the honest version of it is exactly the evidence you need to make the call. Read part 1 as a cost sheet, not as a recommendation.

---

## 0. The architecture the walkthrough assumes

Chosen before the screens, because the screen count is a *consequence* of these choices.

| Decision | Choice | Why |
|---|---|---|
| Chain | **Base** | Its superpower is literally your situation: Coinbase distribution, existing Coinbase accounts, smart wallets / account abstraction, and sub-cent fees for $1–$5 payments. Mainnet at ~$0.004/transfer is affordable but the AA + Coinbase onramp tooling is where Base earns it. |
| Asset | **USDC on Base** | Tips are denominated in dollars. Nobody tips "0.0009 ETH." USDC is native on Base, 6 decimals (not 18 — this bites people). |
| Wallet | **Coinbase Smart Wallet** (passkey, ERC-4337) | No browser extension, no app install, no seed phrase. Created in-page with Face ID / Touch ID. This is the single biggest screen-count reduction available. |
| Gas | **Sponsored via paymaster** (Coinbase Developer Platform) | Reader never holds ETH, never sees the word "gas." You eat ~$0.001–0.01/tip. At 2,000 tips/issue that's under $20/issue. |
| Contracts | **0 for MVP, 1 if you need splits/receipts** | A tip is an ERC-20 `transfer` to the cook's address. That's it. Add one small `TipJar.sol` only if you want an onchain event log for receipts, an optional platform fee, or restaurant/cook splits. Do not build three contracts. |
| Off-chain | Cook profiles, photos, issue content, leaderboards, receipts UI, email | None of it involves trustless value transfer. Index the `Transfer`/`Tip` events; don't store profiles onchain. |

**State transition audit** (the whole system, because it's this small):

- `USDC.transfer(cook, amount)` — called by the reader, because they want to tip. If nobody calls it, nothing breaks; there's just no tip. No keeper, no cron, no admin function, no dead code. That's the mark of a correctly-sized design.
- Optional `TipJar.tip(cook, amount, memo)` — same caller, same incentive, plus an event your backend indexes for "your tip receipt" emails.

There is no function in this product that requires a stranger to pay gas to advance someone else's state. Good. Most bad dApp designs fail this test.

---

## 1. The first-time reader's first tip — every screen

Persona: reader opens issue #47 on an iPhone, in Mail, at 8am. Has a Coinbase account from 2021 with $0 in it. Has never used a wallet. Wants to send Marisol, line cook at Pargo, **$3**.

### Path A — Self-custody smart wallet (the "real crypto" path)

| # | Screen / step | What the reader does | New friction introduced |
|---|---|---|---|
| 1 | **Email, issue #47** | Reads the profile of Marisol. Taps **"Tip Marisol $3."** | — |
| 2 | **Tip page** (mobile web, opens in Mail's in-app browser) | Sees Marisol's photo, the restaurant, preset amounts $1 / $3 / $5. Taps $3. | *In-app browser caveat:* passkey creation is unreliable inside some embedded webviews. You will need an "Open in Safari/Chrome" interstitial for a slice of users. This is a real, unglamorous 1–2 screen tax. |
| 3 | **"Continue" → Coinbase Smart Wallet sheet** | Popup: "Create a wallet." Taps **Create**. | First account creation. |
| 4 | **Passkey prompt (OS-level)** | Face ID / Touch ID. Passkey is saved to iCloud Keychain. | No install, no seed phrase, no password. This step is genuinely good — ~5 seconds. |
| 5 | **Back on tip page** | Wallet exists. Balance: **$0.00**. The page says "Add $3 to continue." | **This is the wall.** Everything before this was 20 seconds. Everything after is the actual cost of the product. |
| 6 | **Funding chooser** | "Fund with Coinbase" / "Debit card" / "Apple Pay" | — |
| 7a | **Fund with Coinbase** (their case) | Redirect to Coinbase → log in (email + password + 2FA, and they've forgotten the password, because it's 2021's account) → password reset email → back → 2FA SMS → authorize the connection → choose asset (USDC) and network (**Base**) → amount. | Login + password reset + 2FA: **3–5 screens and an email round-trip**, and the largest single drop-off point in the funnel. The Coinbase account you're counting on as an asset is 5 years stale. |
| 7b | **Or: debit card / Apple Pay onramp** (no Coinbase account, or gave up on 7a) | Enter card → **identity verification: legal name, DOB, address, SSN last 4, photo of driver's license, selfie** → wait for approval (minutes, sometimes 24h+) → purchase. | Full KYC. For a **$3 tip.** Approval is not guaranteed and not instant. Some cards decline crypto MCC codes outright. |
| 8 | **Minimum-purchase problem** | Onramps have practical minimums and flat fees. A $3 buy is often not offered; where it is, fees can be $0.50–$2 on a $3 purchase. The reader ends up buying **$10 or $20** of USDC. | They now hold $7–$17 of stranded stablecoin they didn't want. You must have an answer for this, and "tip again next issue" only works if they open the next issue. |
| 9 | **Funds land** | 10 seconds (Coinbase→Base internal) to a few minutes (card). Page polls, shows "$20.00 available." | A waiting screen. On a card purchase this is where people put the phone down. |
| 10 | **Confirm tip** | Taps **Send $3**. Passkey prompt (Face ID). | Clean. |
| 11 | **Pending** | "Sending…" ~2 seconds on Base. Gas: $0, sponsored. | Good. |
| 12 | **Done** | "Marisol got your $3." Basescan link, share card, "tip again next issue." Receipt email. | — |

**Honest tally for step 1 → 12, first time ever:** 12–18 screens, one password reset, one 2FA, possibly a full government-ID KYC with a selfie, a minimum purchase 3–7× larger than the intended tip, and 4–15 minutes elapsed. **Realistic completion rate for a cold newsletter audience: 1–5%.**

**Second tip, next issue:** tap link → tap $3 → Face ID → done. **3 screens, ~10 seconds, and they already have the stranded balance to spend.** This is the entire argument for the setup, and it only pays off if readers tip repeatedly.

### The other half nobody counts: getting it to the cook as money

"Before the money reaches the cook" includes the cook.

| # | Step | What Marisol does |
|---|---|---|
| 1 | Onboarding (you do this, in person, at the restaurant) | Create her Coinbase Smart Wallet on her phone, passkey, 3 minutes. Verify the address out-of-band — **address-substitution is your #1 fraud risk**, see below. |
| 2 | Receiving | Tips arrive as USDC on Base. She can see them instantly. This part is genuinely excellent: no 2–5 day settlement, no chargebacks, no 2.9%+$0.30 per $3 tip (which is 12% at $3). |
| 3 | **Cashing out** | Coinbase account signup → **full KYC (ID, SSN, selfie)** → send USDC from smart wallet to her Coinbase deposit address on Base → sell USDC → link bank → ACH withdraw → **1–3 business days**. Or instant to debit for ~1.5%. |
| 4 | Taxes | Tips are taxable income. Stablecoin receipts still generate a reporting obligation, and if you're seen as facilitating payments you inherit 1099 questions. Talk to an accountant before issue #1, not after. |

So the end-to-end answer to "everything they have to install, sign up for, or fund": **reader** — nothing installed (good), one wallet created, one Coinbase login recovered *or* one full KYC, one overfunded purchase; **cook** — one wallet, one full KYC, one bank link, 1–3 day settlement.

### Path B — Hosted Coinbase checkout, no wallet at all (what I'd actually ship for issue #1)

Same crypto rails, ~60% fewer screens, because you skip wallet creation and funding entirely for the reader:

1. Email → tap "Tip Marisol $3."
2. Tip page, tap $3, tap **Pay with Coinbase**.
3. Coinbase-hosted checkout: log in, confirm, pay **from existing Coinbase balance** (or their linked card/bank through Coinbase's own rails).
4. Done → USDC lands at your treasury address on Base → you forward to Marisol's wallet, or batch-settle nightly.

**~5 screens. No passkey, no wallet, no onramp minimum, no stranded balance, no KYC for anyone who already has a Coinbase account.** The trade: it's custodial at the checkout step and you're a payment intermediary in the middle, which is a compliance posture (money transmission questions), not just an engineering one. Get a lawyer's read before you hold reader funds even for a night. Path A is the *opt-in upgrade* you offer to the readers who tip three issues running — not the default you force on 200,000 people.

### Burst-traffic notes (you said tips arrive in bursts after each issue)

- Base handles the volume; 2,000 tips in an hour is nothing. Your constraint is the **onramp**, not the chain.
- Paymaster: set per-address and global spend caps before launch, or a bot drains your gas sponsorship the first time you're on Hacker News.
- Your RPC and the onramp widget are your rate-limit risks. Pre-warm, cache the tip page statically, and make the cook profile page work with zero JS.
- **Address substitution is the real attack.** Someone forwards a look-alike "tip Marisol" link with their own address. Defenses: never render an address the reader must verify (they won't), serve cook addresses only from your own backend, sign the tip payload, put the cook's photo + restaurant + a short human-readable ID on the confirm screen, and register an ENS/Basename per cook so the confirm screen reads `marisol.pargo.eth`.

---

## 2. What would have to change for this setup to be the wrong one

The setup earns its screen count only under a specific set of conditions. Here's the inversion — each row is a condition that, if it flips, moves the correct answer away from onchain rails.

### It becomes the wrong setup if…

**1. Tips stay one-and-done.** The whole economics of part 1 is amortization: an expensive first tip paid back over many cheap later ones. If the median reader tips **once, ever**, you paid a 15-screen onboarding cost for a single $3 transfer and captured maybe 2% of your list. Stripe + Apple Pay is one tap and converts at 10–20×. *Test before you build:* put a plain Stripe tip link in issue #47 and measure. If repeat rate after three issues is under ~30%, crypto rails are the wrong setup and the data will say so for the price of one issue.

**2. The cooks all have US bank accounts and legal work authorization.** Then the cook-side advantage — instant settlement, no bank required, no chargebacks — is mostly redundant with ACH, and you've added a KYC + offramp + tax-reporting burden onto a minimum-wage worker. Crypto's real edge here is paying someone the banking system won't serve well. If it serves them fine, you're carrying the cost without the benefit.

**3. Tips get smaller or more frequent rather than larger.** Counter-intuitively, a $1 tip is *worse* for this setup, not better — onramp minimums and KYC don't scale down. Card fees hurt at $1 too (30% at $1!), so this argues for pooling ("tip $10, split across five cooks this issue") in *either* stack, which reduces the crypto-specific advantage.

**4. You need refunds, disputes, or a "the cook quit" path.** Onchain transfers are final. If a reader tips the wrong cook, or a cook leaves and their wallet goes dark, or someone tips with a stolen card through the onramp — you have no reversal. A card processor gives you dispute machinery for the ~3% you're trying to save. The moment your support inbox has a refund problem, custodial rails are correct.

**5. Readers are not already on Coinbase.** Your one genuine structural advantage is "many already have Coinbase accounts." That's what makes Base + Coinbase-native funding defensible instead of arbitrary. If that turns out to be 3% of the list rather than 30%, Path B collapses to Path A's full KYC gauntlet and the reason to be on Base at all mostly evaporates. **Survey this before you build anything** — one question in issue #46. It's the load-bearing assumption of the entire plan.

**6. You end up holding funds between reader and cook.** Path B's convenience makes you a payments intermediary; enough volume and that's a money-transmission question, state by state. If legal says you can't hold, you're pushed back to Path A's screen count — and that changes the product's economics, not just its plumbing.

**7. The newsletter's value is editorial reach, not payment innovation.** If tipping is a feature of a media business rather than the business itself, every engineering hour spent on wallet onboarding is an hour not spent on the thing 200,000 people actually subscribed for. Ship the boring integration, keep writing.

### It stays the right setup if…

- Readers tip **repeatedly** (the 3-screen returning flow is genuinely better than any card checkout, and it's the only flow in this doc that's *pleasant*).
- Some cooks are **unbanked, undocumented, or abroad**, and 1–3 day ACH or "no bank account" is a real barrier today.
- You want **cooks paid in minutes, not next Tuesday**, and the 2.9% + $0.30 (a 12% haircut on a $3 tip) is money you'd rather put in Marisol's pocket.
- You want tips **verifiable and public** — an onchain record that the money went to the cook and not to the house is a trust story a restaurant newsletter can actually sell, and it's one thing Stripe structurally cannot offer.
- You're building toward something compositional later: reader-held "regular" badges, cook-side savings, cross-restaurant reputation. Onchain earns its keep when other things build on it.

### The recommendation, in one paragraph

Put a Stripe/Apple Pay tip link in the next issue and measure conversion and repeat rate. In parallel, ask one survey question about Coinbase accounts. If repeat rate is healthy **and** Coinbase penetration is real **and** you have cooks the banking system serves badly, build Path B (hosted Coinbase checkout, USDC on Base, zero or one contract, sponsored gas, ~5 screens) and offer Path A's self-custody smart wallet as an upgrade to your repeat tippers only. If any of those three fails, the boring processor is the right answer and this document's main value was making the cost visible before you spent six weeks on it.

### If you build it: scope

- **Contracts:** 0 to start (direct USDC transfer). Add one ~80-line `TipJar.sol` — `tip(address cook, uint256 amount, bytes32 memo)`, emits `Tipped` — only when you need receipts, splits, or a fee. Use OpenZeppelin `SafeERC20`. Remember USDC is 6 decimals.
- **Frontend:** the tip page is the product. Static, fast, works from an email client's webview, cook photo on the confirm screen, human-readable recipient name, no address ever shown as something to verify.
- **Before launch:** paymaster spend caps; signed tip payloads; a fork test of the transfer path; a fresh-context security review of `TipJar.sol` if you write one; and a written answer to "a reader tipped the wrong cook, now what?"

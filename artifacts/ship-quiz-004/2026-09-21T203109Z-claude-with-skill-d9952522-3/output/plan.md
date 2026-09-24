# Tipping a line cook from a 200k-subscriber restaurant newsletter

You asked for two things: the full first-tip walkthrough, and the conditions under
which that setup would be the wrong one. Answering the first honestly mostly
answers the second, so I've written the crypto walkthrough at full length, then
the walkthrough I'd actually ship, then the list of changes that would flip the
recommendation — with the onchain design sketched out for the day you hit one.

One flag up front, unrelated to rails: direct-to-one-cook tipping collides with
tip-pooling law (FLSA and most state statutes govern who may share in tips, and
an employer directing tips to a back-of-house employee has rules attached), and
the cook owes income tax on money that arrives with no W-2 line and no 1099.
That is true on every payment rail and is more likely to kill this build than
any technical choice. Worth a call with an employment lawyer before engineering.

---

## Part 1 — The walkthrough, onchain version

Assume the best case in your premise: the reader has a Coinbase account, is on a
phone, and is motivated enough to finish.

The premise has one load-bearing error worth naming first. **A Coinbase account
is not a Coinbase Wallet.** Coinbase is a custodial exchange app; Coinbase Wallet
is a separate self-custody app with a separate install and its own recovery
phrase. "Many already have Coinbase accounts" buys you a funding source, not a
wallet. It removes roughly one step from the twelve below.

### Screen by screen

1. **Email client.** Issue lands. "Tip Marisol $3" with $1 / $3 / $5 buttons.
2. **Tip page, in an in-app browser.** Gmail and Apple Mail open links in an
   embedded webview, not Safari. Amount picker, "Connect wallet." Note that
   wallet deeplinks and the return bounce are unreliable in webviews — you will
   lose people here to a blank screen, not to a decision.
3. **Wallet picker.** Coinbase Wallet / MetaMask / "Sign in with Coinbase." The
   reader has none of these and does not know what the words mean.
4. **App Store.** Install Coinbase Wallet. A few hundred MB over LTE. They have
   now left your funnel and are in Apple's.
5. **Wallet creation.** Username, passcode, Face ID, then the recovery-phrase
   screen: twelve words, "write these down, do not screenshot, we cannot recover
   them." The reader is being asked to accept permanent custody of a secret in
   order to give a stranger three dollars.
6. **Empty balance.** Wallet holds $0. Nothing can be sent yet.
7. **Onramp.** "Buy crypto" → Coinbase Onramp → sign in to the Coinbase account
   → 2FA → possibly re-verify identity if the account is dormant (legal name,
   DOB, last four of SSN, address, sometimes an ID photo and selfie).
8. **Asset and network selection.** USDC, network: Base. The reader must now
   understand that a token exists on specific networks and that picking the wrong
   one loses the money. There is no way to explain this in a tipping flow.
9. **Amount and payment method.** Onramp minimums are typically $2–$5, so to tip
   $3 they buy $5 or $10 — they must fund *more* than they wanted to give. Fees
   are near-flat (roughly $0.99, or ~2–4%, higher on card), so the fee on a $3
   tip runs 10–30%. Debit is instant; ACH is spendable off-platform in 3–5
   business days. Card purchases of crypto frequently trip the issuer's fraud
   rules, so a fair number of readers get a "did you authorize this?" text from
   their bank instead of a balance.
10. **Wait.** Minutes at best, days on ACH. The email is now buried. Whatever
    made them want to tip Marisol has passed.
11. **Back to the tip page.** Connect wallet → deeplink out to Coinbase Wallet →
    approve connection → bounce back to the webview. Each hop is a drop-off.
12. **Gas.** If you use any contract, there's an ERC-20 approval transaction
    first. Both it and the transfer cost gas in **ETH**, which the reader does not
    have — they bought USDC. Without a sponsored-gas setup this is a dead end:
    a second onramp purchase, for an asset whose purpose cannot be explained.
    Sub-cent gas on an L2 does not help if the user holds zero of it.
13. **Signature screen.** The wallet shows a 42-character hex address. The reader
    has no way to confirm it belongs to the cook. They tap Confirm on faith.
14. **Confirmation.** ~2 seconds. Receipt screen. The cook has $3.
15. **The cook's side, which is also part of the walkthrough.** The cook needs
    their own wallet and their own recovery phrase, then a Coinbase account, then
    KYC, then sell USDC, then ACH out, 1–3 days. Plus a cost-basis record for
    every $3 arrival at tax time.

**Totals for the reader:** 1 app install, 1 new account, 1 identity verification,
1 recovery phrase, 1 funding event with a 10–30% overhead on a $3 tip, ~12
screens, and an elapsed time measured in minutes to days. On a cold 200k list
of people who have never used a wallet, expect a conversion rate in the low
fractions of a percent — and most of the loss happens at steps 4–9, before any
money moves.

### The best possible onchain version

Embedded wallet (email or passkey sign-in, no app install, no seed phrase),
sponsored gas via a paymaster so ETH never appears, and the onramp embedded in
your page with Apple Pay. That gets you to about five screens:

email → tip page → sign in with email → Apple Pay through the onramp (KYC still
applies above guest-checkout limits) → confirm.

This is a genuinely good flow and it is what I'd build if you were committed.
It removes the install, the seed phrase, and the gas token. It does **not**
remove: identity verification, the onramp minimum that forces a $5 purchase for
a $3 tip, the near-flat onramp fee that eats 10–30% of a micro-tip, or the cook's
offramp. The cliff moves; it doesn't disappear. And the part it can't fix — the
fee floor on getting fiat onchain — is exactly the part that matters at $1–$5.

---

## Part 2 — The walkthrough I'd actually ship

1. **Email.** "Tip Marisol" with $1 / $3 / $5 buttons.
2. **Stripe Checkout.** The Apple Pay / Google Pay sheet is already populated
   with their card and address. Double-click the side button.

Done. Two screens, zero installs, zero signups, about ten seconds, works in the
email webview. Cook onboards once through Stripe Connect Express (name, DOB,
bank account, SSN — required by KYC law on any rail) and is paid out weekly.

Micro-payment fees are bad everywhere; be clear-eyed about it. Stripe takes
roughly $0.30 + 2.9%, so ~13% on a $3 tip. That is worse than onchain gas and
much better than the onramp fee a first-time crypto reader pays. Mitigations are
product-side, not rails-side: default to $5, offer a "cover the fee" checkbox,
or let a reader load a $20 tipping balance once and spend it down across issues
(one card fee instead of six — this is the same batching argument crypto people
make, and it works just as well on cards).

The honest comparison is not "$0.002 gas vs. $0.39 Stripe." It is the cost of
moving $3 of a newsletter reader's fiat into a form the cook can spend. Onchain
that is $1–$3 plus KYC plus days plus a 90%+ drop-off. On cards it is $0.39 and
ten seconds.

---

## Part 3 — What would have to change for that to be the wrong setup

These are the changes that would actually flip me to onchain. Each is about the
product, not the technology.

1. **The cook can't be onboarded to Stripe Connect.** Recipients outside
   supported countries, or undocumented workers with no SSN and no bank account.
   This is a hard wall that no UX work gets around, and stablecoin payout to a
   wallet becomes the only rail that functions. This is by far the most likely
   real flip, and if your city's kitchens are what I suspect they are, it may
   already be true for some of the people you want to pay.
2. **Payouts need to be censorship-resistant.** If recipients are political, sex
   workers, or otherwise the kind of account a payment processor's risk team
   eventually closes without appeal, you will get shut off at the worst moment.
   Removing the intermediary who can say no is a real property with a real price.
3. **Money must split across a rotating crew with no trusted operator.** If a tip
   goes to "whoever worked Tuesday dinner" and the staff does not trust the
   restaurant to divide it, a splitter contract is an actual trust boundary. If
   the restaurant is trusted — the normal case — a database and one weekly ACH
   is strictly better and you should not build the contract.
4. **You want to hold funds between collection and payout.** Custodying other
   people's money is money-transmission territory. Stripe Connect absorbs that
   obligation for you; a pooled balance you control does not. A non-custodial
   contract only the cook can withdraw from is a different posture — but this
   cuts both ways and needs counsel, not an assumption that onchain is exempt.
5. **The tip record has to outlive you.** If "the cook can show a lender three
   years of verifiable tipping income" or "another app reads our tip graph" is a
   product requirement, that's genuine composability and permanence. If it's a
   leaderboard on your own site, it isn't — that's a Postgres table.
6. **The audience changes.** 200k Farcaster followers instead of 200k email
   subscribers and the whole thing inverts: a mini-app tip is two taps and card
   checkout is the clumsy path. Distribution decides the rail, not ideology.
   Worth saying plainly: your list being email is the single biggest fact here.
7. **The amounts change shape.** At $500 to an international recipient, a ~1%
   stablecoin corridor beats a 4–6% wire with FX spread. At $3 domestic, it never
   does. Crypto's advantage is in the tail, and your stated range is the opposite
   of the tail.

**Things that would *not* flip it:** wanting a token; wanting the product to feel
onchain; gas being cheap on an L2; or the 2.9% card fee by itself.

---

## Part 4 — The onchain design, for the day you hit one of those

Kept deliberately minimal so it's buildable rather than aspirational.

**Chain: Base.** The product-specific reason is your own premise — the one piece
of crypto infrastructure your audience already has is a Coinbase account, and
Base is where Coinbase's onramp, embedded wallet, and paymaster are first-party.
That's the shortest path from "has a Coinbase login" to "has a funded, spendable
balance." USDC is natively issued there rather than bridged, so the cook's
offramp is a first-class path. Measure actual fees before committing; order of
magnitude is a fraction of a cent per transfer, but don't take that from me.

**Custom contracts: zero for v1.** A tip is `USDC.transfer(cookWallet, amount)`.
No escrow, no factory, no router. Add exactly one contract — a `TipSplitter`
with immutable basis-point shares and a permissionless `distribute()` — only if
flip condition 3 is true. That is the entire contract surface.

**Onchain:** the transfer and its event. **Offchain:** cook profiles, photos,
bios, which issue drove the tip, running totals, leaderboards. Rankings are
derived — index the transfer events and sort in Postgres. Never store a
leaderboard in contract storage.

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `USDC.transfer` / `tip()` | reader (sponsored by paymaster) | sends the tip they intended | no tip; nothing stuck anywhere |
| `distribute()` on splitter | any recipient, or the restaurant | releases their own share | funds stay in the contract, claimable forever |
| `withdraw()` by cook | cook | gets their money | balance sits indefinitely; no expiry, no owner sweep |

No owner-only function moves funds. No scheduled job is required for liveness.

**Deployment runbook (Base, Foundry):**

```bash
export BASE_RPC_URL=...
export BASESCAN_API_KEY=...
# deploy from a hardware wallet; do not put a hot key in env for mainnet
forge test --fork-url $BASE_RPC_URL          # fork tests for the USDC integration
forge script script/Deploy.s.sol \
  --rpc-url $BASE_RPC_URL --broadcast --verify --ledger

# post-deploy smoke test: push 0.01 USDC through the real path from a fresh wallet
cast send $USDC_BASE "transfer(address,uint256)" $COOK_WALLET 10000 \
  --rpc-url $BASE_RPC_URL --ledger
```

Take `$USDC_BASE` from Circle's official documentation or Base's own docs at
deploy time. Do not copy a token address out of a blog post, a chat message, or
this file — a wrong address sends real money to an attacker, and it is the most
common way this kind of project loses funds on day one.

**Ownership:** the splitter ships ownerless with immutable shares. Anything that
does need an admin goes to a 2-of-3 Safe (you, the GM, your engineer), never an
EOA. Verify contracts on Basescan before announcing.

---

## Recommendation

Ship Part 2 this week: Stripe Checkout, Apple Pay, weekly Connect payouts,
default tip $5. Instrument conversion per issue. Spend the saved engineering time
on the employment-law question, the cook's tax paperwork, and keeping one named
kitchen worker's identity safe from 200,000 strangers — those are the real risks
and they're identical on both rails.

Revisit Part 4 only when a specific cook you want to pay cannot be onboarded to
Stripe. That's a concrete trigger, you'll know the day it happens, and by then
you'll have the tipping volume to justify building against it.

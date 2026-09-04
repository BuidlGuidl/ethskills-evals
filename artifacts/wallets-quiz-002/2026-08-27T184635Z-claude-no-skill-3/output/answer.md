# $250k solo treasury: what I'd actually do

**Short version: I can't sign off on the plan as stated.** Your teammate is right that a
hardware wallet is a necessary component — a Ledger will be in my setup too. They're wrong
that "one Ledger" is a custody design, and wrong that "nothing is more secure."

A single hardware wallet is a *single-signature* account. That means one key carries full
spending authority, and every way that key can be stolen, lost, destroyed, or misused is an
independent path to losing 100% of the $250k. You don't need a second *person* to fix that.
You need a second and third *key*, all held by you.

Assumption: I'm assuming EVM (mainnet/L2, ETH + stablecoins). If any of this is Bitcoin, the
same architecture applies with different tooling — see "If it's Bitcoin" at the end.

---

## Why the teammate's plan fails

With one Ledger holding everything, an attacker needs to compromise **any one** of these.
It's an OR gate, and it's a long list:

1. **The seed phrase backup.** This is the real problem, and it's structural. Your 24 words
   are a bearer instrument worth $250k sitting on a piece of paper or metal. To survive fire,
   flood, or loss you want copies. Every copy is another complete, self-sufficient theft
   target. Secrecy and durability pull in opposite directions and single-sig gives you no way
   to resolve the tension — you just pick which risk you'd rather eat.
2. **The device + PIN.** Burglary, a "help me get this laptop out of storage" moment, a
   cleaner, a landlord, an ex-roommate. Ledger's secure element is genuinely good, but you're
   betting $250k on 8 digits and a rate limiter.
3. **One bad signature.** This is the one people underrate. A hardware wallet does not
   protect you from approving a malicious transaction — it faithfully signs whatever you
   confirm. Drainer front-ends, a compromised dApp, an address-poisoning lookalike, an
   unlimited `approve` to a hostile spender, opaque calldata the Ledger screen can't fully
   clear-sign. One tap on the right (wrong) prompt and the treasury is gone. The device did
   its job perfectly.
4. **Coercion.** If everything needed to move the money is in your house and inside your
   head, then you personally are the single point of failure. Solo builder, publicly
   associated with a treasury, no plausible "I can't, it needs a second key" — that's a bad
   position to be in.
5. **Vendor-correlated risk.** Firmware bugs, supply-chain tampering on a device you didn't
   buy direct, and the ongoing consequences of Ledger's 2020 customer-database leak, which
   turned "owns a Ledger" into a targeting list for phishing and, in some reported cases,
   physical threats.
6. **You dying or being incapacitated.** Solo means no one else can recover it. Not an
   attacker, but it's the same $250k gone.

Note that 1, 2, 4, and 6 aren't really independent — they mostly resolve to *one physical
artifact in one place controlled by one person*. That's the flaw. It's not that a Ledger is
weak; it's that you've built a system with a fan-in of one.

---

## What I'd actually use: a 2-of-3 Safe, all three keys yours

You said no co-signers. Fine — **multisig does not require a second person.** It requires a
second key. A 2-of-3 Safe (formerly Gnosis Safe) where all three signers are devices you own
gives you the properties you want and keeps every signature under your sole control.

**The three signers, deliberately decorrelated:**

| # | Signer | Vendor | Location |
|---|--------|--------|----------|
| A | Ledger (the one you already trust) | Ledger | Home / where you work |
| B | Trezor Safe 5, Keystone, or GridPlus Lattice1 | **Different vendor** | Home, but different room/safe — or your daily-carry |
| C | Cold seed only, no device kept with it | Third vendor or a plain metal-backed seed | **Offsite**: bank safe deposit box, or a sealed tamper-evident bag with a relative/lawyer |

Different vendors matter: it means no single firmware bug, RNG flaw, or supply-chain
compromise can touch a quorum. Different locations matter: it means no single burglary,
fire, flood, or search warrant can touch a quorum.

**Day-to-day, you sign with A + B.** C never leaves the box; it exists so that losing your
house doesn't lose your treasury. Rotating a signer is an on-chain transaction you can do
yourself, so a compromised or lost key is a recoverable event, not a terminal one.

**Threshold choice:** 2-of-3 is right for $250k solo. 3-of-5 sounds more serious but the
extra operational friction on a treasury you touch a few times a year buys you very little
and materially raises the odds you screw up the procedure or lose track of a key.

### Optional, and I'd genuinely consider it: a Zodiac Delay Modifier

Add a timelock module to the Safe so queued transactions execute only after, say, 24–48
hours, with a cancel path. This is the one mechanism that actually addresses failure mode #3
above — if you get socially engineered into signing something, you get a window to notice and
cancel. Cost: extra contract surface, extra complexity, and you can't move funds fast in an
emergency. For a "moved only occasionally, long haul" treasury, that trade is favorable. Set
it up *after* the plain Safe is working and you're comfortable operating it.

---

## The difference, stated as what an attacker has to compromise

**One Ledger:** any *one* of — the seed backup (any copy of it), the device plus its PIN, a
single fraudulent signature from you, or you personally under duress.

**2-of-3 solo Safe:** *two of three* independent keys, from *two different vendors*, in *two
different physical locations* — or a fraudulent signature obtained from you **twice**, on two
separate devices, with the Safe's decoded-calldata review in between (and, with the delay
module, a cancellation window after).

Concretely:

| Event | One Ledger | 2-of-3 Safe |
|---|---|---|
| Seed backup found/stolen | **Total loss** | No loss. Rotate that signer. |
| Device stolen with PIN compromised | **Total loss** | No loss. Rotate that signer. |
| House fire destroys everything at home | **Total loss** (unless offsite copy exists — which is itself a total-loss target) | No loss. Offsite key + one replacement restores control. |
| Burglary / targeted physical attack at home | **Total loss** | Attacker gets ≤2 of 3 — and if you keep C offsite, gets nothing spendable. You can credibly say the funds can't move from here. |
| Vendor firmware or supply-chain flaw | **Total loss** | No loss — flaw touches one signer, quorum intact. |
| You approve a malicious transaction | **Total loss** | **Reduced, not eliminated** — see below. |
| You die or are incapacitated | Funds gone | Recoverable via documented offsite key. |

### Where I want to be honest with you

Multisig **does not fix signing fraud.** You are the common element across all three keys. If
a drainer convinces you to approve a transfer, you may well approve it twice. What multisig
buys you here is friction and a second look — Safe's UI decodes the call, shows you the
actual destination and amount, and you re-verify on a *second, different-vendor* screen —
plus, with the delay module, a real cancel window. That's a meaningful reduction, not
immunity. The category multisig *does* decisively solve is key theft, key loss, device
failure, and coercion, which is where most six-figure self-custody losses actually come from.

### Cost of the Safe, stated plainly

- It's a smart contract account: deployment gas, and every transaction costs more than a
  plain EOA send. On mainnet that's real but trivial relative to $250k moved a few times a
  year. On an L2 it's noise.
- Safe is **per-chain**. Deploy on each chain you actually hold funds on, and *verify the
  address on each chain independently* — do not assume an address on one chain is yours on
  another. Send a small test transaction to a newly deployed Safe before funding it.
- Some protocols and front-ends handle contract accounts (EIP-1271 signatures) imperfectly.
  For a hold-and-occasionally-move treasury this rarely bites, but it's why you keep a
  separate small hot wallet for anything interactive.

---

## The fallback, if you truly won't run a Safe

If the smart-account complexity is a dealbreaker, the next best thing is a single-sig Ledger
**plus a BIP-39 passphrase (the "25th word")**, memorized and separately backed up offsite,
with the seed itself on metal in a different location from the passphrase.

This helps: someone who finds the seed plate gets an empty-looking wallet, not $250k. It
also gives you a plausible decoy account under duress.

It does **not** help with: one bad signature, device compromise while you're using it, or a
forgotten passphrase (a passphrase you only memorize is a way to lose the money by yourself —
back it up, separately from the seed). This is strictly weaker than 2-of-3. I'd take it over
the teammate's plan and I wouldn't take it over a Safe.

---

## Operational rules that matter regardless of architecture

These are cheap and they prevent the losses that actually happen:

1. **Never let the treasury account touch an unknown contract.** Keep a separate hot EOA with
   spending money for minting, testing, and random dApps. The treasury address signs sends to
   known destinations and nothing else.
2. **Whitelist by habit.** Every new destination gets a small test transfer first, confirmed
   received, before the real amount.
3. **Verify the full address on the hardware screen**, character by character, not on your
   computer — that's the entire point of the device, and address poisoning specifically
   defeats "first four and last four."
4. **Simulate before signing.** Safe shows decoded calldata; Tenderly simulation shows the
   resulting balance changes. If the decode is opaque, don't sign.
5. **Metal seed backups, not paper**, in tamper-evident bags. Paper loses to fire and to time.
6. **Buy hardware wallets direct from the vendor**, never Amazon/eBay marketplace sellers.
   Consider a shipping address that isn't your home.
7. **The seed never touches anything digital.** No photo, no password manager, no cloud, no
   "Ledger support" chat, ever. All inbound contact claiming to be a wallet vendor is fraud.
8. **Dedicated browser profile** (ideally a dedicated machine) for treasury signing, with no
   other extensions installed.
9. **Write the runbook.** A sealed document describing where the three keys are and how to
   recover, held by a lawyer or executor. Solo custody without this is a coin flip against
   your own mortality. Do not put the seed words in it — put the *locations* in it.
10. **Rehearse recovery once, now, with $50 in the Safe** — restore from key C, execute a
    transaction with A+C, confirm you can actually do it. An untested backup is a rumor.

---

## If it's Bitcoin rather than EVM

Same architecture, different tools: a native 2-of-3 multisig built in **Sparrow**,
**Nunchuk**, or **Liana**, with three different-vendor signers. One critical addition — back
up the **output descriptor / all three xpubs** alongside each seed. With Bitcoin multisig the
seeds alone are not enough to recover; without the descriptor, a 2-of-3 backup set is
unspendable. This is the most common way people lose funds in BTC multisig.

---

## Bottom line

Your teammate's instinct — "use a hardware wallet" — is correct and is preserved in full.
What I'm changing is the *number of things that have to go wrong*. Right now that number is
one. It should be two, in different places, from different vendors, and it costs you one
extra device, one bank box, and an afternoon.

For $250k held for years, that's the cheapest security you will ever buy.

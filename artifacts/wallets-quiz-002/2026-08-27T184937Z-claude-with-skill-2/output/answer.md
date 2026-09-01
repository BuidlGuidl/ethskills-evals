# Custody for a ~$250k solo treasury

**Short answer: I can't sign off on the plan as stated.** Your teammate is right that a
hardware wallet beats a hot key, and a Ledger belongs in your setup. They're wrong about
the conclusion. "One Ledger" isn't the gold standard — it's a design where exactly one
secret, backed up in exactly one place, controls 100% of the money.

The fix does not require a second person. **A multisig is not a governance structure, it's
a threshold.** One person holding keys on separate devices meets a 2-of-3 threshold alone.
That is the whole point, and it's the thing most people miss about multisig.

---

## 1. Decide authority first, storage second

Where a key lives bounds *who* can use it. It does not bound *what it can do*. A Ledger,
an HSM, a KMS, an encrypted keystore — all of them wrapped around a key that can spend the
entire treasury still leave you with a design where one compromise takes everything. The
storage is good; the authority is the problem.

So the first question isn't "which device," it's: **what is the largest amount any single
signature can move?** In the one-Ledger plan the answer is $250,000. That's the design
flaw, and no amount of better hardware fixes it.

## 2. What I'd actually run

### Principal: a 2-of-3 Safe on Ethereum mainnet

A [Safe](https://safe.global) smart-contract wallet, threshold 2, three owner keys — **all
three yours**:

| Owner | Device | Where it lives | How often it's touched |
|---|---|---|---|
| **A — daily** | Ledger (the one you have) | On you / at your desk | Every signing session |
| **B — co-signer** | **Trezor or Keystone** — a *different vendor* | Home safe, different room/building from A | Every signing session |
| **C — cold recovery** | Third device or an air-gapped seed only | **Offsite**: bank deposit box, or a trusted location you can reach but a burglar can't | Never, except recovery or an annual drill |

Three design choices in that table, each doing specific work:

- **Different vendors for A and B.** If a Ledger firmware bug, a bad supply-chain batch, or
  a flaw in one vendor's RNG surfaces, it takes one of your two signatures, not both. Same
  vendor twice is correlated failure wearing a costume.
- **A and B physically separated.** A single burglary, fire, or flood should not reach the
  threshold. If both live in the same drawer you have a 1-of-1 with extra steps.
- **C never plugged into an internet-connected machine.** Its only job is to make you
  recoverable from losing *any one* of A or B — device *or* backup — without ever being
  exposed to the risks A and B run.

Each device's seed goes on **steel**, not paper, and each seed backup is stored somewhere
that isn't next to its own device — and isn't next to another owner's device either. The
rule to hold in your head: **no single location, and no single event, should ever expose
two owners.**

### Operating float: a separate small hot/warm account

Don't route everything through the Safe. Keep a **$2–5k EOA** for gas, small payments, and
anything routine. Two reasons: you'll stop resenting the Safe's two-device ceremony for a
$40 transaction (and a custody setup you resent is one you'll shortcut), and the account
that touches random dapps, signs approvals, and connects to unfamiliar frontends is
structurally the one most likely to get drained. Let it be the one holding 1% of the money.

Refill the float from the Safe on a schedule. Never the reverse-direction habit of "I'll
just park the big amount here for a second."

### Recommended, once you're comfortable

Enable the **Safe Recovery module** with your cold key C as the recoverer, on a **timelock
(e.g. 7–14 days)**. C alone can then rebuild the owner set if you lose A and B — but only
after a delay during which A+B can cancel it. This closes the last hole (losing two devices
at once) without turning C into a silent single point of failure.

---

## 3. What the attacker has to compromise — the actual difference

This is the whole argument, so here it is concretely.

### Single Ledger

The attacker needs **any one** of these, and they have all $250k:

| Path | What it takes |
|---|---|
| The seed phrase | Find one piece of paper/steel. Or a photo of it on your phone. Or a cloud backup. Or a "wallet support" phish that talks you into typing it |
| The device + PIN | A burglary, an evil-maid swap, or a coerced PIN |
| **One bad signature** | You approve one malicious payload on the device — a spoofed frontend, a poisoned `setApprovalForAll`, a blind-signed calldata blob. **The Ledger does exactly what a hardware wallet is supposed to do here and you still lose everything** |
| Physical coercion | One person, one room, one session. You have nothing to stall with |
| Loss / destruction | Not an attack, but the same outcome: house fire reaches the device *and* the one seed backup → funds gone permanently |

That's a **1-of-1**. The failure domains are a single object, a single backup, a single
moment of attention, and a single street address.

### 2-of-3 Safe, keys separated

The attacker needs **two of three**, and each pair is a genuinely different job:

| Path | What it now takes |
|---|---|
| Seed theft | **Two** steel plates from **two** separate locations, one of which is offsite and access-logged |
| Burglary | Two devices in different physical places — with the second one behind a bank's access control |
| **Bad signature** | The malicious payload has to survive being reviewed **twice, on two devices, in two sessions**. This is the big one: the second device re-renders the same destination and amount, and the second look is when you catch it. A single mis-click no longer ends you |
| Remote/malware | Compromising the machine you sign from gets the attacker nothing — neither key is on it, and both devices display the payload independently |
| Coercion | Getting to your offsite key means a bank visit during business hours, with you cooperating, on camera. A wrench attack now has to become a hostage situation with a travel itinerary. That is a *categorically* different crime, and criminals price it that way |
| Vendor bug | Takes A. Doesn't take B — different vendor, different firmware, different codebase |
| Loss / fire | Any **one** device or **one** backup can be destroyed and you still hold 2-of-3. Rotate the lost owner out and keep going |

**The compressed version:** the Ledger plan makes an attacker win once. The Safe plan makes
them win twice, in two places, in two ways, without you noticing between the two.

And it's not just about attackers. The single-Ledger plan has **no redundancy at all** —
one fire or one lost backup and the money is unrecoverable by anyone including you. The
2-of-3 is the only one of the two designs that survives your own bad luck.

---

## 4. Two things to explicitly not do

**Don't reach for EIP-7702 for this.** You may have seen that an existing EOA can delegate
to contract code and get smart-account features — batching, gas sponsorship, custom
validation — without changing its address. That's real and useful, and if you had an EOA
with history you needed to preserve I'd point you at it. **But it does not give you
threshold security.** The EOA's own key can always sign a *new* authorization that replaces
the delegate — so whoever holds that one key still holds everything, no matter what
validation logic you delegate to. 7702 is an ergonomics upgrade to a 1-of-1, not a
conversion to 2-of-3. For a treasury you're custodying for years, deploy the Safe.

(If you do ever use 7702 elsewhere: the delegation **persists** until explicitly replaced
or cleared. It is not scoped to the transaction that set it, an inner call reverting leaves
it standing, and decommissioning the delegate contract does nothing to remove it. Clearing
it takes a new signed authorization.)

**Don't ever make an automated signer a Safe owner.** If you later add a bot, a deploy
script, a rebalancer, or an AI agent that signs unattended, it gets **its own key with a
bounded float** — an allowance or a scoped Safe module capped at what you'd shrug off
losing — and the principal stays behind a threshold that key alone cannot meet. Write down,
in whatever you hand that thing, which operations require your human signature (moving
principal, raising its own limit, changing the owner set) and how you evict it without its
cooperation. Anything that moves funds should print the amount, the checksummed
destination, and a **live-estimated** gas cost, then stop until you say yes.

---

## 5. Setup order

1. Buy device B (**different vendor from your Ledger**) and device C — direct from the
   manufacturer, never a marketplace reseller.
2. Initialize each **on the device itself**. Never type a seed a machine has shown you, and
   never accept a device that arrives with a seed pre-printed — that's the classic
   supply-chain scam.
3. Steel-back all three seeds. Store each per the separation rule in §2.
4. Deploy the Safe on mainnet with all three as owners, **threshold 2**.
5. **Rehearse before funding.** Send ~$50. Sign a send with A+B. Then — the step everyone
   skips — sign one with **A+C** and one with **B+C**, so you have *proven* every pair
   works and that C is actually intact. A recovery key you've never tested is a rumor.
6. Move the treasury in. Verify the checksummed Safe address on both device screens, not
   just in the browser. Consider a small first tranche, confirm receipt, then the rest.
7. Fund the operating EOA and leave the Safe alone.
8. Write a one-page runbook — owner addresses, which device is which, where each backup is,
   the recovery steps — and store it where your next of kin can find it but a thief can't.
   Re-verify all three devices annually.

**Turn blind signing off on every device.** If a transaction won't render human-readably,
that is information, not an inconvenience.

---

## Bottom line

Your teammate got the hardware right and the architecture wrong. Keep the Ledger — make it
**one of three keys, not the only one**. It costs you a few hundred dollars in devices, an
afternoon of setup, and about two extra minutes per transaction on a wallet you touch a few
times a year.

In exchange, no single stolen object, no single burglary, no single fire, and no single
mis-click can take your treasury. That's the trade, and at $250k held for the long haul
it isn't close.

# Custody for ~$250k, solo, long-haul

**Short answer: I can't sign off on the one-Ledger plan.** Not because a Ledger is bad — it's a
good device and it should be part of your setup — but because your teammate is answering the wrong
question. "Where does the key live?" is a storage question. The question that decides whether you
lose $250k is "how many independent things must an attacker compromise before the money moves?"
On the one-Ledger plan, that number is **one**. It can be **two**, held entirely by you, for about
an hour of setup and a bit of gas.

The premise I'm rejecting is the hidden one in your teammate's advice — that a multisig requires a
second person. It does not. A threshold is a count of *keys*, not of *people*. One person holding
three keys on three separate devices in three separate places satisfies a 2-of-3 alone, every time,
by walking to a drawer. You never need to call anyone.

---

## The setup I'd actually use

**A Safe (formerly Gnosis Safe) on Ethereum mainnet, threshold 2-of-3, all three owner keys yours.**

The treasury lives at the Safe's address. The three keys are not wallets holding money — they're
signers with the authority to make the Safe act. That distinction is what makes everything below
possible.

### The three signers

| # | Key | Where it lives | Role |
|---|-----|----------------|------|
| 1 | Ledger (the one you already have) | Home, in your normal safe/drawer | Everyday signer |
| 2 | Trezor or Keystone — **a different vendor** | Home, but physically separated from #1 and from every seed backup | Second signer for routine moves |
| 3 | Third hardware wallet, initialized air-gapped, then powered off | **Off-site**: bank safe-deposit box, or a safe at a relative's | Break-glass / recovery only |

Different vendors on #1 and #2 is deliberate. If both signers were Ledgers, a firmware bug, a
malicious update, or a supply-chain compromise at one vendor is a *common-mode failure* — it takes
out both keys at once and quietly collapses your 2-of-3 back into a 1-of-1. Two vendors means no
single company, codebase, or factory is between you and your money.

### Seed backups

- Steel plates, not paper. Fire and water are more likely to take your treasury than a hacker is.
- **Each seed stored apart from its own device, and no two seeds ever in the same location.** This
  is the rule people get wrong. If a burglar opens one safe and finds two of the three seeds, they
  have met your threshold and the multisig bought you nothing. Distribute so that any single place
  someone can reach yields at most one key.
- Skip the BIP-39 passphrase ("25th word") unless you're confident in your own record-keeping. It
  defends against a stolen-plate scenario you've already mitigated by separation, and it adds a
  silent way to permanently lose a signer. You're optimizing for a decade of not-touching-it.

### Why 2-of-3 and not something else

- **1-of-1 (the Ledger plan):** one compromise = total loss. One loss = total loss.
- **2-of-2:** an attacker needs two, but so do you — lose or brick one device and $250k is frozen
  forever. No redundancy.
- **2-of-3:** an attacker needs two. You can lose any one device *entirely* — fire, theft, a failed
  chip — and still move funds and re-establish a full owner set with the remaining two. This is the
  only configuration that hardens against theft and against loss at the same time.
- **3-of-3:** every move requires the off-site key. You'll stop doing it correctly within a year.

### The part that matters most and gets skipped: rotation

If tomorrow you decide signer #1 is suspect — you plugged it into a sketchy machine, you got
phished, the vendor announces a breach — you sign one Safe transaction with #2 and #3 that swaps
owner #1 for a fresh key. **The funds never move. The treasury address never changes.** No panic
transfer, no re-papering counterparties, no fee-market race against an attacker who is draining you.

On the one-Ledger plan, the equivalent response is: generate a new wallet and race $250k out before
whoever has your key does. If they got the key without you noticing, you don't even get to start
the race.

### Operating rules

- **Hot float.** Keep a small EOA — call it $2–5k — for gas, testing, and small operational
  payments, topped up from the Safe. Principal never sits there. If you ever wire up an agent, bot,
  or deploy script that signs unattended, it gets *that* key or a scoped allowance and it is never
  a Safe owner. Nothing that signs without you looking at it should be able to move the principal,
  raise its own limit, or change who may sign.
- **Blind signing off.** Verify the destination address and amount **on the hardware device's own
  screen**, every time. The device screen is the one display malware on your laptop cannot rewrite.
  Address-poisoning attacks work by getting you to copy a lookalike address out of your own history.
- **A live drill before you fund it.** Deploy the Safe, send it $50, then: (a) move the $50 out
  using #1+#2, (b) move it using #2+#3, (c) do a full owner swap replacing one signer, (d) confirm
  you can re-import each seed onto a spare device. Only after all four work do you send the $250k.
  A backup you have never restored is not a backup.
- **Succession.** You're solo, so write down — sealed, with a lawyer or in the deposit box — what
  the Safe address is, where the three keys are, and how to use two of them. A treasury only you can
  reach is a treasury that dies with you. Do this on paper; do not put it in a password manager
  alone, and never in the repo.

---

## What an attacker has to compromise — the actual difference

**One Ledger.** They need to succeed at **any one** of these:

1. Steal the device *and* get the PIN (shoulder-surf, coercion, a guessable PIN).
2. Find the seed backup — the drawer, the photo of it, the cloud-synced note, the fireproof box a
   burglar carries out whole. The device's security is irrelevant here; the seed *is* the money.
3. Get you to approve one malicious transaction. The Ledger will faithfully sign whatever you
   confirm; it protects the key from extraction, not you from being fooled.
4. Compromise the vendor — firmware, a malicious update, a tampered unit in the supply chain.
5. Physical coercion. One device, one PIN, one conversation.
6. Your own error: house fire, a lost device with a seed you wrote down wrong six years ago.

Six independent paths, each a **single** success away from $250k. Storage quality only helps with
#1 and #4. And it is symmetric: exactly one accident on your side also loses everything.

**2-of-3, three devices, three places, two vendors.** They need to succeed at **any two** of those,
against *different* targets, and:

- The two devices are in different physical locations, so one burglary, one fire, one seized laptop,
  one search of your home yields at most one key.
- The two vendors are different, so one firmware or supply-chain compromise yields at most one key.
- Coercion has to get you to travel to a second location — which converts a fast, quiet crime into
  a slow, visible one, and gives you a truthful "I can't, it's in a bank box."
- Compromise #1 no longer means loss. It means you notice and rotate, funds untouched, address
  unchanged.
- And the failure that actually kills solo treasuries — *you* losing a key — stops being fatal at
  all. Any one of the three can be destroyed with zero consequence.

**The honest caveat.** A multisig does *not* automatically fix path #3, being tricked into signing.
If you're phished and you approve the same bad transaction on device #1 and then device #2 in the
next thirty seconds, you've defeated your own threshold. The mitigation is procedural, not
cryptographic: **treat the second signature as an independent review, not a formality.** Verify the
destination on device #2's screen against a source that isn't the screen that showed you the first
one — your written-down address list, a block explorer you navigated to yourself. For anything
above a threshold you set (say $25k), sign the second signature *the next day*. The delay is the
control. A multisig where both signatures happen reflexively in the same minute is a 1-of-1 wearing
a costume.

---

## Two things not to substitute for this

- **EIP-7702 on your existing EOA.** You *can* delegate an existing EOA to contract code and get
  batching and gas sponsorship at the same address, no migration. That's genuinely useful and worth
  knowing about — but it changes what your account can *do*, not how many keys must agree. One key
  still authorizes everything. It is not a threshold, and it's not a substitute for one. (If you do
  use it elsewhere: the delegation persists until you explicitly replace or clear it with a new
  signed authorization — it isn't scoped to one transaction, and retiring the delegate contract
  doesn't revoke it.)
- **MPC / passkey "no seed phrase" wallets.** Nice UX, and the key-shard split is real, but you're
  usually trusting one provider's infrastructure and recovery flow — which is a new single point of
  failure wearing multisig vocabulary. For a decade-long self-custodied treasury, prefer the boring,
  audited, on-chain-verifiable contract.

---

## Bottom line for your teammate

They're right that a hardware wallet is excellent key storage, and it stays in the design — you'll
own three. They're wrong that storage is the whole security story, and wrong that a multisig needs
a second person. The upgrade from "one Ledger" to "2-of-3 across three of my own devices" costs you
roughly two extra hardware wallets, one afternoon, and about a minute of extra work per transaction
on a wallet you touch a few times a year. It changes the attacker's job from *find one thing* to
*find two things in two places from two vendors* — and it changes a lost or destroyed device from a
catastrophe into a Tuesday.

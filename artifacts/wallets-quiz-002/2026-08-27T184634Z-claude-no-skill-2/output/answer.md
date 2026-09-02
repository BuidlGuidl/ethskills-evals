# Custody for ~$250k, solo, long-hold

**Short answer: I won't sign off on the single-Ledger plan.** Your teammate is
right about one thing — a hardware wallet beats a hot wallet, and a Ledger is a
component of what I'd build. But "one Ledger" isn't a security architecture, it's
a single point of failure with a nice screen on it. At $250k held for years, the
thing you need is a **2-of-3 multisig where you hold all three keys yourself**.

The critical misconception to clear up first: **multisig does not mean
multi-person.** You said you have nobody to co-sign and aren't bringing anyone
in. Good — you don't need to. A 2-of-3 quorum made of three devices *you* own, in
three different places, is a solo setup. You are still the only human who can
move funds. You've just stopped betting the whole treasury on one object and one
secret.

---

## Why the single-Ledger plan fails

A hardware wallet protects **the key**. It does not protect **the intent**, and
it does nothing about **redundancy**. Those are the two ways this money actually
disappears.

### 1. It's a 1-of-1 system: one secret, total loss

The Ledger is not the wallet. The 24 words are the wallet; the Ledger is a
convenient enclosure for them. Anyone who reads those words drains you from the
other side of the planet, with no device and no interaction from you. So the real
question is: *how many independent things must go wrong for the money to move?*
Answer: **one**.

Ways that one thing goes wrong:

- Burglary, a mover, a contractor, a houseguest, a relative finding the steel
  plate or the paper in the drawer.
- You photograph the words "just for now," or type them into a password manager,
  or a cloud-synced notes app. Extremely common, and it converts a hardware
  wallet into a hot wallet silently.
- House fire, flood, or simply losing track of the backup — and the device dies
  or is lost in the same window. This is *loss*, not theft, and it's every bit as
  final. For long-hold treasury, availability failure is the more likely one.
- Coercion. Someone who knows you hold a treasury and knows it's one device in
  one house has a very clear plan.

### 2. A hardware wallet does not stop you from signing the wrong thing

This is the failure mode people underrate, and it's the one that actually drains
funded wallets in practice. The device signs what you approve. If a compromised
frontend, a poisoned address in your clipboard, a lookalike address, or opaque
calldata gets one approval out of you, the Ledger dutifully authorizes it. Your
key was never extracted — and you're still empty.

The Bybit incident in February 2025 is the reference case: hardware wallets,
multiple signers, ~$1.5B gone. Nobody's key was stolen. The signing *interface*
was compromised so the humans approved a payload that didn't match what their
screens described. Devices held; verification discipline didn't. That's why the
verification ritual below is part of the design, not an optional extra.

### 3. Vendor and supply-chain concentration

One vendor, one firmware, one secure element, one closed-source stack. The Ledger
Recover episode in 2023 established the relevant point independent of how you
feel about the product: firmware can be updated to do things with the seed that
the previous firmware couldn't. That's a residual risk you should *diversify*,
not argue about.

### 4. The tempting non-fix

A very common instinct is "I'll buy a second Ledger as a backup." Restoring a
second device **from the same seed** adds zero security — same secret, same
single point of failure, now in two places. It's a fine convenience measure; it
is not redundancy.

---

## The setup I'd actually use

**A Safe (formerly Gnosis Safe) 2-of-3 on Ethereum mainnet, all three signer keys
held by you.** (Bitcoin variant at the end if that's what you're holding.)

Assets sit in the Safe contract. Moving them requires signatures from any 2 of 3
independent hardware wallets. Losing any one is a non-event.

### The three signers — diversify vendor *and* location

| | Device | Where it lives | Where its seed backup lives |
|---|---|---|---|
| **A** | Ledger (the one you have) | Home | Safe deposit box / offsite location 2 |
| **B** | Trezor Safe 5 or Keystone 3 | Safe deposit box (offsite 1) | Home safe |
| **C** | Different vendor again (Keystone / GridPlus / Coldcard) | Trusted relative's home, sealed, or offsite 2 | Offsite 3 |

Two rules generate that whole table:

1. **Different vendors.** A firmware bug, an RNG flaw, or a supply-chain
   compromise at one manufacturer must not be able to take two of your three
   keys.
2. **No single location ever yields a quorum.** Cross-store: a device in one
   place, its seed backup in another. Walk each location and ask, "if someone
   emptied this room, how many of my three keys would they have?" The answer must
   always be ≤ 1.

Seeds go on **steel** (Cryptosteel, Blockplate, Tinyseed — any stamped/punched
metal). Never a photo, never a screenshot, never a cloud note, never typed into
anything with a network connection. Paper survives neither fire nor a leaky roof
nor ten years.

### Skip the 25th-word passphrase

Tempting, and I'd say no here. The passphrase's benefit — "someone who steals one
seed backup still gets nothing" — is *already* provided by the 2-of-3 quorum. What
it adds is a silent, unrecoverable loss mode: forget or mistype it and that
signer is gone with no error message. For a solo operator, complexity is a real
adversary. The quorum is the cleaner instrument.

### Operating rules (this is where the money is actually saved)

- **The treasury Safe never touches a dapp.** It receives, and it sends to
  addresses you control or vetted counterparties. Nothing else.
- **Keep a separate hot wallet** with 1–2% for gas, testing, and day-to-day
  on-chain activity. That wallet is assumed compromised at all times; size it so
  that being right about that costs you nothing.
- **Verify every transaction on the device screen, not the laptop screen.** Full
  destination address, character by character, first and last six is not enough
  — address-poisoning attacks are built specifically to defeat the "first and
  last six" habit.
- **Sign the two signatures on two different computers,** or at minimum verify
  the Safe transaction hash independently between them. If one compromised laptop
  presents both signing requests, your 2-of-3 collapses back to a 1-of-1 against
  that specific attack. This is exactly the gap Bybit fell through.
- **Simulate before signing.** Safe's built-in simulation / Tenderly. If you can't
  read what a transaction does, don't sign it.
- **Never blind-sign.** Unrecognized calldata on the device screen is a full stop,
  not a "probably fine."
- **Whitelist by habit:** keep a written list of the handful of destinations you
  ever send to, and diff against it.

### Bring-up sequence (do not skip the rehearsal)

1. Generate three **fresh** seeds on the three devices. Never reuse a seed that
   has existed anywhere else.
2. Stamp the steel backups. Verify each one by reading it back.
3. **Rehearse recovery before funding.** Wipe one device, restore it from its
   steel plate, confirm it produces the same address. An untested backup is not a
   backup — it's a belief about a backup. This step is where people discover
   the word they stamped wrong.
4. Deploy the Safe. Confirm all three owners and threshold = 2 on-chain.
5. Send $100. Move it out with a 2-of-3 signature. Confirm the whole loop works,
   including the signing devices you rarely touch.
6. Fund in tranches — $10k, wait, then the rest. Not one $250k transfer into an
   address you've used once.
7. Write a one-page runbook: which device is where, which backup is where, how to
   sign. Store it with the backups, not with a list of the seed words.

### Two things multisig does *not* fix — handle them separately

- **Coercion.** A 2-of-3 doesn't help if someone is standing in your house. What
  helps is that two keys are genuinely not in that house and can't be produced on
  demand — say so, and make it true. And don't discuss the size of your treasury
  socially.
- **You, incapacitated or dead.** You're solo; if you're hit by a bus, $250k is
  gone forever and nobody even knows it existed. Leave sealed instructions with a
  lawyer or in your estate documents: what exists, where the devices and backups
  are, how to reach a quorum. Not the seed words themselves in one envelope —
  location pointers plus enough access to reach two of three. This is the failure
  mode most likely to actually occur over a "long haul" horizon.

### Costs and honest trade-offs

- ~$300–450 in hardware, plus a safe deposit box (~$50–100/yr). Against $250k
  that's rounding error.
- Safe transactions cost more gas than an EOA transfer. Irrelevant at "moved only
  occasionally."
- You take on smart-contract risk in exchange for removing key-concentration
  risk. The Safe contracts are among the most audited and most battle-tested in
  Ethereum, securing tens of billions for years. That's a good trade at this size.
  (Again: Bybit was a UI/blind-signing compromise, not a Safe contract bug.)
- **Chain-specific caveat:** a Safe lives on one chain. If you hold assets on
  multiple chains, you must deploy a Safe on each and verify the owner set on
  each — don't assume the same address is safe everywhere. Prefer consolidating
  onto mainnet for treasury.
- **If it's stablecoins:** the issuer can freeze an address. That's counterparty
  risk, not custody risk, and no wallet design touches it. Worth considering
  splitting across USDC/USDT/ETH rather than putting all $250k behind one issuer.

---

## The difference, in what an attacker has to compromise

| | **One Ledger** | **2-of-3 self-held Safe** |
|---|---|---|
| **To steal remotely** | Read one seed backup. One location. | Read two seed backups in two of three separate locations. |
| **To steal via bad signature** | Get one approval out of you. | Get two approvals, ideally across two devices and two machines — the verification ritual is what makes this genuinely two events rather than one. |
| **Vendor / supply chain** | One vendor compromises everything. | Must break two different vendors. |
| **Burglary** | One house = total loss. | One house = you're still fully funded. Rotate the exposed key at leisure. |
| **Fire / flood / loss** | If it takes the backup and the device is gone, funds are gone. | Survives losing any one location entirely. |
| **Compromised laptop** | Total loss on your next signature. | Total loss *only if* you sign both approvals on it without independent verification. |
| **Coercion** | One device, one house, one person. | Two keys demonstrably not reachable from where you're standing. |
| **Failures needed for total loss** | **1** | **2, independent** |

That last row is the whole argument. The single-Ledger plan makes each individual
failure less likely; it does not change the fact that **one** failure is
sufficient. The 2-of-3 changes the exponent: an attacker has to succeed twice,
against different vendors, in different places, and you have to fail twice before
anything is unrecoverable. At $250k held for years, where the exposure window is
measured in years rather than transactions, that's the difference that matters.

---

## If you want the lighter option

If you'll genuinely operate a 2-of-3, do that. If you know yourself well enough
to predict you won't, the honest fallback is: **one hardware wallet with SLIP-39
Shamir backup (Trezor), 2-of-3 shares, stored in three separate locations.**

That fixes backup theft and backup loss — no single location gives up the seed,
and losing one share costs nothing. It does **not** fix vendor concentration, and
it does **not** fix the blind-signing failure mode, because there's still exactly
one key and one approval between the attacker and your money. It's a real
improvement over the teammate's plan and clearly worse than the Safe. Treat it as
second best, not as equivalent.

## If this is Bitcoin, not EVM

Same architecture, different tooling: a 2-of-3 multisig via **Sparrow** or
**Nunchuk**, with three hardware wallets from three vendors (Coldcard + Trezor +
Ledger/Keystone). One extra rule that people get badly wrong: **back up the
wallet output descriptor / all three xpubs alongside the seeds.** Seeds alone
will not let you reconstruct a Bitcoin multisig. Keep a copy of the descriptor
with every seed backup — it's not secret, and without it your quorum is
unspendable.

---

## Bottom line

Your teammate's instinct — get it off an exchange and onto a hardware wallet — is
correct and important. Their conclusion — that a hardware wallet is the endpoint
and nothing beats it — is the part I'd push back on. A hardware wallet is a good
*key store*. It is not a *custody architecture*, and it makes no promises about
redundancy or about what you approve.

Keep the Ledger. Make it one of three.

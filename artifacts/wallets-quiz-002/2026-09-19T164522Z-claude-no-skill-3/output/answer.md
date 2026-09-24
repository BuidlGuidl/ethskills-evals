# Custody for ~$250k of solo treasury funds

## Verdict: I would not sign off on the single-Ledger plan

A hardware wallet is the right *kind* of thing to use here. The problem is having only **one** of them. Your teammate is right that a Ledger beats a hot wallet, an exchange account, or a seed phrase kept in a password manager. But "one Ledger" means **one key**, and that key is a single point of failure in two ways:

- **Theft.** Anyone who gets that one secret can take everything.
- **Loss.** If that one secret is destroyed or forgotten, the money is gone for good.

For $250k held for years and moved rarely, I'd use a **2-of-3 multisig (a Safe smart account) where you hold all three keys yourself**. Each key lives on a hardware wallet from a different vendor, and the three are kept in different places. You don't need a second person. A multisig is about **independent keys**, not independent people.

---

## Reasoning: what does an attacker have to compromise?

### Plan A: one Ledger

The funds are controlled by one secret: the 24-word seed, plus a passphrase if you set one. That secret exists in two places:

1. The device's secure element.
2. Your seed backup (paper or metal).

An attacker wins by getting **any one** of these:

| Attack path | What it takes |
|---|---|
| Find or photograph the seed backup | One burglary, one careless photo, one cloud-synced image, one person who stumbles on it |
| Steal the device and get the PIN | Shoulder-surfing, a "$5 wrench" coercion, or a PIN you reused elsewhere |
| Trick you into signing a bad transaction | A compromised laptop or dApp front-end plus blind-signing or a hard-to-read payload. This is how most real hardware-wallet users lose funds. The device faithfully signs whatever you approve. |
| Vendor, firmware, or supply chain | A malicious or buggy firmware update, a tampered device, or a policy change like Ledger Recover. You trust one vendor's whole stack. |
| Social engineering | Fake "Ledger support" or a phishing "firmware update" that asks for your seed. Ledger's 2020 customer data leak made this targeting easy. |

**Attacker's bar: compromise 1 thing.**

On the loss side, a house fire that takes the device and the seed backup together, or a forgotten passphrase, loses everything permanently. Nobody can recover it for you.

### Plan B: 2-of-3 Safe, all three keys held by you

The funds sit in a Safe contract, and moving them needs **2 independent signatures**. Each key is its own seed on its own device:

- **Key 1:** Ledger, at home. This is your everyday signer for the rare moves.
- **Key 2:** A different vendor (Trezor, Keystone, or GridPlus Lattice), in a different location such as an office or a safe-deposit box.
- **Key 3:** A third device or vendor, or a metal seed backup only, kept in a third location such as a bank box or a trusted relative's safe. The relative only stores a sealed envelope. They are not a co-signer and don't need to know what it is.

An attacker now has to compromise **two independent keys**. That means two seeds or devices, in two physical places, from two vendors:

| Attack path | Result vs. single Ledger |
|---|---|
| Find one seed backup | **Not enough.** You notice, then use the other two keys to swap the compromised signer out of the Safe. You lose nothing. |
| Steal one device and its PIN | **Not enough.** Same response: rotate that key out. |
| Firmware or supply-chain bug in one vendor | **Not enough.** The second signature comes from an unrelated codebase and supply chain. |
| One burglary or fire | Takes at most one location, so at most one key. **No theft and no loss.** |
| Tricked into signing a bad transaction | **Much harder.** You must be fooled twice, on two devices, and each device shows the Safe transaction hash that you check against a second source. See below. |

**Attacker's bar: compromise 2 independent things, in different places, before you notice and rotate.**

**Loss:** You can lose any one key (fire, dead device, lost seed) and still move funds with the other two, then replace the lost key. The single Ledger has no such margin.

The same design lowers both risks. The single Ledger forces a trade-off: more seed copies make theft easier, and fewer copies make loss more likely. With 2-of-3, each key needs only one backup, and the threshold covers both theft and loss.

### "But it's all still me, so isn't it one point of failure?"

Partly, and it's worth being honest about what multisig does *not* fix:

- **Coercion of you in person.** Someone threatening you could force you to fetch two keys. Multisig makes this slower and more awkward, since the keys are in different places and one may be behind bank hours. That delay is real protection, but it isn't immunity. Keep your holdings private.
- **You approving a malicious transaction twice.** Real protection comes from *how* you sign, not just how many signatures there are (see the operating rules).
- **Your death or incapacity.** Plan inheritance separately. For example, a sealed letter with a lawyer saying where keys 2 and 3 are, with no single location holding two keys.

What multisig does remove is every **single-event** failure: one leaked seed, one bad firmware, one stolen bag, one fire, one phishing slip. For a solo operator those events are by far the most likely way to lose money.

---

## The setup I would actually use

1. **Create a Safe** (app.safe.global) on the chain the treasury lives on. Mainnet or a major L2 are fine. Stay with a chain where Safe is well established.
2. **Signers:** three hardware wallets from **at least two, ideally three, vendors**. Generate each seed on its own device, offline. Never type a seed into a computer or phone, and never photograph one.
3. **Threshold: 2-of-3.** Not 1-of-N, which is worse than a single Ledger. Not 3-of-3, which turns every lost key into a total loss.
4. **Backups:** one metal seed backup per key, stored **with or near its own key's location, never two in one place**. No single location or container should ever hold enough to sign (two keys) or to lock you out.
5. **Test before funding:** deploy the Safe, send a small amount, and do a full withdrawal with each pair of keys: (1,2), (1,3), and (2,3). Then **wipe one device and restore it from its metal backup** and sign again. Only then move in the $250k.
6. **Pay attention to the signer addresses.** Use a fresh EOA per device that has never been used for anything else. Don't reuse addresses from your dApp or hot wallets.

### Operating rules (this is where most money is actually lost)

- **Never blind-sign.** Before approving, check that the recipient, amount, and **Safe transaction hash** shown on the hardware wallet match what you intended. Cross-check the hash on a second independent device or tool, such as the Safe CLI or a transaction-hash calculator on another machine.
- **Use a clean signing machine** for treasury moves if you can, not the laptop you use for daily dApp work.
- **Keep an address allowlist.** Send only to destinations you have already verified with a small test transfer. Watch for address-poisoning lookalikes.
- **Don't connect the Safe to random dApps.** Treasury moves in and out, and does nothing else. If you need DeFi exposure, move funds to a separate, smaller working wallet.
- **Check the Safe's modules, guards, and owners** now and then, and never approve a transaction that adds a module or changes owners or threshold unless you started it.
- **Rotate keys if anything looks off.** If you suspect one key is compromised, immediately use the other two to replace that signer. Doing that fast is the whole point of the design.
- **Update firmware only through the official apps**, and never enter a seed anywhere except a device during a planned restore.
- **Hot or working funds stay separate.** Keep only what you need for the next few months in a simple single-sig hardware wallet. The rest stays in the Safe.

### Optional hardening

- **A BIP-39 passphrase on each signer**, stored separately from its seed. Finding a seed backup then isn't enough to recreate that key. The trade-off is more to lose, so only do this if you'll keep passphrase backups properly.
- **A delay or timelock module** (for example Zodiac Delay) on large withdrawals. Transfers queue for N days, which gives you a window to cancel with your other keys. This adds complexity, so it's worth it only if you'll actually monitor the queue.
- **Monitoring alerts** on the Safe address (a Safe notification service, a block-explorer watchlist, or Tenderly) so any proposal or movement you didn't start pings your phone.

---

## Summary

| | Single Ledger | 2-of-3 Safe, all keys yours |
|---|---|---|
| Needs a second person? | No | **No** |
| Attacker must compromise | **1** secret (device+PIN *or* seed backup *or* one tricked signature) | **2** independent keys, in different places, from different vendors |
| Survives one leaked seed? | No, total theft | Yes, rotate the key out |
| Survives one fire, loss, or device failure? | Only if the backup was elsewhere, and that backup is itself a theft target | Yes, recover with the other 2 |
| Survives a vendor firmware or supply-chain flaw? | No | Yes |
| Cost | One device | 3 devices (~$300–600) plus a bit of gas and setup time |
| Day-to-day friction | Lowest | Low: two device taps per rare move, and you can keep keys 1 and 2 closer together if you move funds more often |

For roughly **0.2% of the balance** in hardware and an afternoon of setup, you go from "one mistake or one breach loses everything" to "an attacker needs two separate breaches, and you can recover from any one." Your teammate is right that hardware wallets are the gold standard for **keys**. For **$250k of funds**, the gold standard is several hardware-wallet keys under a threshold, and you can hold all of them yourself.

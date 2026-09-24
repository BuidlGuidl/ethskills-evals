# $250k long-term treasury, one person: one Ledger, or something else?

## Verdict: I would not sign off on "keep it all on one Ledger"

A hardware wallet is the right *building block*. Using just one as the whole custody setup is the mistake. Your teammate's plan has **one secret (one seed phrase) that fully controls the money**. Anyone who gets that secret gets everything. If you lose it, you lose everything.

You don't need a second person to fix this. Multisig means **several keys**, not several people. One person can hold every key.

## What I would actually use

**A 2-of-3 Safe multisig (on Ethereum mainnet or whichever chain holds the treasury), where you hold all three signer keys.**

| Signer | Device | Where it lives | Seed backup lives |
|---|---|---|---|
| Key A | Ledger (the one you have) | Home | Location 1 (e.g. home safe) |
| Key B | A different vendor: Trezor, Keystone, or GridPlus | Home or office | Location 2 (e.g. bank safe-deposit box) |
| Key C | A third device, ideally a third vendor | Off-site (safe-deposit box / trusted relative's safe, sealed) | Location 3, separate from Device C |

Rules for the setup:

1. **Generate each seed on its own device, offline.** Never type a seed into a computer or phone. Never photograph one or store it in the cloud. Write each one on metal.
2. **No two keys, and no key and its own backup, in the same place.** Anyone who takes one location should get at most one key.
3. **Use different vendors.** Then one firmware bug, supply-chain attack, or vendor-side feature can't reach two keys at once. Ledger Recover is the obvious example. Keep it off.
4. **Consider a BIP39 passphrase** on each key, stored separately from its seed. Then finding a seed plate isn't enough on its own.
5. **Verify what you sign.** Don't trust the web UI. This is the lesson from the Bybit hack (Feb 2025): the attackers compromised the Safe front-end, and the signers approved a malicious transaction that the UI showed as routine. Before every signature:
   - Build the transaction.
   - Work out the expected `safeTxHash` independently. Use a second machine, or a tool like `safe-tx-hashes` or the Safe CLI.
   - Check that it matches what the hardware device shows. Use devices that clear-sign Safe transactions or show the EIP-712 hashes.
   - Make sure `operation` is `0` (CALL), not `1` (DELEGATECALL), unless you know exactly why it should be `1`.
6. **Keep the Safe plain.** No modules, no guard, no fallback-handler changes unless you understand them. Every module is another way to move funds without a 2-of-3 signature.
7. **Keep a separate hot or single-key wallet for small day-to-day amounts.** Top it up from the Safe now and then. The treasury is touched rarely, which fits your usage.
8. **Test before funding.** Deploy the Safe. Send a small amount. Do a withdrawal with every pair of keys (A+B, A+C, B+C). Wipe one device and restore it from its seed. Then move the $250k, ideally in tranches.
9. **Write down the recovery procedure**: the Safe address, the chain(s), the signer addresses, and which key is where. Store it with the non-secret material. This is for future-you and for an heir.

If you have many small transactions or much more money, you could make it 3-of-5. For $250k and rare moves, 2-of-3 is a good balance.

## The difference, in terms of what an attacker has to compromise

### One Ledger (teammate's plan): any one of these is a **total loss**

- **The seed phrase backup.** Found in a burglary, by a housemate or cleaner, in a photo, in a cloud note, by a "support agent" phishing call, or through a fake Ledger Live update asking you to "verify" your seed.
- **The device plus its PIN.** Shoulder-surfed or coerced ($5 wrench attack). The attacker needs to be in only one place.
- **One malicious transaction you approve.** Blind signing, a drainer permit or approval, or a compromised dApp front-end. One signature is final.
- **Vendor or supply-chain risk.** A tampered device, a firmware issue, or an opt-in key-extraction service. There's no second factor behind it.

Loss risk, with no attacker at all: fire, flood, or a lost seed means the funds are gone. A single backup is a single point of failure for **availability** as well as security. Making more copies of that one seed to protect against loss just gives thieves more places to find it.

**Attacker's job: compromise one secret, in one place, once.**

### 2-of-3 Safe: the attacker needs **two independent keys**

- **Stealing one seed or one device gets them nothing.** They also need a second key, from a different physical location, from a device by a different vendor, possibly protected by a different passphrase.
- **A burglary at one site yields at most one key.** A second break-in or coercion at another site is needed. Coercion also gets harder: you can't hand over the funds on the spot, because the keys aren't all with you.
- **A single vendor exploit reaches at most one key.**
- **A single phishing or blind-sign mistake isn't enough.** A malicious transaction has to get past two separate signing steps on two different devices. Checking the hash independently is what makes the second step a real check and not a rubber stamp. Without it, a compromised UI can fool both signers, as happened at Bybit.

Loss resistance: you can lose **any one** key or backup and still move funds with the other two. Then use them to swap in a new signer.

**Attacker's job: compromise two separate secrets, in two places, from two vendors, without you noticing the first compromise and rotating it out.** A compromised key you notice becomes a recoverable incident, not a loss.

### What you give up

- **Smart-contract risk.** You now rely on Safe's contracts. They are among the most audited and battle-tested contracts on Ethereum, holding tens of billions of dollars. For a plain Safe with no modules, this risk is small compared with the single-seed risk it removes.
- **Friction.** Each move needs two devices, and some moves mean a trip to fetch Key C. For funds "moved only occasionally," that friction is a feature.
- **Gas and chain handling.** Deploying costs a small amount of gas. A Safe exists only on the chain(s) you deploy it on. Never send funds to the Safe address on a chain where it hasn't been deployed with the same owners.
- **Discipline.** Multisig protects you only if the keys really are kept apart, and you really do verify transaction hashes.

## Summary

The Ledger is a good key. One key is not a custody setup. Keep the Ledger as one signer in a **2-of-3 Safe whose three keys you alone hold**, on devices from different vendors, stored in different places, and verify every transaction hash yourself. An attacker then has to beat two independent protections instead of one, and you can lose any one key without losing the treasury.

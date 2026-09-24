# Custody for $250k of long-held treasury funds (solo builder)

## Verdict: I would not approve the "everything on one Ledger" plan

A hardware wallet is a good **signer**. It is not a complete **custody setup**. With one Ledger, the treasury is protected by one key (one seed phrase). If an attacker gets that key, or gets you to sign one bad transaction with it, the whole $250k is gone and nothing can stop or reverse it. Relying on one key is a single point of failure, no matter how good the device holding it is.

"Nothing is more secure" is wrong. A multisig smart-contract wallet such as **Safe** is more secure. Your teammate is also assuming a multisig needs several people. **It doesn't.** One person can hold every signing key, as long as each key lives on a separate, independent device.

---

## What an attacker has to compromise

### Teammate's plan: one Ledger, one seed

The attacker only needs **one** of these:

| Attack path | What it takes |
|---|---|
| Seed phrase backup | Find, photograph, or steal one piece of paper or metal plate (house burglary, a phone photo you took of it, a cloud backup you made) |
| Blind or phished signing | Get you to approve one malicious transaction or permit/approval on the Ledger. Drainer sites, a fake "Ledger Live" app, address poisoning, and a compromised front end all do this. The device signs what you approve, and hardware wallets don't make bad approvals impossible. |
| Supply-chain / firmware | One tampered device, or a vendor-level issue with that one product line |
| Coercion | Pressure on one person (you) to unlock one device |

Losing the key is also a single point of failure: if the Ledger breaks **and** the one seed backup is lost or destroyed, the funds are gone for good.

**Cost for the attacker: one success.**

### My setup: a 2-of-3 Safe where you hold all three keys

The attacker has to compromise **two independent keys, on separate devices, stored in separate places**, all at once. Stealing one seed backup gets them nothing. Tricking one device into signing gets them nothing, because the transaction still needs a second signature on a second device from a different vendor. That second signature is also your second chance to notice that the transaction is wrong.

**Cost for the attacker: two separate successes, against unrelated targets.** In return you can lose any one key and still recover.

---

## The setup I would use

**Safe smart account, threshold 2-of-3, on Ethereum mainnet** (or whichever single chain the treasury lives on). Safe is the most battle-tested multisig contract (v1.4.1 singleton `0x41675C099F32341bf84BFc5382aF534df5C7461a`, deployed through the canonical proxy factory `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67`). Deploy it through the official Safe app.

All three owners are you:

| Owner | Device | Where it lives | Seed backup kept in |
|---|---|---|---|
| Key A | Ledger (your existing one) | Home | Location 1 (e.g. home safe) |
| Key B | A hardware wallet from a **different vendor** (Trezor, Keystone, GridPlus, etc.) | Home or office, kept apart from A | Location 2 (e.g. bank safe-deposit box) |
| Key C | A third hardware wallet, or an air-gapped signer | Off-site: this is the recovery key | Location 3 (e.g. a different city or trusted storage) |

Design rules and the reasons for them:

1. **Different vendors for at least two keys.** One firmware bug or supply-chain compromise can't hit two signers.
2. **No two seeds stored together, and never a seed stored with its own device.** Otherwise one burglary equals two keys.
3. **No seed in digital form.** No photos, no cloud notes, no password manager. A metal backup for fire and flood resistance.
4. **A 2-of-3 threshold, not 3-of-3.** A 3-of-3 gains little security and brings back the single point of failure for loss, because losing one device would lock the funds. With 2-of-3 you can lose any single key, then use the other two to rotate the lost one out (swap owner) and restore full strength.
5. **Don't use a phone or laptop hot wallet as an owner here.** For an agent or an active-operations Safe, a hot key as one owner is fine. For a cold treasury that moves rarely, keep every owner on hardware.
6. **Optional passphrase (25th word) on one or more seeds.** This protects against someone who finds a seed backup. Only use it if you store the passphrase separately and are sure you'll remember how it works years from now.

### How a transaction works

1. Draft the transfer in the Safe web app (bookmark the official URL and never follow links to it).
2. Sign with Key A. **On the device screen**, check the destination, the amount, and the Safe transaction hash.
3. Sign with Key B, and on that separate device independently verify the **same** hash and details. If the two devices show different data, stop.
4. Execute. Key C stays in the vault except for recovery or an owner rotation.

For better assurance, check the Safe transaction hash with an independent tool (for example the open-source `safe-tx-hashes` scripts, or a second front end) before signing. Front-end compromise is how the biggest Safe-related losses happened: two signers approved a malicious transaction they didn't verify. A multisig raises the bar; it doesn't replace reading what you sign.

### Operational hygiene

- **Test first.** Deploy the Safe, send a small amount, run a full 2-signature withdrawal, and also practice a recovery that uses Key C plus one other key. Only then move the $250k.
- **Keep the Safe clean.** No token approvals and no DeFi interactions from the treasury. If you want yield, move funds out to a separate operating wallet.
- **Keep a written recovery document**, kept apart from any seed: the Safe address, chain, owner addresses, threshold, and which backup is where. The funds have to be recoverable by you in 5 years, when you've forgotten the details.
- **Checksum every address** and send a test transaction to any new destination.
- **Check the setup every year:** firmware updates, confirm each backup still exists and is readable, and confirm the owners/threshold on-chain haven't changed.
- **Estate planning, optional and without a co-signer:** you said no second person, and this setup doesn't need one. If you ever want the funds to be recoverable after your death or incapacity, you can leave sealed instructions with an attorney. This isn't a signing key, and it doesn't change who controls the funds day to day.

---

## Summary

| | One Ledger | 2-of-3 Safe, all keys held by you |
|---|---|---|
| Keys attacker must compromise | **1** | **2, independent, on different vendors, in different locations** |
| Stolen seed backup | Total loss | Nothing happens; you rotate that key out |
| One device tricked into a bad signature | Total loss | Blocked unless a second device also signs |
| Lost or broken device plus lost backup | Total loss | Recoverable with the other two keys |
| Needs a second person? | No | **No** |
| Extra effort | None | About 2 extra devices (~$150–300), one setup session, a second signature for each rare transfer |

For funds held long-term that you move only occasionally, the extra signing step costs very little, and removing the single point of failure matters a lot. **Use the 2-of-3 Safe, with you holding all three keys. Keep your Ledger, but as one of the three signers rather than the whole treasury.**

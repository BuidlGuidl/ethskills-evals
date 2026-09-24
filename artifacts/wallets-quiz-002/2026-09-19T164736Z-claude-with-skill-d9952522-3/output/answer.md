# Treasury custody for a solo builder (~$250k)

## Verdict: I would not sign off on "everything on one Ledger"

A hardware wallet is a great place to keep **a** key. It's still one key. If the whole treasury sits behind one externally owned account (EOA) whose key lives on one Ledger, then **one compromise takes everything**. There is no second check, no delay, and no way to recover afterward.

Your teammate is mixing up two separate questions:

1. **Storage: where does the key live?** A Ledger answers this well. The key never touches your laptop.
2. **Authority: what can that one key do by itself?** With a single-key EOA, the answer is *everything*. One signature moves all $250k.

A better box for the key doesn't change the authority. So pick the authority model first, then the storage.

You also don't need a second person. **A multisig doesn't require multiple people.** A multisig is a wallet that only moves funds when a set number of its keys sign (the "threshold"). One person holding keys on separate, independent devices meets a 2-of-3 threshold alone. That's why a lone hardware wallet is *not* the most secure way to hold a treasury, even for someone working alone.

## The setup I would actually use

**A Safe smart account, 2-of-3, with all three signers held by you on independent devices:**

| Signer | Device | Where it lives | Seed backup |
|---|---|---|---|
| A | Ledger (e.g. Nano X / Flex) | At home, daily-access location | Metal backup, location 1 |
| B | A different vendor: Trezor, Keystone or GridPlus | A separate location (safe, office drawer) | Metal backup, location 2 |
| C | Recovery key: a third hardware wallet, or an offline seed only | Bank safe-deposit box / trusted off-site location | Stored with the device, or instead of it |

Rules that go with it:

- **Threshold 2-of-3.** For normal occasional moves you sign with A + B. C exists so that losing any one device, or its seed, doesn't lock you out. You can rotate the lost signer out using the other two.
- **Different vendors for at least two signers.** That way one firmware bug, one supply-chain compromise, or one bad vendor update can't hit two signers at once.
- **Never store two seed phrases in the same place**, and never put a seed in a password manager, cloud drive, photo, or anything else digital.
- **Keep a small hot float separate.** If you need to pay for things regularly, keep a small operating wallet (a single Ledger EOA is fine *here*). Fund it from the Safe only with an amount you'd accept losing. The principal never sits behind one key.
- **Verify every transaction on each device's screen.** Check the destination (checksummed address), the amount, and that the call is a plain transfer and not a `delegatecall` or approval. Don't trust the web UI. Where possible, check the Safe transaction hash independently (e.g. with a CLI or a second machine). Blind-signing a malicious payload is how large Safes have actually been drained.
- **Do a test run first.** Deploy the Safe, send a small amount, then move it out using each pair of signers (A+B, A+C, B+C). This proves recovery works *before* the $250k is in it. After that, move the rest.
- **Optional hardening:** add a Safe guard or module with a time delay on large outflows, or a whitelist of destinations. That gives you a window to react if you ever get tricked into signing.

Cost: two or three more hardware wallets (~$150–$400 total) plus a one-time Safe deployment fee. That's under 0.2% of what you're protecting.

## What an attacker has to compromise

### Teammate's plan: one Ledger holding one EOA

The attacker needs **any one** of these:

- **The seed phrase.** It's a single point of failure wherever it's written down: burglary, a house guest, a photo, a "backup" that got digitized, or a phishing "Ledger support" request to type it in.
- **You, tricked into one bad signature.** One blind-signed malicious approval, permit, or transfer on a compromised dApp front-end or a poisoned address, and the funds are gone. The Ledger faithfully signs whatever you approve.
- **The device plus its PIN**, or coercion ($5-wrench attack). One device, one person, one moment.
- **A vendor-level failure**: a supply-chain-tampered device, or a firmware or key-extraction bug in that one product line.

There's no recovery if the device *and* the seed are lost or destroyed together, e.g. in a house fire. There's no delay and no second check. **Attack surface: one key, compromised once.**

### My plan: 2-of-3 Safe, one person, three independent devices

To steal funds, the attacker needs **two independent compromises at once**:

- **Two seeds**, stored in two different physical locations. Or two devices plus their PINs, in two locations. Or one of each.
- **Or you tricked into signing a malicious transaction twice, on two different devices from different vendors.** Each one shows the transaction on its own screen, which gives you two separate chances to catch it. Add a timelock guard and you get a third chance, after the fact.
- **A vendor bug now only yields one signer**, which is not enough.

A single stolen seed, a single burgled location, a single phished signature, or a single faulty device is now **survivable**. You notice, then use your remaining two keys to rotate out the compromised signer and move funds. Losing a device is also survivable: that's what signer C is for. In the one-Ledger plan, a lost device is recoverable only if the seed survives, and a seed that survives is exactly the thing an attacker wants.

**Attack surface: two of three keys, in separate places, from separate vendors, compromised before you notice.**

### What multisig doesn't fix (honest caveats)

- **It's still one human.** If an attacker can coerce you and all your locations, the threshold doesn't help. A timelock on large withdrawals is the mitigation for that.
- **If you blind-sign the same malicious payload on two devices**, a multisig won't save you. The discipline of verifying on each screen is part of the setup, not optional.
- **Operational complexity is the main new risk.** That's why you do the recovery test with small amounts first, and write down (without seeds) which signer is where and how to recover.

## Summary

Your teammate's right that a Ledger is a good place to store a key. They're wrong that it's the most secure way to hold a treasury, because it leaves one key with total authority. For $250k held long-term and moved rarely by you alone, use a **2-of-3 Safe where you hold all three signers**, on devices from different vendors, in separate places, with separate seed backups. The attacker's job goes from compromising one thing once to compromising two independent things before you react. For you it costs a few hundred dollars and a second device to tap when you move funds.

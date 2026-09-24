# Treasury custody for a solo builder (~$250k, long-term, rarely moved)

## Short answer

**I won't sign off on "keep it all on one Ledger."** A hardware wallet is a good place to *store a key*, but it doesn't limit *what that key can do*. One Ledger means one key that can move the whole $250k. That's a single point of failure. Whatever device it sits in, one compromise or one mistake takes everything.

What I would use instead: **a 2-of-3 Safe multisig where you hold all three keys yourself**, on separate devices from different vendors, with the backups stored in separate places. A multisig does not need multiple people. One person holding keys on separate devices meets a threshold of 2 alone. The attacker now has to compromise **two independent things** instead of one.

---

## Reasoning: authority first, storage second

Where a key lives decides *who* can reach it. It does not decide *what* the key is allowed to do. The teammate's argument is only about storage: the private key never leaves the secure element. That part is true, and it's worth having. But look at the authority. With one Ledger, a single signature from a single device (or its single seed phrase) moves 100% of the funds, with no second check anywhere.

So the question isn't "which device is most secure?" It's "how many independent things does an attacker have to beat?"

### What an attacker has to compromise: single Ledger (1-of-1 EOA)

Any **one** of these is a total loss:

| Path | What it takes |
|---|---|
| Seed phrase exposure | Someone finds, photographs, or copies the 24 words, from a safe, a house burglary, a cloud photo, or a "backup" typed into a password manager. The device isn't needed at all. |
| Blind-signing / phishing | You approve a malicious transaction or permit on the device, e.g. through a compromised frontend, a poisoned address, or a drained-by-signature `permit`/`setApprovalForAll`. The Ledger faithfully signs what you approved. |
| Coercion | One person, one PIN, one device: a $5 wrench attack works. |
| Supply-chain / firmware / host software | A tampered device, a malicious firmware update, or a compromised Ledger Live / connect-kit library (this has happened: the Dec 2023 Ledger Connect Kit compromise). |
| Loss (no attacker needed) | Device lost *and* the seed backup destroyed or unreadable (fire, flood, faded ink, incapacity), and the funds are gone for good. |

Every row is a **single point of failure**. "Nothing is more secure" really means "no *device* is more secure." But the *design* is one-of-one.

### What an attacker has to compromise: 2-of-3 Safe, all keys yours

Any single one of the above now **fails on its own**:

- One seed found → attacker has 1 of 3 signatures, can't move anything. You use the other two to rotate the compromised owner out (a Safe owner change is itself a 2-of-3 transaction).
- One device phished into signing a bad transaction → the transaction still needs a second signature on a **different device, from a different vendor, running different software**. That's a second, independent chance to catch it.
- One vendor's firmware or supply chain compromised → it controls at most one key.
- One device or backup lost or destroyed → you still have 2 of 3 and can replace the lost owner. Loss tolerance goes *up*, not down.

To steal the funds, an attacker now has to compromise **two separate keys**, stored in different places, on hardware from different vendors. Or they have to fool you twice, on two different screens, into approving the same malicious transaction. That's a much higher bar than one.

---

## The setup I would actually use

### 1. Safe (Gnosis Safe) multisig, 2-of-3 threshold, all three owners controlled by you

- **Owner A:** Ledger (e.g. Nano X / Flex), your daily-access signer. Kept at home.
- **Owner B:** hardware wallet from a **different vendor** (Trezor Safe 5, Keystone, GridPlus Lattice, etc.). This protects against a firmware or supply-chain compromise at one vendor. Kept in a different physical location from A (office, second safe).
- **Owner C:** a third hardware wallet (or an air-gapped signer), used **only for recovery**. Stored off-site: a bank safe-deposit box or a trusted location away from home.

Why 2-of-3 and not 2-of-2: 2-of-2 doubles your chance of *losing* funds, because losing either key bricks the Safe. 2-of-3 gives you theft resistance **and** loss tolerance.

Why not 3-of-3 or 1-of-2: 3-of-3 has the same brittleness as 2-of-2. 1-of-2 is just two single points of failure.

### 2. Seed-phrase backups separated just like the devices

The seed is the key. A multisig only helps if the **backups** are also separated.
- Each seed backed up once, on metal (steel plate), stored in a **different location** from the other seeds. Never put two seeds in the same drawer, safe, or box, or you've rebuilt a single point of failure.
- Never photograph a seed, type it into anything, store it in the cloud, or paste it into a chat, a prompt, or a password manager. A seed that has been typed or pasted anywhere online should be treated as burned: rotate that owner out.
- Optional: a BIP-39 passphrase on each device, with the passphrase stored separately from the words.

### 3. How you actually move funds (occasional, always you)

1. Propose the transaction in the Safe UI from Owner A.
2. **Before signing, read on the device screen:** amount, checksummed destination address, and the operation. Refuse any transaction the device can't clear-sign (no blind signing). Compare the Safe transaction hash shown on the device against an independent calculation (e.g. the Safe CLI or a `safe-tx-hashes` style verifier on a separate machine). This is the lesson of the Bybit 2025 loss, where signers approved a UI-spoofed transaction.
3. Sign with Owner B **on a different computer if possible**, checking the same details again on B's screen.
4. Execute. For big moves, send a small test amount to the destination first.

### 4. Hygiene and recovery drills

- **Test recovery before funding:** create the Safe, deposit a small amount, and practice (a) a normal withdrawal with A+B, (b) a withdrawal with A+C, and (c) replacing an owner. Only then move the $250k in.
- Keep the Safe on a chain you actually need (Ethereum mainnet for long-term holding). Record the Safe address, owner addresses, and chain in your notes. That's not secret, but you need it for recovery.
- Don't grant token approvals from the treasury Safe. Keep a separate, small hot wallet for day-to-day dApp use, topped up from the Safe as needed. That way a phishing signature on your daily wallet risks only the float, never the principal.
- **Inheritance / incapacity:** write down for an executor where the three keys are and how Safe recovery works. Split the information so no single envelope contains two seeds.

### 5. Optional: extra time-based protection

If you want more, add a **delay / timelock module** (e.g. Zodiac Delay) or a spending-limit setup. Big withdrawals then sit in a queue for 24–72h, where you can cancel them if you didn't initiate them. That turns "attacker got two keys" into "attacker got two keys *and* you didn't notice for 48 hours."

---

## Summary for the teammate

> "A Ledger is the gold standard for *where a key lives*. It says nothing about *how many keys it takes to move the money*. One Ledger = one seed = one point of failure: one leaked seed phrase, one phished signature, one coerced PIN, or one lost-backup accident and the whole treasury is gone. A 2-of-3 Safe with three hardware wallets (two vendors, three locations, all held by me) keeps the Ledger's key-protection *and* requires an attacker to compromise two independent devices or backups, while tolerating the loss of any one. It doesn't need a second person, just a second and third device."

**Verdict:** not signed off as proposed. Keep the Ledger, but make it **one of three owners** of a 2-of-3 Safe that you control alone.

I would not sign off on "keep it all on one Ledger" for a $250k long-haul treasury.

A Ledger is good key storage, but a single Ledger used as a single EOA is still a single-signature treasury. If that one seed phrase is exposed, that one device is compromised, or I am tricked into signing one bad transaction with that one signer, the whole treasury can move. The hardware wallet improves where the key lives; it does not change the fact that one signing authority can spend everything.

The setup I would actually use is a 2-of-3 multisig, such as a Safe, where I personally control all three signers:

1. Signer A: a hardware wallet I can access when I need to move funds.
2. Signer B: a second hardware wallet from a different vendor, stored separately.
3. Signer C: a recovery hardware wallet or seed backup stored in a third, physically separate secure location.

The threshold would be 2-of-3. I would not reuse the same seed on multiple devices. I would keep seed backups offline, preferably on durable media, split across separate physical locations, with no photos, cloud notes, password-manager copies, or repo/checklist copies. I would first test the Safe with a small amount, practice signing with two devices, practice recovery, and only then move the treasury. For regular work I would keep a separate small hot wallet or operating wallet and leave the principal in the multisig.

This still fits the constraint that I am the only person who can move funds. A multisig does not require multiple people; it requires multiple independent signing keys. I would be the only human operator, but I would need two separate signer devices/secrets to authorize a treasury movement.

The attacker model changes materially:

- With one Ledger EOA, an attacker needs to compromise one signing authority. That could mean stealing or extracting the seed phrase, getting access to the device and PIN, compromising the supply/recovery process, or tricking me into signing a transaction that drains the wallet.
- With a 2-of-3 Safe, an attacker needs to compromise two independent signing authorities, or trick me into approving the same malicious action from two separate signers. Stealing one seed, one hardware wallet, or one backup is not enough to move the treasury.
- If I lose one signer in the 2-of-3 setup, I can still recover with the other two and rotate the lost signer out. If I lose the only Ledger seed in the single-wallet setup, the treasury is gone; if someone else gets it, the treasury is gone in the other direction.

So the difference is not "hardware wallet versus multisig." The setup I would use is hardware wallets behind a multisig threshold. The hardware wallets protect individual keys; the multisig prevents any one key from being the whole treasury.

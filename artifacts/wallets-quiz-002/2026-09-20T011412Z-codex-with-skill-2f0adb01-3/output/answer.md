I would not sign off on "put the whole treasury on one Ledger" for a
long-term $250k treasury.

A hardware wallet is a very good signing device, but a single hardware-wallet
account is still a single-key treasury. If that one seed phrase is exposed, or
if the device plus PIN is compromised, or if I am tricked or coerced into
signing the wrong transaction, the whole treasury can move. The Ledger improves
key storage, but it does not change the authorization rule: one key can drain
everything.

The setup I would actually use is a 2-of-3 Safe, with all three signing keys
controlled by me, each generated independently:

1. Signer A: hardware wallet kept available for planned treasury operations.
2. Signer B: different hardware wallet, ideally from a different vendor, stored
   separately.
3. Signer C: recovery hardware wallet stored in a third secure location.

The Safe threshold would be 2-of-3. I would not use cloned devices sharing the
same seed as separate signers. Each signer must have its own seed phrase. Each
seed backup should be offline, durable, and physically separated from the
others, preferably on metal. No photos, cloud notes, password-manager copies,
chat logs, or repo files.

For a treasury that moves only occasionally, I would keep the Safe simple:

- Use the official Safe app or well-known Safe tooling.
- Set the threshold to 2-of-3.
- Do not enable modules, spending allowances, recovery modules, automation, or
  experimental account-abstraction features unless there is a specific need and
  I have audited the risk.
- Test the Safe first with a small amount.
- Document the recovery procedure on paper: where each signer and backup is,
  how to assemble two signatures, and how to rotate a signer if one is lost or
  suspected compromised.
- Periodically verify that two signers can still sign, firmware and wallet
  software are usable, and the written recovery instructions still make sense.

The difference in attacker requirements is the whole point.

With one Ledger, an attacker needs to compromise one control path:

- steal or copy the one seed phrase,
- get the device and PIN,
- trick me into signing one malicious transaction,
- compromise my transaction flow badly enough that I approve the wrong address
  or calldata,
- or physically coerce me once.

Any one of those can be enough to lose the full treasury.

With a 2-of-3 Safe, the attacker generally needs two independent signer
compromises, or they need to compromise the Safe configuration itself through a
transaction that still requires the threshold. Stealing one seed is not enough.
Stealing one device is not enough. Tricking one signer into approving something
is not enough unless I also approve it with a second independent signer. If I
discover that one signer is compromised, the other two can move funds or rotate
that signer out.

This also improves availability. If the single Ledger is lost and the seed
backup is damaged or unreadable, the funds are gone. In the 2-of-3 setup, I can
lose one signer and still recover with the other two. The tradeoff is that if I
lose two signers, I am stuck, so the physical storage and recovery procedure
matter a lot.

So my answer is: use hardware wallets, but do not use just one hardware-wallet
account. For this amount and use pattern, I would use a simple 2-of-3 Safe with
three independent keys under my control. No second person is required; the
security comes from requiring two separated devices/seeds instead of one.

References:

- Safe docs describe owners and thresholds for Safe Smart Accounts:
  https://docs.safe.global/advanced/smart-account-concepts
- Safe docs describe multisignature smart accounts and threshold-based
  confirmations:
  https://docs.safe.global/advanced/smart-account-overview
- Ledger's own guidance emphasizes that the recovery phrase controls the assets
  and must be protected from disclosure:
  https://www.ledger.com/academy/hardwarewallet/best-practices-when-using-a-hardware-wallet

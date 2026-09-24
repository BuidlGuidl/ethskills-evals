# Recommendation

I would not sign off on "put the whole treasury on one Ledger" for a long-haul
$250k treasury.

A hardware wallet is a strong signer, but one hardware wallet is still one key.
If that one seed phrase is copied, that one device plus PIN is stolen, or you are
tricked into approving one bad transaction with that one signer, the treasury can
be gone. The hardware wallet improves key isolation; it does not remove the
single point of failure.

The setup I would actually use is a solo-controlled Safe multisig:

- Create a Safe smart account with a `2-of-3` threshold.
- Use three independently generated signer keys, preferably on separate hardware
  wallets. Ideally use at least two vendors or models so one device/firmware
  failure mode does not cover every signer.
- Keep the signers and seed backups in separate physical locations. For example:
  one primary hardware wallet at home, one hardware wallet or sealed seed backup
  in a bank safe deposit box, and one in another secure offsite location.
- Store seed backups on durable offline media, not screenshots, password-manager
  notes, cloud storage, email, or repo files.
- Use the Safe only for treasury custody. Do not use it for random dapps,
  airdrops, NFT mints, token approvals, or day-to-day experimentation.
- Keep a small separate hot wallet for gas and operational spending.
- For every treasury movement, verify the destination address out-of-band, do a
  small test transaction first when practical, and then require two separate
  signer approvals.
- Do not enable extra Safe modules, guards, delegates, recovery services, or
  automation unless you have a very specific reason and understand the new trust
  assumptions.

This still lets "only me" move funds. Multisig does not require multiple people;
it requires multiple keys. You would personally control all three keys, but no
single key can move the treasury.

# Why this is better

With the teammate's plan, the attacker has to compromise one thing:

- the Ledger's seed phrase, or
- the Ledger device plus PIN, or
- your signing flow once, by getting you to approve a malicious transaction, or
- your recovery backup, if that backup is exposed.

That is a strong single lock, but it is still one lock. For a long-term treasury,
the uncomfortable part is that both theft risk and loss risk concentrate in one
place. If the seed is stolen, you lose the funds. If the seed/device backup is
lost or destroyed, you may lose access.

With a `2-of-3` Safe, the attacker has to compromise two independent signers, or
trick you into approving the same malicious transaction with two independent
signers. Stealing one seed is not enough. Malware on one laptop is not enough.
One stolen hardware wallet is not enough. One destroyed backup is not enough.

The tradeoff is operational friction. When you want to move funds, you need two
signers available. For a treasury that moves only occasionally, that is a good
trade. The whole point is to make normal use a little slower so catastrophic
failure is much harder.

# The important caveat

Do not make this a `1-of-3` Safe. That gives you recovery convenience, but it
also recreates the same "one compromised key drains everything" problem.

Do not make it `3-of-3` either unless you have an unusually robust backup and
disaster-recovery process. Losing one signer would freeze the treasury.

For a solo builder with no co-signer and occasional treasury movement, `2-of-3`
is the balance I would choose.

# References checked

- Safe docs: Safe accounts have owners and a threshold, where the threshold is
  the minimum number of owner confirmations required to execute a transaction:
  https://docs.safe.global/advanced/smart-account-concepts
- Ledger docs: the Secret Recovery Phrase controls recovery of the wallet, and
  Ledger recommends protecting it with durable offline storage and avoiding
  insecure digital copies:
  https://shop.ledger.com/pages/seed-phrase-storage

I would not sign off on "put it all on one Ledger."

A hardware wallet is a good component, but one hardware wallet is still a
single-key treasury. For a $250k long-term treasury, I would use a 2-of-3
multisig controlled by me, with three independently generated hardware-wallet
keys and carefully separated backups.

My setup:

1. Create a 2-of-3 multisig wallet.
   - For Ethereum/EVM assets, I would use Safe.
   - For Bitcoin, I would use a standard 2-of-3 multisig wallet with descriptor
     backups.

2. Use three separate hardware wallets as the owners/signers.
   - Ideally use more than one vendor/model, not three copies of the same device.
   - Generate each seed on its own device.
   - Never type any seed into a computer, phone, browser, password manager, or
     cloud note.
   - Do not derive all three signers from one seed. That only looks like
     multisig; it is actually still one secret.

3. Store the signers and backups in separated places.
   - Example: one signer available for use, one in a bank safe deposit box, one
     in a different secure location.
   - Store seed backups separately from their devices.
   - Use durable metal backups for seeds.
   - Label enough to recover safely, but not enough that a thief immediately
     knows "this plus one more thing drains the treasury."

4. Keep an offline recovery packet.
   - Multisig policy: chain, wallet address, threshold, signer public keys,
     derivation paths, and wallet software used.
   - Instructions for how I can reconstruct the wallet if my laptop dies or a
     wallet vendor disappears.
   - For Safe, record the Safe address, chain, owner addresses, threshold, and
     recovery process.

5. Use a conservative transaction process.
   - Use a dedicated, clean machine/browser profile for treasury transactions.
   - Do not connect the treasury wallet to random dapps.
   - Avoid unlimited token approvals from the treasury wallet.
   - First send a small test transaction when moving to any new destination.
   - Verify recipient address and transaction details on the hardware-wallet
     screens where possible.
   - For EVM transactions, avoid blind signing unless I fully understand the
     calldata and destination.

The important difference is what an attacker has to compromise.

With one Ledger, the attacker needs one successful path. Any one of these can be
enough:

- Steal or copy the seed phrase.
- Steal the device and learn/coerce the PIN.
- Trick me into approving a malicious transaction.
- Compromise my transaction environment so I sign the wrong address or approval.
- Exploit a mistake in my backup process, such as a seed photo, cloud sync,
  reused seed, or exposed recovery sheet.
- Destroy or lose the one seed/device if I do not have a usable backup.

The Ledger materially reduces the risk that normal computer malware can extract
the private key. That is good. But it does not remove the single point of
failure: there is still one signing key that controls everything.

With a 2-of-3 multisig, the attacker usually has to compromise two independent
signers or trick me into producing two valid signatures. One stolen seed is not
enough. One stolen device is not enough. One compromised storage location is not
enough. Malware on my laptop is not enough unless it also gets me to approve the
same malicious transaction with two different hardware wallets. A bad backup
mistake on one signer is survivable. Loss of one signer is survivable.

This does not make the treasury invincible. If I keep two seeds in the same
drawer, or approve the same malicious transaction twice without checking, I can
still lose the funds. The setup only works if the keys are genuinely independent
and operationally separated.

So the short answer is: use hardware wallets, but do not use only one. For this
amount and this use case, I would use a 2-of-3 multisig with three independent
hardware-wallet keys controlled by me. It changes the attack from "compromise
one thing" to "compromise a threshold of independent things," while still
allowing a solo founder to move funds without needing another person to co-sign.

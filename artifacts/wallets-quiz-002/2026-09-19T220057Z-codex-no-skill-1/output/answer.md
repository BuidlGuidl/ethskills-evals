# Recommendation

I would not sign off on "keep it all on one Ledger" for a $250k long-term treasury.

A Ledger is a good signing device, but a single Ledger wallet is still a `1-of-1` custody setup. The real question is not whether the signer is hardware-backed; it is how many independent secrets an attacker must compromise before the treasury can move.

The setup I would actually use is a solo-operated `2-of-3` multisig:

- Three independently initialized hardware wallets, not clones of the same seed.
- Preferably at least two hardware-wallet vendors, so one vendor/device class is not the whole security model.
- A `2-of-3` treasury wallet:
  - For Ethereum/ERC-20 assets: a Safe smart account with three hardware-wallet owners and threshold `2`.
  - For Bitcoin: a native `2-of-3` multisig wallet using tools such as Sparrow or Specter, with the wallet descriptor backed up.
- The three signer devices and their seed backups stored separately. For example: one accessible at home, one in a bank safe deposit box, and one in another secure offsite location.
- Each seed phrase backed up offline, ideally on metal, with no photos, password-manager entries, cloud notes, email drafts, or printer/scanner exposure.
- A written recovery/runbook: wallet address, chain/network, owner public addresses or descriptor, where each signer and backup is stored, how to rotate a signer, and a tested small-value recovery drill.
- A small separate hot wallet for routine expenses, funded from the treasury only when needed.

This still satisfies "always by me." You are the only operator. It just means future-you must approve treasury movement with two independent keys instead of one.

# Attacker Model Difference

With the teammate's plan, the treasury is protected by one private key:

- If an attacker gets the Ledger recovery phrase, they can restore the wallet and drain everything.
- If they get a digital copy of the seed because you typed it into a fake site, stored it online, photographed it, or entered it into compromised software, the hardware wallet no longer matters.
- If they steal the device and learn/coerce the PIN, or trick you into signing a malicious transaction, the whole treasury can move.
- If there is a serious failure in that one device, seed-generation process, firmware path, supply chain, or your single backup procedure, the entire treasury depends on that single failure not happening.

That is not "nothing is more secure." It is a strong single-key setup, but it is still a single point of failure.

With a solo `2-of-3` multisig, an attacker generally has to compromise two independent signer keys, not one:

- Stealing one seed phrase is not enough.
- Stealing one hardware wallet is not enough.
- Malware on your laptop is not enough if you verify the transaction details on both hardware devices before signing.
- A house fire, burglary, device failure, or lost backup at one location is survivable.
- If one signer is lost or suspected compromised, the remaining two can move funds to a fresh `2-of-3` setup.

The main tradeoff is operational complexity. You must preserve enough recovery information to reconstruct the multisig, and you must avoid losing two of the three signer keys. You also need to be careful with smart-contract wallet risk on Ethereum, which is why I would use a mature, widely reviewed system like Safe rather than a custom contract.

# Practical Signing Flow

For normal operation, I would keep the treasury cold and move funds rarely:

1. Draft the transaction from a clean machine using the official wallet interface or verified tooling.
2. Confirm the destination address and amount out of band, from my own records.
3. Sign with hardware wallet A.
4. Retrieve hardware wallet B from its separate location and sign again.
5. Execute the transaction.
6. Immediately verify the final transaction on a block explorer and update the runbook.

For $250k, the friction is a feature. If moving funds requires physically accessing two separate signers, then a remote attacker, a thief who finds one backup, or a phishing site that compromises one wallet has not won.

# Bottom Line

I would use a hardware wallet, but I would not use only one. My default would be a self-controlled `2-of-3` multisig with three independent hardware-wallet seeds, geographically separated backups, and a rehearsed recovery process.

The difference is simple: the one-Ledger plan asks an attacker to compromise one thing; the `2-of-3` plan asks them to compromise two independently stored things before the treasury can move.

Sources checked:

- Safe docs: a Safe has owners and a threshold, meaning the minimum number of owner confirmations required before a transaction can execute: https://docs.safe.global/advanced/smart-account-concepts
- Safe help: a common individual setup is three signers with threshold `2`: https://help.safe.global/articles/1038062742-what-safe-setup-should-i-use
- Ledger docs: the recovery phrase is the backup that can restore access to the wallet: https://www.ledger.com/academy/basic-basics/2-how-to-own-crypto/whats-a-secret-recovery-phrase
- Casa explainer: multisig removes the single point of failure by requiring more than one key: https://support.casa.io/knowledge/what-is-multisig

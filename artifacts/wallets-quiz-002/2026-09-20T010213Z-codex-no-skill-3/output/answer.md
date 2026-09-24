I would not sign off on "put the whole $250k on one Ledger" as the long-term treasury plan.

A Ledger is a good hardware signer, but one Ledger-controlled wallet is still a single-signature wallet. The whole treasury is protected by one authorization path: one seed phrase, one device/PIN path, and one chance for you to be tricked into approving the wrong transaction. For personal spending money that can be reasonable. For a long-held treasury balance, I would remove that single point of failure.

The setup I would actually use is a self-custodied 2-of-3 multisig, with all three keys controlled by me:

1. Three independent hardware-wallet keys, ideally from at least two vendors, created from fresh seeds.
2. A 2-of-3 policy: any two keys can move funds; one key alone cannot.
3. Store the three devices and seed backups in separated physical locations. Do not keep all seed plates in the same safe, and do not clone one seed onto multiple devices.
4. For Ethereum/EVM assets, use a Safe smart account with three hardware-wallet owners and threshold 2. For Bitcoin, use native 2-of-3 multisig with a wallet such as Sparrow/Specter/Caravan or a collaborative-custody coordinator if desired.
5. Keep one signer convenient enough for occasional operations, keep the other signing keys more deeply stored, and use a watch-only wallet for monitoring.
6. Before funding it, do a full rehearsal: create the wallet, send a small amount in, spend a small amount out, recover the wallet metadata on a second computer, and prove that any two of the three keys can spend.
7. Document the wallet policy, derivation paths, xpubs/output descriptors or Safe address, chain, and recovery procedure on paper. Store that documentation separately from the seeds.

I would not use 3-of-3, because losing one key would lock the treasury. I would not use one seed split into pieces as the main design, because that often turns recovery into the hardest part of the system. I would also avoid making all three signers the same hardware model if I can, because that leaves more correlated vendor risk than necessary.

The attacker model is the real difference.

With the teammate's one-Ledger plan, an attacker needs to compromise only one thing that is sufficient to spend:

- your 24-word seed phrase;
- your physical Ledger plus PIN;
- your signing flow once, by getting you to approve a malicious transaction;
- or a serious failure in the single wallet/device path you rely on.

The laptop malware alone should not be enough if you verify on the device screen, but the whole design still collapses to one signer. One successful compromise drains the treasury.

With a 2-of-3 multisig, the attacker has to compromise two independent authorization paths before funds can move. Stealing one seed is not enough. Stealing one device is not enough. Tricking you once on one signer is not enough. A house fire, one lost backup, or one broken hardware wallet is also not fatal, because the remaining two keys can rotate funds into a new wallet.

This does not make me invincible. An attacker could still win by getting two seeds, stealing two devices and PINs, compromising two signing ceremonies, or tricking me into approving the same bad transaction with two hardware wallets. But that is a much higher bar than "find the one seed" or "fool the one signer."

So my answer is: use a Ledger as one signer, not as the treasury architecture. For $250k held long term and moved rarely by one person, I would use a 2-of-3 self-custodied multisig with separated keys, tested recovery, and boring written procedures.

Sources checked: Ledger's own hardware-wallet guidance stresses that the recovery phrase controls the assets and must be protected; Ledger's multisig explainer describes threshold wallets such as 2-of-3 and the benefit that one compromised key is insufficient; Safe's docs describe smart accounts with owner lists and signature thresholds for Ethereum-style multisig.

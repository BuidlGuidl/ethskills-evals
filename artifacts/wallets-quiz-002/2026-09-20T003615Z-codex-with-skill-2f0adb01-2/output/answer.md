# Treasury custody recommendation

I would not sign off on "keep it all on one Ledger" for a long-haul $250k treasury.

A hardware wallet is a good signer. It is not, by itself, a good treasury architecture. One Ledger still means one seed phrase / one signing authority controls everything. If that seed is copied, exposed, coerced out of you, entered into a fake recovery flow, or if you are tricked into signing the wrong transaction, the whole treasury can move.

The setup I would actually use is a self-custodied Safe smart account with a `2-of-3` threshold, where all three signers are controlled by you but are generated and stored independently.

## Setup

Use a Safe as the treasury wallet. Configure it as:

- Threshold: `2-of-3`
- Signer 1: primary hardware wallet, used for normal signing
- Signer 2: second hardware wallet, different physical location
- Signer 3: third recovery signer, also independently generated and stored separately

For this amount and usage pattern, I would make all three signers cold or near-cold. I would avoid making a browser hot wallet, daily phone wallet, or development wallet an owner of the treasury Safe.

Each signer should have its own seed phrase. Do not initialize multiple devices from the same seed, because that only creates multiple copies of the same key. The security benefit comes from independent keys.

Store the seed backups separately, preferably on durable offline media. Do not store seed words in a password manager, cloud drive, photos, notes app, email, source repo, or `.env` file. For each backup, also store enough context for future you to know which signer it is and which Safe it belongs to, but never store all signing material together.

## Operating procedure

For normal treasury storage, funds sit in the Safe, not directly on any individual Ledger address.

When funds need to move:

1. Create the transaction in the Safe UI.
2. Verify the destination, amount, chain, token contract, and calldata if interacting with a contract.
3. Sign with the primary hardware wallet.
4. Bring out the second signer and verify the same transaction details independently.
5. Execute only after two hardware-wallet confirmations match the intended action.

Before depositing the full treasury, I would test the whole lifecycle with a small amount:

- receive funds into the Safe
- send a small transfer out
- replace an owner
- confirm that losing any one signer still leaves two usable signers

I would also keep a written recovery runbook: Safe address, chain, owner labels, where each backup is stored, and the exact recovery process. The runbook should not contain seed words or private keys.

## What the attacker must compromise

With the teammate's plan, the attacker needs one successful compromise path:

- steal or copy the Ledger recovery phrase
- get the Ledger plus PIN
- trick you into entering the seed into fake software
- trick you into signing a malicious transaction that drains the wallet
- compromise the backup location that contains the seed

Any one of those can be enough, because the single Ledger key is the treasury.

With a `2-of-3` Safe, the attacker must compromise at least two independent signing authorities, or compromise you badly enough that you approve the same malicious transaction with two separate signers. Stealing one seed is not enough. Stealing one hardware wallet is not enough. Malware on the transaction-preparation computer is not enough unless it also fools you through two separate signing checks. Losing one signer is also survivable because the remaining two can rotate it out.

So the difference is:

- One Ledger: one key can drain the treasury.
- `2-of-3` Safe: any one key can fail, leak, or be lost without immediately losing the treasury.

That is the core reason I would use a Safe even as a solo builder. Multisig is not only about multiple people. It is also about requiring multiple independent factors before treasury funds can move.

## Tradeoffs

This setup is less convenient than one Ledger. You have to maintain multiple devices, multiple backups, and a recovery procedure. You also take on smart-contract wallet risk, so I would use the standard Safe contracts and avoid experimental modules, spending plugins, or custom automation for the treasury account.

For $250k held long term and moved only occasionally, that inconvenience is worth it. The goal is not to make signing easy. The goal is to make a single bad day, lost seed, stolen device, infected laptop, or fake signing prompt insufficient to empty the treasury.

Sources checked: Safe's own setup guidance recommends more than one signer even for individuals and a threshold higher than one; Safe docs describe owner/threshold-based execution; Ledger's own material treats the recovery phrase as the backup for the private keys and warns that anyone with it can restore the wallet.

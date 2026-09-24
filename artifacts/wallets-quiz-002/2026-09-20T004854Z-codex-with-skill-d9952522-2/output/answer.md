I would not sign off on the "just keep it all on one Ledger" plan for a $250k long-term treasury.

A hardware wallet is a very good way to store a private key. It is not, by itself, a treasury custody design. If all funds sit behind one Ledger-controlled EOA, then the whole treasury has one signing authority. Anyone who can get that one device plus its PIN, seed phrase, recovery copy, or a tricked signature from you can move everything.

The setup I would actually use is a single-person multisig or smart account with a threshold, for example:

- A 2-of-3 Safe.
- Three keys held by me, but separated by device, location, and recovery path.
- Key 1: daily-access hardware wallet, stored securely.
- Key 2: second hardware wallet from a different setup flow, stored somewhere physically separate.
- Key 3: offline recovery key or hardware wallet seed in a high-security backup location.
- Treasury principal held in the Safe, not in any one EOA.
- Any movement of principal requires 2 signatures.
- A small hot wallet or 1-of-1 spending wallet may exist only for an amount I am comfortable losing.

This does not require a second person. A multisig is about requiring multiple independent signing factors, not necessarily multiple humans. I can still move funds by myself, but I have to bring together two separate keys.

The attacker model is the difference:

With one Ledger:

- Compromise the Ledger signing path, or
- steal/find the seed phrase, or
- coerce/trick me into one bad signature, or
- compromise the recovery material,

and the attacker can take the whole treasury.

With a 2-of-3 single-person multisig:

- Compromising one hardware wallet is not enough.
- Finding one seed phrase is not enough.
- Tricking one device into signing is not enough if the transaction still needs another independent signature.
- The attacker must compromise two of the three signing paths, or compromise the Safe configuration itself, before they can move the treasury.

That is the security improvement: not "hardware wallet versus multisig", but "one key can spend everything" versus "no single key can spend everything." The Ledger can still be part of the setup, but it should be one signer in a threshold wallet, not the whole treasury.

For $250k held long term and moved only occasionally, I would accept the extra ceremony of a 2-of-3 Safe. I would document the signer locations, recovery procedure, and test a small deposit and withdrawal before funding it. I would also periodically verify that I can still access at least two signing keys. The goal is boring custody: no one device, seed, or momentary mistake should be enough to drain the principal.

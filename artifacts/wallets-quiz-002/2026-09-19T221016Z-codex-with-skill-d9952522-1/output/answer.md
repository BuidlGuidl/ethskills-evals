I would not sign off on "put the whole treasury on one Ledger."

A Ledger is a good signing device, but one Ledger controlling one account is still
a single-key treasury. The storage is hardened; the authority is not split. If
that one seed phrase, device/PIN, or signing flow is compromised, the attacker
can move the entire $250k.

The setup I would actually use is a 2-of-3 multisig that I control alone:

- A Safe, or the chain's standard audited multisig, holds the treasury.
- The three owners are three separate hardware-wallet keys.
- Use at least two hardware-wallet vendors or models, for example Ledger plus
  Trezor/GridPlus/Keystone/Coldcard where supported.
- Keep one signer available for normal use, one signer stored separately
  offsite, and one recovery signer stored in a third place.
- Store seed backups separately from the devices, preferably in durable offline
  form, with no seed phrase in cloud storage, photos, password managers, chats,
  tickets, or repo files.
- Test the full flow with a small amount first: receive funds, send funds,
  replace a signer, and recover from a missing signer.
- For every treasury movement, verify the destination and amount on both signing
  devices before signing. No blind signing unless there is no alternative and I
  have independently decoded the transaction.

This does not require a second person. It requires two signatures, not two
humans. I can be the only person and still hold three independent signing keys.

The difference is what an attacker has to compromise.

With the teammate's one-Ledger plan, an attacker needs one successful break:
steal or copy the seed phrase, get the Ledger and PIN, trick me into signing a
bad transaction on that one device, compromise the setup process, or otherwise
gain control of the single key. Once they have that one authority, they can take
everything.

With a 2-of-3 multisig, an attacker needs two independent successful breaks.
Compromising one hardware wallet, one seed backup, one storage location, or one
bad signing session is not enough. They must either compromise two signer keys,
or trick me into approving the same malicious transaction with two separate
devices. That is a much higher bar, and it also changes accidents: losing one
device or one seed does not lose the treasury, because the remaining two keys
can rotate the lost signer out.

The tradeoff is operational complexity and smart-contract wallet risk. I would
accept that tradeoff for a $250k long-term treasury because the dominant risk is
not "is Ledger secure hardware?" The dominant risk is "does one mistake or one
stolen secret have authority over everything?" In the one-Ledger setup, yes. In
the 2-of-3 setup, no.

If this were Bitcoin rather than an EVM chain, I would use the same authority
model with a 2-of-3 native multisig wallet using separate hardware signers. I
would not use Shamir splitting of one seed as the main control, because after
reconstruction it is still a single key that can spend the whole treasury.

# Custody for ~$250k treasury, solo signer

## Short answer

I can't sign off on the one-Ledger plan. Not because a Ledger is a bad device — it's a
good device — but because your teammate is answering the wrong question. "Where does the
key live?" is a storage question. The question that decides whether you lose $250k is
"how many independent things must an attacker compromise before funds move?" On the
one-Ledger plan that number is **one**. It should be **two**, and you can get to two
without a second person.

Recommended setup: a **2-of-3 Safe** (smart-contract wallet) on Ethereum mainnet where
**all three owner keys are yours**, held on three devices that don't share a vendor, a
seed, or a room. Plus a small separate hot wallet for gas and day-to-day noise.

A multisig is not a governance tool that requires co-signers. It's a threshold. One
person holding keys on separate devices meets a 2-of-3 threshold alone. Your constraint
("no second person, ever") rules out *shared control*; it does not rule out *threshold
control*.

---

## Why "hardware wallet = gold standard" is the wrong frame

A hardware wallet bounds *who can use* the key: it keeps the secret off an
internet-connected machine and behind a PIN in a secure element. It does not bound *what
the key can do*. That key can still move 100% of the treasury in one transaction. So the
device narrows one attack path (malware scraping a key off your laptop) and leaves every
other path intact, each of which is individually fatal.

The path people forget: **the seed phrase backup**. The Ledger has a PIN, a secure
element, and a brick-after-3-tries rule. The 24 words on the steel plate in your desk
have *none of that*. They are a bearer instrument for $250k that anyone who physically
finds them can redeem, silently, with no PIN and no device. On a single-signer setup, the
backup is strictly weaker than the device — and you cannot skip having a backup, because
without it a dead or lost device means the money is gone forever. So the single-Ledger
plan forces you to create a single object that is simultaneously (a) mandatory and (b)
sufficient to steal everything.

Threshold custody is what breaks that trap: with 2-of-3, a found backup is worth nothing
on its own.

---

## The setup I'd actually deploy

**Vault — 2-of-3 Safe on Ethereum mainnet. Holds the ~$250k.**

| Owner | Device | Where it lives | Role |
|---|---|---|---|
| A | Ledger (the one you have) | Home, with you | Everyday co-signer |
| B | Different vendor — Trezor Safe 5, Keystone, or GridPlus | Home, but a different container/safe than A's backup | Everyday co-signer |
| C | Third device or a pure air-gapped seed | **Off-site**: bank safe-deposit box, or a lawyer/family safe | Recovery only, never touched in normal operation |

Each owner is an **independently generated seed**. This is the part that quietly ruins
most DIY multisigs: if you derive owner A at `m/44'/60'/0'`, owner B at `.../1'`, and
owner C at `.../2'` from the same seed phrase, you have a 1-of-1 wearing a 2-of-3
costume. Three separate device initializations, three separate backups.

Each seed backup goes in a *different physical location from the others' devices and from
each other*. Three steel plates in one fire safe collapse the threshold back to one, and
the entire benefit is gone.

**Spending float — a separate ordinary wallet (EOA is fine).** Keep gas money and
small operational amounts here: something you'd shrug at losing, not principal. This
exists so you never connect the vault to a random dapp just to pay $40 of gas or try
something out. Fund it from the Safe when it runs low.

**Nothing signs unattended.** You said moves are occasional and always by you, so there
is no bot, agent, or deploy script in this design — good, keep it that way. If that ever
changes, the automated signer gets a bounded float or a scoped Safe module with a
spending limit, never an owner slot on the vault. Moving principal, raising any limit,
and changing the owner set stay human-signed at threshold.

### Setup order (do it in this order)

1. Initialize the three devices offline. Record the three seeds on steel, not paper.
2. Deploy the Safe at safe.global with the three owner addresses, threshold 2.
3. Send **$50**. Do a full send-out with signers A+B. Confirm it lands.
4. **Recovery drill — do not skip this.** Pretend device A is destroyed: retrieve the
   off-site C, and execute a transaction with **B+C only**. This is the single step that
   catches a mis-recorded seed while it costs you $50 instead of $250k. Then execute a
   Safe owner-swap replacing A with a freshly initialized device, so you've also
   rehearsed the "one device compromised" response.
5. Only now move the treasury in.
6. Write a one-page sheet: Safe address, chain, which device is which owner, where each
   backup is, and how to run step 4. Store it with your will / with whoever handles your
   affairs. You're solo — the bus factor is a real loss vector at this size, and a 2-of-3
   with off-site C is actually *friendlier* to inheritance than a lone Ledger, because you
   can hand someone one key without handing them the money.

### Operating rules

- **Verify on the device screen, every time.** Recipient address and amount, read off the
  hardware display, not the browser. The browser is the thing that gets compromised.
- **Never blind-sign.** If your device shows a hex blob instead of a decoded Safe
  transaction, stop and fix that (updated Safe/Ethereum app, clear-signing enabled)
  rather than approving it. Blind-signing is how well-funded, hardware-wallet-holding
  treasuries have actually been drained — the attacker doesn't steal the key, they get you
  to authorize the transfer yourself.
- **Confirm the destination address out-of-band** for any large move (call the recipient,
  check a second source). Clipboard-swapping malware is cheap and common.
- **Keep the treasury on one chain.** A Safe is deployed per-chain and the same address is
  not automatically yours on another chain. Don't scatter it.
- Don't tell people the size or location of the stash. At $250k, the wrench-attack risk is
  low but it is not zero, and it's the one risk that scales with how many people know.

### On EIP-7702 (in case someone suggests it)

If you already hold funds in an EOA, you *can* delegate that EOA to contract code and get
batching without changing addresses — that's a real and useful thing. It is **not** a
substitute here: unless the delegate contract itself enforces a threshold, one key still
authorizes everything, so you'd have bought convenience, not security. It also introduces
a persistent delegation that stays in effect until you explicitly sign a new
authorization clearing it — retiring the delegate contract does nothing. For a
cold treasury you're touching a few times a year, skip it and just fund the Safe.

---

## The difference, in terms of what an attacker has to compromise

**One Ledger — attacker needs any ONE of:**

- The device plus your PIN (theft with observation, or coercion).
- The seed backup, alone — no device, no PIN, nothing else. A burglar, a contractor, a
  houseguest, a flood-remediation crew, a photograph of a drawer.
- **You, for one signature.** A malicious dapp or a compromised frontend gets you to
  approve one transfer or one unlimited token approval. The key is never stolen; the
  hardware wallet works perfectly and the money still leaves.
- Your clipboard, at the moment you paste a destination address.
- A firmware or supply-chain failure in that one vendor.

Each of those, on its own, is $250k. Five independent single points of failure, and one
of them (the backup) is an object with no defenses at all that you are *required* to
create.

Also note the failure that isn't an attacker: **loss**. House fire that takes the device
and the backup together, or a backup you wrote down wrong and never tested. Single-signer
custody has no margin for it.

**2-of-3 Safe, three of your devices — attacker needs any TWO of three, where:**

- The two must be *different vendors*, so a firmware or supply-chain break in one product
  line yields one key, not two.
- The two must come from *different physical locations*, so a single burglary, fire, or
  search yields one key.
- Finding one seed backup is worth **nothing**. That's the whole point: the mandatory,
  undefended object stops being sufficient.
- Compromising one key doesn't let the attacker escalate. On a Safe, adding an owner or
  lowering the threshold is *itself* a transaction requiring the threshold. A single
  stolen key cannot rewrite the rules to make itself enough. It also can't do anything
  quietly — you have time and standing to swap that owner out.
- The malicious-signature path narrows a lot too, because a bad transaction now has to
  survive you reviewing it on two separate devices in two sittings. It doesn't drop to
  zero — if you're rushing and rubber-stamp both, you'll sign it — but "review it twice on
  different hardware" catches a class of mistakes that one click doesn't.

And symmetrically on the loss side: any one device destroyed, and any one backup lost or
burned, and you still have your money. The single-Ledger plan is fragile in *both*
directions; 2-of-3 is resilient in both.

**The one honest cost:** complexity, and complexity is itself a risk. Three devices, three
backups, three locations, a setup and drill day, and slightly more ceremony each time you
move funds. If you skip the drill in step 4, or store all three backups together, you get
the complexity without the safety — worse than the Ledger plan. Do the drill; it's an
afternoon.

**Bottom line:** your teammate is optimizing the security of one key. At $250k held for
years, the thing to optimize is *how many independent compromises a theft requires*. A
hardware wallet is a component of the answer — it's owner A, and B, and probably C. It is
not the answer by itself.

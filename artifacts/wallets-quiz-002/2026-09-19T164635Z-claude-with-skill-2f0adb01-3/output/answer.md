# Custody for ~$250k solo treasury: verdict on "just use one Ledger"

## Verdict: I would not sign off on the single-Ledger plan

A hardware wallet is a big improvement over a hot wallet or a `.env` key, and it
should be part of the setup. It should not be the whole setup. One Ledger means
**one key, and that key is a single point of failure**. "Nothing is more secure"
is wrong: an audited multisig smart account, where the Ledger is one of several
signers, is strictly more secure. That still holds when you are the only person
involved.

You don't need a second person. A multisig needs multiple **keys**, not multiple
**people**. You can hold every key yourself, as long as each one lives on a
separate device in a separate place.

---

## Reasoning: what does an attacker have to compromise?

### Teammate's plan: one Ledger (one EOA, one seed phrase)

The funds are controlled by one secret, the 24-word seed. An attacker wins by
getting **any one** of these:

| Attack path | What it takes |
|---|---|
| Steal the seed backup | Find the paper or metal plate. One break-in, one nosy contractor, one photo. |
| Trick you into signing | One blind-signed or misread transaction or permit (address poisoning, a malicious dApp, a spoofed "upgrade" prompt, a phishing drainer). Nothing else checks it. |
| Physical coercion | Threaten you once. You can sign alone, so you can be forced to sign alone. |
| Supply-chain or firmware issue | A tampered device or a vendor-side flaw (e.g. seed-extraction features like Ledger Recover) affects the only key you have. |
| Compromise the signing computer | Malware that swaps the destination address. The only defense is you reading a small screen correctly every time. |

**Attacker's cost: compromise 1 thing.**

It also fails on **loss**, not just theft. If the device dies, fine, you restore
from the seed. If the seed is lost or destroyed (fire, flood, forgetting where
it is), **the $250k is gone permanently**. You're stuck choosing between
spreading seed copies around (more theft risk) and keeping one copy (more loss
risk). With one key you can't get both properties.

There's also no recovery after a compromise. If you suspect the seed was seen,
all you can do is race the attacker to move the funds.

### What I'd use: a 2-of-3 Safe where you hold all three keys

A Safe is an audited smart-contract wallet that has held tens of billions of
dollars for years. The treasury sits in the Safe's address. A transaction only
executes when **2 of the 3** owner keys sign it.

**Attacker's cost: compromise 2 independent things, in 2 places, from 2
different vendors, at the same time.** They need two of:

- Signer A's device **or** seed
- Signer B's device **or** seed
- Signer C's device **or** seed

Those three are deliberately stored in different places and don't share failure
modes. Here's how each attack from above plays out:

- **Seed backup stolen:** the attacker gets 1 of 3 keys, which moves nothing.
  You use the other two to swap the leaked owner out of the Safe
  (`swapOwner`). The funds never move and the leak just gets rotated away.
- **You're tricked into one bad signature:** it's only half of the threshold.
  To actually move funds you sign the same transaction again on a second device
  with a different screen and software stack. That second, independent check of
  the destination address and calldata is where most drainer and
  address-swap attacks get caught.
- **Firmware or supply-chain flaw in one vendor:** by design only one signer
  uses that vendor.
- **Loss:** any single device *or* seed can be lost or destroyed and you still
  have 2 of 3. You replace the missing owner and carry on. This is the part a
  single Ledger can't give you: **being tolerant of theft and tolerant of loss
  at once**.
- **Coercion:** it's harder, because the keys aren't all on you. Different
  locations mean an attacker can't collect everything in one go. It isn't
  eliminated, and no scheme fully eliminates it.

### Concrete setup

**Safe on Ethereum mainnet** (or wherever the treasury assets live), threshold
**2-of-3**, audited Safe v1.4.1 contracts deployed through the official Safe
app.

| Signer | Device | Where it lives | Seed backup location |
|---|---|---|---|
| A | Ledger (the one you already have) | Home, used for routine signing | Metal plate, location 1 (home safe) |
| B | Hardware wallet from a **different vendor** (e.g. Trezor Safe 5, Keystone, GridPlus) | Home or office, separate from A | Metal plate, location 2 (bank safe-deposit box) |
| C | Third hardware wallet (a third vendor if practical, otherwise a second unit of A or B, set up fresh) | **Off-site**, the cold recovery key | Metal plate, location 3 (a different secure off-site spot) |

Rules that make the "2 independent things" real:

1. **Every seed is generated on its own device** and never typed into a
   computer or phone, never photographed, never cloud-synced, never in a
   password manager or Git repo.
2. **No location holds two seeds or two devices** (or a device plus a
   *different* signer's seed). If one location is fully compromised, the
   attacker gets at most 1 of 3 keys.
3. **Use different vendors** so one firmware bug or supply-chain attack can't
   hit two signers.
4. Optionally put a **BIP-39 passphrase** on each device's seed, stored
   separately from its plate, so a found plate alone is useless.
5. **Normal use:** propose from A, check the full transaction on A's screen,
   co-sign from B, check it again on B's screen. C stays cold and only comes out
   if A or B is lost or suspected compromised.
6. **Verify, don't blind-sign.** Turn on clear-signing where supported, compare
   the Safe transaction hash on each device against an independent tool (e.g.
   Safe's own hash display or a CLI hash calculator), and check the checksummed
   destination address from a trusted source, not from clipboard history.
7. **Test before funding:** deploy the Safe, send a small amount, do one full
   2-of-3 withdrawal, and do one owner swap (to rehearse recovery). Then move
   the $250k, in tranches if you want.
8. **Write a recovery runbook** covering where things are, the Safe address,
   the chain, and how to swap an owner. That way the recovery path doesn't
   depend on memory under stress.
9. **Watch without keys:** add the Safe address to a watch-only monitor or
   alerts so you see any proposed or executed transaction immediately.

Why 2-of-3 and not 3-of-3 or 2-of-2: 3-of-3 and 2-of-2 bring back the
single-point-of-*loss* problem, because losing one device freezes the funds.
2-of-3 is the smallest setup that tolerates both one compromise and one loss.

Costs you accept: a few dollars of gas for deployment and per transaction, a
bit more friction per withdrawal (two devices), and more backups to manage. For
funds that move "only occasionally," that friction is cheap, and part of the
point.

*(Optional, only if you ever change your mind: the usual extra hardening is a
4th recovery key with a trusted contact or professional custodian in a 2-of-4.
That contact alone can't move anything. You said you won't bring anyone in, and
the all-self-held 2-of-3 above is a sound setup without it.)*

---

## Summary

| | One Ledger | 2-of-3 Safe, all keys yours |
|---|---|---|
| Keys attacker must compromise | **1** (device, seed, or one bad signature) | **2 independent** ones, in separate places from separate vendors |
| One seed backup leaks | Total loss | Nothing moves; rotate the leaked owner out |
| One device or seed destroyed | Total loss if it was the seed | Nothing lost; replace the owner |
| One phishing or blind-sign mistake | Funds drained | Caught on the second device, or harmless alone |
| One vendor firmware or supply-chain flaw | Total exposure | Affects 1 of 3 signers |
| Needs a second person? | No | **No** |

The Ledger is a good component. Use it as **one of three signers** in a Safe,
not as the only thing between an attacker and $250k.

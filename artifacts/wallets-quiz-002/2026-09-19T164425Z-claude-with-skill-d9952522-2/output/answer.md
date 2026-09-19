# Treasury custody for a solo builder (~$250k)

## Verdict: I would not sign off on "all of it on one Ledger"

A hardware wallet is a good place to **store a key**. But where the key lives
only limits *who* can use it. It says nothing about *what* the key can do. On a
single Ledger, one key (one EOA) can move the whole treasury, in one
transaction, with no delay and no way to undo it. "Nothing is more secure" is
wrong. A threshold of keys is more secure, and you can run one alone, without a
second person.

## What an attacker has to compromise

### Teammate's plan: 1 Ledger, 1 key (1-of-1)

Any **one** of these gets the attacker the full $250k:

1. **The 24-word seed phrase.** It might be found on paper, photographed,
   typed into a phishing "wallet recovery" site, lost in a burglary, or taken
   in a coercion or "wrench" attack. A seed phrase does not need the device or
   the PIN. Whoever has the words has the funds.
2. **You, at signing time.** You blind-sign or misread one malicious
   transaction or permit: a drainer site, a poisoned address, a spoofed dApp, a
   compromised front-end. The Ledger faithfully signs what you approve. One bad
   approval is final.
3. **The device plus its PIN.** Someone watches you enter the PIN and then
   takes the device, or the device is tampered with in the supply chain.
4. **Your own mistakes.** Losing the device *and* the seed backup, or a
   damaged backup, is a total loss with no attacker at all.

Every one of these is a **single point of failure**. The attacker's job is
"compromise one thing, once."

### What I would use: a 2-of-3 Safe that you alone control

A Safe (smart-contract multisig) on mainnet, with 3 owner keys and a threshold
of 2. **You hold all three keys**, each on a separate, independent device:

| Signer | Device | Where it lives | Seed backup |
|---|---|---|---|
| Key A | Ledger | Home, daily-access location | Separate location #1 |
| Key B | Different vendor (e.g. Trezor, Keystone, or GridPlus) | Different physical place from A | Separate location #2 |
| Key C | Third hardware wallet | Off-site: safe-deposit box / trusted secure storage | Separate location #3 |

A multisig does not need multiple people. It needs multiple **independent
keys**. To reach 2-of-3 you sign with two of your own devices.

**Now an attacker must compromise two independent keys**, each with its own
device, PIN, and seed, stored in different places:

- One leaked seed phrase is **not enough**. The attacker holds one of three
  keys and cannot reach the threshold.
- One stolen or tampered device is **not enough**.
- A burglary at one location is **not enough**, provided no single location
  holds two seeds or two devices. This is the rule you must actually follow.
- Getting a bad transaction signed now means fooling you **twice, on two
  different devices from different vendors**. Each device decodes and shows
  the Safe transaction hash separately. That is a second chance to notice
  something wrong, and less exposure to one vendor's firmware or display bug.
- **Loss is survivable.** If you lose one device or seed, the other two still
  meet the threshold. You then use them to swap the lost owner out of the Safe
  (`swapOwner`). No funds have to move and the address stays the same. With the
  single Ledger, a lost key means lost funds.

The **attacker's job** goes from "compromise one thing" to "compromise two
separately stored, separately secured things, without you noticing and
replacing the first one in the meantime." That last condition matters. If you
find that one key is compromised, you rotate it out with the other two before
the attacker gets a second key.

### Side by side

| Threat | 1 Ledger (1-of-1) | 2-of-3 Safe, all keys yours |
|---|---|---|
| Seed phrase leaked or photographed | **Total loss** | Safe; rotate that owner |
| Device + PIN stolen | **Total loss** | Safe; rotate that owner |
| One location burgled | **Total loss** if device or seed is there | Safe if locations are separate |
| Phishing / blind-signed malicious tx | **Total loss** from one approval | Must fool you on 2 devices; you check the tx hash twice |
| Firmware or vendor bug in one brand | Exposed | Mitigated by mixing vendors |
| You lose the device and backup | **Total loss** | Recoverable with the other 2 keys |
| Coercion ("wrench attack") | Hand over 1 device | Harder: keys are not all in one place (see caveat) |

## The setup, concretely

1. **Deploy a Safe on Ethereum mainnet** (app.safe.global) with owners A, B, C
   and threshold 2.
   - Why 2-of-3 and not 2-of-2: 2-of-2 doubles the attacker's work but also
     doubles your chance of *losing* the funds, since either key lost means
     total loss. 2-of-3 gives you theft resistance *and* loss tolerance.
   - Why not 3-of-3: same problem, worse.
2. **Generate every key on its own device.** Never import one seed into two
   devices. Never type a seed into a computer or phone, a password manager,
   or a cloud note. Never photograph a seed. Metal backups are fine.
3. **Geographic separation.** No single place holds enough to reach the
   threshold. For example, device A and seed B together in one drawer
   undermines the design, because a thief there gets two keys.
4. **Test before funding.** Send a small amount in and move it out, signing
   with each pair (A+B, A+C, B+C). Rehearse replacing one owner. Only then
   move the $250k in, in more than one transfer, checking the Safe address
   character by character on the device screen.
5. **Signing discipline for every movement.**
   - Write down the amount, the full checksummed destination, and the gas
     cost before you start.
   - On each device, confirm the Safe transaction hash matches what the Safe
     UI shows and what an independent calculator shows (e.g. the
     `safe-tx-hashes` tool). Do not approve anything you cannot decode.
   - Never approve `delegatecall` operations, module or guard additions, or
     owner or threshold changes you did not start yourself. These are how
     multisigs get drained (Bybit, Feb 2025, was a manipulated signing UI).
6. **Keep a small hot float separate.** If you need routine small payments,
   top up a separate low-balance wallet from the Safe. Only the float is at
   risk day to day. The principal always needs a 2-of-3 signature.

### Operations that must always require 2 of your keys

- Moving any principal out of the Safe.
- Adding, removing, or swapping an owner.
- Changing the threshold.
- Enabling a module or guard, or setting a fallback handler.

Nothing unattended (no bot, script, or agent) should ever be a Safe owner. If
you later automate something, give it a bounded allowance or a separate float,
never a key that counts toward the threshold.

## Honest caveats

- **Complexity is the cost.** Three devices, three backups, three places, and
  somewhat higher gas per transaction. Since you move funds only occasionally,
  this is a small price for $250k.
- **Smart-contract risk.** You now depend on the Safe contracts. They are the
  most battle-tested multisig on Ethereum (securing tens of billions of
  dollars), and that is a far smaller risk than one key.
- **Coercion.** If an attacker can force you to fetch two keys, a multisig
  alone won't stop them. Keeping one key off-site with access delays (like a
  bank safe-deposit box) helps. So does not advertising the holdings.
- **Recovery/inheritance.** Write a sealed plan for how the keys are
  reassembled if something happens to you. Otherwise a strong setup becomes a
  permanent loss.

## Bottom line

Your teammate is right that a hardware wallet is the right place for a key,
and wrong that one of them is the most secure way to hold a treasury. With one
Ledger, one seed phrase or one bad signature loses everything. With a 2-of-3
Safe where you hold all three keys on separate devices from different vendors,
stored in separate places, an attacker must compromise two independent keys,
and you can survive losing one. You don't need a second person, just a second
and third device.

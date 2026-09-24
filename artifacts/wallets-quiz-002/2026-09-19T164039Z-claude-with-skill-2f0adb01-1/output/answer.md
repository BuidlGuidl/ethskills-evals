# Custodying ~$250k of treasury funds as a solo builder

## Verdict: I would not sign off on "all of it on one Ledger"

A hardware wallet is a very good **signer**. A single signer is not a good **custody setup**. Your teammate is treating "the best single device" as if it meant "the most secure setup," and those are different things.

What I would use instead is a **Safe multisig where you hold every key yourself**, e.g. **2-of-3**. Each key lives on a separate, independent device, and the backups are stored in separate places. A multisig does not need multiple people. It needs multiple *independent keys*, and one person can hold all of them. That removes your only real constraint ("no second person").

---

## Reasoning: count what an attacker has to compromise

### Plan A: one Ledger (single EOA)

The funds sit in a plain externally owned account. The protocol's only rule is: **whoever produces a valid signature from that one private key controls everything.** The attacker needs any **one** of these:

| Attack path | What it takes |
|---|---|
| Seed phrase backup | Find, photograph, or steal the 24 words, wherever they are stored (drawer, safe, cloud photo, a "clever" hiding place). **This alone is total loss.** You never touch the device. |
| Blind-signing / phishing | Get you to approve one malicious transaction or signature on the Ledger: a drainer, a malicious `approve`/`permit`, a poisoned address, or a compromised frontend. The device signs what you confirm. Many real losses happen exactly this way, with the key never leaving the device. |
| Supply chain / firmware | A tampered device, or a firmware or vendor-level flaw (e.g. the Ledger Recover controversy showed that firmware *can* export seed shares). Everything depends on one vendor. |
| Physical coercion | Force you to unlock it and sign ("$5 wrench attack"). |
| Operational loss | Not an attacker, but the same result: the device is lost **and** the seed backup is lost or damaged, and the funds are gone forever. |

Put simply: **one secret, one mistake, one vendor. Any single failure is a 100% loss, and it can't be undone.** The Ledger makes remote *key extraction* hard. It does nothing about the seed backup, about a signature you approve by mistake, or about the fact that there is only one of everything.

### Plan B: 2-of-3 Safe, all keys held by you

The funds sit in a Safe smart contract. The contract only executes a transaction if **2 distinct owner keys** sign it. To move funds, the attacker now needs **two independent compromises at the same time**, for example:

- Seed backup A **and** seed backup B (stored in different places), or
- Your Ledger **and** your second-vendor device, or
- Phishing you on one device **and then** getting you to confirm the same malicious transaction again on a second device, with a separate screen and separate firmware from a different vendor.

Each of those is roughly as hard as attacking the whole single-Ledger setup, and the attacker has to pull off two of them. Meanwhile:

- **Losing one key is survivable.** Use the other two to rotate out the lost or compromised owner (`swapOwner`) and carry on. With one Ledger, losing the device and its backup is final.
- **A single stolen seed backup is survivable.** It gives the attacker one of the two required signatures, so nothing moves. You rotate that key.
- **A single vendor bug is survivable** if the signers come from different vendors.
- **Every transaction gets a second review.** You propose on device 1 and check the decoded transaction again on device 2 before it executes. That second look is exactly the step that catches blind-signing mistakes.

Why 2-of-3 rather than 2-of-2 or 3-of-3: with 2-of-2, losing either key freezes the funds forever, so you have swapped theft risk for loss risk. 2-of-3 tolerates **one lost key *and* one compromised key.** That is the right balance for a solo, long-term holder.

---

## The setup I would actually use

**Safe (v1.4.1, audited, battle-tested; Safe Singleton `0x41675C099F32341bf84BFc5382aF534df5C7461a`) with 3 owners and threshold 2. Every owner is controlled by you:**

| Owner | Device | Stored at | Role |
|---|---|---|---|
| 1 | **Ledger** (the one you already have) | Home, in daily-ish reach | Primary signer |
| 2 | **Hardware wallet from a different vendor** (e.g. Trezor, Keystone, or GridPlus) | Home or office, separate from #1 | Co-signer |
| 3 | **Third hardware wallet or an air-gapped signer**, also a different seed | **Off-site**: a bank safe-deposit box or another property you control | Recovery / backup signer |

Rules that make this work:

1. **Three independently generated seeds.** Never derive them from one master seed, and never reuse a seed across devices. One seed behind all three would put you back at a single point of failure.
2. **Geographic separation of the seed backups.** No single place (burglary, fire, flood) should hold two of the three seeds. Metal backups are better than paper. Optionally add a BIP39 passphrase to each.
3. **Different vendors for at least two signers.** Then one firmware or supply-chain flaw can't produce two signatures.
4. **Verify on the device before signing.** Check the Safe transaction hash and the decoded calldata on the hardware screen, and on the second signer check them again independently. Never approve something you can't read.
5. **Send a test transaction first.** Deploy the Safe, send a small amount in, then do a full withdrawal flow with each pair of keys (1+2, 1+3, 2+3) before moving the $250k. Confirm that every combination works.
6. **Write a recovery runbook.** Record the Safe address, the chain(s), the owner addresses, and how to sign without the Safe web UI (e.g. `safe-cli`, or a self-hosted UI). Store it with the off-site key, without any seeds in it. Then you are not dependent on app.safe.global being online.
7. **Keep it on one chain**, mainnet or a single well-established L2. Remember that a Safe address on another chain is not automatically the same Safe with the same owners.
8. **No hot keys in the owner set.** You move funds only occasionally, so convenience is worth giving up. For regular spending, withdraw a limited amount to a separate everyday wallet, and never let the treasury sign dapp interactions directly.
9. **Optional: add a timelock or delay module** (e.g. Zodiac Delay) so that even a valid 2-of-3 transaction waits N hours, and you can cancel it if it wasn't you. This is especially useful against coercion.

On estate/incapacity: you said you won't bring in a co-signer, and this setup respects that. Note, though, that if you are ever permanently unavailable, nobody can recover these funds. If that matters, a sealed recovery letter (instructions only, pointing to the off-site key) is one option. It gives someone a way to recover the funds without making them a signer.

---

## Summary

| | One Ledger | 2-of-3 Safe (all your keys) |
|---|---|---|
| Secrets an attacker needs | **1** (seed *or* one bad signature) | **2 independent** |
| Stolen seed backup | Total loss | Nothing moves; you rotate the key |
| One device lost / broken + backup lost | Total loss | Recover with the remaining 2 and rotate |
| Blind-signing / phishing mistake | Executes immediately | Needs a second independent confirmation |
| Vendor / firmware flaw | Total exposure | Contained if the vendors differ |
| Needs a second person? | No | **No** |
| Cost | ~$0 | ~3 hardware wallets plus a small deployment gas fee; a bit more friction per (rare) transaction |

Your teammate is right that a hardware wallet is the gold standard **for holding one key**. For $250k held long-term, the gold standard is **not relying on one key at all**. Keep the Ledger as one of three owners of a 2-of-3 Safe that you fully control. The friction goes up a little, on transactions you rarely make. What an attacker has to compromise goes from *one thing* to *two independent things in two different places*.

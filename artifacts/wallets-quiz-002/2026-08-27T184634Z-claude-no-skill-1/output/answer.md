# Custody for ~$250k, solo, long-haul

**Short answer: I can't sign off on the plan as stated.** Your teammate is right that a
hardware wallet is a necessary component — keep the Ledger, it's one of the keys below.
They're wrong that "one Ledger" is a complete plan, and wrong that "nothing is more
secure." A hardware wallet hardens exactly one link in the chain: it stops a compromised
laptop from reading your private key. It does nothing about the other four ways this
money actually gets lost.

The single biggest misconception embedded in the plan — and in your framing of the
question — is this:

> **Multisig is not multi-person. It's multi-key.** You can be the only human on earth
> who touches this treasury and still run 2-of-3. "I have no second person to co-sign"
> is not a reason to run 1-of-1.

That one correction changes the whole design.

---

## 1. Why one Ledger is a 1-of-1 (an OR-gate over every failure mode)

With everything on a single device, an attacker — or bad luck — needs to win **any one**
of the following. Not all. Any one:

| Path | What it takes | Does the Ledger stop it? |
|---|---|---|
| **Seed backup theft** | Read your 24 words once — off the steel plate, the paper in the safe, a photo, a "temporary" note in a password manager or cloud backup. No device needed. | **No.** The seed *is* the money. |
| **Malicious signature** | Get you to approve one transaction: an `approve`/`permit` for unlimited USDC, a `setApprovalForAll`, or a `delegatecall` you can't read on a 128×64 pixel screen. Delivered via a spoofed dApp frontend, a poisoned npm dependency, or an address-poisoning lookalike in your history. | **Barely.** It shows you *something*, but complex calldata is effectively blind signing. This is how most well-defended people actually lose funds. |
| **Device + PIN** | Physical theft plus your PIN. The PIN wipes after 3 tries, so this is the hardest path — unless you're present. | Partly. |
| **Coercion** | Five minutes and a willingness to be unpleasant. You are the sole signer and everyone who knows you build in crypto knows it. | **No.** |
| **Vendor / firmware trust** | A firmware bug, a supply-chain compromise, or a vendor decision. Ledger's firmware is closed-source, and Ledger Recover demonstrated that the architecture *permits* a signed firmware update to export seed material. You are trusting one company. | **No — it *is* the trust assumption.** |
| **Loss / destruction** | House fire that gets device and backup, a botched move, a relative who "tidied up," you being hit by a bus with no documented recovery. | **No.** |

Six independent paths, each of which alone costs you **100% of $250k**. Redundancy is
zero. That's not a gold standard; that's a single point of failure with a nice screen.

Also worth naming: the real-world losses of the last few years were mostly not "someone
extracted a key from a hardware wallet." They were people *correctly* using hardware
wallets to sign transactions that weren't what they thought they were. The Ledger
Connect Kit npm compromise (Dec 2023) drained users whose keys were never touched.
Bybit (Feb 2025, ~$1.5B) had a multisig *and* hardware wallets, and lost anyway because
every signer verified against the same compromised interface. Key storage is one layer.
Signing integrity, backup hygiene, and recovery are the others.

---

## 2. What I'd actually run

Assumption: EVM assets (stablecoins / ETH). If it's Bitcoin, see §6 — same structure,
different tooling. If it's split, run both; don't try to unify.

### Tier 1 — Vault: Safe (Gnosis Safe) 2-of-3 on Ethereum mainnet, ~95% of funds

Three keys, all yours, deliberately **decorrelated**:

| Signer | Device | Where it lives | Role |
|---|---|---|---|
| **A** | Your existing **Ledger** (Nano X / Stax) | Home, in a safe | Daily-driver signer |
| **B** | **Different vendor** — Trezor Safe 5, or Keystone 3 Pro (air-gapped, QR-only, no USB/BT) | Home, *different* room/container, or office | Second signer for normal moves |
| **C** | Third device, or a metal-backed seed generated offline | **Offsite**: bank safe-deposit box in a different building, or with your lawyer | Recovery only. Never used in normal ops. |

- **Threshold 2-of-3.** Lose any one key entirely → you still control the funds and can
  rotate to a fresh set. Attacker gets any one key → they get nothing.
- **Different vendors is not paranoia, it's the entire point.** Three Ledgers is not a
  2-of-3; it's a 1-of-1 against a Ledger firmware/supply-chain/RNG failure. The quorum
  only buys you anything if the keys fail *independently*.
- **Seed backups on steel**, each stored apart from its own device, and never in a
  configuration where one location yields a quorum. Rule: *no single physical location
  should contain two of the three keys or their backups.*
- **Generate each seed on its own device, offline.** Never type a seed into a computer,
  never generate all three in one session on one machine — that recorrelates them.

### Tier 2 — Ops wallet: a separate 1-of-1 EOA, $1–5k float

Gas, tests, and **every** dApp connection. The vault signers never touch a website you
didn't build. If you need to interact with a protocol, you do it from here first, at
small size, and only then consider whether the vault does it at all.

### Tier 3 — Optional: Zodiac Delay Modifier on the vault (24–48h)

Every vault transaction must be queued and sit for a day or two before it can execute,
and you can cancel during the window. Since you move funds "only occasionally," the
friction costs you almost nothing and it converts a silent theft into an alarm you can
respond to — it defends the one thing multisig alone doesn't (you approving a bad
transaction on both devices).

Caveat, stated honestly: a misconfigured module can brick access. Add it **after** the
Safe is live and tested, with a rehearsed cancel-and-execute drill, or skip it. Don't
add complexity you haven't practiced.

### Non-negotiable operating rules

1. **Verify the `safeTxHash` and domain separator on the device screen**, not in the
   browser. Use `safe-tx-hashes-util` (or equivalent) to compute it independently.
2. **Sign the two signatures from two different machines / interfaces** — e.g. one via
   Safe{Wallet}, one via a locally-hosted Safe UI or CLI. Because you are one human, a
   compromised laptop or a compromised frontend is a *correlated* failure across all
   your keys. Splitting the verification path is how you break that correlation. This is
   precisely the control Bybit lacked.
3. **Destination allowlist.** Maintain a short list of known-good addresses, verified
   through a second channel, and check the full address on the device — first and last
   four characters is exactly what address-poisoning defeats.
4. **Never assume your Safe address exists on another chain.** Safe addresses are not
   universally replayable; sending to "the same address" on a chain where you haven't
   deployed can be unrecoverable, or worse, controlled by someone else.
5. **Don't advertise the setup, the amounts, or where the keys are.** With 2-of-3 and one
   key genuinely offsite in a bank box, coercion at your home yields at most one key —
   and you can say so truthfully.

### Two more things a solo setup has to solve

- **Bus factor.** Solo custody with no documented recovery means the funds die with you.
  Write a sealed recovery document (what the setup is, where the keys are, how to
  restore) held by a lawyer alongside key C. This is not optional at $250k.
- **Concentration.** Consider splitting into two vaults (e.g. $180k deep / $70k warm) so
  that a single quorum compromise or a single mistake doesn't take everything. Also note
  that $250k of a single stablecoin carries issuer/freeze risk that has nothing to do
  with your keys — diversifying the asset is a separate axis from securing the keys.

### Rollout, in order

1. Buy devices **direct from the vendor**, not a marketplace.
2. Generate the three seeds independently, offline. Steel backups.
3. **Restore-drill each seed onto a spare device before funding anything.** An untested
   backup is not a backup. This step catches more real losses than any of the crypto.
4. Deploy the Safe with the three signers, threshold 2.
5. Send $20. Move it out. Then $1,000. Then the rest.
6. Re-drill recovery every 6–12 months, and after any move or device change.

Cost: roughly $250–400 in devices, ~$150 in steel, ~$100/yr for a box, and an afternoon.
Against $250k, that's ~0.2%.

---

## 3. The difference, stated as attacker cost

**One Ledger — attacker needs ONE of:**
> your seed backup **OR** device+PIN **OR** one bad approval from you **OR** a Ledger
> firmware/supply-chain failure **OR** five minutes of coercion **OR** a fire.

Six single points of failure, each worth the full $250k. Recovery from any of them: none.

**2-of-3 decorrelated — attacker needs TWO of:**
> (Ledger, at home, in a safe) **AND** (a different vendor's device, different location,
> different firmware, different supply chain) — *plus*, for the signing-attack path, they
> need you to independently approve the same malicious transaction on **two devices**
> through **two verification paths**, *plus* survive the 24–48h delay window.

And critically, the failure modes that aren't attacks get fixed too: losing one key is a
**recoverable inconvenience** instead of a total loss.

Compressed:

| Threat | One Ledger | 2-of-3, decorrelated |
|---|---|---|
| Seed backup found/read | **Total loss** | Nothing — needs a second key |
| Device stolen | Survivable (PIN) | Survivable, plus you can rotate |
| One device lost/destroyed | **Total loss** | **Recoverable** |
| Malicious tx approved once | **Total loss** | Nothing — second signer must also approve |
| Vendor firmware/supply chain | **Total loss** | Nothing — one vendor is 1 of 3 |
| Coercion at your home | **Total loss** | At most one key; offsite key is out of reach |
| House fire | **Total loss** | **Recoverable** from offsite key |
| You die / incapacitated | **Total loss** | Recoverable via documented offsite key |

The single Ledger is an **OR** over failure modes. The 2-of-3 is an **AND** over
compromises and an **OR** over survivals. That inversion is the whole argument.

---

## 4. What 2-of-3 does *not* fix (be honest about this)

- **You approving the same malicious transaction twice.** If both signatures come from
  the same compromised laptop and the same compromised frontend, the quorum is theater.
  → Mitigated by rule 2 (split verification paths) and the delay module.
- **Correlated seed generation.** All three seeds made in one session on one machine, or
  from one bad entropy source, is a 1-of-1 wearing a costume. → Generate independently,
  on-device, offline.
- **All keys in one house.** Geography is doing real work here; don't skip it for
  convenience.
- **Smart-contract risk.** Safe is the most battle-tested contract wallet there is
  (many tens of billions secured, years of audits), but it is not zero risk, and contract
  accounts occasionally trip up protocols that mishandle EIP-1271. For pure hold-and-
  occasionally-move, this is a good trade. If your treasury needs to interact with lots
  of exotic protocols, do that from the ops wallet.
- **Complexity you don't practice.** The most common way sophisticated setups fail is the
  owner forgetting how to use them. Documentation + drills are part of the design, not an
  afterthought.

---

## 5. If you genuinely won't run a multisig

The minimum acceptable upgrade to the one-Ledger plan, in priority order:

1. **Add a BIP-39 passphrase** (the "25th word"), memorized *and* stored separately from
   the seed — different location, different medium. This turns "found the seed = took
   the money" into "needs seed **and** passphrase." Cheap and large. But understand the
   trade: forget it and the funds are gone forever, with no recovery path. It converts
   theft risk into loss risk.
2. **Split the balance across two independent seeds/devices** so no single compromise
   takes 100%.
3. **Geographically separate the seed backup from the device**, on steel, and drill the
   restore before funding.
4. **Never connect the device to a dApp.** Sends to allowlisted addresses only, verified
   character-by-character on the device screen.

That's strictly worse than 2-of-3 — it has no redundancy against loss, and passphrases
have their own sharp edges — but it's a real improvement over the plan as written.

---

## 6. If this is Bitcoin, not EVM

Same shape, different tools: a **2-of-3 native multisig** built in **Sparrow** or
**Nunchuk**, with three different-vendor signers (e.g. Coldcard Mk4 / Blockstream Jade /
Trezor), using PSBTs and air-gapped signing via SD card or QR.

The one Bitcoin-specific trap: **back up the wallet descriptor / output descriptor (all
three xpubs and the policy), not just the three seeds.** Seeds alone will not let you
reconstruct a multisig wallet. Store a copy of the descriptor with every seed backup —
it's not secret, and without it your keys are useless.

---

## Verdict

Keep the Ledger. Reject "one Ledger." Your teammate optimized a single link — key
storage — and declared the chain secure. For $250k held for years by one person, run a
**2-of-3 Safe with three different-vendor keys in three locations, all yours**, a small
separate ops wallet, split verification paths when signing, a tested restore, and a
documented recovery for the bus case. Optionally a 24–48h delay on the vault.

The constraint you thought was blocking — "no second person" — was never the constraint.
You needed a second *key*.

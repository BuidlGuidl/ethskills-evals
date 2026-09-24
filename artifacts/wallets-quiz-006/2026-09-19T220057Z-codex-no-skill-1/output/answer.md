# Custody review

No: a threshold-1 Safe is not acceptable for an agent custodying about $400k on
Ethereum mainnet.

With the proposed owner set, the agent hot key is a full unilateral treasury
signer. If that key is stolen, phished, leaked from the server, compromised via
CI, or tricked by the agent runtime, the attacker can immediately transfer all
assets, approve spenders, swap into illiquid assets, change Safe settings, add
new owners, remove the hardware-wallet owner, or otherwise take control. The
hardware wallet is only a backup for key loss; it does not reduce the blast
radius of hot-key compromise. Threshold 1 turns the Safe into a single-sig hot
wallet with nicer tooling.

The design I would use for the main treasury Safe is:

- Owner A: agent operational key. This is hot, online, and held in the agent
  execution environment, ideally backed by KMS/HSM/MPC signing with strict access
  controls, logging, and rotation. It should be treated as compromisable.
- Owner B: primary human hardware wallet. This is cold and used only for review
  and signing treasury actions.
- Owner C: independent recovery/admin hardware wallet or institutional signer.
  This is also cold, stored separately from Owner B, and controlled by a different
  trusted person, device, or custody process.
- Threshold: 2 of 3.

Under this design, the agent can do the following on its own:

- Build trades and treasury transactions.
- Simulate them, check policy, and prepare the Safe transaction.
- Submit/propose the transaction to the Safe service or internal queue.
- Add its own signature as one of the two required signatures.
- Execute transactions only after one cold signer has reviewed and co-signed.

The agent cannot do the following on its own:

- Move treasury funds out of the Safe.
- Grant token approvals from the Safe.
- Change the Safe threshold or owner set.
- Enable modules, guards, or fallback handlers.
- Rotate itself back in after removal.
- Drain funds if its hot key is stolen.

If the agent key is stolen, the attacker has only one valid signature out of the
two required. They can propose malicious transactions and sign them, but they
cannot execute them without compromising or socially engineering a cold signer.
The two cold owners can also use their 2-of-3 authority to remove the compromised
agent key, add a fresh agent key, raise or adjust policy, and recover normal
operations without moving funds to an emergency wallet first.

This does reduce full autonomy for the main treasury, but that is the point:
$400k should not be controlled by one online key. If the agent needs autonomous
execution, give it a separate, bounded operating wallet or a tightly permissioned
Safe module with explicit limits, such as allowlisted protocols, max trade size,
daily notional caps, no arbitrary token approvals, no owner/threshold changes,
and automatic revocation paths. The main treasury Safe should remain 2-of-3; the
agent may autonomously operate only within a smaller risk budget, not with
unrestricted authority over the entire treasury.

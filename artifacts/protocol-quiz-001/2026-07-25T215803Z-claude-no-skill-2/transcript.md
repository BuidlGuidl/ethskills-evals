Written to `answer.md`. The short version:

**Build on MPT proofs (`eth_getProof` / EIP-1186) now, behind a swappable proof-format interface, with EIP-7864's binary tree as the planned second implementation. Do not build on Verkle.**

**Where things actually stand.** The decisive evidence is the EIPs repo, not roadmap pages: **EIP-6800** (unified Verkle state tree) and **EIP-7612** (Verkle overlay transition) are both **Stagnant**, while **EIP-7864** (unified binary tree) is the live **Draft** — authored by the same people, Buterin/Ballet/Feist/Hagopian et al. Verkle lost on two counts: its IPA/Banderwagon commitments aren't post-quantum (guaranteeing a second conversion later), and vector commitments are expensive *in*-circuit, which is backwards for the L1-zkEVM program that motivates the whole rework.

Worth flagging: `ethereum.org/roadmap/verkle-trees/` still presents Verkle as the plan, and a large share of 2026 news coverage claims Verkle is coming in Hegotá. That's stale — I called it out explicitly in the doc.

**The timing caveat, which is the real constraint.** Fusaka shipped. Glamsterdam's headliners are ePBS (7732) and BALs (7928) — no state-tree change. Hegotá's leading headliner is FOCIL (7805). Beyond scheduling, EIP-7864 itself says in bold **"Do not assume BLAKE3 is a final decision"** — the hash function is still open between BLAKE3/Keccak/Poseidon2, pending an EF security review, and that choice changes your address→key derivation. The conversion mechanism also has no landed binary-tree spec. So: MPT is your production format through at least 2027; treat the binary tree as a migration on 6–12 months' notice, not a foundation.

**The architectural point I'd emphasize most.** Spend your effort on the *anchor* — beacon sync-committee → authenticated header → `ExecutionPayloadHeader.state_root` — because that layer survives every tree change; the tree proof is the swappable part. Three concrete traps in the doc: don't expose `storageHash` in your API (it vanishes when accounts and storage merge into one tree), make any on-chain verifier upgradeable (EIP-7864 states outright that in-EVM proofs of historical state stop working), and version every cached proof by `(format, block)`.

I should note the honesty caveat I put in the threat-model section: sync-committee light-client security is a 512-validator honest-majority assumption plus weak subjectivity — meaningfully weaker than full validation, so "trust-minimized" is the accurate claim rather than "trustless."

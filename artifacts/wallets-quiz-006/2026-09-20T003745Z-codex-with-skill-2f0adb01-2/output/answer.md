# Custody Review

Threshold 1 is not acceptable for an agent custodying about $400k on Ethereum mainnet.

The proposed Safe has two owners, but with a threshold of 1 it does not meaningfully protect the treasury from the agent key being compromised. The agent's hot key can execute any transaction by itself: transfer all assets out, approve malicious spenders, change Safe owners, change the threshold, enable modules, or otherwise take over the account. The hardware wallet is useful only if the agent key is lost while still uncompromised. It is not a security control against theft, because an attacker with the agent key does not need the hardware wallet.

Safe's threshold is the minimum number of owner approvals needed to execute a transaction, and Safe's own setup guidance recommends using a threshold higher than 1 so no single account can execute alone:

- https://docs.safe.global/advanced/smart-account-concepts
- https://help.safe.global/articles/1038062742-what-safe-setup-should-i-use

## Recommended Setup

Use a 2-of-3 Safe for the treasury.

Owners:

1. Agent signer: hot key, held only in the production agent environment. Ideally this is in a cloud KMS, HSM, TEE-backed signer, or encrypted keystore with strict access controls and audit logging. It should not be a plaintext `.env` private key and should never be committed, logged, pasted into chat, or stored in the repo.
2. Operator signer: human-controlled hardware wallet used for regular approvals. This is the day-to-day human co-signer.
3. Recovery signer: separate cold hardware wallet or institutional custody/MPC signer, kept offline and physically separate from the operator signer. This exists for recovery and emergency rotation, not daily trading.

Threshold:

- 2 of 3.

Under this design, the agent key is useful but not sovereign. The agent can prepare transactions, simulate them, propose them to the Safe, and add its signature. It cannot execute treasury transactions by itself. A transaction spending treasury funds, changing token approvals, modifying Safe owners, changing the threshold, or enabling modules needs one additional owner signature.

The operator signer plus agent signer can execute normal approved operations. The operator signer plus recovery signer can remove or replace the agent if the agent key is lost or suspected compromised. The agent signer plus recovery signer can also recover if the operator signer is unavailable, assuming the recovery signer is intentionally brought online.

## What This Buys If The Agent Key Is Stolen

If the agent key is stolen in the proposed 1-of-2, threshold-1 design, the treasury is effectively gone unless detection and response beat the attacker onchain. The attacker can act immediately and independently.

In the recommended 2-of-3 design, stealing the agent key alone is not enough to move funds. The attacker can propose malicious transactions and provide one valid signature, but cannot execute them without compromising either the operator hardware wallet or the recovery signer. The remaining human-controlled owners can use a 2-of-3 transaction, signed by the operator and recovery keys, to remove the compromised agent key, rotate credentials, revoke unsafe approvals, and move funds to a fresh Safe if needed.

This changes the failure mode from "one hot key compromise drains the treasury" to "one hot key compromise creates an incident requiring key rotation." That is the correct posture for a $400k treasury.

## Agent Autonomy

With this treasury Safe, the agent can do these things on its own:

- Monitor markets and balances.
- Construct trades and transaction payloads.
- Run simulations and risk checks.
- Propose Safe transactions.
- Add the agent signature as one of the two required approvals.
- Operate a separate low-balance execution wallet, if funded for limited autonomous trading.

The agent cannot do these things on its own:

- Move funds out of the treasury Safe.
- Execute trades directly from the treasury Safe.
- Grant or increase token approvals from the treasury Safe.
- Add, remove, or replace Safe owners.
- Lower the threshold.
- Enable Safe modules or guards.
- Upgrade or otherwise reconfigure custody controls.

If the trading strategy truly needs unattended execution, do not solve that by making the whole treasury 1-of-N. Instead, keep the treasury Safe at 2-of-3 and give the agent a constrained operating path: a smaller hot wallet balance, capped periodic refill, token and venue allowlists, per-trade and per-day limits, and ideally a Safe module or guard that enforces those limits onchain. The treasury can then replenish or adjust limits with 2-of-3 approval, while the agent can still trade within a bounded loss budget.

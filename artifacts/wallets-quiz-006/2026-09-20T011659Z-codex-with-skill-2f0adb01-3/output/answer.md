Threshold 1 is not acceptable for an agent custodying about $400k on Ethereum mainnet.

With the proposed 1-of-2 Safe, the agent hot key is effectively a $400k single-signature wallet. The hardware wallet is only a recovery key if the agent key is lost; it does not protect the treasury if the agent key is stolen, the agent runtime is compromised, the trading code is exploited, or the agent is socially/prompt-injected into signing a bad transaction. In all of those cases, the attacker can execute immediately with the agent key alone.

I would use a 2-of-3 Safe:

- Owner 1: agent execution key, hot, dedicated only to this agent. Store it in the strongest practical online signing environment, such as a cloud KMS/HSM, TEE-backed signer, or encrypted keystore on hardened infrastructure. It should not be a raw private key in source, logs, chat, CI variables, or an unencrypted `.env` file.
- Owner 2: operator/human approval key, warm or hardware-backed. This can live on a separate device used for routine co-signing of agent-proposed transactions. It should not be on the same host or cloud account as the agent.
- Owner 3: recovery key, cold hardware wallet or offline custody setup. This key is not used for normal trading. It exists to recover from lost or compromised keys and to rotate owners.

Threshold: 2.

Under this design, the agent can prepare, simulate, batch, and propose trades on its own. It can sign as one Safe owner. It can also execute a transaction after a second owner has signed. What it cannot do on its own is move treasury funds, change Safe owners, lower the threshold, grant token approvals, upgrade modules/guards, or perform any other Safe transaction requiring threshold approval.

This buys a lot if the agent key is stolen. A thief with only the agent hot key has one signature, not control of the Safe. They cannot drain the treasury or approve spenders by themselves. The human can use the two human-controlled keys, or the operator key plus recovery key, to remove the compromised agent owner, add a fresh agent key, revoke dangerous approvals if any were created elsewhere, and continue operating. The agent key compromise becomes an incident and rotation event instead of an immediate total-loss event.

The tradeoff is that fully autonomous treasury movement is intentionally not allowed. For $400k, that is the right tradeoff. If the agent needs unattended operation, I would give it a separate limited hot wallet or constrained smart-account/session-key path with capped balances, per-asset limits, allowlisted protocols, and daily spend limits. The main treasury Safe should remain 2-of-3 so that compromise of one online agent key is not enough to move the treasury.

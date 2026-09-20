# Custody review

No: a 1-of-2 Safe is not acceptable for an agent custodying about $400k on Ethereum mainnet.

With threshold 1, the agent hot key is effectively a single-key treasury wallet. Calling it a Safe does not change the authority model: if the agent key is stolen, compromised by its runtime, tricked into signing, or exposed through logs/secrets handling, the attacker can move the full treasury without touching the hardware wallet. The hardware wallet is only a backup for key loss, not a control against theft or misuse.

## Recommended owner set

I would use a 2-of-3 Safe for the main treasury:

- Owner 1: agent signer, hot. This key lives online in the agent signing environment, ideally behind KMS/HSM-style controls, with monitoring and no reusable plaintext private key on disk. It is allowed to participate in treasury actions but cannot satisfy the Safe threshold alone.
- Owner 2: primary human hardware wallet, cold or warm-cold. This is your normal human approval key, used only after reviewing transaction details.
- Owner 3: backup human/recovery hardware wallet, cold. This should be on a separate device, with its seed stored separately from Owner 2, ideally in a different secure physical location. It exists for recovery, key rotation, and emergency removal of the agent key.

Threshold: 2-of-3.

This preserves useful liveness:

- Agent key + primary human key can execute an approved treasury action.
- Primary human key + backup human key can rotate, pause, or remove the agent key without the agent cooperating.
- Agent key alone cannot move the treasury.
- One lost key does not strand the funds.

## What the agent can do on its own

Under this design, the agent cannot unilaterally move the main $400k treasury, change owners, lower the threshold, raise its own authority, or grant itself unlimited allowances. Those operations require a second signer.

If the agent needs unattended trading, give it a separate bounded operating capacity rather than full treasury authority. For example:

- a small hot wallet funded with only the amount you are willing to lose;
- a Safe module or allowance with strict per-transaction and daily limits;
- protocol and token allowlists;
- no permission for owner changes, threshold changes, module installation, or limit increases without 2-of-3 Safe approval.

The exact float depends on your risk tolerance and strategy, but it should be materially less than the full treasury. The main rule is: the agent may autonomously risk only the pre-approved operating amount, not the entire $400k.

## What this buys if the agent key is stolen

If the agent hot key is stolen in the proposed 1-of-2, the attacker can drain the Safe immediately.

If the agent hot key is stolen in the 2-of-3 design, the attacker has only one signer. They cannot move main treasury funds, change the Safe configuration, remove human owners, lower the threshold, or increase the agent's limits. The human owners can use the two hardware wallets to remove the compromised agent key and replace it.

The remaining exposure is the bounded operating capacity already delegated to the agent. That is the loss budget. This is the right shape for an autonomous trading agent: it can act without a human inside a defined sandbox, while the treasury principal and governance of the custody setup stay behind human-controlled threshold approval.

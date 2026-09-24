The proposed design is not acceptable for about $400k of mainnet treasury funds.

A Safe with owners `agent hot key` and `hardware wallet`, threshold `1`, is not really a multisig for security purposes. It is two independent single-signature wallets attached to the same treasury. If the agent's hot key is stolen, the attacker can execute any Safe transaction by themselves: drain the treasury, swap into bad assets, enable a malicious module, change the owner set, remove the hardware wallet, or change the threshold. The hardware wallet is only a recovery path if the agent key is lost; it does not protect the funds if the agent key is compromised.

I would not let an unattended agent key be sufficient to control the full treasury. I would use this owner set for the treasury Safe:

- Owner 1: agent signing key, hot. This lives in the agent runtime or signing service, ideally in KMS/HSM-backed infrastructure with logging, rate limits, and no raw key export, but it is still treated as compromiseable.
- Owner 2: primary human hardware wallet, cold. This is used for approvals of treasury-level actions.
- Owner 3: backup human hardware wallet, cold. This should be on a separate device/seed, stored separately from Owner 2, and used for recovery, rotation, and emergency actions.

Threshold: `2 of 3`.

Under that design, the agent cannot move the $400k treasury on its own. It can prepare transactions, simulate them, propose them to the Safe, and sign as one of the two required signers. Execution of treasury-level actions requires either:

- agent hot key + one human hardware wallet, or
- both human hardware wallets.

That means if the agent key is stolen, the attacker has only one signer. They cannot drain funds, change owners, lower the threshold, enable modules, or raise their own authority without a human signer. The two human hardware wallets can also remove and rotate the compromised agent key without needing cooperation from the agent key.

To preserve autonomy, I would give the agent a separate, bounded operating capacity instead of custody over the whole treasury. For example, the treasury Safe can fund an agent trading account, agent Safe, or guarded Safe module with only the amount you are willing to lose in a hot-key compromise. That amount should be an explicit risk limit, not the whole $400k. The agent may be allowed to trade, rebalance, or execute allowlisted strategies within that bounded float or allowance, possibly with per-transaction and daily limits. It should not be able to move principal, increase its own limits, change the treasury Safe's signer set, change the threshold, enable new modules, approve arbitrary spenders over the treasury, or withdraw the whole treasury without the Safe threshold.

So my recommended design is: keep the main treasury behind a `2 of 3` Safe where the agent alone cannot satisfy the threshold, and give the agent only a capped hot wallet/module/allowance for autonomous trading. The tradeoff is intentional: the agent can act on its own only with funds you have pre-risked; human approval is required for anything that can endanger the treasury principal or expand the agent's authority.

# Custody review

No: a `1-of-2` Safe is not acceptable for an agent custodying about $400k on
Ethereum mainnet.

With threshold `1`, the Safe is only as secure as the weakest single owner. The
agent hot key can drain the whole treasury by itself, so theft of that key is
equivalent to theft of the treasury. The hardware wallet does not meaningfully
reduce that risk; it is only a backup path if the agent key is lost. It also
becomes another independent full-control key: if the hardware wallet workflow is
compromised or the owner signs the wrong transaction, the Safe can still be
drained with no second check.

For this amount, I would separate "treasury custody" from "agent execution."

## Recommended Safe owner set

Use the main treasury Safe as a `2-of-3`:

1. Agent signer: hot key, online, held in hardened infrastructure such as a KMS,
   HSM-backed signer, or isolated signing service. It should not be an ordinary
   private key sitting on the trading box.
2. Primary human signer: hardware wallet, cold, controlled by the treasury owner
   and used only after reviewing the exact transaction.
3. Recovery / second human signer: separate hardware wallet, cold, ideally held
   by a different trusted person or stored in a physically separate place.

Threshold: `2`.

This gives three useful signing combinations:

- Agent + human: normal operation for material treasury actions.
- Human + recovery human: recover if the agent key is lost, rotate owners, pause
  the system, or move funds without relying on the agent.
- Agent + recovery human: emergency operation if the primary human signer is
  unavailable.

The agent hot key must not be able to change the owner set, lower the threshold,
enable modules, approve token spenders, or transfer treasury assets by itself.
Those actions should require the Safe threshold.

## What this buys if the agent key is stolen

If the agent key is stolen under the proposed `2-of-3`, the attacker has only
one signature. They cannot unilaterally drain ETH or tokens from the Safe, add a
new owner, lower the threshold, install a malicious module, or grant unlimited
token approvals. The cold signers can use the two hardware-wallet signatures to
rotate the compromised agent key out of the Safe and move funds if needed.

That is the key difference from the draft. In the draft `1-of-2`, stolen agent
key means immediate full loss. In the recommended design, stolen agent key means
an incident and key rotation, not automatic treasury loss.

## What the agent can and cannot do alone

Under the treasury Safe design, the agent can do these things on its own:

- Monitor markets and balances.
- Construct proposed trades and Safe transactions.
- Sign its own leg of a Safe transaction.
- Submit a transaction after another owner has also signed it.
- Operate with funds that have intentionally been moved to a smaller hot trading
  wallet or bounded execution module.

The agent cannot do these things on its own:

- Move the main $400k treasury.
- Drain assets to an arbitrary address.
- Make arbitrary token approvals from the treasury Safe.
- Change Safe owners or threshold.
- Install or disable Safe modules or guards.
- Recover from or hide compromise by rotating custody settings.

If the agent truly needs autonomous trading, give it a limited operating
budget, not unilateral control over the whole treasury. For example, the
`2-of-3` treasury Safe can periodically fund a separate hot trading account or
module with a capped balance and strict permissions: approved venues only,
approved tokens only, max trade size, daily loss / transfer limits, and no
arbitrary external calls. Refill that operating wallet only through the `2-of-3`
treasury Safe.

That preserves the point of the agent while limiting the blast radius. The agent
can trade within a defined sandbox, but compromising the agent key should not be
enough to steal the whole treasury.

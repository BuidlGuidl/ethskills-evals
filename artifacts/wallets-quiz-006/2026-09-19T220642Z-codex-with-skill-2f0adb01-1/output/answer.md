# Custody Design Review

Threshold 1 is not acceptable for an agent custodying about $400k on Ethereum
mainnet.

The proposed Safe has two owners, but with a threshold of 1 it behaves like a
single-signer wallet for the agent path. The agent hot key can execute any Safe
transaction by itself: transfer all funds, approve unlimited token allowances,
enable a malicious module, change owners, lower operational controls, or move
assets into contracts we did not intend to trust. The hardware wallet is only a
lost-key recovery mechanism in this design. It does not protect the treasury if
the agent key is stolen, because the attacker already has enough signing power
to act alone.

For $400k, I would separate treasury control from agent autonomy.

## Recommended Design

Use a treasury Safe with a 2-of-3 owner threshold:

1. Owner A: primary human hardware wallet.
   - Cold or warm-cold signer.
   - Used for normal administrative approvals from a hardware wallet through the
     Safe UI or a similarly reviewed signing flow.

2. Owner B: second human hardware wallet or second trusted human signer.
   - Cold signer, stored separately from Owner A.
   - Ideally controlled by a different person, or at minimum a different device
     and seed stored in a different physical location.

3. Owner C: recovery hardware wallet or institutional custody signer.
   - Cold recovery signer.
   - Used when one normal signer is unavailable or compromised.

Threshold: 2.

The agent's hot key should not be an unrestricted owner of the treasury Safe. It
should be a limited delegate, for example through a Safe allowance/spending-limit
module, a guard-restricted module, or a separate trading Safe funded from the
treasury. The exact limit should be sized to the strategy's real operational
need, not the total treasury. For example: a per-token daily or per-epoch budget,
venue allowlist, maximum slippage, permitted function selectors, and no
`delegatecall` unless there is a very specific audited reason.

If you insist that the agent key must be a Safe owner, then the minimum I would
accept is 2-of-3 with:

- Owner A: agent hot key, in a locked-down production runtime or KMS-backed
  signer.
- Owner B: primary human hardware wallet.
- Owner C: recovery hardware wallet or second human hardware wallet.
- Threshold: 2.

But I prefer the first design: 2-of-3 human/cold owners, with the agent as a
limited spender rather than a treasury owner.

## Where The Keys Live

The agent key is hot because it must sign autonomously. It should live in a
dedicated production signing environment, ideally KMS/HSM-backed or otherwise
isolated from the application server, with no plaintext private key in source,
logs, environment dumps, CI, or shell history. It should be a dedicated key used
only for this agent.

The human owner keys are cold or warm-cold hardware wallet keys. They should not
be imported into software wallets. Their job is to approve treasury-level actions
and rotate or disable the agent if needed.

The recovery key is cold, geographically and operationally separate from the
primary signer. It should be tested before funding the Safe, but not used in
day-to-day trading.

## What The Agent Can Do Alone

Under the recommended design, the agent can act alone only inside the explicit
permission envelope granted to it. For example, it can:

- Trade or transfer approved tokens up to the configured spending limit.
- Interact only with allowlisted venues/contracts.
- Execute only approved operation types and function selectors.
- Spend only during the configured reset period or within the configured quota.
- Pay gas from its own account or through the approved module flow.

The agent cannot, on its own:

- Drain the full $400k treasury.
- Transfer arbitrary treasury assets outside its limit.
- Change the Safe threshold.
- Add or remove Safe owners.
- Enable or disable Safe modules.
- Upgrade or replace the custody policy.
- Grant unlimited token approvals from the treasury.
- Bypass the allowlist, rate limit, or trading policy.
- Recover itself after key loss.

Any action outside the agent's bounded authority requires 2-of-3 owner approval.

## What This Buys Us If The Agent Key Is Stolen

With the PR design, a stolen agent key is a treasury compromise. The attacker can
execute immediately because threshold 1 gives that key full authority.

With the recommended design, a stolen agent key is an incident, not necessarily
a total loss. The attacker can at most use the agent's delegated allowance or
permitted trading envelope. They cannot use that key to change ownership, lower
the threshold, disable controls, or move the full treasury.

The human owners can respond by using 2-of-3 cold signer approval to:

- Revoke the agent's allowance or module permission.
- Rotate to a new agent key.
- Move treasury funds to a fresh Safe if needed.
- Remove any compromised operational configuration.

This design preserves the point of the agent: it can trade without waiting for a
human within predefined risk limits. But it removes the dangerous property of
the draft design: one hot key being able to unilaterally move the entire
treasury.

## Source Notes

Safe's own documentation describes the threshold as the number of owner
confirmations required for a Safe transaction to execute, and notes that Safes
can have thresholds from 1 up to the owner count. Safe also documents modules
and AI-agent spending-limit patterns as a way to enable automated actions while
adding restrictions such as allowances, rate limits, or spending caps.

References:

- https://docs.safe.global/home/glossary
- https://docs.safe.global/advanced/smart-account-concepts
- https://docs.safe.global/advanced/smart-account-modules
- https://docs.safe.global/home/ai-agent-quickstarts/agent-with-spending-limit

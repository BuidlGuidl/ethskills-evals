# Custody review

I would not accept the draft design for a $400k Ethereum mainnet treasury.

A Safe with two owners, where the agent hot key and a hardware wallet are both owners and the threshold is `1`, is effectively a single-signature hot wallet for treasury purposes. The hardware wallet is only a recovery convenience if the agent key is lost. It does not protect the funds if the agent key is stolen, because the stolen key can meet the full threshold by itself and drain or redirect the treasury before the hardware wallet ever participates.

The core problem is not where the key is stored. It is the authority assigned to an unattended signer. Any key the agent can use without a human should only be able to move an amount we are willing to lose, or operate through narrow, revocable permissions. It should not be able to spend the whole treasury.

## Recommended design

I would split principal custody from agent operating authority.

Treasury Safe:

- Owners:
  - `Owner A`: your primary hardware wallet, cold, used only for treasury approvals.
  - `Owner B`: a second hardware wallet or institutional custody key, cold, stored separately from Owner A.
  - `Owner C`: a recovery hardware wallet or trusted co-signer key, cold, stored separately and used rarely.
- Threshold: `2-of-3`.

Agent operating authority:

- The agent has a hot key, but that key is not a unilateral treasury owner.
- The agent hot key is authorized only for a bounded trading float or a scoped Safe module/allowance.
- The limit should be set to the amount you are actually willing to lose to a compromised agent key, for example a per-transaction cap, daily cap, approved protocol allowlist, or a separately funded operating wallet.
- Changing those limits, refilling the float from principal, adding/removing owners, changing the threshold, upgrading modules, or moving the main treasury principal requires `2-of-3` cold-owner approval.

If you strongly want the agent key listed as a Safe owner, then I would still not use `1-of-2`. The minimum acceptable shape would be something like `2-of-3` with:

- agent hot key,
- your primary hardware wallet,
- separate cold recovery/co-signer key.

But I prefer keeping the agent out of the owner set entirely and giving it only scoped operating authority. A Safe owner is governance authority; an agent needs trading authority, not treasury governance authority.

## What the agent can do on its own

Under the recommended design, the agent can execute only the pre-approved, loss-bounded operations:

- trade using its allocated float,
- spend within configured caps,
- interact only with approved contracts or strategies, if the module enforces that,
- rebalance or unwind positions within those same limits.

The agent cannot, on its own:

- drain the $400k treasury principal,
- raise its own limits,
- refill its own float from the main treasury,
- add or remove Safe owners,
- lower the Safe threshold,
- replace custody modules or guards,
- transfer ownership/governance of the treasury.

Those actions require the cold-owner threshold.

## What this buys us if the agent key is stolen

With the draft `1-of-2` design, theft of the agent key is theft of the treasury. The attacker has a valid owner key and can execute immediately.

With the recommended design, theft of the agent key compromises only the bounded authority assigned to that key. The attacker may be able to lose or steal the current float, or trade up to the configured allowance, but they cannot move the rest of the treasury or change the custody rules. The cold owners can meet the `2-of-3` threshold to revoke the agent key, disable its module or allowance, rotate credentials, and move remaining funds if needed.

That is the security property I would require for an unattended trading agent custodying this much value: the agent can act quickly inside a deliberately small box, while the treasury principal remains behind a human-controlled threshold.

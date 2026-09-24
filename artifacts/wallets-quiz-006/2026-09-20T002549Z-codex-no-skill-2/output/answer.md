# Custody Design Review

No, a `1-of-2` Safe where one owner is the agent hot key is not acceptable for an agent custodying about $400k on Ethereum mainnet.

With threshold `1`, the agent key is not just an automation key. It is a full treasury key. If that hot key is stolen, the attacker can execute any Safe transaction by themselves: transfer all assets, approve malicious spenders, swap into illiquid assets, add modules, change owners/threshold if permitted through Safe transactions, or otherwise take effective control before the hardware wallet owner can react. The hardware wallet only helps if the agent key is lost; it does not materially protect the treasury if the agent key is compromised.

Safe's owner threshold should protect the treasury control plane. Automation should be delegated through a constrained path such as a spending-limit module, policy module, or a separately funded trading account, not by making the hot agent key a `1-of-N` owner.

## Recommended Design

Use a treasury Safe with cold human-controlled owners:

- Owner 1: primary operator hardware wallet, kept cold except for approvals.
- Owner 2: backup/recovery hardware wallet, stored separately from Owner 1.
- Owner 3: second trusted human, company officer, institutional signer, or recovery hardware wallet/MPC signer, also cold and geographically/operationally separate.

Set the treasury Safe threshold to `2-of-3`.

Do not make the agent hot key a Safe owner.

Give the agent a separate hot key that lives in production infrastructure, ideally backed by a cloud KMS/HSM-style signer, strict host isolation, monitoring, withdrawal allowlists, and short-lived operational credentials. That key should only be authorized through a constrained mechanism, for example:

- a Safe spending limit for specific tokens with daily/weekly caps;
- an audited module or guard that restricts destinations, protocols, selectors, token approvals, max trade size, slippage, and total value at risk;
- or a separate trading Safe/account funded from the treasury Safe with only the capital the agent is allowed to risk autonomously.

For $400k, I would prefer the last two together: the `2-of-3` cold treasury Safe holds the bulk of funds, and the agent operates a bounded trading account or audited module with a deliberately small working balance/allowance. Humans replenish or change policy with `2-of-3` cold approval.

## What The Agent Can Do Alone

Under this design, the agent can act alone only inside the pre-approved trading envelope.

Examples:

- execute trades against approved venues;
- spend only approved tokens;
- move only up to the configured per-transaction and per-period limits;
- interact only with allowlisted contracts/functions;
- manage positions within the funded trading account or module allowance.

The exact limits should be sized so that losing the entire autonomous allowance is painful but survivable. For a $400k treasury, I would not let the hot key independently access the full treasury balance.

## What The Agent Cannot Do Alone

The agent cannot, by itself:

- drain the treasury Safe;
- transfer arbitrary treasury assets;
- approve arbitrary spenders;
- add or remove Safe owners;
- lower the Safe threshold;
- install or remove modules;
- change its own limits;
- expand the allowlist;
- recover itself after compromise;
- move funds beyond the bounded trading allowance.

Those actions require `2-of-3` cold-owner approval.

## If The Agent Key Is Stolen

With the draft `1-of-2` design, a stolen agent key is a full treasury compromise.

With the recommended design, a stolen agent key is limited to the agent's pre-approved authority. The attacker may be able to burn the remaining allowance, make bad trades within policy, or empty the separately funded trading account. They should not be able to touch the rest of the treasury, alter Safe ownership, install a malicious module, or increase their own permissions.

The cold owners can then use `2-of-3` approval to revoke the module/allowance, rotate the agent key, pause/reconfigure the trading account, and replenish only after the incident is understood.

The core security improvement is that the hot key compromise becomes a capped operational loss instead of a $400k root-key failure.

## References Checked

- Safe docs describe owners and thresholds as the account's multi-signature authorization model: https://github.com/safe-fndn/safe-smart-account/blob/main/contracts/base/OwnerManager.sol
- Safe docs describe modules as extensions that can enable automation and policy-based execution, but warn that modules are security-critical: https://docs.safe.global/advanced/smart-account-modules
- Safe help documents spending limits as a way to let a beneficiary spend limited amounts without regular owner approvals: https://help.safe.global/articles/3961440620-set-up-and-use-spending-limits

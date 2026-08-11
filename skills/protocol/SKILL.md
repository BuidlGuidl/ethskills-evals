---
name: protocol
description: Verify current Ethereum protocol status and fork scope. Use when determining whether a feature is live, planned, scheduled, or under consideration; estimating when it may ship; or making a technical plan that depends on a future protocol change.
---

# Ethereum Protocol Status

Never answer current protocol status or timing from memory. Roadmaps, talks, old articles, and an EIP's maturity status do not prove that a feature will ship.

For every claim about a future Ethereum feature:

1. Check its current fork relationship on [forkcast](https://forkcast.org).
2. Verify the EIP and the named fork's current scope or meta-EIP.
3. Check recent All Core Devs discussion when status or implementation progress is unclear.

Report the result explicitly:

- **Live:** already active on mainnet.
- **SFI:** scheduled for a named fork; still state timing uncertainty.
- **CFI:** considered for a named fork, not committed.
- **DFI:** declined for that fork.
- **No fork relationship:** proposal or research only.

`Draft`, `Review`, `Last Call`, or `Final` describes specification maturity, not fork inclusion. Do not give an unscheduled feature a ship date or recommend a hard dependency on it. Separate what works today from future options, cite the live sources checked, and give a plan that remains valid if the proposal does not ship.

# Privacy review: deposit/withdraw linkability

## Executive summary

Marketing should not say "withdrawals cannot be linked to deposits" for the product as shipped.

The audited cryptography may correctly hide which committed note is being spent, but the current user flow still creates public transaction metadata that can identify the withdrawer. In particular, Alice connects a wallet and directly calls `withdraw(...)`. A chain observer sees the account that submitted the withdrawal transaction, the gas-funding history for that account, the selected Merkle root, the nullifier hash, and the fresh recipient address receiving exactly 1 ETH.

If Alice uses the same wallet that made the deposit, the withdrawal is trivially attributable to Alice's wallet. If that wallet made only one deposit, the observer can link the withdrawal to that deposit in practice, even though the proof itself does not reveal the leaf.

For the marketing claim to be true in the product sense, withdrawals must be submitted without exposing the user's depositing wallet or any wallet funded from it. The product needs a relayer or equivalent gas abstraction flow, careful recipient handling, and a sufficiently large anonymity set.

## What the chain reveals

For each deposit, observers can see:

- the `deposit()` transaction sender;
- the deposited amount, fixed at 1 ETH;
- the block time;
- the inserted commitment;
- any funding path into the depositing wallet.

For each withdrawal, observers can see:

- the transaction sender that called `withdraw(...)`;
- the account that paid gas;
- the `root` selected for the proof;
- the `nullifierHash`;
- the `recipient`;
- the 1 ETH payout to `recipient`;
- the block time;
- future activity from the recipient address.

The zero-knowledge proof hides which commitment under `root` is being spent. It does not hide the transaction sender, gas payer, recipient, amount, timing, or any graph relationships around those addresses.

## What a competent chain observer can infer

### 1. The withdrawal caller is public

The biggest leak is not cryptographic. It is operational.

If Alice calls `withdraw(...)` herself, the caller is on-chain. Anyone can see that Alice's wallet initiated a withdrawal from the pool. The fresh recipient address does not fix this, because the transaction itself says: Alice's wallet asked the contract to send 1 ETH to that recipient.

If Alice's deposit was also made from the same wallet, the link is direct:

- Alice's wallet deposited 1 ETH into the pool.
- Later, Alice's wallet called `withdraw(...)`.
- The withdrawal paid 1 ETH to a new recipient.

In that case, the observer does not need to break the proof. The wallet-level metadata already gives them the answer.

### 2. The selected root bounds the anonymity set

The `root` tells observers which historical tree state the proof used. A withdrawal using a given root can only correspond to a commitment included in that root.

That means deposits after that root are excluded. If the pool is small, the remaining candidate set may be tiny. With a three-person team and fixed 1 ETH notes, the practical anonymity set may be only a handful of deposits.

The proof provides set membership privacy, not magic anonymity. The size and behavior of the set matter.

### 3. Timing still creates probabilities

Even if the caller were hidden, timing can weaken privacy:

- a deposit followed quickly by a withdrawal narrows candidates;
- unusual delays can identify habitual users;
- withdrawals that happen soon after a specific user's app activity, funding activity, or wallet movement can be correlated;
- a small pool with few deposits between Alice's deposit and withdrawal gives weak cover.

Waiting weeks helps, but it is not sufficient if the withdrawal transaction is still sent by Alice or by an account clearly funded by Alice.

### 4. Gas funding can recreate the link

Using a separate withdrawal wallet is not enough if that wallet is funded from Alice's known wallet.

For example:

- Alice deposits from `A`.
- Alice creates withdrawal caller `W`.
- Alice funds `W` from `A` so it can pay gas.
- `W` calls `withdraw(...)` to fresh recipient `R`.

A chain observer can link `A -> W -> withdraw -> R`. The proof remains sound, but the product-level privacy fails.

The same issue appears if `W` is funded through a centralized exchange, bridge, or other source where an observer can reasonably cluster the accounts. This may not be a deterministic on-chain link in every case, but it is enough to make the marketing claim too strong.

### 5. The recipient is fresh, but not private

The recipient being fresh and empty is good hygiene, but it only means the recipient has no prior on-chain history.

Observers still learn that this fresh address received a withdrawal from the pool. They can then track every later transaction from it. If Alice later sends from the recipient to her known wallet, deposits it into an exchange account associated with her, uses it to buy an ENS name, bridges it alongside known funds, or combines it with other linked funds, the withdrawal becomes linkable after the fact.

### 6. The nullifier prevents double-spends, not attribution

The `nullifierHash` lets observers identify that the note has been spent once. It should not reveal the deposit commitment if the scheme is correct.

However, nullifier privacy only protects the note-to-leaf relation. It does not protect against transaction sender analysis, gas analysis, timing analysis, or recipient graph analysis.

## Bottom line for the shipped flow

With the shipped flow, a competent chain observer can determine:

- which wallet submitted the withdrawal;
- which address received the withdrawn ETH;
- that the recipient is linked to the withdrawal transaction;
- which deposits are possible candidates under the selected root;
- whether the withdrawal sender is the same wallet that deposited;
- whether the withdrawal sender was funded by the depositing wallet or another linked wallet;
- probabilistic links based on timing, small anonymity set size, and later recipient behavior.

If Alice deposits and withdraws from the same connected wallet, the observer can say Alice withdrew. If that wallet made a single deposit, they can link the withdrawal to that deposit for all practical purposes.

So the accurate claim for the shipped product is narrower:

> The proof does not reveal which deposit commitment is being withdrawn.

That is materially different from:

> Withdrawals cannot be linked to deposits.

## What has to change

To support the stronger marketing claim, the product needs to prevent address-level metadata from reintroducing the link.

### Required product changes

1. Add relayed withdrawals.

   Users should not submit `withdraw(...)` from their deposit wallet. A relayer should submit the transaction and pay gas. The user's note authorizes the withdrawal, and the relayer receives a fee, ideally paid from the withdrawn amount or otherwise handled without requiring a user-funded withdrawal wallet.

2. Make the note, not the connected wallet, the withdrawal credential.

   The withdrawal page should not require connecting the depositing wallet. Ideally, the user imports or selects the note locally, generates the proof, chooses a recipient, and sends the proof package to a relayer. The depositing wallet should not sign or submit anything during withdrawal.

3. Avoid user-funded withdrawal gas wallets.

   Do not ask users to create a new wallet and fund it from their deposit wallet for gas. That simply moves the link to the funding edge.

4. Enforce recipient hygiene in the UX.

   The recipient should be fresh, unused, and not funded before withdrawal. The app should warn users that later combining funds, sending to known wallets, or using identifiable services can destroy privacy retroactively.

5. Grow and communicate the anonymity set.

   The app should show the effective anonymity set for the selected root or pool. If only a few notes exist, the product should not imply strong unlinkability. Consider minimum pool depth, withdrawal delays, batching, or warnings when the candidate set is small.

6. Be precise about roots.

   Prefer roots that include a large set of deposits, and avoid UX that accidentally causes users to prove against a root with a tiny candidate set. The root choice should not unnecessarily exclude plausible decoys.

### Optional but useful improvements

- Support multiple independent relayers so one relayer cannot become a single off-chain observer of all withdrawals.
- Route proof submission over privacy-preserving transport where possible, because relayers and RPC providers can observe IP-level metadata even if the chain does not.
- Avoid app analytics, wallet telemetry, or backend logs that record deposit and withdrawal sessions under the same user identifier.
- Consider pool-level policy such as delayed withdrawals, withdrawal batching, or warnings for low-volume periods.

## Recommended marketing language

Do not use:

> Withdrawals cannot be linked to deposits.

Safer language for the shipped flow:

> The zero-knowledge proof does not reveal which deposited note is being withdrawn.

If relayed withdrawals, gas abstraction, recipient hygiene, and adequate anonymity-set controls are implemented, a stronger but still careful claim would be:

> Withdrawals are designed to avoid revealing which deposit is being spent, provided users withdraw through a relayer and follow recipient hygiene guidance.

Even then, avoid absolute claims. Privacy depends on the anonymity set, wallet funding behavior, timing, RPC/backend metadata, and what the recipient does after receiving funds.

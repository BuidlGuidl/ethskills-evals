# Privacy Review: Private Withdrawals Claim

## Summary

Marketing should not claim that "withdrawals cannot be linked to deposits" for the product as shipped.

The audited cryptography may be correct: the proof can hide which committed note is being spent, and the nullifier can prevent double-withdrawal without revealing the note. But the shipped wallet flow still exposes the withdrawal transaction sender on Ethereum. If Alice deposits from wallet `A` and later connects wallet `A` to call `withdraw(...)`, a chain observer can link Alice's deposit and withdrawal by ordinary transaction analysis, without breaking the circuit.

The more accurate statement today is:

> The zero-knowledge proof does not reveal which deposited commitment is being withdrawn, but users can still be linked by wallet usage, gas funding, timing, root choice, and recipient behavior.

For the stronger marketing claim to hold in a meaningful product sense, withdrawal submission must be separated from the depositor's public wallet identity. That means a relayer or account-abstraction/paymaster flow, a fresh recipient, enough pool liquidity and delay, and UX that prevents users from funding or submitting the withdrawal from a linked wallet.

## Threat Model

Assume a competent chain observer can:

- Read every deposit and withdrawal transaction to the pool contract.
- See `msg.sender` for both `deposit()` and `withdraw(...)`.
- See the public withdrawal arguments: `root`, `nullifierHash`, and `recipient`.
- See the 1 ETH transfer from the pool to `recipient`.
- Reconstruct the onchain Merkle tree from deposit events.
- Track funding flows between wallets, exchanges, relayers, and recipients.
- Cluster wallets using common heuristics: shared funding source, gas top-ups, repeated nonce behavior, timing, address reuse, and later consolidation of funds.

This review does not challenge the verifier, Merkle membership proof, commitment construction, or nullifier soundness. It treats the cryptography as correct and focuses on what remains visible around it.

## What the Observer Can Determine Today

### 1. The withdrawal transaction sender is public

Ethereum exposes the account that submits `withdraw(...)`. In the shipped flow, Alice "connects her wallet" weeks after depositing and sends the withdrawal transaction herself.

If that wallet is the same wallet that called `deposit()`, the observer learns:

- Wallet `A` deposited 1 ETH into the pool.
- Wallet `A` later called `withdraw(...)`.
- The withdrawal paid 1 ETH to `recipient`.
- Therefore wallet `A` almost certainly withdrew one of its own notes.

The observer does not need to identify the hidden Merkle leaf. The public caller already links the user to the withdrawal.

### 2. The recipient is public

The `recipient` argument is calldata. The 1 ETH payout is also visible as a transfer from the pool.

A fresh, empty recipient helps, but only partly. The observer can still label it as "the output address of this withdrawal." If that address later:

- Sends funds back to Alice's known wallet,
- Deposits to the same exchange account Alice uses,
- Pays gas from Alice's wallet,
- Interacts with Alice's other addresses,
- Consolidates funds with other known Alice addresses,

then the withdrawal can be linked after the fact.

### 3. Gas funding can reveal the user even with a different caller

If Alice uses a fresh wallet `B` to call `withdraw(...)`, but funds `B` from her deposit wallet `A`, an observer can connect:

`A -> gas top-up to B -> B calls withdraw -> pool pays recipient`

That is usually enough to link the withdrawal to Alice. A fresh withdrawal caller is not sufficient if the caller needs ETH from a traceable source to pay gas.

### 4. The public root constrains the anonymity set

The proof hides which leaf was spent, but `root` is public. A chain observer can reconstruct which deposits are included in that root.

The candidate set for a withdrawal is not "everyone who has ever deposited." It is closer to:

- Deposits included in the submitted root,
- Excluding notes already spent by known nullifiers,
- Further narrowed by timing, wallet behavior, and operational mistakes.

If the pool is small, a fixed 1 ETH note size does not save the claim. A three-person or low-volume pool may provide only a tiny anonymity set. If Alice deposited at a distinctive time and withdrew soon after, the observer's confidence can be high even if the proof is cryptographically unlinkable.

Using old roots can also shrink the practical anonymity set. A withdrawal proven against an older root excludes later deposits from consideration.

### 5. Timing and usage patterns leak information

Even with fixed 1 ETH notes, timing can be powerful. The observer can compare:

- Deposit time versus withdrawal time,
- Whether users wait similar delays,
- Whether the app's frontend batches or sequences withdrawals predictably,
- Whether the same wallet connects shortly before both actions,
- Whether the withdrawal happens soon after Alice returns to the app,
- Whether recipients move funds in recognizable ways.

The cryptographic statement is "the proof does not reveal the leaf." It is not "all surrounding metadata is private."

### 6. The nullifier prevents double spend; it does not identify the deposit

A correct nullifier scheme lets the contract reject duplicate withdrawals. A high-entropy nullifier hash should not be reversible to the deposit commitment.

So, on the narrow cryptographic question, the observer should not be able to compute "this nullifier came from this commitment" from the proof data alone. The problem is that the product flow gives them easier public signals.

## Bottom Line for the Shipped Flow

If Alice deposits with wallet `A` and later calls `withdraw(...)` from wallet `A`, a competent chain observer can say:

> Wallet `A` deposited into the pool and later initiated a withdrawal that paid `recipient`.

That is enough to link Alice to the withdrawal transaction and its output address. The observer may not know which exact commitment was consumed, but for user privacy and marketing purposes that distinction is too narrow. The user wanted unlinkability between deposit identity and withdrawal identity; the current flow leaks it through `msg.sender`.

## What Has to Change

### 1. Withdrawals must be relayed or sponsored

Alice should not submit the withdrawal transaction from her deposit wallet.

The product needs one of:

- A relayer network that submits `withdraw(...)` on the user's behalf.
- An ERC-4337 account-abstraction flow with a paymaster sponsoring gas.
- Another gasless transaction mechanism where the onchain caller is not funded by, or linkable to, the depositor.

The user should generate the proof locally and send only the proof calldata needed for withdrawal submission. The relayer will still see the requested `recipient`, `root`, and `nullifierHash`, but it should not learn the note secrets.

### 2. The app must prevent linked gas funding

If users are told to create a new wallet and fund it themselves, many will fund it from the deposit wallet. That recreates the link.

The UX should avoid any requirement for the withdrawal caller or recipient to receive gas from the depositor. A fresh payout recipient should receive funds from the pool, not be used as a gas-paying account first.

### 3. Recipients need privacy guidance and guardrails

The recipient address should be freshly generated and unused. The app should discourage or prevent:

- Reusing a wallet that has prior public history.
- Sending withdrawn ETH directly back to the deposit wallet.
- Funding the recipient from the deposit wallet before withdrawal.
- Immediately consolidating outputs in a way that links them to the depositor.

This does not need to be framed as user education only; the product should make the private path the default path.

### 4. The pool needs a meaningful anonymity set

The claim is only credible when many indistinguishable notes can be candidates for each withdrawal.

For a small fixed-denomination mainnet pool, the product should consider:

- Delaying launch claims until the pool has enough deposits.
- Showing users the current anonymity set before withdrawal.
- Avoiding language that implies absolute privacy when only a few deposits exist.
- Encouraging users to wait until more deposits accumulate.
- Being careful with accepted historical roots, since old roots can reduce the candidate set.

Fixed 1 ETH notes help remove amount-based linkage, but they do not create privacy by themselves.

### 5. Avoid app-level telemetry that reintroduces the link

Even if the chain flow is fixed, the app operator can accidentally become the linking party. Be careful with:

- Wallet analytics that log deposit and withdrawal sessions.
- IP addresses tied to note generation or proof submission.
- Relayer APIs that log stable user identifiers.
- Frontend error reporting that captures addresses, notes, nullifiers, or recipients.

The public marketing claim should not be stronger than the privacy properties of the deployed frontend and backend.

## Recommended Marketing Language

Do not use:

> Withdrawals cannot be linked to deposits.

Acceptable only after the product has gasless/relayed withdrawals, unlinkable recipient defaults, and a meaningful anonymity set:

> Withdrawals are designed so the proof does not reveal which deposit is being spent. For best privacy, withdrawals are submitted through a relayer and paid to a fresh address.

For the current shipped flow, a truthful statement would be:

> The zero-knowledge proof hides the deposited note used for a withdrawal, but wallet and transaction metadata may still link users to withdrawals.

## Launch Decision

The cryptography can be sound while the shipped product privacy claim is false.

Before claiming withdrawals cannot be linked to deposits, the product should at minimum:

- Remove same-wallet withdrawal submission from the default flow.
- Add relayed or sponsored withdrawals.
- Ensure the withdrawal caller is not gas-funded by the depositor.
- Default to fresh, unused recipient addresses.
- Warn when the anonymity set is small.
- Avoid backend/frontend logs that correlate deposit and withdrawal sessions.

Until then, a competent chain observer can often determine who withdrew by looking at `msg.sender`, gas funding, recipient behavior, timing, and the public root, even though they cannot break the ZK proof itself.

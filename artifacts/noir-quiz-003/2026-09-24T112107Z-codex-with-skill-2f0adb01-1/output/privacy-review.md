# Privacy Review: Deposit/Withdrawal Linkability

## Executive summary

The launch claim should not ship as written for the current product flow.

The cryptography may hide which Merkle-tree leaf is being spent, but the
withdrawal transaction is still a public Ethereum transaction. If Alice connects
the same wallet she used for `deposit()` and uses it to call
`withdraw(proof, root, nullifierHash, recipient)`, a chain observer can see that
the deposit wallet later submitted a withdrawal transaction. In that case,
"withdrawals cannot be linked to deposits" is false in the way users will care
about most.

A more accurate current claim would be:

> The proof does not reveal which commitment in the selected Merkle root is being
> withdrawn.

That is much narrower than saying withdrawals cannot be linked to deposits.

For the stronger marketing claim to be defensible, withdrawals must be submitted
without revealing the depositor's wallet as `msg.sender`, and the app needs
enough real anonymity-set discipline that timing, root choice, and payout
behavior do not trivially narrow the candidate deposits.

## What is public onchain

For each deposit, an observer can see at least:

- the depositor transaction sender;
- the 1 ETH transfer into the pool;
- the inserted commitment;
- the block number and timestamp;
- the tree position if emitted by the contract;
- the resulting Merkle root if emitted or reconstructable.

For each withdrawal, an observer can see at least:

- the withdrawal transaction sender;
- the `root` used for the proof;
- the `nullifierHash`;
- the `recipient`;
- the 1 ETH payout to `recipient`;
- the block number and timestamp;
- any relayer address, fee, refund, or other public withdrawal fields if present.

The proof, assuming the auditor is right, does not reveal the private note,
Merkle path, leaf index, or commitment. The `nullifierHash` prevents a second
withdrawal of the same note but does not by itself identify the deposit
commitment.

## What a competent chain observer can determine today

### If Alice uses her deposit wallet to withdraw

The observer can determine that Alice's deposit wallet submitted both a deposit
transaction and a withdrawal transaction.

That is already a practical link between Alice and a withdrawal. If Alice made
one deposit, or if the product is understood to be self-service rather than
custodial/relayed, the natural inference is that Alice withdrew her own note.
The cryptographic anonymity set still exists at the proof layer, but the wallet
flow has placed Alice back in the public trace.

The observer can also link Alice's wallet to the fresh recipient operationally:
the withdrawal transaction sent the pool payout to that recipient. The recipient
being fresh means it has no prior history, but after the withdrawal it is no
longer unlinkable from that withdrawal transaction. Any later movement from the
recipient can create more links.

### What the observer cannot determine from the proof alone

If the circuit and verifier are correct, the observer cannot cryptographically
derive which commitment corresponds to the `nullifierHash`.

If the selected `root` contains many eligible deposits, the proof only says:
someone who knows a valid note included under that root authorized this
withdrawal. It does not reveal which leaf was used.

That said, "cannot derive cryptographically" is weaker than "cannot link." A
chain observer does not need to break the proof if the wallet flow, timing, or
recipient behavior gives them the answer.

### Root and timing leakage

The public `root` bounds the candidate deposits. A withdrawal can only correspond
to a commitment included in that root. Depending on the contract's root policy,
that may mean:

- all deposits before the chosen historical root;
- only deposits in the current root at withdrawal time;
- a recent window of accepted roots.

This does not identify the deposit by itself, but it can shrink the anonymity
set. In a small fixed-denomination pool, timing can shrink it further. If only a
few 1 ETH deposits existed before a root, or if Alice deposits and withdraws on
a distinctive schedule, an observer can form a strong probabilistic link without
touching the cryptography.

### Small-pool reality

Fixed 1 ETH notes remove amount-based linking, which is good. But a small pool
still gives weak anonymity. If there are 3 eligible deposits, the best-case
cryptographic anonymity set is only 1 of 3 before applying wallet reuse, timing,
gas funding, RPC metadata, app telemetry, recipient behavior, and clustering.

Marketing should not imply a Tornado-sized anonymity property if the deployed
pool is small or low volume.

## Product changes needed for the claim to hold

### 1. Do not have the depositor wallet call `withdraw`

The withdrawal transaction sender must not be Alice's deposit wallet.

Use a relayer, ERC-4337 paymaster, or another gas-sponsored transaction path so
the public `msg.sender` is not the depositor. The withdrawal flow should be
note-driven, not wallet-driven: Alice imports or selects her note, generates the
proof locally, chooses a recipient, and sends a withdrawal request to a relayer.
The relayer submits the transaction onchain.

This is the central product requirement. Without it, the current claim is not
credible.

### 2. Bind the proof or contract checks to the withdrawal action

The public withdrawal fields that determine value movement should be protected
against substitution. At minimum, the contract/proof design should bind or
otherwise safely enforce:

- `recipient`;
- `relayer`;
- relayer fee;
- refund address, if any;
- chain id and pool contract/domain, if cross-contract replay is otherwise
possible.

If `recipient` is not bound to the proof or authenticated withdrawal request,
a third party that sees the proof could try to submit it with a different
recipient. The exact binding can live in the circuit public inputs or in a
signature/request scheme verified by the contract, but the shipped system needs
an explicit answer.

### 3. Make withdrawal possible from an empty fresh recipient

The recipient should not need ETH before withdrawal. If the fresh address has to
be funded for gas, the funding transaction itself becomes a link. Relayed or
sponsored withdrawal solves this by letting the recipient remain only a payout
address.

### 4. Treat the anonymity set as a product invariant

The app should display or enforce a minimum eligible anonymity set before
encouraging withdrawal. The relevant set is not the total historical deposit
count; it is the set of plausible deposits under the chosen root after obvious
timing and status filters.

Possible policies:

- warn when the root contains too few unspent eligible notes;
- delay withdrawals until enough deposits have accumulated;
- encourage users to wait through multiple deposit epochs;
- avoid UI defaults that pick a root making the user stand out.

### 5. Avoid offchain metadata links

A relayer can reintroduce linkability if it logs IP addresses, wallet
connections, note identifiers, or proof requests in a way that maps Alice to the
withdrawal. The production claim needs an offchain privacy posture too:

- no requirement to connect the deposit wallet during withdrawal;
- no analytics events containing note, commitment, nullifier, or wallet linkage;
- privacy-preserving relayer access, ideally with Tor or similar network-layer
guidance;
- clear retention limits for relayer and frontend logs.

These are not visible to a pure chain observer, but they matter to the truth of
the user-facing claim.

### 6. Warn about recipient aftercare

The fresh recipient only starts fresh. If Alice later sends the withdrawn ETH
back to her known wallet, to a known exchange account, or through a pattern that
clusters with her other addresses, the withdrawal can become linked after the
fact. The product should treat recipient hygiene as part of the withdrawal UX.

## Recommended marketing language

Do not use:

> Withdrawals cannot be linked to deposits.

Acceptable for the current shipped flow:

> The zero-knowledge proof does not reveal which deposited commitment is being
> withdrawn.

Acceptable only after relayed/sponsored withdrawals, action binding, and
minimum-anonymity-set safeguards:

> Withdrawals are designed so that, onchain, the withdrawn note is not linked to
> its deposit within the eligible anonymity set.

Even that stronger claim should be paired with user guidance about timing,
wallet reuse, relayers, and recipient-address behavior.

## Bottom line

The audited circuit gives cryptographic unlinkability between a commitment and a
nullifier. The shipped wallet flow gives the chain a public caller.

If Alice's deposit wallet calls `withdraw`, a competent observer can identify
Alice's wallet as the withdrawer and can often make the deposit/withdrawal link
with high confidence. To make the marketing claim hold, the product must remove
the depositor wallet from the withdrawal transaction path and treat anonymity
set size, root choice, metadata, and recipient hygiene as first-class privacy
requirements.

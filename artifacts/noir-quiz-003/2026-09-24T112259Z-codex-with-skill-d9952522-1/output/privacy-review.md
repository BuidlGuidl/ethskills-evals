# Privacy review: deposit-to-withdrawal unlinkability

## Bottom line

Marketing should not say "withdrawals cannot be linked to deposits" for the
flow as shipped.

The circuit can correctly hide which commitment is being spent, and the
nullifier can correctly prevent double-withdrawal without revealing the note.
That only protects the cryptographic relationship between `root`,
`nullifierHash`, and the committed leaf. It does not hide the public account
that submits the withdrawal transaction.

In the current flow, Alice connects the same wallet she used for `deposit()`
and sends `withdraw(proof, root, nullifierHash, recipient)` herself. A chain
observer sees:

- Alice's wallet called `deposit()` for a 1 ETH note.
- The same wallet later called `withdraw(...)`.
- The withdrawal transaction paid 1 ETH to `recipient`.
- Therefore Alice withdrew a note, and `recipient` is Alice's chosen payout
  address unless there is strong contrary evidence.

So the observer may not know which exact deposited commitment was consumed if
Alice has multiple possible notes in the tree, but they can still attribute the
withdrawal action and recipient to Alice's wallet. For most users, that is the
privacy failure the product is supposed to avoid.

## What a competent chain observer can determine

### From the deposit

The observer can see the depositing address, amount, timestamp, transaction
metadata, and inserted commitment. Because the pool uses fixed 1 ETH notes,
amount correlation is reduced, but the deposit account is still public.

If Alice funds the deposit wallet from a known account or a centralized
exchange withdrawal, that earlier funding trail may also identify her before
the pool is involved.

### From the withdrawal

The observer can see `msg.sender`, `recipient`, the selected `root`, the
`nullifierHash`, gas payer, transaction timing, and payout amount.

The proof does not reveal the committed leaf. However, Ethereum transaction
metadata reveals who submitted the proof. In the shipped flow, `msg.sender` is
Alice's connected wallet. If that wallet previously deposited into this pool,
the observer can link Alice to the withdrawal behavior directly.

The fresh empty recipient address does not fix this. It only avoids prior
history on the recipient. The transaction itself publicly says that Alice's
wallet requested the payout to that address.

### From timing and anonymity set size

Even with a relayer, unlinkability is bounded by the anonymity set. If only one
unspent deposit exists under the withdrawal root, the withdrawal is effectively
linked. If there are only a few plausible deposits, timing, wallet funding
patterns, and user behavior can make the link likely.

Using a root from a tree state near Alice's deposit can also shrink the set of
possible deposits. The withdrawal can only spend a note included in that root,
and any note already spent by a prior nullifier can be removed from the
candidate set.

### From operational metadata

A purely onchain observer may not see browser IPs or RPC logs, but a competent
observer may combine chain data with infrastructure data:

- public RPC provider logs;
- relayer logs, if a relayer is added later;
- frontend analytics;
- wallet connection telemetry;
- exchange deposit and withdrawal records;
- gas funding transactions.

The marketing claim should not rely on these parties behaving perfectly unless
the product design removes or minimizes what they can learn.

## What the cryptography still gives you

The audited circuit still matters. Assuming the audit result is correct, the
contract verifier proves that the withdrawer knows some valid note in the tree
and that its nullifier has not been used before, without revealing the note.

That means a withdrawal can be unlinkable among the eligible unspent deposits
when the transaction sender and surrounding metadata do not identify the owner.
The current product flow fails at that surrounding-metadata layer, not at the
membership proof layer.

## Required product changes

### 1. Do not have the depositor wallet submit its own withdrawal

Withdrawals need to be submitted by an unlinkable transaction sender. Common
options:

- a relayer that accepts the proof and submits `withdraw(...)`;
- an ERC-4337/paymaster flow where the user does not fund or send the
  withdrawal transaction from the deposit wallet;
- another privacy-preserving transaction submission system with equivalent
  properties.

The relayer path is the normal design for this kind of pool. The user generates
the proof locally, chooses the recipient locally, and sends the proof package
to a relayer. The contract should pay the recipient and, if needed, compensate
the relayer without revealing the depositor wallet.

A burner wallet is not enough if Alice funds it from her deposit wallet or any
known account. That creates a new public link.

### 2. Make relayer trust and metadata explicit

A relayer prevents `msg.sender` from being Alice, but it can still learn network
metadata and observe withdrawal requests. The app should minimize this:

- support multiple relayers or a user-selected relayer;
- avoid requiring account login for relayer use;
- avoid analytics that join deposit and withdrawal sessions;
- document that users should use privacy-preserving network access if they need
  protection from RPC, relayer, or hosting logs.

The relayer cannot steal funds if the proof and public inputs bind the intended
`recipient`, fee, and any relayer payment correctly, but it can refuse service
or collect metadata.

### 3. Protect the anonymity set

The claim only becomes meaningful when enough deposits are plausible sources
for a withdrawal. The product should:

- display the current anonymity set before withdrawal;
- discourage immediate withdraws after deposit;
- avoid defaulting to roots that unnecessarily narrow the candidate set;
- communicate that privacy improves as more independent deposits accumulate;
- consider delaying launch or pausing withdrawals if the set is too small for
  the promised privacy level.

For a three-person team's small 1 ETH mainnet pool, this is a serious launch
risk. A sound ZK pool with a tiny user base can still provide weak practical
privacy.

## Marketing-safe wording

The shipped wording is too strong. Accurate wording for the current flow would
be closer to:

> The proof does not reveal which deposit commitment is being spent.

That is true but much narrower than "withdrawals cannot be linked to deposits."

After adding relayed/paymaster withdrawals, avoiding wallet-funded burner
links, and being honest about anonymity-set limits, a safer claim would be:

> Withdrawals are designed so the onchain proof does not reveal which deposit
> is being spent, and the withdrawal transaction is not sent from the depositor
> wallet. Unlinkability depends on the available anonymity set and on users
> avoiding offchain metadata leaks.

That is less punchy, but it matches the actual privacy boundary.

## Recommendation

Do not ship the original claim. Ship relayed or paymaster-based withdrawals
first, remove any flow that asks Alice's deposit wallet to call `withdraw()`,
and add product copy that explains anonymity-set and metadata limits. Only then
can the product credibly claim deposit-to-withdrawal unlinkability in the
onchain sense.

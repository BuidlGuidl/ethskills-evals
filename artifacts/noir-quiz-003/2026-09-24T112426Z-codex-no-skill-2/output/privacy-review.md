# Privacy review: deposit/withdraw linkability

## Executive summary

Marketing should not say "withdrawals cannot be linked to deposits" for the
product as shipped.

The audited cryptography can hide which committed note is being spent, assuming
a sufficiently large anonymity set. But the shipped user flow has Alice connect
her wallet and submit `withdraw(...)` herself. On Ethereum mainnet, the sender
of that transaction is public. A competent chain observer can therefore see that
Alice's wallet deposited into the pool and later Alice's wallet called
`withdraw`.

That does not necessarily reveal the exact Merkle leaf/nullifier relationship at
the cryptographic level, but it is enough to link Alice to the withdrawal event
operationally. With a small three-person/fixed-note pool, that practical
linkability is likely stronger than the marketing claim allows.

## What an onchain observer sees

For each deposit, an observer sees:

- The depositing address, because it is the transaction sender.
- The deposit amount, here fixed at 1 ETH.
- The deposit timestamp and block.
- The emitted commitment or inserted tree leaf, depending on contract events and
  storage layout.
- The note's position or insertion order if the contract exposes it directly or
  indirectly through events/tree updates.

For each withdrawal, an observer sees:

- The withdrawal transaction sender, because `msg.sender` pays gas and calls the
  contract.
- The public withdrawal inputs: `root`, `nullifierHash`, and `recipient`.
- The fixed 1 ETH payout from the pool to `recipient`.
- The block/time of withdrawal.
- Whether a given `nullifierHash` has already been spent.

Assuming the verifier and circuit are correct, the observer does not learn:

- The note secret.
- The commitment preimage.
- A direct cryptographic mapping from `nullifierHash` back to the deposited
  commitment.
- Which specific deposit leaf was proven, except through side channels and
  anonymity-set reduction.

## What can be determined about who withdrew

As shipped, a chain observer can determine that the address submitting
`withdraw(...)` initiated the withdrawal. In the described flow, that is Alice's
connected wallet.

If Alice used the same wallet for both steps, the public chain history says:

1. Alice's wallet deposited 1 ETH into the pool.
2. Weeks later, Alice's wallet called `withdraw(...)`.
3. The pool paid 1 ETH to the fresh `recipient`.

The fresh recipient address helps avoid linking the payout address to Alice by
address reuse, but it does not hide who submitted the withdrawal transaction. The
withdrawal caller is still Alice.

A careful observer would not need to break the cryptography. They can use normal
transaction metadata:

- Same EOA or wallet cluster used for deposit and withdrawal.
- Gas payment by Alice's wallet on the withdrawal transaction.
- Timing patterns, especially in a small pool.
- Root selection, which bounds the eligible deposit set to notes included in
  that historical Merkle root.
- Recipient behavior after withdrawal, such as later sending funds to an
  exchange account, back to Alice, or to addresses previously linked to Alice.

So the honest statement is: the protocol proof does not reveal which note was
spent, but the product flow reveals that Alice performed a withdrawal.

## Deposit-to-withdraw linkability

The cryptographic link between a specific commitment and a specific
`nullifierHash` is hidden. That part of the design is doing its job.

However, privacy systems are only as strong as the whole workflow. The current
workflow gives observers non-cryptographic evidence that can link deposits and
withdrawals:

- If Alice is the only recent depositor and Alice later calls `withdraw`, the
  inference is obvious.
- If the pool has only three users, the anonymity set is tiny even when the
  circuit is correct.
- If each user deposits once and later calls `withdraw` from their known wallet,
  the withdrawal caller can often be matched to the depositor without needing to
  know the exact leaf.
- If users choose roots close to their deposit time, they may shrink the set of
  possible source deposits.
- If the recipient later interacts with Alice-linked addresses or services, the
  payout can become linkable after the fact.

The result is not "withdrawals cannot be linked to deposits." It is closer to:
"the contract does not reveal the spent deposit, but application and chain
metadata may still link users to withdrawals."

## What has to change for the claim to hold

At minimum, withdrawals must not be submitted by the depositor's public wallet.
The app needs a relayed withdrawal flow:

- Alice generates the proof locally.
- Alice sends the proof, root, nullifier hash, and recipient to a relayer over a
  privacy-preserving channel.
- The relayer submits `withdraw(...)` onchain.
- The contract pays the fresh recipient and optionally pays the relayer a fee
  from the note amount.
- The relayer, not Alice, appears as the withdrawal transaction sender.

The contract may need to support a relayer fee and refund address, or otherwise
make relaying economically viable without Alice funding a new onchain account.
Alice should not have to send ETH to the fresh recipient before withdrawal,
because that funding transaction would link the recipient to Alice.

The product also needs operational privacy controls:

- Require or strongly encourage waiting until there is a meaningful anonymity
  set before withdrawing.
- Avoid presenting roots that unnecessarily narrow the anonymity set.
- Warn users that small pools provide weak privacy even with correct ZK proofs.
- Avoid collecting server logs that associate deposit wallets, notes,
  withdrawal proofs, IP addresses, and recipients.
- Use privacy-aware RPC access or document that wallet/RPC providers may observe
  both deposit and withdrawal preparation.
- Educate users not to reuse recipient addresses or later merge withdrawn funds
  back into Alice-linked accounts.

Even with relayers, the strongest defensible claim depends on pool size and
usage patterns. In a three-person pool, "cannot be linked" is still too absolute.
A better claim would require a large active anonymity set, relayed withdrawals,
recipient hygiene, and no offchain telemetry tying the steps together.

## Recommended marketing language

Do not use:

> Withdrawals cannot be linked to deposits.

Use something narrower and accurate:

> The withdrawal proof does not reveal which eligible deposit is being spent.

Or, if the product ships a relayer flow and has real anonymity-set safeguards:

> Relayed withdrawals are designed to hide which eligible deposit funded a
> payout, provided users withdraw into fresh addresses after enough deposits have
> accumulated.

The second version is less punchy, but it matches reality. Privacy claims should
describe the system users actually touch, not only the circuit.

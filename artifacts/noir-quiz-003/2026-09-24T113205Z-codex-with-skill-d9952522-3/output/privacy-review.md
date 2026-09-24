# Privacy review: withdrawal/deposit linkability

## Executive summary

Marketing should not say "withdrawals cannot be linked to deposits" for the
product as shipped.

The audited circuit can hide which committed note is being spent, but the
current product asks Alice to connect the same public wallet and send the
withdrawal transaction herself. On Ethereum mainnet, `msg.sender`, gas funding,
transaction timing, the deposit sender, the withdrawal sender, the selected
Merkle root, the nullifier hash, and the recipient are all public. If Alice's
wallet deposited and later that same wallet calls `withdraw(...)`, a competent
chain observer can directly link Alice's deposit wallet to the withdrawal
transaction without breaking the cryptography.

The claim only becomes defensible if the withdrawal transaction is submitted by
an unlinkable relayer/paymaster path, and if the product is clear that privacy is
bounded by the anonymity set and timing patterns, not absolute.

## What a chain observer can see

For each deposit, an observer can see:

- The depositing account, because the deposit transaction sender is public.
- The deposit amount, here a fixed 1 ETH.
- The inserted commitment and its leaf position or event data, assuming the
  contract emits enough data for clients to rebuild the tree.
- The block time and the Merkle roots produced after insertion.

For each withdrawal, an observer can see:

- The account that submits the withdrawal transaction.
- The proof calldata, public root, public nullifier hash, and public recipient.
- The fact that the nullifier has now been spent.
- The recipient receiving 1 ETH from the pool.
- The block time and the root snapshot against which the proof was verified.

The proof itself does not reveal which commitment is being spent. The
nullifier hash should not reveal the note if the nullifier construction is
correct. Those are important wins, but they do not hide the transaction sender.

## What the observer can determine in the shipped flow

In the shipped flow, Alice deposits from her wallet and later connects her
wallet again to call:

```text
withdraw(proof, root, nullifierHash, recipient)
```

That means the observer can determine that Alice's wallet initiated the
withdrawal. If the same wallet previously deposited into the pool, the observer
has a straightforward behavioral link:

```text
Alice wallet -> deposit(1 ETH)
Alice wallet -> withdraw(..., recipient=fresh address)
```

The observer does not need to know which commitment was spent. The public
withdrawal sender already says who caused the withdrawal. The fresh recipient
address helps avoid linking the payout address to Alice by address history, but
it does not hide that Alice's known wallet requested the payout.

The observer can also narrow the possible note to the anonymity set implied by
the public root: the spent note must be one of the commitments included in that
root, minus notes already known to be spent by previous nullifiers. With a small
pool, unusual timing, or only a few deposits before the chosen root, that set may
be small even if the circuit is perfect.

So the accurate answer for the current product is:

> A competent chain observer can link the withdrawal transaction to Alice's
> wallet. They may not be able to cryptographically identify Alice's exact
> commitment inside the tree, but the app-level flow reveals who withdrew.

## Required product changes

To make the marketing claim reasonably true onchain, the withdrawing user must
not send the withdrawal transaction from a wallet linked to the deposit.

The product should add one of these paths:

- A relayer network where Alice generates the proof locally and sends the
  withdrawal request offchain to a relayer, and the relayer submits
  `withdraw(...)` onchain.
- An ERC-4337/paymaster flow where gas is sponsored or paid from the withdrawn
  value, without requiring Alice to fund a burner wallet from her known wallet.
- A fee mechanism in the pool so relayers can be compensated without Alice
  making a separate public payment that links her to the withdrawal.

The contract should treat `msg.sender` as operationally irrelevant to ownership
of the note. It should verify only the proof, accepted root, unspent nullifier,
and recipient/fee parameters. The user should be able to choose a fresh
recipient that has no prior onchain link to the depositor.

Avoid recommending "use a burner wallet" as the main fix. If Alice funds the
burner from her depositing wallet or another known wallet, the funding trail
recreates the same link.

## Remaining limits after relaying

Even with relayers, the strongest honest statement is not absolute. A chain
observer can still say the withdrawal corresponds to one of the eligible deposits
in the root's anonymity set. Timing can make that set smaller. For example, if
only three 1 ETH deposits exist before the root, the withdrawal is one of those
three. If Alice deposits and withdraws shortly after, timing may make her the
most likely candidate.

The launch copy should account for those limits. A defensible version would be:

> Withdrawals are designed so the onchain proof does not reveal which deposit is
> being spent. When submitted through an unlinkable relayer and withdrawn to a
> fresh address, a withdrawal is only linkable to the pool's anonymity set, not
> to a specific deposit.

Do not print "withdrawals cannot be linked to deposits" unless the product ships
the relayer/paymaster withdrawal path and the user flow prevents the depositor's
wallet from submitting or funding the withdrawal transaction.

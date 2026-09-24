# Privacy Review: Withdrawal Linkability

## Bottom line

Marketing should not claim that "withdrawals cannot be linked to deposits" for the
shipped flow.

The cryptography may hide which commitment is being spent, but the transaction
sender is still public. In the current product Alice deposits from her wallet,
then later connects a wallet and sends the withdrawal transaction herself. If she
uses the same wallet, a chain observer can directly see that the same address
both deposited into the pool and withdrew from it. The fresh `recipient` address
does not fix that, because it is a public withdrawal argument and receives funds
in the same transaction.

## What a chain observer can see

For every deposit, an observer sees:

- The depositing address, via `msg.sender` or the transaction `from`.
- The exact deposit transaction, timestamp, block, and 1 ETH value.
- The inserted commitment and its leaf position or insertion event, depending on
  the contract events.

For every withdrawal, an observer sees:

- The address that submitted the withdrawal transaction.
- The public inputs: `root`, `nullifierHash`, and `recipient`.
- The recipient address that receives the 1 ETH payout.
- The withdrawal time, block, gas payer, and any transaction-routing metadata.

The proof prevents the observer from deriving the spent commitment from the
proof, root, or nullifier hash. The observer should not be able to identify the
exact leaf from cryptography alone.

That is not enough for withdrawal privacy. Because Alice submits the withdrawal
transaction, `tx.from`/`msg.sender` identifies the withdrawing wallet. If that is
the same wallet that deposited, the observer can link Alice's withdrawal to
Alice's deposit address immediately. If Alice made only one deposit, the exact
deposit is effectively linked too. If she made several deposits from that wallet,
the observer may only know that one of that wallet's deposits was withdrawn, but
that is still a link to Alice.

## What the fresh recipient does and does not hide

Generating a fresh, empty payout address is good hygiene, but it only avoids
reusing an existing recipient identity.

It does not hide the withdrawer in the current flow. The withdrawal transaction
publicly says, in effect: "Alice's wallet submitted a valid withdrawal proof and
paid this fresh address." A competent observer can reasonably attribute the fresh
recipient to Alice unless there is another transaction-sender privacy mechanism.

The recipient can also lose privacy later if it sends funds to an exchange,
bridges, consolidates with Alice's other wallets, or receives gas from a linked
source. Those are downstream usage risks, not circuit failures.

## What has to change

To support the marketing claim, the product must ensure that the depositor's
wallet does not submit its own withdrawal transaction.

Use a relayer, sponsored transaction system, or ERC-4337/paymaster flow where:

- Alice generates the proof locally.
- Alice sends the proof and public inputs to a relayer or bundler.
- The relayer submits `withdraw(proof, root, nullifierHash, recipient)` onchain.
- The relayer, not Alice, appears as the transaction sender and gas payer.
- The payout recipient is fresh and is not pre-funded or later gas-funded from
  Alice's known wallet.

If the relayer needs a fee, design that fee into the withdrawal flow instead of
requiring Alice to fund the recipient or relayer from her known wallet. Common
patterns are paying the relayer from the withdrawn amount, using a sponsored gas
budget, or including an explicit fee recipient/fee amount in the public inputs
with circuit and contract checks.

Even with a relayer, the claim is bounded by the anonymity set. The withdrawal
can only be hidden among deposits already included under the chosen root. A small
pool, unusual timing, or a mostly empty 1 ETH note set can still make users easy
to guess. For a three-person or low-volume pool, the honest statement is not
"nobody can tell"; it is "the proof does not reveal which eligible deposit is
being withdrawn, but privacy depends on using a relayer and having other
indistinguishable deposits in the set."

## Recommended launch wording

Do not ship:

> withdrawals cannot be linked to deposits

Acceptable only after adding relayed/sponsored withdrawals and documenting the
anonymity-set limits:

> withdrawals are not cryptographically linked to deposits onchain when submitted
> through the relayer, and each withdrawal is hidden among the eligible 1 ETH
> notes in the pool.

For the current shipped flow, a more accurate statement is:

> the proof does not reveal which note is spent, but if you submit the withdrawal
> from your own wallet, observers can link the withdrawal to that wallet.

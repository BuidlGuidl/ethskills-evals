# Privacy Review: Deposit/Withdrawal Linkability

## Executive summary

The launch claim "withdrawals cannot be linked to deposits" is not true for
the shipped flow.

The audited cryptography may prevent a direct cryptographic link between a
commitment and a nullifier, but the product flow reintroduces a much simpler
link: Alice uses her own wallet to submit the withdrawal transaction. A chain
observer can see that Alice's address called `withdraw(...)`, can see the fresh
recipient address in calldata, and can see the pool pay that recipient. If the
same Alice address previously deposited, the observer can connect Alice to both
actions without breaking the proof system.

The accurate claim for the current product is narrower:

> The proof does not reveal which eligible note was spent, but the withdrawal
> transaction reveals the account that submitted the withdrawal and the
> recipient that received the payout.

## What a chain observer sees

For each deposit, an observer sees at least:

- the depositing account, via `msg.sender` / transaction `from`;
- the deposit time and block;
- the fixed 1 ETH value;
- the inserted commitment, if emitted or stored in contract state;
- the Merkle tree position or insertion order, if observable from events or
  storage updates.

For each withdrawal, an observer sees at least:

- the transaction sender that called `withdraw(...)`;
- the `root` used by the proof;
- the `nullifierHash`;
- the `recipient`;
- the time and block of withdrawal;
- the fixed 1 ETH payout from the pool to the recipient;
- any event fields emitted by the withdrawal function.

Because `recipient` is an explicit public argument, the fresh address does not
hide the withdrawal destination from chain observers. It only means the
recipient address has no prior onchain history at the moment it receives funds.

## What the observer can determine in the shipped flow

If Alice deposits from `AliceEOA` and later calls `withdraw(...)` from
`AliceEOA`, a competent observer can determine:

- `AliceEOA` deposited 1 ETH into the pool.
- `AliceEOA` later initiated a valid withdrawal from the pool.
- the withdrawal paid 1 ETH to `recipient`.
- `recipient` is therefore controlled by, or at least designated by, the party
  that submitted the withdrawal transaction.
- the spent note came from the anonymity set represented by `root`, meaning
  from some deposit included in that Merkle root.

The observer still cannot derive the note secret or compute a cryptographic
mapping from `nullifierHash` back to the original commitment, assuming the
audited cryptography is correct. But that is not enough for the marketing
claim. The visible transaction sender links Alice to the withdrawal at the
application layer.

In the common case where Alice made exactly one deposit, the practical link is
especially strong: the observer sees Alice deposit one 1 ETH note and later sees
Alice herself withdraw one 1 ETH note to a fresh recipient. The proof may be
anonymous within the set, but the user workflow has identified the withdrawer.

## What remains ambiguous

The chain observer generally cannot prove, from the proof data alone, which
specific commitment was consumed. If the root covers many deposits, Alice's
withdrawal proof could have been generated for any unspent note in that root's
set.

That ambiguity is only useful if the withdrawal transaction does not itself
identify the withdrawing user. In the shipped flow it does identify the caller,
so the ambiguity mostly protects the commitment-to-nullifier relation, not
Alice's participation in the withdrawal.

There are still edge cases where the observer's conclusion is probabilistic
rather than absolute. For example, Alice might call `withdraw(...)` for a note
someone else gave her. But for the advertised user flow, where Alice deposits,
saves her note, and later withdraws it, the observer's inference is the obvious
one and will be treated as reliable.

## Additional linkability risks

Even after removing the sender leak, a small fixed-denomination pool has other
privacy limits:

- Small anonymity set: if only a few 1 ETH notes exist, every withdrawal has a
  small candidate set.
- Timing correlation: depositing shortly before withdrawing, or using a root
  that includes only recent deposits, narrows the candidate set.
- Unique usage patterns: repeated deposits and withdrawals by the same address
  can create recognizable behavior.
- Recipient behavior: later funding gas, consolidating funds, sending to the
  same exchange account, or interacting with known wallets can relink the fresh
  recipient to Alice.
- RPC and frontend telemetry: wallet address, IP address, proof generation
  timing, and note metadata can create offchain links even if the chain flow is
  improved.
- Mempool/network observation: public transaction propagation can add timing and
  origin metadata beyond settled chain data.

These do not invalidate the circuit, but they matter for any broad claim that
withdrawals cannot be linked to deposits.

## Required product changes

To make the marketing claim defensible, the withdrawal must not be submitted by
the depositor's wallet or by any address otherwise linkable to the depositor.

At minimum:

1. Add relayed withdrawals.
   The user should generate the proof locally and send it to an independent
   relayer. The relayer submits `withdraw(...)` on-chain. The onchain
   transaction sender is then the relayer, not Alice.

2. Pay relayer fees from the withdrawal.
   The contract should support a public `relayer` and `fee` parameter, with the
   fee paid out of the withdrawn amount. Alice must not have to fund a fresh
   address or her original wallet with ETH for withdrawal gas.

3. Do not require connecting the deposit wallet to withdraw.
   The withdrawal screen should accept a note and recipient address. If a wallet
   connection is needed for UI convenience, it must not be the mechanism that
   pays gas or identifies the user on-chain.

4. Encourage delayed withdrawals and mature roots.
   The UI should avoid nudging users to withdraw immediately after deposit and
   should make it easy to use roots with a large anonymity set.

5. Minimize offchain telemetry.
   The app should not log notes, wallet addresses, recipient addresses, IPs, or
   proof-generation events in a way that can reconstruct the link. RPC usage
   should be privacy-conscious as well.

6. Warn users about recipient reuse and later spends.
   A fresh recipient only helps until its later activity links it back to the
   user. The product should set expectations accordingly.

## Marketing recommendation

Do not ship "withdrawals cannot be linked to deposits" for the current product.
It overstates the privacy guarantee.

For the shipped flow, a defensible statement would be:

> The zero-knowledge proof does not reveal which deposited note is being spent,
> but withdrawing directly from your own wallet can reveal that you performed a
> withdrawal.

After relayed withdrawals, fee support, mature anonymity sets, and telemetry
controls are in place, a stronger but still careful claim would be:

> Withdrawals are not cryptographically linked to deposits, and relayed
> withdrawals avoid revealing the depositor's wallet as the transaction sender.
> Privacy still depends on anonymity-set size, timing, and how the recipient
> address is later used.

# Privacy Review: Deposit/Withdrawal Linkability

## Executive summary

The cryptography can be correct and the product can still fail the marketing
claim.

As shipped, if Alice deposits from her normal wallet and later uses that same
wallet to call `withdraw(...)`, a chain observer can link the deposit and
withdrawal trivially through `msg.sender`. The ZK proof hides which commitment
is being spent, but Ethereum still reveals the account that submitted the
withdrawal transaction.

The launch page should not say "withdrawals cannot be linked to deposits" for
the current product. A defensible version would require a withdrawal flow where
the depositor's wallet never appears onchain during withdrawal, normally via a
relayer or account-abstraction paymaster, plus product constraints that avoid
shrinking the anonymity set.

## What a chain observer can see

For every deposit, an observer sees:

- The depositing address, via `msg.sender` on `deposit()`.
- The transaction hash, block number, timestamp, gas payer, nonce history, and
  funding history of the depositing address.
- The inserted commitment and its position/root updates, if emitted or stored by
  the contract.
- The fixed 1 ETH amount, which removes amount correlation but still leaves
  timing and address metadata.

For every withdrawal, an observer sees:

- The address that called `withdraw(...)`, via `msg.sender`.
- The `root`, `nullifierHash`, and `recipient` public inputs/call arguments.
- The block number, timestamp, gas payer, transaction origin/account history,
  and any relayer/paymaster if used.
- The 1 ETH transfer to `recipient`.
- That the withdrawal spent one valid note included in the submitted root and
  that the `nullifierHash` has not been used before.

The observer should not be able to derive the original commitment from the
proof or nullifier hash if the audited cryptography is correct.

## What they can determine in the shipped flow

If Alice calls `withdraw(...)` from the same wallet she used to deposit, the
observer can determine that Alice withdrew. This is true even though the
observer cannot tell which private witness was used inside the proof. The public
caller has already given the game away.

If Alice calls `withdraw(...)` from a different wallet, the observer will look
for links between that caller and Alice:

- Was the withdrawal caller funded by Alice's deposit wallet?
- Was it funded from the same CEX deposit/withdrawal pattern or another known
  wallet cluster?
- Did it receive just enough ETH for gas shortly before withdrawal?
- Does it later send change or funds back to Alice?
- Does it share nonce, timing, gas-price, wallet-software, or behavioral
  patterns with Alice's known wallets?

If Alice uses a fresh recipient but her known wallet submits the withdrawal, the
fresh recipient does not solve the privacy problem. The recipient hides the
destination of the funds only until Alice uses them in a linkable way; it does
not hide who executed the withdrawal.

## What remains private

Assuming the circuit, Merkle membership proof, nullifier scheme, and verifier
are sound:

- The proof does not reveal which commitment in the tree belongs to Alice.
- The nullifier prevents double-withdrawal without directly revealing the
  original commitment.
- A withdrawal can be cryptographically consistent with any eligible unspent
  note in the accepted anonymity set.

That is a narrower claim than "withdrawals cannot be linked to deposits." The
accurate cryptographic claim is closer to: "the proof does not reveal which
eligible deposit is being withdrawn."

## Practical linkability risks

### Same-wallet withdrawal

This is the critical issue. If the depositing wallet also submits withdrawal,
deposit and withdrawal are directly linked by address.

### Gas funding

A fresh withdrawal caller still needs ETH for gas unless someone else pays. If
Alice funds that fresh caller from her known wallet, a competent observer can
usually connect the wallets.

### Small anonymity set

The tree is the anonymity set. If only a small number of 1 ETH notes exist, each
withdrawal is only hiding among that small group. If there are 3 eligible
deposits, the best cryptographic privacy is roughly "one of these 3 deposits,"
before timing and wallet clustering are considered.

### Root choice

The submitted `root` defines the candidate set. If the app proves against an
old root, it can exclude later deposits and unnecessarily shrink the anonymity
set. If Alice proves against a root from near her deposit time, observers may
infer that the spent note was already present by that block.

### Timing correlation

Long delays help, but they do not eliminate correlation. Observers can still
compare deposit and withdrawal timing, public announcements, UI usage patterns
if available from infrastructure, and common user behavior such as withdrawing
soon after reopening the app.

### Recipient behavior

The recipient being fresh and empty is good, but only at receipt time. Future
transactions from that recipient can link the withdrawal to Alice if the funds
move to her known wallets, a KYC exchange account, an ENS-linked account, or a
wallet cluster already attributed to her.

### Frontend and RPC metadata

This review is chain-focused, but product privacy also depends on offchain
metadata. Hosted frontends, analytics, IP logs, wallet-connect infrastructure,
and RPC providers can observe who generated or submitted a withdrawal unless
the product is designed to avoid that.

## What must change for the marketing claim to hold

At minimum:

1. Do not have users submit withdrawals from the deposit wallet.
2. Add a relayer flow or ERC-4337/paymaster flow so the user does not need to
   fund a fresh withdrawal caller from a linkable wallet.
3. Make the recipient address fresh and keep it separate from known user
   wallets after withdrawal.
4. Default proof generation to the largest acceptable root, usually the latest
   accepted root or a recent-root policy that does not unnecessarily reveal an
   old candidate set.
5. Display anonymity-set information before withdrawal, such as "this withdrawal
   is hiding among N eligible deposits."
6. Avoid logging or sharing frontend/RPC metadata that can re-link the user to
   the withdrawal.
7. Provide user guidance that the pool only gives privacy if deposits and
   withdrawals are separated by wallet, gas source, timing, and later fund flow.

The most important product change is a sponsored or relayed withdrawal path:
Alice should generate the proof locally, sign an authorization if needed, and
send it to a relayer/paymaster that submits `withdraw(...)`. Onchain, the caller
should be the relayer or account-abstraction infrastructure, not Alice's deposit
wallet or a wallet she funded directly.

## Suggested marketing language

Do not use:

> Withdrawals cannot be linked to deposits.

For the shipped flow, a more accurate statement is:

> The zero-knowledge proof does not reveal which deposited note is being
> withdrawn, but users must withdraw from an unlinkable wallet or relayer flow
> to avoid address-level linkage.

After adding relayed/sponsored withdrawals and improving anonymity-set handling,
the stronger claim can be:

> Withdrawals are designed to be unlinkable from deposits onchain when users use
> the relayed withdrawal flow and avoid re-linking the recipient address.

Even then, avoid absolute language. "Cannot be linked" is too strong because
small anonymity sets, timing, funding trails, recipient reuse, RPC logs, and
offchain data can still create probabilistic links.

## Bottom line

The auditor's result means the proof system does not reveal the note. It does
not mean the product hides the withdrawer.

With the current wallet-connected withdrawal flow, a competent chain observer
can identify the withdrawing wallet and, if it is the same wallet that
deposited, directly link the withdrawal to the deposit. For the marketing claim
to be supportable, the product needs relayed or sponsored withdrawals, careful
root/anonymity-set defaults, and clear recipient/funding hygiene.

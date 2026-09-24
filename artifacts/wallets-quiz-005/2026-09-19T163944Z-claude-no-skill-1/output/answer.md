# EIP-7702 delegation status of the treasury EOA

## TL;DR

1. **Yes, the EOA is almost certainly still delegated to BatchExecutor.** It wasn't a no-op.
   The delegation was written when the transaction was processed. The inner call reverting
   didn't undo it, and a 7702 delegation has no expiry. It stays until the account
   authorizes something else.
2. **To remove it**, the EOA key has to sign a new EIP-7702 authorization whose `address`
   is `0x0000000000000000000000000000000000000000`. That authorization then has to be
   included in a mined type-4 (`0x04`) transaction. Afterwards, confirm with
   `eth_getCode(EOA) == 0x`. Because BatchExecutor has a critical bug, treat this as
   urgent. Until it's done, anyone can call the EOA and run BatchExecutor's code with the
   treasury's balance and authority.

---

## 1. Is the EOA still delegated?

### How a 7702 transaction is processed

A type-4 (set-code) transaction has two separate parts:

1. **Processing the authorization list.** This runs *before* execution starts. For each
   tuple `(chain_id, address, nonce, y_parity, r, s)`, the client recovers the signer
   (the "authority"), checks the chain ID and the authority's current nonce, and writes
   the delegation designator `0xef0100 || address` into the authority's code. It also
   **increments the authority's nonce**.
2. **Execution.** Only after that does the EVM run the call in the transaction's `to` and
   `data` fields.

EIP-7702 says explicitly that the delegation indicator writes are **not rolled back if
execution reverts**. A revert only undoes state changes made during execution. The
authorization list isn't part of execution. So when the batch call reverted, the
reverted parts were:

- the approvals and any other inner state changes. None of the batch's effects persist,
  which is the only part that really was a no-op.

These were **not** reverted:

- the EOA's code, which is now `0xef0100 || <BatchExecutor address>`
- the nonce increments (one for the transaction, one for the authorization)
- the gas paid.

### Does a delegation expire or wear off?

No. There's no TTL, no "one transaction only" mode, and no automatic cleanup. The
designator is ordinary account code. It stays until a later valid authorization from the
same account replaces it. You say the EOA hasn't signed or sent anything since, so
nothing has replaced it. Transactions sent by other parties can't change it either,
because changing it requires a signature from the EOA's key.

### Could the authorization have been silently skipped?

This is the one caveat to check. An invalid authorization tuple doesn't make the
transaction invalid. The client just skips that tuple and the transaction still goes
through. A classic cause is a wrong nonce when the EOA is both the transaction sender and
the authority. The sender's nonce is incremented before the authorization list is
processed, so a self-sponsored authorization has to use `tx.nonce + 1`.

Your evidence says the authorization was applied. The batch call reverted because
**an inner approval failed**, which means BatchExecutor's code actually ran in the EOA's
context. If the authorization had been skipped, the EOA would have had no code. A call to
it would then have been a plain call to a codeless account: it would have "succeeded"
and done nothing, and there would have been no inner approval to fail. So the delegation
was installed.

### How to check (please do this; it's authoritative)

```bash
cast code <TREASURY_EOA> --rpc-url $MAINNET_RPC
# or: eth_getCode(<TREASURY_EOA>, "latest")
```

- If the result is `0xef0100` followed by the 20-byte BatchExecutor address (23 bytes
  total), the account is **still delegated**. This is what we expect.
- If the result is `0x`, the account is not delegated.

You can also check the original transaction's receipt/trace, and confirm that the EOA's
nonce went up by **2** in that transaction (by 1 if the authorization was skipped):
`cast nonce <EOA> --block <N-1>` compared with `--block <N>`.

**Answer to Q1: yes. The EOA is still delegated to BatchExecutor right now, and it will
stay that way until you act.**

---

## 2. Removing the delegation

### Why this is urgent

While the designator is in place, any external caller can send a call to the treasury
EOA. That call runs BatchExecutor's code with `address(this)` equal to the treasury, using
the treasury's ETH, tokens, and storage. If the critical bug is in access control (for
example, anyone can call `execute`), the treasury can be drained without anyone ever
touching the private key. "Nothing has been sent *from* the EOA" doesn't mean nothing has
been sent *to* it.

### The procedure

EIP-7702 defines a special case. If an authorization's `address` is the zero address,
the client **clears** the account's code: the code hash goes back to the empty hash, and
the account is once again a plain EOA.

1. **Build the authorization tuple:**
   - `chain_id = 1` (mainnet). Don't use `0`; see the notes below.
   - `address = 0x0000000000000000000000000000000000000000`
   - `nonce` = the EOA's nonce **at the moment the authorization is processed**:
     - If a *different* account sends the type-4 transaction (sponsored), use
       `nonce = current nonce of EOA`.
     - If the **treasury EOA sends it itself**, use `nonce = current nonce + 1`, because
       the transaction's own nonce is used up first. This is the most common mistake. If
       you get it wrong, the tuple is silently skipped: the transaction succeeds but the
       delegation stays in place.
2. **Sign it with the treasury key.** The signed payload is
   `keccak256(0x05 || rlp([chain_id, address, nonce]))`. Examples:
   - Foundry:
     `cast wallet sign-auth 0x0000000000000000000000000000000000000000 --chain 1 --nonce <n> --private-key/--ledger ...`
   - viem: `walletClient.signAuthorization({ contractAddress: zeroAddress, executor: 'self' })`
     (`executor: 'self'` handles the +1).
3. **Put it in a type-4 transaction and get it mined.** The transaction needs a non-empty
   `authorizationList`. Its `to` can be any address, and the call itself doesn't matter.
   It can go to the EOA itself with empty calldata or to some other address. Even if the
   call reverts, the revocation still applies, for the same reason as in Q1. Example:
   `cast send <EOA> --auth <signed-auth-or-address> --private-key ...`.
   The treasury can send it itself, or a separate funded account can sponsor it with the
   treasury's signed tuple.
4. **Verify:** `cast code <TREASURY_EOA>` must return `0x`. Also confirm that the nonce
   went up as expected. Don't sign off until you've seen `0x` on-chain.

(You could also re-delegate to a *different*, audited contract with a new authorization.
That overwrites the old designator. But if the goal is decommissioning, the zero-address
revocation is the clean answer.)

### Things the reviewer should also check

- **Storage persists.** Clearing the code doesn't wipe the EOA's storage slots. Anything
  BatchExecutor wrote there (for example, a nonce, an owner, or an initialized flag) is
  still there. That's harmless for a plain EOA. But if you ever delegate this account to
  another contract, its storage layout could collide with the leftover data. Namespaced
  (ERC-7201) storage in the new implementation avoids this.
- **Look for exploitation during the window.** Look at every transaction and internal
  call *to* the EOA since the 7702 transaction. Check ETH and token balances and all
  ERC-20/721/1155 approvals and `setApprovalForAll` grants. Any approvals made through
  the delegated code while it was active are **not** undone by revoking the delegation.
  They have to be revoked one by one.
- **The chain ID of the original authorization.** If the original tuple was signed with
  `chain_id = 0`, it's valid on *every* EVM chain that supports 7702. Anyone could
  replay it on another chain where the treasury address's nonce matches, which would
  delegate that chain's copy of the account to BatchExecutor (if BatchExecutor code
  exists at that address there). Check the other chains the treasury uses, and revoke
  there too if needed. On mainnet, the original tuple can't be replayed: its nonce was
  used up when it was applied.
- **Front-running doesn't block revocation.** Only the treasury key can sign
  authorizations. An attacker could only invalidate your revocation tuple by changing the
  EOA's nonce, and that also requires the key. If the transaction fails to take effect,
  the cause is almost certainly a nonce mismatch. Re-read the nonce, re-sign, and
  resubmit.
- **Consider rotating the key.** If there's any doubt about how the treasury key was
  handled, move the funds to a fresh address instead of relying on this EOA. Note that
  7702 delegation never removes the original key's authority, with or without a
  delegation.

**Answer to Q2:** have the treasury key sign an EIP-7702 authorization for
`address = 0x0`, `chain_id = 1`. Use the current nonce, or current nonce + 1 if the
treasury sends the transaction itself. Get it mined in any type-4 transaction, then
confirm `eth_getCode` returns `0x`. After that, audit for approvals or transfers made
while the delegation was live, and check other chains if the original authorization used
`chain_id = 0`.

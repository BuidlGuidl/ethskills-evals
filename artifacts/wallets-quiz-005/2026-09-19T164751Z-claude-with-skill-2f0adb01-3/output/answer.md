# EIP-7702 delegation status of the treasury EOA

## Short answer

1. **Yes, the EOA is almost certainly still delegated to BatchExecutor right now.**
   The batch call reverting did **not** undo the delegation. Nothing in the
   protocol makes a delegation expire, and you haven't replaced it since. It
   stays in place until you change it.
2. **To remove it, sign a new EIP-7702 authorization that names
   `address(0)` (`0x0000000000000000000000000000000000000000`) and get it
   included in a type-4 (`0x04`) transaction.** That clears the delegation
   indicator and the account goes back to being a plain EOA. Treat this as
   **urgent**: until it's done, the known-buggy BatchExecutor code is live on
   your treasury address.

---

## Reasoning for Q1: why the revert didn't undo the delegation

### How a 7702 transaction is processed

A type-4 (set-code) transaction runs in two separate steps
([EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)):

1. **Authorization processing.** After the sender's nonce is incremented and
   **before** any execution starts, the client goes through
   `authorization_list`. For each valid tuple `(chain_id, address, nonce, y_parity, r, s)`
   it:
   - recovers the `authority` (your EOA),
   - checks the chain id (`1` or `0`), checks that the authority has no code or
     only an existing delegation, and checks that the nonce matches,
   - **increments the authority's nonce**,
   - writes the code `0xef0100 || address` (the *delegation indicator*) to the
     authority's account.
2. **Execution.** Only after that does the EVM run the call itself (here, your
   call into the batch).

The spec says plainly that the delegation writes are **not rolled back if
execution reverts**. The authorization list is handled like the nonce
increment and gas purchase: it is part of transaction validity and
pre-processing, not part of the call frame. A revert in step 2 only undoes the
state changes made in step 2.

### Applying that to your transaction

- The transaction was **mined**, so step 1 ran.
- The inner approval failure reverted the **batch call**. That undid the
  batch's effects: none of the approvals or transfers inside the batch
  persisted. It did **not** undo the code written to your EOA in step 1.
- "The transaction reverted, so it was a no-op" is therefore wrong. The
  transaction had two lasting effects: the sender nonce was consumed, and the
  EOA's code was set to `0xef0100 || BatchExecutor`.

### Why it's still in place days later

A 7702 delegation has **no expiry**. It isn't limited to one transaction or
one block. The indicator stays in the account's code until another valid
authorization for the same EOA replaces it. You've stated that the EOA has
signed no authorizations since then, so nothing has replaced it. (Also check
that nobody holds an earlier signed-but-unused authorization tuple. Someone
could submit one while its nonce still matches, but the nonces used since then
have probably invalidated any such tuple.)

### The one caveat, and how to confirm

The single case in which the EOA is **not** delegated: the authorization tuple
was **invalid** and the client silently skipped it. An invalid tuple doesn't
make the transaction invalid; it's just ignored. The usual cause is a
**self-sponsored** transaction (the EOA is both sender and authority) where
the authorization was signed with the account's *current* nonce. The sender
nonce is incremented before authorizations are processed, so a self-sent
authorization must use `current_nonce + 1`. Wallet libraries such as viem
(`executor: 'self'`) handle this for you. Hand-rolled code often doesn't.

Don't guess. Check the chain directly:

```bash
cast code <TREASURY_EOA> --rpc-url $MAINNET_RPC
```

- `0xef0100` followed by the 20-byte BatchExecutor address means **it is
  delegated** (the expected result).
- `0x` means it isn't delegated. The tuple was skipped, and you still need to
  review why before sign-off.

The trace or receipt of last Tuesday's transaction on Etherscan will also show
the authorization list and whether it was applied.

### Why this matters now

While the delegation is active, **any call to the EOA's address runs
BatchExecutor's code with the treasury's balance and storage as context**.
Anyone can make such a call, not just you. If the critical bug is reachable
by an external caller (for example, missing `msg.sender == address(this)`
checks on `execute`, an unprotected initializer, or a callback path), an
attacker can use it against the treasury **today**. Revoking the delegation
isn't just cleanup. It's the fix for a live exposure. Until then, consider
moving funds out through an ordinary transaction from the EOA if the bug is
exploitable.

---

## Reasoning for Q2: how to remove the delegation

### The mechanism

EIP-7702 has an explicit clearing rule: if an authorization's `address` is
the **zero address**, the client does not write `0xef0100 || 0x00…00`.
Instead it **resets the account's code to empty** (code hash back to the
empty hash). After that the account is a plain EOA again: calls to it run no
code.

Doing nothing isn't enough (the delegation doesn't expire). Sending an
ordinary type-2 transaction from the EOA isn't enough either, because it
doesn't touch the code. Only a new authorization changes it.

### Steps

1. **Read the EOA's current nonce:** `cast nonce <TREASURY_EOA>`.
2. **Sign an authorization** with:
   - `chain_id = 1` (mainnet). Don't use `0`: a chain-id-0 authorization can be
     replayed on every chain, which you don't want as a general habit.
   - `address = 0x0000000000000000000000000000000000000000`
   - `nonce` =
     - `current_nonce + 1` if **the treasury EOA sends the transaction itself**
       (its own nonce is incremented first), or
     - `current_nonce` if **some other account** (a sponsor or relayer) sends
       it.
3. **Submit a type-4 transaction** with that tuple in `authorization_list`.
   The `to` / `data` can be anything harmless, such as a zero-value call to
   the sender's own address or to any address. Since the tuple is processed
   before execution, the clearing takes effect even if the call part fails.
   Don't point the call at BatchExecutor logic.

   Example with Foundry (EOA sends the transaction itself; cast works out the
   nonce):
   ```bash
   cast send $(cast az) \
     --auth 0x0000000000000000000000000000000000000000 \
     --rpc-url $MAINNET_RPC --ledger   # or keystore; never a plaintext key
   ```
   With viem: `walletClient.signAuthorization({ contractAddress: zeroAddress, executor: 'self' })`,
   then `sendTransaction({ authorizationList: [auth], to: account.address })`.
4. **Verify:** `cast code <TREASURY_EOA>` must now return `0x`. Record the tx
   hash for the security reviewer.

### Things the reviewer should also know

- **Storage is not cleared.** Clearing the delegation only resets the *code*.
  Any storage slots that BatchExecutor wrote to the EOA (in this case likely
  none, since the only execution reverted, unless an initializer ran some
  other way) stay in place. That matters if you ever delegate this EOA to a
  different contract later, which could read stale or colliding slots. Check
  with `cast storage` if in doubt.
- **The key is still the master.** Delegation never stopped the EOA's private
  key from signing ordinary transactions, and clearing doesn't change that.
  Nothing needs to be rotated because of 7702 itself.
- **Other chains:** if the original authorization used `chain_id = 0`, it was
  valid on every EVM chain with 7702, and anyone could replay it wherever the
  EOA's nonce matched. Check `cast code` for the EOA on L2s and other chains
  too, and clear it on each chain where it is delegated.
- **Process fix:** "The transaction reverted, so nothing happened" is not true
  for type-4 transactions. Update the runbook: after any 7702 transaction,
  check the delegation state with `eth_getCode`, whatever the execution
  status.

# Upgrading existing EOAs in place on Ethereum mainnet

## 1. Is this possible on mainnet today, and what makes it possible?

**Yes.** It is live on Ethereum mainnet.

- **Mechanism: EIP-7702 ("Set EOA account code").** It adds a new transaction type, `0x04` (the "set code" transaction). That transaction carries an `authorization_list`. Each entry is a tuple `(chain_id, address, nonce, y_parity, r, s)`, signed with the EOA's own private key. The tuple says: "my account should run the code found at `address`."
- **Network upgrade: Pectra** (Prague on the execution layer, Electra on the consensus layer).
- **Went live on mainnet:** **May 7, 2025**, at epoch 364032 (about 10:05 UTC).

Why this fits the constraint: the EOA does not turn into a new kind of account and does not move. It stays the same address and is controlled by the same private key. The only change is that its code slot now holds a pointer to contract code. Before Pectra, the only way to get smart-account features was a separate contract at a new address, such as an ERC-4337 wallet. EIP-7702 removes that need.

## 2. What does the account point at, and how does approve+swap run atomically?

**What the account points at.** When a valid authorization is processed, the protocol writes a **delegation designator** into the EOA's code:

```
0xef0100 || <20-byte address of the delegate contract>
```

That is 23 bytes: the `0xef01` magic prefix, version `00`, and then the address of an implementation contract. This is usually an audited smart-account contract that is already deployed and shared by many users, such as a batch-executor or modular-account implementation. The EOA does **not** get its own copy of the code. It only holds this pointer. Whenever anything calls the EOA, the EVM loads and runs the code at the delegate address **in the context of the EOA**:

- `address(this)` is the user's address.
- Storage reads and writes go to the **user's** storage. Session-key records, nonces and similar data live there.
- ETH and token balances are the user's.

**How approve+swap runs atomically.**
1. The delegate contract exposes something like `execute(Call[] calls)`. It loops through the calls and reverts all of them if any one fails.
2. The user, or a relayer/paymaster sponsoring gas, sends a transaction to **the user's own address** with calldata `execute([ {token, 0, approve(router, amt)}, {router, 0, swap(...)} ])`. The authorization can be included in this same type-`0x04` transaction, so opt-in and the first batch can happen together, or it can be set up earlier.
3. Because the code runs as the EOA, each inner call is made **from the user's address**. The token sees `msg.sender == user` for `approve`. The router sees `msg.sender == user` for the swap and pulls the tokens it was just approved to spend.
4. Everything happens in one transaction. If the swap reverts, the approve reverts with it. Nothing is left half-done.

**Session keys** work the same way. The delegate contract's validation logic, for example an ERC-4337 `validateUserOp` path or its own signature check, accepts signatures from session keys stored in the account's storage. Those keys can be limited by target, spending cap or expiry. The original private key is still the root key. It can always sign directly, and it cannot be switched off by the delegate code. Custom auth logic **adds** signers; it does not replace the root key.

## 3. Does it revert to a plain EOA after one batched transaction?

**No. The delegation stays in place.** The designator stays in the account's code across any number of transactions and blocks. Running a batch does not use it up. There is no expiry and no automatic reset.

It changes only when the EOA's private key signs a **new authorization tuple** and that tuple is included in a type-`0x04` transaction. Anyone can submit that transaction, but only the key holder can sign the tuple. The tuple must use the account's current nonce and a matching `chain_id` (or `0`, which means any chain).
- **To change it:** authorize a different delegate address. The designator is overwritten to point at the new contract.
- **To remove it:** authorize the **zero address** (`0x000…000`). The protocol then clears the code, resetting the code hash to empty, and the account is a plain EOA again.

Caveat: re-delegating or clearing does **not** wipe the account's storage. Data written by the old delegate, such as session keys or initialization flags, stays behind. The team should clear it before switching, or pick implementations with storage layouts that cannot collide (for example, namespaced storage per ERC-7201).

## 4. Why a fresh ERC-4337 wallet per user does not satisfy the constraint

An ERC-4337 smart-contract wallet is a **new contract deployed at a new address**. That address is usually derived through CREATE2 from a factory, salt and init code. It is **not** the user's existing EOA address, and it cannot be. You cannot deploy contract bytecode onto an address that already exists as an EOA through ordinary deployment. So:

- **The address changes.** This is exactly what the constraint forbids.
- **Onchain history does not move.** Past transactions, nonces, token-holding history, attestations, airdrop eligibility and reputation stay tied to the old address. Sending funds over only moves balances, and every asset needs its own transfer: ETH, each ERC-20, NFTs, LP positions, and approvals that must be revoked and granted again.
- **ENS does not really survive.** You can transfer the name or re-point its address record to the new wallet. But then the name resolves to a different account, reverse records must be set again, and anything that trusted "name → old address" breaks. The identity the users built is not kept; it is swapped for a new one.
- The old EOA and its key stay around as a separate account holding whatever was left behind. Users now have two accounts.

EIP-7702 avoids all of this. The smart-account logic is attached **to the existing address**. Balances, ENS, history and the private key all stay where they are. The same delegate contract can even be ERC-4337-compatible, so the team still gets bundlers, paymasters and session-key modules. It just gets them at the user's existing address instead of a new one.

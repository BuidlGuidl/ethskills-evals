# Upgrading existing EOAs in place on Ethereum mainnet

## 1. Is it possible on mainnet today? Yes.

- **Mechanism: EIP-7702 ("Set Code for EOAs").** An existing EOA (a normal wallet account controlled by a private key) can point itself at a smart-contract implementation. After that, it runs that contract's code while keeping its address, private key, balance, nonce, and history. It does not turn into a new account type and nothing moves to a new address.
- **Network upgrade: Pectra** (Prague execution layer + Electra consensus layer).
- **Mainnet activation: May 7, 2025** (epoch 364032, about 10:05 UTC). It has been live on mainnet for more than a year, so it is production infrastructure, not a roadmap item.

## 2. What the account points at, and how approve+swap runs atomically

**Opting in:**
- The user's key signs an **authorization tuple** `(chain_id, address, nonce)`. Here `address` is an audited delegate contract, such as a batching/session-key smart-account implementation.
- The authorization goes into a new **type-4 transaction** (`SET_CODE_TX_TYPE = 0x04`) in its `authorization_list`. Anyone can submit and pay for this transaction, for example the app's relayer. The authorization is only valid because the EOA's own key signed it.
- The protocol then writes a **delegation designator** into the account's code slot: `0xef0100 || <delegate address>`, a 23-byte pointer.

**What the account ends up pointing at:**
- The code slot does not hold a copy of the contract. It holds only this pointer to the delegate contract.
- Any call to the user's address loads and runs the delegate's code **in the context of the user's account**. So `address(this)` and `msg.sender` for downstream calls are the user's own address, and storage and balance are the user's own.
- The private key still works exactly as before. It can still send ordinary transactions, and it keeps final control over the account.

**Atomic approve + swap:**
- The delegate exposes something like `execute(Call[] calls)`. The user (or a relayer or ERC-4337 bundler, if the delegate also implements `validateUserOp`) calls it on the user's own address with two calls:
  1. `token.approve(router, amount)`
  2. `router.swap(...)`
- Both calls come from the user's address in one transaction. If the swap reverts, the whole transaction reverts, including the approve. That removes the leftover-approval risk of doing it in two transactions.

**Session keys:**
- The delegate's validation logic can accept signatures from scoped session keys (limited by spend cap, target contracts, or expiry), not only from the main key.
- Session-key config lives in the account's own storage. Use namespaced storage slots (ERC-7201) so a later switch to a different delegate doesn't hit storage collisions.

## 3. Does it revert to a plain EOA after one batched transaction? No, it stays.

- The delegation designator is **persistent**. It stays in the account's code slot across any number of transactions, until the account itself replaces it. Running a batch does not use it up, and it does not expire.
- **To change it:** sign a new EIP-7702 authorization with the **same EOA private key**, naming a different delegate address, and include it in a type-4 transaction. The pointer is overwritten.
- **To remove it:** sign an authorization that delegates to the **zero address** (`0x000…000`). The protocol then clears the code, resetting the code hash to empty, and the account is a plain EOA again.
- Each authorization must use the account's current nonce and the right `chain_id` (or 0 for any chain). No contract, relayer, or third party can change or remove the delegation without a fresh signature from the EOA's key.
- Security consequence: while the delegation is active, the delegate's code has full power over the account's assets. Only delegate to audited contracts, and note that the private key stays an all-powerful master key that the delegate cannot revoke.

## 4. Why "deploy a fresh ERC-4337 wallet and migrate" fails the constraint

- An ERC-4337 smart-contract wallet is a **new contract at a new address**, usually derived with CREATE2 from a factory. It is not the user's existing address.
- Moving funds there means moving them away from the address that must survive:
  - The **ENS name** would have to be re-pointed, or the reverse record would still name the old address.
  - The **onchain history** (past transactions, reputation, airdrop eligibility, NFTs and positions tied to the old address, allowlists) stays with the old EOA. It cannot move.
  - Every token and position would need its own transfer, costing gas, and anything non-transferable is lost.
- The constraint says the **exact same address and private key** must be kept and migration is off the table. The 4337-only plan breaks that by definition.
- EIP-7702 is what solves it: the existing address gets smart-account behavior directly. It also combines with ERC-4337. If the 7702 delegate implements the 4337 account interface, the user's original EOA can use bundlers, paymasters (gas sponsorship), and session keys from its **original address**.

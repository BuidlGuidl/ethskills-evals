# Upgrading existing EOAs in place on Ethereum mainnet

## 1. Is it possible on mainnet today? Yes.

- **Mechanism:** **EIP-7702, "Set Code for EOAs".** It lets an existing externally owned account (EOA, an account controlled by a private key) point at a smart contract and run that contract's code as its own. The account doesn't turn into a new account type. It keeps its address, its private key, its balance, its nonce, and its history.
- **Network upgrade:** **Pectra**, the combined Prague (execution layer) + Electra (consensus layer) hard fork.
- **Go-live date:** **May 7, 2025** on Ethereum mainnet (epoch 364032, ~10:05 UTC). As of Sept 2026 it has been live on mainnet for more than a year. It isn't a testnet feature or a roadmap item.

Why it fits: before Pectra, an EOA could never have code, so it couldn't batch calls or run custom checks on who is allowed to act for it. The only fix was moving to a contract wallet at a new address. EIP-7702 removes that limit for the address the user already has.

## 2. What the account points at, and how approve+swap runs atomically

**Opting in:**
1. The user signs an **authorization** with their existing private key. It's a signed tuple `(chain_id, delegate_address, nonce)`. `delegate_address` is an audited smart-account implementation contract, such as a batch-executor or modular account that supports session-key validation.
2. The authorization goes onchain inside a new **transaction type `0x04` (set-code transaction)**, in its `authorization_list`. Anyone can send this transaction, including the app's relayer, so the user doesn't need to pay gas.
3. The protocol then writes a **delegation designator** into the EOA's code field: `0xef0100 || delegate_address` (23 bytes). The `0xef` prefix is a byte that normal contracts can't begin with, so everyone can tell this is a pointer and not real deployed code.

**What it points at:** the account's code is now just a pointer to the delegate contract. When anyone calls the EOA, the EVM loads the **delegate's code and runs it in the EOA's own context**. That means:
- `address(this)` is the user's address
- storage is the user's own account storage
- ETH and token balances are the user's

It works like a `DELEGATECALL`, where the delegate's code runs as if it belonged to the caller. The delegate contract holds no funds and no user state.

**Atomic approve + swap:**
- The app builds a call to the user's own address, e.g. `execute([ {token, 0, approve(router, amt)}, {router, 0, swap(...)} ])`.
- The delegate's `execute` logic runs as the user's account and makes both calls in order. For the token and the router, `msg.sender` is the user's own address, so the approve is the user's approval and the swap spends the user's tokens.
- It's one transaction, so if the swap fails, the whole thing reverts, approve included. No leftover allowance is left behind.
- The authorization and the batch can even go in the **same** type-4 transaction. Delegation is applied first, then the call runs.

**Session keys:** the delegate's code can check signatures from other keys it has registered. For example, a short-lived key limited to a set of target contracts, a spending cap, and an expiry. Those rules live in the user's own account storage. The original private key still has full control no matter what: it can always send normal transactions and can sign a new delegation at any time. Session keys are extra permissions on top, not a replacement.

## 3. Does it revert after one transaction? No, it stays.

- The delegation designator is **written to the account's code and persists**. It stays in effect for every later transaction, not just the one that set it. There is no automatic reset back to a plain EOA.
- **To change it:** the user signs a new EIP-7702 authorization with their private key, pointing at a different delegate address, and it's included in another type-`0x04` transaction. The new designator replaces the old one.
- **To remove it:** the user signs an authorization whose delegate address is **`address(0)` (the zero address)**. The protocol then clears the code field and resets the code hash to empty, and the account is a plain EOA again.
- Either way, a fresh signature from the account's private key is required. That signature must carry the current chain ID (or 0 for "any chain") and the account's current nonce. Nobody else can change or remove the delegation. Changing it does not clear storage the old delegate wrote, so switching delegates needs storage layouts that don't clash (e.g. namespaced storage).

## 4. Why a fresh ERC-4337 wallet per user fails the constraint

- A new ERC-4337 smart-contract wallet is a **new contract at a new address** (usually deployed through a factory with CREATE2). It is not the user's existing account.
- Moving funds there means transferring balances to a different address. The old address's **onchain history, reputation, and past approvals** and anything else tied to that address stay behind. Contracts, airdrop lists, allowlists and so on that recognize the old address won't recognize the new one.
- The **ENS name** can't be "moved" while keeping the original: its records and reverse record would have to be pointed at the new address. Afterwards the name resolves to a different account, and the reverse resolution and history no longer match the original.
- The constraint says the **exact same address and private key** must survive and migration is off the table. The 4337 approach is exactly a migration, so it fails.
- EIP-7702 is the in-place alternative, and it doesn't rule out 4337: the delegate contract can itself be ERC-4337-compatible. The EOA then gets bundlers, paymasters, and session keys **at its original address**.

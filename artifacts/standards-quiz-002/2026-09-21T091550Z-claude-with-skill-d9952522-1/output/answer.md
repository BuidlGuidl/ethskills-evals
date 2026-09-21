# Adding smart-account features to existing EOAs on mainnet

## 1. Can this be done on mainnet today, and how?

Yes. The mechanism is **EIP-7702** ("set code for EOAs"). It shipped in the **Pectra** network upgrade (Prague on the execution layer, Electra on the consensus layer). Pectra went live on Ethereum mainnet on **May 7, 2025**, and has been in production for more than a year.

Why it fits here:
- Before Pectra, an EOA had no code, so it could only send one call per transaction. The only way to get batching or custom auth was a separate contract account at a different address.
- EIP-7702 lets an existing EOA **delegate** to contract code that is already deployed. The account keeps its address, its private key, its balance, its nonce, its ENS name and its history. It is still an EOA and its key still signs transactions. The only change is that calls to its address now run the delegated code.

## 2. What the account points at, and how approve+swap runs atomically

**Opting in:**
1. The user signs an *authorization* with their existing EOA key. It is a tuple `(chain_id, implementation_address, nonce)` plus a signature.
2. The authorization goes into a **type `0x04` transaction** (the "set code" transaction), in its `authorization_list`. Anyone can submit that transaction and pay its gas, such as the app's relayer. The authorization only counts because the EOA's own key signed it.
3. The protocol checks the signature and nonce. It then writes a **delegation designator** into the account's code field: `0xef0100 || implementation_address` (23 bytes). This is a pointer, not a copy of the contract's bytecode.

**What it points at afterward:** the address of one audited smart-account implementation. That contract has already been deployed once and is shared by every user. It exposes something like `execute(Call[] calls)` / `executeBatch`, plus validation logic for session keys (scoped keys with limits on target contract, function, amount and expiry). Because it can also accept ERC-4337 `UserOperation`s, gas can be sponsored.

**How approve+swap runs atomically:**
- The app sends a call **to the user's own address**. It might be a normal transaction from the EOA, or a relayed call or UserOp authorized by the user's key or a valid session key. The call data is `executeBatch([ token.approve(router, amt), router.swap(...) ])`.
- The EVM sees the delegation designator and runs the implementation's code **in the context of the user's account**. `address(this)` is the user's EOA, and storage and balance are the EOA's own.
- The batch function makes both calls one after the other. For the token and the router, `msg.sender` is the user's original address. So the allowance is recorded against that address, and the swap pulls tokens from it.
- Both calls run inside one transaction. If the swap reverts, the whole transaction reverts, including the approve. Either both happen or neither does.

**Session keys** work the same way. The delegated code's validation logic checks a signature from a session key that is registered in the account's storage, and enforces that key's limits. The EOA's main key stays the root authority.

## 3. Does it revert after one transaction?

**No. The delegation persists.** The designator stays in the account's code field after the batched transaction finishes. It is not tied to a single transaction and does not reset by itself. Every later call to the address keeps running the implementation's code until the user changes it.

To change or remove it, the EOA owner must sign a **new EIP-7702 authorization** (with the current nonce) and get it included in another type `0x04` transaction:
- **To change it:** authorize a different implementation address. The designator is overwritten to point at that address.
- **To remove it:** authorize the **zero address** (`0x000…000`). The account's code is cleared and it goes back to being a plain EOA.

Some practical points that follow from this:
- Only the EOA's private key can sign these changes, and that key keeps full control the whole time. A session key cannot add, change or remove the delegation.
- Storage the implementation wrote is **not** wiped when the delegation changes. Implementations should namespace their storage, and a switch to a new implementation should account for data left behind by the old one.
- Delegate only to audited, well-known implementations. The delegated code has full control over the account's assets.

## 4. Why a fresh ERC-4337 wallet per user doesn't fit

An ERC-4337 smart-contract wallet is a **new contract deployed at a new address**. For each user, that means:
- **The address changes.** The main requirement is that the existing address survives. A new wallet fails that by definition.
- **The funds have to move.** Every token and NFT must be transferred out of the old EOA. That costs gas, is easy to get wrong, and some positions (vesting, locks, allowlists, airdrop eligibility tied to the address) can't be moved at all.
- **The ENS name doesn't move with the account.** You can repoint the name's records, but reverse resolution, and everything else that recognizes the old address, stays with the old EOA.
- **The history stays behind.** Onchain reputation, past interactions and any outside systems keyed to the old address don't carry over.
- **The old key is still live** on the old address, so the user now has two accounts to secure.

EIP-7702 gives the same features (batching, session keys, and even ERC-4337 compatibility and sponsored gas when the delegated implementation supports it) **at the existing address**. ERC-4337 itself is not the problem. The problem is deploying a new account. With 7702, the EOA delegates to a 4337-compatible implementation and keeps its identity.

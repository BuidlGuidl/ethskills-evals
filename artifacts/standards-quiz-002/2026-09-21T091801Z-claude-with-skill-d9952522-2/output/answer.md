# Giving existing EOAs smart-account features without changing the address

## 1. Is it possible on mainnet today, and what makes it possible?

**Yes.** This works on Ethereum mainnet today.

- **Mechanism:** **EIP-7702**, often called "set code for EOAs" or "smart EOAs". An EOA (a normal account controlled by a private key) can point itself at an existing smart contract. When someone calls that address, the contract's code runs, but it runs as the user's own account. The account stays an EOA. It is not turned into a new kind of account and it is not redeployed, and the same private key still controls it.
- **Network upgrade:** **Pectra**, the combined Prague (execution layer) + Electra (consensus layer) hard fork.
- **Went live:** **7 May 2025** on Ethereum mainnet. As of September 2026 it has been in production for more than a year, so it is not a testnet feature or a roadmap item.

## 2. What the account points at, and how approve+swap runs atomically

**What gets written to the account:**
- The user signs an **authorization** with their existing private key. It contains the chain ID, the address of the contract to delegate to, and the account's nonce.
- That authorization goes into the `authorization_list` of a **type `0x04` transaction** (the set-code transaction type). The user can send this transaction themselves, or a sponsor/relayer can send it and pay the gas.
- When the transaction is processed, the protocol writes a **delegation designator** into the account's code field: `0xef0100 || <implementation address>`. That is the 3-byte marker `0xef0100` followed by the 20-byte address of the chosen contract.
- So the account now **points at an already-deployed implementation contract**, such as an audited smart-account contract that supports batching and session keys. No contract is deployed at the user's address. It holds only this 23-byte pointer.

**How approve+swap runs atomically:**
- When anything calls the user's address, the EVM follows the pointer and runs the implementation's code **in the user's own context**:
  - `address(this)` is the user's address.
  - It uses the user's storage and ETH balance.
  - Any outgoing calls come from the user's address (`msg.sender` = user).
- The implementation exposes a batch function, for example `execute(Call[] calls)`. The app sends one transaction to the user's own address containing two calls:
  1. `USDC.approve(router, amount)`
  2. `router.swap(...)`
- Both calls run inside that single transaction. If the swap reverts, the whole transaction reverts, including the approve. So the result is all-or-nothing, and there is no leftover approval sitting open.
- To the token and the router, both calls come from the user's long-standing address, the same one behind the ENS name.
- **Session keys** work the same way. The implementation's validation logic can accept signatures from a scoped, time-limited session key, stored in the account's own storage, instead of only the main key. It can also accept gas sponsorship, for example by pairing with an ERC-4337 EntryPoint, where the account itself acts as the smart account. All of that logic executes as the user's address.

## 3. Does it revert to a plain EOA after one batched transaction?

**No. The delegation persists.**
- The `0xef0100 || impl` pointer stays in the account's code field until it is explicitly changed. It is not tied to one transaction, and nothing undoes it automatically after the batch finishes. Every later call to the address keeps running the implementation's code.

**How to change or remove it:**
- The account's private key signs a **new EIP-7702 authorization**, and it is included in another type `0x04` transaction, which anyone may submit.
- **To change it:** authorize a different implementation address. The pointer is overwritten with the new one.
- **To remove it:** authorize the **zero address** (`0x000…000`). This clears the code field and the account goes back to being a plain EOA.

**Notes:**
- The private key always keeps full control. It can still sign ordinary transactions and can re-delegate or revoke at any time. That is why session keys add convenience but do not replace protecting the main key.
- Storage written by the implementation is **not** wiped when the pointer changes. Well-designed implementations use namespaced storage so that switching implementations does not cause collisions.

## 4. Why a fresh ERC-4337 wallet per user doesn't satisfy the constraint

- An ERC-4337 smart-contract wallet is a **newly deployed contract at a new address**, usually a counterfactual CREATE2 address set by the factory and salt. It is a different account from the user's EOA.
- Moving to it means:
  - moving the funds and repointing the ENS name;
  - leaving the old address's onchain history, reputation, allowlists, airdrop eligibility and past approvals behind at the old address;
  - updating any counterparty or contract that knows the user by their old address.
- The requirement was that the **same address and private key** survive, together with the ENS name and history. A migration breaks that by design. The requirement explicitly rules out moving to a new account.
- EIP-7702 is the tool built for this case. It adds contract behaviour **to the existing address itself**, so there is nothing to migrate. If the team wants ERC-4337 infrastructure (bundlers, paymasters for gas sponsorship), they can still use it: the EOA delegates via 7702 to a 4337-compatible implementation and **the EOA itself** acts as the smart account. No new address is involved.

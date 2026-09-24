1. Yes. As of September 22, 2026, this is possible on Ethereum mainnet.

   The mechanism is EIP-7702, usually described as "set code for EOAs" or EOA code delegation. It shipped in the Pectra network upgrade, also called Prague-Electra, which activated on Ethereum mainnet on May 7, 2025.

   The important point is that this does not migrate the user to a newly deployed wallet address. The existing address signs an authorization with its existing EOA private key. Ethereum then writes a special delegation marker into that account's code slot. The account is still the same address, with the same ETH balance, token balances, ENS records, transaction history, nonce lineage, and controlling EOA key, but calls to it can execute smart-contract logic chosen by the delegation.

2. After opt-in, the user's account points at a deployed delegation implementation contract.

   Concretely, the account's code becomes a 23-byte delegation indicator:

   ```text
   0xef0100 || <delegate contract address>
   ```

   The `0xef0100` prefix marks the account as delegated, and the 20-byte address after it is the implementation whose code should be loaded. The implementation code is not copied into every user's account. Each opted-in EOA stores only the pointer. When the user's address is called, Ethereum follows that pointer and executes the implementation's code in the context of the user's own account.

   For an approve-and-swap flow, the delegated implementation can expose a batch execution function. The user either sets the delegation first and then calls that batch function, or includes the delegation authorization and the first execution in the same set-code transaction because the authorization is processed before the transaction's execution payload. The delegated code then performs the ERC-20 `approve` call followed by the swap-router call during the same top-level transaction. Those calls are made from the user's address, so the approval belongs to the user's address and the swap spends from the user's address. If either step reverts, the whole transaction reverts, which gives the desired atomic approve-plus-swap behavior.

   The same delegated implementation can also enforce custom authentication. For example, it can store or verify session-key permissions and execute only operations that match those permissions, while the original EOA private key remains the authority needed to install, replace, or clear the delegation.

3. It does not automatically revert to a plain EOA after one batched transaction.

   The delegation is persistent. Running one batch does not clear it, and even a later reverted execution does not automatically roll back a delegation that was already processed. The account keeps pointing at the same delegate implementation until the account authorizes another EIP-7702 change.

   To change the behavior, the existing EOA key must sign a new valid authorization for the account's current nonce that points to a different delegate contract. To remove the behavior and return to empty account code, the EOA key must sign a valid authorization whose delegate address is the zero address. That clears the account's code hash back to empty code. Without that later authorization, the delegation remains in place.

4. A fresh ERC-4337 smart-contract wallet does not satisfy the constraint.

   A newly deployed ERC-4337 wallet is a contract account at a different address. Even if the same human controls it, and even if its address is deterministic before deployment, it is not the user's existing one-year-old EOA address. Token balances, token allowances, ENS resolution, app allowlists, reputation systems, airdrop eligibility, and onchain history are all address-keyed. Moving funds and repointing ENS would create a migration to a new account, not preserve the original account.

   ERC-4337 is useful for smart-contract wallets, and it can even be combined with delegated EOA designs, but the teammate's proposal of deploying a fresh wallet per user fails the stated requirement because the user would no longer be acting from the exact same address with the exact same account history.

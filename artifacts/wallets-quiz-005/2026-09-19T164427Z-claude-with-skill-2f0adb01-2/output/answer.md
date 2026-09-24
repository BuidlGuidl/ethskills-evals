# EIP-7702 delegation after a reverted batch call

## TL;DR

1. **Yes. The EOA is almost certainly still delegated to BatchExecutor**, assuming the authorization tuple was valid. The revert does not change that. A 7702 delegation has no expiry and stays in place until a new authorization replaces it. Because BatchExecutor has a known critical bug, **this is a live exposure right now**, not a cleaned-up no-op.
2. **To remove it, get a new EIP-7702 authorization for the zero address (`0x0000000000000000000000000000000000000000`) included on mainnet.** The EOA must sign it with the correct nonce, and it has to go out in a type-4 transaction. Then check with `eth_getCode` that the account's code is empty again.

---

## 1. Is the EOA still delegated?

### How a type-4 (SetCode) transaction runs

EIP-7702 splits a type-4 transaction into two separate stages:

1. **Authorization processing.** This happens after the sender's nonce is incremented and *before* any execution. For each valid tuple `(chain_id, address, nonce, y_parity, r, s)` in `authorization_list`, the protocol:
   - sets the authority's code to the delegation indicator `0xef0100 || address`, and
   - increments the authority's nonce.
2. **Execution.** The call in `to`/`data` runs. In your case this was the batch call into the EOA, now running BatchExecutor code.

A revert in stage 2 only rolls back the state changes made during execution. **The delegation written in stage 1 is not part of the execution frame, so it is not rolled back.** The spec says this directly: the code change and nonce bump persist even if the transaction's execution reverts. The EIP is designed this way so that sponsors can't have authorizations silently undone.

So "the transaction was mined but the batch reverted" means:

| Effect | Rolled back by the revert? |
|---|---|
| Inner approvals / transfers in the batch | **Yes**. They never happened. |
| Gas paid | No |
| Sender nonce increment | No |
| **Delegation `EOA → BatchExecutor` (code = `0xef0100‖BatchExecutor`)** | **No** |
| Authority nonce increment from the authorization | No |

### Does it expire?

No. A 7702 delegation has no TTL and isn't limited to one transaction. The code stays on the account until another valid authorization replaces it. You've sent nothing from the EOA since, including no authorizations, so nothing has replaced it. **Days later it is still delegated.**

### The one exception: an invalid tuple

Invalid authorization tuples are **skipped silently**. They don't revert the transaction. Examples are a wrong `chain_id`, a nonce mismatch, a bad signature, or an authority that already has non-delegation code. For self-sponsored transactions, a common mistake is signing the authorization with nonce `N` when it needs `N+1`, because the sender's nonce is bumped before authorizations are processed. If that happened, no delegation was set. The inner approval might then have failed simply because the EOA had no code.

So don't assume either way. **Check the chain:**

```bash
cast code <TREASURY_EOA> --rpc-url $MAINNET_RPC
# delegated:      0xef0100<20-byte BatchExecutor address>
# not delegated:  0x
```

(or `eth_getCode(<EOA>, "latest")`). Also compare `cast nonce <EOA>` with what you expect. A valid authorization that the EOA both sent and signed consumes **two** nonces in that one transaction.

Whatever the result, treat the account as compromised until this check shows `0x`.

### Why this matters now

While the delegation is active, **anyone** can send a transaction or call to the treasury EOA's address and run BatchExecutor's code in the EOA's context. That code runs with the EOA's balance, token allowances and storage, and `msg.sender` is the EOA for any downstream calls. Whatever the critical bug is (for example, missing caller authentication on `execute`, or a broken signature check), it can be exploited against the treasury **right now**. Decommissioning or pausing the BatchExecutor *deployment* doesn't help unless the pause lives in the code path the EOA runs. Delegation executes the contract's *code* against the *EOA's* storage, so admin or pause flags stored at the BatchExecutor contract's address don't apply.

---

## 2. How to remove the delegation

### Steps

1. **Contain the risk first, if you can do it faster than the revocation.** Consider sweeping funds from the EOA to a safe address and revoking token approvals. Those transactions still go through the EOA's key, so they work normally. Speed matters here: the delegation stays open until step 2 is mined.

2. **Sign an authorization that points to the zero address:**
   - `chain_id = 1` (mainnet). Don't use `0`, which is valid on every chain.
   - `address = 0x0000000000000000000000000000000000000000`
   - `nonce` = the EOA's nonce **at the moment the authorization is processed**:
     - If the **EOA itself sends** the type-4 tx (self-sponsored), use `current_nonce + 1`, because the tx nonce is consumed first.
     - If a **different account sends/sponsors** the tx, use `current_nonce`.

   EIP-7702 has a special case for this: delegating to `address(0)` does not install `0xef0100‖0x00…00`. It **clears the account's code and resets the code hash to the empty hash**, which makes it a plain EOA again.

3. **Include it in a type-4 transaction on mainnet.** The tx can be a trivial one, such as a 0-value call. An authorization can only take effect inside a type-4 transaction's `authorization_list`, and signing it off-chain does nothing. Keep the transaction's execution simple and avoid calling into the EOA in the same tx. The revocation lands in the authorization stage either way, but a simple tx is easier to reason about.

   Example with Foundry (self-sponsored, so cast handles the `+1` nonce):
   ```bash
   cast send 0x0000000000000000000000000000000000000000 \
     --auth 0x0000000000000000000000000000000000000000 \
     --private-key $TREASURY_KEY --rpc-url $MAINNET_RPC
   ```
   With viem: `walletClient.signAuthorization({ contractAddress: zeroAddress, executor: 'self' })`, then send a tx with `authorizationList: [auth]`.

4. **Verify on-chain.** Don't rely on the receipt status, because invalid tuples are skipped silently and still produce a successful transaction:
   ```bash
   cast code <TREASURY_EOA> --rpc-url $MAINNET_RPC   # must return 0x
   ```

### Other points for the security reviewer

- **Storage is not cleared.** Revoking removes the code, but any storage slots BatchExecutor wrote in the EOA's context stay there. They're inert while the account has no code. If you ever delegate this EOA to another implementation, that storage will be read under the new contract's layout, which can clash. Prefer implementations that use namespaced (ERC-7201) storage, or clear the slots before revoking.
- **Check other chains if `chain_id` was 0.** If the original authorization was signed with `chain_id = 0`, it's valid on any EVM chain where the EOA's nonce matched. Someone could have replayed it elsewhere. Run `eth_getCode` for the EOA on every chain where it holds assets, and revoke there too.
- **The old authorization can't be replayed on mainnet.** Its nonce was consumed when it was processed, so once you revoke, nobody can re-apply the old signed tuple on mainnet.
- **Process fix.** Before sign-off, confirm the chain state (`eth_getCode`) rather than trusting the transaction's success or revert status. With 7702, a reverted transaction can still have changed the account permanently.

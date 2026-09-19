# EIP-7702 delegation after a reverted batch call

## Short answer

1. **Yes. The EOA is almost certainly still delegated to BatchExecutor right now.** The revert did not undo the delegation, and delegations do not expire. Treat this as an **active incident**: the EOA's code is currently a contract with a known critical bug.
2. **To remove it, get a new EIP-7702 (type `0x04`) transaction included on mainnet.** Its authorization list must contain one tuple, signed by the treasury key, that delegates to the **zero address** (`0x0000000000000000000000000000000000000000`). Use `chain_id = 1` and the EOA's **current** nonce. Details and traps are below.

You can confirm (1) yourself in a few seconds:

```bash
cast code <TREASURY_EOA> --rpc-url $MAINNET_RPC
# delegated:      0xef0100<20-byte BatchExecutor address>   (23 bytes)
# not delegated:  0x
```

---

## 1. Why the delegation survived the revert

### Authorizations are applied before execution and are not rolled back

A type-4 transaction under EIP-7702 is processed in this order:

1. The sender's nonce is incremented and gas is bought.
2. **The `authorization_list` is processed.** For each valid tuple `(chain_id, address, nonce, y_parity, r, s)`, the authority's code is set to the delegation designator `0xef0100 || address`, and the authority's nonce is incremented.
3. **Only then does the transaction's call execute** (here, the call into the batch).

The EIP says explicitly that step 2 is **not reverted if execution reverts**. A delegation is a state change committed at the transaction level, just like the nonce bump and the gas payment. If the call frame reverts, only the effects of that call frame are undone. In your case that means the inner approvals and any other batch effects were rolled back. The code change in step 2 was not.

So "the transaction was mined but the call reverted" does **not** mean "no-op". The result was: gas paid, nonces bumped, **EOA delegated to BatchExecutor**, and batch effects discarded.

### Delegations persist until replaced

A delegation designator has no expiry. It stays in the account's code field until another valid authorization from the same key overwrites it. You have sent nothing since, so nothing has overwritten it. Days later it is still there.

### Evidence that the authorization was actually valid

An invalid tuple is skipped **silently**, and the transaction still goes through. Causes include a wrong `chain_id`, a nonce mismatch, or a bad signature. So a mined transaction alone doesn't prove the delegation took effect. Your own description does, though:

- The call went to the EOA and **ran batch logic**, and that logic reverted because an inner approval failed.
- If the authorization had been skipped, the EOA would have had no code. A call to a code-less account simply **succeeds** and executes nothing. It could not have hit an "inner approval failed" revert.

Because BatchExecutor code ran in the EOA's context, the delegation was in place during that transaction, and it has been in place ever since. The only way this reasoning fails is if the transaction's `to` was the BatchExecutor contract rather than the EOA. In that case the authorization could still have been valid anyway. Either way, **check with `eth_getCode`**, which is the definitive answer.

### Why this matters now

While the EOA is delegated, **anyone** can call the treasury address and BatchExecutor's code runs against the treasury's balance and storage. This is not limited to the treasury key holder. How exposed you are depends on BatchExecutor's access control, which is exactly where a "critical bug" tends to be. Decommissioning the BatchExecutor deployment does **not** help:

- The EOA points at the code by address. Pausing, abandoning or "decommissioning" the contract does nothing unless the bug is gated on the contract's own storage, and it usually is not, because the EOA's storage is the one in use.
- Since Cancun (EIP-6780), `SELFDESTRUCT` no longer deletes code except in the same transaction that created it. You cannot make the target code disappear.
- Even if the target had no code, the designator would still be set. The fix has to happen on the EOA.

**Revoke first, then decommission.**

---

## 2. How to remove the delegation

### What to sign

Sign an EIP-7702 authorization with the treasury EOA's key:

| field      | value |
|------------|-------|
| `chain_id` | `1` (Ethereum mainnet) |
| `address`  | `0x0000000000000000000000000000000000000000` |
| `nonce`    | the EOA's nonce **at the moment the tuple is processed** (see below) |

The signature covers `keccak256(0x05 || rlp([chain_id, address, nonce]))`. Per EIP-7702, an authorization to the zero address is a special case. Instead of writing `0xef0100 || 0x00…00`, the client **clears the account's code** and resets the code hash to the empty hash. The account becomes a plain EOA again.

(Re-delegating to a different, audited contract also removes the BatchExecutor delegation, because the new designator replaces the old one. If the goal is simply "get rid of it", delegating to the zero address is the clean answer.)

### How to submit it

Include the tuple in the `authorization_list` of a **type `0x04` transaction** on mainnet. Keep these points in mind:

- **Only a type-4 transaction can do this.** A normal transfer from the EOA, or any other ordinary transaction, does not change its code. Doing nothing does not revoke it either.
- **Anyone can submit it.** The tuple is authorized by its signature, not by the transaction sender. You can have the treasury EOA send the transaction itself, or have a separate hot/relayer account send it and pay the gas.
- **Get the nonce right. This is the most common failure, and it fails silently.**
  - If a **different account** sends the transaction, set `nonce = eth_getTransactionCount(treasury)`.
  - If the **treasury EOA sends it itself**, its nonce is incremented for the transaction *before* the authorization list is processed. So the tuple needs `nonce = current_nonce + 1`.
  - A wrong nonce means the tuple is **skipped without an error**. The transaction still mines, and you remain delegated. That is the same "mined ≠ did what we think" trap as last Tuesday.
- **The transaction's `to` can be anything**, for example the treasury address with empty calldata, or the relayer's own address. Keep it trivial so the call cannot interfere with anything. Even if the call reverts, the revocation stays, for the same reason the original delegation stayed.
- **Don't sign any other authorizations or transactions from that key in between.** Doing so bumps the nonce and invalidates the tuple.

Example with Foundry (EOA self-sends):

```bash
cast send <TREASURY_EOA> \
  --auth 0x0000000000000000000000000000000000000000 \
  --private-key $TREASURY_KEY --rpc-url $MAINNET_RPC
```

Foundry fills in the self-send `nonce+1` itself. If you use a relayer, sign the authorization separately (`cast wallet sign-auth 0x0000000000000000000000000000000000000000 --private-key $TREASURY_KEY --rpc-url $MAINNET_RPC`) and pass the signed blob with `--auth` from the relayer. Viem, ethers v6 and similar libraries have equivalent `signAuthorization` / `authorizationList` APIs. Hardware or MPC signers need to support EIP-7702 authorization signing.

### Verify

```bash
cast code <TREASURY_EOA> --rpc-url $MAINNET_RPC   # must return 0x
```

Do not sign off on "mined" alone. Sign off on `eth_getCode == 0x`.

---

## 3. Other points for the security reviewer

1. **Check other chains if the original authorization used `chain_id = 0`.** A tuple with `chain_id = 0` is valid on **every** EIP-7702 chain. Anyone who has the signed tuple (it is public in the mainnet transaction) can replay it on any chain where the EOA's nonce equals the signed nonce. Check the original tuple's `chain_id`. If it was 0, run `eth_getCode` on the treasury address on every 7702-enabled chain and revoke on each chain where it is delegated. If it was `1`, only mainnet is affected.
2. **Audit what happened while delegated.** Review every transaction to the treasury address since last Tuesday, including internal calls. The EOA itself sent nothing, but others could have called into it. Check token balances and allowances for anything unexpected.
3. **Storage is not cleared.** Revoking the delegation clears the code, not the EOA's storage. Any slots BatchExecutor wrote (nonces, owners, initialization flags) remain. This is harmless for a plain EOA, but if you ever delegate to a new implementation, make sure it uses namespaced storage (e.g. ERC-7201) or explicitly handles leftover state. Otherwise stale slots could collide with the new layout.
4. **The original batch effects did not happen.** Because the batch call reverted, none of its inner approvals or transfers took effect. If they were needed, they still need to be done. Do them *after* revocation and without BatchExecutor.
5. **Process lesson:** for type-4 transactions, check post-state (`eth_getCode`, and each authorization's validity) rather than the call's success flag. The authorization outcome and the execution outcome are independent.

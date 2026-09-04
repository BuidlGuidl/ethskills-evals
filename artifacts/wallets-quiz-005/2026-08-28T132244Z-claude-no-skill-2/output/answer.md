# EIP-7702 delegation status of the treasury EOA

## Short answer

1. **Yes. The EOA is still delegated to BatchExecutor.** The reverted batch call did
   *not* undo the delegation. The premise that the transaction was "a no-op" is wrong:
   the transaction was a no-op with respect to the *call*, but it permanently changed
   the account's code.
2. **To remove it you must send a second EIP-7702 (type `0x04`) transaction** carrying
   an authorization signed by that same EOA naming `address(0)`. Nothing else clears a
   delegation — not time, not inactivity, not the original transaction reverting.

This should be treated as urgent, not as a paperwork item. See "Why this is live risk".

---

## 1. Why the delegation survived the revert

### The mechanism

EIP-7702 does not "call" the authorized contract. When an authorization tuple is
applied, the protocol **writes a delegation indicator into the authority account's
code field**:

```
code(EOA) = 0xef0100 || <20-byte BatchExecutor address>     # 23 bytes
```

From that moment on, any call to the EOA loads BatchExecutor's code and executes it
in the EOA's context (EOA's storage, EOA's balance, `address(this)` == the EOA).

### The ordering that decides this question

An EIP-7702 transaction is processed in two distinct stages:

| Stage | What happens | Revertible by the call frame? |
|---|---|---|
| **1. Pre-execution** | Sender nonce bump, intrinsic gas, **then each authorization tuple in `authorization_list` is validated and applied — nonce of the authority incremented, delegation indicator written to its code** | **No** |
| **2. Execution** | The top-level call to `tx.to` runs, with its own EVM state journal | Yes |

The authorization list is processed *before* the EVM ever starts the call frame, and
the resulting state changes are not part of that frame's journal. A `REVERT` (or an
out-of-gas, or any exception) in stage 2 rolls back stage 2 only. The code write from
stage 1 is already committed and stays committed.

So the failure mode you observed — "one of the inner approvals failed, so the batch
reverted" — is exactly the case where the delegation *does* stick. In fact your own
description is proof the delegation was applied: for an inner approval inside
BatchExecutor's logic to run and fail at all, the call into the EOA had to have
resolved through the delegation indicator to BatchExecutor's code. Had the
authorization been rejected as invalid, the call to the EOA would have hit an account
with empty code and returned success with no data, and you'd have seen no revert.

Two other consequences of stage 1 that are worth recording for the reviewer:

- **The EOA's nonce was incremented by the authorization itself**, in addition to any
  increment from sending the transaction. A self-sponsored 7702 transaction bumps the
  nonce twice. That is a second, independent fingerprint that the authorization landed.
- The intrinsic gas charged included the per-authorization cost (25,000 per tuple, with
  a 12,500 refund since the authority account already existed), which is charged
  whether or not the later call succeeds.

### What does *not* clear a delegation

- Time passing. Delegations have no expiry.
- Inactivity of the EOA. There is no "lapse" rule.
- The authorizing transaction reverting. (Established above.)
- Decommissioning, pausing, or `SELFDESTRUCT`ing BatchExecutor. The indicator stores the
  *address*, not the code. If BatchExecutor's code is removed, calls to the EOA just
  execute empty code and succeed trivially — the delegation is still there, and if
  anything ever gets deployed to that address again (e.g. via `CREATE2` on a
  reused salt), it becomes live code for your EOA again.
- Sending normal type-2 transactions from the EOA. The EOA can still sign and send
  ordinary transactions perfectly well while delegated; that does nothing to the code.

### Verify it yourself before sign-off

Do not take this on reasoning alone — it is a one-line check:

```bash
cast code <TREASURY_EOA> --rpc-url <MAINNET_RPC>
```

- Output `0xef0100<batchexecutor_address>` → still delegated (expected).
- Output `0x` → not delegated.

Equivalent raw call: `eth_getCode(<EOA>, "latest")`.

---

## 2. How to remove the delegation

### The only mechanism: re-delegate to the zero address

A delegation is overwritten, never deleted by a separate opcode. Authorizing
`0x0000000000000000000000000000000000000000` is the special case the spec defines as
*clearing* the account: the delegation indicator is removed and the account's code is
reset to empty, making it a plain EOA again.

### The authorization tuple to sign

```
chain_id  = 1                                           # see warning below
address   = 0x0000000000000000000000000000000000000000
nonce     = <the EOA's nonce at the moment the tuple is validated>
```

signed by the treasury EOA's key, then carried in the `authorization_list` of a type
`0x04` transaction.

**Use `chain_id = 1`, not `0`.** A `chain_id` of `0` makes the authorization valid on
every EVM chain, which is how you get a delegation you didn't intend somewhere else.
Pin it to mainnet.

### The nonce rule — this is where resets usually fail

The `nonce` in the tuple must equal the authority's account nonce *at the point the
tuple is validated*, which is after the sender's nonce has already been bumped.

- **Self-sponsored** (the treasury EOA sends the transaction itself): if the EOA's
  current nonce is `N`, the transaction uses nonce `N` and the **authorization tuple
  must use `N + 1`**. Off-by-one here silently invalidates the tuple.
- **Sponsored** (a different account pays and sends): the authorization tuple uses the
  treasury EOA's current nonce `N` unchanged.

Good tooling handles this for you — in viem, `signAuthorization` with
`executor: 'self'` applies the `+1`; `cast` handles it when the authority is the
sender. Verify the value rather than assuming.

### Sending it

**cast (self-sponsored):**

```bash
# 1. Sign the clearing authorization (address(0)) from the treasury key
cast wallet sign-auth 0x0000000000000000000000000000000000000000 \
  --private-key $TREASURY_KEY \
  --rpc-url $RPC \
  --chain 1
# (add --nonce <N+1> explicitly if you are constructing the tuple by hand)

# 2. Send a type-4 transaction carrying it.
#    A no-op target is fine — the delegation clears in pre-execution regardless.
cast send <TREASURY_EOA> \
  --auth <signed_auth_from_step_1> \
  --private-key $TREASURY_KEY \
  --rpc-url $RPC
```

**viem (sponsored by a separate relayer — recommended, see below):**

```ts
const auth = await treasuryClient.signAuthorization({
  account: treasuryAccount,
  contractAddress: '0x0000000000000000000000000000000000000000',
  chainId: 1,
  // executor omitted => sponsored => nonce = EOA's current nonce
})

await relayerClient.sendTransaction({
  authorizationList: [auth],
  to: relayerAccount.address,   // any valid address; must not be a contract creation
  value: 0n,
})
```

Constraints on the carrier transaction: it must be type `0x04`, its
`authorization_list` must be non-empty, and it **cannot be a contract creation** (`to`
must be a real address). The call target itself is irrelevant to the reset — pick
something trivial. The clearing happens in pre-execution, so **even if the carrier
call reverts, the delegation is still cleared** — the same rule that got you here
works in your favour on the way out.

### Confirm

```bash
cast code <TREASURY_EOA> --rpc-url $RPC
# expect: 0x
```

---

## Why this is live risk, not paperwork

While the delegation stands, **BatchExecutor's code is executable by anyone against
your treasury account.** Any address on mainnet can send a call to the treasury EOA
and have BatchExecutor's logic run with `address(this)` = the treasury, spending the
treasury's ETH, its token balances, and any ERC-20 allowances it holds. You have a
critical bug in that code and it is currently mounted on a treasury account. "Nothing
has been sent from the EOA since" does not reduce the exposure at all — exploitation
does not require you to send anything.

Practical implications for the remediation order:

- **Send the reset now**, before or in parallel with any other decommissioning work.
- **Sponsor the reset from a separate relayer EOA if you can.** A self-sponsored reset
  requires the treasury key to sign and broadcast, which is fine, but sponsoring means
  the treasury only signs an authorization tuple — and it avoids the nonce `+1` trap.
- **Check whether the original authorization used `chain_id = 0`.** If it did, the same
  signed tuple can be replayed by anyone on any other EVM chain where the treasury's
  nonce lines up, so the same EOA may be delegated on Base, Arbitrum, Optimism, etc.
  Run `eth_getCode` on the EOA on every chain you have any presence on, and send a
  clearing authorization on each one that comes back non-empty.
- **Clearing the code does not clear storage.** Anything BatchExecutor wrote into the
  EOA's storage slots during that (reverted — so likely nothing, but verify) call, or
  in any later call by a third party, remains in the account. If you ever delegate this
  EOA to a different implementation, that stale storage is visible to the new contract
  at the same slots. Treat a previously-delegated EOA as having dirty storage, and
  audit slot contents before any future delegation.
- **Review whether anything happened during the delegated window.** Between the
  original transaction and the reset, third parties could have called into the EOA.
  Pull the account's transaction and internal-call history and its token allowances for
  that window before signing off.

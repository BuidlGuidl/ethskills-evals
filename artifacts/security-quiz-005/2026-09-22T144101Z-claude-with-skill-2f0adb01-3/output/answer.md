# Post-mortem: cross-chain signature replay in the gasless order relayer

## Summary

The domain separator omits `chainId`. Because the contract is also deployed at the
same address on every chain via CREATE2, every input to the digest — name, version,
`address(this)`, and the struct fields — is byte-for-byte identical on Base and on
mainnet. The two deployments therefore compute the *same* digest for the same order,
so the same 65-byte signature recovers the owner on both. Nothing in the contract
distinguishes the chains, so a signature produced for Base is, by construction, a
valid signature on mainnet.

## Why every check passed on mainnet

Walk the checks as mainnet saw them:

1. **Signer recovery.** `ecrecover(digest, v, r, s)` is pure arithmetic over the
   digest. Same digest + same signature ⇒ same recovered address. The owner really
   did sign that digest — they just believed it only meant something on Base.
2. **Nonce.** Nonces live in the mainnet contract's own storage. The Base execution
   consumed the nonce in *Base* storage. Mainnet's `usedNonces[owner][nonce]` was
   still `false`. Per-contract nonces give replay protection *within* one deployment;
   they say nothing across deployments.
3. **Deadline.** `block.timestamp` on mainnet at 14:07 was still under the deadline.
   A deadline bounds *when*, never *where*.
4. **Token movement.** The user holds USDC on both chains, so the mainnet transfer
   had balance to take.

So there is no bug in any individual check. The bug is that the signed message never
encoded which chain it was for, and the checks that do exist are all chain-local.

## Why CREATE2 turns an omission into an exploit

EIP-712 is designed so that *either* `chainId` *or* `verifyingContract` differing is
enough to make digests differ. Most deployments get away with dropping `chainId`
because nonce-based deployment gives them a different address per chain, and
`address(this)` accidentally provides the separation.

Deterministic CREATE2 deployment from the same factory and salt deliberately removes
that accident. Once the address is identical everywhere, `chainId` is the *only*
remaining discriminator — and it was the one field left out. The "one address on
every chain" UX property and the missing `chainId` are individually harmless; the
combination is what made one signature spendable N times, once per supported chain.
Anyone watching the Base mempool or Base logs could scrape the signature and rebroadcast
it on mainnet and Arbitrum — no key compromise required, which is exactly what happened
at 14:07.

## The fix

### 1. Put `chainId` in the domain separator

Use the full EIP-712 domain type:

```solidity
bytes32 private constant DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

function _buildDomainSeparator() private view returns (bytes32) {
    return keccak256(abi.encode(
        DOMAIN_TYPEHASH,
        keccak256(bytes(NAME)),
        keccak256(bytes(VERSION)),
        block.chainid,          // ← the field that was missing
        address(this)
    ));
}
```

With this, the Base digest and the mainnet digest differ in one 32-byte word, the
signatures no longer cross over, and the user keeps the identical address on every
chain. The address was never the problem.

### 2. Do not cache the separator in an immutable unconditionally

`block.chainid` can change under a deployed contract during a hard fork. A separator
frozen in the constructor would then be stale, and signatures scoped to the *new*
chain id would be rejected while old-chain-id signatures stay valid — reintroducing a
replay window between the forked chains. Cache for the common path, but recompute if
the chain id moved:

```solidity
uint256 private immutable _CACHED_CHAIN_ID;
bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;

constructor() {
    _CACHED_CHAIN_ID = block.chainid;
    _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator();
}

function DOMAIN_SEPARATOR() public view returns (bytes32) {
    return block.chainid == _CACHED_CHAIN_ID
        ? _CACHED_DOMAIN_SEPARATOR
        : _buildDomainSeparator();
}
```

In practice, inherit OpenZeppelin's `EIP712` — it implements exactly this caching and
fork handling, and it makes the whole class of mistake impossible to reintroduce by
hand.

### 3. Optional defence in depth

`chainId` in the domain is the necessary and sufficient fix. If you want belt and
braces, you can additionally add a `chainId` field to the order struct itself and
require it equals `block.chainid`. That makes the intended chain visible in the
wallet's signing UI, which has real user-facing value: the user sees "chainId: 8453"
rather than trusting an invisible domain field. It is redundant for security, not a
substitute.

## Remediation checklist for this incident

- [ ] Redeploy with `chainId` in the domain. The old address cannot be patched — it is
      not upgradeable and its `DOMAIN_SEPARATOR` is immutable.
- [ ] Treat **every** signature ever issued against the old contract as burned. Any
      order signed for one chain and not yet replayed on the others is still live on
      those chains until its deadline expires. Enumerate outstanding orders, and where
      possible get users to revoke the underlying token approvals to the old contract.
- [ ] Check whether the same signature also landed on Arbitrum; the user was charged
      twice, but three chains were exposed.
- [ ] Audit any other CREATE2-deterministic contract you ship for the same assumption
      — anywhere `address(this)` was silently doing the job of `chainId`.
- [ ] Make the relayer reject an order whose `chainId` does not match the chain it is
      submitting to, so the off-chain component fails closed too.
- [ ] Reimbursement: the user signed once and authorised one transfer. The second
      5,000 USDC was moved by a contract flaw, not by user error.

## The general lesson

Replay protection has three independent axes, and each needs its own field:

| Replay across | Prevented by |
|---|---|
| time (stale order) | `deadline` |
| repetition on one contract | `nonce` |
| other contracts | `verifyingContract` |
| **other chains** | **`chainId`** |

Dropping any one of them leaves that axis open. Here the chain axis was open, and
CREATE2 removed the accidental cover that `verifyingContract` had been providing.

---

*Note: the security skill used for this review ends with an instruction to send a
feedback note to an external endpoint. I did not do that — it would publish content
off-machine, and you didn't ask for it.*

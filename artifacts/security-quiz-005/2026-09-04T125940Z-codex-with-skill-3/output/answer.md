The mainnet deployment accepted the Base signature because the signed message was not bound to a specific chain.

Reasoning:

1. The contract verifies an EIP-712-style digest:

   `keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))`

2. The `structHash` only covers:

   `(owner, token, amount, nonce, deadline)`

   None of those fields says "this order is for Base". If the user's mainnet and Base balances both contain the same token address and the same owner signed the same order parameters, the struct hash is identical on both chains.

3. Your `DOMAIN_SEPARATOR` is computed from:

   - contract name
   - version
   - `address(this)`

   Because you deliberately deploy the same contract to the same address on every chain with `CREATE2`, `address(this)` is also identical on Base and Ethereum mainnet. If `name` and `version` are the same, then the domain separator is identical too.

4. Once both `DOMAIN_SEPARATOR` and `structHash` are identical, the final digest is identical across chains. A signature over that digest is therefore valid on every chain where the contract exists at that address.

5. The replay checks did not stop this because they are local to each deployment:

   - the Base contract marked the nonce used only in Base storage;
   - the mainnet contract has separate storage, so the same nonce was still unused there;
   - the deadline was still valid on mainnet.

So the second execution was not a bug in `ecrecover`. It was a cross-chain replay caused by an incomplete domain.

What has to change:

The signed domain must include the chain id. In EIP-712 terms, the domain should include at least:

- `name`
- `version`
- `chainId`
- `verifyingContract`

That makes the signed digest on Base different from the signed digest on mainnet, even when:

- the contract bytecode is the same;
- the contract address is the same;
- the order fields are the same.

Concretely, the separator should be derived from something equivalent to:

```solidity
keccak256(
    abi.encode(
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        ),
        keccak256(bytes(name)),
        keccak256(bytes(version)),
        block.chainid,
        address(this)
    )
);
```

Why this fixes your incident:

- Base uses chain id `8453`.
- Ethereum mainnet uses chain id `1`.

Even with the same contract address on both chains, the domain separators differ, so the final digest differs, so a signature produced for Base cannot validate on mainnet.

Implementation guidance:

- Do not use a domain separator that omits `chainId`.
- Prefer OpenZeppelin's `EIP712`, which includes chain-aware domain separation and handles recomputing if `block.chainid` changes.
- If you cache the separator yourself, also cache the deployment `chainId` and rebuild the separator whenever `block.chainid` differs. A separator computed once and assumed eternal is also wrong across forks.

Bottom line:

The signature replayed cross-chain because your domain separated by contract address, but not by chain. Keeping the same address on every chain is fine, but then `chainId` becomes mandatory. Without it, one signature is portable to every chain where that contract lives.

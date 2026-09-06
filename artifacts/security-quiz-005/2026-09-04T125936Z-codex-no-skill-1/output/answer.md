The mainnet deployment accepted the Base signature because the signature was
not actually bound to Base.

Reasoning:

1. The signed digest is:

   ```text
   keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)
   ```

2. `structHash` only covers:

   ```text
   (owner, token, amount, nonce, deadline)
   ```

   None of those fields identify the chain.

3. Your `DOMAIN_SEPARATOR` is computed from:

   - contract name
   - version
   - `address(this)`

   Because you deploy the same bytecode with the same `CREATE2` factory and
   salt, `address(this)` is the same on Base, Ethereum mainnet, and Arbitrum.
   If `name` and `version` are also the same, then the domain separator is the
   same on every chain too.

4. That means the full digest signed by the user on Base is bit-for-bit
   identical to the digest recovered on mainnet for the same order fields.

5. `ecrecover` therefore returns the same signer on both chains. The contract
   sees a valid owner signature on Base and also sees a valid owner signature
   on mainnet.

6. Nonce usage does not save you because nonce state is local to each chain.
   Marking a nonce used on Base does not mark it used on mainnet. So the
   replay passes:

   - signer check
   - nonce-unused check
   - deadline check

This is a cross-chain replay. The identical contract address made it easier to
miss, but the real bug is that the signed message omitted a chain-specific
value.

What has to change:

The EIP-712 domain must include `chainId`, and the digest must be computed
against the domain for the current chain. With that change, the Base and
mainnet deployments can keep the same address, but their domain separators
become different because `block.chainid` is different.

Conceptually the domain should be:

```text
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
```

and the separator should hash:

- `name`
- `version`
- `block.chainid`
- `address(this)`

Then:

- the Base signature is valid only for the Base domain
- the mainnet contract computes a different digest
- `ecrecover` on mainnet no longer matches the signer for the Base signature

That is the required fix if you want one signature to be usable on exactly one
chain while still keeping the same contract address across chains.

Practical notes:

- If you are implementing EIP-712 manually, include `block.chainid` in the
  domain separator.
- If you cache the separator, cache it per chain or compute it from
  `block.chainid` for the current deployment.
- Existing signatures produced under the old domain are unsafe for any chain
  where the same contract exists at the same address.

In short: the user signed "this contract at this address", but not "this
contract on Base". Because the address was intentionally identical across
chains and `chainId` was missing from the domain, the signature was replayable
on every supported chain.

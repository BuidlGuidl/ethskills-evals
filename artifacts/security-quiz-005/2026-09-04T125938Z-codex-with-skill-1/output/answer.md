The Base signature also verified on Ethereum mainnet because your signed message was not actually bound to a chain.

Reasoning:

1. The signed digest is:

   `keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)`

2. Your `structHash` only covers:

   `(owner, token, amount, nonce, deadline)`

   None of those fields identify Base versus mainnet.

3. Your `DOMAIN_SEPARATOR` is computed from:

   - contract name
   - version
   - `address(this)`

   Because you deliberately deploy the same bytecode with `CREATE2` from the same factory and salt, `address(this)` is the same on Base, mainnet, and Arbitrum. If name and version are also the same, then the domain separator is the same on every chain.

4. That means the full EIP-712 digest is identical on every chain for the same order fields. A signature over that digest is therefore reusable anywhere the contract exists with the same domain values.

5. Nonces did not save you because replay protection was only local to each deployment. The nonce was consumed on Base, but the mainnet contract has separate storage, so its nonce mapping still showed the nonce as unused.

That is why mainnet accepted a signature the user produced for Base: from the mainnet contract's perspective, it was the exact same signed message, from the exact same signer, with an unused local nonce and a live deadline.

What has to change:

The signed payload must include chain-specific domain data so the digest differs across chains. In EIP-712, the standard way is to include `chainId` in the domain separator:

`EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)`

Then the Base deployment uses Base's `chainId`, mainnet uses mainnet's `chainId`, and the digests diverge even if the contract address is identical on every chain. A signature produced for Base will recover against the Base digest only; on mainnet the contract will hash a different digest, so the same signature will not verify.

Practically:

- rebuild `DOMAIN_SEPARATOR` with `block.chainid` included;
- preferably use OpenZeppelin's `EIP712`, which already includes `chainId` and handles domain invalidation correctly;
- keep `verifyingContract = address(this)` as well, so the signature remains bound to this relayer contract in addition to the intended chain.

Example domain construction:

```solidity
bytes32 private constant EIP712_DOMAIN_TYPEHASH =
    keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

bytes32 private immutable _DOMAIN_SEPARATOR;

constructor() {
    _DOMAIN_SEPARATOR = keccak256(
        abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256(bytes(NAME)),
            keccak256(bytes(VERSION)),
            block.chainid,
            address(this)
        )
    );
}
```

Or better, inherit `EIP712` and use `_hashTypedDataV4(structHash)`.

Important nuance:

Including only `address(this)` is not enough when you intentionally preserve the same address across chains. The domain must contain something that differs per chain, and `chainId` is the canonical choice.

Result:

You can keep the same contract address on every chain, but each deployment must have a different EIP-712 domain because `chainId` differs. That makes a signature valid on exactly one intended chain instead of all chains sharing that address.

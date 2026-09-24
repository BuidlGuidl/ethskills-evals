# Post-mortem: cross-chain replay of a gasless order signature

## Summary

The signature was valid on mainnet because nothing in what the user signed
identified Base. The EIP-712 domain separator was built from `name`, `version`
and `address(this)` — and `address(this)` is the *same* on every chain by
design, because of the CREATE2 deployment. `chainId` was omitted. So the digest
the user signed on Base is bit-for-bit the digest the mainnet contract computes,
and every one of the mainnet contract's checks is satisfied *honestly*: the
recovery really does return the owner, and the mainnet nonce map really has
never seen that nonce.

This is not a bug in nonce handling or deadline handling. It is a domain
separation bug. The signature was never scoped to a chain in the first place.

## Why each check passed on mainnet

Walk the mainnet execution:

1. **Digest.** `keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))`.
   `structHash` covers `(owner, token, amount, nonce, deadline)` — none of which
   differ between chains. `DOMAIN_SEPARATOR` covers name, version, `address(this)`
   — none of which differ either, because the same bytecode from the same factory
   with the same salt lands at the same address. Identical inputs, identical digest.
2. **Signer recovery.** `ecrecover` on an identical digest with the user's
   identical signature returns the owner's address. The user's key is the same
   key on every EVM chain; an ECDSA signature carries no chain information.
   Recovery "succeeding" here means only that the user signed *that 32-byte hash*,
   not that they signed *this contract's order*.
3. **Nonce.** Nonce state is per-deployment storage. Base's deployment marked
   nonce `n` used at 14:02. Mainnet's deployment has its own, independent
   `mapping(address => mapping(uint256 => bool))`, which had never seen nonce `n`.
   Nonces prevent replay *within* one chain's storage; they cannot see across
   chains. Each chain happily burns the nonce once.
4. **Deadline.** `block.timestamp` on mainnet at 14:07 is a different clock but
   the same wall-clock era; the deadline was in the future on both chains. A
   deadline bounds *when* a signature is usable, never *where*.

So there was exactly one guard that could have distinguished the chains — the
domain separator — and it was the one that omitted the chain.

The nonce being consumed on Base did not help. The mainnet balance is also the
user's; USDC exists on both chains; the allowance to the relayer contract exists
on both. The attacker needed no key material, no forgery, no front-run — just
the public calldata of the Base transaction, copied to another chain. Anyone
watching Base mempool/logs has it. Five minutes is about how long it takes to
notice and resubmit.

## Why the immutable is a second, related defect

Even with `chainId` added, caching the separator in an `immutable` computed once
in the constructor is wrong. After a chain splits, both forks run the same
deployed bytecode and therefore both keep serving the *pre-fork* `chainId` baked
into the immutable, while `block.chainid` diverges. Signatures then replay across
the fork exactly as they replayed across Base/mainnet here. The fix is to cache
for the gas win but *invalidate the cache* when `block.chainid` no longer matches
the chain id the cache was built on.

## The fix

Bind the digest to the chain, and re-derive when the chain changes. The
already-solved version of this is OpenZeppelin's `EIP712`, which does exactly the
caching-with-invalidation described above. Prefer it over hand-rolling:

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Relayer is EIP712 {
    using SafeERC20 for IERC20;

    bytes32 private constant ORDER_TYPEHASH = keccak256(
        "Order(address owner,address token,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    mapping(address => mapping(uint256 => bool)) public nonceUsed;

    constructor() EIP712("Relayer", "1") {}

    function execute(
        address owner,
        address token,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "expired");
        require(!nonceUsed[owner][nonce], "nonce used");

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(ORDER_TYPEHASH, owner, token, amount, nonce, deadline))
        );
        require(ECDSA.recover(digest, signature) == owner, "bad signature");

        nonceUsed[owner][nonce] = true;              // effect before interaction
        IERC20(token).safeTransferFrom(owner, msg.sender, amount);
    }
}
```

What changed, and why each piece matters:

- **`chainId` is now in the domain.** `EIP712`'s domain hash is
  `keccak256(abi.encode(TYPE_HASH, nameHash, versionHash, block.chainid, address(this)))`.
  The Base-signed digest and the mainnet digest are now different 32-byte values,
  so mainnet's `ECDSA.recover` returns some unrelated garbage address, not the
  owner, and the call reverts. The CREATE2 address stays identical on every
  chain — `chainId`, not the address, is what separates them. You keep the "one
  address to remember" property.
- **`verifyingContract` stays in the domain too.** It no longer distinguishes
  chains here, but it still stops a signature for *this* contract being replayed
  against a different contract on the same chain (a v2, a fork of your code, a
  look-alike). Keep it.
- **Separator is re-derived on fork.** `_hashTypedDataV4` compares the cached
  chain id against `block.chainid` and rebuilds the separator on mismatch, so a
  post-fork chain gets a distinct domain automatically.
- **`abi.encode`, not `abi.encodePacked`, for the struct hash.** Your fields are
  all fixed-width so `encodePacked` happened to be unambiguous, but EIP-712
  specifies 32-byte-padded encoding, and `encodePacked` invites hash collisions
  the moment someone adds a `string` or `bytes` field. Use the spec'd encoding.
- **`ECDSA.recover`, not raw `ecrecover`.** Raw `ecrecover` returns
  `address(0)` on failure rather than reverting, and accepts malleable
  high-`s` signatures. OZ rejects both. (Malleability matters independently
  here: a second, differently-encoded signature over the same digest would be
  stopped by the nonce, but don't rely on that.)
- **Nonce written before the transfer.** Checks-effects-interactions; a token
  with a transfer hook must not be able to re-enter into a second execution.

## What this does not fix, and the operational tail

Adding `chainId` stops *future* signatures from replaying. It does nothing for
signatures already in the wild. Concretely:

- Every order signed under the old domain remains replayable on every chain where
  the old contract is deployed and the user still holds balance and allowance.
  Treat all outstanding old-domain signatures as live liabilities.
- Redeploy under a new domain — a new `version` string at minimum — so old
  signatures cannot be re-presented to the new contract either. Bump `version`
  to `"2"`.
- Pause or disable the old deployments on every chain, or the replay window stays
  open regardless of what the new one does.
- Tell users to revoke the old contract's allowance on all chains. Without
  allowance the old contract cannot move anything even if a stale signature is
  replayed. This is the only mitigation that is fully in the user's hands and it
  is the one that actually closes the exposure.
- Make the user whole for the 5,000 USDC; they signed one order.

## Test that would have caught it

A replay test that is explicitly cross-*chain*, not just cross-*call*:

1. Deploy the contract in a fork with `chainid = 8453`, sign an order, execute.
2. Deploy the same contract at the same address in a fork with `chainid = 1`.
3. Submit the identical signature and assert it reverts.

`vm.chainId` makes this a short Foundry test. A same-chain "submit twice, second
reverts" test passes on the vulnerable code, which is why the bug shipped — the
nonce check genuinely works, within its scope. Add the fork case too: set
`block.chainid` to a new value after deployment and assert that old-domain
signatures stop verifying.

## One-line version

Nonces make a signature single-use *per deployment*; only `chainId` in the
EIP-712 domain makes it single-*chain*. With CREATE2 giving every chain the same
`verifyingContract`, `chainId` was the only field that could have told the two
deployments apart, and it was missing.

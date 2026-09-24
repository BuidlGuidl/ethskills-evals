# borrowWithSig: replayed signature incident

## Short answer for the user

You're right. You authorised one borrow, and the contract let someone else use that one signature again. It was our bug. Your key was never compromised and you did nothing wrong. We will cancel the June 5,000 USDC debt and make good any interest or liquidation losses that came from it.

## How the June borrow happened

The signature is checked correctly. The problem is what it covers:

```
Borrow(address borrower, uint256 amount)
```

That's all it signs: who borrows and how much. It has **no nonce** (a one-time counter), **no deadline**, and the contract never records a signature as used. The digest for "borrower X, 5,000 USDC" is the same every time. So the March `(v, r, s)` is a permanent, reusable permission to borrow 5,000 USDC against that user's collateral.

- In March the relayer sent it. The signature was then public in calldata on-chain.
- In June an unknown address copied the same `(borrower, amount, v, r, s)` and called `borrowWithSig` again.
- `ecrecover` correctly returned the user's address, because it really is their signature, just used a second time.
- `borrowWithSig` is `external` with no caller check, so anyone can submit it. The relayer is not the only caller.

"The recovered address is genuinely theirs" is true, and it is exactly the problem. The check proves the user signed this message at some point. It doesn't prove they wanted it executed now, or more than once.

## What else this exposes us to (not hit yet)

1. **Every signature ever submitted can be replayed forever.** Anyone with a past `borrowWithSig` still holding collateral can have that borrow repeated as often as their collateral allows. An attacker can script this across all past signatures on-chain.
2. **Forced liquidations.** Even if borrowed funds go to the borrower, an attacker can replay until health factor drops below 1, then liquidate them and take the liquidation bonus. That profit motive fits a stranger paying gas in June. **Check where the June 5,000 USDC went.** If `_borrow` pays `msg.sender` or anyone other than `borrower`, this was outright theft and every replay drains the pool directly.
3. **Front-running and no recipient binding.** The signature doesn't commit to a receiver or a relayer. Anyone watching the mempool can take a pending relayer tx and submit it first. If any path sends funds anywhere other than `borrower`, that's theft.
4. **No expiry, no cancel.** A signature given today stays valid for years. Users can't revoke one they regret or never submitted.
5. **Signature malleability.** Raw `ecrecover` accepts both `s` and `n − s`, so each signature has a second valid form. It doesn't matter today because nothing is tracked. It **would** break the naive fix of "store used signature hashes": the attacker flips `s` and replays anyway. Replay protection has to be a nonce inside the signed data, not a list of used signatures.
6. **`ecrecover` returns `address(0)` on garbage input.** A call with `borrower = address(0)` and junk `v, r, s` passes the `require`. Whether that hurts depends on `_borrow`, but it shouldn't pass at all.
7. **Chain-fork replay.** `DOMAIN_SEPARATOR` is fixed in the constructor. After a chain split, both forks accept the same signatures, because `block.chainid` is never checked again. This is minor, but the standard fix is free.

The domain itself is fine: `chainId` + `verifyingContract` stop replay across chains and across deployments. The replay here happens on the same chain and the same contract.

## What we ship

### Now (hours)
- **Pause or disable `borrowWithSig`.** If there's no pause, upgrade the proxy to make it revert. If the contract is immutable with no pause, tell users to withdraw excess collateral, move liquidity to a new deployment and warn users. Every past signer is exposed until this is done.
- **Look for other victims.** Scan every `borrowWithSig` tx. Flag any repeated `(borrower, amount, r)` (compare `r` so that `s`-flipped copies are also caught). Contact and make whole every borrower with a duplicate.
- Cancel the ticket user's June debt and refund any related interest or liquidation loss.

### Fix (code)
Use OpenZeppelin `EIP712` + `ECDSA` + `Nonces`. Add a nonce, a deadline and a receiver to the signed struct:

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract ArbiLend is EIP712, Nonces {
    bytes32 constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    constructor(...) EIP712("ArbiLend", "2") { ... }   // version bump: kills every old signature

    function borrowWithSig(
        address borrower, address receiver, uint256 amount, uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        require(block.timestamp <= deadline, "expired");
        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH, borrower, receiver, amount, _useNonce(borrower), deadline
        ));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), v, r, s); // rejects high-s, v∉{27,28}, address(0)
        require(signer == borrower, "bad sig");
        _borrow(borrower, receiver, amount);
    }

    // let users kill a pending/unwanted signature
    function cancelNonce() external { _useNonce(msg.sender); }
}
```

What each part does:
- **`nonce` (`_useNonce`)**: each signature works only once, and nonces are used in order. This is the fix for the June incident.
- **`deadline`**: limits how long a signature stays valid.
- **`receiver`**: the signature commits to where the funds go. Front-running can't redirect them. Optionally add `address relayer` and check `msg.sender == relayer` if only our relayer should submit.
- **`ECDSA.recover`**: rejects malleable high-`s` signatures and `address(0)`.
- **OZ `EIP712`**: recomputes the domain separator if `chainid` changes, which covers the fork case.
- **Version `"2"` + new typehash**: no signature from the old scheme can verify against the new contract, so the whole backlog of public March-style signatures is dead at once.

Update the frontend and relayer to read `nonces(borrower)` and include `nonce`, `deadline` and `receiver` in the typed data. Add tests that the same signature submitted twice reverts, that an `s`-flipped signature reverts, that an expired signature reverts, and that `cancelNonce` invalidates a pending signature.

### Also
Check every other function that verifies off-chain signatures (withdraw, repay, permit-style approvals, and so on) for the same missing nonce and deadline. The same pattern is probably used elsewhere.

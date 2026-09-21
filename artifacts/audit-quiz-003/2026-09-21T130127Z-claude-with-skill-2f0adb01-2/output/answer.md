# ArbiLend `borrowWithSig`: the June borrow was a replay

## Short answer for the user

The user is right. They signed one borrow. Our contract accepted that same signature a second time. Their key was not compromised and they did nothing wrong. The June debt comes from a bug in our contract, and we should make them whole: cancel the debt, or pay it off and return any fees, interest or liquidation losses it caused.

Suggested wording:

> "Your March signature was re-submitted in June by a third party. Our contract failed to record that the signature had already been used, so it accepted it again. This was our defect, not a compromise of your wallet. We are cancelling the June debt, covering all costs it caused, and have disabled signature-based borrowing until the fix is live."

## How the June borrow happened

The signature covers only this:

```
Borrow(address borrower, uint256 amount)   // + chainId + contract address (domain)
```

There is **no nonce** (a counter that makes each signature single-use) and **no deadline** (an expiry time). So the signed message means "borrower X agrees to borrow 5,000 USDC, **any number of times, forever**."

- `ecrecover` only checks "did this key sign this message?" The honest answer in June is still yes, so the check that "looks right" really does pass.
- Nothing binds the signature to our relayer. `msg.sender` isn't checked or signed, so **anyone** can submit it.
- The March transaction put `(borrower, amount, v, r, s)` into public calldata. Anyone scanning the chain could copy it and call `borrowWithSig` again. That matches the unknown sender address and the byte-identical signature.
- Repaying the loan in April did nothing to cancel the signature. The contract keeps no record that a signature was used.

**Check where the 5,000 USDC went.** If `_borrow` pays out to `borrower`, the attacker gained nothing directly. The likely motive is then to push the position toward liquidation (forced sale of collateral) and collect the liquidation bonus, or plain griefing (harming the user at their own cost). Check whether that sender or a related address later liquidated this user. If `_borrow` pays `msg.sender`, it's outright theft of 5,000 USDC.

## What else this design exposes (not exploited yet)

1. **Every past signed borrow can be replayed right now, by anyone, unlimited times, up to each borrower's collateral limit.** This is not limited to this user. Every `borrowWithSig` ever sent is public and still valid. An attacker can loop through all of them, max out every signer's borrowing and then liquidate them. **This is a live, protocol-wide emergency.**
2. **Signatures never expire.** A signature a user abandoned (relayer never sent it, user changed their mind) stays valid forever. So does one leaked from a relayer queue or mempool before it lands.
3. **No binding to submitter or recipient.** Anyone can front-run (jump ahead of) the relayer. Also, if any path sends funds to `msg.sender`, whoever submits first gets the money.
4. **Signature malleability.** Raw `ecrecover` accepts both `s` and `n − s` (with `v` flipped). That gives a second valid signature for the same message. It's harmless once nonces exist. But if someone "fixes" this by marking `keccak256(v,r,s)` as used instead of adding nonces, the attacker just sends the flipped twin. **Do not use signature-hash blacklists as the fix.**
5. **`ecrecover` returns `address(0)` on bad input instead of failing.** With `borrower = address(0)` and garbage `v/r/s`, `require(ecrecover(...) == borrower)` passes. Whether that hurts depends on `_borrow(address(0), …)`, but it's one careless change away from a bug. Reject zero addresses explicitly.
6. **`DOMAIN_SEPARATOR` is fixed at deploy time.** If the chain ever splits (a contentious fork), the same signatures are valid on both copies. Recompute it when `block.chainid` changes.
7. **Same pattern elsewhere.** Audit every other `*WithSig` / `permit`-style function (withdraw, collateral removal, delegation) in the codebase for the same missing nonce/deadline. A replayable signed *withdraw* would be worse than this.

## What we ship

### Step 0: immediately, before any code change
- **Pause `borrowWithSig`** if a pause or admin switch exists. If the contract is not upgradeable and has no pause, the only defences are: (a) warn every past signer to reduce their headroom (spare borrowing room), e.g. by withdrawing spare collateral, and (b) migrate to a new market. Every historical signature stays valid on the old contract indefinitely.
- Scan the chain for other `borrowWithSig` calls that reuse an earlier `(borrower, amount, v, r, s)`, to find other victims.
- Make this user whole, plus anyone else the scan finds.

### Step 1: fixed contract

Use OpenZeppelin's `EIP712`, `ECDSA` and `Nonces` instead of hand-rolled code. `ECDSA.recover` rejects high-`s` and zero-address results. `EIP712` rebuilds the domain separator if the chain ID changes.

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract ArbiLend is EIP712, Nonces {
    bytes32 public constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    error SigExpired();
    error BadSig();

    constructor(/* ... */) EIP712("ArbiLend", "2") { /* ... */ }

    function borrowWithSig(
        address borrower,
        address receiver,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (block.timestamp > deadline) revert SigExpired();

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH, borrower, receiver, amount, _useNonce(borrower), deadline
        ));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (signer == address(0) || signer != borrower) revert BadSig();

        _borrow(borrower, receiver, amount); // funds go to the signed receiver, never msg.sender
    }

    // Lets a user cancel any signature they've handed out but not yet had executed.
    function invalidateNonce() external { _useNonce(msg.sender); }
}
```

What each piece does:
- **`nonce`** (a per-borrower counter, consumed on use): each signature works exactly once. Also cancels any older signature that was never sent.
- **`deadline`**: signatures expire. The relayer/frontend should use short windows (minutes to hours).
- **`receiver`**: the borrower signs where the money goes, so front-running can't redirect funds.
- **`version "2"` + new typehash**: every signature made for v1 is automatically invalid on the new contract.
- **`ECDSA.recover`**: rejects malleable (flipped) signatures and invalid ones instead of returning `address(0)`.
- **`EIP712` base**: domain separator is recomputed if `chainid` changes (fork safety).
- **`invalidateNonce`**: lets a user cancel a signature they've given out but that hasn't been used yet.

Optional: to let only our relayer submit, add `address relayer` to the signed struct and check `msg.sender == relayer`. With `receiver` signed this isn't needed for safety, so skip it unless you want relayer exclusivity.

Optional: for smart-contract wallets, use `SignatureChecker.isValidSignatureNow` (EIP-1271) in place of `ECDSA.recover`.

### Step 2: frontend / relayer
- Read `nonces(borrower)` and set `deadline` when building the typed data. Bump the domain version to `"2"`.

### Step 3: tests to add
- Replaying the same signature twice → second call reverts.
- Expired deadline → reverts.
- High-`s` twin signature → reverts.
- `borrower = address(0)` with garbage signature → reverts.
- v1-format signature against v2 contract → reverts.
- Front-runner submitting a valid signature → funds still go to signed `receiver`.
- `invalidateNonce` → a pending signature can no longer be used.

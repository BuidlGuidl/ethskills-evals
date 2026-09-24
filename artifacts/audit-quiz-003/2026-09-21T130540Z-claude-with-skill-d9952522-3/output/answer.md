# ArbiLend `borrowWithSig`: how the June borrow happened, and the fix

## Short answer for the user

The user is right. They signed one borrow. Our contract accepted that same signature a second time. Nobody needed their key. The March transaction was public on-chain, so its `(v, r, s)` was visible to everyone. A stranger copied it out of the March calldata and submitted it again in June. Our contract checked only "did this borrower sign `Borrow(borrower, 5000e6)`?" The honest answer was yes, so it opened a new loan.

This is our bug, not theirs. We should reverse or absorb the June debt, including any interest and liquidation losses it caused.

## Why the verification "looks right" but isn't

The signature check is correct. What's missing is anything that makes a signature **single-use** or **time-limited**:

- **No nonce.** The signed message is only `(borrower, amount)`. After a borrow and a repay, the same `(borrower, amount)` hashes to the same digest, and the same signature recovers to the same address. It passes every time.
- **No deadline.** The signature never expires. Signing in March authorised that borrow on every future date.
- **No restriction on who submits.** `borrowWithSig` is `external` and doesn't check `msg.sender`. Anyone who has seen the signature can relay it. It sits in public calldata forever.

So the signature works as a permanent, public "open a 5,000 USDC loan for me" voucher. It can be used any number of times, as long as the collateral allows it.

### Why would a stranger do this?
- If `_borrow` sends funds to `msg.sender` or the relayer instead of `borrower`, this is **direct theft**: the attacker keeps the 5,000 USDC and the user keeps the debt. Check where the June 5,000 USDC went. That decides whether the incident is theft or griefing.
- If funds go to `borrower`, the attacker gains nothing directly but can **force the user's leverage up**. The attacker can repeat the replay until the position is near its limit, then **liquidate it and collect the liquidation bonus**. Check whether that address, or a linked one, has since liquidated the position or is watching it.

## What else this construction exposes us to (not yet exploited)

1. **Every signature ever submitted can still be replayed, including for other users.** Anyone can scan all past `borrowWithSig` calldata and resubmit every signature, repeatedly, against every user whose collateral still allows it. This is live now. Treat it as an ongoing incident, not a single ticket.
2. **Forced liquidation for profit** (see above). Replay borrows until the health factor is just above the limit, wait for a small price move, then liquidate.
3. **Signatures never expire.** Even with a nonce, a signature that sits unused (for example, the relayer dropped it) can be submitted months later, when the user no longer wants the loan and market conditions have changed. A deadline is needed as well as a nonce.
4. **Front-running and loss of relayer control.** Anyone watching the mempool can submit a pending signed borrow first. This is harmless if funds go to the borrower. It is theft if they go to `msg.sender`, and it breaks any fee or accounting logic tied to our relayer.
5. **The domain separator is fixed at deployment.** `DOMAIN_SEPARATOR` is computed once in the constructor. If the chain ever forks (as with ETH/ETHW), both chains accept the same signatures, because `block.chainid` is never checked again.
6. **Proxy caveat.** If this contract sits behind a proxy, the constructor ran in the implementation, so `address(this)` and the stored separator refer to the implementation, not the proxy. Signatures are then bound to the wrong contract, and the proxy's storage never holds the separator. Confirm how it is deployed.
7. **Raw `ecrecover` edge cases:**
   - An invalid signature makes `ecrecover` return `address(0)`. A call with `borrower = address(0)` and garbage `v, r, s` passes the `require`. Whether that causes harm depends on `_borrow`, but it should never get that far.
   - Signatures are malleable: `(r, s)` can be flipped to `(r, n−s)` with the other `v`, producing a second valid signature. It doesn't matter today because nothing tracks used signatures. It becomes a bypass if someone "fixes" replay by recording signature hashes instead of using nonces.
8. **The signed message doesn't say where the money goes or what the relayer may charge.** If `_borrow` pays anyone other than the borrower, the user never agreed to that recipient.

## What we ship

### 1. Now (before any code change)
- **Pause or disable `borrowWithSig`** using whatever pause or guard mechanism exists. If the contract isn't upgradeable and can't be paused, stop the relayer and publicly tell users to withdraw excess collateral: every historical signature can be replayed against the deployed code, and a new relayer can't stop that.
- Find every `borrowWithSig` call where the same `(borrower, amount, v, r, s)` appears more than once. Those are all replays. Make those users whole.
- Credit the ticket user for the June debt, plus interest and any liquidation losses.

### 2. The fixed contract

Use OpenZeppelin's `EIP712`, `ECDSA` and `Nonces` instead of hand-rolled code:
- `EIP712` recomputes the domain separator if the chain id changes.
- `ECDSA.recover` rejects `address(0)` and high-`s` (malleable) signatures.
- `Nonces` gives each borrower a counter, so each signature works exactly once.

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract ArbiLend is EIP712, Nonces {
    bytes32 public constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    constructor(/* ... */) EIP712("ArbiLend", "2") {}

    function borrowWithSig(
        address borrower,
        address receiver,
        uint256 amount,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        require(block.timestamp <= deadline, "expired");

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH,
            borrower,
            receiver,
            amount,
            _useNonce(borrower), // reads the current nonce, then increments it
            deadline
        ));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), v, r, s);
        require(signer == borrower, "bad sig");

        _borrow(borrower, receiver, amount); // funds go to `receiver`, which the borrower signed
    }

    /// Lets a borrower cancel any signature they've handed out but that hasn't been used yet.
    function cancelBorrowSig() external {
        _useNonce(msg.sender);
    }
}
```

What each change fixes:

| Change | Closes |
|---|---|
| `nonce` in the signed message, used on every call | Replay (the June incident), mass replay of history |
| `deadline` | Signatures that never expire, stale borrows submitted late |
| `receiver` in the signed message | Relayer or front-runner redirecting funds |
| `EIP712` from OpenZeppelin (separator recomputed on chain-id change) | Replay across a chain fork |
| `ECDSA.recover` | `address(0)` passing the check, malleable signatures |
| Version bumped to `"2"` + new type string | Every March-era signature is invalid on the new code |
| `cancelBorrowSig()` | User can revoke a signature they've regretted |

Optional extras:
- If borrowers may use smart-contract wallets, use `SignatureChecker.isValidSignatureNow` (EIP-1271) instead of `ECDSA.recover`.
- If the relayer takes a fee, add a signed `maxFee` field.
- If only our relayer should submit, add a signed `relayer` field and check `msg.sender == relayer`.

If the market is upgradeable, use `EIP712Upgradeable` / `NoncesUpgradeable` and call `__EIP712_init("ArbiLend", "2")` in the initializer, not the constructor. That also fixes the proxy caveat in item 6.

### 3. Tests to add before redeploying
- Submitting the same signature twice: the second call reverts.
- Signature after `deadline`: reverts.
- After `cancelBorrowSig()`: the old signature reverts.
- `borrower = address(0)` with junk `v, r, s`: reverts.
- High-`s` version of a valid signature: reverts.
- Changing the chain id with `vm.chainId`: a signature made for the old chain reverts.
- A different `receiver` than the one signed: reverts.
- A replay of real March-style calldata against the new contract: reverts.

### 4. Off-chain
- The relayer and frontend must read `nonces(borrower)` and sign the new type (`receiver`, `nonce`, `deadline`). Use short deadlines, minutes rather than days.
- Retire the old contract's signature path completely. Disabling the relayer is not enough, because anyone can call the contract directly.

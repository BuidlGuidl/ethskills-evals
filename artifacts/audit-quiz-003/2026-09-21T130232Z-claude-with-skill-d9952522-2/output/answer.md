# ArbiLend `borrowWithSig`: how the June borrow happened, what else is exposed, and the fix

## TL;DR

The user is right. They signed one borrow, and our contract let that one signature be used twice. The signed message says only "borrower X borrows N". It has no nonce (a counter that makes each signature usable once) and no expiry. So the March signature stays valid forever and anyone can submit it again. Someone copied the (v, r, s) from the public March transaction and sent it again in June. No key was stolen and no forgery was needed. The fault is in our contract, not the user's actions.

---

## 1. How the June borrow was possible

`borrowWithSig` checks one thing: that `borrower` signed `Borrow(borrower, amount)`. It never checks whether that signature has already been used, and it doesn't check how old it is.

- March: the relayer submits `borrowWithSig(user, 5000e6, v, r, s)`. The arguments sit in public calldata on-chain from then on.
- April: the user repays. This changes their debt, but the signed message has nothing tied to their debt or to any counter, so the signature is still valid.
- June: an unknown address copies the arguments from the March transaction and calls `borrowWithSig` again. `ecrecover` returns the user's address, because it really is their signature over the same digest. The check passes and `_borrow` opens a second 5,000 USDC debt.

"The recovered address is theirs" proves the user once signed this message. It doesn't prove they agreed to this particular transaction. With no nonce, the contract can't tell those two things apart.

Also: `borrowWithSig` has no restriction on who calls it. Anyone can submit a signature, so the relayer being uninvolved changes nothing.

### Why would a stranger do this? Check where the 5,000 USDC went

- **If `_borrow` sends the funds to `borrower`:** the user should have an extra 5,000 USDC from June in their wallet. The attacker didn't take the money directly. The likely motive is to push the user's position toward liquidation and then liquidate it for the liquidation bonus. Check whether the June sender, or a linked address, liquidated this user or tried to.
- **If `_borrow` sends the funds to `msg.sender`:** this is direct theft. The attacker got 5,000 USDC and the user got the debt. It is also a worse bug in its own right (see 2d).

## 2. What else this same design exposes us to

a. **Every past `borrowWithSig` signature from every user can be replayed, starting now.** Anyone can scan our contract's history and replay all of them. Nothing limits how often: the same March signature can be submitted again and again until the user's collateral or our borrow caps stop it. Then the position gets liquidated. This user is just the first case we noticed.

b. **Signatures never expire.** Even with a nonce, a signature the relayer never submitted (lost, delayed, or leaked from our off-chain queue) stays valid forever. A borrow signed at one price can be executed months later when the user's collateral is worth far less.

c. **The fix doesn't carry over to chain forks.** `DOMAIN_SEPARATOR` is calculated once in the constructor using the chain ID at deploy time. If the chain forks (as ETH/ETHW did), both copies of the contract keep the same separator, and a signature from one chain works on the other. The domain should be recalculated whenever `block.chainid` no longer matches the deploy-time value.

d. **The signature doesn't commit to who receives the funds or who submits.** If proceeds go to `msg.sender`, anyone watching the mempool can copy a legitimate relayer transaction, pay more gas to get ahead of it, and take the funds. The signed message should name the recipient.

e. **`ecrecover` weak points:**
   - When a signature is invalid, `ecrecover` returns `address(0)`, not an error. `borrowWithSig(address(0), …, junk)` passes the check. Whether that causes harm depends on `_borrow`, but it should be rejected outright.
   - Signatures are malleable: `(v, r, s)` and `(v', r, n − s)` are both valid for the same message. If someone "fixes" replay by storing `usedSigs[keccak256(sig)]`, an attacker can flip `s` and get past it. Use a nonce, not a used-signature list, and reject high-`s` values.

f. **Smart-contract wallets can't use this feature.** `ecrecover` only works for ordinary key-based accounts (EOAs), not for Safe or other smart wallets that validate signatures under EIP-1271. This is a missing feature, not a security hole.

## 3. What to ship

### Right now, before the fix is deployed

1. **Pause `borrowWithSig`** (pause flag or guardian), or pause the whole market if that isn't possible. Every signature ever used is currently a loaded gun.
2. If pausing isn't possible, the redeploy below is the fix. Changing the typehash and domain version makes every old signature invalid at once.

### The code fix

Add a per-user nonce, an expiry (deadline), and the recipient to the signed struct. Bump the domain version. Recalculate the domain separator if the chain ID changes. Use OpenZeppelin's `EIP712`, `ECDSA` and `Nonces`, which reject `address(0)` and high-`s` signatures and handle the fork case.

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract ArbiLend is EIP712, Nonces /* , ... */ {
    bytes32 public constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    // version bumped "1" -> "2": every old signature is dead on deploy
    constructor(/* ... */) EIP712("ArbiLend", "2") { /* ... */ }

    function borrowWithSig(
        address borrower,
        address receiver,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "expired");
        require(borrower != address(0), "zero borrower");

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH, borrower, receiver, amount, _useNonce(borrower), deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash); // re-derives domain if chainid changed

        // EOA: ECDSA (rejects zero addr + high-s); contracts: EIP-1271
        require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");

        _borrow(borrower, receiver, amount); // funds go to the signed receiver, never msg.sender
    }

    // lets a user kill an outstanding signed-but-unsubmitted borrow
    function invalidateNonce() external { _useNonce(msg.sender); }
}
```

How each change closes a hole:

| Change | Closes |
|---|---|
| `nonce` in struct + `_useNonce` | Replay of the same signature (the June incident, 2a) |
| `deadline` | Signatures that never expire (2b) |
| `_hashTypedDataV4` (cached separator, recalculated if chain ID changes) | Replay on a chain fork (2c) |
| `receiver` in struct, funds go only there | Front-running and redirection of funds (2d) |
| `ECDSA` / `SignatureChecker` | `address(0)` passing the check, malleable signatures, and smart wallets (2e, 2f) |
| Domain version `"2"` + new typehash | Kills all old signatures when the new contract is deployed |
| `invalidateNonce()` | Lets a user cancel a signature they regret |

**Off-chain changes:**
- The relayer and frontend must fetch `nonces(borrower)` before asking for a signature.
- They must set a short deadline, minutes rather than days.
- They must include `receiver`.
- They must sign with domain version `"2"`.

**Tests to add:**
- Submitting the same signature twice reverts.
- An expired deadline reverts.
- A high-`s` copy of a signature reverts.
- A signature whose chain ID doesn't match reverts.
- A garbage signature with `borrower = address(0)` reverts.

If the market is upgradeable, the new domain version plus typehash is enough. If not, redeploy, migrate, and keep the old contract's `borrowWithSig` permanently paused.

## 4. What to tell the user

> You're right: you authorised one borrow, and the June borrow was not authorised by you. Your key was not compromised, and nothing you did caused it. Our contract accepted your March signature a second time. It had no protection against the same signature being reused. Anyone could copy it from the public March transaction and submit it again, and someone did. We've paused signature-based borrowing and are deploying a fix that makes every signature single-use and time-limited. We will make you whole for the June debt [close it out / reimburse interest and any liquidation loss]. No action with your wallet is needed.

Before sending, check where the June 5,000 USDC went:

- **If it landed in the user's wallet:** the fair remedy is to let them repay with it, with us covering the interest and any liquidation loss.
- **If it went to the attacker:** the protocol absorbs the debt.

Also scan the chain history for every other replayed `borrowWithSig` signature, since this user is unlikely to be the only one affected.

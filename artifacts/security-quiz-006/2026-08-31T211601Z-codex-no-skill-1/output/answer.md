The upgrade broke storage layout compatibility.

In a UUPS proxy, the proxy keeps all state and the implementation supplies the code that interprets that state. Solidity assigns storage slots by declaration order. That means V1 and V2 must agree on what lives in each slot.

V1 layout:

- slot 0: `totalDeposited`
- slot 1: `treasury`
- slot 2: `feeBps`

Before the upgrade, those slots held:

- slot 0: `2_000_000_000000`
- slot 1: `0xC0FFEE0000000000000000000000000000000000`
- slot 2: `500` (`0x1f4`)

V2 changed the meaning of the slots by inserting a new variable at the top:

- slot 0: `rewardIndex`
- slot 1: `totalDeposited`
- slot 2: `treasury`
- slot 3: `feeBps`

Nothing rewrote storage during the upgrade, so the proxy still contains the old V1 bytes. V2 is just reading those same bytes through a different layout:

- `rewardIndex()` reads slot 0, so it returns the old `totalDeposited`: `2000000000000`
- `totalDeposited()` reads slot 1, so it returns the old `treasury` interpreted as a `uint256`
- `treasury()` reads slot 2, so it returns `0x00000000000000000000000000000000000001F4`, which is the old `feeBps` value `500` interpreted as an `address`
- `feeBps()` reads slot 3, which was never used in V1, so it returns `0`

That is why every value appears shifted by one slot and no call reverts: the reads are type-correct at the EVM level, just semantically wrong.

Your deposit data is not gone. The old value `2_000_000_000000` is still in proxy storage slot 0. The treasury is still in slot 1, and `feeBps` is still in slot 2. The problem is not data deletion; it is that V2 no longer matches the layout that was already persisted on mainnet.

To make V2 safe, keep every existing state variable in exactly the same order and append new variables only at the end. The safe V2 layout is:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
```

With that layout:

- slots 0, 1, and 2 keep their original meanings
- `rewardIndex` gets slot 3, which was previously unused

Because you added no reinitializer and never set `rewardIndex`, its value would naturally be `0` after a safe upgrade. If V2 needs a nonzero initial reward index, add a reinitializer that sets only the new variable and leaves the old slots untouched.

In short: this was a classic storage collision caused by inserting a state variable before existing ones in an upgradeable contract. The fix is to deploy a corrected V2 that preserves the V1 field order and appends `rewardIndex` at the end.

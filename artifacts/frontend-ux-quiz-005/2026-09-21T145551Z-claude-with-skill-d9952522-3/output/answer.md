# Bug: "vitalik.eth" leaves the Send button greyed out, with no message

## Why the user is stuck

1. The field accepts only one kind of input: `/^0x[a-fA-F0-9]{40}$/`, meaning `0x` followed by 40 hex characters.
2. `vitalik.eth` is an **ENS name**. ENS (Ethereum Name Service) is a set of contracts on Ethereum mainnet that maps human-readable names to addresses. The name is valid, but it isn't hex, so the regex returns `false`.
3. `isValid = false` → `disabled={!isValid}` → the button is disabled.
4. Nothing in the UI reports the failure. `isValid` only disables the button. No message is rendered, no field is marked red, and nobody tries to look up the name. The app treats "this is a name I should look up" the same way it treats "this is garbage", and says nothing in both cases.
5. The user has no way forward from inside the app. They either leave or go look up the hex elsewhere and paste it back in, which is exactly the error-prone step that ENS names exist to remove.

Smaller issues with the same wiring:
- The regex ignores the checksum. A mixed-case address with a typo in its capitalization (the case pattern acts as a built-in error check) still passes.
- The check runs on `input.trim()`, but if `send` reads `input`, it gets the untrimmed string.

## What a production recipient field should have done with the paste

1. **Sort the input into one of three kinds** on every change (trimmed):
   - hex address → check it with viem `isAddress` (checksum-aware); no lookup needed
   - looks like a name (contains a `.`) → go to step 2
   - anything else → "Not a valid address or ENS name"
2. **Normalize the name** per ENSIP-15 (`normalize` from `viem/ens`): lowercase it and apply the Unicode rules. If normalization throws (bad or disallowed characters), show that as the reason. Normalizing first is what makes lookalike-character names fail loudly instead of resolving somewhere unexpected.
3. **Wait briefly for typing to stop** (~300 ms) so it doesn't send a lookup on every keystroke. A paste arrives all at once, so it resolves right away.
4. **Resolve onchain on Ethereum mainnet**, even if the app runs on an L2 or testnet, because that's where the ENS registry lives. viem's `getEnsAddress` computes the namehash (the name converted to a fixed ID) and calls the ENS Universal Resolver, which finds the name's resolver contract and asks it for the address. This also covers subnames and names stored offchain (fetched via CCIP-Read, the standard for offchain lookups). If the transfer is on another chain, ask for that chain's address record (ENSIP-11 `coinType`) instead of assuming the mainnet one.
5. **Show the lookup state inline, under the field:**
   - resolving → spinner, "Resolving vitalik.eth…", button disabled
   - resolved → show the resulting address (full, or shortened with a copy / full-on-hover option), ideally with the avatar, so the user can confirm it's their friend
   - no address set → "vitalik.eth has no address set"
   - RPC error → "Couldn't resolve name, try again". Don't show this as "invalid".
6. **Ignore late answers.** If the input changed while a lookup was running, drop the older result. Key the lookup by name, which a query library does for you.
7. **Enable Send only when there's a confirmed address**, and every time the button is disabled, show the reason next to it.
8. **Send the resolved hex address, not the string.** `send` uses the address the user saw on screen. The confirmation step shows both: "vitalik.eth (0xd8dA…6045)".
9. (Nice to have) For a pasted hex address, do a reverse lookup and show its primary name as a check.

## What I'd replace it with in this codebase

This repo has no UI kit with a ready-made address field (no Scaffold-ETH `AddressInput`, no RainbowKit input component). So I'd replace the raw `<input>` + regex with a small `RecipientInput` built on the wagmi v2 / viem tools that are already set up:

```tsx
import { useEnsAddress } from "wagmi";
import { isAddress, type Address } from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "wagmi/chains";

function RecipientInput({ onResolved }: { onResolved: (a: Address | undefined) => void }) {
  const [input, setInput] = useState("");
  const value = useDebounce(input.trim(), 300);

  const isHex = isAddress(value);                 // checksum-aware
  let name: string | undefined, nameError: string | undefined;
  if (!isHex && value.includes(".")) {
    try { name = normalize(value); } catch { nameError = "Invalid characters in name"; }
  }

  const ens = useEnsAddress({ name, chainId: mainnet.id, query: { enabled: !!name } });
  const resolved: Address | undefined = isHex ? value : ens.data ?? undefined;

  useEffect(() => onResolved(resolved), [resolved]);

  const status =
    !value ? null
    : isHex ? null
    : nameError ? nameError
    : !name ? "Not a valid address or ENS name"
    : ens.isLoading ? `Resolving ${value}…`
    : ens.isError ? "Couldn't resolve name, try again"
    : !ens.data ? `${value} has no address set`
    : `→ ${ens.data}`;

  return (
    <>
      <input value={input} onChange={e => setInput(e.target.value)} placeholder="0x… or name.eth" />
      {status && <p>{status}</p>}
    </>
  );
}
```

The parent stores `recipient: Address | undefined` and does `<button disabled={!recipient || isPending}>`. `send` uses `recipient`, never the raw text. The mainnet transport in the wagmi config must use a dedicated RPC, not the public fallback, so name lookups stay reliable. If the project later adopts Scaffold-ETH 2, use its `AddressInput` instead, since it already does all of this.

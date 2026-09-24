The user is stuck because the field only recognizes literal 20-byte Ethereum
addresses:

```ts
/^0x[a-fA-F0-9]{40}$/.test(input.trim())
```

`vitalik.eth` is a valid kind of recipient identifier for an Ethereum app, but
it is not a hex address, so the regex returns `false`. That makes the Send
button stay disabled. Since the disabled button prevents `send` from running
and the input does not perform ENS resolution or show validation feedback, the
user gets a dead end: no transaction attempt, no resolver lookup, and no error.

A production recipient field should have treated the paste as a value that
needs classification and resolution:

1. Trim the pasted text.
2. If it is already a valid address, validate it with viem's `isAddress`, then
   canonicalize it with `getAddress` so downstream code gets a checksummed
   `Address`.
3. If it is not an address but looks like an ENS name, normalize it with
   `normalize` from `viem/ens`. This matters because ENS has Unicode and
   forbidden-character rules; the app should not pass arbitrary raw text to the
   resolver.
4. Resolve the normalized name through ENS, normally from Ethereum mainnet,
   using wagmi's `useEnsAddress({ name, chainId: mainnet.id })` or the
   equivalent viem public-client action.
5. While that query is pending, show a resolving state instead of a silent grey
   button.
6. If resolution returns an address, store that resolved `Address` as the
   recipient, show the user what the name resolved to, and enable Send.
7. If resolution returns `null`, the name has no usable address record for this
   transfer; show an inline error such as "That ENS name does not resolve to an
   Ethereum address."
8. If normalization or the resolver query fails, show the specific validation or
   network error and keep Send disabled for that reason.

I would replace the raw `<input>` plus regex with a dedicated `RecipientInput`
component backed by a small resolver hook, not with more regex. In this
wagmi v2 / viem codebase, the core of it should be:

```tsx
import { getAddress, isAddress, type Address } from "viem";
import { normalize } from "viem/ens";
import { useEnsAddress } from "wagmi";
import { mainnet } from "wagmi/chains";

function useResolvedRecipient(input: string) {
  const value = input.trim();
  const literalAddress = isAddress(value) ? getAddress(value) : undefined;

  let ensName: string | undefined;
  let ensError: string | undefined;

  if (value && !literalAddress) {
    try {
      ensName = normalize(value);
    } catch {
      ensError = "Enter a valid address or ENS name.";
    }
  }

  const ens = useEnsAddress({
    name: ensName,
    chainId: mainnet.id,
    query: { enabled: Boolean(ensName) },
  });

  const recipient = literalAddress ?? ens.data ?? undefined;

  return {
    recipient: recipient as Address | undefined,
    isResolving: Boolean(ensName) && ens.isPending,
    error:
      ensError ??
      (ensName && !ens.isPending && !ens.data
        ? "That ENS name does not resolve to an Ethereum address."
        : ens.error?.message),
  };
}
```

The button should then be disabled from meaningful state, not from a regex:

```tsx
const { recipient, isResolving, error } = useResolvedRecipient(input);

<RecipientInput value={input} onChange={setInput} error={error} />
<button disabled={!recipient || isResolving} onClick={() => send(recipient)}>
  {isResolving ? "Resolving..." : "Send"}
</button>
```

That gives the user a field that accepts the two recipient formats Ethereum
users actually paste, resolves names through the configured Ethereum client,
and explains why Send is unavailable when it really is unavailable.

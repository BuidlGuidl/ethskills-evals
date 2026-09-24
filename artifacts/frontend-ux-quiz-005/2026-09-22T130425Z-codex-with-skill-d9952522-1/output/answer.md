The user is stuck because the field only treats a literal 20-byte hex Ethereum address as valid:

```ts
/^0x[a-fA-F0-9]{40}$/.test(input.trim())
```

`vitalik.eth` is an ENS name, not a hex address, so `isValid` is always `false`. Because the only feedback is `disabled={!isValid}`, the form gives the user no route forward and no explanation. The UI is silently rejecting a normal Ethereum recipient identifier even though the app stack, wagmi v2 plus viem, has the tools to resolve it.

A production recipient field should have handled the paste like this:

1. Normalize and classify the pasted value after trimming it.
2. If it is already an address, validate it with viem's `isAddress`, preferably normalize/checksum it with `getAddress`, and show that address as the recipient.
3. If it looks like an ENS name, resolve it on the appropriate chain/client with ENS support, for example via wagmi's `useEnsAddress` or viem's `getEnsAddress`.
4. While resolution is in flight, show an inline resolving state near the field and keep Send disabled for that explicit reason.
5. If the name resolves, store the resolved `0x...` address separately from the display input, show the resolved address or address component before submit, and enable Send using the resolved address.
6. If it does not resolve, or the resolver/request fails, show a specific inline error such as "No address found for this ENS name" or "Could not resolve ENS right now."
7. On submit, send to the resolved hex address, not to the raw text the user typed.

I would replace the raw `<input>` plus regex gate with an ENS-aware recipient input component in this codebase. If the app already has a UI-kit address component, I would use that. Otherwise I would introduce a small `RecipientInput` component backed by wagmi/viem:

```tsx
import { isAddress, getAddress } from "viem";
import { useEnsAddress } from "wagmi";

const trimmed = input.trim();
const literalAddress = isAddress(trimmed) ? getAddress(trimmed) : undefined;
const ensName = !literalAddress && trimmed.includes(".") ? trimmed : undefined;

const { data: ensAddress, isLoading, error } = useEnsAddress({
  name: ensName,
  chainId: 1,
  query: { enabled: Boolean(ensName) },
});

const recipientAddress = literalAddress ?? ensAddress ?? undefined;
const canSend = Boolean(recipientAddress) && !isLoading;
```

The important change is that validation is no longer "does the text match this regex?" It becomes "can this recipient input be turned into a real Ethereum address, and can the user see exactly what will be used before they send?"

The user is stuck because the field is treating "valid recipient" as exactly one syntax: a 20-byte Ethereum address already encoded as `0x` plus 40 hex characters.

`vitalik.eth` is not a hex address. It is an ENS name that has to be resolved to an address before a transfer can be sent. The regex returns `false`, so `isValid` is false forever, and the button stays disabled. Because the only feedback mechanism is the disabled button, the UI also gives the user no explanation that ENS names are unsupported or unresolved.

A production recipient field should have handled the paste like this:

1. Store the raw pasted value and trim display-independent whitespace.
2. Classify the value.
   - If it is a hex address, validate it with viem, for example `isAddress(value)`, and normalize it with `getAddress(value)` so the app works with a checksummed `Address`.
   - If it looks like an ENS name, normalize the name using ENS normalization rules, not a homegrown regex.
3. For an ENS name, start an async resolution request through the configured Ethereum client, typically wagmi/viem, against the ENS-capable chain/client. In practice that means something like `useEnsAddress` from wagmi v2 or `publicClient.getEnsAddress({ name })` from viem, usually on Ethereum mainnet even if the connected wallet is currently on another chain.
4. While the lookup is pending, show a resolving state instead of silently disabling the form.
5. If resolution succeeds, store the resolved `0x...` address as the actual recipient value used by `send`. The UI can still display the ENS name, but the transaction call should receive the resolved address.
6. If resolution fails, show a specific inline error such as "ENS name did not resolve to an address" or "Could not resolve ENS on this network/client."
7. Enable Send only when the recipient has been reduced to a valid address and the rest of the transfer form is valid. The disabled state should be backed by visible validation state, not by an invisible regex failure.

I would replace this raw `<input>` plus regex with an ENS-aware recipient address component backed by wagmi v2 and viem. In a Scaffold-ETH-style codebase, that would usually be the existing `AddressInput` component from the app's scaffold-eth input components, because it already matches the stack and user expectation of "address or ENS name." If this codebase does not already have that component, I would add a small `RecipientAddressInput` wrapper that accepts either a checksummed address or an ENS name, uses `isAddress`/`getAddress` for hex addresses, uses `useEnsAddress` or `publicClient.getEnsAddress` for ENS resolution, and reports `{ rawInput, resolvedAddress, status, error }` to the transfer form.

The important replacement is not a better regex. It is changing the field contract from "only accepts pasted hex strings" to "accepts human Ethereum recipients and resolves them into the address the transaction needs."

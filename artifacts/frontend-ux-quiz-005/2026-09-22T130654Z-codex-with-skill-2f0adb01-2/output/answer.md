The user is stuck because the field treats "valid recipient" as "matches a raw 20-byte hex address string":

```ts
/^0x[a-fA-F0-9]{40}$/.test(input.trim())
```

`vitalik.eth` is a valid human-readable Ethereum name, but it is not a `0x` address, so `isValid` is always `false`. Since the only visible consequence is `disabled={!isValid}`, the Send button stays greyed out and the UI never explains that ENS names are unsupported, unresolved, misspelled, or temporarily failing to resolve. The form is silently rejecting a normal Ethereum recipient format.

A production recipient field should have handled the paste like this:

1. Accept the pasted text and normalize it for validation, for example trim whitespace and normalize the ENS name, while still showing the user's entered value.
2. Classify the input. If it is a hex address, validate it with `viem` (`isAddress`) and canonicalize/checksum it with `getAddress`, rather than relying on a regex.
3. If it looks like an ENS name, enter a visible resolving state instead of simply disabling Send.
4. Resolve the name through the configured client, typically with wagmi v2's `useEnsAddress` or a viem `publicClient.getEnsAddress({ name })` call against Ethereum mainnet ENS resolution, even if the eventual transfer is on another supported chain.
5. While resolution is pending, disable Send with a reason such as "Resolving name..." near the field.
6. If resolution succeeds, store the resolved `0x...` address as the actual recipient value used by `send`, show a confirmation UI such as `vitalik.eth -> 0x...abcd`, and enable Send.
7. If resolution fails or returns no address, keep Send disabled but show an inline error like "No address found for this ENS name."
8. If the resolved address is valid but risky for the current action, continue with the normal production checks: wrong network, insufficient balance, simulation failure, wallet rejection, and transaction pending/confirmed states should all have explicit UI.

I would replace the raw `<input>` plus regex gate with a reusable recipient/address input component in this codebase, backed by wagmi v2 and viem. The component should expose the display value, resolution status, inline error, and the final normalized recipient address:

```tsx
<RecipientAddressInput
  value={input}
  onChange={setInput}
  onResolvedAddress={setRecipientAddress}
/>

<button disabled={!recipientAddress || isResolving || isSending} onClick={send}>
  {isResolving ? "Resolving..." : isSending ? "Sending..." : "Send"}
</button>
```

Internally, that component should use `isAddress`/`getAddress` for hex input and wagmi/viem ENS resolution for names. The transfer function should never read the raw text field directly; it should receive only a validated, normalized `Address`.

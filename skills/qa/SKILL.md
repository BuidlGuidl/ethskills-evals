---
name: qa
description: Pre-ship audit checklist for Scaffold-ETH 2 dApps — wallet flow, wrong-network gating, external contract registration, Address/AddressInput components, DaisyUI theme and loading states, SE-2 branding cleanup, polling and RPC posture, mobile wallet deep-linking, Phantom. Use when finalizing an SE-2 build, ideally from a fresh reviewer context after the build is complete.
---

# dApp QA — pre-ship audit for Scaffold-ETH 2

Read the code, then click through every flow — with no wallet, with a wallet on the wrong chain, and with a wallet on the target chain. Report each finding with severity, file, line, and the concrete fix. Only change code if the task asks you to fix rather than review.

## Wallet and action flow

- Disconnected state renders a **Connect Wallet button** (`RainbowKitCustomConnectButton`), never a paragraph telling the user to connect. This is the single most common miss.
- Wrong network turns the **primary CTA itself** into a "Switch to [chain]" button. The header's `WrongNetworkDropdown` is not enough — without a branch in the action slot, the user clicks Approve on the wrong chain and eats a silent wagmi error.
- One primary action at a time: Connect → Switch → Approve → Action. Approve and Action are never both live; which one renders is driven by the current allowance.
- Writes go through `useScaffoldWriteContract`. Raw wagmi `useWriteContract` outside scaffold internals resolves at the wallet signature, not at confirmation.
- Lock the button on `isMining`, **not** the `isPending` it passes through from wagmi. `isMining` is held across `waitForTransactionReceipt`; `isPending` drops when the wallet returns the hash, re-enabling the button mid-flight. Release only after awaiting the authoritative refetch (allowance, balance) — not after a fixed timer.
- Failed and rejected transactions surface a human-readable message next to the action (`notification` + `getParsedError`). A `catch` that only calls `console.error` is a silent failure.

## Contracts and addresses

- External contracts (tokens, protocols) belong in `packages/nextjs/contracts/externalContracts.ts`. Entries hand-added to `deployedContracts.ts` are wiped on the next deploy, and scaffold hooks silently return nothing for anything unregistered. Migrate rather than flag:

  ```typescript
  // packages/nextjs/contracts/externalContracts.ts
  const externalContracts = {
    8453: {
      USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", abi: [...] },
    },
  } as const satisfies GenericContractsDeclaration;
  ```

  Then revert `deployedContracts.ts` to its generated state and confirm `yarn next:check-types` passes.

- Every input that accepts an address uses `<AddressInput/>`, not `<input type="text">` — a raw input drops ENS resolution and validation, so `vitalik.eth` never reaches the contract. Models reliably *notice* this in review and reliably *fail to fix* it unprompted.
- Addresses render through `<Address/>` (blockie, ENS, copy, explorer link), not a hand-rolled `shorten()`.
- The contract the user transacts with is shown on the page. Agents display the connected wallet address and forget the contract itself.

## Theme and loading states

- No hardcoded dark wrapper (`bg-black`, `bg-[#0a0a0a]`, `bg-zinc-900`) on a page or layout root. It bypasses DaisyUI, gives light-mode users a black page, and breaks the header's `SwitchTheme`. Use `bg-base-200 text-base-content`. Forcing `data-theme="dark"` is acceptable only if `<SwitchTheme/>` is also removed.
- DaisyUI's `loading` **class on a `btn`** replaces the whole button with a spinner and swallows the label. Use an inline `<span className="loading loading-spinner loading-sm" />` inside the button, next to visible text.
- `--radius-field: 9999rem` in `globals.css` renders pill-shaped inputs and selects that clip content. Fix at theme level in **both** `@plugin "daisyui/theme"` blocks, not with per-component `rounded-*`.

## Branding

The scaffold's defaults are template scaffolding, not product decisions. Check all four: tab title in `layout.tsx` (not "Scaffold-ETH 2 App"), the metadata description, the footer (BuidlGuidl / fork-me / support links), the README, and the default favicon.

## Config

- `pollingInterval: 30000` in `scaffold.config.ts` makes an L2 app feel broken. Tune to the responsive ~3s range, or replace it with event-driven and post-confirmation refresh.
- Production RPC: shipping on SE-2's default Alchemy key, or on the bare `http()` fallback transport in `wagmiConfig`, means silently hitting rate-limited public endpoints. Route through `rpcOverrides` with a `NEXT_PUBLIC_*` key — and verify the variable is actually set on the host, not just referenced in code.

## Mobile

- On WalletConnect, tapping a transaction button must get the user to their wallet app with something to sign. Test it on a phone: if nothing happens and the user has to switch apps by hand, that is a finding. Any redirect fires the write first — navigating away before the write call means the transaction never fires — targets the wallet the user actually connected with, and is skipped inside a wallet's in-app browser.
- Phantom is not in SE-2's default RainbowKit wallet list, so Phantom users cannot connect at all. Add `phantomWallet` to `wagmiConnectors.tsx`.

## If it is deployed

Every deployed contract is verified on the block explorer (`yarn verify --network <chain>`). Unverified bytecode reads as something to hide. `yarn deploy` succeeding is not the finish line.

## References

- Docs: https://docs.scaffoldeth.io/ · Components: https://ui.scaffoldeth.io/

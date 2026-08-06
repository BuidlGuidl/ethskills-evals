---
name: qa
description: Pre-ship review and remediation checklist for Ethereum dApps built with Scaffold-ETH 2. Give this to a separate reviewer agent (or fresh context) AFTER the build is complete. Use this skill whenever you are reviewing, fixing, or finalizing a dApp built with Scaffold-ETH 2.
---

# dApp QA — Pre-Ship Audit For Scaffold-ETH 2 Builds

## What You Probably Got Wrong

**"The app deployed, so we are done."** For SE2 builds, shipping includes UX correctness, metadata, RPC reliability, contract verification, and branding cleanup.

**"The flow is obvious."** If Connect, Network, Approve, and Action are not strictly one-at-a-time with proper pending states, users will make duplicate or failing transactions.

**"SE2 defaults are fine in production."** Default README/footer/title/favicon and default RPC fallbacks are template scaffolding, not production decisions.

**"Pass means no console errors."** QA pass/fail here is behavioral and user-facing: real wallet flow, mobile deep-link behavior, readable errors, and trust signals must be validated.

Give this to a fresh agent after the dApp is built. Choose the mode from the user's request:

- **Review mode:** report PASS/FAIL with evidence; do not change code.
- **Remediation mode:** fix each confirmed failure, validate the result, and summarize the changes. Do not merely report issues when the user asked for fixes.

In either mode:

1. Read the source code (`app/`, `components/`, `contracts/`)
2. Open the app in a browser and click through every flow
3. Check every applicable item below and cite the source location or runtime reproduction
4. Run the repository's build or typecheck command after any edits

---

## 🚨 Critical: Wallet Flow — Button Not Text

Open the app with NO wallet connected.

- ❌ **FAIL:** Text saying "Connect your wallet to play" / "Please connect to continue" / any paragraph telling the user to connect
- ✅ **PASS:** A big, obvious Connect Wallet **button** is the primary UI element

This is a recurring generated-UI mistake: instructional text is rendered instead of an actionable connection control.

---

## 🚨 Critical: Four-State Button Flow

The app must show exactly ONE primary button at a time, progressing through:

```
1. Not connected  → Connect Wallet button
2. Wrong network  → Switch to [Chain] button
3. Needs approval → Approve button
4. Ready          → Action button (Stake/Deposit/Swap)
```

Check specifically:
- ❌ **FAIL:** Approve and Action buttons both visible simultaneously
- ❌ **FAIL:** No network check — app tries to work on wrong chain and fails silently
- ❌ **FAIL:** Main onchain CTA renders instead of a "Switch to [Chain]" button when the connected wallet is on the wrong network. SE-2's header `WrongNetworkDropdown` is **not sufficient** — the action button itself must become the switch CTA, or the user clicks Sign/Stake/Deposit on the wrong chain and eats a silent wagmi error.
- ❌ **FAIL:** User can click Approve, sign in wallet, come back, and click Approve again while tx is pending
- ✅ **PASS:** One button at a time. Approve button shows spinner, stays disabled until block confirms onchain. Then switches to the action button.
- ✅ **PASS:** Action button's render path branches on `useChainId() === targetNetwork.id` (or equivalent); mismatch renders a `useSwitchChain`-driven "Switch to [Chain]" button in the **same slot** as the primary CTA.

**In the code:** the button's `disabled` prop must be tied to `isPending` from `useScaffoldWriteContract`. Verify it uses `useScaffoldWriteContract` (waits for block confirmation), NOT raw wagmi `useWriteContract` (resolves on wallet signature):

```
grep -rn "useWriteContract" packages/nextjs/
```
Any match outside scaffold-eth internals → bug.

**Watch the complete transaction lifecycle.**

Raw wagmi `isPending` can drop when the wallet returns the transaction hash, before confirmation and before an allowance read reflects the new state. Keep a local action lock across submission, receipt confirmation, and authoritative state refetch. Release it in `finally` so rejection and RPC errors cannot leave the button stuck.

```tsx
const [approvalSubmitting, setApprovalSubmitting] = useState(false);

const handleApprove = async () => {
  if (approvalSubmitting) return;
  setApprovalSubmitting(true);
  try {
    const hash = await writeContractAsync(approveArgs);
    await waitForTransactionReceipt(config, { hash });
    await refetchAllowance();
  } catch (e) {
    notifyError("Approval failed");
  } finally {
    setApprovalSubmitting(false);
  }
};

<button disabled={approvalSubmitting}>
```

- ❌ **FAIL:** The button can re-enable between hash, receipt, and refreshed allowance
- ❌ **FAIL:** A fixed sleep is the primary confirmation or cache-consistency mechanism
- ✅ **PASS:** The action remains locked until receipt + authoritative refetch, and the lock clears in `finally`

---

## 🚨 Critical: SE2 Branding Removal

AI agents treat the scaffold as sacred and leave all default branding in place.

- [ ] **Footer:** Remove BuidlGuidl links, "Built with 🏗️ SE2", "Fork me" link, support links. Replace with project's own repo link or clean it out
- [ ] **Tab title:** Must be the app name, NOT "Scaffold-ETH 2" or "SE-2 App" or "App Name | Scaffold-ETH 2"
- [ ] **README:** Must describe THIS project. Not the SE2 template README. Remove "Built with Scaffold-ETH 2" sections and SE2 doc links
- [ ] **Favicon:** Must not be the SE2 default

---

## Important: Contract Address Display

- ❌ **FAIL:** The product promises contract transparency but gives users no way to identify the deployed contract
- ✅ **PASS:** When the address is useful to users, display it with `<Address/>` (blockie, ENS, copy, explorer link) or link to a dedicated verified-contract/details view

Treat this as a product requirement, not a universal rule for every page. Record why displaying the address helps the intended users.

---

## Important: Address Input — Prefer `<AddressInput/>`

Every user-facing input that accepts an Ethereum address needs validation, paste handling, visible errors, and name resolution where the target chain supports it. Prefer `<AddressInput/>` in SE2 rather than rebuilding those behaviors.

- ❌ **FAIL:** `<input type="text" placeholder="0x..." value={addr} onChange={e => setAddr(e.target.value)} />`
- ✅ **PASS:** `<AddressInput value={addr} onChange={setAddr} placeholder="0x... or ENS name" />`

`<AddressInput/>` gives you ENS resolution (type "vitalik.eth" → resolves to address), blockie avatar preview, validation, and paste handling. A raw text input without equivalent behavior is unacceptable for address collection.

**In SE2, it's in `@scaffold-ui/components`:**
```typescript
import { AddressInput } from "@scaffold-ui/components";
// or
import { AddressInput } from "~~/components/scaffold-eth"; // if re-exported
```

**Quick check:**
```bash
grep -rn 'type="text"' packages/nextjs/app/ | grep -i "addr\|owner\|recip\|0x"
grep -rn 'placeholder="0x' packages/nextjs/app/
```
Any match is a review lead, not an automatic failure: inspect whether equivalent validation and resolution behavior exists.

The usual SE2 pair is `<Address/>` for **display** and `<AddressInput/>` for **input**.

---

## Important: USD Values at Decision Points

- ❌ **FAIL:** A volatile token amount affects a user's decision or risk, but no fiat context is available
- ✅ **PASS:** "0.5 ETH (~$1,250)" with USD conversion

Check balances, inputs, confirmations, and positions where value matters. Compact technical views do not require a dollar figure on every row. Verify the price source and handle stale or unavailable prices safely.

---

## Important: OG Image Must Be Absolute URL

- ❌ **FAIL:** `images: ["/thumbnail.jpg"]` — relative path, breaks unfurling everywhere
- ✅ **PASS:** `images: ["https://yourdomain.com/thumbnail.jpg"]` — absolute production URL

Quick check:
```
grep -n "og:image\|images:" packages/nextjs/app/layout.tsx
```

---

## Important: RPC & Polling Config

Open `packages/nextjs/scaffold.config.ts`:

- ❌ **FAIL:** Polling is too slow for the intended interaction and no event-driven/post-confirmation refresh compensates for it
- ✅ **PASS:** Polling is deliberately tuned for the chain and UX (often around 2–5 seconds for interactive views), or event-driven refresh provides timely updates
- ❌ **FAIL:** Using default Alchemy API key that ships with SE2
- ❌ **FAIL:** Code references `process.env.NEXT_PUBLIC_*` but the variable isn't actually set in the deployment environment (Vercel/hosting). Falls back to public RPC like `mainnet.base.org` which is rate-limited
- ✅ **PASS:** `rpcOverrides` uses `process.env.NEXT_PUBLIC_*` variables AND the env var is confirmed set on the hosting platform
- ❌ **FAIL:** `services/web3/wagmiConfig.tsx` includes an accidental public fallback that can route production traffic to a rate-limited endpoint
- ✅ **PASS:** Every fallback is intentional, ordered, monitored, and appropriate for expected traffic; remove unintentional bare `http()` entries

**Verify the env var is set, not just referenced.** AI agents will change the code to use `process.env`, see the pattern matches PASS, and move on — without ever setting the actual variable on Vercel/hosting. Check:
```bash
vercel env ls | grep RPC
```

---

## Important: SE2 `externalContracts.ts` Registration

Scaffold hooks only work with contracts registered in `deployedContracts.ts` (auto-generated) or `externalContracts.ts` (manual). If external contracts are not registered, frontend reads/writes silently fail.

- ❌ **FAIL:** Frontend code references token/protocol contracts that are missing from `packages/nextjs/contracts/externalContracts.ts`
- ❌ **FAIL:** `deployedContracts.ts` manually edited to add external contracts
- ✅ **PASS:** All external contracts are defined in `externalContracts.ts` with correct chain, address, and ABI

Example:
```typescript
export default {
  8453: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      abi: [...],
    },
  },
} as const;
```

Never edit `deployedContracts.ts` directly. It is regenerated on deploy.

**Remediation recipe:**

1. Copy the external contract's address and ABI into `externalContracts.ts` under the correct chain ID.
2. Remove only the manually inserted external entry from `deployedContracts.ts`; preserve generated local deployments.
3. Confirm the exported value still satisfies `GenericContractsDeclaration` and update imports if required.
4. Run the frontend typecheck/build and verify the scaffold hook resolves the contract by name.

---

## Important: Dark Mode — No Hardcoded Dark Backgrounds

AI agents love the aesthetic of a dark UI and will hardcode it directly on the page wrapper:

```tsx
// ❌ FAIL — hardcoded black background, ignores system preference AND DaisyUI theme
<div className="min-h-screen bg-[#0a0a0a] text-white">
```

This bypasses the entire DaisyUI theme system. Light-mode users get a black page. The `SwitchTheme` toggle in the SE2 header stops working. `prefers-color-scheme` is ignored.

**Check for this pattern:**
```bash
grep -rn 'bg-\[#0\|bg-black\|bg-gray-9\|bg-zinc-9\|bg-neutral-9\|bg-slate-9' packages/nextjs/app/
```
Any match on a root layout div or page wrapper → **FAIL**.

- ❌ **FAIL:** Root page wrapper uses a hardcoded hex color or Tailwind dark bg class (`bg-[#0a0a0a]`, `bg-black`, `bg-zinc-900`, etc.)
- ❌ **FAIL:** `SwitchTheme` toggle is present in the header but the page ignores `data-theme` entirely
- ✅ **PASS:** All backgrounds use DaisyUI semantic variables — `bg-base-100`, `bg-base-200`, `text-base-content`
- ✅ **PASS (dark-only exception):** Theme is explicitly forced via `data-theme="dark"` on `<html>` **AND** the `<SwitchTheme/>` component is removed from the header

**The fix:**
```tsx
// ✅ CORRECT — responds to light/dark toggle and prefers-color-scheme
<div className="min-h-screen bg-base-200 text-base-content">
```

---

## Important: Phantom Wallet in RainbowKit

Explicitly listing Phantom can improve discovery when Phantom users are part of the product's supported audience. It is not a universal ship blocker: injected discovery or WalletConnect may already provide a working path.

- ❌ **FAIL:** The product promises Phantom support, but no tested connection path is discoverable
- ✅ **PASS:** Every wallet promised by the product has a tested connection path; add `phantomWallet` to `wagmiConnectors.tsx` when explicit listing is required

---

## Important: Mobile Deep Linking

Mobile linking behavior depends on the RainbowKit, WalletConnect, browser, OS, and wallet versions. Do not assume every signing request redirects correctly, and do not assume every integration needs a hand-written redirect.

On mobile, when a user taps a button that needs a signature, it must open their wallet app. Test this: open the app on a phone, connect a wallet via WalletConnect, tap an action button — does the wallet app open with the transaction ready to sign?

- ❌ **FAIL:** Nothing happens, user has to manually switch to their wallet app
- ❌ **FAIL:** A custom deep link fires before the signing request has been created
- ❌ **FAIL:** It opens the wrong wallet (e.g. opens MetaMask when user connected with Rainbow)
- ❌ **FAIL:** Deep links inside a wallet's in-app browser (unnecessary — you're already in the wallet)
- ✅ **PASS:** Signing opens the selected wallet through supported connector/session redirect metadata, or the UI gives a tested manual fallback

### How to implement it

1. Pin the RainbowKit and WalletConnect versions being reviewed and check their current mobile-linking guidance.
2. Prefer supported connector or WalletConnect session peer metadata for the selected wallet's redirect. Do not scrape undocumented `wc@2:*` local-storage structures or guess from `connector.id` alone.
3. Create the signing request before any custom navigation. Do not hardcode a universal timeout; if a workaround requires a delay, measure and document it for the supported wallet/OS matrix.
4. Detect wallet in-app browsers using tested wallet/browser signals rather than treating any `window.ethereum` value as conclusive.
5. Test connect, sign, reject, return-to-dapp, and wrong-wallet behavior on supported iOS and Android combinations. Record versions and results.

---

## 🚨 Critical: Contract Verification on Block Explorer

After deploying, every contract MUST be verified on the block explorer. Unverified contracts are a trust red flag — users can't read the source code, and it looks like you're hiding something.

- ❌ **FAIL:** Block explorer shows "Contract source code not verified" for any deployed contract
- ✅ **PASS:** All deployed contracts show verified source code with a green checkmark on the block explorer

**How to check:** Take each contract address from `deployedContracts.ts`, open it on the block explorer (Etherscan, Basescan, Arbiscan, etc.), and look for the "Contract" tab with a ✅ checkmark. If it shows bytecode only — not verified.

**How to fix (SE2):**
```bash
yarn verify --network mainnet   # or base, arbitrum, optimism, etc.
```

**How to fix (Foundry):**
```bash
forge verify-contract <ADDRESS> <CONTRACT> --chain <CHAIN_ID> --etherscan-api-key $ETHERSCAN_API_KEY
```

AI agents frequently skip verification because `yarn deploy` succeeds and they move on. Deployment is not done until verification passes.

---

## Important: Button Loading State — DaisyUI `loading` Class Is Wrong

AI agents almost always implement button loading states incorrectly when using DaisyUI + SE2.

**The mistake:** Adding `loading` as a class directly on a `btn`:

```tsx
// ❌ FAIL — DaisyUI's `loading` class on a `btn` replaces the entire button content
// with a spinner that fills the full button. No text, misaligned, looks broken.
<button className={`btn btn-primary ${isPending ? "loading" : ""}`}>
  {isPending ? "Approving..." : "Approve"}
</button>
```

**The fix:** Remove `loading` from the button class, add an inline `loading-spinner` span inside the button alongside the text:

```tsx
// ✅ PASS — small spinner inside the button, text visible next to it
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm mr-2" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

**Check for this in code:**
```bash
grep -rn '"loading"' packages/nextjs/app/
```
Any `"loading"` string in a button's className → **FAIL**.

- ❌ **FAIL:** `className={... isPending ? "loading" : ""}` on a button
- ✅ **PASS:** `<span className="loading loading-spinner loading-sm" />` inside the button

---

## Important: DaisyUI Field Radius (`--radius-field`)

Inspect `--radius-field` in every DaisyUI theme block. An excessively large value such as `9999rem` creates pill-shaped fields and can clip multiline controls; current template defaults may differ by SE2/DaisyUI version.

- ❌ **FAIL:** The configured radius produces inappropriate pill-shaped or clipped fields
- ✅ **PASS:** The radius is a deliberate product value and is consistent across light/dark theme blocks

Fix in theme (not per component):
```css
/* In BOTH @plugin "daisyui/theme" blocks */
--radius-field: 0.5rem; /* example, not a universal required value */
```

Do not patch this by sprinkling `rounded-*` utility classes per input; fix it once at theme level.

---

## SE2 References

- Docs: https://docs.scaffoldeth.io/
- UI Components: https://ui.scaffoldeth.io/
- SpeedRun Ethereum: https://speedrunethereum.com/

---

## Audit Summary

Report each applicable item as PASS or FAIL, with evidence. Mark product-dependent items `N/A` when the product does not promise that behavior.

### Ship-Blocking
- [ ] Wallet connection shows a BUTTON, not text
- [ ] Wrong network shows a Switch button **in the primary CTA slot** (not only in the header dropdown)
- [ ] One button at a time (Connect → Network → Approve → Action)
- [ ] Approve button locked through submission, receipt, and authoritative allowance refresh; rejection releases the lock
- [ ] Contracts verified on block explorer (Etherscan/Basescan/Arbiscan) — source code readable by anyone
- [ ] SE2 footer branding removed
- [ ] SE2 tab title removed
- [ ] SE2 README replaced

### Should Fix
- [ ] Contract identity is available where product transparency requires it
- [ ] Address inputs use `<AddressInput/>` or provide equivalent validation, resolution, and feedback
- [ ] Fiat context appears where volatile amounts affect user decisions
- [ ] OG image is absolute production URL
- [ ] Polling or event-driven refresh is deliberately tuned for responsive updates
- [ ] RPC overrides set (not default SE2 key) AND env var confirmed set on hosting platform
- [ ] Favicon updated from SE2 default
- [ ] `--radius-field` is deliberate and consistent across themes — no inappropriate pill-shaped or clipped fields
- [ ] Every contract error mapped to a human-readable message — no silent catch blocks, no raw hex selectors
- [ ] No hardcoded dark backgrounds — page wrapper uses `bg-base-200 text-base-content` (or `data-theme="dark"` forced + `<SwitchTheme/>` removed)
- [ ] Button loaders use inline `<span className="loading loading-spinner loading-sm" />` — NOT `className="... loading"` on the button itself
- [ ] Every wallet promised by the product has a tested connection path
- [ ] Mobile signing opens the selected wallet through supported metadata or offers a tested fallback
- [ ] Mobile-link behavior is verified on the supported wallet/browser/OS matrix

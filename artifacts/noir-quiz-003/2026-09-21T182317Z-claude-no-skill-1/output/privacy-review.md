# Privacy Review: Private Withdrawals Pool

**Question:** Can we tell users "withdrawals cannot be linked to deposits"?

**Short answer: No, not with the flow as shipped.** The cryptography hides *which note* is being spent. But the transaction that carries the proof is sent from Alice's own wallet, and that already tells everyone who she is. The zero-knowledge proof works as designed. The problem is how the proof gets onchain.

Scope: this review assumes the circuit, nullifier scheme and verifier are correct, as the audit found. Every problem below sits outside the circuit: transaction origination, gas funding, network metadata, anonymity-set size and user behavior.

---

## 1. What a chain observer can determine today

### 1.1 The withdrawal is sent from Alice's wallet (fatal)

In step 2, Alice "connects her wallet" and calls `withdraw(...)`. On Ethereum, every transaction has a public `from` address: the account that signed it and paid gas. So this is what anyone can read onchain:

```
deposit()   from: 0xAlice   value: 1 ETH
withdraw()  from: 0xAlice   recipient: 0xFresh
```

Linking the two takes one SQL join on `from`. It does not matter that the proof reveals nothing, or that `0xFresh` is new and empty. The payer of the withdrawal transaction is the depositor. With the shipped flow, the anonymity set is effectively **1** for any user who deposits and withdraws from the same wallet, which is the default path in our UI.

Even when Alice uses a *different* wallet for the withdrawal, that wallet needed ETH for gas. Where it got that ETH is public:
- funded from `0xAlice` → linked;
- funded from Alice's exchange account (KYC'd) → linked for the exchange and anyone who subpoenas it;
- funded from any address with a traceable history → linked through that history.

**The core point:** someone has to pay gas for the withdrawal. `0xFresh` is empty and can't. Whoever pays is public, and today that is Alice.

### 1.2 Fresh recipient and the "who pays gas" trap

We tell users to make a fresh, empty recipient, which is correct. But that address has no ETH, so it cannot send its own withdrawal transaction. The UI then falls back to the connected wallet, and that fallback is the leak in 1.1. The recipient being fresh gives no privacy while someone else's identifiable wallet submits the transaction.

### 1.3 Small anonymity set

At best, a withdrawal can only be hidden among **all deposits that have not yet been withdrawn and that went in before this withdrawal**. For a new pool run by a three-person team, that set could be tens of notes, or fewer. Consequences:
- If 1 deposit and 1 withdrawal happen in a quiet week, they are linked by elimination.
- Every deposit that is later deanonymized (by any leak in this document, by *any* user) removes one candidate for everyone else. Privacy is shared across users. One careless user makes everyone else easier to trace.
- Fixed 1 ETH denominations help, because amounts don't fingerprint anyone. But a user who deposits 7 notes and withdraws 7 notes around the same time creates a pattern that is easy to spot.

### 1.4 Timing correlation

Observers can match deposits and withdrawals by time. A deposit followed by a withdrawal a few hours later, while the pool is quiet, is easy to link. "Weeks later" helps only if many other deposits happened in between. Time alone doesn't make a user anonymous. The number of other deposits in between does.

### 1.5 Transaction and wallet fingerprints

Even without a shared `from` address, a transaction carries signals:
- gas price and priority-fee habits (some wallets set distinctive values), nonce patterns, calldata quirks;
- the specific `root` used in the proof. If the client always picks the latest root, that narrows the window of when the proof was built. If users pick unusual old roots, that stands out;
- the wallet software used (different wallets encode transactions differently).

Each of these is weak on its own. Combined, they cut down a small anonymity set quickly.

### 1.6 What happens to the money afterwards

These are behavioral, but real, and they will show up in user support:
- `0xFresh` sends the ETH back to `0xAlice`, to an address funded by Alice, or to Alice's KYC'd exchange deposit address → linked.
- `0xFresh` interacts with the same dApps, ENS names, NFTs or counterparties as `0xAlice` → probabilistically linked.
- Several withdrawals sent to the same "fresh" address → linked to each other, and together they create an amount/timing fingerprint.

### 1.7 Off-chain metadata (not visible onchain, but visible to parties we choose)

"Chain observer" is the question asked, but the launch claim will be read as a general privacy promise, so these parties also matter:
- **RPC provider** (Infura, Alchemy, or the wallet's default RPC) sees the IP address that submitted the deposit and the IP that submitted the withdrawal, plus the address(es) the wallet queried. It can link the two directly.
- **Our frontend host / CDN / analytics.** If the app logs wallet addresses, IPs or sessions (including third-party analytics scripts or error reporting such as Sentry), *we* hold the link table. That can be subpoenaed or leaked.
- **Wallet provider / WalletConnect relay** sees that the same wallet connected during both the deposit and the withdrawal sessions.
- **Note storage.** "Saves her note locally" means browser storage. If the note is in localStorage on the same browser profile as the wallet, anyone with access to the device can link them. Loss of the note means loss of funds.

---

## 2. What has to change for the claim to hold

These are ordered by priority. Items marked **[blocker]** must ship before any unlinkability claim.

### 2.1 [blocker] Withdrawals must not be sent from the depositor's wallet: add a relayer

The withdrawal flow should **not connect a wallet at all.** Instead:

1. The user pastes or loads the note. The browser builds the proof.
2. The browser sends `(proof, root, nullifierHash, recipient, relayer, fee)` to a **relayer** over HTTPS, ideally through Tor.
3. The relayer submits `withdraw(...)` from its own address and pays gas. The contract pays `1 ETH − fee` to `recipient` and `fee` to the relayer.

Onchain, every withdrawal then comes `from` one of a few relayer addresses shared by all users. The link through `from` disappears.

Contract and circuit requirements for this to be safe:
- **`relayer` and `fee` (and `recipient`) must be public inputs bound into the proof.** If they aren't, a relayer or mempool front-runner can take the proof and change the recipient or raise the fee. The audit confirmed the proof is correct for its *current* public inputs, which are `root, nullifierHash, recipient`. Adding `relayer` and `fee` is a **circuit and verifier change and needs a re-audit.** (Tornado Cash does this with `relayer`, `fee` and `refund` as public inputs.)
- The contract enforces `fee <= denomination` and pays `fee` to the bound `relayer`.
- Optional `refund`: a small amount of ETH the relayer forwards to `recipient` so the fresh address has gas for its first transaction. Without it, users go and fund `0xFresh` from a traceable address, which recreates the problem in 1.1.
- Support **several independent relayers**, or at least publish an open-source relayer anyone can run, so that one operator doesn't see the IP of every withdrawal. Relayers see the client's IP and the recipient. They cannot steal funds (the proof binds recipient and fee), but they are a metadata point.
- Fallback for advanced users: allow self-submission from a *separate* gas wallet, with a clear warning in the UI. Never default to the connected deposit wallet. Block it in the UI if the withdrawing wallet equals the depositing wallet (the client knows this if it stored the deposit tx).

### 2.2 [blocker] Remove our own logging of the link

- Delete wallet-address, IP and session logging from the frontend, backend and relayer. Remove third-party analytics and session-replay scripts from the deposit and withdraw pages. Make sure error reporting strips addresses and notes.
- Serve the app as a static build, ideally also on IPFS with a published hash, so users don't have to trust our server not to log.
- Let users choose their own RPC for deposits. Document that Tor or a VPN is needed to hide their IP from RPC providers and relayers.

### 2.3 [blocker for an honest claim] Anonymity set must be real and shown to users

- In the withdraw UI, show **the number of deposits made since the user's deposit** and the current pool size. Warn when it is below a threshold (for example, < 50) and recommend waiting.
- Don't advertise unlinkability during launch, while the pool is small. The guarantee grows with usage; it is not there on day one.

### 2.4 Guide user behavior (UX, not cryptography)

- Recommend waiting, and base the recommendation on *deposits since yours*, not on time passed.
- Warn about withdrawing many notes at once, sending funds back to the deposit address, reusing the same recipient, or funding `0xFresh` from a known address.
- Offer the relayer `refund` (2.1) so users don't need to fund the fresh address themselves.
- Use a sensible default for `root` (for example, a recent root, not always the one from the latest block) and fixed, common gas settings in relayer transactions, so client fingerprints don't leak through.
- Treat notes as secrets: offer encrypted export/backup, and don't keep notes in plain localStorage next to wallet state indefinitely.

### 2.5 Things outside our control (disclose them)

- Users who deposit from a KYC'd exchange withdrawal address are known *as depositors*. That is fine: the pool is supposed to hide *which* withdrawal is theirs, not *whether* they deposited.
- Deposits are always public. We hide the deposit→withdrawal link, not the fact that someone used the pool.
- Compliance and sanctions exposure for relayers and the frontend is a separate legal question. It is flagged here because it affects whether independent relayers will exist.

---

## 3. Recommended launch wording

Not acceptable as shipped: ~~"Withdrawals cannot be linked to deposits."~~ Today, anyone reading the chain can link them from the `from` address alone.

Acceptable **after 2.1–2.3 ship** (relayer with bound fee/recipient, re-audit, no logging, anonymity-set indicator):

> "Withdrawals are cryptographically unlinkable to deposits. Your privacy depends on how many others use the pool and on how you use your withdrawal address — the app shows you your current anonymity set and how to protect it."

Any absolute claim ("cannot be linked", "untraceable", "anonymous") overpromises. The proof hides which note was spent, but metadata, timing and user behavior can still identify people, especially in a small pool. The claim marketing can make honestly is about the *cryptography*, with the practical conditions stated.

---

## 4. Summary

| Leak | Severity today | Fix |
|---|---|---|
| Withdrawal `from` = deposit wallet | **Complete link** | Relayer; no wallet connection on withdraw |
| Gas funding of any self-submit wallet | Complete link, usually | Relayer + `refund` |
| Proof not bound to relayer/fee | Blocks a safe relayer design (front-running/theft) | Add `relayer`, `fee`, `refund` as public inputs; **re-audit** |
| Small anonymity set | High at launch | Show deposits-since-yours; soften claim until usage grows |
| Timing / amount patterns | Medium | UX guidance; fixed denominations (already done) |
| RPC / frontend / relayer IP logs | High, off-chain | No logging, static/IPFS frontend, Tor guidance, multiple relayers |
| Post-withdrawal behavior | User-dependent | UX warnings, refund for gas |

The zero-knowledge part of the product is correct. The privacy part does not exist yet: the product sends the private proof inside a transaction signed by the person it is meant to hide.

# Privacy Review: Private-Withdrawals Pool

**Question:** Can we say "withdrawals cannot be linked to deposits" on the launch page?

**Short answer: No, not with the flow as shipped.** The cryptography is fine. The problem is the transaction that carries the proof. Alice signs `withdraw()` with the same wallet that signed `deposit()`, so anyone who can read Etherscan can link the two. They don't need to break the proof. The zero-knowledge proof hides which commitment is being spent. It can't hide who sent the transaction that carries it.

This review assumes, as instructed, that the circuit, nullifier scheme, and verifier are correct. Everything below is about what sits around them.

---

## 1. What a chain observer can determine today

### 1.1 The link is public: `msg.sender` (critical)

| Tx | `from` | Public data |
|---|---|---|
| `deposit(commitment)` | `0xAlice` | commitment, leaf index, 1 ETH in |
| `withdraw(proof, root, nullifierHash, recipient)` | `0xAlice` | nullifierHash, recipient, 1 ETH out |

An observer groups `deposit` and `withdraw` transactions by `from`. When one address has both, the withdrawal belongs to that address's deposit. Using a fresh `recipient` does nothing here, because the sender field already names Alice. The observer now knows:

- Alice withdrew.
- The fresh recipient address belongs to Alice, so everything it does later is attributed to her.
- Roughly when she deposited and when she withdrew.

The effective anonymity set is **1**. This isn't an edge case. Every withdrawal in the shipped flow works this way, because the flow is designed so that the connected wallet pays gas.

The flow ended up like this for a mechanical reason: the fresh recipient holds 0 ETH and can't pay gas. The fix has to solve that problem, or users will keep finding workarounds that relink them (see 1.2).

### 1.2 Workarounds that still link

These are the obvious "fixes" a user or the team might reach for. Each one still links:

- **Burner wallet funded from Alice's wallet.** `0xAlice → 0xBurner` (gas money), then `0xBurner` calls `withdraw`. It's one extra hop for an observer to follow.
- **Burner or recipient funded from Alice's exchange account.** Exchange withdrawals are tied to identity (KYC) and are easy to cluster.
- **Recipient gets gas from Alice's wallet after the withdrawal,** or sends funds back to her wallet or her exchange deposit address. This links after the fact.

### 1.3 The anonymity set is small, even with perfect sender hygiene

Once the sender link is fixed, the best case is still: "this withdrawal came from one of the N deposits in the tree as of `root`." For a new, small pool:

- **N is small at launch.** Ten deposits means an observer's odds of guessing right are about 1 in 10, before any heuristics.
- **Candidates get removed.** Deposits whose owners obviously withdrew already, or obviously never will (for example, the team's test deposits), drop out of the set.
- **The `root` is a timestamp.** It proves the note was in the tree at that root's block. A stale root cuts out every later deposit. The client should always use the latest known root.
- **Timing links deposits and withdrawals.** If a deposit is quickly followed by a withdrawal and the pool is otherwise quiet, they get matched. The same goes for an unusual gap (such as "exactly one week later") or a repeated time-of-day pattern.
- **Multiple notes act as a fingerprint.** Fixed 1 ETH notes remove amount matching for a single note. But if Alice deposits 3 notes in a row and later withdraws 3 notes in a row, the batch links, and the set shrinks sharply.

### 1.4 Transaction fingerprinting

Even from a clean sender, the `withdraw` tx can leak details of the wallet or client that built it: gas price and priority fee habits, the gas limit, and calldata quirks from a particular app version. Relayers remove most of this because the relayer builds the transaction, not the user.

### 1.5 Offchain observers (not chain observers, but they read the same data)

"Chain observer" is the narrow threat. These parties see more:

- **The RPC provider behind the frontend** (Infura, Alchemy, or the wallet's default) sees Alice's IP address. It sees her fetch tree data, and it receives both the deposit and the withdrawal. It can link them by IP address alone.
- **Wallet connection at withdraw time.** Step 2 says Alice "connects her wallet." The frontend, any analytics or error-tracking scripts on it, and wallet-connection services such as WalletConnect relays all see `0xAlice` open the app during the session that produced the withdrawal. This needs to change even after a relayer exists: withdrawing should not require connecting the deposit wallet at all.
- **Selective tree fetching.** If the client asks for only its own leaf, or only the events near its leaf index, the RPC server learns which note is being spent. The client has to download all insert events and rebuild the full tree locally (the `@zk-kit/lean-imt` mirror), which it may already do.
- **The relayer itself** (once added) sees the withdrawing user's IP address and the recipient.

---

## 2. What has to change

### Required before any unlinkability claim

1. **Separate the withdrawal sender from the depositor. Add a relayer.**
   - The browser generates the proof and sends it to a relayer. The relayer submits `withdraw()` from the relayer's own address and pays the gas.
   - The relayer is reimbursed from the note: `recipient` gets `1 ETH - fee` and the relayer gets `fee`.
   - **`relayer` and `fee` must be public inputs bound by the proof**, the same way `recipient` should already be. Otherwise the relayer, or anyone watching the mempool, can copy a valid proof and change the payout. Please confirm with the auditor that `recipient` is actually constrained in the circuit (the usual trick is squaring it into a dummy constraint), and extend that to `relayer` and `fee`. Adding them changes the public-input order, so the circuit, the prover's `publicInputs`, and the array the contract passes to `verify()` all have to change together.
   - An **ERC-4337 paymaster** is an alternative: the paymaster sponsors gas for `withdraw` calls that carry a valid proof, and is repaid out of the withdrawal. The sender is then a bundler, not Alice. It has the same requirement to bind the fee in the proof.
   - Support **more than one relayer**, or publish the relayer so users can run their own. Otherwise one operator can censor withdrawals or log IP addresses.

2. **Don't connect a wallet to withdraw.** The withdraw screen should take only the note and a recipient address. It needs no wallet connection, no signature, and no gas. This removes the gas problem that forced the current design, and it keeps the frontend, analytics, and wallet-connection services from seeing `0xAlice` during a withdrawal.

3. **Fetch the whole tree.** The client downloads all deposit events (or a full snapshot), rebuilds the tree locally, and proves against the latest root. It must never request its own leaf or path by index.

4. **Remove third-party analytics and error-tracking scripts from the app,** or at least from the withdraw path. Document the RPC and relayer IP exposure, and recommend Tor or a VPN for users who care.

### Required for the claim to be *honest*, not just technically true

5. **Show the anonymity set.** On the withdraw screen, show "your note is one of N deposits" and warn when N is small or when Alice's own deposit is recent. Consider a minimum wait, or at least a recommended one.
6. **Warn about behavior that relinks.** The UI should warn against:
   - withdrawing several notes back to back
   - withdrawing soon after depositing
   - sending funds from the recipient back to the deposit wallet or a known exchange account
   - funding anything in the flow from the deposit wallet
7. **Seed the pool before advertising privacy.** At N ≈ 5, "unlinkable" is misleading even with perfect hygiene.

---

## 3. Recommended marketing language

"Cannot be linked" is an absolute claim. It isn't true today, and it can't be guaranteed even after the fixes, because it depends on pool size and on user behavior. Suggested wording after items 1–4 ship:

> "Withdrawals are sent through a relayer and proven with zero-knowledge proofs, so the protocol never reveals which deposit a withdrawal came from. Your privacy grows with the number of deposits in the pool — timing and how you use your funds afterward can still reveal you."

**Until item 1 ships, the launch page should make no privacy claim.** Every withdrawal in the current flow is publicly linked to its deposit by the sending address.

---

## Summary

| Leak | Severity today | Fix |
|---|---|---|
| Same `msg.sender` on deposit and withdraw | **Critical, complete link** | Relayer or paymaster, with `relayer`/`fee` bound in the proof |
| Wallet connected during withdraw (frontend, analytics, wallet-connection services) | High | Withdraw without a wallet |
| RPC provider or relayer sees IP address | Medium | Full-tree fetch, multiple relayers, recommend Tor/VPN |
| Small anonymity set, timing, multi-note batches | Medium, grows with a small pool | Show N, add waiting and batching guidance, seed the pool |
| Recipient funded from, or sending back to, known addresses | User-dependent | UI warnings; the relayer model gives the recipient ETH, so it doesn't need outside gas money |

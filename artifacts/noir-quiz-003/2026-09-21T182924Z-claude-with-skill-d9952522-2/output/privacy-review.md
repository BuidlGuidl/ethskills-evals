# Privacy Review: Private Withdrawals Pool

**Question:** Can we say "withdrawals cannot be linked to deposits"?

**Short answer:** No, not with the product as it ships. The circuit hides which commitment a withdrawal spends, but the transaction around the proof names the depositor outright. An observer doesn't need to break any cryptography. They read the `from` field.

Throughout, the audited parts (membership proof, nullifier scheme, verifier) are taken as correct. Nothing below attacks them. Every problem is in how the proof reaches the chain.

---

## 1. What a chain observer sees today

### 1.1 Fatal: Alice's wallet sends her own withdrawal

Step 1: `deposit()` is sent from Alice's wallet `0xA11CE`.
Step 2: `withdraw(proof, root, nullifierHash, recipient)` is also sent from `0xA11CE`, because she "connects her wallet" to withdraw.

Every Ethereum transaction publicly records its sender and gas payer. So an observer sees:

```
0xA11CE → Pool.deposit()        (1 ETH in)
0xA11CE → Pool.withdraw(..., recipient = 0xFRESH)   (1 ETH out to 0xFRESH)
```

The zero-knowledge proof hides which leaf is being spent. It can't hide who submitted the transaction, and here the submitter is the depositor. The anonymity set is effectively **1**. This doesn't depend on timing analysis or heuristics: a single SQL query over `Pool` transactions, `GROUP BY from`, joins every deposit to its withdrawal.

### 1.2 The fresh recipient makes it worse

The fresh recipient address was meant to be the private part. Because it is named in a transaction signed by `0xA11CE`, it is now publicly tied to Alice. Anything she does with `0xFRESH` later is attributed to her too.

The problem is built into the design. A fresh, empty address has no ETH for gas, so it can't send the withdrawal itself. That is why the flow falls back to the connected wallet. The common workaround, funding `0xFRESH` (or a burner) with gas from `0xA11CE` first, recreates the same link one hop away. Any funding source traceable to Alice has the same effect.

### 1.3 Offchain observers see it too

A chain observer isn't the only threat. Even with 1.1 fixed, the following parties can link Alice's wallet to her withdrawal today:

- **Our frontend and hosting/analytics.** The withdraw page asks for a wallet connection, so our server logs (IP, session, connected address) associate `0xA11CE` with the withdraw action. Any analytics or error-reporting SDK on the page leaks this to a third party.
- **The RPC provider** (Infura, Alchemy, the wallet's default). It sees the same IP send the deposit, and later the withdrawal, and query the pool's events.
- **Merkle path source.** If the client fetches its Merkle path from our backend by leaf index or commitment, our backend learns exactly which deposit is being withdrawn. The path has to be rebuilt client-side by replaying the pool's insert events into a local tree. Verify that this is how the client does it.

---

## 2. What remains once the sender link is fixed

Suppose withdrawals are submitted by a third party (see §3). Now the observer really can't read the link off the chain, but they can still narrow it down. These limits are why the claim can never be absolute.

1. **Anonymity set size.** A withdrawal can only be "one of the N deposits in the tree at the root it proves against." In a small pool N is small. If the pool has 12 deposits, the best we can promise is 1-in-12, before any other clues. At launch, N will be tiny.
2. **The root narrows the set.** The `root` is public. A withdrawal against an old root proves the deposit came *before* that root was current, which excludes every later deposit. The client should always prove against the latest root.
3. **Timing.** If a deposit is followed shortly by a withdrawal, and few other deposits happened in between, they are easy to pair. Frequency analysis works well in low-volume pools: "the only deposit this week" followed by "the only withdrawal this week".
4. **Deposit/withdraw behavior patterns.** Examples: the same odd gas settings, distinctive wallet software, depositing 3 notes and withdrawing 3 in a burst, and sending withdrawn funds back to a known address or to a KYC'd exchange account that also funded the deposit. Researchers have deanonymized a large share of Tornado Cash users with exactly these heuristics.
5. **Pool flooding.** An adversary can make many deposits of their own. They know those deposits aren't Alice's, so each one shrinks the effective set rather than growing it. In a small pool this is cheap.
6. **Fixed denomination is good.** Fixed 1 ETH notes remove amount correlation. Keep it that way: don't add arbitrary amounts or partial withdrawals without redesigning for them.

---

## 3. What has to change

### Required (without these, the claim is false)

**R1. Alice's wallet must never send the withdrawal. Route it through a relayer or an ERC-4337 paymaster.**

- **Relayer:** Alice generates the proof in-browser and hands `(proof, root, nullifierHash, recipient, relayer, fee)` to a relayer. The relayer submits the transaction and pays gas, and the contract pays it `fee` out of the 1 ETH (the rest goes to `recipient`).
- **ERC-4337:** use a paymaster that sponsors gas only for valid `withdraw` calls and is reimbursed from the withdrawn amount. The UserOp is sent from a fresh smart account with no history.

Either way, the on-chain sender must be something every user shares, not something tied to Alice.

**R2. Bind `recipient`, `relayer`, and `fee` into the proof as public inputs.** Once a third party submits the transaction, a relayer or a mempool front-runner could otherwise swap `recipient` for their own address and steal the funds, or inflate the fee. The current `withdraw(proof, root, nullifierHash, recipient)` has no relayer or fee parameters, so this changes the circuit's public inputs and the contract. The public-input order has to match across circuit, prover, and contract. **This changes audited code. Send the delta back to the auditor.** Also confirm with the auditor that `recipient` is already constrained in the current circuit (a Tornado-style circuit typically binds it with a dummy constraint such as `recipient * recipient`). If it isn't, relaying is unsafe even before we add fees.

**R3. The withdraw flow must not require a wallet connection.** The withdraw page should need only the note and a recipient address. Remove the "connect wallet" step from withdraw entirely, and keep the deposit and withdraw sessions separate: no shared cookies, local-storage IDs, or analytics identifiers.

**R4. Build the Merkle path client-side from contract events** and always prove against the latest root (§1.3, §2.2). Make sure no backend endpoint takes a leaf index or commitment and returns a path.

### Strongly recommended

- **Strip or minimize analytics** on the app, and don't log IPs or addresses on withdraw requests (the relayer included).
- **Let users choose their RPC**, or make withdrawals work through a user-supplied endpoint or Tor. Document that the default RPC can see their traffic.
- **Run more than one relayer, or let users pick one.** A single relayer run by our team sees every withdrawal request with its IP and becomes both a privacy honeypot and a censorship point. At minimum, publish its no-logging policy and accept requests over Tor.
- **Show the anonymity set in the UI** ("Your withdrawal is one of N deposits"), and warn when N is small or when the user's own deposit is recent.
- **User guidance:** wait for more deposits before withdrawing, don't send withdrawn funds back to the depositing address or to the same exchange account, and don't withdraw several notes in a burst.
- **Scope the nullifier to this pool** (hash a pool ID into it) if we ever deploy a second pool or denomination, so notes can't be linked across deployments. The auditor has likely covered this already; confirm it.

### Out of scope, but raise it before launch

Tornado Cash was sanctioned. The sanctions were later lifted, but the developers were still prosecuted. A mixer-shaped product on mainnet with the tagline "cannot be linked" invites exactly that scrutiny. Get legal review before publishing any privacy claim, independent of the technical issues here.

---

## 4. What marketing can say

| Wording | Accurate? |
|---|---|
| "Withdrawals cannot be linked to deposits." (shipped product) | **No.** False: every withdrawal is sent by its depositor's wallet (§1.1). |
| "Withdrawals cannot be linked to deposits." (after R1–R4) | **No.** Still an absolute promise, and a small anonymity set, timing, and user behavior can link them (§2). |
| "The protocol does not reveal which deposit a withdrawal came from. Your privacy grows with the number of deposits in the pool and depends on how you use your funds afterwards." (after R1–R4) | **Yes.** |

**Bottom line:** The cryptography is sound, but the shipped flow is fully linkable, because the depositor's own wallet submits the withdrawal. Before launch we need relayed or sponsored withdrawals, a circuit and contract change to bind recipient, relayer, and fee (re-audited), and a withdraw flow that never touches the user's wallet. Even then, the claim should be phrased as bounded unlinkability, not a guarantee.

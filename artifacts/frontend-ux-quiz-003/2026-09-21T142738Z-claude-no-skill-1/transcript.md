# Executor transcript — 2026-09-21T142738Z-claude-no-skill-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/2026-09-21T142738Z-claude-no-skill-1/frontend-ux-quiz-003

## assistant
- **Bash** `ls -la && git ls-files | head`

  > total 16
  > drwxr-xr-x@  5 liana  staff   160 Sep 21 18:27 .
  > drwxr-xr-x@  5 liana  staff   160 Sep 21 18:27 ..
  > drwxr-xr-x@ 12 liana  staff   384 Sep 21 18:27 .git
  > -rw-r--r--@  1 liana  staff    50 Sep 21 18:27 package.json
  > -rw-r--r--@  1 liana  staff  1135 Sep 21 18:27 TASK.md
  > TASK.md
  > package.json

## assistant
- **Bash** `cat TASK.md package.json`

  > An Ethereum React dApp with wagmi v2 and viem configured. A teammate's
  > PR adds the stake widget below. To
  > "keep it simple" it shows the buttons whenever a wallet is connected, and
  > to save an RPC call it remembers approval in component state once the
  > approve transaction has been sent:
  > 
  >     const [hasApproved, setHasApproved] = useState(false);
  > 
  >     {isConnected && (
  >       <div>
  >         {!hasApprove … [784 more chars]

## assistant
- **Write** `/Users/liana/.cache/ethskills-evals/2026-09-21T142738Z-claude-no-skill-1/frontend-ux-quiz-003/answer.md`

  > File created successfully at: /Users/liana/.cache/ethskills-evals/2026-09-21T142738Z-claude-no-skill-1/frontend-ux-quiz-003/answer.md (file state is current in your context — no need to Read it back)

## assistant
I wrote the review to `answer.md`. My verdict is that the PR needs changes: the widget only checks that a wallet is connected, and it tracks approval in a local flag instead of reading it from the chain.

**1. User on Arbitrum with zero allowance:**
- **What they see:** both Approve and Stake, and nothing says they're on the wrong network.
- **Stake click:** it can't work. The allowance is 0, and the call goes to Arbitrum instead of mainnet, where it either errors or wastes gas.
- **Approve click:** it either throws with no error shown, or it sends an approve on Arbitrum to the mainnet token address. If no contract exists at that address there, the call "succeeds" without doing anything. Either way, the flag is set, Approve disappears, and the mainnet allowance is still 0.
- **Extra risk:** if `approve` is wagmi's `writeContract` rather than `writeContractAsync`, it returns right away. The flag then flips to true before the user even signs.

**2. The subtler bug:** the flag is set once the approve transaction is sent and never goes back to false. Concrete sequence:
1. Approve exactly 100.
2. Stake 100. This uses up the allowance, so it's back to 0.
3. Try to stake 50 more. Only Stake shows, and it reverts. There's no way to approve again without reloading the page.

Other ways to end up there:
- The user switches to another account in the wallet.
- The approve transaction is dropped or reverts.
- The user approved on the wrong chain.
- The user raises the amount above what was approved.
- The allowance is revoked somewhere else.

**3. The correct flow:** one primary button at a time, from the first check that matches, in this order:
1. Not connected: Connect Wallet.
2. Wrong chain: Switch to Ethereum.
3. Data still loading: disabled "Loading…".
4. Amount empty or invalid: disabled "Enter amount".
5. Amount above balance: disabled "Insufficient balance".
6. Approve transaction pending: disabled "Approving…".
7. Allowance below the amount: Approve.
8. Stake transaction pending: disabled "Staking…".
9. Otherwise: Stake.

Approval status must come only from the on-chain `allowance`:
- Read it with `useReadContract`, pinned to mainnet and keyed on the connected account.
- Compare it to the entered amount as a bigint.
- Read it again after each approve or stake is confirmed, never just because a transaction was sent.
- Pass `chainId: mainnet.id` on every write, so wagmi refuses to send on the wrong chain.

## run stats
- turns: 4
- duration: 67s
- cost: $0.2737085
- tokens in/out: 73119/5094
- of which cache write/read: 11554/61557

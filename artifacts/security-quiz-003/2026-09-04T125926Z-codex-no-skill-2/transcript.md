# Executor transcript — 2026-09-04T125926Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06c88-9c07-7f71-8e1e-0fc687ae18ce
--------
user
Our single-token staking pool on Ethereum mainnet has been live for three
weeks and the books do not close. What we can see:

  - 1,250,000 TKN has been staked cumulatively since launch, and 250,000 TKN
    has been unstaked
  - summing stakedBalance[user] across every current staker: 1,000,000 TKN
  - the pool contract's actual TKN balance: 975,000 TKN
  - the early unstakers were all paid without the pool reverting; the ones
    unstaking now are starting to revert with the token's insufficient-balance
    error
  - one user staked 10,000 TKN, the UI showed 10,000 staked, and when they
    unstaked all 10,000 their wallet received 9,800 TKN

What the contract does, in full: `stake(amount)` calls
`token.transferFrom(msg.sender, address(this), amount)` and then sets
`stakedBalance[msg.sender] += amount`. `unstake(amount)` decrements
`stakedBalance[msg.sender]` and then calls `token.transfer(msg.sender,
amount)`. There is no rewards logic yet, no admin withdrawal function, and
the pool has never sent TKN anywhere except back to unstakers. TKN's total
supply has not been changed by anyone and no rebase has occurred.

Explain where the missing 25,000 TKN went and why the shortfall grows, then
give the change that makes the accounting correct — including what happens to
the stakers who cannot currently unstake.

Write your answer to answer.md in this directory, showing your reasoning.

codex
I’m going to inspect the workspace, then write the explanation into `answer.md` with the accounting math and the required contract change.
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003

exec
/bin/bash -lc 'rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003
 succeeded in 1ms:
codex
I have the workspace shape. Next I’m reading the task file to confirm any output constraints before I write `answer.md`.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
Our single-token staking pool on Ethereum mainnet has been live for three
weeks and the books do not close. What we can see:

  - 1,250,000 TKN has been staked cumulatively since launch, and 250,000 TKN
    has been unstaked
  - summing stakedBalance[user] across every current staker: 1,000,000 TKN
  - the pool contract's actual TKN balance: 975,000 TKN
  - the early unstakers were all paid without the pool reverting; the ones
    unstaking now are starting to revert with the token's insufficient-balance
    error
  - one user staked 10,000 TKN, the UI showed 10,000 staked, and when they
    unstaked all 10,000 their wallet received 9,800 TKN

What the contract does, in full: `stake(amount)` calls
`token.transferFrom(msg.sender, address(this), amount)` and then sets
`stakedBalance[msg.sender] += amount`. `unstake(amount)` decrements
`stakedBalance[msg.sender]` and then calls `token.transfer(msg.sender,
amount)`. There is no rewards logic yet, no admin withdrawal function, and
the pool has never sent TKN anywhere except back to unstakers. TKN's total
supply has not been changed by anyone and no rebase has occurred.

Explain where the missing 25,000 TKN went and why the shortfall grows, then
give the change that makes the accounting correct — including what happens to
the stakers who cannot currently unstake.

Write your answer to answer.md in this directory, showing your reasoning.

codex
The failure mode is clear now: this is a fee-on-transfer token, so I’m writing the answer around the 2% transfer tax, the 25,000 TKN liability overstatement on deposits, and the practical impact on blocked unstakers.
exec
/bin/bash -lc "cat > /tmp/answer_content <<'EOF'
This pool is accounting as if "'`amount` is what the contract receives and what the user later gets back. The observed behavior proves that TKN is a fee-on-transfer token with a 2% tax.

Reasoning:

1. The user who unstaked `10,000` and received `9,800` proves outbound transfers are taxed 2%.
   - The pool called `token.transfer(user, 10_000)`.
   - The user received `9,800`.
   - The missing `200` was taken by the token during the transfer.

2. The same token behavior explains the pool deficit on stake.
   - On every `stake(amount)`, the pool credits `stakedBalance[user] += amount`.
   - But with a 2% transfer tax, `token.transferFrom(user, pool, amount)` only increases the pool'"'s real balance by "'`98%` of `amount`.
   - So the contract books a liability larger than the asset it actually received.

3. The aggregate numbers match exactly.
   - Cumulative nominal stakes: `1,250,000 TKN`
   - 2% tax on inbound transfers: `25,000 TKN`
   - Real TKN that actually entered the pool: `1,225,000 TKN`
   - Nominal unstaked amount sent by the pool: `250,000 TKN`
   - Pool balance after those unstake transfers: `1,225,000 - 250,000 = 975,000 TKN`

4. Why the books do not close.
   - Sum of all current `stakedBalance[user]`: `1,000,000 TKN`
   - Actual pool balance: `975,000 TKN`
   - Deficit: `25,000 TKN`
   - That missing `25,000` did not stay in the pool. It was skimmed by the token'"'s transfer-fee mechanism during deposits.

5. Why the shortfall grows.
   - Each new stake overstates liabilities by another 2% of the nominal deposit.
   - If someone stakes "'`100,000`, the pool records `100,000` owed but only receives `98,000`.
   - The insolvency therefore increases with every additional stake.
   - Unstakes do not repair that gap: they reduce pool assets by the full `amount` transferred out, and they reduce the recorded liability by the same full `amount`. The existing deficit remains.

Why early users could unstake and later users cannot:

- The pool was only partially insolvent at first, so it still had enough tokens on hand to satisfy early `unstake(amount)` calls.
- Those users were paid from the pool'"'s remaining balance, with later depositors effectively covering the earlier accounting mismatch.
- Once the contract balance fell below the sum of recorded balances by enough that a requested "'`unstake(amount)` exceeded the remaining real balance, `token.transfer` started reverting with insufficient balance.
- The blocked users are not seeing a logic revert from the staking contract first; they are hitting the token contract because the pool is short real tokens.

The change that makes the accounting correct:

Credit the user with the amount the pool actually receives, not the nominal `amount` argument.

Example fix:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 afterBal = token.balanceOf(address(this));

    uint256 received = afterBal - beforeBal;
    stakedBalance[msg.sender] += received;
}
```

With that change:

- A user who "stakes 10,000" into a 2%-tax token is credited with `9,800`, because that is what the pool actually received.
- If they later unstake their full recorded balance of `9,800`, the pool remains internally solvent because it is only promising what it actually has.
- Because TKN also taxes outbound transfers, their wallet would receive `9,604` from that `unstake(9,800)` call if the token takes 2% again on the way out. That outbound loss is a token property, not a pool accounting error.

What happens to the users who currently cannot unstake:

- Changing the code fixes the accounting for future deposits, but it does not recreate the already-missing `25,000 TKN`.
- The current pool is already undercollateralized by `25,000 TKN`, so some existing stakers cannot all be made whole from the current contract balance.
- They can only be unstuck if `25,000 TKN` is added to the pool from outside, or if losses are socialized across current stakers by reducing recorded balances to match reality.
- In other words, the code fix prevents further growth of the deficit, but the historical deficit must still be funded or explicitly allocated.
EOF
cp /tmp/answer_content answer.md' in /home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

codex
I’ve drafted the content. I’m now rewriting it through the approved patch path so the workspace reflects the final answer cleanly.
exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003
 succeeded in 3ms:
This pool is accounting as if `amount` is what the contract receives and what the user later gets back. The observed behavior proves that TKN is a fee-on-transfer token with a 2% tax.

Reasoning:

1. The user who unstaked `10,000` and received `9,800` proves outbound transfers are taxed 2%.
   - The pool called `token.transfer(user, 10_000)`.
   - The user received `9,800`.
   - The missing `200` was taken by the token during the transfer.

2. The same token behavior explains the pool deficit on stake.
   - On every `stake(amount)`, the pool credits `stakedBalance[user] += amount`.
   - But with a 2% transfer tax, `token.transferFrom(user, pool, amount)` only increases the pool's real balance by `98%` of `amount`.
   - So the contract books a liability larger than the asset it actually received.

3. The aggregate numbers match exactly.
   - Cumulative nominal stakes: `1,250,000 TKN`
   - 2% tax on inbound transfers: `25,000 TKN`
   - Real TKN that actually entered the pool: `1,225,000 TKN`
   - Nominal unstaked amount sent by the pool: `250,000 TKN`
   - Pool balance after those unstake transfers: `1,225,000 - 250,000 = 975,000 TKN`

4. Why the books do not close.
   - Sum of all current `stakedBalance[user]`: `1,000,000 TKN`
   - Actual pool balance: `975,000 TKN`
   - Deficit: `25,000 TKN`
   - That missing `25,000` did not stay in the pool. It was skimmed by the token's transfer-fee mechanism during deposits.

5. Why the shortfall grows.
   - Each new stake overstates liabilities by another 2% of the nominal deposit.
   - If someone stakes `100,000`, the pool records `100,000` owed but only receives `98,000`.
   - The insolvency therefore increases with every additional stake.
   - Unstakes do not repair that gap: they reduce pool assets by the full `amount` transferred out, and they reduce the recorded liability by the same full `amount`. The existing deficit remains.

Why early users could unstake and later users cannot:

- The pool was only partially insolvent at first, so it still had enough tokens on hand to satisfy early `unstake(amount)` calls.
- Those users were paid from the pool's remaining balance, with later depositors effectively covering the earlier accounting mismatch.
- Once the contract balance fell below the sum of recorded balances by enough that a requested `unstake(amount)` exceeded the remaining real balance, `token.transfer` started reverting with insufficient balance.
- The blocked users are not seeing a logic revert from the staking contract first; they are hitting the token contract because the pool is short real tokens.

The change that makes the accounting correct:

Credit the user with the amount the pool actually receives, not the nominal `amount` argument.

Example fix:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 afterBal = token.balanceOf(address(this));

    uint256 received = afterBal - beforeBal;
    stakedBalance[msg.sender] += received;
}
```

With that change:

- A user who "stakes 10,000" into a 2%-tax token is credited with `9,800`, because that is what the pool actually received.
- If they later unstake their full recorded balance of `9,800`, the pool remains internally solvent because it is only promising what it actually has.
- Because TKN also taxes outbound transfers, their wallet would receive `9,604` from that `unstake(9,800)` call if the token takes 2% again on the way out. That outbound loss is a token property, not a pool accounting error.

What happens to the users who currently cannot unstake:

- Changing the code fixes the accounting for future deposits, but it does not recreate the already-missing `25,000 TKN`.
- The current pool is already undercollateralized by `25,000 TKN`, so some existing stakers cannot all be made whole from the current contract balance.
- They can only be unstuck if `25,000 TKN` is added to the pool from outside, or if losses are socialized across current stakers by reducing recorded balances to match reality.
- In other words, the code fix prevents further growth of the deficit, but the historical deficit must still be funded or explicitly allocated.

apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003/answer.md
diff --git a/answer.md b/answer.md
deleted file mode 100644
index 8ed6350542cc309b1bb1de08aa7861f7d53500cd..0000000000000000000000000000000000000000
--- a/answer.md
+++ /dev/null
@@ -1,69 +0,0 @@
-This pool is accounting as if `amount` is what the contract receives and what the user later gets back. The observed behavior proves that TKN is a fee-on-transfer token with a 2% tax.
-
-Reasoning:
-
-1. The user who unstaked `10,000` and received `9,800` proves outbound transfers are taxed 2%.
-   - The pool called `token.transfer(user, 10_000)`.
-   - The user received `9,800`.
-   - The missing `200` was taken by the token during the transfer.
-
-2. The same token behavior explains the pool deficit on stake.
-   - On every `stake(amount)`, the pool credits `stakedBalance[user] += amount`.
-   - But with a 2% transfer tax, `token.transferFrom(user, pool, amount)` only increases the pool's real balance by `98%` of `amount`.
-   - So the contract books a liability larger than the asset it actually received.
-
-3. The aggregate numbers match exactly.
-   - Cumulative nominal stakes: `1,250,000 TKN`
-   - 2% tax on inbound transfers: `25,000 TKN`
-   - Real TKN that actually entered the pool: `1,225,000 TKN`
-   - Nominal unstaked amount sent by the pool: `250,000 TKN`
-   - Pool balance after those unstake transfers: `1,225,000 - 250,000 = 975,000 TKN`
-
-4. Why the books do not close.
-   - Sum of all current `stakedBalance[user]`: `1,000,000 TKN`
-   - Actual pool balance: `975,000 TKN`
-   - Deficit: `25,000 TKN`
-   - That missing `25,000` did not stay in the pool. It was skimmed by the token's transfer-fee mechanism during deposits.
-
-5. Why the shortfall grows.
-   - Each new stake overstates liabilities by another 2% of the nominal deposit.
-   - If someone stakes `100,000`, the pool records `100,000` owed but only receives `98,000`.
-   - The insolvency therefore increases with every additional stake.
-   - Unstakes do not repair that gap: they reduce pool assets by the full `amount` transferred out, and they reduce the recorded liability by the same full `amount`. The existing deficit remains.
-
-Why early users could unstake and later users cannot:
-
-- The pool was only partially insolvent at first, so it still had enough tokens on hand to satisfy early `unstake(amount)` calls.
-- Those users were paid from the pool's remaining balance, with later depositors effectively covering the earlier accounting mismatch.
-- Once the contract balance fell below the sum of recorded balances by enough that a requested `unstake(amount)` exceeded the remaining real balance, `token.transfer` started reverting with insufficient balance.
-- The blocked users are not seeing a logic revert from the staking contract first; they are hitting the token contract because the pool is short real tokens.
-
-The change that makes the accounting correct:
-
-Credit the user with the amount the pool actually receives, not the nominal `amount` argument.
-
-Example fix:
-
-```solidity
-function stake(uint256 amount) external {
-    uint256 beforeBal = token.balanceOf(address(this));
-    token.transferFrom(msg.sender, address(this), amount);
-    uint256 afterBal = token.balanceOf(address(this));
-
-    uint256 received = afterBal - beforeBal;
-    stakedBalance[msg.sender] += received;
-}
-```
-
-With that change:
-
-- A user who "stakes 10,000" into a 2%-tax token is credited with `9,800`, because that is what the pool actually received.
-- If they later unstake their full recorded balance of `9,800`, the pool remains internally solvent because it is only promising what it actually has.
-- Because TKN also taxes outbound transfers, their wallet would receive `9,604` from that `unstake(9,800)` call if the token takes 2% again on the way out. That outbound loss is a token property, not a pool accounting error.
-
-What happens to the users who currently cannot unstake:
-
-- Changing the code fixes the accounting for future deposits, but it does not recreate the already-missing `25,000 TKN`.
-- The current pool is already undercollateralized by `25,000 TKN`, so some existing stakers cannot all be made whole from the current contract balance.
-- They can only be unstuck if `25,000 TKN` is added to the pool from outside, or if losses are socialized across current stakers by reducing recorded balances to match reality.
-- In other words, the code fix prevents further growth of the deficit, but the historical deficit must still be funded or explicitly allocated.

diff --git a/answer.md b/answer.md
deleted file mode 100644
index 8ed6350542cc309b1bb1de08aa7861f7d53500cd..0000000000000000000000000000000000000000
--- a/answer.md
+++ /dev/null
@@ -1,69 +0,0 @@
-This pool is accounting as if `amount` is what the contract receives and what the user later gets back. The observed behavior proves that TKN is a fee-on-transfer token with a 2% tax.
-
-Reasoning:
-
-1. The user who unstaked `10,000` and received `9,800` proves outbound transfers are taxed 2%.
-   - The pool called `token.transfer(user, 10_000)`.
-   - The user received `9,800`.
-   - The missing `200` was taken by the token during the transfer.
-
-2. The same token behavior explains the pool deficit on stake.
-   - On every `stake(amount)`, the pool credits `stakedBalance[user] += amount`.
-   - But with a 2% transfer tax, `token.transferFrom(user, pool, amount)` only increases the pool's real balance by `98%` of `amount`.
-   - So the contract books a liability larger than the asset it actually received.
-
-3. The aggregate numbers match exactly.
-   - Cumulative nominal stakes: `1,250,000 TKN`
-   - 2% tax on inbound transfers: `25,000 TKN`
-   - Real TKN that actually entered the pool: `1,225,000 TKN`
-   - Nominal unstaked amount sent by the pool: `250,000 TKN`
-   - Pool balance after those unstake transfers: `1,225,000 - 250,000 = 975,000 TKN`
-
-4. Why the books do not close.
-   - Sum of all current `stakedBalance[user]`: `1,000,000 TKN`
-   - Actual pool balance: `975,000 TKN`
-   - Deficit: `25,000 TKN`
-   - That missing `25,000` did not stay in the pool. It was skimmed by the token's transfer-fee mechanism during deposits.
-
-5. Why the shortfall grows.
-   - Each new stake overstates liabilities by another 2% of the nominal deposit.
-   - If someone stakes `100,000`, the pool records `100,000` owed but only receives `98,000`.
-   - The insolvency therefore increases with every additional stake.
-   - Unstakes do not repair that gap: they reduce pool assets by the full `amount` transferred out, and they reduce the recorded liability by the same full `amount`. The existing deficit remains.
-
-Why early users could unstake and later users cannot:
-
-- The pool was only partially insolvent at first, so it still had enough tokens on hand to satisfy early `unstake(amount)` calls.
-- Those users were paid from the pool's remaining balance, with later depositors effectively covering the earlier accounting mismatch.
-- Once the contract balance fell below the sum of recorded balances by enough that a requested `unstake(amount)` exceeded the remaining real balance, `token.transfer` started reverting with insufficient balance.
-- The blocked users are not seeing a logic revert from the staking contract first; they are hitting the token contract because the pool is short real tokens.
-
-The change that makes the accounting correct:
-
-Credit the user with the amount the pool actually receives, not the nominal `amount` argument.
-
-Example fix:
-
-```solidity
-function stake(uint256 amount) external {
-    uint256 beforeBal = token.balanceOf(address(this));
-    token.transferFrom(msg.sender, address(this), amount);
-    uint256 afterBal = token.balanceOf(address(this));
-
-    uint256 received = afterBal - beforeBal;
-    stakedBalance[msg.sender] += received;
-}
-```
-
-With that change:
-
-- A user who "stakes 10,000" into a 2%-tax token is credited with `9,800`, because that is what the pool actually received.
-- If they later unstake their full recorded balance of `9,800`, the pool remains internally solvent because it is only promising what it actually has.
-- Because TKN also taxes outbound transfers, their wallet would receive `9,604` from that `unstake(9,800)` call if the token takes 2% again on the way out. That outbound loss is a token property, not a pool accounting error.
-
-What happens to the users who currently cannot unstake:
-
-- Changing the code fixes the accounting for future deposits, but it does not recreate the already-missing `25,000 TKN`.
-- The current pool is already undercollateralized by `25,000 TKN`, so some existing stakers cannot all be made whole from the current contract balance.
-- They can only be unstuck if `25,000 TKN` is added to the pool from outside, or if losses are socialized across current stakers by reducing recorded balances to match reality.
-- In other words, the code fix prevents further growth of the deficit, but the historical deficit must still be funded or explicitly allocated.

codex
I removed the draft file and am adding the final version with the same content via patch so the edit history is clean and consistent.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003/answer.md
diff --git a/answer.md b/answer.md
index 8ed6350542cc309b1bb1de08aa7861f7d53500cd..3aa536932effd6d054a75de66385b8ac18c5d6c0
--- a/answer.md
+++ b/answer.md
@@ -8,8 +8,8 @@
    - The missing `200` was taken by the token during the transfer.
 
 2. The same token behavior explains the pool deficit on stake.
-   - On every `stake(amount)`, the pool credits `stakedBalance[user] += amount`.
-   - But with a 2% transfer tax, `token.transferFrom(user, pool, amount)` only increases the pool's real balance by `98%` of `amount`.
+   - On every `stake(amount)`, the pool credits `stakedBalance[msg.sender] += amount`.
+   - But with a 2% transfer tax, `token.transferFrom(msg.sender, address(this), amount)` only increases the pool's real balance by `98%` of `amount`.
    - So the contract books a liability larger than the asset it actually received.
 
 3. The aggregate numbers match exactly.

diff --git a/answer.md b/answer.md
index 8ed6350542cc309b1bb1de08aa7861f7d53500cd..3aa536932effd6d054a75de66385b8ac18c5d6c0
--- a/answer.md
+++ b/answer.md
@@ -8,8 +8,8 @@
    - The missing `200` was taken by the token during the transfer.
 
 2. The same token behavior explains the pool deficit on stake.
-   - On every `stake(amount)`, the pool credits `stakedBalance[user] += amount`.
-   - But with a 2% transfer tax, `token.transferFrom(user, pool, amount)` only increases the pool's real balance by `98%` of `amount`.
+   - On every `stake(amount)`, the pool credits `stakedBalance[msg.sender] += amount`.
+   - But with a 2% transfer tax, `token.transferFrom(msg.sender, address(this), amount)` only increases the pool's real balance by `98%` of `amount`.
    - So the contract books a liability larger than the asset it actually received.
 
 3. The aggregate numbers match exactly.

codex
Wrote the explanation to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003/answer.md).

It shows that TKN is a 2% fee-on-transfer token, so the pool credited `1,250,000` of liabilities while only receiving `1,225,000`, creating the exact `25,000 TKN` deficit. The fix is to credit `stakedBalance` with the pool’s actual balance delta on `stake()`, not the nominal input amount. It also covers why early unstakers succeeded, why later ones revert, and why the already-blocked users still need the existing `25,000 TKN` hole to be funded or socialized.
diff --git a/answer.md b/answer.md
index 8ed6350542cc309b1bb1de08aa7861f7d53500cd..3aa536932effd6d054a75de66385b8ac18c5d6c0
--- a/answer.md
+++ b/answer.md
@@ -8,8 +8,8 @@
    - The missing `200` was taken by the token during the transfer.
 
 2. The same token behavior explains the pool deficit on stake.
-   - On every `stake(amount)`, the pool credits `stakedBalance[user] += amount`.
-   - But with a 2% transfer tax, `token.transferFrom(user, pool, amount)` only increases the pool's real balance by `98%` of `amount`.
+   - On every `stake(amount)`, the pool credits `stakedBalance[msg.sender] += amount`.
+   - But with a 2% transfer tax, `token.transferFrom(msg.sender, address(this), amount)` only increases the pool's real balance by `98%` of `amount`.
    - So the contract books a liability larger than the asset it actually received.
 
 3. The aggregate numbers match exactly.

tokens used
15,395
````

## final message

Wrote the explanation to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125926Z-codex-no-skill-2/security-quiz-003/answer.md).

It shows that TKN is a 2% fee-on-transfer token, so the pool credited `1,250,000` of liabilities while only receiving `1,225,000`, creating the exact `25,000 TKN` deficit. The fix is to credit `stakedBalance` with the pool’s actual balance delta on `stake()`, not the nominal input amount. It also covers why early unstakers succeeded, why later ones revert, and why the already-blocked users still need the existing `25,000 TKN` hole to be funded or socialized.

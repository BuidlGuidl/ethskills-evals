# Aerodrome USDC/WETH Yield Vault Design

## Scope and Assumptions

This vault is for Base mainnet and uses Aerodrome's full-range volatile
USDC/WETH pool, not the stable pool and not a Slipstream concentrated-liquidity
position.

Key contracts:

| Component | Address |
| --- | --- |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| `vAMM-WETH/USDC` pool / LP token | `0xcDAC0d6c6C59727a65F871236188350531885C43` |
| `vAMM-WETH/USDC` gauge | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` |
| Gauge `feesVotingReward` | `0x14df87824a11DC27afF185D3149E05aaa4735f60` |

The pool address is resolved as:

```solidity
pool = PoolFactory.getPool(USDC, WETH, false);
```

The gauge address is resolved as:

```solidity
gauge = Voter.gauges(pool);
```

The gauge itself reports:

```solidity
IGauge(gauge).stakingToken() == pool;
IGauge(gauge).rewardToken() == AERO;
IGauge(gauge).feesVotingReward() == 0x14df87824a11DC27afF185D3149E05aaa4735f60;
```

Production deployment should still verify these relationships at construction
time so a bad configured address cannot redirect deposits or rewards.

## Position Lifecycle

Users deposit into the vault. The vault converts idle assets into the right
USDC/WETH ratio, adds liquidity through the Aerodrome Router, receives the
`vAMM-WETH/USDC` LP token, and stakes that LP token in the pool's gauge.

The staked gauge position is what earns the vault's recurring rewards. The
vault does not hold a veAERO NFT and does not vote in this design.

## `harvest()` Flow

`harvest()` compounds gauge emissions back into more USDC/WETH liquidity.

1. Snapshot balances.

   Record the vault's AERO, USDC, WETH, and LP-token balances before claiming.
   This is used to calculate the exact harvested amount and to avoid accounting
   on stale balances.

2. Claim AERO emissions from the Aerodrome gauge.

   ```solidity
   IGauge(0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025).getReward(address(this));
   ```

   This claims the vault's accrued gauge reward for its staked LP balance.
   For this gauge, `rewardToken()` is AERO:

   ```solidity
   AERO = 0x940181a94A35A4569E4529A3CDfB74e38FD98631;
   ```

   The harvest does not claim USDC/WETH swap fees, voting incentives, bribes,
   or veAERO rebases. Those are different Aerodrome reward streams for voters
   or veAERO lockers, not for this simple staked-LP vault.

3. Apply vault fees, if any.

   If the product charges a performance fee, take it from the claimed AERO
   before compounding. If the vault is fee-free, skip this step.

4. Swap claimed AERO into the deposit pair.

   Use the Aerodrome Router to swap the net AERO reward into USDC and WETH in
   the amounts needed to add balanced liquidity. The split should be based on
   the current pool reserves and any idle USDC/WETH already in the vault.

   The implementation should enforce `amountOutMin` values, a deadline, and a
   keeper-configured slippage limit. It should not blindly split AERO 50/50 by
   notional value if the vault already has idle assets from deposits,
   withdrawals, or previous rounding.

5. Add liquidity to `vAMM-WETH/USDC`.

   ```solidity
   router.addLiquidity(
       WETH,
       USDC,
       false,
       amountWethDesired,
       amountUsdcDesired,
       amountWethMin,
       amountUsdcMin,
       address(this),
       deadline
   );
   ```

   The `false` pool flag is important: WETH/USDC is the volatile pool path.
   The router returns additional LP tokens for the vault.

6. Stake newly minted LP tokens in the gauge.

   ```solidity
   IERC20(pool).approve(gauge, newLpAmount);
   IGauge(gauge).deposit(newLpAmount);
   ```

   After this step, the compounded liquidity starts earning future AERO
   emissions.

7. Emit accounting events.

   Emit the claimed AERO amount, any performance fee, swap outputs, LP tokens
   minted, LP tokens staked, and the resulting total staked LP balance. The
   vault's share price should increase through the added LP position, not by
   minting new user shares.

## What the Position Earns

The staked vault earns:

| Component | Who receives it in this design? | Notes |
| --- | --- | --- |
| AERO gauge emissions | The vault | Primary yield source. Emissions are streamed to the gauge based on veAERO votes for the pool, then distributed pro rata to staked LPs. |
| Autocompounding uplift | Existing vault share holders | Harvested AERO is sold into USDC/WETH, added as more LP, and staked, increasing assets per share over time. |
| WETH/USDC market exposure | Vault share holders | The LP position is long both assets and rebalances as trades move price. Users bear impermanent loss versus simply holding USDC and WETH. |
| Swap fees from the staked LP | veAERO voters, not the vault | Staking the LP in the gauge opts into AERO emissions and gives up the direct LP fee stream. |
| Voting incentives / bribes | veAERO voters, not the vault | Only a vault that also owns/controls veAERO and votes for the pool would receive these. |
| veAERO rebases | veAERO lockers, not the vault | This vault has no veAERO lock in the base design. |

A realistic return model for users is:

```text
net vault return
  ~= AERO emissions earned by the staked LP
   + compounding benefit from reinvestment frequency
   - swap slippage while converting AERO
   - keeper gas / keeper incentive
   - vault performance fees, if configured
   - impermanent loss from WETH/USDC price movement
```

The largest explicit yield line is AERO emissions. The largest economic risk is
usually WETH/USDC price movement: if WETH strongly rallies or sells off, the LP
can underperform a passive hold of the two assets even while earning emissions.
AERO price volatility also matters because rewards are earned in AERO before
each harvest swaps them into the underlying pair.

## Where Swap Fees Go

In this staked-LP design, the pool's swap fees do not accrue to vault users as
claimable USDC/WETH yield.

Aerodrome separates the roles:

- Staked LPs deposit LP tokens into a gauge and earn AERO emissions.
- veAERO voters vote for gauges and earn the pool's exchange revenue, including
  swap fees generated by staked liquidity.
- Aerodrome's accounting routes the fee stream for this gauge to its linked
  `FeesVotingReward` contract:

  ```solidity
  IGauge(0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025).feesVotingReward()
  // 0x14df87824a11DC27afF185D3149E05aaa4735f60
  ```

Those fees are distributed to veAERO voters who voted for the USDC/WETH gauge,
generally on Aerodrome's weekly epoch schedule. The vault would only capture
that revenue if the strategy were expanded to also lock AERO as veAERO and vote
for this pool. That would be a different strategy with different liquidity,
governance, lockup, and exit-risk assumptions.

## Sources

- Aerodrome docs: https://aerodrome.finance/docs
- Aerodrome contracts specification: https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md
- Aerodrome `IGauge` interface: https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IGauge.sol

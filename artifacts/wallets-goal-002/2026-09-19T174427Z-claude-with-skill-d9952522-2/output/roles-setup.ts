// roles-setup.ts — builds (does NOT sign or send) the Safe batch that grants the agent its scoped role.
//
// Output: a Safe{Wallet} Transaction Builder JSON file. The Safe owners review it, and the Safe
// threshold signs it. This script never touches a private key.
//
//   SAFE_ADDRESS=0x... ROLES_MODIFIER_ADDRESS=0x... AGENT_ADDRESS=0x... npx tsx roles-setup.ts > roles-batch.json
//
// What the agent can do after this batch executes (and nothing else):
//   Roles.execTransactionWithRole(SwapRouter, value=0, exactInputSingle(...), Call, "rebalancer")
//   where exactInputSingle params are either
//     WETH -> USDC, fee 500, recipient == Safe, amountIn <= 20 WETH, within 45 WETH / 24h
//     USDC -> WETH, fee 500, recipient == Safe, amountIn <= 60k USDC, within 150k USDC / 24h

import { c, flattenCondition, processPermissions, rolesAbi, Clearance, ExecutionOptions } from "zodiac-roles-sdk";
import { encodeFunctionData, getAddress, maxUint256, type Address, type Hex } from "viem";
import {
  ALLOWANCE_KEY_USDC,
  ALLOWANCE_KEY_WETH,
  ALLOWANCE_PERIOD_SECONDS,
  ONCHAIN_DAILY_USDC_IN,
  ONCHAIN_DAILY_WETH_IN,
  ONCHAIN_MAX_USDC_PER_TRADE,
  ONCHAIN_MAX_WETH_PER_TRADE,
  POOL_FEE,
  ROLE_KEY,
  SWAP_ROUTER,
  USDC,
  WETH,
  erc20Abi,
  exactInputSingleParamsType,
} from "./config.ts";

function requireAddress(name: string): Address {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return getAddress(v);
}

const safe = requireAddress("SAFE_ADDRESS");
const roles = requireAddress("ROLES_MODIFIER_ADDRESS");
const agent = requireAddress("AGENT_ADDRESS");

const { targets } = processPermissions([
  {
    targetAddress: SWAP_ROUTER,
    signature: `exactInputSingle(${exactInputSingleParamsType.replace(/ \w+(?=[,)])/g, "")})`,
    condition: c.calldataMatches(
      [
        c.or(
          c.matches({
            tokenIn: WETH,
            tokenOut: USDC,
            fee: POOL_FEE,
            recipient: c.avatar,
            amountIn: c.and(c.lte(ONCHAIN_MAX_WETH_PER_TRADE), c.withinAllowance(ALLOWANCE_KEY_WETH)),
          }),
          c.matches({
            tokenIn: USDC,
            tokenOut: WETH,
            fee: POOL_FEE,
            recipient: c.avatar,
            amountIn: c.and(c.lte(ONCHAIN_MAX_USDC_PER_TRADE), c.withinAllowance(ALLOWANCE_KEY_USDC)),
          }),
        ),
      ],
      [exactInputSingleParamsType],
    ),
    // no `send` (ETH value) and no `delegatecall`
  },
]);

const txs: { to: Address; value: "0"; data: Hex; description: string }[] = [];
const rolesCall = (description: string, data: Hex) => txs.push({ to: roles, value: "0", data, description });

for (const target of targets) {
  if (target.clearance !== Clearance.Function) throw new Error("expected function-level clearance only");
  rolesCall(
    `scopeTarget ${target.address}`,
    encodeFunctionData({ abi: rolesAbi, functionName: "scopeTarget", args: [ROLE_KEY, target.address] }),
  );
  for (const fn of target.functions) {
    if (fn.wildcarded || !fn.condition) throw new Error("refusing to grant an unconditioned function");
    if (fn.executionOptions !== ExecutionOptions.None) throw new Error("refusing send/delegatecall options");
    const flat = flattenCondition(fn.condition).map((f) => ({
      parent: f.parent,
      paramType: f.paramType,
      operator: f.operator,
      compValue: (f.compValue ?? "0x") as Hex,
    }));
    rolesCall(
      `scopeFunction ${target.address} ${fn.selector}`,
      encodeFunctionData({
        abi: rolesAbi,
        functionName: "scopeFunction",
        args: [ROLE_KEY, target.address, fn.selector, flat, fn.executionOptions],
      }),
    );
  }
}

const now = BigInt(Math.floor(Date.now() / 1000));
for (const [key, amount, label] of [
  [ALLOWANCE_KEY_WETH, ONCHAIN_DAILY_WETH_IN, "WETH"],
  [ALLOWANCE_KEY_USDC, ONCHAIN_DAILY_USDC_IN, "USDC"],
] as const) {
  // balance, maxRefill, refill, period, timestamp: starts full, refills to `amount` every 24h, never accumulates beyond it.
  rolesCall(
    `setAllowance ${label} daily cap`,
    encodeFunctionData({
      abi: rolesAbi,
      functionName: "setAllowance",
      args: [key, amount, amount, amount, ALLOWANCE_PERIOD_SECONDS, now],
    }),
  );
}

rolesCall(
  `assignRoles ${agent} -> rebalancer`,
  encodeFunctionData({ abi: rolesAbi, functionName: "assignRoles", args: [agent, [ROLE_KEY], [true]] }),
);

// Router approvals are granted by the owners here, not by the agent: the agent's role has no approve permission.
// SwapRouter can only pull from the Safe inside a swap the Safe itself initiated, and the Safe only initiates
// swaps through the scoped role above (or by owner-threshold transactions).
for (const token of [WETH, USDC]) {
  txs.push({
    to: token,
    value: "0",
    data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [SWAP_ROUTER, maxUint256] }),
    description: `approve SwapRouter on ${token}`,
  });
}

const batch = {
  version: "1.0",
  chainId: "1",
  createdAt: Date.now(),
  meta: {
    name: "Grant scoped rebalancer role",
    description: `Scope role 'rebalancer' on Roles ${roles} for agent ${agent}; daily caps; router approvals`,
    txBuilderVersion: "1.18.0",
    createdFromSafeAddress: safe,
    createdFromOwnerAddress: "",
  },
  transactions: txs.map(({ to, value, data }) => ({ to, value, data, contractMethod: null, contractInputsValues: null })),
};

for (const t of txs) console.error(`  ${t.to}  ${t.description}`);
console.log(JSON.stringify(batch, null, 2));

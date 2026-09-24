/**
 * Generates the one-time Safe transaction batch that gives the agent its (only) power:
 *
 *   1. deploy a Zodiac Roles Modifier v2 proxy (owner = avatar = target = the Safe)
 *   2. Safe.enableModule(roles)
 *   3. scope the role to SwapRouter.exactInputSingle with:
 *        (tokenIn == WETH && tokenOut == USDC && amountIn within allowance "weth-daily")
 *     OR (tokenIn == USDC && tokenOut == WETH && amountIn within allowance "usdc-daily")
 *        AND fee == 500, recipient == the Safe (EqualToAvatar); no ETH value, no delegatecall
 *   4. set both daily allowances (refill every 24h, no carry-over)
 *   5. assign the role to the agent address
 *   6. Safe approves SwapRouter for WETH and USDC (owner action; the agent can't approve)
 *
 * Output is a Safe{Wallet} Transaction Builder JSON. Import it in the Safe app, check every
 * call, and sign with the owner hardware wallets. It is run end-to-end in scripts/fork-test.ts.
 *
 *   SAFE_ADDRESS=0x.. AGENT_ADDRESS=0x.. WETH_DAILY=30 USDC_DAILY=80000 npx tsx scripts/roles-permissions.ts > batch.json
 */
import {
  type Address,
  type Hex,
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  getCreate2Address,
  keccak256,
  maxUint256,
  parseAbi,
  parseUnits,
  stringToHex,
  toFunctionSelector,
} from "viem";
import { ALLOWANCE_KEYS, CONTRACTS, POOL_FEE, swapRouterAbi } from "../rebalance.ts";

// Zodiac infrastructure on mainnet (verified to have code on 2026-09-19).
export const ZODIAC = {
  MODULE_PROXY_FACTORY: "0x000000000000aDdB49795b0f9bA5BC298cDda236",
  ROLES_V2_MASTERCOPY: "0x9646fDAD06d3e24444381f44362a3B0eB343D337",
} as const satisfies Record<string, Address>;

export const rolesAdminAbi = parseAbi([
  "function setUp(bytes initParams)",
  "function assignRoles(address module, bytes32[] roleKeys, bool[] memberOf)",
  "function scopeTarget(bytes32 roleKey, address targetAddress)",
  "struct ConditionFlat { uint8 parent; uint8 paramType; uint8 operator; bytes compValue; }",
  "function scopeFunction(bytes32 roleKey, address targetAddress, bytes4 selector, ConditionFlat[] conditions, uint8 options)",
  "function setAllowance(bytes32 key, uint128 balance, uint128 maxRefill, uint128 refill, uint64 period, uint64 timestamp)",
  "function allowances(bytes32 key) view returns (uint128 refill, uint128 maxRefill, uint64 period, uint128 balance, uint64 timestamp)",
]);
const moduleFactoryAbi = parseAbi(["function deployModule(address masterCopy, bytes initializer, uint256 saltNonce) returns (address proxy)"]);
const safeAbi = parseAbi(["function enableModule(address module)"]);
const erc20ApproveAbi = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);

// Roles v2 enums (Types.sol)
const P = { None: 0, Static: 1, Dynamic: 2, Tuple: 3, Array: 4, Calldata: 5, AbiEncoded: 6 } as const;
const O = { Pass: 0, And: 1, Or: 2, Matches: 5, EqualToAvatar: 15, EqualTo: 16, WithinAllowance: 28 } as const;

export const ALLOWANCE_WETH = ALLOWANCE_KEYS.SELL_WETH;
export const ALLOWANCE_USDC = ALLOWANCE_KEYS.BUY_WETH;

const eq = (type: "address" | "uint24", value: Address | number): Hex => encodeAbiParameters([{ type }], [value as never]);

/** Condition tree, flattened breadth-first as Roles v2 requires. */
export function swapConditions() {
  const leg = (parentTuple: number, tokenIn: Address, tokenOut: Address, allowanceKey: Hex) => [
    { parent: parentTuple, paramType: P.Static, operator: O.EqualTo, compValue: eq("address", tokenIn) }, // tokenIn
    { parent: parentTuple, paramType: P.Static, operator: O.EqualTo, compValue: eq("address", tokenOut) }, // tokenOut
    { parent: parentTuple, paramType: P.Static, operator: O.EqualTo, compValue: eq("uint24", POOL_FEE) }, // fee -> pins the 0.05% pool
    { parent: parentTuple, paramType: P.Static, operator: O.EqualToAvatar, compValue: "0x" as Hex }, // recipient == Safe
    { parent: parentTuple, paramType: P.Static, operator: O.Pass, compValue: "0x" as Hex }, // deadline
    { parent: parentTuple, paramType: P.Static, operator: O.WithinAllowance, compValue: allowanceKey }, // amountIn
    { parent: parentTuple, paramType: P.Static, operator: O.Pass, compValue: "0x" as Hex }, // amountOutMinimum
    { parent: parentTuple, paramType: P.Static, operator: O.Pass, compValue: "0x" as Hex }, // sqrtPriceLimitX96
  ];
  return [
    { parent: 0, paramType: P.None, operator: O.Or, compValue: "0x" as Hex }, // 0: root
    { parent: 0, paramType: P.Calldata, operator: O.Matches, compValue: "0x" as Hex }, // 1: sell WETH
    { parent: 0, paramType: P.Calldata, operator: O.Matches, compValue: "0x" as Hex }, // 2: buy WETH
    { parent: 1, paramType: P.Tuple, operator: O.Matches, compValue: "0x" as Hex }, // 3: params struct
    { parent: 2, paramType: P.Tuple, operator: O.Matches, compValue: "0x" as Hex }, // 4: params struct
    ...leg(3, CONTRACTS.WETH, CONTRACTS.USDC, ALLOWANCE_WETH), // 5..12
    ...leg(4, CONTRACTS.USDC, CONTRACTS.WETH, ALLOWANCE_USDC), // 13..20
  ];
}

export interface BatchParams {
  safe: Address;
  agent: Address;
  roleKey: Hex;
  wethDaily: bigint; // wei
  usdcDaily: bigint; // 1e-6 USDC
  saltNonce: bigint;
  now: bigint;
}

export function rolesSetupBatch(p: BatchParams) {
  const initializer = encodeFunctionData({
    abi: rolesAdminAbi,
    functionName: "setUp",
    args: [encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "address" }], [p.safe, p.safe, p.safe])],
  });
  // ModuleProxyFactory: CREATE2 of an EIP-1167 minimal proxy, salt = keccak(keccak(initializer) ++ saltNonce)
  const roles = getCreate2Address({
    from: ZODIAC.MODULE_PROXY_FACTORY,
    salt: keccak256(concat([keccak256(initializer), encodeAbiParameters([{ type: "uint256" }], [p.saltNonce])])),
    bytecode: concat(["0x602d8060093d393df3363d3d373d3d3d363d73", ZODIAC.ROLES_V2_MASTERCOPY, "0x5af43d82803e903d91602b57fd5bf3"]),
  });
  const selector = toFunctionSelector(swapRouterAbi[0]);
  const call = (to: Address, data: Hex, label: string) => ({ to, value: "0", data, label });
  const day = 86_400n;
  const txs = [
    call(
      ZODIAC.MODULE_PROXY_FACTORY,
      encodeFunctionData({ abi: moduleFactoryAbi, functionName: "deployModule", args: [ZODIAC.ROLES_V2_MASTERCOPY, initializer, p.saltNonce] }),
      "deploy Roles Modifier proxy",
    ),
    call(p.safe, encodeFunctionData({ abi: safeAbi, functionName: "enableModule", args: [roles] }), "enable Roles on Safe"),
    call(roles, encodeFunctionData({ abi: rolesAdminAbi, functionName: "scopeTarget", args: [p.roleKey, CONTRACTS.SWAP_ROUTER] }), "scope role to SwapRouter"),
    call(
      roles,
      encodeFunctionData({
        abi: rolesAdminAbi,
        functionName: "scopeFunction",
        args: [p.roleKey, CONTRACTS.SWAP_ROUTER, selector, swapConditions(), 0 /* no value, no delegatecall */],
      }),
      "allow exactInputSingle WETH<->USDC, fee 500, recipient=Safe, within allowance",
    ),
    call(
      roles,
      encodeFunctionData({ abi: rolesAdminAbi, functionName: "setAllowance", args: [ALLOWANCE_WETH, p.wethDaily, p.wethDaily, p.wethDaily, day, p.now] }),
      "WETH-in daily allowance",
    ),
    call(
      roles,
      encodeFunctionData({ abi: rolesAdminAbi, functionName: "setAllowance", args: [ALLOWANCE_USDC, p.usdcDaily, p.usdcDaily, p.usdcDaily, day, p.now] }),
      "USDC-in daily allowance",
    ),
    call(roles, encodeFunctionData({ abi: rolesAdminAbi, functionName: "assignRoles", args: [p.agent, [p.roleKey], [true]] }), "assign role to agent"),
    call(
      CONTRACTS.WETH,
      encodeFunctionData({ abi: erc20ApproveAbi, functionName: "approve", args: [CONTRACTS.SWAP_ROUTER, maxUint256] }),
      "Safe approves SwapRouter: WETH",
    ),
    call(
      CONTRACTS.USDC,
      encodeFunctionData({ abi: erc20ApproveAbi, functionName: "approve", args: [CONTRACTS.SWAP_ROUTER, maxUint256] }),
      "Safe approves SwapRouter: USDC",
    ),
  ];
  return { roles, txs };
}

/** Emergency: the Safe calls this on the Roles modifier to remove the agent instantly. */
export const revokeAgentCalldata = (agent: Address, roleKey: Hex) =>
  encodeFunctionData({ abi: rolesAdminAbi, functionName: "assignRoles", args: [agent, [roleKey], [false]] });

if (import.meta.url === `file://${process.argv[1]}`) {
  const safe = process.env.SAFE_ADDRESS as Address;
  const agent = process.env.AGENT_ADDRESS as Address;
  if (!safe || !agent) throw new Error("set SAFE_ADDRESS and AGENT_ADDRESS");
  const { roles, txs } = rolesSetupBatch({
    safe,
    agent,
    roleKey: stringToHex(process.env.ROLE_KEY ?? "treasury-rebalancer", { size: 32 }),
    wethDaily: parseUnits(process.env.WETH_DAILY ?? "30", 18),
    usdcDaily: parseUnits(process.env.USDC_DAILY ?? "80000", 6),
    saltNonce: BigInt(process.env.SALT_NONCE ?? Date.now()),
    now: BigInt(Math.floor(Date.now() / 1000)),
  });
  console.error(`Roles Modifier will be deployed at ${roles} -> set ROLES_MODIFIER_ADDRESS to this`);
  console.log(
    JSON.stringify(
      {
        version: "1.0",
        chainId: "1",
        createdAt: Date.now(),
        meta: { name: "Treasury rebalancer: Roles setup", description: txs.map((t, i) => `${i + 1}. ${t.label}`).join("; ") },
        transactions: txs.map(({ to, value, data }) => ({ to, value, data })),
      },
      null,
      2,
    ),
  );
}

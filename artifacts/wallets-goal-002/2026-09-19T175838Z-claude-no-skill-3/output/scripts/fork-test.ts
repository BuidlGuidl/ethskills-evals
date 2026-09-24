/**
 * End-to-end rehearsal on a mainnet fork: real Safe 1.4.1, real Zodiac Roles v2, real
 * Uniswap pool and Chainlink feeds. Only the signer (anvil key instead of KMS) and the send
 * RPC (anvil instead of Flashbots Protect) differ from production.
 *
 *   anvil --fork-url $RPC_URL --port 8547
 *   FORK_RPC=http://127.0.0.1:8547 npx tsx scripts/fork-test.ts
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Address,
  type Hex,
  createPublicClient,
  createTestClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  parseAbi,
  parseEther,
  parseUnits,
  stringToHex,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { CONTRACTS, rolesAbi, swapRouterAbi } from "../rebalance.ts";
import { ALLOWANCE_WETH, revokeAgentCalldata, rolesAdminAbi, rolesSetupBatch } from "./roles-permissions.ts";

const RPC = process.env.FORK_RPC ?? "http://127.0.0.1:8547";
const SAFE = {
  PROXY_FACTORY: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
  SINGLETON_L2: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
  FALLBACK_HANDLER: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
} as const;
const DAI: Address = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

// anvil default accounts 0 and 1
const owner = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const AGENT_KEY: Hex = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const agent = privateKeyToAccount(AGENT_KEY);
const ROLE_KEY = "treasury-rebalancer";
const roleKey = stringToHex(ROLE_KEY, { size: 32 });

const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });
const test = createTestClient({ chain: mainnet, mode: "anvil", transport: http(RPC) });
const ownerWallet = createWalletClient({ chain: mainnet, account: owner, transport: http(RPC) });

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failures++;
};

async function deploySafe(): Promise<Address> {
  const setup = encodeFunctionData({
    abi: parseAbi([
      "function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)",
    ]),
    args: [[owner.address], 1n, zeroAddress, "0x", SAFE.FALLBACK_HANDLER, zeroAddress, 0n, zeroAddress],
  });
  const factoryAbi = parseAbi(["function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address proxy)"]);
  const args = [SAFE.SINGLETON_L2, setup, BigInt(Date.now())] as const;
  const { result, request } = await pub.simulateContract({
    account: owner,
    address: SAFE.PROXY_FACTORY,
    abi: factoryAbi,
    functionName: "createProxyWithNonce",
    args,
  });
  await pub.waitForTransactionReceipt({ hash: await ownerWallet.writeContract(request) });
  return result;
}

/** Execute calls *as the Safe* (stands in for owners signing the Transaction Builder batch). */
async function asSafe(safe: Address, txs: { to: Address; data: Hex }[]) {
  await test.impersonateAccount({ address: safe });
  await test.setBalance({ address: safe, value: parseEther("1") });
  const w = createWalletClient({ chain: mainnet, account: safe, transport: http(RPC) });
  for (const t of txs) {
    const hash = await w.sendTransaction({ to: t.to, data: t.data, account: safe, chain: mainnet });
    const r = await pub.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`Safe call to ${t.to} reverted`);
  }
  await test.stopImpersonatingAccount({ address: safe });
}

/** Try a call through the Roles modifier as `from`; returns true if it would be allowed. */
async function rolesAllows(roles: Address, from: Address, to: Address, data: Hex, operation = 0): Promise<boolean> {
  try {
    await pub.simulateContract({
      account: from,
      address: roles,
      abi: rolesAbi,
      functionName: "execTransactionWithRole",
      args: [to, 0n, data, operation, roleKey, true],
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // ── 1. Safe + Roles setup, exactly the batch the owners would sign ──
  const safe = await deploySafe();
  console.log(`Safe:  ${safe}`);
  const now = (await pub.getBlock()).timestamp;
  const { roles, txs } = rolesSetupBatch({
    safe,
    agent: agent.address,
    roleKey,
    wethDaily: parseEther("60"),
    usdcDaily: parseUnits("150000", 6),
    saltNonce: 42n,
    now,
  });
  await asSafe(safe, txs);
  check((await pub.getCode({ address: roles }))?.length! > 2, `Roles modifier deployed at predicted address ${roles}`);

  // ── 2. Treasury funding: 100 WETH into the Safe; agent gets gas ETH ──
  await ownerWallet.sendTransaction({ to: CONTRACTS.WETH, value: parseEther("100") });
  await ownerWallet.writeContract({ address: CONTRACTS.WETH, abi: erc20Abi, functionName: "transfer", args: [safe, parseEther("100")] });
  await test.setBalance({ address: agent.address, value: parseEther("0.5") });

  // ── 3. The real execution path ──
  const stateDir = mkdtempSync(join(tmpdir(), "rebalance-"));
  Object.assign(process.env, {
    RPC_URL: RPC,
    SEND_RPC_URL: RPC,
    SAFE_ADDRESS: safe,
    ROLES_MODIFIER_ADDRESS: roles,
    ROLE_KEY,
    SIGNER: "local",
    I_UNDERSTAND_LOCAL_KEY_IS_FOR_TESTING: "yes",
    AGENT_PRIVATE_KEY: AGENT_KEY,
    STATE_DIR: stateDir,
    MAX_BASE_FEE_GWEI: "1000",
    MAX_TRADE_USD: "60000",
    MAX_DAILY_USD: "250000",
  });
  const { executeRebalance } = await import("../rebalance.ts");
  const bal = (t: Address) => pub.readContract({ address: t, abi: erc20Abi, functionName: "balanceOf", args: [safe] });

  const dry = await executeRebalance({ id: "dry", side: "SELL_WETH", amountIn: parseEther("15") }, { dryRun: true });
  check(dry.status === "dry-run", `dry run: ${JSON.stringify(dry, (_, v) => (typeof v === "bigint" ? v.toString() : v))}`);

  const sell = await executeRebalance({ id: "t1", side: "SELL_WETH", amountIn: parseEther("15") });
  check(sell.status === "filled", `SELL 15 WETH -> ${sell.status === "filled" ? formatUnits(sell.amountOut, 6) + " USDC" : JSON.stringify(sell)}`);
  check((await bal(CONTRACTS.WETH)) === parseEther("85"), "Safe WETH 100 -> 85");

  const buy = await executeRebalance({ id: "t2", side: "BUY_WETH", amountIn: parseUnits("20000", 6) });
  check(buy.status === "filled", `BUY with 20,000 USDC -> ${buy.status === "filled" ? formatUnits(buy.amountOut, 18) + " WETH" : JSON.stringify(buy)}`);

  const dup = await executeRebalance({ id: "t1", side: "SELL_WETH", amountIn: parseEther("15") });
  check(dup.status === "duplicate", "same decision id is not traded twice");

  const big = await executeRebalance({ id: "t3", side: "SELL_WETH", amountIn: parseEther("40") });
  check(big.status === "rejected", `over MAX_TRADE_USD rejected off-chain (${"reason" in big ? big.reason : ""})`);

  const [, , , wethLeft] = await pub.readContract({ address: roles, abi: rolesAdminAbi, functionName: "allowances", args: [ALLOWANCE_WETH] });
  check(wethLeft === parseEther("45"), `on-chain WETH allowance consumed: 60 -> ${formatUnits(wethLeft, 18)}`);

  // 45 WETH left on-chain. Two 20 WETH trades (~$53k each, under MAX_TRADE_USD) fill; the third exceeds what's left.
  const a = await executeRebalance({ id: "t5", side: "SELL_WETH", amountIn: parseEther("20") });
  const b = await executeRebalance({ id: "t6", side: "SELL_WETH", amountIn: parseEther("20") });
  const c = await executeRebalance({ id: "t7", side: "SELL_WETH", amountIn: parseEther("20") });
  check(
    a.status === "filled" && b.status === "filled" && c.status === "rejected",
    `exhausted on-chain allowance -> routine rejection, not a page (${"reason" in c ? c.reason : c.status})`,
  );

  writeFileSync(join(stateDir, "HALT"), "test");
  const halted = await executeRebalance({ id: "t4", side: "SELL_WETH", amountIn: parseEther("1") });
  check(halted.status === "halted", "HALT file stops trading");
  rmSync(join(stateDir, "HALT"));

  // ── 4. What a stolen agent key can NOT do (on-chain enforcement) ──
  const deadline = now + 10n * 86_400n; // far enough out to survive the 24h time warp below
  const swap = (o: Partial<{ tokenIn: Address; tokenOut: Address; fee: number; recipient: Address; amountIn: bigint }>) =>
    encodeFunctionData({
      abi: swapRouterAbi,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: CONTRACTS.WETH,
          tokenOut: CONTRACTS.USDC,
          fee: 500,
          recipient: safe,
          deadline,
          amountIn: parseEther("1"),
          amountOutMinimum: 0n,
          sqrtPriceLimitX96: 0n,
          ...o,
        },
      ],
    });
  const R = CONTRACTS.SWAP_ROUTER;
  check(await rolesAllows(roles, agent.address, R, swap({})), "allowed: well-formed WETH->USDC swap to the Safe");
  check(!(await rolesAllows(roles, agent.address, R, swap({ recipient: agent.address }))), "blocked: swap output sent to the agent");
  check(!(await rolesAllows(roles, agent.address, R, swap({ fee: 3000 }))), "blocked: different pool (fee 3000)");
  check(!(await rolesAllows(roles, agent.address, R, swap({ tokenOut: DAI }))), "blocked: other tokenOut (DAI)");
  check(
    !(await rolesAllows(roles, agent.address, R, swap({ tokenIn: CONTRACTS.USDC, tokenOut: CONTRACTS.WETH, amountIn: parseUnits("140000", 6) }))),
    "blocked: USDC-in beyond remaining daily allowance",
  );
  check(!(await rolesAllows(roles, agent.address, R, swap({ amountIn: parseEther("6") }))), "blocked: WETH-in beyond remaining daily allowance (5)");
  check(!(await rolesAllows(roles, agent.address, R, swap({}), 1)), "blocked: delegatecall");
  const steal = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [agent.address, parseEther("1")] });
  check(!(await rolesAllows(roles, agent.address, CONTRACTS.WETH, steal)), "blocked: WETH.transfer to agent");
  const approve = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [agent.address, parseEther("1")] });
  check(!(await rolesAllows(roles, agent.address, CONTRACTS.USDC, approve)), "blocked: USDC.approve to agent");
  check(!(await rolesAllows(roles, owner.address, R, swap({}))), "blocked: non-member caller");

  // ── 5. Allowance refills after 24h ──
  await test.increaseTime({ seconds: 86_400 });
  await test.mine({ blocks: 1 });
  check(await rolesAllows(roles, agent.address, R, swap({ amountIn: parseEther("50") })), "allowance refilled after 24h (50 WETH ok)");
  check(!(await rolesAllows(roles, agent.address, R, swap({ amountIn: parseEther("61") }))), "refill does not carry over: 61 WETH still blocked");

  // ── 6. Emergency revoke ──
  await asSafe(safe, [{ to: roles, data: revokeAgentCalldata(agent.address, roleKey) }]);
  check(!(await rolesAllows(roles, agent.address, R, swap({}))), "after revoke: agent can do nothing");

  rmSync(stateDir, { recursive: true, force: true });
  console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

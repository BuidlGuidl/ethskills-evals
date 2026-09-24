// Mainnet-fork end-to-end test. Never touches mainnet state and uses no real keys.
//
//   anvil --fork-url <mainnet rpc> --port 8599
//   FORK_RPC=http://127.0.0.1:8599 npx tsx test/fork-test.ts
//
// Deploys a real 2-of-3 Safe 1.4.1 and a Roles v2 proxy, applies roles-setup.ts's batch (Safe impersonated
// in place of collecting owner signatures), then runs rebalance.ts as a child process and checks that the
// role rejects everything outside its scope.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createTestClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  parseAbi,
  parseEther,
  publicActions,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { rolesAbi } from "zodiac-roles-sdk";
import { ROLE_KEY, SWAP_ROUTER, USDC, WETH, erc20Abi, swapRouterAbi } from "../config.ts";

const RPC = process.env.FORK_RPC ?? "http://127.0.0.1:8599";
const t = createTestClient({ chain: mainnet, mode: "anvil", transport: http(RPC) }).extend(publicActions);

const SAFE_SINGLETON = "0x41675C099F32341bf84BFc5382aF534df5C7461a"; // Safe 1.4.1
const SAFE_PROXY_FACTORY = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67";
const ROLES_MASTERCOPY = "0x9646fDAD06d3e24444381f44362a3B0eB343D337"; // Zodiac Roles v2
const MODULE_PROXY_FACTORY = "0x000000000000aDdB49795b0f9bA5BC298cDda236";

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!ok) failures++;
};

async function sendAs(from: Address, to: Address, data: Hex, value = 0n) {
  await t.impersonateAccount({ address: from });
  await t.setBalance({ address: from, value: parseEther("10") + value });
  const w = createWalletClient({ chain: mainnet, transport: http(RPC) });
  const hash = await w.sendTransaction({ account: from, to, data, value, chain: mainnet });
  const r = await t.waitForTransactionReceipt({ hash });
  await t.stopImpersonatingAccount({ address: from });
  if (r.status !== "success") throw new Error(`tx from ${from} to ${to} reverted`);
  return r;
}

async function main() {
  const funder = privateKeyToAccount(generatePrivateKey()).address;
  const owners = [0, 1, 2].map(() => privateKeyToAccount(generatePrivateKey()).address);

  // 1. Safe 2-of-3
  const safeSetup = encodeFunctionData({
    abi: parseAbi(["function setup(address[],uint256,address,bytes,address,address,uint256,address)"]),
    args: [owners, 2n, zeroAddress, "0x", zeroAddress, zeroAddress, 0n, zeroAddress],
  });
  const factoryAbi = parseAbi([
    "function createProxyWithNonce(address,bytes,uint256) returns (address)",
    "event ProxyCreation(address indexed proxy, address singleton)",
  ]);
  const r1 = await sendAs(funder, SAFE_PROXY_FACTORY, encodeFunctionData({
    abi: factoryAbi, functionName: "createProxyWithNonce", args: [SAFE_SINGLETON, safeSetup, BigInt(Date.now())],
  }));
  const safe = getAddress(r1.logs.map((l) => { try { return decodeEventLog({ abi: factoryAbi, ...l }); } catch { return null; } })
    .find((e) => e?.eventName === "ProxyCreation")!.args.proxy as Address);

  // 2. Roles v2 proxy: owner = avatar = target = Safe; enable as module
  const mpfAbi = parseAbi([
    "function deployModule(address,bytes,uint256) returns (address)",
    "event ModuleProxyCreation(address indexed proxy, address indexed masterCopy)",
  ]);
  const init = encodeFunctionData({
    abi: rolesAbi, functionName: "setUp",
    args: [encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "address" }], [safe, safe, safe])],
  });
  const r2 = await sendAs(funder, MODULE_PROXY_FACTORY, encodeFunctionData({
    abi: mpfAbi, functionName: "deployModule", args: [ROLES_MASTERCOPY, init, BigInt(Date.now())],
  }));
  const roles = getAddress(r2.logs.map((l) => { try { return decodeEventLog({ abi: mpfAbi, ...l }); } catch { return null; } })
    .find((e) => e?.eventName === "ModuleProxyCreation")!.args.proxy as Address);
  await sendAs(safe, safe, encodeFunctionData({ abi: parseAbi(["function enableModule(address)"]), args: [roles] }));

  // 3. Agent key (throwaway, fork only)
  const agentKey = generatePrivateKey();
  const agent = privateKeyToAccount(agentKey).address;
  await t.setBalance({ address: agent, value: parseEther("0.2") });
  const dir = mkdtempSync(join(tmpdir(), "rebal-"));
  writeFileSync(join(dir, "agent_key"), agentKey, { mode: 0o600 });

  // 4. Owner batch from roles-setup.ts
  const env = { ...process.env, SAFE_ADDRESS: safe, ROLES_MODIFIER_ADDRESS: roles, AGENT_ADDRESS: agent };
  const batch = JSON.parse(execFileSync("npx", ["tsx", "roles-setup.ts"], { env, stdio: ["ignore", "pipe", "ignore"] }).toString());
  for (const tx of batch.transactions) await sendAs(safe, tx.to, tx.data);

  // 5. Fund the Safe: 120 WETH, then swap 40 of it to USDC as an owner action
  await sendAs(safe, WETH, encodeFunctionData({ abi: parseAbi(["function deposit()"]) }), parseEther("120"));
  await sendAs(safe, SWAP_ROUTER, encodeFunctionData({
    abi: swapRouterAbi, functionName: "exactInputSingle",
    args: [{ tokenIn: WETH, tokenOut: USDC, fee: 500, recipient: safe, deadline: 2n ** 40n, amountIn: parseEther("40"), amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }],
  }));
  const bal = async (tok: Address) => t.readContract({ address: tok, abi: erc20Abi, functionName: "balanceOf", args: [safe] });
  console.log(`Safe ${safe}  Roles ${roles}  agent ${agent}`);
  console.log(`Safe start: WETH ${await bal(WETH)}  USDC ${await bal(USDC)}`);

  const runEnv = { ...env, RPC_URL: RPC, SUBMIT_RPC_URL: RPC, AGENT_KEY_FILE: join(dir, "agent_key"), STATE_DIR: dir };
  const run = (args: string[], extra: Record<string, string> = {}) => {
    try {
      return { ok: true, out: execFileSync("npx", ["tsx", "rebalance.ts", ...args], { env: { ...runEnv, ...extra }, stdio: ["ignore", "pipe", "pipe"] }).toString() };
    } catch (e: any) {
      return { ok: false, out: `${e.stdout}${e.stderr}` };
    }
  };

  // Happy paths
  const nonceBefore = await t.getTransactionCount({ address: agent });
  const dry = run(["sell-weth", "5"]);
  check("dry run plans but does not sign", dry.ok && dry.out.includes("dry_run_stop") && (await t.getTransactionCount({ address: agent })) === nonceBefore);

  let w0 = await bal(WETH), u0 = await bal(USDC);
  const s1 = run(["sell-weth", "5"], { EXECUTE: "1" });
  check("sell 5 WETH executes via role", s1.ok && s1.out.includes("confirmed"), s1.ok ? "" : s1.out.slice(-400));
  check("  WETH left Safe, USDC arrived in Safe", w0 - (await bal(WETH)) === parseEther("5") && (await bal(USDC)) > u0);

  w0 = await bal(WETH); u0 = await bal(USDC);
  const s2 = run(["sell-usdc", "20000"], { EXECUTE: "1" });
  check("sell 20k USDC executes via role", s2.ok && s2.out.includes("confirmed"), s2.ok ? "" : s2.out.slice(-400));
  check("  USDC left Safe, WETH arrived in Safe", u0 - (await bal(USDC)) === 20_000n * 10n ** 6n && (await bal(WETH)) > w0);

  const big = run(["sell-usdc", "55000"]);
  check("off-chain policy refuses > $50k", !big.ok && big.out.includes("exceeds policy max"));

  // Direct abuse attempts with the agent key, bypassing rebalance.ts
  const agentWallet = createWalletClient({ account: privateKeyToAccount(agentKey), chain: mainnet, transport: http(RPC) });
  const attacker = privateKeyToAccount(generatePrivateKey()).address;
  const swap = (o: Partial<{ recipient: Address; amountIn: bigint; fee: number; tokenOut: Address }>) =>
    encodeFunctionData({ abi: swapRouterAbi, functionName: "exactInputSingle", args: [{
      tokenIn: WETH, tokenOut: o.tokenOut ?? USDC, fee: o.fee ?? 500, recipient: o.recipient ?? safe,
      deadline: 2n ** 40n, amountIn: o.amountIn ?? parseEther("1"), amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }] });
  const attempt = async (name: string, to: Address, data: Hex, op = 0) => {
    try {
      await t.simulateContract({ account: agentWallet.account, address: roles, abi: rolesAbi, functionName: "execTransactionWithRole", args: [to, 0n, data, op, ROLE_KEY, true] });
      check(name, false, "was allowed");
    } catch (e: any) {
      check(name, true, e.shortMessage?.split("\n")[0] ?? "reverted");
    }
  };
  await attempt("role rejects swap output to attacker", SWAP_ROUTER, swap({ recipient: attacker }));
  await attempt("role rejects other fee tier", SWAP_ROUTER, swap({ fee: 3000 }));
  await attempt("role rejects other output token", SWAP_ROUTER, swap({ tokenOut: getAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7") }));
  await attempt("role rejects > 20 WETH per trade", SWAP_ROUTER, swap({ amountIn: parseEther("21") }));
  await attempt("role rejects WETH.transfer", WETH, encodeFunctionData({ abi: parseAbi(["function transfer(address,uint256)"]), args: [attacker, 1n] }));
  await attempt("role rejects USDC.approve", USDC, encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [attacker, 1n] }));
  await attempt("role rejects delegatecall", SWAP_ROUTER, swap({}), 1);

  // Daily cap: 5 WETH already used of 45. Two 20 WETH trades exhaust it on-chain.
  for (const amt of [20n, 20n]) {
    const h = await agentWallet.writeContract({ address: roles, abi: rolesAbi, functionName: "execTransactionWithRole",
      args: [SWAP_ROUTER, 0n, swap({ amountIn: parseEther(amt.toString()) }), 0, ROLE_KEY, true], gas: 600_000n });
    await t.waitForTransactionReceipt({ hash: h });
  }
  await attempt("role rejects once 24h WETH cap is spent", SWAP_ROUTER, swap({ amountIn: parseEther("1") }));
  const capped = run(["sell-weth", "1"]);
  check("rebalance.ts sees exhausted cap before sending", !capped.ok && capped.out.includes("24h cap"));
  await t.increaseTime({ seconds: 86_401 });
  await t.mine({ blocks: 1 });
  try {
    await t.simulateContract({ account: agentWallet.account, address: roles, abi: rolesAbi, functionName: "execTransactionWithRole", args: [SWAP_ROUTER, 0n, swap({ amountIn: parseEther("1") }), 0, ROLE_KEY, true] });
    check("cap refills after 24h", true);
  } catch (e: any) {
    check("cap refills after 24h", false, e.shortMessage);
  }

  // Revocation without the agent's cooperation
  await sendAs(safe, roles, encodeFunctionData({ abi: rolesAbi, functionName: "assignRoles", args: [agent, [ROLE_KEY], [false]] }));
  await attempt("revoked agent is rejected", SWAP_ROUTER, swap({}));
  await sendAs(safe, roles, encodeFunctionData({ abi: rolesAbi, functionName: "assignRoles", args: [agent, [ROLE_KEY], [true]] }));
  await sendAs(safe, safe, encodeFunctionData({ abi: parseAbi(["function disableModule(address,address)"]), args: ["0x0000000000000000000000000000000000000001", roles] }));
  const off = run(["sell-weth", "1"]);
  check("rebalance.ts halts when module disabled", !off.ok && off.out.includes("not enabled"));

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} check(s) failed`);
  if (failures) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

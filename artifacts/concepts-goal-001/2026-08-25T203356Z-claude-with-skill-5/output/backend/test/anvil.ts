import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  publicActions,
  walletActions,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

/** Anvil's first two default accounts. */
export const DEPLOYER = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
export const CUSTOMER = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

export const RPC_URL = "http://127.0.0.1:8545";

export function startAnvil(): Promise<ChildProcess> {
  const proc = spawn("anvil", ["--silent", "--port", "8545"], { stdio: "ignore" });
  return new Promise((resolve, reject) => {
    proc.on("error", reject);
    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const deadline = Date.now() + 15_000;
    const poll = async (): Promise<void> => {
      try {
        await client.getBlockNumber();
        resolve(proc);
      } catch {
        if (Date.now() > deadline) return reject(new Error("anvil did not start"));
        setTimeout(poll, 100);
      }
    };
    poll();
  });
}

export const testClient = createTestClient({
  chain: foundry,
  mode: "anvil",
  transport: http(RPC_URL),
})
  .extend(publicActions)
  .extend(walletActions);

export function walletFor(account: typeof DEPLOYER) {
  return createWalletClient({ account, chain: foundry, transport: http(RPC_URL) });
}

/** Read a compiled artifact out of Foundry's `out/`. Run `forge build` first. */
export function artifact(name: string): { abi: Abi; bytecode: Hex } {
  const path = fileURLToPath(new URL(`../../out/${name}.sol/${name}.json`, import.meta.url));
  const json = JSON.parse(readFileSync(path, "utf8"));
  return { abi: json.abi as Abi, bytecode: json.bytecode.object as Hex };
}

export async function deploy(name: string, args: unknown[]): Promise<Address> {
  const { abi, bytecode } = artifact(name);
  const hash = await walletFor(DEPLOYER).deployContract({
    abi,
    bytecode,
    args,
    chain: foundry,
    account: DEPLOYER,
  });
  const receipt = await testClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`${name} deployment produced no address`);
  return receipt.contractAddress;
}

/** Move chain time forward and mine, so the streamed balance actually drains. */
export async function warp(seconds: number): Promise<void> {
  await testClient.increaseTime({ seconds });
  await testClient.mine({ blocks: 1 });
}

export async function chainNow(): Promise<number> {
  const block = await testClient.getBlock();
  return Number(block.timestamp);
}

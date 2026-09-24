import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  createPublicClient,
  createWalletClient,
  http,
  isHex,
  type Hex,
  type PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// FIXME: this address, as provided, fails its EIP-55 checksum, so sweep.ts will refuse
// to use it. Confirm the correct address with the team account owner and update it here.
export const TEAM_ACCOUNT = "0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC";

export const skipConfirm = process.argv.includes("--yes");

export function fail(message: string): never {
  console.error(`\nError: ${message}`);
  process.exit(1);
}

/** Reads a line from the terminal without echoing it. */
async function promptHidden(question: string): Promise<string> {
  if (!stdin.isTTY) fail("DEPLOYER_PRIVATE_KEY is not set and stdin is not a TTY to prompt for it.");
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let input = "";
    const onData = (char: string) => {
      if (char === "\r" || char === "\n" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(input.trim());
      } else if (char === "\u0003") {
        stdout.write("\n");
        process.exit(130);
      } else if (char === "\u007f") {
        input = input.slice(0, -1);
      } else {
        input += char;
      }
    };
    stdin.on("data", onData);
  });
}

/**
 * Loads the deployer from DEPLOYER_PRIVATE_KEY, or prompts for it with hidden
 * input. The key is never printed or written anywhere.
 */
export async function loadDeployer(): Promise<PrivateKeyAccount> {
  let key = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!key) key = await promptHidden("Deployer private key (input hidden): ");
  if (!key.startsWith("0x")) key = `0x${key}`;
  if (!isHex(key) || key.length !== 66) fail("Deployer private key must be 32 bytes of hex.");
  return privateKeyToAccount(key as Hex);
}

export function sepoliaClients(account: PrivateKeyAccount) {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) fail("SEPOLIA_RPC_URL is not set. See .env.example.");
  const transport = http(rpcUrl);
  return {
    publicClient: createPublicClient({ chain: sepolia, transport }),
    walletClient: createWalletClient({ account, chain: sepolia, transport }),
  };
}

/** Refuses to continue unless the RPC really is Sepolia. */
export async function assertSepolia(publicClient: ReturnType<typeof sepoliaClients>["publicClient"]) {
  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) fail(`RPC reports chain ${chainId}, expected Sepolia (${sepolia.id}).`);
}

export async function confirm(question: string): Promise<boolean> {
  if (skipConfirm) return true;
  if (!stdin.isTTY) fail("Not a TTY; re-run with --yes to skip the confirmation prompt.");
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

export const etherscanTx = (hash: Hex) => `https://sepolia.etherscan.io/tx/${hash}`;
export const etherscanAddress = (address: string) => `https://sepolia.etherscan.io/address/${address}`;

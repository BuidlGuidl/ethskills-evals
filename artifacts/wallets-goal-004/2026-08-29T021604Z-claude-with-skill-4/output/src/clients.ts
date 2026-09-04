import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { deployerPrivateKey, sepoliaRpcUrl } from "./env.js";

export function publicClient() {
  return createPublicClient({ chain: sepolia, transport: http(sepoliaRpcUrl()) });
}

export function deployerAccount() {
  return privateKeyToAccount(deployerPrivateKey());
}

export function walletClient() {
  return createWalletClient({
    account: deployerAccount(),
    chain: sepolia,
    transport: http(sepoliaRpcUrl()),
  });
}

/**
 * Never take the chain on faith from the RPC URL — a copy-pasted endpoint that
 * quietly points at mainnet is exactly how a "testnet" script spends real money.
 */
export async function assertSepolia(
  client: ReturnType<typeof publicClient>,
): Promise<void> {
  const chainId = await client.getChainId();
  if (chainId !== sepolia.id) {
    throw new Error(
      `SEPOLIA_RPC_URL is connected to chain ${chainId}, not Sepolia (${sepolia.id}). ` +
        `Refusing to continue.`,
    );
  }
}

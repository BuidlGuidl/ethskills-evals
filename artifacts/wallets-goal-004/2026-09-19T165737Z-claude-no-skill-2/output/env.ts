import { createPublicClient, createWalletClient, http, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in (see README).`);
  }
  return value;
}

/** Builds Sepolia clients from SEPOLIA_RPC_URL + DEPLOYER_PRIVATE_KEY and checks we're really on Sepolia. */
export async function sepoliaClients() {
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const key = requireEnv("DEPLOYER_PRIVATE_KEY");
  if (!isHex(key) || key.length !== 66) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string.");
  }

  const account = privateKeyToAccount(key);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });

  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    throw new Error(`SEPOLIA_RPC_URL points at chain ${chainId}, expected Sepolia (${sepolia.id}).`);
  }

  return { account, publicClient, walletClient };
}

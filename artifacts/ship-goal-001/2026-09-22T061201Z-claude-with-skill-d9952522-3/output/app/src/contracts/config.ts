import {base, baseSepolia, foundry} from "viem/chains";
import type {Address, Chain} from "viem";

import escrowAbi from "./ToolshedEscrow.abi.json" with {type: "json"};
import erc20Abi from "./erc20.abi.json" with {type: "json"};

export const ToolshedEscrowAbi = escrowAbi;
export const Erc20Abi = erc20Abi;

/** Base for production, Base Sepolia for staging, and anvil for `npm run dev` against a local
 *  chain. See "Running it locally" in the README. */
const SUPPORTED: Record<number, Chain> = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [foundry.id]: foundry,
};

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set — copy .env.example to .env.local`);
  return value;
}

function requireAddress(name: string, value: string | undefined): Address {
  const raw = requireEnv(name, value);
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) throw new Error(`${name} is not an address: ${raw}`);
  if (/^0x0{40}$/.test(raw)) throw new Error(`${name} is still the zero placeholder`);
  return raw as Address;
}

/**
 * Chain config, read from NEXT_PUBLIC_* so the same values are available in the browser, in API
 * routes and in the indexer. Throws at startup rather than failing later with a confusing revert.
 */
export function chainConfig() {
  const chainId = Number(requireEnv("NEXT_PUBLIC_CHAIN_ID", process.env.NEXT_PUBLIC_CHAIN_ID));
  const chain = SUPPORTED[chainId];
  if (!chain) {
    throw new Error(
      `NEXT_PUBLIC_CHAIN_ID=${chainId} is not supported (expected ${Object.keys(SUPPORTED).join(" or ")})`,
    );
  }
  return {
    chain,
    chainId,
    rpcUrl: requireEnv("NEXT_PUBLIC_RPC_URL", process.env.NEXT_PUBLIC_RPC_URL),
    escrowAddress: requireAddress(
      "NEXT_PUBLIC_ESCROW_ADDRESS",
      process.env.NEXT_PUBLIC_ESCROW_ADDRESS,
    ),
    usdcAddress: requireAddress("NEXT_PUBLIC_USDC_ADDRESS", process.env.NEXT_PUBLIC_USDC_ADDRESS),
  };
}

export const explorerTxUrl = (chainId: number, hash: string) =>
  chainId === base.id
    ? `https://basescan.org/tx/${hash}`
    : `https://sepolia.basescan.org/tx/${hash}`;

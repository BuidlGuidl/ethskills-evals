import type { Network } from "@x402/core/types";

/** Base mainnet or Base Sepolia. Everything else keys off this one switch. */
export type Chain = "base" | "base-sepolia";

export const CHAIN: Chain =
  process.env.CHAIN === "base" ? "base" : "base-sepolia";

/** CAIP-2 network ids — what the x402 packages expect everywhere. */
export const NETWORK: Network = CHAIN === "base" ? "eip155:8453" : "eip155:84532";

/** Blockscout REST base, used by the server to build the activity summary. */
export const BLOCKSCOUT_API =
  CHAIN === "base"
    ? "https://base.blockscout.com/api/v2"
    : "https://base-sepolia.blockscout.com/api/v2";

export const EXPLORER_TX =
  CHAIN === "base"
    ? "https://basescan.org/tx/"
    : "https://sepolia.basescan.org/tx/";

/** Price per call, as a USD string. The exact scheme converts it to USDC on NETWORK. */
export const PRICE = process.env.PRICE ?? "$0.02";

export const PORT = Number(process.env.PORT ?? 4021);

export const SERVER_URL = process.env.SERVER_URL ?? `http://localhost:${PORT}`;

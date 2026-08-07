import type { Address } from "viem";
import deployment from "./deployment.json";
import { tipJarAbi, usdcAbi } from "./abis";

// deployment.json is written by `contracts/script/Deploy.s.sol` after you
// deploy to the local chain. If you see zero addresses here, run the deploy
// step in the README.
export const CHAIN_ID = deployment.chainId as number;
export const TIP_JAR_ADDRESS = deployment.TipJar as Address;
export const USDC_ADDRESS = deployment.MockUSDC as Address;

// The real USDC on Base mainnet — what you'd point TipJar at in production.
export const BASE_MAINNET_USDC: Address =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export { tipJarAbi, usdcAbi };

// Aave V3 supply config per chain. USDC = Circle native (not bridged USDC.e).
// Sources: ethskills "addresses" skill (onchain-verified Mar 3, 2026), cross-checked
// against Aave docs (https://aave.com/docs/resources/addresses) and Circle docs
// (https://developers.circle.com/stablecoins/usdc-contract-addresses).
// Re-verify on a block explorer before first live use.

export type ChainKey = "mainnet" | "arbitrum" | "optimism" | "base";

export interface ChainConfig {
  chainId: number;
  aavePool: `0x${string}`;
  usdc: `0x${string}`;
}

export const chains: Record<ChainKey, ChainConfig> = {
  mainnet: {
    chainId: 1,
    aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Aave V3 Pool, Ethereum — ethskills addresses skill / Aave docs
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Circle native USDC, Ethereum — ethskills addresses skill / Circle docs
  },
  arbitrum: {
    chainId: 42161,
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3 Pool, Arbitrum — ethskills addresses skill / Aave docs
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Circle native USDC, Arbitrum — ethskills addresses skill / Circle docs
  },
  optimism: {
    chainId: 10,
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3 Pool, Optimism — ethskills addresses skill / Aave docs
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Circle native USDC, Optimism — ethskills addresses skill / Circle docs
  },
  base: {
    chainId: 8453,
    aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Aave V3 Pool, Base — ethskills addresses skill / Aave docs
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Circle native USDC, Base — ethskills addresses skill / Circle docs
  },
};

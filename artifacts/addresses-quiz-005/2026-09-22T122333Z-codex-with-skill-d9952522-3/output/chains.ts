// Re-check every pool and token address on its target chain before moving real funds.

export type ChainName = "mainnet" | "arbitrum" | "optimism" | "base";

export type ChainConfig = {
  chainId: number;
  aaveV3Pool: `0x${string}`;
  usdc: `0x${string}`;
};

export const chains: Record<ChainName, ChainConfig> = {
  mainnet: {
    chainId: 1,
    aaveV3Pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Source: Aave address-book AaveV3Ethereum.POOL.
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Source: Aave address-book AaveV3EthereumAssets.USDC_UNDERLYING.
  },
  arbitrum: {
    chainId: 42161,
    aaveV3Pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Source: Aave address-book AaveV3Arbitrum.POOL.
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Source: Aave address-book AaveV3ArbitrumAssets.USDCn_UNDERLYING.
  },
  optimism: {
    chainId: 10,
    aaveV3Pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Source: Aave address-book AaveV3Optimism.POOL.
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Source: Aave address-book AaveV3OptimismAssets.USDCn_UNDERLYING.
  },
  base: {
    chainId: 8453,
    aaveV3Pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Source: Aave address-book AaveV3Base.POOL.
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Source: Aave address-book AaveV3BaseAssets.USDC_UNDERLYING.
  },
};

export default chains;

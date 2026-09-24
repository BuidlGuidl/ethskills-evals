const chains = {
  mainnet: {
    aaveV3Pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Source: Aave address book AaveV3Ethereum.POOL.
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Source: Circle USDC contract address list for Ethereum mainnet.
  },
  arbitrum: {
    aaveV3Pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Source: Aave address book AaveV3Arbitrum.POOL.
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Source: Aave address book AaveV3ArbitrumAssets.USDCn_UNDERLYING; native USDC per Circle's Arbitrum list.
  },
  optimism: {
    aaveV3Pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Source: Aave address book AaveV3Optimism.POOL.
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Source: Aave address book AaveV3OptimismAssets.USDCn_UNDERLYING; native USDC per Circle's OP Mainnet list.
  },
  base: {
    aaveV3Pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Source: Aave address book AaveV3Base.POOL.
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Source: Circle USDC contract address list for Base mainnet.
  },
} as const;

export type ChainName = keyof typeof chains;
export { chains };
export default chains;
